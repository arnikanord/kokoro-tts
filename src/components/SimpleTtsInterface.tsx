'use client';

import React, { useState, useEffect } from 'react';

interface SimpleTtsInterfaceProps {
  language: 'en' | 'de';
}

const SimpleTtsInterface: React.FC<SimpleTtsInterfaceProps> = ({ language }) => {
  const [text, setText] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [kokoroTTS, setKokoroTTS] = useState<any>(null);
  const [initError, setInitError] = useState<string | null>(null);

  // Initialize Kokoro TTS
  useEffect(() => {
    const initKokoro = async () => {
      try {
        console.log('Starting Kokoro TTS initialization...');
        setIsInitializing(true);
        setInitError(null);
        
        // Try to import Kokoro.js
        const kokoroModule = await import('kokoro-js');
        console.log('Kokoro module imported successfully');
        
        const { KokoroTTS } = kokoroModule;
        
        // This will download the model files (~50MB)
        console.log('Loading TTS model (this may take a while for first time)...');
        const tts = await KokoroTTS.from_pretrained(
          "onnx-community/Kokoro-82M-ONNX",
          { dtype: "q8" }
        );
        
        console.log('Kokoro TTS initialized successfully');
        setKokoroTTS(tts);
        setIsInitializing(false);
      } catch (error) {
        console.error('Failed to initialize Kokoro TTS:', error);
        setInitError((error as Error).message);
        setIsInitializing(false);
      }
    };

    if (typeof window !== 'undefined') {
      initKokoro();
    }
  }, []);

  const convertToSpeech = async () => {
    if (!text.trim()) {
      alert(language === 'en' ? 'Please enter some text' : 'Bitte geben Sie Text ein');
      return;
    }

    if (!kokoroTTS) {
      alert(language === 'en' ? 'TTS engine not ready' : 'TTS-Engine nicht bereit');
      return;
    }

    setIsLoading(true);
    setAudioUrl(null);

    try {
      console.log('Generating speech for:', text.substring(0, 50) + '...');
      
      // Use a simple text, don't chunk for now
      const audio = await kokoroTTS.generate(text.substring(0, 500), { 
        voice: language === 'en' ? 'af_sky' : 'af_sky' 
      });
      
      console.log('Audio generated:', audio);
      
      // Handle the audio data
      let audioData;
      if (audio instanceof Uint8Array || audio instanceof ArrayBuffer) {
        audioData = audio;
      } else if (audio.buffer) {
        audioData = audio.buffer;
      } else if (audio.data) {
        audioData = audio.data;
      } else if (audio.audio) {
        audioData = audio.audio;
      } else {
        // Try to find any buffer-like property
        const bufferProps = Object.keys(audio).filter(key => 
          audio[key] instanceof ArrayBuffer || audio[key] instanceof Uint8Array
        );
        if (bufferProps.length > 0) {
          audioData = audio[bufferProps[0]];
        } else {
          throw new Error('Could not find audio data in response');
        }
      }
      
      console.log('Audio data extracted:', audioData);
      
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      
    } catch (error) {
      console.error('TTS generation failed:', error);
      alert(`TTS failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (initError) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-xl font-bold text-red-800 mb-4">
          {language === 'en' ? 'TTS Initialization Failed' : 'TTS-Initialisierung fehlgeschlagen'}
        </h2>
        <p className="text-red-600 mb-4">{initError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          {language === 'en' ? 'Retry' : 'Erneut versuchen'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6">
        {language === 'en' ? 'Simple TTS Test' : 'Einfacher TTS-Test'}
      </h1>
      
      {isInitializing ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {language === 'en' 
              ? 'Initializing TTS engine... This may take a minute on first load.'
              : 'TTS-Engine wird initialisiert... Dies kann beim ersten Laden eine Minute dauern.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={language === 'en' ? 'Enter text to convert...' : 'Text eingeben...'}
            className="w-full h-32 p-3 border rounded-md"
            maxLength={500}
          />
          
          <button
            onClick={convertToSpeech}
            disabled={isLoading || !kokoroTTS}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                {language === 'en' ? 'Converting...' : 'Konvertiere...'}
              </>
            ) : (
              language === 'en' ? 'Convert to Speech' : 'In Sprache umwandeln'
            )}
          </button>
          
          {audioUrl && (
            <div className="mt-4">
              <audio controls src={audioUrl} className="w-full">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SimpleTtsInterface;