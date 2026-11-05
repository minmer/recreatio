# Wspólnoty — geführte Einrichtung von Gemeinschaften (0137)

Stand: 2026-11-05. Code: `frontend/src/app/communities/`, Dienst `backend/Api/Areas/Area.Setup.cs`, Migration `0137_area_setup.sql`.
(Die im Auftrag vorgeschlagene Notiz `docs/gemeinschaften-notizen.md` steht hier: `docs/` ist der ausgelieferte Site-Build.)

## 1. Bestandsaufnahme

| Baustein | vorhanden | vorhanden, aber schwer erreichbar | fehlte → jetzt gebaut |
|---|---|---|---|
| Einheit | Bereich mit `parent_area_id`, beliebig tief (0035); Art (Profil 0133: event/group/organisation/course/school/class) | Baum nur als eingerückte Liste in „Obszary“; Anlegen eines Unterbereichs Bereich für Bereich | **Umhängen** (`POST /workspace/area/{id}/parent`, mit Kreis-Prüfung); Baum als Karte (React Flow) und Liste |
| Position | Rolle eines Bereichs mit Stufe read/write/admin (Area-JSON `roles`), Rollen halten Rollen (0091), Schreiben als Rolle | Rechte nach unten, Begleitung, Gremien musste man Bereich für Bereich von Hand verteilen | **Positionen einmal definiert**, fünf Rechte-Stufen → Zugänge aus dem Baum berechnet (`desiredAccess`): Leitung admin unten, Begleitung read unten, „niżej widzą tę“, Gremien aus der Besetzung |
| Person / Link | Link = Rolle, die Rollen hält (0091); ohne Konto lesen/handeln (`Callers`, `linkMe`); Person eines Links in Rozmowy (0095); sperren (`revokeLink`) | ein Link je Rolle, nicht je Person; keine Übersicht „meine Einheiten“ | **ein Link je Person** mit allen Rollen; **neuer Link bei Rollenänderung**, der alte wird zurückgenommen; **„Moje wspólnoty“** (`#/moje`): Begrüssung mit Namen, Einheiten mit Rolle, „nowe“ seit dem letzten Besuch, Rozmowy |
| Inhalt / Sichtbarkeit | Inhalt liegt in einem Bereich; Seiten public/members; `publish`; versiegelte Seiten | sechs Stufen gab es nicht als eine Frage | **Standard-Sichtbarkeit je Einheit** (gespeichert, vererbt); „Diese Einheit mit Untereinheiten“ = `visibility.subunitsSee` (realisiert als Lesezugang) |
| Werkzeuge | Rozmowy (area/channel/seat), Kalender mit Wiederholung, Formulare mit memberRoles, needs (minor, health), Unterformulare, Seiten, seat-ask, Skryptorium-Programme pro Klasse (0134), Cogita-Kurs mit Lernenden-Link | alles einzeln in verschiedenen Reitern einzustellen | **fünf Schritte** je Einheit, aus denen das Area-Dokument erzeugt wird (`compileUnit`) |
| Einrichtung | Area-JSON-Import mit Vorschau und Import-Schlüsseln | — | **Bauplan** (Vorlage für ähnliche Einheiten), **Vererbung** mit „odziedziczone z … / ustawione tutaj / Przywróć“, **„Zarządzane przez wspólnotę …“**, **Verlauf** mit „Przywróć tę wersję“ |
| Obsada | — | — | „brakuje N“ aus `need` oder `per` (z. B. Animator je 4 Teilnehmer, gegen `intake.limit`) |
| MCP | 30 Formate, Leitfäden | — | Format **`community`**, Leitfaden **`guide-community`**, sieben Beispiele **`example-community-*`** |

**Weiterhin nicht gebaut** (gespeichert und angezeigt, aber ohne eigene Mechanik): Platzgrenze und Warteliste werden nicht gezählt (nur Text auf der Zapisy-Seite); „wer eine Position abgibt, behält Zugriff auf das selbst Erstellte“ — er verliert mit dem alten Link alles, die Inhalte bleiben bei der Position; Umfragen nach unten, Anwesenheit, eigene Tabellen, private Notizen, Lektionen und Cogita werden nicht automatisch angelegt (Wege: Formulare mit Rozszerzenia, Klasse-Reiter, Skryptorium, Cogita-Kurs); Pflege durch Unter-Leitungen ohne Konto (Struktur ändern verlangt ein Konto, das die Wurzel führt; Leitung einer Einheit kann mit Konto ihre Links geben, weil sie die übrigen Positionen hält).

