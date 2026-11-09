import bcrypt from "bcryptjs";

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function validatePassword(plain: string): string | null {
  if (!plain || plain.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(plain)) return "La contraseña debe incluir al menos una mayúscula.";
  if (!/[0-9]/.test(plain)) return "La contraseña debe incluir al menos un número.";
  return null;
}
