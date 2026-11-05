export function updateMetadataName(platform: string, architecture: string) {
  if (platform === "win32" && architecture === "x64") return "latest.yml";
  if (platform === "darwin" && ["x64", "arm64"].includes(architecture))
    return "latest-mac.yml";
  if (platform === "linux") {
    if (architecture === "x64") return "latest-linux.yml";
    if (architecture === "arm64") return "latest-linux-arm64.yml";
    if (architecture === "arm") return "latest-linux-arm.yml";
  }
  throw new Error(`Unsupported update target: ${platform}/${architecture}`);
}
