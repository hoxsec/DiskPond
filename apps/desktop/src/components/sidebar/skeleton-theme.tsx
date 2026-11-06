import { SkeletonTheme } from "@diskpond/ui/skeleton";

export type SidebarSkeletonThemeProps = {
  children: React.ReactNode;
};

export function SidebarSkeletonTheme({ children }: SidebarSkeletonThemeProps) {
  return <SkeletonTheme>{children}</SkeletonTheme>;
}
