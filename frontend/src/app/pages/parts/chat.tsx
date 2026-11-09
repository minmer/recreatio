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

import { t } from '../../core/i18n';
import { text, type RawConfig } from '../part';
import { field, texts, textPart } from './partTexts';
import { later } from '../../ui/later';
import { PageChatPeek } from '../../chat/ChatPeek';

/* 2026-10-17 — die Ansicht erst, wenn sie gezeigt wird (`ui/later`): eine Seite ohne diesen Baustein lädt sie nicht. */
const PageChatCard = later(() => import('../../chat/PageChatView').then((m) => m.PageChatCard));

interface ChatConfig {
  readonly title: string;
  readonly chat: string;
}

export const chatPart = textPart<ChatConfig>(texts({ label: 'moduleData.chat.label', use: 'moduleData.chat.use' }), {
  kind: 'chat',

  /* 0064 — ein ausgefülltes Beispiel, für die Beschreibung des JSON. */
  example: texts({ title: 'moduleData.chat.exTitle', chat: 'moduleData.chat.exChat' }),
  box: { colSpan: 3, rowSpan: 5 },

  fields: [
    field({ key: 'title', kind: 'line' }, texts({ label: 'moduleDataCogita.f.heading', hint: 'moduleData.chat.titleHint' })),
    field({ key: 'chat', kind: 'chat' }, texts({ label: 'moduleData.chat.which' }))
  ],

  read: (raw: RawConfig): ChatConfig => ({ title: text(raw, 'title'), chat: text(raw, 'chat') }),

  /*
     Ohne gewählte Rozmowa hat die Kachel nichts zu zeigen und verschwindet von
     der Seite. Im Editor steht sie trotzdem da — mit dem Satz aus `missing`,
     damit niemand rät, warum sie draussen nicht erscheint.
  */
  hasContent: (config) => config.chat !== '',
  missing: (config) => config.chat === ''
    ? t('moduleData.chat.missing')
    : null,

  /* Eine Rozmowa im Streifen wäre ein Guckloch — dort ein Knopf; sonst der Verlauf, hoch mit mehr davon. */
  strip: texts({ title: 'moduleData.chat.label', open: 'moduleDataSeat.openChat' }),
  /* 0102 — zugeklappt: wie viel Neues darin liegt (für den Platz oder das Konto, das hier schaut). */
  peek: ({ config }) => <PageChatPeek chatId={config.chat} />,
  fullscreen: true,
  shows: (_config, size) => size.height === 'strip'
    ? t('moduleDataSeat.chatShowsStrip')
    : size.height === 'tall'
      ? t('moduleData.chat.showsTall')
      : t('moduleDataSeat.chat.showsBlock'),

  View: ({ config }) => <PageChatCard title={config.title} chatId={config.chat} />
});
