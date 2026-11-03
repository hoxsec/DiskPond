import { CoreError } from "@blinkdisk/utils/error";
import { vaultApi } from "@desktop/lib/vault";

describe("vaultApi", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    vi.unstubAllGlobals();
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it("preserves code-only error payloads on non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(JSON.stringify({ code: "NOT_FOUND" }), {
          status: 404,
        });
      }),
    );

    await expect(vaultApi().get("/mount")).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Request failed: 404",
    });
    await expect(vaultApi().get("/mount")).rejects.toBeInstanceOf(CoreError);
  });

  it("aborts reads on caller cancellation and bounded timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: URL, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason),
              { once: true },
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = vaultApi("fixture").get("/read", {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await expect(
      vaultApi("fixture").get("/read", { timeoutMs: 5 }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
