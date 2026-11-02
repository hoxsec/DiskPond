import { Logo } from "@blinkdisk/components/logo";
import { LOCAL_ACCOUNT_ID } from "@blinkdisk/constants/account";
import { useAppTranslation } from "@blinkdisk/hooks/use-app-translation";
import { Button } from "@blinkdisk/ui/button";
import { showErrorToast } from "@blinkdisk/utils/error-toast";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/welcome")({ component: Welcome });

function Welcome() {
  const { t } = useAppTranslation("workspace.welcome");
  const navigate = Route.useNavigate();
  const [isOpening, setIsOpening] = useState(false);

  async function openWorkspace() {
    setIsOpening(true);
    try {
      await window.electron.workspace.open();
      await navigate({
        to: "/$accountId",
        params: { accountId: LOCAL_ACCOUNT_ID },
      });
    } catch (error) {
      showErrorToast(error);
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <main className="flex min-h-full w-full items-center justify-center overflow-y-auto p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Logo className="h-28 max-w-full" />
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button size="lg" loading={isOpening} onClick={openWorkspace}>
          {t("open")} <ArrowRightIcon />
        </Button>
        <p className="text-sm text-muted-foreground">{t("local")}</p>
      </div>
    </main>
  );
}
