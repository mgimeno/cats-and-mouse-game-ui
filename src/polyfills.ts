/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
import '@angular/localize/init';
/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into browser polyfills and application imports that should be loaded before
 * your main file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes Safari >= 10, Chrome >= 55 (including Opera),
 * Edge >= 13 on the desktop, and iOS 10 and Chrome on mobile.
 *
 * Learn more in https://angular.io/guide/browser-support
 */

import { loadTranslations } from '@angular/localize';
import { environment } from './environments/environment';
import { getSupportedLanguage, translationsByLanguage, type SupportedLanguage } from './translations';

function getBrowserSupportedLanguage(): SupportedLanguage | null {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const browserLanguage of browserLanguages) {
    const supportedLanguage = getSupportedLanguage(browserLanguage);
    if (supportedLanguage) {
      return supportedLanguage;
    }
  }

  return null;
}

const languageLocalStorageKey = `${environment.localStoragePrefix}language`;
const language =
  getSupportedLanguage(localStorage.getItem(languageLocalStorageKey)) ?? getBrowserSupportedLanguage() ?? 'en';

localStorage.setItem(languageLocalStorageKey, language);
document.documentElement.lang = language;

const translations = translationsByLanguage[language];
if (translations) {
  loadTranslations(translations);
}
