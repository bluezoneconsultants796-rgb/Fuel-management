import { Prisma, User as DbUser } from '@prisma/client';
import { prisma } from '../config/db';
import {
  FUEL_ENTRY_STATUSES,
  FUEL_TYPES,
  FuelEntryStatus,
  FuelType,
  UUID_REGEX,
  toApiFuelType,
  toApiStatus,
  toDbFuelType,
  toDbStatus
} from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { buildPaginationMeta, parsePagination } from '../utils/pagination';
import { round2 } from '../utils/number';
import { storageService } from './storage.service';

type FuelEntryRecord = Awaited<
  ReturnType<typeof prisma.fuelEntry.findMany>
>[number];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;

export interface FuelEntryDTO {
  id: string;
  driverId: string;
  vehicleId: string;
  driver: { id: string; name: string; employeeId: string } | null;
  vehicle: { id: string; vehicleNumber: string } | null;
  date: string;
  time: string;
  petrolPumpName: string;
  vehicleNumber: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  receiptNumber: string;
  slipImageUrl: string;
  originalFileName: string;
  status: FuelEntryStatus;
  ocrConfidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelEntryDetailDTO extends FuelEntryDTO {
  ocrRawText: string;
  driverPhone: string | null;
}

export interface CreateFuelEntryInput {
  driverId?: string;
  vehicleId?: string;
  date: string;
  time?: string;
  petrolPumpName: string;
  vehicleNumber?: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalAmount?: number;
  receiptNumber: string;
  slipImageUrl?: string;
  originalFileName?: string;
  ocrRawText?: string;
  ocrConfidence?: number | null;
}

export interface UpdateFuelEntryInput {
  driverId?: string;
  vehicleId?: string;
  date?: string;
  time?: string;
  petrolPumpName?: string;
  vehicleNumber?: string;
  fuelType?: FuelType;
  liters?: number;
  pricePerLiter?: number;
  totalAmount?: number;
  receiptNumber?: string;
  slipImageUrl?: string;
  originalFileName?: string;
  ocrRawText?: string;
  ocrConfidence?: number | null;
  status?: FuelEntryStatus;
}

interface DriverInfo {
  id: string;
  name: string;
  employeeId: string;
  phone: string;
}

interface VehicleInfo {
  id: string;
  vehicleNumber: string;
}

function assertUuid(value: string, field: string): string {
  if (!UUID_REGEX.test(value)) {
    throw ApiError.badRequest(`Invalid ${field}: must be a valid id.`);
  }
  return value;
}

function parseEntryDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw ApiError.badRequest(
      `"${value}" is not a valid calendar date (expected YYYY-MM-DD).`
    );
  }
  return parsed;
}

