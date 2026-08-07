import ProductDetails from "../../../ui/ProductDetails.instant.jsx";
import {
  getProductForBuild,
  getProductHandlesForBuild
} from "../../../shopify/build-data.js";

export const layout = "site";

/** Discover every product handle without fetching full listing data. */
export async function getAllDynamicPaths() {
  const handles = await getProductHandlesForBuild();
  return handles.map((handle) => ({ handle }));
}

export async function getData({ params }) {
  const product = await getProductForBuild(params.handle);
  if (!product) throw new Error(`Product not found: ${params.handle}`);

  return {
    meta: { title: `${product.title} | Shopify Storefront` },
    product
  };
}

export default function ProductPage({ product }) {
  return (
    <main class="page">
      <ProductDetails product={product} />
    </main>
  );
}
