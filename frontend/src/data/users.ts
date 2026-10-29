import type { User } from '../types/user';

/**
 * Built-in display records, shown only until `GET /api/users/directory`
 * answers. Deliberately empty: every account — the administrator included —
 * comes from the backend's user store, so nothing here can show a person who
 * does not exist.
 */
export const users: User[] = [];
