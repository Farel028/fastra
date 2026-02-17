import { auth, firestore } from "@/config/firebase";
import {
  addNotificationListeners,
  cancelDailyReminderNotifications,
  registerForPushNotificationsAsync,
  scheduleDailyReminderNotifications,
  saveExpoPushToken,
} from "@/services/notificationService";
import { AuthContextType, UserType } from "@/types";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserType>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          await firebaseUser.reload();

          if (!firebaseUser.emailVerified) {
            setUser(null);
            router.replace("/(auth)/welcome");
            return;
          }

          setUser({
            uid: firebaseUser?.uid,
            email: firebaseUser?.email,
            name: firebaseUser?.displayName,
          });
          updateUserData(firebaseUser.uid);
          router.replace("/(tabs)");
          return;
        }

        setUser(null);
        router.replace("/(auth)/welcome");
      } catch (error) {
        console.log("Auth state check failed: ", error);
        setUser(null);
        router.replace("/(auth)/welcome");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    const removeListeners = addNotificationListeners();
    return removeListeners;
  }, []);

  useEffect(() => {
    const syncPushToken = async () => {
      try {
        if (!user?.uid) {
          await cancelDailyReminderNotifications();
          return;
        }

        const token = await registerForPushNotificationsAsync();
        if (token) {
          await saveExpoPushToken(user.uid, token);
        }

        await scheduleDailyReminderNotifications(user?.name ?? null);
      } catch (error) {
        console.log("Failed to register push token: ", error);
      }
    };

    syncPushToken();
  }, [user?.uid, user?.name]);

  const login = async (email: string, password: string) => {
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      await response.user.reload();

      if (!response.user.emailVerified) {
        await signOut(auth);
        return {
          success: false,
          msg: "Please verify your email first. Check inbox or spam, then login again.",
        };
      }

      return { success: true };
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("(auth/invalid-credential)")) msg = "Wrong credentials";
      if (msg.includes("(auth/invalid-email)")) msg = "Invalid email";
      if (msg.includes("(auth/too-many-requests)"))
        msg = "Too many attempts. Try again later.";
      return { success: false, msg };
    }
  };
  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await setDoc(doc(firestore, "users", response?.user?.uid), {
        name,
        email,
        uid: response?.user?.uid,
      });
      await sendEmailVerification(response.user);
      await signOut(auth);
      return {
        success: true,
        msg: "Account created. Please verify your email before logging in.",
      };
    } catch (error: any) {
      let msg = error.message;
      if (msg.includes("(auth/email-already-in-use)"))
        msg = "This email is already in use";
      if (msg.includes("(auth/invalid-email)")) msg = "Invalid email";
      if (msg.includes("(auth/weak-password)"))
        msg = "Password should be at least 6 characters.";
      return { success: false, msg };
    }
  };

  const updateUserData = async (uid: string) => {
    try {
      const docRef = doc(firestore, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const userData: UserType = {
          uid: data?.uid,
          email: data.email || null,
          name: data.name || null,
          image: data.image || null,
        };
        setUser({ ...userData });
      }
    } catch (error: any) {
      let msg = error.message;
      //   return { success: false, msg };
      console.log("error: ", error);
    }
  };

  const contextValue: AuthContextType = {
    user,
    setUser,
    login,
    register,
    updateUserData,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be wrapped inside AuthProvider");
  }
  return context;
};
