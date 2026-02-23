import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import PresetManager, { Preset } from './PresetManager';

interface LadderStep {
  min_sales: number;
  max_sales: number | null;
  salary: number;
}

interface FixedLadderConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const StepEditor = ({ steps, onChange }: { steps: LadderStep[]; onChange: (s: LadderStep[]) => void }) => {
  const addStep = () => {
    const lastMax = steps.length > 0 ? (steps[steps.length - 1].max_sales ?? 0) : 0;
    onChange([...steps, { min_sales: lastMax, max_sales: null, salary: 0 }]);
  };

  const updateStep = (idx: number, field: string, val: number | null) => {
    onChange(steps.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">De $</span>
          <Input type="number" min={0} value={step.min_sales} onChange={e => updateStep(idx, 'min_sales', parseFloat(e.target.value) || 0)} className="w-20 h-7 text-xs text-center" />
          <span className="text-[10px] text-muted-foreground">a $</span>
          <Input type="number" min={0} value={step.max_sales ?? ''} onChange={e => updateStep(idx, 'max_sales', e.target.value ? parseFloat(e.target.value) : null)} placeholder="∞" className="w-20 h-7 text-xs text-center" />
          <span className="text-[10px] text-muted-foreground">→ $</span>
          <Input type="number" min={0} value={step.salary} onChange={e => updateStep(idx, 'salary', parseFloat(e.target.value) || 0)} className="w-20 h-7 text-xs text-center" />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStep(idx)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="text-xs" onClick={addStep}>
        <Plus className="h-3 w-3 mr-1" /> Agregar rango
      </Button>
    </div>
  );
};

const FixedLadderConfig = ({ presets, onPresetsChange }: FixedLadderConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Salario base que sube según rangos de venta. Define escalones con monto mínimo, máximo y salario correspondiente.
        </p>
      </div>

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ base_salary: 0, steps: [{ min_sales: 0, max_sales: 1000, salary: 500 }] }}
        renderPresetConfig={(preset, update) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Base:</Label>
              <span className="text-xs text-muted-foreground">$</span>
              <Input type="number" min={0} value={preset.config.base_salary ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, base_salary: parseFloat(e.target.value) || 0 } })} className="w-24 h-7 text-xs text-center" />
            </div>
            <Label className="text-xs">Escalones:</Label>
            <StepEditor steps={preset.config.steps || []} onChange={steps => update({ ...preset, config: { ...preset.config, steps } })} />
          </div>
        )}
      />
    </div>
  );
};

export default FixedLadderConfig;
