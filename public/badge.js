/* ShopSure badge. Shops add:
 *   <div data-shopsure-shop="your-shop-id"></div>
 *   <script src="https://YOUR-SHOPSURE-HOST/badge.js" async></script>
 * The badge asks ShopSure whether THIS page is the shop's registered site.
 * A copied badge on another site turns red instead of green. */
(function () {
  var scripts = document.querySelectorAll('script[src*="badge.js"]');
  var src = scripts.length ? scripts[scripts.length - 1].src : "/badge.js";
  var origin = new URL(src, location.href).origin;

  function render(el, d) {
    var ok = d && d.ok;
    var color = ok ? (d.tier === "trusted" ? "#15803d" : "#a16207") : "#b91c1c";
    var title = ok
      ? (d.tier === "trusted" ? "✓ ShopSure Verified" : "ShopSure: New shop")
      : "⚠ Fake ShopSure badge";
    var line = ok
      ? "Trust score " + d.score + "/100 from real PayPal history"
      : (d && d.realSite ? "This badge belongs to " + d.name + ", not this site." : "This badge could not be verified.");
    el.innerHTML =
      '<a href="' + origin + (d && d.reportPath ? d.reportPath : "/") + '" target="_blank" rel="noopener" ' +
      'style="display:inline-flex;flex-direction:column;gap:2px;padding:8px 12px;border-radius:10px;' +
      "background:#fff;border:2px solid " + color + ";color:" + color + ';font:600 13px system-ui,sans-serif;text-decoration:none">' +
      "<span>" + title + "</span>" +
      '<span style="font-weight:400;color:#44403c;font-size:12px">' + line + "</span></a>";
  }

  document.querySelectorAll("[data-shopsure-shop]").forEach(function (el) {
    var shop = el.getAttribute("data-shopsure-shop");
    fetch(origin + "/api/badge/verify?shop=" + encodeURIComponent(shop) + "&page=" + encodeURIComponent(location.href))
      .then(function (r) { return r.json(); })
      .then(function (d) { render(el, d); })
      .catch(function () { render(el, null); });
  });
})();
