"""Junta topologia + territorios + equipamentos em data/santos-base.js (carregado pelo index.html)."""
import csv, json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
topo = json.load(open(os.path.join(R, 'data/build/base.topojson'), encoding='utf-8'))
assert set(topo['objects']) == {'bairros', 'limite'}, topo['objects'].keys()
ler = lambda n: list(csv.DictReader(open(os.path.join(R, 'data', n), encoding='utf-8'), delimiter=';'))
terr = ler('bairros_territorios.csv')
equip = ler('equipamentos.csv')
for e in equip:
    e['lon'], e['lat'] = float(e['lon']), float(e['lat'])
for t in terr:
    t['area_km2'] = float(t['area_km2'].replace(',', '.'))
meta = json.load(open(os.path.join(R, 'data/build/meta.json'), encoding='utf-8'))
base = {'meta': meta, 'topo': topo, 'territorios': terr, 'equipamentos': equip}
js = '/* Gerado por scripts/montar_js.py - não edite à mão. Fonte: ' + meta['fonte'] + ' */\nwindow.SANTOS_BASE = ' + \
     json.dumps(base, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(os.path.join(R, 'data/santos-base.js'), 'w', encoding='utf-8').write(js)
print('santos-base.js:', round(len(js.encode()) / 1024), 'KB')
