/* runtime_fix: safe sync, chart, hide prices. Never overwrite cloud with empty local. */
(function(){
  if(window._runtimeFix)return; window._runtimeFix=true;

  function hidePrices(){
    document.querySelectorAll("#supervisorView .tab-btn").forEach(function(b){
      var t=(b.textContent||"").replace(/\s+/g,"").trim();
      if(t==="\u04ae\u043d\u044d"||b.id==="tabBtnPrices"||(b.getAttribute("onclick")||"").indexOf("prices")>=0) b.remove();
    });
    var p=document.getElementById("tabPrices"); if(p) p.remove();
    if(typeof window.showTab==="function" && !window.showTab._noPrice){
      var st=window.showTab;
      window.showTab=function(name){ if(name==="prices") name="stock"; return st.call(this,name); };
      window.showTab._noPrice=true;
    }
  }

  function thinList(arr){ return !arr || !Array.isArray(arr) || arr.length===0; }
  function thinUsers(u){ return !u || typeof u!=="object" || Object.keys(u).length===0; }

  function wrapPush(){
    if(typeof window.cloudPush!=="function" || window.cloudPush._safe) return;
    var orig=window.cloudPush;
    window.cloudPush=async function(){
      try{
        if(typeof initFirebase==="function") initFirebase();
        if(!window._fbDb) return orig.apply(this,arguments);
        var local=(typeof packAll==="function")?packAll():{};
        var snap=await _fbDb.ref("borluulalt").once("value");
        var cloud=snap.val()||{};
        if(thinList(local.products) && !thinList(cloud.products)) local.products=cloud.products;
        if(thinList(local.submissions) && !thinList(cloud.submissions)) local.submissions=cloud.submissions;
        if(thinList(local.wines) && !thinList(cloud.wines)) local.wines=cloud.wines;
        if(thinUsers(local.users) && !thinUsers(cloud.users)) local.users=cloud.users;
        if(thinList(local.logs) && !thinList(cloud.logs)) local.logs=cloud.logs;
        local.updatedAt=new Date().toISOString();
        if(typeof applyAll==="function") applyAll(local);
        await _fbDb.ref("borluulalt").set(local);
        window._lastCloudAt=local.updatedAt;
        if(typeof updateSyncBadge==="function") updateSyncBadge("ok");
        return true;
      }catch(e){
        console.warn(e);
        return orig.apply(this,arguments);
      }
    };
    window.cloudPush._safe=true;
  }

  function ymd(d){
    var y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();
    return y+"-"+(m<10?"0":"")+m+"-"+(day<10?"0":"")+day;
  }
  function kindOf(s){ return (s&&(s.kind==="wine"||s.sheet==="wine"))?"wine":"bar"; }
  function sheetSubs(){
    var k=window._sheetKind||"bar";
    var list=[]; try{ if(typeof getSubs==="function") list=getSubs()||[]; }catch(e){}
    return list.filter(function(s){ return s&&!s.deleted&&(k==="all"||kindOf(s)===k); });
  }
  function drawChart(days){
    days=Number(days)||7; window._chartDays=days;
    var bars=document.getElementById("chartBars"); if(!bars) return;
    var loc=(document.getElementById("reportLoc")||{}).value||"";
    var tek=(document.getElementById("reportTek")||{}).value||"";
    var emp=(document.getElementById("reportEmp")||{}).value||"";
    var keys=[], by={};
    for(var i=0;i<days;i++){
      var d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-(days-1-i));
      var k=ymd(d); keys.push(k); by[k]={income:0,over:0,short:0};
    }
    var from=keys[0];
    sheetSubs().forEach(function(s){
      var dt=s.date||""; if(dt<from) return;
      if(loc&&s.location!==loc) return;
      if(tek&&(s.receiver||s.receiverName||"")!==tek) return;
      if(emp&&s.employeeId!==emp) return;
      if(!by[dt]) by[dt]={income:0,over:0,short:0};
      by[dt].income+=(Number(s.calcTotal)||0);
      var diff=Number(s.diff)||0;
      if(diff>0) by[dt].over+=diff; else by[dt].short+=Math.abs(diff);
    });
    var maxVal=1; keys.forEach(function(k){ maxVal=Math.max(maxVal,by[k].income,by[k].over,by[k].short); });
    var W=Math.max(520,keys.length*40), H=200, pL=28, pR=10, pT=16, pB=32, iW=W-pL-pR, iH=H-pT-pB;
    function xAt(i){ return pL+(keys.length<2?iW/2:(i/(keys.length-1))*iW); }
    function yAt(v){ return pT+iH-(v/maxVal)*iH; }
    function line(field,color){
      var pts=keys.map(function(k,i){ return xAt(i)+","+yAt(by[k][field]); }).join(" ");
      var dots=keys.map(function(k,i){ return '<circle cx="'+xAt(i)+'" cy="'+yAt(by[k][field])+'" r="3.2" fill="'+color+'"></circle>'; }).join("");
      return '<polyline fill="none" stroke="'+color+'" stroke-width="2.4" points="'+pts+'"/>'+dots;
    }
    var labels=keys.map(function(k,i){ return '<text x="'+xAt(i)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#888">'+k.slice(5)+'</text>'; }).join("");
    bars.innerHTML='<div style="display:flex;gap:12px;font-size:12px;margin-bottom:6px"><span style="color:#27ae60">\u25cf \u041e\u0440\u043b\u043e\u0433\u043e</span><span style="color:#2980b9">\u25cf \u0418\u043b\u04af\u04af</span><span style="color:#c0392b">\u25cf \u0414\u0443\u0442\u0443\u0443</span></div><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="200">'+line("income","#27ae60")+line("over","#2980b9")+line("short","#c0392b")+labels+'</svg>';
    var title=document.getElementById("chartTitle"); if(title) title.textContent="\u0421\u04af\u04af\u043b\u0438\u0439\u043d "+days+" \u0445\u043e\u043d\u043e\u0433";
  }
  window.showChart=drawChart;
  document.addEventListener("click",function(ev){
    var b=ev.target.closest("#tabReports button, .period-btns button"); if(!b) return;
    var m=(b.textContent||"").match(/(\d+)\s*\u0445\u043e\u043d\u043e\u0433/);
    if(m){ ev.preventDefault(); drawChart(Number(m[1])); }
  },true);

  hidePrices(); wrapPush();
  setInterval(function(){ hidePrices(); wrapPush(); window.showChart=drawChart; },1200);
})();
