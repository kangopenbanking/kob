// Rich markdown renderer for Kang Agent assistant messages.
// Renders GFM markdown (bold, headings, lists, code, tables) and shows a
// favicon next to external links — ChatGPT-style.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";

function faviconFor(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return null;
  }
}

export function KangMarkdown({ content }: { content: string }) {
  return (
    <div className="kang-md text-[13px] leading-[1.55] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...p }) => <h1 className="text-[15px] font-semibold mt-2 mb-1" {...p} />,
          h2: ({ node, ...p }) => <h2 className="text-[14px] font-semibold mt-2 mb-1" {...p} />,
          h3: ({ node, ...p }) => <h3 className="text-[13px] font-semibold mt-2 mb-1" {...p} />,
          p: ({ node, ...p }) => <p className="my-1.5" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-semibold text-foreground" {...p} />,
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          ul: ({ node, ...p }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...p} />,
          li: ({ node, ...p }) => <li className="marker:text-muted-foreground" {...p} />,
          hr: () => <hr className="my-3 border-border/60" />,
          blockquote: ({ node, ...p }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground" {...p} />
          ),
          code: ({ node, className, children, ...p }: any) => {
            const inline = !className;
            if (inline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 text-[12px] font-mono" {...p}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="my-2 overflow-x-auto rounded-lg bg-muted p-3 text-[12px] font-mono">
                <code {...p}>{children}</code>
              </pre>
            );
          },
          table: ({ node, ...p }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-[12px] border-collapse" {...p} />
            </div>
          ),
          th: ({ node, ...p }) => <th className="border border-border/60 px-2 py-1 text-left font-semibold bg-muted/50" {...p} />,
          td: ({ node, ...p }) => <td className="border border-border/60 px-2 py-1 align-top" {...p} />,
          a: ({ node, href, children, ...p }) => {
            const url = href ?? "";
            const favicon = faviconFor(url);
            const isExternal = /^https?:/.test(url);
            return (
              <a
                href={url}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="inline-flex items-center gap-1 text-primary font-medium underline-offset-2 hover:underline break-all"
                {...p}
              >
                {favicon && (
                  <img
                    src={favicon}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="h-3.5 w-3.5 rounded-sm shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <span>{children}</span>
                {isExternal && !favicon && <ExternalLink className="h-3 w-3 shrink-0" />}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
