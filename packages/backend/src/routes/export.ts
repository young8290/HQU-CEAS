import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly, monitorClassCheck } from '../middleware/auth.js';
import * as exportService from '../services/exportService.js';
import * as academicYearService from '../services/academicYearService.js';
import prisma from '../config/database.js';

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

router.get('/declarations', adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.declarationBatch.findMany({
      include: { class: { include: { grade: true } }, students: true },
      orderBy: { submittedAt: 'desc' },
    });
    const buffer = await exportService.exportSimpleReport('申报汇总', rows.map((item) => ({
      班级: `${item.class.grade.name}${item.class.name}`,
      类型: item.declarationType,
      状态: item.status,
      学生数: item.students.length,
      提交时间: item.submittedAt?.toLocaleString() || '',
    })));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('申报汇总.xlsx')}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/award-allocation', adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.awardQuota.findMany({ include: { class: { include: { grade: true } } } });
    const buffer = await exportService.exportSimpleReport('院奖分配', rows.map((item) => ({
      班级: `${item.class.grade.name}${item.class.name}`,
      名额: item.quotaCount,
      可支配金额: item.availableAmount,
      备注: item.remark || '',
    })));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('院奖分配.xlsx')}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/honor-declarations', adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.declarationBatch.findMany({
      where: { declarationType: 'honor' },
      include: { class: { include: { grade: true } }, students: { include: { student: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    const buffer = await exportService.exportSimpleReport('荣誉称号申报表', rows.flatMap((batch) => (
      batch.students.map((item) => ({
        班级: `${batch.class.grade.name}${batch.class.name}`,
        学号: item.student.studentNo,
        姓名: item.student.name,
        称号类型: item.itemType,
        状态: batch.status,
        材料说明: item.materialJson,
        提交时间: batch.submittedAt?.toLocaleString() || '',
      }))
    )));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('荣誉称号申报表.xlsx')}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/declaration-attachment2', adminOnly, async (req: Request, res: Response) => {
  try {
    const academicYearId = await getAcademicYearId(req.query.academicYearId);
    const buffer = await exportService.exportDeclarationAttachment2(academicYearId);
    const fileName = '附件2.2024-2025学年院级奖学金、优秀学生干部、优秀学生汇总表【含填报说明】.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/mail-logs', adminOnly, async (_req: Request, res: Response) => {
  try {
    const rows = await prisma.mailLog.findMany({ orderBy: { createdAt: 'desc' } });
    const buffer = await exportService.exportSimpleReport('邮件发送记录', rows.map((item) => ({
      收件人: item.recipientEmail,
      模板: item.templateType,
      主题: item.subject,
      状态: item.status,
      失败原因: item.failureReason || '',
      发送时间: item.sentAt?.toLocaleString() || '',
    })));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent('邮件发送记录.xlsx')}`);
    res.send(buffer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
