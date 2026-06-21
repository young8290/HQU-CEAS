import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import * as auditService from '../services/auditService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await auditService.listAuditLogs({
      module: req.query.module as string | undefined,
      action: req.query.action as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    res.json(await auditService.getAuditLogDetail(parseInt(req.params.id as string)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
