/* Mapas de Santos — gera mapas coropléticos de qualquer indicador por bairro, zona ou território.
   Tudo roda no navegador: nada é enviado para servidor nenhum. */
(function () {
'use strict';

const BASE = window.SANTOS_BASE;
const TOPO = BASE.topo;
const OBJ = TOPO.objects.bairros;
const LIMITE_CONT = topojson.feature(TOPO, TOPO.objects.limite);   // contorno da área continental (fundo)
const W = 1200, H = 860;
const AREA = { x: 24, y: 100, w: 820, h: 715 };          // área principal do mapa
const COL = { x: 868, y: 100, w: 308 };                   // coluna da direita (quadro + legendas)
const INSET = { x: COL.x, y: COL.y, w: COL.w, h: 270 };
const CHAVE_ESTADO = 'mapas-santos:estado:v1';
const CHAVE_TERR = 'mapas-santos:territorios:v1';

const NIVEIS = [
  { id: 'bairro', nome: 'Bairro', curto: 'Bairro' },
  { id: 'zona', nome: 'Zona (Orla, Intermediária, Noroeste…)', curto: 'Zona' },
  { id: 'regiao', nome: 'Região — Prefeitura Regional (oficial)', curto: 'Região' },
  { id: 'cras', nome: 'Território de CRAS', curto: 'Território CRAS' },
  { id: 'creas', nome: 'Território de CREAS', curto: 'Território CREAS' },
  { id: 'saude', nome: 'Território de saúde (UBS/USF)', curto: 'Território de saúde' },
];
const POR = { bairro: 'bairro', zona: 'zona', regiao: 'região', cras: 'território de CRAS', creas: 'território de CREAS', saude: 'território de saúde' };
const nivelPorId = Object.fromEntries(NIVEIS.map(n => [n.id, n]));

const PALETAS = [
  { id: 'YlOrRd', nome: 'Amarelo → vermelho' },
  { id: 'Reds', nome: 'Vermelhos' },
  { id: 'Oranges', nome: 'Laranjas' },
  { id: 'Blues', nome: 'Azuis' },
  { id: 'Greens', nome: 'Verdes' },
  { id: 'Purples', nome: 'Roxos' },
  { id: 'PuBuGn', nome: 'Azul-esverdeado' },
  { id: 'Greys', nome: 'Cinzas' },
  { id: 'semaforo', nome: 'Semáforo (verde → vermelho)' },
  { id: 'quali', nome: 'Cores distintas (categorias)' },
  { id: 'custom', nome: 'Personalizada (escolha 2 cores)' },
];

const EQUIP = [
  { grupo: 'Assistência social', tipo: 'CRAS', cor: '#b0175f', simb: 'square', tam: 90 },
  { grupo: 'Assistência social', tipo: 'CREAS', cor: '#5b2c8f', simb: 'diamond', tam: 90 },
  { grupo: 'Assistência social', tipo: 'Centro POP', cor: '#5b2c8f', simb: 'triangle', tam: 80 },
  { grupo: 'Assistência social', tipo: 'Centro de Convivência', cor: '#d9649b', simb: 'circle', tam: 45 },
  { grupo: 'Saúde', tipo: 'UBS / USF', cor: '#1557a8', simb: 'cross', tam: 80 },
  { grupo: 'Saúde', tipo: 'UPA / Pronto-Socorro', cor: '#d6402b', simb: 'cross', tam: 110 },
  { grupo: 'Saúde', tipo: 'CAPS', cor: '#00897b', simb: 'diamond', tam: 70 },
  { grupo: 'Saúde', tipo: 'Hospital', cor: '#0b3a73', simb: 'square', tam: 70 },
  { grupo: 'Educação', tipo: 'Escola municipal (UME)', cor: '#2e7d32', simb: 'triangle', tam: 55 },
  { grupo: 'Educação', tipo: 'Escola estadual', cor: '#e07b00', simb: 'triangle', tam: 55 },
  { grupo: 'Educação', tipo: 'Educação conveniada', cor: '#8bbf6a', simb: 'circle', tam: 35 },
];
const NOME_CONTAGEM = {
  'CRAS': 'Nº de CRAS (inclui NIAS)', 'CREAS': 'Nº de CREAS', 'Centro POP': 'Nº de Centros POP', 'Centro de Convivência': 'Nº de centros de convivência',
  'UBS / USF': 'Nº de UBS / USF', 'UPA / Pronto-Socorro': 'Nº de UPAs / prontos-socorros', 'CAPS': 'Nº de CAPS', 'Hospital': 'Nº de hospitais',
  'Escola municipal (UME)': 'Nº de escolas municipais (UME)', 'Escola estadual': 'Nº de escolas estaduais', 'Educação conveniada': 'Nº de unidades de educação conveniadas',
};
const equipPorTipo =Object.fromEntries(EQUIP.map(e => [e.tipo, e]));
const SIMB = { square: d3.symbolSquare, diamond: d3.symbolDiamond, triangle: d3.symbolTriangle, circle: d3.symbolCircle, cross: d3.symbolCross };

const FONTE_SVG = 'Segoe UI, system-ui, -apple-system, Helvetica Neue, Arial, sans-serif';
const COR_VAZIO = '#e3e5e0';
const COR_TINTA = '#1f2a30';

// ------------------------------------------------------------------ utilidades
const $ = s => document.querySelector(s);
const chave = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const PREFIXOS = new Set(['cras', 'creas', 'ubs', 'usf', 'unidade', 'territorio', 'regiao', 'zona', 'prefeitura', 'regional', 'bairro', 'jardim', 'da', 'do', 'de', 'das', 'dos', 'e']);
function semPrefixo(k) {
  const p = k.split(' ');
  while (p.length > 1 && PREFIXOS.has(p[0])) p.shift();
  return p.join(' ');
}
const semConectivos = k => k.split(' ').filter(w => !['da', 'do', 'de', 'das', 'dos', 'e'].includes(w)).join(' ');
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* */ } };

