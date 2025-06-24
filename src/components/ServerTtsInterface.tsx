'use client';

import React, { useState } from 'react';
import VoiceSelector from './VoiceSelector';
import FileUploader from './FileUploader';
import BatchProcessor from './BatchProcessor';
import AudioDownloader from './AudioDownloader';
import { getTtsApiUrl } from '@/utils/api';

interface ServerTtsInterfaceProps {
  language: 'en' | 'de';
}

const ServerTtsInterface: React.FC<ServerTtsInterfaceProps> = ({ language }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('af_sky');
  const [outputFormat, setOutputFormat] = useState<'wav' | 'mp3'>('wav'); // Default to WAV since HF is default
  const [processingMode, setProcessingMode] = useState<'local' | 'huggingface'>('huggingface');

  // Auto-set WAV format when Hugging Face is selected
  React.useEffect(() => {
    if (processingMode === 'huggingface' && outputFormat === 'mp3') {
      setOutputFormat('wav');
    }
  }, [processingMode, outputFormat]);
  const [audioFiles, setAudioFiles] = useState<Array<{url: string, filename: string, size: number}>>([]);
  const [showBatchProcessor, setShowBatchProcessor] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const convertToSpeech = async () => {
    if (!text.trim()) {
      alert(language === 'en' ? 'Please enter some text' : 'Bitte geben Sie Text ein');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAudioUrl(null);

    try {
      console.log('Sending TTS request to server...');
      
      const response = await fetch(getTtsApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          language: language,
          format: outputFormat,
          processingMode: processingMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'TTS request failed');
      }

      // Get audio data as blob
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      console.log('TTS audio received successfully');

    } catch (error) {
      console.error('TTS request failed:', error);
      setError((error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `tts-${language}-${Date.now()}.${outputFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const clearSession = () => {
    setText('');
    setAudioUrl(null);
    setError(null);
    setAudioFiles([]);
    setShowBatchProcessor(false);
    setBatchProgress(0);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    audioFiles.forEach(file => URL.revokeObjectURL(file.url));
  };

  const handleFileUpload = (fileContent: string) => {
    setText(fileContent);
    setShowBatchProcessor(true);
    setAudioUrl(null);
    setError(null);
  };

  const handleBatchComplete = (files: Array<{url: string, filename: string, size: number}>) => {
    setAudioFiles(files);
    setShowBatchProcessor(false);
    setBatchProgress(100);
  };

  const handleBatchProgress = (progress: number) => {
    setBatchProgress(progress);
  };


  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          {language === 'en' ? 'Server-Side TTS' : 'Server-seitige TTS'}
        </h1>
        <p className="text-gray-600">
          {language === 'en' 
            ? 'Text-to-speech processing handled on the server for better reliability.'
            : 'Text-zu-Sprache-Verarbeitung auf dem Server für bessere Zuverlässigkeit.'}
        </p>
      </div>

      <div className="space-y-6">
        <VoiceSelector
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          language={language}
          disabled={isLoading || showBatchProcessor}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {language === 'en' ? 'Processing Mode:' : 'Verarbeitungsmodus:'}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="local"
                checked={processingMode === 'local'}
                onChange={(e) => setProcessingMode(e.target.value as 'local' | 'huggingface')}
                disabled={isLoading || showBatchProcessor}
                className="mr-2"
              />
              🖥️ {language === 'en' ? 'Local VPS' : 'Lokaler VPS'}
              <span className="text-sm text-gray-500 ml-1">
                ({language === 'en' ? 'CPU, slower' : 'CPU, langsamer'})
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="huggingface"
                checked={processingMode === 'huggingface'}
                onChange={(e) => setProcessingMode(e.target.value as 'local' | 'huggingface')}
                disabled={isLoading || showBatchProcessor}
                className="mr-2"
              />
              🚀 {language === 'en' ? 'Hugging Face' : 'Hugging Face'}
              <span className="text-sm text-gray-500 ml-1">
                ({language === 'en' ? 'Zero GPU, faster' : 'Zero GPU, schneller'})
              </span>
            </label>
          </div>
        </div>


        <FileUploader
          onFileUpload={handleFileUpload}
          language={language}
        />

        <div>
          <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
            {language === 'en' ? 'Enter your text:' : 'Geben Sie Ihren Text ein:'}
          </label>
          <textarea
            id="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
            placeholder={language === 'en' 
              ? 'Enter text to convert to speech or upload a file above...'
              : 'Text eingeben, der in Sprache umgewandelt werden soll, oder Datei oben hochladen...'}
            disabled={isLoading || showBatchProcessor}
            maxLength={showBatchProcessor ? undefined : 500}
          />
          <div className="mt-1 text-sm text-gray-500">
            {showBatchProcessor ? (
              language === 'en' 
                ? `Characters: ${text.length.toLocaleString()} (will be chunked for batch processing)`
                : `Zeichen: ${text.length.toLocaleString()} (wird für Batch-Verarbeitung aufgeteilt)`
            ) : (
              language === 'en' 
                ? `Characters: ${text.length}/500`
                : `Zeichen: ${text.length}/500`
            )}
          </div>
        </div>

        {showBatchProcessor && text.length > 500 ? (
          <BatchProcessor
            text={text}
            voice={selectedVoice}
            language={language}
            outputFormat={outputFormat}
            processingMode={processingMode}
            onComplete={handleBatchComplete}
            onProgress={handleBatchProgress}
          />
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={convertToSpeech}
              disabled={!text.trim() || isLoading || showBatchProcessor}
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
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">
              {language === 'en' ? 'Error: ' : 'Fehler: '}{error}
            </p>
          </div>
        )}

        {audioUrl && !showBatchProcessor && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-lg font-medium text-gray-800 mb-3">
              {language === 'en' ? 'Generated Audio:' : 'Generierte Audio:'}
            </h3>
            <audio
              controls
              src={audioUrl}
              className="w-full"
            >
              {language === 'en' 
                ? 'Your browser does not support the audio element.'
                : 'Ihr Browser unterstützt das Audio-Element nicht.'}
            </audio>
          </div>
        )}

        <AudioDownloader
          audioFiles={audioFiles}
          language={language}
          outputFormat={outputFormat}
          onClear={() => {
            setAudioFiles([]);
            audioFiles.forEach(file => URL.revokeObjectURL(file.url));
          }}
        />



        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-green-800 mb-2">
            {language === 'en' ? '✅ Ready to Use' : '✅ Einsatzbereit'}
          </h3>
          <p className="text-green-700 text-sm">
            {language === 'en' 
              ? 'TTS system is running with local models. The first request may take a moment to initialize, then subsequent requests will be fast.'
              : 'TTS-System läuft mit lokalen Modellen. Die erste Anfrage kann einen Moment dauern, dann werden nachfolgende Anfragen schnell sein.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServerTtsInterface;