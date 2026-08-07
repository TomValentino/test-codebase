import { For, Show } from "solid-js";

import { instant } from "../../engine/instant.jsx";
import { cartState } from "../states/cart.js";


const STATUS_TEXT = {
  instant: "Instant local cart",
  cached: "Cached cart shown; Shopify check queued",
  checking: "Checking Shopify in the background",
  live: "Live Shopify cart",
  empty: "No Shopify cart yet",
  updating: "Updating Shopify",
  error: "Shopify unavailable; cached cart retained"
};

/** The cart page reads and changes the one central cart directly. */
function CartItems() {
  const cart = cartState.getCart;
  const status = cartState.getShopifyStatus;

  async function clearCart() {
    try {
      await cartState.clearCart();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <section class="cart-panel">
      <div class="cart-heading-row">
        <div>
          <p class="eyebrow">Instant cache → live Shopify</p>
          <h1>Your cart</h1>
        </div>
        <strong class="cart-count">{cart().count} items</strong>
      </div>

      <p class="cart-live-status" data-status={status()}>
        {STATUS_TEXT[status()] ?? status()}
      </p>

      <Show
        when={cart().items.length > 0}
        fallback={
          <div class="empty-cart">
            <h2>Your cart is empty</h2>
            <p>Add a real Shopify variant from one of the generated product pages.</p>
          </div>
        }
      >
        <ul class="cart-items" aria-label="Cart items">
          <For each={cart().items}>
            {(item) => (
              <li class="cart-item">
                <Show when={item.image?.url}>
                  <img
                    class="cart-item-image"
                    src={item.image.url}
                    alt={item.image.altText || item.title}
                    width="88"
                    height="88"
                  />
                </Show>
                <div class="cart-item-copy">
                  <h2>
                    <a href={`/products/${item.productHandle}/`}>{item.title}</a>
                  </h2>
                  <p>{item.variantTitle}</p>
                </div>
                <div class="cart-item-meta">
                  <span>Qty {item.quantity}</span>
                  <strong>{item.price}</strong>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <div class="cart-summary">
        <strong>Total {cart().totalPrice || "—"}</strong>
        <div class="actions">
          <Show when={cart().checkoutUrl}>
            <a class="button" href={cart().checkoutUrl} data-router-reload>Checkout</a>
          </Show>
          <button
            class="button secondary"
            type="button"
            disabled={status() === "updating" || cart().count === 0}
            onClick={clearCart}
          >
            Clear Shopify cart
          </button>
        </div>
      </div>
    </section>
  );
}

export default instant("cartItems", CartItems, cartState);
