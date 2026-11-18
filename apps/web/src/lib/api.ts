import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
  StoredUser,
} from '@/lib/auth-storage';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export type ApiErrorBody = {
  message?: string | string[];
  statusCode?: number;
  error?: string;
};

const MESSAGE_MAP: Record<string, string> = {
  'Forbidden resource': 'Brak uprawnień do tej operacji.',
  Forbidden: 'Brak uprawnień do tej operacji.',
  Unauthorized: 'Musisz być zalogowany.',
  UnauthorizedException: 'Musisz być zalogowany.',
};

function humanizeMessage(raw: string | string[] | undefined, status: number): string {
  if (Array.isArray(raw)) {
    return raw.join('. ');
  }
  if (raw && MESSAGE_MAP[raw]) {
    return MESSAGE_MAP[raw];
  }
  if (raw && raw.trim()) {
    return raw;
  }
  if (status === 401) return 'Musisz być zalogowany.';
  if (status === 403) return 'Brak uprawnień do tej operacji.';
  if (status === 404) return 'Nie znaleziono zasobu.';
  if (status >= 500) return 'Błąd serwera. Spróbuj ponownie później.';
  return 'Wystąpił błąd.';
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(humanizeMessage(body.message, status));
    this.status = status;
    this.body = body;
  }
}

type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

let refreshInFlight: Promise<string | null> | null = null;

function shouldAttemptRefresh(path: string, hadAccessToken: boolean) {
  if (!hadAccessToken) return false;
  if (path.startsWith('/auth/login')) return false;
  if (path.startsWith('/auth/register')) return false;
  if (path.startsWith('/auth/refresh')) return false;
  if (path.startsWith('/auth/logout')) return false;
  if (path.startsWith('/auth/forgot-password')) return false;
  if (path.startsWith('/auth/reset-password')) return false;
  if (path.startsWith('/auth/verify-email')) return false;
  return true;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const text = await res.text();
      let data: RefreshResponse | ApiErrorBody | null = null;
      if (text) {
        try {
          data = JSON.parse(text) as RefreshResponse | ApiErrorBody;
        } catch {
          data = { message: text };
        }
      }
      if (!res.ok || !data || !('accessToken' in data)) {
        clearSession();
        return null;
      }
      saveSession(data.accessToken, data.refreshToken, data.user);
      return data.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string; skipRefresh?: boolean } = {},
): Promise<T> {
  const { accessToken, headers, body, skipRefresh, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const token = accessToken ?? (typeof window !== 'undefined' ? getAccessToken() : null);

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    body,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text };
    }
  }

  if (res.status === 401 && !skipRefresh && shouldAttemptRefresh(path, Boolean(token))) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return apiFetch<T>(path, {
        ...options,
        accessToken: nextToken,
        skipRefresh: true,
      });
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}
