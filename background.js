console.log("🧠 Service worker startuje!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeText") {
    console.log("🧠 Analiza tekstu:", request.text);
    analyzeText(request.text, sendResponse);
    return true;
  }

  if (request.action === "analyzeExtractedTexts") {
    console.log("📦 Batch analiza tekstów...");
    batchAnalyze(request.texts).then((results) => {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "highlightFakeNews",
        results,
      });
    });
    return true;
  }
});

const HF_API_TOKEN = "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";
const endpoints = {
  en: "https://api-inference.huggingface.co/models/jy46604790/Fake-News-Bert-Detect",
  pl: "https://api-inference.huggingface.co/models/dkleczek/polish-fake-news-model",
};

function analyzeText(inputText, sendResponse) {
  if (!inputText || !inputText.trim()) {
    sendResponse({ score: 0, verdict: "NO TEXT FOUND" });
    return;
  }

  // Normalizacja i oczyszczenie
  inputText = inputText.normalize("NFC").replace(/\s+/g, " ").trim();

  // Przycinanie na podstawie pełnych zdań (max ~6 zdań)
  const sentences = inputText.match(/[^.!?]+[.!?]+/g) || [];
  inputText = sentences.slice(0, 6).join(" ").trim();

  console.log("📄 Tekst po skróceniu:", inputText);

  const lang = detectLanguage(inputText);
  console.log("🧠 Wykryty język:", lang);

  const endpoint = endpoints[lang] || endpoints.en;

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
      console.log(`📥 Surowy response (${lang}):`, text);

      try {
        const json = JSON.parse(text);
        const result = json?.[0]?.[0] || json?.[0];

        if (!result || typeof result.label !== "string") {
          console.warn("⚠️ Zły format JSON:", json);
          sendResponse({ score: 0, verdict: "INVALID API FORMAT" });
          return;
        }

        const score = result.score || 0;
        const label = result.label;

        let verdict = "UNKNOWN";
        if (label === "LABEL_0") {
          verdict =
            score >= 0.9 ? "FAKE" : score >= 0.6 ? "POSSIBLE FAKE" : "REAL";
        } else if (label === "LABEL_1") {
          verdict = "REAL";
        }

        sendResponse({ score: Math.round(score * 100), verdict, lang });
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

async function batchAnalyze(texts) {
  const results = [];

  for (const text of texts) {
    try {
      // Przygotowanie tekstu – podział na zdania i oczyszczenie
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      const trimmed = sentences
        .slice(0, 6)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const lang = detectLanguage(trimmed);
      const endpoint = endpoints[lang] || endpoints.en;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: trimmed }),
      });

      const json = await res.json();
      const result = json?.[0]?.[0] || json?.[0];

      if (result && result.label) {
        results.push({
          label: result.label,
          score: result.score,
          lang,
        });
      } else {
        results.push({ label: "ERROR", score: 0, lang });
      }
    } catch (err) {
      console.error("❌ Batch error:", err);
      results.push({ label: "ERROR", score: 0, lang });
    }
  }

  return results;
}

function detectLanguage(text) {
  const polishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  return polishChars.test(text) ? "pl" : "en";
}
