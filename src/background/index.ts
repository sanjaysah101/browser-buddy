// Background script
let ports = new Set<chrome.runtime.Port>();

type Domain = string;

// Store website visit data
interface WebsiteVisit {
  url: string;
  domain: Domain;
  startTime: number;
  endTime?: number;
  duration?: number;
}

interface WebsiteCategory {
  domain: Domain;
  category: "productive" | "neutral" | "unproductive";
}

interface WebsiteStats {
  totalTime: number;
  visits: number;
  category: WebsiteCategory["category"];
}

// Track current and historical visits
let currentVisit: WebsiteVisit | null = null;
const websiteStats = new Map<Domain, WebsiteStats>();

// Add this after other global variables
const defaultCategories: { [key: Domain]: WebsiteCategory["category"] } = {
  "github.com": "productive",
  "stackoverflow.com": "productive",
  "chat.openai.com": "productive",
  "youtube.com": "unproductive",
  "facebook.com": "unproductive",
  "twitter.com": "unproductive",
  "instagram.com": "unproductive",
};

// Add this near the top of the file
let activeTabId: number | null = null;

// Helper to get domain from URL
function getDomain(url: string): Domain {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

// Update handleTabChange function
async function handleTabChange(tab: chrome.tabs.Tab) {
  if (!tab.url || tab.url.startsWith("chrome://")) return;

  const now = Date.now();

  // End current visit if exists
  if (currentVisit) {
    currentVisit.endTime = now;
    currentVisit.duration = now - currentVisit.startTime;
    await updateStats(currentVisit);
  }

  // Only start new visit if this is the active tab
  if (tab.id === activeTabId) {
    currentVisit = {
      url: tab.url,
      domain: getDomain(tab.url),
      startTime: now,
    };
  }
}

// Update tab listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(activeTabId);
  await handleTabChange(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === activeTabId) {
    await handleTabChange(tab);
  }
});

// Add listener for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    if (currentVisit) {
      const now = Date.now();
      currentVisit.endTime = now;
      currentVisit.duration = now - currentVisit.startTime;
      updateStats(currentVisit);
      currentVisit = null;
    }
    activeTabId = null;
  }
});

async function getWebsiteCategory(
  domain: Domain
): Promise<WebsiteCategory["category"]> {
  // Return default category if available
  if (defaultCategories[domain]) {
    return defaultCategories[domain];
  }

  // Get saved categories asynchronously
  const result = await chrome.storage.local.get(["websiteCategories"]);
  if (result.websiteCategories?.[domain]) {
    return result.websiteCategories[domain];
  }

  return "neutral";
}

// Update updateStats to handle async
async function updateStats(visit: WebsiteVisit) {
  const category = await getWebsiteCategory(visit.domain);
  const stats = websiteStats.get(visit.domain) || {
    totalTime: 0,
    visits: 0,
    category,
  };

  stats.totalTime += visit.duration || 0;
  stats.visits += 1;
  websiteStats.set(visit.domain, stats);

  // Calculate productivity score
  const productivityScore = calculateProductivityScore();

  // Notify connected ports about stats update
  broadcastUpdate();
}

function calculateProductivityScore(): number {
  let productiveTime = 0;
  let unproductiveTime = 0;
  let totalTime = 0;

  websiteStats.forEach((stats, domain) => {
    totalTime += stats.totalTime;
    if (stats.category === "productive") {
      productiveTime += stats.totalTime;
    } else if (stats.category === "unproductive") {
      unproductiveTime += stats.totalTime;
    }
  });

  if (totalTime === 0) return 100;
  return Math.round((productiveTime / totalTime) * 100);
}

// Add a helper function to broadcast updates
function broadcastUpdate() {
  const data = Array.from(websiteStats.entries());
  const productivityScore = calculateProductivityScore();

  const message = {
    type: "STATS_UPDATE",
    data,
    productivityScore,
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
        productivityScore: calculateProductivityScore(),
      });
    }
    if (message.type === "UPDATE_CATEGORY") {
      const { domain, category } = message;
      const stats = websiteStats.get(domain);
      if (stats) {
        stats.category = category;
        websiteStats.set(domain, stats);

        // Save category to chrome.storage
        chrome.storage.local.get(["websiteCategories"], (result) => {
          const categories = result.websiteCategories || {};
          categories[domain] = category;
          chrome.storage.local.set({ websiteCategories: categories });
        });

        // Broadcast update to all connected ports
        broadcastUpdate();
      }
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
