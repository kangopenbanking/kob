import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BankBackButtonProps {
  label?: string;
}

export const BankBackButton: React.FC<BankBackButtonProps> = ({ label = 'Back' }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="mb-4 flex items-center gap-2 text-sm font-semibold text-muted-foreground"
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2} />
      {label}
    </button>
  );
};
