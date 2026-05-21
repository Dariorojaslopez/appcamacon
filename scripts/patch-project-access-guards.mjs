/**
 * Añade verificación de acceso por obra en rutas API que usan projectId.
 * Ejecutar: node scripts/patch-project-access-guards.mjs
 */
import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), 'app', 'api');

const IMPORT_LINE =
  "import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../src/lib/requireProjectAccess';";
const IMPORT_LINE_DEEP =
  "import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';";

const FILES = [
  'catalogos/contratistas/route.ts',
  'catalogos/encargados/route.ts',
  'catalogos/cargos/route.ts',
  'catalogos/items/route.ts',
  'catalogos/frentes-obra/route.ts',
  'informes/personal/route.ts',
  'informes/next/route.ts',
  'informes/actividades/route.ts',
  'informes/equipos/route.ts',
  'informes/ensayos/route.ts',
  'informes/danos-redes/route.ts',
  'informes/no-conformidades/route.ts',
  'informes/material-ingresos/route.ts',
  'informes/material-entregas/route.ts',
  'informes/evidencias/route.ts',
  'informes/suspensiones/route.ts',
  'informes/franjas-clima/route.ts',
  'informes/formato-tabulacion/route.ts',
  'informes/route.ts',
  'registro-bitacora/route.ts',
  'registro-bitacora/rango/route.ts',
  'registro-bitacora/pdf/route.ts',
  'registro-bitacora/proyecto/route.ts',
  'bitacora/clima/route.ts',
  'bitacora/eventos/route.ts',
  'bitacora/dashboard/route.ts',
  'bitacora/pdf/route.ts',
];

function depthImport(filePath) {
  const depth = filePath.split('/').length - 1;
  if (depth >= 3) return IMPORT_LINE_DEEP.replace('../../../../', '../'.repeat(depth + 2));
  return IMPORT_LINE;
}

function patchFile(rel) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.log('skip (missing):', rel);
    return;
  }
  let s = fs.readFileSync(fp, 'utf8');
  if (s.includes('requireAccessibleProject')) {
    console.log('skip (already):', rel);
    return;
  }
  if (!s.includes('projectId')) {
    console.log('skip (no projectId):', rel);
    return;
  }

  const imp = depthImport(rel);
  const lastImport = s.lastIndexOf("from '");
  const lineEnd = s.indexOf('\n', lastImport);
  s = s.slice(0, lineEnd + 1) + imp + '\n' + s.slice(lineEnd + 1);

  // After projectId validation block, insert guard
  const patterns = [
    /if \(!projectId \|\| !dateStr\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'projectId y date son requeridos' \}, \{ status: 400 \}\);\s*\n\s*\}/,
    /if \(!projectId \|\| !dateStr\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'projectId y date son requeridos' \}, \{ status: 400 \}\);\s*\n\s*\}\s*\n/,
    /if \(!projectId\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'projectId es requerido' \}, \{ status: 400 \}\);\s*\n\s*\}/,
    /if \(!projectId \|\| !fechaStr\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'projectId y fecha[^']*' \}, \{ status: 400 \}\);\s*\n\s*\}/,
  ];

  const guard = `
    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;
`;

  let inserted = false;
  for (const re of patterns) {
    if (re.test(s)) {
      s = s.replace(re, (m) => m + guard);
      inserted = true;
      break;
    }
  }

  if (!inserted && s.includes('const projectId')) {
    // insert after first projectId trim/assignment line
    const m = s.match(/const projectId[^\n]+\n/);
    if (m) {
      const idx = s.indexOf(m[0]) + m[0].length;
      s = s.slice(0, idx) + guard + s.slice(idx);
      inserted = true;
    }
  }

  // Replace verifyAccessToken-only auth with authFromRequest in handlers that have projectId
  s = s.replace(
    /const authCookie = req\.cookies\.get\('access_token'\)\?\.value;\s*\n\s*if \(!authCookie\) return NextResponse\.json\(\{ error: 'No autenticado' \}, \{ status: 401 \}\);\s*\n\s*verifyAccessToken\(authCookie\);/g,
    "const auth = authFromRequest(req);\n    if (!isAuthPayload(auth)) return auth;",
  );
  s = s.replace(
    /const authCookie = req\.cookies\.get\('access_token'\)\?\.value;\s*\n\s*if \(!authCookie\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'No autenticado' \}, \{ status: 401 \}\);\s*\n\s*\}\s*\n\s*const payload = verifyAccessToken\(authCookie\);/g,
    "const auth = authFromRequest(req);\n    if (!isAuthPayload(auth)) return auth;\n    const payload = auth;",
  );
  s = s.replace(
    /const authCookie = req\.cookies\.get\('access_token'\)\?\.value;\s*\n\s*if \(!authCookie\) \{\s*\n\s*return NextResponse\.json\(\{ error: 'No autenticado' \}, \{ status: 401 \}\);\s*\n\s*\}\s*\n\s*verifyAccessToken\(authCookie\);/g,
    "const auth = authFromRequest(req);\n    if (!isAuthPayload(auth)) return auth;",
  );

  fs.writeFileSync(fp, s);
  console.log('patched:', rel, inserted ? '+guard' : 'auth only');
}

for (const f of FILES) patchFile(f);