export function toFuelEntryDTO(
  entry: FuelEntryRecord,
  driver: DriverInfo | null,
  vehicle: VehicleInfo | null
): FuelEntryDTO {
  return {
    id: entry.id,
    driverId: entry.driverId,
    vehicleId: entry.vehicleId,
    driver: driver
      ? { id: driver.id, name: driver.name, employeeId: driver.employeeId }
      : null,
    vehicle: vehicle
      ? { id: vehicle.id, vehicleNumber: vehicle.vehicleNumber }
      : null,
    date: entry.date.toISOString().slice(0, 10),
    time: entry.time,
    petrolPumpName: entry.petrolPumpName,
    vehicleNumber: entry.vehicleNumber,
    fuelType: toApiFuelType(entry.fuelType),
    liters: entry.liters,
    pricePerLiter: entry.pricePerLiter,
    totalAmount: entry.totalAmount,
    receiptNumber: entry.receiptNumber,
    slipImageUrl: entry.slipImageUrl,
    originalFileName: entry.originalFileName,
    status: toApiStatus(entry.status),
    ocrConfidence: entry.ocrConfidence,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

function toFuelEntryDetailDTO(
  entry: FuelEntryRecord,
  driver: DriverInfo | null,
  vehicle: VehicleInfo | null
): FuelEntryDetailDTO {
  return {
    ...toFuelEntryDTO(entry, driver, vehicle),
    ocrRawText: entry.ocrRawText,
    driverPhone: driver ? driver.phone : null
  };
}

function buildFuelFilter(
  query: Record<string, string | undefined>
): Prisma.FuelEntryWhereInput {
  const conditions: Prisma.FuelEntryWhereInput[] = [];

  if (query.driverId) {
    conditions.push({ driverId: assertUuid(query.driverId, 'driverId') });
  }

  if (query.vehicleId) {
    conditions.push({ vehicleId: assertUuid(query.vehicleId, 'vehicleId') });
  }

  if (query.fuelType) {
    const normalized =
      query.fuelType.trim().charAt(0).toUpperCase() +
      query.fuelType.trim().slice(1).toLowerCase();

    if (!FUEL_TYPES.includes(normalized as FuelType)) {
      throw ApiError.badRequest(
        `Invalid fuelType filter. Allowed values: ${FUEL_TYPES.join(', ')}.`
      );
    }

    conditions.push({
      fuelType: toDbFuelType(normalized as FuelType)
    });
  }

  if (query.status) {
    if (!FUEL_ENTRY_STATUSES.includes(query.status as FuelEntryStatus)) {
      throw ApiError.badRequest(
        `Invalid status filter. Allowed values: ${FUEL_ENTRY_STATUSES.join(', ')}.`
      );
    }

    conditions.push({
      status: toDbStatus(query.status as FuelEntryStatus)
    });
  }

  if (query.receiptNumber) {
    conditions.push({
      receiptNumber: {
        contains: query.receiptNumber.trim(),
        mode: 'insensitive'
      }
    });
  }

  if (query.vehicleNumber) {
    conditions.push({
      vehicleNumber: {
        contains: query.vehicleNumber.trim(),
        mode: 'insensitive'
      }
    });
  }

  const dateConditions: { gte?: Date; lte?: Date } = {};

  if (query.from) {
    if (!DATE_REGEX.test(query.from)) {
      throw ApiError.badRequest(
        '"from" must be a valid date in YYYY-MM-DD format.'
      );
    }

    dateConditions.gte = new Date(`${query.from}T00:00:00.000Z`);
  }

  if (query.to) {
    if (!DATE_REGEX.test(query.to)) {
      throw ApiError.badRequest(
        '"to" must be a valid date in YYYY-MM-DD format.'
      );
    }

    dateConditions.lte = new Date(`${query.to}T23:59:59.999Z`);
  }

  if (query.month) {
    if (!MONTH_REGEX.test(query.month)) {
      throw ApiError.badRequest(
        '"month" must be in YYYY-MM format (e.g. 2026-06).'
      );
    }

    const [year, month] = query.month.split('-').map(Number);

    dateConditions.gte =
      dateConditions.gte ??
      new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));

    dateConditions.lte =
      dateConditions.lte ??
      new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  }

  if (Object.keys(dateConditions).length > 0) {
    conditions.push({ date: dateConditions });
  }

  if (query.search) {
    const term = query.search.trim();

    conditions.push({
      OR: [
        { petrolPumpName: { contains: term, mode: 'insensitive' } },
        { receiptNumber: { contains: term, mode: 'insensitive' } },
        { vehicleNumber: { contains: term, mode: 'insensitive' } }
      ]
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

async function fetchDriverAndVehicleMaps(
  entries: Array<{ driverId: string; vehicleId: string }>
): Promise<{
  driverMap: Map<string, DriverInfo>;
  vehicleMap: Map<string, VehicleInfo>;
}> {
  const driverIds = [...new Set(entries.map((entry) => entry.driverId))];
  const vehicleIds = [...new Set(entries.map((entry) => entry.vehicleId))];

  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, name: true, employeeId: true, phone: true }
    }),
    prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, vehicleNumber: true }
    })
  ]);

  return {
    driverMap: new Map(drivers.map((driver) => [driver.id, driver])),
    vehicleMap: new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  };
}

