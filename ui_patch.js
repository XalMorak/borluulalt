(function(){
  if(window._uiPatch) return; window._uiPatch=true;
  function addVip(sel){
    if(!sel) return;
    var has=false;
    for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value==="VIP") has=true; }
    if(has) return;
    var opt=document.createElement("option");
    opt.value="VIP"; opt.textContent="VIP";
    var power=null;
    for(var j=0;j<sel.options.length;j++){ if(sel.options[j].value==="POWER") power=sel.options[j]; }
    if(power) sel.insertBefore(opt, power); else sel.appendChild(opt);
  }
  function ensureLogTab(){
    var tabs=document.querySelector("#supervisorView .tabs");
    if(tabs && !document.getElementById("tabBtnLog")){
      var b=document.createElement("button");
      b.className="tab-btn"; b.id="tabBtnLog"; b.type="button";
      b.textContent="Түүх";
      b.onclick=function(){ if(typeof showTab==="function") showTab("log"); };
      tabs.appendChild(b);
    }
    if(!document.getElementById("tabLog")){
      var view=document.getElementById("supervisorView");
      if(!view) return;
      var pane=document.createElement("div");
      pane.id="tabLog"; pane.className="hidden";
      pane.innerHTML='<div id="logAlert"></div><table><thead><tr><th>Цаг</th><th>Хэрэглэгч</th><th>Үйлдэл</th><th>Дэлгэрэнгүй</th></tr></thead><tbody id="logBody"></tbody></table>';
      view.appendChild(pane);
    }
  }
  function hideLowStockWarn(){
    var el=document.getElementById("lowStockWarn");
    if(!el) return;
    el.innerHTML="";
    el.style.display="none";
  }
  function wrapOverview(){
    if(typeof window.renderOverview!=="function" || window.renderOverview._hideLow) return;
    var orig=window.renderOverview;
    window.renderOverview=function(){
      var r=orig.apply(this, arguments);
      hideLowStockWarn();
      return r;
    };
    window.renderOverview._hideLow=true;
  }
  function apply(){
    addVip(document.getElementById("stockLocSelect"));
    addVip(document.getElementById("wineStockLoc"));
    ensureLogTab();
    hideLowStockWarn();
    wrapOverview();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();
  setTimeout(apply, 200);
  setTimeout(apply, 800);
})();
