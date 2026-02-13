
## Plan de Rediseño Minimalista - "Flat y Limpio"

### Objetivos Principales
Transformar la interfaz actual hacia un diseño minimalista similar a Notion, eliminando sombras excesivas, gradientes, y colores saturados. Mantener toda la funcionalidad, estructura de componentes y lógica de negocio intacta.

### Cambios de Diseño

#### 1. **Paleta de Colores (src/index.css)**
- **Fondo principal**: Cambiar de `98%` (casi blanco) a `99%` (blanco puro) para máximo contraste
- **Foreground**: Mantener oscuro neutral `220 15% 15%`
- **Bordes**: Suavizar de `91%` a `94%` (bordes más sutiles, casi imperceptibles)
- **Card**: Blanco puro sin elevación visual
- **Primary**: Mantener el azul corporativo pero reducir saturación ligeramente para menor agresividad
- **Secondary/Accent/Muted**: Simplificar a grises neutros sin azules sutiles
- **Sombras**: Eliminar sombras proyectadas, usar solo bordes sutiles
- **Border radius**: Reducir de `0.75rem` a `0.5rem` (más cuadrado, menos redondeado)

#### 2. **Variables CSS Específicas**
- Eliminar gradientes del design system
- Reducir contraste de colores de categoría (mantenerlos pero más desaturados)
- Simplificar tokens de color a valores primarios, sin variaciones complejas

#### 3. **Componentes UI (src/components/ui/)**
- **Card**: Remover `shadow-sm`, usar solo `border border-border` simple
- **Button**: Eliminar estilos complejos, mantener bordes sutiles y colores planos
- **Input**: Bordes finos, sin sombras de focus (anillo solo)
- **Dialog/Popover**: Sin sombras, bordes simples
- **Sidebar**: Blanco puro, bordes sutiles separadores

#### 4. **Layout (src/components/layout/)**
- **AppLayout**: Reducir padding innecesario, aumentar espacio blanco
- **AppSidebar**: 
  - Header: Remover box de color de icono (fondo primary), usar solo icono neutro + texto
  - Items: Simplificar hover state (solo cambio de background sutil)
  - Footer: Remover bordes pesados, mantener separación minimalista
- **AppHeader**: Remover sombras de búsqueda/notificaciones, bordes sutiles

#### 5. **Dashboard y Páginas**
- **Gradientes de bienvenida**: Remover `bg-gradient-to-r`, usar fondo neutral simple
- **Stats Cards**: Bordes simples, sin colores de fondo (background puro), iconos neutros
- **Quick Actions Cards**: Remover colores de fondo de iconos (`bg-category-*/20`), usar solo iconos
- **Alerts Section**: Simplificar background de alerta

#### 6. **Animaciones**
- Mantener las animaciones existentes (fade-in, slide, accordion)
- Reducir velocidad ligeramente para efecto más "sereno" (0.4s en lugar de 0.3s)
- Eliminar transiciones de hover complejas, usar solo opacity suave

#### 7. **Tipografía**
- Mantener `Inter` como fuente
- Reducir algunos tamaños de font-weight (menos contraste visual)
- Aumentar line-height ligeramente para mejor legibilidad en diseño minimalista

### Archivos a Modificar

1. **src/index.css**: Redefine variables de color y border radius
2. **tailwind.config.ts**: Ajustar keyframes para animaciones más lentas
3. **src/components/ui/card.tsx**: Remover shadow-sm
4. **src/components/ui/button.tsx**: Simplificar estilos
5. **src/components/layout/AppSidebar.tsx**: Remover backgrounds de colores, simplificar estructura visual
6. **src/components/layout/AppHeader.tsx**: Remover elementos visuales pesados
7. **src/pages/Dashboard.tsx**: Remover gradientes, simplificar colores
8. **Otros componentes UI**: Auditoría y limpieza de sombras y gradientes

### Resultado Esperado
- Interfaz limpia, minimalista similar a Notion
- Máximo espacio blanco y respiro visual
- Jerarquía clara sin decoraciones
- Todos los botones, formularios, y tablas funcionan igual
- Autenticación, roles, y lógica de negocio intacta
- Navegación y estructura preservada

### Secuencia de Trabajo
1. Actualizar variables CSS base (colores, borders, radius)
2. Actualizar componentes UI principales (card, button, input)
3. Actualizar layout components (sidebar, header)
4. Actualizar páginas (dashboard, admin pages)
5. Prueba visual de la interfaz completa

