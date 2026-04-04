import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, Upload, CheckCircle, FileText } from "lucide-react";
import { useState } from "react";

export default function EmbeddableVerificationWidget() {
  const [step, setStep] = useState<"upload" | "processing" | "complete">("upload");
  const [docType, setDocType] = useState("national_id");

  const handleSubmit = async () => {
    setStep("processing");
    await new Promise((r) => setTimeout(r, 3000));
    setStep("complete");
    window.parent?.postMessage({ type: "kob-verification-complete", status: "submitted" }, "*");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border/50">
        <CardHeader className="text-center">
          <Shield className="mx-auto h-8 w-8 text-primary" />
          <CardTitle className="mt-2">Identity Verification</CardTitle>
          <p className="text-sm text-muted-foreground">KYC document upload and verification</p>
        </CardHeader>
        <CardContent>
          {step === "upload" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="national_id">National ID Card</option>
                  <option value="passport">Passport</option>
                  <option value="drivers_license">Driver's License</option>
                  <option value="rccm">RCCM Certificate</option>
                  <option value="tax_id">Tax ID (NIU)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Full Legal Name</Label>
                <Input placeholder="As shown on document" />
              </div>

              <div className="space-y-2">
                <Label>Document Number</Label>
                <Input placeholder="Enter document number" />
              </div>

              <div className="rounded-lg border-2 border-dashed border-border/50 p-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Drag and drop or click to upload document
                </p>
                <p className="text-xs text-muted-foreground">PDF, JPG, PNG -- Max 10MB</p>
              </div>

              <Button onClick={handleSubmit} className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Submit for Verification
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="py-12 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="mt-4 text-sm font-medium">Verifying your documents...</p>
              <p className="mt-1 text-xs text-muted-foreground">This may take a moment</p>
            </div>
          )}

          {step === "complete" && (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-primary" />
              <h3 className="mt-4 text-lg font-bold">Verification Submitted</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your documents have been submitted for review. You will be notified of the result.
              </p>
              <Badge variant="outline" className="mt-4">Under Review</Badge>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Data encrypted end-to-end
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
