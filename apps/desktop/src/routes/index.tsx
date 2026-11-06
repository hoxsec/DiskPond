import { LOCAL_ACCOUNT_ID } from "@diskpond/constants/account";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (window.electron.store.get("workspaceReady") !== true)
      throw redirect({ to: "/welcome" });
    throw redirect({
      to: "/$accountId",
      params: { accountId: LOCAL_ACCOUNT_ID },
    });
  },
});
