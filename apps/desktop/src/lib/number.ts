import { type FilesizeOptions, filesize } from "filesize";

export function formatSize(size: number, options?: FilesizeOptions) {
  return filesize(size, options);
}

export function formatInt(number: number, language?: string) {
  return number.toLocaleString(language, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCompactInt(number: number, language?: string) {
  return number.toLocaleString(language, {
    maximumFractionDigits: 1,
    notation: "compact",
  });
}
