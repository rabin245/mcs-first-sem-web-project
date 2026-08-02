import { NextFunction, Request, Response } from "express";
import core from "express-serve-static-core";
import { verifyToken } from "./jwt.js";

export interface AuthenticatedRequest<
  P = core.ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = core.Query,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId?: number | string;
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  (req as AuthenticatedRequest).userId = decoded.id;
  next();
};
