import { useState } from 'react';
import type { FormQuestion, FormResponseRow, FormResponsesData } from '../../lib/api';

type ViewMode = 'person' | 'question' | 'table' | 'charts';

export type FormResponsesViewerProps = {
  data: FormResponsesData;
  onDeleteResponse?: (responseId: string) => void;
};

const SCALE_COLORS = ['#FF5252', '#FF9800', '#FFEB3B', '#8BC34A', '#4CAF50'];
const OPTION_COLORS = [
  '#4A9EFF', '#FF6B6B', '#4CAF50', '#FFB300',
  '#9C27B0', '#FF5722', '#00BCD4', '#E91E63', '#26A69A', '#78909C'
];

// ── Main viewer ───────────────────────────────────────────────────────────────

export function FormResponsesViewer({ data, onDeleteResponse }: FormResponsesViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('person');
  const [personIdx, setPersonIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);

  const { responses, questions } = data;
  const total = responses.length;
  const qTotal = questions.length;
  const safePersonIdx = Math.min(personIdx, Math.max(0, total - 1));
  const safeQuestionIdx = Math.min(questionIdx, Math.max(0, qTotal - 1));

  const modeLabels: Record<ViewMode, string> = {
    person: 'Wg osoby',
    question: 'Wg pytania',
    table: 'Tabela',
    charts: 'Wykresy',
  };

  return (
    <div className="frm-responses">
      <div>
        <div className="frm-section-title">{data.title}</div>
        <div className="frm-section-sub">
          {total === 0 ? 'Brak odpowiedzi' : `${total} ${total === 1 ? 'odpowiedź' : 'odpowiedzi'}`}
        </div>
      </div>

      <div className="frm-responses-header frm-no-print">
        <div className="frm-view-toggle">
          {(['person', 'question', 'table', 'charts'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'active' : ''}
              onClick={() => setViewMode(mode)}
            >
              {modeLabels[mode]}
            </button>
          ))}
        </div>

        {viewMode === 'person' && total > 0 && (
          <div className="frm-nav-row">
            <button className="frm-btn ghost small" onClick={() => setPersonIdx(i => i - 1)} disabled={safePersonIdx === 0}>←</button>
            <div>
              <div className="frm-nav-label">{responses[safePersonIdx]?.respondentName ?? `Osoba ${safePersonIdx + 1}`}</div>
              <div className="frm-nav-sub">{safePersonIdx + 1} / {total}</div>
            </div>
            <button className="frm-btn ghost small" onClick={() => setPersonIdx(i => i + 1)} disabled={safePersonIdx >= total - 1}>→</button>
          </div>
        )}

        {viewMode === 'question' && qTotal > 0 && (
          <div className="frm-nav-row">
            <button className="frm-btn ghost small" onClick={() => setQuestionIdx(i => i - 1)} disabled={safeQuestionIdx === 0}>←</button>
            <div>
              <div className="frm-nav-label" style={{ fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {questions[safeQuestionIdx]?.text}
              </div>
              <div className="frm-nav-sub">Pytanie {safeQuestionIdx + 1} / {qTotal}</div>
            </div>
            <button className="frm-btn ghost small" onClick={() => setQuestionIdx(i => i + 1)} disabled={safeQuestionIdx >= qTotal - 1}>→</button>
          </div>
        )}
      </div>

      {total === 0 && (viewMode === 'person' || viewMode === 'question') && (
        <div className="frm-empty">Brak odpowiedzi na ten formularz.</div>
      )}

      {/* Person view */}
      {viewMode === 'person' && total > 0 && (() => {
        const resp = responses[safePersonIdx];
        if (!resp) return null;
        return (
          <div className="frm-response-card">
            <div className="frm-response-card-head">
              <span className="frm-response-name">{resp.respondentName ?? 'Anonimowy respondent'}</span>
              <span className="frm-response-date">{new Date(resp.submittedUtc).toLocaleString('pl-PL')}</span>
              {onDeleteResponse && (
                <button className="frm-btn danger small frm-no-print" onClick={() => onDeleteResponse(resp.responseId)}>Usuń</button>
              )}
            </div>
            <div className="frm-answers">
              {questions.map(q => {
                const answer = resp.answers.find(a => a.questionId === q.id) ?? null;
                return (
                  <div key={q.id} className="frm-answer-row">
                    <div className="frm-answer-q">{q.text}</div>
                    <AnswerDisplay question={q} answer={answer} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Question view */}
      {viewMode === 'question' && qTotal > 0 && (() => {
        const q = questions[safeQuestionIdx];
        if (!q) return null;
        return (
          <div className="frm-response-card">
            <div className="frm-response-card-head">
              <span className="frm-response-name">{q.text}</span>
              <span className="frm-badge draft">
                {q.type === 'text' ? 'Tekst' : q.type === 'multiselect' ? 'Wielokrotny wybór' : 'Skala 1–5'}
              </span>
            </div>
            <div className="frm-answers">
              {total === 0 ? (
                <div className="frm-empty" style={{ padding: '16px 0' }}>Brak odpowiedzi.</div>
              ) : (
                responses.map(resp => {
                  const answer = resp.answers.find(a => a.questionId === q.id) ?? null;
                  return (
                    <div key={resp.responseId} className="frm-answer-row">
                      <div className="frm-answer-q" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>
                          {resp.respondentName ?? 'Anonim'} —{' '}
                          <span style={{ opacity: 0.6, fontSize: '0.74rem' }}>{new Date(resp.submittedUtc).toLocaleString('pl-PL')}</span>
                        </span>
                        {onDeleteResponse && (
                          <button className="frm-btn danger small frm-no-print" style={{ marginLeft: 'auto', flexShrink: 0 }} onClick={() => onDeleteResponse(resp.responseId)}>Usuń</button>
                        )}
                      </div>
                      <AnswerDisplay question={q} answer={answer} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {viewMode === 'table' && <TableView data={data} onDeleteResponse={onDeleteResponse} />}
      {viewMode === 'charts' && <ChartsView data={data} />}
    </div>
  );
}

// ── Answer display ────────────────────────────────────────────────────────────

function AnswerDisplay({ question, answer }: {
  question: FormQuestion;
  answer: { textValue: string | null; selectedOptions: string[] | null } | null;
}) {
  if (!answer) return <div className="frm-answer-val empty">brak odpowiedzi</div>;

  if (question.type === 'text') {
    return (
      <div className="frm-answer-val">
        {answer.textValue?.trim() || <span className="empty">brak odpowiedzi</span>}
      </div>
    );
  }

  if (question.type === 'scale') {
    const val = answer.textValue ? parseInt(answer.textValue, 10) : null;
    return (
      <div className="frm-scale-display">
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} className={`frm-scale-dot ${val === n ? 'selected' : ''}`}>{n}</div>
        ))}
      </div>
    );
  }

  if (question.type === 'multiselect') {
    const selected = answer.selectedOptions ?? [];
    if (!selected.length) return <div className="frm-answer-val empty">brak odpowiedzi</div>;
    return (
      <div className="frm-multiselect-chips">
        {selected.map((opt, i) => <span key={i} className="frm-multiselect-chip">{opt}</span>)}
      </div>
    );
  }

  return <div className="frm-answer-val empty">—</div>;
}

// ── Table view ────────────────────────────────────────────────────────────────

function TableView({ data, onDeleteResponse }: { data: FormResponsesData; onDeleteResponse?: (id: string) => void }) {
  const { responses, questions } = data;

  function getCellText(q: FormQuestion, resp: FormResponseRow): string {
    const a = resp.answers.find(ans => ans.questionId === q.id);
    if (!a) return '';
    if (q.type === 'multiselect') return a.selectedOptions?.join(', ') ?? '';
    return a.textValue?.trim() ?? '';
  }

  // Per-question max answer length, used for adaptive column widths
  const maxLen: Record<string, number> = {};
  for (const q of questions) {
    maxLen[q.id] = responses.reduce((m, r) => Math.max(m, getCellText(q, r).length), q.text.length);
  }

  function colWidth(q: FormQuestion): string {
    if (q.type === 'scale') return '52px';
    const len = maxLen[q.id] ?? 0;
    return `${Math.min(360, Math.max(88, Math.round(len * 2.0)))}px`;
  }

  function cellFontSize(len: number): string {
    if (len > 150) return '0.65rem';
    if (len > 80) return '0.70rem';
    return '0.75rem';
  }

  return (
    <div className="frm-table-view">
      <div className="frm-table-topbar frm-no-print">
        <span className="frm-table-info">{responses.length} odpowiedzi · {questions.length} pytań</span>
        <button className="frm-btn ghost small" onClick={() => window.print()}>
          Drukuj / Eksportuj PDF
        </button>
      </div>

      <div className="frm-table-scroll">
        <table className="frm-table">
          <thead>
            <tr>
              <th className="frm-table-th-num">#</th>
              <th className="frm-table-th-name">Imię / Nazwisko</th>
              <th className="frm-table-th-date">Data</th>
              {questions.map((q, i) => (
                <th key={q.id} className="frm-table-th-q" style={{ width: colWidth(q) }} title={q.text}>
                  <div className="frm-table-th-badge">P{i + 1}</div>
                  <div className="frm-table-th-text">{q.text}</div>
                  <div className="frm-table-th-type">
                    {q.type === 'text' ? 'tekst' : q.type === 'multiselect' ? 'wybór' : 'skala'}
                  </div>
                </th>
              ))}
              {onDeleteResponse && <th className="frm-table-th-action frm-no-print" />}
            </tr>
          </thead>
          <tbody>
            {responses.length === 0 ? (
              <tr>
                <td colSpan={3 + questions.length + (onDeleteResponse ? 1 : 0)} className="frm-table-empty-cell">
                  Brak odpowiedzi
                </td>
              </tr>
            ) : (
              responses.map((resp, i) => (
                <tr key={resp.responseId}>
                  <td className="frm-table-td-num">{i + 1}</td>
                  <td className="frm-table-td-name">
                    {resp.respondentName ?? <em style={{ opacity: 0.45 }}>Anonim</em>}
                  </td>
                  <td className="frm-table-td-date">{new Date(resp.submittedUtc).toLocaleDateString('pl-PL')}</td>
                  {questions.map(q => {
                    const text = getCellText(q, resp);
                    if (q.type === 'scale') {
                      const n = parseInt(text, 10);
                      return (
                        <td key={q.id} className="frm-table-td-scale">
                          {!isNaN(n) ? (
                            <span className="frm-table-scale-badge" style={{ background: SCALE_COLORS[n - 1] }}>
                              {n}
                            </span>
                          ) : <span className="frm-table-td-empty-text">—</span>}
                        </td>
                      );
                    }
                    return (
                      <td
                        key={q.id}
                        className={text ? 'frm-table-td-text' : 'frm-table-td-empty-text'}
                        style={text ? { fontSize: cellFontSize(text.length) } : undefined}
                      >
                        {text || '—'}
                      </td>
                    );
                  })}
                  {onDeleteResponse && (
                    <td className="frm-table-td-action frm-no-print">
                      <button className="frm-btn danger small" onClick={() => onDeleteResponse(resp.responseId)}>Usuń</button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Charts view ───────────────────────────────────────────────────────────────

function ChartsView({ data }: { data: FormResponsesData }) {
  const { responses, questions } = data;

  if (questions.length === 0) {
    return <div className="frm-empty">Brak pytań w tym formularzu.</div>;
  }

  return (
    <div className="frm-charts-grid">
      {questions.map(q => (
        <QuestionChart key={q.id} question={q} responses={responses} total={responses.length} />
      ))}
    </div>
  );
}

function QuestionChart({ question, responses, total }: {
  question: FormQuestion;
  responses: FormResponseRow[];
  total: number;
}) {
  if (question.type === 'scale') {
    const dist = [1, 2, 3, 4, 5].map((n, i) => {
      const matched = responses.filter(r => r.answers.find(a => a.questionId === question.id)?.textValue === String(n));
      return { n, color: SCALE_COLORS[i], count: matched.length, people: matched.map(r => r.respondentName ?? 'Anonim') };
    });
    const totalAnswered = dist.reduce((s, d) => s + d.count, 0);
    const maxCount = Math.max(...dist.map(d => d.count), 1);
    const avg = totalAnswered > 0
      ? (dist.reduce((s, d) => s + d.n * d.count, 0) / totalAnswered).toFixed(1)
      : null;

    return (
      <div className="frm-chart-card">
        <div className="frm-chart-type-badge frm-chart-type-scale">Skala 1–5</div>
        <div className="frm-chart-question-text">{question.text}</div>
        <div className="frm-chart-body">
          <div className="frm-chart-bars">
            {dist.map(({ n, color, count }) => (
              <div key={n} className="frm-chart-bar-row">
                <span className="frm-chart-bar-label" style={{ color }}>{n}</span>
                <div className="frm-chart-bar-track">
                  <div className="frm-chart-bar-fill" style={{ width: `${(count / maxCount) * 100}%`, background: color }} />
                </div>
                <span className="frm-chart-bar-count">
                  {count}
                  {totalAnswered > 0 && <span className="frm-chart-bar-pct"> {Math.round((count / totalAnswered) * 100)}%</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="frm-chart-donut-col">
            <DonutChart segments={dist.map(d => ({
              color: d.color,
              pct: totalAnswered > 0 ? d.count / totalAnswered : 0,
              label: `Ocena ${d.n}`,
              people: d.people,
            }))} />
            {avg !== null && (
              <div className="frm-chart-avg">
                <div className="frm-chart-avg-val">{avg}</div>
                <div className="frm-chart-avg-label">/ 5 średnia</div>
              </div>
            )}
          </div>
        </div>
        <div className="frm-chart-footer">{totalAnswered} z {total} odpowiedzi</div>
      </div>
    );
  }

  if (question.type === 'multiselect') {
    const opts = question.options ?? [];
    const dist = opts
      .map((opt, i) => {
        const matched = responses.filter(r =>
          r.answers.find(a => a.questionId === question.id)?.selectedOptions?.includes(opt)
        );
        return { opt, color: OPTION_COLORS[i % OPTION_COLORS.length], count: matched.length, people: matched.map(r => r.respondentName ?? 'Anonim') };
      })
      .sort((a, b) => b.count - a.count);

    const totalSelections = dist.reduce((s, d) => s + d.count, 0);
    const maxCount = Math.max(...dist.map(d => d.count), 1);
    const answeredCount = responses.filter(r => {
      const a = r.answers.find(ans => ans.questionId === question.id);
      return a?.selectedOptions && a.selectedOptions.length > 0;
    }).length;

    return (
      <div className="frm-chart-card">
        <div className="frm-chart-type-badge frm-chart-type-multi">Wielokrotny wybór</div>
        <div className="frm-chart-question-text">{question.text}</div>
        <div className="frm-chart-body">
          <div className="frm-chart-bars frm-chart-bars-wide">
            {dist.map(({ opt, color, count }) => (
              <div key={opt} className="frm-chart-bar-row">
                <span className="frm-chart-bar-label-wide" title={opt}>
                  {opt.length > 20 ? opt.slice(0, 20) + '…' : opt}
                </span>
                <div className="frm-chart-bar-track">
                  <div className="frm-chart-bar-fill" style={{ width: `${(count / maxCount) * 100}%`, background: color }} />
                </div>
                <span className="frm-chart-bar-count">
                  {count}
                  {total > 0 && <span className="frm-chart-bar-pct"> {Math.round((count / total) * 100)}%</span>}
                </span>
              </div>
            ))}
          </div>
          {opts.length > 1 && totalSelections > 0 && (
            <div className="frm-chart-donut-col">
              <DonutChart
                segments={dist.map(d => ({
                  color: d.color,
                  pct: totalSelections > 0 ? d.count / totalSelections : 0,
                  label: d.opt,
                  people: d.people,
                }))}
              />
              <div className="frm-chart-avg">
                <div className="frm-chart-avg-val">{totalSelections}</div>
                <div className="frm-chart-avg-label">wyborów</div>
              </div>
            </div>
          )}
        </div>
        <div className="frm-chart-footer">{answeredCount} z {total} odpowiedzi</div>
      </div>
    );
  }

  // Text question
  const textAnswers = responses.flatMap(r => {
    const a = r.answers.find(ans => ans.questionId === question.id);
    if (!a?.textValue?.trim()) return [];
    return [{ name: r.respondentName, text: a.textValue.trim(), date: r.submittedUtc }];
  });

  return (
    <div className="frm-chart-card frm-chart-card--wide">
      <div className="frm-chart-type-badge frm-chart-type-text">Tekst otwarty</div>
      <div className="frm-chart-question-text">{question.text}</div>
      <div className="frm-chart-text-list">
        {textAnswers.length === 0 ? (
          <div style={{ padding: '8px 0', color: 'var(--frm-text-soft)', fontSize: '0.875rem' }}>Brak odpowiedzi tekstowych.</div>
        ) : (
          textAnswers.map((a, i) => (
            <div key={i} className="frm-chart-text-item">
              <div className="frm-chart-text-meta">{a.name ?? 'Anonim'} · {new Date(a.date).toLocaleDateString('pl-PL')}</div>
              {a.text}
            </div>
          ))
        )}
      </div>
      <div className="frm-chart-footer">{textAnswers.length} z {total} odpowiedzi</div>
    </div>
  );
}

// ── SVG Donut chart ───────────────────────────────────────────────────────────

function DonutChart({ segments, size = 110 }: {
  segments: Array<{ color: string; pct: number; label?: string; people?: string[] }>;
  size?: number;
}) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.40, innerR = size * 0.23;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const nonEmpty = segments.filter(s => s.pct > 0.001);
  if (nonEmpty.length === 0) return null;

  let cumPct = 0;
  const hovSeg = hovIdx !== null ? nonEmpty[hovIdx] : null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
        onMouseLeave={() => setHovIdx(null)}
      >
        {nonEmpty.map((seg, i) => {
          const startDeg = cumPct * 360 - 90;
          cumPct += seg.pct;
          const endDeg = cumPct * 360 - 90;
          const dimmed = hovIdx !== null && hovIdx !== i;

          if (seg.pct >= 0.998) {
            return (
              <g key={i} style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovIdx(i)}>
                <circle cx={cx} cy={cy} r={r} fill={seg.color} opacity={dimmed ? 0.35 : 1} style={{ transition: 'opacity 0.15s' }} />
                <circle cx={cx} cy={cy} r={innerR} fill="var(--frm-bg-card)" />
              </g>
            );
          }

          const large = seg.pct > 0.5 ? 1 : 0;
          const sx = cx + r * Math.cos(toRad(startDeg));
          const sy = cy + r * Math.sin(toRad(startDeg));
          const ex = cx + r * Math.cos(toRad(endDeg));
          const ey = cy + r * Math.sin(toRad(endDeg));
          const iex = cx + innerR * Math.cos(toRad(endDeg));
          const iey = cy + innerR * Math.sin(toRad(endDeg));
          const isx = cx + innerR * Math.cos(toRad(startDeg));
          const isy = cy + innerR * Math.sin(toRad(startDeg));

          return (
            <path
              key={i}
              d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey} L ${iex} ${iey} A ${innerR} ${innerR} 0 ${large} 0 ${isx} ${isy} Z`}
              fill={seg.color}
              opacity={dimmed ? 0.35 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHovIdx(i)}
            />
          );
        })}
      </svg>
      {hovSeg && hovSeg.people && hovSeg.people.length > 0 && (
        <div className="frm-donut-tooltip">
          {hovSeg.label && (
            <div className="frm-donut-tooltip-label" style={{ color: hovSeg.color }}>
              {hovSeg.label}
            </div>
          )}
          <div className="frm-donut-tooltip-people">
            {hovSeg.people.map((p, i) => (
              <div key={i} className="frm-donut-tooltip-person">{p}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