## 2. Wie es gebaut ist

- **Eine Einheit ist ein Bereich**, eine Position in ihr ist eine Rolle des Bereichs („Para animatorska · Krąg 3“), angelegt über das Dokument des Bereichs (`recreatio/area`, `runAreaImport`), das aus den fünf Schritten entsteht: Rollen, Rozmowy (area/channel), Termin des Ganzen (befristet) und regelmässiges Treffen, öffentliche Seite (Opis, Spotkania, Kontakt, Terminy, Zapisy mit memberRoles + needs; Felder „tylko prowadzący“ als eigenes Unterformular), Seite „dla nas“ (members: Kalender, seat-chat, seat-ask). `extra` nimmt weitere Teile des Area-Formats auf.
- **Zugänge aus dem Baum** (`desiredAccess`) gibt der Import per `joinArea`; was die Wspólnota früher gab und nicht mehr gilt, nimmt sie per `dropFromArea` (nur ihre eigenen, gemerkt in `state.joins`). Die Leitung einer Einheit hält deren übrige Positionen (`addHolder` mit Signierschlüssel) — so kann sie Links dafür geben.
- **Persönlicher Link**: `createLink` mit allen Rollen der Person, Ziel `moje`, 365 Tage, Etikett ohne Namen („Osobisty link · Członek kręgu · Krąg 3“). Ändern sich die Rollen (oder „Nowy link“), entsteht ein neuer, der alte wird mit seinen Haltern zurückgenommen.
- **Gespeichert** (`app.area_setup`, versiegelt unter dem Epochenschlüssel): in der Wurzel das ganze Dokument + Zuordnung Schlüssel → Bereich/Rolle/Link; in jeder Einheit ihr `UnitView` (Name, Positionen mit Rollen, Personen mit Namen und Link-Rolle, Startseite) — das liest der Link ohne Konto. Die Namen sieht der Dienst nie. Vorige Fassungen der Wurzel: `app.area_setup_history` (20).
- **Vererbung**: eigener Wert > Bauplan > Einheit darüber > Vorschlag; Gliederung und öffentliche Seite vererben nicht. Schritt 1 schlägt 4–5 vor (`suggestFrom`), ohne Gesetztes zu überschreiben.
- **Podgrupy według cechy**: bei jedem Import neu aus den Feldern der Personen (eine Untergruppe je Wert, Schlüssel `<einheit>-<wert>`).
- **Prüfung**: `scripts/app-json-community-check.mjs` (174 Prüfungen: Beschreibung, Rundweg, jede Einheit jedes Beispiels als Area-Dokument, Vererbung, Zugänge, Untergruppen, Obsada, Plan, Zusammenlegen).

Vor dem Einsatz: **Migration 0137 anwenden und den Dienst ausliefern** (Endpunkte `setup`, `setup/history`, `parent`; Wort `moje` reserviert), dann das Frontend. Ohne 0137 sagt die App „Migracja 0137 … nie jest jeszcze zastosowana“.

## 3. Allgemeine Anleitung

**Vorher, zweimal von Hand** (der Plan erinnert daran):
1. **Adresse beanspruchen.** Die oberste Einheit bekommt ihre Seiten unter EINER Adresse (`address` der obersten Einheit, sonst ein Wort aus dem Namen, z. B. `chor-parafialny`). Alle Einheiten darunter liegen unter ihr (`chor-parafialny/chor-tenor`). Diese eine Adresse beanspruchst du vor dem ersten Speichern: **Strony → „Zajmij adres“** mit dem Code, den du vom Betreiber bekommst. Ohne sie entstehen Struktur, Rollen und Links, aber keine Seiten.
2. **Datenverantwortlichen setzen.** Nach dem ersten Speichern: **Obszary → die oberste Einheit → Ustawienia → „Administrator danych“** (Name, Anschrift, E-Mail, Aufsichtsbehörde: UODO oder KIOD). Die Einheiten darunter erben ihn. Dann in der Wspólnota noch einmal **„Zapisz zmiany“** (oder denselben JSON noch einmal importieren): jetzt entstehen Rozmowy, Ogłoszenia, Zapisy und die öffentliche Seite.

