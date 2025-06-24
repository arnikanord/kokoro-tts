export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  accent: 'american' | 'british';
  language: 'en';
  description?: string;
}

export const AVAILABLE_VOICES: Voice[] = [
  // American English - Female
  {
    id: 'af_sky',
    name: 'Sky',
    gender: 'female',
    accent: 'american',
    language: 'en',
    description: 'Clear, friendly American female voice'
  },
  {
    id: 'af_bella',
    name: 'Bella',
    gender: 'female',
    accent: 'american', 
    language: 'en',
    description: 'Warm, expressive American female voice'
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    gender: 'female',
    accent: 'american',
    language: 'en',
    description: 'Professional American female voice'
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'american',
    language: 'en',
    description: 'Gentle, conversational American female voice'
  },
  // American English - Male
  {
    id: 'am_adam',
    name: 'Adam',
    gender: 'male',
    accent: 'american',
    language: 'en',
    description: 'Confident American male voice'
  },
  {
    id: 'am_michael',
    name: 'Michael',
    gender: 'male',
    accent: 'american',
    language: 'en',
    description: 'Deep, authoritative American male voice'
  },
  // British English - Female
  {
    id: 'bf_emma',
    name: 'Emma',
    gender: 'female',
    accent: 'british',
    language: 'en',
    description: 'Elegant British female voice'
  },
  {
    id: 'bf_isabella',
    name: 'Isabella',
    gender: 'female',
    accent: 'british',
    language: 'en',
    description: 'Sophisticated British female voice'
  },
  // British English - Male
  {
    id: 'bm_george',
    name: 'George',
    gender: 'male',
    accent: 'british',
    language: 'en',
    description: 'Distinguished British male voice'
  },
  {
    id: 'bm_lewis',
    name: 'Lewis',
    gender: 'male',
    accent: 'british',
    language: 'en',
    description: 'Clear, articulate British male voice'
  }
];

export const getVoicesByCategory = () => {
  const categories = {
    american_female: AVAILABLE_VOICES.filter(v => v.accent === 'american' && v.gender === 'female'),
    american_male: AVAILABLE_VOICES.filter(v => v.accent === 'american' && v.gender === 'male'),
    british_female: AVAILABLE_VOICES.filter(v => v.accent === 'british' && v.gender === 'female'),
    british_male: AVAILABLE_VOICES.filter(v => v.accent === 'british' && v.gender === 'male')
  };
  
  return categories;
};