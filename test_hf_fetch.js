const HF_API_TOKEN = "TWÓJ_TOKEN_HF";
const endpoint =
  "https://router.huggingface.co/hf-inference/models/jy46604790/Fake-News-Bert-Detect";

const longText = Array(400)
  .fill(
    "This is a sample sentence used to test the Fake-News-Bert-Detect endpoint."
  )
  .join(" ");

function truncateToWords(text, maxWords = 500) {
  return text.split(/\s+/).slice(0, maxWords).join(" ");
}

async function run() {
  const truncated = truncateToWords(longText, 70);
  console.log("Sending text with word count:", truncated.split(/\s+/).length);

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: truncated }),
    });

    const text = await res.text();
    console.log("Raw response text:", text);

    try {
      const json = JSON.parse(text);
      console.log("Parsed JSON:", JSON.stringify(json, null, 2));
    } catch (err) {
      console.log("Response not JSON or parse failed:", err.message);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

run();
