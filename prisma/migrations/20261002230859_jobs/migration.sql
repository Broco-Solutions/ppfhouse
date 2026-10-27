-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "serviceCaseId" UUID NOT NULL,
    "originAppointmentId" UUID,
    "performedAt" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_services" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "serviceId" UUID,
    "nameSnapshot" TEXT NOT NULL,
    "descriptionSnapshot" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_employees" (
    "jobId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "job_employees_pkey" PRIMARY KEY ("jobId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_originAppointmentId_key" ON "jobs"("originAppointmentId");

-- CreateIndex
CREATE INDEX "jobs_performedAt_idx" ON "jobs"("performedAt");

-- CreateIndex
CREATE INDEX "jobs_serviceCaseId_performedAt_idx" ON "jobs"("serviceCaseId", "performedAt");

-- CreateIndex
CREATE INDEX "jobs_voidedAt_idx" ON "jobs"("voidedAt");

-- CreateIndex
CREATE INDEX "job_services_jobId_sortOrder_idx" ON "job_services"("jobId", "sortOrder");

-- CreateIndex
CREATE INDEX "job_services_serviceId_idx" ON "job_services"("serviceId");

-- CreateIndex
CREATE INDEX "job_employees_userId_idx" ON "job_employees"("userId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_serviceCaseId_fkey" FOREIGN KEY ("serviceCaseId") REFERENCES "service_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_originAppointmentId_fkey" FOREIGN KEY ("originAppointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_services" ADD CONSTRAINT "job_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_employees" ADD CONSTRAINT "job_employees_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_employees" ADD CONSTRAINT "job_employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
