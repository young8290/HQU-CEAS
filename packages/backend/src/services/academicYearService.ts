import prisma from '../config/database.js';

export async function listAcademicYears() {
  return prisma.academicYear.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function createAcademicYear(name: string) {
  return prisma.academicYear.create({ data: { name } });
}

export async function activateAcademicYear(id: number) {
  // Deactivate all
  await prisma.academicYear.updateMany({ data: { isCurrent: false } });
  // Activate the selected one
  return prisma.academicYear.update({
    where: { id },
    data: { isCurrent: true },
  });
}

export async function getCurrentAcademicYear() {
  return prisma.academicYear.findFirst({ where: { isCurrent: true } });
}
