document.addEventListener("DOMContentLoaded", () => {
  const scanButton = document.getElementById("scanButton");
  const resultElement = document.getElementById("result");

  if (!scanButton || !resultElement) {
    console.error("Brakuje elementów #scanButton lub #result w DOM.");
    return;
  }

  scanButton.addEventListener("click", async () => {
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
          headers: {
            apikey: "helloworld", // ← darmowy testowy klucz OCR.Space
          },
          body: formData,
        });

        const result = await response.json();
        const text = result?.ParsedResults?.[0]?.ParsedText || "";

        if (!text.trim()) {
          showError("Nie znaleziono tekstu");
          return;
        }

        chrome.runtime.sendMessage(
          { action: "analyzeText", text },
          (response) => {
            if (!response) {
              showError("Błąd w analizie");
              return;
            }

            const { score, verdict } = response;
            resultElement.innerText = `🧠 Wynik: ${verdict} (${score}%)`;
          }
        );
      } catch (err) {
        console.error("❌ Błąd OCR:", err);
        showError("OCR error");
      }
    });
  });

  function showError(msg) {
    resultElement.innerText = "❌ " + msg;
  }
});
