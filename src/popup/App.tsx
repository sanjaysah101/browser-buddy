import type React from "react";
import { useEffect, useState } from "react";
import { getResponseForGivenPrompt } from "../services/geminiAI";

interface WebsiteStats {
  totalTime: number;
  visits: number;
  category: "productive" | "neutral" | "unproductive";
}

export const App: React.FC = () => {
  const [stats, setStats] = useState<[string, WebsiteStats][]>([]);
  const [productivityScore, setProductivityScore] = useState<number>(100);
  const [selectedTab, setSelectedTab] = useState<"stats" | "categories">(
    "stats"
  );
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);

  const [prompt, setPrompt] = useState<string>("how are you doing?");

  const handlePromptChange = () => {
    console.log("object");
    setPrompt("how are you doing?");

    getResponseForGivenPrompt(prompt).then((response) => {
      console.log(response);
    });
  };

  useEffect(() => {
    try {
      if (!chrome?.runtime?.connect) {
        console.error("Chrome runtime API not available");
        return;
      }

      const newPort = chrome.runtime.connect({ name: "popup" });
      if (!newPort) {
        console.error("Failed to create port connection");
        return;
      }

      setPort(newPort);

      const messageListener = (message: any) => {
        console.log("Received message:", message);
        if (
          message.type === "INITIAL_STATS" ||
          message.type === "STATS_UPDATE"
        ) {
          setStats(message.data);
          if (message.productivityScore !== undefined) {
            setProductivityScore(message.productivityScore);
          }
        }
      };

      newPort.onMessage.addListener(messageListener);
      newPort.postMessage({ type: "GET_STATS" });

      // Handle connection errors
      newPort.onDisconnect.addListener(() => {
        console.error("Port disconnected:", chrome.runtime.lastError);
        setPort(null);
      });

      return () => {
        try {
          newPort.onMessage.removeListener(messageListener);
          newPort.disconnect();
        } catch (error) {
          console.error("Error cleaning up port:", error);
        }
      };
    } catch (error) {
      console.error("Error setting up connection:", error);
    }
  }, []);

  const updateCategory = (
    domain: string,
    category: WebsiteStats["category"]
  ) => {
    if (!port) {
      console.error("No active connection to the extension");
      return;
    }

    try {
      port.postMessage({
        type: "UPDATE_CATEGORY",
        domain,
        category,
      });
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="w-[400px] h-[500px] p-4 bg-white overflow-y-auto">
      <h1 className="text-2xl font-bold text-gray-800">ProductivityPal</h1>

      <button onClick={handlePromptChange}>Prompt</button>

      {/* Productivity Score */}
      <div className="mt-2 mb-4">
        <div className="text-lg font-semibold text-gray-700">
          Productivity Score: {productivityScore}%
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-green-600 h-2.5 rounded-full"
            style={{ width: `${productivityScore}%` }}
          />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex mb-4 border-b">
        <button
          className={`px-4 py-2 ${
            selectedTab === "stats" ? "border-b-2 border-blue-500" : ""
          }`}
          onClick={() => setSelectedTab("stats")}
        >
          Statistics
        </button>
        <button
          className={`px-4 py-2 ${
            selectedTab === "categories" ? "border-b-2 border-blue-500" : ""
          }`}
          onClick={() => setSelectedTab("categories")}
        >
          Categories
        </button>
      </div>

      {selectedTab === "stats" ? (
        <div className="space-y-4">
          {stats
            .sort(([, a], [, b]) => b.totalTime - a.totalTime)
            .map(([domain, stats]) => (
              <div
                key={domain}
                className="p-3 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="font-medium text-gray-800">{domain}</div>
                <div className="text-sm text-gray-600">
                  Time: {formatTime(stats.totalTime)}
                </div>
                <div className="text-sm text-gray-600">
                  Visits: {stats.visits}
                </div>
                <div className={`text-sm ${getCategoryColor(stats.category)}`}>
                  Category: {stats.category}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-4">
          {stats.map(([domain, stats]) => (
            <div
              key={domain}
              className="p-3 bg-gray-50 rounded-lg shadow-sm flex items-center justify-between"
            >
              <div className="font-medium text-gray-800">{domain}</div>
              <div className="flex items-center gap-2">
                <select
                  value={stats.category}
                  onChange={(e) =>
                    updateCategory(
                      domain,
                      e.target.value as WebsiteStats["category"]
                    )
                  }
                  className="p-1 border rounded"
                >
                  <option value="productive">Productive</option>
                  <option value="neutral">Neutral</option>
                  <option value="unproductive">Unproductive</option>
                </select>
                <button
                  onClick={() => {
                    if (port) {
                      port.postMessage({
                        type: "REQUEST_AI_CATEGORIZATION",
                        domain,
                      });
                    }
                  }}
                  className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  title="Use AI to categorize this website"
                >
                  AI
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getCategoryColor(category: WebsiteStats["category"]): string {
  switch (category) {
    case "productive":
      return "text-green-600";
    case "unproductive":
      return "text-red-600";
    default:
      return "text-gray-600";
  }
}
