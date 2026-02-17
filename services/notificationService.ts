import { firestore } from "@/config/firebase";
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
