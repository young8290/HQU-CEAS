import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config, BACKEND_PACKAGE_ROOT } from './core/config.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import {
  securityHeaders,
  httpCompression,
  globalRateLimit,
  loginRateLimit,
  jsonBody,
  jsonBodyLarge,
  urlencodedBody,
} from './core/middleware/security.js';

// ── 平台共用（modules/platform） ─────────────────────────────────────────────
import authRoutes from './modules/platform/routes/auth.js';
import userRoutes from './modules/platform/routes/users.js';
import gradeRoutes from './modules/platform/routes/grades.js';
import studentRoutes from './modules/platform/routes/students.js';
import academicYearRoutes from './modules/platform/routes/academicYears.js';
import systemSettingsRoutes from './modules/platform/routes/systemSettings.js';
import signatureRoutes from './modules/platform/routes/signatures.js';
import pdfMaterialRoutes from './modules/platform/routes/pdfMaterials.js';
import auditLogRoutes from './modules/platform/routes/auditLogs.js';
import mailRoutes from './modules/platform/routes/mail.js';
import mailSettingRoutes from './modules/platform/routes/mailSettings.js';
import mailTemplateRoutes from './modules/platform/routes/mailTemplates.js';
import mailLogRoutes from './modules/platform/routes/mailLogs.js';

// ── 综测系统（modules/evaluation） ───────────────────────────────────────────
import scoreRoutes from './modules/evaluation/routes/scores.js';
import importRoutes from './modules/evaluation/routes/import.js';
import templateRoutes from './modules/evaluation/routes/templates.js';
import scoreReviewGroupRoutes from './modules/evaluation/routes/scoreReviewGroups.js';
import scoreReviewInviteRoutes from './modules/evaluation/routes/scoreReviewInvites.js';
import evaluationExportRoutes from './modules/evaluation/routes/export.js';

// ── 申报系统（modules/declaration） ──────────────────────────────────────────
import externalAwardRoutes from './modules/declaration/routes/externalAwards.js';
import awardQuotaRoutes from './modules/declaration/routes/awardQuotas.js';
import classHonorRoutes from './modules/declaration/routes/classHonors.js';
import awardRoutes from './modules/declaration/routes/awards.js';
import awardDeclarationRoutes from './modules/declaration/routes/awardDeclarations.js';
import nationalScholarshipRoutes from './modules/declaration/routes/nationalScholarships.js';
import honorRoutes from './modules/declaration/routes/honors.js';
import honorDeclarationRoutes from './modules/declaration/routes/honorDeclarations.js';
import declarationSupplementRoutes from './modules/declaration/routes/declarationSupplements.js';
import declarationReviewRoutes from './modules/declaration/routes/declarationReviews.js';
import tagRoutes from './modules/declaration/routes/tags.js';
import declarationExportRoutes from './modules/declaration/routes/export.js';

/**
 * 应用组装（PLAN_V2 §2/§3）：安全中间件 → 双系统新前缀挂载 → 旧路径全量别名 →
 * （生产静态服务，Wave 2 接入点）→ 404 → errorHandler。
 *
 * 新前缀三分：/api/platform（平台共用）、/api/evaluation（综测）、/api/declaration（申报）。
 * 旧路径全部保留为别名（同一 router 实例多挂一次，标注 deprecated），过渡零断裂。
 */

const app = express();

// cloudflared 单源部署为一跳代理；同时保证 express-rate-limit 读取真实客户端 IP。
app.set('trust proxy', 1);

// ── 安全与性能中间件（PLAN_V2 §5.6 / §6） ────────────────────────────────────
app.use(securityHeaders);
app.use(httpCompression);
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use('/api', globalRateLimit);
// 登录严格限流（新前缀 + 旧别名）
app.use('/api/platform/auth/login', loginRateLimit);
app.use('/api/auth/login', loginRateLimit); // deprecated alias
// 体积限制：导入前缀（/export-failures 批量失败明细 JSON）单独放宽，其余默认 2mb
app.use('/api/evaluation/import', jsonBodyLarge);
app.use('/api/import', jsonBodyLarge); // deprecated alias
app.use(jsonBody);
app.use(urlencodedBody);

// students 批量导入走 multer（保持 v1 行为：仅 POST /batch* 挂 single('file')）
const upload = multer({ storage: multer.memoryStorage() });
const studentsBatchUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/batch') && req.method === 'POST') {
    upload.single('file')(req, res, next);
  } else {
    next();
  }
};

