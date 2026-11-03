import { createHash, createHmac } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readS3StorageSpace } from "@electron/s3-storage-space";

const quota = {
  bucket: "backup",
  quota_limit: 1000,
  current_usage: 400,
  remaining_quota: 600,
};
let handler: (request: IncomingMessage, response: ServerResponse) => void;
let config: Record<string, unknown>;
let calls: IncomingMessage[];
const server = createServer((request, response) => {
  calls.push(request);
  handler(request, response);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing address");
  config = {
    endpoint: `127.0.0.1:${address.port}`,
    bucket: "backup",
    accessKeyID: "fixture-access",
    secretAccessKey: "fixture-secret",
    sessionToken: "fixture-session",
    region: "us-east-1",
    doNotUseTLS: true,
  };
});
beforeEach(() => {
  calls = [];
  handler = (_request, response) => response.end(JSON.stringify(quota));
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it("reads bucket quota with a valid SigV4 signature and session token", async () => {
  expect(
    await readS3StorageSpace({ ...config, prefix: "vault-prefix/" }),
  ).toEqual({ status: "QUOTA", availableBytes: 600 });
  const request = calls[0];
  if (!request) throw new Error("Missing request");
  expect(request.method).toBe("GET");
  expect(request.url).toBe("/rustfs/admin/v3/quota-stats/backup");
  expect(request.headers["x-amz-security-token"]).toBe("fixture-session");
  // Independently verify canonical request and signing-key derivation.
  const authorization = String(request.headers.authorization);
  const signedHeaders = authorization.match(/SignedHeaders=([^,]+)/)?.[1];
  if (!signedHeaders) throw new Error("Missing signature");
  const date = String(request.headers["x-amz-date"]);
  const scope = `${date.slice(0, 8)}/us-east-1/s3/aws4_request`;
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const canonical = [
    "GET",
    request.url,
    "",
    signedHeaders
      .split(";")
      .map((name) => `${name}:${request.headers[name]}\n`)
      .join(""),
    signedHeaders,
    hash(""),
  ].join("\n");
  let key = Buffer.from("AWS4fixture-secret");
  for (const part of [date.slice(0, 8), "us-east-1", "s3", "aws4_request"])
    key = Buffer.from(createHmac("sha256", key).update(part).digest());
  const signature = createHmac("sha256", key)
    .update(["AWS4-HMAC-SHA256", date, scope, hash(canonical)].join("\n"))
    .digest("hex");
  expect(authorization).toBe(
    `AWS4-HMAC-SHA256 Credential=fixture-access/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );
});

it.each([
  1000, 1200,
])("reports genuine zero when usage is %s", async (usage) => {
  handler = (_request, response) =>
    response.end(
      JSON.stringify({ ...quota, current_usage: usage, remaining_quota: 0 }),
    );
  expect(await readS3StorageSpace(config)).toEqual({
    status: "QUOTA",
    availableBytes: 0,
  });
});

it.each([
  0,
  null,
])("does not describe an unconfigured quota (%s) as unlimited disk space", async (limit) => {
  handler = (_request, response) =>
    response.end(
      JSON.stringify({ ...quota, quota_limit: limit, remaining_quota: null }),
    );
  expect(await readS3StorageSpace(config)).toEqual({ status: "NO_QUOTA" });
});

it.each([
  404, 405, 501, 403, 500, 302,
])("handles HTTP %s without following redirects", async (status) => {
  handler = (_request, response) => {
    response.writeHead(status, {
      Location: `http://${config.endpoint}/credential-leak`,
    });
    response.end();
  };
  expect(await readS3StorageSpace(config)).toEqual({
    status: [404, 405, 501].includes(status) ? "UNSUPPORTED" : "UNAVAILABLE",
  });
  expect(calls).toHaveLength(1);
});

it.each([
  { ...quota, bucket: "other" },
  { ...quota, remaining_quota: 700 },
  { ...quota, quota_limit: -1 },
  { ...quota, remaining_quota: "600" },
  { ...quota, quota_limit: Number.MAX_SAFE_INTEGER + 1 },
  { ...quota, current_usage: 0.5 },
  { ...quota, current_usage: null, remaining_quota: null },
])("rejects inconsistent or invalid provider data: %j", async (body) => {
  handler = (_request, response) => response.end(JSON.stringify(body));
  expect(await readS3StorageSpace(config)).toEqual({ status: "UNAVAILABLE" });
});

it.each([
  "not json",
  "x".repeat(16385),
])("bounds and validates response bodies", async (body) => {
  handler = (_request, response) => response.end(body);
  expect(await readS3StorageSpace(config)).toEqual({ status: "UNAVAILABLE" });
});

it("deduplicates concurrent reads and retries failures", async () => {
  handler = (_request, response) => {
    response.writeHead(500);
    response.end();
  };
  expect(
    await Promise.all([readS3StorageSpace(config), readS3StorageSpace(config)]),
  ).toEqual([{ status: "UNAVAILABLE" }, { status: "UNAVAILABLE" }]);
  expect(calls).toHaveLength(1);
  handler = (_request, response) => response.end(JSON.stringify(quota));
  expect(await readS3StorageSpace(config)).toEqual({
    status: "QUOTA",
    availableBytes: 600,
  });
  expect(calls).toHaveLength(2);
});

it("enforces a total deadline and limits concurrent probes", async () => {
  handler = () => {};
  const reads = [0, 1, 2, 3].map((index) =>
    readS3StorageSpace({ ...config, bucket: `bucket-${index}` }),
  );
  expect(await readS3StorageSpace({ ...config, bucket: "fifth" })).toEqual({
    status: "UNAVAILABLE",
  });
  expect(await Promise.all(reads)).toEqual(
    Array(4).fill({ status: "UNAVAILABLE" }),
  );
  expect(calls).toHaveLength(4);
}, 10000);

it("does not probe AWS, credential-bearing URLs, or implicit HTTP", async () => {
  expect(
    await readS3StorageSpace({ ...config, endpoint: "s3.amazonaws.com" }),
  ).toEqual({ status: "UNSUPPORTED" });
  expect(
    await readS3StorageSpace({
      ...config,
      endpoint: "https://user:pass@example.test",
    }),
  ).toEqual({ status: "UNAVAILABLE" });
  expect(
    await readS3StorageSpace({
      ...config,
      endpoint: `http://${config.endpoint}`,
      doNotUseTLS: false,
    }),
  ).toEqual({ status: "UNAVAILABLE" });
  expect(calls).toHaveLength(0);
});
