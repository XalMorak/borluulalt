/* stock_sync.js — нөөц хадгалахад серверт шууд бичнэ.
   Өөр төхөөрөмж нэвтрэхэд products/wines-ийг бүтэн татна. */
(function () {
  if (window._stockSync) return;
  window._stockSync = true;

  function real() {
    try { if (typeof window._realDb === "function" && window._realDb()) return window._realDb(); } catch (e) {}
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e2) {}
    return window._fbDb || null;
  }
  async function writeStock() {
    var base = real();
    if (!base) return false;
    var products = typeof getProducts === "function" ? getProducts() : [];
    var wines = typeof getWines === "function" ? getWines() : [];
    var tk = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    await base.ref("borluulalt").update({
      products: products,
      wines: wines,
      "_meta/products": tk,
      "_meta/wines": tk,
      updatedAt: new Date().toISOString()
    });
    return true;
  }
  async function pullStock() {
    if (typeof window._deltaSync === "function") {
      try { await window._deltaSync({ nodes: ["products", "wines"], full: true, reason: "stock" }); } catch (e) {}
    }
    var base = real();
    if (!base) return;
    var products = null, wines = null;
    try { products = (await base.ref("borluulalt/products").once("value")).val(); } catch (e) {}
    try { wines = (await base.ref("borluulalt/wines").once("value")).val(); } catch (e2) {}
    if (products && typeof setProducts === "function") setProducts(products);
    if (wines && typeof setWines === "function") setWines(wines);
    if (typeof window.drawMergedStock === "function") window.drawMergedStock();
    if (typeof buildStockTable === "function") buildStockTable();
  }
  function hookSave() {
    ["saveMergedStock", "saveAllStock", "addMergedItem", "deleteMergedItem"].forEach(function (name) {
      var f = window[name];
      if (typeof f !== "function" || f._stockSync) return;
      var orig = f;
      var fn = async function () {
        var r = await orig.apply(this, arguments);
        try { await writeStock(); } catch (e) {}
        return r;
      };
      fn._stockSync = true;
      window[name] = fn;
    });
  }
  function hookShow() {
    if (typeof window.showApp !== "function" || window.showApp._stockSync) return;
    var orig = window.showApp;
    var fn = function () {
      var r = orig.apply(this, arguments);
      var u = window.currentUser || {};
      if (u.role === "supervisor") setTimeout(pullStock, 300);
      return r;
    };
    fn._stockSync = true;
    window.showApp = fn;
  }
  function hookRefresh() {
    if (typeof window.refreshData !== "function" || window.refreshData._stockSync) return;
    var orig = window.refreshData;
    var fn = async function () {
      try { await pullStock(); } catch (e) {}
      return orig.apply(this, arguments);
    };
    fn._stockSync = true;
    window.refreshData = fn;
  }
  hookSave(); hookShow(); hookRefresh();
  setInterval(function () { hookSave(); hookShow(); hookRefresh(); }, 800);
})();
