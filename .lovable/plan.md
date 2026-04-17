
El usuario quiere que el footer del Hub use el logo correcto según tema (igual al ejemplo: "Bivoo" en blanco/oscuro con la "o" verde, y debajo "AUTOMATIZACIÓN DE EMPRESAS" en sans-serif tracking ancho).

Reviso el Auth para ver tipografía exacta del subtítulo.
<lov-tool-use id="toolu_vrtx_01SSt2KZd8fXU4dL7usyGrzJ" name="code--search_files" integration-id="code" data="{\"query\": \"AUTOMATIZACIÓN DE EMPRESAS|Automatización de empresas|automatizacion\", \"include_patterns\": \"*.tsx,*.css\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HrbtRSdvv7wpv1ryQmnFbE" name="code--search_files" integration-id="code" data="{\"query\": \"AUTOMATIZACIÓN|Automatización\", \"include_patterns\": \"*.tsx,*.css,*.html\"}">
</lov-tool-use>
I have what I need. The Auth/login uses `text-[11px] font-medium tracking-widest uppercase` (sans-serif default = Inter), not Cormorant.

Logo issue: currently uses `logoLight` for light mode and `logoDark` for dark mode. But the convention used in sidebar (per past message) is the opposite — `logo-dark.png` is the one with dark letters (used on light bg). The user says: dark mode → white letters, light mode → dark letters. So we need to swap.

<lov-plan>

## Plan: arreglar logo y tipografía del cierre del Hub

### 1. Logo invertido (`src/components/hub/HubEditorial.tsx` línea ~351)
Hoy:
```tsx
src={isDark ? logoDark : logoLight}
```
El nombre engaña: `logoLight` = letras claras (para fondo oscuro), `logoDark` = letras oscuras (para fondo claro). Hay que invertir:
```tsx
src={isDark ? logoLight : logoDark}
```
Así en oscuro salen letras blancas y en claro letras oscuras (igual que el ejemplo subido).

### 2. Tipografía del subtítulo (línea ~354)
Cambiar de `Cormorant Garamond italic` al estilo del login (`Auth.tsx` línea 217):
```tsx
<div className="text-[11px] font-medium tracking-widest uppercase hub-text-muted mb-8">
  Automatización de Empresas
</div>
```
- Quita `font-['Cormorant_Garamond']` y `italic`.
- Usa Inter por defecto, mayúsculas, `tracking-widest`, 11px medium.
- Capitaliza "Empresas" para que coincida con el login y la imagen.

### Lo que NO se toca
- Resto del bloque cierre (botones, separador, padding).
- Otros usos de logos en la app.
- Tokens CSS.

### Archivo
- `src/components/hub/HubEditorial.tsx` (2 líneas).

