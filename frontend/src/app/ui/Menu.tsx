/**
 * EIN MENÜ AN EINEM KNOPF — „⋯" für alles, was nicht die eine Hauptsache ist.
 *
 * Gebaut auf dem Menü der Rozmowy (`PopMenu`): es steht am Rand des Dokuments,
 * sucht sich selbst den Platz, wandert mit den Pfeiltasten und schliesst bei
 * Esc, beim Klick daneben und beim Rollen. Ein zweites Menü daneben wäre ein
 * zweites Verhalten.
 *
 * <b>Wann ein Menü:</b> eine Zeile oder ein Kopf hat EINE sichtbare Handlung;
 * alles Weitere — vor allem Löschen — steht hier.
 */

import { useRef, type ReactNode } from 'react';

import { PopMenu, useButtonMenu, type MenuItem } from '../ChatKit';
import { Icon, type IconName } from './icons';

export type { MenuItem };

export function MenuButton({ label, items, icon = 'dots', text, trigger, className, children, disabled = false }: {
  /** Vorgelesen, und als Titel am Zeiger: „Więcej: Bierzmowanie". */
  label: string;
  items: readonly (MenuItem | false | null | undefined)[];
  icon?: IconName;
  /** Ein Wort neben dem Zeichen — sonst nur das Zeichen. */
  text?: string;
  /** Eigener Inhalt des Knopfs (z. B. Bild und Name des Kontos) statt Zeichen und Wort. */
  trigger?: ReactNode;
  className?: string;
  /** Freier Inhalt über den Einträgen (eine Zeile Erklärung, ein Feld). */
  children?: ReactNode;
  disabled?: boolean;
}) {
  const menu = useButtonMenu();
  const button = useRef<HTMLButtonElement | null>(null);
  const shown = items.filter((one): one is MenuItem => one !== false && one !== null && one !== undefined);

  if (shown.length === 0 && children === undefined) return null;

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className ?? (text === undefined ? 'wk-icon-btn ui-more' : 'wk-btn wk-btn-quiet')}
        aria-label={text === undefined && trigger === undefined ? label : undefined}
        title={text === undefined && trigger === undefined ? label : undefined}
        aria-haspopup="menu"
        aria-expanded={menu.open !== null}
        disabled={disabled}
        onClick={(e) => menu.toggle(e.currentTarget)}
      >
        {trigger ?? (
          <>
            <Icon name={icon} />
            {text !== undefined && <span>{text}</span>}
          </>
        )}
      </button>
      {menu.open !== null && (
        <PopMenu anchor={{ rect: menu.open.rect }} from={menu.open.from} items={shown} label={label} onClose={menu.close}>
          {children}
        </PopMenu>
      )}
    </>
  );
}

export default MenuButton;
