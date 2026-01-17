import os
from huggingface_hub import InferenceClient

HF_TOKEN = os.environ.get("HF_TOKEN") or "TWÓJ_TOKEN_HF"
client = InferenceClient(api_key=HF_TOKEN)

model = "XSY/albert-base-v2-fakenews-discriminator"
text = "This is a simple test sentence to check if the Albert fake news classifier responds correctly."

print("Calling model:", model)
try:
  out = client.text_classification(text, model=model)
  print("Result:", out)
except Exception as e:
  import traceback
  print("Error calling InferenceClient:")
  traceback.print_exc()
