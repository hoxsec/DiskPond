import { execFile } from "node:child_process";
import {
  ZSftpConfig,
  type ZSftpConfigType,
} from "@blinkdisk/schemas/providers";

const ZKeyscanRequest = ZSftpConfig.pick({ host: true, port: true }).refine(
  ({ host }) => /^[a-zA-Z0-9:][a-zA-Z0-9.:%_-]*$/.test(host),
);

export function sshKeyscan(form: Pick<ZSftpConfigType, "host" | "port">) {
  return new Promise<{ error?: string; output?: string }>((res) => {
    const request = ZKeyscanRequest.safeParse(form);
    if (!request.success) return res({ error: "SCAN_FAILED" });

    execFile(
      "ssh-keyscan",
      ["-T", "10", "-p", request.data.port.toString(), request.data.host],
      {
        timeout: 30_000,
        maxBuffer: 200 * 1024,
        windowsHide: true,
        encoding: "utf8",
      },
      (err, stdout) => {
        if (err?.code === "ENOENT")
          return res({ error: "KEYSCAN_NOT_INSTALLED" });
        // OpenSSH writes server banners to stderr even on a successful scan.
        const output = stdout
          .split(/\r?\n/)
          .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
          .join("\n");
        if (err || !output) return res({ error: "SCAN_FAILED" });
        res({ output });
      },
    );
  });
}
