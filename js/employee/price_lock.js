/* price_lock: all phones use server prices. Does not wipe submissions. */
(function(){
  if(window._priceLock) return; window._priceLock=true;

  var FALLBACK=[
    {id:1,name:"Боргио",price:3500,stock:0},
    {id:2,name:"Нийлэл",price:3500,stock:0},
    {id:3,name:"Cass",price:4000,stock:0},
    {id:4,name:"Asahi",price:5000,stock:0},
    {id:5,name:"Калтенберг",price:4000,stock:0},
    {id:6,name:"Алтангөвь",price:3500,stock:0},
    {id:7,name:"Gem",price:6500,stock:0},
    {id:8,name:"ЕРӨӨ говь Задгай",price:3500,stock:0},
    {id:10,name:"Tsingtao",price:5000,stock:0},
    {id:11,name:"Heineken",price:5000,stock:0},
    {id:12,name:"terra",price:4000,stock:0},
    {id:14,name:"Сэнгур (лааз)",price:4000,stock:0}
  ];

  function db(){
    try{
      if(typeof initFirebase==="function") initFirebase();
      if(typeof firebase!=="undefined" && firebase.database){
        if((!firebase.apps||!firebase.apps.length) && typeof firebaseConfig!=="undefined") firebase.initializeApp(firebaseConfig);
        var d=firebase.database();
        if(d&&d.ref){ window._fbDb=d; return d; }
      }
    }catch(e){}
    return window._fbDb||null;
  }
  function listOf(x){
    if(Array.isArray(x)) return x.filter(Boolean);
    if(x&&typeof x==="object") return Object.keys(x).map(function(k){ return x[k]; }).filter(Boolean);
    return [];
  }
  function applyPrices(cloudP, cloudW){
    var local=(typeof getProducts==="function")?getProducts():[];
    var cmap={};
    listOf(cloudP).forEach(function(p){ if(p&&p.id!=null) cmap[String(p.id)]=p; });
    if(!Object.keys(cmap).length){
      FALLBACK.forEach(function(p){ cmap[String(p.id)]=p; });
    }
    var out=[];
    var seen={};
    local.forEach(function(p){
      if(!p||p.id==null) return;
      var c=cmap[String(p.id)];
      if(c){
        out.push(Object.assign({}, p, {name:c.name||p.name, price:Number(c.price)||Number(p.price)||0}));
      } else {
        out.push(p);
      }
      seen[String(p.id)]=1;
    });
    Object.keys(cmap).forEach(function(id){
      if(seen[id]) return;
      var c=cmap[id];
      out.push({id:c.id, name:c.name, price:Number(c.price)||0, stock:Number(c.stock)||0});
    });
    out.sort(function(a,b){ return (a.id||0)-(b.id||0); });
    if(typeof setProducts==="function") setProducts(out);

    var wines=listOf(cloudW);
    if(wines.length && typeof setWines==="function"){
      var cur=(typeof getWines==="function")?getWines():[];
      var wmap={};
      cur.forEach(function(w){ if(w&&w.id!=null) wmap[String(w.id)]=w; });
      var wout=wines.map(function(w){
        var old=wmap[String(w.id)]||{};
        return Object.assign({}, old, w, {price:Number(w.price)||Number(old.price)||0});
      });
      setWines(wout);
    }
    if(typeof buildSalesTable==="function") buildSalesTable();
    if(typeof buildStockTable==="function" && document.getElementById("tabStock") && !document.getElementById("tabStock").classList.contains("hidden")) buildStockTable();
  }

  window.syncPricesFromCloud=async function(){
    var base=db();
    var cloudP=null, cloudW=null;
    if(base){
      try{ cloudP=(await base.ref("borluulalt/products").once("value")).val(); }catch(e){}
      try{ cloudW=(await base.ref("borluulalt/wines").once("value")).val(); }catch(e){}
    }
    applyPrices(cloudP, cloudW);
  };

  if(typeof window.showApp==="function" && !window.showApp._price){
    var _sa=window.showApp;
    window.showApp=function(){
      var r=_sa.apply(this, arguments);
      setTimeout(function(){ window.syncPricesFromCloud(); }, 200);
      return r;
    };
    window.showApp._price=true;
  }
  if(typeof window.cloudPull==="function" && !window.cloudPull._price){
    var _pl=window.cloudPull;
    window.cloudPull=async function(){
      var r=await _pl.apply(this, arguments);
      try{ await window.syncPricesFromCloud(); }catch(e){}
      return r;
    };
    window.cloudPull._price=true;
  }

  setTimeout(function(){ window.syncPricesFromCloud(); }, 800);
})();
