import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth.js';
import * as studentService from '../services/studentService.js';

const router = Router();

router.use(authMiddleware);

// List students
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const filters: any = {
      search: req.query.search as string,
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 50,
    };

    if (user.role === 'monitor' && user.classId) {
      filters.classId = user.classId;
    } else {
      if (req.query.classId) filters.classId = parseInt(req.query.classId as string);
      if (req.query.gradeId) filters.gradeId = parseInt(req.query.gradeId as string);
    }

    const result = await studentService.listStudents(filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single student
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const student = await studentService.getStudent(parseInt(req.params.id as string));
    res.json(student);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Add student
router.post('/', adminOnly, async (req: Request, res: Response) => {
  try {
    const { studentNo, name, classId } = req.body;
    const student = await studentService.addStudent({ studentNo, name, classId });
    res.json(student);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Batch add students (upload Excel)
router.post('/batch/:classId?', adminOnly, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: '请上传文件' });
      return;
    }
    const classId = req.params.classId ? parseInt(req.params.classId as string) : undefined;
    const result = await studentService.batchAddStudents(req.file.buffer, classId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update student
router.put('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    const { studentNo, name, classId } = req.body;
    const student = await studentService.updateStudent(parseInt(req.params.id as string), { studentNo, name, classId });
    res.json(student);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete single student
router.delete('/:id', adminOnly, async (req: Request, res: Response) => {
  try {
    await studentService.deleteStudent(parseInt(req.params.id as string));
    res.json({ message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Batch delete by grade
router.delete('/batch/grade/:gradeId', adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await studentService.deleteStudentsByGrade(parseInt(req.params.gradeId as string));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Batch delete by class
router.delete('/batch/class/:classId', adminOnly, async (req: Request, res: Response) => {
  try {
    const result = await studentService.deleteStudentsByClass(parseInt(req.params.classId as string));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Download template
router.get('/template/download', adminOnly, async (req: Request, res: Response) => {
  try {
    const buffer = await studentService.getStudentTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=student_template.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
