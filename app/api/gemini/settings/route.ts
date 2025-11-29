import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const settings = await req.json()
    
    // In a real application, you would save these settings to a database
    // For now, we'll just validate and return them
    
    const validatedSettings = {
      isEnabled: Boolean(settings.isEnabled),
      model: settings.model || 'gemini-1.5-flash',
      temperature: Math.max(0, Math.min(1, parseFloat(settings.temperature) || 0.7)),
      maxTokens: Math.max(100, Math.min(2000, parseInt(settings.maxTokens) || 500)),
      fallbackEnabled: Boolean(settings.fallbackEnabled)
    }

    // Here you would typically save to database or update environment variables
    console.log('Updated Gemini settings:', validatedSettings)

    return NextResponse.json({
      success: true,
      settings: validatedSettings,
      message: 'Settings updated successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
