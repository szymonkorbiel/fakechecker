(function () {
  if (window.__fakeScanInjected) return;
  window.__fakeScanInjected = true;

  function extractVisibleTextBlocks() {
    removePreviousFrames();

    const selectors = ["h1", "h2", "h3", "p", ".tweet", ".post"];
    const elements = Array.from(
      document.querySelectorAll(selectors.join(","))
    ).filter((el) => {
      return (
        !el.closest("footer") &&
        !el.closest(".cookie-banner") &&
        !el.closest("#cookie-consent") &&
        !el.closest(".cookie-consent") &&
        !el.closest("#bbccookies-banner")
      );
    });

    let fakeCount = 0;
    let analyzedCount = 0;
    const totalCount = elements.length;

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const text = cleanText(el.textContent.trim());

      if (text.length < 30 || rect.height < 20 || rect.width < 100) {
        analyzedCount++;
        if (analyzedCount === totalCount) updateScanStatus(fakeCount);
        return;
      }

      const trimmedText = text.split(/\s+/).slice(0, 500).join(" ");

      chrome.runtime.sendMessage(
        {
          action: "analyzeText",
          text: trimmedText,
          url: window.location.href,
        },
        (response) => {
          analyzedCount++;
          if (!response || !response.verdict) {
            if (analyzedCount === totalCount) updateScanStatus(fakeCount);
            return;
          }

          if (
            response.verdict === "FAKE" ||
            response.verdict === "POSSIBLE FAKE"
          ) {
            fakeCount++;
            drawVerdictFrame(el, response.verdict, response.score);
          }

          if (analyzedCount === totalCount) updateScanStatus(fakeCount);
        }
      );
    });
  }

  function drawVerdictFrame(element, verdict, score) {
    const rect = element.getBoundingClientRect();

    const el = document.createElement("div");
    el.className = "verdict-frame";
    el.style.position = "absolute";
    el.style.top = rect.top + window.scrollY + "px";
    el.style.left = rect.left + window.scrollX + "px";
    el.style.width = rect.width + "px";
    el.style.height = rect.height + "px";
    el.style.border = `3px solid ${verdict === "FAKE" ? "red" : "orange"}`;
    el.style.backgroundColor =
      verdict === "FAKE" ? "rgba(255,0,0,0.1)" : "rgba(255,165,0,0.1)";
    el.style.zIndex = 99999;
    el.style.pointerEvents = "none";
    el.title = `🧠 ${verdict} (${score}%)`;

    document.body.appendChild(el);
  }

  function removePreviousFrames() {
    document.querySelectorAll(".verdict-frame").forEach((el) => el.remove());
    const status = document.getElementById("fakeNewsStatus");
    if (status) status.remove();
  }

  function updateScanStatus(fakeCount) {
    let statusEl = document.getElementById("fakeNewsStatus");
    if (!statusEl) {
      statusEl = document.createElement("div");
      statusEl.id = "fakeNewsStatus";
      statusEl.style.position = "fixed";
      statusEl.style.bottom = "10px";
      statusEl.style.right = "10px";
      statusEl.style.backgroundColor = "#fff";
      statusEl.style.padding = "8px 12px";
      statusEl.style.border = "2px solid #000";
      statusEl.style.borderRadius = "8px";
      statusEl.style.zIndex = 999999;
      statusEl.style.fontFamily = "Arial, sans-serif";
      statusEl.style.fontSize = "14px";
      document.body.appendChild(statusEl);
    }

    statusEl.textContent =
      fakeCount > 0
        ? `🚨 Wykryto ${fakeCount} potencjalnych fake newsów`
        : "✅ Strona została przeskanowana. Brak fake newsów.";
    statusEl.style.color = fakeCount > 0 ? "red" : "green";
  }

  function cleanText(text) {
    return text
      .normalize("NFC")
      .replace(/[\u2018\u2019\u201A]/g, "'")
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/[^\x00-\x7F]/g, (ch) => ch);
  }

  // Uruchom analizę automatycznie
  extractVisibleTextBlocks();

  // Debounce na resize i scroll
  let debounce;
  window.addEventListener("resize", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => extractVisibleTextBlocks(), 300);
  });
  window.addEventListener("scroll", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => extractVisibleTextBlocks(), 300);
  });

  // Obsługa wiadomości z popupu
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "triggerScan") {
      extractVisibleTextBlocks();
    }
  });
})();
