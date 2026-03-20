import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, BookOpen, Settings, ChevronRight, CheckCircle, ArrowLeft,
  Route, Armchair, Calendar, QrCode, ScanLine, ClipboardList, Shield,
  Users, Layers, BarChart3, Tag, ShoppingCart, Bell, Mail,, Map} from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  steps: { title: string; detail: string }[];
  tips?: string[];
}

const guideSections: GuideSection[] = [
  {
    id: 'overview', title: 'Platform Overview', icon: BookOpen, badge: 'Start Here',
    description: 'Understand your role as a Super Admin in the Transport & Tourism system.',
    steps: [
      { title: 'What is the Travel System?', detail: 'The Travel System allows verified merchants to sell tickets for Bus, Tours, Airlines, and Train services. Customers browse trips, pick seats, pay, and receive e-tickets with scannable QR codes.' },
      { title: 'Your Role as Admin', detail: 'As Super Admin, you monitor all services across all merchants, approve/deactivate services, view platform-wide revenue and booking statistics, and manage data seeding for testing.' },
      { title: 'Key Data Flow', detail: 'Merchant creates Service → adds Routes → creates Seating Plans → schedules Trips → Customers book seats → System generates QR tickets → Merchant scans at boarding.' },
      { title: 'Four Travel Categories', detail: 'Bus (yellow #ffbe0b), Tours (blue #3a86ff), Airlines (red #d00000), Trains (black #000000). Each category has automatic branding applied throughout the customer experience.' },
    ],
    tips: ['All services must be activated by you before customers can see them.', 'The theme engine in travel-theme.ts handles all category colours automatically.'],
  },
  {
    id: 'dashboard', title: 'Admin Dashboard', icon: BarChart3,
    description: 'How to use the Travel Management dashboard to monitor the platform.',
    steps: [
      { title: 'Accessing the Dashboard', detail: 'Navigate to Admin > Travel Management. You will see four stat cards at the top: Active Services, Total Bookings, Total Revenue (XAF), and Valid Tickets.' },
      { title: 'Tab Navigation', detail: 'Use the tabs to switch between: Services (manage all merchant services), Routes (view all routes), Bookings (view all customer bookings), and Tickets (view all issued tickets).' },
      { title: 'Refresh Data', detail: 'Click the "Refresh" button to reload all statistics. Data is loaded as a snapshot when the page opens — refresh to get the latest numbers.' },
      { title: 'Seed Demo Data', detail: 'Click "Seed Demo Data" to populate the platform with sample services, routes, seating plans, and trips for testing. This creates data under a test merchant.' },
      { title: 'Reset All Data', detail: 'The red "Reset All Data" button deletes ALL travel data across the entire platform. Use only in development or testing — this cannot be undone.' },
    ],
    tips: ['Revenue only counts bookings with "paid" payment status.', 'Refresh regularly during peak booking times for accurate stats.'],
  },
  {
    id: 'services', title: 'Managing Services', icon: Settings,
    description: 'How to activate, deactivate, and monitor merchant travel services.',
    steps: [
      { title: 'View All Services', detail: 'In the Services tab, you see all registered travel services across all merchants. Each card shows the service name, category, merchant business name, and current status.' },
      { title: 'Activate a Service', detail: 'Click the "Activate" button on any inactive service to make it visible to customers. Only activated services appear in the customer travel app.' },
      { title: 'Deactivate a Service', detail: 'Click "Deactivate" to hide a service from customers. Existing bookings remain valid — only new bookings are prevented.' },
      { title: 'Merchant Verification', detail: 'Only merchants who have completed KYB (Know Your Business) verification can create travel services. Check the merchant status in the Merchant Management section.' },
    ],
    tips: ['Deactivation is instant — the service disappears from the customer app immediately.', 'You can bulk-manage services using the filter options.'],
  },
  {
    id: 'routes', title: 'Monitoring Routes', icon: Route,
    description: 'View and monitor all travel routes across the platform.',
    steps: [
      { title: 'View All Routes', detail: 'The Routes tab shows all routes created by all merchants. Each entry displays origin, destination, distance, duration, and the linked service.' },
      { title: 'Route Status', detail: 'Routes can be active or inactive. Inactive routes prevent new trips from being visible to customers on that route.' },
      { title: 'Identify Popular Routes', detail: 'Look at the booking volumes per route to identify the most popular corridors. This data helps with capacity planning and merchant outreach.' },
    ],
    tips: ['If merchants use inconsistent city names (e.g., "Dla" vs "Douala"), contact them to standardize for better customer search experience.'],
  },
  {
    id: 'bookings', title: 'Booking Oversight', icon: ClipboardList, badge: 'Important',
    description: 'Monitor all customer bookings, handle issues, and manage cancellations.',
    steps: [
      { title: 'View All Bookings', detail: 'The Bookings tab lists every booking across all merchants. Search by booking reference (KOB-xxx) or filter by status (Confirmed, Cancelled).' },
      { title: 'View Booking Details', detail: 'Click the eye icon on any booking to see full details: passenger names, seat numbers, ticket statuses, payment method, and amounts.' },
      { title: 'Cancel a Booking', detail: 'Click the X icon on a confirmed booking to cancel it. This cancels all linked tickets, sets payment status to "refunded", and frees up the seats.' },
      { title: 'Cash Bookings', detail: 'Merchants can create "counter bookings" for walk-in customers paying cash. These appear with payment_method "cash" and a booking ref starting with KOB-CSH.' },
    ],
    tips: ['Always verify the reason for cancellation before processing.', 'Cash booking refunds must be handled manually at the merchant counter.'],
  },
  {
    id: 'tickets', title: 'Ticket Monitoring', icon: QrCode,
    description: 'Track all issued tickets, their statuses, and scan history.',
    steps: [
      { title: 'View All Tickets', detail: 'The Tickets tab shows every ticket issued. Each displays passenger name, seat label, ticket status, and the QR code UUID.' },
      { title: 'Ticket Statuses', detail: 'Valid = unused, ready for boarding. Used = already scanned at boarding gate. Cancelled = booking was cancelled.' },
      { title: 'QR Code System', detail: 'Each ticket has a unique UUID encoded as a QR code. When scanned by the merchant, the system looks up the UUID to verify ticket validity.' },
      { title: 'Audit Trail', detail: 'When a ticket is scanned, the system records the scan timestamp and marks it as "used". A second scan shows a warning that it was already used.' },
    ],
    tips: ['QR codes use error correction level "H" for reliable scanning even with partial damage.', 'If a customer loses their QR code, they can retrieve it from their booking history in the app.'],
  },
  {
    id: 'discounts', title: 'Discount System', icon: Tag, badge: 'New',
    description: 'How the merchant discount and promo code system works.',
    steps: [
      { title: 'How Discounts Work', detail: 'Merchants can create percentage or fixed-amount discounts for their services. Discounts can have promo codes that customers enter at checkout, or be auto-applied.' },
      { title: 'Discount Controls', detail: 'Each discount has: name, type (% or fixed), value, minimum seat requirement, usage limit, promo code, and validity dates. Merchants manage these from their "Discounts & Promos" page.' },
      { title: 'Monitoring Usage', detail: 'You can see discount usage stats. Each discount tracks current_uses against max_uses. Expired or fully-used discounts are automatically marked.' },
      { title: 'Fraud Prevention', detail: 'Monitor for merchants creating excessive discounts or suspiciously high discount values. The min_seats and max_uses fields help prevent abuse.' },
    ],
    tips: ['Merchants control their own discounts — admin oversight ensures no platform-wide abuse.', 'Promo codes are case-insensitive and automatically uppercased.'],
  },
  {
    id: 'counter-booking', title: 'Counter Bookings', icon: ShoppingCart,
    description: 'How the cash-at-counter booking system works for walk-in customers.',
    steps: [
      { title: 'What are Counter Bookings?', detail: 'Merchants can book tickets on behalf of walk-in customers who pay with cash at the counter. These are called "counter bookings" and use payment_method = "cash".' },
      { title: 'How It Works', detail: 'The merchant selects a trip, picks available seats, enters passenger details, and optionally links the booking to a customer account by email. The system creates a confirmed booking with cash payment.' },
      { title: 'Customer Linking', detail: 'If the merchant enters the customer\'s registered email, the booking and tickets appear in the customer\'s app automatically under "Booking History".' },
      { title: 'Admin Visibility', detail: 'Counter bookings appear in your Bookings tab with a "cash" payment badge. Booking refs start with KOB-CSH to distinguish them from online bookings.' },
    ],
    tips: ['Cash refunds for counter bookings must be handled in person at the merchant location.', 'Encourage merchants to link bookings to customer accounts for better tracking.'],
  },
  {
    id: 'customer-journey', title: 'Customer Experience', icon: Users,
    description: 'Understanding the end-to-end customer journey for support purposes.',
    steps: [
      { title: '1. Browse Categories', detail: 'Customer opens Travel section → sees Bus, Tours, Airlines, Trains cards → taps a category.' },
      { title: '2. Select Agency', detail: 'Sees list of registered agencies for that category with search bar → taps an agency.' },
      { title: '3. Find Trips', detail: 'Available trips shown with route, time, price, seats. Filters: time of day (Morning/Afternoon/Evening), sort by price/soonest/availability.' },
      { title: '4. Book Seats', detail: 'Taps a trip → sees seat grid → selects seats → enters passenger details → reviews summary → pays via wallet.' },
      { title: '5. Get Ticket', detail: 'System generates e-ticket with QR code → customer views boarding-pass-style ticket → can access from Booking History anytime.' },
      { title: '6. Board', detail: 'At boarding, merchant scans QR code → system validates → ticket marked as "used".' },
    ],
    tips: ['If a customer reports a missing ticket, check their booking history — tickets are linked to their user account.', 'Cash bookings linked by email also appear in the customer app.'],
  },
  {
    id: 'themes', title: 'Theme & Branding', icon: Layers,
    description: 'How the automatic colour theming system works.',
    steps: [
      { title: 'Theme Engine', detail: 'All travel colours are managed in travel-theme.ts. Each category has primary colour, foreground, light background, and accent colours.' },
      { title: 'Bus', detail: 'Primary: Amber (#ffbe0b), dark text, warm cream background.' },
      { title: 'Tours', detail: 'Primary: Blue (#3a86ff), white text, cool blue background.' },
      { title: 'Airlines', detail: 'Primary: Red (#d00000), white text, soft red background.' },
      { title: 'Trains', detail: 'Primary: Black (#000000), white text, neutral grey background.' },
      { title: 'Auto-Applied', detail: 'Themes apply to headers, buttons, seats, badges, QR codes, and e-tickets automatically based on the service_type field.' },
    ],
    tips: ['No manual configuration needed — themes are driven by the service category.'],
  },
  {
    id: 'notifications', title: 'Merchant Notifications', icon: Bell, badge: 'New',
    description: 'How merchants send push notices and alerts to their passengers.',
    steps: [
      { title: 'Notification Types', detail: 'Merchants can send 5 types: General Notice, Trip Delay, Trip Cancellation, Schedule Change, and Promotion.' },
      { title: 'Targeting', detail: 'Notifications can target all passengers across active trips or passengers of a specific trip only.' },
      { title: 'Delivery', detail: 'Notifications are delivered as in-app alerts to the customer app. Each passenger gets an entry in app_notifications.' },
      { title: 'History', detail: 'All sent notifications are logged in merchant_travel_notifications with recipient counts and timestamps.' },
    ],
    tips: ['Monitor notification abuse — merchants sending excessive promos can be flagged.'],
  },
  {
    id: 'staff-roles', title: 'Staff Role Access & Authentication', icon: Shield, badge: 'Updated',
    description: 'How merchants manage team credentials, authentication, and granular access to travel services.',
    steps: [
      { title: 'Credential Management', detail: 'Merchants set everything: email, password, phone number, and 6-digit PIN for each staff member during creation via the "Add Staff" form. Staff use exactly what the merchant provides — no self-service signup.' },
      { title: 'Dedicated Staff Login', detail: 'Staff authenticate at /staff-login — a dedicated portal separate from the main login. Two auth tabs: Email+Password (standard auth) and Phone+PIN (quick 6-digit access). After login, staff are redirected to the travel portal with permissions-based navigation.' },
      { title: 'PIN Security', detail: 'PINs are hashed with salted SHA-256 before storage in the pin_hash column of merchant_staff_roles. The staff-pin-login edge function validates credentials and generates a session via magic link token — never exposes raw PINs.' },
      { title: 'Auth Page Integration', detail: 'The main /auth login page includes a "Merchant Staff Login" button that directs staff to /staff-login. Merchants can also copy the link from the Staff Roles dashboard.' },
      { title: 'Role Presets', detail: 'System provides 5 presets: Admin (full), Manager (all ops), Booking Agent (bookings + scanner), Scanner (scan only), Viewer (no access).' },
      { title: 'Custom Permissions', detail: '9 permission toggles: Services, Routes, Seating, Timetable, Bookings, Discounts, Scanner, Notifications, Reports.' },
      { title: 'Staff Table', detail: 'merchant_staff_roles stores staff with merchant_id, user_id, role, permissions JSON, phone_number, pin_hash, and active status.' },
      { title: 'Monitoring', detail: 'Admins can query the merchant_staff_roles table to audit who has access, their auth method (email vs PIN), and activity across all merchants.' },
    ],
    tips: ['RLS ensures merchants can only manage their own staff.', 'The unique constraint on (merchant_id, user_id) prevents duplicate assignments.', 'Monitor staff-pin-login edge function logs for brute-force PIN attempts.', 'Staff accounts created via merchant-create-staff edge function are auto-confirmed.'],
  },
  {
    id: 'email-templates', title: 'Email Templates', icon: Mail, badge: 'New',
    description: 'Manage automated email templates for travel bookings and notifications.',
    steps: [
      { title: 'Template Library', detail: '10 travel-specific email templates are pre-configured: Booking Confirmation, Cancellation, Departure Reminder, Trip Delay, Trip Cancellation Notice, Ticket Scanned, Refund Processed, Promo Alert, Schedule Change, and Counter Booking Receipt.' },
      { title: 'Managing Templates', detail: 'Go to Admin > Email Templates. All travel templates are in the Transactional and Notification tabs. Toggle active/inactive, edit subject and HTML body.' },
      { title: 'Template Variables', detail: 'Each template uses variables like {{passenger_name}}, {{booking_ref}}, {{origin}}, {{destination}} that are replaced at send time.' },
      { title: 'Preview', detail: 'Click the eye icon on any template to preview the rendered HTML before activating it.' },
    ],
    tips: ['Transactional templates (booking confirm, receipt) should always stay active.', 'Notification templates (reminders, promos) can be toggled per merchant preference.'],
  },
];

