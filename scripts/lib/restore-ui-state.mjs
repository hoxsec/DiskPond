import { useState } from "react";

let refresh;
export function useRestoreList() {
  const [, update] = useState(0);
  refresh = () => update((value) => value + 1);
  return {
    data: window.fixtureResults,
    refetch: async () => refresh(),
    isError: false,
  };
}
window.setRestoreFixture = (status) => {
  window.fixtureResults = [
    {
      id: "fixture",
      sourceId: "source",
      destination: `C:\\Recovery\\${"long-name-".repeat(30)}`,
      objects: ["snapshot-object"],
      status,
      progress: status === "COMPLETE" ? 1 : 0,
      restored: 3,
      skipped: status === "PARTIAL" ? 1 : 0,
      errors: 0,
      issue:
        status === "PARTIAL"
          ? "ZIP"
          : status === "FAILED"
            ? "SPACE"
            : status === "UNAVAILABLE"
              ? "ENGINE"
              : undefined,
    },
  ];
  refresh?.();
};
window.setRestoreFixture("RUNNING");
window.fixtureActions = [];
window.electron = {
  vault: {
    restore: {
      cancel: async ({ id }) => {
        window.fixtureActions.push(`cancel:${id}`);
        window.setRestoreFixture("CANCELED");
      },
      dismiss: async ({ id }) => {
        window.fixtureActions.push(`dismiss:${id}`);
        window.fixtureResults = [];
      },
    },
  },
  shell: { open: { folder: async () => window.fixtureActions.push("open") } },
};
