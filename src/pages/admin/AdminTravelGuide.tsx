import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, BookOpen, Bus, Compass, Plane, Train, MapPin, Armchair, Calendar,
  QrCode, Ticket, Users, BarChart3, Settings, ChevronRight, CheckCircle,
  ArrowLeft, FileText, Layers, Route, ScanLine, ClipboardList, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ───────── Guide Data ───────── */
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
    id: 'overview',
    title: 'System Overview',
    icon: BookOpen,
    badge: 'Start Here',
    description: 'Understand how the Transport & Tourism booking platform works end-to-end.',
    steps: [
      { title: 'What is the Travel System?', detail: 'The Travel System allows verified merchants to sell tickets for Bus, Tours, Airlines, and Train services. Customers browse available trips, pick seats, pay, and receive an e-ticket with a scannable QR code.' },
      { title: 'Four Travel Categories', detail: 'Every service belongs to one of four categories: Bus (yellow theme), Tours & Excursions (blue), Airlines (red), and Trains (black). Each category has its own branding throughout the customer experience.' },
      { title: 'Key Roles', detail: 'There are three roles: (1) Admin — monitors all services, bookings, revenue, and can activate or deactivate services. (2) Merchant — creates and manages their travel service, routes, seating plans, trips, and scans tickets at boarding. (3) Customer — searches trips, books seats, pays, and receives e-tickets.' },
      { title: 'Data Flow', detail: 'Merchant creates a Service, then adds Routes (origin to destination). Each route gets a Seating Plan (layout of seats). The merchant then schedules Trips on a route with a price and departure time. Customers book a trip, pick seats, and pay. The system generates tickets with QR codes.' },
    ],
    tips: [
      'All services must be verified and activated before customers can see them.',
      'Each travel category has a unique colour scheme — this is automatic and managed by the theme engine.',
    ],
  },
  {
    id: 'services',
    title: 'Managing Travel Services',
    icon: Settings,
    description: 'How merchants register and configure their transport or tourism business on the platform.',
    steps: [
      { title: 'Step 1 — Register a Service', detail: 'From the Merchant Portal, navigate to "Travel Services". Click "Create Service". Enter the business display name, select the category (Bus, Tours, Airlines, or Trains), and add a description. Submit the form.' },
      { title: 'Step 2 — Activate or Deactivate', detail: 'As an Admin, go to Admin > Travel Management > Services tab. Each service has an "Activate" or "Deactivate" button. Only active services appear in the customer app.' },
      { title: 'Step 3 — View Merchant Info', detail: 'Each service card shows the linked merchant business name. Click on a service to see the full details including creation date and current status.' },
    ],
    tips: [
      'Only verified merchants (those who have completed KYB) can create travel services.',
      'Deactivating a service hides it from customers but does not cancel existing bookings.',
    ],
  },
  {
    id: 'routes',
    title: 'Setting Up Routes',
    icon: Route,
    badge: 'Important',
    description: 'Routes define where your service travels — from origin to destination.',
    steps: [
      { title: 'Step 1 — Navigate to Routes', detail: 'In the Merchant Portal, go to "Travel Routes". This page lists all routes you have created for your service.' },
      { title: 'Step 2 — Add a New Route', detail: 'Click "Add Route". Enter the origin city and destination city. Optionally add the distance in kilometres and the estimated travel duration in minutes. Save the route.' },
      { title: 'Step 3 — Enable or Disable', detail: 'Toggle the route active/inactive. Inactive routes will not show available trips to customers.' },
      { title: 'Step 4 — View on Admin Panel', detail: 'Admins can see all routes across all services in Admin > Travel Management > Routes tab, including distance and duration.' },
    ],
    tips: [
      'Be precise with city names — customers search and filter by these names.',
      'You can have multiple routes per service (e.g., Douala to Limbe AND Douala to Buea).',
    ],
  },
  {
    id: 'seating',
    title: 'Creating Seating Plans',
    icon: Armchair,
    description: 'Define the seat layout for your vehicles or venues. Each seat has a label and position.',
    steps: [
      { title: 'Step 1 — Open Seating Plans', detail: 'In the Merchant Portal, go to "Seating Plans". This is where you define how many seats your vehicle has and how they are arranged.' },
      { title: 'Step 2 — Create a Plan', detail: 'Click "Create Plan". Give it a name (e.g., "70-Seater Coach"). Set the number of rows and columns. The system generates a visual grid.' },
      { title: 'Step 3 — Customise the Layout', detail: 'Each cell in the grid can be a seat (with a label like "1", "2", etc.) or an aisle/empty space. Arrange them to match your real vehicle layout.' },
      { title: 'Step 4 — Link to Trips', detail: 'When creating a trip, you select which seating plan to use. This determines the total seats and the visual layout customers see when picking seats.' },
    ],
    tips: [
      'Seat labels appear on the customer booking screen and on e-tickets.',
      'The seat grid supports gender-coded indicators (M/F) to help passengers identify who is sitting where.',
      'You can create multiple seating plans for different vehicle types under the same service.',
    ],
  },
  {
    id: 'trips',
    title: 'Scheduling Trips',
    icon: Calendar,
    description: 'Trips are specific journeys on a route at a set date, time, and price.',
    steps: [
      { title: 'Step 1 — Go to Trip Management', detail: 'In the Merchant Portal, open "Timetable & Trips". This shows all your scheduled trips.' },
      { title: 'Step 2 — Schedule a New Trip', detail: 'Click "Add Trip". Select a route, a seating plan, set the departure date/time, arrival date/time, ticket price, and currency. Add optional vehicle info (e.g., "Bus CM-7890-B").' },
      { title: 'Step 3 — Monitor Availability', detail: 'The system automatically tracks available seats. As customers book, the seat count goes down. When seats are low (5 or fewer), the progress bar turns red to flag urgency.' },
      { title: 'Step 4 — Trip Statuses', detail: 'Trips can be "scheduled" (upcoming), "in_progress" (currently travelling), or "completed" (arrived). The admin panel shows these with colour-coded badges.' },
    ],
    tips: [
      'Trips appear to customers sorted by departure time, with time-of-day filters (Morning, Afternoon, Evening).',
      'You can create recurring trips using the Timetable feature for daily/weekly schedules.',
    ],
  },
  {
    id: 'bookings',
    title: 'Understanding Bookings',
    icon: ClipboardList,
    description: 'What happens when a customer books a trip — from seat selection to payment.',
    steps: [
      { title: 'Step 1 — Customer Browses', detail: 'The customer opens the travel section, picks a category (Bus, Tours, etc.), then selects an agency/service. They see available trips with prices, times, and seat availability.' },
      { title: 'Step 2 — Seat Selection', detail: 'The customer taps a trip and sees the seating plan grid. Available seats are shown in the category colour. Taken seats are greyed out. They tap to select one or more seats.' },
      { title: 'Step 3 — Passenger Details', detail: 'For each selected seat, the customer enters the passenger name and phone number. The first passenger is auto-filled from their profile.' },
      { title: 'Step 4 — Payment', detail: 'The customer confirms and pays. The system creates a booking record with a unique reference (e.g., KOB-BUS-MME303L9), marks it as "confirmed" and "paid".' },
      { title: 'Step 5 — Booking Record', detail: 'Admins can view all bookings in Admin > Travel Management > Bookings tab. Filter by status or search by reference. Click the eye icon to see full details including linked tickets.' },
    ],
    tips: [
      'Admins can cancel bookings from the Bookings tab — this also cancels all linked tickets.',
      'Each booking has a unique ref code that customers can use for lookups.',
    ],
  },
  {
    id: 'tickets',
    title: 'E-Tickets & QR Codes',
    icon: QrCode,
    badge: 'Key Feature',
    description: 'Every booking generates e-tickets with scannable QR codes for boarding validation.',
    steps: [
      { title: 'Step 1 — Ticket Generation', detail: 'When a booking is confirmed, the system automatically creates one ticket per seat. Each ticket gets a unique QR code (UUID) stored in the database.' },
      { title: 'Step 2 — E-Ticket Display', detail: 'The customer sees a professional boarding-pass-style ticket with the route, departure time, seat number, passenger name, QR code, and booking reference. The design matches the travel category colour.' },
      { title: 'Step 3 — QR Code Content', detail: 'The QR code encodes the ticket UUID. When scanned, it returns this UUID which is looked up in the database to validate the ticket.' },
      { title: 'Step 4 — Download & Share', detail: 'Customers can download their ticket as a PDF or share the QR code. The PDF includes all journey details and is formatted for printing.' },
    ],
    tips: [
      'QR codes use error correction level "H" (high) so they scan reliably even if partially obscured.',
      'Each ticket has a status: "valid" (unused), "used" (scanned at boarding), or "cancelled".',
    ],
  },
  {
    id: 'scanning',
    title: 'Ticket Scanning & Validation',
    icon: ScanLine,
    badge: 'Merchant',
    description: 'How merchants validate customer tickets at the boarding gate using the scanner.',
    steps: [
      { title: 'Step 1 — Open the Scanner', detail: 'In the Merchant Portal, go to "Ticket Scanner". This is the tool used at the boarding gate to validate customer tickets.' },
      { title: 'Step 2 — Enter or Scan QR Code', detail: 'Type the QR code value (UUID) into the input field, or scan it with a barcode scanner device. Press Enter or click "Validate Ticket".' },
      { title: 'Step 3 — Review the Result', detail: 'The system checks the ticket against the database. Three possible outcomes: (a) Green — Valid ticket, now marked as "used". Shows passenger name, seat, route, and departure. (b) Yellow — Ticket already used, shows when it was previously scanned. (c) Red — Invalid or cancelled ticket.' },
      { title: 'Step 4 — Recent Scans', detail: 'Successfully validated tickets appear in the "Recent Scans" list below the scanner. This gives a running log of passengers who have boarded.' },
    ],
    tips: [
      'A ticket can only be scanned once — the second scan shows a warning that it was already used.',
      'The scanner records who validated the ticket and when, for audit purposes.',
      'Use a USB barcode scanner for faster operation — it types the QR value and presses Enter automatically.',
    ],
  },
  {
    id: 'admin-oversight',
    title: 'Admin Monitoring & Controls',
    icon: Shield,
    description: 'How platform administrators monitor and manage all travel operations.',
    steps: [
      { title: 'Dashboard Stats', detail: 'The Admin Travel Management page shows four key metrics at the top: Active Services, Total Bookings, Total Revenue (in XAF), and Valid Tickets. These update in real-time when you click Refresh.' },
      { title: 'Service Control', detail: 'Admins can activate or deactivate any merchant service. Deactivation hides the service from customers immediately but preserves existing bookings.' },
      { title: 'Booking Management', detail: 'View all bookings with search and status filters. Click the eye icon for full details. Cancel confirmed bookings — this also cancels all linked tickets and can trigger a refund.' },
      { title: 'Ticket Monitoring', detail: 'The Tickets tab shows all issued tickets with their status (valid, used, cancelled). You can see scan timestamps for validated tickets.' },
      { title: 'Data Reset', detail: 'The "Reset All Data" button (red) deletes ALL travel data including services, routes, trips, bookings, and tickets. Use only in development or testing — this action cannot be undone.' },
    ],
    tips: [
      'Refresh regularly to get the latest data — the page loads a snapshot when first opened.',
      'The Revenue metric only counts bookings with a "paid" payment status.',
    ],
  },
  {
    id: 'customer-experience',
    title: 'Customer Journey Walkthrough',
    icon: Users,
    description: 'A complete walkthrough of what your customers see when booking travel.',
    steps: [
      { title: '1. Travel Categories', detail: 'The customer opens /app/travel and sees four cards: Bus Travel, Tours & Excursions, Airlines, and Trains. Each has its category colour and icon. They tap one to proceed.' },
      { title: '2. Agency Listing', detail: 'They see a list of registered travel agencies (services) for that category, with a search bar. Recently booked routes appear as quick-access cards at the top.' },
      { title: '3. Trip Discovery', detail: 'After selecting an agency, available trips are shown as cards with dotted colour borders. Trips display the route, departure time, price, and available seats. Filters for time-of-day (Morning/Afternoon/Evening) and sorting (Price, Soonest, Available) are available.' },
      { title: '4. Seat Selection', detail: 'The customer taps a trip and sees the vehicle seating grid. Available seats are in the category colour, taken seats are greyed out. Gender indicators (M/F) show male/female passengers. They tap to select seats.' },
      { title: '5. Passenger Details', detail: 'A form appears for each selected seat requesting name and phone number. The primary passenger is auto-filled from their profile.' },
      { title: '6. Payment & Confirmation', detail: 'The customer confirms the booking and pays via their preferred method. A success screen appears with the booking reference.' },
      { title: '7. E-Ticket', detail: 'The customer is taken to a professional boarding-pass-style e-ticket page. It shows the route, times, seat number, QR code, and booking reference. They can download it as PDF.' },
    ],
  },
  {
    id: 'themes',
    title: 'Theme & Branding System',
    icon: Layers,
    description: 'How the colour theming works across all travel pages.',
    steps: [
      { title: 'Centralised Theme Engine', detail: 'All travel colours are managed in a single file (travel-theme.ts). Each category has a primary colour, foreground colour, light background, and accent colours.' },
      { title: 'Bus Theme', detail: 'Primary: Amber/Yellow (#ffbe0b). Dark text on yellow backgrounds. Light background: warm cream. Used across all bus-related pages.' },
      { title: 'Tours Theme', detail: 'Primary: Bright Blue (#3a86ff). White text on blue backgrounds. Light background: cool blue tint. Applied to all tour/excursion pages.' },
      { title: 'Airlines Theme', detail: 'Primary: Deep Red (#d00000). White text on red backgrounds. Light background: soft red tint. Used for all airline pages.' },
      { title: 'Trains Theme', detail: 'Primary: Black (#000000). White text on black backgrounds. Light background: neutral grey. Applied to all train pages.' },
      { title: 'Automatic Application', detail: 'When a customer enters a travel category, the theme automatically applies to headers, buttons, seat selectors, badges, QR codes, and e-tickets. No manual configuration needed.' },
    ],
    tips: [
      'The theme is determined by the service_type field on the travel_services table.',
      'QR codes on tickets adapt their foreground colour to match the category theme.',
    ],
  },
];

