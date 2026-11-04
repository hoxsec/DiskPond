import logo from "@blinkdisk/assets/brand/diskpond-logo-dark.svg?raw";
import type { APIRoute } from "astro";
import sharp from "sharp";
import { copy } from "../content";

const escapeXml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export const GET: APIRoute = async () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#121418"/>
    <rect x="40" y="40" width="1120" height="550" fill="none" stroke="#3b4351"/>
    ${logo.replace("<svg ", '<svg x="72" y="62" width="290" height="95" ')}
    <g font-family="Arial, sans-serif" font-weight="700" font-size="68">
      <text x="90" y="290" fill="#e8ebf0">${escapeXml(copy.home.title)}</text>
      <text x="90" y="380" fill="#7aa7ff">${escapeXml(copy.home.titleAccent)}</text>
    </g>
    <text x="90" y="500" font-family="Arial, sans-serif" font-size="24" fill="#a8b1c0">${escapeXml(copy.home.trust.join("  /  "))}</text>
  </svg>`;
  const image = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png" },
  });
};
