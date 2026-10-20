"""Prepara a base de mapas de Santos a partir do GeoServer da Prefeitura.

Entrada : data/fonte/santos_dados.json (bairros, prefeituras regionais, limite e
          unidades organizacionais baixados de egov.santos.sp.gov.br/geoserver)
Saida   : data/build/bairros.geojson, data/equipamentos.csv,
          data/bairros_territorios.csv (territorios iniciais - editaveis)
Uso     : python3 scripts/preparar_dados.py && bash scripts/gerar_base.sh
"""
import csv, json, math, re, os, unicodedata
from shapely.geometry import shape, mapping, Point
from shapely.ops import unary_union, polylabel, polygonize

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTE = os.path.join(RAIZ, 'data', 'fonte', 'santos_dados.json')
BUILD = os.path.join(RAIZ, 'data', 'build')
os.makedirs(BUILD, exist_ok=True)
d = json.load(open(FONTE, encoding='utf-8'))

# ---------- Bairros ----------
REGIOES = {
    'PREFEITURA REGIONAL DA ZONA NOROESTE': 'Zona Noroeste',
    'PREFEITURA REGIONAL DA REGIÃO CENTRAL HISTÓRICA': 'Região Central Histórica',
    'PREFEITURA REGIONAL DOS MORROS': 'Morros',
    'PREFEITURA REGIONAL DA REGIÃO DA ORLA E ZONA INTERMEDIÁRIA': 'Orla e Zona Intermediária',
    'PREFEITURA REGIONAL DA ÁREA CONTINENTAL': 'Área Continental',
}
ORLA = {'José Menino', 'Pompéia', 'Gonzaga', 'Boqueirão', 'Embaré', 'Aparecida', 'Ponta da Praia'}
NOMES = {'Chico De Paula': 'Chico de Paula', 'Morro Chico De Paula': 'Morro Chico de Paula',
         'Nossa Senhora Das Neves': 'Nossa Senhora das Neves', 'Porto Ponta Da Praia': 'Porto Ponta da Praia'}

subs = [(REGIOES[f['properties']['subprefeitura']], shape(f['geometry']).buffer(0))
        for f in d['subprefeituras']['features']]
geo = {}
for f in d['bairros']['features']:
    nome = NOMES.get(f['properties']['nome'], f['properties']['nome'])
    g = shape(f['geometry']).buffer(0)
    geo[nome] = unary_union([geo[nome], g]) if nome in geo else g

bairros = []
for nome, g in sorted(geo.items()):
    regiao = max(subs, key=lambda s: g.intersection(s[1]).area)[0]
    if regiao == 'Orla e Zona Intermediária':
        zona = 'Orla' if nome in ORLA else 'Zona Intermediária'
    else:
        zona = regiao
    c = g.representative_point()
    bairros.append({'nome': nome, 'regiao': regiao, 'zona': zona, 'geom': g,
                    'area_km2': round(g.area * (111.32 ** 2) * math.cos(math.radians(23.95)), 3),
                    'cx': c.x, 'cy': c.y})

# ---------- Equipamentos ----------
def limpa(t):
    t = t or ''
    for a, b in [('C?ES', 'ÇÕES'), ('C?O', 'ÇÃO'), ('?ES', 'ÕES'), ('AMANH?', 'AMANHÃ'),
                 ('6? ', '6º '), ('1? ', '1º '), ('2? ', '2º '), ('4? ', '4º '), ('5? ', '5º '),
                 ('7? ', '7º '), ('16? ', '16º '), ('?O', 'ÃO'), (' ? ', ' - ')]:
        t = t.replace(a, b)
    t = t.replace('?', '"') if t.count('?') == 2 else t.replace('?', '')
    return re.sub(r'\s+', ' ', t).strip()

MIN = {'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para', 'ao', 'as', 'na', 'no'}
SIGLAS = {'UBS', 'USF', 'UPA', 'CAPS', 'AD', 'IJ', 'ZN', 'ZNO', 'ZOI', 'RCH', 'II', 'III', 'IV', 'V', 'I',
          'IST', 'AIDS', 'SAMU', 'ETEC', 'FATEC', 'UME', 'NIAS', 'CEU', 'APAE', 'AFIP', 'SP', 'EE', 'DR.'}
