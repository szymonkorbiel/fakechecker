document.addEventListener("DOMContentLoaded", () => {
  const scanButton = document.getElementById("scanButton");
  const resultElement = document.getElementById("result");
  const selectionButton = document.getElementById("analyzeSelection");

  if (selectionButton) {
    selectionButton.addEventListener("click", () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"],
        });
      });
    });
  }

  if (!scanButton || !resultElement) {
    console.error("Brakuje elementów #scanButton lub #result w DOM.");
    return;
  }

  scanButton.addEventListener("click", async () => {
    resultElement.innerText = "⏳ Skanowanie i analiza tekstu...";

    chrome.tabs.captureVisibleTab(null, { format: "png" }, async (dataUrl) => {
      if (!dataUrl) {
        showError("Błąd robienia screena");
        return;
      }

      try {
        const formData = new FormData();
        formData.append("base64Image", dataUrl);
        formData.append("language", "eng");
        formData.append("isOverlayRequired", "false");

        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: { apikey: "K89900029588957" },
          body: formData,
        });

        const result = await response.json();
        const text = result?.ParsedResults?.[0]?.ParsedText || "";

        const cleanText = text.replace(/\s+/g, " ").trim();
        const containsLetters = /[a-zA-Ząćęłńóśźżź]/.test(cleanText);

        if (!containsLetters || cleanText.length < 10) {
          showError("Nie znaleziono czytelnego tekstu");
          return;
        }

        resultElement.innerText = "📤 Przesyłanie do analizy...";

        chrome.runtime.sendMessage(
          { action: "analyzeText", text: cleanText },
          (response) => {
            if (!response) {
              showError("Błąd w analizie");
              return;
            }

            resultElement.innerText =
              "✅ Analiza zakończona. Sprawdź oznaczenia na stronie.";
          }
        );
      } catch (err) {
        console.error("❌ Błąd OCR:", err);
        showError("Błąd podczas OCR");
      }
    });
  });

  function showError(msg) {
    resultElement.innerText = "❌ " + msg;
  }

  // Możesz usunąć ten fragment z automatycznym skanowaniem przy otwarciu popupu, jeśli nie jest potrzebny:
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "triggerScan" });
  });
});
