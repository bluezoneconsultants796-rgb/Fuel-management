import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Something went wrong on our side. Please try again.';
  let errors: Record<string, string[]> | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err instanceof MulterError) {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      message = `File is too large. Maximum allowed slip size is ${env.MAX_FILE_SIZE_MB} MB.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field. Please upload the slip using the form-data field name "file".';
    } else {
      message = `File upload error: ${err.message}`;
    }
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002 unique constraint · P2025 record not found · P2003 foreign key
    if (err.code === 'P2002') {
      statusCode = 409;
      const target = err.meta?.target as unknown;
      const fields = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : '';
      message = fields
        ? `Duplicate value for: ${fields}. This record already exists.`
        : 'Duplicate record detected.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found.';
    } else if (err.code === 'P2003') {
      statusCode = 400;
      message = 'A related record is missing — check the linked driver or vehicle.';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided. Please check your input.';
  } else if (err instanceof Error) {
    message = env.NODE_ENV === 'production' ? 'Something went wrong on our side. Please try again.' : err.message;
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${statusCode}`, {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {})
  });
}