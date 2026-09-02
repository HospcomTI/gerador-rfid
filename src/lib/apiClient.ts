import { requiredEnv } from "./requiredEnv";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const apiUrl = requiredEnv("API_BASE_URL");
  const apiToken = requiredEnv("API_TOKEN");

  const headers = new Headers(init.headers);

  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${apiToken}`);
  }

  console.debug('API_FETCH:: ', `${apiUrl}${path}`);

  return fetch(`${apiUrl}${path}`, { ...init, headers });
}


/**
 * The message the server sent, falling back to the given text plus the status
 * when the body carries nothing usable. Consumes the response body.
 */
export async function apiErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = await response.text().catch(() => "");
  const sent = body && pickMessage(body);

  return sent || `${fallback} (${response.status})`;
}

/** Digs the message out of the shapes the API answers errors with. */
function pickMessage(body: string): string {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    // Not JSON, so the body is the message itself.
    return body.trim();
  }

  if (typeof parsed === "string") {
    return parsed.trim();
  }

  if (!parsed || typeof parsed !== "object") {
    return "";
  }

  const fields = parsed as Record<string, unknown>;
  // `message` is what the API uses; the others show up on framework-level
  // errors, which do not pass through the handlers.
  const value = fields.message ?? fields.error ?? fields.detail ?? fields.title;

  // Validation errors answer with one entry per broken rule.
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").join("\n");
  }

  return typeof value === "string" ? value.trim() : "";
}