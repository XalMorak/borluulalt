/* beer_cleanup: drop wine-default names from bar products */
(function(){
  if(window._beerCleanupLoaded)return;
  window._beerCleanupLoaded=true;
  var FLAG="borluulalt_beer_cleanup_v2";
  var DROP=[
    "ulaan","улаан",
    "pengbess",
    "scholo rossien","scholo rossien",
    "mer lin (moscow)","mer lin moscow",
    "trollfee",
    "recover mix",
    "camp",
    "albert gold",
    "aiquet",
    "epee roux zagvai","epee roux загвай","epee roux \u0437\u0430\u0433\u0432\u0430\u0439",
    "gose"
  ];
  function norm(s){
    return String(s||"").trim().toLowerCase().replace(/\s+/g," ");
  }
  var set={};
  DROP.forEach(function(n){set[norm(n)]=1;});
  function run(){
    if(typeof getProducts!=="function"||typeof setProducts!=="function")return;
    var arr=getProducts()||[];
    var next=arr.filter(function(p){
      var n=norm(p&&p.name);
      if(set[n])return false;
      if((p.id||0)>=100)return false;
      return true;
    });
    if(next.length===arr.length)return;
    setProducts(next);
    try{localStorage.setItem(FLAG,"1");}catch(e){}
    if(typeof cloudPush==="function")cloudPush();
    if(typeof renderPrices==="function")renderPrices();
    if(typeof renderStock==="function")renderStock();
    if(typeof loadSupervisorData==="function")loadSupervisorData();
  }
  setTimeout(run,500);
  setTimeout(run,1800);
  setInterval(run,4000);
})();
