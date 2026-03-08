import { useActiveSheets, useSheetHistory, useRawMaterials, usePrintMaterialTypes } from '@/hooks/usePrintData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, AlertTriangle, Loader2, History } from 'lucide-react';
import { format } from 'date-fns';

const ActiveSheetsSection = () => {
  const { data: materials = [] } = useRawMaterials();
  const { data: materialTypes = [] } = usePrintMaterialTypes();
  const { data: activeSheets = [], isLoading } = useActiveSheets();
  const { data: sheetHistory = [] } = useSheetHistory();

  const tramoMaterials = materials.filter((m: any) => {
    const mt = materialTypes.find((t: any) => t.id === m.material_type_id);
    return mt?.permite_tramos === true;
  });

  if (tramoMaterials.length === 0) return null;

  const getMatName = (matId: string) => materials.find((m: any) => m.id === matId)?.name || '—';

  const materialsWithoutSheet = tramoMaterials.filter(
    (m: any) => !activeSheets.find((s: any) => s.material_id === m.id)
  );

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Hojas activas (tramos)
      </h3>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {activeSheets.length === 0 && materialsWithoutSheet.length > 0 && (
            <Card>
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-warning" />
                No hay hojas abiertas. Los empleados pueden abrir hojas desde su vista de ventas.
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
                        Hoja agotada. El empleado debe abrir una nueva.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

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
    </div>
  );
};

export default ActiveSheetsSection;
