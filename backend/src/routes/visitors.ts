import { Router, Response } from 'express'
import { nanoid } from 'nanoid'
import prisma from '../config/database.js'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { name, email, mobile } = req.body
    
    const visitorId = `visitor_${nanoid(21)}`
    
    const visitor = await prisma.visitor.create({
      data: {
        visitorId,
        name: name || null,
        email: email || null,
        mobile: mobile || null,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'] || null
      },
      select: {
        id: true,
        visitorId: true,
        name: true,
        email: true,
        mobile: true,
        isOnline: true,
        createdAt: true
      }
    })
    
    res.status(201).json(visitor)
  } catch (error) {
    console.error('Create visitor error:', error instanceof Error ? error.message : String(error))
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/:visitorId', async (req, res) => {
  try {
    const visitor = await prisma.visitor.findUnique({
      where: { visitorId: req.params.visitorId },
      select: {
        id: true,
        visitorId: true,
        name: true,
        email: true,
        isOnline: true,
        lastSeenAt: true,
        createdAt: true
      }
    })
    
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' })
    }
    
    res.json(visitor)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/:visitorId/online', async (req, res) => {
  try {
    const visitor = await prisma.visitor.update({
      where: { visitorId: req.params.visitorId },
      data: {
        isOnline: req.body.isOnline ?? true,
        lastSeenAt: new Date()
      },
      select: {
        id: true,
        visitorId: true,
        isOnline: true,
        lastSeenAt: true
      }
    })
    
    res.json(visitor)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
