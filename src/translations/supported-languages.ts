export const supportedLanguages = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export interface LanguageOption {
  readonly code: SupportedLanguage;
  readonly name: string;
  readonly flagAlt: string;
}

export const languageOptions: readonly LanguageOption[] = [
  { code: 'en', name: 'English', flagAlt: 'United Kingdom flag' },
  { code: 'es', name: 'Español', flagAlt: 'Spain flag' },
  { code: 'de', name: 'Deutsch', flagAlt: 'Germany flag' },
  { code: 'fr', name: 'Français', flagAlt: 'France flag' },
  { code: 'it', name: 'Italiano', flagAlt: 'Italy flag' },
  { code: 'pt', name: 'Português', flagAlt: 'Portugal flag' }
];

export const localeByLanguage: Record<SupportedLanguage, string> = {
  en: 'en_GB',
  es: 'es_ES',
  de: 'de_DE',
  fr: 'fr_FR',
  it: 'it_IT',
  pt: 'pt_PT'
};

export function getSupportedLanguage(language: string | null | undefined): SupportedLanguage | null {
  const languageCode = language?.toLowerCase().split('-')[0];
  return supportedLanguages.find(supportedLanguage => supportedLanguage === languageCode) ?? null;
}