function assertDriverOwnsEntry(
  requester: DbUser,
  entry: FuelEntryRecord
): void {
  if (requester.role !== 'DRIVER') return;

  const ownDriverId = requester.driverId;

  if (!ownDriverId || ownDriverId !== entry.driverId) {
    throw ApiError.forbidden(
      'You can only view your own fuel entries.'
    );
  }
}

export async function listFuelEntries(
  requester: DbUser,
  query: Record<string, string | undefined>
) {
  const { page, limit, skip } = parsePagination(query, 20, 100);
  const where = buildFuelFilter(query);

  if (requester.role === 'DRIVER') {
    if (!requester.driverId) {
      return {
        entries: [] as FuelEntryDTO[],
        pagination: buildPaginationMeta(page, limit, 0)
      };
    }

    where.driverId = requester.driverId;
  }

  const [entries, total] = await Promise.all([
    prisma.fuelEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit
    }),
    prisma.fuelEntry.count({ where })
  ]);

  const { driverMap, vehicleMap } = await fetchDriverAndVehicleMaps(entries);

  const dtos = entries.map((entry) =>
    toFuelEntryDTO(
      entry,
      driverMap.get(entry.driverId) ?? null,
      vehicleMap.get(entry.vehicleId) ?? null
    )
  );

  return {
    entries: dtos,
    pagination: buildPaginationMeta(page, limit, total)
  };
}

export async function getFuelEntryById(
  requester: DbUser,
  id: string
): Promise<FuelEntryDetailDTO> {
  assertUuid(id, 'fuel entry id');

  const entry = await prisma.fuelEntry.findUnique({ where: { id } });

  if (!entry) {
    throw ApiError.notFound('Fuel entry not found.');
  }

  assertDriverOwnsEntry(requester, entry);

  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUnique({
      where: { id: entry.driverId },
      select: { id: true, name: true, employeeId: true, phone: true }
    }),
    prisma.vehicle.findUnique({
      where: { id: entry.vehicleId },
      select: { id: true, vehicleNumber: true }
    })
  ]);

  return toFuelEntryDetailDTO(entry, driver, vehicle);
}

export async function createFuelEntry(
  requester: DbUser,
  input: CreateFuelEntryInput
): Promise<FuelEntryDTO> {
  let driverId: string;

  if (requester.role === 'DRIVER') {
    if (!requester.driverId) {
      throw ApiError.forbidden(
        'Your user account is not linked to a driver profile. Please contact the administrator.'
      );
    }

    driverId = requester.driverId;
  } else {
    if (!input.driverId) {
      throw ApiError.badRequest(
        'driverId is required when an admin creates a fuel entry.'
      );
    }

    driverId = assertUuid(input.driverId, 'driverId');
  }

  const driver = await prisma.driver.findUnique({
    where: { id: driverId }
  });

  if (!driver) {
    throw ApiError.badRequest('Driver not found.');
  }

  if (!driver.isActive) {
    throw ApiError.badRequest('This driver is inactive.');
  }

  let vehicleId: string | null = null;

  if (input.vehicleId) {
    vehicleId = assertUuid(input.vehicleId, 'vehicleId');
  } else {
    vehicleId = driver.assignedVehicleId ?? null;
  }

  if (!vehicleId) {
    throw ApiError.badRequest(
      'No vehicle is assigned to this driver. Assign a vehicle first, or provide vehicleId.'
    );
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId }
  });

  if (!vehicle) {
    throw ApiError.badRequest('Vehicle not found.');
  }

  const totalAmount =
    input.totalAmount !== undefined
      ? input.totalAmount
      : round2(input.liters * input.pricePerLiter);

  const entry = await prisma.fuelEntry.create({
    data: {
      driverId,
      vehicleId,
      date: parseEntryDate(input.date),
      time: input.time ?? '',
      petrolPumpName: input.petrolPumpName.trim(),
      vehicleNumber:
        input.vehicleNumber && input.vehicleNumber.trim() !== ''
          ? input.vehicleNumber.trim().toUpperCase()
          : vehicle.vehicleNumber,
      fuelType: toDbFuelType(input.fuelType),
      liters: input.liters,
      pricePerLiter: input.pricePerLiter,
      totalAmount,
      receiptNumber: input.receiptNumber.trim(),
      slipImageUrl: input.slipImageUrl ?? '',
      originalFileName: input.originalFileName ?? '',
      ocrRawText: input.ocrRawText ?? '',
      ocrConfidence: input.ocrConfidence ?? null,
      status: 'VERIFIED'
    }
  });

  return toFuelEntryDTO(entry, driver, vehicle);
}

