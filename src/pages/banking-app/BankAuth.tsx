import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { MobileAuthForm } from '@/components/pwa/MobileAuthForm';
import { useSingleSession } from '@/hooks/useSingleSession';

const BankAuthInner: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  // Detect forced sign-outs from another device
  useSingleSession();

  return (
    <MobileAuthForm
      onAuthSuccess={() => navigate(`/bank/${institutionId}/home`)}
      onApplyAccount={() => navigate(`/bank/${institutionId}/apply`)}
    />
  );
};

const BankAuth: React.FC = () => {
  return (
    <TenantProvider>
      <BankAuthInner />
    </TenantProvider>
  );
};

export default BankAuth;
