export interface GoogleUser {
  accessToken: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  channelTitle?: string;
  expiresAt: number;
}

export interface AuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  isLoggingIn: boolean;
  authError: string | null;
  clearAuthError: () => void;
  clientId: string;
}
