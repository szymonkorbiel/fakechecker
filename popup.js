document.addEventListener("DOMContentLoaded", () => {
  const scanButton = document.getElementById("scanButton");
  const resultElement = document.getElementById("result");
  const selectionButton = document.getElementById("analyzeSelection");
  const domainInput = document.getElementById("domainInput");
  const addDomainBtn = document.getElementById("addDomain");
  const trustedList = document.getElementById("trustedList");
  const modelSelect = document.getElementById("modelSelect");
  const modelNameEl = document.getElementById("modelName");
  const modelStatusEl = document.getElementById("modelStatus");
  const testModelBtn = document.getElementById("testModel");

  const modelNames = {
    jybert: "BERT (Model 1)",
    roberta: "RoBERTa (Model 2)",
    yato: "DistilBERT (Model 3)",
  };

  function setLoading(message) {
    resultElement.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div class=\"spinner\"></div><div>${message}</div></div>`;
  }

  function setMessage(html) {
    resultElement.innerHTML = html;
  }

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
    return;
  }

  scanButton.addEventListener("click", async () => {
    setLoading("Skanowanie i analiza tekstu...");

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

        setLoading("Przesyłanie do analizy...");

        chrome.runtime.sendMessage(
          { action: "analyzeText", text: cleanText },
          (response) => {
            if (!response) {
              showError("Błąd w analizie");
              return;
            }

            setMessage(
              '<div style="color:#9ee7c9;font-weight:700">✅ Analiza zakończona</div><div style="font-size:12px;color:#9aa5b1">Sprawdź oznaczenia na stronie</div>'
            );
          }
        );
      } catch (err) {
        showError("Błąd podczas OCR");
      }
    });
  });

  function showError(msg) {
    setMessage(
      '<div style="color:#ffb4b4;font-weight:700">❌ ' + msg + "</div>"
    );
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    try {
      chrome.tabs.sendMessage(tabs[0].id, { action: "triggerScan" });
    } catch (e) {}
  });

  function renderTrusted(list) {
    trustedList.innerHTML = "";
    (list || []).forEach((d, i) => {
      const div = document.createElement("div");
      div.className = "domain-item";
      div.innerHTML = `<div class="domain">${d}</div><button class="remove-btn">✖</button>`;
      div.querySelector(".remove-btn").addEventListener("click", () => {
        chrome.storage.sync.get({ trustedSources: [] }, (data) => {
          const arr = data.trustedSources || [];
          arr.splice(i, 1);
          chrome.storage.sync.set({ trustedSources: arr }, () =>
            renderTrusted(arr)
          );
        });
      });
      trustedList.appendChild(div);
    });
  }

  addDomainBtn.addEventListener("click", () => {
    const v = domainInput.value && domainInput.value.trim();
    if (!v) return;
    chrome.storage.sync.get({ trustedSources: [] }, (data) => {
      const arr = data.trustedSources || [];
      if (!arr.includes(v)) arr.push(v);
      chrome.storage.sync.set({ trustedSources: arr }, () => {
        domainInput.value = "";
        renderTrusted(arr);
      });
    });
  });

  chrome.storage.sync.get({ trustedSources: [] }, (data) =>
    renderTrusted(data.trustedSources || [])
  );

  if (modelSelect) {
    chrome.storage.sync.get({ selectedModel: "jybert" }, (data) => {
      const sel = data.selectedModel || "jybert";
      modelSelect.value = sel;
      if (modelNameEl) modelNameEl.textContent = modelNames[sel] || sel;
    });

    function refreshModelStatus() {
      chrome.runtime.sendMessage({ action: "getModelStatus" }, (resp) => {
        if (!resp) return;
        const sel = resp.selectedModel || modelSelect.value || "jybert";
        if (modelNameEl) modelNameEl.textContent = modelNames[sel] || sel;
        const info = resp.models && resp.models[sel];
        if (modelStatusEl) {
          if (!info) {
            modelStatusEl.textContent = "(brak informacji)";
            modelStatusEl.style.color = "var(--muted)";
          } else if (info.available) {
            modelStatusEl.textContent = "(dostępny lokalnie)";
            modelStatusEl.style.color = "#9ee7c9";
          } else {
            modelStatusEl.textContent = "(nie dostępny)";
            modelStatusEl.style.color = "#ffb4b4";
          }
        }
      });
    }

    refreshModelStatus();
    if (testModelBtn) {
      testModelBtn.addEventListener("click", () => {
        setLoading("Wysyłanie testu do modelu...");
        chrome.runtime.sendMessage({ action: "testModel" }, (resp) => {
          if (!resp) {
            setMessage(
              '<div style="color:#ffb4b4;font-weight:700">Brak odpowiedzi od background</div>'
            );
            return;
          }
          if (resp.error) {
            setMessage(
              '<div style="color:#ffb4b4;font-weight:700">Błąd: ' +
                resp.error +
                "</div>"
            );
            return;
          }
          setMessage(
            '<div style="color:#9ee7c9;font-weight:700">Odpowiedź modelu otrzymana</div><pre style="font-size:11px;color:#cfeff6;max-height:160px;overflow:auto">' +
              (JSON.stringify(resp, null, 2) || "-") +
              "</pre>"
          );
        });
      });
    }

    modelSelect.addEventListener("change", () => {
      const val = modelSelect.value;
      chrome.storage.sync.set({ selectedModel: val }, () => {
        if (modelNameEl) modelNameEl.textContent = modelNames[val] || val;
        setMessage(
          '<div style="color:#9ee7c9;font-weight:700">Wybrano model: ' +
            (modelNames[val] || val) +
            "</div>"
        );
        setTimeout(() => {
          setMessage('<div class="placeholder">Gotowy do skanowania</div>');
        }, 900);
        refreshModelStatus();
      });
    });
  }
});
