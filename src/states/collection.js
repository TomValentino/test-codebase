import { createSignal } from "solid-js";

const [reactiveCollection, setReactiveCollection] = createSignal();

let normalizedCollection;
let allProducts = [];
let productsPerPage = 12;
let instantCollection;

export const collectionState = {
  seed: {
    page: {
      scope: "page",
      source: "urlParam",
      key: "page",
      format: "text",
      fallback: "1"
    },
    size: {
      scope: "page",
      source: "urlParam",
      key: "size",
      format: "text",
      fallback: ""
    }
  },

  setup,
  getCollection,
  loadMore,
  setSize
};

/** Store this page's normalized Shopify collection/products before the UI renders. */
function setup({
  collection,
  allProducts: products = [],
  productsPerPage: pageSize = 12
} = {}) {
  normalizedCollection = collection ?? null;
  allProducts = Array.isArray(collection?.products)
    ? collection.products
    : Array.isArray(products)
      ? products
      : [];
  productsPerPage = Math.max(1, Number(pageSize) || 12);
  instantCollection = undefined;
  setReactiveCollection(undefined);
}

/** First call returns the pre-paint collection. Later calls return the Solid signal. */
function getCollection() {
  if (reactiveCollection() !== undefined) return reactiveCollection();

  instantCollection ??= readInstantCollection();
  return instantCollection;
}

/** Add only filtering/pagination state to the already-normalized collection data. */
function readInstantCollection() {
  const selectedSize = String(
    typeof window === "undefined" ? "" : window.__SEED__?.page?.size ?? ""
  ).trim();
  const page = Math.max(
    1,
    Number.parseInt(
      typeof window === "undefined" ? "1" : window.__SEED__?.page?.page ?? "1",
      10
    ) || 1
  );
  const filteredProducts = filterProducts(selectedSize);
  const productsShown = Math.min(filteredProducts.length, page * productsPerPage);

  return {
    ...(normalizedCollection ?? {}),
    products: allProducts,
    visibleProducts: filteredProducts.slice(0, productsShown),
    totalProducts: filteredProducts.length,
    productsShown,
    productsPerPage,
    selectedSize,
    sizes: [...new Set(
      allProducts.flatMap((product) => product.options?.size ?? [])
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    hasMore: productsShown < filteredProducts.length,
    nextCount: Math.min(productsPerPage, filteredProducts.length - productsShown)
  };
}

function loadMore() {
  const collection = getCollection();
  if (!collection.hasMore) return;

  const filteredProducts = filterProducts(collection.selectedSize);
  const productsShown = Math.min(
    collection.productsShown + productsPerPage,
    filteredProducts.length
  );

  saveCollection({
    ...collection,
    visibleProducts: filteredProducts.slice(0, productsShown),
    totalProducts: filteredProducts.length,
    productsShown,
    hasMore: productsShown < filteredProducts.length,
    nextCount: Math.min(productsPerPage, filteredProducts.length - productsShown)
  });
}

function setSize(size) {
  const collection = getCollection();
  const selectedSize = String(size || "").trim();
  const filteredProducts = filterProducts(selectedSize);
  const productsShown = Math.min(productsPerPage, filteredProducts.length);

  saveCollection({
    ...collection,
    selectedSize,
    visibleProducts: filteredProducts.slice(0, productsShown),
    totalProducts: filteredProducts.length,
    productsShown,
    hasMore: productsShown < filteredProducts.length,
    nextCount: Math.min(productsPerPage, filteredProducts.length - productsShown)
  });
}

/** One commit moves the instant collection into Solid reactive state. */
function saveCollection(collection) {
  instantCollection = collection;
  setReactiveCollection(collection);
  updateUrl(collection);
}

function filterProducts(size) {
  if (!size) return allProducts;

  return allProducts.filter((product) =>
    product.options?.size?.some(
      (value) => value.toLowerCase() === size.toLowerCase()
    )
  );
}

function updateUrl(collection) {
  if (typeof window === "undefined") return;

  const page = Math.max(1, Math.ceil(collection.productsShown / productsPerPage));

  window.__SEED__.page.page = String(page);
  window.__SEED__.page.size = collection.selectedSize;

  const nextUrl = new URL(window.location.href);

  if (page > 1) nextUrl.searchParams.set("page", String(page));
  else nextUrl.searchParams.delete("page");

  if (collection.selectedSize) {
    nextUrl.searchParams.set("size", collection.selectedSize);
  } else {
    nextUrl.searchParams.delete("size");
  }

  window.__ROUTER__?.replaceCurrentUrl(nextUrl);
}
