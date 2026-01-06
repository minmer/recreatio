import type { Copy } from '../content/types';

export function LegalPage({ copy }: { copy: Copy }) {
  return (
    <section className="legal">
      <h2>{copy.legal.title}</h2>
      <div className="legal-grid">
        {copy.legal.items.map((item) => (
          <article key={item.title}>
            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
