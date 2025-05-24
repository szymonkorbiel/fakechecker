chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyze") {
    const HF_API_TOKEN = "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";
    const model = "jy46604790/Fake-News-Bert-Detect";
    const endpoint = `https://api-inference.huggingface.co/models/${model}`;

    const inputText = typeof request.text === "string" ? request.text : "";
    if (!inputText.trim()) {
      console.error("Brak treści do analizy");
      sendResponse({ score: 0, verdict: "INVALID INPUT" });
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: "twój tekst tutaj",
      }),
    })
      .then(async (res) => {
        const text = await res.text();
        try {
          const json = JSON.parse(text);

          if (!res.ok || json.error) {
            throw new Error(json.error || `${res.status}: ${res.statusText}`);
          }

          // 🔍 json = [[{label: 'LABEL_1', score: ...}, {label: 'LABEL_0', score: ...}]]
          const predictions = Array.isArray(json[0]) ? json[0] : json;

          const fakeObj = predictions.find((obj) => obj.label === "LABEL_0");
          const fakeScore = fakeObj ? fakeObj.score : 0;

          let verdict = "REAL";
          if (fakeScore >= 0.9) verdict = "FAKE";
          else if (fakeScore >= 0.6) verdict = "POSSIBLE FAKE";

          sendResponse({ score: Math.round(fakeScore * 100), verdict });
        } catch (parseError) {
          console.error(
            "❌ Błąd parsowania JSON:",
            parseError,
            "\n📥 Surowy tekst:",
            text
          );
          sendResponse({ score: 0, verdict: "API PARSE ERROR" });
        }
      })

      .catch((err) => {
        console.error("Błąd HF API:", err);
        sendResponse({ score: 0, verdict: "API ERROR" });
      });

    return true;
  }
});
async function debugHFTest(text) {
  const HF_API_TOKEN = "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";
  const endpoint =
    "https://api-inference.huggingface.co/models/jy46604790/Fake-News-Bert-Detect";

  const payload = {
    inputs: text,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const raw = await response.text(); // pokażmy wszystko jako string
    console.log("🧪 Status:", response.status);
    console.log("🧪 Body wysłane:", payload);
    console.log("🧪 Odpowiedź (surowa):", raw);

    if (!response.ok) {
      throw new Error(`Błąd API: ${response.status} ${response.statusText}`);
    }

    const json = JSON.parse(raw);
    console.log("✅ Parsed JSON:", json);
  } catch (err) {
    console.error("❌ Błąd HF API:", err);
  }
}

// Test
debugHFTest(
  "Premier Donald Tusk ogłasza mobilizację 200 000 mężczyzn od 1 lipca."
);
