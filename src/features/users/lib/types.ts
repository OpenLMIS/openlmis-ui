export type UserRole = 'Owner' | 'Admin' | 'Member' | 'Viewer';
export type UserStatus = 'Active' | 'Invited' | 'Suspended';

export type User = {
  id: number;
  name: string;
  email: string;
  username: string;
  avatarUrl: string;
  avatarFallback: string;
  role: UserRole;
  status: UserStatus;
  lastActiveAt: string;
  joinedAt: string;
};
