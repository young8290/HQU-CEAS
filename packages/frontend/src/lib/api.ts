import { navigateTo } from './router';
import { clearAuth, clearReviewAuth, getReviewToken, getToken } from './auth';

const API_BASE = '/api';
const CACHE_STORAGE_PREFIX = 'api-cache:';

// 缓存规则匹配 v2 双系统前缀：/platform、/evaluation、/declaration。
const CACHE_RULES = [
  { pattern: /^\/platform\/academic-years$/, ttl: 5 * 60 * 1000 },
  { pattern: /^\/platform\/grades$/, ttl: 5 * 60 * 1000 },
  { pattern: /^\/platform\/grades\/\d+\/classes$/, ttl: 5 * 60 * 1000 },
  { pattern: /^\/platform\/users$/, ttl: 60 * 1000 },
  { pattern: /^\/platform\/students\?classId=\d+$/, ttl: 30 * 1000 },
  { pattern: /^\/evaluation\/import\/logs$/, ttl: 20 * 1000 },
  { pattern: /^\/platform\/system\/entry-status$/, ttl: 15 * 1000 },
  { pattern: /^\/evaluation\/templates$/, ttl: 5 * 60 * 1000 },
  { pattern: /^\/declaration\/awards\/candidates\/\d+/, ttl: 30 * 1000 },
  { pattern: /^\/declaration\/awards\/allocation\/\d+/, ttl: 30 * 1000 },
  { pattern: /^\/declaration\/honors\/candidates\/\d+/, ttl: 30 * 1000 },
  { pattern: /^\/declaration\/declaration-reviews/, ttl: 15 * 1000 },
  { pattern: /^\/platform\/mail\/templates$/, ttl: 5 * 60 * 1000 },
  { pattern: /^\/declaration\/tags/, ttl: 30 * 1000 },
] as const;

const memoryCache = new Map<string, { data: any; expiresAt: number }>();
const inflightGetRequests = new Map<string, Promise<any>>();

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  cacheTtl?: number | false;
  forceRefresh?: boolean;
  authScope?: 'main' | 'review';
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function getCacheScope(authScope: RequestOptions['authScope'] = 'main') {
  try {
    const rawUser = authScope === 'review'
      ? sessionStorage.getItem('reviewUser')
      : localStorage.getItem('user');
    if (!rawUser) return 'guest';
    const user = JSON.parse(rawUser);
    return `${authScope}:${user.id ?? 'anonymous'}:${user.role ?? 'unknown'}`;
  } catch {
    return `${authScope}:guest`;
  }
}

function getCacheKey(path: string, authScope: RequestOptions['authScope'] = 'main') {
  return `${CACHE_STORAGE_PREFIX}${getCacheScope(authScope)}:${path}`;
}

function getDefaultCacheTtl(path: string) {
  const rule = CACHE_RULES.find(({ pattern }) => pattern.test(path));
  return rule?.ttl ?? false;
}

function readSessionCache(key: string) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { data: any; expiresAt: number };
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, value: { data: any; expiresAt: number }) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures and keep in-memory cache only.
  }
}

