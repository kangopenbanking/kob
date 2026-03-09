import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { booking_id, event_type } = await req.json()
    if (!booking_id) {
      return new Response(JSON.stringify({ error: 'booking_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch booking details
    const { data: booking, error: bErr } = await supabase
      .from('travel_bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (bErr || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch trip, route, service, tickets
    const [tripRes, ticketRes] = await Promise.all([
      supabase.from('travel_trips').select('*').eq('id', booking.trip_id).single(),
      supabase.from('travel_tickets').select('*').eq('booking_id', booking_id),
    ])

    const trip = tripRes.data
    let route = null
    let service = null

    if (trip?.route_id) {
      const { data: r } = await supabase.from('travel_routes').select('*').eq('id', trip.route_id).single()
      route = r
      if (r?.service_id) {
        const { data: s } = await supabase.from('travel_services').select('*').eq('id', r.service_id).single()
        service = s
      }
    }

    const tickets = ticketRes.data || []
    const seatLabels = tickets.map((t: any) => t.seat_label).join(', ')
    const passengerNames = tickets.map((t: any) => t.passenger_name).join(', ')

    // Get user email
    const { data: userData } = await supabase.auth.admin.getUserById(booking.user_id)
    const userEmail = userData?.user?.email
    const userName = userData?.user?.user_metadata?.full_name || passengerNames.split(',')[0] || 'Traveller'

    const origin = route?.origin || 'Origin'
    const destination = route?.destination || 'Destination'
    const departureDate = trip ? new Date(trip.departure_at).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const departureTime = trip ? new Date(trip.departure_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
    const arrivalTime = trip ? new Date(trip.arrival_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
    const categoryLabel = service?.service_type ? service.service_type.charAt(0).toUpperCase() + service.service_type.slice(1) : 'Travel'
    const agencyName = service?.display_name || 'Travel Agency'

    // Determine event details
    const eventType = event_type || 'booking_confirmed'
    let notifTitle = ''
    let notifMessage = ''
    let notifType = 'success'
    let emailSubject = ''
    let emailBody = ''

    const categoryColors: Record<string, string> = {
      bus: '#ffbe0b',
      tours: '#3a86ff',
      airlines: '#d00000',
      trains: '#000000',
    }
    const themeColor = categoryColors[service?.service_type || 'bus'] || '#007A3D'

    switch (eventType) {
      case 'booking_confirmed':
        notifTitle = `${categoryLabel} Booking Confirmed`
        notifMessage = `Your ${origin} → ${destination} trip on ${departureDate} at ${departureTime} is confirmed. Ref: ${booking.booking_ref}. Seats: ${seatLabels}.`
        emailSubject = `Booking Confirmed — ${origin} → ${destination} | ${booking.booking_ref}`
        emailBody = `
          <div style="text-align:center;padding:24px 0 16px;">
            <div style="display:inline-block;background:${themeColor};color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;letter-spacing:1px;">${categoryLabel.toUpperCase()} BOOKING</div>
          </div>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Your booking has been <strong>confirmed</strong>! Here are your trip details:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:35%;background:#f9fafb;">Route</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${origin} → ${destination}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Agency</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${agencyName}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Date</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${departureDate}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Departure</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${departureTime} — ${arrivalTime}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Seats</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${seatLabels}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Passengers</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${passengerNames}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Reference</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-family:monospace;font-weight:700;">${booking.booking_ref}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Total Paid</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:700;color:${themeColor};">${booking.total_amount?.toLocaleString()} ${booking.currency}</td></tr>
          </table>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-weight:600;color:#92400e;">Important Reminders</p>
            <ul style="margin:8px 0 0;padding-left:18px;color:#78350f;">
              <li>Arrive at the station <strong>30-60 minutes</strong> before departure</li>
              <li>Present your <strong>QR code</strong> at the boarding gate</li>
              <li>Keep your booking reference handy: <strong>${booking.booking_ref}</strong></li>
            </ul>
          </div>
          <p style="text-align:center;margin-top:24px;">
            <a href="https://kangopenbanking.com/app/travel/ticket/${booking.id}" style="display:inline-block;background:${themeColor};color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">View E-Ticket</a>
          </p>
        `
        break

      case 'booking_cancelled':
        notifTitle = `${categoryLabel} Booking Cancelled`
        notifMessage = `Your ${origin} → ${destination} booking (${booking.booking_ref}) has been cancelled.`
        notifType = 'warning'
        emailSubject = `Booking Cancelled — ${booking.booking_ref}`
        emailBody = `
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Your booking <strong>${booking.booking_ref}</strong> for the route <strong>${origin} → ${destination}</strong> on <strong>${departureDate}</strong> has been <span style="color:#dc2626;font-weight:700;">cancelled</span>.</p>
          <p>If you did not request this cancellation, please contact support immediately.</p>
        `
        break

      case 'trip_reminder':
        notifTitle = `${categoryLabel} Trip Reminder`
        notifMessage = `Your ${origin} → ${destination} trip departs at ${departureTime} tomorrow. Don't forget your QR ticket!`
        notifType = 'info'
        emailSubject = `Trip Reminder — ${origin} → ${destination} Tomorrow`
        emailBody = `
          <p>Hi <strong>${userName}</strong>,</p>
          <p>This is a friendly reminder that your trip is <strong>tomorrow</strong>!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;width:35%;background:#f9fafb;">Route</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${origin} → ${destination}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Departure</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${departureTime}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Seats</td><td style="padding:10px 12px;border:1px solid #e5e7eb;">${seatLabels}</td></tr>
            <tr><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;">Reference</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-family:monospace;">${booking.booking_ref}</td></tr>
          </table>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:0;font-weight:600;color:#92400e;">Arrive 30-60 minutes early with your QR code ready.</p>
          </div>
        `
        break

      case 'trip_delay':
        notifTitle = `${categoryLabel} Trip Delayed`
        notifMessage = `Your ${origin} → ${destination} trip has been delayed. Please check your booking for updated times.`
        notifType = 'warning'
        emailSubject = `Trip Delay Notice — ${origin} → ${destination}`
        emailBody = `
          <p>Hi <strong>${userName}</strong>,</p>
          <p>We regret to inform you that your trip <strong>${origin} → ${destination}</strong> (Ref: ${booking.booking_ref}) has been <span style="color:#d97706;font-weight:700;">delayed</span>.</p>
          <p>Please check the app for updated departure times. We apologize for the inconvenience.</p>
        `
        break

      default:
        notifTitle = `${categoryLabel} Update`
        notifMessage = `Update regarding your ${origin} → ${destination} booking (${booking.booking_ref}).`
        emailSubject = `Booking Update — ${booking.booking_ref}`
        emailBody = `<p>Hi <strong>${userName}</strong>,</p><p>There is an update regarding your booking <strong>${booking.booking_ref}</strong>. Please check the app for details.</p>`
    }

    // 1. Create in-app notification
    await supabase.from('app_notifications').insert({
      user_id: booking.user_id,
      type: notifType,
      title: notifTitle,
      message: notifMessage,
      icon: service?.service_type || 'ticket',
      metadata: {
        booking_id: booking.id,
        booking_ref: booking.booking_ref,
        category: service?.service_type,
        route: `${origin} → ${destination}`,
        event_type: eventType,
      },
    })

    // 2. Send push notification via existing push-notification function
    try {
      await supabase.functions.invoke('push-notification', {
        body: {
          user_id: booking.user_id,
          title: notifTitle,
          message: notifMessage,
          type: notifType,
          icon: service?.service_type || 'ticket',
          metadata: { booking_id: booking.id, event_type: eventType },
        },
      })
    } catch (pushErr) {
      console.error('Push notification error (non-fatal):', pushErr)
    }

    // 3. Send email via managed-send-email if available, otherwise direct Resend
    if (userEmail) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (resendApiKey) {
        try {
          const logoUrl = 'https://kangopenbanking.com/kob-logo-email.png'
          const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  body{margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}
  .ew{max-width:600px;margin:0 auto;background:#ffffff;}
  .eh{padding:32px 40px 24px;text-align:center;border-bottom:3px solid ${themeColor};}
  .eb{padding:32px 40px;color:#1f2937;font-size:15px;line-height:1.7;}
  .eb p{margin:0 0 16px;}
  .eb strong{color:#111827;}
  .ef{padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="ew">
  <div class="eh"><img src="${logoUrl}" alt="Kang Open Banking" style="max-height:48px;" onerror="this.style.display='none';" /></div>
  <div class="eb">${emailBody}</div>
  <div class="ef">
    <p style="margin:0 0 8px;">Powered by Kang Open Banking — Transport & Tourism</p>
    <p style="margin:0;">This is an automated message from <a href="https://kangopenbanking.com" style="color:${themeColor};text-decoration:none;">kangopenbanking.com</a></p>
  </div>
</div>
</body>
</html>`

          const fromAddress = Deno.env.get('RESEND_FROM') || 'Kang Travel <notify@notify.kangopenbanking.com>'
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({ from: fromAddress, to: [userEmail], subject: emailSubject, html: fullHtml }),
          })

          if (!res.ok) {
            const errText = await res.text()
            console.error('Resend error:', errText)
          } else {
            console.log(`Travel email sent: ${eventType} to ${userEmail}`)
          }
        } catch (emailErr) {
          console.error('Email send error (non-fatal):', emailErr)
        }
      }
    }

    return new Response(JSON.stringify({ success: true, event_type: eventType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[${errorId}] travel-booking-notification error:`, err)
    return new Response(JSON.stringify({ error: 'An internal error occurred.', error_id: errorId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})