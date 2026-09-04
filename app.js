const DEFAULT_PRODUCTS=[{id:1,name:"Боргио",price:5000,stock:0},{id:2,name:"Нийлэл",price:4500,stock:0},{id:3,name:"Cass",price:5500,stock:0},{id:4,name:"Asahi",price:6000,stock:0},{id:5,name:"Калтенберг",price:5000,stock:0},{id:6,name:"Алтангөвь",price:4000,stock:0},{id:7,name:"Gem",price:4500,stock:0},{id:8,name:"ЕРӨӨ говь Задгай",price:3500,stock:0},{id:9,name:"Krush",price:4000,stock:0},{id:10,name:"Tsingtao",price:5500,stock:0},{id:11,name:"Heineken",price:7000,stock:0},{id:12,name:"terra",price:5000,stock:0},{id:14,name:"Сангур laaz",price:3000,stock:0}];
const DEFAULT_USERS={emp001:{name:"Бат-Эрдэнэ",role:"employee",pin:""},emp002:{name:"Сарантуяа",role:"employee",pin:""},emp003:{name:"Мөнхбаатар",role:"employee",pin:""},sup001:{name:"Ахлах менежер",role:"supervisor",pin:""}};
const LOW_STOCK=10,STORAGE_KEY="borluulalt_products_v2",USERS_KEY="borluulalt_users_v1",LOG_KEY="borluulalt_logs_v1";
let currentUser=null,_sortedSubs=[],_editingIdx=null,_syncBusy=false,_lastCloudAt=null,_reportRows=[];
function getUsers(){const s=localStorage.getItem(USERS_KEY);if(s){try{const u=JSON.parse(s);if(u&&typeof u==="object"&&Object.keys(u).length)return u}catch(e){}}return JSON.parse(JSON.stringify(DEFAULT_USERS))}
function setUsers(obj){localStorage.setItem(USERS_KEY,JSON.stringify(obj))}
function getUser(id){return getUsers()[String(id).toLowerCase()]||null}
function getProducts(){let s=localStorage.getItem(STORAGE_KEY);if(s){try{return JSON.parse(s)}catch(e){}}s=localStorage.getItem("products");if(s){try{const old=JSON.parse(s);if(Array.isArray(old)&&old.length){localStorage.setItem(STORAGE_KEY,JSON.stringify(old));return old}}catch(e){}}return JSON.parse(JSON.stringify(DEFAULT_PRODUCTS))}
function setProducts(arr){localStorage.setItem(STORAGE_KEY,JSON.stringify(arr))}
function getActiveProducts(){return getProducts().filter(p=>!p.deleted)}
function getProduct(id){return getProducts().find(p=>p.id===id)}
function getSubs(){return JSON.parse(localStorage.getItem("submissions")||"[]")}
function setSubs(arr){localStorage.setItem("submissions",JSON.stringify(arr))}
function getLogs(){return JSON.parse(localStorage.getItem(LOG_KEY)||"[]")}
function setLogs(arr){localStorage.setItem(LOG_KEY,JSON.stringify(arr.slice(-500)))}
function addLog(action,detail){const logs=getLogs();logs.push({at:new Date().toISOString(),user:currentUser?currentUser.id:"?",action,detail:detail||""});setLogs(logs)}
function packAll(){return{products:getProducts(),submissions:getSubs(),users:getUsers(),logs:getLogs(),updatedAt:new Date().toISOString()}}
function applyAll(data){if(!data||typeof data!=="object")return;if(Array.isArray(data.products))setProducts(data.products);if(Array.isArray(data.submissions))setSubs(data.submissions);if(data.users&&typeof data.users==="object")setUsers(data.users);if(Array.isArray(data.logs))setLogs(data.logs);if(data.updatedAt)_lastCloudAt=data.updatedAt}

