"use client";

import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ dark, ...props }: ToasterProps & { dark: boolean }) => {
  return (
    <Sonner
      className="toaster group"
      duration={5000}
      style={{ fontFamily: "inherit" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-popover group-[.toaster]:!text-popover-foreground group-[.toaster]:!border-border group-[.toaster]:rounded-none! group-[.toaster]:shadow-md",
          description: "group-[.toast]:!text-muted-foreground text-xs",
          actionButton:
            "group-[.toast]:bg-primary! group-[.toast]:text-primary-foreground! group-[.toast]:rounded-none!",
          cancelButton:
            "group-[.toast]:bg-muted! group-[.toast]:text-muted-foreground! group-[.toast]:rounded-none!",
          closeButton:
            "group-[.toast]:bg-popover! group-[.toast]:text-popover-foreground! group-[.toast]:border-border! group-[.toast]:rounded-none!",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-6 !pr-2 text-success" />,
        info: <InfoIcon className="size-6 !pr-2 text-info" />,
        error: <CircleXIcon className="size-6 !pr-2 text-destructive" />,
        warning: <TriangleAlertIcon className="size-6 !pr-2 text-warning" />,
      }}
      theme={dark ? "dark" : "light"}
      {...props}
    />
  );
};

export { Toaster };
