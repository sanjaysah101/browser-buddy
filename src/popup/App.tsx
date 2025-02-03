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
  const [selectedTab, setSelectedTab] = useState<
    "stats" | "categories" | "settings"
  >("stats");
  const [port, setPort] = useState<chrome.runtime.Port | null>(null);
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  const [breakInterval, setBreakInterval] = useState(30); // minutes
  const [breakDuration, setBreakDuration] = useState(5); // minutes
  const [updateStatus, setUpdateStatus] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  }>({ show: false, success: false, message: "" });

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
          if (message.breakSettings) {
            setBreakInterval(message.breakSettings.breakInterval);
            setBreakDuration(message.breakSettings.breakDuration);
          }
          setIsLoading({});
        }

        if (message.type === "BREAK_SETTINGS_UPDATED") {
          setUpdateStatus({
            show: true,
            success: message.success,
            message: message.success
              ? "Break settings updated successfully!"
              : message.error || "Failed to update break settings",
          });

          // Hide the status message after 3 seconds
          setTimeout(() => {
            setUpdateStatus((prev) => ({ ...prev, show: false }));
          }, 3000);
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

  const updateBreakSettings = () => {
    if (!port) return;
    port.postMessage({
      type: "UPDATE_BREAK_SETTINGS",
      breakInterval: breakInterval * 60 * 1000, // convert to milliseconds
      breakDuration: breakDuration * 60 * 1000,
    });
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

      {/* Tabs */}
      <div className="flex space-x-2 mb-4">
        <button
          onClick={() => setSelectedTab("stats")}
          className={`px-3 py-1 rounded ${
            selectedTab === "stats" ? "bg-blue-500 text-white" : "bg-gray-100"
          }`}
        >
          Stats
        </button>
        <button
          onClick={() => setSelectedTab("categories")}
          className={`px-3 py-1 rounded ${
            selectedTab === "categories"
              ? "bg-blue-500 text-white"
              : "bg-gray-100"
          }`}
        >
          Categories
        </button>
        <button
          onClick={() => setSelectedTab("settings")}
          className={`px-3 py-1 rounded ${
            selectedTab === "settings"
              ? "bg-blue-500 text-white"
              : "bg-gray-100"
          }`}
        >
          Settings
        </button>
      </div>

      {/* Status Message */}
      {updateStatus.show && (
        <div
          className={`fixed top-4 right-4 p-3 rounded-lg shadow-lg text-sm ${
            updateStatus.success
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          {updateStatus.message}
        </div>
      )}

      {/* Settings Tab Content */}
      {selectedTab === "settings" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Break Reminder Settings</h2>
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Break Interval (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={breakInterval}
                onChange={(e) => setBreakInterval(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Break Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                value={breakDuration}
                onChange={(e) => setBreakDuration(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2"
              />
            </div>
            <button
              onClick={updateBreakSettings}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

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
      ) : selectedTab === "categories" ? (
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
      ) : null}
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
