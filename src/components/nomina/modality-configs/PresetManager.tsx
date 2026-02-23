import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

export interface Preset {
  id: string;
  name: string;
  config: Record<string, any>;
}

interface PresetManagerProps {
  presets: Preset[];
  onChange: (presets: Preset[]) => void;
  renderPresetConfig: (preset: Preset, updatePreset: (updated: Preset) => void) => React.ReactNode;
  defaultConfig: Record<string, any>;
}

const PresetManager = ({ presets, onChange, renderPresetConfig, defaultConfig }: PresetManagerProps) => {
  const [newName, setNewName] = useState('');

  const addPreset = () => {
    if (!newName.trim()) return;
    const preset: Preset = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      config: { ...defaultConfig },
    };
    onChange([...presets, preset]);
    setNewName('');
  };

  const removePreset = (id: string) => {
    onChange(presets.filter(p => p.id !== id));
  };

  const updatePreset = (updated: Preset) => {
    onChange(presets.map(p => p.id === updated.id ? updated : p));
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Presets</Label>
      <p className="text-xs text-muted-foreground">
        Crea configuraciones predefinidas que puedes asignar a empleados individuales.
      </p>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Nombre del preset..."
          className="h-8 text-sm"
          onKeyDown={e => e.key === 'Enter' && addPreset()}
        />
        <Button size="sm" variant="outline" onClick={addPreset} disabled={!newName.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
        </Button>
      </div>

      {presets.map(preset => (
        <div key={preset.id} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">{preset.name}</Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePreset(preset.id)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          {renderPresetConfig(preset, updatePreset)}
        </div>
      ))}
    </div>
  );
};

export default PresetManager;
