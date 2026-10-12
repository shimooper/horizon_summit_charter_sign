// Shows the charter inline. Desktop browsers use their built-in PDF viewer;
// browsers without one (mobile) get the bundled pdf.js viewer, which has the
// same toolbar, zoom and page navigation.
(function () {
  "use strict";
  var box = document.getElementById("pdf-view");
  var src = box.getAttribute("data-src");
  var el;

  if (navigator.pdfViewerEnabled) {
    el = document.createElement("object");
    el.data = src; el.type = "application/pdf";
  } else {
    el = document.createElement("iframe");
    el.title = "Federal Charter";
    // Path is relative to assets/pdfjs/web/viewer.html
    el.src = "assets/pdfjs/web/viewer.html?file=" +
      encodeURIComponent("../../" + src.replace(/^assets\//, "")) + "#zoom=page-width";
  }
  el.style.cssText = "width:100%;height:100%;border:0";
  box.innerHTML = "";
  box.appendChild(el);
})();
