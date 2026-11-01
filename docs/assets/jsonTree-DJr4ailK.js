function i(t){const n=[],e=new Set,s=(a,r,u)=>{var o;if(!(e.has(a.key)||r>12)){e.add(a.key),n.push({node:a,depth:r,parent:u});for(const f of((o=a.inside)==null?void 0:o.call(a))??[])s(f,r+1,a.key)}};return s(t,0,null),n}const c=t=>`${"#".repeat(Math.min(t.depth+1,4))} ${t.node.title}`,l=t=>{const n=t.node.text().trim();return n===""?c(t):`${c(t)}
${n}`};function p(t){return`${i(t).map(l).join(`

`)}
`}function $(t){return i(t).flatMap(n=>{var e,s;return[...((s=(e=n.node).samples)==null?void 0:s.call(e))??[]]})}const y=(t,n,e,s)=>({key:t,title:n,text:e,...s===void 0?{}:{inside:s}}),k=(t,n="  ")=>Object.entries(t).map(([e,s])=>`${n}"${e}" — ${s}`).join(`
`),m=t=>JSON.stringify(t,null,2);export{l as a,$ as b,p as d,k,m as p,i as s,y as t};
