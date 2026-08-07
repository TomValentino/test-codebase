import { For, Show } from "solid-js";

import { instant } from "../../engine/instant.jsx";
import { productState } from "../states/product.js";

function ProductDetails() {
  const product = productState.getProduct;
  // const browser = typeof window !== "undefined";

  return (
    <div class="product-page">
      <section class="product-gallery">
        <div class="product-image-panel image-loading-frame">
          <Show when={product().selectedImage}>
            <img
              src={product().selectedImage.main.src}
              srcset={product().selectedImage.main.srcset}
              sizes={product().selectedImage.main.sizes}
              alt={product().selectedImage.altText || product().title}
              width={product().selectedImage.width || 800}
              height={product().selectedImage.height || 800}
              loading= "eager"
              fetchpriority="high"
            />
          </Show>
        </div>

        <Show when={product().images.length > 1}>
          <div class="product-gallery-thumbnails">
            <For each={product().images}>
              {(image) => (
                <button
                  class="product-gallery-thumbnail"
                  classList={{ selected: product().selectedImage?.id === image.id }}
                  type="button"
                  onClick={() => productState.selectImage(image)}
                  aria-label={`Show ${image.altText || product().title}`}
                >
                  <img
                    src={image.thumbnail.src}
                    srcset={image.thumbnail.srcset}
                    sizes={image.thumbnail.sizes}
                    alt=""
                    width={image.width || 160}
                    height={image.height || 160}
                    loading="lazy"
                  />
                </button>
              )}
            </For>
          </div>
        </Show>
      </section>

      <section class="product-details">
        <p class="eyebrow">Prebuilt Shopify product</p>
        <h1>{product().title}</h1>
        <p>{product().description}</p>

        <div class="product-purchase">
          <Show when={product().options?.color?.length > 0}>
            <fieldset class="product-option-group">
              <legend>Color</legend>
              <div class="product-color-options">
                <For each={product().options.color}>
                  {(color) => {
                    const image = () => productState.getColorImage(color);

                    return (
                      <button
                        class="product-color-option"
                        classList={{ selected: product().selectedColor === color }}
                        type="button"
                        disabled={!productState.isColorAvailable(color)}
                        onClick={() => productState.selectColor(color)}
                      >
                        <Show when={image()}>
                          <img
                            src={image().thumbnail.src}
                            srcset={image().thumbnail.srcset}
                            sizes="56px"
                            alt=""
                            width={image().width || 80}
                            height={image().height || 80}
                            loading="lazy"
                          />
                        </Show>
                        <span>{color}</span>
                      </button>
                    );
                  }}
                </For>
              </div>
            </fieldset>
          </Show>

          <Show when={product().options?.size?.length > 0}>
            <fieldset class="product-option-group">
              <legend>Size</legend>
              <div class="product-size-options">
                <For each={product().options.size}>
                  {(size) => (
                    <button
                      class="product-size-option"
                      classList={{ selected: product().selectedSize === size }}
                      type="button"
                      disabled={!productState.isSizeAvailable(size)}
                      onClick={() => productState.selectSize(size)}
                    >
                      {size}
                    </button>
                  )}
                </For>
              </div>
            </fieldset>
          </Show>

          <Show when={product().selectedColor || product().selectedSize}>
            <p class="product-selected-options">
              {[product().selectedColor, product().selectedSize]
                .filter(Boolean)
                .join(" / ")}
            </p>
          </Show>

          <p class="product-price">{product().selectedVariant?.priceText}</p>

          <button
            class="button"
            type="button"
            disabled={product().adding || !product().selectedVariant?.availableForSale}
            onClick={productState.addToCart}
          >
            {product().adding
              ? "Adding…"
              : product().selectedVariant?.availableForSale
                ? "Add to cart"
                : "Sold out"}
          </button>

          <Show when={product().message}>
            <p class="product-message" aria-live="polite">{product().message}</p>
          </Show>
        </div>
      </section>
    </div>
  );
}

export default instant("productDetails", ProductDetails, productState);
