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
