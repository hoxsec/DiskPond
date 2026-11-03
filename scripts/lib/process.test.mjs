import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { completed, pnpm } from "./process.mjs";

test("pnpm launches scripts and standalone executables", async (t) => {
  const base =
    process.env.DISKPOND_TEST_TMP ||
    (process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Temp", "opencode")
      : tmpdir());
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, "diskpond-process & spaces-"));
  const original = process.env.npm_execpath;
  const originalRuntime = process.env.npm_node_execpath;
  t.after(async () => {
    if (original === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = original;
    if (originalRuntime === undefined) delete process.env.npm_node_execpath;
    else process.env.npm_node_execpath = originalRuntime;
    await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  });

  for (const extension of ["cjs", "mjs", "EXE", "command"]) {
    await t.test(extension, async () => {
      const native = extension === "EXE" || extension === "command";
      const executable = join(directory, `pnpm.${native ? "EXE" : extension}`);
      const probe = `process.stdout.write(JSON.stringify({
        args: process.argv.slice(${native ? 1 : 2}),
        cwd: process.cwd(),
        marker: process.env.DISKPOND_PROCESS_TEST
      }));`;
      if (native) await copyFile(process.execPath, executable);
      else await writeFile(executable, probe);
      process.env.npm_execpath = extension === "command" ? "pnpm" : executable;
      if (extension === "command") process.env.npm_node_execpath = executable;

      const args = [
        "argument with spaces",
        "literal&value",
        "%PATH%",
        '"quoted"',
      ];
      const child = pnpm(native ? ["--eval", probe, "--", ...args] : args, {
        cwd: directory,
        env: { ...process.env, DISKPOND_PROCESS_TEST: "forwarded" },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 10_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (data) => {
        stdout += data;
      });
      child.stderr.setEncoding("utf8").on("data", (data) => {
        stderr += data;
      });
      await completed(child).catch((error) => {
        throw new Error(`${error.message}\n${stderr}`, { cause: error });
      });
      assert.deepEqual(JSON.parse(stdout), {
        args,
        cwd: directory,
        marker: "forwarded",
      });
    });
  }
});
