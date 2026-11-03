import { SnapshotComparison } from "@desktop/components/backups/comparison";
import { parseSourceId } from "@desktop/lib/source";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

export const Route = createFileRoute("/$accountId/$vaultId/$sourceId/compare")({
  validateSearch: z.object({ snapshot: z.string().optional() }),
  component: RouteComponent,
});

function RouteComponent() {
  const { vaultId, sourceId } = Route.useParams();
  const { snapshot } = Route.useSearch();
  const source = useMemo(() => {
    const parsed = parseSourceId(sourceId);
    return parsed
      ? { host: parsed.device, userName: parsed.user, path: parsed.path }
      : null;
  }, [sourceId]);
  return (
    source && (
      <SnapshotComparison
        key={`${vaultId}:${sourceId}:${snapshot ?? ""}`}
        vaultId={vaultId}
        source={source}
        selectedSnapshot={snapshot}
      />
    )
  );
}
