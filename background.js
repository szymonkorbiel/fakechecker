console.log("🧠 Service worker startuje!");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeText") {
    console.log("🧠 Analiza tekstu:", request.text);
    analyzeText(request.text, request.url, sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (request.action === "analyzeExtractedTexts") {
    console.log("📦 Batch analiza tekstów...");
    batchAnalyze(request.texts, request.url).then((results) => {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: "highlightFakeNews",
        results,
      });
    });
    return true;
  }
});

const HF_API_TOKEN = "xxx";
const endpoints = {
  en: "https://api-inference.huggingface.co/models/jy46604790/Fake-News-Bert-Detect",
  // pl: "https://api-inference.huggingface.co/models/dkleczek/polish-fake-news-model",
};

const labelMap = {
  LABEL_0: "FAKE",
  LABEL_1: "REAL",
};

function analyzeText(inputText, url, sendResponse) {
  if (!inputText || !inputText.trim()) {
    sendResponse({ score: 0, verdict: "NO TEXT FOUND" });
    return;
  }

  inputText = inputText.normalize("NFC").replace(/\s+/g, " ").trim();
  const sentences = inputText.match(/[^.!?]+[.!?]+/g) || [];
  const trimmed = sentences.slice(0, 10).join(" ").trim();

  const hostname = url ? new URL(url).hostname : "unknown source";
  const sourcePrefix = `[SOURCE: ${hostname}] `;
  inputText = sourcePrefix + trimmed;

  console.log("📄 Tekst po przygotowaniu:", inputText);

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
        let verdict = labelMap[label] || "UNKNOWN";

        if (label === "LABEL_0") {
          if (score >= 0.9) verdict = "FAKE";
          else if (score >= 0.6) verdict = "POSSIBLE FAKE";
          else verdict = "REAL";
        }

        // Ochrona zaufanych źródeł
        chrome.storage.sync.get({ trustedSources: [] }, (data) => {
          const trusted = data.trustedSources;
          const isTrusted = trusted.some((domain) => hostname.includes(domain));

          if (
            isTrusted &&
            (verdict === "FAKE" || verdict === "POSSIBLE FAKE")
          ) {
            verdict = "REAL (TRUSTED SOURCE)";
          }

          sendResponse({ score: Math.round(score * 100), verdict, lang });
        });
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

async function batchAnalyze(texts, url) {
  const results = [];
  const hostname = url ? new URL(url).hostname : "unknown source";
  const sourcePrefix = `[SOURCE: ${hostname}] `;

  for (const text of texts) {
    try {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      const trimmed = sentences
        .slice(0, 10)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const inputText = sourcePrefix + trimmed;

      const lang = detectLanguage(inputText);
      const endpoint = endpoints[lang] || endpoints.en;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: inputText }),
      });

      const json = await res.json();
      const result = json?.[0]?.[0] || json?.[0];

      let label = result?.label || "ERROR";
      let score = result?.score || 0;
      let verdict = labelMap[label] || "UNKNOWN";

      if (label === "LABEL_0") {
        if (score >= 0.9) verdict = "FAKE";
        else if (score >= 0.6) verdict = "POSSIBLE FAKE";
        else verdict = "REAL";
      }

      const trusted = await new Promise((resolve) => {
        chrome.storage.sync.get({ trustedSources: [] }, (data) =>
          resolve(data.trustedSources)
        );
      });
      const isTrusted = trusted.some((domain) => hostname.includes(domain));

      if (isTrusted && (verdict === "FAKE" || verdict === "POSSIBLE FAKE")) {
        verdict = "REAL (TRUSTED SOURCE)";
      }

      results.push({ label, score, verdict, lang });
    } catch (err) {
      console.error("❌ Batch error:", err);
      results.push({
        label: "ERROR",
        score: 0,
        verdict: "ERROR",
        lang: "unknown",
      });
    }
  }

  return results;
}

function detectLanguage(text) {
  return "en"; // Placeholder, implement language detection if needed
  // const polishChars = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;
  // return polishChars.test(text) ? "pl" : "en";
}
