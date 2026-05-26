import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const identification = process.argv[2]?.trim();
const password = process.argv[3] ?? '';
const prisma = new PrismaClient();

const user = await prisma.user.findFirst({ where: { identification } });
if (!user) {
  console.log('NO_USER');
  process.exit(1);
}
const ok = await bcrypt.compare(password, user.password);
console.log(JSON.stringify({ email: user.email, role: user.role, isActive: user.isActive, passwordMatches: ok }));
await prisma.$disconnect();
