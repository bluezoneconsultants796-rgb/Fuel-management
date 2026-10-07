import { z } from 'zod';
import { idSchema } from './common';

export const createDriverSchema = z.object({
  name: z
    .string({ required_error: 'Driver name is required.' })
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100),
  phone: z
    .string({ required_error: 'Phone is required.' })
    .trim()
    .min(7, 'Phone must be at least 7 characters.')
    .max(20),
  employeeId: z
    .string({ required_error: 'Employee ID is required.' })
    .trim()
    .min(2, 'Employee ID must be at least 2 characters.')
    .max(30),
  assignedVehicleId: idSchema.nullish(),
  isActive: z.boolean().optional()
});

export const updateDriverSchema = createDriverSchema.partial();