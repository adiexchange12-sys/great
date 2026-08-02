import { Router, Response } from 'express'
import prisma from '../config/database.js'
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/stats', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalVisitors,
      activeVisitors,
      totalChats,
      openChats,
      closedChats,
      totalMessages,
      totalAgents,
      activeAgents
    ] = await Promise.all([
      prisma.visitor.count(),
      prisma.visitor.count({ where: { isOnline: true } }),
      prisma.chat.count(),
      prisma.chat.count({ where: { status: 'open' } }),
      prisma.chat.count({ where: { status: 'closed' } }),
      prisma.message.count(),
      prisma.agent.count(),
      prisma.agent.count({ where: { isActive: true } })
    ])
    
    res.json({
      visitors: {
        total: totalVisitors,
        active: activeVisitors
      },
      chats: {
        total: totalChats,
        open: openChats,
        closed: closedChats
      },
      messages: {
        total: totalMessages
      },
      agents: {
        total: totalAgents,
        active: activeAgents
      }
    })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/chats', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const chats = await prisma.chat.findMany({
      include: {
        visitor: {
          select: {
            id: true,
            visitorId: true,
            name: true,
            email: true,
            mobile: true,
            isOnline: true,
            lastSeenAt: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            messageType: true,
            senderType: true,
            createdAt: true
          }
        },
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
    
    const formattedChats = chats.map(chat => ({
      ...chat,
      lastMessage: chat.messages[0] || null
    }))
    
    res.json(formattedChats)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/agents', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { chats: true }
        }
      }
    })
    
    res.json(agents)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/visitors', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const visitors = await prisma.visitor.findMany({
      select: {
        id: true,
        visitorId: true,
        name: true,
        email: true,
        mobile: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true,
        _count: {
          select: { chats: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    res.json(visitors)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
