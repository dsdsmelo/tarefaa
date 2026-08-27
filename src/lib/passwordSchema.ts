import { z } from 'zod';

// Política de senha forte, usada em cadastro e definição de nova senha.
export const strongPasswordSchema = z
  .string()
  .min(8, 'A senha deve ter no mínimo 8 caracteres')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula')
  .regex(/[0-9]/, 'Inclua ao menos um número');
