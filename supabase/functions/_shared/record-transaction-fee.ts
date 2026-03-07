/**
 * Records a transaction fee entry in the `transaction_fees` table.
 * Called after successful gateway charges and funding intents to populate
 * billing data for invoices, analytics, and the Fees tab.
 */

interface RecordFeeParams {
  supabase: any;
  institutionId: string | null;
  transactionType: string;
  transactionRef: string;
  transactionAmount: number;
  transactionCurrency?: string;
  transactionDate?: string;
  feeStructureId?: string | null;
  feeModel?: string;
  calculatedFee: number;
  waivedAmount?: number;
  finalFee: number;
  feeBreakdown?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function recordTransactionFee(params: RecordFeeParams): Promise<void> {
  const {
    supabase,
    institutionId,
    transactionType,
    transactionRef,
    transactionAmount,
    transactionCurrency = 'XAF',
    transactionDate,
    feeStructureId,
    feeModel = 'hybrid',
    calculatedFee,
    waivedAmount = 0,
    finalFee,
    feeBreakdown,
    metadata,
  } = params;

  // Skip if no institution — platform-level charges without institution context
  // cannot be billed to an institution
  if (!institutionId) return;

  // Skip zero-fee transactions to avoid noise
  if (calculatedFee <= 0 && finalFee <= 0) return;

  try {
    await supabase.from('transaction_fees').insert({
      institution_id: institutionId,
      transaction_type: transactionType,
      transaction_ref: transactionRef,
      transaction_amount: transactionAmount,
      transaction_currency: transactionCurrency,
      transaction_date: transactionDate || new Date().toISOString(),
      fee_structure_id: feeStructureId || null,
      fee_model: feeModel,
      calculated_fee: calculatedFee,
      waived_amount: waivedAmount,
      final_fee: finalFee,
      fee_breakdown: feeBreakdown || null,
      billing_status: 'pending',
      metadata: metadata || null,
    });
  } catch (err) {
    // Best-effort — don't fail the main transaction
    console.error('Failed to record transaction fee:', err);
  }
}
