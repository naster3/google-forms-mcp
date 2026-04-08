const TOKEN_KEYS = [
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "id_token",
  "idToken",
];

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (TOKEN_KEYS.includes(key)) {
        return [key, "***redacted***"] as const;
      }

      return [key, redactSecrets(nested)] as const;
    });

    return Object.fromEntries(entries);
  }

  return value;
}
