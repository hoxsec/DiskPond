import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  INTERNAL_SCHEME,
  PROTOCOL_FRONTEND_NS,
  PROTOCOL_VAULT_NS,
} from "@diskpond/constants/app";
import { fetchVaultRaw } from "@electron/vault/fetch";
import { getVault } from "@electron/vault/manage";
import { app, net, protocol } from "electron";

export function registerProtcol() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: INTERNAL_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        corsEnabled: true,
        supportFetchAPI: true,
      },
    },
  ]);
}

export function resolveProtocolPath(baseDir: string, pathname: string): string {
  return path.resolve(
    baseDir,
    pathname === "/" ? "index.html" : pathname.slice(1),
  );
}

export function isPathSafe(baseDir: string, filePath: string): boolean {
  const relativePath = path.relative(baseDir, filePath);
  return (
    !!relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

export function listenProtocol() {
  protocol.handle(INTERNAL_SCHEME, async (req) => {
    const { host, pathname, search } = new URL(req.url);

    if (host === PROTOCOL_FRONTEND_NS) {
      const baseDir = !app.isPackaged
        ? path.join(import.meta.dirname, "..", "frontend")
        : path.join(process.resourcesPath, "app.asar", "frontend");

      const pathToServe = resolveProtocolPath(baseDir, pathname);
      const isSafe = isPathSafe(baseDir, pathToServe);

      if (!isSafe) {
        return new Response("Path not allowed", {
          status: 400,
          headers: { "content-type": "text/html" },
        });
      }

      return net.fetch(pathToFileURL(pathToServe).toString());
    } else if (host === PROTOCOL_VAULT_NS) {
      // Connections require the named, validated main-owned IPC contracts.
      let canonicalPath: string;
      try {
        canonicalPath = path.posix
          .normalize(decodeURIComponent(pathname))
          .replace(/\/+$/, "");
      } catch {
        return new Response("Invalid path", { status: 400 });
      }
      if (
        ["create", "connect", "exists"].some(
          (operation) => canonicalPath === `/api/v1/repo/${operation}`,
        )
      )
        return new Response("Use the vault connection interface", {
          status: 403,
        });
      const vaultId = req.headers.get("vault-id") || "";
      const vault = getVault(vaultId);

      if (!vault) return new Response("Vault not found", { status: 404 });

      try {
        const data = req.body ? await new Response(req.body).text() : undefined;

        const res = await fetchVaultRaw(vault, {
          method: req.method as "GET" | "POST" | "PUT" | "DELETE",
          path: `${pathname}${search}`,
          data,
          signal: req.signal,
        });

        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: {
            "content-type": "application/json",
          },
        });
      }
    } else {
      return new Response("Host not found", {
        status: 404,
      });
    }
  });
}
