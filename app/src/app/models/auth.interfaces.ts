export interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  roles: string[];
  email: string;
  name: string;
  userId: string;
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
