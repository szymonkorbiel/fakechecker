FakeChecker — rozszerzenie i serwer lokalny do wykrywania fake news
===============================================================

Opis
----
FakeChecker to narzędzie składające się z rozszerzenia przeglądarki (Chrome/Edge - Manifest V3)
oraz lekkiego serwera FastAPI uruchamianego lokalnie, które pozwalają analizować widoczny tekst na stronach WWW
i oznaczać elementy potencjalnie zawierające fake news. Rozszerzenie potrafi korzystać z lokalnie uruchomionych
modeli transformatorowych (RoBERTa, DistilBERT) dostarczonych przez użytkownika.

Główne funkcje
--------------
- Skanowanie tekstu widocznego na stronie i oznaczanie fragmentów jako: FAKE, POSSIBLE FAKE lub REAL.
- Generowanie wyjaśnień AI: Przycisk „Wyjaśnij” wykorzystuje model `google/flan-t5-small` do generowania uzasadnień, dlaczego treść może być fałszywa.
- System uczenia (Feedback loop): Możliwość oceniania trafności diagnozy (👍/👎), co pozwala na zbieranie danych do przyszłego dotrenowania modeli.
- Wybór modelu AI z popupu (lokalne: `jybert`, `roberta`, `yato`).
- Lokalny serwer FastAPI obsługuje endpointy: `/predict`, `/predict/{model_key}`, `/models`, `/explain` oraz `/feedback`.
- Popup zawiera przycisk „Test modelu” do szybkiej weryfikacji połączenia z modelem.

Wymagania
---------
- Python 3.8+ (dla serwera FastAPI)
- Zainstalowane paczki: `fastapi`, `uvicorn[standard]`, `transformers`, `torch` (lub inny backend kompatybilny)
- Pliki modelu w lokalnym katalogu `models/<nazwa_modelu>` (np. `models/Fake_News_Bert_Detect`)

Instalacja (serwer lokalny)
---------------------------
1. Utwórz i aktywuj virtualenv (opcjonalnie):

   ```bash
   python -m venv .venv
   # Windows
   .\.venv\Scripts\activate
   # Unix / Mac
   source .venv/bin/activate
   ```

2. Zainstaluj zależności:

   ```bash
   pip install -r requirements.txt
   ```

3. Przygotuj folder `models/` i umieść w nim katalogi z modelami (przykładowe nazwy w projekcie):
   - `models/Fake_News_Bert_Detect` (jybert)
   - `models/Fake_News_Detection_Roberta` (roberta)
   - `models/Fake_News_Detector_Bert_Data_Science` (yato)

4. Uruchom serwer:

   ```bash
   python server.py
   # lub (zalecane, szybsze i z logami):
   uvicorn server:app --host 0.0.0.0 --port 8000 --log-level info
   ```

5. Serwer udostępnia:
   - `POST /predict` — domyślnie używa `yato` (wywołuje `predict_for_model('yato')`).
   - `POST /predict/{model_key}` — np. `/predict/jybert` lub `/predict/roberta`.
   - `GET /models` — zwraca informacje, które modele zostały poprawnie załadowane.
   - `POST /explain` — generuje wyjaśnienie dla podanego tekstu przy użyciu modelu generatywnego.
   - `POST /feedback` — zapisuje ocenę użytkownika (text, label, prediction, model) do pliku `dataset/feedback.json`.

Konfiguracja rozszerzenia (Chrome)
----------------------------------
1. Włącz tryb deweloperski w `chrome://extensions` i kliknij "Load unpacked" na folder projektu.
2. Upewnij się, że w `manifest.json` są uprawnienia do hostów (jeśli łączysz się z lokalnym serwerem):
   - np. dodaj `http://localhost:8000/*` do `host_permissions` lub `optional_host_permissions`.
3. Po wgraniu rozszerzenia otwórz popup (ikona rozszerzenia):
   - `Model AI` — wybierz z listy `BERT (lokalny)`, `RoBERTa (lokalny)`, `DistilBERT (lokalny)`.
   - `🔍 Przeskanuj stronę` — uruchamia analizę widocznych bloków tekstu na aktualnej karcie.
   - `Zaufane źródła` — lista domen, które obniżają czułość (np. bbc.com).

Jak działa wybór modelu
------------------------
- Rozszerzenie odczytuje wybrany model z `chrome.storage.sync.selectedModel`.
- Jeśli `DEPLOYED_HF_ENDPOINT` w `background.js` jest ustawione (np. `http://localhost:8000/predict`),
  extension doda `/{model_key}` (np. `http://localhost:8000/predict/roberta`) gdy `selectedModel` jest ustawione.
- Alternatywnie, gdy `DEPLOYED_HF_ENDPOINT` jest puste, używane są adresy z mapy `modelEndpoints` (router HF).

Jak ręcznie zmienić domyślny model
----------------------------------
- Edycja pliku: w `background.js` zmień `const SELECTED_HF_MODEL = "jybert";` na `"roberta"` lub `"yato"`,
  zapisz i przeładuj rozszerzenie.
- Bez edycji plików: w konsoli Service Worker (chrome://extensions → Inspect service worker) ustaw:
  ```js
  chrome.storage.sync.set({ selectedModel: 'roberta' })
  ```
  lub
  ```js
  chrome.storage.sync.set({ selectedModel: 'yato' })
  ```

Użycie i interpretacja wyników
-------------------------------
- Po skanowaniu elementy oznaczone jako `FAKE` (czerwone) lub `POSSIBLE FAKE` (pomarańczowe) otrzymują ramkę.
- W prawym górnym rogu ramki pojawia się napis np. `FAKE 99%` — procent to ufność wyliczona z modelu.
- **Nowe interakcje w ramce**:
  - Przycisk **💡 Wyjaśnij**: Wysyła tekst do AI i wyświetla komunikat z uzasadnieniem.
  - Przyciski **👍 / 👎**: Pozwalają ocenić trafność wyniku. Dane są zapisywane w `dataset/feedback.json`.
- Popup pokazuje także liczbę wykrytych potencjalnych fałszywych elementów.

Pliki istotne
------------
- `background.js` — logika wyboru endpointu, parsowania odpowiedzi, granice decyzyjne.
- `contentscript.js` — ekstrakcja tekstów, rysowanie ramek oraz badge z procentem.
- `server.py` — lokalny FastAPI serwer, obsługa wielu modeli z folderu `models/`.
- `popup.html` / `popup.js` — UI do sterowania skanowaniem i wyborem modelu.
