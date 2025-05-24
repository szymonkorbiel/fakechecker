const scanButton = document.getElementById("scanButton");
const resultElement = document.getElementById("result");

scanButton.addEventListener("click", () => {
  console.log("popup.js: Kliknięto przycisk skanowania");
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) {
      resultElement.textContent =
        "Błąd: Nie można skanować strony (tabs.query)";
      return;
    }
    if (!tabs || tabs.length === 0) {
      resultElement.textContent = "Błąd: Brak aktywnych kart";
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: "scan" }, (response) => {
      if (chrome.runtime.lastError) {
        resultElement.textContent = "Błąd: Nie można połączyć się z content.js";
        return;
      }
      if (!response) {
        resultElement.textContent = "Brak odpowiedzi od content.js";
        return;
      }
      resultElement.textContent =
        "Skanowanie zakończone! Sprawdź stronę pod kątem oznaczeń.";
    });
  });
});
