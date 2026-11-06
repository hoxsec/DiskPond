import { CreateSourceGeneral } from "@desktop/components/dialogs/create-source/general";
import { useCreateSourceForm } from "@desktop/hooks/forms/use-create-source-form";
import { useCreateSource } from "@desktop/hooks/mutations/core/use-create-source";
import { useCreateSourceDraftPolicy } from "@desktop/hooks/mutations/core/use-create-source-draft-policy";
import { useCreateSourceDialog } from "@desktop/hooks/state/use-create-source-dialog";
import { useLocalProfile } from "@desktop/hooks/use-local-profile";
import { useStore } from "@diskpond/forms/use-app-form";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@diskpond/ui/dialog";
import { useCallback, useRef } from "react";

type CreateSourceAction = "CREATE" | "POLICY";

export function CreateSourceDialog() {
  const { t } = useAppTranslation("folder.createDialog");
  const { localHostName, localUserName } = useLocalProfile();

  const { isOpen, setIsOpen, defaultValues, clearDefaultValues } =
    useCreateSourceDialog();

  const actionRef = useRef<CreateSourceAction>("CREATE");

  const onSuccess = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const { mutateAsync: createSource, isPending: isCreatingSource } =
    useCreateSource({
      onSuccess,
    });

  const { mutateAsync: createDraft, isPending: isCreatingDraft } =
    useCreateSourceDraftPolicy({
      onSuccess,
    });

  const form = useCreateSourceForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      if (actionRef.current === "POLICY") {
        await createDraft({
          ...value,
          hostName: localHostName,
          userName: localUserName,
        });
        return;
      }

      await createSource(value);
    },
  });

  const values = useStore(form.store, (state) => state.values);

  const reset = useCallback(() => {
    form.reset();
    clearDefaultValues();
    actionRef.current = "CREATE";
  }, [form, clearDefaultValues]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} onClosed={reset}>
      <DialogContent className="block max-h-[80vh] max-w-115 overflow-y-auto">
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <CreateSourceGeneral
          form={form}
          values={values}
          isCreatingSource={isCreatingSource}
          isCreatingDraft={isCreatingDraft}
          onAction={(action) => {
            actionRef.current = action;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
