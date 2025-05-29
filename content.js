function scanPage() {
  console.log("🔍 Skanowanie strony...");

  const elements = document.querySelectorAll("h1, h2, p");
  let fakeCount = 0;
  const allTexts = [];
  const elementMap = [];

  elements.forEach((el) => {
    const text = el.textContent.trim();
    if (text.length < 20) return;

    allTexts.push(text);
    elementMap.push(el);

    chrome.runtime.sendMessage({ action: "analyzeText", text }, (response) => {
      if (!response || chrome.runtime.lastError) {
        console.warn("❌ Brak odpowiedzi lub błąd:", chrome.runtime.lastError);
        return;
      }

      if (response.verdict === "FAKE" || response.verdict === "POSSIBLE FAKE") {
        fakeCount++;
        el.style.backgroundColor =
          response.verdict === "FAKE"
            ? "rgba(255,0,0,0.3)"
            : "rgba(255,165,0,0.3)";
        el.title = `🚨 Potencjalny fake news (${response.score}%) - ${response.verdict}`;
      }

      updateScanStatus(fakeCount);
    });
  });

  // Zbiorcza analiza całej strony
  const fullText = allTexts.join("\n\n").trim();
  if (fullText.length >= 20) {
    chrome.runtime.sendMessage(
      { action: "analyzeText", text: fullText },
      (response) => {
        if (!response || chrome.runtime.lastError) {
          console.warn("❌ Błąd zbiorczej analizy:", chrome.runtime.lastError);
          return;
        }

        const statusEl = document.getElementById("fakeNewsStatus");
        if (statusEl) {
          const extra = `\n\n📊 Ogólny wynik: ${response.verdict} (${response.score}%)`;
          statusEl.textContent += extra;
        }

        console.log("📦 Zbiorcza analiza:", response.verdict, response.score);
      }
    );
  }
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
      : "✅ Strona przeskanowana. Brak fake newsów.";
  statusEl.style.color = fakeCount > 0 ? "red" : "green";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan") {
    scanPage();
    sendResponse({ status: "OK" });
  }
});
