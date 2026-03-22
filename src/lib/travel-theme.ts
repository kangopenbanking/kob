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
  buttonBg: string;     // button background
  buttonFg: string;     // button text
}

export const travelThemes: Record<string, TravelTheme> = {
  bus: {
    label: 'Bus Travel',
    icon: Bus,
    color: '#c8102e',
    fg: '#ffffff',
    headerBg: '#c8102e',
    lightBg: '#fef2f2',
    accentLight: '#fcdada',
    accentText: '#9b1b30',
  },
  tours: {
    label: 'Tours & Excursions',
    icon: Compass,
    color: '#4a1a7a',
    fg: '#ffffff',
    headerBg: '#4a1a7a',
    lightBg: '#f6f0fc',
    accentLight: '#e8d5f5',
    accentText: '#4a1a7a',
  },
  airlines: {
    label: 'Airlines',
    icon: Plane,
    color: '#0770E3',
    fg: '#ffffff',
    headerBg: '#0770E3',
    lightBg: '#eef5fc',
    accentLight: '#cfe2f8',
    accentText: '#054da0',
  },
  trains: {
    label: 'Trains',
    icon: Train,
    color: '#00857C',
    fg: '#ffffff',
    headerBg: '#00857C',
    lightBg: '#f0f8f7',
    accentLight: '#ccece9',
    accentText: '#005c56',
  },
};

export function getTheme(category?: string): TravelTheme {
  return travelThemes[category || 'bus'] || travelThemes.bus;
}
