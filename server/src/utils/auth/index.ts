import jwt from "jsonwebtoken";
import { Response } from "express";

export const generateTokens = (user: any) => {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, type: user.type },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: "15m" }
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