// ── /api/platform —— 平台共用 ────────────────────────────────────────────────
app.use('/api/platform/auth', authRoutes);
app.use('/api/platform/users', userRoutes);
app.use('/api/platform/grades', gradeRoutes);
app.use('/api/platform/students', studentsBatchUpload, studentRoutes);
app.use('/api/platform/academic-years', academicYearRoutes);
app.use('/api/platform/system', systemSettingsRoutes);
app.use('/api/platform/signatures', signatureRoutes);
app.use('/api/platform/pdf-materials', pdfMaterialRoutes);
app.use('/api/platform/audit-logs', auditLogRoutes);
app.use('/api/platform/mail', mailRoutes);
app.use('/api/platform/mail/settings', mailSettingRoutes);
app.use('/api/platform/mail/templates', mailTemplateRoutes);
app.use('/api/platform/mail/logs', mailLogRoutes);

// ── /api/evaluation —— 综测系统 ──────────────────────────────────────────────
app.use('/api/evaluation/scores', scoreRoutes);
app.use('/api/evaluation/import', importRoutes);
app.use('/api/evaluation/templates', templateRoutes);
app.use('/api/evaluation/score-review-groups', scoreReviewGroupRoutes);
app.use('/api/evaluation/score-review-invites', scoreReviewInviteRoutes);
app.use('/api/evaluation/export', evaluationExportRoutes);

// ── /api/declaration —— 申报系统 ─────────────────────────────────────────────
app.use('/api/declaration/external-awards', externalAwardRoutes);
app.use('/api/declaration/award-quotas', awardQuotaRoutes);
app.use('/api/declaration/class-honors', classHonorRoutes);
app.use('/api/declaration/awards', awardRoutes);
app.use('/api/declaration/award-declarations', awardDeclarationRoutes);
app.use('/api/declaration/national-scholarships', nationalScholarshipRoutes);
app.use('/api/declaration/honors', honorRoutes);
app.use('/api/declaration/honor-declarations', honorDeclarationRoutes);
app.use('/api/declaration/declaration-supplements', declarationSupplementRoutes);
app.use('/api/declaration/declaration-reviews', declarationReviewRoutes);
app.use('/api/declaration/tags', tagRoutes);
app.use('/api/declaration/export', declarationExportRoutes);

// ── 旧路径别名（deprecated，PLAN_V2 §2：同 router 实例再挂一次，保证过渡零断裂）──
app.use('/api/auth', authRoutes);                                   // deprecated → /api/platform/auth
app.use('/api/users', userRoutes);                                  // deprecated → /api/platform/users
app.use('/api/grades', gradeRoutes);                                // deprecated → /api/platform/grades
app.use('/api/students', studentsBatchUpload, studentRoutes);       // deprecated → /api/platform/students
app.use('/api/academic-years', academicYearRoutes);                 // deprecated → /api/platform/academic-years
app.use('/api/system', systemSettingsRoutes);                       // deprecated → /api/platform/system
app.use('/api/signatures', signatureRoutes);                        // deprecated → /api/platform/signatures
app.use('/api/pdf-materials', pdfMaterialRoutes);                   // deprecated → /api/platform/pdf-materials
app.use('/api/audit-logs', auditLogRoutes);                         // deprecated → /api/platform/audit-logs
app.use('/api/mail', mailRoutes);                                   // deprecated → /api/platform/mail
app.use('/api/mail/settings', mailSettingRoutes);                   // deprecated → /api/platform/mail/settings
app.use('/api/mail/templates', mailTemplateRoutes);                 // deprecated → /api/platform/mail/templates
app.use('/api/mail/logs', mailLogRoutes);                           // deprecated → /api/platform/mail/logs
app.use('/api/scores', scoreRoutes);                                // deprecated → /api/evaluation/scores
app.use('/api/import', importRoutes);                               // deprecated → /api/evaluation/import
app.use('/api/templates', templateRoutes);                          // deprecated → /api/evaluation/templates
app.use('/api/score-review-groups', scoreReviewGroupRoutes);        // deprecated → /api/evaluation/score-review-groups
app.use('/api/score-review-invites', scoreReviewInviteRoutes);      // deprecated → /api/evaluation/score-review-invites
app.use('/api/export', evaluationExportRoutes);                     // deprecated → /api/evaluation/export
app.use('/api/export', declarationExportRoutes);                    // deprecated → /api/declaration/export（与上一行级联兜底）
app.use('/api/external-awards', externalAwardRoutes);               // deprecated → /api/declaration/external-awards
app.use('/api/award-quotas', awardQuotaRoutes);                     // deprecated → /api/declaration/award-quotas
app.use('/api/class-honors', classHonorRoutes);                     // deprecated → /api/declaration/class-honors
app.use('/api/awards', awardRoutes);                                // deprecated → /api/declaration/awards
app.use('/api/award-declarations', awardDeclarationRoutes);         // deprecated → /api/declaration/award-declarations
app.use('/api/national-scholarships', nationalScholarshipRoutes);   // deprecated → /api/declaration/national-scholarships
app.use('/api/honors', honorRoutes);                                // deprecated → /api/declaration/honors
app.use('/api/honor-declarations', honorDeclarationRoutes);         // deprecated → /api/declaration/honor-declarations
app.use('/api/declaration-supplements', declarationSupplementRoutes); // deprecated → /api/declaration/declaration-supplements
app.use('/api/declaration-reviews', declarationReviewRoutes);       // deprecated → /api/declaration/declaration-reviews
app.use('/api/tags', tagRoutes);                                    // deprecated → /api/declaration/tags

