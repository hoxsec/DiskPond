import { i18n } from "@blinkdisk/utils/i18n";
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { UpdateAction } from "../../apps/desktop/src/components/settings/update-action";
import { UpdateHistory } from "../../apps/desktop/src/components/settings/update-history";
import { SidebarAlerts } from "../../apps/desktop/src/components/sidebar/alerts";
import { useUpdateStatus } from "../../apps/desktop/src/hooks/state/use-update-status";
import type { UpdateStatus } from "../../apps/electron/src/updater";
import sidebar from "../../locales/en/sidebar.json";
import update from "../../locales/en/update.json";

await i18n.init({
  lng: "en",
  resources: { en: { update, sidebar } },
  interpolation: { escapeValue: false },
});

function Fixture() {
  const { setStatus } = useUpdateStatus();
  useEffect(() => {
    let attempts = 0;
    let finish: (() => void) | undefined;
    let state: UpdateStatus = {
      available: true,
      version: "1.0.0",
      currentVersion: "0.1.2",
      history: [],
      notes:
        "## What's new\nSafer update installation.\n<script>window.injected=true</script>\n" +
        "A long release note. ".repeat(200),
    };
    const publish = (patch: Partial<UpdateStatus>) => {
      state = { ...state, ...patch };
      setStatus(state);
    };
    Object.assign(window, {
      electron: {
        update: {
          async download() {
            attempts++;
            if (attempts === 1) {
              publish({
                phase: "error",
                history: [
                  {
                    id: "attempt-1",
                    version: "1.0.0",
                    fromVersion: "0.1.2",
                    startedAt: "2026-11-03T12:00:00Z",
                    updatedAt: "2026-11-03T12:00:00Z",
                    outcome: "DOWNLOAD_FAILED",
                  },
                ],
              });
              throw new Error("Offline");
            }
            publish({
              phase: "downloading",
              progress: 42,
              transferred: 42_000_000,
              total: 100_000_000,
              bytesPerSecond: 1_000_000,
            });
            await new Promise<void>((resolve) => {
              finish = resolve;
            });
          },
          async cancel() {
            publish({ phase: "canceled" });
            finish?.();
          },
          async remindLater() {
            publish({ remindUntil: Date.now() + 86_400_000 });
          },
          async install() {
            document.body.dataset.installed = "true";
          },
        },
      },
      finishUpdate() {
        publish({ phase: "ready", activity: "busy" });
        finish?.();
      },
      setIdle() {
        publish({ activity: "idle" });
      },
      expireReminder() {
        publish({ remindUntil: undefined });
      },
    });
    setStatus(state);
  }, [setStatus]);
  return (
    <main className="p-6">
      <section id="settings">
        <UpdateAction />
        <UpdateHistory />
      </section>
      <ul id="sidebar">
        <SidebarAlerts />
      </ul>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<Fixture />);
