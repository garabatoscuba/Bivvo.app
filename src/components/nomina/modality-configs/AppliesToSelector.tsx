import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AppliesToSelectorProps {
  value: string;
  onChange: (val: string) => void;
}

const OPTIONS = [
  { value: 'services', label: 'Solo Servicios' },
  { value: 'products', label: 'Solo Productos' },
  { value: 'prints', label: 'Solo Impresiones' },
  { value: 'both', label: 'Servicios y Productos' },
  { value: 'services_prints', label: 'Servicios e Impresiones' },
  { value: 'products_prints', label: 'Productos e Impresiones' },
  { value: 'all', label: 'Todo (Servicios, Productos e Impresiones)' },
];

export const APPLIES_TO_LABELS: Record<string, string> = {
  services: 'Servicios',
  products: 'Productos',
  prints: 'Impresiones',
  both: 'Servicios y Productos',
  services_prints: 'Servicios e Impresiones',
  products_prints: 'Productos e Impresiones',
  all: 'Todo',
};

const AppliesToSelector = ({ value, onChange }: AppliesToSelectorProps) => (
  <div>
    <Label className="text-sm font-medium">Aplica a</Label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full mt-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground mt-1">
      Define si esta modalidad se calcula sobre servicios, productos, impresiones o combinaciones.
    </p>
  </div>
);

export default AppliesToSelector;
