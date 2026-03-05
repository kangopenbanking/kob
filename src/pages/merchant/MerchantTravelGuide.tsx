import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, BookOpen, Bus, Compass, Plane, Train, MapPin, Armchair, Calendar,
  QrCode, Ticket, Users, Settings, ChevronRight, CheckCircle, ArrowLeft,
  Route, ScanLine, ShoppingCart, CreditCard, History, Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    id: 'overview', title: 'Getting Started', icon: BookOpen, badge: 'Start Here',
    description: 'Understand how the Travel Services system works and what you can do as a merchant.',
    steps: [
      { title: 'What is Travel Services?', detail: 'Travel Services lets you sell tickets for Bus, Tours, Airlines, and Train services directly through the platform. Customers browse your trips, pick seats, pay online or at your counter, and receive scannable e-tickets.' },
      { title: 'Your Dashboard Sections', detail: 'Your Travel dashboard has 7 sections: Services (set up your business), Routes (define origin-destination pairs), Seating (create seat layouts), Timetable (schedule recurring trips), Bookings (view all orders), Scanner (validate tickets at boarding), and this Guide.' },
      { title: 'Quick Setup Flow', detail: '1) Create a Service → 2) Add Routes → 3) Create Seating Plans → 4) Schedule Trips → 5) Start selling! Customers will see your trips immediately once active.' },
    ],
    tips: ['Use "Seed Demo Data" on the Services page to quickly populate sample data for testing.', 'You must complete KYB verification before your services go live to customers.'],
  },
  {
    id: 'services', title: 'Managing Services', icon: Settings,
    description: 'How to create and configure your transport or tourism service.',
    steps: [
      { title: 'Create a Service', detail: 'Go to Travel Services. Click "Set Up" under the category you want (Bus, Tours, etc.). Enter your agency/brand name and a brief description. Click "Create Service".' },
      { title: 'Activate or Pause', detail: 'Use the toggle switch on each service card to make it live or pause it. Paused services are hidden from customers but existing bookings remain valid.' },
      { title: 'Theme Colors', detail: 'Each category has its own color theme applied automatically: Bus (yellow), Tours (cyan), Airlines (red), Trains (black). This ensures a consistent look across the customer app.' },
    ],
    tips: ['You can run multiple services under different categories (e.g., both Bus and Tours).'],
  },
  {
    id: 'routes', title: 'Setting Up Routes', icon: Route, badge: 'Important',
    description: 'Routes define where your service travels — from origin to destination.',
    steps: [
      { title: 'Add a Route', detail: 'Navigate to Travel Routes. Click "Add Route". Enter the origin city, destination city, distance (km), and estimated duration (minutes). Save.' },
      { title: 'Enable / Disable Routes', detail: 'Toggle a route active or inactive. Only active routes will show trips to customers.' },
      { title: 'Multiple Routes', detail: 'You can add as many routes as you need — for example, Douala → Yaoundé, Douala → Buea, Yaoundé → Bamenda, etc.' },
    ],
    tips: ['Be precise with city names — customers search by these exact names.', 'Distance and duration are shown to customers when browsing trips.'],
  },
  {
    id: 'seating', title: 'Creating Seating Plans', icon: Armchair,
    description: 'Define the seat layout of your vehicle or venue.',
    steps: [
      { title: 'Create a Plan', detail: 'Go to Travel Seating. Click "New Plan". Name it (e.g., "70-Seater Coach"), set the number of rows and columns, then define each cell as a seat, aisle, or blocked.' },
      { title: 'Label Seats', detail: 'Each seat gets a label (e.g., A1, A2, B1). Customers will select seats by these labels when booking.' },
      { title: 'Assign to Trips', detail: 'When creating a trip, you choose which seating plan to use. Different routes can use different vehicle types.' },
    ],
    tips: ['Mark aisles and blocked areas to create a realistic layout.', 'Common layouts: 4 columns for buses (2+aisle+2), 6 columns for coaches (3+aisle+3).'],
  },
  {
    id: 'timetable', title: 'Scheduling Trips', icon: Calendar,
    description: 'Create individual trips with departure times, prices, and seat availability.',
    steps: [
      { title: 'Create a Trip', detail: 'Go to Travel Timetable. Click "New Trip". Select a route, seating plan, departure date/time, arrival date/time, set the price per seat, and currency.' },
      { title: 'Available Seats', detail: 'The system automatically calculates available seats from the seating plan. As customers book, available seats decrease.' },
      { title: 'View All Trips', detail: 'The timetable shows all your upcoming and past trips. Filter by route or date to find specific trips quickly.' },
    ],
    tips: ['Set prices competitively — customers can compare across different agencies.', 'Schedule trips well in advance so customers can plan ahead.'],
  },
  {
    id: 'bookings', title: 'Managing Bookings', icon: Ticket,
    description: 'View, manage, and track all customer bookings for your services.',
    steps: [
      { title: 'View All Bookings', detail: 'Go to Bookings. You will see all bookings with reference numbers, route info, amount, and status. Use the search bar to find specific bookings by reference number.' },
      { title: 'Filter by Status', detail: 'Use the status dropdown to filter: All, Confirmed, or Cancelled. This helps you quickly find active or problem bookings.' },
      { title: 'View Booking Details', detail: 'Click the eye icon on any booking to see full details including all passenger names, seat numbers, and ticket statuses.' },
      { title: 'Cancel a Booking', detail: 'Click the X icon on a confirmed booking to cancel it. This marks all tickets as cancelled and sets payment status to refunded.' },
    ],
    tips: ['Revenue and passenger count stats update in real-time at the top of the bookings page.', 'Cancelled bookings free up the seats for other customers.'],
  },
  {
    id: 'counter-booking', title: 'Counter Bookings (Cash)', icon: ShoppingCart, badge: 'New',
    description: 'Book tickets on behalf of walk-in customers who pay with cash at your counter.',
    steps: [
      { title: 'Open Counter Booking', detail: 'On the Bookings page, click the "Counter Booking" button. This opens the cash booking form where you can create a booking on behalf of a customer.' },
      { title: 'Select Trip & Seats', detail: 'Choose the trip from the dropdown (showing route and departure time). Then select available seats from the seat grid.' },
      { title: 'Enter Passenger Details', detail: 'For each seat, enter the passenger\'s full name. Optionally enter their phone number and link to an existing customer account by entering their email.' },
      { title: 'Complete Booking', detail: 'Click "Confirm Cash Booking". The system creates the booking with payment method "cash" and status "paid". If you linked a customer email, the ticket appears in their app automatically.' },
    ],
    tips: [
      'If the customer has an account, enter their registered email so the ticket shows in their booking history.',
      'Cash bookings appear in your normal bookings list with a "cash" payment badge.',
      'You can still cancel cash bookings the same way as online bookings.',
    ],
  },
  {
    id: 'scanner', title: 'Scanning Tickets', icon: ScanLine,
    description: 'Use the QR scanner to validate passenger tickets at boarding.',
    steps: [
      { title: 'Open the Scanner', detail: 'Go to Travel Scanner. This opens your device camera to scan QR codes on passenger tickets.' },
      { title: 'Scan a QR Code', detail: 'Point the camera at the passenger\'s ticket QR code. The system reads the code and checks it against the database.' },
      { title: 'Understand Results', detail: 'GREEN = Valid ticket (first scan). The ticket is marked as "used". YELLOW = Already used (previously scanned). RED = Invalid or cancelled ticket.' },
      { title: 'Manual Entry', detail: 'If the camera can\'t read a QR code, you can manually enter the ticket code in the text field and click "Verify".' },
    ],
    tips: ['Scan tickets as passengers board to prevent duplicate entries.', 'Ensure good lighting for fastest QR scanning.', 'Each ticket can only be used once — re-scanning shows "already used".'],
  },
  {
    id: 'customer-experience', title: 'What Customers See', icon: Users,
    description: 'Understand the customer journey so you can assist them or answer questions.',
    steps: [
      { title: 'Browse Categories', detail: 'Customers open the Travel section in their app and see the four categories (Bus, Tours, Airlines, Trains) with your agency listed under the relevant one.' },
      { title: 'Search Trips', detail: 'They filter by origin, destination, date, and time of day (morning, afternoon, evening). Available trips show the route, departure time, price, and available seats.' },
      { title: 'Book & Pay', detail: 'They select a trip, pick seats on the interactive seat map, enter passenger details, and pay via their wallet or linked payment method.' },
      { title: 'Receive E-Ticket', detail: 'After payment, an e-ticket with a QR code is generated. They can view it anytime in their booking history. Present the QR code at boarding for scanning.' },
    ],
    tips: ['If a customer calls about a booking, ask for their booking reference (starts with KOB-).', 'Customers can view all their past and upcoming bookings in the Booking History section of the app.'],
  },
];

const MerchantTravelGuide: React.FC = () => {
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/merchant/travel-services')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Travel Services Training Guide</h1>
          <p className="text-muted-foreground">Step-by-step guide for you and your staff</p>
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
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <current.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{current.title}</h2>
                    <p className="text-sm text-muted-foreground">{current.description}</p>
                  </div>
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

export default MerchantTravelGuide;
