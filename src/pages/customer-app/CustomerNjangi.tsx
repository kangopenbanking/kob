import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign } from 'lucide-react';

const CustomerNjangi: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6 text-foreground" strokeWidth={1.5} /></button>
        <h1 className="text-xl font-bold text-foreground">Njangi</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(270,60%,92%)]">
          <CircleDollarSign className="h-8 w-8 text-foreground" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-muted-foreground">Njangi (Money Box) feature coming soon</p>
      </div>
    </div>
  );
};

export default CustomerNjangi;
