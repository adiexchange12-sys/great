import jwt from 'jsonwebtoken'
import { config } from '../config/env.js'
import { cookies } from 'next/headers'

export interface TokenPayload {
  agentId: string
  email: string
  role: string
  type: 'access' | 'refresh'
}

export function generateTokens(payload: Omit<TokenPayload, 'type'>) {
  const accessToken = jwt.sign(
    { ...payload, type: 'access' },
    config.jwtSecret,
    { expiresIn: '15m' }
  )
  
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: '7d' }
  )
  
  return { accessToken, refreshToken }
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload
}
