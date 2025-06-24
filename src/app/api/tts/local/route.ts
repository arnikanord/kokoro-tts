import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'af_sky', format = 'mp3' } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const modelPath = path.join(process.cwd(), 'models', 'Kokoro-82M-ONNX');
    
    if (!fs.existsSync(modelPath)) {
      return NextResponse.json({ 
        error: 'Local Kokoro model not found. Please ensure the model is downloaded to the models directory.' 
      }, { status: 500 });
    }

    console.log('Local API: Processing text:', text.substring(0, 50) + '...');
    console.log('Local API: Using voice:', voice);
    console.log('Local API: Model path:', modelPath);

    const { KokoroTTS } = await import('kokoro-js');
    
    const tts = await KokoroTTS.from_pretrained(modelPath, { 
      dtype: "q8",
      device: "cpu"
    });

    const audio = await tts.generate(text.substring(0, 500), { voice });
    
    if (audio && typeof audio === 'object') {
      const audioObj = audio as any;
      
      if (audioObj.audio && audioObj.audio instanceof Float32Array) {
        const sampleRate = audioObj.sampling_rate || 24000;
        const audioData = audioObj.audio;
        
        const buffer = new ArrayBuffer(44 + audioData.length * 2);
        const view = new DataView(buffer);
        
        const writeString = (offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
          }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + audioData.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, audioData.length * 2, true);
        
        for (let i = 0; i < audioData.length; i++) {
          const sample = Math.max(-1, Math.min(1, audioData[i]));
          view.setInt16(44 + i * 2, sample * 0x7FFF, true);
        }
        
        // Convert to MP3 if requested - for now, return WAV since MP3 encoding has issues
        if (format === 'mp3') {
          console.log('MP3 format requested but returning WAV due to encoding limitations');
          // TODO: Implement server-side FFmpeg conversion for proper MP3 encoding
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
    
    return NextResponse.json({ error: 'Invalid audio format returned from TTS engine' }, { status: 500 });
    
  } catch (error) {
    console.error('Local TTS error:', error);
    return NextResponse.json({
      error: 'Local TTS generation failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}