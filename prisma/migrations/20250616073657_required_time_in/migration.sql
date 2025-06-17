/*
  Warnings:

  - Made the column `timeIn` on table `timelogs` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `timelogs` MODIFY `timeIn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
