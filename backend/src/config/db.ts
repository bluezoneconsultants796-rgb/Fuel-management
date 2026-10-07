import { PrismaClient } from '@prisma/client';
import { isDev } from './env';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: isDev ? ['warn', 'error'] : ['error']
});

export async function connectDB(): Promise<void> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL (Neon) connected via Prisma');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to connect to PostgreSQL: ${message}`);
    logger.error('Check DATABASE_URL in backend/.env and make sure your Neon database is reachable.');
    process.exit(1);
  }
}