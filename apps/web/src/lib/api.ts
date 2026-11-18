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

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, body, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    body,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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

  if (!res.ok) {
    throw new ApiError(res.status, (data as ApiErrorBody) ?? {});
  }
  return data as T;
}
