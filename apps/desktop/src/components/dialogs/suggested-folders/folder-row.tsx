import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { BackupFolder } from "@diskpond/schemas/source";
import { Checkbox } from "@diskpond/ui/checkbox";
import { Label } from "@diskpond/ui/label";
import { cn } from "@diskpond/utils/class";
import {
  DownloadIcon,
  FileTextIcon,
  FilmIcon,
  FolderIcon,
  ImageIcon,
  MonitorIcon,
  MusicIcon,
} from "lucide-react";
import { useId } from "react";

const icons = {
  documents: FileTextIcon,
  pictures: ImageIcon,
  desktop: MonitorIcon,
  downloads: DownloadIcon,
  music: MusicIcon,
  videos: FilmIcon,
  custom: FolderIcon,
};

export function FolderRow({
  folder,
  name,
  selected,
  onCheckedChange,
}: {
  folder: BackupFolder;
  name: string;
  selected: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const { t } = useAppTranslation("folder.setup");
  const id = useId();
  const Icon = icons[folder.kind];
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className="size-5 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={`${id}-name`} className="wrap-anywhere text-sm font-medium">
          {name}
        </span>
        <span
          id={`${id}-path`}
          className="wrap-anywhere text-xs font-normal text-muted-foreground"
        >
          {folder.path}
        </span>
        {folder.alreadyAdded && (
          <span
            id={`${id}-added`}
            className="text-xs font-normal text-muted-foreground"
          >
            {t("alreadyAdded")}
          </span>
        )}
      </span>
    </>
  );
  const row = "flex w-full items-center gap-3 px-4 py-3";
  return (
    <li>
      {onCheckedChange ? (
        <Label
          htmlFor={id}
          className={cn(
            row,
            !folder.alreadyAdded && "cursor-pointer hover:bg-card-hover",
          )}
        >
          {content}
          <Checkbox
            id={id}
            checked={selected}
            disabled={folder.alreadyAdded}
            onCheckedChange={onCheckedChange}
            aria-labelledby={`${id}-name`}
            aria-describedby={
              folder.alreadyAdded ? `${id}-path ${id}-added` : `${id}-path`
            }
          />
        </Label>
      ) : (
        <div className={row}>{content}</div>
      )}
    </li>
  );
}
