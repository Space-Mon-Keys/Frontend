# Simulador de Impacto NEO - Guía de Uso

## Descripción

Sistema completo de simulación de impacto de objetos cercanos a la Tierra (NEO - Near-Earth Objects) con visualización en mapa 2D y cálculos físicos precisos.

## Componentes

### 1. **ImpactSimulator** (Principal)
Componente integrador que combina el formulario de parámetros con el mapa de impacto.

**Uso:**
```jsx
import ImpactSimulator from './components/pages/map/ImpactSimulator';

function App() {
  return <ImpactSimulator />;
}
```

### 2. **MapImpact** (Visualización)
Mapa interactivo que muestra las zonas de impacto y sus efectos.

**Props:**
- `vInfinity` (number): Velocidad hiperbólica de exceso en km/s (default: 15)
- `diameter` (number): Diámetro del objeto en metros (default: 50)
- `material` (string): Tipo de material - 'stony', 'iron', 'comet' (default: 'stony')
- `entryAngle` (number): Ángulo de entrada desde horizontal en grados (default: 45)
- `initialLat` (number): Latitud inicial del punto de impacto (opcional)
- `initialLng` (number): Longitud inicial del punto de impacto (opcional)

**Uso independiente:**
```jsx
import MapImpact from './components/pages/map/MapImpact';

<MapImpact 
  vInfinity={18} 
  diameter={20} 
  material="stony"
  entryAngle={30}
/>
```

### 3. **ImpactParametersForm** (Formulario)
Formulario interactivo para configurar los parámetros del impacto.

**Props:**
- `onParamsChange` (function): Callback llamado cuando cambian los parámetros
- `initialParams` (object): Parámetros iniciales

**Uso independiente:**
```jsx
import ImpactParametersForm from './components/pages/map/ImpactParametersForm';

const [params, setParams] = useState({
  vInfinity: 15,
  diameter: 50,
  material: 'stony',
  entryAngle: 45
});

<ImpactParametersForm 
  initialParams={params}
  onParamsChange={setParams}
/>
```

## Servicios

### neoEntryImpact.js
Módulo de cálculo físico autocontenido (sin dependencias externas).

**Funciones principales:**

#### `assessNEOImpact(params)`
Evaluación completa del impacto.

```javascript
import { assessNEOImpact } from './services/neoEntryImpact';

const scenario = assessNEOImpact({
  vInfinity: 15,        // km/s
  diameter: 50,         // metros
  material: 'stony',    // 'stony', 'iron', 'comet'
  entryAngle: 45        // grados
});

console.log(scenario.outcome);
// "Airburst at 8.2 km altitude"

console.log(scenario.trajectory.impact.impactEnergy);
// 3.5 (Mt TNT)

console.log(scenario.blast.radiusWindowBreak);
// 15.2 (km)
```

#### Materiales disponibles:
- **stony**: Asteroide rocoso (3000 kg/m³, 200 kPa)
- **iron**: Asteroide metálico (7800 kg/m³, 2 MPa)
- **comet**: Cometa helado (800 kg/m³, 100 kPa)

### earthquakeEnergyService.js
Servicio para comparar la energía del impacto con terremotos reales.

```javascript
import { energyToMagnitude, findSimilarEarthquakes } from './services/earthquakeEnergyService';

// Convertir energía a magnitud Richter
const magnitude = energyToMagnitude(energyJoules);

// Buscar terremotos similares en USGS
const quakes = await findSimilarEarthquakes(magnitude, delta=0.15, limit=3);
```

## Características del Mapa

### Zonas de Impacto
El mapa visualiza 7 zonas concéntricas:

1. **Vaporización** (amarillo): Todo se vaporiza instantáneamente
2. **Fusión** (naranja): Rocas fundidas, temperaturas extremas
3. **Cráter** (rojo): Excavación directa del impacto
4. **Eyección** (púrpura): Material expulsado y escombros
5. **Terremotos severos** (verde): Daño estructural masivo
6. **Ondas sísmicas** (azul): Terremotos moderados
7. **Onda de choque** (cian): Efectos atmosféricos

### Controles Interactivos

#### Panel de Control de Capas (superior derecha)
- ✅ Toggle individual para cada zona
- ✅ Control maestro "Todas las zonas"
- ✅ Minimizable/expandible
- ✅ Indica visualmente las zonas activas

#### Leyenda Arrastrable (lateral derecha)
- ✅ Muestra colores y descripciones de cada zona
- ✅ Arrastrable a cualquier posición
- ✅ Indicador visual de arrastre

