import{t as p,appLang as O}from"./i18n-BwhOroIt.js";import{e1 as l,ec as S,ko as T,gu as b,ks as K,kp as M,eA as $,gW as R,gL as z,fl as C,gK as L,hW as F,ee as I,gJ as W,hU as _,hT as D,ez as G,hR as J,iL as P,ef as k}from"./mount-Dz7LFJtX.js";import{t as U}from"./TextArticle-BpSNqa2t.js";function r(i){return i.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const A=i=>i.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),B=i=>i.map(e=>{const n=r(e.text),t=e.italic===!0?`\\emph{${n}}`:n;return e.href!==void 0&&/^https?:/i.test(e.href)?`\\href{${A(e.href)}}{${t}}`:t}).join("");function m(i,e,n=!1){return i.map(t=>{switch(t.t){case"text":return r(t.v);case"br":return n?" ":`\\\\
`;case"math":return t.display&&!n?`\\[${t.tex}\\]`:`$${t.tex}$`;case"b":return`\\textbf{${m(t.c,e,n)}}`;case"i":return`\\emph{${m(t.c,e,n)}}`;case"link":return`\\href{${A(t.href)}}{${m(t.c,e,n)}}`;case"cite":{const s=t.items.filter(a=>!L($(e.look,a.key))).map(a=>{const c=$(e.look,a.key);return`\\emph{${r(F(c,e.look))}}${a.locator===""?"":`, ${r(a.locator)}`}`}),o=t.items.filter(a=>L($(e.look,a.key))).map(a=>{const c=$(e.look,a.key),u=z(c,e.look);return u!==void 0&&e.works.push(u),B(I(c,a.locator,e.look,e.state))});return`${s.length===0?"":p("scriptorium.sermon.seeAlso",{list:s.join("; ")})}${o.length===0?"":`\\footnote{${o.join("; ")}.}`}`}case"ref":return m(t.c,e,n);case"note":return e.state.last=null,`\\footnote{${m(t.c,e,!0)}}`;default:return""}}).join("")}const H={article:["\\section*","\\subsection*","\\subsubsection*"]};function g(i,e,n){var s;const t=[];for(const o of i)switch(o.t){case"p":t.push(m(o.c,e));break;case"h":{const a=Math.min(2,(o.level===2?0:1)+n);t.push(`${H.article[a]}{${m(o.c,e,!0)}}`);break}case"quote":t.push(`\\begin{quotation}
${g(o.c,e,n)}
\\end{quotation}`);break;case"details":t.push(`\\paragraph{${m(o.summary,e,!0)}}
${g(o.c,e,n)}`);break;case"list":{const a=o.ordered?"enumerate":"itemize";t.push(`\\begin{${a}}
${o.items.map(c=>`  \\item ${m(c,e)}`).join(`
`)}
\\end{${a}}`);break}case"hr":t.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const a=$(e.look,o.key),c=a===void 0?null:R(a,e.look);if(a!==void 0&&c!==null){if(((s=e.path)==null?void 0:s.has(a.id))===!0)break;t.push(Q(a,c,{...e,path:new Set([...e.path??[],a.id])},n));break}if(a===void 0||a.kind!=="quote"){t.push(`% ${p("scriptorium.latex.missingRef")}`);break}const u=z(a,e.look);u!==void 0&&e.works.push(u);const f=l(a.data,"text").split(/\n\s*\n/).map(h=>r(h).replace(/\n/g,`\\\\
`)).join(`

`),d=l(a.data,"translation"),v=[C(a,e.look),o.locator].filter(h=>h.trim()!=="").join(", ");t.push(["\\begin{quotation}",f,d===""?"":`
\\emph{${r(d)}}`,`
\\hfill--- ${r(v)}`,"\\end{quotation}"].filter(h=>h!=="").join(`
`));break}}return t.join(`

`)}function q(i,e){return i.map(n=>"ref"in n?r(_(n.ref,n.locator??"",e.look)):m(D(n.text),e)).join("")}function Q(i,e,n,t){const s=[];for(const o of W(i.data,e)){if(o.type==="paragraph"){s.push(g(b(o.text),n,t));continue}if(o.type==="table"){const c=Math.max(1,o.columns.length,...o.rows.map(d=>d.length)),u=`p{${(.9/c).toFixed(3)}\\linewidth}`,f=o.columns.some(d=>d!=="")?[`${o.columns.map(d=>`\\textbf{${r(d)}}`).join(" & ")} \\\\`,"\\hline"]:[];s.push([`\\begin{tabular}{|${Array.from({length:c},()=>u).join("|")}|}`,"\\hline",...f,...o.rows.map(d=>`${Array.from({length:c},(v,h)=>q(d[h]??[],n)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const a=o.type==="ordered"?"enumerate":"itemize";s.push(`\\begin{${a}}
${o.items.map(c=>`  \\item ${q(c,n)}`).join(`
`)}
\\end{${a}}`)}return`\\begin{quote}
${s.join(`

`)}
\\end{quote}`}const V={en:"english",de:"ngerman",pl:"polish"},y=i=>[`\\documentclass[11pt,a4paper${i==="book"?",openany":""}]{${i}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}",`\\usepackage[${V[O()]}]{babel}`,"\\usepackage{lmodern}","\\usepackage{amsmath,amssymb}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`);function j(i,e){const n=[K(i,e),l(i,"date"),l(i,"occasion"),l(i,"place")].filter(o=>o.trim()!==""),t=l(i,"readings"),s=U(i,e).map(o=>`\\par\\noindent ${r(o.label)}: ${r(o.value)}`);return[n.length>0?`\\noindent\\textsc{${r(n.join(" · "))}}`:"",t!==""?`\\par\\noindent ${r(p("scriptorium.article.readings"))} ${r(t)}`:"",...s].filter(Boolean).join(`
`)}function E(i,e){const n=[];let t=-1;const s=o=>"  ".repeat(o+1);for(const o of i){for(;t<o.depth;)t+=1,n.push(`${s(t-1)}\\begin{enumerate}${t===0?"":"[label*=.\\arabic*]"}`);for(;t>o.depth;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;const a=b(o.text),c=a.length===1&&a[0].t==="p"?m(a[0].c,e):g(a,e,1);n.push(`${s(t)}\\item ${c}`)}for(;t>=0;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;return n.join(`
`)}function x(i,e,n){const t=i.data,s=T(t),a=(s.length===0?"":`\\section*{${r(p("scriptorium.sermon.plan"))}}
${E(s,e)}

`)+g(b(l(t,"body")),e,n),c=l(t,"further").trim()===""?"":`

\\section*{${r(p("scriptorium.article.further"))}}
${g(b(l(t,"further")),e,n)}`;return`${a}${c}`}function w(i,e){const n=M(i.works,i.look);return n.length===0?"":[e,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...n.map(({segs:t})=>`  \\item ${B(t)}.`),"\\end{itemize}"].join(`
`)}function N(i,e,n={}){const t=i.data,s={look:e,state:k(),works:[]},o=e.get(S(t,"project")[0]??""),a=x(i,s,0);return[y("article"),"",`\\title{${r(l(t,"title")||p("common.untitled"))}${l(t,"subtitle")===""?"":`\\\\\\large ${r(l(t,"subtitle"))}`}}`,`\\author{${r(n.author??"")}}`,`\\date{${r(l(t,"date"))}}`,"","\\begin{document}","\\maketitle",o!==void 0?`\\begin{center}\\emph{${r(l(o.data,"title"))}}\\end{center}`:"",j(t,e),"",a,"",w(s,`\\section*{${r(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((c,u,f)=>!(c===""&&f[u-1]==="")).join(`
`)}function ee(i,e,n={}){const t=i.data,s={look:e,state:k(),works:[]},o=[];for(const a of P(t)){if("heading"in a){o.push(`\\part*{${r(a.heading)}}
\\addcontentsline{toc}{part}{${r(a.heading)}}`);continue}const c=e.get(a.text)??e.byKey(a.text.replace(/^@/,""));if(c===void 0||c.kind!=="text"||n.only!==void 0&&!n.only(c))continue;const u=l(c.data,"title")||p("common.untitled");o.push([`\\chapter*{${r(u)}}`,`\\addcontentsline{toc}{chapter}{${r(u)}}`,l(c.data,"subtitle")===""?"":`\\noindent\\emph{${r(l(c.data,"subtitle"))}}\\par\\medskip`,j(c.data,e),"",x(c,s,0)].filter(f=>f!=="").join(`
`))}return[y("book"),"",`\\title{${r(l(t,"title")||p("scriptorium.archive.project"))}${l(t,"subtitle")===""?"":`\\\\\\large ${r(l(t,"subtitle"))}`}}`,`\\author{${r(n.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(t,"description")===""?"":`\\begin{abstract}
${r(l(t,"description"))}
\\end{abstract}`,"\\tableofcontents","",o.join(`

`),"",w(s,`\\chapter*{${r(p("scriptorium.article.sources"))}}
\\addcontentsline{toc}{chapter}{${r(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((a,c,u)=>!(a===""&&u[c-1]==="")).join(`
`)}function te(i,e){const n=i.data,t={look:e,state:k(),works:[]},s=T(n);return[y("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${r(l(n,"title")||p("common.untitled"))}}\\par\\medskip`,j(n,e),"",E(s,t),"",w(t,`\\vfill\\small\\section*{${r(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((o,a,c)=>!(o===""&&c[a-1]==="")).join(`
`)}function ne(i,e=""){return`${(l(i.data,"title")||i.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${e}.tex`}function ae(i,e){const n=new Set;for(const t of G(i))J(b(t),s=>{s.t==="embed"&&$(e,s.key)===void 0&&n.add(s.key)},s=>{if(s.t==="cite")for(const o of s.items)$(e,o.key)===void 0&&n.add(o.key)});return[...n]}export{ee as a,ne as l,ae as m,te as p,N as t};
