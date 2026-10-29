import{e8 as l,ej as S,jE as L,ie as $,jI as x,jF as A,eH as h,ia as C,ib as z,fq as F,ic as v,ij as M,el as I,id as K,ii as P,ik as D,eG as G,i8 as R,hq as _,em as b}from"./mount-mm1cK-7p.js";import{t as H}from"./TextArticle-N8HxvR4Y.js";function c(i){return i.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const B=i=>i.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),T=i=>i.map(e=>{const n=c(e.text),t=e.italic===!0?`\\emph{${n}}`:n;return e.href!==void 0&&/^https?:/i.test(e.href)?`\\href{${B(e.href)}}{${t}}`:t}).join("");function d(i,e,n=!1){return i.map(t=>{switch(t.t){case"text":return c(t.v);case"br":return n?" ":`\\\\
`;case"b":return`\\textbf{${d(t.c,e,n)}}`;case"i":return`\\emph{${d(t.c,e,n)}}`;case"link":return`\\href{${B(t.href)}}{${d(t.c,e,n)}}`;case"cite":{const s=t.items.filter(a=>!v(h(e.look,a.key))).map(a=>{const r=h(e.look,a.key);return`\\emph{${c(M(r,e.look))}}${a.locator===""?"":`, ${c(a.locator)}`}`}),o=t.items.filter(a=>v(h(e.look,a.key))).map(a=>{const r=h(e.look,a.key),u=z(r,e.look);return u!==void 0&&e.works.push(u),T(I(r,a.locator,e.look,e.state))});return`${s.length===0?"":` (zob. ${s.join("; ")})`}${o.length===0?"":`\\footnote{${o.join("; ")}.}`}`}case"ref":return d(t.c,e,n);case"note":return e.state.last=null,`\\footnote{${d(t.c,e,!0)}}`;default:return""}}).join("")}const J={article:["\\section*","\\subsection*","\\subsubsection*"]};function g(i,e,n){var s;const t=[];for(const o of i)switch(o.t){case"p":t.push(d(o.c,e));break;case"h":{const a=Math.min(2,(o.level===2?0:1)+n);t.push(`${J.article[a]}{${d(o.c,e,!0)}}`);break}case"quote":t.push(`\\begin{quotation}
${g(o.c,e,n)}
\\end{quotation}`);break;case"list":{const a=o.ordered?"enumerate":"itemize";t.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${d(r,e)}`).join(`
`)}
\\end{${a}}`);break}case"hr":t.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const a=h(e.look,o.key),r=a===void 0?null:C(a,e.look);if(a!==void 0&&r!==null){if(((s=e.path)==null?void 0:s.has(a.id))===!0)break;t.push(N(a,r,{...e,path:new Set([...e.path??[],a.id])},n));break}if(a===void 0||a.kind!=="quote"){t.push("% odwołanie niedostępne");break}const u=z(a,e.look);u!==void 0&&e.works.push(u);const f=l(a.data,"text").split(/\n\s*\n/).map(m=>c(m).replace(/\n/g,`\\\\
`)).join(`

`),p=l(a.data,"translation"),w=[F(a,e.look),o.locator].filter(m=>m.trim()!=="").join(", ");t.push(["\\begin{quotation}",f,p===""?"":`
\\emph{${c(p)}}`,`
\\hfill--- ${c(w)}`,"\\end{quotation}"].filter(m=>m!=="").join(`
`));break}}return t.join(`

`)}function q(i,e){return i.map(n=>"ref"in n?c(P(n.ref,n.locator??"",e.look)):d(D(n.text),e)).join("")}function N(i,e,n,t){const s=[];for(const o of K(i.data,e)){if(o.type==="paragraph"){s.push(g($(o.text),n,t));continue}if(o.type==="table"){const r=Math.max(1,o.columns.length,...o.rows.map(p=>p.length)),u=`p{${(.9/r).toFixed(3)}\\linewidth}`,f=o.columns.some(p=>p!=="")?[`${o.columns.map(p=>`\\textbf{${c(p)}}`).join(" & ")} \\\\`,"\\hline"]:[];s.push([`\\begin{tabular}{|${Array.from({length:r},()=>u).join("|")}|}`,"\\hline",...f,...o.rows.map(p=>`${Array.from({length:r},(w,m)=>q(p[m]??[],n)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const a=o.type==="ordered"?"enumerate":"itemize";s.push(`\\begin{${a}}
${o.items.map(r=>`  \\item ${q(r,n)}`).join(`
`)}
\\end{${a}}`)}return`\\begin{quote}
${s.join(`

`)}
\\end{quote}`}const k=i=>[`\\documentclass[11pt,a4paper${i==="book"?",openany":""}]{${i}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}","\\usepackage[polish]{babel}","\\usepackage{lmodern}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`);function y(i,e){const n=[x(i,e),l(i,"date"),l(i,"occasion"),l(i,"place")].filter(o=>o.trim()!==""),t=l(i,"readings"),s=H(i,e).map(o=>`\\par\\noindent ${c(o.label)}: ${c(o.value)}`);return[n.length>0?`\\noindent\\textsc{${c(n.join(" · "))}}`:"",t!==""?`\\par\\noindent Czytania: ${c(t)}`:"",...s].filter(Boolean).join(`
`)}function E(i,e){const n=[];let t=-1;const s=o=>"  ".repeat(o+1);for(const o of i){for(;t<o.depth;)t+=1,n.push(`${s(t-1)}\\begin{enumerate}${t===0?"":"[label*=.\\arabic*]"}`);for(;t>o.depth;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;const a=$(o.text),r=a.length===1&&a[0].t==="p"?d(a[0].c,e):g(a,e,1);n.push(`${s(t)}\\item ${r}`)}for(;t>=0;)n.push(`${s(t-1)}\\end{enumerate}`),t-=1;return n.join(`
`)}function O(i,e,n){const t=i.data,s=L(t),a=(s.length===0?"":`\\section*{Plan}
${E(s,e)}

`)+g($(l(t,"body")),e,n),r=l(t,"further").trim()===""?"":`

\\section*{Dalsze informacje}
${g($(l(t,"further")),e,n)}`;return`${a}${r}`}function j(i,e){const n=A(i.works,i.look);return n.length===0?"":[e,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...n.map(({segs:t})=>`  \\item ${T(t)}.`),"\\end{itemize}"].join(`
`)}function V(i,e,n={}){const t=i.data,s={look:e,state:b(),works:[]},o=e.get(S(t,"project")[0]??""),a=O(i,s,0);return[k("article"),"",`\\title{${c(l(t,"title")||"Bez tytułu")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,`\\date{${c(l(t,"date"))}}`,"","\\begin{document}","\\maketitle",o!==void 0?`\\begin{center}\\emph{${c(l(o.data,"title"))}}\\end{center}`:"",y(t,e),"",a,"",j(s,"\\section*{Źródła}"),"\\end{document}",""].filter((r,u,f)=>!(r===""&&f[u-1]==="")).join(`
`)}function W(i,e,n={}){const t=i.data,s={look:e,state:b(),works:[]},o=[];for(const a of _(t)){if("heading"in a){o.push(`\\part*{${c(a.heading)}}
\\addcontentsline{toc}{part}{${c(a.heading)}}`);continue}const r=e.get(a.text)??e.byKey(a.text.replace(/^@/,""));if(r===void 0||r.kind!=="text"||n.only!==void 0&&!n.only(r))continue;const u=l(r.data,"title")||"Bez tytułu";o.push([`\\chapter*{${c(u)}}`,`\\addcontentsline{toc}{chapter}{${c(u)}}`,l(r.data,"subtitle")===""?"":`\\noindent\\emph{${c(l(r.data,"subtitle"))}}\\par\\medskip`,y(r.data,e),"",O(r,s,0)].filter(f=>f!=="").join(`
`))}return[k("book"),"",`\\title{${c(l(t,"title")||"Projekt")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(n.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(t,"description")===""?"":`\\begin{abstract}
${c(l(t,"description"))}
\\end{abstract}`,"\\tableofcontents","",o.join(`

`),"",j(s,`\\chapter*{Źródła}
\\addcontentsline{toc}{chapter}{Źródła}`),"\\end{document}",""].filter((a,r,u)=>!(a===""&&u[r-1]==="")).join(`
`)}function X(i,e){const n=i.data,t={look:e,state:b(),works:[]},s=L(n);return[k("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${c(l(n,"title")||"Bez tytułu")}}\\par\\medskip`,y(n,e),"",E(s,t),"",j(t,"\\vfill\\small\\section*{Źródła}"),"\\end{document}",""].filter((o,a,r)=>!(o===""&&r[a-1]==="")).join(`
`)}function Y(i,e=""){return`${(l(i.data,"title")||i.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${e}.tex`}function Z(i,e){const n=new Set;for(const t of G(i))R($(t),s=>{s.t==="embed"&&h(e,s.key)===void 0&&n.add(s.key)},s=>{if(s.t==="cite")for(const o of s.items)h(e,o.key)===void 0&&n.add(o.key)});return[...n]}export{W as a,Y as l,Z as m,X as p,V as t};
