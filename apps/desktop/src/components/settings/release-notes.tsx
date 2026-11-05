import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function ReleaseNotes({ children }: { children: string }) {
  return (
    <div className="space-y-3 leading-relaxed [&_li>p]:my-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1 [&_input[type=checkbox]]:mr-2 [&_img]:max-w-full [&_img]:rounded-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h1: ({ children }) => (
            <h1 className="mt-5 text-xl font-semibold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 border-b border-border pb-2 text-lg font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 text-base font-semibold first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => <h4 className="font-semibold">{children}</h4>,
          h5: ({ children }) => <h5 className="font-semibold">{children}</h5>,
          h6: ({ children }) => <h6 className="font-semibold">{children}</h6>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-6">{children}</ul>
          ),
          ol: ({ children, start }) => (
            <ol start={start} className="list-decimal space-y-1 pl-6">
              {children}
            </ol>
          ),
          a: ({ children, href, title }) => (
            <a
              href={href}
              title={title}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:opacity-80"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="space-y-2 border-l-2 border-primary/40 pl-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
          hr: () => <hr className="border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children, style }) => (
            <th
              style={style}
              className="border-b border-border bg-muted px-3 py-2 font-semibold"
            >
              {children}
            </th>
          ),
          td: ({ children, style }) => (
            <td style={style} className="border-b border-border px-3 py-2">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
