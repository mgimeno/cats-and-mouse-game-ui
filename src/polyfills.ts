/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
import '@angular/localize/init';
/**
 * This file includes polyfills needed by Angular and is loaded before the app.
 * You can add your own extra polyfills to this file.
 *
 * This file is divided into 2 sections:
 *   1. Browser polyfills. These are applied before loading ZoneJS and are sorted by browsers.
 *   2. Application imports. Files imported after ZoneJS that should be loaded before your main
 *      file.
 *
 * The current setup is for so-called "evergreen" browsers; the last versions of browsers that
 * automatically update themselves. This includes Safari >= 10, Chrome >= 55 (including Opera),
 * Edge >= 13 on the desktop, and iOS 10 and Chrome on mobile.
 *
 * Learn more in https://angular.io/guide/browser-support
 */

import { loadTranslations } from '@angular/localize';

let language = "en";

if (localStorage.getItem(`${environment.localStoragePrefix}language`)) {
    language = localStorage.getItem(`${environment.localStoragePrefix}language`);
}
else {
    language = navigator.language.substring(0, 2);
}

language = language.toLowerCase();

localStorage.setItem(`${environment.localStoragePrefix}language`, language);

if (language == "es") {

    loadTranslations({

        'index.title': 'El Gato y el Ratón. Juego Multijugador.',
        'index.meta_description': 'Juega gratis al juego del Gato y el Ratón en un tablero de ajedrez. Juega online con amigos.',
        'index.meta_og_description': 'Juega gratis al Gato y el Ratón con amigos',

        'home.title': 'GATO Y RATON',
        'home.description': 'Juega al gato y el ratón gratis',
        'home.create_game': 'Crear partida',
        'home.how_to_play': 'Como jugar',
        'home.language': 'Idioma',
        'home.join_game_description': 'Unirse a una partida',
        'home.no_games_available': '0 partidas disponibles',
        'home.table.player': 'Jugador',
        'home.table.join': 'Entrar',

        'loading_dialog.connecting': 'Conectando al servidor',
        'loading_dialog.loading': 'Cargando...',

        'select-language.select': 'Selecciona un idioma',

        'page-not-found.not-found': '404 - Página no encontrada',
        'page-not-found.back': 'Volver',

        'play.win': 'Ganaste!',
        'play.lose': 'Perdiste',
        'play.your_turn': 'Tu turno!',
        'play.cat_turn_info': 'Selecciona un gato y muevelo',
        'play.mouse_turn_info': 'Mueve el ratón',
        'play.their_turn': 'Turno del oponente',
        'play.is_thinking': 'esta pensando...',
        'play.how_to_play': 'como jugar',
        'play.exit_game': 'salir',
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
        'how_to_play-introduction_text_2': 'Se necesitan 5 piezas, 1 blanca para representar al ratón y 4 negras para representar a los gatos.',
        'how_to_play-moving_title': 'Como se mueven las piezas?',
        'how_to_play-moving_text': 'Todas las piezas se mueven diagonalmente sobre las casillas negras. El ratón puede mover hacia atras mientras que los gatos no pueden.',
        'how_to_play-goal_title': 'Cual es el objetivo?',
        'how_to_play-goal_text': 'El ratón debe alcanzar la última fila del tablero, mientras que los gatos deben arrinconar al ratón para que no pueda hacer ningun movimiento.',
        'how_to_play-accept_button': 'Entendido!',

        'chat.chat': 'Chat',
        'chat.send': 'Enviar',
        'chat.send_placeholder': 'Envia un mensaje...',
        'chat.player_has_left': 'ha dejado la partida.',
        'chat.player_wants_rematch': 'quiere la revancha.',
        'chat.player_has_surrendered': 'se ha rendido.',
        'chat.player_has_disconnected': 'se ha desconectado.',
        'chat.player_has_reconnected': 'se ha reconectado.',

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

/***************************************************************************************************
 * BROWSER POLYFILLS
 */

/** IE10 and IE11 requires the following for NgClass support on SVG elements */
// import 'classlist.js';  // Run `npm install --save classlist.js`.

/**
 * Web Animations `@angular/platform-browser/animations`
 * Only required if AnimationBuilder is used within the application and using IE/Edge or Safari.
 * Standard animation support in Angular DOES NOT require any polyfills (as of Angular 6.0).
 */
// import 'web-animations-js';  // Run `npm install --save web-animations-js`.

/**
 * By default, zone.js will patch all possible macroTask and DomEvents
 * user can disable parts of macroTask/DomEvents patch by setting following flags
 * because those flags need to be set before `zone.js` being loaded, and webpack
 * will put import in the top of bundle, so user need to create a separate file
 * in this directory (for example: zone-flags.ts), and put the following flags
 * into that file, and then add the following code before importing zone.js.
 * import './zone-flags.ts';
 *
 * The flags allowed in zone-flags.ts are listed here.
 *
 * The following flags will work for all browsers.
 *
 * (window as any).__Zone_disable_requestAnimationFrame = true; // disable patch requestAnimationFrame
 * (window as any).__Zone_disable_on_property = true; // disable patch onProperty such as onclick
 * (window as any).__zone_symbol__UNPATCHED_EVENTS = ['scroll', 'mousemove']; // disable patch specified eventNames
 *
 *  in IE/Edge developer tools, the addEventListener will also be wrapped by zone.js
 *  with the following flag, it will bypass `zone.js` patch for IE/Edge
 *
 *  (window as any).__Zone_enable_cross_context_check = true;
 *
 */

/***************************************************************************************************
 * Zone JS is required by default for Angular itself.
 */
import 'zone.js/dist/zone';  // Included with Angular CLI.
import { environment } from './environments/environment';


/***************************************************************************************************
 * APPLICATION IMPORTS
 */
