import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { coreBuildTarget } from "../libs/constants/src/core.ts";
import { root, run } from "./lib/process.mjs";

const packaging = process.argv.includes("--package");
const architectures = packaging
  ? {
      win32: ["x64"],
      linux: ["x64", "arm64", "arm"],
      darwin: ["x64", "arm64"],
    }[process.platform]
  : [process.arch];
if (!architectures)
  throw new Error(`Unsupported platform: ${process.platform}`);
const directory = resolve(root, "apps/core");
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

const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=normal"],
  {
    cwd: directory,
    encoding: "utf8",
  },
).trim();
const buildInfo = `${revision}${dirty ? "-dirty" : ""}`;

for (const architecture of architectures) {
  const target = coreBuildTarget(process.platform, architecture);
  const output = resolve(
    directory,
    "dist",
    target.directory,
    target.executable,
  );
  await mkdir(resolve(output, ".."), { recursive: true });
  await run(
    process.env.GO_BINARY || "go",
    [
      "build",
      "-trimpath",
      "-ldflags",
      `-s -w -X github.com/kopia/kopia/repo.BuildVersion=0.0.0-diskpond-dev -X github.com/kopia/kopia/repo.BuildInfo=${buildInfo} -X github.com/kopia/kopia/repo.BuildGitHubRepo=hoxsec/diskpond-core`,
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
        ...(packaging ? { CGO_ENABLED: "0" } : {}),
        ...(target.goArch === "arm" ? { GOARM: "7" } : {}),
      },
    },
  );
  // Cross-compiled Linux/Intel Mac binaries cannot run on the build host.
  if (architecture === process.arch) await run(output, ["--version"]);
  console.info(`Built ${output} from core ${buildInfo}`);
}

if (packaging && process.platform === "darwin") {
  const output = resolve(directory, "dist/kopia_darwin_universal/kopia");
  await mkdir(resolve(output, ".."), { recursive: true });
  await run("lipo", [
    "-create",
    "-output",
    output,
    ...architectures.map((architecture) =>
      resolve(
        directory,
        "dist",
        coreBuildTarget("darwin", architecture).directory,
        "kopia",
      ),
    ),
  ]);
  // lipo invalidates Go's ARM64 ad-hoc signature. Re-sign the merged executable.
  await run("codesign", ["--force", "--sign", "-", output]);
  await run("lipo", ["-verify_arch", "x86_64", "arm64", output]);
  await run(output, ["--version"]);
}
