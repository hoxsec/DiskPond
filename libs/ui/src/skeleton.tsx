import SkeletonComponent, {
  SkeletonTheme as SkeletonThemeComponent,
} from "react-loading-skeleton";

const Skeleton = SkeletonComponent;

type SkeletonThemeProps = {
  children: React.ReactNode;
  baseColor?: string;
  highlightColor?: string;
  dark?: boolean;
};

function SkeletonTheme({
  children,
  baseColor,
  highlightColor,
}: SkeletonThemeProps) {
  return (
    <SkeletonThemeComponent
      baseColor={baseColor ?? "var(--skeleton-base)"}
      highlightColor={highlightColor ?? "var(--skeleton-highlight)"}
      borderRadius="var(--radius)"
    >
      {children}
    </SkeletonThemeComponent>
  );
}
SkeletonTheme.displayName = "SkeletonTheme";

export { Skeleton, SkeletonTheme };
