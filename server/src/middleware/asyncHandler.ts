import { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * asyncHandler
 * Wraps an async Express route handler and forwards any thrown error to
 * Express's next() error pipeline.  This prevents unhandled promise
 * rejections from crashing the server.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
