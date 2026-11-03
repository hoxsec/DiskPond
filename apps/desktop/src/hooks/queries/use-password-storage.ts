import type { PasswordStorageStatus } from "@blinkdisk/schemas/password";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const queryKey = ["password-storage"];

export function usePasswordStorage() {
  const client = useQueryClient();
  useEffect(
    () =>
      window.electron.vault.password.change((status) => {
        client.setQueryData<PasswordStorageStatus>(queryKey, status);
      }),
    [client],
  );
  return useQuery({
    queryKey,
    queryFn: () => window.electron.vault.password.status(),
  });
}
