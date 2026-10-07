import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import {
  SafeUser,
  USER_ROLES,
  UserRole,
  toApiRole,
  toDbRole,
  toSafeUser
} from '../types/domain';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';

export interface CreateUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  driverId?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  driverId?: string | null;
  isActive?: boolean;
}

export async function listUsers(
  query: Record<string, string | undefined>
) {
  const { page, limit, skip } = parsePagination(query);
  const conditions: Prisma.UserWhereInput[] = [];

  if (query.role) {
    if (!USER_ROLES.includes(query.role as UserRole)) {
      throw ApiError.badRequest(
        `Invalid role filter. Allowed values: ${USER_ROLES.join(', ')}.`
      );
    }

    conditions.push({
      role: toDbRole(query.role as UserRole)
    });
  }

  if (query.isActive) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw ApiError.badRequest('isActive filter must be "true" or "false".');
    }

    conditions.push({
      isActive: query.isActive === 'true'
    });
  }

  if (query.search) {
    const term = query.search.trim();

    conditions.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } }
      ]
    });
  }

  const where: Prisma.UserWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit
    }),
    prisma.user.count({ where })
  ]);

  return {
    users: users.map(toSafeUser),
    pagination: buildPaginationMeta(page, limit, total)
  };
}

export async function createUser(
  input: CreateUserInput
): Promise<SafeUser> {
  const email = input.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email }
  });

  if (existing) {
    throw ApiError.conflict(
      'A user with this email already exists.'
    );
  }

  let driverId: string | null = null;

  if (input.role === 'driver') {
    if (!input.driverId) {
      throw ApiError.badRequest(
        'driverId is required for driver accounts.'
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id: input.driverId }
    });

    if (!driver) {
      throw ApiError.badRequest(
        'Linked driver profile not found.'
      );
    }

    const linkedUser = await prisma.user.findFirst({
      where: { driverId: input.driverId }
    });

    if (linkedUser) {
      throw ApiError.conflict(
        'This driver is already linked to another user account.'
      );
    }

    driverId = driver.id;
  }

  const passwordHash = await bcrypt.hash(
    input.password,
    env.BCRYPT_SALT_ROUNDS
  );

  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() ?? '',
      passwordHash,
      role: toDbRole(input.role),
      driverId,
      isActive: input.isActive ?? true
    }
  });

  return toSafeUser(user);
}

export async function updateUser(
  userId: string,
  requesterId: string,
  input: UpdateUserInput
): Promise<SafeUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  if (
    input.email &&
    input.email.trim().toLowerCase() !== user.email
  ) {
    const email = input.email.trim().toLowerCase();

    const existing = await prisma.user.findFirst({
      where: {
        email,
        id: { not: user.id }
      }
    });

    if (existing) {
      throw ApiError.conflict(
        'A user with this email already exists.'
      );
    }
  }

  const newRole: UserRole =
    input.role ?? toApiRole(user.role);

  const newDriverId: string | null =
    input.driverId !== undefined
      ? input.driverId ?? null
      : user.driverId;

  const newIsActive: boolean =
    input.isActive !== undefined
      ? input.isActive
      : user.isActive;

  // Self-protection: an admin cannot demote or deactivate their own account
  if (
    user.id === requesterId &&
    (newRole !== toApiRole(user.role) || newIsActive === false)
  ) {
    throw ApiError.badRequest(
      'You cannot change your own role or deactivate your own account.'
    );
  }

  // Always keep at least one active administrator in the system
  if (
    toApiRole(user.role) === 'admin' &&
    (newRole !== 'admin' || newIsActive === false)
  ) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        id: { not: user.id }
      }
    });

    if (otherActiveAdmins === 0) {
      throw ApiError.conflict(
        'At least one active administrator must remain. Promote another admin first.'
      );
    }
  }

  if (newRole === 'driver') {
    if (!newDriverId) {
      throw ApiError.badRequest(
        'driverId is required for driver accounts.'
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id: newDriverId }
    });

    if (!driver) {
      throw ApiError.badRequest(
        'Linked driver profile not found.'
      );
    }

    const linked = await prisma.user.findFirst({
      where: {
        driverId: newDriverId,
        id: { not: user.id }
      }
    });

    if (linked) {
      throw ApiError.conflict(
        'This driver is already linked to another user account.'
      );
    }
  }

  const data: Prisma.UserUncheckedUpdateInput = {
    name:
      input.name !== undefined
        ? input.name.trim()
        : undefined,

    email:
      input.email !== undefined
        ? input.email.trim().toLowerCase()
        : undefined,

    phone:
      input.phone !== undefined
        ? input.phone.trim()
        : undefined,

    passwordHash:
      input.password
        ? await bcrypt.hash(
            input.password,
            env.BCRYPT_SALT_ROUNDS
          )
        : undefined,

    role: toDbRole(newRole),

    driverId:
      newRole === 'driver'
        ? newDriverId
        : null,

    isActive: newIsActive
  };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data
  });

  return toSafeUser(updated);
}

export async function deleteUser(
  userId: string,
  requesterId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  if (user.id === requesterId) {
    throw ApiError.badRequest(
      'You cannot delete your own account.'
    );
  }

  if (user.role === 'ADMIN') {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        id: { not: user.id }
      }
    });

    if (otherActiveAdmins === 0) {
      throw ApiError.conflict(
        'At least one active administrator must remain. Promote another admin first.'
      );
    }
  }

  await prisma.user.delete({
    where: { id: user.id }
  });
}