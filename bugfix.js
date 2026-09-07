/* bugfix: cash formula, stock once, archive soft, excel tek, detail view */
(function(){
  function cashFromSalesOf(s){
    var cash=Number(s.cashAmount)||0, card=Number(s.cardTotal)||0, start=Number(s.cashBalance)||0;
    return {cashFromSales:Math.max(0,cash-start), collected:Math.max(0,cash-start)+card};
  }
  function calcDiff(s){
    var calc=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce(function(a,i){return a+(i.income||0);},0);
    var c=cashFromSalesOf(s);
    return {calc:calc, collected:c.collected, diff:c.collected-calc};
  }
  function tekOf(s){return ((s&&(s.receiverName||s.receiver))||"").toString().trim();}

  function wrapForm(){
    if(window._bfForm||typeof window.getFormData!=="function")return;
    window._bfForm=true;
    var _g=window.getFormData;
    window.getFormData=function(){
      var d=_g.apply(this,arguments);
      if(!d)return d;
      var cash=Number(d.cashAmount)||0, card=Number(d.cardTotal)||0, start=Number(d.cashBalance)||0;
      var cfs=Math.max(0,cash-start);
      d.collected=cfs+card;
      d.diff=d.collected-(Number(d.calcTotal)||0);
      if(!d.id)d.id="s_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
      if(!d.submittedAt)d.submittedAt=new Date().toISOString();
      return d;
    };
  }

  var STOCK_LOCS=["Оюут бар","Манлай бар","POWER"];
  function ensureLoc(p){
    if(!p.stockByLoc||typeof p.stockByLoc!=="object")p.stockByLoc={};
    STOCK_LOCS.forEach(function(l){if(p.stockByLoc[l]==null)p.stockByLoc[l]=0;});
    return p;
  }
  function migrate(){
    if(typeof getProducts!=="function")return;
    var products=getProducts(), ch=false;
    products.forEach(function(p){
      if(!p.stockByLoc){
        ensureLoc(p);
        if((p.stock||0)>0 && STOCK_LOCS.every(function(l){return !(p.stockByLoc[l]);}))
          p.stockByLoc["Оюут бар"]=p.stock||0;
        ch=true;
      } else ensureLoc(p);
      p.stock=STOCK_LOCS.reduce(function(s,l){return s+(Number(p.stockByLoc[l])||0);},0);
    });
    if(ch&&typeof setProducts==="function")setProducts(products);
  }
  function wrapSave(){
    if(window._bfSave||typeof window.saveSubmission!=="function")return;
    window._bfSave=true;
    var _s=window.saveSubmission;
    window.saveSubmission=async function(){
      migrate();
      var before=JSON.parse(JSON.stringify(typeof getProducts==="function"?getProducts():[]));
      var result=await _s.apply(this,arguments);
      try{
        if(typeof setProducts==="function")setProducts(before);
        var data=typeof getFormData==="function"?getFormData():null;
        if(data&&data.items&&typeof getProducts==="function"){
          var loc=data.location||"Оюут бар";
          if(STOCK_LOCS.indexOf(loc)<0)loc="Оюут бар";
          var products=getProducts();
          data.items.forEach(function(it){
            if(!(it.sold>0))return;
            var idx=products.findIndex(function(p){return p.id===it.id;});
            if(idx<0)return;
            ensureLoc(products[idx]);
            products[idx].stockByLoc[loc]=Math.max(0,(Number(products[idx].stockByLoc[loc])||0)-it.sold);
            products[idx].stock=STOCK_LOCS.reduce(function(s,l){return s+(Number(products[idx].stockByLoc[l])||0);},0);
          });
          setProducts(products);
          if(typeof cloudPush==="function")await cloudPush();
        }
      }catch(e){console.warn("stock fix",e);}
      return result;
    };
  }

  function wrapArchive(){
    if(window._bfArch)return;
    window._bfArch=true;
    if(typeof window.runArchiveCleanup==="function"){
      window.runArchiveCleanup=function(){};
    }
  }

  function wrapCSV(){
    if(window._bfCsv||typeof window.exportCSV!=="function")return;
    window._bfCsv=true;
    window.exportCSV=function(){
      var rows=(window._reportRows&&window._reportRows.length)?window._reportRows:(typeof getSubs==="function"?getSubs():[]);
      var csv="Огноо,Ажилтан,ID,Ээлж,Байршил,Тек,Бэлэн,Карт,Эхлэл дүн,Орлого,Нийт борлуулалт,Зөрүү,Төлөв\n";
      function esc(v){v=String(v==null?"":v);if(/[",\n]/.test(v))return '"'+v.replace(/"/g,'""')+'"';return v;}
      rows.forEach(function(s){
        var x=calcDiff(s);
        var status=Math.abs(x.diff)<0.01?"Тохирсон":(x.diff>0?"Илүү":"Дутуу");
        csv+=[s.date,s.employeeName,s.employeeId,s.shift||"",s.location||"",tekOf(s),
          s.cashAmount||0,s.cardTotal||0,s.cashBalance||0,x.calc,x.collected,x.diff,status].map(esc).join(",")+"\n";
      });
      var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob);
      a.download="borluulalt_report_"+new Date().toISOString().slice(0,10)+".csv";
      a.click();
    };
  }

  function renderDetailFixed(s,idx){
    var det=document.getElementById("selectedSubmissionDetail");
    if(!det||!s)return;
    var x=calcDiff(s);
    var tek=tekOf(s);
    var diffCls=Math.abs(x.diff)<0.01?"diff-ok":(x.diff>0?"diff-over":"diff-short");
    var rows=(s.items||[]).map(function(it){
      return "<tr><td class=\"product-name\">"+(it.name||"")+"</td><td>"+(it.prev||0)+"</td><td>"+(it.next||0)+
        "</td><td>"+(it.sold||0)+"</td><td>"+Number(it.income||0).toLocaleString()+"</td></tr>";
    }).join("");
    det.classList.remove("hidden");
    det.style.display="block";
    det.innerHTML=
      '<div class="card" style="margin-top:12px;padding:14px">'+
      "<h3>"+(s.employeeName||"")+" — "+(s.date||"")+(s.locked?" 🔒":"")+"</h3>"+
      "<p>"+(s.shift||"")+(s.location?" · "+s.location:"")+(tek?" · <strong>Тек: "+tek+"</strong>":"")+"</p>"+
      (s.checkerName?"<p>Шалгагч: "+s.checkerName+"</p>":"")+
      '<table style="width:100%"><thead><tr><th>Бараа</th><th>Өмнөх</th><th>Дараах</th><th>Зарсан</th><th>Орлого</th></tr></thead><tbody>'+
      rows+"</tbody></table>"+
      "<p>Бэлэн: "+Number(s.cashAmount||0).toLocaleString()+
      " · Карт: "+Number(s.cardTotal||0).toLocaleString()+
      " · Эхлэл: "+Number(s.cashBalance||0).toLocaleString()+
      " · Бодсон: "+Number(x.calc).toLocaleString()+
      " · Нийт: "+Number(x.collected).toLocaleString()+
      ' · Зөрүү: <span class="'+diffCls+'">'+(x.diff>=0?"+":"")+Number(x.diff).toLocaleString()+"</span></p>"+
      '<div class="no-print" style="margin-top:10px">'+
      (typeof startEditSubmission==="function"?'<button class="btn btn-sm" onclick="startEditSubmission('+idx+')">Засах</button> ':"")+
      (typeof toggleLock==="function"?'<button class="btn btn-sm" onclick="toggleLock('+idx+')">'+(s.locked?"Түгжээ тайлах":"Түгжих")+"</button> ":"")+
      (typeof deleteSubmission==="function"?'<button class="btn btn-sm btn-danger" onclick="deleteSubmission('+idx+')">Устгах</button>':"")+
      ' <button class="btn btn-outline btn-sm" onclick="document.getElementById(\'selectedSubmissionDetail\').classList.add(\'hidden\')">Хаах</button>'+
      "</div><div id=\"editAlert\"></div></div>";
    try{det.scrollIntoView({behavior:"smooth",block:"nearest"});}catch(e){}
  }
  function wrapDetail(){
    window.showSubmissionDetail=function(idx){
      var s=window._sortedSubs&&window._sortedSubs[idx];
      if(!s){console.warn("no sub",idx);return;}
      window._editingIdx=null;
      renderDetailFixed(s,idx);
    };
    window.renderDetailView=function(s,idx){renderDetailFixed(s,idx);};
  }

  function tick(){
    wrapForm();wrapSave();wrapArchive();wrapCSV();wrapDetail();
  }
  tick();
  setInterval(tick,400);
})();
