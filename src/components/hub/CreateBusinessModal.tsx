import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface CreateBusinessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCIES = [
  { code: "CUP", name: "Peso Cubano (CUP)" },
  { code: "USD", name: "Dólar (USD)" },
  { code: "EUR", name: "Euro (EUR)" },
  { code: "MXN", name: "Peso Mexicano (MXN)" },
  { code: "COP", name: "Peso Colombiano (COP)" },
  { code: "ARS", name: "Peso Argentino (ARS)" },
  { code: "BRL", name: "Real (BRL)" },
  { code: "GBP", name: "Libra (GBP)" },
];

const CreateBusinessModal = ({ open, onOpenChange }: CreateBusinessModalProps) => {
  const navigate = useNavigate();
  const { profile, switchBranch } = useAuth();
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("store");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("CUP");
  const [keywordsInput, setKeywordsInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const businessTypes = [
    { key: "Tienda", name: "Tienda" },
    { key: "Restaurante", name: "Restaurante" },
    { key: "Cafetería", name: "Cafetería" },
  ];


  const handleKeywordsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const val = keywordsInput.trim().replace(/,/g, "");
      if (val && !keywords.includes(val)) {
        setKeywords((prev) => [...prev, val]);
      }
      setKeywordsInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    if (!name.trim() || !profile?.id) return;
    setSaving(true);
    try {
      const keywordsStr = keywords.length > 0 ? keywords.join(", ") : null;

      // Create business
      const { data: newBiz, error: bizErr } = await supabase
        .from("businesses")
        .insert({
          name: name.trim(),
          business_type: businessType,
          base_currency: currency,
          keywords: keywordsStr,
          owner_id: profile.id,
        })
        .select("id")
        .single();

      if (bizErr || !newBiz) throw bizErr || new Error("No se pudo crear el negocio");

      // Create main branch with address
      const { data: newBranch, error: branchErr } = await supabase
        .from("branches")
        .insert({
          business_id: newBiz.id,
          name: "Principal",
          is_main: true,
          address: address.trim() || null,
        })
        .select("id")
        .single();

      if (branchErr || !newBranch) throw branchErr || new Error("No se pudo crear la sucursal");

      // Update profile to point to new business
      await supabase
        .from("profiles")
        .update({ business_id: newBiz.id, branch_id: newBranch.id })
        .eq("user_id", profile.user_id);

      await switchBranch(newBranch.id);

      toast.success("¡Negocio creado exitosamente!");
      onOpenChange(false);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Error al crear el negocio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="font-['Cormorant_Garamond'] text-[22px] font-medium">
            Crear negocio
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="biz-name" className="text-[13px]">
              Nombre del negocio <span className="text-destructive">*</span>
            </Label>
            <Input
              id="biz-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mi Tienda"
              autoFocus
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="biz-type" className="text-[13px]">Tipo de negocio</Label>
            <Input
              id="biz-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Ej: Barbería, Floristería, Taller..."
            />
            {businessTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground self-center">Sugerencias:</span>
                {businessTypes.map((bt) => (
                  <button
                    key={bt.key}
                    type="button"
                    onClick={() => setBusinessType(bt.key)}
                    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                      businessType === bt.key
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-muted"
                    }`}
                  >
                    {bt.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="biz-address" className="text-[13px]">
              Ciudad o dirección <span className="text-muted-foreground text-[11px]">(opcional)</span>
            </Label>
            <Input
              id="biz-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: La Habana, Cuba"
            />
          </div>

          {/* Currency */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Moneda principal</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Keywords */}
          <div className="space-y-1.5">
            <Label htmlFor="biz-keywords" className="text-[13px]">
              Palabras clave
            </Label>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-md border border-input bg-background">
              {keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="biz-keywords"
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                onKeyDown={handleKeywordsKeyDown}
                placeholder={keywords.length === 0 ? "Escribe y presiona coma o Enter" : ""}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Ayudan a otros usuarios a encontrar tu negocio en el directorio de Bivoo.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear negocio
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBusinessModal;
