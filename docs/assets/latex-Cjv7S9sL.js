import{ec as l,en as S,ky as z,gQ as g,kC as x,kz as C,eL as h,hf as A,h5 as q,fw as K,h4 as v,id as M,ep as F,h3 as P,ib as D,ia as I,eK as R,i8 as _,j2 as G,eq as b}from"./mount-qa48ieOm.js";import{t as Q}from"./TextArticle-C6x7jKNw.js";function c(i){return i.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const B=i=>i.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),T=i=>i.map(e=>{const n=c(e.text),t=e.italic===!0?`\\emph{${n}}`:n;return e.href!==void 0&&/^https?:/i.test(e.href)?`\\href{${B(e.href)}}{${t}}`:t}).join("");function p(i,e,n=!1){return i.map(t=>{switch(t.t){case"text":return c(t.v);case"br":return n?" ":`\\\\
`;case"math":return t.display&&!n?`\\[${t.tex}\\]`:`$${t.tex}$`;case"b":return`\\textbf{${p(t.c,e,n)}}`;case"i":return`\\emph{${p(t.c,e,n)}}`;case"link":return`\\href{${B(t.href)}}{${p(t.c,e,n)}}`;case"cite":{const s=t.items.filter(a=>!v(h(e.look,a.key))).map(a=>{const r=h(e.look,a.key);return`\\emph{${c(M(r,e.look))}}${a.locator===""?"":`, ${c(a.locator)}`}`}),o=t.items.filter(a=>v(h(e.look,a.key))).map(a=>{const r=h(e.look,a.key),u=q(r,e.look);return u!==void 0&&e.works.push(u),T(F(r,a.locator,e.look,e.state))});return`${s.length===0?"":` (zob. ${s.join("; ")})`}${o.length===0?"":`\\footnote{${o.join("; ")}.}`}`}case"ref":return p(t.c,e,n);case"note":return e.state.last=null,`\\footnote{${p(t.c,e,!0)}}`;default:return""}}).join("")}const H={article:["\\section*","\\subsection*","\\subsubsection*"]};function $(i,e,n){var s;const t=[];for(const o of i)switch(o.t){case"p":t.push(p(o.c,e));break;case"h":{const a=Math.min(2,(o.level===2?0:1)+n);t.push(`${H.article[a]}{${p(o.c,e,!0)}}`);break}case"quote":t.push(`\\begin{quotation}
${$(o.c,e,n)}
\\end{quotation}`);break;case"details":t.push(`\\paragraph{${p(o.summary,e,!0)}}
${$(o.c,e,n)}`);break;case"list":{const a=o.ordered?"enumerate":"itemize";t.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${p(r,e)}`).join(`
`)}
\\end{${a}}`);break}case"hr":t.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const a=h(e.look,o.key),r=a===void 0?null:A(a,e.look);if(a!==void 0&&r!==null){if(((s=e.path)==null?void 0:s.has(a.id))===!0)break;t.push(J(a,r,{...e,path:new Set([...e.path??[],a.id])},n));break}if(a===void 0||a.kind!=="quote"){t.push("% odwołanie niedostępne");break}const u=q(a,e.look);u!==void 0&&e.works.push(u);const m=l(a.data,"text").split(/\n\s*\n/).map(f=>c(f).replace(/\n/g,`\\\\
`)).join(`

`),d=l(a.data,"translation"),w=[K(a,e.look),o.locator].filter(f=>f.trim()!=="").join(", ");t.push(["\\begin{quotation}",m,d===""?"":`
\\emph{${c(d)}}`,`
\\hfill--- ${c(w)}`,"\\end{quotation}"].filter(f=>f!=="").join(`
`));break}}return t.join(`

`)}function L(i,e){return i.map(n=>"ref"in n?c(D(n.ref,n.locator??"",e.look)):p(I(n.text),e)).join("")}function J(i,e,n,t){const s=[];for(const o of P(i.data,e)){if(o.type==="paragraph"){s.push($(g(o.text),n,t));continue}if(o.type==="table"){const r=Math.max(1,o.columns.length,...o.rows.map(d=>d.length)),u=`p{${(.9/r).toFixed(3)}\\linewidth}`,m=o.columns.some(d=>d!=="")?[`${o.columns.map(d=>`\\textbf{${c(d)}}`).join(" & ")} \\\\`,"\\hline"]:[];s.push([`\\begin{tabular}{|${Array.from({length:r},()=>u).join("|")}|}`,"\\hline",...m,...o.rows.map(d=>`${Array.from({length:r},(w,f)=>L(d[f]??[],n)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const a=o.type==="ordered"?"enumerate":"itemize";s.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${L(r,n)}`).join(`
`)}
\\end{${a}}`)}return`\\begin{quote}
${s.join(`

`)}
\\end{quote}`}const k=i=>[`\\documentclass[11pt,a4paper${i==="book"?",openany":""}]{${i}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}","\\usepackage[polish]{babel}","\\usepackage{lmodern}","\\usepackage{amsmath,amssymb}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`);function y(i,e){const n=[x(i,e),l(i,"date"),l(i,"occasion"),l(i,"place")].filter(o=>o.trim()!==""),t=l(i,"readings"),s=Q(i,e).map(o=>`\\par\\noindent ${c(o.label)}: ${c(o.value)}`);return[n.length>0?`\\noindent\\textsc{${c(n.join(" · "))}}`:"",t!==""?`\\par\\noindent Czytania: ${c(t)}`:"",...s].filter(Boolean).join(`
`)}function E(i,e){const n=[];let t=-1;const s=o=>"  ".repeat(o+1);for(const o of i){for(;t<o.depth;)t+=1,n.push(`${s(t-1)}\\begin{enumerate}${t===0?"":"[label*=.\\arabic*]"}`);for(;t>o.depth;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;const a=g(o.text),r=a.length===1&&a[0].t==="p"?p(a[0].c,e):$(a,e,1);n.push(`${s(t)}\\item ${r}`)}for(;t>=0;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;return n.join(`
`)}function O(i,e,n){const t=i.data,s=z(t),a=(s.length===0?"":`\\section*{Plan}
${E(s,e)}

`)+$(g(l(t,"body")),e,n),r=l(t,"further").trim()===""?"":`

\\section*{Dalsze informacje}
${$(g(l(t,"further")),e,n)}`;return`${a}${r}`}function j(i,e){const n=C(i.works,i.look);return n.length===0?"":[e,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...n.map(({segs:t})=>`  \\item ${T(t)}.`),"\\end{itemize}"].join(`
`)}function W(i,e,n={}){const t=i.data,s={look:e,state:b(),works:[]},o=e.get(S(t,"project")[0]??""),a=O(i,s,0);return[k("article"),"",`\\title{${c(l(t,"title")||"Bez tytułu")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,`\\date{${c(l(t,"date"))}}`,"","\\begin{document}","\\maketitle",o!==void 0?`\\begin{center}\\emph{${c(l(o.data,"title"))}}\\end{center}`:"",y(t,e),"",a,"",j(s,"\\section*{Źródła}"),"\\end{document}",""].filter((r,u,m)=>!(r===""&&m[u-1]==="")).join(`
`)}function X(i,e,n={}){const t=i.data,s={look:e,state:b(),works:[]},o=[];for(const a of G(t)){if("heading"in a){o.push(`\\part*{${c(a.heading)}}
\\addcontentsline{toc}{part}{${c(a.heading)}}`);continue}const r=e.get(a.text)??e.byKey(a.text.replace(/^@/,""));if(r===void 0||r.kind!=="text"||n.only!==void 0&&!n.only(r))continue;const u=l(r.data,"title")||"Bez tytułu";o.push([`\\chapter*{${c(u)}}`,`\\addcontentsline{toc}{chapter}{${c(u)}}`,l(r.data,"subtitle")===""?"":`\\noindent\\emph{${c(l(r.data,"subtitle"))}}\\par\\medskip`,y(r.data,e),"",O(r,s,0)].filter(m=>m!=="").join(`
`))}return[k("book"),"",`\\title{${c(l(t,"title")||"Projekt")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(t,"description")===""?"":`\\begin{abstract}
${c(l(t,"description"))}
\\end{abstract}`,"\\tableofcontents","",o.join(`

`),"",j(s,`\\chapter*{Źródła}
\\addcontentsline{toc}{chapter}{Źródła}`),"\\end{document}",""].filter((a,r,u)=>!(a===""&&u[r-1]==="")).join(`
`)}function Y(i,e){const n=i.data,t={look:e,state:b(),works:[]},s=z(n);return[k("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${c(l(n,"title")||"Bez tytułu")}}\\par\\medskip`,y(n,e),"",E(s,t),"",j(t,"\\vfill\\small\\section*{Źródła}"),"\\end{document}",""].filter((o,a,r)=>!(o===""&&r[a-1]==="")).join(`
`)}function Z(i,e=""){return`${(l(i.data,"title")||i.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${e}.tex`}function N(i,e){const n=new Set;for(const t of R(i))_(g(t),s=>{s.t==="embed"&&h(e,s.key)===void 0&&n.add(s.key)},s=>{if(s.t==="cite")for(const o of s.items)h(e,o.key)===void 0&&n.add(o.key)});return[...n]}export{X as a,Z as l,N as m,Y as p,W as t};
