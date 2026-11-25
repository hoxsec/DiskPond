import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { BackupFolder } from "@diskpond/schemas/source";
import { Button } from "@diskpond/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { FolderCard } from "./folder-card";
import { SetupRail } from "./rail";

export function BackupSetup({
  vault,
  running,
  onExit,
}: {
  vault: { id: string; name: string };
  running: boolean;
  onExit: () => void;
}) {
  const { t } = useAppTranslation("folder.setup");
  const { queryKeys } = useQueryKey();
  const client = useQueryClient();
  const vaultId = vault.id;
  const [review, setReview] = useState<BackupFolder[] | null>(null);
  const step = review ? 3 : 2;
  const [custom, setCustom] = useState<BackupFolder[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState<string[]>([]);
  const [issue, setIssue] = useState<"unavailable" | "failed">();
  const focusHeading = useCallback(
    (node: HTMLHeadingElement | null) => node?.focus(),
    [],
  );
  const suggestions = useQuery({
    queryKey: [...queryKeys.vault.all, vaultId, "backup-folders"],
    queryFn: () => window.electron.vault.backupFolders({ vaultId }),
    enabled: running,
    networkMode: "always",
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const known = suggestions.data ?? [];
  const folders = [
    ...known,
    ...custom.filter(
      (item) => !known.some((folder) => folder.key === item.key),
    ),
  ].map((folder) =>
    finished.includes(folder.key) ? { ...folder, alreadyAdded: true } : folder,
  );
  const selected = folders.filter(
    (folder) =>
      !folder.alreadyAdded &&
      (checked[folder.key] ??
        (folder.kind === "documents" || folder.kind === "pictures")),
  );
  const batch = review ?? selected;
  const nameOf = (folder: BackupFolder) =>
    folder.kind === "custom" ? folder.name : t(`folders.${folder.kind}`);

  const picker = useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const result = await window.electron.dialog.open({
        properties: ["openDirectory"],
        title: t("another"),
      });
      if (result.canceled || !result.filePaths[0]) return;
      return window.electron.vault.backupFolders({
        vaultId,
        path: result.filePaths[0],
      });
    },
    onSuccess: (result) => {
      if (!result) return;
      const folder = result[0];
      if (!folder) return setIssue("unavailable");
      setCustom((previous) => [
        ...previous.filter((item) => item.key !== folder.key),
        folder,
      ]);
      setChecked((previous) => ({ ...previous, [folder.key]: true }));
      setIssue(undefined);
    },
    onError: () => setIssue("unavailable"),
  });
  const start = useMutation({
    networkMode: "always",
    mutationFn: (batch: BackupFolder[]) =>
      window.electron.vault.startFolderBackups({
        vaultId,
        folders: batch.map((folder) => ({
          path: folder.path,
          key: folder.key,
          name: nameOf(folder).slice(0, 100),
        })),
      }),
    onSuccess: ({ failed }, batch) => {
      void client.invalidateQueries({ queryKey: queryKeys.source.all });
      void client.invalidateQueries({ queryKey: queryKeys.policy.all });
      if (!failed.length) return onExit();
      setReview(batch.filter((folder) => failed.includes(folder.path)));
      setFinished((previous) => [
        ...previous,
        ...batch
          .filter((folder) => !failed.includes(folder.path))
          .map((folder) => folder.key),
      ]);
      setIssue("failed");
    },
    onError: () => setIssue("failed"),
  });
  const busy = start.isPending || picker.isPending;
  const changeReview = (next: BackupFolder[] | null) => {
    setIssue(undefined);
    setReview(next);
  };
  return (
    <div className="flex h-svh w-full min-w-0 flex-col bg-sidebar md:flex-row md:py-[1.3vh] md:pr-2">
      <SetupRail step={step} vaultName={vault.name} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col border bg-card">
        <div className="min-h-0 flex-1 overflow-y-auto px-[clamp(1rem,2.7vw,2.7rem)] pt-[clamp(1.5rem,5vh,3.25rem)] pb-6">
          <p className="text-muted-foreground lg:text-lg 2xl:text-xl">
            {t("step", { step })}
          </p>
          <h1
            key={step}
            ref={focusHeading}
            tabIndex={-1}
            className="mt-2 text-[clamp(1.75rem,3.15vw,3rem)] leading-tight font-bold tracking-tight outline-none"
          >
            {t(step === 2 ? "title" : "review")}
          </h1>
          <p className="mt-3 text-[clamp(1rem,1.55vw,1.5rem)] text-muted-foreground">
            {step === 2
              ? t("description")
              : t("reviewDescription", { vault: vault.name })}
          </p>
          <section className="mt-[clamp(1.5rem,4.5vh,3rem)]">
            <h2 className="text-[clamp(1.2rem,1.85vw,1.8rem)] font-semibold">
              {t(step === 2 ? "suggested" : "selectedTitle")}
            </h2>
            {step === 2 &&
              (suggestions.isPending ? (
                <p role="status" className="mt-4 text-muted-foreground">
                  {t("loading")}
                </p>
              ) : suggestions.isError ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <p role="alert">{t("loadFailed")}</p>
                  <Button
                    variant="outline"
                    onClick={() => suggestions.refetch()}
                  >
                    {t("vault:failed.retry")}
                  </Button>
                </div>
              ) : (
                !folders.length && (
                  <p className="mt-4 text-muted-foreground">{t("empty")}</p>
                )
              ))}
            {issue && (
              <p role="alert" className="mt-4 text-destructive">
                {t(issue)}
              </p>
            )}
            <div className="mt-[clamp(.75rem,2vh,1.4rem)] grid gap-[clamp(.75rem,1.5vw,1.5rem)] md:grid-cols-2">
              {(review ?? folders).map((folder) => {
                const active = batch.some((item) => item.key === folder.key);
                return (
                  <FolderCard
                    key={folder.key}
                    folder={folder}
                    name={nameOf(folder)}
                    selected={active}
                    onToggle={
                      step === 2
                        ? () => {
                            setChecked((previous) => ({
                              ...previous,
                              [folder.key]: !active,
                            }));
                            setIssue(undefined);
                          }
                        : undefined
                    }
                  />
                );
              })}
            </div>
            {step === 2 && (
              <Button
                className="mt-[clamp(1rem,3.5vh,2.25rem)] h-[clamp(2.75rem,5.5vh,3.5rem)] rounded-[3px] border-primary text-primary lg:text-base 2xl:text-xl"
                variant="outline"
                disabled={!running}
                loading={picker.isPending}
                onClick={() => picker.mutate()}
              >
                <PlusIcon />
                {t("another")}
              </Button>
            )}
          </section>
        </div>
        <footer className="mx-[clamp(1rem,2.7vw,2.7rem)] flex flex-wrap items-center justify-between gap-2 border-t py-[clamp(.75rem,2.5vh,1.75rem)]">
          <p role="status" className="text-sm lg:text-base 2xl:text-xl">
            {t("selected", { count: batch.length })}
          </p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-3 [&_button]:h-[clamp(2.75rem,6.4vh,4.1rem)] [&_button]:px-[clamp(1rem,2vw,2rem)] [&_button]:text-[clamp(.875rem,1.4vw,1.35rem)] [&_svg]:size-[1.1em]">
            {step === 2 ? (
              <>
                <Button
                  variant="ghost"
                  className="text-primary lg:text-base"
                  onClick={onExit}
                >
                  {t("skip")}
                </Button>
                <Button
                  className="rounded-[3px] lg:text-base"
                  disabled={!selected.length || busy}
                  onClick={() => changeReview(selected)}
                >
                  {t("review")}
                  <ArrowRightIcon />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-primary lg:text-base"
                  disabled={busy}
                  onClick={() => changeReview(null)}
                >
                  <ArrowLeftIcon />
                  {t("translation:common.back")}
                </Button>
                <Button
                  className="rounded-[3px] lg:text-base"
                  loading={start.isPending}
                  disabled={!running || !batch.length}
                  onClick={() => {
                    setIssue(undefined);
                    start.mutate(batch);
                  }}
                >
                  {t("start")}
                  <ArrowRightIcon />
                </Button>
              </>
            )}
          </div>
        </footer>
      </main>
    </div>
  );
}
