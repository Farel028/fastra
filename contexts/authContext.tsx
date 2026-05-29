import { auth, firestore } from "@/config/firebase";
import {
  addNotificationListeners,
  cancelDailyReminderNotifications,
  registerForPushNotificationsAsync,
  scheduleDailyReminderNotifications,
  saveExpoPushToken,
} from "@/services/notificationService";
import { setNotificationImportActiveUid } from "@/services/notificationImportService";
import {
  AuthActionCode,
  AuthActionResponse,
  AuthContextType,
  UserType,
} from "@/types";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  signInWithEmailAndPassword,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { devLog } from "@/utils/devLogger";

const AuthContext = createContext<AuthContextType | null>(null);
const EMAIL_VERIFICATION_RETRY_DELAYS_MS = [0, 2000, 5000];

type EmailVerificationState = "verified" | "unverified" | "unknown";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const mapAuthError = (error: any): { msg: string; code: AuthActionCode } => {
  const code = String(error?.code ?? "");

  if (code.includes("invalid-credential")) {
    return { code: "INVALID_CREDENTIALS", msg: "Wrong credentials" };
  }

  if (code.includes("invalid-email")) {
    return { code: "INVALID_EMAIL", msg: "Invalid email" };
  }

  if (code.includes("too-many-requests")) {
    return { code: "TOO_MANY_REQUESTS", msg: "Too many attempts. Try again later." };
  }

  if (code.includes("user-not-found")) {
    return { code: "USER_NOT_FOUND", msg: "Email not found." };
  }

  if (code.includes("network-request-failed")) {
    return {
      code: "NETWORK_ERROR",
      msg: "Network error. Please check your connection and try again.",
    };
  }

  return { code: "UNKNOWN", msg: error?.message || "Authentication failed." };
};

