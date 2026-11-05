const assert = require("node:assert/strict");
const { writeFile } = require("node:fs/promises");
const { join } = require("node:path");
const { app, BrowserWindow, session } = require("electron");
const directory = process.env.DISKPOND_CLOUD_PROVIDER_UI;
app.setPath("userData", join(directory, "profile"));
const timeout = setTimeout(() => app.exit(1), 50_000);

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((request, callback) =>
      callback({ cancel: /^https?:/.test(request.url) }),
    );
    const window = new BrowserWindow({ width: 960, height: 640 });
    const contents = window.webContents;
    const opened = [];
    contents.setWindowOpenHandler(({ url }) => {
      opened.push(url);
      return { action: "deny" };
    });
    const evaluate = (code) => contents.executeJavaScript(code);
    const frame = () =>
      evaluate(
        "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
      );
    const wait = (expression) =>
      evaluate(
        `new Promise((resolve,reject)=>{const deadline=Date.now()+5000;function check(){if(${expression})return resolve();if(Date.now()>deadline)return reject(new Error('Timed out: '+${JSON.stringify(expression)}+'; '+document.body.innerText));setTimeout(check,20);}check();})`,
      );
    const key = async (keyCode) => {
      contents.sendInputEvent({ type: "keyDown", keyCode });
      if (keyCode === "Return")
        contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode });
      await frame();
    };
    const focus = async (selector) => {
      for (let count = 0; count < 35; count++) {
        if (
          await evaluate(
            `document.activeElement === document.querySelector(${JSON.stringify(selector)})`,
          )
        ) {
          return;
        }
        await key("Tab");
      }
      throw new Error(`Cannot focus ${selector}`);
    };
    const activate = async (selector) => {
      await focus(selector);
      await key("Return");
    };
    const fill = async (selector, text) => {
      await evaluate(
        `document.querySelector(${JSON.stringify(selector)}).focus()`,
      );
      contents.sendInputEvent({
        type: "keyDown",
        keyCode: "A",
        modifiers: ["control"],
      });
      contents.sendInputEvent({
        type: "keyUp",
        keyCode: "A",
        modifiers: ["control"],
      });
      await contents.insertText(text);
      await frame();
    };
    const selectCloud = async () => {
      await wait("document.querySelector('input[aria-label]')");
      await fill("input[aria-label]", "diskpond");
      await wait("document.querySelectorAll('main > div button').length === 1");
      await activate("main > div button");
      await wait("document.querySelector('#endpoint')");
    };
    const fillCredentials = async () => {
      await fill("#endpoint", "https://storage.example.test/");
      await fill("#bucket", "fixture-bucket");
      await fill("#accessKeyId", "fixture-key");
      await fill("#accessKeySecret", "fixture-secret");
      await fill("#region", "eu-west-1");
      await fill("#sessionToken", "fixture-token");
      await fill("#prefix", "backup/");
    };
    await window.loadFile(join(directory, "index.html"));
    window.focus();
    contents.focus();
    await wait("document.body.innerText.includes('DiskPond Cloud')");
    const labels = await evaluate(
      "[...document.querySelectorAll('main > div button p:first-child')].map(e=>e.textContent)",
    );
    assert.equal(
      labels.indexOf("DiskPond Cloud"),
      labels.indexOf("S3 compatible") + 1,
    );
    await selectCloud();
    await activate("a[href]");
    assert.deepEqual(opened, ["https://cloud.diskpond.com/"]);
    assert.equal(await evaluate("window.cloudFixture.requests.length"), 0);
    assert.equal(
      await evaluate(
        "[...document.querySelectorAll('[role=switch]')].every(e=>e.getAttribute('aria-checked')==='false')",
      ),
      true,
    );
    await fillCredentials();
    await fill("#endpoint", "https://storage.example.test/bucket");
    await activate("button[type=submit]");
    await wait("document.body.innerText.includes('without a path')");
    assert.equal(await evaluate("window.cloudFixture.requests.length"), 0);
    await fill("#endpoint", "https://storage.example.test/");
    await activate("button[type=submit]");
    await wait("window.cloudFixture.requests.length === 1");
    await wait("document.querySelector('[role=alert]')");
    assert.equal(
      await evaluate("document.querySelector('#accessKeySecret').value"),
      "fixture-secret",
    );
    assert.equal(await evaluate("window.cloudFixture.submissions.length"), 0);
    await evaluate("window.cloudFixture.response = {code:'NOT_INITIALIZED'}");
    await activate("button[type=submit]");
    await wait("window.cloudFixture.submissions.length === 1");
    const submitted = await evaluate("window.cloudFixture.submissions[0]");
    assert.equal(submitted.provider, "DISKPOND_CLOUD");
    assert.deepEqual(submitted.config, {
      endpoint: "storage.example.test",
      bucket: "fixture-bucket",
      accessKeyId: "fixture-key",
      accessKeySecret: "fixture-secret",
      region: "eu-west-1",
      sessionToken: "fixture-token",
      prefix: "backup/",
      disableTls: false,
      disableTlsVerification: false,
    });
    assert.equal(
      await evaluate("window.cloudFixture.requests[0].type"),
      "DISKPOND_CLOUD",
    );
    assert.equal(
      await evaluate("window.cloudFixture.requests[0].intent"),
      "CREATE",
    );
    await activate("nav button:last-child");
    await selectCloud();
    await fillCredentials();
    await evaluate(
      "window.cloudFixture.response = {uniqueID:btoa('fixture-repository')}; window.cloudFixture.vaults = [{coreId:'fixture-repository',status:'ACTIVE',name:'Existing S3 vault'}]",
    );
    await activate("button[type=submit]");
    await wait("document.body.innerText.includes('Existing S3 vault')");
    assert.equal(await evaluate("window.cloudFixture.submissions.length"), 1);
    await evaluate("window.cloudFixture.vaults = []");
    await activate("button[type=submit]");
    await wait("window.cloudFixture.submissions.length === 2");
    assert.equal(
      await evaluate("window.cloudFixture.requests.at(-1).intent"),
      "CONNECT",
    );
    for (const theme of ["light", "dark"]) {
      await evaluate(
        `document.documentElement.className=${JSON.stringify(theme)}`,
      );
      for (const zoom of [1, 2]) {
        contents.setZoomFactor(zoom);
        await evaluate("document.querySelector('a[href]').focus()");
        await frame();
        assert.equal(
          await evaluate("document.documentElement.scrollWidth <= innerWidth"),
          true,
        );
        await writeFile(
          join(directory, `${theme}-${zoom * 100}-top.png`),
          (await contents.capturePage()).toPNG(),
        );
        await focus("button[type=submit]");
        assert.equal(
          await evaluate(
            "document.activeElement.getBoundingClientRect().bottom <= innerHeight",
          ),
          true,
        );
        await writeFile(
          join(directory, `${theme}-${zoom * 100}-bottom.png`),
          (await contents.capturePage()).toPNG(),
        );
      }
    }
    console.info(
      "PASS: provider placement/search/keyboard selection; portal handoff; secure defaults; endpoint validation; retry and field preservation; create/connect identity and duplicate prevention; light/dark 100%/200% layout",
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