function parseNum(s) {
  if (s == null) return null;
  let t = String(s).trim().replace(/\s/g, '').replace(/%$/, '').replace(/^R\$/, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function casasDecimais(vals) {
  let c = 0;
  for (const v of vals) { const s = String(v); const i = s.indexOf('.'); if (i >= 0) c = Math.max(c, s.length - i - 1); }
  return Math.min(c, 2);
}
const fmtNum = (v, c) => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: c ?? 2 });
const baixar = (nome, conteudo, tipo) => {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const slug = s => chave(s).replace(/ /g, '-').slice(0, 60) || 'mapa';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------------ territórios (editáveis)
// nomes antigos (ou por extenso) que continuam sendo reconhecidos ao colar dados
const SINONIMOS = {
  'CRAS Centro': ['CRAS Centro Histórico e Área Continental', 'CRAS Região Central Histórica', 'CRAS RCH', 'CRAS Centro Histórico'],
  'CRAS ZOI': ['CRAS Orla e Intermediária', 'CRAS Zona da Orla e Intermediária', 'CRAS Orla', 'CRAS Zona da Orla'],
  'CREAS ZL': ['CREAS Zona Leste'],
  'CREAS ZNO': ['CREAS Zona Noroeste e Morros', 'CREAS Zona Noroeste', 'CREAS ZNO e Morros'],
  'NIAS CEU das Artes': ['NIAS CEU das Artes (extensão do CRAS)', 'CEU das Artes'],
  'NIAS Área Continental': ['NIAS Área Continental (extensão do CRAS)', 'NIAS AC'],
};
const NOME_ATUAL = {};
for (const [novo, antigos] of Object.entries(SINONIMOS)) for (const a of antigos) NOME_ATUAL[a] = novo;
const TERR_PADRAO = BASE.territorios.map(t => ({ ...t }));
const REGIAO_FIXA = Object.fromEntries(TERR_PADRAO.map(t => [t.bairro, t.regiao]));
const CONTINENTAL = b => REGIAO_FIXA[b] === 'Área Continental';
let TERR = carregarTerritorios();
let terrPorBairro = {};
function carregarTerritorios() {
  const salvo = lsGet(CHAVE_TERR);
  const base = TERR_PADRAO.map(t => ({ ...t }));
  if (salvo && typeof salvo === 'object') base.forEach(t => {
    const ed = Object.assign({}, salvo[t.bairro] || {});
    for (const c of Object.keys(ed)) if (NOME_ATUAL[ed[c]]) ed[c] = NOME_ATUAL[ed[c]];   // edições feitas com nomes antigos
    Object.assign(t, ed);
  });
  return base;
}
function indexarTerritorios() { terrPorBairro = Object.fromEntries(TERR.map(t => [t.bairro, t])); }
function salvarTerritorios() {
  const dif = {};
  TERR.forEach((t, i) => {
    const p = TERR_PADRAO[i], d = {};
    ['zona', 'cras', 'creas', 'saude'].forEach(c => { if (t[c] !== p[c]) d[c] = t[c]; });
    if (Object.keys(d).length) dif[t.bairro] = d;
  });
  if (Object.keys(dif).length) lsSet(CHAVE_TERR, dif); else lsDel(CHAVE_TERR);
}
indexarTerritorios();
const grupoDe = (bairro, nivel) => nivel === 'bairro' ? bairro : (terrPorBairro[bairro] || {})[nivel] || '(sem território)';
function areasDo(nivel) {
  const s = new Set(TERR.map(t => grupoDe(t.bairro, nivel)));
  return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
function bairrosDe(area, nivel) { return TERR.filter(t => grupoDe(t.bairro, nivel) === area).map(t => t.bairro); }

// índice de nomes para reconhecer o que o usuário colou
function indiceNomes(nivel) {
  const forte = new Map(), fraco = new Map();
  const add = (m, k, nome) => { if (!k) return; if (!m.has(k)) m.set(k, new Set()); m.get(k).add(nome); };
  for (const nome of areasDo(nivel)) {
    const k = chave(nome);
    add(forte, k, nome); add(forte, semPrefixo(k), nome);
    add(forte, semConectivos(k), nome); add(forte, semConectivos(semPrefixo(k)), nome);
    if (k.startsWith('morro ')) add(fraco, k.slice(6), nome);
    if (nivel === 'saude') add(fraco, semPrefixo(k.replace(/\b(ubs|usf|pa)\b/g, ' ').replace(/\s+/g, ' ').trim()), nome);
  }
  const nomesNivel = new Set(areasDo(nivel));
  for (const [novo, antigos] of Object.entries(SINONIMOS)) if (nomesNivel.has(novo))
    for (const a of antigos) { add(forte, chave(a), novo); add(fraco, semPrefixo(chave(a)), novo); }
  const idx = new Map();
  for (const [k, s] of fraco) if (s.size === 1) idx.set(k, [...s][0]);
  for (const [k, s] of forte) if (s.size === 1) idx.set(k, [...s][0]);
  return { idx, nomes: areasDo(nivel) };
}
function reconhecer(texto, ind) {
  const k = chave(texto); if (!k) return null;
  const tent0 = [k, semPrefixo(k), semPrefixo(k.replace(/^(bairro|jardim) /, ''))];
  const tent = tent0.concat(tent0.map(semConectivos));
  for (const t of tent) if (ind.idx.has(t)) return ind.idx.get(t);
  const comeca = ind.nomes.filter(n => { const c = semPrefixo(chave(n)); return c.startsWith(semPrefixo(k) + ' ') || chave(n).startsWith(k + ' '); });
  return comeca.length === 1 ? comeca[0] : null;
}

// ------------------------------------------------------------------ estado
const PADRAO = {
  texto: '', nivelDados: 'bairro', nivelMapa: 'bairro', agregacao: 'soma', indicador: 0,
  titulo: '', fonte: '', tipo: 'auto', paleta: 'YlOrRd', classes: 5, metodo: 'jenks', inverter: false,
  rotulos: 'dados', vista: 'composto', mostrarValores: false, divisas: true, equip: ['CRAS'],
  cortesManuais: '', corIni: '#fff3c4', corFim: '#99000d', legEdit: {}, legTitulo: '', legContagem: true,
  legSemDado: true, semDadoTexto: '', corSemDado: 'hachura', unidade: '', casas: 'auto', subtitulo: '',
  tamRotulo: 100, escalaNorte: true, faixas: [], modo: '2d', exagero: 1, realcar: true,
};
let E = Object.assign({}, PADRAO, lsGet(CHAVE_ESTADO) || {});
if (!E.legEdit || typeof E.legEdit !== 'object') E.legEdit = {};
if (!Array.isArray(E.faixas)) E.faixas = [];
if (!E.faixas.length && E.cortesManuais) E.faixas = lerCortes(E.cortesManuais).map(ate => ({ ate, rotulo: '', cor: '' }));   // versão anterior
// versão anterior guardava só "até"; converte para faixas com De e Até
if (E.faixas.length && E.faixas.every(f => f.de === undefined)) {
  const ord = E.faixas.filter(f => Number.isFinite(f.ate)).sort((a, b) => a.ate - b.ate);
  E.faixas = ord.map((f, i) => ({ de: i ? ord[i - 1].ate : null, deExcl: i > 0, ate: f.ate, rotulo: f.rotulo || '', cor: f.cor || '' }));
  if (ord.length) E.faixas.push({ de: ord[ord.length - 1].ate, deExcl: true, ate: null, rotulo: (E.faixaAcima || {}).rotulo || '', cor: (E.faixaAcima || {}).cor || '' });
}
delete E.faixaAcima;
let DADOS = { colunas: [], linhas: new Map() };   // linhas: área (nível dos dados) -> [valores brutos]
const salvarEstado = () => lsSet(CHAVE_ESTADO, E);

// ------------------------------------------------------------------ leitura do texto colado
function dividirTexto(texto) {
  const linhas = texto.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  if (!linhas.length) return [];
  const sep = texto.includes('\t') ? '\t' : (linhas.some(l => l.includes(';')) ? ';' : (linhas.some(l => /,\s*\S/.test(l) && !/\d,\d/.test(l)) ? ',' : null));
  return linhas.map(l => {
    if (sep) return l.split(sep).map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    const m = l.match(/^(.*?)[\s:=]+(-?[\d.,]+%?|\S+)$/);           // "Rádio Clube 1"
    return m ? [m[1].trim(), m[2].trim()] : [l.trim()];
  });
}
function interpretar(texto, nivelForcado) {
  const tab = dividirTexto(texto);
  if (!tab.length) return null;
  // escolhe o nível com mais nomes reconhecidos (empate: ordem da lista)
  let melhor = null;
  for (const n of NIVEIS) {
    if (nivelForcado && n.id !== nivelForcado) continue;
    const ind = indiceNomes(n.id);
    // "CRAS Rádio Clube" é território de CRAS, não o bairro Rádio Clube: o prefixo decide o nível
    const prefixoOk = r => { const k = chave(r[0]); const pre = (k.match(/^(cras|creas|ubs|usf)\b/) || [])[1];
      return !pre || n.id === ({ cras: 'cras', creas: 'creas', ubs: 'saude', usf: 'saude' })[pre]; };
    const ok = tab.filter(r => prefixoOk(r) && reconhecer(r[0], ind)).length;
    const exatos = tab.filter(r => ind.nomes.some(nm => chave(nm) === chave(r[0]))).length;
    if (!melhor || ok > melhor.ok || (ok === melhor.ok && exatos > melhor.exatos)) melhor = { nivel: n.id, ind, ok, exatos };
  }
  let cab = null, corpo = tab;
  if (!reconhecer(tab[0][0], melhor.ind) && tab.length > 1) { cab = tab[0]; corpo = tab.slice(1); }
  const ncol = Math.max(2, ...corpo.map(r => r.length));
  const colunas = [];
  for (let i = 1; i < ncol; i++) colunas.push((cab && cab[i]) || (ncol > 2 ? 'Valor ' + i : 'Valor'));
  const linhas = new Map(), naoReconhecidos = [], repetidos = [];
  for (const r of corpo) {
    const a = reconhecer(r[0], melhor.ind);
    if (!a) { if (r[0]) naoReconhecidos.push(r[0]); continue; }
    if (linhas.has(a)) repetidos.push(a);
    linhas.set(a, colunas.map((_, i) => r[i + 1] ?? ''));
  }
  return { nivel: melhor.nivel, colunas, linhas, naoReconhecidos, repetidos, cabecalho: cab ? cab[0] : null };
}
function textoDosDados() {
  const cab = [nivelPorId[E.nivelDados].curto, ...DADOS.colunas].join('\t');
  const corpo = [...DADOS.linhas].map(([a, v]) => [a, ...v].join('\t'));
  return [cab, ...corpo].join('\n');
}

// ------------------------------------------------------------------ valores por área do mapa
function calcular() {
  const ci = Math.min(E.indicador, Math.max(0, DADOS.colunas.length - 1));
  const bruto = new Map();
  for (const [a, v] of DADOS.linhas) { const x = (v[ci] ?? '').toString().trim(); if (x !== '') bruto.set(a, x); }
  const nd = E.nivelDados, nm = E.nivelMapa;
  const res = new Map();   // área do mapa -> {v, n, total}
  if (nd === nm) {
    for (const [a, x] of bruto) res.set(a, { v: x });
  } else if (nm === 'bairro') {
    for (const t of TERR) { const g = grupoDe(t.bairro, nd); if (bruto.has(g)) res.set(t.bairro, { v: bruto.get(g), herdado: g }); }
  } else {
    const grupos = new Map();
    for (const t of TERR) {
      const g = grupoDe(t.bairro, nm);
      if (!grupos.has(g)) grupos.set(g, { vals: [], total: 0 });
      grupos.get(g).total++;
      if (bruto.has(t.bairro)) grupos.get(g).vals.push(bruto.get(t.bairro));
    }
    for (const [g, o] of grupos) {
      if (!o.vals.length) continue;
      const nums = o.vals.map(parseNum);
      let v;
      if (nums.every(n => n != null)) {
        v = E.agregacao === 'soma' ? d3.sum(nums) : E.agregacao === 'media' ? d3.mean(nums) : E.agregacao === 'max' ? d3.max(nums) : d3.min(nums);
        v = String(Math.round(v * 100) / 100);
      } else {
        v = d3.greatest(d3.rollups(o.vals, x => x.length, x => x), d => d[1])[0];   // categoria mais frequente
      }
      res.set(g, { v, n: o.vals.length, total: o.total });
    }
  }
  return { valores: res, coluna: DADOS.colunas[ci] || '' };
}

const ORDEM_TEXTO = ['muito baixa', 'muito baixo', 'baixissima', 'baixissimo', 'baixa', 'baixo', 'media baixa', 'medio baixo', 'media', 'medio', 'moderada', 'moderado', 'media alta', 'medio alto', 'alta', 'alto', 'muito alta', 'muito alto', 'altissima', 'altissimo'];
function classificar(valores) {
  const lista = [...valores.values()].map(o => o.v);
  if (!lista.length) return null;
  const nums = lista.map(parseNum);
  const todosNum = nums.every(n => n != null);
  const distintos = [...new Set(lista.map(x => todosNum ? parseNum(x) : x))];
  let tipo = E.tipo;
  if (tipo === 'auto') tipo = !todosNum || (nums.every(Number.isInteger) && distintos.length <= 7 && d3.max(nums) <= 10 && d3.min(nums) >= 0) ? 'cat' : 'num';
  if (E.tipo === 'auto' && E.metodo === 'manual' && todosNum && faixasValidas().length) tipo = 'num';
  if (tipo === 'num' && !todosNum) tipo = 'cat';
  const pal = E.paleta;

  if (tipo === 'cat') {
    let cats;
    if (todosNum) cats = distintos.sort((a, b) => a - b);
    else {
      const pos = c => { const i = ORDEM_TEXTO.indexOf(chave(c)); return i < 0 ? 999 : i; };
      cats = distintos.map(String).sort((a, b) => pos(a) - pos(b) || (pos(a) === 999 ? lista.indexOf(a) - lista.indexOf(b) : 0));
    }
    const cores = coresDe(pal, cats.length, true);
    const casas = !todosNum ? 0 : E.casas === 'auto' ? casasDecimais(cats) : +E.casas;
    const contar = c => lista.filter(x => String(todosNum ? parseNum(x) : x) === String(c)).length;
    const itens = cats.map((c, i) => ({ chave: 'cat:' + c, corPadrao: cores[i % cores.length], rotuloPadrao: todosNum ? fmtNum(c, casas) : String(c), n: contar(c), i }));
    aplicarEdicaoLegenda(itens);
    const cor = new Map(cats.map((c, i) => [String(c), itens[i].cor]));
    return {
      tipo, todosNum,
      corDe: x => cor.get(String(todosNum ? parseNum(x) : x)) || COR_VAZIO,
      legenda: itens,
      // se a categoria foi renomeada na legenda (ex.: 1 → "Alta"), o mapa usa o mesmo texto
      fmt: x => { const it = itens.find(i => i.chave === 'cat:' + (todosNum ? parseNum(x) : x)); return it && E.legEdit[it.chave] && E.legEdit[it.chave].rotulo ? it.rotulo : (todosNum ? fmtNum(parseNum(x), casas) : x); },
    };
  }
  // numérico em faixas
  const vals = nums.slice().sort((a, b) => a - b);
  const casas = E.casas === 'auto' ? casasDecimais(vals) : +E.casas;
  const fn = v => fmtNum(v, casas);
  const fv = v => comUnidade(fn(v));
  if (E.metodo === 'manual' && faixasValidas().length) return classificarFaixasMontadas(vals, fn, pal);
  const fxs = [];
  let cortes = [];
  const manual = false;
  if (!manual) {
    const k = Math.min(+E.classes, new Set(vals).size);
    const unicos = [...new Set(vals)];
    cortes = unicos.length <= k ? unicos.slice(0, -1) : quebras(vals, k, E.metodo === 'manual' ? 'jenks' : E.metodo);   // poucos valores: uma faixa para cada
    cortes = [...new Set(cortes)].filter(c => c >= vals[0] && c < vals[vals.length - 1]).sort((a, b) => a - b);
  }
  // faixa i: valores <= cortes[i]
  const faixa = v => { let i = 0; while (i < cortes.length && v > cortes[i]) i++; return i; };
  const nfx = cortes.length + 1;
  const cores = coresDe(pal, nfx, false);
  const membros = d3.range(nfx).map(() => []);
  vals.forEach(v => membros[faixa(v)].push(v));
  let itens;
  if (manual) {
    // faixas fixas: aparecem todas, mesmo vazias, com textos "até / a / acima de"
    const inteiros = vals.every(Number.isInteger) && cortes.every(Number.isInteger) && (E.casas === 'auto' || +E.casas === 0);
    itens = d3.range(nfx).map(i => {
      const lo = cortes[i - 1], hi = cortes[i];
      const r = comUnidade(i === 0 ? `Até ${fn(hi)}` : i === nfx - 1 ? `Acima de ${fn(lo)}` : inteiros ? `${fn(lo + 1)} a ${fn(hi)}` : `Acima de ${fn(lo)} até ${fn(hi)}`);
      const f = i < fxs.length ? fxs[i] : E.faixaAcima;
      return { chave: `faixa:${i}`, corPadrao: cores[i], rotuloPadrao: r, n: membros[i].length, i,
        cor: f.cor || cores[i], rotulo: f.rotulo || r, editado: !!(f.cor || f.rotulo) };
    });
  } else {
    itens = membros.map((m, i) => m.length ? ({ chave: `num:${m[0]}|${m[m.length - 1]}`, corPadrao: cores[i],
      rotuloPadrao: m[0] === m[m.length - 1] ? fv(m[0]) : comUnidade(`${fn(m[0])} – ${fn(m[m.length - 1])}`), n: m.length, i }) : null).filter(Boolean);
  }
  if (!manual) aplicarEdicaoLegenda(itens);
  const corFinal = cores.slice();
  itens.forEach(it => { corFinal[it.i] = it.cor; });
  return { tipo, todosNum: true, manual, cortes, corDe: x => corFinal[faixa(parseNum(x))], legenda: itens, fmt: x => fv(parseNum(x)) };
}
// ---- faixas montadas pela usuária: cada uma com De e Até (qualquer um pode ficar vazio)
const COR_FORA = '#c4c8c1';
const fin = v => v != null && Number.isFinite(v);
function faixasValidas() {
  return E.faixas.filter(f => f && (fin(f.de) || fin(f.ate)))
    .sort((a, b) => (fin(a.de) ? a.de : -Infinity) - (fin(b.de) ? b.de : -Infinity) || (fin(a.ate) ? a.ate : Infinity) - (fin(b.ate) ? b.ate : Infinity));
}
function dentroDaFaixa(f, v) {
  const okDe = !fin(f.de) || (f.deExcl ? v > f.de : v >= f.de);
  const okAte = !fin(f.ate) || v <= f.ate;
  return okDe && okAte;
}
function rotuloFaixa(f, fn) {
  if (fin(f.de) && fin(f.ate) && f.de === f.ate && !f.deExcl) return comUnidade(fn(f.de));
  if (fin(f.de) && fin(f.ate)) return comUnidade(f.deExcl ? `Acima de ${fn(f.de)} até ${fn(f.ate)}` : `${fn(f.de)} a ${fn(f.ate)}`);
  if (fin(f.ate)) return comUnidade(`Até ${fn(f.ate)}`);
  return comUnidade(f.deExcl ? `Acima de ${fn(f.de)}` : `${fn(f.de)} ou mais`);
}
function classificarFaixasMontadas(vals, fn, pal) {
  const fxs = faixasValidas();
  const cores = coresDe(pal, fxs.length, false);
  const qual = v => fxs.findIndex(f => dentroDaFaixa(f, v));
  const n = fxs.map(() => 0); let fora = 0;
  vals.forEach(v => { const i = qual(v); if (i < 0) fora++; else n[i]++; });
  const itens = fxs.map((f, i) => {
    const r = rotuloFaixa(f, fn);
    return { chave: 'faixa:' + i, i, corPadrao: cores[i], rotuloPadrao: r, n: n[i], cor: f.cor || cores[i], rotulo: f.rotulo || r, editado: !!(f.cor || f.rotulo) };
  });
  if (fora) itens.push({ chave: 'fora', i: -1, cor: COR_FORA, rotulo: 'Fora das faixas', rotuloPadrao: 'Fora das faixas', n: fora, fora: true });
  return { tipo: 'num', todosNum: true, manual: true, fora, min: vals[0], max: vals[vals.length - 1],
    corDe: x => { const i = qual(parseNum(x)); return i < 0 ? COR_FORA : itens[i].cor; }, legenda: itens, fmt: x => comUnidade(fn(parseNum(x))) };
}
// "21-36; 37-45", "até 20", "acima de 45", "46 ou mais"
function lerFaixasTexto(txt) {
  const out = [];
  for (let parte of String(txt).split(/[;\n|]/)) {
    parte = parte.trim().toLowerCase(); if (!parte) continue;
    const num = '(-?[\\d.,]+)\\s*%?';
    let m;
    if ((m = parte.match(new RegExp('^(?:de\\s+)?' + num + '\\s*(?:-|–|a|até|ate)\\s*' + num + '$')))) out.push({ de: parseNum(m[1]), ate: parseNum(m[2]) });
    else if ((m = parte.match(new RegExp('^(?:até|ate|<=|menos de)\\s*' + num + '$')))) out.push({ de: null, ate: parseNum(m[1]) });
    else if ((m = parte.match(new RegExp('^(?:acima de|mais de|>)\\s*' + num + '$')))) out.push({ de: parseNum(m[1]), deExcl: true, ate: null });
    else if ((m = parte.match(new RegExp('^' + num + '\\s*(?:ou mais|\\+|em diante)$')))) out.push({ de: parseNum(m[1]), ate: null });
    else return { erro: parte };
  }
  return { faixas: out.filter(f => fin(f.de) || fin(f.ate)).map(f => ({ de: f.de, deExcl: !!f.deExcl, ate: f.ate, rotulo: '', cor: '' })) };
}
function aplicarEdicaoLegenda(itens) {
  for (const it of itens) {
    const ed = E.legEdit[it.chave] || {};
    it.cor = ed.cor || it.corPadrao;
    it.rotulo = ed.rotulo || it.rotuloPadrao;
    it.editado = !!(ed.cor || ed.rotulo);
  }
}
function lerCortes(txt) {
  let t = String(txt || '').trim();
  if (!t) return [];
  const partes = t.includes(';') || t.includes('|') || t.includes('\n') ? t.split(/[;|\n]/) : (/,\s/.test(t) ? t.split(/,\s+/) : t.split(/\s+/));
  return [...new Set(partes.map(parseNum).filter(v => v != null))].sort((a, b) => a - b);
}
function comUnidade(s) {
  const u = (E.unidade || '').trim();
  if (!u) return s;
  return /^[%‰ºª°]/.test(u) ? s + u : s + ' ' + u;
}
function quebras(vals, k, metodo) {
  if (k <= 1) return [];
  const min = vals[0], max = vals[vals.length - 1];
  if (metodo === 'igual') return d3.range(1, k).map(i => min + (max - min) * i / k);
  if (metodo === 'quantil') return d3.range(1, k).map(i => d3.quantileSorted(vals, i / k));
  return jenks(vals, k);
}
function jenks(data, k) {      // Fisher–Jenks clássico (dados já ordenados)
  const n = data.length;
  if (k >= n) return data.slice(0, -1);
  const lower = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  const vari = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { lower[1][j] = 1; vari[1][j] = 0; }
  for (let l = 2; l <= n; l++) {
    let s1 = 0, s2 = 0, w = 0, v = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1, val = data[i3 - 1];
      s2 += val * val; s1 += val; w++;
      v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) for (let j = 2; j <= k; j++) if (vari[l][j] >= v + vari[i4][j - 1]) { lower[l][j] = i3; vari[l][j] = v + vari[i4][j - 1]; }
    }
    lower[l][1] = 1; vari[l][1] = v;
  }
  const cortes = []; let kk = n;
  for (let j = k; j >= 2; j--) { const id = lower[kk][j] - 2; cortes.unshift(data[id]); kk = lower[kk][j] - 1; }
  return cortes;
}
function coresDe(pal, k, categorico) {
  let c;
  if (pal === 'custom') c = k === 1 ? [E.corFim] : d3.quantize(d3.interpolateLab(E.corIni, E.corFim), k);
  else if (pal === 'quali') c = d3.range(k).map(i => d3.schemeTableau10[i % 10]);
  else if (pal === 'semaforo') c = k <= 2 ? ['#1a9850', '#d73027'].slice(0, k) : d3.schemeRdYlGn[Math.min(k, 11)].slice().reverse();
  else {
    const esq = d3['scheme' + pal];
    if (k >= 3) c = esq[Math.min(k, 9)].slice();
    else c = k === 1 ? [esq[3][2]] : [esq[3][0], esq[3][2]];
    if (categorico && k >= 3 && k <= 7) c = esq[Math.min(k + 1, 9)].slice(1);   // evita o tom quase branco nas categorias
    if (k > 9) c = d3.quantize(d3['interpolate' + pal], k);
  }
  if (c.length < k) c = d3.range(k).map(i => c[i % c.length]);
  c = c.map(x => d3.color(x).formatHex());
  return E.inverter ? c.slice(0, k).reverse() : c.slice(0, k);
}

