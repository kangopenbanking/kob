// Phase 1B — R1I-d.2A-CI8 — Translation child-data FK reproducibility guard.
// Ensures historical French-translation migrations use parent-aware
// INSERT ... SELECT joins against public.translation_strings, so a clean
// canonical reset never fails with FK violations on orphaned child rows.

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");

const M1 = resolve(
  MIGRATIONS_DIR,
  "20260421020231_f64212df-1027-4427-8dad-407e633cc667.sql",
);
const M2 = resolve(
  MIGRATIONS_DIR,
  "20260421020433_9d66305b-5e2e-470f-9ffa-e80a37843212.sql",
);
const SAFE_REF = resolve(
  MIGRATIONS_DIR,
  "20260420153458_3b036d24-281b-480a-a531-1d2208bdac04.sql",
);
const WORKFLOW = resolve(
  ROOT,
  ".github/workflows/phase1b-r1i-d2a-verification.yml",
);

const SQL1 = readFileSync(M1, "utf8");
const SQL2 = readFileSync(M2, "utf8");

// ------------------------------------------------------------------
// Original row expectations (preserved from pre-repair migrations).
// UUIDs must survive verbatim; French text is preserved in the CTE
// VALUES relation.
// ------------------------------------------------------------------
const M1_UUIDS = [
  "9bcf7c48-77db-4113-a7ec-79be2ce40b07",
  "8e26f707-f216-4143-ad80-cda791a95e25",
  "13c75da0-6ffb-46a5-b4f7-b1247ba32770",
  "a5337898-5ce9-41bb-bcd6-4d3cb15a3303",
  "f15a7fc4-e4f4-4234-aede-762743b00c88",
  "fc53bf7f-545a-4d20-9aca-2324ed0a036b",
  "3aa85d67-0186-43ec-ab59-719cfcffb221",
  "fa84a89e-5177-4c97-bb70-73f1d27f71d7",
  "482ba161-03cd-4262-ac1e-199e328bcb71",
  "c2c518ea-ea11-48c8-a798-647a1c5b7c27",
  "fc79c4f8-7189-47ef-b8fc-8e10563cd2f1",
  "1fbdabaf-96a1-401c-b82f-9506495d9c3e",
  "35b5f549-49e3-4b3b-b014-191ffe768008",
  "21d27069-463c-4d37-a30a-0af2047b71e9",
  "5dd36f3f-14d3-432d-ac5d-3e5753409cbc",
  "640e518d-6442-4492-8d88-e2313679e849",
  "2b490202-deef-4b20-b780-17c200ac8154",
  "5eae32f6-fe1f-4b3b-a570-d51c6a363904",
  "77c548a6-c57a-4d3c-80a7-33d7671497be",
  "de9731af-5734-45c1-96b3-51c958930341",
  "f28ae5ce-2544-4d39-951e-59e7a06989fb",
  "d1a15972-1eda-48b8-a7b5-394880c85497",
  "a6944458-1a3a-4320-b281-9feb61dbef19",
  "f01ad6e6-aab7-49f7-a3ad-a72b361502a7",
  "7e0c98bf-229b-415f-9d61-8a706f1fe76d",
  "35110fa6-f727-4f38-8865-697e1a66f8d6",
  "8808f98c-51e7-4a4b-a3b8-7386e6486b9c",
  "96e22263-ea67-4d56-9ac2-aa8b46e2be1d",
  "948d3f71-7301-43d7-901a-d655c043bd34",
  "28624e7c-106d-4d2e-91f0-b04facede4be",
  "0edcb818-8bf2-44f7-b55e-810b5499aa90",
  "a61ef471-f690-4d80-9f66-6ab0eaf364aa",
  "a6bd4a65-f20b-48db-a072-43b4b38053b6",
  "f35fd714-dc24-450d-a491-13d8b2ff2829",
  "f6aadbab-c40e-4614-915a-8e8fef93801d",
  "8424a47e-5584-4365-a624-ead5d9e39674",
  "0605d578-ca1d-4e47-9720-ad21e8033911",
  "465ca394-3c9a-4d6a-a265-7d6eb02555c3",
  "e3b10934-9615-4c4e-a079-fd70d6bcdfcc",
  "d50fb5d1-0074-44c0-82e6-7acecca0b77c",
  "0d78db9a-60de-4339-9ac9-9dd307e9804e",
  "5371fef8-9af4-4714-bf9f-af570f5b545e",
  "24cbd253-67a4-437d-ac34-4e1450f42bd7",
  "0933e860-5dcf-4995-9326-d64e97aa1fca",
  "d9b13b3a-52c3-47ab-bdc9-7bdcd400d9dc",
  "1c19f5e4-2b62-4624-a198-785944604798",
  "4d7348b5-3aaa-455d-95ce-17da738ac336",
  "18bdc996-25cf-4146-8413-441feb4ac7f5",
  "65147a2a-080c-4426-a56b-50d1b4baf914",
  "473622cc-0f9a-4205-aaf5-291f212c95b8",
  "207fbe82-4101-4556-9bed-ffe80d34c390",
  "b75d6011-a008-40ef-86df-0916f5e530ec",
  "f4b40088-f65b-4747-86c6-7699d71f8d71",
  "b50a2045-36ba-4639-b68d-25c44f441772",
  "ab4fd405-4bc2-4cee-b1b0-907df903fe94",
  "5530d4af-6684-43c0-8adc-10c630ac19bc",
  "6b28dd37-b99b-45f9-b0c1-359643abd0b6",
  "3da084e4-b43a-44e8-8786-9545e5b3113d",
  "6d5150bb-f60f-43da-98d2-1f716d193214",
  "530cc37e-e77d-4049-af31-98abb391b0a4",
];

