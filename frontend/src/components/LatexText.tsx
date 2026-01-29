import { BlockMath, InlineMath } from 'react-katex';

type LatexMode = 'math' | 'auto';
type LatexSegment = { type: 'text' | 'inline' | 'block'; value: string };

const splitLatex = (value: string): LatexSegment[] => {
  const segments: LatexSegment[] = [];
  let buffer = '';
  let i = 0;

  const isEscaped = (index: number) => {
    let backslashes = 0;
    for (let j = index - 1; j >= 0 && value[j] === '\\'; j -= 1) {
      backslashes += 1;
    }
    return backslashes % 2 === 1;
  };

  const flushText = () => {
    if (!buffer) return;
    segments.push({ type: 'text', value: buffer.replace(/\\\$/g, '$') });
    buffer = '';
  };

  while (i < value.length) {
    const char = value[i];
    if (char === '$' && !isEscaped(i)) {
      const isBlock = value[i + 1] === '$' && !isEscaped(i + 1);
      const delimiter = isBlock ? '$$' : '$';
      const start = i + delimiter.length;
      let end = start;
      let found = false;
      while (end < value.length) {
        if (value.startsWith(delimiter, end) && !isEscaped(end)) {
          found = true;
          break;
        }
        end += 1;
      }
      if (found) {
        flushText();
        const content = value.slice(start, end);
        segments.push({ type: isBlock ? 'block' : 'inline', value: content });
        i = end + delimiter.length;
        continue;
      }
    }
    buffer += char;
    i += 1;
  }

  flushText();
  return segments;
};

const renderText = (text: string, key: string) => {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  if (lines.length === 1) return <span key={key}>{text}</span>;
  return (
    <span key={key}>
      {lines.map((line, index) => (
        <span key={`${key}-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </span>
  );
};

export function LatexBlock({
  value,
  className,
  mode = 'math'
}: {
  value: string;
  className?: string;
  mode?: LatexMode;
}) {
  if (!value) return null;
  if (mode === 'math') {
    return (
      <div className={className}>
        <BlockMath math={value} renderError={() => <span>{value}</span>} strict="ignore" />
      </div>
    );
  }
  const segments = splitLatex(value);
  const hasMath = segments.some((segment) => segment.type !== 'text');
  if (!hasMath) {
    return <div className={className}>{value}</div>;
  }
  return (
    <div className={className}>
      {segments.map((segment, index) => {
        const key = `latex-${index}`;
        if (segment.type === 'text') return renderText(segment.value, key);
        if (segment.type === 'block') {
          return <BlockMath key={key} math={segment.value} strict="ignore" renderError={() => <span>{segment.value}</span>} />;
        }
        return <InlineMath key={key} math={segment.value} strict="ignore" renderError={() => <span>{segment.value}</span>} />;
      })}
    </div>
  );
}

export function LatexInline({
  value,
  className,
  mode = 'math'
}: {
  value: string;
  className?: string;
  mode?: LatexMode;
}) {
  if (!value) return null;
  if (mode === 'math') {
    return (
      <span className={className}>
        <InlineMath math={value} renderError={() => <span>{value}</span>} strict="ignore" />
      </span>
    );
  }
  const segments = splitLatex(value);
  const hasMath = segments.some((segment) => segment.type !== 'text');
  if (!hasMath) {
    return <span className={className}>{value}</span>;
  }
  return (
    <span className={className}>
      {segments.map((segment, index) => {
        const key = `latex-inline-${index}`;
        if (segment.type === 'text') return renderText(segment.value, key);
        if (segment.type === 'block') {
          return <InlineMath key={key} math={segment.value} strict="ignore" renderError={() => <span>{segment.value}</span>} />;
        }
        return <InlineMath key={key} math={segment.value} strict="ignore" renderError={() => <span>{segment.value}</span>} />;
      })}
    </span>
  );
}
