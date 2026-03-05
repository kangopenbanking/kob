import { useState } from "react";
import { motion } from "framer-motion";

interface CodeImageFlipCardProps {
  endpoint: string;
  code: string;
  image?: string;
  imageAlt: string;
  previewContent?: React.ReactNode;
}

export function CodeImageFlipCard({ endpoint, code, imageAlt, previewContent }: CodeImageFlipCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative rounded-2xl shadow-lg overflow-hidden aspect-[4/3] cursor-pointer"
      style={{ perspective: "1200px" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isHovered ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Front - Code (Dark theme) */}
        <div
          className="absolute inset-0 bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,20%)] rounded-2xl p-6 flex flex-col"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-[hsl(0,80%,60%)]"></div>
            <div className="w-3 h-3 rounded-full bg-[hsl(45,90%,55%)]"></div>
            <div className="w-3 h-3 rounded-full bg-[hsl(130,60%,50%)]"></div>
            <span className="text-xs text-[hsl(220,10%,55%)] ml-2 font-mono">{endpoint}</span>
          </div>
          <pre className="text-xs md:text-sm text-[hsl(220,10%,70%)] font-mono overflow-auto whitespace-pre-wrap flex-1 leading-relaxed">
            <CodeHighlight code={code} />
          </pre>
          <div className="text-xs text-[hsl(220,10%,40%)] text-center mt-3 font-medium">
            Hover to see preview →
          </div>
        </div>

        {/* Back - Animated Preview */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden bg-[hsl(210,30%,97%)] border border-[hsl(210,20%,90%)]"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          {previewContent}
        </div>
      </motion.div>
    </div>
  );
}

// Simple syntax highlighting for JSON
function CodeHighlight({ code }: { code: string }) {
  const highlighted = code.split('\n').map((line, i) => {
    const parts = line
      .replace(/"([^"]+)":/g, '<key>"$1"</key>:')
      .replace(/: "([^"]+)"/g, ': <str>"$1"</str>')
      .replace(/: (\d+\.?\d*)/g, ': <num>$1</num>')
      .replace(/: (true|false)/g, ': <bool>$1</bool>');
    
    return (
      <span key={i}>
        {parts.split(/(<key>.*?<\/key>|<str>.*?<\/str>|<num>.*?<\/num>|<bool>.*?<\/bool>)/).map((part, j) => {
          if (part.startsWith('<key>')) return <span key={j} className="text-[hsl(200,80%,70%)]">{part.replace(/<\/?key>/g, '')}</span>;
          if (part.startsWith('<str>')) return <span key={j} className="text-[hsl(130,60%,65%)]">{part.replace(/<\/?str>/g, '')}</span>;
          if (part.startsWith('<num>')) return <span key={j} className="text-[hsl(30,90%,65%)]">{part.replace(/<\/?num>/g, '')}</span>;
          if (part.startsWith('<bool>')) return <span key={j} className="text-[hsl(280,60%,70%)]">{part.replace(/<\/?bool>/g, '')}</span>;
          return <span key={j}>{part}</span>;
        })}
        {'\n'}
      </span>
    );
  });
  return <>{highlighted}</>;
}
