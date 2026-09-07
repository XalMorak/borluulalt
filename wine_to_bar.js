/* wine_to_bar: copy wine-tab items into bar product list */
(function(){
  if(window._wineToBarLoaded)return;
  window._wineToBarLoaded=true;
  var FLAG="borluulalt_wine_to_bar_v1";

  function norm(s){
    return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
  }

  function run(){
    if(typeof getProducts!=="function"||typeof setProducts!=="function")return;
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var wines=getWines()||[];
    if(!wines.length)return;
    var products=(getProducts()||[]).filter(function(p){return p && (p.id||0)<100;});
    var names={};
    products.forEach(function(p){names[norm(p.name)]=1;});
    var maxId=0;
    products.forEach(function(p){if((p.id||0)>maxId)maxId=p.id;});
    if(maxId<13)maxId=13;
    var added=0;
    wines.forEach(function(w){
      var n=norm(w.name);
      if(!n || names[n])return;
      maxId+=1;
      products.push({
        id:maxId,
        name:w.name,
        price:Number(w.price)||0,
        stock:Number(w.stock)||0,
        stockByLoc:w.stockByLoc||undefined
      });
      names[n]=1;
      added+=1;
    });
    if(!added && localStorage.getItem(FLAG)==="1")return;
    setProducts(products);
    setWines([]);
    try{localStorage.setItem(FLAG,"1");}catch(e){}
    if(typeof cloudPush==="function")cloudPush();
    if(typeof renderPrices==="function")renderPrices();
    if(typeof renderStock==="function")renderStock();
    if(typeof renderWineSup==="function")renderWineSup();
    if(typeof loadSupervisorData==="function")loadSupervisorData();
  }

  function tick(){
    try{run();}catch(e){}
  }
  setTimeout(tick,600);
  setTimeout(tick,2000);
})();
