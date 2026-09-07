/* wine_red_seed: replace ulaan wines with official red list */
(function(){
  if(window._wineRedSeed)return;
  window._wineRedSeed=true;
  var RED="ulaan";
  var LIST=[
    ["Sangria",5000],
    ["Australian Passion Merlot New",5500],
    ["Australian Passion Shiraz Cabernet New",5500],
    ["Australian Passion Shiraz",5500],
    ["Montmeyrac Moelleux Red",5500],
    ["Tini Vino Rosso Semi Sweet",5500],
    ["Tini Vino Rosso",5500],
    ["Tini Sangiovese",5500],
    ["Tini Sangiovese Cabernet",5500],
    ["Luigi Leonardo Red",6000],
    ["Campo de Chile Cabernet Sauvignon",7000],
    ["Vina Maipo Cabernet Sauvignon",7000],
    ["Vina Maipo Merlot",7000],
    ["Vina Maipo Carmenere",7000],
    ["Vina Maipo Sweet Red",7000],
    ["Cuvee Kiwi Pinot Noir 2019 Vin de France",7700],
    ["Cuvee Kiwi Shiraz 2015 Vin de France",7700],
    ["Badgers Creek Cabernet-Shiraz",8000],
    ["Louis Eschenauer Merlot",8000],
    ["Calvet Varietals Cabernet Sauvignon Vin de Pays",8300],
    ["Castel Merlot",8500],
    ["Castel Cabernet Sauvignon",8500],
    ["Castel Grenache",8500],
    ["Hans Baer Pinot Noir Red",8900],
    ["Piccini Pinocchio Rosso",9500],
    ["Louis Eschenauer Bordeaux Red",9500],
    ["Calvet Cahors Red",10000],
    ["Azahara Shiraz",11500],
    ["Porto Valdouro Red",11500],
    ["Robert Mondavi Pinot Noir",18400],
    ["Chateau Ferrande Red",33000]
  ];
  var OLD=[
    "ulaan","улаан","pengbess","scholo rossien","mer lin (moscow)","trollfee",
    "recover mix","camp","albert gold","aiquet","epee roux zagvai",
    "epee roux \u0437\u0430\u0433\u0432\u0430\u0439","gose"
  ];
  function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  var oldSet={}; OLD.forEach(function(n){oldSet[norm(n)]=1;});
  var keepSet={}; LIST.forEach(function(r){keepSet[norm(r[0])]=1;});
  function run(){
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var arr=getWines()||[];
    arr=arr.filter(function(w){
      var n=norm(w.name);
      if(oldSet[n] && !keepSet[n])return false;
      return true;
    });
    var have={};
    arr.forEach(function(w){have[norm(w.name)]=1;});
    var maxId=100;
    arr.forEach(function(w){if((w.id||0)>maxId)maxId=w.id;});
    var ch=true;
    LIST.forEach(function(row){
      var name=row[0], price=row[1];
      if(have[norm(name)]){
        arr.forEach(function(w){
          if(norm(w.name)===norm(name)){
            w.cat=RED;
            if(!w.price)w.price=price;
          }
        });
        return;
      }
      maxId+=1;
      arr.push({id:maxId,name:name,price:price,stock:0,cat:RED});
      have[norm(name)]=1;
    });
    setWines(arr);
    if(typeof cloudPush==="function")cloudPush();
    if(typeof renderWineSup==="function")renderWineSup();
  }
  setTimeout(run,800);
  setTimeout(run,2400);
})();
