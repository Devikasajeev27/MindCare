import { Request, Response, NextFunction } from "express";

function cleanObject(obj: any): any {
  if (obj && typeof obj === "object") {
    for (const key in obj) {
      if (key.startsWith("$")) {
        try {
          delete obj[key];
        } catch (e) {
          // Ignore errors if property is read-only or object is frozen
        }
      } else if (typeof obj[key] === "object") {
        cleanObject(obj[key]);
      }
    }
  }
  return obj;
}

export function sanitize(req: Request, res: Response, next: NextFunction) {
  if (req.body) {
    try {
      cleanObject(req.body);
    } catch (e) {}
  }
  if (req.query) {
    try {
      cleanObject(req.query);
    } catch (e) {}
  }
  next();
}
