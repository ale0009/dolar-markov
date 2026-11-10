# Will the dollar go up or down tomorrow?

[Español](README.md) · **English**

A single-purpose page: using a **Markov chain**, it estimates the probability that Colombia's official peso/dollar exchange rate (**TRM**) will **go up, go down or stay flat** in the next publication and over the next n business days. Then it grades itself with an honest backtest.

> **Not financial advice.** It is a probability exercise with public data. With data up to 11 Nov 2026, the chain **does not beat** guessing with the plain frequency (see below).

- Live data from [datos.gov.co, dataset 32sa-8pi3](https://www.datos.gov.co/d/32sa-8pi3) (Socrata API, no key, CORS enabled).
- States: daily change in 3 categories (down, flat, up) with a ±0.1 %, ±0.25 % or ±0.5 % threshold; optionally 5 ("strong" = more than 1 %).
- Transition matrix estimated over a 90, 180, 365 or 730-day window; state diagram with proportional arrows.
- n-step forecast with Chapman-Kolmogorov (Pⁿ), stationary distribution and mean return time (1/π).
- **Honest backtest:** over the last 250 business days, estimating each day only from the past, Markov is compared with "tomorrow same as today" and "most frequent", by hit rate and Brier score. If Markov does not win, the page says so.
- Loading and error states, plus a fallback labelled "offline: sample data from 10 Nov 2026".
- `/proceso/` (Spanish): from the class exercise (product life cycle as an absorbing chain) to real data, with formulas, charts, full backtest, limitations, errata and sources.

## Backtest result (computed here, data up to 11 Nov 2026)

Default settings (3 states, ±0.1 %, 365-day window), 250 business days from 18 Oct 2025 to 11 Nov 2026:

| Model | Hit rate | Brier (lower is better) |
|---|---|---|
| Markov | 48.0 % | 0.583 |
| "Tomorrow same as today" | 44.8 % | 1.104 |
| "Most frequent" | 49.6 % | 0.580 |

Across 24 settings (3 thresholds × 4 windows × 3 or 5 states) Markov wins none, clearly loses 2 and ties 22.

## Usage

```bash
python3 -m http.server 8000   # then open http://localhost:8000
node --test                   # tests (Node 20+)
```

Add `?sin-conexion` to the URL to see the offline mode. For GitHub Pages, serve the `main` branch from the root.

## Where it comes from

From Mario and David's **stochastic processes** coursework in Systems Engineering: a Markov chain for the life cycle of an iPhone-like product (with an absorbing "discontinued" state) and a talk on the Chapman-Kolmogorov equation. Here the matrix is no longer assumed: it is estimated from real data.

## Credits and licences

- Data: Tasa de Cambio Representativa del Mercado (TRM), Superintendencia Financiera de Colombia, published on datos.gov.co.
- Fonts: Bangers, Atkinson Hyperlegible and IBM Plex Mono (Google Fonts, OFL).
- [Mario Puerta «ale0009»](https://github.com/ale0009) × [David Rincón «Kuronoma»](https://www.linkedin.com/in/davidalexanderrinconcorredorkuronoma/)

MIT licence © 2026 Mario Alejandro Puerta Alarcón and David Alexander Rincón Corredor.
