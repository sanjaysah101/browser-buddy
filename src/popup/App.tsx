import type React from "react";
import { useEffect, useState } from "react";

interface WebsiteStats {
  totalTime: number;
  visits: number;
}

export const App: React.FC = () => {
  const [stats, setStats] = useState<[string, WebsiteStats][]>([]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" });

    port.onMessage.addListener((message) => {
      console.log("message", message);
      if (message.type === "INITIAL_STATS" || message.type === "STATS_UPDATE") {
        setStats(message.data);
      }
    });

    // Request initial stats
    port.postMessage({ type: "GET_STATS" });

    return () => port.disconnect();
  }, []);

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
      <p className="mt-2 mb-4 text-gray-600">Website Activity Tracking</p>

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
            </div>
          ))}
      </div>
    </div>
  );
};
