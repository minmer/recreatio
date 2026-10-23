import{d6 as l,d9 as S,dz as L,db as M,df as z,gR as A,gt as g,ew as O,dM as C,dE as h,dL as x,dx as P,gB as w,gx as _,dc as F,dU as R,gE as D,e8 as I,gy as K,dp as G,dd as b}from"./mount-BwgUTIUU.js";function c(o){return o.replace(/\\/g,"\0").replace(/([{}$&#%_])/g,"\\$1").replace(/\^/g,"\\textasciicircum{}").replace(/~/g,"\\textasciitilde{}").replace(/\u0000/g,"\\textbackslash{}").replace(/…/g,"\\dots{}").replace(/\u00a0/g,"~").replace(/ – /g," -- ").replace(/ — /g," --- ").replace(/(\d)–(\d)/g,"$1--$2")}const T=o=>o.replace(/\\/g,"/").replace(/([#%])/g,"\\$1"),E=o=>o.map(e=>{const a=c(e.text),t=e.italic===!0?`\\emph{${a}}`:a;return e.href!==void 0&&/^https?:/i.test(e.href)?`\\href{${T(e.href)}}{${t}}`:t}).join("");function m(o,e,a=!1){return o.map(t=>{switch(t.t){case"text":return c(t.v);case"br":return a?" ":`\\\\
`;case"b":return`\\textbf{${m(t.c,e,a)}}`;case"i":return`\\emph{${m(t.c,e,a)}}`;case"link":return`\\href{${T(t.href)}}{${m(t.c,e,a)}}`;case"cite":{const i=t.items.filter(n=>!w(h(e.look,n.key))).map(n=>{const s=h(e.look,n.key);return`\\emph{${c(_(s,e.look))}}${n.locator===""?"":`, ${c(n.locator)}`}`}),r=t.items.filter(n=>w(h(e.look,n.key))).map(n=>{const s=h(e.look,n.key),u=x(s,e.look);return u!==void 0&&e.works.push(u),E(F(s,n.locator,e.look,e.state))});return`${i.length===0?"":` (zob. ${i.join("; ")})`}${r.length===0?"":`\\footnote{${r.join("; ")}.}`}`}case"ref":return m(t.c,e,a);case"note":return e.state.last=null,`\\footnote{${m(t.c,e,!0)}}`;default:return""}}).join("")}const U={article:["\\section*","\\subsection*","\\subsubsection*"]};function $(o,e,a){var i;const t=[];for(const r of o)switch(r.t){case"p":t.push(m(r.c,e));break;case"h":{const n=Math.min(2,(r.level===2?0:1)+a);t.push(`${U.article[n]}{${m(r.c,e,!0)}}`);break}case"quote":t.push(`\\begin{quotation}
${$(r.c,e,a)}
\\end{quotation}`);break;case"list":{const n=r.ordered?"enumerate":"itemize";t.push(`\\begin{${n}}
${r.items.map(s=>`  \\item ${m(s,e)}`).join(`
`)}
\\end{${n}}`);break}case"hr":t.push("\\begin{center}*\\quad*\\quad*\\end{center}");break;case"embed":{const n=h(e.look,r.key);if((n==null?void 0:n.kind)==="comment"){if(((i=e.path)==null?void 0:i.has(n.id))===!0)break;t.push(X(n,{...e,path:new Set([...e.path??[],n.id])},a));break}if(n===void 0||n.kind!=="quote"){t.push("% odwołanie niedostępne");break}const s=x(n,e.look);s!==void 0&&e.works.push(s);const u=l(n.data,"text").split(/\n\s*\n/).map(f=>c(f).replace(/\n/g,`\\\\
`)).join(`

`),p=l(n.data,"translation"),d=[P(n,e.look),r.locator].filter(f=>f.trim()!=="").join(", ");t.push(["\\begin{quotation}",u,p===""?"":`
\\emph{${c(p)}}`,`
\\hfill--- ${c(d)}`,"\\end{quotation}"].filter(f=>f!=="").join(`
`));break}}return t.join(`

`)}function v(o,e){return o.map(a=>"ref"in a?c(R(a.ref,a.locator??"",e.look)):m(D(a.text),e)).join("")}function X(o,e,a){const t=[];for(const i of z(o.data)){if(i.type==="paragraph"){t.push($(g(i.text),e,a));continue}if(i.type==="table"){const n=Math.max(1,i.columns.length,...i.rows.map(p=>p.length)),s=`p{${(.9/n).toFixed(3)}\\linewidth}`,u=i.columns.some(p=>p!=="")?[`${i.columns.map(p=>`\\textbf{${c(p)}}`).join(" & ")} \\\\`,"\\hline"]:[];t.push([`\\begin{tabular}{|${Array.from({length:n},()=>s).join("|")}|}`,"\\hline",...u,...i.rows.map(p=>`${Array.from({length:n},(d,f)=>v(p[f]??[],e)).join(" & ")} \\\\ \\hline`),"\\end{tabular}"].join(`
`));continue}const r=i.type==="ordered"?"enumerate":"itemize";t.push(`\\begin{${r}}
${i.items.map(n=>`  \\item ${v(n,e)}`).join(`
`)}
\\end{${r}}`)}return`\\begin{quote}
${t.join(`

`)}
\\end{quote}`}const k=o=>[`\\documentclass[11pt,a4paper${o==="book"?",openany":""}]{${o}}`,"\\usepackage[utf8]{inputenc}","\\usepackage[T1]{fontenc}","\\usepackage[polish]{babel}","\\usepackage{lmodern}","\\usepackage{microtype}","\\usepackage[hidelinks]{hyperref}","\\usepackage{enumitem}","\\setlist{itemsep=0.2em}","\\frenchspacing"].join(`
`),Y=o=>{var e;return((e=O.find(a=>a.value===o))==null?void 0:e.label)??""};function y(o){const e=[Y(l(o,"textType")),l(o,"date"),l(o,"occasion"),l(o,"place")].filter(t=>t.trim()!==""),a=l(o,"readings");return[e.length>0?`\\noindent\\textsc{${c(e.join(" · "))}}`:"",a!==""?`\\par\\noindent Czytania: ${c(a)}`:""].filter(Boolean).join(`
`)}function q(o,e){const a=[];let t=-1;const i=r=>"  ".repeat(r+1);for(const r of o){for(;t<r.depth;)t+=1,a.push(`${i(t-1)}\\begin{enumerate}${t===0?"":"[label*=.\\arabic*]"}`);for(;t>r.depth;)a.push(`${i(t-1)}\\end{enumerate}`),t-=1;const n=g(r.text),s=n.length===1&&n[0].t==="p"?m(n[0].c,e):$(n,e,1);a.push(`${i(t)}\\item ${s}`)}for(;t>=0;)a.push(`${i(t-1)}\\end{enumerate}`),t-=1;return a.join(`
`)}function B(o,e,a){const t=o.data,i=L(t),n=(i.length===0?"":`\\section*{Plan}
${q(i,e)}

`)+$(g(l(t,"body")),e,a),s=l(t,"further").trim()===""?"":`

\\section*{Dalsze informacje}
${$(g(l(t,"further")),e,a)}`;return`${n}${s}`}function j(o,e){const a=C(o.works,o.look);return a.length===0?"":[e,"\\begin{itemize}[label={},leftmargin=1.5em,itemindent=-1.5em]",...a.map(({segs:t})=>`  \\item ${E(t)}.`),"\\end{itemize}"].join(`
`)}function J(o,e,a={}){const t=o.data,i={look:e,state:b(),works:[]},r=e.get(S(t,"project")[0]??""),n=B(o,i,0);return[k("article"),"",`\\title{${c(l(t,"title")||"Bez tytułu")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(a.author??"")}}`,`\\date{${c(l(t,"date"))}}`,"","\\begin{document}","\\maketitle",r!==void 0?`\\begin{center}\\emph{${c(l(r.data,"title"))}}\\end{center}`:"",y(t),"",n,"",j(i,"\\section*{Źródła}"),"\\end{document}",""].filter((s,u,p)=>!(s===""&&p[u-1]==="")).join(`
`)}function Q(o,e,a={}){const t=o.data,i={look:e,state:b(),works:[]},r=[];for(const n of G(t)){if("heading"in n){r.push(`\\part*{${c(n.heading)}}
\\addcontentsline{toc}{part}{${c(n.heading)}}`);continue}const s=e.get(n.text)??e.byKey(n.text.replace(/^@/,""));if(s===void 0||s.kind!=="text"||a.only!==void 0&&!a.only(s))continue;const u=l(s.data,"title")||"Bez tytułu";r.push([`\\chapter*{${c(u)}}`,`\\addcontentsline{toc}{chapter}{${c(u)}}`,l(s.data,"subtitle")===""?"":`\\noindent\\emph{${c(l(s.data,"subtitle"))}}\\par\\medskip`,y(s.data),"",B(s,i,0)].filter(p=>p!=="").join(`
`))}return[k("book"),"",`\\title{${c(l(t,"title")||"Projekt")}${l(t,"subtitle")===""?"":`\\\\\\large ${c(l(t,"subtitle"))}`}}`,`\\author{${c(a.author??"")}}`,"\\date{}","","\\begin{document}","\\maketitle",l(t,"description")===""?"":`\\begin{abstract}
${c(l(t,"description"))}
\\end{abstract}`,"\\tableofcontents","",r.join(`

`),"",j(i,`\\chapter*{Źródła}
\\addcontentsline{toc}{chapter}{Źródła}`),"\\end{document}",""].filter((n,s,u)=>!(n===""&&u[s-1]==="")).join(`
`)}function V(o,e,a={}){var s;const t=o.data,i={look:e,state:b(),works:[]},r=a.comments===!0?((s=e.readable)==null?void 0:s.call(e))??[]:[],n=L(t).map(u=>{const p=M(o.id,r,u.id).flatMap(d=>z(d.data)).map(d=>d.type==="paragraph"?A(d.text):"").filter(d=>d.trim()!=="").join(" ");return p===""?u:{...u,text:`${u.text}
*(${p.replace(/[*_]/g,"")})*`}});return[k("article").replace("[11pt,a4paper","[14pt,a4paper").replace("{article}","{extarticle}"),"\\usepackage[margin=2cm]{geometry}","\\pagestyle{empty}","","\\begin{document}",`\\noindent{\\LARGE\\bfseries ${c(l(t,"title")||"Bez tytułu")}}\\par\\medskip`,y(t),"",q(n,i),"",j(i,"\\vfill\\small\\section*{Źródła}"),"\\end{document}",""].filter((u,p,d)=>!(u===""&&d[p-1]==="")).join(`
`)}function W(o,e=""){return`${(l(o.data,"title")||o.kind).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"tekst"}${e}.tex`}function Z(o,e){const a=new Set;for(const t of I(o))K(g(t),i=>{i.t==="embed"&&h(e,i.key)===void 0&&a.add(i.key)},i=>{if(i.t==="cite")for(const r of i.items)h(e,r.key)===void 0&&a.add(r.key)});return[...a]}export{V as a,W as l,Z as m,Q as p,J as t};