export function clearApiCache() {
  memoryCache.clear();
  inflightGetRequests.clear();

  try {
    const keysToDelete: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(CACHE_STORAGE_PREFIX)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore storage failures.
  }
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method || 'GET';
  const authScope = options.authScope || 'main';
  const cacheTtl = method === 'GET'
    ? options.cacheTtl ?? getDefaultCacheTtl(path)
    : false;
  const cacheKey = cacheTtl ? getCacheKey(path, authScope) : null;

  if (method === 'GET' && cacheKey && !options.forceRefresh) {
    const memoryEntry = memoryCache.get(cacheKey);
    if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
      return cloneValue(memoryEntry.data);
    }

    if (memoryEntry) {
      memoryCache.delete(cacheKey);
    }

    const sessionEntry = readSessionCache(cacheKey);
    if (sessionEntry) {
      memoryCache.set(cacheKey, sessionEntry);
      return cloneValue(sessionEntry.data);
    }

    const inflight = inflightGetRequests.get(cacheKey);
    if (inflight) {
      return inflight.then((data) => cloneValue(data));
    }
  }

  const token = authScope === 'review' ? getReviewToken() : getToken();
  const headers: Record<string, string> = {
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const executeRequest = async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
    });

    if (res.status === 401) {
      // Try to read the actual error message from the response
      let errorMsg = '登录已过期';
      try {
        const errData = await res.json();
        errorMsg = errData.error || errorMsg;
      } catch {}

      // Only redirect to login for non-login requests (token expired)
      if (!path.startsWith('/platform/auth/login') && !path.startsWith('/evaluation/score-review-invites/login')) {
        if (authScope === 'review') {
          clearReviewAuth();
          clearApiCache();
          navigateTo('/review-login', { replace: true });
        } else {
          clearAuth();
          clearApiCache();
          navigateTo('/login', { replace: true });
        }
      }
      throw new Error(errorMsg);
    }

    // Check if response is a file download
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('spreadsheet') || contentType.includes('zip') || contentType.includes('pdf')) {
      if (!res.ok) throw new Error('下载失败');
      const blob = await res.blob();
      return blob as any;
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '请求失败');
    }

    if (method === 'GET' && cacheKey && cacheTtl) {
      const entry = {
        data: cloneValue(data),
        expiresAt: Date.now() + cacheTtl,
      };
      memoryCache.set(cacheKey, entry);
      writeSessionCache(cacheKey, entry);
    } else if (method !== 'GET') {
      clearApiCache();
    }

    return data;
  };

  if (method === 'GET' && cacheKey) {
    const inflight = executeRequest().finally(() => {
      inflightGetRequests.delete(cacheKey);
    });
    inflightGetRequests.set(cacheKey, inflight);
    return inflight.then((data) => cloneValue(data));
  }

  return executeRequest();
}

export const api = {
  get: <T = any>(path: string, options: Pick<RequestOptions, 'cacheTtl' | 'forceRefresh'> = {}) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PUT', body }),
  delete: <T = any>(path: string, body?: any) => request<T>(path, { method: 'DELETE', body }),
  upload: <T = any>(path: string, file: File | FormData, fieldName = 'file') => {
    let formData: FormData;
    if (file instanceof FormData) {
      formData = file;
    } else {
      formData = new FormData();
      formData.append(fieldName, file);
    }
    return request<T>(path, { method: 'POST', body: formData });
  },
  uploadMultiple: <T = any>(path: string, files: File[], fieldName = 'files') => {
    const formData = new FormData();
    for (const file of files) {
      formData.append(fieldName, file);
    }
    return request<T>(path, { method: 'POST', body: formData });
  },
  download: async (path: string, filename: string, body?: any) => {
    const method = body ? 'POST' : 'GET';
    const blob = await request<Blob>(path, { method, body, cacheTtl: false });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  clearCache: clearApiCache,
};

export const reviewApi = {
  get: <T = any>(path: string, options: Pick<RequestOptions, 'cacheTtl' | 'forceRefresh'> = {}) =>
    request<T>(path, { ...options, method: 'GET', authScope: 'review' }),
  post: <T = any>(path: string, body?: any) => request<T>(path, { method: 'POST', body, authScope: 'review' }),
  put: <T = any>(path: string, body?: any) => request<T>(path, { method: 'PUT', body, authScope: 'review' }),
  delete: <T = any>(path: string, body?: any) => request<T>(path, { method: 'DELETE', body, authScope: 'review' }),
  upload: <T = any>(path: string, file: File | FormData, fieldName = 'file') => {
    let formData: FormData;
    if (file instanceof FormData) {
      formData = file;
    } else {
      formData = new FormData();
      formData.append(fieldName, file);
    }
    return request<T>(path, { method: 'POST', body: formData, authScope: 'review' });
  },
  uploadMultiple: <T = any>(path: string, files: File[], fieldName = 'files') => {
    const formData = new FormData();
    for (const file of files) {
      formData.append(fieldName, file);
    }
    return request<T>(path, { method: 'POST', body: formData, authScope: 'review' });
  },
  download: async (path: string, filename: string, body?: any) => {
    const method = body ? 'POST' : 'GET';
    const blob = await request<Blob>(path, { method, body, cacheTtl: false, authScope: 'review' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
  clearCache: clearApiCache,
};
