import { defaultLayersJson, parseLayers, type Layer, type ThemeMode } from '../shell/layers';
import { LinesRow, ListEditor, NumberRow, SelectRow, TextRow } from '../parts/editorKit';
import { ImagePicker } from './ImagePicker';

const KIND_OPTIONS: Array<{ value: Layer['kind']; label: string }> = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'image', label: 'Obraz' },
  { value: 'bigtext', label: 'Duży napis' }
];

const BLEND_OPTIONS = [
  { value: 'normal' as const, label: 'Zwykłe' },
  { value: 'multiply' as const, label: 'Mnożenie' },
  { value: 'screen' as const, label: 'Rozjaśnianie' },
  { value: 'overlay' as const, label: 'Nakładka' },
  { value: 'soft-light' as const, label: 'Miękkie światło' }
];

function blankLayer(kind: Layer['kind'], mode: ThemeMode): Layer {
  if (kind === 'image') {
    return { kind: 'image', speed: 0.34, url: '', opacity: 0.45, blend: 'normal', position: 'center' };
  }
  if (kind === 'bigtext') {
    return { kind: 'bigtext', speed: 0.95, lines: ['NAPIS'], opacity: 0.09, color: null };
  }
  // A dark gradient under a light event would undo the mode at the first part.
  return mode === 'light'
    ? { kind: 'gradient', speed: 0.12, angle: 168, from: '#fbfcfe', via: null, to: '#dfe7f2' }
    : { kind: 'gradient', speed: 0.12, angle: 168, from: '#12203a', via: null, to: '#060a12' };
}

/** Edits the background stack behind one part. */
export function LayerEditor({
  siteId,
  mode,
  layersJson,
  menuLabel,
  onChange
}: {
  siteId: string;
  mode: ThemeMode;
  layersJson: string | null;
  menuLabel: string;
  onChange: (json: string) => void;
}) {
  const layers = parseLayers(layersJson, mode);

  const write = (next: Layer[]) => onChange(JSON.stringify(next, null, 2));

  return (
    <>
      <ListEditor<Layer>
        legend="Warstwy tła (od tyłu do przodu)"
        items={layers}
        addLabel="Dodaj warstwę"
        blank={() => blankLayer('gradient', mode)}
        titleOf={(layer) => KIND_OPTIONS.find((entry) => entry.value === layer.kind)?.label ?? layer.kind}
        onChange={write}
        renderItem={(layer, update) => (
          <>
            <SelectRow<Layer['kind']>
              label="Rodzaj"
              value={layer.kind}
              options={KIND_OPTIONS}
              onChange={(kind) => update({ ...blankLayer(kind, mode), speed: layer.speed })}
            />
            <NumberRow
              label={layer.kind === 'bigtext' ? 'Długość przejazdu (0–1)' : 'Tempo (0–1)'}
              step={0.01}
              value={layer.speed}
              hint={
                layer.kind === 'bigtext'
                  ? 'Napis wędruje z dołu do góry ekranu. 1 = pełna wysokość ekranu.'
                  : '0 = warstwa stoi w miejscu, 1 = przesuwa się razem z treścią.'
              }
              onChange={(speed) => update({ ...layer, speed: Math.max(0, Math.min(1, speed)) })}
            />

            {layer.kind === 'gradient' ? (
              <>
                <NumberRow label="Kąt" value={layer.angle} onChange={(angle) => update({ ...layer, angle })} />
                <TextRow label="Kolor początkowy" value={layer.from} onChange={(from) => update({ ...layer, from })} />
                <TextRow
                  label="Kolor pośredni"
                  value={layer.via ?? ''}
                  onChange={(via) => update({ ...layer, via: via || null })}
                />
                <TextRow label="Kolor końcowy" value={layer.to} onChange={(to) => update({ ...layer, to })} />
              </>
            ) : null}

            {layer.kind === 'image' ? (
              <>
                <ImagePicker
                  siteId={siteId}
                  value={layer.url}
                  onPick={(url) => update({ ...layer, url })}
                />
                <TextRow
                  label="Adres obrazu"
                  value={layer.url}
                  hint="Wypełnia się po wgraniu pliku. Można też wkleić adres z zewnątrz."
                  onChange={(url) => update({ ...layer, url })}
                />
                <NumberRow
                  label="Krycie (0–1)"
                  step={0.05}
                  value={layer.opacity}
                  onChange={(opacity) => update({ ...layer, opacity: Math.max(0, Math.min(1, opacity)) })}
                />
                <SelectRow
                  label="Tryb mieszania"
                  value={layer.blend}
                  options={BLEND_OPTIONS}
                  onChange={(blend) => update({ ...layer, blend })}
                />
                <TextRow
                  label="Pozycja"
                  value={layer.position}
                  hint="Np. center, top, 50% 30%."
                  onChange={(position) => update({ ...layer, position })}
                />
              </>
            ) : null}

            {layer.kind === 'bigtext' ? (
              <>
                <LinesRow
                  label="Linie napisu"
                  rows={3}
                  hint="Maksymalnie trzy linie."
                  values={layer.lines}
                  onChange={(lines) => update({ ...layer, lines })}
                />
                <NumberRow
                  label="Krycie (0–1)"
                  step={0.01}
                  value={layer.opacity}
                  onChange={(opacity) => update({ ...layer, opacity: Math.max(0, Math.min(1, opacity)) })}
                />
                <TextRow
                  label="Kolor"
                  value={layer.color ?? ''}
                  hint="Puste = kolor tekstu motywu."
                  onChange={(color) => update({ ...layer, color: color || null })}
                />
              </>
            ) : null}
          </>
        )}
      />
      <button type="button" className="eve-add" onClick={() => onChange(defaultLayersJson(menuLabel, mode))}>
        Przywróć domyślne warstwy
      </button>
    </>
  );
}
