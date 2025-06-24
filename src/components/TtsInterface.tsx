'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TtsInterfaceProps {
  language: 'en' | 'de';
}

const TtsInterface: React.FC<TtsInterfaceProps> = ({ language }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentAudioChunks, setCurrentAudioChunks] = useState<ArrayBuffer[]>([]);
  const [kokoroTTS, setKokoroTTS] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Voice selection based on language
  const getVoiceForLanguage = (lang: 'en' | 'de') => {
    return lang === 'en' ? 'af_sky' : 'af_sky'; // You can add German-specific voices when available
  };

  // Initialize Kokoro TTS
  useEffect(() => {
    const initKokoro = async () => {
      try {
        console.log('Starting Kokoro TTS initialization...');
        
        // Dynamic import for client-side only
        const kokoroModule = await import('kokoro-js');
        console.log('Kokoro module loaded:', kokoroModule);
        
        const { KokoroTTS } = kokoroModule;
        console.log('Creating KokoroTTS instance...');
        
        const tts = await KokoroTTS.from_pretrained(
          "onnx-community/Kokoro-82M-ONNX",
          { dtype: "q8" }
        );
        
        console.log('Kokoro TTS initialized successfully:', tts);
        setKokoroTTS(tts);
      } catch (error) {
        console.error('Failed to initialize Kokoro TTS:', error);
        console.error('Error details:', (error as Error).stack);
        
        // Show user-friendly error
        alert(`Failed to initialize TTS engine: ${(error as Error).message}. Please refresh the page and try again.`);
      }
    };

    // Only run in browser environment
    if (typeof window !== 'undefined') {
      initKokoro();
    }
  }, []);

  // Text chunking function - splits text into chunks of ~500 tokens
  const chunkText = (text: string, maxTokens: number = 500): string[] => {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // Rough token estimation (words * 1.3)
      const estimatedTokens = (currentChunk + ' ' + trimmedSentence).split(/\s+/).length * 1.3;
      
      if (estimatedTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk = currentChunk ? currentChunk + '. ' + trimmedSentence : trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  };

  // Merge audio chunks into a single audio buffer
  const mergeAudioBuffers = (chunks: ArrayBuffer[]): ArrayBuffer => {
    if (chunks.length === 0) return new ArrayBuffer(0);
    if (chunks.length === 1) return chunks[0];

    // For simplicity, just concatenate the raw buffers
    // In a production app, you'd want proper audio merging
    let totalLength = 0;
    chunks.forEach(chunk => totalLength += chunk.byteLength);
    
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    
    chunks.forEach(chunk => {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    });
    
    return merged.buffer;
  };

  // Convert text to speech with chunking
  const convertToSpeech = async () => {
    if (!text.trim()) {
      alert(language === 'en' ? 'Please enter some text to convert.' : 'Bitte geben Sie Text ein, der konvertiert werden soll.');
      return;
    }

    if (!kokoroTTS) {
      alert(language === 'en' ? 'TTS engine is not ready yet. Please wait and try again.' : 'TTS-Engine ist noch nicht bereit. Bitte warten Sie und versuchen Sie es erneut.');
      return;
    }

    console.log('Starting text conversion...');
    setIsLoading(true);
    setProgress(0);
    setCurrentAudioChunks([]);
    setAudioUrl(null);

    try {
      const chunks = chunkText(text);
      console.log(`Processing ${chunks.length} text chunks...`);
      
      const audioChunks: ArrayBuffer[] = [];
      const voice = getVoiceForLanguage(language);
      console.log(`Using voice: ${voice}`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 50)}..."`);
        setProgress((i / chunks.length) * 100);

        try {
          const audio = await kokoroTTS.generate(chunk, { voice });
          console.log('Generated audio for chunk:', audio);
          
          // Handle different possible audio formats from Kokoro.js
          let audioBuffer;
          if (audio instanceof ArrayBuffer) {
            audioBuffer = audio;
          } else if (audio.buffer) {
            audioBuffer = audio.buffer;
          } else if (audio.data) {
            audioBuffer = audio.data;
          } else {
            console.error('Unknown audio format:', audio);
            throw new Error('Unknown audio format returned from TTS engine');
          }
          
          audioChunks.push(audioBuffer);
          console.log(`Chunk ${i + 1} processed successfully`);
        } catch (chunkError) {
          console.error(`Error processing chunk ${i + 1}:`, chunkError);
          // Continue with other chunks instead of failing completely
        }
      }

      console.log(`Processed ${audioChunks.length} audio chunks successfully`);

      if (audioChunks.length > 0) {
        setCurrentAudioChunks(audioChunks);
        
        // For web playback, create a blob URL
        console.log('Merging audio chunks...');
        const mergedBuffer = mergeAudioBuffers(audioChunks);
        const blob = new Blob([mergedBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        console.log('Audio ready for playback');
      } else {
        throw new Error('No audio chunks were successfully generated');
      }

      setProgress(100);
    } catch (error) {
      console.error('TTS conversion failed:', error);
      const errorMsg = language === 'en' 
        ? `Failed to convert text to speech: ${(error as Error).message}` 
        : `Fehler beim Konvertieren des Textes: ${(error as Error).message}`;
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Download audio file
  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-${language}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Clear current session
  const clearSession = () => {
    setText('');
    setAudioUrl(null);
    setCurrentAudioChunks([]);
    setProgress(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Kokoro TTS - {language === 'en' ? 'English' : 'German'}
        </h1>
        <p className="text-gray-600">
          {language === 'en' 
            ? 'Convert your text to high-quality speech. Supports large texts up to thousands of pages.'
            : 'Konvertieren Sie Ihren Text in hochwertige Sprache. Unterstützt große Texte bis zu Tausenden von Seiten.'}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
            {language === 'en' ? 'Enter your text:' : 'Geben Sie Ihren Text ein:'}
          </label>
          <textarea
            id="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-64 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            placeholder={language === 'en' 
              ? 'Paste your text here... (supports large texts, books, articles, etc.)'
              : 'Fügen Sie hier Ihren Text ein... (unterstützt große Texte, Bücher, Artikel usw.)'}
            disabled={isLoading}
          />
          <div className="mt-1 text-sm text-gray-500">
            {language === 'en' 
              ? `Characters: ${text.length} | Estimated chunks: ${text ? chunkText(text).length : 0}`
              : `Zeichen: ${text.length} | Geschätzte Chunks: ${text ? chunkText(text).length : 0}`}
          </div>
        </div>

        {!kokoroTTS && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-yellow-800">
              {language === 'en' 
                ? 'Loading TTS engine...' 
                : 'TTS-Engine wird geladen...'}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={convertToSpeech}
            disabled={!text.trim() || isLoading || !kokoroTTS}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {language === 'en' ? 'Converting...' : 'Konvertiere...'}
              </>
            ) : (
              language === 'en' ? 'Convert to Speech' : 'In Sprache umwandeln'
            )}
          </button>

          {audioUrl && (
            <>
              <button
                onClick={downloadAudio}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                {language === 'en' ? 'Download Audio' : 'Audio herunterladen'}
              </button>
              <button
                onClick={clearSession}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                {language === 'en' ? 'Clear' : 'Löschen'}
              </button>
            </>
          )}
        </div>

        {isLoading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        {audioUrl && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              {language === 'en' ? 'Generated Audio:' : 'Generierte Audio:'}
            </h3>
            <audio
              ref={audioRef}
              controls
              src={audioUrl}
              className="w-full"
            >
              {language === 'en' 
                ? 'Your browser does not support the audio element.'
                : 'Ihr Browser unterstützt das Audio-Element nicht.'}
            </audio>
            <div className="mt-2 text-sm text-gray-600">
              {language === 'en' 
                ? `Processed ${currentAudioChunks.length} audio chunks`
                : `${currentAudioChunks.length} Audio-Chunks verarbeitet`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TtsInterface;