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

const supportedLanguages = ['en', 'es'] as const;
type SupportedLanguage = (typeof supportedLanguages)[number];

function getSupportedLanguage(language: string | null): SupportedLanguage | null {
  const languageCode = language?.toLowerCase().split('-')[0];
  return supportedLanguages.find(supportedLanguage => supportedLanguage === languageCode) ?? null;
}

const language =
  getSupportedLanguage(localStorage.getItem(`${environment.localStoragePrefix}language`)) ??
  getSupportedLanguage(navigator.languages?.[0] ?? navigator.language) ??
  'en';

localStorage.setItem(`${environment.localStoragePrefix}language`, language);

if (language === 'es') {
  loadTranslations({
    'index.title': 'El Gato y el Ratón. Juego Multijugador.',
    'index.meta_description':
      'Juega gratis al juego del Gato y el Ratón en un tablero de ajedrez. Juega online con amigos.',
    'index.meta_og_description': 'Juega gratis al Gato y el Ratón con amigos',

    'home.title': 'GATO Y RATON',
    'home.description': 'Juega al gato y el ratón online',
    'home.create_game': 'Crear partida',
    'home.how_to_play': 'Como jugar',
    'home.language': 'Idioma',
    'home.join_game_description': 'Unirse a una partida',
    'home.no_games_available': '0 partidas disponibles',
    'home.game_does_not_exist': 'La partida no existe',
    'home.table.player': 'Jugador',
    'home.table.join': 'Entrar',

    'loading_dialog.connecting': 'Conectando al servidor',
    'loading_dialog.loading': 'Cargando...',

    'select-language.select': 'Selecciona un idioma',

    'play.win': 'Ganaste!',
    'play.lose': 'Perdiste',
    'play.your_turn': 'Tu turno!',
    'play.cat_turn_info': 'Selecciona un gato y muevelo',
    'play.mouse_turn_info': 'Mueve el ratón',
    'play.their_turn': 'Turno del oponente',
    'play.is_thinking': 'esta pensando...',
    'play.how_to_play': 'como jugar',
    'play.exit': 'salir',
    'play.surrender': 'rendirse',
    'play.surrender_question': 'Te rindes?',
    'play.rematch': 'revancha',
    'play.rematch_awaiting': 'Esperando',

    'join.title': 'Entrar a una partida',
    'join.name': 'Tu nombre',
    'join.start_game': 'Empezar',

    'create.title': 'Crear partida',
    'create.name': 'Tu nombre',
    'create.create_game': 'Crear partida',
    'create.awaiting_title': 'Esperando a otro jugador',
    'create.share_link_description': 'Comparte este link para unirse a tu partida',
    'create.copy_link': 'Copiar link',
    'create.copied': 'Copiado!',

    'how_to_play.title': 'Como jugar',
    'how_to_play-introduction_title': 'Introducción',
    'how_to_play-introduction_text_1': 'Al gato y el ratón se juega en un tablero de ajedrez.',
    'how_to_play-introduction_text_2':
      'Se necesitan 5 piezas, 1 blanca para representar al ratón y 4 negras para representar a los gatos.',
    'how_to_play-moving_title': 'Como se mueven las piezas?',
    'how_to_play-moving_text':
      'Todas las piezas se mueven diagonalmente sobre las casillas negras. El ratón puede mover hacia atras mientras que los gatos no pueden.',
    'how_to_play-goal_title': 'Cual es el objetivo?',
    'how_to_play-goal_text':
      'El ratón debe alcanzar la última fila del tablero, mientras que los gatos deben arrinconar al ratón para que no pueda hacer ningun movimiento.',
    'how_to_play-accept_button': 'Entendido!',

    'chat.chat': 'Chat',
    'chat.send': 'Enviar',
    'chat.send_placeholder': 'Envia un mensaje...',
    'chat.player_has_left': 'ha dejado la partida',
    'chat.player_wants_rematch': 'quiere la revancha',
    'chat.player_has_surrendered': 'se ha rendido',
    'chat.player_has_disconnected': 'se ha desconectado',
    'chat.player_has_reconnected': 'se ha reconectado',

    'select_team.select': 'Elige tu equipo',
    'select_team.cats': 'gatos',
    'select_team.mouse': 'ratón',
    'select_team.opponent': 'oponente',

    'button.cancel': 'Cancelar',
    'button.yes': 'Si',

    'error.missing_name': 'Escribe tu nombre',
    'error.missing_team': 'Elige tu equipo',
    'error.error_ocurred': 'Ha ocurrido un error'
  });
}
