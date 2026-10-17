/**
 * Das Formular von innen — Fragen stellen, Antworten lesen.
 *
 * <b>Drei Dinge müssen stehen, bevor ein Formular etwas sammeln darf:</b>
 *
 * <code>
 *   ein Bereich          dessen Schlüssel die Fragen versiegelt
 *   ein Annahmepaar      dessen öffentliche Hälfte die Antworten verschliesst
 *   eine Klausel         die sagt, wer für die Daten geradesteht
 * </code>
 *
 * Fehlt das dritte, sammelt die öffentliche Seite nichts — und sagt warum.
 * Das ist keine Vorsicht: Art. 13 verlangt, dass der Mensch VORHER weiss, wer
 * seine Daten verarbeitet.
 *
 * <b>Antworten öffnet nur, wer den Schlüssel des AMTES hat.</b> Der private
 * Annahmeschlüssel liegt darunter — nicht unter der Epoche des Bereichs. Sonst
 * läse jeder Helfer sämtliche Einsendungen, ohne dass ihm jemand etwas gegeben
 * hätte.
 */

import type { ReactNode } from 'react';

import { FormControllerNote } from '../areas/AreaController';
import { plural } from '../core/plural';
import { updateModule } from '../modules/module';
import { ModuleSettings } from '../modules/ModuleSettings';
import { MemberRoleSettings } from '../roles/MemberRoleSettings';
import { Portal } from '../seats/Portal';
import { Unlock } from '../shell/Unlock';
import { StepsEditor, stepsKey } from '../steps/StepsEditor';
import { TaskSheets } from '../steps/TaskSheet';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { TidyList, toggled } from '../workspace/TidyList';
import { deskRows } from './entryDesk';
import { ExtensionSheet, OfficeAdd } from './ExtensionSheet';
import { FieldEditor, NewFieldForm } from './FieldEditors';
import { IDENTITY_LABEL, KIND_LABEL, removeField, restoreField } from './form';
import { FormBasics, FormFamily } from './FormFamily';
import { FormLayout } from './FormLayout';
import { LinkCheckBox } from './FormLinks';
import { FormLogic } from './FormLogic';
import { People } from './FormPeople';
import { AfterSendSettings, ExtensionOf, Extensions, IntakeMissing, Naming, NeedsPanel } from './FormSettings';
import { FormTable } from './FormTable';
import { ListJsonPanel } from './ListJsonPanel';
import { hideSubmission, removeSubmission } from './submissions';
import { useFormOffice, type FormOfficeProps, type FormTabName } from './useFormOffice';

