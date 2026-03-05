

# Transport & Tourism — Ticket Booking Platform

## Summary
Add a full Transport & Tourism vertical to the KOB ecosystem, enabling merchants to register as travel agencies (Bus, Tours, Airlines, Trains) and manage trips, routes, seating plans, and bookings. Customers discover agencies via the Customer App, browse schedules, select seats, pay from their wallet, and receive QR-validated e-tickets. Phase 1 covers Bus Travel and Tours; Airlines and Trains are registered but marked "Coming Soon."

---

## Architecture Overview

```text
┌─────────────────────────────────────┐
│         MERCHANT PORTAL             │
│  /merchant/travel-services          │
│  ├── Service Setup (Bus/Tours/...)  │
│  ├── Route & Trip Manager           │
│  ├── Seating Plan Designer          │
│  ├── Timetable / Schedule           │
│  ├── Bookings & Passengers          │
│  └── QR Ticket Scanner (validate)   │
└──────────────┬──────────────────────┘
               │ Supabase Tables + RLS
┌──────────────▼──────────────────────┐
│          DATABASE LAYER             │
│  travel_services                    │
│  travel_routes                      │
│  travel_trips                       │
│  travel_seating_plans               │
│  travel_seats                       │
│  travel_bookings                    │
│  travel_tickets                     │
│  travel_passengers                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         CUSTOMER APP                │
│  /app/travel                        │
│  ├── Category selector (Bus/Tours)  │
│  ├── Agency listing                 │
│  ├── Route & schedule browser       │
│  ├── Seat selector (dynamic grid)   │
│  ├── Wallet payment checkout        │
│  └── E-Ticket with QR code         │
└─────────────────────────────────────┘
```

---

## Phase 1: Database Schema (8 new tables)

### 1. `travel_services`
Links a merchant to a transport category.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| merchant_id | UUID FK → gateway_merchants | |
| service_type | TEXT | `bus`, `tours`, `airlines`, `trains` |
| display_name | TEXT | Agency brand name |
| description | TEXT | |
| logo_url | TEXT | |
| theme_color | TEXT | e.g. `#F5C518` for bus |
| is_active | BOOLEAN | default true |
| metadata | JSONB | Flexible config |
| created_at / updated_at | TIMESTAMPTZ | |

Unique: `(merchant_id, service_type)`

### 2. `travel_routes`
Origin → Destination corridors.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| service_id | UUID FK → travel_services | |
| origin | TEXT | City/location name |
| destination | TEXT | |
| distance_km | NUMERIC | |
| estimated_duration_minutes | INT | |
| is_active | BOOLEAN | |

### 3. `travel_seating_plans`
Flexible seat layout templates (supports any pattern).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| service_id | UUID FK → travel_services | |
| plan_name | TEXT | e.g. "70-seater Coach" |
| rows | INT | Number of rows |
| columns | INT | Max columns |
| layout | JSONB | Array of `{row, col, seat_label, type, is_aisle}` — supports any pattern |
| total_seats | INT | Computed bookable count |

### 4. `travel_trips`
Specific scheduled journeys on a route.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| route_id | UUID FK → travel_routes | |
| seating_plan_id | UUID FK → travel_seating_plans | |
| departure_at | TIMESTAMPTZ | |
| arrival_at | TIMESTAMPTZ | |
| price | NUMERIC | Base price per seat |
| currency | TEXT | default `XAF` |
| available_seats | INT | Decremented on booking |
| status | TEXT | `scheduled`, `boarding`, `departed`, `completed`, `cancelled` |
| vehicle_info | TEXT | e.g. bus plate, tour name |
| metadata | JSONB | |

### 5. `travel_bookings`
A customer's booking (may contain multiple passengers/tickets).

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| trip_id | UUID FK → travel_trips | |
| user_id | UUID FK → auth.users | Customer |
| booking_ref | TEXT UNIQUE | e.g. `KOB-BUS-XXXXXX` |
| total_amount | NUMERIC | |
| currency | TEXT | |
| payment_status | TEXT | `pending`, `paid`, `refunded` |
| booking_status | TEXT | `confirmed`, `cancelled`, `completed` |
| payment_method | TEXT | `wallet` |
| created_at | TIMESTAMPTZ | |

### 6. `travel_tickets`
Individual e-tickets per seat, each with a unique QR code.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| booking_id | UUID FK → travel_bookings | |
| seat_label | TEXT | e.g. `3A` |
| passenger_name | TEXT | |
| passenger_phone | TEXT | |
| qr_code | TEXT UNIQUE | UUID-based validation token |
| ticket_status | TEXT | `valid`, `used`, `cancelled`, `expired` |
| validated_at | TIMESTAMPTZ | Set when scanned |
| validated_by | UUID | Staff who scanned |

### 7. `travel_timetables`
Weekly recurring schedule templates.

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| route_id | UUID FK → travel_routes | |
| day_of_week | INT | 0=Sun..6=Sat |
| departure_time | TIME | |
| arrival_time | TIME | |
| price | NUMERIC | |
| is_active | BOOLEAN | |

### 8. RLS Policies
- Merchants can CRUD their own `travel_services`, `travel_routes`, `travel_seating_plans`, `travel_trips`, `travel_timetables` (via `merchant_id` ownership chain).
- Customers can SELECT active trips/routes/services; INSERT bookings/tickets for themselves.
- Ticket validation (`UPDATE travel_tickets.ticket_status`) restricted to the owning merchant's staff.

