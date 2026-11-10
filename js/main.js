// Interfaz de la herramienta: carga la TRM, estima la cadena y pinta todo. La lógica está en trm.js, markov.js y modelo.js.
import { cargarTRM, RESPALDO } from './datos.js';
import { cambiosPct, fechaCorta, fmtPesos, fmtPct, fmtProb } from './trm.js';
import { modelar, backtest, rachaMaxima } from './modelo.js';
import { argmax } from './markov.js';
import { svgDiagrama, svgSerie, svgPronostico } from './graficas.js';
import { iniciarTema } from './tema.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const NOMBRE_MODELO = { markov: 'Markov', persistencia: '«Mañana igual que hoy»', frecuencia: '«Lo más frecuente»' };
const PRUEBAS = 250;

let datos = null;
let cambios = [];

function ajustes() {
  const v = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  return { ventana: Number(v('ventana')), umbral: Number(v('umbral')), k: Number(v('k')), horizonte: Number($('n').value) };
}

function chipEstado() {
  if (datos.origen === 'vivo') {
    const u = datos.serie[datos.serie.length - 1];
    return `<span class="chip chip-vivo">En vivo</span> datos.gov.co · ${datos.serie.length} TRM hasta el ${fechaCorta(u.fecha)}`;
  }
  return `<span class="chip chip-error">Sin conexión: datos de ejemplo del ${RESPALDO.fecha}</span><span class="motivo">No se pudo consultar datos.gov.co: ${esc(datos.error)}.</span>`;
}

function pintarRespuesta(m, b) {
  const e = m.estados;
  const top = argmax(m.manana, m.frecuencia);
  $('veredicto').innerHTML = `<span class="palabra ${e[top].clase}-p">${esc(e[top].nombre)}</span> <span class="pct">${fmtProb(m.manana[top])}</span>`;
  $('probs').innerHTML = m.manana.map((p, j) => `<span class="pb ${e[j].clase}" style="flex-grow:${Math.max(p, 0.001)}"><b>${esc(e[j].nombre)}</b> ${fmtProb(p)}</span>`).join('');
  $('probs').setAttribute('aria-hidden', 'false');
  $('probs').setAttribute('aria-label', m.manana.map((p, j) => `${e[j].nombre} ${fmtProb(p)}`).join(', '));
  $('probs').setAttribute('role', 'img');
  const u = m.ultimo;
  $('explica').innerHTML = `Última TRM: <strong>${fmtPesos(u.valor)}</strong>, vigente desde el ${fechaCorta(u.fecha)} (<span class="${u.pct > 0 ? 'rojo' : u.pct < 0 ? 'cian' : ''}">${fmtPct(u.pct, 2, true)}</span> frente a la anterior). Hoy el estado es <strong>${esc(e[m.actual].nombre.toLowerCase())}</strong>; de ahí, en la ventana de ${m.ventana} días, el dólar fue a «${esc(e[top].nombre.toLowerCase())}» el ${fmtProb(m.manana[top])} de las veces.`;
  const M = b.modelos;
  const r = b.veredicto;
  const rival = NOMBRE_MODELO[r.rival];
  const frase = {
    gana: `<strong>Markov gana la prueba</strong>: acertó ${fmtProb(M.markov.acierto)} de ${b.n} días, contra ${fmtProb(M[r.rival].acierto)} de ${rival}.`,
    empate: `<strong>Ojo: Markov no le gana a ${rival}</strong> (${fmtProb(M.markov.acierto)} contra ${fmtProb(M[r.rival].acierto)} de aciertos en ${b.n} días). Tómalo como curiosidad, no como predicción.`,
    pierde: `<strong>Ojo: Markov pierde contra ${rival}</strong> (${fmtProb(M.markov.acierto)} contra ${fmtProb(M[r.rival].acierto)} de aciertos en ${b.n} días). Con estos ajustes, la cadena predice peor que no usar modelo.`,
    'sin-datos': 'No hay suficientes días para probar el modelo.',
  }[r.resultado];
  $('honesto').innerHTML = frase;
  $('honesto').className = `honesto h-${r.resultado}`;
}

function pintarMatriz(m) {
  const e = m.estados;
  const cab = `<tr><th scope="col">De \\ a</th>${e.map((x) => `<th scope="col">${esc(x.nombre)}</th>`).join('')}<th scope="col">días</th></tr>`;
  const filas = m.P.map((f, i) => `<tr${i === m.actual ? ' class="fila-hoy"' : ''}><th scope="row">${esc(e[i].nombre)}${i === m.actual ? ' (hoy)' : ''}</th>${f.map((p, j) => `<td title="${m.conteos[i][j]} de ${m.conteos[i].reduce((a, c) => a + c, 0)}">${fmtProb(p, 1)}</td>`).join('')}<td>${m.conteos[i].reduce((a, c) => a + c, 0)}</td></tr>`).join('');
  $('matriz').innerHTML = `<table class="tabla"><caption>P[i][j] = n<sub>ij</sub> / n<sub>i</sub>: de las veces que hubo «i», cuántas veces el siguiente día hábil hubo «j».</caption><thead>${cab}</thead><tbody>${filas}</tbody></table>`;
  const vacias = m.vacias.length ? ` Sin datos para ${m.vacias.map((i) => `«${e[i].nombre}»`).join(', ')}: esa fila usa la frecuencia simple.` : '';
  $('diag-n').textContent = `Estimada con ${m.transiciones} transiciones (${m.ventana} días de calendario hasta el ${fechaCorta(m.ultimo.fecha)}).${vacias}`;
}

