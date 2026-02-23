import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PresetManager, { Preset } from './PresetManager';

interface FixedConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const FixedConfig = (_props: FixedConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Salario fijo independiente de ventas. El monto se define directamente al asignar la modalidad al empleado desde Recursos Humanos.
        </p>
      </div>
    </div>
  );
};

export default FixedConfig;
