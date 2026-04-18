import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "./useAuthenticatedUser";
import { useToast } from "@/hooks/use-toast";

export function useDashboardData() {
  const { user, loading: authLoading } = useAuthenticatedUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  const fetchAccounts = useCallback(async (userId: string) => {
    const { data: accountData } = await supabase.from("accounts").select("*").eq("user_id", userId).eq("is_active", true);
    if (accountData && accountData.length > 0) {
      setAccounts(accountData);
      const [balanceRes, txRes, benRes, soRes] = await Promise.all([
        supabase.from("account_balances").select("*").in("account_id", accountData.map(a => a.id)).order("updated_at", { ascending: false }),
        supabase.from("transactions").select("*").in("account_id", accountData.map(a => a.id)).order("booking_datetime", { ascending: false }).limit(10),
        supabase.from("beneficiaries").select("*").eq("user_id", userId).eq("is_active", true),
        supabase.from("standing_orders").select("*").eq("user_id", userId),
      ]);
      if (balanceRes.data) setBalances(balanceRes.data);
      if (txRes.data) setTransactions(txRes.data);
      if (benRes.data) setBeneficiaries(benRes.data);
      if (soRes.data) setStandingOrders(soRes.data);
    }
  }, []);

  const fetchConsents = useCallback(async (userId: string) => {
    const { data } = await supabase.from("aisp_consents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setConsents(data);
  }, []);

  const fetchPayments = useCallback(async (userId: string) => {
    const { data } = await supabase.from("payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
    if (data) setPayments(data);
  }, []);

  const fetchCreditScore = useCallback(async (userId: string) => {
    // Use the canonical engine via credit-score-fetch so the dashboard
    // shows the same score as the Customer and Banking apps.
    try {
      const { data } = await supabase.functions.invoke("credit-score-fetch", {
        body: { user_id: userId, include_report: false },
      });
      if (data?.score) setCreditScore(data.score);
      else setCreditScore(null);
    } catch {
      setCreditScore(null);
    }
  }, []);

  const fetchSavingsGoals = useCallback(async (userId: string) => {
    const { data } = await supabase.from("savings_accounts").select("id, account_name, target_amount, available_balance, maturity_date, status").eq("user_id", userId).eq("status", "active");
    if (data) {
      setSavingsGoals(data.map(account => ({
        id: account.id,
        name: account.account_name,
        targetAmount: account.target_amount || 0,
        currentAmount: account.available_balance || 0,
        currency: "XAF",
        deadline: account.maturity_date,
      })));
    }
  }, []);

  const fetchActivityFeed = useCallback(async (userId: string) => {
    const activities: any[] = [];
    const [txRes, consentRes] = await Promise.all([
      supabase.from("transactions").select("id, transaction_information, booking_datetime").order("booking_datetime", { ascending: false }).limit(5),
      supabase.from("aisp_consents").select("id, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    ]);
    txRes.data?.forEach(tx => activities.push({ id: `tx-${tx.id}`, type: "info", title: "Transaction Processed", description: tx.transaction_information || "Transaction completed", timestamp: tx.booking_datetime }));
    consentRes.data?.forEach(consent => activities.push({ id: `consent-${consent.id}`, type: consent.status === "Authorised" ? "success" : "pending", title: "Consent Updated", description: `Consent ${consent.status.toLowerCase()}`, timestamp: consent.created_at }));
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivityFeed(activities.slice(0, 10));
  }, []);

  const loadWidgets = useCallback(async (userId: string) => {
    const { data } = await supabase.from("dashboard_widgets").select("*").eq("user_id", userId).eq("is_visible", true).order("position");
    if (data) setWidgets(data);
  }, []);

  const revokeConsent = useCallback(async (consentId: string) => {
    if (!user) return;
    const { error } = await supabase.from("aisp_consents").update({ status: "Revoked", revoked_at: new Date().toISOString(), revocation_reason: "User requested revocation" }).eq("consent_id", consentId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else { toast({ title: "Consent revoked successfully" }); fetchConsents(user.id); }
  }, [user, toast, fetchConsents]);

  const hideWidget = useCallback(async (widgetId: string) => {
    if (!user) return;
    await supabase.from("dashboard_widgets").update({ is_visible: false }).eq("id", widgetId);
    loadWidgets(user.id);
    toast({ title: "Widget hidden" });
  }, [user, toast, loadWidgets]);

  const removeWidget = useCallback(async (widgetId: string) => {
    if (!user) return;
    await supabase.from("dashboard_widgets").delete().eq("id", widgetId);
    loadWidgets(user.id);
    toast({ title: "Widget removed" });
  }, [user, toast, loadWidgets]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }
    const load = async () => {
      try {
        await Promise.all([
          fetchAccounts(user.id),
          fetchConsents(user.id),
          fetchPayments(user.id),
          fetchCreditScore(user.id),
          fetchSavingsGoals(user.id),
          fetchActivityFeed(user.id),
          loadWidgets(user.id),
        ]);
      } catch (error) {
        console.error("Dashboard load error:", error);
        toast({ title: "Error", description: "Failed to load dashboard data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  return {
    user, loading,
    accounts, balances, transactions, consents, beneficiaries, standingOrders, payments,
    widgets, creditScore, savingsGoals, activityFeed,
    revokeConsent, hideWidget, removeWidget,
    refreshWidgets: () => user && loadWidgets(user.id),
  };
}
