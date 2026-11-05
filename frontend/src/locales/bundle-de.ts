/* Alle Dateien einer Sprache in EINEM Bündel — eine Anfrage beim Start, nicht eine je Datei. */
import type { Dictionary } from '../app/core/i18n';

const files = import.meta.glob<Dictionary>('./de/*.json', { eager: true, import: 'default' });

export default Object.fromEntries(Object.entries(files).map(([path, dict]) => [path.slice(path.lastIndexOf('/') + 1, -'.json'.length), dict]));
