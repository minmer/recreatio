var xe=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports);var $e=xe((He,j)=>{var ke=Object.defineProperty,a=(e,t)=>ke(e,"name",{value:t,configurable:!0}),$=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),Ie=(()=>{for(var e=new Uint8Array(128),t=0;t<64;t++)e[t<26?t+65:t<52?t+71:t<62?t-4:t*4-205]=t;return r=>{for(var n=r.length,o=new Uint8Array((n-(r[n-1]=="=")-(r[n-2]=="="))*3/4|0),i=0,s=0;i<n;){var l=e[r.charCodeAt(i++)],c=e[r.charCodeAt(i++)],u=e[r.charCodeAt(i++)],d=e[r.charCodeAt(i++)];o[s++]=l<<2|c>>4,o[s++]=c<<4|u>>2,o[s++]=u<<6|d}return o}})();function q(e){return!isNaN(parseFloat(e))&&isFinite(e)}a(q,"_isNumber");function g(e){return e.charAt(0).toUpperCase()+e.substring(1)}a(g,"_capitalize");function R(e){return function(){return this[e]}}a(R,"_getter");var v=["isConstructor","isEval","isNative","isToplevel"],S=["columnNumber","lineNumber"],N=["fileName","functionName","source"],Oe=["args"],Le=["evalOrigin"],A=v.concat(S,N,Oe,Le);function m(e){if(e)for(var t=0;t<A.length;t++)e[A[t]]!==void 0&&this["set"+g(A[t])](e[A[t]])}a(m,"StackFrame");m.prototype={getArgs:a(function(){return this.args},"getArgs"),setArgs:a(function(e){if(Object.prototype.toString.call(e)!=="[object Array]")throw new TypeError("Args must be an Array");this.args=e},"setArgs"),getEvalOrigin:a(function(){return this.evalOrigin},"getEvalOrigin"),setEvalOrigin:a(function(e){if(e instanceof m)this.evalOrigin=e;else if(e instanceof Object)this.evalOrigin=new m(e);else throw new TypeError("Eval Origin must be an Object or StackFrame")},"setEvalOrigin"),toString:a(function(){var e=this.getFileName()||"",t=this.getLineNumber()||"",r=this.getColumnNumber()||"",n=this.getFunctionName()||"";return this.getIsEval()?e?"[eval] ("+e+":"+t+":"+r+")":"[eval]:"+t+":"+r:n?n+" ("+e+":"+t+":"+r+")":e+":"+t+":"+r},"toString")};m.fromString=a(function(e){var t=e.indexOf("("),r=e.lastIndexOf(")"),n=e.substring(0,t),o=e.substring(t+1,r).split(","),i=e.substring(r+1);if(i.indexOf("@")===0)var s=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(i,""),l=s[1],c=s[2],u=s[3];return new m({functionName:n,args:o||void 0,fileName:l,lineNumber:c||void 0,columnNumber:u||void 0})},"StackFrame$$fromString");for(h=0;h<v.length;h++)m.prototype["get"+g(v[h])]=R(v[h]),m.prototype["set"+g(v[h])]=function(e){return function(t){this[e]=!!t}}(v[h]);var h;for(w=0;w<S.length;w++)m.prototype["get"+g(S[w])]=R(S[w]),m.prototype["set"+g(S[w])]=function(e){return function(t){if(!q(t))throw new TypeError(e+" must be a Number");this[e]=Number(t)}}(S[w]);var w;for(b=0;b<N.length;b++)m.prototype["get"+g(N[b])]=R(N[b]),m.prototype["set"+g(N[b])]=function(e){return function(t){this[e]=String(t)}}(N[b]);var b,P=m;function H(){var e=/^\s*at .*(\S+:\d+|\(native\))/m,t=/^(eval@)?(\[native code])?$/;return{parse:a(function(r){if(r.stack&&r.stack.match(e))return this.parseV8OrIE(r);if(r.stack)return this.parseFFOrSafari(r);throw new Error("Cannot parse given Error object")},"ErrorStackParser$$parse"),extractLocation:a(function(r){if(r.indexOf(":")===-1)return[r];var n=/(.+?)(?::(\d+))?(?::(\d+))?$/,o=n.exec(r.replace(/[()]/g,""));return[o[1],o[2]||void 0,o[3]||void 0]},"ErrorStackParser$$extractLocation"),parseV8OrIE:a(function(r){var n=r.stack.split(`
`).filter(function(o){return!!o.match(e)},this);return n.map(function(o){o.indexOf("(eval ")>-1&&(o=o.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(,.*$)/g,""));var i=o.replace(/^\s+/,"").replace(/\(eval code/g,"(").replace(/^.*?\s+/,""),s=i.match(/ (\(.+\)$)/);i=s?i.replace(s[0],""):i;var l=this.extractLocation(s?s[1]:i),c=s&&i||void 0,u=["eval","<anonymous>"].indexOf(l[0])>-1?void 0:l[0];return new P({functionName:c,fileName:u,lineNumber:l[1],columnNumber:l[2],source:o})},this)},"ErrorStackParser$$parseV8OrIE"),parseFFOrSafari:a(function(r){var n=r.stack.split(`
`).filter(function(o){return!o.match(t)},this);return n.map(function(o){if(o.indexOf(" > eval")>-1&&(o=o.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),o.indexOf("@")===-1&&o.indexOf(":")===-1)return new P({functionName:o});var i=/((.*".+"[^@]*)?[^@]*)(?:@)/,s=o.match(i),l=s&&s[1]?s[1]:void 0,c=this.extractLocation(o.replace(i,""));return new P({functionName:l,fileName:c[0],lineNumber:c[1],columnNumber:c[2],source:o})},this)},"ErrorStackParser$$parseFFOrSafari")}}a(H,"ErrorStackParser");var Ae=new H,Fe=Ae;function z(){if(typeof API<"u"&&API!==globalThis.API)return API.runtimeEnv;let e=typeof Bun<"u",t=typeof Deno<"u",r=typeof process=="object"&&typeof process.versions=="object"&&typeof process.versions.node=="string"&&!process.browser,n=typeof navigator=="object"&&typeof navigator.userAgent=="string"&&navigator.userAgent.indexOf("Chrome")===-1&&navigator.userAgent.indexOf("Safari")>-1;return V({IN_BUN:e,IN_DENO:t,IN_NODE:r,IN_SAFARI:n,IN_SHELL:typeof read=="function"&&typeof load=="function"})}a(z,"getGlobalRuntimeEnv");var f=z();function V(e){let t=e.IN_NODE&&typeof j<"u"&&j.exports&&typeof $=="function"&&typeof __dirname=="string",r=e.IN_NODE&&!t,n=!e.IN_NODE&&!e.IN_DENO&&!e.IN_BUN,o=n&&typeof window<"u"&&typeof window.document<"u"&&typeof document.createElement=="function"&&"sessionStorage"in window&&typeof globalThis.importScripts!="function",i=n&&typeof globalThis.WorkerGlobalScope<"u"&&typeof globalThis.self<"u"&&globalThis.self instanceof globalThis.WorkerGlobalScope;return{...e,IN_BROWSER:n,IN_BROWSER_MAIN_THREAD:o,IN_BROWSER_WEB_WORKER:i,IN_NODE_COMMONJS:t,IN_NODE_ESM:r}}a(V,"calculateDerivedFlags");var J,D,G,B,U;async function C(){if(!f.IN_NODE||(J=(await import("./__vite-browser-external-9wXp6ZBx.js")).default,B=await import("./__vite-browser-external-9wXp6ZBx.js"),U=await import("./__vite-browser-external-9wXp6ZBx.js"),G=(await import("./__vite-browser-external-9wXp6ZBx.js")).default,D=await import("./__vite-browser-external-9wXp6ZBx.js"),M=D.sep,typeof $<"u"))return;let e=B,t=await import("./__vite-browser-external-9wXp6ZBx.js"),r=await import("./__vite-browser-external-9wXp6ZBx.js"),n=await import("./__vite-browser-external-9wXp6ZBx.js"),o={fs:e,crypto:t,ws:r,child_process:n};globalThis.require=function(i){return o[i]}}a(C,"initNodeModules");function Y(e,t){return D.resolve(t||".",e)}a(Y,"node_resolvePath");function K(e,t){return t===void 0&&(t=location),new URL(e,t).toString()}a(K,"browser_resolvePath");var O;f.IN_NODE?O=Y:f.IN_SHELL?O=a(e=>e,"resolvePath"):O=K;var M;f.IN_NODE||(M="/");function Z(e,t){return e.startsWith("file://")&&(e=e.slice(7)),e.includes("://")?{response:fetch(e)}:{binary:U.readFile(e).then(r=>new Uint8Array(r.buffer,r.byteOffset,r.byteLength))}}a(Z,"node_getBinaryResponse");function X(e,t){if(e.startsWith("file://")&&(e=e.slice(7)),e.includes("://"))throw new Error("Shell cannot fetch urls");return{binary:Promise.resolve(new Uint8Array(readbuffer(e)))}}a(X,"shell_getBinaryResponse");function Q(e,t){let r=new URL(e,location);return{response:fetch(r,t?{integrity:t}:{})}}a(Q,"browser_getBinaryResponse");var L;f.IN_NODE?L=Z:f.IN_SHELL?L=X:L=Q;async function ee(e,t){let{response:r,binary:n}=L(e,t);if(n)return n;let o=await r;if(!o.ok)throw new Error(`Failed to load '${e}': request failed.`);return new Uint8Array(await o.arrayBuffer())}a(ee,"loadBinaryFile");var k;if(f.IN_BROWSER_MAIN_THREAD)k=a(async e=>await import(e),"loadScript");else if(f.IN_BROWSER_WEB_WORKER)k=a(async e=>{try{globalThis.importScripts(e)}catch(t){if(t instanceof TypeError)await import(e);else throw t}},"loadScript");else if(f.IN_NODE)k=te;else if(f.IN_SHELL)k=load;else throw new Error("Cannot determine runtime environment");async function te(e){e.startsWith("file://")&&(e=e.slice(7)),e.includes("://")?G.runInThisContext(await(await fetch(e)).text()):await import(J.pathToFileURL(e).href)}a(te,"nodeLoadScript");async function re(e){if(f.IN_NODE){await C();let t=await U.readFile(e,{encoding:"utf8"});return JSON.parse(t)}else if(f.IN_SHELL){let t=read(e);return JSON.parse(t)}else return await(await fetch(e)).json()}a(re,"loadLockFile");async function ne(){if(f.IN_NODE_COMMONJS)return __dirname;let e;try{throw new Error}catch(n){e=n}let t=Fe.parse(e)[0].fileName;if(f.IN_NODE&&!t.startsWith("file://")&&(t=`file://${t}`),f.IN_NODE_ESM){let n=await import("./__vite-browser-external-9wXp6ZBx.js");return(await import("./__vite-browser-external-9wXp6ZBx.js")).fileURLToPath(n.dirname(t))}let r=t.lastIndexOf(M);if(r===-1)throw new Error("Could not extract indexURL path from pyodide module location. Please pass the indexURL explicitly to loadPyodide.");return t.slice(0,r)}a(ne,"calculateDirname");function ie(e){var t;return e.substring(0,e.lastIndexOf("/")+1)||((t=globalThis.location)==null?void 0:t.toString())||"."}a(ie,"calculateInstallBaseUrl");function oe(e){let t=e.FS,r=e.FS.filesystems.MEMFS,n=e.PATH,o={DIR_MODE:16895,FILE_MODE:33279,mount:a(function(i){if(!i.opts.fileSystemHandle)throw new Error("opts.fileSystemHandle is required");return r.mount.apply(null,arguments)},"mount"),syncfs:a(async(i,s,l)=>{try{let c=o.getLocalSet(i),u=await o.getRemoteSet(i),d=s?u:c,y=s?c:u;await o.reconcile(i,d,y),l(null)}catch(c){l(c)}},"syncfs"),getLocalSet:a(i=>{let s=Object.create(null);function l(d){return d!=="."&&d!==".."}a(l,"isRealDir");function c(d){return y=>n.join2(d,y)}a(c,"toAbsolute");let u=t.readdir(i.mountpoint).filter(l).map(c(i.mountpoint));for(;u.length;){let d=u.pop(),y=t.stat(d);t.isDir(y.mode)&&u.push.apply(u,t.readdir(d).filter(l).map(c(d))),s[d]={timestamp:y.mtime,mode:y.mode}}return{type:"local",entries:s}},"getLocalSet"),getRemoteSet:a(async i=>{let s=Object.create(null),l=await Re(i.opts.fileSystemHandle);for(let[c,u]of l)c!=="."&&(s[n.join2(i.mountpoint,c)]={timestamp:u.kind==="file"?new Date((await u.getFile()).lastModified):new Date,mode:u.kind==="file"?o.FILE_MODE:o.DIR_MODE});return{type:"remote",entries:s,handles:l}},"getRemoteSet"),loadLocalEntry:a(i=>{let s=t.lookupPath(i,{}).node,l=t.stat(i);if(t.isDir(l.mode))return{timestamp:l.mtime,mode:l.mode};if(t.isFile(l.mode))return s.contents=r.getFileDataAsTypedArray(s),{timestamp:l.mtime,mode:l.mode,contents:s.contents};throw new Error("node type not supported")},"loadLocalEntry"),storeLocalEntry:a((i,s)=>{if(t.isDir(s.mode))t.mkdirTree(i,s.mode);else if(t.isFile(s.mode))t.writeFile(i,s.contents,{canOwn:!0});else throw new Error("node type not supported");t.chmod(i,s.mode),t.utime(i,s.timestamp,s.timestamp)},"storeLocalEntry"),removeLocalEntry:a(i=>{var s=t.stat(i);t.isDir(s.mode)?t.rmdir(i):t.isFile(s.mode)&&t.unlink(i)},"removeLocalEntry"),loadRemoteEntry:a(async i=>{if(i.kind==="file"){let s=await i.getFile();return{contents:new Uint8Array(await s.arrayBuffer()),mode:o.FILE_MODE,timestamp:new Date(s.lastModified)}}else{if(i.kind==="directory")return{mode:o.DIR_MODE,timestamp:new Date};throw new Error("unknown kind: "+i.kind)}},"loadRemoteEntry"),storeRemoteEntry:a(async(i,s,l)=>{let c=i.get(n.dirname(s)),u=t.isFile(l.mode)?await c.getFileHandle(n.basename(s),{create:!0}):await c.getDirectoryHandle(n.basename(s),{create:!0});if(u.kind==="file"){let d=await u.createWritable();await d.write(l.contents),await d.close()}i.set(s,u)},"storeRemoteEntry"),removeRemoteEntry:a(async(i,s)=>{await i.get(n.dirname(s)).removeEntry(n.basename(s)),i.delete(s)},"removeRemoteEntry"),reconcile:a(async(i,s,l)=>{let c=0,u=[];Object.keys(s.entries).forEach(function(p){let _=s.entries[p],E=l.entries[p];(!E||t.isFile(_.mode)&&_.timestamp.getTime()>E.timestamp.getTime())&&(u.push(p),c++)}),u.sort();let d=[];if(Object.keys(l.entries).forEach(function(p){s.entries[p]||(d.push(p),c++)}),d.sort().reverse(),!c)return;let y=s.type==="remote"?s.handles:l.handles;for(let p of u){let _=n.normalize(p.replace(i.mountpoint,"/")).substring(1);if(l.type==="local"){let E=y.get(_),Ne=await o.loadRemoteEntry(E);o.storeLocalEntry(p,Ne)}else{let E=o.loadLocalEntry(p);await o.storeRemoteEntry(y,_,E)}}for(let p of d)if(l.type==="local")o.removeLocalEntry(p);else{let _=n.normalize(p.replace(i.mountpoint,"/")).substring(1);await o.removeRemoteEntry(y,_)}},"reconcile")};e.FS.filesystems.NATIVEFS_ASYNC=o}a(oe,"initializeNativeFS");var Re=a(async e=>{let t=[];async function r(o){for await(let i of o.values())t.push(i),i.kind==="directory"&&await r(i)}a(r,"collect"),await r(e);let n=new Map;n.set(".",e);for(let o of t){let i=(await e.resolve(o)).join("/");n.set(i,o)}return n},"getFsHandles"),Pe=Ie("AGFzbQEAAAABDANfAGAAAW9gAW8BfwMDAgECByECD2NyZWF0ZV9zZW50aW5lbAAAC2lzX3NlbnRpbmVsAAEKEwIHAPsBAPsbCwkAIAD7GvsUAAs="),De=async function(){if(!(globalThis.navigator&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==="MacIntel"&&typeof navigator.maxTouchPoints<"u"&&navigator.maxTouchPoints>1)))try{let e=await WebAssembly.compile(Pe);return await WebAssembly.instantiate(e)}catch(e){if(e instanceof WebAssembly.CompileError)return;throw e}}();async function ae(){let e=await De;if(e)return e.exports;let t=Symbol("error marker");return{create_sentinel:a(()=>t,"create_sentinel"),is_sentinel:a(r=>r===t,"is_sentinel")}}a(ae,"getSentinelImport");function se(e){let t={config:e,runtimeEnv:f},r={noImageDecoding:!0,noAudioDecoding:!0,noWasmDecoding:!1,preRun:pe(e),print:e.stdout,printErr:e.stderr,onExit(n){r.exitCode=n},thisProgram:e._sysExecutable,arguments:e.args,API:t,locateFile:a(n=>e.indexURL+n,"locateFile"),instantiateWasm:me(e.indexURL)};return r}a(se,"createSettings");function le(e){return function(t){let r="/";try{t.FS.mkdirTree(e)}catch(n){console.error(`Error occurred while making a home directory '${e}':`),console.error(n),console.error(`Using '${r}' for a home directory instead`),e=r}t.FS.chdir(e)}}a(le,"createHomeDirectory");function ce(e){return function(t){Object.assign(t.ENV,e)}}a(ce,"setEnvironment");function ue(e){return e?[async t=>{t.addRunDependency("fsInitHook");try{await e(t.FS,{sitePackages:t.API.sitePackages})}finally{t.removeRunDependency("fsInitHook")}}]:[]}a(ue,"callFsInitHook");function de(e){let t=e.HEAPU32[e._Py_Version>>>2],r=t>>>24&255,n=t>>>16&255,o=t>>>8&255;return[r,n,o]}a(de,"computeVersionTuple");function fe(e){let t=ee(e);return async r=>{r.API.pyVersionTuple=de(r);let[n,o]=r.API.pyVersionTuple;r.FS.mkdirTree("/lib"),r.API.sitePackages=`/lib/python${n}.${o}/site-packages`,r.FS.mkdirTree(r.API.sitePackages),r.addRunDependency("install-stdlib");try{let i=await t;r.FS.writeFile(`/lib/python${n}${o}.zip`,i)}catch(i){console.error("Error occurred while installing the standard library:"),console.error(i)}finally{r.removeRunDependency("install-stdlib")}}}a(fe,"installStdlib");function pe(e){let t;return e.stdLibURL!=null?t=e.stdLibURL:t=e.indexURL+"python_stdlib.zip",[fe(t),le(e.env.HOME),ce(e.env),oe,...ue(e.fsInit)]}a(pe,"getFileSystemInitializationFuncs");function me(e){if(typeof WasmOffsetConverter<"u")return;let{binary:t,response:r}=L(e+"pyodide.asm.wasm"),n=ae();return function(o,i){return async function(){o.sentinel=await n;try{let s;r?s=await WebAssembly.instantiateStreaming(r,o):s=await WebAssembly.instantiate(await t,o);let{instance:l,module:c}=s;i(l,c)}catch(s){console.warn("wasm instantiation failed!"),console.warn(s)}}(),{}}}a(me,"getInstantiateWasmFunc");var Te="0.29.3";function I(e){return e===void 0||e.endsWith("/")?e:e+"/"}a(I,"withTrailingSlash");var T=Te;async function ye(e={}){var o,i;if(await C(),e.lockFileContents&&e.lockFileURL)throw new Error("Can't pass both lockFileContents and lockFileURL");let t=e.indexURL||await ne();if(t=I(O(t)),e.packageBaseUrl=I(e.packageBaseUrl),e.cdnUrl=I(e.packageBaseUrl??`https://cdn.jsdelivr.net/pyodide/v${T}/full/`),!e.lockFileContents){let s=e.lockFileURL??t+"pyodide-lock.json";e.lockFileContents=re(s),e.packageBaseUrl??(e.packageBaseUrl=ie(s))}e.indexURL=t,e.packageCacheDir&&(e.packageCacheDir=I(O(e.packageCacheDir)));let r={fullStdLib:!1,jsglobals:globalThis,stdin:globalThis.prompt?()=>globalThis.prompt():void 0,args:[],env:{},packages:[],packageCacheDir:e.packageBaseUrl,enableRunUntilComplete:!0,checkAPIVersion:!0,BUILD_ID:"b7b7b0f46eb68e65c029c0dc739270e8a5d35251e9aab6014ee1c2f630e5d1d0"},n=Object.assign(r,e);return(o=n.env).HOME??(o.HOME="/home/pyodide"),(i=n.env).PYTHONINSPECT??(i.PYTHONINSPECT="1"),n}a(ye,"initializeConfiguration");function ge(e){let t=se(e),r=t.API;return r.lockFilePromise=Promise.resolve(e.lockFileContents),t}a(ge,"createEmscriptenSettings");async function _e(e){if(typeof _createPyodideModule!="function"){let t=`${e.indexURL}pyodide.asm.js`;await k(t)}}a(_e,"loadWasmScript");async function he(e,t){if(!e._loadSnapshot)return;let r=await e._loadSnapshot,n=ArrayBuffer.isView(r)?r:new Uint8Array(r);return t.noInitialRun=!0,t.INITIAL_MEMORY=n.length,n}a(he,"prepareSnapshot");async function we(e){let t=await _createPyodideModule(e);if(e.exitCode!==void 0)throw new t.ExitStatus(e.exitCode);return t}a(we,"createPyodideModule");function be(e,t){let r=e.API;if(t.pyproxyToStringRepr&&r.setPyProxyToStringMethod(!0),t.convertNullToNone&&r.setCompatNullToNone(!0),t.toJsLiteralMap&&r.setCompatToJsLiteralMap(!0),r.version!==T&&t.checkAPIVersion)throw new Error(`Pyodide version does not match: '${T}' <==> '${r.version}'. If you updated the Pyodide version, make sure you also updated the 'indexURL' parameter passed to loadPyodide.`);e.locateFile=n=>{throw n.endsWith(".so")?new Error(`Failed to find dynamic library "${n}"`):new Error(`Unexpected call to locateFile("${n}")`)}}a(be,"configureAPI");function Ee(e,t,r){let n=e.API,o;return t&&(o=n.restoreSnapshot(t)),n.finalizeBootstrap(o,r._snapshotDeserializer)}a(Ee,"bootstrapPyodide");async function ve(e,t){let r=e._api;return r.sys.path.insert(0,""),r._pyodide.set_excepthook(),await r.packageIndexReady,r.initializeStreams(t.stdin,t.stdout,t.stderr),e}a(ve,"finalizeSetup");async function Se(e={}){let t=await ye(e),r=ge(t);await _e(t);let n=await he(t,r),o=await we(r);be(o,t);let i=Ee(o,n,t);return await ve(i,t)}a(Se,"loadPyodide");const je=String.raw`
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
        return _out(status="invalid", error="cogitaLearnLogic.python.needTransform")
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
        return _out(status="invalid", error="cogitaLearnLogic.python.noTransform")
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
        return _out(ok=False, error="cogitaLearnLogic.python.notLoaded")
    return _call(json.loads(input_json), json.loads(expected_json), True)

def _make(seed):
    if _SESSION is None:
        return _out(ok=False, error="cogitaLearnLogic.python.notLoaded")
    question = _SESSION["question"]
    _SESSION["case"] = None
    if not callable(question.get("create_input")) or not callable(question.get("reference")):
        return _out(ok=False, error="cogitaLearnLogic.python.noCreate")
    try:
        x = question["create_input"](seed)
        want = question["reference"](copy.deepcopy(x))
    except BaseException as ex:
        return _out(ok=False, error=_err(ex, "<pytanie>"))
    _SESSION["case"] = (x, want)
    return _out(ok=True, input=_js(x), expected=_js(want))

def _hidden():
    if _SESSION is None or _SESSION.get("case") is None:
        return _out(ok=False, error="cogitaLearnLogic.python.noCase")
    x, want = _SESSION["case"]
    _SESSION["case"] = None
    return _call(x, want, False)
`,Ue=String.raw`
import json

def _run_template(code, args_json):
    scope = {}
    exec(code, scope, scope)
    run = scope.get("run")
    if not callable(run):
        raise ValueError("cogitaLearnLogic.python.needRun")
    result = run(*json.loads(args_json))
    return json.dumps(result, ensure_ascii=False, default=str)
`,Ce="0.29.3",Me=`https://cdn.jsdelivr.net/pyodide/v${Ce}/full/`;let W=null;const Be=()=>W??(W=Se({indexURL:Me}).catch(e=>{throw W=null,e}));let F=null;async function We(e){if(F!==null)return F;await e.runPythonAsync(je),await e.runPythonAsync(Ue);const t=r=>e.globals.get(r);return F={load:t("_load"),example:t("_example"),make:t("_make"),hidden:t("_hidden"),run:t("_run_template")},F}const x=e=>JSON.parse(String(e));self.addEventListener("message",e=>{const t=e.data;typeof t!="object"||t===null||(async()=>{try{const r=await We(await Be());let n;switch(t.type){case"ready":n={ready:!0};break;case"load":n=x(r.load(t.createInput??"",t.reference??"",t.learner??""));break;case"example":n=x(r.example(t.input??"null",t.expected??"null"));break;case"make":n=x(r.make(Math.trunc(Number(t.seed)||0)>>>0));break;case"hidden":n=x(r.hidden());break;case"run":n=x(r.run(t.code??"",JSON.stringify(t.args??[])));break;default:throw new Error("cogitaLearnLogic.python.unknownCommand")}self.postMessage({id:t.id,ok:!0,result:n})}catch(r){self.postMessage({id:t.id,ok:!1,error:r instanceof Error?r.message:"cogitaLearnLogic.python.failed"})}})()})});export default $e();
