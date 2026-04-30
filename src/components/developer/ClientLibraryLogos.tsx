/**
 * Brand SVG logos for client libraries shown in the API Explorer code generator.
 * All logos render inline (no network requests) and inherit sizing from `size` prop.
 * Outline / monochrome variants are used to match the "Professional Natural" look.
 */
import type { SVGProps } from "react";

type LogoProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
});

export function CurlLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        d="M4 5h12a4 4 0 0 1 0 8H8a4 4 0 0 0 0 8h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NodeLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        d="M12 2 3.5 7v10L12 22l8.5-5V7L12 2Z"
        fill="none"
        stroke="#3C873A"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.5v6.7c0 .9-.6 1.4-1.5 1.4-.6 0-1.1-.2-1.5-.6M14.5 14.5c0 1.1.9 1.7 2.2 1.7 1.3 0 2.1-.5 2.1-1.4 0-1-.9-1.2-2.2-1.4-1.3-.2-2.1-.5-2.1-1.5s.8-1.5 2-1.5c1.1 0 1.9.4 2.1 1.4"
        fill="none"
        stroke="#3C873A"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PythonLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        d="M12 2c-3 0-4 1.2-4 3v2h4.5v.5H6c-2 0-3 1.4-3 4s1 4 3 4h2v-2c0-2 1.5-3.5 3.5-3.5h4c1.7 0 3-1.3 3-3V5c0-1.8-1-3-4-3h-2.5Zm-2 2.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6Z"
        fill="#306998"
      />
      <path
        d="M12 22c3 0 4-1.2 4-3v-2h-4.5v-.5H18c2 0 3-1.4 3-4s-1-4-3-4h-2v2c0 2-1.5 3.5-3.5 3.5h-4c-1.7 0-3 1.3-3 3V19c0 1.8 1 3 4 3h2.5Zm2-2.2a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Z"
        fill="#FFD43B"
      />
    </svg>
  );
}

export function PhpLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <ellipse cx="12" cy="12" rx="10" ry="5.5" fill="none" stroke="#777BB4" strokeWidth="1.4" />
      <text
        x="12"
        y="14.4"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="700"
        fontSize="5.2"
        fill="#777BB4"
      >
        php
      </text>
    </svg>
  );
}

export function RubyLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        d="M5 8.5 12 3l7 5.5L15.5 21h-7L5 8.5Z"
        fill="#CC342D"
        stroke="#9B1C17"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path d="M5 8.5h14M12 3v18" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.6" />
    </svg>
  );
}

export function JavaLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <path
        d="M9 3c0 2 3 3 3 5s-2 2-2 4M14 3c0 2 2 2 2 4s-3 3-3 5"
        fill="none"
        stroke="#E76F00"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6 15c2 1 10 1 12 0M5 18c3 1.5 11 1.5 14 0M7 21c2 .8 8 .8 10 0"
        fill="none"
        stroke="#5382A1"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GoLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="800"
        fontStyle="italic"
        fontSize="9"
        fill="#00ADD8"
      >
        Go
      </text>
      <path d="M2 11h4M2 13.5h3" stroke="#00ADD8" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DotNetLogo({ size = 18, ...rest }: LogoProps) {
  return (
    <svg {...base(size)} {...rest}>
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontWeight="800"
        fontSize="8.5"
        fill="#512BD4"
      >
        .NET
      </text>
    </svg>
  );
}

export type ClientLanguageId =
  | "curl"
  | "node"
  | "python"
  | "php"
  | "ruby"
  | "java"
  | "go"
  | "dotnet";

export const CLIENT_LIBRARIES: Array<{
  id: ClientLanguageId;
  label: string;
  Logo: (props: LogoProps) => JSX.Element;
}> = [
  { id: "curl", label: "cURL", Logo: CurlLogo },
  { id: "node", label: "Node.js", Logo: NodeLogo },
  { id: "python", label: "Python", Logo: PythonLogo },
  { id: "php", label: "PHP", Logo: PhpLogo },
  { id: "ruby", label: "Ruby", Logo: RubyLogo },
  { id: "java", label: "Java", Logo: JavaLogo },
  { id: "go", label: "Go", Logo: GoLogo },
  { id: "dotnet", label: ".NET", Logo: DotNetLogo },
];
