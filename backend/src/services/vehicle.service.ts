import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { UUID_REGEX } from '../types/domain';
import { assignDriverToVehicle } from './fleet.service';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';

type VehicleWithDriver = Prisma.VehicleGetPayload<{ include: { assignedDriver: true } }>;

export interface VehicleDTO {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  model: string;
  isActive: boolean;
  assignedDriver: {
    id: string;
    name: string;
    employeeId: string;
    phone: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleInput {
  vehicleNumber: string;
  vehicleType: string;
  model: string;
  assignedDriverId?: string | null;
  isActive?: boolean;
}

export interface UpdateVehicleInput {
  vehicleNumber?: string;
  vehicleType?: string;
  model?: string;
  assignedDriverId?: string | null;
  isActive?: boolean;
}

export function toVehicleDTO(vehicle: VehicleWithDriver): VehicleDTO {
  return {
    id: vehicle.id,
    vehicleNumber: vehicle.vehicleNumber,
    vehicleType: vehicle.vehicleType,
    model: vehicle.model,
    isActive: vehicle.isActive,
    assignedDriver: vehicle.assignedDriver
      ? {
          id: vehicle.assignedDriver.id,
          name: vehicle.assignedDriver.name,
          employeeId: vehicle.assignedDriver.employeeId,
          phone: vehicle.assignedDriver.phone
        }
      : null,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString()
  };
}

function assertUuid(value: string, field: string): string {
  if (!UUID_REGEX.test(value)) {
    throw ApiError.badRequest(`Invalid ${field}: must be a valid id.`);
  }
  return value;
}

export async function listVehicles(query: Record<string, string | undefined>) {
  const { page, limit, skip } = parsePagination(query);
  const conditions: Prisma.VehicleWhereInput[] = [];

  if (query.isActive) {
    if (query.isActive !== 'true' && query.isActive !== 'false') {
      throw ApiError.badRequest('isActive filter must be "true" or "false".');
    }
    conditions.push({ isActive: query.isActive === 'true' });
  }

  if (query.assignedDriverId) {
    conditions.push({ assignedDriverId: assertUuid(query.assignedDriverId, 'assignedDriverId filter') });
  }

  if (query.search) {
    const term = query.search.trim();
    conditions.push({
      OR: [
        { vehicleNumber: { contains: term, mode: 'insensitive' } },
        { model: { contains: term, mode: 'insensitive' } },
        { vehicleType: { contains: term, mode: 'insensitive' } }
      ]
    });
  }

  const where: Prisma.VehicleWhereInput = conditions.length ? { AND: conditions } : {};

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { vehicleNumber: 'asc' },
      skip,
      take: limit,
      include: { assignedDriver: true }
    }),
    prisma.vehicle.count({ where })
  ]);

  return {
    vehicles: vehicles.map(toVehicleDTO),
    pagination: buildPaginationMeta(page, limit, total)
  };
}

export async function getVehicleById(id: string): Promise<VehicleDTO> {
  assertUuid(id, 'vehicle id');
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { assignedDriver: true }
  });
  if (!vehicle) throw ApiError.notFound('Vehicle not found.');
  return toVehicleDTO(vehicle);
}

export async function createVehicle(input: CreateVehicleInput): Promise<VehicleDTO> {
  const vehicleNumber = input.vehicleNumber.trim().toUpperCase();
  const existing = await prisma.vehicle.findUnique({ where: { vehicleNumber } });
  if (existing) throw ApiError.conflict(`A vehicle with number ${vehicleNumber} already exists.`);

  if (input.assignedDriverId) {
    const driver = await prisma.driver.findUnique({ where: { id: input.assignedDriverId } });
    if (!driver) throw ApiError.badRequest('Assigned driver not found.');
    if (!driver.isActive) throw ApiError.badRequest('The selected driver is inactive.');
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      vehicleNumber,
      vehicleType: input.vehicleType.trim(),
      model: input.model.trim(),
      isActive: input.isActive ?? true
    }
  });

  if (input.assignedDriverId) {
    await assignDriverToVehicle(vehicle.id, input.assignedDriverId);
  }

  return getVehicleById(vehicle.id);
}

export async function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDTO> {
  assertUuid(id, 'vehicle id');
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw ApiError.notFound('Vehicle not found.');

  if (input.vehicleNumber !== undefined) {
    const vehicleNumber = input.vehicleNumber.trim().toUpperCase();
    if (vehicleNumber !== vehicle.vehicleNumber) {
      const existing = await prisma.vehicle.findFirst({ where: { vehicleNumber, id: { not: id } } });
      if (existing) throw ApiError.conflict(`A vehicle with number ${vehicleNumber} already exists.`);
    }
  }

  await prisma.vehicle.update({
    where: { id },
    data: {
      vehicleNumber: input.vehicleNumber !== undefined ? input.vehicleNumber.trim().toUpperCase() : undefined,
      vehicleType: input.vehicleType !== undefined ? input.vehicleType.trim() : undefined,
      model: input.model !== undefined ? input.model.trim() : undefined,
      isActive: input.isActive
    }
  });

  if (input.assignedDriverId !== undefined) {
    await assignDriverToVehicle(id, input.assignedDriverId ?? null);
  }

  return getVehicleById(id);
}

export async function deleteVehicle(id: string): Promise<void> {
  assertUuid(id, 'vehicle id');
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) throw ApiError.notFound('Vehicle not found.');

  const hasEntries = await prisma.fuelEntry.findFirst({
    where: { vehicleId: id },
    select: { id: true }
  });
  if (hasEntries) {
    throw ApiError.conflict(
      'This vehicle has fuel entries recorded. Deactivate the vehicle instead of deleting, to preserve historical records.'
    );
  }

  await prisma.driver.updateMany({ where: { assignedVehicleId: id }, data: { assignedVehicleId: null } });
  await prisma.vehicle.delete({ where: { id } });
}