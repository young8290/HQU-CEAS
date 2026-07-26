import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type ExcelJS from 'exceljs';

/**
 * Excel 导出共享工具（综测/申报两个导出服务共用，PLAN_V2 §3）。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 导出模板目录：packages/backend/templates
 * （src/core/utils -> 上三级到包根；构建后 dist/core/utils 深度一致）
 */
export const TEMPLATE_DIR = path.resolve(__dirname, '..', '..', '..', 'templates');

/** 将工作簿写出为 Node Buffer（exceljs 返回 ArrayBuffer 兼容体，统一收敛） */
export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
