/**
 * Build the responsive URL fields for one Shopify CDN image.
 *
 * This helper deliberately returns only the three fields that belong to
 * responsive delivery. Alt text, HTML width/height, loading and priority stay
 * beside the <img> so each page remains easy to understand.
 */
export function createShopifyResponsiveImageSources(
  originalImageUrl,
  { defaultWidth, widths, sizes }
) {
  if (!originalImageUrl) return { src: "", srcset: "", sizes };

  if (!originalImageUrl.includes("cdn.shopify.com")) {
    return { src: originalImageUrl, srcset: "", sizes };
  }

  const responsiveWidths = [...new Set([defaultWidth, ...widths])]
    .filter((width) => Number.isInteger(width) && width > 0)
    .sort((firstWidth, secondWidth) => firstWidth - secondWidth);

  return {
    src: addWidthToShopifyImageUrl(originalImageUrl, defaultWidth),
    srcset: responsiveWidths
      .map(
        (width) =>
          `${addWidthToShopifyImageUrl(originalImageUrl, width)} ${width}w`
      )
      .join(", "),
    sizes
  };
}

/** Preserve Shopify's existing version parameter and add only image width. */
function addWidthToShopifyImageUrl(originalImageUrl, width) {
  const imageUrl = new URL(originalImageUrl);
  imageUrl.searchParams.set("width", String(width));
  return imageUrl.toString();
}
