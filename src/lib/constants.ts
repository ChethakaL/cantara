import { ClientStage, Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "cantara_session";
export const GOOGLE_OAUTH_STATE_COOKIE_NAME = "cantara_google_oauth_state";
export const SESSION_TTL_DAYS = 7;
export const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export const stageLabels: Record<ClientStage, string> = {
  INITIAL_REVIEW: "Initial Review",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const portalRoutes: Record<Role, string> = {
  ADMIN: "/admin",
  CLIENT: "/client",
};
