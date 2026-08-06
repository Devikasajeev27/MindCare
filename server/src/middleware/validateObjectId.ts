import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export function validateObjectId(req: Request, res: Response, next: NextFunction) {
  const keys = Object.keys(req.params);
  for (const key of keys) {
    if (key.toLowerCase().endsWith("id")) {
      const val = req.params[key];
      if (val && !mongoose.Types.ObjectId.isValid(val)) {
        return res.status(400).json({ message: `Invalid identification format for parameter: ${key}` });
      }
    }
  }
  next();
}
