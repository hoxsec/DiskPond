import { useQueryKey } from "@desktop/hooks/use-query-key";
import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { BackupFolder } from "@diskpond/schemas/source";
import { Button } from "@diskpond/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@diskpond/ui/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { FolderRow } from "./folder-row";

export function SuggestedFoldersDialog({
  vault,
  finalFocus,
  onClose,
}: {
  vault: { id: string; name: string };
  finalFocus: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
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
  const heading = useRef<HTMLHeadingElement>(null);
  const suggestions = useQuery({
    queryKey: [...queryKeys.vault.all, vaultId, "backup-folders"],
    queryFn: () => window.electron.vault.backupFolders({ vaultId }),
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
      if (!failed.length) return onClose();
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
    heading.current?.focus();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        initialFocus={heading}
        finalFocus={finalFocus}
        showCloseButton={!busy}
        className="flex max-h-[85vh] w-144 flex-col gap-5 overflow-y-auto"
      >
        <DialogHeader className="shrink-0 pr-6">
          <p className="wrap-anywhere text-xs text-muted-foreground">
            {t("step", { step })} ·{" "}
            <span className="sr-only">{t("vault")}: </span>
            {vault.name}
          </p>
          <DialogTitle
            ref={heading}
            tabIndex={-1}
            className="leading-tight outline-none"
          >
            {t(step === 2 ? "title" : "review")}
          </DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {step === 2
              ? t("description")
              : t("reviewDescription", { vault: vault.name })}
          </DialogDescription>
        </DialogHeader>
        <section className="min-h-20 space-y-3 overflow-y-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">
              {t(step === 2 ? "suggested" : "selectedTitle")}
            </h3>
            <p role="status" className="text-xs text-muted-foreground">
              {t("selected", { count: batch.length })}
            </p>
          </div>
          {step === 2 &&
            (suggestions.isPending ? (
              <p role="status" className="text-muted-foreground">
                {t("loading")}
              </p>
            ) : suggestions.isError ? (
              <div className="flex flex-wrap items-center gap-3">
                <p role="alert">{t("loadFailed")}</p>
                <Button
                  variant="secondary"
                  onClick={() => suggestions.refetch()}
                >
                  {t("vault:failed.retry")}
                </Button>
              </div>
            ) : (
              !folders.length && (
                <p className="text-muted-foreground">{t("empty")}</p>
              )
            ))}
          {issue && (
            <p role="alert" className="text-destructive">
              {t(issue)}
            </p>
          )}
          {(review ?? folders).length > 0 && (
            <ul className="divide-y rounded-lg border bg-card">
              {(review ?? folders).map((folder) => (
                <FolderRow
                  key={folder.key}
                  folder={folder}
                  name={nameOf(folder)}
                  selected={batch.some((item) => item.key === folder.key)}
                  onCheckedChange={
                    step === 2
                      ? (value) => {
                          setChecked((previous) => ({
                            ...previous,
                            [folder.key]: value,
                          }));
                          setIssue(undefined);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
          {step === 2 && (
            <Button
              variant="secondary"
              loading={picker.isPending}
              onClick={() => picker.mutate()}
            >
              <PlusIcon />
              {t("another")}
            </Button>
          )}
        </section>
        <DialogFooter className="shrink-0 sm:flex-wrap">
          {step === 2 ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                {t("skip")}
              </Button>
              <Button
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
                variant="secondary"
                disabled={busy}
                onClick={() => changeReview(null)}
              >
                <ArrowLeftIcon />
                {t("translation:common.back")}
              </Button>
              <Button
                loading={start.isPending}
                disabled={!batch.length}
                onClick={() => {
                  setIssue(undefined);
                  start.mutate(batch);
                }}
              >
                {t("start")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
