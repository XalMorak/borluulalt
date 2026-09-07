/* wine_white_seed: add white wine list */
(function(){
  if(window._wineWhiteSeed)return;
  window._wineWhiteSeed=true;
  var WHITE="tsagaan";
  var LIST=[
    ["Australian Passion Colombard Chardonnay",5500],
    ["Montmeyrac Moelleux White",5500],
    ["Tini Rose",5500],
    ["Tini Trebbiano Chardonnay",5500],
    ["Tini Bianco",5500],
    ["Tini Grecanico Pinot Grigio",5500],
    ["Luigi Leonardo White",6000],
    ["Campo de Chile Cabernet Sauvignon",7000],
    ["Vina Maipo Sauvignon Blanc",7000],
    ["Vina Maipo Sweet Moscato",7000],
    ["Cuvee Kiwi Sauvignon 2015 Vin de France",7700],
    ["Badgers Creek Semillon Chardonnay",8000],
    ["Crema Nobile al Cioccolata New",8000],
    ["Calvet Varietals Sauvignon Blanc Vin de Pays",8300],
    ["Castel Merlot Rose",8500],
    ["Castel Chardonnay",8500],
    ["Castel Sauvignon Blanc",8500],
    ["Louis Eschenauer Bordeaux Sauvignon",9500],
    ["Porto Valdouro White",11500],
    ["Robert Mondavi Chardonnay",18400],
    ["Chateau Ferrande White",33000]
  ];
  function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  function run(){
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var arr=getWines()||[];
    var have={};
    arr.forEach(function(w){have[norm(w.name)]=1;});
    var maxId=100;
    arr.forEach(function(w){if((w.id||0)>maxId)maxId=w.id;});
    var ch=false;
    LIST.forEach(function(row){
      var name=row[0], price=row[1];
      if(have[norm(name)]){
        arr.forEach(function(w){
          if(norm(w.name)===norm(name)){
            if(w.cat!==WHITE){w.cat=WHITE;ch=true;}
            if(!w.price){w.price=price;ch=true;}
          }
        });
        return;
      }
      maxId+=1;
      arr.push({id:maxId,name:name,price:price,stock:0,cat:WHITE});
      have[norm(name)]=1;
      ch=true;
    });
    if(ch){
      setWines(arr);
      if(typeof cloudPush==="function")cloudPush();
      if(typeof renderWineSup==="function")renderWineSup();
    }
  }
  setTimeout(run,700);
  setTimeout(run,2200);
})();
