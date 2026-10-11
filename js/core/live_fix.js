/* live_fix: beer/wine income from DOM price; supervisor wine list */
(function(){
  if(window._liveFix) return; window._liveFix=true;
  function num(v){
    if(v==null||v==="") return 0;
    if(typeof v==="number") return isFinite(v)?v:0;
    var s=String(v).replace(/[^0-9.\-]/g,"");
    var n=parseFloat(s);
    return isFinite(n)?n:0;
  }
  function findById(id){
    id=Number(id);
    var lists=[], i, p;
    try{ if(typeof getProducts==="function") lists=lists.concat(getProducts()||[]); }catch(e){}
    try{ if(typeof getWines==="function") lists=lists.concat((getWines()||[]).filter(Boolean)); }catch(e){}
    for(i=0;i<lists.length;i++){
      p=lists[i];
      if(p && Number(p.id)===id) return p;
    }
    return null;
  }
  function rowPrice(id){
    var el=document.getElementById("sold_"+id) || document.getElementById("prev_"+id);
    var tr=el && el.closest("tr");
    if(tr){
      var cell=tr.querySelector(".price-col") || (tr.cells && tr.cells[2]);
      if(cell){
        var n=num(cell.textContent);
        if(n>0) return n;
      }
    }
    var p=findById(id);
    return p?num(p.price):0;
  }
  function applyIncome(id){
    var soldEl=document.getElementById("sold_"+id);
    var inc=document.getElementById("income_"+id);
    if(!soldEl||!inc) return 0;
    var income=Math.round(num(soldEl.value)*rowPrice(id));
    inc.value=income;
    inc.readOnly=true;
    return income;
  }
  function recalcAll(){
    document.querySelectorAll("#salesBody input[id^='sold_']").forEach(function(el){
      var m=String(el.id).match(/_(\d+)$/);
      if(m) applyIncome(m[1]);
    });
    if(typeof updateRecon==="function") updateRecon();
  }
  window.getProduct=function(id){ return findById(id); };
  window.calcIncome=function(id){
    applyIncome(id);
    if(typeof updateRecon==="function") updateRecon();
  };
  var _cr=window.calcRow;
  window.calcRow=function(id){
    var prev=document.getElementById("prev_"+id);
    var next=document.getElementById("next_"+id);
    var sold=document.getElementById("sold_"+id);
    var tr=prev && prev.closest("tr");
    var lock=window._wineMode && tr && prev && prev.readOnly;
    if(!lock && prev && next && sold && document.activeElement && document.activeElement.id!=="sold_"+id){
      var a=num(prev.value), b=num(next.value);
      if(a>0||b>0) sold.value=Math.max(0,a-b);
    }
    applyIncome(id);
    if(typeof updateRecon==="function") updateRecon();
  };
  window.getCalcTotal=function(){
    var sum=0;
    document.querySelectorAll("#salesBody input[id^='sold_']").forEach(function(el){
      var m=String(el.id).match(/_(\d+)$/); if(!m) return;
      sum += num(el.value)*rowPrice(m[1]);
    });
    return sum;
  };
  document.addEventListener("input",function(ev){
    var t=ev.target; if(!t||!t.id) return;
    var m=String(t.id).match(/^(prev|next|sold)_(\d+)$/); if(!m) return;
    if(m[1]!=="sold") window.calcRow(m[2]); else window.calcIncome(m[2]);
  },true);
  setInterval(function(){
    var emp=document.getElementById("employeeView");
    if(emp && !emp.classList.contains("hidden")) recalcAll();
  },1500);

  function cleanWines(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return [];
    var a=(getWines()||[]).filter(function(w){ return w && w.id && w.name; });
    setWines(a);
    return a;
  }
  function pullWines(){
    var local=cleanWines();
    if(local.length) {
      if(typeof drawWineStock==="function") drawWineStock();
      return;
    }
    try{
      if(!window._fbDb) return;
      _fbDb.ref("borluulalt/wines").once("value").then(function(s){
        var v=s.val();
        var list=[];
        if(Array.isArray(v)) list=v.filter(function(w){ return w && w.id && w.name; });
        else if(v && typeof v==="object") Object.keys(v).forEach(function(k){ if(v[k]&&v[k].name) list.push(v[k]); });
        if(list.length && typeof setWines==="function") setWines(list);
        if(typeof drawWineStock==="function") drawWineStock();
      });
    }catch(e){}
  }
  if(typeof window.drawWineStock==="function" && !window.drawWineStock._safe){
    var _dw=window.drawWineStock;
    window.drawWineStock=function(){
      try{
        if(typeof getWines==="function"&&typeof setWines==="function"){
          setWines((getWines()||[]).filter(function(w){ return w && w.id && w.name; }));
        }
        return _dw.apply(this,arguments);
      }catch(e){ console.warn("drawWineStock",e); }
    };
    window.drawWineStock._safe=true;
  }
  pullWines();
  setTimeout(pullWines,1200);
  setInterval(function(){
    var pane=document.getElementById("tabWine");
    if(pane && !pane.classList.contains("hidden") && typeof drawWineStock==="function"){
      var tb=document.getElementById("wineBody");
      if(tb && !tb.querySelector("tr")) drawWineStock();
    }
  },1000);
})();
