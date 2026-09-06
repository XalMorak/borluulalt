/* merge-safe cloud sync */
function _toArr(v){if(!v)return[];if(Array.isArray(v))return v.filter(Boolean);if(typeof v==="object")return Object.keys(v).sort(function(a,b){return Number(a)-Number(b)||String(a).localeCompare(String(b));}).map(function(k){return v[k];}).filter(Boolean);return[];}
function _subKey(s){if(!s)return"";if(s.id)return"id:"+s.id;return(s.employeeId||"")+"|"+(s.date||"")+"|"+(s.shift||"");}
function _mergeSubs(remote,local){var map={};function put(s){if(!s)return;var k=_subKey(s);if(!k||k==="||"){s.id=s.id||("s_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7));k="id:"+s.id;}var prev=map[k];if(!prev){map[k]=s;return;}var pt=prev.submittedAt||"",st=s.submittedAt||"";if(st>=pt)map[k]=Object.assign({},prev,s);else map[k]=Object.assign({},s,prev);if(s.locked||prev.locked)map[k].locked=true;}_toArr(remote).forEach(put);_toArr(local).forEach(put);return Object.keys(map).map(function(k){return map[k];});}
(function(){
function wrap(){
 if(window._msw||typeof cloudPush!=="function")return;window._msw=1;
 var _push=cloudPush;
 cloudPush=async function(){
  if(typeof initFirebase==="function")initFirebase();
  if(!window._fbDb){return _push.apply(this,arguments);}
  if(window._syncBusy)return false;window._syncBusy=true;
  if(typeof updateSyncBadge==="function")updateSyncBadge("busy");
  try{
   var snap=await _fbDb.ref("borluulalt").once("value");
   var remote=snap.val()||{};
   var local=typeof packAll==="function"?packAll():{submissions:[],products:[],users:{},logs:[]};
   var merged=_mergeSubs(remote.submissions,local.submissions);
   var pm={};_toArr(remote.products).forEach(function(p){if(p&&p.id!=null)pm[p.id]=p;});
   _toArr(local.products).forEach(function(p){if(p&&p.id!=null)pm[p.id]=p;});
   var products=Object.keys(pm).map(function(k){return pm[k];});
   var users=Object.assign({},remote.users||{},local.users||{});
   var payload={products:products.length?products:local.products,submissions:merged,users:users,logs:_toArr(local.logs).slice(-500),updatedAt:new Date().toISOString()};
   await _fbDb.ref("borluulalt").set(payload);
   if(typeof setSubs==="function")setSubs(merged);
   if(typeof setProducts==="function"&&products.length)setProducts(products);
   if(typeof updateSyncBadge==="function")updateSyncBadge("ok");
   return true;
  }catch(e){console.warn(e);if(typeof updateSyncBadge==="function")updateSyncBadge("err");return false;}
  finally{window._syncBusy=false;}
 };
 if(typeof applyAll==="function"){
  var _a=applyAll;
  applyAll=function(data){
   if(!data||typeof data!=="object")return;
   if(data.products!=null){var p=_toArr(data.products);if(p.length||Array.isArray(data.products))setProducts(p);}
   if(data.submissions!=null){var m=_mergeSubs(data.submissions,typeof getSubs==="function"?getSubs():[]);setSubs(m);}
   if(data.users&&typeof data.users==="object")setUsers(data.users);
   if(data.logs!=null)setLogs(_toArr(data.logs));
   if(data.updatedAt)window._lastCloudAt=data.updatedAt;
  };
 }
 if(typeof getFormData==="function"){
  var _g=getFormData;
  getFormData=function(){var d=_g.apply(this,arguments);if(d){if(!d.id)d.id="s_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);if(!d.submittedAt)d.submittedAt=new Date().toISOString();}return d;};
 }
 if(typeof saveSubmission==="function"){
  var _s=saveSubmission;
  saveSubmission=async function(){try{if(typeof cloudPull==="function")await cloudPull();}catch(e){}return await _s.apply(this,arguments);};
 }
}
wrap();setInterval(wrap,300);
})();
