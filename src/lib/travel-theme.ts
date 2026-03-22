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
    color: '#1e3a5f',
    fg: '#ffffff',
    headerBg: '#1e3a5f',
    lightBg: '#f0f4f8',
    accentLight: '#dce6f0',
    accentText: '#1e3a5f',
  },
  tours: {
    label: 'Tours & Excursions',
    icon: Compass,
    color: '#1a5632',
    fg: '#ffffff',
    headerBg: '#1a5632',
    lightBg: '#f0f7f2',
    accentLight: '#d4edda',
    accentText: '#1a5632',
  },
  airlines: {
    label: 'Airlines',
    icon: Plane,
    color: '#7c2d12',
    fg: '#ffffff',
    headerBg: '#7c2d12',
    lightBg: '#fdf5f0',
    accentLight: '#f5ddd0',
    accentText: '#7c2d12',
  },
  trains: {
    label: 'Trains',
    icon: Train,
    color: '#2d2d3f',
    fg: '#ffffff',
    headerBg: '#2d2d3f',
    lightBg: '#f3f3f6',
    accentLight: '#e0e0e8',
    accentText: '#2d2d3f',
  },
};

export function getTheme(category?: string): TravelTheme {
  return travelThemes[category || 'bus'] || travelThemes.bus;
}
