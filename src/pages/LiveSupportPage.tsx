import React from 'react';
import { LiveSupport } from '@/components/support/LiveSupport';

const LiveSupportPage: React.FC = () => (
  <main className="min-h-[calc(100vh-4rem)] bg-background">
    <h1 className="sr-only">Live Support</h1>
    <LiveSupport variant="page" source="page:/support" />
  </main>
);

export default LiveSupportPage;