function pintarPrueba(b, aj, m) {
  const M = b.modelos;
  const r = b.veredicto;
  const sello = $('sello');
  sello.hidden = false;
  sello.className = `sello s-${r.resultado}`;
  sello.textContent = { gana: 'Gana', empate: 'No gana', pierde: 'Pierde', 'sin-datos': 'Sin datos' }[r.resultado];
  const mejor = Math.max(...Object.values(M).map((x) => x.acierto));
  $('medidores').innerHTML = ['markov', 'persistencia', 'frecuencia'].map((nombre) => {
    const x = M[nombre];
    return `<div class="medidor-fila${nombre === 'markov' ? ' es-markov' : ''}${x.acierto === mejor ? ' mejor' : ''}">
      <span class="m-nombre">${NOMBRE_MODELO[nombre]}</span>
      <span class="m-barra"><i style="width:${(x.acierto * 100).toFixed(1)}%"></i></span>
      <span class="m-pct">${fmtProb(x.acierto, 1)}</span>
      <span class="m-brier" title="Puntaje de Brier: error de las probabilidades, menor es mejor">Brier ${x.brier.toFixed(3).replace('.', ',')}</span>
    </div>`;
  }).join('');
  const ult = b.dias.slice(-30);
  const e = m.estados;
  $('tira').innerHTML = `<p class="tira-t">Últimos ${ult.length} días: color = lo que pasó · círculo = Markov acertó</p>
    <div class="tira-cajas" role="img" aria-label="Markov acertó ${ult.filter((d) => d.pred.markov === d.real).length} de los últimos ${ult.length} días">${ult.map((d) => `<i class="${e[d.real].clase}${d.pred.markov === d.real ? ' acierto' : ''}" title="${fechaCorta(d.fecha)}: pasó «${e[d.real].nombre}», Markov dijo «${e[d.pred.markov].nombre}»"></i>`).join('')}</div>
    <p class="combo">Mejor combo de Markov: ${rachaMaxima(b.dias)} aciertos seguidos · de «lo más frecuente»: ${rachaMaxima(b.dias, 'frecuencia')}</p>`;
  $('prueba-sub').textContent = `Últimos ${b.n} días hábiles (${fechaCorta(b.desde)} a ${fechaCorta(b.hasta)}). Cada día se estima la matriz solo con los ${aj.ventana} días anteriores y se predice la categoría del día siguiente.`;
  const dif = (r.diferencia * 100).toFixed(1).replace('.', ',');
  const err = (r.error * 100).toFixed(1).replace('.', ',');
  $('prueba-nota').innerHTML = `Diferencia con la mejor línea base (${NOMBRE_MODELO[r.rival]}): <strong>${r.diferencia > 0 ? '+' : ''}${dif} puntos</strong>, con un error estándar de ±${err}. Solo se declara ganador si la diferencia pasa de dos errores estándar. Azar puro con ${aj.k} categorías: ${fmtProb(1 / aj.k)}.`;
}

function pintarPronostico(m) {
  $('pronostico').innerHTML = svgPronostico(m.pronostico, m.pi, m.estados, { W: anchoDe('pronostico', 440) });
  $('hud').innerHTML = m.estados.map((e, j) => `<div class="medidor"><span class="hud-n ${e.clase}-p">${fmtProb(m.pi[j])}</span><span class="hud-l">a la larga en «${esc(e.nombre.toLowerCase())}»; vuelve cada ${Number.isFinite(m.regreso[j]) ? m.regreso[j].toFixed(1).replace('.', ',') : '∞'} días hábiles</span></div>`).join('');
}

/** Ancho real del contenedor (para que el texto del SVG no se encoja en móvil). */
function anchoDe(id, porDefecto) {
  const w = $(id).clientWidth;
  return w ? Math.max(320, Math.min(900, Math.round(w))) : porDefecto;
}

function recalcular() {
  if (!datos) return;
  const aj = ajustes();
  $('n-out').textContent = aj.horizonte === 1 ? '1 día' : `${aj.horizonte} días`;
  const m = modelar(cambios, aj);
  const b = backtest(cambios, { ...aj, pruebas: PRUEBAS });
  pintarRespuesta(m, b);
  $('diagrama').innerHTML = svgDiagrama(m.P, m.estados, { actual: m.actual, titulo: `Cadena de ${aj.k} estados` });
  pintarMatriz(m);
  pintarPrueba(b, aj, m);
  pintarPronostico(m);
  $('serie').innerHTML = svgSerie(datos.serie, { dias: Math.max(400, aj.ventana + 30), ventana: aj.ventana, W: anchoDe('serie', 720), H: 240 });
}

async function iniciar() {
  iniciarTema($('tema'));
  document.querySelectorAll('.controles input').forEach((el) => el.addEventListener('input', recalcular));
  try {
    datos = await cargarTRM('');
  } catch (e) {
    $('veredicto').innerHTML = '<span class="cargando-txt">Sin datos</span>';
    $('explica').textContent = 'No se pudo leer ni la API de datos.gov.co ni el archivo de respaldo. Revisa la conexión y recarga la página.';
    $('estado').innerHTML = `<span class="chip chip-error">Error</span><span class="motivo">${esc(e.message)}</span>`;
    $('diagrama').innerHTML = '<p class="vacio">Sin datos para dibujar la cadena.</p>';
    return;
  }
  cambios = cambiosPct(datos.serie);
  $('estado').innerHTML = chipEstado();
  recalcular();
  let espera;
  let anchoPrevio = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === anchoPrevio) return;
    anchoPrevio = window.innerWidth;
    clearTimeout(espera);
    espera = setTimeout(recalcular, 150);
  });
}

iniciar();
