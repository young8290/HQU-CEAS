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

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REVIEW_TOKEN_KEY = 'reviewToken';
const REVIEW_USER_KEY = 'reviewUser';

function readUser(storage: Storage, key: string): User | null {
  const data = storage.getItem(key);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  return readUser(localStorage, USER_KEY);
}

export function setAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getReviewToken(): string | null {
  return sessionStorage.getItem(REVIEW_TOKEN_KEY);
}

export function getReviewUser(): User | null {
  return readUser(sessionStorage, REVIEW_USER_KEY);
}

export function setReviewAuth(token: string, user: User) {
  sessionStorage.setItem(REVIEW_TOKEN_KEY, token);
  sessionStorage.setItem(REVIEW_USER_KEY, JSON.stringify(user));
}

export function clearReviewAuth() {
  sessionStorage.removeItem(REVIEW_TOKEN_KEY);
  sessionStorage.removeItem(REVIEW_USER_KEY);
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === 'admin';
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function isReviewLoggedIn(): boolean {
  return !!getReviewToken();
}
