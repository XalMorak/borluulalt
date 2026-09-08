/* Employee wine form: busad=prev/next, red/white=sold only. Fix price lookup. */
(function(){
  if(window._wineForm) return; window._wineForm=true;
  var SNACK=["ундаа","pringless","pringles","schoco","rosinen","max fun","toffifee","kowar","самар","alpen gold","айраг лааз","ерөө говь","ooze","vibez"];
  function nrm(s){ return String(s||"").toLowerCase(); }
  function isSnack(name){
    name=nrm(name);
    for(var i=0;i<SNACK.length;i++) if(name.indexOf(SNACK[i])>=0) return true;
    return false;
  }
  function wineById(id){
    id=Number(id);
    var list=[];
    try{ if(typeof getWines==="function") list=getWines()||[]; }catch(e){}
    for(var i=0;i<list.length;i++) if(Number(list[i].id)===id) return list[i];
    return null;
  }
  function priceOf(id){
    var w=wineById(id);
    if(w) return Number(w.price)||0;
    if(typeof getProduct==="function"){
      var p=window.getProduct._raw ? window.getProduct._raw(id) : null;
      if(p) return Number(p.price)||0;
    }
    var el=document.getElementById("sold_"+id);
    var row=el && el.closest("tr");
    if(row && row.cells && row.cells[2]){
      var n=String(row.cells[2].textContent||"").replace(/[^0-9]/g,"");
      if(n) return Number(n)||0;
    }
    return 0;
  }
  function catRow(tr){
    var name=(tr.cells[1]&&tr.cells[1].textContent)||"";
    var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_']");
    var id=0; if(inp){ var m=String(inp.id).match(/_(\d+)$/); if(m) id=Number(m[1]); }
    var w=wineById(id);
    var c=nrm(w&&w.cat);
    if(isSnack(name) || c.indexOf("busad")>=0 || c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0) return "busad";
    return "wine";
  }
  if(typeof window.getProduct==="function" && !window.getProduct._wine){
    var raw=window.getProduct;
    window.getProduct=function(id){
      var w=wineById(id);
      if(w) return w;
      return raw.apply(this,arguments);
    };
    window.getProduct._wine=true;
    window.getProduct._raw=raw;
  }
  function applyIncome(id){
    var soldEl=document.getElementById("sold_"+id);
    var inc=document.getElementById("income_"+id);
    if(!soldEl||!inc) return 0;
    var sold=Number(soldEl.value)||0;
    var income=sold*priceOf(id);
    inc.value=income;
    inc.readOnly=true;
    inc.style.background="#eef2f7";
    inc.style.pointerEvents="none";
    return income;
  }
  if(typeof window.calcIncome==="function" && !window.calcIncome._wine){
    var _ci=window.calcIncome;
    window.calcIncome=function(id){
      if(window._wineMode){
        applyIncome(id);
        if(typeof updateRecon==="function") updateRecon();
        return;
      }
      return _ci.apply(this,arguments);
    };
    window.calcIncome._wine=true;
  }
  if(typeof window.calcRow==="function" && !window.calcRow._wine){
    var _cr=window.calcRow;
    window.calcRow=function(id){
      if(window._wineMode){
        var tr=document.getElementById("prev_"+id);
        tr=tr && tr.closest("tr");
        if(tr && catRow(tr)==="wine"){ applyIncome(id); if(typeof updateRecon==="function") updateRecon(); return; }
      }
      return _cr.apply(this,arguments);
    };
    window.calcRow._wine=true;
  }
  if(typeof window.getCalcTotal==="function" && !window.getCalcTotal._wine){
    var _gt=window.getCalcTotal;
    window.getCalcTotal=function(){
      if(!window._wineMode) return _gt.apply(this,arguments);
      var sum=0;
      document.querySelectorAll("#salesBody input[id^='sold_']").forEach(function(el){
        var m=String(el.id).match(/_(\d+)$/); if(!m) return;
        sum += (Number(el.value)||0)*priceOf(m[1]);
      });
      return sum;
    };
    window.getCalcTotal._wine=true;
  }
  function lockWinePrevNext(){
    if(!window._wineMode) return;
    var tb=document.getElementById("salesBody"); if(!tb) return;
    tb.querySelectorAll("tr").forEach(function(tr){
      if(tr.classList.contains("wine-sec")) return;
      if(catRow(tr)!=="wine") return;
      ["prev","next"].forEach(function(k){
        var inp=tr.querySelector("input[id^='"+k+"_']");
        if(!inp) return;
        inp.value="0";
        inp.readOnly=true;
        inp.tabIndex=-1;
        inp.style.background="#eef2f7";
        inp.style.pointerEvents="none";
        inp.setAttribute("placeholder","—");
      });
      var sold=tr.querySelector("input[id^='sold_']");
      if(sold){
        sold.readOnly=false;
        sold.style.pointerEvents="";
        sold.style.background="#fff";
        if(!sold._wineBound){
          sold._wineBound=true;
          sold.addEventListener("input",function(){
            var m=String(sold.id).match(/_(\d+)$/);
            if(m){ applyIncome(m[1]); if(typeof updateRecon==="function") updateRecon(); }
          });
        }
      }
    });
  }
  function styleNames(){
    if(document.getElementById("wine_form_css")) return;
    var s=document.createElement("style");
    s.id="wine_form_css";
    s.textContent="#employeeView td.product-name,#employeeView td:nth-child(2){max-width:42vw;white-space:normal;word-break:break-word;font-size:12px}#employeeView .wine-sec td{font-size:13px}";
    document.head.appendChild(s);
  }
  styleNames();
  lockWinePrevNext();
  setInterval(function(){ lockWinePrevNext(); },800);
})();
