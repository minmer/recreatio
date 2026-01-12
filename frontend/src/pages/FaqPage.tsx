import type { Copy } from '../content/types';

export function FaqPage({ copy }: { copy: Copy }) {
  return (
    <section className="faq">
      <h2>{copy.faq.title}</h2>
      <div className="faq-grid">
        {copy.faq.items.map((item) => (
          <details key={item.q} className="faq-item">
            <summary>{item.q}</summary>
            {item.a.split('\n').map((line) => (
              <p key={line}>{line}</p>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}
