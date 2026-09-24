/**
 * Cria o usuário administrador inicial (somente se ainda não existir).
 * NÃO cria dados de exemplo: todo dado do sistema vem do uso real.
 *
 * Senha: variável SEED_ADMIN_PASSWORD; se ausente, usa "zevo123"
 * (troque no primeiro acesso).
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@zevotech.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'zevo123';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Administrador', email, passwordHash, role: 'ADMIN' },
  });

  const usingDefault = !process.env.SEED_ADMIN_PASSWORD;
  console.log(
    `Usuário admin disponível: ${admin.email}` +
      (usingDefault ? ' (senha padrão "zevo123" — troque após o primeiro login)' : '')
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
