import type { User } from '../models/user';

export interface IUserRepository {
  findByIdentification(identification: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: {
    identification: string;
    email: string;
    name: string;
    passwordHash: string;
    role?: string;
  }): Promise<User>;
  update(
    id: string,
    data: Partial<{
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      passwordHash: string;
    }>,
  ): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

