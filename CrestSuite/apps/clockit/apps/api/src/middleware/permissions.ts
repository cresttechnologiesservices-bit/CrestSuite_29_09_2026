
import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import { can, Resource, Action } from "../lib/permissions";

const LABEL: Record<Resource, string> = {
  projects: "projects",
  clients: "clients",
  tasks: "tasks",
  timeEntries: "time entries",
  reports: "reports",
  team: "team",
};

/**
 * Enforces a Workspace Settings → Permissions rule on a route.
 *
 * The permission matrix is checked server-side.
 * If the authenticated user's role does not have the requested
 * permission, the request is rejected with 403.
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (
    req: AuthedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.userId) {
      return res.status(401).json({
        error: "unauthorized",
      });
    }

    const allowed = await can(req.userId, resource, action);

    if (allowed) {
      return next();
    }

    return res.status(403).json({
      error: "permission_denied",
      resource,
      action,
      message: `Your role is not allowed to ${action} ${LABEL[resource]} in this workspace.`,
    });
  };
}

/**
 * Controls member management for a specific project.
 *
 * IMPORTANT:
 * The workspace permission matrix is the only authority here.
 *
 * A user must have:
 *
 *     projects.manage
 *
 * to add, update, or remove project members.
 *
 * Being assigned to a project as a manager does NOT bypass
 * the workspace permission matrix.
 */
export function requireProjectManage() {
  return async (
    req: AuthedRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.userId) {
      return res.status(401).json({
        error: "unauthorized",
      });
    }

    const allowed = await can(
      req.userId,
      "projects",
      "manage"
    );

    if (allowed) {
      return next();
    }

    return res.status(403).json({
      error: "permission_denied",
      resource: "projects",
      action: "manage",
      message:
        "Your role is not allowed to manage project members in this workspace.",
    });
  };
}
