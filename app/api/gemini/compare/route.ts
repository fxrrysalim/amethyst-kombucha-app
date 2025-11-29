import { NextRequest, NextResponse } from 'next/server'
import { getGeminiAI, isGeminiAvailable } from '@/lib/gemini-ai'
import { createTrainedClassifier } from '@/lib/ml-utils'
export const runtime = 'edge';


export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message' },
        { status: 400 }
      )
    }

    // Test Gemini AI response
    let geminiResponse = ''
    let geminiTime = 0
    let geminiConfidence = 0
    
    if (isGeminiAvailable()) {
      const startTime = Date.now()
      try {
        const gemini = getGeminiAI()
        const result = await gemini.generateResponse(message)
        geminiResponse = result.text
        geminiConfidence = result.confidence
        geminiTime = Date.now() - startTime
      } catch (error) {
        geminiResponse = 'Error: Failed to get Gemini response'
        geminiTime = Date.now() - startTime
        geminiConfidence = 0
      }
    } else {
      geminiResponse = 'Error: Gemini AI not available (API key missing)'
    }

    // Test local neural network response
    const localStartTime = Date.now()
    const classifier = createTrainedClassifier()
    const localClassification = classifier.classify(message)
    
    // Generate local response (simplified)
    let localResponse = ''
    const lowerMessage = message.toLowerCase()
    
    if (localClassification.intent === 'product') {
      localResponse = 'Kami memiliki berbagai varian kombucha: Teh Hijau, Teh Hitam, Bunga Telang, Daun Kelor, Bunga Amarant, dan Kopi. Varian mana yang ingin Anda ketahui?'
    } else if (localClassification.intent === 'faq') {
      if (lowerMessage.includes('harga')) {
        localResponse = 'Harga kombucha kami bervariasi mulai dari Rp 25.000 hingga Rp 45.000 per botol, tergantung varian dan ukuran.'
      } else {
        localResponse = 'Silakan bertanya tentang harga, cara pembelian, cara konsumsi, atau efek samping kombucha.'
      }
    } else if (localClassification.intent === 'benefits') {
      localResponse = 'Kombucha memiliki banyak manfaat: Meningkatkan sistem imun, Melancarkan pencernaan, Kaya akan probiotik, Tinggi antioksidan, Membantu detoksifikasi, Meningkatkan metabolisme.'
    } else if (localClassification.intent === 'greeting') {
      localResponse = 'Halo! Selamat datang di Amethyst Kombucha. Ada yang bisa saya bantu mengenai produk kombucha kami?'
    } else {
      localResponse = 'Maaf, saya belum sepenuhnya memahami pertanyaan Anda. Anda bisa bertanya tentang produk kombucha kami, manfaat, harga, atau cara pembelian.'
    }
    
    const localTime = Date.now() - localStartTime

    return NextResponse.json({
      input: message,
      geminiResponse,
      localResponse,
      geminiTime,
      localTime,
      geminiConfidence,
      localConfidence: localClassification.confidence,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Gemini comparison error:', error)
    return NextResponse.json(
      { error: 'Failed to compare responses' },
      { status: 500 }
    )
  }
}
