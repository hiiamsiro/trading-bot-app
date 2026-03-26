const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

export function resolveCorsOrigin():
  | string
  | string[]
  | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const raw = process.env.CORS_ORIGIN;
  const fallback = DEFAULT_CORS_ORIGIN;

  if (!raw) {
    return fallback;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed === '*') {
    throw new Error(
      'CORS_ORIGIN cannot be "*" when credentials are enabled. Set an explicit origin or a comma-separated allowlist.',
    );
  }

  const allowlist = trimmed
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (allowlist.length === 0) {
    return fallback;
  }

  if (allowlist.length === 1) {
    return allowlist[0]!;
  }

  const allowedSet = new Set(allowlist);

  return (origin, callback) => {
    if (!origin) {
      callback(null, false);
      return;
    }
    callback(null, allowedSet.has(normalizeOrigin(origin)));
  };
}
