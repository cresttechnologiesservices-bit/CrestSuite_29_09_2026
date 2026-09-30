import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import { can, Resource, Action } from "../lib/permissions";
import { prisma } from "../lib/prisma";

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
 * The matrix is the authority for Managers and Members; administrators and
 * owners always pass. Applying it server-side is what makes the setting real —
 * hiding a button would still leave the endpoint open.
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "unauthorized" });
    if (await can(req.userId, resource, action)) return next();
    return res.status(403).json({
      error: "permission_denied",
      resource,
      action,
      message: `Your role is not allowed to ${action} ${LABEL[resource]} in this workspace.`,
    });
  };
}

/**
 * Member management on a specific project. Passes for anyone whose workspace
 * role grants `projects.manage`, and also for the project's own managers
 * (ProjectMember.role = "manager") — running a project you have been put in
 * charge of must not depend on the workspace-wide matrix.
 */
export function requireProjectManage() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "unauthorized" });
    if (await can(req.userId, "projects", "manage")) return next();
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.userId } },
      select: { role: true },
    });
    // Only the project's own manager may pass here. Being a workspace Manager
    // or a plain member of the project is NOT enough.
    if (membership?.role === "manager") return next();
    return res.status(403).json({
      error: "permission_denied",
      resource: "projects",
      action: "manage",
      message: "Only a manager of this project, or a role allowed to manage projects, can change its members.",
    });
  };
}
