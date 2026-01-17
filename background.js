(function () {
  console.log("🧠 Service worker startuje!");

  if (typeof chrome === "undefined") {
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener: function () {},
        },
        sendMessage: function () {},
      },
      storage: {
        sync: {
          get: function (keys, cb) {
            try {
              cb(keys || {});
            } catch (e) {}
          },
          set: function () {},
        },
      },
      tabs: {
        sendMessage: function () {},
      },
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getModelStatus") {
      getSelectedModel().then((selectedModel) => {
        if (DEPLOYED_HF_ENDPOINT) {
          try {
            const u = new URL(DEPLOYED_HF_ENDPOINT);
            const base = u.origin;
            fetch(base + "/models")
              .then((r) => r.json())
              .then((json) => {
                const models = {};
                for (const k of Object.keys(json || {})) {
                  models[k] = { available: !!json[k].loaded, meta: json[k] };
                }
                sendResponse({ selectedModel, models });
              })
              .catch((err) => {
                sendResponse({ selectedModel, error: String(err) });
              });
          } catch (e) {
            sendResponse({ selectedModel, error: String(e) });
          }
        } else {
          const models = {};
          sendResponse({ selectedModel, models });
        }
      });
      return true;
    }
    if (request.action === "analyzeText") {
      analyzeText(request.text, request.url, sendResponse, request.elemId);
      return true;
    }

    if (request.action === "analyzeExtractedTexts") {
      try {
        const host = request.url ? new URL(request.url).hostname : null;
        if (host) {
          recentBatchHosts.add(host);
          setTimeout(() => recentBatchHosts.delete(host), 2000);
        }
      } catch (e) {}

      batchAnalyze(request.texts, request.url).then((results) => {
        const tabId = sender && sender.tab && sender.tab.id;
        const payload = { action: "highlightFakeNews", results };
        if (tabId) {
          chrome.tabs.sendMessage(tabId, payload);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id)
              chrome.tabs.sendMessage(tabs[0].id, payload);
          });
        }
      });
      return true;
    }

    if (request.action === "testModel") {
      getSelectedModel().then((selectedModel) => {
        let endpoint = DEPLOYED_HF_ENDPOINT.replace(/\/$/, "");
        if (selectedModel) endpoint = endpoint + "/" + selectedModel;

        fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: "This is a short test." }),
        })
          .then(async (res) => {
            const text = await res.text();
            if (!res.ok) {
              sendResponse({
                error: `API ERROR ${res.status} ${res.statusText}`,
                raw: text,
              });
              return;
            }
            try {
              const json = JSON.parse(text);
              sendResponse({ ok: true, endpoint, json });
            } catch (e) {
              sendResponse({ error: "PARSE_ERROR", raw: text });
            }
          })
          .catch((err) => {
            sendResponse({ error: String(err) });
          });
      });
      return true;
    }

    if (request.action === "explain") {
      const endpoint = "http://localhost:8000/explain";
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: request.text })
      })
        .then(r => r.json())
        .then(json => sendResponse(json))
        .catch(err => sendResponse({ explanation: "Błąd: " + err.message }));
      return true;
    }

    if (request.action === "sendFeedback") {
      const endpoint = "http://localhost:8000/feedback";
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: request.text,
          label: request.feedback,
          prediction: request.prediction,
          model: request.model
        })
      })
        .then(r => r.json())
        .then(json => console.log("Feedback sent:", json))
        .catch(err => console.error("Feedback error:", err));
      return true;
    }
  });

  const SELECTED_HF_MODEL = "jybert";
  const DEPLOYED_HF_ENDPOINT = "http://localhost:8000/predict";

  const labelMap = {
    LABEL_0: "FAKE",
    LABEL_1: "REAL",
  };

  const FAKE_SCORE_THRESHOLD = 0.85;
  const POSSIBLE_FAKE_SCORE_THRESHOLD = 0.6;
  const INVERT_LABELS = false;
  const recentBatchHosts = new Set();

  function getSelectedModel() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get({ selectedModel: SELECTED_HF_MODEL }, (data) => {
          resolve(data.selectedModel);
        });
      } catch (e) {
        resolve(SELECTED_HF_MODEL);
      }
    });
  }

  async function analyzeText(inputText, url, sendResponse, elemId) {
    try {
      const maybeHost = url ? new URL(url).hostname : null;
      if (maybeHost && recentBatchHosts.has(maybeHost)) {
        sendResponse({ score: 0, verdict: "SKIPPED_DUPLICATE_BATCH", elemId });
        return;
      }
    } catch (e) {}

    if (!inputText || !inputText.trim()) {
      sendResponse({ score: 0, verdict: "NO TEXT FOUND", elemId });
      return;
    }

    inputText = inputText.normalize("NFC").replace(/\s+/g, " ").trim();
    const sentences = inputText.match(/[^.!?]+[.!?]+/g) || [];
    const trimmed = sentences.slice(0, 10).join(" ").trim();

    const hostname = url ? new URL(url).hostname : "unknown source";
    const sourcePrefix = `[SOURCE: ${hostname}] `;
    inputText = sourcePrefix + trimmed;

    const lang = detectLanguage(inputText);
    const selectedModel = await getSelectedModel();
    let endpoint = DEPLOYED_HF_ENDPOINT.replace(/\/$/, "");
    if (selectedModel) endpoint = endpoint + "/" + selectedModel;

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: inputText }),
    })
      .then(async (res) => {
        const text = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
          sendResponse({
            score: 0,
            verdict: `API ERROR ${res.status} ${res.statusText}`,
            raw: text,
            elemId,
          });
          return;
        }

        let json = null;
        try {
          const trimmed = text.trim();
          if (
            contentType.includes("application/json") ||
            trimmed.startsWith("{") ||
            trimmed.startsWith("[")
          ) {
            json = JSON.parse(text);
          } else {
            sendResponse({
              score: 0,
              verdict: "API NON-JSON RESPONSE",
              raw: text,
              elemId,
            });
            return;
          }
        } catch (e) {
          sendResponse({
            score: 0,
            verdict: "API PARSE ERROR",
            raw: text,
            elemId,
          });
          return;
        }

        const result = json?.[0]?.[0] || json?.[0];

        if (!result || typeof result.label !== "string") {
          sendResponse({
            score: 0,
            verdict: "INVALID API FORMAT",
            raw: text,
            elemId,
          });
          return;
        }

        let label = null;
        let score = 0;

        if (Array.isArray(json?.[0])) {
          const arr = json[0];
          const byLabel = {};
          for (const it of arr) {
            if (it?.label) byLabel[it.label] = it.score || 0;
          }
          const s0 = byLabel["LABEL_0"] || 0;
          const s1 = byLabel["LABEL_1"] || 0;
          if (s1 > s0) {
            label = "LABEL_1";
            score = s1;
          } else {
            label = "LABEL_0";
            score = s0;
          }
        } else {
          label = result.label;
          score = result.score || 0;
        }

        if (INVERT_LABELS) {
          if (label === "LABEL_0") label = "LABEL_1";
          else if (label === "LABEL_1") label = "LABEL_0";
        }

        let verdict = labelMap[label] || "UNKNOWN";

        if (label === "LABEL_0") {
          if (score >= FAKE_SCORE_THRESHOLD) verdict = "FAKE";
          else if (score >= POSSIBLE_FAKE_SCORE_THRESHOLD)
            verdict = "POSSIBLE FAKE";
          else verdict = "REAL";
        } else if (label === "LABEL_1") {
          if (score >= FAKE_SCORE_THRESHOLD) verdict = "REAL";
          else if (score >= POSSIBLE_FAKE_SCORE_THRESHOLD)
            verdict = "POSSIBLE FAKE";
          else verdict = "REAL";
        }

        chrome.storage.sync.get({ trustedSources: [] }, (data) => {
          const trusted = data.trustedSources.concat(["bbc.com"]);
          const isTrusted = trusted.some((domain) => hostname.includes(domain));

          if (isTrusted && (verdict === "FAKE" || verdict === "POSSIBLE FAKE")) {
            verdict = "REAL (TRUSTED SOURCE)";
          }

          sendResponse({ score: Math.round(score * 100), verdict, lang, elemId });
        });
      })
      .catch((err) => {
        sendResponse({ score: 0, verdict: "API ERROR", elemId });
      });
  }

  async function batchAnalyze(texts, url) {
    const hostname = url ? new URL(url).hostname : "unknown source";
    const sourcePrefix = `[SOURCE: ${hostname}] `;

    const [selectedModel, trustedSources] = await Promise.all([
      getSelectedModel(),
      new Promise((resolve) => {
        chrome.storage.sync.get({ trustedSources: [] }, (data) =>
          resolve(data.trustedSources)
        );
      }),
    ]);

    const isTrusted = trustedSources.some((domain) => hostname.includes(domain));
    const CONCURRENCY_LIMIT = 5;
    const results = [];
    
    async function processItem(text) {
      try {
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
        const trimmed = sentences
          .slice(0, 10)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        const inputText = sourcePrefix + trimmed;

        const lang = detectLanguage(inputText);
        
        let endpoint = DEPLOYED_HF_ENDPOINT.replace(/\/$/, "");
        if (selectedModel) endpoint = endpoint + "/" + selectedModel;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: inputText }),
        });

        const textRes = await res.text();
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
          return {
            label: "ERROR",
            score: 0,
            verdict: `API ERROR ${res.status}`,
            lang,
            model: selectedModel
          };
        }

        let json = null;
        try {
          const trimmedRes = textRes.trim();
          if (
            contentType.includes("application/json") ||
            trimmedRes.startsWith("{") ||
            trimmedRes.startsWith("[")
          ) {
            json = JSON.parse(textRes);
          } else {
            return {
              label: "ERROR",
              score: 0,
              verdict: "API NON-JSON RESPONSE",
              lang,
              model: selectedModel
            };
          }
        } catch (e) {
          return {
            label: "ERROR",
            score: 0,
            verdict: "API PARSE ERROR",
            lang,
            model: selectedModel
          };
        }

        const result = json?.[0]?.[0] || json?.[0];
        let label = result?.label || "ERROR";
        let score = result?.score || 0;

        if (Array.isArray(json?.[0])) {
          const arr = json[0];
          const byLabel = {};
          for (const it of arr) {
            if (it?.label) byLabel[it.label] = it.score || 0;
          }
          const s0 = byLabel["LABEL_0"] || 0;
          const s1 = byLabel["LABEL_1"] || 0;
          if (s1 > s0) {
            label = "LABEL_1";
            score = s1;
          } else {
            label = "LABEL_0";
            score = s0;
          }
        }

        if (INVERT_LABELS) {
          if (label === "LABEL_0") label = "LABEL_1";
          else if (label === "LABEL_1") label = "LABEL_0";
        }

        let verdict = labelMap[label] || "UNKNOWN";

        if (label === "LABEL_0") {
          if (score >= FAKE_SCORE_THRESHOLD) verdict = "FAKE";
          else if (score >= POSSIBLE_FAKE_SCORE_THRESHOLD)
            verdict = "POSSIBLE FAKE";
          else verdict = "REAL";
        } else if (label === "LABEL_1") {
          if (score >= FAKE_SCORE_THRESHOLD) verdict = "REAL";
          else if (score >= POSSIBLE_FAKE_SCORE_THRESHOLD)
            verdict = "POSSIBLE REAL";
          else verdict = "REAL";
        }

        if (isTrusted && (verdict === "FAKE" || verdict === "POSSIBLE FAKE")) {
          verdict = "REAL (TRUSTED SOURCE)";
        }

        return { label, score, verdict, lang, model: selectedModel };
      } catch (err) {
        return {
          label: "ERROR",
          score: 0,
          verdict: "ERROR",
          lang: "unknown",
          model: selectedModel
        };
      }
    }

    const executing = [];
    for (const text of texts) {
      const p = processItem(text).then(r => {
        executing.splice(executing.indexOf(p), 1);
        return r;
      });
      results.push(p);
      executing.push(p);
      if (executing.length >= CONCURRENCY_LIMIT) {
        await Promise.race(executing);
      }
    }

    const finalResults = await Promise.all(results);
    return finalResults;
  }

  function detectLanguage(text) {
    return "en";
  }
})();
