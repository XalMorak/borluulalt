/* stock_sync.js — нөөц хадгалахад серверт шууд бичнэ.
   Өөр төхөөрөмж нэвтрэхэд products/wines-ийг бүтэн татна. */
(function () {
  if (window._stockSync) return;
  window._stockSync = true;

  /* new wrapper keeps the flags of the one it wraps, so other scripts' interval
     checks (e.g. fn._acct, fn._delta) still see themselves and don't wrap again —
     otherwise two scripts re-wrap each other forever and the chain grows every tick */
  function keepFlags(from, to) { Object.keys(from || {}).forEach(function (k) { if (k.charAt(0) === "_" && !(k in to)) to[k] = from[k]; }); return to; }
  function mirror() {
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e) {}
    try { if (window._fbDb && window._fbDb.ref) return window._fbDb; } catch (e2) {}
    try { if (typeof firebase !== "undefined" && firebase.database) return firebase.database(); } catch (e3) {}
    return null;
  }
  function real() {
    try { if (typeof window._realDb === "function" && window._realDb()) return window._realDb(); } catch (e) {}
    try { if (typeof initFirebase === "function") initFirebase(); } catch (e2) {}
    return window._fbDb || null;
  }
  async function writeStock() {
    var base = real();
    if (!base) return false;
    /* only the counted values, one transaction per item: a whole-array write would wipe
       sales deducted meanwhile by another supervisor (stock_ledger.js) */
    var edits = window._stockEdits || [];
    window._stockEdits = [];
    if (typeof window._stockSetCounts === "function") await window._stockSetCounts(edits);
    if (typeof window._deltaSync === "function") { try { await window._deltaSync({ nodes: ["products", "wines"], reason: "stock-count" }); } catch (e) {} }
    if (typeof window._stockShowServer === "function") window._stockShowServer();
    return true;
  }
  async function pullStock() {
    if (typeof window._deltaSync === "function") {
      /* products/wines are versioned by _meta (writeStock bumps it), so a delta is enough */
      try { await window._deltaSync({ nodes: ["products", "wines"], reason: "stock" }); } catch (e) {}
    }
    var base = mirror();
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
      keepFlags(orig, fn); fn._stockSync = true;
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
    keepFlags(orig, fn); fn._stockSync = true;
    window.showApp = fn;
  }
  function hookRefresh() {
    if (typeof window.refreshData !== "function" || window.refreshData._stockSync) return;
    var orig = window.refreshData;
    var fn = async function () {
      try { await pullStock(); } catch (e) {}
      return orig.apply(this, arguments);
    };
    keepFlags(orig, fn); fn._stockSync = true;
    window.refreshData = fn;
  }
  hookSave(); hookShow(); hookRefresh();
  App.keep(function () { hookSave(); hookShow(); hookRefresh(); });
})();
