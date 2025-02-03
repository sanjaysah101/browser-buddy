import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const getResponseForGivenPrompt = async (inputValue: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(inputValue);
    const response = result.response;
    const text = response.text();
    return text;
  } catch (error) {
    console.log("Something Went Wrong", error);
    return null;
  }
};

export const categorizeWebsite = async (
  domain: string
): Promise<"productive" | "neutral" | "unproductive"> => {
  try {
    const prompt = `Analyze the website domain "${domain}" and categorize it as either "productive", "neutral", or "unproductive" for work/study purposes. Only respond with one of these three words. Consider:
    - Productive: Educational, work-related, or skill-building websites
    - Unproductive: Entertainment, social media, or distracting websites
    - Neutral: News, reference, or utility websites`;

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);

    // Extract the actual text from the response
    const text = result.response.text().toLowerCase().trim();
    console.log("Raw AI response:", text);

    // Map the response to our expected categories
    if (text.includes("productive")) return "productive";
    if (text.includes("unproductive")) return "unproductive";
    if (text.includes("neutral")) return "neutral";

    // If response doesn't match expected format, log and return neutral
    console.warn("Unexpected AI response format:", text);
    return "neutral";
  } catch (error) {
    console.error("AI Categorization Error:", error);
    return "neutral";
  }
};
