'use client';

import React, { useState } from 'react';
import { AVAILABLE_VOICES, getVoicesByCategory, Voice } from '@/types/voices';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  language: 'en' | 'de';
  disabled?: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ 
  selectedVoice, 
  onVoiceChange, 
  language, 
  disabled = false 
}) => {
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('simple');
  const categories = getVoicesByCategory();

  const getVoiceDisplayName = (voice: Voice) => {
    const accentLabel = language === 'en' 
      ? (voice.accent === 'american' ? 'American' : 'British')
      : (voice.accent === 'american' ? 'Amerikanisch' : 'Britisch');
    
    const genderLabel = language === 'en'
      ? (voice.gender === 'female' ? 'Female' : 'Male')
      : (voice.gender === 'female' ? 'Weiblich' : 'Männlich');

    return `${voice.name} (${accentLabel} ${genderLabel})`;
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      american_female: language === 'en' ? 'American Female' : 'Amerikanisch Weiblich',
      american_male: language === 'en' ? 'American Male' : 'Amerikanisch Männlich', 
      british_female: language === 'en' ? 'British Female' : 'Britisch Weiblich',
      british_male: language === 'en' ? 'British Male' : 'Britisch Männlich'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const selectedVoiceInfo = AVAILABLE_VOICES.find(v => v.id === selectedVoice);

  if (viewMode === 'simple') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            {language === 'en' ? 'Voice:' : 'Stimme:'}
          </label>
          <button
            onClick={() => setViewMode('detailed')}
            className="text-xs text-blue-600 hover:text-blue-800"
            disabled={disabled}
          >
            {language === 'en' ? 'View All Voices' : 'Alle Stimmen anzeigen'}
          </button>
        </div>
        
        <select
          value={selectedVoice}
          onChange={(e) => onVoiceChange(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={disabled}
        >
          {AVAILABLE_VOICES.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {getVoiceDisplayName(voice)}
            </option>
          ))}
        </select>
        
        {selectedVoiceInfo && (
          <p className="text-xs text-gray-600">
            {selectedVoiceInfo.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {language === 'en' ? 'Select Voice:' : 'Stimme auswählen:'}
        </label>
        <button
          onClick={() => setViewMode('simple')}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={disabled}
        >
          {language === 'en' ? 'Simple View' : 'Einfache Ansicht'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(categories).map(([categoryKey, voices]) => (
          <div key={categoryKey} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-1">
              {getCategoryLabel(categoryKey)}
            </h3>
            <div className="space-y-1">
              {voices.map((voice) => (
                <label 
                  key={voice.id}
                  className={`flex items-start p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedVoice === voice.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="voice"
                    value={voice.id}
                    checked={selectedVoice === voice.id}
                    onChange={(e) => onVoiceChange(e.target.value)}
                    className="mt-1 text-blue-600"
                    disabled={disabled}
                  />
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {voice.name}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {voice.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
        <div className="flex items-start">
          <div className="text-blue-600 mr-2">ℹ️</div>
          <div className="text-xs text-blue-800">
            <strong>
              {language === 'en' ? 'Voice Quality Tips:' : 'Tipps zur Sprachqualität:'}
            </strong>
            <br />
            {language === 'en' 
              ? 'For best results, use sentences of 10-200 words. Very short or very long texts may affect voice quality.'
              : 'Für beste Ergebnisse verwenden Sie Sätze von 10-200 Wörtern. Sehr kurze oder sehr lange Texte können die Sprachqualität beeinträchtigen.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSelector;