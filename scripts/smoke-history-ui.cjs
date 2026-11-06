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
    const overviewCards =
      "document.querySelector('section[aria-label=\"Global overview\"]')";
    await wait(`${overviewCards}?.innerText.includes('16 B')`);
    assert.equal(
      await evaluate(
        `${overviewCards}.querySelectorAll('[data-slot=card]').length`,
      ),
      4,
    );
    assert.ok(
      await evaluate(
        `${overviewCards}.querySelector('[data-slot=card]').title.includes('1 of 2 vaults available')`,
      ),
    );
    await wait("document.querySelector('meter') !== null");
    await capture("home-overview-light");
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
      "document.querySelector('[data-slot=activity-vault]')?.textContent.includes('6') && document.body.innerText.includes('History unavailable')",
    );
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('Numbers count retained backups')",
      ),
    );
    assert.ok(
      await evaluate(
        "!document.body.innerText.includes('retained snapshots · read')",
      ),
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-slot=activity-vault]').length",
      ),
      2,
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
    await wait(
      "document.querySelectorAll('[data-slot=activity-entry]').length === 0",
    );
    await select("Vault", 1);
    await wait(
      "document.querySelectorAll('[data-slot=activity-entry]').length === 7",
    );
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
    const quotaCard =
      "Array.from(document.querySelectorAll('[data-slot=card]')).find(card=>card.textContent.includes('Bucket quota remaining'))";
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'QUOTA', availableBytes:50_000_000_000})",
    );
    await wait(`${quotaCard}?.textContent.includes('50 GB')`);
    await capture("vault-quota-light");
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'QUOTA', availableBytes:0})",
    );
    await wait(`${quotaCard}.textContent.includes('0 B')`);
    await evaluate("window.historyFixture.storageSpace('vault-a', 'ERROR')");
    await wait(`${quotaCard}.textContent.includes('Unavailable')`);
    assert.ok(await evaluate(`!${quotaCard}.textContent.includes('0 B')`));
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'NO_QUOTA'})",
    );
    await wait(`${quotaCard}.textContent.includes('No bucket quota')`);
    await evaluate("document.body.classList.add('dark')");
    contents.setZoomFactor(2);
    await wait("innerWidth<768");
    assert.ok(
      await evaluate(`${quotaCard}.scrollWidth <= ${quotaCard}.clientWidth`),
    );
    await evaluate(`${quotaCard}.scrollIntoView({block:'center'})`);
    await capture("vault-quota-dark-200");
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'AVAILABLE', availableBytes:125_000_000_000})",
    );
    await wait(`${storageCard}?.textContent.includes('125 GB')`);
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
    contents.setZoomFactor(1);
    window.setContentSize(1440, 1000);
    await evaluate(
      "document.body.classList.remove('dark'); window.historyFixture.dashboard('stale')",
    );
    await wait(
      "document.querySelector('meter')?.value === 75 && document.body.innerText.includes('43 GB')",
    );
    assert.ok(
      await evaluate(
        `${overviewCards}.innerText.includes('20 GB') && ${overviewCards}.innerText.includes('600') && ${overviewCards}.innerText.includes('60')`,
      ),
    );
    await capture("home-75-light");
    await evaluate(
      "document.body.classList.add('dark'); window.historyFixture.dashboard('stale')",
    );
    await wait(
      "document.querySelector('meter')?.value === 75 && document.body.innerText.includes('43 GB')",
    );
    await capture("home-75-dark");
    contents.setZoomFactor(2);
    await frame();
    assert.ok(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    );
    assert.ok(
      await evaluate(
        `${overviewCards}.scrollWidth <= ${overviewCards}.clientWidth`,
      ),
    );
    await capture("home-75-dark-200");
    await evaluate("window.historyFixture.dashboard('fresh')");
    await wait("document.querySelector('meter')?.value === 100");
    await evaluate("window.historyFixture.dashboard('unavailable')");
    await wait(
      `${overviewCards}.innerText.includes('Unavailable') && document.body.innerText.includes('Status unavailable')`,
    );
    assert.ok(
      await evaluate(
        `!${overviewCards}.innerText.includes('43 GB') && !${overviewCards}.innerText.includes('0 B')`,
      ),
    );
    await evaluate("window.historyFixture.dashboard('empty')");
    await wait(
      "document.querySelector('meter')?.value === 0 && document.body.innerText.includes('No vaults yet')",
    );
    assert.ok(
      await evaluate(
        `${overviewCards}.innerText.includes('0 B') && !${overviewCards}.innerText.includes('Unavailable')`,
      ),
    );
    contents.setZoomFactor(1);
    await evaluate(
      "document.body.classList.remove('dark'); window.historyFixture.dashboard('cards')",
    );
    const vaultCard = (id) =>
      `document.querySelector('[data-slot=vault-card][data-vault-id="${id}"]')`;
    await wait(
      `${vaultCard("vault-a")}?.innerText.includes('750 GB used') && ${vaultCard("vault-d")}?.innerText.includes('Not backed up')`,
    );
    await wait(
      "document.querySelector('meter')?.value === 75 && document.body.innerText.includes('19 GB')",
    );
    assert.equal(
      await evaluate(
        "document.querySelectorAll('[data-slot=vault-card]').length",
      ),
      4,
    );
    assert.equal(
      await evaluate(`${vaultCard("vault-a")}.querySelector('meter').value`),
      75,
    );
    assert.equal(
      await evaluate(`${vaultCard("vault-b")}.querySelector('meter').value`),
      20,
    );
    assert.ok(
      await evaluate(
        `${vaultCard("vault-a")}.innerText.includes('1 folder') && ${vaultCard("vault-a")}.querySelector('time').dateTime.length > 0`,
      ),
    );
    assert.ok(
      await evaluate(
        `${vaultCard("vault-d")}.innerText.includes('0 folders') && ${vaultCard("vault-d")}.innerText.includes('0 B used') && !${vaultCard("vault-d")}.querySelector('meter')`,
      ),
    );
    assert.ok(
      await evaluate(
        `${vaultCard("vault-c")}.innerText.includes('Offline') && !${vaultCard("vault-c")}.querySelector('meter') && !${vaultCard("vault-c")}.innerText.includes('0 B')`,
      ),
    );
    await capture("home-vault-cards-light");
    await focus(
      "document.activeElement?.getAttribute('aria-label') === 'Change icon color for Folder'",
    );
    await key("Return");
    await wait(
      "document.querySelectorAll('[role=menuitemcheckbox]').length === 6",
    );
    await key("End");
    await key("Up");
    await key("Return");
    await key("Escape");
    await wait(`${vaultCard("vault-a")}.dataset.vaultColor === 'rose'`);
    assert.equal(
      await evaluate(
        "window.electron.store.get().preferences.vaultColors['vault-a']",
      ),
      "rose",
    );
    await focus(
      `document.activeElement?.closest('[data-vault-id="vault-a"]') && document.activeElement?.textContent.trim()==='Open vault'`,
    );
    await key("Return");
    await wait("window.historyFixture.location().pathname==='/local/vault-a'");
    await evaluate("window.historyFixture.home()");
    await wait(`${vaultCard("vault-a")}?.dataset.vaultColor === 'rose'`);
    await evaluate("document.body.classList.add('dark')");
    await capture("home-vault-cards-dark");
    contents.setZoomFactor(2);
    await frame();
    assert.ok(
      await evaluate(
        "document.documentElement.scrollWidth <= innerWidth && Array.from(document.querySelectorAll('[data-slot=vault-card]')).every(card=>card.scrollWidth<=card.clientWidth)",
      ),
    );
    await evaluate(`${vaultCard("vault-a")}.scrollIntoView({block:'start'})`);
    await capture("home-vault-cards-dark-200");
    await button("Reconnect");
    await wait(
      `${vaultCard("vault-c")}.innerText.includes('Up to date') && ${vaultCard("vault-c")}.innerText.includes('Capacity not reported')`,
    );
    assert.equal(
      await evaluate("window.historyFixture.reconnects().at(-1)"),
      "vault-c",
    );
    assert.ok(
      await evaluate(
        `${vaultCard("vault-c")}.innerText.includes('1 GB stored') && !${vaultCard("vault-c")}.querySelector('meter')`,
      ),
    );
    await evaluate(
      "window.historyFixture.storageSpace('vault-a', {status:'AVAILABLE', availableBytes:1000000000000, totalBytes:1000000000000, usedBytes:0})",
    );
    await wait(`${vaultCard("vault-a")}.querySelector('meter')?.value === 0`);
    assert.ok(
      await evaluate(`${vaultCard("vault-a")}.innerText.includes('0 B used')`),
    );
    await evaluate("window.historyFixture.storageSpace('vault-a', 'ERROR')");
    await wait(
      `${vaultCard("vault-a")}.innerText.includes('Storage unavailable') && !${vaultCard("vault-a")}.querySelector('meter')`,
    );
    console.info(
      "History UI passed: Home vault cards, capacity/unknown/zero/error states, keyboard color picker and saved preference, open/reconnect actions, global overview totals, setup scores, Activity cards and filters, comparison flows, Light/Dark and 200% zoom.",
    );
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error(error);
    clearTimeout(timeout);
    app.exit(1);
  }
});
