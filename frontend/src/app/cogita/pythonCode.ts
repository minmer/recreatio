/**
 * 2026-11-01 — DER PYTHON-CODE DES ARBEITERS (`python.worker.ts`), in einer eigenen Datei: so lässt er sich ohne
 * Browser prüfen (Pyodide läuft auch in Node — `scripts/app-lemma-code-check.mjs`).
 *
 * <code>
 *   _load(create, reference, learner)   den Code des Lernenden wirklich ausführen (eigener Bereich, Ausgabe gefangen),
 *                                       daneben den der Frage (create_input/reference) — ein Fehler dort ist der der Frage
 *   _example(input, expected)           ein sichtbares Beispiel: transform(input) gegen expected (beides JSON)
 *   _make(seed) · _hidden()             ein verdeckter Fall: erst die Daten (create_input, reference), dann transform —
 *                                       zwei Schritte, damit ein Fall, der hängt, trotzdem seine Eingabe zeigt
 *   _run_template(code, args)           der Baustein „Python" einer Kartenvorlage: run(*wejścia)
 * </code>
 *
 * Jeder Fall antwortet mit JSON: ok, input, expected, got (als JSON-Text, gekürzt), error (mit Zeile im Code des
 * Lernenden), printed (was `print` schrieb). Die Zeit misst der Hauptfaden: hängt ein Fall, wird der Arbeiter beendet.
 */

/* Rohtext: die Backslashes gehören Python (`\s` in einem regulären Ausdruck). */
export const PY_HELPERS = String.raw`
import contextlib, copy, io, json, math, re, traceback

_SESSION = None
_TOL = 1e-9

def _eq(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a == b
    if isinstance(a, int) and isinstance(b, int):
        return a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        fa, fb = float(a), float(b)
        if math.isnan(fa) and math.isnan(fb):
            return True
        return math.isclose(fa, fb, rel_tol=_TOL, abs_tol=_TOL)
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(_eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(_eq(a[k], b[k]) for k in a)
    return a == b

def _js(v, limit=400):
    try:
        text = json.dumps(v, ensure_ascii=False)
    except Exception:
        text = repr(v)
    return text if len(text) <= limit else text[: limit - 1] + "…"

def _norm(v):
    try:
        return json.loads(json.dumps(v))
    except Exception:
        return v

def _clip(text, limit=2000):
    return text if len(text) <= limit else text[: limit - 1] + "…"

def _err(ex, name="<kod>"):
    if isinstance(ex, SyntaxError):
        line = ex.lineno
        msg = ex.msg or ""
    else:
        line = None
        for frame in traceback.extract_tb(ex.__traceback__):
            if frame.filename == name:
                line = frame.lineno
        msg = str(ex)
    text = ex.__class__.__name__ + (": " + msg if msg else "")
    return text if line is None else text + " (linia " + str(line) + ")"

def _out(**fields):
    return json.dumps(fields, ensure_ascii=False)

def _load(create_src, reference_src, learner_src):
    global _SESSION
    _SESSION = None
    if not re.search(r"^\s*def\s+transform\s*\(", learner_src, flags=re.MULTILINE):
        return _out(status="invalid", error="Trzeba zdefiniować funkcję: def transform(x):")
    scope = {"__name__": "__kod__"}
    printed = io.StringIO()
    try:
        compiled = compile(learner_src, "<kod>", "exec")
        with contextlib.redirect_stdout(printed):
            exec(compiled, scope)
    except BaseException as ex:
        return _out(status="invalid", error=_err(ex))
    transform = scope.get("transform")
    if not callable(transform):
        return _out(status="invalid", error="Brakuje funkcji transform(x).")
    question = {"__name__": "__pytanie__"}
    broken = None
    if create_src.strip() != "" and reference_src.strip() != "":
        try:
            exec(compile(create_src, "<pytanie>", "exec"), question)
            exec(compile(reference_src, "<pytanie>", "exec"), question)
            if not callable(question.get("create_input")) or not callable(question.get("reference")):
                broken = "Brakuje create_input(seed) albo reference(x)."
        except BaseException as ex:
            broken = _err(ex, "<pytanie>")
    _SESSION = {"transform": transform, "question": question, "case": None}
    return _out(status="ready", questionError=broken)

def _call(x, want, from_json):
    printed = io.StringIO()
    got = None
    error = None
    try:
        with contextlib.redirect_stdout(printed):
            got = _SESSION["transform"](copy.deepcopy(x))
    except BaseException as ex:
        error = _err(ex)
    out = _clip(printed.getvalue())
    ok = error is None and _eq(want, _norm(got) if from_json else got)
    return _out(ok=bool(ok), input=_js(x), expected=_js(want), got=None if error is not None else _js(got), error=error, printed=out if out != "" else None)

def _example(input_json, expected_json):
    if _SESSION is None:
        return _out(ok=False, error="Kod nie jest wczytany.")
    return _call(json.loads(input_json), json.loads(expected_json), True)

def _make(seed):
    if _SESSION is None:
        return _out(ok=False, error="Kod nie jest wczytany.")
    question = _SESSION["question"]
    _SESSION["case"] = None
    if not callable(question.get("create_input")) or not callable(question.get("reference")):
        return _out(ok=False, error="Brakuje create_input(seed) albo reference(x).")
    try:
        x = question["create_input"](seed)
        want = question["reference"](copy.deepcopy(x))
    except BaseException as ex:
        return _out(ok=False, error=_err(ex, "<pytanie>"))
    _SESSION["case"] = (x, want)
    return _out(ok=True, input=_js(x), expected=_js(want))

def _hidden():
    if _SESSION is None or _SESSION.get("case") is None:
        return _out(ok=False, error="Nie ma przygotowanego przypadku.")
    x, want = _SESSION["case"]
    _SESSION["case"] = None
    return _call(x, want, False)
`;

export const PY_RUN = String.raw`
import json

def _run_template(code, args_json):
    scope = {}
    exec(code, scope, scope)
    run = scope.get("run")
    if not callable(run):
        raise ValueError("Kod musi zdefiniować funkcję run(*wejścia).")
    result = run(*json.loads(args_json))
    return json.dumps(result, ensure_ascii=False, default=str)
`;
