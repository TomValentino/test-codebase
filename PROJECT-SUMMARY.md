# Project summary

## Architecture rule

Keep the import graph obvious. Prefer one central state object and one clear data pipeline over registries, providers, generic factories, or functions that switch between unrelated jobs.

## Engine

Only four files:

- `engine/build.js` — SSG, layouts, dynamic paths, browser bundle, HTML/CSP, demo server.
- `engine/client.jsx` — discovers `*.instant.jsx`, creates runtime, reads seed, starts router.
- `engine/instant.jsx` — `instant()` wrapper, seed/build JSON, before-paint mount, after-paint cleanup.
- `engine/router.js` — same-layout navigation and per-history-entry scroll restoration.

## State

All application state contracts are centralised in `src/states/`:

- `cart.js` — global `cartState`, localStorage seed, delayed Shopify reconciliation.
- `collection.js` — reusable page `collectionState`, currently `?page=` and `?size=`.
- `product.js` — product `?variant=` seed plus the complete before-paint / after-paint product-page lifecycle. The site layout already establishes the global cart seed through `CartIcon`.

## Shopify

- `fetch.js` — generic Storefront request only.
- `queries.js` — every GraphQL operation, clearly grouped.
- `format.js` — money, product summary/detail, cart normalization.
- `build-data.js` — build-time product/collection fetching, cache and pagination.
- `cart.js` — live browser cart reads/mutations.
- `images.js` — responsive image URL helper.

Build functions are intentionally separate:

```text
getProductsForBuild          catalog listing
getProductForBuild           one product
getProductHandlesForBuild    product route handles only
getCollectionHandlesForBuild collection route handles only
getCollectionForBuild        one collection + its products
```

There is no optional `collectionHandle` mode inside the catalog product function.

## Dynamic collections

`getAllDynamicPaths()` gets collection handles once. Each generated `/collections/[handle]` page then calls `getCollectionForBuild(handle)`, which fetches only that collection and follows its product cursor if another page exists.

Every collection route uses the same `CollectionProducts.instant.jsx` and the same `collectionState`; current collection data never lives at module level.

## Collection/filter contract

Shopify product options are included in each build summary as a generic lowercase-keyed object, for example:

```js
options: {
  size: ["S", "M", "L"],
  color: ["Red", "Black"]
}
```

Every seed uses the same contract: `scope`, `source`, `key`, `format`, `fallback`. Sources are currently `urlParam` and `localStorage`; formats are `text` and `json`.

`collectionState.seed` currently contains `page` and `size`.

First paint:

```text
allProducts + instant URL seeds
-> filter by size
-> calculate productsShown
-> correct product DOM
-> first paint
```

No reactive collection is created for first paint. The first Size or Load More action commits the same collection shape to one Solid signal. Load More updates `productsShown`; Size changes recompute `products`, reset pagination, and replace the current URL.

Future filters such as `color`, `vendor`, or sort should extend this same state object rather than add engine logic.

## Product route + 404 invariant

`getProductHandlesForBuild()` paginates every product handle exposed by the Storefront API and does not filter by `available_for_sale`. This means published sold-out products still get static product pages. Shopify omits products that are not published in the active Storefront context.

A single `src/pages/404/page.jsx` builds to top-level `dist/404.html`. Missing product, collection, and arbitrary URLs all use that generic page. Do not add section-specific 404s unless the design genuinely needs them later.

## Product page lifecycle

`ProductDetails.instant.jsx` uses normal Solid JSX and reads `product()`, `product().selectedVariant`, `product().selectedImage`, `product().selectedColor`, and `product().selectedSize` directly. `instant()` calls `productState.setup(...)` once before rendering. Gallery, Color, Size and cart buttons use visible JSX handlers.

## Product page interaction rule

ProductDetails uses the same state rule as cart UI. The URL variant seed is
resolved before paint, `productState.setup(...)` selects the correct variant/image
from the already-normalized product JSON, and the JSX reads the central state
directly. The first user change commits only selected product state to one Solid
signal.

After the selected hero image finishes loading, productState warms the remaining
responsive gallery images at low priority. That keeps the hero request first
while making later gallery/color image switches use the browser cache.


## Page-scoped state setup

The route passes prebuilt data only to the `.instant.jsx` boundary. The shared `instant()` wrapper calls that state object's `setup(...)` once before rendering, so CollectionProducts/ProductDetails receive no state props. Same-layout navigation disposes the current page, sets the next seed, mounts the fetched page against its own serialized instant data, then moves the mounted page into the live layout; page-scoped state resets cleanly while the global cart remains mounted.
