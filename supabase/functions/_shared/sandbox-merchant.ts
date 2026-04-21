export async function ensureSandboxMerchantId(
  supabase: any,
  user: { id: string; email?: string | null },
  options: { accountId?: string; companyName?: string | null } = {},
): Promise<string> {
  const { accountId, companyName } = options;

  const { data: existingMerchant, error: existingMerchantError } = await supabase
    .from("gateway_merchants")
    .select("id")
    .eq("user_id", user.id)
    .eq("environment", "sandbox")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingMerchantError) throw existingMerchantError;

  let merchantId = existingMerchant?.id as string | undefined;

  if (!merchantId) {
    const { data: merchant, error: merchantError } = await supabase
      .from("gateway_merchants")
      .insert({
        user_id: user.id,
        business_name: companyName?.trim() || "Sandbox Merchant",
        business_email: user.email || null,
        environment: "sandbox",
        metadata: { source: "developer_sandbox" },
      })
      .select("id")
      .single();

    if (merchantError) throw merchantError;
    merchantId = merchant.id;
  }

  if (accountId) {
    const { error: updateError } = await supabase
      .from("developer_sandbox_accounts")
      .update({ merchant_id: merchantId })
      .eq("id", accountId);

    if (updateError) throw updateError;
  }

  return merchantId;
}