// ------------------------------------------------------------------ geometria
const GEOMS = OBJ.geometries;
const nomeGeom = g => g.properties.nome;
function partesDaVista(vista) {
  const ilha = GEOMS.filter(g => !CONTINENTAL(nomeGeom(g)));
  const cont = GEOMS.filter(g => CONTINENTAL(nomeGeom(g)));
  const fc = (gs, comLimite) => ({ type: 'FeatureCollection', features: gs.map(g => topojson.feature(TOPO, g)).concat(comLimite ? LIMITE_CONT.features : []) });
  const proj = (gs, box, pad, comLimite) => d3.geoMercator().fitExtent([[box.x + pad, box.y + pad], [box.x + box.w - pad, box.y + box.h - pad]], fc(gs, comLimite));
  if (vista === 'ilha') return [{ id: 'ilha', geoms: ilha, proj: proj(ilha, AREA, 16), principal: true }];
  if (vista === 'continente') return [{ id: 'cont', geoms: cont, proj: proj(cont, AREA, 16, true), principal: true, fundo: true }];
  if (vista === 'completo') return [{ id: 'todo', geoms: GEOMS, proj: proj(GEOMS, AREA, 16, true), principal: true, fundo: true }];
  return [
    { id: 'ilha', geoms: ilha, proj: proj(ilha, AREA, 16), principal: true },
    { id: 'cont', geoms: cont, proj: proj(cont, { ...INSET, y: INSET.y + 24, h: INSET.h - 24 }, 10, true), principal: false, quadro: INSET, fundo: true },
  ];
}

// ------------------------------------------------------------------ desenho
const svg = d3.select('#mapa');
let zoom, gZoom, escalaZoom = 1;
let ULTIMO = null;
let VISTA_ANTERIOR = null;   // último cálculo (para exportar CSV)

