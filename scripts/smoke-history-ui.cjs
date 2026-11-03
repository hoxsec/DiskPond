const assert = require("node:assert/strict");
const { join } = require("node:path");
const { writeFile } = require("node:fs/promises");
const { app, BrowserWindow, session } = require("electron");
const directory = process.env.DISKPOND_HISTORY_UI;
app.setPath("userData", join(directory, "profile"));
const timeout = setTimeout(() => {
  console.error("History UI timeout");
  app.exit(1);
}, 90_000);
app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest((request, callback) =>
      callback({ cancel: /^https?:/.test(request.url) }),
    );
    const window = new BrowserWindow({
      width: 1200,
      height: 900,
      webPreferences: { contextIsolation: true, backgroundThrottling: false },
    });
    const contents = window.webContents;
    contents.on("console-message", (event) => {
      if (event.level === "error") console.log("Renderer:", event.message);
    });
    await window.loadFile(join(directory, "index.html"));
    contents.setZoomFactor(1);
    window.show();
    window.focus();
    contents.focus();
    const evaluate = (code) => contents.executeJavaScript(code);
    const wait = (expression) =>
      evaluate(
        `new Promise((resolve,reject)=>{const deadline=Date.now()+8000;function check(){if(${expression})return resolve();if(Date.now()>deadline)return reject(new Error('Timed out: '+${JSON.stringify(expression)}+'; '+document.body.innerText));setTimeout(check,20);}check();})`,
      );
    const frame = () =>
      evaluate(
        "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
      );
    const key = async (keyCode) => {
      contents.sendInputEvent({ type: "keyDown", keyCode });
      if (keyCode === "Return")
        contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode });
      await frame();
    };
    const focus = async (expression) => {
      for (let index = 0; index < 100; index++) {
        if (await evaluate(expression)) return;
        await key("Tab");
      }
      throw new Error(`Cannot reach ${expression}`);
    };
    const button = async (label) => {
      await focus(
        `document.activeElement?.textContent.trim()===${JSON.stringify(label)}`,
      );
      await key("Return");
    };
    const select = async (label, fromEnd = 0) => {
      await focus(
        `document.activeElement?.getAttribute('role')==='combobox' && document.getElementById(document.activeElement.getAttribute('aria-labelledby'))?.textContent===${JSON.stringify(label)}`,
      );
      await key("Return");
      await key("End");
      for (let index = 0; index < fromEnd; index++) await key("Up");
      await key("Return");
    };
    const capture = async (name) => {
      await evaluate("document.fonts.ready");
      await frame();
      await evaluate(
        "Promise.allSettled(document.getAnimations().filter(animation=>animation.effect?.getTiming().iterations!==Infinity).map(animation=>animation.finished))",
      );
      await writeFile(
        join(directory, `${name}.png`),
        (await contents.capturePage()).toPNG(),
      );
    };
    await wait(
      "window.historyFixture && document.body.innerText.includes('Fixture A')",
    );
    assert.equal(await evaluate("document.querySelector('[data-day]')"), null);
    contents.setZoomFactor(2);
    await wait("innerWidth<768");
    await button("Menu");
    await key("Home");
    await key("Down");
    assert.equal(
      await evaluate("document.activeElement.textContent.trim()"),
      "Activity",
    );
    await key("Return");
    await wait("window.historyFixture.location().pathname==='/local/activity'");
    contents.setZoomFactor(1);
    await wait(
      "document.body.innerText.includes('6 retained snapshots') && document.body.innerText.includes('History unavailable')",
    );
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('Numbers count retained backups')",
      ),
    );
    await focus("document.activeElement?.hasAttribute('data-day')");
    const today = await evaluate("document.activeElement.dataset.day");
    assert.equal(
      await evaluate("document.activeElement.matches(':focus-visible')"),
      true,
    );
    await key("Left");
    await wait(
      `document.activeElement?.dataset.day!==${JSON.stringify(today)}`,
    );
    await key("Right");
    await wait(
      `document.activeElement?.dataset.day===${JSON.stringify(today)}`,
    );
    await capture("activity-calendar-light");
    await key("PageDown");
    await wait(
      `document.activeElement?.dataset.day?.slice(0,7)!==${JSON.stringify(today.slice(0, 7))}`,
    );
    await key("PageUp");
    await wait(
      `document.activeElement?.dataset.day===${JSON.stringify(today)}`,
    );
    await button("Today");
    await select("Vault");
    await wait("!document.body.innerText.includes('6 retained snapshots')");
    await select("Vault", 1);
    await wait("document.body.innerText.includes('6 retained snapshots')");
    await button("Open backup history");
    await wait("document.body.innerText.includes('Back to vault')");
    const location = await evaluate("window.historyFixture.location()");
    assert.equal(location.params.vaultId, "vault-a");
    assert.ok(location.search.otherHostName);
    await evaluate("window.historyFixture.compare()");
    await wait("document.body.innerText.includes('Comparison finished')");
    // The chronological drill-down above may select a file source. Inspect
    // the directory pair here, using the actual comparison selector.
    await select("Before backup");
    await wait("document.body.innerText.includes('gone.txt')");
    await focus("document.activeElement?.tagName==='INPUT'");
    await contents.insertText("edit.txt");
    await frame();
    assert.equal(
      await evaluate("document.querySelectorAll('tbody tr').length"),
      1,
    );
    assert.ok(
      await evaluate(
        "document.querySelector('section[tabindex]').getBoundingClientRect().height > 60",
      ),
    );
    await evaluate(
      "document.querySelector('section[tabindex]').scrollIntoView({block:'center'})",
    );
    await capture("comparison-filter-light");
    await evaluate(
      "document.getElementById(Array.from(document.querySelectorAll('label')).find(label=>label.textContent==='Filter compared paths').htmlFor).select()",
    );
    await key("Backspace");
    await button("Swap backups");
    await wait(
      "Array.from(document.querySelectorAll('tbody tr')).some(row=>row.textContent.includes('gone.txt') && row.textContent.includes('Added'))",
    );
    await button("Browse before backup");
    await wait("document.body.innerText.includes('Back to backup history')");
    await button("Back to backup history");
    await button("Back to vault");
    await wait("document.body.innerText.includes('Back to all profiles')");
    assert.equal(
      (await evaluate("window.historyFixture.location()")).search.otherHostName,
      "archive-pc",
    );
    await button("Back to all profiles");
    await wait("!document.body.innerText.includes('Back to all profiles')");
    assert.equal(
      await evaluate("document.activeElement.textContent.trim()"),
      "All profiles",
    );
    assert.equal(await evaluate("document.querySelector('[data-day]')"), null);
    await evaluate("document.body.classList.add('dark')");
    contents.setZoomFactor(2);
    await wait("innerWidth<768");
    await button("Menu");
    assert.equal(
      await evaluate(
        "Array.from(document.querySelectorAll('[role=menuitem]')).some(item=>item.textContent.trim()==='Activity')",
      ),
      false,
    );
    await key("Escape");
    await capture("vault-without-calendar-dark-200");
    await evaluate("window.historyFixture.home()");
    await evaluate("window.historyFixture.mode('slow')");
    await evaluate("window.historyFixture.compare()");
    await wait("document.body.innerText.includes('Cancel comparison')");
    // Make Before explicit and equal to After; an implicit preceding selection
    // legitimately disappears when After is changed to the earliest backup.
    await select("Before backup", 1);
    await wait(
      "document.body.innerText.includes('Choose two different backups')",
    );
    assert.ok(await evaluate("window.historyFixture.aborted()>0"));
    await select("After backup");
    await wait("document.body.innerText.includes('Cancel comparison')");
    await button("Cancel comparison");
    await wait("document.body.innerText.includes('Comparison canceled')");
    assert.ok(await evaluate("window.historyFixture.aborted()>0"));
    await evaluate("window.historyFixture.home()");
    await evaluate("window.historyFixture.mode('missing')");
    await evaluate("window.historyFixture.compare()");
    await wait(
      "document.body.innerText.includes('Partial comparison') && document.body.innerText.includes('Could not read saved entries')",
    );
    await capture("comparison-missing-dark-200");
    await evaluate("window.historyFixture.setReadMode('normal')");
    await button("Retry");
    await wait(
      "document.body.innerText.includes('Comparison finished') && document.body.innerText.includes('gone.txt')",
    );
    await evaluate("window.historyFixture.home()");
    await evaluate("window.historyFixture.mode('large')");
    await evaluate("window.historyFixture.compare()");
    await wait("document.body.innerText.includes('Page 1 of 3')");
    await button("Next");
    await wait("document.body.innerText.includes('Page 2 of 3')");
    assert.equal(
      await evaluate("document.querySelectorAll('tbody tr').length"),
      100,
    );
    await focus("document.activeElement?.matches('section[tabindex]')");
    assert.ok(
      await evaluate(
        "document.activeElement.getBoundingClientRect().height > 200",
      ),
    );
    assert.ok(
      await evaluate(
        "document.activeElement.scrollHeight > document.activeElement.clientHeight",
      ),
    );
    await capture("comparison-large-dark-200");
    await evaluate("window.historyFixture.home()");
    await evaluate("window.historyFixture.mode('insufficient')");
    await evaluate("window.historyFixture.compare()");
    await wait(
      "document.body.innerText.includes('At least two retained backups')",
    );
    await button("Back to backup history");
    console.info(
      "History UI passed: Home and vault without calendars, Activity navigation and vault filtering, no Activity in vault menu, keyboard day selection, comparison selection/filter/swap/browse/return, missing/cancel/large/insufficient states, Light/Dark and 200% zoom.",
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  }
});
