import { Router, Request, Response } from 'express';
import { adminOnly, authMiddleware } from '../../../core/middleware/auth.js';
import * as tagService from '../services/tagService.js';

const router = Router();
// 标签视图为管理员功能(全院获奖标签数据),公网硬化:收紧为 adminOnly
router.use(authMiddleware, adminOnly);

router.get('/', async (req: Request, res: Response) => {
  try {
    res.json(await tagService.listTags({
      academicYearId: req.query.academicYearId ? parseInt(req.query.academicYearId as string) : undefined,
      tagType: req.query.tagType as string | undefined,
      classId: req.query.classId ? parseInt(req.query.classId as string) : undefined,
      tagName: req.query.tagName as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
    }));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
