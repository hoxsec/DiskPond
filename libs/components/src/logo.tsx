import lightLogo from "@diskpond/assets/brand/diskpond-logo.svg";
import darkLogo from "@diskpond/assets/brand/diskpond-logo-dark.svg";
import { cn } from "@diskpond/utils/class";

type LogoProps = {
  className?: string;
  theme?: "dark" | "light";
};

export function Logo({ theme, className }: LogoProps) {
  return (
    <span className={cn("inline-flex h-14 w-auto select-none", className)}>
      <img
        src={theme === "dark" ? darkLogo : lightLogo}
        alt="DiskPond"
        width={709}
        height={232}
        draggable={false}
        className={cn("h-full w-auto", !theme && "dark:hidden")}
      />
      {!theme ? (
        <img
          src={darkLogo}
          alt="DiskPond"
          width={709}
          height={232}
          draggable={false}
          className="hidden h-full w-auto dark:block"
        />
      ) : null}
    </span>
  );
}
