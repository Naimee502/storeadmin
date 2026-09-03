import jwt from "jsonwebtoken";
import { Response } from "express";

/**
 * Coerce whatever a caller hands us into a plain id string.
 *
 * Callers reach this with a mix of shapes: `branch.id` is already a string,
 * `account.branchid` is usually an ObjectId, and the login resolvers fetch with
 * .populate("admin"), so `branch.admin` is a whole Mongoose document. That last
 * case is the one that bites: String(doc) does not yield an id, it stringifies
 * the ENTIRE document. The result went straight into the JWT, which made the
 * refresh-token cookie so large that the Set-Cookie header overflowed nginx's
 * proxy header buffer -- every branch and staff login came back as a 502 -- and
 * it quietly put a non-id where resolveTenant expects one.
 *
 * Anything that is not a 24-character hex id is dropped rather than passed on,
 * so a malformed value degrades to "no scope in token" (resolveTenant's
 * documented fallback) instead of poisoning the tenant scope.
 */
const idOf = (value: any): string | undefined => {
  if (!value) return undefined;
  const raw = typeof value === "object" && value._id != null ? value._id : value;
  const id = String(raw);
  return /^[0-9a-fA-F]{24}$/.test(id) ? id : undefined;
};

export const generateTokens = (user: any) => {
  // adminid / branchid are carried in the token so resolveTenant() can scope a
  // request without a database lookup. Tokens issued before this existed still
  // work — resolveTenant falls back to a cached owner lookup for those.
  const scope: Record<string, any> = {};
  const adminid = idOf(user.adminid);
  const branchid = idOf(user.branchid);
  if (adminid) scope.adminid = adminid;
  if (branchid) scope.branchid = branchid;

  // NOTE: neither the mobile app nor the web panel implements a refresh-token
  // flow yet. With a 15m access token, sessions silently degraded to anonymous
  // after 15 minutes (context.user = null), breaking role-scoped queries and
  // notifications. Long-lived access token until a proper refresh flow exists.
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, type: user.type, ...scope },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "7d" }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, type: user.type, ...scope },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
};

export const sendRefreshToken = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    path: "/refresh_token",
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};
