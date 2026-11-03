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
      "window.historyFixture && document.body.innerText.includes('Back to vault') && document.body.innerText.includes('Compare backups')",
    );
    assert.ok(
      await evaluate("!document.body.innerText.includes('comparison.title')"),
    );
    await focus(
      "document.activeElement?.getAttribute('aria-haspopup')==='menu' && document.activeElement.closest('.bg-card')",
    );
    await key("Return");
    await wait(
      "Array.from(document.querySelectorAll('[role=menuitem]')).some(item=>item.textContent.trim()==='Compare backups')",
    );
    await button("Compare backups");
    await wait("document.body.innerText.includes('Comparison finished')");
    await button("Back to backup history");
    await button("Compare backups");
    await wait("document.body.innerText.includes('Comparison finished')");
    await evaluate("window.historyFixture.home()");
    await wait("document.body.innerText.includes('Fixture A')");
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
    const entries =
      "Array.from(document.querySelectorAll('[data-slot=activity-entry]'))";
    const firstEntry = `${entries}[0]`;
    const partialEntry = `${entries}.find(entry=>entry.querySelector('summary').textContent.includes('Completed with issues'))`;
    const failedEntry = `${entries}.find(entry=>entry.querySelector('summary').textContent.includes('Failed'))`;
    assert.equal(await evaluate(`${entries}.length`), 7);
    assert.ok(await evaluate(`${entries}.every(entry=>!entry.open)`));
    assert.ok(
      await evaluate(
        `${entries}.some(entry=>{const summary=entry.querySelector('summary');return summary.textContent.includes('Documents') && summary.textContent.includes('Fixture A') && summary.textContent.includes('8 B · 2 files') && summary.textContent.includes('Completed') && summary.querySelector('time[datetime] .sr-only')?.textContent.includes('Ended:');})`,
      ),
    );
    assert.ok(
      await evaluate(
        `${entries}.filter(entry=>entry.querySelector('summary').textContent.includes('Single file')).every(entry=>entry.querySelector('summary').textContent.includes('Unavailable') && entry.querySelector('summary').textContent.includes('Outcome unknown'))`,
      ),
    );
    await focus(
      "document.activeElement?.matches('[data-slot=activity-entry] > summary')",
    );
    assert.ok(
      await evaluate("document.activeElement.matches(':focus-visible')"),
    );
    await capture("activity-rows-light");
    await key("Return");
    await wait(`${firstEntry}.open`);
    assert.ok(
      await evaluate(
        `${firstEntry}.innerText.includes('Started:') && ${firstEntry}.innerText.includes('Ended:') && ${firstEntry}.innerText.includes('archive-pc:')`,
      ),
    );
    await key("Return");
    await wait(`!${firstEntry}.open`);
    await key("Tab");
    assert.ok(
      await evaluate(
        "document.activeElement.matches('[data-slot=activity-entry] > summary')",
      ),
    );
    await focus(
      `document.activeElement===${partialEntry}.querySelector('summary')`,
    );
    await key("Return");
    await wait(
      `${partialEntry}.open && document.body.innerText.includes('Fixture read failure')`,
    );
    await key("Space");
    await wait(`!${partialEntry}.open`);
    await focus(
      `document.activeElement===${failedEntry}.querySelector('summary')`,
    );
    await key("Return");
    await wait(
      `${failedEntry}.open && document.body.innerText.includes('Fixture storage unavailable')`,
    );
    await key("Return");
    await evaluate("document.body.classList.add('dark')");
    contents.setZoomFactor(2);
    await wait("innerWidth<768");
    await evaluate(
      `${partialEntry}.querySelector('summary').scrollIntoView({block:'center'})`,
    );
    assert.ok(
      await evaluate(
        `${entries}.every(entry=>entry.scrollWidth<=entry.clientWidth)`,
      ),
    );
    await capture("activity-rows-dark-200");
    await focus(
      `document.activeElement===${partialEntry}.querySelector('summary')`,
    );
    await key("Return");
    await wait(`${partialEntry}.open`);
    assert.ok(
      await evaluate(
        `${partialEntry}.scrollWidth<=${partialEntry}.clientWidth`,
      ),
    );
    await focus(
      `document.activeElement?.textContent.trim()==='Open backup history' && document.activeElement.closest('[data-slot=activity-entry]')===${partialEntry}`,
    );
    await capture("activity-details-dark-200");
    await focus(
      `document.activeElement===${partialEntry}.querySelector('summary')`,
    );
    await key("Return");
    contents.setZoomFactor(1);
    await evaluate("document.body.classList.remove('dark')");
    await focus(
      `document.activeElement===${firstEntry}.querySelector('summary')`,
    );
    await key("Return");
    await wait(`${firstEntry}.open`);
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
    await wait(
      "document.body.innerText.includes('Storage available') && document.body.innerText.includes('250 GB')",
    );
    const storageCard =
      "Array.from(document.querySelectorAll('[data-slot=card]')).find(card=>card.textContent.includes('Storage available'))";
    assert.ok(await evaluate(`!${storageCard}.textContent.includes('%')`));
    await capture("vault-storage-light");
    await evaluate("window.historyFixture.online(false)");
    await evaluate("window.historyFixture.overview('vault-b')");
    await wait("document.body.innerText.includes('Not reported')");
    assert.ok(await evaluate("!document.body.innerText.includes('250 GB')"));
    await evaluate("window.historyFixture.overview()");
    await wait("document.body.innerText.includes('250 GB')");
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'AVAILABLE', availableBytes:0})",
    );
    await wait(`${storageCard}.textContent.includes('0 B')`);
    await evaluate("window.historyFixture.storageSpace('vault-a', 'ERROR')");
    await wait(`${storageCard}.textContent.includes('Unavailable')`);
    assert.ok(await evaluate(`!${storageCard}.textContent.includes('0 B')`));
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'UNAVAILABLE'})",
    );
    await wait(`${storageCard}.textContent.includes('Unavailable')`);
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'AVAILABLE', availableBytes:125_000_000_000})",
    );
    await wait(`${storageCard}.textContent.includes('125 GB')`);
    await evaluate("window.historyFixture.online(true)");
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
    assert.ok(
      await evaluate(
        `${storageCard}.scrollWidth <= ${storageCard}.clientWidth`,
      ),
    );
    assert.ok(
      await evaluate(
        `${storageCard}.querySelector('p').scrollWidth <= ${storageCard}.querySelector('p').clientWidth`,
      ),
    );
    await evaluate(`${storageCard}.scrollIntoView({block:'center'})`);
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
      "History UI passed: cold-start comparison labels and both entry points, Home and vault without calendars, Activity navigation and vault filtering, compact backup/issue summaries with keyboard expansion and history links, no Activity in vault menu, keyboard day selection, comparison selection/filter/swap/browse/return, missing/cancel/large/insufficient states, Light/Dark and 200% zoom.",
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  }
});
