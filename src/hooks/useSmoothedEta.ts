import { useEffect, useRef, useState } from "react";

interface Point { lat: number; lng: number; ts?: number }

function haversineKm(a: Point, b: Point) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lng - a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Debounces noisy GPS pings (drivers stream every 5-15s) and exposes a
 * smoothed ETA recomputed at a stable cadence so customer trackers don't
 * jitter on every update.
 */
export function useSmoothedEta(opts: {
  driver: Point | null;
  destination: Point | null;
  /** Debounce window in ms before applying a new location to ETA math. */
  debounceMs?: number;
  /** Average driving speed in km/h (urban Cameroon ~ 22). */
  avgSpeedKmh?: number;
  /** EMA smoothing factor: lower = smoother. */
  smoothing?: number;
}) {
  const { driver, destination, debounceMs = 4000, avgSpeedKmh = 22, smoothing = 0.35 } = opts;
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const lastApplied = useRef<Point | null>(null);

  useEffect(() => {
    if (!driver || !destination) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      // Skip recompute if driver hasn't moved >25m to avoid GPS noise
      if (lastApplied.current) {
        const moved = haversineKm(lastApplied.current, driver) * 1000;
        if (moved < 25) return;
      }
      lastApplied.current = driver;
      const km = haversineKm(driver, destination);
      const rawMin = (km / avgSpeedKmh) * 60;
      setDistanceKm((prev) => prev == null ? Math.round(km * 10) / 10 : Math.round((prev + smoothing * (km - prev)) * 10) / 10);
      setEtaMin((prev) => {
        const next = prev == null ? rawMin : prev + smoothing * (rawMin - prev);
        return Math.max(1, Math.round(next));
      });
    }, debounceMs);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [driver?.lat, driver?.lng, destination?.lat, destination?.lng, debounceMs, avgSpeedKmh, smoothing]);

  return { etaMin, distanceKm };
}
