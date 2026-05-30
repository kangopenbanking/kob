import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { KYCOnboardingWizard } from '@/components/pwa/KYCOnboardingWizard';

const BankKYC: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  if (!institutionId) {
    return <Navigate to="/not-found" replace />;
  }

  return (
    <TenantProvider>
      <KYCOnboardingWizard onComplete={() => navigate(`/bank/${institutionId}/home`)} />
    </TenantProvider>
  );
};

export default BankKYC;
