import CartIcon from "../ui/CartIcon.instant.jsx";

/** Visible shell. The router keeps this mounted while same-layout pages change. */
export default function SiteLayout(props) {
  return (
    <>
      <header class="site-header">
        <a class="brand" href="/">Instant Store</a>
        <nav class="site-nav" aria-label="Primary">
          <a href="/">Products</a>
          <CartIcon />
        </nav>
      </header>

      <div data-page-content>{props.children}</div>

      <footer class="site-footer">
        Static Shopify storefront POC
      </footer>
    </>
  );
}
