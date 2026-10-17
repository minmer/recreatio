/**
 * „ROZMOWA" — die Rozmowa einer Gruppe, auf einer Seite.
 *
 * <b>Der Unterschied zu „Rozmowa grupy" (`seat-chat`).</b> Jener zeigt die
 * Rozmowa, in die der persönliche LINK des Besuchers führt — welche das ist,
 * weiss erst der Besucher. Dieser hier nennt sie beim Namen: die Kanzlei legt
 * die Rozmowa ihrer Gruppe auf die Seite, an der die Gruppe ohnehin arbeitet,
 * und wer dazugehört, liest und schreibt dort mit.
 *
 * <b>Die Seite ist öffentlich, die Rozmowa nicht</b> — und das bleibt so. Den
 * Inhalt entsiegelt nur ein Browser, der den Bereich hält; der Dienst gibt
 * einem Fremden nicht einmal, dass es sie gibt. Was auf der Seite steht, ist
 * dann der Satz, dass es dafür einen Zugang braucht.
 */

import { definePart, text, type RawConfig } from '../part';
import { later } from '../../ui/later';
import { PageChatPeek } from '../../chat/ChatPeek';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const PageChatCard = later(() => import('../../chat/PageChatView').then((m) => m.PageChatCard));

interface ChatConfig {
  readonly title: string;
  readonly chat: string;
}

export const chatPart = definePart<ChatConfig>({
  kind: 'chat',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: { title: 'Rozmowa rady parafialnej', chat: '<id-rozmowy>' },
  label: 'Rozmowa',
  use: 'Rozmowa wybranej grupy na stronie — czyta i pisze w niej ten, kto do grupy należy albo ma swój link.',
  box: { colSpan: 3, rowSpan: 5 },

  fields: [
    { key: 'title', label: 'Nagłówek', kind: 'line', hint: 'np. Rozmowa rady parafialnej' },
    { key: 'chat', label: 'Która rozmowa', kind: 'chat' }
  ],

  read: (raw: RawConfig): ChatConfig => ({ title: text(raw, 'title'), chat: text(raw, 'chat') }),

  /*
     Ohne gewählte Rozmowa hat die Kachel nichts zu zeigen und verschwindet von
     der Seite. Im Editor steht sie trotzdem da — mit dem Satz aus `missing`,
     damit niemand rät, warum sie draussen nicht erscheint.
  */
  hasContent: (config) => config.chat !== '',
  missing: (config) => config.chat === ''
    ? 'Wybierz rozmowę — bez niej kafelek nie pojawi się na stronie.'
    : null,

  /* Eine Rozmowa im Streifen wäre ein Guckloch — dort ein Knopf; sonst der Verlauf, hoch mit mehr davon. */
  strip: { title: 'Rozmowa', open: 'Otwórz rozmowę' },
  /* 0102 — zugeklappt: wie viel Neues darin liegt (für den Platz oder das Konto, das hier schaut). */
  peek: ({ config }) => <PageChatPeek chatId={config.chat} />,
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? 'Nagłówek i przycisk — rozmowa rozwija się po kliknięciu.'
    : size.height === 'tall'
      ? 'Rozmowa z dłuższym widokiem wiadomości i polem do pisania.'
      : 'Rozmowa: ostatnie wiadomości i pole do pisania.',

  View: ({ config }) => <PageChatCard title={config.title} chatId={config.chat} />
});
