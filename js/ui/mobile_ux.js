/* mobile_ux: clear zero on focus, fit income column on phone */
(function(){

  function enhanceInput(el){
    if(!el||el._mux)return;
    el._mux=true;
    el.setAttribute("inputmode","numeric");
    el.setAttribute("pattern","[0-9]*");
    el.addEventListener("focus",function(){
      var v=el.value;
      if(v==="0"||v===""||Number(v)===0){
        el.value="";
      }else{
        try{el.select();}catch(e){}
      }
    });
    el.addEventListener("blur",function(){
      if(el.value===""||el.value==null){
        el.value="0";
        var id=el.id||"";
        var m=id.match(/^(prev|next|sold)_(\d+)$/);
        if(m&&typeof calcRow==="function")calcRow(Number(m[2]));
        if(typeof updateRecon==="function"&&/^(cashAmount|cardTotal|cashBalance)$/.test(id))updateRecon();
      }
    });
  }

  function enhanceAll(){
    var root=document.getElementById("employeeView")||document;
    root.querySelectorAll("input[type=number]").forEach(enhanceInput);
    ["cashAmount","cardTotal","cashBalance"].forEach(function(id){
      enhanceInput(document.getElementById(id));
    });
  }

  function wrapBuild(){
    if(typeof window.buildSalesTable!=="function"||window.buildSalesTable._mux)return;
    var _b=window.buildSalesTable;
    window.buildSalesTable=function(){
      var r=_b.apply(this,arguments);
      setTimeout(enhanceAll,0);
      return r;
    };
    Object.keys(_b).forEach(function(k){ if(k.charAt(0)==="_"&&!(k in window.buildSalesTable)) window.buildSalesTable[k]=_b[k]; });   /* keep others' flags */
    window.buildSalesTable._mux=true;
  }

  function tick(){
    wrapBuild();
    enhanceAll();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);
  else tick();
  setInterval(tick,500);
})();
