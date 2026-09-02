export interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  roles: string[];
  email: string;
  name: string;
  userId: string;
  /** Go modules enabled for this user account (e.g. ["sabeeapp_go"]) — from GET /users/me. */
  subscription: string[];
}

/** GET /users/me response shape (one element, returned as an array). */
export interface MeResponse {
  user_id: string;
  name: string;
  email: string;
  role: string;
  subscription: string[];
}

export interface MfaTokenResponse {
  mfa_token: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  roles: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  errors: unknown;
}
