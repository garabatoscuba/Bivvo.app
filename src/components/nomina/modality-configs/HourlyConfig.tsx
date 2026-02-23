import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PresetManager, { Preset } from './PresetManager';

interface HourlyConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const HourlyConfig = ({ presets, onPresetsChange }: HourlyConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Pago según horas trabajadas. Se calcula automáticamente con las jornadas registradas.
        </p>
      </div>

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ hourly_rate: 0 }}
        renderPresetConfig={(preset, update) => (
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Tarifa/hora:</Label>
            <span className="text-xs text-muted-foreground">$</span>
            <Input type="number" min={0} value={preset.config.hourly_rate ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, hourly_rate: parseFloat(e.target.value) || 0 } })} className="w-24 h-7 text-xs text-center" />
          </div>
        )}
      />
    </div>
  );
};

export default HourlyConfig;
