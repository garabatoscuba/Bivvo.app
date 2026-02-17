

# Boton "Descargar App" integrado en el sitio

## Resumen

Agregar un sistema inteligente de promocion de instalacion PWA directamente dentro de la app. Incluye un banner visible para usuarios moviles que aun no han instalado la app, y una pagina dedicada `/install` con instrucciones paso a paso.

## Como funciona

1. Cuando un usuario abre la app desde Chrome en Android, vera un banner en la parte superior que dice "Instalar app para usar sin internet"
2. Al tocar "Instalar", se dispara el dialogo nativo de instalacion del navegador
3. Si el usuario ya instalo la app o esta en escritorio, el banner no aparece
4. En el menu lateral (sidebar) habra un enlace "Descargar App" que lleva a la pagina `/install`
5. La pagina `/install` tiene instrucciones visuales para iPhone (que no soporta instalacion automatica) y Android

## Deteccion inteligente

- Detecta si el usuario esta en un navegador movil (no instalada aun)
- Captura el evento `beforeinstallprompt` del navegador para disparar la instalacion nativa
- Si ya esta instalada como PWA, oculta todo el sistema de promocion
- En escritorio muestra un enlace discreto en el sidebar en vez del banner

## Que vera el usuario

### En movil (Chrome Android, no instalada):
```text
+------------------------------------------+
| [icono] Instala la app  [Instalar] [ X ] |
+------------------------------------------+
|          (resto de la app)               |
```

### En la pagina /install:
```text
+------------------------------------------+
|         Instala SyncSales                |
|                                          |
|  [icono de la app]                       |
|                                          |
|  Android:                                |
|  1. Toca "Instalar" abajo               |
|  2. Confirma la instalacion              |
|                                          |
|  iPhone:                                 |
|  1. Toca el icono de Compartir           |
|  2. Selecciona "Agregar a inicio"        |
|                                          |
|         [ Instalar App ]                 |
+------------------------------------------+
```

### En el sidebar:
```text
  Dashboard
  Inventario
  POS
  Ventas
  ...
  ─────────────
  Descargar App   <-- nuevo enlace
```

## Plan de implementacion

### Paso 1: Configurar PWA base
- Instalar `vite-plugin-pwa`
- Crear manifest con nombre "SyncSales", iconos y colores de la app
- Configurar Service Worker para cache de assets
- Agregar meta tags moviles en `index.html`
- Excluir `/~oauth` del cache del Service Worker

### Paso 2: Hook de instalacion PWA
- Crear `src/hooks/usePWAInstall.ts`
- Capturar el evento `beforeinstallprompt`
- Detectar si la app ya esta instalada (modo standalone)
- Detectar si es dispositivo movil
- Exponer funcion `promptInstall()` y estados `canInstall`, `isInstalled`, `isMobile`

### Paso 3: Banner de instalacion
- Crear componente `src/components/layout/InstallBanner.tsx`
- Mostrar solo si: es movil + no esta instalada + no fue descartado
- Guardar en localStorage si el usuario cerro el banner (no molestar por 7 dias)
- Integrar en `AppLayout.tsx` arriba del header

### Paso 4: Pagina /install
- Crear `src/pages/Install.tsx` como pagina publica (sin ProtectedRoute)
- Instrucciones visuales para Android e iPhone
- Boton "Instalar" que usa el hook de PWA
- Agregar ruta en `App.tsx`

### Paso 5: Enlace en sidebar
- Agregar enlace "Descargar App" en `AppSidebar.tsx`
- Mostrar solo si la app no esta instalada como PWA
- Enlazar a `/install`

## Seccion tecnica

### Dependencia nueva
- `vite-plugin-pwa` - Genera el Service Worker y manifest automaticamente

### Archivos nuevos
- `src/hooks/usePWAInstall.ts` - Hook para gestion de instalacion PWA
- `src/components/layout/InstallBanner.tsx` - Banner de promocion
- `src/pages/Install.tsx` - Pagina de instrucciones de instalacion

### Archivos modificados
- `vite.config.ts` - Agregar plugin PWA con configuracion de manifest y Service Worker
- `index.html` - Meta tags para movil (theme-color, apple-mobile-web-app)
- `src/App.tsx` - Agregar ruta `/install`
- `src/components/layout/AppLayout.tsx` - Integrar InstallBanner
- `src/components/layout/AppSidebar.tsx` - Agregar enlace "Descargar App"

### Logica del hook usePWAInstall
```text
- Escucha evento "beforeinstallprompt" -> guarda referencia
- Escucha evento "appinstalled" -> marca isInstalled = true
- Detecta display-mode: standalone -> ya instalada
- promptInstall() -> dispara el dialogo nativo del navegador
```

### Nota importante
Este paso configura la PWA basica (instalable + cache). La funcionalidad offline completa (IndexedDB, sync engine, bloqueo por 7 dias) se implementara en fases posteriores segun el plan original.

