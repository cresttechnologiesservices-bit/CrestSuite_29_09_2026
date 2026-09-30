// import { Response, NextFunction } from "express";
// import { AuthedRequest } from "./auth";
// import { can, Resource, Action } from "../lib/permissions";
// import { prisma } from "../lib/prisma";
 
// const LABEL: Record<Resource, string> = {
//   projects: "projects",
//   clients: "clients",
//   tasks: "tasks",
//   timeEntries: "time entries",
//   reports: "reports",
//   team: "team",
// };
 
// /**
// * Enforces a Workspace Settings → Permissions rule on a route.
// *
// * The matrix is the authority for Managers and Members; administrators and
// * owners always pass. Applying it server-side is what makes the setting real —
// * hiding a button would still leave the endpoint open.
// */
// export function requirePermission(resource: Resource, action: Action) {
//   return async (req: AuthedRequest, res: Response, next: NextFunction) => {
//     if (!req.userId) return res.status(401).json({ error: "unauthorized" });
//     if (await can(req.userId, resource, action)) return next();
//     return res.status(403).json({
//       error: "permission_denied",
//       resource,
//       action,
//       message: `Your role is not allowed to ${action} ${LABEL[resource]} in this workspace.`,
//     });
//   };
// }
 
// /**
// * Member management on a specific project. Passes for anyone whose workspace
// * role grants `projects.manage`, and also for the project's own managers
// * (ProjectMember.role = "manager") — running a project you have been put in
// * charge of must not depend on the workspace-wide matrix.
// */
// export function requireProjectManage() {
//   return async (req: AuthedRequest, res: Response, next: NextFunction) => {
//     if (!req.userId) return res.status(401).json({ error: "unauthorized" });
//     if (await can(req.userId, "projects", "manage")) return next();
//     const [membership, user] = await Promise.all([
//       prisma.projectMember.findUnique({
//         where: { projectId_userId: { projectId: req.params.id, userId: req.userId } },
//         select: { role: true },
//       }),
//       prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } }),
//     ]);
//     // The project's own manager, or a workspace Manager who has been given
//     // access to this project, may manage its members. Authority is scoped to
//     // projects they belong to, so it never widens into workspace-wide manage.
//     if (membership?.role === "manager") return next();
//     if (membership && user?.role === "MANAGER") return next();
//     return res.status(403).json({
//       error: "permission_denied",
//       resource: "projects",
//       action: "manage",
//       message: "Only a manager of this project, or a role allowed to manage projects, can change its members.",
//     });
//   };
// }
import { Response, NextFunction } from "express";
import { AuthedRequest } from "./auth";
import { can, Resource, Action, ADMIN_ROLES } from "../lib/permissions";
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

/** True when the user is the project manager of at least one project. */
export async function managesAnyProject(userId: string): Promise<boolean> {
  const m = await prisma.projectMember.findFirst({ where: { userId, role: "manager" }, select: { id: true } });
  return !!m;
}

/**
 * Member management on a specific project.
 *
 * Administrators and owners can manage members of any project. Everyone else
 * can do it ONLY on a project they were added to by an admin AND where they
 * are either the project's manager (ProjectMember.role = "manager") or a
 * workspace Manager. Being a workspace Manager alone is not enough — authority
 * is limited to the projects they were given access to.
 */
export function requireProjectManage() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "unauthorized" });
    const [membership, user] = await Promise.all([
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: req.params.id, userId: req.userId } },
        select: { role: true },
      }),
      prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } }),
    ]);
    if (user && ADMIN_ROLES.includes(user.role)) return next();
    if (membership?.role === "manager") return next();
    if (membership && user?.role === "MANAGER") return next();
    return res.status(403).json({
      error: "permission_denied",
      resource: "projects",
      action: "manage",
      message: "Only a manager of this project, or a role allowed to manage projects, can change its members.",
    });
  };
}

/**
 * Opening a project: allowed by the workspace "view projects" permission, or
 * for anyone who was added to that project (so a project manager who is a
 * plain workspace Member can still open the project they run).
 */
export function requireProjectView() {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "unauthorized" });
    if (await can(req.userId, "projects", "view")) return next();
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.userId } },
      select: { id: true },
    });
    if (membership) return next();
    return res.status(403).json({
      error: "permission_denied",
      resource: "projects",
      action: "view",
      message: "Your role is not allowed to view projects in this workspace.",
    });
  };
}
