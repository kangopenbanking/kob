import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface Props {
  driverLat?: number | null;
  driverLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropLat?: number | null;
  dropLng?: number | null;
}

/**
 * Lightweight live tracking map for Daily Needs deliveries.
 * Uses the Google Maps JS API (browser key from connector). Falls back to
 * a clean placeholder when the API key is not configured so the page never
 * breaks. Markers: pickup (merchant), drop (customer), driver (live).
 */
export function LiveDeliveryMap({ driverLat, driverLng, pickupLat, pickupLng, dropLat, dropLng }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const browserKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

  useEffect(() => {
    if (!browserKey || !ref.current) return;
    const win = window as any;

    const init = () => {
      if (!ref.current) return;
      const center = driverLat && driverLng
        ? { lat: Number(driverLat), lng: Number(driverLng) }
        : pickupLat && pickupLng
        ? { lat: Number(pickupLat), lng: Number(pickupLng) }
        : { lat: 4.0511, lng: 9.7679 }; // Douala fallback
      mapRef.current = new win.google.maps.Map(ref.current, {
        center, zoom: 14, disableDefaultUI: true, clickableIcons: false,
      });
      updateMarkers();
    };

    if (win.google?.maps) {
      init();
    } else if (!document.getElementById("ddn-gmaps")) {
      win.__ddnInitMap = init;
      const s = document.createElement("script");
      s.id = "ddn-gmaps";
      s.async = true;
      s.src = `https://maps.googleapis.com/maps/api/js?key=${browserKey}&loading=async&callback=__ddnInitMap${channel ? `&channel=${channel}` : ""}`;
      document.head.appendChild(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserKey]);

  const updateMarkers = () => {
    const map = mapRef.current; const win = window as any;
    if (!map || !win.google?.maps) return;
    const setMarker = (key: string, pos: { lat: number; lng: number } | null, label: string) => {
      if (!pos) { markersRef.current[key]?.setMap(null); delete markersRef.current[key]; return; }
      if (markersRef.current[key]) { markersRef.current[key].setPosition(pos); return; }
      markersRef.current[key] = new win.google.maps.Marker({ position: pos, map, label });
    };
    setMarker("pickup", pickupLat && pickupLng ? { lat: +pickupLat, lng: +pickupLng } : null, "P");
    setMarker("drop", dropLat && dropLng ? { lat: +dropLat, lng: +dropLng } : null, "D");
    setMarker("driver", driverLat && driverLng ? { lat: +driverLat, lng: +driverLng } : null, "•");
    if (driverLat && driverLng) map.panTo({ lat: +driverLat, lng: +driverLng });
  };

  useEffect(() => { updateMarkers(); }, [driverLat, driverLng, pickupLat, pickupLng, dropLat, dropLng]);

  if (!browserKey) {
    return (
      <Card className="h-64 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin className="size-6" />
        <p className="text-sm">Live map will appear here once your driver is on the move.</p>
      </Card>
    );
  }
  return <div ref={ref} className="h-64 w-full rounded-xl overflow-hidden border border-border" />;
}
