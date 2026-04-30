// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Supabase + TenantProvider are mocked centrally in src/test/setup.ts.
// Locally override only the auth user so banking pages render with a logged-in user.
vi.mock('@/integrations/supabase/client', async () => {
  const { createChainableSupabaseMock } = await import('./setup');
  const sb = createChainableSupabaseMock();
  sb.auth.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'test-user', email: 'test@test.com', user_metadata: { full_name: 'Test User' } } },
    error: null,
  });
  return { supabase: sb };
});

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...props} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...props} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useMutation: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useQueryClient: vi.fn().mockReturnValue({ invalidateQueries: vi.fn() }),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/hooks/useBankingData', () => ({
  useBankAccounts: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useBankTransactions: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useSavingsAccounts: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useLoanApplications: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useLoanProducts: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreditScore: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useVirtualCards: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useCreateVirtualCard: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useTopUpCard: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useUpdateCardStatus: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useSendTransfer: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useMobileMoneyCharge: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useBeneficiaries: vi.fn().mockReturnValue({ data: [], isLoading: false }),
  useExportStatement: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useSavingsDeposit: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useSavingsWithdraw: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useApplyForLoan: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/pwa/PWATopBar', () => ({
  PWATopBar: () => <div data-testid="pwa-topbar">TopBar</div>,
}));

