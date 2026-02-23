import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users } from 'lucide-react';
import PresetManager, { type Preset } from './PresetManager';

interface Condition {
  positions: number;
  service_percent: number;
}

interface CustomMixedConfigProps {
  totalPositions: number;
  conditions: Condition[];
  onTotalPositionsChange: (val: number) => void;
  onConditionsChange: (conditions: Condition[]) => void;
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const CustomMixedConfig = ({ totalPositions, conditions, onTotalPositionsChange, onConditionsChange, presets, onPresetsChange }: CustomMixedConfigProps) => {

  const handlePositionsChange = (val: number) => {
    const n = Math.max(1, Math.min(20, val));
    onTotalPositionsChange(n);
    const newConditions: Condition[] = [];
    for (let i = n; i >= 1; i--) {
      const existing = conditions.find(c => c.positions === i);
      newConditions.push({ positions: i, service_percent: existing?.service_percent ?? 10 });
    }
    onConditionsChange(newConditions);
  };

  const handlePercentChange = (positions: number, percent: number) => {
    onConditionsChange(
      conditions.map(c =>
        c.positions === positions ? { ...c, service_percent: Math.max(0, Math.min(100, percent)) } : c
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Se destina un % de la venta a cada trabajador activo. El % define lo que gana <strong>cada uno</strong>, y el total destinado a salarios es ese % × la cantidad de trabajadores.
        </p>
      </div>

      <div>
        <Label className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Cantidad máxima de puestos
        </Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={totalPositions}
          onChange={e => handlePositionsChange(parseInt(e.target.value) || 1)}
          className="w-32 mt-1"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Condiciones por trabajadores activos</Label>
        <p className="text-xs text-muted-foreground">
          Define el % que gana <strong>cada trabajador</strong> según cuántos estén activos en la jornada. El total destinado a salarios será ese % × cantidad de trabajadores.
        </p>
        {conditions
          .sort((a, b) => b.positions - a.positions)
          .map(cond => {
            const totalPercent = cond.service_percent * cond.positions;
            return (
              <div key={cond.positions} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {cond.positions === 1
                      ? '1 trabajador activo'
                      : `${cond.positions} trabajadores activos`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cada uno gana {cond.service_percent}% → Total: {totalPercent}% de las ventas
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={cond.service_percent}
                    onChange={e => handlePercentChange(cond.positions, parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 text-center text-sm"
                  />
                  <span className="text-sm font-medium">%</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Presets */}
      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ service_percent_override: null }}
        renderPresetConfig={(preset, updatePreset) => (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              % personalizado para este preset (deja vacío para usar el de la condición general)
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={preset.config.service_percent_override ?? ''}
                onChange={e => {
                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                  updatePreset({ ...preset, config: { ...preset.config, service_percent_override: val } });
                }}
                placeholder="Usar condición general"
                className="w-40 h-8 text-sm"
              />
              <span className="text-sm">%</span>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default CustomMixedConfig;
