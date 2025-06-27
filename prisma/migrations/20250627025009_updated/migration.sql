-- CreateTable
CREATE TABLE `user` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleName` VARCHAR(191) NULL,
    `plateNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rfidTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `epc` VARCHAR(191) NOT NULL,
    `tagType` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `rfidTag_epc_key`(`epc`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timeLogs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `vehicleId` INTEGER NULL,
    `timeOut` DATETIME(3) NULL,
    `timeIn` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_rfidTagTovehicle` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_rfidTagTovehicle_AB_unique`(`A`, `B`),
    INDEX `_rfidTagTovehicle_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `timeLogs` ADD CONSTRAINT `timeLogs_vehicleId_fkey` FOREIGN KEY (`vehicleId`) REFERENCES `vehicle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_rfidTagTovehicle` ADD CONSTRAINT `_rfidTagTovehicle_A_fkey` FOREIGN KEY (`A`) REFERENCES `rfidTag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_rfidTagTovehicle` ADD CONSTRAINT `_rfidTagTovehicle_B_fkey` FOREIGN KEY (`B`) REFERENCES `vehicle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
