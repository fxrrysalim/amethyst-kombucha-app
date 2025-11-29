import { NextRequest, NextResponse } from 'next/server'
import { isGeminiAvailable } from '@/lib/gemini-ai'
export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const isConnected = isGeminiAvailable()

    const settings = {
      isEnabled: isConnected,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '500'),
      fallbackEnabled: process.env.GEMINI_FALLBACK_ENABLED !== 'false'
    }

    return NextResponse.json({
      isConnected,
      settings,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Gemini status check error:', error)
    return NextResponse.json(
      { error: 'Failed to check Gemini status', isConnected: false },
      { status: 500 }
    )
  }
}
