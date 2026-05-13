import type { NextFunction, Request, Response } from 'express';

type AsyncRouteHandler = (
  req: Request, 
  res: Response, 
  next: NextFunction
) => Promise<Response | void>;

const catchAsync = (fn: AsyncRouteHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next))
      .catch(next); 
  };
};
export default catchAsync;