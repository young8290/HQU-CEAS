import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import multer from 'multer';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupWebSocket } from './ws/index.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import gradeRoutes from './routes/grades.js';
import studentRoutes from './routes/students.js';
import scoreRoutes from './routes/scores.js';
import importRoutes from './routes/import.js';
import exportRoutes from './routes/export.js';
import academicYearRoutes from './routes/academicYears.js';
import systemSettingsRoutes from './routes/systemSettings.js';
import templateRoutes from './routes/templates.js';
import externalAwardRoutes from './routes/externalAwards.js';
import awardQuotaRoutes from './routes/awardQuotas.js';
import classHonorRoutes from './routes/classHonors.js';
import awardRoutes from './routes/awards.js';
import awardDeclarationRoutes from './routes/awardDeclarations.js';
import honorRoutes from './routes/honors.js';
import honorDeclarationRoutes from './routes/honorDeclarations.js';
import declarationSupplementRoutes from './routes/declarationSupplements.js';
import declarationReviewRoutes from './routes/declarationReviews.js';
import scoreReviewGroupRoutes from './routes/scoreReviewGroups.js';
import scoreReviewInviteRoutes from './routes/scoreReviewInvites.js';
import signatureRoutes from './routes/signatures.js';
import pdfMaterialRoutes from './routes/pdfMaterials.js';
import tagRoutes from './routes/tags.js';
import auditLogRoutes from './routes/auditLogs.js';
import mailRoutes from './routes/mail.js';
import mailSettingRoutes from './routes/mailSettings.js';
import mailTemplateRoutes from './routes/mailTemplates.js';
import mailLogRoutes from './routes/mailLogs.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload middleware for student batch routes
const upload = multer({ storage: multer.memoryStorage() });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/students', (req, res, next) => {
  if (req.path.startsWith('/batch') && req.method === 'POST') {
    upload.single('file')(req, res, next);
  } else {
    next();
  }
}, studentRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/system', systemSettingsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/external-awards', externalAwardRoutes);
app.use('/api/award-quotas', awardQuotaRoutes);
app.use('/api/class-honors', classHonorRoutes);
app.use('/api/awards', awardRoutes);
app.use('/api/award-declarations', awardDeclarationRoutes);
app.use('/api/honors', honorRoutes);
app.use('/api/honor-declarations', honorDeclarationRoutes);
app.use('/api/declaration-supplements', declarationSupplementRoutes);
app.use('/api/declaration-reviews', declarationReviewRoutes);
app.use('/api/score-review-groups', scoreReviewGroupRoutes);
app.use('/api/score-review-invites', scoreReviewInviteRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/pdf-materials', pdfMaterialRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/mail/settings', mailSettingRoutes);
app.use('/api/mail/templates', mailTemplateRoutes);
app.use('/api/mail/logs', mailLogRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'comprehensive-eval-backend',
    status: 'ok',
    health: '/api/health',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// WebSocket
setupWebSocket(server);

// Start
server.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`WebSocket on ws://localhost:${config.port}/ws`);
});

export default app;
