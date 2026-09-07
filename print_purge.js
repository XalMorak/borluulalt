/* live extras loader */
(function(){
  function add(id,src){
    if(document.getElementById(id)) return;
    var s=document.createElement("script");
    s.id=id; s.src=src; document.head.appendChild(s);
  }
  var B="https://cdn.jsdelivr.net/gh/XalMorak/borluulalt@";
  add("wine_js_src", B+"e2ce4c149464449e79e0ad80b87515517a5d1f09/wine.js");
  add("runtime_fix_src", B+"f199642bbb0c3a88f5ba9dc181643d6a6478d86e/runtime_fix.js");
  add("wine_stock_src", B+"4e6667232d8ba65b979d1a959a06bdb7b04042cb/wine_stock.js");
})();
