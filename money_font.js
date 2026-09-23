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
  var css=''
    +'@import url("https://fonts.googleapis.com/css2?family=Manrope:wght@500;700&display=swap");'
    +'.price-col,#salesBody td:nth-child(3),#salesBody td:nth-child(7),'
    +'#reportBody td:nth-child(6),#reportBody td:nth-child(7),'
    +'#productTotalsBody td:nth-child(n+3),'
    +'.summary-box .value,.money,td.income{'
    +'font-family:Manrope,"Segoe UI",system-ui,sans-serif!important;'
    +'font-variant-numeric:tabular-nums lining-nums;'
    +'font-feature-settings:"tnum" 1,"lnum" 1;'
    +'font-weight:700;letter-spacing:.01em;'
    +'}';
  var st=document.createElement("style");
  st.textContent=css;
  document.documentElement.appendChild(st);
})();
