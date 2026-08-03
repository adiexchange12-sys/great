import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import { execSync } from 'child_process'
import { config } from './config/env.js'
import prisma from './config/database.js'
import authRoutes from './routes/auth.js'
import visitorRoutes from './routes/visitors.js'
import chatRoutes from './routes/chats.js'
import messageRoutes from './routes/messages.js'
import uploadRoutes from './routes/upload.js'
import adminRoutes from './routes/admin.js'
import chatRoomRoutes from './routes/chat-rooms.js'
import { setupWebSocket } from './websocket/index.js'
import { createServer } from 'http'
import path from 'path'
import fs from 'fs'

const app = express()

app.use(helmet())
app.use(cors({ origin: config.corsOrigin }))
app.use(express.json())
app.use(cookieParser())
app.use('/uploads', express.static(config.uploadDir))

app.use('/api/auth', authRoutes)
app.use('/api/visitors', visitorRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/chat-rooms', chatRoomRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/debug/agents', async (req, res) => {
  try {
    const count = await prisma.agent.count()
    const agents = await prisma.agent.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    })
    res.json({ count, agents })
  } catch (error) {
    res.status(500).json({ error: 'Database error', details: error instanceof Error ? error.message : String(error) })
  }
})

const server = createServer(app)

setupWebSocket(server)

const startServer = async () => {
  try {
    const uploadDir = path.join(process.cwd(), config.uploadDir)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    console.log('Pushing database schema...')
    execSync('npx prisma db push', { stdio: 'inherit' })
    console.log('Database schema pushed successfully')

    await prisma.$connect()

    console.log('Seeding admin account...')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    await prisma.agent.upsert({
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
    console.log('Admin account ready')

    server.listen(config.port, '0.0.0.0', () => {
      console.log(`Server running on port ${config.port}`)
      console.log(`WebSocket server ready`)
    })
    
    server.on('error', (error) => {
      console.error('Server error:', error)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

export { app, server }
