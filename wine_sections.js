/* wine_sections: group wines into Улаан / Цагаан */
(function(){
  if(window._wineSecLoaded)return;
  window._wineSecLoaded=true;

  var RED="ulaan";
  var WHITE="tsagaan";
  var LABELS={};
  LABELS[RED]="\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e";
  LABELS[WHITE]="\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e";

  function normCat(c){
    c=String(c||"").toLowerCase();
    if(c.indexOf("tsagaan")>=0 || c.indexOf("cagaan")>=0 || c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0) return WHITE;
    return RED;
  }

  function ensureCats(){
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var arr=getWines(), ch=false;
    arr.forEach(function(w){
      var n=normCat(w.cat);
      if(w.cat!==n){w.cat=n;ch=true;}
    });
    if(ch)setWines(arr);
  }

  function headerRow(label, cols){
    var tr=document.createElement("tr");
    tr.className="wine-sec";
    var td=document.createElement("td");
    td.colSpan=cols||7;
    td.style.cssText="background:#1e3a5f;color:#fff;font-weight:700;padding:8px 12px";
    td.textContent=label;
    tr.appendChild(td);
    return tr;
  }

  function groupEmpTable(){
    if(!window._wineMode)return;
    var tbody=document.getElementById("salesBody");
    if(!tbody)return;
    if(tbody.querySelector(".wine-sec"))return;
    var wines=typeof getWines==="function"?getWines():[];
    var byId={};
    wines.forEach(function(w){byId[w.id]=normCat(w.cat);});
    var rows=[].slice.call(tbody.querySelectorAll("tr"));
    if(!rows.length)return;
    function idOf(tr){
      var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_']");
      if(!inp)return 0;
      var m=String(inp.id).match(/_(\d+)$/);
      return m?Number(m[1]):0;
    }
    var red=[], white=[], other=[];
    rows.forEach(function(tr){
      var id=idOf(tr);
      var c=byId[id]||RED;
      if(c===WHITE)white.push(tr); else red.push(tr);
    });
    tbody.innerHTML="";
    tbody.appendChild(headerRow(LABELS[RED],7));
    red.forEach(function(tr){tbody.appendChild(tr);});
    tbody.appendChild(headerRow(LABELS[WHITE],7));
    white.forEach(function(tr){tbody.appendChild(tr);});
  }

  function wrapBuild(){
    if(typeof window.buildSalesTable!=="function"||window.buildSalesTable._sec)return;
    var b=window.buildSalesTable;
    window.buildSalesTable=function(){
      var r=b.apply(this,arguments);
      setTimeout(groupEmpTable,0);
      return r;
    };
    window.buildSalesTable._sec=true;
  }

  function addCatField(){
    var pane=document.getElementById("tabWine");
    if(!pane||document.getElementById("wineNewCat"))return;
    var box=pane.querySelector(".header-info");
    if(!box)return;
    var div=document.createElement("div");
    div.innerHTML='<label>\u0410\u043d\u0433\u0438\u043b\u0430\u043b</label><select id="wineNewCat"><option value="ulaan">\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option><option value="tsagaan">\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option></select>';
    box.insertBefore(div, box.lastElementChild);
  }

  function wrapAdd(){
    if(typeof window.addWineProduct!=="function"||window.addWineProduct._sec)return;
    var a=window.addWineProduct;
    window.addWineProduct=function(){
      var r=a.apply(this,arguments);
      var sel=document.getElementById("wineNewCat");
      var cat=sel?normCat(sel.value):RED;
      if(typeof getWines==="function"&&typeof setWines==="function"){
        var arr=getWines();
        if(arr.length){
          arr[arr.length-1].cat=cat;
          setWines(arr);
        }
      }
      setTimeout(groupSupTable,0);
      return r;
    };
    window.addWineProduct._sec=true;
  }

  function groupSupTable(){
    var tbody=document.getElementById("wineBody");
    if(!tbody)return;
    if(tbody.querySelector(".wine-sec"))return;
    var wines=typeof getWines==="function"?getWines():[];
    var byId={};
    wines.forEach(function(w){byId[String(w.id)]=normCat(w.cat);});
    var rows=[].slice.call(tbody.querySelectorAll("tr"));
    if(!rows.length)return;
    function idOf(tr){
      var el=tr.querySelector("[data-id],[data-del]");
      if(el) return String(el.getAttribute("data-id")||el.getAttribute("data-del")||"");
      return "";
    }
    var red=[], white=[];
    rows.forEach(function(tr){
      var id=idOf(tr);
      if(byId[id]===WHITE)white.push(tr); else red.push(tr);
    });
    tbody.innerHTML="";
    tbody.appendChild(headerRow(LABELS[RED],7));
    red.forEach(function(tr){tbody.appendChild(tr);});
    tbody.appendChild(headerRow(LABELS[WHITE],7));
    white.forEach(function(tr){tbody.appendChild(tr);});
    rows.forEach(function(tr){
      if(tr.querySelector(".wine-cat-sel"))return;
      var id=idOf(tr);
      if(!id)return;
      var td=tr.insertCell(-1);
      var sel=document.createElement("select");
      sel.className="wine-cat-sel";
      sel.innerHTML='<option value="ulaan">\u0423\u043b\u0430\u0430\u043d</option><option value="tsagaan">\u0426\u0430\u0433\u0430\u0430\u043d</option>';
      sel.value=byId[id]||RED;
      sel.onchange=function(){
        if(typeof getWines!=="function"||typeof setWines!=="function")return;
        var arr=getWines();
        arr.forEach(function(w){if(String(w.id)===id)w.cat=normCat(sel.value);});
        setWines(arr);
        if(typeof cloudPush==="function")cloudPush();
        var tb=document.getElementById("wineBody");
        if(tb){
          var secs=tb.querySelectorAll(".wine-sec");
          secs.forEach(function(s){s.remove();});
        }
        groupSupTable();
      };
      td.appendChild(sel);
    });
  }

  function wrapRender(){
    if(typeof window.renderWineSup!=="function"||window.renderWineSup._sec)return;
    var r=window.renderWineSup;
    window.renderWineSup=function(){
      var x=r.apply(this,arguments);
      setTimeout(groupSupTable,0);
      return x;
    };
    window.renderWineSup._sec=true;
  }

  function tick(){
    ensureCats();
    addCatField();
    wrapBuild();
    wrapAdd();
    wrapRender();
    if(window._wineMode) groupEmpTable();
    var pane=document.getElementById("tabWine");
    if(pane && !pane.classList.contains("hidden")) groupSupTable();
  }
  tick();
  setInterval(tick,800);
})();
