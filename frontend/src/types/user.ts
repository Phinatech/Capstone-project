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

export interface StoredUser extends User {
  passwordHash?: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  lga: string;
  password: string;
}

export type ProfilePatch = Partial<
  Pick<User, 'name' | 'phone' | 'lga' | 'bio' | 'farmSizeHa' | 'primaryCrop' | 'village' | 'title' | 'twoFactor'>>;