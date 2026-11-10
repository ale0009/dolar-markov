# ¿Sube o baja el dólar mañana?

**Español** · [English](README.en.md)

Una página que hace una sola cosa: calcula, con una **cadena de Markov**, la probabilidad de que la **TRM** (tasa de cambio oficial peso/dólar de Colombia) **suba, baje o se quede igual** en la próxima publicación y en los siguientes n días hábiles. Y luego se juzga a sí misma con una prueba honesta.

> **No es consejo financiero.** Es un ejercicio de probabilidad con datos públicos. Con los datos al 11 nov 2026, la cadena **no le gana** a adivinar con la frecuencia simple (ver abajo).

- Datos en vivo de [datos.gov.co, conjunto 32sa-8pi3](https://www.datos.gov.co/d/32sa-8pi3) (API Socrata, sin clave, con CORS).
- Estados: cambio diario en 3 categorías (baja, estable, sube) con umbral de ±0,1 %, ±0,25 % o ±0,5 %; opcionalmente 5 (con «fuerte» = más de 1 %).
- Matriz de transición estimada con una ventana de 90, 180, 365 o 730 días; diagrama de estados con flechas proporcionales.
- Pronóstico a n pasos con Chapman-Kolmogorov (Pⁿ), distribución estacionaria y tiempo esperado de regreso (1/π).
- **Prueba honesta (backtest):** en los últimos 250 días hábiles, estimando cada día solo con el pasado, compara Markov con «mañana igual que hoy» y con «lo más frecuente», por acierto y por puntaje de Brier. Si Markov no gana, la página lo dice.
- Estado de carga, de error y respaldo marcado «Sin conexión: datos de ejemplo del 10 nov 2026».
- `/proceso/`: del ejercicio de clase (ciclo de vida de un producto con cadena absorbente) a los datos reales, con fórmulas, gráficas, backtest completo, limitaciones, fe de erratas y fuentes.

## Resultado del backtest (calculado aquí, datos hasta el 11 nov 2026)

Configuración por defecto (3 estados, ±0,1 %, ventana de 365 días), 250 días hábiles del 18 oct 2025 al 11 nov 2026:

| Modelo | Acierto | Brier (menor es mejor) |
|---|---|---|
| Markov | 48,0 % | 0,583 |
| «Mañana igual que hoy» | 44,8 % | 1,104 |
| «Lo más frecuente» | 49,6 % | 0,580 |

En las 24 combinaciones (3 umbrales × 4 ventanas × 3 o 5 estados) Markov no gana ninguna, pierde con claridad en 2 y empata en 22.

## Uso

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
node --test                   # pruebas (Node 20 o superior)
```

Añade `?sin-conexion` a la URL para ver el modo sin conexión. Para GitHub Pages basta con servir la rama `main` desde la raíz.

## Estructura

```
index.html, proceso/index.html   las dos páginas (sin build)
css/estilo.css                   línea "Tinta y trama" (claro) y "Jisseki" (oscuro)
js/trm.js                        URL de la API, parseo, cambios porcentuales, formatos
js/markov.js                     clasificar, estimar P, potencias, estacionaria, regreso, absorción
js/modelo.js                     modelo con ventana, backtest y veredicto
js/graficas.js                   SVG: diagrama de estados, serie, pronóstico, histograma
js/datos.js                      llamada a datos.gov.co con tiempo límite y respaldo
js/main.js, js/proceso.js        interfaz
datos/ejemplo-2026-11-10.json    respaldo: 1000 TRM reales (17 ago 2022 a 11 nov 2026)
test/                            pruebas node --test y una muestra real de 400 TRM
```

## De qué trabajo sale

De los trabajos de **procesos estocásticos** de Mario y David en Ingeniería de Sistemas: una cadena de Markov para el ciclo de vida de un producto tipo iPhone (con estado absorbente «descontinuado») y una exposición sobre la ecuación de Chapman-Kolmogorov. Aquí la matriz deja de ser supuesta y se estima con datos reales.

## Créditos y licencias

- Datos: Tasa de Cambio Representativa del Mercado (TRM), Superintendencia Financiera de Colombia, publicada en datos.gov.co.
- Fuentes tipográficas: Bangers, Atkinson Hyperlegible e IBM Plex Mono (Google Fonts, licencia OFL).
- [Mario Puerta «ale0009»](https://github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/)

Código con licencia MIT © 2026 Mario Alejandro Puerta Alarcón y David Alexander Rincón Corredor.
