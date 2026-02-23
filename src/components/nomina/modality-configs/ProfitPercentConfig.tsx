import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PresetManager, { Preset } from './PresetManager';

interface ProfitPercentConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const ProfitPercentConfig = ({ presets, onPresetsChange }: ProfitPercentConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Porcentaje sobre la ganancia neta del negocio (ventas - costos).
        </p>
      </div>

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ percent: 5 }}
        renderPresetConfig={(preset, update) => (
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">% sobre ganancia:</Label>
            <Input type="number" min={0} max={100} value={preset.config.percent ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, percent: parseFloat(e.target.value) || 0 } })} className="w-20 h-7 text-xs text-center" />
            <span className="text-xs font-medium">%</span>
          </div>
        )}
      />
    </div>
  );
};

export default ProfitPercentConfig;