const M2_UUIDS = [
  "19234e3e-15bf-44ff-b7c5-0366d281fe02",
  "71d8dc72-4dac-40b0-a02d-578a553453a3",
  "993758bd-2f74-443a-a7b2-9e89e8ef8ca0",
  "b171e079-bc98-401a-8612-d612adf9f028",
  "af1d8310-58cf-4219-8b2a-bb81af4795b2",
  "a117dbc4-3fcc-4372-ab0f-b25b05e2fe83",
  "617fbac0-f753-46cf-b3c0-8d51fa39c48d",
  "a5a4f831-36ae-4ab4-b5eb-07b8f1816212",
  "dd5c52d5-bf9d-4c7c-9132-d95765dd27f5",
  "deeb4062-03e6-4465-b05f-67dc7cc397a1",
  "9815283b-e331-46bb-9855-db564f9840eb",
  "b5d1e09c-0add-4133-88cb-7db09d47f035",
  "32d196ab-8585-4770-b778-88705c14376f",
  "d8243b49-b78c-484d-86e5-4c15dcf9e212",
  "5e38eb06-6c9d-4cfa-b455-2f2412000645",
  "12fc2559-a942-4b47-8b1c-298970fe69e2",
  "fe895a83-b306-484c-97d1-3a6276d84206",
  "12d47beb-40e9-44ef-8ed4-5cdc00c59be5",
  "b13a59a1-6a7b-4a3c-b1ac-e3a0d2433a13",
  "ffe9714b-0cd6-4511-80d6-79dbf8cf1f58",
  "3c9a1830-91b7-4a48-89ee-deb5946222de",
  "fd8bb18d-4d0b-4f5a-a394-855924f192e1",
  "af1043e8-f4da-41ce-8827-b74f0c787869",
  "55b80757-f546-4531-80d7-c00089254e38",
  "bb46fd00-7ff1-41fe-bea3-fc49f3544814",
  "10e356e2-25f1-4a65-bcdd-a663950e4bf1",
  "abea06a9-bbe7-4582-8eb2-3c5efdfe0e05",
  "457997b4-7835-4f32-b3d2-39a4b60709a4",
  "d6e607e0-acfb-4d3f-b9c9-0c0bd9e2ff3e",
  "52441f26-9e1e-46ca-b516-fdf0ae8ca061",
  "69ef4fc9-c4c6-440c-937d-c33842781b66",
  "81a3cf17-729f-4bfd-bbcc-68f27ad5beb1",
  "c7ace460-835a-4376-8f92-2bc1afab45b9",
  "52e86795-ab69-4295-a63a-19bde83a7413",
  "d244b949-98f6-4b2a-86cf-96b1422aff1f",
  "f0fe9c5b-d2b8-4415-9851-6e57322f879d",
  "97071fdf-70cd-4654-a669-00e9ff18c792",
  "4727b56b-cd7f-49a2-93fa-d1c5b17fbce5",
  "fd6bee61-ce79-4f90-bf1d-c54a873fc0cf",
  "047ae2c2-04a8-4728-876b-deb723f61f57",
  "fc5b03d2-3746-4d93-9730-a8df1490741c",
  "2f3b22fa-0f09-4c8a-9b05-6d14e30ee859",
  "98e770c0-5124-493a-a9c6-5c66e4fb3277",
  "0ae23d24-cab6-431c-b3be-4119fdd7d35a",
  "12a41684-d0ac-4566-8bc2-c0fa379b8119",
  "b460f41a-d41b-4b5a-8937-f8a5570ab7e1",
  "8d69b4dd-40a2-4297-b147-6d0c4661ba25",
  "1debcaa6-ed47-4917-9e57-5a36cc2ba76a",
  "96849613-5537-42d3-a21e-446edf8b3088",
  "aca07ab4-6a85-4134-93da-b1a55cb3b239",
  "991fc0ba-a076-42ae-a477-52a0568761d7",
];

// Sample French text values that must remain present verbatim.
const M1_TEXT_SAMPLES = [
  "Assurance",
  "Créer un compte",
  "Accès à vos finances protégé par un code PIN",
  "Kang. Tous droits réservés.",
  "5.2 Vérification d''identité et sécurité",
  "Détails d''enregistrement TPP (numéros de référence FCA, autorisations réglementaires)",
];
const M2_TEXT_SAMPLES = [
  "Supprimer définitivement votre entreprise et vos données",
  "Visiter la boutique ou accepter n''importe quel montant",
  "Application bancaire",
  "Fonctionnalités avancées",
  "Supprimer le compte",
  "Profil et paramètres de l''entreprise",
];

