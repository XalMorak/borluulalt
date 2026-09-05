function fillSyncForm(){}
async function saveSyncSettings(){}
async function manualPull(){await cloudPull();if(typeof loadSupervisorData==="function")loadSupervisorData()}
async function manualPush(){await cloudPush()}
function clearSyncSettings(){}
function initReportFilters(){
  const emps=document.getElementById("reportEmp");
  if(!emps)return;
  const users=getUsers();
  emps.innerHTML="<option value=\"\">Бүгд</option>"+Object.keys(users).filter(id=>users[id].role==="employee").map(id=>`<option value="${id}">${users[id].name}</option>`).join("");
  const locs=document.getElementById("reportLoc");
  if(locs){
    const set=new Set(getSubs().map(s=>s.location).filter(Boolean));
    locs.innerHTML="<option value=\"\">Бүгд</option>"+[...set].map(l=>`<option value="${l}">${l}</option>`).join("");
  }
}
function runReport(){
  const from=(document.getElementById("reportFrom")||{}).value||"";
  const to=(document.getElementById("reportTo")||{}).value||"";
  const emp=(document.getElementById("reportEmp")||{}).value||"";
  const loc=(document.getElementById("reportLoc")||{}).value||"";
  let all=getSubs().slice();
  if(from)all=all.filter(s=>s.date>=from);
  if(to)all=all.filter(s=>s.date<=to);
  if(emp)all=all.filter(s=>s.employeeId===emp);
  if(loc)all=all.filter(s=>s.location===loc);
  _reportRows=all;
  let totalIncome=0,totalDiff=0;
  all.forEach(s=>{
    totalIncome+=(s.calcTotal!=null?s.calcTotal:0);
    totalDiff+=(s.diff!=null?s.diff:0);
  });
  const sum=document.getElementById("reportSummary");
  if(sum)sum.innerHTML=`<div class="summary-item"><div class="label">Илгээлт</div><div class="value">${all.length}</div></div><div class="summary-item"><div class="label">Орлого</div><div class="value">${totalIncome.toLocaleString()}₮</div></div><div class="summary-item"><div class="label">Зөрүү</div><div class="value">${totalDiff.toLocaleString()}</div></div>`;
  const tbody=document.getElementById("reportBody");
  if(!tbody)return;
  tbody.innerHTML=all.map(s=>{
    const income=s.calcTotal!=null?s.calcTotal:0;
    const diff=s.diff!=null?s.diff:0;
    const cls=Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short");
    return `<tr><td>${s.date}</td><td>${s.employeeName}</td><td>${s.shift||"—"}</td><td>${s.location||"—"}</td><td>${income.toLocaleString()}₮</td><td class="${cls}">${diff.toLocaleString()}</td></tr>`;
  }).join("")||"<tr><td colspan=\"6\">Хоосон</td></tr>";
}
function buildLogTable(){
  const logs=getLogs().slice().reverse();
  const tbody=document.getElementById("logBody");
  if(!tbody)return;
  tbody.innerHTML=logs.map(l=>`<tr><td>${new Date(l.at).toLocaleString("mn-MN")}</td><td>${l.user}</td><td>${l.action}</td><td>${l.detail||""}</td></tr>`).join("")||"<tr><td colspan=\"4\">Хоосон</td></tr>";
}
function exportCSV(){
  const rows=(_reportRows&&_reportRows.length)?_reportRows:getSubs();
  let csv="Огноо,Ажилтан,Ээлж,Байршил,Орлого,Зөрүү\n";
  rows.forEach(s=>{
    const calc=s.calcTotal!=null?s.calcTotal:0;
    const diff=s.diff!=null?s.diff:0;
    csv+=`${s.date},${s.employeeName},${s.shift||""},${s.location||""},${calc},${diff}\n`;
  });
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="borluulalt_report.csv";
  a.click();
}
function printReport(){window.print()}
