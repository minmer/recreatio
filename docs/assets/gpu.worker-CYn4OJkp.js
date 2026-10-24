var la=Object.defineProperty;var fa=(o,t,e)=>t in o?la(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var v=(o,t,e)=>fa(o,typeof t!="symbol"?t+"":t,e);function ua(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,a)=>(r[0]-i[0])*(a[1]-i[1])-(r[1]-i[1])*(a[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const ha={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},da=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],ma=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],pa={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},ga=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var xa={ambient:ha,species:da,solutes:ma,vapourInAir:pa,solids:ga};const qt=8.314462618,di=9.80665,en=101325,st=273.15,Kr=1602176634e-28,va=1380649e-29,ya=602214076e15,wa=88541878128e-22,H=0,et=1,ft=2,it=0,ot=1,Q=2,at=6,yt=3,St=xa,It=St.species[0],Ds=St.species[1],Vs=St.species[2],mt=new Float64Array(at);mt[it]=Ds.molarMass.v;mt[ot]=Vs.molarMass.v;mt[Q]=It.molarMass.v;Ds.name,Vs.name,It.vapour.name;const kr=Ds.gas.cp.v,Mr=Vs.gas.cp.v,[sn,nn,Ne]=It.vapour.cp.linear;function ba(o,t){return o===Q?sn+nn*(t-Ne):o===it?kr:o===ot?Mr:0}const Ge=It.liquid.kell.c,pn=It.liquid.cp.table,Tt=new Float64Array(pn.map(o=>o[0])),Bt=new Float64Array(pn.map(o=>o[1])),ne=new Float64Array(pn.length);ne[0]=Bt[0]*(Tt[0]-st);for(let o=1;o<pn.length;o+=1)ne[o]=ne[o-1]+.5*(Bt[o]+Bt[o-1])*(Tt[o]-Tt[o-1]);const Gt=pn.length-1;function dc(o){if(o<Tt[0])return-1;if(o>=Tt[Gt])return Gt;let t=Math.min(Gt-1,Math.max(0,Math.floor((o-st)/10)));for(;t>0&&o<Tt[t];)t-=1;for(;t<Gt-1&&o>=Tt[t+1];)t+=1;return t}function je(o){const t=dc(o);return t<0?Bt[0]:t===Gt?Bt[Gt]:Bt[t]+(Bt[t+1]-Bt[t])*(o-Tt[t])/(Tt[t+1]-Tt[t])}function Ft(o){const t=dc(o);if(t<0)return ne[0]+Bt[0]*(o-Tt[0]);if(t===Gt)return ne[Gt]+Bt[Gt]*(o-Tt[Gt]);const e=o-Tt[t],s=(Bt[t+1]-Bt[t])/(Tt[t+1]-Tt[t]);return ne[t]+Bt[t]*e+.5*s*e*e}function mc(o){if(o<ne[0])return Tt[0]+(o-ne[0])/Bt[0];if(o>=ne[Gt])return Tt[Gt]+(o-ne[Gt])/Bt[Gt];let t=Math.min(Gt-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<ne[t];)t-=1;for(;t<Gt-1&&o>=ne[t+1];)t+=1;const e=(Bt[t+1]-Bt[t])/(Tt[t+1]-Tt[t]),s=o-ne[t],n=Bt[t];return Tt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function rn(o){const t=o-st;return(Ge[0]+t*(Ge[1]+t*(Ge[2]+t*(Ge[3]+t*(Ge[4]+t*Ge[5])))))/(1+Ge[6]*t)}const wi=It.liquid.k.poly;function Xn(o){const t=Math.min(150,Math.max(0,o-st));return wi[0]+t*(wi[1]+t*wi[2])}const[Fa,Aa,zr]=It.liquid.mu.vogel;function Pr(o){return Fa*Math.pow(10,Aa/(Math.max(o,zr+60)-zr))}const bi=It.surfaceTension,_a=It.saturation.Tc.v;function mi(o){const t=Math.max(0,1-o/_a);return bi.B*Math.pow(t,bi.mu)*(1+bi.b*t)}const ka=It.saturation.hlv100.v,on=st+100,pc=Ft(on)+ka,Ma=It.vapour.k.v,Pa=It.vapour.mu.v;function xt(o){const t=o-Ne,e=on-Ne;return pc+sn*(o-on)+.5*nn*(t*t-e*e)}function gc(o){return xt(o)-Ft(o)}function ie(o,t){return o===Q?xt(t):ba(o,t)*(t-st)}const Fi=Ds.gas.k.power,Ai=Vs.gas.k.power,Ta=Ds.gas.mu.sutherland,Sa=Vs.gas.mu.sutherland,_i=St.vapourInAir,xc=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),vc=150,Yn=1001,gn=o=>{const t=new Float64Array(Yn);for(let e=0;e<Yn;e+=1)t[e]=o(vc+e);return t},ns=(o,t)=>{let e=t-vc;e>0?e>Yn-1.001&&(e=Yn-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Qr=gn(o=>Fi[0]*Math.pow(o/Fi[1],Fi[2])),Ca=gn(o=>Ai[0]*Math.pow(o/Ai[1],Ai[2])),Xr=gn(o=>xc(Ta,o)),La=gn(o=>xc(Sa,o)),Oa=gn(o=>_i.D0.v*Math.pow(o/_i.T0.v,_i.exponent.v));function yc(o,t,e,s){const n=o+t+e;return n>0?(o*ns(Qr,s)+t*ns(Ca,s)+e*Ma)/n:ns(Qr,s)}function Ba(o,t,e,s){const n=o+t+e;return n>0?(o*ns(Xr,s)+t*ns(La,s)+e*Pa)/n:ns(Xr,s)}function ja(o,t){return ns(Oa,o)*(en/t)}function wc(o,t,e,s){const n=o*kr+t*Mr,i=on-Ne,r=.5*e*nn,a=n+e*sn;if(a<=0)return st;const c=n*(Ne-st)+e*(pc+sn*(Ne-on)-.5*nn*i*i)-s,l=a*a-4*r*c;return Ne+-2*c/(a+Math.sqrt(l>0?l:0))}function er(o,t,e,s,n){return o*kr+t*Mr+e*(sn+nn*(n-Ne))+(s>0?s*je(n):0)}const qa=St.ambient.air.N2.v,Ia=St.ambient.air.O2.v,bc=St.ambient.hExt.v,ut=St.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function As(o){return ut.findIndex(t=>t.id===o)}const lt=0,Fc=St.species.slice(3),Yr=[null,...Fc.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*st+.5*s*st*st}})],ce=[{id:It.id,name:It.name,short:It.liquid.name,color:It.liquid.color,volatile:!0,range:[st,st+150]},...Fc.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function Ac(o){return ce.findIndex(t=>t.id===o)}const ls=o=>Yr[o]??Yr[1];function Tr(o,t){if(o===lt)return je(t);const e=ls(o);return e.cA+e.cB*t}function Ra(o,t){if(o===lt)return Ft(t);const e=ls(o);return e.cA*t+.5*e.cB*t*t-e.h0}function Ea(o,t){if(o===lt)return mc(t);const e=ls(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function os(o,t){if(o===lt)return rn(t);const e=ls(o);return e.rA+e.rB*t}function Ys(o,t){if(o===lt)return Xn(t);const e=ls(o);return e.kA+e.kB*t}function cn(o,t){if(o===lt)return Pr(t);const e=ls(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function Ms(o,t){return o===lt?mi(t):ls(o).sigma}It.thermo,Ds.thermo,Vs.thermo;const xn=St.species[0].saturation,Ae=xn.if97.n,_c=Ae[0],kc=Ae[1],Mc=Ae[2],Pc=Ae[3],Tc=Ae[4],Sc=Ae[5],Cc=Ae[6],Lc=Ae[7],Oc=Ae[8],sr=Ae[9],Js=xn.Tc.v,Da=xn.rhoc.v,Jn=273.15,fs=xn.vapourDensity.c;xn.liquidDensity.b;function pi(o){const t=o<Jn?Jn:o>Js?Js:o,e=t+Oc/(t-sr),s=e*e+_c*e+kc,n=Mc*e*e+Pc*e+Tc,i=Sc*e*e+Cc*e+Lc,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+Mc*e+Sc,n=_c*e*e+Pc*e+Cc,i=kc*e*e+Tc*e+Lc,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=sr+r;return(a-Math.sqrt(a*a-4*(Oc+sr*r)))/2}function Bc(o){const e=1-(o<Jn?Jn:o>Js?Js:o)/Js,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,c=a*a*s,l=c*a*r*r;return Da*Math.exp(fs[0]*n+fs[1]*i+fs[2]*r+fs[3]*a+fs[4]*c+fs[5]*l)}const Zn=250,ti=.01,vn=25001,Vn=new Float64Array(vn),Nn=new Float64Array(vn);for(let o=0;o<vn;o+=1)Vn[o]=pi(Zn+o*ti),Nn[o]=Bc(Zn+o*ti);function an(o){const t=(o-Zn)/ti;if(!(t>=0)||t>=vn-1)return pi(o);const e=t|0;return Vn[e]+(t-e)*(Vn[e+1]-Vn[e])}function Le(o){const t=(o-Zn)/ti;if(!(t>=0)||t>=vn-1)return Bc(o);const e=t|0;return Nn[e]+(t-e)*(Nn[e+1]-Nn[e])}const Ht=St.solutes[0],jc=St.species[0],Sr=jc.molarMass.v,Bs=Ht.molarMass.v,Va=Ht.ions.v,Cr=1,qc=St.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function Ic(o){return qc.findIndex(t=>t.id===o)}function Rc(o){return o>0?o*Bs/(1+o*Bs):0}const ge=298.15,yn=Ht.pitzer,Na=yn.b0.a,Ua=yn.b1.a,Ga=yn.c.a,Ha=yn.b.v,$a=yn.alpha.v,Un=Ht.pitzerCold,Wa=Un.below.v;function ki(o,t){return o[0]+o[1]*(1/t-1/ge)+o[2]*Math.log(t/ge)+o[3]*(t-ge)+o[4]*(t*t-ge*ge)+o[5]*(1/(t*t)-1/(ge*ge))}const _n=Ht.dielectric.c;function Ka(o){const t=o-st;return _n[0]+t*(_n[1]+t*(_n[2]+t*_n[3]))}function za(o){const t=Kr*Kr/(4*Math.PI*wa*Ka(o)*va*o);return Math.sqrt(2*Math.PI*ya*rn(o))*t*Math.sqrt(t)/3}function Qa(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<Wa,n=ki(s?Un.b0.a:Na,o),i=ki(s?Un.b1.a:Ua,o),r=ki(s?Un.c.a:Ga,o);return 1-za(o)*e/(1+Ha*e)+t*(n+i*Math.exp(-$a*e))+t*t*r}function ei(o,t){return t>0?Math.exp(-Va*t*Qa(o,t)*Sr):1}const Ec=240,si=221,Dc=.05,Ve=181;let Mi=null;function Xa(){if(Mi!==null)return Mi;const o=new Float64Array(si*Ve);for(let t=0;t<si;t+=1)for(let e=0;e<Ve;e+=1)o[t*Ve+e]=ei(Ec+t,e*Dc);return Mi=o,o}function Vc(o,t){if(!(t>0))return 1;const e=t/Dc;if(e>=Ve-1)return ei(o,t);const s=Xa();let n=o-Ec;n>0?n>si-1.000001&&(n=si-1.000001):n=0;const i=n|0,r=e|0,a=n-i,c=e-r,l=i*Ve+r,f=s[l]+c*(s[l+1]-s[l]),u=s[l+Ve]+c*(s[l+Ve+1]-s[l+Ve]);return f+a*(u-f)}function Nc(o,t){let e=kt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(o/Vc(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const gi=jc.fusion,re=gi.T.v,Lr=gi.h.v,Ya=gi.cpIce.v;gi.rhoIce.v;function Ja(o){const t=je(re)-Ya;return Sr/qt*((Lr-t*re)*(1/re-1/o)+t*Math.log(o/re))}const Za=Ht.eutectic.T.v,tl=Ht.eutectic.w.v;function Uc(o){if(!(o>0))return re;if(Rc(o)>=tl)return Za;const t=s=>Math.log(ei(s,o))-Ja(s);let e=re+Math.log(ei(re,o))*qt*re*re/(Sr*Lr);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return re;if(Math.abs(r)<1e-9)break}return e}const Ie=Ht.solubility.table;function el(o){if(o<=Ie[0][0])return Ie[0][1];for(let t=1;t<Ie.length;t+=1)if(o<=Ie[t][0]){const[e,s]=Ie[t-1],[n,i]=Ie[t];return s+(i-s)*(o-e)/(n-e)}return Ie[Ie.length-1][1]}function sl(o){return Rc(el(o))}Ht.solid.rho.v;const xi=Ht.solid.cp.v;function vi(o){return xi*(o-st)}const Gs=Ht.density.laliberte;function nl(o,t){const e=o-st,s=e+Gs[4];return(Gs[0]*t+Gs[1])*Math.exp(1e-6*s*s)/(t+Gs[2]+Gs[3]*e)}function Or(o,t){return t>0?1/((1-t)/rn(o)+t/nl(o,t)):rn(o)}const Ns=Ht.cp.laliberte,yi=Ns[0],il=Ns[1],rl=Ns[2],ln=Ns[3],Br=Ns[4],fn=Ns[5],cs=Ht.cp.range.lo,ni=Ht.cp.range.hi,is=.5,Oe=Math.round((ni-cs)/is)+1,Jt=new Float64Array(Oe),un=new Float64Array(Oe);for(let o=0;o<Oe;o+=1){const t=cs+o*is-st;Jt[o]=Math.exp(il*t+rl*Math.exp(.01*t))}un[0]=Jt[0]*(cs-st);for(let o=1;o<Oe;o+=1)un[o]=un[o-1]+.5*(Jt[o-1]+Jt[o])*is;function Gc(o){if(o<=cs)return Jt[0];if(o>=ni)return Jt[Oe-1];const t=(o-cs)/is,e=Math.min(Oe-2,t|0);return Jt[e]+(t-e)*(Jt[e+1]-Jt[e])}function wn(o){if(o<=cs)return Jt[0]*(o-st);if(o>=ni)return un[Oe-1]+Jt[Oe-1]*(o-ni);const t=(o-cs)/is,e=Math.min(Oe-2,t|0),s=(t-e)*is;return un[e]+Jt[e]*s+.5*(Jt[e+1]-Jt[e])*s*s/is}const jr=o=>1e3*yi*o*Math.exp(ln*o),qr=o=>1e3*Br*Math.pow(o,fn+1),Ir=Ht.dHsol.v/Bs+vi(ge)-1e3*yi*wn(ge);function Hc(o,t){return t>0?(1-t)*Ft(o)+t*Ir+jr(t)*wn(o)+qr(t)*(o-st):Ft(o)}function ol(o,t){return t>0?(1-t)*je(o)+jr(t)*Gc(o)+qr(t):je(o)}function cl(o,t,e){if(!(t>0))return mc(o);const s=jr(t),n=qr(t),i=t*Ir,r=1-t;let a=e>200&&e<900?e:st+(o-i)/(4e3*r+800*t);for(let c=0;c<30;c+=1){const f=(r*Ft(a)+i+s*wn(a)+n*(a-st)-o)/(r*je(a)+s*Gc(a)+n);if(a-=f,Math.abs(f)<1e-8)break}return a}function Jr(o,t){const e=Math.exp(ln*t),s=1e3*yi*e*(t+(1-t)*(1+ln*t)),n=t>0?1e3*Br*Math.pow(t,fn)*(t+(1-t)*(fn+1)):0;return Ir+s*wn(o)+n*(o-st)}const al=Ht.diffusivity.v,ll=Pr(ge);function Zr(o){return al*(o/ge)*ll/Pr(o)}function Gn(o,t){return t>0?Ft(o)-1e3*yi*ln*t*t*Math.exp(ln*t)*wn(o)-1e3*Br*fn*Math.pow(t,fn+1)*(o-st):Ft(o)}const fl=1e-6;function qe(o){var t;return((t=ut[o])==null?void 0:t.id)==="ice"?re:NaN}function Xs(o){return qe(o)>0?Ft(re)-ut[o].cp*(re-st)-Lr:0}function nr(o,t,e,s){return(o+e*xi)*(s-st)+t*Ft(s)}function Rr(o,t,e,s,n){const i=t+s*xi;if(!(i>0))return n;if(e<=0)return st+o/i;let r=n>100?n:st+o/i;for(let a=0;a<3;a+=1)r-=(i*(r-st)+e*Ft(r)-o)/(i+e*je(r));return r}class Rt{constructor(t,e,s,n){v(this,"mat",0);v(this,"heater",-1);v(this,"nr",0);v(this,"xs",[]);v(this,"ys",[]);v(this,"ni",new Int32Array(0));v(this,"nj",new Int32Array(0));v(this,"off",new Int32Array(0));v(this,"ncell",0);v(this,"E",new Float64Array(0));v(this,"film",new Float64Array(0));v(this,"crust",new Float64Array(0));v(this,"x",0);v(this,"y",0);v(this,"a",0);v(this,"vx",0);v(this,"vy",0);v(this,"w",0);v(this,"ux",0);v(this,"uy",0);v(this,"uw",0);v(this,"m",0);v(this,"I",0);v(this,"ma",0);v(this,"Ia",0);v(this,"ma6",new Float64Array(6));v(this,"maOk",!1);v(this,"pinned",!0);v(this,"asleep",!0);v(this,"gone",!1);v(this,"rest",0);v(this,"rx",0);v(this,"ry",0);v(this,"ra",0);v(this,"rmax",0);v(this,"hullA",0);v(this,"hullJ",0);v(this,"nseg",0);v(this,"segR",new Int32Array(0));v(this,"segS",new Uint8Array(0));v(this,"segT0",new Float64Array(0));v(this,"segT1",new Float64Array(0));v(this,"nw",0);v(this,"wk",new Int32Array(0));v(this,"wc",new Int32Array(0));v(this,"ww",new Float64Array(0));v(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,a,c=-1){const l=new Rt(t,e,s,n);l.mat=i,l.heater=c;const f=[],u=[];for(const[m,g,d,p]of r)!(d>m)||!(p>g)||(f.push(Rt.splits(m,d,s)),u.push(Rt.splits(g,p,s)));l.setRects(f,u);const h=ut[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=h.rho*h.cp*l.cellVolume(m)*(a-st);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=ut[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return Rr(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],a=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[a])continue;let c=0;for(;c<r-1&&t>n[c+1];)c+=1;let l=0;for(;l<a-1&&e>i[l+1];)l+=1;return this.off[s]+c+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=Xs(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=ut[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const u=Math.cos(this.a),h=Math.sin(this.a),m=u*e-h*s,g=h*e+u*s;this.x+=m,this.y+=g,this.rx+=m,this.ry+=g}let n=0,i=0,r=0;const a=[];for(let u=0;u<this.nr;u+=1){const[h,m,g,d]=this.bounds(u),p=g-h,x=d-m,w=t*p*x*this.depth,y=.5*(h+g),A=.5*(m+d);n+=w,i+=w*((p*p+x*x)/12+y*y+A*A);for(const[F,k]of[[h,m],[g,m],[g,d],[h,d]])a.push([F,k]),r=Math.max(r,Math.hypot(F,k))}this.m=n,this.I=i,this.rmax=r;const c=ua(a);let l=0,f=0;for(let u=0;u<c.length;u+=1){const[h,m]=c[u],[g,d]=c[(u+1)%c.length],p=h*d-g*m;l+=p/2,f+=p*(h*h+h*g+g*g+m*m+m*d+d*d)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(f),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,a,c]=this.bounds(n),l=(a-i)*(c-r);e+=l,s+=l*(t===0?.5*(i+a):.5*(r+c))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=fl*this.dx;for(let r=0;r<this.nr;r+=1){const[a,c,l,f]=this.bounds(r);for(let u=0;u<4;u+=1){const h=u<2,m=u===0?a:u===1?l:u===2?c:f;let g=[h?[c,f]:[a,l]];for(let d=0;d<this.nr&&g.length>0;d+=1){if(d===r)continue;const[p,x,w,y]=this.bounds(d);if(!(u===0?Math.abs(w-m)<=i:u===1?Math.abs(p-m)<=i:u===2?Math.abs(y-m)<=i:Math.abs(x-m)<=i))continue;const F=h?x:p,k=h?y:w,_=[];for(const[b,M]of g){if(k<=b||F>=M){_.push([b,M]);continue}F>b&&_.push([b,F]),k<M&&_.push([k,M])}g=_}for(const[d,p]of g)p-d<=i||(t.push(r),e.push(u),s.push(d),n.push(p))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),a=this.segS[t],c=this.segT0[t],l=this.segT1[t];a===0?(e[0]=s,e[1]=c,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):a===1?(e[0]=i,e[1]=c,e[2]=i,e[3]=l,e[4]=1,e[5]=0):a===2?(e[0]=c,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=c,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s),l=n-t,f=i-e;r[0]=a*l+c*f,r[1]=-c*l+a*f}static toWorld(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s);r[0]=t+a*n-c*i,r[1]=e+c*n+a*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,a=this.y-e;this.x=t+n*r-i*a,this.y=e+i*r+n*a,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let a=1/0,c=1/0,l=-1/0,f=-1/0;for(let u=0;u<this.nr;u+=1){const[h,m,g,d]=this.bounds(u);for(let p=0;p<4;p+=1){const x=p===0||p===3?h:g,w=p<2?m:d,y=t+i*x-r*w,A=e+r*x+i*w;y<a&&(a=y),y>l&&(l=y),A<c&&(c=A),A>f&&(f=A)}}n[0]=a,n[1]=c,n[2]=l,n[3]=f}}const ul=.004,hl=.02,kn=1e-7,dl=.22,ml=2.5;class pl{constructor(t,e){v(this,"nx",0);v(this,"ny",0);v(this,"count",0);v(this,"points",[to(),to()]);v(this,"friction");v(this,"bounce");v(this,"touched",!0);v(this,"k11",0);v(this,"k12",0);v(this,"k22",0);v(this,"i11",0);v(this,"i12",0);v(this,"i22",0);v(this,"block",!1);v(this,"h",1/120);v(this,"slop",ul);v(this,"spec",hl);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function to(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function gl(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?xl(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?eo(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?eo(o,e,t,!0):vl(o,t,e);for(let a=0;a<o.count;a+=1){const c=o.points[a];c.jn=0,c.jt=0;for(let l=0;l<r;l+=1)if(s[l]===c.id){c.jn=n[l],c.jt=i[l];break}}return o.count}function ii(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function xl(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,a=Math.hypot(i,r);if(a>s+n+o.spec)return;const c=a>1e-9?i/a:0,l=a>1e-9?r/a:1;o.nx=c,o.ny=l,ii(o,t.x+c*(s-(s+n-a)/2),t.y+l*(s-(s+n-a)/2),a-s-n,0)}function eo(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,a=0;for(let w=0;w<n.n;w+=1){const y=(e.x-t.wx[w])*t.wnx[w]+(e.y-t.wy[w])*t.wny[w];if(y>i+o.spec)return;y>r&&(r=y,a=w)}const c=(a+1)%n.n,l=t.wx[a],f=t.wy[a],u=t.wx[c],h=t.wy[c];let m,g,d,p,x;if(r<1e-9)m=t.wnx[a],g=t.wny[a],x=r-i,d=e.x-m*i,p=e.y-g*i;else{const w=(e.x-l)*(u-l)+(e.y-f)*(h-f),y=(e.x-u)*(l-u)+(e.y-h)*(f-h);if(w<=0||y<=0){const A=w<=0?l:u,F=w<=0?f:h,k=e.x-A,_=e.y-F,b=Math.hypot(k,_);if(b>i+o.spec)return;m=b>1e-9?k/b:t.wnx[a],g=b>1e-9?_/b:t.wny[a],x=b-i,d=A,p=F}else m=t.wnx[a],g=t.wny[a],x=r-i,d=e.x-m*i,p=e.y-g*i}o.nx=s?-m:m,o.ny=s?-g:g,ii(o,d,p,x,a)}function so(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const a=o.wnx[r],c=o.wny[r],l=o.wx[r],f=o.wy[r];let u=1/0;for(let h=0;h<s.n;h+=1){const m=(t.wx[h]-l)*a+(t.wy[h]-f)*c;m<u&&(u=m)}u>n&&(n=u,i=r)}return{sep:n,edge:i}}function vl(o,t,e){const s=so(t,e);if(s.sep>o.spec)return;const n=so(e,t);if(n.sep>o.spec)return;let i=t,r=e,a=s.edge,c=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,a=n.edge,c=!0);const l=i.shape,f=r.shape;if(l.kind!=="poly"||f.kind!=="poly")return;const u=(a+1)%l.n,h=i.wx[a],m=i.wy[a],g=i.wx[u],d=i.wy[u],p=i.wnx[a],x=i.wny[a];let w=1/0,y=0;for(let V=0;V<f.n;V+=1){const W=r.wnx[V]*p+r.wny[V]*x;W<w&&(w=W,y=V)}const A=(y+1)%f.n;let F=r.wx[y],k=r.wy[y],_=r.wx[A],b=r.wy[A],M=y,S=A;const P=Math.hypot(g-h,d-m)||1,T=(g-h)/P,O=(d-m)/P,L=T*h+O*m,I=T*g+O*d;for(const[V,W]of[[-1,-L],[1,I]]){const N=V*(T*F+O*k)-W,Y=V*(T*_+O*b)-W;if(N>kn&&Y>kn)return;if(N>kn){const J=N/(N-Y);F+=(_-F)*J,k+=(b-k)*J,M=200+a}else if(Y>kn){const J=N/(N-Y);_=F+(_-F)*J,b=k+(b-k)*J,S=300+a}}const B=(c?1e4:0)+a*1e3,D=(F-h)*p+(k-m)*x,R=(_-h)*p+(b-m)*x;o.nx=c?-p:p,o.ny=c?-x:x,D<=o.spec&&ii(o,F-p*D/2,k-x*D/2,D,B+M),R<=o.spec&&ii(o,_-p*R/2,b-x*R/2,R,B+S)}function yl(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,a=-n;for(let c=0;c<o.count;c+=1){const l=o.points[c];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const f=l.rax*i-l.ray*n,u=l.rbx*i-l.rby*n,h=e.invM+s.invM+e.invI*f*f+s.invI*u*u;l.massN=h>0?1/h:0;const m=l.rax*a-l.ray*r,g=l.rbx*a-l.rby*r,d=e.invM+s.invM+e.invI*m*m+s.invI*g*g;l.massT=d>0?1/d:0,l.bias=l.sep>0?-l.sep/t:Math.min(ml,dl/t*Math.max(0,-l.sep-o.slop));const p=s.vx-s.w*l.rby-e.vx+e.w*l.ray,x=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,w=p*n+x*i;l.bounce=w<-.6&&(l.sep<=o.slop||l.sep+w*t<0)?-o.bounce*w:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const c=o.points[0],l=o.points[1],f=c.rax*i-c.ray*n,u=c.rbx*i-c.rby*n,h=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,g=e.invM+s.invM;o.k11=g+e.invI*f*f+s.invI*u*u,o.k22=g+e.invI*h*h+s.invI*m*m,o.k12=g+e.invI*f*h+s.invI*u*m;const d=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*d&&d>0&&(o.block=!0,o.i11=o.k22/d,o.i12=-o.k12/d,o.i22=o.k11/d)}}function wl(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];hn(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function bl(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,f=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,u=l*i+f*r,h=o.friction*c.jn,m=Math.max(-h,Math.min(h,c.jt-c.massT*u)),g=m-c.jt;c.jt=m,hn(t,e,g*i,g*r,c)}if(o.block){Fl(o);return}for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,f=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,u=l*s+f*n;c.bounce===0&&o.bounce>=.5&&u<-.6&&(c.sep<=o.slop||c.sep+u*o.h<0)&&(c.bounce=-o.bounce*u);const h=Math.max(c.jn+c.massN*(-u+ir(c)),c.fixed),m=h-c.jn;c.jn=h,hn(t,e,m*s,m*n,c),c.bounce>0&&(c.fixed=h,c.bounce=-1,c.kicked=!0)}}const ir=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function hn(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function Fl(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],a=d=>{const p=e.vx-e.w*d.rby-t.vx+t.w*d.ray,x=e.vy+e.w*d.rbx-t.vy-t.w*d.rax;return p*s+x*n},c=i.jn,l=r.jn,f=a(i)-ir(i)-(o.k11*c+o.k12*l),u=a(r)-ir(r)-(o.k12*c+o.k22*l),h=(d,p)=>{const x=d-c,w=p-l;hn(t,e,x*s,x*n,i),hn(t,e,w*s,w*n,r),i.jn=d,r.jn=p};let m=-(o.i11*f+o.i12*u),g=-(o.i12*f+o.i22*u);if(m>=0&&g>=0){h(m,g);return}if(m=-f/o.k11,g=0,m>=0&&o.k12*m+u>=0){h(m,g);return}if(m=0,g=-u/o.k22,g>=0&&o.k12*g+f>=0){h(m,g);return}f>=0&&u>=0&&h(0,0)}const Al=10,Hs={friction:.5,bounce:.1},_l=.01;function He(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),a=new Float64Array([-1,0,1,0]);let c=0;for(let l=0;l<4;l+=1)c=Math.max(c,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:a,n:4,radius:c}}class us{constructor(t,e,s,n){v(this,"wx");v(this,"wy");v(this,"wnx");v(this,"wny");v(this,"minX",0);v(this,"minY",0);v(this,"maxX",0);v(this,"maxY",0);v(this,"invM",0);v(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let a=1/0,c=1/0,l=-1/0,f=-1/0;for(let u=0;u<t.n;u+=1){const h=s+i*t.xs[u]-r*t.ys[u],m=n+r*t.xs[u]+i*t.ys[u];this.wx[u]=h,this.wy[u]=m,this.wnx[u]=i*t.nx[u]-r*t.ny[u],this.wny[u]=r*t.nx[u]+i*t.ny[u],h<a&&(a=h),h>l&&(l=h),m<c&&(c=m),m>f&&(f=m)}this.minX=a,this.minY=c,this.maxX=l,this.maxY=f}}class kl{constructor(t){v(this,"parts",[]);v(this,"byBody",[]);v(this,"builtFor",-1);v(this,"warmKey",new Float64Array(0));v(this,"warmData",new Float64Array(0));v(this,"warmCount",0);v(this,"touching",new Uint8Array(0));v(this,"toWake",[]);v(this,"cache",new Map);v(this,"live",[]);v(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,a]=t.bounds(s);e[s].shape=He(n,i,r,a),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new us(1,null,He(-1,-1,0,r+1),Hs)),s.openR||n.push(new us(2,null,He(i,-1,i+1,r+1),Hs)),s.openB||n.push(new us(3,null,He(-1,-1,i+1,0),Hs)),s.openT||n.push(new us(4,null,He(-1,r,i+1,r+1),Hs));const{nx:a,ny:c,dx:l}=s;let f=new Map,u=10;for(let h=0;h<=c;h+=1){const m=new Map;if(h<c){let g=0;for(;g<a;){const d=g+h*a;if(s.solid[d]===0||s.owner[d]!==0){g+=1;continue}const p=s.solid[d];let x=g;for(;x+1<a&&s.solid[x+1+h*a]===p&&s.owner[x+1+h*a]===0;)x+=1;const w=p<<24|g<<12|x;m.set(w,f.has(w)?f.get(w):h),g=x+1}}for(const[g,d]of f){if(m.get(g)===d)continue;const p=this.solidMaterial(g>>>24);n.push(new us(u++,null,He((g>>12&4095)*l,d*l,((g&4095)+1)*l,h*l),p))}f=m}this.byBody=t.map(()=>[]);for(const h of t){if(h.gone)continue;const m=this.solidMaterial(h.mat+1);for(let g=0;g<h.nr;g+=1){const[d,p,x,w]=h.bounds(g),y=He(d,p,x,w),A=new us(1e5+h.index*1e3+g,h,y,m);n.push(A),this.byBody[h.index].push(A)}}for(const h of n)h.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=ut[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:Hs}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const f of this.parts){const u=f.body;if(u===null)continue;const h=u.awake;f.invM=h?1/u.m:0,f.invI=h?1/u.I:0,f.update()}for(const f of this.cache.values())f.touched=!1;const r=this.live,a=this.liveKey;r.length=0,a.length=0;const c=this.parts;for(let f=0;f<c.length;f+=1){const u=c[f];for(let h=f+1;h<c.length;h+=1){const m=c[h],g=u.invM>0,d=m.invM>0;if(!g&&!d||u.body!==null&&u.body===m.body||m.minX>u.maxX+i||m.maxX<u.minX-i||m.minY>u.maxY+i||m.maxY<u.minY-i)continue;const p=u.id*1e6+m.id;let x=this.cache.get(p);x===void 0&&(x=new pl(u,m),x.slop=n,x.spec=i,this.restore(x,p),this.cache.set(p,x)),x.touched=!0,gl(x)>0?(r.push(x),a.push(p)):x.count=0}}const l=a.map((f,u)=>u).sort((f,u)=>a[f]-a[u]);for(const f of l)yl(r[f],t);for(const f of l)wl(r[f]);for(let f=0;f<Al;f+=1)for(const u of l)bl(r[u]);for(const f of l){const u=r[f],h=u.a.body,m=u.b.body;if(h!==null&&(this.touching[h.index]=1),m!==null&&(this.touching[m.index]=1),h!==null&&m!==null&&h.asleep!==m.asleep&&!h.pinned&&!m.pinned){const g=h.asleep?m:h,d=h.asleep?h:m;g.speed()>_l&&this.toWake.push(d.index)}}for(const[f,u]of this.cache)(!u.touched||u.count===0)&&this.cache.delete(f);this.save(l.map(f=>a[f]),l.map(f=>r[f]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let a=0;a<2;a+=1){const c=i.points[a];this.warmData[r+1+4*a]=c.id,this.warmData[r+2+4*a]=c.jn,this.warmData[r+3+4*a]=c.jt,this.warmData[r+4+4*a]=c.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const a=9*i;t.count=this.warmData[a];for(let c=0;c<2;c+=1){const l=t.points[c];l.id=this.warmData[a+1+4*c],l.jn=this.warmData[a+2+4*c],l.jt=this.warmData[a+3+4*c],l.kicked=this.warmData[a+4+4*c]===1}return}r<e?s=i+1:n=i-1}}}const ye=new Float64Array(16),we=new Float64Array(16),Mn=new Float64Array(16),Pn=new Float64Array(16);function Tn(o,t,e,s,n,i,r,a){let c=0;for(let l=0;l<o;l+=1){const f=(l+1)%o,u=s*((t===0?n[l]:i[l])-e),h=s*((t===0?n[f]:i[f])-e);if(u<=0&&(r[c]=n[l],a[c]=i[l],c+=1),u<0&&h>0||u>0&&h<0){const m=u/(u-h);r[c]=n[l]+m*(n[f]-n[l]),a[c]=i[l]+m*(i[f]-i[l]),c+=1}}return c}function Ml(o,t,e,s,n,i,r,a,c,l,f,u){ye[0]=o,we[0]=t,ye[1]=e,we[1]=s,ye[2]=n,we[2]=i,ye[3]=r,we[3]=a;let h=Tn(4,0,c,-1,ye,we,Mn,Pn);if(h===0||(h=Tn(h,0,f,1,Mn,Pn,ye,we),h===0)||(h=Tn(h,1,l,-1,ye,we,Mn,Pn),h===0)||(h=Tn(h,1,u,1,Mn,Pn,ye,we),h<3))return 0;let m=0;for(let g=0;g<h;g+=1){const d=(g+1)%h;m+=ye[g]*we[d]-ye[d]*we[g]}return Math.abs(.5*m)}function rr(o,t,e,s,n,i,r,a,c){const l=e-o,f=s-t;return ue[0]=0,ue[1]=1,!Sn(-l,o-n)||!Sn(l,r-o)||!Sn(-f,t-i)||!Sn(f,a-t)?(c[0]=1,c[1]=0,0):(c[0]=ue[0],c[1]=ue[1],Math.max(0,ue[1]-ue[0]))}const ue=new Float64Array(2);function Sn(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>ue[1])return!1;e>ue[0]&&(ue[0]=e)}else{if(e<ue[0])return!1;e<ue[1]&&(ue[1]=e)}return!0}const Pi=new Float64Array(2),Cn=new Float64Array(16);function Pl(o,t,e,s,n,i,r,a,c,l,f){const u=Math.cos(e),h=Math.sin(e);let m=0;for(let p=0;p<4;p+=1){const x=p===0?a:p===1||p===2?l:a,w=p===0||p===1?c:f,y=p===0||p===1?l:a,A=p===0?c:p===1||p===2?f:c,F=u*(x-o)+h*(w-t),k=-h*(x-o)+u*(w-t),_=u*(y-o)+h*(A-t),b=-h*(y-o)+u*(A-t);rr(F,k,_,b,s,n,i,r,Pi)<=0||(Cn[2*m]=p+Pi[0],Cn[2*m+1]=p+Pi[1],m+=1)}if(m<2)return!1;const g=1e-9;let d=m;for(let p=0;p<m;p+=1){const x=(p+1)%m,w=Cn[2*p+1],y=Cn[2*x]+(x===0?4:0);Math.abs(y-w)<=g&&(d-=1)}return d>=2}function Tl(o,t,e){const s=[],n=[];for(const d of o)s.push(d[0],d[2]),n.push(d[1],d[3]);for(const d of t)s.push(d.x0,d.x1),n.push(d.y0,d.y1);for(const d of e)s.push(d.x0,d.x1),n.push(d.y0,d.y1);const i=no(s),r=no(n),a=i.length-1,c=r.length-1,l=new Uint8Array(Math.max(0,a*c)),f=[],u=[],h=(d,p,x,w,y,A)=>d>x&&d<y&&p>w&&p<A;for(let d=0;d<c;d+=1){const p=.5*(r[d]+r[d+1]);for(let x=0;x<a;x+=1){const w=.5*(i[x]+i[x+1]);let y=!1;for(const F of o)if(h(w,p,F[0],F[1],F[2],F[3])){y=!0;break}let A=-1;if(y){for(const F of t)if(h(w,p,F.x0,F.y0,F.x1,F.y1)){A=F.move;break}A>=0?f.push(i[x],r[d],i[x+1],r[d+1],A):l[x+d*a]=1}else{for(const F of e)if(h(w,p,F.x0,F.y0,F.x1,F.y1)){A=F.move;break}A>=0&&(u.push(i[x],r[d],i[x+1],r[d+1],A),l[x+d*a]=1)}}}const m=[];let g=[];for(let d=0;d<=c;d+=1){const p=[];if(d<c)for(let x=0;x<a;){if(l[x+d*a]===0){x+=1;continue}let w=x;for(;w<a&&l[w+d*a]!==0;)w+=1;const y=g.find(A=>A.i0===x&&A.i1===w);p.push(y??{i0:x,i1:w,y0:r[d]}),x=w}for(const x of g)p.includes(x)||m.push([i[x.i0],x.y0,i[x.i1],r[d]]);g=p}return{rects:m,taken:f,added:u}}function no(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const Sl=.99,io=.5,Cl=.02;class Ll{constructor(t){v(this,"w");v(this,"esSync");v(this,"filmSync");v(this,"crustSync");v(this,"wsum");v(this,"best");v(this,"acc");v(this,"split");v(this,"was");v(this,"now");v(this,"stamp");v(this,"fstamp");v(this,"tag",0);v(this,"ftag",0);v(this,"seen");v(this,"queue");v(this,"seenTag",0);v(this,"list",new Int32Array(256));v(this,"listN",0);v(this,"box",new Float64Array(4));v(this,"l0",new Float64Array(2));v(this,"l1",new Float64Array(2));v(this,"wp",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"cb",new Float64Array(4));v(this,"areaK",[]);v(this,"capK",[]);v(this,"splits",[]);v(this,"boxes",new Float64Array(64));v(this,"nx",0);v(this,"ny",0);v(this,"faceOwner");v(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const g=new Float64Array(8*(t.index+1));g.set(this.boxes),this.boxes=g}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let a=this.areaK[t.index],c=this.capK[t.index];(a===void 0||a.length!==t.ncell)&&(a=new Float64Array(t.ncell),c=new Float64Array(t.ncell),this.areaK[t.index]=a,this.capK[t.index]=c);for(let g=0;g<t.ncell;g+=1)a[g]=t.cellVolume(g)/t.depth,c[g]=t.cellCap(g);const l=Math.cos(t.a),f=Math.sin(t.a);let u=0;const h=this.cb,m=[];for(let g=0;g<t.ncell;g+=1){t.cellBox(g,h);const d=h[0],p=h[1],x=h[2],w=h[3],y=t.x+l*d-f*p,A=t.y+f*d+l*p,F=t.x+l*x-f*p,k=t.y+f*x+l*p,_=t.x+l*x-f*w,b=t.y+f*x+l*w,M=t.x+l*d-f*w,S=t.y+f*d+l*w,P=Math.max(0,Math.floor(Math.min(y,F,_,M)/i)),T=Math.min(s-1,Math.floor(Math.max(y,F,_,M)/i)),O=Math.max(0,Math.floor(Math.min(A,k,b,S)/i)),L=Math.min(n-1,Math.floor(Math.max(A,k,b,S)/i));for(let I=O;I<=L;I+=1)for(let B=P;B<=T;B+=1){const D=B+I*s;if(e.solid[D]!==0&&e.owner[D]===0)continue;const R=Ml(y,A,F,k,_,b,M,S,B*i,I*i,(B+1)*i,(I+1)*i);R<=1e-12*a[g]||(u>=t.wk.length&&this.growWeights(t,2*u+64),t.wk[u]=g,t.wc[u]=D,t.ww[u]=R/a[g],u+=1)}}t.nw=u;for(let g=0;g<t.nr;g+=1){const d=t.xs[g][0],p=t.ys[g][0],x=t.xs[g][t.ni[g]],w=t.ys[g][t.nj[g]];let y=1/0,A=1/0,F=-1/0,k=-1/0;for(let P=0;P<4;P+=1){const T=P===0||P===3?d:x,O=P<2?p:w,L=t.x+l*T-f*O,I=t.y+f*T+l*O;y=Math.min(y,L),F=Math.max(F,L),A=Math.min(A,I),k=Math.max(k,I)}const _=Math.max(0,Math.floor(y/i)),b=Math.min(s-1,Math.floor(F/i)),M=Math.max(0,Math.floor(A/i)),S=Math.min(n-1,Math.floor(k/i));for(let P=M;P<=S;P+=1)for(let T=_;T<=b;T+=1)Pl(t.x,t.y,t.a,d,p,x,w,T*i,P*i,(T+1)*i,(P+1)*i)&&m.push(T+P*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const a=this.list[r],c=a%t,l=(a-c)/t;c<e&&(e=c),c>n&&(n=c),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,a=this.list,c=this.listN;if(this.listN=0,c===0)return 0;const l=1/(i*i);let f=s,u=-1,h=n,m=-1;for(let F=0;F<c;F+=1){const k=a[F],_=k%s,b=(k-_)/s;_<f&&(f=_),_>u&&(u=_),b<h&&(h=b),b>m&&(m=b);const M=e.solid[k]!==0&&e.owner[k]===0;this.was[k]=e.solid[k]!==0&&e.owner[k]!==0?1:0,e.fs[k]=0,e.capB[k]=0,this.wsum[k]=0,this.best[k]=0,this.split[k]=0,e.matB[k]=0,M||(e.Es[k]=0,e.film[k]=0,e.crust[k]=0,e.owner[k]=0)}const g=f*i,d=h*i,p=(u+1)*i,x=(m+1)*i;for(const F of t){if(F.gone||F.nw===0)continue;const k=this.boxOf(F);if(k[0]>p||k[2]<g||k[1]>x||k[3]<d)continue;const _=this.areaK[F.index],b=this.capK[F.index],M=this.acc;for(let P=0;P<F.nw;P+=1){const T=F.wc[P];if(this.stamp[T]!==r)continue;const O=F.wk[P],L=F.ww[P],I=L*_[O]*l;e.fs[T]+=I,M[T]+=I,e.capB[T]+=L*b[O],e.Es[T]+=L*F.E[O],e.film[T]+=L*F.film[O],e.crust[T]+=L*F.crust[O],this.wsum[T]+=L}for(let P=0;P<F.nw;P+=1){const T=F.wc[P];this.stamp[T]!==r||M[T]===0||(M[T]>this.best[T]&&(this.best[T]=M[T],e.owner[T]=F.index+1,e.matB[T]=F.mat+1),M[T]=0)}const S=this.splits[F.index];for(let P=0;P<S.length;P+=1)this.stamp[S[P]]===r&&(this.split[S[P]]=1)}const w=++this.ftag;for(let F=0;F<c;F+=1){const k=a[F],_=k%s,b=(k-_)/s;this.face(t,_,b,!0,w),this.face(t,_+1,b,!0,w),this.face(t,_,b,!1,w),this.face(t,_,b+1,!1,w)}for(let F=0;F<c;F+=1){const k=a[F];e.fs[k]>1&&(e.fs[k]=1);const _=e.solid[k]!==0&&e.owner[k]===0&&this.was[k]===0;this.now[k]=!_&&e.owner[k]!==0&&(e.fs[k]>=Sl||this.split[k]!==0)?1:0}for(let F=0;F<c;F+=1){const k=a[F];this.now[k]!==0||e.owner[k]===0||e.fs[k]<io||e.solid[k]!==0&&this.was[k]===0||this.besideOther(k)&&(this.now[k]=1)}let y=0;for(let F=0;F<c;F+=1){const k=a[F];if(this.now[k]===1){this.was[k]===0&&(y+=1,this.gasOut(k));const _=t[e.owner[k]-1];e.solid[k]=_.mat+1,e.kind[k]=ft,e.role[k]=0,e.heater[k]=-1}else this.was[k]===1&&(y+=1,e.solid[k]=0,e.role[k]=0,e.heater[k]=-1,this.vacate(k))}const A=this.w.heat;for(let F=0;F<c;F+=1){const k=a[F];this.esSync[k]=e.Es[k],this.filmSync[k]=e.film[k],this.crustSync[k]=e.crust[k],e.capB[k]>0&&A.deriveSolid(k)}return y}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,a=e.owner[t];for(let c=0;c<4;c+=1){const l=i+(c===0?-1:c===1?1:0),f=r+(c===2?-1:c===3?1:0);if(l<0||f<0||l>=s||f>=n){if(l<0?!e.openL:l>=s?!e.openR:f<0?!e.openB:!e.openT)return!0;continue}const u=l+f*s;if(e.solid[u]!==0&&e.owner[u]===0||e.owner[u]!==0&&e.owner[u]!==a&&(e.solid[u]!==0||e.fs[u]>=io))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:a,ny:c,dx:l}=r;if(n?e>a||s>=c:e>=a||s>c)return;const f=n?e+s*(a+1):e+s*a,u=n?f:r.nu+f;if(this.fstamp[u]===i)return;this.fstamp[u]=i;const h=e*l,m=s*l,g=n?h:h+l,d=n?m+l:m;let p=0,x=0,w=0,y=0;const A=this.l0,F=this.l1;for(const b of t){if(b.gone||b.nw===0)continue;const M=this.boxOf(b);if(M[0]>Math.max(h,g)||M[2]<Math.min(h,g)||M[1]>Math.max(m,d)||M[3]<Math.min(m,d))continue;Rt.toLocal(b.x,b.y,b.a,h,m,A),Rt.toLocal(b.x,b.y,b.a,g,d,F);let S=0;for(let P=0;P<b.nr;P+=1){const T=b.xs[P][0],O=b.ys[P][0],L=b.xs[P][b.ni[P]],I=b.ys[P][b.nj[P]];S+=rr(A[0],A[1],F[0],F[1],T,O,L,I,this.seg)}if(!(S<=0)&&(p+=S,S>x)){x=S,y=b.index+1;const P=.5*(h+g),T=.5*(m+d);w=n?b.vx-b.w*(T-b.y):b.vy+b.w*(P-b.x)}}const k=p>=1-1e-9?0:Math.max(0,1-p);(n?r.au[f]:r.av[f])>0!=k>0&&(this.topologyChanged=!0),this.faceOwner[u]=y,n?(r.au[f]=k,r.usol[f]=p>0?w:0):(r.av[f]=k,r.vsol[f]=p>0?w:0)}collect(t){const e=this.w.grid;for(const s of t){if(s.gone||s.nw===0)continue;const n=this.capK[s.index],i=Si(0,s.ncell),r=Si(1,s.ncell),a=Si(2,s.ncell);let c=!1;for(let l=0;l<s.nw;l+=1){const f=s.wc[l],u=s.wk[l],h=s.ww[l],m=e.Es[f]-this.esSync[f];m!==0&&e.capB[f]>0&&(i[u]+=m*h*n[u]/e.capB[f],c=!0);const g=e.film[f]-this.filmSync[f];g>0&&this.wsum[f]>0?(r[u]+=g*h/this.wsum[f],c=!0):g<0&&this.filmSync[f]>0&&(r[u]+=g*h*s.film[u]/this.filmSync[f],c=!0);const d=e.crust[f]-this.crustSync[f];d>0&&this.wsum[f]>0?(a[u]+=d*h/this.wsum[f],c=!0):d<0&&this.crustSync[f]>0&&(a[u]+=d*h*s.crust[u]/this.crustSync[f],c=!0)}if(c)for(let l=0;l<s.ncell;l+=1)s.E[l]+=i[l],s.film[l]=Math.max(0,s.film[l]+r[l]),s.crust[l]=Math.max(0,s.crust[l]+a[l])}for(let s=0;s<e.n;s+=1)e.capB[s]<=0||(this.esSync[s]=e.Es[s],this.filmSync[s]=e.film[s],this.crustSync[s]=e.crust[s])}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,a=this.w.bubbles,c=this.box;t.worldBox(t.x,t.y,t.a,c);const l=2*i.dx;for(let f=0;f<r.count;f+=1){const u=r.x[f],h=r.y[f];u<c[0]-l||u>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(r.x[f]=this.wp[0],r.y[f]=this.wp[1],this.stopInto(t,r.vx,r.vy,f))}for(let f=0;f<a.count;f+=1){const u=a.x[f],h=a.y[f];u<c[0]-l||u>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(a.x[f]=this.wp[0],a.y[f]=this.wp[1],a.site[f]=-1,this.stopInto(t,a.vx,a.vy,f))}}hit(t,e,s,n,i,r){const a=2*this.w.grid.dx;let c=0,l=n,f=i;for(let u=0;u<3;u+=1){let h=!1;for(const m of t){if(m.gone||m.nw===0)continue;const g=this.boxOf(m);Math.max(l,e)<g[0]-a||Math.min(l,e)>g[2]+a||Math.max(f,s)<g[1]-a||Math.min(f,s)>g[3]+a||this.moveOut(m,l,f,e,s,m.x,m.y,m.a)&&(l=this.wp[0],f=this.wp[1],r[0]=l,r[1]=f,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(f-m.y),r[5]=m.vy+m.w*(l-m.x),c=1,h=!0)}if(!h)break}return c}moveOut(t,e,s,n,i,r,a,c){const l=this.l1,f=this.l0;Rt.toLocal(t.x,t.y,t.a,e,s,l),Rt.toLocal(r,a,c,n,i,f);const u=Cl*this.w.grid.dx;let h=1/0,m=-1,g=l[0],d=l[1];for(let b=0;b<t.nr;b+=1){const M=t.xs[b][0],S=t.ys[b][0],P=t.xs[b][t.ni[b]],T=t.ys[b][t.nj[b]],O=M-u,L=S-u,I=P+u,B=T+u,D=l[0]>O&&l[0]<I&&l[1]>L&&l[1]<B;if(rr(f[0],f[1],l[0],l[1],O,L,I,B,this.seg)<=0&&!D)continue;if(f[0]>O&&f[0]<I&&f[1]>L&&f[1]<B){if(D&&h===1/0){const V=ro(l[0]-O,I-l[0],l[1]-L,B-l[1]);m=V,g=V===0?O:V===1?I:l[0],d=V===2?L:V===3?B:l[1],h=2}}else{const V=this.seg[0];if(V<h){h=V;const W=f[0]+V*(l[0]-f[0]),N=f[1]+V*(l[1]-f[1]),Y=ro(Math.abs(W-O),Math.abs(W-I),Math.abs(N-L),Math.abs(N-B));m=Y,g=Y===0?O:Y===1?I:W,d=Y===2?L:Y===3?B:N}}}if(m<0)return!1;const p=this.w.grid,x=1e-4*p.dx,w=Math.cos(t.a),y=Math.sin(t.a),A=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,k=g+A*x,_=d+F*x;return this.wp[0]=Math.min(p.w-x,Math.max(x,t.x+w*k-y*_)),this.wp[1]=Math.min(p.h-x,Math.max(x,t.y+y*k+w*_)),this.nx=w*A-y*F,this.ny=y*A+w*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,a=t.vx-t.w*r,c=t.vy+t.w*i,l=(e[n]-a)*this.nx+(s[n]-c)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,a=(t-r)/n,c=p=>(this.stamp[p]===this.tag?this.now[p]===0:e.solid[p]===0)&&!(e.solid[p]!==0&&e.owner[p]===0);let l=0,f=0;for(let p=0;p<4;p+=1){const x=s.across(t,r,a,p);x<0||!c(x)||(l+=s.vgas[x]>0?s.vgas[x]:e.vCell,f+=1)}if(f>0){let p=l;for(let x=0;x<4;x+=1){const w=s.across(t,r,a,x);if(w<0||!c(w))continue;const y=s.vgas[w]>0?s.vgas[w]:e.vCell;f-=1,s.move(t,w,f===0?1:Math.min(1,y/p)),p-=y}return}const u=this.seen,h=this.queue;let m=++this.seenTag,g=0,d=0;for(h[d++]=t,u[t]=m;g<d;){const p=h[g++];if(p!==t&&c(p)){s.move(t,p,1);return}const x=p%n,w=(p-x)/n;for(let y=0;y<4;y+=1){const A=s.across(p,x,w,y);A<0||u[A]===m||e.solid[A]!==0&&e.owner[A]===0||(u[A]=m,h[d++]=A)}}for(m=++this.seenTag,g=0,d=0,h[d++]=t,u[t]=m;g<d;){const p=h[g++];if(p!==t&&c(p)){s.move(t,p,1);return}const x=p%n,w=(p-x)/n;for(let y=0;y<4;y+=1){const A=x+(y===0?-1:y===1?1:0),F=w+(y===2?-1:y===3?1:0);if(A<0||F<0||A>=n||F>=i)continue;const k=A+F*n;u[k]!==m&&(u[k]=m,h[d++]=k)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let a=0,c=0,l=0,f=!1;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||(e.kind[m]===et&&(f=!0),e.kind[m]!==H||s.massOf(m)<=0))continue;const g=s.vgas[m]>0?s.vgas[m]:e.vCell;a+=g,c+=g*s.rho[m],l+=g*e.T[m]}if(a<=0){e.kind[t]=f?et:H,s.deriveCell(t);return}e.kind[t]=H,e.T[t]=l/a;const u=c/a*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||e.kind[m]!==H)continue;const g=s.massOf(m);if(g<=0)continue;const d=(s.vgas[m]>0?s.vgas[m]:e.vCell)/a;s.move(m,t,Math.min(.25,u*d/g))}s.deriveCell(t)}}function ro(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const Ti=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function Si(o,t){Ti[o].length<t&&(Ti[o]=new Float64Array(2*t));const e=Ti[o];return e.fill(0,0,t),e}const Ol=1.5,Bl=1;class jl{constructor(t){v(this,"pe");v(this,"re");v(this,"known");v(this,"mass");v(this,"vol");v(this,"out",new Float64Array(3));v(this,"front");v(this,"next");v(this,"vp");v(this,"vr");v(this,"queued");v(this,"tag",0);v(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:a,ny:c,n:l,dx:f}=e,{pe:u,re:h,known:m,mass:g,vol:d}=this;g.fill(0),d.fill(0);for(let b=0;b<s.count;b+=1){const M=e.cellAt(s.x[b],s.y[b]);M<0||(g[M]+=s.mass[b],d[M]+=s.mass[b]/s.rho[b])}for(let b=0;b<l;b+=1){const M=e.kind[b];M===et?(u[b]=e.pl[b],h[b]=d[b]>0?g[b]/d[b]:n.rhoRef,m[b]=1):M===H&&e.solid[b]===0?(u[b]=n.pGas[b]+e.pg[b],h[b]=i.rho[b]>0?i.rho[b]:r.rhoAmb,m[b]=1):(u[b]=0,h[b]=0,m[b]=0)}const p=t.gy*f,x=this.front,w=this.next,y=this.vp,A=this.vr,F=this.queued,k=++this.tag;let _=0;for(let b=0;b<l;b+=1){if(m[b]!==0)continue;const M=b%a,S=(b-M)/a;(M>0&&m[b-1]===1||M<a-1&&m[b+1]===1||S>0&&m[b-a]===1||S<c-1&&m[b+a]===1)&&(x[_++]=b,F[b]=k)}for(;_>0;){for(let M=0;M<_;M+=1){const S=x[M],P=S%a,T=(S-P)/a;let O=0,L=0,I=0;P>0&&m[S-1]!==0&&(O+=u[S-1],L+=h[S-1],I+=1),P<a-1&&m[S+1]!==0&&(O+=u[S+1],L+=h[S+1],I+=1),T>0&&m[S-a]!==0&&(O+=u[S-a]-h[S-a]*p,L+=h[S-a],I+=1),T<c-1&&m[S+a]!==0&&(O+=u[S+a]+h[S+a]*p,L+=h[S+a],I+=1),y[M]=I>0?O/I:0,A[M]=I>0?L/I:0}let b=0;for(let M=0;M<_;M+=1){const S=x[M];u[S]=y[M],h[S]=A[M],m[S]=2}for(let M=0;M<_;M+=1){const S=x[M],P=S%a,T=(S-P)/a;for(let O=0;O<4;O+=1){const L=P+(O===0?-1:O===1?1:0),I=T+(O===2?-1:O===3?1:0);if(L<0||I<0||L>=a||I>=c)continue;const B=L+I*a;m[B]!==0||F[B]===k||(F[B]=k,w[b++]=B)}}_=b;for(let M=0;M<b;M+=1)x[M]=w[M]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,a=Math.min(n-1.0001,Math.max(0,t/r-.5)),c=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(a),f=Math.floor(c),u=a-l,h=c-f;let m=0,g=0;for(let d=0;d<2;d+=1)for(let p=0;p<2;p+=1){const x=l+p+(f+d)*n;if(this.known[x]===0)continue;const w=(p===0?1-u:u)*(d===0?1-h:h);m+=w*this.pe[x],g+=w}return g>0?m/g:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,a=0,c=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),u=Math.max(1,Math.ceil(f/(.5*t.dx))),h=f/u*t.depth,m=s*i[4]-n*i[5],g=n*i[4]+s*i[5];for(let d=0;d<u;d+=1){const p=(d+.5)/u,x=i[0]+p*(i[2]-i[0]),w=i[1]+p*(i[3]-i[1]),y=s*x-n*w,A=n*x+s*w,F=this.sideAt(t.x+y,t.y+A,m,g)*h;r-=F*m,a-=F*g,c-=F*(y*g-A*m)}}return e[0]=r,e[1]=a,e[2]=c,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:a}=r,c=t+.5*a*s,l=e+.5*a*n,f=Math.min(r.nx-1.0001,Math.max(0,c/a-.5)),u=Math.min(r.ny-1.0001,Math.max(0,l/a-.5)),h=Math.floor(f),m=Math.floor(u),g=f-h,d=u-m;let p=0,x=0,w=0,y=0;for(let A=0;A<2;A+=1)for(let F=0;F<2;F+=1){const k=h+F,_=m+A,b=k+_*r.nx;if(this.known[b]!==1)continue;const M=(k+.5)*a,S=(_+.5)*a;if((M-t)*s+(S-e)*n<=0)continue;const P=(F===0?1-g:g)*(A===0?1-d:d)+1e-6,T=this.pe[b]+this.re[b]*i.gy*(S-e);r.kind[b]===et?(p+=P*T,x+=P):(w+=P*T,y+=P)}return x>0&&y>0?Math.max(p/x,w/y):x>0?p/x:y>0?w/y:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let a=0,c=0;for(let u=0;u<t.nseg;u+=1){t.segment(u,r);const h=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(h/t.dx));for(let g=0;g<m;g+=1){const d=(g+.5)/m,p=r[0]+d*(r[2]-r[0])+.5*t.dx*r[4],x=r[1]+d*(r[3]-r[1])+.5*t.dx*r[5],w=s.cellAt(t.x+n*p-i*x,t.y+i*p+n*x);c+=h/m,w>=0&&s.kind[w]===et&&(a+=h/m)}}const l=c>0?a/c:0,f=e.liquid.rhoRef;t.ma=Ol*f*l*t.hullA*t.depth,t.Ia=Bl*f*l*t.hullJ*t.depth}}const ql=.1,Il=1,Rl=.002,El=.5,Dl=1.02,Vl=.5;class Nl{constructor(t){v(this,"list",[]);v(this,"cover");v(this,"forces");v(this,"contacts");v(this,"version",0);v(this,"prev",new Float64Array(0));v(this,"awakeNow",0);v(this,"shapes",!1);v(this,"resized",!1);v(this,"afterCollect",null);v(this,"dv",new Float64Array(3));v(this,"probeS",[]);v(this,"probeJ",[]);v(this,"m9",new Float64Array(9));v(this,"at",new Float64Array(2));this.e=t,this.cover=new Ll(t),this.forces=new jl(()=>t),this.contacts=new kl(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const a=this.e.grid,c=Rt.fromRects(this.list.length,n,a.dx,a.depth,e,t,s,r);return c.gone?null:(c.pinned=i,c.asleep=!0,this.list.push(c),this.grow(),this.cover.weigh(c),this.cover.addCells(c),this.changed(),c)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list)e.awake&&(this.awakeNow+=1,t=!0,this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e));if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a,e.ux=e.vx,e.uy=e.vy,e.uw=e.w);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>Dl*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),a=3*i.index,c=i.ma6;i.maOk||(this.forces.addedMass(i),c.fill(0),c[0]=i.ma,c[3]=i.ma,c[5]=i.Ia);const l=t*r[0]+c[0]*n[a]+c[1]*n[a+1]+c[2]*n[a+2],f=t*(r[1]-i.m*e.gy)+c[1]*n[a]+c[3]*n[a+1]+c[4]*n[a+2],u=t*r[2]+c[2]*n[a]+c[4]*n[a+1]+c[5]*n[a+2];Ul(i.m+c[0],c[1],c[2],i.m+c[3],c[4],i.I+c[5],l,f,u,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[a]=this.dv[0],n[a+1]=this.dv[1],n[a+2]=this.dv[2]}this.contacts.step(t,this.list,this.version,ql*s.dx,Il*s.dx);for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<Rl&&this.contacts.touches(i)?i.rest+t:0,i.rest>=El&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:a,dx:c,depth:l}=i,f=this.cover.faceOwner;for(const u of this.list){if(!u.awake)continue;const h=u.index+1,m=this.probeS,g=this.probeJ;m.length=0,g.length=0;const d=this.cover.boxOf(u),p=Math.max(0,Math.floor(d[0]/c)-1),x=Math.min(r,Math.floor(d[2]/c)+2),w=Math.max(0,Math.floor(d[1]/c)-1),y=Math.min(a,Math.floor(d[3]/c)+2);for(let _=w;_<Math.min(a,y);_+=1)for(let b=p;b<=x;b+=1){const M=b+_*(r+1);if(f[M]!==h)continue;const S=(_+.5)*c,P=b>0?b-1+_*r:-1,T=b<r?b+_*r:-1,L=P>=0&&i.kind[P]===ft||T>=0&&i.kind[T]===ft?1:1-i.au[M];L<=0||(P>=0&&i.kind[P]===et&&(m.push(t.at(b-1-e,_-s)),g.push(L,0,-L*(S-u.y))),T>=0&&i.kind[T]===et&&(m.push(t.at(b-e,_-s)),g.push(-L,0,L*(S-u.y))))}for(let _=w;_<=y;_+=1)for(let b=p;b<Math.min(r,x);b+=1){const M=b+_*r;if(f[i.nu+M]!==h)continue;const S=(b+.5)*c,P=_>0?b+(_-1)*r:-1,T=_<a?b+_*r:-1,L=P>=0&&i.kind[P]===ft||T>=0&&i.kind[T]===ft?1:1-i.av[M];L<=0||(P>=0&&i.kind[P]===et&&(m.push(t.at(b-e,_-1-s)),g.push(0,L,L*(S-u.x))),T>=0&&i.kind[T]===et&&(m.push(t.at(b-e,_-s)),g.push(0,-L,-L*(S-u.x))))}if(m.length===0){u.ma6.fill(0),u.maOk=!0;continue}const A=t.system,F=this.m9;for(let _=0;_<3;_+=1){A.b.fill(0),A.x.fill(0);for(let b=0;b<m.length;b+=1)A.b[m[b]]-=c*g[3*b+_];t.solve(1e-4,40,!0);for(let b=0;b<3;b+=1){let M=0;for(let S=0;S<m.length;S+=1)M+=A.x[m[S]]*g[3*S+b];F[3*b+_]=-n*c*l*M}}const k=u.ma6;k[0]=F[0],k[1]=.5*(F[1]+F[3]),k[2]=.5*(F[2]+F[6]),k[3]=F[4],k[4]=.5*(F[5]+F[7]),k[5]=F[8],u.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,Vl*e.dx/s))}return t}wake(t){if(!t.free||!t.asleep)return;t.asleep=!1,t.rest=0,t.maOk=!1;const e=3*t.index;this.prev[e]=0,this.prev[e+1]=0,this.prev[e+2]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(qe(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let a=this.list.length-1;a>=0;a-=1){const c=this.list[a];if(!c.gone&&(Rt.toLocal(c.x,c.y,c.a,t,e,n),c.insideLocal(n[0],n[1],r)))return c}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=new Float64Array(3*this.list.length+24);t.set(this.prev),this.prev=t}}}function Ul(o,t,e,s,n,i,r,a,c,l){const f=s*i-n*n,u=e*n-t*i,h=t*n-e*s,m=o*f+t*u+e*h,g=o*i-e*e,d=t*e-o*n,p=o*s-t*t;l[0]=(f*r+u*a+h*c)/m,l[1]=(u*r+g*a+d*c)/m,l[2]=(h*r+d*a+p*c)/m}const oo=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function $s(o){if(o===null||typeof o!="object")return null;const t=o,e=(a,c)=>{if(!Array.isArray(a)||a.length!==c)return null;const l=a.map(oo);return l.every(f=>f!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(c=>e(c,2));if(a.every(c=>c!==null))return{poly:a.map(c=>[c[0],c[1]])}}const i=e(t.line,4),r=oo(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function as(o,t,e){if("rect"in o){const[m,g,d,p]=o.rect;return t>=m&&t<=d&&e>=g&&e<=p}if("circle"in o){const[m,g,d]=o.circle;return(t-m)*(t-m)+(e-g)*(e-g)<=d*d}if("poly"in o){const m=o.poly;let g=!1;for(let d=0,p=m.length-1;d<m.length;p=d,d+=1){const[x,w]=m[d],[y,A]=m[p];w>e!=A>e&&t<(y-x)*(e-w)/(A-w)+x&&(g=!g)}return g}const[s,n,i,r]=o.line,a=i-s,c=r-n,l=a*a+c*c,f=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*c)/l)):0,u=t-(s+f*a),h=e-(n+f*c);return u*u+h*h<=.25*o.width*o.width}function Us(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,a,c]=o.circle;return[r-c,a-c,r+c,a+c]}if("poly"in o){let r=1/0,a=1/0,c=-1/0,l=-1/0;for(const[f,u]of o.poly)r=Math.min(r,f),a=Math.min(a,u),c=Math.max(c,f),l=Math.max(l,u);return[r,a,c,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Ws(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const ri=.05;function co(o,t){const e=o.latentOffset(),s=or(o,t.filter(([n,i,r,a])=>r-n>ri*o.dx&&a-i>ri*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function or(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,a=o.nr,c=o.E,l=o.film,f=o.crust;let u=0,h=0,m=0;for(let y=0;y<o.ncell;y+=1)u+=c[y],h+=l[y],m+=f[y];const g=[],d=[];for(const[y,A,F,k]of t)!(F>y)||!(k>A)||(g.push(Rt.splits(y,F,o.dx)),d.push(Rt.splits(A,k,o.dx)));o.setRects(g,d);let p=0,x=0,w=0;for(let y=0;y<o.nr;y+=1){const A=o.xs[y],F=o.ys[y];for(let k=0;k<o.nj[y];k+=1)for(let _=0;_<o.ni[y];_+=1){const b=o.off[y]+_+k*o.ni[y],M=A[_],S=A[_+1],P=F[k],T=F[k+1];for(let O=0;O<a;O+=1){const L=e[O],I=s[O];if(!(L[0]>=S||L[n[O]]<=M||I[0]>=T||I[i[O]]<=P))for(let B=0;B<i[O];B+=1){const D=Math.min(T,I[B+1])-Math.max(P,I[B]);if(!(D<=0))for(let R=0;R<n[O];R+=1){const V=Math.min(S,L[R+1])-Math.max(M,L[R]);if(V<=0)continue;const W=r[O]+R+B*n[O],N=V*D/((L[R+1]-L[R])*(I[B+1]-I[B]));o.E[b]+=N*c[W],o.film[b]+=N*l[W],o.crust[b]+=N*f[W]}}}p+=o.E[b],x+=o.film[b],w+=o.crust[b]}}return{energy:u-p,film:h-x,crust:m-w}}function Gl(o,t,e,s,n){const[i,r,a,c]=o;if(s<=i||t>=a||n<=r||e>=c)return null;const l=[],f=Math.max(i,t),u=Math.min(a,s);return t>i&&l.push([i,r,t,c]),s<a&&l.push([s,r,a,c]),e>r&&l.push([f,r,u,e]),n<c&&l.push([f,n,u,c]),l}function Hl(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let a=0;a<r.length;a+=1){const[c,l,f,u]=o[r[a]];for(let h=0;h<e;h+=1){if(s[h]>=0)continue;const[m,g,d,p]=o[h],x=(Math.abs(f-m)<=t||Math.abs(d-c)<=t)&&Math.min(u,p)-Math.max(l,g)>t,w=(Math.abs(u-g)<=t||Math.abs(p-l)<=t)&&Math.min(f,d)-Math.max(c,m)>t,y=Math.min(f,d)-Math.max(c,m)>t&&Math.min(u,p)-Math.max(l,g)>t;(x||w||y)&&(s[h]=n.length,r.push(h))}}n.push(r)}return n}function $l(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let a=0;a<n;a+=1){const c=s[a];if(c.gone)continue;let l=1/0,f=1/0,u=-1/0,h=-1/0;if("circle"in t){const[k,_,b]=t.circle;Rt.toLocal(c.x,c.y,c.a,k,_,i),l=i[0]-b,u=i[0]+b,f=i[1]-b,h=i[1]+b}else{const[k,_,b,M]=Us(t);for(const[S,P]of[[k,_],[b,_],[b,M],[k,M]])Rt.toLocal(c.x,c.y,c.a,S,P,i),l=Math.min(l,i[0]),u=Math.max(u,i[0]),f=Math.min(f,i[1]),h=Math.max(h,i[1])}const m=[];let g=!1;for(let k=0;k<c.nr;k+=1){const _=c.bounds(k),b=Gl(_,l,f,u,h);if(b===null){m.push(_);continue}g=!0;for(const M of b)m.push(M)}if(!g)continue;r=!0,o.cover.release(c);const d=qe(c.mat)>0,p={E:c.energy(),F:c.filmMass(),K:c.crustMass(),M:d?c.m:0},x=$c(o,c,m.filter(k=>k[2]-k[0]>ri*c.dx&&k[3]-k[1]>ri*c.dx));let w=0,y=0,A=0,F=0;for(const k of x)w+=k.energy(),y+=k.filmMass(),A+=k.crustMass(),F+=d?k.m:0;e.energy-=p.E-c.energy()-w,e.water-=p.F-c.filmMass()-y+(d?p.M-c.m-F:0),e.salt-=p.K-c.crustMass()-A,c.gone||c.ncell===0?(c.gone=!0,c.ncell=0):(o.cover.weigh(c),o.cover.addCells(c))}return r&&o.changed(),r}function $c(o,t,e,s=!0){const n=o.list,i=Hl(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let a=1;a<i.length;a+=1){const c=new Rt(n.length,t.key,t.dx,t.depth);c.mat=t.mat,c.heater=t.heater,c.xs=t.xs.map(l=>l.slice()),c.ys=t.ys.map(l=>l.slice()),c.nr=t.nr,c.ni=t.ni.slice(),c.nj=t.nj.slice(),c.off=t.off.slice(),c.ncell=t.ncell,c.E=t.E.slice(),c.film=t.film.slice(),c.crust=t.crust.slice(),c.x=t.x,c.y=t.y,c.a=t.a,c.m=t.m,co(c,i[a].map(l=>e[l])),c.rx=c.x,c.ry=c.y,c.ra=c.a,c.pinned=t.pinned,c.asleep=t.asleep,c.vx=t.vx,c.vy=t.vy,c.w=t.w,n.push(c),o.grow(),o.cover.weigh(c),o.cover.addCells(c),r.push(c)}return co(t,i.length>0?i[0].map(a=>e[a]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function Wl(o,t,e){const[s,n,i,r]=Us(t),a=[],c=new Float64Array(4);for(const l of o.list){if(l.gone||e!==void 0&&!e(l))continue;l.worldBox(l.x,l.y,l.a,c);const f=.001*l.dx;c[0]>=i-f||c[2]<=s+f||c[1]>=r-f||c[3]<=n+f||(o.cover.release(l),a.push(l))}return a}function Kl(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(qe(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function ao(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const $t=new Float64Array(6);function Ln(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let a=0;a<r;a+=1){const c=e===0?0:e===1?n-1:a,l=e===2?0:e===3?i-1:a,f=o.off[t]+c+l*n,u=e<2?o.ys[t][l]:o.xs[t][c],h=e<2?o.ys[t][l+1]:o.xs[t][c+1],m=Wc(o,t,e,u,h);s(f,h-u,h>u?m/(h-u):0)}}function Wc(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function lo(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function Kc(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function zl(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=Kc(o,t,n);i>s&&(s=i,e=n)}return e}function zc(o,t,e,s){t.segment(e,$t);const n=Math.hypot($t[2]-$t[0],$t[3]-$t[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),a=Math.sin(t.a),c=r*$t[4]-a*$t[5],l=a*$t[4]+r*$t[5],f=$t[0],u=$t[1],h=$t[2]-$t[0],m=$t[3]-$t[1];for(let g=0;g<i;g+=1){const d=(g+.5)/i,p=f+d*h,x=u+d*m;s(t.x+r*p-a*x,t.y+a*p+r*x,c,l,n/i)}}function cr(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx;let a=-1,c=-1,l=-1;zc(o,t,e,(f,u,h,m,g)=>{const d=i.cellAt(f+r*h,u+r*m);if(d<0||i.solid[d]!==0){a=d;return}if(d!==a&&s(d,g),a=d,n){const x=i.cellAt(f+(i.dx+r)*h,u+(i.dx+r)*m);x>=0&&x!==d&&x!==l&&i.solid[x]===0&&s(x,g),l=x}const p=i.cellAt(f-r*h,u-r*m);p>=0&&p!==d&&p!==c&&i.solid[p]===0&&i.kind[p]===et&&s(p,g),c=p})}function Ql(o,t,e,s,n){const i=o.exchange;let r=0,a=0;for(let c=0;c<t.nseg;c+=1)t.segR[c]!==e||t.segS[c]!==s||cr(o,t,c,l=>{r+=i.salt[l],a+=i.water[l],n.add(4*e+s)});return!(a>0)||!(r>0)?qe(t.mat):Uc(r/(a*Bs))}function Xl(o,t,e,s,n){const i=o.grid,r=o.exchange,a=i.n,c=.05*i.dx;let l=0;for(let f=0;f<t.nseg;f+=1)t.segR[f]!==e||t.segS[f]!==s||zc(o,t,f,(u,h,m,g,d)=>{var y;const p=i.cellAt(u+c*m,h+c*g);if(p<0)return;let x,w;i.solid[p]!==0?(x=i.T[p],w=((y=ut[i.solid[p]-1])==null?void 0:y.k)??0):r.cap[p]>0?(x=r.capT[p]/r.cap[p],w=Xn(x)):(x=i.T[p],w=yc(i.mg[p],i.mg[a+p],i.mg[Q*a+p],x)),x>n&&(l+=w*(x-n)*d)});return l}const Yl=.3,Jl=1.6,On=.05,Zl=2,tf=.25,fo=.5,Ci=1e-6;class ef{constructor(t){v(this,"pending",[]);v(this,"melted",0);v(this,"frozen",0);v(this,"head",new Int32Array(0));v(this,"next",new Int32Array(0));v(this,"listed",!1);this.e=t}pendingTotals(){let t=0,e=0,s=0;for(const n of this.pending)n!==void 0&&(t+=n.m-n.s,e+=n.H,s+=n.s);return{m:t,H:e,s}}any(){return this.e.bodies.list.some((t,e)=>{var s;return!t.gone&&qe(t.mat)>0||(((s=this.pending[e])==null?void 0:s.m)??0)>0})}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&qe(i.mat)>0&&this.body(i)&&(t=!0);const r=this.pending[n];r!==void 0&&r.m>0&&this.spawn(i,r)}return t}body(t){const e=ut[t.mat].rho,s=ut[t.mat].cp,n=Xs(t.mat),i=new Map,r=new Set,a=new Map;for(let y=0;y<t.nseg;y+=1){const A=4*t.segR[y]+t.segS[y];if(i.has(A))continue;const F=Ql(this.e,t,t.segR[y],t.segS[y],r);i.set(A,F),a.set(A,Xl(this.e,t,t.segR[y],t.segS[y],F))}const c=new Map;for(let y=0;y<t.nr;y+=1)this.excess(t,y,i,r,a,c);const l=this.walls(t,[...i.keys()]),f=new Map,u=new Map,h=new Map,m=new Map,g=new Map;for(const[y,A]of i){const F=y>>2,k=y&3,_=s*(A-st)+n,b=Ft(A)-_;let M=0;Ln(t,F,k,(T,O,L)=>{L>0&&(M+=L*O*(b+s*(A-Math.min(A,t.cellT(T)))))});const S=this.planFreeze(t,F,k,A,b);f.set(y,{L:b,hIce:_,denom:M,plan:S});const P=l.get(y);u.set(P,(u.get(P)??0)+(c.get(y)??0)),h.set(P,(h.get(P)??0)+M),m.set(P,(m.get(P)??0)+((S==null?void 0:S.total)??0)),g.set(P,(g.get(P)??0)+Kc(t,F,k))}const d=[];for(const[y,A]of i){const F=y>>2,k=y&3,_=l.get(y),b=f.get(y),M=c.get(y)??0,S=u.get(_)??0,P=h.get(_)??0;S>0&&P>0?d.push({r:F,s:k,d:S/(e*t.depth*P),Q:M,Tf:A,hIce:b.hIce,freeze:null}):M>0&&this.giveBack(t,F,k,M);const T=m.get(_)??0;T>0&&d.push({r:F,s:k,d:T/(e*t.depth*g.get(_)),Q:0,Tf:A,hIce:b.hIce,freeze:b.plan??{p:[],dm:[],total:0}})}if(d.length===0)return!1;const p=ho(t),x=this.e.bodies;if(x.cover.release(t),t.nr===1?this.moveSides(t,d):this.slabs(t,d),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,x.changed(),!0;let w=0;if(t.nr>1){const y=[];for(let A=0;A<t.nr;A+=1)y.push(t.bounds(A));w=$c(x,t,y,!1).length}return t.derive(),x.cover.weigh(t),x.cover.addCells(t),d.some(y=>y.freeze!==null)&&x.cover.pushOut(t,t.x,t.y,t.a),x.reshaped(t,w>0||ho(t)!==p),!0}excess(t,e,s,n,i,r){const a=[];for(let d=0;d<4;d+=1)n.has(4*e+d)&&a.push(d);if(a.length===0)for(let d=0;d<4;d+=1)s.has(4*e+d)&&a.push(d);let c=1/0;for(let d=0;d<4;d+=1)c=Math.min(c,s.get(4*e+d)??1/0);if(c===1/0)return;const l=t.xs[e],f=t.ys[e],u=t.ni[e],h=t.nj[e],m=[0,0],g=[0,0];for(let d=0;d<h;d+=1)for(let p=0;p<u;p+=1){const x=t.off[e]+p+d*u,w=t.cellT(x);if(!(w>c))continue;let y=0,A=0;for(let T=0;T<4&&y<2;T+=1){if(!(T===0?p===0:T===1?p===u-1:T===2?d===0:d===h-1))continue;const O=i.get(4*e+T)??0;!(O>0)||!(Wc(t,e,T,T<2?f[d]:l[p],T<2?f[d+1]:l[p+1])>0)||(m[y]=T,g[y]=O,A+=O,y+=1)}if(y>0){const T=t.E[x];for(let O=0;O<y;O+=1){const L=4*e+m[O],I=g[O]/A*(T-nr(t.cellCap(x),t.film[x],t.crust[x],s.get(L)));I>0&&(t.E[x]-=I,r.set(L,(r.get(L)??0)+I))}continue}if(a.length===0)continue;const F=.5*(l[p]+l[p+1]),k=.5*(f[d]+f[d+1]);let _=a[0],b=1/0;for(const T of a){const O=T===0?F-l[0]:T===1?l[u]-F:T===2?k-f[0]:f[h]-k;O<b&&(b=O,_=T)}const M=4*e+_,S=s.get(M);if(!(w>S))continue;const P=t.E[x]-nr(t.cellCap(x),t.film[x],t.crust[x],S);P>0&&(t.E[x]-=P,r.set(M,(r.get(M)??0)+P))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,a=this.e.particles,c={p:[],dm:[],total:0},l=f=>{if(!(r.cap[f]>0)||!(r.water[f]>0))return;const u=r.capT[f]/r.cap[f];if(u>=n)return;const h=Math.min(fo*r.water[f],r.cap[f]*(n-u)/Math.max(1,i));if(!(h>0))return;let m=0;this.inCell(f,g=>{if(a.mat[g]!==lt)return;const d=a.mass[g]-a.smass[2*g],p=Math.min(fo*d,h*d/r.water[f]);p>0&&(c.p.push(g),c.dm.push(p),m+=p)}),r.water[f]-=m,r.cap[f]=0,c.total+=m};for(let f=0;f<t.nseg;f+=1)t.segR[f]===e&&t.segS[f]===s&&cr(this.e,t,f,l);return c.total>0?c:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let a=0;a<t.p.length;a+=1){const c=t.p[a],l=t.dm[a]*e;if(!(l>0))continue;const f=n.mass[c]/n.rho[c],u=n.mass[c]*n.h[c]-l*s;n.mass[c]-=l,n.h[c]=u/n.mass[c],n.derive(c),i.dVp[c]+=n.mass[c]/n.rho[c]-f,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=ut[t.mat].rho,a=Math.min(n,this.rowThickness(t,e,s));let c=0,l=0,f=0,u=0;if(Ln(t,e,s,(h,m)=>{const g=t.cellVolume(h);if(!(g>0))return;const d=m*a*t.depth/g;l+=d*t.E[h],f+=d*t.film[h],u+=d*t.crust[h],t.E[h]-=d*t.E[h],t.film[h]-=d*t.film[h],t.crust[h]-=d*t.crust[h],c+=r*m*a*t.depth}),this.moveSide(t,e,s,-a),!(c>0)){this.giveBack(t,e,s,i+l);return}this.melted+=c,this.give(t,e,s,c+f+u,l+c*Xs(t.mat)+i,u)}grow(t,e,s,n,i){const r=ut[t.mat].rho,a=ut[t.mat].cp,c=lo(t,e,s),l=n/(r*t.depth*c);Ln(t,e,s,(f,u)=>{t.E[f]+=r*u*l*t.depth*a*(i-st)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=lo(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}Ln(t,e,s,(r,a)=>{t.E[r]+=n*a/i})}slabs(t,e){const s=ut[t.mat].rho,n=ut[t.mat].cp,i=Xs(t.mat),r=t.depth,a=e.length,c=this.walls(t,e.map(M=>4*M.r+M.s)),l=e.map(M=>c.get(4*M.r+M.s)),f=new Map;for(const M of e)M.freeze===null&&f.set(4*M.r+M.s,M.d);const u=[];for(let M=0;M<t.nr;M+=1)u.push(t.bounds(M));const h=new Map;for(const M of e)h.set(4*M.r+M.s,(h.get(4*M.r+M.s)??0)+(M.freeze!==null?M.d:-M.d));const m=[],g=[];for(let M=0;M<a;M+=1){const S=e[M],P=u[S.r];for(let T=0;T<t.nseg;T+=1)if(!(t.segR[T]!==S.r||t.segS[T]!==S.s))if(S.freeze===null){const O=t.segT0[T]-this.inner(t,T,!1,f),L=t.segT1[T]+this.inner(t,T,!0,f);m.push(uo(S.s,P,O,L,Math.min(S.d,S.s<2?P[2]-P[0]:P[3]-P[1]),!0,M))}else{const O=t.segT0[T]-this.corner(t,S.r,S.s,!1,t.segT0[T],h),L=t.segT1[T]+this.corner(t,S.r,S.s,!0,t.segT1[T],h);L>O&&g.push(uo(S.s,P,O,L,S.d,!1,M))}}const d=Tl(u,m,g),p=d.taken,x=new Float64Array(a);for(let M=0;M<p.length;M+=5)x[p[M+4]]+=(p[M+2]-p[M])*(p[M+3]-p[M+1]);for(let M=0;M<a;M+=1)e[M].freeze===null&&!(x[M]>0)&&this.giveBack(t,e[M].r,e[M].s,e[M].Q);const w=new Float64Array(a),y=new Float64Array(a),A=new Float64Array(a);for(let M=0;M<p.length;M+=5){const S=p[M+4];this.overlap(t,p[M],p[M+1],p[M+2],p[M+3],(P,T)=>{w[S]+=T*t.E[P],y[S]+=T*t.film[P],A[S]+=T*t.crust[P]})}for(let M=0;M<a;M+=1){const S=e[M];if(S.freeze!==null||!(x[M]>0))continue;const P=s*r*x[M];this.melted+=P,this.give(t,S.r,S.s,P+y[M]+A[M],w[M]+P*i+S.Q,A[M])}or(t,d.rects);const F=d.added,k=new Float64Array(a);for(let M=0;M<F.length;M+=5){const S=F[M+4],P=e[S].Tf;k[S]+=(F[M+2]-F[M])*(F[M+3]-F[M+1]),this.overlap(t,F[M],F[M+1],F[M+2],F[M+3],(T,O,L)=>{t.E[T]+=s*r*L*n*(P-st)})}const _=new Map,b=new Map;for(let M=0;M<a;M+=1){const S=e[M].freeze;if(S===null)continue;const P=l[M];_.set(P,(_.get(P)??0)+s*r*k[M]),b.set(P,(b.get(P)??0)+S.total)}for(let M=0;M<a;M+=1){const S=e[M].freeze;if(S===null||!(S.total>0))continue;const P=l[M];this.take(S,_.get(P)/b.get(P),e[M].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let a=r;for(;s.get(a)!==a;)a=s.get(a);return a};if(t.nr>1){const r=Ci*t.dx,a=c=>{const l=t.segR[c],f=t.segS[c];return f===0?t.xs[l][0]:f===1?t.xs[l][t.ni[l]]:f===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let c=0;c<t.nseg;c+=1)for(let l=c+1;l<t.nseg;l+=1){if(t.segS[c]!==t.segS[l]||Math.abs(a(c)-a(l))>r||Math.abs(t.segT1[c]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[c])>r)continue;const f=4*t.segR[c]+t.segS[c],u=4*t.segR[l]+t.segS[l];if(!s.has(f)||!s.has(u))continue;const h=n(f),m=n(u);h!==m&&s.set(Math.max(h,m),Math.min(h,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=Ci*t.dx,r=t.segR[e],a=t.segS[e],c=s?t.segT1[e]:t.segT0[e],l=a===0?t.xs[r][0]:a===1?t.xs[r][t.ni[r]]:a===2?t.ys[r][0]:t.ys[r][t.nj[r]],f=a<2?l:c,u=a<2?c:l,h=a===0?-1:a===1?1:0,m=a===2?-1:a===3?1:0;for(let g=0;g<t.nseg;g+=1){const d=t.segS[g];if(d<2==a<2)continue;const p=n.get(4*t.segR[g]+d);if(p===void 0)continue;const x=t.segR[g],w=d===0?t.xs[x][0]:d===1?t.xs[x][t.ni[x]]:d===2?t.ys[x][0]:t.ys[x][t.nj[x]];for(const[y,A]of[[t.segT0[g],t.segT1[g]],[t.segT1[g],t.segT0[g]]]){const F=d<2?w:y,k=d<2?y:w;if(Math.abs(F-f)>i||Math.abs(k-u)>i)continue;const _=d<2?w:A,b=d<2?A:w;if((_-f)*h+(b-u)*m>i)return p}}return 0}corner(t,e,s,n,i,r){const[a,c,l,f]=t.bounds(e),u=Ci*t.dx,h=s<2?n?f:c:n?l:a;if(Math.abs(i-h)>u)return 0;const m=s<2?n?3:2:n?1:0,g=s===0?a:s===1?l:s===2?c:f;for(let d=0;d<t.nseg;d+=1)if(t.segR[d]===e&&t.segS[d]===m&&t.segT0[d]<=g+u&&t.segT1[d]>=g-u)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let a=0;a<t.nr;a+=1){const c=t.xs[a],l=t.ys[a],f=t.ni[a],u=t.nj[a];if(!(c[0]>=n||c[f]<=e||l[0]>=i||l[u]<=s))for(let h=0;h<u;h+=1){const m=Math.min(i,l[h+1])-Math.max(s,l[h]);if(!(m<=0))for(let g=0;g<f;g+=1){const d=Math.min(n,c[g+1])-Math.max(e,c[g]);d<=0||r(t.off[a]+g+h*f,d*m/((c[g+1]-c[g])*(l[h+1]-l[h])),d*m)}}}}give(t,e,s,n,i,r=0){const a=this.e.grid,c=this.e.particles,l=this.e.liquid,f=[],u=new Set;let h=0;for(let g=0;g<2&&f.length===0;g+=1)for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||cr(this.e,t,d,p=>{a.kind[p]!==et||u.has(p)||(u.add(p),this.inCell(p,x=>{c.mat[x]===lt&&(f.push(x),h+=c.mass[x])}))},g===1);if(f.length===0||!(h>0)){this.hold(t,e,s,n,i,r);return}const m=l.rhoRef*a.vCell/4;for(const g of f){const d=c.mass[g]/h,p=c.mass[g]/c.rho[g],x=c.mass[g]*c.h[g]+d*i;c.mass[g]+=d*n,r>0&&(c.smass[2*g]+=d*r,c.spc[2*g]=Cr),c.h[g]=x/c.mass[g],c.derive(g),l.dVp[g]+=c.mass[g]/c.rho[g]-p,c.mass[g]>Zl*m&&this.split(g)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const f of[i,-i]){const u=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*f)),h=n.cellAt(u,e.y[t]);if(h>=0&&n.solid[h]===0&&this.e.bodies.bodyAt(u,e.y[t],0)===null){r=u;break}}if(Number.isNaN(r))return;const a=.5*e.mass[t],c=.5*e.smass[2*t],l=e.add(r,e.y[t],a,e.h[t],e.mat[t],c);l<0||(e.mass[t]=a,e.smass[2*t]=c,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r=0){const[a,c,l,f]=t.bounds(e),u=s===0?a:s===1?l:.5*(a+l),h=s===2?c:s===3?f:.5*(c+f),m=s===0?-1:s===1?1:0,g=s===2?-1:s===3?1:0,d=Math.cos(t.a),p=Math.sin(t.a),x=this.pending[t.index]??(this.pending[t.index]={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1});x.m+=n,x.H+=i,x.s+=r,x.x=t.x+d*u-p*h,x.y=t.y+p*u+d*h,x.nx=d*m-p*g,x.ny=p*m+d*g}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;if(e.m<tf*r&&!t.gone)return;const a=this.freeSpot(e.x+.3*s.dx*e.nx,e.y+.3*s.dx*e.ny);if(a===null)return;const c=n.add(a[0],a[1],e.m,e.H/e.m,lt,e.s);c<0||(n.vx[c]=t.gone?0:t.vx,n.vy[c]=t.gone?0:t.vy,i.placeParticle(c),i.dVp[c]=e.m/n.rho[c],e.m=0,e.H=0,e.s=0)}freeSpot(t,e){const s=this.e.grid,n=(i,r)=>{if(!(i>0&&r>0&&i<s.w&&r<s.h))return!1;const a=s.cellAt(i,r);return a>=0&&s.solid[a]===0&&this.e.bodies.bodyAt(i,r,0)===null};if(n(t,e))return[t,e];for(let i=1;i<=3;i+=1)for(let r=i;r>=-i;r-=1)for(let a=-i;a<=i;a+=1)if(Math.max(Math.abs(a),Math.abs(r))===i&&n(t+a*s.dx,e+r*s.dx))return[t+a*s.dx,e+r*s.dx];return null}tidy(t){const e=t.dx;let s=!1;for(let a=0;a<t.nr;a+=1){const[c,l,f,u]=t.bounds(a);if(f-c<On*e||u-l<On*e){s=!0;continue}for(let h=0;h<4;h+=1){const m=this.rowThickness(t,a,h),g=h<2?t.ni[a]:t.nj[a];(m<Yl*e&&g>1||m>Jl*e)&&(s=!0)}}if(!s)return;const n=ut[t.mat].rho,i=Xs(t.mat),r=[];for(let a=0;a<t.nr;a+=1){const[c,l,f,u]=t.bounds(a);if(f-c>=On*e&&u-l>=On*e){r.push([c,l,f,u]);continue}const h=n*(f-c)*(u-l)*t.depth;let m=0,g=0,d=0;for(let p=t.off[a];p<t.off[a]+t.ni[a]*t.nj[a];p+=1)m+=t.E[p],g+=t.film[p],d+=t.crust[p];this.melted+=h,this.give(t,a,zl(t,a),h+g+d,m+h*i,d)}or(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function uo(o,t,e,s,n,i,r){const[a,c,l,f]=t;return o===0?i?{x0:a,y0:e,x1:a+n,y1:s,move:r}:{x0:a-n,y0:e,x1:a,y1:s,move:r}:o===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:o===2?i?{x0:e,y0:c,x1:s,y1:c+n,move:r}:{x0:e,y0:c-n,x1:s,y1:c,move:r}:i?{x0:e,y0:f-n,x1:s,y1:f,move:r}:{x0:e,y0:f,x1:s,y1:f+n,move:r}}function ho(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const oe=8;class sf{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*at),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*oe),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<at;i+=1)this.m[n*at+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<oe;i+=1)this.force[n*oe+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<at;s+=1)e+=this.m[t*at+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<at;s+=1)this.m[t*at+s]=this.m[e*at+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<oe;s+=1)this.force[t*oe+s]=this.force[e*oe+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Qc=200;function Li(o,t,e,s){const n=kt(o);return t/Le(n)-e*qt*n/(s-o)}function nf(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function rf(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function of(o,t,e,s,n,i,r,a=lt){const c=o[t+Q],l=o[t+it]/mt[it]+o[t+ot]/mt[ot],f=c/mt[Q];let u=i>0?i:Math.cbrt(3*Math.max(1e-30,(f+l)*qt*s/e)/(4*Math.PI)),h=e,m=0,g=s,d=0;for(let p=0;p<8;p+=1){if(h=e+2*Ms(a,g)/u,l<=0)m=h,g=kt(m),d=c/Le(g);else if(f<=1e-9*l)m=0,g=s,d=l*qt*g/h;else{let w=611.213,y=h*(1-1e-12),A=Li(w,c,l,h),F=Li(y,c,l,h);if(A<=0)m=w;else if(F>=0)m=y;else{let k=0;m=.5*(w+y);for(let _=0;_<40;_+=1){m=(w*F-y*A)/(F-A);const b=Li(m,c,l,h);if(Math.abs(b)<=1e-12*(c/Le(s)+1e-30))break;b>0?(w=m,A=b,k===1&&(F/=2),k=1):(y=m,F=b,k===-1&&(A/=2),k=-1)}}g=kt(m),d=c/Le(g)}const x=nf(d,n);if(Math.abs(x-u)<=1e-7*u){u=x;break}u=x}r.r=u,r.V=d,r.pb=e+2*Ms(a,g)/u,r.pv=m,r.Tb=g,rf(d,u,n,r)}function mo(o,t,e,s){let n=0;for(let i=0;i<at;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function po(o,t,e,s,n,i,r,a,c,l){let f=0;if(2*e<=3*i){const x=o/i-.5,w=t/i-.5,y=Math.floor(x-.5),A=Math.floor(w-.5),F=x-y,k=w-A,_=.5*(1.5-F)**2,b=.75-(F-1)**2,M=.5*(F-.5)**2,S=.5*(1.5-k)**2,P=.75-(k-1)**2,T=.5*(k-.5)**2;let O=0;for(let L=0;L<3;L+=1){const I=A+L;if(I<0||I>=a)continue;const B=L===0?S:L===1?P:T;for(let D=0;D<3;D+=1){const R=y+D;if(R<0||R>=r)continue;const V=B*(D===0?_:D===1?b:M);c[f]=R+I*r,l[f]=V,O+=V,f+=1}}for(let L=0;L<f;L+=1)l[L]/=O;return f}const u=s<=Math.PI*n*n*n/6,h=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),g=Math.max(0,Math.floor((t-e)/i)),d=Math.min(a-1,Math.floor((t+e)/i));let p=0;for(let x=g;x<=d;x+=1)for(let w=h;w<=m;w+=1){let y=0;for(let A=0;A<4;A+=1){const F=(x+(A+.5)/4)*i-t;for(let k=0;k<4;k+=1){const _=(w+(k+.5)/4)*i-o,b=e*e-_*_-F*F;b>0&&(y+=u?Math.sqrt(b):1)}}y<=0||f>=c.length||(c[f]=w+x*r,l[f]=y,p+=y,f+=1)}if(p<=0)return c[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let x=0;x<f;x+=1)l[x]/=p;return f}function go(o,t,e,s,n,i){const{nx:r,ny:a}=o,c=e%r,l=(e-c)/r;let f=0,u=0;for(let h=0;h<=6&&(f===0||u<2*s);h+=1)for(let m=0;m<=h;m+=1)for(let g=-h;g<=h;g+=1){if(Math.max(Math.abs(g),m)!==h)continue;const d=c+g,p=l+m;if(d<0||p<0||d>=r||p>=a)continue;const x=d+p*r;if(o.kind[x]!==H||f>=n.length)continue;const w=Math.max(.001*o.vCell,t[x]);n[f]=x,i[f]=w,u+=w,f+=1}for(let h=0;h<f;h+=1)i[h]/=u;return f}function xo(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===H)return e+s*o.nx;return-1}const hs=.5;class cf{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,c=r.x[t],l=r.y[t],f=r.r[t],u=r.V[t],h=Math.max(f+i.dx,2*i.dx),m=this.vel;let g=0,d=0;for(let z=0;z<8;z+=1){const ht=z*Math.PI/4;a.velocityAt(c+h*Math.cos(ht),l+h*Math.sin(ht),m),g+=m[0]/8,d+=m[1]/8}const p=i.cellAt(c,l),x=p>=0&&n.phase.Cl[p]>0?n.phase.Tl[p]:r.Tb[t],w=p>=0?n.phase.host[p]:0,y=n.phase.mixed?os(w,x):a.rhoRef,A=cn(w,x),F=r.totalMass(t)/Math.max(1e-30,u),k=(g-this.ux0[t])/Math.max(e,1e-6),_=(d-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=g,this.uy0[t]=d,f<2e-5){r.vx[t]=g,r.vy[t]=d,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,c+e*g)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*d));return}const b=r.vx[t]-g,M=r.vy[t]-d,S=Math.hypot(b,M),P=2*f,T=Math.max(1e-6,y*S*P/A),O=Math.max(0,n.gy)*(y-F)*P*P/Ms(w,x),I=.5*Math.max(24/T*(1+.15*Math.pow(T,.687)),8/3*(O/(O+4)))*y*this.front(t)*S,B=(F+hs*y)*u,D=y*u*k,R=y*u*(_+n.gy),V=-F*u*n.gy,W=hs*y*u*k,N=hs*y*u*_,Y=s>0?hs*y*s:0,J=s<0?Math.min(-s,.2*u/e):0,q=hs*y*J*b,$=hs*y*J*M,U=(B*r.vx[t]+e*(D+W+q)+e*(I+Y)*g)/(B+e*(I+Y)),G=(B*r.vy[t]+e*(R+V+N+$)+e*(I+Y)*d)/(B+e*(I+Y));r.vx[t]=Number.isFinite(U)?U:g,r.vy[t]=Number.isFinite(G)?G:d;const tt=-I*(U-g),pt=-I*(G-d),wt=t*oe;r.force[wt]=D,r.force[wt+1]=R,r.force[wt+2]=0,r.force[wt+3]=V,r.force[wt+4]=tt,r.force[wt+5]=pt,r.force[wt+6]=W+q-Y*(U-g),r.force[wt+7]=N+$-Y*(G-d),this.spreadForce(c,l,f,-(tt+r.force[wt+6])*(e/n.dt),-(pt+r.force[wt+7])*(e/n.dt));let C=c+e*U,E=l+e*G;const j=i.sdfAt(C,E);if(j<f){const z=.25*i.dx;let ht=i.sdfAt(C+z,E)-i.sdfAt(C-z,E),bt=i.sdfAt(C,E+z)-i.sdfAt(C,E-z);const dt=Math.hypot(ht,bt);if(dt>1e-12){ht/=dt,bt/=dt,C+=(f-j)*ht,E+=(f-j)*bt;const Lt=r.vx[t]*ht+r.vy[t]*bt;Lt<0&&(r.vx[t]-=Lt*ht,r.vy[t]-=Lt*bt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,C)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,E));const X=i.depth;r.z[t]=2*f>=X?X/2:Math.min(X-f,Math.max(f,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:f}=a;if(s>f&&this.spreadRing(t,e,s,n,i))return;const u=this.w3;let h=Math.floor(t/f-.5),m=t/f-h;u[0]=.5*(1.5-m)**2,u[1]=.75-(m-1)**2,u[2]=.5*(m-.5)**2;let g=Math.floor(e/f-1);m=e/f-.5-g,u[3]=.5*(1.5-m)**2,u[4]=.75-(m-1)**2,u[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let p=0;p<3;p+=1){const x=h+p,w=g+d;x<0||x>c||w<0||w>=l||(r.fU[x+w*(c+1)]+=n*u[p]*u[3+d])}h=Math.floor(t/f-1),m=t/f-.5-h,u[0]=.5*(1.5-m)**2,u[1]=.75-(m-1)**2,u[2]=.5*(m-.5)**2,g=Math.floor(e/f-.5),m=e/f-g,u[3]=.5*(1.5-m)**2,u[4]=.75-(m-1)**2,u[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let p=0;p<3;p+=1){const x=h+p,w=g+d;x<0||x>=c||w<0||w>l||(r.fV[x+w*c]+=i*u[p]*u[3+d])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:f}=a,u=a.phi,h=Math.max(1.5*s,s+2*f),m=s*s,g=h*h,d=Math.max(0,Math.floor((t-h)/f)),p=Math.min(c,Math.ceil((t+h)/f)),x=Math.max(0,Math.floor((e-h)/f)),w=Math.min(l,Math.ceil((e+h)/f));let y=0,A=0;for(let F=0;F<2;F+=1){if(F===1){if(!(y>0)||!(A>0))return!1;y=n/y,A=i/A}for(let k=x;k<=w;k+=1)for(let _=d;_<=p;_+=1){if(k<l){const b=_*f-t,M=(k+.5)*f-e,S=b*b+M*M;if(S>=m&&S<=g){const P=_+k*c,T=.5*((_>0?u[P-1]:0)+(_<c?u[P]:0));T>0&&(F===0?y+=T:r.fU[_+k*(c+1)]+=y*T)}}if(_<c){const b=(_+.5)*f-t,M=k*f-e,S=b*b+M*M;if(S>=m&&S<=g){const P=_+k*c,T=.5*((k>0?u[P-c]:0)+(k<l?u[P]:0));T>0&&(F===0?A+=T:r.fV[P]+=A*T)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const c=(n-r)/(a-r);return(1-c)*(Math.PI*s*s)/4+c*s*s}}class Xc{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function vo(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const af=8,lf=210,yo=1.805,ff=3e-7;function wo(o,t){const e=kt(t);return kt(t+2*mi(e)/o)-e}const fe=class fe{constructor(){v(this,"count",0);v(this,"fixed",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"mat",new Uint8Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"nx",new Float32Array(0));v(this,"ny",new Float32Array(0));v(this,"body",new Int16Array(0));v(this,"seg",new Int32Array(0));v(this,"t",new Float32Array(0));v(this,"pos",new Float64Array(2));v(this,"sg",new Float64Array(6))}static rRef(){if(fe.ref>0)return fe.ref;const t=kt(en),e=2*mi(t)/(an(t+1)-en);return fe.ref=lf*e,fe.ref}static draw(t,e,s,n){const i=ut[s],r=fe.rRef(),a=fe.rng;a.state=t||1;const c=Math.pow(r/i.cavRmax,yo);let l=0;for(let f=0;f<af;f+=1){l+=a.exp();const u=r*Math.pow(l/(e*i.cavScale)+c,-1/yo);if(u<ff)break;n.r.push(u),n.s.push(a.next()),n.z.push(a.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,a=[],c=[],l=[],f=[],u=[],h=[],m=[],g={r:[],s:[],z:[]};for(let A=0;A<t.n;A+=1){if(t.solid[A]===0||t.owner[A]!==0)continue;const F=A%n,k=(A-F)/n;for(let _=0;_<4;_+=1){const b=_===0?F-1:_===1?F+1:F,M=_===2?k-1:_===3?k+1:k;if(b<0||M<0||b>=n||M>=i)continue;const S=b+M*n;if(t.solid[S]===0){g.r.length=0,g.s.length=0,g.z.length=0,fe.draw(vo(e,A,_),r,t.solid[A]-1,g);for(let P=0;P<g.r.length;P+=1)a.push(A),c.push(S),l.push(_),f.push(g.r[P]),u.push(g.s[P]),h.push(g.z[P]),m.push(t.solid[A]-1)}}}const d=a.length,p=[],x=[],w=[];for(const A of s)if(!A.gone)for(let F=0;F<A.nseg;F+=1){A.segment(F,this.sg);const k=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),_=Math.max(1,Math.round(k/t.dx));for(let b=0;b<_;b+=1){g.r.length=0,g.s.length=0,g.z.length=0,fe.draw(vo(e,1e5+1e3*A.key+F,b),k/_*t.depth,A.mat,g);for(let M=0;M<g.r.length;M+=1)a.push(-1),c.push(-1),l.push(A.segS[F]),f.push(g.r[M]),u.push(g.s[M]),h.push(g.z[M]),m.push(A.mat),p.push(A.index),x.push(F),w.push((b+g.s[M])/_)}}const y=a.length;this.count=y,this.fixed=d,this.cell=Int32Array.from(a),this.fluid=Int32Array.from(c),this.dir=Uint8Array.from(l),this.r=Float32Array.from(f),this.s=Float32Array.from(u),this.z=Float32Array.from(h),this.bubble=new Uint32Array(y),this.mat=Uint8Array.from(m),this.px=new Float64Array(y),this.py=new Float64Array(y),this.nx=new Float32Array(y),this.ny=new Float32Array(y),this.body=new Int16Array(y).fill(-1),this.seg=new Int32Array(y),this.t=new Float32Array(y);for(let A=0;A<d;A+=1){const F=this.cell[A],k=F%n,_=(F-k)/n,b=this.s[A],M=this.dir[A],S=t.dx;this.px[A]=M===0?k*S:M===1?(k+1)*S:(k+b)*S,this.py[A]=M===2?_*S:M===3?(_+1)*S:(_+b)*S,this.nx[A]=M===0?-1:M===1?1:0,this.ny[A]=M===2?-1:M===3?1:0}for(let A=d;A<y;A+=1)this.body[A]=p[A-d],this.seg[A]=x[A-d],this.t[A]=w[A-d];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const a=this.t[i],c=this.sg[0]+a*(this.sg[2]-this.sg[0]),l=this.sg[1]+a*(this.sg[3]-this.sg[1]),f=Math.cos(r.a),u=Math.sin(r.a),h=r.x+f*c-u*l,m=r.y+u*c+f*l,g=f*this.sg[4]-u*this.sg[5],d=u*this.sg[4]+f*this.sg[5];this.px[i]=h,this.py[i]=m,this.nx[i]=g,this.ny[i]=d,this.dir[i]=Math.abs(g)>=Math.abs(d)?g<0?0:1:d<0?2:3;const p=t.cellAt(h-n*g,m-n*d),x=t.cellAt(h+n*g,m+n*d);this.cell[i]=p,this.fluid[i]=x>=0&&t.solid[x]===0?x:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)ut[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};v(fe,"ref",0),v(fe,"rng",new Xc(1));let ar=fe;const uf=.0208,hf=1;class df{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new ar);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new cf(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return wo(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),f=Math.floor(c),u=Math.floor(l),h=c-f,m=l-u;let g=0,d=0;for(let p=0;p<2;p+=1)for(let x=0;x<2;x+=1){const w=f+x+(u+p)*i;if(n.solid[w]!==0)continue;const y=(x===0?1-h:h)*(p===0?1-m:m);g+=y*n.pl[w],d+=y}return Math.max(.5*s.pRef,s.pRef+(d>0?g/d:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=po(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let c=0;c<i;c+=1){const l=this.cells[c];s.kind[l]===et&&(this.cells[a]=l,this.wts[a]=this.wts[c],r+=this.wts[c],a+=1)}for(let c=0;c<a;c+=1)this.wts[c]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;of(s.m,t*at,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==et){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const f=Math.max(.5*e.pRef,e.pRef+s.pl[l]),u=i.boilingAt(l,f);this.tsatCell[l]=u,i.salty&&(this.dTb[l]=u-kt(f)),this.budget[l]=i.Cl[l]*(i.Tl[l]-u)}this.Fm.fill(0),e.extremes.beginStep();const c=e.waterTemperature();if(this.bulkCold=c.mass>0&&c.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);if(this.coalesce(),e.extremes.normalize)for(let l=0;l<n.count;l+=1)n.r[l]>e.extremes.bubbleCap&&this.vent(l);for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r],c=this.sites.cell[r];if(a<0||c<0||s.kind[a]!==et||i.acc[a]<=0||i.waterShare(a)<.5||!e.heat.hasSolid(c))continue;const l=ut[this.sites.mat[r]],f=i.Tl[a],u=Ys(i.host[a],f),h=(l.k*s.Ts[c]+u*f)/(l.k+u),m=Math.max(.5*e.pRef,e.pRef+s.pl[a]),g=this.tsatCell[a]>0?this.tsatCell[a]:kt(m);if(h-g<0)continue;const d=this.sites.r[r];if(h-g<e.extremes.activation(wo(d,m)))continue;const p=m+2*Ms(i.host[a],h)/d,x=kt(p),w=4/3*Math.PI*d*d*d,y=Le(x)*w;if(y*4>i.acc[a])continue;const A=this.sites.position(this.e.grid,r,d),F=n.add(A[0],A[1],Math.min(s.depth-d,Math.max(d,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*at+Q]=y,n.r[F]=d,n.V[F]=w,n.Tb[F]=x,n.pb[F]=p,n.pv[F]=p,n.H[F]=y*xt(x),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const k=i.waterH(a);this.Fm[a]-=y,e.heat.src[c]-=y*(xt(x)-k)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=h-g,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*at;let c=i.site[t],l=0;const f=i.V[t];let u=0,h=f;for(;l<e-1e-12;){h=i.V[t];const m=i.r[t],g=Math.hypot(i.vx[t],i.vy[t]);let d=Math.min(e-l,Math.max(1e-7,hf*i.age[t]),.25*n.dx/(g+1e-9));d<1e-7&&(d=Math.min(e-l,1e-7));let p,x=-1,w=0;if(c>=0){const C=this.sites.fluid[c],E=this.sites.cell[c];if(C<0||E<0||!s.heat.hasSolid(E)){this.detach(t),c=-1;continue}const j=ut[this.sites.mat[c]],X=r.Tl[C],z=Ys(r.host[C],X);p=(j.k*n.Ts[E]+z*X)/(j.k+z),x=E}else{if(w=this.liquidFootprint(t),w===0)break;p=0;for(let C=0;C<w;C+=1)p+=this.wts[C]*r.Tl[this.cells[C]]}let y=0;if(r.salty)if(c>=0)y=this.dTb[this.sites.fluid[c]];else for(let C=0;C<w;C+=1)y+=this.wts[C]*this.dTb[this.cells[C]];const A=i.Tb[t],F=c>=0?r.host[this.sites.fluid[c]]:r.hostAt(i.x[t],i.y[t]),k=Ys(F,p),_=os(F,p),b=Tr(F,p),M=cn(F,p),S=k/(_*b),P=2*m,T=i.age[t],O=k*Math.sqrt(3/(Math.PI*S)),L=c>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),I=_*L*P/M,B=M*b/k,D=k/P*(2+.6*Math.sqrt(I)*Math.cbrt(B)),R=xt(A)-Ft(p);let V=Math.max(O*2*(Math.sqrt(T+d)-Math.sqrt(T)),D*d);if(c>=0&&p>A+y){const C=.5*this.fritz(t,p),E=i.m[a+Q]>0?i.m[a+Q]/i.V[t]:Le(A),j=V*(p-A-y)/(E*R);if(m<C&&m+j>C&&j>0){const X=V*(C-m)/j;if(D*d>=O*2*(Math.sqrt(T+d)-Math.sqrt(T)))d=X/D;else{const z=Math.sqrt(T)+X/(2*O);d=z*z-T}d=Math.max(1e-9,Math.min(e-l,d*(1+1e-6))),V=Math.max(O*2*(Math.sqrt(T+d)-Math.sqrt(T)),D*d)}}const W=n.depth,N=i.V[t],Y=i.m[a+Q]>0?i.m[a+Q]/N:Le(A),J=V*(p-A-y)/(Y*R),q=Math.max(0,m+J);let $;N<=Math.PI*W*W*W/6?$=4/3*Math.PI*(q*q*q-m*m*m):N>=Math.PI*W*W*W/4?$=Math.PI*W*(q*q-m*m):$=Math.PI*W*W*V*(p-A-y)/(Y*R);let U=Y*$*R;if(c>=0){const C=x,E=s.heat.solidCap(C)*Math.max(0,n.Ts[C]-A);if(U>0&&(U=Math.min(U,Math.max(0,E-this.used(C)))),U>0){const j=U;U=Math.min(U,s.extremes.wallLeft(C,e)),s.extremes.takeWall(C,U,j)}}else{let C=0;for(let E=0;E<w;E+=1)C+=this.wts[E]*this.budget[this.cells[E]];U>0?U=Math.min(U,Math.max(0,C)):U=Math.max(U,Math.min(0,C))}let G=U/R;G<0&&(G=Math.max(G,-i.m[a+Q]));let tt=1,pt=!1;if(c<0&&G!==0&&!r.mixed)for(let C=0;C<w&&!pt;C+=1)pt=r.acc[this.cells[C]]<=0;const wt=C=>r.acc[C]>0?r.waterShare(C):0;if(c<0&&G!==0&&(r.mixed||pt)){tt=0;for(let C=0;C<w;C+=1)tt+=this.wts[C]*wt(this.cells[C]);G*=tt}if(G!==0){if(c>=0){const C=this.sites.fluid[c];G>0&&r.acc[C]+this.Fm[C]-G<0&&(G=Math.max(0,r.acc[C]+this.Fm[C]));const E=r.waterH(C);this.Fm[C]-=G,s.heat.src[x]-=G*(xt(A)-E)/e,this.budgetSolid(x,G*(xt(A)-E))}else for(let C=0;C<w;C+=1){const E=this.cells[C],j=r.mixed||pt?this.wts[C]*wt(E)/tt:this.wts[C];if(j===0)continue;const X=r.waterH(E);this.Fm[E]-=G*j,s.heat.src[E]-=G*j*(xt(A)-X)/e,this.budget[E]-=G*j*(xt(A)-X)}i.m[a+Q]+=G,i.H[t]+=G*xt(A),u+=G}if(this.solve(t,p),this.restoreEnthalpy(t,c,w,e),i.r[t]<1e-6||i.m[a+Q]<=1e-18&&i.m[a+it]+i.m[a+ot]<=0){i.age[t]+=d;break}if(c>=0){const C=this.sites.position(this.e.grid,c,i.r[t]);i.x[t]=C[0],i.y[t]=C[1],this.departure(t,p),c=i.site[t]}else this.motion.move(t,d,(i.V[t]-h)/d);if(i.age[t]+=d,l+=d,i.m[a+Q]<=0&&i.m[a+it]+i.m[a+ot]<=0)break}i.dmdt[t]=u/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=mo(r.m,t*at,r.Tb[t],ie),c=a-r.H[t];if(c!==0){if(r.H[t]=a,e>=0){i.heat.src[this.sites.cell[e]]-=c/n;return}if(s!==0)for(let l=0;l<s;l+=1)i.heat.src[this.cells[l]]-=c*this.wts[l]/n}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=ut[this.sites.mat[i]],a=this.contactAngleOverride??r.contactAngle,c=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return uf*a*Math.sqrt(Ms(l,n.Tb[t])/(s.gy*(os(l,e)-c)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const c=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],c),this.motion.ux0[t]=c[0],this.motion.uy0[t]=c[1],n.vx[t]=c[0],n.vy[t]=c[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const f=e.cellAt(s.x[l],s.y[l]);if(f<0){this.next[l]=-1;continue}this.next[l]=this.head[f],this.head[f]=l,s.r[l]>a&&(a=s.r[l])}const c=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const f=Math.floor(s.x[l]/r),u=Math.floor(s.y[l]/r);for(let h=Math.max(0,u-c);h<=Math.min(i-1,u+c);h+=1)for(let m=Math.max(0,f-c);m<=Math.min(n-1,f+c);m+=1)for(let g=this.head[m+h*n];g>=0;g=this.next[g]){if(g<=l||s.V[g]<=0)continue;const d=s.x[g]-s.x[l],p=s.y[g]-s.y[l],x=e.depth,y=2*s.r[l]>=x||2*s.r[g]>=x?0:s.z[g]-s.z[l],A=s.r[l]+s.r[g];d*d+p*p+y*y>=A*A||this.merge(l,g)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<at;a+=1)s.m[t*at+a]+=s.m[e*at+a],s.m[e*at+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*at,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Q]<=1e-18&&i.m[r+it]+i.m[r+ot]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const c=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(c<0||n.kind[c]===H||l<0||n.kind[l]===H)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*at,a=e.extremes.bubbleCap,c=2*a<=s.depth?4/3*Math.PI*a*a*a:Math.PI*a*a*s.depth;if(!(n.V[t]>c))return;const l=1-c/n.V[t];let f=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;f>=0&&s.kind[f]!==H;)f=f+s.nx<i?f+s.nx:-1;if(f<0&&(f=xo(s,n.x[t])),f<0)return;const u=go(s,e.gas.vgas,f,l*n.V[t],this.cells,this.wts);for(let h=0;h<u;h+=1){const m=this.cells[h],g=this.wts[h];for(let d=0;d<at;d+=1)s.mg[d*i+m]+=g*l*n.m[r+d];s.Hg[m]+=g*l*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=l*n.m[r+Q],this.burstVapour+=l*n.m[r+Q];for(let h=0;h<at;h+=1)n.m[r+h]*=1-l;n.H[t]*=1-l,n.V[t]=c,n.r[t]=a}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*at,c=i.n,l=r.m[a+Q],f=r.m[a+it]+r.m[a+ot];if(e||f>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==H;)m=m+i.nx<c?m+i.nx:-1;if(m<0&&(m=xo(i,r.x[t])),m>=0){const g=go(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let d=0;d<g;d+=1){const p=this.cells[d],x=this.wts[d];for(let w=0;w<at;w+=1)i.mg[w*c+p]+=x*r.m[a+w];i.Hg[p]+=x*r.H[t],n.gas.deriveCell(p)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const g=n.phase;let d=1;if(g.mixed){d=0;for(let p=0;p<m;p+=1)d+=this.wts[p]*g.waterShare(this.cells[p])}for(let p=0;p<m;p+=1){const x=this.cells[p],w=g.mixed&&d>0?this.wts[p]*g.waterShare(x)/d:this.wts[p];if(w===0)continue;const y=g.waterH(x);this.Fm[x]+=l*w,n.heat.src[x]+=w*(r.H[t]-l*y)/s}}else{const g=i.cellAt(r.x[t],r.y[t]);g>=0&&(i.mg[Q*c+g]+=l,i.Hg[g]+=r.H[t],n.gas.deriveCell(g))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const u=r.site[t];u>=0&&(this.sites.bubble[u]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const h=r.count-1;if(t!==h){this.motion.ux0[t]=this.motion.ux0[h],this.motion.uy0[t]=this.motion.uy0[h];const m=r.site[h];m>=0&&(this.sites.bubble[m]=r.id[h])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let f=0;f<n.count;f+=1){const u=po(n.x[f],n.y[f],n.r[f],n.V[f],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let h=0;h<u;h+=1)i[this.cells[h]]+=this.wts[h]*n.V[f]*r}const a=s.alpha,c=e.liquid.volSrc,l=Qc*t;for(let f=0;f<s.n;f+=1){const u=Math.min(i[f],Math.max(0,1-s.phiS[f])),h=u-a[f];h!==0&&(h>l?(c[f]+=l*s.vCell/t,a[f]+=l):h<-l?(c[f]-=l*s.vCell/t,a[f]-=l):(c[f]+=h*s.vCell/t,a[f]=u))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,c=a.add(t,e,s);if(c<0)return-1;const l=this.pressure(t,e),f=r.grid.cellAt(t,e),u=f>=0&&r.phase.Tl[f]>0?r.phase.Tl[f]:r.ambientT,h=l+2*Ms(f>=0?r.phase.host[f]:0,u)/n,m=4/3*Math.PI*n*n*n,g=c*at;if(i<=0){const d=kt(h);a.m[g+Q]=Le(d)*m}else{const d=h*m/(8.314462618*u);a.m[g+it]=d*.79*mt[it],a.m[g+ot]=d*.21*mt[ot]}return a.r[c]=n,this.solve(c,u),a.H[c]=mo(a.m,g,a.Tb[c],ie),r.ledger.water+=a.m[g+Q],r.ledger.air+=a.m[g+it]+a.m[g+ot],r.ledger.energy+=a.H[c],this.motion.ux0[c]=0,this.motion.uy0[c]=0,c}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*at,n=t*oe;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+Q],ma:e.m[s+it]+e.m[s+ot],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+oe))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ft}}const mf=20,pf=.1,gf=2,xf=.004,vf=1.5,yf=.006,wf=2;function bf(o,t){const e=kt(o),s=Le(e),n=rn(e);return .149*Math.sqrt(s)*gc(e)*Math.pow(Math.max(0,mi(e)*t*(n-s)),.25)}class Ff{constructor(t){v(this,"pending",null);v(this,"asked",!1);v(this,"heldHeat",0);v(this,"vented",0);v(this,"slowed",0);v(this,"maxBubble",0);v(this,"maxSpeed",0);v(this,"wall",new Float64Array(0));v(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?xf:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=bf(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?pf:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,gf):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?vf:mf;let n=0;for(let r=0;r<t.count;r+=1){const a=Math.hypot(t.vx[r],t.vy[r]);if(a>s){const c=s/a;t.vx[r]*=c,t.vy[r]*=c,this.slowed+=1,n=Math.max(n,s)}else a>n&&(n=a)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>yf?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>wf&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function bo(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const Af={mass:0,energy:0},_f={m:0,H:0,s:0};function kf(o,t,e,s,n,i,r=Af,a=[],c=_f){const l=o.n;let f=0,u=0,h=0,m=0,g=0,d=0,p=0;for(let T=0;T<l;T+=1){const O=o.owner[T]!==0||o.capB[T]>0;if(o.kind[T]===ft||o.solid[T]!==0){O||(f+=o.Es[T],g+=o.film[T],d+=o.crust[T]);continue}u+=o.Hg[T],h+=o.mg[Q*l+T],m+=o.mfog[T],p+=o.mg[it*l+T]+o.mg[ot*l+T]}let x=0,w=0,y=0,A=0;for(let T=0;T<t.count;T+=1){x+=t.mass[T]*t.h[T];const O=t.smass[2*T];A+=O,t.mat[T]===lt?w+=t.mass[T]-O:y+=t.mass[T]-O}f+=r.energy;let F=0;for(const T of a)T.gone||(f+=T.energy(),g+=T.filmMass(),d+=T.crustMass(),qe(T.mat)>0&&(F+=T.m));x+=c.H,w+=c.m,A+=c.s;let k=0,_=0;for(let T=0;T<e.count;T+=1)k+=e.H[T],_+=e.m[T*at+Q],p+=e.m[T*at+it]+e.m[T*at+ot];const b=s.pvTerm();i.solids=f,i.liquid=x,i.gas=u,i.bubbles=k,i.pv=b,i.energy=f+x+u+k+b;const M=i.water;M.liquid=w,M.ice=F,M.vapour=h,M.fog=m,M.film=g,M.bubbles=_,M.escaped=n.escapedWater,M.total=w+F+h+m+g+_+n.escapedWater;const S=i.other;S.liquid=y,S.escaped=n.escapedOther,S.total=y+n.escapedOther;const P=i.salt;return P.liquid=A,P.crust=d,P.floor=r.mass,P.escaped=n.escapedSalt,P.total=A+d+r.mass+n.escapedSalt,i.air=p+n.escapedAir,i}function Mf(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0}}}function Ks(o,t){o.bodies.list.length!==0&&$l(o.bodies,t,o.ledger)}function Pf(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)Rt.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(Fn(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)Rt.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*at+Q],o.ledger.air-=n.m[i*at+it]+n.m[i*at+ot],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function Oi(o,t,e,s,n,i,r,a,c=-1){const l=o.bodies.adopt(t,e,s,o.opIndex,n,c);if(l===null)return null;i!==0&&o.bodies.turn(l,r,a,i*Math.PI/180),o.ledger.energy+=l.energy(),qe(l.mat)>0&&(o.ledger.water+=l.m),Pf(o,l);const f=o.grid,u=new Map,h=f.dx*f.dx;for(let m=0;m<l.nw;m+=1){const g=l.wc[m];u.set(g,(u.get(g)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*h))}for(const[m,g]of u)g>0&&f.solid[m]===0&&Tf(o,m,Math.min(1,g));return l}function Hn(o,t,e){const[s,n,i,r]=Us(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),f=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=c;h+=1)as(t,(h+.5)*o.dx,(u+.5)*o.dx)&&e(h+u*o.nx,h,u)}function bn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Q*s+t]+e.mfog[t],o.ledger.air-=e.mg[it*s+t]+e.mg[ot*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<at;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function Tf(o,t,e){if(e>=1){bn(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[Q*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[it*n+t]+s.mg[ot*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<at;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function Er(o,t,e,s){const n=o.grid,i=n.n;bn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Q*i+t],o.ledger.air+=n.mg[it*i+t]+n.mg[ot*i+t],o.ledger.energy+=n.Hg[t]}function Fn(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===lt?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function Dr(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function Bi(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)as(t,e.x[n],e.y[n])&&(Fn(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)as(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*at+Q],o.ledger.air-=s.m[n*at+it]+s.m[n*at+ot],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function Sf(o,t,e,s,n){const i=o.grid,r=ut[e];for(const c of t)i.owner[c]!==0&&i.solid[c]!==0||(i.solid[c]!==0?(o.ledger.energy-=i.Es[c],o.ledger.water-=i.film[c],Dr(o,c)):bn(o,c),i.owner[c]=0,i.capB[c]=0,i.fs[c]=0,i.crust[c]=0,i.solid[c]=e+1,i.role[c]=0,i.heater[c]=n,i.film[c]=0,i.T[c]=s,i.Es[c]=r.rho*r.cp*i.vCell*(s-st),i.kind[c]=ft,o.ledger.energy+=i.Es[c]);const a=o.particles;for(let c=0;c<a.count;c+=1){const l=i.cellAt(a.x[c],a.y[c]);l<0||i.solid[l]===0||(Fn(o,c),o.liquid.removeParticle(c),c-=1)}o.solidsChanged()}function Cf(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],Dr(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&Er(o,n,o.ambientT,o.ambientY)}}function Lf(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){Bi(o,t.region);const p=new Float64Array(at);let x=0;for(const[w,y]of Object.entries(t.composition)){const A=w==="N2"?it:w==="O2"?ot:w==="H2O"?Q:-1;A>=0&&(p[A]=y,x+=y)}if(x<=0)p.set(o.ambientY.subarray(0,at));else for(let w=0;w<yt;w+=1)p[w]/=x;return Hn(e,t.region,w=>{e.solid[w]===0&&Er(o,w,t.T,p)}),null}Bi(o,t.region);const s=ce.length;let n=0;for(const[p,x]of Object.entries(t.composition))Ic(p)>=0&&x>0&&(n+=x);const i=t.composition[ce[lt].id]??0,r=n>0&&i>0?n/(n+i):0,a=p=>p===lt&&r>0?Or(t.T,r):os(p,t.T),c=new Float64Array(s);let l=0;for(const[p,x]of Object.entries(t.composition)){const w=Ac(p);if(w<0||!(x>0))continue;const y=w===lt&&r>0?x+n:x;c[w]+=y/a(w),l+=y/a(w)}if(l<=0)return"fill: no known liquid in the composition";for(let p=0;p<s;p+=1)c[p]/=l;const f=new Float64Array(s),u=new Float64Array(s);for(let p=0;p<s;p+=1)f[p]=a(p)*e.vCell/4,u[p]=p===lt&&r>0?Hc(t.T,r):Ra(p,t.T);const h=r*f[lt],m=new Float64Array(s),g=o.particles;let d=!1;return Of(e,t.region,(p,x)=>{const w=p+x*e.nx;if(e.solid[w]!==0)return;let y=0;for(let A=0;A<2;A+=1)for(let F=0;F<2;F+=1){const k=(p+.25+.5*F)*e.dx,_=(x+.25+.5*A)*e.dx;if(!as(t.region,k,_)||e.owner[w]!==0&&o.bodies.bodyAt(k,_,0)!==null)continue;let b=0;for(let T=0;T<s;T+=1)m[T]+=c[T],m[T]>m[b]&&(b=T);m[b]-=1;const M=f[b],S=u[b],P=b===lt?h:0;if(g.add(k,_,M,S,b,P)<0){d=!0;continue}y+=1,b===lt?o.ledger.water+=M-P:o.ledger.other+=M,o.ledger.salt+=P,o.ledger.energy+=M*S}y===4&&bn(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":d?"fill: particle capacity reached":null}case"erase":{Ks(o,t.region),Bi(o,t.region);const s=[];return Hn(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),Cf(o,s),null}case"move":{if(t.region!==null)return Fo(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(c=>!c.gone&&c.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const c of s)c.worldBox(c.x,c.y,c.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,a=c=>s.includes(c)?!0:(c.worldBox(c.x,c.y,c.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return Fo(o,{rect:i},t.dx,t.dy,a),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if(Kl(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=As(t.material);if(s<0)return`solid: unknown material ${t.material}`;Ks(o,t.region);const n=[];if(Hn(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,c]=t.region.line,l=Math.ceil(Math.hypot(a-i,c-r)/(.5*e.dx))+1;for(let f=0;f<=l;f+=1){const u=e.cellAt(i+(a-i)*f/l,r+(c-r)*f/l);u>=0&&!n.includes(u)&&n.push(u)}}return o.bodies.sync(),Sf(o,n,s,t.T,-1),null}case"body":{const s=As(t.material);if(s<0)return`body: unknown material ${t.material}`;Ks(o,t.region);const n=t.region;let i=null,r,a=t.angle,c,l;if("line"in n){const[f,u,h,m]=n.line,g=Math.max(n.width,Math.hypot(h-f,m-u));c=(f+h)/2,l=(u+m)/2,r=[c-g/2,l-n.width/2,c+g/2,l+n.width/2],a+=Math.atan2(m-u,h-f)*180/Math.PI}else if("circle"in n){const[f,u,h]=n.circle,m=.5*h*Math.sqrt(Math.PI);r=[f-m,u-m,f+m,u+m],c=f,l=u,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[f,u,h,m]=Us(n);r=[f,u,h,m],c=(f+h)/2,l=(u+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return Oi(o,[r],s,t.T,t.pinned,a,c,l),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=As(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,c=t.y+t.h,l=t.lid?c-n:c,f=[[i,a,r,a+n],[i,a+n,i+n,l],[r-n,a+n,r,l]];t.lid&&f.push([i,l,r,c]);for(const u of f)Ks(o,{rect:[...u]});return Oi(o,f,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=As(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return Ks(o,{rect:[...i]}),Oi(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function Fo(o,t,e,s,n){const i=o.grid,{nx:r,ny:a,dx:c}=i,l=[];Hn(i,t,w=>{i.solid[w]!==0&&i.owner[w]===0&&l.push(w)});const f=Math.round(e/c),u=Math.round(s/c),h=l.length>0?f*c:e,m=l.length>0?u*c:s;if(h===0&&m===0)return;const g=o.bodies.list.length>0?Wl(o.bodies,t,n):[],d=o.particles,p=o.bubbles;for(let w=0;w<d.count;w+=1){if(!as(t,d.x[w],d.y[w]))continue;const y=d.x[w]+h,A=d.y[w]+m;if(y<=0||A<=0||y>=i.w||A>=i.h){Fn(o,w),o.liquid.removeParticle(w),w-=1;continue}d.x[w]=y,d.y[w]=A}for(let w=0;w<p.count;w+=1)as(t,p.x[w],p.y[w])&&(p.x[w]=Math.min(i.w-1e-6,Math.max(1e-6,p.x[w]+h)),p.y[w]=Math.min(i.h-1e-6,Math.max(1e-6,p.y[w]+m)),p.site[w]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(g.length===0)return;ao(o.bodies,g,h,m),o.bodies.sync();for(const w of g)o.bodies.cover.pushOut(w,w.x,w.y,w.a);Ao(o);return}const x=l.map(w=>({c:w,s:i.solid[w],role:i.role[w],heater:i.heater[w],T:i.T[w],Es:i.Es[w],film:i.film[w],crust:i.crust[w]}));for(const w of x)o.ledger.energy-=w.Es,o.ledger.water-=w.film,o.ledger.salt-=w.crust,i.solid[w.c]=0,i.role[w.c]=0,i.heater[w.c]=-1,i.Es[w.c]=0,i.film[w.c]=0,i.crust[w.c]=0,i.kind[w.c]=0;for(const w of x){const y=w.c%r+f,A=Math.floor(w.c/r)+u;if(y<0||A<0||y>=r||A>=a)continue;const F=y+A*r;i.solid[F]!==0?(o.ledger.energy-=i.Es[F],o.ledger.water-=i.film[F],Dr(o,F)):bn(o,F),i.solid[F]=w.s,i.role[F]=w.role,i.heater[F]=w.heater,i.T[F]=w.T,i.Es[F]=w.Es,i.film[F]=w.film,i.crust[F]=w.crust,i.kind[F]=ft,o.ledger.energy+=w.Es,o.ledger.water+=w.film,o.ledger.salt+=w.crust}ao(o.bodies,g,h,m),o.solidsChanged();for(const w of g)o.bodies.cover.pushOut(w,w.x,w.y,w.a);Ao(o);for(const w of x)i.solid[w.c]===0&&o.gas.massOf(w.c)<=0&&Er(o,w.c,o.ambientT,o.ambientY)}function Ao(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(Fn(o,s),o.liquid.removeParticle(s),s-=1)}}function Of(o,t,e){const[s,n,i,r]=Us(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),f=Math.min(o.ny-1,Math.floor(r/o.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=c;h+=1)e(h,u)}const lr="recreatio/lab2d",Bf=o=>o==="ask"||o==="compute"||o==="normalize",jf={"very-high":.001,high:.002,medium:.003},qf=o=>o==="very-high"||o==="high"||o==="medium",If=16e4,js=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function zs(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const vt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Mt=(o,t,e)=>Math.min(e,Math.max(t,o)),Xe=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},Bn=(o,t)=>o==="wall"||o==="open"?o:t,_o=.25*di,ji=2*di;function ko(o){const t={};let e=0;for(const[s,n]of Object.entries(Xe(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Rf(o,t,e){const s=Xe(o),n=st+vt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return As(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=$s(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",c=ko(s.composition),l=h=>a==="gas"?h==="N2"||h==="O2"||h==="H2O":Ac(h)>=0||Ic(h)>=0,f={};for(const[h,m]of Object.entries(c))l(h)?f[h]=m:t.push(`ops[${e}]: unknown ${a} "${h}" dropped`);const u=Object.keys(f).length>0?ko(f):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:u}}case"erase":{const r=$s(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Mt(vt(s.dx,0),-1,1),a=Mt(vt(s.dy,0),-1,1),c=zs(s.id);if(c!=="")return{op:"move",region:null,id:c,dx:r,dy:a};const l=$s(s.region);if(l===null)break;return{op:"move",region:l,id:null,dx:r,dy:a}}case"remove":{const r=zs(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=$s(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:zs(s.id),x:vt(s.x,.1),y:vt(s.y,0),w:Mt(vt(s.w,.07),.01,1),h:Mt(vt(s.h,.09),.01,1),wall:Mt(vt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Mt(vt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:zs(s.id),x:vt(s.x,.1),y:vt(s.y,0),w:Mt(vt(s.w,.12),.005,1),h:Mt(vt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Mt(vt(s.power,40),0,2e3),target:st+Mt(vt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Mt(vt(s.angle,0),-180,180)};case"body":{const r=$s(s.region);if(r===null)break;return{op:"body",id:zs(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Mt(vt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:vt(s.x,0),y:vt(s.y,0),pinned:s.pinned!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function Yc(o,t,e=new Set){const s=new Set(e);for(const i of o)js(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function Ef(o,t){const e=new Set;for(const r of o)js(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>Yc([],r,new Set([...s,...e])),i=[];return o.forEach((r,a)=>{if(js(r)){let c=r.id;if(c==="")c=n(r.op);else if(s.has(c)){const l=n(r.op);t.push(`ops[${a}]: the name "${c}" is used twice, renamed to "${l}"`),c=l}s.add(c),i.push({...r,id:c});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const c=r.id;if(!s.has(c)){t.push(`ops[${a}]: no object "${c}" before this step`);return}}i.push(r)}),i}function qi(o,t={}){const e=Xe(o),s=[];e.format!==void 0&&e.format!==lr&&s.push(`format "${String(e.format)}" is not ${lr}`);const n=Xe(e.box),i=Xe(e.ambient),r=Xe(i.air),a=Xe(e.sides),c=vt(i.g,di),l=t.harness===!0?Mt(c,0,ji):Mt(c,_o,ji);l!==c&&s.push(`ambient.g ${c} m/s² is outside ${_o.toFixed(2)}–${ji.toFixed(2)}, using ${l.toFixed(2)}`);const f=vt(r.N2,.7676),u=vt(r.O2,.2324),h=f+u>0?f+u:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((d,p)=>{const x=Rf(d,s,p);x!==null&&m.push(x)});const g=Ef(m,s);return{scene:{seed:Math.floor(vt(e.seed,1))>>>0,box:{w:Mt(vt(n.w,.2),.02,.6),h:Mt(vt(n.h,.15),.02,.4),depth:Mt(vt(n.depth,.01),.002,.05)},ambient:{p:Mt(vt(i.p,en/1e3),20,400)*1e3,T:st+Mt(vt(i.T,20),-20,100),rh:Mt(vt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,f)/h,O2:Math.max(0,u)/h}},sides:{left:Bn(a.left,"wall"),right:Bn(a.right,"wall"),bottom:Bn(a.bottom,"wall"),top:Bn(a.top,"open")},quality:qf(e.quality)?e.quality:"high",extremes:Bf(e.extremes)?e.extremes:"ask",ops:g},warnings:s}}const jt=(o,t=6)=>Number(o.toFixed(t));function Df(o){switch(o.op){case"fill":return{op:"fill",region:Ws(o.region),composition:{...o.composition},phase:o.phase,T:jt(o.T-st,3)};case"erase":return{op:"erase",region:Ws(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:jt(o.dx),dy:jt(o.dy)}:{op:"move",region:Ws(o.region),dx:jt(o.dx),dy:jt(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:Ws(o.region),material:o.material,T:jt(o.T-st,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:jt(o.T-st,3),...o.lid?{lid:!0}:{},...Mo(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:jt(o.target-st,3),on:o.on,T:jt(o.T-st,3),...Mo(o)};case"body":return{op:"body",id:o.id,region:Ws(o.region),material:o.material,T:jt(o.T-st,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:jt(o.angle,4)}:{}};case"pin":return{op:"pin",x:jt(o.x),y:jt(o.y),pinned:o.pinned}}}const Mo=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:jt(o.angle,4)}:{}});function Vf(o){return{format:lr,version:1,seed:o.seed,box:{...o.box},ambient:{p:jt(o.ambient.p/1e3,4),T:jt(o.ambient.T-st,3),rh:o.ambient.rh,g:jt(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(Df)}}const Nf=new Set(["pinned","mode","power","target","on"]);function oi(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(js(n)&&n.id===t)return s}return-1}function Uf(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&As(t.material)>=0?t.material:o.material,r=(a,c,l,f)=>a===void 0||!Number.isFinite(a)?c:Math.max(l,Math.min(f,a));switch(o.op){case"body":{const[a,c,l,f]=Us(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const u=(a+l)/2,h=(c+f)/2,m=r(t.w,l-a,.002,.5),g=r(t.h,f-c,.002,.5);return{...o,region:{rect:[u-m/2,h-g/2,u+m/2,h+g/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function Gf(o,t,e){const s=oi(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=Uf(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([c,l])=>l!==void 0&&!Nf.has(c)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const c of o.bodies.list)c.gone||c.key!==s||(e.pinned!==void 0&&o.bodies.pin(c,e.pinned),i.op==="hotplate"&&c.heater>=0&&o.setHeater(c.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function Hf(o,t){const e=oi(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,a=0,c="gone";for(const l of o.bodies.list){if(l.gone||l.key!==e)continue;const f=Math.cos(l.a),u=Math.sin(l.a);for(let g=0;g<l.nr;g+=1){const[d,p,x,w]=l.bounds(g);for(const[y,A]of[[d,p],[x,p],[x,w],[d,w]])n.push(l.x+f*y-u*A,l.y+u*y+f*A)}i+=l.m;const h=l.m*ut[l.mat].cp;r+=h*l.meanT(),a+=h;const m=l.pinned?"pinned":l.asleep?"asleep":"moving";(c==="gone"||m==="moving")&&(c=m)}return{id:t,kind:s.op,outline:n,T:a>0?r/a:s.T,mass:i,state:c}}const $f=.02;function Wf(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function Kf(o,t){const e=2*Math.max(0,o-$f)*t;return e>1e-8?e/Wf(e):1}function zf(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:a}=o,c=s+1,l=(y,A)=>.5*(r[y+A*c]+r[y+1+A*c]),f=(y,A)=>.5*(a[y+A*s]+a[y+(A+1)*s]),u=(r[t+1+e*c]-r[t+e*c])/i,h=(a[t+(e+1)*s]-a[t+e*s])/i,m=Math.max(0,e-1),g=Math.min(n-1,e+1),d=Math.max(0,t-1),p=Math.min(s-1,t+1),x=g>m?(l(t,g)-l(t,m))/((g-m)*i):0,w=p>d?(f(p,e)-f(d,e))/((p-d)*i):0;return Math.hypot(.5*(u-h),.5*(x+w))}class Qf{constructor(t){v(this,"e");v(this,"cap");v(this,"capT");v(this,"capA");v(this,"salt");v(this,"water");v(this,"fH");v(this,"fS");v(this,"outS");v(this,"outH");v(this,"inS");v(this,"inH");v(this,"cell",new Int32Array(0));v(this,"cpp",new Float64Array(0));v(this,"ds",new Float64Array(0));v(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:a,salt:c,water:l,fH:f,fS:u,cell:h,cpp:m}=this;i.fill(0),r.fill(0),a.fill(0),c.fill(0),l.fill(0);let g=!1;for(let y=0;y<e.count;y+=1){const A=s.cellAt(e.x[y],e.y[y]);if(h[y]=A,A<0)continue;const F=e.cp(y);m[y]=F;const k=e.mass[y]*F,_=e.T[y];if(i[A]+=k,r[A]+=k*_,a[A]+=k*Ys(e.mat[y],_)/(e.rho[y]*F),e.mat[y]!==lt)continue;const b=e.smass[2*y];c[A]+=b,l[A]+=e.mass[y]-b,b>0&&(g=!0)}const{nx:d,ny:p,kind:x}=s,w=Math.PI*Math.PI*t/(s.dx*s.dx);for(let y=0;y<s.n;y+=1){if(f[y]=0,u[y]=0,!(i[y]>0))continue;const A=y%d,F=(y-A)/d;if(!(x[y]!==et&&(x[y]!==H||!(A>0&&x[y-1]===et||A<d-1&&x[y+1]===et||F>0&&x[y-d]===et||F<p-1&&x[y+d]===et)))&&(f[y]=1-Math.exp(-w*a[y]/i[y]),g&&c[y]>0)){const k=Zr(r[y]/i[y]);u[y]=1-Math.exp(-w*k*Kf(zf(s,A,F),t/(w*k)))}}for(let y=0;y<e.count;y+=1){const A=h[y];if(A<0||f[A]===0)continue;const F=f[A]*(r[A]/i[A]-e.T[y]);if(F===0)continue;const k=e.mass[y]/e.rho[y];e.h[y]+=m[y]*F,e.derive(y),n.dVp[y]+=e.mass[y]/e.rho[y]-k}g&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:a,outH:c,inS:l,inH:f,cell:u,ds:h,hs:m}=this;a.fill(0),c.fill(0);for(let d=0;d<e.count;d+=1){h[d]=0;const p=u[d];if(p<0||r[p]===0||e.mat[d]!==lt)continue;const x=e.smass[2*d],w=r[p]*(n[p]/i[p]*(e.mass[d]-x)-x);if(h[d]=w,w<0){const y=Jr(e.T[d],x/e.mass[d]);m[d]=y,a[p]-=w,c[p]-=w*y}}const g=this.saltBetween(t);for(let d=0;d<e.count;d+=1){const p=u[d];if(p<0||e.mat[d]!==lt)continue;let x=h[d],w=0;x<0?w=x*m[d]:x>0&&(a[p]>0?w=x*c[p]/a[p]:x=0);const y=e.smass[2*d],A=e.mass[d];if(g&&(l[p]!==0||f[p]!==0)){const _=l[p]<0?y/n[p]:(A-y)/i[p];x+=l[p]*_,w+=f[p]*_}if(x===0&&w===0)continue;const F=A*e.h[d]+w,k=A/e.rho[d];e.mass[d]=A+x,e.smass[2*d]=y+x,e.spc[2*d]=y+x>0?Cr:0,e.h[d]=F/e.mass[d],e.derive(d),s.dVp[d]+=e.mass[d]/e.rho[d]-k}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:a,inS:c,inH:l}=this,{nx:f,ny:u}=e;c.fill(0),l.fill(0);const h=t/(e.dx*e.dx);let m=!1;const g=(d,p,x)=>{if(i[p]===0||!(n[p]>0)||!(x>0))return;const w=s[d]/n[d],y=s[p]/n[p];if(w===y)return;const A=w>y?d:p,F=w>y?p:d,k=Zr(.5*(a[d]/r[d]+a[p]/r[p])),_=(x<1?x*k:k)*h*Math.min(n[d],n[p])*Math.abs(w-y),b=Jr(a[A]/r[A],s[A]/(s[A]+n[A]));c[A]-=_,l[A]-=_*b,c[F]+=_,l[F]+=_*b,m=!0};for(let d=0;d<u;d+=1)for(let p=0;p<f;p+=1){const x=p+d*f;i[x]===0||!(n[x]>0)||(p+1<f&&g(x,x+1,e.au[p+1+d*(f+1)]),d+1<u&&g(x,x+f,e.av[x+f]))}return m}}const Nt=yt+2,se=yt,le=yt+1,Xf=.9,Yf=16;class Zs{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Nt*s),this.fu=new Float64Array(Nt*t.nu),this.fv=new Float64Array(Nt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,c=s+1,l=e.ug,f=e.vg;let u=0,h=0;for(let A=0;A<n;A+=1)for(let F=0;F<s;F+=1){const k=F+A*s;if(r[k]!==H)continue;const _=F+A*c,b=l[_],M=l[_+1],S=f[k],P=f[k+s],T=(b<0?-b:0)+(M>0?M:0)+(S<0?-S:0)+(P>0?P:0);T>u&&(u=T);const O=Math.max(b<0?-b:b,M<0?-M:M,S<0?-S:S,P<0?-P:P);O>h&&(h=O)}this.gas.last.uMax=h;const m=Math.min(Yf,Math.max(1,Math.ceil(u*t/a/Xf))),g=t/m,{conc:d}=this,p=this.gas.vgas,x=e.mg,w=e.mfog,y=e.Hg;for(let A=0;A<m;A+=1){for(let F=0;F<i;F+=1){if(r[F]!==H){for(let _=0;_<Nt;_+=1)d[_*i+F]=0;continue}const k=1/p[F];for(let _=0;_<yt;_+=1)d[_*i+F]=x[_*i+F]*k;d[se*i+F]=w[F]*k,d[le*i+F]=y[F]*k}this.fluxesU(g),this.fluxesV(g),this.limitOutflow(),this.applyFluxes()}for(let A=0;A<i;A+=1)r[A]===H&&this.gas.deriveCell(A);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,c=e.nu,l=e.ug,{conc:f,fu:u}=this,{amb:h,gasU:m}=this.gas,g=e.aFace,d=Zs.face;for(let p=0;p<n;p+=1){const x=p*s,w=p*a;for(let y=0;y<=s;y+=1){const A=w+y,F=l[A];if(m[A]===0||F===0){for(let S=0;S<Nt;S+=1)u[S*c+A]=0;continue}const k=e.au[A]<1?F*g*t*e.au[A]:F*g*t;if(y===0||y===s){const S=y===0?x:x+s-1,P=y===0?F>0:F<0;for(let T=0;T<Nt;T+=1)u[T*c+A]=k*(P?h[T]:f[T*i+S]);continue}let _,b,M;if(F>0?(_=x+y-1,b=x+y,M=y>=2&&r[x+y-2]===H?x+y-2:-1):(_=x+y,b=x+y-1,M=y+1<s&&r[x+y+1]===H?x+y+1:-1),M<0){for(let S=0;S<Nt;S+=1)u[S*c+A]=k*f[S*i+_];continue}for(let S=0;S<Nt;S+=1){const P=S*i;u[S*c+A]=k*d(f[P+_],f[P+M],f[P+b])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,c=e.vg,{conc:l,fv:f}=this,{amb:u,gasV:h}=this.gas,m=e.aFace,g=Zs.face;for(let d=0;d<=n;d+=1){const p=d*s;for(let x=0;x<s;x+=1){const w=p+x,y=c[w];if(h[w]===0||y===0){for(let b=0;b<Nt;b+=1)f[b*a+w]=0;continue}const A=e.av[w]<1?y*m*t*e.av[w]:y*m*t;if(d===0||d===n){const b=d===0?x:x+(n-1)*s,M=d===0?y>0:y<0;for(let S=0;S<Nt;S+=1)f[S*a+w]=A*(M?u[S]:l[S*i+b]);continue}let F,k,_;if(y>0?(F=w-s,k=w,_=d>=2&&r[w-2*s]===H?w-2*s:-1):(F=w,k=w-s,_=d+1<n&&r[w+s]===H?w+s:-1),_<0){for(let b=0;b<Nt;b+=1)f[b*a+w]=A*l[b*i+F];continue}for(let b=0;b<Nt;b+=1){const M=b*i;f[b*a+w]=A*g(l[M+F],l[M+_],l[M+k])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:c,fv:l}=this,{gasU:f,gasV:u,escaped:h}=this.gas,m=t.mg,g=t.mfog,d=t.Hg;for(let p=0;p<s;p+=1){const x=p*e,w=p*i;for(let A=1;A<e;A+=1){const F=w+A;if(f[F]===0)continue;const k=x+A-1,_=k+1;for(let S=0;S<yt;S+=1){const P=c[S*r+F];m[S*n+k]-=P,m[S*n+_]+=P}const b=c[se*r+F];g[k]-=b,g[_]+=b;const M=c[le*r+F];d[k]-=M,d[_]+=M}if(f[w]!==0){const A=x;for(let _=0;_<yt;_+=1){const b=c[_*r+w];m[_*n+A]+=b,h[_]-=b}const F=c[se*r+w];g[A]+=F,h[se]-=F;const k=c[le*r+w];d[A]+=k,h[le]-=k}const y=w+e;if(f[y]!==0){const A=x+e-1;for(let _=0;_<yt;_+=1){const b=c[_*r+y];m[_*n+A]-=b,h[_]+=b}const F=c[se*r+y];g[A]-=F,h[se]+=F;const k=c[le*r+y];d[A]-=k,h[le]+=k}}for(let p=1;p<s;p+=1){const x=p*e;for(let w=0;w<e;w+=1){const y=x+w;if(u[y]===0)continue;const A=y-e,F=y;for(let b=0;b<yt;b+=1){const M=l[b*a+y];m[b*n+A]-=M,m[b*n+F]+=M}const k=l[se*a+y];g[A]-=k,g[F]+=k;const _=l[le*a+y];d[A]-=_,d[F]+=_}}for(let p=0;p<e;p+=1){if(u[p]!==0){const w=p;for(let F=0;F<yt;F+=1){const k=l[F*a+p];m[F*n+w]+=k,h[F]-=k}const y=l[se*a+p];g[w]+=y,h[se]-=y;const A=l[le*a+p];d[w]+=A,h[le]-=A}const x=p+s*e;if(u[x]!==0){const w=p+(s-1)*e;for(let F=0;F<yt;F+=1){const k=l[F*a+x];m[F*n+w]-=k,h[F]+=k}const y=l[se*a+x];g[w]-=y,h[se]+=y;const A=l[le*a+x];d[w]-=A,h[le]+=A}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:c,scale:l}=this,f=t.nu,u=t.nv;c.fill(0);const h=Zs.massFlux,{gasU:m,gasV:g}=this.gas;for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*i;if(m[w]===0)continue;const y=h(r,f,w);y>0&&x>0?c[x-1+p*e]+=y:y<0&&x<e&&(c[x+p*e]-=y)}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(g[w]===0)continue;const y=h(a,u,w);y>0&&p>0?c[x+(p-1)*e]+=y:y<0&&p<s&&(c[x+p*e]-=y)}let d=!1;for(let p=0;p<n;p+=1){const x=.9*this.gas.massOf(p);l[p]=c[p]>x&&c[p]>0?x/c[p]:1,l[p]<1&&(d=!0)}if(d){for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*i;if(m[w]===0)continue;const A=h(r,f,w)>0?x>0?x-1+p*e:-1:x<e?x+p*e:-1;if(!(A<0||l[A]>=1))for(let F=0;F<Nt;F+=1)r[F*f+w]*=l[A]}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(g[w]===0)continue;const A=h(a,u,w)>0?p>0?x+(p-1)*e:-1:p<s?x+p*e:-1;if(!(A<0||l[A]>=1))for(let F=0;F<Nt;F+=1)a[F*u+w]*=l[A]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=se;i+=1)n+=t[i*e+s];return n}}const Xt=.05;class Jf{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(Nt));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(Nt));v(this,"dp0",new Float64Array(8));v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new Zs(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<yt;a+=1)n+=s[a]/mt[a];const i=e/(qt*t*n);let r=0;for(let a=0;a<yt;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*ie(a,t);this.amb[se]=0,this.amb[le]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*Ft(e);for(let r=0;r<yt;r+=1)i+=s.mg[r*n+t]*ie(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return er(s.mg[t],s.mg[n+t],s.mg[Q*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[Q*s+t],c=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/mt[0]+r/mt[1]+a/mt[Q],l+c<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let f;if(c<=0)f=wc(i,r,a,e.Hg[t]);else{f=e.T[t]>100?e.T[t]:this.ambT;for(let u=0;u<4;u+=1){const h=(e.Hg[t]-this.enthalpy(t,f))/this.heatCapacity(t,f);if(f+=h,Math.abs(h)<1e-10)break}}f>150&&f<3e3||(f=Math.min(3e3,Math.max(150,Number.isFinite(f)?f:this.ambT))),e.T[t]=f,this.cap[t]=er(i,r,a,c,f),this.rho[t]=l/n,this.mu[t]=Ba(i,r,a,f)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ft){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===et&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*qt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ft){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Q*e+s];if(t.kind[s]===et&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*qt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ft||this.vgas[e]<=0?0:this.nmol[e]*qt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<yt;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let c=0;for(let u=0;u<yt;u+=1)c+=s[u]/mt[u];const l=this.R.pAt(t)*a/(qt*e*c);let f=0;for(let u=0;u<yt;u+=1)i.mg[u*r+t]=l*s[u],f+=l*s[u]*ie(u,e);i.mfog[t]=0,i.Hg[t]=f,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let a=0;a<n;a+=1){const c=t[a],l=i[a];if(c===l||l===ft||c===ft)continue;r+=1;const f=a%s,u=(a-f)/s;let h=0;for(let m=0;m<4;m+=1){const g=this.across(a,f,u,m);g>=0&&i[g]===H&&t[g]===H&&(h+=this.vgas[g]>0?this.vgas[g]:e.vCell)}if(!(h<=0)){if(l===et)for(let m=0;m<4;m+=1){const g=this.across(a,f,u,m);if(g<0||i[g]!==H||t[g]!==H)continue;const d=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h;this.move(a,g,d)}else{let m=this.massOf(a),g=0;for(let d=0;d<4;d+=1){const p=this.across(a,f,u,d);if(p<0||i[p]!==H||t[p]!==H)continue;const x=(this.vgas[p]>0?this.vgas[p]:e.vCell)/h;g+=x*this.rho[p]}if(g*=Math.max(.001,1-e.fs[a]-e.phi[a]-e.alpha[a])*e.vCell,g<=m)continue;for(let d=0;d<4;d+=1){const p=this.across(a,f,u,d);if(p<0||i[p]!==H||t[p]!==H)continue;const x=(this.vgas[p]>0?this.vgas[p]:e.vCell)/h,w=this.massOf(p);if(w<=0)continue;const y=Math.min(.25,(g-m)*x/w);this.move(p,a,y)}m=this.massOf(a),m>0&&(e.T[a]=this.ambT)}this.deriveCell(a)}}return r}across(t,e,s,n){const i=this.g,{nx:r,ny:a}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<a-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let c=0;c<yt;c+=1){const l=n.mg[c*i+t]*s;n.mg[c*i+t]-=l,n.mg[c*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let c=0;c<s;c+=1)for(let l=0;l<=e;l+=1){const f=l+c*i,u=l>0?n[l-1+c*e]:-1,h=l<e?n[l+c*e]:-1;let m=0;(u===H&&h===H||l===0&&t.openL&&h===H||l===e&&t.openR&&u===H)&&(m=1),t.au[f]<=0&&(m=0),this.gasU[f]=m,m===0&&(r[f]=u===et||h===et?u===ft||h===ft||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[f]:t.usol[f])}for(let c=0;c<=s;c+=1)for(let l=0;l<e;l+=1){const f=l+c*e,u=c>0?n[l+(c-1)*e]:-1,h=c<s?n[l+c*e]:-1;let m=0;(u===H&&h===H||c===0&&t.openB&&h===H||c===s&&t.openT&&u===H)&&(m=1),t.av[f]<=0&&(m=0),this.gasV[f]=m,m===0&&(a[f]=u===et||h===et?u===ft||h===ft||c===0&&!t.openB||c===s&&!t.openT?0:t.vl[f]:t.vsol[f])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),f=Math.min(r-1.000001,Math.max(0,s/a-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,g=f-h,d=t[u+h*c],p=t[u+1+h*c],x=t[u+(h+1)*c],w=t[u+1+(h+1)*c];return this.lo=Math.min(d,p,x,w),this.hi=Math.max(d,p,x,w),(1-g)*((1-m)*d+m*p)+g*((1-m)*x+m*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),f=Math.floor(c),u=Math.floor(l),h=c-f,m=l-u,g=t[f+u*i],d=t[f+1+u*i],p=t[f+(u+1)*i],x=t[f+1+(u+1)*i];return this.lo=Math.min(g,d,p,x),this.hi=Math.max(g,d,p,x),(1-m)*((1-h)*g+h*d)+m*((1-h)*p+h*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,c=n+1,l=s.ug,f=s.vg,{u0:u,v0:h,u1:m,v1:g}=this,d=this.lim;u.set(l),h.set(f);for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*c;if(this.gasU[F]===0){m[F]=u[F];continue}const k=A*r,_=(y+.5)*r,b=this.sampleV(h,k,_);m[F]=this.sampleU(u,k-t*u[F],_-t*b),d[2*F]=this.lo,d[2*F+1]=this.hi}const p=2*s.nu;for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0){g[F]=h[F];continue}const k=(A+.5)*r,_=y*r,b=this.sampleU(u,k,_);g[F]=this.sampleV(h,k-t*b,_-t*h[F]),d[p+2*F]=this.lo,d[p+2*F+1]=this.hi}for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*c;if(this.gasU[F]===0)continue;const k=A*r,_=(y+.5)*r,b=this.sampleV(h,k,_),M=this.sampleU(m,k+t*u[F],_+t*b);let S=m[F]+.5*(u[F]-M);(S<d[2*F]||S>d[2*F+1])&&(S=m[F]),l[F]=S}for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const k=(A+.5)*r,_=y*r,b=this.sampleU(u,k,_),M=this.sampleV(g,k+t*b,_+t*h[F]);let S=g[F]+.5*(h[F]-M);(S<d[p+2*F]||S>d[p+2*F+1])&&(S=g[F]),f[F]=S}const x=this.R;for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const k=y>0?A+(y-1)*n:-1,_=y<i?A+y*n:-1,b=k>=0&&a[k]===H?this.rho[k]:-1,M=_>=0&&a[_]===H?this.rho[_]:-1,S=Math.max(Xt,b>0&&M>0?.5*(b+M):Math.max(b,M));if(!(b>0||M>0))continue;const P=b>0?k:_,T=x.id[P],O=T>=0?x.rhoBar[T]:x.rhoAmb;f[F]-=t*e*(S-O)/S}m.set(l),g.set(f);const w=t/(r*r);for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*c;if(this.gasU[F]===0)continue;const k=A<n&&a[A+y*n]===H?A+y*n:A-1+y*n,_=this.mu[k]/Math.max(Xt,this.rho[k]),b=m[F],M=A<n?m[F+1]:b,S=A>0?m[F-1]:b,P=y>0?m[F-c]:s.openB?b:-b,T=y<i-1?m[F+c]:s.openT?b:-b;l[F]=b+Math.min(.2,w*_)*(M+S+P+T-4*b)}for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const k=y<i&&a[A+y*n]===H?A+y*n:A+(y-1)*n,_=this.mu[k]/Math.max(Xt,this.rho[k]),b=g[F],M=y<i?g[F+n]:b,S=y>0?g[F-n]:b,P=A>0?g[F-1]:s.openL?b:-b,T=A<n-1?g[F+1]:s.openR?b:-b;f[F]=b+Math.min(.2,w*_)*(T+P+S+M-4*b)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==H){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:c}=n,l=i+1,f=n.ug,u=n.vg;let h=i,m=-1,g=r,d=-1,p=0;for(let _=0;_<r;_+=1)for(let b=0;b<i;b+=1)c[b+_*i]===H&&(p+=1,b<h&&(h=b),b>m&&(m=b),_<g&&(g=_),_>d&&(d=_));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=p,p===0)return this.last;const w=this.solver,y=w.begin(m-h+1,d-g+1),A=this.rho;for(let _=g;_<=d;_+=1)for(let b=h;b<=m;b+=1){const M=b+_*i;if(c[M]!==H)continue;const S=w.at(b-h,_-g);y.act[S]=1,y.x[S]=n.pg[M];const P=b+_*l,T=b+_*i,O=this.fluxU(P+1)-this.fluxU(P)+this.fluxV(T+i)-this.fluxV(T);y.b[S]=n.Sg[M]*a*a-a*O;const L=Math.max(Xt,A[M]);b+1<i?c[M+1]===H&&b+1<=m&&this.gasU[P+1]!==0&&(y.ax[S]=n.au[P+1]*2*t/(L+Math.max(Xt,A[M+1]))):n.openR&&this.gasU[P+1]!==0&&(y.dDx[S]+=n.au[P+1]*2*t/L),b===0&&n.openL&&this.gasU[P]!==0&&(y.dDx[S]+=n.au[P]*2*t/L),_+1<r?c[M+i]===H&&_+1<=d&&this.gasV[T+i]!==0&&(y.ay[S]=n.av[T+i]*2*t/(L+Math.max(Xt,A[M+i]))):n.openT&&this.gasV[T+i]!==0&&(y.dDy[S]+=n.av[T+i]*2*t/L),_===0&&n.openB&&this.gasV[T]!==0&&(y.dDy[S]+=n.av[T]*2*t/L)}const F=w.solve(e,s,!0);x.iterations=F.iterations,x.residual=F.residual,x.capped=F.capped;const k=n.pg;for(let _=0;_<n.n;_+=1)c[_]!==H&&(k[_]=0);for(let _=g;_<=d;_+=1)for(let b=h;b<=m;b+=1){const M=b+_*i;c[M]===H&&(k[M]=y.x[w.at(b-h,_-g)])}for(let _=0;_<r;_+=1)for(let b=0;b<=i;b+=1){const M=b+_*l;if(this.gasU[M]===0)continue;if(b===0){f[M]-=2*t/Math.max(Xt,A[_*i])/a*k[_*i];continue}if(b===i){f[M]+=2*t/Math.max(Xt,A[i-1+_*i])/a*k[i-1+_*i];continue}const S=b-1+_*i,P=b+_*i;f[M]-=2*t/(Math.max(Xt,A[S])+Math.max(Xt,A[P]))/a*(k[P]-k[S])}for(let _=0;_<=r;_+=1)for(let b=0;b<i;b+=1){const M=b+_*i;if(this.gasV[M]===0)continue;if(_===0){u[M]-=2*t/Math.max(Xt,A[b])/a*k[b];continue}if(_===r){u[M]+=2*t/Math.max(Xt,A[b+(r-1)*i])/a*k[b+(r-1)*i];continue}const S=b+(_-1)*i,P=b+_*i;u[M]-=2*t/(Math.max(Xt,A[S])+Math.max(Xt,A[P]))/a*(k[P]-k[S])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let c=0;for(let u=0;u<n;u+=1){if(s.id[u]!==r||e.kind[u]===ft||this.cap[u]<=0)continue;const h=this.nmol[u];c+=h*(h*qt*e.T[u]/s.pAt(u))/this.cap[u]}c*=qt/a;const l=1/Math.max(.05,1-c);let f=0;for(let u=0;u<4;u+=1){const h=s.statePressure(r);s.p0[r]=h;const m=(h-(t[r]+f))*l;if(Math.abs(m)<=1e-10*h)break;let g=0;for(let d=0;d<n;d+=1){if(s.id[d]!==r||e.kind[d]===ft||this.cap[d]<=0)continue;const p=this.nmol[d]*qt*e.T[d]/s.pAt(d);g+=p,e.Hg[d]+=p*m,this.deriveCell(d)}f+=m,i+=g*m}s.p0[r]=s.statePressure(r),this.dp0[r]=f}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<yt;i+=1)n+=e.mg[i*s+t]/mt[i];return n<=0?0:e.mg[Q*s+t]/mt[Q]/n*this.R.pAt(t)}}const Po=[1/6,2/3,1/6];class Zf{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"owner");v(this,"fs");v(this,"capB");v(this,"matB");v(this,"Ts");v(this,"au");v(this,"av");v(this,"usol");v(this,"vsol");v(this,"thin");v(this,"thinAny",!1);v(this,"phi");v(this,"alpha");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(at*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const c=a+r*t;i[c]===0&&(a>0&&s[a+r*(t+1)]<=0&&i[c-1]===0&&this.thinBlock(a-1,a,r-1,r+1),r>0&&n[c]<=0&&i[c-t]===0&&this.thinBlock(a-1,a+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:a}=this,c=s+1,l=t+e*s;let f=0;if(a[l]===0)for(let u=0;u<9;u+=1){const h=u%3-1,m=(u/3|0)-1,g=t+h,d=e+m;if(u===4||g<0||d<0||g>=s||d>=n||a[g+d*s]!==0)continue;const p=(h>0?1:0)+e*c,x=(m>0?1:0)*s;let w;if(m===0)w=i[t+p]<=0;else if(h===0)w=r[t+e*s+x]<=0;else{const y=a[g+e*s]===0&&(i[t+p]<=0||r[g+e*s+x]<=0),A=a[t+d*s]===0&&(r[t+e*s+x]<=0||i[t+(h>0?1:0)+d*c]<=0);w=y&&A}w&&(f|=1<<u)}this.thin[l]=f}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let a=0;a<9;a+=1)i>>a&1?s[n+a]=0:r+=s[n+a];if(r>0)for(let a=0;a<9;a+=1)s[n+a]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:a}=this,c=Math.max(0,t),l=Math.max(0,e),f=Math.min(i-1,s),u=Math.min(r-1,n);for(let g=l;g<=u;g+=1)for(let d=c;d<=f;d+=1){const p=d+g*i;if(this.solid[p]!==0){this.phiS[p]=1;continue}let x=0;for(let w=-1;w<=1;w+=1)for(let y=-1;y<=1;y+=1)x+=Po[y+1]*Po[w+1]*this.solidShare(d+y,g+w);this.phiS[p]=x}const h=4,m=h*a;for(let g=l;g<=u;g+=1)for(let d=c;d<=f;d+=1){const p=d+g*i,x=this.solid[p]!==0,w=(d+.5)*a,y=(g+.5)*a;let A=m;x||(this.openL||(A=Math.min(A,w)),this.openR||(A=Math.min(A,this.w-w)),this.openB||(A=Math.min(A,y)),this.openT||(A=Math.min(A,this.h-y)));for(let F=-h;F<=h;F+=1){const k=g+F;if(!(k<0||k>=r))for(let _=-h;_<=h;_+=1){const b=d+_;if(b<0||b>=i||this.solid[b+k*i]!==0===x)continue;const S=Math.max(0,Math.abs(b+.5-(d+.5))-.5)*a,P=Math.max(0,Math.abs(k+.5-(g+.5))-.5)*a,T=Math.hypot(S,P);T<A&&(A=T)}}this.sdf[p]=x?-A:A}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),c=Math.floor(r),l=Math.floor(a),f=r-c,u=a-l,h=Math.min(s-1,c+1),m=Math.min(n-1,l+1),g=this.sdf;let d=(1-u)*((1-f)*g[c+l*s]+f*g[h+l*s])+u*((1-f)*g[c+m*s]+f*g[h+m*s]);return this.openL||(d=Math.min(d,t)),this.openR||(d=Math.min(d,this.w-t)),this.openB||(d=Math.min(d,e)),this.openT||(d=Math.min(d,this.h-e)),d}}const t0=5,To=30;class e0{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",bc);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});v(this,"bodies",[]);v(this,"qb");v(this,"kS");v(this,"kF");v(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=ut[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*xi}solidEnergy(t,e){return this.solidCapCrust(t)*(e-st)+this.g.film[t]*Ft(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=st+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:st+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*je(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let c=0;c<s.ncell;c+=1)r+=s.cellVolume(c);if(!(r>0))continue;const a=n.P*i/r;for(let c=0;c<s.nw;c+=1){const l=a*s.ww[c]*s.cellVolume(s.wk[c]);t[s.wc[c]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/t0,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/To);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/To)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:c,ny:l,n:f,depth:u,dx:h}=n,{C:m,Cs:g,Cg:d,CTl:p,Tstar:x,k:w,q:y,src:A}=this;this.heaterPower(t),p.fill(0);const F=n.Cl;F.fill(0);const{Co:k,CKo:_}=this;let b=!1,M=0;for(let C=0;C<i.count;C+=1){const E=i.mat[C],j=i.T[C],X=i.mass[C]*i.cp(C);M+=X;const z=9*C,ht=r.bi[C],bt=r.bj[C],dt=E===lt?0:Ys(E,j);E!==lt&&!b&&(b=!0,k.fill(0),_.fill(0));for(let Lt=0;Lt<9;Lt+=1){const Et=r.wt[z+Lt];if(Et===0)continue;const Dt=ht+Lt%3,gt=bt+(Lt/3|0);if(Dt<0||gt<0||Dt>=c||gt>=l)continue;const Ct=Dt+gt*c;F[Ct]+=Et*X,p[Ct]+=Et*X*j,E!==lt&&(k[Ct]+=Et*X,_[Ct]+=Et*X*dt)}}const S=this.qb;S.fill(0);let P=this.bodyHeat(S);const{kS:T,kF:O,dSF:L}=this;for(let C=0;C<f;C+=1){let E=0,j=0;const X=n.solid[C]!==0?n.T[C]:n.Ts[C];if(n.solid[C]!==0||n.capB[C]>0){E=this.solidCapCrust(C)+n.film[C]*je(X);const gt=n.solid[C]!==0?ut[n.solid[C]-1]:ut[n.matB[C]-1];j=gt!==void 0?gt.k:0}const z=a.cap[C]>0&&n.solid[C]===0?a.cap[C]:0,ht=F[C],bt=E+z+ht;if(g[C]=E,d[C]=z,m[C]=bt,L[C]=0,bt<=0){x[C]=n.T[C],w[C]=0,y[C]=0;continue}const dt=(E*X+z*n.T[C]+p[C])/bt;x[C]=dt,ht>0&&(n.Tl[C]=p[C]/ht);let Lt=j;if(n.solid[C]===0){const gt=ht>=z?b&&k[C]>0?((ht-k[C])*Xn(dt)+_[C])/ht:Xn(dt):yc(n.mg[C],n.mg[f+C],n.mg[Q*f+C],dt);if(E>0){const Ct=Math.min(1,n.fs[C]);Lt=Ct*j+(1-Ct)*gt,T[C]=j,O[C]=gt,z+ht>0&&(L[C]=X-(z*n.T[C]+p[C])/(z+ht))}else Lt=gt}w[C]=Lt;let Et=A[C]+S[C];if(this.liquidPower!==0&&ht>0){const gt=this.liquidPower*ht/M;Et+=gt,P+=gt}const Dt=n.heater[C];if(Dt>=0&&n.role[C]===1){const gt=this.heaters[Dt];gt!==void 0&&gt.cells>0&&(Et+=gt.P/gt.cells,P+=gt.P/gt.cells)}y[C]=Et}const{gx:I,gy:B}=this;for(let C=0;C<l;C+=1)for(let E=0;E<c;E+=1){const j=E+C*c;if(I[j]=0,B[j]=0,m[j]<=0)continue;const X=w[j];if(E+1<c&&m[j+1]>0){const z=w[j+1];X+z>0&&(I[j]=2*X*z/(X+z)*u)}if(C+1<l&&m[j+c]>0){const z=w[j+c];X+z>0&&(B[j]=2*X*z/(X+z)*u)}}const D=this.solver,R=D.begin(c,l),V=R.stride,W=h*u,N=this.hExt*W,Y=this.ambientT;for(let C=0;C<l;C+=1)for(let E=0;E<c;E+=1){const j=E+C*c;if(m[j]<=0)continue;const X=E+1+(C+1)*V;R.act[X]=1,R.dH[X]=m[j]/t;let z=y[j];const ht=w[j],bt=x[j];E+1<c&&(R.ax[X]=I[j],z+=I[j]*(x[j+1]-bt)),E>0&&(z+=I[j-1]*(x[j-1]-bt)),C+1<l&&(R.ay[X]=B[j],z+=B[j]*(x[j+c]-bt)),C>0&&(z+=B[j-c]*(x[j-c]-bt));let dt=0;E===0&&(dt+=this.sideConductance(n.openL,ht,N,u)),E===c-1&&(dt+=this.sideConductance(n.openR,ht,N,u)),C===0&&(dt+=this.sideConductance(n.openB,ht,N,u)),C===l-1&&(dt+=this.sideConductance(n.openT,ht,N,u)),dt>0&&(R.dDx[X]=dt,z+=dt*(Y-x[j])),R.b[X]=z}const J=D.solve(e,s,!1),q=this.last.solve;q.iterations=J.iterations,q.residual=J.residual,q.capped=J.capped;const $=this.Tnew,U=R.x;for(let C=0;C<l;C+=1)for(let E=0;E<c;E+=1){const j=E+C*c;$[j]=m[j]>0?x[j]+U[E+1+(C+1)*V]:n.T[j]}const G=this.dE;let tt=0,pt=0;for(let C=0;C<f;C+=1)G[C]=m[C]>0?y[C]*t:0;for(let C=0;C<l;C+=1)for(let E=0;E<c;E+=1){const j=E+C*c;if(m[j]<=0)continue;const X=w[j];if(I[j]>0){const z=I[j]*($[j+1]-$[j])*t;G[j]+=z,G[j+1]-=z,n.kind[j]!==n.kind[j+1]&&this.pair(n.kind[j],n.kind[j+1],z)}if(B[j]>0){const z=B[j]*($[j+c]-$[j])*t;G[j]+=z,G[j+c]-=z,n.kind[j]!==n.kind[j+c]&&this.pair(n.kind[j],n.kind[j+c],z)}for(let z=0;z<4;z+=1){if(!(z===0?E===0:z===1?E===c-1:z===2?C===0:C===l-1))continue;const bt=z===0?n.openL:z===1?n.openR:z===2?n.openB:n.openT,dt=this.sideConductance(bt,X,N,u)*($[j]-Y)*t;G[j]-=dt,bt?pt+=dt:tt+=dt,n.solid[j]!==0&&(this.lossSolids+=dt)}}for(let C=0;C<f;C+=1){if(m[C]<=0)continue;const E=G[C]/m[C];$[C]=E;let j=0;const X=d[C]+F[C];if(L[C]!==0&&g[C]>0&&X>0){const z=Math.min(.999,Math.max(.001,n.fs[C])),ht=u/(.5*z/Math.max(1e-9,T[C])+.5*(1-z)/Math.max(1e-9,O[C])),bt=g[C]*X/(g[C]+X);j=(1-Math.exp(-t*ht/bt))*L[C]*bt}g[C]>0&&(n.Es[C]+=E*g[C]-j,this.deriveSolid(C)),d[C]>0&&(n.Hg[C]+=E*d[C]+j*d[C]/X),j!==0&&F[C]>0&&($[C]+=j/X)}for(let C=0;C<i.count;C+=1){const E=9*C,j=r.bi[C],X=r.bj[C];let z=0;for(let dt=0;dt<9;dt+=1){const Lt=r.wt[E+dt];if(Lt===0)continue;const Et=j+dt%3,Dt=X+(dt/3|0);if(Et<0||Dt<0||Et>=c||Dt>=l)continue;const gt=Et+Dt*c;m[gt]>0&&(z+=Lt*$[gt])}if(z===0)continue;const ht=i.mass[C],bt=ht/i.rho[C];i.h[C]+=i.cp(C)*z,i.derive(C),r.dVp[C]+=ht/i.rho[C]-bt}for(let C=0;C<f;C+=1)d[C]>0&&a.deriveCell(C);A.fill(0);const wt=this.last;return wt.heater=P*t,wt.lossWalls=tt,wt.lossOpen=pt,wt}pair(t,e,s){t===ft&&e===et?this.fluxSL-=s:t===et&&e===ft?this.fluxSL+=s:t===et&&e===H?this.fluxLG-=s:t===H&&e===et?this.fluxLG+=s:t===ft&&e===H?this.fluxSG-=s:t===H&&e===ft&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function s0(o,t,e,s,n,i,r){const{nx:a,ny:c}=o,l=a+1,f=o.ul,u=o.vl;for(let h=0;h<o.nu;h+=1)s[h]=t[h]!==0?1:0;for(let h=0;h<o.nv;h+=1)n[h]=e[h]!==0?1:0;for(let h=0;h<2;h+=1){i.set(f),r.set(u);for(let m=0;m<c;m+=1)for(let g=0;g<=a;g+=1){const d=g+m*l;if(s[d]!==0)continue;let p=0,x=0;g>0&&s[d-1]===1&&(p+=f[d-1],x+=1),g<a&&s[d+1]===1&&(p+=f[d+1],x+=1),m>0&&s[d-l]===1&&(p+=f[d-l],x+=1),m<c-1&&s[d+l]===1&&(p+=f[d+l],x+=1),x>0&&(i[d]=p/x,s[d]=3)}for(let m=0;m<=c;m+=1)for(let g=0;g<a;g+=1){const d=g+m*a;if(n[d]!==0)continue;let p=0,x=0;g>0&&n[d-1]===1&&(p+=u[d-1],x+=1),g<a-1&&n[d+1]===1&&(p+=u[d+1],x+=1),m>0&&n[d-a]===1&&(p+=u[d-a],x+=1),m<c&&n[d+a]===1&&(p+=u[d+a],x+=1),x>0&&(r[d]=p/x,n[d]=3)}f.set(i),u.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let h=0;h<o.nu;h+=1)s[h]===0&&(f[h]=0);for(let h=0;h<o.nv;h+=1)n[h]===0&&(u[h]=0)}function n0(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<o.count;a+=1){const c=Math.min(s-1,Math.max(0,Math.floor(o.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[a]/t.dx)));if(i[c+l*s]===et){e[a]=0;continue}let f=!1;for(let u=Math.max(0,l-2);u<=Math.min(n-1,l+2)&&!f;u+=1)for(let h=Math.max(0,c-2);h<=Math.min(s-1,c+2);h+=1)if(i[h+u*s]===et){f=!0;break}e[a]=f?0:1,f||(r=!0)}return r}function So(o,t,e,s){const{nx:n,ny:i,dx:r}=o,a=n+1,c=1/r;let l=Math.min(n-1e-6,Math.max(0,t*c)),f=Math.min(i-1.000001,Math.max(0,e*c-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,g=f-h;const d=o.ul;s[0]=(1-g)*((1-m)*d[u+h*a]+m*d[u+1+h*a])+g*((1-m)*d[u+(h+1)*a]+m*d[u+1+(h+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*c-.5)),f=Math.min(i-1e-6,Math.max(0,e*c)),u=Math.floor(l),h=Math.floor(f),m=l-u,g=f-h;const p=o.vl;s[1]=(1-g)*((1-m)*p[u+h*n]+m*p[u+1+h*n])+g*((1-m)*p[u+(h+1)*n]+m*p[u+1+(h+1)*n])}function i0(o,t,e,s,n,i,r,a,c,l,f){const{nx:u,ny:h,dx:m}=o;for(let x=0;x<o.nu;x+=1)e[x]=n[x]>l?e[x]/n[x]:0;for(let x=0;x<o.nv;x+=1)s[x]=i[x]>l?s[x]/i[x]:0;const g=c*m*m/f,d=(x,w)=>x+w>0?2*x*w/(x+w):0;let p=0;{const x=u+1,w=t.begin(x,h),y=o.ul;for(let F=0;F<h;F+=1)for(let k=0;k<=u;k+=1){const _=k+F*x;if(r[_]!==1)continue;const b=t.at(k,F),M=e[_];if(w.act[b]=1,w.dH[b]=g,w.x[b]=y[_],w.b[b]=g*y[_],k+1<=u){const S=r[_+1];S===1?w.ax[b]=d(M,e[_+1]):S===2&&(w.dDx[b]+=M)}if(k>0&&r[_-1]===2&&(w.dDx[b]+=M),F+1<h){const S=r[_+x];S===1?w.ay[b]=d(M,e[_+x]):S===2&&(w.dDy[b]+=2*M)}else o.openT||(w.dDy[b]+=2*M);F>0?r[_-x]===2&&(w.dDy[b]+=2*M):o.openB||(w.dDy[b]+=2*M)}const A=t.solve(1e-6,200,!1);p+=A.iterations;for(let F=0;F<h;F+=1)for(let k=0;k<=u;k+=1){const _=k+F*x;r[_]===1&&(y[_]=w.x[t.at(k,F)])}}{const x=t.begin(u,h+1),w=o.vl;for(let A=0;A<=h;A+=1)for(let F=0;F<u;F+=1){const k=F+A*u;if(a[k]!==1)continue;const _=t.at(F,A),b=s[k];if(x.act[_]=1,x.dH[_]=g,x.x[_]=w[k],x.b[_]=g*w[k],A+1<=h){const M=a[k+u];M===1?x.ay[_]=d(b,s[k+u]):M===2&&(x.dDy[_]+=b)}if(A>0&&a[k-u]===2&&(x.dDy[_]+=b),F+1<u){const M=a[k+1];M===1?x.ax[_]=d(b,s[k+1]):M===2&&(x.dDx[_]+=2*b)}else o.openR||(x.dDx[_]+=2*b);F>0?a[k-1]===2&&(x.dDx[_]+=2*b):o.openL||(x.dDx[_]+=2*b)}const y=t.solve(1e-6,200,!1);p+=y.iterations;for(let A=0;A<=h;A+=1)for(let F=0;F<u;F+=1){const k=F+A*u;a[k]===1&&(w[k]=x.x[t.at(F,A)])}}return p}class r0{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:c}=e,l=ce.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(c*l),this.cellHost=new Uint8Array(c));const f=this.cellMat,u=this.cellHost;f.fill(0);let h=!1;for(let d=0;d<t.count;d+=1){const p=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx)));f[(p+x*r)*l+t.mat[d]]+=t.mass[d],t.smass[2*d]>0&&(h=!0)}if(h){this.cellVolW===null&&(this.cellVolW=new Float64Array(c));const d=this.cellVolW;d.fill(0);for(let p=0;p<t.count;p+=1){if(t.mat[p]!==lt)continue;const x=Math.min(r-1,Math.max(0,Math.floor(t.x[p]/e.dx))),w=Math.min(a-1,Math.max(0,Math.floor(t.y[p]/e.dx)));d[x+w*r]+=t.mass[p]/t.rho[p]}}for(let d=0;d<c;d+=1){let p=0;for(let x=1;x<l;x+=1)f[d*l+x]>f[d*l+p]&&(p=x);u[d]=p}let m=!1;const g=.25*e.dx;for(let d=0;d<t.count;d+=1){i[d]=0;const p=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx))),w=u[p+x*r],y=t.mat[d];if(y===w)continue;const A=t.T[d],F=this.cellVolW,k=p+x*r,_=h&&w===lt&&F!==null&&F[k]>0?f[k*l]/F[k]:os(w,A),b=t.rho[d],M=cn(w,A),S=cn(y,A),P=t.mass[d]/b,T=Math.cbrt(6*P/Math.PI),O=Math.abs(_-b);if(O<=0||n<=0)continue;const L=(2*M+3*S)/(3*M+3*S);let I=O*n*T*T/(18*M*L);for(let D=0;D<8;D+=1){const R=Math.max(1e-9,_*I*T/M),V=24/R*L*(1+.15*Math.pow(R,.687));I=Math.sqrt(4*O*n*T/(3*_*V))}const B=b<_?1:-1;i[d]=B*Math.min(g,I*s),m=!0}return m}}function o0(o,t,e,s,n,i,r,a,c,l,f){const u=t.w,h=t.h,m=t.dx;let g=0,d=0,p=0,x=0;const w=s;for(let y=0;y<o.count;y+=1){const A=o.x[y],F=o.y[y],k=w[y]!==0;let _,b;if(k)_=A+e*o.vx[y],b=F+e*o.vy[y];else{i(A,F,c);const P=A+.5*e*c[0],T=F+.5*e*c[1];i(P,T,c),_=A+e*c[0],b=F+e*c[1]+(n!==null?n[y]:0)}if(_<0&&t.openL||_>u&&t.openR||b<0&&t.openB||b>h&&t.openT){const P=o.smass[2*y];o.mat[y]===lt?g+=o.mass[y]-P:d+=o.mass[y]-P,p+=P,x+=o.mass[y]*o.h[y],n!==null&&(n[y]=n[o.count-1]),w[y]=w[o.count-1],r(y),y-=1;continue}const M=1e-4*m;k&&(_<M||_>u-M)&&(o.vx[y]=0),k&&(b<M||b>h-M)&&(o.vy[y]=0),_=Math.min(u-M,Math.max(M,_)),b=Math.min(h-M,Math.max(M,b));const S=a!==null?a(A,F,_,b,l):0;if(S===1){_=l[0],b=l[1];const P=l[2],T=l[3];if(k)o.vx[y]=l[4],o.vy[y]=l[5];else{const O=(o.vx[y]-l[4])*P+(o.vy[y]-l[5])*T;O<0&&(o.vx[y]-=O*P,o.vy[y]-=O*T)}}else if(S===0){let P=t.sdfAt(_,b);if(P<.05*m)for(let T=0;T<3&&P<.05*m;T+=1){const O=.25*m;let L=t.sdfAt(_+O,b)-t.sdfAt(_-O,b),I=t.sdfAt(_,b+O)-t.sdfAt(_,b-O);const B=Math.hypot(L,I);if(B<1e-12)break;L/=B,I/=B;const D=.05*m-P;_+=D*L,b+=D*I;const R=o.vx[y]*L+o.vy[y]*I;k?(o.vx[y]=0,o.vy[y]=0):R<0&&(o.vx[y]-=R*L,o.vy[y]-=R*I),_=Math.min(u-M,Math.max(M,_)),b=Math.min(h-M,Math.max(M,b)),P=t.sdfAt(_,b)}}o.x[y]=_,o.y[y]=b}f.m=g,f.o=d,f.s=p,f.e=x}const c0=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),Co=24,a0=1,l0=1,Lo=24,Oo=1,de=(o,t)=>(o+2)*(t+2);function Bo(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function f0(o,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){o[a]+=n*e[a];const c=t[a]-n*s[a];t[a]=c,r+=c*c}return r}function u0(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class At{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(c0(de(s,n),i)),!(s*n<=Co||s<=2&&n<=2);)i=de(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=de(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],c=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:c,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=de(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,diag:f,inv:u,act:h}=t;for(let m=1;m<=s;m+=1){let g=1+m*n;for(let d=1;d<=e;d+=1,g+=1){if(h[g]===0){f[g]=1,u[g]=1;continue}const p=a[g]+c[g]+l[g]+i[g]+i[g-1]+r[g]+r[g-n];if(!(p>0)){h[g]=0,f[g]=1,u[g]=1;continue}f[g]=p,u[g]=1/p}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:c,diag:l}=t;for(let f=1;f<=i;f+=1){let u=1+f*r;for(let h=1;h<=n;h+=1,u+=1)s[u]=l[u]*e[u]-a[u]*e[u+1]-a[u-1]*e[u-1]-c[u]*e[u+r]-c[u-r]*e[u-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:c,x:l,b:f}=t;for(let u=1;u<=n;u+=1){let h=1+(1+u+e&1)+u*i;const m=s+u*i;for(;h<=m;h+=2)l[h]=(f[h]+r[h]*l[h+1]+r[h-1]*l[h-1]+a[h]*l[h+i]+a[h-i]*l[h-i])*c[h]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:c}=t;let l=0;for(let f=1;f<=s;f+=1){let u=1+f*n;for(let h=1;h<=e;h+=1,u+=1)i[u]!==0&&(i[u-1]===0||i[u+1]===0||i[u-n]===0||i[u+n]===0||r[u]>0||a[u]>0)&&(c[l++]=u)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:c,band:l,bandCount:f}=t;for(let u=e>0?0:f-1;e>0?u<f:u>=0;u+=e){const h=l[u];a[h]=(c[h]+n[h]*a[h+1]+n[h-1]*a[h-1]+i[h]*a[h+s]+i[h-s]*a[h-s])*r[h]}}prepareFine(){const t=this.levels[0],e=de(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=Co||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=de(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,c=e.h,l=s.h;for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;let m=0,g=0,d=0,p=0;for(let _=0;_<2;_+=1){const b=2*f+_;if(!(b>=e.ny))for(let M=0;M<2;M+=1){const S=2*u+M;if(S>=e.nx)continue;const P=S+1+(b+1)*a;if(e.act[P]===0)continue;const T=e.area[P];m+=T,g+=T*((M-.5)*c+e.ox[P]*c),d+=T*((_-.5)*c+e.oy[P]*c),p+=e.dH[P]}}if(m<=0){s.act[h]=0,s.dH[h]=0,s.dDx[h]=0,s.dDy[h]=0,s.gDx[h]=0,s.gDy[h]=0,s.ox[h]=0,s.oy[h]=0;continue}s.act[h]=1,s.area[h]=m/4;const x=g/m,w=d/m;s.ox[h]=x/l,s.oy[h]=w/l,s.dH[h]=p;let y=0,A=0,F=0,k=0;for(let _=0;_<2;_+=1){const b=2*f+_;if(!(b>=e.ny))for(let M=0;M<2;M+=1){const S=2*u+M;if(S>=e.nx)continue;const P=S+1+(b+1)*a;if(e.act[P]!==0){if(e.gDx[P]>0){const T=(M-.5)*c+e.ox[P]*c;y+=e.gDx[P],A+=e.gDx[P]/(e.eDx[P]+Math.abs(T-x))}if(e.gDy[P]>0){const T=(_-.5)*c+e.oy[P]*c;F+=e.gDy[P],k+=e.gDy[P]/(e.eDy[P]+Math.abs(T-w))}}}}s.gDx[h]=y,s.gDy[h]=F,s.dDx[h]=A,s.dDy[h]=k,s.eDx[h]=A>0?y/A:.5*l,s.eDy[h]=k>0?F/k:.5*l}for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;if(s.act[h]!==0){if(u+1<n&&s.act[h+1]!==0){const m=2*u+1;let g=0;if(m+1<e.nx)for(let d=0;d<2;d+=1){const p=2*f+d;p>=e.ny||(g+=e.gx[m+1+(p+1)*a])}if(g>0){const d=l*(1+s.ox[h+1]-s.ox[h]);s.gx[h]=g,s.ax[h]=g/Math.max(.25*l,d)}}if(f+1<i&&s.act[h+s.stride]!==0){const m=2*f+1;let g=0;if(m+1<e.ny)for(let d=0;d<2;d+=1){const p=2*u+d;p>=e.nx||(g+=e.gy[p+1+(m+1)*a])}if(g>0){const d=l*(1+s.oy[h+s.stride]-s.oy[h]);s.gy[h]=g,s.ay[h]=g/Math.max(.25*l,d)}}}}At.diagonal(s),At.findBand(s);for(let f=0;f<e.ny;f+=1){let u=1+(f+1)*a;for(let h=0;h<e.nx;h+=1,u+=1){if(e.act[u]===0){s.pW[4*u]=0,s.pW[4*u+1]=0,s.pW[4*u+2]=0,s.pW[4*u+3]=0,s.pIdx[4*u]=0,s.pIdx[4*u+1]=0,s.pIdx[4*u+2]=0,s.pIdx[4*u+3]=0;continue}At.weights(s,h,f,e.dDx[u]+e.dDy[u]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*u+m]=this.pi[m],s.pW[4*u+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,c=s>>1,l=(e&1)===1?1:-1,f=(s&1)===1?1:-1,u=t.stride,h=a+1+(c+1)*u;r[0]=h,r[1]=h+l,r[2]=h+f*u,r[3]=h+l+f*u;const m=a+l>=0&&a+l<t.nx,g=c+f>=0&&c+f<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=g&&t.act[r[2]]!==0?3/16:0,i[3]=m&&g&&t.act[r[3]]!==0?1/16:0,t.act[h]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<Lo;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<Lo;m+=1)At.color(e,1),At.color(e,0);return}for(let m=0;m<a0;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<Oo;m+=1)At.bandSweep(e,1);At.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,de(s.nx,s.ny)),s.x.fill(0,0,de(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:c}=e,{pIdx:l,pW:f}=s,u=s.b,h=s.x;for(let m=0;m<e.ny;m+=1){let g=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,g+=1){if(i[g]===0)continue;const p=r[g]-a[g],x=4*g;u[l[x]]+=f[x]*p,u[l[x+1]]+=f[x+1]*p,u[l[x+2]]+=f[x+2]*p,u[l[x+3]]+=f[x+3]*p}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let g=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,g+=1){if(i[g]===0)continue;const p=4*g;c[g]+=f[p]*h[l[p]]+f[p+1]*h[l[p+1]]+f[p+2]*h[l[p+2]]+f[p+3]*h[l[p+3]]}}for(let m=0;m<Oo;m+=1)At.bandSweep(e,-1);for(let m=0;m<l0;m+=1)At.color(e,1),At.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,act:f}=t,u=this.nullId,h=de(e,s);let m=!1;for(let g=0;g<h;g+=1)if(f[g]!==0&&!(a[g]>0)){m=!0;break}if(!m){this.nullCount=0;return}u.fill(-2,0,h),this.nullCount=0;for(let g=1;g<=s;g+=1)for(let d=1;d<=e;d+=1){const p=d+g*n;if(f[p]===0||u[p]!==-2)continue;let x=0,w=0,y=!1;const A=-3-this.nullCount;this.stack[x++]=p,u[p]=A;let F=p,k=p;for(;x>0;){const b=this.stack[--x];w+=1,b<F&&(F=b),b>k&&(k=b),(a[b]>0||c[b]>0||l[b]>0)&&(y=!0),i[b]>0&&u[b+1]===-2&&(u[b+1]=A,this.stack[x++]=b+1),i[b-1]>0&&u[b-1]===-2&&(u[b-1]=A,this.stack[x++]=b-1),r[b]>0&&u[b+n]===-2&&(u[b+n]=A,this.stack[x++]=b+n),r[b-n]>0&&u[b-n]===-2&&(u[b-n]=A,this.stack[x++]=b-n)}let _=-1;if(!y){if(_=this.nullCount,_>=this.nullSum.length){const b=M=>{const S=new Float64Array(2*M.length);return S.set(M),S};this.nullSum=b(this.nullSum),this.nullCnt=b(this.nullCnt)}this.nullCnt[_]=w,this.nullCount+=1}for(let b=F;b<=k;b+=1)u[b]===A&&(u[b]=_)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=de(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=de(i.nx,i.ny),{act:a}=i,c=this.xs,l=this.bs,f=i.stride;for(let F=0;F<r;F+=1){if(a[F]===0){c[F]=0,l[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||a[F+1]===0)&&(i.ax[F]=0),(F+f>=r||a[F+f]===0)&&(i.ay[F]=0)}At.diagonal(i);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0,l[F]=0);this.findNull(),this.project(l),s&&(At.findBand(i),this.prepareFine(),this.coarsen());const u=s?i.b:this.rj,h=s?i.x:this.zj,{p:m,q:g}=this;g.fill(0,0,r),m.fill(0,0,r),h.fill(0,0,r),At.apply(i,c,g);let d=0,p=0;for(let F=0;F<r;F+=1){const k=a[F]===0?0:l[F]-g[F];u[F]=k,d+=l[F]*l[F],p+=k*k}this.project(u);const x=Math.sqrt(d);if(x===0)return c.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(p)/x;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,u,h,r);let y=0;for(let F=0;F<r;F+=1)m[F]=h[F],y+=u[F]*h[F];let A=0;for(;A<e;){A+=1,At.apply(i,m,g);const F=Bo(m,g,r);if(!(F>0))break;const k=y/F;if(p=f0(c,u,m,g,k,r),w=Math.sqrt(p)/x,w<=t)break;this.precondition(s,u,h,r);const _=Bo(u,h,r),b=_/y;y=_,u0(m,h,b,r)}this.project(c);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0);return n.iterations=A,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const h0=.1,jo=5e-4,qo=1e-9,fr=.1;function jn(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function ae(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class d0{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new r0);v(this,"dropletDrift",null);v(this,"bodyHit",null);v(this,"afterSolve",null);v(this,"hit",new Float64Array(6));v(this,"escaped",{m:0,o:0,s:0,e:0});v(this,"velocityAtFn",(t,e,s)=>{So(this.g,t,e,s)});v(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;e.updateThin();for(let c=0;c<t.count;c+=1){n[c]=ae(t.x[c]*a-.5,s,0),i[c]=ae(t.y[c]*a-.5,s,3);const l=9*c;for(let f=0;f<3;f+=1)for(let u=0;u<3;u+=1)r[l+u+3*f]=s[u]*s[3+f];e.thinAny&&e.cutWeights(n[c]+1,i[c]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:c,kind:l}=e;for(let f=0;f<t.count;f+=1){const u=9*f,h=s[f],m=n[f];let g=0;for(let d=0;d<9;d+=1){const p=h+d%3,x=m+(d/3|0),y=p>=0&&x>=0&&p<a&&x<c&&l[p+x*a]===et?i[u+d]:0;r[u+d]=y,g+=y}if(g>0){const d=1/g;for(let p=0;p<9;p+=1)r[u+p]*=d}else{for(let d=0;d<9;d+=1)r[u+d]=0;r[u+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:c}=this,{nx:l,ny:f,kind:u}=s,h=1/s.dx;i[t]=ae(e.x[t]*h-.5,n,0),r[t]=ae(e.y[t]*h-.5,n,3);const m=9*t;for(let d=0;d<3;d+=1)for(let p=0;p<3;p+=1)a[m+p+3*d]=n[p]*n[3+d];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,a,m);let g=0;for(let d=0;d<9;d+=1){const p=i[t]+d%3,x=r[t]+(d/3|0),w=p>=0&&x>=0&&p<l&&x<f&&u[p+x*l]===et;c[m+d]=w?a[m+d]:0,w&&(g+=a[m+d])}if(g>0)for(let d=0;d<9;d+=1)c[m+d]/=g;else{for(let d=0;d<9;d+=1)c[m+d]=0;c[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:c}=e;c.fill(0);const l=1/e.vCell;let f=0,u=0;for(let h=0;h<t.count;h+=1){const m=t.mass[h]/t.rho[h];f+=t.mass[h],u+=m;const g=9*h,d=s[h],p=n[h];for(let x=0;x<9;x+=1){const w=d+x%3,y=p+(x/3|0);w<0||y<0||w>=r||y>=a||(c[w+y*r]+=i[g+x]*m*l)}}u>0&&(this.rhoRef=f/u)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ft;continue}const a=e.phi[r];let c=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!c&&t!==null&&t[r]!==H&&t[r]!==ft){const l=r%s,f=(r-l)/s;(l>0?t[r-1]===H&&e.faceOpen(r,0)>0:e.openL)||(l<s-1?t[r+1]===H&&e.faceOpen(r,1)>0:e.openR)||(f>0?t[r-s]===H&&e.faceOpen(r,2)>0:e.openB)||(f<n-1?t[r+s]===H&&e.faceOpen(r,3)>0:e.openT)||(c=!0)}e.kind[r]=c?et:H,c&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:c}=this,{nx:l,ny:f,dx:u}=e,h=1/u,m=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),c.fill(0);const g=1/this.rhoRef,d=this.viscous;d&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const p=this.etaU,x=this.etaV;d&&(p.fill(0),x.fill(0));for(let w=0;w<t.count;w+=1){const y=t.x[w],A=t.y[w],F=t.mass[w],k=d?cn(t.mat[w],t.T[w]):0,_=t.vx[w],b=t.vy[w],M=t.c00[w],S=t.c01[w],P=t.c10[w],T=t.c11[w],O=y*h,L=A*h;let I=ae(O,s,0),B=ae(L-.5,s,3);for(let R=0;R<3;R+=1){const V=B+R,W=(V+.5)*u-A;for(let N=0;N<3;N+=1){const Y=I+N,J=s[N]*s[3+R]*F,q=J*(_+M*(Y*u-y)+S*W);if(Y>=0&&Y<=l&&V>=0&&V<f){const $=Y+V*m;n[$]+=J,i[$]+=q,d&&(p[$]+=J*k)}else this.mirrorU(Y,V),n[this.mf]+=J,i[this.mf]+=this.ms*q,d&&(p[this.mf]+=J*k)}}I=ae(O-.5,s,0),B=ae(L,s,3);const D=t.rho[w]*g;for(let R=0;R<3;R+=1){const V=B+R,W=V*u-A;for(let N=0;N<3;N+=1){const Y=I+N,J=s[N]*s[3+R]*F,q=J*(b+P*((Y+.5)*u-y)+T*W);let $,U=1;Y>=0&&Y<l&&V>=0&&V<=f?$=Y+V*l:(this.mirrorV(Y,V),$=this.mf,U=this.ms),r[$]+=J,a[$]+=U*q,c[$]+=J*D,d&&(x[$]+=J*k)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?s.openL?r=0:(r=-r,c=-c):r>n&&(s.openR?r=n:(r=2*n-r,c=-c)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=c}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,c=-c):a>i&&(s.openT?a=i:(a=2*i-a,c=-c)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=c}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:c,dx:l,kind:f}=i,u=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:h,pu:m,mv:g,pv:d,rv:p,knownU:x,knownV:w}=this,y=i.ul,A=i.vl,F=this.rhoRef*i.vCell*.25,k=qo*F,_=this.viscous;for(let D=0;D<i.nu;D+=1)y[D]=h[D]>k?m[D]/h[D]+(_?0:t*this.fU[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<i.nv;D+=1)A[D]=g[D]>k?d[D]/g[D]+(_?0:-t*e*(p[D]/g[D])+t*this.fV[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<c;D+=1)for(let R=0;R<=a;R+=1){const V=R+D*u,W=R>0?f[R-1+D*a]:-1,N=R<a?f[R+D*a]:-1,Y=R===0&&!i.openL,J=R===a&&!i.openR;if(Y||J||W===ft||N===ft||i.au[V]<=0){y[V]=Y||J?0:i.usol[V],x[V]=2;continue}x[V]=W===et||N===et?1:0}for(let D=0;D<=c;D+=1)for(let R=0;R<a;R+=1){const V=R+D*a,W=D>0?f[R+(D-1)*a]:-1,N=D<c?f[R+D*a]:-1,Y=D===0&&!i.openB,J=D===c&&!i.openT;if(Y||J||W===ft||N===ft||i.av[V]<=0){A[V]=Y||J?0:i.vsol[V],w[V]=2;continue}w[V]=W===et||N===et?1:0}if(this.last.viscIterations=0,_){this.viscosity(t);const D=t/(this.rhoRef*i.vCell);for(let R=0;R<i.nu;R+=1)x[R]!==2&&h[R]>k&&(y[R]+=D*this.fU[R]);for(let R=0;R<i.nv;R+=1)w[R]!==2&&g[R]>k&&(A[R]+=-t*e*(p[R]/g[R])+D*this.fV[R])}let b=a,M=-1,S=c,P=-1,T=0;for(let D=0;D<c;D+=1)for(let R=0;R<a;R+=1)f[R+D*a]===et&&(T+=1,R<b&&(b=R),R>M&&(M=R),D<S&&(S=D),D>P&&(P=D));const O=this.last.solve;if(O.iterations=0,O.residual=0,O.capped=!1,T>0){const D=M-b+1,R=P-S+1,V=this.solver,W=V.begin(D,R),N=t/this.rhoRef,Y=1/i.vCell,J=this.pGas;for(let U=S;U<=P;U+=1)for(let G=b;G<=M;G+=1){const tt=G+U*a;if(f[tt]!==et)continue;const pt=V.at(G-b,U-S);W.act[pt]=1,W.x[pt]=i.pl[tt];const wt=G+U*u,C=G+U*a,E=x[wt+1]===2?0:i.au[wt+1],j=x[wt]===2?0:i.au[wt],X=w[C+a]===2?0:i.av[C+a],z=w[C]===2?0:i.av[C],ht=jn(y,i.usol,wt+1,E,x)-jn(y,i.usol,wt,j,x)+jn(A,i.vsol,C+a,X,w)-jn(A,i.vsol,C,z,w),bt=i.phi[tt]+i.phiS[tt]+i.alpha[tt];let dt=this.volSrc[tt]*Y;const Lt=this.gasAt(G-1,U)||this.gasAt(G+1,U)||this.gasAt(G,U-1)||this.gasAt(G,U+1),Et=bt-1;(Et>0||!Lt)&&(dt+=h0*Et/Math.max(t,jo));let Dt=dt*l*l-l*ht;if(G+1<a){const gt=f[tt+1];if(gt===et)G+1<=M&&E>0&&(W.ax[pt]=E<1?N*E:N);else if(gt===H&&E>0){const Ct=(E<1?N*E:N)/this.theta(tt,tt+1);W.dDx[pt]+=Ct,Dt+=Ct*J[tt+1]}}else i.openR&&E>0&&(W.dDx[pt]+=E<1?2*N*E:2*N);if(G>0){if(f[tt-1]===H&&j>0){const Ct=(j<1?N*j:N)/this.theta(tt,tt-1);W.dDx[pt]+=Ct,Dt+=Ct*J[tt-1]}}else i.openL&&j>0&&(W.dDx[pt]+=j<1?2*N*j:2*N);if(U+1<c){const gt=f[tt+a];if(gt===et)U+1<=P&&X>0&&(W.ay[pt]=X<1?N*X:N);else if(gt===H&&X>0){const Ct=(X<1?N*X:N)/this.theta(tt,tt+a);W.dDy[pt]+=Ct,Dt+=Ct*J[tt+a]}}else i.openT&&X>0&&(W.dDy[pt]+=X<1?2*N*X:2*N);if(U>0){if(f[tt-a]===H&&z>0){const Ct=(z<1?N*z:N)/this.theta(tt,tt-a);W.dDy[pt]+=Ct,Dt+=Ct*J[tt-a]}}else i.openB&&z>0&&(W.dDy[pt]+=z<1?2*N*z:2*N);W.b[pt]=Dt}const q=V.solve(s,n,!0);O.iterations=q.iterations,O.residual=q.residual,O.capped=q.capped;const $=i.pl;for(let U=0;U<i.n;U+=1)$[U]=f[U]===H?J[U]:0;for(let U=S;U<=P;U+=1)for(let G=b;G<=M;G+=1){const tt=G+U*a;f[tt]===et&&($[tt]=W.x[V.at(G-b,U-S)])}for(let U=0;U<c;U+=1)for(let G=0;G<=a;G+=1){const tt=G+U*u;if(x[tt]===1){if(G===0){y[tt]-=N/l*2*($[U*a]-0);continue}if(G===a){y[tt]-=N/l*2*(0-$[a-1+U*a]);continue}y[tt]-=N/l*this.across(G-1+U*a,G+U*a)}}for(let U=0;U<=c;U+=1)for(let G=0;G<a;G+=1){const tt=G+U*a;if(w[tt]===1){if(U===0){A[tt]-=N/l*2*($[G]-0);continue}if(U===c){A[tt]-=N/l*2*(0-$[G+(c-1)*a]);continue}A[tt]-=N/l*this.across(G+(U-1)*a,G+U*a)}}this.afterSolve!==null&&this.afterSolve(V,b,S,t)}this.extrapolate();const L=this.markStranded(),I=this.g2p(L?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const B=this.last;return B.cells=T,B.uMax=I,B.escapedMass=this.escM,B.escapedOther=this.escO,B.escapedSalt=this.escS,B.escapedEnergy=this.escE,B}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e];return!(n>.5)||!(n>i)?fr:Math.max(fr,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===H&&n[e]===et?i/this.theta(e,t):n[e]===H&&n[t]===et?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new At(e.nx+1,e.ny+1));const s=qo*this.rhoRef*e.vCell*.25;this.last.viscIterations=i0(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===H}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:c}=this,{nx:l,ny:f}=s,u=1/Math.max(t,jo);for(let h=0;h<e.count;h+=1){const m=a[h];if(m===0)continue;const g=9*h,d=n[h],p=i[h];for(let x=0;x<9;x+=1){const w=d+x%3,y=p+(x/3|0);w<0||y<0||w>=l||y>=f||(c[w+y*l]+=r[g+x]*m*u)}}}extrapolate(){s0(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:c,dx:l}=n,f=1/l,u=a+1,h=n.ul,m=n.vl,g=4/(l*l);let d=0;for(let p=0;p<s.count;p+=1){if(t>0&&r[p]!==0){s.vy[p]-=e*t,s.c00[p]=0,s.c01[p]=0,s.c10[p]=0,s.c11[p]=0;const L=s.vx[p]*s.vx[p]+s.vy[p]*s.vy[p];L>d&&(d=L);continue}const x=s.x[p],w=s.y[p],y=x*f,A=w*f;let F=ae(y,i,0),k=ae(A-.5,i,3),_=0,b=0,M=0;for(let L=0;L<3;L+=1){const I=k+L,B=(I+.5)*l-w;for(let D=0;D<3;D+=1){const R=F+D,V=i[D]*i[3+L];let W;R>=0&&R<=a&&I>=0&&I<c?W=h[R+I*u]:(this.mirrorU(R,I),W=this.ms*h[this.mf]),_+=V*W,b+=V*W*(R*l-x),M+=V*W*B}}F=ae(y-.5,i,0),k=ae(A,i,3);let S=0,P=0,T=0;for(let L=0;L<3;L+=1){const I=k+L,B=I*l-w;for(let D=0;D<3;D+=1){const R=F+D,V=i[D]*i[3+L];let W;R>=0&&R<a&&I>=0&&I<=c?W=m[R+I*a]:(this.mirrorV(R,I),W=this.ms*m[this.mf]),S+=V*W,P+=V*W*((R+.5)*l-x),T+=V*W*B}}s.vx[p]=_,s.vy[p]=S,s.c00[p]=g*b,s.c01[p]=g*M,s.c10[p]=g*P,s.c11[p]=g*T;const O=_*_+S*S;O>d&&(d=O)}return Math.sqrt(d)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),n0(this.P,this.g,this.stranded)}velocityAt(t,e,s){So(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;o0(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class m0{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?Cr:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=cl(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Or(r,i);return}const s=this.mat[t],n=Ea(s,this.h[t]);this.T[t]=n,this.rho[t]=os(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==lt)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?ol(this.T[t],e/this.mass[t]):Tr(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function p0(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:c}=o,{nx:l,ny:f,n:u,kind:h}=s,{Tl:m}=t,g=t.rd;let d=!1;for(let y=0;y<u;y+=1){if(g[y]=0,h[y]===H&&t.Cl[y]>0){const M=t.boilingAt(y,r.pAt(y));m[y]>M&&(g[y]=M,d=!0);continue}if(h[y]!==et)continue;const A=y%l,F=(y-A)/l,k=F+1<f?y+l:-1;if(!(k>=0&&h[k]===H&&s.faceOpen(y,3)>0||A>0&&h[y-1]===H&&s.faceOpen(y,0)>0||A<l-1&&h[y+1]===H&&s.faceOpen(y,1)>0||F>0&&h[y-l]===H&&s.faceOpen(y,2)>0))continue;const b=t.boilingAt(y,r.pAt(y));m[y]>b&&(g[y]=b,d=!0)}if(!d)return;const p=t.mtot;p.fill(0);const x=t.Y0;x.fill(0);const w=i.rhoRef*s.vCell/4;for(let y=0;y<n.count;y+=1){if(n.mat[y]!==lt)continue;const A=n.smass[2*y],F=A>0?A/n.mass[y]:0,k=9*y;let _=0,b=0,M=-1,S=0;for(let O=0;O<2;O+=1){for(let L=0;L<9;L+=1){const I=i.wt[k+L];if(I===0)continue;const B=i.bi[y]+L%3,D=i.bj[y]+(L/3|0);if(B<0||D<0||B>=l||D>=f)continue;const R=B+D*l,V=g[R];if(V===0)continue;const W=A>0?Hc(V,F):Ft(V);if(n.h[y]<=W)continue;const N=xt(V),Y=I*n.mass[y]*(n.h[y]-W)/(N-(A>0?Gn(V,F):W));O===0?(_+=Y,b+=Y*N,I>S&&(S=I,M=R)):(p[R]+=Y,x[R]+=Y*N)}if(_===0)break;if(O===0&&n.mass[y]-A-_<ur*w){const L=g[M],I=n.mass[y]-A,B=xt(L),D=A>0?A*vi(L):0;p[M]+=I,x[M]+=I*B,A>0&&o.salt.deposit(n.x[y],n.y[y],A,D),c.src[M]-=(I*B+D-n.mass[y]*n.h[y])/e,_=-1;break}}if(_===0)continue;if(_<0){i.removeParticle(y),y-=1;continue}const P=n.mass[y]/n.rho[y],T=n.mass[y]-_;n.h[y]=(n.mass[y]*n.h[y]-b)/T,n.mass[y]=T,n.derive(y),i.dVp[y]+=T/n.rho[y]-P}for(let y=0;y<u;y+=1){if(p[y]===0)continue;const A=y%l,F=(y-A)/l;let k=0;const _=h[y]===H?y:F+1<f&&h[y+l]===H&&s.faceOpen(y,3)>0?y+l:-1;if(_>=0)s.mg[Q*u+_]+=p[y],s.Hg[_]+=x[y],a.deriveCell(_);else{const b=t.side;b[0]=A>0&&h[y-1]===H&&s.faceOpen(y,0)>0?y-1:-1,b[1]=A<l-1&&h[y+1]===H&&s.faceOpen(y,1)>0?y+1:-1,b[2]=F>0&&h[y-l]===H&&s.faceOpen(y,2)>0?y-l:-1,b[3]=-1;for(let M=0;M<3;M+=1)b[M]>=0&&(k+=1);for(let M=0;M<3;M+=1)b[M]<0||(s.mg[Q*u+b[M]]+=p[y]/k,s.Hg[b[M]]+=x[y]/k,a.deriveCell(b[M]))}t.produced+=p[y]}}function g0(o,t,e,s,n){const i=o.grid,r=i.n,a=i.mg[it*r+t],c=i.mg[ot*r+t],l=i.Hg[t];if(s<=0)return wc(a,c,e,l);let f=n;for(let u=0;u<6;u+=1){const h=a*ie(it,f)+c*ie(ot,f)+e*xt(f)+s*Ft(f),m=(l-h)/er(a,c,e,s,f);if(f+=m,Math.abs(m)<1e-10)break}return f}function Qs(o,t,e,s,n,i){const r=o.grid,a=r.n,c=r.mg[Q*a+t]-e,l=r.mfog[t]+e,f=g0(o,t,c,l,i),u=c/mt[Q];return(u+s>0?u/(u+s)*n:0)-an(f)}function Ii(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[Q*r+e],s));n.mg[Q*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function x0(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==H)continue;const r=e.mg[Q*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const c=e.mg[it*n+i]/mt[it]+e.mg[ot*n+i]/mt[ot],l=s.pAt(i),f=e.T[i];if(a<=0){const w=r/mt[Q];if(w/(w+c)*l<.999*an(f))continue}const u=Qs(o,i,0,c,l,f);if(u<=0&&a<=0)continue;let h,m,g,d;if(u>0)h=0,g=u,m=r,d=Qs(o,i,m,c,l,f);else if(m=0,d=u,h=-a,g=Qs(o,i,h,c,l,f),g<=0){Ii(o,t,i,h);continue}if(d>0){Ii(o,t,i,m);continue}let p=h,x=0;for(let w=0;w<40;w+=1){p=(h*d-m*g)/(d-g),(!Number.isFinite(p)||p<=Math.min(h,m)||p>=Math.max(h,m))&&(p=.5*(h+m));const y=Qs(o,i,p,c,l,f);if(Math.abs(y)<=1e-13*l)break;y>0?(h=p,g=y,x===1&&(d/=2),x=1):(m=p,d=y,x===-1&&(g/=2),x=-1)}if(Ii(o,t,i,p),u<0&&p>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=Qs(o,i,0,c,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/an(e.T[i]))}}}const ur=.001;class v0{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*ce.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*an(t)/e),c=i.mg[it*r+s],l=i.mg[ot*r+s],f=c+l,u=f>0?f/(c/mt[it]+l/mt[ot]):.02885;return a*mt[Q]/(a*mt[Q]+(1-a)*u)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:c,acc:l,accH:f,accAll:u,accS:h}=this;c.fill(0),a.fill(0),l.fill(0),f.fill(0);let m=!1,g=!1;for(let p=0;p<e.count;p+=1){const x=e.mass[p],w=e.mat[p],y=x*e.cp(p),A=e.smass[2*p],F=x-A,k=A>0?Gn(e.T[p],A/x):e.h[p];A>0&&!g&&(g=!0,h.fill(0)),w!==lt&&!m&&(m=!0,u.fill(0),this.accMat.fill(0));const _=9*p;for(let b=0;b<9;b+=1){const M=s.wt[_+b];if(M===0)continue;const S=s.bi[p]+b%3,P=s.bj[p]+(b/3|0);if(S<0||P<0||S>=n||P>=i)continue;const T=S+P*n;c[T]+=M*y,a[T]+=M*y*e.T[p],w===lt&&(l[T]+=M*F,f[T]+=M*F*k),g&&(h[T]+=M*A),m&&(this.accMat[w*r+T]+=M*x)}}for(let p=0;p<r;p+=1)a[p]=c[p]>0?a[p]/c[p]:t.T[p];if(this.mixed=m,this.salty=g,g)for(let p=0;p<r;p+=1){const x=h[p]>0&&l[p]>0?h[p]/(l[p]*Bs):0;this.mol[p]=x,this.aw[p]=x>0?Vc(a[p],x):1}if(!m){u.set(l),this.host.fill(lt);return}const d=ce.length;for(let p=0;p<r;p+=1){this.accMat[lt*r+p]=g?l[p]+h[p]:l[p];let x=0,w=lt,y=-1;for(let A=0;A<d;A+=1){const F=this.accMat[A*r+p];x+=F,F>y&&(y=F,w=A)}u[p]=x,this.host[p]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?Nc(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:Ft(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?lt:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:c,dm:l}=this;l.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){if(n.mat[u]!==lt)continue;const h=9*u;let m=0;for(let g=0;g<9;g+=1){const d=i.wt[h+g];if(d===0)continue;const p=i.bi[u]+g%3,x=i.bj[u]+(g/3|0);if(p<0||x<0||p>=r||x>=a)continue;const w=p+x*r;t[w]!==0&&c[w]>0&&(m+=t[w]*d*(n.mass[u]-n.smass[2*u])/c[w])}l[u]=m}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const h=l[u];if(h===0)continue;if(n.smass[2*u]>0){this.applySalty(u,h,f,e);continue}const m=n.mass[u]/n.rho[u],g=n.mass[u]+h;if(g<ur*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,g),e);continue}this.track(u,h),n.mass[u]=g,i.dVp[u]+=g/n.rho[u]-m}for(let u=0;u<s.n;u+=1){if(t[u]<=0||c[u]>0)continue;const h=u%r,m=(u-h)/r,g=n.add((h+.5)*s.dx,(m+.5)*s.dx,t[u],this.waterH(u),lt);g<0||(i.placeParticle(g),i.dVp[g]=t[u]/n.rho[g],this.track(g,t[u]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,c=9*t,l=Tr(n.mat[t],n.T[t]);for(let f=0;f<9;f+=1){const u=i.wt[c+f];if(u===0)continue;const h=i.bi[t]+f%3,m=i.bj[t]+(f/3|0);if(h<0||m<0||h>=r||m>=a)continue;const g=h+m*r;this.acc[g]+=u*e,this.accH[g]+=u*e*n.h[t],this.accAll[g]+=u*e,this.Cl[g]+=u*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],c=i.mass[t],l=c-a,f=Gn(i.T[t],a/c),u=i.cp(t),h=c*i.h[t]+e*f,m=l+e;if(m<ur*s){this.trackSalty(t,-l,-l*f,-c,-a,-c*u),this.dryUp(t,Math.max(0,m),h,n);return}const g=c/i.rho[t];i.mass[t]=c+e,i.h[t]=h/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-g;const d=Gn(i.T[t],a/i.mass[t]);this.trackSalty(t,e,m*d-l*f,e,0,i.mass[t]*i.cp(t)-c*u)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:c}=this.e,{nx:l,ny:f}=a,u=9*t;for(let h=0;h<9;h+=1){const m=c.wt[u+h];if(m===0)continue;const g=c.bi[t]+h%3,d=c.bj[t]+(h/3|0);if(g<0||d<0||g>=l||d>=f)continue;const p=g+d*l;this.acc[p]+=m*e,this.accH[p]+=m*s,this.accAll[p]+=m*n,this.accS[p]+=m*i,this.Cl[p]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:c,gas:l}=this.e,f=r.T[t],u=r.smass[2*t],h=u*vi(f);this.e.salt.deposit(r.x[t],r.y[t],u,h);const m=i.cellAt(r.x[t],r.y[t]);let g=m;for(;g>=0&&i.kind[g]!==H;)g=g+i.nx<i.n?g+i.nx:-1;if(m>=0&&g>=0)e>0&&(i.mg[Q*i.n+g]+=e,i.Hg[g]+=e*xt(f),this.produced+=e,l.deriveCell(g)),c.src[m]-=(e*xt(f)+h-s)/n;else if(m>=0){for(let d=0;d<r.count;d+=1)if(d!==t&&r.mat[d]===r.mat[t]&&i.cellAt(r.x[d],r.y[d])===m){const p=r.mass[d]*r.h[d]+(s-h);r.mass[d]+=e,r.h[d]=p/r.mass[d],r.derive(d);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:c}=this.e,l=n.cellAt(i.x[t],i.y[t]);let f=l;for(;f>=0&&n.kind[f]!==H;)f=f+n.nx<n.n?f+n.nx:-1;if(e>0&&f>=0&&l>=0){const u=i.T[t];n.mg[Q*n.n+f]+=e,n.Hg[f]+=e*xt(u),a.src[l]-=e*(xt(u)-i.h[t])/s,this.produced+=e,c.deriveCell(f)}else if(e>0&&l>=0){for(let u=0;u<i.count;u+=1)if(u!==t&&i.mat[u]===i.mat[t]&&n.cellAt(i.x[u],i.y[u])===l){const h=i.mass[u]*i.h[u]+e*i.h[t];i.mass[u]+=e,i.h[u]=h/i.mass[u],i.derive(u);break}}r.removeParticle(t)}step(t){this.diffuse(t),p0(this.e,this,t),x0(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:c,ny:l,n:f,depth:u,kind:h}=s,{mtot:m,rd:g,Y0:d,Tl:p,Fm:x,Fe:w,edge:y,hvC:A,hnC:F,hoC:k}=this;let _=!1;for(let L=0;L<f;L+=1){if(h[L]!==H){m[L]=0;continue}const I=s.mg[L]+s.mg[f+L]+s.mg[Q*f+L];m[L]=I,d[L]=I>0?s.mg[Q*f+L]/I:0;const B=s.T[L];g[L]=n.rho[L]*ja(B,i.pAt(L)),A[L]=xt(B),F[L]=ie(it,B),k[L]=ie(ot,B),_=!0}if(!_)return;for(let L=0;L<l;L+=1)for(let I=0;I<c;I+=1){const B=I+L*c;y[B]=h[B]===H&&(I===0||L===0||I===c-1||L===l-1||h[B-1]!==H||h[B+1]!==H||h[B-c]!==H||h[B+c]!==H)?1:0}const b=a.begin(c,l),M=b.stride,S=e.ambientY[Q],{bG:P,bY:T}=this;for(let L=0;L<l;L+=1)for(let I=0;I<c;I+=1){const B=I+L*c;if(h[B]!==H||m[B]<=0)continue;const D=I+1+(L+1)*M;b.act[D]=1,b.x[D]=d[B],b.dH[D]=m[B]/t;let R=m[B]*d[B]/t;const V=s.au[I+1+L*(c+1)],W=s.av[B+c];if(I+1<c&&h[B+1]===H&&m[B+1]>0&&V>0&&(b.ax[D]=V*.5*(g[B]+g[B+1])*u),L+1<l&&h[B+c]===H&&m[B+c]>0&&W>0&&(b.ay[D]=W*.5*(g[B]+g[B+c])*u),y[B]===0){b.b[D]=R;continue}let N=0;for(let Y=0;Y<4;Y+=1){const J=this.boundary(B,I,L,Y,S);P[4*B+Y]=J,T[4*B+Y]=this.yb,!(J<=0)&&(N+=J,R+=J*this.yb)}b.dDx[D]=N,b.b[D]=R}a.solve(1e-9,200,!1),x.fill(0),w.fill(0);const O=b.x;for(let L=0;L<l;L+=1)for(let I=0;I<c;I+=1){const B=I+L*c;if(h[B]!==H||m[B]<=0)continue;const D=I+1+(L+1)*M,R=O[D],V=s.au[I+1+L*(c+1)],W=s.av[B+c];if(I+1<c&&h[B+1]===H&&m[B+1]>0&&V>0&&this.exchange(B,B+1,t*V*.5*(g[B]+g[B+1])*u*(R-O[D+1])),L+1<l&&h[B+c]===H&&m[B+c]>0&&W>0&&this.exchange(B,B+c,t*W*.5*(g[B]+g[B+c])*u*(R-O[D+M])),y[B]!==0)for(let N=0;N<4;N+=1){const Y=P[4*B+N];if(Y<=0)continue;const J=t*Y*(T[4*B+N]-R),$=(N===0?I===0:N===1?I===c-1:N===2?L===0:L===l-1)?-1:N===0?B-1:N===1?B+1:N===2?B-c:B+c;if($<0)this.ambientExchange(B,J);else if(h[$]===et)if(J>0){const U=p[$];s.mg[Q*f+B]+=J,s.Hg[B]+=J*xt(U),x[$]-=J,w[$]-=J*xt(U),this.produced+=J}else{const U=Math.min(-J,s.mg[Q*f+B]);s.mg[Q*f+B]-=U,s.Hg[B]-=U*xt(s.T[B]),x[$]+=U,w[$]+=U*xt(s.T[B]),this.condensed+=U}else if(h[$]===ft){const U=s.T[$];if(J<0){const G=Math.min(-J,s.mg[Q*f+B]);s.mg[Q*f+B]-=G,s.Hg[B]-=G*xt(s.T[B]),s.film[$]+=G,s.Es[$]+=G*Ft(U),r.src[$]+=G*(xt(s.T[B])-Ft(U))/t,this.dew+=G}else{const G=Math.min(J,s.film[$]);s.film[$]-=G,s.Es[$]-=G*Ft(U),s.mg[Q*f+B]+=G,s.Hg[B]+=G*xt(U),r.src[$]-=G*(xt(U)-Ft(U))/t,this.dew-=G}}}}for(let L=0;L<f;L+=1)x[L]!==0&&(r.src[L]+=(w[L]-x[L]*this.waterH(L))/t);this.applyMass(x,t);for(let L=0;L<f;L+=1)h[L]===H&&m[L]>0&&n.deriveCell(L)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:c,depth:l,kind:f}=r,u=n===0?e===0:n===1?e===a-1:n===2?s===0:s===c-1,h=2*this.rd[t]*l;if(u)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,h):0;const m=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=m;const g=f[m],d=this.Y0[t],p=this.e.regions.pAt(t);if(g===et){const x=r.faceOpen(t,n);if(!(x>0))return 0;const w=this.waterShare(m);return w<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],p,t,this.salty?this.aw[m]:1),x*h*(1-d)*w)}if(g===ft){const x=this.ysat(r.T[m],p,t);return d>x||r.film[m]>0&&d<x?(this.yb=x,h*(1-d)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let c=Math.abs(s);c=Math.min(c,n.mg[Q*i+r]);const l=n.mg[it*i+a],f=n.mg[ot*i+a],u=l+f,h=Math.min(c,u);if(c<=0)return;const m=this.hvC[r];if(n.mg[Q*i+r]-=c,n.mg[Q*i+a]+=c,n.Hg[r]-=c*m,n.Hg[a]+=c*m,h>0){const g=h*l/u,d=h-g;n.mg[it*i+a]-=g,n.mg[ot*i+a]-=d,n.mg[it*i+r]+=g,n.mg[ot*i+r]+=d;const p=g*this.hnC[a]+d*this.hoC[a];n.Hg[a]-=p,n.Hg[r]+=p}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[it*i+t]+n.mg[ot*i+t],c=Math.min(e,a);if(n.mg[Q*i+t]+=e,n.Hg[t]+=e*xt(r),c>0){const l=c*n.mg[it*i+t]/a,f=c-l;n.mg[it*i+t]-=l,n.mg[ot*i+t]-=f;const u=l*ie(it,n.T[t])+f*ie(ot,n.T[t]);n.Hg[t]-=u,s.flows.escapedAir+=c,s.flows.escapedEnergy+=u}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*xt(r)}else if(e<0){const a=Math.min(-e,n.mg[Q*i+t]),c=s.ambientY[it],l=s.ambientY[ot],f=c+l>0?c+l:1;n.mg[Q*i+t]-=a,n.Hg[t]-=a*xt(n.T[t]);const u=a*c/f,h=a-u;n.mg[it*i+t]+=u,n.mg[ot*i+t]+=h;const m=u*ie(it,r)+h*ie(ot,r);n.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*xt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,c=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<c)continue;const f=l%n,u=(l-f)/n,m=[f>0?l-1:-1,f<n-1?l+1:-1,u+1<i?l+n:-1,u>0?l-n:-1].find(A=>A>=0&&a[A]===H);if(m===void 0)continue;const g=m%n,d=(m-g)/n,p=(g+.5+.25*Math.sign(f-g))*t.dx,x=(d+.5+.25*Math.sign(u-d))*t.dx,w=t.T[l],y=e.add(p,x,c,Ft(w),lt);y<0||(t.film[l]-=c,t.Es[l]-=c*Ft(w),s.placeParticle(y),s.dVp[y]=c/e.rho[y])}}}function Jc(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(ce.length);let r=0,a=0,c=0;for(let l=0;l<e.count;l+=1)for(let f=0;f<9;f+=1){const u=s.wt[9*l+f];if(u===0)continue;const h=s.bi[l]+f%3,m=s.bj[l]+(f/3|0);if(h<0||m<0||h>=n.nx||m>=n.ny||h+m*n.nx!==t)continue;i[e.mat[l]]+=u*e.mass[l],r+=u*e.mass[l];const g=e.smass[2*l];g>0?(a+=u*g,c+=u*(e.mass[l]-g)):e.mat[l]===0&&(c+=u*e.mass[l])}return{m:i,all:r,salt:a,water:c}}function y0(o,t){const{m:e,all:s}=Jc(o,t);if(s<=0)return[];const n=[];for(let i=0;i<ce.length;i+=1)e[i]>0&&n.push({id:ce[i].id,share:e[i]/s});return n}function w0(o,t,e){var S;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ft?"solid":s.kind[n]===et?"liquid":"gas",a=o.pressureAt(n);let c=0;const l=[0,0,0];for(let P=0;P<yt;P+=1)l[P]=s.mg[P*i+n]/mt[P],c+=l[P];for(let P=0;P<yt;P+=1)l[P]=c>0?l[P]/c:0;const f=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],u=r==="gas"?l[Q]*a:0,h=Math.floor(t/s.dx),m=Math.floor(e/s.dx),g=r==="liquid"?.5*(s.ul[h+m*(s.nx+1)]+s.ul[h+1+m*(s.nx+1)]):.5*(s.ug[h+m*(s.nx+1)]+s.ug[h+1+m*(s.nx+1)]),d=r==="liquid"?.5*(s.vl[h+m*s.nx]+s.vl[h+(m+1)*s.nx]):.5*(s.vg[h+m*s.nx]+s.vg[h+(m+1)*s.nx]),p=o.particles;let x=-1,w=(1.5*s.dx)**2;for(let P=0;P<p.count;P+=1){const T=(p.x[P]-t)**2+(p.y[P]-e)**2;T<w&&(w=T,x=P)}const y=o.bubbles;let A=-1,F=1/0;for(let P=0;P<y.count;P+=1){const T=Math.hypot(y.x[P]-t,y.y[P]-e);T<=Math.max(y.r[P],3*s.dx)&&T<F&&(A=P,F=T)}const k=Jc(o,n),_=[];if(k.all>0)for(let P=0;P<ce.length;P+=1)k.m[P]>0&&_.push({id:ce[P].id,share:k.m[P]/k.all});let b=null;if(r==="liquid"&&k.salt>0&&k.water>0){const P=k.salt/(k.water*Bs);b={w:k.salt/(k.salt+k.water),molality:P,Tb:Nc(a,P),Tf:Uc(P)}}const M=r==="gas"?o.gas.rho[n]:r==="liquid"?b!==null&&!o.phase.mixed?Or(f,b.w):o.phase.mixed?os(o.phase.host[n],f):o.liquid.rhoRef:s.solid[n]!==0?ut[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?ut[s.solid[n]-1].id:null,T:f,p:a,Tsat:kt(a),x:l,rh:r==="gas"?u/pi(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:M,phi:s.phi[n],u:g,v:d,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:_,salt:b},particle:x<0?null:{id:p.id[x],T:p.T[x],vx:p.vx[x],vy:p.vy[x],mass:p.mass[x],rho:p.rho[x],dist:Math.sqrt(w),liquid:((S=ce[p.mat[x]])==null?void 0:S.id)??ce[0].id,salt:p.saltFraction(x)},bubble:A<0?null:o.bubbleModel.describe(A),body:b0(o,t,e)}}function b0(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&js(n)?n.id:"",material:ut[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}class F0{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,a=e+1;this.id.fill(-1);let c=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(c);let f=0,u=0,h=0;for(this.stack[f++]=l,this.id[l]=c;f>0;){const m=this.stack[--f];h+=1-t.fs[m];const g=m%e,d=(m-g)/e,p=g+d*a,x=g+d*e;(g===0&&t.openL&&i[p]>0||g===e-1&&t.openR&&i[p+1]>0||d===0&&t.openB&&r[x]>0||d===s-1&&t.openT&&r[x+e]>0)&&(u=1),g>0&&n[m-1]===0&&this.id[m-1]===-1&&i[p]>0&&(this.id[m-1]=c,this.stack[f++]=m-1),g<e-1&&n[m+1]===0&&this.id[m+1]===-1&&i[p+1]>0&&(this.id[m+1]=c,this.stack[f++]=m+1),d>0&&n[m-e]===0&&this.id[m-e]===-1&&r[x]>0&&(this.id[m-e]=c,this.stack[f++]=m-e),d<s-1&&n[m+e]===0&&this.id[m+e]===-1&&r[x+e]>0&&(this.id[m+e]=c,this.stack[f++]=m+e)}this.open[c]=u,this.vFluid[c]=h*t.vCell,c+=1}this.count=c}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<yt;a+=1){const c=s.mg[a*n+i];this.mSum[r]+=c,this.nSum[r]+=c/mt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let c=0;c<s;c+=1){if(this.id[c]!==t||e.kind[c]===ft)continue;let l=0;for(let f=0;f<yt;f+=1)l+=e.mg[f*s+c]/mt[f];n+=l*qt*e.T[c]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let c=0;c<2;c+=1){let l=-i,f=0;for(let u=0;u<s;u+=1){if(this.id[u]!==t||e.kind[u]===ft)continue;let h=0;for(let d=0;d<yt;d+=1)h+=e.mg[d*s+u]/mt[d];const m=r-a*(e.dx*((u-u%e.nx)/e.nx+.5)),g=h*qt*e.T[u];l+=g/m,f-=g/(m*m)}r-=l/f}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===H)return s;return-1}}class A0{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:c}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),f=Math.min(c-1,Math.max(0,Math.floor(e/r.dx))),u=l+f*a,h=i.heat;if(h.hasSolid(u)){this.toSolid(u,s,n);return}const m=[f>0?u-a:-1,l>0?u-1:-1,l<a-1?u+1:-1,f<c-1?u+a:-1];for(const g of m)if(g>=0&&h.hasSolid(g)){this.toSolid(g,s,n);return}for(let g=f-2;g>=0;g-=1){const d=l+g*a;if(h.hasSolid(d)){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=sl(r);if(n<=a*i*(1+1e-9))continue;const c=(n-a*i)/(1-a),l=c*vi(r),f=i/t.rho[s],u=i*t.h[s]-l;t.mass[s]=i-c,t.smass[2*s]=n-c,t.h[s]=u/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-f,this.deposit(t.x[s],t.y[s],c,l),this.crystallized+=c}}}const _0=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],Ze=_0.length,Io=1/120;class k0{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"exchange");v(this,"bodies");v(this,"melt");v(this,"solver");v(this,"extremes",new Ff(this));v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",Io);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(at));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",bo());v(this,"snap",Mf());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(Ze));v(this,"stamp",new Float64Array(Ze+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);v(this,"building",!1);this.options=e;const s=Ro(t)?t:qi(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Io}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=jf[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>If;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new Zf(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new m0(Math.max(4096,4*i.n+1024)),this.bubbles=new sf(4096),this.solver=new At(s,n),this.regions=new F0(i),this.liquid=new d0(i,this.particles,this.solver),this.gas=new Jf(i,this.regions,this.solver),this.heat=new e0(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new df(this),this.phase=new v0(this),this.salt=new A0(this),this.exchange=new Qf(this),this.bodies=new Nl(this),this.heat.bodies=this.bodies.list,this.melt=new ef(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,a,c,l,f)=>this.bodies.hitPoint(r,a,c,l,f),this.liquid.afterSolve=(r,a,c,l)=>this.bodies.probe(r,a,c,l),this.prevKind=new Uint8Array(i.n),this.rng=new Xc(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=bo(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=H,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,c=(i>0?i:qa)/a,l=(r>0||i>0?r:Ia)/a,f=1/(c/mt[it]+l/mt[ot]),u=Math.min(.99,s*pi(e)/t),h=u*mt[Q]/(u*mt[Q]+(1-u)*f);this.ambientY.fill(0),this.ambientY[it]=(1-h)*c,this.ambientY[ot]=(1-h)*l,this.ambientY[Q]=h;let m=0;for(let g=0;g<yt;g+=1)m+=this.ambientY[g]/mt[g];this.regions.pAmb=t,this.regions.rhoAmb=t/(qt*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>oi(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=js(t)&&(t.id===""||oi(this,t.id)>=0)?{...t,id:Yc(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!this.surfaceAfterFill(e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=Lf(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let c=0;c<n;c+=1)for(let l=0;l<s;l+=1){const f=l+c*s;e.solid[f]===0&&(e.kind[f]===et||as(t.region,(l+.5)*e.dx,(c+.5)*e.dx))&&(i[f]=1)}const r=new Uint8Array(e.n),a=[];for(let c=0;c<e.n;c+=1){if(i[c]===0||r[c]!==0)continue;let l=!1;for(a.push(c),r[c]=1;a.length>0;){const f=a.pop(),u=f%s,h=(f-u)/s,m=this.gas,g=[m.across(f,u,h,0),m.across(f,u,h,1),m.across(f,u,h,2),m.across(f,u,h,3)];(u===0&&e.openL||u===s-1&&e.openR||h===0&&e.openB||h===n-1&&e.openT)&&(l=!0);for(const d of g)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,a.push(d))}}if(!l)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),c=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&c!==void 0&&c.op==="hotplate"){const l=[...this.scene.ops];l[a]={...c,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return Vf({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=Ro(t)?t:qi(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=qi(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,c=this.dt,l=this.stamp;l[0]=be();const f=n.pvTerm();this.bodies.prepare()&&(n.update(r,a),this.flows.bodyWork+=n.pvTerm()-f),l[1]=be(),e.splatVolumeChange(c),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===H?n.pAt(d)-this.pRef:0;e.step(c,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=be(),s.updateVolumes(),s.markFaces();const u=s.escaped[Q]+s.escaped[yt],h=s.escaped[it]+s.escaped[ot],m=s.escaped[yt+1];s.transport(c),this.flows.escapedWater+=s.escaped[Q]+s.escaped[yt]-u,this.flows.escapedAir+=s.escaped[it]+s.escaped[ot]-h,this.flows.escapedEnergy+=s.escaped[yt+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(c,this.gy),s.sources(c),s.project(c,this.tol,this.maxIter),l[3]=be(),this.bubbleModel.step(c),l[4]=be(),this.phase.step(c),this.salt.step(),l[5]=be(),i.step(c,1e-6,200),this.exchange.step(c),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=be(),l[7]=be(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===H?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=c,this.steps+=1,l[8]=be(),this.bodies.finish(c),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit()),l[9]=be();const g=this.steps<5?1:1/30;for(let d=0;d<Ze;d+=1)this.timings[d]+=g*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=g*(l[Ze]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let c=0;c<e.count;c+=1)i.dp0[c]!==0&&(a=!0);if(a){for(let c=0;c<s.count;c+=1){const l=t.cellAt(s.x[c],s.y[c]),f=l<0?-1:e.id[l];if(f<0||i.dp0[f]===0)continue;const u=s.mass[c],h=u/s.rho[c];s.h[c]+=h*i.dp0[f]/u,s.derive(c),r.dVp[c]+=u/s.rho[c]-h}for(let c=0;c<n.count;c+=1){const l=t.cellAt(n.x[c],n.y[c]),f=l<0?-1:e.id[l];f>=0&&i.dp0[f]!==0&&(n.H[c]+=n.V[c]*i.dp0[f])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,kf(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.particles.hasOther()||this.particles.hasSalt()||this.salt.crustMass()>0||this.salt.floorTotals().mass>0||this.bodies.anyFree||this.melt.any()}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===lt&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==lt&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===et?this.pRef+e.pl[t]:e.kind[t]===H?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return w0(this,t,e)}liquidsAt(t){return y0(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===et?e+=1:t.kind[d]===H&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,c=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy+a.bodyWork),l=r.water.total-this.water0-a.editWater,f=r.other.total-this.other0-a.editOther,u=r.salt.total-this.salt0-a.editSalt,h=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.phase.producedMark)/m,this.phase.producedMark=h,this.vapourLast=this.time);const g=[];for(let d=0;d<this.regions.count;d+=1)g.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor,bodies:{count:this.bodies.list.filter(d=>!d.gone).length,free:this.bodies.list.filter(d=>d.free).length,awake:this.bodies.list.filter(d=>d.awake).length},heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:g,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:c,waterError:l,otherError:f,saltError:u,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats()}}}const be=()=>typeof performance<"u"?performance.now():Date.now();function Ro(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class Zc{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=gc(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},c=this.last;let l=0,f=0;if(c!==null&&a.t>c.t){const m=a.t-c.t,g=(a.heater-c.heater)/m,d=(a.solids-c.solids+a.SG-c.SG+a.lossS-c.lossS+a.LG-c.LG+a.sens-c.sens+a.bub-c.bub)/m;l=(a.vap-c.vap)/m,f=Math.max(0,(g-d)/i)}this.last=a;const u=this.vapour()*i,h=r.energy;return this.started||(this.started=!0,this.latent0=u,this.stored0=h),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:u-this.latent0,sensible:h-this.stored0-(u-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:f}}}const _s={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Ps=16,K={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},ts=96,Eo=16,M0=57,Qt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Fe=16,P0={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},hr=8,Ut={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},xe=8,T0={TSUM:0,CELLS:1},dr=2,S0={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},ta=16,nt={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},Ri=55,Ke={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},Ei=6,mr={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},Di=13,Pe={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},Vi=16,C0={KNOWN:0,MARK:1,MARK2:2,GAS:3},Do=4,L0={F:0},Ni=1,O0={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},pr=12,Yt=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),B0=[Yt("G_",_s),Yt("C_",K),Yt("R_",Qt),Yt("RA_",P0),Yt("H_",Ut),Yt("HA_",T0),Yt("S_",S0),Yt("F_",nt),Yt("U_",Ke),Yt("A_",mr),Yt("FF_",Pe),Yt("FU_",C0),Yt("AF_",L0),Yt("BA_",O0),`const RACC_STRIDE: u32 = ${hr}u;`,`const HEAT_STRIDE: u32 = ${xe}u;`,`const HACC_STRIDE: u32 = ${dr}u;`,`const CGS_STRIDE: u32 = ${ta}u;`,`const BACC_STRIDE: u32 = ${pr}u;`].join(`
`);function ct(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Wt=o=>o.map(ct).join(", "),Ot=St.species[0],qn=St.species[1],In=St.species[2],es=Ot.liquid.cp.table,Ce=es.map(o=>o[0]),rs=es.map(o=>o[1]),ci=[rs[0]*(Ce[0]-st)];for(let o=1;o<es.length;o+=1)ci.push(ci[o-1]+.5*(rs[o]+rs[o-1])*(Ce[o]-Ce[o-1]));const[j0,q0,I0]=Ot.vapour.cp.linear,gr=st+100,R0=(()=>{let o=0;for(;o<Ce.length-2&&gr>=Ce[o+1];)o+=1;const t=gr-Ce[o],e=(rs[o+1]-rs[o])/(Ce[o+1]-Ce[o]);return ci[o]+rs[o]*t+.5*e*t*t})(),E0=R0+Ot.saturation.hlv100.v,_e=St.solids,Ui=4294967295,D0=`
struct Params {
  nx: u32, ny: u32, n: u32, nu: u32,
  nv: u32, nf: u32, pcap: u32, bcap: u32,
  nsites: u32, nreg: u32, nheat: u32, n0: u32,
  dx: f32, depth: f32, vcell: f32, aface: f32,
  invdx: f32, boxw: f32, boxh: f32, dtmax: f32,
  gy: f32, pref: f32, pamb: f32, rhoamb: f32,
  tamb: f32, hext: f32, tol: f32, liquidPower: f32,
  ambN2: f32, ambO2: f32, ambH2O: f32, ambH: f32,
  yN2: f32, yO2: f32, yH2O: f32, tsatAmb: f32,
  openL: u32, openR: u32, openB: u32, openT: u32,
  sealed: u32, harness: u32, theta: f32, pad0: u32,
}`,Vo=44,V0=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,ds=26,N0=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,ms=29,U0=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Gi=8,G0=`
struct Level {
  nx: u32, ny: u32, stride: u32, size: u32,
  ax: u32, ay: u32, dH: u32, dDx: u32,
  dDy: u32, diag: u32, inv: u32, x: u32,
  b: u32, h: u32, gx: u32, gy: u32,
  gDx: u32, gDy: u32, eDx: u32, eDy: u32,
  area: u32, ox: u32, oy: u32, act: u32,
  pIdx: u32, pW: u32, lv: u32, xp: u32,
  pad1: u32, pad2: u32, pad3: u32, pad4: u32,
}
struct LevelPair { F: Level, C: Level }
struct Iter { k: u32, p0: u32, p1: u32, p2: u32 }
struct SolveCfg { tolsq: f32, it: u32, cap: u32, res: u32 }
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,H0=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${ct(st)};
const R_GAS: f32 = ${ct(qt)};
const P_ATM: f32 = ${ct(en)};
const G0: f32 = ${ct(di)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${ct(qn.molarMass.v)};
const M_O2: f32 = ${ct(In.molarMass.v)};
const M_H2O: f32 = ${ct(Ot.molarMass.v)};
const CP_N2: f32 = ${ct(qn.gas.cp.v)};
const CP_O2: f32 = ${ct(In.gas.cp.v)};
const CPV0: f32 = ${ct(j0)};
const CPV1: f32 = ${ct(q0)};
const CPV_T: f32 = ${ct(I0)};
const T100: f32 = ${ct(gr)};
const HV100: f32 = ${ct(E0)};
const NCP: i32 = ${es.length};
const CP_T = array<f32, ${es.length}>(${Wt(Ce)});
const CP_V = array<f32, ${es.length}>(${Wt(rs)});
const CP_H = array<f32, ${es.length}>(${Wt(ci)});
const KELL = array<f32, 7>(${Wt(Ot.liquid.kell.c)});
const KL = array<f32, 3>(${Wt(Ot.liquid.k.poly)});
const VA: f32 = ${ct(Ot.liquid.mu.vogel[0])};
const VB: f32 = ${ct(Ot.liquid.mu.vogel[1])};
const VC: f32 = ${ct(Ot.liquid.mu.vogel[2])};
const ST_B: f32 = ${ct(Ot.surfaceTension.B)};
const ST_b: f32 = ${ct(Ot.surfaceTension.b)};
const ST_MU: f32 = ${ct(Ot.surfaceTension.mu)};
const T_CRIT: f32 = ${ct(Ot.saturation.Tc.v)};
const RHO_CRIT: f32 = ${ct(Ot.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Wt(Ot.saturation.if97.n)});
const RVC = array<f32, 6>(${Wt(Ot.saturation.vapourDensity.c)});
const KV: f32 = ${ct(Ot.vapour.k.v)};
const MUV: f32 = ${ct(Ot.vapour.mu.v)};
const KN = array<f32, 3>(${Wt(qn.gas.k.power)});
const KO = array<f32, 3>(${Wt(In.gas.k.power)});
const MN = array<f32, 3>(${Wt(qn.gas.mu.sutherland)});
const MO = array<f32, 3>(${Wt(In.gas.mu.sutherland)});
const DV0: f32 = ${ct(St.vapourInAir.D0.v)};
const DVT0: f32 = ${ct(St.vapourInAir.T0.v)};
const DVE: f32 = ${ct(St.vapourInAir.exponent.v)};
const NSOL: u32 = ${_e.length}u;
const S_RHO = array<f32, ${_e.length}>(${Wt(_e.map(o=>o.rho.v))});
const S_CP = array<f32, ${_e.length}>(${Wt(_e.map(o=>o.cp.v))});
const S_K = array<f32, ${_e.length}>(${Wt(_e.map(o=>o.k.v))});
const S_THETA = array<f32, ${_e.length}>(${Wt(_e.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${ct(Qc)};
const REG_STRIDE: u32 = ${Fe}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${ct(bc)};
`,$0=`
fn cpSeg(T: f32) -> i32 {
  if (T < CP_T[0]) { return -1; }
  if (T >= CP_T[NCP - 1]) { return NCP - 1; }
  var k = clamp(i32(floor((T - T0) / 10.0)), 0, NCP - 2);
  loop { if (k > 0 && T < CP_T[k]) { k -= 1; } else { break; } }
  loop { if (k < NCP - 2 && T >= CP_T[k + 1]) { k += 1; } else { break; } }
  return k;
}
fn cpL(T: f32) -> f32 {
  let k = cpSeg(T);
  if (k < 0) { return CP_V[0]; }
  if (k == NCP - 1) { return CP_V[NCP - 1]; }
  return CP_V[k] + (CP_V[k + 1] - CP_V[k]) * (T - CP_T[k]) / (CP_T[k + 1] - CP_T[k]);
}
fn hL(T: f32) -> f32 {
  let k = cpSeg(T);
  if (k < 0) { return CP_H[0] + CP_V[0] * (T - CP_T[0]); }
  if (k == NCP - 1) { return CP_H[NCP - 1] + CP_V[NCP - 1] * (T - CP_T[NCP - 1]); }
  let d = T - CP_T[k];
  let s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  return CP_H[k] + CP_V[k] * d + 0.5 * s * d * d;
}
fn tFromHL(h: f32) -> f32 {
  if (h < CP_H[0]) { return CP_T[0] + (h - CP_H[0]) / CP_V[0]; }
  if (h >= CP_H[NCP - 1]) { return CP_T[NCP - 1] + (h - CP_H[NCP - 1]) / CP_V[NCP - 1]; }
  var k = clamp(i32(floor(h / 41900.0)), 0, NCP - 2);
  loop { if (k > 0 && h < CP_H[k]) { k -= 1; } else { break; } }
  loop { if (k < NCP - 2 && h >= CP_H[k + 1]) { k += 1; } else { break; } }
  let s = (CP_V[k + 1] - CP_V[k]) / (CP_T[k + 1] - CP_T[k]);
  let e = h - CP_H[k];
  let b = CP_V[k];
  return CP_T[k] + 2.0 * e / (b + sqrt(max(0.0, b * b + 2.0 * s * e)));
}
fn rhoL(T: f32) -> f32 {
  let t = T - T0;
  return (KELL[0] + t * (KELL[1] + t * (KELL[2] + t * (KELL[3] + t * (KELL[4] + t * KELL[5]))))) / (1.0 + KELL[6] * t);
}
fn kL(T: f32) -> f32 {
  let t = clamp(T - T0, 0.0, 150.0);
  return KL[0] + t * (KL[1] + t * KL[2]);
}
fn muL(T: f32) -> f32 {
  return VA * exp2(VB / (max(T, VC + 60.0) - VC) * 3.321928094887362);
}
fn sigmaW(T: f32) -> f32 {
  let tau = max(0.0, 1.0 - T / T_CRIT);
  return ST_B * pow(tau, ST_MU) * (1.0 + ST_b * tau);
}
fn cpV(T: f32) -> f32 { return CPV0 + CPV1 * (T - CPV_T); }
fn hV(T: f32) -> f32 {
  let a = T - CPV_T;
  let b = T100 - CPV_T;
  return HV100 + CPV0 * (T - T100) + 0.5 * CPV1 * (a * a - b * b);
}
fn hN2(T: f32) -> f32 { return CP_N2 * (T - T0); }
fn hO2(T: f32) -> f32 { return CP_O2 * (T - T0); }
fn gasTemperature(mN: f32, mO: f32, mV: f32, H: f32) -> f32 {
  let A = mN * CP_N2 + mO * CP_O2;
  let b100 = T100 - CPV_T;
  let a = 0.5 * mV * CPV1;
  let b = A + mV * CPV0;
  if (b <= 0.0) { return T0; }
  let c = A * (CPV_T - T0) + mV * (HV100 + CPV0 * (CPV_T - T100) - 0.5 * CPV1 * b100 * b100) - H;
  let disc = b * b - 4.0 * a * c;
  return CPV_T + (-2.0 * c) / (b + sqrt(max(disc, 0.0)));
}
fn gasHeatCapacity(mN: f32, mO: f32, mV: f32, mF: f32, T: f32) -> f32 {
  var c = mN * CP_N2 + mO * CP_O2 + mV * cpV(T);
  if (mF > 0.0) { c += mF * cpL(T); }
  return c;
}
fn gasEnthalpy(mN: f32, mO: f32, mV: f32, mF: f32, T: f32) -> f32 {
  return mN * hN2(T) + mO * hO2(T) + mV * hV(T) + mF * hL(T);
}
fn kN2(T: f32) -> f32 { return KN[0] * pow(max(T, 150.0) / KN[1], KN[2]); }
fn kO2(T: f32) -> f32 { return KO[0] * pow(max(T, 150.0) / KO[1], KO[2]); }
fn sutherland(s0: f32, s1: f32, s2: f32, T: f32) -> f32 {
  let t = max(T, 150.0);
  return s0 * pow(t / s1, 1.5) * ((s1 + s2) / (t + s2));
}
fn kMix(mN: f32, mO: f32, mV: f32, T: f32) -> f32 {
  let m = mN + mO + mV;
  if (m <= 0.0) { return kN2(T); }
  return (mN * kN2(T) + mO * kO2(T) + mV * KV) / m;
}
fn muMix(mN: f32, mO: f32, mV: f32, T: f32) -> f32 {
  let m = mN + mO + mV;
  let a = sutherland(MN[0], MN[1], MN[2], T);
  if (m <= 0.0) { return a; }
  return (mN * a + mO * sutherland(MO[0], MO[1], MO[2], T) + mV * MUV) / m;
}
fn diffVapour(T: f32, p: f32) -> f32 {
  return DV0 * pow(clamp(T, 150.0, 1150.0) / DVT0, DVE) * (P_ATM / p);
}
fn pSat(Tin: f32) -> f32 {
  let t = clamp(Tin, 273.15, T_CRIT);
  let th = t + N97[8] / (t - N97[9]);
  let a = th * th + N97[0] * th + N97[1];
  let b = N97[2] * th * th + N97[3] * th + N97[4];
  let c = N97[5] * th * th + N97[6] * th + N97[7];
  let x = (2.0 * c) / (-b + sqrt(b * b - 4.0 * a * c));
  return x * x * x * x * 1e6;
}
fn tSat(pin: f32) -> f32 {
  let pp = clamp(pin, 611.213, 22.064e6);
  let beta = sqrt(sqrt(pp / 1e6));
  let e = beta * beta + N97[2] * beta + N97[5];
  let ff = N97[0] * beta * beta + N97[3] * beta + N97[6];
  let g = N97[1] * beta * beta + N97[4] * beta + N97[7];
  let d = (2.0 * g) / (-ff - sqrt(ff * ff - 4.0 * e * g));
  let s = N97[9] + d;
  return (s - sqrt(s * s - 4.0 * (N97[8] + N97[9] * d))) / 2.0;
}
fn rhoVapourSat(Tin: f32) -> f32 {
  let t = clamp(Tin, 273.15, T_CRIT);
  let tau = 1.0 - t / T_CRIT;
  let s = pow(max(tau, 1e-12), 1.0 / 6.0);
  let s2 = s * s;
  let s4 = s2 * s2;
  let s8 = s4 * s4;
  let s18 = s8 * s8 * s2;
  let s37 = s18 * s18 * s;
  let s71 = s37 * s18 * s8 * s8;
  return RHO_CRIT * exp(RVC[0] * s2 + RVC[1] * s4 + RVC[2] * s8 + RVC[3] * s18 + RVC[4] * s37 + RVC[5] * s71);
}
fn solidRho(s: u32) -> f32 { return S_RHO[min(s, NSOL) - 1u]; }
fn solidCp(s: u32) -> f32 { return S_CP[min(s, NSOL) - 1u]; }
fn solidK(s: u32) -> f32 { return S_K[min(s, NSOL) - 1u]; }
fn solidTheta(s: u32) -> f32 { return S_THETA[min(s, NSOL) - 1u]; }
`,W0=`
/** Basis i0 und Gewichte des quadratischen B-Splines für s (in Zellen, Knoten bei ganzen Zahlen). */
fn bsplineBase(s: f32) -> i32 { return i32(floor(s - 0.5)); }
fn bsplineW(s: f32, i0: i32) -> vec3<f32> {
  let fx = s - f32(i0);
  let a = 1.5 - fx;
  let c = fx - 0.5;
  return vec3<f32>(0.5 * a * a, 0.75 - (fx - 1.0) * (fx - 1.0), 0.5 * c * c);
}
/** Ein einzelnes B-Spline-Gewicht für den Abstand d (in Zellen). */
fn bspline1(d: f32) -> f32 {
  let a = abs(d);
  if (a < 0.5) { return 0.75 - a * a; }
  if (a < 1.5) { let b = 1.5 - a; return 0.5 * b * b; }
  return 0.0;
}
fn sq(x: f32) -> f32 { return x * x; }
`,Vr=[D0,V0,N0,U0,G0,H0,B0,$0,W0].join(`
`);class K0{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=Q0(t.bind),this.source=J0(t,this.binds,this.wg)}}const z0={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function Q0(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":z0[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const X0=`
fn ci(c: u32) -> i32 { return i32(c % P.nx); }
fn cj(c: u32) -> i32 { return i32(c / P.nx); }
fn cellOf(i: i32, j: i32) -> u32 { return u32(i) + u32(j) * P.nx; }
fn inGrid(i: i32, j: i32) -> bool { return i >= 0 && j >= 0 && i < i32(P.nx) && j < i32(P.ny); }
fn cellAt(x: f32, y: f32) -> u32 {
  let i = u32(clamp(floor(x * P.invdx), 0.0, f32(P.nx - 1u)));
  let j = u32(clamp(floor(y * P.invdx), 0.0, f32(P.ny - 1u)));
  return i + j * P.nx;
}
fn cellAtN(x: f32, y: f32) -> u32 {
  let fi = floor(x * P.invdx);
  let fj = floor(y * P.invdx);
  if (fi < 0.0 || fj < 0.0 || fi >= f32(P.nx) || fj >= f32(P.ny)) { return NONE; }
  return u32(fi) + u32(fj) * P.nx;
}
fn s0(c: u32) -> u32 { return (c % P.nx + 1u) + (c / P.nx + 1u) * (P.nx + 2u); }
fn yOf(c: u32) -> f32 { return P.dx * (f32(c / P.nx) + 0.5); }
fn uF(i: i32, j: i32) -> u32 { return u32(i) + u32(j) * (P.nx + 1u); }
fn vF(i: i32, j: i32) -> u32 { return P.nu + u32(i) + u32(j) * P.nx; }
fn sideOpen(k: u32) -> bool {
  if (k == 0u) { return P.openL != 0u; }
  if (k == 1u) { return P.openR != 0u; }
  if (k == 2u) { return P.openB != 0u; }
  return P.openT != 0u;
}
`,Y0=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
/* Ein Zähler für die ganze Arbeitsgruppe (ein atomares Lesen statt eines je Faden; am Anfang von main aufrufen). */
fn cntWG(lid: u32, slot: u32) -> u32 {
  if (lid == 0u) { wcnt = atomicLoad(&cnt[slot]); }
  let v = workgroupUniformLoad(&wcnt);
  workgroupBarrier();
  return v;
}`},{needs:["cu","reg"],code:`fn pAt(c: u32) -> f32 {
  let r = cu[U_RID * P.n + c];
  if (r == NONE) { return P.pamb; }
  return reg[r * REG_STRIDE + R_P0] - reg[r * REG_STRIDE + R_RHOBAR] * P.gy * yOf(c);
}`},{needs:["cf"],code:`fn sdfAt(x: f32, y: f32) -> f32 {
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  let i1 = min(P.nx - 1u, i + 1u);
  let j1 = min(P.ny - 1u, j + 1u);
  let o = F_SDF * P.n;
  var d = (1.0 - ty) * ((1.0 - tx) * cf[o + i + j * P.nx] + tx * cf[o + i1 + j * P.nx]) + ty * ((1.0 - tx) * cf[o + i + j1 * P.nx] + tx * cf[o + i1 + j1 * P.nx]);
  if (P.openL == 0u) { d = min(d, x); }
  if (P.openR == 0u) { d = min(d, P.boxw - x); }
  if (P.openB == 0u) { d = min(d, y); }
  if (P.openT == 0u) { d = min(d, P.boxh - y); }
  return d;
}`},{needs:["ff"],code:`fn velL(x: f32, y: f32) -> vec2<f32> {
  let nx = P.nx;
  let nxu = nx + 1u;
  let o = FF_UL * P.nf;
  var fx = clamp(x * P.invdx, 0.0, f32(nx) - 1e-4);
  var fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  var i = u32(floor(fx));
  var j = u32(floor(fy));
  var tx = fx - f32(i);
  var ty = fy - f32(j);
  let u = (1.0 - ty) * ((1.0 - tx) * ff[o + i + j * nxu] + tx * ff[o + i + 1u + j * nxu]) + ty * ((1.0 - tx) * ff[o + i + (j + 1u) * nxu] + tx * ff[o + i + 1u + (j + 1u) * nxu]);
  fx = clamp(x * P.invdx - 0.5, 0.0, f32(nx) - 1.0001);
  fy = clamp(y * P.invdx, 0.0, f32(P.ny) - 1e-4);
  i = u32(floor(fx));
  j = u32(floor(fy));
  tx = fx - f32(i);
  ty = fy - f32(j);
  let ov = o + P.nu;
  let v = (1.0 - ty) * ((1.0 - tx) * ff[ov + i + j * nx] + tx * ff[ov + i + 1u + j * nx]) + ty * ((1.0 - tx) * ff[ov + i + (j + 1u) * nx] + tx * ff[ov + i + 1u + (j + 1u) * nx]);
  return vec2<f32>(u, v);
}`}];function J0(o,t,e){const s=[Vr,`const WG: u32 = ${e}u;`,X0],n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of Y0)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&${i.name}[i]);
  loop {
    let r = atomicCompareExchangeWeak(&${i.name}[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn getF_${i.name}(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&${i.name}[i])); }
fn setF_${i.name}(i: u32, v: f32) { atomicStore(&${i.name}[i], bitcast<u32>(v)); }
fn maxU_${i.name}(i: u32, v: f32) { atomicMax(&${i.name}[i], bitcast<u32>(max(v, 0.0))); }`))}),s.push(o.code),s.join(`
`)}class Nr{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new Nr(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new K0(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const f of a)e.push(`${s.name}:${f.lineNum}:${f.linePos} ${f.message}
    ${l[f.lineNum-1]??""}`);return}const c=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,f)=>l.mode==="t"?{binding:f,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:f,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:f,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:f,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=c;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const No=64,Uo="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",tn=`
fn cbrtf(x: f32) -> f32 { return select(-pow(-x, 1.0 / 3.0), pow(x, 1.0 / 3.0), x >= 0.0); }
fn radiusOf(V: f32, D: f32) -> f32 {
  let v1 = PI * D * D * D / 6.0;
  if (V <= v1) { return cbrtf(3.0 * V / (4.0 * PI)); }
  if (V <= PI * D * D * D / 4.0) { return D / 2.0; }
  return sqrt(V / (PI * D));
}
fn frontOf(V: f32, r: f32, D: f32) -> f32 {
  let v1 = PI * D * D * D / 6.0;
  let v2 = PI * D * D * D / 4.0;
  if (V <= v1) { return PI * r * r; }
  if (V >= v2) { return 2.0 * r * D; }
  let t = (V - v1) / (v2 - v1);
  return (1.0 - t) * PI * D * D / 4.0 + t * D * D;
}
struct Shape { r: f32, V: f32, pb: f32, pv: f32, Tb: f32 }
fn gapF(p: f32, mv: f32, na: f32, pb: f32) -> f32 {
  let T = tSat(p);
  return mv / rhoVapourSat(T) - na * R_GAS * T / (pb - p);
}
fn solveBubble(mN: f32, mO: f32, mV: f32, pl: f32, Tl: f32, D: f32, rGuess: f32) -> Shape {
  let na = mN / M_N2 + mO / M_O2;
  let nv = mV / M_H2O;
  var r = rGuess;
  if (!(r > 0.0)) { r = cbrtf(3.0 * max(1e-30, (nv + na) * R_GAS * Tl / pl) / (4.0 * PI)); }
  var pb = pl;
  var pv = 0.0;
  var Tb = Tl;
  var V = 0.0;
  for (var it = 0; it < 8; it++) {
    pb = pl + 2.0 * sigmaW(Tb) / r;
    if (na <= 0.0) {
      pv = pb; Tb = tSat(pv); V = mV / rhoVapourSat(Tb);
    } else if (nv <= 1e-9 * na) {
      pv = 0.0; Tb = Tl; V = na * R_GAS * Tb / pb;
    } else {
      var lo = 611.213;
      var hi = pb * (1.0 - 1e-6);
      var flo = gapF(lo, mV, na, pb);
      var fhi = gapF(hi, mV, na, pb);
      if (flo <= 0.0) { pv = lo; } else if (fhi >= 0.0) { pv = hi; } else {
        var side = 0;
        pv = 0.5 * (lo + hi);
        let scale = mV / rhoVapourSat(Tl) + 1e-30;
        for (var k = 0; k < 40; k++) {
          pv = (lo * fhi - hi * flo) / (fhi - flo);
          if (!(pv > lo && pv < hi)) { pv = 0.5 * (lo + hi); }
          let fv = gapF(pv, mV, na, pb);
          if (abs(fv) <= 1e-6 * scale) { break; }
          if (fv > 0.0) { lo = pv; flo = fv; if (side == 1) { fhi = fhi / 2.0; } side = 1; }
          else { hi = pv; fhi = fv; if (side == -1) { flo = flo / 2.0; } side = -1; }
        }
      }
      Tb = tSat(pv); V = mV / rhoVapourSat(Tb);
    }
    let rn = radiusOf(V, D);
    if (abs(rn - r) <= 1e-6 * r) { r = rn; break; }
    r = rn;
  }
  return Shape(r, V, pl + 2.0 * sigmaW(Tb) / r, pv, Tb);
}
fn bubEnthalpy(mN: f32, mO: f32, mV: f32, T: f32) -> f32 {
  var H = 0.0;
  if (mN > 0.0) { H += mN * hN2(T); }
  if (mO > 0.0) { H += mO * hO2(T); }
  if (mV > 0.0) { H += mV * hV(T); }
  return H;
}
fn activation(r: f32, p: f32) -> f32 {
  let Ts = tSat(p);
  return tSat(p + 2.0 * sigmaW(Ts) / r) - Ts;
}
/* Die Spur: bis 2r = 3Δx die 3 × 3 Gewichte des B-Splines, grösser die Zellen unter der Blase (4 × 4 Stichpunkte, bei einer Kugel mit der Sehne gewichtet). */
struct FP { i0: i32, i1: i32, j0: i32, j1: i32, small: u32, sphere: u32 }
fn fpOf(x: f32, y: f32, r: f32, V: f32) -> FP {
  let D = P.depth;
  if (2.0 * r <= 3.0 * P.dx) {
    let i0 = i32(floor(x * P.invdx - 1.0));
    let j0 = i32(floor(y * P.invdx - 1.0));
    return FP(max(i0, 0), min(i0 + 2, i32(P.nx) - 1), max(j0, 0), min(j0 + 2, i32(P.ny) - 1), 1u, 0u);
  }
  return FP(max(0, i32(floor((x - r) * P.invdx))), min(i32(P.nx) - 1, i32(floor((x + r) * P.invdx))),
    max(0, i32(floor((y - r) * P.invdx))), min(i32(P.ny) - 1, i32(floor((y + r) * P.invdx))), 0u, select(0u, 1u, V <= PI * D * D * D / 6.0));
}
fn fpW(fp: FP, x: f32, y: f32, r: f32, i: i32, j: i32) -> f32 {
  if (fp.small != 0u) { return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j)); }
  var w = 0.0;
  for (var b = 0; b < 4; b++) {
    let py = (f32(j) + (f32(b) + 0.5) / 4.0) * P.dx - y;
    for (var a = 0; a < 4; a++) {
      let px = (f32(i) + (f32(a) + 0.5) / 4.0) * P.dx - x;
      let q = r * r - px * px - py * py;
      if (q > 0.0) { w += select(1.0, sqrt(q), fp.sphere != 0u); }
    }
  }
  return w;
}
fn sitePos(S: Site, r: f32) -> vec2<f32> {
  let i = f32(S.cell % P.nx);
  let j = f32(S.cell / P.nx);
  let dx = P.dx;
  if (S.dir == 0u) { return vec2<f32>(i * dx - r, (j + S.s) * dx); }
  if (S.dir == 1u) { return vec2<f32>((i + 1.0) * dx + r, (j + S.s) * dx); }
  if (S.dir == 2u) { return vec2<f32>((i + S.s) * dx, j * dx - r); }
  return vec2<f32>((i + S.s) * dx, (j + 1.0) * dx + r);
}
`,ea=`
fn kindOf(c: u32) -> u32 { return cu[U_KIND * P.n + c]; }
/* Absoluter Druck der Flüssigkeit an (x, y): bilinear über die nicht festen Zellmitten, nie unter dem halben Umgebungsdruck (wie BubbleModel.pressure). */
fn pressureAt(x: f32, y: f32) -> f32 {
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  var s = 0.0;
  var w = 0.0;
  for (var b = 0u; b < 2u; b++) {
    for (var a = 0u; a < 2u; a++) {
      let c = i + a + (j + b) * P.nx;
      if (cu[U_SOLID * P.n + c] != 0u) { continue; }
      let ww = select(tx, 1.0 - tx, a == 0u) * select(ty, 1.0 - ty, b == 0u);
      s += ww * cf[F_PL * P.n + c];
      w += ww;
    }
  }
  return max(0.5 * P.pref, P.pref + select(0.0, s / w, w > 0.0));
}
/* Summe der Gewichte über flüssige Zellen der Spur und Σ w T_l. */
fn liqFoot(fp: FP, x: f32, y: f32, r: f32) -> vec2<f32> {
  var ws = 0.0;
  var wt = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w <= 0.0) { continue; }
      ws += w;
      wt += w * cf[F_PTL * P.n + c];
    }
  }
  return vec2<f32>(ws, wt);
}
fn liqAvail(fp: FP, x: f32, y: f32, r: f32, ws: f32) -> f32 {
  var a = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w > 0.0) { a += w / ws * getF_at(A_BUDGET * P.n + c); }
    }
  }
  return a;
}
/* Masse dm aus der Flüssigkeit der Spur (nach w), latente Wärme dort; das Budget mit. */
fn liqTake(fp: FP, x: f32, y: f32, r: f32, ws: f32, dm: f32, hvb: f32, Tl: f32, dt: f32) {
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w0 = fpW(fp, x, y, r, i, j);
      if (w0 <= 0.0) { continue; }
      let w = w0 / ws;
      let acc = cf[F_ACC * P.n + c];
      let hbar = select(hL(Tl), cf[F_ACCH * P.n + c] / acc, acc > 0.0);
      addF_at(A_FM * P.n + c, -dm * w);
      addF_at(A_HSRC * P.n + c, -dm * w * (hvb - hbar) / dt);
      addF_at(A_BUDGET * P.n + c, -dm * w * (hvb - hbar));
    }
  }
}
/* Wärme q (W) an die Flüssigkeit der Spur (nach w). */
fn liqHeat(fp: FP, x: f32, y: f32, r: f32, ws: f32, q: f32) {
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w > 0.0) { addF_at(A_HSRC * P.n + c, q * w / ws); }
    }
  }
}
`,Z0=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,tu=`
fn spreadForce(x: f32, y: f32, fx: f32, fy: f32) {
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  var i0 = i32(floor(x * P.invdx - 0.5));
  var j0 = i32(floor(y * P.invdx - 1.0));
  for (var b = 0; b < 3; b++) {
    for (var a = 0; a < 3; a++) {
      let i = i0 + a;
      let j = j0 + b;
      if (i < 0 || i > nx || j < 0 || j >= ny) { continue; }
      let w = bspline1(x * P.invdx - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
      addF_af(uF(i, j), fx * w);
    }
  }
  i0 = i32(floor(x * P.invdx - 1.0));
  j0 = i32(floor(y * P.invdx - 0.5));
  for (var b = 0; b < 3; b++) {
    for (var a = 0; a < 3; a++) {
      let i = i0 + a;
      let j = j0 + b;
      if (i < 0 || i >= nx || j < 0 || j > ny) { continue; }
      let w = bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - f32(j));
      addF_af(vF(i, j), fy * w);
    }
  }
}
`,eu=[{name:"bubNucleate",wg:No,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${tn}
${Uo} {
  let s = gid.x;
  if (s >= P.nsites) { return; }
  if (atomicLoad(&sbub[s]) != 0u) { return; }
  let S = sites[s];
  let n = P.n;
  let fc = S.fluid;
  if (cu[U_KIND * n + fc] != LIQUID) { return; }
  let acc = cf[F_ACC * n + fc];
  if (!(acc > 0.0)) { return; }
  let sc = S.cell;
  let mat = cu[U_SOLID * n + sc];
  let ks = solidK(mat);
  let Tl = cf[F_PTL * n + fc];
  let kl = kL(Tl);
  let Tf = (ks * cf[F_T * n + sc] + kl * Tl) / (ks + kl);
  let pl = max(0.5 * P.pref, P.pref + cf[F_PL * n + fc]);
  var Ts = cf[F_TSAT * n + fc];
  if (!(Ts > 0.0)) { Ts = tSat(pl); }
  if (Tf - Ts < 0.0) { return; }
  let rc = S.r;
  if (Tf - Ts < activation(rc, pl)) { return; }
  let pb = pl + 2.0 * sigmaW(Tf) / rc;
  let Tb = tSat(pb);
  let V = 4.0 / 3.0 * PI * rc * rc * rc;
  let mv = rhoVapourSat(Tb) * V;
  if (mv * 4.0 > acc) { return; }
  let b = atomicAdd(&cnt[C_BCOUNT], 1u);
  if (b >= P.bcap) { atomicSub(&cnt[C_BCOUNT], 1u); atomicAdd(&cnt[C_BFULL], 1u); return; }
  let id = atomicAdd(&cnt[C_NEXTID_B], 1u);
  let pos = sitePos(S, rc);
  let D = P.depth;
  var B: Bubble;
  B.x = pos.x; B.y = pos.y; B.z = min(D - rc, max(rc, S.z * D));
  B.vx = 0.0; B.vy = 0.0; B.mN = 0.0; B.mO = 0.0; B.mV = mv; B.H = mv * hV(Tb); B.age = 0.0; B.site = i32(s);
  B.r = rc; B.V = V; B.pb = pb; B.pv = pb; B.Tb = Tb; B.dmdt = 0.0; B.ux0 = 0.0; B.uy0 = 0.0; B.id = id; B.alive = 1u;
  for (var k = 0; k < 8; k++) { B.force[k] = 0.0; }
  bubs[b] = B;
  atomicStore(&sbub[s], id);
  let hbar = cf[F_ACCH * n + fc] / acc;
  addF_at(A_FM * n + fc, -mv);
  addF_at(A_HSRC * n + sc, -mv * (hV(Tb) - hbar) / glob[G_DT]);
  atomicAdd(&cnt[C_NUCLEATED], 1u);
  if (atomicLoad(&cnt[C_FIRST_SH]) == 0u) {
    let r = atomicCompareExchangeWeak(&cnt[C_FIRST_SH], 0u, bitcast<u32>(Tf - Ts + 1000.0));
    if (r.exchanged) { atomicStore(&cnt[C_FIRST_MAT], mat); }
  }
}`},{name:"bubAdvance",wg:No,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${tn}
${ea}
${Z0}
${tu}
${Uo} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let bix = gid.x;
  if (bix >= count) { return; }
  var B = bubs[bix];
  if (B.alive == 0u) { return; }
  let dt = glob[G_DT];
  let D = P.depth;
  let dx = P.dx;
  let n = P.n;
  var site = B.site;
  var t = 0.0;
  var grew = 0.0;
  for (var iter = 0; iter < 64; iter++) {
    if (t >= dt * (1.0 - 1e-6)) { break; }
    let Vprev = B.V;
    let r = B.r;
    let vmag = sqrt(B.vx * B.vx + B.vy * B.vy);
    var h = min(dt - t, min(max(1e-7, AGE_STEP * B.age), 0.25 * dx / (vmag + 1e-9)));
    if (h < 1e-7) { h = min(dt - t, 1e-7); }
    var Tl = 0.0;
    var srcCell = NONE;
    var fp = FP(0, -1, 0, -1, 1u, 0u);
    var ws = 0.0;
    if (site >= 0) {
      let S = sites[u32(site)];
      let ks = solidK(cu[U_SOLID * n + S.cell]);
      let Tw = cf[F_PTL * n + S.fluid];
      let klw = kL(Tw);
      Tl = (ks * cf[F_T * n + S.cell] + klw * Tw) / (ks + klw);
      srcCell = S.cell;
    } else {
      fp = fpOf(B.x, B.y, B.r, B.V);
      let lf = liqFoot(fp, B.x, B.y, B.r);
      ws = lf.x;
      if (!(ws > 0.0)) { break; }
      Tl = lf.y / ws;
    }
    let Tb = B.Tb;
    let kl = kL(Tl);
    let rhol = rhoL(Tl);
    let cpl = cpL(Tl);
    let mul = muL(Tl);
    let alpha = kl / (rhol * cpl);
    let d = 2.0 * r;
    let age = B.age;
    let pzk = kl * sqrt(3.0 / (PI * alpha));
    var slip = 0.0;
    if (site < 0) { slip = length(vec2<f32>(B.vx - B.ux0, B.vy - B.uy0)); }
    let Re = rhol * slip * d / mul;
    let Pr = mul * cpl / kl;
    let hRM = (kl / d) * (2.0 + 0.6 * sqrt(Re) * pow(Pr, 1.0 / 3.0));
    let Lh = hV(Tb) - hL(Tl);
    var hInt = max(pzk * 2.0 * (sqrt(age + h) - sqrt(age)), hRM * h);
    if (site >= 0 && Tl > Tb) {
      let rdep = 0.5 * fritzD(B, Tl);
      let rv0 = select(rhoVapourSat(Tb), B.mV / B.V, B.mV > 0.0);
      let drPlan = hInt * (Tl - Tb) / (rv0 * Lh);
      if (r < rdep && r + drPlan > rdep && drPlan > 0.0) {
        let want = hInt * (rdep - r) / drPlan;
        if (hRM * h >= pzk * 2.0 * (sqrt(age + h) - sqrt(age))) { h = want / hRM; }
        else { let sq = sqrt(age) + want / (2.0 * pzk); h = sq * sq - age; }
        h = max(1e-9, min(dt - t, h * (1.0 + 1e-6)));
        hInt = max(pzk * 2.0 * (sqrt(age + h) - sqrt(age)), hRM * h);
      }
    }
    let V = B.V;
    let rhov = select(rhoVapourSat(Tb), B.mV / V, B.mV > 0.0);
    let dr = hInt * (Tl - Tb) / (rhov * Lh);
    let r1 = max(0.0, r + dr);
    var dV = 0.0;
    if (V <= PI * D * D * D / 6.0) { dV = 4.0 / 3.0 * PI * (r1 * r1 * r1 - r * r * r); }
    else if (V >= PI * D * D * D / 4.0) { dV = PI * D * (r1 * r1 - r * r); }
    else { dV = PI * D * D * hInt * (Tl - Tb) / (rhov * Lh); }
    var Q = rhov * dV * Lh;
    /* Keine Zelle durch diesen Austausch über T_sat hinaus (oder darunter). */
    if (site >= 0) {
      let s = cu[U_SOLID * n + srcCell];
      let cap = solidRho(s) * solidCp(s) * P.vcell * max(0.0, cf[F_T * n + srcCell] - Tb);
      let used = -getF_at(A_BUDGET * n + srcCell);
      if (Q > 0.0) { Q = min(Q, max(0.0, cap - used)); }
    } else {
      let avail = liqAvail(fp, B.x, B.y, B.r, ws);
      if (Q > 0.0) { Q = min(Q, max(0.0, avail)); } else { Q = max(Q, min(0.0, avail)); }
    }
    var dm = Q / Lh;
    if (dm < 0.0) { dm = max(dm, -B.mV); }
    if (dm != 0.0) {
      let hvb = hV(Tb);
      if (site >= 0) {
        let fc = sites[u32(site)].fluid;
        let acc = cf[F_ACC * n + fc];
        let fm = getF_at(A_FM * n + fc);
        if (dm > 0.0 && acc + fm - dm < 0.0) { dm = max(0.0, acc + fm); }
        let hbar = select(hL(Tl), cf[F_ACCH * n + fc] / acc, acc > 0.0);
        addF_at(A_FM * n + fc, -dm);
        addF_at(A_HSRC * n + srcCell, -dm * (hvb - hbar) / dt);
        addF_at(A_BUDGET * n + srcCell, -dm * (hvb - hbar));
      } else {
        liqTake(fp, B.x, B.y, B.r, ws, dm, hvb, Tl, dt);
      }
      B.mV += dm;
      B.H += dm * hvb;
      grew += dm;
    }
    /* Neuer Zustand; die Enthalpie folgt T_b, die Differenz tauscht die Blase mit ihrer Umgebung. */
    let sh = solveBubble(B.mN, B.mO, B.mV, pressureAt(B.x, B.y), Tl, D, B.r);
    B.r = sh.r; B.V = sh.V; B.pb = sh.pb; B.pv = sh.pv; B.Tb = sh.Tb;
    let Hn = bubEnthalpy(B.mN, B.mO, B.mV, B.Tb);
    let dH = Hn - B.H;
    if (dH != 0.0) {
      B.H = Hn;
      if (site >= 0) { addF_at(A_HSRC * n + sites[u32(site)].cell, -dH / dt); }
      else { liqHeat(fp, B.x, B.y, r, ws, -dH / dt); }
    }
    if (B.r < 1e-6 || (B.mV <= 1e-18 && B.mN + B.mO <= 0.0)) { B.age += h; break; }
    if (site >= 0) {
      let S = sites[u32(site)];
      let pos = sitePos(S, B.r);
      B.x = pos.x;
      B.y = pos.y;
      if (P.gy > 0.0) {
        let Dd = fritzD(B, Tl);
        let deq = 2.0 * cbrtf(3.0 * B.V / (4.0 * PI));
        if (deq >= Dd * (1.0 - 1e-4)) {
          atomicStore(&sbub[u32(site)], 0u);
          site = -1;
          B.site = -1;
          atomicAdd(&cnt[C_DEPARTED], 1u);
          let vel = velL(B.x, B.y);
          B.ux0 = vel.x; B.uy0 = vel.y; B.vx = vel.x; B.vy = vel.y;
        }
      }
    } else {
      /* Bewegung (wie BubbleMotion.move): u und Du/Dt auf einem Ring ausserhalb der eigenen Spur. */
      let x = B.x;
      let y = B.y;
      let rr = B.r;
      let Vb = B.V;
      let Vdot = (Vb - Vprev) / h;
      let Rg = max(rr + dx, 2.0 * dx);
      var ux = 0.0;
      var uy = 0.0;
      for (var q = 0; q < 8; q++) {
        let a = f32(q) * PI / 4.0;
        let v = velL(x + Rg * cos(a), y + Rg * sin(a));
        ux += v.x / 8.0;
        uy += v.y / 8.0;
      }
      let cc = cellAt(x, y);
      let Tm = select(B.Tb, cf[F_PTL * n + cc], cf[F_PCL * n + cc] > 0.0);
      let rl = glob[G_RHOREF];
      let ml = muL(Tm);
      let rv = (B.mN + B.mO + B.mV) / max(1e-30, Vb);
      let dux = (ux - B.ux0) / max(h, 1e-6);
      let duy = (uy - B.uy0) / max(h, 1e-6);
      B.ux0 = ux;
      B.uy0 = uy;
      if (rr < 20e-6) {
        B.vx = ux;
        B.vy = uy;
        B.x = clamp(x + h * ux, 1e-6, P.boxw - 1e-6);
        B.y = clamp(y + h * uy, 1e-6, P.boxh - 1e-6);
      } else {
        let rx = B.vx - ux;
        let ry = B.vy - uy;
        let sl = sqrt(rx * rx + ry * ry);
        let dd = 2.0 * rr;
        let Reb = max(1e-6, rl * sl * dd / ml);
        let Eo = max(0.0, P.gy) * (rl - rv) * dd * dd / sigmaW(Tm);
        let CD = max(24.0 / Reb * (1.0 + 0.15 * pow(Reb, 0.687)), 8.0 / 3.0 * (Eo / (Eo + 4.0)));
        let K = 0.5 * CD * rl * frontOf(Vb, rr, D) * sl;
        let mEff = (rv + C_A * rl) * Vb;
        let Fpx = rl * Vb * dux;
        let Fpy = rl * Vb * (duy + P.gy);
        let Fwy = -rv * Vb * P.gy;
        let Fax = C_A * rl * Vb * dux;
        let Fay = C_A * rl * Vb * duy;
        let Kv = select(0.0, C_A * rl * Vdot, Vdot > 0.0);
        let shrink = select(0.0, min(-Vdot, 0.2 * Vb / h), Vdot < 0.0);
        let Fvx = C_A * rl * shrink * rx;
        let Fvy = C_A * rl * shrink * ry;
        let den = mEff + h * (K + Kv);
        var vx = (mEff * B.vx + h * (Fpx + Fax + Fvx) + h * (K + Kv) * ux) / den;
        var vy = (mEff * B.vy + h * (Fpy + Fwy + Fay + Fvy) + h * (K + Kv) * uy) / den;
        if (!(abs(vx) < 1e6)) { vx = ux; }
        if (!(abs(vy) < 1e6)) { vy = uy; }
        B.vx = vx;
        B.vy = vy;
        let Fdx = -K * (vx - ux);
        let Fdy = -K * (vy - uy);
        B.force[0] = Fpx; B.force[1] = Fpy; B.force[2] = 0.0; B.force[3] = Fwy;
        B.force[4] = Fdx; B.force[5] = Fdy;
        B.force[6] = Fax + Fvx - Kv * (vx - ux); B.force[7] = Fay + Fvy - Kv * (vy - uy);
        spreadForce(x, y, -(Fdx + B.force[6]) * (h / dt), -(Fdy + B.force[7]) * (h / dt));
        var nxp = x + h * vx;
        var nyp = y + h * vy;
        let dist = sdfAt(nxp, nyp);
        if (dist < rr) {
          let e = 0.25 * dx;
          var gx = sdfAt(nxp + e, nyp) - sdfAt(nxp - e, nyp);
          var gy = sdfAt(nxp, nyp + e) - sdfAt(nxp, nyp - e);
          let len = sqrt(gx * gx + gy * gy);
          if (len > 1e-12) {
            gx /= len;
            gy /= len;
            nxp += (rr - dist) * gx;
            nyp += (rr - dist) * gy;
            let vn = B.vx * gx + B.vy * gy;
            if (vn < 0.0) { B.vx -= vn * gx; B.vy -= vn * gy; }
          }
        }
        B.x = clamp(nxp, 1e-6, P.boxw - 1e-6);
        B.y = clamp(nyp, 1e-6, P.boxh - 1e-6);
      }
      B.z = select(min(D - rr, max(rr, B.z)), D / 2.0, 2.0 * rr >= D);
    }
    B.age += h;
    t += h;
    if (B.mV <= 0.0 && B.mN + B.mO <= 0.0) { break; }
  }
  B.dmdt = grew / dt;
  bubs[bix] = B;
}`}],ps=64,Re="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",su=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,nu=[{name:"bubTarget",wg:ps,bind:"P:u cnt:a bubs:r btarget:w",code:`${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  btarget[b] = NONE;
  let B = bubs[b];
  if (B.alive == 0u || !(B.V > 0.0)) { return; }
  let D = P.depth;
  for (var q = 0u; q < b; q++) {
    let Q = bubs[q];
    if (Q.alive == 0u || !(Q.V > 0.0)) { continue; }
    let ddx = Q.x - B.x;
    let ddy = Q.y - B.y;
    let flat = 2.0 * B.r >= D || 2.0 * Q.r >= D;
    let ddz = select(Q.z - B.z, 0.0, flat);
    let rr = B.r + Q.r;
    if (ddx * ddx + ddy * ddy + ddz * ddz < rr * rr) { btarget[b] = q; return; }
  }
}`},{name:"bubMerge",wg:ps,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let q = gid.x;
  if (q >= count) { return; }
  var root = btarget[q];
  if (root == NONE) { return; }
  for (var k = 0; k < 64; k++) { let t = btarget[root]; if (t == NONE) { break; } root = t; }
  var Q = bubs[q];
  let o = root * BACC_STRIDE;
  let V = Q.V;
  addF_bacc(o + BA_V, V);
  addF_bacc(o + BA_XV, Q.x * V);
  addF_bacc(o + BA_YV, Q.y * V);
  addF_bacc(o + BA_ZV, Q.z * V);
  addF_bacc(o + BA_VXV, Q.vx * V);
  addF_bacc(o + BA_VYV, Q.vy * V);
  addF_bacc(o + BA_MN, Q.mN);
  addF_bacc(o + BA_MO, Q.mO);
  addF_bacc(o + BA_MV, Q.mV);
  addF_bacc(o + BA_H, Q.H);
  atomicMax(&bacc[o + BA_AGE], bitcast<u32>(max(Q.age, 0.0)));
  atomicAdd(&bacc[o + BA_FLAGS], 1u);
  if (Q.site >= 0) { atomicStore(&sbub[u32(Q.site)], 0u); } else { atomicOr(&bacc[o + BA_FLAGS], 0x80000000u); }
  if (Q.id == atomicLoad(&cnt[C_WATCH])) {
    atomicStore(&cnt[C_WATCH], bubs[root].id);
    atomicStore(&cnt[C_WATCH_FATE], 3u);
  }
  atomicAdd(&cnt[C_MERGED], 1u);
  Q.alive = 0u;
  Q.V = 0.0;
  Q.site = -1;
  bubs[q] = Q;
}`},{name:"bubMergeFinal",wg:ps,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${tn}
${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count || btarget[b] != NONE) { return; }
  let o = b * BACC_STRIDE;
  let flags = atomicLoad(&bacc[o + BA_FLAGS]);
  if ((flags & 0x7fffffffu) == 0u) { return; }
  var B = bubs[b];
  let Vq = getF_bacc(o + BA_V);
  let V = B.V + Vq;
  if (V > 0.0) {
    B.x = (B.x * B.V + getF_bacc(o + BA_XV)) / V;
    B.y = (B.y * B.V + getF_bacc(o + BA_YV)) / V;
    B.z = (B.z * B.V + getF_bacc(o + BA_ZV)) / V;
    B.vx = (B.vx * B.V + getF_bacc(o + BA_VXV)) / V;
    B.vy = (B.vy * B.V + getF_bacc(o + BA_VYV)) / V;
  }
  B.mN += getF_bacc(o + BA_MN);
  B.mO += getF_bacc(o + BA_MO);
  B.mV += getF_bacc(o + BA_MV);
  B.H += getF_bacc(o + BA_H);
  B.age = max(B.age, bitcast<f32>(atomicLoad(&bacc[o + BA_AGE])));
  if (B.site >= 0 && (flags & 0x80000000u) != 0u) { atomicStore(&sbub[u32(B.site)], 0u); B.site = -1; }
  /* Wie BubbleModel.merge: nur der Radius folgt dem Volumen der Summe; V bleibt, bis das nächste Lösen es aus den
     Massen ableitet. Mit der Summe als V sprang α_b, wenn ein Haufen Blasen in kaltem Wasser zu einer wurde (die
     Volumenquelle der Flüssigkeit wuchs mit 1/Δt, Δt fiel gegen null). */
  B.r = cbrtf(3.0 * V / (4.0 * PI));
  bubs[b] = B;
  for (var k = 0u; k < BACC_STRIDE; k++) { atomicStore(&bacc[o + k], 0u); }
}`},{name:"bubFinish",wg:ps,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${tn}
${ea}
${su}
${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  var B = bubs[b];
  if (B.alive == 0u) { return; }
  let n = P.n;
  let dt = glob[G_DT];
  let total = B.mN + B.mO + B.mV;
  var drop = false;
  var burst = false;
  if (!(B.V > 0.0) || !(total > 0.0)) { drop = true; }
  else if (B.r < 1e-6 || (B.mV <= 1e-18 && B.mN + B.mO <= 0.0)) { drop = true; }
  else if (B.site < 0) {
    let top = cellAtN(B.x, B.y + B.r);
    let mid = cellAtN(B.x, B.y);
    if (top == NONE || kindOf(top) == GAS || mid == NONE || kindOf(mid) == GAS) { drop = true; burst = true; }
  }
  if (!drop) { return; }
  let mv = B.mV;
  let mAir = B.mN + B.mO;
  let cold = bulkCold();
  if (burst || mAir > 0.0) {
    /* Die Gaszellen über der Blase: so viele, wie ihr Volumen braucht. */
    var c = cellAt(B.x, min(P.boxh - 1e-6, B.y + B.r));
    for (var k = 0u; k < P.ny; k++) { if (kindOf(c) == GAS) { break; } if (c + P.nx < n) { c += P.nx; } else { c = NONE; break; } }
    if (c != NONE && kindOf(c) != GAS) { c = NONE; }
    if (c == NONE) {
      let i = u32(clamp(floor(B.x * P.invdx), 0.0, f32(P.nx - 1u)));
      for (var j = i32(P.ny) - 1; j >= 0; j--) { let q = i + u32(j) * P.nx; if (kindOf(q) == GAS) { c = q; break; } }
    }
    if (c == NONE) { return; }
    let ci0 = ci(c);
    let cj0 = cj(c);
    var tot = 0.0;
    var count = 0u;
    var rings = 0;
    for (var ring = 0; ring <= 6; ring++) {
      if (count > 0u && tot >= 2.0 * B.V) { break; }
      rings = ring;
      for (var dj = 0; dj <= ring; dj++) {
        for (var di = -ring; di <= ring; di++) {
          if (max(abs(di), dj) != ring) { continue; }
          let i = ci0 + di;
          let j = cj0 + dj;
          if (!inGrid(i, j)) { continue; }
          let q = cellOf(i, j);
          if (kindOf(q) != GAS) { continue; }
          tot += max(1e-3 * P.vcell, cf[F_VGAS * n + q]);
          count += 1u;
        }
      }
    }
    for (var ring = 0; ring <= rings; ring++) {
      for (var dj = 0; dj <= ring; dj++) {
        for (var di = -ring; di <= ring; di++) {
          if (max(abs(di), dj) != ring) { continue; }
          let i = ci0 + di;
          let j = cj0 + dj;
          if (!inGrid(i, j)) { continue; }
          let q = cellOf(i, j);
          if (kindOf(q) != GAS) { continue; }
          let w = max(1e-3 * P.vcell, cf[F_VGAS * n + q]) / tot;
          addF_at(A_DN * n + q, w * B.mN);
          addF_at(A_DO * n + q, w * B.mO);
          addF_at(A_DV * n + q, w * B.mV);
          addF_at(A_DH * n + q, w * B.H);
        }
      }
    }
    addF_cnt(C_BURSTVAP, mv);
    if (burst) {
      atomicAdd(&cnt[C_BURST], 1u);
      if (cold) { atomicAdd(&cnt[C_BURST_COLD], 1u); } else { atomicAdd(&cnt[C_BURST_WARM], 1u); }
    }
  } else if (mv > 0.0) {
    /* Der Rest Dampf kondensiert in die Flüssigkeit der Spur (latente Wärme dort). */
    let fp = fpOf(B.x, B.y, B.r, B.V);
    let ws = liqFoot(fp, B.x, B.y, B.r).x;
    if (ws > 0.0) {
      for (var j = fp.j0; j <= fp.j1; j++) {
        for (var i = fp.i0; i <= fp.i1; i++) {
          let c = cellOf(i, j);
          if (kindOf(c) != LIQUID) { continue; }
          let w0 = fpW(fp, B.x, B.y, B.r, i, j);
          if (w0 <= 0.0) { continue; }
          let w = w0 / ws;
          let acc = cf[F_ACC * n + c];
          let hbar = select(hL(B.Tb), cf[F_ACCH * n + c] / acc, acc > 0.0);
          addF_at(A_FM * n + c, mv * w);
          addF_at(A_HSRC * n + c, w * (B.H - mv * hbar) / dt);
        }
      }
    } else {
      let c = cellAtN(B.x, B.y);
      if (c != NONE) { addF_at(A_DV * n + c, mv); addF_at(A_DH * n + c, B.H); }
    }
    atomicAdd(&cnt[C_COLLAPSED], 1u);
    if (cold) { atomicAdd(&cnt[C_COLL_COLD], 1u); } else { atomicAdd(&cnt[C_COLL_WARM], 1u); }
  }
  if (B.site >= 0) { atomicStore(&sbub[u32(B.site)], 0u); }
  if (B.id == atomicLoad(&cnt[C_WATCH])) {
    atomicStore(&cnt[C_WATCH], NONE);
    atomicStore(&cnt[C_WATCH_FATE], select(2u, 1u, burst));
  }
  B.alive = 0u;
  bubs[b] = B;
}`},{name:"bubCompact",wg:256,bind:"P:u cnt:a bubs:r bubs2:w",code:`var<workgroup> sh: array<u32, 256>;
${Re} {
  let lid = lid3.x;
  let count = min(atomicLoad(&cnt[C_BCOUNT]), P.bcap);
  let per = (P.bcap + 255u) / 256u;
  let base = lid * per;
  var mine = 0u;
  for (var k = 0u; k < per; k++) { let b = base + k; if (b < count && bubs[b].alive != 0u) { mine += 1u; } }
  sh[lid] = mine;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off <<= 1u) {
    var t = 0u;
    if (lid >= off) { t = sh[lid - off]; }
    workgroupBarrier();
    sh[lid] += t;
    workgroupBarrier();
  }
  var at = sh[lid] - mine;
  for (var k = 0u; k < per; k++) { let b = base + k; if (b < count && bubs[b].alive != 0u) { bubs2[at] = bubs[b]; at += 1u; } }
  workgroupBarrier();
  if (lid == 255u) { atomicStore(&cnt[C_BCOUNT], sh[255]); }
}`},{name:"bubCopyBack",wg:ps,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:ps,bind:"P:u cnt:a bubs:r at:a",code:`${tn}
${Re} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  let B = bubs[b];
  if (B.alive == 0u) { return; }
  let fp = fpOf(B.x, B.y, B.r, B.V);
  var ws = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) { for (var i = fp.i0; i <= fp.i1; i++) { ws += fpW(fp, B.x, B.y, B.r, i, j); } }
  if (!(ws > 0.0)) { addF_at(A_ALPHA * P.n + cellAt(B.x, B.y), B.V / P.vcell); return; }
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let w = fpW(fp, B.x, B.y, B.r, i, j);
      if (w > 0.0) { addF_at(A_ALPHA * P.n + cellOf(i, j), w / ws * B.V / P.vcell); }
    }
  }
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Re} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let a = min(at[A_ALPHA * n + c], max(0.0, 1.0 - cf[F_PHIS * n + c]));
  at[A_ALPHA * n + c] = 0.0;
  let dt = glob[G_DT];
  let cap = ALPHA_RATE * dt;
  let old = cf[F_ALPHA * n + c];
  let d = a - old;
  let s = clamp(d, -cap, cap);
  if (s != 0.0) { at[A_VOLSRC * n + c] += s * P.vcell / dt; }
  let now = select(old + s, a, abs(d) <= cap);
  cf[F_ALPHA * n + c] = now;
  cf[F_ALPHAOLD * n + c] = now;
}`}],Te=128,me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ai=`
fn massOf(c: u32) -> f32 {
  let n = P.n;
  return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c];
}
fn deriveCell(c: u32) {
  let n = P.n;
  let vg = max(1e-3, 1.0 - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  cf[F_VGAS * n + c] = vg;
  let mN = cf[F_MN * n + c];
  let mO = cf[F_MO * n + c];
  let mV = cf[F_MV * n + c];
  let mF = cf[F_MF * n + c];
  let m = mN + mO + mV;
  cf[F_NMOL * n + c] = mN / M_N2 + mO / M_O2 + mV / M_H2O;
  if (m + mF <= 1e-30) { cf[F_RHO * n + c] = 0.0; cf[F_CAP * n + c] = 0.0; cf[F_MU * n + c] = 1.8e-5; return; }
  let H = cf[F_HG * n + c];
  var T = 0.0;
  if (mF <= 0.0) {
    T = gasTemperature(mN, mO, mV, H);
  } else {
    T = cf[F_T * n + c];
    if (!(T > 100.0)) { T = P.tamb; }
    for (var it = 0; it < 4; it++) {
      let dT = (H - gasEnthalpy(mN, mO, mV, mF, T)) / gasHeatCapacity(mN, mO, mV, mF, T);
      T += dT;
      if (abs(dT) < 1e-6) { break; }
    }
  }
  if (!(T > 150.0 && T < 3000.0)) { T = clamp(select(P.tamb, T, T == T), 150.0, 3000.0); }
  cf[F_T * n + c] = T;
  cf[F_CAP * n + c] = gasHeatCapacity(mN, mO, mV, mF, T);
  cf[F_RHO * n + c] = m / vg;
  cf[F_MU * n + c] = muMix(mN, mO, mV, T);
}
fn deriveSolid(c: u32) {
  let n = P.n;
  let s = cu[U_SOLID * n + c];
  let cs = solidRho(s) * solidCp(s) * P.vcell;
  let film = cf[F_FILM * n + c];
  let E = cf[F_ES * n + c];
  if (film <= 0.0) { cf[F_T * n + c] = T0 + E / cs; return; }
  var T = cf[F_T * n + c];
  if (!(T > 100.0)) { T = T0 + E / cs; }
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  cf[F_T * n + c] = T;
}
`,Go=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,Hi=`
var<workgroup> rr: array<f32, ${16*Te}>;
fn regSum(lid: u32, r: u32, v: vec4<f32>, fields: vec4<u32>) {
  for (var k = 0u; k < 16u; k++) { rr[k * WG + lid] = 0.0; }
  if (r < 4u) { for (var k = 0u; k < 4u; k++) { rr[(r * 4u + k) * WG + lid] = v[k]; } }
  else if (r != NONE) { for (var k = 0u; k < 4u; k++) { if (v[k] != 0.0) { addF_racc(r * RACC_STRIDE + fields[k], v[k]); } } }
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var k = 0u; k < 16u; k++) { rr[k * WG + lid] += rr[k * WG + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 16u) {
    let q = lid / 4u;
    let k = lid % 4u;
    let sum = rr[lid * WG];
    if (sum != 0.0 && q < P.nreg) { addF_racc(q * RACC_STRIDE + fields[k], sum); }
  }
}
`,iu=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:Te,bind:"P:u cf:w cu:r at:w reg:r",code:`${ai}
${me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  ${t===2?"":`
  let dN = at[A_DN * n + c]; let dO = at[A_DO * n + c]; let dV = at[A_DV * n + c]; let dF = at[A_DF * n + c]; let dH = at[A_DH * n + c];
  if (dN != 0.0 || dO != 0.0 || dV != 0.0 || dF != 0.0 || dH != 0.0) {
    cf[F_MN * n + c] += dN; cf[F_MO * n + c] += dO; cf[F_MV * n + c] = max(0.0, cf[F_MV * n + c] + dV); cf[F_MF * n + c] = max(0.0, cf[F_MF * n + c] + dF); cf[F_HG * n + c] += dH;
    at[A_DN * n + c] = 0.0; at[A_DO * n + c] = 0.0; at[A_DV * n + c] = 0.0; at[A_DF * n + c] = 0.0; at[A_DH * n + c] = 0.0;
  }
  let dFi = at[A_DFILM * n + c]; let dEs = at[A_DES * n + c];
  if (dFi != 0.0 || dEs != 0.0) {
    cf[F_FILM * n + c] = max(0.0, cf[F_FILM * n + c] + dFi); cf[F_ES * n + c] += dEs;
    at[A_DFILM * n + c] = 0.0; at[A_DES * n + c] = 0.0;
    if (k == SOLID) { deriveSolid(c); }
  }`}
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; ${t===2?"cf[F_SRCV * n + c] = 0.0;":""} return; }
  ${t===2?"":`if (k == LIQUID && massOf(c) <= 0.0) { cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; ${t===1?"cf[F_VEOSMID * n + c] = 0.0;":""} return; }
  deriveCell(c);`}
  var veos = 0.0;
  if (cf[F_VGAS * n + c] > 0.0) { veos = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c); }
  cf[F_VEOS * n + c] = veos;
  ${t===1?"cf[F_VEOSMID * n + c] = veos;":""}
  ${t===2?"cf[F_SRCV * n + c] = select(0.0, veos - cf[F_VEOSMID * n + c], k == GAS);":""}
}`})),{name:"transitions",wg:Te,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
  let i = ci(c);
  let j = cj(c);
  if (k == 0u) { return select(NONE, c - 1u, i > 0); }
  if (k == 1u) { return select(NONE, c + 1u, i < i32(P.nx) - 1); }
  if (k == 2u) { return select(NONE, c - P.nx, j > 0); }
  return select(NONE, c + P.nx, j < i32(P.ny) - 1);
}
fn stableGas(nb: u32) -> bool { return nb != NONE && cu[U_KIND * P.n + nb] == GAS && cu[U_KPREV * P.n + nb] == GAS; }
fn vol(nb: u32) -> f32 { let v = cf[F_VGAS * P.n + nb]; return select(P.vcell, v, v > 0.0); }
fn mass(c: u32) -> f32 { let n = P.n; return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c]; }
/* Den Anteil share von a nach b (Arten, Nebel, Enthalpie) als Beiträge. */
fn moveGas(a: u32, b: u32, share: f32) {
  let n = P.n;
  let dN = cf[F_MN * n + a] * share; let dO = cf[F_MO * n + a] * share; let dV = cf[F_MV * n + a] * share;
  let dF = cf[F_MF * n + a] * share; let dH = cf[F_HG * n + a] * share;
  addF_at(A_DN * n + a, -dN); addF_at(A_DO * n + a, -dO); addF_at(A_DV * n + a, -dV); addF_at(A_DF * n + a, -dF); addF_at(A_DH * n + a, -dH);
  addF_at(A_DN * n + b, dN); addF_at(A_DO * n + b, dO); addF_at(A_DV * n + b, dV); addF_at(A_DF * n + b, dF); addF_at(A_DH * n + b, dH);
}
${me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let was = cu[U_KPREV * n + c];
  let now = cu[U_KIND * n + c];
  if (was == now || now == SOLID || was == SOLID) { return; }
  var wsum = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { wsum += vol(nb); } }
  if (wsum <= 0.0) { return; }
  if (now == LIQUID) {
    for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { moveGas(c, nb, vol(nb) / wsum); } }
    return;
  }
  let have = mass(c);
  var want = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { want += vol(nb) / wsum * cf[F_RHO * n + nb]; } }
  want *= max(1e-3, 1.0 - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  if (want <= have) { return; }
  for (var k = 0u; k < 4u; k++) {
    let nb = nbOf(c, k);
    if (!stableGas(nb)) { continue; }
    let mnb = mass(nb);
    if (mnb <= 0.0) { continue; }
    moveGas(nb, c, min(0.25, (want - have) * (vol(nb) / wsum) / mnb));
  }
}`},{name:"regCells",wg:Te,bind:"P:u cf:r cu:r racc:a",code:`${Hi}
${me} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) {
      let n = P.n;
      let mN = cf[F_MN * n + c]; let mO = cf[F_MO * n + c]; let mV = cf[F_MV * n + c];
      let nc = mN / M_N2 + mO / M_O2 + mV / M_H2O;
      let a = nc * R_GAS * cf[F_T * n + c];
      v = vec4<f32>(nc, mN + mO + mV, a, a * yOf(c));
    }
  }
  regSum(lid, r, v, vec4<u32>(RA_NSUM, RA_MSUM, RA_A, RA_B));
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${Hi}
${me} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (p < count) {
    let m = parts[p].mass;
    if ((parts[p].flags & 1u) == 0u && m > 0.0) {
      r = cu[U_RID * P.n + cellAt(parts[p].x, parts[p].y)];
      v = vec4<f32>(m / parts[p].rho, 0.0, 0.0, 0.0);
    }
  }
  regSum(lid, r, v, vec4<u32>(RA_VLIQ, RA_VLIQ, RA_VLIQ, RA_VLIQ));
}`},{name:"regBubs",wg:Te,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${me} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Go}
${me} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    let vf = reg[o + R_VFLUID];
    let vl = getF_racc(a + RA_VLIQ);
    let vb = getF_racc(a + RA_VBUB);
    let vg = max(1e-3 * vf, vf - vl - vb);
    reg[o + R_VLIQ] = vl;
    reg[o + R_VBUB] = vb;
    reg[o + R_VGAS] = vg;
    reg[o + R_NSUM] = getF_racc(a + RA_NSUM);
    reg[o + R_MSUM] = getF_racc(a + RA_MSUM);
    if (reg[o + R_OPEN] != 0.0) {
      reg[o + R_P0] = P.pamb;
      reg[o + R_RHOBAR] = P.rhoamb;
    } else {
      let rb = getF_racc(a + RA_MSUM) / vg;
      reg[o + R_RHOBAR] = rb;
      reg[o + R_P0] = statePressure(getF_racc(a + RA_A), getF_racc(a + RA_B), vg, rb);
    }
    ${t?"reg[o + R_P0START] = reg[o + R_P0]; reg[o + R_DP0] = 0.0;":""}
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compSums",wg:Te,bind:"P:u cf:r cu:r reg:r racc:a",code:`${Hi}
${me} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE && reg[r * REG_STRIDE + R_OPEN] == 0.0) {
      let n = P.n;
      let nc = cf[F_NMOL * n + c];
      let a = nc * R_GAS * cf[F_T * n + c];
      let cap = cf[F_CAP * n + c];
      var acomp = 0.0;
      if (cap > 0.0) { acomp = nc * (a / pAt(c)) / cap; }
      v = vec4<f32>(acomp, a, a * yOf(c), 0.0);
    } else { r = NONE; }
  }
  regSum(lid, r, v, vec4<u32>(RA_ACOMP, RA_A, RA_B, RA_VSUM));
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Go}
${me} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    if (reg[o + R_OPEN] == 0.0 && reg[o + R_VGAS] > 0.0) {
      let V = reg[o + R_VGAS];
      let pState = statePressure(getF_racc(a + RA_A), getF_racc(a + RA_B), V, reg[o + R_RHOBAR]);
      reg[o + R_P0] = pState;
      ${t===0?`let aa = R_GAS / V * getF_racc(a + RA_ACOMP);
      reg[o + R_KCOMP] = 1.0 / max(0.05, 1.0 - aa);
      reg[o + R_TOTAL] = 0.0;`:""}
      ${t<2?`var d = (pState - (reg[o + R_P0START] + reg[o + R_TOTAL])) * reg[o + R_KCOMP];
      if (abs(d) <= 1e-7 * pState) { d = 0.0; }
      reg[o + R_DP0] = d;
      reg[o + R_TOTAL] += d;`:"reg[o + R_DP0] = reg[o + R_TOTAL];"}
    }
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compApply",wg:Te,bind:"P:u cf:w cu:r reg:r",code:`${ai}
${me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let r = cu[U_RID * n + c];
  if (r == NONE || cu[U_KIND * n + c] == SOLID) { return; }
  let o = r * REG_STRIDE;
  if (reg[o + R_OPEN] != 0.0) { return; }
  let d = reg[o + R_DP0];
  if (d == 0.0 || !(cf[F_CAP * n + c] > 0.0)) { return; }
  let vc = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c);
  cf[F_HG * n + c] += vc * d;
  deriveCell(c);
}`},{name:"gasVolumes",wg:Te,bind:"P:u cf:w cu:r reg:r",code:`${me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let m = cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c];
  if (k == LIQUID && m + cf[F_MF * n + c] <= 0.0) { cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let vg = max(1e-3, 1.0 - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  cf[F_VGAS * n + c] = vg;
  cf[F_RHO * n + c] = m / vg;
  cf[F_VEOS * n + c] = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c);
}`},{name:"markFaces",wg:Te,bind:"P:u cu:r ff:w fu:w",code:`${me} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let ok = U_KIND * P.n;
  var ka = NONE;
  var kb = NONE;
  var gas = false;
  var wall = false;
  if (f < P.nu) {
    let i = i32(f % (P.nx + 1u));
    let j = i32(f / (P.nx + 1u));
    if (i > 0) { ka = cu[ok + cellOf(i - 1, j)]; }
    if (i < nx) { kb = cu[ok + cellOf(i, j)]; }
    gas = (ka == GAS && kb == GAS) || (i == 0 && P.openL != 0u && kb == GAS) || (i == nx && P.openR != 0u && ka == GAS);
    wall = (i == 0 && P.openL == 0u) || (i == nx && P.openR == 0u);
  } else {
    let g = f - P.nu;
    let i = i32(g % P.nx);
    let j = i32(g / P.nx);
    if (j > 0) { ka = cu[ok + cellOf(i, j - 1)]; }
    if (j < ny) { kb = cu[ok + cellOf(i, j)]; }
    gas = (ka == GAS && kb == GAS) || (j == 0 && P.openB != 0u && kb == GAS) || (j == ny && P.openT != 0u && ka == GAS);
    wall = (j == 0 && P.openB == 0u) || (j == ny && P.openT == 0u);
  }
  fu[fui(FU_GAS, f)] = select(0u, 1u, gas);
  if (!gas) {
    var u = 0.0;
    if ((ka == LIQUID || kb == LIQUID) && !(ka == SOLID || kb == SOLID || wall)) { u = ff[ffi(FF_UL, f)]; }
    ff[ffi(FF_UG, f)] = u;
  }
}`}],Ho=`const THETA_MIN: f32 = ${fr.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,Rn=128,$e=128,Zt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",he=`
var<workgroup> rsum: array<f32, WG>;
fn wsum(v: f32, lid: u32) -> f32 {
  rsum[lid] = v;
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { rsum[lid] += rsum[lid + s]; }
    workgroupBarrier();
  }
  let r = rsum[0];
  workgroupBarrier();
  return r;
}
fn wmax(v: f32, lid: u32) -> f32 {
  rsum[lid] = v;
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { rsum[lid] = max(rsum[lid], rsum[lid + s]); }
    workgroupBarrier();
  }
  let r = rsum[0];
  workgroupBarrier();
  return r;
}
`,$o=`
fn mirrorU(iIn: i32, jIn: i32) -> vec3<i32> {
  var i = iIn;
  var j = jIn;
  var s = 1;
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  if (i < 0) { if (P.openL != 0u) { i = 0; } else { i = -i; s = -s; } }
  else if (i > nx) { if (P.openR != 0u) { i = nx; } else { i = 2 * nx - i; s = -s; } }
  if (j < 0) { j = select(-1 - j, 0, P.openB != 0u); }
  else if (j >= ny) { j = select(2 * ny - 1 - j, ny - 1, P.openT != 0u); }
  return vec3<i32>(clamp(i, 0, nx), clamp(j, 0, ny - 1), s);
}
fn mirrorV(iIn: i32, jIn: i32) -> vec3<i32> {
  var i = iIn;
  var j = jIn;
  var s = 1;
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  if (i < 0) { i = select(-1 - i, 0, P.openL != 0u); }
  else if (i >= nx) { i = select(2 * nx - 1 - i, nx - 1, P.openR != 0u); }
  if (j < 0) { if (P.openB != 0u) { j = 0; } else { j = -j; s = -s; } }
  else if (j > ny) { if (P.openT != 0u) { j = ny; } else { j = 2 * ny - j; s = -s; } }
  return vec3<i32>(clamp(i, 0, nx - 1), clamp(j, 0, ny), s);
}
`,ru=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Wo=1,ou=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${Zt} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Wo}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${Zt} {
  let lid = lid3.x;
  let base = gid.x * 4u;
  var v: array<u32, 4>;
  var s = 0u;
  for (var k = 0u; k < 4u; k++) {
    let c = base + k;
    var x = 0u;
    if (c < P.n) { x = ccount[c]; cclear[c] = 0u; }
    v[k] = s;
    s += x;
  }
  sh[lid] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off <<= 1u) {
    var t = 0u;
    if (lid >= off) { t = sh[lid - off]; }
    workgroupBarrier();
    sh[lid] += t;
    workgroupBarrier();
  }
  let excl = sh[lid] - s;
  for (var k = 0u; k < 4u; k++) {
    let c = base + k;
    if (c < P.n) { cstart[c] = excl + v[k]; }
  }
  if (lid == 255u) { bsum[wid3.x] = sh[255]; }
}`},{name:"sortTop",wg:256,bind:"P:u bsum:w cnt:a pargs:w",code:`var<workgroup> sh: array<u32, 256>;
${Zt} {
  let lid = lid3.x;
  let nb = (P.n + 1023u) / 1024u;
  var v: array<u32, 4>;
  var s = 0u;
  for (var k = 0u; k < 4u; k++) {
    let b = lid * 4u + k;
    var x = 0u;
    if (b < nb) { x = bsum[b]; }
    v[k] = s;
    s += x;
  }
  sh[lid] = s;
  workgroupBarrier();
  for (var off = 1u; off < 256u; off <<= 1u) {
    var t = 0u;
    if (lid >= off) { t = sh[lid - off]; }
    workgroupBarrier();
    sh[lid] += t;
    workgroupBarrier();
  }
  let excl = sh[lid] - s;
  for (var k = 0u; k < 4u; k++) {
    let b = lid * 4u + k;
    if (b < nb) { bsum[b] = excl + v[k]; }
  }
  if (lid == 255u) {
    let total = sh[255];
    atomicStore(&cnt[C_PCOUNT], total);
    atomicStore(&cnt[C_PSORT], total);
    setF_cnt(C_SUM_M, 0.0);
    setF_cnt(C_SUM_V, 0.0);
    pargs[0] = max(1u, (total + ${Rn-1}u) / ${Rn}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${Zt} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:$e,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${he}
${ru}
${Zt} {
  let c = gid.x;
  let lid = lid3.x;
  var ms = 0.0;
  var vs = 0.0;
  if (c < P.n) {
    let i = ci(c);
    let j = cj(c);
    var phi = 0.0;
    var dv = 0.0;
    for (var b = -1; b <= 1; b++) {
      let jj = j + b;
      if (jj < 0 || jj >= i32(P.ny)) { continue; }
      for (var a = -1; a <= 1; a++) {
        let ii = i + a;
        if (ii < 0 || ii >= i32(P.nx)) { continue; }
        let cc = cellOf(ii, jj);
        let st = cellStart(cc);
        let cn = ccount[cc];
        for (var k = 0u; k < cn; k++) {
          let pk = st + k;
          let m = parts[pk].mass;
          let w = rawW(parts[pk].x, parts[pk].y, i, j);
          let vp = m / parts[pk].rho;
          phi += w * vp;
          dv += w * parts[pk].dvp;
          if (a == 0 && b == 0) { ms += m; vs += vp; }
        }
      }
    }
    cf[cfi(F_PHI, c)] = phi / P.vcell;
    if (dv != 0.0) { addF_at(ati(A_VOLSRC, c), dv / max(glob[G_DT], DRIFT_DT)); }
    cu[cui(U_KPREV, c)] = cu[cui(U_KIND, c)];
  }
  if (c == 0u) { atomicStore(&cnt[C_TMAX], 0u); setF_cnt(C_SUM_WM, 0.0); setF_cnt(C_SUM_WMT, 0.0); }
  let sm = wsum(ms, lid);
  let sv = wsum(vs, lid);
  if (lid == 0u) { addF_cnt(C_SUM_M, sm); addF_cnt(C_SUM_V, sv); }
}`},{name:"classify",wg:$e,bind:"P:u cf:r cu:w",code:`${Zt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  if (cu[cui(U_SOLID, c)] != 0u) { cu[cui(U_KIND, c)] = SOLID; return; }
  let f = cf[cfi(F_PHI, c)];
  var liquid = f > 0.0 && f + cf[cfi(F_PHIS, c)] + cf[cfi(F_ALPHA, c)] >= 0.5;
  let prev = cu[cui(U_KPREV, c)];
  if (!liquid && prev != GAS && prev != SOLID) {
    let i = ci(c);
    let j = cj(c);
    let o = U_KPREV * P.n;
    var near = false;
    if (i > 0) { near = near || cu[o + c - 1u] == GAS; } else { near = near || P.openL != 0u; }
    if (i < i32(P.nx) - 1) { near = near || cu[o + c + 1u] == GAS; } else { near = near || P.openR != 0u; }
    if (j > 0) { near = near || cu[o + c - P.nx] == GAS; } else { near = near || P.openB != 0u; }
    if (j < i32(P.ny) - 1) { near = near || cu[o + c + P.nx] == GAS; } else { near = near || P.openT != 0u; }
    if (!near) { liquid = true; }
  }
  cu[cui(U_KIND, c)] = select(GAS, LIQUID, liquid);
}`},{name:"p2g",wg:$e,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${$o}
${Zt} {
  let f = gid.x;
  let sm = cnt[C_SUM_M];
  let sv = cnt[C_SUM_V];
  let rhoRef = select(glob[G_RHOREF], sm / sv, sv > 0.0);
  if (f == 0u) { glob[G_RHOREF] = rhoRef; }
  if (f >= P.nf) { return; }
  let dt = glob[G_DT];
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let isU = f < P.nu;
  var i: i32;
  var j: i32;
  if (isU) { i = i32(f % (P.nx + 1u)); j = i32(f / (P.nx + 1u)); } else { let g = f - P.nu; i = i32(g % P.nx); j = i32(g / P.nx); }
  var m = 0.0;
  var mom = 0.0;
  var rv = 0.0;
  let dx = P.dx;
  /* Zellen der Teilchen, deren Knoten auf diese Fläche fallen können. */
  let pi0 = select(i - 1, i - 2, isU);
  let pi1 = i + 1;
  let pj0 = select(j - 2, j - 1, isU);
  let pj1 = j + 1;
  for (var pj = max(pj0, 0); pj <= min(pj1, ny - 1); pj++) {
    for (var pi = max(pi0, 0); pi <= min(pi1, nx - 1); pi++) {
      let cc = cellOf(pi, pj);
      let st = cellStart(cc);
      let cn = ccount[cc];
      for (var k = 0u; k < cn; k++) {
        let pk = st + k;
        let qx = parts[pk].x;
        let qy = parts[pk].y;
        let qm = parts[pk].mass;
        let sx = qx * P.invdx;
        let sy = qy * P.invdx;
        if (isU) {
          let i0 = i32(floor(sx - 0.5));
          let j0 = i32(floor(sy - 1.0));
          for (var b = 0; b < 3; b++) {
            for (var a = 0; a < 3; a++) {
              let ni = i0 + a;
              let nj = j0 + b;
              var ti = ni;
              var tj = nj;
              var sg = 1.0;
              if (ni < 0 || ni > nx || nj < 0 || nj >= ny) { let mm = mirrorU(ni, nj); ti = mm.x; tj = mm.y; sg = f32(mm.z); }
              if (ti != i || tj != j) { continue; }
              let wm = bspline1(sx - f32(ni)) * bspline1(sy - 0.5 - f32(nj)) * qm;
              m += wm;
              mom += sg * wm * (parts[pk].vx + parts[pk].c00 * (f32(ni) * dx - qx) + parts[pk].c01 * ((f32(nj) + 0.5) * dx - qy));
            }
          }
        } else {
          let i0 = i32(floor(sx - 1.0));
          let j0 = i32(floor(sy - 0.5));
          let ratio = parts[pk].rho / rhoRef;
          for (var b = 0; b < 3; b++) {
            for (var a = 0; a < 3; a++) {
              let ni = i0 + a;
              let nj = j0 + b;
              var ti = ni;
              var tj = nj;
              var sg = 1.0;
              if (ni < 0 || ni >= nx || nj < 0 || nj > ny) { let mm = mirrorV(ni, nj); ti = mm.x; tj = mm.y; sg = f32(mm.z); }
              if (ti != i || tj != j) { continue; }
              let wm = bspline1(sx - 0.5 - f32(ni)) * bspline1(sy - f32(nj)) * qm;
              m += wm;
              mom += sg * wm * (parts[pk].vy + parts[pk].c10 * ((f32(ni) + 0.5) * dx - qx) + parts[pk].c11 * (f32(nj) * dx - qy));
              rv += wm * ratio;
            }
          }
        }
      }
    }
  }
  let empty = EMPTY_FACE * rhoRef * P.vcell * 0.25;
  let force = af[f];
  af[f] = 0.0;
  var u = 0.0;
  if (m > empty) {
    u = mom / m + dt * force / (rhoRef * P.vcell);
    if (!isU) { u -= dt * P.gy * (rv / m); }
  }
  /* Feste und Wandflächen: 0, bekannt = 2; an Flüssigkeit: 1. */
  let ok = U_KIND * P.n;
  var ka = NONE;
  var kb = NONE;
  var wall = false;
  if (isU) {
    if (i > 0) { ka = cu[ok + cellOf(i - 1, j)]; }
    if (i < nx) { kb = cu[ok + cellOf(i, j)]; }
    wall = (i == 0 && P.openL == 0u) || (i == nx && P.openR == 0u);
  } else {
    if (j > 0) { ka = cu[ok + cellOf(i, j - 1)]; }
    if (j < ny) { kb = cu[ok + cellOf(i, j)]; }
    wall = (j == 0 && P.openB == 0u) || (j == ny && P.openT == 0u);
  }
  var known = select(0u, 1u, ka == LIQUID || kb == LIQUID);
  if (wall || ka == SOLID || kb == SOLID) { u = 0.0; known = 2u; }
  ff[ffi(FF_UL, f)] = u;
  fu[fui(FU_KNOWN, f)] = known;
}`},{name:"liqAssemble",wg:$e,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Ho}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${Zt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let s = s0(c);
  mgF[L.ax + s] = 0.0; mgF[L.ay + s] = 0.0; mgF[L.dH + s] = 0.0; mgF[L.dDx + s] = 0.0; mgF[L.dDy + s] = 0.0;
  if (cu[cui(U_KIND, c)] != LIQUID) {
    mgU[L.act + s] = 0u;
    cgv[s] = 0.0; cgv[P.n0 + s] = 0.0;
    return;
  }
  mgU[L.act + s] = 1u;
  cgv[s] = cf[cfi(F_PL, c)];
  let dt = glob[G_DT];
  let rhoRef = glob[G_RHOREF];
  let dx = P.dx;
  let i = ci(c);
  let j = cj(c);
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let o = FF_UL * P.nf;
  let div = ff[o + uF(i + 1, j)] - ff[o + uF(i, j)] + ff[o + vF(i, j + 1)] - ff[o + vF(i, j)];
  let phiTot = cf[cfi(F_PHI, c)] + cf[cfi(F_PHIS, c)] + cf[cfi(F_ALPHA, c)];
  var src = at[ati(A_VOLSRC, c)] / P.vcell;
  let surface = gasAt(i - 1, j) || gasAt(i + 1, j) || gasAt(i, j - 1) || gasAt(i, j + 1);
  let err = phiTot - 1.0;
  if (err > 0.0 || !surface) { src += DRIFT_GAIN * err / max(dt, DRIFT_DT); }
  var b = src * dx * dx - dx * div;
  let a = dt / rhoRef;
  var dDx = 0.0;
  var dDy = 0.0;
  if (i + 1 < nx) {
    let k = kindAt(i + 1, j);
    if (k == LIQUID) { mgF[L.ax + s] = a; } else if (k == GAS) { let q = a / thetaAt(c, c + 1u); dDx += q; b += q * pGas(c + 1u); }
  } else if (P.openR != 0u) { dDx += 2.0 * a; }
  if (i > 0) {
    if (kindAt(i - 1, j) == GAS) { let q = a / thetaAt(c, c - 1u); dDx += q; b += q * pGas(c - 1u); }
  } else if (P.openL != 0u) { dDx += 2.0 * a; }
  if (j + 1 < ny) {
    let k = kindAt(i, j + 1);
    if (k == LIQUID) { mgF[L.ay + s] = a; } else if (k == GAS) { let q = a / thetaAt(c, c + P.nx); dDy += q; b += q * pGas(c + P.nx); }
  } else if (P.openT != 0u) { dDy += 2.0 * a; }
  if (j > 0) {
    if (kindAt(i, j - 1) == GAS) { let q = a / thetaAt(c, c - P.nx); dDy += q; b += q * pGas(c - P.nx); }
  } else if (P.openB != 0u) { dDy += 2.0 * a; }
  mgF[L.dDx + s] = dDx;
  mgF[L.dDy + s] = dDy;
  cgv[P.n0 + s] = b;
}`},{name:"liqPressure",wg:$e,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${Zt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:$e,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Ho}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${Zt} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let known = fu[fui(FU_KNOWN, f)];
  fu[fui(FU_MARK, f)] = select(0u, 1u, known != 0u);
  if (known != 1u) { return; }
  let k = glob[G_DT] / glob[G_RHOREF] / P.dx;
  let o = F_PL * P.n;
  let nx = P.nx;
  if (f < P.nu) {
    let i = f % (nx + 1u);
    let j = f / (nx + 1u);
    var d = 0.0;
    if (i == 0u) { d = 2.0 * cf[o + j * nx]; }
    else if (i == nx) { d = -2.0 * cf[o + nx - 1u + j * nx]; }
    else { d = across(i - 1u + j * nx, i + j * nx, cf[o + i + j * nx] - cf[o + i - 1u + j * nx]); }
    ff[ffi(FF_UL, f)] -= k * d;
  } else {
    let g = f - P.nu;
    let i = g % nx;
    let j = g / nx;
    var d = 0.0;
    if (j == 0u) { d = 2.0 * cf[o + i]; }
    else if (j == P.ny) { d = -2.0 * cf[o + i + (P.ny - 1u) * nx]; }
    else { d = across(i + (j - 1u) * nx, i + j * nx, cf[o + i + j * nx] - cf[o + i + (j - 1u) * nx]); }
    ff[ffi(FF_UL, f)] -= k * d;
  }
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:$e,bind:"P:u ff:w fu:w",code:`${Zt} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let os = ${t} * P.nf;
  let om = ${s} * P.nf;
  let mk = fu[om + f];
  if (mk != 0u) {
    ff[${e} * P.nf + f] = ff[os + f];
    fu[${n} * P.nf + f] = mk;
    return;
  }
  let nx = P.nx;
  let ny = P.ny;
  var s = 0.0;
  var n = 0.0;
  if (f < P.nu) {
    let nxu = nx + 1u;
    let i = f % nxu;
    let j = f / nxu;
    if (i > 0u && fu[om + f - 1u] == 1u) { s += ff[os + f - 1u]; n += 1.0; }
    if (i < nx && fu[om + f + 1u] == 1u) { s += ff[os + f + 1u]; n += 1.0; }
    if (j > 0u && fu[om + f - nxu] == 1u) { s += ff[os + f - nxu]; n += 1.0; }
    if (j + 1u < ny && fu[om + f + nxu] == 1u) { s += ff[os + f + nxu]; n += 1.0; }
  } else {
    let g = f - P.nu;
    let i = g % nx;
    let j = g / nx;
    if (i > 0u && fu[om + f - 1u] == 1u) { s += ff[os + f - 1u]; n += 1.0; }
    if (i + 1u < nx && fu[om + f + 1u] == 1u) { s += ff[os + f + 1u]; n += 1.0; }
    if (j > 0u && fu[om + f - nx] == 1u) { s += ff[os + f - nx]; n += 1.0; }
    if (j < ny && fu[om + f + nx] == 1u) { s += ff[os + f + nx]; n += 1.0; }
  }
  if (n > 0.0) { ff[${e} * P.nf + f] = s / n; fu[${n} * P.nf + f] = 1u; }
  else { ff[${e} * P.nf + f] = ${i?"0.0":"ff[os + f]"}; fu[${n} * P.nf + f] = 0u; }
}`})),{name:"g2p",wg:Rn,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${$o}
${he}
fn uAt(i: i32, j: i32) -> f32 {
  if (i >= 0 && i <= i32(P.nx) && j >= 0 && j < i32(P.ny)) { return ff[FF_UL * P.nf + uF(i, j)]; }
  let m = mirrorU(i, j);
  return f32(m.z) * ff[FF_UL * P.nf + uF(m.x, m.y)];
}
fn vAt(i: i32, j: i32) -> f32 {
  if (i >= 0 && i < i32(P.nx) && j >= 0 && j <= i32(P.ny)) { return ff[FF_UL * P.nf + vF(i, j)]; }
  let m = mirrorV(i, j);
  return f32(m.z) * ff[FF_UL * P.nf + vF(m.x, m.y)];
}
${Zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var speed = 0.0;
  var escM = 0.0;
  var escE = 0.0;
  if (p < count) {
    var q = parts[p];
    let dx = P.dx;
    let dt = glob[G_DT];
    let x = q.x;
    let y = q.y;
    let sx = x * P.invdx;
    let sy = y * P.invdx;
    /* u: Knoten bei (i, j + ½). */
    var i0 = i32(floor(sx - 0.5));
    var j0 = i32(floor(sy - 1.0));
    var u = 0.0; var cu0 = 0.0; var cu1 = 0.0;
    for (var b = 0; b < 3; b++) {
      let nj = j0 + b;
      let wy = bspline1(sy - 0.5 - f32(nj));
      let dyn = (f32(nj) + 0.5) * dx - y;
      for (var a = 0; a < 3; a++) {
        let ni = i0 + a;
        let w = bspline1(sx - f32(ni)) * wy;
        let val = uAt(ni, nj);
        u += w * val; cu0 += w * val * (f32(ni) * dx - x); cu1 += w * val * dyn;
      }
    }
    i0 = i32(floor(sx - 1.0));
    j0 = i32(floor(sy - 0.5));
    var v = 0.0; var cv0 = 0.0; var cv1 = 0.0;
    for (var b = 0; b < 3; b++) {
      let nj = j0 + b;
      let wy = bspline1(sy - f32(nj));
      let dyn = f32(nj) * dx - y;
      for (var a = 0; a < 3; a++) {
        let ni = i0 + a;
        let w = bspline1(sx - 0.5 - f32(ni)) * wy;
        let val = vAt(ni, nj);
        v += w * val; cv0 += w * val * ((f32(ni) + 0.5) * dx - x); cv1 += w * val * dyn;
      }
    }
    let k4 = 4.0 / (dx * dx);
    q.vx = u; q.vy = v;
    q.c00 = k4 * cu0; q.c01 = k4 * cu1; q.c10 = k4 * cv0; q.c11 = k4 * cv1;
    speed = sqrt(u * u + v * v);
    /* RK2 im Gitterfeld. */
    let v0 = velL(x, y);
    let vm = velL(x + 0.5 * dt * v0.x, y + 0.5 * dt * v0.y);
    var nxp = x + dt * vm.x;
    var nyp = y + dt * vm.y;
    if ((nxp < 0.0 && P.openL != 0u) || (nxp > P.boxw && P.openR != 0u) || (nyp < 0.0 && P.openB != 0u) || (nyp > P.boxh && P.openT != 0u)) {
      escM = q.mass;
      escE = q.mass * q.h;
      q.flags = q.flags | ${Wo}u;
    } else {
      let mg = 1e-4 * dx;
      nxp = clamp(nxp, mg, P.boxw - mg);
      nyp = clamp(nyp, mg, P.boxh - mg);
      var d = sdfAt(nxp, nyp);
      for (var it = 0; it < 3; it++) {
        if (d >= 0.05 * dx) { break; }
        let e = 0.25 * dx;
        var gx = sdfAt(nxp + e, nyp) - sdfAt(nxp - e, nyp);
        var gy = sdfAt(nxp, nyp + e) - sdfAt(nxp, nyp - e);
        let len = sqrt(gx * gx + gy * gy);
        if (len < 1e-12) { break; }
        gx /= len;
        gy /= len;
        let push = 0.05 * dx - d;
        nxp += push * gx;
        nyp += push * gy;
        let vn = q.vx * gx + q.vy * gy;
        if (vn < 0.0) { q.vx -= vn * gx; q.vy -= vn * gy; }
        nxp = clamp(nxp, mg, P.boxw - mg);
        nyp = clamp(nyp, mg, P.boxh - mg);
        d = sdfAt(nxp, nyp);
      }
      q.x = nxp;
      q.y = nyp;
    }
    q.dvp = 0.0;
    parts[p] = q;
  }
  let vmax = wmax(speed, lid);
  let em = wsum(escM, lid);
  let ee = wsum(escE, lid);
  if (lid == 0u) {
    maxU_cnt(C_UMAXL, vmax);
    if (em != 0.0) { addF_cnt(C_ESC_WATER, em); addF_cnt(C_ESC_ENERGY, ee); }
  }
}`},{name:"heatWeights",wg:Rn,bind:"P:u cnt:a cu:r parts:w",code:`${he}
${Zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var m = 0.0;
  var mt = 0.0;
  var tmax = 0.0;
  if (p < count) {
    var q = parts[p];
    let sx = q.x * P.invdx - 0.5;
    let sy = q.y * P.invdx - 0.5;
    let bi = i32(floor(sx - 0.5));
    let bj = i32(floor(sy - 0.5));
    q.bi = bi;
    q.bj = bj;
    var sum = 0.0;
    for (var k = 0; k < 9; k++) {
      let i = bi + k % 3;
      let j = bj + k / 3;
      var w = 0.0;
      if (inGrid(i, j) && cu[U_KIND * P.n + cellOf(i, j)] == LIQUID) { w = bspline1(sx - f32(i)) * bspline1(sy - f32(j)); }
      q.wt[k] = w;
      sum += w;
    }
    if (sum > 0.0) { for (var k = 0; k < 9; k++) { q.wt[k] = q.wt[k] / sum; } }
    else { for (var k = 0; k < 9; k++) { q.wt[k] = 0.0; } q.wt[4] = 1.0; }
    parts[p] = q;
    m = q.mass;
    mt = q.mass * q.T;
    tmax = q.T;
  }
  let sm = wsum(m, lid);
  let st = wsum(mt, lid);
  let tx = wmax(tmax, lid);
  if (lid == 0u) { addF_cnt(C_SUM_WM, sm); addF_cnt(C_SUM_WMT, st); maxU_cnt(C_TMAX, tx); }
}`}],ke=128,Me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ko=`
fn ambQ(q: u32) -> f32 {
  if (q == 0u) { return P.ambN2; }
  if (q == 1u) { return P.ambO2; }
  if (q == 2u) { return P.ambH2O; }
  if (q == 3u) { return 0.0; }
  return P.ambH;
}
fn fieldQ(q: u32) -> u32 {
  if (q == 0u) { return F_MN; }
  if (q == 1u) { return F_MO; }
  if (q == 2u) { return F_MV; }
  if (q == 3u) { return F_MF; }
  return F_HG;
}
`,zo=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,Qo=`
fn sampleU(fld: u32, x: f32, y: f32) -> vec3<f32> {
  let nxu = P.nx + 1u;
  let o = fld * P.nf;
  let fx = clamp(x * P.invdx, 0.0, f32(P.nx) - 1e-4);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  let a0 = ff[o + i + j * nxu]; let a1 = ff[o + i + 1u + j * nxu]; let a2 = ff[o + i + (j + 1u) * nxu]; let a3 = ff[o + i + 1u + (j + 1u) * nxu];
  return vec3<f32>((1.0 - ty) * ((1.0 - tx) * a0 + tx * a1) + ty * ((1.0 - tx) * a2 + tx * a3), min(min(a0, a1), min(a2, a3)), max(max(a0, a1), max(a2, a3)));
}
fn sampleV(fld: u32, x: f32, y: f32) -> vec3<f32> {
  let o = fld * P.nf + P.nu;
  let nx = P.nx;
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(nx) - 1.0001);
  let fy = clamp(y * P.invdx, 0.0, f32(P.ny) - 1e-4);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  let a0 = ff[o + i + j * nx]; let a1 = ff[o + i + 1u + j * nx]; let a2 = ff[o + i + (j + 1u) * nx]; let a3 = ff[o + i + 1u + (j + 1u) * nx];
  return vec3<f32>((1.0 - ty) * ((1.0 - tx) * a0 + tx * a1) + ty * ((1.0 - tx) * a2 + tx * a3), min(min(a0, a1), min(a2, a3)), max(max(a0, a1), max(a2, a3)));
}
`,cu=[{name:"gasMaxOut",wg:ke,bind:"P:u cu:r ff:r cnt:a",code:`${he}
${Me} {
  let c = gid.x;
  let lid = lid3.x;
  var out = 0.0;
  var sp = 0.0;
  if (c < P.n && cu[U_KIND * P.n + c] == GAS) {
    let i = ci(c);
    let j = cj(c);
    let o = FF_UG * P.nf;
    let a = ff[o + uF(i, j)];
    let b = ff[o + uF(i + 1, j)];
    let d = ff[o + vF(i, j)];
    let t = ff[o + vF(i, j + 1)];
    out = max(-a, 0.0) + max(b, 0.0) + max(-d, 0.0) + max(t, 0.0);
    sp = max(max(abs(a), abs(b)), max(abs(d), abs(t)));
  }
  let mo = wmax(out, lid);
  let ms = wmax(sp, lid);
  if (lid == 0u) { maxU_cnt(C_MAXOUT, mo); maxU_cnt(C_UMAXG, ms); }
}`},{name:"gasFlux",wg:ke,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Ko}
${zo}
fn conc(c: u32, q: u32) -> f32 {
  if (cu[U_KIND * P.n + c] != GAS) { return 0.0; }
  return cf[fieldQ(q) * P.n + c] / cf[F_VGAS * P.n + c];
}
fn faceV(cd: f32, cu_: f32, cw: f32) -> f32 {
  let d1 = cd - cu_;
  let d2 = cw - cd;
  if (d1 * d2 > 0.0) { return cd + d1 * d2 / (d1 + d2); }
  return cd;
}
fn faceFlux(f: u32, h: f32) -> array<f32, 5> {
  var F = array<f32, 5>(0.0, 0.0, 0.0, 0.0, 0.0);
  let u = ff[ffi(FF_UG, f)];
  if (fu[fui(FU_GAS, f)] == 0u || u == 0.0) { return F; }
  let vol = u * P.aface * h;
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  var boundary = false;
  var inflow = false;
  var cin = 0u;
  var donor = 0u;
  var down = 0u;
  var up = NONE;
  if (f < P.nu) {
    let i = i32(f % (P.nx + 1u));
    let j = i32(f / (P.nx + 1u));
    if (i == 0 || i == nx) {
      boundary = true;
      cin = select(cellOf(nx - 1, j), cellOf(0, j), i == 0);
      inflow = select((u < 0.0), (u > 0.0), i == 0);
    } else if (u > 0.0) {
      donor = cellOf(i - 1, j); down = cellOf(i, j);
      if (i >= 2 && cu[U_KIND * P.n + cellOf(i - 2, j)] == GAS) { up = cellOf(i - 2, j); }
    } else {
      donor = cellOf(i, j); down = cellOf(i - 1, j);
      if (i + 1 < nx && cu[U_KIND * P.n + cellOf(i + 1, j)] == GAS) { up = cellOf(i + 1, j); }
    }
  } else {
    let g = f - P.nu;
    let i = i32(g % P.nx);
    let j = i32(g / P.nx);
    if (j == 0 || j == ny) {
      boundary = true;
      cin = select(cellOf(i, ny - 1), cellOf(i, 0), j == 0);
      inflow = select((u < 0.0), (u > 0.0), j == 0);
    } else if (u > 0.0) {
      donor = cellOf(i, j - 1); down = cellOf(i, j);
      if (j >= 2 && cu[U_KIND * P.n + cellOf(i, j - 2)] == GAS) { up = cellOf(i, j - 2); }
    } else {
      donor = cellOf(i, j); down = cellOf(i, j - 1);
      if (j + 1 < ny && cu[U_KIND * P.n + cellOf(i, j + 1)] == GAS) { up = cellOf(i, j + 1); }
    }
  }
  for (var q = 0u; q < 5u; q++) {
    if (boundary) { F[q] = vol * select(conc(cin, q), ambQ(q), inflow); }
    else if (up == NONE) { F[q] = vol * conc(donor, q); }
    else { F[q] = vol * faceV(conc(donor, q), conc(up, q), conc(down, q)); }
  }
  return F;
}
fn putFlux(f: u32, F: array<f32, 5>) {
  for (var q = 0u; q < 5u; q++) { ff[(FF_FLUX + q) * P.nf + f] = F[q]; }
}
fn massOut(F: array<f32, 5>) -> f32 { return F[0] + F[1] + F[2] + F[3]; }
${Me} {
  let ns = substepsOf(bitcast<f32>(cntWG(lid3.x, C_MAXOUT)));
  let c = gid.x;
  if (c == 0u && SUB.s == 0u) { atomicMax(&cnt[C_NSUBMAX], ns); }
  if (SUB.s >= ns || c >= P.n) { return; }
  let h = glob[G_DT] / f32(ns);
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let Fl = faceFlux(uF(i, j), h);
  let Fr = faceFlux(uF(i + 1, j), h);
  let Fb = faceFlux(vF(i, j), h);
  let Ft = faceFlux(vF(i, j + 1), h);
  putFlux(uF(i, j), Fl);
  putFlux(vF(i, j), Fb);
  if (i == i32(P.nx) - 1) { putFlux(uF(i + 1, j), Fr); }
  if (j == i32(P.ny) - 1) { putFlux(vF(i, j + 1), Ft); }
  var sc = 1.0;
  if (cu[U_KIND * n + c] == GAS) {
    let out = max(-massOut(Fl), 0.0) + max(massOut(Fr), 0.0) + max(-massOut(Fb), 0.0) + max(massOut(Ft), 0.0);
    let have = 0.9 * (cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c]);
    if (out > have && out > 0.0) { sc = have / out; }
  }
  cf[F_SCALE * n + c] = sc;
}`},{name:"gasMove",wg:ke,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Ko}
${zo}
${he}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Me} {
  let lid = lid3.x;
  let ns = substepsOf(bitcast<f32>(cntWG(lid, C_MAXOUT)));
  let c = gid.x;
  var ew = 0.0;
  var ea = 0.0;
  var ee = 0.0;
  let running = SUB.s < ns;
  if (running && c < P.n && cu[U_KIND * P.n + c] == GAS) {
    let n = P.n;
    let i = ci(c);
    let j = cj(c);
    let nx = i32(P.nx);
    let ny = i32(P.ny);
    var d = array<f32, 5>(0.0, 0.0, 0.0, 0.0, 0.0);
    /* Seiten: links, rechts, unten, oben — Fläche, Vorzeichen (Fluss > 0 ist hinein?), Nachbar stromauf bzw. -ab. */
    for (var s = 0u; s < 4u; s++) {
      var f = 0u;
      var into = 1.0;
      var other = NONE;
      var edge = false;
      if (s == 0u) { f = uF(i, j); into = 1.0; if (i > 0) { other = c - 1u; } else { edge = true; } }
      else if (s == 1u) { f = uF(i + 1, j); into = -1.0; if (i + 1 < nx) { other = c + 1u; } else { edge = true; } }
      else if (s == 2u) { f = vF(i, j); into = 1.0; if (j > 0) { other = c - P.nx; } else { edge = true; } }
      else { f = vF(i, j + 1); into = -1.0; if (j + 1 < ny) { other = c + P.nx; } else { edge = true; } }
      if (fu[fui(FU_GAS, f)] == 0u) { continue; }
      let m = mflux(f);
      /* Spender: bei Fluss in Richtung der Fläche die Zelle davor. */
      var sc = 1.0;
      let fromOther = (m > 0.0 && into > 0.0) || (m < 0.0 && into < 0.0);
      if (fromOther) { if (other != NONE) { sc = cf[F_SCALE * n + other]; } }
      else { sc = cf[F_SCALE * n + c]; }
      for (var q = 0u; q < 5u; q++) {
        let F = ff[FF_FLUX * P.nf + f + q * P.nf] * sc * into;
        d[q] += F;
        if (edge) {
          if (q == 0u || q == 1u) { ea -= F; } else if (q == 4u) { ee -= F; } else { ew -= F; }
        }
      }
    }
    cf[F_MN * n + c] += d[0];
    cf[F_MO * n + c] += d[1];
    cf[F_MV * n + c] = max(0.0, cf[F_MV * n + c] + d[2]);
    cf[F_MF * n + c] = max(0.0, cf[F_MF * n + c] + d[3]);
    cf[F_HG * n + c] += d[4];
  }
  let sw = wsum(ew, lid);
  let sa = wsum(ea, lid);
  let se = wsum(ee, lid);
  if (lid == 0u) {
    if (sw != 0.0) { addF_cnt(C_ESC_WATER, sw); }
    if (sa != 0.0) { addF_cnt(C_ESC_AIR, sa); }
    if (se != 0.0) { addF_cnt(C_ESC_ENERGY, se); }
  }
}`},{name:"macFwd",wg:ke,bind:"P:u glob:r ff:w fu:r",code:`${Qo}
${Me} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let u0 = ff[ffi(FF_UG, f)];
  if (fu[fui(FU_GAS, f)] == 0u) { ff[ffi(FF_MAC1, f)] = u0; return; }
  let dt = glob[G_DT];
  var r = vec3<f32>(0.0);
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    let x = f32(i) * P.dx;
    let y = (f32(j) + 0.5) * P.dx;
    let v = sampleV(FF_UG, x, y).x;
    r = sampleU(FF_UG, x - dt * u0, y - dt * v);
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    let x = (f32(i) + 0.5) * P.dx;
    let y = f32(j) * P.dx;
    let u = sampleU(FF_UG, x, y).x;
    r = sampleV(FF_UG, x - dt * u, y - dt * u0);
  }
  ff[ffi(FF_MAC1, f)] = r.x;
  ff[ffi(FF_LO, f)] = r.y;
  ff[ffi(FF_HI, f)] = r.z;
}`},{name:"macBack",wg:ke,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${Qo}
${Me} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let u0 = ff[ffi(FF_UG, f)];
  if (fu[fui(FU_GAS, f)] == 0u) { ff[ffi(FF_TSCR, f)] = u0; return; }
  let dt = glob[G_DT];
  let u1 = ff[ffi(FF_MAC1, f)];
  var back = 0.0;
  var bi = 0;
  var bj = 0;
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    let x = f32(i) * P.dx;
    let y = (f32(j) + 0.5) * P.dx;
    let v = sampleV(FF_UG, x, y).x;
    back = sampleU(FF_MAC1, x + dt * u0, y + dt * v).x;
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    bi = i32(i);
    bj = i32(j);
    let x = (f32(i) + 0.5) * P.dx;
    let y = f32(j) * P.dx;
    let u = sampleU(FF_UG, x, y).x;
    back = sampleV(FF_MAC1, x + dt * u, y + dt * u0).x;
  }
  var val = u1 + 0.5 * (u0 - back);
  if (val < ff[ffi(FF_LO, f)] || val > ff[ffi(FF_HI, f)]) { val = u1; }
  /* Auftrieb auf den v-Flächen: g (ρ − ρ̄)/ρ. */
  if (f >= P.nu) {
    let n = P.n;
    var rb = -1.0;
    var rt = -1.0;
    var cb = NONE;
    var ct = NONE;
    if (bj > 0) { cb = cellOf(bi, bj - 1); if (cu[U_KIND * n + cb] == GAS) { rb = cf[F_RHO * n + cb]; } }
    if (bj < i32(P.ny)) { ct = cellOf(bi, bj); if (cu[U_KIND * n + ct] == GAS) { rt = cf[F_RHO * n + ct]; } }
    if (rb > 0.0 || rt > 0.0) {
      let rf = max(RHO_MIN, select(max(rb, rt), 0.5 * (rb + rt), rb > 0.0 && rt > 0.0));
      let c = select(ct, cb, rb > 0.0);
      let r = cu[U_RID * n + c];
      let rbar = select(P.rhoamb, reg[r * REG_STRIDE + R_RHOBAR], r != NONE);
      val -= dt * P.gy * (rf - rbar) / rf;
    }
  }
  ff[ffi(FF_TSCR, f)] = val;
}`},{name:"viscosity",wg:ke,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Me} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_GAS, f)] == 0u) { return; }
  let n = P.n;
  let o = FF_TSCR * P.nf;
  let k = glob[G_DT] / (P.dx * P.dx);
  let uc = ff[o + f];
  var e = uc; var w = uc; var s = uc; var nn = uc;
  var c = 0u;
  if (f < P.nu) {
    let nxu = P.nx + 1u;
    let i = f % nxu;
    let j = f / nxu;
    c = select(i - 1u + j * P.nx, i + j * P.nx, i < P.nx && cu[U_KIND * n + i + j * P.nx] == GAS);
    if (i < P.nx) { e = ff[o + f + 1u]; }
    if (i > 0u) { w = ff[o + f - 1u]; }
    s = select(select(-uc, uc, P.openB != 0u), ff[o + f - nxu], j > 0u);
    nn = select(select(-uc, uc, P.openT != 0u), ff[o + f + nxu], j + 1u < P.ny);
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    c = select(i + (j - 1u) * P.nx, i + j * P.nx, j < P.ny && cu[U_KIND * n + i + j * P.nx] == GAS);
    if (j < P.ny) { nn = ff[o + f + P.nx]; }
    if (j > 0u) { s = ff[o + f - P.nx]; }
    w = select(select(-uc, uc, P.openL != 0u), ff[o + f - 1u], i > 0u);
    e = select(select(-uc, uc, P.openR != 0u), ff[o + f + 1u], i + 1u < P.nx);
  }
  let nu = cf[F_MU * n + c] / max(RHO_MIN, cf[F_RHO * n + c]);
  ff[ffi(FF_UG, f)] = uc + min(0.2, k * nu) * (e + w + s + nn - 4.0 * uc);
}`},{name:"gasAssemble",wg:ke,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let s = s0(c);
  mgF[L.ax + s] = 0.0; mgF[L.ay + s] = 0.0; mgF[L.dH + s] = 0.0; mgF[L.dDx + s] = 0.0; mgF[L.dDy + s] = 0.0;
  if (cu[U_KIND * n + c] != GAS) { mgU[L.act + s] = 0u; cgv[s] = 0.0; cgv[P.n0 + s] = 0.0; return; }
  mgU[L.act + s] = 1u;
  cgv[s] = cf[F_PG * n + c];
  let dt = glob[G_DT];
  let dx = P.dx;
  let i = ci(c);
  let j = cj(c);
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let o = FF_UG * P.nf;
  let div = ff[o + uF(i + 1, j)] - ff[o + uF(i, j)] + ff[o + vF(i, j + 1)] - ff[o + vF(i, j)];
  let vc = P.vcell;
  let corr = clamp(cf[F_VEOS * n + c] - cf[F_VGAS * n + c], -0.5 * vc, 0.5 * vc);
  let src = clamp(cf[F_SRCV * n + c], -0.5 * vc, 0.5 * vc);
  let Sg = (corr + src) / (vc * dt);
  cgv[P.n0 + s] = Sg * dx * dx - dx * div;
  let rc = max(RHO_MIN, cf[F_RHO * n + c]);
  var dDx = 0.0;
  var dDy = 0.0;
  if (i + 1 < nx) { if (cu[U_KIND * n + c + 1u] == GAS) { mgF[L.ax + s] = 2.0 * dt / (rc + max(RHO_MIN, cf[F_RHO * n + c + 1u])); } }
  else if (P.openR != 0u) { dDx += 2.0 * dt / rc; }
  if (i == 0 && P.openL != 0u) { dDx += 2.0 * dt / rc; }
  if (j + 1 < ny) { if (cu[U_KIND * n + c + P.nx] == GAS) { mgF[L.ay + s] = 2.0 * dt / (rc + max(RHO_MIN, cf[F_RHO * n + c + P.nx])); } }
  else if (P.openT != 0u) { dDy += 2.0 * dt / rc; }
  if (j == 0 && P.openB != 0u) { dDy += 2.0 * dt / rc; }
  mgF[L.dDx + s] = dDx;
  mgF[L.dDy + s] = dDy;
}`},{name:"gasPressure",wg:ke,bind:"P:u cf:w cu:r cgv:r",code:`${Me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:ke,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Me} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_GAS, f)] == 0u) { return; }
  let n = P.n;
  let k = 2.0 * glob[G_DT] / P.dx;
  let op = F_PG * n;
  let orh = F_RHO * n;
  let nx = P.nx;
  var d = 0.0;
  if (f < P.nu) {
    let i = f % (nx + 1u);
    let j = f / (nx + 1u);
    if (i == 0u) { let c = j * nx; d = k / max(RHO_MIN, cf[orh + c]) * cf[op + c]; }
    else if (i == nx) { let c = nx - 1u + j * nx; d = -k / max(RHO_MIN, cf[orh + c]) * cf[op + c]; }
    else { let l = i - 1u + j * nx; let r = l + 1u; d = k / (max(RHO_MIN, cf[orh + l]) + max(RHO_MIN, cf[orh + r])) * (cf[op + r] - cf[op + l]); }
  } else {
    let g = f - P.nu;
    let i = g % nx;
    let j = g / nx;
    if (j == 0u) { let c = i; d = k / max(RHO_MIN, cf[orh + c]) * cf[op + c]; }
    else if (j == P.ny) { let c = i + (P.ny - 1u) * nx; d = -k / max(RHO_MIN, cf[orh + c]) * cf[op + c]; }
    else { let b = i + (j - 1u) * nx; let t = b + nx; d = k / (max(RHO_MIN, cf[orh + b]) + max(RHO_MIN, cf[orh + t])) * (cf[op + t] - cf[op + b]); }
  }
  ff[ffi(FF_UG, f)] -= d;
}`}],te=128,ee="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",ss=`
fn wtAt(q: Particle, i: i32, j: i32) -> f32 {
  let a = i - q.bi;
  let b = j - q.bj;
  if (a < 0 || a > 2 || b < 0 || b > 2) { return 0.0; }
  return q.wt[u32(a + 3 * b)];
}
fn alive(q: Particle) -> bool { return (q.flags & 1u) == 0u && q.mass > 0.0; }
/* Dasselbe feldweise aus dem Speicher (ohne das ganze Teilchen zu laden). */
fn wtAtI(k: u32, i: i32, j: i32) -> f32 {
  let a = i - parts[k].bi;
  let b = j - parts[k].bj;
  if (a < 0 || a > 2 || b < 0 || b > 2) { return 0.0; }
  return parts[k].wt[u32(a + 3 * b)];
}
fn aliveI(k: u32) -> bool { return (parts[k].flags & 1u) == 0u && parts[k].mass > 0.0; }
`,au=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,lu=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:te,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${ss}
${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  var Cl = 0.0;
  var CT = 0.0;
  var acc = 0.0;
  var accH = 0.0;
  for (var b = -1; b <= 1; b++) {
    let jj = j + b;
    if (jj < 0 || jj >= i32(P.ny)) { continue; }
    for (var a = -1; a <= 1; a++) {
      let ii = i + a;
      if (ii < 0 || ii >= i32(P.nx)) { continue; }
      let cc = cellOf(ii, jj);
      let st = cellStart(cc);
      let cn = ccount[cc];
      for (var k = 0u; k < cn; k++) {
        let pk = st + k;
        let w = wtAtI(pk, i, j);
        if (w == 0.0 || !aliveI(pk)) { continue; }
        let m = parts[pk].mass;
        let T = parts[pk].T;
        let Cp = m * cpL(T);
        Cl += w * Cp;
        CT += w * Cp * T;
        acc += w * m;
        accH += w * m * parts[pk].h;
      }
    }
  }
  cf[F_PCL * n + c] = Cl;
  cf[F_PTL * n + c] = select(cf[F_T * n + c], CT / Cl, Cl > 0.0);
  cf[F_ACC * n + c] = acc;
  cf[F_ACCH * n + c] = accH;
  setF_at(A_FM * n + c, 0.0);
  setF_at(A_FE * n + c, 0.0);
  ${t?`if (cu[U_KIND * n + c] == LIQUID) {
    let Ts = tSat(max(0.5 * P.pref, P.pref + cf[F_PL * n + c]));
    cf[F_TSAT * n + c] = Ts;
    setF_at(A_BUDGET * n + c, Cl * (cf[F_PTL * n + c] - Ts));
  } else { cf[F_TSAT * n + c] = 0.0; setF_at(A_BUDGET * n + c, 0.0); }`:""}
}`})),{name:"applyMass",wg:te,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ss}
${he}
${ee} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var made = 0.0;
  if (p < count) {
    var q = parts[p];
    if (alive(q)) {
      let n = P.n;
      var d = 0.0;
      for (var k = 0; k < 9; k++) {
        let w = q.wt[k];
        if (w == 0.0) { continue; }
        let i = q.bi + k % 3;
        let j = q.bj + k / 3;
        if (!inGrid(i, j)) { continue; }
        let c = cellOf(i, j);
        let fm = getF_at(A_FM * n + c);
        let acc = cf[F_ACC * n + c];
        if (fm != 0.0 && acc > 0.0) { d += fm * w * q.mass / acc; }
      }
      if (d != 0.0) {
        let before = q.mass / q.rho;
        let m = q.mass + d;
        let nominal = glob[G_RHOREF] * P.vcell / 4.0;
        if (m < MIN_MASS * nominal) {
          let c0 = cellAt(q.x, q.y);
          var gc = c0;
          for (var k = 0u; k < P.ny; k++) { if (cu[U_KIND * n + gc] == GAS) { break; } if (gc + P.nx < n) { gc += P.nx; } else { gc = NONE; break; } }
          if (gc != NONE && cu[U_KIND * n + gc] != GAS) { gc = NONE; }
          if (m > 0.0 && gc != NONE) {
            let hv = hV(q.T);
            addF_at(A_DV * n + gc, m);
            addF_at(A_DH * n + gc, m * hv);
            addF_at(A_HSRC * n + c0, -m * (hv - q.h) / glob[G_DT]);
            made = m;
            q.flags = q.flags | 1u;
            q.mass = 0.0;
          } else if (m > 0.0) {
            q.mass = m;
            q.dvp += m / q.rho - before;
          } else {
            q.flags = q.flags | 1u;
            q.mass = 0.0;
          }
        } else {
          q.mass = m;
          q.dvp += m / q.rho - before;
        }
        parts[p] = q;
      }
    }
  }
  let sm = wsum(made, lid);
  if (lid == 0u && sm != 0.0) { addF_cnt(C_PRODUCED, sm); }
}`},{name:"diffPrep",wg:te,bind:"P:u cf:w cu:w reg:r",code:`${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let o = U_KIND * n;
  if (cu[o + c] != GAS) { cf[F_MTOT * n + c] = 0.0; cu[U_EDGE * n + c] = 0u; return; }
  let m = cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c];
  cf[F_MTOT * n + c] = m;
  cf[F_Y0 * n + c] = select(0.0, cf[F_MV * n + c] / m, m > 0.0);
  let T = cf[F_T * n + c];
  cf[F_RD * n + c] = cf[F_RHO * n + c] * diffVapour(T, pAt(c));
  cf[F_HVC * n + c] = hV(T);
  cf[F_HNC * n + c] = hN2(T);
  cf[F_HOC * n + c] = hO2(T);
  let i = ci(c);
  let j = cj(c);
  let edge = i == 0 || j == 0 || i == i32(P.nx) - 1 || j == i32(P.ny) - 1 || cu[o + c - 1u] != GAS || cu[o + c + 1u] != GAS || cu[o + c - P.nx] != GAS || cu[o + c + P.nx] != GAS;
  cu[U_EDGE * n + c] = select(0u, 1u, edge);
}`},{name:"diffAssemble",wg:te,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${au}
${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let s = s0(c);
  mgF[L.ax + s] = 0.0; mgF[L.ay + s] = 0.0; mgF[L.dH + s] = 0.0; mgF[L.dDx + s] = 0.0; mgF[L.dDy + s] = 0.0;
  let mt = cf[F_MTOT * n + c];
  if (cu[U_KIND * n + c] != GAS || !(mt > 0.0)) { mgU[L.act + s] = 0u; cgv[s] = 0.0; cgv[P.n0 + s] = 0.0; return; }
  mgU[L.act + s] = 1u;
  let dt = glob[G_DT];
  let Y = cf[F_Y0 * n + c];
  cgv[s] = Y;
  mgF[L.dH + s] = mt / dt;
  var b = mt * Y / dt;
  let i = ci(c);
  let j = cj(c);
  let rd = cf[F_RD * n + c];
  if (i + 1 < i32(P.nx) && cu[U_KIND * n + c + 1u] == GAS && cf[F_MTOT * n + c + 1u] > 0.0) { mgF[L.ax + s] = 0.5 * (rd + cf[F_RD * n + c + 1u]) * P.depth; }
  if (j + 1 < i32(P.ny) && cu[U_KIND * n + c + P.nx] == GAS && cf[F_MTOT * n + c + P.nx] > 0.0) { mgF[L.ay + s] = 0.5 * (rd + cf[F_RD * n + c + P.nx]) * P.depth; }
  if (cu[U_EDGE * n + c] != 0u) {
    let half = 2.0 * rd * P.depth;
    let p = pAt(c);
    var gb = 0.0;
    for (var k = 0u; k < 4u; k++) {
      var G = 0.0;
      var yb = 0.0;
      let out = (k == 0u && i == 0) || (k == 1u && i == i32(P.nx) - 1) || (k == 2u && j == 0) || (k == 3u && j == i32(P.ny) - 1);
      if (out) {
        if (sideOpen(k)) { G = half; yb = P.yH2O; }
      } else {
        var nb = c + P.nx;
        if (k == 0u) { nb = c - 1u; } else if (k == 1u) { nb = c + 1u; } else if (k == 2u) { nb = c - P.nx; }
        let kn = cu[U_KIND * n + nb];
        if (kn == LIQUID) {
          yb = ysat(cf[F_PTL * n + nb], p, c);
          G = half * (1.0 - Y);
        } else if (kn == SOLID) {
          let ys = ysat(cf[F_T * n + nb], p, c);
          if (Y > ys || (cf[F_FILM * n + nb] > 0.0 && Y < ys)) { yb = ys; G = half * (1.0 - Y); }
        }
      }
      cf[(F_BG + k) * n + c] = G;
      cf[(F_BY + k) * n + c] = yb;
      if (G > 0.0) { gb += G; b += G * yb; }
    }
    mgF[L.dDx + s] = gb;
  }
  cgv[P.n0 + s] = b;
}`},{name:"diffFaces",wg:te,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${ee} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let n = P.n;
  var a = NONE;
  var b = NONE;
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    if (i > 0u && i < P.nx) { a = i - 1u + j * P.nx; b = a + 1u; }
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    if (j > 0u && j < P.ny) { a = i + (j - 1u) * P.nx; b = a + P.nx; }
  }
  var dV = 0.0; var dN = 0.0; var dO = 0.0; var dH = 0.0;
  if (a != NONE && cu[U_KIND * n + a] == GAS && cu[U_KIND * n + b] == GAS && cf[F_MTOT * n + a] > 0.0 && cf[F_MTOT * n + b] > 0.0) {
    let Fin = glob[G_DT] * 0.5 * (cf[F_RD * n + a] + cf[F_RD * n + b]) * P.depth * (cgv[s0(a)] - cgv[s0(b)]);
    if (Fin != 0.0) {
      let src = select(b, a, Fin > 0.0);
      let to = select(a, b, Fin > 0.0);
      let F = min(abs(Fin), cf[F_MV * n + src]);
      if (F > 0.0) {
        let airN = cf[F_MN * n + to];
        let airO = cf[F_MO * n + to];
        let air = airN + airO;
        let back = min(F, air);
        var fN = 0.0;
        var fO = 0.0;
        if (back > 0.0) { fN = back * airN / air; fO = back - fN; }
        let hv = cf[F_HVC * n + src];
        let hair = fN * cf[F_HNC * n + to] + fO * cf[F_HOC * n + to];
        /* Änderungen der Zelle a (b bekommt das Gegenteil). */
        let sgn = select(1.0, -1.0, src == a);
        dV = sgn * F;
        dN = -sgn * fN;
        dO = -sgn * fO;
        dH = sgn * (F * hv - hair);
      }
    }
  }
  ff[ffi(FF_DV, f)] = dV;
  ff[ffi(FF_DN, f)] = dN;
  ff[ffi(FF_DO, f)] = dO;
  ff[ffi(FF_DH, f)] = dH;
}`},{name:"diffApply",wg:te,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${he}
${ee} {
  let c = gid.x;
  let lid = lid3.x;
  var prod = 0.0; var cond = 0.0; var dew = 0.0; var ew = 0.0; var ea = 0.0; var ee = 0.0;
  let n = P.n;
  if (c < n && cu[U_KIND * n + c] == GAS && cf[F_MTOT * n + c] > 0.0) {
    let i = ci(c);
    let j = cj(c);
    let dt = glob[G_DT];
    var mN = cf[F_MN * n + c];
    var mO = cf[F_MO * n + c];
    var mV = cf[F_MV * n + c];
    var H = cf[F_HG * n + c];
    let T = cf[F_T * n + c];
    /* Flächen: links und unten ist c die Zelle b, rechts und oben die Zelle a. */
    let fl = uF(i, j); let fr = uF(i + 1, j); let fb = vF(i, j); let ft = vF(i, j + 1);
    mV += ff[ffi(FF_DV, fr)] + ff[ffi(FF_DV, ft)] - ff[ffi(FF_DV, fl)] - ff[ffi(FF_DV, fb)];
    mN += ff[ffi(FF_DN, fr)] + ff[ffi(FF_DN, ft)] - ff[ffi(FF_DN, fl)] - ff[ffi(FF_DN, fb)];
    mO += ff[ffi(FF_DO, fr)] + ff[ffi(FF_DO, ft)] - ff[ffi(FF_DO, fl)] - ff[ffi(FF_DO, fb)];
    H += ff[ffi(FF_DH, fr)] + ff[ffi(FF_DH, ft)] - ff[ffi(FF_DH, fl)] - ff[ffi(FF_DH, fb)];
    if (cu[U_EDGE * n + c] != 0u) {
      let Yc = cgv[s0(c)];
      for (var k = 0u; k < 4u; k++) {
        let G = cf[(F_BG + k) * n + c];
        if (!(G > 0.0)) { continue; }
        let F = dt * G * (cf[(F_BY + k) * n + c] - Yc);
        let out = (k == 0u && i == 0) || (k == 1u && i == i32(P.nx) - 1) || (k == 2u && j == 0) || (k == 3u && j == i32(P.ny) - 1);
        if (out) {
          let Ta = P.tamb;
          if (F > 0.0) {
            let air = mN + mO;
            let back = min(F, air);
            mV += F;
            H += F * hV(Ta);
            if (back > 0.0) {
              let fN = back * mN / air;
              let fO = back - fN;
              mN -= fN;
              mO -= fO;
              let hh = fN * hN2(T) + fO * hO2(T);
              H -= hh;
              ea += back;
              ee += hh;
            }
            ew -= F;
            ee -= F * hV(Ta);
          } else if (F < 0.0) {
            let o = min(-F, mV);
            let dry = max(1e-30, P.yN2 + P.yO2);
            mV -= o;
            H -= o * hV(T);
            let fN = o * P.yN2 / dry;
            let fO = o - fN;
            mN += fN;
            mO += fO;
            let hh = fN * hN2(Ta) + fO * hO2(Ta);
            H += hh;
            ew += o;
            ea -= o;
            ee += o * hV(T) - hh;
          }
          continue;
        }
        var nb = c + P.nx;
        if (k == 0u) { nb = c - 1u; } else if (k == 1u) { nb = c + 1u; } else if (k == 2u) { nb = c - P.nx; }
        let kn = cu[U_KIND * n + nb];
        if (kn == LIQUID) {
          if (F > 0.0) {
            let hv = hV(cf[F_PTL * n + nb]);
            mV += F;
            H += F * hv;
            addF_at(A_FM * n + nb, -F);
            addF_at(A_FE * n + nb, -F * hv);
            prod += F;
          } else {
            let take = min(-F, mV);
            let hv = hV(T);
            mV -= take;
            H -= take * hv;
            addF_at(A_FM * n + nb, take);
            addF_at(A_FE * n + nb, take * hv);
            cond += take;
          }
        } else if (kn == SOLID) {
          let Tw = cf[F_T * n + nb];
          if (F < 0.0) {
            let take = min(-F, mV);
            mV -= take;
            H -= take * hV(T);
            addF_at(A_DFILM * n + nb, take);
            addF_at(A_DES * n + nb, take * hL(Tw));
            addF_at(A_HSRC * n + nb, take * (hV(T) - hL(Tw)) / dt);
            dew += take;
          } else {
            let give = min(F, 0.25 * cf[F_FILM * n + nb]);
            if (give > 0.0) {
              addF_at(A_DFILM * n + nb, -give);
              addF_at(A_DES * n + nb, -give * hL(Tw));
              mV += give;
              H += give * hV(Tw);
              addF_at(A_HSRC * n + nb, -give * (hV(Tw) - hL(Tw)) / dt);
              dew -= give;
            }
          }
        }
      }
    }
    cf[F_MN * n + c] = mN;
    cf[F_MO * n + c] = mO;
    cf[F_MV * n + c] = max(0.0, mV);
    cf[F_HG * n + c] = H;
  }
  let s1 = wsum(prod, lid);
  let s2 = wsum(cond, lid);
  let s3 = wsum(dew, lid);
  let s4 = wsum(ew, lid);
  let s5 = wsum(ea, lid);
  let s6 = wsum(ee, lid);
  if (lid == 0u) {
    if (s1 != 0.0) { addF_cnt(C_PRODUCED, s1); }
    if (s2 != 0.0) { addF_cnt(C_CONDENSED, s2); }
    if (s3 != 0.0) { addF_cnt(C_DEW, s3); }
    if (s4 != 0.0) { addF_cnt(C_ESC_WATER, s4); }
    if (s5 != 0.0) { addF_cnt(C_ESC_AIR, s5); }
    if (s6 != 0.0) { addF_cnt(C_ESC_ENERGY, s6); }
  }
}`},{name:"latentSrc",wg:te,bind:"P:u glob:r cf:r at:a",code:`${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:te,bind:"P:u cf:w cu:r reg:r",code:`${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let o = U_KIND * n;
  var ts = 0.0;
  if (cu[o + c] == LIQUID) {
    let i = ci(c);
    let j = cj(c);
    let surface = (j + 1 < i32(P.ny) && cu[o + c + P.nx] == GAS) || (i > 0 && cu[o + c - 1u] == GAS) || (i + 1 < i32(P.nx) && cu[o + c + 1u] == GAS) || (j > 0 && cu[o + c - P.nx] == GAS);
    if (surface) {
      let T = tSat(pAt(c));
      if (cf[F_PTL * n + c] > T) { ts = T; }
    }
  }
  cf[F_TS * n + c] = ts;
}`},{name:"flashVap",wg:te,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${ss}
${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let ts = cf[F_TS * n + c];
  var vap = 0.0;
  var vapH = 0.0;
  if (ts > 0.0) {
    let hs = hL(ts);
    let hv = hV(ts);
    let i = ci(c);
    let j = cj(c);
    for (var b = -1; b <= 1; b++) {
      let jj = j + b;
      if (jj < 0 || jj >= i32(P.ny)) { continue; }
      for (var a = -1; a <= 1; a++) {
        let ii = i + a;
        if (ii < 0 || ii >= i32(P.nx)) { continue; }
        let cc = cellOf(ii, jj);
        let st = cellStart(cc);
        let cn = ccount[cc];
        for (var k = 0u; k < cn; k++) {
          let pk = st + k;
          let h = parts[pk].h;
          if (h <= hs) { continue; }
          let w = wtAtI(pk, i, j);
          if (w == 0.0 || !aliveI(pk)) { continue; }
          let dmv = w * parts[pk].mass * (h - hs) / (hv - hs);
          vap += dmv;
          vapH += dmv * hv;
        }
      }
    }
  }
  cf[F_VAP * n + c] = vap;
  cf[F_VAPH * n + c] = vapH;
}`},{name:"flashParts",wg:te,bind:"P:u cnt:a cf:r parts:w",code:`${ss}
${ee} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if (!alive(q)) { return; }
  let n = P.n;
  var lost = 0.0;
  var lostE = 0.0;
  for (var k = 0; k < 9; k++) {
    let w = q.wt[k];
    if (w == 0.0) { continue; }
    let i = q.bi + k % 3;
    let j = q.bj + k / 3;
    if (!inGrid(i, j)) { continue; }
    let ts = cf[F_TS * n + cellOf(i, j)];
    if (ts == 0.0) { continue; }
    let hs = hL(ts);
    if (q.h <= hs) { continue; }
    let hv = hV(ts);
    let dmv = w * q.mass * (q.h - hs) / (hv - hs);
    lost += dmv;
    lostE += dmv * hv;
  }
  if (lost == 0.0) { return; }
  if (lost > 0.5 * q.mass) { lostE *= 0.5 * q.mass / lost; lost = 0.5 * q.mass; }
  let before = q.mass / q.rho;
  let m = q.mass - lost;
  q.h = (q.mass * q.h - lostE) / m;
  q.mass = m;
  q.T = tFromHL(q.h);
  q.rho = rhoL(q.T);
  q.dvp += m / q.rho - before;
  parts[p] = q;
}`},{name:"flashDist",wg:te,bind:"P:u cnt:a cf:r cu:r at:a",code:`${he}
${ee} {
  let c = gid.x;
  let lid = lid3.x;
  var made = 0.0;
  let n = P.n;
  if (c < n && cf[F_VAP * n + c] > 0.0) {
    let vap = cf[F_VAP * n + c];
    let vapH = cf[F_VAPH * n + c];
    let i = ci(c);
    let j = cj(c);
    let o = U_KIND * n;
    if (j + 1 < i32(P.ny) && cu[o + c + P.nx] == GAS) {
      addF_at(A_DV * n + c + P.nx, vap);
      addF_at(A_DH * n + c + P.nx, vapH);
    } else {
      var nbs = array<u32, 3>(NONE, NONE, NONE);
      var targets = 0.0;
      if (i > 0 && cu[o + c - 1u] == GAS) { nbs[0] = c - 1u; targets += 1.0; }
      if (i + 1 < i32(P.nx) && cu[o + c + 1u] == GAS) { nbs[1] = c + 1u; targets += 1.0; }
      if (j > 0 && cu[o + c - P.nx] == GAS) { nbs[2] = c - P.nx; targets += 1.0; }
      for (var k = 0; k < 3; k++) {
        if (nbs[k] == NONE) { continue; }
        addF_at(A_DV * n + nbs[k], vap / targets);
        addF_at(A_DH * n + nbs[k], vapH / targets);
      }
    }
    made = vap;
  }
  let sm = wsum(made, lid);
  if (lid == 0u && sm != 0.0) { addF_cnt(C_PRODUCED, sm); }
}`},{name:"fog",wg:te,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${ai}
${he}
fn tempWith(c: u32, mv: f32, mf: f32, Tin: f32) -> f32 {
  let n = P.n;
  let mN = cf[F_MN * n + c];
  let mO = cf[F_MO * n + c];
  let H = cf[F_HG * n + c];
  if (mf <= 0.0) { return gasTemperature(mN, mO, mv, H); }
  var T = Tin;
  for (var it = 0; it < 6; it++) {
    let dT = (H - gasEnthalpy(mN, mO, mv, mf, T)) / gasHeatCapacity(mN, mO, mv, mf, T);
    T += dT;
    if (abs(dT) < 1e-6) { break; }
  }
  return T;
}
fn satGap(c: u32, d: f32, nDry: f32, p: f32, Tin: f32) -> f32 {
  let n = P.n;
  let mv = cf[F_MV * n + c] - d;
  let mf = cf[F_MF * n + c] + d;
  let T = tempWith(c, mv, mf, Tin);
  let nv = mv / M_H2O;
  var pv = 0.0;
  if (nv + nDry > 0.0) { pv = nv / (nv + nDry) * p; }
  return pv - pSat(T);
}
${ee} {
  let c = gid.x;
  let lid = lid3.x;
  var made = 0.0;
  var err = 0.0;
  let n = P.n;
  if (c < n && cu[U_KIND * n + c] == GAS) {
    let mv = cf[F_MV * n + c];
    let mf = cf[F_MF * n + c];
    var go = mv > 0.0 || mf > 0.0;
    let nDry = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
    let p = pAt(c);
    let T0c = cf[F_T * n + c];
    if (go && mf <= 0.0) {
      let nv = mv / M_H2O;
      if (nv / (nv + nDry) * p < 0.999 * pSat(T0c)) { go = false; }
    }
    var d = 0.0;
    var setd = false;
    if (go) {
      let gap0 = satGap(c, 0.0, nDry, p, T0c);
      if (!(gap0 <= 0.0 && mf <= 0.0)) {
        var lo = 0.0; var hi = 0.0; var flo = 0.0; var fhi = 0.0;
        var done = false;
        if (gap0 > 0.0) {
          lo = 0.0; flo = gap0; hi = mv; fhi = satGap(c, hi, nDry, p, T0c);
        } else {
          hi = 0.0; fhi = gap0; lo = -mf; flo = satGap(c, lo, nDry, p, T0c);
          if (flo <= 0.0) { d = lo; setd = true; done = true; }
        }
        if (!done && fhi > 0.0) { d = hi; setd = true; done = true; }
        if (!done) {
          d = lo;
          var side = 0;
          for (var it = 0; it < 40; it++) {
            d = (lo * fhi - hi * flo) / (fhi - flo);
            if (!(d > min(lo, hi) && d < max(lo, hi))) { d = 0.5 * (lo + hi); }
            let f = satGap(c, d, nDry, p, T0c);
            if (abs(f) <= 1e-7 * p) { break; }
            if (f > 0.0) { lo = d; flo = f; if (side == 1) { fhi = fhi / 2.0; } side = 1; }
            else { hi = d; fhi = f; if (side == -1) { flo = flo / 2.0; } side = -1; }
          }
          setd = true;
        }
      }
    }
    if (setd && d != 0.0 && d == d) {
      let dd = clamp(d, -cf[F_MF * n + c], cf[F_MV * n + c]);
      cf[F_MV * n + c] -= dd;
      var nf = cf[F_MF * n + c] + dd;
      if (nf < 1e-30) { nf = 0.0; }
      cf[F_MF * n + c] = nf;
      made = dd;
      deriveCell(c);
      if (nf > 0.0) {
        let after = satGap(c, 0.0, nDry, p, cf[F_T * n + c]);
        err = abs(after) / pSat(cf[F_T * n + c]);
      }
    }
  }
  let sm = wsum(made, lid);
  let mx = wmax(err, lid);
  if (lid == 0u) {
    if (sm != 0.0) { addF_cnt(C_FOGMADE, sm); }
    maxU_cnt(C_FOGERR, mx);
  }
}`},{name:"films",wg:te,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_SOLID * n + c] == 0u) { return; }
  let full = glob[G_RHOREF] * P.vcell / 4.0;
  if (cf[F_FILM * n + c] < full) { return; }
  let i = ci(c);
  let j = cj(c);
  let o = U_KIND * n;
  var tgt = NONE;
  if (i > 0 && cu[o + c - 1u] == GAS) { tgt = c - 1u; }
  else if (i + 1 < i32(P.nx) && cu[o + c + 1u] == GAS) { tgt = c + 1u; }
  else if (j + 1 < i32(P.ny) && cu[o + c + P.nx] == GAS) { tgt = c + P.nx; }
  else if (j > 0 && cu[o + c - P.nx] == GAS) { tgt = c - P.nx; }
  if (tgt == NONE) { return; }
  let ti = ci(tgt);
  let tj = cj(tgt);
  let x = (f32(ti) + 0.5 + 0.25 * sign(f32(i - ti))) * P.dx;
  let y = (f32(tj) + 0.5 + 0.25 * sign(f32(j - tj))) * P.dx;
  let p = atomicAdd(&cnt[C_PCOUNT], 1u);
  if (p >= P.pcap) { atomicSub(&cnt[C_PCOUNT], 1u); atomicAdd(&cnt[C_PFULL], 1u); return; }
  let Tw = cf[F_T * n + c];
  var q: Particle;
  q.x = x; q.y = y; q.vx = 0.0; q.vy = 0.0; q.c00 = 0.0; q.c01 = 0.0; q.c10 = 0.0; q.c11 = 0.0;
  q.mass = full; q.h = hL(Tw); q.T = tFromHL(q.h); q.rho = rhoL(q.T); q.dvp = 0.0; q.flags = 0u;
  q.id = atomicAdd(&cnt[C_NEXTID_P], 1u);
  q.bi = i32(floor(x * P.invdx - 1.0));
  q.bj = i32(floor(y * P.invdx - 1.0));
  for (var k = 0; k < 9; k++) { q.wt[k] = 0.0; }
  q.wt[4] = 1.0;
  parts[p] = q;
  cf[F_FILM * n + c] -= full;
  cf[F_ES * n + c] -= full * hL(Tw);
}`}],Xo=[.125,.75,.125];function fu(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),a=Uint8Array.from(t.kind),c=new Uint8Array(e),l=new Uint8Array(e),f=new Uint32Array(e),u=new Float64Array(e),h=new Float64Array(e),m=Float32Array.from(t.T),g=o.heat.heaters.map(()=>0),d=new Float64Array(Math.max(1,o.regions.count)),p=o.bodies.list,x=new Uint8Array(e);for(let _=0;_<e;_+=1)t.owner[_]!==0&&t.matB[_]!==0&&(t.solid[_]!==0||t.fs[_]>.5)&&(x[_]=1);const w=(_,b)=>{if(x[_]!==0||x[b]!==0)return;const M=t.owner[_]!==0&&t.matB[_]!==0?t.fs[_]:-1,S=t.owner[b]!==0&&t.matB[b]!==0?t.fs[b]:-1;M<0&&S<0||(x[S>M?b:_]=1)};for(let _=0;_<n;_+=1)for(let b=1;b<s;b+=1)t.au[b+_*(s+1)]<=0&&w(b-1+_*s,b+_*s);for(let _=1;_<n;_+=1)for(let b=0;b<s;b+=1)t.av[b+_*s]<=0&&w(b+(_-1)*s,b+_*s);for(let _=0;_<e;_+=1){if(c[_]=t.solid[_],l[_]=t.kind[_],f[_]=t.role[_]===1&&t.heater[_]>=0?t.heater[_]+1:0,u[_]=t.Es[_],h[_]=t.film[_],x[_]===0)continue;const b=t.owner[_],M=t.solid[_]!==0,S=p[b-1],P=t.matB[_]-1,T=ut[P];if(r[_]=1,!M){const L=o.regions.id[_];L>=0&&(d[L]+=(1-t.fs[_])*t.vCell)}c[_]=P+1,l[_]=ft;const O=t.Ts[_]>0?t.Ts[_]:Rr(t.Es[_],t.capB[_],t.film[_],t.crust[_],t.T[_]);u[_]=T.rho*T.cp*t.vCell*(O-st)+t.film[_]*Ft(O),m[_]=O,S!==void 0&&S.heater>=0&&S.heater<g.length&&(f[_]=S.heater+1,g[S.heater]+=1)}for(let _=0;_<e;_+=1)r[_]===0&&f[_]>0&&f[_]<=g.length&&(g[f[_]-1]+=1);const y=(_,b)=>_<0?t.openL?0:1:_>=s?t.openR?0:1:b<0?t.openB?0:1:b>=n?t.openT?0:1:c[_+b*s]!==0?1:0,A=new Float32Array(e),F=new Float32Array(e);for(let _=0;_<n;_+=1)for(let b=0;b<s;b+=1){const M=b+_*s;if(c[M]!==0){A[M]=1;continue}let S=0;for(let P=-1;P<=1;P+=1)for(let T=-1;T<=1;T+=1)S+=Xo[T+1]*Xo[P+1]*y(b+T,_+P);A[M]=S}const k=4;for(let _=0;_<n;_+=1)for(let b=0;b<s;b+=1){const M=b+_*s,S=c[M]!==0,P=(b+.5)*i,T=(_+.5)*i;let O=k*i;S||(t.openL||(O=Math.min(O,P)),t.openR||(O=Math.min(O,t.w-P)),t.openB||(O=Math.min(O,T)),t.openT||(O=Math.min(O,t.h-T)));for(let L=-k;L<=k;L+=1){const I=_+L;if(!(I<0||I>=n))for(let B=-k;B<=k;B+=1){const D=b+B;if(D<0||D>=s||c[D+I*s]!==0===S)continue;const R=Math.max(0,Math.abs(B)-.5)*i,V=Math.max(0,Math.abs(L)-.5)*i;O=Math.min(O,Math.hypot(R,V))}}F[M]=S?-O:O}return{body:r,kindCpu:a,solid:c,kind:l,hgrp:f,es:u,film:h,T:m,phiS:A,sdf:F,heaterCells:g,vFix:d}}function uu(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=ut[t.solid[n]-1],r=Rr(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],0,e.T[n]);e.Es[n]=nr(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const Fs=800,hu=24,Yo=6,Vt=4,Ts=16,Kt=256,Jo=`struct Levels { lv: array<Level, ${Ts}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,dn=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,$n=`${dn}
/* Grobe Stufe, Teil 1: Fläche, Schwerpunkt, Flächenterm, Dirichlet-Kopplungen der groben Zelle t. */
fn coarsen1(F: Level, C: Level, t: u32) {
  let I = t % C.nx;
  let J = t / C.nx;
  let c = I + 1u + (J + 1u) * C.stride;
  let hf = f32(F.h);
  let hc = f32(C.h);
  var area = 0.0;
  var mx = 0.0;
  var my = 0.0;
  var dH = 0.0;
  for (var b = 0u; b < 2u; b++) {
    let j = 2u * J + b;
    if (j >= F.ny) { continue; }
    for (var a = 0u; a < 2u; a++) {
      let i = 2u * I + a;
      if (i >= F.nx) { continue; }
      let f = i + 1u + (j + 1u) * F.stride;
      if (mgU[F.act + f] == 0u) { continue; }
      let A = mgF[F.area + f];
      area += A;
      mx += A * ((f32(a) - 0.5) * hf + mgF[F.ox + f] * hf);
      my += A * ((f32(b) - 0.5) * hf + mgF[F.oy + f] * hf);
      dH += mgF[F.dH + f];
    }
  }
  if (area <= 0.0) {
    mgU[C.act + c] = 0u;
    mgF[C.dH + c] = 0.0; mgF[C.dDx + c] = 0.0; mgF[C.dDy + c] = 0.0; mgF[C.gDx + c] = 0.0; mgF[C.gDy + c] = 0.0;
    mgF[C.ox + c] = 0.0; mgF[C.oy + c] = 0.0; mgF[C.area + c] = 0.0; mgF[C.eDx + c] = 0.5 * hc; mgF[C.eDy + c] = 0.5 * hc;
    return;
  }
  mgU[C.act + c] = 1u;
  mgF[C.area + c] = area / 4.0;
  let xc = mx / area;
  let yc = my / area;
  mgF[C.ox + c] = xc / hc;
  mgF[C.oy + c] = yc / hc;
  mgF[C.dH + c] = dH;
  var gDx = 0.0; var cDx = 0.0; var gDy = 0.0; var cDy = 0.0;
  for (var b = 0u; b < 2u; b++) {
    let j = 2u * J + b;
    if (j >= F.ny) { continue; }
    for (var a = 0u; a < 2u; a++) {
      let i = 2u * I + a;
      if (i >= F.nx) { continue; }
      let f = i + 1u + (j + 1u) * F.stride;
      if (mgU[F.act + f] == 0u) { continue; }
      let gx = mgF[F.gDx + f];
      if (gx > 0.0) {
        let xf = (f32(a) - 0.5) * hf + mgF[F.ox + f] * hf;
        gDx += gx;
        cDx += gx / (mgF[F.eDx + f] + abs(xf - xc));
      }
      let gy = mgF[F.gDy + f];
      if (gy > 0.0) {
        let yf = (f32(b) - 0.5) * hf + mgF[F.oy + f] * hf;
        gDy += gy;
        cDy += gy / (mgF[F.eDy + f] + abs(yf - yc));
      }
    }
  }
  mgF[C.gDx + c] = gDx;
  mgF[C.gDy + c] = gDy;
  mgF[C.dDx + c] = cDx;
  mgF[C.dDy + c] = cDy;
  mgF[C.eDx + c] = select(0.5 * hc, gDx / cDx, cDx > 0.0);
  mgF[C.eDy + c] = select(0.5 * hc, gDy / cDy, cDy > 0.0);
}
/* Teil 2: Flächen zwischen groben Zellen (Σ κL der feinen Flächen durch den Abstand der Schwerpunkte). */
fn coarsen2(F: Level, C: Level, t: u32) {
  let I = t % C.nx;
  let J = t / C.nx;
  let c = I + 1u + (J + 1u) * C.stride;
  let hc = f32(C.h);
  mgF[C.ax + c] = 0.0; mgF[C.gx + c] = 0.0; mgF[C.ay + c] = 0.0; mgF[C.gy + c] = 0.0;
  if (mgU[C.act + c] == 0u) { return; }
  if (I + 1u < C.nx && mgU[C.act + c + 1u] != 0u) {
    let i = 2u * I + 1u;
    var g = 0.0;
    if (i + 1u < F.nx) {
      for (var b = 0u; b < 2u; b++) {
        let j = 2u * J + b;
        if (j >= F.ny) { continue; }
        g += mgF[F.gx + i + 1u + (j + 1u) * F.stride];
      }
    }
    if (g > 0.0) {
      let d = hc * (1.0 + mgF[C.ox + c + 1u] - mgF[C.ox + c]);
      mgF[C.gx + c] = g;
      mgF[C.ax + c] = g / max(0.25 * hc, d);
    }
  }
  if (J + 1u < C.ny && mgU[C.act + c + C.stride] != 0u) {
    let j = 2u * J + 1u;
    var g = 0.0;
    if (j + 1u < F.ny) {
      for (var a = 0u; a < 2u; a++) {
        let i = 2u * I + a;
        if (i >= F.nx) { continue; }
        g += mgF[F.gy + i + 1u + (j + 1u) * F.stride];
      }
    }
    if (g > 0.0) {
      let d = hc * (1.0 + mgF[C.oy + c + C.stride] - mgF[C.oy + c]);
      mgF[C.gy + c] = g;
      mgF[C.ay + c] = g / max(0.25 * hc, d);
    }
  }
}
/* Teil 3: Diagonale; eine aktive Zelle ganz ohne Kopplung wird inaktiv. */
fn diagonalAt(L: Level, t: u32) {
  let c = interior(L, t);
  if (mgU[L.act + c] == 0u) { mgF[L.diag + c] = 1.0; mgF[L.inv + c] = 1.0; return; }
  let d = mgF[L.dH + c] + mgF[L.dDx + c] + mgF[L.dDy + c] + mgF[L.ax + c] + mgF[L.ax + c - 1u] + mgF[L.ay + c] + mgF[L.ay + c - L.stride];
  if (!(d > 0.0)) { mgU[L.act + c] = 0u; mgF[L.diag + c] = 1.0; mgF[L.inv + c] = 1.0; return; }
  mgF[L.diag + c] = d;
  mgF[L.inv + c] = 1.0 / d;
}
/* Teil 4: die Gewichte der Verlängerung für die feine Zelle t (bilinear; Dirichlet-Rand: fehlender Nachbar fällt weg, Wand: an die Mutter). */
fn weightsAt(F: Level, C: Level, t: u32) {
  let i = t % F.nx;
  let j = t / F.nx;
  let f = i + 1u + (j + 1u) * F.stride;
  let o = 4u * f;
  if (mgU[F.act + f] == 0u) {
    for (var k = 0u; k < 4u; k++) { mgF[C.pW + o + k] = 0.0; mgU[C.pIdx + o + k] = 0u; }
    return;
  }
  let I = i >> 1u;
  let J = j >> 1u;
  let di = select(-1, 1, (i & 1u) == 1u);
  let dj = select(-1, 1, (j & 1u) == 1u);
  let cs = i32(C.stride);
  let base = i32(I + 1u + (J + 1u) * C.stride);
  let a1 = u32(base + di);
  let a2 = u32(base + dj * cs);
  let a3 = u32(base + di + dj * cs);
  let okI = i32(I) + di >= 0 && i32(I) + di < i32(C.nx);
  let okJ = i32(J) + dj >= 0 && i32(J) + dj < i32(C.ny);
  let w1 = select(0.0, 3.0 / 16.0, okI && mgU[C.act + a1] != 0u);
  let w2 = select(0.0, 3.0 / 16.0, okJ && mgU[C.act + a2] != 0u);
  let w3 = select(0.0, 1.0 / 16.0, okI && okJ && mgU[C.act + a3] != 0u);
  let dir = mgF[F.dDx + f] + mgF[F.dDy + f] > 0.0;
  var w0 = select(1.0 - w1 - w2 - w3, 9.0 / 16.0, dir);
  if (mgU[C.act + u32(base)] == 0u) { w0 = 0.0; }
  mgU[C.pIdx + o] = u32(base); mgU[C.pIdx + o + 1u] = a1; mgU[C.pIdx + o + 2u] = a2; mgU[C.pIdx + o + 3u] = a3;
  mgF[C.pW + o] = w0; mgF[C.pW + o + 1u] = w1; mgF[C.pW + o + 2u] = w2; mgF[C.pW + o + 3u] = w3;
}
`,Se=`
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
fn cgConverged(slot: u32) -> bool {
  if (cgs[S_DONE] != 0u) { return true; }
  let bb = cgF(S_BB);
  if (!(bb > 0.0)) { return true; }
  return cgF(S_RR0 + slot) <= cgF(S_TOLSQ) * bb;
}
fn vConverged() -> bool { return cgConverged(cgs[S_CURK] & 1u); }
var<workgroup> wconv: u32;
fn convergedWG(lid: u32, slot: u32) -> bool {
  if (lid == 0u) { wconv = select(0u, 1u, cgConverged(slot)); }
  return workgroupUniformLoad(&wconv) != 0u;
}
`,We=`
const ROW_PQ: u32 = 0u;
const ROW_RR: u32 = 1u;
const ROW_RZ: u32 = 2u;
const ROW_BB: u32 = 3u;
fn pw() -> u32 { return (L.nx * L.ny + WG - 1u) / WG; }
var<workgroup> red: array<f32, WG>;
var<workgroup> red2: array<f32, WG>;
fn reduce2(a: f32, b: f32, lid: u32) -> vec2<f32> {
  red[lid] = a;
  red2[lid] = b;
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { red[lid] += red[lid + s]; red2[lid] += red2[lid + s]; }
    workgroupBarrier();
  }
  let r = vec2<f32>(red[0], red2[0]);
  workgroupBarrier();
  return r;
}
`,Zo=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,tc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,_t="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ee=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,sa=6,gs=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,$i=`
var<workgroup> wkey: atomic<u32>;
var<workgroup> kred: array<f32, WG>;
fn keyedAdd(lid: u32, r: u32, v: f32, part: u32) {
  if (lid == 0u) { atomicStore(&wkey, NONE); }
  workgroupBarrier();
  if (r != NONE) { atomicMin(&wkey, r); }
  workgroupBarrier();
  let r0 = atomicLoad(&wkey);
  kred[lid] = select(0.0, v, r == r0 && r != NONE);
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { kred[lid] += kred[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u && r0 != NONE && kred[0] != 0.0) { addF_csum(part * P.n0 + r0, kred[0]); }
  if (r != NONE && r != r0 && v != 0.0) { addF_csum(part * P.n0 + r, v); }
  workgroupBarrier();
}
fn csum_get(part: u32, r: u32) -> f32 { return getF_csum(part * P.n0 + r); }
`,Wi="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",du=[{name:"cgPrep1",wg:Kt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${dn}
${_t} {
  let t = gid.x;
  if (t == 0u) {
    for (var k = 0u; k < 12u; k++) { cgs[k] = 0u; }
    cgs[S_CURK] = NONE;
    cgs[S_TOLSQ] = bitcast<u32>(SV.tolsq);
  }
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  if (mgU[L.act + s] == 0u) { mgF[L.ax + s] = 0.0; mgF[L.ay + s] = 0.0; return; }
  if (mgU[L.act + s + 1u] == 0u) { mgF[L.ax + s] = 0.0; }
  if (mgU[L.act + s + L.stride] == 0u) { mgF[L.ay + s] = 0.0; }
}`},{name:"cgPrep2",wg:Kt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Ee}
${$n}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${sa}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
  if (mgU[L.act + s] == 0u) {
    cgv[vi(V_XS, s)] = 0.0; cgv[vi(V_BS, s)] = 0.0;
    mgF[L.gx + s] = 0.0; mgF[L.gy + s] = 0.0; mgF[L.gDx + s] = 0.0; mgF[L.gDy + s] = 0.0;
    mgF[L.eDx + s] = 0.5; mgF[L.eDy + s] = 0.5; mgF[L.area + s] = 0.0; mgF[L.ox + s] = 0.0; mgF[L.oy + s] = 0.0;
    atomicStore(&lab[s], NONE);
    return;
  }
  atomicStore(&lab[s], s);
  mgF[L.gx + s] = mgF[L.ax + s]; mgF[L.gy + s] = mgF[L.ay + s];
  mgF[L.gDx + s] = 0.5 * mgF[L.dDx + s]; mgF[L.gDy + s] = 0.5 * mgF[L.dDy + s];
  mgF[L.eDx + s] = 0.5; mgF[L.eDy + s] = 0.5; mgF[L.area + s] = 1.0; mgF[L.ox + s] = 0.0; mgF[L.oy + s] = 0.0;
}`},{name:"cclMerge",wg:Kt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
  var r = x;
  for (var k = 0u; k < 4096u; k++) { let p = atomicLoad(&lab[r]); if (p == r) { break; } r = p; }
  if (r != x) { atomicMin(&lab[x], r); }
  return r;
}
fn unite(a: u32, b: u32) {
  var ra = find(a);
  var rb = find(b);
  for (var k = 0u; k < 4096u; k++) {
    if (ra == rb) { return; }
    if (ra > rb) { let t = ra; ra = rb; rb = t; }
    let old = atomicMin(&lab[rb], ra);
    if (old == rb) { return; }
    rb = find(old);
    ra = find(ra);
  }
}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:Kt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Ee}
${$i}
${gs}
${_t} {
  let t = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var b = 0.0;
  var anch = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    if (mgU[L.act + s] != 0u) {
      r = s;
      for (var k = 0u; k < 4096u; k++) { let p = atomicLoad(&lab[r]); if (p == r) { break; } r = p; }
      atomicStore(&lab[s], r);
      b = cgv[vi(V_BS, s)];
      if (mgF[L.dH + s] > 0.0 || mgF[L.dDx + s] > 0.0 || mgF[L.dDy + s] > 0.0) { anch = 1.0; }
    }
  }
  keyedAdd(lid, r, b, CS_B);
  keyedAdd(lid, r, 1.0, CS_N);
  keyedAdd(lid, r, anch, CS_ANCH);
}`},{name:"cclProject",wg:Kt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ee}
${Wi}
${gs}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Kt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Ee}
${dn}
${We}
${_t} {
  let t = gid.x;
  let lid = lid3.x;
  var rr = 0.0;
  var bb = 0.0;
  if (t < L.nx * L.ny) {
    let s = interior(L, t);
    var r = 0.0;
    if (mgU[L.act + s] != 0u) {
      let b = cgv[vi(V_BS, s)];
      let st = L.stride;
      let o = V_XS * P.n0;
      let ax = mgF[L.diag + s] * cgv[o + s] - mgF[L.ax + s] * cgv[o + s + 1u] - mgF[L.ax + s - 1u] * cgv[o + s - 1u]
        - mgF[L.ay + s] * cgv[o + s + st] - mgF[L.ay + s - st] * cgv[o + s - st];
      r = b - ax;
      bb = b * b;
      rr = r * r;
    }
    mgF[L.b + s] = r;
    mgF[L.x + s] = 0.0;
  }
  let sums = reduce2(rr, bb, lid);
  if (lid == 0u) {
    let n = pw();
    cgp[ROW_RR * n + wid3.x] = sums.x;
    cgp[ROW_BB * n + wid3.x] = sums.y;
  }
}`},{name:"cgFoldInitMG",wg:Kt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${We}
${tc}
${_t} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Ee}
${Se}
${We}
${Zo}
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let t = gid.x;
  /* r·z dieser Iteration aus den Teilsummen (nach dem V-Zyklus); die erste Arbeitsgruppe legt es für cgB und die nächste Iteration ab. */
  let rzk = foldRow(ROW_RZ, lid);
  if (t == 0u) { putF(S_RZ0 + k % 3u, rzk); }
  var beta = 0.0;
  if (k > 0u) { beta = rzk / cgF(S_RZ0 + (k + 2u) % 3u); }
  let pn = select(V_P1, V_P0, (k & 1u) == 0u);
  let po = select(V_P0, V_P1, (k & 1u) == 0u);
  var pq = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    let st = L.stride;
    let ob = po * P.n0;
    let p = mgF[L.x + s] + select(beta * cgv[ob + s], 0.0, k == 0u);
    let pe = mgF[L.x + s + 1u] + select(beta * cgv[ob + s + 1u], 0.0, k == 0u);
    let pw_ = mgF[L.x + s - 1u] + select(beta * cgv[ob + s - 1u], 0.0, k == 0u);
    let pnn = mgF[L.x + s + st] + select(beta * cgv[ob + s + st], 0.0, k == 0u);
    let ps = mgF[L.x + s - st] + select(beta * cgv[ob + s - st], 0.0, k == 0u);
    var q = 0.0;
    let act = mgU[L.act + s] != 0u;
    if (act) { q = mgF[L.diag + s] * p - mgF[L.ax + s] * pe - mgF[L.ax + s - 1u] * pw_ - mgF[L.ay + s] * pnn - mgF[L.ay + s - st] * ps; }
    cgv[vi(pn, s)] = select(0.0, p, act);
    cgv[vi(V_Q, s)] = q;
    pq = select(0.0, p * q, act);
  }
  let sum = reduce2(pq, 0.0, lid);
  if (lid == 0u) { cgp[ROW_PQ * pw() + wid3.x] = sum.x; }
}`},{name:"cgB",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Ee}
${Se}
${We}
${Zo}
var<workgroup> wpq: f32;
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let t = gid.x;
  let pqs = foldRow(ROW_PQ, lid);
  if (lid == 0u) { wpq = pqs; }
  let pq = workgroupUniformLoad(&wpq);
  if (!(pq > 0.0)) {
    if (t == 0u) { cgs[S_DONE] = 1u; }
    return;
  }
  let alpha = cgF(S_RZ0 + k % 3u) / pq;
  let pn = select(V_P1, V_P0, (k & 1u) == 0u);
  var rr = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    atomicStore(&csum[(4u + ((k + 1u) & 1u)) * P.n0 + s], 0u);
    if (mgU[L.act + s] != 0u) {
      cgv[vi(V_XS, s)] += alpha * cgv[vi(pn, s)];
      let r = mgF[L.b + s] - alpha * cgv[vi(V_Q, s)];
      mgF[L.b + s] = r;
      rr = r * r;
    }
  }
  let sums = reduce2(rr, 0.0, lid);
  if (lid == 0u) { cgp[ROW_RR * pw() + wid3.x] = sums.x; }
}`},{name:"cgFoldRR",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Se}
${We}
${tc}
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Se}
${We}
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let t = gid.x;
  var rz = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    if (mgU[L.act + s] != 0u) { rz = mgF[L.b + s] * mgF[L.x + s]; }
  }
  let sum = reduce2(rz, 0.0, lid);
  if (lid == 0u) { cgp[ROW_RZ * pw() + wid3.x] = sum.x; }
}`},{name:"cgZSum",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Se}
${$i}
${gs}
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let t = gid.x;
  var r = NONE;
  var z = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    if (mgU[L.act + s] != 0u && free(lab[s])) { r = lab[s]; z = mgF[L.x + s]; }
  }
  keyedAdd(lid, r, z, CS_Z0 + (k & 1u));
}`},{name:"cgZSub",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Se}
${Wi}
${gs}
${We}
${_t} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let t = gid.x;
  var rz = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    if (mgU[L.act + s] != 0u) {
      var z = mgF[L.x + s];
      let r = lab[s];
      if (free(r)) { z -= csum_get(CS_Z0 + (k & 1u), r) / csum_get(CS_N, r); mgF[L.x + s] = z; }
      rz = mgF[L.b + s] * z;
    }
  }
  let sum = reduce2(rz, 0.0, lid);
  if (lid == 0u) { cgp[ROW_RZ * pw() + wid3.x] = sum.x; }
}`},{name:"cgEnd1",wg:Kt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Ee}
${$i}
${gs}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${_t} {
  let t = gid.x;
  let lid = lid3.x;
  let bb = cgF(S_BB);
  if (t == 0u) {
    let it = cgs[S_ITER];
    let rr = cgF(S_RR0 + (cgs[S_CURK] & 1u));
    let ok = !(bb > 0.0) || rr <= cgF(S_TOLSQ) * bb;
    atomicMax(&cnt[SV.it], it);
    if (!ok) { atomicAdd(&cnt[SV.cap], 1u); atomicAdd(&cnt[C_CAPPED], 1u); }
    if (bb > 0.0) { maxU_cnt(SV.res, sqrt(max(rr, 0.0) / bb)); }
  }
  var r = NONE;
  var x = 0.0;
  if (t < L.nx * L.ny) {
    let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
    if (mgU[L.act + s] == 0u || !(bb > 0.0)) { cgv[vi(V_XS, s)] = 0.0; }
    else if (free(lab[s])) { r = lab[s]; x = cgv[vi(V_XS, s)]; }
  }
  keyedAdd(lid, r, x, CS_X);
}`},{name:"cgEnd2",wg:Kt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ee}
${Wi}
${gs}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],mu=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function pu(o,t){const e=[];let s=0,n=0,i=o,r=t,a=1,c=0;for(;;){const f=i+2,u=(i+2)*(r+2),h={};for(const d of mu)h[d]=s,s+=u;const m=n;n+=u;let g=0;if(h.pW=0,e.length>0&&(h.pW=s,s+=4*c,g=n,n+=4*c),e.push({nx:i,ny:r,stride:f,size:u,h:a,f:h,act:m,pIdx:g}),i*r<=hu||i<=2&&r<=2||e.length>=Ts)break;c=u,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let f=0;f<e.length;f+=1){let u=0;for(let h=f;h<e.length;h+=1)u+=e[h].size;if(u<=Fs){l=f;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function En(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const na={tol:1e-5,it:K.IT_L,cap:K.CAP_L,res:K.RES_L},ia={tol:1e-5,it:K.IT_G,cap:K.CAP_G,res:K.RES_G},ra={tol:1e-5,it:K.IT_H,cap:K.CAP_H,res:K.RES_H},oa={tol:1e-5,it:K.IT_D,cap:K.CAP_D,res:K.RES_H},xs=200,pe=256;class gu{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);En(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(pe/4*n.length);for(let l=0;l<n.length;l+=1)En(l>0?n[l-1]:null,l-1,r,pe/4*l),En(n[l],l,r,pe/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*Ts+4);for(let l=0;l<n.length;l+=1)En(n[l],l,a,32*l);a[32*Ts]=e.lt,a[32*Ts+1]=n.length,this.lv=t.uniform("lv",a.buffer);const c=new Uint32Array(pe/4*(xs+1));for(let l=0;l<xs;l+=1)c[pe/4*l]=l;c[pe/4*xs]=4294967295,this.it=t.uniform("iter",c.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(pe*4));for(const l of[na,ia,ra,oa])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,pe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,pe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:pe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,pe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,f)=>{const u={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,f,u),this.run(t,"cgZSub",r,f,u)):this.run(t,"cgRZ",r,f,u)};this.vcycle(t),a(xs,`k${xs}`);const c=Math.min(xs,Math.max(1,s));for(let l=0;l<c;l+=1){const f={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,f),this.run(t,"cgB",r,`k${l}`,f),this.one(t,"cgFoldRR",`k${l}`,f),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Ss=16,ec=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class xu{constructor(t,e){v(this,"stair",null);v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=pu(s.nx,s.ny);const r=(c,l,f=ec)=>{const u=t.buffer(c,4*Math.max(4,l),f);return this.own.push(u),u};this.params=r("params",Vo,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Ps),this.cnt=r("cnt",ts),this.cf=r("cf",Ri*i.n),this.cu=r("cu",Ei*i.n),this.at=r("at",Di*i.n),this.ff=r("ff",Vi*i.nf),this.fu=r("fu",Do*i.nf),this.af=r("af",Ni*i.nf),this.partsA=r("partsA",ds*i.pcap),this.partsB=r("partsB",ds*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,ec|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",ms*i.bcap),this.bubs2=r("bubs2",ms*i.bcap),this.bacc=r("bacc",pr*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",Gi*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Fe*i.nreg),this.racc=r("racc",hr*i.nreg),this.heat=r("heat",xe*i.nheat),this.hacc=r("hacc",dr*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",ta),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",sa*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",Ss*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*Vo),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[it],t.ambientY[ot],t.ambientY[Q],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let c=0;for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]===0&&(c=1);i[40]=c,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(xe*this.d.nheat);s.forEach((i,r)=>{var c;const a=xe*r;n[a+Ut.MODE]=i.mode==="thermostat"?1:0,n[a+Ut.POWER]=i.power,n[a+Ut.TARGET]=i.target,n[a+Ut.ON]=i.on?1:0,n[a+Ut.P]=i.P,n[a+Ut.TMEAN]=i.Tmean,n[a+Ut.INTEGRAL]=i.integral,n[a+Ut.CELLS]=e!==null?e[r]??0:((c=this.stair)==null?void 0:c.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*xe*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n,r=fu(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r.heaterCells);const a=t.regions,c=Array.from({length:a.count},(q,$)=>$).sort((q,$)=>a.vFluid[$]-a.vFluid[q]);this.regionMap=new Int32Array(Math.max(1,a.count)),this.regionInv=new Int32Array(Math.max(1,a.count)),c.forEach((q,$)=>{this.regionMap[q]=$,this.regionInv[$]=q});const l=new Float32Array(Fe*s.nreg);for(let q=0;q<a.count;q+=1){const $=Fe*this.regionMap[q];l[$+Qt.OPEN]=a.open[q],l[$+Qt.VFLUID]=a.vFluid[q]-r.vFix[q],l[$+Qt.P0]=a.p0[q],l[$+Qt.RHOBAR]=a.rhoBar[q],l[$+Qt.VLIQ]=a.vLiq[q],l[$+Qt.VBUB]=a.vBub[q],l[$+Qt.VGAS]=a.vGas[q],l[$+Qt.P0START]=a.p0[q]}e.writeBuffer(this.reg,0,l);const f=new Uint32Array(Ei*i);for(let q=0;q<i;q+=1){f[Ke.KIND*i+q]=r.kind[q],f[Ke.KPREV*i+q]=r.kind[q],f[Ke.SOLID*i+q]=r.solid[q],f[Ke.HGRP*i+q]=r.hgrp[q];const $=a.id[q];f[Ke.RID*i+q]=$<0?Ui:this.regionMap[$]}e.writeBuffer(this.cu,0,f);const u=new Float32Array(Ri*i),h=(q,$,U=0)=>{for(let G=0;G<i;G+=1)u[q*i+G]=$[U+G]};h(nt.PHI,n.phi),h(nt.ALPHA,n.alpha),h(nt.ALPHAOLD,n.alpha),h(nt.PL,n.pl),h(nt.PG,n.pg),h(nt.MN,n.mg,it*i),h(nt.MO,n.mg,ot*i),h(nt.MV,n.mg,Q*i),h(nt.MF,n.mfog),h(nt.HG,n.Hg),h(nt.ES,r.es),h(nt.FILM,r.film),h(nt.T,r.T),h(nt.TL,n.Tl),h(nt.CL,n.Cl);const m=t.gas;h(nt.VGAS,m.vgas),h(nt.RHO,m.rho),h(nt.NMOL,m.nmol),h(nt.CAP,m.cap),h(nt.MU,m.mu),h(nt.VEOS,m.veos),h(nt.SRCV,m.srcV),h(nt.VEOSMID,m.veosMid),h(nt.PHIS,r.phiS),h(nt.SDF,r.sdf),h(nt.PTL,r.T),e.writeBuffer(this.cf,0,u);const g=new Float32Array(Di*i);for(let q=0;q<i;q+=1)g[mr.VOLSRC*i+q]=t.liquid.volSrc[q];e.writeBuffer(this.at,0,g);const d=s.nf,p=new Float32Array(Vi*d);for(let q=0;q<s.nu;q+=1)p[Pe.UL*d+q]=n.ul[q],p[Pe.UG*d+q]=n.ug[q];for(let q=0;q<s.nv;q+=1)p[Pe.UL*d+s.nu+q]=n.vl[q],p[Pe.UG*d+s.nu+q]=n.vg[q];e.writeBuffer(this.ff,0,p),e.writeBuffer(this.fu,0,new Uint32Array(Do*d));const x=new Float32Array(Ni*d);for(let q=0;q<s.nu;q+=1)x[q]=t.liquid.fU[q];for(let q=0;q<s.nv;q+=1)x[s.nu+q]=t.liquid.fV[q];e.writeBuffer(this.af,0,x);const w=t.particles,y=t.liquid,A=new ArrayBuffer(4*ds*Math.max(1,w.count)),F=new Float32Array(A),k=new Uint32Array(A),_=new Int32Array(A);for(let q=0;q<w.count;q+=1){const $=ds*q;F.set([w.x[q],w.y[q],w.vx[q],w.vy[q],w.c00[q],w.c01[q],w.c10[q],w.c11[q],w.mass[q],w.h[q],w.T[q],w.rho[q],y.dVp[q]],$),k[$+13]=0,k[$+14]=w.id[q],_[$+15]=y.bi[q],_[$+16]=y.bj[q];for(let U=0;U<9;U+=1)F[$+17+U]=y.wt[9*q+U]}w.count>0&&e.writeBuffer(this.partsA,0,A);const b=t.bubbles,M=t.bubbleModel.motionState,S=new ArrayBuffer(4*ms*Math.max(1,b.count)),P=new Float32Array(S),T=new Uint32Array(S),O=new Int32Array(S);for(let q=0;q<b.count;q+=1){const $=ms*q,U=q*at;P.set([b.x[q],b.y[q],b.z[q],b.vx[q],b.vy[q],b.m[U+it],b.m[U+ot],b.m[U+Q],b.H[q],b.age[q]],$),O[$+10]=b.site[q],P.set([b.r[q],b.V[q],b.pb[q],b.pv[q],b.Tb[q],b.dmdt[q],M.ux0[q],M.uy0[q]],$+11),T[$+19]=b.id[q],T[$+20]=1;for(let G=0;G<oe;G+=1)P[$+21+G]=b.force[q*oe+G]}b.count>0&&e.writeBuffer(this.bubs,0,S);const L=t.bubbleModel.cavities;this.nsites=L.count;const I=new ArrayBuffer(4*Gi*s.nsites),B=new Uint32Array(I),D=new Float32Array(I),R=n.nx;for(let q=0;q<L.count;q+=1){const $=Gi*q;let U=L.cell[q],G=L.r[q];if(U>=0&&r.solid[U]===0){const tt=L.dir[q],pt=tt===0?U+1:tt===1?U-1:tt===2?U+R:U-R;pt>=0&&pt<i&&r.solid[pt]!==0?U=pt:G=1e-9}B.set([U,L.fluid[q],L.dir[q],0],$),D.set([G,L.s[q],L.z[q],0],$+4)}e.writeBuffer(this.sites,0,I);const V=new Uint32Array(s.nsites);for(let q=0;q<L.count;q+=1)V[q]=L.bubble[q];e.writeBuffer(this.sbub,0,V);const W=new Float32Array(Ps);W[_s.DT]=t.dt,W[_s.TIME]=t.time,W[_s.RHOREF]=y.rhoRef,e.writeBuffer(this.glob,0,W);const N=new Uint32Array(ts),Y=new Float32Array(N.buffer);N[K.PCOUNT]=w.count,N[K.PSORT]=w.count,N[K.BCOUNT]=b.count,N[K.NEXTID_B]=Math.max(1,b.nextFree),N[K.NEXTID_P]=Math.max(1,w.nextFree);const J=t.bubbleModel;N[K.WATCH]=J.watch>=0?J.watch:Ui,N[K.WATCH_FATE]=J.watchFate,J.firstSuperheat!==null&&(Y[K.FIRST_SH]=J.firstSuperheat+1e3,N[K.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,N),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(pr*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(hr*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(dr*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(f=>Math.ceil(f.size/4)*4),n=s.reduce((f,u)=>f+u,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((f,u)=>{s[u]>0&&r.copyBufferToBuffer(f.buf,f.offset,i,a,s[u]),a+=s[u]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const c=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const f of s)l.push(c.slice(a,a+f)),a+=f;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,c,l,f,u,h,m]=await this.read([{buf:this.cnt,offset:0,size:4*ts},{buf:this.glob,offset:0,size:4*Ps},{buf:this.cf,offset:0,size:4*Ri*s},{buf:this.cu,offset:0,size:4*Ei*s},{buf:this.at,offset:0,size:4*Di*s},{buf:this.ff,offset:0,size:4*Vi*e.nf},{buf:this.af,offset:0,size:4*Ni*e.nf},{buf:this.heat,offset:0,size:4*xe*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Fe*e.nreg}]),g=new Uint32Array(n),d=Math.min(e.pcap,g[K.PCOUNT]),p=Math.min(e.bcap,g[K.BCOUNT]),[x,w]=await this.read([{buf:this.partsA,offset:0,size:4*ds*Math.max(1,d)},{buf:this.bubs,offset:0,size:4*ms*Math.max(1,p)}]),y=t.grid,A=new Float32Array(r),F=(C,E,j=0)=>{for(let X=0;X<s;X+=1)E[j+X]=A[C*s+X]};F(nt.PHI,y.phi),F(nt.ALPHA,y.alpha),F(nt.PL,y.pl),F(nt.PG,y.pg),F(nt.MN,y.mg,it*s),F(nt.MO,y.mg,ot*s),F(nt.MV,y.mg,Q*s),F(nt.MF,y.mfog),F(nt.HG,y.Hg),F(nt.ES,y.Es),F(nt.FILM,y.film),F(nt.T,y.T),F(nt.TL,y.Tl),F(nt.CL,y.Cl);const k=t.gas;F(nt.VGAS,k.vgas),F(nt.RHO,k.rho),F(nt.NMOL,k.nmol),F(nt.CAP,k.cap),F(nt.MU,k.mu),F(nt.VEOS,k.veos),F(nt.SRCV,k.srcV),F(nt.VEOSMID,k.veosMid);const _=new Uint32Array(a);for(let C=0;C<s;C+=1)y.kind[C]=_[Ke.KIND*s+C];const b=new Float32Array(c);for(let C=0;C<s;C+=1)t.liquid.volSrc[C]=b[mr.VOLSRC*s+C];const M=new Float32Array(l),S=new Float32Array(f),P=e.nf;for(let C=0;C<e.nu;C+=1)y.ul[C]=M[Pe.UL*P+C],y.ug[C]=M[Pe.UG*P+C],t.liquid.fU[C]=S[C];for(let C=0;C<e.nv;C+=1)y.vl[C]=M[Pe.UL*P+e.nu+C],y.vg[C]=M[Pe.UG*P+e.nu+C],t.liquid.fV[C]=S[e.nu+C];const T=t.particles,O=t.liquid,L=new Float32Array(x),I=new Uint32Array(x),B=new Int32Array(x);let D=0,R=0;for(let C=0;C<d;C+=1){const E=ds*C;if(I[E+13]&1||!(L[E+8]>0))continue;const j=D;D+=1,T.x[j]=L[E],T.y[j]=L[E+1],T.vx[j]=L[E+2],T.vy[j]=L[E+3],T.c00[j]=L[E+4],T.c01[j]=L[E+5],T.c10[j]=L[E+6],T.c11[j]=L[E+7],T.mass[j]=L[E+8],T.h[j]=L[E+9],T.spc[2*j]=0,T.spc[2*j+1]=0,T.smass[2*j]=0,T.smass[2*j+1]=0,T.mat[j]=0,T.id[j]=I[E+14],T.id[j]>R&&(R=T.id[j]),O.dVp[j]=L[E+12],O.bi[j]=B[E+15],O.bj[j]=B[E+16];for(let X=0;X<9;X+=1)O.wt[9*j+X]=L[E+17+X];T.derive(j)}T.count=D,T.reserveIds(Math.max(g[K.NEXTID_P],R+1)),O.weightsDirty=!0;const V=t.bubbles,W=t.bubbleModel.motionState,N=new Float32Array(w),Y=new Uint32Array(w),J=new Int32Array(w);V.count=0;let q=0;for(let C=0;C<p;C+=1){const E=ms*C;if(Y[E+20]===0)continue;const j=V.count;V.count+=1;const X=j*at;V.x[j]=N[E],V.y[j]=N[E+1],V.z[j]=N[E+2],V.vx[j]=N[E+3],V.vy[j]=N[E+4];for(let z=0;z<at;z+=1)V.m[X+z]=0;V.m[X+it]=N[E+5],V.m[X+ot]=N[E+6],V.m[X+Q]=N[E+7],V.H[j]=N[E+8],V.age[j]=N[E+9],V.site[j]=J[E+10],V.r[j]=N[E+11],V.V[j]=N[E+12],V.pb[j]=N[E+13],V.pv[j]=N[E+14],V.Tb[j]=N[E+15],V.dmdt[j]=N[E+16],W.ux0[j]=N[E+17],W.uy0[j]=N[E+18],V.id[j]=Y[E+19],V.id[j]>q&&(q=V.id[j]);for(let z=0;z<oe;z+=1)V.force[j*oe+z]=N[E+21+z]}V.reserveIds(Math.max(g[K.NEXTID_B],q+1));const $=t.bubbleModel.cavities,U=new Uint32Array(h);for(let C=0;C<$.count;C+=1)$.bubble[C]=U[C];const G=new Float32Array(m);for(let C=0;C<t.regions.count;C+=1){const E=Fe*this.regionMap[C];t.regions.p0[C]=G[E+Qt.P0],t.regions.rhoBar[C]=G[E+Qt.RHOBAR]}const tt=new Float32Array(u);t.heat.heaters.forEach((C,E)=>{const j=xe*E;C.P=tt[j+Ut.P],C.Tmean=tt[j+Ut.TMEAN],C.integral=tt[j+Ut.INTEGRAL]});const pt=new Float32Array(i);t.dt=pt[_s.DT];const wt=t.bubbleModel;wt.watch=g[K.WATCH]===Ui?-1:g[K.WATCH],uu(t,this.stair)}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const De=128,zt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",vu=5,sc=30,nc=`
fn sideG(open: bool, kc: f32) -> f32 {
  let half = 2.0 * kc * P.depth;
  if (open) { return half; }
  let hA = P.hext * P.dx * P.depth;
  if (hA <= 0.0 || half <= 0.0) { return 0.0; }
  return 1.0 / (1.0 / hA + 1.0 / half);
}
fn faceG(a: u32, b: u32) -> f32 {
  let n = P.n;
  if (!(cf[F_C * n + a] > 0.0) || !(cf[F_C * n + b] > 0.0)) { return 0.0; }
  let ka = cf[F_K * n + a];
  let kb = cf[F_K * n + b];
  if (!(ka + kb > 0.0)) { return 0.0; }
  return 2.0 * ka * kb / (ka + kb) * P.depth;
}
`,yu=[{name:"heaterSums",wg:De,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${zt} {
  /* Je Arbeitsgruppe: die (kleinste) Gruppe ihrer Heizzellen über die Arbeitsgruppe summiert, einmal atomar; andere Gruppen direkt. */
  let c = gid.x;
  let lid = lid3.x;
  var g = 0u;
  var T = 0.0;
  if (c < P.n) { g = cu[U_HGRP * P.n + c]; if (g > P.nheat) { g = 0u; } if (g != 0u) { T = cf[F_T * P.n + c]; } }
  if (lid == 0u) { atomicStore(&wkey, NONE); }
  workgroupBarrier();
  if (g != 0u) { atomicMin(&wkey, g); }
  workgroupBarrier();
  let g0 = atomicLoad(&wkey);
  let mine = g != 0u && g == g0;
  kt[lid] = select(0.0, T, mine);
  kn[lid] = select(0.0, 1.0, mine);
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { kt[lid] += kt[lid + s]; kn[lid] += kn[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u && g0 != NONE && kn[0] > 0.0) {
    let o = (g0 - 1u) * HACC_STRIDE;
    addF_hacc(o + HA_TSUM, kt[0]);
    atomicAdd(&hacc[o + HA_CELLS], u32(kn[0]));
  }
  if (g != 0u && g != g0) {
    let o = (g - 1u) * HACC_STRIDE;
    addF_hacc(o + HA_TSUM, T);
    atomicAdd(&hacc[o + HA_CELLS], 1u);
  }
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${zt} {
  let dt = glob[G_DT];
  for (var g = lid3.x; g < P.nheat; g += 64u) {
    let o = g * HEAT_STRIDE;
    let a = g * HACC_STRIDE;
    let cells = f32(atomicLoad(&hacc[a + HA_CELLS]));
    let Tm = select(0.0, getF_hacc(a + HA_TSUM) / cells, cells > 0.0);
    atomicStore(&hacc[a + HA_TSUM], 0u);
    atomicStore(&hacc[a + HA_CELLS], 0u);
    heat[o + H_TMEAN] = Tm;
    heat[o + H_CELLS] = cells;
    var Pw = 0.0;
    let power = heat[o + H_POWER];
    if (cells > 0.0) {
      if (heat[o + H_ON] == 0.0) { heat[o + H_INTEGRAL] = 0.0; }
      else if (heat[o + H_MODE] == 0.0) { Pw = power; }
      else {
        let kp = power / ${vu}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${sc}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${sc}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:De,bind:"P:u cnt:a parts:r",code:`${he}
${zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:De,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${ss}
${he}
${zt} {
  let c = gid.x;
  let lid = lid3.x;
  var hw = 0.0;
  let n = P.n;
  if (c < n) {
    let i = ci(c);
    let j = cj(c);
    var Cl = 0.0;
    var CTl = 0.0;
    for (var b = -1; b <= 1; b++) {
      let jj = j + b;
      if (jj < 0 || jj >= i32(P.ny)) { continue; }
      for (var a = -1; a <= 1; a++) {
        let ii = i + a;
        if (ii < 0 || ii >= i32(P.nx)) { continue; }
        let cc = cellOf(ii, jj);
        let st = cellStart(cc);
        let cn = ccount[cc];
        for (var k = 0u; k < cn; k++) {
          let pk = st + k;
          let w = wtAtI(pk, i, j);
          if (w == 0.0 || !aliveI(pk)) { continue; }
          let T = parts[pk].T;
          let Cp = parts[pk].mass * cpL(T);
          Cl += w * Cp;
          CTl += w * Cp * T;
        }
      }
    }
    let s = cu[U_SOLID * n + c];
    let T = cf[F_T * n + c];
    var cs = 0.0;
    var kc = 0.0;
    if (s != 0u) { cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_FILM * n + c] * cpL(T); kc = solidK(s); }
    var cg = 0.0;
    if (s == 0u && cf[F_CAP * n + c] > 0.0) { cg = cf[F_CAP * n + c]; }
    let sum = cs + cg + Cl;
    cf[F_CS * n + c] = cs;
    cf[F_CG * n + c] = cg;
    cf[F_C * n + c] = sum;
    cf[F_CL * n + c] = Cl;
    let src = at[A_HSRC * n + c];
    at[A_HSRC * n + c] = 0.0;
    if (sum <= 0.0) { cf[F_TSTAR * n + c] = T; cf[F_K * n + c] = 0.0; cf[F_Q * n + c] = 0.0; }
    else {
      let Ts = (cs * T + cg * T + CTl) / sum;
      cf[F_TSTAR * n + c] = Ts;
      if (Cl > 0.0) { cf[F_TL * n + c] = CTl / Cl; }
      if (s == 0u) {
        if (Cl >= cg) { kc = kL(Ts); } else { kc = kMix(cf[F_MN * n + c], cf[F_MO * n + c], cf[F_MV * n + c], Ts); }
      }
      cf[F_K * n + c] = kc;
      var qc = src;
      if (P.liquidPower != 0.0 && Cl > 0.0) {
        let tot = bitcast<f32>(atomicLoad(&cnt[C_SUM_CL]));
        if (tot > 0.0) { let w = P.liquidPower * Cl / tot; qc += w; hw += w; }
      }
      let g = cu[U_HGRP * n + c];
      if (g != 0u && g <= P.nheat) {
        let o = (g - 1u) * HEAT_STRIDE;
        let cells = heat[o + H_CELLS];
        if (cells > 0.0) { let w = heat[o + H_P] / cells; qc += w; hw += w; }
      }
      cf[F_Q * n + c] = qc;
    }
  }
  let sh = wsum(hw, lid);
  if (lid == 0u && sh != 0.0) { addF_cnt(C_HEATER_E, sh * glob[G_DT]); }
}`},{name:"heatAssemble",wg:De,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${nc}
${zt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let s = s0(c);
  mgF[L.ax + s] = 0.0; mgF[L.ay + s] = 0.0; mgF[L.dH + s] = 0.0; mgF[L.dDx + s] = 0.0; mgF[L.dDy + s] = 0.0;
  cgv[s] = 0.0;
  let C = cf[F_C * n + c];
  if (!(C > 0.0)) { mgU[L.act + s] = 0u; cgv[P.n0 + s] = 0.0; return; }
  mgU[L.act + s] = 1u;
  mgF[L.dH + s] = C / glob[G_DT];
  let i = ci(c);
  let j = cj(c);
  let Tc = cf[F_TSTAR * n + c];
  var b = cf[F_Q * n + c];
  let ot = F_TSTAR * n;
  if (i + 1 < i32(P.nx)) { let g = faceG(c, c + 1u); mgF[L.ax + s] = g; b += g * (cf[ot + c + 1u] - Tc); }
  if (i > 0) { b += faceG(c - 1u, c) * (cf[ot + c - 1u] - Tc); }
  if (j + 1 < i32(P.ny)) { let g = faceG(c, c + P.nx); mgF[L.ay + s] = g; b += g * (cf[ot + c + P.nx] - Tc); }
  if (j > 0) { b += faceG(c - P.nx, c) * (cf[ot + c - P.nx] - Tc); }
  let kc = cf[F_K * n + c];
  var Gb = 0.0;
  if (i == 0) { Gb += sideG(P.openL != 0u, kc); }
  if (i == i32(P.nx) - 1) { Gb += sideG(P.openR != 0u, kc); }
  if (j == 0) { Gb += sideG(P.openB != 0u, kc); }
  if (j == i32(P.ny) - 1) { Gb += sideG(P.openT != 0u, kc); }
  if (Gb > 0.0) { mgF[L.dDx + s] = Gb; b += Gb * (P.tamb - Tc); }
  cgv[P.n0 + s] = b;
}`},{name:"heatFlux",wg:De,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${nc}
${ai}
${he}
fn tn(c: u32) -> f32 {
  let n = P.n;
  if (cf[F_C * n + c] > 0.0) { return cf[F_TSTAR * n + c] + cgv[s0(c)]; }
  return cf[F_T * n + c];
}
/* Energie F floss von einer Zelle der Art b in eine der Art a (wie Heat.pair): Feststoff→Flüssigkeit, Flüssigkeit→Gas, Feststoff→Gas. */
fn pairOf(a: u32, b: u32, F: f32) -> vec3<f32> {
  if (a == SOLID && b == LIQUID) { return vec3<f32>(-F, 0.0, 0.0); }
  if (a == LIQUID && b == SOLID) { return vec3<f32>(F, 0.0, 0.0); }
  if (a == LIQUID && b == GAS) { return vec3<f32>(0.0, -F, 0.0); }
  if (a == GAS && b == LIQUID) { return vec3<f32>(0.0, F, 0.0); }
  if (a == SOLID && b == GAS) { return vec3<f32>(0.0, 0.0, -F); }
  if (a == GAS && b == SOLID) { return vec3<f32>(0.0, 0.0, F); }
  return vec3<f32>(0.0);
}
${zt} {
  let c = gid.x;
  let lid = lid3.x;
  var walls = 0.0; var open = 0.0; var solids = 0.0;
  var pairs = vec3<f32>(0.0);
  let n = P.n;
  if (c < n && cf[F_C * n + c] > 0.0) {
    let dt = glob[G_DT];
    let i = ci(c);
    let j = cj(c);
    let Tc = tn(c);
    var dE = cf[F_Q * n + c] * dt;
    let ok = U_KIND * n;
    if (i + 1 < i32(P.nx)) {
      let g = faceG(c, c + 1u);
      if (g > 0.0) { let F = g * (tn(c + 1u) - Tc) * dt; dE += F; if (cu[ok + c] != cu[ok + c + 1u]) { pairs += pairOf(cu[ok + c], cu[ok + c + 1u], F); } }
    }
    if (i > 0) { let g = faceG(c - 1u, c); if (g > 0.0) { dE += g * (tn(c - 1u) - Tc) * dt; } }
    if (j + 1 < i32(P.ny)) {
      let g = faceG(c, c + P.nx);
      if (g > 0.0) { let F = g * (tn(c + P.nx) - Tc) * dt; dE += F; if (cu[ok + c] != cu[ok + c + P.nx]) { pairs += pairOf(cu[ok + c], cu[ok + c + P.nx], F); } }
    }
    if (j > 0) { let g = faceG(c - P.nx, c); if (g > 0.0) { dE += g * (tn(c - P.nx) - Tc) * dt; } }
    let kc = cf[F_K * n + c];
    let solid = cu[U_SOLID * n + c] != 0u;
    for (var side = 0u; side < 4u; side++) {
      let at = (side == 0u && i == 0) || (side == 1u && i == i32(P.nx) - 1) || (side == 2u && j == 0) || (side == 3u && j == i32(P.ny) - 1);
      if (!at) { continue; }
      let op = sideOpen(side);
      let F = sideG(op, kc) * (Tc - P.tamb) * dt;
      dE -= F;
      if (op) { open += F; } else { walls += F; }
      if (solid) { solids += F; }
    }
    let C = cf[F_C * n + c];
    let share = dE / C;
    cf[F_SHARE * n + c] = share;
    let Cs = cf[F_CS * n + c];
    if (Cs > 0.0) { cf[F_ES * n + c] += share * Cs; deriveSolid(c); }
    let Cg = cf[F_CG * n + c];
    if (Cg > 0.0) { cf[F_HG * n + c] += share * Cg; deriveCell(c); }
  } else if (c < n) { cf[F_SHARE * n + c] = 0.0; }
  let sw = wsum(walls, lid);
  let so = wsum(open, lid);
  let ss = wsum(solids, lid);
  let p0 = wsum(pairs.x, lid);
  let p1 = wsum(pairs.y, lid);
  let p2 = wsum(pairs.z, lid);
  if (lid == 0u) {
    if (sw != 0.0) { addF_cnt(C_LOSS_WALLS, sw); }
    if (so != 0.0) { addF_cnt(C_LOSS_OPEN, so); }
    if (ss != 0.0) { addF_cnt(C_LOSS_SOLIDS, ss); }
    if (p0 != 0.0) { addF_cnt(C_FLUX_SL, p0); }
    if (p1 != 0.0) { addF_cnt(C_FLUX_LG, p1); }
    if (p2 != 0.0) { addF_cnt(C_FLUX_SG, p2); }
  }
}`},{name:"heatParts",wg:De,bind:"P:u cnt:a cf:r parts:w",code:`${ss}
${zt} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if (!alive(q)) { return; }
  let n = P.n;
  var dT = 0.0;
  for (var k = 0; k < 9; k++) {
    let w = q.wt[k];
    if (w == 0.0) { continue; }
    let i = q.bi + k % 3;
    let j = q.bj + k / 3;
    if (!inGrid(i, j)) { continue; }
    let c = cellOf(i, j);
    if (cf[F_C * n + c] > 0.0) { dT += w * cf[F_SHARE * n + c]; }
  }
  if (dT == 0.0) { return; }
  let before = q.mass / q.rho;
  q.h += cpL(q.T) * dT;
  q.T = tFromHL(q.h);
  q.rho = rhoL(q.T);
  q.dvp += q.mass / q.rho - before;
  parts[p] = q;
}`},{name:"heatShare",wg:De,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${ss}
${zt} {
  let c = gid.x;
  let n = P.n;
  if (c >= n) { return; }
  let ok = U_KIND * n;
  let kind = cu[ok + c];
  if (kind != LIQUID) {
    if (kind != GAS) { return; }
    let i = ci(c);
    let j = cj(c);
    let surface = (i > 0 && cu[ok + c - 1u] == LIQUID) || (i + 1 < i32(P.nx) && cu[ok + c + 1u] == LIQUID)
      || (j > 0 && cu[ok + c - P.nx] == LIQUID) || (j + 1 < i32(P.ny) && cu[ok + c + P.nx] == LIQUID);
    if (!surface) { return; }
  }
  let cn = ccount[c];
  if (cn < 2u) { return; }
  let st = cellStart(c);
  var C = 0.0;
  var CT = 0.0;
  var CA = 0.0;
  for (var k = 0u; k < cn; k++) {
    let pk = st + k;
    if (!aliveI(pk)) { continue; }
    let T = parts[pk].T;
    let cp = cpL(T);
    let Cp = parts[pk].mass * cp;
    C += Cp;
    CT += Cp * T;
    CA += Cp * kL(T) / (parts[pk].rho * cp);
  }
  if (!(C > 0.0)) { return; }
  let f = 1.0 - exp(-PI * PI * glob[G_DT] * P.invdx * P.invdx * CA / C);
  let Tm = CT / C;
  for (var k = 0u; k < cn; k++) {
    let pk = st + k;
    if (!aliveI(pk)) { continue; }
    var q = parts[pk];
    let dT = f * (Tm - q.T);
    if (dT == 0.0) { continue; }
    let before = q.mass / q.rho;
    q.h += cpL(q.T) * dT;
    q.T = tFromHL(q.h);
    q.rho = rhoL(q.T);
    q.dvp += q.mass / q.rho - before;
    parts[pk] = q;
  }
}`},{name:"pwParts",wg:De,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${zt} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if ((q.flags & 1u) != 0u || !(q.mass > 0.0)) { return; }
  let r = cu[U_RID * P.n + cellAt(q.x, q.y)];
  if (r == NONE) { return; }
  let dp = reg[r * REG_STRIDE + R_DP0];
  if (dp == 0.0 || reg[r * REG_STRIDE + R_OPEN] != 0.0) { return; }
  let before = q.mass / q.rho;
  q.h += before * dp / q.mass;
  q.T = tFromHL(q.h);
  q.rho = rhoL(q.T);
  q.dvp += q.mass / q.rho - before;
  parts[p] = q;
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${zt} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  var B = bubs[b];
  if (B.alive == 0u) { return; }
  let c = cellAtN(B.x, B.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r == NONE || reg[r * REG_STRIDE + R_OPEN] != 0.0) { return; }
  let dp = reg[r * REG_STRIDE + R_DP0];
  if (dp != 0.0) { B.H += B.V * dp; bubs[b] = B; }
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${zt} {
  if (gid.x != 0u) { return; }
  let dt = glob[G_DT];
  glob[G_TIME] += dt;
  addF_cnt(C_SIMTIME, dt);
  atomicAdd(&cnt[C_STEPS], 1u);
  let um = bitcast<f32>(atomicLoad(&cnt[C_UMAXL]));
  var next = P.dtmax;
  if (um > 0.0) { next = min(P.dtmax, 0.9 * P.dx / um); }
  glob[G_DT] = next;
  atomicStore(&cnt[C_UMAXL], 0u);
  atomicStore(&cnt[C_MAXOUT], 0u);
}`},{name:"measCells",wg:256,bind:"P:u cf:r cu:r meas:w probe:w",code:`var<workgroup> red: array<f32, ${8*256}>;
${zt} {
  let c = gid.x;
  let lid = lid3.x;
  if (c == 0u) { probe[31] = 0.0; }
  var v = array<f32, 8>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  let n = P.n;
  if (c < n) {
    let k = cu[U_KIND * n + c];
    if (k == SOLID || cu[U_SOLID * n + c] != 0u) { v[0] = cf[F_ES * n + c]; v[1] = cf[F_FILM * n + c]; }
    else {
      v[2] = cf[F_HG * n + c];
      v[3] = cf[F_MV * n + c];
      v[4] = cf[F_MF * n + c];
      v[5] = cf[F_MN * n + c] + cf[F_MO * n + c];
      if (k == LIQUID) { v[6] = 1.0; } else { v[7] = 1.0; }
    }
  }
  for (var q = 0u; q < 8u; q++) { red[q * 256u + lid] = v[q]; }
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var q = 0u; q < 8u; q++) { red[q * 256u + lid] += red[q * 256u + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 8u) { meas[wid3.x * ${Ss}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${4*256}>;
${zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = vec4<f32>(0.0);
  if (p < count) {
    let q = parts[p];
    if ((q.flags & 1u) == 0u && q.mass > 0.0) { v = vec4<f32>(q.mass * q.h, q.mass, q.mass * q.T, q.mass * (q.h - hL(P.tsatAmb))); }
  }
  for (var k = 0u; k < 4u; k++) { red[k * 256u + lid] = v[k]; }
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var k = 0u; k < 4u; k++) { red[k * 256u + lid] += red[k * 256u + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Ss}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${zt} {
  let lid = lid3.x;
  let count = min(cntWG(lid, C_BCOUNT), P.bcap);
  let b = gid.x;
  var v = vec3<f32>(0.0);
  if (b < count) {
    let B = bubs[b];
    if (B.alive != 0u) { v = vec3<f32>(B.H, B.mV, B.mN + B.mO); }
  }
  for (var k = 0u; k < 3u; k++) { red[k * 256u + lid] = v[k]; }
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var k = 0u; k < 3u; k++) { red[k * 256u + lid] += red[k * 256u + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Ss}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${zt} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let w = cntWG(lid3.x, C_WATCH);
  let b = gid.x;
  if (b >= count) { return; }
  let B = bubs[b];
  if (B.alive == 0u || w == NONE || B.id != w) { return; }
  probe[0] = B.x; probe[1] = B.y; probe[2] = B.r; probe[3] = B.Tb; probe[4] = B.pb; probe[5] = B.pv;
  probe[6] = B.mV; probe[7] = B.mN + B.mO; probe[8] = B.vx; probe[9] = B.vy; probe[10] = B.dmdt;
  probe[11] = select(0.0, 1.0, B.site >= 0);
  for (var k = 0; k < 8; k++) { probe[12 + k] = B.force[k]; }
  probe[20] = cf[F_PTL * P.n + cellAt(B.x, B.y)];
  probe[21] = bitcast<f32>(B.id);
  probe[31] = 1.0;
}`}],vs=256,wu=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:vs,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${$n}
${_t} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:vs,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${$n}
${_t} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:vs,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Jo}
${$n}
${_t} {
  let lid = lid3.x;
  for (var l = LV.lt + 1u; l < LV.depth; l++) {
    let F = LV.lv[l - 1u];
    let C = LV.lv[l];
    let nc = C.nx * C.ny;
    for (var t = lid; t < nc; t += WG) { coarsen1(F, C, t); }
    storageBarrier();
    for (var t = lid; t < nc; t += WG) { coarsen2(F, C, t); }
    storageBarrier();
    for (var t = lid; t < nc; t += WG) { diagonalAt(C, t); }
    storageBarrier();
    let nf = F.nx * F.ny;
    for (var t = lid; t < nf; t += WG) { weightsAt(F, C, t); }
    storageBarrier();
  }
}`},{name:"mgPost",wg:vs,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${dn}
${Se}
const TILE: u32 = 16u;
const HALO: u32 = ${Vt}u;
const TS: u32 = ${16+2*Vt}u;
var<workgroup> sx: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Vt)**2}>;
${_t} {
  let lid = lid3.x;
  if (lid == 0u) { wconv = select(0u, 1u, vConverged()); }
  if (workgroupUniformLoad(&wconv) != 0u) { return; }
  let L = LP.F;
  let tx = (L.nx + TILE - 1u) / TILE;
  let ti = wid3.x % tx;
  let tj = wid3.x / tx;
  let i0 = i32(ti * TILE) - i32(HALO);
  let j0 = i32(tj * TILE) - i32(HALO);
  /* Laden (ausserhalb des Gitters mit Geisterrand: null, also ohne Kopplung). */
  for (var q = lid; q < TS * TS; q += WG) {
    let I = i0 + i32(q % TS);
    let J = j0 + i32(q / TS);
    var x = 0.0; var b = 0.0; var ax = 0.0; var ay = 0.0; var inv = 0.0;
    if (I >= -1 && J >= -1 && I <= i32(L.nx) && J <= i32(L.ny)) {
      let s = u32(I + 1) + u32(J + 1) * L.stride;
      x = mgF[L.xp + s];
      b = mgF[L.b + s]; ax = mgF[L.ax + s]; ay = mgF[L.ay + s]; inv = mgF[L.inv + s];
      /* Verlängerung: x += Σ pW x_grob. */
      if (I >= 0 && J >= 0 && I < i32(L.nx) && J < i32(L.ny) && mgU[L.act + s] != 0u) {
        let C = LP.C;
        let o = 4u * s;
        x += mgF[C.pW + o] * mgF[C.x + mgU[C.pIdx + o]] + mgF[C.pW + o + 1u] * mgF[C.x + mgU[C.pIdx + o + 1u]]
          + mgF[C.pW + o + 2u] * mgF[C.x + mgU[C.pIdx + o + 2u]] + mgF[C.pW + o + 3u] * mgF[C.x + mgU[C.pIdx + o + 3u]];
      }
    }
    sx[q] = x; sb[q] = b; sax[q] = ax; say[q] = ay; sinv[q] = inv;
  }
  workgroupBarrier();
  /* TILE_SWEEPS Durchgänge (nach dem Vorglätten in umgekehrter Farbfolge: schwarz zuerst), je ein Ring weniger. */
  for (var k = 0u; k < ${Vt}u; k++) {
    let col = (k + 1u) & 1u;
    let lo = k + 1u;
    let hi = TS - 1u - k;
    for (var q = lid; q < TS * TS; q += WG) {
      let a = q % TS;
      let c = q / TS;
      if (a < lo || a >= hi || c < lo || c >= hi) { continue; }
      if (((u32(i0 + i32(a) + 64) + u32(j0 + i32(c) + 64)) & 1u) != col) { continue; }
      sx[q] = (sb[q] + sax[q] * sx[q + 1u] + sax[q - 1u] * sx[q - 1u] + say[q] * sx[q + TS] + say[q - TS] * sx[q - TS]) * sinv[q];
    }
    workgroupBarrier();
  }
  /* Die 16 × 16 Zellen zurück. */
  for (var q = lid; q < TILE * TILE; q += WG) {
    let a = q % TILE + HALO;
    let c = q / TILE + HALO;
    let I = i0 + i32(a);
    let J = j0 + i32(c);
    if (I < 0 || J < 0 || I >= i32(L.nx) || J >= i32(L.ny)) { continue; }
    mgF[L.x + u32(I + 1) + u32(J + 1) * L.stride] = sx[a + c * TS];
  }
}`},{name:"mgPreR",wg:vs,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${dn}
${Se}
const TILE: u32 = 12u;
const HALO: u32 = ${Vt+2}u;
const TS: u32 = ${12+2*(Vt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Vt+2))**2}>;
${_t} {
  let lid = lid3.x;
  if (lid == 0u) { wconv = select(0u, 1u, vConverged()); }
  if (workgroupUniformLoad(&wconv) != 0u) { return; }
  let F = LP.F;
  let C = LP.C;
  let tx = (F.nx + TILE - 1u) / TILE;
  let ti = wid3.x % tx;
  let tj = wid3.x / tx;
  let i0 = i32(ti * TILE) - i32(HALO);
  let j0 = i32(tj * TILE) - i32(HALO);
  /* Laden; x beginnt auf jeder Stufe bei null (die Korrektur der groben Stufe), wird also nicht gelesen. */
  for (var q = lid; q < TS * TS; q += WG) {
    let I = i0 + i32(q % TS);
    let J = j0 + i32(q / TS);
    var b = 0.0; var ax = 0.0; var ay = 0.0; var inv = 0.0;
    if (I >= -1 && J >= -1 && I <= i32(F.nx) && J <= i32(F.ny)) {
      let s = u32(I + 1) + u32(J + 1) * F.stride;
      b = mgF[F.b + s]; ax = mgF[F.ax + s]; ay = mgF[F.ay + s]; inv = mgF[F.inv + s];
    }
    sx[q] = 0.0; sb[q] = b; sax[q] = ax; say[q] = ay; sinv[q] = inv;
  }
  workgroupBarrier();
  for (var k = 0u; k < ${Vt}u; k++) {
    let col = k & 1u;
    let lo = k + 1u;
    let hi = TS - 1u - k;
    for (var q = lid; q < TS * TS; q += WG) {
      let a = q % TS;
      let c = q / TS;
      if (a < lo || a >= hi || c < lo || c >= hi) { continue; }
      if (((u32(i0 + i32(a) + 64) + u32(j0 + i32(c) + 64)) & 1u) != col) { continue; }
      sx[q] = (sb[q] + sax[q] * sx[q + 1u] + sax[q - 1u] * sx[q - 1u] + say[q] * sx[q + TS] + say[q - TS] * sx[q - TS]) * sinv[q];
    }
    workgroupBarrier();
  }
  /* x der Kachel zurück (nach xp: das Nachglätten liest es); das Residuum b − A x (Diagonale = 1/inv) eine Zelle über die Kachel hinaus in sinv. */
  for (var q = lid; q < TILE * TILE; q += WG) {
    let a = q % TILE + HALO;
    let c = q / TILE + HALO;
    let I = i0 + i32(a);
    let J = j0 + i32(c);
    if (I < 0 || J < 0 || I >= i32(F.nx) || J >= i32(F.ny)) { continue; }
    mgF[F.xp + u32(I + 1) + u32(J + 1) * F.stride] = sx[a + c * TS];
  }
  for (var q = lid; q < TS * TS; q += WG) {
    let a = q % TS;
    let c = q / TS;
    var r = 0.0;
    if (a >= HALO - 1u && a < TS - HALO + 1u && c >= HALO - 1u && c < TS - HALO + 1u && sinv[q] > 0.0) {
      r = sb[q] - (sx[q] / sinv[q] - sax[q] * sx[q + 1u] - sax[q - 1u] * sx[q - 1u] - say[q] * sx[q + TS] - say[q - TS] * sx[q - TS]);
    }
    sinv[q] = r;
  }
  workgroupBarrier();
  /* Die 6 × 6 groben Zellen der Kachel: Σ pW r der feinen Zellen, die auf sie zeigen. */
  for (var q = lid; q < 36u; q += WG) {
    let I = ti * 6u + q % 6u;
    let J = tj * 6u + q / 6u;
    if (I >= C.nx || J >= C.ny) { continue; }
    let sc = I + 1u + (J + 1u) * C.stride;
    var acc = 0.0;
    if (mgU[C.act + sc] != 0u) {
      for (var dj = 0u; dj < 4u; dj++) {
        let fj = i32(2u * J + dj) - 1;
        if (fj < 0 || fj >= i32(F.ny)) { continue; }
        for (var di = 0u; di < 4u; di++) {
          let fi = i32(2u * I + di) - 1;
          if (fi < 0 || fi >= i32(F.nx)) { continue; }
          let sf = u32(fi) + 1u + (u32(fj) + 1u) * F.stride;
          if (mgU[F.act + sf] == 0u) { continue; }
          var w = 0.0;
          for (var k = 0u; k < 4u; k++) { if (mgU[C.pIdx + 4u * sf + k] == sc) { w += mgF[C.pW + 4u * sf + k]; } }
          if (w == 0.0) { continue; }
          acc += w * sinv[u32(fi - i0) + u32(fj - j0) * TS];
        }
      }
    }
    mgF[C.b + sc] = acc;
  }
}`},{name:"mgTail",wg:vs,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Jo}
${Se}
var<workgroup> tx: array<f32, ${Fs}>;
var<workgroup> tb: array<f32, ${Fs}>;
var<workgroup> tax: array<f32, ${Fs}>;
var<workgroup> tay: array<f32, ${Fs}>;
var<workgroup> tinv: array<f32, ${Fs}>;
var<workgroup> toff: array<u32, ${Ts}>;
fn shSweep(L: Level, o: u32, col: u32, lid: u32) {
  for (var t = lid; t < L.nx * L.ny; t += WG) {
    let I = t % L.nx;
    let J = t / L.nx;
    if (((I + J) & 1u) != col) { continue; }
    let s = o + I + 1u + (J + 1u) * L.stride;
    let st = L.stride;
    tx[s] = (tb[s] + tax[s] * tx[s + 1u] + tax[s - 1u] * tx[s - 1u] + tay[s] * tx[s + st] + tay[s - st] * tx[s - st]) * tinv[s];
  }
  workgroupBarrier();
}
${_t} {
  let lid = lid3.x;
  if (lid == 0u) { wconv = select(0u, 1u, vConverged()); }
  if (workgroupUniformLoad(&wconv) != 0u) { return; }
  let lt = LV.lt;
  let last = LV.depth - 1u;
  if (lid == 0u) {
    var o = 0u;
    for (var l = lt; l <= last; l++) { toff[l] = o; o += LV.lv[l].size; }
  }
  workgroupBarrier();
  /* Laden: Koeffizienten aller Stufen, b der ersten, x = 0. Inaktive Zellen: inv = 0 (x bleibt 0). */
  for (var l = lt; l <= last; l++) {
    let L = LV.lv[l];
    let o = toff[l];
    for (var s = lid; s < L.size; s += WG) {
      let act = mgU[L.act + s] != 0u;
      tax[o + s] = mgF[L.ax + s];
      tay[o + s] = mgF[L.ay + s];
      tinv[o + s] = select(0.0, mgF[L.inv + s], act);
      tx[o + s] = 0.0;
      tb[o + s] = select(0.0, mgF[L.b + s], l == lt && act);
    }
  }
  workgroupBarrier();
  for (var l = lt; l < last; l++) {
    let F = LV.lv[l];
    let C = LV.lv[l + 1u];
    let ofs = toff[l];
    let oc = toff[l + 1u];
    shSweep(F, ofs, 0u, lid); shSweep(F, ofs, 1u, lid); shSweep(F, ofs, 0u, lid); shSweep(F, ofs, 1u, lid);
    /* Restriktion: Σ pW (b − A x) der feinen Zellen (Diagonale = 1/inv). */
    for (var t = lid; t < C.nx * C.ny; t += WG) {
      let I = t % C.nx;
      let J = t / C.nx;
      let sc = I + 1u + (J + 1u) * C.stride;
      var acc = 0.0;
      if (tinv[oc + sc] > 0.0) {
        for (var dj = 0u; dj < 4u; dj++) {
          let fj = i32(2u * J + dj) - 1;
          if (fj < 0 || fj >= i32(F.ny)) { continue; }
          for (var di = 0u; di < 4u; di++) {
            let fi = i32(2u * I + di) - 1;
            if (fi < 0 || fi >= i32(F.nx)) { continue; }
            let sf = u32(fi) + 1u + (u32(fj) + 1u) * F.stride;
            let q = ofs + sf;
            if (!(tinv[q] > 0.0)) { continue; }
            var w = 0.0;
            for (var k = 0u; k < 4u; k++) { if (mgU[C.pIdx + 4u * sf + k] == sc) { w += mgF[C.pW + 4u * sf + k]; } }
            if (w == 0.0) { continue; }
            let st = F.stride;
            let r = tb[q] - (tx[q] / tinv[q] - tax[q] * tx[q + 1u] - tax[q - 1u] * tx[q - 1u] - tay[q] * tx[q + st] - tay[q - st] * tx[q - st]);
            acc += w * r;
          }
        }
      }
      tb[oc + sc] = acc;
    }
    workgroupBarrier();
  }
  let Lc = LV.lv[last];
  let ol = toff[last];
  for (var k = 0u; k < ${Yo}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Yo}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
  for (var l = last; l > lt; l--) {
    let F = LV.lv[l - 1u];
    let C = LV.lv[l];
    let ofs = toff[l - 1u];
    let oc = toff[l];
    for (var t = lid; t < F.nx * F.ny; t += WG) {
      let sf = t % F.nx + 1u + (t / F.nx + 1u) * F.stride;
      if (!(tinv[ofs + sf] > 0.0)) { continue; }
      let o4 = 4u * sf;
      tx[ofs + sf] += mgF[C.pW + o4] * tx[oc + mgU[C.pIdx + o4]] + mgF[C.pW + o4 + 1u] * tx[oc + mgU[C.pIdx + o4 + 1u]]
        + mgF[C.pW + o4 + 2u] * tx[oc + mgU[C.pIdx + o4 + 2u]] + mgF[C.pW + o4 + 3u] * tx[oc + mgU[C.pIdx + o4 + 3u]];
    }
    workgroupBarrier();
    shSweep(F, ofs, 1u, lid); shSweep(F, ofs, 0u, lid); shSweep(F, ofs, 1u, lid); shSweep(F, ofs, 0u, lid);
  }
  /* x der ersten Stufe des Schwanzes zurück (die Verlängerung der grossen Stufe darüber liest es). */
  let L0 = LV.lv[lt];
  for (var s = lid; s < L0.size; s += WG) { mgF[L0.x + s] = tx[toff[lt] + s]; }
}`}],Dn=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Ur(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const ve=[0,120],ys=128,ws="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",bu=.006,Fu={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},Au=4*1e3*15e-7/(3*2*.07),Gr=`
const VIR = array<vec3<f32>, ${Dn.length}>(${Dn.map(o=>`vec3<f32>(${ct(o[0]/255)}, ${ct(o[1]/255)}, ${ct(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${ct(Dn.length-1)};
  let i = min(u32(floor(x)), ${Dn.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Ki="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",_u=[{name:"rScale",wg:ys,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Ki}
var<workgroup> m4: array<vec4<f32>, WG>;
${ws} {
  let c = gid.x;
  let lid = lid3.x;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    let n = P.n;
    let k = cu[U_KIND * n + c];
    let i = ci(c);
    let j = cj(c);
    let og = FF_UG * P.nf;
    let ol = FF_UL * P.nf;
    if (k == GAS) {
      v.x = abs(cf[F_PG * n + c]);
      let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
      let w = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
      v.y = sqrt(u * u + w * w);
    }
    let half = i32(RO.step / 2u);
    if ((i - half) % i32(RO.step) == 0 && (j - half) % i32(RO.step) == 0 && i >= half && j >= half) {
      if (k == GAS) { v.z = v.y; }
      else if (k == LIQUID) {
        let u = 0.5 * (ff[ol + uF(i, j)] + ff[ol + uF(i + 1, j)]);
        let w = 0.5 * (ff[ol + vF(i, j)] + ff[ol + vF(i, j + 1)]);
        v.w = sqrt(u * u + w * w);
      }
    }
  }
  m4[lid] = v;
  workgroupBarrier();
  for (var s = WG / 2u; s > 0u; s >>= 1u) {
    if (lid < s) { m4[lid] = max(m4[lid], m4[lid + s]); }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let r = m4[0];
    maxU_cnt(C_OV_PMAX, r.x); maxU_cnt(C_OV_VMAX, r.y); maxU_cnt(C_OV_VGAS, r.z); maxU_cnt(C_OV_VLIQ, r.w);
  }
}`},{name:"rCells",wg:ys,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Ki}
${Gr}
const SOLID_RGB = array<vec3<f32>, ${ut.length}>(${ut.map(o=>{const t=Ur(o.color);return`vec3<f32>(${ct(t[0]/255)}, ${ct(t[1]/255)}, ${ct(t[2]/255)})`}).join(", ")});
${ws} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${ct(ve[0])};
  let tspan = ${ct(ve[1]-ve[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${ut.length}u) - 1u];
    let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
    cell = vec4<f32>(rgb.x + (0.902 - rgb.x) * glow, rgb.y * (1.0 - 0.6 * glow), rgb.z * (1.0 - 0.8 * glow), 1.0);
    if (ov == 1u) { cell = vec4<f32>(viridis((T - T0 - tmin) / tspan), 1.0); }
    else if (ov == 6u) { cell = vec4<f32>(0.353, 0.353, 0.353, 1.0); }
  } else if (ov == 6u) {
    if (k == LIQUID) { cell = vec4<f32>(0.239, 0.561, 0.847, 0.784); } else { cell = vec4<f32>(0.922, 0.922, 0.922, 0.471); }
    if (cf[F_ALPHA * n + c] > 0.02) { cell = vec4<f32>(0.98, 0.784, 0.314, 0.863); }
  } else if (k == GAS) {
    if (ov == 1u || ov == 2u || ov == 3u) {
      var t = 0.0;
      if (ov == 1u) { t = (T - T0 - tmin) / tspan; }
      else if (ov == 2u) { t = 0.5 + 0.5 * cf[F_PG * n + c] / max(1.0, cnt[C_OV_PMAX]); }
      else {
        let og = FF_UG * P.nf;
        let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
        let w = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
        t = sqrt(u * u + w * w) / max(0.02, cnt[C_OV_VMAX]);
      }
      col = viridis(t);
      a = select(0.55, 0.4, ov == 3u);
    } else if (ov == 4u || ov == 5u) {
      let mv = cf[F_MV * n + c];
      let nd = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
      let nv = mv / M_H2O;
      var x = 0.0;
      if (nv + nd > 0.0) { x = nv / (nv + nd); }
      var value = 0.0;
      if (ov == 4u) { value = x * pAt(c) / pSat(T); } else { value = mv / max(1e-12, cf[F_VGAS * n + c]) / 0.6; }
      col = vec3<f32>(0.157, 0.431, 0.863);
      a = min(0.86, 0.86 * value);
    }
    let fog = cf[F_MF * n + c] / max(1e-12, cf[F_VGAS * n + c]);
    if (fog > 0.0) {
      var af = min(0.95, 1.0 - exp(-fog / ${ct(Au)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:ys,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${ws} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let J = t / lx;
  let h = 0.5 * P.dx;
  let inv = 1.0 / (h * h * P.depth);
  let ic = i32(I / 2u);
  let jc = i32(J / 2u);
  var w = 0.0;
  var wt = 0.0;
  for (var b = -1; b <= 1; b++) {
    let jj = jc + b;
    if (jj < 0 || jj >= i32(P.ny)) { continue; }
    for (var a = -1; a <= 1; a++) {
      let ii = ic + a;
      if (ii < 0 || ii >= i32(P.nx)) { continue; }
      let cc = cellOf(ii, jj);
      let st = cellStart(cc);
      let cn = ccount[cc];
      for (var k = 0u; k < cn; k++) {
        let pk = st + k;
        let m = parts[pk].mass;
        if (!(m > 0.0)) { continue; }
        let ww = bspline1(parts[pk].x / h - 0.5 - f32(I)) * bspline1(parts[pk].y / h - 0.5 - f32(J));
        if (ww == 0.0) { continue; }
        let vp = m / parts[pk].rho * inv * ww;
        w += vp;
        wt += vp * parts[pk].T;
      }
    }
  }
  lq[2u * t] = w;
  lq[2u * t + 1u] = wt;
}`},{name:"rLiqBlurX",wg:ys,bind:"P:u lq:r lq2:w",code:`${ws} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:ys,bind:"P:u lq2:r liquid:t",code:`${ws} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let J = t / lx;
  let b = select(t, t - lx, J > 0u);
  let u = select(t, t + lx, J + 1u < ly);
  let w = 0.25 * lq2[2u * b] + 0.5 * lq2[2u * t] + 0.25 * lq2[2u * u];
  let wt = 0.25 * lq2[2u * b + 1u] + 0.5 * lq2[2u * t + 1u] + 0.25 * lq2[2u * u + 1u];
  var temp = 0.0;
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${ct(ve[0])}) / ${ct(ve[1]-ve[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:ys,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Ki}
${ws} {
  let a = gid.x;
  let na = RO.nax * RO.nay;
  if (a >= 2u * na) { return; }
  let liquidPass = a >= na;
  let q = a % na;
  let half = RO.step / 2u;
  let i = i32(half + (q % RO.nax) * RO.step);
  let j = i32(half + (q / RO.nax) * RO.step);
  let o = 12u * a;
  for (var k = 0u; k < 12u; k++) { arrows[o + k] = 0.0; }
  if (RO.overlay != 3u || i >= i32(P.nx) || j >= i32(P.ny)) { return; }
  let c = cellOf(i, j);
  let kind = cu[U_KIND * P.n + c];
  if ((liquidPass && kind != LIQUID) || (!liquidPass && kind != GAS)) { return; }
  let fld = select(FF_UG, FF_UL, liquidPass);
  let ofs = fld * P.nf;
  let u = 0.5 * (ff[ofs + uF(i, j)] + ff[ofs + uF(i + 1, j)]);
  let v = 0.5 * (ff[ofs + vF(i, j)] + ff[ofs + vF(i, j + 1)]);
  let s = sqrt(u * u + v * v);
  let vmax = select(max(0.02, cnt[C_OV_VMAX]), cnt[C_OV_VLIQ], liquidPass);
  if (!(vmax > 1e-6) || s < 0.03 * vmax) { return; }
  let len = 0.9 * f32(RO.step) * P.dx;
  let L = len * s / vmax;
  let ux = u / s;
  let uy = v / s;
  let cx = (f32(i) + 0.5) * P.dx;
  let cy = (f32(j) + 0.5) * P.dx;
  let x1 = cx + 0.5 * L * ux;
  let y1 = cy + 0.5 * L * uy;
  let h = 0.35 * L;
  let ca = 0.9063;
  let sa = 0.4226;
  arrows[o] = cx - 0.5 * L * ux; arrows[o + 1u] = cy - 0.5 * L * uy; arrows[o + 2u] = x1; arrows[o + 3u] = y1;
  arrows[o + 4u] = x1; arrows[o + 5u] = y1; arrows[o + 6u] = x1 - h * (ca * ux - sa * uy); arrows[o + 7u] = y1 - h * (sa * ux + ca * uy);
  arrows[o + 8u] = x1; arrows[o + 9u] = y1; arrows[o + 10u] = x1 - h * (ca * ux + sa * uy); arrows[o + 11u] = y1 - h * (-sa * ux + ca * uy);
}`}],An=`
struct RP {
  view: vec4<f32>,
  box: vec2<f32>,
  canvas: vec2<f32>,
  ground: vec4<f32>,
  water: vec4<f32>,
  ink: vec4<f32>,
  waterInk: vec4<f32>,
  rect: vec4<f32>,
  fill: vec4<f32>,
  tint: f32,
  pointPx: f32,
  bcount: u32,
  pcount: u32,
}
@group(0) @binding(0) var<uniform> R: RP;
fn toClip(p: vec2<f32>) -> vec4<f32> { return vec4<f32>((p - R.view.xy) / (R.view.zw - R.view.xy) * 2.0 - 1.0, 0.0, 1.0); }
`,zi=`${An}
${Gr}
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex fn vs(@builtin(vertex_index) v: u32) -> VO {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  var o: VO;
  o.pos = toClip(corner * R.box);
  o.uv = vec2<f32>(corner.x, 1.0 - corner.y);
  return o;
}
@fragment fn fsCells(i: VO) -> @location(0) vec4<f32> {
  let c = textureSample(tex, smp, i.uv);
  return vec4<f32>(c.rgb * c.a, c.a);
}
@fragment fn fsField(i: VO) -> @location(0) vec4<f32> { return textureSample(tex, smp, i.uv); }
@fragment fn fsLiquid(i: VO) -> @location(0) vec4<f32> {
  let c = textureSample(tex, smp, i.uv);
  let cover = c.r;
  let a = smoothstep(0.42, 0.58, cover);
  if (a <= 0.0) { discard; }
  var rgb = mix(R.water.rgb, viridis(c.g), R.tint);
  let edge = 1.0 - smoothstep(0.0, 0.12, abs(cover - 0.5));
  rgb *= 1.0 - 0.25 * edge;
  let alpha = 0.82 * a;
  return vec4<f32>(rgb * alpha, alpha);
}
`,ku=`${An}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Mu=`${An}
${(Vr.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${K.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let B = bubs[b];
  let tot = B.mN + B.mO + B.mV;
  if (tot > 0.0) { o.air = (B.mN + B.mO) / tot; }
  o.pos = toClip(vec2<f32>(B.x, B.y) + corner * max(B.r, 0.00012));
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  let d = length(i.local);
  if (d > 1.0) { discard; }
  let ring = smoothstep(0.72, 0.95, d);
  let inside = mix(vec3<f32>(0.93, 0.97, 1.0), vec3<f32>(0.95, 0.95, 0.9), i.air);
  let rgb = mix(inside, vec3<f32>(0.16, 0.36, 0.62), ring);
  let alpha = mix(0.55, 0.95, ring) * (1.0 - smoothstep(0.95, 1.0, d));
  return vec4<f32>(rgb * alpha, alpha);
}
`,Pu=`${An}
${Gr}
${(Vr.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${K.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${ct(273.15+ve[0])}) / ${ct(ve[1]-ve[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Tu=`${An}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,ic=48,Qi=256,Su=12;class Cu{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",Qi*Su,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,g,d,p,x=[])=>{const w=t.createShaderModule({code:m}),A=(await w.getCompilationInfo()).messages.filter(F=>F.type==="error");if(A.length>0)throw new Error(`render WGSL: ${A.map(F=>`${F.lineNum}:${F.linePos} ${F.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:w,entryPoint:"vs",buffers:x},fragment:{module:w,entryPoint:g,targets:[{format:this.format,blend:e}]},primitive:{topology:p}})},[r,a,c,l,f,u,h]=await Promise.all([i(zi,"fsCells",this.layouts.quad,"triangle-strip"),i(zi,"fsField",this.layouts.quad,"triangle-strip"),i(zi,"fsLiquid",this.layouts.quad,"triangle-strip"),i(ku,"fs",this.layouts.rect,"triangle-strip"),i(Mu,"fs",this.layouts.store,"triangle-strip"),i(Pu,"fs",this.layouts.store,"triangle-strip"),i(Tu,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:c,rect:l,disc:f,point:u,line:h}}ensure(){var f,u,h,m,g,d;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(p,x)=>s.createTexture({size:[p,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(u=this.fieldTex)==null||u.destroy(),(h=this.liquidTex)==null||h.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(g=this.lq2)==null||g.destroy(),(d=this.arrows)==null||d.destroy(),this.lq=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(bu/this.gpu.cpu.grid.dx)),a=r>>1,c=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=c*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,c,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:Qi*s,size:4*ic}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const c=this.gpu.state,l=this.gpu.ctx,f=this.device.queue;this.roData[0]=Fu[r],f.writeBuffer(this.ro,0,this.roData),t.clearBuffer(c.cnt,4*K.OV_PMAX,16);const u=t.beginComputePass(),h=c.d.n;l.dispatch(u,"rScale",this.computeGroup("rScale",{}),h),l.dispatch(u,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),h),a||(l.dispatch(u,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*h),l.dispatch(u,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*h),l.dispatch(u,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*h)),r==="velocity"&&l.dispatch(u,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),u.end();const m=this.gpu.cpu.grid,g=(y,A,F)=>{const k=new Float32Array(ic),_=new Uint32Array(k.buffer);k.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),k.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),k.set(A,24),k.set(F,28),k[32]=r==="temperature"?1:0,k[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),_[34]=c.d.bcap,_[35]=c.d.pcap,f.writeBuffer(this.rp,Qi*y,k)},d=.003;g(0,[0,0,m.w,m.h],[...this.theme.ground,1]),g(1,[0,0,0,0],[0,0,0,0]),g(2,[0,0,0,0],[...this.theme.ink,.85]),g(3,[0,0,0,0],[...this.waterInk,.9]);const p=[];i.left&&p.push([-d,-d,0,m.h+(i.top?d:0)]),i.right&&p.push([m.w,-d,m.w+d,m.h+(i.top?d:0)]),i.bottom&&p.push([-d,-d,m.w+d,0]),i.top&&p.push([-d,m.h,m.w+d,m.h+d]),p.forEach((y,A)=>g(4+A,y,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;x.setPipeline(w.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(w.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:c.partsA})),x.draw(4,c.d.pcap)):(x.setPipeline(w.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(w.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:c.bubs})),x.draw(4,c.d.bcap),x.setPipeline(w.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(w.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(w.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(w.rect),p.forEach((y,A)=>{x.setBindGroup(0,this.drawGroup(`d-wall${A}`,this.layouts.rect,4+A,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const Lu=[...du,...wu,...ou,...iu,...cu,...eu,...nu,...lu,...yu,..._u],rc=[["heater",K.HEATER_E,"f"],["lossWalls",K.LOSS_WALLS,"f"],["lossOpen",K.LOSS_OPEN,"f"],["escapedEnergy",K.ESC_ENERGY,"f"],["escapedWater",K.ESC_WATER,"f"],["escapedAir",K.ESC_AIR,"f"],["produced",K.PRODUCED,"f"],["condensed",K.CONDENSED,"f"],["dew",K.DEW,"f"],["fogMade",K.FOGMADE,"f"],["burstVapour",K.BURSTVAP,"f"],["fluxSL",K.FLUX_SL,"f"],["fluxLG",K.FLUX_LG,"f"],["fluxSG",K.FLUX_SG,"f"],["lossSolids",K.LOSS_SOLIDS,"f"],["nucleated",K.NUCLEATED,"u"],["departed",K.DEPARTED,"u"],["merged",K.MERGED,"u"],["burst",K.BURST,"u"],["collapsed",K.COLLAPSED,"u"],["burstCold",K.BURST_COLD,"u"],["burstWarm",K.BURST_WARM,"u"],["collapsedCold",K.COLL_COLD,"u"],["collapsedWarm",K.COLL_WARM,"u"]],oc=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),Xi=256,bs=2*Ze;class Hr{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",oc());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"sealed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(Ze).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:bs}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*bs,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await Nr.create(),s=await e.compile(Lu);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new Hr(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new xu(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new gu(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Xi/4*16);for(let n=0;n<16;n+=1)s[Xi/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Xi*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,bs,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);this.sort(n,1),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.cells(n,"liqAssemble"),this.solver.encodeMG(n,na,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,ia,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,oa,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,ra,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*ts,n=s+4*Ps,i=n+4*Fe*t.d.nreg,r=i+4*xe*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],c=r+4*Ss*a,l=c+4*64,f=l+8*bs;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:c,ts:l,total:f}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(c=>!this.busy.has(c)&&c.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*ts),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Ps),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Fe*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*xe*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*bs),t.clearBuffer(s.cnt,4*Eo,4*(M0-Eo)),this.busy.add(i);const a=[];for(let c=0;c<this.cpu.regions.count;c+=1)a.push(s.gpuRegion(c));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,ts),r=new Float32Array(t,n.cnt,ts),a=new Float32Array(t,n.glob,Ps),c=new Float32Array(t,n.reg,Fe*e.nreg),l=new Float32Array(t,n.heat,xe*e.nheat),f=new Float32Array(t,n.meas,(n.probe-n.meas)/4),u=new Float32Array(t,n.probe,64),[h,m,g]=e.groups,d=(F,k,_)=>{let b=0;for(let M=0;M<k;M+=1)b+=f[(F+M)*Ss+_];return b},p=[];for(const F of e.regions){const k=Fe*F;p.push({p0:c[k+Qt.P0],sealed:c[k+Qt.OPEN]===0,vGas:c[k+Qt.VGAS],vFluid:c[k+Qt.VFLUID]})}const x=[];for(let F=0;F<e.heaters;F+=1){const k=xe*F;x.push({P:l[k+Ut.P],Tmean:l[k+Ut.TMEAN],integral:l[k+Ut.INTEGRAL],cells:l[k+Ut.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,bs);w=[];for(let k=0;k<Ze;k+=1){const _=F[2*k],b=F[2*k+1];w.push(b>_&&_>0n?Number(b-_)/1e6:0)}}const y=r[K.SUM_WM],A={};for(const[F,k,_]of rc)A[F]=_==="f"?r[k]:i[k];return{intervals:A,ov:[r[K.OV_PMAX],r[K.OV_VMAX],r[K.OV_VLIQ]],pcount:i[K.PCOUNT],bcount:i[K.BCOUNT],dt:a[_s.DT],stepsSince:i[K.STEPS],simSince:r[K.SIMTIME],itL:i[K.IT_L],itG:i[K.IT_G],itH:i[K.IT_H],itD:i[K.IT_D],capL:i[K.CAP_L],capG:i[K.CAP_G],capH:i[K.CAP_H],capD:i[K.CAP_D],resL:r[K.RES_L],resG:r[K.RES_G],resH:r[K.RES_H],nsub:i[K.NSUBMAX],uMaxG:r[K.UMAXG],waterMass:y,waterT:y>0?r[K.SUM_WMT]/y:0,waterTmax:r[K.TMAX],solids:d(0,h,0),film:d(0,h,1),gas:d(0,h,2),vapour:d(0,h,3),fog:d(0,h,4),air:d(0,h,5),liquidCells:Math.round(d(0,h,6)),gasCells:Math.round(d(0,h,7)),liquidH:d(h,m,0),liquidMass:d(h,m,1),sensible:d(h,m,3),bubH:d(h+m,g,0),bubWater:d(h+m,g,1),bubAir:d(h+m,g,2),regions:p,heaters:x,watch:{found:u[31]===1,id:new Uint32Array(u.buffer,u.byteOffset+4*21,1)[0],fate:i[K.WATCH_FATE],data:new Float32Array(u)},firstSuperheat:i[K.FIRST_SH]!==0?r[K.FIRST_SH]-1e3:null,stageMs:w}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of rc)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(n,i,r,a,c,l)=>{if(i===0&&r===0)return n;const f=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(c,Math.max(a,n>f?Math.max(f,n-2):f))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:0,editOther:e.ledger.other,escapedSalt:0,editSalt:e.ledger.salt,bodyWork:0},c=this.energy0??r.energy,l=this.water0??r.water.total,f=r.energy-c-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),u=r.water.total-l-a.editWater,h=i.produced+i.burstVapour,m=i.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.vapourMark)/m,this.vapourMark=h,this.vapourLast=i.time);const g=e.heat.heaters.map((x,w)=>({h:x,k:w,rd:n==null?void 0:n.heaters[w]})).filter(({rd:x,h:w})=>((x==null?void 0:x.cells)??w.cells)>0).map(({h:x,rd:w})=>({group:x.group,P:(w==null?void 0:w.P)??x.P,Tmean:(w==null?void 0:w.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),d=(x,w,y)=>({iterations:x,residual:w,capped:y>0}),p=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:d((p==null?void 0:p.itL)??0,(p==null?void 0:p.resL)??0,(p==null?void 0:p.capL)??0),gas:d((p==null?void 0:p.itG)??0,(p==null?void 0:p.resG)??0,(p==null?void 0:p.capG)??0),heat:d((p==null?void 0:p.itH)??0,(p==null?void 0:p.resH)??0,(p==null?void 0:p.capH)??0),gasSubsteps:(p==null?void 0:p.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:0,otherT:0,saltMass:0,saltSolid:0,bodies:{count:this.cpu.bodies.list.filter(x=>!x.gone).length,free:0,awake:0},heaters:g,regions:((n==null?void 0:n.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:a,energyError:f,waterError:u,otherError:0,saltError:0,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:e.extremes.stats()}}budget(){const t=this.last,e=this.totals;let s=0;for(const l of(t==null?void 0:t.regions)??[])l.sealed&&(s-=l.p0*l.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,c={liquid:(t==null?void 0:t.liquidMass)??0,ice:0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:c,other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0},air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,oc()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}const Ou=.3;ut.map(o=>Ur(o.color));var hc;Ur(((hc=qc[0])==null?void 0:hc.color)??"#f4f3ee");function Bu(o,t,e,s,n){const i=-n,r=-n,a=o+2*n,c=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/c>l){const u=a/l;return{x0:i,y0:r-(u-c)/2,x1:i+a,y1:r-(u-c)/2+u}}const f=c*l;return{x0:i-(f-a)/2,y0:r,x1:i-(f-a)/2+f,y1:r+c}}const qs=self,Pt=o=>qs.postMessage(o),cc=8,ju=.1,qu=3,ac=200,Iu=.25,lc=273.15;let rt=null,Z=null,Ue=null,li=null,Be=null,Cs="",Wn=1,Kn=1,zn=1,Is={x0:0,y0:0,x1:1,y1:1},Rs={left:!0,right:!0,bottom:!0,top:!1},Es=!1,xr=1,Ye="none",ca=!1,Je=0,Ls=0,vr=0,Yi=0,Ji=!1,mn=0,fc=0,yr=0,wr=0,uc=!1,br=0,ks=null,Fr=null;const ze=[],Ar=[];let fi=!1;const Os=[];function $r(){if(rt===null)return;const o=rt.scene.sides;Rs={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Wr(o,t,e){Wn=Math.max(1,o),Kn=Math.max(1,t),zn=Math.max(.5,Math.min(3,e)),Be!==null&&(Be.width=Math.round(Wn*zn),Be.height=Math.round(Kn*zn)),rt!==null&&(Is=Bu(rt.boxW,rt.boxH,Wn,Kn,.006))}function aa(o){Ue!==null&&(Ue.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function Qe(o){Ar.push(o),fi||Ru()}async function Ru(){if(Z!==null){fi=!0;try{for(;Ar.length>0;){const o=Ar.shift();await Z.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Pt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{fi=!1,Ls=performance.now()}}}async function Qn(){if(Z===null)return;const o=Z.ctx.device.createCommandEncoder(),t=Z.encodeReadback(o,!1);Z.ctx.device.queue.submit([o.finish()]),t!==null&&await Z.finishReadback(t,!1),Z.baselineFromLast()}function ui(){return rt===null||!rt.needsCpu()?!1:(Pt({type:"gpu",ok:!1,adapter:Cs,message:"other-liquid",scene:rt.serialize()}),!0)}function hi(o){Z!==null&&Ue!==null&&Z.stateVersion!==o&&Ue.reset()}function Zi(){Qe(async()=>{if(Z===null||rt===null||Os.length===0)return;const o=Os.splice(0,Os.length);await Qn(),await Z.download();for(const e of o){const s=rt.apply(e);s!==null&&s.startsWith("refused")&&Pt({type:"refused",message:s})}if(ui())return;const t=Z.stateVersion;Z.upload(),hi(t)})}function Eu(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(Ye==="temperature")return[lc+ve[0],lc+ve[1],e];if(Ye==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return Ye==="velocity"?[0,Math.max(.02,t[1]),e]:Ye==="vapour"?[0,.6,e]:Ye==="salt"?[0,Ou,e]:[0,1,e]}function Du(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return ks={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},ks}return ks!==null&&(t.fate===1||t.fate===2)?{...ks,fate:t.fate===1?"burst":"collapsed"}:null}function Vu(o,t){if(Z===null||li===null)return;if(Z.baselineFromLast(),Z.totals.time>=br){const i=li.sample();i!==null&&(ze.push(i),ze.length>400&&ze.splice(0,ze.length-400),br=Z.totals.time+Iu)}const e=Math.max(.001,(t-mn)/1e3),s=(o.stageMs??Z.stageMs).reduce((i,r)=>i+r,0),n={engine:Z.stats(s),stepsPerSecond:wr/e,simRate:(Z.totals.time-fc)/e,fps:yr/e,renderMs:0,mode:"gpu",adapter:Cs,paused:Es,samples:ze.splice(0,ze.length),bubble:Du(o),object:Fr!==null&&rt!==null?Hf(rt,Fr):null,overlayScale:Eu(o)};Pt({type:"stats",stats:n}),yr=0,wr=0,fc=Z.totals.time,mn=t}function _r(){var t;const o=performance.now();if(Z!==null&&Ue!==null&&Be!==null&&rt!==null&&!fi){const e=Z.ctx.device,s=Ls===0?0:Math.min(.1,(o-Ls)/1e3);Ls=o;const n=((t=Z.last)==null?void 0:t.dt)??rt.dt;let i=0;Es?(i=Math.min(cc,vr),vr-=i,Je=0):(Je=Math.min(Je+s*xr,ju*Math.max(1,xr)),i=Yi>=qu?0:Math.min(cc,Math.floor(Je/Math.max(1e-5,n))),Je-=i*n);const r=!Ji&&o-mn>ac&&(i>0||Es||o-mn>4*ac),a=e.createCommandEncoder();i>0&&Z.encodeSteps(a,i,r);const c=r?Z.encodeReadback(a,r&&i>0):null;if(Ue.encode(a,Is,Be.width,Be.height,Rs,Ye,ca),e.queue.submit([a.finish()]),Yi+=1,e.queue.onSubmittedWorkDone().then(()=>{Yi-=1}),wr+=i,yr+=1,c!==null){Ji=!0;const l=i>0;Z.finishReadback(c,l).then(f=>{Ji=!1,f!==null&&Vu(f,performance.now())})}}typeof qs.requestAnimationFrame=="function"?qs.requestAnimationFrame(_r):setTimeout(_r,16)}async function Nu(o){if(rt=new k0(o.scene),Es=o.paused===!0,ui())return;if(Be=o.canvas,Be===null)throw new Error("no OffscreenCanvas");Z=await Hr.create(rt),Cs=await(async()=>{var e;try{const s=await((e=qs.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),Ue=new Cu(Z,Be),await Ue.init(),aa(o.dark),li=new Zc(Z),Z.ctx.device.addEventListener("uncapturederror",e=>Pt({type:"error",message:`WebGPU: ${e.error.message}`})),Z.ctx.device.lost.then(e=>Pt({type:"gpu",ok:!1,adapter:Cs,message:e.message||e.reason})),$r(),Wr(o.width,o.height,o.dpr),Pt({type:"gpu",ok:!0,adapter:Cs,message:""}),Pt({type:"ready",offscreen:!0,warnings:rt.warnings,view:Is,quality:rt.currentQuality,walls:Rs}),mn=performance.now(),Ls=performance.now(),uc||(uc=!0,_r())}function tr(){if(Z===null||rt===null)return;const o=Z.stateVersion;Z.cpu=rt,Z.rebuild(),Z.resetTotals(),hi(o),li=new Zc(Z),br=0,ze.length=0,Je=0,ks=null,$r(),Wr(Wn,Kn,zn),Pt({type:"view",view:Is,walls:Rs})}qs.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Pt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&qs.navigator.gpu!==void 0});break;case"init":Nu(t).catch(e=>Pt({type:"gpu",ok:!1,adapter:Cs,message:e instanceof Error?e.message:String(e)}));break;case"resize":Wr(t.width,t.height,t.dpr),Pt({type:"view",view:Is,walls:Rs});break;case"op":Os.push(t.op),Zi();break;case"addLiquid":Os.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Zi();break;case"addSolid":Os.push({op:"solid",region:t.region,material:t.material,T:t.T}),Zi();break;case"setHeater":rt==null||rt.setHeater(t.group,t.mode,t.power,t.target,t.on),Z==null||Z.writeHeater(t.group);break;case"setAmbient":rt==null||rt.setAmbient(t.p,t.T,t.rh,t.g,t.air),Z==null||Z.writeParams();break;case"setBoundary":Qe(async()=>{if(Z===null||rt===null)return;await Qn(),await Z.download(),rt.setBoundary(t.side,t.value);const e=Z.stateVersion;Z.upload(),hi(e),$r(),Pt({type:"view",view:Is,walls:Rs})});break;case"query":Qe(async()=>{if(Z===null||rt===null){Pt({type:"reply",id:t.id,data:null});return}await Qn(),await Z.download(),Pt({type:"reply",id:t.id,data:rt.query(t.x,t.y)})});break;case"select":ks=null,Z==null||Z.watch(t.bubble);break;case"overlay":Ye=t.overlay;break;case"particles":ca=t.on;break;case"pause":Es=t.paused,Je=0,Ls=performance.now();break;case"step":Es&&(vr+=1);break;case"setSpeed":xr=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":rt==null||rt.setExtremes(t.mode),Z==null||Z.writeParams();break;case"setQuality":Qe(async()=>{rt!==null&&(rt.setQuality(t.quality),tr())});break;case"serialize":Z===null?Pt({type:"reply",id:t.id,data:(rt==null?void 0:rt.serialize())??null}):Qe(async()=>{Pt({type:"reply",id:t.id,data:(rt==null?void 0:rt.serialize())??null})});break;case"load":Qe(async()=>{rt!==null&&(rt.load(t.scene),!ui()&&tr())});break;case"selectObject":Fr=t.object;break;case"editObject":Qe(async()=>{if(Z===null||rt===null){Pt({type:"reply",id:t.id,data:null});return}await Qn(),await Z.download();const e=Gf(rt,t.object,t.patch);if(Pt({type:"reply",id:t.id,data:e}),ui())return;if(e.rebuilt){tr();return}const s=Z.stateVersion;Z.upload(),hi(s)});break;case"theme":aa(t.dark);break;case"frameDone":break}}catch(e){Pt({type:"error",message:e instanceof Error?e.message:String(e)})}});
