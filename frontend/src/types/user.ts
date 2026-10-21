export type Role = 'farmer' | 'admin' | 'agent';

export type AuthProvider = 'password' | 'google';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  wallet: string;
  joinedAt: string;
  lga?: string;
  phone?: string;
  title?: string;
  provider?: AuthProvider;
  avatarUrl?: string;
  emailVerified?: boolean;
  bio?: string;
  farmSizeHa?: number;
  primaryCrop?: string;
  village?: string;
  lastSignInAt?: string;
  twoFactor?: boolean;
}

// There is deliberately no `StoredUser` here. It used to pair with a
// `passwordHash` field, which meant the browser was storing credential
// material at all — F-3. Passwords now live only in the backend's user store,
// so `User` is the whole shape the frontend is ever allowed to see.

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  lga: string;
  password: string;
}

export type ProfilePatch = Partial<
  Pick<User, 'name' | 'phone' | 'lga' | 'bio' | 'farmSizeHa' | 'primaryCrop' | 'village' | 'title' | 'twoFactor'>>;