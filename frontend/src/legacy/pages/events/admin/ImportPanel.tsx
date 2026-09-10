import { useMemo, useState } from 'react';
import { importEventParts, importEventSite, type EventImportResult } from '../../../lib/api';
import { buildJsonDictionary, buildStarterJson } from './jsonDictionary';

type Mode = { kind: 'site' } | { kind: 'parts'; pageId: string; pageLabel: string };

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; the text is on screen either way.
      setFailed(true);
    }
  };

  return (
    <button type="button" className="eva-cta" onClick={() => void copy()}>
      {failed ? 'Zaznacz i skopiuj ręcznie' : copied ? 'Skopiowano' : label}
    </button>
  );
}

/**
 * Import and the brief that goes with it. The normal flow is: copy the
 * dictionary, hand it to a model, paste back what it wrote, fine-tune here.
 */
export function ImportPanel({
  mode,
  onImported
}: {
  mode: Mode;
  onImported: (result: EventImportResult) => void;
}) {
  const dictionary = useMemo(() => buildJsonDictionary(), []);
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EventImportResult | null>(null);
  const [showDictionary, setShowDictionary] = useState(false);

  // Parse as you type so a broken document is caught before any request.
  const parsed = useMemo<{ value: unknown } | { message: string } | null>(() => {
    if (raw.trim().length === 0) return null;
    try {
      return { value: JSON.parse(raw) as unknown };
    } catch (parseError: unknown) {
      return { message: parseError instanceof Error ? parseError.message : 'Nieprawidłowy JSON.' };
    }
  }, [raw]);

  const parseError = parsed !== null && 'message' in parsed ? parsed.message : null;
  const canImport = parsed !== null && 'value' in parsed && !pending;

  const runImport = async () => {
    if (parsed === null || !('value' in parsed)) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response =
        mode.kind === 'site'
          ? await importEventSite(parsed.value)
          : await importEventParts(mode.pageId, parsed.value);
      setResult(response);
      setRaw('');
      onImported(response);
    } catch (importError: unknown) {
      setError(importError instanceof Error ? importError.message : 'Import się nie powiódł.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="eva-panel">
      <header>
        <h3>{mode.kind === 'site' ? 'Import wydarzenia z JSON' : `Import części do strony „${mode.pageLabel}”`}</h3>
        <p>
          {mode.kind === 'site'
            ? 'Skopiuj słownik, daj go modelowi, wklej tutaj to, co napisał. Zaimportowane wydarzenie zostaje szkicem i możesz je dalej dopracować w edytorze.'
            : 'Wklej listę części albo obiekt z kluczem „parts”. Części zostaną dopisane na końcu tej strony — nic nie zostanie nadpisane.'}
        </p>
      </header>

      <div className="eva-actions">
        <CopyButton text={dictionary} label="Kopiuj słownik dla AI" />
        <button type="button" onClick={() => setShowDictionary((current) => !current)}>
          {showDictionary ? 'Ukryj słownik' : 'Pokaż słownik'}
        </button>
        {mode.kind === 'site' ? (
          <button type="button" onClick={() => setRaw(buildStarterJson())}>
            Wstaw przykład
          </button>
        ) : null}
      </div>

      {showDictionary ? <pre className="eva-dictionary">{dictionary}</pre> : null}

      <label className="eve-row">
        <span>JSON do zaimportowania</span>
        <textarea
          className="eva-json"
          rows={14}
          spellCheck={false}
          value={raw}
          placeholder='{ "slug": "…", "title": "…", "pages": [ … ] }'
          onChange={(event) => setRaw(event.target.value)}
        />
      </label>

      {parseError ? <p className="eva-error">Nieprawidłowy JSON: {parseError}</p> : null}
      {error ? <p className="eva-error">{error}</p> : null}

      <button type="button" className="eva-cta" onClick={() => void runImport()} disabled={!canImport}>
        {pending ? 'Importowanie…' : 'Importuj'}
      </button>

      {result ? (
        <div className="eva-import-result">
          <p>
            Zaimportowano: {result.pagesCreated} stron, {result.partsCreated} części, {result.fieldsCreated} pól
            formularza.
          </p>
          {result.warnings.length > 0 ? (
            <>
              <p className="eva-sub">Ostrzeżenia — te rzeczy zostały pominięte albo poprawione:</p>
              <ul className="eva-warnings">
                {result.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
