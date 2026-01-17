(function () {
  if (window.__fakeScanInjected) return;
  window.__fakeScanInjected = true;
  window.__fakeScanRunning = false;
  window.__fakeProcessed = new Set();
  window.__totalFakeCount = 0;

  function extractVisibleTextBlocks() {
    const selectors = ["h1", "h2", "h3", "p", ".tweet", ".post"];
    const elements = Array.from(
      document.querySelectorAll(selectors.join(","))
    ).filter(
      (el) =>
        !el.closest("footer") &&
        !el.closest(".cookie-banner") &&
        !el.closest("#cookie-consent") &&
        !el.closest(".cookie-consent") &&
        !el.closest("#bbccookies-banner")
    );

    if (window.__fakeScanRunning) return;
    window.__fakeScanRunning = true;

    if (window.__fakeProcessed.size > 200) {
      window.__fakeProcessed.clear();
    }

    const texts = [];
    const elMap = [];
    elements.forEach((el, idx) => {
      const rect = el.getBoundingClientRect();
      const text = cleanText(el.textContent.trim());
      
      if (text.length < 20) return; 
      if (rect.height < 5) return;  
      if (rect.width < 5) return;   

      const trimmedText = text.split(/\s+/).slice(0, 500).join(" ");
      const key = trimmedText.slice(0, 200);
      if (window.__fakeProcessed.has(key)) return;
      window.__fakeProcessed.add(key);

      texts.push(trimmedText);
      elMap.push(el);
    });

    if (texts.length === 0) {
      window.__fakeScanRunning = false;
      if (window.__totalFakeCount === 0) {
          if (!document.getElementById("fakeNewsStatus")) {
             updateScanStatus(0);
          }
      }
      return;
    }

    chrome.runtime.sendMessage(
      {
        action: "analyzeExtractedTexts",
        texts,
        url: window.location.href,
      },
      () => {}
    );

    const onHighlight = (msg) => {
      if (msg.action !== "highlightFakeNews") return;
      chrome.runtime.onMessage.removeListener(onHighlight);

      const results = msg.results || [];
      let newFakeCount = 0;

      results.forEach((res, i) => {
        const el = elMap[i];
        if (!el || !res) return;

        if (res.verdict === "FAKE" || res.verdict === "POSSIBLE FAKE") {
          newFakeCount++;
          drawVerdictFrame(el, res, `batch_${Date.now()}_${i}`);
        }
      });

      window.__totalFakeCount += newFakeCount;
      window.__fakeScanRunning = false;
      updateScanStatus(window.__totalFakeCount);
    };

    chrome.runtime.onMessage.addListener(onHighlight);

    setTimeout(() => {
      window.__fakeScanRunning = false;
    }, 30000);
  }

  function drawVerdictFrame(element, res, elemId) {
    const rect = element.getBoundingClientRect();
    const verdict = res.verdict;
    const score = res.score;

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
    el.dataset.fakeId = elemId;

    const percent = Math.min(Math.round(Number(score) * 100), 100);
    const modelName = (res.model || "unknown").toUpperCase();

    const badge = document.createElement("div");
    badge.className = "verdict-badge";
    badge.textContent = `${verdict} ${percent}% [${modelName}]`;
    badge.style.position = "absolute";
    badge.style.top = "4px";
    badge.style.right = "6px";
    badge.style.padding = "2px 6px";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "Arial, sans-serif";
    badge.style.color = "#061024";
    badge.style.background = verdict === "FAKE" ? "#ffb4b4" : "#ffd9a6";
    badge.style.borderRadius = "6px";
    badge.style.pointerEvents = "none";
    badge.style.zIndex = 100000;

    el.appendChild(badge);

    const actions = document.createElement("div");
    actions.className = "verdict-actions";
    actions.style.position = "absolute";
    actions.style.bottom = "4px";
    actions.style.right = "6px";
    actions.style.display = "flex";
    actions.style.gap = "4px";
    actions.style.pointerEvents = "auto";
    actions.style.zIndex = 100001;

    const explainBtn = document.createElement("button");
    explainBtn.textContent = "💡 Wyjaśnij";
    explainBtn.title = "Poproś AI o wyjaśnienie";
    styleActionBtn(explainBtn, "#7c3aed");
    explainBtn.onclick = (e) => {
        e.stopPropagation();
        explainBtn.disabled = true;
        explainBtn.textContent = "⏳...";
        chrome.runtime.sendMessage({
            action: "explain",
            text: element.textContent.trim()
        }, (response) => {
            explainBtn.disabled = false;
            explainBtn.textContent = "💡 Wyjaśnij";
            if (response && response.explanation) {
                alert("Wyjaśnienie AI:\n\n" + response.explanation);
            }
        });
    };

    const upBtn = document.createElement("button");
    upBtn.textContent = "👍";
    upBtn.title = "Poprawna diagnoza";
    styleActionBtn(upBtn, "#10b981");
    upBtn.onclick = (e) => {
        e.stopPropagation();
        sendFeedback(element.textContent.trim(), "correct", res);
        upBtn.style.backgroundColor = "#059669";
        downBtn.style.opacity = "0.5";
        upBtn.disabled = true;
        downBtn.disabled = true;
    };

    const downBtn = document.createElement("button");
    downBtn.textContent = "👎";
    downBtn.title = "Błędna diagnoza";
    styleActionBtn(downBtn, "#ef4444");
    downBtn.onclick = (e) => {
        e.stopPropagation();
        sendFeedback(element.textContent.trim(), "incorrect", res);
        downBtn.style.backgroundColor = "#dc2626";
        upBtn.style.opacity = "0.5";
        upBtn.disabled = true;
        downBtn.disabled = true;
    };

    actions.appendChild(explainBtn);
    actions.appendChild(upBtn);
    actions.appendChild(downBtn);
    el.appendChild(actions);

    document.body.appendChild(el);
  }

  function styleActionBtn(btn, bgColor) {
    btn.style.padding = "2px 6px";
    btn.style.fontSize = "11px";
    btn.style.border = "none";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.style.color = "white";
    btn.style.backgroundColor = bgColor;
    btn.style.fontFamily = "Arial, sans-serif";
    btn.style.fontWeight = "bold";
  }

  function sendFeedback(text, label, res) {
    chrome.runtime.sendMessage({
        action: "sendFeedback",
        text: text,
        feedback: label,
        prediction: res.verdict,
        model: res.model
    });
  }

  function removePreviousFrames() {
    document.querySelectorAll(".verdict-frame").forEach((el) => el.remove());
    const status = document.getElementById("fakeNewsStatus");
    if (status) status.remove();
    window.__totalFakeCount = 0;
    window.__fakeProcessed.clear();
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

  extractVisibleTextBlocks();

  let debounce;
  window.addEventListener("resize", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => extractVisibleTextBlocks(), 300);
  });
  window.addEventListener("scroll", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => extractVisibleTextBlocks(), 300);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "triggerScan") {
      extractVisibleTextBlocks();
    }
  });
})();
