import { useStartRestore } from "@desktop/hooks/mutations/core/use-start-restore";
import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZRestoreDirectory,
  type ZRestoreDirectoryType,
} from "@diskpond/schemas/directory";

export function useRestoreDirectoryForm({
  objectId,
  onSuccess,
}: {
  objectId: string | undefined;
  onSuccess?: () => void;
}) {
  const { mutateAsync: startRestore } = useStartRestore({
    onSuccess: () => {
      form.reset();
      onSuccess?.();
    },
  });

  const form = useAppForm({
    defaultValues: {
      type: "UNPACKED",
      filePath: "",
      directoryPath: "",
      compress: false,
      confirmed: false,
    } as ZRestoreDirectoryType,
    validators: {
      onSubmit: ZRestoreDirectory,
      onSubmitAsync: async ({ value }) => {
        if (value.type === "UNPACKED") {
          const isEmpty = await window.electron.vault.restore.checkEmpty({
            directoryPath: "directoryPath" in value ? value.directoryPath : "",
          });

          if (!isEmpty && !value.confirmed)
            return {
              code: "CONFIRMATION_REQUIRED",
            };
        }
      },
    },
    onSubmit: ({ value }) =>
      objectId &&
      startRestore({ variant: "directory", values: value, objectId }),
  });

  return form;
}
