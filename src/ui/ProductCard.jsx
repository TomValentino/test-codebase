/** One normal product-card component for every collection/listing. */
export default function ProductCard({ product, productIndex = 1 }) {
  const image = product?.image;
  const isFirstProduct = productIndex === 0 && typeof window !== "undefined";

  return (
    <article class="product-card">
      <a href={`/products/${product.handle}/`}>
        {image?.src && (
          <div class="image-loading-frame product-card-image">
            <img
              src={image.src}
              srcset={image.srcset}
              sizes={image.sizes}
              alt={image.altText || product.title}
              width={image.width || 800}
              height={image.height || 800}
              loading={isFirstProduct ? "eager" : "lazy"}
              fetchpriority={isFirstProduct ? "high" : "low"}
              decoding={isFirstProduct ? undefined : "async"}
            />
          </div>
        )}

        <h2>{product.title}</h2>
        <p>{product.priceText}</p>
      </a>
    </article>
  );
}
