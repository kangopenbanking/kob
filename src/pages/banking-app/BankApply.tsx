import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { AccountApplication } from '@/components/pwa/AccountApplication';

const BankApply: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  return (
    <TenantProvider>
      <AccountApplication
        onComplete={() => navigate(`/bank/${institutionId}/kyc`)}
        onSkip={() => navigate(`/bank/${institutionId}/auth`)}
      />
    </TenantProvider>
  );
};

export default BankApply;
