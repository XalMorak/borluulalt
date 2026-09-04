const PRODUCT_DEFS = [
  {id:1,name:"Боргио",defaultPrice:5000},
  {id:2,name:"Нийлэл",defaultPrice:4500},
  {id:3,name:"Cass",defaultPrice:5500},
  {id:4,name:"Asahi",defaultPrice:6000},
  {id:5,name:"Калтенберг",defaultPrice:5000},
  {id:6,name:"Алтангөвь",defaultPrice:4000},
  {id:7,name:"Gem",defaultPrice:4500},
  {id:8,name:"ЕРӨӨ говь Задгай",defaultPrice:3500},
  {id:9,name:"Krush",defaultPrice:4000},
  {id:10,name:"Tsingtao",defaultPrice:5500},
  {id:11,name:"Heineken",defaultPrice:7000},
  {id:12,name:"terra",defaultPrice:5000},
  {id:14,name:"Сангур laaz",defaultPrice:3000}
];
const USERS = {
  emp001:{name:"Бат-Эрдэнэ",role:"employee"},
  emp002:{name:"Сарантуяа",role:"employee"},
  emp003:{name:"Мөнхбаатар",role:"employee"},
  sup001:{name:"Ахлах менежер",role:"supervisor"}
};
let currentUser = null;
let _sortedSubs = [];
let _editingIdx = null;

