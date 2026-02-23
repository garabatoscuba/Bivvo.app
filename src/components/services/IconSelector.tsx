import { useState } from 'react';
import {
  Scissors, Wrench, Star, Heart, Dumbbell, Car, Camera, Music,
  Gamepad2, Monitor, Smartphone, Globe, DollarSign, Wifi, Coffee,
  Zap, ShoppingBag, Truck, Paintbrush, Headphones, BookOpen, Film,
  Home, Utensils, Shirt, Baby, Dog, Flower2, Sun, Moon,
  Bike, Plane, Phone, Tv, Printer, Key, Gift, Shield,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

const ICON_MAP: Record<string, LucideIcon> = {
  Scissors, Wrench, Star, Heart, Dumbbell, Car, Camera, Music,
  Gamepad2, Monitor, Smartphone, Globe, DollarSign, Wifi, Coffee,
  Zap, ShoppingBag, Truck, Paintbrush, Headphones, BookOpen, Film,
  Home, Utensils, Shirt, Baby, Dog, Flower2, Sun, Moon,
  Bike, Plane, Phone, Tv, Printer, Key, Gift, Shield,
};

export const getIconComponent = (name: string | null | undefined): LucideIcon => {
  if (!name) return DollarSign;
  return ICON_MAP[name] || DollarSign;
};

interface IconSelectorProps {
  value: string;
  onChange: (icon: string) => void;
}

const IconSelector = ({ value, onChange }: IconSelectorProps) => {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-2 block">Ícono</Label>
      <ScrollArea className="h-40 rounded-md border p-2">
        <div className="grid grid-cols-6 gap-1.5">
          {Object.entries(ICON_MAP).map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                value === name
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
              title={name}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default IconSelector;
