import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_URL = "https://api.colddmspro.com/api/v1/campaign";
// export const API_URL = "http://localhost:3000/api/v1/campaign";

export async function addOverlay(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      // Remove old overlay if present
      const existing = document.getElementById("custom-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "custom-overlay";
      overlay.style.position = "fixed";
      overlay.style.top = "0";
      overlay.style.left = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.backgroundColor = "rgba(0, 0, 0, 0.90)";
      overlay.style.zIndex = "10000";
      overlay.style.display = "flex";
      overlay.style.justifyContent = "center";
      overlay.style.alignItems = "center";
      overlay.style.color = "#fff";
      overlay.style.fontFamily = "Arial, sans-serif";
      overlay.style.fontSize = "34px";
      overlay.innerHTML = `
          <div style="text-align: center;">
            ColdDMs <u>Pro</u> is sending messages please keep this tab open.
          </div>
        `;
      document.body.appendChild(overlay);
    },
  });
}
