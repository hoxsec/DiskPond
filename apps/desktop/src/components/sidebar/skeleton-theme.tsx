import { SkeletonTheme } from "@blinkdisk/ui/skeleton";

export type SidebarSkeletonThemeProps = {
  children: React.ReactNode;
};

export function SidebarSkeletonTheme({ children }: SidebarSkeletonThemeProps) {
  return <SkeletonTheme>{children}</SkeletonTheme>;
}
