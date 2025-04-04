export const DM_EVENT = "DM_EVENT";
export const CLOSE_TAB = "CLOSE_TAB";
export const GET_ACCESS_TOKEN = "GET_ACCESS_TOKEN";
export type LogEntry = {
  timestamp: string;
  type: "error" | "warning" | "info";
  funcName: string;
  message: string;
};

export const logEvent = (
  type: "error" | "warning" | "info",
  funcName: string,
  message: any
): void => {
  let newMessage: string;

  if (message instanceof Error) {
    newMessage = message.message;
  } else if (typeof message === "string") {
    newMessage = message;
  } else {
    try {
      newMessage = `Unknown Error Type: ${JSON.stringify(message)}`;
    } catch (e) {
      newMessage = "Unknown Error Type: Error in stringifying object";
    }
  }

  const newLog: LogEntry = {
    timestamp: new Date().toISOString().slice(0, -5).replace("T", " "),
    type: type,
    funcName: funcName,
    message: newMessage,
  };

  chrome.storage.local.get(["logs"], (result) => {
    const existingLogs: LogEntry[] = result.logs || [];
    const updatedLogs = [...existingLogs, newLog];

    chrome.storage.local.set({ logs: updatedLogs }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving logs:", chrome.runtime.lastError);
      } else {
        console.log("Log saved:", newLog);
      }
    });
  });
};

export const getStoredLogs = async (): Promise<LogEntry[]> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(["logs"], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result?.logs || []);
      }
    });
  });
};

export const clearStoredLogs = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ logs: [] }, () => {
      if (chrome.runtime.lastError) {
        logEvent("error", "clearStoredLogs", chrome.runtime.lastError);
        reject();
      } else {
        logEvent("info", "clearStoredLogs", "All logs are deleted!");
        resolve();
      }
    });
  });
};