import { AccountActivity } from "@desktop/components/accounts/activity";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$accountId/activity")({
  component: AccountActivity,
});
