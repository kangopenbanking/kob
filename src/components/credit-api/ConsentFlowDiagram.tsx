import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConsentFlowDiagram() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consent Flow Sequence</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <pre className="text-xs md:text-sm">
            <code>{`
┌─────────┐         ┌─────────┐         ┌──────────┐         ┌───────────┐
│  User   │         │ Lender  │         │ KOB API  │         │ NjangiBox │
└────┬────┘         └────┬────┘         └────┬─────┘         └─────┬─────┘
     │                   │                   │                     │
     │  1. Apply for Loan│                   │                     │
     ├──────────────────>│                   │                     │
     │                   │                   │                     │
     │  2. Request       │                   │                     │
     │     Consent       │                   │                     │
     │<──────────────────┤                   │                     │
     │                   │                   │                     │
     │  3. Grant Consent │                   │                     │
     │   (consent_xyz789)│                   │                     │
     ├──────────────────>│                   │                     │
     │                   │                   │                     │
     │                   │ 4. POST           │                     │
     │                   │  /credit-api-     │                     │
     │                   │   query-score     │                     │
     │                   │  + Bearer token   │                     │
     │                   │  + user_identifier│                     │
     │                   │  + consent_ref    │                     │
     │                   ├──────────────────>│                     │
     │                   │                   │                     │
     │                   │                   │ 5. Validate Token   │
     │                   │                   │    & Consent        │
     │                   │                   │                     │
     │                   │                   │ 6. Fetch External   │
     │                   │                   │    Score (if KYC'd) │
     │                   │                   ├────────────────────>│
     │                   │                   │                     │
     │                   │                   │ 7. NjangiBox Score  │
     │                   │                   │    (30% weight)     │
     │                   │                   │<────────────────────┤
     │                   │                   │                     │
     │                   │                   │ 8. Blend Scores     │
     │                   │                   │    (70% internal +  │
     │                   │                   │     30% external)   │
     │                   │                   │                     │
     │                   │                   │ 9. Log Hard Inquiry │
     │                   │                   │                     │
     │ 10. Notify User   │                   │                     │
     │  "ABC Bank accessed│                  │                     │
     │   your credit score"│                 │                     │
     │<──────────────────────────────────────┤                     │
     │                   │                   │                     │
     │                   │ 11. Return Score  │                     │
     │                   │   {               │                     │
     │                   │     score: 725,   │                     │
     │                   │     range: "Good",│                     │
     │                   │     confidence:91%│                     │
     │                   │   }               │                     │
     │                   │<──────────────────┤                     │
     │                   │                   │                     │
     │                   │ 12. Use in        │                     │
     │                   │     Underwriting  │                     │
     │                   │                   │                     │
┌────┴────┐         ┌────┴────┐         ┌────┴─────┐         ┌─────┴─────┐
│  User   │         │ Lender  │         │ KOB API  │         │ NjangiBox │
└─────────┘         └─────────┘         └──────────┘         └───────────┘

Key Points:
━━━━━━━━━━
✓ User consent MUST be obtained before Step 4
✓ consent_reference is validated server-side
✓ Hard inquiry is logged for every successful query
✓ User receives notification regardless of score result
✓ External bureau data (NjangiBox) adds 30% weight to blended score
✓ Lenders receive ONLY the credit score, not raw transaction data
            `}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
