import type { IUserRepository } from '../../domain/interfaces/IUserRepository';
import type { User } from '../../domain/models/user';
import prisma from '../../lib/prisma';

export class UserRepository implements IUserRepository {
  async findByIdentification(identification: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { identification },
    });
    if (!user) return null;
    return this.mapUser(user);
  }

  async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return this.mapUser(user);
  }

  async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
    });
    return users.map((u) => this.mapUser(u));
  }

  private mapUser(user: {
    id: string;
    identification: string;
    email: string;
    name: string;
    role: any;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    password?: string;
  }): User {
    return {
      id: user.id,
      identification: user.identification,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive ?? true,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      passwordHash: user.password,
    };
  }

  async create(data: {
    identification: string;
    email: string;
    name: string;
    passwordHash: string;
    role?: string;
  }): Promise<User> {
    const user = await prisma.user.create({
      data: {
        identification: data.identification,
        email: data.email,
        name: data.name,
        password: data.passwordHash,
        role: data.role ?? 'INSPECTOR_TECNICO',
      },
    });
    return this.mapUser(user);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      passwordHash: string;
    }>,
  ): Promise<User | null> {
    const payload: Record<string, unknown> = { ...data };
    if (payload.passwordHash) {
      payload.password = payload.passwordHash;
      delete payload.passwordHash;
    }
    const user = await prisma.user.update({
      where: { id },
      data: payload as any,
    });
    return this.mapUser(user);
  }

  async delete(id: string): Promise<boolean> {
    await prisma.user.delete({ where: { id } });
    return true;
  }
}

