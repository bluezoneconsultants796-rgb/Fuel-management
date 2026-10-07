import { Request } from 'express';
import { User } from '@prisma/client';

/**
 * Request augmented with the authenticated user (set by requireAuth).
 */
export interface AuthRequest extends Request {
  user?: User;
}