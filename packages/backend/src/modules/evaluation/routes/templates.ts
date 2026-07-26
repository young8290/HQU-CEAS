import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../../core/middleware/auth.js';
import * as templateService from '../services/templateService.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.json(await templateService.listTemplates());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:type/download', async (req: Request, res: Response) => {
  try {
    const buffer = await templateService.createTemplateWorkbook(req.params.type as string);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`${req.params.type}.xlsx`)}`);
    res.send(Buffer.from(buffer as ArrayBuffer));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
