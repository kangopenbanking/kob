import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, FileText, Camera, CheckCircle, Upload, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './TenantProvider';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface KYCOnboardingWizardProps {
  onComplete: () => void;
}

const steps = [
  { icon: User, label: 'Personal Info' },
  { icon: FileText, label: 'ID Document' },
  { icon: Camera, label: 'Selfie' },
  { icon: CheckCircle, label: 'Review' },
];

export const KYCOnboardingWizard: React.FC<KYCOnboardingWizardProps> = ({ onComplete }) => {
  const tenant = useTenant();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const fileInputFront = useRef<HTMLInputElement>(null);
  const fileInputBack = useRef<HTMLInputElement>(null);
  const fileInputSelfie = useRef<HTMLInputElement>(null);

  const [personalInfo, setPersonalInfo] = useState({
    dateOfBirth: '',
    nationality: '',
    idType: 'national_id' as string,
    idNumber: '',
  });

  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_BYTES = 10 * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.includes(file.type)) return 'Only JPG, PNG or WebP images are accepted.';
    if (file.size > MAX_BYTES) return 'File must be smaller than 10 MB.';
    return null;
  };

  const setValidatedFile = (setter: (f: File) => void) => (file: File) => {
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    setter(file);
  };

  const validateCurrentStep = (): string | null => {
    if (currentStep === 0) {
      if (!personalInfo.dateOfBirth) return 'Date of birth is required.';
      if (new Date(personalInfo.dateOfBirth) >= new Date()) return 'Date of birth must be in the past.';
      if (!personalInfo.nationality.trim()) return 'Nationality is required.';
      if (!personalInfo.idNumber.trim() || personalInfo.idNumber.trim().length < 5)
        return 'Please enter a valid ID number (min 5 characters).';
    }
    if (currentStep === 1) {
      if (!idFront) return 'Please upload the front of your ID.';
      if (personalInfo.idType !== 'passport' && !idBack) return 'Please upload the back of your ID.';
    }
    if (currentStep === 2) {
      if (!selfie) return 'Please take a selfie to continue.';
    }
    return null;
  };

  const next = () => {
    const err = validateCurrentStep();
    if (err) {
      toast.error(err);
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, 3));
  };
  const prev = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    const err = validateCurrentStep();
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload documents to storage (store paths, not public URLs)
      const uploadOne = async (file: File, slot: string) => {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/kyc/${slot}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('kyc-documents').upload(path, file);
        if (error) throw new Error(`Failed to upload ${slot}: ${error.message}`);
        return path;
      };

      const documentFrontUrl = idFront ? await uploadOne(idFront, 'id-front') : null;
      const documentBackUrl = idBack ? await uploadOne(idBack, 'id-back') : null;
      const selfieUrl = selfie ? await uploadOne(selfie, 'selfie') : null;

      if (!documentFrontUrl || !selfieUrl) {
        throw new Error('Document front and selfie are required.');
      }

      // Route through the validated edge function so we get:
      //  - Zod validation
      //  - Duplicate-submission guard
      //  - Acknowledgment email + in-app notification
      //  - Admin notification + sanctions screening
      const todayPlus = new Date();
      todayPlus.setFullYear(todayPlus.getFullYear() + 5);
      const fallbackExpiry = todayPlus.toISOString().slice(0, 10);

      const { submitIdentityKyc } = await import('@/lib/kycGateway');
      const data = await submitIdentityKyc({
        verification_type: 'identity',
        document_type: personalInfo.idType,
        document_number: personalInfo.idNumber,
        document_country: personalInfo.nationality || 'CM',
        document_expiry_date: fallbackExpiry,
        document_front_url: documentFrontUrl,
        document_back_url: documentBackUrl || undefined,
        selfie_url: selfieUrl,
      });

      // Best-effort: tag institution context onto the new verification
      if (tenant.id && data?.verification_id) {
        await supabase
          .from('kyc_verifications')
          .update({
            source_app: 'banking_app',
            institution_id: tenant.id,
            metadata: {
              date_of_birth: personalInfo.dateOfBirth,
              nationality: personalInfo.nationality,
            },
          } as any)
          .eq('id', data.verification_id);
      }

      toast.success('Verification submitted — we will email you when the review is complete.');
      onComplete();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to submit KYC'));
    } finally {
      setLoading(false);
    }
  };


  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Date of Birth</Label>
              <Input
                type="date"
                value={personalInfo.dateOfBirth}
                onChange={(e) => setPersonalInfo({ ...personalInfo, dateOfBirth: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Nationality</Label>
              <Input
                placeholder="Cameroonian"
                value={personalInfo.nationality}
                onChange={(e) => setPersonalInfo({ ...personalInfo, nationality: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">ID Type</Label>
              <div className="flex gap-2">
                {[
                  { value: 'national_id', label: 'National ID' },
                  { value: 'passport', label: 'Passport' },
                  { value: 'drivers_license', label: "Driver's License" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPersonalInfo({ ...personalInfo, idType: opt.value })}
                    className={`flex-1 rounded-lg border-2 px-2 py-2.5 text-xs font-medium transition-colors ${
                      personalInfo.idType === opt.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">ID Number</Label>
              <Input
                placeholder="Enter your ID number"
                value={personalInfo.idNumber}
                onChange={(e) => setPersonalInfo({ ...personalInfo, idNumber: e.target.value })}
                required
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="flex flex-col gap-6">
            <UploadBox
              label="Front of ID"
              file={idFront}
              inputRef={fileInputFront}
              onFileChange={setValidatedFile(setIdFront)}
            />
            {personalInfo.idType !== 'passport' && (
              <UploadBox
                label="Back of ID"
                file={idBack}
                inputRef={fileInputBack}
                onFileChange={setValidatedFile(setIdBack)}
              />
            )}
          </div>
        );


      case 2:
        return (
          <div className="flex flex-col items-center gap-6">
            <div className="flex h-40 w-40 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted">
              {selfie ? (
                <img
                  src={URL.createObjectURL(selfie)}
                  alt="Selfie"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <Camera className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
              )}
            </div>
            <input
              ref={fileInputSelfie}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              aria-label="Selfie photo"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const err = validateFile(f);
                if (err) { toast.error(err); return; }
                setSelfie(f);
              }}
            />

            <Button
              variant="outline"
              onClick={() => fileInputSelfie.current?.click()}
              className="gap-2"
            >
              <Camera className="h-4 w-4" strokeWidth={1.5} />
              {selfie ? 'Retake Selfie' : 'Take Selfie'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Make sure your face is clearly visible and well-lit
            </p>
          </div>
        );

      case 3:
        return (
          <div className="flex flex-col gap-4">
            <ReviewRow label="Date of Birth" value={personalInfo.dateOfBirth} />
            <ReviewRow label="Nationality" value={personalInfo.nationality} />
            <ReviewRow label="ID Type" value={personalInfo.idType.replace(/_/g, ' ')} />
            <ReviewRow label="ID Number" value={personalInfo.idNumber} />
            <ReviewRow label="ID Front" value={idFront ? idFront.name : 'Not uploaded'} />
            <ReviewRow label="ID Back" value={idBack ? idBack.name : 'Not uploaded'} />
            <ReviewRow label="Selfie" value={selfie ? 'Captured' : 'Not taken'} />
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      {/* Progress */}
      <div className="mb-8 flex items-center justify-between">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                    done
                      ? 'bg-primary text-primary-foreground'
                      : active
                      ? 'border-2 border-primary text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] text-muted-foreground">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-1 h-0.5 flex-1 rounded ${done ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <h2 className="mb-1 text-xl font-semibold tracking-tight text-foreground">
        {steps[currentStep].label}
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {currentStep === 0 && 'Enter your personal details'}
        {currentStep === 1 && 'Upload photos of your identity document'}
        {currentStep === 2 && 'Take a clear selfie for verification'}
        {currentStep === 3 && 'Review your information before submitting'}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.2 }}
          className="flex-1"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex gap-3">
        {currentStep > 0 && (
          <Button variant="outline" onClick={prev} className="gap-2">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back
          </Button>
        )}
        <Button
          className="flex-1 gap-2"
          size="lg"
          onClick={currentStep === 3 ? handleSubmit : next}
          disabled={loading}
        >
          {currentStep === 3 ? (loading ? 'Submitting...' : 'Submit KYC') : 'Continue'}
          <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
        </Button>
      </div>
    </div>
  );
};

// --- Sub-components ---

const UploadBox: React.FC<{
  label: string;
  file: File | null;
  inputRef: React.RefObject<HTMLInputElement>;
  onFileChange: (f: File) => void;
}> = ({ label, file, inputRef, onFileChange }) => (
  <div>
    <Label className="mb-2 text-sm">{label}</Label>
    <button
      type="button"
      aria-label={`Upload ${label}`}
      onClick={() => inputRef.current?.click()}
      className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted p-6 transition-colors hover:border-primary/50"
    >
      {file ? (
        <img
          src={URL.createObjectURL(file)}
          alt={label}
          className="h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <>
          <Upload className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <span className="text-xs text-muted-foreground">Tap to upload {label.toLowerCase()}</span>
        </>
      )}
    </button>
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      aria-label={label}
      className="hidden"
      onChange={(e) => e.target.files?.[0] && onFileChange(e.target.files[0])}
    />

  </div>
);

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-medium capitalize text-foreground">{value}</span>
  </div>
);