/**
 * 2026-11-01 — WZORY, nachgemessen (Lehrbücher als Tekst źródła, und der Zapis überall).
 *
 *   1. Lesen: Dollar nach Pandoc (5$ und 10$ sind kein Wzór), `\$`, `$$…$$`, daneben die Zeichen der Texte.
 *   2. Ausbessern, was eine KI verdirbt: Steuerzeichen statt Backslash (\f in \frac, \t in \theta, \n in \nabla —
 *      auch in eigenen Makra), `\( \)`, `\[ \]`, nackte Umgebungen, doppelte Backslashes, `\newcommand` im Wzór,
 *      `\tag` im Satz, ein Seitenwechsel mitten im Wzór; ein echter Zeilenwechsel bleibt.
 *   3. JSON, wie eine KI es schreibt: einfache Backslashes, gar nicht entwertet (dann bleibt `\\` der Umbruch
 *      einer Macierz), Zaun und Sätze drumherum, rohe Zeilenwechsel — gültiges JSON bleibt, wie es ist.
 *   4. KaTeX setzt die Schreibweisen der Lehrbücher: über 100 Wzory aus Analysis, linearer Algebra, Algebra,
 *      Logik, Wahrscheinlichkeit, Physik, Chemie, mit allen Umgebungen — auch was KaTeX selbst nicht kennt
 *      (\label, \eqref, multline, eqnarray, \DeclareMathOperator, \intertext, \qed) — und nennt, was falsch ist.
 *   5. Das Lehrbuch (fixtures/podrecznik-wzory.json): zwei Kapitel ohne einen Hinweis, Labels, Verweise über
 *      Teile, Aussagen ineinander, Export → Import gleich, Suche nach Wort, Zeichen und LaTeX, „Twierdzenie 3.4".
 *   6. Dasselbe Lehrbuch, wie eine KI es verdirbt (nicht entwertet, `\( \)`, Zaun, Steuerzeichen): dieselben Blöcke.
 *   7. Was der Import sagt: kaputter Wzór, einzelnes $, fehlende Seite, Verweis ohne Ziel, doppelte Etykieta.
 *   8. Gezeichnet (ohne Browser): Kästen, ∎, Rysunek, Kod, Verweise; die Abschrift für den Dostęp dla AI.
 *   9. Der Zapis (Bazy wiedzy, Skryptorium, Cogita, Seiten): `$…$` wird ein Wzór, „5$" nicht; Klartext; LaTeX-Export.
 */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workspace = await mkdtemp(join(tmpdir(), 'app-tex-'));
const entry = join(workspace, 'entry.tsx');
const app = join(process.cwd(), 'src/app/').replace(/\\/g, '/');
await writeFile(entry, `
export * as T from '${app}core/tex';
export * as J from '${app}core/jsonText';
export * as S from '${app}library/sourceText';
export * as L from '${app}library/textLabels';
export * as K from '${app}ui/tex/katexCore';
export { SourceFlow, TextRefsContext } from '${app}library/SourceBlocks';
export { snapshotTexts } from '${app}aiAccess/aiSnapshot';
export { parseInline, parseMarkup, plainText } from '${app}library/libraryMarkup';
export { TextArticle } from '${app}scriptorium/TextArticle';
export { textToLatex } from '${app}scriptorium/latex';
export { inline as richInline } from '${app}ui/richText';
export { renderToStaticMarkup } from 'react-dom/server';
export { createElement, Fragment } from 'react';
`);
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  nodePaths: [join(process.cwd(), 'node_modules')],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
  outfile: join(workspace, 'entry.mjs'),
  define: { 'import.meta.env': JSON.stringify({ DEV: false, VITE_APP_API: '' }) },
  loader: { '.css': 'empty' },
  logLevel: 'error'
});

const broadcastChannel = globalThis.BroadcastChannel;
globalThis.BroadcastChannel = undefined;

