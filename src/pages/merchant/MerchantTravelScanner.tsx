import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  QrCode, Loader2, CheckCircle, XCircle, AlertTriangle, User,
  MapPin, Calendar, Clock, RotateCcw, ScanLine, Hash, Phone, Armchair
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TicketData {
  id: string;
  booking_id: string;
  passenger_name: string;
  passenger_phone: string | null;
  passenger_gender: string | null;
  seat_label: string;
  qr_code: string;
  ticket_status: string;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
}

interface ScanResult {
  ticket: TicketData;
  booking: { id: string; booking_ref: string; trip_id: string; total_amount: number; currency: string } | null;
  trip: { id: string; departure_at: string; vehicle_info: string | null; route_id: string } | null;
  route: { id: string; origin: string; destination: string } | null;
  message: string;
  scannedAt: string;
}

interface ScanStats {
  total: number;
  valid: number;
  alreadyUsed: number;
  invalid: number;
}

const MerchantTravelScanner: React.FC = () => {
  const [qrCode, setQrCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resultType, setResultType] = useState<'success' | 'error' | 'warning' | null>(null);
  const [recentScans, setRecentScans] = useState<Array<ScanResult & { type: 'success' | 'error' | 'warning' }>>([]);
  const [stats, setStats] = useState<ScanStats>({ total: 0, valid: 0, alreadyUsed: 0, invalid: 0 });
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  // Check that the user is a merchant owner or staff with scanner permission
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setPermissionChecked(true); return; }

        // Check merchant owner
        const { data: merchant } = await supabase
          .from('gateway_merchants')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        if (merchant) {
          setMerchantId(merchant.id);
          setHasPermission(true);
          setPermissionChecked(true);
          return;
        }

        // Check merchant staff with scanner permission
        const { data: staffRole } = await supabase
          .from('merchant_staff_roles')
          .select('id, merchant_id, permissions')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (staffRole) {
          const perms = (staffRole.permissions as Record<string, boolean>) || {};
          if (perms.scanner || perms.all) {
            setMerchantId(staffRole.merchant_id);
            setHasPermission(true);
          }
        }
      } catch (err) {
        console.error('Scanner permission check failed:', err);
      } finally {
        setPermissionChecked(true);
      }
    };
    checkAccess();
  }, []);

  const updateStats = useCallback((type: 'success' | 'error' | 'warning') => {
    setStats(prev => ({
      total: prev.total + 1,
      valid: type === 'success' ? prev.valid + 1 : prev.valid,
      alreadyUsed: type === 'warning' ? prev.alreadyUsed + 1 : prev.alreadyUsed,
      invalid: type === 'error' ? prev.invalid + 1 : prev.invalid,
    }));
  }, []);

  const validateTicket = async () => {
    const code = qrCode.trim();
    if (!code) { toast.error('Enter a QR code or ticket ID'); return; }

    setValidating(true);
    setResult(null);
    setResultType(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Not authenticated'); return; }

      // 1) Find ticket by QR code
      const { data: ticket, error: ticketError } = await supabase
        .from('travel_tickets')
        .select('*')
        .eq('qr_code', code)
        .maybeSingle();

      if (ticketError) throw ticketError;

      if (!ticket) {
        const failResult = { message: 'Ticket not found. Invalid QR code.' } as any;
        setResult(failResult);
        setResultType('error');
        updateStats('error');
        return;
      }

      const typedTicket = ticket as TicketData;

      // 2) Check ticket status
      if (typedTicket.ticket_status === 'cancelled') {
        setResult({ ticket: typedTicket, booking: null, trip: null, route: null, message: 'This ticket has been cancelled.', scannedAt: new Date().toISOString() });
        setResultType('error');
        updateStats('error');
        return;
      }

      if (typedTicket.ticket_status === 'used') {
        const validatedAt = typedTicket.validated_at ? format(new Date(typedTicket.validated_at), 'PPp') : 'Unknown time';
        setResult({ ticket: typedTicket, booking: null, trip: null, route: null, message: `Ticket already used on ${validatedAt}`, scannedAt: new Date().toISOString() });
        setResultType('warning');
        updateStats('warning');
        return;
      }

      // 3) Get booking info
      const { data: booking } = await supabase
        .from('travel_bookings')
        .select('id, booking_ref, trip_id, total_amount, currency')
        .eq('id', typedTicket.booking_id)
        .maybeSingle();

      // 4) Get trip & route in parallel
      let trip: any = null;
      let route: any = null;

      if (booking) {
        const [tripResult, routeViaBooking] = await Promise.all([
          supabase.from('travel_trips').select('id, departure_at, vehicle_info, route_id, merchant_id').eq('id', booking.trip_id).maybeSingle(),
          null, // placeholder
        ]);
        trip = tripResult.data;

        // 5) SECURITY: Verify this ticket belongs to the current merchant
        if (trip && merchantId && trip.merchant_id !== merchantId) {
          setResult({ ticket: typedTicket, booking: null, trip: null, route: null, message: 'This ticket does not belong to your services.', scannedAt: new Date().toISOString() });
          setResultType('error');
          updateStats('error');
          return;
        }

        if (trip) {
          const { data: routeData } = await supabase
            .from('travel_routes')
            .select('id, origin, destination')
            .eq('id', trip.route_id)
            .maybeSingle();
          route = routeData;
        }
      }

      // 6) Mark ticket as used
      const { error: updateError } = await supabase
        .from('travel_tickets')
        .update({
          ticket_status: 'used',
          validated_at: new Date().toISOString(),
          validated_by: user.id,
        })
        .eq('id', typedTicket.id);

      if (updateError) throw updateError;

      const scanResult: ScanResult = {
        ticket: typedTicket,
        booking,
        trip,
        route,
        message: 'Ticket validated successfully!',
        scannedAt: new Date().toISOString(),
      };

      setResult(scanResult);
      setResultType('success');
      updateStats('success');
      setRecentScans(prev => [{ ...scanResult, type: 'success' as const }, ...prev.slice(0, 19)]);
      toast.success('Ticket validated!');
      setQrCode('');
    } catch (err: any) {
      console.error('Ticket validation error:', err);
      toast.error(err.message || 'Validation failed. Please try again.');
      setResult({ message: err.message || 'An unexpected error occurred.' } as any);
      setResultType('error');
      updateStats('error');
    } finally {
      setValidating(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setResultType(null);
    setQrCode('');
  };

  // Permission gate
  if (!permissionChecked) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
        <XCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground max-w-md">
          You do not have permission to use the ticket scanner. Contact your merchant administrator to request scanner access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Scanner</h1>
          <p className="text-muted-foreground text-sm">Validate customer e-tickets by entering QR codes</p>
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <Badge variant="secondary" className="gap-1.5">
              <ScanLine className="h-3 w-3" />
              {stats.total} scanned
            </Badge>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20 gap-1.5">
              <CheckCircle className="h-3 w-3" />
              {stats.valid} valid
            </Badge>
            {stats.alreadyUsed > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-300 gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {stats.alreadyUsed} reused
              </Badge>
            )}
            {stats.invalid > 0 && (
              <Badge variant="destructive" className="gap-1.5">
                <XCircle className="h-3 w-3" />
                {stats.invalid} invalid
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-primary" />
              Validate Ticket
            </CardTitle>
            <CardDescription>Enter the QR code value from the customer's e-ticket or scan with a USB barcode reader</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-input">QR Code / Ticket ID</Label>
              <Input
                id="qr-input"
                placeholder="Scan or paste ticket QR code..."
                value={qrCode}
                onChange={e => setQrCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validateTicket()}
                autoFocus
                className="font-mono text-sm"
              />
            </div>
            <Button onClick={validateTicket} disabled={validating || !qrCode.trim()} className="w-full h-11">
              {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanLine className="mr-2 h-4 w-4" />}
              {validating ? 'Validating...' : 'Validate Ticket'}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Validation Result</CardTitle>
            {result && (
              <Button variant="ghost" size="sm" onClick={clearResult} className="h-8 text-xs gap-1.5">
                <RotateCcw className="h-3 w-3" />
                Clear
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <QrCode className="h-12 w-12 opacity-15" />
                <p className="text-sm">Scan a ticket to see results</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Status banner */}
                <div className={`flex items-center gap-3 rounded-lg p-4 ${
                  resultType === 'success' ? 'bg-primary/10 text-primary' :
                  resultType === 'warning' ? 'bg-accent text-accent-foreground' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {resultType === 'success' ? <CheckCircle className="h-6 w-6 shrink-0" /> :
                   resultType === 'warning' ? <AlertTriangle className="h-6 w-6 shrink-0" /> :
                   <XCircle className="h-6 w-6 shrink-0" />}
                  <p className="font-semibold text-sm">{result.message}</p>
                </div>

                {/* Ticket details */}
                {result.ticket && (
                  <div className="space-y-3">
                    <Separator />
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center gap-2.5">
                        <User className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold">{result.ticket.passenger_name}</span>
                        {result.ticket.passenger_gender && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{result.ticket.passenger_gender}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Armchair className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span>Seat <strong>{result.ticket.seat_label}</strong></span>
                      </div>
                      {result.ticket.passenger_phone && (
                        <div className="flex items-center gap-2.5">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{result.ticket.passenger_phone}</span>
                        </div>
                      )}
                      {result.route && (
                        <div className="flex items-center gap-2.5">
                          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{result.route.origin} → {result.route.destination}</span>
                        </div>
                      )}
                      {result.trip && (
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{format(new Date(result.trip.departure_at), 'PPp')}</span>
                        </div>
                      )}
                      {result.trip?.vehicle_info && (
                        <div className="flex items-center gap-2.5">
                          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{result.trip.vehicle_info}</span>
                        </div>
                      )}
                      {result.booking && (
                        <div className="flex items-center gap-2.5">
                          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Ref: <strong>{result.booking.booking_ref}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Scans ({recentScans.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setRecentScans([])} className="h-8 text-xs gap-1.5">
              <RotateCcw className="h-3 w-3" />
              Clear History
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.map((scan, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 text-sm">
                  {scan.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  ) : scan.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="font-medium">{scan.ticket?.passenger_name || 'Unknown'}</span>
                  <Badge variant="outline" className="text-[10px]">Seat {scan.ticket?.seat_label}</Badge>
                  {scan.route && (
                    <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                      {scan.route.origin} → {scan.route.destination}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(scan.scannedAt), 'HH:mm:ss')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MerchantTravelScanner;