export function FormOffice(props: FormOfficeProps) {
  const { who, module, onModuleChanged, partId, standsOn } = props;
  const {
    act, allFields, areaLabel, areas, areasHere, busy, byId, conf, crooked, crookedKey, current, design, designLocked,
    editing, extData, failed, fields, hiddenNotice, intakes, isExtension, keyOf, layout, loadStepInfo, locks, look,
    moduleAct, newSince, note, openAll, opened, person, readAreas, reading, readsHere, removedFields, removedNote,
    reread, resealFor, ring, saveDesignNow, saveField, saveTable, setEditing, setFailed, setRemovedNote, setSaved,
    setShowHidden, setSkipped, setTab, setTidyOpen, showHidden, shutAreas, skipped, staleNotice, stepInfo, straighten,
    submissions, tab, tableToo, tidyFields, tidyOpen
  } = useFormOffice(props);

  return (
    <>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {busy !== null && <p className="wk-hint" role="status">{busy}</p>}

      {/*
        NICHT NUR SAGEN, SONDERN ÖFFNEN. Hier stand bloss der Satz — und wer
        ihn las, hatte keinen Ort, das Passwort einzugeben, ausser in einer
        anderen Ansicht.
      */}
      {ring === null && (
        <Unlock
          who={who}
          why="Bez hasła nie da się ani zapieczętować pytania, ani otworzyć odpowiedzi."
          onDone={() => void look()}
        />
      )}

      {/* 0096 — das Hauptformular und seine Unterformulare: öffnen, bearbeiten, eines dazu; die Karte. */}
      {module !== undefined && module.kind === 'form' && <FormFamily module={module} onChanged={() => void onModuleChanged?.()} />}

      <div className="wk-tabs" role="tablist" aria-label="Formularz">
        <FormTab now={tab} mine="people" onPick={setTab}>
          Zgłoszenia
          {(submissions.length > 0 ? submissions.length : module?.entries ?? 0) > 0 && (
            <span className="wk-tab-n">{submissions.length > 0 ? submissions.length : module?.entries ?? 0}</span>
          )}
        </FormTab>
        <FormTab now={tab} mine="questions" onPick={setTab}>Pytania</FormTab>
        {module !== undefined && !isExtension && <FormTab now={tab} mine="steps" onPick={setTab}>Kroki</FormTab>}
        {module !== undefined && <FormTab now={tab} mine="settings" onPick={setTab}>Ustawienia</FormTab>}
        {/* Werkzeuge: leiser, rechts — da, ohne umzuschalten. */}
        <span className="wk-tab-tools">
          {module !== undefined && <FormTab now={tab} mine="layout" onPick={setTab}>Układ</FormTab>}
          {module !== undefined && <FormTab now={tab} mine="logic" onPick={setTab}>Logika</FormTab>}
          {(!isExtension || tableToo) && <FormTab now={tab} mine="entries" onPick={setTab}>Tabela</FormTab>}
        </span>
      </div>

      {/* == 1. DAS FORMULAR ALS GANZES ======================================= */}

      {tab === 'settings' && module !== undefined && (
        <div className="wk-narrow wk-form-settings">
          {/* Wer „czy formularz jest czytelny dla wszystkich" fragt, steht HIER. */}
          {staleNotice}
          {hiddenNotice}

          {/* Name, Bereich, wessen Formular — und neu versiegeln, wenn der Bereich wechselt. */}
          <ModuleSettings
            row={module}
            areas={areas}
            busy={busy !== null}
            onAct={moduleAct}
            reseal={resealFor}
          />

          {/* 0096 — Gruppe, und bei einem Unterformular wer es ausfüllt (der Name steht schon oben). */}
          <FormBasics module={module} busy={busy !== null} onAct={moduleAct} withName={false} />

          {/*
            OFFEN ODER GESCHLOSSEN (0042). Geschlossen nimmt das Formular
            nichts mehr an — es bleibt stehen, mit allem, was eingegangen ist.
          */}
          <div className="wk-field">
            <span>Przyjmowanie zgłoszeń</span>
            <div className="wk-seg" role="group" aria-label="Przyjmowanie zgłoszeń">
              {([false, true] as const).map((closed) => (
                <button
                  key={String(closed)}
                  type="button"
                  aria-pressed={module.closed === closed}
                  className={module.closed === closed ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'}
                  disabled={busy !== null || module.closed === closed}
                  onClick={() => void moduleAct(closed ? 'Zamykanie…' : 'Otwieranie…',
                    () => updateModule(module.moduleId, { closed }))}
                >
                  {closed ? 'Zamknięte' : 'Otwarte'}
                </button>
              ))}
            </div>
            {module.closed && (
              <span className="wk-hint">Formularz stoi na stronie, ale nie przyjmuje nowych zgłoszeń.</span>
            )}
          </div>

          {/* Der Administrator danych steht beim Obszar; hier nur, welcher gilt. */}
          <FormControllerNote areaId={module.areaId} />

          {/*
            DIE ÜBERSCHRIFT DES BOGENS — wie er auf der Seite heisst. Der Name
            oben ist der, unter dem man ihn in der Liste wiederfindet.
          */}
          <Naming
            partId={partId}
            value={conf.title ?? ''}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
          />

          {/* 0083 — WAS NACH DEM ABSENDEN DASTEHT, und ob unterschrieben werden muss. */}
          <AfterSendSettings
            partId={partId}
            config={conf}
            fields={fields}
            busy={busy !== null}
            onSaved={setSaved}
            onError={setFailed}
            onNeeds={module === undefined ? undefined : () => setTab('questions')}
          />

          {isExtension ? (
            /*
             * EINE ERWEITERUNG (0047): wessen, und wer sie ausfüllt. Portal und
             * Link gehören dem erweiterten Formular — die Ergänzung kommt über
             * denselben Link.
             */
            <ExtensionOf
              row={module!}
              busy={busy !== null}
              onRepeat={(repeat) => moduleAct('Zapisywanie…', () => updateModule(module!.moduleId, { repeat }))}
            />
          ) : (
            <>
              {/* WAS NACH DEM ABSENDEN KOMMT — und was der Mensch mit seinem Link bekommt. */}
              <Portal
                moduleId={partId}
                standsOn={standsOn ?? []}
                portalUnder={(conf.portalUnder ?? '').trim()}
                portalAt={(conf.portalAt ?? '').trim()}
                ownerRoleId={person?.id ?? null}
                onSet={(where, at) => {
                  const next: Record<string, string> = { ...conf, portalUnder: where };
                  if (at === '') delete next.portalAt;
                  else if (at !== undefined) next.portalAt = at;
                  setSaved(next);
                }}
              />

              {/* 0091 — WELCHE ROLLE die Menschen dieses Formulars bekommen, und wozu sie führt. */}
              <MemberRoleSettings partId={partId} ring={ring} person={person} areas={areas} onRingChanged={() => void look()} />

              {/*
                DAS ERSTE ÖFFNEN EINES LINKS (0046) — was gefragt wird. Die
                Nachricht selbst schreibt die Kanzlei dort, wo sie sie verschickt:
                unter „Osoby", mit „Napisz SMS".
              */}
              <LinkCheckBox
                partId={partId}
                fields={fields}
                busy={busy !== null}
                onSaved={() => void look()}
                onError={setFailed}
              />

              {/* WAS DIESES FORMULAR ERWEITERT (0047) — für die Kanzlei, und für den Menschen später. */}
              <Extensions
                base={module!}
                extensions={stepInfo?.extensions ?? []}
                busy={busy !== null}
                onCreated={() => act('Zakładanie rozszerzenia…', async () => { await onModuleChanged?.(); })}
                onError={setFailed}
              />
            </>
          )}
        </div>
      )}

      {/* == DIE SCHRITTE (0047) =============================================== */}

      {/* 0099 — LISTA OBECNOŚCI: je Aufgabe an Terminen, je Termin — wer kommt, welche Funktion, wer war da. */}
      {tab === 'steps' && module !== undefined && !isExtension && stepInfo !== null && readAreas !== null && (
        <TaskSheets steps={stepInfo.steps} rows={deskRows({ registrations: submissions, opened, fields }, stepInfo)} onChanged={reread} />
      )}

      {tab === 'steps' && module !== undefined && !isExtension && (
        stepInfo === null ? (
          <Loading label="Wczytywanie kroków…" />
        ) : (
          <StepsEditor
            key={stepsKey(stepInfo.steps)}
            partId={partId}
            steps={stepInfo.steps}
            extensions={stepInfo.extensions}
            formKey={module.areaId === null || ring === null ? null : async () => {
              const { key, epoch } = await keyOf(module.areaId!);
              return { areaId: module.areaId!, epoch, key };
            }}
            busy={busy !== null}
            onSaved={async () => { if (ring !== null) await loadStepInfo(ring); }}
            onError={setFailed}
          />
        )
      )}

      {/* == DIE ERWEITERUNG: je Mensch des erweiterten Formulars (0047) ======== */}

      {tab === 'people' && isExtension && (
        <ExtensionSheet
          extensionId={partId}
          baseId={module!.extendsId!}
          audience={module!.audience}
          who={who}
          repeat={module!.repeat}
          name={module!.name}
        />
      )}

      {/* == 2. DIE FRAGEN ================================================= */}

      {tab === 'questions' && (
        <>
          {/*
            WO DIE FRAGEN LIEGEN (0042). Unter dem Schlüssel des Formulars —
            lesen kann sie, wer diesen Bereich liest. Ist er nicht jawny, sieht
            draussen niemand die Fragen, und das muss man VOR dem Veröffentlichen
            erfahren, nicht danach.
          */}
          {module !== undefined && module.areaId === null && (
            <p className="wk-warn">
              Formularz nie ma własnego obszaru — pytania trafiają pod klucz obszaru odpowiedzi.
              Ustaw obszar formularza w zakładce „Ustawienia".
            </p>
          )}

          {hiddenNotice}

          {staleNotice}

          {/* Antwortbereiche ohne Annahme — dort nimmt eine Frage nichts an. */}
          {ring !== null && person !== null && areasHere
            .filter((areaId) => intakes.get(areaId) === false)
            .map((areaId) => (
              <IntakeMissing
                key={areaId}
                areaId={areaId}
                areaName={areaLabel(areaId)}
                ring={ring}
                officeRoleId={person.id}
                busy={busy !== null}
                onAct={act}
              />
            ))}

          {/*
            0086 — WYMAGANIA zum Ankreuzen: Niepełnoletni (mit Ausdruck), Zdrowie,
            Ubezpieczenie, Zasady. Ihre Fragen lassen sich nicht löschen, solange
            sie eingeschaltet sind — verschieben schon.
          */}
          {module !== undefined && ring !== null && (
            <NeedsPanel
              module={module}
              who={who}
              config={conf}
              answersTo={areasHere[0] ?? module.areaId}
              areas={areas}
              busy={busy !== null}
              onAct={(what, todo) => act(what, todo)}
              onConfig={setSaved}
            />
          )}

          {removedNote !== null && <p className="wk-done" role="status">{removedNote}</p>}

          {fields.length === 0 ? (
            <p className="wk-empty">Jeszcze żadnego pytania.</p>
          ) : (
            <ul className="wk-list">
              {fields.map((f) => editing === f.fieldId && ring !== null ? (
                <li className="wk-row wk-row-open" key={f.fieldId}>
                  <FieldEditor
                    field={f}
                    areas={areas}
                    taken={fields.filter((o) => o.fieldId !== f.fieldId)
                      .map((o) => o.identityRole).filter((r) => r !== 'none')}
                    busy={busy !== null}
                    onCancel={() => setEditing(null)}
                    onSave={(change) => void act('Zapisywanie pytania…', async () => {
                      await saveField(f, change);
                      setEditing(null);
                    })}
                  />
                </li>
              ) : (
                <li className="wk-row" key={f.fieldId}>
                  <span>
                    <strong>{f.label ?? 'zapieczętowane'}</strong>
                    <span className="wk-row-side">
                      {' · '}{KIND_LABEL[f.kind]}
                      {f.isRequired && ' · wymagane'}
                      {f.personOnly === true ? ' · wpisuje i poprawia tylko osoba' : !f.selfEdit && ' · po wysłaniu tylko do odczytu'}
                      {f.identityRole !== 'none' && ` · ${IDENTITY_LABEL[f.identityRole]}`}
                      {' · → '}{areaLabel(f.areaId)}
                    </span>
                    {locks.fields.has(f.fieldId) && (
                      <span className="wk-tag wk-tag-need" title="Nie da się go usunąć, dopóki wymaganie jest zaznaczone — można je przesunąć i zmienić jego treść.">
                        wymaganie: {locks.fields.get(f.fieldId)}
                      </span>
                    )}
                  </span>

                  <span className="wk-row-side">
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null || ring === null || f.label === null}
                      onClick={() => setEditing(f.fieldId)}
                    >
                      Edytuj
                    </button>
                    {' · '}
                    <button
                      type="button" className="wk-link-btn" disabled={busy !== null || locks.fields.has(f.fieldId)}
                      title={locks.fields.has(f.fieldId) ? `Należy do wymagania „${locks.fields.get(f.fieldId)}” — najpierw je odznacz.` : undefined}
                      onClick={() => void act('Usuwanie…', async () => {
                        setRemovedNote(null);
                        const done = await removeField(f.fieldId);
                        /* 0086 — mit Antworten: vom Formular genommen, nicht gelöscht. */
                        if (done.kept === true) {
                          setRemovedNote(`„${f.label ?? 'Pytanie'}” zdjęto z formularza — nikt go już nie dostanie, a dotychczasowe odpowiedzi zostają w zgłoszeniach. Można je przywrócić niżej.`);
                        }
                      })}
                    >
                      Usuń
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* 0086 — VOM FORMULAR GENOMMEN: ihre Antworten bleiben; zurückholen geht. */}
          {removedFields.length > 0 && (
            <details className="wk-fold wk-taken-off">
              <summary>Zdjęte z formularza ({removedFields.length}) — ich odpowiedzi zostają w zgłoszeniach</summary>
              <ul className="wk-list">
                {removedFields.map((f) => (
                  <li className="wk-row wk-row-muted" key={f.fieldId}>
                    <span>
                      <strong>{f.label ?? 'zapieczętowane'}</strong>
                      <span className="wk-row-side">
                        {' · '}{KIND_LABEL[f.kind]}
                        {f.removedAt != null && ` · zdjęte ${new Date(f.removedAt).toLocaleDateString('pl-PL')}`}
                      </span>
                    </span>
                    <span className="wk-row-side">
                      <button
                        type="button" className="wk-link-btn" disabled={busy !== null}
                        onClick={() => void act('Przywracanie…', async () => { setRemovedNote(null); await restoreField(f.fieldId); })}
                      >
                        Przywróć
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ring !== null && (
            <NewFieldForm
              areas={areas}
              ring={ring}
              partId={partId}
              position={allFields.length}
              taken={fields.map((f) => f.identityRole).filter((r) => r !== 'none')}
              formAreaId={module?.areaId ?? null}
              officeRoleId={person?.id ?? null}
              busy={busy !== null}
              onAdded={() => void look()}
              onError={setFailed}
            />
          )}
        </>
      )}

      {/* == 3. AUFBAU UND LOGIK (0043) ======================================= */}

      {(tab === 'layout' || tab === 'logic') && module !== undefined && (
        module.areaId === null ? (
          <p className="wk-warn">
            Układ i logika są zapieczętowane kluczem obszaru formularza — ustaw go najpierw
            w zakładce „Ustawienia".
          </p>
        ) : ring === null ? (
          <p className="wk-empty">Bez hasła nie da się ani odczytać, ani zapieczętować układu.</p>
        ) : designLocked ? (
          <p className="wk-warn">
            Ten formularz ma zapisany układ, ale nie masz klucza, którym go zapieczętowano
            — nie da się go ani odczytać, ani nadpisać.
          </p>
        ) : fields.length === 0 ? (
          <p className="wk-empty">Najpierw pytania — układ i logika na nich się opierają.</p>
        ) : tab === 'layout' ? (
          <FormLayout
            layout={layout}
            fields={byId}
            busy={busy !== null}
            onSave={(next) => void act('Zapisywanie układu…',
              () => saveDesignNow({ ...current, layout: next }))}
          />
        ) : (
          <FormLogic
            design={current}
            layout={layout}
            fields={fields}
            locked={locks}
            busy={busy !== null}
            onSave={(nodes, edges) => void act('Zapisywanie logiki…',
              () => saveDesignNow({ ...current, layout, nodes, edges }))}
          />
        )
      )}

      {/* == 2 und 3: was dafür aufgemacht werden muss ======================== */}

      {readsHere(tab) && (
        <>
          {areasHere.length === 0 ? (
            <p className="wk-empty">Najpierw pytania — bez nich nie ma zgłoszeń.</p>
          ) : readAreas === null ? (
            <div className="wk-actions">
              <button
                type="button" className="wk-btn"
                disabled={busy !== null || ring === null}
                onClick={() => openAll('Otwieranie zgłoszeń…')}
              >
                Otwórz zgłoszenia
              </button>
            </div>
          ) : areasHere.length > 1 && (
            /* Welche Bereiche offen sind — ALLE zugleich — und welche nicht. */
            <p className="wk-hint">
              Otwarte razem: {readAreas.map((id) => areaLabel(id)).join(' · ') || 'żaden'}
              {shutAreas.length > 0 && <> · bez klucza: {shutAreas.map((id) => areaLabel(id)).join(' · ')}</>}
            </p>
          )}

          {reading !== null && (
            <p className="wk-hint" role="status">
              Otwieranie zgłoszeń: {reading.done} z {reading.total}…
            </p>
          )}

          {note !== null && <p className="wk-note">{note}</p>}

          {/*
            2026-10-17 — EINE ZEILE WERKZEUGE über der Liste: „+ Dodaj osobę" und
            der Filter „Ukryte". Vorher ein Häkchen auf eigener Zeile und darunter
            ein grosser Knopf — die erste Person stand weit unten. „Dodaj osobę"
            bleibt hier, ausserhalb der Liste: die verschwindet beim Neulesen und
            nähme das offene Formular mitten beim Eintragen mit.
          */}
          {readAreas !== null && (
            <div className="wk-list-tools">
              {tab === 'people' && !isExtension && ring !== null && (
                <OfficeAdd formId={partId} fields={fields} design={design} onAdded={reread} />
              )}
              <button
                type="button" className="ui-filter" aria-pressed={showHidden}
                title="Pokaż też ukryte zgłoszenia"
                onClick={() => {
                  /* Mit dem NEUEN Wert lesen — der Zustand ist beim Aufruf noch der alte. */
                  const hidden = !showHidden;
                  setShowHidden(hidden);
                  openAll('Wczytywanie…', hidden);
                }}
              >
                <Icon name="eye" />Ukryte
              </button>
            </div>
          )}
        </>
      )}

      {/* == 2. LESEN ======================================================= */}

      {tab === 'entries' && readAreas !== null && reading === null && (
        <FormTable
          fields={fields}
          removed={removedFields}
          submissions={submissions}
          opened={opened}
          fileName={module?.name ?? conf.title ?? 'zgloszenia'}
          onSave={ring === null ? undefined : saveTable}
          canAdd={!isExtension}
        />
      )}

      {/* == 3. HANDELN ===================================================== */}

      {/*
        0077 — JEMANDEN SELBST EINTRAGEN: wer am Telefon zusagt, auf einem
        Zettel steht oder gar nicht selbst handelt, kommt so auf die Liste —
        seit 2026-10-17 aus der Werkzeugzeile oben (`wk-list-tools`).
      */}

      {tab === 'people' && readAreas !== null && reading === null && !isExtension && (
        <>
          {/*
            „UPORZĄDKUJ DANE" STEHT IMMER DA, sobald das Formular nach einer
            Nummer oder einer Adresse fragt — und nicht erst, wenn etwas krumm
            ist. Abgeblendet, mit dem Grund darunter. 0082: auch Adressen, mit
            einer Vorschau zum Abhaken.
          */}
          {tidyFields.length > 0 && (
            <div className="wk-actions">
              <button
                type="button" className="wk-link-btn"
                disabled={busy !== null || crooked.length === 0}
                onClick={() => setTidyOpen((was) => !was)}
              >
                {crooked.length === 0 ? 'Uporządkuj dane' : `Uporządkuj dane (${crooked.length})`}
              </button>
              <span className="wk-hint">
                {crooked.length === 0
                  ? 'Numery telefonu i adresy są już zapisane w jednej postaci.'
                  : [
                    [crooked.filter((c) => c.kind === 'phone').length, 'numer', 'numery', 'numerów'] as const,
                    [crooked.filter((c) => c.kind === 'address').length, 'adres', 'adresy', 'adresów'] as const
                  ].filter(([n]) => n > 0).map(([n, one, few, many]) => `${n} ${plural(n, one, few, many)}`).join(' i ')
                    + ' zapisano inaczej, niż zapisuje je reszta bazy.'}
              </span>
            </div>
          )}
          {tidyOpen && crooked.length > 0 && (
            <section className="wk-tidy">
              <p className="wk-hint">
                Numery jako +48 600 700 800, adresy tak, jak w kartotece (ulica i numer, miejscowość, kod i poczta).
                Zaznaczone „sprawdź" nie dało się rozpoznać na pewno — są odznaczone.
              </p>
              <TidyList
                items={crooked.map((c) => ({ key: crookedKey(c), before: c.value, after: c.tidy, doubt: c.doubt }))}
                skipped={skipped} busy={busy !== null} onToggle={(key) => setSkipped((was) => toggled(was, key))} />
              <div className="wk-actions">
                <button type="button" className="wk-btn" disabled={busy !== null || crooked.every((c) => skipped.has(crookedKey(c)))}
                  onClick={() => void act('Porządkowanie…', straighten)}>
                  Zapisz zaznaczone ({crooked.filter((c) => !skipped.has(crookedKey(c))).length})
                </button>
                <button type="button" className="wk-link-btn" disabled={busy !== null} onClick={() => setTidyOpen(false)}>Anuluj</button>
              </div>
            </section>
          )}

          <People
            partId={partId}
            config={conf}
            onConfig={setSaved}
            newSince={newSince?.partId === partId ? newSince.at : null}
            submissions={submissions}
            opened={opened}
            fields={fields}
            removed={removedFields}
            seatAreas={areasHere}
            formAreas={[module?.areaId ?? null, ...areasHere]}
            areas={areas}
            stepInfo={stepInfo}
            extData={extData}
            ring={ring}
            busy={busy !== null}
            onHide={(s) => void act(s.hidden ? 'Przywracanie…' : 'Ukrywanie…', async () => {
              await hideSubmission(s.registrationId, !s.hidden);
              await reread();
            })}
            onRemove={(s) => void act('Usuwanie…', async () => {
              await removeSubmission(s.registrationId);
              await reread();
            })}
            onError={setFailed}
            onChanged={reread}
          />

          {/* 0077 — die ganze Liste als JSON: eine vorhandene Liste in einem Zug herein, oder hinaus zum Bearbeiten. */}
          {ring !== null && (
            <ListJsonPanel
              who={who}
              formId={partId}
              formName={module?.name ?? conf.title ?? 'Formularz'}
              extensions={stepInfo?.extensions ?? []}
              onDone={reread}
            />
          )}
        </>
      )}
    </>
  );
}

/** Ein Reiter — dieselbe Gestalt wie in den Obszary. */
function FormTab({ now, mine, onPick, children }: {
  now: FormTabName;
  mine: FormTabName;
  onPick: (tab: FormTabName) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={now === mine}
      className={now === mine ? 'wk-tab wk-tab-on' : 'wk-tab'}
      onClick={() => onPick(mine)}
    >
      {children}
    </button>
  );
}

export default FormOffice;
