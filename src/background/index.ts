// Background script
let ports = new Set<chrome.runtime.Port>();

// Store website visit data
interface WebsiteVisit {
  url: string;
  domain: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface WebsiteStats {
  totalTime: number;
  visits: number;
}

// Track current and historical visits
let currentVisit: WebsiteVisit | null = null;
const websiteStats = new Map<WebsiteVisit["domain"], WebsiteStats>();

// Helper to get domain from URL
function getDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

// Triggers when user switches tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  handleTabChange(tab);
});

// Triggers when a tab's URL changes
chrome.tabs.onUpdated.addListener(async (_, changeInfo, tab) => {
  if (changeInfo.url) {
    handleTabChange(tab);
  }
});

function handleTabChange(tab: chrome.tabs.Tab) {
  if (!tab.url || tab.url.startsWith("chrome://")) return;

  // End current visit if exists
  if (currentVisit) {
    const now = Date.now();
    currentVisit.endTime = now;
    currentVisit.duration = now - currentVisit.startTime;
    updateStats(currentVisit);
  }

  // Start new visit
  currentVisit = {
    url: tab.url,
    domain: getDomain(tab.url),
    startTime: Date.now(),
  };
}

function updateStats(visit: WebsiteVisit) {
  const stats = websiteStats.get(visit.domain) || { totalTime: 0, visits: 0 };
  stats.totalTime += visit.duration || 0;
  stats.visits += 1;
  websiteStats.set(visit.domain, stats);

  // Notify connected ports about stats update
  const message = {
    type: "STATS_UPDATE",
    data: {
      domain: visit.domain,
      stats: stats,
    },
  };

  ports.forEach((port) => {
    try {
      port.postMessage(message);
    } catch (e) {
      console.error("Error sending stats update:", e);
    }
  });
}

// Connection handling
chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
  ports.add(port);

  // Send initial stats when popup connects
  if (port.name === "popup") {
    port.postMessage({
      type: "INITIAL_STATS",
      data: Array.from(websiteStats.entries()),
    });
  }

  port.onMessage.addListener((message) => {
    if (message.type === "GET_STATS") {
      port.postMessage({
        type: "STATS_UPDATE",
        data: Array.from(websiteStats.entries()),
      });
    }
  });

  port.onDisconnect.addListener(() => {
    ports.delete(port);
  });
});

// Store stats periodically
setInterval(() => {
  chrome.storage.local.set({
    websiteStats: Array.from(websiteStats.entries()),
  });
}, 60000); // Every minute

// Load saved stats on startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["websiteStats"], (result) => {
    if (result.websiteStats) {
      websiteStats.clear();
      result.websiteStats.forEach(([domain, stats]: [string, WebsiteStats]) => {
        websiteStats.set(domain, stats);
      });
    }
  });
});

// Cleanup when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  ports = new Set(); // Reset ports
});

// Handle extension context invalidation
chrome.runtime.onSuspend.addListener(() => {
  console.log("Extension suspended", ports);
  ports.forEach((port) => {
    try {
      port.disconnect();
    } catch (e) {
      console.error("Error disconnecting port:", e);
    }
  });
  ports.clear();
});
