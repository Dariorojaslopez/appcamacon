import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }

    const safeName = (blob.name || 'imagen')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'actividad');
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}_${safeName}`;
    const filePath = path.join(uploadsDir, fileName);
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    // URL pública servida desde `public/`
    const url = `/uploads/actividad/${fileName}`;
    return NextResponse.json({ url }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}

