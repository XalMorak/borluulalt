/* edit_select: location + tek as dropdowns on supervisor edit */
(function(){
  if(window._editSelectLoaded)return;
  window._editSelectLoaded=true;

  var LOCS=["Оюут бар","Манлай бар","VIP","POWER"];
  var TEK={
    "Оюут бар":["1-р тек","2-р тек","3-р тек","Урд монгол","Урд гадаад","ХАБ гадаад","ХАБ монгол"],
    "Манлай бар":["1-р тек","2-р тек"],
    "VIP":["VIP-1","VIP-2","VIP-3"],
    "POWER":["POWER 1-р тек"]
  };
  var SHIFTS=["Оглөө","Орой"];

  function opts(list, selected){
    var h='<option value="">— Сонгох —</option>';
    (list||[]).forEach(function(v){
      h+='<option value="'+v+'"'+(v===selected?' selected':'')+'>'+v+'</option>';
    });
    if(selected && list.indexOf(selected)<0){
      h+='<option value="'+selected+'" selected>'+selected+'</option>';
    }
    return h;
  }
  function replaceInput(id, html){
    var el=document.getElementById(id);
    if(!el)return null;
    var sel=document.createElement("select");
    sel.id=id;
    sel.innerHTML=html;
    el.parentNode.replaceChild(sel, el);
    return sel;
  }
  window.onEditLocationChange=function(){
    var loc=document.getElementById("edit_location");
    var tek=document.getElementById("edit_receiver");
    if(!loc||!tek)return;
    var cur=tek.value;
    var list=TEK[loc.value]||[];
    tek.innerHTML=opts(list, list.indexOf(cur)>=0?cur:"");
  };
  function convertFields(){
    var locEl=document.getElementById("edit_location");
    var tekEl=document.getElementById("edit_receiver");
    var shEl=document.getElementById("edit_shift");
    if(!locEl)return;
    var locVal=locEl.value||"";
    var tekVal=tekEl?tekEl.value||"":"";
    var shVal=shEl?shEl.value||"":"";
    if(locEl.tagName!=="SELECT"){
      var s=replaceInput("edit_location", opts(LOCS, locVal));
      if(s)s.setAttribute("onchange","onEditLocationChange()");
    }
    if(tekEl && tekEl.tagName!=="SELECT"){
      replaceInput("edit_receiver", opts(TEK[locVal]||[], tekVal));
    }
    if(shEl && shEl.tagName!=="SELECT"){
      replaceInput("edit_shift", opts(SHIFTS, shVal));
    }
  }
  function wrap(name){
    var fn=window[name];
    if(typeof fn!=="function"||fn._editSel)return;
    window[name]=function(){
      var r=fn.apply(this, arguments);
      setTimeout(convertFields, 0);
      setTimeout(convertFields, 50);
      return r;
    };
    window[name]._editSel=true;
  }
  function tick(){
    wrap("startEditFixed");
    wrap("startEditSubmission");
    wrap("startEdit");
    convertFields();
  }
  tick();
  setInterval(tick, 800);
})();
