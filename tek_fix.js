/* tek_fix: use receiverName in report/chart filters and display */
(function(){
  function tekOf(s){return ((s&&(s.receiverName||s.receiver))||"").toString().trim();}

  function wrapRunReport(){
    if(typeof window.runReport!=="function"||window.runReport._tek)return;
    var _rr=window.runReport;
    window.runReport=function(){
      var _g=window.getSubs;
      if(typeof _g==="function"){
        window.getSubs=function(){
          return _g().map(function(s){
            if(!s)return s;
            var c=Object.assign({},s);
            if(!c.receiver&&c.receiverName)c.receiver=c.receiverName;
            if(!c.receiverName&&c.receiver)c.receiverName=c.receiver;
            return c;
          });
        };
        try{return _rr.apply(this,arguments);}
        finally{window.getSubs=_g;}
      }
      return _rr.apply(this,arguments);
    };
    window.runReport._tek=true;
  }

  function wrapShowChart(){
    if(typeof window.showChart!=="function"||window.showChart._tek)return;
    var _sc=window.showChart;
    window.showChart=function(days){
      var _g=window.getSubs;
      if(typeof _g==="function"){
        window.getSubs=function(){
          return _g().map(function(s){
            if(!s)return s;
            var c=Object.assign({},s);
            if(!c.receiver&&c.receiverName)c.receiver=c.receiverName;
            if(!c.receiverName&&c.receiver)c.receiverName=c.receiver;
            return c;
          });
        };
        try{return _sc.apply(this,arguments);}
        finally{window.getSubs=_g;}
      }
      return _sc.apply(this,arguments);
    };
    window.showChart._tek=true;
  }

  function wrapLines(){
    if(typeof window.showChartLines!=="function"||window.showChartLines._tek)return;
    var _sl=window.showChartLines;
    window.showChartLines=function(days){
      var _g=window.getSubs;
      if(typeof _g==="function"){
        window.getSubs=function(){
          return _g().map(function(s){
            if(!s)return s;
            var c=Object.assign({},s);
            if(!c.receiver&&c.receiverName)c.receiver=c.receiverName;
            if(!c.receiverName&&c.receiver)c.receiverName=c.receiver;
            return c;
          });
        };
        try{return _sl.apply(this,arguments);}
        finally{window.getSubs=_g;}
      }
      return _sl.apply(this,arguments);
    };
    window.showChartLines._tek=true;
  }

  function tick(){
    wrapRunReport();
    wrapShowChart();
    wrapLines();
  }
  tick();
  setInterval(tick,400);
})();
