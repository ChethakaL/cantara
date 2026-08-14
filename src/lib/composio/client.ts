import { cookies } from "next/headers";
import { getProjectEnv } from "@/lib/project-env";

export const COMPOSIO_BASE_URL = "https://backend.composio.dev/api/v3.1";
export const QUICKBOOKS_TOOLKIT_SLUG = "QUICKBOOKS";
export const GOOGLEDRIVE_TOOLKIT_SLUG = "GOOGLEDRIVE";
export const ADMIN_DRIVE_USER_ID = "cantara-admin-drive";
export const COMPOSIO_MAIL_USER_ID = "cantara-system-mailbox";
export const DEFAULT_MAIL_TOOLKIT_SLUG = "GMAIL";

export type ComposioAuthConfig = {
  id: string;
  auth_scheme?: string;
  is_composio_managed?: boolean;
  is_disabled?: boolean;
};

export type ComposioAuthConfigListItem = {
  id?: string;
  auth_config?: ComposioAuthConfig;
  toolkit?: { slug?: string };
  status?: string;
  is_disabled?: boolean;
};

export type ComposioConnectedAccount = {
  id: string;
  status: string;
  status_reason?: string;
  is_disabled?: boolean;
  updated_at?: string;
  user_id?: string;
  toolkit?: { slug?: string };
  connection?: Record<string, unknown>;
  state?: unknown;
};

export function composioApiKey() {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) throw new Error("COMPOSIO_API_KEY is not configured");
  return key;
}

export async function composioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${COMPOSIO_BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": composioApiKey(),
          ...(init?.headers ?? {}),
        },
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`Composio request failed (${res.status}): ${detail}`);
      }

      const text = await res.text();
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return {} as T;
      }
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.name === "TypeError" ||
        String(err?.message || "").includes("fetch failed");
      if (isNetworkError && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export async function tryComposioFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await composioFetch<T>(path, init);
  } catch (error) {
    console.warn(error);
    return null;
  }
}

export function getComposioAdminId() {
  try {
    const c = cookies();
    const email = c.get("cantara_admin_email")?.value;
    if (email) return `admin:${email}`;
  } catch (e) {}
  return null;
}

export function composioUserIdForClient(clientId: string) {
  return `cantara-client:${clientId}`;
}

export async function pingComposioApi() {
  try {
    const data = await composioFetch<Record<string, unknown>>("/toolkits?limit=1");
    return { ok: true, data, message: "Connected", status: 200, apiUrl: COMPOSIO_BASE_URL };
  } catch (error: any) {
    return { ok: false, error: error.message || "Failed to contact Composio", message: error.message || "Failed to contact Composio", status: 503, apiUrl: COMPOSIO_BASE_URL };
  }
}
