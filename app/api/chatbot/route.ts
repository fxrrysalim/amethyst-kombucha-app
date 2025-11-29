import { NextRequest, NextResponse } from 'next/server'
import { createTrainedClassifier, IntentClassifier } from '@/lib/ml-utils'
import { getGeminiAI, isGeminiAvailable } from '@/lib/gemini-ai'
import { generateResponseWithData, buildKombuchaKnowledgeBase } from '@/lib/data-integration'
export const runtime = 'edge';

// Data pengetahuan tentang produk kombucha - Enhanced with data files
const dynamicKnowledge = buildKombuchaKnowledgeBase()

// Legacy knowledge for fallback
const knowledge = {
  products: {
    'teh hijau': 'Kombucha Teh Hijau kaya akan antioksidan dan membantu meningkatkan metabolisme. Memiliki rasa yang segar dan ringan.',
    'teh hitam': 'Kombucha Teh Hitam memiliki rasa yang lebih kuat dan bold. Mengandung kafein alami dan probiotik yang baik untuk pencernaan.',
    'bunga telang': 'Kombucha Bunga Telang memiliki warna biru alami yang cantik dan kaya akan antosianin. Baik untuk kesehatan mata dan kulit.',
    'daun kelor': 'Kombucha Daun Kelor kaya akan vitamin A, C, dan zat besi. Sangat baik untuk meningkatkan sistem imun.',
    'bunga amarant': 'Kombucha Bunga Amarant memiliki kandungan protein tinggi dan antioksidan. Membantu menjaga kesehatan jantung.',
    'kopi': 'Kombucha Kopi memberikan energi alami dengan kandungan probiotik. Kombinasi sempurna untuk para pecinta kopi.'
  },
  benefits: [
    'Meningkatkan sistem imun',
    'Melancarkan pencernaan',
    'Kaya akan probiotik',
    'Tinggi antioksidan',
    'Membantu detoksifikasi',
    'Meningkatkan metabolisme'
  ],
  faq: {
    'apa itu kombucha': 'Kombucha adalah minuman fermentasi yang dibuat dari teh yang difermentasi dengan SCOBY (Symbiotic Culture of Bacteria and Yeast). Minuman ini kaya akan probiotik dan antioksidan.',
    'bagaimana cara minum': 'Kombucha sebaiknya diminum 1-2 gelas per hari, idealnya 30 menit sebelum atau sesudah makan. Mulai dengan porsi kecil jika baru pertama kali mencoba.',
    'efek samping': 'Kombucha umumnya aman dikonsumsi. Namun, beberapa orang mungkin mengalami gangguan pencernaan ringan di awal konsumsi. Mulai dengan porsi kecil.',
    'berapa harga': 'Harga kombucha kami bervariasi mulai dari Rp 25.000 hingga Rp 45.000 per botol, tergantung varian dan ukuran.',
    'dimana beli': 'Anda bisa membeli produk kami melalui website ini atau menghubungi customer service kami untuk informasi toko terdekat.'
  }
}

// Simple neural network simulation untuk text classification
class SimpleNeuralNetwork {
  private weights: { [key: string]: number } = {
    'produk': 0.8,
    'harga': 0.7,
    'beli': 0.9,
    'efek': 0.6,
    'manfaat': 0.8,
    'cara': 0.7,
    'kombucha': 0.9,
    'teh': 0.8,
    'hijau': 0.7,
    'hitam': 0.7,
    'kelor': 0.8,
    'telang': 0.8,
    'amarant': 0.8,
    'kopi': 0.7
  }

  classify(text: string): { intent: string, confidence: number } {
    const words = text.toLowerCase().split(' ')
    let maxScore = 0
    let bestIntent = 'general'

    // Product inquiry
    let productScore = 0
    words.forEach(word => {
      if (this.weights[word]) productScore += this.weights[word]
      if (Object.keys(knowledge.products).some(p => p.includes(word))) productScore += 1
    })

    // FAQ classification
    let faqScore = 0
    if (text.includes('apa itu') || text.includes('bagaimana') || text.includes('cara')) faqScore += 0.8
    if (text.includes('harga') || text.includes('berapa')) faqScore += 0.9
    if (text.includes('beli') || text.includes('dimana')) faqScore += 0.9
    if (text.includes('efek') || text.includes('samping')) faqScore += 0.8

    if (productScore > maxScore) {
      maxScore = productScore
      bestIntent = 'product'
    }
    if (faqScore > maxScore) {
      maxScore = faqScore
      bestIntent = 'faq'
    }

    return { intent: bestIntent, confidence: Math.min(maxScore, 1) }
  }
}

// Initialize the advanced neural network classifier
let advancedClassifier: IntentClassifier | null = null

async function getClassifier(): Promise<IntentClassifier> {
  if (!advancedClassifier) {
    advancedClassifier = createTrainedClassifier()
  }
  return advancedClassifier
}

const neuralNet = new SimpleNeuralNetwork()

