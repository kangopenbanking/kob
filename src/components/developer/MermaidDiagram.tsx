import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import DOMPurify from "dompurify";

mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  themeVariables: {
    primaryColor: "#e8f0fe",
    primaryTextColor: "#1a365d",
    primaryBorderColor: "#1a56db",
    lineColor: "#64748b",
    secondaryColor: "#f0fdf4",
    tertiaryColor: "#fefce8",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
    fontSize: "14px",
    noteBkgColor: "#fffbeb",
    noteBorderColor: "#f59e0b",
    actorBkg: "#1a56db",
    actorTextColor: "#ffffff",
    actorBorder: "#1e40af",
    signalColor: "#334155",
    signalTextColor: "#1e293b",
    sequenceNumberColor: "#ffffff",
  },
  sequence: {
    actorMargin: 80,
    diagramMarginX: 30,
    diagramMarginY: 20,
    noteMargin: 10,
    messageMargin: 40,
    mirrorActors: false,
    useMaxWidth: true,
  },
});

let mermaidCounter = 0;

export function MermaidDiagram({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = `mermaid-${++mermaidCounter}`;
    const render = async () => {
      try {
        const { svg: rendered } = await mermaid.render(id, chart.trim());
        setSvg(DOMPurify.sanitize(rendered, {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_TAGS: ['foreignObject', 'div', 'span', 'br', 'p', 'style'],
          ADD_ATTR: ['xmlns', 'requiredFeatures', 'class', 'style', 'x', 'y', 'width', 'height', 'transform', 'dominant-baseline', 'text-anchor', 'font-size', 'font-weight', 'font-family', 'fill', 'stroke', 'marker-end', 'refX', 'refY', 'orient', 'markerWidth', 'markerHeight', 'viewBox', 'cx', 'cy', 'r', 'rx', 'ry', 'dx', 'dy', 'd', 'points'],
        }));
        setError(null);
      } catch (e) {
        setError("Failed to render diagram");
        // Clean up any orphaned elements mermaid may have created
        const el = document.getElementById(id);
        el?.remove();
      }
    };
    render();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-6 p-6 bg-white border border-border/60 rounded-xl overflow-x-auto shadow-sm [&_svg]:bg-white"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
