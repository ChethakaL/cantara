import { getProjectEnv } from "@/lib/project-env";

export function requireDeveloperSecret(secret: string | null) {
  const expected = getProjectEnv("DEVELOPER_SETTINGS_PASSWORD");
  if (!expected) {
    return { ok: false, status: 503, message: "DEVELOPER_SETTINGS_PASSWORD is not configured." };
  }
  if (!secret || secret !== expected) {
    return { ok: false, status: 401, message: "Developer access required." };
  }
  return { ok: true, status: 200, message: "OK" };
}
