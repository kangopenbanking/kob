/**
 * KYB / KYC Requirements Checklist.
 *
 * Renders an explicit list of required documents with per-row readability checks.
 * Parent passes uploaded File objects (or storage paths) and the component reports:
 *   - which docs are missing
 *   - which uploaded files are unreadable (zero size, wrong MIME, oversize)
 *
 * Use `getBlockingReasons(state)` to know whether to disable the submit button.
 *
 * Shared between MerchantKYB, BizRegister, and institution Register flows so the
 * documents[] payload built later by `buildDocumentsPayload` cannot be empty or
 * malformed at submit time.
 */
import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export type KybRequirement = {
  key: string;
  label: string;
  description?: string;
  /** Comma-separated list of accepted MIME types, e.g. "application/pdf,image/png" */
  accept: string;
  required: boolean;
  /** Max file size in bytes; default 10 MB */
  maxBytes?: number;
};

export type KybFileLike =
  | { kind: "file"; file: File }
  | { kind: "stored"; path: string; mime?: string; sizeBytes?: number }
  | null;

export type KybChecklistState = Record<string, KybFileLike>;

type RowStatus =
  | { kind: "missing" }
  | { kind: "ok"; mime: string; sizeBytes: number }
  | { kind: "invalid"; reason: string };

const DEFAULT_MAX = 10 * 1024 * 1024;

function rowStatus(req: KybRequirement, value: KybFileLike): RowStatus {
  if (!value) return req.required ? { kind: "missing" } : { kind: "ok", mime: "—", sizeBytes: 0 };
  const max = req.maxBytes ?? DEFAULT_MAX;
  const accepted = req.accept.split(",").map((s) => s.trim()).filter(Boolean);

  if (value.kind === "file") {
    if (!value.file.size) return { kind: "invalid", reason: "File is empty or unreadable. Re-upload it." };
    if (value.file.size > max) return { kind: "invalid", reason: `File exceeds ${(max / 1024 / 1024).toFixed(0)} MB limit.` };
    if (accepted.length && !accepted.some((a) => value.file.type === a || a === "*/*")) {
      return { kind: "invalid", reason: `Unsupported file type ${value.file.type || "unknown"}. Allowed: ${accepted.join(", ")}.` };
    }
    return { kind: "ok", mime: value.file.type || "application/octet-stream", sizeBytes: value.file.size };
  }
  // stored
  if (!value.sizeBytes) return { kind: "invalid", reason: "Stored file metadata unreadable. Re-upload it." };
  if (value.sizeBytes > max) return { kind: "invalid", reason: `File exceeds ${(max / 1024 / 1024).toFixed(0)} MB limit.` };
  return { kind: "ok", mime: value.mime ?? "application/octet-stream", sizeBytes: value.sizeBytes };
}

export function getBlockingReasons(
  requirements: KybRequirement[],
  state: KybChecklistState,
): string[] {
  const out: string[] = [];
  for (const req of requirements) {
    const s = rowStatus(req, state[req.key] ?? null);
    if (s.kind === "missing") out.push(`${req.label} is required.`);
    else if (s.kind === "invalid") out.push(`${req.label}: ${s.reason}`);
  }
  return out;
}

export function isChecklistComplete(
  requirements: KybRequirement[],
  state: KybChecklistState,
): boolean {
  return getBlockingReasons(requirements, state).length === 0;
}

export interface KybRequirementsChecklistProps {
  requirements: KybRequirement[];
  state: KybChecklistState;
  onChange: (key: string, value: KybFileLike) => void;
  className?: string;
  /** Hide the blocking-reasons summary block. */
  hideSummary?: boolean;
}

export function KybRequirementsChecklist({
  requirements,
  state,
  onChange,
  className,
  hideSummary,
}: KybRequirementsChecklistProps) {
  const reasons = useMemo(() => getBlockingReasons(requirements, state), [requirements, state]);

  return (
    <div className={cn("space-y-3", className)}>
      <ul className="space-y-2" role="list" aria-label="KYB document requirements">
        {requirements.map((req) => {
          const value = state[req.key] ?? null;
          const status = rowStatus(req, value);
          const Icon = status.kind === "ok" && value
            ? CheckCircle2
            : status.kind === "invalid"
            ? AlertTriangle
            : Circle;
          const iconClass =
            status.kind === "ok" && value
              ? "text-emerald-600"
              : status.kind === "invalid"
              ? "text-amber-600"
              : req.required
              ? "text-muted-foreground"
              : "text-muted-foreground/60";

          return (
            <li
              key={req.key}
              className="flex items-start gap-3 rounded-md border border-border/60 bg-card p-3"
              data-testid={`kyb-req-${req.key}`}
              data-status={status.kind}
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconClass)} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`kyb-file-${req.key}`}
                    className="text-sm font-medium text-foreground"
                  >
                    {req.label}
                    {req.required && <span className="ml-1 text-destructive">*</span>}
                  </label>
                  {status.kind === "ok" && value && (
                    <span className="text-xs text-muted-foreground">
                      {status.mime} · {(status.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
                {req.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{req.description}</p>
                )}
                <input
                  id={`kyb-file-${req.key}`}
                  type="file"
                  accept={req.accept}
                  className="mt-2 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-secondary-foreground hover:file:bg-secondary/80"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    onChange(req.key, f ? { kind: "file", file: f } : null);
                  }}
                />
                {status.kind === "invalid" && (
                  <p className="mt-1 text-xs text-amber-700" role="alert">
                    {status.reason}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!hideSummary && reasons.length > 0 && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
          aria-live="polite"
        >
          <p className="font-medium">Submission blocked:</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