// TenantProvider is mocked centrally in src/test/setup.ts (exposes useTenant + features).

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('Banking App E2E Feature Tests', () => {
  // ─── HOME PAGE ───
  describe('Home Page', () => {
    it('renders total balance and quick actions', async () => {
      const BankHome = (await import('@/pages/banking-app/BankHome')).default;
      render(<BankHome />, { wrapper: Wrapper });
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
      expect(screen.getByText('Send')).toBeInTheDocument();
      expect(screen.getByText('Receive')).toBeInTheDocument();
      expect(screen.getByText('MoMo')).toBeInTheDocument();
      expect(screen.getByText('QR Pay')).toBeInTheDocument();
    });

    it('renders financial services section', async () => {
      const BankHome = (await import('@/pages/banking-app/BankHome')).default;
      render(<BankHome />, { wrapper: Wrapper });
      expect(screen.getByText('Financial Services')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByText('Loans')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
    });

    it('shows empty state for transactions', async () => {
      const BankHome = (await import('@/pages/banking-app/BankHome')).default;
      render(<BankHome />, { wrapper: Wrapper });
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });

  // ─── PAYMENTS PAGE ───
  describe('Payments Page', () => {
    it('renders payment options', async () => {
      const BankPayments = (await import('@/pages/banking-app/BankPayments')).default;
      render(<BankPayments />, { wrapper: Wrapper });
      expect(screen.getByText('Send Money')).toBeInTheDocument();
      expect(screen.getByText('Mobile Money')).toBeInTheDocument();
      expect(screen.getByText('QR Pay')).toBeInTheDocument();
      expect(screen.getByText('Pay Bills')).toBeInTheDocument();
    });

    it('renders quick send contacts', async () => {
      const BankPayments = (await import('@/pages/banking-app/BankPayments')).default;
      render(<BankPayments />, { wrapper: Wrapper });
      expect(screen.getByText('Quick Send')).toBeInTheDocument();
    });
  });

  // ─── SEND MONEY ───
  describe('Send Money', () => {
    it('renders recipient form with step flow', async () => {
      const BankSendMoney = (await import('@/pages/banking-app/BankSendMoney')).default;
      render(<BankSendMoney />, { wrapper: Wrapper });
      expect(screen.getByText('Send Money')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Account ID or phone number')).toBeInTheDocument();
    });
  });

  // ─── MOBILE MONEY ───
  describe('Mobile Money', () => {
    it('renders provider selection and form', async () => {
      const BankMobileMoney = (await import('@/pages/banking-app/BankMobileMoney')).default;
      render(<BankMobileMoney />, { wrapper: Wrapper });
      expect(screen.getByText('MTN MoMo')).toBeInTheDocument();
      expect(screen.getByText('Orange Money')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('+237 6XX XXX XXX')).toBeInTheDocument();
    });
  });

  // ─── QR PAY ───
  describe('QR Pay', () => {
    it('renders QR interface', async () => {
      const BankQRPay = (await import('@/pages/banking-app/BankQRPay')).default;
      render(<BankQRPay />, { wrapper: Wrapper });
      expect(screen.getByText('QR Pay')).toBeInTheDocument();
      expect(screen.getByText('Scan QR Code')).toBeInTheDocument();
      expect(screen.getByText('Generate Payment QR')).toBeInTheDocument();
    });
  });

  // ─── BILLS ───
  describe('Pay Bills', () => {
    it('renders bill categories with providers', async () => {
      const BankBills = (await import('@/pages/banking-app/BankBills')).default;
      render(<BankBills />, { wrapper: Wrapper });
      expect(screen.getByText('Electricity')).toBeInTheDocument();
      expect(screen.getByText('Water')).toBeInTheDocument();
      expect(screen.getByText('Internet')).toBeInTheDocument();
      expect(screen.getByText('TV & Cable')).toBeInTheDocument();
    });

    it('navigates to bill form on category click', async () => {
      const BankBills = (await import('@/pages/banking-app/BankBills')).default;
      render(<BankBills />, { wrapper: Wrapper });
      fireEvent.click(screen.getByText('Electricity'));
      await waitFor(() => {
        expect(screen.getByText('Provider')).toBeInTheDocument();
        expect(screen.getByText('Meter / Account Number')).toBeInTheDocument();
      });
    });
  });

  // ─── RECEIVE ───
  describe('Receive Money', () => {
    it('renders account number and copy button', async () => {
      const BankReceive = (await import('@/pages/banking-app/BankReceive')).default;
      render(<BankReceive />, { wrapper: Wrapper });
      expect(screen.getByText('Receive Money')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });
  });

  // ─── CARDS ───
  describe('Cards Page', () => {
    it('renders empty state with create button', async () => {
      const BankCards = (await import('@/pages/banking-app/BankCards')).default;
      render(<BankCards />, { wrapper: Wrapper });
      expect(screen.getByText('Cards')).toBeInTheDocument();
      expect(screen.getByText('New Card')).toBeInTheDocument();
      expect(screen.getByText('No virtual cards yet')).toBeInTheDocument();
    });
  });

  // ─── HISTORY ───
  describe('History Page', () => {
    it('renders search, filters, and export', async () => {
      const BankHistory = (await import('@/pages/banking-app/BankHistory')).default;
      render(<BankHistory />, { wrapper: Wrapper });
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search transactions...')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();
      expect(screen.getByText('Expense')).toBeInTheDocument();
    });
  });

  // ─── SAVINGS ───
  describe('Savings Page', () => {
    it('renders empty state with new goal button', async () => {
      const BankSavings = (await import('@/pages/banking-app/BankSavings')).default;
      render(<BankSavings />, { wrapper: Wrapper });
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByText('New Goal')).toBeInTheDocument();
      expect(screen.getByText('Total Savings')).toBeInTheDocument();
    });
  });

  // ─── LOANS ───
  describe('Loans Page', () => {
    it('renders empty state and loan products section', async () => {
      const BankLoans = (await import('@/pages/banking-app/BankLoans')).default;
      render(<BankLoans />, { wrapper: Wrapper });
      expect(screen.getByText('Loans')).toBeInTheDocument();
      expect(screen.getByText('No active loans')).toBeInTheDocument();
      expect(screen.getByText('Loan Products')).toBeInTheDocument();
    });
  });

  // ─── CREDIT SCORE ───
  describe('Credit Score Page', () => {
    it('renders score gauge and factors', async () => {
      const BankCreditScore = (await import('@/pages/banking-app/BankCreditScore')).default;
      render(<BankCreditScore />, { wrapper: Wrapper });
      expect(screen.getByText('Credit Score')).toBeInTheDocument();
      expect(screen.getByText('Score Factors')).toBeInTheDocument();
      expect(screen.getByText('Payment History')).toBeInTheDocument();
      expect(screen.getByText('Credit Utilization')).toBeInTheDocument();
    });
  });

  // ─── SETTINGS ───
  describe('Settings Page', () => {
    it('renders all setting options', async () => {
      const BankSettings = (await import('@/pages/banking-app/BankSettings')).default;
      render(<BankSettings />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Personal Information')).toBeInTheDocument();
        expect(screen.getByText('Security')).toBeInTheDocument();
        expect(screen.getByText('Notifications')).toBeInTheDocument();
        expect(screen.getByText('Language & Region')).toBeInTheDocument();
        expect(screen.getByText('Appearance')).toBeInTheDocument();
      });
    });

    it('opens personal info section on click', async () => {
      const BankSettings = (await import('@/pages/banking-app/BankSettings')).default;
      render(<BankSettings />, { wrapper: Wrapper });
      await waitFor(() => screen.getByText('Personal Information'));
      fireEvent.click(screen.getByText('Personal Information'));
      await waitFor(() => {
        expect(screen.getByText('Full Name')).toBeInTheDocument();
        expect(screen.getByText('Save Changes')).toBeInTheDocument();
      });
    });
  });

  // ─── NOTIFICATIONS ───
  describe('Notifications Page', () => {
    it('renders notification items', async () => {
      const BankAlerts = (await import('@/pages/banking-app/BankAlerts')).default;
      render(<BankAlerts />, { wrapper: Wrapper });
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Transfer Complete')).toBeInTheDocument();
    });
  });

  // ─── HELP ───
  describe('Help Page', () => {
    it('renders help options', async () => {
      const BankHelp = (await import('@/pages/banking-app/BankHelp')).default;
      render(<BankHelp />, { wrapper: Wrapper });
      expect(screen.getByText('Help & Support')).toBeInTheDocument();
      expect(screen.getByText('FAQs')).toBeInTheDocument();
      expect(screen.getByText('Live Chat')).toBeInTheDocument();
      expect(screen.getByText('Call Us')).toBeInTheDocument();
    });
  });

  // ─── BACK BUTTON ───
  describe('Back Button Component', () => {
    it('renders with default label', async () => {
      const { BankBackButton } = await import('@/components/banking-app/BankBackButton');
      render(<BankBackButton />, { wrapper: Wrapper });
      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('renders with custom label', async () => {
      const { BankBackButton } = await import('@/components/banking-app/BankBackButton');
      render(<BankBackButton label="Go Back" />, { wrapper: Wrapper });
      expect(screen.getByText('Go Back')).toBeInTheDocument();
    });
  });

  // ─── MORE PAGE ───
  describe('More Page', () => {
    it('renders financial services and account sections', async () => {
      const BankMore = (await import('@/pages/banking-app/BankMore')).default;
      render(<BankMore />, { wrapper: Wrapper });
      expect(screen.getByText('More')).toBeInTheDocument();
      expect(screen.getByText('Financial Services')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByText('Loans')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });
});
