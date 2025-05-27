console.log("🧠 Service worker startuje!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeText") {
    console.log("🧠 Analiza tekstu:", request.text);
    analyzeText(request.text, sendResponse);
    return true;
  }
});

// 🔍 Wysyła tekst do Hugging Face i analizuje odpowiedź
function analyzeText(inputText, sendResponse) {
  const HF_API_TOKEN = "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";
  const model = "jy46604790/Fake-News-Bert-Detect";
  const endpoint = `https://api-inference.huggingface.co/models/${model}`;

  // 🧹 Czy tekst w ogóle istnieje?
  if (!inputText || !inputText.trim()) {
    sendResponse({ score: 0, verdict: "NO TEXT FOUND" });
    return;
  }

  // 🔪 Ogranicz tekst do 500 słów
  inputText = inputText.split(/\s+/).slice(0, 500).join(" ");

  fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: inputText }),
  })
    .then(async (res) => {
      const text = await res.text();
      console.log("📥 Surowy response:", text);

      try {
        const json = JSON.parse(text);

        // ❗ Obsługa błędu API
        if (json.error) {
          console.error("❌ API ERROR:", json.error);
          sendResponse({ score: 0, verdict: "API ERROR: " + json.error });
          return;
        }

        // ✅ Format: [{label: "...", score: 0.x}]
        if (
          !Array.isArray(json) ||
          !Array.isArray(json[0]) ||
          typeof json[0][0]?.label !== "string"
        ) {
          console.warn("⚠️ Zły format JSON:", json);
          sendResponse({ score: 0, verdict: "INVALID API FORMAT" });
          return;
        }

        const result = json[0][0]; // ← pierwszy, najbardziej prawdopodobny wynik
        const score = result.score || 0;
        const label = result.label;

        // 🎯 Ocena
        let verdict = "UNKNOWN";

        if (label === "LABEL_0") {
          verdict =
            score >= 0.9 ? "FAKE" : score >= 0.6 ? "POSSIBLE FAKE" : "REAL";
        } else if (label === "LABEL_1") {
          verdict = "REAL";
        }

        sendResponse({ score: Math.round(score * 100), verdict });
      } catch (err) {
        console.error("❌ Błąd parsowania JSON:", err);
        sendResponse({ score: 0, verdict: "API PARSE ERROR" });
      }
    })
    .catch((err) => {
      console.error("❌ Fetch/API ERROR:", err);
      sendResponse({ score: 0, verdict: "API ERROR" });
    });
}
