/* beer_prices: Үнэ/Нөөц/Тойм always use beer products */
(function(){
  if(window._beerPricesLoaded)return;
  window._beerPricesLoaded=true;

  function isEmpWine(){
    if(!window._wineMode)return false;
    var emp=document.getElementById("employeeView");
    return !!(emp && !emp.classList.contains("hidden"));
  }

  function beersOf(list){
    return (list||[]).filter(function(p){return p && (p.id||0)<100 && !p.deleted;});
  }

  function restoreBeerProducts(){
    if(typeof getProducts!=="function"||typeof setProducts!=="function")return;
    var arr=getProducts()||[];
    var beers=arr.filter(function(p){return p && (p.id||0)<100;});
    var wines=arr.filter(function(p){return p && (p.id||0)>=100;});
    if(wines.length){
      try{
        if(typeof getWines==="function"&&typeof setWines==="function"){
          var w=getWines();
          var ids={};
          w.forEach(function(x){ids[x.id]=1;});
          wines.forEach(function(x){if(!ids[x.id])w.push(x);});
          setWines(w);
        }
      }catch(e){}
    }
    if(!beers.length && typeof DEFAULT_PRODUCTS!=="undefined"){
      setProducts(JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)));
      if(typeof cloudPush==="function")cloudPush();
      return;
    }
    if(wines.length && beers.length){
      setProducts(beers);
      if(typeof cloudPush==="function")cloudPush();
    }
  }

  function wrapActive(){
    if(typeof window.getActiveProducts!=="function")return;
    var cur=window.getActiveProducts;
    if(cur._beerSep)return;
    window.getActiveProducts=function(){
      if(isEmpWine() && typeof getWines==="function"){
        return getWines().filter(function(w){return w&&!w.hidden;});
      }
      var list=[];
      try{list=cur._orig?cur._orig():cur();}catch(e){list=[];}
      return beersOf(list);
    };
    window.getActiveProducts._beerSep=true;
    window.getActiveProducts._orig=cur._orig||cur;
  }

  function wrapLogin(){
    if(typeof window.doLogin!=="function"||window.doLogin._beerSep)return;
    var d=window.doLogin;
    window.doLogin=function(){
      var r=d.apply(this,arguments);
      window._wineMode=false;
      restoreBeerProducts();
      return r;
    };
    window.doLogin._beerSep=true;
  }

  function tick(){
    restoreBeerProducts();
    wrapActive();
    wrapLogin();
    window._wineMode=!!(window._wineMode && isEmpWine());
  }
  tick();
  setInterval(tick,1000);
})();
