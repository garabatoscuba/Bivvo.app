import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getIconComponent } from '@/components/services/IconSelector';

interface ContextAction {
  id: string;
  label: string;
  icon: string;
  action_type: string;
  action_payload: any;
}

interface AssistantContextMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (type: 'gasto' | 'capital' | 'custom', payload?: any) => void;
  children: React.ReactNode;
}

export default function AssistantContextMenu({ open, onOpenChange, onAction, children }: AssistantContextMenuProps) {
  const [customActions, setCustomActions] = useState<ContextAction[]>([]);

  useEffect(() => {
    supabase
      .from('assistant_context_actions')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setCustomActions(data as unknown as ContextAction[]);
      });
  }, []);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={8} className="w-48 p-1.5">
        <button
          onClick={() => { onAction('gasto'); onOpenChange(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
        >
          <TrendingDown className="h-4 w-4 text-destructive" />
          +Gasto
        </button>
        <button
          onClick={() => { onAction('capital'); onOpenChange(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
        >
          <TrendingUp className="h-4 w-4 text-primary" />
          +Capital
        </button>
        {customActions.map((a) => {
          const Icon = getIconComponent(a.icon) || Zap;
          return (
            <button
              key={a.id}
              onClick={() => { onAction('custom', a.action_payload); onOpenChange(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-muted/60 transition-colors text-foreground"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {a.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
