import { useAppForm } from "@diskpond/forms/use-app-form";
import {
  ZCreateSourceForm,
  type ZCreateSourceFormType,
} from "@diskpond/schemas/source";

export function useCreateSourceForm({
  onSubmit,
  defaultValues,
}: {
  onSubmit?: ({ value }: { value: ZCreateSourceFormType }) => void;
  defaultValues?: Partial<ZCreateSourceFormType> | null;
}) {
  const form = useAppForm({
    defaultValues: {
      name: "",
      path: "",
      type: "directory",
      ...(defaultValues || {}),
    },
    validators: {
      onSubmit: ZCreateSourceForm,
    },
    onSubmit,
  });

  return form;
}
