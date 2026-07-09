// Rich markdown renderer for Kang Agent messages.
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


export function KangMarkdown({
  content,
  variant = "default",
}: {
  content: string;
  variant?: "default" | "onPrimary";
}) {
  const onPrimary = variant === "onPrimary";
  const linkColor = onPrimary
    ? "text-primary-foreground underline decoration-primary-foreground/60 hover:decoration-primary-foreground"
    : "text-primary hover:underline";
  const codeBg = onPrimary ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted";
  const preBg = onPrimary ? "bg-primary-foreground/10 text-primary-foreground" : "bg-muted";
  const quoteBorder = onPrimary ? "border-primary-foreground/40 text-primary-foreground/85" : "border-primary/40 text-muted-foreground";

  return (
    <div className="kang-md break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          h1: ({ node, ...p }) => <h1 className="text-[15px] font-semibold mt-2 mb-1" {...p} />,
          h2: ({ node, ...p }) => <h2 className="text-[14px] font-semibold mt-2 mb-1" {...p} />,
          h3: ({ node, ...p }) => <h3 className="text-[13px] font-semibold mt-2 mb-1" {...p} />,
          p: ({ node, ...p }) => <p className="my-1.5" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-semibold" {...p} />,
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          ul: ({ node, ...p }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5" {...p} />,
          li: ({ node, ...p }) => <li {...p} />,
          hr: () => <hr className="my-3 border-current/30 opacity-30" />,
          blockquote: ({ node, ...p }) => (
            <blockquote className={`border-l-2 pl-3 my-2 ${quoteBorder}`} {...p} />
          ),
          code: ({ node, className, children, ...p }: any) => {
            const inline = !className;
            if (inline) {
              return (
                <code className={`rounded px-1 py-0.5 text-[12px] font-mono ${codeBg}`} {...p}>
                  {children}
                </code>
              );
            }
            return (
              <pre className={`my-2 overflow-x-auto rounded-lg p-3 text-[12px] font-mono ${preBg}`}>
                <code {...p}>{children}</code>
              </pre>
            );
          },
          table: ({ node, ...p }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full text-[12px] border-collapse" {...p} />
            </div>
          ),
          th: ({ node, ...p }) => <th className="border border-current/20 px-2 py-1 text-left font-semibold" {...p} />,
          td: ({ node, ...p }) => <td className="border border-current/20 px-2 py-1 align-top" {...p} />,
          a: ({ node, href, children, ...p }) => {
            const url = href ?? "";
            const favicon = faviconFor(url);
            const isExternal = /^https?:/.test(url);
            return (
              <a
                href={url}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={`inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline break-all ${linkColor}`}
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
