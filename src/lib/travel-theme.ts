import { Bus, Compass, Plane, Train } from 'lucide-react';

export interface TravelTheme {
  label: string;
  icon: typeof Bus;
  color: string;       // solid background
  fg: string;           // text on color bg
  headerBg: string;     // header solid color (same as color)
  lightBg: string;      // light tint for page bg
  accentLight: string;  // light accent for chips/pills
  accentText: string;   // text on light accent
}

export const travelThemes: Record<string, TravelTheme> = {
  bus: {
    label: 'Bus Travel',
    icon: Bus,
    color: '#ffbe0b',
    fg: '#1a1a1a',
    headerBg: '#ffbe0b',
    lightBg: '#fffbeb',
    accentLight: '#fff3c4',
    accentText: '#92400e',
  },
  tours: {
    label: 'Tours & Excursions',
    icon: Compass,
    color: '#3a86ff',
    fg: '#ffffff',
    headerBg: '#3a86ff',
    lightBg: '#eff6ff',
    accentLight: '#dbeafe',
    accentText: '#1e40af',
  },
  airlines: {
    label: 'Airlines',
    icon: Plane,
    color: '#d00000',
    fg: '#ffffff',
    headerBg: '#d00000',
    lightBg: '#fef2f2',
    accentLight: '#fecaca',
    accentText: '#991b1b',
  },
  trains: {
    label: 'Trains',
    icon: Train,
    color: '#000000',
    fg: '#ffffff',
    headerBg: '#000000',
    lightBg: '#f5f5f5',
    accentLight: '#e5e5e5',
    accentText: '#262626',
  },
};

export function getTheme(category?: string): TravelTheme {
  return travelThemes[category || 'bus'] || travelThemes.bus;
}
