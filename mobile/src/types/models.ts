/** Mirrors the backend JSON DTOs exactly. */

export type UserRole = 'admin' | 'accountant' | 'driver';
export type FuelType = 'Petrol' | 'Diesel';
export type EntryStatus = 'pending' | 'verified' | 'rejected';

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

export interface DriverProfileInfo {
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

export interface FuelEntry {
  id: string;
  driverId: string;
  vehicleId: string;
  driver: { id: string; name: string; employeeId: string } | null;
  vehicle: { id: string; vehicleNumber: string } | null;
  date: string;            // YYYY-MM-DD
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
  status: EntryStatus;
  ocrConfidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelEntryDetail extends FuelEntry {
  ocrRawText: string;
  driverPhone: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SlipFields {
  date: string | null;
  time: string | null;
  petrolPumpName: string | null;
  vehicleNumber: string | null;
  fuelType: FuelType | null;
  liters: number | null;
  pricePerLiter: number | null;
  totalAmount: number | null;
  receiptNumber: string | null;
}

/** Response of POST /api/ocr/process — data envelope. */
export interface OcrProcessResponse {
  filePath: string;
  fileUrl: string;
  originalFileName: string;
  mimeType: string;
  size: number;
  ocr: {
    fields: SlipFields;
    rawText: string;
    confidence: number | null;
    provider: string;
    warnings: string[];
  };
}

// ─── Dashboard DTOs (Phase 3) ───────────────────────────────────────────────

export interface FuelTypeSplit {
  fuelType: FuelType;
  liters: number;
  amount: number;
  entries: number;
}

export interface DashboardSummary {
  month: string;
  totalLiters: number;
  totalAmount: number;
  entryCount: number;
  averageAmountPerEntry: number;
  activeDrivers: number;
  activeVehicles: number;
  byFuelType: FuelTypeSplit[];
  previousMonth: {
    month: string;
    totalLiters: number;
    totalAmount: number;
    entryCount: number;
  };
}

export interface MonthlyTrendPoint {
  month: string; // YYYY-MM
  liters: number;
  amount: number;
  entries: number;
}

export interface DailyUsagePoint {
  date: string; // YYYY-MM-DD
  day: number;
  liters: number;
  amount: number;
  entries: number;
}

export interface VehicleExpenseItem {
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: string;
  isActive: boolean;
  liters: number;
  amount: number;
  entries: number;
}

export interface DriverExpenseItem {
  driverId: string;
  driverName: string;
  employeeId: string;
  isActive: boolean;
  liters: number;
  amount: number;
  entries: number;
}

// ─── Fleet management DTOs (Phase 3) ────────────────────────────────────────

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
/* ── Monthly report (GET /api/reports/monthly) ───────────────────────────── */

export interface ReportEntryRow {
  id: string;
  date: string;
  time: string;
  driverName: string;
  vehicleNumber: string;
  petrolPumpName: string;
  fuelType: FuelType;
  liters: number;
  pricePerLiter: number;
  totalAmount: number;
  receiptNumber: string;
}

export interface ReportGroupRow {
  id: string;
  label: string;
  sublabel: string;
  entries: number;
  liters: number;
  amount: number;
  sharePercent: number;
}

export interface ReportFuelTypeRow {
  fuelType: FuelType;
  entries: number;
  liters: number;
  amount: number;
  sharePercent: number;
}

export interface MonthlyReport {
  month: string;
  monthLabel: string;
  generatedAt: string;
  generatedAtLabel: string;
  filters: {
    driverId: string | null;
    driverName: string | null;
    vehicleId: string | null;
    vehicleNumber: string | null;
    fuelType: FuelType | null;
  };
  totals: {
    entries: number;
    liters: number;
    amount: number;
    averageAmountPerEntry: number;
  };
  byFuelType: ReportFuelTypeRow[];
  byDriver: ReportGroupRow[];
  byVehicle: ReportGroupRow[];
  entries: ReportEntryRow[];
}
