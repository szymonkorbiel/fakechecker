from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from transformers import pipeline
import logging
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fakechecker-server")


class Inp(BaseModel):
    inputs: str


class Feedback(BaseModel):
    text: str
    label: str
    prediction: str
    model: str


@app.on_event("startup")
def load_model():
    global MODELS
    MODELS = {
        "jybert": {"path": "models/Fake_News_Bert_Detect", "max_words": 500},
        "roberta": {
            "path": "models/Fake_News_Detection_Roberta",
            "max_words": 70,
        },
        "yato": {"path": "models/Fake_News_Detector_Bert_Data_Science", "max_words": 500},
    }

    global PIPELINES
    PIPELINES = {}

    for key, info in MODELS.items():
        model_path = info.get("path")
        if not model_path or not os.path.exists(model_path):
            logger.warning(f"Model path for {key} not found: {model_path} — skipping")
            continue
        logger.info(f"Loading model '{key}' from {model_path} (this may take a while)...")
        try:
            clf = pipeline(
                "text-classification",
                model=model_path,
                tokenizer=model_path,
                return_all_scores=True,
            )
            PIPELINES[key] = clf
            logger.info(f"Model '{key}' loaded")
        except Exception as e:
            logger.exception(f"Failed to load model {key}")

    global EXPL_PIPELINE
    try:
        logger.info("Loading explanation model (google/flan-t5-small)...")
        EXPL_PIPELINE = pipeline("text2text-generation", model="google/flan-t5-small")
        logger.info("Explanation model loaded")
    except Exception as e:
        logger.exception("Failed to load explanation model")
        EXPL_PIPELINE = None


def truncate_to_words(text: str, max_words: int = 500) -> str:
    parts = text.split()
    if len(parts) <= max_words:
        return text
    return " ".join(parts[:max_words])


@app.post("/predict")
def predict(payload: Inp):
    model_key = "yato"
    return predict_for_model(model_key, payload)


@app.post("/predict/{model_key}")
def predict_for_model(model_key: str, payload: Inp):
    text = payload.inputs or ""
    model_key = model_key or "jybert"

    clf = PIPELINES.get(model_key)
    if not clf:
        raise HTTPException(status_code=404, detail=f"Model not available: {model_key}")

    max_words = MODELS.get(model_key, {}).get("max_words", 500)
    text = truncate_to_words(text, max_words)
    try:
        out = clf(text)
        if len(out) > 0 and isinstance(out[0], list):
            result = out
        else:
            result = [out]
        return result
    except Exception as e:
        logger.exception("Inference error")
        return {"error": str(e)}


@app.get("/models")
async def list_models():
    out = {}
    try:
        for k, info in MODELS.items():
            out[k] = {
                "loaded": bool(PIPELINES.get(k)),
                "path": info.get("path"),
                "max_words": info.get("max_words", 500),
            }
    except Exception:
        for k, info in (globals().get("MODELS", {}) or {}).items():
            out[k] = {"loaded": False, "path": info.get("path"), "max_words": info.get("max_words", 500)}

    return out


@app.post("/feedback")
async def save_feedback(fb: Feedback):
    import json
    from datetime import datetime
    
    feedback_file = "dataset/feedback.json"
    os.makedirs("dataset", exist_ok=True)
    
    entry = {
        "timestamp": datetime.now().isoformat(),
        "text": fb.text,
        "label": fb.label,
        "prediction": fb.prediction,
        "model": fb.model
    }
    
    try:
        data = []
        if os.path.exists(feedback_file):
            with open(feedback_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        
        data.append(entry)
        
        with open(feedback_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            
        return {"status": "success", "message": "Feedback saved"}
    except Exception as e:
        logger.exception("Failed to save feedback")
        return {"status": "error", "message": str(e)}


@app.post("/explain")
async def explain(payload: Inp):
    if not EXPL_PIPELINE:
        return {"explanation": "Moduł wyjaśnień jest niedostępny."}
    
    text = payload.inputs or ""
    prompt = f"Analyze the following statement and explain briefly why it might be a fake news: {text}"
    
    try:
        out = EXPL_PIPELINE(prompt, max_length=150, num_return_sequences=1)
        explanation = out[0].get("generated_text", "Brak wyjaśnienia.")
        return {"explanation": explanation}
    except Exception as e:
        logger.exception("Explanation generation error")
        return {"explanation": f"Błąd generowania wyjaśnienia: {str(e)}"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
