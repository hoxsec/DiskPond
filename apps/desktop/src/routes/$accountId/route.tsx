import { LOCAL_ACCOUNT_ID } from "@blinkdisk/constants/account";
import { Layout } from "@desktop/components/layout";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$accountId")({
  beforeLoad: ({ params }) => {
    if (params.accountId !== LOCAL_ACCOUNT_ID)
      throw redirect({
        to: "/$accountId",
        params: { accountId: LOCAL_ACCOUNT_ID },
      });
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
