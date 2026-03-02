import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Settings2, Plus, Trash2, GripVertical } from "lucide-react";

interface Props {
  businessId: string;
}

export default function TreasuryCategoryManager({ businessId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["treasury-categories", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("treasury_categories" as any)
        .select("*")
        .eq("business_id", businessId)
        .order("sort_order");
      return (data as any[]) || [];
    },
    enabled: !!businessId,
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("treasury_categories" as any).insert({
        business_id: businessId,
        name,
        sort_order: categories.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-categories"] });
      setNewName("");
      toast({ title: "Categoría agregada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("treasury_categories" as any)
        .update({ name } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-categories"] });
      setEditingId(null);
      toast({ title: "Categoría actualizada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("treasury_categories" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["treasury-categories"] });
      toast({ title: "Categoría eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Categorías de movimientos</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder="Nueva categoría..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) addMutation.mutate(newName.trim());
              }}
            />
            <Button
              size="icon"
              disabled={!newName.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate(newName.trim())}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cargando...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin categorías. Agrega una.</p>
          ) : (
            <div className="space-y-1">
              {categories.map((cat: any) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                  {editingId === cat.id ? (
                    <Input
                      className="h-8 text-sm flex-1"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => {
                        if (editName.trim() && editName !== cat.name) {
                          updateMutation.mutate({ id: cat.id, name: editName.trim() });
                        } else {
                          setEditingId(null);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim()) {
                          updateMutation.mutate({ id: cat.id, name: editName.trim() });
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <span
                      className="text-sm flex-1 cursor-pointer"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditName(cat.name);
                      }}
                    >
                      {cat.name}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteMutation.mutate(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
