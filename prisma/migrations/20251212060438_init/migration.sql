-- CreateTable
CREATE TABLE "Organization" (
    "OrgId" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "Address" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("OrgId")
);

-- CreateTable
CREATE TABLE "Users" (
    "UserId" SERIAL NOT NULL,
    "OrgId" INTEGER,
    "Role" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "ProfileImage" TEXT,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("UserId")
);

-- CreateTable
CREATE TABLE "PendingAdmin" (
    "PendingId" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Phone" TEXT NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "OTP" TEXT NOT NULL,
    "OTPExpiresAt" TIMESTAMP(3) NOT NULL,
    "RequestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PendingAdmin_pkey" PRIMARY KEY ("PendingId")
);

-- CreateTable
CREATE TABLE "Credentials" (
    "CredentialId" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "PasswordHash" TEXT NOT NULL,
    "PasswordGeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "MustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "EmailSentAt" TIMESTAMP(3),

    CONSTRAINT "Credentials_pkey" PRIMARY KEY ("CredentialId")
);

-- CreateTable
CREATE TABLE "Notification" (
    "NotificationId" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Type" TEXT NOT NULL,
    "Message" TEXT NOT NULL,
    "TripId" INTEGER,
    "Read" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("NotificationId")
);

-- CreateTable
CREATE TABLE "Bus" (
    "BusId" SERIAL NOT NULL,
    "OrgId" INTEGER NOT NULL,
    "BusNumber" TEXT NOT NULL,
    "Model" TEXT NOT NULL,

    CONSTRAINT "Bus_pkey" PRIMARY KEY ("BusId")
);

-- CreateTable
CREATE TABLE "Route" (
    "RouteId" SERIAL NOT NULL,
    "OrgId" INTEGER NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "ScheduleDays" TEXT NOT NULL,
    "StartTime" TEXT NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("RouteId")
);

-- CreateTable
CREATE TABLE "RouteDriverAssignment" (
    "AssignmentId" SERIAL NOT NULL,
    "RouteId" INTEGER NOT NULL,
    "DriverId" INTEGER NOT NULL,
    "AssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "RouteDriverAssignment_pkey" PRIMARY KEY ("AssignmentId")
);

-- CreateTable
CREATE TABLE "RouteBusAssignment" (
    "AssignmentId" SERIAL NOT NULL,
    "RouteId" INTEGER NOT NULL,
    "BusId" INTEGER NOT NULL,
    "AssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "Status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "RouteBusAssignment_pkey" PRIMARY KEY ("AssignmentId")
);

-- CreateTable
CREATE TABLE "Trip" (
    "TripId" SERIAL NOT NULL,
    "RouteId" INTEGER NOT NULL,
    "BusId" INTEGER NOT NULL,
    "DriverId" INTEGER NOT NULL,
    "StartTime" TIMESTAMP(3) NOT NULL,
    "EndTime" TIMESTAMP(3),
    "Status" TEXT NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("TripId")
);

-- CreateTable
CREATE TABLE "Location" (
    "LocationId" SERIAL NOT NULL,
    "TripId" INTEGER NOT NULL,
    "Latitude" DOUBLE PRECISION NOT NULL,
    "Longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("LocationId")
);

-- CreateTable
CREATE TABLE "Bill" (
    "BillId" SERIAL NOT NULL,
    "OrgId" INTEGER NOT NULL,
    "StudentId" INTEGER NOT NULL,
    "ParentId" INTEGER NOT NULL,
    "Amount" DOUBLE PRECISION NOT NULL,
    "PeriodStart" TIMESTAMP(3) NOT NULL,
    "PeriodEnd" TIMESTAMP(3) NOT NULL,
    "GeneratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "DueDate" TIMESTAMP(3) NOT NULL,
    "Status" TEXT NOT NULL,
    "RouteId" INTEGER,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("BillId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "PaymentId" SERIAL NOT NULL,
    "BillId" INTEGER NOT NULL,
    "ParentId" INTEGER NOT NULL,
    "Amount" DOUBLE PRECISION NOT NULL,
    "Provider" TEXT NOT NULL,
    "Status" TEXT NOT NULL,
    "PaidAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("PaymentId")
);

-- CreateTable
CREATE TABLE "UserCreationAudit" (
    "AuditId" SERIAL NOT NULL,
    "CreatedUserId" INTEGER NOT NULL,
    "AdminUserId" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "EmailSentAt" TIMESTAMP(3),
    "DeliveryStatus" TEXT NOT NULL DEFAULT 'sent',

    CONSTRAINT "UserCreationAudit_pkey" PRIMARY KEY ("AuditId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_Email_key" ON "Organization"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Users_Email_key" ON "Users"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "PendingAdmin_Email_key" ON "PendingAdmin"("Email");

-- CreateIndex
CREATE UNIQUE INDEX "Credentials_UserId_key" ON "Credentials"("UserId");

-- AddForeignKey
ALTER TABLE "Users" ADD CONSTRAINT "Users_OrgId_fkey" FOREIGN KEY ("OrgId") REFERENCES "Organization"("OrgId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credentials" ADD CONSTRAINT "Credentials_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_TripId_fkey" FOREIGN KEY ("TripId") REFERENCES "Trip"("TripId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bus" ADD CONSTRAINT "Bus_OrgId_fkey" FOREIGN KEY ("OrgId") REFERENCES "Organization"("OrgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_OrgId_fkey" FOREIGN KEY ("OrgId") REFERENCES "Organization"("OrgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteDriverAssignment" ADD CONSTRAINT "RouteDriverAssignment_RouteId_fkey" FOREIGN KEY ("RouteId") REFERENCES "Route"("RouteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteDriverAssignment" ADD CONSTRAINT "RouteDriverAssignment_DriverId_fkey" FOREIGN KEY ("DriverId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteBusAssignment" ADD CONSTRAINT "RouteBusAssignment_RouteId_fkey" FOREIGN KEY ("RouteId") REFERENCES "Route"("RouteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteBusAssignment" ADD CONSTRAINT "RouteBusAssignment_BusId_fkey" FOREIGN KEY ("BusId") REFERENCES "Bus"("BusId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_RouteId_fkey" FOREIGN KEY ("RouteId") REFERENCES "Route"("RouteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_BusId_fkey" FOREIGN KEY ("BusId") REFERENCES "Bus"("BusId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_DriverId_fkey" FOREIGN KEY ("DriverId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_TripId_fkey" FOREIGN KEY ("TripId") REFERENCES "Trip"("TripId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_RouteId_fkey" FOREIGN KEY ("RouteId") REFERENCES "Route"("RouteId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_OrgId_fkey" FOREIGN KEY ("OrgId") REFERENCES "Organization"("OrgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_StudentId_fkey" FOREIGN KEY ("StudentId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_BillId_fkey" FOREIGN KEY ("BillId") REFERENCES "Bill"("BillId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ParentId_fkey" FOREIGN KEY ("ParentId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreationAudit" ADD CONSTRAINT "UserCreationAudit_CreatedUserId_fkey" FOREIGN KEY ("CreatedUserId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCreationAudit" ADD CONSTRAINT "UserCreationAudit_AdminUserId_fkey" FOREIGN KEY ("AdminUserId") REFERENCES "Users"("UserId") ON DELETE RESTRICT ON UPDATE CASCADE;
