import { LOCAL_ACCOUNT_ID } from "@diskpond/constants/account";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export function useDeeplinkListener() {
  const navigate = useNavigate();
  useEffect(
    () =>
      window.electron.deeplink.onOpen(({ event }) => {
        if (event === "settings")
          void navigate({
            to: "/$accountId/settings",
            params: { accountId: LOCAL_ACCOUNT_ID },
          });
      }),
    [navigate],
  );
}
