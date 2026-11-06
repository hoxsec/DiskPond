export const VAULT_COLORS = [
  "blue",
  "green",
  "purple",
  "amber",
  "rose",
  "graphite",
] as const;
export type VaultColor = (typeof VAULT_COLORS)[number];
