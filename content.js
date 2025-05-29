(() => {
  const selected = window.getSelection().toString().trim();

  if (!selected || selected.length < 5) {
    alert("❌ Zaznacz więcej tekstu (minimum 5 znaków).");
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "analyzeText",
      text: selected,
      url: window.location.href,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        alert("❌ Błąd analizy: " + chrome.runtime.lastError.message);
        return;
      }

      if (!response) {
        alert("❌ Brak odpowiedzi z analizy");
        return;
      }

      alert(`✅ Wynik: ${response.verdict} (${response.score}%)`);
    }
  );
})();
