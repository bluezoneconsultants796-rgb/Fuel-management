import {
  Role,
  FuelType as DbFuelType,
  FuelEntryStatus as DbFuelEntryStatus,
  User as DbUser
} from '@prisma/client';

/* ── API-level constants & types (contract preserved: lowercase roles,
      'Petrol'/'Diesel', lowercase statuses) ─────────────────────────────── */

export const USER_ROLES = ['admin', 'accountant', 'driver'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const FUEL_TYPES = ['Petrol', 'Diesel'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_ENTRY_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type FuelEntryStatus = (typeof FUEL_ENTRY_STATUSES)[number];

export const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  driverId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── DB ↔ API enum mappers ─────────────────────────────────────────────── */

export function toApiRole(role: Role): UserRole {
  return role.toLowerCase() as UserRole;
}

export function toDbRole(role: UserRole): Role {
  return role.toUpperCase() as Role;
}

export function toApiFuelType(value: DbFuelType): FuelType {
  return value === 'PETROL' ? 'Petrol' : 'Diesel';
}

export function toDbFuelType(value: FuelType): DbFuelType {
  return value === 'Petrol' ? 'PETROL' : 'DIESEL';
}

export function toApiStatus(value: DbFuelEntryStatus): FuelEntryStatus {
  return value.toLowerCase() as FuelEntryStatus;
}

export function toDbStatus(value: FuelEntryStatus): DbFuelEntryStatus {
  return value.toUpperCase() as DbFuelEntryStatus;
}

/* ── User serializer (never exposes passwordHash) ──────────────────────── */

export function toSafeUser(user: DbUser): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: toApiRole(user.role),
    driverId: user.driverId,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}