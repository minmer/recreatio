/**
 * DATEIEN HINEINZIEHEN (2026-10-27) — auf „Pliki przez link" und in die Antwort aus dem
 * Browser. Die ganze Seite nimmt sie an, nicht nur ein Feld: eine Datei, die daneben
 * fällt, öffnete der Browser sonst selbst — und die Seite wäre fort.
 */

import { useEffect, useRef, useState } from 'react';

import { Icon } from '../ui/icons';

const carriesFiles = (e: DragEvent): boolean => e.dataTransfer !== null && Array.from(e.dataTransfer.types).includes('Files');

/**
 * Solange `onFiles` gesetzt ist, fängt das Fenster gezogene Dateien. Zurück kommt, ob gerade
 * eine darüber schwebt (dann zeigt die Seite `DropVeil`).
 */
export function usePageDrop(onFiles: ((files: File[]) => void) | null): boolean {
  const [over, setOver] = useState(false);
  const keep = useRef(onFiles);
  keep.current = onFiles;
  const on = onFiles !== null;

  useEffect(() => {
    if (!on) return undefined;
    const enter = (e: DragEvent) => { if (carriesFiles(e)) setOver(true); };
    const hover = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer !== null) e.dataTransfer.dropEffect = 'copy';
      setOver(true);
    };
    /* Hinaus aus dem Fenster (oder Esc): kein Element, in das es weiterginge. */
    const leave = (e: DragEvent) => { if (e.relatedTarget === null) setOver(false); };
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return;
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) keep.current?.(files);
    };
    document.addEventListener('dragenter', enter);
    document.addEventListener('dragover', hover);
    document.addEventListener('dragleave', leave);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragenter', enter);
      document.removeEventListener('dragover', hover);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('drop', drop);
      setOver(false);
    };
  }, [on]);

  return over;
}

/** Über allem, solange eine Datei darüber schwebt: was mit ihr geschieht, wenn man loslässt. */
export function DropVeil({ text }: { text: string }) {
  return (
    <div className="ph-drop-veil" aria-hidden="true">
      <span className="ph-drop-text"><Icon name="upload" />{text}</span>
    </div>
  );
}
