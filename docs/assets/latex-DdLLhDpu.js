import{t as p,appLang as z}from"./i18n-CnmI5RN2.js";import{e2 as l,ed as O,km as B,gv as b,kq as M,kn as K,eB as $,gW as R,gM as T,fm as C,gL as L,hU as F,ef as I,gK as P,hS as _,hR as D,eA as G,hP as J,iJ as U,eg as k}from"./mount-DiyJDS7w.js";import{t as W}from"./TextArticle-Yt6rt-72.js";function s(o){return o.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const A=o=>o.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),E=o=>o.map(e=>{const n=s(e.text),t=e.italic===!0?`\\emph{${n}}`:n;return e.href!==void 0&&/^https?:/i.test(e.href)?`\\href{${A(e.href)}}{${t}}`:t}).join("");function m(o,e,n=!1){return o.map(t=>{switch(t.t){case"text":return s(t.v);case"br":return n?" ":`\\\\
`;case"math":return t.display&&!n?`\\[${t.tex}\\]`:`$${t.tex}$`;case"b":return`\\textbf{${m(t.c,e,n)}}`;case"i":return`\\emph{${m(t.c,e,n)}}`;case"link":return`\\href{${A(t.href)}}{${m(t.c,e,n)}}`;case"cite":{const r=t.items.filter(a=>!L($(e.look,a.key))).map(a=>{const c=$(e.look,a.key);return`\\emph{${s(F(c,e.look))}}${a.locator===""?"":`, ${s(a.locator)}`}`}),i=t.items.filter(a=>L($(e.look,a.key))).map(a=>{const c=$(e.look,a.key),u=T(c,e.look);return u!==void 0&&e.works.push(u),E(I(c,a.locator,e.look,e.state))});return`${r.length===0?"":p("scriptorium.sermon.seeAlso",{list:r.join("; ")})}${i.length===0?"":`\\footnote{${i.join("; ")}.}`}`}case"ref":return m(t.c,e,n);case"note":return e.state.last=null,`\\footnote{${m(t.c,e,!0)}}`;default:return""}}).join("")}const H={article:["\\section*","\\subsection*","\\subsubsection*"]};function g(o,e,n){var r;const t=[];for(const i of o)switch(i.t){case"p":t.push(m(i.c,e));break;case"h":{const a=Math.min(2,(i.level===2?0:1)+n);t.push(`${H.article[a]}{${m(i.c,e,!0)}}`);break}case"quote":t.push(`\\begin{quotation}
${g(i.c,e,n)}
\\end{quotation}`);break;case"details":t.push(`\\paragraph{${m(i.summary,e,!0)}}
${g(i.c,e,n)}`);break;case"list":{const a=i.ordered?"enumerate":"itemize";t.push(`\\begin{${a}}
${i.items.map(c=>`  \\item ${m(c,e)}`).join(`
`)}
\\end{${a}}`);break}case"hr":t.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const a=$(e.look,i.key),c=a===void 0?null:R(a,e.look);if(a!==void 0&&c!==null){if(((r=e.path)==null?void 0:r.has(a.id))===!0)break;t.push(Q(a,c,{...e,path:new Set([...e.path??[],a.id])},n));break}if(a===void 0||a.kind!=="quote"){t.push(`% ${p("scriptorium.latex.missingRef")}`);break}const u=T(a,e.look);u!==void 0&&e.works.push(u);const f=l(a.data,"text").split(/\n\s*\n/).map(h=>s(h).replace(/\n/g,`\\\\
`)).join(`

`),d=l(a.data,"translation"),v=[C(a,e.look),i.locator].filter(h=>h.trim()!=="").join(", ");t.push(["\\begin{quotation}",f,d===""?"":`
\\emph{${s(d)}}`,`
\\hfill--- ${s(v)}`,"\\end{quotation}"].filter(h=>h!=="").join(`
`));break}}return t.join(`

`)}function q(o,e){return o.map(n=>"ref"in n?s(_(n.ref,n.locator??"",e.look)):m(D(n.text),e)).join("")}function Q(o,e,n,t){const r=[];for(const i of P(o.data,e)){if(i.type==="paragraph"){r.push(g(b(i.text),n,t));continue}if(i.type==="table"){const c=Math.max(1,i.columns.length,...i.rows.map(d=>d.length)),u=`p{${(.9/c).toFixed(3)}\\linewidth}`,f=i.columns.some(d=>d!=="")?[`${i.columns.map(d=>`\\textbf{${s(d)}}`).join(" & ")} \\\\`,"\\hline"]:[];r.push([`\\begin{tabular}{|${Array.from({length:c},()=>u).join("|")}|}`,"\\hline",...f,...i.rows.map(d=>`${Array.from({length:c},(v,h)=>q(d[h]??[],n)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const a=i.type==="ordered"?"enumerate":"itemize";r.push(`\\begin{${a}}
${i.items.map(c=>`  \\item ${q(c,n)}`).join(`
`)}
\\end{${a}}`)}return`\\begin{quote}
${r.join(`

`)}
\\end{quote}`}const V={en:"english",de:"ngerman",pl:"polish"},y=o=>[`\\documentclass[11pt,a4paper${o==="book"?",openany":""}]{${o}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}",`\\usepackage[${V[z()]}]{babel}`,"\\usepackage{lmodern}","\\usepackage{amsmath,amssymb}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`);function j(o,e){const n=[M(o,e),l(o,"date"),l(o,"occasion"),l(o,"place")].filter(i=>i.trim()!==""),t=l(o,"readings"),r=W(o,e).map(i=>`\\par\\noindent ${s(i.label)}: ${s(i.value)}`);return[n.length>0?`\\noindent\\textsc{${s(n.join(" · "))}}`:"",t!==""?`\\par\\noindent ${s(p("scriptorium.article.readings"))} ${s(t)}`:"",...r].filter(Boolean).join(`
`)}function S(o,e){const n=[];let t=-1;const r=i=>"  ".repeat(i+1);for(const i of o){for(;t<i.depth;)t+=1,n.push(`${r(t-1)}\\begin{enumerate}${t===0?"":"[label*=.\\arabic*]"}`);for(;t>i.depth;)n.push(`${r(t-1)}\\end{enumerate}`),t-=1;const a=b(i.text),c=a.length===1&&a[0].t==="p"?m(a[0].c,e):g(a,e,1);n.push(`${r(t)}\\item ${c}`)}for(;t>=0;)n.push(`${r(t-1)}\\end{enumerate}`),t-=1;return n.join(`
`)}function x(o,e,n){const t=o.data,r=B(t),a=(r.length===0?"":`\\section*{${s(p("scriptorium.sermon.plan"))}}
${S(r,e)}

`)+g(b(l(t,"body")),e,n),c=l(t,"further").trim()===""?"":`

\\section*{${s(p("scriptorium.article.further"))}}
${g(b(l(t,"further")),e,n)}`;return`${a}${c}`}function w(o,e){const n=K(o.works,o.look);return n.length===0?"":[e,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...n.map(({segs:t})=>`  \\item ${E(t)}.`),"\\end{itemize}"].join(`
`)}function N(o,e,n={}){const t=o.data,r={look:e,state:k(),works:[]},i=e.get(O(t,"project")[0]??""),a=x(o,r,0);return[y("article"),"",`\\title{${s(l(t,"title")||p("common.untitled"))}${l(t,"subtitle")===""?"":`\\\\\\large ${s(l(t,"subtitle"))}`}}`,`\\author{${s(n.author??"")}}`,`\\date{${s(l(t,"date"))}}`,"","\\begin{document}","\\maketitle",i!==void 0?`\\begin{center}\\emph{${s(l(i.data,"title"))}}\\end{center}`:"",j(t,e),"",a,"",w(r,`\\section*{${s(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((c,u,f)=>!(c===""&&f[u-1]==="")).join(`
`)}function ee(o,e,n={}){const t=o.data,r={look:e,state:k(),works:[]},i=[];for(const a of U(t)){if("heading"in a){i.push(`\\part*{${s(a.heading)}}
\\addcontentsline{toc}{part}{${s(a.heading)}}`);continue}const c=e.get(a.text)??e.byKey(a.text.replace(/^@/,""));if(c===void 0||c.kind!=="text"||n.only!==void 0&&!n.only(c))continue;const u=l(c.data,"title")||p("common.untitled");i.push([`\\chapter*{${s(u)}}`,`\\addcontentsline{toc}{chapter}{${s(u)}}`,l(c.data,"subtitle")===""?"":`\\noindent\\emph{${s(l(c.data,"subtitle"))}}\\par\\medskip`,j(c.data,e),"",x(c,r,0)].filter(f=>f!=="").join(`
`))}return[y("book"),"",`\\title{${s(l(t,"title")||p("scriptorium.archive.project"))}${l(t,"subtitle")===""?"":`\\\\\\large ${s(l(t,"subtitle"))}`}}`,`\\author{${s(n.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(t,"description")===""?"":`\\begin{abstract}
${s(l(t,"description"))}
\\end{abstract}`,"\\tableofcontents","",i.join(`

`),"",w(r,`\\chapter*{${s(p("scriptorium.article.sources"))}}
\\addcontentsline{toc}{chapter}{${s(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((a,c,u)=>!(a===""&&u[c-1]==="")).join(`
`)}function te(o,e){const n=o.data,t={look:e,state:k(),works:[]},r=B(n);return[y("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${s(l(n,"title")||p("common.untitled"))}}\\par\\medskip`,j(n,e),"",S(r,t),"",w(t,`\\vfill\\small\\section*{${s(p("scriptorium.article.sources"))}}`),"\\end{document}",""].filter((i,a,c)=>!(i===""&&c[a-1]==="")).join(`
`)}function ne(o,e=""){return`${(l(o.data,"title")||o.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${e}.tex`}function ae(o,e){const n=new Set;for(const t of G(o))J(b(t),r=>{r.t==="embed"&&$(e,r.key)===void 0&&n.add(r.key)},r=>{if(r.t==="cite")for(const i of r.items)$(e,i.key)===void 0&&n.add(i.key)});return[...n]}export{ee as a,ne as l,ae as m,te as p,N as t};
