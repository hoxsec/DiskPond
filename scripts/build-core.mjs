import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { coreBuildTarget } from "../libs/constants/src/core.ts";
import { root, run } from "./lib/process.mjs";

const target = coreBuildTarget(process.platform, process.arch);
const directory = resolve(root, "apps/core");
const output = resolve(directory, "dist", target.directory, target.executable);
const revision = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: directory,
  encoding: "utf8",
}).trim();
const pinnedRevision = execFileSync("git", ["rev-parse", ":apps/core"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (revision !== pinnedRevision) {
  throw new Error(
    `Core checkout ${revision} differs from gitlink ${pinnedRevision}. Run git submodule update --init --checkout apps/core.`,
  );
}

await mkdir(resolve(output, ".."), { recursive: true });
await run(
  process.env.GO_BINARY || "go",
  [
    "build",
    "-trimpath",
    "-ldflags",
    `-s -w -X github.com/kopia/kopia/repo.BuildVersion=0.0.0-diskpond-dev -X github.com/kopia/kopia/repo.BuildInfo=${revision} -X github.com/kopia/kopia/repo.BuildGitHubRepo=blinkdisk/core`,
    "-o",
    output,
    ".",
  ],
  {
    cwd: directory,
    env: {
      ...process.env,
      GOOS: target.goOS,
      GOARCH: target.goArch,
      ...(target.goArch === "arm" ? { GOARM: "7" } : {}),
    },
  },
);
await run(output, ["--version"]);
console.info(`Built ${output} from core ${revision}`);
