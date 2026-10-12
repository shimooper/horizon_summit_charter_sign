(function () {
  "use strict";
  var CFG = window.CHARTER_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var loadedAt = Date.now();

  var cityInput = $("city"), list = $("city-list"), picked = $("city-picked");
  var selected = null;       // {city, country, lat, lng}
  var timer = null, reqSeq = 0, results = [], active = -1;

  function setErr(id, msg) { $(id).textContent = msg || ""; }

  function labelOf(p) {
    var parts = [p.name];
    if (p.state && p.state !== p.name) parts.push(p.state);
    if (p.country) parts.push(p.country);
    return parts.join(", ");
  }

  function closeList() {
    list.hidden = true; cityInput.setAttribute("aria-expanded", "false"); active = -1;
  }

  function render() {
    list.innerHTML = "";
    if (!results.length) {
      var li = document.createElement("li");
      li.className = "empty"; li.textContent = "No matching cities";
      list.appendChild(li);
    }
    results.forEach(function (r, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", i === active ? "true" : "false");
      li.textContent = r.label;
      li.addEventListener("mousedown", function (e) { e.preventDefault(); choose(i); });
      list.appendChild(li);
    });
    list.hidden = false; cityInput.setAttribute("aria-expanded", "true");
  }

  function choose(i) {
    var r = results[i];
    if (!r) return;
    selected = r;
    cityInput.value = r.label;
    picked.textContent = "✓ " + r.label;
    picked.hidden = false;
    setErr("city-err", "");
    closeList();
  }

  function search(q) {
    var seq = ++reqSeq;
    var url = CFG.PHOTON_URL + "?q=" + encodeURIComponent(q) + "&limit=10&lang=en&layer=city";
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (seq !== reqSeq) return;
      var seen = {};
      results = (data.features || []).filter(function (f) {
        return f.geometry && f.properties && f.properties.name;
      }).map(function (f) {
        var p = f.properties;
        return {
          label: labelOf(p), city: labelOf(p), country: p.country || "",
          lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1]
        };
      }).filter(function (r) {
        if (seen[r.label]) return false;
        seen[r.label] = true; return true;
      });
      active = -1;
      render();
    }).catch(function () {
      if (seq !== reqSeq) return;
      setErr("city-err", "City search is unavailable right now. Please try again.");
    });
  }

  cityInput.addEventListener("input", function () {
    selected = null; picked.hidden = true;
    clearTimeout(timer);
    var q = cityInput.value.trim();
    if (q.length < 3) { closeList(); return; }
    timer = setTimeout(function () { search(q); }, 300);
  });

  cityInput.addEventListener("keydown", function (e) {
    if (list.hidden || !results.length) return;
    if (e.key === "ArrowDown") { active = (active + 1) % results.length; render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = (active - 1 + results.length) % results.length; render(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { choose(active); e.preventDefault(); }
    else if (e.key === "Escape") { closeList(); }
  });
  cityInput.addEventListener("blur", function () { setTimeout(closeList, 100); });

  var form = $("sign-form"), btn = $("submit");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ["name-err", "city-err", "email-err", "agree-err", "form-err"].forEach(function (id) { setErr(id, ""); });

    var name = $("name").value.trim(), email = $("email").value.trim(), ok = true;
    if (name.length < 2) { setErr("name-err", "Please enter your full name."); ok = false; }
    if (!selected) { setErr("city-err", "Please pick your city from the suggestions."); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("email-err", "Please enter a valid email address."); ok = false; }
    if (!$("agree").checked) { setErr("agree-err", "Please confirm that you agree to the charter."); ok = false; }
    if (!ok) return;

    if (!CFG.API_URL) { setErr("form-err", "The site is not configured yet (missing API_URL)."); return; }

    btn.disabled = true; btn.textContent = "Signing…";
    var elapsed = Date.now() - loadedAt; // server enforces the minimum
    var payload = {
      name: name, email: email,
      city: selected.city, country: selected.country, lat: selected.lat, lng: selected.lng,
      website: $("website").value, elapsed: elapsed
    };

    // text/plain avoids a CORS preflight, which Apps Script can't answer.
    fetch(CFG.API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) throw new Error(res.error || "Something went wrong.");
      $("done-name").textContent = name;
      $("done-email").textContent = email;
      $("form-view").hidden = true; $("done-view").hidden = false;
    }).catch(function (err) {
      setErr("form-err", (err && err.message ? err.message : "Something went wrong") + " Please try again.");
      btn.disabled = false; btn.textContent = "Sign the charter";
    });
  });
})();
