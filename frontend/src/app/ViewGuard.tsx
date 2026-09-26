/**
 * WENN EINE ANSICHT STÜRZT, BLEIBT DIE SEITE STEHEN — mit dem Grund.
 *
 * <b>Ohne diese Grenze nimmt React bei einem Fehler im Zeichnen die GANZE
 * Anwendung ab.</b> Auf dem Telefon blieb dann ein leeres Bild, und niemand
 * konnte sagen, was geschehen war — nur, dass „es nicht lädt". Hier steht
 * stattdessen die Meldung selbst, und zwei Wege weiter.
 *
 * Sie gilt der Ansicht, nicht dem Kopf: Marke, Weg und „Wyloguj" bleiben
 * bedienbar. Beim Wechsel der Adresse beginnt sie von vorn — ein Fehler auf
 * einer Seite soll die nächste nicht verdecken.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface GuardState {
  readonly error: Error | null;
}

export class ViewGuard extends Component<{ children: ReactNode }, GuardState> {
  state: GuardState = { error: null };

  static getDerivedStateFromError(error: unknown): GuardState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidMount(): void {
    window.addEventListener('hashchange', this.reset);
  }

  componentWillUnmount(): void {
    window.removeEventListener('hashchange', this.reset);
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Für die Entwicklerwerkzeuge des Browsers — dorthin schaut, wer den Fehler sucht.
    console.error(error, info.componentStack);
  }

  private readonly reset = (): void => {
    if (this.state.error !== null) this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <section className="wk-panel" role="alert">
        <h1 className="wk-h1">Ten widok się zatrzymał</h1>
        <p className="wk-lede">
          Coś poszło nie tak przy wyświetlaniu tej części. Spróbuj ponownie — a jeśli błąd wraca,
          przekaż komunikat poniżej.
        </p>
        <p className="wk-error">{error.name !== 'Error' ? `${error.name}: ` : ''}{error.message}</p>
        <div className="wk-actions">
          <button type="button" className="wk-btn" onClick={this.reset}>Spróbuj ponownie</button>
          <button type="button" className="wk-link-btn" onClick={() => window.location.reload()}>
            Załaduj stronę od nowa
          </button>
        </div>
      </section>
    );
  }
}
