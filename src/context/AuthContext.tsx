import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface DbAuthUser {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  roleSlug: string;
  organizationId: number | null;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: DbAuthUser | null;
  idToken: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logoutFirebase: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  partnerToken: string | null;
  partnerUser: DbAuthUser | null;
  setPartnerSession: (token: string | null, user: DbAuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  dbUser: null,
  idToken: null,
  loading: true,
  signInWithGoogle: async () => {},
  logoutFirebase: async () => {},
  refreshProfile: async () => {},
  partnerToken: null,
  partnerUser: null,
  setPartnerSession: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbAuthUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [partnerToken, setPartnerToken] = useState<string | null>(null);
  const [partnerUser, setPartnerUser] = useState<DbAuthUser | null>(null);

  const syncWithBackend = async (fbUser: FirebaseUser) => {
    try {
      const token = await fbUser.getIdToken();
      setIdToken(token);
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (err) {
      console.error('Auth profile sync failed:', err);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        await syncWithBackend(fbUser);
      } else {
        setIdToken(null);
        setDbUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    if (result.user) {
      await syncWithBackend(result.user);
    }
  };

  const logoutFirebase = async () => {
    await signOut(auth);
    setIdToken(null);
    setDbUser(null);
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await syncWithBackend(firebaseUser);
    }
  };

  const setPartnerSession = (token: string | null, user: DbAuthUser | null) => {
    setPartnerToken(token);
    setPartnerUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        idToken,
        loading,
        signInWithGoogle,
        logoutFirebase,
        refreshProfile,
        partnerToken,
        partnerUser,
        setPartnerSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
