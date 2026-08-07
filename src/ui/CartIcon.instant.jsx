import { instant } from "../../engine/instant.jsx";
import { cartState } from "../states/cart.js";

/** Shared header reads the one global cart directly. */
function CartIcon() {
  const cart = cartState.getCart;

  return (
    <a
      class="cart-icon"
      href="/cart/"
      aria-label={`Cart with ${cart().count} items`}
    >
      Cart ({cart().count})
    </a>
  );
}

export default instant("cartIcon", CartIcon, cartState);