**Anlegen.** Warsztat → **Wspólnoty** → **Nowa wspólnota**. Name, dann fünf Schritte; zu jeder Antwort steht „Pasuje np.: …“. Wer nur „Dalej“ drückt, bekommt: dauerhaft, vor Ort, wöchentlich, nur mit Einladung, Leitung trägt ein, Rozmowa + Kalender + „Napisz do prowadzących“. Statt leer kann man „Zacznij od przykładu“ wählen (Beispiel-Einstellungen, keine Typen). „Zobacz plan i utwórz“ zeigt die Änderungsliste; „Zapisz zmiany“ legt alles an und zeigt die **neuen Links — jetzt kopieren** (später: Reiter „Osoby“ → „Kopiuj link“).

**Ändern.** Wspólnota öffnen:
- *Struktura*: Karte (ziehen = umhängen, ± = zu-/aufklappen, „Pokaż pozycje i osoby“) oder Liste („Przenieś pod…“, fürs Telefon).
- *Jednostka*: die fünf Schritte der gewählten Einheit, mit Herkunft jeder Einstellung und „Przywróć odziedziczone“; Unter-Einheiten anlegen (auch mehrere aus einem Bauplan), Gremium, Positionen (Rechte, Paar, Vergabe, Amtszeit, Bedarf), Felder der Personen, „Zapisz jako plan budowy“, „Rozwiąż jednostkę“.
- *Osoby*: Namen zeilenweise auf eine Position (erst als Gruppe), dann je Person Plätze hinzufügen/entfernen, „Nowy link“, „Usuń“.
- *Obsada*: wo jemand fehlt. *JSON*: Export/Import desselben Dokuments (auch für AI). *Historia*: frühere Fassung als Entwurf zurückholen.
Jede Änderung ist zuerst ein Entwurf; oben steht „Masz niezapisane zmiany“ → „Zobacz plan i zapisz“.

**Zusammenlegen.** Liste der Wspólnoty → zwei (oder mehr) ankreuzen → „Połącz pod nową jednostką“ → Name → Plan. Die bisherigen Wurzeln werden Einheiten der neuen; Bereiche, Rollen und Links bleiben.

**Was die Person sieht.** Der Link öffnet `#/moje`: „Witaj, Anna Kowalska!“, je Einheit die eigene Position („Para rejonowa (prowadzenie)“, „Członek kręgu“), „nowe: N“ seit dem letzten Besuch, „Otwórz“ (Seite „dla nas“ der Einheit), „Kalendarz“, Rozmowy. Jeder Bereich zeigt oben „Zarządzane przez wspólnotę …“.

## 4. Szenarien — so realisierst du das

