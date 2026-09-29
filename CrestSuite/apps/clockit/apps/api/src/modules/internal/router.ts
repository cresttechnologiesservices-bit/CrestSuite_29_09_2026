import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import env from "../../config";
import { DEFAULT_NOTIFICATION_PREFS } from "../notifications/service";

/**
 * Server-to-server endpoints for the CrestSuite portal. Not for browsers:
 * the portal proxy refuses to forward /api/internal, and every request must
 * carry the shared PORTAL_SECRET.
 */
const r = Router();

r.use((req, res, next) => {
  const secret = req.header("x-internal-secret");
  if (!secret || secret !== env.PORTAL_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
});

const DirectorySchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  // Directory roles, which own the mapping into ClockIT's own role names
  role: z.enum(["admin", "manager", "employee", "owner"]).optional(),
  active: z.boolean().optional(),
});

const ROLE_MAP: Record<string, "OWNER" | "ADMIN" | "MANAGER" | "MEMBER"> = {
  owner: "OWNER",
  admin: "ADMIN",
  manager: "MANAGER",
  employee: "MEMBER",
};

/**
 * Apply a User Management edit to the matching ClockIT account so Team →
 * Members shows the same name, role and status as the directory. Users ClockIT
 * has never seen are ignored — they are created on first sign-in.
 */
r.post("/directory-sync", async (req, res) => {
  const body = DirectorySchema.parse(req.body);
  const email = body.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Provision the account now rather than waiting for a first sign-in, so
    // people who have never logged in still appear in Team and in the
    // project "Add members" picker. Removed users are not resurrected.
    if (body.active === false) return res.json({ updated: false, reason: "inactive_never_provisioned" });
    const created = await prisma.user.create({
      data: {
        email,
        name: body.name || email.split("@")[0],
        role: ROLE_MAP[body.role ?? "employee"] ?? "MEMBER",
        status: "active",
        emailPrefs: DEFAULT_NOTIFICATION_PREFS,
      },
    });
    return res.json({ updated: true, created: true, id: created.id });
  }

  const data: Record<string, unknown> = {};
  if (body.name && body.name !== user.name) data.name = body.name;
  if (body.role) {
    const mapped = ROLE_MAP[body.role];
    if (mapped && mapped !== user.role) data.role = mapped;
  }
  if (body.active !== undefined) {
    const status = body.active ? "active" : "inactive";
    if (status !== user.status) data.status = status;
  }
  if (Object.keys(data).length === 0) return res.json({ updated: false, reason: "no_change" });

  await prisma.user.update({ where: { id: user.id }, data });
  res.json({ updated: true, fields: Object.keys(data) });
});

export default r;
