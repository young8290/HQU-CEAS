export interface User {
  id: number;
  username: string;
  role: 'admin' | 'monitor' | 'reviewer';
  displayName: string | null;
  classId: number | null;
  className: string | null;
  gradeId: number | null;
  gradeName: string | null;
  reviewInviteId?: number;
  reviewMemberId?: number;
  reviewMemberName?: string;
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getUser(): User | null {
  const data = localStorage.getItem('user');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: User) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
