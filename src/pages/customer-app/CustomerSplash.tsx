import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone } from 'lucide-react';

const CustomerSplash: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate(`/app/${institutionId}/home`, { replace: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [institutionId, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-foreground/20">
          <Smartphone className="h-10 w-10 text-primary-foreground" strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-bold text-primary-foreground">Customer App</h1>
        <p className="text-sm text-primary-foreground/70">Your money, your way</p>
      </motion.div>
    </div>
  );
};

export default CustomerSplash;
