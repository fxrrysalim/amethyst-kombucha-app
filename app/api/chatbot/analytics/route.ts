import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'edge';

// In-memory storage for demo purposes
// In production, use a database like PostgreSQL, MongoDB, etc.
const chatLogs: Array<{
  id: string
  sessionId: string
  message: string
  response: string
  intent: string
  confidence: number
  timestamp: Date
  userAgent?: string
  ipAddress?: string
}> = []

const sessions: Array<{
  id: string
  startTime: Date
  endTime?: Date
  messageCount: number
  avgConfidence: number
  userAgent?: string
  ipAddress?: string
}> = []

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const limit = parseInt(url.searchParams.get('limit') || '100')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    switch (type) {
      case 'analytics':
        const analytics = generateAnalytics()
        return NextResponse.json(analytics)

      case 'sessions':
        const paginatedSessions = sessions
          .slice(offset, offset + limit)
          .map(session => ({
            ...session,
            duration: session.endTime 
              ? (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60
              : 0
          }))
        
        return NextResponse.json({
          sessions: paginatedSessions,
          total: sessions.length,
          hasMore: offset + limit < sessions.length
        })

      case 'logs':
        const paginatedLogs = chatLogs
          .slice(offset, offset + limit)
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        
        return NextResponse.json({
          logs: paginatedLogs,
          total: chatLogs.length,
          hasMore: offset + limit < chatLogs.length
        })

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { type, ...payload } = data

    switch (type) {
      case 'log_conversation':
        const logEntry = {
          id: generateId(),
          sessionId: payload.sessionId,
          message: payload.message,
          response: payload.response,
          intent: payload.intent,
          confidence: payload.confidence,
          timestamp: new Date(),
          userAgent: req.headers.get('user-agent') || undefined,
          ipAddress: getClientIP(req)
        }
        
        chatLogs.push(logEntry)
        
        // Update session
        let session = sessions.find(s => s.id === payload.sessionId)
        if (!session) {
          session = {
            id: payload.sessionId,
            startTime: new Date(),
            messageCount: 0,
            avgConfidence: 0,
            userAgent: req.headers.get('user-agent') || undefined,
            ipAddress: getClientIP(req)
          }
          sessions.push(session)
        }
        
        session.messageCount++
        session.avgConfidence = (session.avgConfidence * (session.messageCount - 1) + payload.confidence) / session.messageCount
        session.endTime = new Date()
        
        return NextResponse.json({ success: true, logId: logEntry.id })

      case 'end_session':
        const sessionToEnd = sessions.find(s => s.id === payload.sessionId)
        if (sessionToEnd) {
          sessionToEnd.endTime = new Date()
        }
        
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
    }
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function generateAnalytics() {
  const now = new Date()
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  }).reverse()

  // Calculate intent distribution
  const intentCounts: { [key: string]: number } = {}
  chatLogs.forEach(log => {
    intentCounts[log.intent] = (intentCounts[log.intent] || 0) + 1
  })

  const topIntents = Object.entries(intentCounts)
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Calculate daily stats
  const dailyStats = last7Days.map(date => {
    const dayLogs = chatLogs.filter(log => 
      log.timestamp.toISOString().split('T')[0] === date
    )
    const daySessions = sessions.filter(session => 
      session.startTime.toISOString().split('T')[0] === date
    )
    
    return {
      date,
      messages: dayLogs.length,
      sessions: daySessions.length
    }
  })

  // Calculate common questions (simplified)
  const questionCounts: { [key: string]: { count: number, confidences: number[] } } = {}
  chatLogs.forEach(log => {
    const question = log.message.toLowerCase()
    if (!questionCounts[question]) {
      questionCounts[question] = { count: 0, confidences: [] }
    }
    questionCounts[question].count++
    questionCounts[question].confidences.push(log.confidence)
  })

  const commonQuestions = Object.entries(questionCounts)
    .map(([question, data]) => ({
      question,
      count: data.count,
      avgConfidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalMessages: chatLogs.length,
    totalSessions: sessions.length,
    avgConfidence: chatLogs.length > 0 
      ? chatLogs.reduce((sum, log) => sum + log.confidence, 0) / chatLogs.length 
      : 0,
    topIntents,
    dailyStats,
    commonQuestions
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const real = req.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (real) {
    return real.trim()
  }
  
  return 'unknown'
}
