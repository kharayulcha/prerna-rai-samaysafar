import type { Request, Response, NextFunction } from 'express';
type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;
declare const catchAsync: (fn: AsyncRouteHandler) => (req: Request, res: Response, next: NextFunction) => void;
export default catchAsync;
//# sourceMappingURL=catchAsync.d.ts.map