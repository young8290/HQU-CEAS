import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  userId: number;
  username: string;
  role: string;
  classId: number | null;
  reviewInviteId?: number;
  reviewMemberId?: number;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload as object, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}
