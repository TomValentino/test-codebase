# Instant Shopify storefront POC

Small Vite + SolidJS static storefront with Shopify build data, instant URL/localStorage state, persistent cart state, and same-layout client routing.

## Read the project in this order

1. `src/pages/home/page.jsx` — catalog build data.
2. `src/pages/collections/[handle]/page.jsx` — one dynamic collection route.
3. `src/ui/CollectionProducts.instant.jsx` — shared collection markup.
4. `src/states/collection.js` — `?page=` + `?size=` first-paint and click state.
5. `src/states/cart.js` — equivalent global cart state pattern.
6. `src/shopify/build-data.js` — all SSG Shopify fetching/caching.
7. `src/shopify/queries.js` — all GraphQL, grouped by product/collection/cart.
8. `src/shopify/format.js` — product/cart normalization and money formatting.
9. `engine/client.jsx` → `engine/instant.jsx` → `engine/router.js` → `engine/build.js`.

## State is centralised

```text
src/states/cart.js        -> cartState
src/states/collection.js  -> collectionState
src/states/product.js     -> productState
```

Each object owns its own `seed`. Every seed uses the same explicit shape:

```js
{
  scope: "page" | "global",
  source: "urlParam" | "localStorage",
  key: "...",
  format: "text" | "json",
  fallback: ...
}
```

There is no `seed` vs `seedJSON`, and no `key` vs `storageKey`. `fallback` stays explicit so first paint always has a deterministic value.

Cart, collection and product follow the same core rule:

```js
reactiveValue() ?? instantValue
```

The instant value supplies the first render. A visitor action commits the selected/filter state to the Solid signal. Cart additionally starts its delayed Shopify reconciliation because it has an external live source of truth.

The shared `instant()` wrapper gives resolved page props + URL/localStorage seeds to `state.setup(...)` once before rendering. The UI then reads the central state directly:

```js
collection().visibleProducts
collection().selectedSize
product().title
product().selectedVariant
product().selectedImage
```

There is no prop-to-state setup inside the UI component. Same-layout navigation disposes the old page, sets the next seed, mounts the fetched page while it still owns its own serialized instant data, then moves that already-mounted page into the live layout. Page-scoped state resets without reading stale props or showing a fallback frame.

## Shopify build data is explicit

`src/shopify/build-data.js` has separate public functions with no mode-switching:

```js
getProductsForBuild()          // catalog products only
getProductForBuild(handle)     // one product page
getProductHandlesForBuild()    // every Storefront-published product route
getCollectionHandlesForBuild() // collection route discovery only
getCollectionForBuild(handle)  // one collection + its paginated products
```

`getCollectionForBuild()` fetches only the current collection. It fetches all products in that collection by default, following Shopify cursors in batches of up to 250. An optional limit can still cap the build payload when wanted.

The rest of Shopify is deliberately split by responsibility:

```text
fetch.js    -> one Storefront HTTP request
queries.js  -> GraphQL only
format.js   -> normalized app data only
build-data.js -> SSG fetch/cache/pagination
cart.js     -> browser cart operations
images.js   -> responsive Shopify image sources
```

## Instant collection state

Every product summary is already in the page JSON. Product options are normalized as:

```js
{
  options: {
    size: ["S", "M", "L"],
    color: ["Black", "Red"]
  }
}
```

On `/collections/shirts/?size=M&page=2`:

```text
instant reads size=M + page=2
-> filter immutable allProducts by size
-> calculate productsShown
-> correct cards exist before first paint
-> no reactive collection exists yet
-> first Size / Load more action commits the same shape to one Solid signal
```

The central collection state exposes the useful page values directly:

```js
collection()
collectionState.allProducts
collection().visibleProducts
collection().totalProducts
collection().productsShown
collectionState.productsPerPage
collection().selectedSize
collection().sizes
collection().hasMore
collection().nextCount
```

Only `collection().visibleProducts` exists in the active product grid. Filtering, pagination maths and derived counts stay inside `collectionState`, not in the JSX.

Adding another URL filter later follows the same pattern: add a seed (for example `color`), keep that metadata in the normalized product summaries, then extend `collectionState.setup()` / the filter action while the UI continues reading `collection().visibleProducts` directly.

## Dynamic collections

`src/pages/collections/[handle]/page.jsx` does not fetch the full collection list again for page data.

```text
getAllDynamicPaths()
-> getCollectionHandlesForBuild() once

each generated page
-> getCollectionForBuild(handle)
-> current collection metadata + current collection products only
-> same CollectionProducts.instant.jsx + collectionState
```

No new client registration or state object is needed per collection.

## Product pages and 404s

Product route discovery paginates the Storefront `products` connection in 250-item batches with no availability filter. Shopify already limits Storefront results to products published in the active storefront context, so sold-out but still published products still receive a product page.

`src/pages/404/page.jsx` builds to `dist/404.html`. Cloudflare Pages serves that one generic page for missing static URLs. The local demo server does the same, and the client router can display the 404 document without adding product/collection-specific not-found logic.

## Instant component convention

Browser-active UI is named `*.instant.jsx` and exports through the one `instant()` wrapper. There is no component registry.

## Run

```bash
npm install
npm run build
npm run demo
```

Useful URLs:

```text
http://127.0.0.1:4173/?page=3
http://127.0.0.1:4173/?size=M
http://127.0.0.1:4173/?size=M&page=2
http://127.0.0.1:4173/collections/<handle>/?size=M&page=2
```

Cloudflare output is `dist/`.

## Product instant state

Product pages use the normal instant Solid path, like cart UI. The instant engine resolves the compact `?variant=` seed before paint and calls `productState.setup(...)` once with the already-normalized product JSON. The JSX sets `const product = productState.getProduct` and then reads `product()`, `product().selectedVariant`, `product().selectedImage`, `product().selectedColor`, and `product().selectedSize` directly.

The selected variant decides the first price, Color, Size and main image before the page is revealed. Cart, collection and product now all use the same instant-value → reactive-signal pattern. There are no component-specific before/after-paint lifecycles.

The URL stores only the numeric Shopify variant suffix, for example `?variant=50745094045942`. The full `gid://shopify/ProductVariant/...` ID stays in product JSON for Shopify cart calls.

After the selected hero image loads, the remaining responsive gallery images are warmed at low priority. The hero request therefore wins first, while later gallery/color switches can use browser cache.