function assertParentAwareShape(sql: string) {
  expect(sql).toMatch(/WITH\s+source\s*\(/i);
  expect(sql).toMatch(/INSERT\s+INTO\s+public\.translation_values/i);
  expect(sql).toMatch(/SELECT[\s\S]+FROM\s+source/i);
  expect(sql).toMatch(/INNER\s+JOIN\s+public\.translation_strings/i);
  expect(sql).toMatch(/parent\.id\s*=\s*source\.string_id/i);
  expect(sql).toMatch(/'fr'/);
  expect(sql).toMatch(/ON\s+CONFLICT\s*\(\s*string_id\s*,\s*language\s*\)/i);
  expect(sql).toMatch(/DO\s+UPDATE\s+SET[\s\S]+value\s*=\s*EXCLUDED\.value/i);
  expect(sql).toMatch(/translated_at\s*=\s*now\(\)/i);
  expect(sql).toMatch(/is_auto_translated\s*=\s*true/i);

  // Forbidden shapes.
  expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.translation_values[^;]*VALUES/i);
  expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.translation_strings/i);
  expect(sql).not.toMatch(/ALTER\s+TABLE[^;]*DROP\s+CONSTRAINT[^;]*translation_values/i);
  expect(sql).not.toMatch(/SET\s+CONSTRAINTS\s+ALL\s+DEFERRED/i);
  expect(sql).not.toMatch(/session_replication_role/i);
  expect(sql).not.toMatch(/EXCEPTION\s+WHEN/i);
  expect(sql).not.toMatch(/foreign_key_violation/i);
  expect(sql).not.toMatch(/DISABLE\s+TRIGGER/i);
  expect(sql).not.toMatch(/TRUNCATE\s+/i);
  expect(sql).not.toMatch(/INSERT\s+INTO\s+auth\.users/i);
}

describe("R1I-d.2A-CI8 — translation FK reproducibility", () => {
  it("first migration preserves 60 source UUID rows", () => {
    for (const u of M1_UUIDS) expect(SQL1).toContain(u);
    expect(M1_UUIDS.length).toBe(60);
  });

  it("second migration preserves 51 source UUID rows", () => {
    for (const u of M2_UUIDS) expect(SQL2).toContain(u);
    expect(M2_UUIDS.length).toBe(51);
  });

  it("first migration preserves French translation text", () => {
    for (const t of M1_TEXT_SAMPLES) expect(SQL1).toContain(t);
  });

  it("second migration preserves French translation text", () => {
    for (const t of M2_TEXT_SAMPLES) expect(SQL2).toContain(t);
  });

  it("first migration uses parent-aware INSERT ... SELECT via CTE", () => {
    assertParentAwareShape(SQL1);
  });

  it("second migration uses parent-aware INSERT ... SELECT via CTE", () => {
    assertParentAwareShape(SQL2);
  });

  it("first migration source CTE row count matches 60", () => {
    const rows = SQL1.match(/'[0-9a-f-]{36}'::uuid,\s*'fr'/gi) || [];
    expect(rows.length).toBe(60);
  });

  it("second migration source CTE row count matches 51", () => {
    const rows = SQL2.match(/'[0-9a-f-]{36}'::uuid,\s*'fr'/gi) || [];
    expect(rows.length).toBe(51);
  });

  it("no migration in the repo retains an unsafe direct translation_values VALUES insert", () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    for (const f of files) {
      const content = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
      const unsafe =
        /INSERT\s+INTO\s+public\.translation_values\s*\([^)]*\)\s*VALUES/i.test(
          content,
        );
      expect(unsafe, `Migration ${f} must not use direct translation_values VALUES insert`).toBe(false);
    }
  });

  it("existing safe migration remains unchanged (selects from translation_strings)", () => {
    const safe = readFileSync(SAFE_REF, "utf8");
    expect(safe).toMatch(/INSERT\s+INTO\s+public\.translation_values/i);
    expect(safe).toMatch(/FROM\s+public\.translation_strings/i);
    expect(safe).toMatch(/WHERE\s+NOT\s+EXISTS/i);
  });

  it("introduces no managed Supabase commands or credentials", () => {
    for (const bad of [
      "supabase login",
      "supabase link",
      "supabase db pull",
      "supabase db push",
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
      "SERVICE_ROLE_KEY",
    ]) {
      expect(SQL1).not.toContain(bad);
      expect(SQL2).not.toContain(bad);
    }
  });

  it("workflow explicitly runs CI5, CI6, CI7 and CI8 tests", () => {
    const yml = readFileSync(WORKFLOW, "utf8");
    expect(yml).toContain("phase1b-d2a-ci5-migration-reproducibility.test.ts");
    expect(yml).toContain("phase1b-d2a-ci6-extension-reproducibility.test.ts");
    expect(yml).toContain(
      "phase1b-d2a-ci7-realtime-publication-reproducibility.test.ts",
    );
    expect(yml).toContain(
      "phase1b-d2a-ci8-translation-fk-reproducibility.test.ts",
    );
  });
});
