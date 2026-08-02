import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";

export type UserId = number | string;

interface AuthTokenPayload extends JwtPayload {
  id: UserId;
}

const getJwtSecret = (): Secret => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return process.env.JWT_SECRET;
};

export const generateToken = (userId: UserId): string => {
  const expiresIn = (process.env.JWT_EXPIRE ||
    "7d") as SignOptions["expiresIn"];

  return jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn,
  });
};

export const verifyToken = (token: string): AuthTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === "string" || typeof decoded.id === "undefined") {
      return null;
    }

    return decoded as AuthTokenPayload;
  } catch (_error) {
    return null;
  }
};

export const decodeToken = (token: string): JwtPayload | string | null => {
  try {
    return jwt.decode(token);
  } catch (_error) {
    return null;
  }
};