### Szenario 1: Schule, Klassen, Lektionen
**Zuerst:** Adresse `liceum-jp2` beanspruchen (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Liceum im. Jana Pawła II“ → Ustawienia → „Administrator danych“ (Schule: in der Regel die Schule selbst oder die Pfarrei/den Träger), dann „Zapisz zmiany“ noch einmal.
1. Wspólnoty → Nowa wspólnota → „Zacznij od przykładu“ → *szkoła z klasami* (oder JSON-Import `example-community-szkola`). Namen der Schule, Klassen, Schüler anpassen (Osoby → Namen zeilenweise auf „Uczeń“ der Klasse).
2. Zobacz plan i zapisz → Links der Schüler kopieren und verschicken.
3. Lektionen: im **Skryptorium** der Schule ein Programm (Projekt) mit Lektionen (Texte); Quelltexte mit Absätzen 1a–9d als „Dzieło z tekstem“ in der **Bibliothek** (`work-with-text`), Karten/Fragen in **Cogita** (`knowledge-base`, Verweise auf Absätze über `locations`). Freigabe pro Klasse: Klasse → Reiter „Klasa“ → Programm verwirklichen (Wygłoszenie je Klasse, 0134); dieselbe Lektion für mehrere Klassen zu verschiedenen Zeiten.
4. Noten / interne Spalten: Klasse → „Utwórz listę uczniów“ (Obecność, Uwagi); weitere Spalten als Unterformular der Liste (audience office).
5. Neue Schuljahre: Klassen umbenennen (1a → 2a) oder neue Einheit aus dem Bauplan; alte als „Rozwiąż“ (bleibt als Archiv).

### Szenario 2a: Domowy Kościół — erst ein Rejon, dann zwei, dann die Diözese
**Zuerst:** Adresse `dk-rejon-13` beanspruchen (und für den zweiten Rejon dk-rejon-1; für die Diözese beim Zusammenlegen eine eigene, z. B. dk-krakow) (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Rejon XIII (später: die Diözese — die Rejony erben ihn dann)“ → Ustawienia → „Administrator danych“ (meist die Diözese/der Ruch; Aufsicht: KIOD), dann „Zapisz zmiany“ noch einmal.
1. JSON-Import `example-community-dk-rejon-13` (Rejon XIII, Bauplan „Krąg“, Krąg rejonowy, Pary, Moderator).
2. Zweiter Rejon: `example-community-dk-rejon-1` als eigene Wspólnota.
3. Wspólnoty → beide ankreuzen → „Połącz pod nową jednostką“ → „Archidiecezja krakowska“. Danach in der Diözese Positionen anlegen (Para diecezjalna = lead, Moderator diecezjalny = accompany), `structure.council` an mit „below: para-rejonowa“ = Krąg diecezjalny, `visibility.subunitsSee` an.
4. Termine (Übergabe Ende August, Dzień Skupienia, Opłatek, Patronatsfest 27.12., Krąg-Abschluss mit Wahl im Juni, Rekolekcje): in `extra.appointments` der Diözese bzw. des Rejons oder im Kalender des Bereichs; mit `subunitsSee` sehen alle darunter sie.
5. Umfrage an alle Kręgi: Formular auf der Seite des Rejons, dessen memberRoles die Pary animatorskie sind (Formulare → Rozszerzenia), Ergebnisse in der Liste des Formulars.
6. Wahl im Juni: in „Osoby“ die neue Para animatorska eintragen, die alte austragen → beide bekommen neue Links; Inhalte bleiben beim Krąg.

### Szenario 2b: Oaza in der Pfarrei
**Zuerst:** Adresse `oaza-parafia` beanspruchen (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Oaza przy parafii“ → Ustawienia → „Administrator danych“ (die Pfarrei; Aufsicht: KIOD), dann „Zapisz zmiany“ noch einmal.
`example-community-oaza`: Grupy formacyjne entstehen selbst nach „Stopień“ (ODB/OND/ONŻ), Schola und Teatr als Einheiten, öffentliche Seite mit Zapisy (minors), Animator je 8 Teilnehmer in Obsada. Material pro Stufe: Seite der Untergruppe („dla nas“) um Module ergänzen.

### Szenario 2c: Rekolekcje-Turnus
**Zuerst:** Adresse `oaza-2027-turnus-2` beanspruchen (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Turnus II — Krościenko 2027“ → Ustawienia → „Administrator danych“ (der Veranstalter (Diakonia/Pfarrei); Aufsicht: KIOD — ohne ihn nimmt die Anmeldung niemanden an), dann „Zapisz zmiany“ noch einmal.
`example-community-turnus`: befristet (15.–29.07.), Zapisy öffentlich mit Limit 38, Warteliste, Voraussetzung, Bestätigung, minors + health; Diät und Elternkontakt nur Leitung (eigenes Unterformular); Gruppen aus Bauplan; Obsada zeigt „Animator grupy: brakuje N“ (38 / 4). Zimmereinteilung: weitere Einheiten (Zimmer) unter dem Turnus oder ein Feld „Pokój“. Bericht danach: Seite „po“ (`public.reports`). Achtung: das Limit wird nicht gezählt.

### Szenario 2d: Chor
**Zuerst:** Adresse `chor-parafialny` beanspruchen (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Chór parafialny“ → Ustawienia → „Administrator danych“ (die Pfarrei; Aufsicht: KIOD), dann „Zapisz zmiany“ noch einmal.
`example-community-chor`: Untergruppen nach Stimme automatisch, Proben donnerstags (wöchentlicher Termin), Pasterka und Odpust in `extra.appointments`, Zapisy per Einladungslink (`intake.mode: link`), Konzerte öffentlich. Noten je Stimme: Dateien auf der Seite „dla nas“ der Stimmgruppe.

### Szenario 3: Lerngruppe mit Cogita
**Zuerst:** Adresse `grupa-grawitacja` beanspruchen (Strony → „Zajmij adres“). **Nach dem ersten Speichern:** Datenverantwortlichen setzen in Obszary → „Grupa: Grawitacja“ → Ustawienia → „Administrator danych“ (du selbst oder die Schule; Aufsicht: UODO (oder KIOD bei kirchlichem Träger)), dann „Zapisz zmiany“ noch einmal.
1. `example-community-grupa-nauki` importieren (online, nach Bedarf, nur Einladung, Rozmowa + „Napisz do prowadzących“ + `talk.direct`).
2. Cogita: Baza wiedzy „Grawitacja“ mit den zwölf Schritten (Prompt-/Import `knowledge-base`; der Leitfaden `guide-stories` beschreibt aufeinander aufbauende Schritte mit „Wymaga“).
3. Kurs-Bereich: Reiter „Kurs“ → Baza wählen; auf der Seite „dla nas“ der Gruppe das Modul „Powtórka“ (cogita-revision) einsetzen; Lernanleitung als Text-Modul darüber (Reihenfolge, wie oft, bis wann, was vorher lesen).
4. Fortschritt: Lehrer sieht „Postępy“ aller (Kurs-Reiter), Lernende nur ihren eigenen.

## 5. Geprüft (2026-11-05, private LocalDB-Kopie, nie Produktion)

Durchgespielt mit der echten App (Vite) und dem echten Dienst gegen eine eigene LocalDB; die Skripte liegen nicht im Repository.

| Prüfung | Ergebnis |
|---|---|
| Import DK Rejon XIII: 4 Einheiten + Krąg rejonowy, 12 Rollen, 20 Zugänge, 7 Links; gleicher Import noch einmal | ändert nichts |
| Zwei Rejony unter eine Diözese gelegt (Zusammenlegen), Krąg 3 von Rejon XIII nach Rejon I verschoben | Para rejonowa XIII verliert Krąg 3, Para rejonowa I führt ihn; die Pary animatorskie wechseln vom Krąg rejonowy XIII in den Krąg rejonowy I |
| Mitglieds-Link ruft eine andere Einheit direkt auf (Einstellungen, Mitglieder, Seite „dla nas“) | vom Dienst abgelehnt („Takiego obszaru nie ma“ / „tylko dla osób, które mają dostęp“), nicht nur ausgeblendet |
| Mitglieds-Link: eigene Einheit, Seite der Einheit darüber („Jednostki niżej widzą tę“) | lesbar |
| Alter Link nach Umzug (Maria Lis → anderer Krąg) | neuer Link; der alte ist für den Dienst tot, kein Zugriff mehr |
| Nachbar-Rejon | sieht Rejon XIII nicht, liest die gemeinsame Diözese |
| Paar | zwei Links, beide halten dieselbe Positionsrolle; in Rozmowy schreibt jeder als „Imię Nazwisko (Rola)“ (0095) |
| Moderator (Towarzyszenie) | in Rejon und allen Kręgi nur „read“ — der Dienst nimmt von ihm keine Änderung an |
| Mitgliederseite ohne Link | abgelehnt (nicht öffentlich) |
| Namen | keine Personennamen in Link-Etiketten, Import-Schlüsseln, Einheits-Schlüsseln oder Adressen |

**Nur am Code geprüft:** „eigene Beiträge bleiben“ — das Zurücknehmen eines Links sperrt nur Einladung, Kanten und Schlüssel (`Roles.Invites.cs`), Nachrichten und Einträge werden nicht gelöscht; der Mensch kann sie mit dem alten Link aber nicht mehr lesen. Dass bei einem Paar der Autor einer Nachricht erkennbar ist, kommt aus 0095 (Person eines Links) und wurde hier nicht eigens durchgespielt.

**Gefunden und behoben dabei:** Seiten brauchen eine Seite darüber (Mitgliederseite jetzt auf der Adresse der Einheit, wenn sie keine öffentliche hat); Kalender-Bausteine ohne Termine (der Bereichsimport holt den Kalender jetzt auch dann); nach dem Import kannte der Schlüsselbund die neuen Links nicht („Kopiuj link“ leer bis zum Neuladen).

**Offen:** der Abnahmetest „Lektion aus vorhandenem Material“ (J 21, Auftrag Abschnitt 7) — die aktualisierte Auftragsdatei und der Ordner `beispiele/` lagen nicht vor.

## 6. Rechte, Seiten und Domowy Kościół (2026-11-05)

**Die maßgebliche Referenz für Agenten** (Modell, Rechte-Matrix mit dem, was der Dienst prüft, Kalender, Rozmowy, Seiten
und Adressen, Arbeitsweise ohne Zugang zur Instanz, Grenzen) steht auf Polnisch in
[templates/communities/wspolnoty-AI.md](../templates/communities/wspolnoty-AI.md) — über MCP als `guide-community`.

**Neu gebaut (vorher nur von Hand):**
- `pagesBy` an Einheit und Bauplan: `{ "inside": "<Position>", "public": "<Position>" }`, mit `^` die Position der
  Einheit darüber. Wer eine Adresse führt (`Access.OfAsync`: nächste übernommene gewinnt), bearbeitet ihre Seite, öffnet
  Unterseiten und kann sie öffentlich machen. Bisher führte der Importierende jede Adresse — die Para animatorska konnte
  die Seite ihres Krąg nicht bearbeiten.
- Area-Format: Seite `owner` (`"@<rolle>"` oder Kennung einer gehaltenen Rolle) — `areaImport.ts` öffnet die Adresse
  für diese Rolle bzw. übergibt eine vorhandene.
- Dienst: `POST /workspace/slug/owner` (`Pages/Access.cs`) — eine Adresse, die man führt, einer anderen EIGENEN Rolle
  geben; wiederholbar; fremde Adresse oder fremde Rolle → 403, unbekannter Pfad → 404.
- Beispiel `example-community-dk-krakow` (dk/krakow → Rejon V mit zehn Kręgi, Rejon VI; Krąg rejonowy je Rejon;
  Rozmowa + Ogłoszenia im Rejon, keine Rozmowa im Krąg; `participant` für Mitglieder; ohne Personen).

**Festgestellt (Code), nicht änderbar ohne neues Produktmerkmal:** keine Freigabe öffentlicher Seiten durch den Rejon
(wer die Adresse führt, veröffentlicht); kein Recht „nur Kalender“ (Stufe write gilt für den ganzen Bereich);
`member` = write (darf Termine anlegen); Seitenbearbeitung nur mit Konto; Zugang einer Seite erbt nicht entlang des
Pfads; Jawność eines Bereichs nicht per Import (bewusst: sie öffnet alles im Bereich). Vorschlag für später:
„Freigabe vor Veröffentlichung“ als Eigenschaft einer Adresse (veröffentlichen nur mit `certify` der darüberliegenden
Adresse).

**Geprüft:** `scripts/app-json-community-check.mjs` (242, darunter Personen-Rechte des Wzorzec: Administrator admin
überall; Para rejonowa V admin in zehn Kręgi, nichts in Rejon VI; Para animatorska ohne Zugang zu Kalinowe 2; Mitglied
liest nur Rejon V und Erzdiözese; Rozmowy; Eigentümer der Seiten). Auf privater LocalDB (rc_mc, nie Produktion,
Skript `scratchpad/mc/dk-e2e-pl.mjs` der Sitzung 719fcce1): Import Rejon V mit zwei Kręgi, Eigentümer der Adressen in
`app.slug` wie geplant, zweiter Import ändert nichts, Übergaberegeln (403/404/idempotent), anonym 403 auf Mitgliederseiten,
nach dem Administrator danych: Rejon = Rozmowa + Kanał, Krąg rejonowy = Rozmowa, Kręgi ohne Rozmowa, öffentliche
Rejon-Seite 200, vierter Import ohne zweite Rozmowa (17 Prüfungen). Link-Zugriffe der Personen (Mitglied liest eigene
Einheit und darüber, nicht den Nachbarn; alter Link nach Umzug tot) wurden in §5 geprüft.

**Nur vorgeschlagen, nicht ausgeführt:** Umzug eines Krąg zwischen Rejony und Wechsel der Para mit dem Wzorzec (gleicher
Mechanismus wie in §5 geprüft); Einbettung als Widget; Anmeldung mit Link + Konto und Seitenbearbeitung durch die Para.
