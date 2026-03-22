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
    color: '#003087',
    fg: '#ffffff',
    headerBg: '#003087',
    lightBg: '#f0f3f8',
    accentLight: '#d6e0f0',
    accentText: '#003087',
    buttonBg: '#c8102e',
    buttonFg: '#ffffff',
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
    buttonBg: '#f5b800',
    buttonFg: '#1a1a1a',
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
    buttonBg: '#0770E3',
    buttonFg: '#ffffff',
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
    buttonBg: '#00857C',
    buttonFg: '#ffffff',
  },
};

export function getTheme(category?: string): TravelTheme {
  return travelThemes[category || 'bus'] || travelThemes.bus;
}
