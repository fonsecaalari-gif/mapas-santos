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
- deixa **você montar as faixas da legenda**: em "Faixas por", escolha **Montar eu mesmo (De – Até)** e digite, por exemplo, `21-36; 37-45`. Também aceita `até 20` e `acima de 45`. Cada faixa pode ter nome e cor próprios. Áreas cujo valor não cai em nenhuma faixa ficam cinza, com aviso. Se as faixas salvas forem de outro mapa e não servirem para os dados novos, a ferramenta refaz as faixas e avisa;
- tem **Mapa 3D**: cada área vira uma coluna, e a altura mostra o valor, então as áreas com mais valores sobressaem. Dá para girar, inclinar, ajustar a altura e "realçar diferenças". O PNG baixado sai em 3D;
- mostra um **gráfico de barras** (ranking do maior para o menor) abaixo do mapa, que também pode ser baixado em PNG;
- permite **trocar a cor e o texto de cada faixa** direto na legenda, por exemplo renomear "1" para "Alta vulnerabilidade". Há ainda uma paleta personalizada (você escolhe as duas cores das pontas), unidade (%, famílias…), casas decimais, título da legenda, subtítulo, tamanho dos nomes, estilo das áreas sem dado e opção de esconder a escala e a seta do norte.

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

**Corrigir endereço, localização ou categoria de um equipamento:** acrescente uma linha em `data/correcoes_equipamentos.csv` com o nome atual, e se quiser `novo_nome`, `tipo`, `endereco`, `lon` e `lat`. Depois rode os dois scripts acima. As correções valem sobre o dado do GeoServer. Por exemplo, os NIAS (CEU das Artes e Área Continental) estão na categoria **CRAS** por serem extensões do CRAS.

Ao editar à mão `data/bairros_territorios.csv` (separador `;`) ou `data/equipamentos.csv`, rode só `python3 scripts/montar_js.py` para regenerar `data/santos-base.js`.

## Estrutura

```
index.html, app.js, style.css   a ferramenta
data/santos-base.js             base pronta (geometria + territórios + equipamentos)
data/bairros_territorios.csv    bairro → zona, região, CRAS, CREAS, saúde (editável)
data/equipamentos.csv           equipamentos com coordenadas (gerado)
data/correcoes_equipamentos.csv correções manuais de endereço, local e categoria
data/fonte/                     dados originais do GeoServer
scripts/                        preparação da base
lib/                            d3 7.9.0 e topojson-client 3.1.0
```
