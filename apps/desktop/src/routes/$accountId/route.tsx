import { LOCAL_ACCOUNT_ID } from "@blinkdisk/constants/account";
import { Layout } from "@desktop/components/layout";
import { getVaultCollection } from "@desktop/lib/db";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$accountId")({
  beforeLoad: async ({ params }) => {
    if (params.accountId !== LOCAL_ACCOUNT_ID)
      throw redirect({
        to: "/$accountId",
        params: { accountId: LOCAL_ACCOUNT_ID },
      });
    // A reopened renderer must load persisted descriptors before it decides
    // whether this is an empty workspace. Engines continue running in main.
    await getVaultCollection(LOCAL_ACCOUNT_ID).isReady();
  },
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
