// Página /proceso/: el ejercicio de clase calculado con los mismos módulos y el backtest completo con datos reales.
import { cargarTRM, RESPALDO } from './datos.js';
import { cambiosPct, fechaCorta, fmtProb } from './trm.js';
import { potencia, tiempoAbsorcion, distribucionN, clasificar, estadosDe } from './markov.js';
import { modelar, backtest } from './modelo.js';
import { svgDiagrama, svgHistograma } from './graficas.js';
import { iniciarTema } from './tema.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const coma = (x, d = 1) => x.toFixed(d).replace('.', ',');

// Matriz del ejercicio de clase (diapositiva «Matriz de transición y predicción»).
const IPHONE = [
  [0.6, 0.3, 0.1, 0.0],
  [0.2, 0.5, 0.2, 0.1],
  [0.1, 0.3, 0.4, 0.2],
  [0.0, 0.0, 0.0, 1.0],
];
const EST_IPHONE = [
  { nombre: 'Alta', largo: 'Alta demanda', clase: 'e-alta' },
  { nombre: 'Estable', largo: 'Demanda estable', clase: 'e-estable' },
  { nombre: 'Baja', largo: 'Baja demanda', clase: 'e-baja' },
  { nombre: 'Descont.', largo: 'Descontinuado', clase: 'e-desc' },
];

function tablaMatriz(M, estados, caption, dec = 2) {
  const cab = `<tr><th scope="col">De \\ a</th>${estados.map((e) => `<th scope="col">${esc(e.largo ?? e.nombre)}</th>`).join('')}</tr>`;
  const filas = M.map((f, i) => `<tr><th scope="row">${esc(estados[i].largo ?? estados[i].nombre)}</th>${f.map((p) => `<td>${coma(p, dec)}</td>`).join('')}</tr>`).join('');
  return `<table class="tabla"><caption>${caption}</caption><thead>${cab}</thead><tbody>${filas}</tbody></table>`;
}

