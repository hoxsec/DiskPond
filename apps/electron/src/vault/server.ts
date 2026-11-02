import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { env } from "node:process";
import { VAULT_SERVER_START_TIMEOUT_MS } from "@blinkdisk/constants/vault";
import {
  CoreError,
  VAULT_SERVER_UNAVAILABLE_MARKER,
} from "@blinkdisk/utils/error";
import { generateId } from "@blinkdisk/utils/id";
import { tryCatch } from "@blinkdisk/utils/try-catch";
import { log } from "@electron/log";
import { getPasswordCache } from "@electron/password";
import { corePath, globalVaultDirectory } from "@electron/path";
import {
  completeConnectionMigration,
  prepareConnection,
  redactConnectionError,
  rememberConnectionSecrets,
} from "@electron/vault/connection";
import { fetchVault } from "@electron/vault/fetch";
import { vaultServerStopped, vaults } from "@electron/vault/manage";
import { connectRepository } from "@electron/vault/reconnect";
import type { VaultServer, VaultStatus } from "@electron/vault/types";
import { sendWindow } from "@electron/window";
import { app } from "electron";
import { CookieJar } from "tough-cookie";

const startingServers = new Map<string, Promise<VaultServer>>();
export function startVaultServer(id: string, pollStatus = true) {
  const existing = startingServers.get(id);
  if (existing) return existing;
  const promise = startManagedServer(id, pollStatus).finally(() =>
    startingServers.delete(id),
  );
  startingServers.set(id, promise);
  return promise;
}

async function startManagedServer(id: string, pollStatus: boolean) {
  const cachedPassword = getPasswordCache({ vaultId: id });
  const connection = await prepareConnection(id, cachedPassword);
  if (connection)
    rememberConnectionSecrets(id, connection, cachedPassword || undefined);
  return new Promise<VaultServer>((res, rej) => {
    const cookies = new CookieJar();

    const signingKey = generateId();
    const sessionCookie = generateId();

    let address: string;
    let password: string;
    let controlPassword: string;
    let certificateHash: string;
    let certificate: string;

    const args = [
      "server",
      "start",
      "--ui",
      "--tls-print-server-cert",
      "--tls-generate-cert-name=127.0.0.1",
      "--random-password",
      "--random-server-control-password",
      "--tls-generate-cert",
      "--async-repo-connect",
      "--no-persist-credentials",
      "--managed-storage",
      "--disable-file-logging",
      "--disable-content-log",
      "--disable-repository-log",
      "--no-persistent-logs",
      "--error-notifications=always",
      "--kopiaui-notifications",
      `--auth-cookie-signing-key=${signingKey}`,
      "--shutdown-on-stdin",
      "--address=127.0.0.1:0",
      // CSRF tokens should only be required if the server
      // is hosted publicly. Cookies are only stored in this
      // class, so no csrf should be possible.
      "--disable-csrf-token-checks",
      "--config-file",
      resolve(globalVaultDirectory(), `${id}.config`),
    ];

    const process = spawn(corePath(), args, {
      // Managed mode starts disconnected. Exact passwords and provider data
      // travel over the certificate-verified loopback API, never argv/files.
      env: { ...env, KOPIA_PASSWORD: "", KOPIA_CHECK_FOR_UPDATES: "false" },
    });

    let settled = false;

    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(startTimeout);
      action();
    };

    const fail = (message: string) =>
      settle(() => {
        tryCatch(() => process.kill());
        rej(
          new CoreError({
            code: "VAULT_SERVER_UNAVAILABLE",
            message: `${VAULT_SERVER_UNAVAILABLE_MARKER}: ${message}`,
          }),
        );
      });

    const startTimeout = setTimeout(
      () => fail("The backup engine did not start in time"),
      VAULT_SERVER_START_TIMEOUT_MS,
    );

    process.on("error", (error) =>
      fail(`Failed to start the backup engine: ${error.message}`),
    );

    process.on("exit", (code) => {
      fail(`The backup engine stopped before it was ready (code ${code})`);
      vaultServerStopped(id, process);
    });

    let stdout = "";
    process.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > 1_048_576) {
        stdout = "";
        return;
      }
      const lines = stdout.split("\n");
      stdout = lines.pop() || "";
      for (const line of lines) logFormatted(id, line);
    });

    let pendingLine = "";
    process?.stderr.on("data", (data) => {
      pendingLine += data.toString();
      if (pendingLine.length > 1_048_576) {
        pendingLine = "";
        if (settled) log.warn("Discarded oversized engine status output");
        else fail("The backup engine returned an oversized status line");
        return;
      }
      const lines = pendingLine.split("\n");
      pendingLine = lines.pop() || "";

      for (const line of lines) {
        const parsed = parseServerLine(line);
        if (!parsed) continue;

        switch (parsed.key) {
          case "SERVER ADDRESS":
            address = parsed.value;
            break;

          case "SERVER PASSWORD":
            password = parsed.value;
            break;

          case "SERVER CONTROL PASSWORD":
            controlPassword = parsed.value;
            break;

          case "SERVER CERT SHA256":
            certificateHash = parsed.value;
            break;

          case "SERVER CERTIFICATE":
            certificate = parsed.decoded;
            break;

          case "BDC SPACE UPDATE":
            sendWindow("space.update", {
              vaultId: id,
              space: parsed.parsed,
            });
            break;

          case "BDC VAULT DELETED":
            // TODO: Clean up vault
            break;

          // TODO: Handle notification events
          case "NOTIFICATION":
            break;

          default:
            // A chunk can contain both diagnostics and authentication lines.
            // Log only this parsed diagnostic, never the entire chunk.
            logFormatted(id, line);
        }
      }

      if (address) {
        cookies?.setCookieSync(
          `Kopia-Session-Cookie=${sessionCookie}`,
          address,
        );
      }

      if (
        address &&
        password &&
        controlPassword &&
        password &&
        certificate &&
        certificateHash
      ) {
        settle(() => {
          const server = {
            process,
            cookies,
            signingKey,
            sessionCookie,
            password,
            controlPassword,
            certificateHash,
            certificate,
            address,
          };
          void (async () => {
            if (connection && cachedPassword) {
              const result = await connectRepository(
                { id, status: "STARTING", server },
                { storage: connection, password: cachedPassword },
              );
              if (!result.code) await completeConnectionMigration(id);
            }
            if (process.killed || process.exitCode !== null)
              throw new Error("Engine stopped during initialization");
            res(server);
            if (pollStatus) startStatusPool(id, server);
          })().catch(() => {
            process.kill();
            rej(
              new CoreError({
                code: "VAULT_SERVER_UNAVAILABLE",
                message: `${VAULT_SERVER_UNAVAILABLE_MARKER}: Could not prepare vault reconnection`,
              }),
            );
          });
        });
      }
    });
  });
}

