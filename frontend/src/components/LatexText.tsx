import { BlockMath, InlineMath } from 'react-katex';

export function LatexBlock({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <BlockMath math={value} renderError={() => <span>{value}</span>} />
    </div>
  );
}

export function LatexInline({ value, className }: { value: string; className?: string }) {
  if (!value) return null;
  return (
    <span className={className}>
      <InlineMath math={value} renderError={() => <span>{value}</span>} />
    </span>
  );
}