async function generateResponse(message: string, sessionId?: string): Promise<{ response: string, classification: { intent: string, confidence: number }, aiProvider: 'gemini' | 'local' | 'hybrid' }> {
  let response = ''
  let classification = { intent: 'general', confidence: 0.5 }
  let aiProvider: 'gemini' | 'local' | 'hybrid' = 'local'

  // Try using Gemini AI first if available
  if (isGeminiAvailable()) {
    try {
      const gemini = getGeminiAI()
      
      // Get intent classification from Gemini
      classification = await gemini.classifyIntent(message)
      
      // Build context based on intent
      let context = ''
      if (classification.intent === 'product') {
        context = 'Pelanggan bertanya tentang produk. Berikan informasi detail dan relevan.'
      } else if (classification.intent === 'faq') {
        context = 'Pelanggan bertanya FAQ. Berikan jawaban langsung dan praktis.'
      } else if (classification.intent === 'benefits') {
        context = 'Pelanggan ingin tahu manfaat. Jelaskan manfaat kesehatan dengan faktual.'
      }
      
      // Generate response using Gemini with intent context
      const geminiResponse = await gemini.generateResponse(message, context, '', classification.intent)
      response = geminiResponse.text
      aiProvider = 'gemini'
      
      // Update confidence if Gemini confidence is higher
      if (geminiResponse.confidence > classification.confidence) {
        classification.confidence = geminiResponse.confidence
      }
      
      return { response, classification, aiProvider }
      
    } catch (error) {
      console.error('Gemini AI error, falling back to local model:', error)
      // Fall back to local neural network if Gemini fails
      aiProvider = 'hybrid'
    }
  }

  // Fallback to local neural network
  const classifier = await getClassifier()
  const localClassification = classifier.classify(message)
  
  // Use local classification if we're in hybrid mode or if local confidence is better
  if (aiProvider === 'hybrid' || localClassification.confidence > classification.confidence) {
    classification = localClassification
  }
  
  // Fallback to simple classifier if confidence is low
  if (classification.confidence < 0.6) {
    const fallbackClassification = neuralNet.classify(message)
    if (fallbackClassification.confidence > classification.confidence) {
      classification.intent = fallbackClassification.intent
      classification.confidence = fallbackClassification.confidence
    }
  }
  
  const lowerMessage = message.toLowerCase()

  // If we don't have a response from Gemini, generate using enhanced data integration
  if (!response) {
    // Try data-integrated response first
    const dataResponse = generateResponseWithData(message, classification.intent)
    if (dataResponse) {
      response = dataResponse
    } else {
      // Fallback to legacy knowledge base
      const lowerMessage = message.toLowerCase()

      // Product-related responses
      if (classification.intent === 'product') {
        // Check dynamic knowledge first
        const mentionedProduct = dynamicKnowledge.products.find(product => 
          lowerMessage.includes(product.name.toLowerCase())
        )
        
        if (mentionedProduct) {
          response = `${mentionedProduct.description} Harga: Rp ${mentionedProduct.price.toLocaleString()}. Manfaat utama: ${mentionedProduct.benefits.slice(0, 2).join(' dan ')}. Ada yang ingin ditanyakan lebih lanjut?`
        } else {
          for (const [product, description] of Object.entries(knowledge.products)) {
            if (lowerMessage.includes(product)) {
              response = `${description} Apakah ada yang ingin Anda ketahui lebih lanjut tentang kombucha ${product}?`
              break
            }
          }
          if (!response) {
            const productList = dynamicKnowledge.products.map(p => p.name).join(', ')
            response = `Kami memiliki berbagai varian kombucha: ${productList}. Varian mana yang ingin Anda ketahui?`
          }
        }
      }
      // FAQ responses
      else if (classification.intent === 'faq') {
        for (const [question, answer] of Object.entries(knowledge.faq)) {
          if (lowerMessage.includes(question.split(' ')[0]) || 
              (question.includes('harga') && lowerMessage.includes('harga')) ||
              (question.includes('beli') && (lowerMessage.includes('beli') || lowerMessage.includes('dimana'))) ||
              (question.includes('efek') && lowerMessage.includes('efek'))) {
            response = answer
            break
          }
        }
        if (!response) {
          response = 'Silakan bertanya tentang harga, cara pembelian, cara konsumsi, atau efek samping kombucha.'
        }
      }
      // Benefits inquiry
      else if (classification.intent === 'benefits' || lowerMessage.includes('manfaat') || lowerMessage.includes('khasiat')) {
        const benefitsList = dynamicKnowledge.benefits.map(b => b.title).join(', ')
        response = `Kombucha memiliki banyak manfaat: ${benefitsList}. Ingin tahu lebih detail tentang manfaat tertentu?`
      }
      // Greeting responses
      else if (classification.intent === 'greeting' || lowerMessage.includes('halo') || lowerMessage.includes('hai') || lowerMessage.includes('hello')) {
        response = 'Halo! Selamat datang di Amethyst Kombucha. Ada yang bisa saya bantu mengenai produk kombucha kami?'
      }
      // Default response
      else {
        response = 'Maaf, saya belum sepenuhnya memahami pertanyaan Anda. Anda bisa bertanya tentang produk kombucha kami, manfaat, harga, atau cara pembelian. Ada yang spesifik yang ingin Anda ketahui?'
      }
    }
    
    // If we used local knowledge base, update aiProvider
    if (aiProvider === 'hybrid') {
      aiProvider = 'hybrid'
    } else if (aiProvider === 'local') {
      aiProvider = 'local'
    }
  }

  return { response, classification, aiProvider }
}

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json()
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Pesan tidak valid' },
        { status: 400 }
      )
    }

    // Log conversation untuk analytics
    const currentSessionId = sessionId || `session_${Date.now()}`
    
    const { response, classification, aiProvider } = await generateResponse(message, currentSessionId)
    
    try {
      await fetch(`${req.nextUrl.origin}/api/chatbot/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'log_conversation',
          sessionId: currentSessionId,
          message,
          response,
          intent: classification.intent,
          confidence: classification.confidence
        })
      })
    } catch (analyticsError) {
      console.error('Failed to log analytics:', analyticsError)
      // Don't fail the main request if analytics logging fails
    }

    return NextResponse.json({
      answer: response,
      confidence: classification.confidence,
      intent: classification.intent,
      sessionId: currentSessionId,
      aiProvider,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Chatbot error:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    )
  }
}
