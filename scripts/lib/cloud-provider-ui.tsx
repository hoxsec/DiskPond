import type { StorageProviderType } from "@diskpond/constants/providers";
import type { ProviderConfig } from "@diskpond/schemas/providers";
import { i18n } from "@diskpond/utils/i18n";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CreateVaultConfig } from "../../apps/desktop/src/components/dialogs/create-vault/config";
import { CreateVaultProviders } from "../../apps/desktop/src/components/dialogs/create-vault/providers";
import validation from "../../locales/en/validation.json";
import vault from "../../locales/en/vault.json";

await i18n.init({
  lng: "en",
  resources: { en: { vault, validation } },
  interpolation: { escapeValue: false },
});

const fixture = {
  requests: [] as unknown[],
  submissions: [] as {
    provider: StorageProviderType;
    config: ProviderConfig;
  }[],
  response: { code: "STORAGE_UNREACHABLE" } as {
    code?: string;
    uniqueID?: string;
  },
  vaults: [] as { coreId: string; status: string; name: string }[],
};
Object.assign(window, {
  cloudFixture: fixture,
  electron: {
    vault: {
      async validate(request: unknown) {
        fixture.requests.push(request);
        return fixture.response;
      },
    },
  },
});

function Fixture() {
  const [provider, setProvider] = useState<StorageProviderType>();
  const [intent, setIntent] = useState<"CREATE" | "CONNECT">("CREATE");
  return (
    <main className="mx-auto w-120 max-w-full p-6">
      <nav className="flex gap-4">
        <button type="button" onClick={() => setProvider(undefined)}>
          Back
        </button>
        <button
          type="button"
          onClick={() => {
            setProvider(undefined);
            setIntent("CONNECT");
          }}
        >
          Connect existing vault
        </button>
      </nav>
      <h1 className="mt-4 text-xl">
        {provider ? "DiskPond Cloud" : "Storage"}
      </h1>
      {provider ? (
        <CreateVaultConfig
          provider={provider}
          intent={intent}
          onSubmit={(config) => fixture.submissions.push({ provider, config })}
        />
      ) : (
        <CreateVaultProviders selectProvider={setProvider} />
      )}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<Fixture />);
