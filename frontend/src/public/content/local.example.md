# Der Quelltext des Manifests — wo er hingehört

Der polnische Quelltext wird **nicht** mitversioniert. Er liegt in

```
frontend/src/public/content/local/text.ts
```

und dieser Ordner steht in `.gitignore`. Fehlt er, baut die Seite trotzdem und
zeigt an seiner Stelle die sichtbaren Lücken aus Abschnitt 7 des Auftrags.

## Die Form

```ts
import type { LocalText } from '../localText';

const text: LocalText = {
  pl: {
    'manifest.opening.lead': '…',
    'manifest.mission.body': '…'
    // usw.
  },
  de: { /* dieselben Schlüssel, übersetzt */ },
  en: { /* dieselben Schlüssel, übersetzt */ }
};

export default text;
```

## Die elf Schlüssel

Genau diese Stellen stehen in den versionierten Texten als `{ source: … }` und
warten auf den Quelltext:

| Schlüssel | Abschnitt im Auftrag |
|---|---|
| `manifest.opening.lead` | 4.1 (1) Eröffnung |
| `manifest.mission.body` | 4.1 (2) Auftrag |
| `manifest.areas.items.0.body` | 4.1 (3) Geistliches Leben und Glaube |
| `manifest.areas.items.1.body` | 4.1 (3) Familie |
| `manifest.areas.items.2.body` | 4.1 (3) Kinder und Jugendliche |
| `manifest.areas.items.3.body` | 4.1 (3) Bildung |
| `manifest.areas.items.4.body` | 4.1 (3) Gesundheit und integrale Entwicklung |
| `manifest.areas.items.5.body` | 4.1 (3) Wallfahrt, Sport und Abenteuer |
| `manifest.inspiration.body` | 4.1 (4) Christliche Inspiration und Offenheit |
| `manifest.family.body` | 4.1 (5) In einer Familie verwurzelt |
| `manifest.road.intro` | 4.1 (6) Wohin das führt |

Ein Schlüssel, der ins Leere zeigt, wird beim Start in der Konsole gemeldet —
still verworfen wird keiner.

## Was NICHT hierher gehört

Die übrigen Lücken sind keine Quelltexte, sondern **Entscheidungen**: Namen,
Anschrift, Eröffnungstermin, Preise, Bilder. Sie stehen als `{ missing: … }` in
den versionierten Texten und werden dort ersetzt, sobald sie feststehen — sie
sind keine Geheimnisse und gehören in die Versionsverwaltung.
