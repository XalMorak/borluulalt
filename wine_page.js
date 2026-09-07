/* wine_page: employee/supervisor wine form + tek options */
(function(){
  if(window._winePageLoaded)return;
  window._winePageLoaded=true;

  var WINE_KEY="borluulalt_wines_v1";
  var DEFAULT_WINES=[
    {id:101,name:"Улаан",price:4000,stock:0,cat:"улаан"},
    {id:102,name:"Pengbess",price:8000,stock:0,cat:"улаан"},
    {id:103,name:"Scholo Rossien",price:8000,stock:0,cat:"улаан"},
    {id:104,name:"Mer lin (moscow)",price:9000,stock:0,cat:"улаан"},
    {id:105,name:"Trollfee",price:10000,stock:0,cat:"улаан"},
    {id:106,name:"Recover mix",price:7000,stock:0,cat:"улаан"},
    {id:107,name:"Camp",price:4000,stock:0,cat:"улаан"},
    {id:108,name:"Albert gold",price:5500,stock:0,cat:"улаан"},
    {id:109,name:"Aiquet",price:6900,stock:0,cat:"улаан"},
    {id:110,name:"Epee roux загвай",price:3500,stock:0,cat:"улаан"},
    {id:111,name:"Gose",price:0,stock:0,cat:"улаан"}
  ];

  function extraTek(){
    if(typeof TEK_BY_LOC!=="object")window.TEK_BY_LOC={};
    var o=TEK_BY_LOC["Оюут бар"]||[];
    ["Оюут вино","ХАБ вино"].forEach(function(t){if(o.indexOf(t)<0)o.push(t);});
    TEK_BY_LOC["Оюут бар"]=o;
    var m=TEK_BY_LOC["Манлай бар"]||[];
    if(m.indexOf("Манлай вино")<0)m.push("Манлай вино");
    TEK_BY_LOC["Манлай бар"]=m;
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
    return v.indexOf("вино")>=0;
  }

  function setWineMode(on, rebuild){
    window._wineMode=!!on;
    var b1=document.getElementById("empModeBar");
    var b2=document.getElementById("empModeWine");
    if(b1)b1.className="tab-btn"+(!on?" active":"");
    if(b2)b2.className="tab-btn"+(on?" active":"");
    var title=document.getElementById("empSheetTitle");
    if(title)title.textContent=on?"Виноны борлуулалт":"Барааны борлуулалт";
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
    bar.innerHTML=
      '<span id="empSheetTitle" style="margin-right:10px;font-weight:600">Барааны борлуулалт</span>'+
      '<button type="button" class="tab-btn active" id="empModeBar" onclick="setWineMode(false)">Бар</button>'+
      '<button type="button" class="tab-btn" id="empModeWine" onclick="setWineMode(true)">Вино</button>';
    var header=view.querySelector(".header-info");
    if(header) header.parentNode.insertBefore(bar, header.nextSibling);
    else view.insertBefore(bar, view.firstChild);
  }

  function wrapProducts(){
    if(typeof window.getActiveProducts!=="function"||window.getActiveProducts._wine)return;
    var orig=window.getActiveProducts;
    window.getActiveProducts=function(){
      if(window._wineMode){
        return getWines().filter(function(w){return w&&!w.hidden;});
      }
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
        if(window._wineMode) d.sheet="вино";
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
        var r=ol.apply(this,arguments);
        return r;
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
    btn.textContent="Вино";
    btn.onclick=function(){showWineTab();};
    tabs.appendChild(btn);
    var view=document.getElementById("supervisorView");
    if(!view||document.getElementById("tabWine"))return;
    var pane=document.createElement("div");
    pane.id="tabWine";
    pane.className="hidden";
    pane.innerHTML=
      '<div class="header-info no-print" style="margin-bottom:10px">'+
      '<div><label>Нэр</label><input id="wineNewName" placeholder="Виноны нэр"></div>'+
      '<div><label>Үнэ</label><input type="number" id="wineNewPrice" value="0"></div>'+
      '<div><label>Нөөц</label><input type="number" id="wineNewStock" value="0"></div>'+
      '<div style="display:flex;align-items:flex-end"><button class="btn btn-sm" type="button" onclick="addWineProduct()">Нэмэх</button></div>'+
      '</div>'+
      '<div id="wineSummary" class="summary-box"></div>'+
      '<div class="table-wrap"><table><thead><tr><th>#</th><th>Бараа</th><th>Үнэ</th><th>Нөөц</th><th>Зарсан</th><th>Орлого</th><th></th></tr></thead>'+
      '<tbody id="wineBody"></tbody></table></div>';
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
      tr.innerHTML=
        "<td>"+(i+1)+"</td>"+
        "<td><input value=\""+esc(w.name)+"\" onchange=\"updateWineField("+w.id+",'name',this.value)\"></td>"+
        "<td><input type=\"number\" value=\""+(w.price||0)+"\" onchange=\"updateWineField("+w.id+",'price',this.value)\"></td>"+
        "<td><input type=\"number\" value=\""+(w.stock||0)+"\" onchange=\"updateWineField("+w.id+",'stock',this.value)\"></td>"+
        "<td>"+sl.sold+"</td>"+
        "<td>"+(sl.income||0).toLocaleString()+"₮</td>"+
        "<td><button class=\"btn btn-outline btn-sm\" type=\"button\" onclick=\"removeWineProduct("+w.id+")\">Устгах</button></td>";
      tbody.appendChild(tr);
    });
    var box=document.getElementById("wineSummary");
    if(box){
      var count=(typeof getSubs==="function"?getSubs():[]).filter(function(s){return s&&!s.deleted&&s.kind==="wine";}).length;
      box.innerHTML=
        '<div class="summary-item"><div class="label">Вино илгээлт</div><div class="value">'+count+'</div></div>'+
        '<div class="summary-item"><div class="label">Зарсан</div><div class="value">'+ts+'</div></div>'+
        '<div class="summary-item"><div class="label">Орлого</div><div class="value">'+ti.toLocaleString()+'₮</div></div>';
    }
  }
  window.renderWineSup=renderWineSup;

  function esc(s){return String(s||"").replace(/"/g,""");}

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
    if(!name){alert("Нэр оруулна уу");return;}
    var arr=getWines();
    var id=arr.reduce(function(m,w){return Math.max(m,w.id||100);},100)+1;
    arr.push({id:id,name:name,price:Number(p&&p.value)||0,stock:Number(s&&s.value)||0,cat:"улаан"});
    setWines(arr);
    if(n)n.value="";
    if(typeof cloudPush==="function")cloudPush();
    renderWineSup();
  };
  window.removeWineProduct=function(id){
    if(!confirm("Энэ вино устгах уу?"))return;
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
