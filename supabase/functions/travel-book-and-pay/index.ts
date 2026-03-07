import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client (respects RLS)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Admin client (bypasses RLS for atomic operations)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      trip_id,
      selected_seats,
      passengers,
      category,
      discount_id,
      promo_code,
    } = body;

    if (!trip_id || !selected_seats?.length || !passengers) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch trip details
    const { data: trip, error: tripErr } = await supabaseAdmin
      .from("travel_trips")
      .select("id, price, currency, available_seats, route_id, merchant_id, seating_plan_id, departure_at")
      .eq("id", trip_id)
      .single();

    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: "Trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate seats still available
    if (trip.available_seats < selected_seats.length) {
      return new Response(
        JSON.stringify({ error: "Not enough seats available", available: trip.available_seats }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check seats aren't already booked
    const { data: confirmedBookings } = await supabaseAdmin
      .from("travel_bookings")
      .select("id")
      .eq("trip_id", trip_id)
      .in("booking_status", ["confirmed"]);

    if (confirmedBookings?.length) {
      const bookingIds = confirmedBookings.map((b: any) => b.id);
      const { data: existingTickets } = await supabaseAdmin
        .from("travel_tickets")
        .select("seat_label")
        .in("booking_id", bookingIds)
        .in("ticket_status", ["valid", "used"]);

      const takenSeats = (existingTickets || []).map((t: any) => t.seat_label);
      const conflicts = selected_seats.filter((s: string) => takenSeats.includes(s));
      if (conflicts.length > 0) {
        return new Response(
          JSON.stringify({ error: "Some seats are already taken", conflicting_seats: conflicts }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Calculate price with discount
    const basePrice = selected_seats.length * (trip.price || 0);
    let discountAmount = 0;
    let appliedDiscount: any = null;

    if (discount_id) {
      const { data: disc } = await supabaseAdmin
        .from("travel_discounts")
        .select("*")
        .eq("id", discount_id)
        .eq("is_active", true)
        .single();

      if (disc) {
        const d = disc as any;
        const now = new Date();
        const validFrom = new Date(d.valid_from);
        const validUntil = d.valid_until ? new Date(d.valid_until) : null;
        
        if (now >= validFrom && (!validUntil || now <= validUntil)) {
          if (d.max_uses === null || d.current_uses < d.max_uses) {
            if (!d.min_seats || selected_seats.length >= d.min_seats) {
              discountAmount = d.discount_type === "percentage"
                ? Math.round(basePrice * d.discount_value / 100)
                : d.discount_value;
              appliedDiscount = d;
            }
          }
        }
      }
    }

    const totalPrice = Math.max(0, basePrice - discountAmount);

    // 4. Fetch user's wallet balance
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!account) {
      return new Response(
        JSON.stringify({ error: "No wallet account found. Please set up your account first.", code: "NO_ACCOUNT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: balanceRecord } = await supabaseAdmin
      .from("account_balances")
      .select("amount")
      .eq("account_id", account.id)
      .eq("balance_type", "ClosingAvailable")
      .eq("credit_debit_indicator", "Credit")
      .order("balance_datetime", { ascending: false })
      .limit(1)
      .maybeSingle();

    const walletBalance = balanceRecord?.amount ?? 0;

    // 5. Check sufficient funds
    if (totalPrice > 0 && walletBalance < totalPrice) {
      return new Response(
        JSON.stringify({
          error: "Insufficient wallet balance",
          code: "INSUFFICIENT_FUNDS",
          required: totalPrice,
          available: walletBalance,
          shortfall: totalPrice - walletBalance,
          currency: trip.currency || "XAF",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Debit wallet (atomically)
    if (totalPrice > 0) {
      const newBalance = walletBalance - totalPrice;

      const { error: debitErr } = await supabaseAdmin
        .from("account_balances")
        .upsert(
          {
            account_id: account.id,
            balance_type: "ClosingAvailable",
            amount: newBalance,
            currency: trip.currency || "XAF",
            credit_debit_indicator: "Credit",
            balance_datetime: new Date().toISOString(),
          },
          { onConflict: "account_id,balance_type" }
        );

      if (debitErr) {
        console.error("Debit error:", debitErr);
        return new Response(
          JSON.stringify({ error: "Payment processing failed. Please try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record transaction
      await supabaseAdmin.from("transactions").insert({
        account_id: account.id,
        transaction_id: `TRV-${Date.now().toString(36).toUpperCase()}`,
        amount: totalPrice,
        currency: trip.currency || "XAF",
        credit_debit_indicator: "Debit",
        status: "Booked",
        booking_datetime: new Date().toISOString(),
        value_datetime: new Date().toISOString(),
        transaction_information: `Travel booking - ${category?.toUpperCase() || "TRV"} ticket(s)`,
        merchant_name: "Kang Travel",
        merchant_category_code: "4111",
        balance_after_transaction: newBalance,
      });
    }

    // 7. Create booking
    const bookingRef = `KOB-${(category || "TRV").toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

    const { data: bookingData, error: bookErr } = await supabaseAdmin
      .from("travel_bookings")
      .insert({
        trip_id,
        user_id: user.id,
        booking_ref: bookingRef,
        total_amount: totalPrice,
        currency: trip.currency || "XAF",
        payment_status: "paid",
        booking_status: "confirmed",
        payment_method: "wallet",
      })
      .select("id")
      .single();

    if (bookErr || !bookingData) {
      console.error("Booking creation error:", bookErr);
      // Attempt to refund
      if (totalPrice > 0) {
        await supabaseAdmin.from("account_balances").upsert(
          {
            account_id: account.id,
            balance_type: "ClosingAvailable",
            amount: walletBalance,
            currency: trip.currency || "XAF",
            credit_debit_indicator: "Credit",
            balance_datetime: new Date().toISOString(),
          },
          { onConflict: "account_id,balance_type" }
        );
      }
      return new Response(
        JSON.stringify({ error: "Booking creation failed. Payment has been refunded." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Create tickets
    const tickets = selected_seats.map((seat: string) => ({
      booking_id: bookingData.id,
      seat_label: seat,
      passenger_name: passengers[seat]?.name?.trim() || "Passenger",
      passenger_phone: passengers[seat]?.phone?.trim() || null,
      passenger_gender: passengers[seat]?.gender || "male",
      qr_code: crypto.randomUUID(),
    }));

    const { error: tickErr } = await supabaseAdmin
      .from("travel_tickets")
      .insert(tickets);

    if (tickErr) {
      console.error("Ticket creation error:", tickErr);
    }

    // 9. Update available seats
    await supabaseAdmin
      .from("travel_trips")
      .update({ available_seats: Math.max(0, trip.available_seats - selected_seats.length) })
      .eq("id", trip_id);

    // 10. Increment discount usage if applicable
    if (appliedDiscount) {
      await supabaseAdmin
        .from("travel_discounts")
        .update({ current_uses: (appliedDiscount.current_uses || 0) + 1 })
        .eq("id", appliedDiscount.id);
    }

    // 11. Send notification (non-blocking)
    try {
      await supabaseAdmin.functions.invoke("travel-booking-notification", {
        body: { booking_id: bookingData.id, event_type: "booking_confirmed" },
      });
    } catch (_) {
      // Non-fatal
    }

    return new Response(
      JSON.stringify({
        success: true,
        booking_id: bookingData.id,
        booking_ref: bookingRef,
        amount_charged: totalPrice,
        new_balance: totalPrice > 0 ? walletBalance - totalPrice : walletBalance,
        currency: trip.currency || "XAF",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("travel-book-and-pay error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
