/* stock_link.js — shared helpers, loaded early.
   1) Shared stock: a wine-catalog item that is the SAME physical good as a beer product uses the
      beer product's stock. Link = wine.stockOf (product id, additive field) or, if absent, the
      built-in list SHARED (normalized names) matched against the beer catalog.
      "Ерөө говь задгай" is in both catalogs (beer id 8 and a wine-sheet "Бусад бараа" item), so
      whichever sheet sells it, stock_ledger deducts product 8 — one pool, exactly once.
   2) VIP combined sheet: location VIP (any тек) = beer + wine in one section, kind/sheet "vip". */
(function(){
  if(window._stockLink) return; window._stockLink=true;
  var SHARED=["ерөөговьзадгай"];
  function key(s){ return String(s||"").toLowerCase().replace(/[\s\-_.]+/g,""); }
  function beers(){ try{ return (typeof getProducts==="function"?getProducts():[]).filter(function(p){ return p && !p.deleted && Number(p.id)<100; }); }catch(e){ return []; } }
  function wineById(id){ try{ return (typeof getWines==="function"?getWines():[]).filter(function(w){ return w && Number(w.id)===Number(id); })[0]||null; }catch(e){ return null; } }
  /* product id that holds the stock of this wine item, or 0 */
  window._stockLinkOf=function(w){
    if(w!=null && typeof w!=="object") w=wineById(w);
    if(!w || Number(w.id)<100) return 0;
    if(Number(w.stockOf)>0 && Number(w.stockOf)<100) return Number(w.stockOf);
    var k=key(w.name); if(SHARED.indexOf(k)<0) return 0;
    var p=beers().filter(function(x){ return key(x.name)===k; })[0];
    return p ? Number(p.id) : 0;
  };
  window._isVipSub=function(s){ return !!s && (s.kind==="vip" || s.sheet==="vip"); };
  /* products for the VIP combined form: beer, then wine (shared items only once, as beer) */
  window._vipProducts=function(){
    var w=[]; try{ w=(typeof getWines==="function"?getWines():[]).filter(function(x){ return x && x.id && x.name && !x.hidden && !window._stockLinkOf(x); }); }catch(e){}
    return beers().concat(w);
  };
})();
