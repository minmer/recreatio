/**
 * PLIKI PRZEZ LINK — die eigenen (0117): was als Link hinausging, an wen, bis wann,
 * wie oft geöffnet. Den Link noch einmal kopieren, selbst öffnen, oder zurückziehen
 * (dann gilt er sofort nicht mehr, auch bei denen, die ihn schon haben).
 *
 * 0125 — auch was Thunderbird als Link verschickte (mit dem Namen seines Połączenie),
 * und darunter die Połączenia selbst (`ShareConnections.tsx`).
 *
 * <code>
 *   #/workspace/sms/pliki   auf dem Telefon und im Browser
 * </code>
 */

import { useCallback, useEffect, useState } from 'react';

import { useCrumbs } from '../shell/crumbTrail';
import { WorkspaceError, type Who } from '../core/session';
import { ask, toast } from '../ui/dialogs';
import { Icon } from '../ui/icons';
import { Loading } from '../ui/Loading';
import { PageHeader } from '../ui/PageHeader';
import { phoneShown } from './numbers';
import { openPhone, type PhoneCtx } from './phoneContext';
import { loadShares, unshare, type ShareEntry } from './share';
import { ShareConnections } from './ShareConnections';
import { shareLink, sizeText } from './shareSeal';
import './phone.css';

const day = (at: string) => new Date(at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

export function SharesView({ who }: { who: Who }) {
  const [ctx, setCtx] = useState<PhoneCtx | null>(null);
  const [list, setList] = useState<readonly ShareEntry[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useCrumbs([{ label: 'Pliki przez link', href: null }]);

  const load = useCallback(async () => {
    try {
      const opened = await openPhone(who);
      setCtx(opened);
      setList(await loadShares(opened));
      setFailed(null);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się wczytać linków.');
    }
  }, [who]);
  useEffect(() => { void load(); }, [load]);

  const copy = (secret: string) => {
    void navigator.clipboard?.writeText(shareLink(secret)).then(() => toast('Skopiowano link.'))
      .catch(() => toast('Nie udało się skopiować.'));
  };
  const remove = async (entry: ShareEntry) => {
    if (ctx === null) return;
    const yes = await ask({
      title: `Usunąć ${entry.label?.name ?? 'ten plik'}?`,
      body: 'Link przestanie działać od razu — także u tych, którzy już go dostali.',
      confirm: 'Usuń', danger: true
    });
    if (!yes) return;
    try {
      await unshare(ctx, entry.id);
      toast('Usunięto — link już nie działa.');
    } catch (e) {
      toast(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.');
    }
    await load();
  };

  const total = (list ?? []).reduce((n, s) => n + s.size, 0);
  return (
    <>
      <PageHeader title="Pliki przez link" meta={list === null || list.length === 0 ? undefined : `${list.length} · razem ${sizeText(total)}`} />
      <p className="ph-shares-intro">
        Zdjęcia i pliki wysłane jako link — w SMS albo z Thunderbirda — w pełnej jakości, zaszyfrowane. Klucz jest tylko w linku; recreatio.pl go nie zna.
        Po terminie plik znika sam.
      </p>
      {failed !== null && <p className="wk-error">{failed}</p>}
      {list === null && failed === null && <Loading label="Wczytywanie linków…" />}
      {list !== null && list.length === 0 && (
        <p className="wk-empty">
          Nie ma jeszcze plików wysłanych jako link. W rozmowie dodaj zdjęcie albo plik i wybierz „Link — pełna jakość” — albo połącz Thunderbirda (niżej).
        </p>
      )}
      {list !== null && list.length > 0 && (
        <ul className="ph-shares">
          {list.map((s) => (
            <li key={s.id} className="ph-share">
              <span className="ph-share-name"><Icon name={s.label?.type.startsWith('image/') === true ? 'image' : 'file'} />{s.label?.name ?? 'Plik'}</span>
              <small>
                {sizeText(s.size)} · wysłano {day(s.createdAt)}
                {s.label !== null && s.label.to.length > 0 ? ` · do ${s.label.to.map(phoneShown).join(', ')}` : ''}
                {s.device !== null ? ` · z: ${s.device.name ?? 'Thunderbird'}` : ''}
              </small>
              <small>ważny do {day(s.expiresAt)} · {s.downloads === 0 ? 'jeszcze nie otwarty' : `otwarty ${s.downloads}×`}</small>
              <span className="ph-share-tools">
                {s.label !== null && (
                  <>
                    <button type="button" className="wk-link-btn" onClick={() => copy(s.label?.secret ?? '')}><Icon name="copy" />Kopiuj link</button>
                    <a className="wk-link-btn" href={`#/plik/${s.label.secret}`}><Icon name="eye" />Otwórz</a>
                  </>
                )}
                <button type="button" className="wk-link-btn wk-danger-link" onClick={() => void remove(s)}><Icon name="trash" />Usuń</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {ctx !== null && <ShareConnections ctx={ctx} onChanged={() => void load()} />}
    </>
  );
}

export default SharesView;
