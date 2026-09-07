/* load both halves */
(function(){
  function load(src){return fetch(src).then(function(r){return r.text();});}
  Promise.all([load('./bundle_a.js'),load('./bundle_b.js')]).then(function(parts){
    var s=document.createElement('script');
    s.textContent=parts[0]+parts[1];
    document.body.appendChild(s);
  }).catch(function(e){console.error(e);alert('Kod achaalah aldaa');});
})();
