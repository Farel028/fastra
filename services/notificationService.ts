import { firestore } from "@/config/firebase";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { devLog } from "@/utils/devLogger";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const MANAGED_REMINDER_PREFIX = "entrack:reminder:";
const MANAGED_REMINDER_SOURCE = "entrack_auto_reminder_v2";
const LEGACY_REMINDER_TYPES = new Set(["daily_reminder", "weekly_reminder"]);

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
    body: "Mulai dengan Fastra.",
  },
  {
    hour: 12,
    minute: 0,
    title: "jernihkan siangmu.",
    body: "Luangkan waktu untuk Fastra.",
  },
  {
    hour: 16,
    minute: 0,
    title: "udah sejauh apa hari ini?",
    body: "Jangan biarkan harimu berlalu tanpa Fastra.",
  },
  {
    hour: 21,
    minute: 0,
    title: "hari ini sudah selesai?",
    body: "Tutup dengan Fastra.",
  },
];

const WEEKEND_REMINDERS: ReminderTemplate[] = [
  {
    hour: 6,
    minute: 0,
    title: "nikmati pagimu.",
    body: "Rencanakan weekend dengan Fastra",
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
    body: "Catat di Fastra.",
  },
  {
    hour: 21,
    minute: 0,
    title: "hari hampir selesai.",
    body: "Simpan semuanya di Fastra.",
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

const getReminderTitle = (title: string, firstName: string | null): string => {
  return firstName ? `Hey ${firstName}, ${title}` : title;
};

const buildReminderIdentifier = (reminder: PlannedReminder): string => {
  const hh = reminder.hour.toString().padStart(2, "0");
  const mm = reminder.minute.toString().padStart(2, "0");
  return `${MANAGED_REMINDER_PREFIX}${reminder.dayType}:${reminder.weekday}:${hh}:${mm}`;
};

const isManagedReminder = (
  request: Notifications.NotificationRequest,
): boolean => {
  const data = request.content.data as Record<string, unknown> | undefined;
  const source = typeof data?.source === "string" ? data.source : null;
  const legacyType = typeof data?.type === "string" ? data.type : null;

  return (
    request.identifier.startsWith(MANAGED_REMINDER_PREFIX) ||
    source === MANAGED_REMINDER_SOURCE ||
    (legacyType ? LEGACY_REMINDER_TYPES.has(legacyType) : false)
  );
};

const getManagedScheduledReminders = async (): Promise<
  Notifications.NotificationRequest[]
> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter(isManagedReminder);
};

let reminderTaskQueue = Promise.resolve();

const enqueueReminderTask = async (task: () => Promise<void>): Promise<void> => {
  const currentTask = reminderTaskQueue.then(task, task);
  reminderTaskQueue = currentTask.catch(() => undefined);
  await currentTask;
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
    devLog("Push notifications are not supported on web.");
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
    devLog("Push notifications only work on physical devices.");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    devLog("Push notification permission not granted.");
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

const cancelDailyReminderNotificationsInternal = async (): Promise<void> => {
  if (Platform.OS === "web") return;

  const managedReminders = await getManagedScheduledReminders();
  await Promise.all(
    managedReminders.map(async (item) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      } catch (error) {
        devLog("Failed to cancel notification: ", item.identifier, error);
      }
    }),
  );
};

export const cancelDailyReminderNotifications = async (): Promise<void> => {
  await enqueueReminderTask(cancelDailyReminderNotificationsInternal);
};

const hasAllDailyRemindersScheduled = async (
  firstName: string | null,
): Promise<boolean> => {
  const reminderPlan = buildWeeklyReminderPlan();
  const managedReminders = await getManagedScheduledReminders();
  if (managedReminders.length !== reminderPlan.length) return false;

  const reminderMap = new Map(
    managedReminders.map((item) => [item.identifier, item]),
  );

  for (const reminder of reminderPlan) {
    const expectedIdentifier = buildReminderIdentifier(reminder);
    const existing = reminderMap.get(expectedIdentifier);
    if (!existing) return false;

    const expectedTitle = getReminderTitle(reminder.title, firstName);
    if (existing.content.title !== expectedTitle) return false;
  }

  return true;
};

const scheduleDailyReminderNotificationsInternal = async (
  fullName?: string | null,
): Promise<void> => {
  if (Platform.OS === "web") return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const firstName = getFirstName(fullName);

  if (await hasAllDailyRemindersScheduled(firstName)) {
    return;
  }

  await cancelDailyReminderNotificationsInternal();

  const reminderPlan = buildWeeklyReminderPlan();
  for (const reminder of reminderPlan) {
    const identifier = buildReminderIdentifier(reminder);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: getReminderTitle(reminder.title, firstName),
        body: reminder.body,
        sound: "default",
        data: {
          source: MANAGED_REMINDER_SOURCE,
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
  }
};

export const scheduleDailyReminderNotifications = async (
  fullName?: string | null,
): Promise<void> => {
  await enqueueReminderTask(() =>
    scheduleDailyReminderNotificationsInternal(fullName),
  );
};
