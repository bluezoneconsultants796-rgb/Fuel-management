import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateBody, validateId } from '../middleware/validate';
import { createUserSchema, updateUserSchema } from '../validators/user.validator';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(userController.listUsers));
router.post('/', validateBody(createUserSchema), asyncHandler(userController.createUser));
router.put(
  '/:id',
  validateId('id'),
  validateBody(updateUserSchema),
  asyncHandler(userController.updateUser)
);
router.delete('/:id', validateId('id'), asyncHandler(userController.deleteUser));

export default router;