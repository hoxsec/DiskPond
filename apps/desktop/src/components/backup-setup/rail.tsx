import { Logo } from "@diskpond/components/logo";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import { cn } from "@diskpond/utils/class";
import { CheckIcon, HardDriveIcon } from "lucide-react";

export function SetupRail({
  step,
  vaultName,
}: {
  step: 2 | 3;
  vaultName: string;
}) {
  const { t } = useAppTranslation("folder.setup");
  return (
    <aside className="flex shrink-0 items-center justify-between gap-4 px-5 py-2 md:w-[19%] md:max-w-80 md:flex-col md:items-stretch md:justify-start md:gap-0 md:px-0 md:py-4">
      <Logo className="h-11 shrink-0 self-start md:ml-[8%] md:h-[clamp(3rem,4.5vw,4.4rem)]" />
      <div className="hidden md:mt-[clamp(1rem,3vh,2.5rem)] md:block">
        <p className="px-[11%] text-[clamp(.875rem,1.3vw,1.25rem)] font-medium text-muted-foreground">
          {t("label")}
        </p>
        <ol aria-label={t("label")} className="mt-5">
          {(["connect", "choose", "review"] as const).map((key, index) => {
            const number = index + 1;
            return (
              <li
                key={key}
                aria-current={step === number ? "step" : undefined}
                className={cn(
                  "relative flex min-h-[clamp(3.25rem,7.7vh,5rem)] items-center gap-3 pl-[11%] pr-2 text-[clamp(.875rem,1.22vw,1.2rem)] text-muted-foreground",
                  number < step && "text-foreground",
                  number === step && "bg-accent font-semibold text-primary",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-1 flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-sidebar text-base font-semibold xl:size-9",
                    number <= step && "border-primary",
                    number === step && "bg-card",
                    number < step && "bg-primary text-primary-foreground",
                  )}
                >
                  {number < step ? <CheckIcon className="size-5" /> : number}
                </span>
                {number < 3 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute z-1 left-[calc(11%+1rem)] top-[calc(50%+1.25rem)] h-[calc(100%-2.5rem)] w-px bg-border xl:left-[calc(11%+1.125rem)]",
                      number < step && "bg-primary",
                    )}
                  />
                )}
                {t(key)}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex min-w-0 items-center gap-3 md:mx-[10%] md:mt-auto md:border-t md:pb-7 md:pt-7">
        <HardDriveIcon
          aria-hidden="true"
          className="size-6 shrink-0 text-muted-foreground md:size-8"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground md:text-sm">
            {t("vault")}
          </p>
          <p className="break-words font-semibold lg:text-lg">{vaultName}</p>
        </div>
      </div>
    </aside>
  );
}
