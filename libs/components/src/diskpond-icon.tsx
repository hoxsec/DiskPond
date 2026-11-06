import icon from "@diskpond/assets/brand/diskpond-icon.svg";

export function DiskPondIcon({ className }: { className?: string }) {
  return <img src={icon} alt="" aria-hidden="true" className={className} />;
}
