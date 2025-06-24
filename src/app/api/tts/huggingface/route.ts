import { NextRequest, NextResponse } from 'next/server';

const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const HF_API_URL = process.env.HUGGINGFACE_TTS_API_URL;

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'af_sky', format = 'wav' } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (!HF_API_TOKEN || !HF_API_URL) {
      return NextResponse.json({ error: 'Hugging Face API configuration missing' }, { status: 500 });
    }

    console.log('HF API: Processing text:', text.substring(0, 50) + '...');
    console.log('HF API: Using voice:', voice);
    console.log('HF API: Using URL:', HF_API_URL);

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [text, voice, format]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HF API error:', response.status, errorText);
      return NextResponse.json({ 
        error: `Hugging Face API error: ${response.status} ${errorText}` 
      }, { status: 500 });
    }

    const result = await response.json();
    console.log('HF API result:', result);
    
    if (result.data && result.data[0]) {
      if (typeof result.data[0] === 'string' && result.data[0].startsWith('http')) {
        const audioResponse = await fetch(result.data[0]);
        const audioBuffer = await audioResponse.arrayBuffer();
        
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': audioBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      if (result.data[0].data) {
        const audioData = atob(result.data[0].data);
        const buffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }
        
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/wav',
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    }
    
    return NextResponse.json({ error: 'Invalid response format from Hugging Face API' }, { status: 500 });
    
  } catch (error) {
    console.error('HF API error:', error);
    return NextResponse.json({
      error: 'Hugging Face TTS generation failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}