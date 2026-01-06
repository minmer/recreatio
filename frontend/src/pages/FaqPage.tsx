import type { Copy } from '../content/types';

export function FaqPage({ copy }: { copy: Copy }) {
  return (
    <section className="faq">
      <h2>{copy.faq.title}</h2>
      <div className="faq-grid">
        {copy.faq.items.map((item) => (
          <article key={item.q}>
            <h4>{item.q}</h4>
            <p>{item.a}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