const resolveEmailVerificationState = async (
  firebaseUser: FirebaseUser,
): Promise<EmailVerificationState> => {
  if (firebaseUser.emailVerified) return "verified";

  for (let attempt = 0; attempt < EMAIL_VERIFICATION_RETRY_DELAYS_MS.length; attempt++) {
    const waitMs = EMAIL_VERIFICATION_RETRY_DELAYS_MS[attempt];
    if (waitMs > 0) await sleep(waitMs);

    try {
      await firebaseUser.reload();
      return firebaseUser.emailVerified ? "verified" : "unverified";
    } catch (error) {
      devLog(
        `Failed to refresh email verification state (${attempt + 1}/${EMAIL_VERIFICATION_RETRY_DELAYS_MS.length})`,
        error,
      );
    }
  }

  return "unknown";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserType>(null);
  const router = useRouter();
  const suppressAuthRedirectRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (suppressAuthRedirectRef.current) return;

      try {
        if (firebaseUser) {
          const verificationState =
            await resolveEmailVerificationState(firebaseUser);

          if (!isMounted) return;

          if (verificationState === "unverified") {
            setUser(null);
            router.replace("/(auth)/welcome");
            return;
          }

          if (verificationState === "unknown") {
            devLog(
              "Using cached auth session because verification status could not be refreshed.",
            );
          }

          setUser({
            uid: firebaseUser?.uid,
            email: firebaseUser?.email,
            name: firebaseUser?.displayName,
          });
          void updateUserData(firebaseUser.uid);
          router.replace("/(tabs)");
          return;
        }

        if (!isMounted) return;
        setUser(null);
        router.replace("/(auth)/welcome");
      } catch (error) {
        devLog("Auth state check failed: ", error);
        if (!isMounted) return;
        setUser(null);
        router.replace("/(auth)/welcome");
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [router]);

  useEffect(() => {
    const removeListeners = addNotificationListeners();
    return removeListeners;
  }, []);

  useEffect(() => {
    void setNotificationImportActiveUid(user?.uid ?? null);
  }, [user?.uid]);

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
        devLog("Failed to register push token: ", error);
      }
    };

    syncPushToken();
  }, [user?.uid, user?.name]);

  const login = async (
    email: string,
    password: string,
  ): Promise<AuthActionResponse> => {
    try {
      const response = await signInWithEmailAndPassword(auth, email, password);
      if (!response.user.emailVerified) {
        const verificationState = await resolveEmailVerificationState(
          response.user,
        );

        if (verificationState === "verified") {
          return { success: true };
        }

        await signOut(auth);

        if (verificationState === "unknown") {
          return {
            success: false,
            msg: "Unable to verify your email due to network issues. Please try again on a stable connection.",
          };
        }

        return {
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          msg: "Please verify your email first. Check inbox or spam, then login again.",
        };
      }

      return { success: true };
    } catch (error: any) {
      const parsed = mapAuthError(error);
      return { success: false, msg: parsed.msg, code: parsed.code };
    }
  };
  const register = async (
    email: string,
    password: string,
    name: string,
  ): Promise<AuthActionResponse> => {
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
      const code = String(error?.code ?? "");

      if (code.includes("email-already-in-use")) {
        return {
          success: false,
          msg: "This email is already in use",
        };
      }

      if (code.includes("weak-password")) {
        return {
          success: false,
          msg: "Password should be at least 6 characters.",
        };
      }

      const parsed = mapAuthError(error);
      return { success: false, msg: parsed.msg, code: parsed.code };
    }
  };

  const resendVerificationEmail = async (
    email: string,
    password: string,
  ): Promise<AuthActionResponse> => {
    let signedInTemporarily = false;

    try {
      suppressAuthRedirectRef.current = true;

      const normalizedEmail = String(email ?? "").trim();
      const normalizedPassword = String(password ?? "");

      if (!normalizedEmail || !normalizedPassword) {
        return {
          success: false,
          msg: "Email and password are required to resend verification email.",
          code: "INVALID_CREDENTIALS",
        };
      }

      const response = await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        normalizedPassword,
      );
      signedInTemporarily = true;

      await response.user.reload();
      if (response.user.emailVerified) {
        return {
          success: false,
          msg: "Your email is already verified. Please login.",
        };
      }

      await sendEmailVerification(response.user);

      return {
        success: true,
        msg: "Verification email sent. Please check inbox or spam.",
      };
    } catch (error: any) {
      const parsed = mapAuthError(error);
      return { success: false, msg: parsed.msg, code: parsed.code };
    } finally {
      if (signedInTemporarily) {
        try {
          await signOut(auth);
        } catch (error) {
          devLog("Failed to sign out after resending verification email: ", error);
        }
      }

      suppressAuthRedirectRef.current = false;
    }
  };

  const forgotPassword = async (email: string): Promise<AuthActionResponse> => {
    try {
      const normalizedEmail = String(email ?? "").trim();
      if (!normalizedEmail) {
        return {
          success: false,
          msg: "Email is required.",
          code: "INVALID_EMAIL",
        };
      }

      await sendPasswordResetEmail(auth, normalizedEmail);
      return {
        success: true,
        msg: "Password reset email has been sent. Please check inbox or spam.",
      };
    } catch (error: any) {
      const parsed = mapAuthError(error);
      return { success: false, msg: parsed.msg, code: parsed.code };
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
      devLog("error: ", error);
    }
  };

  const refreshAuthSession = async () => {
    try {
      const firebaseUser = auth.currentUser;

      if (!firebaseUser) {
        setUser(null);
        router.replace("/(auth)/welcome");
        return { success: false, msg: "No active session." };
      }

      await firebaseUser.reload();
      const refreshedUser = auth.currentUser;

      if (!refreshedUser) {
        setUser(null);
        router.replace("/(auth)/welcome");
        return { success: false, msg: "Session expired. Please login again." };
      }

      const verificationState = await resolveEmailVerificationState(refreshedUser);

      if (verificationState === "unverified") {
        setUser(null);
        await signOut(auth);
        router.replace("/(auth)/welcome");
        return {
          success: false,
          msg: "Please verify your email first.",
        };
      }

      if (verificationState === "unknown") {
        devLog(
          "Manual auth refresh could not confirm verification state. Continuing with cached session.",
        );
      }

      setUser({
        uid: refreshedUser.uid,
        email: refreshedUser.email,
        name: refreshedUser.displayName,
      });

      await updateUserData(refreshedUser.uid);

      return {
        success: true,
        msg:
          verificationState === "unknown"
            ? "Unable to fully verify email status, but session was refreshed."
            : undefined,
      };
    } catch (error: any) {
      devLog("Failed to refresh auth session: ", error);
      return {
        success: false,
        msg: error?.message || "Failed to refresh auth session.",
      };
    }
  };

  const contextValue: AuthContextType = {
    user,
    setUser,
    login,
    register,
    resendVerificationEmail,
    forgotPassword,
    updateUserData,
    refreshAuthSession,
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
