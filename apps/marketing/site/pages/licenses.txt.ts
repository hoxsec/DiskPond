import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import interLicense from "@fontsource/inter/LICENSE?raw";
import type { APIRoute } from "astro";
import appLicense from "../../../../LICENSE?raw";
import { site } from "../config";

export const GET: APIRoute = async () => {
  const require = createRequire(import.meta.url);
  const styles = dirname(require.resolve("@blinkdisk/styles/package.json"));
  const tailwind = dirname(
    require.resolve("tailwindcss/package.json", { paths: [styles] }),
  );
  const [lucide, astro, tailwindLicense] = await Promise.all([
    readFile(
      new URL("../LICENSE", import.meta.resolve("@lucide/astro")),
      "utf8",
    ),
    readFile(
      new URL("./LICENSE", import.meta.resolve("astro/package.json")),
      "utf8",
    ),
    readFile(join(tailwind, "LICENSE"), "utf8"),
  ]);
  return new Response(
    [
      `DiskPond website\nSource and modification record: ${site.repository}\nDerived from BlinkDisk; original copyright and license notices are retained.\n`,
      `Application and website — AGPL-3.0\n${appLicense}`,
      `Inter font — SIL Open Font License 1.1\n${interLicense}`,
      `Lucide / Feather icons\n${lucide}`,
      `Astro\n${astro}`,
      `Tailwind CSS\n${tailwindLicense}`,
    ].join("\n\n----------------------------------------\n\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
