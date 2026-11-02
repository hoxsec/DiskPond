export function coreBuildTarget(platform: string, architecture: string) {
  const architectures: Record<string, string> = {
    x64: "amd64",
    arm64: "arm64",
    arm: "arm",
  };
  const goArch = architectures[architecture];
  if (!goArch)
    throw new Error(`Unsupported core architecture: ${architecture}`);

  if (platform === "win32" && architecture === "x64") {
    return {
      goOS: "windows",
      goArch,
      directory: "kopia_windows_amd64",
      executable: "kopia.exe",
    };
  }

  if (platform === "darwin" && architecture !== "arm") {
    return {
      goOS: "darwin",
      goArch,
      directory: `kopia_darwin_${goArch}`,
      executable: "kopia",
    };
  }

  if (platform === "linux") {
    return {
      goOS: "linux",
      goArch,
      directory: `kopia_linux_${architecture === "arm" ? "armv7l" : architecture}`,
      executable: "kopia",
    };
  }

  throw new Error(`Unsupported core target: ${platform}/${architecture}`);
}
