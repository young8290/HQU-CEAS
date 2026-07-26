import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as mailConfigService from '../services/mailConfigService.js';
import * as mailService from '../services/mailService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await mailConfigService.getMailSettings());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    res.json(await mailConfigService.updateMailSettings({ ...req.body, actorId: req.user!.userId }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/test', async (req: Request, res: Response) => {
  try {
    res.json(await mailService.sendTestMail({ recipientEmail: req.body.recipientEmail, actorId: req.user!.userId }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
