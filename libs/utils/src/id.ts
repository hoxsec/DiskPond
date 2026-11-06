import {
  createId as legidCreateId,
  verifyId as legidVerifyId,
} from "legid-sync";

const prefixes = {
  // Old vaults might also be prefixed with "strg"
  Vault: "vlt",
} as const;

type Prefix = keyof typeof prefixes;

// Part of the checksum for existing IDs; independent of the product name.
const salt = "blinkdisk:";
const length = 21;

export function generateId(prefix?: Prefix) {
  const id = legidCreateId({
    // The field is called "approximateLength" as even numbers are rounded down
    // to the nearest uneven number. We use 21, so it's always going to be 21.
    approximateLength: length,
    salt: salt,
  });

  if (!prefix) return id;
  return `${prefixes[prefix]}_${id}`;
}

export function verifyId(id: string) {
  const parts = id.split("_");
  const trimmed = parts.at(-1) || id;

  const expectedLength: number = length;

  // Length should always be 21 (see comment above)
  if (trimmed.length !== expectedLength) return false;

  return legidVerifyId(trimmed, {
    salt: salt,
  });
}
