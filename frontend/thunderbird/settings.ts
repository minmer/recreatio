/**
 * DIE SEITE IN THUNDERBIRDS EINSTELLUNGEN (Redagowanie → Załączniki → recreatio.pl):
 * den Kod połączenia einfügen, sehen, womit verbunden ist und wie viel geteilt wird,
 * wie lange neue Links gelten, trennen. Gefragt wird die Hintergrundseite
 * (`protocol.ts`) — sie allein hält das Geheimnis und ruft den Dienst.
 */

import { bytesText } from './filelink';
import { thunderbird } from './messenger';
import type { SettingsAsk, SettingsState } from './protocol';

const tb = thunderbird();
const accountId = new URL(window.location.href).searchParams.get('accountId') ?? '';

const $ = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} fehlt`);
  return found as T;
};

const view = {
  loading: $('loading'),
  connected: $('connected'),
  pairing: $('pairing'),
  name: $('name'),
  usage: $('usage'),
  days: $<HTMLSelectElement>('days'),
  daysNew: $<HTMLSelectElement>('days-new'),
  code: $<HTMLTextAreaElement>('code'),
  connect: $<HTMLButtonElement>('connect'),
  cancel: $<HTMLButtonElement>('cancel'),
  replace: $<HTMLButtonElement>('replace'),
  disconnect: $<HTMLButtonElement>('disconnect'),
  error: $('error'),
  note: $('note')
};

let shown: SettingsState | null = null;
/** Ein neuer Kod über einem bestehenden Połączenie — das Feld zeigen, ohne zu trennen. */
let replacing = false;

function say(element: HTMLElement, text: string | null): void {
  element.textContent = text ?? '';
  element.hidden = text === null || text === '';
}

function render(state: SettingsState): void {
  shown = state;
  view.loading.hidden = true;
  view.connected.hidden = !state.connected;
  view.pairing.hidden = state.connected && !replacing;
  view.cancel.hidden = !(state.connected && replacing);
  view.name.textContent = state.name ?? 'Thunderbird';
  view.days.value = String(state.days);
  if (!state.connected) view.daysNew.value = String(state.days);
  say(view.usage, state.usage === null ? null
    : `Udostępnione teraz w Twoim obszarze: ${bytesText(state.usage.held)} z ${bytesText(state.usage.maxHeld)}`
      + ` · dziś wysłano ${bytesText(state.usage.today)} z ${bytesText(state.usage.maxToday)}.`);
  say(view.error, state.error);
  say(view.note, state.note);
}

async function ask(question: SettingsAsk, busy?: HTMLButtonElement): Promise<void> {
  if (busy !== undefined) busy.disabled = true;
  try {
    render(await tb.runtime.sendMessage(question) as SettingsState);
  } catch {
    say(view.error, 'Dodatek nie odpowiada — zamknij i otwórz ustawienia jeszcze raz.');
  } finally {
    if (busy !== undefined) busy.disabled = false;
  }
}

view.connect.addEventListener('click', () => {
  const code = view.code.value.trim();
  if (code === '') {
    say(view.error, 'Wklej kod połączenia z recreatio.pl.');
    view.code.focus();
    return;
  }
  void ask({ kind: 'connect', accountId, code, days: Number(view.daysNew.value) }, view.connect).then(() => {
    if (shown?.connected === true && shown.error === null) {
      replacing = false;
      view.code.value = '';
      if (shown !== null) render(shown);
    }
  });
});

view.days.addEventListener('change', () => void ask({ kind: 'days', accountId, days: Number(view.days.value) }));

view.replace.addEventListener('click', () => {
  replacing = true;
  if (shown !== null) render({ ...shown, error: null, note: null });
  view.code.focus();
});

view.cancel.addEventListener('click', () => {
  replacing = false;
  view.code.value = '';
  if (shown !== null) render({ ...shown, error: null });
});

/*
 * Trennen fragt nach — aber nicht mit `confirm()`: in Thunderbirds Einstellungen steht
 * die Seite in einem eingebetteten Rahmen, und ein Fenster des Browsers taugt dort nicht.
 * Der erste Klick fragt auf dem Knopf selbst, der zweite (binnen 6 s) trennt.
 */
const DISCONNECT = view.disconnect.textContent ?? 'Odłącz';
let armed: number | null = null;

view.disconnect.addEventListener('click', () => {
  if (armed === null) {
    view.disconnect.textContent = 'Na pewno? Kliknij jeszcze raz, aby odłączyć';
    armed = window.setTimeout(() => { armed = null; view.disconnect.textContent = DISCONNECT; }, 6000);
    return;
  }
  window.clearTimeout(armed);
  armed = null;
  view.disconnect.textContent = DISCONNECT;
  replacing = false;
  void ask({ kind: 'disconnect', accountId }, view.disconnect);
});

if (accountId === '') {
  view.loading.hidden = true;
  say(view.error, 'Brak konta — otwórz tę stronę z ustawień Thunderbirda (Redagowanie → Załączniki).');
} else {
  void ask({ kind: 'state', accountId });
}
