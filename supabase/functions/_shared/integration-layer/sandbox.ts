// KOB Integration Layer — Sandbox Simulator
// Magic-value driven test harness. Activated when env=sandbox AND amount matches.

export type SimulatedOutcome =
  | { kind: "success"; delayMs?: number }
  | { kind: "declined"; code: string; message: string }
  | { kind: "challenge"; challenge_url: string }
  | { kind: "delayed_success"; delayMs: number };

export const SANDBOX_MAGIC: Record<number, SimulatedOutcome> = {
  4242: { kind: "success" },
  4000: { kind: "declined", code: "card_declined", message: "Test card declined" },
  5555: { kind: "challenge", challenge_url: "https://sandbox.kangopenbanking.com/3ds-challenge?token=test" },
  9999: { kind: "delayed_success", delayMs: 10_000 },
};

export function simulate(amount: number, env: string): SimulatedOutcome | null {
  if (env !== "sandbox") return null;
  return SANDBOX_MAGIC[amount] ?? null;
}

export function listMagicValues(): Array<{ amount: number; outcome: string; description: string }> {
  return [
    { amount: 4242, outcome: "success", description: "Charge succeeds immediately" },
    { amount: 4000, outcome: "declined", description: "Charge is declined by issuer" },
    { amount: 5555, outcome: "challenge", description: "Triggers a 3DS / SCA challenge" },
    { amount: 9999, outcome: "delayed_success", description: "Succeeds after a 10-second delay" },
  ];
}