ACENTOS = {'Saude': 'Saúde', 'Familia': 'Família', 'Basica': 'Básica', 'Estuario': 'Estuário',
           'Marape': 'Marapé', 'Embare': 'Embaré', 'Pompeia': 'Pompéia', 'Radio': 'Rádio',
           'Jose': 'José', 'Area': 'Área', 'Referencia': 'Referência', 'Assistencia': 'Assistência',
           'Psicossocial': 'Psicossocial', 'Alcool': 'Álcool', 'Intermediaria': 'Intermediária',
           'Educacao': 'Educação', 'Joao': 'João', 'Canada': 'Canadá', 'Barnabe': 'Barnabé',
           'Tecnica': 'Técnica', 'Aristoteles': 'Aristóteles', 'Escolastica': 'Escolástica',
           'Emilio': 'Emílio', 'Suetonio': 'Suetônio', 'Marques': 'Marquês', 'Junior': 'Júnior',
           'Antonio': 'Antônio', 'Gusmao': 'Gusmão', 'Convivencia': 'Convivência', 'Paqueta': 'Paquetá',
           'Saboo': 'Saboó', 'Boqueirao': 'Boqueirão', 'Infancia': 'Infância', 'Orquidario': 'Orquidário',
           'Urgencia': 'Urgência', 'Fatima': 'Fátima', 'Angela': 'Ângela', 'Ceara': 'Ceará', 'Camara': 'Câmara', 'Goncalves': 'Gonçalves', 'Lourenco': 'Lourenço', 'Mendonca': 'Mendonça', 'Praca': 'Praça', 'Correa': 'Corrêa', 'Pinheiro': 'Pinheiro', 'Nebias': 'Nébias', 'Joao': 'João', 'Sao': 'São', 'Silverio': 'Silvério', 'Mathias': 'Mathias', 'Gilda': 'Gilda', 'Oseas': 'Oséas', 'Afonsina': 'Afonsina', 'Hospitalar': 'Hospitalar', 'Integrado': 'Integrado'}

def titulo(t):
    t = re.sub(r'\s*/\s*', ' / ', t)
    out = []
    for i, w in enumerate(t.split(' ')):
        pre = '"' if w.startswith('"') else ''
        w = w.strip('"')
        pos = '"' if pre and False else ''
        lw = w.lower()
        if w in SIGLAS or w in ('PA',):
            tok = w
        elif i > 0 and lw in MIN:
            tok = lw
        else:
            cap = lw[:1].upper() + lw[1:]
            tok = ACENTOS.get(cap, cap)
        out.append(pre + tok)
    return re.sub(r'"(\S[^"]*?)$', r'"\1"', ' '.join(out)).replace('""', '"')

CRAS = {'SECRAS-SM': 'CRAS São Manoel', 'SECRAS-CP': 'CRAS Chico de Paula', 'SECRAS-BR': 'CRAS Bom Retiro',
        'SECRAS-RC': 'CRAS Rádio Clube', 'SECRAS-NC': 'CRAS Nova Cintra', 'SECRAS-SB': 'CRAS São Bento',
        'SECRAS-RCH/AC': 'CRAS Centro Histórico e Área Continental', 'SECRAS-ZOI': 'CRAS Orla e Intermediária'}
CREAS = {'SECREAS-ZONA LESTE': 'CREAS Zona Leste', 'SECREAS-ZNO/MORROS': 'CREAS Zona Noroeste e Morros',
         'CENTRO-POP': 'Centro POP'}

def tipo_de(p):
    s, u, sec, tp = p['sigla'] or '', limpa(p['unidade']), p['siglasecretaria'] or '', p['tipo'] or ''
    if s in CRAS: return 'CRAS', CRAS[s]
    if s in CREAS: return ('Centro POP' if s == 'CENTRO-POP' else 'CREAS'), CREAS[s]
    if sec == 'SEDS' and (s.startswith('CECONV') or s.startswith('NIAS')):
        return 'Convivência / NIAS', titulo(u)
    if sec == 'SMS':
        if 'UNIDADE BASICA DE SAUDE' in u or 'UNIDADE DE SAUDE DA FAMILIA' in u:
            n = titulo(u.replace('SEÇÃO ', '').replace('UNIDADE BASICA DE SAUDE', 'UBS')
                       .replace('UNIDADE DE SAUDE DA FAMILIA', 'USF').replace('/ PRONTO ATENDIMENTO', '/ PA'))
            return 'UBS / USF', n
        if s.startswith('UPA') or s == 'SEPROS-C':
            return 'UPA / Pronto-Socorro', titulo(u.replace('SEÇÃO ', ''))
        if s.startswith('CAPS'):
            return 'CAPS', titulo(u.replace('CENTRO DE ATENÇÃO PSICOSSOCIAL', 'CAPS'))
        if tp == 'HOSP' or s in ('SHM-ZNO', 'CHE'):
            return 'Hospital', titulo(u.replace('SEÇÃO ', ''))
    if sec == 'SEDUC' and 'UNIDADE MUNICIPAL DE EDUCAÇÃO' in u:
        return 'Escola municipal (UME)', titulo(u.replace('UNIDADE MUNICIPAL DE EDUCAÇÃO', 'UME'))
    if sec == 'SEDUC' and tp == 'Conveniados':
        return 'Educação conveniada', titulo(u)
    if tp == 'UNIDADE ESTADUAL' and re.match(r'(ESCOLA|CENTRO ESTADUAL)', u):
        return 'Escola estadual', titulo(u.replace('ESCOLA ESTADUAL', 'EE').replace('ESCOLA TECNICA ESTADUAL', 'ETEC'))
    return None, None

def bairro_de(x, y):
    pt = Point(x, y)
    for b in bairros:
        if b['geom'].contains(pt): return b['nome']
    return min(bairros, key=lambda b: b['geom'].distance(pt))['nome']