const AdminTravelGuide: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return guideSections;
    const q = searchQuery.toLowerCase();
    return guideSections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.steps.some(st => st.title.toLowerCase().includes(q) || st.detail.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const current = filtered.find(s => s.id === activeSection) || filtered[0];

  return (
    <div className="space-y-6">
      <AdminPageHeader icon={Map} title="Travel Services Guide" description="Admin reference for managing the transport & tourism platform" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/travel-management')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Travel Services Training Guide</h1>
          <p className="text-muted-foreground">Admin reference for managing the Transport & Tourism platform</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search guide topics..." className="pl-10" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setActiveSection(''); }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <ScrollArea className="h-[calc(100vh-240px)] rounded-xl border bg-card p-2">
          <div className="space-y-1">
            {filtered.map(s => {
              const Icon = s.icon;
              const isActive = current?.id === s.id;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{s.title}</span>
                  {s.badge && <Badge variant={isActive ? 'secondary' : 'outline'} className="text-[10px] px-1.5">{s.badge}</Badge>}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-240px)]">
          {current ? (
            <div className="space-y-6 pr-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <current.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{current.title}</h2>
                  <p className="text-sm text-muted-foreground">{current.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                {current.steps.map((step, i) => (
                  <Card key={i}>
                    <CardContent className="flex gap-4 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold mb-1">{step.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {current.tips && current.tips.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" /> Pro Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {current.tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground">{tip}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No topics match your search.</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};

export default AdminTravelGuide;
