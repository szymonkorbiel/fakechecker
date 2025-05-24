function scanPage() {
  console.log("content.js: Skanowanie strony...");
  const elements = document.querySelectorAll("h1, h2, p");
  let fakeCount = 0;

  elements.forEach((el) => {
    const text = el.textContent.trim();
    if (text.length < 20) return; // pomijamy za krótkie

    chrome.runtime.sendMessage({ action: "analyze", text }, (response) => {
      if (chrome.runtime.lastError || !response) return;

      if (response.verdict === "FAKE" || response.verdict === "POSSIBLE FAKE") {
        fakeCount++;
        el.style.backgroundColor =
          response.verdict === "FAKE"
            ? "rgba(255,0,0,0.3)"
            : "rgba(255,165,0,0.3)";
        el.title = `Potencjalny fake news (${response.score}%) - ${response.verdict}`;
      }
      updateScanStatus(fakeCount);
    });
  });
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
  if (fakeCount > 0) {
    statusEl.textContent = `Wykryto ${fakeCount} potencjalnych fake newsów na stronie`;
    statusEl.style.color = "red";
  } else {
    statusEl.textContent = "Strona przeskanowana. Brak fake newsów.";
    statusEl.style.color = "green";
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scan") {
    scanPage();
    sendResponse({ status: "OK" });
  }
});
