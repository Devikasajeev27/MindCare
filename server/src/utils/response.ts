import { Response } from "express";

export function sendResponse(
  res: Response,
  statusCode: number,
  success: boolean,
  message: string,
  data: any = null,
  errors: any = null,
  req?: any
) {
  const requestId = req?.requestId || Math.random().toString(36).substring(2, 15);
  return res.status(statusCode).json({
    success,
    message,
    data,
    errors,
    timestamp: new Date().toISOString(),
    requestId,
  });
}
