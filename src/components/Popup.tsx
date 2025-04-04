import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MagicCard } from "@/components/ui/magic-card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "./ui/button";
import { logEvent } from "@/lib/logger";

interface WorkShift {
  startTime: string;
  endTime: string;
}

interface UserSettings {
  weight: number;
  cupVolume: number;
  workShifts: WorkShift[];
}

interface LoadingCircleProps {
  size?: number;
}

const LoadingCircle: React.FC<LoadingCircleProps> = ({ size = 4 }) => {
  return (
    <svg
      aria-hidden="true"
      className={`h-${size} w-${size} animate-spin fill-stone-600 text-stone-200`}
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
  );
};

// Công thức tính lượng nước cần uống mỗi ngày (ml)
const calculateDailyWaterIntake = (weight: number): number => {
  // Công thức: 35ml/kg cân nặng
  return Math.round(weight * 35);
};

// Tính tổng thời gian làm việc (phút)
const calculateTotalWorkMinutes = (shifts: WorkShift[]): number => {
  return shifts.reduce((total, shift) => {
    const [startHour, startMinute] = shift.startTime.split(":").map(Number);
    const [endHour, endMinute] = shift.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return total + (endMinutes - startMinutes);
  }, 0);
};

// Tính số lần nhắc nhở và khoảng thời gian giữa các lần
const calculateReminderSchedule = (
  dailyWaterIntake: number,
  cupVolume: number,
  totalWorkMinutes: number
): { reminderCount: number; intervalMinutes: number } => {
  const reminderCount = Math.ceil(dailyWaterIntake / cupVolume);
  const intervalMinutes = Math.floor(totalWorkMinutes / reminderCount);

  return { reminderCount, intervalMinutes };
};

