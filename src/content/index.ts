// Content script
let port: chrome.runtime.Port | undefined;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000;

function connectToExtension() {
  if (isConnecting) return;

  isConnecting = true;
  console.log("Connecting to extension", { attempt: reconnectAttempts + 1 });

  try {
    port = chrome.runtime.connect({
      name: "content-script",
      // Add persistent connection flag
      includeTlsChannelId: true,
    });

    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      console.log("Disconnected from extension", { error });

      // Clear the port since it's no longer valid
      port = undefined;
      isConnecting = false;

      // Always try to reconnect on disconnect, regardless of error
      if (document.visibilityState === "visible") {
        setTimeout(connectToExtension, RECONNECT_DELAY);
      }
    });

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    isConnecting = false;
    console.log("Successfully connected to extension");

    // Send initial message to keep connection alive
    port.postMessage({ type: "PING" });
  } catch (e) {
    console.error("Failed to connect:", e);
    isConnecting = false;
    reconnectAttempts++;
  }
}

// Handle tab visibility changes
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Try to reconnect when tab becomes visible
    if (!port) {
      console.log("Tab became visible, attempting to reconnect");
      connectToExtension();
    }
  } else {
    // Cleanup when tab is hidden
    console.log("Tab hidden, cleaning up connection");
    cleanup();
  }
});

// Initial connection
if (document.visibilityState === "visible") {
  connectToExtension();
}

function cleanup() {
  if (port) {
    try {
      port.disconnect();
    } catch (e) {
      console.error("Error disconnecting port:", e);
    }
    port = undefined;
  }
  isConnecting = false;
  reconnectAttempts = 0;
}

// Cleanup when the content script is unloaded
window.addEventListener("unload", cleanup);

// Keep connection alive with periodic pings
setInterval(() => {
  if (port && document.visibilityState === "visible") {
    try {
      port.postMessage({ type: "PING" });
    } catch (e) {
      console.error("Error sending ping:", e);
      cleanup();
      connectToExtension();
    }
  }
}, 20000); // Send ping every 20 seconds
