import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { Button } from "@diskpond/ui/button";
import { Trans } from "@diskpond/utils/i18n";
import { Link } from "@tanstack/react-router";

export function DefaultErrorPage() {
  const { t } = useAppTranslation("error.pages.default");

  return (
    <div className="flex min-h-screen w-screen flex-col items-center">
      <div className="my-auto flex w-[21rem] flex-col text-center">
        <h1 className="text-5xl font-extrabold tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-sm">
          <Trans
            i18nKey="error:pages.default.description"
            components={[
              <a
                key={0}
                href={`${SOURCE_URL}/issues`}
                target="_blank"
                rel="noreferrer"
                className="link-primary"
              />,
            ]}
          />
        </p>
        <div>
          <Button
            render={<Link to="/" />}
            nativeButton={false}
            className="mt-8"
          >
            {t("button")}
          </Button>
        </div>
      </div>
    </div>
  );
}

import { SOURCE_URL } from "@diskpond/constants/app";
