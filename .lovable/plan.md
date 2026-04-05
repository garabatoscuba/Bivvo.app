

## Plan: Forzar cámara principal (no angular) en el escáner

### Problema

Hay dos rutas de selección de cámara:

1. **Ruta nativa (BarcodeDetector)** — usa `facingMode: { ideal: "environment" }` sin filtrar por dispositivo. El navegador elige libremente y en muchos teléfonos selecciona la cámara angular/wide que no enfoca bien.

2. **Ruta ZXing** — enumera dispositivos y filtra por label excluyendo `ultra/wide/macro/depth`. Esta lógica sí intenta elegir la principal, pero la ruta nativa la ignora completamente.

### Solución

Unificar la selección de cámara: **siempre enumerar dispositivos primero**, encontrar la cámara principal trasera por label, y usar su `deviceId` exacto en ambas rutas.

### Cambios en `src/components/layout/ScannerModal.tsx`

1. **Crear función auxiliar `pickMainBackCamera()`** que:
   - Llama `navigator.mediaDevices.enumerateDevices()`
   - Filtra `kind === 'videoinput'`
   - De las traseras (label incluye `back/rear/environment` O no incluye `front`), excluye las que tengan `ultra/wide/macro/depth/telephoto`
   - Si hay candidatas, elige la que tenga label con `"0"` o la primera (suele ser la principal)
   - Retorna el `deviceId` o `undefined`

2. **Ruta nativa (`startScanner`)**: antes de `getUserMedia`, llamar `pickMainBackCamera()`. Si obtiene un `deviceId`, usar `{ video: { deviceId: { exact: deviceId } } }` en vez de `facingMode`. Si no, mantener `facingMode` como fallback.

3. **Ruta ZXing (`startZxingScanning`)**: reusar `pickMainBackCamera()` en vez de la lógica inline duplicada.

4. **Nota**: para que `enumerateDevices` devuelva labels, puede requerir un stream temporal previo. Si los labels están vacíos, se pide un stream con `facingMode: environment` primero, se leen los labels, se para el stream, y luego se abre el definitivo con el `deviceId` correcto.

### Archivo a modificar
- `src/components/layout/ScannerModal.tsx`

### Lo que NO se toca
- Auth, POS, inventario, jornadas, sidebar, nómina

