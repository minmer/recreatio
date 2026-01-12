import type { Copy } from '../content/types';

export function LegalPage({ copy }: { copy: Copy }) {
  return (
    <section className="legal">
      <h2>{copy.legal.title}</h2>
      <div className="legal-grid">
        {copy.legal.items.map((item) => (
          <details key={item.title} className="legal-item">
            <summary>{item.title}</summary>
            {item.desc.split('\n').map((line) => (
              <p key={line}>{line}</p>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}
