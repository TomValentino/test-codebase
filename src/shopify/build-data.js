import { fetchShopifyStorefront } from "./fetch.js";
import { formatProductDetail, formatProductSummary } from "./format.js";
import {
  COLLECTION_FOR_BUILD_QUERY,
  COLLECTION_HANDLES_FOR_BUILD_QUERY,
  PRODUCT_FOR_BUILD_QUERY,
  PRODUCT_HANDLES_FOR_BUILD_QUERY,
  PRODUCTS_FOR_BUILD_QUERY
} from "./queries.js";

const DEFAULT_PRODUCT_LIMIT = 120;

const productLists = new Map();
const collections = new Map();
const productDetails = new Map();
let collectionHandles;
let productHandles;

/* -------------------------------------------------------------------------- */
/* Product build data                                                         */
/* -------------------------------------------------------------------------- */

/** Fetch every Storefront-published product handle for /products/[handle]. */
export function getProductHandlesForBuild() {
  if (!productHandles) productHandles = fetchProductHandles();
  return productHandles;
}

async function fetchProductHandles() {
  const handles = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await fetchShopifyStorefront(PRODUCT_HANDLES_FOR_BUILD_QUERY, {
      first: 250,
      after
    });

    handles.push(...data.products.nodes.map((product) => product.handle));
    hasNextPage = Boolean(data.products.pageInfo.hasNextPage);
    after = data.products.pageInfo.endCursor;
  }

  return handles;
}

/** Fetch catalog products for pages such as home. Never fetches a collection. */
export function getProductsForBuild({ limit = DEFAULT_PRODUCT_LIMIT } = {}) {
  const safeLimit = readLimit(limit);

  if (!productLists.has(safeLimit)) {
    productLists.set(safeLimit, fetchProducts(safeLimit));
  }

  return productLists.get(safeLimit);
}

async function fetchProducts(limit) {
  const products = [];
  let after = null;
  let hasNextPage = true;

  while (products.length < limit && hasNextPage) {
    const data = await fetchShopifyStorefront(PRODUCTS_FOR_BUILD_QUERY, {
      first: Math.min(250, limit - products.length),
      after
    });

    products.push(
      ...data.products.nodes
        .filter((product) => product.availableForSale)
        .map(formatProductSummary)
    );

    hasNextPage = Boolean(data.products.pageInfo.hasNextPage);
    after = data.products.pageInfo.endCursor;
  }

  return products.slice(0, limit);
}

/** Fetch one complete product for its static product page. */
export function getProductForBuild(handle) {
  if (!productDetails.has(handle)) {
    productDetails.set(
      handle,
      fetchShopifyStorefront(PRODUCT_FOR_BUILD_QUERY, { handle })
        .then((data) => data.product)
        .then((product) => product ? formatProductDetail(product) : null)
    );
  }

  return productDetails.get(handle);
}

/* -------------------------------------------------------------------------- */
/* Collection build data                                                      */
/* -------------------------------------------------------------------------- */

/** Fetch collection handles once. Used only to discover /collections/[handle]. */
export function getCollectionHandlesForBuild() {
  if (!collectionHandles) collectionHandles = fetchCollectionHandles();
  return collectionHandles;
}

async function fetchCollectionHandles() {
  const handles = [];
  let after = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await fetchShopifyStorefront(COLLECTION_HANDLES_FOR_BUILD_QUERY, {
      first: 250,
      after
    });

    handles.push(...data.collections.nodes.map((collection) => collection.handle));
    hasNextPage = Boolean(data.collections.pageInfo.hasNextPage);
    after = data.collections.pageInfo.endCursor;
  }

  return handles;
}

/** Fetch one collection and paginate only that collection's products. */
export function getCollectionForBuild(
  handle,
  { limit = Infinity } = {}
) {
  const safeLimit = readLimit(limit, Infinity);
  const key = `${handle}:${safeLimit}`;

  if (!collections.has(key)) {
    collections.set(key, fetchCollection(handle, safeLimit));
  }

  return collections.get(key);
}

async function fetchCollection(handle, limit) {
  const products = [];
  let collection;
  let after = null;
  let hasNextPage = true;

  while (products.length < limit && hasNextPage) {
    const data = await fetchShopifyStorefront(COLLECTION_FOR_BUILD_QUERY, {
      handle,
      first: Math.min(250, limit - products.length),
      after
    });

    if (!data.collection) return null;

    collection ??= {
      id: data.collection.id,
      handle: data.collection.handle,
      title: data.collection.title,
      description: data.collection.description
    };

    const connection = data.collection.products;
    products.push(
      ...connection.nodes
        .filter((product) => product.availableForSale)
        .map(formatProductSummary)
    );

    hasNextPage = Boolean(connection.pageInfo.hasNextPage);
    after = connection.pageInfo.endCursor;
  }

  return {
    ...collection,
    products: products.slice(0, limit)
  };
}

function readLimit(limit, fallback = DEFAULT_PRODUCT_LIMIT) {
  if (limit === Infinity) return Infinity;

  const number = Number(limit);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.floor(number));
}
