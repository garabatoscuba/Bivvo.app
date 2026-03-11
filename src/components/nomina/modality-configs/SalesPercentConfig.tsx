import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import PresetManager, { Preset } from './PresetManager';

interface SalesPercentConfigProps {
  type: 'fixed_plus_sales_percent' | 'sales_percent_only';
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const SalesPercentConfig = ({ type, config, onConfigChange, presets, onPresetsChange }: SalesPercentConfigProps) => {
  const isFixedPlus = type === 'fixed_plus_sales_percent';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          {isFixedPlus
            ? 'Monto fijo que siempre se suma al salario más un porcentaje sobre las ventas del empleado. El fijo no es un piso, se acumula siempre.'
            : 'Sin salario fijo, solo un porcentaje de lo que vende el empleado.'}
        </p>
      </div>

      {/* Global default config */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Configuración por defecto</Label>
        {isFixedPlus && (
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Fijo:</Label>
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              min={0}
              value={config.base_salary ?? 0}
              onChange={e => onConfigChange({ ...config, base_salary: parseFloat(e.target.value) || 0 })}
              className="w-28 h-8 text-sm text-center"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">% sobre ventas:</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={config.sales_percent ?? config.percent ?? 0}
            onChange={e => onConfigChange({ ...config, sales_percent: parseFloat(e.target.value) || 0, percent: parseFloat(e.target.value) || 0 })}
            className="w-20 h-8 text-sm text-center"
          />
          <span className="text-sm font-medium">%</span>
        </div>
      </div>

      <Separator />

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={isFixedPlus ? { base_salary: 0, percent: 10 } : { percent: 15 }}
        renderPresetConfig={(preset, update) => (
          <div className="space-y-2">
            {isFixedPlus && (
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Base:</Label>
                <span className="text-xs text-muted-foreground">$</span>
                <Input type="number" min={0} value={preset.config.base_salary ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, base_salary: parseFloat(e.target.value) || 0 } })} className="w-24 h-7 text-xs text-center" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">% sobre ventas:</Label>
              <Input type="number" min={0} max={100} value={preset.config.percent ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, percent: parseFloat(e.target.value) || 0 } })} className="w-20 h-7 text-xs text-center" />
              <span className="text-xs font-medium">%</span>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default SalesPercentConfig;
