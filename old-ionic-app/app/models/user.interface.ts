export interface UserInterface {
  id: string;
  name: string;
  email: string;
}
export interface AuthInterface {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;
  roles: string[];
}