function desenhar() {
  const { valores, coluna } = calcular();
  const cls = classificar(valores);
  ULTIMO = { valores, coluna, cls };
  const nm = E.nivelMapa;
  const temDados = valores.size > 0;
  svg.selectAll('*').remove();
  svg.attr('font-family', FONTE_SVG);

  const defs = svg.append('defs');
  defs.append('clipPath').attr('id', 'clip-area').append('rect').attr('x', AREA.x).attr('y', AREA.y).attr('width', AREA.w).attr('height', AREA.h);
  const pat = defs.append('pattern').attr('id', 'hachura').attr('patternUnits', 'userSpaceOnUse').attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
  pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#f1f2ee');
  pat.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#c9ccc5').attr('stroke-width', 1.4);

  svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#ffffff');

  // cabeçalho
  const tit = E.titulo || (temDados ? (coluna && !/^valor/i.test(coluna) ? coluna : 'Indicador') + ' por ' + POR[nm] : 'Santos — bairros e territórios');
  svg.append('text').attr('x', 36).attr('y', 50).attr('font-size', 26).attr('font-weight', 700).attr('fill', COR_TINTA).text(tit);
  let sub = 'Município de Santos/SP · ' + nivelPorId[nm].nome;
  if (temDados && E.nivelDados !== nm) sub += E.nivelDados === 'bairro' ? ` · ${{ soma: 'soma', media: 'média', max: 'maior valor', min: 'menor valor' }[E.agregacao]} dos bairros` : ' · valor ' + { zona: 'da zona', regiao: 'da região', cras: 'do território de CRAS', creas: 'do território de CREAS', saude: 'do território de saúde' }[E.nivelDados];
  if (!temDados) sub = 'Cole seus dados no painel ao lado para colorir o mapa';
  else if (E.subtitulo) sub = E.subtitulo;
  svg.append('text').attr('x', 36).attr('y', 78).attr('font-size', 15).attr('fill', '#5b6870').text(sub);

  const partes = partesDaVista(E.vista);
  gZoom = svg.append('g').attr('clip-path', 'url(#clip-area)').append('g').attr('class', 'zoomavel');
  const valorDe = area => valores.get(area);
  const corArea = area => { const o = valorDe(area); return o ? cls.corDe(o.v) : (temDados ? corSemDado() : COR_VAZIO); };

  const modo3d = E.modo === '3d';
  for (const p of (modo3d ? [] : partes)) {
    let g;
    if (p.principal) g = gZoom.append('g');
    else {
      const q = p.quadro;
      const gq = svg.append('g');
      gq.append('rect').attr('x', q.x).attr('y', q.y).attr('width', q.w).attr('height', q.h).attr('fill', '#fbfbf9').attr('stroke', '#9aa3a8').attr('stroke-width', 1);
      gq.append('text').attr('x', q.x + 10).attr('y', q.y + 20).attr('font-size', 12.5).attr('font-weight', 600).attr('fill', '#5b6870').text('Área continental (escala reduzida)');
      g = gq.append('g');
    }
    const path = d3.geoPath(p.proj);
    p.path = path;
    const naParte = new Set(p.geoms.map(nomeGeom));
    if (p.fundo) g.append('path').attr('d', path(LIMITE_CONT)).attr('fill', '#f1f1ec').attr('stroke', '#a3abaf').attr('stroke-width', 0.8)
      .attr('stroke-dasharray', '3 2').attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
    const geomsPorArea = d3.group(p.geoms, gm => grupoDe(nomeGeom(gm), nm));

    // preenchimento: uma forma por área (bairros unidos quando o recorte é território)
    const formas = [...geomsPorArea].map(([area, gs]) => ({ area, gs, feat: nm === 'bairro' ? topojson.feature(TOPO, gs[0]) : topojson.merge(TOPO, gs) }));
    g.append('g').selectAll('path').data(formas).join('path')
      .attr('d', d => path(d.feat)).attr('fill', d => corArea(d.area)).attr('stroke', 'none')
      .attr('data-area', d => d.area)
      .on('mousemove', (ev, d) => dica(ev, d.area, valorDe(d.area), cls))
      .on('mouseleave', esconderDica);

    const meshF = f => topojson.mesh(TOPO, OBJ, (a, b) => naParte.has(nomeGeom(a)) && naParte.has(nomeGeom(b)) && f(a, b));
    const linha = (m, cor, larg) => g.append('path').attr('d', path(m)).attr('fill', 'none').attr('stroke', cor).attr('stroke-width', larg).attr('stroke-linejoin', 'round').attr('vector-effect', 'non-scaling-stroke').attr('pointer-events', 'none');
    if (E.divisas || nm === 'bairro') linha(meshF((a, b) => a !== b), '#ffffff', nm === 'bairro' ? 0.9 : 0.6);
    if (nm !== 'bairro') linha(meshF((a, b) => a !== b && grupoDe(nomeGeom(a), nm) !== grupoDe(nomeGeom(b), nm)), '#26343a', 1.6);
    linha(meshF((a, b) => a === b), '#26343a', 1.1);

    // equipamentos
    const tipos = new Set(E.equip);
    const pts = BASE.equipamentos.filter(e => tipos.has(e.tipo) && naParte.has(e.bairro));
    p.gEquip = g.append('g');
    p.gEquip.selectAll('path').data(pts).join('path')
      .attr('transform', e => { const [x, y] = p.proj([e.lon, e.lat]); return `translate(${x},${y})`; })
      .attr('d', e => d3.symbol(SIMB[equipPorTipo[e.tipo].simb], equipPorTipo[e.tipo].tam * (p.principal ? 1 : 0.7))())
      .attr('fill', e => equipPorTipo[e.tipo].cor).attr('stroke', '#ffffff').attr('stroke-width', 1.1)
      .on('mousemove', (ev, e) => dicaEquip(ev, e)).on('mouseleave', esconderDica);

    // rótulos
    if (E.rotulos !== 'nenhum') {
      const rot = formas.filter(f => E.rotulos === 'todos' || valorDe(f.area));
      const tamBase = (nm === 'bairro' ? (p.principal ? (E.vista === 'completo' ? 8 : 10.5) : 8.5) : (p.principal ? 13 : 10)) * (E.tamRotulo || 100) / 100;
      p.gRot = g.append('g').attr('pointer-events', 'none');
      rot.sort((a, b) => d3.geoArea(b.feat) - d3.geoArea(a.feat));
      const ocupados = [];
      for (const f of rot) {
        const [x, y] = pontoRotulo(f, nm, p.proj, path);
        if (!isFinite(x)) continue;
        const t = p.gRot.append('text').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('font-size', tamBase).attr('data-base', tamBase)
          .attr('fill', COR_TINTA).attr('stroke', '#ffffff').attr('stroke-width', 2.6).attr('stroke-linejoin', 'round').attr('paint-order', 'stroke')
          .attr('font-weight', nm === 'bairro' ? 500 : 650);
        const linhas = quebrarNome(nomeCurto(f.area, nm), nm === 'bairro' ? 14 : 18);
        const o = valorDe(f.area);
        if (E.mostrarValores && o) linhas.push(cls.fmt(o.v));
        linhas.forEach((l, i) => t.append('tspan').attr('x', x).attr('dy', i === 0 ? `${-(linhas.length - 1) * 0.55 + 0.35}em` : '1.1em')
          .attr('font-weight', E.mostrarValores && o && i === linhas.length - 1 ? 800 : null).text(l));
        afastarRotulo(t.node(), ocupados);
      }
    }
  }

  if (E.escalaNorte && !modo3d) norte();

  // legendas (coluna direita)
  let y = E.vista === 'composto' && !modo3d ? INSET.y + INSET.h + 26 : COL.y + 6;
  if (temDados) y = legendaValores(cls, coluna, y);
  if (modo3d && temDados) {
    const nota = quebrarNome(E.realcar ? 'Altura das colunas: do menor valor (mais baixa) ao maior (mais alta)' : 'Altura das colunas: proporcional ao valor', 40);
    nota.forEach((l, i) => svg.append('text').attr('x', COL.x).attr('y', y + 18 + i * 16).attr('font-size', 12.5).attr('fill', '#5b6870').text(l));
    y += 26 + (nota.length - 1) * 16;
  }
  if (!modo3d) legendaEquip(y + 8);

  // rodapé
  const fonte = E.fonte ? 'Fonte dos dados: ' + E.fonte : '';
  svg.append('text').attr('x', 36).attr('y', H - 22).attr('font-size', 12).attr('fill', '#4b585f').text(fonte);
  svg.append('text').attr('x', W - 24).attr('y', H - 22).attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', '#8a959b')
    .text('Base cartográfica: Prefeitura de Santos (GeoServer) · territórios CRAS/CREAS/saúde: aproximação editável');

  if (!modo3d) { configurarZoom(partes, VISTA_ANTERIOR === E.vista); VISTA_ANTERIOR = E.vista; }
  else VISTA_ANTERIOR = null;
  document.body.classList.toggle('modo3d', modo3d);
  if (modo3d) desenhar3D(cls, valores, nm); else $('#mapa3d').hidden = true;
  desenharGrafico(cls, valores, nm, coluna, tit);
  atualizarEditor();
  montarEditorLegenda(cls);
  montarTabelaFaixas(cls);
  $('#contagem').textContent = `(${DADOS.linhas.size} de ${areasDo(E.nivelDados).length} preenchidos)`;
}

// ponto do rótulo: para bairros, o "polo de inacessibilidade" calculado na preparação dos dados
// (sempre dentro do bairro); para territórios, o centro da maior parte, se cair dentro dela.
function pontoRotulo(f, nm, proj, path) {
  const pt = gm => gm.properties && gm.properties.lx != null ? proj([gm.properties.lx, gm.properties.ly]) : path.centroid(topojson.feature(TOPO, gm));
  if (nm === 'bairro') return pt(f.gs[0]);
  const big = maiorPoligono(f.feat);
  const c = d3.geoCentroid(big);
  if (d3.geoContains(big, c)) return proj(c);
  const maior = d3.greatest(f.gs, gm => d3.geoArea(topojson.feature(TOPO, gm)));
  return pt(maior);
}
// empurra o rótulo para cima/baixo se ele bater em outro já colocado
function afastarRotulo(el, ocupados) {
  const b = el.getBBox();
  const bate = (dy) => ocupados.some(o => b.x < o.x + o.width && b.x + b.width > o.x && b.y + dy < o.y + o.height && b.y + dy + b.height > o.y);
  const passos = [0, -0.8, 0.8, -1.5, 1.5].map(k => k * b.height);
  const dy = passos.find(d => !bate(d));
  const usar = dy == null ? 0 : dy;
  if (usar) el.setAttribute('transform', `translate(0,${usar})`);
  ocupados.push({ x: b.x, y: b.y + usar, width: b.width, height: b.height });
}
function maiorPoligono(feat) {
  const g = feat.type === 'Feature' ? feat.geometry : feat;
  if (g.type !== 'MultiPolygon') return feat;
  const polys = g.coordinates.map(c => ({ type: 'Polygon', coordinates: c }));
  return d3.greatest(polys, pl => d3.geoArea(pl));
}
// rótulo no mapa: nome completo do território (ex.: "CRAS Rádio Clube"), para não parecer nome de bairro
function nomeCurto(area, nivel) {
  return area.replace(/ \(extensão do CRAS\)$/, '');
}
function quebrarNome(s, max) {
  const out = []; let cur = '';
  for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out;
}

function norte() {
  const nx = AREA.x + AREA.w - 34, ny = AREA.y + AREA.h - 58;
  const gn = svg.append('g').attr('transform', `translate(${nx},${ny})`);
  gn.append('path').attr('d', 'M0,-16 L9,12 L0,6 L-9,12 Z').attr('fill', COR_TINTA);
  gn.append('text').attr('y', 28).attr('text-anchor', 'middle').attr('font-size', 12).attr('font-weight', 700).attr('fill', COR_TINTA).text('N');
}

function corSemDado() { return { cinza: '#d9dcd6', branco: '#ffffff' }[E.corSemDado] || 'url(#hachura)'; }
function legendaValores(cls, coluna, y) {
  const g = svg.append('g');
  const x = COL.x;
  const tituloLeg = quebrarNome(E.legTitulo || (coluna && !/^valor( \d+)?$/i.test(coluna) ? coluna : 'Valor'), 34);
  tituloLeg.forEach((l, i) => g.append('text').attr('x', x).attr('y', y + i * 17).attr('font-size', 14).attr('font-weight', 700).attr('fill', COR_TINTA).text(l));
  y += (tituloLeg.length - 1) * 17 + 14;
  const algumSemDado = ULTIMO && ULTIMO.valores.size < areasDo(E.nivelMapa).length;
  const itens = cls.legenda.concat(E.legSemDado && algumSemDado ? [{ cor: corSemDado(), rotulo: E.semDadoTexto || 'Sem dado', n: null }] : []);
  for (const it of itens) {
    g.append('rect').attr('x', x).attr('y', y).attr('width', 26).attr('height', 17).attr('fill', it.cor).attr('stroke', '#9aa3a8').attr('stroke-width', 0.6).attr('rx', 2);
    const linhas = quebrarNome(it.rotulo, 36);
    const t = g.append('text').attr('x', x + 36).attr('y', y + 13).attr('font-size', 13).attr('fill', COR_TINTA);
    linhas.forEach((l, i) => t.append('tspan').attr('x', x + 36).attr('dy', i ? 16 : 0).text(l));
    if (E.legContagem && it.n != null) t.append('tspan').attr('fill', '#8a959b').attr('font-size', 11.5).text(`  (${it.n})`);
    y += 23 + (linhas.length - 1) * 16;
  }
  return y;
}
function legendaEquip(y) {
  const sel = EQUIP.filter(e => E.equip.includes(e.tipo));
  if (!sel.length) return;
  const g = svg.append('g');
  g.append('text').attr('x', COL.x).attr('y', y + 12).attr('font-size', 13).attr('font-weight', 700).attr('fill', COR_TINTA).text('Equipamentos');
  y += 24;
  for (const e of sel) {
    g.append('path').attr('transform', `translate(${COL.x + 13},${y + 8})`).attr('d', d3.symbol(SIMB[e.simb], e.tam)()).attr('fill', e.cor).attr('stroke', '#fff').attr('stroke-width', 1);
    g.append('text').attr('x', COL.x + 36).attr('y', y + 12.5).attr('font-size', 12.5).attr('fill', COR_TINTA).text(e.tipo);
    y += 20;
  }
}

