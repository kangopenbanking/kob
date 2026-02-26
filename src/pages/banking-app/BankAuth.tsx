import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TenantProvider } from '@/components/pwa/TenantProvider';
import { MobileAuthForm } from '@/components/pwa/MobileAuthForm';

const BankAuth: React.FC = () => {
  const { institutionId } = useParams();
  const navigate = useNavigate();

  return (
    <TenantProvider>
      <MobileAuthForm
        onAuthSuccess={() => navigate(`/bank/${institutionId}/home`)}
        onApplyAccount={() => navigate(`/bank/${institutionId}/apply`)}
      />
    </TenantProvider>
  );
};

export default BankAuth;
