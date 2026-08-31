# `content/local/` — was hier liegt und was nicht mitversioniert wird

Dieser Ordner steht in `.gitignore`. Er enthält heute:

- `01_Karta_zalozen_Fundacja_reCreatio.docx` / `.pdf`
- `02_Statut_Fundacji_reCreatio.docx` / `.pdf`

Das sind **interne Rechtsunterlagen**: Namen der Gründer, PESEL-Anforderungen,
eine private Anschrift, Beträge, die Zustimmung des Ordinarius, Nachfolgeregeln.
Nichts davon gehört auf die Seite, und nichts davon gehört in die
Versionsverwaltung.

Aus ihnen stammen die Absätze des Manifests — aber nur, was den **Zweck**
betrifft. Der abgeleitete öffentliche Text steht in `pl.ts`, `de.ts`, `en.ts`
und wird mitversioniert: er ist für die Öffentlichkeit bestimmt, und ohne ihn
liesse sich die Seite aus einem frischen Klon nicht bauen.

## Der Übersteuerungsweg

`localText.ts` kann jeden Textpfad aus einer Datei `local/*.ts` ersetzen:

```ts
import type { LocalText } from '../localText';

const text: LocalText = {
  pl: { 'manifest.mission.body': '…' },
  de: { 'manifest.mission.body': '…' },
  en: { 'manifest.mission.body': '…' }
};

export default text;
```

Fehlt der Ordner, baut die Seite und zeigt den versionierten Text. Ein
Schlüssel, der ins Leere zeigt, wird beim Start in der Konsole gemeldet — still
verworfen wird keiner.

**Derzeit wird der Weg nicht gebraucht**: es gibt keine `{ source: … }`-Lücke
mehr. Er bleibt für den Fall, dass ein Absatz einmal nicht in die
Versionsverwaltung soll.

## Die offenen Entscheidungen

Was als `{ missing: … }` in den versionierten Texten steht, sind **keine**
Geheimnisse, sondern Entscheidungen: Namen und ihre Freigabe, die Anschrift des
Hauses, die genaue Platzzahl, Bilder, der Eröffnungstermin. Bei Namen und
Anschrift stehen die Angaben in den Unterlagen oben — sie bleiben trotzdem
offen, weil die Entscheidung über ihre Veröffentlichung dem Eigentümer gehört
und nicht daraus folgt, dass die Tatsache bekannt ist.
