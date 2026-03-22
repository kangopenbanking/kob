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
    color: '#003087',
    fg: '#ffffff',
    headerBg: '#003087',
    lightBg: '#f0f3f8',
    accentLight: '#d6e0f0',
    accentText: '#003087',
  },
  tours: {
    label: 'Tours & Excursions',
    icon: Compass,
    color: '#1A2B49',
    fg: '#ffffff',
    headerBg: '#1A2B49',
    lightBg: '#f2f3f6',
    accentLight: '#dde0e8',
    accentText: '#1A2B49',
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
