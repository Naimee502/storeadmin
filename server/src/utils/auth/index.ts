import jwt from "jsonwebtoken";
import { Response } from "express";

export const generateTokens = (user: any) => {
  // adminid / branchid are carried in the token so resolveTenant() can scope a
  // request without a database lookup. Tokens issued before this existed still
  // work — resolveTenant falls back to a cached owner lookup for those.
  const scope: Record<string, any> = {};
  if (user.adminid) scope.adminid = String(user.adminid);
  if (user.branchid) scope.branchid = String(user.branchid);

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
