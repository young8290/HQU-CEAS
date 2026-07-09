import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import prisma from '../config/database.js';

const router = Router();

router.use(authMiddleware);

// List all grades
router.get('/', async (req: Request, res: Response) => {
  try {
    const grades = await prisma.grade.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true } } },
    });
    res.json(grades);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create grade
router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const grade = await prisma.grade.create({ data: { name } });
    res.json(grade);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete grade (cascade)
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.grade.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// List classes for a grade  
router.get('/:id/classes', async (req: Request, res: Response) => {
  try {
    const classes = await prisma.class.findMany({
      where: { gradeId: parseInt(req.params.id as string) },
      orderBy: { name: 'asc' },
      include: { _count: { select: { students: true } } },
    });
    res.json(classes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create class under a grade
router.post('/:id/classes', adminOnly, async (req: Request, res: Response) => {
  try {
    const gradeId = parseInt(req.params.id as string);
    const { name } = req.body;
    const cls = await prisma.class.create({ data: { gradeId, name } });
    res.json(cls);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete class
router.delete('/:gradeId/classes/:classId', adminOnly, async (req: Request, res: Response) => {
  try {
    await prisma.class.delete({ where: { id: parseInt(req.params.classId as string) } });
    res.json({ message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
