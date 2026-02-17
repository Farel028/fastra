import { firestore } from "@/config/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const DAILY_REMINDER_IDS_KEY = "@entrack:dailyReminderNotificationIds:v1";
const DAILY_REMINDER_NAME_KEY = "@entrack:dailyReminderNotificationName:v1";

const WEEKDAY_DAYS = [2, 3, 4, 5, 6];
const WEEKEND_DAYS = [1, 7];

type ReminderTemplate = {
  hour: number;
  minute: number;
  title: string;
  body: string;
};

const WEEKDAY_REMINDERS: ReminderTemplate[] = [
  {
    hour: 6,
    minute: 0,
    title: "sudah siap melangkah?",
    body: "Mulai dengan Entrack.",
  },
  {
    hour: 12,
    minute: 0,
    title: "jernihkan siangmu.",
    body: "Luangkan waktu untuk Entrack.",
  },
  {
    hour: 16,
    minute: 0,
    title: "udah sejauh apa hari ini?",
    body: "Jangan biarkan harimu berlalu tanpa Entrack.",
  },
  {
    hour: 21,
    minute: 0,
    title: "hari ini sudah selesai?",
    body: "Tutup dengan Entrack.",
  },
];

const WEEKEND_REMINDERS: ReminderTemplate[] = [
  {
    hour: 6,
    minute: 0,
    title: "nikmati pagimu.",
    body: "Rencanakan weekend dengan Entrack",
  },
  {
    hour: 12,
    minute: 0,
    title: "istirahat, lalu cek.",
    body: "Pastikan weekend terkendali.",
  },
  {
    hour: 16,
    minute: 0,
    title: "apa yang sudah kamu nikmati?",
    body: "Catat di Entrack.",
  },
  {
    hour: 21,
    minute: 0,
    title: "hari hampir selesai.",
    body: "Simpan semuanya di Entrack.",
  },
];

type PlannedReminder = ReminderTemplate & {
  weekday: number;
  dayType: "weekday" | "weekend";
};

const buildWeeklyReminderPlan = (): PlannedReminder[] => [
  ...WEEKDAY_DAYS.flatMap((weekday) =>
    WEEKDAY_REMINDERS.map((reminder) => ({
      ...reminder,
      weekday,
      dayType: "weekday" as const,
    })),
  ),
  ...WEEKEND_DAYS.flatMap((weekday) =>
    WEEKEND_REMINDERS.map((reminder) => ({
      ...reminder,
      weekday,
      dayType: "weekend" as const,
    })),
  ),
];

const getFirstName = (fullName?: string | null): string | null => {
  if (!fullName) return null;

  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName || null;
};

const getProjectId = (): string => {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing EAS projectId in app config");
  }

  return projectId;
};

export const registerForPushNotificationsAsync = async (): Promise<
  string | null
> => {
  if (Platform.OS === "web") {
    console.log("Push notifications are not supported on web.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  if (!Device.isDevice) {
    console.log("Push notifications only work on physical devices.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted.");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId: getProjectId(),
  });

  return token.data;
};

export const saveExpoPushToken = async (
  uid: string,
  expoPushToken: string,
): Promise<void> => {
  const userRef = doc(firestore, "users", uid);
  await setDoc(
    userRef,
    {
      expoPushToken,
      expoPushTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true },
  );
};

export const addNotificationListeners = (
  onReceive?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void,
): (() => void) => {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      onReceive?.(notification);
    },
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      onResponse?.(response);
    },
  );

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
};

const getStoredDailyReminderIds = async (): Promise<string[]> => {
  try {
    const rawValue = await AsyncStorage.getItem(DAILY_REMINDER_IDS_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((id) => typeof id === "string");
  } catch {
    return [];
  }
};

export const cancelDailyReminderNotifications = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  const ids = await getStoredDailyReminderIds();
  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch (error) {
        console.log("Failed to cancel notification: ", id, error);
      }
    }),
  );

  await AsyncStorage.removeItem(DAILY_REMINDER_IDS_KEY);
  await AsyncStorage.removeItem(DAILY_REMINDER_NAME_KEY);
};

const hasAllDailyRemindersScheduled = async (
  firstName: string | null,
): Promise<boolean> => {
  const reminderPlan = buildWeeklyReminderPlan();
  const ids = await getStoredDailyReminderIds();
  if (ids.length !== reminderPlan.length) return false;

  const storedName = await AsyncStorage.getItem(DAILY_REMINDER_NAME_KEY);
  const expectedName = firstName || "";
  if ((storedName || "") !== expectedName) return false;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledIds = new Set(scheduled.map((item) => item.identifier));

  return ids.every((id) => scheduledIds.has(id));
};

export const scheduleDailyReminderNotifications = async (
  fullName?: string | null,
): Promise<void> => {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const firstName = getFirstName(fullName);

  if (await hasAllDailyRemindersScheduled(firstName)) {
    return;
  }

  await cancelDailyReminderNotifications();

  const reminderPlan = buildWeeklyReminderPlan();
  const ids: string[] = [];
  for (const reminder of reminderPlan) {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: firstName
          ? `Hey ${firstName}, ${reminder.title}`
          : reminder.title,
        body: reminder.body,
        sound: "default",
        data: {
          type: "weekly_reminder",
          dayType: reminder.dayType,
          weekday: reminder.weekday,
          firstName,
          hour: reminder.hour,
          minute: reminder.minute,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: reminder.weekday,
        hour: reminder.hour,
        minute: reminder.minute,
        channelId: "default",
      },
    });

    ids.push(notificationId);
  }

  await AsyncStorage.setItem(DAILY_REMINDER_IDS_KEY, JSON.stringify(ids));
  await AsyncStorage.setItem(DAILY_REMINDER_NAME_KEY, firstName || "");
};
