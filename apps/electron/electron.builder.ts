// biome-ignore-all lint/suspicious/noTemplateCurlyInString: electron builder uses this syntax

import { createRequire } from "node:module";
import type { Configuration } from "electron-builder";

// Path alias seems to break build in CI
import {
  APP_ID,
  APP_NAME,
  APP_SCHEME,
  APP_SLUG,
  RELEASE_OWNER,
  RELEASE_REPOSITORY,
  SOURCE_URL,
} from "../../libs/constants/src/app";

const require = createRequire(import.meta.url);

export default {
  productName: APP_NAME,
  appId: APP_ID,
  files: ["build/**", "frontend/**", "!node_modules/**/*"],
  directories: {
    buildResources: "icon",
  },
  publish: {
    provider: "github",
    owner: RELEASE_OWNER,
    repo: RELEASE_REPOSITORY,
    vPrefixedTagName: true,
    releaseType: "draft",
  },
  extraResources: [
    {
      from: "../../LICENSE",
      to: "licenses/DiskPond-AGPL-3.0.txt",
    },
    {
      from: "../core/LICENSE",
      to: "licenses/core-Apache-2.0.txt",
    },
    {
      from: "../../UPSTREAM.md",
      to: "licenses/UPSTREAM.md",
    },
    {
      from: "assets",
      to: "./assets",
    },
  ],
  protocols: [
    {
      name: APP_NAME,
      schemes: [APP_SCHEME],
      role: "Editor",
    },
  ],
  // Used for MacOS .zip files
  artifactName: "DiskPond-macOS.${ext}",
  win: {
    appId: APP_ID,
    target: ["nsis"],
    ...(process.env.CERTUM_CERTIFICATE_SHA1 && {
      signtoolOptions: {
        signingHashAlgorithms: ["sha256"],
        certificateSha1: process.env.CERTUM_CERTIFICATE_SHA1,
        timeStampServer: process.env.CERTUM_TIMESTAMP_SERVER,
        additionalCertificateFile: process.env.CERTUM_INTERMEDIATE_CRT,
      },
    }),
    extraResources: [
      {
        from: "../core/dist/kopia_windows_amd64",
        to: "./binaries",
      },
    ],
  },
  nsis: {
    artifactName: "DiskPond-Windows.${ext}",
  },
  mac: {
    appId: APP_ID,
    hardenedRuntime: true,
    notarize: true,
    category: "public.app-category.utilities",
    entitlements: "assets/entitlements.mac.plist",
    entitlementsInherit: "assets/entitlements.mac.plist",
    target: [
      {
        // zip target is required for auto updating
        target: "zip",
        arch: ["universal"],
      },
      {
        target: "dmg",
        arch: ["universal"],
      },
    ],
    x64ArchFiles: "**/kopia",
    extraResources: [
      {
        from: "../core/dist/kopia_darwin_universal",
        to: "./binaries",
      },
    ],
  },
  dmg: {
    artifactName: "DiskPond-macOS.${ext}",
  },
  linux: {
    appId: APP_ID,
    category: "Utility",
    executableName: APP_SLUG,
    target: [
      {
        target: "AppImage",
        arch: ["x64", "arm64", "armv7l"],
      },
      {
        target: "deb",
        arch: ["x64", "arm64", "armv7l"],
      },
      {
        target: "rpm",
        arch: ["x64", "arm64", "armv7l"],
      },
    ],
    extraResources: [
      {
        from: "../core/dist/kopia_linux_${arch}",
        to: "./binaries",
      },
    ],
  },
  rpm: {
    artifactName: "DiskPond-Linux-${arch}.${ext}",
  },
  deb: {
    artifactName: "DiskPond-Linux-${arch}.${ext}",
  },
  appImage: {
    artifactName: "DiskPond-Linux-${arch}.${ext}",
  },
  extraMetadata: {
    name: APP_SLUG,
    homepage: SOURCE_URL,
    ...(process.env.GITHUB_REF_TYPE === "tag" && {
      version: process.env.GITHUB_REF_NAME?.replace(/^v/, ""),
    }),
    dependencies: {
      // electron-builder validates this version without resolving pnpm catalogs.
      "electron-updater": require("electron-updater/package.json").version,
    },
  },
} satisfies Configuration;
