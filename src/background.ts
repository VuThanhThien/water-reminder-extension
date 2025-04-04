import { logEvent } from "./lib/logger";

interface WorkShift {
  startTime: string;
  endTime: string;
}

interface UserSettings {
  weight: number;
  cupVolume: number;
  workShifts: WorkShift[];
}

interface CalculatedSchedule {
  dailyWaterIntake: number;
  reminderCount: number;
  intervalMinutes: number;
}

let reminderTimer: NodeJS.Timeout | null = null;
let nextReminderTime: Date | null = null;
let currentSettings: {
  userSettings: UserSettings;
  calculatedSchedule: CalculatedSchedule;
} | null = null;
let reminderCount = 0;
let lastResetDate: number | null = null;
let lastReminderTime: Date | null = null;

function resetDailyCount() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  
  if (!lastResetDate || lastResetDate < todayTimestamp) {
    reminderCount = 0;
    lastResetDate = todayTimestamp;
    chrome.storage.local.set({ reminderCount, lastResetDate: todayTimestamp });
  }
}

function isWithinWorkShifts(workShifts: WorkShift[]): boolean {
  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  return workShifts.some(shift => {
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    return currentTime >= startMinutes && currentTime <= endMinutes;
  });
}

function calculateNextReminderTime(settings: {
  userSettings: UserSettings;
  calculatedSchedule: CalculatedSchedule;
}): Date {
  const now = new Date();
  const { intervalMinutes } = settings.calculatedSchedule;
  
  // Nếu chưa có thời điểm nhắc nhở trước đó, tính từ thời điểm hiện tại
  if (!lastReminderTime) {
    return new Date(now.getTime() + intervalMinutes * 60 * 1000);
  }
  
  // Tính thời điểm nhắc nhở tiếp theo
  let nextTime = new Date(lastReminderTime.getTime() + intervalMinutes * 60 * 1000);
  
  // Kiểm tra xem thời điểm tiếp theo có nằm trong ca làm việc không
  if (!isWithinWorkShifts(settings.userSettings.workShifts)) {
    // Tìm ca làm việc tiếp theo
    const nextShift = settings.userSettings.workShifts.find(shift => {
      const [startHour, startMinute] = shift.startTime.split(":").map(Number);
      const shiftStart = new Date(now);
      shiftStart.setHours(startHour, startMinute, 0, 0);
      return shiftStart > now;
    });
    
    if (nextShift) {
      const [startHour, startMinute] = nextShift.startTime.split(":").map(Number);
      nextTime = new Date(now);
      nextTime.setHours(startHour, startMinute, 0, 0);
    } else {
      // Nếu không có ca làm việc tiếp theo, chuyển sang ngày hôm sau
      const firstShift = settings.userSettings.workShifts[0];
      const [startHour, startMinute] = firstShift.startTime.split(":").map(Number);
      nextTime = new Date(now);
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(startHour, startMinute, 0, 0);
    }
  }
  
  return nextTime;
}

async function playNotificationSound() {
  try {
    // Check if there's an existing document before creating new one
    const hasDocument = await chrome.offscreen.hasDocument();
    if (!hasDocument) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL("notification.html"),
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: "notification",
      });
    }
  } catch (error) {
    if (!error.message.startsWith("Only a single offscreen")) {
      logEvent(
        "error",
        "notification",
        "Failed to play notification sound: " + error.message
      );
    }
  }
}

function showNotification() {
  playNotificationSound();
  chrome.notifications.create(
    {
      type: "basic",
      iconUrl: "icon.png",
      title: "Time to Drink Water! 💧",
      message: "Stay hydrated! Take a moment to drink some water.",
      priority: 2,
      requireInteraction: true,
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error("Error showing notification:", chrome.runtime.lastError);
        logEvent(
          "error",
          "notification",
          "Failed to show notification: " + chrome.runtime.lastError.message
        );
      } else {
        logEvent("info", "notification", "Notification shown successfully");
      }
    }
  );
}

function checkAndShowNotification() {
  if (!currentSettings) return;

  resetDailyCount();

  const now = new Date();
  
  // Kiểm tra xem đã đến thời điểm nhắc nhở chưa
  if (nextReminderTime && now >= nextReminderTime) {
    if (isWithinWorkShifts(currentSettings.userSettings.workShifts)) {
      showNotification();
      reminderCount++;
      chrome.storage.local.set({ reminderCount });
      logEvent("info", "reminder", "Water reminder shown");
      
      // Lưu thời điểm nhắc nhở cuối cùng
      lastReminderTime = new Date();
      chrome.storage.local.set({ lastReminderTime: lastReminderTime.getTime() });

      // Tính thời điểm nhắc nhở tiếp theo
      nextReminderTime = calculateNextReminderTime(currentSettings);
      chrome.storage.local.set({
        nextReminderTime: nextReminderTime.getTime(),
      });
    }
  }
}

