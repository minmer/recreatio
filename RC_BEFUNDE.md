# Befunde aus dem Bau

Wo die Umsetzung von der Spezifikation abweicht, und warum. Eine Abweichung,
die nur im Quelltext steht, ist keine Entscheidung — sie ist ein Unterschied,
den irgendwann jemand für einen Fehler hält und „korrigiert".

Stand: 24. August 2026. Phase 0 abgeschlossen; Entsperrkette, Rollenschicht,
Einladungen, Kapitel 9 und die Kette stehen. **Keine offenen Entscheidungen.**

---

## Umgesetzt mit Abweichung

### BEFUND 34 — OAEP kennt in .NET keine Beschriftung

**Betrifft:** Anhang C, AlgId `0x02` (Schlüsselverpackung mit RSA-OAEP).

Die Spezifikation bindet die AAD über den OAEP-Label-Parameter an die Hülle.
.NET stellt diesen Parameter nicht bereit; `RSAEncryptionPadding` erlaubt nur
die Wahl der Hashfunktion.

**Stattdessen:** `SHA-256(header ‖ aad)` wird dem Klartext vorangestellt und
beim Öffnen geprüft. Die Bindung ist dieselbe, die Prüfung ist explizit statt
implizit. Der Größenvertrag bleibt erhalten — die Hülle misst weiterhin 532
Byte.

**Was zu entscheiden ist:** Ob die Spezifikation diese Konstruktion aufnimmt.
Eine spätere Umstellung auf einen echten Label-Parameter würde jede bestehende
Hülle unlesbar machen.

*Umgesetzt in `backend/Rc.Kernel/RcCrypto.cs`.*

---

### BEFUND 35 — Der Anmeldenachweis gehört auf den Server

**Betrifft:** 21.8 (Passwortableitung), 3.15 (Anmeldenachweis).

21.8 lässt PasswordKey und Anmeldenachweis aus **demselben Passwort** mit zwei
verschiedenen Salzen entstehen. Wörtlich umgesetzt kostet eine Anmeldung damit
zwei Argon2id-Läufe zu je 64 MiB — beide im Browser, beide auf dem Telefon,
bei jedem Neustart.

**Stattdessen:** Der Nachweis ist eine Ableitung **des PasswordKey** mit
eigenem Salz und läuft auf dem Server.

|                                | 21.8 wörtlich | umgesetzt |
| ------------------------------ | ------------- | --------- |
| Läufe im Browser je Anmeldung  | 2             | **1**     |
| Läufe je Rateversuch (Angreifer mit Datenbank) | 1 | **2** |

Die zweite Zeile ist der eigentliche Punkt. Wer die Datenbank hat, greift bei
der wörtlichen Fassung schlicht die günstigere der beiden unabhängigen
Ableitungen an und zahlt einen Lauf. Hier muss er erst den PasswordKey bilden
und daraus den Nachweis — zwei Läufe, für jeden Versuch.

