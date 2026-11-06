export const APP_NAME = "DiskPond";
export const APP_SLUG = "diskpond";
export const APP_ID = "io.github.hoxsec.diskpond";
export const RELEASE_OWNER = "hoxsec";
export const RELEASE_REPOSITORY = "DiskPond";
export const SOURCE_URL = `https://github.com/${RELEASE_OWNER}/${RELEASE_REPOSITORY}`;

export const APP_SCHEME = APP_ID;
export const APP_SCHEME_PROTOCOL = `${APP_SCHEME}:`;

export const INTERNAL_SCHEME = "diskpondapp";
export const INTERNAL_PROTOCOL = `${INTERNAL_SCHEME}:`;

export const PROTOCOL_VAULT_NS = "vault";
export const PROTOCOL_VAULT_URL = `${INTERNAL_SCHEME}://${PROTOCOL_VAULT_NS}`;
export const PROTOCOL_FRONTEND_NS = "frontend";
export const PROTOCOL_FRONTEND_URL = `${INTERNAL_SCHEME}://${PROTOCOL_FRONTEND_NS}`;
