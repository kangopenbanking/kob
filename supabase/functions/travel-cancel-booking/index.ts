// Consumer self-cancel a travel booking with proportional wallet refund.
// Refund policy: > 24h to departure → 100% refund minus cancellation fee.
//                12-24h → 50% refund minus cancellation fee.
//                < 12h or after departure → no refund.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return j({ error: "Unauthorized" }, 401);

    const { booking_id, reason } = await req.json();
    if (!booking_id) return j({ error: "booking_id required" }, 400);

    const { data: booking } = await admin
      .from("travel_bookings")
      .select("id, user_id, trip_id, total_amount, currency, booking_status, payment_status, payment_method")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) return j({ error: "Booking not found" }, 404);
    if (booking.user_id !== user.id) return j({ error: "Forbidden" }, 403);
    if (booking.booking_status !== "confirmed") return j({ error: "Booking already cancelled or completed" }, 400);

    const { data: trip } = await admin
      .from("travel_trips")
      .select("departure_at, available_seats")
      .eq("id", booking.trip_id)
      .maybeSingle();
    if (!trip) return j({ error: "Trip not found" }, 404);

    // Refund tier
    const hoursToDeparture = (new Date(trip.departure_at).getTime() - Date.now()) / 36e5;
    let refundPct = 0;
    if (hoursToDeparture >= 24) refundPct = 100;
    else if (hoursToDeparture >= 12) refundPct = 50;

    // Cancellation fee from fee engine
    let cancelFee = 0;
    try {
      const { data: feeRes } = await admin.rpc("calculate_transaction_fee", {
        _institution_id: null,
        _transaction_type: "travel_cancellation_fee",
        _transaction_amount: Number(booking.total_amount),
      });
      cancelFee = Number((feeRes as any)?.final_fee || 0);
    } catch (_) {}

    const baseRefund = (Number(booking.total_amount) * refundPct) / 100;
    const refundAmount = Math.max(0, Math.floor(baseRefund - cancelFee));

    // Refund wallet (only if paid via wallet)
    if (refundAmount > 0 && booking.payment_method === "wallet") {
      const { data: account } = await admin
        .from("accounts").select("id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
      if (account) {
        await admin.rpc("atomic_credit_balance", {
          _account_id: account.id,
          _amount: refundAmount,
          _currency: booking.currency || "XAF",
        });
        await admin.from("transactions").insert({
          account_id: account.id,
          transaction_id: `TRV-REF-${Date.now().toString(36).toUpperCase()}`,
          amount: refundAmount,
          currency: booking.currency || "XAF",
          credit_debit_indicator: "Credit",
          status: "Booked",
          booking_datetime: new Date().toISOString(),
          value_datetime: new Date().toISOString(),
          transaction_information: `Travel booking refund (${refundPct}%) - ${booking_id}`,
          merchant_name: "Kang Travel",
          merchant_category_code: "4111",
        });
      }
    }

    // Mark booking + tickets cancelled
    await admin.from("travel_bookings").update({
      booking_status: "cancelled",
      payment_status: refundAmount > 0 ? "refunded" : "paid",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
      refund_amount: refundAmount,
    }).eq("id", booking_id);

    await admin.from("travel_tickets").update({ ticket_status: "cancelled" }).eq("booking_id", booking_id);

    // Restore seats on trip
    const { data: tickets } = await admin.from("travel_tickets").select("id").eq("booking_id", booking_id);
    if (tickets?.length) {
      await admin.from("travel_trips").update({
        available_seats: (trip.available_seats || 0) + tickets.length,
      }).eq("id", booking.trip_id);
    }

    // Record cancellation fee for platform (KOB earnings)
    if (cancelFee > 0) {
      try {
        await admin.rpc("record_transaction_fee", {
          _institution_id: null,
          _transaction_type: "travel_cancellation_fee",
          _transaction_ref: `CANCEL-${booking_id}`,
          _transaction_amount: Number(booking.total_amount),
          _transaction_id: null,
          _metadata: { booking_id, refund_pct: refundPct },
        });
      } catch (_) {}
    }

    // Notify
    try {
      await admin.functions.invoke("travel-booking-notification", {
        body: { booking_id, event_type: "booking_cancelled" },
      });
    } catch (_) {}

    return j({
      success: true,
      refund_amount: refundAmount,
      cancellation_fee: cancelFee,
      refund_percentage: refundPct,
      currency: booking.currency,
    });
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] travel-cancel-booking error:`, err);
    return j({ error: "Internal error", error_id: errorId }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
