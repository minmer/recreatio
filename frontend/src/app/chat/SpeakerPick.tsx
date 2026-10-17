/**
 * „PISZESZ JAKO" (0095) — neben dem Feld: wer spricht. Zuerst die ROLLE, durch
 * die man hier ist, dann die PERSON, die durch sie spricht — eine Rolle wie
 * „Rada" halten oft mehrere eigene Personen (die eigene, die eines Kindes).
 *
 * Gibt es nur eine Rolle, fängt die Wahl bei den Personen an; hat eine Rolle
 * nur eine Person, ist sie mit der Rolle gewählt.
 */

import { useRef, useState } from 'react';

import { Avatar, PopMenu, useButtonMenu, type MenuItem } from './ChatKit';
import { speakerKey, speakerText, throughRole, type Speaker } from './chatAuthor';

export function SpeakerPick({ speakers, speaker, name, onPick }: {
  speakers: readonly Speaker[];
  speaker: Speaker;
  name: (id: string) => string | null | undefined;
  onPick: (one: Speaker) => void;
}) {
  const menu = useButtonMenu();
  const button = useRef<HTMLButtonElement | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const roles = [...new Set(speakers.map((one) => one.roleId))];
  const personsOf = (roleId: string) => speakers.filter((one) => one.roleId === roleId);
  const step = role ?? (roles.length === 1 ? roles[0] : null);
  const label = speakerText(speaker, name);

  const roleName = (roleId: string) => {
    const own = speakers.find((one) => one.roleId === roleId && !throughRole(one));
    const n = personsOf(roleId).length;
    return own !== undefined ? `${name(roleId) ?? 'osoba'} — jako ja` : `${name(roleId) ?? 'rola'}${n > 1 ? ` (${n} osoby)` : ''}`;
  };

  const items: MenuItem[] = step === null
    ? roles.map((roleId) => ({
      label: roleName(roleId),
      checked: roleId === speaker.roleId,
      onSelect: () => {
        const persons = personsOf(roleId);
        if (persons.length === 1) { onPick(persons[0]); return; }
        setRole(roleId);
        /* Zweiter Schritt: dasselbe Menü, jetzt mit den Personen dieser Rolle. */
        window.requestAnimationFrame(() => { if (button.current !== null) menu.toggle(button.current); });
      }
    }))
    : [
      ...personsOf(step).map((one) => ({
        label: name(one.personId) ?? 'osoba',
        checked: speakerKey(one) === speakerKey(speaker),
        onSelect: () => { setRole(null); onPick(one); }
      })),
      ...(roles.length > 1 ? [{
        label: '← Inna rola',
        onSelect: () => {
          setRole(null);
          window.requestAnimationFrame(() => { if (button.current !== null) menu.toggle(button.current); });
        }
      }] : [])
    ];

  return (
    <>
      <button ref={button} type="button" className="ch-sendas" data-speaker={speakerKey(speaker)}
        aria-label={`Piszesz jako ${label} — zmień`} title={`Piszesz jako ${label}`}
        aria-haspopup="menu" aria-expanded={menu.open !== null}
        onClick={(e) => { setRole(null); menu.toggle(e.currentTarget); }}>
        <Avatar seed={speaker.personId} name={name(speaker.personId) ?? label} size="sm" />
      </button>
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect, above: true }} from={menu.open.from} label="Piszesz jako"
          onClose={menu.close} items={items}>
          <p className="ch-pop-head">
            {step === null ? 'Piszesz jako — najpierw rola' : throughRole(personsOf(step)[0]) ? `Kto pisze przez „${name(step) ?? 'rolę'}"` : 'Piszesz jako'}
          </p>
        </PopMenu>
      )}
    </>
  );
}

export default SpeakerPick;
