"use client";

import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { firebaseAuth } from "@/lib/firebase";
import { cricketApi, setApiAuthToken } from "@/services/api";

type AuthContextValue = {
  loading: boolean;
  firebaseUser: User | null;
  token: string | null;
  user: any | null;
  player: any | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [player, setPlayer] = useState<any | null>(null);

  const syncWithBackend = async (nextUser: User, forceRefresh = false) => {
    console.log("[auth] syncWithBackend start", {
      uid: nextUser.uid,
      forceRefresh,
      hasCurrentUser: Boolean(firebaseAuth.currentUser),
    });
    const idToken = await nextUser.getIdToken(forceRefresh);
    console.log("[auth] token ready", {
      hasToken: Boolean(idToken),
      tokenLength: idToken ? idToken.length : 0,
    });
    setApiAuthToken(idToken);
    setToken(idToken);

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log("[auth] REQUEST START /auth/me");
        const response = await cricketApi.authMe();
        console.log("[auth] REQUEST COMPLETED /auth/me", {
          status: response.status,
        });
        setUser(response.data.user ?? null);
        setPlayer(response.data.player ?? response.data.user?.player ?? null);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await delay(250 * attempt);
          continue;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Authentication sync failed");
  };

  const refreshSession = async () => {
    if (!firebaseAuth.currentUser) {
      console.log("[auth] refreshSession skipped: no current user");
      setApiAuthToken(null);
      setToken(null);
      setUser(null);
      setPlayer(null);
      return;
    }

    await syncWithBackend(firebaseAuth.currentUser, true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      try {
        console.log("[auth] onAuthStateChanged", {
          uid: nextUser?.uid ?? null,
          email: nextUser?.email ?? null,
          hasUser: Boolean(nextUser),
        });
        setFirebaseUser(nextUser);

        if (!nextUser) {
          setApiAuthToken(null);
          setToken(null);
          setUser(null);
          setPlayer(null);
          return;
        }

        await syncWithBackend(nextUser, true);
      } catch {
        setApiAuthToken(null);
        setToken(null);
        setUser(null);
        setPlayer(null);
      } finally {
        console.log("[auth] loading complete");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
    console.log("[auth] Google login successful", {
      uid: result.user.uid,
      email: result.user.email ?? null,
    });
    const popupToken = await result.user.getIdToken(true);
    console.log("[auth] popup token ready", {
      hasToken: Boolean(popupToken),
      tokenLength: popupToken ? popupToken.length : 0,
    });
    await syncWithBackend(result.user, true);
  };

  const logout = async () => {
    await signOut(firebaseAuth);
    setApiAuthToken(null);
    setToken(null);
    setUser(null);
    setPlayer(null);
    setFirebaseUser(null);
  };

  const value = useMemo(
    () => ({
      loading,
      firebaseUser,
      token,
      user,
      player,
      signInWithGoogle,
      logout,
      refreshSession,
    }),
    [loading, firebaseUser, token, user, player, signInWithGoogle, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