/* ───────── Component ───────── */
const AdminTravelGuide: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string>('overview');

  const filtered = useMemo(() => {
    if (!search.trim()) return guideSections;
    const q = search.toLowerCase();
    return guideSections.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.steps.some(st => st.title.toLowerCase().includes(q) || st.detail.toLowerCase().includes(q))
    );
  }, [search]);

  const currentSection = guideSections.find(s => s.id === activeSection);
  const currentInFiltered = filtered.find(s => s.id === activeSection);
  const displaySection = currentInFiltered || filtered[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/travel-management')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Travel Services Training Guide
          </h1>
          <p className="text-muted-foreground text-sm">Step-by-step instructions for managing the Transport & Tourism platform</p>
        </div>
        <Badge variant="outline" className="text-xs">{guideSections.length} Sections</Badge>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search guide... (e.g. QR code, seating, booking)"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Sidebar Menu ── */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contents</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ScrollArea className="max-h-[60vh]">
              <nav className="space-y-0.5">
                {filtered.map((section) => {
                  const Icon = section.icon;
                  const isActive = displaySection?.id === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => { setActiveSection(section.id); }}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{section.title}</span>
                      {section.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{section.badge}</Badge>
                      )}
                      {isActive && <ChevronRight className="h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">No sections match your search.</p>
                )}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ── Content Area ── */}
        <div className="space-y-4">
          {displaySection ? (
            <>
              {/* Section Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <displaySection.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{displaySection.title}</CardTitle>
                      <CardDescription className="mt-1">{displaySection.description}</CardDescription>
                    </div>
                    {displaySection.badge && <Badge>{displaySection.badge}</Badge>}
                  </div>
                </CardHeader>
              </Card>

              {/* Steps */}
              <div className="space-y-3">
                {displaySection.steps.map((step, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="flex gap-4 py-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] mb-1">{step.title}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Tips */}
              {displaySection.tips && displaySection.tips.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Pro Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-2">
                      {displaySection.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 opacity-20 mb-3" />
                <p className="font-semibold">No matching sections</p>
                <p className="text-sm">Try a different search term.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTravelGuide;
