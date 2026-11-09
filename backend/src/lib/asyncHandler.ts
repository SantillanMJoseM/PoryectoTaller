import type { Request, Response, NextFunction } from "express";
export const asyncHandler = (fn: (req: any, res: any, next: any) => any) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
