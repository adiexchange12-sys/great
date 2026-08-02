import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10)
  
  const admin = await prisma.agent.upsert({
    where: { email: 'admin@livechat.com' },
    update: {},
    create: {
      email: 'admin@livechat.com',
      password: hashedPassword,
      name: 'Admin',
      role: 'super_admin',
      isActive: true
    }
  })
  
  console.log('Created admin:', admin.email)
  console.log('Password: admin123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
