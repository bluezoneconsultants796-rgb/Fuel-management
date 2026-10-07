import { Prisma } from '@prisma/client';
import { prisma } from '../config/db';
import { FuelType, toApiFuelType } from '../types/domain';
import { ApiError } from '../utils/ApiError';
import { round2 } from '../utils/number';

const MONTH_REGEX = /^\d{4}-\d{2}$/;

interface Totals {
  liters: number;
  amount: number;
  entries: number;
}

export interface FuelTypeSplitDTO {
  fuelType: FuelType;
  liters: number;
  amount: number;
  entries: number;
}

export interface SummaryDTO {
  month: string;
  totalLiters: number;
  totalAmount: number;
  entryCount: number;
  averageAmountPerEntry: number;
  activeDrivers: number;
  activeVehicles: number;
  byFuelType: FuelTypeSplitDTO[];
  previousMonth: {
    month: string;
    totalLiters: number;
    totalAmount: number;
    entryCount: number;
  };
}

export interface MonthlyTrendDTO {
  month: string;
  liters: number;
  amount: number;
  entries: number;
}

export interface DailyUsageDTO {
  date: string;
  day: number;
  liters: number;
  amount: number;
  entries: number;
}

export interface VehicleExpenseDTO {
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: string;
  isActive: boolean;
  liters: number;
  amount: number;
  entries: number;
}

export interface DriverExpenseDTO {
  driverId: string;
  driverName: string;
  employeeId: string;
  isActive: boolean;
  liters: number;
  amount: number;
  entries: number;
}

function currentMonthUTC(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeMonth(monthParam?: string): string {
  if (!monthParam || monthParam.trim() === '') return currentMonthUTC();
  const value = monthParam.trim();
  if (!MONTH_REGEX.test(value)) {
    throw ApiError.badRequest('"month" must be in YYYY-MM format (e.g. 2026-06).');
  }
  const monthNumber = Number(value.split('-')[1]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw ApiError.badRequest('Invalid month value.');
  }
  return value;
}

function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999))
  };
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Dashboard aggregations exclude entries with status "rejected" — rejected
 * entries represent bad data the office explicitly refused.
 */
async function totalsFor(where: Prisma.FuelEntryWhereInput): Promise<Totals> {
  const agg = await prisma.fuelEntry.aggregate({
    where,
    _sum: { liters: true, totalAmount: true },
    _count: true
  });
  return {
    liters: round2(agg._sum.liters ?? 0),
    amount: round2(agg._sum.totalAmount ?? 0),
    entries: agg._count
  };
}

export async function getSummary(monthParam?: string): Promise<SummaryDTO> {
  const month = normalizeMonth(monthParam);
  const { start, end } = monthRange(month);
  const previousMonth = shiftMonth(month, -1);
  const prevRange = monthRange(previousMonth);

  const currentMatch: Prisma.FuelEntryWhereInput = {
    AND: [{ date: { gte: start, lte: end } }, { status: { not: 'REJECTED' } }]
  };
  const previousMatch: Prisma.FuelEntryWhereInput = {
    AND: [{ date: { gte: prevRange.start, lte: prevRange.end } }, { status: { not: 'REJECTED' } }]
  };

  const [current, previous, fuelTypeRows, activeDrivers, activeVehicles] = await Promise.all([
    totalsFor(currentMatch),
    totalsFor(previousMatch),
    prisma.fuelEntry.groupBy({
      by: ['fuelType'],
      where: currentMatch,
      _sum: { liters: true, totalAmount: true },
      _count: true
    }),
    prisma.driver.count({ where: { isActive: true } }),
    prisma.vehicle.count({ where: { isActive: true } })
  ]);

  return {
    month,
    totalLiters: current.liters,
    totalAmount: current.amount,
    entryCount: current.entries,
    averageAmountPerEntry: current.entries > 0 ? round2(current.amount / current.entries) : 0,
    activeDrivers,
    activeVehicles,
    byFuelType: fuelTypeRows
      .map((row) => ({
        fuelType: toApiFuelType(row.fuelType),
        liters: round2(row._sum.liters ?? 0),
        amount: round2(row._sum.totalAmount ?? 0),
        entries: row._count
      }))
      .sort((a, b) => b.amount - a.amount),
    previousMonth: {
      month: previousMonth,
      totalLiters: previous.liters,
      totalAmount: previous.amount,
      entryCount: previous.entries
    }
  };
}

