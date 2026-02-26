import React from "react";

/**
 * Renders a JSON string with syntax highlighting for keys, strings, numbers, booleans, and null.
 */
export function JsonSyntax({ code }: { code: string }) {
  // Try to detect if it's valid JSON-like content
  const lines = code.split("\n");

  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {highlightLine(line)}
          {i < lines.length - 1 ? "\n" : ""}
        </React.Fragment>
      ))}
    </>
  );
}

function highlightLine(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex to match JSON tokens: keys, strings, numbers, booleans, null
  const tokenRegex = /("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    // Add any text before this match as plain
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Key: "key":
      parts.push(
        <span key={`k${match.index}`} className="text-[#7ee787]">{match[1]}</span>
      );
      parts.push(match[2]); // the colon
    } else if (match[3]) {
      // String value
      parts.push(
        <span key={`s${match.index}`} className="text-[#a5d6ff]">{match[3]}</span>
      );
    } else if (match[4]) {
      // Boolean
      parts.push(
        <span key={`b${match.index}`} className="text-[#ff7b72]">{match[4]}</span>
      );
    } else if (match[5]) {
      // Null
      parts.push(
        <span key={`n${match.index}`} className="text-[#ff7b72]">{match[5]}</span>
      );
    } else if (match[6]) {
      // Number
      parts.push(
        <span key={`d${match.index}`} className="text-[#d2a8ff]">{match[6]}</span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}
