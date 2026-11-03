const assert = require("node:assert/strict");
const { app, BrowserWindow } = require("electron");
const { join } = require("node:path");
app.setPath("userData", join(process.env.DISKPOND_RESTORE_UI, "profile"));
const watchdog = setTimeout(() => {
  console.error("Restore UI fixture timeout");
  app.exit(1);
}, 30000);
void app.whenReady().then(async () => {
  try {
    const window = new BrowserWindow({
      width: 960,
      height: 640,
      webPreferences: { contextIsolation: true },
    });
    const contents = window.webContents;
    contents.on("console-message", (event) =>
      console.info("Restore UI:", event.message),
    );
    await window.loadFile(join(process.env.DISKPOND_RESTORE_UI, "index.html"));
    const wait = async (expression) => {
      await contents.executeJavaScript(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 5000;
        const check = () => { if (${expression}) return resolve(); if (Date.now() > deadline) return reject(new Error(document.body.innerText)); setTimeout(check, 20); }; check();
      })`);
    };
    const key = async (keyCode) => {
      contents.sendInputEvent({ type: "keyDown", keyCode });
      if (keyCode === "Return")
        contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode });
      await contents.executeJavaScript(
        "new Promise(resolve => requestAnimationFrame(resolve))",
      );
    };
    const activate = async (label) => {
      window.focus();
      contents.focus();
      for (let i = 0; i < 20; i++) {
        if (
          await contents.executeJavaScript(
            `document.activeElement?.textContent === ${JSON.stringify(label)}`,
          )
        ) {
          await key("Return");
          return;
        }
        await key("Tab");
      }
      throw new Error(`Keyboard could not reach ${label}`);
    };
    await wait("document.body.innerText.includes('Restore in progress')");
    await activate("Cancel restore");
    await wait("document.body.innerText.includes('Restore canceled')");
    assert.deepEqual(
      await contents.executeJavaScript("window.fixtureActions"),
      ["cancel:fixture"],
    );
    const labels = {
      COMPLETE: "Restore completed",
      PARTIAL: "Restore completed with issues",
      FAILED: "Restore failed",
      CANCELED: "Restore canceled",
      UNAVAILABLE: "Restore outcome unavailable",
      CANCELING: "Canceling restore",
    };
    for (const dark of [false, true]) {
      await contents.executeJavaScript(
        `document.documentElement.classList.toggle('dark', ${dark})`,
      );
      contents.setZoomFactor(2);
      for (const [status, label] of Object.entries(labels)) {
        await contents.executeJavaScript(
          `window.setRestoreFixture(${JSON.stringify(status)})`,
        );
        await wait(
          `document.querySelector('[role=status]')?.textContent.includes(${JSON.stringify(label)})`,
        );
        assert.equal(
          await contents.executeJavaScript(
            "document.documentElement.scrollWidth <= innerWidth",
          ),
          true,
          `${status} overflows at 200%`,
        );
        assert.equal(
          await contents.executeJavaScript(
            "!!document.querySelector('.text-success')",
          ),
          status === "COMPLETE",
        );
      }
    }
    await contents.executeJavaScript("window.setRestoreFixture('FAILED')");
    await wait("document.body.innerText.includes('destination is full')");
    await activate("Dismiss result");
    await wait("!document.querySelector('section')");
    assert.ok(
      (await contents.executeJavaScript("window.fixtureActions")).includes(
        "dismiss:fixture",
      ),
    );
    console.info(
      "Restore component smoke passed: all outcomes, keyboard cancel/dismiss, light/dark, long paths and 200% zoom (isolated query/bridge fixture).",
    );
    clearTimeout(watchdog);
    app.exit(0);
  } catch (error) {
    console.error(error?.stack || error?.message || error);
    app.exit(1);
  }
});
