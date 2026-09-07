/* mobile_ux: clear zero on focus, fit income column on phone */
(function(){
  var STYLE_ID="mobile_ux_css";
  function injectCSS(){
    if(document.getElementById(STYLE_ID))return;
    var css=
      "#employeeView .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 -4px;padding-bottom:8px}"+ 
      "#employeeView table{min-width:560px;width:100%}"+ 
      "#employeeView th,#employeeView td{padding:4px 3px;font-size:.78rem;white-space:nowrap}"+ 
      "#employeeView td.product-name{max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.72rem}"+ 
      "#employeeView input[type=number]{width:58px;min-width:52px;max-width:70px;padding:6px 2px;font-size:16px;"+ 
      "-moz-appearance:textfield;box-sizing:border-box}"+ 
      "#employeeView input[type=number]::-webkit-outer-spin-button,"+ 
      "#employeeView input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}"+ 
      "#employeeView td:last-child input,#employeeView th:last-child{min-width:70px}"+ 
      "#employeeView .price-col{font-size:.7rem;padding:2px}"+ 
      "@media(max-width:420px){"+ 
      "#employeeView table{min-width:520px}"+ 
      "#employeeView input[type=number]{width:52px;min-width:48px}"+ 
      "#employeeView td.product-name{max-width:56px}"+ 
      "}"+ 
      ".footer-fields input[type=number]{font-size:16px;min-height:42px}";
    var s=document.createElement("style");
    s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s);
  }

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
    injectCSS();
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
