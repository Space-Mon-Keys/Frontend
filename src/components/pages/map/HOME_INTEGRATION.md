# Integración MapImpact con HOME

## Parámetros de HOME utilizados

El componente `MapImpact` ahora trabaja directamente con los parámetros que el usuario introduce en HOME:

### 1. **Diameter** (Diámetro)
- **Tipo**: number (metros)
- **Default**: 100m
- **Rango recomendado**: 1 - 20,000m
- **Descripción**: Diámetro del asteroide/cometa
- **Uso**: Se usa directamente en el módulo NEO para calcular masa y área de impacto

### 2. **Velocity** (Velocidad)
- **Tipo**: number (m/s)
- **Default**: 20,000 m/s
- **Rango típico**: 11,000 - 72,000 m/s
- **Descripción**: Velocidad de impacto del objeto
- **Conversión**: Se convierte a `vInfinity` (km/s) usando:
  ```javascript
  vInfinity = sqrt(vImpact² - vEscape²)
  donde vEscape = 11.2 km/s
  ```

### 3. **Density** (Densidad)
- **Tipo**: number (kg/m³)
- **Default**: 3000 kg/m³
- **Rango típico**: 
  - Cometas: 500 - 1,500 kg/m³
  - Rocosos: 2,000 - 4,000 kg/m³
  - Metálicos: 5,000 - 8,000 kg/m³
- **Descripción**: Densidad del material
- **Conversión**: Se mapea a material del módulo NEO:
  - < 1500 kg/m³ → 'comet'
  - 1500-5000 kg/m³ → 'stony'
  - > 5000 kg/m³ → 'iron'

### 4. **EntryAngle** (Ángulo de entrada) - NUEVO
- **Tipo**: number (grados)
- **Default**: 45°
- **Rango**: 10° - 90°
- **Descripción**: Ángulo de entrada respecto al horizonte
  - 10°: Entrada muy rasante (más tiempo en atmósfera)
  - 45°: Entrada estándar
  - 90°: Entrada vertical
- **Efecto**: Afecta la ablación y probabilidad de airburst

## Control Visual en HOME

Se ha añadido un nuevo slider en el panel de parámetros:

```jsx
<input
  type="range"
  min="10"
  max="90"
  step="5"
  value={entryAngle}
  onChange={e => setEntryAngle(Number(e.target.value))}
/>
```

Con indicadores visuales:
- "Rasante (10°)" a la izquierda
- "Vertical (90°)" a la derecha
- Muestra el valor actual en el label

## Flujo de Datos

```
HOME (Usuario)
  ↓
  diameter, velocity, density, entryAngle
  ↓
MapImpact (Conversión)
  ↓
  - velocity → vInfinity
  - density → material
  - diameter → diameter (directo)
  - entryAngle → entryAngle (directo)
  ↓
neoEntryImpact.js (Módulo físico)
  ↓
  Cálculos de trayectoria, ablación, fragmentación
  ↓
Visualización en mapa
```

## Props de MapImpact

```jsx
<MapImpact
  diameter={diameter}        // de HOME
  velocity={velocity}        // de HOME
  density={density}          // de HOME
  entryAngle={entryAngle}    // de HOME (nuevo)
  energyMt={energyMt}        // de HOME (opcional, precalculado)
  initialLat={impactLat}     // coordenadas
  initialLng={impactLng}     // coordenadas
/>
```

## Información Mostrada

El panel de datos muestra:

1. **Objeto**: `⌀{diameter}m, {density} kg/m³`
2. **Velocidad**: Velocidad de HOME en km/s
3. **Masa**: Calculada por el módulo NEO
4. **Ángulo entrada**: Valor de HOME
5. **Energía**: En megatones TNT
6. **Resultado**: Airburst o impacto terrestre
7. **Radio de daños**: Si hay airburst
8. **Magnitud terremoto**: Escala Richter equivalente
9. **Terremotos similares**: Ejemplos de USGS

## Ejemplos de Configuración

### Pequeño meteorito rocoso
```javascript
diameter: 5          // 5m
velocity: 15000      // 15 km/s
density: 3000        // rocoso
entryAngle: 60       // entrada empinada
```

### Evento tipo Tunguska
```javascript
diameter: 50         // 50m
velocity: 18000      // 18 km/s
density: 3000        // rocoso
entryAngle: 45       // entrada estándar
```

### Evento tipo Chelyabinsk
```javascript
diameter: 20         // 20m
velocity: 19000      // 19 km/s
density: 3000        // rocoso
entryAngle: 18       // entrada muy rasante
```

### Gran asteroide metálico
```javascript
diameter: 200        // 200m
velocity: 25000      // 25 km/s
density: 7800        // hierro
entryAngle: 45       // entrada estándar
```

### Cometa
```javascript
diameter: 100        // 100m
velocity: 30000      // 30 km/s (alta velocidad)
density: 800         // cometa (hielo + polvo)
entryAngle: 30       // entrada oblicua
```

## Material Presets en HOME

Los materiales predefinidos en HOME ajustan automáticamente la densidad:

- **Hielo**: ~900 kg/m³ (factor 0.3)
- **Rocoso**: ~3000 kg/m³ (factor 1.0)
- **Metal**: ~7800 kg/m³ (factor 2.6)

El slider permite ajustes finos entre estos valores.

## Validación

- ✅ Todos los parámetros tienen valores por defecto
- ✅ Conversión automática a formato NEO
- ✅ Mapeo inteligente de densidad a material
- ✅ No requiere conocimientos de astrofísica por parte del usuario
- ✅ Interface familiar (diameter, velocity, density)
- ✅ Control intuitivo del ángulo de entrada
