import React, { createContext, useContext, useState, useEffect } from 'react';
import { GoogleUser, AuthContextType } from '@/types/auth';
import { api } from '@/lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_CLIENT_ID = '370278236610-qa33h70cttb3732145vn86va8f03uuaa.apps.googleusercontent.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string>(DEFAULT_CLIENT_ID);
  const [tokenClient, setTokenClient] = useState<any>(null);

  // 1. Fetch public config (Google Client ID) & restore persistent user session from DB
  useEffect(() => {
    const initAuth = async () => {
      // Step A: Load Client ID
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.google_client_id && data.google_client_id.trim()) {
            setClientId(data.google_client_id.trim());
          }
        }
      } catch (err) {
        console.warn('Could not fetch backend config, using default Client ID:', err);
      }

      // Step B: Check Database for existing persistent session
      try {
        const authMe = await api.getCurrentUser();
        if (authMe.is_authenticated && authMe.user && authMe.access_token) {
          setUser({
            accessToken: authMe.access_token,
            name: authMe.user.name || 'YouTube Creator',
            email: authMe.user.email,
            avatarUrl: authMe.user.picture,
            channelTitle: authMe.user.channel_title,
            expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days active
          });
        }
      } catch (err) {
        console.warn('Session check note:', err);
      }
    };

    initAuth();
  }, []);

  // 2. Initialize Google Token Client when Google script loads and clientId is ready
  useEffect(() => {
    if (!clientId) return;

    const initClient = () => {
      if ((window as any).google?.accounts?.oauth2) {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
            callback: async (response: any) => {
              setIsLoggingIn(false);
              if (response.error) {
                console.error('Google OAuth Callback Error:', response);
                let msg = `Google OAuth Error: ${response.error}`;
                if (response.error_description) {
                  msg += ` (${response.error_description})`;
                }
                if (response.error === 'popup_closed_by_user') {
                  msg = 'Google login popup was closed before completing authorization.';
                } else if (response.error === 'access_denied') {
                  msg = 'Access denied. Please approve YouTube upload permissions to proceed.';
                }
                setAuthError(msg);
                return;
              }

              if (response.access_token) {
                setAuthError(null);
                try {
                  // Persist user and token in Database so they remain logged in across visits
                  const dbAuth = await api.loginUser({
                    access_token: response.access_token,
                    expires_in: Number(response.expires_in) || 3600,
                  });

                  const newUser: GoogleUser = {
                    accessToken: dbAuth.access_token || response.access_token,
                    name: dbAuth.user?.name || 'YouTube Creator',
                    email: dbAuth.user?.email,
                    avatarUrl: dbAuth.user?.picture,
                    channelTitle: dbAuth.user?.channel_title,
                    expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000,
                  };
                  setUser(newUser);
                } catch (saveErr: any) {
                  console.error('Failed to persist user session in DB:', saveErr);
                  // Fallback in-memory
                  setUser({
                    accessToken: response.access_token,
                    name: 'YouTube Creator',
                    expiresAt: Date.now() + (Number(response.expires_in) || 3600) * 1000,
                  });
                }
              }
            },
            error_callback: (err: any) => {
              if (err && err.type === 'popup_failed_to_open') {
                setIsLoggingIn(false);
                setAuthError('Popup blocked: Please allow popups for this site in your browser URL bar.');
              }
            },
          });
          setTokenClient(client);
        } catch (e: any) {
          console.warn('Google Token Client init note:', e);
        }
      }
    };

    if ((window as any).google?.accounts?.oauth2) {
      initClient();
    } else {
      const timer = setInterval(() => {
        if ((window as any).google?.accounts?.oauth2) {
          initClient();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [clientId]);

  const login = () => {
    setAuthError(null);
    if (tokenClient) {
      setIsLoggingIn(true);
      try {
        tokenClient.requestAccessToken({ prompt: '' });
      } catch (err: any) {
        setIsLoggingIn(false);
        setAuthError(`Failed to request access token: ${err?.message || err}`);
      }
    } else {
      if (!(window as any).google?.accounts?.oauth2) {
        setAuthError('Google Identity Services script is still loading. Please wait a moment and retry.');
      } else {
        setAuthError('Google Auth Client not initialized. Please verify your Google Client ID.');
      }
    }
  };

  const logout = async () => {
    try {
      await api.logoutUser();
    } catch (e) {
      console.warn('Logout note:', e);
    }
    setUser(null);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        logout,
        isLoggingIn,
        authError,
        clearAuthError,
        clientId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
