import { useState } from 'react';
import { useActiveSheets, useSheetHistory, useOpenSheet, useCloseSheet, useRawMaterials, usePrintMaterialTypes } from '@/hooks/usePrintData';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, AlertTriangle, Loader2, History } from 'lucide-react';
import { format } from 'date-fns';

const ActiveSheetsSection = () => {
  const { profile } = useAuth();
  const { data: materials = [] } = useRawMaterials();
  const { data: materialTypes = [] } = usePrintMaterialTypes();
  const { data: activeSheets = [], isLoading } = useActiveSheets();
  const { data: sheetHistory = [] } = useSheetHistory();
  const openSheet = useOpenSheet();
  const closeSheet = useCloseSheet();

  const [openDialog, setOpenDialog] = useState(false);
  const [form, setForm] = useState({ material_id: '', tramos_total: 4 });

  // Materials whose type has permite_tramos = true
  const tramoMaterials = materials.filter((m: any) => {
    const mt = materialTypes.find((t: any) => t.id === m.material_type_id);
    return mt?.permite_tramos === true;
  });

  if (tramoMaterials.length === 0) return null;

  const getMatName = (matId: string) => materials.find((m: any) => m.id === matId)?.name || '—';

  const handleOpen = () => {
    if (!profile?.user_id) return;
    openSheet.mutate(
      { material_id: form.material_id, tramos_total: form.tramos_total, user_id: profile.user_id },
      { onSuccess: () => { setOpenDialog(false); setForm({ material_id: '', tramos_total: 4 }); } }
    );
  };

  // Which tramo materials have no active sheet
  const materialsWithoutSheet = tramoMaterials.filter(
    (m: any) => !activeSheets.find((s: any) => s.material_id === m.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Hojas activas (tramos)
        </h3>
        {materialsWithoutSheet.length > 0 && (
          <Button size="sm" onClick={() => setOpenDialog(true)}>
            Abrir hoja
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Active sheets */}
          {activeSheets.length === 0 && materialsWithoutSheet.length > 0 && (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-warning" />
                No hay hojas abiertas. Abre una hoja para comenzar a vender tramos.
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {activeSheets.map((sheet: any) => {
              const remaining = sheet.tramos_total - sheet.tramos_usados;
              const pct = (sheet.tramos_usados / sheet.tramos_total) * 100;
              const isLow = remaining <= 1 && remaining > 0;
              const isExhausted = remaining <= 0;
              return (
                <Card key={sheet.id} className={isExhausted ? 'border-destructive/50' : isLow ? 'border-warning/50' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      {getMatName(sheet.material_id)}
                      {isExhausted ? (
                        <Badge variant="destructive">Agotada</Badge>
                      ) : isLow ? (
                        <Badge variant="outline" className="text-warning border-warning">Último tramo</Badge>
                      ) : (
                        <Badge variant="secondary">Activa</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Usados: {sheet.tramos_usados}/{sheet.tramos_total}</span>
                      <span>Restantes: {Math.max(0, remaining)}</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                    {isExhausted && (
                      <p className="text-xs text-destructive font-medium mt-1">
                        ¡Abre una nueva hoja para seguir vendiendo!
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-1 text-xs"
                      onClick={() => closeSheet.mutate(sheet.id)}
                      disabled={closeSheet.isPending}
                    >
                      Cerrar hoja
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* History */}
          {sheetHistory.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                <History className="h-4 w-4" />
                Historial de hojas cerradas
              </h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Tramos</TableHead>
                      <TableHead className="text-right">Usados</TableHead>
                      <TableHead>Abierta</TableHead>
                      <TableHead>Cerrada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheetHistory.map((h: any) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-sm">{getMatName(h.material_id)}</TableCell>
                        <TableCell className="text-right">{h.tramos_total}</TableCell>
                        <TableCell className="text-right">{h.tramos_usados}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), 'dd/MM HH:mm')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {h.closed_at ? format(new Date(h.closed_at), 'dd/MM HH:mm') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Open sheet dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Abrir hoja nueva</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Select value={form.material_id} onValueChange={v => setForm(f => ({ ...f, material_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {materialsWithoutSheet.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} (Vendedor: {m.stock_vendedor})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>¿Cuántos tramos tiene esta hoja?</Label>
              <Input
                type="number"
                min={1}
                value={form.tramos_total}
                onChange={e => setForm(f => ({ ...f, tramos_total: parseInt(e.target.value) || 1 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Se descontará 1 unidad del stock del vendedor.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleOpen}
              disabled={!form.material_id || form.tramos_total < 1 || openSheet.isPending}
            >
              {openSheet.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Abrir hoja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActiveSheetsSection;
