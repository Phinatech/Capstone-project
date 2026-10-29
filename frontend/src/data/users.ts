import type { User } from '../types/user';

/**
 * Built-in display records, shown only until `GET /api/users/directory`
 * answers. Only the operator account is built in: real agents and farmers are
 * created through sign-up and live in the backend's user store, and the demo
 * roster is deliberately not shipped to production.
 */
export const users: User[] = [
  {
    id: 'admin-1',
    role: 'admin',
    name: 'Chinemerem Ugbo',
    title: 'Programme administrator',
    email: 'admin@sokotocover.ng',
    phone: '+234 809 110 2045',
    wallet: '0xA11c4e90B3f27d5E6a01c8F9e2D4b7A35c60E1f2',
    joinedAt: '2023-05-02',
    emailVerified: true,
    bio: 'Runs oracle evaluations and backtests for the Sokoto weather index pilot.'
  }
];
