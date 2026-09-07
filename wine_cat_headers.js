/* wine category headers on employee form */
(function(){
  if(window._wineCatHead)return; window._wineCatHead=true;
  var LABELS={busad:"\u0411\u0443\u0441\u0430\u0434 \u0431\u0430\u0440\u0430\u0430",ulaan:"\u0423\u043b\u0430\u0430\u043d \u0432\u0438\u043d\u043e",tsagaan:"\u0426\u0430\u0433\u0430\u0430\u043d \u0432\u0438\u043d\u043e"};
  function norm(s){return String(s||"").trim().toLowerCase();}
  function catOf(w){
    var c=norm(w&&w.cat);
    if(c.indexOf("busad")>=0||c.indexOf("\u0431\u0443\u0441\u0430\u0434")>=0)return "busad";
    if(c.indexOf("tsagaan")>=0||c.indexOf("\u0446\u0430\u0433\u0430\u0430\u043d")>=0)return "tsagaan";
    return "ulaan";
  }
  function header(label){
    var tr=document.createElement("tr");
    tr.className="wine-sec";
    var td=document.createElement("td");
    td.colSpan=7;
    td.style.cssText="background:#1e3a5f;color:#fff;font-weight:700;text-align:left;padding:8px 10px";
    td.textContent=label;
    tr.appendChild(td);
    return tr;
  }
  function group(){
    if(!window._wineMode)return;
    var tbody=document.getElementById("salesBody");
    if(!tbody||tbody.querySelector(".wine-sec"))return;
    var wines=typeof getWines==="function"?getWines():[];
    var byId={}; wines.forEach(function(w){byId[String(w.id)]=catOf(w);});
    var rows=[].slice.call(tbody.querySelectorAll("tr"));
    if(!rows.length)return;
    function idOf(tr){
      var inp=tr.querySelector("input[id^='prev_'],input[id^='sold_']");
      if(!inp)return "";
      var m=String(inp.id).match(/_(\d+)$/);
      return m?m[1]:"";
    }
    var g={busad:[],ulaan:[],tsagaan:[]};
    rows.forEach(function(tr){
      var c=byId[idOf(tr)]||"ulaan";
      (g[c]||g.ulaan).push(tr);
    });
    tbody.innerHTML="";
    ["busad","ulaan","tsagaan"].forEach(function(c){
      tbody.appendChild(header(LABELS[c]));
      g[c].forEach(function(tr){tbody.appendChild(tr);});
    });
  }
  setInterval(group,600);
})();
