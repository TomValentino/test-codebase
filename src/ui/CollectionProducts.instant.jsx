import { For, Show } from "solid-js";

import { instant } from "../../engine/instant.jsx";
import { collectionState } from "../states/collection.js";
import ProductCard from "./ProductCard.jsx";

function CollectionProducts() {
  const collection = collectionState.getCollection;

  return (
    <section class="collection-products">
      <Show when={collection()?.sizes.length > 0}>
        <label class="collection-filter">
          Size
          <select
            value={collection().selectedSize}
            onChange={(event) => collectionState.setSize(event.currentTarget.value)}
          >
            <option value="">All sizes</option>
            <For each={collection().sizes}>
              {(size) => <option value={size}>{size}</option>}
            </For>
          </select>
        </label>
      </Show>

      <div class="product-grid">
        <For each={collection().visibleProducts}>
          {(product, index) => (
            <ProductCard product={product} productIndex={index()} />
          )}
        </For>
      </div>

      <p class="collection-count">
        Showing {collection().productsShown} of {collection().totalProducts}
      </p>

      <Show when={collection().hasMore}>
        <button
          class="button"
          type="button"
          onClick={collectionState.loadMore}
        >
          Load {collection().nextCount} more
        </button>
      </Show>
    </section>
  );
}

export default instant("collectionProducts", CollectionProducts, collectionState);
