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
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});

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
          // Reset loading state for all domains when we get an update
          setIsLoading({});
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

  const handleAICategorizationClick = async (domain: string) => {
    if (!port) {
      console.error("No active connection to the extension");
      return;
    }

    try {
      setIsLoading((prev) => ({ ...prev, [domain]: true }));
      port.postMessage({
        type: "REQUEST_AI_CATEGORIZATION",
        domain,
      });
      // Loading state will be cleared when we receive the STATS_UPDATE message
    } catch (error) {
      console.error("Error requesting AI categorization:", error);
      setIsLoading((prev) => ({ ...prev, [domain]: false }));
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">ProductivityPal</h1>
        <div className="text-sm text-gray-500">Track your productivity</div>
      </div>

      {/* Productivity Score */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <div className="text-lg font-semibold text-gray-700 mb-2">
          Productivity Score
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold text-green-600">
            {productivityScore}%
          </span>
          <span className="text-sm text-gray-500 mb-1">
            of your time is productive
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-green-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${productivityScore}%` }}
          />
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex mb-4 border-b">
        {["stats", "categories"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors
              ${
                selectedTab === tab
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            onClick={() => setSelectedTab(tab as "stats" | "categories")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedTab === "stats" ? (
        <div className="space-y-3">
          {stats
            .sort(([, a], [, b]) => b.totalTime - a.totalTime)
            .map(([domain, stats]) => (
              <div
                key={domain}
                className="p-4 bg-white rounded-lg shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div
                    className="font-medium text-gray-800 truncate"
                    title={domain}
                  >
                    {domain}
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${getCategoryBadgeStyle(
                      stats.category
                    )}`}
                  >
                    {stats.category}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-600">
                    Time: {formatTime(stats.totalTime)}
                  </div>
                  <div className="text-gray-600">Visits: {stats.visits}</div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map(([domain, stats]) => (
            <div
              key={domain}
              className="p-4 bg-white rounded-lg shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div
                  className="font-medium text-gray-800 truncate min-w-0"
                  title={domain}
                >
                  {domain}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <select
                    value={stats.category}
                    onChange={(e) =>
                      updateCategory(
                        domain,
                        e.target.value as WebsiteStats["category"]
                      )
                    }
                    className="px-3 py-1.5 text-sm border rounded-md bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors w-[120px]"
                  >
                    <option value="productive">Productive</option>
                    <option value="neutral">Neutral</option>
                    <option value="unproductive">Unproductive</option>
                  </select>
                  <button
                    onClick={() => handleAICategorizationClick(domain)}
                    disabled={isLoading[domain]}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 whitespace-nowrap
                      ${
                        isLoading[domain]
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      }`}
                    title="Use AI to categorize this website"
                  >
                    {isLoading[domain] ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 shrink-0"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Analyzing</span>
                      </>
                    ) : (
                      <>
                        <span className="shrink-0">🤖</span>
                        <span>AI Categorize</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function getCategoryBadgeStyle(category: WebsiteStats["category"]): string {
  switch (category) {
    case "productive":
      return "bg-green-100 text-green-800";
    case "unproductive":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
