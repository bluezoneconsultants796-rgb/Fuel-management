import { apiRequest } from './api';
import { DriverDTO } from '../types/models';

export interface DriverPayload {
  name: string;
  phone: string;
  employeeId: string;
  assignedVehicleId?: string | null;
  isActive?: boolean;
}

export interface DriverListParams {
  search?: string;
  isActive?: boolean;
  assignedVehicleId?: string;
  limit?: number;
}

export async function listDrivers(params: DriverListParams = {}): Promise<DriverDTO[]> {
  const qs = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  const envelope = await apiRequest<DriverDTO[]>(`/drivers${qs ? `?${qs}` : ''}`);
  return envelope.data ?? [];
}

export async function getDriver(id: string): Promise<DriverDTO> {
  const envelope = await apiRequest<DriverDTO>(`/drivers/${id}`);
  return envelope.data;
}

export async function createDriver(payload: DriverPayload): Promise<DriverDTO> {
  const envelope = await apiRequest<DriverDTO>('/drivers', { method: 'POST', body: payload });
  return envelope.data;
}

export async function updateDriver(id: string, payload: Partial<DriverPayload>): Promise<DriverDTO> {
  const envelope = await apiRequest<DriverDTO>(`/drivers/${id}`, { method: 'PUT', body: payload });
  return envelope.data;
}

export async function deleteDriver(id: string): Promise<void> {
  await apiRequest<unknown>(`/drivers/${id}`, { method: 'DELETE' });
}
