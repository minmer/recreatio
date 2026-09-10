import { readFileSync, writeFileSync } from 'node:fs';

const edit = (path, steps) => {
  let s = readFileSync(path, 'utf8');
  const crlf = s.includes('\r\n');
  if (crlf) s = s.split('\r\n').join('\n');
  for (const [a, b] of steps) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`${path}: anchor x${n}: ${a.slice(0, 60)}`);
    s = s.replace(a, b);
  }
  writeFileSync(path, crlf ? s.split('\n').join('\r\n') : s);
  console.log('  ok  ' + path);
};

/*
 * DIE EINZIGE TIEFENAENDERUNG.
 *
 * Alles, was nach `backend/legacy/` gezogen ist, ist ZUSAMMEN gezogen — die
 * Verweise untereinander stimmen weiter. Nur Rc.Api zeigt aus dem Umzug
 * hinaus auf den Kernel, der geblieben ist, und braucht deshalb eine Ebene
 * mehr.
 */
edit('backend/legacy/Rc.Api/Rc.Api.csproj', [
  ['"..\\Rc.Kernel\\Rc.Kernel.csproj"', '"..\\..\\Rc.Kernel\\Rc.Kernel.csproj"']
]);

/* Die Projektpfade in der Mappe. Kernel und seine Pruefreihe bleiben. */
const sln = 'recreatio.sln';
let s = readFileSync(sln, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.split('\r\n').join('\n');

for (const p of ['Rc.Api.Tests', 'Rc.Api', 'Rc.OpenApi', 'Rc.Schema', 'Recreatio.Api']) {
  const from = `backend\\${p}\\${p}.csproj`;
  const to = `backend\\legacy\\${p}\\${p}.csproj`;
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`sln: ${p} x${n}`);
  s = s.replace(from, to);
}

writeFileSync(sln, crlf ? s.split('\n').join('\r\n') : s);
console.log('  ok  ' + sln);

/* Die Werkzeuge im Browser-Teil zeigen auf die alten Orte. */
edit('frontend/package.json', [
  ['../backend/rc-openapi.json', '../backend/legacy/rc-openapi.json']
]);

edit('frontend/scripts/rc-sql-params.mjs', [
  ["const ROOT = process.argv[2] ?? '../backend/Rc.Api';",
   "const ROOT = process.argv[2] ?? '../backend/legacy/Rc.Api';"]
]);

edit('frontend/scripts/rc-wrap-vector.mjs', [
  ["asPath('../../backend/rc-wrap-vector.json')",
   "asPath('../../backend/legacy/rc-wrap-vector.json')"]
]);

edit('frontend/scripts/rc-walk.mjs', [
  ['dotnet run --project ../backend/Rc.Host      (in einem anderen Fenster)',
   'dotnet run --project ../backend/legacy/Rc.Host   (in einem anderen Fenster)'],
  ["console.error('  dotnet run --project ../backend/Rc.Host');",
   "console.error('  dotnet run --project ../backend/legacy/Rc.Host');"]
]);

console.log('fertig');
