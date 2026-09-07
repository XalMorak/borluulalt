/* wine_page: employee/supervisor wine form + tek options */
(function(){
  if(window._winePageLoaded)return;
  window._winePageLoaded=true;

  var WINE_KEY="borluulalt_wines_v1";
  var DEFAULT_WINES=[
    {id:101,name:"Ulaan",price:4000,stock:0,cat:"ulaan"},
    {id:102,name:"Pengbess",price:8000,stock:0,cat:"ulaan"},
    {id:103,name:"Scholo Rossien",price:8000,stock:0,cat:"ulaan"},
    {id:104,name:"Mer lin (moscow)",price:9000,stock:0,cat:"ulaan"},
    {id:105,name:"Trollfee",price:10000,stock:0,cat:"ulaan"},
    {id:106,name:"Recover mix",price:7000,stock:0,cat:"ulaan"},
    {id:107,name:"Camp",price:4000,stock:0,cat:"ulaan"},
    {id:108,name:"Albert gold",price:5500,stock:0,cat:"ulaan"},
    {id:109,name:"Aiquet",price:6900,stock:0,cat:"ulaan"},
    {id:110,name:"Epee roux zagvai",price:3500,stock:0,cat:"ulaan"},
    {id:111,name:"Gose",price:0,stock:0,cat:"ulaan"}
  ];
  DEFAULT_WINES[0].name="\u0423\u043b\u0430\u0430\u043d";
  DEFAULT_WINES[9].name="Epee roux \u0437\u0430\u0433\u0432\u0430\u0439";
  DEFAULT_WINES[0].cat="ulaan";

  function extraTek(){
    if(typeof TEK_BY_LOC!=="object")window.TEK_BY_LOC={};
    var o=TEK_BY_LOC["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440"]||[];
    ["\u041e\u044e\u0443\u0442 \u0432\u0438\u043d\u043e","\u0425\u0410\u0411 \u0432\u0438\u043d\u043e"].forEach(function(t){if(o.indexOf(t)<0)o.push(t);});
    TEK_BY_LOC["\u041e\u044e\u0443\u0442 \u0431\u0430\u0440"]=o;
    var m=TEK_BY_LOC["\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440"]||[];
    if(m.indexOf("\u041c\u0430\u043d\u043b\u0430\u0439 \u0432\u0438\u043d\u043e")<0)m.push("\u041c\u0430\u043d\u043b\u0430\u0439 \u0432\u0438\u043d\u043e");
    TEK_BY_LOC["\u041c\u0430\u043d\u043b\u0430\u0439 \u0431\u0430\u0440"]=m;
    window.TEK_REPORT=TEK_BY_LOC;
  }

  function getWines(){
    try{
      var raw=localStorage.getItem(WINE_KEY);
      if(raw){
        var arr=JSON.parse(raw);
        if(Array.isArray(arr)&&arr.length)return arr;
      }
    }catch(e){}
    return DEFAULT_WINES.map(function(w){return Object.assign({},w);});
  }
  function setWines(arr){
    try{localStorage.setItem(WINE_KEY,JSON.stringify(arr));}catch(e){}
  }
  window.getWines=getWines;
  window.setWines=setWines;
  window._wineMode=false;

  function isWineTek(v){
    v=(v||"").toLowerCase();
    return v.indexOf("\u0432\u0438\u043d\u043e")>=0;
  }

  function setWineMode(on, rebuild){
    window._wineMode=!!on;
    var b1=document.getElementById("empModeBar");
    var b2=document.getElementById("empModeWine");
    if(b1)b1.className="tab-btn"+(!on?" active":"");
    if(b2)b2.className="tab-btn"+(on?" active":"");
    var title=document.getElementById("empSheetTitle");
    if(title)title.textContent=on?"\u0412\u0438\u043d\u043e\u043d\u044b \u0431\u043e\u0440\u043b\u0443\u0443\u043b\u0430\u043b\u0442":"\u0411\u0430\u0440\u0430\u0430\u043d\u044b \u0431\u043e\u0440\u043b\u0443\u0443\u043b\u0430\u043b\u0442";
    if(rebuild!==false && typeof buildSalesTable==="function")buildSalesTable();
    if(typeof updateRecon==="function")updateRecon();
  }
  window.setWineMode=setWineMode;

  function ensureEmpSwitch(){
    var view=document.getElementById("employeeView");
    if(!view||document.getElementById("empModeBar"))return;
    var bar=document.createElement("div");
    bar.className="tabs no-print";
    bar.id="empModeTabs";
    bar.style.margin="8px 0 12px";
    bar.innerHTML='<span id="empSheetTitle" style="margin-right:10px;font-weight:600">\u0411\u0430\u0440\u0430\u0430\u043d\u044b \u0431\u043e\u0440\u043b\u0443\u0443\u043b\u0430\u043b\u0442</span><button type="button" class="tab-btn active" id="empModeBar" onclick="setWineMode(false)">\u0411\u0430\u0440</button><button type="button" class="tab-btn" id="empModeWine" onclick="setWineMode(true)">\u0412\u0438\u043d\u043e</button>';
    var header=view.querySelector(".header-info");
    if(header) header.parentNode.insertBefore(bar, header.nextSibling);
    else view.insertBefore(bar, view.firstChild);
  }

  function wrapProducts(){
    if(typeof window.getActiveProducts!=="function"||window.getActiveProducts._wine)return;
    var orig=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(window._wineMode) return getWines().filter(function(w){return w&&!w.hidden;});
      return orig.apply(this,arguments);
    };
    window.getActiveProducts._wine=true;
  }

  function wrapFormData(){
    if(typeof window.getFormData!=="function"||window.getFormData._wine)return;
    var orig=window.getFormData;
    window.getFormData=function(){
      var d=orig.apply(this,arguments);
      if(d){
        d.kind=window._wineMode?"wine":"bar";
        if(window._wineMode) d.sheet="wine";
      }
      return d;
    };
    window.getFormData._wine=true;
  }

  function wrapPack(){
    if(typeof window.packAll==="function"&&!window.packAll._wine){
      var p=window.packAll;
      window.packAll=function(){
        var d=p.apply(this,arguments)||{};
        d.wines=getWines();
        return d;
      };
      window.packAll._wine=true;
    }
    if(typeof window.applyAll==="function"&&!window.applyAll._wine){
      var a=window.applyAll;
      window.applyAll=function(data){
        var r=a.apply(this,arguments);
        if(data&&Array.isArray(data.wines)&&data.wines.length)setWines(data.wines);
        return r;
      };
      window.applyAll._wine=true;
    }
  }

  function wrapTekChange(){
    var sel=document.getElementById("receiverName");
    if(sel&&!sel._wineBound){
      sel._wineBound=true;
      sel.addEventListener("change",function(){
        if(isWineTek(sel.value)) setWineMode(true);
      });
    }
    if(typeof window.onLocationChange==="function"&&!window.onLocationChange._wine){
      var ol=window.onLocationChange;
      window.onLocationChange=function(){
        extraTek();
        return ol.apply(this,arguments);
      };
      window.onLocationChange._wine=true;
    }
  }

  function ensureSupTab(){
    var tabs=document.querySelector("#supervisorView .tabs");
    if(!tabs||document.getElementById("tabBtnWine"))return;
    var btn=document.createElement("button");
    btn.className="tab-btn";
    btn.id="tabBtnWine";
    btn.type="button";
    btn.textContent="\u0412\u0438\u043d\u043e";
    btn.onclick=function(){showWineTab();};
    tabs.appendChild(btn);
    var view=document.getElementById("supervisorView");
    if(!view||document.getElementById("tabWine"))return;
    var pane=document.createElement("div");
    pane.id="tabWine";
    pane.className="hidden";
    pane.innerHTML='<div class="header-info no-print" style="margin-bottom:10px"><div><label>\u041d\u044d\u0440</label><input id="wineNewName"></div><div><label>\u04ae\u043d\u044d</label><input type="number" id="wineNewPrice" value="0"></div><div><label>\u041d\u04e9\u04e9\u0446</label><input type="number" id="wineNewStock" value="0"></div><div style="display:flex;align-items:flex-end"><button class="btn btn-sm" type="button" onclick="addWineProduct()">\u041d\u044d\u043c\u044d\u0445</button></div></div><div id="wineSummary" class="summary-box"></div><div class="table-wrap"><table><thead><tr><th>#</th><th>\u0411\u0430\u0440\u0430\u0430</th><th>\u04ae\u043d\u044d</th><th>\u041d\u04e9\u04e9\u0446</th><th>\u0417\u0430\u0440\u0441\u0430\u043d</th><th>\u041e\u0440\u043b\u043e\u0433\u043e</th><th></th></tr></thead><tbody id="wineBody"></tbody></table></div>';
    view.appendChild(pane);
  }

  function hideSupTabs(){
    ["tabOverview","tabSubmissions","tabReports","tabStock","tabPrices","tabUsers","tabWine"].forEach(function(id){
      var el=document.getElementById(id);
      if(el)el.classList.add("hidden");
    });
    document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){b.classList.remove("active");});
  }

  function showWineTab(){
    hideSupTabs();
    var pane=document.getElementById("tabWine");
    var btn=document.getElementById("tabBtnWine");
    if(pane)pane.classList.remove("hidden");
    if(btn)btn.classList.add("active");
    renderWineSup();
  }
  window.showWineTab=showWineTab;

  function wineSoldMap(){
    var map={};
    var list=[];
    try{list=(typeof getSubs==="function"?getSubs():[])||[];}catch(e){}
    list.filter(function(s){return s&&!s.deleted&&s.kind==="wine";}).forEach(function(s){
      (s.items||[]).forEach(function(it){
        if(!map[it.id])map[it.id]={sold:0,income:0};
        map[it.id].sold+=(it.sold||0);
        map[it.id].income+=(it.income||0);
      });
    });
    return map;
  }

  function attr(s){
    return String(s==null?"":s).replace(/&/g,"&").replace(/"/g,""");
  }

  function renderWineSup(){
    var wines=getWines();
    var sold=wineSoldMap();
    var tbody=document.getElementById("wineBody");
    if(!tbody)return;
    var ts=0,ti=0;
    tbody.innerHTML="";
    wines.forEach(function(w,i){
      var sl=sold[w.id]||{sold:0,income:0};
      ts+=sl.sold;ti+=sl.income;
      var tr=document.createElement("tr");
      var n=attr(w.name);
      tr.innerHTML="<td>"+(i+1)+"</td><td><input value=\""+n+"\" data-id=\""+w.id+"\" data-f=\"name\"></td><td><input type=\"number\" value=\""+(w.price||0)+"\" data-id=\""+w.id+"\" data-f=\"price\"></td><td><input type=\"number\" value=\""+(w.stock||0)+"\" data-id=\""+w.id+"\" data-f=\"stock\"></td><td>"+sl.sold+"</td><td>"+(sl.income||0).toLocaleString()+"\u20ae</td><td><button class=\"btn btn-outline btn-sm\" type=\"button\" data-del=\""+w.id+"\">\u0423\u0441\u0442\u0433\u0430\u0445</button></td>";
      tbody.appendChild(tr);
    });
    tbody.onchange=function(ev){
      var el=ev.target;
      var id=Number(el.getAttribute("data-id"));
      var f=el.getAttribute("data-f");
      if(id&&f) updateWineField(id,f,el.value);
    };
    tbody.onclick=function(ev){
      var el=ev.target.closest("[data-del]");
      if(el) removeWineProduct(Number(el.getAttribute("data-del")));
    };
    var box=document.getElementById("wineSummary");
    if(box){
      var count=(typeof getSubs==="function"?getSubs():[]).filter(function(s){return s&&!s.deleted&&s.kind==="wine";}).length;
      box.innerHTML='<div class="summary-item"><div class="label">\u0412\u0438\u043d\u043e \u0438\u043b\u0433\u044d\u044d\u043b\u0442</div><div class="value">'+count+'</div></div><div class="summary-item"><div class="label">\u0417\u0430\u0440\u0441\u0430\u043d</div><div class="value">'+ts+'</div></div><div class="summary-item"><div class="label">\u041e\u0440\u043b\u043e\u0433\u043e</div><div class="value">'+ti.toLocaleString()+'\u20ae</div></div>';
    }
  }
  window.renderWineSup=renderWineSup;

  window.updateWineField=function(id,field,val){
    var arr=getWines();
    arr.forEach(function(w){
      if(w.id===id){
        if(field==="name")w.name=val;
        else w[field]=Number(val)||0;
      }
    });
    setWines(arr);
    if(typeof cloudPush==="function")cloudPush();
  };
  window.addWineProduct=function(){
    var n=document.getElementById("wineNewName");
    var p=document.getElementById("wineNewPrice");
    var s=document.getElementById("wineNewStock");
    var name=n&&n.value.trim();
    if(!name){alert("\u041d\u044d\u0440 \u043e\u0440\u0443\u0443\u043b\u043d\u0430 \u0443\u0443");return;}
    var arr=getWines();
    var id=arr.reduce(function(m,w){return Math.max(m,w.id||100);},100)+1;
    arr.push({id:id,name:name,price:Number(p&&p.value)||0,stock:Number(s&&s.value)||0,cat:"ulaan"});
    setWines(arr);
    if(n)n.value="";
    if(typeof cloudPush==="function")cloudPush();
    renderWineSup();
  };
  window.removeWineProduct=function(id){
    if(!confirm("\u0423\u0441\u0442\u0433\u0430\u0445 \u0443\u0443?"))return;
    setWines(getWines().filter(function(w){return w.id!==id;}));
    if(typeof cloudPush==="function")cloudPush();
    renderWineSup();
  };

  if(typeof window.showTab==="function"&&!window.showTab._wine){
    var st=window.showTab;
    window.showTab=function(name){
      var pane=document.getElementById("tabWine");
      if(pane)pane.classList.add("hidden");
      var btn=document.getElementById("tabBtnWine");
      if(btn)btn.classList.remove("active");
      return st.apply(this,arguments);
    };
    window.showTab._wine=true;
  }

  function tick(){
    extraTek();
    ensureEmpSwitch();
    ensureSupTab();
    wrapProducts();
    wrapFormData();
    wrapPack();
    wrapTekChange();
  }
  tick();
  setInterval(tick,800);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",tick);
})();
