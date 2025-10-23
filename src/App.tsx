import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Documentation from "./pages/Documentation";
import Register from "./pages/Register";
import Admin from "./pages/Admin";
import Developer from "./pages/Developer";
import Auth from "./pages/Auth";
import TPPRegistration from "./pages/TPPRegistration";
import ConsentManagement from "./pages/ConsentManagement";
import Analytics from "./pages/Analytics";
import SystemMonitoring from "./pages/SystemMonitoring";
import Dashboard from "./pages/Dashboard";
import SecuritySettings from "./pages/SecuritySettings";
import Communications from "./pages/Communications";
import MobileMoney from "./pages/MobileMoney";
import Payments from "./pages/Payments";
import BankingOps from "./pages/BankingOps";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import SecurityPolicy from "./pages/SecurityPolicy";
import CompliancePage from "./pages/CompliancePage";
import SLA from "./pages/SLA";
import AUP from "./pages/AUP";
import DataProtection from "./pages/DataProtection";
import About from "./pages/About";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import Status from "./pages/Status";
import NotFound from "./pages/NotFound";
import FIPortal from "./pages/FIPortal";
import FeeManagement from "./pages/FeeManagement";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
            <Route path="/" element={<Layout><Index /></Layout>} />
            <Route path="/documentation" element={<Layout><Documentation /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/admin" element={<Layout><ProtectedRoute requiredRole="admin"><Admin /></ProtectedRoute></Layout>} />
            <Route path="/developer" element={<Layout><Developer /></Layout>} />
            <Route path="/tpp-registration" element={<Layout><TPPRegistration /></Layout>} />
            <Route path="/consents" element={<Layout><ConsentManagement /></Layout>} />
            <Route path="/analytics" element={<Layout><Analytics /></Layout>} />
            <Route path="/monitoring" element={<Layout><SystemMonitoring /></Layout>} />
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/security" element={<Layout><SecuritySettings /></Layout>} />
            <Route path="/communications" element={<Layout><Communications /></Layout>} />
            <Route path="/mobile-money" element={<Layout><MobileMoney /></Layout>} />
            <Route path="/payments" element={<Layout><Payments /></Layout>} />
            <Route path="/banking-ops" element={<Layout><BankingOps /></Layout>} />
            <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
            <Route path="/terms" element={<Layout><Terms /></Layout>} />
            <Route path="/cookies" element={<Layout><Cookies /></Layout>} />
            <Route path="/security-policy" element={<Layout><SecurityPolicy /></Layout>} />
            <Route path="/compliance" element={<Layout><CompliancePage /></Layout>} />
            <Route path="/sla" element={<Layout><SLA /></Layout>} />
            <Route path="/aup" element={<Layout><AUP /></Layout>} />
            <Route path="/data-protection" element={<Layout><DataProtection /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />
            <Route path="/faq" element={<Layout><FAQ /></Layout>} />
            <Route path="/status" element={<Layout><Status /></Layout>} />
            <Route path="/fi-portal" element={<Layout><FIPortal /></Layout>} />
            <Route path="/fee-management" element={<Layout><ProtectedRoute requiredRole="admin"><FeeManagement /></ProtectedRoute></Layout>} />
            <Route path="/auth" element={<Layout showFooter={false}><Auth /></Layout>} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
