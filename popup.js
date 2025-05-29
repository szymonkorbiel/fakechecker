document.addEventListener("DOMContentLoaded", () => {
  const scanButton = document.getElementById("scanButton");
  const resultElement = document.getElementById("result");

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
        formData.append("language", "eng"); // Możesz tu dać "pol" jeśli większość tekstów jest po polsku
        formData.append("isOverlayRequired", "false");

        const response = await fetch("https://api.ocr.space/parse/image", {
          method: "POST",
          headers: {
            apikey: "helloworld",
          },
          body: formData,
        });

        const result = await response.json();
        const text = result?.ParsedResults?.[0]?.ParsedText || "";

        console.log("📥 OCR wynik:", JSON.stringify(text));

        // Sprawdź, czy są jakiekolwiek litery
        const cleanText = text.replace(/\s+/g, " ").trim();
        const containsLetters = /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(cleanText);

        if (!containsLetters || cleanText.length < 10) {
          showError("Nie znaleziono czytelnego tekstu");
          return;
        }

        // Pokaż tymczasowy komunikat, że analiza trwa
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
});
