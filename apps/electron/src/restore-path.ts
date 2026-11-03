import { lstat, readdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

// lstat also sees dangling links and Windows junctions.
export async function restorePathExists(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return undefined;
    throw error;
  }
}

export async function validateRestorePath(path: string, tree = false) {
  if (!isAbsolute(path) || path.includes("\0")) throw new Error("DESTINATION");
  let current = resolve(path);
  while (true) {
    const entry = await restorePathExists(current);
    if (entry?.isSymbolicLink()) throw new Error("LINK");
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (tree) {
    const pending = [path];
    let count = 0;
    while (pending.length) {
      const directory = pending.pop();
      if (!directory) break;
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (++count > 1000000) throw new Error("DESTINATION");
        if (entry.isSymbolicLink()) throw new Error("LINK");
        if (entry.isDirectory()) pending.push(join(directory, entry.name));
      }
    }
  }
}
