import { categorizeWebsite } from "../services/geminiAI";

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

// Add these constants at the top with other global variables
const BREAK_REMINDER_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds
const BREAK_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
let lastBreakTime: number = Date.now();
let breakNotificationId: string | null = null;

// Add these interfaces and message handlers to handle break settings
interface BreakSettings {
  breakInterval: number;
  breakDuration: number;
}

// Add to the top with other global variables
let breakSettings: BreakSettings = {
  breakInterval: BREAK_REMINDER_INTERVAL,
  breakDuration: BREAK_DURATION,
};

// Add these variables to track break state
let isOnBreak = false;
let breakTimer: NodeJS.Timeout | null = null;

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
    // Check for break reminder when tab changes
    await checkBreakReminder();
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
      productivityScore: calculateProductivityScore(),
      breakSettings: {
        breakInterval: breakSettings.breakInterval / (60 * 1000), // convert to minutes
        breakDuration: breakSettings.breakDuration / (60 * 1000),
      },
      breakStatus: {
        isOnBreak,
        lastBreakTime,
        nextBreakTime: lastBreakTime + breakSettings.breakInterval,
      },
    });
  }

  port.onMessage.addListener(async (message) => {
    if (message.type === "GET_STATS") {
      port.postMessage({
        type: "STATS_UPDATE",
        data: Array.from(websiteStats.entries()),
        productivityScore: calculateProductivityScore(),
      });
    } else if (message.type === "UPDATE_CATEGORY") {
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
    } else if (message.type === "REQUEST_AI_CATEGORIZATION") {
      try {
        const { domain } = message;
        console.log("Requesting AI categorization for:", domain);

        // Get AI-generated category
        const aiCategory = await categorizeWebsite(domain);
        console.log("AI categorization result:", aiCategory);

        // Update stats with AI category
        const stats = websiteStats.get(domain);
        if (stats) {
          stats.category = aiCategory;
          websiteStats.set(domain, stats);

          // Save AI-generated category
          chrome.storage.local.get(["websiteCategories"], (result) => {
            const categories = result.websiteCategories || {};
            categories[domain] = aiCategory;
            chrome.storage.local.set({ websiteCategories: categories });
          });

          // Broadcast update to all connected ports
          broadcastUpdate();
        }
      } catch (error) {
        console.error("Error in AI categorization:", error);
      }
    } else if (message.type === "UPDATE_BREAK_SETTINGS") {
      try {
        const { breakInterval, breakDuration } = message;
        breakSettings = {
          breakInterval,
          breakDuration,
        };

        // Save settings to storage
        await chrome.storage.local.set({ breakSettings });

        // Reset break timer if currently on break
        if (isOnBreak) {
          endBreak();
        }

        // Reset last break time to avoid immediate notification
        lastBreakTime = Date.now();

        // Send success response
        port.postMessage({
          type: "BREAK_SETTINGS_UPDATED",
          success: true,
        });

        // Broadcast new break status
        broadcastBreakStatus();
      } catch (error) {
        console.error("Error updating break settings:", error);
        port.postMessage({
          type: "BREAK_SETTINGS_UPDATED",
          success: false,
          error: "Failed to update break settings",
        });
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
  if (breakTimer) {
    clearTimeout(breakTimer);
  }
});

// Add this function to check if a break is needed
async function checkBreakReminder() {
  const now = Date.now();
  const timeSinceLastBreak = now - lastBreakTime;

  // Only show reminder if not currently on break and enough time has passed
  if (
    !isOnBreak &&
    timeSinceLastBreak >= breakSettings.breakInterval &&
    currentVisit
  ) {
    // Create break notification
    const notificationId = "break-reminder-" + now;
    chrome.notifications.create(notificationId, {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: "Time for a Break!",
      message: `You've been working for ${Math.floor(
        timeSinceLastBreak / 60000
      )} minutes. Take a ${Math.floor(
        breakSettings.breakDuration / 60000
      )}-minute break!`,
      buttons: [{ title: "Start Break" }, { title: "Dismiss" }],
      requireInteraction: true,
    });
    breakNotificationId = notificationId;
  }
}

// Add notification click handler
chrome.notifications.onButtonClicked.addListener(
  (notificationId, buttonIndex) => {
    if (notificationId === breakNotificationId) {
      if (buttonIndex === 0) {
        // Start Break
        startBreak();
      } else {
        // Dismiss
        chrome.notifications.clear(notificationId);
      }
      breakNotificationId = null;
    }
  }
);

// Add these helper functions to manage breaks
function startBreak() {
  isOnBreak = true;
  lastBreakTime = Date.now();

  // Clear any existing break timer
  if (breakTimer) {
    clearTimeout(breakTimer);
  }

  // Create break start notification
  chrome.notifications.create("break-start", {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "Break Time",
    message: `Your ${Math.floor(
      breakSettings.breakDuration / 60000
    )}-minute break has started. Stretch and rest your eyes!`,
    requireInteraction: false,
  });

  // Set timer for break end
  breakTimer = setTimeout(() => {
    endBreak();
  }, breakSettings.breakDuration);
}

function endBreak() {
  isOnBreak = false;

  // Clear break timer
  if (breakTimer) {
    clearTimeout(breakTimer);
    breakTimer = null;
  }

  // Create break end notification
  chrome.notifications.create("break-end", {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "Break Ended",
    message: "Time to get back to work!",
    requireInteraction: true,
  });

  // Broadcast break end to all connected ports
  broadcastBreakStatus();
}

// Add function to broadcast break status
function broadcastBreakStatus() {
  ports.forEach((port) => {
    try {
      port.postMessage({
        type: "BREAK_STATUS",
        isOnBreak,
        lastBreakTime,
        nextBreakTime: lastBreakTime + breakSettings.breakInterval,
      });
    } catch (error) {
      console.error("Error broadcasting break status:", error);
    }
  });
}

// Load break settings on startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["breakSettings"], (result) => {
    if (result.breakSettings) {
      breakSettings = result.breakSettings;
    }
  });
});
