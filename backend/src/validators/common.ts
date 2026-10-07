import { z } from 'zod';
import { UUID_REGEX } from '../types/domain';

/** Shared validator for entity ids (UUID primary keys). */
export const idSchema = z.string().regex(UUID_REGEX, 'Must be a valid ID.');
