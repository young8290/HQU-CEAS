import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import * as mailService from '../services/mailService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await mailService.listMailLogs({
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    res.json(await mailService.retryMailLog(parseInt(req.params.id as string), req.user!.userId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
