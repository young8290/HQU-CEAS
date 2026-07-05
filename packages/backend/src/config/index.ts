export const config = {
  port: parseInt(process.env.PORT || '4000'),
  jwtSecret: process.env.JWT_SECRET || 'hqu-ceas-secret-key-2026',
  jwtExpiresIn: '24h',
  bcryptRounds: 12,
  corsOrigin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'https://zongce.youngspace.top'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};
