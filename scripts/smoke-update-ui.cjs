const assert = require("node:assert/strict");
const { join } = require("node:path");
const { writeFile } = require("node:fs/promises");
const { app, BrowserWindow, session } = require("electron");
const directory = process.env.DISKPOND_UPDATE_UI;
app.setPath("userData", join(directory, "profile"));
const timeout = setTimeout(() => app.exit(1), 30_000);
app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((request, callback) =>
      callback({ cancel: /^https?:/.test(request.url) }),
    );
    const window = new BrowserWindow({ width: 960, height: 640 });
    const contents = window.webContents;
    const evaluate = (code) => contents.executeJavaScript(code);
    const wait = (expression) =>
      evaluate(
        `new Promise((resolve,reject)=>{const deadline=Date.now()+5000;function check(){if(${expression})return resolve();if(Date.now()>deadline)return reject(new Error('Timed out: '+${JSON.stringify(expression)}+'; '+document.body.innerText));setTimeout(check,20);}check();})`,
      );
    const key = async (keyCode) => {
      contents.sendInputEvent({ type: "keyDown", keyCode });
      if (keyCode === "Return")
        contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode });
    };
    const activate = async (label) => {
      for (let index = 0; index < 30; index++) {
        if (
          await evaluate(
            `document.activeElement?.textContent.trim() === ${JSON.stringify(label)}`,
          )
        ) {
          await key("Return");
          return;
        }
        await key("Tab");
        await evaluate("new Promise(resolve=>requestAnimationFrame(resolve))");
      }
      throw new Error(`Cannot focus ${label}`);
    };
    await window.loadFile(join(directory, "index.html"));
    window.focus();
    contents.focus();
    await wait(
      "document.querySelector('button')?.textContent==='Download update'",
    );
    await activate("Download update");
    await wait("document.querySelector('[role=alert]')");
    await activate("Download update");
    await wait("document.body.innerText.includes('Downloading 42%')");
    assert.equal(
      await evaluate("document.querySelector('button').disabled"),
      true,
    );
    assert.match(
      await evaluate("document.body.innerText"),
      /42 MB of 100 MB.*1 MB\/s/,
    );
    await activate("Cancel download");
    await wait("document.body.innerText.includes('Download canceled')");
    await activate("Download update");
    await wait("document.body.innerText.includes('Downloading 42%')");
    await evaluate("window.finishUpdate()");
    await wait("document.body.innerText.includes('Restart and install')");
    assert.equal(
      await evaluate("document.querySelector('button').disabled"),
      true,
    );
    await wait(
      "document.body.innerText.includes('Waiting for backups and restores')",
    );
    await evaluate("window.setIdle()");
    await wait("!document.querySelector('button').disabled");
    await activate("What's new");
    await wait("document.querySelector('#settings details').open");
    assert.equal(await evaluate("window.injected"), undefined);
    assert.match(
      await evaluate(
        "document.querySelector('#settings section[aria-label]').textContent",
      ),
      /<script>/,
    );
    await activate("Update history");
    await wait(
      "document.body.innerText.includes('Installed version: 0.1.2') && document.body.innerText.includes('Download failed')",
    );
    await activate("Remind me later");
    await wait("!document.querySelector('#sidebar button')");
    assert.match(
      await evaluate("document.querySelector('#settings').innerText"),
      /Restart and install/,
    );
    await evaluate("window.expireReminder()");
    await wait("document.querySelector('#sidebar button')");
    for (const theme of ["light", "dark"]) {
      await evaluate(
        `document.documentElement.className=${JSON.stringify(theme)}`,
      );
      contents.setZoomFactor(2);
      await evaluate(
        "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
      );
      assert.equal(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        true,
      );
      await writeFile(
        join(directory, `${theme}-200.png`),
        (await contents.capturePage()).toPNG(),
      );
    }
    await evaluate("document.querySelector('button').focus()");
    await key("Return");
    await wait("document.body.dataset.installed==='true'");
    console.info(
      "PASS: keyboard failure/retry/cancel/details/notes/history/reminder/idle-install; safe notes; light/dark 200% layout",
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
