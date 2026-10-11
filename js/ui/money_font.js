/* money_font: 3.500 -> 3,500 and readable digits */
(function(){
  if(window._moneyFont) return; window._moneyFont=true;
  var orig=Number.prototype.toLocaleString;
  Number.prototype.toLocaleString=function(locales, options){
    if(arguments.length) return orig.apply(this, arguments);
    var n=Number(this);
    if(!isFinite(n)) return orig.call(this);
    return orig.call(Math.round(n), "en-US");
  };
  /* the Manrope money font rules live in css/app.css */
})();