export async function updateFuelEntry(
  id: string,
  input: UpdateFuelEntryInput
): Promise<FuelEntryDTO> {
  assertUuid(id, 'fuel entry id');

  const entry = await prisma.fuelEntry.findUnique({
    where: { id }
  });

  if (!entry) {
    throw ApiError.notFound('Fuel entry not found.');
  }

  if (input.driverId !== undefined) {
    const driver = await prisma.driver.findUnique({
      where: { id: assertUuid(input.driverId, 'driverId') }
    });

    if (!driver) {
      throw ApiError.badRequest('Driver not found.');
    }
  }

  if (input.vehicleId !== undefined) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: assertUuid(input.vehicleId, 'vehicleId') }
    });

    if (!vehicle) {
      throw ApiError.badRequest('Vehicle not found.');
    }
  }

  const totalAmount =
    input.totalAmount !== undefined
      ? input.totalAmount
      : input.liters !== undefined || input.pricePerLiter !== undefined
        ? round2(
            (input.liters !== undefined ? input.liters : entry.liters) *
              (input.pricePerLiter !== undefined
                ? input.pricePerLiter
                : entry.pricePerLiter)
          )
        : undefined;

  const updated = await prisma.fuelEntry.update({
    where: { id },
    data: {
      driverId:
        input.driverId !== undefined ? input.driverId : undefined,
      vehicleId:
        input.vehicleId !== undefined ? input.vehicleId : undefined,
      date:
        input.date !== undefined ? parseEntryDate(input.date) : undefined,
      time: input.time,
      petrolPumpName:
        input.petrolPumpName !== undefined
          ? input.petrolPumpName.trim()
          : undefined,
      vehicleNumber:
        input.vehicleNumber !== undefined
          ? input.vehicleNumber.trim().toUpperCase()
          : undefined,
      fuelType:
        input.fuelType !== undefined
          ? toDbFuelType(input.fuelType)
          : undefined,
      liters: input.liters,
      pricePerLiter: input.pricePerLiter,
      totalAmount,
      receiptNumber:
        input.receiptNumber !== undefined
          ? input.receiptNumber.trim()
          : undefined,
      status:
        input.status !== undefined
          ? toDbStatus(input.status)
          : undefined,
      slipImageUrl: input.slipImageUrl,
      originalFileName: input.originalFileName,
      ocrRawText: input.ocrRawText,
      ocrConfidence:
        input.ocrConfidence !== undefined
          ? input.ocrConfidence ?? null
          : undefined
    }
  });

  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUnique({
      where: { id: updated.driverId },
      select: { id: true, name: true, employeeId: true, phone: true }
    }),
    prisma.vehicle.findUnique({
      where: { id: updated.vehicleId },
      select: { id: true, vehicleNumber: true }
    })
  ]);

  return toFuelEntryDTO(updated, driver, vehicle);
}

export async function deleteFuelEntry(id: string): Promise<void> {
  assertUuid(id, 'fuel entry id');

  const entry = await prisma.fuelEntry.findUnique({
    where: { id }
  });

  if (!entry) {
    throw ApiError.notFound('Fuel entry not found.');
  }

  await prisma.fuelEntry.delete({ where: { id } });

  if (entry.slipImageUrl) {
    // Best effort: an orphaned file is harmless, a lost proof image is not.
    await storageService.deleteSlipFile(entry.slipImageUrl).catch(() => undefined);
  }
}