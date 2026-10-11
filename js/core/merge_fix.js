/* merge_fix v2: transaction + safer product/sub merge */
function _toArr(v){
  if(!v)return[];
  if(Array.isArray(v))return v.filter(Boolean);
  if(typeof v==="object")return Object.keys(v).sort(function(a,b){return Number(a)-Number(b)||String(a).localeCompare(String(b));}).map(function(k){return v[k];}).filter(Boolean);
  return[];
}
function _subKey(s){
  if(!s)return"";
  if(s.id)return"id:"+s.id;
  return(s.employeeId||"")+"|"+(s.date||"")+"|"+(s.shift||"")+"|"+(s.location||"");
}
function _mergeSubs(remote,local){
  var map={};
  function put(s){
    if(!s)return;
    var k=_subKey(s);
    if(!k||k==="|||"){s.id=s.id||("s_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7));k="id:"+s.id;}
    var prev=map[k];
    if(!prev){map[k]=s;return;}
    var pt=prev.submittedAt||"", st=s.submittedAt||"";
    var newer, older;
    if(st>=pt){newer=s;older=prev;} else {newer=prev;older=s;}
    var out=Object.assign({},older,newer);
    if(newer.deleted)out.deleted=true;
    if(newer.locked||older.locked)out.locked=!!(newer.locked||older.locked);
    if(newer.submittedAt>=older.submittedAt&&newer.locked===false)out.locked=false;
    map[k]=out;
  }
  _toArr(remote).forEach(put);
  _toArr(local).forEach(put);
  return Object.keys(map).map(function(k){return map[k];});
}
function _mergeProducts(remote,local){
  var pm={};
  function put(p){
    if(!p||p.id==null)return;
    var id=p.id;
    var prev=pm[id];
    if(!prev){pm[id]=p;return;}
    var out=Object.assign({},prev,p);
    var a=prev.stockByLoc||{}, b=p.stockByLoc||{};
    var sbl={};
    var keys={};Object.keys(a).forEach(function(k){keys[k]=1;});Object.keys(b).forEach(function(k){keys[k]=1;});
    Object.keys(keys).forEach(function(loc){
      var av=a[loc], bv=b[loc];
      if(av==null)sbl[loc]=bv;
      else if(bv==null)sbl[loc]=av;
      else sbl[loc]=bv;
    });
    out.stockByLoc=sbl;
    var sum=0;Object.keys(sbl).forEach(function(k){sum+=Number(sbl[k])||0;});
    if(Object.keys(sbl).length)out.stock=sum;
    pm[id]=out;
  }
  _toArr(remote).forEach(put);
  _toArr(local).forEach(put);
  return Object.keys(pm).map(function(k){return pm[k];});
}
function _buildPayload(remote,local){
  remote=remote||{};local=local||{};
  return {
    products:_mergeProducts(remote.products,local.products),
    submissions:_mergeSubs(remote.submissions,local.submissions),
    users:Object.assign({},remote.users||{},local.users||{}),
    logs:_toArr(local.logs||remote.logs).slice(-500),
    updatedAt:new Date().toISOString()
  };
}
(function(){
function wrap(){
 if(window._msw2||typeof cloudPush!=="function")return;window._msw2=1;
 var _push=cloudPush;
 cloudPush=async function(){
  if(typeof initFirebase==="function")initFirebase();
  if(!window._fbDb){return _push.apply(this,arguments);}
  if(window._syncBusy)return false;window._syncBusy=true;
  if(typeof updateSyncBadge==="function")updateSyncBadge("busy");
  try{
   var local=typeof packAll==="function"?packAll():{submissions:[],products:[],users:{},logs:[]};
   var payload=null;
   var result=await _fbDb.ref("borluulalt").transaction(function(current){
     var remote=current||{};
     payload=_buildPayload(remote,local);
     return payload;
   });
   if(result&&result.committed&&payload){
     if(typeof setSubs==="function")setSubs(payload.submissions);
     if(typeof setProducts==="function"&&payload.products.length)setProducts(payload.products);
   }else if(!result||!result.committed){
     var snap=await _fbDb.ref("borluulalt").once("value");
     payload=_buildPayload(snap.val()||{},local);
     await _fbDb.ref("borluulalt").set(payload);
     if(typeof setSubs==="function")setSubs(payload.submissions);
     if(typeof setProducts==="function"&&payload.products.length)setProducts(payload.products);
   }
   if(typeof updateSyncBadge==="function")updateSyncBadge("ok");
   return true;
  }catch(e){
   console.warn("cloudPush",e);
   if(typeof updateSyncBadge==="function")updateSyncBadge("err");
   return false;
  }finally{window._syncBusy=false;}
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
window._mergeSubs=_mergeSubs;
window._mergeProducts=_mergeProducts;
})();
