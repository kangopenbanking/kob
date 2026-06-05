/**
 * NameCorrectionDialog — lets a user request a beneficiary-name correction.
 *
 * COMPLIANCE: We never edit profiles.full_name from the client. The dialog
 * uploads supporting ID docs to the private `kyc-documents` bucket and posts
 * to `nium-request-name-correction`. The verified name is changed only after
 * admin approval, after which the user can re-issue their global accounts.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldAlert, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type DocType = "national_id" | "passport" | "drivers_license";

interface NameCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentName: string;
  onSubmitted?: () => void;
}

const BUCKET = "kyc-documents";

async function uploadDoc(userId: string, file: File, kind: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${userId}/name-correction/${Date.now()}-${kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export function NameCorrectionDialog({
  open,
  onOpenChange,
  userId,
  currentName,
  onSubmitted,
}: NameCorrectionDialogProps) {
  const { toast } = useToast();
  const [requestedName, setRequestedName] = useState("");
  const [reason, setReason] = useState("");
  const [docType, setDocType] = useState<DocType>("national_id");
  const [docNumber, setDocNumber] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    requestedName.trim().length >= 2 &&
    requestedName.trim().toLowerCase() !== currentName.trim().toLowerCase() &&
    reason.trim().length >= 10 &&
    !!front &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const frontPath = await uploadDoc(userId, front!, "front");
      const backPath = back ? await uploadDoc(userId, back, "back") : undefined;
      const selfiePath = selfie ? await uploadDoc(userId, selfie, "selfie") : undefined;

      const { data, error } = await supabase.functions.invoke(
        "nium-request-name-correction",
        {
          body: {
            action: "submit",
            requested_full_name: requestedName.trim(),
            reason: reason.trim(),
            document_type: docType,
            document_number: docNumber.trim() || undefined,
            document_front_url: frontPath,
            document_back_url: backPath,
            selfie_url: selfiePath,
          },
        },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      toast({
        title: "Request submitted",
        description:
          "Our compliance team will review your documents. You will be notified once a decision is made.",
      });
      onOpenChange(false);
      setRequestedName("");
      setReason("");
      setDocNumber("");
      setFront(null);
      setBack(null);
      setSelfie(null);
      onSubmitted?.();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      toast({
        title: "Could not submit request",
        description:
          msg === "request_already_pending"
            ? "You already have a pending name correction request."
            : msg === "name_unchanged"
              ? "The requested name matches your current verified name."
              : msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request name correction</DialogTitle>
          <DialogDescription>
            Submit a government-issued ID matching the corrected name. Your global
            accounts will be re-issued after our compliance team approves the change.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">
            Compliance review required
          </AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-200/90 text-sm">
            We can only change your verified beneficiary name with valid ID. Existing
            USD / EUR / GBP accounts will be closed and re-issued under the new name.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Current verified name
            </Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {currentName || "Not set"}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Corrected full name (as on ID)</Label>
            <Input
              id="nc-name"
              value={requestedName}
              onChange={(e) => setRequestedName(e.target.value)}
              placeholder="e.g. Jean-Paul Mballa"
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ID type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national_id">National ID</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="drivers_license">Driver's license</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-docnum">ID number (optional)</Label>
              <Input
                id="nc-docnum"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                maxLength={64}
              />
            </div>
          </div>

          <FileField
            label="ID — front"
            required
            file={front}
            onChange={setFront}
          />
          {docType !== "passport" && (
            <FileField label="ID — back" file={back} onChange={setBack} />
          )}
          <FileField label="Selfie (optional)" file={selfie} onChange={setSelfie} />

          <div className="space-y-1.5">
            <Label htmlFor="nc-reason">Reason for correction</Label>
            <Textarea
              id="nc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the typo or legal-name change (min 10 characters)."
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              "Submit for review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileField({
  label,
  file,
  onChange,
  required,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-background px-3 py-2.5 text-sm hover:bg-muted/40">
        <UploadCloud className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <span className="truncate">
          {file ? file.name : "Choose image or PDF"}
        </span>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}
