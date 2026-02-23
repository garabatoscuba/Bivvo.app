import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PresetManager, { Preset } from './PresetManager';

interface FixedConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const FixedConfig = ({ presets, onPresetsChange }: FixedConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Salario fijo independiente de ventas. El monto se define al asignar al empleado.
        </p>
      </div>

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ salary: 0 }}
        renderPresetConfig={(preset, update) => (
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Salario fijo:</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                value={preset.config.salary ?? 0}
                onChange={e => update({ ...preset, config: { ...preset.config, salary: parseFloat(e.target.value) || 0 } })}
                className="w-24 h-7 text-xs text-center"
              />
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default FixedConfig;
