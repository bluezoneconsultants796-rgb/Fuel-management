-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ACCOUNTANT', 'DRIVER');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL');

-- CreateEnum
CREATE TYPE "FuelEntryStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" VARCHAR(20) NOT NULL DEFAULT '',
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "driver_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" TEXT NOT NULL,
    "employee_id" VARCHAR(30) NOT NULL,
    "assigned_vehicle_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "vehicle_number" VARCHAR(20) NOT NULL,
    "vehicle_type" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "assigned_driver_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_entries" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" VARCHAR(8) NOT NULL DEFAULT '',
    "petrol_pump_name" VARCHAR(150) NOT NULL,
    "vehicle_number" VARCHAR(20) NOT NULL,
    "fuel_type" "FuelType" NOT NULL,
    "liters" DOUBLE PRECISION NOT NULL,
    "price_per_liter" DOUBLE PRECISION NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "receipt_number" VARCHAR(50) NOT NULL,
    "slip_image_url" VARCHAR(500) NOT NULL DEFAULT '',
    "original_file_name" VARCHAR(255) NOT NULL DEFAULT '',
    "ocr_raw_text" TEXT NOT NULL DEFAULT '',
    "ocr_confidence" DOUBLE PRECISION,
    "status" "FuelEntryStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fuel_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_driver_id_key" ON "users"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_employee_id_key" ON "drivers"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vehicle_number_key" ON "vehicles"("vehicle_number");

-- CreateIndex
CREATE INDEX "fuel_entries_driver_id_idx" ON "fuel_entries"("driver_id");

-- CreateIndex
CREATE INDEX "fuel_entries_vehicle_id_idx" ON "fuel_entries"("vehicle_id");

-- CreateIndex
CREATE INDEX "fuel_entries_date_idx" ON "fuel_entries"("date");

-- CreateIndex
CREATE INDEX "fuel_entries_receipt_number_idx" ON "fuel_entries"("receipt_number");

-- CreateIndex
CREATE INDEX "fuel_entries_status_idx" ON "fuel_entries"("status");

-- CreateIndex
CREATE INDEX "fuel_entries_date_created_at_idx" ON "fuel_entries"("date", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_assigned_vehicle_id_fkey" FOREIGN KEY ("assigned_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assigned_driver_id_fkey" FOREIGN KEY ("assigned_driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;