import prisma from '../config/database.js';
import ExcelJS from 'exceljs';

interface StudentWithClassAndGrade {
  id: number;
  studentNo: string;
  name: string;
  classId: number;
  class: {
    name: string;
    gradeId: number;
    grade: {
      name: string;
    };
  };
}

export async function listStudents(filters: {
  classId?: number;
  gradeId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const where: any = {};
  
  if (filters.classId) {
    where.classId = filters.classId;
  } else if (filters.gradeId) {
    where.class = { gradeId: filters.gradeId };
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { studentNo: { contains: filters.search } },
    ];
  }

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  const [students, total]: [StudentWithClassAndGrade[], number] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { include: { grade: true } },
      },
      orderBy: [{ studentNo: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }) as Promise<StudentWithClassAndGrade[]>,
    prisma.student.count({ where }),
  ]);

  return {
    students: students.map((student: StudentWithClassAndGrade) => ({
      id: student.id,
      studentNo: student.studentNo,
      name: student.name,
      classId: student.classId,
      className: student.class.name,
      gradeId: student.class.gradeId,
      gradeName: student.class.grade.name,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getStudent(id: number) {
  const student = await prisma.student.findUnique({
    where: { id },
    include: { class: { include: { grade: true } } },
  });
  if (!student) throw new Error('学生不存在');
  return student;
}

export async function addStudent(data: { studentNo: string; name: string; classId: number }) {
  return prisma.student.create({
    data: {
      studentNo: data.studentNo,
      name: data.name,
      classId: data.classId,
    },
  });
}

export async function updateStudent(id: number, data: { studentNo?: string; name?: string; classId?: number }) {
  return prisma.student.update({
    where: { id },
    data,
  });
}

export async function deleteStudent(id: number) {
  return prisma.student.delete({ where: { id } });
}

export async function deleteStudentsByGrade(gradeId: number) {
  // Delete all students in classes that belong to this grade
  const classes: Array<{ id: number }> = await prisma.class.findMany({
    where: { gradeId },
    select: { id: true },
  });
  const classIds = classes.map((classItem: { id: number }) => classItem.id);
  
  const result = await prisma.student.deleteMany({
    where: { classId: { in: classIds } },
  });

  return { deletedCount: result.count };
}

export async function deleteStudentsByClass(classId: number) {
  const result = await prisma.student.deleteMany({
    where: { classId },
  });
  return { deletedCount: result.count };
}

export async function batchAddStudents(buffer: Buffer, targetClassId?: number) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件中没有工作表');

  const results = { added: 0, skipped: 0, success: 0, failed: 0, failures: [] as any[] };

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);

    // Detect column layout: if targetClassId is provided, use A:学号 B:姓名
    // Otherwise, use student_data format: A:年级 B:班级 C:学号 D:姓名
    let studentNo: string;
    let name: string;
    let gradeName: string | undefined;
    let className: string | undefined;

    if (targetClassId) {
      // Simple format: A=学号, B=姓名
      studentNo = row.getCell(1).text?.trim() || '';
      name = row.getCell(2).text?.trim() || '';
    } else {
      // Full format: A=年级, B=班级, C=学号, D=姓名
      gradeName = row.getCell(1).text?.trim() || '';
      className = row.getCell(2).text?.trim() || '';
      studentNo = row.getCell(3).text?.trim() || '';
      name = row.getCell(4).text?.trim() || '';
    }

    if (!studentNo || !name) {
      if (studentNo || name) {
        results.failed++;
        results.failures.push({ row: rowNum, studentNo, name, reason: '缺少必填字段' });
      }
      continue;
    }

    let classId = targetClassId;
    try {
      // If no target classId, read grade/class from columns A & B
      if (!classId) {
        if (!gradeName || !className) {
          results.failed++;
          results.failures.push({ row: rowNum, studentNo, name, reason: '缺少年级/班级信息' });
          continue;
        }
        let grade = await prisma.grade.findUnique({ where: { name: gradeName } });
        if (!grade) grade = await prisma.grade.create({ data: { name: gradeName } });
        let cls = await prisma.class.findFirst({ where: { gradeId: grade.id, name: className } });
        if (!cls) cls = await prisma.class.create({ data: { gradeId: grade.id, name: className } });
        classId = cls.id;
      }

      // Check existing
      const existing = await prisma.student.findUnique({ where: { studentNo } });
      if (existing) {
        results.skipped++;
        continue;
      }

      // Create student
      await prisma.student.create({
        data: { studentNo, name, classId },
      });

      results.success++;
      results.added++;
    } catch (err: any) {
      results.failed++;
      results.failures.push({ row: rowNum, studentNo, name, reason: err.message });
    }
  }

  return results;
}

export async function getStudentTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('学生名册模板');
  
  sheet.columns = [
    { header: '年级', key: 'grade', width: 15 },
    { header: '班级', key: 'class', width: 25 },
    { header: '学号', key: 'studentNo', width: 20 },
    { header: '姓名', key: 'name', width: 15 },
  ];

  // Add example rows
  sheet.addRow({ grade: '2023级', class: '计算机科学与技术1班', studentNo: '2325111001', name: '张三' });
  sheet.addRow({ grade: '2023级', class: '计算机科学与技术1班', studentNo: '2325111002', name: '李四' });

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