function getPrices(){
  const saved = localStorage.getItem("productPrices");
  if(saved){ try{ return JSON.parse(saved); }catch(e){} }
  const p = {};
  PRODUCT_DEFS.forEach(d => p[d.id] = d.defaultPrice);
  return p;
}
function setPrices(obj){ localStorage.setItem("productPrices", JSON.stringify(obj)); }
function getPrice(id){ return getPrices()[id] || 0; }
function getSubs(){ return JSON.parse(localStorage.getItem("submissions")||"[]"); }
function setSubs(arr){ localStorage.setItem("submissions", JSON.stringify(arr)); }
function showAlert(id,msg,type){
  const el=document.getElementById(id);
  if(!el)return;
  el.innerHTML=`<div class="alert alert-${type}">${msg}</div>`;
  if(type==="success") setTimeout(()=>{el.innerHTML=""},4000);
}
function init(){
  const s=localStorage.getItem("lastLoginId");
  if(s) document.getElementById("loginId").value=s;
  document.getElementById("formDate").valueAsDate=new Date();
  document.getElementById("loginId").addEventListener("keyup",e=>{ if(e.key==="Enter") doLogin(); });
}
function doLogin(){
  const id=document.getElementById("loginId").value.trim().toLowerCase();
  if(!USERS[id]){ showAlert("loginAlert","Буруу ID. Жишээ: emp001 эсвэл sup001","error"); return; }
  currentUser={id,...USERS[id]};
  localStorage.setItem("lastLoginId",id);
  showApp();
}
function doLogout(){
  currentUser=null; _editingIdx=null;
  document.getElementById("loginSection").classList.remove("hidden");
  document.getElementById("appSection").classList.add("hidden");
  document.getElementById("loginId").value=localStorage.getItem("lastLoginId")||"";
  document.getElementById("loginAlert").innerHTML="";
}
function showApp(){
  document.getElementById("loginSection").classList.add("hidden");
  document.getElementById("appSection").classList.remove("hidden");
  document.getElementById("userNameDisplay").textContent=currentUser.name+" ("+currentUser.id+")";
  const badge=document.getElementById("roleBadge");
  if(currentUser.role==="employee"){
    badge.textContent="Ажилтан"; badge.className="role-badge role-emp";
    document.getElementById("employeeView").classList.remove("hidden");
    document.getElementById("supervisorView").classList.add("hidden");
    document.getElementById("empName").value=currentUser.name;
    buildSalesTable();
  } else {
    badge.textContent="Ахлах"; badge.className="role-badge role-sup";
    document.getElementById("employeeView").classList.add("hidden");
    document.getElementById("supervisorView").classList.remove("hidden");
    loadSupervisorData();
  }
}
function buildSalesTable(){
  const tbody=document.getElementById("salesBody");
  tbody.innerHTML="";
  PRODUCT_DEFS.forEach(p=>{
    const price=getPrice(p.id);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.id}</td><td class="product-name">${p.name}</td><td class="price-col">${price.toLocaleString()}</td><td><input type="number" min="0" id="prev_${p.id}" value="0" oninput="calcRow(${p.id})"></td><td><input type="number" min="0" id="next_${p.id}" value="0" oninput="calcRow(${p.id})"></td><td><input type="number" min="0" id="sold_${p.id}" value="0" oninput="calcIncome(${p.id})"></td><td><input type="number" min="0" step="0.01" id="income_${p.id}" value="0"></td>`;
    tbody.appendChild(tr);
  });
}
function calcRow(id){
  const prev=Number(document.getElementById("prev_"+id).value)||0;
  const next=Number(document.getElementById("next_"+id).value)||0;
  if(document.activeElement && document.activeElement.id!=="sold_"+id){
    if(prev>0||next>0){ const sold=Math.max(0,prev-next); document.getElementById("sold_"+id).value=sold; calcIncome(id); }
  }
}
function calcIncome(id){
  const sold=Number(document.getElementById("sold_"+id).value)||0;
  document.getElementById("income_"+id).value=sold*getPrice(id);
}
function getFormData(){
  const items=PRODUCT_DEFS.map(p=>({id:p.id,name:p.name,price:getPrice(p.id),prev:Number(document.getElementById("prev_"+p.id).value)||0,next:Number(document.getElementById("next_"+p.id).value)||0,sold:Number(document.getElementById("sold_"+p.id).value)||0,income:Number(document.getElementById("income_"+p.id).value)||0}));
  return {date:document.getElementById("formDate").value,shift:document.getElementById("shiftType").value,employeeId:currentUser.id,employeeName:currentUser.name,checkerName:document.getElementById("checkerName").value,receiverName:document.getElementById("receiverName").value,items,cashAmount:Number(document.getElementById("cashAmount").value)||0,posNumber:document.getElementById("posNumber").value,cardTotal:Number(document.getElementById("cardTotal").value)||0,cashBalance:Number(document.getElementById("cashBalance").value)||0,submittedAt:new Date().toISOString()};
}
function saveSubmission(){
  const data=getFormData();
  if(!data.date){ showAlert("empAlert","Огноо сонгоно уу!","error"); return; }
  let all=getSubs();
  all=all.filter(s=>!(s.employeeId===data.employeeId && s.date===data.date && s.shift===data.shift));
  all.push(data); setSubs(all);
  showAlert("empAlert","Амжилттай хадгаллаа!","success");
}
function resetForm(){
  PRODUCT_DEFS.forEach(p=>{ document.getElementById("prev_"+p.id).value=0; document.getElementById("next_"+p.id).value=0; document.getElementById("sold_"+p.id).value=0; document.getElementById("income_"+p.id).value=0; });
  ["checkerName","receiverName","posNumber"].forEach(id=>document.getElementById(id).value="");
  ["cashAmount","cardTotal","cashBalance"].forEach(id=>document.getElementById(id).value=0);
  document.getElementById("empAlert").innerHTML="";
}
function showTab(name){
  document.getElementById("tabOverview").classList.toggle("hidden", name!=="overview");
  document.getElementById("tabSubmissions").classList.toggle("hidden", name!=="submissions");
  document.getElementById("tabPrices").classList.toggle("hidden", name!=="prices");
  document.getElementById("tabBtnOverview").classList.toggle("active", name==="overview");
  document.getElementById("tabBtnSubs").classList.toggle("active", name==="submissions");
  document.getElementById("tabBtnPrices").classList.toggle("active", name==="prices");
  if(name==="prices") buildPricesTable();
}
function loadSupervisorData(){ const all=getSubs(); renderOverview(all); renderSubmissionsList(all); }
function renderOverview(all){
  let totalSold=0, totalIncome=0; const empSet=new Set();
  all.forEach(s=>{ empSet.add(s.employeeId); s.items.forEach(it=>{ totalSold+=it.sold||0; totalIncome+=it.income||0; }); });
  document.getElementById("overallSummary").innerHTML=`<div class="summary-item"><div class="label">Илгээлтийн тоо</div><div class="value">${all.length}</div></div><div class="summary-item"><div class="label">Ажилчдын тоо</div><div class="value">${empSet.size}</div></div><div class="summary-item"><div class="label">Нийт борлуулсан</div><div class="value">${totalSold}</div></div><div class="summary-item"><div class="label">Нийт орлого</div><div class="value">${totalIncome.toLocaleString()} ₮</div></div>`;
  const totals={}; PRODUCT_DEFS.forEach(p=>totals[p.id]={name:p.name,sold:0,income:0});
  all.forEach(s=>s.items.forEach(it=>{ if(totals[it.id]){ totals[it.id].sold+=it.sold||0; totals[it.id].income+=it.income||0; } }));
  const tbody=document.getElementById("productTotalsBody"); tbody.innerHTML=""; let ts=0,ti=0;
  PRODUCT_DEFS.forEach(p=>{ const t=totals[p.id]; ts+=t.sold; ti+=t.income;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.id}</td><td class="product-name">${t.name}</td><td class="price-col">${getPrice(p.id).toLocaleString()}</td><td>${t.sold}</td><td>${t.income.toLocaleString()} ₮</td>`;
    tbody.appendChild(tr);
  });
  const trT=document.createElement("tr"); trT.style.fontWeight="700"; trT.style.background="#e8f0fe";
  trT.innerHTML=`<td colspan="3"><strong>НИЙТ</strong></td><td><strong>${ts}</strong></td><td><strong>${ti.toLocaleString()} ₮</strong></td>`;
  tbody.appendChild(trT);
}
function renderSubmissionsList(all){
  const list=document.getElementById("submissionsList");
  if(!all.length){ list.innerHTML=`<div class="alert alert-info">Одоогоор илгээлт байхгүй. Ажилчид бөглөсөн өгөгдлийг <strong>Экспорт</strong> хийж, энд <strong>Импорт</strong> хийнэ үү.</div>`; document.getElementById("selectedSubmissionDetail").classList.add("hidden"); return; }
  all=all.slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  _sortedSubs=all;
  list.innerHTML=all.map((s,idx)=>`<div class="sub-item ${ _editingIdx===idx ? 'selected' : '' }" onclick="showSubmissionDetail(${idx})"><strong>${s.employeeName}</strong> (${s.employeeId}) — ${s.date} (${s.shift||"—"})<br><small>Илгээсэн: ${new Date(s.submittedAt).toLocaleString("mn-MN")} | Борлуулсан: ${s.items.reduce((a,i)=>a+(i.sold||0),0)} ширхэг | Орлого: ${s.items.reduce((a,i)=>a+(i.income||0),0).toLocaleString()} ₮</small></div>`).join("");
}
function showSubmissionDetail(idx){ _editingIdx=null; const s=_sortedSubs[idx]; if(!s)return; document.getElementById("selectedSubmissionDetail").classList.remove("hidden"); renderDetailView(idx, false); }
function renderDetailView(idx, editing){
  const s=_sortedSubs[idx]; if(!s)return;
  _editingIdx=editing ? idx : null;
  if(!editing){
    const itemsHtml=s.items.map(it=>`<tr><td>${it.id}</td><td class="product-name">${it.name}</td><td class="price-col">${(it.price||getPrice(it.id)||0).toLocaleString()}</td><td>${it.prev}</td><td>${it.next}</td><td>${it.sold}</td><td>${(it.income||0).toLocaleString()} ₮</td></tr>`).join("");
    document.getElementById("detailContent").innerHTML=`<div class="summary-box"><p><strong>Ажилтан:</strong> ${s.employeeName} (${s.employeeId})</p><p><strong>Огноо:</strong> ${s.date} | <strong>Ээлж:</strong> ${s.shift||"—"}</p><p><strong>Шалгасан:</strong> ${s.checkerName||"—"} | <strong>Хүлээн авсан:</strong> ${s.receiverName||"—"}</p><p><strong>Бэлэн мөнгө:</strong> ${(s.cashAmount||0).toLocaleString()} ₮ | <strong>ПОС:</strong> ${s.posNumber||"—"} | <strong>Карт:</strong> ${(s.cardTotal||0).toLocaleString()} ₮ | <strong>Үлдэгдэл:</strong> ${(s.cashBalance||0).toLocaleString()} ₮</p></div><table><thead><tr><th>№</th><th>Бараа</th><th>Үнэ</th><th>Өмнөх</th><th>Дараах</th><th>Борлуулсан</th><th>Орлого</th></tr></thead><tbody>${itemsHtml}</tbody></table><div style="margin-top:16px;text-align:center"><button class="btn btn-warning" onclick="startEditSubmission(${idx})">✏️ Засварлах</button> <button class="btn btn-secondary btn-sm" onclick="deleteSubmission(${idx})">Устгах</button></div>`;
  } else {
    let rows="";
    s.items.forEach((it,i)=>{ const price=it.price||getPrice(it.id)||0;
      rows+=`<tr><td>${it.id}</td><td class="product-name">${it.name}</td><td class="price-col">${price.toLocaleString()}</td><td><input type="number" min="0" id="edit_prev_${i}" value="${it.prev||0}" oninput="editCalc(${i})"></td><td><input type="number" min="0" id="edit_next_${i}" value="${it.next||0}" oninput="editCalc(${i})"></td><td><input type="number" min="0" id="edit_sold_${i}" value="${it.sold||0}" oninput="editCalcIncome(${i})"></td><td><input type="number" min="0" step="0.01" id="edit_income_${i}" value="${it.income||0}"></td></tr>`; });
    document.getElementById("detailContent").innerHTML=`<div class="edit-panel"><h3 style="margin-bottom:12px">✏️ Засварлах горим</h3><div class="header-info" style="margin-bottom:12px"><div><label>Огноо</label><input type="date" id="edit_date" value="${s.date||""}"></div><div><label>Ээлж</label><select id="edit_shift"><option value="өглөө" ${s.shift==="өглөө"?"selected":""}>Өглөө</option><option value="орой" ${s.shift==="орой"?"selected":""}>Орой</option></select></div><div><label>Шалгасан</label><input type="text" id="edit_checker" value="${s.checkerName||""}"></div><div><label>Хүлээн авсан</label><input type="text" id="edit_receiver" value="${s.receiverName||""}"></div></div><table><thead><tr><th>№</th><th>Бараа</th><th>Үнэ</th><th>Өмнөх</th><th>Дараах</th><th>Борлуулсан</th><th>Орлого</th></tr></thead><tbody>${rows}</tbody></table><div class="footer-fields"><div><label>Бэлэн мөнгө</label><input type="number" id="edit_cash" min="0" step="0.01" value="${s.cashAmount||0}"></div><div><label>ПОС дугаар</label><input type="text" id="edit_pos" value="${s.posNumber||""}"></div><div><label>Картын нэгтгэл</label><input type="number" id="edit_card" min="0" step="0.01" value="${s.cardTotal||0}"></div><div><label>Бэлэн мөнгөний үлдэгдэл</label><input type="number" id="edit_balance" min="0" step="0.01" value="${s.cashBalance||0}"></div></div><div style="margin-top:16px;text-align:center"><button class="btn btn-success" onclick="saveEditSubmission(${idx})">💾 Хадгалах</button> <button class="btn btn-secondary" onclick="cancelEdit(${idx})">Болих</button></div><div id="editAlert"></div></div>`;
  }
  renderSubmissionsList(getSubs().slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt)));
}
function startEditSubmission(idx){ renderDetailView(idx, true); }
function cancelEdit(idx){ renderDetailView(idx, false); }
function editCalc(i){
  const prev=Number(document.getElementById("edit_prev_"+i).value)||0;
  const next=Number(document.getElementById("edit_next_"+i).value)||0;
  if(document.activeElement && !document.activeElement.id.startsWith("edit_sold_")){
    const sold=Math.max(0,prev-next); document.getElementById("edit_sold_"+i).value=sold; editCalcIncome(i);
  }
}
function editCalcIncome(i){
  const s=_sortedSubs[_editingIdx]; if(!s)return;
  const sold=Number(document.getElementById("edit_sold_"+i).value)||0;
  const price=s.items[i].price||getPrice(s.items[i].id)||0;
  document.getElementById("edit_income_"+i).value=sold*price;
}
function saveEditSubmission(idx){
  const s=_sortedSubs[idx]; if(!s)return;
  const items=s.items.map((it,i)=>({...it,prev:Number(document.getElementById("edit_prev_"+i).value)||0,next:Number(document.getElementById("edit_next_"+i).value)||0,sold:Number(document.getElementById("edit_sold_"+i).value)||0,income:Number(document.getElementById("edit_income_"+i).value)||0}));
  const updated={...s,date:document.getElementById("edit_date").value||s.date,shift:document.getElementById("edit_shift").value||s.shift,checkerName:document.getElementById("edit_checker").value,receiverName:document.getElementById("edit_receiver").value,items,cashAmount:Number(document.getElementById("edit_cash").value)||0,posNumber:document.getElementById("edit_pos").value,cardTotal:Number(document.getElementById("edit_card").value)||0,cashBalance:Number(document.getElementById("edit_balance").value)||0,submittedAt:new Date().toISOString(),editedBy:currentUser.id,editedAt:new Date().toISOString()};
  let all=getSubs();
  all=all.map(sub=>{ if(sub.employeeId===s.employeeId && sub.date===s.date && (sub.shift||"")===(s.shift||"")) return updated; return sub; });
  setSubs(all);
  _sortedSubs=all.slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));
  const newIdx=_sortedSubs.findIndex(x=>x.employeeId===updated.employeeId && x.date===updated.date && (x.shift||"")===(updated.shift||""));
  showAlert("editAlert","Амжилттай засагдлаа!","success");
  setTimeout(()=>{ loadSupervisorData(); if(newIdx>=0) showSubmissionDetail(newIdx); }, 600);
}
function deleteSubmission(idx){
  const s=_sortedSubs[idx]; if(!s)return;
  if(!confirm(`${s.employeeName} — ${s.date} (${s.shift||""}) илгээлтийг устгах уу?`)) return;
  let all=getSubs();
  all=all.filter(sub=>!(sub.employeeId===s.employeeId && sub.date===s.date && (sub.shift||"")===(s.shift||"")));
  setSubs(all);
  document.getElementById("selectedSubmissionDetail").classList.add("hidden");
  loadSupervisorData();
}
function buildPricesTable(){
  const prices=getPrices();
  const tbody=document.getElementById("pricesBody"); tbody.innerHTML="";
  PRODUCT_DEFS.forEach(p=>{ const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.id}</td><td class="product-name">${p.name}</td><td><input type="number" min="0" step="100" id="price_${p.id}" value="${prices[p.id]||p.defaultPrice}" style="width:120px"></td>`;
    tbody.appendChild(tr); });
}
function savePrices(){
  const p={}; PRODUCT_DEFS.forEach(d=>{ p[d.id]=Number(document.getElementById("price_"+d.id).value)||0; });
  setPrices(p); showAlert("priceAlert","Үнэ амжилттай хадгалагдлаа!","success");
}
function resetDefaultPrices(){
  const p={}; PRODUCT_DEFS.forEach(d=>p[d.id]=d.defaultPrice);
  setPrices(p); buildPricesTable(); showAlert("priceAlert","Анхны үнэ руу буцаалаа.","success");
}
function exportData(){
  const data={exportedAt:new Date().toISOString(),productPrices:getPrices(),submissions:getSubs()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="borluulalt-"+new Date().toISOString().slice(0,10)+".json"; a.click(); URL.revokeObjectURL(a.href);
}
function importData(ev){
  const file=ev.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{ try{
    const data=JSON.parse(reader.result);
    if(data.productPrices) setPrices(data.productPrices);
    const incoming=data.submissions||data;
    if(!Array.isArray(incoming)) throw new Error("Буруу формат");
    let all=getSubs();
    incoming.forEach(inc=>{ all=all.filter(s=>!(s.employeeId===inc.employeeId && s.date===inc.date && (s.shift||"")===(inc.shift||""))); all.push(inc); });
    setSubs(all);
    if(currentUser && currentUser.role==="supervisor") loadSupervisorData();
    alert("Импорт амжилттай! "+incoming.length+" илгээлт нэмэгдлээ.");
  }catch(e){ alert("Импорт амжилтгүй: "+e.message); } };
  reader.readAsText(file); ev.target.value="";
}
init();
