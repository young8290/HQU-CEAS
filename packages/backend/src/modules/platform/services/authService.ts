import prisma from '../../../core/db.js';
import { hashPassword, comparePassword } from '../../../core/utils/password.js';
import { generateToken, TokenPayload } from '../../../core/utils/token.js';

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { class: { include: { grade: true } } },
  });

  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new Error('用户名或密码错误');
  }

  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    classId: user.classId,
  };

  const token = generateToken(payload);

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      classId: user.classId,
      className: user.class?.name || null,
      gradeId: user.class?.gradeId || null,
      gradeName: user.class?.grade?.name || null,
    },
  };
}

export async function changePassword(userId: number, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('用户不存在');

  const valid = await comparePassword(oldPassword, user.passwordHash);
  if (!valid) throw new Error('原密码错误');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return { message: '密码修改成功' };
}

export async function getCurrentUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { class: { include: { grade: true } } },
  });

  if (!user) throw new Error('用户不存在');

  const activeInvite = user.role === 'reviewer'
    ? await prisma.scoreReviewMemberInvite.findFirst({
      where: { reviewerUserId: user.id, status: 'active' },
      include: { member: true },
      orderBy: { createdAt: 'desc' },
    })
    : null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    classId: user.classId,
    className: user.class?.name || null,
    gradeId: user.class?.gradeId || null,
    gradeName: user.class?.grade?.name || null,
    reviewInviteId: activeInvite?.id,
    reviewMemberId: activeInvite?.memberId,
    reviewMemberName: activeInvite?.member?.name,
  };
}
