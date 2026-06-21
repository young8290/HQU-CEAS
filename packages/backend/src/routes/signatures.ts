import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as signatureService from '../services/signatureService.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: Request, res: Response) => {
  try {
    res.json(await signatureService.saveSignature({
      signerName: req.body.signerName,
      method: req.body.method || 'draw',
      purpose: req.body.purpose,
      imageData: req.body.imageData,
      createdBy: req.user!.userId,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    res.json(await signatureService.getSignature(parseInt(req.params.id as string)));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
