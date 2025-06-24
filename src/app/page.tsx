'use client';

import { useEffect, useState } from 'react';
import ServerTtsInterface from '@/components/ServerTtsInterface';

export default function Home() {
  const [language, setLanguage] = useState<'en' | 'de'>('en');
  const [isClient, setIsClient] = useState(false);

  // Detect language from hostname in browser
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('algoran.de')) {
        setLanguage('de');
      } else {
        setLanguage('en');
      }
    }
  }, []);

  // Prevent hydration mismatch by showing a loading state until client is ready
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-4 mb-4">
              <h1 className="text-4xl font-bold text-gray-800">
                Kokoro TTS
              </h1>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 text-white">
                  EN
                </button>
                <button className="px-3 py-1 rounded bg-gray-200 text-gray-700">
                  DE
                </button>
              </div>
            </div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Convert any text to high-quality speech using AI. Perfect for audiobooks, articles, and long-form content.
            </p>
          </div>
          
          <ServerTtsInterface language="en" />
          
          <footer className="mt-12 text-center text-gray-500 text-sm">
            <p>
              Powered by Kokoro TTS • Built for Algoran
            </p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-gray-800">
              {language === 'en' ? 'Kokoro TTS' : 'Kokoro TTS'}
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1 rounded ${
                  language === 'en' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('de')}
                className={`px-3 py-1 rounded ${
                  language === 'de' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                DE
              </button>
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {language === 'en' 
              ? 'Convert any text to high-quality speech using AI. Perfect for audiobooks, articles, and long-form content.'
              : 'Konvertieren Sie jeden Text mit KI in hochwertige Sprache. Perfekt für Hörbücher, Artikel und lange Inhalte.'}
          </p>
        </div>
        
        <ServerTtsInterface language={language} />
        
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>
            {language === 'en' 
              ? 'Powered by Kokoro TTS • Built for Algoran'
              : 'Angetrieben von Kokoro TTS • Entwickelt für Algoran'}
          </p>
        </footer>
      </div>
    </div>
  );
}
