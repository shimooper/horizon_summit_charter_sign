(function () {
  "use strict";
  var CFG = window.CHARTER_CONFIG;
  var params = new URLSearchParams(location.search);
  if (params.get("display") === "1") document.body.classList.add("display");

  var map = L.map("map", { worldCopyJump: true, minZoom: 2 }).setView([25, 10], 2);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  function pinIcon(count, cls, size) {
    return L.divIcon({
      className: "",
      html: '<div class="pin ' + cls + '" style="width:' + size + "px;height:" + size + 'px">' + count + "</div>",
      iconSize: [size, size]
    });
  }

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    iconCreateFunction: function (c) {
      var sum = c.getAllChildMarkers().reduce(function (s, m) { return s + m.options.count; }, 0);
      var size = sum > 99 ? 48 : sum > 9 ? 42 : 36;
      return pinIcon(sum, "cluster", size);
    }
  });
  map.addLayer(cluster);

  var statusEl = document.getElementById("status");
  var lastSig = null, fitted = false;

  function update(rows) {
    var sig = JSON.stringify(rows);
    if (sig === lastSig) return;
    lastSig = sig;
    cluster.clearLayers();
    var total = 0, bounds = [];
    rows.forEach(function (r) {
      total += r.count;
      var m = L.marker([r.lat, r.lng], {
        icon: pinIcon(r.count, "", r.count > 9 ? 34 : 28),
        count: r.count,
        title: r.city + " (" + r.count + ")"
      });
      m.bindTooltip(r.city + ": " + r.count);
      cluster.addLayer(m);
      bounds.push([r.lat, r.lng]);
    });
    document.getElementById("total").textContent = total;
    if (bounds.length && !fitted) {
      fitted = true;
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      else map.setView(bounds[0], 5);
    }
  }

  function load() {
    if (!CFG.API_URL) { statusEl.textContent = "Not configured"; return; }
    fetch(CFG.API_URL).then(function (r) { return r.json(); }).then(function (rows) {
      if (!Array.isArray(rows)) throw new Error("bad data");
      update(rows);
      statusEl.textContent = "Updated " + new Date().toLocaleTimeString();
    }).catch(function () {
      statusEl.textContent = "Couldn't refresh, retrying…";
    });
  }

  load();
  setInterval(load, CFG.MAP_REFRESH_MS);
})();
