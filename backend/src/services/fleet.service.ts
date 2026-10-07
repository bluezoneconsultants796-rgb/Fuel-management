import { prisma } from '../config/db';
import { ApiError } from '../utils/ApiError';

/**
 * Driver ↔ vehicle assignment (strictly 1 driver ↔ 1 vehicle).
 *
 * Both sides of the relationship (drivers.assigned_vehicle_id and
 * vehicles.assigned_driver_id) are changed inside ONE transaction, so a
 * failure half-way can never leave the two tables disagreeing.
 */

/** Assigns (or unassigns, when vehicleId is null) a vehicle to a driver. */
export async function assignVehicleToDriver(
  driverId: string,
  vehicleId: string | null
): Promise<void> {
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw ApiError.badRequest('Assigned vehicle not found.');
    if (!vehicle.isActive) throw ApiError.badRequest('The selected vehicle is inactive.');
  }

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw ApiError.badRequest('Driver not found.');

  await prisma.$transaction(async (tx) => {
    // Release whatever this driver currently holds
    await tx.vehicle.updateMany({
      where: { assignedDriverId: driverId, ...(vehicleId ? { id: { not: vehicleId } } : {}) },
      data: { assignedDriverId: null }
    });

    if (vehicleId) {
      // Take the vehicle away from any other driver
      await tx.driver.updateMany({
        where: { assignedVehicleId: vehicleId, id: { not: driverId } },
        data: { assignedVehicleId: null }
      });
      await tx.vehicle.update({ where: { id: vehicleId }, data: { assignedDriverId: driverId } });
    }

    await tx.driver.update({ where: { id: driverId }, data: { assignedVehicleId: vehicleId } });
  });
}

/** Assigns (or unassigns, when driverId is null) a driver to a vehicle. */
export async function assignDriverToVehicle(
  vehicleId: string,
  driverId: string | null
): Promise<void> {
  if (driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw ApiError.badRequest('Assigned driver not found.');
    if (!driver.isActive) throw ApiError.badRequest('The selected driver is inactive.');
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) throw ApiError.badRequest('Vehicle not found.');

  await prisma.$transaction(async (tx) => {
    // Release whoever currently drives this vehicle
    await tx.driver.updateMany({
      where: { assignedVehicleId: vehicleId, ...(driverId ? { id: { not: driverId } } : {}) },
      data: { assignedVehicleId: null }
    });

    if (driverId) {
      // Take the driver away from any other vehicle
      await tx.vehicle.updateMany({
        where: { assignedDriverId: driverId, id: { not: vehicleId } },
        data: { assignedDriverId: null }
      });
      await tx.driver.update({ where: { id: driverId }, data: { assignedVehicleId: vehicleId } });
    }

    await tx.vehicle.update({ where: { id: vehicleId }, data: { assignedDriverId: driverId } });
  });
}
