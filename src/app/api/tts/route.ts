import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

// Check if local model exists (this can stay at module level as it's a file system check)
const modelPath = path.join(process.cwd(), 'models', 'Kokoro-82M-ONNX');
const HAS_LOCAL_MODEL = fs.existsSync(modelPath);

// Hugging Face API function for Gradio-based spaces
async function generateWithHuggingFace(text: string, voice: string, format: string = 'wav') {
  // Read environment variables at runtime
  const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
  const HF_API_URL = process.env.HUGGINGFACE_TTS_API_URL;

  if (!HF_API_TOKEN || !HF_API_URL) {
    throw new Error('Hugging Face API configuration missing');
  }

  // For Gradio spaces, we typically use /api/predict endpoint
  const apiUrl = `${HF_API_URL}/api/predict`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [text, voice, format] // Gradio typically expects data as array
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Gradio returns data in result.data array, typically the audio file URL or base64
    if (result.data && result.data[0]) {
      // If it's a URL, fetch the audio file
      if (typeof result.data[0] === 'string' && result.data[0].startsWith('http')) {
        const audioResponse = await fetch(result.data[0]);
        return audioResponse.arrayBuffer();
      }
      // If it's base64 or direct data
      if (result.data[0].data) {
        const audioData = atob(result.data[0].data);
        const buffer = new ArrayBuffer(audioData.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < audioData.length; i++) {
          view[i] = audioData.charCodeAt(i);
        }
        return buffer;
      }
    }
    
    throw new Error('Invalid response format from Hugging Face API');
  } catch (error) {
    // If it's a network error and we're dealing with a sleeping space, give it more time
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error('Hugging Face Space may be sleeping - please try again in a moment');
    }
    throw error;
  }
}

// Local model function
async function generateWithLocalModel(text: string, voice: string) {
  // Import Kokoro.js on the server side
  const { KokoroTTS } = await import('kokoro-js');
  
  // Use local model path directly
  const modelPath = path.join(process.cwd(), 'models', 'Kokoro-82M-ONNX');
  console.log('Model path:', modelPath);
  
  // Check if local model exists
  if (!fs.existsSync(modelPath)) {
    throw new Error('Local Kokoro model not found. Please ensure the model is downloaded to the models directory.');
  }
  
  // Initialize TTS with local model path
  console.log('Initializing Kokoro TTS...');
  const tts = await KokoroTTS.from_pretrained(modelPath, { 
    dtype: "q8",
    device: "cpu"
  });

  console.log('TTS model loaded, generating audio...');

  // Generate audio (limit text length for API)
  const audio = await tts.generate(text.substring(0, 500), { voice });
  
  console.log('Audio generated, processing...');
  
  return audio;
}

// Server-side TTS endpoint using Kokoro.js with local model or Hugging Face API
export async function POST(request: NextRequest) {
  try {
    // Read environment variables at runtime
    const HF_API_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
    const HF_API_URL = process.env.HUGGINGFACE_TTS_API_URL;
    const USE_HUGGINGFACE = HF_API_TOKEN && HF_API_URL;

    const { text, voice = 'af_sky', language = 'en', format = 'mp3', processingMode = 'huggingface' } = await request.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Debug logging (masking sensitive values)
    console.log('TTS API called with text:', text.substring(0, 50) + '...');
    console.log('Has local model:', HAS_LOCAL_MODEL);
    console.log('Hugging Face Config Check:');
    console.log('  - HUGGINGFACE_API_TOKEN:', HF_API_TOKEN ? `***${HF_API_TOKEN.slice(-4)}` : 'MISSING');
    console.log('  - HUGGINGFACE_TTS_API_URL:', HF_API_URL || 'MISSING');
    console.log('  - Hugging Face configured:', USE_HUGGINGFACE);
    console.log('User selected processing mode:', processingMode);

    let audioBuffer: ArrayBuffer;

    // Use the processing mode selected by the user
    if (processingMode === 'huggingface' && USE_HUGGINGFACE) {
      try {
        // Use Hugging Face API
        console.log('Using Hugging Face API...');
        audioBuffer = await generateWithHuggingFace(text, voice, format);
        console.log('Hugging Face audio generated, size:', audioBuffer.byteLength, 'bytes');
      } catch (hfError) {
        console.error('Hugging Face API failed:', hfError);
        if (HAS_LOCAL_MODEL) {
          console.log('Falling back to local model...');
          const audio = await generateWithLocalModel(text, voice);
          audioBuffer = processLocalModelAudio(audio);
        } else {
          throw hfError;
        }
      }
    } else if (processingMode === 'local' && HAS_LOCAL_MODEL) {
      // Use local model as requested by user
      console.log('Using local model as requested by user...');
      const audio = await generateWithLocalModel(text, voice);
      audioBuffer = processLocalModelAudio(audio);
    } else if (processingMode === 'huggingface' && !USE_HUGGINGFACE) {
      throw new Error('Hugging Face API configuration missing. Please check your .env.local file for HUGGINGFACE_API_TOKEN and HUGGINGFACE_TTS_API_URL');
    } else if (processingMode === 'local' && !HAS_LOCAL_MODEL) {
      throw new Error('Local Kokoro model not found. Please ensure the model is downloaded to the models directory.');
    } else {
      throw new Error('No TTS engine available for the selected processing mode.');
    }

    // Helper function to process local model audio
    function processLocalModelAudio(audio: any): ArrayBuffer {
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
          
          return buffer;
        } else {
          throw new Error('Could not find audio data in the generated object');
        }
      } else {
        throw new Error('Invalid audio format returned from TTS engine');
      }
    }

    console.log('Audio created, size:', audioBuffer.byteLength, 'bytes');

    // Convert to MP3 if requested
    if (format === 'mp3') {
      try {
        const lamejs = await import('lamejs');
        const Mp3Encoder = lamejs.Mp3Encoder;
        
        // Extract PCM data from WAV (skip 44-byte header)
        const pcmData = new Int16Array(audioBuffer.slice(44));
        
        // Convert to mono float array for LAME
        const samples = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          samples[i] = pcmData[i];
        }
        
        // Initialize MP3 encoder (mono, 24kHz, 128kbps)
        const mp3encoder = new Mp3Encoder(1, 24000, 128);
        const mp3Data = [];
        
        // Encode in chunks
        const blockSize = 1152;
        for (let i = 0; i < samples.length; i += blockSize) {
          const sampleChunk = samples.slice(i, i + blockSize);
          const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
        
        // Finalize encoding
        const mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        
        // Combine all MP3 chunks
        const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
        const mp3Buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of mp3Data) {
          mp3Buffer.set(chunk, offset);
          offset += chunk.length;
        }
        
        console.log('MP3 created, size:', mp3Buffer.byteLength, 'bytes');
        
        return new NextResponse(mp3Buffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': mp3Buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (mp3Error) {
        console.error('MP3 encoding failed, falling back to WAV:', mp3Error);
        // Fall through to WAV response
      }
    }

    // Return WAV audio as response
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: 'TTS generation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}