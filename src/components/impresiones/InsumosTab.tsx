import { useState } from 'react';
import {
  useRawMaterials,
  usePrintMaterialTypes,
  useSaveRawMaterial,
  useCreateMaterialEntry,
  useCreateMaterialTransfer,
  useEmployeesForTransfer,
} from '@/hooks/usePrintData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, PackagePlus, Send, Loader2, AlertTriangle, Pencil } from 'lucide-react';
import ActiveSheetsSection from './ActiveSheetsSection';

const InsumosTab = () => {
  const { data: materials = [], isLoading } = useRawMaterials();
  const { data: materialTypes = [] } = usePrintMaterialTypes();
  const { data: employees = [] } = useEmployeesForTransfer();
  const saveMaterial = useSaveRawMaterial();
  const createEntry = useCreateMaterialEntry();
  const createTransfer = useCreateMaterialTransfer();
  const { profile } = useAuth();

  // New material dialog
  const [newOpen, setNewOpen] = useState(false);
  const [matForm, setMatForm] = useState({ name: '', material_type_id: '', stock_minimo: 0, porcentaje_tinta: 0 });

  // Entry dialog
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({ material_id: '', cantidad: 0, costo_unitario: 0, nota: '' });

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ material_id: '', cantidad: 0, to_user_id: '', nota: '' });

  const handleSaveMaterial = () => {
    saveMaterial.mutate(matForm, {
      onSuccess: () => {
        setNewOpen(false);
        setMatForm({ name: '', material_type_id: '', stock_minimo: 0, porcentaje_tinta: 0 });
      },
    });
  };

  const handleEntry = () => {
    if (!profile?.user_id) return;
    createEntry.mutate({ ...entryForm, user_id: profile.user_id }, {
      onSuccess: () => {
        setEntryOpen(false);
        setEntryForm({ material_id: '', cantidad: 0, costo_unitario: 0, nota: '' });
      },
    });
  };

  const handleTransfer = () => {
    if (!profile?.user_id) return;
    createTransfer.mutate({ ...transferForm, from_user_id: profile.user_id }, {
      onSuccess: () => {
        setTransferOpen(false);
        setTransferForm({ material_id: '', cantidad: 0, to_user_id: '', nota: '' });
      },
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Active Sheets Section */}
      <ActiveSheetsSection />

      <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Insumos</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEntryOpen(true)}><PackagePlus className="h-4 w-4 mr-1" />Dar entrada</Button>
          <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}><Send className="h-4 w-4 mr-1" />Entregar a vendedor</Button>
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />Nuevo insumo</Button>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Almacén</TableHead>
              <TableHead className="text-right">Vendedor</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="text-right">% Tinta</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin insumos registrados</TableCell></TableRow>
            ) : materials.map((m: any) => {
              const lowStock = m.stock_almacen < m.stock_minimo;
              return (
                <TableRow key={m.id} className={lowStock ? 'bg-destructive/5' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {m.name}
                      {lowStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
                    </div>
                    {m.print_material_types?.name && (
                      <span className="text-xs text-muted-foreground">{m.print_material_types.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={lowStock ? 'destructive' : 'secondary'}>{m.stock_almacen}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{m.stock_vendedor}</TableCell>
                  <TableCell className="text-right">{m.stock_minimo}</TableCell>
                  <TableCell className="text-right">${m.costo_unitario}</TableCell>
                  <TableCell className="text-right">{m.porcentaje_tinta}%</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                      setMatForm({ name: m.name, material_type_id: m.material_type_id || '', stock_minimo: m.stock_minimo, porcentaje_tinta: m.porcentaje_tinta, id: m.id } as any);
                      setNewOpen(true);
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* New Material Dialog */}
      <Dialog open={newOpen} onOpenChange={(open) => { setNewOpen(open); if (!open) setMatForm({ name: '', material_type_id: '', stock_minimo: 0, porcentaje_tinta: 0 }); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{(matForm as any).id ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre</Label>
              <Input value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} placeholder="Hojas carta B/N" />
            </div>
            <div>
              <Label>Tipo base (opcional)</Label>
              <Select value={matForm.material_type_id} onValueChange={v => setMatForm(f => ({ ...f, material_type_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {materialTypes.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stock mínimo</Label>
                <Input type="number" min={0} value={matForm.stock_minimo} onChange={e => setMatForm(f => ({ ...f, stock_minimo: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>% Tinta</Label>
                <Input type="number" min={0} max={100} value={matForm.porcentaje_tinta} onChange={e => setMatForm(f => ({ ...f, porcentaje_tinta: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMaterial} disabled={!matForm.name.trim() || saveMaterial.isPending}>
              {saveMaterial.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Dar entrada al almacén</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Select value={entryForm.material_id} onValueChange={v => setEntryForm(f => ({ ...f, material_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cantidad</Label>
                <Input type="number" min={1} value={entryForm.cantidad || ''} onChange={e => setEntryForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Costo unitario</Label>
                <Input type="number" min={0} step="0.01" value={entryForm.costo_unitario || ''} onChange={e => setEntryForm(f => ({ ...f, costo_unitario: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={entryForm.nota} onChange={e => setEntryForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryOpen(false)}>Cancelar</Button>
            <Button onClick={handleEntry} disabled={!entryForm.material_id || !entryForm.cantidad || createEntry.isPending}>
              {createEntry.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Registrar entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Entregar a vendedor</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Insumo</Label>
              <Select value={transferForm.material_id} onValueChange={v => setTransferForm(f => ({ ...f, material_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} (Almacén: {m.stock_almacen})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" min={1} value={transferForm.cantidad || ''} onChange={e => setTransferForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Empleado destino</Label>
              <Select value={transferForm.to_user_id} onValueChange={v => setTransferForm(f => ({ ...f, to_user_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar empleado" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.auth_user_id || e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nota (opcional)</Label>
              <Textarea value={transferForm.nota} onChange={e => setTransferForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
            <Button onClick={handleTransfer} disabled={!transferForm.material_id || !transferForm.cantidad || !transferForm.to_user_id || createTransfer.isPending}>
              {createTransfer.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Entregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default InsumosTab;
