import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as mailTemplateService from '../services/mailTemplateService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await mailTemplateService.listMailTemplates());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    res.json(await mailTemplateService.updateMailTemplate(parseInt(req.params.id as string), req.body));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