export const Popup = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    weight: 70,
    cupVolume: 250,
    workShifts: [{ startTime: "09:00", endTime: "18:00" }],
  });
  const [nextReminderTime, setNextReminderTime] = useState<Date | null>(null);
  const [reminderCount, setReminderCount] = useState(0);
  const [calculatedSchedule, setCalculatedSchedule] = useState<{
    dailyWaterIntake: number;
    reminderCount: number;
    intervalMinutes: number;
  } | null>(null);

  useEffect(() => {
    // Load settings from storage when component mounts
    chrome.storage.local.get(
      ["isEnabled", "userSettings", "nextReminderTime", "reminderCount"],
      (result) => {
        setIsActive(result.isEnabled || false);
        if (result.userSettings) {
          setUserSettings(result.userSettings);
        }
        if (result.nextReminderTime) {
          setNextReminderTime(new Date(result.nextReminderTime));
        }
        setReminderCount(result.reminderCount || 0);
        setIsLoading(false);
      }
    );
  }, []);

  // Tính toán lịch nhắc nhở khi thông tin người dùng thay đổi
  useEffect(() => {
    const dailyWaterIntake = calculateDailyWaterIntake(userSettings.weight);
    const totalWorkMinutes = calculateTotalWorkMinutes(userSettings.workShifts);
    const { reminderCount, intervalMinutes } = calculateReminderSchedule(
      dailyWaterIntake,
      userSettings.cupVolume,
      totalWorkMinutes
    );

    setCalculatedSchedule({
      dailyWaterIntake,
      reminderCount,
      intervalMinutes,
    });
  }, [userSettings]);

  // Update countdown timer
  useEffect(() => {
    if (!isActive || !nextReminderTime) return;

    const timer = setInterval(() => {
      const now = new Date();
      const timeLeft = nextReminderTime.getTime() - now.getTime();

      if (timeLeft <= 0) {
        // Request next reminder time from background
        chrome.runtime.sendMessage(
          { action: "GET_NEXT_REMINDER" },
          (response) => {
            if (response.nextReminderTime) {
              setNextReminderTime(new Date(response.nextReminderTime));
            }
            if (response.reminderCount !== undefined) {
              setReminderCount(response.reminderCount);
            }
          }
        );
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, nextReminderTime]);

  const handleStart = async () => {
    setIsActive(true);
    setStatusMessage("Water reminder started!");

    // Save settings to storage
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          isEnabled: true,
          userSettings,
        },
        () => resolve()
      );
    });

    // Send message to background script to start reminders
    chrome.runtime.sendMessage(
      {
        action: "START_REMINDER",
        settings: {
          userSettings,
          calculatedSchedule,
        },
      },
      (response) => {
        if (response.success) {
          if (response.nextReminderTime) {
            setNextReminderTime(new Date(response.nextReminderTime));
          }
          if (response.reminderCount !== undefined) {
            setReminderCount(response.reminderCount);
          }
          logEvent(
            "info",
            "startReminder",
            "Water reminder started successfully"
          );
        } else {
          setStatusMessage("Failed to start reminder. Please try again.");
          logEvent("error", "startReminder", "Failed to start reminder");
        }
      }
    );
  };

  const handleStop = async () => {
    setIsActive(false);
    setStatusMessage("Water reminder stopped!");

    // Save settings to storage
    await new Promise<void>((resolve) => {
      chrome.storage.local.set(
        {
          isEnabled: false,
        },
        () => resolve()
      );
    });

    // Send message to background script to stop reminders
    chrome.runtime.sendMessage(
      {
        action: "STOP_REMINDER",
      },
      (response) => {
        if (response.success) {
          logEvent(
            "info",
            "stopReminder",
            "Water reminder stopped successfully"
          );
        } else {
          setStatusMessage("Failed to stop reminder. Please try again.");
          logEvent("error", "stopReminder", "Failed to stop reminder");
        }
      }
    );
  };

  const addWorkShift = () => {
    setUserSettings((prev) => ({
      ...prev,
      workShifts: [
        ...prev.workShifts,
        { startTime: "09:00", endTime: "18:00" },
      ],
    }));
  };

  const removeWorkShift = (index: number) => {
    setUserSettings((prev) => ({
      ...prev,
      workShifts: prev.workShifts.filter((_, i) => i !== index),
    }));
  };

  const updateWorkShift = (
    index: number,
    field: keyof WorkShift,
    value: string
  ) => {
    setUserSettings((prev) => ({
      ...prev,
      workShifts: prev.workShifts.map((shift, i) =>
        i === index ? { ...shift, [field]: value } : shift
      ),
    }));
  };

  return (
    <MagicCard
      className="w-full max-w-[500px] custom-scrollbar"
      gradientColor={"#3b83f68c"}
      gradientSize={25}
      gradientOpacity={0.2}
      gradientFrom={"#3B82F6"}
      gradientTo={"#3B82F6"}
    >
      <Card className="bg-transparent border-none z-0 w-[450px]">
        <CardHeader className="border-b">
          <div className="flex">
            <CardTitle className="text-2xl font-bold mr-auto">
              Water Reminder
            </CardTitle>
            <p className="text-xs text-muted-foreground ml-auto my-auto">
              v1.0.0
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Stay hydrated throughout your day!
          </p>
        </CardHeader>
        <CardContent className="px-2 space-y-8 mt-6 mb-2">
          <div className="w-full flex flex-col px-4">
            {isLoading ? (
              <>
                <div className="flex flex-col m-auto">
                  <div className="m-auto">
                    <LoadingCircle size={10} />
                  </div>
                  <Label className="block text-md font-medium mt-4 mb-4 text-center">
                    Loading Settings...
                  </Label>
                </div>
              </>
            ) : (
              <>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {!isLoading && !error && (
                  <>
                    <div className="space-y-4">
                      {isActive && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-2 bg-blue-100 rounded-lg">
                            <p className="text-sm font-medium text-blue-800">
                              Reminders today: {reminderCount}
                            </p>
                          </div>
                          {nextReminderTime && (
                            <div className="text-center p-2 bg-green-100 rounded-lg">
                              <p className="text-sm font-medium text-green-800">
                                Next reminder in:{" "}
                                {Math.max(
                                  0,
                                  Math.floor(
                                    (nextReminderTime.getTime() -
                                      new Date().getTime()) /
                                      1000 /
                                      60
                                  )
                                )}{" "}
                                minutes
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Your Weight (kg)
                        </Label>
                        <Input
                          type="number"
                          value={userSettings.weight}
                          onChange={(e) =>
                            setUserSettings((prev) => ({
                              ...prev,
                              weight: Number(e.target.value),
                            }))
                          }
                          min={30}
                          max={200}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Cup Volume (ml)
                        </Label>
                        <Input
                          type="number"
                          value={userSettings.cupVolume}
                          onChange={(e) =>
                            setUserSettings((prev) => ({
                              ...prev,
                              cupVolume: Number(e.target.value),
                            }))
                          }
                          min={100}
                          max={500}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="text-sm font-medium">
                            Work Shifts
                          </Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addWorkShift}
                          >
                            Add Shift
                          </Button>
                        </div>
                        {userSettings.workShifts.map((shift, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <Input
                              type="time"
                              value={shift.startTime}
                              onChange={(e) =>
                                updateWorkShift(
                                  index,
                                  "startTime",
                                  e.target.value
                                )
                              }
                              className="flex-1"
                            />
                            <span>to</span>
                            <Input
                              type="time"
                              value={shift.endTime}
                              onChange={(e) =>
                                updateWorkShift(
                                  index,
                                  "endTime",
                                  e.target.value
                                )
                              }
                              className="flex-1"
                            />
                            {userSettings.workShifts.length > 1 && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeWorkShift(index)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      {calculatedSchedule && (
                        <div className="space-y-2 p-4 bg-gray-50 rounded-lg text-black">
                          <h3 className="font-medium">Calculated Schedule</h3>
                          <p className="text-sm">
                            Daily water intake:{" "}
                            {calculatedSchedule.dailyWaterIntake}ml
                          </p>
                          <p className="text-sm">
                            Reminders per day:{" "}
                            {calculatedSchedule.reminderCount} times
                          </p>
                          <p className="text-sm">
                            Interval between reminders:{" "}
                            {calculatedSchedule.intervalMinutes} minutes
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="w-full p-0 flex flex-col">
          {statusMessage && (
            <div className="w-full">
              <Alert className="w-full rounded-none">
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            </div>
          )}
          {isLoading ? (
            <></>
          ) : (
            <>
              <Button
                variant="outline"
                className={`p-6 font-bold text-[16px] w-full rounded-none ${
                  isActive
                    ? "bg-red-900 border-red-700 hover:bg-red-800 hover:text-white text-white"
                    : "bg-green-900 border-green-700 hover:bg-green-800 hover:text-white text-white"
                }`}
                onClick={isActive ? handleStop : handleStart}
              >
                {isActive ? "STOP REMINDER" : "START REMINDER"}
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </MagicCard>
  );
};
