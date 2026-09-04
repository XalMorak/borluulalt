function fillSyncForm(){
  const c=getSyncCfg();
  document.getElementById("pantryIdInput").value=c.pantryId||"";
  document.getElementById("syncStatusText").innerHTML=syncEnabled()
    ?`<span class="diff-ok">✓ Синктэй</span> · <code>${c.pantryId}</code>`
    :`<span class="diff-short">Синк унтраалттай</span>`;
  updateSyncBadge(syncEnabled()?"ok":undefined);
}
async function saveSyncSettings(){
  let id=document.getElementById("pantryIdInput").value.trim().replace(/^["']|["']$/g,"");
  if(!id||id.length<10){showAlert("syncAlert","Зөв Pantry ID оруулна уу (getpantry.cloud)","error");return}
  setSyncCfg({pantryId:id});document.getElementById("pantryIdInput").value=id;
  showAlert("syncAlert","Холбож байна...","info");
  const pushed=await cloudPush();
  if(pushed){showAlert("syncAlert","☁️ Синк амжилттай!","success");await cloudPull();loadSupervisorData()}
  else showAlert("syncAlert","Алдаа: "+(window._lastSyncError||""),"error");
  fillSyncForm();
}
async function manualPull(){
  if(!syncEnabled()){showAlert("syncAlert","Эхлээд Pantry ID","error");return}
  const ok=await cloudPull();
  showAlert("syncAlert",ok?"☁️ Татлаа":("Алдаа: "+(window._lastSyncError||"")),ok?"success":"error");
  if(ok)loadSupervisorData();
}
async function manualPush(){
  if(!syncEnabled()){showAlert("syncAlert","Эхлээд Pantry ID","error");return}
  const ok=await cloudPush();
  showAlert("syncAlert",ok?"☁️ Илгээлээ":("Алдаа: "+(window._lastSyncError||"")),ok?"success":"error");
}
function clearSyncSettings(){
  if(!confirm("Синк унтраах уу?"))return;
  setSyncCfg({});fillSyncForm();showAlert("syncAlert","Унтарлаа","info");
}
function initReportFilters(){
  const from=document.getElementById("repFrom"),to=document.getElementById("repTo");
  if(from&&!from.value){const d=new Date();d.setDate(1);from.valueAsDate=d}
  if(to&&!to.value)to.valueAsDate=new Date();
  const sel=document.getElementById("repEmp");
  if(sel){
    const ids=new Set(getSubs().map(s=>s.employeeId));
    const cur=sel.value;
    sel.innerHTML=`<option value="">Бүгд</option>`+Array.from(ids).map(id=>{
      const u=getUser(id);return `<option value="${id}">${u?u.name:id} (${id})</option>`;
    }).join("");
    sel.value=cur;
  }
  runReport();
}
function runReport(){
  const from=document.getElementById("repFrom").value;
  const to=document.getElementById("repTo").value;
  const emp=document.getElementById("repEmp").value;
  const loc=(document.getElementById("repLoc").value||"").trim().toLowerCase();
  let rows=getSubs().filter(s=>{
    if(from&&s.date<from)return false;
    if(to&&s.date>to)return false;
    if(emp&&s.employeeId!==emp)return false;
    if(loc&&!(s.location||"").toLowerCase().includes(loc))return false;
    return true;
  }).sort((a,b)=>a.date.localeCompare(b.date)||(a.shift||"").localeCompare(b.shift||""));
  _reportRows=rows;
  let income=0,diff=0,sold=0;
  rows.forEach(s=>{
    const c=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce((a,i)=>a+(i.income||0),0);
    income+=c;diff+=(s.diff!=null?s.diff:0);
    (s.items||[]).forEach(it=>sold+=(it.sold||0));
  });
  document.getElementById("reportSummary").innerHTML=`
    <div class="summary-item"><div class="label">Бичлэг</div><div class="value">${rows.length}</div></div>
    <div class="summary-item"><div class="label">Борлуулсан</div><div class="value">${sold}</div></div>
    <div class="summary-item"><div class="label">Орлого</div><div class="value">${income.toLocaleString()}₮</div></div>
    <div class="summary-item"><div class="label">Зөрүү</div><div class="value ${diff>=0?"diff-over":"diff-short"}">${(diff>=0?"+":"")+diff.toLocaleString()}</div></div>`;
  const tbody=document.getElementById("reportBody");
  tbody.innerHTML=rows.map(s=>{
    const c=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce((a,i)=>a+(i.income||0),0);
    const d=s.diff!=null?s.diff:0;
    return `<tr><td>${s.date}</td><td>${s.shift||"—"}</td><td>${s.employeeName}</td><td>${s.location||"—"}</td>
      <td>${c.toLocaleString()}</td><td class="${Math.abs(d)<0.01?"diff-ok":(d>0?"diff-over":"diff-short")}">${(d>=0?"+":"")+d.toLocaleString()}</td>
      <td>${s.locked?"🔒":"—"}</td></tr>`;
  }).join("")||`<tr><td colspan="7">Өгөгдөл олдсонгүй</td></tr>`;
}
function buildLogTable(){
  const logs=getLogs().slice().reverse();
  const el=document.getElementById("logList");
  if(!logs.length){el.innerHTML=`<div class="alert alert-info">Лог хоосон</div>`;return}
  el.innerHTML=logs.map(l=>`<div class="log-item"><time>${new Date(l.at).toLocaleString("mn-MN")}</time>
    · <code>${l.user}</code> · <strong>${l.action}</strong> ${l.detail||""}</div>`).join("");
}
function clearLogs(){
  if(!confirm("Лог цэвэрлэх уу?"))return;
  setLogs([]);buildLogTable();afterLocalWrite();
}
function printEmployeeForm(){window.print()}
function printSubmission(idx){
  const s=_sortedSubs[idx];if(!s)return;
  showSubmissionDetail(idx);
  setTimeout(()=>window.print(),200);
}
function printReport(which){
  if(which==="reports")showTab("reports");
  else showTab("overview");
  setTimeout(()=>window.print(),200);
}
function downloadBlob(filename,text,mime){
  const blob=new Blob([text],{type:mime||"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}
function exportCSV(){
  const rows=[["Огноо","Ээлж","Ажилтан","ID","Салбар","Орлого","Бэлэн","Карт","Зөрүү","Төлөв"]];
  getSubs().forEach(s=>{
    const c=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce((a,i)=>a+(i.income||0),0);
    rows.push([s.date,s.shift||"",s.employeeName,s.employeeId,s.location||"",c,s.cashAmount||0,s.cardTotal||0,s.diff!=null?s.diff:"",s.locked?"хаагдсан":""]);
  });
  const csv="\uFEFF"+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob("borluulalt-"+new Date().toISOString().slice(0,10)+".csv",csv);
  addLog("export_csv","бүх илгээлт");
}
function exportReportCSV(){
  if(!_reportRows.length){alert("Эхлээд тайлан хайна уу");return}
  const rows=[["Огноо","Ээлж","Ажилтан","Салбар","Орлого","Зөрүү"]];
  _reportRows.forEach(s=>{
    const c=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce((a,i)=>a+(i.income||0),0);
    rows.push([s.date,s.shift||"",s.employeeName,s.location||"",c,s.diff!=null?s.diff:0]);
  });
  const csv="\uFEFF"+rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  downloadBlob("тайлан-"+new Date().toISOString().slice(0,10)+".csv",csv);
}
function exportData(){
  const data={exportedAt:new Date().toISOString(),...packAll()};
  downloadBlob("borluulalt-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(data,null,2),"application/json");
}
async function importData(ev){
  const file=ev.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      const data=JSON.parse(reader.result);applyAll(data);await afterLocalWrite();
      if(currentUser&&currentUser.role==="supervisor")loadSupervisorData();
      updateLoginHint();alert("Импорт амжилттай");
    }catch(e){alert("Алдаа: "+e.message)}
  };
  reader.readAsText(file);ev.target.value="";
}
init();