function startReminder(settings: {
  userSettings: UserSettings;
  calculatedSchedule: CalculatedSchedule;
}) {
  if (reminderTimer) {
    clearInterval(reminderTimer);
  }

  currentSettings = settings;
  const startTimestamp = Date.now();
  
  // Lấy thời điểm nhắc nhở cuối cùng từ storage
  chrome.storage.local.get(["lastReminderTime", "nextReminderTime"], (result) => {
    const now = new Date();
    
    if (result.lastReminderTime) {
      lastReminderTime = new Date(result.lastReminderTime);
    }
    
    if (result.nextReminderTime) {
      nextReminderTime = new Date(result.nextReminderTime);
      
      // Nếu thời điểm nhắc nhở tiếp theo đã qua, tính lại
      if (now >= nextReminderTime) {
        nextReminderTime = calculateNextReminderTime(settings);
      }
    } else {
      // Nếu chưa có thời điểm nhắc nhở tiếp theo, tính từ bây giờ
      nextReminderTime = calculateNextReminderTime(settings);
    }
    
    // Lưu thời điểm nhắc nhở tiếp theo và thời điểm bắt đầu
    chrome.storage.local.set({
      nextReminderTime: nextReminderTime.getTime(),
      startTimestamp: startTimestamp,
    });
    
    // Reset count for new day if needed
    resetDailyCount();
    
    // Kiểm tra ngay lập tức nếu đã đến thời điểm nhắc nhở
    checkAndShowNotification();
    
    // Thiết lập interval để kiểm tra định kỳ
    reminderTimer = setInterval(checkAndShowNotification, 60000); // Kiểm tra mỗi phút
    
    logEvent(
      "info",
      "startReminder",
      `Water reminder started with ${settings.calculatedSchedule.intervalMinutes} minute interval`
    );
  });
}

function stopReminder() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
  currentSettings = null;
  nextReminderTime = null;
  const stopTimestamp = Date.now();
  
  chrome.storage.local.set({
    isEnabled: false,
    stopTimestamp: stopTimestamp,
  });
  
  logEvent("info", "stopReminder", "Water reminder stopped");
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_REMINDER") {
    startReminder(message.settings);
    // Save settings to storage
    chrome.storage.local.set({
      isEnabled: true,
      userSettings: message.settings.userSettings,
      calculatedSchedule: message.settings.calculatedSchedule,
      startTimestamp: Date.now(),
    });
    sendResponse({
      success: true,
      nextReminderTime: nextReminderTime ? nextReminderTime.getTime() : null,
      reminderCount,
    });
  } else if (message.action === "STOP_REMINDER") {
    stopReminder();
    sendResponse({ success: true });
  } else if (message.action === "GET_NEXT_REMINDER") {
    sendResponse({
      nextReminderTime: nextReminderTime ? nextReminderTime.getTime() : null,
      reminderCount,
    });
  }
  return true;
});

// Initialize reminder state from storage when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    [
      "isEnabled",
      "userSettings",
      "calculatedSchedule",
      "reminderCount",
      "lastResetDate",
      "lastReminderTime",
      "nextReminderTime",
      "startTimestamp",
      "stopTimestamp",
    ],
    (result) => {
      reminderCount = result.reminderCount || 0;
      lastResetDate = result.lastResetDate || null;
      
      if (result.lastReminderTime) {
        lastReminderTime = new Date(result.lastReminderTime);
      }
      
      if (result.nextReminderTime) {
        nextReminderTime = new Date(result.nextReminderTime);
      }
      
      resetDailyCount();

      if (result.isEnabled && result.userSettings && result.calculatedSchedule) {
        startReminder({
          userSettings: result.userSettings,
          calculatedSchedule: result.calculatedSchedule,
        });
      }
    }
  );
});

// Initialize reminder state from storage when browser starts
chrome.storage.local.get(
  [
    "isEnabled",
    "userSettings",
    "calculatedSchedule",
    "reminderCount",
    "lastResetDate",
    "lastReminderTime",
    "nextReminderTime",
    "startTimestamp",
    "stopTimestamp",
  ],
  (result) => {
    reminderCount = result.reminderCount || 0;
    lastResetDate = result.lastResetDate || null;
    
    if (result.lastReminderTime) {
      lastReminderTime = new Date(result.lastReminderTime);
    }
    
    if (result.nextReminderTime) {
      nextReminderTime = new Date(result.nextReminderTime);
    }
    
    resetDailyCount();

    if (result.isEnabled && result.userSettings && result.calculatedSchedule) {
      startReminder({
        userSettings: result.userSettings,
        calculatedSchedule: result.calculatedSchedule,
      });
    }
  }
);
