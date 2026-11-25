import { createFileRoute, redirect } from "@tanstack/react-router";

// Links from the full-page setup now open the chooser in the vault overview.
export const Route = createFileRoute("/$accountId/backup-setup/$vaultId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$accountId/$vaultId",
      params,
      search: { suggestedFolders: true },
      replace: true,
    });
  },
});
