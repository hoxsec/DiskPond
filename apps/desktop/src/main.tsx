import "./styles.css";

import { DefaultErrorPage } from "@blinkdisk/components/errors/default";
import { NotFoundPage } from "@blinkdisk/components/errors/not-found";
import { routeTree } from "@desktop/routeTree.gen";
import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

export const history = createHashHistory();

const router = createRouter({
  history,
  routeTree,
  defaultErrorComponent: DefaultErrorPage,
  defaultNotFoundComponent: NotFoundPage,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

const savedTheme = window.electron.store.get("preferences.theme");
document.body.classList.toggle(
  "dark",
  savedTheme === "dark" ||
    (savedTheme !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches),
);

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);

  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
