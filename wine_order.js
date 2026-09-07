/* wine_order: keep sections in the lists the user provided */
(function(){
  if(window._wineOrderLoaded)return;
  window._wineOrderLoaded=true;
  function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  var BUSAD=[
    "\u0423\u043d\u0434\u0430\u0430","pringless","Schoco rosinen","Max fun (\u0448\u043e\u043a\u043e\u043b\u0430\u0434)","Toffifee","Kowar mix",
    "\u0441\u0430\u043c\u0430\u0440","Alpen gold","\u0410\u0439\u0440\u0430\u0433","\u0415\u0440\u04e9\u04e9 \u0433\u043e\u0432\u044c \u0437\u0430\u0434\u0433\u0430\u0439","Ooze","Vibez"
  ].map(norm);
  var RED=[
    "Sangria","Australian Passion Merlot New","Australian Passion Shiraz Cabernet New","Australian Passion Shiraz",
    "Montmeyrac Moelleux Red","Tini Vino Rosso Semi Sweet","Tini Vino Rosso","Tini Sangiovese","Tini Sangiovese Cabernet",
    "Luigi Leonardo Red","Campo de Chile Cabernet Sauvignon","Vina Maipo Cabernet Sauvignon","Vina Maipo Merlot",
    "Vina Maipo Carmenere","Vina Maipo Sweet Red","Cuvee Kiwi Pinot Noir 2019 Vin de France","Cuvee Kiwi Shiraz 2015 Vin de France",
    "Badgers Creek Cabernet-Shiraz","Louis Eschenauer Merlot","Calvet Varietals Cabernet Sauvignon Vin de Pays",
    "Castel Merlot","Castel Cabernet Sauvignon","Castel Grenache","Hans Baer Pinot Noir Red","Piccini Pinocchio Rosso",
    "Louis Eschenauer Bordeaux Red","Calvet Cahors Red","Azahara Shiraz","Porto Valdouro Red","Robert Mondavi Pinot Noir",
    "Chateau Ferrande Red"
  ].map(norm);
  var WHITE=[
    "Australian Passion Colombard Chardonnay","Montmeyrac Moelleux White","Tini Rose","Tini Trebbiano Chardonnay",
    "Tini Bianco","Tini Grecanico Pinot Grigio","Luigi Leonardo White","Campo de Chile Cabernet Sauvignon",
    "Vina Maipo Sauvignon Blanc","Vina Maipo Sweet Moscato","Cuvee Kiwi Sauvignon 2015 Vin de France",
    "Badgers Creek Semillon Chardonnay","Crema Nobile al Cioccolata New","Calvet Varietals Sauvignon Blanc Vin de Pays",
    "Castel Merlot Rose","Castel Chardonnay","Castel Sauvignon Blanc","Louis Eschenauer Bordeaux Sauvignon",
    "Porto Valdouro White","Robert Mondavi Chardonnay","Chateau Ferrande White"
  ].map(norm);
  function catOf(w){
    var c=String(w&&w.cat||"").toLowerCase();
    if(c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0)return "busad";
    if(c.indexOf("tsagaan")>=0||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0)return "tsagaan";
    if(c.indexOf("ulaan")>=0||c.indexOf("\u0443\u043b\u0430\u0430\u043d")>=0)return "ulaan";
    var n=norm(w&&w.name);
    if(BUSAD.indexOf(n)>=0)return "busad";
    if(WHITE.indexOf(n)>=0 && RED.indexOf(n)<0)return "tsagaan";
    if(RED.indexOf(n)>=0)return "ulaan";
    return "ulaan";
  }
  function idx(list,name){
    var i=list.indexOf(norm(name));
    return i<0?1000+String(name):i;
  }
  function sameOrder(a,b){
    if(a.length!==b.length)return false;
    for(var i=0;i<a.length;i++) if((a[i].id||0)!==(b[i].id||0)) return false;
    return true;
  }
  function run(){
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var arr=getWines()||[];
    if(!arr.length)return;
    var groups={busad:[],ulaan:[],tsagaan:[]};
    arr.forEach(function(w){
      var c=catOf(w);
      w.cat=c;
      (groups[c]||groups.ulaan).push(w);
    });
    groups.busad.sort(function(a,b){return idx(BUSAD,a.name)-idx(BUSAD,b.name);});
    groups.ulaan.sort(function(a,b){return idx(RED,a.name)-idx(RED,b.name);});
    groups.tsagaan.sort(function(a,b){return idx(WHITE,a.name)-idx(WHITE,b.name);});
    var next=groups.busad.concat(groups.ulaan,groups.tsagaan);
    if(sameOrder(arr,next))return;
    setWines(next);
    if(typeof renderWineSup==="function")renderWineSup();
  }
  setTimeout(run,1200);
  setTimeout(run,2800);
})();
