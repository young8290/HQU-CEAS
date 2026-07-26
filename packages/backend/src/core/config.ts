import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 全局配置（PLAN_V2 §3 core/config.ts）。
 *
 * - 显式加载 packages/backend/.env（不依赖 Prisma 的隐式加载，保证在任何模块
 *   读取 process.env 之前完成；真实环境变量优先，.env 不覆盖已有值）。
 * - JWT 密钥策略（PLAN_V2 §6）：生产环境缺失 JWT_SECRET 则拒绝启动（fail-fast）；
 *   非生产环境仅告警一次并沿用原开发 fallback，避免破坏本地开发与测试。
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// src/core -> packages/backend（构建后 dist/core -> packages/backend，深度一致）
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');

function loadEnvFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    console.warn('[config] 读取 .env 失败（忽略，仅使用现有环境变量）:', (err as Error).message);
  }
}

loadEnvFile(path.join(BACKEND_ROOT, '.env'));

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// 原 v1 硬编码密钥，仅允许在非生产环境作为 fallback 存活（保持 dev/测试行为不变）。
const DEV_FALLBACK_JWT_SECRET = 'hqu-ceas-secret-key-2026';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (isProduction) {
    throw new Error(
      '[config] JWT_SECRET 未配置：生产环境拒绝启动。'
      + '请设置环境变量 JWT_SECRET（生成示例：node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"）',
    );
  }
  console.warn('[config] JWT_SECRET 未配置，使用开发用不安全默认值（仅限本地开发/测试，切勿用于公网部署）。');
  jwtSecret = DEV_FALLBACK_JWT_SECRET;
}

function parseCorsOrigin(raw: string | undefined): string | string[] {
  if (!raw) return ['http://localhost:3000', 'https://zongce.youngspace.top'];
  const parts = raw.split(',').map((item) => item.trim()).filter(Boolean);
  return parts.length === 1 ? parts[0] : parts;
}

export const config = {
  nodeEnv,
  isProduction,
  port: parseInt(process.env.PORT || '4000'),
  jwtSecret,
  jwtExpiresIn: '24h',
  bcryptRounds: 12,
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};

export const BACKEND_PACKAGE_ROOT = BACKEND_ROOT;
