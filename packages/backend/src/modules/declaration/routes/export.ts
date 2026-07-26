import { Router, Request, Response } from 'express';
import { authMiddleware, adminOnly } from '../../../core/middleware/auth.js';
import * as exportService from '../services/exportService.js';
import * as academicYearService from '../../platform/services/academicYearService.js';
import prisma from '../../../core/db.js';

/**
 * 申报系统导出路由（原 routes/export.ts 申报半）：
 * declarations / award-allocation / honor-declarations / declaration-attachment2 /
 * signature-name-list / mail-logs。
 * 挂载：/api/declaration/export（旧别名 /api/export，与综测导出路由级联兜底）。
 */

const router = Router();

router.use(authMiddleware);

async function getAcademicYearId(yearIdParam?: any): Promise<number> {
  if (yearIdParam) return parseInt(yearIdParam);
  const current = await academicYearService.getCurrentAcademicYear();
  if (!current) throw new Error('未设置当前学年');
  return current.id;
}

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

// 签字名单（交学术部存档）— 完全复用附件2申报汇总导出，仅提供独立入口与文件名
router.get('/signature-name-list', adminOnly, async (req: Request, res: Response) => {
  try {
    const academicYearId = await getAcademicYearId(req.query.academicYearId);
    const buffer = await exportService.exportDeclarationAttachment2(academicYearId); // 完全复用
    const fileName = '附件2-院级奖学金优秀学生干部优秀学生汇总表(签字名单).xlsx';
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
