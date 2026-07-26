import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

/**
 * 安全与体积/限流中间件（PLAN_V2 §5.6 / §6）。
 *
 * - helmet：默认基线安全头。
 * - compression：gzip 压缩（JSON/Excel 导出响应收益明显）。
 * - 全局限流：宽松（600 次/分钟/IP），只防滥用不影响正常并发。
 * - 登录限流：严格（20 次/15 分钟/IP），挂在 /api/platform/auth/login 与旧别名 /api/auth/login。
 * - JSON 体积：全局默认收紧为 2mb；仅导入前缀（/api/import、/api/evaluation/import，
 *   其 /export-failures 接收批量失败明细 JSON）放宽到 50mb。
 *   其余大文件均走 multer 的 multipart 上传，不经过 express.json。
 */

export const securityHeaders = helmet();

export const httpCompression = compression();

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '登录尝试过于频繁，请15分钟后再试' },
});

/** 全局 JSON 体积上限（默认路由） */
export const jsonBody = express.json({ limit: '2mb' });

/** 导入前缀专用 JSON 体积上限（批量失败明细等大 JSON 载荷） */
export const jsonBodyLarge = express.json({ limit: '50mb' });

/** 表单编码体积上限（本项目无大表单，统一 2mb） */
export const urlencodedBody = express.urlencoded({ extended: true, limit: '2mb' });
