import { CreateVaultConfig } from "@desktop/components/dialogs/create-vault/config";
import { CreateVaultDetails } from "@desktop/components/dialogs/create-vault/details";
import { CreateVaultProviders } from "@desktop/components/dialogs/create-vault/providers";
import {
  type CreateVaultStep,
  useCreateVaultDialog,
} from "@desktop/hooks/state/use-create-vault-dialog";
import { VaultValidationPending } from "@desktop/hooks/use-config-validation";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@diskpond/ui/dialog";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const backButton: Record<CreateVaultStep, CreateVaultStep> = {
  PROVIDER: "PROVIDER",
  CONFIG: "PROVIDER",
  DETAILS: "CONFIG",
};

export function CreateVaultDialog() {
  const { t } = useAppTranslation("vault.createDialog");
  const { isOpen, setIsOpen, options, setOptions, resetOptions } =
    useCreateVaultDialog();
  const { step, provider, config, intent } = options;
  const [busy, setBusy] = useState(false);
  const content = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen)
      content.current
        ?.querySelector<HTMLElement>(
          step === "CONFIG" ? "form button" : "input",
        )
        ?.focus();
  }, [step, isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const reset = useCallback(() => {
    resetOptions();
  }, [resetOptions]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!busy) setIsOpen(open);
      }}
      onClosed={reset}
    >
      <DialogContent
        ref={content}
        showCloseButton={!busy}
        className="w-120 block max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3">
          {step !== "PROVIDER" ? (
            <Button
              aria-label={t("back")}
              disabled={busy}
              onClick={() => setOptions({ step: backButton[step] })}
              variant="ghost"
              size="icon-sm"
            >
              <ArrowLeftIcon />
            </Button>
          ) : null}
          <DialogTitle>
            {intent === "CREATE" ? t("title.default") : t("title.connect")}
          </DialogTitle>
        </div>
        <DialogDescription className="mt-3">
          {intent === "CREATE" ? t("description") : t("connectDescription")}
        </DialogDescription>
        {step === "PROVIDER" ? (
          <CreateVaultProviders
            selectProvider={(newProvider) => {
              setOptions({
                provider: newProvider,
                config: provider !== newProvider ? undefined : config,
                step: "CONFIG",
              });
            }}
          />
        ) : step === "CONFIG" ? (
          <VaultValidationPending.Provider value={setBusy}>
            <CreateVaultConfig
              intent={intent}
              config={config}
              provider={provider}
              onSubmit={(config) => {
                setOptions({
                  config,
                  step: "DETAILS",
                });
              }}
            />
          </VaultValidationPending.Provider>
        ) : step === "DETAILS" ? (
          <CreateVaultDetails
            intent={intent}
            setBusy={setBusy}
            providerType={provider}
            onSubmit={() => {
              close();
            }}
            config={config}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
