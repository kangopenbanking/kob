import { describe, it, expect, vi } from "vitest";
import { buildDocumentsPayload, guessMime, type KybBuildAuditEvent } from "@/lib/kyb-documents";

function makeStorageMock(
  files: Record<string, { size?: number; mimetype?: string } | null>,
) {
  return {
    storage: {
      from: (_bucket: string) => ({
        list: vi.fn(async (_folder: string, opts: { search?: string }) => {
          const key = Object.keys(files).find((k) => k.endsWith(opts.search ?? ""));
          if (!key || files[key] === null) {
            return { data: [], error: null };
          }
          return {
            data: [{ name: opts.search!, metadata: files[key] }],
            error: null,
          };
        }),
      }),
    },
  } as any;
}

describe("buildDocumentsPayload", () => {
  it("guessMime returns expected types", () => {
    expect(guessMime("a/b/c.pdf")).toBe("application/pdf");
    expect(guessMime("a.PNG")).toBe("image/png");
    expect(guessMime("a.JPEG")).toBe("image/jpeg");
    expect(guessMime("a.webp")).toBe("image/webp");
    expect(guessMime("a.bin")).toBe("application/octet-stream");
  });

  it("produces a correct documents[] with type/url/mime/size for each uploaded path", async () => {
    const supabase = makeStorageMock({
      "u1/reg.pdf": { size: 1234, mimetype: "application/pdf" },
      "u1/poa.png": { size: 9000, mimetype: "image/png" },
    });
    const events: KybBuildAuditEvent[] = [];
    const out = await buildDocumentsPayload(
      supabase,
      {
        registration_certificate: "u1/reg.pdf",
        proof_of_address: "u1/poa.png",
        tax_certificate: "", // empty entries are skipped
      },
      { audit: (e) => events.push(e) },
    );
    expect(out).toEqual([
      { type: "registration_certificate", url: "u1/reg.pdf", mime_type: "application/pdf", size_bytes: 1234 },
      { type: "proof_of_address", url: "u1/poa.png", mime_type: "image/png", size_bytes: 9000 },
    ]);
    // One success audit per resolved document
    expect(events.filter((e) => e.event === "doc_metadata_ok")).toHaveLength(2);
  });

  it("throws and emits a metadata_missing audit when size cannot be read", async () => {
    const supabase = makeStorageMock({ "u1/reg.pdf": null });
    const events: KybBuildAuditEvent[] = [];
    await expect(
      buildDocumentsPayload(
        supabase,
        { registration_certificate: "u1/reg.pdf" },
        { audit: (e) => events.push(e) },
      ),
    ).rejects.toThrow(/registration_certificate/);
    expect(events.some((e) => e.event === "doc_metadata_missing")).toBe(true);
  });

  it("falls back to guessed mime when storage metadata omits mimetype", async () => {
    const supabase = makeStorageMock({
      "u1/reg.pdf": { size: 10 }, // mimetype missing
    });
    const events: KybBuildAuditEvent[] = [];
    const out = await buildDocumentsPayload(
      supabase,
      { registration_certificate: "u1/reg.pdf" },
      { audit: (e) => events.push(e) },
    );
    expect(out[0].mime_type).toBe("application/pdf");
    expect(events.some((e) => e.event === "doc_metadata_fallback_mime")).toBe(true);
  });
});
