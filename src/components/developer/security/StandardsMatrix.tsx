import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const STANDARDS = [
  { standard: "FAPI 1.0 Advanced", body: "OpenID Foundation", status: "Implemented", scope: "PAR + JAR + PKCE S256 + mTLS-bound tokens" },
  { standard: "OpenID Connect Core 1.0", body: "OpenID Foundation", status: "Implemented", scope: "Discovery, ID tokens, UserInfo" },
  { standard: "OAuth 2.1 (aligned)", body: "IETF", status: "Implemented", scope: "AuthZ code + refresh + client credentials" },
  { standard: "RFC 7591", body: "IETF", status: "Implemented", scope: "Dynamic Client Registration" },
  { standard: "RFC 9126", body: "IETF", status: "Implemented", scope: "Pushed Authorization Requests (required)" },
  { standard: "RFC 9101", body: "IETF", status: "Implemented", scope: "JWT-Secured Authorization Request (required)" },
  { standard: "RFC 7636", body: "IETF", status: "Required", scope: "PKCE — S256 only" },
  { standard: "RFC 8705", body: "IETF", status: "Implemented", scope: "mTLS Client Authentication & Cert-Bound Tokens" },
  { standard: "RFC 7807", body: "IETF", status: "Implemented", scope: "Problem Details for HTTP APIs" },
  { standard: "ISO 20022", body: "ISO / SWIFT", status: "Implemented", scope: "pacs / camt / pain message families" },
  { standard: "PSD2 SCA (aligned)", body: "European Banking Authority", status: "Aligned", scope: "Strong Customer Authentication patterns" },
  { standard: "COBAC", body: "Commission Bancaire de l'Afrique Centrale", status: "Compliant", scope: "Central African banking regulator" },
  { standard: "BEAC", body: "Banque des États de l'Afrique Centrale", status: "Compliant", scope: "CEMAC payment systems" },
  { standard: "PCI DSS Level 1", body: "PCI SSC", status: "Compliant", scope: "Card data via tokenization (no raw PAN)" },
];

export function StandardsMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Standards & Compliance Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Standard</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STANDARDS.map((s) => (
                <TableRow key={s.standard}>
                  <TableCell className="font-medium whitespace-nowrap">{s.standard}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "Required" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.body}</TableCell>
                  <TableCell className="text-sm">{s.scope}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