---

## Phase 2: Merchant Portal — Travel Services Module

New navigation section in `merchant-navigation-config.ts`:

```text
Travel Services
  ├── Service Setup       /merchant/travel-services
  ├── Routes & Trips      /merchant/travel-routes
  ├── Seating Plans       /merchant/travel-seating
  ├── Timetable           /merchant/travel-timetable
  ├── Bookings            /merchant/travel-bookings
  └── Ticket Scanner      /merchant/travel-scanner
```

### Key Pages

1. **Service Setup** — Merchant selects which transport types they offer (Bus, Tours, Airlines, Trains). Bus and Tours are active; Airlines and Trains show "Coming Soon" badges. Each selection creates a `travel_services` record.

2. **Seating Plan Designer** — Visual grid editor. Merchant defines rows × columns, then clicks cells to toggle between `seat`, `aisle`, `blocked`. Supports any irregular pattern. Preview renders the plan in real-time.

3. **Routes & Trips** — CRUD for routes (origin/destination), then schedule trips on those routes with a selected seating plan, departure time, and price.

4. **Timetable** — Weekly recurring schedule. Merchant sets departure times per day-of-week for each route.

5. **Bookings Dashboard** — View all customer bookings, filter by trip/date/status.

6. **QR Ticket Scanner** — Uses device camera to scan QR codes. Validates ticket via edge function `travel-validate-ticket`, marking it as `used`.

---

## Phase 3: Customer App — Travel Section

### New Section on Home Page
Add "Transport & Tourism" section to `CustomerHome.tsx` below existing sections, with themed category cards:

| Category | Theme | Status |
|---|---|---|
| Bus Travel | Yellow/Black (`#F5C518` / `#1A1A1A`) | Active |
| Tours | Aquatic Blue (`#00BCD4`) | Active |
| Airlines | Red (`#D32F2F`) | Coming Soon |
| Trains | Black (`#212121`) | Coming Soon |

### New Pages

1. **`/app/travel`** — Category grid (4 cards with themed colors).
2. **`/app/travel/bus`** (and `/tours`) — Lists registered agencies for that category. Each card shows agency logo, name, and active route count.
3. **`/app/travel/bus/:serviceId`** — Agency detail with routes list and timetable.
4. **`/app/travel/bus/:serviceId/trips`** — Available trips for today/selected date. Shows departure, arrival, price, available seats.
5. **`/app/travel/bus/:serviceId/trips/:tripId`** — Seat selector (renders seating plan grid dynamically), passenger form, wallet payment.
6. **`/app/travel/ticket/:bookingId`** — E-ticket view with QR code (generated client-side using `qrcode` library), booking details, trip info.

### Booking Flow
1. Customer selects category → agency → route → trip
2. Seat selector renders the agency's seating plan; taken seats are greyed out
3. Customer fills passenger name/phone per seat selected
4. Payment deducted from wallet balance via `api-transfers` pattern (debit customer account)
5. `travel_bookings` + `travel_tickets` records created
6. E-ticket displayed with unique QR code

---

## Phase 4: Edge Functions

### `travel-validate-ticket`
- Input: `{ qr_code: string }`
- Auth: merchant staff JWT
- Logic: Look up ticket by `qr_code`, verify `ticket_status = 'valid'`, verify trip belongs to merchant's service, mark as `used`, set `validated_at` and `validated_by`.
- Returns: ticket + booking + trip details for display.

### `travel-book-trip`
- Input: `{ trip_id, seats: [{ seat_label, passenger_name, passenger_phone }] }`
- Auth: customer JWT
- Logic: Atomic transaction — check seat availability, debit wallet, create booking + tickets with generated QR codes, decrement `available_seats`.
- Returns: booking with ticket QR codes.

---

## Phase 5: Feature Gating

- Add `transport_tourism` to `AppFeatures` in `TenantProvider.tsx` so institutions can toggle this feature.
- Add `travel_services` to merchant `metadata` schema to track which service types are enabled.
- Airlines and Trains categories render with a "Coming Soon" overlay and are not clickable.

---

## Implementation Order

1. Database migration (8 tables + RLS + indexes)
2. Merchant nav config + Travel Services setup page
3. Seating Plan Designer (visual grid editor)
4. Routes, Trips & Timetable CRUD pages
5. `travel-book-trip` edge function
6. Customer App: travel category page + agency listing
7. Customer App: trip browser + seat selector + payment
8. Customer App: e-ticket with QR code
9. `travel-validate-ticket` edge function + merchant scanner page
10. Bookings dashboard for merchant

---

## Technical Decisions

- **QR codes**: Generated client-side using a lightweight library (`qrcode.react`) — no server rendering needed. The QR payload is the `travel_tickets.qr_code` UUID.
- **Seating plan flexibility**: The `layout` JSONB column stores an array of cell definitions, supporting any irregular pattern (L-shapes, missing seats, aisles, VIP sections). The visual editor and customer seat selector both render from this same data.
- **Wallet payment**: Reuses the existing `api-transfers` double-entry pattern for debiting the customer's account.
- **Theming**: Each service type has a predefined color palette applied via inline styles / Tailwind arbitrary values to maintain visual identity per category.