// ── 根信息与健康检查 ─────────────────────────────────────────────────────────
let appVersion = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND_PACKAGE_ROOT, 'package.json'), 'utf8')) as { version?: string };
  appVersion = pkg.version ?? appVersion;
} catch (err) {
  console.warn('[app] 读取 package.json 版本失败:', (err as Error).message);
}

// ── 生产静态服务开关（PLAN_V2 §1 部署决策 / §5.7：单源部署）─────────────────────
// NODE_ENV=production 时自动启用；开发环境可用 SERVE_STATIC=1 强制开启（需先构建前端）。
// dist 缺失时仅告警并跳过（dev 行为完全不受影响）。
const FRONTEND_DIST = path.resolve(BACKEND_PACKAGE_ROOT, '..', 'frontend', 'dist');
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');
const staticWanted = config.isProduction || process.env.SERVE_STATIC === '1';
const staticEnabled = staticWanted && fs.existsSync(FRONTEND_INDEX);
if (staticWanted && !staticEnabled) {
  console.warn(
    `[app] 生产静态服务已跳过：未找到前端构建产物 ${FRONTEND_INDEX}`
    + '（请先执行 npm run build -w packages/frontend）',
  );
}

app.get('/', (req, res, next) => {
  // 生产单源模式下根路径交给 SPA（由下方静态服务返回 index.html）；API 元信息见 /api/health。
  if (staticEnabled) return next();
  res.json({
    name: 'hqu-ceas-backend',
    status: 'ok',
    health: '/api/health',
  });
});

// Health check（响应形状向后兼容：保留 status/timestamp，新增 version/uptime）
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: appVersion,
    uptime: Math.round(process.uptime()),
  });
});

// ── 生产静态服务（Wave 2 P1，PLAN_V2 §5.7）：Express 直接服务 frontend/dist ──────
// 位置约束：必须在全部 API 路由之后、404/errorHandler 之前。
if (staticEnabled) {
  // 1) 带内容哈希的构建产物（/assets/*）：一年 immutable 强缓存。
  app.use(
    '/assets',
    express.static(path.join(FRONTEND_DIST, 'assets'), { immutable: true, maxAge: '1y' }),
  );

  // 2) 其余静态文件（favicon/logo/fonts/guides 等，文件名无哈希）：默认协商缓存（ETag）；
  //    index.html 显式 no-cache——发版后浏览器总能拿到最新入口，再按哈希命中子资源缓存。
  app.use(
    express.static(FRONTEND_DIST, {
      index: false,
      setHeaders: (res, filePath) => {
        if (path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  // 3) SPA fallback：非 /api、非 /ws、非 /assets 的 GET/HEAD 未命中 → 返回 index.html，
  //    由前端路由接管。/assets 未命中直接落到 404，避免用 HTML 掩盖构建产物缺失。
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (
      req.path.startsWith('/api')
      || req.path.startsWith('/ws')
      || req.path.startsWith('/assets/')
    ) {
      return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(FRONTEND_INDEX);
  });

  console.log(`[app] 生产静态服务已启用：${FRONTEND_DIST}`);
}

// ── 404 与统一错误处理 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在', path: req.path });
});

app.use(errorHandler);

export default app;
