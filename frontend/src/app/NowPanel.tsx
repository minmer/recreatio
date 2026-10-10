/**
 * TERAZ — was neu ist und woran man zuletzt war, ganz oben im Warsztat.
 *
 * <b>Warum.</b> Der Warsztat begann mit dreizehn Kacheln, die sagen, WAS es
 * gibt (Obszary, Moduły, Strony …) — nicht, was gerade los ist. Wer nur wissen
 * wollte, ob sich jemand angemeldet hat, ging Moduły → Formularz → Zgłoszenia;
 * wer weiterarbeiten wollte, suchte die Seite im Baum. Hier steht beides
 * zuerst: das Neue (dieselben Zahlen wie die Glocke, mit „przejrzane" für das
 * Konto, 0090) und das zuletzt Geöffnete. Die Kacheln stehen darunter, für
 * alles andere.
 *
 * <b>Kein eigener Abruf für das Neue</b> — die Glocke fragt ohnehin im Takt
 * (\`notify.ts\`); hier wird nur gezeigt, was sie hat.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';

import { loadAreas } from './area';
import type { Desk } from './desk';
import { loadModules } from './module';
import { chatLabel, current, markFormSeen, markLinksSeen, subscribe } from './notify';
import { partLabel } from './parts/registry';
import { RecentRow, type RecentItem } from './Recent';
import { pageSteps, viewPath } from './routes';

/** Die Dinge, die „Ostatnio" benennen kann — Seiten sofort, Module und Bereiche einmal geholt. */
function useRecentItems(desk: Desk): { pages: RecentItem[]; modules: RecentItem[]; areas: RecentItem[] } {
  const [modules, setModules] = useState<RecentItem[]>([]);
  const [areas, setAreas] = useState<RecentItem[]>([]);
  useEffect(() => {
    let alive = true;
    void loadModules().then(({ modules: all }) => {
      if (alive) setModules(all.map((m) => ({ id: m.moduleId, label: `${m.name} · ${partLabel(m.kind)}`, href: viewPath('modules', m.kind, m.moduleId) })));
    }).catch(() => undefined);
    void loadAreas().then(({ areas: all }) => {
      if (alive) setAreas(all.map((a) => ({ id: a.areaId, label: a.name, href: viewPath('areas', a.areaId) })));
    }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const pages = desk.pages.filter((p) => p.aliasOf === null).map((p) => ({
    id: p.path, label: p.path === '' ? 'recreatio.pl' : p.path, href: viewPath('pages', ...pageSteps(p.path))
  }));
  return { pages, modules, areas };
}

export function NowPanel({ desk }: { desk: Desk }) {
  const { digest } = useSyncExternalStore(subscribe, current);
  const recent = useRecentItems(desk);

  const chats = (digest?.chats.list ?? []).filter((c) => c.unread > 0).slice(0, 5);
  const forms = digest?.registrations.list ?? [];
  const nothing = digest !== null && chats.length === 0 && forms.length === 0 && digest.links === 0 && digest.tasks === 0;

  return (
    <section className="wk-now" aria-label="Teraz">
      <div className="wk-now-news">
        <h2 className="wk-now-h">Nowe</h2>
        {digest === null ? <p className="wk-hint">Sprawdzanie…</p> : nothing ? (
          <p className="wk-now-calm">Nic nowego — wszystko przejrzane.</p>
        ) : (
          <ul className="wk-now-list">
            {forms.map((f) => (
              <li key={`f${f.moduleId}`}>
                <a href={viewPath('modules', 'form', f.moduleId)}>
                  <span className="wk-now-kind">Zgłoszenia</span>
                  <span className="wk-now-what">{f.name}</span>
                  <span className="wk-now-n">{f.count === 1 ? '1 nowe' : `${f.count} nowe`}</span>
                </a>
                <button type="button" className="wk-bell-done" title="Przejrzane — nie pokazuj już jako nowe"
                  aria-label={`${f.name}: przejrzane`} onClick={() => void markFormSeen(f.moduleId)}>✓</button>
              </li>
            ))}
            {chats.map((c) => (
              <li key={`c${c.chatId}`}>
                <a href={viewPath('chat', c.chatId)}>
                  <span className="wk-now-kind">Rozmowa</span>
                  <span className="wk-now-what">{chatLabel(c)}</span>
                  <span className="wk-now-n">{c.unread === 1 ? '1 wiadomość' : `${c.unread} wiadomości`}</span>
                </a>
              </li>
            ))}
            {digest.links > 0 && (
              <li>
                <a href={viewPath('areas')}>
                  <span className="wk-now-kind">Linki</span>
                  <span className="wk-now-what">Dołączyli przez link</span>
                  <span className="wk-now-n">{digest.links}</span>
                </a>
                <button type="button" className="wk-bell-done" title="Przejrzane" aria-label="Dołączenia: przejrzane" onClick={markLinksSeen}>✓</button>
              </li>
            )}
            {digest.tasks > 0 && (
              <li>
                <a href={viewPath('tasks')}>
                  <span className="wk-now-kind">Zadania</span>
                  <span className="wk-now-what">Do zrobienia teraz</span>
                  <span className="wk-now-n">{digest.tasks}</span>
                </a>
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="wk-now-go">
        <h2 className="wk-now-h">Szybko</h2>
        <nav className="wk-now-quick" aria-label="Szybko">
          <a href={viewPath('calendar')}>Kalendarz</a>
          <a href={viewPath('tasks')}>Zadania</a>
          <a href={viewPath('chat')}>Rozmowy</a>
          <a href={viewPath('modules')}>Formularze</a>
        </nav>
        <RecentRow scope="pages" items={recent.pages} max={4} />
        <RecentRow scope="modules" items={recent.modules} max={4} />
        <RecentRow scope="areas" items={recent.areas} max={4} />
      </div>
    </section>
  );
}

export default NowPanel;
