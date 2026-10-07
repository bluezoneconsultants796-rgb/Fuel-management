import bcrypt from 'bcryptjs';
import { User as DbUser } from '@prisma/client';
import { prisma } from '../config/db';
import { SafeUser, toApiRole, toSafeUser } from '../types/domain';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export interface LoginResult {
  token: string;
  user: SafeUser;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  employeeId: string;
  vehicle: {
    id: string;
    vehicleNumber: string;
    vehicleType: string;
    model: string;
  } | null;
}

export interface ProfileResult {
  user: SafeUser;
  driver: DriverProfile | null;
}

/* ── Brute-force login lockout (in-memory, per email + IP) ─────────────── */
interface LoginAttempt {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, LoginAttempt>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// Pre-computed hash so unknown emails cost the same bcrypt time as known ones
// (prevents user enumeration via response timing).
const DUMMY_HASH = bcrypt.hashSync('timing-equalization-dummy', 10);

export async function login(
  email: string,
  password: string,
  clientIp = 'unknown'
): Promise<LoginResult> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  const key = `${normalizedEmail}|${clientIp}`;
  const now = Date.now();

  if (loginAttempts.size > 1000) {
    for (const [k, v] of loginAttempts) {
      if (v.lockedUntil <= now && v.count === 0) loginAttempts.delete(k);
    }
  }

  const attempt = loginAttempts.get(key);
  if (attempt && attempt.lockedUntil > now) {
    const minutes = Math.max(1, Math.ceil((attempt.lockedUntil - now) / 60000));
    throw new ApiError(
      429,
      `Too many failed login attempts. This account is locked for ${minutes} more ${minutes === 1 ? 'minute' : 'minutes'}.`
    );
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  const referenceHash = user ? user.passwordHash : DUMMY_HASH;
  const passwordMatches = await bcrypt.compare(String(password ?? ''), referenceHash);

  if (!user || !passwordMatches) {
    const current = attempt ?? { count: 0, lockedUntil: 0 };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      current.count = 0;
    }
    loginAttempts.set(key, current);
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Please contact the administrator.');
  }

  loginAttempts.delete(key);
  const token = signToken({ sub: user.id, role: toApiRole(user.role) });
  return { token, user: toSafeUser(user) };
}

export async function getProfile(user: DbUser): Promise<ProfileResult> {
  const safeUser = toSafeUser(user);

  if (user.role !== 'DRIVER' || !user.driverId) {
    return { user: safeUser, driver: null };
  }

  const driver = await prisma.driver.findUnique({
    where: { id: user.driverId },
    include: { assignedVehicle: true }
  });
  if (!driver) {
    return { user: safeUser, driver: null };
  }

  let vehicle: DriverProfile['vehicle'] = null;
  if (driver.assignedVehicle) {
    const v = driver.assignedVehicle;
    vehicle = {
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType,
      model: v.model
    };
  }

  return {
    user: safeUser,
    driver: {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      employeeId: driver.employeeId,
      vehicle
    }
  };
}

export async function changePassword(
  user: DbUser,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const doc = await prisma.user.findUnique({ where: { id: user.id } });
  if (!doc) throw ApiError.notFound('User not found.');

  const currentMatches = await bcrypt.compare(currentPassword, doc.passwordHash);
  if (!currentMatches) throw ApiError.unauthorized('Current password is incorrect.');

  const sameAsOld = await bcrypt.compare(newPassword, doc.passwordHash);
  if (sameAsOld) {
    throw ApiError.badRequest('The new password must be different from the current password.');
  }

  await prisma.user.update({
    where: { id: doc.id },
    data: { passwordHash: await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS) }
  });
}