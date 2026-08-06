import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api, ApiError } from "@/lib/api";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  level: number;
  xp: number;
  maxXp: number;
  avatar: string;
  wellnessScore: number;
  streak: number;
  onboardingCompleted: boolean;
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  phone?: string;
  country?: string;
  countryCode?: string;
  dialCode?: string;
  phoneNumber?: string;
  currency?: string;
  currencyCode?: string;
  phoneVerified?: boolean;
  preferredLocale?: string;
  status?: string;
  verifiedCompanion?: boolean;
  companionVerificationStatus?: string;
  isAvailableAsCompanion?: boolean;
  subscription?: {
    planName?: string;
    status?: string;
  };
}

interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: any) => Promise<CurrentUser>;
  register: (data: any) => Promise<CurrentUser>;
  logout: () => void;
  updateProfile: (data: any) => Promise<void>;
  completeOnboarding: (answers: any, wellnessScore: number) => Promise<void>;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  exportAccountData: () => Promise<Blob>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate token and fetch profile on mount
  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem("mindcare_token");
      if (!token) {
        setIsLoading(false);
        return;
      }

      const maxRetries = 3;
      const retryDelay = 3000;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const profile = await api.auth.getProfile();
          const mappedUser = {
            ...profile,
            id: profile.id || profile._id,
          };
          setUser(mappedUser);
          setIsLoading(false);
          return;
        } catch (err: any) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 404)) {
            console.log("[AUTH] Stale or invalid session token detected, clearing local token storage.");
            localStorage.removeItem("mindcare_token");
            setIsLoading(false);
            return;
          }
          if (err instanceof ApiError && err.status === 500 && attempt < maxRetries - 1) {
            console.warn(`[AUTH] Server error (attempt ${attempt + 1}/${maxRetries}), retrying in ${retryDelay}ms...`);
            await new Promise(r => setTimeout(r, retryDelay));
            continue;
          }
          console.error("Failed to load user profile on start:", err);
          localStorage.removeItem("mindcare_token");
          setIsLoading(false);
          return;
        }
      }
      setIsLoading(false);
    }

    loadUser();
  }, []);

  const login = async (credentials: any): Promise<CurrentUser> => {
    setError(null);
    setIsLoading(true);
    try {
      const loggedUser = await api.auth.login(credentials);
      const mappedUser: CurrentUser = {
        ...loggedUser,
        id: loggedUser.id || loggedUser._id,
      };
      setUser(mappedUser);
      return mappedUser;
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: any): Promise<CurrentUser> => {
    setError(null);
    setIsLoading(true);
    try {
      const registeredUser = await api.auth.register(data);
      const mappedUser: CurrentUser = {
        ...registeredUser,
        id: registeredUser.id || registeredUser._id,
      };
      setUser(mappedUser);
      return mappedUser;
    } catch (err: any) {
      setError(err.message || "Registration failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
    setError(null);
    try { sessionStorage.clear(); } catch { /* ignore */ }
  };

  const updateProfile = async (data: any) => {
    setError(null);
    try {
      const updatedUser = await api.auth.updateProfile(data);
      const mappedUser = {
        ...updatedUser,
        id: updatedUser.id || updatedUser._id,
      };
      setUser(mappedUser);
    } catch (err: any) {
      setError(err.message || "Update profile failed");
      throw err;
    }
  };

  const completeOnboarding = async (answers: any, wellnessScore: number) => {
    setError(null);
    try {
      const updatedUser = await api.auth.completeOnboarding({ answers, wellnessScore });
      const mappedUser = {
        ...updatedUser,
        id: updatedUser.id || updatedUser._id,
      };
      setUser(mappedUser);
    } catch (err: any) {
      setError(err.message || "Onboarding submission failed");
      throw err;
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.auth.getProfile();
      const mappedUser = {
        ...profile,
        id: profile.id || profile._id,
      };
      setUser(mappedUser);
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  };

  const deleteAccount = async () => {
    setError(null);
    try {
      await api.auth.deleteAccount();
      setUser(null);
      try { sessionStorage.clear(); } catch { /* ignore */ }
    } catch (err: any) {
      setError(err.message || "Delete account failed");
      throw err;
    }
  };

  const exportAccountData = async () => {
    return await api.auth.exportAccountData();
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateProfile,
    completeOnboarding,
    clearError,
    refreshProfile,
    deleteAccount,
    exportAccountData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
