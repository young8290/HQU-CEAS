import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/token.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录，请先登录' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

export function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: '权限不足，仅管理员可执行此操作' });
    return;
  }
  next();
}

export function monitorClassCheck(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  // Admin can access everything
  if (req.user.role === 'admin') {
    next();
    return;
  }
  if (req.user.role !== 'monitor') {
    res.status(403).json({ error: '鏉冮檺涓嶈冻' });
    return;
  }
  // Monitor can only access their own class
  const classId = parseInt(req.params.classId || req.body?.classId || '0');
  if (classId && req.user.classId !== classId) {
    res.status(403).json({ error: '权限不足，只能操作本班数据' });
    return;
  }
  next();
}

export function reviewerOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  if (req.user.role !== 'reviewer' || !req.user.reviewInviteId || !req.user.reviewMemberId || !req.user.classId) {
    res.status(403).json({ error: 'permission_denied' });
    return;
  }
  next();
}
