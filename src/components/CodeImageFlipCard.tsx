import { useState } from "react";
import { motion } from "framer-motion";

interface CodeImageFlipCardProps {
  endpoint: string;
  code: string;
  image: string;
  imageAlt: string;
}

export function CodeImageFlipCard({ endpoint, code, image, imageAlt }: CodeImageFlipCardProps) {
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
        {/* Front - Code */}
        <div
          className="absolute inset-0 bg-card border rounded-2xl p-6 flex flex-col"
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-destructive"></div>
            <div className="w-3 h-3 rounded-full bg-accent"></div>
            <div className="w-3 h-3 rounded-full bg-secondary"></div>
            <span className="text-xs text-muted-foreground ml-2 font-mono">{endpoint}</span>
          </div>
          <pre className="text-xs md:text-sm text-muted-foreground font-mono overflow-auto whitespace-pre-wrap flex-1">
            {code}
          </pre>
          <div className="text-xs text-muted-foreground/60 text-center mt-3 font-medium">
            Hover to see preview →
          </div>
        </div>

        {/* Back - Image */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <img
            src={image}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent flex items-end p-6">
            <span className="text-primary-foreground text-sm font-semibold">{imageAlt}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
