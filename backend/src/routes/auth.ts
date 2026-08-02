import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../config/database.js'
import { config } from '../config/env.js'
import { generateTokens } from '../utils/auth.js'
import { AuthRequest, authMiddleware, requireRole } from '../middleware/auth.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body)
    
    const agent = await prisma.agent.findUnique({
      where: { email }
    })
    
    if (!agent) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const isValid = await bcrypt.compare(password, agent.password)
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    await prisma.agent.update({
      where: { id: agent.id },
      data: { lastLoginAt: new Date() }
    })
    
    const tokens = generateTokens({
      agentId: agent.id,
      email: agent.email,
      role: agent.role
    })
    
      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        agent: {
          id: agent.id,
          email: agent.email,
          name: agent.name,
          role: agent.role
        }
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0].message })
      }
      res.status(500).json({ error: 'Internal server error' })
    }
  })

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' })
    }
    
    const payload = jwt.verify(refreshToken, config.jwtRefreshSecret) as any
    
    if (payload.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' })
    }
    
    const session = await prisma.session.findFirst({
      where: {
        agentId: payload.agentId,
        refreshToken,
        expiresAt: { gt: new Date() }
      }
    })
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' })
    }
    
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: { id: true, email: true, role: true, isActive: true }
    })
    
    if (!agent || !agent.isActive) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    
    const tokens = generateTokens({
      agentId: agent.id,
      email: agent.email,
      role: agent.role
    })
    
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: tokens.refreshToken }
    })
    
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    })
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.session.deleteMany({
      where: { agentId: req.agent!.id }
    })
    
    res.json({ message: 'Logged out successfully' })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/create-agent', authMiddleware, requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().min(1),
      role: z.enum(['agent', 'admin']).default('agent')
    })
    
    const { email, password, name, role } = schema.parse(req.body)
    
    const existing = await prisma.agent.findUnique({
      where: { email }
    })
    
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' })
    }
    
    const hashedPassword = await bcrypt.hash(password, 10)
    
    const agent = await prisma.agent.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    })
    
    res.status(201).json(agent)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message })
    }
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
