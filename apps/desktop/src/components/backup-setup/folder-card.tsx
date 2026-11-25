import { useAppTranslation } from "@diskpond/hooks/use-app-translation";
import type { BackupFolder } from "@diskpond/schemas/source";
import { cn } from "@diskpond/utils/class";
import {
  CheckIcon,
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

export function FolderCard({
  folder,
  name,
  selected,
  onToggle,
}: {
  folder: BackupFolder;
  name: string;
  selected: boolean;
  onToggle?: () => void;
}) {
  const { t } = useAppTranslation("folder.setup");
  const id = useId();
  const Icon = icons[folder.kind];
  const Element = onToggle ? "label" : "div";
  const lastSeparator = Math.max(
    0,
    folder.path.length - folder.name.length - 1,
  );
  return (
    <Element
      className={cn(
        "group flex min-w-0 items-center gap-[clamp(.75rem,1.6vw,1.5rem)] rounded-[3px] border px-[clamp(1rem,1.85vw,1.8rem)] py-3 min-h-[clamp(4.75rem,10.8vh,7rem)]",
        onToggle &&
          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
        onToggle &&
          !folder.alreadyAdded &&
          "cursor-pointer hover:border-primary",
        selected && onToggle && "border-primary bg-accent",
      )}
    >
      <Icon
        aria-hidden="true"
        className="size-[clamp(1.75rem,3.4vw,3.25rem)] shrink-0 text-foreground/85"
        strokeWidth={1.8}
      />
      <span className="min-w-0 flex-1">
        <span
          id={`${id}-name`}
          className="block break-words text-base font-semibold lg:text-xl 2xl:text-2xl"
        >
          {name}
        </span>
        <span
          id={`${id}-path`}
          title={folder.path}
          className={cn(
            "block wrap-anywhere text-sm text-muted-foreground lg:text-base 2xl:text-xl",
            onToggle && "md:flex md:group-has-focus-visible:block",
          )}
        >
          {onToggle ? (
            <>
              <span className="min-w-0 md:truncate md:group-has-focus-visible:whitespace-normal">
                {folder.path.slice(0, lastSeparator)}
              </span>
              <span className="max-w-[70%] shrink-0 md:truncate md:group-has-focus-visible:whitespace-normal">
                {folder.path.slice(lastSeparator)}
              </span>
            </>
          ) : (
            folder.path
          )}
        </span>
        {folder.alreadyAdded && (
          <span
            id={`${id}-added`}
            className="block text-sm text-muted-foreground"
          >
            {t("alreadyAdded")}
          </span>
        )}
      </span>
      {onToggle && (
        <>
          <input
            className="sr-only"
            type="checkbox"
            checked={selected}
            disabled={folder.alreadyAdded}
            onChange={onToggle}
            aria-labelledby={`${id}-name`}
            aria-describedby={
              folder.alreadyAdded ? `${id}-path ${id}-added` : `${id}-path`
            }
          />
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[3px] border-2 border-input xl:size-8",
              selected && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {selected && (
              <CheckIcon className="size-5 xl:size-6" strokeWidth={3} />
            )}
          </span>
        </>
      )}
    </Element>
  );
}