export async function getMonthlyTrend(
  monthsParam?: string
): Promise<{ months: number; trend: MonthlyTrendDTO[] }> {
  const requested = monthsParam ? parseInt(monthsParam, 10) : 12;
  const months = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 36) : 12;

  const endMonth = currentMonthUTC();
  const startMonth = shiftMonth(endMonth, -(months - 1));
  const windowStart = monthRange(startMonth).start;

  const rows = await prisma.fuelEntry.findMany({
    where: { date: { gte: windowStart }, status: { not: 'REJECTED' } },
    select: { date: true, liters: true, totalAmount: true }
  });

  const map = new Map<string, Totals>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 7); // YYYY-MM (UTC)
    const bucket = map.get(key) ?? { liters: 0, amount: 0, entries: 0 };
    bucket.liters += row.liters;
    bucket.amount += row.totalAmount;
    bucket.entries += 1;
    map.set(key, bucket);
  }

  // Zero-fill every month in the window so charts always show a full axis.
  const trend: MonthlyTrendDTO[] = [];
  for (let i = 0; i < months; i++) {
    const m = shiftMonth(startMonth, i);
    const t = map.get(m) ?? { liters: 0, amount: 0, entries: 0 };
    trend.push({
      month: m,
      liters: round2(t.liters),
      amount: round2(t.amount),
      entries: t.entries
    });
  }
  return { months, trend };
}

export async function getDailyUsage(
  monthParam?: string
): Promise<{ month: string; maxLiters: number; days: DailyUsageDTO[] }> {
  const month = normalizeMonth(monthParam);
  const { start, end } = monthRange(month);
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const rows = await prisma.fuelEntry.findMany({
    where: { date: { gte: start, lte: end }, status: { not: 'REJECTED' } },
    select: { date: true, liters: true, totalAmount: true }
  });

  const map = new Map<string, { liters: number; amount: number; entries: number }>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const bucket = map.get(key) ?? { liters: 0, amount: 0, entries: 0 };
    bucket.liters += row.liters;
    bucket.amount += row.totalAmount;
    bucket.entries += 1;
    map.set(key, bucket);
  }

  const days: DailyUsageDTO[] = [];
  let maxLiters = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const bucket = map.get(date);
    const liters = round2(bucket?.liters ?? 0);
    maxLiters = Math.max(maxLiters, liters);
    days.push({
      date,
      day,
      liters,
      amount: round2(bucket?.amount ?? 0),
      entries: bucket?.entries ?? 0
    });
  }
  return { month, maxLiters, days };
}

export async function getVehicleExpenses(
  monthParam?: string
): Promise<{ month: string | null; vehicles: VehicleExpenseDTO[] }> {
  const monthValue = monthParam && monthParam.trim() !== '' ? normalizeMonth(monthParam) : null;
  const where: Prisma.FuelEntryWhereInput = { status: { not: 'REJECTED' } };
  if (monthValue) {
    const { start, end } = monthRange(monthValue);
    where.date = { gte: start, lte: end };
  }

  const [rows, vehicles] = await Promise.all([
    prisma.fuelEntry.groupBy({
      by: ['vehicleId'],
      where,
      _sum: { liters: true, totalAmount: true },
      _count: true
    }),
    prisma.vehicle.findMany()
  ]);

  const map = new Map(rows.map((row) => [row.vehicleId, row]));

  // Include every vehicle (even zero-expense) so the office sees the whole fleet.
  const list: VehicleExpenseDTO[] = vehicles
    .map((vehicle) => {
      const row = map.get(vehicle.id);
      return {
        vehicleId: vehicle.id,
        vehicleNumber: vehicle.vehicleNumber,
        vehicleType: vehicle.vehicleType,
        isActive: vehicle.isActive,
        liters: round2(row?._sum.liters ?? 0),
        amount: round2(row?._sum.totalAmount ?? 0),
        entries: row?._count ?? 0
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { month: monthValue, vehicles: list };
}

export async function getDriverExpenses(
  monthParam?: string
): Promise<{ month: string | null; drivers: DriverExpenseDTO[] }> {
  const monthValue = monthParam && monthParam.trim() !== '' ? normalizeMonth(monthParam) : null;
  const where: Prisma.FuelEntryWhereInput = { status: { not: 'REJECTED' } };
  if (monthValue) {
    const { start, end } = monthRange(monthValue);
    where.date = { gte: start, lte: end };
  }

  const [rows, drivers] = await Promise.all([
    prisma.fuelEntry.groupBy({
      by: ['driverId'],
      where,
      _sum: { liters: true, totalAmount: true },
      _count: true
    }),
    prisma.driver.findMany()
  ]);

  const map = new Map(rows.map((row) => [row.driverId, row]));

  const list: DriverExpenseDTO[] = drivers
    .map((driver) => {
      const row = map.get(driver.id);
      return {
        driverId: driver.id,
        driverName: driver.name,
        employeeId: driver.employeeId,
        isActive: driver.isActive,
        liters: round2(row?._sum.liters ?? 0),
        amount: round2(row?._sum.totalAmount ?? 0),
        entries: row?._count ?? 0
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { month: monthValue, drivers: list };
}