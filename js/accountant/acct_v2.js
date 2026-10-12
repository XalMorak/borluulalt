/* acct_v2.js — Нягтлан: самбар, задаргаа, хүснэгтийн хэрэгсэл.
   - Хугацаа: Өнөөдөр / Энэ 7 хоног / Энэ сар / Бүгд (ростер, өөр огноо — доорх шүүлтээр)
   - KPI: нийт борлуулалт, бэлэн, карт, илүү, дутуу, цэвэр, илгээлт, төлөгдөөгүй дутуу
   - Задаргаа: байршлаар, өдрөөр (баганан график)
   - Илгээлтийн хүснэгт: хайлт, багана дарж эрэмбэлэх, хуудаслалт, наалттай толгой,
     дутууг тодруулах, зөвхөн төлөгдөөгүй, харагдаж буй дутууг нэг дор төлсөн болгох
   - Хураангуй CSV (KPI + ажилтан + байршил + өдөр), хэвлэх
   Өгөгдлийн бүтэц өөрчлөгдөхгүй: төлөлт нь хуучин шигээ borluulalt/payments/<key> = {paid, amount, at, by}.
   accountant.js-ийн "acct:rendered" үйл явдал дээр зурна — таймер байхгүй. */
(function(){
  if(window._acctV2) return; window._acctV2=true;
  var A=function(){ return window._acct; };
  var st={ q:"", unpaid:false, sort:null, dir:-1, page:0, size:50 };
  var DAY_MS=864e5;

  function el(tag, attrs, html){ var e=document.createElement(tag); for(var k in attrs||{}) e.setAttribute(k, attrs[k]); if(html!=null) e.innerHTML=html; return e; }
  function $(id){ return document.getElementById(id); }

  /* ---------- period ---------- */
  function period(kind){
    var a=A(), t=a.today(), d=new Date(t+"T00:00:00");
    if(kind==="today") return [t, t];
    if(kind==="week"){ var wd=(d.getDay()+6)%7; return [a.addDays(t, -wd), t]; }
    if(kind==="month") return [t.slice(0,8)+"01", t];
    return ["", ""];
  }
  function setPeriod(kind){
    var p=period(kind);
    $("acctFrom").value=p[0]; $("acctTo").value=p[1];
    if(kind!=="custom") $("acctRoster").value="";
    st.page=0; markPeriod(kind);
    window.renderAccountant();
  }
  function markPeriod(kind){
    document.querySelectorAll("#acctPeriod button").forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-period")===kind); });
  }
  function guessPeriod(){
    var f=$("acctFrom").value, t=$("acctTo").value;
    if($("acctRoster").value) return "roster";
    var ks=["today","week","month","all"];
    for(var i=0;i<ks.length;i++){ var p=period(ks[i]); if(p[0]===f && p[1]===t) return ks[i]; }
    return "custom";
  }

  /* ---------- mount (once) ---------- */
  function mount(){
    var pane=$("acctPaneSubs");
    if(!pane || $("acctPeriod")) return !!pane;
    var filters=pane.querySelector(".header-info");
    var bar=el("div", { id:"acctPeriod", "class":"acct-period no-print" },
      '<span class="acct-period-label">Хугацаа:</span>'
      +'<button type="button" class="btn btn-outline btn-sm" data-period="today">Өнөөдөр</button>'
      +'<button type="button" class="btn btn-outline btn-sm" data-period="week">Энэ 7 хоног</button>'
      +'<button type="button" class="btn btn-outline btn-sm" data-period="month">Энэ сар</button>'
      +'<button type="button" class="btn btn-outline btn-sm" data-period="all">Бүгд</button>'
      +'<span class="acct-period-hint">Ростер эсвэл өөр огноо — доорх шүүлтээр</span>');
    pane.insertBefore(bar, filters);
    bar.addEventListener("click", function(ev){ var b=ev.target.closest("button[data-period]"); if(b) setPeriod(b.getAttribute("data-period")); });

    var sum=$("acctSummary");
    var kpi=el("div", { id:"acctKpi", "class":"acct-kpi" });
    sum.parentNode.insertBefore(kpi, sum);
    sum.classList.add("acct-summary-old");
    var br=el("div", { id:"acctBreakdown", "class":"acct-breakdown" },
      '<div class="acct-break-card"><h4>Байршлаар</h4><div class="table-wrap"><table class="acct-mini"><thead><tr><th>Байршил</th><th>Илгээлт</th><th>Борлуулалт</th><th>Бэлэн</th><th>Карт</th><th>Зөрүү</th></tr></thead><tbody id="acctByLoc"></tbody></table></div></div>'
      +'<div class="acct-break-card"><h4>Өдрөөр</h4><div id="acctByDay" class="acct-bars"></div></div>');
    sum.parentNode.insertBefore(br, sum.nextSibling);

    var body=$("acctBody"), wrap=body.closest(".table-wrap");
    wrap.classList.add("acct-table-wrap");
    var tools=el("div", { id:"acctTools", "class":"acct-tools no-print" },
      '<input type="search" id="acctSearch" placeholder="Хайх: ажилтан, байршил, тек, огноо…">'
      +'<label class="acct-chk"><input type="checkbox" id="acctUnpaid"> Зөвхөн төлөгдөөгүй дутуу</label>'
      +'<button type="button" class="btn btn-sm btn-success" id="acctBulkPay">Харагдаж буй дутууг төлсөн болгох</button>'
      +'<button type="button" class="btn btn-outline btn-sm" id="acctSummaryCsv">Хураангуй CSV</button>'
      +'<button type="button" class="btn btn-outline btn-sm" id="acctPrint">Хэвлэх</button>'
      +'<span id="acctCount" class="acct-count"></span>');
    wrap.parentNode.insertBefore(tools, wrap);
    var pager=el("div", { id:"acctPager", "class":"acct-pager no-print" });
    wrap.parentNode.insertBefore(pager, wrap.nextSibling);

    $("acctSearch").addEventListener("input", function(){ st.q=this.value.trim().toLowerCase(); st.page=0; applyTable(); });
    $("acctUnpaid").addEventListener("change", function(){ st.unpaid=this.checked; st.page=0; applyTable(); });
    $("acctBulkPay").addEventListener("click", bulkPay);
    $("acctSummaryCsv").addEventListener("click", exportSummary);
    $("acctPrint").addEventListener("click", function(){ window.print(); });
    pager.addEventListener("click", function(ev){ var b=ev.target.closest("button[data-pg]"); if(!b) return; st.page=Number(b.getAttribute("data-pg")); applyTable(); });
    wrap.querySelector("thead").addEventListener("click", function(ev){
      var th=ev.target.closest("th"); if(!th) return;
      var i=[].indexOf.call(th.parentNode.children, th);
      if(!SORTS[i]) return;
      if(st.sort===i) st.dir=-st.dir; else { st.sort=i; st.dir=(i<=5?1:-1); }
      st.page=0; applyTable();
    });
    return true;
  }

  /* ---------- table: sort / search / unpaid / pages ---------- */
  var SORTS={
    0:function(s){ return String(s.date||"")+String(s.submittedAt||""); },
    1:function(s){ return String(s.shift||""); },
    2:function(s){ return String(s.employeeName||s.employeeId||""); },
    3:function(s){ return String(s.location||""); },
    4:function(s){ return A().tekOf(s); },
    5:function(s){ return A().kindOf(s); },
    6:function(s){ return A().calcOf(s); },
    7:function(s){ return A().collectedOf(s); },
    8:function(s){ return A().diffOf(s); }
  };
  function paidOf(s){ var p=A().pays()[A().keySafe(s)]; return !!(p && p.paid); }
  function text(s){ var a=A(); return [s.date,s.shift,s.employeeName,s.employeeId,s.location,a.tekOf(s),(a.kindOf(s)==="wine"?"вино":(a.kindOf(s)==="vip"?"vip нэгдсэн пиво вино":"пиво"))].join(" ").toLowerCase(); }

  function applyTable(){
    var a=A(), rows=a.rows(), body=$("acctBody");
    if(!body) return;
    var trs=[].slice.call(body.querySelectorAll("tr[data-i]"));
    var items=trs.map(function(tr){ var s=rows[Number(tr.getAttribute("data-i"))]; return { tr:tr, s:s }; }).filter(function(x){ return x.s; });
    items.forEach(function(x){
      var d=a.diffOf(x.s), pd=paidOf(x.s);
      x.tr.classList.toggle("acct-row-short", d<=-0.01 && !pd);
      x.tr.classList.toggle("acct-row-paid", d<=-0.01 && pd);
      var p=a.pays()[a.keySafe(x.s)];
      if(p && p.at) x.tr.title="Төлөлт: "+(p.paid?"төлсөн":"төлөөгүй")+" · "+a.num(p.amount).toLocaleString()+"₮ · "+new Date(p.at).toLocaleString("mn-MN")+(p.by?" · "+p.by:"");
    });
    if(st.sort!=null){
      var key=SORTS[st.sort];
      items.sort(function(x,y){ var p=key(x.s), q=key(y.s); return (p<q?-1:p>q?1:0)*st.dir; });
      items.forEach(function(x){ body.appendChild(x.tr); });
    }
    var vis=items.filter(function(x){
      if(st.q && text(x.s).indexOf(st.q)<0) return false;
      if(st.unpaid && !(a.diffOf(x.s)<=-0.01 && !paidOf(x.s))) return false;
      return true;
    });
    var pages=Math.max(1, Math.ceil(vis.length/st.size));
    if(st.page>=pages) st.page=pages-1;
    var from=st.page*st.size, to=from+st.size, show={};
    vis.slice(from, to).forEach(function(x){ show[x.tr.getAttribute("data-i")]=1; });
    items.forEach(function(x){ x.tr.style.display=show[x.tr.getAttribute("data-i")]?"":"none"; });
    window._acctVisible=vis.map(function(x){ return x.s; });

    var ths=body.closest("table").querySelectorAll("thead th");
    [].forEach.call(ths, function(th, i){
      th.classList.toggle("acct-sortable", !!SORTS[i]);
      th.setAttribute("data-sort", st.sort===i?(st.dir>0?"asc":"desc"):"");
    });
    var unpaid=vis.filter(function(x){ return a.diffOf(x.s)<=-0.01 && !paidOf(x.s); });
    $("acctCount").textContent=vis.length+" / "+items.length+" мөр";
    var bp=$("acctBulkPay"); bp.disabled=!unpaid.length; bp.textContent="Харагдаж буй дутууг төлсөн болгох ("+unpaid.length+")";
    var pg=$("acctPager"), h="";
    if(pages>1){
      h+='<button type="button" class="btn btn-sm" data-pg="'+Math.max(0,st.page-1)+'"'+(st.page?'':' disabled')+'>‹</button>';
      h+='<span>'+(st.page+1)+' / '+pages+'</span>';
      h+='<button type="button" class="btn btn-sm" data-pg="'+Math.min(pages-1,st.page+1)+'"'+(st.page<pages-1?'':' disabled')+'>›</button>';
    }
    pg.innerHTML=h;
  }

  /* ---------- KPI + breakdowns (over the filtered rows) ---------- */
  function totals(rows){
    var a=A(), t={ n:rows.length, calc:0, cash:0, card:0, col:0, over:0, short:0, unpaid:0, nUnpaid:0 };
    rows.forEach(function(s){
      var d=a.diffOf(s), cash=Math.max(0, a.num(s.cashAmount)-a.num(s.cashBalance));
      t.calc+=a.calcOf(s); t.col+=a.collectedOf(s); t.cash+=cash; t.card+=a.num(s.cardTotal);
      if(d<0){ t.short+=d; if(!paidOf(s)){ t.unpaid+=-d; t.nUnpaid++; } } else t.over+=d;
    });
    return t;
  }
  function drawKpi(){
    var a=A(), t=totals(a.rows()), m=a.money, sg=a.signed;
    function card(id, label, val, cls, sub){ return '<div class="acct-kpi-card '+(cls||"")+'" id="'+id+'"><div class="k">'+label+'</div><div class="v">'+val+'</div>'+(sub?'<div class="s">'+sub+'</div>':'')+'</div>'; }
    $("acctKpi").innerHTML=
      card("kpiSales","Нийт борлуулалт",m(t.calc))
      +card("kpiCash","Бэлэн",m(t.cash),"","эхлэл дүнг хассан")
      +card("kpiCard","Карт",m(t.card))
      +card("kpiOver","Илүү",sg(t.over),"diff-over")
      +card("kpiShort","Дутуу",sg(t.short),"diff-short")
      +card("kpiNet","Цэвэр",sg(t.over+t.short),a.diffCls(t.over+t.short))
      +card("kpiCount","Илгээлт",String(t.n))
      +card("kpiUnpaid","Төлөгдөөгүй дутуу",m(t.unpaid),t.unpaid>0?"acct-kpi-warn":"",t.nUnpaid+" илгээлт");
  }
  function groupBy(rows, keyFn){
    var g={};
    rows.forEach(function(s){ var k=keyFn(s)||"—"; (g[k]=g[k]||[]).push(s); });
    return g;
  }
  function drawBreakdown(){
    var a=A(), rows=a.rows(), m=a.money;
    var byLoc=groupBy(rows, function(s){ return s.location; });
    $("acctByLoc").innerHTML=Object.keys(byLoc).sort().map(function(k){
      var t=totals(byLoc[k]), d=t.over+t.short;
      return '<tr><td style="text-align:left">'+a.esc(k)+'</td><td>'+t.n+'</td><td>'+m(t.calc)+'</td><td>'+m(t.cash)+'</td><td>'+m(t.card)+'</td><td class="'+a.diffCls(d)+'">'+a.signed(d)+'</td></tr>';
    }).join("")||'<tr><td colspan="6">—</td></tr>';
    var byDay=groupBy(rows, function(s){ return s.date; });
    var days=Object.keys(byDay).sort().slice(-31);
    var max=1; var vals=days.map(function(d){ var t=totals(byDay[d]); if(t.calc>max) max=t.calc; return t; });
    $("acctByDay").innerHTML=days.length? days.map(function(d,i){
      var t=vals[i], h=Math.max(2, Math.round(t.calc/max*100)), net=t.over+t.short;
      return '<div class="acct-bar" title="'+d+' · '+m(t.calc)+' · зөрүү '+a.signed(net)+'"><div class="acct-bar-fill'+(net<0?' short':'')+'" style="height:'+h+'%"></div><div class="acct-bar-l">'+d.slice(5)+'</div></div>';
    }).join("") : '<div class="acct-empty">—</div>';
  }

  /* ---------- bulk pay (same record shape as savePayment) ---------- */
  async function bulkPay(){
    var a=A(), list=(window._acctVisible||[]).filter(function(s){ return a.diffOf(s)<=-0.01 && !paidOf(s); });
    if(!list.length) return;
    var sum=list.reduce(function(x,s){ return x-a.diffOf(s); },0);
    if(!confirm(list.length+" илгээлтийн дутуу ("+a.money(sum)+")-г төлсөн болгох уу?")) return;
    var base=await a.authed();
    if(!base){ if(typeof showAlert==="function") showAlert("acctAlert","Сервер алга","error"); return; }
    var by=a.me().id||"", at=new Date().toISOString(), ok=0;
    for(var i=0;i<list.length;i++){
      var s=list[i], k=a.keySafe(s), prev=a.pays()[k]||{};
      var rec={ paid:true, amount:prev.amount!=null&&a.num(prev.amount)>0?a.num(prev.amount):Math.abs(Math.round(a.diffOf(s))), at:at, by:by };
      try{ await base.ref("borluulalt/payments/"+k).set(rec); a.setPay(k, rec); ok++; }catch(e){}
    }
    if(typeof showAlert==="function") showAlert("acctAlert", ok+" / "+list.length+" төлөлт хадгаллаа", ok===list.length?"success":"error");
    window.renderAccountant();
  }

  /* ---------- summary CSV ---------- */
  function exportSummary(){
    var a=A(), rows=a.rows(), t=totals(rows);
    function q(v){ v=String(v==null?"":v); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }
    var out=[];
    function line(arr){ out.push(arr.map(q).join(",")); }
    var f=$("acctFrom").value, to=$("acctTo").value, rs=$("acctRoster");
    line(["Нягтлангийн хураангуй", rs&&rs.value?rs.options[rs.selectedIndex].text:((f||"…")+" — "+(to||"…"))]);
    line(["Үүсгэсэн", new Date().toLocaleString("mn-MN")]);
    line([]);
    line(["Нийт борлуулалт","Бэлэн","Карт","Илүү","Дутуу","Цэвэр","Илгээлт","Төлөгдөөгүй дутуу"]);
    line([Math.round(t.calc),Math.round(t.cash),Math.round(t.card),Math.round(t.over),Math.round(t.short),Math.round(t.over+t.short),t.n,Math.round(t.unpaid)]);
    function section(title, g){
      line([]); line([title]);
      line(["Нэр","Илгээлт","Борлуулалт","Бэлэн","Карт","Илүү","Дутуу","Цэвэр","Төлөгдөөгүй"]);
      Object.keys(g).sort().forEach(function(k){ var x=totals(g[k]); line([k,x.n,Math.round(x.calc),Math.round(x.cash),Math.round(x.card),Math.round(x.over),Math.round(x.short),Math.round(x.over+x.short),Math.round(x.unpaid)]); });
    }
    section("Ажилтнаар", groupBy(rows, function(s){ return s.employeeName||s.employeeId; }));
    section("Байршлаар", groupBy(rows, function(s){ return s.location; }));
    section("Өдрөөр", groupBy(rows, function(s){ return s.date; }));
    var blob=new Blob(["\uFEFF"+out.join("\n")+"\n"],{type:"text/csv;charset=utf-8;"});
    var link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="borluulalt_huraangui_"+a.today()+".csv";
    link.click();
  }

  document.addEventListener("acct:rendered", function(){
    if(!A() || !mount()) return;
    markPeriod(guessPeriod());
    drawKpi(); drawBreakdown(); applyTable();
  });
})();
