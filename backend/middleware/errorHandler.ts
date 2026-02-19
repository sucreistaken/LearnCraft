import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(msg = "Not found") {
  return new AppError(404, msg, "NOT_FOUND");
}

export function badRequest(msg = "Bad request") {
  return new AppError(400, msg, "BAD_REQUEST");
}

export function forbidden(msg = "Forbidden") {
  return new AppError(403, msg, "FORBIDDEN");
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
}
