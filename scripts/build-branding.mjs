import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = fileURLToPath(new URL("../", import.meta.url));
const logo = await readFile(
  resolve(root, "libs/assets/brand/diskpond-logo.svg"),
  "utf8",
);
const icon = await readFile(
  resolve(root, "libs/assets/brand/diskpond-icon.svg"),
  "utf8",
);
const png = (size, svg = icon) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font: { loadSystemFonts: false },
  })
    .render()
    .asPng();

async function save(path, data) {
  const destination = resolve(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

// ICO entries contain PNGs with alpha; Windows selects the closest native size.
function ico(sizes) {
  const images = sizes.map((size) => png(size));
  const header = Buffer.alloc(6 + sizes.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    header[entry] = header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
  });
  return Buffer.concat([header, ...images]);
}

function icns() {
  const chunks = Object.entries({
    icp4: 16,
    icp5: 32,
    icp6: 64,
    ic07: 128,
    ic08: 256,
    ic09: 512,
    ic10: 1024,
  }).map(([type, size]) => {
    const image = png(size);
    const header = Buffer.alloc(8);
    header.write(type);
    header.writeUInt32BE(image.length + 8, 4);
    return Buffer.concat([header, image]);
  });
  const header = Buffer.alloc(8);
  header.write("icns");
  header.writeUInt32BE(
    8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    4,
  );
  return Buffer.concat([header, ...chunks]);
}

// Preserve the owner's geometry in a monochrome alpha mask for the macOS menu bar.
const mask = icon
  .match(/<g[\s\S]*<\/g>/)?.[0]
  .replaceAll("#40454B", "white")
  .replaceAll("#D8DCE0", "black")
  .replaceAll("#AEB6BF", "white")
  .replaceAll("#616A74", "black")
  .replaceAll("#818993", "black")
  .replaceAll("#EFF1F3", "black");
if (!mask) throw new Error("Missing drive artwork");
const template = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="27 22 188 188"><defs><mask id="drive">${mask}</mask></defs><rect x="27" y="22" width="188" height="188" fill="black" mask="url(#drive)"/></svg>`;

await Promise.all([
  save(
    "libs/assets/brand/diskpond-logo-dark.svg",
    logo
      .replace('fill="#000000"', 'fill="#FFFFFF"')
      .replace("black wordmark", "white wordmark"),
  ),
  save("libs/assets/favicon/favicon.svg", icon),
  save("libs/assets/favicon/favicon.ico", ico([16, 32, 48, 64, 128, 256])),
  save("libs/assets/favicon/favicon-96x96.png", png(96)),
  save("libs/assets/favicon/apple-touch-icon.png", png(180)),
  save("apps/electron/icon/icon.png", png(1024)),
  save("apps/electron/icon/icon.ico", ico([16, 24, 32, 48, 64, 128, 256])),
  save("apps/electron/icon/icon.icns", icns()),
  save("apps/electron/assets/tray/win.ico", ico([16, 20, 24, 32, 40, 48, 64])),
  save("apps/electron/assets/tray/linux.png", png(24)),
  save("apps/electron/assets/tray/linux@2x.png", png(48)),
  save("apps/electron/assets/tray/mac-Template.png", png(22, template)),
  save("apps/electron/assets/tray/mac-Template@2x.png", png(44, template)),
]);
console.log(
  "Generated DiskPond wordmark, favicon, application and tray assets.",
);
