import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import PresetManager, { Preset } from './PresetManager';

interface Goal {
  target: number;
  bonus: number;
}

const GoalsEditor = ({ goals, onChange }: { goals: Goal[]; onChange: (g: Goal[]) => void }) => {
  const addGoal = () => onChange([...goals, { target: 0, bonus: 0 }]);
  const removeGoal = (idx: number) => onChange(goals.filter((_, i) => i !== idx));
  const updateGoal = (idx: number, field: string, val: number) =>
    onChange(goals.map((g, i) => i === idx ? { ...g, [field]: val } : g));

  return (
    <div className="space-y-2">
      {goals.map((goal, idx) => (
        <div key={idx} className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">Meta $</span>
          <Input type="number" min={0} value={goal.target} onChange={e => updateGoal(idx, 'target', parseFloat(e.target.value) || 0)} className="w-20 h-7 text-xs text-center" />
          <span className="text-[10px] text-muted-foreground">→ Bono $</span>
          <Input type="number" min={0} value={goal.bonus} onChange={e => updateGoal(idx, 'bonus', parseFloat(e.target.value) || 0)} className="w-20 h-7 text-xs text-center" />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeGoal(idx)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="text-xs" onClick={addGoal}>
        <Plus className="h-3 w-3 mr-1" /> Agregar meta
      </Button>
    </div>
  );
};

interface GoalBonusConfigProps {
  presets: Preset[];
  onPresetsChange: (presets: Preset[]) => void;
}

const GoalBonusConfig = ({ presets, onPresetsChange }: GoalBonusConfigProps) => {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-3 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Salario base con bonos al cumplir metas de venta.
        </p>
      </div>

      <PresetManager
        presets={presets}
        onChange={onPresetsChange}
        defaultConfig={{ base_salary: 0, goals: [{ target: 5000, bonus: 500 }] }}
        renderPresetConfig={(preset, update) => (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Base:</Label>
              <span className="text-xs text-muted-foreground">$</span>
              <Input type="number" min={0} value={preset.config.base_salary ?? 0} onChange={e => update({ ...preset, config: { ...preset.config, base_salary: parseFloat(e.target.value) || 0 } })} className="w-24 h-7 text-xs text-center" />
            </div>
            <Label className="text-xs">Metas y bonos:</Label>
            <GoalsEditor goals={preset.config.goals || []} onChange={goals => update({ ...preset, config: { ...preset.config, goals } })} />
          </div>
        )}
      />
    </div>
  );
};

export default GoalBonusConfig;
