import { createHmac } from "node:crypto";
import {
  readSftpStorageSpace,
  verifySftpHostKey,
} from "@electron/sftp-storage-space";
import { type Connection, Server, utils } from "ssh2";

const hostKey = utils.generateKeyPairSync("ed25519");
const userKey = utils.generateKeyPairSync("ed25519");
const parsedHost = utils.parseKey(hostKey.public);
const parsedUser = utils.parseKey(userKey.public);
if (parsedHost instanceof Error || parsedUser instanceof Error)
  throw new Error("Invalid fixture keys");
const hostBytes = parsedHost.getPublicSSH();
let config: Record<string, unknown>;
let authAttempts = 0;
let requests: string[];
let extension = true;
let hang = false;
let failure = 0;
let available = 7n;
let fragmentSize = 1024n;
const clients = new Set<Connection>();

function uint32(value: number) {
  const result = Buffer.alloc(4);
  result.writeUInt32BE(value);
  return result;
}
function string(value: string) {
  const bytes = Buffer.from(value);
  return Buffer.concat([uint32(bytes.length), bytes]);
}
function packet(type: number, body: Buffer) {
  return Buffer.concat([uint32(body.length + 1), Buffer.from([type]), body]);
}

// A real SSH transport with a tiny read-only SFTP fixture. Advertising the
// extension ourselves also exercises ssh2's wire decoder, not a mocked client.
const server = new Server({ hostKeys: [hostKey.private] }, (client) => {
  clients.add(client);
  client.on("close", () => clients.delete(client));
  client.on("error", () => {});
  client.on("authentication", (context) => {
    if (context.method === "none")
      return context.reject(["password", "publickey"]);
    authAttempts++;
    if (context.username !== "fixture-user") return context.reject();
    if (
      context.method === "password" &&
      context.password === "fixture-password"
    )
      return context.accept();
    if (
      context.method === "publickey" &&
      context.key.data.equals(parsedUser.getPublicSSH()) &&
      (!context.signature ||
        (context.blob &&
          parsedUser.verify(context.blob, context.signature) === true))
    )
      return context.accept();
    context.reject();
  });
  client.on("ready", () =>
    client.on("session", (accept) => {
      const session = accept();
      session.on("subsystem", (accept, reject, info) => {
        if (info.name !== "sftp") return reject();
        const channel = accept();
        let input = Buffer.alloc(0);
        channel.on("data", (data: Buffer) => {
          input = Buffer.concat([input, data]);
          while (
            input.length >= 4 &&
            input.length >= 4 + input.readUInt32BE(0)
          ) {
            const length = input.readUInt32BE(0);
            const payload = input.subarray(4, length + 4);
            input = input.subarray(length + 4);
            if (payload[0] === 1) {
              channel.write(
                packet(
                  2,
                  Buffer.concat([
                    uint32(3),
                    ...(extension
                      ? [string("statvfs@openssh.com"), string("2")]
                      : []),
                  ]),
                ),
              );
            } else if (payload[0] === 200) {
              const id = payload.subarray(1, 5);
              const extensionLength = payload.readUInt32BE(5);
              expect(payload.subarray(9, 9 + extensionLength).toString()).toBe(
                "statvfs@openssh.com",
              );
              const offset = 9 + extensionLength;
              requests.push(
                payload
                  .subarray(
                    offset + 4,
                    offset + 4 + payload.readUInt32BE(offset),
                  )
                  .toString(),
              );
              if (hang) continue;
              if (failure) {
                channel.write(
                  packet(
                    101,
                    Buffer.concat([
                      id,
                      uint32(failure),
                      string("fixture error"),
                      string(""),
                    ]),
                  ),
                );
                continue;
              }
              const stats = Buffer.alloc(88);
              // Different bsize/bfree prove we use frsize * bavail.
              [
                4096n,
                fragmentSize,
                100n,
                90n,
                available,
                10n,
                8n,
                7n,
                0n,
                0n,
                255n,
              ].forEach((value, index) => {
                stats.writeBigUInt64BE(value, index * 8);
              });
              channel.write(packet(201, Buffer.concat([id, stats])));
            } else throw new Error(`Unexpected SFTP request ${payload[0]}`);
          }
        });
      });
    }),
  );
});

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server");
  config = {
    host: "127.0.0.1",
    port: address.port,
    username: "fixture-user",
    password: "fixture-password",
    path: "/backups/a '雪'",
    knownHostsData: `[127.0.0.1]:${address.port} ${hostKey.public}`,
  };
});
beforeEach(() => {
  authAttempts = 0;
  requests = [];
  extension = true;
  hang = false;
  failure = 0;
  available = 7n;
  fragmentSize = 1024n;
});
afterAll(async () => {
  for (const client of clients) client.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

it("reads destination available blocks with password authentication", async () => {
  expect(await readSftpStorageSpace(config)).toEqual({
    status: "AVAILABLE",
    availableBytes: 7168,
  });
  expect(requests).toEqual([config.path]);
});
it("supports private keys and retains engine password precedence", async () => {
  expect(
    await readSftpStorageSpace({
      ...config,
      password: "",
      keyData: userKey.private,
    }),
  ).toEqual({ status: "AVAILABLE", availableBytes: 7168 });
  expect(
    await readSftpStorageSpace({ ...config, keyData: "invalid ignored key" }),
  ).toEqual({ status: "AVAILABLE", availableBytes: 7168 });
});
it("verifies the host before sending authentication credentials", async () => {
  expect(
    await readSftpStorageSpace({
      ...config,
      knownHostsData: `[127.0.0.1]:${config.port} ${userKey.public}`,
    }),
  ).toEqual({ status: "UNAVAILABLE" });
  expect(authAttempts).toBe(0);
  expect(requests).toEqual([]);
});
it("rejects failed authentication and malformed keys", async () => {
  expect(await readSftpStorageSpace({ ...config, password: "wrong" })).toEqual({
    status: "UNAVAILABLE",
  });
  expect(
    await readSftpStorageSpace({ ...config, password: "", keyData: "invalid" }),
  ).toEqual({ status: "UNAVAILABLE" });
  expect(requests).toEqual([]);
});
it("reports unsupported servers without issuing other operations", async () => {
  extension = false;
  expect(await readSftpStorageSpace(config)).toEqual({ status: "UNSUPPORTED" });
  expect(requests).toEqual([]);
});
it.each([2, 3, 8])("handles SFTP status %s", async (code) => {
  failure = code;
  expect(await readSftpStorageSpace(config)).toEqual({
    status: code === 8 ? "UNSUPPORTED" : "UNAVAILABLE",
  });
});
it("preserves genuine zero", async () => {
  available = 0n;
  expect(await readSftpStorageSpace(config)).toEqual({
    status: "AVAILABLE",
    availableBytes: 0,
  });
});
it.each([
  0n,
  9007199254740992n,
])("rejects invalid/unsafe block sizes %s", async (size) => {
  fragmentSize = size;
  expect(await readSftpStorageSpace(config)).toEqual({ status: "UNAVAILABLE" });
});
it("rejects an unsafe byte product", async () => {
  available = BigInt(Number.MAX_SAFE_INTEGER);
  expect(await readSftpStorageSpace(config)).toEqual({ status: "UNAVAILABLE" });
});
it("deduplicates concurrent reads and retries after failure", async () => {
  failure = 3;
  await Promise.all([
    readSftpStorageSpace(config),
    readSftpStorageSpace(config),
  ]);
  expect(requests).toHaveLength(1);
  failure = 0;
  expect(await readSftpStorageSpace(config)).toEqual({
    status: "AVAILABLE",
    availableBytes: 7168,
  });
});
it("bounds stalled connections and concurrent work", async () => {
  hang = true;
  const reads = [1, 2, 3, 4].map((i) =>
    readSftpStorageSpace({ ...config, path: `/fixture-${i}` }),
  );
  expect(await readSftpStorageSpace({ ...config, path: "/fifth" })).toEqual({
    status: "UNAVAILABLE",
  });
  expect(await Promise.all(reads)).toEqual(
    Array(4).fill({ status: "UNAVAILABLE" }),
  );
  expect(requests).toHaveLength(4);
}, 10000);
it("does not run legacy external commands or use unknown hosts", async () => {
  expect(await readSftpStorageSpace({ ...config, externalSSH: true })).toEqual({
    status: "UNSUPPORTED",
  });
  expect(await readSftpStorageSpace({ ...config, knownHostsData: "" })).toEqual(
    { status: "UNAVAILABLE" },
  );
  expect(authAttempts).toBe(0);
});

describe("known-host verification", () => {
  it("matches names, custom ports, IPv6, aliases and hashed hostnames", () => {
    for (const [host, port, name] of [
      ["server", 22, "server"],
      ["server", 2222, "[server]:2222"],
      ["::1", 2222, "[::1]:2222"],
    ] as const) {
      expect(
        verifySftpHostKey(
          `other,${name} ${hostKey.public}`,
          host,
          port,
          hostBytes,
        ),
      ).toBe(true);
      const salt = Buffer.from("fixture-salt");
      const hash = createHmac("sha1", salt).update(name).digest("base64");
      expect(
        verifySftpHostKey(
          `|1|${salt.toString("base64")}|${hash} ${hostKey.public}`,
          host,
          port,
          hostBytes,
        ),
      ).toBe(true);
    }
  });
  it("honors negation, revocation and key types; never trusts CA entries as raw keys", () => {
    expect(
      verifySftpHostKey(
        `*.example,!bad.example ${hostKey.public}`,
        "good.example",
        22,
        hostBytes,
      ),
    ).toBe(true);
    expect(
      verifySftpHostKey(
        `*.example,!bad.example ${hostKey.public}`,
        "bad.example",
        22,
        hostBytes,
      ),
    ).toBe(false);
    expect(
      verifySftpHostKey(
        `server ${hostKey.public}\n@revoked server ${hostKey.public}`,
        "server",
        22,
        hostBytes,
      ),
    ).toBe(false);
    expect(
      verifySftpHostKey(
        `@cert-authority server ${hostKey.public}`,
        "server",
        22,
        hostBytes,
      ),
    ).toBe(false);
    expect(
      verifySftpHostKey(
        `server ${hostKey.public.replace("ssh-ed25519", "ssh-rsa")}`,
        "server",
        22,
        hostBytes,
      ),
    ).toBe(false);
    expect(
      verifySftpHostKey(`other ${hostKey.public}`, "server", 22, hostBytes),
    ).toBe(false);
  });
});
