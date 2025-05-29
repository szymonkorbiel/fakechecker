function extractVisibleTextBlocks() {
  const selectors = ["article", "h1", "h2", "h3", "p", ".tweet", ".post"];
  const elements = document.querySelectorAll(selectors.join(", "));

  Array.from(elements).forEach((el) => {
    const rect = el.getBoundingClientRect();
    const text = cleanText(el.textContent.trim());

    if (text.length < 30 || rect.height < 20 || rect.width < 100) return;

    const trimmedText = text.split(/\s+/).slice(0, 500).join(" ");

    const block = {
      text: trimmedText,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };

    chrome.runtime.sendMessage(
      { action: "analyzeText", text: trimmedText },
      (response) => {
        if (!response || !response.verdict) return;
        drawVerdictFrame(block, response.verdict, response.score);
      }
    );
  });
}

function drawVerdictFrame(block, verdict, score) {
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.top = block.top + "px";
  el.style.left = block.left + "px";
  el.style.width = block.width + "px";
  el.style.height = block.height + "px";
  el.style.border = `3px solid ${
    verdict === "FAKE"
      ? "red"
      : verdict === "POSSIBLE FAKE"
      ? "orange"
      : "green"
  }`;
  el.style.backgroundColor =
    verdict === "FAKE"
      ? "rgba(255,0,0,0.1)"
      : verdict === "POSSIBLE FAKE"
      ? "rgba(255,165,0,0.1)"
      : "rgba(0,255,0,0.1)";
  el.style.zIndex = 99999;
  el.style.pointerEvents = "none";
  el.title = `🧠 ${verdict} (${score}%)`;

  document.body.appendChild(el);
}

function cleanText(text) {
  return text
    .normalize("NFC") // normalizacja Unicode, ważna dla polskich znaków
    .replace(/[\u2018\u2019\u201A]/g, "'") // wymiana „specjalnych” cudzysłowów na prosty apostrof
    .replace(/[\u201C\u201D\u201E]/g, '"') // analogicznie dla cudzysłowów
    .replace(/[^\x00-\x7F]/g, (ch) => ch); // zachowaj wszystkie znaki Unicode (w tym polskie)
}

extractVisibleTextBlocks();
