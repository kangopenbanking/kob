import { describe, it, expect } from "vitest";
import {
  getBlockingReasons,
  isChecklistComplete,
  type KybRequirement,
  type KybChecklistState,
} from "@/components/kyb/KybRequirementsChecklist";

const REQS: KybRequirement[] = [
  { key: "registration", label: "Business registration", accept: "application/pdf", required: true },
  { key: "owner_id", label: "Owner ID", accept: "image/png,image/jpeg,application/pdf", required: true },
  { key: "address_proof", label: "Proof of address", accept: "application/pdf", required: false },
];

function mkFile(name: string, type: string, size: number): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("KybRequirementsChecklist logic", () => {
  it("flags all required as missing when state is empty", () => {
    const reasons = getBlockingReasons(REQS, {});
    expect(reasons).toHaveLength(2);
    expect(isChecklistComplete(REQS, {})).toBe(false);
  });

  it("passes when all required uploaded with valid mime and size", () => {
    const state: KybChecklistState = {
      registration: { kind: "file", file: mkFile("r.pdf", "application/pdf", 2048) },
      owner_id: { kind: "file", file: mkFile("id.png", "image/png", 4096) },
    };
    expect(isChecklistComplete(REQS, state)).toBe(true);
  });

  it("blocks when uploaded file has zero size (unreadable)", () => {
    const state: KybChecklistState = {
      registration: { kind: "file", file: mkFile("r.pdf", "application/pdf", 0) },
      owner_id: { kind: "file", file: mkFile("id.png", "image/png", 4096) },
    };
    const reasons = getBlockingReasons(REQS, state);
    expect(reasons.some((r) => r.includes("unreadable"))).toBe(true);
  });

  it("blocks when uploaded file has disallowed mime type", () => {
    const state: KybChecklistState = {
      registration: { kind: "file", file: mkFile("r.exe", "application/x-msdownload", 2048) },
      owner_id: { kind: "file", file: mkFile("id.png", "image/png", 4096) },
    };
    expect(isChecklistComplete(REQS, state)).toBe(false);
  });

  it("blocks when file exceeds maxBytes", () => {
    const small: KybRequirement[] = [{ ...REQS[0], maxBytes: 1024 }];
    const state: KybChecklistState = {
      registration: { kind: "file", file: mkFile("r.pdf", "application/pdf", 2048) },
    };
    const reasons = getBlockingReasons(small, state);
    expect(reasons[0]).toMatch(/exceeds/);
  });

  it("accepts a stored file with valid mime and size metadata", () => {
    const state: KybChecklistState = {
      registration: { kind: "stored", path: "x/r.pdf", mime: "application/pdf", sizeBytes: 5000 },
      owner_id: { kind: "stored", path: "x/id.png", mime: "image/png", sizeBytes: 5000 },
    };
    expect(isChecklistComplete(REQS, state)).toBe(true);
  });

  it("blocks stored file with missing size metadata", () => {
    const state: KybChecklistState = {
      registration: { kind: "stored", path: "x/r.pdf", mime: "application/pdf" },
      owner_id: { kind: "stored", path: "x/id.png", mime: "image/png", sizeBytes: 5000 },
    };
    expect(getBlockingReasons(REQS, state).some((r) => r.includes("metadata unreadable"))).toBe(true);
  });
});
