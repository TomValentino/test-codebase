import { createShopifyResponsiveImageSources } from "./images.js";

/* -------------------------------------------------------------------------- */
/* Shared formatting                                                          */
/* -------------------------------------------------------------------------- */

export function formatMoney(money) {
  if (!money?.currencyCode) return "";

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: money.currencyCode
  }).format(Number(money.amount));
}

/* -------------------------------------------------------------------------- */
/* Product formatting                                                         */
/* -------------------------------------------------------------------------- */

export function formatProductSummary(product) {
  const image = product.featuredImage;

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    priceText: formatMoney(product.priceRange.minVariantPrice),
    options: Object.fromEntries(
      (product.options ?? []).map((option) => [
        normalizeOptionName(option.name),
        (option.optionValues ?? []).map((value) => value.name)
      ])
    ),
    image: image?.url
      ? {
          altText: image.altText,
          width: image.width,
          height: image.height,
          ...createShopifyResponsiveImageSources(image.url, {
            defaultWidth: 672,
            widths: [320, 480, 520, 640, 672, 768],
            sizes:
              "(max-width: 520px) calc(100vw - 28px), " +
              "(max-width: 760px) calc((100vw - 50px) / 2), " +
              "(max-width: 900px) calc((100vw - 70px) / 2), " +
              "259px"
          })
        }
      : null
  };
}

export function formatProductDetail(product) {
  const rawVariants = product.variants.nodes;
  const rawImages = [...product.images.nodes];

  // Variant images are not guaranteed to be in product.images, so include each
  // one once and let variants reference it by ID rather than duplicate image data.
  for (const variant of rawVariants) {
    if (variant.image?.id && !rawImages.some((image) => image.id === variant.image.id)) {
      rawImages.push(variant.image);
    }
  }

  const images = rawImages.map(formatProductImage).filter(Boolean);
  const variants = rawVariants.map((variant) => ({
    id: variant.id,
    urlId: variant.id.split("/").pop(),
    title: variant.title,
    availableForSale: variant.availableForSale,
    options: Object.fromEntries(
      variant.selectedOptions.map((option) => [
        normalizeOptionName(option.name),
        option.value
      ])
    ),
    priceText: formatMoney(variant.price),
    imageId: variant.image?.id ?? ""
  }));

  const options = {};
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.options)) {
      options[name] ??= [];
      if (!options[name].includes(value)) options[name].push(value);
    }
  }

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description,
    images,
    variants,
    options,
    defaultVariantId:
      product.selectedOrFirstAvailableVariant?.id ?? variants[0]?.id ?? ""
  };
}

/** Responsive sources are prepared once during the build, never on interaction. */
function formatProductImage(image) {
  if (!image?.url) return null;

  return {
    id: image.id,
    altText: image.altText,
    width: image.width,
    height: image.height,
    main: createShopifyResponsiveImageSources(image.url, {
      defaultWidth: 960,
      widths: [320, 480, 640, 672, 768, 960, 1146, 1200],
      sizes:
        "(max-width: 760px) calc(100vw - 28px), " +
        "(max-width: 1148px) calc(55vw - 58px), " +
        "573px"
    }),
    thumbnail: createShopifyResponsiveImageSources(image.url, {
      defaultWidth: 160,
      widths: [80, 120, 160, 240, 320],
      sizes: "76px"
    })
  };
}

function normalizeOptionName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized === "colour" ? "color" : normalized;
}

/* -------------------------------------------------------------------------- */
/* Cart formatting                                                            */
/* -------------------------------------------------------------------------- */

export function formatCart(cart) {
  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    updatedAt: cart.updatedAt,
    count: cart.totalQuantity,
    totalPrice: formatMoney(cart.cost.totalAmount),
    items: cart.lines.nodes.map((line) => ({
      id: line.id,
      merchandiseId: line.merchandise?.id ?? "",
      productHandle: line.merchandise?.product?.handle ?? "",
      title: line.merchandise?.product?.title ?? "Product",
      variantTitle: line.merchandise?.title ?? "",
      quantity: line.quantity,
      price: formatMoney(line.cost.totalAmount),
      image: line.merchandise?.image ?? null
    }))
  };
}
