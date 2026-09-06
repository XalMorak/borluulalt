/* stock by location + single save + stronger sync */
var STOCK_LOCS=["Оюут бар","Манлай бар","POWER"];

function ensureStockByLoc(p){
  if(!p.stockByLoc||typeof p.stockByLoc!=="object")p.stockByLoc={};
  STOCK_LOCS.forEach(function(l){
    if(p.stockByLoc[l]==null)p.stockByLoc[l]=0;
  });
  return p;
}
function migrateAllProducts(){
  if(typeof getProducts!=="function")return;
  var products=getProducts();
  var changed=false;
  products.forEach(function(p){
    if(!p.stockByLoc){
      ensureStockByLoc(p);
      if((p.stock||0)>0 && STOCK_LOCS.every(function(l){return !p.stockByLoc[l];})){
        p.stockByLoc["Оюут бар"]=p.stock||0;
      }
      changed=true;
    } else ensureStockByLoc(p);
    p.stock=STOCK_LOCS.reduce(function(s,l){return s+(Number(p.stockByLoc[l])||0);},0);
  });
  if(changed&&typeof setProducts==="function")setProducts(products);
}

function currentStockLoc(){
  var el=document.getElementById("stockLocSelect");
  return (el&&el.value)||"Оюут бар";
}

function buildStockTableLoc(){
  migrateAllProducts();
  var tbody=document.getElementById("stockBody");
  if(!tbody)return;
  var loc=currentStockLoc();
  tbody.innerHTML="";
  getProducts().filter(function(p){return !p.deleted;}).forEach(function(p){
    ensureStockByLoc(p);
    var st=Number(p.stockByLoc[loc])||0;
    var sc=st<=(window.LOW_STOCK||10)?"stock-low":"stock-ok";
    tbody.innerHTML+='<tr>'+
      '<td>'+p.id+'</td>'+
      '<td><input id="st_name_'+p.id+'" value="'+String(p.name||"").replace(/"/g,"&quot;")+'" style="width:120px"></td>'+
      '<td><input type="number" id="st_price_'+p.id+'" value="'+(p.price||0)+'" style="width:80px"></td>'+
      '<td class="'+sc+'"><input type="number" id="st_stock_'+p.id+'" value="'+st+'" style="width:70px"></td>'+
      '<td><button class="btn btn-sm btn-danger" onclick="deleteProduct('+p.id+')">Устгах</button></td>'+
      '</tr>';
  });
}

function saveAllStock(){
  migrateAllProducts();
  var loc=currentStockLoc();
  var products=getProducts();
  products.forEach(function(p){
    if(p.deleted)return;
    ensureStockByLoc(p);
    var nameEl=document.getElementById("st_name_"+p.id);
    var priceEl=document.getElementById("st_price_"+p.id);
    var stockEl=document.getElementById("st_stock_"+p.id);
    if(nameEl)p.name=nameEl.value.trim()||p.name;
    if(priceEl)p.price=Number(priceEl.value)||0;
    if(stockEl)p.stockByLoc[loc]=Number(stockEl.value)||0;
    p.stock=STOCK_LOCS.reduce(function(s,l){return s+(Number(p.stockByLoc[l])||0);},0);
  });
  setProducts(products);
  if(typeof cloudPush==="function")cloudPush().then(function(){
    if(typeof showAlert==="function")showAlert("stockAlert","Бүх нөөц хадгалагдлаа ✓ ("+loc+")","success");
    buildStockTableLoc();
  });
  else{
    if(typeof showAlert==="function")showAlert("stockAlert","Хадгаллаа","success");
    buildStockTableLoc();
  }
}

function onStockLocChange(){buildStockTableLoc();}

(function(){
  function wrap(){
    if(window._stockLocWrapped)return;
    if(typeof window.buildStockTable!=="function")return;
    window._stockLocWrapped=true;
    window.buildStockTable=function(){buildStockTableLoc();};
    window.saveProductRow=function(id){saveAllStock();};
  }
  wrap();setInterval(wrap,400);
})();

(function(){
  function wrapSave(){
    if(window._stockDeductWrapped||typeof window.saveSubmission!=="function")return;
    window._stockDeductWrapped=true;
    var _s=window.saveSubmission;
    window.saveSubmission=async function(){
      var _gfd=window.getFormData;
      var captured=null;
      if(typeof _gfd==="function"){
        window.getFormData=function(){
          captured=_gfd.apply(this,arguments);
          return captured;
        };
      }
      var result=await _s.apply(this,arguments);
      window.getFormData=_gfd;
      if(captured&&captured.items){
        var loc=captured.location||"Оюут бар";
        if(STOCK_LOCS.indexOf(loc)<0)loc="Оюут бар";
        var products=getProducts();
        captured.items.forEach(function(it){
          if(!it.sold)return;
          var idx=products.findIndex(function(p){return p.id===it.id;});
          if(idx<0)return;
          ensureStockByLoc(products[idx]);
          var sold=it.sold||0;
          products[idx].stockByLoc[loc]=Math.max(0,(Number(products[idx].stockByLoc[loc])||0)-sold);
          products[idx].stock=STOCK_LOCS.reduce(function(s,l){return s+(Number(products[idx].stockByLoc[l])||0);},0);
        });
        setProducts(products);
        if(typeof cloudPush==="function")await cloudPush();
      }
      return result;
    };
  }
  wrapSave();setInterval(wrapSave,500);
})();

(function(){
  function wrapPull(){
    if(window._strongPull||typeof window.cloudPull!=="function")return;
    window._strongPull=true;
    var _p=window.cloudPull;
    window.cloudPull=async function(){
      var ok=await _p.apply(this,arguments);
      try{migrateAllProducts();}catch(e){}
      return ok;
    };
  }
  wrapPull();setInterval(wrapPull,500);
})();
