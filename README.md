# Mapas de Santos

Ferramenta para gerar **mapas de Santos/SP**, com a ilha e a área continental, colorindo qualquer indicador por:

- **Bairro** (71 bairros oficiais)
- **Zona** (Orla, Zona Intermediária, Zona Noroeste, Morros, Região Central Histórica, Área Continental)
- **Região**, nas 5 Prefeituras Regionais oficiais
- **Território de CRAS**, **território de CREAS** e **território de saúde (UBS/USF)**

Também mostra no mapa a localização de **CRAS, CREAS, Centro POP, centros de convivência, UBS/USF, UPAs, CAPS, hospitais, escolas municipais, escolas estaduais e educação conveniada**.

Tudo roda no navegador. Nenhum dado colado na ferramenta sai do seu computador.

## Como usar

1. Abra a página (link do GitHub Pages ou `index.html`).
2. No Excel, copie duas colunas: o **nome da área** e o **valor**. Exemplo:

   | Bairro      | Vulnerabilidade |
   |-------------|-----------------|
   | Rádio Clube | 1               |
   | Gonzaga     | 3               |

3. Cole no quadro **1. Cole seus dados** e clique em **Gerar mapa**.
4. Dê um título, informe a fonte e baixe o mapa em **PNG**, **PDF** ou **SVG**.

A ferramenta:

- reconhece sozinha se os nomes são bairros, zonas ou territórios. Acentos e maiúsculas não importam;
- entende números no formato brasileiro (`5.000`, `12,5`, `35%`);
- trata valores como 1, 2, 3 como **categorias**, e valores como 500 ou 5.000 como **faixas**. Dá para trocar em "Tipo de valor";
- recebe dados **por bairro** e mostra **por CRAS, zona ou região**, somando, tirando a média, o maior ou o menor valor;
- aceita várias colunas de indicadores de uma vez, e você escolhe qual mostrar;
- tem indicadores prontos, como área (km²) e número de CRAS, UBS ou escolas por bairro.

## Territórios: atenção

| Camada | Origem |
|---|---|
| Limites de bairro | **Oficial**: GeoServer da Prefeitura, camada `bairros` |
| Prefeituras Regionais | **Oficial**: camada `subprefeituras` |
| Localização dos equipamentos | **Oficial**: camada `unidadeorganizacional` |
| Orla × Zona Intermediária | Divisão usual (Orla = bairros da praia) |
| Bairros de cada CRAS, CREAS e UBS/USF | **Aproximação**: cada bairro foi ligado ao equipamento mais próximo dentro da sua região |

Corrija os territórios na aba **Territórios** da própria página. As mudanças ficam salvas no navegador e podem ser baixadas em CSV.
Para tornar a correção **definitiva para todo mundo**, substitua `data/bairros_territorios.csv` pelo CSV baixado e rode os scripts abaixo, ou peça para alguém do time fazer isso.

## Atualizar a base

```bash
pip install shapely
python3 scripts/preparar_dados.py   # lê data/fonte/santos_dados.json e gera os CSVs
bash scripts/gerar_base.sh          # simplifica a geometria (mapshaper) e gera data/santos-base.js
```

`data/fonte/santos_dados.json` foi baixado do GeoServer da Prefeitura de Santos (`https://egov.santos.sp.gov.br/geoserver/ows`, WFS).

Ao editar à mão `data/bairros_territorios.csv` (separador `;`) ou `data/equipamentos.csv`, rode só `python3 scripts/montar_js.py` para regenerar `data/santos-base.js`.

## Estrutura

```
index.html, app.js, style.css   a ferramenta
data/santos-base.js             base pronta (geometria + territórios + equipamentos)
data/bairros_territorios.csv    bairro → zona, região, CRAS, CREAS, saúde (editável)
data/equipamentos.csv           equipamentos com coordenadas (editável)
data/fonte/                     dados originais do GeoServer
scripts/                        preparação da base
lib/                            d3 7.9.0 e topojson-client 3.1.0
```
