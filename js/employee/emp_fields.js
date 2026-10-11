/* emp_fields.js — ажилтны ээлж, тек, байршил алга болвол дахин гаргана. */
(function () {
  if (window._empFields) return;
  window._empFields = true;
  var TEKS = {
    "Оюут бар": ["Оюут 1", "Оюут 2", "Оюут вино", "ХАБ вино"],
    "Манлай бар": ["Манлай 1", "Манлай 2", "Манлай вино"],
    "VIP": ["VIP"],
    "POWER": ["POWER"]
  };
  function teksFor(loc) {
    var extra = (window.TEK_BY_LOC && window.TEK_BY_LOC[loc]) || [];
    var base = TEKS[loc] || [];
    var out = [];
    base.concat(extra).forEach(function (t) { if (t && out.indexOf(t) < 0) out.push(t); });
    return out;
  }
  function ensure() {
    var view = document.getElementById("employeeView");
    if (!view) return;
    var box = view.querySelector(".header-info");
    if (!box) {
      box = document.createElement("div");
      box.className = "header-info";
      view.insertBefore(box, view.firstChild);
    }
    box.style.display = "grid";
    if (!document.getElementById("formDate")) box.insertAdjacentHTML("beforeend", '<div><label>Огноо</label><input type="date" id="formDate"></div>');
    if (!document.getElementById("empName")) box.insertAdjacentHTML("beforeend", '<div><label>Ажилтан</label><input type="text" id="empName" readonly></div>');
    if (!document.getElementById("locationName")) box.insertAdjacentHTML("beforeend", '<div><label>Байршил</label><select id="locationName"><option value="">— Сонгох —</option><option>Оюут бар</option><option>Манлай бар</option><option>VIP</option><option>POWER</option></select></div>');
    var shift = document.getElementById("shiftType");
    if (!shift) {
      box.insertAdjacentHTML("beforeend", '<div><label>Ээлж</label><select id="shiftType"><option>Өглөө</option><option>Орой</option></select></div>');
      shift = document.getElementById("shiftType");
    }
    if (shift && shift.options.length < 2) {
      var cur = shift.value || "Өглөө";
      shift.innerHTML = "<option>Өглөө</option><option>Орой</option>";
      shift.value = cur === "Орой" ? "Орой" : "Өглөө";
    }
    if (!document.getElementById("checkerName")) box.insertAdjacentHTML("beforeend", '<div><label>Шалгагч</label><input type="text" id="checkerName"></div>');
    var tek = document.getElementById("receiverName");
    if (!tek) {
      box.insertAdjacentHTML("beforeend", '<div><label>Тек номер</label><select id="receiverName"><option value="">— Эхлээд байршил сонго —</option></select></div>');
      tek = document.getElementById("receiverName");
    }
    var loc = document.getElementById("locationName");
    if (!loc || !tek || !loc.value) return;
    var want = teksFor(loc.value);
    if (!want.length) return;
    var have = {};
    for (var i = 0; i < tek.options.length; i++) have[tek.options[i].value] = true;
    want.forEach(function (name) {
      if (have[name]) return;
      var o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      tek.appendChild(o);
    });
  }
  ensure();
  setInterval(ensure, 1000);
})();