Der Zweck aus 3.15 bleibt gewahrt: eigene langsame Ableitung, eigenes Salz,
und der Nachweis ist **nicht** der Schlüssel, mit dem der Wurzelschlüssel
verpackt ist. Wer die Datenbank besitzt, kann mit dem Nachweis nichts öffnen.
Das ist als Prüffall festgehalten („Verifier ist nicht der Schluessel des
MasterKey").

*Umgesetzt in `backend/Rc.Kernel/RcPassword.cs`, `backend/Rc.Api/RcAuth.cs`,
`frontend/src/rc/lib/rcAuth.ts`.*

---

## Gemessen statt geschätzt

### BEFUND 31 — Was Argon2id mit 64 MiB wirklich kostet

| Umsetzung                     | Zeit    |
| ----------------------------- | ------- |
| hash-wasm (Browser, WebAssembly) | 237 ms |
| Konscious (Server, .NET)      | ~480 ms |

Gemessen auf dem Entwicklungsrechner, m = 64 MiB, t = 3, p = 1. Ein Telefon
liegt darüber, aber in derselben Größenordnung. **Mit BEFUND 35 zahlt der
Browser das einmal statt zweimal.**

Beide Umsetzungen rechnen bitgenau dasselbe — festgehalten als Testvektor
**TV-12**, der auf beiden Seiten steht (`Rc.Kernel.Tests`, `rcSelfTest.ts`).
Das ist kein Zierrat: liefen sie um ein Bit auseinander, könnte sich niemand
mehr anmelden, und zwar erst nach der Auslieferung und ohne sichtbaren Fehler
— ein falscher Schlüssel ist von einem falschen Passwort nicht zu
unterscheiden.

---

## Entschieden, weil die Spezifikation es offenließ

### BEFUND 38 — Schließt `admin` auch `read` ein?

**Betrifft:** 3.5, `ck_rc_certificate_cap`.

Die Spalte kennt `read | write | admin | certify`. Eine **Ordnung** darunter
nennt die Spezifikation nicht. Ohne sie bräuchte ein Verwalter, der auch lesen
darf, zwei Zertifikate — und irgendwann fehlt eines. Das fällt nicht beim
Ausstellen auf, sondern Wochen später, wenn jemand nicht sehen kann, was er
verwaltet.

**Entschieden:** `read < write < admin`, und `certify` steht **daneben**, nicht
darüber.

```
  certify ──┐   darf aufnehmen
            │
  admin ────┼── schließt write ein
    │       │
  write ────┘── schließt read ein
    │
  read
```

`certify` schließt nichts ein und wird von nichts eingeschlossen. Der Grund ist
ein konkreter Fall: der Pfarrer, der jemanden in eine Gruppe aufnimmt, deren
Inhalte ihn nichts angehen. Sobald `certify` die anderen einschlösse, gäbe es
diesen Fall nicht mehr. Umgekehrt genauso: wer alles lesen und ändern darf,
darf deshalb noch niemanden hineinlassen.

Wer beides braucht, bekommt zwei Zertifikate — auch die Gründerin.

*Umgesetzt in `backend/Rc.Kernel/RcCapability.cs`. Die Ordnung steht dort und
NICHT zusätzlich im SQL: zweimal geschrieben heißt einmal geändert.*

---

### BEFUND 39 — Wie ein Konto überhaupt an einen Rollenschlüssel kommt

**Betrifft:** 21.6, `rc_role`, `rc_role_key_grant`.

21.6 sagt: Bereichsschlüssel werden **gewrappt, nicht abgeleitet** — sonst
könnte ein Administrator niemanden aufnehmen, ohne dessen Geheimnisse zu
kennen. Zugleich steht in der Info-Aufzählung `role-read:<roleId>`, also eine
**Ableitung** aus dem Wurzelschlüssel. Beides zusammen ergibt nur dann einen
Sinn, wenn man sagt, **wo** die Ableitung endet.

**Entschieden:** Abgeleitet wird genau einmal — für die **persönliche Rolle**
des Kontos. Sie hat immer genau einen Halter; für sie ist Ableitung richtig und
spart eine Hülle, die man stehlen oder zu widerrufen vergessen könnte. Jede
andere Rolle hat einen **zufälligen** Schlüssel, der je Halter gewrappt in
`rc_role_key_grant` liegt (`key_kind = 'data_key'`, `key_ref` = die zugeteilte
Rolle).

```
  MasterKey ─derive→ persönliche Rolle ─wrap_private→ Zuteilung → Rolle R
                                                          │
                                                 ─wrap_private→ Zuteilung → Rolle S
```

**Was daraus folgt, und das ist der eigentliche Punkt:** Erreichbarkeit im
Rollengraphen **ist** Schlüsselerreichbarkeit. Es gibt keinen zweiten Weg an
eine Rolle heran. Eine Berechtigungsprüfung, die man umgehen kann, und eine,
die man nicht umgehen kann, unterscheiden sich genau hier.

`rc_role.kind = 'person'` ist deshalb die **einzige** Zeichenkette, die der
Kernel auswertet. 3.1 verbietet Fallunterscheidungen nach `kind` — diese eine
ist die Ausnahme, und sie ist es, weil ohne sie der Schlüsselweg keinen Anfang
hätte.

*Umgesetzt in `backend/Rc.Kernel/RcRoleKeys.cs`, `backend/Rc.Api/RcRoleAccess.cs`.*

---

### BEFUND 40 — Anmelden, Einladen und der eigene Bereich

**Betrifft:** Kapitel 8, 3.5, 3.12.

**Korrigiert am 24. August 2026** nach Rückmeldung. Die erste Umsetzung ließ nur
ein einziges Konto zu und behandelte den Zugangslink als Anmeldeweg. Beides war
falsch. Richtig ist:

> Anmelden kann sich **jeder**, ohne Link. Der Zugangslink und die SMS sind
> **Einladungen in einen nicht öffentlichen Teil** der Plattform, und über den
> Link wird dieser Zugang mit dem **bereits angemeldeten Konto** verbunden.

Daraus folgt die ganze Gestalt:

| | |
| --- | --- |
| **Anmelden** | offen für jeden. Ergebnis: persönliche Rolle plus **eigener Geltungsbereich**, darauf `admin` und `certify`. Sonst nichts. |
| **Einladung** | führt in einen **fremden** Bereich. Verlangt beim Aussteller `certify` dort, beim Einlösenden ein bestehendes, entsperrtes Konto. |

**Warum jeder seinen eigenen Bereich bekommt** und nicht alle einen
gemeinsamen: `certify` auf einem gemeinsamen Bereich wäre die Vollmacht, jedem
alles zu geben. Ein Bereich je Person hat diese Stelle nicht — dort ist jeder in
seinem eigenen Haus souverän und in keinem fremden.

**Warum offene Anmeldung hier ungefährlich ist:** ein frisches Konto erreicht
nichts, was ihm nicht jemand ausdrücklich gegeben hat. Die Gefahr offener
Anmeldung liegt sonst darin, dass ein Konto *schon etwas ist*. Hier ist es ein
Ort, an dem Schlüssel liegen.

**Was offene Anmeldung dafür kostet:** ein Argon2id-Lauf und zwei
RSA-4096-Paare, für jeden, der will. Ohne Ratensperre je Absender wäre genau das
der bequemste Weg, den Dienst umzuwerfen — deshalb zählt der Riegel beim
Anlegen genauso mit wie beim Anmelden.

**Der Kern der Einladung: der Schlüssel reist mit dem Link, nicht mit der
Datenbank.** `rc_token.sealed_role_key` liegt unter einer Ableitung aus dem
Token-Geheimnis, und gespeichert ist nur dessen SHA-256. Wer die Tabelle
vollständig besitzt, kann die Einladung **nicht** einlösen. Nur wer den Link
hat, kann es. Der Preis: ein verlorener Link ist nicht wiederherstellbar, man
stellt einen neuen aus.

*Umgesetzt in `backend/Rc.Api/RcInvitations.cs`,
`backend/Rc.Schema/Sql/rc_0003_invitation.sql`, `RcAuth.RegisterAsync`.*

---

### BEFUND 37 — Was der sichere Modus wirklich ist ✔ beantwortet

**Betrifft:** 3.9, `rc_account.cache_mode`.

**Beantwortet am 24. August 2026.** Keine der beiden Lesarten, die ich vermutet
hatte, war richtig. Die Antwort ist einfacher und schärfer:

```
  bequem (0)                        sicher (1)
  ----------                        ----------
  Der Bund liegt im Speicher,       Im Speicher liegt NICHTS.
  aber verschlüsselt.               Jede Anfrage baut neu auf.
```

Im sicheren Modus wird **kein Schlüssel zwischengespeichert** — jede Anfrage
öffnet `master_key_sealed` neu. Im bequemen Modus hält der Speicher den
Schlüsselbund, aber verschlüsselt, sodass **ohne den Schlüssel aus der Anfrage
nichts zugänglich ist**.

Der Unterschied ist damit **nicht** die Sicherheit gegen den Betreiber — die ist
in beiden Fällen dieselbe. Der Unterschied ist, **was überhaupt existiert**: im
sicheren Modus gibt es keinen zweiten Ort, kein Eintrag, keine Frage nach dessen
Ablauf, nichts, was ein Speicherabbild zeigen könnte, auch nicht verschlüsselt.
Der Preis ist eine Datenbankabfrage je Anfrage.

Das `if` steht an **genau einer** Stelle. Zwei wären zwei Gelegenheiten, die
Wahl des Nutzers zu übergehen. Und der Wechsel nach „sicher" vergisst sofort,
was schon liegt — eine Einstellung, die erst nach dem nächsten Abmelden wirkt,
zeigt einen Zustand an, den es noch nicht gibt.

*Umgesetzt in `backend/Rc.Api/RcMasterKey.cs`, Endpunkt `/rc/auth/cache-mode`.*

---

### BEFUND 41 — Was die drei Reaktionen bedeuten

**Betrifft:** 9.8, `ck_rc_reaction_kind`.

Das Schema lässt `1, 2, 3` zu und sagt nicht, wofür sie stehen. Der
Primärschlüssel `(message_id, role_id)` sagt aber etwas sehr Deutliches:
**genau eine Reaktion je Person und Beitrag.** Das ist kein Emoji-Regal, das ist
eine Stellungnahme.

**Gewählt:** `1 = Zustimmung`, `2 = Kenntnis genommen`, `3 = Widerspruch`.

Der Grund für gerade diese drei: „ich habe es gelesen" und „ich stimme zu" sind
nicht dasselbe, und in einer Sitzung ist der Unterschied der ganze Punkt. Ein
Daumen-hoch kann beides heißen und sagt deshalb nichts.

**Zu bestätigen.** Falls die Spezifikation andere drei meint, ist das eine
Zeile im Klienten und eine Zeile Kommentar — die Zahlen selbst ändern sich nicht.

*Umgesetzt in `backend/Rc.Api/RcEngagement.cs`.*

---

### BEFUND 42 — Entscheidungen setzen die Kette voraus ✔ erledigt

**Betrifft:** 7.8, `rc_decision`, `rc_decision_transition`.

Beim Bau von Kapitel 9 aufgefallen und **keine Abweichung, sondern eine
Reihenfolge**, die das Schema selbst erzwingt:

```sql
ledger_entry_id  uniqueidentifier  NOT NULL   -- immer kettenpflichtig (7.8)
```

Nachrichten sind kettenpflichtig **je Beitrag** (nullbar, sichere
Voreinstellung). Entscheidungen und ihre Übergänge sind es **immer**. Es lässt
sich also keine Entscheidung schreiben, bevor die Kette schreibt.

**Umgesetzt am 24. August 2026.** Kapitel 7 steht: Anfuegen unter Sperre,
oeffentlicher Kopf, und eine Pruefung, die die Kette Glied fuer Glied nachrechnet.
Entscheidungen und ihre Uebergaenge schreiben jetzt in die Kette; Nachrichten
koennen es je Beitrag.

Das ist richtig so — eine Entscheidung ohne beweisbare Reihenfolge ist keine —
und es hat die Reihenfolge festgelegt: **Kapitel 7 vor dem Rest
von Kapitel 9.** Themen, Reaktionen, Lesestand, Entwürfe und Umfragen brauchen
die Kette nicht und stehen deshalb schon.

---

### BEFUND 43 — `data_key` bedeutete zweierlei

**Betrifft:** 21.6, 12.3.2, `ck_rc_role_key_grant_kind`.

Beim Bau der Rollenschicht habe ich `key_kind = 'data_key'` für die Zuteilung
des Schlüssels einer **Rolle** an ihren Halter benutzt — es war der generischste
der vier erlaubten Werte. Beim Bau von Kapitel 12 stellte sich heraus, dass
`data_key` der Schlüssel eines **Datenelements** ist, und dass die Löschung
durch Schlüsselvernichtung (12.3.2 Weg b) genau diese Zuteilungen vernichtet.

**Das war nicht bloß unsauber, sondern gefährlich.** Eine Löschung, die „alle
`data_key`-Zuteilungen dieses Schlüsselbezugs" vernichtet, hätte bei gleicher
Art irgendwann eine Rolle mit ausgesperrt — und zwar unwiederbringlich, denn das
ist der Sinn der Sache.

**Behoben in `rc_0004_datakinds.sql`:** die Aufzählung bekommt `role_key`, und
die bestehenden Zeilen werden umgesetzt (erkennbar daran, dass `key_ref` auf
eine Rolle zeigt).

Der Unterschied zwischen *was diese Rolle IST* und *was diese Rolle WEISS*
gehört in die Spalte, nicht in den Kopf dessen, der die Abfrage schreibt. Ein
Prüffall hält das jetzt fest: nach der Löschung aller Daten einer Rolle ist die
**Rolle selbst weiterhin aufschließbar**.

---

### BEFUND 44 — Was die sechs Datenklassen bedeuten

**Betrifft:** 12.9, `ck_rc_data_item_class`.

Die Spalte kennt `public | operational | personal | special | secret |
integration`. Die Spezifikation sagt, die Klasse entscheide über **Hülle,
Rollenfreigabe und Protokollpflicht** — welche Klasse was entscheidet, sagt sie
nicht.

**Entschieden:**

| Klasse | Protokoll | Wer darf lesen | Zweck nötig |
| --- | --- | --- | --- |
| `public` | nein | jeder mit `read` | nein |
| `operational` | nein | Eigentümer + `admin` | nein |
| `personal` | **ja** | Eigentümer + Freigabe | nein |
| `special` | **ja** | Eigentümer + Freigabe | **ja** |
| `secret` | **ja** | **nur** der Eigentümer | — |
| `integration` | nein | Eigentümer + `admin` | nein |

Zwei Punkte, die daran hängen:

**Die Protokollpflicht ist kein Schalter.** Sie *folgt* aus der Klasse. Einen
Schalter „bitte protokollieren" vergisst irgendwann jemand; eine Klasse, aus der
die Pflicht folgt, kann man nicht vergessen.

**`secret` ist die Klasse, die keine Freigabe kennt** — das ist ihr ganzer
Unterschied zu `special`. Bei `special` darf ein anderer lesen, wenn er sagt
wozu; bei `secret` darf es niemand, und es gibt keinen Endpunkt, der es doch
erlaubte. Eine Klasse, die nur in der Anzeige gesperrt ist, ist nicht gesperrt.

*Umgesetzt in `backend/Rc.Api/RcDataItems.cs`.*

---

### BEFUND 45 — Der Schwellwert war nicht einlösbar

**Betrifft:** 8.2, `rc_recovery_share`.

Die erste Umsetzung der Wiederherstellung verlangte, dass **eine Anfrage** alle
nötigen Anteile öffnet. Ein Anteil geht aber nur mit dem Schlüssel *seines*
Bürgen auf — es hätte also eine Person gebraucht, die mehrere persönliche
Rollen hält. Die gibt es nicht.

**Die Wiederherstellung wäre nie vollziehbar gewesen.** Der Prüffall hat es
gefunden: „zwei Bürgen an einer Anfrage" scheiterte, und beim Nachdenken über
das Warum war klar, dass es gar nicht anders ausgehen konnte.

**Behoben mit `rc_0005_recovery_contribution.sql`.** Jeder Bürge trägt einzeln
bei: er öffnet seinen Anteil mit seinem Schlüssel und verpackt ihn neu unter dem
öffentlichen Verpackungsschlüssel des Antragstellers — dieselbe Bewegung wie bei
der Einladung. Die Beiträge sammeln sich, bis der Schwellwert erreicht ist.

Damit verlangt der Schwellwert wieder das, was er verlangen soll: **mehrere
Menschen, die sich jeder für sich anmelden und jeder für sich beitragen.** Ein
Bürge zählt einmal (`uq_rc_recovery_contribution_once`) — sonst erreichte einer
allein den Schwellwert, indem er denselben Anteil zweimal einreicht.

---

### BEFUND 46 — Der Erzeuger in GF(2⁸) ist 3, nicht 2

**Betrifft:** 8.2, Shamir-Teilung.

Beim Bau der Log/Exp-Tabellen habe ich 2 als Erzeuger genommen. Mit dem
Reduktionspolynom `0x11b` hat die 2 aber die **Ordnung 51** und durchläuft nur
ein Fünftel des Körpers — die Tabellen waren lückenhaft.

**Das Tückische:** Teilen und Zusammensetzen liefen trotzdem *durch*. Kein
Fehler, keine Ausnahme, nur ein falsches Ergebnis. Wäre das in Betrieb
gegangen, hätte die Wiederherstellung den Schlüssel nicht wiederhergestellt —
und das hätte man erst gemerkt, wenn jemand sie wirklich braucht.

Gefunden hat es die Prüfreihe („zwei von drei genügen"). Zusätzlich prüft jetzt
ein eigener Fall die **Vollständigkeit der Tabellen** selbst, damit dieselbe
Klasse von Fehler beim nächsten Mal sofort auffällt statt erst über ein
Folgeergebnis.

---

### BEFUND 47 — Anonyme Antworten lassen sich nicht beschreiben

**Betrifft:** 15.6.

Die Endpunkte antworteten mit `new { … }`. Das ist bequem zu schreiben und für
einen Klienten **unsichtbar**: aus einem anonymen Objekt lässt sich keine
Beschreibung erzeugen, weil es keinen Namen hat, unter dem es in einem Schema
stehen könnte.

Solange der Browser-Teil die Formen von Hand nachbaute, fiel das nicht auf — es
fiel erst auf, wenn eine Umbenennung im Server die Nachbildung still falsch
machte. Genau das schließt der erzeugte Klient.

**Erledigt.** Alle Antworten sind benannte Datensätze (vier Vertragsdateien:
`RcAuthContracts`, `RcRoleContracts`, `RcChatContracts`, `RcDataContracts`),
jeder Endpunkt trägt `Produces<T>()`. **69 der 70 Endpunkte** stehen mit
Antwortform im Dokument — 55 Pfade, 121 Typen.

Der eine ohne ist `GET /rc/attachments/{id}/content`: er liefert die Datei
selbst, kein JSON. Dort ist das Fehlen richtig und keine Lücke.

**Dass der Umbau nichts verschoben hat, zeigen die 157 Prüffälle:** sie lesen
JSON nach Feldnamen, und ein benannter Datensatz serialisiert genau wie das
anonyme Objekt davor. Wäre irgendwo ein Feld anders geschrieben worden, wären
sie rot.

**Nachgewiesen, dass es trägt:** `IdleMinutes` → `IdleTimeoutMinutes` im C#,
neu erzeugt, und der Browser-Teil bricht mit
`Property 'idleMinutes' does not exist`. Vorher wäre daraus ein `undefined` im
Browser eines Menschen geworden.

**Zwei Dinge, die dabei nötig waren und nicht offensichtlich sind:**

`SupportNonNullableReferenceTypes()` plus ein Schema-Filter, der nicht-nullbare
Eigenschaften als Pflicht auszeichnet. Ohne beides beschreibt das Dokument jedes
Feld als möglicherweise fehlend — obwohl `System.Text.Json` jede Eigenschaft
eines positionsbasierten Datensatzes schreibt. Der erzeugte Klient zwänge dann
überall zu Prüfungen auf Zustände, die nie eintreten, und **wer sich angewöhnt,
solche Prüfungen mit `!` wegzuräumen, räumt irgendwann auch die weg, die es
wirklich braucht.**

*Umgesetzt in `backend/Rc.Api/RcOpenApi.cs`, `backend/Rc.OpenApi/`,
`frontend/src/rc/lib/rcApiTypes.ts` (erzeugt).*

---

### Nicht von mir: die Umstellung auf net10.0

Zwischen zwei Bauläufen sind **alle** Projekte von `net8.0` auf `net10.0`
gewechselt, samt Swashbuckle 6.6.2 → 10.2.3 im Altbestand. Das steht als
uncommittete Änderung an `backend/Recreatio.Api/Recreatio.Api.csproj` im
Arbeitsverzeichnis und stammt nicht aus dieser Sitzung.

Ich bin mitgegangen statt dagegen zu arbeiten: die neuen Projekte stehen jetzt
ebenfalls auf `net10.0`, und `Rc.Api` benutzt dieselbe Swashbuckle-Fassung wie
der Altbestand — zwei Fassungen derselben Bibliothek in einem Prozess wären ein
vermeidbares Problem.

**Alles baut und alle 263 Prüffälle laufen darauf grün.** Falls die Umstellung
nicht beabsichtigt war, ist jetzt der Zeitpunkt, sie zurückzunehmen — später
wird es teurer.

---

## Erledigt — keine offenen Entscheidungen mehr

### BEFUND 30 — Minderjährige ~~in Fassung 1~~ ✔ hinfällig

**Betrifft:** Kapitel 4 (Einwilligung, Altersstufen), Phasenplan Kapitel 17.

**Hinfällig seit dem 24. August 2026.** Die Frage lautete, ob Kapitel 4 in
Phase 3 muss oder später kommen darf. Sie stellt sich nicht: die Plattform wird
**vollständig gebaut, bevor sie in den echten Betrieb geht**. Es gibt keine
Fassung 1, die vor Kapitel 4 live ginge.

Kapitel 4 wird also gebaut wie alles andere — nur eben nicht unter Zeitdruck aus
einem Starttermin heraus. Der Phasenplan bleibt eine Reihenfolge der Arbeit,
nicht eine Reihenfolge von Auslieferungen.

## Aus dem Bau gelernt — gehört in die Spezifikation

### Zwei Cookies, eine Regel

`SameSite=None` verlangt `Secure`, und `Secure` verlangt TLS. Der
Browser-Teil liegt auf GitHub Pages, die API woanders — das ist
seitenübergreifend, also ist `SameSite=None; Secure` im Betrieb die einzige
Kombination, die überhaupt funktioniert.

Auf einem Entwicklungsserver ohne TLS schickt der Klient ein `Secure`-Cookie
nie mit. Die Folge ist eine 403 auf einen fehlenden Schutzwert — eine
Fehlermeldung, die exakt auf die falsche Stelle zeigt. Genau das ist beim Bau
passiert und hat die erste Prüfreihe gegen den laufenden Dienst gekostet.

Die Wahl steht deshalb an **einer** Stelle und gilt für Schutzwert- und
Anmeldecookie zugleich (`Rc:CrossSiteCookies`). Zwei Cookies mit getrennten
Regeln wären zwei Gelegenheiten für denselben Fehler.

### „Noch nicht angemeldet" ist kein Grund für eine CSRF-Ausnahme

Der Schutzwert kommt aus `/rc/csrf` und setzt kein Konto voraus. Anmeldung und
Schutzwert sind zwei verschiedene Dinge — sie zu verwechseln nimmt ausgerechnet
die Anmeldung vom Schutz aus, also den Vorgang, den eine fremde Seite am
liebsten auslösen würde (Anmeldung in ein untergeschobenes Konto).

Ausgenommen ist genau ein Schreibzugriff: `/rc/csrf` selbst.

### Argon2id ist auch ein Hebel zum Umwerfen

Ein Lauf belegt 64 MiB. Zwanzig gleichzeitige Anmeldeversuche sind 1,3 GiB —
der Dienst fällt um, ohne dass ein einziges Passwort erraten wurde. Der Schutz
vor dem Raten ist zugleich die Angriffsfläche.

Deshalb ein Speicherriegel (`Rc:LoginMaxConcurrent`, Vorgabe 4) **vor** der
Ratensperre. Wer wartet, wartet; niemand bekommt eine 503, weil sich gerade
jemand anders anmeldet.

Dasselbe gilt für das Erzeugen von Rollen: zwei RSA-4096-Paare dauern Sekunden
(21.6). Ohne denselben Riegel wäre „Rolle anlegen" der bequemste Weg, den Dienst
umzuwerfen.

Die Ratensperre zählt je Benutzername **und** je Absender. Nur je Name wäre zu
wenig (ein Passwort gegen tausend Namen), nur je Absender ebenfalls (ein
Botnetz hat tausend Absender). Nach gelungener Anmeldung fällt nur der Zähler
des Namens — sonst wäscht ein Angreifer mit einem eigenen guten Konto seine
Fehlversuche gegen alle anderen weg.

### Die Bibliothek war nie ein Dienst

`Rc.Api` ist mit `OutputType=Library` gebaut worden, und das war richtig: die
Prüfreihe stellt sie sich in den eigenen Prozess, der Beschreibungs-Erzeuger
startet sie für zwei Sekunden. Beides beweist, dass sie funktioniert.

Keines von beiden macht sie für einen Browser erreichbar. Über Wochen sind 70
Endpunkte, 158 Prüfungen und eine vollständige Oberfläche entstanden, ohne dass
die Oberfläche je mit dem Dienst gesprochen hätte — es gab schlicht nichts, was
sie hätte anrufen können. Aufgefallen ist es erst beim Versuch, den Dienst zu
starten: `Ein ausführbares Projekt muss OutputType „Exe" verwenden`.

Deshalb jetzt `Rc.Host`. Er tut nichts als `AddRcPlatform` / `UseRcPlatform`
aufzurufen, und genau deshalb gehört er dazu: **eine Plattform, die man nur mit
einem Prüfprogramm bedienen kann, hat noch nie jemand benutzt.**

Zwei Entscheidungen darin sind keine Bequemlichkeit:

- Das Servergeheimnis wird in der Entwicklung **einmal** erzeugt und daneben
  abgelegt. Bei jedem Start ein neues zu würfeln hiesse, dass jeder Neustart
  alle abmeldet — bei einem Dienst, der beim Entwickeln im Minutentakt neu
  startet, macht das die Anmeldung unbenutzbar und verleitet dazu, sie
  wegzulassen.
- Ausserhalb der Entwicklung gibt es **keinen** Ersatzwert, weder für die
  Verbindung noch für das Geheimnis. Ein Dienst, der in der Produktion still
  auf eine leere Datenbank ausweicht, ist schlimmer als einer, der nicht
  startet.

### Fünf Zustände, von denen vier keinen Text zeigen

Eine Nachricht kann lesbar sein, vom Urheber zurückgenommen, von der Moderation
ausgeblendet, aus der Zeit vor dem eigenen Beitritt — oder sie ist da, der
Schlüssel war da, und sie ging trotzdem nicht auf.

Beim ersten Schreiben der Oberfläche habe ich drei davon behandelt. Die
übrigen zwei — Moderation und jeder Entschlüsselungsfehler ausser
`crypto.missing_epoch` — wären als **leerer Absatz** erschienen. Also als gar
nichts. Genau das Loch, das 15.9 verbietet, und zwar an der Stelle, an der es
am meisten schadet: `crypto.aad_mismatch` heisst, dass jemand am Geheimtext
gedreht hat, und es hätte ausgesehen wie eine Nachricht, die niemand geschrieben
hat.

Die Lehre ist nicht „sorgfältiger sein". Sie ist: **diese Entscheidung darf
nicht im Markup stehen.** Im JSX ist ein vergessener Zweig unsichtbar; als
Funktion mit einem aufgezählten Rückgabetyp (`rcMessageState`) ist er prüfbar,
und die Prüfung deckt jetzt alle fünf ab — samt der Rangfolge (zurückgenommen
schlägt unlesbar, weil es über einen Geheimtext, den es nicht mehr gibt, nichts
zu sagen gibt) und samt des Falls, den der Dienst gar nicht liefern dürfte:
kein Text und kein Grund wird zum sichtbaren Vorfall, nicht zum leeren Absatz.

### Eine nachgebaute Prüfreihe prüft den Nachbau

Die erste Fassung des Oberflächen-Durchgangs hat die Aufrufe von Hand
nachgeschrieben und rief `/auth/salt` als GET auf. Der Dienst antwortete 405.
Der echte Klient hatte die ganze Zeit recht: er ruft POST.

Der Nachbau hätte also einen Fehler gemeldet, den es nicht gab — und wäre bei
der nächsten Änderung am Klienten still danebengelaufen. Deshalb bündelt
`rc:walk` jetzt den **echten** Browser-Code und legt nur das darunter, was Node
fehlt: ein Keksglas und ein `sessionStorage`. Was er prüft, ist damit dasselbe,
was der Browser ausführt, und nicht meine Erinnerung daran.

### Der Altbestand macht das Typ-Tor wertlos

`tsc --noEmit` über `src/` meldet rund zwanzig Fehler, die alle aus der alten
Plattform stammen. Solange sie mitlaufen, steht das Tor immer auf Rot — und ein
neuer Fehler in `src/rc` fällt niemandem mehr auf. Ein Tor, das immer rot ist,
ist kein Tor.

Deshalb `tsconfig.rc.json`: derselbe Bauplan, aber nur der Neubau, und der
**muss** durchgehend sauber sein. Den Altbestand aufzuräumen bleibt eine eigene
Arbeit; sie gehört nicht in diesen Umbau, aber sie darf ihn auch nicht blenden.

### Was die Oberfläche je Zeile braucht, gehört in die Zeile

Stellungnahmen und Anhänge hingen an eigenen Endpunkten. Die Oberfläche hatte
damit zwei Möglichkeiten, und beide waren falsch:

- je Beitrag eine weitere Anfrage — bei fünfzig Beiträgen fünfzig, von denen
  die meisten eine leere Liste zurückbringen;
- oder gar nicht fragen und etwas Erfundenes anzeigen. Genau das stand kurz im
  Code: `mine={null}`. Man wählt eine Haltung, lädt neu, und sie ist weg. Der
  Knopf, dessen ganzer Zweck es ist, eine Haltung festzuhalten, hielt nichts
  fest.

Deshalb trägt der Verlauf jetzt `reactions`, `yourReaction` und
`attachmentCount` mit. Drei Dinge daran sind Entscheidungen und keine
Bequemlichkeit:

**Der Verlauf wird unter einem NAMEN geholt.** Stellungnahmen hängen an der
Rolle, nicht am Konto — wer mehrere Rollen hält, hat womöglich unter zweien
verschieden Stellung genommen. `?roleId=` macht die Frage eindeutig. Und der
Server prüft, dass der Name dem Frager gehört: wäre er frei wählbar, könnte
jeder die Haltung jedes anderen abfragen, und eine Abstimmung, die vertraulich
sein soll, wäre über den Verlauf auslesbar.

**Die Auszählung nennt nur, was vorkommt.** Drei Nullen zu schicken hiesse,
dass neben „ich widerspreche" eine Null steht — eine Aussage über die Sitzung,
die niemand getroffen hat. Ein Zähler bei null ist kein Messwert, sondern eine
Behauptung.

**Die Auszählung ist öffentlich, die eigene Haltung persönlich.** In einem
Gremium ist ein Widerspruch keine Privatsache; wie viele widersprochen haben,
sieht deshalb jeder. Wer, steht nur für den da, der gefragt hat — und nur über
seinen eigenen Namen.

### Eine Null ist eine Behauptung, eine Zusage ist etwas anderes

Bei `reveal: on_close` liefert der Server vor dem Schliessen keine Auszählung,
auch nicht an den, der gefragt hat. Die naheliegende Darstellung wäre „noch
keine Stimmen". Sie wäre gelogen: es sind welche da, sie werden nur niemandem
gezeigt.

Die Oberfläche schreibt deshalb hin, dass die Auszählung bis zum Schliessen
zurückgehalten wird — und dass genau dafür so gefragt wurde. Aus einer
scheinbaren Lücke wird eine eingelöste Zusage. Dass die Zahl der abgegebenen
Stimmen trotzdem sichtbar bleibt, gehört dazu: verschwiege der Dienst auch die,
sähe eine laufende Abstimmung aus wie eine vergessene.

### Ein Knopf, der zuverlässig abgewiesen wird, sieht aus wie eine Befugnis

Anhänge entfernen darf der Eigentümer und die Leitung des Bereichs. Der Knopf
stand zunächst unter jeder Datei — für die meisten Leser ein Versprechen, das
der Server dann mit 403 zurücknimmt. Das ist schlechter als kein Knopf: es
verlagert eine Regel in eine Fehlermeldung, statt sie in der Oberfläche zu
zeigen.

Dieselbe Überlegung steht hinter `canWrite`: wer nur lesen darf, bekommt keinen
Schreibkasten, den er füllen und dann abgewiesen bekommen würde.

### Ein Beweis, den nur der Beweisführer nachrechnen kann, ist keiner

Der Dienst hat einen Prüfweg für seine eigene Kette: `/ledgers/{id}/verify`.
Er ist gründlich, er ist geprüft — und er ist die Aussage genau desjenigen,
gegen den ein Protokoll schützen soll. „Ich habe nachgesehen, es stimmt alles"
aus dem Mund des Betreibers ist keine Prüfung, sondern eine Behauptung.

Die Oberfläche rechnet deshalb **selbst** nach (`rcRecompute`), aus den
Einträgen, wie sie geliefert wurden, und stellt beide Antworten nebeneinander.
Der interessante Zustand ist nicht „heil" und nicht „kaputt", sondern
**uneinig**: was der Dienst über sein Protokoll behauptet, folgt nicht aus den
Einträgen, die er selbst herausgegeben hat. Dafür gibt es einen eigenen,
deutlich anderen Anblick und einen Satz, der sagt, was zu tun ist.

Die Grenze steht daneben, im Klartext: geprüft wird, dass die Glieder
aneinanderpassen und keine Nummer fehlt; **nicht** geprüft wird, ob der Inhalt
jedes Eintrags zu seinem eigenen Hash passt — dafür bräuchte es die kanonischen
Bytes, und die kommen bereits zusammengesetzt an. Eine Prüfung, die mehr zu
können vorgibt, als sie kann, ist schlimmer als keine: sie erzeugt genau das
Vertrauen, das sie nicht deckt.

Eine der Prüfungen hält diese Grenze ausdrücklich fest — ein gefälschter
Vorgänger im ERSTEN Eintrag fällt hier nicht auf, und die Prüfreihe behauptet
das Gegenteil nicht.

### Zwei Felder, die es nur gab, damit die Prüfreihe sie sich nehmen konnte

Die Kettenkennung stand nur in der Zeile des Bereichs. Die Prüfreihe holte sie
sich mit eigenem SQL aus der Datenbank — und genau das war der Beweis, dass die
Oberfläche nicht an das Protokoll herankam: **was sich eine Prüfreihe aus der
Datenbank nehmen muss, kann ein Browser nicht.** Ein Feld, das nur über einen
Datenbankzugriff erreichbar ist, existiert für die Anwendung nicht.

Dasselbe bei den Beschlüssen. Die Tafel der erlaubten Übergänge steht im Server
und gehört dorthin — sie ist die Regel. Die Oberfläche hätte sie abschreiben
müssen, und eine abgeschriebene Regel läuft mit der Zeit von der echten weg:
sie böte Schaltflächen an, die abgewiesen werden, oder verschwiege Wege, die
offen stehen. Beides sieht wie ein Fehler aus, und in beiden Fällen hat niemand
gelogen — die Regel stand nur an zwei Stellen. Also nennt die Sicht jetzt
`allowedNext`, und eine Prüfung klammert beides zusammen: was drinsteht, MUSS
durchgehen, was fehlt, MUSS abgewiesen werden.

### Eine Prüfung, die den Zähler einer anderen verschiebt, ist ein schlechter Nachbar

Die neue Prüfung für `allowedNext` ging die Zustandstafel ab und schrieb dabei
vier Ketteneinträge. Drei Prüfungen weiter unten zählen die Einträge desselben
Bereichs genau ab — und schlugen fehl, obwohl an ihnen nichts falsch war.

Der erste Reflex wäre gewesen, die festen Zahlen dort aufzuweichen. Das wäre
der falsche Weg: die genaue Zahl ist die Aussage. Sie fängt eine Änderung, die
anfängt, zusätzliche Einträge zu schreiben. Die neue Prüfung hat stattdessen
ihren **eigenen** Bereich bekommen.

Beim Umstellen hat ein zu breites Suchen-und-Ersetzen zwei fremde Prüfungen
mitgenommen. Aufgefallen ist das nur, weil danach nachgesehen wurde, welche
Zeilen sich tatsächlich geändert haben — nicht, weil etwas fehlschlug. Beide
liefen weiter grün, nur prüften sie den falschen Bereich.

### Was eine Prüfung an einer Position festmacht, prüft die Position

Eine Prüfung im Durchgang griff `chain[0]` und erwartete dort
`decision.created`. Sie schlug fehl, sobald vorher eine Nachricht zu Protokoll
gegeben wurde — die stand dann an erster Stelle. Nichts daran war kaputt: die
Prüfung hatte sich an eine Reihenfolge geheftet statt an die Sache.

Jetzt sucht sie den Eintrag, statt eine Stelle zu raten. Dazu kam eine, die
wirklich etwas beweist: dass die Schlüssel in der kanonischen Form sortiert
sind (RFC 8785). Das ist keine Kosmetik — genau darauf beruht, dass zwei Seiten
denselben Hash errechnen.

### Eine Einladung teilt eine ROLLE — und das ist leicht zu übersehen

Der erste Durchgang lud zu Annas **persönlicher** Rolle ein. Der Dienst nahm
das an, der Link funktionierte, Bruno kam herein — und konnte die gesamte
Vergangenheit des Bereichs lesen.

Kein Fehler im Dienst. Eine Einladung versiegelt einen Rollenschlüssel unter
dem Token, und wer eine Rolle bekommt, bekommt alles, was an ihr hängt: jeden
Bereich, jede Epoche. Wer seine persönliche Rolle verschickt, verschickt sein
halbes Konto — und merkt es nicht, weil nichts fehlschlägt.

Der Weg ist: eine Gruppenrolle anlegen, **diese** in den Bereich aufnehmen,
und zu ihr einladen. Dann bekommt der Neue genau das, was die Gruppe hat, und
die Epochengrenze liegt dort, wo die Gruppe aufgenommen wurde.

Aufgefallen ist es nur, weil die Prüfung ausdrücklich verlangte, dass Bruno
die ältere Geschichte **nicht** sieht. Eine Prüfung, die bloss „Bruno kommt
herein" festhält, wäre grün geblieben — und hätte die gefährlichste Verwechslung
der ganzen Plattform durchgewinkt.

Die Oberfläche muss daraus eine Folgerung ziehen, die noch aussteht: sie darf
das Einladen nicht an einer persönlichen Rolle anbieten, ohne zu sagen, was das
bedeutet.

### Ein Prüfgerüst für zwei Menschen braucht zwei Ablagen, nicht eine

Der Durchgang hielt Sitzungskekse in einem Glas und das Öffnungsstück in einem
gemeinsamen Speicher. Sobald ein zweites Konto dazukam, überschrieb dessen
Entsperren das erste — und der Wechsel zurück führte in eine Sitzung ohne
Schlüssel. Das hätte wie ein Fehler in der Plattform ausgesehen und wäre einer
im Prüfgerüst gewesen.

Beides wandert jetzt gemeinsam. Der allgemeine Fall dahinter: ein Ersatzstück
für eine Browser-Einrichtung muss die Vereinzelung mitbringen, die das Original
hat — sonst prüft man eine Welt, in der alle dasselbe Fenster teilen.

### `rcAddMember` steht in der Bibliothek und NICHT in der Oberfläche

Es verlangt die Rollenkennung des Neuen, und die kann die Oberfläche nicht
kennen: es gibt kein Verzeichnis der Rollen (3.4), und das ist keine Lücke,
sondern der Punkt. Ein Eingabefeld für eine fremde Rollenkennung wäre eine
Aufforderung, sich diese Kennungen woanders zu besorgen — genau das soll es
nicht geben. Wer jemanden hineinbitten will, stellt eine Einladung aus; dann
bringt der Eingeladene seine Rolle selbst mit.

Das steht als Kommentar an der Stelle, an der der Knopf fehlt. Sonst baut ihn
irgendwann jemand hin, weil die Funktion ja da ist.

### Ein Link, den nur der Empfänger je sieht

Das Geheimnis steht im **Fragment** der Adresse, hinter der Raute. Was dort
steht, schickt der Browser nicht an den Server — stünde es im Pfad oder in der
Abfrage, läge es in jedem Zugriffsprotokoll auf dem Weg, auf jedem
Zwischenknoten und in jedem Verlauf.

Dazu gehört, dass es genau **einmal** angezeigt wird und dass der Grund
danebensteht: der Schlüssel reist im Link und nicht in der Datenbank, also kann
ihn niemand wiederherstellen — auch der Betreiber nicht. Ohne diesen Satz sieht
die Einmaligkeit wie eine Schikane aus statt wie die Zusage, die den ganzen
Aufbau trägt.

Und: **`firstOpenedUtc` ist kein Zierrat** (10.3). Ein Link, der geöffnet
wurde, bevor er beim Empfänger ankam, ist unterwegs gelesen worden. Deshalb
steht die Spalte in Warnfarbe in der Liste und nicht in einer Detailansicht,
die niemand aufmacht.

### Eine Veranstaltung ist ein Bereich mit Seiten daran

Der erste Entwurf des Veranstaltungsschemas hatte alles doppelt: eigene
Epochen, eigene Schlüsselverwaltung, eine eigene Kette, eigene Zertifikate. Er
war fertig geschrieben und angewendet, bevor auffiel, was das bedeutet — eine
**zweite Umsetzung des heikelsten Codes der Plattform**, und die zweite ist
immer die, die beim nächsten Befund vergessen wird.

Es passt auch sachlich nicht. Wer eine Veranstaltung vorbereitet, ist eine
Gruppe, die miteinander redet, Beschlüsse fasst und Leute dazuholt. Genau das
ist ein Bereich. Also zeigt `rc_event` jetzt auf einen, und der bringt
Schlüssel, Mitglieder, Zertifikate und Protokoll mit. Die Veranstaltung fügt
Seiten hinzu, sonst nichts.

Nebenwirkung, die den Ausschlag gab: eine Veranstaltung hat damit **von selbst**
ein Protokoll, Beschlüsse, einen Chat und Einladungen. Nichts davon musste
gebaut werden.

### Öffentlichen Inhalt zu verschlüsseln ist Selbstbetrug

Der naheliegende Weg wäre, alles zu versiegeln und für öffentliche Seiten den
Schlüssel mitzuliefern. Ein Schlüssel, den jeder bekommt, ist keiner. Es sähe
nach Schutz aus, wo keiner ist — und das ist schlechter als sichtbar
ungeschützt, weil sich jemand darauf verlässt.

Ein Teil ist deshalb **entweder** öffentlich (Klartext) **oder** intern
(versiegelt unter dem Epochenschlüssel des Bereichs). Die Datenbank erzwingt,
dass genau eines gilt (`ck_rc_event_part_form`) — sonst entstünde irgendwann
eine Zeile mit beidem, und niemand wüsste mehr, welche Fassung zählt.

Dieselbe Linie zieht sich durch das Formular: die **Beschriftung** ist
öffentlich, sie steht auf einer Seite, die verschickt werden soll. Die
**Antwort** ist es nie.

### Der Annahmeschlüssel — das Problem, das erst beim Hinsehen auftauchte

Wer sich zu einem Pfarrfest anmeldet, legt sich dafür kein Konto an. Er hat
also keinen Schlüssel, und die Antworten sollen trotzdem nur die
Vorbereitenden lesen können.

Der erste Anlauf schrieb einen 503 und einen Kommentar, der einen Mechanismus
beschrieb, den es nicht gab. Das war die unangenehmste Stelle des ganzen
Moduls: der Kommentar klang plausibel, der Code tat nichts, und niemand hätte
es gemerkt, bevor jemand ein Formular veröffentlicht.

Der zweitnaheliegende Weg wäre auch falsch gewesen: den Klartext schicken und
den **Server** versiegeln lassen. Dann liegt zwar nichts im Klartext auf der
Platte — aber der Server *sieht* ihn, und das ist genau die Zusage, die diese
Plattform nicht brechen will.

Jede Veranstaltung bekommt deshalb ein eigenes RSA-Paar. Der öffentliche Teil
reist **mit dem Formular**, der private liegt versiegelt unter dem
Epochenschlüssel des Bereichs. Der Browser des Anmelders würfelt einen
Sitzungsschlüssel, versiegelt damit die Antworten und verpackt ihn unter dem
Annahmeschlüssel. Der Server kann keines von beiden öffnen und legt sie nur
hin.

Welcher der beiden Wege gilt, entscheidet sich **am Schlüssel** und nicht an
einem Merker aus der Anfrage. Ein Feld `istVonAussen` wäre eine Angabe, die
der Absender selbst macht — und damit keine.

### Der Migrationslauf hat mich zu Recht angehalten

`rc_0006` war angewendet, als der Entwurfsfehler auffiel. Der Lauf weigerte
sich, die geänderte Datei anzuwenden: *„Eine angewendete Migration wird nicht
bearbeitet, sondern ergänzt."*

Das ist richtig, und es ist mein eigener Code. Zulässig war das Zurücknehmen
nur, weil das Skript diese Maschine nie verlassen hat — mit einem ausdrücklichen
Rollback-Skript, nicht mit einem Schalter, der die Prüfung umgeht. Für den
Annahmeschlüssel gab es dann folgerichtig `rc_0007`, obwohl es „nur drei
Spalten" waren.

### Ein Fremdschlüssel auf eine Tabelle, die es nicht gibt

`fk_rc_event_tenant` zeigte auf `dbo.rc_tenant`. Die gibt es nicht: der
Mandant ist überall eine blosse Kennung ohne eigene Tabelle. Der Lauf brach ab
und rollte zurück — die Datenbank stand danach exakt wie vorher.

Kein grosser Befund, aber ein gutes Zeichen: der Fehler fiel in der Sekunde
auf, in der er entstand, und nicht beim ersten Schreibversuch in einem halben
Jahr.

### Ein Testvektor prüft das Format, nicht die Verabredung

Für das Verpacken eines Schlüssels unter einem öffentlichen RSA-Schlüssel liegt
jetzt ein gemeinsamer Vektor bereit (`backend/rc-wrap-vector.json`, EINE Datei,
von beiden Seiten gelesen). Er prüft Schlüsselkennung, Kopf und Label, und er
enthält eine Hülle, die der **Browser** erzeugt hat und die der **Kernel**
auspackt — ein echter Rundlauf über die Sprachgrenze. Ein gekipptes Byte lässt
ihn fehlschlagen; das ist nachgestellt worden.

Er hat den eigentlichen Fehler trotzdem nicht gefunden.

Der Browser verpackte den Sitzungsschlüssel unter der AAD der **Antwort**
(`events:registration:<id>:answer:1`), der Server packte ihn unter der AAD der
**Veranstaltung** aus (`events:event:<id>:intake_key:1`). Beide Seiten waren
für sich schlüssig, beide rechneten formal richtig, und nichts ging auf.

Der Vektor konnte das nicht sehen: er prüft, ob beide Seiten dieselben Bytes
bilden, wenn sie sich über den Platz einig sind — nicht, ob sie sich einig
sind. Gefunden hat es der Durchgang gegen den laufenden Dienst, an genau der
Prüfung, die dafür da war: *„Was der fremde Browser versiegelt hat, geht hier
auf."*

Die Lehre: ein Formatvektor und ein Durchgang durch den echten Ablauf prüfen
**verschiedene Dinge**, und keiner ersetzt den anderen. Der verpackte Schlüssel
hat jetzt einen eigenen, benannten Platz — an der Anmeldung, mit dem Feldnamen
eines Schlüssels.

### Eine Prüfung, die in Wahrheit der Fehlerfall ist

`ctx.RcUnlockPiece()` **wirft**, wenn kein Öffnungsstück mitkam. Für jeden
Endpunkt, der ohne Schlüssel nichts tun kann, ist das genau richtig.

Die Anmeldung zu einer Veranstaltung ist der erste Endpunkt, der beides bedienen
muss: mit Konto und ohne. Dort stand

    if (session is not null && ctx.RcUnlockPiece() is not null)

Das sieht aus wie eine Prüfung und ist der Fehlerfall selbst — der Aufruf wirft,
bevor irgendein Vergleich stattfindet, und jede kontolose Anmeldung endete mit
*„Bitte entsperren"*. Dafür gibt es jetzt `RcHasUnlockPiece()`, das nur
nachsieht.

Der allgemeine Fall: eine Zugriffsfunktion, die bei Abwesenheit wirft, darf
nicht in einem Ausdruck stehen, der Abwesenheit als zulässig behandelt. Der
Rückgabetyp `byte[]` — nicht `byte[]?` — sagt das eigentlich schon.

### Derselbe DBNull-Fehler, zum zweiten Mal

`AddWithValue(name, DBNull.Value)` leitet den Typ aus dem Wert ab und kommt auf
nvarchar. Gegen eine varbinary-Spalte bricht das ab — beim Ausführen, nicht beim
Übersetzen.

Genau dieser Fehler steht schon weiter oben in diesem Bericht, an einer anderen
Tabelle. Er ist trotzdem wiedergekommen, an drei Stellen gleichzeitig, weil ein
Hilfsdurchlauf ihn bequem gemacht hat:

    private static void Null(SqlCommand cmd, params string[] names)

Ein Helfer, der eine Falle wiederholbar macht, ist schlechter als die Falle. Er
nimmt den Typ jetzt entgegen.

### Was die Prüfreihen NICHT abdecken

Das Veranstaltungsmodul hat 34 Schritte im Durchgang gegen den laufenden
Dienst, aber **keine einzige Prüfung in `Rc.Api.Tests`**. Die 164 dort sind
unverändert die alten.

Das ist kein Versehen, sondern eine offene Stelle: der Durchgang prüft den Weg
durch den echten Klienten, die API-Prüfreihe prüft Randfälle, die ein Klient gar
nicht erst versucht — fremde Kennungen, überlange Eingaben, Reihenfolgen, die
die Oberfläche nicht anbietet. Beides wird gebraucht.

### Zwei Fehler in vier Zeilen, beide nur von der API-Prüfreihe gefunden

Die Rücknahme einer Anmeldung enthielt:

    if (!allowed && session is not null && submitter is not null)
    {
        await using var connection2 = connection;
        allowed = (await permissions.CheckAsync(..., RcCapability.Read, ...)).Allowed;
    }

**Erstens** schliesst `await using var connection2 = connection;` die Verbindung
am Ende des Blocks — die anschliessende Änderung lief gegen eine geschlossene
Verbindung. Ein Überbleibsel aus einer früheren Fassung, das übersetzte und
plausibel aussah.

**Zweitens**, und schlimmer: geprüft wurde auf **Lesezugriff im Bereich**. Damit
hätte jedes Mitglied die Anmeldung jedes anderen zurücknehmen können — und die
Zeile sähe danach aus, als habe der Einsender selbst zurückgezogen. Richtig ist:
wer unter einem Namen eingesandt hat, darf unter demselben Namen zurücknehmen,
und geprüft wird der **Schlüssel** der Rolle, nicht eine Behauptung.

Der Durchgang gegen den laufenden Dienst hat beides NICHT gefunden: dort nimmt
der Einsender mit seinem Beleg zurück, und dieser Weg funktionierte. Gefunden
hat es die API-Prüfreihe an der Stelle, die genau dafür da war — *„Die Leitung
darf zurücknehmen"*.

Das ist die Begründung dafür, beide Reihen zu führen. Der Durchgang prüft den
Weg, den ein Klient nimmt; die API-Reihe prüft die Wege, die er nicht nimmt —
und dort sitzen die Berechtigungsfehler.

### Eine Rücksetzung, die neue Tabellen nicht kennt, bricht alles

Nach den ersten Veranstaltungs-Prüfungen scheiterte der GANZE Lauf: die
Rücksetzung der Prüfdatenbank kannte `rc_event*` nicht und lief in einen
Fremdschlüssel. Kein Befund über die Plattform, aber eine Erinnerung daran, dass
eine neue Tabelle drei Stellen berührt — Schema, Code und den Weg zurück auf
Null. Die anfügenden Auslöser müssen dafür kurz abgeschaltet werden; im Betrieb
ist genau das ihr Sinn, hier steht ein Neuanfang an.

### Die Intention: eine Zeile, zwei Sichtbarkeiten

Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte: ein Teil ist
öffentlich **oder** intern, und die Datenbank erzwingt, dass genau eines gilt.

Bei einer Messintention gilt beides gleichzeitig, in derselben Zeile:

    public_text        "in einer bestimmten Absicht"   steht im Schaukasten
    internal_sealed    was wirklich gemeint ist         nur die Pfarrei
    donor_ref_sealed   von wem                          nur die Pfarrei

Das ist kein Sonderfall, sondern der Alltag. Und es ist die Stelle, an der sich
die **Feldnamen aus 3.13** zum ersten Mal wirklich bewähren: drei Felder
derselben Zeile, drei verschiedene Etiketten. Trügen sie dasselbe, könnte wer
Schreibzugriff hat den Stifternamen in das interne Feld schieben — lautlos,
ohne Fehlermeldung, ohne Protokolleintrag.

Genau das prüft eine der neuen Prüfungen: sie kopiert den Geheimtext des
Stifterfeldes per SQL in das interne Feld. Er ist gültig verschlüsselt und
gehört derselben Zeile. Trotzdem geht er nicht auf — das Etikett passt nicht,
und die Antwort trägt `crypto.aad_mismatch` statt den Stifternamen.

Der Altbestand hatte die Aufteilung bereits (`ParishIntention.cs`:
`PublicText` neben `InternalTextEnc` und `DonorRefEnc`). Übernommen wurde die
Einsicht, nicht der Code — und ergänzt wurde, was fehlte: dass die drei Felder
sich nicht gegeneinander tauschen lassen.

### Ein Betrag ist eine Zeichenkette

Gaben liegen versiegelt, und der Betrag reist als Zeichenkette statt als Zahl.
Zwei Gründe, beide unbequem:

**Er wird ohnehin nie gerechnet.** Was verschlüsselt in der Zeile liegt, lässt
sich nicht summieren — eine Summe über alle Gaben ist in SQL nicht bildbar. Wer
sie will, holt die Zeilen und rechnet mit dem Schlüssel in der Hand. Das ist
der Preis von 12.9 und er ist bekannt.

**Eine Gleitkommazahl ist ein Rundungsfehler, der auf eine Gelegenheit
wartet.** Bei Geld ist das keine Theorie. Da der Wert ohnehin nur gespeichert
und wieder angezeigt wird, bleibt er, was jemand hingeschrieben hat.

Die Währung dagegen ist Klartext: sie ist keine Auskunft über eine Person, und
ohne sie liesse sich ein Betrag nicht einmal darstellen. Drei Buchstaben,
erzwungen von der Datenbank — ein Tippfehler dort bedeutet, dass zwei Beträge
später nicht mehr vergleichbar sind.

### Gaben werden gegengebucht, nicht geändert

Der anfügende Auslöser auf `rc_offering` deckt **UPDATE** ab, nicht nur DELETE
— anders als bei Nachrichten oder Anmeldungen. Das ist die Regel in jeder
Kasse, und sie steht hier in der Datenbank statt in einer Handreichung.

Folge für die Prüfreihe: die Rücksetzung muss den Auslöser kurz abschalten, wie
schon bei den anfügenden Tabellen davor. Eine neue Tabelle berührt drei Stellen
— Schema, Code und den Weg zurück auf Null.

### Zwei Eingabefelder, die gleich aussehen und es nicht sind

Das Formular für eine neue Intention hat ein Feld „was im Schaukasten steht"
und daneben eines „was wirklich gemeint ist". Beide nehmen Text entgegen,
beide sehen aus wie ein Textfeld — und der Unterschied ist der grösste im
ganzen Modul: das eine wird verlesen und gedruckt, das andere sieht niemand
ausserhalb der Pfarrei.

Ohne sichtbaren Unterschied stünde diese Unterscheidung nur im Kopf dessen, der
gerade tippt. Und der tippt sie irgendwann falsch herum.

Deshalb tragen die beiden **verschiedene Ränder**, und unter jedem steht, was
mit dem geschieht, was man hineinschreibt — auch unter dem öffentlichen. Es ist
dieselbe Entscheidung; sie nur beim ungewöhnlichen Fall zu erklären hiesse, den
Normalfall als selbstverständlich auszugeben, was er nicht ist.

Dieselbe Linie zieht sich durch die Anzeige: der öffentliche Text steht in der
Serifenschrift des Aushangs, der interne Vermerk daneben in kleinerer Schrift
mit farbigem Rand. Beide gleich zu setzen würde den Unterschied ausgerechnet
dort verwischen, wo er zählt.

### Volltextsuche und Verschlüsselung schliessen einander aus

`cogita-graph.md` §5.2 verlangt: *„All indexed fields searched."* Das setzt
Klartext voraus. Ein Server durchsucht nicht, was er nicht lesen kann.

Es gibt Verfahren, die so tun als ob — deterministische Verschlüsselung,
Blind-Index, verschlüsselte Suchbäume. Sie verraten alle etwas: Gleichheit,
Häufigkeit, Zugriffsmuster. Bei einem Vokabelheft ist das egal, bei
persönlichen Notizen nicht, und die Plattform kann nicht wissen, welches von
beiden gerade angelegt wird.

Aufgelöst wird das nicht mit einem Trick, sondern mit einer **Entscheidung je
Bibliothek**:

- **öffentlich** — Klartext, der Server durchsucht. Für Vokabeln,
  Periodensysteme, Zeitleisten: Wissen, das in jedem Lehrbuch steht.
- **privat** — versiegelt unter dem Epochenschlüssel. Der Server sieht
  Geheimtext, und **der Browser sucht** in dem, was er ohnehin geladen hat.

Die zweite Form skaliert schlechter. Das ist der Preis, und er steht im Schema,
im Endpunkt und im Klienten — damit ihn niemand später für einen Fehler hält.
Die Wahl fällt beim Anlegen und lässt sich nicht umlegen: aus öffentlich privat
zu machen hiesse, alles nachträglich zu verschlüsseln, während die
Klartextfassung schon in der Welt ist.

**Das wichtigste Feld der ganzen Antwort ist `serverSide`.**

`false` heisst NICHT „nichts gefunden", sondern „hier kann ich nicht suchen".
Ohne dieses Feld sähen beide Fälle identisch aus, und die Oberfläche meldete
eine leere Trefferliste, wo sie selbst hätte suchen müssen. Der Unterschied
zwischen *„ich habe gesucht und nichts gefunden"* und *„ich kann hier nicht
suchen"* ist genau die Auskunft, die eine verschlüsselte Plattform schuldig
bleibt, wenn sie nicht aufpasst.

Beide Wege sortieren gleich — genauer Treffer zuerst, dann der kürzere. Wer in
einer privaten Bibliothek eine andere Reihenfolge bekäme als in einer
öffentlichen, hielte das für einen Fehler und hätte recht.

### Eine Tabelle für alle Knoten

EntityKind, EdgeKind, Range, Text, Zahl, Datum und jede vom Benutzer erfundene
Art sind **Knoten derselben Tabelle** (§1.2, §1.10). Sie zu trennen hiesse, bei
jeder neuen Art eine Migration zu schreiben — und der ganze Punkt ist, dass der
Benutzer neue Arten erfindet, ohne dass jemand etwas baut.

Was in der Datenbank steht, ist deshalb dünn: Kennung, Art, Bibliothek, Wert.
Was eine Art *bedeutet*, steht in einem Knoten derselben Tabelle.

Die **Art** bleibt dabei immer Klartext, auch in einer privaten Bibliothek —
dieselbe Überlegung wie bei den Abschnitten einer Veranstaltung: sie ist
Struktur, ohne sie liesse sich der Graph nicht einmal zeichnen, und sie verrät
nur, *dass* es eine Person gibt, nicht wer.

### Ein richtiges Nein mit falscher Begründung

Eine Kante von einem Knoten auf sich selbst wurde abgewiesen — aber mit
*„beide Knoten müssen zu dieser Bibliothek gehören"*. Die Prüfung zählte
`id IN (@from, @to)`, und bei zwei gleichen Kennungen ist das **eine** Zeile,
nicht zwei.

Das Ergebnis war richtig, die Auskunft falsch, und der Test bemerkte es. Wer
danach gesucht hätte, hätte an der Bibliothekszugehörigkeit gesucht statt an
der Schlinge. Sie wird jetzt zuerst geprüft, vor allem anderen.

### Beide Folgen stehen da, nicht nur die der angeklickten Hälfte

Beim Anlegen einer Bibliothek fällt die Entscheidung offen/versiegelt, und sie
lässt sich nie wieder umlegen. Die naheliegende Oberfläche wäre ein Schalter
mit einem Hinweis darunter, der sich je nach Stellung ändert.

Das wäre zu wenig. Wer nur den Hinweis zur gewählten Hälfte liest, kennt die
Entscheidung nicht — er kennt eine Hälfte davon. Also stehen **beide** Folgen
untereinander, die gewählte hervorgehoben, die andere blass daneben. Dazu ein
Satz in Warnfarbe: dass die Wahl einmal fällt.

Dieselbe Überlegung wie bei der Intention und beim Einladen unter der
persönlichen Rolle: eine Entscheidung, die sich nicht zurücknehmen lässt, muss
vor dem Klick vollständig lesbar sein — nicht als Fussnote, sondern als der
eigentliche Inhalt des Formulars.

### Die Suche schreibt hin, wo sie gesucht hat

`serverSide: false` heisst „ich kann hier nicht suchen", nicht „nichts
gefunden". Der Klient sucht dann selbst — aber nur in dem, was geladen ist.

Die Trefferliste allein wäre damit eine Lüge über ihre eigene Vollständigkeit.
Über ihr steht deshalb ein Satz: **auf dem Server gesucht** oder **hier im
Browser gesucht**, und im zweiten Fall dazu, dass „hier" nicht zwingend
„alles" heisst. Warnfarbe, nicht grün: es ist kein Fehler, aber auch keine
Vollständigkeit.

### „Nicht bekannt" wird ausgeschrieben

Der Zustand einer Kante steht als Wort da, nicht als leeres Feld. Der
Unterschied ist der Gewinn des ganzen Modells: ein leeres Feld heisst „niemand
hat sich damit befasst", `unknown` heisst „wir haben nachgesehen und wissen es
nicht". Eine Oberfläche, die beides gleich zeigt, wirft genau das weg, wofür
die Envelope aus §1.6 gebaut ist.

### Zeit ist nicht Inhalt

Der Kalender trennt anders als alles davor. Bei den Veranstaltungen trennt die
Sichtbarkeit ganze Abschnitte, bei einer Messintention Felder derselben Zeile
— hier trennt sie **die Zeit vom Anlass**:

    WANN jemand belegt ist   →  Klartext
    WOMIT er belegt ist      →  versiegelt

Ein Kalender, der die Zeiten mitverschlüsselt, kann drei Dinge nicht mehr:
freie Zeiten finden, ohne alles herunterzuladen und zu entschlüsseln;
Überschneidungen melden, bevor jemand doppelt zusagt; eine Wiederholung
ausrechnen, ohne den Schlüssel zu haben.

Das ist kein Verlust an Schutz, sondern eine ehrliche Grenze: *dass* jemand
Dienstag um zehn belegt ist, verrät ungleich weniger als *wobei*. Wer auch das
verbergen will, legt den Termin in einen Kalender, den nur er sieht — dann
sieht niemand die Zeit, weil niemand den Kalender sieht.

**`title_public` ist kein entschlüsselter Titel**, sondern ein eigenes Feld:
was andere sehen dürfen. Oft nichts, manchmal „Sitzung", nie „Gespräch mit
Frau K. wegen der Kündigung". Beides in einem Feld zu führen hiesse, dass jede
Anzeige entscheiden muss, wie viel sie verrät — und irgendeine entscheidet
falsch.

Daraus folgen in der Oberfläche **drei** Arten von „kein Titel", die nicht
gleich aussehen dürfen: *versiegelt* (es steht etwas da, du kannst es nicht
öffnen), *belegt* (es gibt nichts Öffentliches zu sagen) und *benannt*.

### Eine grüne Prüfung, die nichts prüfte

Die Prüfung „ein Termin in der übersprungenen Stunde fällt nicht aus" setzte
den Anfang auf 01:30 UTC. In Warschau sind das 03:30 örtlich — **hinter** der
Lücke. Sie war grün und prüfte nichts.

Es gibt keinen UTC-Zeitpunkt, der auf 02:30 örtlich fällt; die Zeit existiert
nicht. Erreichen lässt sie sich nur über eine Reihe: am 28. um 02:30 örtlich
beginnen, täglich weiter, und der 29. landet in der Lücke. Jetzt prüft sie,
dass der Termin auf 03:00 rückt statt auszufallen.

Eine grüne Prüfung, die ihren Fall nicht trifft, ist schlimmer als keine: sie
erzeugt Zuversicht, die nichts trägt.

### `GetAmbiguousTimeOffsets()[0]` ist nicht die erste Stunde

Bei der Rückstellung gibt es eine Stunde zweimal. Der Kommentar im Code sagte
„genommen wird die erste" und der Code nahm `[0]` — das ist in .NET die
**Winterzeit**, also der *spätere* Zeitpunkt. Genau das Gegenteil.

Die Reihenfolge dieser Liste ist ohnehin nicht zugesagt. Genommen wird jetzt
ausdrücklich der **grösste Versatz** = die früheste UTC-Zeit = das erste
Vorkommen der doppelten Stunde. Wer „halb drei" sagt, meint das erste halb
drei.

### Zeitstempel werden nicht als Zeichenketten verglichen

Derselbe Augenblick sieht je nach Absender anders aus: der Dienst schreibt
`2026-03-02T08:00:00+00:00`, JavaScript schreibt `2026-03-02T08:00:00.000Z`.
Als Text zwei verschiedene Dinge, als Augenblick derselbe.

`rcOverlaps` verglich Zeichenketten. Innerhalb der Antworten des Dienstes ging
das gut, weil dort alle dasselbe Format haben — die Prüfungen mit gebauten
Daten liefen grün. Aufgefallen ist es erst im Durchgang gegen den laufenden
Dienst. Genau dafür gibt es ihn.

### Eine Wiederholung braucht ein Ende

Eine Reihe ohne Ende lässt sich nicht ausrechnen, nur abschneiden — und jede
Ansicht schneidet woanders ab. Die Datenbank verlangt deshalb entweder ein
Datum oder eine Anzahl, genau eines von beidem.

Und die Reihe bleibt eine **Regel**: wird ein einzelnes Vorkommen abgesagt
oder verschoben, entsteht eine Ausnahmezeile, nicht fünfzig Einzeltermine.
Wer die Reihe bei der ersten Änderung auflöst, verliert „jeden Montag" für
immer.

### Drei Arten von „kein Titel"

Im Kalender heisst eine leere Beschriftung dreierlei, und die drei dürfen
nicht gleich aussehen:

- **belegt** — es gibt nichts Öffentliches zu sagen. Das ist keine Lücke,
  sondern die Aussage: *belegt, mehr geht dich nichts an.*
- **versiegelt** — hier steht etwas, dieser Leser hat den Schlüssel nicht.
- **benannt** — es gibt einen Titel, öffentlich oder entschlüsselt.

Sie gleich darzustellen wäre die Art Fehler, die niemandem auffällt und dazu
führt, dass jemand einen Tag für leer hält, an dem er es nicht ist. Der eigene,
entschlüsselte Titel steht kräftiger als die Zusammenfassung, die für andere
gedacht war; ein versiegelter Eintrag trägt einen gestrichelten Rand statt
eines durchgezogenen.

Und: **der entschlüsselte Titel gewinnt.** Wer den Schlüssel hat, will sehen,
was es wirklich ist — nicht das, was für andere geschrieben wurde.

### Überschneidungen sind der sichtbare Gegenwert

Dass die Zeiten im Klartext liegen, ist eine Einschränkung, die man erklären
muss. Die Ansicht erklärt sie nicht mit Worten allein, sondern zeigt, wofür
bezahlt wird: sie meldet Überschneidungen, und der Satz daneben sagt, dass
genau das ohne Klartext-Zeiten nicht ginge.

Ganztägige zählen dabei nicht mit. „Den ganzen Tag Urlaub" und „um zehn ein
Termin" ist kein Konflikt, sondern der Normalfall — eine Warnung dafür wäre
Lärm, und Lärm wird nach dem dritten Mal weggeklickt.

### Das Ende einer Wiederholung steht da, bevor es fehlt

Der Dienst weist eine Reihe ohne Ende ab. Die Oberfläche zeigt das Feld
deshalb, **sobald** eine Wiederholung gewählt wird — mit einem brauchbaren
Vorgabewert. Es hinterher als Absage zu erklären wäre derselbe Fehler wie ein
Knopf, der zuverlässig mit einem Nein endet.

Dasselbe beim Ende eines Termins: wer einen Anfang wählt, bekommt ein Ende
eine Stunde später eingetragen. Der Dienst würde einen rückwärts laufenden
Termin abweisen; ihn gar nicht erst entstehen zu lassen ist billiger als die
Erklärung danach.

### Firmung: drei Dinge aus dem Altbestand, die nicht übernommen werden

Kandidaten sind Minderjährige. Was über sie gespeichert wird, ist besondere
Kategorie nach 12.9 ohne Abwägung — Religionszugehörigkeit ist es per
Definition, und alles andere hängt daran. Drei Stellen des Altbestands werden
deshalb ausdrücklich **nicht** übernommen:

**1. Notizen lagen im Klartext.** `ParishConfirmationNote.NoteText` war eine
gewöhnliche Textspalte, mit einem `IsPublic`-Schalter daneben. Eine Notiz über
ein Kind, unter seinem Namen, lesbar für jeden mit Datenbankzugriff. Hier liegt
sie versiegelt — und die Unterscheidung bleibt, weil sie richtig ist: was die
Eltern sehen dürfen, ist etwas anderes als was der Katechet sich notiert.

Wichtig dabei: **`forFamily` heisst nicht „unverschlüsselt".** Beide liegen
versiegelt. Anders als beim Messplan, wo öffentlich wirklich am Schaukasten
hängt, gibt es bei einem Kind kein „öffentlich" — nur einen engeren und einen
weiteren Kreis.

**2. Token lagen roh in der Zeile.** `HostInviteToken` und
`VerificationToken` waren Zeichenketten in der Tabelle. Wer die Tabelle hatte,
hatte die Token. Es gibt keinen zweiten Token-Baustein: `rc_token` trägt auch
diese (10.3.1), und gespeichert wird nur der Abdruck.

**3. Ein einziger verschlüsselter Klumpen für alles.** `PayloadEnc` war
bequem — und das heimtückischste von den dreien. Mit einem Klumpen lässt sich
der Datensatz eines Kindes gegen den eines anderen tauschen, ohne dass etwas
auffällt. Jedes Feld trägt jetzt sein eigenes Etikett (3.13), und eine Prüfung
schiebt den Kontakt in das Namensfeld: es fällt auf, und der Kandidat fällt
trotzdem nicht aus der Liste.

### Ein eigener Bereich für die Akten

Der Jahrgang hängt nicht am Bereich der Pfarrei, sondern an einem eigenen. Wer
den Messplan pflegt, hat damit nicht auch Zugriff auf die Akten der Kinder —
und genau dafür ist ein Bereich die Einheit der Sichtbarkeit.

Der Dienst verlangt beim Anlegen Verwaltungsrecht in **beiden**: in der Pfarrei
und im Zielbereich. Ohne das zweite wäre der eigene Bereich ein Vorschlag und
keine Grenze — wer die Pfarrei verwaltet, könnte den Jahrgang in einen Bereich
hängen, den er selbst kontrolliert.

### Was im Klartext bleibt, und warum

Die Ablaufmerker (Einwilligung da, Papier da, Quiz bestanden) und die Zeiten
und Plätze der Treffen liegen im Klartext. Sie sagen nichts über die Person,
sondern über den **Vorgang** — und ohne sie liesse sich die häufigste Frage
eines Katecheten („wer muss noch was abgeben") nur beantworten, indem jeder
Datensatz entschlüsselt wird.

Dieselbe Linie wie im Kalender: die Zeit ist nicht der Anlass, der Merker ist
nicht die Person.

### Der Belegte hört nicht, das Treffen sei voll

Beim Buchen eines Platzes prüfte der erste Anlauf die Kapazität, bevor er sah,
ob dieser Kandidat bereits gebucht hat. Bei einem Einzelplatz führte das dazu,
dass derjenige, der **selbst darin sitzt**, beim zweiten Klick „dieses Treffen
ist voll" bekam.

Richtig ist die andere Reihenfolge: wer schon sitzt, nimmt keinen neuen Platz.
Erst danach die Kapazität. Die Prüfung hat es gefunden — sie erwartete eine
freundliche Antwort und bekam eine Absage.

Die Kapazität selbst wird in einer **serialisierbaren** Transaktion geprüft.
Zwei gleichzeitige Anmeldungen auf den letzten Platz sind bei einem Jahrgang,
dem morgens um acht die Liste freigeschaltet wird, der Regelfall — eine Prüfung
ausserhalb der Transaktion ist genau dann falsch, wenn es darauf ankommt.

### „Für die Familie" ist kein offenes Schloss

Beim Messplan heisst öffentlich: es hängt am Schaukasten, es liegt im
Klartext. Bei einem Kind gibt es das nicht — beide Arten von Notiz liegen
versiegelt, und `forFamily` sagt nur, **wer** sie lesen darf.

Die Oberfläche muss das aussprechen, sonst liest sich der Schalter wie „diese
hier verschlüsseln wir nicht". Er trägt deshalb einen Satz, der immer
dasteht — nicht nur, wenn er angehakt ist. Und beide Notizarten haben dieselbe
Grundform, nur einen anderen Rand: ein offenes Schloss neben der einen wäre
eine Lüge über den Schutz.

Aus demselben Grund tragen im Aufnahmeformular **alle** Felder denselben Rand.
Beim Messplan und im Kalender unterscheiden sie sich, weil sich die
Sichtbarkeit unterscheidet. Hier ist nichts öffentlich, und ein Feld, das
anders aussieht, würde etwas anderes behaupten.

### Die häufigste Frage steht ganz oben

„Wer muss noch was abgeben" ist die Frage, die ein Katechet am häufigsten
stellt — und sie lässt sich aus den Klartext-Merkern beantworten, ohne einen
einzigen Datensatz zu öffnen.

Sie steht deshalb über der Liste, mit dem Satz daneben, warum das geht. Ohne
ihn sähe es aus, als würde hier fahrlässig etwas offen gelassen; mit ihm ist
sichtbar, dass die Merker den **Vorgang** betreffen und nicht die Person.

Dieselbe Linie wie überall: was im Klartext liegt, liegt dort aus einem Grund,
und der Grund wird genannt statt verschwiegen.

### Eine Tabelle ohne Code ist ein Versprechen, das niemand hält

Nach dem Einchecken der Module trug **eine** von 56 Tabellen keinen Code:
`rc_range_segment`, die Abschnitte eines Bereichsknotens (§1.6a). Sie stand im
Schema, war migriert, hatte Bedingungen und einen Index — und nichts schrieb je
hinein.

Das ist schlechter als eine fehlende Tabelle. Wer das Schema liest, sieht eine
Zusage; wer den Code liest, findet sie nicht eingelöst, und beide halten das
jeweils andere für den Fehler.

Zwei ehrliche Auswege: umsetzen oder entfernen. Umgesetzt, weil §1.6a genau
das ist, wofür der Graph gebaut ist — ein König, der 992–1000 und wieder
1002–1025 regierte, hat EINE Regierung mit zwei Abschnitten. In zwei Kanten
zerlegt behauptete man zwei Regierungen.

**Setzen ersetzt die Liste vollständig.** Ein Bereich ist EIN Wert, kein
Behälter, in den man einzeln hineinlegt. Abschnitte einzeln anzufügen hiesse,
dass es zwischendurch einen Zustand gibt, in dem nur die halbe Regierung
dasteht — und irgendeine Anzeige liest genau dann.

### Was eine Darstellung behauptet

`rcSegmentText` beantwortet nicht „wie sieht es hübsch aus", sondern „was sagt
die Darstellung":

- Ein **offenes Ende** wird gezeigt (`1002 …`) und nicht weggelassen. „Ab 1002"
  ist eine Aussage; ein fehlendes Ende sähe aus wie ein vergessenes Feld.
- **Ungefähr** steht dabei (`~0992`). Ein ungefähres Datum als genaues zu
  zeigen ist eine Genauigkeit, die es nicht gibt.
- Zwei Abschnitte stehen als **ein** Wert (`0992–1000, 1002–1025`), nicht als
  zwei Zeilen.

Dieselbe Linie wie überall: die Anzeige darf nicht mehr behaupten, als die
Daten hergeben — und nicht weniger.