const firebaseConfig={
  apiKey:"AIzaSyCj0zqo31QoCw2ggpOl2Aewu8u95azL6jQ",
  authDomain:"borluulalt-f9d70.firebaseapp.com",
  databaseURL:"https://borluulalt-f9d70-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:"borluulalt-f9d70",
  storageBucket:"borluulalt-f9d70.firebasestorage.app",
  messagingSenderId:"855180069212",
  appId:"1:855180069212:web:851496c0ded1b428121999"
};
let _fbReady=false,_fbDb=null;
function initFirebase(){
  if(_fbReady)return true;
  try{
    if(typeof firebase==="undefined"){console.warn("Firebase SDK not loaded");return false;}
    if(!firebase.apps||!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    _fbDb=firebase.database();
    _fbReady=true;
    return true;
  }catch(e){console.warn(e);return false;}
}
function syncEnabled(){return true}
async function cloudPull(){
  if(!initFirebase()){updateSyncBadge("err");window._lastSyncError="Firebase ачаалаагүй";return false;}
  try{
    const snap=await _fbDb.ref("borluulalt").once("value");
    const data=snap.val();
    if(data)applyAll(data);
    updateSyncBadge("ok");
    window._lastSyncError=null;
    return true;
  }catch(e){
    console.warn(e);
    updateSyncBadge("err");
    window._lastSyncError=String(e.message||e);
    return false;
  }
}
async function cloudPush(){
  if(!initFirebase()||_syncBusy)return false;
  _syncBusy=true;updateSyncBadge("busy");
  try{
    const payload=packAll();
    await _fbDb.ref("borluulalt").set(payload);
    _lastCloudAt=payload.updatedAt;
    updateSyncBadge("ok");
    window._lastSyncError=null;
    return true;
  }catch(e){
    console.warn(e);
    updateSyncBadge("err");
    window._lastSyncError=String(e.message||e);
    return false;
  }finally{_syncBusy=false}
}
async function afterLocalWrite(){await cloudPush()}
function updateSyncBadge(state){
  const el=document.getElementById("syncBadge");
  if(!el)return;
  if(state==="busy"){el.textContent="☁️ ...";el.className="sync-badge busy";return}
  if(state==="err"){el.textContent="☁️ Алдаа";el.className="sync-badge err";return}
  const t=_lastCloudAt?new Date(_lastCloudAt).toLocaleTimeString("mn-MN"):"";
  el.textContent="☁️ Синктэй"+(t?" · "+t:"");
  el.className="sync-badge ok";
}
function showAlert(id,msg,type){const el=document.getElementById(id);if(!el)return;el.innerHTML=`<div class="alert alert-${type}">${msg}</div>`;if(type==="success")setTimeout(()=>{el.innerHTML=""},4000)}
function updateLoginHint(){const users=getUsers();const emps=Object.keys(users).filter(id=>users[id].role==="employee");const sups=Object.keys(users).filter(id=>users[id].role==="supervisor");const el=document.getElementById("loginHint");if(!el)return;el.innerHTML=`<strong>ID:</strong> Ажилчид ${emps.map(id=>`<code>${id}</code>`).join(" ")} · Ахлах ${sups.map(id=>`<code>${id}</code>`).join(" ")}`}
async function init(){if(!localStorage.getItem(STORAGE_KEY))setProducts(DEFAULT_PRODUCTS);else getProducts();if(!localStorage.getItem(USERS_KEY))setUsers(DEFAULT_USERS);updateSyncBadge("busy");await cloudPull();updateLoginHint();const s=localStorage.getItem("lastLoginId");if(s)document.getElementById("loginId").value=s;const fd=document.getElementById("formDate");if(fd)fd.valueAsDate=new Date();document.getElementById("loginId").addEventListener("keyup",e=>{if(e.key==="Enter")doLogin()});const pin=document.getElementById("loginPin");if(pin)pin.addEventListener("keyup",e=>{if(e.key==="Enter")doLogin()});setInterval(async()=>{if(!currentUser)return;await cloudPull();if(currentUser.role==="supervisor")loadSupervisorData();else{buildSalesTable();updateRecon()}},30000)}
async function doLogin(){const id=document.getElementById("loginId").value.trim().toLowerCase();const pin=(document.getElementById("loginPin").value||"").trim();await cloudPull();const user=getUser(id);if(!user){showAlert("loginAlert","Буруу ID","error");return}if(user.disabled){showAlert("loginAlert","ID идэвхгүй","error");return}if(user.pin&&String(user.pin)!==pin){showAlert("loginAlert","PIN буруу","error");return}currentUser={id,name:user.name,role:user.role};localStorage.setItem("lastLoginId",id);addLog("login","Нэвтэрсэн");showApp()}
function doLogout(){if(currentUser)addLog("logout","Гарсан");currentUser=null;_editingIdx=null;document.getElementById("loginSection").classList.remove("hidden");document.getElementById("appSection").classList.add("hidden");document.getElementById("loginPin").value="";updateLoginHint()}
function showApp(){document.getElementById("loginSection").classList.add("hidden");document.getElementById("appSection").classList.remove("hidden");document.getElementById("userNameDisplay").textContent=currentUser.name+" ("+currentUser.id+")";const badge=document.getElementById("roleBadge");if(currentUser.role==="employee"){badge.textContent="Ажилтан";badge.className="role-badge role-emp";document.getElementById("employeeView").classList.remove("hidden");document.getElementById("supervisorView").classList.add("hidden");document.getElementById("empName").value=currentUser.name;buildSalesTable();updateRecon()}else{badge.textContent="Ахлах";badge.className="role-badge role-sup";document.getElementById("employeeView").classList.add("hidden");document.getElementById("supervisorView").classList.remove("hidden");loadSupervisorData()}updateSyncBadge("ok")}
function buildSalesTable(){const tbody=document.getElementById("salesBody");tbody.innerHTML="";getActiveProducts().forEach(p=>{const sc=(p.stock||0)<=LOW_STOCK?"stock-low":"stock-ok";tbody.innerHTML+=`<tr><td>${p.id}</td><td class="product-name">${p.name}</td><td class="price-col">${(p.price||0).toLocaleString()}</td><td class="${sc}">${p.stock||0}</td><td><input type="number" min="0" id="prev_${p.id}" value="0" oninput="calcRow(${p.id})"></td><td><input type="number" min="0" id="next_${p.id}" value="0" oninput="calcRow(${p.id})"></td><td><input type="number" min="0" id="sold_${p.id}" value="0" oninput="calcIncome(${p.id})"></td><td><input type="number" min="0" step="0.01" id="income_${p.id}" value="0" oninput="updateRecon()"></td></tr>`})}
function calcRow(id){const prev=Number(document.getElementById("prev_"+id).value)||0;const next=Number(document.getElementById("next_"+id).value)||0;if(document.activeElement&&document.activeElement.id!=="sold_"+id){if(prev>0||next>0){document.getElementById("sold_"+id).value=Math.max(0,prev-next);calcIncome(id)}}}
function calcIncome(id){const sold=Number(document.getElementById("sold_"+id).value)||0;const p=getProduct(id);document.getElementById("income_"+id).value=sold*(p?p.price:0);updateRecon()}
function getCalcTotal(){return getActiveProducts().reduce((sum,p)=>{const el=document.getElementById("income_"+p.id);return sum+(el?(Number(el.value)||0):0)},0)}
function updateRecon(){const calc=getCalcTotal(),cash=Number(document.getElementById("cashAmount").value)||0,card=Number(document.getElementById("cardTotal").value)||0;const collected=cash+card,diff=collected-calc;const elCalc=document.getElementById("reconCalcTotal");if(!elCalc)return;elCalc.textContent=calc.toLocaleString()+" ₮";document.getElementById("reconCollected").textContent=collected.toLocaleString()+" ₮";const elDiff=document.getElementById("reconDiff");elDiff.textContent=(diff>=0?"+":"")+diff.toLocaleString()+" ₮";elDiff.className="value "+(Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short"));const elSt=document.getElementById("reconStatus");if(Math.abs(diff)<0.01){elSt.textContent="Тохирсон ✓";elSt.className="value diff-ok"}else if(diff>0){elSt.textContent="Илүү +"+diff.toLocaleString();elSt.className="value diff-over"}else{elSt.textContent="Дутуу "+Math.abs(diff).toLocaleString();elSt.className="value diff-short"}}
function getFormData(){const items=getActiveProducts().map(p=>({id:p.id,name:p.name,price:p.price||0,prev:Number(document.getElementById("prev_"+p.id).value)||0,next:Number(document.getElementById("next_"+p.id).value)||0,sold:Number(document.getElementById("sold_"+p.id).value)||0,income:Number(document.getElementById("income_"+p.id).value)||0}));const calcTotal=items.reduce((s,i)=>s+(i.income||0),0);const cashAmount=Number(document.getElementById("cashAmount").value)||0;const cardTotal=Number(document.getElementById("cardTotal").value)||0;const collected=cashAmount+cardTotal;return{date:document.getElementById("formDate").value,shift:document.getElementById("shiftType").value,employeeId:currentUser.id,employeeName:currentUser.name,location:(document.getElementById("locationName").value||"").trim(),checkerName:document.getElementById("checkerName").value,receiverName:document.getElementById("receiverName").value,items,cashAmount,posNumber:document.getElementById("posNumber").value,cardTotal,cashBalance:Number(document.getElementById("cashBalance").value)||0,calcTotal,collected,diff:collected-calcTotal,locked:false,submittedAt:new Date().toISOString()}}
async function saveSubmission(){const data=getFormData();if(!data.date){showAlert("empAlert","Огноо сонгоно уу","error");return}let products=getProducts();data.items.forEach(it=>{const idx=products.findIndex(p=>p.id===it.id);if(idx>=0&&it.sold>0)products[idx].stock=Math.max(0,(products[idx].stock||0)-it.sold)});setProducts(products);let all=getSubs();const existing=all.find(s=>s.employeeId===data.employeeId&&s.date===data.date&&s.shift===data.shift);if(existing&&existing.locked){showAlert("empAlert","Ээлж хаагдсан","error");return}all=all.filter(s=>!(s.employeeId===data.employeeId&&s.date===data.date&&s.shift===data.shift));all.push(data);setSubs(all);addLog("submit",`${data.date} ${data.shift}`);await afterLocalWrite();let msg="Хадгаллаа!";if(Math.abs(data.diff)>=0.01)msg+=data.diff>0?" Илүү +"+data.diff.toLocaleString():" Дутуу "+Math.abs(data.diff).toLocaleString();showAlert("empAlert",msg,"success");buildSalesTable();updateRecon()}
function resetForm(){getActiveProducts().forEach(p=>{["prev_","next_","sold_","income_"].forEach(pref=>{const el=document.getElementById(pref+p.id);if(el)el.value=0})});["checkerName","receiverName","posNumber","locationName"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});["cashAmount","cardTotal","cashBalance"].forEach(id=>document.getElementById(id).value=0);document.getElementById("empAlert").innerHTML="";updateRecon()}
function showTab(name){const tabs=["overview","submissions","reports","stock","prices","users","log"];tabs.forEach(t=>{const el=document.getElementById("tab"+t.charAt(0).toUpperCase()+t.slice(1));if(el)el.classList.toggle("hidden",name!==t)});const btnMap={overview:"tabBtnOverview",submissions:"tabBtnSubs",reports:"tabBtnReports",stock:"tabBtnStock",prices:"tabBtnPrices",users:"tabBtnUsers",log:"tabBtnLog"};Object.keys(btnMap).forEach(k=>{const b=document.getElementById(btnMap[k]);if(b)b.classList.toggle("active",name===k)});if(name==="stock")buildStockTable();if(name==="prices")buildPricesTable();if(name==="users")buildUsersTable();if(name==="reports")initReportFilters();if(name==="log")buildLogTable()}
function loadSupervisorData(){renderOverview(getSubs());renderSubmissionsList(getSubs())}
function renderOverview(all){let totalSold=0,totalIncome=0,totalDiff=0;const empSet=new Set();all.forEach(s=>{empSet.add(s.employeeId);s.items.forEach(it=>{totalSold+=it.sold||0;totalIncome+=it.income||0});totalDiff+=(s.diff!=null?s.diff:0)});const products=getActiveProducts();const totalStock=products.reduce((a,p)=>a+(p.stock||0),0);document.getElementById("overallSummary").innerHTML=`<div class="summary-item"><div class="label">Илгээлт</div><div class="value">${all.length}</div></div><div class="summary-item"><div class="label">Ажилчин</div><div class="value">${empSet.size}</div></div><div class="summary-item"><div class="label">Борлуулсан</div><div class="value">${totalSold}</div></div><div class="summary-item"><div class="label">Орлого</div><div class="value">${totalIncome.toLocaleString()}₮</div></div><div class="summary-item"><div class="label">Сан</div><div class="value">${totalStock}</div></div><div class="summary-item"><div class="label">Зөрүү</div><div class="value ${totalDiff>=0?"diff-over":"diff-short"}">${(totalDiff>=0?"+":"")+totalDiff.toLocaleString()}</div></div>`;const low=products.filter(p=>(p.stock||0)<=LOW_STOCK);document.getElementById("lowStockWarn").innerHTML=low.length?`<div class="alert alert-warn">⚠️ Бага нөөц: ${low.map(p=>p.name+" ("+p.stock+")").join(", ")}</div>`:"";const totals={};products.forEach(p=>totals[p.id]={name:p.name,sold:0,income:0,price:p.price,stock:p.stock||0});all.forEach(s=>s.items.forEach(it=>{if(totals[it.id]){totals[it.id].sold+=it.sold||0;totals[it.id].income+=it.income||0}}));const tbody=document.getElementById("productTotalsBody");tbody.innerHTML="";let ts=0,ti=0;products.forEach(p=>{const t=totals[p.id];ts+=t.sold;ti+=t.income;const sc=t.stock<=LOW_STOCK?"stock-low":"stock-ok";tbody.innerHTML+=`<tr><td>${p.id}</td><td class="product-name">${t.name}</td><td class="price-col">${(t.price||0).toLocaleString()}</td><td class="${sc}">${t.stock}</td><td>${t.sold}</td><td>${t.income.toLocaleString()}₮</td></tr>`});tbody.innerHTML+=`<tr style="font-weight:700;background:#e8f0fe"><td colspan="4">НИЙТ</td><td>${ts}</td><td>${ti.toLocaleString()}₮</td></tr>`}
function renderSubmissionsList(all){const list=document.getElementById("submissionsList");if(!all.length){list.innerHTML=`<div class="alert alert-info">Илгээлт байхгүй</div>`;document.getElementById("selectedSubmissionDetail").classList.add("hidden");return}all=all.slice().sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt));_sortedSubs=all;list.innerHTML=all.map((s,idx)=>{const calc=s.calcTotal!=null?s.calcTotal:(s.items||[]).reduce((a,i)=>a+(i.income||0),0);const diff=s.diff!=null?s.diff:((s.cashAmount||0)+(s.cardTotal||0)-calc);return `<div class="sub-item ${s.locked?"locked":""}" onclick="showSubmissionDetail(${idx})"><strong>${s.employeeName}</strong> (${s.employeeId}) — ${s.date} (${s.shift||"—"})${s.location?" · "+s.location:""}${s.locked?" 🔒":""}<br><small>${new Date(s.submittedAt).toLocaleString("mn-MN")} | ${calc.toLocaleString()}₮ | <span class="${Math.abs(diff)<0.01?"diff-ok":(diff>0?"diff-over":"diff-short")}">${Math.abs(diff)<0.01?"✓":(diff>0?"+":"")+diff.toLocaleString()}</span></small></div>`}).join("")}
