import { deTranslations } from './de';
import { esTranslations } from './es';
import { frTranslations } from './fr';
import { itTranslations } from './it';
import { ptTranslations } from './pt';
import { type SupportedLanguage } from './supported-languages';
import { type TranslationMap } from './translation-map';

export {
  getSupportedLanguage,
  languageOptions,
  localeByLanguage,
  supportedLanguages,
  type SupportedLanguage
} from './supported-languages';

export const translationsByLanguage: Partial<Record<SupportedLanguage, TranslationMap>> = {
  es: esTranslations,
  de: deTranslations,
  fr: frTranslations,
  it: itTranslations,
  pt: ptTranslations
};
