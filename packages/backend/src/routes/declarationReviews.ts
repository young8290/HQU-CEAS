import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../middleware/auth.js';
import * as declarationReviewService from '../services/declarationReviewService.js';

const router = Router();
router.use(authMiddleware, adminOnly);

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await declarationReviewService.listDeclarationReviews({
      academicYearId: req.query.academicYearId ? parseInt(req.query.academicYearId as string) : undefined,
      declarationType: req.query.declarationType as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    }));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    res.json(await declarationReviewService.getDeclarationReviewDetail(parseInt(req.params.id as string)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/return', async (req: Request, res: Response) => {
  try {
    res.json(await declarationReviewService.returnDeclaration(parseInt(req.params.id as string), req.body.opinion || '', req.user!.userId));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    res.json(await declarationReviewService.approveDeclaration(
      parseInt(req.params.id as string),
      req.body.opinion || '',
      req.user!.userId,
      req.body.studentLevels || [],
    ));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
