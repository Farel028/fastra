import { auth, firebaseConfig, firestore } from "@/config/firebase";
import { setNotificationImportActiveUid } from "@/services/notificationImportService";
import {
  addNotificationListeners,
  cancelDailyReminderNotifications,
  registerForPushNotificationsAsync,
  saveExpoPushToken,
  scheduleDailyReminderNotifications,
} from "@/services/notificationService";
import {
  AuthActionCode,
  AuthActionResponse,
  AuthContextType,
  UserType,
} from "@/types";
import { devLog } from "@/utils/devLogger";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
  ActionCodeSettings,
  applyActionCode,
  checkActionCode,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  parseActionCodeURL,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";

const AuthContext = createContext<AuthContextType | null>(null);
const EMAIL_VERIFICATION_RETRY_DELAYS_MS = [0, 2000, 5000];
const VERIFY_EMAIL_OPERATION = "VERIFY_EMAIL";
const EMAIL_ACTION_CONTINUE_URL = `https://${firebaseConfig.authDomain}/auth-complete`;
const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

type EmailVerificationState = "verified" | "unverified" | "unknown";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const normalizeUsername = (value: string): string =>
  String(value ?? "").trim().toLowerCase();

const isEmailIdentifier = (value: string): boolean => /\S+@\S+\.\S+/.test(value.trim());