let PARTE_PRINCIPAL = null;
function aplicarZoom(t) {
  escalaZoom = t.k;
  gZoom.attr('transform', t);
  gZoom.selectAll('text').attr('stroke-width', 2.6 / t.k).attr('font-size', function () { return this.getAttribute('data-base') / Math.pow(t.k, 0.8); });
  const p = PARTE_PRINCIPAL;
  if (p && p.gEquip) p.gEquip.selectAll('path')
    .attr('d', e => d3.symbol(SIMB[equipPorTipo[e.tipo].simb], equipPorTipo[e.tipo].tam / Math.pow(t.k, 1.5))())
    .attr('stroke-width', 1.1 / t.k);
  desenharEscala(p, t);
}
function configurarZoom(partes, manter) {
  PARTE_PRINCIPAL = partes.find(q => q.principal);
  if (!zoom) {
    zoom = d3.zoom().scaleExtent([1, 14])
      .translateExtent([[AREA.x - 250, AREA.y - 250], [AREA.x + AREA.w + 250, AREA.y + AREA.h + 250]])
      .on('zoom', ev => aplicarZoom(ev.transform));
    svg.call(zoom).on('dblclick.zoom', null);
  }
  if (manter) aplicarZoom(d3.zoomTransform(svg.node()));
  else svg.call(zoom.transform, d3.zoomIdentity);
}
function desenharEscala(p, t) {
  svg.selectAll('.escala').remove();
  if (!E.escalaNorte) return;
  const proj = p.proj;
  const cx = AREA.x + 30, cy = AREA.y + AREA.h - 30;
  const geo = proj.invert([(cx - t.x) / t.k, (cy - t.y) / t.k]);
  const kmPorGrau = 111.32 * Math.cos(geo[1] * Math.PI / 180);
  const a = proj(geo), b = proj([geo[0] + 1 / kmPorGrau, geo[1]]);
  const px1km = Math.abs(b[0] - a[0]) * t.k;
  const alvo = 110 / px1km;
  const km = [0.1, 0.25, 0.5, 1, 2, 5, 10].reduce((m, v) => Math.abs(v - alvo) < Math.abs(m - alvo) ? v : m);
  const L = km * px1km;
  const g = svg.append('g').attr('class', 'escala').attr('pointer-events', 'none');
  g.append('rect').attr('x', cx - 8).attr('y', cy - 26).attr('width', L + 52).attr('height', 38).attr('fill', '#ffffff').attr('opacity', 0.85).attr('rx', 4);
  g.append('rect').attr('x', cx).attr('y', cy).attr('width', L / 2).attr('height', 5).attr('fill', COR_TINTA);
  g.append('rect').attr('x', cx + L / 2).attr('y', cy).attr('width', L / 2).attr('height', 5).attr('fill', '#ffffff').attr('stroke', COR_TINTA).attr('stroke-width', 1);
  g.append('text').attr('x', cx).attr('y', cy - 6).attr('font-size', 11).attr('fill', COR_TINTA).text('0');
  g.append('text').attr('x', cx + L).attr('y', cy - 6).attr('text-anchor', 'middle').attr('font-size', 11).attr('fill', COR_TINTA).text(fmtNum(km) + ' km');
}

// ------------------------------------------------------------------ dicas (tooltip)
const tip = $('#tooltip');
function posDica(ev) {
  const r = $('#moldura').getBoundingClientRect();
  let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
  if (x + 290 > r.width) x = ev.clientX - r.left - 290;
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
}
function dica(ev, area, o, cls) {
  const nm = E.nivelMapa;
  let h = `<b>${esc(area)}</b>`;
  h += o ? `<div class="v">${esc(cls.fmt(o.v))}</div>` : `<div class="m">sem dado</div>`;
  if (o && o.n != null) h += `<div class="m">${o.n} de ${o.total} bairros com dado</div>`;
  if (o && o.herdado) h += `<div class="m">valor de ${esc(o.herdado)}</div>`;
  if (nm !== 'bairro') { const bs = bairrosDe(area, nm); h += `<div class="m">${bs.length} bairros: ${esc(bs.slice(0, 10).join(', '))}${bs.length > 10 ? '…' : ''}</div>`; }
  else { const t = terrPorBairro[area]; if (t) h += `<div class="m">${esc(t.zona)} · ${esc(t.cras)}</div>`; }
  tip.innerHTML = h; posDica(ev);
}
function dicaEquip(ev, e) {
  tip.innerHTML = `<b>${esc(e.nome)}</b><div class="m">${esc(e.tipo)} · ${esc(e.bairro)}</div><div class="m">${esc(e.endereco)}</div>`;
  posDica(ev); ev.stopPropagation();
}
function esconderDica() { tip.hidden = true; }

// ------------------------------------------------------------------ painel: controles
function opcoes(sel, itens, valor) {
  sel.innerHTML = itens.map(i => `<option value="${esc(i.id)}">${esc(i.nome)}</option>`).join('');
  if (valor != null) sel.value = valor;
}
function atualizarControles() {
  opcoes($('#nivel-dados'), NIVEIS, E.nivelDados);
  const permitidos = E.nivelDados === 'bairro' ? NIVEIS : NIVEIS.filter(n => n.id === E.nivelDados || n.id === 'bairro');
  if (!permitidos.some(n => n.id === E.nivelMapa)) E.nivelMapa = E.nivelDados;
  opcoes($('#nivel-mapa'), permitidos, E.nivelMapa);
  $('#campo-agregacao').hidden = !(E.nivelDados === 'bairro' && E.nivelMapa !== 'bairro');
  $('#agregacao').value = E.agregacao;
  const multi = DADOS.colunas.length > 1;
  $('#campo-indicador').hidden = !multi;
  if (multi) opcoes($('#indicador'), DADOS.colunas.map((c, i) => ({ id: String(i), nome: c })), String(Math.min(E.indicador, DADOS.colunas.length - 1)));
  $('#titulo').value = E.titulo; $('#fonte').value = E.fonte;
  $('#tipo').value = E.tipo; $('#classes').value = String(E.classes); $('#metodo').value = E.metodo;
  $('#inverter').checked = E.inverter; $('#rotulos').value = E.rotulos; $('#vista').value = E.vista;
  $('#mostrar-valores').checked = E.mostrarValores; $('#divisas-bairro').checked = E.divisas;
  opcoes($('#paleta'), PALETAS, E.paleta);
  const ehNum = ULTIMO && ULTIMO.cls && ULTIMO.cls.tipo === 'num';
  document.querySelectorAll('.so-num').forEach(el => { el.style.opacity = ehNum || E.tipo === 'num' ? 1 : 0.45; });
  $('#campo-cortes').hidden = E.metodo !== 'manual';
  $('#bloco-editor-legenda').hidden = E.metodo === 'manual';
  $('#campo-classes').hidden = E.metodo === 'manual';
  $('#cores-custom').hidden = E.paleta !== 'custom';
  $('#cor-ini').value = E.corIni; $('#cor-fim').value = E.corFim;
  $('#leg-titulo').value = E.legTitulo; $('#unidade').value = E.unidade; $('#casas').value = String(E.casas);
  $('#cor-sem-dado').value = E.corSemDado; $('#sem-dado-texto').value = E.semDadoTexto;
  $('#leg-contagem').checked = E.legContagem; $('#leg-sem-dado').checked = E.legSemDado;
  $('#subtitulo').value = E.subtitulo; $('#tam-rotulo').value = E.tamRotulo; $('#tam-rotulo-v').textContent = E.tamRotulo + '%';
  $('#escala-norte').checked = E.escalaNorte;
}
function montarEditorLegenda(cls) {
  const box = $('#editor-legenda');
  if (box.contains(document.activeElement) && document.activeElement.type === 'text') return;   // não atrapalha quem está digitando
  if (!cls) { box.innerHTML = '<p class="dica mini">Cole dados para ver as faixas.</p>'; return; }
  box.innerHTML = cls.legenda.map(it => `<div class="item ${it.editado ? 'editado' : ''}">
      <input type="color" value="${esc(d3.color(it.cor) ? d3.color(it.cor).formatHex() : '#cccccc')}" data-chave="${esc(it.chave)}" title="Trocar a cor">
      <input type="text" value="${esc((E.legEdit[it.chave] || {}).rotulo || '')}" placeholder="${esc(it.rotuloPadrao)}" data-chave="${esc(it.chave)}" title="Texto desta faixa na legenda">
      <span class="n-area">${it.n}</span></div>`).join('');
}
function editarLegenda(ev, campo) {
  const k = ev.target.dataset.chave; if (!k) return;
  const ed = Object.assign({}, E.legEdit[k]);
  const v = ev.target.value.trim();
  if (v) ed[campo] = v; else delete ed[campo];
  if (Object.keys(ed).length) E.legEdit[k] = ed; else delete E.legEdit[k];
  salvarEstado(); desenhar();
}
$('#editor-legenda').addEventListener('input', ev => { if (ev.target.type === 'color') editarLegenda(ev, 'cor'); });
$('#editor-legenda').addEventListener('change', ev => { if (ev.target.type === 'text') editarLegenda(ev, 'rotulo'); });
$('#btn-leg-reset').addEventListener('click', () => { E.legEdit = {}; salvarEstado(); desenhar(); });
function montarListaEquip() {
  const cont = d3.rollup(BASE.equipamentos, v => v.length, e => e.tipo);
  let h = '', grupo = '';
  for (const e of EQUIP) {
    if (e.grupo !== grupo) { grupo = e.grupo; h += `<div class="grupo">${esc(grupo)}</div>`; }
    const s = d3.symbol(SIMB[e.simb], e.tam)();
    h += `<label><input type="checkbox" value="${esc(e.tipo)}" ${E.equip.includes(e.tipo) ? 'checked' : ''}>
      <svg width="16" height="16" viewBox="-8 -8 16 16"><path d="${s}" fill="${e.cor}"/></svg>${esc(e.tipo)} <span class="qt">${cont.get(e.tipo) || 0}</span></label>`;
  }
  $('#lista-equip').innerHTML = h;
  $('#lista-equip').addEventListener('change', () => {
    E.equip = [...document.querySelectorAll('#lista-equip input:checked')].map(i => i.value);
    salvarEstado(); desenhar();
  });
}
function montarProntos() {
  const tipos = EQUIP.map(e => e.tipo);
  $('#pronto').innerHTML = '<option value="">—</option><option value="area">Área (km²)</option>' +
    tipos.map(t => `<option value="n:${esc(t)}">${esc(NOME_CONTAGEM[t])}</option>`).join('') +
    '<option value="n:*saude">Nº de unidades de saúde (todas)</option><option value="n:*escola">Nº de escolas (municipais + estaduais)</option>';
}
function aplicarPronto(id) {
  if (!id) return;
  const linhas = new Map();
  let nome;
  if (id === 'area') { nome = 'Área (km²)'; TERR.forEach(t => linhas.set(t.bairro, [String(t.area_km2)])); }
  else {
    const t = id.slice(2);
    const filtro = t === '*saude' ? e => equipPorTipo[e.tipo].grupo === 'Saúde' : t === '*escola' ? e => /^Escola/.test(e.tipo) : e => e.tipo === t;
    nome = t === '*saude' ? 'Nº de unidades de saúde' : t === '*escola' ? 'Nº de escolas (municipais + estaduais)' : NOME_CONTAGEM[t];
    const c = d3.rollup(BASE.equipamentos.filter(filtro), v => v.length, e => e.bairro);
    TERR.forEach(x => linhas.set(x.bairro, [String(c.get(x.bairro) || 0)]));
  }
  limparPersonalizacao();
  DADOS = { colunas: [nome], linhas };
  E.nivelDados = 'bairro'; E.indicador = 0; E.agregacao = 'soma';
  E.titulo = '';   // título automático acompanha o recorte escolhido
  E.fonte = 'Prefeitura de Santos — GeoServer (unidades organizacionais e bairros)';
  E.fonteAuto = true;
  E.tipo = 'auto';
  E.texto = textoDosDados(); $('#entrada').value = E.texto;
  $('#relatorio').hidden = true;
  salvarEstado(); atualizarControles(); desenhar();
}

