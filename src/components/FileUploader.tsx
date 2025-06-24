'use client';

import React, { useState, useRef } from 'react';

interface FileUploaderProps {
  onFileUpload: (content: string, filename?: string) => void;
  language: 'en' | 'de';
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, language, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileRead = async (file: File) => {
    setIsProcessing(true);
    
    try {
      console.log('Reading file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Check if file is actually readable
      if (file.size === 0) {
        alert(language === 'en' ? 'File is empty.' : 'Datei ist leer.');
        return;
      }
      
      const text = await file.text();
      console.log('File read successfully, text length:', text.length);
      
      // Validate file size (max 10MB for text files)
      if (text.length > 10 * 1024 * 1024) {
        alert(language === 'en' 
          ? 'File is too large. Maximum size is 10MB.' 
          : 'Datei ist zu groß. Maximale Größe ist 10MB.');
        return;
      }

      // Clean up the text
      const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
      
      if (cleanText.length === 0) {
        alert(language === 'en' ? 'File is empty.' : 'Datei ist leer.');
        return;
      }

      onFileUpload(cleanText, file.name);
    } catch (error) {
      console.error('Error reading file:', error);
      alert(language === 'en' 
        ? 'Error reading file. Please make sure it\'s a valid text file.' 
        : 'Fehler beim Lesen der Datei. Stellen Sie sicher, dass es eine gültige Textdatei ist.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = Array.from(e.dataTransfer.files);
    const textFile = files.find(file => {
      const name = file.name.toLowerCase();
      const isTextType = file.type === 'text/plain' || 
                        file.type === 'text/markdown' || 
                        file.type === '' || // Some systems don't set MIME type
                        file.type.startsWith('text/');
      const hasTextExtension = name.endsWith('.txt') || 
                              name.endsWith('.md') || 
                              name.endsWith('.markdown');
      return isTextType || hasTextExtension;
    });
    
    if (textFile) {
      handleFileRead(textFile);
    } else {
      alert(language === 'en' 
        ? 'Please upload a text file (.txt or .md)' 
        : 'Bitte laden Sie eine Textdatei hoch (.txt oder .md)');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected via input:', file.name, file.type, file.size);
      // Validate file type before processing
      const name = file.name.toLowerCase();
      const isValidFile = file.type === 'text/plain' || 
                         file.type === 'text/markdown' || 
                         file.type === '' || 
                         file.type.startsWith('text/') ||
                         name.endsWith('.txt') || 
                         name.endsWith('.md') || 
                         name.endsWith('.markdown');
      
      if (isValidFile) {
        handleFileRead(file);
      } else {
        alert(language === 'en' 
          ? `Invalid file type: ${file.type}. Please upload a text file (.txt or .md)` 
          : `Ungültiger Dateityp: ${file.type}. Bitte laden Sie eine Textdatei hoch (.txt oder .md)`);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        {language === 'en' ? 'Upload Text File:' : 'Textdatei hochladen:'}
      </label>
      
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isProcessing}
        />
        
        {isProcessing ? (
          <div className="space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600">
              {language === 'en' ? 'Processing file...' : 'Datei wird verarbeitet...'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-gray-400 mx-auto w-12 h-12">
              📄
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {language === 'en' 
                  ? 'Click to upload or drag and drop' 
                  : 'Klicken zum Hochladen oder per Drag & Drop'}
              </p>
              <p className="text-xs text-gray-500">
                {language === 'en' 
                  ? 'TXT or MD files up to 10MB' 
                  : 'TXT oder MD Dateien bis zu 10MB'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div className="flex items-start">
          <div className="text-yellow-600 mr-2">⚡</div>
          <div className="text-xs text-yellow-800">
            <strong>
              {language === 'en' ? 'Large File Processing:' : 'Große Datei-Verarbeitung:'}
            </strong>
            <br />
            {language === 'en' 
              ? 'Large files will be automatically split into chunks and processed as separate audio files for optimal quality and manageable file sizes.'
              : 'Große Dateien werden automatisch in Chunks aufgeteilt und als separate Audiodateien verarbeitet für optimale Qualität und handhabbare Dateigrößen.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;