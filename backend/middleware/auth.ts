import { Request, Response, NextFunction } from "express";
import { authService } from "../services/authService";

export interface AuthRequest extends Request {
  user?: { userId: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || "Invalid token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const decoded = authService.verifyToken(header.slice(7));
      req.user = decoded;
    } catch {
      // Invalid token, continue without auth
    }
  }
  next();
}