function logFormatted(id: string, data: string) {
  data = redactConnectionError(id, data.toString());
  if (!app.isPackaged) return console.info(`[${id}] ${data}`);
  log.info(`[${id}] ${data}`);
}

async function startStatusPool(id: string, server: VaultServer) {
  let i = 0;
  while (!server.process.killed && server.process.exitCode === null) {
    const vault = vaults[id];
    if (!vault) {
      await new Promise((res) => setTimeout(res, 1000));
      continue;
    }
    if (vault.server !== server) return;

    const [status, error] = await tryCatch(
      fetchVault(vault, {
        method: "GET",
        path: "/api/v1/repo/status",
      }) as Promise<{
        connected?: boolean;
        initTaskID: string;
      }>,
    );

    if (error) {
      await new Promise((res) => setTimeout(res, 1000));
      continue;
    }

    let vaultStatus: VaultStatus;
    if (status.connected) vaultStatus = "RUNNING";
    else if (status.initTaskID) vaultStatus = "STARTING";
    else vaultStatus = "SETUP";

    i = i + 1;
    const delay = calculateStatusPollDelay(i);

    if (vaults[id]) {
      vaults[id].status = vaultStatus;
      vaults[id].initTask = status.initTaskID || undefined;
    }

    await new Promise((res) => setTimeout(res, delay));
  }
}

export type ParsedServerLine =
  | { key: "SERVER ADDRESS"; value: string }
  | { key: "SERVER PASSWORD"; value: string }
  | { key: "SERVER CONTROL PASSWORD"; value: string }
  | { key: "SERVER CERT SHA256"; value: string }
  | { key: "SERVER CERTIFICATE"; value: string; decoded: string }
  | { key: "BDC SPACE UPDATE"; value: string; parsed: unknown }
  | { key: "BDC VAULT DELETED" }
  | { key: "NOTIFICATION" }
  | { key: "unknown"; raw: string }
  | null;

export function parseServerLine(line: string): ParsedServerLine {
  const delimiter = line.indexOf(": ");
  if (delimiter < 0) return null;

  const key = line.substring(0, delimiter);
  const value = line.substring(delimiter + 2) || "";

  switch (key) {
    case "SERVER ADDRESS":
    case "SERVER PASSWORD":
    case "SERVER CONTROL PASSWORD":
    case "SERVER CERT SHA256":
      return { key, value };

    case "SERVER CERTIFICATE":
      return {
        key,
        value,
        decoded: Buffer.from(value, "base64").toString("ascii"),
      };

    case "BDC SPACE UPDATE":
      return { key, value, parsed: JSON.parse(value) };

    case "BDC VAULT DELETED":
      return { key: "BDC VAULT DELETED" };

    case "NOTIFICATION":
      return { key: "NOTIFICATION" };

    default:
      return { key: "unknown", raw: line };
  }
}

export function calculateStatusPollDelay(iteration: number): number {
  return iteration < 10 ? 100 * iteration : 1000;
}
