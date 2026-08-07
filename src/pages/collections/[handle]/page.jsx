import CollectionProducts from "../../../ui/CollectionProducts.instant.jsx";
import {
  getCollectionForBuild,
  getCollectionHandlesForBuild
} from "../../../shopify/build-data.js";

export const layout = "site";

const PRODUCTS_PER_PAGE = 12;

/** Discover only the collection handles needed for static route generation. */
export async function getAllDynamicPaths() {
  const handles = await getCollectionHandlesForBuild();
  return handles.map((handle) => ({ handle }));
}

/** Fetch this collection and all of its products, following Shopify cursors. */
export async function getData({ params }) {
  const collection = await getCollectionForBuild(params.handle);
  if (!collection) throw new Error(`Collection not found: ${params.handle}`);

  return {
    meta: { title: `${collection.title} | Shopify Storefront` },
    collection,
    productsPerPage: PRODUCTS_PER_PAGE
  };
}

export default function CollectionPage({ collection, productsPerPage }) {
  return (
    <main class="page">
      <section class="hero compact-hero">
        <p class="eyebrow">Collection</p>
        <h1>{collection.title}</h1>
        {collection.description && <p>{collection.description}</p>}
      </section>

      <CollectionProducts
        collection={collection}
        productsPerPage={productsPerPage}
      />
    </main>
  );
}
