import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly, monitorClassCheck } from '../../../core/middleware/auth.js';
import * as exportService from '../services/exportService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';
import prisma from '../../../core/db.js';

/**
 * 综测系统导出路由（原 routes/export.ts 综测半）：
 * attachment2 / attachment4 / all / failed-records / accounts。
 * 挂载：/api/evaluation/export（旧别名 /api/export，与申报导出路由级联兜底）。
 */

const router = Router();

router.use(authMiddleware);

async function getAcademicYearId(yearIdParam?: any): Promise<number> {
  if (yearIdParam) return parseInt(yearIdParam);
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

// Export attachment 2 — 班长可导出本班, 管理员可导出任意班
router.get('/attachment2/:classId', monitorClassCheck, async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId as string);
    const academicYearId = await getAcademicYearId(req.query.academicYearId);

    const cls = await prisma.class.findUnique({ where: { id: classId }, include: { grade: true } });
    const fileName = cls ? `${cls.grade.name}${cls.name}附件2.xlsx` : 'attachment2.xlsx';

    const buffer = await exportService.exportAttachment2(classId, academicYearId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Export attachment 4 — 仅管理员
router.get('/attachment4/:classId', adminOnly, async (req: Request, res: Response) => {
  try {
    const classId = parseInt(req.params.classId as string);
    const academicYearId = await getAcademicYearId(req.query.academicYearId);

    const cls = await prisma.class.findUnique({ where: { id: classId }, include: { grade: true } });
    const fileName = cls ? `${cls.grade.name}${cls.name}附件4.xlsx` : 'attachment4.xlsx';

    const buffer = await exportService.exportAttachment4(classId, academicYearId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Export all attachments (ZIP) — 仅管理员
router.get('/all/:gradeId', adminOnly, async (req: Request, res: Response) => {
  try {
    const gradeId = parseInt(req.params.gradeId as string);
    const academicYearId = await getAcademicYearId(req.query.academicYearId);

    const grade = await prisma.grade.findUnique({ where: { id: gradeId } });
    const zipName = grade ? `${grade.name}全部附件.zip` : `attachments_${Date.now()}.zip`;

    const buffer = await exportService.exportAllAttachments({ gradeId }, academicYearId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Export failed records — 仅管理员
router.get('/failed-records', adminOnly, async (req: Request, res: Response) => {
  try {
    const buffer = await exportService.exportFailedRecords();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=failed_records.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Export accounts list — 仅管理员
router.get('/accounts', adminOnly, async (req: Request, res: Response) => {
  try {
    const buffer = await exportService.exportAccountsList();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=accounts.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
