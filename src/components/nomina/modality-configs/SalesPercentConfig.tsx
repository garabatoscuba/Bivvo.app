import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PresetManager, { Preset } from './PresetManager';

interface SalesPercentConfigProps {
  type: 'fixed_plus_sales_percent' | 'sales_percent_only';
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const SalesPercentConfig = ({ type, presets, onPresetsChange }: SalesPercentConfigProps) => {
  const isFixedPlus = type === 'fixed_plus_sales_percent';

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          {isFixedPlus
            ? 'Salario base más un porcentaje sobre las ventas del empleado.'
            : 'Sin salario fijo, solo un porcentaje de lo que vende el empleado.'}
        </p>
      </div>

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
