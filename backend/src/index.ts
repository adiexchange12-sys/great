import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
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

const server = createServer(app)

setupWebSocket(server)

const startServer = async () => {
  try {
    await prisma.$connect()
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
