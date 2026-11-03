import{eb as l,em as E,kv as L,gO as $,kz as S,kw as A,eK as h,hc as C,h2 as q,fv as K,h1 as v,i9 as M,eo as F,hB as P,i8 as D,ia as I,eJ as R,i5 as _,iZ as G,ep as b}from"./mount-Cj-i4ujI.js";import{t as J}from"./TextArticle-HE9pViCW.js";function c(i){return i.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const B=i=>i.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),T=i=>i.map(t=>{const n=c(t.text),e=t.italic===!0?`\\emph{${n}}`:n;return t.href!==void 0&&/^https?:/i.test(t.href)?`\\href{${B(t.href)}}{${e}}`:e}).join("");function d(i,t,n=!1){return i.map(e=>{switch(e.t){case"text":return c(e.v);case"br":return n?" ":`\\\\
`;case"math":return e.display&&!n?`\\[${e.tex}\\]`:`$${e.tex}$`;case"b":return`\\textbf{${d(e.c,t,n)}}`;case"i":return`\\emph{${d(e.c,t,n)}}`;case"link":return`\\href{${B(e.href)}}{${d(e.c,t,n)}}`;case"cite":{const s=e.items.filter(a=>!v(h(t.look,a.key))).map(a=>{const r=h(t.look,a.key);return`\\emph{${c(M(r,t.look))}}${a.locator===""?"":`, ${c(a.locator)}`}`}),o=e.items.filter(a=>v(h(t.look,a.key))).map(a=>{const r=h(t.look,a.key),u=q(r,t.look);return u!==void 0&&t.works.push(u),T(F(r,a.locator,t.look,t.state))});return`${s.length===0?"":` (zob. ${s.join("; ")})`}${o.length===0?"":`\\footnote{${o.join("; ")}.}`}`}case"ref":return d(e.c,t,n);case"note":return t.state.last=null,`\\footnote{${d(e.c,t,!0)}}`;default:return""}}).join("")}const Z={article:["\\section*","\\subsection*","\\subsubsection*"]};function g(i,t,n){var s;const e=[];for(const o of i)switch(o.t){case"p":e.push(d(o.c,t));break;case"h":{const a=Math.min(2,(o.level===2?0:1)+n);e.push(`${Z.article[a]}{${d(o.c,t,!0)}}`);break}case"quote":e.push(`\\begin{quotation}
${g(o.c,t,n)}
\\end{quotation}`);break;case"list":{const a=o.ordered?"enumerate":"itemize";e.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${d(r,t)}`).join(`
`)}
\\end{${a}}`);break}case"hr":e.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const a=h(t.look,o.key),r=a===void 0?null:C(a,t.look);if(a!==void 0&&r!==null){if(((s=t.path)==null?void 0:s.has(a.id))===!0)break;e.push(H(a,r,{...t,path:new Set([...t.path??[],a.id])},n));break}if(a===void 0||a.kind!=="quote"){e.push("% odwołanie niedostępne");break}const u=q(a,t.look);u!==void 0&&t.works.push(u);const m=l(a.data,"text").split(/\n\s*\n/).map(f=>c(f).replace(/\n/g,`\\\\
`)).join(`

`),p=l(a.data,"translation"),w=[K(a,t.look),o.locator].filter(f=>f.trim()!=="").join(", ");e.push(["\\begin{quotation}",m,p===""?"":`
\\emph{${c(p)}}`,`
\\hfill--- ${c(w)}`,"\\end{quotation}"].filter(f=>f!=="").join(`
`));break}}return e.join(`

`)}function z(i,t){return i.map(n=>"ref"in n?c(D(n.ref,n.locator??"",t.look)):d(I(n.text),t)).join("")}function H(i,t,n,e){const s=[];for(const o of P(i.data,t)){if(o.type==="paragraph"){s.push(g($(o.text),n,e));continue}if(o.type==="table"){const r=Math.max(1,o.columns.length,...o.rows.map(p=>p.length)),u=`p{${(.9/r).toFixed(3)}\\linewidth}`,m=o.columns.some(p=>p!=="")?[`${o.columns.map(p=>`\\textbf{${c(p)}}`).join(" & ")} \\\\`,"\\hline"]:[];s.push([`\\begin{tabular}{|${Array.from({length:r},()=>u).join("|")}|}`,"\\hline",...m,...o.rows.map(p=>`${Array.from({length:r},(w,f)=>z(p[f]??[],n)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const a=o.type==="ordered"?"enumerate":"itemize";s.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${z(r,n)}`).join(`
`)}
\\end{${a}}`)}return`\\begin{quote}
${s.join(`

`)}
\\end{quote}`}const k=i=>[`\\documentclass[11pt,a4paper${i==="book"?",openany":""}]{${i}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}","\\usepackage[polish]{babel}","\\usepackage{lmodern}","\\usepackage{amsmath,amssymb}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`);function y(i,t){const n=[S(i,t),l(i,"date"),l(i,"occasion"),l(i,"place")].filter(o=>o.trim()!==""),e=l(i,"readings"),s=J(i,t).map(o=>`\\par\\noindent ${c(o.label)}: ${c(o.value)}`);return[n.length>0?`\\noindent\\textsc{${c(n.join(" · "))}}`:"",e!==""?`\\par\\noindent Czytania: ${c(e)}`:"",...s].filter(Boolean).join(`
`)}function x(i,t){const n=[];let e=-1;const s=o=>"  ".repeat(o+1);for(const o of i){for(;e<o.depth;)e+=1,n.push(`${s(e-1)}\\begin{enumerate}${e===0?"":"[label*=.\\arabic*]"}`);for(;e>o.depth;)n.push(`${s(e-1)}\\end{enumerate}`),e-=1;const a=$(o.text),r=a.length===1&&a[0].t==="p"?d(a[0].c,t):g(a,t,1);n.push(`${s(e)}\\item ${r}`)}for(;e>=0;)n.push(`${s(e-1)}\\end{enumerate}`),e-=1;return n.join(`
`)}function O(i,t,n){const e=i.data,s=L(e),a=(s.length===0?"":`\\section*{Plan}
${x(s,t)}

`)+g($(l(e,"body")),t,n),r=l(e,"further").trim()===""?"":`

\\section*{Dalsze informacje}
${g($(l(e,"further")),t,n)}`;return`${a}${r}`}function j(i,t){const n=A(i.works,i.look);return n.length===0?"":[t,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...n.map(({segs:e})=>`  \\item ${T(e)}.`),"\\end{itemize}"].join(`
`)}function V(i,t,n={}){const e=i.data,s={look:t,state:b(),works:[]},o=t.get(E(e,"project")[0]??""),a=O(i,s,0);return[k("article"),"",`\\title{${c(l(e,"title")||"Bez tytułu")}${l(e,"subtitle")===""?"":`\\\\\\large ${c(l(e,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,`\\date{${c(l(e,"date"))}}`,"","\\begin{document}","\\maketitle",o!==void 0?`\\begin{center}\\emph{${c(l(o.data,"title"))}}\\end{center}`:"",y(e,t),"",a,"",j(s,"\\section*{Źródła}"),"\\end{document}",""].filter((r,u,m)=>!(r===""&&m[u-1]==="")).join(`
`)}function W(i,t,n={}){const e=i.data,s={look:t,state:b(),works:[]},o=[];for(const a of G(e)){if("heading"in a){o.push(`\\part*{${c(a.heading)}}
\\addcontentsline{toc}{part}{${c(a.heading)}}`);continue}const r=t.get(a.text)??t.byKey(a.text.replace(/^@/,""));if(r===void 0||r.kind!=="text"||n.only!==void 0&&!n.only(r))continue;const u=l(r.data,"title")||"Bez tytułu";o.push([`\\chapter*{${c(u)}}`,`\\addcontentsline{toc}{chapter}{${c(u)}}`,l(r.data,"subtitle")===""?"":`\\noindent\\emph{${c(l(r.data,"subtitle"))}}\\par\\medskip`,y(r.data,t),"",O(r,s,0)].filter(m=>m!=="").join(`
`))}return[k("book"),"",`\\title{${c(l(e,"title")||"Projekt")}${l(e,"subtitle")===""?"":`\\\\\\large ${c(l(e,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(e,"description")===""?"":`\\begin{abstract}
${c(l(e,"description"))}
\\end{abstract}`,"\\tableofcontents","",o.join(`

`),"",j(s,`\\chapter*{Źródła}
\\addcontentsline{toc}{chapter}{Źródła}`),"\\end{document}",""].filter((a,r,u)=>!(a===""&&u[r-1]==="")).join(`
`)}function X(i,t){const n=i.data,e={look:t,state:b(),works:[]},s=L(n);return[k("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${c(l(n,"title")||"Bez tytułu")}}\\par\\medskip`,y(n,t),"",x(s,e),"",j(e,"\\vfill\\small\\section*{Źródła}"),"\\end{document}",""].filter((o,a,r)=>!(o===""&&r[a-1]==="")).join(`
`)}function Y(i,t=""){return`${(l(i.data,"title")||i.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${t}.tex`}function N(i,t){const n=new Set;for(const e of R(i))_($(e),s=>{s.t==="embed"&&h(t,s.key)===void 0&&n.add(s.key)},s=>{if(s.t==="cite")for(const o of s.items)h(t,o.key)===void 0&&n.add(o.key)});return[...n]}export{W as a,Y as l,N as m,X as p,V as t};