equip, vistos = [], set()
for f in d['unidades']['features']:
    p = f['properties']
    if not f.get('geometry'): continue
    tipo, nome = tipo_de(p)
    if not tipo: continue
    x, y = f['geometry']['coordinates'][:2]
    chave = (tipo, nome)
    if chave in vistos: continue
    vistos.add(chave)
    end = titulo(limpa((p.get('logradouro') or '').upper()))
    if p.get('numero'): end += ', ' + str(p['numero'])
    equip.append({'tipo': tipo, 'nome': nome, 'bairro': bairro_de(x, y), 'endereco': end,
                  'lon': round(x, 6), 'lat': round(y, 6), 'sigla_prefeitura': p['sigla']})
equip.sort(key=lambda e: (e['tipo'], e['nome']))

# ---------- Territorios iniciais (aproximação: equipamento mais proximo dentro da mesma regiao) ----------
def dist(b, e):
    return math.hypot((b['cx'] - e['lon']) * math.cos(math.radians(23.95)), b['cy'] - e['lat'])

por_tipo = lambda t: [e for e in equip if e['tipo'] == t]
cras_reg = {
    'Zona Noroeste': ['CRAS São Manoel', 'CRAS Chico de Paula', 'CRAS Bom Retiro', 'CRAS Rádio Clube'],
    'Morros': ['CRAS Nova Cintra', 'CRAS São Bento'],
    'Região Central Histórica': ['CRAS Centro Histórico e Área Continental'],
    'Área Continental': ['CRAS Centro Histórico e Área Continental'],
    'Orla e Zona Intermediária': ['CRAS Orla e Intermediária'],
}
ubs = por_tipo('UBS / USF')
for b in bairros:
    cands = [e for e in por_tipo('CRAS') if e['nome'] in cras_reg[b['regiao']]]
    b['cras'] = min(cands, key=lambda e: dist(b, e))['nome']
    b['creas'] = 'CREAS Zona Noroeste e Morros' if b['regiao'] in ('Zona Noroeste', 'Morros') else 'CREAS Zona Leste'
    if b['regiao'] == 'Área Continental':
        b['saude'] = next(e['nome'] for e in ubs if 'Caruara' in e['nome'])
    else:
        b['saude'] = min([e for e in ubs if 'Caruara' not in e['nome']], key=lambda e: dist(b, e))['nome']

with open(os.path.join(RAIZ, 'data', 'bairros_territorios.csv'), 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh, delimiter=';')
    w.writerow(['bairro', 'regiao', 'zona', 'cras', 'creas', 'saude', 'area_km2'])
    for b in bairros:
        w.writerow([b['nome'], b['regiao'], b['zona'], b['cras'], b['creas'], b['saude'], str(b['area_km2']).replace('.', ',')])

with open(os.path.join(RAIZ, 'data', 'equipamentos.csv'), 'w', newline='', encoding='utf-8') as fh:
    w = csv.DictWriter(fh, fieldnames=list(equip[0].keys()), delimiter=';')
    w.writeheader(); w.writerows(equip)

def ponto_rotulo(g):
    maior = max(getattr(g, 'geoms', [g]), key=lambda p: p.area)
    pt = polylabel(maior, tolerance=0.00002)
    return round(pt.x, 6), round(pt.y, 6)

feats = []
for b in bairros:
    lx, ly = ponto_rotulo(b['geom'])
    feats.append({'type': 'Feature', 'properties': {'nome': b['nome'], 'lx': lx, 'ly': ly}, 'geometry': mapping(b['geom'])})
json.dump({'type': 'FeatureCollection', 'features': feats},
          open(os.path.join(BUILD, 'bairros.geojson'), 'w', encoding='utf-8'), ensure_ascii=False)

# limite municipal (contorno de fundo, mostra a área continental que não tem bairro)
lim = unary_union([shape(f['geometry']) for f in d['limite']['features']])
if lim.geom_type in ('LineString', 'MultiLineString', 'LinearRing'):
    lim = unary_union(list(polygonize(lim)))
lim = lim.buffer(0)
# guarda só a parte continental (a parte insular já é coberta pelos bairros)
ilha = unary_union([b['geom'] for b in bairros if b['regiao'] != 'Área Continental']).buffer(0.004)
lim = lim.difference(ilha)
lim = unary_union([p for p in getattr(lim, 'geoms', [lim]) if p.area > 1e-6])
json.dump({'type': 'FeatureCollection', 'features': [{'type': 'Feature', 'properties': {'nome': 'Área continental'}, 'geometry': mapping(lim)}]},
          open(os.path.join(BUILD, 'limite.geojson'), 'w', encoding='utf-8'), ensure_ascii=False)
print('limite:', lim.geom_type, round(lim.area * 111.32 ** 2 * math.cos(math.radians(23.95)), 1), 'km2')
json.dump({'fonte': d['fonte']}, open(os.path.join(BUILD, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False)

from collections import Counter
print(len(bairros), 'bairros;', len(equip), 'equipamentos', Counter(e['tipo'] for e in equip))
print(Counter(b['cras'] for b in bairros))
