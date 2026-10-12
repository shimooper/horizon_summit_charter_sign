// Shows the charter inline. Desktop browsers use their built-in PDF viewer;
// mobile browsers (no inline PDF support) get the pages rendered with pdf.js.
(function () {
  "use strict";
  var box = document.getElementById("pdf-view");
  var src = box.getAttribute("data-src");
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";

  function fail() {
    box.innerHTML = '<p class="hint">The charter can’t be displayed here. Please use the link below to open it.</p>';
  }

  if (navigator.pdfViewerEnabled) {
    var obj = document.createElement("object");
    obj.data = src; obj.type = "application/pdf";
    obj.style.cssText = "width:100%;height:100%";
    box.innerHTML = ""; box.appendChild(obj);
    return;
  }

  box.classList.add("pdfjs");
  var s = document.createElement("script");
  s.src = PDFJS + "pdf.min.js";
  s.onerror = fail;
  s.onload = function () {
    var lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    lib.getDocument(src).promise.then(function (pdf) {
      box.innerHTML = "";
      var chain = Promise.resolve();
      var ratio = window.devicePixelRatio || 1;
      for (let n = 1; n <= pdf.numPages; n++) {
        chain = chain.then(function () { return pdf.getPage(n); }).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var cssWidth = Math.max(box.clientWidth - 2, 200);
          var scale = cssWidth / base.width;
          var vp = page.getViewport({ scale: scale * ratio });
          var c = document.createElement("canvas");
          c.width = vp.width; c.height = vp.height;
          c.style.width = cssWidth + "px";
          c.style.height = (vp.height / ratio) + "px";
          box.appendChild(c);
          return page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        });
      }
      return chain;
    }).catch(fail);
  };
  document.head.appendChild(s);
})();
