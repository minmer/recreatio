# Referenzkopien — Quellmaterial für den Neuaufbau

**Diese Dateien werden nicht gebaut, nicht getestet und nicht ausgeliefert.**

Sie liegen bewusst außerhalb von `backend/Recreatio.Api/` und `frontend/src/`, damit
weder das .NET-SDK noch `tsc` (`include: ["src"]`) sie erfasst. Es sind Kopien des
Altbestands zum Nachschlagen beim Neuaufbau — kein Parallelbetrieb, keine
Zwischenschicht, die beide Fassungen bedient (Spezifikation 2.1).

## Was hier liegt

| Ordner | Herkunft | Wofür |
|---|---|---|
| `backend/events/` | `Data/Events`, `Endpoints/Events` | Das zusammensetzbare Veranstaltungsmodell. Das Teilesystem (`definePart`) ist die beste Abstraktion des Altbestands und soll den Neuaufbau prägen (14.4, MD05). |
| `backend/parish/` | `Data/Parish`, `Endpoints/Parish` | Rollenhierarchie, Firmung, Messen, Intentionen. 20 Entitäten, 7.730 Zeilen Endpunkte. |
| `backend/cogita-graph/` | `Data/Cogita/Cogita*Graph*.cs` | Sammlungs- und Abhängigkeitsgraph. |
| `frontend/events/` | `pages/events` | Teile-Registry, Renderer, Editoren. |
| `frontend/parish/` | `pages/parish` | Enthält `ParishPage.tsx` mit 13.525 Zeilen. |
| `frontend/cogita-graph/` | Workspace `collection` und `dependency` | React-Flow-Editoren. |
| `docs/cogita-graph.md` | Wurzelverzeichnis | Architekturbeschreibung des Graphen. |

## Was hier ausdrücklich **nicht** liegt

Limanowa, Rowerowa, EDK, Pilgrimage, Forms und die alte Veranstaltungs-Generation.
Sie sind alt, und 14.4.1 verwirft die alte Generation ohne Übernahme: kein
Datenmodell, keine Endpunkte, keine Oberflächenteile, keine Hilfsfunktionen
„für den Übergang".

## Wie damit umzugehen ist

Diese Kopien sind **Quellmaterial, kein Startpunkt**. Was übernommen wird, wird
neu geschrieben und erfüllt dabei dieselben Regeln wie alles andere:

- Kernel-Autorisierung (3.6) statt eigener Auswertungslogik
- AAD-Konvention (3.13) an jeder verschlüsselten Hülle
- Feldklassifikation (12.9) — besonders bei Teilnehmerkarten
- ein Token-Baustein (10.3.1) statt eigener Tokens
- Eigentümer-Modell (Kapitel 6) statt kopierter Stammdaten

Wo eine Stelle beim Nachschlagen übernommen wird, gehört ein Verweis auf die
Herkunft in den neuen Code — damit später nachvollziehbar bleibt, woher ein
Gedanke stammt.

**Der Ordner wird gelöscht, sobald der Neuaufbau die jeweilige Fachlichkeit
abgelöst hat.** Er ist eine Leiter, kein Fundament.