const isValidUsername = (value: string): boolean =>
  USERNAME_PATTERN.test(normalizeUsername(value));

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

  if (code.includes("user-disabled")) {
    return { code: "INVALID_CREDENTIALS", msg: "Account is disabled." };
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

const buildEmailVerificationActionCodeSettings = (): ActionCodeSettings => {
  const actionCodeSettings: ActionCodeSettings = {
    url: EMAIL_ACTION_CONTINUE_URL,
    handleCodeInApp: true,
  };

  const androidPackageName = Constants.expoConfig?.android?.package;
  if (androidPackageName) {
    actionCodeSettings.android = {
      packageName: androidPackageName,
      installApp: true,
    };
  }

  const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier;
  if (iosBundleId) {
    actionCodeSettings.iOS = {
      bundleId: iosBundleId,
    };
  }

  return actionCodeSettings;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserType>(null);
  const router = useRouter();
  const suppressAuthRedirectRef = useRef(false);
  const handledEmailActionCodesRef = useRef<Set<string>>(new Set());

  const updateUserData = useCallback(async (uid: string) => {
    try {
      const docRef = doc(firestore, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const userData: UserType = {
          uid: data?.uid,
          email: data.email || null,
          name: data.name || data.username || null,
          username: data.username || null,
          image: data.image || null,
        };
        setUser({ ...userData });
      }
    } catch (error: any) {
      devLog("error: ", error);
    }
  }, []);

  const resolveEmailFromIdentifier = useCallback(
    async (
      identifier: string,
    ): Promise<{
      success: boolean;
      email?: string;
      msg?: string;
      code?: AuthActionCode;
    }> => {
      const normalizedIdentifier = String(identifier ?? "").trim();
      if (!normalizedIdentifier) {
        return {
          success: false,
          code: "INVALID_CREDENTIALS",
          msg: "Username or email is required.",
        };
      }

      if (isEmailIdentifier(normalizedIdentifier)) {
        return { success: true, email: normalizedIdentifier };
      }

      const normalizedUsername = normalizeUsername(normalizedIdentifier);
      if (!isValidUsername(normalizedUsername)) {
        return {
          success: false,
          code: "INVALID_USERNAME",
          msg: "Username must be 3-20 chars and only use letters, numbers, dot, or underscore.",
        };
      }

      const usernameDoc = await getDoc(
        doc(firestore, "usernames", normalizedUsername),
      );
      if (!usernameDoc.exists()) {
        return {
          success: false,
          code: "USER_NOT_FOUND",
          msg: "Username not found.",
        };
      }

      const data = usernameDoc.data();
      const email = typeof data?.email === "string" ? data.email.trim() : "";
      if (!email) {
        return {
          success: false,
          code: "INVALID_CREDENTIALS",
          msg: "This account is missing an email address.",
        };
      }

      return { success: true, email };
    },
    [],
  );

  const ensureUsernameAvailable = useCallback(async (username: string) => {
    const usernameDoc = await getDoc(
      doc(firestore, "usernames", username),
    );
    return !usernameDoc.exists();
  }, []);

  const handleEmailActionLink = useCallback(
    async (url: string): Promise<boolean> => {
      const action = parseActionCodeURL(url);
      if (!action || action.operation !== VERIFY_EMAIL_OPERATION) {
        return false;
      }

      const actionKey = `${action.operation}:${action.code}`;
      if (handledEmailActionCodesRef.current.has(actionKey)) {
        return true;
      }

      handledEmailActionCodesRef.current.add(actionKey);

      try {
        await checkActionCode(auth, action.code);
        await applyActionCode(auth, action.code);

        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.reload();
          if (currentUser.uid) {
            await updateUserData(currentUser.uid);
          }
        }

        Alert.alert(
          "Email verified",
          "Your email has been verified. You can continue in Fastra.",
        );

        if (auth.currentUser?.emailVerified) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }

        return true;
      } catch (error: any) {
        handledEmailActionCodesRef.current.delete(actionKey);
        devLog("Failed to apply email verification action: ", error);
        Alert.alert(
          "Verification failed",
          error?.message || "This verification link is invalid or has expired.",
        );
        router.replace("/(auth)/login");
        return true;
      }
    },
    [router, updateUserData],
  );

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
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            username: firebaseUser.displayName,
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
  }, [router, updateUserData]);

  useEffect(() => {
    let isMounted = true;

    const processUrl = async (url: string | null) => {
      if (!isMounted || !url) return;

      try {
        const handled = await handleEmailActionLink(url);
        if (handled) {
          devLog("Handled email action URL.", url);
        }
      } catch (error) {
        devLog("Failed to process incoming auth URL: ", error);
      }
    };

    void Linking.getInitialURL().then(processUrl);
    const sub = Linking.addEventListener("url", ({ url }) => {
      void processUrl(url);
    });

    return () => {
      isMounted = false;
      sub.remove();
    };
  }, [handleEmailActionLink]);

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
    identifier: string,
    password: string,
  ): Promise<AuthActionResponse> => {
    try {
      const resolved = await resolveEmailFromIdentifier(identifier);
      if (!resolved.success || !resolved.email) {
        return {
          success: false,
          msg: resolved.msg,
          code: resolved.code,
        };
      }

      const response = await signInWithEmailAndPassword(
        auth,
        resolved.email,
        password,
      );

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
    username: string,
    email: string,
    password: string,
  ): Promise<AuthActionResponse> => {
    try {
      const normalizedEmail = String(email ?? "").trim();
      const normalizedUsername = normalizeUsername(username);

      if (!normalizedEmail) {
        return {
          success: false,
          code: "INVALID_EMAIL",
          msg: "Email is required.",
        };
      }

      if (!isValidUsername(normalizedUsername)) {
        return {
          success: false,
          code: "INVALID_USERNAME",
          msg: "Username must be 3-20 chars and only use letters, numbers, dot, or underscore.",
        };
      }

      const usernameAvailable = await ensureUsernameAvailable(normalizedUsername);
      if (!usernameAvailable) {
        return {
          success: false,
          code: "USERNAME_IN_USE",
          msg: "Username is already in use.",
        };
      }

      const response = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        password,
      );

      await updateProfile(response.user, {
        displayName: normalizedUsername,
      });

      await setDoc(doc(firestore, "users", response.user.uid), {
        uid: response.user.uid,
        email: normalizedEmail,
        name: normalizedUsername,
        username: normalizedUsername,
      });

      await setDoc(doc(firestore, "usernames", normalizedUsername), {
        uid: response.user.uid,
        email: normalizedEmail,
        username: normalizedUsername,
      });

      await sendEmailVerification(
        response.user,
        buildEmailVerificationActionCodeSettings(),
      );
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
    identifier: string,
    password: string,
  ): Promise<AuthActionResponse> => {
    let signedInTemporarily = false;

    try {
      suppressAuthRedirectRef.current = true;

      const normalizedIdentifier = String(identifier ?? "").trim();
      const normalizedPassword = String(password ?? "");

      if (!normalizedIdentifier || !normalizedPassword) {
        return {
          success: false,
          msg: "Username/email and password are required to resend verification email.",
          code: "INVALID_CREDENTIALS",
        };
      }

      const resolved = await resolveEmailFromIdentifier(normalizedIdentifier);
      if (!resolved.success || !resolved.email) {
        return {
          success: false,
          msg: resolved.msg,
          code: resolved.code,
        };
      }

      const response = await signInWithEmailAndPassword(
        auth,
        resolved.email,
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

      await sendEmailVerification(
        response.user,
        buildEmailVerificationActionCodeSettings(),
      );

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
        username: refreshedUser.displayName,
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
