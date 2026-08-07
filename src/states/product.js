import { createSignal } from "solid-js";

import { cartState } from "./cart.js";

const [reactiveProduct, setReactiveProduct] = createSignal();

let normalizedProduct;
let instantProduct;
let imagePreloadStarted = false;
let imagePreloads = [];

export const productState = {
  seed: {
    variant: {
      scope: "page",
      source: "urlParam",
      key: "variant",
      format: "text",
      fallback: ""
    }
  },

  setup,
  getProduct,
  getColorImage,
  isColorAvailable,
  isSizeAvailable,
  selectImage,
  selectColor,
  selectSize,
  addToCart
};

/** Store this page's normalized Shopify product before the UI renders. */
function setup({ product } = {}) {
  normalizedProduct = product ?? null;
  instantProduct = undefined;
  imagePreloadStarted = false;
  imagePreloads = [];
  setReactiveProduct(undefined);
}

/** First call returns the pre-paint product. Later calls return the Solid signal. */
function getProduct() {
  if (reactiveProduct() !== undefined) return reactiveProduct();

  instantProduct ??= readInstantProduct();
  startBackgroundImagePreload();
  return instantProduct;
}

/** Add only the visitor's selected state to the already-normalized product. */
function readInstantProduct() {
  if (!normalizedProduct) return null;

  const requestedVariant = typeof window === "undefined"
    ? ""
    : window.__SEED__?.page?.variant ?? "";
  const selectedVariant = findVariant(requestedVariant);
  const selectedImage = findVariantImage(selectedVariant);

  return {
    ...normalizedProduct,
    selectedVariant,
    selectedImage,
    selectedColor: selectedVariant?.options?.color ?? "",
    selectedSize: selectedVariant?.options?.size ?? "",
    adding: false,
    message: ""
  };
}

function getColorImage(color) {
  const product = getProduct();
  const variant = product.variants.find(
    (variant) => variant.options?.color === color && variant.imageId
  );

  return product.images.find((image) => image.id === variant?.imageId) ?? null;
}

function isColorAvailable(color) {
  return Boolean(findVariantForOptions({ color }));
}

function isSizeAvailable(size) {
  return Boolean(findVariantForOptions({
    color: getProduct().selectedColor,
    size
  }));
}

function selectImage(image) {
  if (!image) return;
  saveProduct({ ...getProduct(), selectedImage: image });
}

function selectColor(color) {
  const product = getProduct();
  const selectedVariant = findVariantForOptions({
    color,
    size: product.selectedSize
  }) ?? findVariantForOptions({ color });

  if (selectedVariant) selectVariant(selectedVariant);
}

function selectSize(size) {
  const product = getProduct();
  const selectedVariant = findVariantForOptions({
    color: product.selectedColor,
    size
  });

  if (!selectedVariant) return;

  saveProduct({
    ...product,
    selectedVariant,
    selectedSize: selectedVariant.options?.size ?? "",
    message: ""
  });

  updateVariantUrl(selectedVariant.urlId);
}

async function addToCart() {
  const product = getProduct();
  if (!product.selectedVariant?.availableForSale || product.adding) return;

  saveProduct({ ...product, adding: true, message: "Adding to Shopify…" });

  try {
    await cartState.addVariant(product.selectedVariant.id);
    saveProduct({
      ...getProduct(),
      adding: false,
      message: "Added to the live Shopify cart."
    });
  } catch (error) {
    saveProduct({
      ...getProduct(),
      adding: false,
      message: error instanceof Error ? error.message : "Could not update the cart"
    });
  }
}

function selectVariant(selectedVariant) {
  const product = getProduct();

  saveProduct({
    ...product,
    selectedVariant,
    selectedImage: findVariantImage(selectedVariant),
    selectedColor: selectedVariant.options?.color ?? "",
    selectedSize: selectedVariant.options?.size ?? "",
    message: ""
  });

  updateVariantUrl(selectedVariant.urlId);
}

/** One commit moves the instant product into Solid reactive state. */
function saveProduct(product) {
  instantProduct = product;
  setReactiveProduct(product);
}

function findVariant(requestedVariant) {
  const requested = String(requestedVariant || "");

  return normalizedProduct?.variants.find(
    (variant) => variant.urlId === requested || variant.id === requested
  )
    ?? normalizedProduct?.variants.find(
      (variant) => variant.id === normalizedProduct.defaultVariantId
    )
    ?? normalizedProduct?.variants.find((variant) => variant.availableForSale)
    ?? normalizedProduct?.variants[0]
    ?? null;
}

function findVariantForOptions({ color = "", size = "" }) {
  return normalizedProduct?.variants.find((variant) => {
    if (!variant.availableForSale) return false;
    if (color && variant.options?.color !== color) return false;
    if (size && variant.options?.size !== size) return false;
    return true;
  }) ?? null;
}

function findVariantImage(variant) {
  return normalizedProduct?.images.find((image) => image.id === variant?.imageId)
    ?? normalizedProduct?.images[0]
    ?? null;
}

/** Start warming the other full gallery images only after the page has loaded. */
function startBackgroundImagePreload() {
  if (typeof window === "undefined" || imagePreloadStarted || !normalizedProduct) return;
  imagePreloadStarted = true;

  const start = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    const selectedImageId = getProduct()?.selectedImage?.id;

    imagePreloads = normalizedProduct.images
      .filter((image) => image?.main?.src && image.id !== selectedImageId)
      .map((image) => {
        const loader = new Image();
        loader.fetchPriority = "low";
        loader.decoding = "async";
        loader.sizes = image.main.sizes;
        loader.srcset = image.main.srcset;
        loader.src = image.main.src;
        return loader;
      });
  }));

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

function updateVariantUrl(urlId) {
  if (typeof window === "undefined") return;

  window.__SEED__.page.variant = urlId || "";

  const nextUrl = new URL(window.location.href);
  if (urlId) nextUrl.searchParams.set("variant", urlId);
  else nextUrl.searchParams.delete("variant");

  window.__ROUTER__?.replaceCurrentUrl(nextUrl);
}