try {
  const m = await import(pathToFileURL(join(workspace, 'entry.mjs')).href);
  const { T, J, S, L, K } = m;
  const ok = (label) => console.log(`ok   ${label}`);

  /* -- 1. Lesen ------------------------------------------------------------------------------- */
  {
    const math = (text) => T.texPieces(text).filter((p) => p.t === 'math');
    assert.equal(math('Cena 5$ i 10$.').length, 0, 'prices are no formula');
    assert.equal(math('$20,000 and $30,000').length, 0, 'Pandoc: a closing $ before a digit');
    assert.equal(math('$ x$').length, 0, 'Pandoc: no space after the opening $');
    assert.equal(math('$x $').length, 0, 'Pandoc: no space before the closing $');
    assert.deepEqual(math('Niech $x^2+1$ i $$\\int_0^1 f$$.'), [{ t: 'math', tex: 'x^2+1', display: false }, { t: 'math', tex: '\\int_0^1 f', display: true }], 'inline and display');
    assert.deepEqual(T.texPieces('koszt \\$5 i $y$')[0], { t: 'text', v: 'koszt $5 i ' }, '\\$ is a dollar');
    assert.equal(math('$\\text{5 $ zł}$').length, 1, 'a $ inside \\text{} does not end the formula');
    assert.equal(math('$$a \\\\$$').length, 1, 'a row break right before $$');
    const pieces = S.pieces('Z {{ref twierdzenia 2.3}} i $\\{\\{x\\}\\}$ {{page 4}} oraz $a$.');
    assert.deepEqual(pieces.map((p) => p.t), ['text', 'ref', 'text', 'math', 'text', 'page', 'text', 'math', 'text'], 'marks and formulas side by side; {{ inside a formula is TeX');
    assert.equal(S.plainOfText('Kąt $\\alpha \\le \\frac{\\pi}{2}$ {{ref (2.1)}}.'), 'Kąt α ≤ π/2 (2.1).', 'plain: a formula as a line of text, a reference by its words');
    ok('reading: Pandoc dollars, \\$, display, marks next to formulas, plain text');
  }

  /* -- 2. Ausbessern --------------------------------------------------------------------------- */
  {
    const r = (s, words) => T.repairTexText(s, words);
    assert.equal(r('Ułamek $\fraca{b}$').text, 'Ułamek $\\fraca{b}$', '\\f (form feed) → \\frac');
    assert.equal(r('Kąt $\theta$ i $x \to y$').text, 'Kąt $\\theta$ i $x \\to y$', '\\t (tab) at the start of a formula and inside');
    assert.equal(r('$$\nabla f = 0$$').text, '$$\\nabla f = 0$$', '\\n (newline) + abla');
    assert.equal(r('$x \neq y$ i $\nu$').text, '$x \\neq y$ i $\\nu$', '\\neq, \\nu inline');
    assert.equal(r('$\rho = \right)$').text, '$\\rho = \\right)$', '\\r (carriage return)');
    assert.equal(r('$\begin{matrix} a \\end{matrix}$').text, '$\\begin{matrix} a \\end{matrix}$', '\\b (backspace)');
    assert.equal(r('$$\nx^2$$').text, '$$\nx^2$$', 'a real line break inside a display stays');
    assert.equal(r('$$a \\\\\nu = 1$$').text, '$$a \\\\\nu = 1$$', 'after a row break, "u" stays u');
    assert.equal(r('$\tr(A)$', new Set(['tr'])).text, '$\\tr(A)$', 'the text’s own macro counts as a command');
    assert.equal(r('$\tr(A)$').text, '$\tr(A)$', '… and only when the text has it');
    assert.equal(r('Gdy \\(x>0\\) oraz \\[y = 1\\]').text, 'Gdy $x>0$ oraz $$y = 1$$', '\\( \\) and \\[ \\]');
    assert.equal(r('\\(\theta\\)').text, '$\\theta$', '\\( \\) around a damaged command');
    assert.equal(r('Mamy \\begin{align*} a &= b \\end{align*} dalej').text, 'Mamy $$\\begin{align*} a &= b \\end{align*}$$ dalej', 'a bare environment gets $$');
    assert.equal(r('$\\\\frac{a}{b} + \\\\alpha$').text, '$\\frac{a}{b} + \\alpha$', 'doubled backslashes halved');
    assert.equal(r('$\\begin{matrix} 1 \\\\ 2 \\end{matrix}$').text, '$\\begin{matrix} 1 \\\\ 2 \\end{matrix}$', 'a row break is no doubling');
    const h = r('$\\newcommand{\\abs}[1]{\\left|#1\\right|} \\abs{x}$, $\\DeclareMathOperator*{\\argmax}{arg\\,max} \\argmax f$, $\\def\\eps{\\varepsilon}\\eps$');
    assert.equal(h.text, '$\\abs{x}$, $\\argmax f$, $\\eps$', 'definitions leave the formula');
    assert.deepEqual(h.macros, { '\\abs': '\\left|#1\\right|', '\\argmax': '\\operatorname*{arg\\,max}', '\\eps': '\\varepsilon' }, '… and become macros of the text');
    assert.equal(r('wzór $x = 1 \\tag{3}$ dalej').text, 'wzór $$x = 1 \\tag{3}$$ dalej', '\\tag in a sentence: shown on its own');
    assert.equal(r('$$a {{page 12}} + b$$').text, '$$a   + b$${{page 12}}', 'a page break moves behind the formula');
    assert.equal(r('Zwykły tekst, 5$ za sztukę.').text, 'Zwykły tekst, 5$ za sztukę.', 'text without formulas stays');
    assert.deepEqual(r('$\\frac{a}{b}$ i $$\\sum_k k$$').fixes, {}, 'a clean text: nothing to say');
    const macros = T.readMacros({ '\rank': '\\operatorname{rank}', '\tr': '\\operatorname{tr}', R: '\\mathbb{R}', '2x': 'x', '\\bad': 7 });
    assert.deepEqual(macros.macros, { '\\rank': '\\operatorname{rank}', '\\tr': '\\operatorname{tr}', '\\R': '\\mathbb{R}' }, 'macro names damaged by JSON come back; a name without \\ gets one');
    assert.equal(macros.warnings.length, 2, 'what is no macro is named');
    ok('repair: control characters (also in own macros), \\( \\[, bare environments, doubling, definitions, \\tag, page marks');
  }

  /* -- 3. JSON, wie eine KI es schreibt --------------------------------------------------------- */
  {
    const v = (text) => J.readJsonText(text);
    assert.deepEqual(v('{"t": "$\\alpha$ i $\\frac{1}{2}$ oraz \\(x\\)"}'), { value: { t: '$\\alpha$ i $\\frac{1}{2}$ oraz \\(x\\)' }, repaired: 4 }, 'single backslashes: invalid escapes and \\f in \\frac');
    assert.deepEqual(v('{"t": "$$\\begin{pmatrix} a \\\\ b \\end{pmatrix}$$ i $\\tr A$"}').value, { t: '$$\\begin{pmatrix} a \\\\ b \\end{pmatrix}$$ i $\\tr A$' }, 'not escaped at all: \\\\ stays the row break, \\tr in a formula stays a command');
    assert.deepEqual(v('{"t": "x\\ny"}'), { value: { t: 'x\ny' }, repaired: 0 }, 'valid JSON stays as it is');
    assert.deepEqual(v('Oto JSON:\n```json\n{"a": 1}\n```\nGotowe.').value, { a: 1 }, 'a fence and sentences around');
    assert.deepEqual(v('{"a": "linia\npierwsza\tdruga"}').value, { a: 'linia\npierwsza\tdruga' }, 'raw newlines and tabs in a string');
    assert.equal(v('{"t": "Akapit\\nnauka $\\alpha$"}').value.t, 'Akapit\nnauka $\\alpha$', 'a newline before a Polish word stays a newline');
    assert.ok('error' in v('{"a": '), 'broken JSON stays an error');
    assert.equal(v('   '), null, 'empty: nothing');
    ok('JSON as an AI writes it: single or no escaping, fences, raw line breaks; valid JSON untouched');
  }

  /* -- 4. KaTeX und die Schreibweisen der Lehrbücher -------------------------------------------- */
  const CORPUS = [
    /* Analiza */
    [String.raw`\lim_{x \to 0} \frac{\sin x}{x} = 1`, 0], [String.raw`\int_a^b f(x)\,dx = F(b) - F(a)`, 1], [String.raw`\frac{d}{dx}\left( \int_a^x f(t)\,dt \right) = f(x)`, 1],
    [String.raw`f'(x_0) = \lim_{h\to 0}\frac{f(x_0+h)-f(x_0)}{h}`, 1], [String.raw`\sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n`, 1], [String.raw`\oint_{\partial D} \omega = \iint_D d\omega`, 1],
    [String.raw`\iiint_V \nabla \cdot \mathbf{F}\,dV = \oiint_{\partial V} \mathbf{F}\cdot d\mathbf{S}`, 1], [String.raw`\left| \int_a^b f \right| \leq \int_a^b |f|`, 0], [String.raw`\varlimsup_{n\to\infty} a_n \ge \varliminf_{n\to\infty} a_n`, 0],
    [String.raw`\forall \varepsilon>0\ \exists \delta>0:\ |x-a|<\delta \implies |f(x)-f(a)|<\varepsilon`, 1], [String.raw`\sup_{x\in[0,1]} |f_n(x) - f(x)| \xrightarrow{n\to\infty} 0`, 1],
    [String.raw`\frac{\partial^2 u}{\partial t^2} = c^2 \Delta u`, 1], [String.raw`\nabla f = \left(\frac{\partial f}{\partial x_1}, \dots, \frac{\partial f}{\partial x_n}\right)`, 1],
    [String.raw`\mathcal{L}\{f\}(s) = \int_0^\infty e^{-st} f(t)\,dt`, 1], [String.raw`\hat{f}(\xi) = \int_{-\infty}^{\infty} f(x)\, e^{-2\pi i x \xi}\,dx`, 1], [String.raw`\|f\|_{L^p} = \left( \int_\Omega |f|^p \, d\mu \right)^{1/p}`, 1],
    [String.raw`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}`, 0], [String.raw`\underbrace{1 + 1 + \cdots + 1}_{n \text{ razy}} = n`, 1], [String.raw`\overbrace{a+b}^{\text{suma}}`, 0], [String.raw`\sqrt[3]{x^2 + 1}`, 0],
    [String.raw`\lfloor x \rfloor + \lceil x \rceil`, 0], [String.raw`f\colon X \to Y,\ x \mapsto x^2`, 0], [String.raw`\operatorname*{arg\,max}_{x \in X} f(x)`, 1], [String.raw`\lim\limits_{n \to \infty} \left(1+\frac{1}{n}\right)^n = e`, 0],
    /* Algebra liniowa */
    [String.raw`\begin{pmatrix} a & b \\ c & d \end{pmatrix}^{-1} = \frac{1}{ad-bc}\begin{pmatrix} d & -b \\ -c & a \end{pmatrix}`, 1],
    [String.raw`\det\begin{bmatrix} a_{11} & \cdots & a_{1n} \\ \vdots & \ddots & \vdots \\ a_{n1} & \cdots & a_{nn} \end{bmatrix}`, 1],
    [String.raw`\left[\begin{array}{ccc|c} 1 & 2 & 3 & 4 \\ 0 & 1 & 2 & 3 \\ \hline 0 & 0 & 1 & 2 \end{array}\right]`, 1], [String.raw`\begin{Vmatrix} x \end{Vmatrix} \begin{Bmatrix} 1 \end{Bmatrix}`, 0],
    [String.raw`\left(\begin{smallmatrix} 1 & 0 \\ 0 & 1 \end{smallmatrix}\right)`, 0], [String.raw`A = Q \Lambda Q^{\mathsf T}`, 0], [String.raw`\langle u, v \rangle = \sum_i u_i \overline{v_i}`, 0],
    [String.raw`\operatorname{rank} A + \dim \ker A = n`, 0], [String.raw`\mathbf{x} \in \mathbb{R}^n,\ \vec{v},\ \hat{e}_1,\ \tilde{A},\ \bar{z},\ \dot{x},\ \ddot{x}`, 0], [String.raw`\begin{matrix*}[r] -1 & 2 \\ 3 & -4 \end{matrix*}`, 1],
    /* Algebra, logika, zbiory */
    [String.raw`a \equiv b \pmod{n}`, 0], [String.raw`\gcd(a,b) \cdot \operatorname{lcm}(a,b) = ab`, 0], [String.raw`\mathbb{Z}/n\mathbb{Z},\ G/H,\ \mathfrak{g},\ \mathfrak{S}_n`, 0],
    [String.raw`\varphi\colon G \to H,\ \ker\varphi \trianglelefteq G`, 0], [String.raw`\forall x\, \exists y\, (x < y),\quad \neg(p \land q) \iff \neg p \lor \neg q`, 1],
    [String.raw`A \cup B,\ A \cap B,\ A \setminus B,\ A^c,\ \emptyset,\ \varnothing,\ \mathcal{P}(X),\ |A| = \aleph_0`, 0], [String.raw`\{ x \in \mathbb{R} : x^2 < 2 \}`, 0],
    [String.raw`\prod_{p \text{ pierwsze}} \frac{1}{1-p^{-s}} = \zeta(s)`, 1], [String.raw`p \vdash q,\ \models,\ \top,\ \bot`, 0], [String.raw`\bigcup_{i=1}^{\infty} A_i \supseteq \bigcap_{i \in I} A_i`, 1], [String.raw`a \mid b,\ a \nmid b`, 0],
    /* Prawdopodobieństwo */
    [String.raw`P(A \mid B) = \frac{P(B \mid A)\, P(A)}{P(B)}`, 1], [String.raw`\mathbb{E}[X] = \int x\, dF(x),\quad \operatorname{Var}(X) = \mathbb{E}[X^2] - (\mathbb{E}X)^2`, 1],
    [String.raw`X \sim \mathcal{N}(\mu, \sigma^2),\ f(x) = \frac{1}{\sigma\sqrt{2\pi}} e^{-\frac{(x-\mu)^2}{2\sigma^2}}`, 1], [String.raw`\bar{X}_n \xrightarrow{\;P\;} \mu`, 0], [String.raw`\hat{\theta} = \arg\max_\theta L(\theta)`, 0],
    /* Fizyka */
    [String.raw`\nabla \times \mathbf{E} = -\frac{\partial \mathbf{B}}{\partial t}`, 1], [String.raw`i\hbar \frac{\partial}{\partial t}\Psi = \hat{H}\Psi`, 1], [String.raw`F = G\frac{m_1 m_2}{r^2}`, 0],
    [String.raw`\langle \psi | \hat{A} | \psi \rangle = \bra{\phi}\ket{\psi}`, 0], [String.raw`\Delta x\, \Delta p \geq \frac{\hbar}{2}`, 0],
    [String.raw`R_{\mu\nu} - \frac{1}{2} R g_{\mu\nu} + \Lambda g_{\mu\nu} = \frac{8\pi G}{c^4} T_{\mu\nu}`, 1], [String.raw`g = \pu{9.81 m/s^2},\ N_A = \pu{6.022e23 mol^-1}`, 0],
    /* Chemia */
    [String.raw`\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}`, 1], [String.raw`\ce{A <=> B},\ \ce{^{14}_{6}C},\ \ce{Fe^{3+}},\ \ce{[Cu(NH3)4]^2+}`, 0], [String.raw`\ce{CH3-CH2-OH}`, 0],
    /* Środowiska */
    [String.raw`\begin{align} f(x) &= (x+1)^2 \\ &= x^2 + 2x + 1 \tag{1.1} \end{align}`, 1], [String.raw`\begin{align*} a &= b + c & d &= e \\ f &= g & h &= i \end{align*}`, 1],
    [String.raw`\begin{gather} a = b \\ c = d \end{gather}`, 1], [String.raw`\begin{equation} \begin{split} a &= b \\ &= c \end{split} \tag{2} \end{equation}`, 1],
    [String.raw`\begin{alignat}{2} x &= y & \quad &\text{(z założenia)} \end{alignat}`, 1], [String.raw`\begin{multline} a + b + c \\ + d + e \end{multline}`, 1],
    [String.raw`\begin{eqnarray} a &=& b \\ c &\le& d \end{eqnarray}`, 1], [String.raw`|x| = \begin{cases} x & x \geq 0 \\ -x & x < 0 \end{cases}`, 0],
    [String.raw`\begin{dcases} \frac{1}{x} & x \ne 0 \\ 0 & x = 0 \end{dcases}`, 1], [String.raw`\begin{rcases} a \\ b \end{rcases} \text{ razem}`, 1],
    [String.raw`\begin{CD} A @>f>> B \\ @VgVV @VVhV \\ C @>>k> D \end{CD}`, 1], [String.raw`\begin{aligned} x &= 1 \\ y &= 2 \end{aligned}`, 0], [String.raw`\begin{gathered} a \\ b \end{gathered}`, 0],
    [String.raw`\begin{array}{r|l} n & n^2 \\ \hline 1 & 1 \\ 2 & 4 \end{array}`, 1], [String.raw`\begin{align} a &= b \label{eq:a} \\ c &= d \nonumber \end{align}`, 1], [String.raw`x = 1 \tag{*}`, 1],
    [String.raw`\begin{align} a &= b \intertext{a zatem} c &= d \end{align}`, 1], [String.raw`\begin{equation*} E = mc^2 \tag{A} \end{equation*}`, 1],
    /* Zwyczaje książek */
    [String.raw`\text{z } \eqref{eq:a} \text{ i } \ref{thm:1}`, 0], [String.raw`\DeclareMathOperator{\Hom}{Hom} \Hom(V, W)`, 0], [String.raw`\newcommand{\N}{\mathbb{N}} \N`, 0],
    [String.raw`\renewcommand{\vec}[1]{\mathbf{#1}} \vec{v}`, 0], [String.raw`\def\eps{\varepsilon} \eps`, 0], [String.raw`\qed\quad \square\quad \blacksquare`, 0], [String.raw`\boxed{E = mc^2}`, 1],
    [String.raw`\cancel{x} + \bcancel{y} + \xcancel{z}`, 0], [String.raw`\overset{\text{def}}{=},\ \stackrel{?}{=},\ \underset{n\to\infty}{\longrightarrow}`, 0], [String.raw`\xleftarrow{a},\ \xRightarrow{b},\ \hookrightarrow,\ \twoheadrightarrow`, 0],
    [String.raw`\color{red}{x} + \textcolor{blue}{y}`, 0], [String.raw`\text{gdzie } x \text{ jest liczbą całkowitą}`, 0], [String.raw`\mathrm{e}^{i\pi} + 1 = 0`, 0],
    [String.raw`\left\langle \frac{a}{b} \right\rangle,\ \bigl( x \bigr),\ \Bigg[ y \Bigg]`, 0], [String.raw`a \approx b,\ a \simeq b,\ a \cong b,\ a \sim b,\ a \propto b,\ a \ll b`, 0],
    [String.raw`\infty,\ \partial,\ \nabla,\ \hbar,\ \ell,\ \Re,\ \Im,\ \wp,\ \aleph`, 0], [String.raw`\leqslant,\ \geqslant,\ \lesssim,\ \gtrsim`, 0], [String.raw`\dots,\ \cdots,\ \ldots,\ \vdots,\ \ddots,\ \hdots`, 0],
    [String.raw`\pm,\ \mp,\ \times,\ \div,\ \cdot,\ \circ,\ \oplus,\ \otimes`, 0], [String.raw`\overline{AB},\ \overrightarrow{AB},\ \widehat{ABC},\ \angle ABC,\ \triangle ABC,\ \parallel,\ \perp`, 0],
    [String.raw`\sum_{\substack{1 \le i \le n \\ i \ne j}} a_{ij}`, 1], [String.raw`\tfrac{1}{2} + \dfrac{1}{2} + \cfrac{1}{1+\cfrac{1}{x}}`, 1], [String.raw`\mathbbm{1}_{A}`, 0],
    [String.raw`\mathscr{F},\ \mathcal{F},\ \mathfrak{F},\ \mathbb{F},\ \boldsymbol{\alpha},\ \bm{x}`, 0], [String.raw`\big\langle x \big\rangle_{L^2(\Omega)}`, 0], [String.raw`\llbracket a, b \rrbracket`, 0],
    [String.raw`\iint\limits_{D} f \,dA`, 1], [String.raw`\displaystyle \sum_{k=1}^n k = \frac{n(n+1)}{2}`, 0], [String.raw`x^{2^{n}}_{i_{j}}`, 0], [String.raw`\left. \frac{df}{dx} \right|_{x=0}`, 1]
  ];
  {
    const failed = CORPUS.filter(([tex, d]) => K.checkTex(tex, d === 1, {}) !== null).map(([tex, d]) => `${tex} → ${K.checkTex(tex, d === 1, {})}`);
    assert.deepEqual(failed, [], 'every formula of the corpus is set');
    assert.ok(CORPUS.length >= 100, 'the corpus is large');
    const html = K.renderTex('\\begin{align} a&=b \\\\ c&=d \\end{align}', true, {}).html;
    assert.ok(!/eqn-num/.test(html), 'no automatic numbers (the book’s own come from \\tag)');
    assert.ok(/katex-tag/.test(K.renderTex('a \\tag{2.4}', true, {}).html) && K.renderTex('a \\tag{2.4}', true, {}).html.includes('(2.4)'), 'a \\tag shows the book’s number');
    assert.ok(K.renderTex('x^2', false, {}).html.includes('<annotation encoding="application/x-tex">x^2</annotation>'), 'MathML with the LaTeX for screen readers');
    assert.ok(!/<a[\s>]|href=/.test(K.renderTex('\\href{javascript:alert(1)}{x}', false, {}).html ?? ''), 'no links from a formula (\\href stays text)');
    assert.equal(K.checkTex('\\R', false, { '\\R': '\\mathbb{R}' }), null, 'the text’s macros');
    for (const bad of ['\\frac{a}{', '\\foo', '\\begin{tabular}{cc} a & b \\end{tabular}', 'x^^2', "\\sideset{}{'}\\sum"]) assert.equal(typeof K.checkTex(bad, true, {}), 'string', `a broken formula is named (${bad})`);
    assert.match(K.checkTex('\\frac{a}{', false, {}), /expected '\}' \(znak \d+\)/, 'the message names the place');
    ok(`KaTeX sets ${CORPUS.length} textbook formulas (analysis, linear algebra, logic, probability, physics, chemistry, all environments, \\label/\\eqref/multline/eqnarray/\\DeclareMathOperator/\\intertext/\\qed) and names what is wrong`);
  }

  /* -- 5. Das Lehrbuch -------------------------------------------------------------------------- */
  const raw = await readFile(join(process.cwd(), 'scripts/fixtures/podrecznik-wzory.json'), 'utf8');
  const clean = JSON.parse(raw);
  const work = { id: 'w-alg', kind: 'work', key: 'algebra-analiza', data: { workType: 'book', title: 'Algebra liniowa i analiza' } };
  /* Alle Teile nacheinander, wie der Import sie schreibt: jeder sieht das Verzeichnis davor. */
  const importAll = (doc) => {
    let manifest;
    const parts = [];
    const warnings = [];
    for (const [i, one] of S.portionDocs(doc).entries()) {
      const plan = S.planSourceImport(one, { work, ...(manifest === undefined ? {} : { manifest }), tex: K.checkTex });
      if ('error' in plan) throw new Error(plan.error);
      warnings.push(...plan.warnings);
      manifest = S.readManifest(S.nextManifest(manifest, work.id, plan, `p${i + 1}`));
      parts.push({ plan, data: S.readPart(S.partData('t', work.id, plan)) });
    }
    return { manifest, parts, warnings };
  };
  const book = importAll(clean);
  {
    assert.deepEqual(book.warnings, [], 'the textbook imports without a single warning');
    const [ch3, ch4] = book.parts;
    assert.equal(ch3.plan.summary.texErrors + ch4.plan.summary.texErrors, 0, 'every formula is set');
    assert.ok(ch3.plan.summary.formulas >= 40 && ch4.plan.summary.formulas >= 20, `formulas counted (${ch3.plan.summary.formulas} + ${ch4.plan.summary.formulas})`);
    assert.deepEqual(book.manifest.parts.map((p) => p.labels), [
      ['definition 3.1', 'eq 3.1', 'theorem 3.2', 'eq 3.2', 'example 3.3', 'theorem 3.4', 'eq 3.3', 'eq 3.4', 'lemma 3.5', 'table 3.1', 'figure 3.1', 'exercise 3.6*'],
      ['definition 4.1', 'eq 4.1', 'theorem 4.2', 'eq 4.2', 'example 4.3', 'eq 4.3', 'eq 4.4', 'remark 4.4', 'eq 4.5']
    ], 'the labels of both chapters in the directory (proofs are no target)');
    assert.deepEqual(book.manifest.edition.macros, clean.edition.macros, 'the book’s macros kept');
    const chains = S.boxesOf(ch3.data.blocks);
    const lemma = ch3.data.blocks.findIndex((b) => b.label === 'Lemat 3.5');
    assert.equal(chains[lemma].length, 2, 'a lemma inside a proof: two boxes deep');
    assert.equal(chains[lemma + 1].length, 2, '… its paragraph too');
    const cramer = S.labelBlocks(ch3.data.blocks, 'Twierdzenie 3.4');
    assert.ok(cramer.length === 2 && ch3.data.blocks[cramer[0]].type === 'statement', 'a theorem by its label: head and content');
    assert.deepEqual(S.labelBlocks(ch3.data.blocks, 'wzoru (3.4)'), S.labelBlocks(ch3.data.blocks, '(3.4)'), 'an equation by its number, with or without the word');
    assert.deepEqual(S.labelBlocks(ch3.data.blocks, 'twierdzenia 3.2').length > 0, true, 'a declined reference finds the theorem');
    for (const [label, part] of [['Lemat 3.5', 'rozdz-3'], ['(4.4)', 'rozdz-4'], ['tw. 4.2', 'rozdz-4'], ['Rys. 3.1', 'rozdz-3'], ['Ćwiczenie 3.6*', 'rozdz-3']]) {
      const at = S.placeInManifest(book.manifest, label);
      assert.equal(at.status === 'found' && at.part.key, part, `„${label}" → ${part} (from the directory alone)`);
    }
    assert.equal(S.placeInManifest(book.manifest, 's. 59').part?.key, 'rozdz-3', 'pages still work');
    for (const [i, part] of book.parts.entries()) {
      const again = S.planSourceImport(S.exportSourcePart(work, book.manifest, part.data), { work, manifest: book.manifest, tex: K.checkTex });
      assert.ok(S.samePart(part.data, again), `export → import gives the same part (${part.plan.portion.key})`);
      assert.deepEqual(again.warnings, [], `… without a warning (${i + 1})`);
    }
    const exported = S.exportSourcePart(work, book.manifest, ch3.data);
    assert.ok(exported.blocks.some((b) => b.type === 'statement' && Array.isArray(b.blocks) && b.blocks.some((c) => c.type === 'statement')), 'the export nests statements again (a lemma in a proof)');
    const loaded = book.parts.map((p, i) => ({ part: book.manifest.parts[i], data: p.data }));
    const find = (q) => S.searchParts(loaded, q).map((h) => `${h.part.key}#${h.index}`);
    assert.ok(find('Cramera').length > 0 && find('wyznacznik').length > 0, 'words, also in a statement’s name');
    assert.ok(find('∑').length >= 3 && find('ε').length === 0 && find('π').length > 0, 'symbols of formulas (∑, π)');
    assert.ok(find('\\det(AB)').length > 0 && find('\\begin{CD}').length === 1 && find('vmatrix').length === 1, 'LaTeX of formulas');
    assert.ok(find('\\ce{2H2').length === 1, 'chemistry by its LaTeX');
    const sums = S.texSearchText(ch4.data.blocks.find((b) => (b.text ?? '').includes('\\frac{\\pi^2}{6}')));
    assert.ok(sums.includes('∑') && sums.includes('π²') && sums.includes('∞'), `the search line for the AI service (${sums.slice(0, 40)}…)`);
    ok('the textbook: two chapters without a warning, labels in the directory, nested statements, export → import, places by label, search by word, symbol and LaTeX');
  }

  /* -- 6. Dasselbe Lehrbuch, verdorben ------------------------------------------------------------ */
  {
    const same = (doc, what) => {
      const other = importAll(doc);
      assert.deepEqual(other.parts.map((p) => p.data.blocks), book.parts.map((p) => p.data.blocks), `${what}: the same blocks`);
      assert.deepEqual(other.manifest.edition, book.manifest.edition, `${what}: the same edition and macros`);
      return other;
    };
    /* Nicht entwertet: jeder Backslash, wie er in LaTeX steht (\frac, \\ als Zeilenumbruch, \tr, \rank). */
    const unescaped = raw.replace(/\\\\/g, '\\');
    assert.throws(() => JSON.parse(unescaped), 'the damaged text is no JSON');
    const read = J.readJsonText(unescaped);
    assert.ok('value' in read && read.repaired > 100, `not escaped: read anyway (${read.repaired} places)`);
    same(read.value, 'not escaped');
    /* \( \) und \[ \] statt Dollar. */
    const asParens = (value) => (typeof value === 'string'
      ? T.texPieces(value).map((p) => (p.t === 'text' ? p.v.replace(/\$/g, '\\$') : p.display ? `\\[${p.tex}\\]` : `\\(${p.tex}\\)`)).join('')
      : Array.isArray(value) ? value.map(asParens)
      : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, x]) => [k, k === 'macros' ? x : asParens(x)])) : value);
    const parens = same(asParens(clean), '\\( \\) and \\[ \\]');
    assert.ok(parens.warnings.some((w) => w.includes('zamienione na $')), '… and the import says so');
    /* Zaun und Sätze. */
    same(J.readJsonText(`Oto dokument:\n\`\`\`json\n${raw}\n\`\`\`\nDaj znać, czy coś poprawić.`).value, 'a fenced answer');
    /* Steuerzeichen, wo JSON einen einfachen Backslash als Escape las — auch in den eigenen Makra des Buches. */
    const damage = (value) => (typeof value === 'string'
      ? value.replace(/\\frac/g, '\frac').replace(/\\times/g, '\times').replace(/\\neq/g, '\neq').replace(/\\right/g, '\right').replace(/\\begin/g, '\begin').replace(/\\tr\b/g, '\tr').replace(/\\rank/g, '\rank')
      : Array.isArray(value) ? value.map(damage)
      : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, x]) => [k, damage(x)])) : value);
    const damaged = same(damage(clean), 'control characters');
    assert.ok(damaged.warnings.some((w) => w.includes('znak sterujący')), '… and the import says so');
    ok('the same textbook as an AI spoils it (no escaping, \\( \\), a fence, control characters, also in its own macros): the same blocks');
  }

  /* -- 7. Was der Import sagt ----------------------------------------------------------------------- */
  {
    const plan = (blocks, extra = {}) => S.planSourceImport({ format: 'recreatio/source-text', version: 1, work: '@algebra-analiza', portion: { key: 'x', label: 'X' }, blocks, ...extra }, { work, tex: K.checkTex });
    const said = (blocks, extra) => plan(blocks, extra).warnings.join('\n');
    assert.match(said([{ type: 'paragraph', text: 'Zły $\\frac{a}{$ wzór.' }]), /wzór \$\\frac\{a\}\{\$ — .*expected '\}'/, 'a broken formula: where, which, what KaTeX says');
    assert.equal(plan([{ type: 'paragraph', text: '$\\foo$' }]).summary.texErrors, 1, '… counted');
    assert.match(said([{ type: 'paragraph', text: 'Koszt $ 5 i $x' }]), /Pojedynczy znak \$/, 'a single $');
    assert.match(said([{ type: 'page', page: '57' }, { type: 'paragraph', text: 'a {{page 60}} b' }]), /Brak stron: s\. 58–59/, 'a missing page');
    assert.match(said([{ type: 'paragraph', text: 'Z {{ref twierdzenia 9.9}}.' }]), /bez celu.*twierdzenia 9\.9/, 'a reference without a target');
    assert.match(said([{ type: 'statement', kind: 'theorem', label: 'Tw. 1', text: 'a' }, { type: 'statement', kind: 'lemma', label: 'Twierdzenie 1', text: 'b' }]), /Ta sama etykieta/, 'one label twice');
    assert.match(said([{ type: 'statement', kind: 'satz', label: 'Satz 2', text: 'a' }]), /nieznany rodzaj "satz" — przyjęty „Twierdzenie”/, 'an unknown kind, taken from the label');
    assert.equal(plan([{ type: 'theorem', label: 'Twierdzenie 1', text: 'a' }]).blocks[0].kind, 'theorem', '{"type": "theorem"} is a statement');
    assert.match(said([{ type: 'statement', kind: 'proof' }]), /bez treści/, 'a statement without content');
    const code = plan([{ type: 'code', text: 'echo $HOME {{page 3}}\n  x = a $b$' }]);
    assert.ok(code.warnings.length === 0 && code.summary.formulas === undefined && code.blocks[0].text.includes('$b$'), 'code stays code: no formulas, no single-$ warning, a page break counted');
    const deep = plan([{ type: 'statement', kind: 'proof', blocks: [{ type: 'statement', kind: 'proof', blocks: [{ type: 'statement', kind: 'proof', blocks: [{ type: 'statement', kind: 'proof', blocks: [{ type: 'statement', kind: 'proof', text: 'za głęboko' }] }] }] }] }]);
    assert.match(deep.warnings.join('\n'), /głębiej niż 4/, 'nesting has a floor');
    assert.match(said([{ type: 'paragraph', text: '$\\R$' }], { edition: { macros: { '\\R': 5 } } }), /Makro „\\R”/, 'a broken macro is named');
    ok('the import names: broken formulas (with KaTeX’s words), a single $, missing pages, references without a target, double labels, unknown kinds, empty statements; code stays code');
  }

  /* -- 8. Gezeichnet, und für den Dostęp dla AI ------------------------------------------------------ */
  {
    const [ch3] = book.parts;
    const html = m.renderToStaticMarkup(m.createElement(m.SourceFlow, { blocks: ch3.data.blocks, prefix: 't-' }));
    assert.equal((html.match(/class="src-box /g) ?? []).length, 9, 'every statement is a box (9 in chapter 3, a lemma and its proof inside a proof)');
    assert.equal((html.match(/class="src-qed"/g) ?? []).length, 3, 'three proofs end with ∎');
    assert.ok(html.includes('class="src-box is-claim kind-theorem"') && html.includes('class="src-box is-definition kind-definition"') && html.includes('class="src-box is-proof kind-proof"'), 'boxes by kind');
    assert.ok(html.includes('<strong>Twierdzenie 3.4</strong> <span class="src-stmt-title">(<span>wzory Cramera</span>)</span>.'), 'the head: label, name, period');
    assert.ok(html.includes('<figure class="src-figure">') && html.includes('Rysunek w źródle') && html.includes('<pre class="src-code" data-lang="pseudokod">'), 'a figure, a code listing');
    assert.ok(/data-tex="[^"]*\\tag\{3\.4\}" data-display="1"/.test(html), 'formulas carry their LaTeX (for selection and copying)');
    assert.equal((html.match(/data-block="/g) ?? []).length, ch3.data.blocks.length, 'every block keeps its number');
    assert.ok(html.includes('class="src-ref is-dead"'), 'without a reader, a reference is just words');
    const refs = { where: (label) => (label.includes('3.2') ? 'here' : null), open: () => undefined };
    const live = m.renderToStaticMarkup(m.createElement(m.TextRefsContext.Provider, { value: refs }, m.createElement(m.SourceFlow, { blocks: ch3.data.blocks, prefix: 't-' })));
    assert.ok(/<button type="button" class="src-ref" title="Pokaż w tekście">(<span>)?twierdzenia 3\.2/.test(live) || live.includes('class="src-ref" title="Pokaż w tekście">twierdzenia 3.2'), 'in the reader a reference is a button');
    const part3 = m.renderToStaticMarkup(m.createElement(m.SourceFlow, { blocks: ch3.data.blocks, prefix: 't-', shown: [0, 1, 2, 3, 4, 5] }));
    assert.equal((part3.match(/class="src-qed"/g) ?? []).length, 0, 'a proof cut off before its end: no ∎');

    const entries = [{ id: 'tx', kind: 'sourcetext', data: S.nextManifest(undefined, work.id, book.parts[0].plan, 'p1') }];
    const lookAll = { get: (id) => (id === work.id ? work : undefined), byKey: () => undefined, all: () => [work] };
    const snap = m.snapshotTexts([{ entry: entries[0], parts: [{ id: 'p1', data: S.partData('tx', work.id, book.parts[0].plan) }] }], lookAll)[0];
    const blocks = snap.parts[0].blocks;
    const head = blocks.find((b) => b.labels?.includes('Twierdzenie 3.4'));
    assert.ok(head.type === 'statement' && head.text === 'Twierdzenie 3.4 (wzory Cramera).' && typeof head.end === 'number' && head.within[0] === 'theorem', 'a statement for the AI: its head, its end, its kind');
    assert.ok(blocks.some((b) => b.within?.length === 2 && b.within[1] === 'lemma'), 'nesting for the AI (a lemma in a proof)');
    assert.ok(blocks.some((b) => b.text.includes('$$(AB)_{ik} = \\sum_{j=1}^{n}') && b.labels?.includes('(3.1)')), 'formulas stay LaTeX, equation numbers are labels');
    assert.ok(blocks.some((b) => b.search?.includes('∑')), 'the search line with symbols');
    assert.ok(blocks.some((b) => b.text.startsWith('[Rys. 3.1: Pole') && b.text.includes('opis rysunku:')) && blocks.some((b) => b.text.startsWith('```pseudokod\n')), 'a figure and code, readable');
    ok('drawn: boxes by kind, heads, ∎ only at a proof’s end, figures, code, formulas with their LaTeX, references as buttons in the reader; for the AI: statements, nesting, labels, LaTeX, search line');
  }

  /* -- 9. Der Zapis ---------------------------------------------------------------------------------- */
  {
    const inl = (t) => m.parseInline(t);
    assert.ok(!inl('Koszt 5$ i 10$, US$ 20.').some((i) => i.t === 'math'), 'prices stay text in every note');
    assert.deepEqual(inl('Niech $x^2$ będzie *dodatnie*.').map((i) => i.t), ['text', 'math', 'text', 'i', 'text'], 'a formula in a sentence');
    assert.deepEqual(inl('$a*b*c$').map((i) => i.t), ['math'], 'inside a formula no markup (* stays TeX)');
    const blocks = m.parseMarkup('Wzór\n$$\n\\begin{aligned} a &= b \\\\\n c &= d \\end{aligned}\n$$\nkoniec.');
    assert.ok(blocks.length === 1 && blocks[0].c.some((i) => i.t === 'math' && i.display && i.tex.includes('aligned')), 'a display formula over several lines');
    assert.equal(m.plainText('Kąt $\\alpha + \\beta$ i [@x].'), 'Kąt α + β i.', 'plain text: formulas as symbols');
    assert.ok(!inl('kosztuje 10$, a tamto 20$.').some((i) => i.t === 'math'), 'a price written after the number is no formula');
    const look = { get: () => undefined, byKey: () => undefined, all: () => [], readable: () => [] };
    const text = { id: 'tx1', kind: 'text', data: { title: 'Notatka', body: 'Z $\\det(AB) = \\det A \\det B$ wynika\n\n$$\\sum_{k=1}^n k = \\frac{n(n+1)}{2}$$' } };
    const article = m.renderToStaticMarkup(m.createElement(m.TextArticle, { entry: text, look }));
    assert.ok(article.includes('data-tex="\\det(AB) = \\det A \\det B"') && article.includes('data-display="1"'), 'a Scriptorium text shows its formulas');
    const latex = m.textToLatex(text, look);
    assert.ok(latex.includes('$\\det(AB) = \\det A \\det B$') && latex.includes('\\[\\sum_{k=1}^n k = \\frac{n(n+1)}{2}\\]') && latex.includes('\\usepackage{amsmath,amssymb}'), 'LaTeX export: formulas as they are, amsmath in the preamble');
    const rich = m.renderToStaticMarkup(m.createElement(m.Fragment, null, ...m.richInline('Prędkość $v = \\frac{s}{t}$')));
    assert.ok(rich.includes('data-tex="v = \\frac{s}{t}"'), 'the page module „Tekst" and presentations too');
    ok('the shared markup: $…$ a formula, prices not, no markup inside, display over lines, plain text, Scriptorium article, LaTeX export, page texts');
  }

  console.log('\nWzory: all checks pass.');
} finally {
  globalThis.BroadcastChannel = broadcastChannel;
  await rm(workspace, { recursive: true, force: true });
}
