import { ReleaseNotes } from "@desktop/components/settings/release-notes";
import { renderToStaticMarkup } from "react-dom/server";

it("renders release Markdown as headings, nested lists, code, links and GFM tables", () => {
  const html = renderToStaticMarkup(
    <ReleaseNotes>{`## Improvements

- **Faster** backups
  - Preserves files

3. Restart the app

Use \`diskpond\`.

~~~sh
diskpond --version
~~~

> Existing backups remain compatible.

[Full changelog](https://github.com/hoxsec/DiskPond/releases)

| Feature | Status |
| --- | --- |
| Restore | ~~Pending~~ Ready |

- [x] Verified
`}</ReleaseNotes>,
  );
  expect(html).toMatch(/<h2[^>]*>Improvements<\/h2>/);
  expect(html).toContain("<strong>Faster</strong>");
  expect(html.match(/<ul\b/g)).toHaveLength(3);
  expect(html).toContain('start="3"');
  expect(html).toMatch(
    /<pre[^>]*><code[^>]*>diskpond --version\n<\/code><\/pre>/,
  );
  expect(html).toMatch(/<blockquote\b/);
  expect(html).toContain('href="https://github.com/hoxsec/DiskPond/releases"');
  expect(html).toContain('target="_blank"');
  expect(html).toMatch(/<table\b/);
  expect(html).toContain("<del>Pending</del>");
  expect(html).toContain('type="checkbox"');
});

it("does not execute HTML or unsafe links in release notes", () => {
  const html = renderToStaticMarkup(
    <ReleaseNotes>{`<script>alert(1)</script>

[unsafe](javascript:alert%281%29)

~~~html
<script>example</script>
~~~`}</ReleaseNotes>,
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("javascript:");
  expect(html).toContain("&lt;script&gt;example&lt;/script&gt;");
});