function limparPersonalizacao() {
  Object.assign(E, { titulo: '', subtitulo: '', legTitulo: '', unidade: '', legEdit: {} });
}
function aplicarTexto(manterNivel) {
  const txt = $('#entrada').value;
  E.texto = txt;
  if (E.fonteAuto && !manterNivel) { E.fonte = ''; E.fonteAuto = false; }
  const r = interpretar(txt, manterNivel ? E.nivelDados : null);
  const rel = $('#relatorio');
  if (!r) { DADOS = { colunas: [], linhas: new Map() }; rel.hidden = true; salvarEstado(); atualizarControles(); desenhar(); return; }
  const mudouNivel = r.nivel !== E.nivelDados;
  E.nivelDados = r.nivel;
  if (mudouNivel || (E.nivelDados !== 'bairro' && E.nivelMapa !== 'bairro')) E.nivelMapa = r.nivel;
  // indicador novo (colunas diferentes): zera os textos e ajustes que eram do mapa anterior
  if (!manterNivel && DADOS.colunas.length && r.colunas.join('|') !== DADOS.colunas.join('|')) limparPersonalizacao();
  DADOS = { colunas: r.colunas, linhas: r.linhas };
  if (E.indicador >= r.colunas.length) E.indicador = 0;
  AVISO_FAIXAS = conferirFaixasComDados();
  let h = `<b>${r.linhas.size}</b> ${r.linhas.size === 1 ? 'área reconhecida' : 'áreas reconhecidas'} como <b>${esc(nivelPorId[r.nivel].nome.toLowerCase())}</b>`;
  if (r.colunas.length > 1) h += ` · ${r.colunas.length} indicadores`;
  const equipSemTerr = [], outros = [];
  for (const n of r.naoReconhecidos) {
    const e = BASE.equipamentos.find(q => chave(q.nome) === chave(n) || semPrefixo(chave(q.nome)) === semPrefixo(chave(n)));
    (e && ['CRAS', 'CREAS'].includes(e.tipo) ? equipSemTerr : outros).push(e ? e.nome : n);
  }
  if (equipSemTerr.length) h += `<br><b>${esc(equipSemTerr.join(', '))}</b>: não ${equipSemTerr.length > 1 ? 'têm' : 'tem'} nenhum bairro ligado no território, por isso não aparece no mapa. Ligue os bairros na aba <b>Territórios</b>.`;
  r.naoReconhecidos = outros;
  if (r.naoReconhecidos.length) h += `<br>Não reconheci (confira a grafia ou mude “Os dados estão por”):<ul>${r.naoReconhecidos.slice(0, 12).map(n => `<li>${esc(n)}</li>`).join('')}${r.naoReconhecidos.length > 12 ? `<li>… e mais ${r.naoReconhecidos.length - 12}</li>` : ''}</ul>`;
  if (r.repetidos.length) h += `<br>Repetidos (vale a última linha): ${esc([...new Set(r.repetidos)].join(', '))}`;
  rel.innerHTML = h; rel.hidden = false;
  rel.classList.toggle('alerta', r.naoReconhecidos.length > 0 || equipSemTerr.length > 0 || r.linhas.size === 0);
  salvarEstado(); atualizarControles(); desenhar();
}

function atualizarEditor() {
  const det = document.querySelector('.tabela-valores');
  if (!det.open) return;
  const ci = Math.min(E.indicador, Math.max(0, DADOS.colunas.length - 1));
  const areas = areasDo(E.nivelDados);
  $('#editor-valores').innerHTML = areas.map(a => {
    const v = (DADOS.linhas.get(a) || [])[ci] ?? '';
    return `<label><span>${esc(a)}</span><input data-area="${esc(a)}" value="${esc(v)}"></label>`;
  }).join('');
}
document.querySelector('.tabela-valores').addEventListener('toggle', atualizarEditor);
$('#editor-valores').addEventListener('change', ev => {
  const inp = ev.target; if (!inp.dataset.area) return;
  if (!DADOS.colunas.length) DADOS.colunas = ['Valor'];
  const ci = Math.min(E.indicador, DADOS.colunas.length - 1);
  const linha = DADOS.linhas.get(inp.dataset.area) || DADOS.colunas.map(() => '');
  linha[ci] = inp.value.trim();
  if (linha.every(x => x === '')) DADOS.linhas.delete(inp.dataset.area); else DADOS.linhas.set(inp.dataset.area, linha);
  E.texto = textoDosDados(); $('#entrada').value = E.texto;
  salvarEstado(); desenhar();
});

