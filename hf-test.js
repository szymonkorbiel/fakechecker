const API_URL =
  "https://api-inference.huggingface.co/models/jy46604790/Fake-News-Bert-Detect";
const API_TOKEN = "TWÓJ_TOKEN_HF";

async function analyzeFakeNews(text) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${error}`);
  }

  const result = await response.json();
  return result;
}

analyzeFakeNews(
  "Premier Donald Tusk ogłasza mobilizację 200 000 mężczyzn od 1 lipca."
)
  .then((res) => {
    console.log("Wynik analizy:", res);
    const fakeScore = res.find((r) => r.label === "FAKE")?.score || 0;
    console.log(
      `Prawdopodobieństwo fake news: ${(fakeScore * 100).toFixed(1)}%`
    );
  })
  .catch(console.error);