#### Panel de Datos del Impacto (inferior derecha)
Muestra información calculada:
- Características del objeto (tamaño, material, masa)
- Velocidad de entrada
- Energía liberada (megatones TNT)
- Resultado del impacto (airburst o impacto terrestre)
- Altitud de explosión (si aplica)
- Radio de daños
- Magnitud de terremoto equivalente
- Terremotos reales similares de la base de datos USGS

#### Panel de Parámetros (superior izquierda)
- ✅ Ajuste de velocidad v∞ (5-75 km/s)
- ✅ Ajuste de diámetro (1-20000 m)
- ✅ Selección de material (stony/iron/comet)
- ✅ Ajuste de ángulo de entrada (10-90°)
- ✅ Ejemplos predefinidos (Tunguska, Chelyabinsk, etc.)
- ✅ Minimizable/expandible

## Ejemplos Predefinidos

### Tunguska (1908)
```javascript
{
  vInfinity: 15,
  diameter: 50,
  material: 'stony',
  entryAngle: 45
}
```
Resultado: Airburst a ~8 km, ~3-15 Mt

### Chelyabinsk (2013)
```javascript
{
  vInfinity: 18,
  diameter: 20,
  material: 'stony',
  entryAngle: 18  // Entrada muy rasante
}
```
Resultado: Airburst a ~23 km, ~0.5 Mt

### Meteorito Pequeño
```javascript
{
  vInfinity: 12,
  diameter: 2,
  material: 'iron',
  entryAngle: 60
}
```
Resultado: Impacto terrestre con masa retenida

### Cometa Grande
```javascript
{
  vInfinity: 25,
  diameter: 100,
  material: 'comet',
  entryAngle: 30
}
```
Resultado: Airburst de alta energía

### Chicxulub (extinción dinosaurios)
```javascript
{
  vInfinity: 20,
  diameter: 10000,  // 10 km
  material: 'stony',
  entryAngle: 45
}
```
Resultado: Impacto catastrófico global

## Interacción con el Mapa

1. **Seleccionar punto de impacto**: Click en cualquier parte del mapa
2. **Ajustar zoom**: Los círculos se auto-ajustan para ser visibles
3. **Mostrar/ocultar zonas**: Usar panel de control de capas
4. **Mover leyenda**: Arrastrar desde el encabezado
5. **Cambiar parámetros**: Usar formulario (se recalcula automáticamente)

## Tecnologías

- **React** + Hooks (useState, useEffect, useMemo)
- **react-leaflet** - Mapas interactivos
- **Leaflet** - Librería de mapas
- **CartoDB** - Tiles del mapa
- **USGS API** - Datos de terremotos reales
- **Física pura JavaScript** - Cálculos sin dependencias

## Física Implementada

### Velocidad de Entrada
```
v_entry = √(v_∞² + v_escape²)
```
donde v_escape ≈ 11.2 km/s

### Atmósfera Exponencial
```
ρ(h) = ρ₀ × exp(-h/H)
```
ρ₀ = 1.225 kg/m³, H = 7200 m

### Ecuaciones de Movimiento
```
dv/dt = -(Cd×A/2m)×ρ(h)×v² - g×sin(γ)
dm/dt = -(Λ×A/2Q)×ρ(h)×v³
```

### Fragmentación
```
q = 0.5 × ρ(h) × v²
```
Fragmentación cuando q ≥ S (resistencia del material)

## Rendimiento

- Cálculo del escenario: < 50ms
- Recálculo automático al cambiar parámetros
- Uso de `useMemo` para optimizar renders
- Renderizado eficiente de círculos (ordenados por tamaño)

## Archivo de Estructura

```
src/
├── components/
│   └── pages/
│       └── map/
│           ├── ImpactSimulator.jsx       # Componente principal
│           ├── MapImpact.jsx             # Mapa con visualización
│           └── ImpactParametersForm.jsx  # Formulario de parámetros
└── services/
    ├── neoEntryImpact.js                 # Módulo de cálculo físico
    ├── earthquakeEnergyService.js        # Servicio de terremotos
    ├── neoEntryImpact.examples.js        # Ejemplos de uso
    └── NEO_ENTRY_IMPACT_README.md        # Documentación técnica
```

## Validación

El módulo ha sido calibrado contra:
- ✅ Evento de Tunguska (1908)
- ✅ Meteoro de Chelyabinsk (2013)
- ✅ Modelos estándar de ablación
- ✅ Leyes de escala de explosiones nucleares

## Licencia

MIT - Libre para uso en cualquier proyecto
