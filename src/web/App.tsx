import type React from "react";
import { useEffect, useState } from "react";
import { getResponseForGivenPrompt } from "../services/geminiAI";

interface WebsiteStats {
  totalTime: number;
  visits: number;
  category: "productive" | "neutral" | "unproductive";
}

export const App: React.FC = () => {
  const [prompt, setPrompt] = useState<string>("how are you doing?");

  const handlePromptChange = () => {
    console.log("object");
    setPrompt("how are you doing?");

    getResponseForGivenPrompt(prompt).then((response) => {
      console.log(response);
    });
  };

  return (
    <div className="w-[400px] h-[500px] p-4 bg-white overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800">ProductivityPal</h1>

      <button onClick={handlePromptChange}>Prompt</button>
    </div>
  );
};
