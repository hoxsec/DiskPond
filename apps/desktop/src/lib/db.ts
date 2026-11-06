import { createElectronAdapter } from "@blinkdisk/signaldb-electron/renderer";
import { LOCAL_ACCOUNT_ID } from "@diskpond/constants/account";
import { SchemaCollection } from "@diskpond/electron/db/schema";
import { ZVault, type ZVaultType } from "@diskpond/schemas/vault";
import maverickReactivityAdapter from "@signaldb/maverickjs";

const vaultCollections: Record<
  string,
  ReturnType<typeof createVaultCollection>
> = {};

function createVaultCollection(accountId: string) {
  return new SchemaCollection({
    schema: ZVault,
    persistence: createElectronAdapter<ZVaultType, string>(
      `${accountId}/vault`,
    ),
    reactivity: maverickReactivityAdapter,
  });
}

export function getVaultCollection(accountId: string | undefined) {
  if (!accountId) accountId = LOCAL_ACCOUNT_ID;

  if (!vaultCollections[accountId])
    vaultCollections[accountId] = createVaultCollection(accountId);

  return vaultCollections[accountId] as ReturnType<
    typeof createVaultCollection
  >;
}
