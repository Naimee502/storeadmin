import jwt from "jsonwebtoken";
import { Response } from "express";

export const generateTokens = (user: any) => {
  // NOTE: neither the mobile app nor the web panel implements a refresh-token
  // flow yet. With a 15m access token, sessions silently degraded to anonymous
  // after 15 minutes (context.user = null), breaking role-scoped queries and
  // notifications. Long-lived access token until a proper refresh flow exists.
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, type: user.type },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "7d" }
  );

  const refreshToken = jwt.sign(
    { id: user.id, email: user.email, type: user.type },
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
