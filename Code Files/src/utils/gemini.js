const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const askGemini = async (prompt, retries = 5) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith("<") || apiKey.trim() === "") {
    throw new Error("GEMINI_API_KEY is not configured or is a placeholder");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const model = genAI.getGenerativeModel({ model: modelName });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      const isTransient =
        err.status === 503 ||
        err.status === 429 ||
        (err.message &&
          (err.message.includes("503") ||
            err.message.includes("high demand") ||
            err.message.includes("429") ||
            err.message.includes("quota") ||
            err.message.includes("resource exhausted")));

      if (isTransient && attempt < retries) {
        const delay = Math.min(1500 * Math.pow(1.8, attempt - 1), 10000);
        console.warn(`Gemini API busy (attempt ${attempt}/${retries}). Retrying in ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
};

module.exports = { askGemini };
