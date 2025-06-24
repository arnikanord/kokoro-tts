import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get audio data from request body
    const audioBuffer = await request.arrayBuffer();
    
    console.log('Compress API: Received audio buffer size:', audioBuffer.byteLength);
    
    if (audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
    }
    
    // For now, check if it's already WAV format and convert to MP3 with compression
    const uint8Array = new Uint8Array(audioBuffer);
    
    // Check if it's a WAV file (RIFF header)
    if (uint8Array.length >= 12 && 
        uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && 
        uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
      
      try {
        const lamejs = await import('lamejs');
        const Mp3Encoder = lamejs.Mp3Encoder;
        
        // Extract PCM data from WAV (skip 44-byte header)
        const pcmData = new Int16Array(audioBuffer.slice(44));
        
        // Convert to mono samples for LAME
        const samples = new Int16Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
          samples[i] = pcmData[i];
        }
        
        // Initialize MP3 encoder (mono, 24kHz, 128kbps for compression)
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
        
        console.log('Compress API: Compressed from', audioBuffer.byteLength, 'to', mp3Buffer.byteLength, 'bytes');
        
        return new NextResponse(mp3Buffer, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': mp3Buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=3600',
          },
        });
        
      } catch (compressionError) {
        console.error('Audio compression failed:', compressionError);
        return NextResponse.json({
          error: 'Audio compression failed',
          details: (compressionError as Error).message
        }, { status: 500 });
      }
    } else {
      // If it's not a WAV file, return it as-is (might already be compressed)
      console.log('Compress API: File is not WAV format, returning as-is');
      return new NextResponse(audioBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
    
  } catch (error) {
    console.error('Compression API error:', error);
    return NextResponse.json({
      error: 'Compression API failed',
      details: (error as Error).message
    }, { status: 500 });
  }
}

// Increase the maximum body size for this endpoint
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
}