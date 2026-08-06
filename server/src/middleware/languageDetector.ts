import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.ts";
import { LanguageEngine } from "../utils/LanguageEngine.ts";

export function languageDetectorMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.body && req.body.text) {
    const detected = LanguageEngine.detectLanguage(req.body.text);
    req.body.lang = detected;
    (req as any).detectedLanguage = detected;
  }
  next();
}

