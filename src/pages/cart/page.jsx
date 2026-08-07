import CartItems from "../../ui/CartItems.instant.jsx";

export const layout = "site";

export function getData() {
  return { meta: { title: "Cart | Shopify Cart POC" } };
}

export default function CartPage() {
  return (
    <main class="page cart-page">
      <CartItems />
    </main>
  );
}
