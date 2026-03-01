# Native modules (iOS) – TurboModule crash isolatie

Lijst van alle dependencies met **native iOS-code** (TurboModules / native modules). Puur JS-packages zijn weggelaten.

## Bronnen
- `package.json` dependencies
- `app.json` plugins (nu leeg na uitschakelen expo-notifications)

---

## Lijst native modules

| Package | Gebruikt bij launch? | Expliciet aangeroepen? | Opmerking |
|--------|------------------------|------------------------|-----------|
| **expo** | Ja (core) | Nee | Runtime, native bridge. |
| **expo-notifications** | Mogelijk (registratie) | Nee (uitgeschakeld in code) | **Verdacht.** Staat nog in package.json → native code wordt gelinkt. Uitgeschakeld in code + plugin verwijderd; crash bleef. |
| **expo-constants** | Mogelijk (Constants.*) | Alleen in settings.tsx (lazy) | TurboModule; kan door andere Expo-packages bij init gelezen worden. |
| **expo-linear-gradient** | **Ja** | Ja | **Eerste frame:** `BackgroundLayer` in root layout gebruikt LinearGradient. |
| **expo-blur** | Onbekend | **Nee** | Niet geïmporteerd; wel in package.json → native code gelinkt. |
| **expo-linking** | Mogelijk (deep links) | Nee (lazy) | Native module. |
| **expo-status-bar** | Mogelijk bij eerste StatusBar | Nee in onze root | Native. |
| **expo-router** | Ja | Ja (Slot in _layout) | Gebruikt react-native-screens (en optioneel reanimated). |
| **react-native** | Ja | Ja | Core. |
| **react-native-reanimated** | Mogelijk (bootstrap) | **Nee** (we gebruiken RN Animated) | Optionele dep van expo-router. Kan bij start initialiseren. **Verdacht.** |
| **react-native-screens** | **Ja** | Ja (via expo-router) | Native stack; eerste scherm. |
| **react-native-safe-area-context** | **Ja** | Ja | **Eerste frame:** SafeAreaProvider in root _layout. |
| **react-native-webview** | Onbekend | **Nee** | Niet geïmporteerd; wel in package.json → native code gelinkt. |
| **@react-native-async-storage/async-storage** | Vroeg | Ja | LanguageProvider (root) roept getStoredLanguage() → AsyncStorage in useEffect. |

---

## Modules die bij launch initialiseren (zonder expliciete aanroep in onze code)

- **expo-notifications** – Native module wordt gelinkt; kan bij app start geregistreerd worden.
- **expo-constants** – Wordt vaak door Expo-runtime of andere packages bij init gelezen.
- **react-native-reanimated** – Heeft native bootstrap; optioneel voor expo-router maar wel geïnstalleerd.
- **expo-blur** / **react-native-webview** – In package.json, niet geïmporteerd; toch gelinkt, dus kunnen bij module-load getriggerd worden.

---

## Volgorde uitschakelen (meest verdacht eerst)

1. ~~**expo-notifications**~~ – **Gedaan:** uit package.json verwijderd + eerder al uit code/app.json gehaald.
2. ~~**react-native-reanimated**~~ – **Gedaan:** uit package.json verwijderd; `babel.config.js` plugin verwijderd.
3. **expo-constants** – Stubben of vervangen waar gebruikt (settings.tsx).
4. **expo-blur** – Verwijderen uit package.json (niet geïmporteerd).
5. **react-native-webview** – Verwijderen uit package.json (niet geïmporteerd).
6. **expo-linear-gradient** – Tijdelijk uit BackgroundLayer/layout halen (eerste frame).
7. **react-native-safe-area-context** – Tijdelijk vervangen door gewone View (eerste frame).
8. **@react-native-async-storage/async-storage** – Niet op launch; pas na eerste render (LanguageProvider useEffect).

---

## Batch uitgeschakeld (TurboModule-isolatie)

Deze packages zijn in één keer uit `package.json` gehaald; code die ze gebruikte is gestubd of vervangen:

| Package | Actie | Trade-off |
|--------|--------|-----------|
| **expo-blur** | Verwijderd | Geen: werd nergens geïmporteerd. |
| **react-native-webview** | Verwijderd | Geen: werd nergens geïmporteerd. |
| **expo-constants** | Verwijderd; versie uit `@/src/config/constants` (APP_VERSION) | Settings toont vaste "1.0.0"; wijzig bij release handmatig in `constants.ts`. |
| **expo-linking** | Verwijderd | Geen: werd nergens geïmporteerd. Deep links werken niet tot we weer linken. |
| **expo-status-bar** | Verwijderd | Geen expliciete StatusBar in onze code; systeem statusbalk blijft standaard. |

---

## Na deze wijzigingen

- `npm install` (of `pnpm install`) uitvoeren om lockfile bij te werken.
- Nieuwe iOS-build maken en via TestFlight testen.
- Als de crash **blijft**: volgende kandidaat uitschakelen (expo-blur of react-native-webview).
