import CollectionProducts from "../../ui/CollectionProducts.instant.jsx";
import { getProductsForBuild } from "../../shopify/build-data.js";

export const layout = "site";

const PRODUCT_BUILD_LIMIT = 120;
const PRODUCTS_PER_PAGE = 12;

/** Fetch catalog product summaries once during the static build. */
export async function getData() {
  return {
    meta: { title: "Shopify Storefront" },
    allProducts: await getProductsForBuild({ limit: PRODUCT_BUILD_LIMIT }),
    productsPerPage: PRODUCTS_PER_PAGE
  };
}

export default function HomePage({ allProducts, productsPerPage }) {
  return (
    <main class="page">
      <section class="hero compact-hero">
        <p class="eyebrow">Build-time Shopify products</p>
        <h1>Static data. Instant page state.</h1>
        <p>
          Product JSON is built once. Page and size URL params resolve before
          first paint; interaction uses the same collection state afterward.
        </p>
      </section>

      <CollectionProducts
        allProducts={allProducts}
        productsPerPage={productsPerPage}
      />
    </main>
  );
}
