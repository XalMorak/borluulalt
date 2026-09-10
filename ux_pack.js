/* ux_pack: report 1-day, Sangria, wine detail sold-only, add wine, dark fonts */
(function(){
  if(window._uxPack) return; window._uxPack=true;

  function nrm(s){ return String(s||"").toLowerCase(); }
  function todayISO(){
    var t=new Date();
    return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");
  }
  function isoDaysAgo(n){
    var d=new Date(); d.setDate(d.getDate()-(n-1));
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  }
  function SNACK(){
    return ["\u0443\u043d\u0434\u0430\u0430","pringless","pringles","schoco","rosinen","max fun","toffifee","kowar","\u0441\u0430\u043c\u0430\u0440","alpen gold","\u0430\u0439\u0440\u0430\u0433","\u0435\u0440\u04e9\u04e9 \u0433\u043e\u0432\u044c","ooze","vibez"];
  }
  function isBusad(it){
    if(!it) return false;
    var c=nrm(it.cat);
    if(c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0) return true;
    var n=nrm(it.name);
    var list=SNACK();
    for(var i=0;i<list.length;i++) if(n.indexOf(list[i])>=0) return true;
    return false;
  }
  function isWineSub(s){
    if(!s) return false;
    if(s.kind==="wine"||s.sheet==="wine") return true;
    var tek=nrm(s.receiverName||s.tek||s.receiver||"");
    if(tek.indexOf("\u0432\u0438\u043d\u043e")>=0) return true;
    var items=s.items||[];
    for(var i=0;i<items.length;i++) if(Number(items[i]&&items[i].id)>=100) return true;
    return false;
  }

  /* 1) report 1-day + period sets date range */
  function setReportRange(days){
    var a=document.getElementById("reportFrom");
    var b=document.getElementById("reportTo");
    if(a) a.value=isoDaysAgo(days||1);
    if(b) b.value=todayISO();
    if(typeof runReport==="function") runReport();
    var t=document.getElementById("chartTitle");
    if(t) t.textContent = (days===1)?"\u04e8\u043d\u04e9\u04e9\u0434\u04e9\u0440 (1 \u04e9\u0434\u04e9\u0440)":"\u0421\u04af\u04af\u043b\u0438\u0439\u043d "+days+" \u0445\u043e\u043d\u043e\u0433";
  }
  window.setReportDays=function(n){
    n=Number(n)||1;
    setReportRange(n);
    if(typeof showChartLines==="function") showChartLines(n);
    else if(typeof showChart==="function"){
      try{ window._skipReportFromChart=true; showChart(n); }finally{ window._skipReportFromChart=false; }
    }
  };
  function wrapChart(){
    if(typeof window.showChart!=="function"||window.showChart._day) return;
    var sc=window.showChart;
    window.showChart=function(days){
      days=days||7;
      if(!window._skipReportFromChart) setReportRange(days);
      return sc.apply(this,arguments);
    };
    window.showChart._day=true;
  }
  function mountReportDay(){
    wrapChart();
    var bar=document.querySelector("#tabReports .period-btns");
    if(!bar||document.getElementById("reportDay1")) return;
    var b=document.createElement("button");
    b.id="reportDay1"; b.type="button"; b.className="btn btn-sm";
    b.textContent="1 \u04e9\u0434\u04e9\u0440";
    b.onclick=function(){ window.setReportDays(1); };
    bar.insertBefore(b, bar.firstChild);
    var t=document.createElement("button");
    t.id="reportTodayBtn"; t.type="button"; t.className="btn btn-sm";
    t.textContent="\u04e8\u043d\u04e9\u04e9\u0434\u04e9\u0440";
    t.onclick=function(){ window.setReportDays(1); };
    bar.insertBefore(t, b);
    ["reportFrom","reportTo"].forEach(function(id){
      var el=document.getElementById(id);
      if(el && !el._ux){
        el._ux=true;
        el.addEventListener("change", function(){
          if(typeof runReport==="function") runReport();
        });
      }
    });
  }

  /* 2) Sangria */
  function ensureSangria(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return;
    var arr=(getWines()||[]).filter(function(w){ return w&&w.id&&w.name; });
    if(!arr.length) return;
    if(arr.some(function(w){ return nrm(w.name)==="sangria"; })) return;
    var maxId=100;
    arr.forEach(function(w){ if((w.id||0)>maxId) maxId=w.id; });
    var sang={id:maxId+1,name:"Sangria",price:5000,stock:0,cat:"ulaan",stockByLoc:{}};
    var idx=-1;
    for(var i=0;i<arr.length;i++){
      var c=nrm(arr[i].cat);
      if(c.indexOf("ulaan")>=0||c.indexOf("\u0443\u043b\u0430\u0430\u043d")>=0){ idx=i; break; }
    }
    if(idx<0) arr.push(sang); else arr.splice(idx,0,sang);
    setWines(arr);
    if(typeof cloudPush==="function") try{ cloudPush(); }catch(e){}
    if(typeof drawWineStock==="function") try{ drawWineStock(); }catch(e){}
  }

  /* 3) wine submission: only sold wines + busad */
  function wrapDetail(){
    if(typeof window.renderDetailView!=="function"||window.renderDetailView._soldOnly) return;
    var orig=window.renderDetailView;
    window.renderDetailView=function(s,idx){
      if(s && isWineSub(s)){
        var copy={};
        for(var k in s) copy[k]=s[k];
        copy.items=(s.items||[]).filter(function(it){
          if(isBusad(it)) return true;
          return (Number(it.sold)||0)>0;
        });
        return orig.call(this, copy, idx);
      }
      return orig.apply(this, arguments);
    };
    window.renderDetailView._soldOnly=true;
  }

  /* 4) add wine product */
  function addWineProduct(){
    if(typeof getWines!=="function"||typeof setWines!=="function") return;
    var name=(document.getElementById("wineAddName")||{}).value||"";
    name=String(name).trim();
    var price=Number((document.getElementById("wineAddPrice")||{}).value)||0;
    var cat=(document.getElementById("wineAddCat")||{}).value||"ulaan";
    var alertBox=document.getElementById("wineAddAlert");
    function msg(t,ok){
      if(alertBox) alertBox.innerHTML='<div class="alert '+(ok?"alert-success":"alert-warn")+'">'+t+'</div>';
    }
    if(!name){ msg("\u041d\u044d\u0440 \u043e\u0440\u0443\u0443\u043b\u043d\u0430"); return; }
    if(price<=0){ msg("\u04ae\u043d\u044d \u043e\u0440\u0443\u0443\u043b\u043d\u0430"); return; }
    var arr=(getWines()||[]).filter(function(w){ return w&&w.id; });
    if(arr.some(function(w){ return nrm(w.name)===nrm(name); })){ msg("\u0418\u0439\u043c \u043d\u044d\u0440\u0442\u044d\u0439 \u0431\u0430\u0440\u0430\u0430 \u0431\u0430\u0439\u043d\u0430"); return; }
    var maxId=100;
    arr.forEach(function(w){ if((w.id||0)>maxId) maxId=w.id; });
    arr.push({id:maxId+1,name:name,price:price,stock:0,cat:cat,stockByLoc:{}});
    setWines(arr);
    if(typeof cloudPush==="function") try{ cloudPush(); }catch(e){}
    if(typeof drawWineStock==="function") drawWineStock();
    var nEl=document.getElementById("wineAddName"); if(nEl) nEl.value="";
    var pEl=document.getElementById("wineAddPrice"); if(pEl) pEl.value="";
    msg(name+" \u043d\u044d\u043c\u044d\u0433\u0434\u043b\u044d\u044d", true);
  }
  window.addWineProduct=addWineProduct;
  function mountWineAdd(){
    var tab=document.getElementById("tabWine"); if(!tab) return;
    if(document.getElementById("wineAddBox")) return;
    var box=document.createElement("div");
    box.id="wineAddBox";
    box.className="header-info";
    box.style.margin="0 0 12px";
    box.innerHTML=
      '<div><label>\u0411\u0430\u0440\u0430\u0430 \u043d\u044d\u043c\u044d\u0445</label><input id="wineAddName" placeholder="\u041d\u044d\u0440"></div>'
      +'<div><label>\u04ae\u043d\u044d</label><input id="wineAddPrice" type="number" min="0" placeholder="5000"></div>'
      +'<div><label>\u0410\u043d\u0433\u0438\u043b\u0430\u043b</label><select id="wineAddCat">'
      +'<option value="busad">\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430</option>'
      +'<option value="ulaan">\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option>'
      +'<option value="tsagaan">\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e</option>'
      +'</select></div>'
      +'<div style="display:flex;align-items:flex-end"><button type="button" class="btn btn-sm" id="wineAddBtn">\u0411\u0430\u0440\u0430\u0430 \u043d\u044d\u043c\u044d\u0445</button></div>'
      +'<div id="wineAddAlert" style="flex-basis:100%"></div>';
    var header=tab.querySelector(".header-info");
    if(header&&header.parentNode) header.parentNode.insertBefore(box, header.nextSibling);
    else tab.insertBefore(box, tab.firstChild);
    var btn=document.getElementById("wineAddBtn");
    if(btn) btn.onclick=addWineProduct;
  }

  /* 5) dark mode fonts */
  function mountDark(){
    if(document.getElementById("uxDarkCss")) return;
    var st=document.createElement("style");
    st.id="uxDarkCss";
    st.textContent=[
      "body.dark,.dark{color:#e8e8e8}",
      "body.dark label,body.dark p,body.dark h1,body.dark h2,body.dark h3,body.dark h4,body.dark .summary-item .label,body.dark #chartTitle,body.dark .header-info label{color:#d5dbe6!important}",
      "body.dark .summary-item .value,body.dark strong,body.dark .product-name{color:#f4f6fa!important}",
      "body.dark .summary-box,body.dark .chart-wrap{background:#1a2436!important;color:#e8e8e8}",
      "body.dark table,body.dark td,body.dark th{color:#e8e8e8}",
      "body.dark tr:nth-child(even){background:#252532}",
      "body.dark .alert-info{background:#243044;color:#d0d8e8}",
      "body.dark .alert-success{background:#1e3d2a;color:#c6f0d0}",
      "body.dark .alert-warn{background:#3d3420;color:#f0e0b0}",
      "body.dark [id^=sheetBar_]{background:#1e3a32!important;border-color:#2d5a48!important}",
      "body.dark [id^=sheetBar_] span{color:#c8e6d4!important}",
      "body.dark .stock-ok{color:#7dcea0}",
      "body.dark .stock-low{color:#f5b7b1}",
      "body.dark .card{color:#e8e8e8}",
      "body.dark .btn-outline{color:#9ec1ff}",
      "#chartTitle{color:#666}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function boot(){
    mountDark();
    mountReportDay();
    wrapDetail();
    ensureSangria();
    mountWineAdd();
  }
  boot();
  setInterval(boot,800);
})();