function ejercicioClase() {
  $('d-iphone').innerHTML = svgDiagrama(IPHONE, EST_IPHONE, { titulo: 'Cadena del ciclo de vida del producto (ejercicio de clase)', absorbentes: [3] });
  $('t-iphone').innerHTML = tablaMatriz(IPHONE, EST_IPHONE, 'P: la matriz del ejercicio (fuente: la presentación de clase).', 1);
  $('t-iphone2').innerHTML = tablaMatriz(potencia(IPHONE, 2), EST_IPHONE, 'P² = P · P (calculado aquí).', 3);
  const { pasos } = tiempoAbsorcion(IPHONE);
  $('absorcion').innerHTML = pasos.map((t, i) => `<div class="medidor"><span class="hud-n">${coma(t)}</span><span class="hud-l">periodos esperados hasta «descontinuado» desde «${esc(EST_IPHONE[i].largo.toLowerCase())}»</span></div>`).join('');
  const filas = [1, 2, 4, 12, 24].map((n) => {
    const d = distribucionN([1, 0, 0, 0], IPHONE, n);
    return `<tr><th scope="row">n = ${n}</th>${d.map((p) => `<td>${fmtProb(p)}</td>`).join('')}</tr>`;
  }).join('');
  $('t-evol').innerHTML = `<table class="tabla"><caption>Distribución después de n periodos empezando en «alta demanda»: p₀ · Pⁿ (calculado aquí).</caption><thead><tr><th scope="col">n</th>${EST_IPHONE.map((e) => `<th scope="col">${esc(e.largo)}</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>`;
}

function reparto(cambios) {
  const desde = cambios[Math.max(0, cambios.length - 250)].fecha;
  const ult = cambios.slice(-250);
  const filas = [0.1, 0.25, 0.5].map((u) => {
    const c = [0, 0, 0];
    ult.forEach((x) => c[clasificar(x.pct, u, 3)]++);
    return `<tr><th scope="row">±${coma(u, u === 0.25 ? 2 : 1)} %</th>${c.map((n) => `<td>${fmtProb(n / ult.length)}</td>`).join('')}</tr>`;
  }).join('');
  $('t-reparto').innerHTML = `<table class="tabla"><caption>Reparto de los últimos ${ult.length} cambios (desde el ${fechaCorta(desde)}) según el umbral · calculado aquí.</caption><thead><tr><th scope="col">Umbral</th><th scope="col">Baja</th><th scope="col">Estable</th><th scope="col">Sube</th></tr></thead><tbody>${filas}</tbody></table>`;
}

function rejillaBacktest(cambios, k) {
  const ventanas = [90, 180, 365, 730];
  const umbrales = [0.1, 0.25, 0.5];
  let gana = 0, pierde = 0, total = 0;
  const filas = umbrales.map((u) => `<tr><th scope="row">±${coma(u, u === 0.25 ? 2 : 1)} %</th>${ventanas.map((v) => {
    const b = backtest(cambios, { umbral: u, k, ventana: v, pruebas: 250 });
    const r = b.veredicto;
    total++;
    if (r.resultado === 'gana') gana++;
    if (r.resultado === 'pierde') pierde++;
    const base = b.modelos[r.rival].acierto;
    return `<td class="${r.resultado}" title="Markov ${fmtProb(b.modelos.markov.acierto, 1)} · persistencia ${fmtProb(b.modelos.persistencia.acierto, 1)} · frecuencia ${fmtProb(b.modelos.frecuencia.acierto, 1)}">${fmtProb(b.modelos.markov.acierto, 1)} <small>vs ${fmtProb(base, 1)}</small><br><small>${{ gana: 'gana', empate: 'no gana', pierde: 'pierde' }[r.resultado]}</small></td>`;
  }).join('')}</tr>`).join('');
  return {
    html: `<table class="tabla rejilla-bt"><caption>${k} estados: acierto de Markov vs la mejor línea base, últimos 250 días hábiles · calculado aquí.</caption><thead><tr><th scope="col">Umbral \\ ventana</th>${ventanas.map((v) => `<th scope="col">${v} d</th>`).join('')}</tr></thead><tbody>${filas}</tbody></table>`,
    gana, pierde, total,
  };
}

async function iniciar() {
  iniciarTema($('tema'));
  ejercicioClase();
  let datos;
  try {
    datos = await cargarTRM('../');
  } catch (e) {
    $('origen').innerHTML = `<span class="chip chip-error">Error</span> No se pudieron cargar los datos (${esc(e.message)}).`;
    return;
  }
  const u = datos.serie[datos.serie.length - 1];
  $('origen').innerHTML = datos.origen === 'vivo'
    ? `<span class="chip chip-vivo">En vivo</span> ${datos.serie.length} TRM de datos.gov.co, del ${fechaCorta(datos.serie[0].fecha)} al ${fechaCorta(u.fecha)}. Las tablas de abajo se recalculan con ellas.`
    : `<span class="chip chip-error">Sin conexión: datos de ejemplo del ${RESPALDO.fecha}</span> No se pudo consultar datos.gov.co: ${esc(datos.error)}.`;
  const cambios = cambiosPct(datos.serie);
  $('g-hist').innerHTML = svgHistograma(cambios.slice(-750), { umbral: 0.1, W: Math.max(320, Math.min(760, $('g-hist').clientWidth || 640)) });
  reparto(cambios);
  const m = modelar(cambios, { umbral: 0.1, k: 3, ventana: 365 });
  $('d-dolar').innerHTML = svgDiagrama(m.P, estadosDe(3), { actual: m.actual, titulo: 'Cadena de la TRM con 3 estados, ventana de 365 días' });
  $('t-dolar').innerHTML = tablaMatriz(m.P, estadosDe(3), `P estimada con ${m.transiciones} transiciones hasta el ${fechaCorta(m.ultimo.fecha)} · calculado aquí.`, 3);
  const r3 = rejillaBacktest(cambios, 3);
  const r5 = rejillaBacktest(cambios, 5);
  $('bt3').innerHTML = r3.html;
  $('bt5').innerHTML = r5.html;
  const g = r3.gana + r5.gana, p = r3.pierde + r5.pierde, t = r3.total + r5.total;
  $('bt-resumen').innerHTML = `En las ${t} combinaciones, con estos mismos datos: Markov <strong>gana en ${g}</strong>, <strong>pierde con claridad en ${p}</strong> y en las otras ${t - g - p} queda en empate técnico.`;
  const bt = backtest(cambios, { umbral: 0.1, k: 3, ventana: 365, pruebas: 250 });
  $('bt-base').innerHTML = `<li>Markov: <strong>${fmtProb(bt.modelos.markov.acierto, 1)}</strong> de aciertos, Brier ${coma(bt.modelos.markov.brier, 3)}.</li>
    <li>«Mañana igual que hoy»: <strong>${fmtProb(bt.modelos.persistencia.acierto, 1)}</strong>, Brier ${coma(bt.modelos.persistencia.brier, 3)}.</li>
    <li>«Lo más frecuente»: <strong>${fmtProb(bt.modelos.frecuencia.acierto, 1)}</strong>, Brier ${coma(bt.modelos.frecuencia.brier, 3)}.</li>`;
}

iniciar();
