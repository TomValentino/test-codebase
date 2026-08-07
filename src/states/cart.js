import { createSignal } from "solid-js";

import {
  EMPTY_CART,
  addVariantToShopifyCart,
  fetchLiveShopifyCart,
  removeAllShopifyCartLines
} from "../shopify/cart.js";

const STORAGE_KEY = "shopify-cart";
const RECONCILE_DELAY = 1000;

const [reactiveCart, setReactiveCart] = createSignal();
const [shopifyStatus, setShopifyStatus] = createSignal("instant");

let instantCart;
let backgroundCheckStarted = false;
let latestOperation = 0;
let lastSavedJson = "";

/** The complete cart API used directly by cart UI. */
export const cartState = {
  seed: {
    cart: {
      scope: "global",
      source: "localStorage",
      key: STORAGE_KEY,
      format: "json",
      fallback: EMPTY_CART
    }
  },

  getCart,
  getShopifyStatus: shopifyStatus,
  addVariant,
  clearCart
};

/** First call returns the pre-paint cart. Later calls return the Solid signal. */
function getCart() {
  if (reactiveCart() !== undefined) return reactiveCart();

  instantCart ??= readInstantCart();
  startBackgroundShopifyCheck();
  return instantCart;
}

/** User action: add a variant and commit Shopify's returned cart. */
async function addVariant(variantId, quantity = 1) {
  if (!variantId) throw new Error("Choose an available product variant");

  const operation = ++latestOperation;
  setShopifyStatus("updating");

  try {
    const updatedCart = await addVariantToShopifyCart({
      cartId: getCart().id,
      variantId,
      quantity
    });

    if (operation !== latestOperation) return;
    saveCart(updatedCart);
    setShopifyStatus("live");
  } catch (error) {
    if (operation === latestOperation) setShopifyStatus("error");
    throw error;
  }
}

/** User action: clear Shopify's current lines, or clear locally if none exist. */
async function clearCart() {
  const current = getCart();
  const lineIds = current.items.map((item) => item.id).filter(Boolean);

  if (!current.id || lineIds.length === 0) {
    saveCart(EMPTY_CART);
    setShopifyStatus("empty");
    return;
  }

  const operation = ++latestOperation;
  setShopifyStatus("updating");

  try {
    const updatedCart = await removeAllShopifyCartLines({
      cartId: current.id,
      lineIds
    });

    if (operation !== latestOperation) return;
    saveCart(updatedCart);
    setShopifyStatus("live");
  } catch (error) {
    if (operation === latestOperation) setShopifyStatus("error");
    throw error;
  }
}

/**
 * Cached pixels win first. Shopify starts only after:
 * load → two frames → one second → browser idle time.
 */
function startBackgroundShopifyCheck() {
  if (typeof window === "undefined" || backgroundCheckStarted) return;
  backgroundCheckStarted = true;

  const afterLoad = () => requestAnimationFrame(() => requestAnimationFrame(() => {
    if (reactiveCart() === undefined) {
      setReactiveCart(instantCart);
      setShopifyStatus(instantCart.id ? "cached" : "empty");
    }

    setTimeout(() => {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(reconcileWithShopify, { timeout: 4000 });
      } else {
        setTimeout(reconcileWithShopify, 0);
      }
    }, RECONCILE_DELAY);
  }));

  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}

/** Background action: replace cached data with Shopify's source of truth. */
async function reconcileWithShopify() {
  const current = reactiveCart() ?? instantCart ?? EMPTY_CART;

  if (!current.id) {
    if (current.count || current.items.length) saveCart(EMPTY_CART);
    setShopifyStatus("empty");
    return;
  }

  const operation = ++latestOperation;
  setShopifyStatus("checking");

  try {
    const liveCart = await fetchLiveShopifyCart(current.id);
    if (operation !== latestOperation) return;

    saveCart(liveCart ?? EMPTY_CART);
    setShopifyStatus(liveCart ? "live" : "empty");
  } catch (error) {
    if (operation === latestOperation) {
      setShopifyStatus("error");
      console.warn("Shopify cart check failed; cached cart retained.", error);
    }
  }
}

/** One commit keeps Solid, instant state and localStorage aligned. */
function saveCart(cart) {
  const json = JSON.stringify(cart);

  if (json !== lastSavedJson || reactiveCart() === undefined) {
    lastSavedJson = json;
    instantCart = cart;
    setReactiveCart(cart);
  }

  if (typeof window === "undefined") return;

  window.__SEED__.global.cart = cart;

  try {
    if (cart.id || cart.count) localStorage.setItem(STORAGE_KEY, json);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Reactive state remains correct if storage is unavailable.
  }
}

/** Accept only the small cart shape written by this application. */
function readInstantCart() {
  if (typeof window === "undefined") return EMPTY_CART;

  const cart = window.__SEED__?.global?.cart;
  if (!cart || typeof cart !== "object" || !Array.isArray(cart.items)) {
    return EMPTY_CART;
  }

  const safeCart = {
    id: typeof cart.id === "string" ? cart.id : "",
    checkoutUrl: typeof cart.checkoutUrl === "string" ? cart.checkoutUrl : "",
    updatedAt: typeof cart.updatedAt === "string" ? cart.updatedAt : "",
    count: Number.isFinite(cart.count) ? cart.count : 0,
    totalPrice: typeof cart.totalPrice === "string" ? cart.totalPrice : "",
    items: cart.items.filter((item) => item && typeof item === "object")
  };

  lastSavedJson = JSON.stringify(safeCart);
  return safeCart;
}
