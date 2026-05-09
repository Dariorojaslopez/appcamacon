const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const defaultEmail = process.env.ADMIN_EMAIL || 'admin@camacon.local';
  const defaultIdentification = process.env.ADMIN_IDENTIFICATION || '900452410';
  const defaultPassword = process.env.ADMIN_PASSWORD || '900452410';
  const defaultName = process.env.ADMIN_NAME || 'Administrador';

  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // Buscar cualquier usuario que coincida por email o identificación
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: defaultEmail },
        { identification: defaultIdentification },
      ],
    },
  });

  const upsertWhere = existing ? { id: existing.id } : { email: defaultEmail };

  await prisma.user.upsert({
    where: upsertWhere,
    update: {
      identification: defaultIdentification,
      email: defaultEmail,
      name: defaultName,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      identification: defaultIdentification,
      email: defaultEmail,
      name: defaultName,
      password: passwordHash,
      role: 'SUPER_ADMIN',
    },
  });

  const MENU_KEYS = [
    'home',
    'datos',
    'jornada',
    'personal',
    'equipos',
    'actividades',
    'calidad',
    'evidencias',
    'tabulacion',
    'settings',
    'users',
  ];

  for (const menuKey of MENU_KEYS) {
    await prisma.roleMenuPermission.upsert({
      where: { role_menuKey: { role: 'SUPER_ADMIN', menuKey } },
      update: {},
      create: { role: 'SUPER_ADMIN', menuKey },
    });
  }

  const ROLE_LABELS = [
    { role: 'SUPER_ADMIN', label: 'Super administrador' },
    { role: 'INSPECTOR_TECNICO', label: 'Inspector técnico' },
    { role: 'INSPECTOR_SSTMA', label: 'Inspector SSTMA' },
    { role: 'RESIDENTE_TECNICO', label: 'Residente técnico' },
    { role: 'COSTOS', label: 'Costos' },
    { role: 'DIRECTOR', label: 'Director' },
  ];
  for (const { role, label } of ROLE_LABELS) {
    await prisma.roleLabel.upsert({
      where: { role },
      update: { label },
      create: { role, label },
    });
  }

  if (!(await prisma.jornadaCatalog.findFirst({ where: { nombre: 'Diurna' } }))) {
    await prisma.jornadaCatalog.create({
      data: {
        nombre: 'Diurna',
        horaInicio: '06:00',
        horaFin: '18:00',
        orden: 0,
        isActive: true,
      },
    });
  }
  if (!(await prisma.jornadaCatalog.findFirst({ where: { nombre: 'Nocturna' } }))) {
    await prisma.jornadaCatalog.create({
      data: {
        nombre: 'Nocturna',
        horaInicio: '18:00',
        horaFin: '06:00',
        orden: 1,
        isActive: true,
      },
    });
  }

  const diurnaRow = await prisma.jornadaCatalog.findFirst({ where: { nombre: 'Diurna' } });
  if (diurnaRow) {
    await prisma.$executeRawUnsafe(
      `UPDATE "InformeDiario" SET "jornadaCatalogoId" = '${diurnaRow.id}' WHERE "jornadaCatalogoId" IS NULL`,
    );
  }

  console.log('Usuario admin, permisos SUPER_ADMIN, jornadas por defecto y etiquetas de roles asegurados.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

