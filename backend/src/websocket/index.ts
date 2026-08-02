import { Server as SocketIOServer, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import prisma from '../config/database.js'

interface AuthenticatedSocket extends Socket {
  agent?: {
    id: string
    email: string
    role: string
  }
  visitor?: {
    id: string
    visitorId: string
  }
}

export function setupWebSocket(server: any) {
  const io = new SocketIOServer(server, {
    path: '/socket.io',
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST']
    }
  })

  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token
    const visitorId = socket.handshake.auth.visitorId
    
    if (token) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as any
        
        socket.agent = {
          id: payload.agentId,
          email: payload.email,
          role: payload.role
        }
        
        next()
      } catch {
        next(new Error('Invalid token'))
      }
    } else if (visitorId) {
      socket.visitor = { id: visitorId, visitorId }
      next()
    } else {
      next(new Error('Authentication required'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    if (socket.agent) {
      console.log(`Agent ${socket.agent.email} connected`)
      socket.join('agents')
    } else if (socket.visitor) {
      console.log(`Visitor ${socket.visitor.visitorId} connected`)
      socket.join(`visitor:${socket.visitor.visitorId}`)
    }
    
    socket.on('visitor:join-chat', async (chatId: string) => {
      try {
        const chat = await prisma.chat.findUnique({
          where: { chatId }
        })
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        socket.join(`chat:${chat.id}`)
        socket.emit('visitor:joined-chat', { chatId })
      } catch (error) {
        socket.emit('error', { message: 'Failed to join chat' })
      }
    })
    
    socket.on('agent:join-chat', async (chatId: string) => {
      try {
        console.log('Agent joining chat:', { agentEmail: socket.agent?.email, chatId })
        const chat = await prisma.chat.findUnique({
          where: { chatId }
        })
        
        if (!chat) {
          console.log('Chat not found for agent join:', chatId)
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        socket.join(`chat:${chat.id}`)
        console.log(`Agent ${socket.agent?.email} joined chat room: chat:${chat.id}`)
        socket.emit('agent:joined-chat', { chatId })
      } catch (error) {
        console.error('Failed to join chat:', error)
        socket.emit('error', { message: 'Failed to join chat' })
      }
    })
    
    socket.on('agent:leave-chat', (chatId: string) => {
      socket.leave(`chat:${chat.id}`)
    })
    
    socket.on('agent:send-message', async (data: any) => {
      try {
        console.log('Agent sending message:', data)
        const { chatId, content, messageType = 'text', metadata } = data
        
        const chat = await prisma.chat.findUnique({
          where: { chatId }
        })
        
        if (!chat) {
          console.log('Chat not found for agent message:', chatId)
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        const message = await prisma.message.create({
          data: {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content,
            messageType,
            senderType: 'agent',
            senderId: socket.agent!.id,
            chatId: chat.id,
            metadata
          },
          include: {
            attachments: true
          }
        })
        
        console.log('Agent message saved:', message.id)
        
        await prisma.chat.update({
          where: { id: chat.id },
          data: { updatedAt: new Date() }
        })
        
        io.to(`chat:${chat.id}`).emit('message:new', {
          message,
          chatId
        })
        
        io.to('agents').emit('message:new', {
          message,
          chatId
        })
        
        socket.emit('message:sent', { message })
      } catch (error) {
        console.error('Agent send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })
    
    socket.on('visitor:send-message', async (data: any) => {
      try {
        console.log('Visitor sending message:', data)
        const { chatId, content, messageType = 'text', metadata } = data
        
        if (!socket.visitor) {
          socket.emit('error', { message: 'Visitor not authenticated' })
          return
        }
        
        const chat = await prisma.chat.findUnique({
          where: { chatId }
        })
        
        if (!chat) {
          console.log('Chat not found for visitor message:', chatId)
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        const visitor = await prisma.visitor.findUnique({
          where: { visitorId: socket.visitor.visitorId }
        })
        
        if (!visitor) {
          socket.emit('error', { message: 'Visitor not found' })
          return
        }
        
        const message = await prisma.message.create({
          data: {
            messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            content,
            messageType,
            senderType: 'visitor',
            senderId: visitor.id,
            chatId: chat.id,
            metadata
          },
          include: {
            attachments: true
          }
        })
        
        console.log('Visitor message saved:', message.id, 'chat room:', `chat:${chat.id}`)
        
        await prisma.chat.update({
          where: { id: chat.id },
          data: { updatedAt: new Date() }
        })
        
        io.to(`chat:${chat.id}`).emit('message:new', {
          message,
          chatId
        })
        
        io.to('agents').emit('message:new', {
          message,
          chatId
        })
        
        socket.emit('message:sent', { message })
      } catch (error) {
        console.error('Visitor send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })
    
    socket.on('agent:typing', (chatId: string) => {
      socket.to(`chat:${chat.id}`).emit('typing:agent', { chatId, isTyping: true })
    })
    
    socket.on('agent:stop-typing', (chatId: string) => {
      socket.to(`chat:${chat.id}`).emit('typing:agent', { chatId, isTyping: false })
    })
    
    socket.on('visitor:typing', (chatId: string) => {
      socket.to(`chat:${chat.id}`).emit('typing:visitor', { chatId, isTyping: true })
    })
    
    socket.on('visitor:stop-typing', (chatId: string) => {
      socket.to(`chat:${chat.id}`).emit('typing:visitor', { chatId, isTyping: false })
    })
    
    socket.on('call:offer', async (data: any) => {
      try {
        const chat = await prisma.chat.findUnique({
          where: { chatId: data.chatId }
        })
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        io.to(`chat:${chat.id}`).emit('call:incoming', {
          chatId: data.chatId,
          offer: data.offer
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to initiate call' })
      }
    })
    
    socket.on('call:answer', async (data: any) => {
      try {
        const chat = await prisma.chat.findUnique({
          where: { chatId: data.chatId }
        })
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        io.to(`chat:${chat.id}`).emit('call:answer', {
          chatId: data.chatId,
          answer: data.answer
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to answer call' })
      }
    })
    
    socket.on('call:ice-candidate', async (data: any) => {
      try {
        const chat = await prisma.chat.findUnique({
          where: { chatId: data.chatId }
        })
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        io.to(`chat:${chat.id}`).emit('call:ice-candidate', {
          chatId: data.chatId,
          candidate: data.candidate
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to send ICE candidate' })
      }
    })
    
    socket.on('call:end', async (data: any) => {
      try {
        const chat = await prisma.chat.findUnique({
          where: { chatId: data.chatId }
        })
        
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' })
          return
        }
        
        io.to(`chat:${chat.id}`).emit('call:end', {
          chatId: data.chatId
        })
      } catch (error) {
        socket.emit('error', { message: 'Failed to end call' })
      }
    })
    
    socket.on('disconnect', () => {
      if (socket.agent) {
        console.log(`Agent ${socket.agent.email} disconnected`)
      } else if (socket.visitor) {
        console.log(`Visitor ${socket.visitor.visitorId} disconnected`)
      }
    })
  })
}
