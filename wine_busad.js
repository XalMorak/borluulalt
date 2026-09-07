/* wine_busad: other-goods section on wine sheet + undo bar merge */
(function(){
  if(window._wineBusadLoaded)return;
  window._wineBusadLoaded=true;

  var OTHER="busad";
  var RED="ulaan";
  var WHITE="tsagaan";
  var LABELS={};
  LABELS[OTHER]="\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430";
  LABELS[RED]="\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e";
  LABELS[WHITE]="\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e";

  var SNACKS=[
    {name:"\u0423\u043d\u0434\u0430\u0430",price:4000},
    {name:"pringless",price:8000},
    {name:"Schoco rosinen",price:8000},
    {name:"Max fun (\u0448\u043e\u043a\u043e\u043b\u0430\u0434)",price:9000},
    {name:"Toffifee",price:10000},
    {name:"Kowar mix",price:7000},
    {name:"\u0441\u0430\u043c\u0430\u0440",price:4000},
    {name:"Alpen gold",price:5500},
    {name:"\u0410\u0439\u0440\u0430\u0433",price:6900},
    {name:"\u0415\u0440\u04e9\u04e9 \u0433\u043e\u0432\u044c \u0437\u0430\u0434\u0433\u0430\u0439",price:3500},
    {name:"Ooze",price:7400},
    {name:"Vibez",price:4000}
  ];

  function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ");}
  function snackNames(){
    var o={};
    SNACKS.forEach(function(s){o[norm(s.name)]=1;});
    return o;
  }
  function catOf(w){
    var c=String(w&&w.cat||"").toLowerCase();
    if(c===OTHER||c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0)return OTHER;
    if(c===WHITE||c.indexOf("tsagaan")>=0||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0)return WHITE;
    var n=norm(w&&w.name);
    if(snackNames()[n])return OTHER;
    return RED;
  }

  function undoBarMerge(){
    if(typeof getProducts!=="function"||typeof setProducts!=="function")return;
    var sn=snackNames();
    var arr=getProducts()||[];
    var keep=arr.filter(function(p){
      if((p.id||0)>=100)return false;
      if((p.id||0)>13 && sn[norm(p.name)])return false;
      return true;
    });
    if(keep.length!==arr.length){
      setProducts(keep);
      if(typeof cloudPush==="function")cloudPush();
    }
    try{localStorage.removeItem("borluulalt_wine_to_bar_v1");}catch(e){}
  }

  function seedOther(){
    if(typeof getWines!=="function"||typeof setWines!=="function")return;
    var arr=getWines()||[];
    var have={};
    arr.forEach(function(w){have[norm(w.name)]=1;});
    var maxId=100;
    arr.forEach(function(w){if((w.id||0)>maxId)maxId=w.id;});
    var ch=false;
    SNACKS.forEach(function(s){
      if(have[norm(s.name)]){
        arr.forEach(function(w){if(norm(w.name)===norm(s.name)){w.cat=OTHER;if(!w.price)w.price=s.price;ch=true;}});
        return;
      }
      maxId+=1;
      arr.push({id:maxId,name:s.name,price:s.price,stock:0,cat:OTHER});
      have[norm(s.name)]=1;
      ch=true;
    });
    arr.forEach(function(w){
      var c=catOf(w);
      if(w.cat!==c){w.cat=c;ch=true;}
    });
    if(ch)setWines(arr);
  }

  function headerRow(label, cols){
    var tr=document.createElement("tr");
    tr.className="wine-sec";
    var td=document.createElement("td");
    td.colSpan=cols||8;
    td.style.cssText="background:#1e3a5f;color:#fff;font-weight:700;padding:8px 12px";
    td.textContent=label;
    tr.appendChild(td);
    return tr;
  }

  function regroup(tbody, kind){
    if(!tbody)return;
    tbody.querySelectorAll(".wine-sec").forEach(function(r){r.remove();});
    var wines=typeof getWines==="function"?getWines():[];
    var byId={};
    wines.forEach(function(w){byId[String(w.id)]=catOf(w);});
    var rows=[].slice.call(tbody.querySelectorAll("tr"));
    if(!rows.length)return;
    function idOf(tr){
      var el=tr.querySelector("[data-id],[data-del],input[id^='prev_'],input[id^='sold_']");
      if(!el)return "";
      var a=el.getAttribute("data-id")||el.getAttribute("data-del");
      if(a)return String(a);
      var m=String(el.id||"").match(/_(\d+)$/);
      return m?m[1]:"";
    }
    var g={}; g[OTHER]=[]; g[RED]=[]; g[WHITE]=[];
    rows.forEach(function(tr){
      var id=idOf(tr);
      var c=byId[id]||OTHER;
      if(!g[c])c=OTHER;
      g[c].push(tr);
    });
    tbody.innerHTML="";
    [OTHER,RED,WHITE].forEach(function(c){
      tbody.appendChild(headerRow(LABELS[c], kind==="sup"?8:7));
      g[c].forEach(function(tr){tbody.appendChild(tr);});
    });
  }

  function fixCatSelect(){
    var pane=document.getElementById("wineNewCat");
    if(pane && pane.options.length<3){
      pane.innerHTML='<option value="busad">\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430</option><option value="ulaan">\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option><option value="tsagaan">\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option>';
    }
  }

  function wrapAdd(){
    if(typeof window.addWineProduct!=="function"||window.addWineProduct._busad)return;
    var a=window.addWineProduct;
    window.addWineProduct=function(){
      var r=a.apply(this,arguments);
      var sel=document.getElementById("wineNewCat");
      var cat=sel?sel.value:OTHER;
      if(cat!==OTHER && cat!==RED && cat!==WHITE)cat=OTHER;
      if(typeof getWines==="function"&&typeof setWines==="function"){
        var arr=getWines();
        if(arr.length){arr[arr.length-1].cat=cat;setWines(arr);}
      }
      return r;
    };
    window.addWineProduct._busad=true;
  }

  var lastEmp=0,lastSup=0;
  function tick(){
    undoBarMerge();
    seedOther();
    fixCatSelect();
    wrapAdd();
    if(window._wineMode){
      var tb=document.getElementById("salesBody");
      if(tb && tb.rows.length && !tb.querySelector(".wine-sec")) regroup(tb,"emp");
    }
    var pane=document.getElementById("tabWine");
    if(pane && !pane.classList.contains("hidden")){
      var wb=document.getElementById("wineBody");
      if(wb && wb.rows.length && wb.querySelectorAll(".wine-sec").length!==3){
        wb.querySelectorAll(".wine-sec").forEach(function(r){r.remove();});
        regroup(wb,"sup");
      }
    }
  }
  tick();
  setInterval(tick,700);
})();