// ------------------------------------------------------------------ exportação
function svgTexto() {
  const clone = svg.node().cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function nomeArquivo(ext) { return 'mapa-santos-' + slug(E.titulo || (ULTIMO && ULTIMO.coluna) || nivelPorId[E.nivelMapa].curto) + '.' + ext; }
function exportarPNG() {
  const escala = 2.5;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgTexto()], { type: 'image/svg+xml;charset=utf-8' }));
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = W * escala; c.height = H * escala;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    if (E.modo === '3d' && DECK) {
      DECK.redraw('exportar');
      const cv = $('#mapa3d canvas');
      if (cv) ctx.drawImage(cv, AREA.x * escala, AREA.y * escala, AREA.w * escala, AREA.h * escala);
    }
    c.toBlob(b => baixar(nomeArquivo('png'), b), 'image/png');
  };
  img.src = url;
}
function exportarCSV() {
  const { valores, cls } = ULTIMO;
  const nm = E.nivelMapa;
  const linhas = [[nivelPorId[nm].curto, ULTIMO.coluna || 'Valor', ...(nm === 'bairro' ? ['Zona', 'Região', 'CRAS', 'CREAS', 'Saúde'] : ['Bairros'])].join(';')];
  for (const a of areasDo(nm)) {
    const o = valores.get(a);
    const v = o ? (cls && cls.todosNum ? String(parseNum(o.v)).replace('.', ',') : o.v) : '';
    const extra = nm === 'bairro' ? ['zona', 'regiao', 'cras', 'creas', 'saude'].map(c => terrPorBairro[a][c]) : [bairrosDe(a, nm).join(', ')];
    linhas.push([a, v, ...extra].map(x => /[;"\n]/.test(x) ? `"${String(x).replace(/"/g, '""')}"` : x).join(';'));
  }
  baixar(nomeArquivo('csv'), '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
}
function baixarModelo() {
  const nd = E.nivelDados;
  const col = DADOS.colunas.length ? DADOS.colunas : ['Valor'];
  const linhas = [[nivelPorId[nd].curto, ...col].join(';')];
  for (const a of areasDo(nd)) linhas.push([a, ...((DADOS.linhas.get(a) || col.map(() => '')))].join(';'));
  baixar('lista-' + slug(nivelPorId[nd].curto) + '-santos.csv', '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
}

// ------------------------------------------------------------------ aba territórios
const CAMPOS_EDIT = ['zona', 'cras', 'creas', 'saude'];
function montarTabelaTerr() {
  const listas = {};
  CAMPOS_EDIT.forEach(c => { listas[c] = [...new Set(TERR.map(t => t[c]).concat(TERR_PADRAO.map(t => t[c])))].sort((a, b) => a.localeCompare(b, 'pt-BR')); });
  listas.cras = [...new Set(listas.cras.concat(BASE.equipamentos.filter(e => e.tipo === 'CRAS').map(e => e.nome)))].sort();
  listas.saude = [...new Set(listas.saude.concat(BASE.equipamentos.filter(e => e.tipo === 'UBS / USF').map(e => e.nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  CAMPOS_EDIT.forEach(c => { $('#dl-' + c).innerHTML = listas[c].map(v => `<option value="${esc(v)}">`).join(''); });
  const filtro = chave($('#terr-busca').value);
  $('#tabela-terr tbody').innerHTML = TERR.map((t, i) => {
    if (filtro && !chave(t.bairro).includes(filtro)) return '';
    const p = TERR_PADRAO[i];
    return `<tr><td><b>${esc(t.bairro)}</b></td><td>${esc(t.regiao)}</td>` + CAMPOS_EDIT.map(c =>
      `<td><input list="dl-${c}" data-i="${i}" data-c="${c}" value="${esc(t[c])}" class="${t[c] !== p[c] ? 'mudou' : ''}" title="${t[c] !== p[c] ? 'Padrão: ' + esc(p[c]) : ''}"></td>`).join('') + '</tr>';
  }).join('');
  const n = TERR.reduce((s, t, i) => s + CAMPOS_EDIT.filter(c => t[c] !== TERR_PADRAO[i][c]).length, 0);
  $('#terr-status').textContent = n ? `${n} alteraç${n === 1 ? 'ão' : 'ões'} salvas neste navegador` : 'Usando a divisão padrão';
}
$('#tabela-terr').addEventListener('change', ev => {
  const inp = ev.target; if (!inp.dataset.c) return;
  const v = inp.value.trim(); if (!v) { inp.value = TERR[+inp.dataset.i][inp.dataset.c]; return; }
  TERR[+inp.dataset.i][inp.dataset.c] = v;
  indexarTerritorios(); salvarTerritorios(); montarTabelaTerr(); reaplicarDadosAposTerritorio(); desenhar();
});
function reaplicarDadosAposTerritorio() {
  if (E.nivelDados !== 'bairro' && E.texto) aplicarTexto(true);
}
$('#terr-busca').addEventListener('input', montarTabelaTerr);
$('#terr-restaurar').addEventListener('click', () => {
  if (!lsGet(CHAVE_TERR)) return;
  TERR = TERR_PADRAO.map(t => ({ ...t })); lsDel(CHAVE_TERR); indexarTerritorios(); montarTabelaTerr(); reaplicarDadosAposTerritorio(); desenhar();
});
$('#terr-baixar').addEventListener('click', () => {
  const l = [['bairro', 'regiao', 'zona', 'cras', 'creas', 'saude'].join(';'), ...TERR.map(t => [t.bairro, t.regiao, t.zona, t.cras, t.creas, t.saude].join(';'))];
  baixar('bairros_territorios.csv', '﻿' + l.join('\r\n'), 'text/csv;charset=utf-8');
});
$('#terr-importar').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  const tab = dividirTexto((await f.text()).replace(/^﻿/, ''));
  const cab = tab[0].map(chave);
  const col = c => cab.indexOf(c);
  const ib = col('bairro');
  if (ib < 0) { $('#terr-status').textContent = 'O arquivo precisa ter uma coluna "bairro".'; return; }
  const ind = indiceNomes('bairro'); let n = 0;
  for (const r of tab.slice(1)) {
    const b = reconhecer(r[ib], ind); if (!b) continue;
    const t = terrPorBairro[b];
    CAMPOS_EDIT.forEach(c => { const i = col(c === 'saude' ? 'saude' : c); if (i >= 0 && r[i]) t[c] = r[i].trim(); });
    n++;
  }
  indexarTerritorios(); salvarTerritorios(); montarTabelaTerr(); reaplicarDadosAposTerritorio(); desenhar();
  $('#terr-status').textContent = `${n} bairros importados.`;
  ev.target.value = '';
});

// ------------------------------------------------------------------ eventos gerais
document.querySelectorAll('.abas button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.abas button').forEach(x => x.classList.toggle('ativa', x === b));
  document.querySelectorAll('.aba').forEach(s => s.classList.toggle('ativa', s.id === 'aba-' + b.dataset.aba));
  if (b.dataset.aba === 'territorios') montarTabelaTerr();
}));
$('#btn-aplicar').addEventListener('click', () => aplicarTexto(false));
$('#entrada').addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) aplicarTexto(false); });
$('#btn-exemplo').addEventListener('click', () => {
  $('#entrada').value = 'Bairro\tVulnerabilidade (exemplo)\tPessoas atendidas (exemplo)\n' +
    'Rádio Clube\t1\t5.000\nVila Gilda\t1\t4.200\nSão Manoel\t1\t2.900\nCaneleira\t2\t1.300\nBom Retiro\t2\t1.700\n' +
    'Morro São Bento\t1\t2.100\nMorro Nova Cintra\t2\t1.100\nCentro\t2\t1.900\nVila Nova\t1\t2.400\nPaquetá\t1\t2.000\n' +
    'Gonzaga\t3\t500\nBoqueirão\t3\t620\nEmbaré\t3\t700\nPonta da Praia\t3\t800\nCaruara\t1\t900\nMonte Cabrão\t1\t350\nMacuco\t2\t1.500\nEstuário\t2\t1.200';
  E.titulo = 'Exemplo — dados fictícios'; E.fonte = 'Dados fictícios, apenas para demonstração';
  aplicarTexto(false);
});
$('#btn-limpar').addEventListener('click', () => {
  $('#entrada').value = ''; limparPersonalizacao(); E.fonte = ''; E.fonteAuto = false; E.tipo = 'auto'; DADOS = { colunas: [], linhas: new Map() }; aplicarTexto(false);
});
$('#pronto').addEventListener('change', ev => { aplicarPronto(ev.target.value); ev.target.value = ''; });
const liga = (id, campo, conv = v => v, evt = 'change') => $(id).addEventListener(evt, ev => {
  E[campo] = conv(ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value);
  if (campo === 'nivelDados') { aplicarTexto(true); return; }
  salvarEstado(); atualizarControles(); desenhar();
});
liga('#nivel-dados', 'nivelDados'); liga('#nivel-mapa', 'nivelMapa'); liga('#agregacao', 'agregacao'); liga('#indicador', 'indicador', Number);
liga('#titulo', 'titulo', v => v, 'input'); liga('#fonte', 'fonte', v => v, 'input');
$('#fonte').addEventListener('input', () => { E.fonteAuto = false; salvarEstado(); });
liga('#tipo', 'tipo'); liga('#paleta', 'paleta'); liga('#classes', 'classes', Number);
liga('#cor-ini', 'corIni', v => v, 'input'); liga('#cor-fim', 'corFim', v => v, 'input');
liga('#leg-titulo', 'legTitulo', v => v, 'input'); liga('#unidade', 'unidade', v => v, 'input'); liga('#casas', 'casas', v => v === 'auto' ? 'auto' : Number(v));
liga('#cor-sem-dado', 'corSemDado'); liga('#sem-dado-texto', 'semDadoTexto', v => v, 'input');
liga('#leg-contagem', 'legContagem'); liga('#leg-sem-dado', 'legSemDado');
liga('#subtitulo', 'subtitulo', v => v, 'input'); liga('#tam-rotulo', 'tamRotulo', Number, 'input'); liga('#escala-norte', 'escalaNorte');
// "Montar eu mesmo": começa com faixas sugeridas a partir dos dados, se ainda não houver nenhuma
$('#metodo').addEventListener('change', ev => {
  E.metodo = ev.target.value;
  if (E.metodo === 'manual' && !faixasValidas().length) sugerirFaixas();
  salvarEstado(); atualizarControles(); desenhar();
});
function arredondar(c) {
  const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(c) || 1)) - 1));
  return Math.round(c / m) * m;
}
function valoresAtuais() {
  return [...calcular().valores.values()].map(o => parseNum(o.v)).filter(v => v != null).sort((a, b) => a - b);
}
function sugerirFaixas() {
  const vals = valoresAtuais();
  if (vals.length < 2) { E.faixas = [{ de: null, ate: 1000, rotulo: '', cor: '' }, { de: 1000, deExcl: true, ate: null, rotulo: '', cor: '' }]; return; }
  const inteiros = vals.every(Number.isInteger);
  const k = Math.min(4, new Set(vals).size);
  let cs = [...new Set(quebras(vals, k, 'jenks').map(c => inteiros ? Math.round(arredondar(c)) : arredondar(c)))].filter(c => c > vals[0] && c < vals[vals.length - 1]).sort((a, b) => a - b);
  if (!cs.length) cs = [inteiros ? Math.round(d3.median(vals)) : arredondar(d3.median(vals))];
  const lim = [vals[0], ...cs, vals[vals.length - 1]];
  E.faixas = [];
  for (let i = 0; i < lim.length - 1; i++) {
    E.faixas.push(inteiros ? { de: i ? lim[i] + 1 : lim[0], ate: lim[i + 1], rotulo: '', cor: '' }
                           : { de: lim[i], deExcl: i > 0, ate: lim[i + 1], rotulo: '', cor: '' });
  }
}
// ao trocar de dados: se nenhum valor cabe nas faixas salvas, elas eram de outro mapa: refaz
function conferirFaixasComDados() {
  if (E.metodo !== 'manual' || !faixasValidas().length) return '';
  const vals = valoresAtuais(); if (!vals.length) return '';
  const fx = faixasValidas();
  const usadas = new Set(vals.map(v => fx.findIndex(f => dentroDaFaixa(f, v))).filter(i => i >= 0));
  const distintos = new Set(vals).size;
  // faixas de outro mapa: nenhum valor cabe nelas, ou todos caem numa faixa só
  if (usadas.size > 1 || (usadas.size === 1 && (fx.length < 2 || distintos < 3))) return '';
  sugerirFaixas();
  return `As faixas salvas eram de outro mapa e não serviam para estes valores (todos caíam numa faixa só). Montei faixas novas para os valores de ${fmtNum(vals[0])} a ${fmtNum(vals[vals.length - 1])}; ajuste à vontade.`;
}
let AVISO_FAIXAS = '';
// tabela de faixas
function montarTabelaFaixas(cls) {
  const box = $('#tabela-faixas');
  if (!box || $('#campo-cortes').hidden) return;
  const foco = document.activeElement;
  if (box.contains(foco) && foco.type === 'text') return;   // não atrapalha quem está digitando
  E.faixas = faixasValidas();
  const leg = cls && cls.manual ? cls.legenda : [];
  const cores = coresDe(E.paleta, Math.max(1, E.faixas.length), false);
  const casas = E.casas === 'auto' ? 2 : +E.casas;
  const nf = v => fin(v) ? fmtNum(v, casas) : '';
  box.innerHTML = '<div class="cab"><span>De</span><span>Até</span><span>Nome na legenda</span><span>Cor</span><span>n</span><span></span></div>' +
    E.faixas.map((f, i) => {
      const it = leg[i] || {};
      const cor = f.cor || cores[i] || '#cccccc';
      return `<div class="fx">
        <input type="text" inputmode="decimal" data-i="${i}" data-campo="de" value="${esc(nf(f.de))}" placeholder="mín." title="${f.deExcl ? 'Acima deste valor' : 'A partir deste valor (inclusive)'}">
        <input type="text" inputmode="decimal" data-i="${i}" data-campo="ate" value="${esc(nf(f.ate))}" placeholder="máx." title="Até este valor (inclusive)">
        <input type="text" data-i="${i}" data-campo="rotulo" value="${esc(f.rotulo || '')}" placeholder="${esc(it.rotuloPadrao || ('Faixa ' + (i + 1)))}" title="Nome desta faixa na legenda (opcional)">
        <input type="color" data-i="${i}" data-campo="cor" value="${esc(d3.color(cor).formatHex())}" title="Cor desta faixa">
        <span class="n-area" title="Áreas nesta faixa">${it.n ?? ''}</span>
        <button class="del" data-del="${i}" title="Remover esta faixa">×</button>
      </div>`;
    }).join('');
  const av = $('#aviso-faixas');
  let txt = AVISO_FAIXAS;
  if (!txt && cls && cls.manual && cls.fora) txt = `${cls.fora} ${cls.fora === 1 ? 'área ficou' : 'áreas ficaram'} fora das faixas (seus valores vão de ${fmtNum(cls.min)} a ${fmtNum(cls.max)}). Elas aparecem em cinza; ajuste De/Até ou clique em “Sugerir faixas”.`;
  av.textContent = txt; av.hidden = !txt;
}
$('#tabela-faixas').addEventListener('input', ev => {
  const t = ev.target; if (t.dataset.campo !== 'cor') return;
  E.faixas[+t.dataset.i].cor = t.value; salvarEstado(); desenhar();
});
$('#tabela-faixas').addEventListener('change', ev => {
  const t = ev.target, c = t.dataset.campo; if (!c || c === 'cor') return;
  const f = E.faixas[+t.dataset.i];
  if (c === 'rotulo') f.rotulo = t.value.trim();
  else {
    const txt = t.value.trim();
    // aceita "21-36" ou "21 a 36" digitado num campo só
    const r = /\d\s*(-|–|\ba\b|até)\s*\d/.test(txt) ? lerFaixasTexto(txt) : null;
    if (r && r.faixas && r.faixas.length === 1) { Object.assign(f, { de: r.faixas[0].de, ate: r.faixas[0].ate, deExcl: false }); }
    else {
      const v = txt === '' ? null : parseNum(txt);
      if (txt !== '' && v == null) { t.value = fin(f[c]) ? fmtNum(f[c]) : ''; return; }
      f[c] = v; if (c === 'de') f.deExcl = false;
    }
  }
  AVISO_FAIXAS = '';
  salvarEstado(); t.blur(); desenhar(); montarTabelaFaixas(ULTIMO && ULTIMO.cls);
});
$('#tabela-faixas').addEventListener('click', ev => {
  const d = ev.target.dataset.del; if (d == null) return;
  E.faixas.splice(+d, 1); AVISO_FAIXAS = ''; salvarEstado(); desenhar(); montarTabelaFaixas(ULTIMO && ULTIMO.cls);
});
$('#btn-faixa-add').addEventListener('click', () => {
  const fxs = faixasValidas();
  const vals = valoresAtuais();
  const inteiros = !vals.length || vals.every(Number.isInteger);
  const ult = fxs[fxs.length - 1];
  const larg0 = Math.max(1, arredondar(((vals[vals.length - 1] ?? 100) - (vals[0] ?? 0)) / 3));
  if (ult && !fin(ult.ate)) ult.ate = (fin(ult.de) ? ult.de : 0) + larg0;   // fecha a faixa "acima de" antes de criar a próxima
  const fimAnt = ult ? (fin(ult.ate) ? ult.ate : ult.de) : (vals[0] ?? 0);
  const larg = ult && fin(ult.de) && fin(ult.ate) ? ult.ate - ult.de : Math.max(1, arredondar(((vals[vals.length - 1] ?? 100) - (vals[0] ?? 0)) / 3));
  const de = ult ? (inteiros ? fimAnt + 1 : fimAnt) : fimAnt;
  E.faixas = fxs.concat([{ de, deExcl: !inteiros && !!ult, ate: de + larg, rotulo: '', cor: '' }]);
  AVISO_FAIXAS = '';
  salvarEstado(); desenhar(); montarTabelaFaixas(ULTIMO && ULTIMO.cls);
  const ins = $('#tabela-faixas').querySelectorAll('input[data-campo="ate"]'); if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); }
});
$('#btn-faixa-auto').addEventListener('click', () => {
  sugerirFaixas(); AVISO_FAIXAS = ''; salvarEstado(); desenhar(); montarTabelaFaixas(ULTIMO && ULTIMO.cls);
});
$('#faixas-texto').addEventListener('change', ev => {
  const r = lerFaixasTexto(ev.target.value);
  const msg = $('#faixas-texto-msg');
  if (r.erro) { msg.textContent = `Não entendi “${r.erro}”. Use, por exemplo: 21-36; 37-45`; msg.hidden = false; return; }
  if (!r.faixas.length) return;
  msg.hidden = true; E.faixas = r.faixas; AVISO_FAIXAS = ''; ev.target.value = '';
  salvarEstado(); desenhar(); montarTabelaFaixas(ULTIMO && ULTIMO.cls);
});
liga('#inverter', 'inverter'); liga('#rotulos', 'rotulos'); liga('#vista', 'vista'); liga('#mostrar-valores', 'mostrarValores'); liga('#divisas-bairro', 'divisas');
$('#btn-modelo').addEventListener('click', baixarModelo);
$('#btn-png').addEventListener('click', exportarPNG);
$('#btn-svg').addEventListener('click', () => baixar(nomeArquivo('svg'), svgTexto(), 'image/svg+xml'));
$('#btn-pdf').addEventListener('click', () => window.print());
$('#btn-csv').addEventListener('click', exportarCSV);
$('#zoom-mais').addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1.6));
$('#zoom-menos').addEventListener('click', () => svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6));
$('#zoom-reset').addEventListener('click', () => svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity));
$('#meta-fonte').textContent = 'Base: ' + BASE.meta.fonte + '.';


// ------------------------------------------------------------------ mapa 3D (deck.gl, carregado só quando usado)
let DECK = null, carregandoDeck = null, CHAVE_VISTA3D = '', VISTA3D_INICIAL = null;
function carregarDeck() {
  if (window.deck) return Promise.resolve();
  if (!carregandoDeck) carregandoDeck = new Promise((ok, erro) => {
    const sc = document.createElement('script'); sc.src = 'lib/deck.gl-9.1.14.min.js';
    sc.onload = ok; sc.onerror = () => { carregandoDeck = null; erro(new Error('falha ao carregar')); };
    document.head.appendChild(sc);
  });
  return carregandoDeck;
}
const rgb = c => { const x = d3.color(c) || d3.color('#cccccc'); return [x.r, x.g, x.b]; };
function geometrias3D(nm) {
  const filtro = E.vista === 'continente' ? g => CONTINENTAL(nomeGeom(g)) : E.vista === 'completo' ? () => true : g => !CONTINENTAL(nomeGeom(g));
  const gs = GEOMS.filter(filtro);
  return [...d3.group(gs, g => grupoDe(nomeGeom(g), nm))].map(([area, lista]) => ({ area, gs: lista,
    feat: nm === 'bairro' ? topojson.feature(TOPO, lista[0]) : { type: 'Feature', properties: {}, geometry: topojson.merge(TOPO, lista) } }));
}
function pontoRotuloGeo(f, nm) {
  const lp = gm => gm.properties && gm.properties.lx != null ? [gm.properties.lx, gm.properties.ly] : d3.geoCentroid(topojson.feature(TOPO, gm));
  if (nm === 'bairro') return lp(f.gs[0]);
  const big = maiorPoligono(f.feat.geometry || f.feat);
  const c = d3.geoCentroid(big);
  if (d3.geoContains(big, c)) return c;
  return lp(d3.greatest(f.gs, gm => d3.geoArea(topojson.feature(TOPO, gm))));
}
function desenhar3D(cls, valores, nm) {
  const box = $('#mapa3d'); box.hidden = false;
  carregarDeck().then(() => montar3D(cls, valores, nm))
    .catch(() => { box.innerHTML = '<p class="erro3d">Não consegui abrir o mapa 3D neste navegador. Tente atualizar a página ou usar o Chrome.</p>'; });
}
function montar3D(cls, valores, nm) {
  const box = $('#mapa3d');
  const formas = geometrias3D(nm);
  const temDados = valores.size > 0;
  // altura: proporcional ao valor (texto/categorias usam a posição na legenda)
  const num = o => parseNum(o.v);
  const todosNum = cls && cls.todosNum;
  const pos = new Map(cls && !todosNum ? cls.legenda.map((it, i) => [String(it.rotuloPadrao), i + 1]) : []);
  const medida = o => todosNum ? num(o) : (pos.get(String(o.v)) || 1);
  const meds = [...valores.values()].map(o => medida(o)).filter(v => v != null);
  const maxV = d3.max(meds, v => Math.abs(v)) || 1, minV = d3.min(meds) ?? 0;
  const ALT = 2200 * (E.exagero || 1);
  // "realçar": o menor valor fica baixo e o maior bem alto (diferenças aparecem mais)
  const altura = m => E.realcar && maxV > minV ? (0.12 + 0.88 * (m - minV) / (maxV - minV)) * ALT : Math.abs(m) / maxV * ALT;
  const dados = formas.map(f => {
    const o = valores.get(f.area);
    const m = o ? medida(o) : null;
    const elev = o && m != null ? Math.max(40, altura(m)) : 0;
    const cor = o ? rgb(cls.corDe(o.v)) : (temDados ? [214, 217, 211] : [227, 229, 224]);
    return { ...f.feat, properties: { area: f.area, elev, cor, texto: o ? cls.fmt(o.v) : '' } , _f: f };
  });
  const contornos = [];
  for (const d of dados) {
    const g = d.geometry; if (!g) continue;
    const polys = g.type === 'MultiPolygon' ? g.coordinates : g.type === 'Polygon' ? [g.coordinates] : [];
    for (const pl of polys) for (const anel of pl) contornos.push({ path: anel.map(([x, y]) => [x, y, d.properties.elev + 3]) });
  }
  const rot = dados.filter(d => E.rotulos === 'todos' || (E.rotulos !== 'nenhum' && d.properties.texto));
  const textos = rot.map(d => {
    const [lon, lat] = pontoRotuloGeo(d._f, nm);
    const linhas = quebrarNome(nomeCurto(d.properties.area, nm), nm === 'bairro' ? 14 : 18);
    if (E.mostrarValores && d.properties.texto) linhas.push(d.properties.texto);
    return { pos: [lon, lat, d.properties.elev + 60], texto: linhas.join('\n') };
  });
  const tam = (nm === 'bairro' ? 11 : 13) * (E.tamRotulo || 100) / 100;
  const continente = E.vista !== 'ilha' && E.vista !== 'composto';
  const camadas = [
    continente && new deck.GeoJsonLayer({ id: 'continente', data: LIMITE_CONT, filled: true, stroked: true, getFillColor: [241, 241, 236], getLineColor: [163, 171, 175], lineWidthMinPixels: 1 }),
    new deck.GeoJsonLayer({
      id: 'areas', data: dados, extruded: true, wireframe: false, pickable: true, autoHighlight: true, highlightColor: [255, 255, 255, 70],
      getElevation: d => d.properties.elev, getFillColor: d => d.properties.cor,
      material: { ambient: 0.55, diffuse: 0.55, shininess: 20, specularColor: [40, 40, 40] },
      updateTriggers: { getElevation: [Math.random()], getFillColor: [Math.random()] },
      transitions: { getElevation: 600 },
    }),
    // contorno branco no topo de cada coluna (separa áreas vizinhas)
    new deck.PathLayer({ id: 'contornos', data: contornos, getPath: d => d.path, getColor: [255, 255, 255, 230], getWidth: 1.4, widthUnits: 'pixels', updateTriggers: { getPath: [Math.random()] } }),
    textos.length && new deck.TextLayer({
      id: 'nomes', data: textos, getPosition: d => d.pos, getText: d => d.texto, getSize: tam, sizeUnits: 'pixels',
      getColor: [31, 42, 48], fontFamily: FONTE_SVG, fontWeight: 700, characterSet: 'auto', lineHeight: 1.15,
      getTextAnchor: 'middle', getAlignmentBaseline: 'center', fontSettings: { sdf: true, fontSize: 64, buffer: 6 },
      outlineWidth: 4, outlineColor: [255, 255, 255, 235],
      parameters: { depthTest: false, depthCompare: 'always' },   // nomes sempre por cima das colunas
    }),
  ].filter(Boolean);
  const chave = [E.vista, nm].join('|');
  if (!DECK || chave !== CHAVE_VISTA3D || !box.querySelector('canvas')) {
    const bounds = d3.geoBounds({ type: 'FeatureCollection', features: dados });
    const w = box.clientWidth || 800, h = box.clientHeight || 700;
    const vp = new deck.WebMercatorViewport({ width: w, height: h }).fitBounds(bounds, { padding: Math.round(Math.min(w, h) * 0.08) });
    VISTA3D_INICIAL = { longitude: vp.longitude, latitude: vp.latitude - (bounds[1][1] - bounds[0][1]) * 0.12, zoom: vp.zoom + 0.05, pitch: 50, bearing: -15, maxPitch: 75 };
    CHAVE_VISTA3D = chave;
    if (DECK) DECK.setProps({ initialViewState: { ...VISTA3D_INICIAL } });
  }
  if (!DECK || !box.querySelector('canvas')) {
    if (DECK) { try { DECK.finalize(); } catch (e) { /* */ } }
    box.innerHTML = '';
    DECK = new deck.Deck({
      parent: box, initialViewState: { ...VISTA3D_INICIAL }, controller: { dragRotate: true, touchRotate: true },
      layers: camadas, style: { position: 'absolute', inset: 0 },
      deviceProps: { webgl: { preserveDrawingBuffer: true } }, glOptions: { preserveDrawingBuffer: true },
      getTooltip: ({ object }) => object && object.properties && {
        html: `<b>${esc(object.properties.area)}</b><div>${object.properties.texto ? esc(object.properties.texto) : 'sem dado'}</div>`,
        style: { background: 'rgba(31,42,48,.95)', color: '#fff', padding: '7px 10px', borderRadius: '6px', fontSize: '12.5px', fontFamily: FONTE_SVG },
      },
    });
  } else DECK.setProps({ layers: camadas });
}
function mexerVista3D(f) {
  if (!DECK) return;
  const atual = (DECK.viewManager && DECK.viewManager.getViewState && DECK.viewManager.getViewState()) || VISTA3D_INICIAL;
  DECK.setProps({ initialViewState: { ...atual, ...f(atual), transitionDuration: 500 } });
}
$('#girar-esq').addEventListener('click', () => mexerVista3D(v => ({ bearing: (v.bearing || 0) - 30 })));
$('#girar-dir').addEventListener('click', () => mexerVista3D(v => ({ bearing: (v.bearing || 0) + 30 })));
$('#inclinar').addEventListener('click', () => mexerVista3D(v => ({ pitch: (v.pitch || 0) > 30 ? 0 : 52 })));
$('#reset-3d').addEventListener('click', () => DECK && VISTA3D_INICIAL && DECK.setProps({ initialViewState: { ...VISTA3D_INICIAL, transitionDuration: 600 } }));
$('#realcar').addEventListener('change', ev => { E.realcar = ev.target.checked; salvarEstado(); desenhar(); });
$('#exagero').addEventListener('input', ev => { E.exagero = +ev.target.value; salvarEstado(); desenhar(); });
document.querySelectorAll('.seg button').forEach(bt => bt.addEventListener('click', () => {
  E.modo = bt.dataset.modo; salvarEstado(); atualizarModo(); desenhar();
}));
function atualizarModo() {
  document.querySelectorAll('.seg button').forEach(bt => bt.classList.toggle('ativo', bt.dataset.modo === E.modo));
  $('#ctrl-3d').hidden = E.modo !== '3d';
  $('#exagero').value = E.exagero || 1;
  $('#realcar').checked = !!E.realcar;
}

// ------------------------------------------------------------------ gráfico de barras (ranking)
function desenharGrafico(cls, valores, nm, coluna, tit) {
  const card = $('#grafico-card');
  const linhas = cls && cls.todosNum ? [...valores].map(([a, o]) => ({ a, v: parseNum(o.v), o })).filter(d => d.v != null).sort((x, y) => y.v - x.v) : [];
  card.hidden = linhas.length < 2;
  if (card.hidden) return;
  const g = d3.select('#grafico'); g.selectAll('*').remove();
  const Wg = 1000, top = 56, alt = 24, esq = 300, dir = 110;
  const Hg = top + linhas.length * alt + 34;
  g.attr('viewBox', `0 0 ${Wg} ${Hg}`).attr('font-family', FONTE_SVG);
  g.append('rect').attr('width', Wg).attr('height', Hg).attr('fill', '#ffffff');
  g.append('text').attr('x', 16).attr('y', 28).attr('font-size', 18).attr('font-weight', 700).attr('fill', COR_TINTA).text(tit);
  g.append('text').attr('x', 16).attr('y', 47).attr('font-size', 12.5).attr('fill', '#5b6870').text((E.legTitulo || coluna || 'Valor') + ' · do maior para o menor');
  const max = d3.max(linhas, d => d.v), min = Math.min(0, d3.min(linhas, d => d.v));
  const x = d3.scaleLinear().domain([min, max]).range([esq, Wg - dir]);
  linhas.forEach((d, i) => {
    const y = top + i * alt;
    g.append('text').attr('x', esq - 8).attr('y', y + alt / 2 + 4).attr('text-anchor', 'end').attr('font-size', 12.5).attr('fill', COR_TINTA).text(nomeCurto(d.a, nm));
    g.append('rect').attr('x', x(Math.min(0, d.v))).attr('y', y + 3).attr('width', Math.max(1, Math.abs(x(d.v) - x(0)))).attr('height', alt - 6)
      .attr('fill', cls.corDe(d.o.v)).attr('stroke', '#9aa3a8').attr('stroke-width', 0.5).attr('rx', 2);
    g.append('text').attr('x', x(Math.max(0, d.v)) + 6).attr('y', y + alt / 2 + 4).attr('font-size', 12.5).attr('font-weight', 700).attr('fill', COR_TINTA).text(cls.fmt(d.o.v));
  });
  if (E.fonte) g.append('text').attr('x', 16).attr('y', Hg - 10).attr('font-size', 11).attr('fill', '#5b6870').text('Fonte: ' + E.fonte);
}
$('#btn-grafico-png').addEventListener('click', () => {
  const el = $('#grafico'); const vb = el.viewBox.baseVal;
  const clone = el.cloneNode(true); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', vb.width); clone.setAttribute('height', vb.height);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const k = 2, c = document.createElement('canvas'); c.width = vb.width * k; c.height = vb.height * k;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url); c.toBlob(b => baixar(nomeArquivo('png').replace('mapa-', 'grafico-'), b), 'image/png');
  };
  img.src = url;
});

// ------------------------------------------------------------------ início
montarListaEquip(); montarProntos(); atualizarModo();
$('#entrada').value = E.texto || '';
if (E.texto) {
  const r = interpretar(E.texto, E.nivelDados);
  if (r) DADOS = { colunas: r.colunas, linhas: r.linhas };
}
atualizarControles(); desenhar();
window.__mapas = { E, get DADOS() { return DADOS; }, aplicarTexto, desenhar };   // para testes
})();
