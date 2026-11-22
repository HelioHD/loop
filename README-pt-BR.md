# LOOP — Looking Promos

> Autor: **Hélio Delfino Lopes de Alcântara** — Pesquisador e pentester web especializado

Scraper local pra Black Friday: você digita um nicho ("perfume árabe", "moda plus size") e o LOOP varre a web atrás de **lojas**, **produtos** e **promoções**.

## Rodar

```powershell
cd C:\Users\Pichau\loop
npm install   # só na primeira vez
npm start     # ou dois cliques em start.bat
```

Abra **http://127.0.0.1:4747**. Precisa de Node 22+ (usa `node:sqlite` nativo).

## Fontes

| Aba | Fonte | O que traz |
|---|---|---|
| Lojas | Busca web — Yahoo BR (DuckDuckGo e Bing de reserva), 8 consultas × 3 páginas | Lojas de nicho, grandes varejistas (com selo e filtro) e perfis de Instagram, agrupados por domínio, com filtro de relevância |
| Produtos | Buscapé (5 páginas) e Zoom (3 páginas) | Produto, menor preço, loja da melhor oferta, nº de lojas |
| Produtos | KaBuM! | Até 100 itens, com preço à vista/oferta relâmpago, preço "de" e % de desconto |
| Produtos | Mercado Livre (via busca web `site:`) | Anúncios e lojas oficiais, **sem preço** |
| Promoções | Pelando | Ofertas da comunidade com preço, loja, temperatura e data |

## Limitações conhecidas

- **Mercado Livre bloqueia raspagem direta**: a API pública responde 403 e a listagem redireciona pra verificação de conta (testado com `fetch` e com Edge headless). Preço do ML só aparece quando a oferta vem pelo Pelando. A aba Produtos tem um link pra abrir a busca direto no ML.
- **Magalu, Casas Bahia, Shopee, Amazon e Americanas** bloqueiam ou carregam os produtos só no navegador; aparecem como loja (via busca web), mas sem catálogo de produtos.
- **DuckDuckGo** começa a pedir captcha depois de muitas buscas seguidas; por isso o Yahoo é o motor principal.
- O filtro "Mostrar" separa lojas de nicho de grande varejo; "Esconder sites de conteúdo" tira blogs e revistas.
- Os scrapers dependem do HTML de terceiros; se um site mudar o layout, aquela fonte aparece com erro no **Log das fontes** e as outras continuam.

## Estrutura

```
server.js               API Express + proxy de imagem (allowlist) + export CSV
src/engine.js           orquestra as fontes por modo
src/sources/*.js        websearch, stores, buscape (+zoom), kabum, pelando, mercadolivre
src/db.js               histórico em SQLite (data/loop.db)
public/                 front-end (HTML/CSS/JS puros)
```
