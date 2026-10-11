/* Force wine tek options into location dropdown */
(function(){
  if(window._wineTekForce) return; window._wineTekForce=true;
  function ensureMap(){
    if(typeof window.TEK_BY_LOC!=="object" || !window.TEK_BY_LOC) window.TEK_BY_LOC={};
    var add=function(loc, tek){
      var a=TEK_BY_LOC[loc];
      if(!Array.isArray(a)) a=[];
      if(a.indexOf(tek)<0) a.push(tek);
      TEK_BY_LOC[loc]=a;
    };
    add("\u041e\u044e\u0443\u0442 \u0431\u0430\u0440", "\u041e\u044e\u0443\u0442 \u0432\u0438\u043d\u043e");
    add("\u041e\u044e\u0443\u0442 \u0431\u0430\u0440", "\u0425\u0410\u0411 \u0432\u0438\u043d\u043e");
    add("\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440", "\u041c\u0430\u043d\u043b\u0430\u0439 \u0432\u0438\u043d\u043e");
  }
  function fill(){
    ensureMap();
    var loc=document.getElementById("locationName");
    var sel=document.getElementById("receiverName");
    if(!loc||!sel) return;
    var want=TEK_BY_LOC[loc.value]||[];
    var have={};
    for(var i=0;i<sel.options.length;i++) have[sel.options[i].value]=true;
    want.forEach(function(t){
      if(have[t]) return;
      var o=document.createElement("option");
      o.value=t; o.textContent=t; sel.appendChild(o);
    });
  }
  if(typeof window.onLocationChange==="function" && !window.onLocationChange._wineTek){
    var orig=window.onLocationChange;
    window.onLocationChange=function(){
      ensureMap();
      var r=orig.apply(this,arguments);
      fill();
      return r;
    };
    window.onLocationChange._wineTek=true;
  }
  ensureMap(); fill();
  setInterval(function(){ ensureMap(); fill(); },800);
})();
