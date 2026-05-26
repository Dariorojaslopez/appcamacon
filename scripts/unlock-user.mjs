/**
 * Reactiva un usuario y opcionalmente restablece su contraseña.
 *
 * Uso (en el servidor o local con DATABASE_URL en .env):
 *   node scripts/unlock-user.mjs 900452410
 *   node scripts/unlock-user.mjs 900452410 --password=MiClaveSegura
 *
 * Variables opcionales: ADMIN_PASSWORD (si no pasa --password=).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

async function main() {
  const identification = process.argv[2]?.trim();
  if (!identification || identification.startsWith('--')) {
    console.error('Uso: node scripts/unlock-user.mjs <identificacion> [--password=...]');
    process.exit(1);
  }

  const newPassword = argValue('--password') || process.env.ADMIN_PASSWORD;
  const user = await prisma.user.findFirst({ where: { identification } });
  if (!user) {
    console.error(`No existe usuario con identificación ${identification}`);
    process.exit(1);
  }

  const data = { isActive: true };
  if (newPassword) {
    data.password = await bcrypt.hash(newPassword, 10);
  }

  await prisma.user.update({ where: { id: user.id }, data });

  console.log(`Usuario desbloqueado: ${user.name} (${user.email})`);
  console.log(`  Rol: ${user.role}`);
  console.log(`  isActive: true`);
  if (newPassword) {
    console.log(`  Contraseña restablecida (la indicada en --password o ADMIN_PASSWORD).`);
  } else {
    console.log('  Contraseña no modificada (use --password=... si necesita una nueva).');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
