const assert = require("node:assert/strict");
const { readFile, stat, writeFile } = require("node:fs/promises");
const { createServer } = require("node:http");
const { extname, isAbsolute, join, relative, resolve } = require("node:path");
const { app, BrowserWindow, nativeTheme, session } = require("electron");

const directory = process.env.DISKPOND_SITE_EVIDENCE;
const dist = process.env.DISKPOND_SITE_DIST;
assert(directory && dist, "Run through pnpm smoke:site");
// Keep capture frames advancing when another Windows window covers the fixture.
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.setPath("userData", join(directory, "profile"));
const timeout = setTimeout(() => {
  console.error("Website smoke exceeded 100 seconds");
  app.exit(1);
}, 100_000);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

// Serve only the built static output on loopback; no application data or APIs.
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    const path = resolve(dist, `.${pathname}`);
    const contained = relative(dist, path);
    if (contained.startsWith("..") || isAbsolute(contained)) {
      response.writeHead(400).end();
      return;
    }
    let file;
    for (const candidate of [path, `${path}.html`, join(path, "index.html")]) {
      if (
        await stat(candidate).then(
          (info) => info.isFile(),
          () => false,
        )
      ) {
        file = candidate;
        break;
      }
    }
    response.writeHead(file ? 200 : 404, {
      "Content-Type":
        mimeTypes[extname(file || "404.html")] || "application/octet-stream",
    });
    response.end(await readFile(file || join(dist, "404.html")));
  } catch (error) {
    console.error(error);
    response.writeHead(500).end();
  }
});

