import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QrCode, Loader2, CheckCircle, XCircle, AlertTriangle, User, MapPin, Calendar, Clock, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const MerchantTravelScanner: React.FC = () => {
  const [qrCode, setQrCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [resultType, setResultType] = useState<'success' | 'error' | 'warning' | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  const validateTicket = async () => {
    if (!qrCode.trim()) { toast.error('Enter a QR code'); return; }
    setValidating(true);
    setResult(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setValidating(false); return; }

    // Find ticket by QR code
    const { data: ticket, error } = await supabase
      .from('travel_tickets')
      .select('*')
      .eq('qr_code', qrCode.trim())
      .maybeSingle();

    if (error || !ticket) {
      setResult({ message: 'Ticket not found. Invalid QR code.' });
      setResultType('error');
      setValidating(false);
      return;
    }

    if ((ticket as any).ticket_status === 'used') {
      const validatedAt = (ticket as any).validated_at ? format(new Date((ticket as any).validated_at), 'PPp') : 'Unknown';
      setResult({ message: `Ticket already used on ${validatedAt}`, ticket });
      setResultType('warning');
      setValidating(false);
      return;
    }

    if ((ticket as any).ticket_status === 'cancelled') {
      setResult({ message: 'Ticket has been cancelled.', ticket });
      setResultType('error');
      setValidating(false);
      return;
    }

    // Get booking & trip info
    const { data: booking } = await supabase.from('travel_bookings').select('*').eq('id', (ticket as any).booking_id).maybeSingle();
    const trip = booking ? (await supabase.from('travel_trips').select('*').eq('id', (booking as any).trip_id).maybeSingle()).data : null;
    const route = trip ? (await supabase.from('travel_routes').select('*').eq('id', (trip as any).route_id).maybeSingle()).data : null;

    // Mark as used
    await supabase.from('travel_tickets').update({
      ticket_status: 'used',
      validated_at: new Date().toISOString(),
      validated_by: user.id,
    } as any).eq('id', (ticket as any).id);

    const scanResult = { ticket, booking, trip, route, message: 'Ticket validated successfully!' };
    setResult(scanResult);
    setResultType('success');
    setRecentScans(prev => [scanResult, ...prev.slice(0, 9)]);
    toast.success('Ticket validated! ✅');
    setQrCode('');
    setValidating(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ticket Scanner</h1>
        <p className="text-muted-foreground">Validate customer e-tickets by entering or scanning QR codes</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Scanner Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Validate Ticket</CardTitle>
            <CardDescription>Enter the QR code value from the customer's e-ticket</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>QR Code / Ticket ID</Label>
              <Input
                placeholder="e.g. a1b2c3d4-e5f6-7890-..."
                value={qrCode}
                onChange={e => setQrCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validateTicket()}
              />
            </div>
            <Button onClick={validateTicket} disabled={validating || !qrCode.trim()} className="w-full">
              {validating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Validate Ticket
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>Validation Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                <QrCode className="h-12 w-12 opacity-20" />
                <p>Scan a ticket to see results</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 rounded-lg p-4 ${
                  resultType === 'success' ? 'bg-[hsl(150,40%,90%)] text-[hsl(150,40%,25%)]' :
                  resultType === 'warning' ? 'bg-[hsl(48,90%,90%)] text-[hsl(48,90%,25%)]' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {resultType === 'success' ? <CheckCircle className="h-6 w-6" /> :
                   resultType === 'warning' ? <AlertTriangle className="h-6 w-6" /> :
                   <XCircle className="h-6 w-6" />}
                  <p className="font-semibold">{result.message}</p>
                </div>

                {result.ticket && (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /><span className="font-semibold">{result.ticket.passenger_name}</span><Badge variant="outline">Seat {result.ticket.seat_label}</Badge></div>
                    {result.route && (
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{result.route.origin} → {result.route.destination}</span></div>
                    )}
                    {result.trip && (
                      <>
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(new Date(result.trip.departure_at), 'PPp')}</span></div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span>{result.trip.vehicle_info || 'N/A'}</span></div>
                      </>
                    )}
                    {result.booking && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">Ref: {result.booking.booking_ref}</div>
                    )}
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
          <CardHeader><CardTitle>Recent Scans</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentScans.map((scan, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <CheckCircle className="h-4 w-4 text-[hsl(150,40%,45%)]" />
                  <span className="font-semibold text-sm">{scan.ticket?.passenger_name}</span>
                  <span className="text-sm text-muted-foreground">Seat {scan.ticket?.seat_label}</span>
                  {scan.route && <span className="text-xs text-muted-foreground ml-auto">{scan.route.origin} → {scan.route.destination}</span>}
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
