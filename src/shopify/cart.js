import { fetchShopifyStorefront } from "./fetch.js";
import { formatCart } from "./format.js";
import {
  ADD_CART_LINE_MUTATION,
  CREATE_CART_MUTATION,
  FETCH_CART_QUERY,
  REMOVE_CART_LINES_MUTATION
} from "./queries.js";

export const EMPTY_CART = Object.freeze({
  id: "",
  checkoutUrl: "",
  updatedAt: "",
  count: 0,
  totalPrice: "",
  items: []
});

/** Read Shopify's current cart at low priority during background reconciliation. */
export async function fetchLiveShopifyCart(cartId) {
  const data = await fetchShopifyStorefront(
    FETCH_CART_QUERY,
    { cartId },
    { priority: "low" }
  );

  return data.cart ? formatCart(data.cart) : null;
}

/** Add a variant to the existing cart, or create the cart on first add. */
export async function addVariantToShopifyCart({ cartId, variantId, quantity = 1 }) {
  const lines = [{ merchandiseId: variantId, quantity }];

  if (cartId) {
    const data = await fetchShopifyStorefront(ADD_CART_LINE_MUTATION, {
      cartId,
      lines
    });
    return readCartMutation(data.cartLinesAdd);
  }

  const data = await fetchShopifyStorefront(CREATE_CART_MUTATION, { lines });
  return readCartMutation(data.cartCreate);
}

/** Remove every current line. */
export async function removeAllShopifyCartLines({ cartId, lineIds }) {
  const data = await fetchShopifyStorefront(REMOVE_CART_LINES_MUTATION, {
    cartId,
    lineIds
  });
  return readCartMutation(data.cartLinesRemove);
}

function readCartMutation(result) {
  if (!result) throw new Error("Shopify returned no cart mutation result");
  if (result.userErrors?.length) {
    throw new Error(result.userErrors.map((error) => error.message).join("; "));
  }
  if (!result.cart) throw new Error("Shopify returned no cart");
  return formatCart(result.cart);
}
