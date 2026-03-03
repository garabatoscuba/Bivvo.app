import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import PresetManager, { Preset } from './PresetManager';

interface ProfitPercentConfigProps {
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const ProfitPercentConfig = ({ config, onConfigChange, presets, onPresetsChange }: ProfitPercentConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Porcentaje sobre la ganancia neta (ventas - costos). El % se calcula en tiempo real y el monto final se consolida al cerrar la jornada.
        </p>
      </div>

      {/* Global default config */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Configuración por defecto</Label>
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">% sobre ganancia:</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={config.profit_percent ?? config.percent ?? 0}
            onChange={e => onConfigChange({ ...config, profit_percent: parseFloat(e.target.value) || 0, percent: parseFloat(e.target.value) || 0 })}
            className="w-20 h-8 text-sm text-center"
          />
          <span className="text-sm font-medium">%</span>
        </div>
      </div>

      <Separator />

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
