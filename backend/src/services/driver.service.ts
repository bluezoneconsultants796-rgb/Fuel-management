import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { UUID_REGEX } from '../types/domain';
import { assignVehicleToDriver } from './fleet.service';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';

type DriverWithVehicle = Prisma.DriverGetPayload<{ include: { assignedVehicle: true } }>;

export interface DriverDTO {
  id: string;
  name: string;
  phone: string;
  employeeId: string;
  isActive: boolean;
  assignedVehicle: {
    id: string;
    vehicleNumber: string;
    vehicleType: string;
    model: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverInput {
  name: string;
  phone: string;
  employeeId: string;
  assignedVehicleId?: string | null;
  isActive?: boolean;
}

export interface UpdateDriverInput {
  name?: string;
  phone?: string;
  employeeId?: string;
  assignedVehicleId?: string | null;
  isActive?: boolean;
}

export function toDriverDTO(driver: DriverWithVehicle): DriverDTO {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    employeeId: driver.employeeId,
    isActive: driver.isActive,
    assignedVehicle: driver.assignedVehicle
      ? {
          id: driver.assignedVehicle.id,
          vehicleNumber: driver.assignedVehicle.vehicleNumber,
          vehicleType: driver.assignedVehicle.vehicleType,
          model: driver.assignedVehicle.model
        }
      : null,
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString()
  };
}

function assertUuid(value: string, field: string): string {
  if (!UUID_REGEX.test(value)) {
    throw ApiError.badRequest(`Invalid ${field}: must be a valid id.`);
  }
  return value;
}

export async function listDrivers(query: Record<string, string | undefined>) {
  const { page, limit, skip } = parsePagination(query);
  const conditions: Prisma.DriverWhereInput[] = [];

  if (query.isActive) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw ApiError.badRequest('isActive filter must be "true" or "false".');
    }
    conditions.push({ isActive: query.isActive === 'true' });
  }

  if (query.assignedVehicleId) {
    conditions.push({ assignedVehicleId: assertUuid(query.assignedVehicleId, 'assignedVehicleId filter') });
  }

  if (query.search) {
    const term = query.search.trim();
    conditions.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { employeeId: { contains: term, mode: 'insensitive' } }
      ]
    });
  }

  const where: Prisma.DriverWhereInput = conditions.length ? { AND: conditions } : {};

  const [drivers, total] = await Promise.all([
    prisma.driver.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
      include: { assignedVehicle: true }
    }),
    prisma.driver.count({ where })
  ]);

  return {
    drivers: drivers.map(toDriverDTO),
    pagination: buildPaginationMeta(page, limit, total)
  };
}

export async function getDriverById(id: string): Promise<DriverDTO> {
  assertUuid(id, 'driver id');
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: { assignedVehicle: true }
  });
  if (!driver) throw ApiError.notFound('Driver not found.');
  return toDriverDTO(driver);
}

export async function createDriver(input: CreateDriverInput): Promise<DriverDTO> {
  const employeeId = input.employeeId.trim().toUpperCase();
  const existing = await prisma.driver.findUnique({ where: { employeeId } });
  if (existing) throw ApiError.conflict('A driver with this employee ID already exists.');

  if (input.assignedVehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: input.assignedVehicleId } });
    if (!vehicle) throw ApiError.badRequest('Assigned vehicle not found.');
    if (!vehicle.isActive) throw ApiError.badRequest('The selected vehicle is inactive.');
  }

  const driver = await prisma.driver.create({
    data: {
      name: input.name.trim(),
      phone: input.phone.trim(),
      employeeId,
      isActive: input.isActive ?? true
    }
  });

  if (input.assignedVehicleId) {
    await assignVehicleToDriver(driver.id, input.assignedVehicleId);
  }

  return getDriverById(driver.id);
}

export async function updateDriver(id: string, input: UpdateDriverInput): Promise<DriverDTO> {
  assertUuid(id, 'driver id');
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) throw ApiError.notFound('Driver not found.');

  if (input.employeeId !== undefined) {
    const employeeId = input.employeeId.trim().toUpperCase();
    const existing = await prisma.driver.findFirst({ where: { employeeId, id: { not: id } } });
    if (existing) throw ApiError.conflict('A driver with this employee ID already exists.');
  }

  await prisma.driver.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      phone: input.phone !== undefined ? input.phone.trim() : undefined,
      employeeId: input.employeeId !== undefined ? input.employeeId.trim().toUpperCase() : undefined,
      isActive: input.isActive
    }
  });

  if (input.isActive !== undefined) {
    // Keep linked login accounts in sync with the driver's employment status
    await prisma.user.updateMany({ where: { driverId: id }, data: { isActive: input.isActive } });
  }

  if (input.assignedVehicleId !== undefined) {
    await assignVehicleToDriver(id, input.assignedVehicleId ?? null);
  }

  return getDriverById(id);
}

export async function deleteDriver(id: string): Promise<void> {
  assertUuid(id, 'driver id');
  const driver = await prisma.driver.findUnique({ where: { id } });
  if (!driver) throw ApiError.notFound('Driver not found.');

  const hasEntries = await prisma.fuelEntry.findFirst({
    where: { driverId: id },
    select: { id: true }
  });
  if (hasEntries) {
    throw ApiError.conflict(
      'This driver has fuel entries recorded. Deactivate the driver instead of deleting, to preserve historical records.'
    );
  }

  await prisma.vehicle.updateMany({ where: { assignedDriverId: id }, data: { assignedDriverId: null } });
  await prisma.user.updateMany({ where: { driverId: id }, data: { driverId: null, isActive: false } });
  await prisma.driver.delete({ where: { id } });
}