app.whenReady().then(async () => {
  try {
    await readFile(join(dist, "index.html"));
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const remoteRequests = [];
    session.defaultSession.webRequest.onBeforeRequest((request, callback) => {
      const remote =
        /^https?:/.test(request.url) && !request.url.startsWith(`${origin}/`);
      if (remote) remoteRequests.push(request.url);
      callback({ cancel: remote });
    });
    nativeTheme.themeSource = "light";
    const window = new BrowserWindow({
      width: 1440,
      height: 1050,
      webPreferences: { sandbox: true, backgroundThrottling: false },
    });
    const contents = window.webContents;
    const consoleErrors = [];
    contents.on("console-message", (details) => {
      if (details.level === "error") consoleErrors.push(details.message);
    });
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    const mailDrafts = [];
    contents.on("will-navigate", (event, url) => {
      if (url.startsWith("mailto:")) {
        event.preventDefault();
        mailDrafts.push(url);
      }
    });
    const evaluate = async (code) => {
      let deadline;
      try {
        return await Promise.race([
          contents.executeJavaScript(code),
          new Promise((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error(`Browser evaluation timed out: ${code}`)),
              10_000,
            );
          }),
        ]);
      } catch (error) {
        console.error(
          await contents.executeJavaScript(
            `({visibility: document.visibilityState, animations: document.getAnimations().map(animation => ({state: animation.playState, pending: animation.pending, target: animation.effect?.target?.outerHTML.slice(0, 200), timing: animation.effect?.getComputedTiming()}))})`,
          ),
        );
        throw error;
      } finally {
        clearTimeout(deadline);
      }
    };
    const paint = () =>
      evaluate(
        "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))).then(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))))",
      );
    const load = async (route) => {
      await window.loadURL(`${origin}${route}`);
      contents.setBackgroundThrottling(false);
      await evaluate("document.fonts.ready");
      await paint();
    };
    const key = async (keyCode) => {
      contents.sendInputEvent({ type: "keyDown", keyCode });
      if (keyCode === "Return")
        contents.sendInputEvent({ type: "char", keyCode: "\r" });
      contents.sendInputEvent({ type: "keyUp", keyCode });
      await paint();
    };
    const focus = (selector) =>
      evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
    const screenshot = async (name) => {
      await paint();
      await evaluate(`Promise.all(Array.from(document.images).filter(image => {
        const rect = image.getBoundingClientRect();
        return rect.width && rect.bottom > 0 && rect.top < innerHeight;
      }).map(image => image.decode()))`);
      await paint();
      await writeFile(
        join(directory, `${name}.png`),
        (await contents.capturePage()).toPNG(),
      );
    };
    const noOverflow = async (label) =>
      assert.equal(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        true,
        label,
      );
    const checkContrast = async (label) => {
      const failures = await evaluate(`(() => {
        const rgb = value => (value.match(/[\\d.]+/g) || []).map(Number);
        const luminance = color => color.slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const failures = [];
        for (const element of document.querySelectorAll('p, h1, h2, h3, a, label, summary, .badge')) {
          if (!element.getClientRects().length || !element.textContent.trim()) continue;
          const style = getComputedStyle(element);
          let parent = element;
          let background = [255, 255, 255];
          while (parent) {
            const candidate = rgb(getComputedStyle(parent).backgroundColor);
            if (candidate.length === 3 || candidate[3] === 1) { background = candidate; break; }
            parent = parent.parentElement;
          }
          const text = luminance(rgb(style.color));
          const surface = luminance(background);
          const ratio = (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05);
          const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700);
          if (ratio < (large ? 3 : 4.5)) failures.push({text: element.textContent.trim().slice(0, 70), ratio});
        }
        return failures;
      })()`);
      assert.deepEqual(failures, [], `${label} text contrast`);
    };
    const theme = async (value) => {
      await evaluate(
        `(() => { const select = document.querySelector('#site-theme'); select.value = ${JSON.stringify(value)}; select.dispatchEvent(new Event('change')); })()`,
      );
      await paint();
    };
    const checkScreenshots = async (mode) => {
      await theme(mode);
      for (const [index, name] of [
        "vault",
        "comparison",
        "activity",
        "policies",
        "browser",
        "restore",
        "local",
        "cloud",
        "remote",
      ].entries()) {
        if (index < 3) {
          await focus(`#gallery-tab-${index}`);
          await key("Return");
        }
        const selector = `[data-screenshot="${name}"]`;
        await focus(selector);
        const expected = await evaluate(`(() => {
          const images = Array.from(document.querySelectorAll('${selector} img'));
          const visible = images.filter(image => image.getClientRects().length);
          if (visible.length !== 1) throw new Error('Expected exactly one theme image');
          const image = visible[0];
          return {theme: image.dataset.screenshotTheme, src: new URL(image.dataset.fullSrc, location.href).href, alt: image.alt};
        })()`);
        assert.equal(expected.theme, mode, `${name} follows appearance`);
        await key("Return");
        assert.equal(
          await evaluate("document.querySelector('dialog').open"),
          true,
        );
        const expanded = await evaluate(`(async () => {
          const image = document.querySelector('.screenshot-dialog > img');
          await image.decode();
          return {src: image.src, alt: image.alt};
        })()`);
        assert.equal(
          expanded.src,
          expected.src,
          `${name} expands the visible theme at full resolution`,
        );
        assert.equal(expanded.alt, expected.alt);
        await key("Escape");
        assert.equal(
          await evaluate(`document.activeElement.matches('${selector}')`),
          true,
          `${name} restores keyboard focus`,
        );
      }
      for (const [selector, name] of [
        [".product-story", "policies-feature"],
        [".story-reverse", "restore-feature"],
        [".storage-grid", "connectivity"],
      ]) {
        await evaluate(
          `document.querySelector('${selector}').scrollIntoView({block:'center',behavior:'instant'})`,
        );
        await screenshot(`${name}-${mode}`);
      }
      await focus("#gallery-tab-0");
      await key("Return");
    };
    window.focus();
    contents.focus();

    console.info("Checking gallery, FAQs and themes");
    await load("/");
    await screenshot("home-light");
    await focus("#gallery-tab-0");
    await key("Right");
    assert.equal(
      await evaluate(
        "document.querySelector('#gallery-tab-1').getAttribute('aria-selected')",
      ),
      "true",
    );
    assert.equal(
      await evaluate("document.querySelector('#gallery-panel-0').hidden"),
      true,
    );
    await key("End");
    assert.equal(
      await evaluate("document.querySelector('#gallery-panel-2').hidden"),
      false,
    );
    await key("Home");
    await focus("[data-gallery-expand]");
    await key("Return");
    assert.equal(await evaluate("document.querySelector('dialog').open"), true);
    await key("Escape");
    assert.equal(
      await evaluate("document.querySelector('dialog').open"),
      false,
    );
    assert.equal(
      await evaluate(
        "document.activeElement.hasAttribute('data-gallery-expand')",
      ),
      true,
    );
    await focus(".faq-item summary");
    await key("Return");
    assert.equal(
      await evaluate("document.querySelector('.faq-item').open"),
      true,
    );
    await key("Return");
    assert.equal(
      await evaluate("document.querySelector('.faq-item').open"),
      false,
    );
    await theme("dark");
    await evaluate("scrollTo({top:0, behavior:'instant'})");
    await screenshot("home-dark");
    console.info("Checking persisted and system appearance");
    await load("/");
    assert.equal(
      await evaluate("document.documentElement.classList.contains('dark')"),
      true,
    );
    await theme("system");
    nativeTheme.themeSource = "dark";
    await paint();
    assert.equal(
      await evaluate("document.documentElement.classList.contains('dark')"),
      true,
    );
    nativeTheme.themeSource = "light";
    await paint();
    assert.equal(
      await evaluate("document.documentElement.classList.contains('dark')"),
      false,
    );
    console.info("Checking all nine screenshot views in both themes");
    await checkScreenshots("light");
    await checkScreenshots("dark");
    // A system-theme change also updates an already-open screenshot dialog.
    await theme("system");
    await focus("[data-gallery-expand]");
    await key("Return");
    nativeTheme.themeSource = "dark";
    await paint();
    assert.equal(
      await evaluate(
        "document.querySelector('.screenshot-dialog > img').src === new URL(document.querySelector('[data-screenshot=vault] [data-screenshot-theme=dark]').dataset.fullSrc, location.href).href",
      ),
      true,
    );
    await key("Escape");
    nativeTheme.themeSource = "light";

    console.info("Checking pricing and email enquiries");
    await load("/pricing");
    await focus("input[value=monthly]");
    await key("Right");
    assert.equal(
      await evaluate("document.querySelector('input[value=yearly]').checked"),
      true,
    );
    assert.match(
      await evaluate(
        "document.querySelector('[data-price-period=yearly]').innerText",
      ),
      /€3\.75[\s\S]*€45/,
    );
    const annualLink = new URL(
      await evaluate(
        "document.querySelector('[data-enquiry-period=yearly]').href",
      ),
    );
    assert.equal(annualLink.pathname, "sales@diskpond.com");
    assert.match(annualLink.searchParams.get("body"), /€45 Yearly/);
    await evaluate(
      "document.querySelector('.billing-toggle').scrollIntoView({block:'start',behavior:'instant'})",
    );
    await screenshot("pricing-yearly-light");
    await key("Left");
    assert.equal(
      await evaluate(
        "document.querySelector('[data-price-period=yearly]').hidden",
      ),
      true,
    );
    assert.match(
      await evaluate(
        "document.querySelector('[data-price-period=monthly]').innerText",
      ),
      /€5/,
    );

    await load("/contact");
    await focus("#contact-form button");
    await key("Return");
    assert.equal(mailDrafts.length, 0);
    assert.equal(await evaluate("document.activeElement.id"), "contact-name");
    await evaluate(`(() => {
      document.querySelector('#contact-name').value = 'Test & Example';
      document.querySelector('#contact-email').value = 'fixture@example.com';
      document.querySelector('#contact-topic').value = '1';
      document.querySelector('#contact-message').value = '500 GB & recovery? €5 / month';
    })()`);
    await focus("#contact-form button");
    await key("Return");
    assert.equal(mailDrafts.length, 1);
    let draft = new URL(mailDrafts[0]);
    assert.equal(draft.pathname, "sales@diskpond.com");
    assert.match(draft.searchParams.get("subject"), /Enterprise/);
    assert.match(
      draft.searchParams.get("body"),
      /500 GB & recovery\? €5 \/ month/,
    );
    await evaluate("document.querySelector('#contact-topic').value = '2'");
    await key("Return");
    draft = new URL(mailDrafts[1]);
    assert.equal(draft.pathname, "support@diskpond.com");
    assert.equal(
      await evaluate("document.querySelector('#contact-message').value"),
      "500 GB & recovery? €5 / month",
    );

    console.info("Checking routes, contrast and responsive layouts");
    const routes = [
      "/",
      "/cloud",
      "/pricing",
      "/download",
      "/guides",
      "/guides/first-backup",
      "/guides/restore-files",
      "/guides/sync-vs-backup",
      "/contact",
      "/privacy",
      "/terms",
      "/404",
    ];
    const localLinks = new Set();
    for (const route of routes) {
      await load(route);
      assert.equal(
        await evaluate("document.querySelectorAll('h1').length"),
        1,
        route,
      );
      await noOverflow(`${route} desktop`);
      const links = await evaluate(
        `Array.from(document.querySelectorAll('a[href], img[src], link[rel=stylesheet], script[src]')).flatMap(node => [node.href || node.src, ...(node.srcset || '').split(',').map(candidate => candidate.trim().split(/\\s+/)[0]).filter(Boolean).map(path => new URL(path, location.href).href)]).filter(url => url && url.startsWith(location.origin))`,
      );
      for (const link of links) localLinks.add(link);
      for (const mode of ["light", "dark"]) {
        await theme(mode);
        await checkContrast(`${route} ${mode}`);
        contents.setZoomFactor(2);
        await paint();
        await noOverflow(`${route} ${mode} 200%`);
      }
      contents.setZoomFactor(1);
      await theme("light");
      window.setContentSize(390, 844);
      await paint();
      await noOverflow(`${route} mobile`);
      if (["/", "/cloud", "/pricing", "/contact"].includes(route)) {
        await screenshot(`${route === "/" ? "home" : route.slice(1)}-mobile`);
      }
      if (route === "/") {
        await evaluate(
          "document.querySelector('.story-reverse').scrollIntoView({block:'start',behavior:'instant'})",
        );
        await screenshot("restore-feature-mobile");
        await evaluate(
          "document.querySelector('.storage-grid').scrollIntoView({block:'start',behavior:'instant'})",
        );
        await screenshot("connectivity-mobile");
        await focus(".mobile-menu summary");
        await key("Return");
        assert.equal(
          await evaluate("document.querySelector('.mobile-menu').open"),
          true,
        );
        await key("Escape");
        assert.equal(
          await evaluate("document.querySelector('.mobile-menu').open"),
          false,
        );
      }
      window.setContentSize(320, 740);
      await paint();
      await noOverflow(`${route} narrow mobile`);
      window.setContentSize(1440, 1000);
      await paint();
    }
    for (const link of localLinks) {
      const url = new URL(link);
      const response = await fetch(url);
      assert.equal(response.status, 200, link);
      if (url.hash) {
        const html = await response.text();
        assert(
          html.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),
          link,
        );
      }
    }
    assert.equal((await fetch(`${origin}/not-a-real-page`)).status, 404);
    assert.equal(
      (await fetch(`${origin}/social.png`)).headers.get("content-type"),
      "image/png",
    );
    assert.match(
      await (await fetch(`${origin}/sitemap-index.xml`)).text(),
      /https:\/\/diskpond\.com/,
    );
    assert.equal(remoteRequests.length, 0, JSON.stringify(remoteRequests));
    assert.deepEqual(consoleErrors, []);

    // Progressive enhancement: check a real native FAQ with JavaScript disabled.
    console.info("Checking JavaScript-disabled native controls");
    const plain = new BrowserWindow({
      show: false,
      webPreferences: {
        javascript: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    await plain.loadURL(`${origin}/pricing`);
    plain.show();
    plain.focus();
    plain.webContents.focus();
    plain.webContents.debugger.attach("1.3");
    const { root: documentNode } =
      await plain.webContents.debugger.sendCommand("DOM.getDocument");
    const plainNode = async (selector) => {
      const { nodeId } = await plain.webContents.debugger.sendCommand(
        "DOM.querySelector",
        { nodeId: documentNode.nodeId, selector },
      );
      return nodeId;
    };
    const plainAttributes = async (selector) => {
      const { attributes } = await plain.webContents.debugger.sendCommand(
        "DOM.getAttributes",
        { nodeId: await plainNode(selector) },
      );
      return Object.fromEntries(
        Array.from({ length: attributes.length / 2 }, (_, index) => [
          attributes[index * 2],
          attributes[index * 2 + 1],
        ]),
      );
    };
    await plain.webContents.debugger.sendCommand("DOM.focus", {
      nodeId: await plainNode(".faq-item summary"),
    });
    plain.webContents.sendInputEvent({ type: "keyDown", keyCode: "Return" });
    plain.webContents.sendInputEvent({ type: "char", keyCode: "\r" });
    plain.webContents.sendInputEvent({ type: "keyUp", keyCode: "Return" });
    assert("open" in (await plainAttributes(".faq-item")));
    assert("hidden" in (await plainAttributes("[data-billing-toggle]")));
    assert.match(
      (await plainAttributes("[data-enquiry-period=monthly]")).href,
      /^mailto:sales@diskpond\.com/,
    );
    plain.webContents.debugger.detach();
    plain.close();

    // A privacy-restricted browser must still render and change appearance.
    console.info("Checking blocked browser storage");
    window.focus();
    contents.focus();
    contents.debugger.attach("1.3");
    const { identifier } = await contents.debugger.sendCommand(
      "Page.addScriptToEvaluateOnNewDocument",
      {
        source:
          "Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('Blocked', 'SecurityError'); }});",
      },
    );
    await load("/");
    await theme("dark");
    assert.equal(
      await evaluate("document.documentElement.classList.contains('dark')"),
      true,
    );
    await contents.debugger.sendCommand(
      "Page.removeScriptToEvaluateOnNewDocument",
      { identifier },
    );
    contents.debugger.detach();
    const result = {
      passed: true,
      routes: routes.length,
      checkedLinks: localLinks.size,
      externalRequests: remoteRequests,
      checks: [
        "gallery keyboard/dialog/focus",
        "nine screenshot views: matching light/dark, full-resolution expansion and focus return",
        "open screenshot follows live system appearance",
        "FAQ keyboard",
        "theme persistence/system changes",
        "annual pricing and enquiry amount",
        "contact validation/email encoding/routing",
        "mobile menu/Escape",
        "desktop/mobile/light/dark/200% reflow",
        "320px reflow and WCAG text contrast",
        "internal links/assets/anchors",
        "404/sitemap/social image",
        "no automatic remote requests",
        "native FAQ/enquiry without JavaScript",
        "blocked localStorage fallback",
      ],
    };
    await writeFile(
      join(directory, "result.json"),
      JSON.stringify(result, null, 2),
    );
    console.info(`PASS: ${JSON.stringify(result)}`);
    clearTimeout(timeout);
    server.close();
    app.exit(0);
  } catch (error) {
    console.error(error);
    server.close();
    app.exit(1);
  }
});
