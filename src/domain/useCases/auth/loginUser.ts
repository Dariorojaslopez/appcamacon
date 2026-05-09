import type { IUserRepository } from '../../interfaces/IUserRepository';
import type { User } from '../../models/user';
import { compare } from 'bcryptjs';

export interface LoginUserInput {
  identification: string;
  password: string;
}

export interface LoginUserOutput {
  user: User;
}

export class LoginUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute({ identification, password }: LoginUserInput): Promise<LoginUserOutput> {
    const user = await this.userRepository.findByIdentification(identification);

    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    if (user.isActive === false) {
      throw new Error('Usuario inactivo. Contacte al administrador.');
    }

    // En este punto asumimos que en la capa de infraestructura
    // tendremos acceso al hash de la contraseña para validarla.
    const isValidPassword = await compare(password, (user as any).passwordHash);

    if (!isValidPassword) {
      throw new Error('Credenciales inválidas');
    }

    // No devolvemos el hash de la contraseña al exterior
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { /* passwordHash, */ ...safeUser } = user as any;

    return { user: safeUser };
  }
}

