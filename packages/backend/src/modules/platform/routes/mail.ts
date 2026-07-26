import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as userService from '../services/userService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.post('/send-monitor-accounts', async (req: Request, res: Response) => {
  try {
    res.json(await userService.sendMonitorAccountMails({
      accounts: req.body.accounts || [],
      systemLink: req.body.systemLink,
      actorId: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
