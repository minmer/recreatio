var el=Object.defineProperty;var sl=(o,t,e)=>t in o?el(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var y=(o,t,e)=>sl(o,typeof t!="symbol"?t+"":t,e);function nl(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,a)=>(r[0]-i[0])*(a[1]-i[1])-(r[1]-i[1])*(a[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const il={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},rl=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],ol=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],cl={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},al=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var ll={ambient:il,species:rl,solutes:ol,vapourInAir:cl,solids:al};const Bt=8.314462618,Ii=9.80665,gn=101325,et=273.15,mi=1602176634e-28,Kc=1380649e-29,zc=602214076e15,Qc=88541878128e-22,G=0,it=1,ft=2,ot=0,ct=1,X=2,at=6,yt=3,_t=ll,It=_t.species[0],Ys=_t.species[1],Zs=_t.species[2],mt=new Float64Array(at);mt[ot]=Ys.molarMass.v;mt[ct]=Zs.molarMass.v;mt[X]=It.molarMass.v;Ys.name,Zs.name,It.vapour.name;const eo=Ys.gas.cp.v,so=Zs.gas.cp.v,[xn,vn,We]=It.vapour.cp.linear;function fl(o,t){return o===X?xn+vn*(t-We):o===ot?eo:o===ct?so:0}const Ye=It.liquid.kell.c,Cn=It.liquid.cp.table,Mt=new Float64Array(Cn.map(o=>o[0])),qt=new Float64Array(Cn.map(o=>o[1])),ne=new Float64Array(Cn.length);ne[0]=qt[0]*(Mt[0]-et);for(let o=1;o<Cn.length;o+=1)ne[o]=ne[o-1]+.5*(qt[o]+qt[o-1])*(Mt[o]-Mt[o-1]);const Gt=Cn.length-1;function Xc(o){if(o<Mt[0])return-1;if(o>=Mt[Gt])return Gt;let t=Math.min(Gt-1,Math.max(0,Math.floor((o-et)/10)));for(;t>0&&o<Mt[t];)t-=1;for(;t<Gt-1&&o>=Mt[t+1];)t+=1;return t}function Re(o){const t=Xc(o);return t<0?qt[0]:t===Gt?qt[Gt]:qt[t]+(qt[t+1]-qt[t])*(o-Mt[t])/(Mt[t+1]-Mt[t])}function Ft(o){const t=Xc(o);if(t<0)return ne[0]+qt[0]*(o-Mt[0]);if(t===Gt)return ne[Gt]+qt[Gt]*(o-Mt[Gt]);const e=o-Mt[t],s=(qt[t+1]-qt[t])/(Mt[t+1]-Mt[t]);return ne[t]+qt[t]*e+.5*s*e*e}function Yc(o){if(o<ne[0])return Mt[0]+(o-ne[0])/qt[0];if(o>=ne[Gt])return Mt[Gt]+(o-ne[Gt])/qt[Gt];let t=Math.min(Gt-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<ne[t];)t-=1;for(;t<Gt-1&&o>=ne[t+1];)t+=1;const e=(qt[t+1]-qt[t])/(Mt[t+1]-Mt[t]),s=o-ne[t],n=qt[t];return Mt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function yn(o){const t=o-et;return(Ye[0]+t*(Ye[1]+t*(Ye[2]+t*(Ye[3]+t*(Ye[4]+t*Ye[5])))))/(1+Ye[6]*t)}const $i=It.liquid.k.poly;function pi(o){const t=Math.min(150,Math.max(0,o-et));return $i[0]+t*($i[1]+t*$i[2])}const[ul,hl,_o]=It.liquid.mu.vogel;function Ri(o){return ul*Math.pow(10,hl/(Math.max(o,_o+60)-_o))}const Wi=It.surfaceTension,dl=It.saturation.Tc.v;function Ei(o){const t=Math.max(0,1-o/dl);return Wi.B*Math.pow(t,Wi.mu)*(1+Wi.b*t)}const ml=It.saturation.hlv100.v,wn=et+100,Zc=Ft(wn)+ml,pl=It.vapour.k.v,gl=It.vapour.mu.v;function xt(o){const t=o-We,e=wn-We;return Zc+xn*(o-wn)+.5*vn*(t*t-e*e)}function Jc(o){return xt(o)-Ft(o)}function ie(o,t){return o===X?xt(t):fl(o,t)*(t-et)}const Ki=Ys.gas.k.power,zi=Zs.gas.k.power,xl=Ys.gas.mu.sutherland,vl=Zs.gas.mu.sutherland,Qi=_t.vapourInAir,ta=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),ea=150,gi=1001,On=o=>{const t=new Float64Array(gi);for(let e=0;e<gi;e+=1)t[e]=o(ea+e);return t},hs=(o,t)=>{let e=t-ea;e>0?e>gi-1.001&&(e=gi-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Ao=On(o=>Ki[0]*Math.pow(o/Ki[1],Ki[2])),yl=On(o=>zi[0]*Math.pow(o/zi[1],zi[2])),To=On(o=>ta(xl,o)),wl=On(o=>ta(vl,o)),bl=On(o=>Qi.D0.v*Math.pow(o/Qi.T0.v,Qi.exponent.v));function sa(o,t,e,s){const n=o+t+e;return n>0?(o*hs(Ao,s)+t*hs(yl,s)+e*pl)/n:hs(Ao,s)}function Fl(o,t,e,s){const n=o+t+e;return n>0?(o*hs(To,s)+t*hs(wl,s)+e*gl)/n:hs(To,s)}function _l(o,t){return hs(bl,o)*(gn/t)}function na(o,t,e,s){const n=o*eo+t*so,i=wn-We,r=.5*e*vn,a=n+e*xn;if(a<=0)return et;const c=n*(We-et)+e*(Zc+xn*(We-wn)-.5*vn*i*i)-s,l=a*a-4*r*c;return We+-2*c/(a+Math.sqrt(l>0?l:0))}function Lr(o,t,e,s,n){return o*eo+t*so+e*(xn+vn*(n-We))+(s>0?s*Re(n):0)}const Al=_t.ambient.air.N2.v,Tl=_t.ambient.air.O2.v,ia=_t.ambient.hExt.v,ut=_t.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function Bs(o){return ut.findIndex(t=>t.id===o)}const lt=0,ra=_t.species.slice(3),Po=[null,...ra.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*et+.5*s*et*et}})],Jt=[{id:It.id,name:It.name,short:It.liquid.name,color:It.liquid.color,volatile:!0,range:[et,et+150]},...ra.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function oa(o){return Jt.findIndex(t=>t.id===o)}const ws=o=>Po[o]??Po[1];function no(o,t){if(o===lt)return Re(t);const e=ws(o);return e.cA+e.cB*t}function Pl(o,t){if(o===lt)return Ft(t);const e=ws(o);return e.cA*t+.5*e.cB*t*t-e.h0}function kl(o,t){if(o===lt)return Yc(t);const e=ws(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function ps(o,t){if(o===lt)return yn(t);const e=ws(o);return e.rA+e.rB*t}function hn(o,t){if(o===lt)return pi(t);const e=ws(o);return e.kA+e.kB*t}function bn(o,t){if(o===lt)return Ri(t);const e=ws(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function Ds(o,t){return o===lt?Ei(t):ws(o).sigma}It.thermo,Ys.thermo,Zs.thermo;const qn=_t.species[0].saturation,Ae=qn.if97.n,ca=Ae[0],aa=Ae[1],la=Ae[2],fa=Ae[3],ua=Ae[4],ha=Ae[5],da=Ae[6],ma=Ae[7],pa=Ae[8],Cr=Ae[9],dn=qn.Tc.v,Sl=qn.rhoc.v,xi=273.15,Fs=qn.vapourDensity.c;qn.liquidDensity.b;function Di(o){const t=o<xi?xi:o>dn?dn:o,e=t+pa/(t-Cr),s=e*e+ca*e+aa,n=la*e*e+fa*e+ua,i=ha*e*e+da*e+ma,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+la*e+ha,n=ca*e*e+fa*e+da,i=aa*e*e+ua*e+ma,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=Cr+r;return(a-Math.sqrt(a*a-4*(pa+Cr*r)))/2}function ga(o){const e=1-(o<xi?xi:o>dn?dn:o)/dn,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,c=a*a*s,l=c*a*r*r;return Sl*Math.exp(Fs[0]*n+Fs[1]*i+Fs[2]*r+Fs[3]*a+Fs[4]*c+Fs[5]*l)}const vi=250,yi=.01,jn=25001,ii=new Float64Array(jn),ri=new Float64Array(jn);for(let o=0;o<jn;o+=1)ii[o]=Di(vi+o*yi),ri[o]=ga(vi+o*yi);function Fn(o){const t=(o-vi)/yi;if(!(t>=0)||t>=jn-1)return Di(o);const e=t|0;return ii[e]+(t-e)*(ii[e+1]-ii[e])}function je(o){const t=(o-vi)/yi;if(!(t>=0)||t>=jn-1)return ga(o);const e=t|0;return ri[e]+(t-e)*(ri[e+1]-ri[e])}const $t=_t.solutes[0],xa=_t.species[0],Vi=xa.molarMass.v,Qe=$t.molarMass.v,Ml=$t.ions.v,Ni=1,io=_t.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function va(o){return io.findIndex(t=>t.id===o)}function ya(o){return o>0?o*Qe/(1+o*Qe):0}const pe=298.15,Bn=$t.pitzer,Ll=Bn.b0.a,Cl=Bn.b1.a,Ol=Bn.c.a,ql=Bn.b.v,jl=Bn.alpha.v,oi=$t.pitzerCold,Bl=oi.below.v;function Xi(o,t){return o[0]+o[1]*(1/t-1/pe)+o[2]*Math.log(t/pe)+o[3]*(t-pe)+o[4]*(t*t-pe*pe)+o[5]*(1/(t*t)-1/(pe*pe))}const Nn=$t.dielectric.c;function Il(o){const t=o-et;return Nn[0]+t*(Nn[1]+t*(Nn[2]+t*Nn[3]))}function Rl(o){const t=mi*mi/(4*Math.PI*Qc*Il(o)*Kc*o);return Math.sqrt(2*Math.PI*zc*yn(o))*t*Math.sqrt(t)/3}function El(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<Bl,n=Xi(s?oi.b0.a:Ll,o),i=Xi(s?oi.b1.a:Cl,o),r=Xi(s?oi.c.a:Ol,o);return 1-Rl(o)*e/(1+ql*e)+t*(n+i*Math.exp(-jl*e))+t*t*r}function wi(o,t){return t>0?Math.exp(-Ml*t*El(o,t)*Vi):1}const wa=240,bi=221,ba=.05,Ge=181;let Yi=null;function Dl(){if(Yi!==null)return Yi;const o=new Float64Array(bi*Ge);for(let t=0;t<bi;t+=1)for(let e=0;e<Ge;e+=1)o[t*Ge+e]=wi(wa+t,e*ba);return Yi=o,o}function Fa(o,t){if(!(t>0))return 1;const e=t/ba;if(e>=Ge-1)return wi(o,t);const s=Dl();let n=o-wa;n>0?n>bi-1.000001&&(n=bi-1.000001):n=0;const i=n|0,r=e|0,a=n-i,c=e-r,l=i*Ge+r,f=s[l]+c*(s[l+1]-s[l]),u=s[l+Ge]+c*(s[l+Ge+1]-s[l+Ge]);return f+a*(u-f)}function _a(o,t){let e=kt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(o/Fa(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Ui=xa.fusion,re=Ui.T.v,ro=Ui.h.v,Vl=Ui.cpIce.v;Ui.rhoIce.v;function Nl(o){const t=Re(re)-Vl;return Vi/Bt*((ro-t*re)*(1/re-1/o)+t*Math.log(o/re))}const Ul=$t.eutectic.T.v,Hl=$t.eutectic.w.v;function Aa(o){if(!(o>0))return re;if(ya(o)>=Hl)return Ul;const t=s=>Math.log(wi(s,o))-Nl(s);let e=re+Math.log(wi(re,o))*Bt*re*re/(Vi*ro);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return re;if(Math.abs(r)<1e-9)break}return e}const De=$t.solubility.table;function Gl(o){if(o<=De[0][0])return De[0][1];for(let t=1;t<De.length;t+=1)if(o<=De[t][0]){const[e,s]=De[t-1],[n,i]=De[t];return s+(i-s)*(o-e)/(n-e)}return De[De.length-1][1]}function $l(o){return ya(Gl(o))}const Wl=$t.solid.rho.v,bs=$t.solid.cp.v;function Hi(o){return bs*(o-et)}const en=$t.density.laliberte;function Kl(o,t){const e=o-et,s=e+en[4];return(en[0]*t+en[1])*Math.exp(1e-6*s*s)/(t+en[2]+en[3]*e)}function oo(o,t){return t>0?1/((1-t)/yn(o)+t/Kl(o,t)):yn(o)}const Js=$t.cp.laliberte,Gi=Js[0],zl=Js[1],Ql=Js[2],_n=Js[3],co=Js[4],An=Js[5],gs=$t.cp.range.lo,Fi=$t.cp.range.hi,ds=.5,Be=Math.round((Fi-gs)/ds)+1,Zt=new Float64Array(Be),Tn=new Float64Array(Be);for(let o=0;o<Be;o+=1){const t=gs+o*ds-et;Zt[o]=Math.exp(zl*t+Ql*Math.exp(.01*t))}Tn[0]=Zt[0]*(gs-et);for(let o=1;o<Be;o+=1)Tn[o]=Tn[o-1]+.5*(Zt[o-1]+Zt[o])*ds;function Ta(o){if(o<=gs)return Zt[0];if(o>=Fi)return Zt[Be-1];const t=(o-gs)/ds,e=Math.min(Be-2,t|0);return Zt[e]+(t-e)*(Zt[e+1]-Zt[e])}function In(o){if(o<=gs)return Zt[0]*(o-et);if(o>=Fi)return Tn[Be-1]+Zt[Be-1]*(o-Fi);const t=(o-gs)/ds,e=Math.min(Be-2,t|0),s=(t-e)*ds;return Tn[e]+Zt[e]*s+.5*(Zt[e+1]-Zt[e])*s*s/ds}const ao=o=>1e3*Gi*o*Math.exp(_n*o),lo=o=>1e3*co*Math.pow(o,An+1),fo=$t.dHsol.v/Qe+Hi(pe)-1e3*Gi*In(pe);function Pa(o,t){return t>0?(1-t)*Ft(o)+t*fo+ao(t)*In(o)+lo(t)*(o-et):Ft(o)}function Xl(o,t){return t>0?(1-t)*Re(o)+ao(t)*Ta(o)+lo(t):Re(o)}function Yl(o,t,e){if(!(t>0))return Yc(o);const s=ao(t),n=lo(t),i=t*fo,r=1-t;let a=e>200&&e<900?e:et+(o-i)/(4e3*r+800*t);for(let c=0;c<30;c+=1){const f=(r*Ft(a)+i+s*In(a)+n*(a-et)-o)/(r*Re(a)+s*Ta(a)+n);if(a-=f,Math.abs(f)<1e-8)break}return a}function ko(o,t){const e=Math.exp(_n*t),s=1e3*Gi*e*(t+(1-t)*(1+_n*t)),n=t>0?1e3*co*Math.pow(t,An)*(t+(1-t)*(An+1)):0;return fo+s*In(o)+n*(o-et)}const Zl=$t.diffusivity.v,Jl=Ri(pe);function So(o){return Zl*(o/pe)*Jl/Ri(o)}function ci(o,t){return t>0?Ft(o)-1e3*Gi*_n*t*t*Math.exp(_n*t)*In(o)-1e3*co*An*Math.pow(t,An+1)*(o-et):Ft(o)}const tf=1e-6;function Ee(o){var t;return((t=ut[o])==null?void 0:t.id)==="ice"?re:NaN}function un(o){return Ee(o)>0?Ft(re)-ut[o].cp*(re-et)-ro:0}function Or(o,t,e,s){return(o+e*bs)*(s-et)+t*Ft(s)}function uo(o,t,e,s,n){const i=t+s*bs;if(!(i>0))return n;if(e<=0)return et+o/i;let r=n>100?n:et+o/i;for(let a=0;a<3;a+=1)r-=(i*(r-et)+e*Ft(r)-o)/(i+e*Re(r));return r}class Rt{constructor(t,e,s,n){y(this,"mat",0);y(this,"heater",-1);y(this,"nr",0);y(this,"xs",[]);y(this,"ys",[]);y(this,"ni",new Int32Array(0));y(this,"nj",new Int32Array(0));y(this,"off",new Int32Array(0));y(this,"ncell",0);y(this,"E",new Float64Array(0));y(this,"film",new Float64Array(0));y(this,"crust",new Float64Array(0));y(this,"x",0);y(this,"y",0);y(this,"a",0);y(this,"vx",0);y(this,"vy",0);y(this,"w",0);y(this,"ux",0);y(this,"uy",0);y(this,"uw",0);y(this,"m",0);y(this,"I",0);y(this,"ma",0);y(this,"Ia",0);y(this,"ma6",new Float64Array(6));y(this,"maOk",!1);y(this,"pinned",!0);y(this,"asleep",!0);y(this,"gone",!1);y(this,"rest",0);y(this,"rx",0);y(this,"ry",0);y(this,"ra",0);y(this,"rmax",0);y(this,"hullA",0);y(this,"hullJ",0);y(this,"nseg",0);y(this,"segR",new Int32Array(0));y(this,"segS",new Uint8Array(0));y(this,"segT0",new Float64Array(0));y(this,"segT1",new Float64Array(0));y(this,"nw",0);y(this,"wk",new Int32Array(0));y(this,"wc",new Int32Array(0));y(this,"ww",new Float64Array(0));y(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,a,c=-1){const l=new Rt(t,e,s,n);l.mat=i,l.heater=c;const f=[],u=[];for(const[m,p,d,g]of r)!(d>m)||!(g>p)||(f.push(Rt.splits(m,d,s)),u.push(Rt.splits(p,g,s)));l.setRects(f,u);const h=ut[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=h.rho*h.cp*l.cellVolume(m)*(a-et);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=ut[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return uo(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],a=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[a])continue;let c=0;for(;c<r-1&&t>n[c+1];)c+=1;let l=0;for(;l<a-1&&e>i[l+1];)l+=1;return this.off[s]+c+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=un(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=ut[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const u=Math.cos(this.a),h=Math.sin(this.a),m=u*e-h*s,p=h*e+u*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const a=[];for(let u=0;u<this.nr;u+=1){const[h,m,p,d]=this.bounds(u),g=p-h,v=d-m,w=t*g*v*this.depth,x=.5*(h+p),_=.5*(m+d);n+=w,i+=w*((g*g+v*v)/12+x*x+_*_);for(const[F,T]of[[h,m],[p,m],[p,d],[h,d]])a.push([F,T]),r=Math.max(r,Math.hypot(F,T))}this.m=n,this.I=i,this.rmax=r;const c=nl(a);let l=0,f=0;for(let u=0;u<c.length;u+=1){const[h,m]=c[u],[p,d]=c[(u+1)%c.length],g=h*d-p*m;l+=g/2,f+=g*(h*h+h*p+p*p+m*m+m*d+d*d)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(f),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,a,c]=this.bounds(n),l=(a-i)*(c-r);e+=l,s+=l*(t===0?.5*(i+a):.5*(r+c))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=tf*this.dx;for(let r=0;r<this.nr;r+=1){const[a,c,l,f]=this.bounds(r);for(let u=0;u<4;u+=1){const h=u<2,m=u===0?a:u===1?l:u===2?c:f;let p=[h?[c,f]:[a,l]];for(let d=0;d<this.nr&&p.length>0;d+=1){if(d===r)continue;const[g,v,w,x]=this.bounds(d);if(!(u===0?Math.abs(w-m)<=i:u===1?Math.abs(g-m)<=i:u===2?Math.abs(x-m)<=i:Math.abs(v-m)<=i))continue;const F=h?v:g,T=h?x:w,A=[];for(const[b,P]of p){if(T<=b||F>=P){A.push([b,P]);continue}F>b&&A.push([b,F]),T<P&&A.push([T,P])}p=A}for(const[d,g]of p)g-d<=i||(t.push(r),e.push(u),s.push(d),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),a=this.segS[t],c=this.segT0[t],l=this.segT1[t];a===0?(e[0]=s,e[1]=c,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):a===1?(e[0]=i,e[1]=c,e[2]=i,e[3]=l,e[4]=1,e[5]=0):a===2?(e[0]=c,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=c,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s),l=n-t,f=i-e;r[0]=a*l+c*f,r[1]=-c*l+a*f}static toWorld(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s);r[0]=t+a*n-c*i,r[1]=e+c*n+a*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,a=this.y-e;this.x=t+n*r-i*a,this.y=e+i*r+n*a,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let a=1/0,c=1/0,l=-1/0,f=-1/0;for(let u=0;u<this.nr;u+=1){const[h,m,p,d]=this.bounds(u);for(let g=0;g<4;g+=1){const v=g===0||g===3?h:p,w=g<2?m:d,x=t+i*v-r*w,_=e+r*v+i*w;x<a&&(a=x),x>l&&(l=x),_<c&&(c=_),_>f&&(f=_)}}n[0]=a,n[1]=c,n[2]=l,n[3]=f}}const ef=.004,sf=.02,Un=1e-7,nf=.22,rf=2.5;class of{constructor(t,e){y(this,"nx",0);y(this,"ny",0);y(this,"count",0);y(this,"points",[Mo(),Mo()]);y(this,"friction");y(this,"bounce");y(this,"touched",!0);y(this,"k11",0);y(this,"k12",0);y(this,"k22",0);y(this,"i11",0);y(this,"i12",0);y(this,"i22",0);y(this,"block",!1);y(this,"h",1/120);y(this,"slop",ef);y(this,"spec",sf);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function Mo(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function cf(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?af(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?Lo(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?Lo(o,e,t,!0):lf(o,t,e);for(let a=0;a<o.count;a+=1){const c=o.points[a];c.jn=0,c.jt=0;for(let l=0;l<r;l+=1)if(s[l]===c.id){c.jn=n[l],c.jt=i[l];break}}return o.count}function _i(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function af(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,a=Math.hypot(i,r);if(a>s+n+o.spec)return;const c=a>1e-9?i/a:0,l=a>1e-9?r/a:1;o.nx=c,o.ny=l,_i(o,t.x+c*(s-(s+n-a)/2),t.y+l*(s-(s+n-a)/2),a-s-n,0)}function Lo(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,a=0;for(let w=0;w<n.n;w+=1){const x=(e.x-t.wx[w])*t.wnx[w]+(e.y-t.wy[w])*t.wny[w];if(x>i+o.spec)return;x>r&&(r=x,a=w)}const c=(a+1)%n.n,l=t.wx[a],f=t.wy[a],u=t.wx[c],h=t.wy[c];let m,p,d,g,v;if(r<1e-9)m=t.wnx[a],p=t.wny[a],v=r-i,d=e.x-m*i,g=e.y-p*i;else{const w=(e.x-l)*(u-l)+(e.y-f)*(h-f),x=(e.x-u)*(l-u)+(e.y-h)*(f-h);if(w<=0||x<=0){const _=w<=0?l:u,F=w<=0?f:h,T=e.x-_,A=e.y-F,b=Math.hypot(T,A);if(b>i+o.spec)return;m=b>1e-9?T/b:t.wnx[a],p=b>1e-9?A/b:t.wny[a],v=b-i,d=_,g=F}else m=t.wnx[a],p=t.wny[a],v=r-i,d=e.x-m*i,g=e.y-p*i}o.nx=s?-m:m,o.ny=s?-p:p,_i(o,d,g,v,a)}function Co(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const a=o.wnx[r],c=o.wny[r],l=o.wx[r],f=o.wy[r];let u=1/0;for(let h=0;h<s.n;h+=1){const m=(t.wx[h]-l)*a+(t.wy[h]-f)*c;m<u&&(u=m)}u>n&&(n=u,i=r)}return{sep:n,edge:i}}function lf(o,t,e){const s=Co(t,e);if(s.sep>o.spec)return;const n=Co(e,t);if(n.sep>o.spec)return;let i=t,r=e,a=s.edge,c=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,a=n.edge,c=!0);const l=i.shape,f=r.shape;if(l.kind!=="poly"||f.kind!=="poly")return;const u=(a+1)%l.n,h=i.wx[a],m=i.wy[a],p=i.wx[u],d=i.wy[u],g=i.wnx[a],v=i.wny[a];let w=1/0,x=0;for(let V=0;V<f.n;V+=1){const z=r.wnx[V]*g+r.wny[V]*v;z<w&&(w=z,x=V)}const _=(x+1)%f.n;let F=r.wx[x],T=r.wy[x],A=r.wx[_],b=r.wy[_],P=x,M=_;const k=Math.hypot(p-h,d-m)||1,S=(p-h)/k,O=(d-m)/k,C=S*h+O*m,I=S*p+O*d;for(const[V,z]of[[-1,-C],[1,I]]){const N=V*(S*F+O*T)-z,Z=V*(S*A+O*b)-z;if(N>Un&&Z>Un)return;if(N>Un){const tt=N/(N-Z);F+=(A-F)*tt,T+=(b-T)*tt,P=200+a}else if(Z>Un){const tt=N/(N-Z);A=F+(A-F)*tt,b=T+(b-T)*tt,M=300+a}}const j=(c?1e4:0)+a*1e3,D=(F-h)*g+(T-m)*v,E=(A-h)*g+(b-m)*v;o.nx=c?-g:g,o.ny=c?-v:v,D<=o.spec&&_i(o,F-g*D/2,T-v*D/2,D,j+P),E<=o.spec&&_i(o,A-g*E/2,b-v*E/2,E,j+M)}function ff(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,a=-n;for(let c=0;c<o.count;c+=1){const l=o.points[c];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const f=l.rax*i-l.ray*n,u=l.rbx*i-l.rby*n,h=e.invM+s.invM+e.invI*f*f+s.invI*u*u;l.massN=h>0?1/h:0;const m=l.rax*a-l.ray*r,p=l.rbx*a-l.rby*r,d=e.invM+s.invM+e.invI*m*m+s.invI*p*p;l.massT=d>0?1/d:0,l.bias=l.sep>0?-l.sep/t:Math.min(rf,nf/t*Math.max(0,-l.sep-o.slop));const g=s.vx-s.w*l.rby-e.vx+e.w*l.ray,v=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,w=g*n+v*i;l.bounce=w<-.6&&(l.sep<=o.slop||l.sep+w*t<0)?-o.bounce*w:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const c=o.points[0],l=o.points[1],f=c.rax*i-c.ray*n,u=c.rbx*i-c.rby*n,h=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,p=e.invM+s.invM;o.k11=p+e.invI*f*f+s.invI*u*u,o.k22=p+e.invI*h*h+s.invI*m*m,o.k12=p+e.invI*f*h+s.invI*u*m;const d=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*d&&d>0&&(o.block=!0,o.i11=o.k22/d,o.i12=-o.k12/d,o.i22=o.k11/d)}}function uf(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];Pn(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function hf(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,f=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,u=l*i+f*r,h=o.friction*c.jn,m=Math.max(-h,Math.min(h,c.jt-c.massT*u)),p=m-c.jt;c.jt=m,Pn(t,e,p*i,p*r,c)}if(o.block){df(o);return}for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,f=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,u=l*s+f*n;c.bounce===0&&o.bounce>=.5&&u<-.6&&(c.sep<=o.slop||c.sep+u*o.h<0)&&(c.bounce=-o.bounce*u);const h=Math.max(c.jn+c.massN*(-u+qr(c)),c.fixed),m=h-c.jn;c.jn=h,Pn(t,e,m*s,m*n,c),c.bounce>0&&(c.fixed=h,c.bounce=-1,c.kicked=!0)}}const qr=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function Pn(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function df(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],a=d=>{const g=e.vx-e.w*d.rby-t.vx+t.w*d.ray,v=e.vy+e.w*d.rbx-t.vy-t.w*d.rax;return g*s+v*n},c=i.jn,l=r.jn,f=a(i)-qr(i)-(o.k11*c+o.k12*l),u=a(r)-qr(r)-(o.k12*c+o.k22*l),h=(d,g)=>{const v=d-c,w=g-l;Pn(t,e,v*s,v*n,i),Pn(t,e,w*s,w*n,r),i.jn=d,r.jn=g};let m=-(o.i11*f+o.i12*u),p=-(o.i12*f+o.i22*u);if(m>=0&&p>=0){h(m,p);return}if(m=-f/o.k11,p=0,m>=0&&o.k12*m+u>=0){h(m,p);return}if(m=0,p=-u/o.k22,p>=0&&o.k12*p+f>=0){h(m,p);return}f>=0&&u>=0&&h(0,0)}const mf=10,sn={friction:.5,bounce:.1},pf=.01;function Ze(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),a=new Float64Array([-1,0,1,0]);let c=0;for(let l=0;l<4;l+=1)c=Math.max(c,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:a,n:4,radius:c}}class _s{constructor(t,e,s,n){y(this,"wx");y(this,"wy");y(this,"wnx");y(this,"wny");y(this,"minX",0);y(this,"minY",0);y(this,"maxX",0);y(this,"maxY",0);y(this,"invM",0);y(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let a=1/0,c=1/0,l=-1/0,f=-1/0;for(let u=0;u<t.n;u+=1){const h=s+i*t.xs[u]-r*t.ys[u],m=n+r*t.xs[u]+i*t.ys[u];this.wx[u]=h,this.wy[u]=m,this.wnx[u]=i*t.nx[u]-r*t.ny[u],this.wny[u]=r*t.nx[u]+i*t.ny[u],h<a&&(a=h),h>l&&(l=h),m<c&&(c=m),m>f&&(f=m)}this.minX=a,this.minY=c,this.maxX=l,this.maxY=f}}class gf{constructor(t){y(this,"parts",[]);y(this,"byBody",[]);y(this,"builtFor",-1);y(this,"warmKey",new Float64Array(0));y(this,"warmData",new Float64Array(0));y(this,"warmCount",0);y(this,"touching",new Uint8Array(0));y(this,"toWake",[]);y(this,"cache",new Map);y(this,"live",[]);y(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,a]=t.bounds(s);e[s].shape=Ze(n,i,r,a),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new _s(1,null,Ze(-1,-1,0,r+1),sn)),s.openR||n.push(new _s(2,null,Ze(i,-1,i+1,r+1),sn)),s.openB||n.push(new _s(3,null,Ze(-1,-1,i+1,0),sn)),s.openT||n.push(new _s(4,null,Ze(-1,r,i+1,r+1),sn));const{nx:a,ny:c,dx:l}=s;let f=new Map,u=10;for(let h=0;h<=c;h+=1){const m=new Map;if(h<c){let p=0;for(;p<a;){const d=p+h*a;if(s.solid[d]===0||s.owner[d]!==0){p+=1;continue}const g=s.solid[d];let v=p;for(;v+1<a&&s.solid[v+1+h*a]===g&&s.owner[v+1+h*a]===0;)v+=1;const w=g<<24|p<<12|v;m.set(w,f.has(w)?f.get(w):h),p=v+1}}for(const[p,d]of f){if(m.get(p)===d)continue;const g=this.solidMaterial(p>>>24);n.push(new _s(u++,null,Ze((p>>12&4095)*l,d*l,((p&4095)+1)*l,h*l),g))}f=m}this.byBody=t.map(()=>[]);for(const h of t){if(h.gone)continue;const m=this.solidMaterial(h.mat+1);for(let p=0;p<h.nr;p+=1){const[d,g,v,w]=h.bounds(p),x=Ze(d,g,v,w),_=new _s(1e5+h.index*1e3+p,h,x,m);n.push(_),this.byBody[h.index].push(_)}}for(const h of n)h.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=ut[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:sn}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const f of this.parts){const u=f.body;if(u===null)continue;const h=u.awake;f.invM=h?1/u.m:0,f.invI=h?1/u.I:0,f.update()}for(const f of this.cache.values())f.touched=!1;const r=this.live,a=this.liveKey;r.length=0,a.length=0;const c=this.parts;for(let f=0;f<c.length;f+=1){const u=c[f];for(let h=f+1;h<c.length;h+=1){const m=c[h],p=u.invM>0,d=m.invM>0;if(!p&&!d||u.body!==null&&u.body===m.body||m.minX>u.maxX+i||m.maxX<u.minX-i||m.minY>u.maxY+i||m.maxY<u.minY-i)continue;const g=u.id*1e6+m.id;let v=this.cache.get(g);v===void 0&&(v=new of(u,m),v.slop=n,v.spec=i,this.restore(v,g),this.cache.set(g,v)),v.touched=!0,cf(v)>0?(r.push(v),a.push(g)):v.count=0}}const l=a.map((f,u)=>u).sort((f,u)=>a[f]-a[u]);for(const f of l)ff(r[f],t);for(const f of l)uf(r[f]);for(let f=0;f<mf;f+=1)for(const u of l)hf(r[u]);for(const f of l){const u=r[f],h=u.a.body,m=u.b.body;if(h!==null&&(this.touching[h.index]=1),m!==null&&(this.touching[m.index]=1),h!==null&&m!==null&&h.asleep!==m.asleep&&!h.pinned&&!m.pinned){const p=h.asleep?m:h,d=h.asleep?h:m;p.speed()>pf&&this.toWake.push(d.index)}}for(const[f,u]of this.cache)(!u.touched||u.count===0)&&this.cache.delete(f);this.save(l.map(f=>a[f]),l.map(f=>r[f]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let a=0;a<2;a+=1){const c=i.points[a];this.warmData[r+1+4*a]=c.id,this.warmData[r+2+4*a]=c.jn,this.warmData[r+3+4*a]=c.jt,this.warmData[r+4+4*a]=c.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const a=9*i;t.count=this.warmData[a];for(let c=0;c<2;c+=1){const l=t.points[c];l.id=this.warmData[a+1+4*c],l.jn=this.warmData[a+2+4*c],l.jt=this.warmData[a+3+4*c],l.kicked=this.warmData[a+4+4*c]===1}return}r<e?s=i+1:n=i-1}}}const ye=new Float64Array(16),we=new Float64Array(16),Hn=new Float64Array(16),Gn=new Float64Array(16);function $n(o,t,e,s,n,i,r,a){let c=0;for(let l=0;l<o;l+=1){const f=(l+1)%o,u=s*((t===0?n[l]:i[l])-e),h=s*((t===0?n[f]:i[f])-e);if(u<=0&&(r[c]=n[l],a[c]=i[l],c+=1),u<0&&h>0||u>0&&h<0){const m=u/(u-h);r[c]=n[l]+m*(n[f]-n[l]),a[c]=i[l]+m*(i[f]-i[l]),c+=1}}return c}function xf(o,t,e,s,n,i,r,a,c,l,f,u){ye[0]=o,we[0]=t,ye[1]=e,we[1]=s,ye[2]=n,we[2]=i,ye[3]=r,we[3]=a;let h=$n(4,0,c,-1,ye,we,Hn,Gn);if(h===0||(h=$n(h,0,f,1,Hn,Gn,ye,we),h===0)||(h=$n(h,1,l,-1,ye,we,Hn,Gn),h===0)||(h=$n(h,1,u,1,Hn,Gn,ye,we),h<3))return 0;let m=0;for(let p=0;p<h;p+=1){const d=(p+1)%h;m+=ye[p]*we[d]-ye[d]*we[p]}return Math.abs(.5*m)}function jr(o,t,e,s,n,i,r,a,c){const l=e-o,f=s-t;return fe[0]=0,fe[1]=1,!Wn(-l,o-n)||!Wn(l,r-o)||!Wn(-f,t-i)||!Wn(f,a-t)?(c[0]=1,c[1]=0,0):(c[0]=fe[0],c[1]=fe[1],Math.max(0,fe[1]-fe[0]))}const fe=new Float64Array(2);function Wn(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>fe[1])return!1;e>fe[0]&&(fe[0]=e)}else{if(e<fe[0])return!1;e<fe[1]&&(fe[1]=e)}return!0}const Zi=new Float64Array(2),Kn=new Float64Array(16);function vf(o,t,e,s,n,i,r,a,c,l,f){const u=Math.cos(e),h=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const v=g===0?a:g===1||g===2?l:a,w=g===0||g===1?c:f,x=g===0||g===1?l:a,_=g===0?c:g===1||g===2?f:c,F=u*(v-o)+h*(w-t),T=-h*(v-o)+u*(w-t),A=u*(x-o)+h*(_-t),b=-h*(x-o)+u*(_-t);jr(F,T,A,b,s,n,i,r,Zi)<=0||(Kn[2*m]=g+Zi[0],Kn[2*m+1]=g+Zi[1],m+=1)}if(m<2)return!1;const p=1e-9;let d=m;for(let g=0;g<m;g+=1){const v=(g+1)%m,w=Kn[2*g+1],x=Kn[2*v]+(v===0?4:0);Math.abs(x-w)<=p&&(d-=1)}return d>=2}function yf(o,t,e){const s=[],n=[];for(const d of o)s.push(d[0],d[2]),n.push(d[1],d[3]);for(const d of t)s.push(d.x0,d.x1),n.push(d.y0,d.y1);for(const d of e)s.push(d.x0,d.x1),n.push(d.y0,d.y1);const i=Oo(s),r=Oo(n),a=i.length-1,c=r.length-1,l=new Uint8Array(Math.max(0,a*c)),f=[],u=[],h=(d,g,v,w,x,_)=>d>v&&d<x&&g>w&&g<_;for(let d=0;d<c;d+=1){const g=.5*(r[d]+r[d+1]);for(let v=0;v<a;v+=1){const w=.5*(i[v]+i[v+1]);let x=!1;for(const F of o)if(h(w,g,F[0],F[1],F[2],F[3])){x=!0;break}let _=-1;if(x){for(const F of t)if(h(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0?f.push(i[v],r[d],i[v+1],r[d+1],_):l[v+d*a]=1}else{for(const F of e)if(h(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0&&(u.push(i[v],r[d],i[v+1],r[d+1],_),l[v+d*a]=1)}}}const m=[];let p=[];for(let d=0;d<=c;d+=1){const g=[];if(d<c)for(let v=0;v<a;){if(l[v+d*a]===0){v+=1;continue}let w=v;for(;w<a&&l[w+d*a]!==0;)w+=1;const x=p.find(_=>_.i0===v&&_.i1===w);g.push(x??{i0:v,i1:w,y0:r[d]}),v=w}for(const v of p)g.includes(v)||m.push([i[v.i0],v.y0,i[v.i1],r[d]]);p=g}return{rects:m,taken:f,added:u}}function Oo(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const wf=.99,qo=.5,bf=.02;class Ff{constructor(t){y(this,"w");y(this,"esSync");y(this,"filmSync");y(this,"crustSync");y(this,"wsum");y(this,"best");y(this,"acc");y(this,"split");y(this,"was");y(this,"now");y(this,"stamp");y(this,"fstamp");y(this,"tag",0);y(this,"ftag",0);y(this,"seen");y(this,"queue");y(this,"seenTag",0);y(this,"list",new Int32Array(256));y(this,"listN",0);y(this,"box",new Float64Array(4));y(this,"l0",new Float64Array(2));y(this,"l1",new Float64Array(2));y(this,"wp",new Float64Array(2));y(this,"seg",new Float64Array(2));y(this,"cb",new Float64Array(4));y(this,"areaK",[]);y(this,"capK",[]);y(this,"splits",[]);y(this,"boxes",new Float64Array(64));y(this,"nx",0);y(this,"ny",0);y(this,"faceOwner");y(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let a=this.areaK[t.index],c=this.capK[t.index];(a===void 0||a.length!==t.ncell)&&(a=new Float64Array(t.ncell),c=new Float64Array(t.ncell),this.areaK[t.index]=a,this.capK[t.index]=c);for(let p=0;p<t.ncell;p+=1)a[p]=t.cellVolume(p)/t.depth,c[p]=t.cellCap(p);const l=Math.cos(t.a),f=Math.sin(t.a);let u=0;const h=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,h);const d=h[0],g=h[1],v=h[2],w=h[3],x=t.x+l*d-f*g,_=t.y+f*d+l*g,F=t.x+l*v-f*g,T=t.y+f*v+l*g,A=t.x+l*v-f*w,b=t.y+f*v+l*w,P=t.x+l*d-f*w,M=t.y+f*d+l*w,k=Math.max(0,Math.floor(Math.min(x,F,A,P)/i)),S=Math.min(s-1,Math.floor(Math.max(x,F,A,P)/i)),O=Math.max(0,Math.floor(Math.min(_,T,b,M)/i)),C=Math.min(n-1,Math.floor(Math.max(_,T,b,M)/i));for(let I=O;I<=C;I+=1)for(let j=k;j<=S;j+=1){const D=j+I*s;if(e.solid[D]!==0&&e.owner[D]===0)continue;const E=xf(x,_,F,T,A,b,P,M,j*i,I*i,(j+1)*i,(I+1)*i);E<=1e-12*a[p]||(u>=t.wk.length&&this.growWeights(t,2*u+64),t.wk[u]=p,t.wc[u]=D,t.ww[u]=E/a[p],u+=1)}}t.nw=u;for(let p=0;p<t.nr;p+=1){const d=t.xs[p][0],g=t.ys[p][0],v=t.xs[p][t.ni[p]],w=t.ys[p][t.nj[p]];let x=1/0,_=1/0,F=-1/0,T=-1/0;for(let k=0;k<4;k+=1){const S=k===0||k===3?d:v,O=k<2?g:w,C=t.x+l*S-f*O,I=t.y+f*S+l*O;x=Math.min(x,C),F=Math.max(F,C),_=Math.min(_,I),T=Math.max(T,I)}const A=Math.max(0,Math.floor(x/i)),b=Math.min(s-1,Math.floor(F/i)),P=Math.max(0,Math.floor(_/i)),M=Math.min(n-1,Math.floor(T/i));for(let k=P;k<=M;k+=1)for(let S=A;S<=b;S+=1)vf(t.x,t.y,t.a,d,g,v,w,S*i,k*i,(S+1)*i,(k+1)*i)&&m.push(S+k*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const a=this.list[r],c=a%t,l=(a-c)/t;c<e&&(e=c),c>n&&(n=c),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,a=this.list,c=this.listN;if(this.listN=0,c===0)return 0;const l=1/(i*i);let f=s,u=-1,h=n,m=-1;for(let F=0;F<c;F+=1){const T=a[F],A=T%s,b=(T-A)/s;A<f&&(f=A),A>u&&(u=A),b<h&&(h=b),b>m&&(m=b);const P=e.solid[T]!==0&&e.owner[T]===0;this.was[T]=e.solid[T]!==0&&e.owner[T]!==0?1:0,e.fs[T]=0,e.capB[T]=0,this.wsum[T]=0,this.best[T]=0,this.split[T]=0,e.matB[T]=0,P||(e.Es[T]=0,e.film[T]=0,e.crust[T]=0,e.owner[T]=0)}const p=f*i,d=h*i,g=(u+1)*i,v=(m+1)*i;for(const F of t){if(F.gone||F.nw===0)continue;const T=this.boxOf(F);if(T[0]>g||T[2]<p||T[1]>v||T[3]<d)continue;const A=this.areaK[F.index],b=this.capK[F.index],P=this.acc;for(let k=0;k<F.nw;k+=1){const S=F.wc[k];if(this.stamp[S]!==r)continue;const O=F.wk[k],C=F.ww[k],I=C*A[O]*l;e.fs[S]+=I,P[S]+=I,e.capB[S]+=C*b[O],e.Es[S]+=C*F.E[O],e.film[S]+=C*F.film[O],e.crust[S]+=C*F.crust[O],this.wsum[S]+=C}for(let k=0;k<F.nw;k+=1){const S=F.wc[k];this.stamp[S]!==r||P[S]===0||(P[S]>this.best[S]&&(this.best[S]=P[S],e.owner[S]=F.index+1,e.matB[S]=F.mat+1),P[S]=0)}const M=this.splits[F.index];for(let k=0;k<M.length;k+=1)this.stamp[M[k]]===r&&(this.split[M[k]]=1)}const w=++this.ftag;for(let F=0;F<c;F+=1){const T=a[F],A=T%s,b=(T-A)/s;this.face(t,A,b,!0,w),this.face(t,A+1,b,!0,w),this.face(t,A,b,!1,w),this.face(t,A,b+1,!1,w)}for(let F=0;F<c;F+=1){const T=a[F];e.fs[T]>1&&(e.fs[T]=1);const A=e.solid[T]!==0&&e.owner[T]===0&&this.was[T]===0;this.now[T]=!A&&e.owner[T]!==0&&(e.fs[T]>=wf||this.split[T]!==0)?1:0}for(let F=0;F<c;F+=1){const T=a[F];this.now[T]!==0||e.owner[T]===0||e.fs[T]<qo||e.solid[T]!==0&&this.was[T]===0||this.besideOther(T)&&(this.now[T]=1)}let x=0;for(let F=0;F<c;F+=1){const T=a[F];if(this.now[T]===1){this.was[T]===0&&(x+=1,this.gasOut(T));const A=t[e.owner[T]-1];e.solid[T]=A.mat+1,e.kind[T]=ft,e.role[T]=0,e.heater[T]=-1}else this.was[T]===1&&(x+=1,e.solid[T]=0,e.role[T]=0,e.heater[T]=-1,this.vacate(T))}const _=this.w.heat;for(let F=0;F<c;F+=1){const T=a[F];this.esSync[T]=e.Es[T],this.filmSync[T]=e.film[T],this.crustSync[T]=e.crust[T],e.capB[T]>0&&_.deriveSolid(T)}return x}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,a=e.owner[t];for(let c=0;c<4;c+=1){const l=i+(c===0?-1:c===1?1:0),f=r+(c===2?-1:c===3?1:0);if(l<0||f<0||l>=s||f>=n){if(l<0?!e.openL:l>=s?!e.openR:f<0?!e.openB:!e.openT)return!0;continue}const u=l+f*s;if(e.solid[u]!==0&&e.owner[u]===0||e.owner[u]!==0&&e.owner[u]!==a&&(e.solid[u]!==0||e.fs[u]>=qo))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:a,ny:c,dx:l}=r;if(n?e>a||s>=c:e>=a||s>c)return;const f=n?e+s*(a+1):e+s*a,u=n?f:r.nu+f;if(this.fstamp[u]===i)return;this.fstamp[u]=i;const h=e*l,m=s*l,p=n?h:h+l,d=n?m+l:m;let g=0,v=0,w=0,x=0;const _=this.l0,F=this.l1;for(const b of t){if(b.gone||b.nw===0)continue;const P=this.boxOf(b);if(P[0]>Math.max(h,p)||P[2]<Math.min(h,p)||P[1]>Math.max(m,d)||P[3]<Math.min(m,d))continue;Rt.toLocal(b.x,b.y,b.a,h,m,_),Rt.toLocal(b.x,b.y,b.a,p,d,F);let M=0;for(let k=0;k<b.nr;k+=1){const S=b.xs[k][0],O=b.ys[k][0],C=b.xs[k][b.ni[k]],I=b.ys[k][b.nj[k]];M+=jr(_[0],_[1],F[0],F[1],S,O,C,I,this.seg)}if(!(M<=0)&&(g+=M,M>v)){v=M,x=b.index+1;const k=.5*(h+p),S=.5*(m+d);w=n?b.vx-b.w*(S-b.y):b.vy+b.w*(k-b.x)}}const T=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[f]:r.av[f])>0!=T>0&&(this.topologyChanged=!0),this.faceOwner[u]=x,n?(r.au[f]=T,r.usol[f]=g>0?w:0):(r.av[f]=T,r.vsol[f]=g>0?w:0)}collect(t){const e=this.w.grid;for(const s of t){if(s.gone||s.nw===0)continue;const n=this.capK[s.index],i=tr(0,s.ncell),r=tr(1,s.ncell),a=tr(2,s.ncell);let c=!1;for(let l=0;l<s.nw;l+=1){const f=s.wc[l],u=s.wk[l],h=s.ww[l],m=e.Es[f]-this.esSync[f];m!==0&&e.capB[f]>0&&(i[u]+=m*h*n[u]/e.capB[f],c=!0);const p=e.film[f]-this.filmSync[f];p>0&&this.wsum[f]>0?(r[u]+=p*h/this.wsum[f],c=!0):p<0&&this.filmSync[f]>0&&(r[u]+=p*h*s.film[u]/this.filmSync[f],c=!0);const d=e.crust[f]-this.crustSync[f];d>0&&this.wsum[f]>0?(a[u]+=d*h/this.wsum[f],c=!0):d<0&&this.crustSync[f]>0&&(a[u]+=d*h*s.crust[u]/this.crustSync[f],c=!0)}if(c)for(let l=0;l<s.ncell;l+=1)s.E[l]+=i[l],s.film[l]=Math.max(0,s.film[l]+r[l]),s.crust[l]=Math.max(0,s.crust[l]+a[l])}for(let s=0;s<e.n;s+=1)e.capB[s]<=0||(this.esSync[s]=e.Es[s],this.filmSync[s]=e.film[s],this.crustSync[s]=e.crust[s])}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,a=this.w.bubbles,c=this.box;t.worldBox(t.x,t.y,t.a,c);const l=2*i.dx;for(let f=0;f<r.count;f+=1){const u=r.x[f],h=r.y[f];u<c[0]-l||u>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(r.x[f]=this.wp[0],r.y[f]=this.wp[1],this.stopInto(t,r.vx,r.vy,f))}for(let f=0;f<a.count;f+=1){const u=a.x[f],h=a.y[f];u<c[0]-l||u>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(a.x[f]=this.wp[0],a.y[f]=this.wp[1],a.site[f]=-1,this.stopInto(t,a.vx,a.vy,f))}}hit(t,e,s,n,i,r){const a=2*this.w.grid.dx;let c=0,l=n,f=i;for(let u=0;u<3;u+=1){let h=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(l,e)<p[0]-a||Math.min(l,e)>p[2]+a||Math.max(f,s)<p[1]-a||Math.min(f,s)>p[3]+a||this.moveOut(m,l,f,e,s,m.x,m.y,m.a)&&(l=this.wp[0],f=this.wp[1],r[0]=l,r[1]=f,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(f-m.y),r[5]=m.vy+m.w*(l-m.x),c=1,h=!0)}if(!h)break}return c}moveOut(t,e,s,n,i,r,a,c){const l=this.l1,f=this.l0;Rt.toLocal(t.x,t.y,t.a,e,s,l),Rt.toLocal(r,a,c,n,i,f);const u=bf*this.w.grid.dx;let h=1/0,m=-1,p=l[0],d=l[1];for(let b=0;b<t.nr;b+=1){const P=t.xs[b][0],M=t.ys[b][0],k=t.xs[b][t.ni[b]],S=t.ys[b][t.nj[b]],O=P-u,C=M-u,I=k+u,j=S+u,D=l[0]>O&&l[0]<I&&l[1]>C&&l[1]<j;if(jr(f[0],f[1],l[0],l[1],O,C,I,j,this.seg)<=0&&!D)continue;if(f[0]>O&&f[0]<I&&f[1]>C&&f[1]<j){if(D&&h===1/0){const V=jo(l[0]-O,I-l[0],l[1]-C,j-l[1]);m=V,p=V===0?O:V===1?I:l[0],d=V===2?C:V===3?j:l[1],h=2}}else{const V=this.seg[0];if(V<h){h=V;const z=f[0]+V*(l[0]-f[0]),N=f[1]+V*(l[1]-f[1]),Z=jo(Math.abs(z-O),Math.abs(z-I),Math.abs(N-C),Math.abs(N-j));m=Z,p=Z===0?O:Z===1?I:z,d=Z===2?C:Z===3?j:N}}}if(m<0)return!1;const g=this.w.grid,v=1e-4*g.dx,w=Math.cos(t.a),x=Math.sin(t.a),_=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,T=p+_*v,A=d+F*v;return this.wp[0]=Math.min(g.w-v,Math.max(v,t.x+w*T-x*A)),this.wp[1]=Math.min(g.h-v,Math.max(v,t.y+x*T+w*A)),this.nx=w*_-x*F,this.ny=x*_+w*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,a=t.vx-t.w*r,c=t.vy+t.w*i,l=(e[n]-a)*this.nx+(s[n]-c)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,a=(t-r)/n,c=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let l=0,f=0;for(let g=0;g<4;g+=1){const v=s.across(t,r,a,g);v<0||!c(v)||(l+=s.vgas[v]>0?s.vgas[v]:e.vCell,f+=1)}if(f>0){let g=l;for(let v=0;v<4;v+=1){const w=s.across(t,r,a,v);if(w<0||!c(w))continue;const x=s.vgas[w]>0?s.vgas[w]:e.vCell;f-=1,s.move(t,w,f===0?1:Math.min(1,x/g)),g-=x}return}const u=this.seen,h=this.queue;let m=++this.seenTag,p=0,d=0;for(h[d++]=t,u[t]=m;p<d;){const g=h[p++];if(g!==t&&c(g)){s.move(t,g,1);return}const v=g%n,w=(g-v)/n;for(let x=0;x<4;x+=1){const _=s.across(g,v,w,x);_<0||u[_]===m||e.solid[_]!==0&&e.owner[_]===0||(u[_]=m,h[d++]=_)}}for(m=++this.seenTag,p=0,d=0,h[d++]=t,u[t]=m;p<d;){const g=h[p++];if(g!==t&&c(g)){s.move(t,g,1);return}const v=g%n,w=(g-v)/n;for(let x=0;x<4;x+=1){const _=v+(x===0?-1:x===1?1:0),F=w+(x===2?-1:x===3?1:0);if(_<0||F<0||_>=n||F>=i)continue;const T=_+F*n;u[T]!==m&&(u[T]=m,h[d++]=T)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let a=0,c=0,l=0,f=!1;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||(e.kind[m]===it&&(f=!0),e.kind[m]!==G||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;a+=p,c+=p*s.rho[m],l+=p*e.T[m]}if(a<=0){e.kind[t]=f?it:G,s.deriveCell(t);return}e.kind[t]=G,e.T[t]=l/a;const u=c/a*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||e.kind[m]!==G)continue;const p=s.massOf(m);if(p<=0)continue;const d=(s.vgas[m]>0?s.vgas[m]:e.vCell)/a;s.move(m,t,Math.min(.25,u*d/p))}s.deriveCell(t)}}function jo(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const Ji=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function tr(o,t){Ji[o].length<t&&(Ji[o]=new Float64Array(2*t));const e=Ji[o];return e.fill(0,0,t),e}const _f=1.5,Af=1;class Tf{constructor(t){y(this,"pe");y(this,"re");y(this,"known");y(this,"mass");y(this,"vol");y(this,"out",new Float64Array(3));y(this,"front");y(this,"next");y(this,"vp");y(this,"vr");y(this,"queued");y(this,"tag",0);y(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:a,ny:c,n:l,dx:f}=e,{pe:u,re:h,known:m,mass:p,vol:d}=this;p.fill(0),d.fill(0);for(let b=0;b<s.count;b+=1){const P=e.cellAt(s.x[b],s.y[b]);P<0||(p[P]+=s.mass[b],d[P]+=s.mass[b]/s.rho[b])}for(let b=0;b<l;b+=1){const P=e.kind[b];P===it?(u[b]=e.pl[b],h[b]=d[b]>0?p[b]/d[b]:n.rhoRef,m[b]=1):P===G&&e.solid[b]===0?(u[b]=n.pGas[b]+e.pg[b],h[b]=i.rho[b]>0?i.rho[b]:r.rhoAmb,m[b]=1):(u[b]=0,h[b]=0,m[b]=0)}const g=t.gy*f,v=this.front,w=this.next,x=this.vp,_=this.vr,F=this.queued,T=++this.tag;let A=0;for(let b=0;b<l;b+=1){if(m[b]!==0)continue;const P=b%a,M=(b-P)/a;(P>0&&m[b-1]===1||P<a-1&&m[b+1]===1||M>0&&m[b-a]===1||M<c-1&&m[b+a]===1)&&(v[A++]=b,F[b]=T)}for(;A>0;){for(let P=0;P<A;P+=1){const M=v[P],k=M%a,S=(M-k)/a;let O=0,C=0,I=0;k>0&&m[M-1]!==0&&(O+=u[M-1],C+=h[M-1],I+=1),k<a-1&&m[M+1]!==0&&(O+=u[M+1],C+=h[M+1],I+=1),S>0&&m[M-a]!==0&&(O+=u[M-a]-h[M-a]*g,C+=h[M-a],I+=1),S<c-1&&m[M+a]!==0&&(O+=u[M+a]+h[M+a]*g,C+=h[M+a],I+=1),x[P]=I>0?O/I:0,_[P]=I>0?C/I:0}let b=0;for(let P=0;P<A;P+=1){const M=v[P];u[M]=x[P],h[M]=_[P],m[M]=2}for(let P=0;P<A;P+=1){const M=v[P],k=M%a,S=(M-k)/a;for(let O=0;O<4;O+=1){const C=k+(O===0?-1:O===1?1:0),I=S+(O===2?-1:O===3?1:0);if(C<0||I<0||C>=a||I>=c)continue;const j=C+I*a;m[j]!==0||F[j]===T||(F[j]=T,w[b++]=j)}}A=b;for(let P=0;P<b;P+=1)v[P]=w[P]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,a=Math.min(n-1.0001,Math.max(0,t/r-.5)),c=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(a),f=Math.floor(c),u=a-l,h=c-f;let m=0,p=0;for(let d=0;d<2;d+=1)for(let g=0;g<2;g+=1){const v=l+g+(f+d)*n;if(this.known[v]===0)continue;const w=(g===0?1-u:u)*(d===0?1-h:h);m+=w*this.pe[v],p+=w}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,a=0,c=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),u=Math.max(1,Math.ceil(f/(.5*t.dx))),h=f/u*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let d=0;d<u;d+=1){const g=(d+.5)/u,v=i[0]+g*(i[2]-i[0]),w=i[1]+g*(i[3]-i[1]),x=s*v-n*w,_=n*v+s*w,F=this.sideAt(t.x+x,t.y+_,m,p)*h;r-=F*m,a-=F*p,c-=F*(x*p-_*m)}}return e[0]=r,e[1]=a,e[2]=c,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:a}=r,c=t+.5*a*s,l=e+.5*a*n,f=Math.min(r.nx-1.0001,Math.max(0,c/a-.5)),u=Math.min(r.ny-1.0001,Math.max(0,l/a-.5)),h=Math.floor(f),m=Math.floor(u),p=f-h,d=u-m;let g=0,v=0,w=0,x=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const T=h+F,A=m+_,b=T+A*r.nx;if(this.known[b]!==1)continue;const P=(T+.5)*a,M=(A+.5)*a;if((P-t)*s+(M-e)*n<=0)continue;const k=(F===0?1-p:p)*(_===0?1-d:d)+1e-6,S=this.pe[b]+this.re[b]*i.gy*(M-e);r.kind[b]===it?(g+=k*S,v+=k):(w+=k*S,x+=k)}return v>0&&x>0?Math.max(g/v,w/x):v>0?g/v:x>0?w/x:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let a=0,c=0;for(let u=0;u<t.nseg;u+=1){t.segment(u,r);const h=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(h/t.dx));for(let p=0;p<m;p+=1){const d=(p+.5)/m,g=r[0]+d*(r[2]-r[0])+.5*t.dx*r[4],v=r[1]+d*(r[3]-r[1])+.5*t.dx*r[5],w=s.cellAt(t.x+n*g-i*v,t.y+i*g+n*v);c+=h/m,w>=0&&s.kind[w]===it&&(a+=h/m)}}const l=c>0?a/c:0,f=e.liquid.rhoRef;t.ma=_f*f*l*t.hullA*t.depth,t.Ia=Af*f*l*t.hullJ*t.depth}}const Pf=.1,kf=1,Sf=.002,Mf=.5,Lf=1.02,Cf=.5;class Of{constructor(t){y(this,"list",[]);y(this,"cover");y(this,"forces");y(this,"contacts");y(this,"version",0);y(this,"prev",new Float64Array(0));y(this,"awakeNow",0);y(this,"shapes",!1);y(this,"resized",!1);y(this,"afterCollect",null);y(this,"dv",new Float64Array(3));y(this,"probeS",[]);y(this,"probeJ",[]);y(this,"m9",new Float64Array(9));y(this,"at",new Float64Array(2));this.e=t,this.cover=new Ff(t),this.forces=new Tf(()=>t),this.contacts=new gf(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const a=this.e.grid,c=Rt.fromRects(this.list.length,n,a.dx,a.depth,e,t,s,r);return c.gone?null:(c.pinned=i,c.asleep=!0,this.list.push(c),this.grow(),this.cover.weigh(c),this.cover.addCells(c),this.changed(),c)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list)e.awake&&(this.awakeNow+=1,t=!0,this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e));if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a,e.ux=e.vx,e.uy=e.vy,e.uw=e.w);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>Lf*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),a=3*i.index,c=i.ma6;i.maOk||(this.forces.addedMass(i),c.fill(0),c[0]=i.ma,c[3]=i.ma,c[5]=i.Ia);const l=t*r[0]+c[0]*n[a]+c[1]*n[a+1]+c[2]*n[a+2],f=t*(r[1]-i.m*e.gy)+c[1]*n[a]+c[3]*n[a+1]+c[4]*n[a+2],u=t*r[2]+c[2]*n[a]+c[4]*n[a+1]+c[5]*n[a+2];qf(i.m+c[0],c[1],c[2],i.m+c[3],c[4],i.I+c[5],l,f,u,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[a]=this.dv[0],n[a+1]=this.dv[1],n[a+2]=this.dv[2]}this.contacts.step(t,this.list,this.version,Pf*s.dx,kf*s.dx);for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<Sf&&this.contacts.touches(i)?i.rest+t:0,i.rest>=Mf&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:a,dx:c,depth:l}=i,f=this.cover.faceOwner;for(const u of this.list){if(!u.awake)continue;const h=u.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const d=this.cover.boxOf(u),g=Math.max(0,Math.floor(d[0]/c)-1),v=Math.min(r,Math.floor(d[2]/c)+2),w=Math.max(0,Math.floor(d[1]/c)-1),x=Math.min(a,Math.floor(d[3]/c)+2);for(let A=w;A<Math.min(a,x);A+=1)for(let b=g;b<=v;b+=1){const P=b+A*(r+1);if(f[P]!==h)continue;const M=(A+.5)*c,k=b>0?b-1+A*r:-1,S=b<r?b+A*r:-1,C=k>=0&&i.kind[k]===ft||S>=0&&i.kind[S]===ft?1:1-i.au[P];C<=0||(k>=0&&i.kind[k]===it&&(m.push(t.at(b-1-e,A-s)),p.push(C,0,-C*(M-u.y))),S>=0&&i.kind[S]===it&&(m.push(t.at(b-e,A-s)),p.push(-C,0,C*(M-u.y))))}for(let A=w;A<=x;A+=1)for(let b=g;b<Math.min(r,v);b+=1){const P=b+A*r;if(f[i.nu+P]!==h)continue;const M=(b+.5)*c,k=A>0?b+(A-1)*r:-1,S=A<a?b+A*r:-1,C=k>=0&&i.kind[k]===ft||S>=0&&i.kind[S]===ft?1:1-i.av[P];C<=0||(k>=0&&i.kind[k]===it&&(m.push(t.at(b-e,A-1-s)),p.push(0,C,C*(M-u.x))),S>=0&&i.kind[S]===it&&(m.push(t.at(b-e,A-s)),p.push(0,-C,-C*(M-u.x))))}if(m.length===0){u.ma6.fill(0),u.maOk=!0;continue}const _=t.system,F=this.m9;for(let A=0;A<3;A+=1){_.b.fill(0),_.x.fill(0);for(let b=0;b<m.length;b+=1)_.b[m[b]]-=c*p[3*b+A];t.solve(1e-4,40,!0);for(let b=0;b<3;b+=1){let P=0;for(let M=0;M<m.length;M+=1)P+=_.x[m[M]]*p[3*M+b];F[3*b+A]=-n*c*l*P}}const T=u.ma6;T[0]=F[0],T[1]=.5*(F[1]+F[3]),T[2]=.5*(F[2]+F[6]),T[3]=F[4],T[4]=.5*(F[5]+F[7]),T[5]=F[8],u.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,Cf*e.dx/s))}return t}wake(t){if(!t.free||!t.asleep)return;t.asleep=!1,t.rest=0,t.maOk=!1;const e=3*t.index;this.prev[e]=0,this.prev[e+1]=0,this.prev[e+2]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(Ee(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let a=this.list.length-1;a>=0;a-=1){const c=this.list[a];if(!c.gone&&(Rt.toLocal(c.x,c.y,c.a,t,e,n),c.insideLocal(n[0],n[1],r)))return c}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=new Float64Array(3*this.list.length+24);t.set(this.prev),this.prev=t}}}function qf(o,t,e,s,n,i,r,a,c,l){const f=s*i-n*n,u=e*n-t*i,h=t*n-e*s,m=o*f+t*u+e*h,p=o*i-e*e,d=t*e-o*n,g=o*s-t*t;l[0]=(f*r+u*a+h*c)/m,l[1]=(u*r+p*a+d*c)/m,l[2]=(h*r+d*a+g*c)/m}const Bo=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function nn(o){if(o===null||typeof o!="object")return null;const t=o,e=(a,c)=>{if(!Array.isArray(a)||a.length!==c)return null;const l=a.map(Bo);return l.every(f=>f!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(c=>e(c,2));if(a.every(c=>c!==null))return{poly:a.map(c=>[c[0],c[1]])}}const i=e(t.line,4),r=Bo(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function xs(o,t,e){if("rect"in o){const[m,p,d,g]=o.rect;return t>=m&&t<=d&&e>=p&&e<=g}if("circle"in o){const[m,p,d]=o.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=d*d}if("poly"in o){const m=o.poly;let p=!1;for(let d=0,g=m.length-1;d<m.length;g=d,d+=1){const[v,w]=m[d],[x,_]=m[g];w>e!=_>e&&t<(x-v)*(e-w)/(_-w)+v&&(p=!p)}return p}const[s,n,i,r]=o.line,a=i-s,c=r-n,l=a*a+c*c,f=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*c)/l)):0,u=t-(s+f*a),h=e-(n+f*c);return u*u+h*h<=.25*o.width*o.width}function tn(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,a,c]=o.circle;return[r-c,a-c,r+c,a+c]}if("poly"in o){let r=1/0,a=1/0,c=-1/0,l=-1/0;for(const[f,u]of o.poly)r=Math.min(r,f),a=Math.min(a,u),c=Math.max(c,f),l=Math.max(l,u);return[r,a,c,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function rn(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const Ai=.05;function Io(o,t){const e=o.latentOffset(),s=Br(o,t.filter(([n,i,r,a])=>r-n>Ai*o.dx&&a-i>Ai*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function Br(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,a=o.nr,c=o.E,l=o.film,f=o.crust;let u=0,h=0,m=0;for(let x=0;x<o.ncell;x+=1)u+=c[x],h+=l[x],m+=f[x];const p=[],d=[];for(const[x,_,F,T]of t)!(F>x)||!(T>_)||(p.push(Rt.splits(x,F,o.dx)),d.push(Rt.splits(_,T,o.dx)));o.setRects(p,d);let g=0,v=0,w=0;for(let x=0;x<o.nr;x+=1){const _=o.xs[x],F=o.ys[x];for(let T=0;T<o.nj[x];T+=1)for(let A=0;A<o.ni[x];A+=1){const b=o.off[x]+A+T*o.ni[x],P=_[A],M=_[A+1],k=F[T],S=F[T+1];for(let O=0;O<a;O+=1){const C=e[O],I=s[O];if(!(C[0]>=M||C[n[O]]<=P||I[0]>=S||I[i[O]]<=k))for(let j=0;j<i[O];j+=1){const D=Math.min(S,I[j+1])-Math.max(k,I[j]);if(!(D<=0))for(let E=0;E<n[O];E+=1){const V=Math.min(M,C[E+1])-Math.max(P,C[E]);if(V<=0)continue;const z=r[O]+E+j*n[O],N=V*D/((C[E+1]-C[E])*(I[j+1]-I[j]));o.E[b]+=N*c[z],o.film[b]+=N*l[z],o.crust[b]+=N*f[z]}}}g+=o.E[b],v+=o.film[b],w+=o.crust[b]}}return{energy:u-g,film:h-v,crust:m-w}}function jf(o,t,e,s,n){const[i,r,a,c]=o;if(s<=i||t>=a||n<=r||e>=c)return null;const l=[],f=Math.max(i,t),u=Math.min(a,s);return t>i&&l.push([i,r,t,c]),s<a&&l.push([s,r,a,c]),e>r&&l.push([f,r,u,e]),n<c&&l.push([f,n,u,c]),l}function Bf(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let a=0;a<r.length;a+=1){const[c,l,f,u]=o[r[a]];for(let h=0;h<e;h+=1){if(s[h]>=0)continue;const[m,p,d,g]=o[h],v=(Math.abs(f-m)<=t||Math.abs(d-c)<=t)&&Math.min(u,g)-Math.max(l,p)>t,w=(Math.abs(u-p)<=t||Math.abs(g-l)<=t)&&Math.min(f,d)-Math.max(c,m)>t,x=Math.min(f,d)-Math.max(c,m)>t&&Math.min(u,g)-Math.max(l,p)>t;(v||w||x)&&(s[h]=n.length,r.push(h))}}n.push(r)}return n}function If(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let a=0;a<n;a+=1){const c=s[a];if(c.gone)continue;let l=1/0,f=1/0,u=-1/0,h=-1/0;if("circle"in t){const[T,A,b]=t.circle;Rt.toLocal(c.x,c.y,c.a,T,A,i),l=i[0]-b,u=i[0]+b,f=i[1]-b,h=i[1]+b}else{const[T,A,b,P]=tn(t);for(const[M,k]of[[T,A],[b,A],[b,P],[T,P]])Rt.toLocal(c.x,c.y,c.a,M,k,i),l=Math.min(l,i[0]),u=Math.max(u,i[0]),f=Math.min(f,i[1]),h=Math.max(h,i[1])}const m=[];let p=!1;for(let T=0;T<c.nr;T+=1){const A=c.bounds(T),b=jf(A,l,f,u,h);if(b===null){m.push(A);continue}p=!0;for(const P of b)m.push(P)}if(!p)continue;r=!0,o.cover.release(c);const d=Ee(c.mat)>0,g={E:c.energy(),F:c.filmMass(),K:c.crustMass(),M:d?c.m:0},v=ka(o,c,m.filter(T=>T[2]-T[0]>Ai*c.dx&&T[3]-T[1]>Ai*c.dx));let w=0,x=0,_=0,F=0;for(const T of v)w+=T.energy(),x+=T.filmMass(),_+=T.crustMass(),F+=d?T.m:0;e.energy-=g.E-c.energy()-w,e.water-=g.F-c.filmMass()-x+(d?g.M-c.m-F:0),e.salt-=g.K-c.crustMass()-_,c.gone||c.ncell===0?(c.gone=!0,c.ncell=0):(o.cover.weigh(c),o.cover.addCells(c))}return r&&o.changed(),r}function ka(o,t,e,s=!0){const n=o.list,i=Bf(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let a=1;a<i.length;a+=1){const c=new Rt(n.length,t.key,t.dx,t.depth);c.mat=t.mat,c.heater=t.heater,c.xs=t.xs.map(l=>l.slice()),c.ys=t.ys.map(l=>l.slice()),c.nr=t.nr,c.ni=t.ni.slice(),c.nj=t.nj.slice(),c.off=t.off.slice(),c.ncell=t.ncell,c.E=t.E.slice(),c.film=t.film.slice(),c.crust=t.crust.slice(),c.x=t.x,c.y=t.y,c.a=t.a,c.m=t.m,Io(c,i[a].map(l=>e[l])),c.rx=c.x,c.ry=c.y,c.ra=c.a,c.pinned=t.pinned,c.asleep=t.asleep,c.vx=t.vx,c.vy=t.vy,c.w=t.w,n.push(c),o.grow(),o.cover.weigh(c),o.cover.addCells(c),r.push(c)}return Io(t,i.length>0?i[0].map(a=>e[a]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function Rf(o,t,e){const[s,n,i,r]=tn(t),a=[],c=new Float64Array(4);for(const l of o.list){if(l.gone||e!==void 0&&!e(l))continue;l.worldBox(l.x,l.y,l.a,c);const f=.001*l.dx;c[0]>=i-f||c[2]<=s+f||c[1]>=r-f||c[3]<=n+f||(o.cover.release(l),a.push(l))}return a}function Ef(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(Ee(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function Ro(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const Wt=new Float64Array(6);function zn(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let a=0;a<r;a+=1){const c=e===0?0:e===1?n-1:a,l=e===2?0:e===3?i-1:a,f=o.off[t]+c+l*n,u=e<2?o.ys[t][l]:o.xs[t][c],h=e<2?o.ys[t][l+1]:o.xs[t][c+1],m=Sa(o,t,e,u,h);s(f,h-u,h>u?m/(h-u):0)}}function Sa(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function Eo(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function Ma(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function Df(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=Ma(o,t,n);i>s&&(s=i,e=n)}return e}function La(o,t,e,s){t.segment(e,Wt);const n=Math.hypot(Wt[2]-Wt[0],Wt[3]-Wt[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),a=Math.sin(t.a),c=r*Wt[4]-a*Wt[5],l=a*Wt[4]+r*Wt[5],f=Wt[0],u=Wt[1],h=Wt[2]-Wt[0],m=Wt[3]-Wt[1];for(let p=0;p<i;p+=1){const d=(p+.5)/i,g=f+d*h,v=u+d*m;s(t.x+r*g-a*v,t.y+a*g+r*v,c,l,n/i)}}function Ir(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx;let a=-1,c=-1,l=-1;La(o,t,e,(f,u,h,m,p)=>{const d=i.cellAt(f+r*h,u+r*m);if(d<0||i.solid[d]!==0){a=d;return}if(d!==a&&s(d,p),a=d,n){const v=i.cellAt(f+(i.dx+r)*h,u+(i.dx+r)*m);v>=0&&v!==d&&v!==l&&i.solid[v]===0&&s(v,p),l=v}const g=i.cellAt(f-r*h,u-r*m);g>=0&&g!==d&&g!==c&&i.solid[g]===0&&i.kind[g]===it&&s(g,p),c=g})}function Vf(o,t,e,s,n){const i=o.exchange;let r=0,a=0;for(let c=0;c<t.nseg;c+=1)t.segR[c]!==e||t.segS[c]!==s||Ir(o,t,c,l=>{r+=i.salt[l],a+=i.water[l],n.add(4*e+s)});return!(a>0)||!(r>0)?Ee(t.mat):Aa(r/(a*Qe))}function Nf(o,t,e,s,n){const i=o.grid,r=o.exchange,a=i.n,c=.05*i.dx;let l=0;for(let f=0;f<t.nseg;f+=1)t.segR[f]!==e||t.segS[f]!==s||La(o,t,f,(u,h,m,p,d)=>{var x;const g=i.cellAt(u+c*m,h+c*p);if(g<0)return;let v,w;i.solid[g]!==0?(v=i.T[g],w=((x=ut[i.solid[g]-1])==null?void 0:x.k)??0):r.cap[g]>0?(v=r.capT[g]/r.cap[g],w=pi(v)):(v=i.T[g],w=sa(i.mg[g],i.mg[a+g],i.mg[X*a+g],v)),v>n&&(l+=w*(v-n)*d)});return l}const Uf=.3,Hf=1.6,Qn=.05,Gf=2,$f=.25,Do=.5,er=1e-6;class Wf{constructor(t){y(this,"pending",[]);y(this,"melted",0);y(this,"frozen",0);y(this,"head",new Int32Array(0));y(this,"next",new Int32Array(0));y(this,"listed",!1);this.e=t}pendingTotals(){let t=0,e=0,s=0;for(const n of this.pending)n!==void 0&&(t+=n.m-n.s,e+=n.H,s+=n.s);return{m:t,H:e,s}}any(){return this.e.bodies.list.some((t,e)=>{var s;return!t.gone&&Ee(t.mat)>0||(((s=this.pending[e])==null?void 0:s.m)??0)>0})}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&Ee(i.mat)>0&&this.body(i)&&(t=!0);const r=this.pending[n];r!==void 0&&r.m>0&&this.spawn(i,r)}return t}body(t){const e=ut[t.mat].rho,s=ut[t.mat].cp,n=un(t.mat),i=new Map,r=new Set,a=new Map;for(let x=0;x<t.nseg;x+=1){const _=4*t.segR[x]+t.segS[x];if(i.has(_))continue;const F=Vf(this.e,t,t.segR[x],t.segS[x],r);i.set(_,F),a.set(_,Nf(this.e,t,t.segR[x],t.segS[x],F))}const c=new Map;for(let x=0;x<t.nr;x+=1)this.excess(t,x,i,r,a,c);const l=this.walls(t,[...i.keys()]),f=new Map,u=new Map,h=new Map,m=new Map,p=new Map;for(const[x,_]of i){const F=x>>2,T=x&3,A=s*(_-et)+n,b=Ft(_)-A;let P=0;zn(t,F,T,(S,O,C)=>{C>0&&(P+=C*O*(b+s*(_-Math.min(_,t.cellT(S)))))});const M=this.planFreeze(t,F,T,_,b);f.set(x,{L:b,hIce:A,denom:P,plan:M});const k=l.get(x);u.set(k,(u.get(k)??0)+(c.get(x)??0)),h.set(k,(h.get(k)??0)+P),m.set(k,(m.get(k)??0)+((M==null?void 0:M.total)??0)),p.set(k,(p.get(k)??0)+Ma(t,F,T))}const d=[];for(const[x,_]of i){const F=x>>2,T=x&3,A=l.get(x),b=f.get(x),P=c.get(x)??0,M=u.get(A)??0,k=h.get(A)??0;M>0&&k>0?d.push({r:F,s:T,d:M/(e*t.depth*k),Q:P,Tf:_,hIce:b.hIce,freeze:null}):P>0&&this.giveBack(t,F,T,P);const S=m.get(A)??0;S>0&&d.push({r:F,s:T,d:S/(e*t.depth*p.get(A)),Q:0,Tf:_,hIce:b.hIce,freeze:b.plan??{p:[],dm:[],total:0}})}if(d.length===0)return!1;const g=No(t),v=this.e.bodies;if(v.cover.release(t),t.nr===1?this.moveSides(t,d):this.slabs(t,d),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,v.changed(),!0;let w=0;if(t.nr>1){const x=[];for(let _=0;_<t.nr;_+=1)x.push(t.bounds(_));w=ka(v,t,x,!1).length}return t.derive(),v.cover.weigh(t),v.cover.addCells(t),d.some(x=>x.freeze!==null)&&v.cover.pushOut(t,t.x,t.y,t.a),v.reshaped(t,w>0||No(t)!==g),!0}excess(t,e,s,n,i,r){const a=[];for(let d=0;d<4;d+=1)n.has(4*e+d)&&a.push(d);if(a.length===0)for(let d=0;d<4;d+=1)s.has(4*e+d)&&a.push(d);let c=1/0;for(let d=0;d<4;d+=1)c=Math.min(c,s.get(4*e+d)??1/0);if(c===1/0)return;const l=t.xs[e],f=t.ys[e],u=t.ni[e],h=t.nj[e],m=[0,0],p=[0,0];for(let d=0;d<h;d+=1)for(let g=0;g<u;g+=1){const v=t.off[e]+g+d*u,w=t.cellT(v);if(!(w>c))continue;let x=0,_=0;for(let S=0;S<4&&x<2;S+=1){if(!(S===0?g===0:S===1?g===u-1:S===2?d===0:d===h-1))continue;const O=i.get(4*e+S)??0;!(O>0)||!(Sa(t,e,S,S<2?f[d]:l[g],S<2?f[d+1]:l[g+1])>0)||(m[x]=S,p[x]=O,_+=O,x+=1)}if(x>0){const S=t.E[v];for(let O=0;O<x;O+=1){const C=4*e+m[O],I=p[O]/_*(S-Or(t.cellCap(v),t.film[v],t.crust[v],s.get(C)));I>0&&(t.E[v]-=I,r.set(C,(r.get(C)??0)+I))}continue}if(a.length===0)continue;const F=.5*(l[g]+l[g+1]),T=.5*(f[d]+f[d+1]);let A=a[0],b=1/0;for(const S of a){const O=S===0?F-l[0]:S===1?l[u]-F:S===2?T-f[0]:f[h]-T;O<b&&(b=O,A=S)}const P=4*e+A,M=s.get(P);if(!(w>M))continue;const k=t.E[v]-Or(t.cellCap(v),t.film[v],t.crust[v],M);k>0&&(t.E[v]-=k,r.set(P,(r.get(P)??0)+k))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,a=this.e.particles,c={p:[],dm:[],total:0},l=f=>{if(!(r.cap[f]>0)||!(r.water[f]>0))return;const u=r.capT[f]/r.cap[f];if(u>=n)return;const h=Math.min(Do*r.water[f],r.cap[f]*(n-u)/Math.max(1,i));if(!(h>0))return;let m=0;this.inCell(f,p=>{if(a.mat[p]!==lt)return;const d=a.mass[p]-a.smass[2*p],g=Math.min(Do*d,h*d/r.water[f]);g>0&&(c.p.push(p),c.dm.push(g),m+=g)}),r.water[f]-=m,r.cap[f]=0,c.total+=m};for(let f=0;f<t.nseg;f+=1)t.segR[f]===e&&t.segS[f]===s&&Ir(this.e,t,f,l);return c.total>0?c:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let a=0;a<t.p.length;a+=1){const c=t.p[a],l=t.dm[a]*e;if(!(l>0))continue;const f=n.mass[c]/n.rho[c],u=n.mass[c]*n.h[c]-l*s;n.mass[c]-=l,n.h[c]=u/n.mass[c],n.derive(c),i.dVp[c]+=n.mass[c]/n.rho[c]-f,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=ut[t.mat].rho,a=Math.min(n,this.rowThickness(t,e,s));let c=0,l=0,f=0,u=0;if(zn(t,e,s,(h,m)=>{const p=t.cellVolume(h);if(!(p>0))return;const d=m*a*t.depth/p;l+=d*t.E[h],f+=d*t.film[h],u+=d*t.crust[h],t.E[h]-=d*t.E[h],t.film[h]-=d*t.film[h],t.crust[h]-=d*t.crust[h],c+=r*m*a*t.depth}),this.moveSide(t,e,s,-a),!(c>0)){this.giveBack(t,e,s,i+l);return}this.melted+=c,this.give(t,e,s,c+f+u,l+c*un(t.mat)+i,u)}grow(t,e,s,n,i){const r=ut[t.mat].rho,a=ut[t.mat].cp,c=Eo(t,e,s),l=n/(r*t.depth*c);zn(t,e,s,(f,u)=>{t.E[f]+=r*u*l*t.depth*a*(i-et)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=Eo(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}zn(t,e,s,(r,a)=>{t.E[r]+=n*a/i})}slabs(t,e){const s=ut[t.mat].rho,n=ut[t.mat].cp,i=un(t.mat),r=t.depth,a=e.length,c=this.walls(t,e.map(P=>4*P.r+P.s)),l=e.map(P=>c.get(4*P.r+P.s)),f=new Map;for(const P of e)P.freeze===null&&f.set(4*P.r+P.s,P.d);const u=[];for(let P=0;P<t.nr;P+=1)u.push(t.bounds(P));const h=new Map;for(const P of e)h.set(4*P.r+P.s,(h.get(4*P.r+P.s)??0)+(P.freeze!==null?P.d:-P.d));const m=[],p=[];for(let P=0;P<a;P+=1){const M=e[P],k=u[M.r];for(let S=0;S<t.nseg;S+=1)if(!(t.segR[S]!==M.r||t.segS[S]!==M.s))if(M.freeze===null){const O=t.segT0[S]-this.inner(t,S,!1,f),C=t.segT1[S]+this.inner(t,S,!0,f);m.push(Vo(M.s,k,O,C,Math.min(M.d,M.s<2?k[2]-k[0]:k[3]-k[1]),!0,P))}else{const O=t.segT0[S]-this.corner(t,M.r,M.s,!1,t.segT0[S],h),C=t.segT1[S]+this.corner(t,M.r,M.s,!0,t.segT1[S],h);C>O&&p.push(Vo(M.s,k,O,C,M.d,!1,P))}}const d=yf(u,m,p),g=d.taken,v=new Float64Array(a);for(let P=0;P<g.length;P+=5)v[g[P+4]]+=(g[P+2]-g[P])*(g[P+3]-g[P+1]);for(let P=0;P<a;P+=1)e[P].freeze===null&&!(v[P]>0)&&this.giveBack(t,e[P].r,e[P].s,e[P].Q);const w=new Float64Array(a),x=new Float64Array(a),_=new Float64Array(a);for(let P=0;P<g.length;P+=5){const M=g[P+4];this.overlap(t,g[P],g[P+1],g[P+2],g[P+3],(k,S)=>{w[M]+=S*t.E[k],x[M]+=S*t.film[k],_[M]+=S*t.crust[k]})}for(let P=0;P<a;P+=1){const M=e[P];if(M.freeze!==null||!(v[P]>0))continue;const k=s*r*v[P];this.melted+=k,this.give(t,M.r,M.s,k+x[P]+_[P],w[P]+k*i+M.Q,_[P])}Br(t,d.rects);const F=d.added,T=new Float64Array(a);for(let P=0;P<F.length;P+=5){const M=F[P+4],k=e[M].Tf;T[M]+=(F[P+2]-F[P])*(F[P+3]-F[P+1]),this.overlap(t,F[P],F[P+1],F[P+2],F[P+3],(S,O,C)=>{t.E[S]+=s*r*C*n*(k-et)})}const A=new Map,b=new Map;for(let P=0;P<a;P+=1){const M=e[P].freeze;if(M===null)continue;const k=l[P];A.set(k,(A.get(k)??0)+s*r*T[P]),b.set(k,(b.get(k)??0)+M.total)}for(let P=0;P<a;P+=1){const M=e[P].freeze;if(M===null||!(M.total>0))continue;const k=l[P];this.take(M,A.get(k)/b.get(k),e[P].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let a=r;for(;s.get(a)!==a;)a=s.get(a);return a};if(t.nr>1){const r=er*t.dx,a=c=>{const l=t.segR[c],f=t.segS[c];return f===0?t.xs[l][0]:f===1?t.xs[l][t.ni[l]]:f===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let c=0;c<t.nseg;c+=1)for(let l=c+1;l<t.nseg;l+=1){if(t.segS[c]!==t.segS[l]||Math.abs(a(c)-a(l))>r||Math.abs(t.segT1[c]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[c])>r)continue;const f=4*t.segR[c]+t.segS[c],u=4*t.segR[l]+t.segS[l];if(!s.has(f)||!s.has(u))continue;const h=n(f),m=n(u);h!==m&&s.set(Math.max(h,m),Math.min(h,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=er*t.dx,r=t.segR[e],a=t.segS[e],c=s?t.segT1[e]:t.segT0[e],l=a===0?t.xs[r][0]:a===1?t.xs[r][t.ni[r]]:a===2?t.ys[r][0]:t.ys[r][t.nj[r]],f=a<2?l:c,u=a<2?c:l,h=a===0?-1:a===1?1:0,m=a===2?-1:a===3?1:0;for(let p=0;p<t.nseg;p+=1){const d=t.segS[p];if(d<2==a<2)continue;const g=n.get(4*t.segR[p]+d);if(g===void 0)continue;const v=t.segR[p],w=d===0?t.xs[v][0]:d===1?t.xs[v][t.ni[v]]:d===2?t.ys[v][0]:t.ys[v][t.nj[v]];for(const[x,_]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const F=d<2?w:x,T=d<2?x:w;if(Math.abs(F-f)>i||Math.abs(T-u)>i)continue;const A=d<2?w:_,b=d<2?_:w;if((A-f)*h+(b-u)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[a,c,l,f]=t.bounds(e),u=er*t.dx,h=s<2?n?f:c:n?l:a;if(Math.abs(i-h)>u)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?a:s===1?l:s===2?c:f;for(let d=0;d<t.nseg;d+=1)if(t.segR[d]===e&&t.segS[d]===m&&t.segT0[d]<=p+u&&t.segT1[d]>=p-u)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let a=0;a<t.nr;a+=1){const c=t.xs[a],l=t.ys[a],f=t.ni[a],u=t.nj[a];if(!(c[0]>=n||c[f]<=e||l[0]>=i||l[u]<=s))for(let h=0;h<u;h+=1){const m=Math.min(i,l[h+1])-Math.max(s,l[h]);if(!(m<=0))for(let p=0;p<f;p+=1){const d=Math.min(n,c[p+1])-Math.max(e,c[p]);d<=0||r(t.off[a]+p+h*f,d*m/((c[p+1]-c[p])*(l[h+1]-l[h])),d*m)}}}}give(t,e,s,n,i,r=0){const a=this.e.grid,c=this.e.particles,l=this.e.liquid,f=[],u=new Set;let h=0;for(let p=0;p<2&&f.length===0;p+=1)for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||Ir(this.e,t,d,g=>{a.kind[g]!==it||u.has(g)||(u.add(g),this.inCell(g,v=>{c.mat[v]===lt&&(f.push(v),h+=c.mass[v])}))},p===1);if(f.length===0||!(h>0)){this.hold(t,e,s,n,i,r);return}const m=l.rhoRef*a.vCell/4;for(const p of f){const d=c.mass[p]/h,g=c.mass[p]/c.rho[p],v=c.mass[p]*c.h[p]+d*i;c.mass[p]+=d*n,r>0&&(c.smass[2*p]+=d*r,c.spc[2*p]=Ni),c.h[p]=v/c.mass[p],c.derive(p),l.dVp[p]+=c.mass[p]/c.rho[p]-g,c.mass[p]>Gf*m&&this.split(p)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const f of[i,-i]){const u=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*f)),h=n.cellAt(u,e.y[t]);if(h>=0&&n.solid[h]===0&&this.e.bodies.bodyAt(u,e.y[t],0)===null){r=u;break}}if(Number.isNaN(r))return;const a=.5*e.mass[t],c=.5*e.smass[2*t],l=e.add(r,e.y[t],a,e.h[t],e.mat[t],c);l<0||(e.mass[t]=a,e.smass[2*t]=c,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r=0){const[a,c,l,f]=t.bounds(e),u=s===0?a:s===1?l:.5*(a+l),h=s===2?c:s===3?f:.5*(c+f),m=s===0?-1:s===1?1:0,p=s===2?-1:s===3?1:0,d=Math.cos(t.a),g=Math.sin(t.a),v=this.pending[t.index]??(this.pending[t.index]={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1});v.m+=n,v.H+=i,v.s+=r,v.x=t.x+d*u-g*h,v.y=t.y+g*u+d*h,v.nx=d*m-g*p,v.ny=g*m+d*p}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;if(e.m<$f*r&&!t.gone)return;const a=this.freeSpot(e.x+.3*s.dx*e.nx,e.y+.3*s.dx*e.ny);if(a===null)return;const c=n.add(a[0],a[1],e.m,e.H/e.m,lt,e.s);c<0||(n.vx[c]=t.gone?0:t.vx,n.vy[c]=t.gone?0:t.vy,i.placeParticle(c),i.dVp[c]=e.m/n.rho[c],e.m=0,e.H=0,e.s=0)}freeSpot(t,e){const s=this.e.grid,n=(i,r)=>{if(!(i>0&&r>0&&i<s.w&&r<s.h))return!1;const a=s.cellAt(i,r);return a>=0&&s.solid[a]===0&&this.e.bodies.bodyAt(i,r,0)===null};if(n(t,e))return[t,e];for(let i=1;i<=3;i+=1)for(let r=i;r>=-i;r-=1)for(let a=-i;a<=i;a+=1)if(Math.max(Math.abs(a),Math.abs(r))===i&&n(t+a*s.dx,e+r*s.dx))return[t+a*s.dx,e+r*s.dx];return null}tidy(t){const e=t.dx;let s=!1;for(let a=0;a<t.nr;a+=1){const[c,l,f,u]=t.bounds(a);if(f-c<Qn*e||u-l<Qn*e){s=!0;continue}for(let h=0;h<4;h+=1){const m=this.rowThickness(t,a,h),p=h<2?t.ni[a]:t.nj[a];(m<Uf*e&&p>1||m>Hf*e)&&(s=!0)}}if(!s)return;const n=ut[t.mat].rho,i=un(t.mat),r=[];for(let a=0;a<t.nr;a+=1){const[c,l,f,u]=t.bounds(a);if(f-c>=Qn*e&&u-l>=Qn*e){r.push([c,l,f,u]);continue}const h=n*(f-c)*(u-l)*t.depth;let m=0,p=0,d=0;for(let g=t.off[a];g<t.off[a]+t.ni[a]*t.nj[a];g+=1)m+=t.E[g],p+=t.film[g],d+=t.crust[g];this.melted+=h,this.give(t,a,Df(t,a),h+p+d,m+h*i,d)}Br(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function Vo(o,t,e,s,n,i,r){const[a,c,l,f]=t;return o===0?i?{x0:a,y0:e,x1:a+n,y1:s,move:r}:{x0:a-n,y0:e,x1:a,y1:s,move:r}:o===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:o===2?i?{x0:e,y0:c,x1:s,y1:c+n,move:r}:{x0:e,y0:c-n,x1:s,y1:c,move:r}:i?{x0:e,y0:f-n,x1:s,y1:f,move:r}:{x0:e,y0:f,x1:s,y1:f+n,move:r}}function No(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const oe=8;class Kf{constructor(t){y(this,"cap");y(this,"count",0);y(this,"nextId",1);y(this,"x");y(this,"y");y(this,"z");y(this,"vx");y(this,"vy");y(this,"m");y(this,"H");y(this,"age");y(this,"site");y(this,"r");y(this,"V");y(this,"pb");y(this,"pv");y(this,"Tb");y(this,"dmdt");y(this,"force");y(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*at),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*oe),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<at;i+=1)this.m[n*at+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<oe;i+=1)this.force[n*oe+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<at;s+=1)e+=this.m[t*at+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<at;s+=1)this.m[t*at+s]=this.m[e*at+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<oe;s+=1)this.force[t*oe+s]=this.force[e*oe+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Ca=200;function sr(o,t,e,s){const n=kt(o);return t/je(n)-e*Bt*n/(s-o)}function zf(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function Qf(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function Xf(o,t,e,s,n,i,r,a=lt){const c=o[t+X],l=o[t+ot]/mt[ot]+o[t+ct]/mt[ct],f=c/mt[X];let u=i>0?i:Math.cbrt(3*Math.max(1e-30,(f+l)*Bt*s/e)/(4*Math.PI)),h=e,m=0,p=s,d=0;for(let g=0;g<8;g+=1){if(h=e+2*Ds(a,p)/u,l<=0)m=h,p=kt(m),d=c/je(p);else if(f<=1e-9*l)m=0,p=s,d=l*Bt*p/h;else{let w=611.213,x=h*(1-1e-12),_=sr(w,c,l,h),F=sr(x,c,l,h);if(_<=0)m=w;else if(F>=0)m=x;else{let T=0;m=.5*(w+x);for(let A=0;A<40;A+=1){m=(w*F-x*_)/(F-_);const b=sr(m,c,l,h);if(Math.abs(b)<=1e-12*(c/je(s)+1e-30))break;b>0?(w=m,_=b,T===1&&(F/=2),T=1):(x=m,F=b,T===-1&&(_/=2),T=-1)}}p=kt(m),d=c/je(p)}const v=zf(d,n);if(Math.abs(v-u)<=1e-7*u){u=v;break}u=v}r.r=u,r.V=d,r.pb=e+2*Ds(a,p)/u,r.pv=m,r.Tb=p,Qf(d,u,n,r)}function Uo(o,t,e,s){let n=0;for(let i=0;i<at;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function Ho(o,t,e,s,n,i,r,a,c,l){let f=0;if(2*e<=3*i){const v=o/i-.5,w=t/i-.5,x=Math.floor(v-.5),_=Math.floor(w-.5),F=v-x,T=w-_,A=.5*(1.5-F)**2,b=.75-(F-1)**2,P=.5*(F-.5)**2,M=.5*(1.5-T)**2,k=.75-(T-1)**2,S=.5*(T-.5)**2;let O=0;for(let C=0;C<3;C+=1){const I=_+C;if(I<0||I>=a)continue;const j=C===0?M:C===1?k:S;for(let D=0;D<3;D+=1){const E=x+D;if(E<0||E>=r)continue;const V=j*(D===0?A:D===1?b:P);c[f]=E+I*r,l[f]=V,O+=V,f+=1}}for(let C=0;C<f;C+=1)l[C]/=O;return f}const u=s<=Math.PI*n*n*n/6,h=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),d=Math.min(a-1,Math.floor((t+e)/i));let g=0;for(let v=p;v<=d;v+=1)for(let w=h;w<=m;w+=1){let x=0;for(let _=0;_<4;_+=1){const F=(v+(_+.5)/4)*i-t;for(let T=0;T<4;T+=1){const A=(w+(T+.5)/4)*i-o,b=e*e-A*A-F*F;b>0&&(x+=u?Math.sqrt(b):1)}}x<=0||f>=c.length||(c[f]=w+v*r,l[f]=x,g+=x,f+=1)}if(g<=0)return c[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let v=0;v<f;v+=1)l[v]/=g;return f}function Go(o,t,e,s,n,i){const{nx:r,ny:a}=o,c=e%r,l=(e-c)/r;let f=0,u=0;for(let h=0;h<=6&&(f===0||u<2*s);h+=1)for(let m=0;m<=h;m+=1)for(let p=-h;p<=h;p+=1){if(Math.max(Math.abs(p),m)!==h)continue;const d=c+p,g=l+m;if(d<0||g<0||d>=r||g>=a)continue;const v=d+g*r;if(o.kind[v]!==G||f>=n.length)continue;const w=Math.max(.001*o.vCell,t[v]);n[f]=v,i[f]=w,u+=w,f+=1}for(let h=0;h<f;h+=1)i[h]/=u;return f}function $o(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===G)return e+s*o.nx;return-1}const As=.5;class Yf{constructor(t){y(this,"e");y(this,"ux0");y(this,"uy0");y(this,"vel",new Float64Array(2));y(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,c=r.x[t],l=r.y[t],f=r.r[t],u=r.V[t],h=Math.max(f+i.dx,2*i.dx),m=this.vel;let p=0,d=0;for(let K=0;K<8;K+=1){const ht=K*Math.PI/4;a.velocityAt(c+h*Math.cos(ht),l+h*Math.sin(ht),m),p+=m[0]/8,d+=m[1]/8}const g=i.cellAt(c,l),v=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],w=g>=0?n.phase.host[g]:0,x=n.phase.mixed?ps(w,v):a.rhoRef,_=bn(w,v),F=r.totalMass(t)/Math.max(1e-30,u),T=(p-this.ux0[t])/Math.max(e,1e-6),A=(d-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=d,f<2e-5){r.vx[t]=p,r.vy[t]=d,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,c+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*d));return}const b=r.vx[t]-p,P=r.vy[t]-d,M=Math.hypot(b,P),k=2*f,S=Math.max(1e-6,x*M*k/_),O=Math.max(0,n.gy)*(x-F)*k*k/Ds(w,v),I=.5*Math.max(24/S*(1+.15*Math.pow(S,.687)),8/3*(O/(O+4)))*x*this.front(t)*M,j=(F+As*x)*u,D=x*u*T,E=x*u*(A+n.gy),V=-F*u*n.gy,z=As*x*u*T,N=As*x*u*A,Z=s>0?As*x*s:0,tt=s<0?Math.min(-s,.2*u/e):0,q=As*x*tt*b,$=As*x*tt*P,U=(j*r.vx[t]+e*(D+z+q)+e*(I+Z)*p)/(j+e*(I+Z)),H=(j*r.vy[t]+e*(E+V+N+$)+e*(I+Z)*d)/(j+e*(I+Z));r.vx[t]=Number.isFinite(U)?U:p,r.vy[t]=Number.isFinite(H)?H:d;const nt=-I*(U-p),pt=-I*(H-d),wt=t*oe;r.force[wt]=D,r.force[wt+1]=E,r.force[wt+2]=0,r.force[wt+3]=V,r.force[wt+4]=nt,r.force[wt+5]=pt,r.force[wt+6]=z+q-Z*(U-p),r.force[wt+7]=N+$-Z*(H-d),this.spreadForce(c,l,f,-(nt+r.force[wt+6])*(e/n.dt),-(pt+r.force[wt+7])*(e/n.dt));let L=c+e*U,R=l+e*H;const B=i.sdfAt(L,R);if(B<f){const K=.25*i.dx;let ht=i.sdfAt(L+K,R)-i.sdfAt(L-K,R),bt=i.sdfAt(L,R+K)-i.sdfAt(L,R-K);const dt=Math.hypot(ht,bt);if(dt>1e-12){ht/=dt,bt/=dt,L+=(f-B)*ht,R+=(f-B)*bt;const Ct=r.vx[t]*ht+r.vy[t]*bt;Ct<0&&(r.vx[t]-=Ct*ht,r.vy[t]-=Ct*bt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,L)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,R));const Y=i.depth;r.z[t]=2*f>=Y?Y/2:Math.min(Y-f,Math.max(f,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:f}=a;if(s>f&&this.spreadRing(t,e,s,n,i))return;const u=this.w3;let h=Math.floor(t/f-.5),m=t/f-h;u[0]=.5*(1.5-m)**2,u[1]=.75-(m-1)**2,u[2]=.5*(m-.5)**2;let p=Math.floor(e/f-1);m=e/f-.5-p,u[3]=.5*(1.5-m)**2,u[4]=.75-(m-1)**2,u[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const v=h+g,w=p+d;v<0||v>c||w<0||w>=l||(r.fU[v+w*(c+1)]+=n*u[g]*u[3+d])}h=Math.floor(t/f-1),m=t/f-.5-h,u[0]=.5*(1.5-m)**2,u[1]=.75-(m-1)**2,u[2]=.5*(m-.5)**2,p=Math.floor(e/f-.5),m=e/f-p,u[3]=.5*(1.5-m)**2,u[4]=.75-(m-1)**2,u[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const v=h+g,w=p+d;v<0||v>=c||w<0||w>l||(r.fV[v+w*c]+=i*u[g]*u[3+d])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:f}=a,u=a.phi,h=Math.max(1.5*s,s+2*f),m=s*s,p=h*h,d=Math.max(0,Math.floor((t-h)/f)),g=Math.min(c,Math.ceil((t+h)/f)),v=Math.max(0,Math.floor((e-h)/f)),w=Math.min(l,Math.ceil((e+h)/f));let x=0,_=0;for(let F=0;F<2;F+=1){if(F===1){if(!(x>0)||!(_>0))return!1;x=n/x,_=i/_}for(let T=v;T<=w;T+=1)for(let A=d;A<=g;A+=1){if(T<l){const b=A*f-t,P=(T+.5)*f-e,M=b*b+P*P;if(M>=m&&M<=p){const k=A+T*c,S=.5*((A>0?u[k-1]:0)+(A<c?u[k]:0));S>0&&(F===0?x+=S:r.fU[A+T*(c+1)]+=x*S)}}if(A<c){const b=(A+.5)*f-t,P=T*f-e,M=b*b+P*P;if(M>=m&&M<=p){const k=A+T*c,S=.5*((T>0?u[k-c]:0)+(T<l?u[k]:0));S>0&&(F===0?_+=S:r.fV[k]+=_*S)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const c=(n-r)/(a-r);return(1-c)*(Math.PI*s*s)/4+c*s*s}}class Oa{constructor(t){y(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function Wo(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const Zf=8,Jf=210,Ko=1.805,t0=3e-7;function zo(o,t){const e=kt(t);return kt(t+2*Ei(e)/o)-e}const le=class le{constructor(){y(this,"count",0);y(this,"fixed",0);y(this,"cell",new Int32Array(0));y(this,"fluid",new Int32Array(0));y(this,"dir",new Uint8Array(0));y(this,"r",new Float32Array(0));y(this,"s",new Float32Array(0));y(this,"z",new Float32Array(0));y(this,"bubble",new Uint32Array(0));y(this,"mat",new Uint8Array(0));y(this,"px",new Float64Array(0));y(this,"py",new Float64Array(0));y(this,"nx",new Float32Array(0));y(this,"ny",new Float32Array(0));y(this,"body",new Int16Array(0));y(this,"seg",new Int32Array(0));y(this,"t",new Float32Array(0));y(this,"pos",new Float64Array(2));y(this,"sg",new Float64Array(6))}static rRef(){if(le.ref>0)return le.ref;const t=kt(gn),e=2*Ei(t)/(Fn(t+1)-gn);return le.ref=Jf*e,le.ref}static draw(t,e,s,n){const i=ut[s],r=le.rRef(),a=le.rng;a.state=t||1;const c=Math.pow(r/i.cavRmax,Ko);let l=0;for(let f=0;f<Zf;f+=1){l+=a.exp();const u=r*Math.pow(l/(e*i.cavScale)+c,-1/Ko);if(u<t0)break;n.r.push(u),n.s.push(a.next()),n.z.push(a.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,a=[],c=[],l=[],f=[],u=[],h=[],m=[],p={r:[],s:[],z:[]};for(let _=0;_<t.n;_+=1){if(t.solid[_]===0||t.owner[_]!==0)continue;const F=_%n,T=(_-F)/n;for(let A=0;A<4;A+=1){const b=A===0?F-1:A===1?F+1:F,P=A===2?T-1:A===3?T+1:T;if(b<0||P<0||b>=n||P>=i)continue;const M=b+P*n;if(t.solid[M]===0){p.r.length=0,p.s.length=0,p.z.length=0,le.draw(Wo(e,_,A),r,t.solid[_]-1,p);for(let k=0;k<p.r.length;k+=1)a.push(_),c.push(M),l.push(A),f.push(p.r[k]),u.push(p.s[k]),h.push(p.z[k]),m.push(t.solid[_]-1)}}}const d=a.length,g=[],v=[],w=[];for(const _ of s)if(!_.gone)for(let F=0;F<_.nseg;F+=1){_.segment(F,this.sg);const T=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),A=Math.max(1,Math.round(T/t.dx));for(let b=0;b<A;b+=1){p.r.length=0,p.s.length=0,p.z.length=0,le.draw(Wo(e,1e5+1e3*_.key+F,b),T/A*t.depth,_.mat,p);for(let P=0;P<p.r.length;P+=1)a.push(-1),c.push(-1),l.push(_.segS[F]),f.push(p.r[P]),u.push(p.s[P]),h.push(p.z[P]),m.push(_.mat),g.push(_.index),v.push(F),w.push((b+p.s[P])/A)}}const x=a.length;this.count=x,this.fixed=d,this.cell=Int32Array.from(a),this.fluid=Int32Array.from(c),this.dir=Uint8Array.from(l),this.r=Float32Array.from(f),this.s=Float32Array.from(u),this.z=Float32Array.from(h),this.bubble=new Uint32Array(x),this.mat=Uint8Array.from(m),this.px=new Float64Array(x),this.py=new Float64Array(x),this.nx=new Float32Array(x),this.ny=new Float32Array(x),this.body=new Int16Array(x).fill(-1),this.seg=new Int32Array(x),this.t=new Float32Array(x);for(let _=0;_<d;_+=1){const F=this.cell[_],T=F%n,A=(F-T)/n,b=this.s[_],P=this.dir[_],M=t.dx;this.px[_]=P===0?T*M:P===1?(T+1)*M:(T+b)*M,this.py[_]=P===2?A*M:P===3?(A+1)*M:(A+b)*M,this.nx[_]=P===0?-1:P===1?1:0,this.ny[_]=P===2?-1:P===3?1:0}for(let _=d;_<x;_+=1)this.body[_]=g[_-d],this.seg[_]=v[_-d],this.t[_]=w[_-d];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const a=this.t[i],c=this.sg[0]+a*(this.sg[2]-this.sg[0]),l=this.sg[1]+a*(this.sg[3]-this.sg[1]),f=Math.cos(r.a),u=Math.sin(r.a),h=r.x+f*c-u*l,m=r.y+u*c+f*l,p=f*this.sg[4]-u*this.sg[5],d=u*this.sg[4]+f*this.sg[5];this.px[i]=h,this.py[i]=m,this.nx[i]=p,this.ny[i]=d,this.dir[i]=Math.abs(p)>=Math.abs(d)?p<0?0:1:d<0?2:3;const g=t.cellAt(h-n*p,m-n*d),v=t.cellAt(h+n*p,m+n*d);this.cell[i]=g,this.fluid[i]=v>=0&&t.solid[v]===0?v:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)ut[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};y(le,"ref",0),y(le,"rng",new Oa(1));let Rr=le;const e0=.0208,s0=1;class n0{constructor(t){y(this,"e");y(this,"burstVapour",0);y(this,"nucleated",0);y(this,"departed",0);y(this,"merged",0);y(this,"burst",0);y(this,"collapsed",0);y(this,"burstCold",0);y(this,"collapsedCold",0);y(this,"burstWarm",0);y(this,"collapsedWarm",0);y(this,"firstSuperheat",null);y(this,"firstMaterial",null);y(this,"departures",new Float64Array(256));y(this,"departureCount",0);y(this,"contactAngleOverride",null);y(this,"watch",-1);y(this,"watchFate",0);y(this,"sites",new Rr);y(this,"motion");y(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});y(this,"cells",new Int32Array(1024));y(this,"wts",new Float64Array(1024));y(this,"alphaTarget");y(this,"budget");y(this,"tsatCell");y(this,"dTb");y(this,"Fm");y(this,"vel",new Float64Array(2));y(this,"head");y(this,"next");y(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new Yf(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return zo(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),f=Math.floor(c),u=Math.floor(l),h=c-f,m=l-u;let p=0,d=0;for(let g=0;g<2;g+=1)for(let v=0;v<2;v+=1){const w=f+v+(u+g)*i;if(n.solid[w]!==0)continue;const x=(v===0?1-h:h)*(g===0?1-m:m);p+=x*n.pl[w],d+=x}return Math.max(.5*s.pRef,s.pRef+(d>0?p/d:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=Ho(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let c=0;c<i;c+=1){const l=this.cells[c];s.kind[l]===it&&(this.cells[a]=l,this.wts[a]=this.wts[c],r+=this.wts[c],a+=1)}for(let c=0;c<a;c+=1)this.wts[c]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;Xf(s.m,t*at,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==it){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const f=Math.max(.5*e.pRef,e.pRef+s.pl[l]),u=i.boilingAt(l,f);this.tsatCell[l]=u,i.salty&&(this.dTb[l]=u-kt(f)),this.budget[l]=i.Cl[l]*(i.Tl[l]-u)}this.Fm.fill(0),e.extremes.beginStep();const c=e.waterTemperature();if(this.bulkCold=c.mass>0&&c.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);if(this.coalesce(),e.extremes.normalize)for(let l=0;l<n.count;l+=1)n.r[l]>e.extremes.bubbleCap&&this.vent(l);for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r],c=this.sites.cell[r];if(a<0||c<0||s.kind[a]!==it||i.acc[a]<=0||i.waterShare(a)<.5||!e.heat.hasSolid(c))continue;const l=ut[this.sites.mat[r]],f=i.Tl[a],u=hn(i.host[a],f),h=(l.k*s.Ts[c]+u*f)/(l.k+u),m=Math.max(.5*e.pRef,e.pRef+s.pl[a]),p=this.tsatCell[a]>0?this.tsatCell[a]:kt(m);if(h-p<0)continue;const d=this.sites.r[r];if(h-p<e.extremes.activation(zo(d,m)))continue;const g=m+2*Ds(i.host[a],h)/d,v=kt(g),w=4/3*Math.PI*d*d*d,x=je(v)*w;if(x*4>i.acc[a])continue;const _=this.sites.position(this.e.grid,r,d),F=n.add(_[0],_[1],Math.min(s.depth-d,Math.max(d,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*at+X]=x,n.r[F]=d,n.V[F]=w,n.Tb[F]=v,n.pb[F]=g,n.pv[F]=g,n.H[F]=x*xt(v),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const T=i.waterH(a);this.Fm[a]-=x,e.heat.src[c]-=x*(xt(v)-T)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=h-p,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*at;let c=i.site[t],l=0;const f=i.V[t];let u=0,h=f;for(;l<e-1e-12;){h=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let d=Math.min(e-l,Math.max(1e-7,s0*i.age[t]),.25*n.dx/(p+1e-9));d<1e-7&&(d=Math.min(e-l,1e-7));let g,v=-1,w=0;if(c>=0){const L=this.sites.fluid[c],R=this.sites.cell[c];if(L<0||R<0||!s.heat.hasSolid(R)){this.detach(t),c=-1;continue}const B=ut[this.sites.mat[c]],Y=r.Tl[L],K=hn(r.host[L],Y);g=(B.k*n.Ts[R]+K*Y)/(B.k+K),v=R}else{if(w=this.liquidFootprint(t),w===0)break;g=0;for(let L=0;L<w;L+=1)g+=this.wts[L]*r.Tl[this.cells[L]]}let x=0;if(r.salty)if(c>=0)x=this.dTb[this.sites.fluid[c]];else for(let L=0;L<w;L+=1)x+=this.wts[L]*this.dTb[this.cells[L]];const _=i.Tb[t],F=c>=0?r.host[this.sites.fluid[c]]:r.hostAt(i.x[t],i.y[t]),T=hn(F,g),A=ps(F,g),b=no(F,g),P=bn(F,g),M=T/(A*b),k=2*m,S=i.age[t],O=T*Math.sqrt(3/(Math.PI*M)),C=c>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),I=A*C*k/P,j=P*b/T,D=T/k*(2+.6*Math.sqrt(I)*Math.cbrt(j)),E=xt(_)-Ft(g);let V=Math.max(O*2*(Math.sqrt(S+d)-Math.sqrt(S)),D*d);if(c>=0&&g>_+x){const L=.5*this.fritz(t,g),R=i.m[a+X]>0?i.m[a+X]/i.V[t]:je(_),B=V*(g-_-x)/(R*E);if(m<L&&m+B>L&&B>0){const Y=V*(L-m)/B;if(D*d>=O*2*(Math.sqrt(S+d)-Math.sqrt(S)))d=Y/D;else{const K=Math.sqrt(S)+Y/(2*O);d=K*K-S}d=Math.max(1e-9,Math.min(e-l,d*(1+1e-6))),V=Math.max(O*2*(Math.sqrt(S+d)-Math.sqrt(S)),D*d)}}const z=n.depth,N=i.V[t],Z=i.m[a+X]>0?i.m[a+X]/N:je(_),tt=V*(g-_-x)/(Z*E),q=Math.max(0,m+tt);let $;N<=Math.PI*z*z*z/6?$=4/3*Math.PI*(q*q*q-m*m*m):N>=Math.PI*z*z*z/4?$=Math.PI*z*(q*q-m*m):$=Math.PI*z*z*V*(g-_-x)/(Z*E);let U=Z*$*E;if(c>=0){const L=v,R=s.heat.solidCap(L)*Math.max(0,n.Ts[L]-_);if(U>0&&(U=Math.min(U,Math.max(0,R-this.used(L)))),U>0){const B=U;U=Math.min(U,s.extremes.wallLeft(L,e)),s.extremes.takeWall(L,U,B)}}else{let L=0;for(let R=0;R<w;R+=1)L+=this.wts[R]*this.budget[this.cells[R]];U>0?U=Math.min(U,Math.max(0,L)):U=Math.max(U,Math.min(0,L))}let H=U/E;H<0&&(H=Math.max(H,-i.m[a+X]));let nt=1,pt=!1;if(c<0&&H!==0&&!r.mixed)for(let L=0;L<w&&!pt;L+=1)pt=r.acc[this.cells[L]]<=0;const wt=L=>r.acc[L]>0?r.waterShare(L):0;if(c<0&&H!==0&&(r.mixed||pt)){nt=0;for(let L=0;L<w;L+=1)nt+=this.wts[L]*wt(this.cells[L]);H*=nt}if(H!==0){if(c>=0){const L=this.sites.fluid[c];H>0&&r.acc[L]+this.Fm[L]-H<0&&(H=Math.max(0,r.acc[L]+this.Fm[L]));const R=r.waterH(L);this.Fm[L]-=H,s.heat.src[v]-=H*(xt(_)-R)/e,this.budgetSolid(v,H*(xt(_)-R))}else for(let L=0;L<w;L+=1){const R=this.cells[L],B=r.mixed||pt?this.wts[L]*wt(R)/nt:this.wts[L];if(B===0)continue;const Y=r.waterH(R);this.Fm[R]-=H*B,s.heat.src[R]-=H*B*(xt(_)-Y)/e,this.budget[R]-=H*B*(xt(_)-Y)}i.m[a+X]+=H,i.H[t]+=H*xt(_),u+=H}if(this.solve(t,g),this.restoreEnthalpy(t,c,w,e),i.r[t]<1e-6||i.m[a+X]<=1e-18&&i.m[a+ot]+i.m[a+ct]<=0){i.age[t]+=d;break}if(c>=0){const L=this.sites.position(this.e.grid,c,i.r[t]);i.x[t]=L[0],i.y[t]=L[1],this.departure(t,g),c=i.site[t]}else this.motion.move(t,d,(i.V[t]-h)/d);if(i.age[t]+=d,l+=d,i.m[a+X]<=0&&i.m[a+ot]+i.m[a+ct]<=0)break}i.dmdt[t]=u/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=Uo(r.m,t*at,r.Tb[t],ie),c=a-r.H[t];if(c===0)return;if(e>=0){r.H[t]=a,i.heat.src[this.sites.cell[e]]-=c/n;return}const l=i.phase.Cl;let f=0;for(let u=0;u<s;u+=1)l[this.cells[u]]>0&&(f+=this.wts[u]);if(f>0){r.H[t]=a;for(let u=0;u<s;u+=1){const h=this.cells[u];l[h]>0&&(i.heat.src[h]-=c*this.wts[u]/(f*n))}}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=ut[this.sites.mat[i]],a=this.contactAngleOverride??r.contactAngle,c=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return e0*a*Math.sqrt(Ds(l,n.Tb[t])/(s.gy*(ps(l,e)-c)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const c=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],c),this.motion.ux0[t]=c[0],this.motion.uy0[t]=c[1],n.vx[t]=c[0],n.vy[t]=c[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const f=e.cellAt(s.x[l],s.y[l]);if(f<0){this.next[l]=-1;continue}this.next[l]=this.head[f],this.head[f]=l,s.r[l]>a&&(a=s.r[l])}const c=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const f=Math.floor(s.x[l]/r),u=Math.floor(s.y[l]/r);for(let h=Math.max(0,u-c);h<=Math.min(i-1,u+c);h+=1)for(let m=Math.max(0,f-c);m<=Math.min(n-1,f+c);m+=1)for(let p=this.head[m+h*n];p>=0;p=this.next[p]){if(p<=l||s.V[p]<=0)continue;const d=s.x[p]-s.x[l],g=s.y[p]-s.y[l],v=e.depth,x=2*s.r[l]>=v||2*s.r[p]>=v?0:s.z[p]-s.z[l],_=s.r[l]+s.r[p];d*d+g*g+x*x>=_*_||this.merge(l,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<at;a+=1)s.m[t*at+a]+=s.m[e*at+a],s.m[e*at+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*at,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+X]<=1e-18&&i.m[r+ot]+i.m[r+ct]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const c=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(c<0||n.kind[c]===G||l<0||n.kind[l]===G)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*at,a=e.extremes.bubbleCap,c=2*a<=s.depth?4/3*Math.PI*a*a*a:Math.PI*a*a*s.depth;if(!(n.V[t]>c))return;const l=1-c/n.V[t];let f=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;f>=0&&s.kind[f]!==G;)f=f+s.nx<i?f+s.nx:-1;if(f<0&&(f=$o(s,n.x[t])),f<0)return;const u=Go(s,e.gas.vgas,f,l*n.V[t],this.cells,this.wts);for(let h=0;h<u;h+=1){const m=this.cells[h],p=this.wts[h];for(let d=0;d<at;d+=1)s.mg[d*i+m]+=p*l*n.m[r+d];s.Hg[m]+=p*l*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=l*n.m[r+X],this.burstVapour+=l*n.m[r+X];for(let h=0;h<at;h+=1)n.m[r+h]*=1-l;n.H[t]*=1-l,n.V[t]=c,n.r[t]=a}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*at,c=i.n,l=r.m[a+X],f=r.m[a+ot]+r.m[a+ct];if(e||f>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==G;)m=m+i.nx<c?m+i.nx:-1;if(m<0&&(m=$o(i,r.x[t])),m>=0){const p=Go(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let d=0;d<p;d+=1){const g=this.cells[d],v=this.wts[d];for(let w=0;w<at;w+=1)i.mg[w*c+g]+=v*r.m[a+w];i.Hg[g]+=v*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let d=1;if(p.mixed){d=0;for(let g=0;g<m;g+=1)d+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const v=this.cells[g],w=p.mixed&&d>0?this.wts[g]*p.waterShare(v)/d:this.wts[g];if(w===0)continue;const x=p.waterH(v);this.Fm[v]+=l*w,n.heat.src[v]+=w*(r.H[t]-l*x)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[X*c+p]+=l,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const u=r.site[t];u>=0&&(this.sites.bubble[u]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const h=r.count-1;if(t!==h){this.motion.ux0[t]=this.motion.ux0[h],this.motion.uy0[t]=this.motion.uy0[h];const m=r.site[h];m>=0&&(this.sites.bubble[m]=r.id[h])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let f=0;f<n.count;f+=1){const u=Ho(n.x[f],n.y[f],n.r[f],n.V[f],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let h=0;h<u;h+=1)i[this.cells[h]]+=this.wts[h]*n.V[f]*r}const a=s.alpha,c=e.liquid.volSrc,l=Ca*t;for(let f=0;f<s.n;f+=1){const u=Math.min(i[f],Math.max(0,1-s.phiS[f])),h=u-a[f];h!==0&&(h>l?(c[f]+=l*s.vCell/t,a[f]+=l):h<-l?(c[f]-=l*s.vCell/t,a[f]-=l):(c[f]+=h*s.vCell/t,a[f]=u))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,c=a.add(t,e,s);if(c<0)return-1;const l=this.pressure(t,e),f=r.grid.cellAt(t,e),u=f>=0&&r.phase.Tl[f]>0?r.phase.Tl[f]:r.ambientT,h=l+2*Ds(f>=0?r.phase.host[f]:0,u)/n,m=4/3*Math.PI*n*n*n,p=c*at;if(i<=0){const d=kt(h);a.m[p+X]=je(d)*m}else{const d=h*m/(8.314462618*u);a.m[p+ot]=d*.79*mt[ot],a.m[p+ct]=d*.21*mt[ct]}return a.r[c]=n,this.solve(c,u),a.H[c]=Uo(a.m,p,a.Tb[c],ie),r.ledger.water+=a.m[p+X],r.ledger.air+=a.m[p+ot]+a.m[p+ct],r.ledger.energy+=a.H[c],this.motion.ux0[c]=0,this.motion.uy0[c]=0,c}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*at,n=t*oe;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+X],ma:e.m[s+ot]+e.m[s+ct],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+oe))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ft}}const qa=20,ja=.1,Ba=2,Ia=.004,Ra=1.5,Qo=.006,Xo=2;function i0(o,t,e){const s=o==="normalize";return{chf:Ea(t,e)*(s?ja:1),actMax:s?Ba:1e30,vmax:s?Ra:qa,bubCap:s?Ia:1e30}}function Ea(o,t){const e=kt(o),s=je(e),n=yn(e);return .149*Math.sqrt(s)*Jc(e)*Math.pow(Math.max(0,Ei(e)*t*(n-s)),.25)}class r0{constructor(t){y(this,"pending",null);y(this,"asked",!1);y(this,"heldHeat",0);y(this,"vented",0);y(this,"slowed",0);y(this,"maxBubble",0);y(this,"maxSpeed",0);y(this,"wall",new Float64Array(0));y(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?Ia:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=Ea(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?ja:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,Ba):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?Ra:qa;let n=0;for(let r=0;r<t.count;r+=1){const a=Math.hypot(t.vx[r],t.vy[r]);if(a>s){const c=s/a;t.vx[r]*=c,t.vy[r]*=c,this.slowed+=1,n=Math.max(n,s)}else a>n&&(n=a)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>Qo?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>Xo&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}observe(t,e,s){this.maxBubble=t,this.maxSpeed=e,!(this.mode!=="ask"||this.asked)&&(t>Qo?(this.pending={kind:"bubble",value:t,time:s},this.asked=!0):e>Xo&&(this.pending={kind:"speed",value:e,time:s},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function Yo(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const o0={mass:0,energy:0},c0={m:0,H:0,s:0};function a0(o,t,e,s,n,i,r=o0,a=[],c=c0){const l=o.n;let f=0,u=0,h=0,m=0,p=0,d=0,g=0;for(let S=0;S<l;S+=1){const O=o.owner[S]!==0||o.capB[S]>0;if(o.kind[S]===ft||o.solid[S]!==0){O||(f+=o.Es[S],p+=o.film[S],d+=o.crust[S]);continue}u+=o.Hg[S],h+=o.mg[X*l+S],m+=o.mfog[S],g+=o.mg[ot*l+S]+o.mg[ct*l+S]}let v=0,w=0,x=0,_=0;for(let S=0;S<t.count;S+=1){v+=t.mass[S]*t.h[S];const O=t.smass[2*S];_+=O,t.mat[S]===lt?w+=t.mass[S]-O:x+=t.mass[S]-O}f+=r.energy;let F=0;for(const S of a)S.gone||(f+=S.energy(),p+=S.filmMass(),d+=S.crustMass(),Ee(S.mat)>0&&(F+=S.m));v+=c.H,w+=c.m,_+=c.s;let T=0,A=0;for(let S=0;S<e.count;S+=1)T+=e.H[S],A+=e.m[S*at+X],g+=e.m[S*at+ot]+e.m[S*at+ct];const b=s.pvTerm();i.solids=f,i.liquid=v,i.gas=u,i.bubbles=T,i.pv=b,i.energy=f+v+u+T+b;const P=i.water;P.liquid=w,P.ice=F,P.vapour=h,P.fog=m,P.film=p,P.bubbles=A,P.escaped=n.escapedWater,P.total=w+F+h+m+p+A+n.escapedWater;const M=i.other;M.liquid=x,M.escaped=n.escapedOther,M.total=x+n.escapedOther;const k=i.salt;return k.liquid=_,k.crust=d,k.floor=r.mass,k.escaped=n.escapedSalt,k.total=_+d+r.mass+n.escapedSalt,i.air=g+n.escapedAir,i}function l0(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0}}}function on(o,t){o.bodies.list.length!==0&&If(o.bodies,t,o.ledger)}function f0(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)Rt.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(En(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)Rt.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*at+X],o.ledger.air-=n.m[i*at+ot]+n.m[i*at+ct],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function nr(o,t,e,s,n,i,r,a,c=-1){const l=o.bodies.adopt(t,e,s,o.opIndex,n,c);if(l===null)return null;i!==0&&o.bodies.turn(l,r,a,i*Math.PI/180),o.ledger.energy+=l.energy(),Ee(l.mat)>0&&(o.ledger.water+=l.m),f0(o,l);const f=o.grid,u=new Map,h=f.dx*f.dx;for(let m=0;m<l.nw;m+=1){const p=l.wc[m];u.set(p,(u.get(p)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*h))}for(const[m,p]of u)p>0&&f.solid[m]===0&&u0(o,m,Math.min(1,p));return l}function ai(o,t,e){const[s,n,i,r]=tn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),f=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=c;h+=1)xs(t,(h+.5)*o.dx,(u+.5)*o.dx)&&e(h+u*o.nx,h,u)}function Rn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[X*s+t]+e.mfog[t],o.ledger.air-=e.mg[ot*s+t]+e.mg[ct*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<at;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function u0(o,t,e){if(e>=1){Rn(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[X*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[ot*n+t]+s.mg[ct*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<at;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function ho(o,t,e,s){const n=o.grid,i=n.n;Rn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[X*i+t],o.ledger.air+=n.mg[ot*i+t]+n.mg[ct*i+t],o.ledger.energy+=n.Hg[t]}function En(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===lt?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function mo(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function ir(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)xs(t,e.x[n],e.y[n])&&(En(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)xs(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*at+X],o.ledger.air-=s.m[n*at+ot]+s.m[n*at+ct],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function h0(o,t,e,s,n){const i=o.grid,r=ut[e];for(const c of t)i.owner[c]!==0&&i.solid[c]!==0||(i.solid[c]!==0?(o.ledger.energy-=i.Es[c],o.ledger.water-=i.film[c],mo(o,c)):Rn(o,c),i.owner[c]=0,i.capB[c]=0,i.fs[c]=0,i.crust[c]=0,i.solid[c]=e+1,i.role[c]=0,i.heater[c]=n,i.film[c]=0,i.T[c]=s,i.Es[c]=r.rho*r.cp*i.vCell*(s-et),i.kind[c]=ft,o.ledger.energy+=i.Es[c]);const a=o.particles;for(let c=0;c<a.count;c+=1){const l=i.cellAt(a.x[c],a.y[c]);l<0||i.solid[l]===0||(En(o,c),o.liquid.removeParticle(c),c-=1)}o.solidsChanged()}function d0(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],mo(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&ho(o,n,o.ambientT,o.ambientY)}}function m0(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){ir(o,t.region);const g=new Float64Array(at);let v=0;for(const[w,x]of Object.entries(t.composition)){const _=w==="N2"?ot:w==="O2"?ct:w==="H2O"?X:-1;_>=0&&(g[_]=x,v+=x)}if(v<=0)g.set(o.ambientY.subarray(0,at));else for(let w=0;w<yt;w+=1)g[w]/=v;return ai(e,t.region,w=>{e.solid[w]===0&&ho(o,w,t.T,g)}),null}ir(o,t.region);const s=Jt.length;let n=0;for(const[g,v]of Object.entries(t.composition))va(g)>=0&&v>0&&(n+=v);const i=t.composition[Jt[lt].id]??0,r=n>0&&i>0?n/(n+i):0,a=g=>g===lt&&r>0?oo(t.T,r):ps(g,t.T),c=new Float64Array(s);let l=0;for(const[g,v]of Object.entries(t.composition)){const w=oa(g);if(w<0||!(v>0))continue;const x=w===lt&&r>0?v+n:v;c[w]+=x/a(w),l+=x/a(w)}if(l<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)c[g]/=l;const f=new Float64Array(s),u=new Float64Array(s);for(let g=0;g<s;g+=1)f[g]=a(g)*e.vCell/4,u[g]=g===lt&&r>0?Pa(t.T,r):Pl(g,t.T);const h=r*f[lt],m=new Float64Array(s),p=o.particles;let d=!1;return p0(e,t.region,(g,v)=>{const w=g+v*e.nx;if(e.solid[w]!==0)return;let x=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const T=(g+.25+.5*F)*e.dx,A=(v+.25+.5*_)*e.dx;if(!xs(t.region,T,A)||e.owner[w]!==0&&o.bodies.bodyAt(T,A,0)!==null)continue;let b=0;for(let S=0;S<s;S+=1)m[S]+=c[S],m[S]>m[b]&&(b=S);m[b]-=1;const P=f[b],M=u[b],k=b===lt?h:0;if(p.add(T,A,P,M,b,k)<0){d=!0;continue}x+=1,b===lt?o.ledger.water+=P-k:o.ledger.other+=P,o.ledger.salt+=k,o.ledger.energy+=P*M}x===4&&Rn(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":d?"fill: particle capacity reached":null}case"erase":{on(o,t.region),ir(o,t.region);const s=[];return ai(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),d0(o,s),null}case"move":{if(t.region!==null)return Zo(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(c=>!c.gone&&c.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const c of s)c.worldBox(c.x,c.y,c.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,a=c=>s.includes(c)?!0:(c.worldBox(c.x,c.y,c.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return Zo(o,{rect:i},t.dx,t.dy,a),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if(Ef(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=Bs(t.material);if(s<0)return`solid: unknown material ${t.material}`;on(o,t.region);const n=[];if(ai(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,c]=t.region.line,l=Math.ceil(Math.hypot(a-i,c-r)/(.5*e.dx))+1;for(let f=0;f<=l;f+=1){const u=e.cellAt(i+(a-i)*f/l,r+(c-r)*f/l);u>=0&&!n.includes(u)&&n.push(u)}}return o.bodies.sync(),h0(o,n,s,t.T,-1),null}case"body":{const s=Bs(t.material);if(s<0)return`body: unknown material ${t.material}`;on(o,t.region);const n=t.region;let i=null,r,a=t.angle,c,l;if("line"in n){const[f,u,h,m]=n.line,p=Math.max(n.width,Math.hypot(h-f,m-u));c=(f+h)/2,l=(u+m)/2,r=[c-p/2,l-n.width/2,c+p/2,l+n.width/2],a+=Math.atan2(m-u,h-f)*180/Math.PI}else if("circle"in n){const[f,u,h]=n.circle,m=.5*h*Math.sqrt(Math.PI);r=[f-m,u-m,f+m,u+m],c=f,l=u,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[f,u,h,m]=tn(n);r=[f,u,h,m],c=(f+h)/2,l=(u+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return nr(o,[r],s,t.T,t.pinned,a,c,l),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=Bs(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,c=t.y+t.h,l=t.lid?c-n:c,f=[[i,a,r,a+n],[i,a+n,i+n,l],[r-n,a+n,r,l]];t.lid&&f.push([i,l,r,c]);for(const u of f)on(o,{rect:[...u]});return nr(o,f,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=Bs(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return on(o,{rect:[...i]}),nr(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function Zo(o,t,e,s,n){const i=o.grid,{nx:r,ny:a,dx:c}=i,l=[];ai(i,t,w=>{i.solid[w]!==0&&i.owner[w]===0&&l.push(w)});const f=Math.round(e/c),u=Math.round(s/c),h=l.length>0?f*c:e,m=l.length>0?u*c:s;if(h===0&&m===0)return;const p=o.bodies.list.length>0?Rf(o.bodies,t,n):[],d=o.particles,g=o.bubbles;for(let w=0;w<d.count;w+=1){if(!xs(t,d.x[w],d.y[w]))continue;const x=d.x[w]+h,_=d.y[w]+m;if(x<=0||_<=0||x>=i.w||_>=i.h){En(o,w),o.liquid.removeParticle(w),w-=1;continue}d.x[w]=x,d.y[w]=_}for(let w=0;w<g.count;w+=1)xs(t,g.x[w],g.y[w])&&(g.x[w]=Math.min(i.w-1e-6,Math.max(1e-6,g.x[w]+h)),g.y[w]=Math.min(i.h-1e-6,Math.max(1e-6,g.y[w]+m)),g.site[w]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(p.length===0)return;Ro(o.bodies,p,h,m),o.bodies.sync();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);Jo(o);return}const v=l.map(w=>({c:w,s:i.solid[w],role:i.role[w],heater:i.heater[w],T:i.T[w],Es:i.Es[w],film:i.film[w],crust:i.crust[w]}));for(const w of v)o.ledger.energy-=w.Es,o.ledger.water-=w.film,o.ledger.salt-=w.crust,i.solid[w.c]=0,i.role[w.c]=0,i.heater[w.c]=-1,i.Es[w.c]=0,i.film[w.c]=0,i.crust[w.c]=0,i.kind[w.c]=0;for(const w of v){const x=w.c%r+f,_=Math.floor(w.c/r)+u;if(x<0||_<0||x>=r||_>=a)continue;const F=x+_*r;i.solid[F]!==0?(o.ledger.energy-=i.Es[F],o.ledger.water-=i.film[F],mo(o,F)):Rn(o,F),i.solid[F]=w.s,i.role[F]=w.role,i.heater[F]=w.heater,i.T[F]=w.T,i.Es[F]=w.Es,i.film[F]=w.film,i.crust[F]=w.crust,i.kind[F]=ft,o.ledger.energy+=w.Es,o.ledger.water+=w.film,o.ledger.salt+=w.crust}Ro(o.bodies,p,h,m),o.solidsChanged();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);Jo(o);for(const w of v)i.solid[w.c]===0&&o.gas.massOf(w.c)<=0&&ho(o,w.c,o.ambientT,o.ambientY)}function Jo(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(En(o,s),o.liquid.removeParticle(s),s-=1)}}function p0(o,t,e){const[s,n,i,r]=tn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),f=Math.min(o.ny-1,Math.floor(r/o.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=c;h+=1)e(h,u)}const Er="recreatio/lab2d",g0=o=>o==="ask"||o==="compute"||o==="normalize",x0={"very-high":.001,high:.002,medium:.003},v0=o=>o==="very-high"||o==="high"||o==="medium",y0=16e4,Ws=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function cn(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const vt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,St=(o,t,e)=>Math.min(e,Math.max(t,o)),cs=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},Xn=(o,t)=>o==="wall"||o==="open"?o:t,tc=.25*Ii,rr=2*Ii;function ec(o){const t={};let e=0;for(const[s,n]of Object.entries(cs(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function w0(o,t,e){const s=cs(o),n=et+vt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return Bs(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=nn(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",c=ec(s.composition),l=h=>a==="gas"?h==="N2"||h==="O2"||h==="H2O":oa(h)>=0||va(h)>=0,f={};for(const[h,m]of Object.entries(c))l(h)?f[h]=m:t.push(`ops[${e}]: unknown ${a} "${h}" dropped`);const u=Object.keys(f).length>0?ec(f):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:u}}case"erase":{const r=nn(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=St(vt(s.dx,0),-1,1),a=St(vt(s.dy,0),-1,1),c=cn(s.id);if(c!=="")return{op:"move",region:null,id:c,dx:r,dy:a};const l=nn(s.region);if(l===null)break;return{op:"move",region:l,id:null,dx:r,dy:a}}case"remove":{const r=cn(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=nn(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:cn(s.id),x:vt(s.x,.1),y:vt(s.y,0),w:St(vt(s.w,.07),.01,1),h:St(vt(s.h,.09),.01,1),wall:St(vt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:St(vt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:cn(s.id),x:vt(s.x,.1),y:vt(s.y,0),w:St(vt(s.w,.12),.005,1),h:St(vt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:St(vt(s.power,40),0,2e3),target:et+St(vt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:St(vt(s.angle,0),-180,180)};case"body":{const r=nn(s.region);if(r===null)break;return{op:"body",id:cn(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:St(vt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:vt(s.x,0),y:vt(s.y,0),pinned:s.pinned!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function Da(o,t,e=new Set){const s=new Set(e);for(const i of o)Ws(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function b0(o,t){const e=new Set;for(const r of o)Ws(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>Da([],r,new Set([...s,...e])),i=[];return o.forEach((r,a)=>{if(Ws(r)){let c=r.id;if(c==="")c=n(r.op);else if(s.has(c)){const l=n(r.op);t.push(`ops[${a}]: the name "${c}" is used twice, renamed to "${l}"`),c=l}s.add(c),i.push({...r,id:c});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const c=r.id;if(!s.has(c)){t.push(`ops[${a}]: no object "${c}" before this step`);return}}i.push(r)}),i}function or(o,t={}){const e=cs(o),s=[];e.format!==void 0&&e.format!==Er&&s.push(`format "${String(e.format)}" is not ${Er}`);const n=cs(e.box),i=cs(e.ambient),r=cs(i.air),a=cs(e.sides),c=vt(i.g,Ii),l=t.harness===!0?St(c,0,rr):St(c,tc,rr);l!==c&&s.push(`ambient.g ${c} m/s² is outside ${tc.toFixed(2)}–${rr.toFixed(2)}, using ${l.toFixed(2)}`);const f=vt(r.N2,.7676),u=vt(r.O2,.2324),h=f+u>0?f+u:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((d,g)=>{const v=w0(d,s,g);v!==null&&m.push(v)});const p=b0(m,s);return{scene:{seed:Math.floor(vt(e.seed,1))>>>0,box:{w:St(vt(n.w,.2),.02,.6),h:St(vt(n.h,.15),.02,.4),depth:St(vt(n.depth,.01),.002,.05)},ambient:{p:St(vt(i.p,gn/1e3),20,400)*1e3,T:et+St(vt(i.T,20),-20,100),rh:St(vt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,f)/h,O2:Math.max(0,u)/h}},sides:{left:Xn(a.left,"wall"),right:Xn(a.right,"wall"),bottom:Xn(a.bottom,"wall"),top:Xn(a.top,"open")},quality:v0(e.quality)?e.quality:"high",extremes:g0(e.extremes)?e.extremes:"ask",ops:p},warnings:s}}const jt=(o,t=6)=>Number(o.toFixed(t));function F0(o){switch(o.op){case"fill":return{op:"fill",region:rn(o.region),composition:{...o.composition},phase:o.phase,T:jt(o.T-et,3)};case"erase":return{op:"erase",region:rn(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:jt(o.dx),dy:jt(o.dy)}:{op:"move",region:rn(o.region),dx:jt(o.dx),dy:jt(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:rn(o.region),material:o.material,T:jt(o.T-et,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:jt(o.T-et,3),...o.lid?{lid:!0}:{},...sc(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:jt(o.target-et,3),on:o.on,T:jt(o.T-et,3),...sc(o)};case"body":return{op:"body",id:o.id,region:rn(o.region),material:o.material,T:jt(o.T-et,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:jt(o.angle,4)}:{}};case"pin":return{op:"pin",x:jt(o.x),y:jt(o.y),pinned:o.pinned}}}const sc=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:jt(o.angle,4)}:{}});function _0(o){return{format:Er,version:1,seed:o.seed,box:{...o.box},ambient:{p:jt(o.ambient.p/1e3,4),T:jt(o.ambient.T-et,3),rh:o.ambient.rh,g:jt(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(F0)}}const A0=new Set(["pinned","mode","power","target","on"]);function Ti(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(Ws(n)&&n.id===t)return s}return-1}function T0(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&Bs(t.material)>=0?t.material:o.material,r=(a,c,l,f)=>a===void 0||!Number.isFinite(a)?c:Math.max(l,Math.min(f,a));switch(o.op){case"body":{const[a,c,l,f]=tn(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const u=(a+l)/2,h=(c+f)/2,m=r(t.w,l-a,.002,.5),p=r(t.h,f-c,.002,.5);return{...o,region:{rect:[u-m/2,h-p/2,u+m/2,h+p/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function P0(o,t,e){const s=Ti(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=T0(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([c,l])=>l!==void 0&&!A0.has(c)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const c of o.bodies.list)c.gone||c.key!==s||(e.pinned!==void 0&&o.bodies.pin(c,e.pinned),i.op==="hotplate"&&c.heater>=0&&o.setHeater(c.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function k0(o,t){const e=Ti(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,a=0,c="gone";for(const l of o.bodies.list){if(l.gone||l.key!==e)continue;const f=Math.cos(l.a),u=Math.sin(l.a);for(let p=0;p<l.nr;p+=1){const[d,g,v,w]=l.bounds(p);for(const[x,_]of[[d,g],[v,g],[v,w],[d,w]])n.push(l.x+f*x-u*_,l.y+u*x+f*_)}i+=l.m;const h=l.m*ut[l.mat].cp;r+=h*l.meanT(),a+=h;const m=l.pinned?"pinned":l.asleep?"asleep":"moving";(c==="gone"||m==="moving")&&(c=m)}return{id:t,kind:s.op,outline:n,T:a>0?r/a:s.T,mass:i,state:c}}const S0=.02;function M0(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function L0(o,t){const e=2*Math.max(0,o-S0)*t;return e>1e-8?e/M0(e):1}function C0(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:a}=o,c=s+1,l=(x,_)=>.5*(r[x+_*c]+r[x+1+_*c]),f=(x,_)=>.5*(a[x+_*s]+a[x+(_+1)*s]),u=(r[t+1+e*c]-r[t+e*c])/i,h=(a[t+(e+1)*s]-a[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),d=Math.max(0,t-1),g=Math.min(s-1,t+1),v=p>m?(l(t,p)-l(t,m))/((p-m)*i):0,w=g>d?(f(g,e)-f(d,e))/((g-d)*i):0;return Math.hypot(.5*(u-h),.5*(v+w))}class O0{constructor(t){y(this,"e");y(this,"cap");y(this,"capT");y(this,"capA");y(this,"salt");y(this,"water");y(this,"fH");y(this,"fS");y(this,"outS");y(this,"outH");y(this,"inS");y(this,"inH");y(this,"cell",new Int32Array(0));y(this,"cpp",new Float64Array(0));y(this,"ds",new Float64Array(0));y(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:a,salt:c,water:l,fH:f,fS:u,cell:h,cpp:m}=this;i.fill(0),r.fill(0),a.fill(0),c.fill(0),l.fill(0);let p=!1;for(let x=0;x<e.count;x+=1){const _=s.cellAt(e.x[x],e.y[x]);if(h[x]=_,_<0)continue;const F=e.cp(x);m[x]=F;const T=e.mass[x]*F,A=e.T[x];if(i[_]+=T,r[_]+=T*A,a[_]+=T*hn(e.mat[x],A)/(e.rho[x]*F),e.mat[x]!==lt)continue;const b=e.smass[2*x];c[_]+=b,l[_]+=e.mass[x]-b,b>0&&(p=!0)}const{nx:d,ny:g,kind:v}=s,w=Math.PI*Math.PI*t/(s.dx*s.dx);for(let x=0;x<s.n;x+=1){if(f[x]=0,u[x]=0,!(i[x]>0))continue;const _=x%d,F=(x-_)/d;if(!(v[x]!==it&&(v[x]!==G||!(_>0&&v[x-1]===it||_<d-1&&v[x+1]===it||F>0&&v[x-d]===it||F<g-1&&v[x+d]===it)))&&(f[x]=1-Math.exp(-w*a[x]/i[x]),p&&c[x]>0)){const T=So(r[x]/i[x]);u[x]=1-Math.exp(-w*T*L0(C0(s,_,F),t/(w*T)))}}for(let x=0;x<e.count;x+=1){const _=h[x];if(_<0||f[_]===0)continue;const F=f[_]*(r[_]/i[_]-e.T[x]);if(F===0)continue;const T=e.mass[x]/e.rho[x];e.h[x]+=m[x]*F,e.derive(x),n.dVp[x]+=e.mass[x]/e.rho[x]-T}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:a,outH:c,inS:l,inH:f,cell:u,ds:h,hs:m}=this;a.fill(0),c.fill(0);for(let d=0;d<e.count;d+=1){h[d]=0;const g=u[d];if(g<0||r[g]===0||e.mat[d]!==lt)continue;const v=e.smass[2*d],w=r[g]*(n[g]/i[g]*(e.mass[d]-v)-v);if(h[d]=w,w<0){const x=ko(e.T[d],v/e.mass[d]);m[d]=x,a[g]-=w,c[g]-=w*x}}const p=this.saltBetween(t);for(let d=0;d<e.count;d+=1){const g=u[d];if(g<0||e.mat[d]!==lt)continue;let v=h[d],w=0;v<0?w=v*m[d]:v>0&&(a[g]>0?w=v*c[g]/a[g]:v=0);const x=e.smass[2*d],_=e.mass[d];if(p&&(l[g]!==0||f[g]!==0)){const A=l[g]<0?x/n[g]:(_-x)/i[g];v+=l[g]*A,w+=f[g]*A}if(v===0&&w===0)continue;const F=_*e.h[d]+w,T=_/e.rho[d];e.mass[d]=_+v,e.smass[2*d]=x+v,e.spc[2*d]=x+v>0?Ni:0,e.h[d]=F/e.mass[d],e.derive(d),s.dVp[d]+=e.mass[d]/e.rho[d]-T}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:a,inS:c,inH:l}=this,{nx:f,ny:u}=e;c.fill(0),l.fill(0);const h=t/(e.dx*e.dx);let m=!1;const p=(d,g,v)=>{if(i[g]===0||!(n[g]>0)||!(v>0))return;const w=s[d]/n[d],x=s[g]/n[g];if(w===x)return;const _=w>x?d:g,F=w>x?g:d,T=So(.5*(a[d]/r[d]+a[g]/r[g])),A=(v<1?v*T:T)*h*Math.min(n[d],n[g])*Math.abs(w-x),b=ko(a[_]/r[_],s[_]/(s[_]+n[_]));c[_]-=A,l[_]-=A*b,c[F]+=A,l[F]+=A*b,m=!0};for(let d=0;d<u;d+=1)for(let g=0;g<f;g+=1){const v=g+d*f;i[v]===0||!(n[v]>0)||(g+1<f&&p(v,v+1,e.au[g+1+d*(f+1)]),d+1<u&&p(v,v+f,e.av[v+f]))}return m}}const Ut=yt+2,se=yt,ae=yt+1,q0=.9,j0=16;class mn{constructor(t,e){y(this,"g");y(this,"gas");y(this,"conc");y(this,"fu");y(this,"fv");y(this,"outM");y(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Ut*s),this.fu=new Float64Array(Ut*t.nu),this.fv=new Float64Array(Ut*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,c=s+1,l=e.ug,f=e.vg;let u=0,h=0;for(let _=0;_<n;_+=1)for(let F=0;F<s;F+=1){const T=F+_*s;if(r[T]!==G)continue;const A=F+_*c,b=l[A],P=l[A+1],M=f[T],k=f[T+s],S=(b<0?-b:0)+(P>0?P:0)+(M<0?-M:0)+(k>0?k:0);S>u&&(u=S);const O=Math.max(b<0?-b:b,P<0?-P:P,M<0?-M:M,k<0?-k:k);O>h&&(h=O)}this.gas.last.uMax=h;const m=Math.min(j0,Math.max(1,Math.ceil(u*t/a/q0))),p=t/m,{conc:d}=this,g=this.gas.vgas,v=e.mg,w=e.mfog,x=e.Hg;for(let _=0;_<m;_+=1){for(let F=0;F<i;F+=1){if(r[F]!==G){for(let A=0;A<Ut;A+=1)d[A*i+F]=0;continue}const T=1/g[F];for(let A=0;A<yt;A+=1)d[A*i+F]=v[A*i+F]*T;d[se*i+F]=w[F]*T,d[ae*i+F]=x[F]*T}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let _=0;_<i;_+=1)r[_]===G&&this.gas.deriveCell(_);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,c=e.nu,l=e.ug,{conc:f,fu:u}=this,{amb:h,gasU:m}=this.gas,p=e.aFace,d=mn.face;for(let g=0;g<n;g+=1){const v=g*s,w=g*a;for(let x=0;x<=s;x+=1){const _=w+x,F=l[_];if(m[_]===0||F===0){for(let M=0;M<Ut;M+=1)u[M*c+_]=0;continue}const T=e.au[_]<1?F*p*t*e.au[_]:F*p*t;if(x===0||x===s){const M=x===0?v:v+s-1,k=x===0?F>0:F<0;for(let S=0;S<Ut;S+=1)u[S*c+_]=T*(k?h[S]:f[S*i+M]);continue}let A,b,P;if(F>0?(A=v+x-1,b=v+x,P=x>=2&&r[v+x-2]===G?v+x-2:-1):(A=v+x,b=v+x-1,P=x+1<s&&r[v+x+1]===G?v+x+1:-1),P<0){for(let M=0;M<Ut;M+=1)u[M*c+_]=T*f[M*i+A];continue}for(let M=0;M<Ut;M+=1){const k=M*i;u[M*c+_]=T*d(f[k+A],f[k+P],f[k+b])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,c=e.vg,{conc:l,fv:f}=this,{amb:u,gasV:h}=this.gas,m=e.aFace,p=mn.face;for(let d=0;d<=n;d+=1){const g=d*s;for(let v=0;v<s;v+=1){const w=g+v,x=c[w];if(h[w]===0||x===0){for(let b=0;b<Ut;b+=1)f[b*a+w]=0;continue}const _=e.av[w]<1?x*m*t*e.av[w]:x*m*t;if(d===0||d===n){const b=d===0?v:v+(n-1)*s,P=d===0?x>0:x<0;for(let M=0;M<Ut;M+=1)f[M*a+w]=_*(P?u[M]:l[M*i+b]);continue}let F,T,A;if(x>0?(F=w-s,T=w,A=d>=2&&r[w-2*s]===G?w-2*s:-1):(F=w,T=w-s,A=d+1<n&&r[w+s]===G?w+s:-1),A<0){for(let b=0;b<Ut;b+=1)f[b*a+w]=_*l[b*i+F];continue}for(let b=0;b<Ut;b+=1){const P=b*i;f[b*a+w]=_*p(l[P+F],l[P+A],l[P+T])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:c,fv:l}=this,{gasU:f,gasV:u,escaped:h}=this.gas,m=t.mg,p=t.mfog,d=t.Hg;for(let g=0;g<s;g+=1){const v=g*e,w=g*i;for(let _=1;_<e;_+=1){const F=w+_;if(f[F]===0)continue;const T=v+_-1,A=T+1;for(let M=0;M<yt;M+=1){const k=c[M*r+F];m[M*n+T]-=k,m[M*n+A]+=k}const b=c[se*r+F];p[T]-=b,p[A]+=b;const P=c[ae*r+F];d[T]-=P,d[A]+=P}if(f[w]!==0){const _=v;for(let A=0;A<yt;A+=1){const b=c[A*r+w];m[A*n+_]+=b,h[A]-=b}const F=c[se*r+w];p[_]+=F,h[se]-=F;const T=c[ae*r+w];d[_]+=T,h[ae]-=T}const x=w+e;if(f[x]!==0){const _=v+e-1;for(let A=0;A<yt;A+=1){const b=c[A*r+x];m[A*n+_]-=b,h[A]+=b}const F=c[se*r+x];p[_]-=F,h[se]+=F;const T=c[ae*r+x];d[_]-=T,h[ae]+=T}}for(let g=1;g<s;g+=1){const v=g*e;for(let w=0;w<e;w+=1){const x=v+w;if(u[x]===0)continue;const _=x-e,F=x;for(let b=0;b<yt;b+=1){const P=l[b*a+x];m[b*n+_]-=P,m[b*n+F]+=P}const T=l[se*a+x];p[_]-=T,p[F]+=T;const A=l[ae*a+x];d[_]-=A,d[F]+=A}}for(let g=0;g<e;g+=1){if(u[g]!==0){const w=g;for(let F=0;F<yt;F+=1){const T=l[F*a+g];m[F*n+w]+=T,h[F]-=T}const x=l[se*a+g];p[w]+=x,h[se]-=x;const _=l[ae*a+g];d[w]+=_,h[ae]-=_}const v=g+s*e;if(u[v]!==0){const w=g+(s-1)*e;for(let F=0;F<yt;F+=1){const T=l[F*a+v];m[F*n+w]-=T,h[F]+=T}const x=l[se*a+v];p[w]-=x,h[se]+=x;const _=l[ae*a+v];d[w]-=_,h[ae]+=_}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:c,scale:l}=this,f=t.nu,u=t.nv;c.fill(0);const h=mn.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let v=0;v<=e;v+=1){const w=v+g*i;if(m[w]===0)continue;const x=h(r,f,w);x>0&&v>0?c[v-1+g*e]+=x:x<0&&v<e&&(c[v+g*e]-=x)}for(let g=0;g<=s;g+=1)for(let v=0;v<e;v+=1){const w=v+g*e;if(p[w]===0)continue;const x=h(a,u,w);x>0&&g>0?c[v+(g-1)*e]+=x:x<0&&g<s&&(c[v+g*e]-=x)}let d=!1;for(let g=0;g<n;g+=1){const v=.9*this.gas.massOf(g);l[g]=c[g]>v&&c[g]>0?v/c[g]:1,l[g]<1&&(d=!0)}if(d){for(let g=0;g<s;g+=1)for(let v=0;v<=e;v+=1){const w=v+g*i;if(m[w]===0)continue;const _=h(r,f,w)>0?v>0?v-1+g*e:-1:v<e?v+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Ut;F+=1)r[F*f+w]*=l[_]}for(let g=0;g<=s;g+=1)for(let v=0;v<e;v+=1){const w=v+g*e;if(p[w]===0)continue;const _=h(a,u,w)>0?g>0?v+(g-1)*e:-1:g<s?v+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Ut;F+=1)a[F*u+w]*=l[_]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=se;i+=1)n+=t[i*e+s];return n}}const Xt=.05;class B0{constructor(t,e,s){y(this,"g");y(this,"R");y(this,"solver");y(this,"vgas");y(this,"rho");y(this,"nmol");y(this,"cap");y(this,"mu");y(this,"veos");y(this,"srcV");y(this,"veosMid");y(this,"mover");y(this,"gasU");y(this,"gasV");y(this,"u0");y(this,"v0");y(this,"u1");y(this,"v1");y(this,"lim");y(this,"amb",new Float64Array(Ut));y(this,"ambT",293.15);y(this,"escaped",new Float64Array(Ut));y(this,"dp0",new Float64Array(8));y(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});y(this,"lo",0);y(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new mn(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<yt;a+=1)n+=s[a]/mt[a];const i=e/(Bt*t*n);let r=0;for(let a=0;a<yt;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*ie(a,t);this.amb[se]=0,this.amb[ae]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*Ft(e);for(let r=0;r<yt;r+=1)i+=s.mg[r*n+t]*ie(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Lr(s.mg[t],s.mg[n+t],s.mg[X*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[X*s+t],c=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/mt[0]+r/mt[1]+a/mt[X],l+c<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let f;if(c<=0)f=na(i,r,a,e.Hg[t]);else{f=e.T[t]>100?e.T[t]:this.ambT;for(let u=0;u<4;u+=1){const h=(e.Hg[t]-this.enthalpy(t,f))/this.heatCapacity(t,f);if(f+=h,Math.abs(h)<1e-10)break}}f>150&&f<3e3||(f=Math.min(3e3,Math.max(150,Number.isFinite(f)?f:this.ambT))),e.T[t]=f,this.cap[t]=Lr(i,r,a,c,f),this.rho[t]=l/n,this.mu[t]=Fl(i,r,a,f)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ft){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===it&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Bt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ft){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[X*e+s];if(t.kind[s]===it&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Bt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ft||this.vgas[e]<=0?0:this.nmol[e]*Bt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<yt;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let c=0;for(let u=0;u<yt;u+=1)c+=s[u]/mt[u];const l=this.R.pAt(t)*a/(Bt*e*c);let f=0;for(let u=0;u<yt;u+=1)i.mg[u*r+t]=l*s[u],f+=l*s[u]*ie(u,e);i.mfog[t]=0,i.Hg[t]=f,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let a=0;a<n;a+=1){const c=t[a],l=i[a];if(c===l||l===ft||c===ft)continue;r+=1;const f=a%s,u=(a-f)/s;let h=0;for(let m=0;m<4;m+=1){const p=this.across(a,f,u,m);p>=0&&i[p]===G&&t[p]===G&&(h+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(!(h<=0)){if(l===it)for(let m=0;m<4;m+=1){const p=this.across(a,f,u,m);if(p<0||i[p]!==G||t[p]!==G)continue;const d=(this.vgas[p]>0?this.vgas[p]:e.vCell)/h;this.move(a,p,d)}else{let m=this.massOf(a),p=0;for(let d=0;d<4;d+=1){const g=this.across(a,f,u,d);if(g<0||i[g]!==G||t[g]!==G)continue;const v=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h;p+=v*this.rho[g]}if(p*=Math.max(.001,1-e.fs[a]-e.phi[a]-e.alpha[a])*e.vCell,p<=m)continue;for(let d=0;d<4;d+=1){const g=this.across(a,f,u,d);if(g<0||i[g]!==G||t[g]!==G)continue;const v=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h,w=this.massOf(g);if(w<=0)continue;const x=Math.min(.25,(p-m)*v/w);this.move(g,a,x)}m=this.massOf(a),m>0&&(e.T[a]=this.ambT)}this.deriveCell(a)}}return r}across(t,e,s,n){const i=this.g,{nx:r,ny:a}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<a-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let c=0;c<yt;c+=1){const l=n.mg[c*i+t]*s;n.mg[c*i+t]-=l,n.mg[c*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let c=0;c<s;c+=1)for(let l=0;l<=e;l+=1){const f=l+c*i,u=l>0?n[l-1+c*e]:-1,h=l<e?n[l+c*e]:-1;let m=0;(u===G&&h===G||l===0&&t.openL&&h===G||l===e&&t.openR&&u===G)&&(m=1),t.au[f]<=0&&(m=0),this.gasU[f]=m,m===0&&(r[f]=u===it||h===it?u===ft||h===ft||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[f]:t.usol[f])}for(let c=0;c<=s;c+=1)for(let l=0;l<e;l+=1){const f=l+c*e,u=c>0?n[l+(c-1)*e]:-1,h=c<s?n[l+c*e]:-1;let m=0;(u===G&&h===G||c===0&&t.openB&&h===G||c===s&&t.openT&&u===G)&&(m=1),t.av[f]<=0&&(m=0),this.gasV[f]=m,m===0&&(a[f]=u===it||h===it?u===ft||h===ft||c===0&&!t.openB||c===s&&!t.openT?0:t.vl[f]:t.vsol[f])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),f=Math.min(r-1.000001,Math.max(0,s/a-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h,d=t[u+h*c],g=t[u+1+h*c],v=t[u+(h+1)*c],w=t[u+1+(h+1)*c];return this.lo=Math.min(d,g,v,w),this.hi=Math.max(d,g,v,w),(1-p)*((1-m)*d+m*g)+p*((1-m)*v+m*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),f=Math.floor(c),u=Math.floor(l),h=c-f,m=l-u,p=t[f+u*i],d=t[f+1+u*i],g=t[f+(u+1)*i],v=t[f+1+(u+1)*i];return this.lo=Math.min(p,d,g,v),this.hi=Math.max(p,d,g,v),(1-m)*((1-h)*p+h*d)+m*((1-h)*g+h*v)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,c=n+1,l=s.ug,f=s.vg,{u0:u,v0:h,u1:m,v1:p}=this,d=this.lim;u.set(l),h.set(f);for(let x=0;x<i;x+=1)for(let _=0;_<=n;_+=1){const F=_+x*c;if(this.gasU[F]===0){m[F]=u[F];continue}const T=_*r,A=(x+.5)*r,b=this.sampleV(h,T,A);m[F]=this.sampleU(u,T-t*u[F],A-t*b),d[2*F]=this.lo,d[2*F+1]=this.hi}const g=2*s.nu;for(let x=0;x<=i;x+=1)for(let _=0;_<n;_+=1){const F=_+x*n;if(this.gasV[F]===0){p[F]=h[F];continue}const T=(_+.5)*r,A=x*r,b=this.sampleU(u,T,A);p[F]=this.sampleV(h,T-t*b,A-t*h[F]),d[g+2*F]=this.lo,d[g+2*F+1]=this.hi}for(let x=0;x<i;x+=1)for(let _=0;_<=n;_+=1){const F=_+x*c;if(this.gasU[F]===0)continue;const T=_*r,A=(x+.5)*r,b=this.sampleV(h,T,A),P=this.sampleU(m,T+t*u[F],A+t*b);let M=m[F]+.5*(u[F]-P);(M<d[2*F]||M>d[2*F+1])&&(M=m[F]),l[F]=M}for(let x=0;x<=i;x+=1)for(let _=0;_<n;_+=1){const F=_+x*n;if(this.gasV[F]===0)continue;const T=(_+.5)*r,A=x*r,b=this.sampleU(u,T,A),P=this.sampleV(p,T+t*b,A+t*h[F]);let M=p[F]+.5*(h[F]-P);(M<d[g+2*F]||M>d[g+2*F+1])&&(M=p[F]),f[F]=M}const v=this.R;for(let x=0;x<=i;x+=1)for(let _=0;_<n;_+=1){const F=_+x*n;if(this.gasV[F]===0)continue;const T=x>0?_+(x-1)*n:-1,A=x<i?_+x*n:-1,b=T>=0&&a[T]===G?this.rho[T]:-1,P=A>=0&&a[A]===G?this.rho[A]:-1,M=Math.max(Xt,b>0&&P>0?.5*(b+P):Math.max(b,P));if(!(b>0||P>0))continue;const k=b>0?T:A,S=v.id[k],O=S>=0?v.rhoBar[S]:v.rhoAmb;f[F]-=t*e*(M-O)/M}m.set(l),p.set(f);const w=t/(r*r);for(let x=0;x<i;x+=1)for(let _=0;_<=n;_+=1){const F=_+x*c;if(this.gasU[F]===0)continue;const T=_<n&&a[_+x*n]===G?_+x*n:_-1+x*n,A=this.mu[T]/Math.max(Xt,this.rho[T]),b=m[F],P=_<n?m[F+1]:b,M=_>0?m[F-1]:b,k=x>0?m[F-c]:s.openB?b:-b,S=x<i-1?m[F+c]:s.openT?b:-b;l[F]=b+Math.min(.2,w*A)*(P+M+k+S-4*b)}for(let x=0;x<=i;x+=1)for(let _=0;_<n;_+=1){const F=_+x*n;if(this.gasV[F]===0)continue;const T=x<i&&a[_+x*n]===G?_+x*n:_+(x-1)*n,A=this.mu[T]/Math.max(Xt,this.rho[T]),b=p[F],P=x<i?p[F+n]:b,M=x>0?p[F-n]:b,k=_>0?p[F-1]:s.openL?b:-b,S=_<n-1?p[F+1]:s.openR?b:-b;f[F]=b+Math.min(.2,w*A)*(S+k+M+P-4*b)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==G){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:c}=n,l=i+1,f=n.ug,u=n.vg;let h=i,m=-1,p=r,d=-1,g=0;for(let A=0;A<r;A+=1)for(let b=0;b<i;b+=1)c[b+A*i]===G&&(g+=1,b<h&&(h=b),b>m&&(m=b),A<p&&(p=A),A>d&&(d=A));const v=this.last.solve;if(v.iterations=0,v.residual=0,v.capped=!1,this.last.cells=g,g===0)return this.last;const w=this.solver,x=w.begin(m-h+1,d-p+1),_=this.rho;for(let A=p;A<=d;A+=1)for(let b=h;b<=m;b+=1){const P=b+A*i;if(c[P]!==G)continue;const M=w.at(b-h,A-p);x.act[M]=1,x.x[M]=n.pg[P];const k=b+A*l,S=b+A*i,O=this.fluxU(k+1)-this.fluxU(k)+this.fluxV(S+i)-this.fluxV(S);x.b[M]=n.Sg[P]*a*a-a*O;const C=Math.max(Xt,_[P]);b+1<i?c[P+1]===G&&b+1<=m&&this.gasU[k+1]!==0&&(x.ax[M]=n.au[k+1]*2*t/(C+Math.max(Xt,_[P+1]))):n.openR&&this.gasU[k+1]!==0&&(x.dDx[M]+=n.au[k+1]*2*t/C),b===0&&n.openL&&this.gasU[k]!==0&&(x.dDx[M]+=n.au[k]*2*t/C),A+1<r?c[P+i]===G&&A+1<=d&&this.gasV[S+i]!==0&&(x.ay[M]=n.av[S+i]*2*t/(C+Math.max(Xt,_[P+i]))):n.openT&&this.gasV[S+i]!==0&&(x.dDy[M]+=n.av[S+i]*2*t/C),A===0&&n.openB&&this.gasV[S]!==0&&(x.dDy[M]+=n.av[S]*2*t/C)}const F=w.solve(e,s,!0);v.iterations=F.iterations,v.residual=F.residual,v.capped=F.capped;const T=n.pg;for(let A=0;A<n.n;A+=1)c[A]!==G&&(T[A]=0);for(let A=p;A<=d;A+=1)for(let b=h;b<=m;b+=1){const P=b+A*i;c[P]===G&&(T[P]=x.x[w.at(b-h,A-p)])}for(let A=0;A<r;A+=1)for(let b=0;b<=i;b+=1){const P=b+A*l;if(this.gasU[P]===0)continue;if(b===0){f[P]-=2*t/Math.max(Xt,_[A*i])/a*T[A*i];continue}if(b===i){f[P]+=2*t/Math.max(Xt,_[i-1+A*i])/a*T[i-1+A*i];continue}const M=b-1+A*i,k=b+A*i;f[P]-=2*t/(Math.max(Xt,_[M])+Math.max(Xt,_[k]))/a*(T[k]-T[M])}for(let A=0;A<=r;A+=1)for(let b=0;b<i;b+=1){const P=b+A*i;if(this.gasV[P]===0)continue;if(A===0){u[P]-=2*t/Math.max(Xt,_[b])/a*T[b];continue}if(A===r){u[P]+=2*t/Math.max(Xt,_[b+(r-1)*i])/a*T[b+(r-1)*i];continue}const M=b+(A-1)*i,k=b+A*i;u[P]-=2*t/(Math.max(Xt,_[M])+Math.max(Xt,_[k]))/a*(T[k]-T[M])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let c=0;for(let u=0;u<n;u+=1){if(s.id[u]!==r||e.kind[u]===ft||this.cap[u]<=0)continue;const h=this.nmol[u];c+=h*(h*Bt*e.T[u]/s.pAt(u))/this.cap[u]}c*=Bt/a;const l=1/Math.max(.05,1-c);let f=0;for(let u=0;u<4;u+=1){const h=s.statePressure(r);s.p0[r]=h;const m=(h-(t[r]+f))*l;if(Math.abs(m)<=1e-10*h)break;let p=0;for(let d=0;d<n;d+=1){if(s.id[d]!==r||e.kind[d]===ft||this.cap[d]<=0)continue;const g=this.nmol[d]*Bt*e.T[d]/s.pAt(d);p+=g,e.Hg[d]+=g*m,this.deriveCell(d)}f+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=f}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<yt;i+=1)n+=e.mg[i*s+t]/mt[i];return n<=0?0:e.mg[X*s+t]/mt[X]/n*this.R.pAt(t)}}const nc=[1/6,2/3,1/6];class I0{constructor(t,e,s,n){y(this,"nx");y(this,"ny");y(this,"n");y(this,"dx");y(this,"depth");y(this,"vCell");y(this,"aFace");y(this,"nu");y(this,"nv");y(this,"openL",!1);y(this,"openR",!1);y(this,"openB",!1);y(this,"openT",!0);y(this,"solid");y(this,"role");y(this,"heater");y(this,"phiS");y(this,"sdf");y(this,"owner");y(this,"fs");y(this,"capB");y(this,"matB");y(this,"Ts");y(this,"au");y(this,"av");y(this,"usol");y(this,"vsol");y(this,"thin");y(this,"thinAny",!1);y(this,"phi");y(this,"alpha");y(this,"kind");y(this,"region");y(this,"pl");y(this,"pg");y(this,"mg");y(this,"mfog");y(this,"Hg");y(this,"Es");y(this,"film");y(this,"crust");y(this,"T");y(this,"Tl");y(this,"Cl");y(this,"Sl");y(this,"Sg");y(this,"ul");y(this,"vl");y(this,"ug");y(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(at*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const c=a+r*t;i[c]===0&&(a>0&&s[a+r*(t+1)]<=0&&i[c-1]===0&&this.thinBlock(a-1,a,r-1,r+1),r>0&&n[c]<=0&&i[c-t]===0&&this.thinBlock(a-1,a+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:a}=this,c=s+1,l=t+e*s;let f=0;if(a[l]===0)for(let u=0;u<9;u+=1){const h=u%3-1,m=(u/3|0)-1,p=t+h,d=e+m;if(u===4||p<0||d<0||p>=s||d>=n||a[p+d*s]!==0)continue;const g=(h>0?1:0)+e*c,v=(m>0?1:0)*s;let w;if(m===0)w=i[t+g]<=0;else if(h===0)w=r[t+e*s+v]<=0;else{const x=a[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+v]<=0),_=a[t+d*s]===0&&(r[t+e*s+v]<=0||i[t+(h>0?1:0)+d*c]<=0);w=x&&_}w&&(f|=1<<u)}this.thin[l]=f}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let a=0;a<9;a+=1)i>>a&1?s[n+a]=0:r+=s[n+a];if(r>0)for(let a=0;a<9;a+=1)s[n+a]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:a}=this,c=Math.max(0,t),l=Math.max(0,e),f=Math.min(i-1,s),u=Math.min(r-1,n);for(let p=l;p<=u;p+=1)for(let d=c;d<=f;d+=1){const g=d+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let v=0;for(let w=-1;w<=1;w+=1)for(let x=-1;x<=1;x+=1)v+=nc[x+1]*nc[w+1]*this.solidShare(d+x,p+w);this.phiS[g]=v}const h=4,m=h*a;for(let p=l;p<=u;p+=1)for(let d=c;d<=f;d+=1){const g=d+p*i,v=this.solid[g]!==0,w=(d+.5)*a,x=(p+.5)*a;let _=m;v||(this.openL||(_=Math.min(_,w)),this.openR||(_=Math.min(_,this.w-w)),this.openB||(_=Math.min(_,x)),this.openT||(_=Math.min(_,this.h-x)));for(let F=-h;F<=h;F+=1){const T=p+F;if(!(T<0||T>=r))for(let A=-h;A<=h;A+=1){const b=d+A;if(b<0||b>=i||this.solid[b+T*i]!==0===v)continue;const M=Math.max(0,Math.abs(b+.5-(d+.5))-.5)*a,k=Math.max(0,Math.abs(T+.5-(p+.5))-.5)*a,S=Math.hypot(M,k);S<_&&(_=S)}}this.sdf[g]=v?-_:_}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),c=Math.floor(r),l=Math.floor(a),f=r-c,u=a-l,h=Math.min(s-1,c+1),m=Math.min(n-1,l+1),p=this.sdf;let d=(1-u)*((1-f)*p[c+l*s]+f*p[h+l*s])+u*((1-f)*p[c+m*s]+f*p[h+m*s]);return this.openL||(d=Math.min(d,t)),this.openR||(d=Math.min(d,this.w-t)),this.openB||(d=Math.min(d,e)),this.openT||(d=Math.min(d,this.h-e)),d}}const R0=5,ic=30;class E0{constructor(t,e,s,n,i){y(this,"g");y(this,"P");y(this,"L");y(this,"G");y(this,"solver");y(this,"src");y(this,"C");y(this,"Cs");y(this,"Cg");y(this,"CTl");y(this,"Tstar");y(this,"k");y(this,"dE");y(this,"Tnew");y(this,"gx");y(this,"gy");y(this,"q");y(this,"Co");y(this,"CKo");y(this,"heaters",[]);y(this,"ambientT",293.15);y(this,"fluxSL",0);y(this,"fluxLG",0);y(this,"fluxSG",0);y(this,"lossSolids",0);y(this,"liquidPower",0);y(this,"hExt",ia);y(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});y(this,"bodies",[]);y(this,"qb");y(this,"kS");y(this,"kF");y(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=ut[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*bs}solidEnergy(t,e){return this.solidCapCrust(t)*(e-et)+this.g.film[t]*Ft(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=et+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:et+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Re(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let c=0;c<s.ncell;c+=1)r+=s.cellVolume(c);if(!(r>0))continue;const a=n.P*i/r;for(let c=0;c<s.nw;c+=1){const l=a*s.ww[c]*s.cellVolume(s.wk[c]);t[s.wc[c]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/R0,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/ic);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/ic)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:c,ny:l,n:f,depth:u,dx:h}=n,{C:m,Cs:p,Cg:d,CTl:g,Tstar:v,k:w,q:x,src:_}=this;this.heaterPower(t),g.fill(0);const F=n.Cl;F.fill(0);const{Co:T,CKo:A}=this;let b=!1,P=0;for(let L=0;L<i.count;L+=1){const R=i.mat[L],B=i.T[L],Y=i.mass[L]*i.cp(L);P+=Y;const K=9*L,ht=r.bi[L],bt=r.bj[L],dt=R===lt?0:hn(R,B);R!==lt&&!b&&(b=!0,T.fill(0),A.fill(0));for(let Ct=0;Ct<9;Ct+=1){const Et=r.wt[K+Ct];if(Et===0)continue;const Dt=ht+Ct%3,gt=bt+(Ct/3|0);if(Dt<0||gt<0||Dt>=c||gt>=l)continue;const Lt=Dt+gt*c;F[Lt]+=Et*Y,g[Lt]+=Et*Y*B,R!==lt&&(T[Lt]+=Et*Y,A[Lt]+=Et*Y*dt)}}const M=this.qb;M.fill(0);let k=this.bodyHeat(M);const{kS:S,kF:O,dSF:C}=this;for(let L=0;L<f;L+=1){let R=0,B=0;const Y=n.solid[L]!==0?n.T[L]:n.Ts[L];if(n.solid[L]!==0||n.capB[L]>0){R=this.solidCapCrust(L)+n.film[L]*Re(Y);const gt=n.solid[L]!==0?ut[n.solid[L]-1]:ut[n.matB[L]-1];B=gt!==void 0?gt.k:0}const K=a.cap[L]>0&&n.solid[L]===0?a.cap[L]:0,ht=F[L],bt=R+K+ht;if(p[L]=R,d[L]=K,m[L]=bt,C[L]=0,bt<=0){v[L]=n.T[L],w[L]=0,x[L]=0;continue}const dt=(R*Y+K*n.T[L]+g[L])/bt;v[L]=dt,ht>0&&(n.Tl[L]=g[L]/ht);let Ct=B;if(n.solid[L]===0){const gt=ht>=K?b&&T[L]>0?((ht-T[L])*pi(dt)+A[L])/ht:pi(dt):sa(n.mg[L],n.mg[f+L],n.mg[X*f+L],dt);if(R>0){const Lt=Math.min(1,n.fs[L]);Ct=Lt*B+(1-Lt)*gt,S[L]=B,O[L]=gt,K+ht>0&&(C[L]=Y-(K*n.T[L]+g[L])/(K+ht))}else Ct=gt}w[L]=Ct;let Et=_[L]+M[L];if(this.liquidPower!==0&&ht>0){const gt=this.liquidPower*ht/P;Et+=gt,k+=gt}const Dt=n.heater[L];if(Dt>=0&&n.role[L]===1){const gt=this.heaters[Dt];gt!==void 0&&gt.cells>0&&(Et+=gt.P/gt.cells,k+=gt.P/gt.cells)}x[L]=Et}const{gx:I,gy:j}=this;for(let L=0;L<l;L+=1)for(let R=0;R<c;R+=1){const B=R+L*c;if(I[B]=0,j[B]=0,m[B]<=0)continue;const Y=w[B];if(R+1<c&&m[B+1]>0){const K=w[B+1];Y+K>0&&(I[B]=2*Y*K/(Y+K)*u)}if(L+1<l&&m[B+c]>0){const K=w[B+c];Y+K>0&&(j[B]=2*Y*K/(Y+K)*u)}}const D=this.solver,E=D.begin(c,l),V=E.stride,z=h*u,N=this.hExt*z,Z=this.ambientT;for(let L=0;L<l;L+=1)for(let R=0;R<c;R+=1){const B=R+L*c;if(m[B]<=0)continue;const Y=R+1+(L+1)*V;E.act[Y]=1,E.dH[Y]=m[B]/t;let K=x[B];const ht=w[B],bt=v[B];R+1<c&&(E.ax[Y]=I[B],K+=I[B]*(v[B+1]-bt)),R>0&&(K+=I[B-1]*(v[B-1]-bt)),L+1<l&&(E.ay[Y]=j[B],K+=j[B]*(v[B+c]-bt)),L>0&&(K+=j[B-c]*(v[B-c]-bt));let dt=0;R===0&&(dt+=this.sideConductance(n.openL,ht,N,u)),R===c-1&&(dt+=this.sideConductance(n.openR,ht,N,u)),L===0&&(dt+=this.sideConductance(n.openB,ht,N,u)),L===l-1&&(dt+=this.sideConductance(n.openT,ht,N,u)),dt>0&&(E.dDx[Y]=dt,K+=dt*(Z-v[B])),E.b[Y]=K}const tt=D.solve(e,s,!1),q=this.last.solve;q.iterations=tt.iterations,q.residual=tt.residual,q.capped=tt.capped;const $=this.Tnew,U=E.x;for(let L=0;L<l;L+=1)for(let R=0;R<c;R+=1){const B=R+L*c;$[B]=m[B]>0?v[B]+U[R+1+(L+1)*V]:n.T[B]}const H=this.dE;let nt=0,pt=0;for(let L=0;L<f;L+=1)H[L]=m[L]>0?x[L]*t:0;for(let L=0;L<l;L+=1)for(let R=0;R<c;R+=1){const B=R+L*c;if(m[B]<=0)continue;const Y=w[B];if(I[B]>0){const K=I[B]*($[B+1]-$[B])*t;H[B]+=K,H[B+1]-=K,n.kind[B]!==n.kind[B+1]&&this.pair(n.kind[B],n.kind[B+1],K)}if(j[B]>0){const K=j[B]*($[B+c]-$[B])*t;H[B]+=K,H[B+c]-=K,n.kind[B]!==n.kind[B+c]&&this.pair(n.kind[B],n.kind[B+c],K)}for(let K=0;K<4;K+=1){if(!(K===0?R===0:K===1?R===c-1:K===2?L===0:L===l-1))continue;const bt=K===0?n.openL:K===1?n.openR:K===2?n.openB:n.openT,dt=this.sideConductance(bt,Y,N,u)*($[B]-Z)*t;H[B]-=dt,bt?pt+=dt:nt+=dt,n.solid[B]!==0&&(this.lossSolids+=dt)}}for(let L=0;L<f;L+=1){if(m[L]<=0)continue;const R=H[L]/m[L];$[L]=R;let B=0;const Y=d[L]+F[L];if(C[L]!==0&&p[L]>0&&Y>0){const K=Math.min(.999,Math.max(.001,n.fs[L])),ht=u/(.5*K/Math.max(1e-9,S[L])+.5*(1-K)/Math.max(1e-9,O[L])),bt=p[L]*Y/(p[L]+Y);B=(1-Math.exp(-t*ht/bt))*C[L]*bt}p[L]>0&&(n.Es[L]+=R*p[L]-B,this.deriveSolid(L)),d[L]>0&&(n.Hg[L]+=R*d[L]+B*d[L]/Y),B!==0&&F[L]>0&&($[L]+=B/Y)}for(let L=0;L<i.count;L+=1){const R=9*L,B=r.bi[L],Y=r.bj[L];let K=0;for(let dt=0;dt<9;dt+=1){const Ct=r.wt[R+dt];if(Ct===0)continue;const Et=B+dt%3,Dt=Y+(dt/3|0);if(Et<0||Dt<0||Et>=c||Dt>=l)continue;const gt=Et+Dt*c;m[gt]>0&&(K+=Ct*$[gt])}if(K===0)continue;const ht=i.mass[L],bt=ht/i.rho[L];i.h[L]+=i.cp(L)*K,i.derive(L),r.dVp[L]+=ht/i.rho[L]-bt}for(let L=0;L<f;L+=1)d[L]>0&&a.deriveCell(L);_.fill(0);const wt=this.last;return wt.heater=k*t,wt.lossWalls=nt,wt.lossOpen=pt,wt}pair(t,e,s){t===ft&&e===it?this.fluxSL-=s:t===it&&e===ft?this.fluxSL+=s:t===it&&e===G?this.fluxLG-=s:t===G&&e===it?this.fluxLG+=s:t===ft&&e===G?this.fluxSG-=s:t===G&&e===ft&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function D0(o,t,e,s,n,i,r){const{nx:a,ny:c}=o,l=a+1,f=o.ul,u=o.vl;for(let h=0;h<o.nu;h+=1)s[h]=t[h]!==0?1:0;for(let h=0;h<o.nv;h+=1)n[h]=e[h]!==0?1:0;for(let h=0;h<2;h+=1){i.set(f),r.set(u);for(let m=0;m<c;m+=1)for(let p=0;p<=a;p+=1){const d=p+m*l;if(s[d]!==0)continue;let g=0,v=0;p>0&&s[d-1]===1&&(g+=f[d-1],v+=1),p<a&&s[d+1]===1&&(g+=f[d+1],v+=1),m>0&&s[d-l]===1&&(g+=f[d-l],v+=1),m<c-1&&s[d+l]===1&&(g+=f[d+l],v+=1),v>0&&(i[d]=g/v,s[d]=3)}for(let m=0;m<=c;m+=1)for(let p=0;p<a;p+=1){const d=p+m*a;if(n[d]!==0)continue;let g=0,v=0;p>0&&n[d-1]===1&&(g+=u[d-1],v+=1),p<a-1&&n[d+1]===1&&(g+=u[d+1],v+=1),m>0&&n[d-a]===1&&(g+=u[d-a],v+=1),m<c&&n[d+a]===1&&(g+=u[d+a],v+=1),v>0&&(r[d]=g/v,n[d]=3)}f.set(i),u.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let h=0;h<o.nu;h+=1)s[h]===0&&(f[h]=0);for(let h=0;h<o.nv;h+=1)n[h]===0&&(u[h]=0)}function V0(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<o.count;a+=1){const c=Math.min(s-1,Math.max(0,Math.floor(o.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[a]/t.dx)));if(i[c+l*s]===it){e[a]=0;continue}let f=!1;for(let u=Math.max(0,l-2);u<=Math.min(n-1,l+2)&&!f;u+=1)for(let h=Math.max(0,c-2);h<=Math.min(s-1,c+2);h+=1)if(i[h+u*s]===it){f=!0;break}e[a]=f?0:1,f||(r=!0)}return r}function rc(o,t,e,s){const{nx:n,ny:i,dx:r}=o,a=n+1,c=1/r;let l=Math.min(n-1e-6,Math.max(0,t*c)),f=Math.min(i-1.000001,Math.max(0,e*c-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h;const d=o.ul;s[0]=(1-p)*((1-m)*d[u+h*a]+m*d[u+1+h*a])+p*((1-m)*d[u+(h+1)*a]+m*d[u+1+(h+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*c-.5)),f=Math.min(i-1e-6,Math.max(0,e*c)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h;const g=o.vl;s[1]=(1-p)*((1-m)*g[u+h*n]+m*g[u+1+h*n])+p*((1-m)*g[u+(h+1)*n]+m*g[u+1+(h+1)*n])}function N0(o,t,e,s,n,i,r,a,c,l,f){const{nx:u,ny:h,dx:m}=o;for(let v=0;v<o.nu;v+=1)e[v]=n[v]>l?e[v]/n[v]:0;for(let v=0;v<o.nv;v+=1)s[v]=i[v]>l?s[v]/i[v]:0;const p=c*m*m/f,d=(v,w)=>v+w>0?2*v*w/(v+w):0;let g=0;{const v=u+1,w=t.begin(v,h),x=o.ul;for(let F=0;F<h;F+=1)for(let T=0;T<=u;T+=1){const A=T+F*v;if(r[A]!==1)continue;const b=t.at(T,F),P=e[A];if(w.act[b]=1,w.dH[b]=p,w.x[b]=x[A],w.b[b]=p*x[A],T+1<=u){const M=r[A+1];M===1?w.ax[b]=d(P,e[A+1]):M===2&&(w.dDx[b]+=P)}if(T>0&&r[A-1]===2&&(w.dDx[b]+=P),F+1<h){const M=r[A+v];M===1?w.ay[b]=d(P,e[A+v]):M===2&&(w.dDy[b]+=2*P)}else o.openT||(w.dDy[b]+=2*P);F>0?r[A-v]===2&&(w.dDy[b]+=2*P):o.openB||(w.dDy[b]+=2*P)}const _=t.solve(1e-6,200,!1);g+=_.iterations;for(let F=0;F<h;F+=1)for(let T=0;T<=u;T+=1){const A=T+F*v;r[A]===1&&(x[A]=w.x[t.at(T,F)])}}{const v=t.begin(u,h+1),w=o.vl;for(let _=0;_<=h;_+=1)for(let F=0;F<u;F+=1){const T=F+_*u;if(a[T]!==1)continue;const A=t.at(F,_),b=s[T];if(v.act[A]=1,v.dH[A]=p,v.x[A]=w[T],v.b[A]=p*w[T],_+1<=h){const P=a[T+u];P===1?v.ay[A]=d(b,s[T+u]):P===2&&(v.dDy[A]+=b)}if(_>0&&a[T-u]===2&&(v.dDy[A]+=b),F+1<u){const P=a[T+1];P===1?v.ax[A]=d(b,s[T+1]):P===2&&(v.dDx[A]+=2*b)}else o.openR||(v.dDx[A]+=2*b);F>0?a[T-1]===2&&(v.dDx[A]+=2*b):o.openL||(v.dDx[A]+=2*b)}const x=t.solve(1e-6,200,!1);g+=x.iterations;for(let _=0;_<=h;_+=1)for(let F=0;F<u;F+=1){const T=F+_*u;a[T]===1&&(w[T]=v.x[t.at(F,_)])}}return g}class U0{constructor(){y(this,"cellMat",null);y(this,"cellHost",null);y(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:c}=e,l=Jt.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(c*l),this.cellHost=new Uint8Array(c));const f=this.cellMat,u=this.cellHost;f.fill(0);let h=!1;for(let d=0;d<t.count;d+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),v=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx)));f[(g+v*r)*l+t.mat[d]]+=t.mass[d],t.smass[2*d]>0&&(h=!0)}if(h){this.cellVolW===null&&(this.cellVolW=new Float64Array(c));const d=this.cellVolW;d.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==lt)continue;const v=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),w=Math.min(a-1,Math.max(0,Math.floor(t.y[g]/e.dx)));d[v+w*r]+=t.mass[g]/t.rho[g]}}for(let d=0;d<c;d+=1){let g=0;for(let v=1;v<l;v+=1)f[d*l+v]>f[d*l+g]&&(g=v);u[d]=g}let m=!1;const p=.25*e.dx;for(let d=0;d<t.count;d+=1){i[d]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),v=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx))),w=u[g+v*r],x=t.mat[d];if(x===w)continue;const _=t.T[d],F=this.cellVolW,T=g+v*r,A=h&&w===lt&&F!==null&&F[T]>0?f[T*l]/F[T]:ps(w,_),b=t.rho[d],P=bn(w,_),M=bn(x,_),k=t.mass[d]/b,S=Math.cbrt(6*k/Math.PI),O=Math.abs(A-b);if(O<=0||n<=0)continue;const C=(2*P+3*M)/(3*P+3*M);let I=O*n*S*S/(18*P*C);for(let D=0;D<8;D+=1){const E=Math.max(1e-9,A*I*S/P),V=24/E*C*(1+.15*Math.pow(E,.687));I=Math.sqrt(4*O*n*S/(3*A*V))}const j=b<A?1:-1;i[d]=j*Math.min(p,I*s),m=!0}return m}}function H0(o,t,e,s,n,i,r,a,c,l,f){const u=t.w,h=t.h,m=t.dx;let p=0,d=0,g=0,v=0;const w=s;for(let x=0;x<o.count;x+=1){const _=o.x[x],F=o.y[x],T=w[x]!==0;let A,b;if(T)A=_+e*o.vx[x],b=F+e*o.vy[x];else{i(_,F,c);const k=_+.5*e*c[0],S=F+.5*e*c[1];i(k,S,c),A=_+e*c[0],b=F+e*c[1]+(n!==null?n[x]:0)}if(A<0&&t.openL||A>u&&t.openR||b<0&&t.openB||b>h&&t.openT){const k=o.smass[2*x];o.mat[x]===lt?p+=o.mass[x]-k:d+=o.mass[x]-k,g+=k,v+=o.mass[x]*o.h[x],n!==null&&(n[x]=n[o.count-1]),w[x]=w[o.count-1],r(x),x-=1;continue}const P=1e-4*m;T&&(A<P||A>u-P)&&(o.vx[x]=0),T&&(b<P||b>h-P)&&(o.vy[x]=0),A=Math.min(u-P,Math.max(P,A)),b=Math.min(h-P,Math.max(P,b));const M=a!==null?a(_,F,A,b,l):0;if(M===1){A=l[0],b=l[1];const k=l[2],S=l[3];if(T)o.vx[x]=l[4],o.vy[x]=l[5];else{const O=(o.vx[x]-l[4])*k+(o.vy[x]-l[5])*S;O<0&&(o.vx[x]-=O*k,o.vy[x]-=O*S)}}else if(M===0){let k=t.sdfAt(A,b);if(k<.05*m)for(let S=0;S<3&&k<.05*m;S+=1){const O=.25*m;let C=t.sdfAt(A+O,b)-t.sdfAt(A-O,b),I=t.sdfAt(A,b+O)-t.sdfAt(A,b-O);const j=Math.hypot(C,I);if(j<1e-12)break;C/=j,I/=j;const D=.05*m-k;A+=D*C,b+=D*I;const E=o.vx[x]*C+o.vy[x]*I;T?(o.vx[x]=0,o.vy[x]=0):E<0&&(o.vx[x]-=E*C,o.vy[x]-=E*I),A=Math.min(u-P,Math.max(P,A)),b=Math.min(h-P,Math.max(P,b)),k=t.sdfAt(A,b)}}o.x[x]=A,o.y[x]=b}f.m=p,f.o=d,f.s=g,f.e=v}const G0=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),oc=24,$0=1,W0=1,cc=24,ac=1,ue=(o,t)=>(o+2)*(t+2);function lc(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function K0(o,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){o[a]+=n*e[a];const c=t[a]-n*s[a];t[a]=c,r+=c*c}return r}function z0(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class At{constructor(t,e){y(this,"levels",[]);y(this,"depth",1);y(this,"xs");y(this,"bs");y(this,"p");y(this,"q");y(this,"zj");y(this,"rj");y(this,"nullId");y(this,"stack");y(this,"nullSum",new Float64Array(16));y(this,"nullCnt",new Float64Array(16));y(this,"nullCount",0);y(this,"system");y(this,"result",{iterations:0,residual:0,capped:!1});y(this,"pw",new Float64Array(4));y(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(G0(ue(s,n),i)),!(s*n<=oc||s<=2&&n<=2);)i=ue(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=ue(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],c=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:c,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=ue(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,diag:f,inv:u,act:h}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let d=1;d<=e;d+=1,p+=1){if(h[p]===0){f[p]=1,u[p]=1;continue}const g=a[p]+c[p]+l[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){h[p]=0,f[p]=1,u[p]=1;continue}f[p]=g,u[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:c,diag:l}=t;for(let f=1;f<=i;f+=1){let u=1+f*r;for(let h=1;h<=n;h+=1,u+=1)s[u]=l[u]*e[u]-a[u]*e[u+1]-a[u-1]*e[u-1]-c[u]*e[u+r]-c[u-r]*e[u-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:c,x:l,b:f}=t;for(let u=1;u<=n;u+=1){let h=1+(1+u+e&1)+u*i;const m=s+u*i;for(;h<=m;h+=2)l[h]=(f[h]+r[h]*l[h+1]+r[h-1]*l[h-1]+a[h]*l[h+i]+a[h-i]*l[h-i])*c[h]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:c}=t;let l=0;for(let f=1;f<=s;f+=1){let u=1+f*n;for(let h=1;h<=e;h+=1,u+=1)i[u]!==0&&(i[u-1]===0||i[u+1]===0||i[u-n]===0||i[u+n]===0||r[u]>0||a[u]>0)&&(c[l++]=u)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:c,band:l,bandCount:f}=t;for(let u=e>0?0:f-1;e>0?u<f:u>=0;u+=e){const h=l[u];a[h]=(c[h]+n[h]*a[h+1]+n[h-1]*a[h-1]+i[h]*a[h+s]+i[h-s]*a[h-s])*r[h]}}prepareFine(){const t=this.levels[0],e=ue(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=oc||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=ue(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,c=e.h,l=s.h;for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;let m=0,p=0,d=0,g=0;for(let A=0;A<2;A+=1){const b=2*f+A;if(!(b>=e.ny))for(let P=0;P<2;P+=1){const M=2*u+P;if(M>=e.nx)continue;const k=M+1+(b+1)*a;if(e.act[k]===0)continue;const S=e.area[k];m+=S,p+=S*((P-.5)*c+e.ox[k]*c),d+=S*((A-.5)*c+e.oy[k]*c),g+=e.dH[k]}}if(m<=0){s.act[h]=0,s.dH[h]=0,s.dDx[h]=0,s.dDy[h]=0,s.gDx[h]=0,s.gDy[h]=0,s.ox[h]=0,s.oy[h]=0;continue}s.act[h]=1,s.area[h]=m/4;const v=p/m,w=d/m;s.ox[h]=v/l,s.oy[h]=w/l,s.dH[h]=g;let x=0,_=0,F=0,T=0;for(let A=0;A<2;A+=1){const b=2*f+A;if(!(b>=e.ny))for(let P=0;P<2;P+=1){const M=2*u+P;if(M>=e.nx)continue;const k=M+1+(b+1)*a;if(e.act[k]!==0){if(e.gDx[k]>0){const S=(P-.5)*c+e.ox[k]*c;x+=e.gDx[k],_+=e.gDx[k]/(e.eDx[k]+Math.abs(S-v))}if(e.gDy[k]>0){const S=(A-.5)*c+e.oy[k]*c;F+=e.gDy[k],T+=e.gDy[k]/(e.eDy[k]+Math.abs(S-w))}}}}s.gDx[h]=x,s.gDy[h]=F,s.dDx[h]=_,s.dDy[h]=T,s.eDx[h]=_>0?x/_:.5*l,s.eDy[h]=T>0?F/T:.5*l}for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;if(s.act[h]!==0){if(u+1<n&&s.act[h+1]!==0){const m=2*u+1;let p=0;if(m+1<e.nx)for(let d=0;d<2;d+=1){const g=2*f+d;g>=e.ny||(p+=e.gx[m+1+(g+1)*a])}if(p>0){const d=l*(1+s.ox[h+1]-s.ox[h]);s.gx[h]=p,s.ax[h]=p/Math.max(.25*l,d)}}if(f+1<i&&s.act[h+s.stride]!==0){const m=2*f+1;let p=0;if(m+1<e.ny)for(let d=0;d<2;d+=1){const g=2*u+d;g>=e.nx||(p+=e.gy[g+1+(m+1)*a])}if(p>0){const d=l*(1+s.oy[h+s.stride]-s.oy[h]);s.gy[h]=p,s.ay[h]=p/Math.max(.25*l,d)}}}}At.diagonal(s),At.findBand(s);for(let f=0;f<e.ny;f+=1){let u=1+(f+1)*a;for(let h=0;h<e.nx;h+=1,u+=1){if(e.act[u]===0){s.pW[4*u]=0,s.pW[4*u+1]=0,s.pW[4*u+2]=0,s.pW[4*u+3]=0,s.pIdx[4*u]=0,s.pIdx[4*u+1]=0,s.pIdx[4*u+2]=0,s.pIdx[4*u+3]=0;continue}At.weights(s,h,f,e.dDx[u]+e.dDy[u]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*u+m]=this.pi[m],s.pW[4*u+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,c=s>>1,l=(e&1)===1?1:-1,f=(s&1)===1?1:-1,u=t.stride,h=a+1+(c+1)*u;r[0]=h,r[1]=h+l,r[2]=h+f*u,r[3]=h+l+f*u;const m=a+l>=0&&a+l<t.nx,p=c+f>=0&&c+f<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[h]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<cc;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<cc;m+=1)At.color(e,1),At.color(e,0);return}for(let m=0;m<$0;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<ac;m+=1)At.bandSweep(e,1);At.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,ue(s.nx,s.ny)),s.x.fill(0,0,ue(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:c}=e,{pIdx:l,pW:f}=s,u=s.b,h=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=r[p]-a[p],v=4*p;u[l[v]]+=f[v]*g,u[l[v+1]]+=f[v+1]*g,u[l[v+2]]+=f[v+2]*g,u[l[v+3]]+=f[v+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=4*p;c[p]+=f[g]*h[l[g]]+f[g+1]*h[l[g+1]]+f[g+2]*h[l[g+2]]+f[g+3]*h[l[g+3]]}}for(let m=0;m<ac;m+=1)At.bandSweep(e,-1);for(let m=0;m<W0;m+=1)At.color(e,1),At.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,act:f}=t,u=this.nullId,h=ue(e,s);let m=!1;for(let p=0;p<h;p+=1)if(f[p]!==0&&!(a[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}u.fill(-2,0,h),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let d=1;d<=e;d+=1){const g=d+p*n;if(f[g]===0||u[g]!==-2)continue;let v=0,w=0,x=!1;const _=-3-this.nullCount;this.stack[v++]=g,u[g]=_;let F=g,T=g;for(;v>0;){const b=this.stack[--v];w+=1,b<F&&(F=b),b>T&&(T=b),(a[b]>0||c[b]>0||l[b]>0)&&(x=!0),i[b]>0&&u[b+1]===-2&&(u[b+1]=_,this.stack[v++]=b+1),i[b-1]>0&&u[b-1]===-2&&(u[b-1]=_,this.stack[v++]=b-1),r[b]>0&&u[b+n]===-2&&(u[b+n]=_,this.stack[v++]=b+n),r[b-n]>0&&u[b-n]===-2&&(u[b-n]=_,this.stack[v++]=b-n)}let A=-1;if(!x){if(A=this.nullCount,A>=this.nullSum.length){const b=P=>{const M=new Float64Array(2*P.length);return M.set(P),M};this.nullSum=b(this.nullSum),this.nullCnt=b(this.nullCnt)}this.nullCnt[A]=w,this.nullCount+=1}for(let b=F;b<=T;b+=1)u[b]===_&&(u[b]=A)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=ue(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=ue(i.nx,i.ny),{act:a}=i,c=this.xs,l=this.bs,f=i.stride;for(let F=0;F<r;F+=1){if(a[F]===0){c[F]=0,l[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||a[F+1]===0)&&(i.ax[F]=0),(F+f>=r||a[F+f]===0)&&(i.ay[F]=0)}At.diagonal(i);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0,l[F]=0);this.findNull(),this.project(l),s&&(At.findBand(i),this.prepareFine(),this.coarsen());const u=s?i.b:this.rj,h=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),h.fill(0,0,r),At.apply(i,c,p);let d=0,g=0;for(let F=0;F<r;F+=1){const T=a[F]===0?0:l[F]-p[F];u[F]=T,d+=l[F]*l[F],g+=T*T}this.project(u);const v=Math.sqrt(d);if(v===0)return c.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(g)/v;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,u,h,r);let x=0;for(let F=0;F<r;F+=1)m[F]=h[F],x+=u[F]*h[F];let _=0;for(;_<e;){_+=1,At.apply(i,m,p);const F=lc(m,p,r);if(!(F>0))break;const T=x/F;if(g=K0(c,u,m,p,T,r),w=Math.sqrt(g)/v,w<=t)break;this.precondition(s,u,h,r);const A=lc(u,h,r),b=A/x;x=A,z0(m,h,b,r)}this.project(c);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0);return n.iterations=_,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Q0=.1,fc=5e-4,uc=1e-9,Dr=.1;function Yn(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function ce(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class X0{constructor(t,e,s){y(this,"g");y(this,"P");y(this,"solver");y(this,"mu");y(this,"pu");y(this,"mv");y(this,"pv");y(this,"rv");y(this,"knownU");y(this,"knownV");y(this,"tmpU");y(this,"tmpV");y(this,"markU");y(this,"markV");y(this,"bi");y(this,"bj");y(this,"wr");y(this,"wt");y(this,"dVp");y(this,"volSrc");y(this,"fU");y(this,"fV");y(this,"pGas");y(this,"w",new Float64Array(12));y(this,"rhoRef",998);y(this,"weightsDirty",!0);y(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});y(this,"escM",0);y(this,"escO",0);y(this,"escS",0);y(this,"escE",0);y(this,"viscous",!1);y(this,"etaU",null);y(this,"etaV",null);y(this,"vsolver",null);y(this,"mf",0);y(this,"ms",1);y(this,"stranded",new Uint8Array(0));y(this,"vel",new Float64Array(2));y(this,"drifts",new U0);y(this,"dropletDrift",null);y(this,"bodyHit",null);y(this,"afterSolve",null);y(this,"hit",new Float64Array(6));y(this,"escaped",{m:0,o:0,s:0,e:0});y(this,"velocityAtFn",(t,e,s)=>{rc(this.g,t,e,s)});y(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;e.updateThin();for(let c=0;c<t.count;c+=1){n[c]=ce(t.x[c]*a-.5,s,0),i[c]=ce(t.y[c]*a-.5,s,3);const l=9*c;for(let f=0;f<3;f+=1)for(let u=0;u<3;u+=1)r[l+u+3*f]=s[u]*s[3+f];e.thinAny&&e.cutWeights(n[c]+1,i[c]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:c,kind:l}=e;for(let f=0;f<t.count;f+=1){const u=9*f,h=s[f],m=n[f];let p=0;for(let d=0;d<9;d+=1){const g=h+d%3,v=m+(d/3|0),x=g>=0&&v>=0&&g<a&&v<c&&l[g+v*a]===it?i[u+d]:0;r[u+d]=x,p+=x}if(p>0){const d=1/p;for(let g=0;g<9;g+=1)r[u+g]*=d}else{for(let d=0;d<9;d+=1)r[u+d]=0;r[u+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:c}=this,{nx:l,ny:f,kind:u}=s,h=1/s.dx;i[t]=ce(e.x[t]*h-.5,n,0),r[t]=ce(e.y[t]*h-.5,n,3);const m=9*t;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1)a[m+g+3*d]=n[g]*n[3+d];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,a,m);let p=0;for(let d=0;d<9;d+=1){const g=i[t]+d%3,v=r[t]+(d/3|0),w=g>=0&&v>=0&&g<l&&v<f&&u[g+v*l]===it;c[m+d]=w?a[m+d]:0,w&&(p+=a[m+d])}if(p>0)for(let d=0;d<9;d+=1)c[m+d]/=p;else{for(let d=0;d<9;d+=1)c[m+d]=0;c[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:c}=e;c.fill(0);const l=1/e.vCell;let f=0,u=0;for(let h=0;h<t.count;h+=1){const m=t.mass[h]/t.rho[h];f+=t.mass[h],u+=m;const p=9*h,d=s[h],g=n[h];for(let v=0;v<9;v+=1){const w=d+v%3,x=g+(v/3|0);w<0||x<0||w>=r||x>=a||(c[w+x*r]+=i[p+v]*m*l)}}u>0&&(this.rhoRef=f/u)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ft;continue}const a=e.phi[r];let c=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!c&&t!==null&&t[r]!==G&&t[r]!==ft){const l=r%s,f=(r-l)/s;(l>0?t[r-1]===G&&e.faceOpen(r,0)>0:e.openL)||(l<s-1?t[r+1]===G&&e.faceOpen(r,1)>0:e.openR)||(f>0?t[r-s]===G&&e.faceOpen(r,2)>0:e.openB)||(f<n-1?t[r+s]===G&&e.faceOpen(r,3)>0:e.openT)||(c=!0)}e.kind[r]=c?it:G,c&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:c}=this,{nx:l,ny:f,dx:u}=e,h=1/u,m=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),c.fill(0);const p=1/this.rhoRef,d=this.viscous;d&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,v=this.etaV;d&&(g.fill(0),v.fill(0));for(let w=0;w<t.count;w+=1){const x=t.x[w],_=t.y[w],F=t.mass[w],T=d?bn(t.mat[w],t.T[w]):0,A=t.vx[w],b=t.vy[w],P=t.c00[w],M=t.c01[w],k=t.c10[w],S=t.c11[w],O=x*h,C=_*h;let I=ce(O,s,0),j=ce(C-.5,s,3);for(let E=0;E<3;E+=1){const V=j+E,z=(V+.5)*u-_;for(let N=0;N<3;N+=1){const Z=I+N,tt=s[N]*s[3+E]*F,q=tt*(A+P*(Z*u-x)+M*z);if(Z>=0&&Z<=l&&V>=0&&V<f){const $=Z+V*m;n[$]+=tt,i[$]+=q,d&&(g[$]+=tt*T)}else this.mirrorU(Z,V),n[this.mf]+=tt,i[this.mf]+=this.ms*q,d&&(g[this.mf]+=tt*T)}}I=ce(O-.5,s,0),j=ce(C,s,3);const D=t.rho[w]*p;for(let E=0;E<3;E+=1){const V=j+E,z=V*u-_;for(let N=0;N<3;N+=1){const Z=I+N,tt=s[N]*s[3+E]*F,q=tt*(b+k*((Z+.5)*u-x)+S*z);let $,U=1;Z>=0&&Z<l&&V>=0&&V<=f?$=Z+V*l:(this.mirrorV(Z,V),$=this.mf,U=this.ms),r[$]+=tt,a[$]+=U*q,c[$]+=tt*D,d&&(v[$]+=tt*T)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?s.openL?r=0:(r=-r,c=-c):r>n&&(s.openR?r=n:(r=2*n-r,c=-c)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=c}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,c=-c):a>i&&(s.openT?a=i:(a=2*i-a,c=-c)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=c}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:c,dx:l,kind:f}=i,u=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:h,pu:m,mv:p,pv:d,rv:g,knownU:v,knownV:w}=this,x=i.ul,_=i.vl,F=this.rhoRef*i.vCell*.25,T=uc*F,A=this.viscous;for(let D=0;D<i.nu;D+=1)x[D]=h[D]>T?m[D]/h[D]+(A?0:t*this.fU[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<i.nv;D+=1)_[D]=p[D]>T?d[D]/p[D]+(A?0:-t*e*(g[D]/p[D])+t*this.fV[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<c;D+=1)for(let E=0;E<=a;E+=1){const V=E+D*u,z=E>0?f[E-1+D*a]:-1,N=E<a?f[E+D*a]:-1,Z=E===0&&!i.openL,tt=E===a&&!i.openR;if(Z||tt||z===ft||N===ft||i.au[V]<=0){x[V]=Z||tt?0:i.usol[V],v[V]=2;continue}v[V]=z===it||N===it?1:0}for(let D=0;D<=c;D+=1)for(let E=0;E<a;E+=1){const V=E+D*a,z=D>0?f[E+(D-1)*a]:-1,N=D<c?f[E+D*a]:-1,Z=D===0&&!i.openB,tt=D===c&&!i.openT;if(Z||tt||z===ft||N===ft||i.av[V]<=0){_[V]=Z||tt?0:i.vsol[V],w[V]=2;continue}w[V]=z===it||N===it?1:0}if(this.last.viscIterations=0,A){this.viscosity(t);const D=t/(this.rhoRef*i.vCell);for(let E=0;E<i.nu;E+=1)v[E]!==2&&h[E]>T&&(x[E]+=D*this.fU[E]);for(let E=0;E<i.nv;E+=1)w[E]!==2&&p[E]>T&&(_[E]+=-t*e*(g[E]/p[E])+D*this.fV[E])}let b=a,P=-1,M=c,k=-1,S=0;for(let D=0;D<c;D+=1)for(let E=0;E<a;E+=1)f[E+D*a]===it&&(S+=1,E<b&&(b=E),E>P&&(P=E),D<M&&(M=D),D>k&&(k=D));const O=this.last.solve;if(O.iterations=0,O.residual=0,O.capped=!1,S>0){const D=P-b+1,E=k-M+1,V=this.solver,z=V.begin(D,E),N=t/this.rhoRef,Z=1/i.vCell,tt=this.pGas;for(let U=M;U<=k;U+=1)for(let H=b;H<=P;H+=1){const nt=H+U*a;if(f[nt]!==it)continue;const pt=V.at(H-b,U-M);z.act[pt]=1,z.x[pt]=i.pl[nt];const wt=H+U*u,L=H+U*a,R=v[wt+1]===2?0:i.au[wt+1],B=v[wt]===2?0:i.au[wt],Y=w[L+a]===2?0:i.av[L+a],K=w[L]===2?0:i.av[L],ht=Yn(x,i.usol,wt+1,R,v)-Yn(x,i.usol,wt,B,v)+Yn(_,i.vsol,L+a,Y,w)-Yn(_,i.vsol,L,K,w),bt=i.phi[nt]+i.phiS[nt]+i.alpha[nt];let dt=this.volSrc[nt]*Z;const Ct=this.gasAt(H-1,U)||this.gasAt(H+1,U)||this.gasAt(H,U-1)||this.gasAt(H,U+1),Et=bt-1;(Et>0||!Ct)&&(dt+=Q0*Et/Math.max(t,fc));let Dt=dt*l*l-l*ht;if(H+1<a){const gt=f[nt+1];if(gt===it)H+1<=P&&R>0&&(z.ax[pt]=R<1?N*R:N);else if(gt===G&&R>0){const Lt=(R<1?N*R:N)/this.theta(nt,nt+1);z.dDx[pt]+=Lt,Dt+=Lt*tt[nt+1]}}else i.openR&&R>0&&(z.dDx[pt]+=R<1?2*N*R:2*N);if(H>0){if(f[nt-1]===G&&B>0){const Lt=(B<1?N*B:N)/this.theta(nt,nt-1);z.dDx[pt]+=Lt,Dt+=Lt*tt[nt-1]}}else i.openL&&B>0&&(z.dDx[pt]+=B<1?2*N*B:2*N);if(U+1<c){const gt=f[nt+a];if(gt===it)U+1<=k&&Y>0&&(z.ay[pt]=Y<1?N*Y:N);else if(gt===G&&Y>0){const Lt=(Y<1?N*Y:N)/this.theta(nt,nt+a);z.dDy[pt]+=Lt,Dt+=Lt*tt[nt+a]}}else i.openT&&Y>0&&(z.dDy[pt]+=Y<1?2*N*Y:2*N);if(U>0){if(f[nt-a]===G&&K>0){const Lt=(K<1?N*K:N)/this.theta(nt,nt-a);z.dDy[pt]+=Lt,Dt+=Lt*tt[nt-a]}}else i.openB&&K>0&&(z.dDy[pt]+=K<1?2*N*K:2*N);z.b[pt]=Dt}const q=V.solve(s,n,!0);O.iterations=q.iterations,O.residual=q.residual,O.capped=q.capped;const $=i.pl;for(let U=0;U<i.n;U+=1)$[U]=f[U]===G?tt[U]:0;for(let U=M;U<=k;U+=1)for(let H=b;H<=P;H+=1){const nt=H+U*a;f[nt]===it&&($[nt]=z.x[V.at(H-b,U-M)])}for(let U=0;U<c;U+=1)for(let H=0;H<=a;H+=1){const nt=H+U*u;if(v[nt]===1){if(H===0){x[nt]-=N/l*2*($[U*a]-0);continue}if(H===a){x[nt]-=N/l*2*(0-$[a-1+U*a]);continue}x[nt]-=N/l*this.across(H-1+U*a,H+U*a)}}for(let U=0;U<=c;U+=1)for(let H=0;H<a;H+=1){const nt=H+U*a;if(w[nt]===1){if(U===0){_[nt]-=N/l*2*($[H]-0);continue}if(U===c){_[nt]-=N/l*2*(0-$[H+(c-1)*a]);continue}_[nt]-=N/l*this.across(H+(U-1)*a,H+U*a)}}this.afterSolve!==null&&this.afterSolve(V,b,M,t)}this.extrapolate();const C=this.markStranded(),I=this.g2p(C?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const j=this.last;return j.cells=S,j.uMax=I,j.escapedMass=this.escM,j.escapedOther=this.escO,j.escapedSalt=this.escS,j.escapedEnergy=this.escE,j}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e];return!(n>.5)||!(n>i)?Dr:Math.max(Dr,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===G&&n[e]===it?i/this.theta(e,t):n[e]===G&&n[t]===it?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new At(e.nx+1,e.ny+1));const s=uc*this.rhoRef*e.vCell*.25;this.last.viscIterations=N0(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===G}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:c}=this,{nx:l,ny:f}=s,u=1/Math.max(t,fc);for(let h=0;h<e.count;h+=1){const m=a[h];if(m===0)continue;const p=9*h,d=n[h],g=i[h];for(let v=0;v<9;v+=1){const w=d+v%3,x=g+(v/3|0);w<0||x<0||w>=l||x>=f||(c[w+x*l]+=r[p+v]*m*u)}}}extrapolate(){D0(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:c,dx:l}=n,f=1/l,u=a+1,h=n.ul,m=n.vl,p=4/(l*l);let d=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const C=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];C>d&&(d=C);continue}const v=s.x[g],w=s.y[g],x=v*f,_=w*f;let F=ce(x,i,0),T=ce(_-.5,i,3),A=0,b=0,P=0;for(let C=0;C<3;C+=1){const I=T+C,j=(I+.5)*l-w;for(let D=0;D<3;D+=1){const E=F+D,V=i[D]*i[3+C];let z;E>=0&&E<=a&&I>=0&&I<c?z=h[E+I*u]:(this.mirrorU(E,I),z=this.ms*h[this.mf]),A+=V*z,b+=V*z*(E*l-v),P+=V*z*j}}F=ce(x-.5,i,0),T=ce(_,i,3);let M=0,k=0,S=0;for(let C=0;C<3;C+=1){const I=T+C,j=I*l-w;for(let D=0;D<3;D+=1){const E=F+D,V=i[D]*i[3+C];let z;E>=0&&E<a&&I>=0&&I<=c?z=m[E+I*a]:(this.mirrorV(E,I),z=this.ms*m[this.mf]),M+=V*z,k+=V*z*((E+.5)*l-v),S+=V*z*j}}s.vx[g]=A,s.vy[g]=M,s.c00[g]=p*b,s.c01[g]=p*P,s.c10[g]=p*k,s.c11[g]=p*S;const O=A*A+M*M;O>d&&(d=O)}return Math.sqrt(d)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),V0(this.P,this.g,this.stranded)}velocityAt(t,e,s){rc(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;H0(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class Y0{constructor(t){y(this,"cap");y(this,"count",0);y(this,"nextId",1);y(this,"x");y(this,"y");y(this,"vx");y(this,"vy");y(this,"c00");y(this,"c01");y(this,"c10");y(this,"c11");y(this,"mass");y(this,"h");y(this,"T");y(this,"rho");y(this,"spc");y(this,"smass");y(this,"mat");y(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?Ni:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=Yl(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=oo(r,i);return}const s=this.mat[t],n=kl(s,this.h[t]);this.T[t]=n,this.rho[t]=ps(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==lt)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?Xl(this.T[t],e/this.mass[t]):no(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function Z0(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:c}=o,{nx:l,ny:f,n:u,kind:h}=s,{Tl:m}=t,p=t.rd;let d=!1;for(let x=0;x<u;x+=1){if(p[x]=0,h[x]===G&&t.Cl[x]>0){const P=t.boilingAt(x,r.pAt(x));m[x]>P&&(p[x]=P,d=!0);continue}if(h[x]!==it)continue;const _=x%l,F=(x-_)/l,T=F+1<f?x+l:-1;if(!(T>=0&&h[T]===G&&s.faceOpen(x,3)>0||_>0&&h[x-1]===G&&s.faceOpen(x,0)>0||_<l-1&&h[x+1]===G&&s.faceOpen(x,1)>0||F>0&&h[x-l]===G&&s.faceOpen(x,2)>0))continue;const b=t.boilingAt(x,r.pAt(x));m[x]>b&&(p[x]=b,d=!0)}if(!d)return;const g=t.mtot;g.fill(0);const v=t.Y0;v.fill(0);const w=i.rhoRef*s.vCell/4;for(let x=0;x<n.count;x+=1){if(n.mat[x]!==lt)continue;const _=n.smass[2*x],F=_>0?_/n.mass[x]:0,T=9*x;let A=0,b=0,P=-1,M=0;for(let O=0;O<2;O+=1){for(let C=0;C<9;C+=1){const I=i.wt[T+C];if(I===0)continue;const j=i.bi[x]+C%3,D=i.bj[x]+(C/3|0);if(j<0||D<0||j>=l||D>=f)continue;const E=j+D*l,V=p[E];if(V===0)continue;const z=_>0?Pa(V,F):Ft(V);if(n.h[x]<=z)continue;const N=xt(V),Z=I*n.mass[x]*(n.h[x]-z)/(N-(_>0?ci(V,F):z));O===0?(A+=Z,b+=Z*N,I>M&&(M=I,P=E)):(g[E]+=Z,v[E]+=Z*N)}if(A===0)break;if(O===0&&n.mass[x]-_-A<Vr*w){const C=p[P],I=n.mass[x]-_,j=xt(C),D=_>0?_*Hi(C):0;g[P]+=I,v[P]+=I*j,_>0&&o.salt.deposit(n.x[x],n.y[x],_,D),c.src[P]-=(I*j+D-n.mass[x]*n.h[x])/e,A=-1;break}}if(A===0)continue;if(A<0){i.removeParticle(x),x-=1;continue}const k=n.mass[x]/n.rho[x],S=n.mass[x]-A;n.h[x]=(n.mass[x]*n.h[x]-b)/S,n.mass[x]=S,n.derive(x),i.dVp[x]+=S/n.rho[x]-k}for(let x=0;x<u;x+=1){if(g[x]===0)continue;const _=x%l,F=(x-_)/l;let T=0;const A=h[x]===G?x:F+1<f&&h[x+l]===G&&s.faceOpen(x,3)>0?x+l:-1;if(A>=0)s.mg[X*u+A]+=g[x],s.Hg[A]+=v[x],a.deriveCell(A);else{const b=t.side;b[0]=_>0&&h[x-1]===G&&s.faceOpen(x,0)>0?x-1:-1,b[1]=_<l-1&&h[x+1]===G&&s.faceOpen(x,1)>0?x+1:-1,b[2]=F>0&&h[x-l]===G&&s.faceOpen(x,2)>0?x-l:-1,b[3]=-1;for(let P=0;P<3;P+=1)b[P]>=0&&(T+=1);for(let P=0;P<3;P+=1)b[P]<0||(s.mg[X*u+b[P]]+=g[x]/T,s.Hg[b[P]]+=v[x]/T,a.deriveCell(b[P]))}t.produced+=g[x]}}function J0(o,t,e,s,n){const i=o.grid,r=i.n,a=i.mg[ot*r+t],c=i.mg[ct*r+t],l=i.Hg[t];if(s<=0)return na(a,c,e,l);let f=n;for(let u=0;u<6;u+=1){const h=a*ie(ot,f)+c*ie(ct,f)+e*xt(f)+s*Ft(f),m=(l-h)/Lr(a,c,e,s,f);if(f+=m,Math.abs(m)<1e-10)break}return f}function an(o,t,e,s,n,i){const r=o.grid,a=r.n,c=r.mg[X*a+t]-e,l=r.mfog[t]+e,f=J0(o,t,c,l,i),u=c/mt[X];return(u+s>0?u/(u+s)*n:0)-Fn(f)}function cr(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[X*r+e],s));n.mg[X*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function tu(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==G)continue;const r=e.mg[X*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const c=e.mg[ot*n+i]/mt[ot]+e.mg[ct*n+i]/mt[ct],l=s.pAt(i),f=e.T[i];if(a<=0){const w=r/mt[X];if(w/(w+c)*l<.999*Fn(f))continue}const u=an(o,i,0,c,l,f);if(u<=0&&a<=0)continue;let h,m,p,d;if(u>0)h=0,p=u,m=r,d=an(o,i,m,c,l,f);else if(m=0,d=u,h=-a,p=an(o,i,h,c,l,f),p<=0){cr(o,t,i,h);continue}if(d>0){cr(o,t,i,m);continue}let g=h,v=0;for(let w=0;w<40;w+=1){g=(h*d-m*p)/(d-p),(!Number.isFinite(g)||g<=Math.min(h,m)||g>=Math.max(h,m))&&(g=.5*(h+m));const x=an(o,i,g,c,l,f);if(Math.abs(x)<=1e-13*l)break;x>0?(h=g,p=x,v===1&&(d/=2),v=1):(m=g,d=x,v===-1&&(p/=2),v=-1)}if(cr(o,t,i,g),u<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=an(o,i,0,c,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/Fn(e.T[i]))}}}const Vr=.001;class eu{constructor(t){y(this,"e");y(this,"produced",0);y(this,"condensed",0);y(this,"dew",0);y(this,"fogMade",0);y(this,"producedMark",0);y(this,"fogError",0);y(this,"fogWrong",0);y(this,"mtot");y(this,"rd");y(this,"Y0");y(this,"Tl");y(this,"Cl");y(this,"acc");y(this,"accH");y(this,"accAll");y(this,"host");y(this,"mixed",!1);y(this,"salty",!1);y(this,"accS");y(this,"mol");y(this,"aw");y(this,"accMat");y(this,"Fm");y(this,"Fe");y(this,"dm");y(this,"side",new Int32Array(4));y(this,"bG");y(this,"bY");y(this,"edge");y(this,"hvC");y(this,"hnC");y(this,"hoC");y(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*Jt.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*Fn(t)/e),c=i.mg[ot*r+s],l=i.mg[ct*r+s],f=c+l,u=f>0?f/(c/mt[ot]+l/mt[ct]):.02885;return a*mt[X]/(a*mt[X]+(1-a)*u)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:c,acc:l,accH:f,accAll:u,accS:h}=this;c.fill(0),a.fill(0),l.fill(0),f.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const v=e.mass[g],w=e.mat[g],x=v*e.cp(g),_=e.smass[2*g],F=v-_,T=_>0?ci(e.T[g],_/v):e.h[g];_>0&&!p&&(p=!0,h.fill(0)),w!==lt&&!m&&(m=!0,u.fill(0),this.accMat.fill(0));const A=9*g;for(let b=0;b<9;b+=1){const P=s.wt[A+b];if(P===0)continue;const M=s.bi[g]+b%3,k=s.bj[g]+(b/3|0);if(M<0||k<0||M>=n||k>=i)continue;const S=M+k*n;c[S]+=P*x,a[S]+=P*x*e.T[g],w===lt&&(l[S]+=P*F,f[S]+=P*F*T),p&&(h[S]+=P*_),m&&(this.accMat[w*r+S]+=P*v)}}for(let g=0;g<r;g+=1)a[g]=c[g]>0?a[g]/c[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const v=h[g]>0&&l[g]>0?h[g]/(l[g]*Qe):0;this.mol[g]=v,this.aw[g]=v>0?Fa(a[g],v):1}if(!m){u.set(l),this.host.fill(lt);return}const d=Jt.length;for(let g=0;g<r;g+=1){this.accMat[lt*r+g]=p?l[g]+h[g]:l[g];let v=0,w=lt,x=-1;for(let _=0;_<d;_+=1){const F=this.accMat[_*r+g];v+=F,F>x&&(x=F,w=_)}u[g]=v,this.host[g]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?_a(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:Ft(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?lt:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:c,dm:l}=this;l.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){if(n.mat[u]!==lt)continue;const h=9*u;let m=0;for(let p=0;p<9;p+=1){const d=i.wt[h+p];if(d===0)continue;const g=i.bi[u]+p%3,v=i.bj[u]+(p/3|0);if(g<0||v<0||g>=r||v>=a)continue;const w=g+v*r;t[w]!==0&&c[w]>0&&(m+=t[w]*d*(n.mass[u]-n.smass[2*u])/c[w])}l[u]=m}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const h=l[u];if(h===0)continue;if(n.smass[2*u]>0){this.applySalty(u,h,f,e);continue}const m=n.mass[u]/n.rho[u],p=n.mass[u]+h;if(p<Vr*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,p),e);continue}this.track(u,h),n.mass[u]=p,i.dVp[u]+=p/n.rho[u]-m}for(let u=0;u<s.n;u+=1){if(t[u]<=0||c[u]>0)continue;const h=u%r,m=(u-h)/r,p=n.add((h+.5)*s.dx,(m+.5)*s.dx,t[u],this.waterH(u),lt);p<0||(i.placeParticle(p),i.dVp[p]=t[u]/n.rho[p],this.track(p,t[u]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,c=9*t,l=no(n.mat[t],n.T[t]);for(let f=0;f<9;f+=1){const u=i.wt[c+f];if(u===0)continue;const h=i.bi[t]+f%3,m=i.bj[t]+(f/3|0);if(h<0||m<0||h>=r||m>=a)continue;const p=h+m*r;this.acc[p]+=u*e,this.accH[p]+=u*e*n.h[t],this.accAll[p]+=u*e,this.Cl[p]+=u*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],c=i.mass[t],l=c-a,f=ci(i.T[t],a/c),u=i.cp(t),h=c*i.h[t]+e*f,m=l+e;if(m<Vr*s){this.trackSalty(t,-l,-l*f,-c,-a,-c*u),this.dryUp(t,Math.max(0,m),h,n);return}const p=c/i.rho[t];i.mass[t]=c+e,i.h[t]=h/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const d=ci(i.T[t],a/i.mass[t]);this.trackSalty(t,e,m*d-l*f,e,0,i.mass[t]*i.cp(t)-c*u)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:c}=this.e,{nx:l,ny:f}=a,u=9*t;for(let h=0;h<9;h+=1){const m=c.wt[u+h];if(m===0)continue;const p=c.bi[t]+h%3,d=c.bj[t]+(h/3|0);if(p<0||d<0||p>=l||d>=f)continue;const g=p+d*l;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:c,gas:l}=this.e,f=r.T[t],u=r.smass[2*t],h=u*Hi(f);this.e.salt.deposit(r.x[t],r.y[t],u,h);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==G;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[X*i.n+p]+=e,i.Hg[p]+=e*xt(f),this.produced+=e,l.deriveCell(p)),c.src[m]-=(e*xt(f)+h-s)/n;else if(m>=0){for(let d=0;d<r.count;d+=1)if(d!==t&&r.mat[d]===r.mat[t]&&i.cellAt(r.x[d],r.y[d])===m){const g=r.mass[d]*r.h[d]+(s-h);r.mass[d]+=e,r.h[d]=g/r.mass[d],r.derive(d);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:c}=this.e,l=n.cellAt(i.x[t],i.y[t]);let f=l;for(;f>=0&&n.kind[f]!==G;)f=f+n.nx<n.n?f+n.nx:-1;if(e>0&&f>=0&&l>=0){const u=i.T[t];n.mg[X*n.n+f]+=e,n.Hg[f]+=e*xt(u),a.src[l]-=e*(xt(u)-i.h[t])/s,this.produced+=e,c.deriveCell(f)}else if(e>0&&l>=0){for(let u=0;u<i.count;u+=1)if(u!==t&&i.mat[u]===i.mat[t]&&n.cellAt(i.x[u],i.y[u])===l){const h=i.mass[u]*i.h[u]+e*i.h[t];i.mass[u]+=e,i.h[u]=h/i.mass[u],i.derive(u);break}}r.removeParticle(t)}step(t){this.diffuse(t),Z0(this.e,this,t),tu(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:c,ny:l,n:f,depth:u,kind:h}=s,{mtot:m,rd:p,Y0:d,Tl:g,Fm:v,Fe:w,edge:x,hvC:_,hnC:F,hoC:T}=this;let A=!1;for(let C=0;C<f;C+=1){if(h[C]!==G){m[C]=0;continue}const I=s.mg[C]+s.mg[f+C]+s.mg[X*f+C];m[C]=I,d[C]=I>0?s.mg[X*f+C]/I:0;const j=s.T[C];p[C]=n.rho[C]*_l(j,i.pAt(C)),_[C]=xt(j),F[C]=ie(ot,j),T[C]=ie(ct,j),A=!0}if(!A)return;for(let C=0;C<l;C+=1)for(let I=0;I<c;I+=1){const j=I+C*c;x[j]=h[j]===G&&(I===0||C===0||I===c-1||C===l-1||h[j-1]!==G||h[j+1]!==G||h[j-c]!==G||h[j+c]!==G)?1:0}const b=a.begin(c,l),P=b.stride,M=e.ambientY[X],{bG:k,bY:S}=this;for(let C=0;C<l;C+=1)for(let I=0;I<c;I+=1){const j=I+C*c;if(h[j]!==G||m[j]<=0)continue;const D=I+1+(C+1)*P;b.act[D]=1,b.x[D]=d[j],b.dH[D]=m[j]/t;let E=m[j]*d[j]/t;const V=s.au[I+1+C*(c+1)],z=s.av[j+c];if(I+1<c&&h[j+1]===G&&m[j+1]>0&&V>0&&(b.ax[D]=V*.5*(p[j]+p[j+1])*u),C+1<l&&h[j+c]===G&&m[j+c]>0&&z>0&&(b.ay[D]=z*.5*(p[j]+p[j+c])*u),x[j]===0){b.b[D]=E;continue}let N=0;for(let Z=0;Z<4;Z+=1){const tt=this.boundary(j,I,C,Z,M);k[4*j+Z]=tt,S[4*j+Z]=this.yb,!(tt<=0)&&(N+=tt,E+=tt*this.yb)}b.dDx[D]=N,b.b[D]=E}a.solve(1e-9,200,!1),v.fill(0),w.fill(0);const O=b.x;for(let C=0;C<l;C+=1)for(let I=0;I<c;I+=1){const j=I+C*c;if(h[j]!==G||m[j]<=0)continue;const D=I+1+(C+1)*P,E=O[D],V=s.au[I+1+C*(c+1)],z=s.av[j+c];if(I+1<c&&h[j+1]===G&&m[j+1]>0&&V>0&&this.exchange(j,j+1,t*V*.5*(p[j]+p[j+1])*u*(E-O[D+1])),C+1<l&&h[j+c]===G&&m[j+c]>0&&z>0&&this.exchange(j,j+c,t*z*.5*(p[j]+p[j+c])*u*(E-O[D+P])),x[j]!==0)for(let N=0;N<4;N+=1){const Z=k[4*j+N];if(Z<=0)continue;const tt=t*Z*(S[4*j+N]-E),$=(N===0?I===0:N===1?I===c-1:N===2?C===0:C===l-1)?-1:N===0?j-1:N===1?j+1:N===2?j-c:j+c;if($<0)this.ambientExchange(j,tt);else if(h[$]===it)if(tt>0){const U=g[$];s.mg[X*f+j]+=tt,s.Hg[j]+=tt*xt(U),v[$]-=tt,w[$]-=tt*xt(U),this.produced+=tt}else{const U=Math.min(-tt,s.mg[X*f+j]);s.mg[X*f+j]-=U,s.Hg[j]-=U*xt(s.T[j]),v[$]+=U,w[$]+=U*xt(s.T[j]),this.condensed+=U}else if(h[$]===ft){const U=s.T[$];if(tt<0){const H=Math.min(-tt,s.mg[X*f+j]);s.mg[X*f+j]-=H,s.Hg[j]-=H*xt(s.T[j]),s.film[$]+=H,s.Es[$]+=H*Ft(U),r.src[$]+=H*(xt(s.T[j])-Ft(U))/t,this.dew+=H}else{const H=Math.min(tt,s.film[$]);s.film[$]-=H,s.Es[$]-=H*Ft(U),s.mg[X*f+j]+=H,s.Hg[j]+=H*xt(U),r.src[$]-=H*(xt(U)-Ft(U))/t,this.dew-=H}}}}for(let C=0;C<f;C+=1)v[C]!==0&&(r.src[C]+=(w[C]-v[C]*this.waterH(C))/t);this.applyMass(v,t);for(let C=0;C<f;C+=1)h[C]===G&&m[C]>0&&n.deriveCell(C)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:c,depth:l,kind:f}=r,u=n===0?e===0:n===1?e===a-1:n===2?s===0:s===c-1,h=2*this.rd[t]*l;if(u)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,h):0;const m=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=m;const p=f[m],d=this.Y0[t],g=this.e.regions.pAt(t);if(p===it){const v=r.faceOpen(t,n);if(!(v>0))return 0;const w=this.waterShare(m);return w<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),v*h*(1-d)*w)}if(p===ft){const v=this.ysat(r.T[m],g,t);return d>v||r.film[m]>0&&d<v?(this.yb=v,h*(1-d)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let c=Math.abs(s);c=Math.min(c,n.mg[X*i+r]);const l=n.mg[ot*i+a],f=n.mg[ct*i+a],u=l+f,h=Math.min(c,u);if(c<=0)return;const m=this.hvC[r];if(n.mg[X*i+r]-=c,n.mg[X*i+a]+=c,n.Hg[r]-=c*m,n.Hg[a]+=c*m,h>0){const p=h*l/u,d=h-p;n.mg[ot*i+a]-=p,n.mg[ct*i+a]-=d,n.mg[ot*i+r]+=p,n.mg[ct*i+r]+=d;const g=p*this.hnC[a]+d*this.hoC[a];n.Hg[a]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[ot*i+t]+n.mg[ct*i+t],c=Math.min(e,a);if(n.mg[X*i+t]+=e,n.Hg[t]+=e*xt(r),c>0){const l=c*n.mg[ot*i+t]/a,f=c-l;n.mg[ot*i+t]-=l,n.mg[ct*i+t]-=f;const u=l*ie(ot,n.T[t])+f*ie(ct,n.T[t]);n.Hg[t]-=u,s.flows.escapedAir+=c,s.flows.escapedEnergy+=u}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*xt(r)}else if(e<0){const a=Math.min(-e,n.mg[X*i+t]),c=s.ambientY[ot],l=s.ambientY[ct],f=c+l>0?c+l:1;n.mg[X*i+t]-=a,n.Hg[t]-=a*xt(n.T[t]);const u=a*c/f,h=a-u;n.mg[ot*i+t]+=u,n.mg[ct*i+t]+=h;const m=u*ie(ot,r)+h*ie(ct,r);n.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*xt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,c=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<c)continue;const f=l%n,u=(l-f)/n,m=[f>0?l-1:-1,f<n-1?l+1:-1,u+1<i?l+n:-1,u>0?l-n:-1].find(_=>_>=0&&a[_]===G);if(m===void 0)continue;const p=m%n,d=(m-p)/n,g=(p+.5+.25*Math.sign(f-p))*t.dx,v=(d+.5+.25*Math.sign(u-d))*t.dx,w=t.T[l],x=e.add(g,v,c,Ft(w),lt);x<0||(t.film[l]-=c,t.Es[l]-=c*Ft(w),s.placeParticle(x),s.dVp[x]=c/e.rho[x])}}}function Va(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(Jt.length);let r=0,a=0,c=0;for(let l=0;l<e.count;l+=1)for(let f=0;f<9;f+=1){const u=s.wt[9*l+f];if(u===0)continue;const h=s.bi[l]+f%3,m=s.bj[l]+(f/3|0);if(h<0||m<0||h>=n.nx||m>=n.ny||h+m*n.nx!==t)continue;i[e.mat[l]]+=u*e.mass[l],r+=u*e.mass[l];const p=e.smass[2*l];p>0?(a+=u*p,c+=u*(e.mass[l]-p)):e.mat[l]===0&&(c+=u*e.mass[l])}return{m:i,all:r,salt:a,water:c}}function su(o,t){const{m:e,all:s}=Va(o,t);if(s<=0)return[];const n=[];for(let i=0;i<Jt.length;i+=1)e[i]>0&&n.push({id:Jt[i].id,share:e[i]/s});return n}function nu(o,t,e){var M;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ft?"solid":s.kind[n]===it?"liquid":"gas",a=o.pressureAt(n);let c=0;const l=[0,0,0];for(let k=0;k<yt;k+=1)l[k]=s.mg[k*i+n]/mt[k],c+=l[k];for(let k=0;k<yt;k+=1)l[k]=c>0?l[k]/c:0;const f=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],u=r==="gas"?l[X]*a:0,h=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[h+m*(s.nx+1)]+s.ul[h+1+m*(s.nx+1)]):.5*(s.ug[h+m*(s.nx+1)]+s.ug[h+1+m*(s.nx+1)]),d=r==="liquid"?.5*(s.vl[h+m*s.nx]+s.vl[h+(m+1)*s.nx]):.5*(s.vg[h+m*s.nx]+s.vg[h+(m+1)*s.nx]),g=o.particles;let v=-1,w=(1.5*s.dx)**2;for(let k=0;k<g.count;k+=1){const S=(g.x[k]-t)**2+(g.y[k]-e)**2;S<w&&(w=S,v=k)}const x=o.bubbles;let _=-1,F=1/0;for(let k=0;k<x.count;k+=1){const S=Math.hypot(x.x[k]-t,x.y[k]-e);S<=Math.max(x.r[k],3*s.dx)&&S<F&&(_=k,F=S)}const T=Va(o,n),A=[];if(T.all>0)for(let k=0;k<Jt.length;k+=1)T.m[k]>0&&A.push({id:Jt[k].id,share:T.m[k]/T.all});let b=null;if(r==="liquid"&&T.salt>0&&T.water>0){const k=T.salt/(T.water*Qe);b={w:T.salt/(T.salt+T.water),molality:k,Tb:_a(a,k),Tf:Aa(k)}}const P=r==="gas"?o.gas.rho[n]:r==="liquid"?b!==null&&!o.phase.mixed?oo(f,b.w):o.phase.mixed?ps(o.phase.host[n],f):o.liquid.rhoRef:s.solid[n]!==0?ut[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?ut[s.solid[n]-1].id:null,T:f,p:a,Tsat:kt(a),x:l,rh:r==="gas"?u/Di(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:P,phi:s.phi[n],u:p,v:d,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:A,salt:b},particle:v<0?null:{id:g.id[v],T:g.T[v],vx:g.vx[v],vy:g.vy[v],mass:g.mass[v],rho:g.rho[v],dist:Math.sqrt(w),liquid:((M=Jt[g.mat[v]])==null?void 0:M.id)??Jt[0].id,salt:g.saltFraction(v)},bubble:_<0?null:o.bubbleModel.describe(_),body:iu(o,t,e)}}function iu(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&Ws(n)?n.id:"",material:ut[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}class ru{constructor(t){y(this,"g");y(this,"id");y(this,"count",0);y(this,"open",new Uint8Array(4));y(this,"vFluid",new Float64Array(4));y(this,"p0",new Float64Array(4));y(this,"rhoBar",new Float64Array(4));y(this,"vLiq",new Float64Array(4));y(this,"vBub",new Float64Array(4));y(this,"vGas",new Float64Array(4));y(this,"nSum",new Float64Array(4));y(this,"mSum",new Float64Array(4));y(this,"stack");y(this,"pAmb",101325);y(this,"rhoAmb",1.2);y(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,a=e+1;this.id.fill(-1);let c=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(c);let f=0,u=0,h=0;for(this.stack[f++]=l,this.id[l]=c;f>0;){const m=this.stack[--f];h+=1-t.fs[m];const p=m%e,d=(m-p)/e,g=p+d*a,v=p+d*e;(p===0&&t.openL&&i[g]>0||p===e-1&&t.openR&&i[g+1]>0||d===0&&t.openB&&r[v]>0||d===s-1&&t.openT&&r[v+e]>0)&&(u=1),p>0&&n[m-1]===0&&this.id[m-1]===-1&&i[g]>0&&(this.id[m-1]=c,this.stack[f++]=m-1),p<e-1&&n[m+1]===0&&this.id[m+1]===-1&&i[g+1]>0&&(this.id[m+1]=c,this.stack[f++]=m+1),d>0&&n[m-e]===0&&this.id[m-e]===-1&&r[v]>0&&(this.id[m-e]=c,this.stack[f++]=m-e),d<s-1&&n[m+e]===0&&this.id[m+e]===-1&&r[v+e]>0&&(this.id[m+e]=c,this.stack[f++]=m+e)}this.open[c]=u,this.vFluid[c]=h*t.vCell,c+=1}this.count=c}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<yt;a+=1){const c=s.mg[a*n+i];this.mSum[r]+=c,this.nSum[r]+=c/mt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let c=0;c<s;c+=1){if(this.id[c]!==t||e.kind[c]===ft)continue;let l=0;for(let f=0;f<yt;f+=1)l+=e.mg[f*s+c]/mt[f];n+=l*Bt*e.T[c]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let c=0;c<2;c+=1){let l=-i,f=0;for(let u=0;u<s;u+=1){if(this.id[u]!==t||e.kind[u]===ft)continue;let h=0;for(let d=0;d<yt;d+=1)h+=e.mg[d*s+u]/mt[d];const m=r-a*(e.dx*((u-u%e.nx)/e.nx+.5)),p=h*Bt*e.T[u];l+=p/m,f-=p/(m*m)}r-=l/f}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===G)return s;return-1}}class ou{constructor(t){y(this,"e");y(this,"floor");y(this,"floorH");y(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:c}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),f=Math.min(c-1,Math.max(0,Math.floor(e/r.dx))),u=l+f*a,h=i.heat;if(h.hasSolid(u)){this.toSolid(u,s,n);return}const m=[f>0?u-a:-1,l>0?u-1:-1,l<a-1?u+1:-1,f<c-1?u+a:-1];for(const p of m)if(p>=0&&h.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=f-2;p>=0;p-=1){const d=l+p*a;if(h.hasSolid(d)){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=$l(r);if(n<=a*i*(1+1e-9))continue;const c=(n-a*i)/(1-a),l=c*Hi(r),f=i/t.rho[s],u=i*t.h[s]-l;t.mass[s]=i-c,t.smass[2*s]=n-c,t.h[s]=u/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-f,this.deposit(t.x[s],t.y[s],c,l),this.crystallized+=c}}}const cu=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],ls=cu.length,hc=1/120;class au{constructor(t,e={}){y(this,"scene");y(this,"options");y(this,"warnings",[]);y(this,"grid");y(this,"particles");y(this,"bubbles");y(this,"liquid");y(this,"gas");y(this,"regions");y(this,"heat");y(this,"bubbleModel");y(this,"phase");y(this,"salt");y(this,"exchange");y(this,"bodies");y(this,"melt");y(this,"solver");y(this,"extremes",new r0(this));y(this,"prevKind");y(this,"p0Start",new Float64Array(8));y(this,"rng");y(this,"time",0);y(this,"steps",0);y(this,"dt",hc);y(this,"gy",9.81);y(this,"ambientY",new Float64Array(at));y(this,"ambientT",293.15);y(this,"pRef",101325);y(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});y(this,"flows",Yo());y(this,"snap",l0());y(this,"energy0",0);y(this,"water0",0);y(this,"other0",0);y(this,"salt0",0);y(this,"cappedCount",0);y(this,"vapourRate",0);y(this,"vapourLast",0);y(this,"timings",new Float64Array(ls));y(this,"stamp",new Float64Array(ls+1));y(this,"stepMs",0);y(this,"quality","high");y(this,"heaterOps",new Map);y(this,"building",!1);this.options=e;const s=dc(t)?t:or(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??hc}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=x0[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>y0;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new I0(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new Y0(Math.max(4096,4*i.n+1024)),this.bubbles=new Kf(4096),this.solver=new At(s,n),this.regions=new ru(i),this.liquid=new X0(i,this.particles,this.solver),this.gas=new B0(i,this.regions,this.solver),this.heat=new E0(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new n0(this),this.phase=new eu(this),this.salt=new ou(this),this.exchange=new O0(this),this.bodies=new Of(this),this.heat.bodies=this.bodies.list,this.melt=new Wf(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,a,c,l,f)=>this.bodies.hitPoint(r,a,c,l,f),this.liquid.afterSolve=(r,a,c,l)=>this.bodies.probe(r,a,c,l),this.prevKind=new Uint8Array(i.n),this.rng=new Oa(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=Yo(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=G,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,c=(i>0?i:Al)/a,l=(r>0||i>0?r:Tl)/a,f=1/(c/mt[ot]+l/mt[ct]),u=Math.min(.99,s*Di(e)/t),h=u*mt[X]/(u*mt[X]+(1-u)*f);this.ambientY.fill(0),this.ambientY[ot]=(1-h)*c,this.ambientY[ct]=(1-h)*l,this.ambientY[X]=h;let m=0;for(let p=0;p<yt;p+=1)m+=this.ambientY[p]/mt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(Bt*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>Ti(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=Ws(t)&&(t.id===""||Ti(this,t.id)>=0)?{...t,id:Da(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!this.surfaceAfterFill(e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=m0(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let c=0;c<n;c+=1)for(let l=0;l<s;l+=1){const f=l+c*s;e.solid[f]===0&&(e.kind[f]===it||xs(t.region,(l+.5)*e.dx,(c+.5)*e.dx))&&(i[f]=1)}const r=new Uint8Array(e.n),a=[];for(let c=0;c<e.n;c+=1){if(i[c]===0||r[c]!==0)continue;let l=!1;for(a.push(c),r[c]=1;a.length>0;){const f=a.pop(),u=f%s,h=(f-u)/s,m=this.gas,p=[m.across(f,u,h,0),m.across(f,u,h,1),m.across(f,u,h,2),m.across(f,u,h,3)];(u===0&&e.openL||u===s-1&&e.openR||h===0&&e.openB||h===n-1&&e.openT)&&(l=!0);for(const d of p)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,a.push(d))}}if(!l)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),c=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&c!==void 0&&c.op==="hotplate"){const l=[...this.scene.ops];l[a]={...c,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return _0({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=dc(t)?t:or(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=or(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,c=this.dt,l=this.stamp;l[0]=be();const f=n.pvTerm();this.bodies.prepare()&&(n.update(r,a),this.flows.bodyWork+=n.pvTerm()-f),l[1]=be(),e.splatVolumeChange(c),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===G?n.pAt(d)-this.pRef:0;e.step(c,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=be(),s.updateVolumes(),s.markFaces();const u=s.escaped[X]+s.escaped[yt],h=s.escaped[ot]+s.escaped[ct],m=s.escaped[yt+1];s.transport(c),this.flows.escapedWater+=s.escaped[X]+s.escaped[yt]-u,this.flows.escapedAir+=s.escaped[ot]+s.escaped[ct]-h,this.flows.escapedEnergy+=s.escaped[yt+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(c,this.gy),s.sources(c),s.project(c,this.tol,this.maxIter),l[3]=be(),this.bubbleModel.step(c),l[4]=be(),this.phase.step(c),this.salt.step(),l[5]=be(),i.step(c,1e-6,200),this.exchange.step(c),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=be(),l[7]=be(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===G?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=c,this.steps+=1,l[8]=be(),this.bodies.finish(c),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit()),l[9]=be();const p=this.steps<5?1:1/30;for(let d=0;d<ls;d+=1)this.timings[d]+=p*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=p*(l[ls]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let c=0;c<e.count;c+=1)i.dp0[c]!==0&&(a=!0);if(a){for(let c=0;c<s.count;c+=1){const l=t.cellAt(s.x[c],s.y[c]),f=l<0?-1:e.id[l];if(f<0||i.dp0[f]===0)continue;const u=s.mass[c],h=u/s.rho[c];s.h[c]+=h*i.dp0[f]/u,s.derive(c),r.dVp[c]+=u/s.rho[c]-h}for(let c=0;c<n.count;c+=1){const l=t.cellAt(n.x[c],n.y[c]),f=l<0?-1:e.id[l];f>=0&&i.dp0[f]!==0&&(n.H[c]+=n.V[c]*i.dp0[f])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,a0(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.bodies.anyFree||this.melt.any()}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===lt&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==lt&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===it?this.pRef+e.pl[t]:e.kind[t]===G?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return nu(this,t,e)}liquidsAt(t){return su(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===it?e+=1:t.kind[d]===G&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,c=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy+a.bodyWork),l=r.water.total-this.water0-a.editWater,f=r.other.total-this.other0-a.editOther,u=r.salt.total-this.salt0-a.editSalt,h=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.phase.producedMark)/m,this.phase.producedMark=h,this.vapourLast=this.time);const p=[];for(let d=0;d<this.regions.count;d+=1)p.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor,bodies:{count:this.bodies.list.filter(d=>!d.gone).length,free:this.bodies.list.filter(d=>d.free).length,awake:this.bodies.list.filter(d=>d.awake).length},heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:c,waterError:l,otherError:f,saltError:u,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats(),cpuOnly:this.needsCpu()}}}const be=()=>typeof performance<"u"?performance.now():Date.now();function dc(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class Na{constructor(t){y(this,"g");y(this,"last",null);y(this,"latent0",0);y(this,"stored0",0);y(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=Jc(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},c=this.last;let l=0,f=0;if(c!==null&&a.t>c.t){const m=a.t-c.t,p=(a.heater-c.heater)/m,d=(a.solids-c.solids+a.SG-c.SG+a.lossS-c.lossS+a.LG-c.LG+a.sens-c.sens+a.bub-c.bub)/m;l=(a.vap-c.vap)/m,f=Math.max(0,(p-d)/i)}this.last=a;const u=this.vapour()*i,h=r.energy;return this.started||(this.started=!0,this.latent0=u,this.stored0=h),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:u-this.latent0,sensible:h-this.stored0-(u-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:f}}}const Is={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Vs=16,W={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},fs=96,mc=16,lu=57,Qt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Fe=16,fu={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Nr=8,Ht={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},ge=8,uu={TSUM:0,CELLS:1},Ur=2,hu={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Ua=16,st={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69},ar=70,is={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},lr=6,Hr={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16},fr=17,Le={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},ur=20,du={KNOWN:0,MARK:1,MARK2:2,GAS:3},pc=4,mu={F:0},hr=1,pu={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},Gr=12,Yt=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),gu=[Yt("G_",Is),Yt("C_",W),Yt("R_",Qt),Yt("RA_",fu),Yt("H_",Ht),Yt("HA_",uu),Yt("S_",hu),Yt("F_",st),Yt("U_",is),Yt("A_",Hr),Yt("FF_",Le),Yt("FU_",du),Yt("AF_",mu),Yt("BA_",pu),`const RACC_STRIDE: u32 = ${Nr}u;`,`const HEAT_STRIDE: u32 = ${ge}u;`,`const HACC_STRIDE: u32 = ${Ur}u;`,`const CGS_STRIDE: u32 = ${Ua}u;`,`const BACC_STRIDE: u32 = ${Gr}u;`].join(`
`);function Q(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Nt=o=>o.map(Q).join(", "),Ot=_t.species[0],Zn=_t.species[1],Jn=_t.species[2],us=Ot.liquid.cp.table,qe=us.map(o=>o[0]),ms=us.map(o=>o[1]),Pi=[ms[0]*(qe[0]-et)];for(let o=1;o<us.length;o+=1)Pi.push(Pi[o-1]+.5*(ms[o]+ms[o-1])*(qe[o]-qe[o-1]));const[xu,vu,yu]=Ot.vapour.cp.linear,$r=et+100,wu=(()=>{let o=0;for(;o<qe.length-2&&$r>=qe[o+1];)o+=1;const t=$r-qe[o],e=(ms[o+1]-ms[o])/(qe[o+1]-qe[o]);return Pi[o]+ms[o]*t+.5*e*t*t})(),bu=wu+Ot.saturation.hlv100.v,Te=_t.solids,Ha=_t.species.slice(3).map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{cA:e,cB:s,h0:e*et+.5*s*et*et,rA:t.rho.linear[0],rB:t.rho.linear[1],kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v}}),Ga=1+Ha.length,he=o=>`array<f32, ${Ga}>(${Nt([0,...Ha.map(o)])})`,dr=4294967295,Fu=`
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
  sealed: u32, harness: u32, theta: f32, mixed: u32,
  chf: f32, actMax: f32, vmax: f32, bubCap: f32,
}`,gc=48,_u=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,Ts=27,Au=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Ps=29,Tu=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,mr=8,Pu=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,ku=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${Q(et)};
const R_GAS: f32 = ${Q(Bt)};
const P_ATM: f32 = ${Q(gn)};
const G0: f32 = ${Q(Ii)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${Q(Zn.molarMass.v)};
const M_O2: f32 = ${Q(Jn.molarMass.v)};
const M_H2O: f32 = ${Q(Ot.molarMass.v)};
const CP_N2: f32 = ${Q(Zn.gas.cp.v)};
const CP_O2: f32 = ${Q(Jn.gas.cp.v)};
const CPV0: f32 = ${Q(xu)};
const CPV1: f32 = ${Q(vu)};
const CPV_T: f32 = ${Q(yu)};
const T100: f32 = ${Q($r)};
const HV100: f32 = ${Q(bu)};
const NCP: i32 = ${us.length};
const CP_T = array<f32, ${us.length}>(${Nt(qe)});
const CP_V = array<f32, ${us.length}>(${Nt(ms)});
const CP_H = array<f32, ${us.length}>(${Nt(Pi)});
const KELL = array<f32, 7>(${Nt(Ot.liquid.kell.c)});
const KL = array<f32, 3>(${Nt(Ot.liquid.k.poly)});
const VA: f32 = ${Q(Ot.liquid.mu.vogel[0])};
const VB: f32 = ${Q(Ot.liquid.mu.vogel[1])};
const VC: f32 = ${Q(Ot.liquid.mu.vogel[2])};
const ST_B: f32 = ${Q(Ot.surfaceTension.B)};
const ST_b: f32 = ${Q(Ot.surfaceTension.b)};
const ST_MU: f32 = ${Q(Ot.surfaceTension.mu)};
const T_CRIT: f32 = ${Q(Ot.saturation.Tc.v)};
const RHO_CRIT: f32 = ${Q(Ot.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Nt(Ot.saturation.if97.n)});
const RVC = array<f32, 6>(${Nt(Ot.saturation.vapourDensity.c)});
const KV: f32 = ${Q(Ot.vapour.k.v)};
const MUV: f32 = ${Q(Ot.vapour.mu.v)};
const KN = array<f32, 3>(${Nt(Zn.gas.k.power)});
const KO = array<f32, 3>(${Nt(Jn.gas.k.power)});
const MN = array<f32, 3>(${Nt(Zn.gas.mu.sutherland)});
const MO = array<f32, 3>(${Nt(Jn.gas.mu.sutherland)});
const DV0: f32 = ${Q(_t.vapourInAir.D0.v)};
const DVT0: f32 = ${Q(_t.vapourInAir.T0.v)};
const DVE: f32 = ${Q(_t.vapourInAir.exponent.v)};
const NSOL: u32 = ${Te.length}u;
const S_RHO = array<f32, ${Te.length}>(${Nt(Te.map(o=>o.rho.v))});
const S_CP = array<f32, ${Te.length}>(${Nt(Te.map(o=>o.cp.v))});
const S_K = array<f32, ${Te.length}>(${Nt(Te.map(o=>o.k.v))});
const S_THETA = array<f32, ${Te.length}>(${Nt(Te.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${Q(Ca)};
const REG_STRIDE: u32 = ${Fe}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${Q(ia)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${Q(bs)};
const NLIQ: u32 = ${Ga}u;
const L_CA = ${he(o=>o.cA)};
const L_CB = ${he(o=>o.cB)};
const L_H0 = ${he(o=>o.h0)};
const L_RA = ${he(o=>o.rA)};
const L_RB = ${he(o=>o.rB)};
const L_KA = ${he(o=>o.kA)};
const L_KB = ${he(o=>o.kB)};
const L_MA = ${he(o=>o.mA)};
const L_MB = ${he(o=>o.mB)};
const L_MC = ${he(o=>o.mC)};
const L_SIG = ${he(o=>o.sigma)};
`,Su=`
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
/* Die Flüssigkeit eines Teilchens (M2a): Bits 8..15 seiner Merkmale (0 Wasser); ihre Stoffgesetze wie engine/materials.ts. */
fn matOf(flags: u32) -> u32 { return (flags >> 8u) & 255u; }
fn cpLM(m: u32, T: f32) -> f32 { if (m == 0u) { return cpL(T); } return L_CA[m] + L_CB[m] * T; }
fn hLM(m: u32, T: f32) -> f32 { if (m == 0u) { return hL(T); } return (L_CA[m] + 0.5 * L_CB[m] * T) * T - L_H0[m]; }
fn tFromHLM(m: u32, h: f32) -> f32 {
  if (m == 0u) { return tFromHL(h); }
  let c = h + L_H0[m];
  let a = L_CA[m];
  let b = L_CB[m];
  if (b == 0.0) { return c / a; }
  return 2.0 * c / (a + sqrt(max(0.0, a * a + 2.0 * b * c)));
}
fn rhoLM(m: u32, T: f32) -> f32 { if (m == 0u) { return rhoL(T); } return L_RA[m] + L_RB[m] * T; }
fn kLM(m: u32, T: f32) -> f32 { if (m == 0u) { return kL(T); } return L_KA[m] + L_KB[m] * T; }
fn muLM(m: u32, T: f32) -> f32 { if (m == 0u) { return muL(T); } return L_MA[m] * exp2(L_MB[m] / (max(T, L_MC[m] + 60.0) - L_MC[m]) * 3.321928094887362); }
fn sigmaLM(m: u32, T: f32) -> f32 { if (m == 0u) { return sigmaW(T); } return L_SIG[m]; }
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
`,Mu=`
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
`,po=[Fu,_u,Au,Tu,Pu,ku,gu,Su,Mu].join(`
`),ve=_t.solutes[0],pn=298.15,Pe=o=>o.map(Q).join(", "),Dn=14,Ke=ve.cp.range.lo,ze=ve.cp.range.hi,[$a,Lu,Cu,Ou,qu,ju]=ve.cp.laliberte,Bu=o=>Math.exp(Lu*(o-et)+Cu*Math.exp(.01*(o-et))),ki=.5*(ze-Ke),vs=new Array(Dn).fill(0);{for(let t=0;t<64;t+=1){const e=Math.PI*(t+.5)/64,s=Bu(.5*(ze+Ke)+ki*Math.cos(e));for(let n=0;n<Dn;n+=1)vs[n]+=2/64*s*Math.cos(n*e)}vs[0]/=2}const Wr=o=>o<Dn?vs[o]:0,Ks=new Array(Dn+1).fill(0);Ks[1]=vs[0]-Wr(2)/2;for(let o=2;o<=Dn;o+=1)Ks[o]=(Wr(o-1)-Wr(o+1))/(2*o);const kn=(o,t)=>{let e=0,s=0;for(let n=o.length-1;n>=1;n-=1){const i=2*t*e-s+o[n];s=e,e=i}return t*e-s+o[0]},Si=kn(vs,-1),Wa=kn(vs,1),Kr=kn(Ks,-1),Ka=o=>{if(o<=Ke)return Si*(o-et);const t=Si*(Ke-et);return o>=ze?t+ki*(kn(Ks,1)-Kr)+Wa*(o-ze):t+ki*(kn(Ks,(2*o-Ke-ze)/(ze-Ke))-Kr)},Iu=Si*(Ke-et),Ru=Ka(ze),Eu=ve.dHsol.v/Qe+bs*(pn-et)-1e3*$a*Ka(pn);function xc(o,t){const e=[`fn ${o}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let s=t.length-1;s>=1;s-=1)e.push(`  t = 2.0 * x * b1 - b2 + ${Q(t[s])}; b2 = b1; b1 = t;`);return e.push(`  return x * b1 - b2 + ${Q(t[0])};`,"}"),e.join(`
`)}const ln=ve.pitzer,ti=ve.pitzerCold,Du=Math.sqrt(2*Math.PI*zc),Vu=mi*mi/(4*Math.PI*Qc*Kc),ks=ve.solubility.table,fn=ve.density.laliberte,Nu=`
const S_TR: f32 = ${Q(pn)};
const S_MS: f32 = ${Q(Qe)};
const S_MW: f32 = ${Q(Vi)};
const S_NU: f32 = ${Q(ve.ions.v)};
const PZ_B: f32 = ${Q(ln.b.v)};
const PZ_ALPHA: f32 = ${Q(ln.alpha.v)};
const PZ_COLD: f32 = ${Q(ti.below.v)};
const PZ_B0 = array<f32, 6>(${Pe(ln.b0.a)});
const PZ_B1 = array<f32, 6>(${Pe(ln.b1.a)});
const PZ_C = array<f32, 6>(${Pe(ln.c.a)});
const PZC_B0 = array<f32, 6>(${Pe(ti.b0.a)});
const PZC_B1 = array<f32, 6>(${Pe(ti.b1.a)});
const PZC_C = array<f32, 6>(${Pe(ti.c.a)});
const S_EPS = array<f32, 4>(${Pe(ve.dielectric.c)});
const S_KN: f32 = ${Q(Du)};
const S_KLB: f32 = ${Q(Vu)};
const SOL_T = array<f32, ${ks.length}>(${Pe(ks.map(o=>o[0]))});
const SOL_M = array<f32, ${ks.length}>(${Pe(ks.map(o=>o[1]))});
const LD0: f32 = ${Q(fn[0])};
const LD1: f32 = ${Q(fn[1])};
const LD2: f32 = ${Q(fn[2])};
const LD3: f32 = ${Q(fn[3])};
const LD4: f32 = ${Q(fn[4])};
const LA1: f32 = ${Q($a)};
const LA4: f32 = ${Q(Ou)};
const LA5: f32 = ${Q(qu)};
const LA6: f32 = ${Q(ju)};
const E_LO: f32 = ${Q(Ke)};
const E_HI: f32 = ${Q(ze)};
const E_LOV: f32 = ${Q(Si)};
const E_HIV: f32 = ${Q(Wa)};
const E_HALF: f32 = ${Q(ki)};
const E_FM1: f32 = ${Q(Kr)};
const E_ILO: f32 = ${Q(Iu)};
const E_IHI: f32 = ${Q(Ru)};
const S_QS: f32 = ${Q(Eu)};
const S_DMU: f32 = ${Q(ve.diffusivity.v*Ri(pn)/pn)};

${xc("eCh",vs)}
${xc("iCh",Ks)}
/* Die Temperaturform von PHREEQC mit x = T − T_R. */
fn pzT(a: array<f32, 6>, T: f32) -> f32 {
  let x = T - S_TR;
  let s = T + S_TR;
  let iT = 1.0 / (T * S_TR);
  return a[0] - a[1] * x * iT + a[2] * log(T / S_TR) + a[3] * x + a[4] * x * s - a[5] * x * s * iT * iT;
}
fn aPhiS(T: f32) -> f32 {
  let t = T - T0;
  let eps = S_EPS[0] + t * (S_EPS[1] + t * (S_EPS[2] + t * S_EPS[3]));
  let lb = S_KLB / (eps * T);
  return S_KN * sqrt(rhoL(T)) * lb * sqrt(lb) / 3.0;
}
fn osmoticS(T: f32, m: f32) -> f32 {
  if (!(m > 0.0)) { return 1.0; }
  let sm = sqrt(m);
  var b0 = 0.0; var b1 = 0.0; var c = 0.0;
  if (T < PZ_COLD) { b0 = pzT(PZC_B0, T); b1 = pzT(PZC_B1, T); c = pzT(PZC_C, T); }
  else { b0 = pzT(PZ_B0, T); b1 = pzT(PZ_B1, T); c = pzT(PZ_C, T); }
  return 1.0 - aPhiS(T) * sm / (1.0 + PZ_B * sm) + m * (b0 + b1 * exp(-PZ_ALPHA * sm)) + m * m * c;
}
/** Aktivität des Wassers a_w = exp(−ν m φ M_w). */
fn waterAct(T: f32, m: f32) -> f32 {
  if (!(m > 0.0)) { return 1.0; }
  return exp(-S_NU * m * osmoticS(T, m) * S_MW);
}
/** Siedepunkt beim Druck p: a_w(T_b) p_sat(T_b) = p als Festpunkt T ← T_sat(p/a_w(T)). */
fn boilPt(p: f32, m: f32) -> f32 {
  var T = tSat(p);
  if (!(m > 0.0)) { return T; }
  for (var it = 0; it < 6; it++) {
    let Tn = tSat(p / waterAct(T, m));
    let d = Tn - T;
    T = Tn;
    if (abs(d) < 1e-4) { break; }
  }
  return T;
}
/** Molalität und Massenanteil der gesättigten Lösung (Pitzer, Peiper & Busey 1984, linear dazwischen). */
fn satMol(T: f32) -> f32 {
  if (T <= SOL_T[0]) { return SOL_M[0]; }
  for (var k = 1; k < ${ks.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${ks.length-1}];
}
fn satFrac(T: f32) -> f32 { let m = satMol(T); return m * S_MS / (1.0 + m * S_MS); }
fn hCrys(T: f32) -> f32 { return CP_CRYSTAL * (T - T0); }
/** Dichte der Lösung (Laliberté 2009). */
fn rhoSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return rhoL(T); }
  let t = T - T0;
  let q = t + LD4;
  let app = (LD0 * w + LD1) * exp(1e-6 * q * q) / (w + LD2 + LD3 * t);
  return 1.0 / ((1.0 - w) / rhoL(T) + w / app);
}
fn saltE(T: f32) -> f32 {
  if (T <= E_LO) { return E_LOV; }
  if (T >= E_HI) { return E_HIV; }
  return eCh((2.0 * T - E_LO - E_HI) / (E_HI - E_LO));
}
fn saltI(T: f32) -> f32 {
  if (T <= E_LO) { return E_LOV * (T - T0); }
  if (T >= E_HI) { return E_IHI + E_HIV * (T - E_HI); }
  return E_ILO + E_HALF * (iCh((2.0 * T - E_LO - E_HI) / (E_HI - E_LO)) - E_FM1);
}
fn coefA(w: f32) -> f32 { return 1000.0 * LA1 * w * exp(LA4 * w); }
fn coefB(w: f32) -> f32 { return 1000.0 * LA5 * pow(w, LA6 + 1.0); }
/** Spezifische Enthalpie und c_p der Lösung (reines Wasser: h_l, c_p,l). */
fn hSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return hL(T); }
  return (1.0 - w) * hL(T) + w * S_QS + coefA(w) * saltI(T) + coefB(w) * (T - T0);
}
fn cpSol(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return cpL(T); }
  return (1.0 - w) * cpL(T) + coefA(w) * saltE(T) + coefB(w);
}
/** T aus h und w (Newton ab guess; auf 1e-4 K — f32 löst h auf etwa 0,03 J/kg auf). */
fn tFromHSol(h: f32, w: f32, guess: f32) -> f32 {
  if (!(w > 0.0)) { return tFromHL(h); }
  let A = coefA(w);
  let B = coefB(w);
  let base = w * S_QS;
  let ww = 1.0 - w;
  var T = guess;
  if (!(guess > 200.0 && guess < 900.0)) { T = T0 + (h - base) / (4000.0 * ww + 800.0 * w); }
  for (var it = 0; it < 8; it++) {
    let fT = ww * hL(T) + base + A * saltI(T) + B * (T - T0) - h;
    let dT = fT / (ww * cpL(T) + A * saltE(T) + B);
    T -= dT;
    if (abs(dT) < 1e-4) { break; }
  }
  return T;
}
/** Partielle spezifische Enthalpien des gelösten Salzes und des Wassers in der Lösung. */
fn hSaltIn(T: f32, w: f32) -> f32 {
  let e = exp(LA4 * w);
  let ia = 1000.0 * LA1 * e * (w + (1.0 - w) * (1.0 + LA4 * w));
  var ib = 0.0;
  if (w > 0.0) { ib = 1000.0 * LA5 * pow(w, LA6) * (w + (1.0 - w) * (LA6 + 1.0)); }
  return S_QS + ia * saltI(T) + ib * (T - T0);
}
fn hWaterIn(T: f32, w: f32) -> f32 {
  if (!(w > 0.0)) { return hL(T); }
  return hL(T) - 1000.0 * LA1 * LA4 * w * w * exp(LA4 * w) * saltI(T) - 1000.0 * LA5 * LA6 * pow(w, LA6 + 1.0) * (T - T0);
}
/** Diffusionskoeffizient des Salzes (Stokes–Einstein vom Wert bei 25 °C). */
fn saltDiff(T: f32) -> f32 { return S_DMU * T / muL(T); }
/** c_p eines Teilchens (mit Salz: der Lösung). */
fn pCp(mat: u32, T: f32, s: f32, m: f32) -> f32 {
  if (s > 0.0) { return cpSol(T, s / m); }
  return cpLM(mat, T);
}
/** T und ρ eines Teilchens aus seinem h (mit Salz: der Lösung; wie Particles.derive). */
fn pDerive(q: ptr<function, Particle>) {
  let s = (*q).s;
  if (s > 0.0) {
    let w = s / (*q).mass;
    let T = tFromHSol((*q).h, w, (*q).T);
    (*q).T = T;
    (*q).rho = rhoSol(T, w);
    return;
  }
  let mt = matOf((*q).flags);
  let T = tFromHLM(mt, (*q).h);
  (*q).T = T;
  (*q).rho = rhoLM(mt, T);
}
`,Uu=/\b(?:waterAct|osmoticS|boilPt|satMol|satFrac|hCrys|rhoSol|saltE|saltI|hSol|cpSol|tFromHSol|hSaltIn|hWaterIn|saltDiff|pCp|pDerive)\s*\(/;class Hu{constructor(t){y(this,"name");y(this,"binds");y(this,"wg");y(this,"source");y(this,"pipeline",null);y(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=$u(t.bind),this.source=zu(t,this.binds,this.wg)}}const Gu={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function $u(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":Gu[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const Wu=`
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
`,Ku=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function zu(o,t,e){const s=[po,`const WG: u32 = ${e}u;`,Wu];Uu.test(o.code)&&s.push(Nu);const n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of Ku)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
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
fn maxU_${i.name}(i: u32, v: f32) { atomicMax(&${i.name}[i], bitcast<u32>(max(v, 0.0))); }
fn takeF_${i.name}(i: u32, want: f32, lim: f32) -> f32 {
  var old = atomicLoad(&${i.name}[i]);
  loop {
    let cur = bitcast<f32>(old);
    let t = clamp(lim - cur, 0.0, want);
    if (!(t > 0.0)) { return 0.0; }
    let r = atomicCompareExchangeWeak(&${i.name}[i], old, bitcast<u32>(cur + t));
    if (r.exchanged) { return t; }
    old = r.old_value;
  }
}`))}),s.push(o.code),s.join(`
`)}class go{constructor(t){y(this,"device");y(this,"kernels",new Map);y(this,"timestamps");y(this,"bufs",[]);y(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new go(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new Hu(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const f of a)e.push(`${s.name}:${f.lineNum}:${f.linePos} ${f.message}
    ${l[f.lineNum-1]??""}`);return}const c=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,f)=>l.mode==="t"?{binding:f,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:f,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:f,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:f,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=c;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const vc=64,yc="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Rs=`
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
fn solveBubble(mN: f32, mO: f32, mV: f32, pl: f32, Tl: f32, D: f32, rGuess: f32, host: u32) -> Shape {
  let na = mN / M_N2 + mO / M_O2;
  let nv = mV / M_H2O;
  var r = rGuess;
  if (!(r > 0.0)) { r = cbrtf(3.0 * max(1e-30, (nv + na) * R_GAS * Tl / pl) / (4.0 * PI)); }
  var pb = pl;
  var pv = 0.0;
  var Tb = Tl;
  var V = 0.0;
  for (var it = 0; it < 8; it++) {
    pb = pl + 2.0 * sigmaLM(host, Tb) / r;
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
  return Shape(r, V, pl + 2.0 * sigmaLM(host, Tb) / r, pv, Tb);
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
`,Mi=`
fn kindOf(c: u32) -> u32 { return cu[U_KIND * P.n + c]; }
/* M2a: die vorherrschende Flüssigkeit der Zelle und der Anteil des Wassers an ihrer Flüssigkeit (0 ohne Wasserteilchen). */
fn hostC(c: u32) -> u32 { return min(u32(cf[F_HOST * P.n + c]), NLIQ - 1u); }
fn hostXY(x: f32, y: f32) -> u32 { let c = cellAtN(x, y); if (c == NONE) { return 0u; } return hostC(c); }
fn shareW(c: u32) -> f32 {
  let acc = cf[F_ACC * P.n + c];
  if (!(acc > 0.0)) { return 0.0; }
  if (P.mixed == 0u) { return 1.0; }
  let all = cf[F_ACCALL * P.n + c];
  return select(1.0, (acc + cf[F_ACCS * P.n + c]) / all, all > 0.0);
}
/* Das mittlere h des Wassers der Zelle (ohne Wasser: h bei der Temperatur ihrer Flüssigkeit) — wie phase.waterH. */
fn hbarC(c: u32) -> f32 { let acc = cf[F_ACC * P.n + c]; return select(hL(cf[F_PTL * P.n + c]), cf[F_ACCH * P.n + c] / acc, acc > 0.0); }
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
/* Summe der Gewichte über flüssige Zellen der Spur, Σ w T_l und Σ w ΔT_b (Sole, M2b). */
fn liqFoot(fp: FP, x: f32, y: f32, r: f32) -> vec3<f32> {
  var ws = 0.0;
  var wt = 0.0;
  var wd = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w <= 0.0) { continue; }
      ws += w;
      wt += w * cf[F_PTL * P.n + c];
      wd += w * cf[F_DTB * P.n + c];
    }
  }
  return vec3<f32>(ws, wt, wd);
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
/* Σ (w/ws)·Anteil des Wassers über die Spur: so viel der Masse, die die Blase tauschen möchte, hat Wasser zum Tauschen (wie fwSum in BubbleModel.advance). */
fn liqShare(fp: FP, x: f32, y: f32, r: f32, ws: f32) -> f32 {
  var a = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w > 0.0) { a += w / ws * shareW(c); }
    }
  }
  return a;
}
/* Masse dm aus dem Wasser der Spur (nach w und dem Anteil des Wassers, Summe fw), latente Wärme dort; das Budget mit. */
fn liqTake(fp: FP, x: f32, y: f32, r: f32, ws: f32, fw: f32, dm: f32, hvb: f32, Tl: f32, dt: f32) {
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID) { continue; }
      let w0 = fpW(fp, x, y, r, i, j);
      if (w0 <= 0.0) { continue; }
      let w = w0 / ws * shareW(c) / fw;
      if (w == 0.0) { continue; }
      let hbar = hbarC(c);
      addF_at(A_FM * P.n + c, -dm * w);
      addF_at(A_HSRC * P.n + c, -dm * w * (hvb - hbar) / dt);
      addF_at(A_BUDGET * P.n + c, -dm * w * (hvb - hbar));
    }
  }
}
/* Wärme q (W) an die Flüssigkeit der Spur (nach w) — nur an Zellen mit Flüssigkeit: eine Zelle, die eine grosse Blase leer gedrückt hat, bleibt flüssig, hat aber keine Wärmekapazität (wie BubbleModel.restoreEnthalpy). false: keine solche Zelle. */
fn liqHeat(fp: FP, x: f32, y: f32, r: f32, q: f32) -> bool {
  var ws = 0.0;
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID || !(cf[F_PCL * P.n + c] > 0.0)) { continue; }
      ws += max(0.0, fpW(fp, x, y, r, i, j));
    }
  }
  if (!(ws > 0.0)) { return false; }
  for (var j = fp.j0; j <= fp.j1; j++) {
    for (var i = fp.i0; i <= fp.i1; i++) {
      let c = cellOf(i, j);
      if (kindOf(c) != LIQUID || !(cf[F_PCL * P.n + c] > 0.0)) { continue; }
      let w = fpW(fp, x, y, r, i, j);
      if (w > 0.0) { addF_at(A_HSRC * P.n + c, q * w / ws); }
    }
  }
  return true;
}
`,Qu=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,Xu=`
fn spreadRing(x: f32, y: f32, r: f32, fx: f32, fy: f32) -> bool {
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let dx = P.dx;
  let n = P.n;
  let R = max(1.5 * r, r + 2.0 * dx);
  let r2 = r * r;
  let R2 = R * R;
  let ia = max(0, i32(floor((x - R) * P.invdx)));
  let ib = min(nx, i32(ceil((x + R) * P.invdx)));
  let ja = max(0, i32(floor((y - R) * P.invdx)));
  let jb = min(ny, i32(ceil((y + R) * P.invdx)));
  var su = 0.0;
  var sv = 0.0;
  for (var ps = 0; ps < 2; ps++) {
    if (ps == 1) {
      if (!(su > 0.0) || !(sv > 0.0)) { return false; }
      su = fx / su;
      sv = fy / sv;
    }
    for (var j = ja; j <= jb; j++) {
      for (var i = ia; i <= ib; i++) {
        if (j < ny) {
          let px = f32(i) * dx - x;
          let py = (f32(j) + 0.5) * dx - y;
          let d2 = px * px + py * py;
          if (d2 >= r2 && d2 <= R2) {
            var w = 0.0;
            if (i > 0) { w += cf[F_PHI * n + u32(i - 1 + j * nx)]; }
            if (i < nx) { w += cf[F_PHI * n + u32(i + j * nx)]; }
            w *= 0.5;
            if (w > 0.0) { if (ps == 0) { su += w; } else { addF_af(uF(i, j), su * w); } }
          }
        }
        if (i < nx) {
          let px = (f32(i) + 0.5) * dx - x;
          let py = f32(j) * dx - y;
          let d2 = px * px + py * py;
          if (d2 >= r2 && d2 <= R2) {
            var w = 0.0;
            if (j > 0) { w += cf[F_PHI * n + u32(i + (j - 1) * nx)]; }
            if (j < ny) { w += cf[F_PHI * n + u32(i + j * nx)]; }
            w *= 0.5;
            if (w > 0.0) { if (ps == 0) { sv += w; } else { addF_af(vF(i, j), sv * w); } }
          }
        }
      }
    }
  }
  return true;
}
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
`,Yu=[{name:"bubNucleate",wg:vc,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Rs}
${Mi}
${yc} {
  let s = gid.x;
  if (s >= P.nsites) { return; }
  if (atomicLoad(&sbub[s]) != 0u) { return; }
  let S = sites[s];
  let n = P.n;
  let fc = S.fluid;
  if (cu[U_KIND * n + fc] != LIQUID) { return; }
  let acc = cf[F_ACC * n + fc];
  if (!(acc > 0.0)) { return; }
  /* Keime nur im Wasser (der einzigen flüchtigen Flüssigkeit): die Zelle vor der Kavität muss vor allem Wasser sein. */
  if (shareW(fc) < 0.5) { return; }
  let sc = S.cell;
  let mat = cu[U_SOLID * n + sc];
  let ks = solidK(mat);
  let Tl = cf[F_PTL * n + fc];
  let hm = hostC(fc);
  let kl = kLM(hm, Tl);
  let Tf = (ks * cf[F_T * n + sc] + kl * Tl) / (ks + kl);
  let pl = max(0.5 * P.pref, P.pref + cf[F_PL * n + fc]);
  var Ts = cf[F_TSAT * n + fc];
  if (!(Ts > 0.0)) { Ts = tSat(pl); }
  if (Tf - Ts < 0.0) { return; }
  let rc = S.r;
  /* Beim Mildern keimt jede Kavität spätestens bei P.actMax Überhitzung (extremes.ts). */
  if (Tf - Ts < min(activation(rc, pl), P.actMax)) { return; }
  let pb = pl + 2.0 * sigmaLM(hm, Tf) / rc;
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
}`},{name:"bubAdvance",wg:vc,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Rs}
${Mi}
${Qu}
${Xu}
${yc} {
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
    /* In Sole steht die Grenzfläche um ΔT_b über dem Dampf der Blase (0 in reinem Wasser). */
    var shift = 0.0;
    if (site >= 0) {
      let S = sites[u32(site)];
      shift = cf[F_DTB * n + S.fluid];
      let ks = solidK(cu[U_SOLID * n + S.cell]);
      let Tw = cf[F_PTL * n + S.fluid];
      let klw = kLM(hostC(S.fluid), Tw);
      Tl = (ks * cf[F_T * n + S.cell] + klw * Tw) / (ks + klw);
      srcCell = S.cell;
    } else {
      fp = fpOf(B.x, B.y, B.r, B.V);
      let lf = liqFoot(fp, B.x, B.y, B.r);
      ws = lf.x;
      if (!(ws > 0.0)) { break; }
      Tl = lf.y / ws;
      shift = lf.z / ws;
    }
    let Tb = B.Tb;
    /* Stoffwerte der Flüssigkeit um die Blase (Wasser, oder Öl über einer Wasserschicht). */
    var hm = 0u;
    if (site >= 0) { hm = hostC(sites[u32(site)].fluid); } else { hm = hostXY(B.x, B.y); }
    let kl = kLM(hm, Tl);
    let rhol = rhoLM(hm, Tl);
    let cpl = cpLM(hm, Tl);
    let mul = muLM(hm, Tl);
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
    if (site >= 0 && Tl > Tb + shift) {
      let rdep = 0.5 * fritzD(B, Tl);
      let rv0 = select(rhoVapourSat(Tb), B.mV / B.V, B.mV > 0.0);
      let drPlan = hInt * (Tl - Tb - shift) / (rv0 * Lh);
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
    let dr = hInt * (Tl - Tb - shift) / (rhov * Lh);
    let r1 = max(0.0, r + dr);
    var dV = 0.0;
    if (V <= PI * D * D * D / 6.0) { dV = 4.0 / 3.0 * PI * (r1 * r1 * r1 - r * r * r); }
    else if (V >= PI * D * D * D / 4.0) { dV = PI * D * (r1 * r1 - r * r); }
    else { dV = PI * D * D * hInt * (Tl - Tb - shift) / (rhov * Lh); }
    var Q = rhov * dV * Lh;
    /* Keine Zelle durch diesen Austausch über T_sat hinaus (oder darunter). */
    if (site >= 0) {
      let s = cu[U_SOLID * n + srcCell];
      let cap = solidRho(s) * solidCp(s) * P.vcell * max(0.0, cf[F_T * n + srcCell] - Tb);
      let used = -getF_at(A_BUDGET * n + srcCell);
      if (Q > 0.0) { Q = min(Q, max(0.0, cap - used)); }
      /* Und nicht mehr, als die Siedekurve durch die Wand lässt (kritische Wärmestromdichte; beim Mildern ein Zehntel). */
      if (Q > 0.0) { Q = takeF_at(A_CHF * n + srcCell, Q, P.chf * dx * D * dt); }
    } else {
      let avail = liqAvail(fp, B.x, B.y, B.r, ws);
      if (Q > 0.0) { Q = min(Q, max(0.0, avail)); } else { Q = max(Q, min(0.0, avail)); }
    }
    var dm = Q / Lh;
    if (dm < 0.0) { dm = max(dm, -B.mV); }
    /* Nur Wasser verdampft in die Blase und nimmt ihr Kondensat auf: frei mit dem Anteil des Wassers an der Spur. */
    var fw = 1.0;
    if (site < 0 && dm != 0.0) { fw = liqShare(fp, B.x, B.y, B.r, ws); dm *= fw; }
    if (dm != 0.0) {
      let hvb = hV(Tb);
      if (site >= 0) {
        let fc = sites[u32(site)].fluid;
        let acc = cf[F_ACC * n + fc];
        let fm = getF_at(A_FM * n + fc);
        if (dm > 0.0 && acc + fm - dm < 0.0) { dm = max(0.0, acc + fm); }
        let hbar = hbarC(fc);
        addF_at(A_FM * n + fc, -dm);
        addF_at(A_HSRC * n + srcCell, -dm * (hvb - hbar) / dt);
        addF_at(A_BUDGET * n + srcCell, -dm * (hvb - hbar));
      } else {
        if (fw > 0.0) { liqTake(fp, B.x, B.y, B.r, ws, fw, dm, hvb, Tl, dt); }
      }
      B.mV += dm;
      B.H += dm * hvb;
      grew += dm;
    }
    /* Neuer Zustand; die Enthalpie folgt T_b, die Differenz tauscht die Blase mit ihrer Umgebung. */
    let sh = solveBubble(B.mN, B.mO, B.mV, pressureAt(B.x, B.y), Tl, D, B.r, hostXY(B.x, B.y));
    B.r = sh.r; B.V = sh.V; B.pb = sh.pb; B.pv = sh.pv; B.Tb = sh.Tb;
    let Hn = bubEnthalpy(B.mN, B.mO, B.mV, B.Tb);
    let dH = Hn - B.H;
    if (dH != 0.0) {
      if (site >= 0) { B.H = Hn; addF_at(A_HSRC * n + sites[u32(site)].cell, -dH / dt); }
      else if (liqHeat(fp, B.x, B.y, r, -dH / dt)) { B.H = Hn; }
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
      /* Die Flüssigkeit um die Blase: nur Wasser — die mittlere Dichte (wie in M1), mit anderen Flüssigkeiten die der vorherrschenden. */
      let hb = hostC(cc);
      let rl = select(glob[G_RHOREF], rhoLM(hb, Tm), P.mixed != 0u);
      let ml = muLM(hb, Tm);
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
        let Eo = max(0.0, P.gy) * (rl - rv) * dd * dd / sigmaLM(hb, Tm);
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
        let Fx = -(Fdx + B.force[6]) * (h / dt);
        let Fy = -(Fdy + B.force[7]) * (h / dt);
        if (!(rr > dx && spreadRing(x, y, rr, Fx, Fy))) { spreadForce(x, y, Fx, Fy); }
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
}`}],Je=64,ke="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Zu=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,wc=`
fn ventUp(B: Bubble, frac: f32) -> bool {
  let n = P.n;
  var c = cellAt(B.x, min(P.boxh - 1e-6, B.y + B.r));
  for (var k = 0u; k < P.ny; k++) { if (kindOf(c) == GAS) { break; } if (c + P.nx < n) { c += P.nx; } else { c = NONE; break; } }
  if (c != NONE && kindOf(c) != GAS) { c = NONE; }
  if (c == NONE) {
    let i = u32(clamp(floor(B.x * P.invdx), 0.0, f32(P.nx - 1u)));
    for (var j = i32(P.ny) - 1; j >= 0; j--) { let q = i + u32(j) * P.nx; if (kindOf(q) == GAS) { c = q; break; } }
  }
  if (c == NONE) { return false; }
  let ci0 = ci(c);
  let cj0 = cj(c);
  let Vout = frac * B.V;
  var tot = 0.0;
  var count = 0u;
  var rings = 0;
  for (var ring = 0; ring <= 6; ring++) {
    if (count > 0u && tot >= 2.0 * Vout) { break; }
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
        let w = frac * max(1e-3 * P.vcell, cf[F_VGAS * n + q]) / tot;
        addF_at(A_DN * n + q, w * B.mN);
        addF_at(A_DO * n + q, w * B.mO);
        addF_at(A_DV * n + q, w * B.mV);
        addF_at(A_DH * n + q, w * B.H);
      }
    }
  }
  return true;
}
`,Ju=[{name:"bubTarget",wg:Je,bind:"P:u cnt:a bubs:r btarget:w",code:`${ke} {
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
}`},{name:"bubMerge",wg:Je,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${ke} {
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
}`},{name:"bubMergeFinal",wg:Je,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Rs}
${ke} {
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
  /* Wie BubbleModel.merge: bis zum nächsten Lösen das Volumen beider und der Radius dazu (α_b folgt höchstens mit ALPHA_RATE). */
  B.V = V;
  B.r = cbrtf(3.0 * V / (4.0 * PI));
  bubs[b] = B;
  for (var k = 0u; k < BACC_STRIDE; k++) { atomicStore(&bacc[o + k], 0u); }
}`},{name:"bubVent",wg:Je,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${Rs}
${Mi}
${wc}
${ke} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  var B = bubs[b];
  if (B.alive == 0u) { return; }
  let R = P.bubCap;
  if (B.r > R) {
    let D = P.depth;
    let Vcap = select(PI * R * R * D, 4.0 / 3.0 * PI * R * R * R, 2.0 * R <= D);
    if (B.V > Vcap) {
      let f = 1.0 - Vcap / B.V;
      if (ventUp(B, f)) {
        addF_cnt(C_BURSTVAP, f * B.mV);
        addF_cnt(C_VENTED, f * B.mV);
        B.mN *= 1.0 - f;
        B.mO *= 1.0 - f;
        B.mV *= 1.0 - f;
        B.H *= 1.0 - f;
        B.V = Vcap;
        B.r = R;
        bubs[b] = B;
      }
    }
  }
  maxU_cnt(C_RMAXB, B.r);
}`},{name:"bubFinish",wg:Je,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Rs}
${Mi}
${Zu}
${wc}
${ke} {
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
    /* Die Gaszellen über der Blase: so viele, wie ihr Volumen braucht (ventUp mit dem ganzen Inhalt); ohne erreichbares Gas bleibt sie. */
    if (!ventUp(B, 1.0)) { return; }
    addF_cnt(C_BURSTVAP, mv);
    if (burst) {
      atomicAdd(&cnt[C_BURST], 1u);
      if (cold) { atomicAdd(&cnt[C_BURST_COLD], 1u); } else { atomicAdd(&cnt[C_BURST_WARM], 1u); }
    }
  } else if (mv > 0.0) {
    /* Der Rest Dampf kondensiert in das Wasser der Spur (nach seinem Anteil; latente Wärme dort); ohne Wasser in der Spur wird er dort ein Wasserteilchen (spawnWater). */
    let fp = fpOf(B.x, B.y, B.r, B.V);
    let ws = liqFoot(fp, B.x, B.y, B.r).x;
    var fs = 0.0;
    if (ws > 0.0 && P.mixed != 0u) { fs = liqShare(fp, B.x, B.y, B.r, ws); }
    if (ws > 0.0) {
      for (var j = fp.j0; j <= fp.j1; j++) {
        for (var i = fp.i0; i <= fp.i1; i++) {
          let c = cellOf(i, j);
          if (kindOf(c) != LIQUID) { continue; }
          let w0 = fpW(fp, B.x, B.y, B.r, i, j);
          if (w0 <= 0.0) { continue; }
          var w = w0 / ws;
          if (fs > 0.0) { w *= shareW(c) / fs; }
          if (w == 0.0) { continue; }
          let hbar = hbarC(c);
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
${ke} {
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
}`},{name:"bubCopyBack",wg:Je,bind:"P:u cnt:a bubs:w bubs2:r",code:`${ke} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:Je,bind:"P:u cnt:a bubs:r at:a",code:`${Rs}
${ke} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${ke} {
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
}`}],Ce=128,de="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Li=`
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
  let cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_CRUST * n + c] * CP_CRYSTAL;
  let film = cf[F_FILM * n + c];
  let E = cf[F_ES * n + c];
  if (film <= 0.0) { cf[F_T * n + c] = T0 + E / cs; return; }
  var T = cf[F_T * n + c];
  if (!(T > 100.0)) { T = T0 + E / cs; }
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  cf[F_T * n + c] = T;
}
`,bc=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,pr=`
var<workgroup> rr: array<f32, ${16*Ce}>;
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
`,th=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:Ce,bind:"P:u cf:w cu:r at:w reg:r",code:`${Li}
${de} {
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
  /* Kristalle (M2b): Kruste der festen Zelle (ihre Enthalpie kommt über DES), Salz am Boden der Kiste je Spalte. */
  let dCr = at[A_DCRUST * n + c];
  if (dCr != 0.0) { cf[F_CRUST * n + c] += dCr; at[A_DCRUST * n + c] = 0.0; }
  let dFl = at[A_DFLOOR * n + c]; let dFh = at[A_DFLOORH * n + c];
  if (dFl != 0.0 || dFh != 0.0) { cf[F_FLOOR * n + c] += dFl; cf[F_FLOORH * n + c] += dFh; at[A_DFLOOR * n + c] = 0.0; at[A_DFLOORH * n + c] = 0.0; }
  let dFi = at[A_DFILM * n + c]; let dEs = at[A_DES * n + c];
  if (dFi != 0.0 || dEs != 0.0 || dCr != 0.0) {
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
}`})),{name:"transitions",wg:Ce,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${de} {
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
}`},{name:"regCells",wg:Ce,bind:"P:u cf:r cu:r racc:a",code:`${pr}
${de} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${pr}
${de} {
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
}`},{name:"regBubs",wg:Ce,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${de} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${bc}
${de} {
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
}`})),{name:"compSums",wg:Ce,bind:"P:u cf:r cu:r reg:r racc:a",code:`${pr}
${de} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${bc}
${de} {
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
}`})),{name:"compApply",wg:Ce,bind:"P:u cf:w cu:r reg:r",code:`${Li}
${de} {
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
}`},{name:"gasVolumes",wg:Ce,bind:"P:u cf:w cu:r reg:r",code:`${de} {
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
}`},{name:"markFaces",wg:Ce,bind:"P:u cu:r ff:w fu:w",code:`${de} {
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
}`}],gr=128,xr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",eh=`
/* Endgeschwindigkeit eines Tropfens der Flüssigkeit md in der Flüssigkeit hc (Schiller–Naumann mit Hadamard–Rybczynski, wie DropletDrift). */
fn dropDrift(q: Particle, dt: f32) -> f32 {
  let c = cellAt(q.x, q.y);
  let hc = min(u32(cf[F_DHOST * P.n + c]), NLIQ - 1u);
  let md = matOf(q.flags);
  if (md == hc || !(P.gy > 0.0)) { return 0.0; }
  let T = q.T;
  var rc = rhoLM(hc, T);
  /* In Sole: die Dichte des Wassers der Zelle (Masse durch Volumen seiner Teilchen; 0 in einer Zelle ohne Salz). */
  if (hc == 0u && cf[F_RHOW * P.n + c] > 0.0) { rc = cf[F_RHOW * P.n + c]; }
  let rd = q.rho;
  let muc = muLM(hc, T);
  let mud = muLM(md, T);
  let V = q.mass / rd;
  let d = pow(6.0 * V / PI, 1.0 / 3.0);
  let dr = abs(rc - rd);
  if (!(dr > 0.0)) { return 0.0; }
  let K = (2.0 * muc + 3.0 * mud) / (3.0 * muc + 3.0 * mud);
  var U = dr * P.gy * d * d / (18.0 * muc * K);
  for (var it = 0; it < 8; it++) {
    let Re = max(1e-9, rc * U * d / muc);
    let CD = 24.0 / Re * K * (1.0 + 0.15 * pow(Re, 0.687));
    U = sqrt(4.0 * dr * P.gy * d / (3.0 * rc * CD));
  }
  return select(-1.0, 1.0, rd < rc) * min(0.25 * P.dx, U * dt);
}
`,sh=[...["viscJacA","viscJacB"].map(o=>{const[t,e]=o==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:o,wg:gr,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${xr} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  if (fu[fui(FU_KNOWN, f)] != 1u) { ff[ffi(${e}, f)] = ff[ffi(${t}, f)]; return; }
  let nx = i32(P.nx);
  let ny = i32(P.ny);
  let dH = glob[G_RHOREF] * P.dx * P.dx / glob[G_DT];
  let e = ff[ffi(FF_ETA, f)];
  var diag = dH;
  var rhs = dH * ff[ffi(FF_U0, f)];
  let isU = f < P.nu;
  var i: i32;
  var j: i32;
  if (isU) { i = i32(f % (P.nx + 1u)); j = i32(f / (P.nx + 1u)); } else { let g = f - P.nu; i = i32(g % P.nx); j = i32(g / P.nx); }
  /* Nachbarn längs (a: dieselbe Komponente in ihrer Richtung) und quer (b). */
  for (var k = 0; k < 4; k++) {
    var ni = i;
    var nj = j;
    if (k == 0) { ni = i - 1; } else if (k == 1) { ni = i + 1; } else if (k == 2) { nj = j - 1; } else { nj = j + 1; }
    let along = (isU && k < 2) || (!isU && k >= 2);
    var inside: bool;
    var g: u32;
    if (isU) { inside = ni >= 0 && ni <= nx && nj >= 0 && nj < ny; } else { inside = ni >= 0 && ni < nx && nj >= 0 && nj <= ny; }
    if (!inside) {
      /* Kistenrand quer zur Komponente: an einer Wand haftet sie (2η); längs gibt es keinen Rand (die Randflächen selbst sind bekannt). */
      var open = false;
      if (k == 0) { open = P.openL != 0u; } else if (k == 1) { open = P.openR != 0u; } else if (k == 2) { open = P.openB != 0u; } else { open = P.openT != 0u; }
      if (!along && !open) { diag += 2.0 * e; }
      continue;
    }
    if (isU) { g = uF(ni, nj); } else { g = vF(ni, nj); }
    let kn = fu[fui(FU_KNOWN, g)];
    if (kn == 1u) { let a = hm(e, ff[ffi(FF_ETA, g)]); diag += a; rhs += a * ff[ffi(${t}, g)]; }
    else if (kn == 2u) { diag += select(2.0 * e, e, along); }
  }
  ff[ffi(${e}, f)] = rhs / diag;
}`}}),{name:"viscForce",wg:gr,bind:"P:u ff:w fu:r",code:`${xr} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:gr,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${xr} {
  let c = gid.x;
  if (c >= P.n) { return; }
  var mm: array<f32, NLIQ>;
  var mw = 0.0;
  var vw = 0.0;
  var salty = false;
  let st = cellStart(c);
  let cn = ccount[c];
  for (var k = 0u; k < cn; k++) {
    let q = parts[st + k];
    if ((q.flags & 1u) != 0u || !(q.mass > 0.0)) { continue; }
    mm[min(matOf(q.flags), NLIQ - 1u)] += q.mass;
    if (matOf(q.flags) == 0u) { mw += q.mass; vw += q.mass / q.rho; if (q.s > 0.0) { salty = true; } }
  }
  var host = 0u;
  for (var l = 1u; l < NLIQ; l++) { if (mm[l] > mm[host]) { host = l; } }
  cf[F_DHOST * P.n + c] = f32(host);
  cf[F_RHOW * P.n + c] = select(0.0, mw / vw, salty && vw > 0.0);
}`}],Fc=`const THETA_MIN: f32 = ${Dr.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,ei=128,ts=128,ee="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",te=`
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
`,_c=`
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
`,nh=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Ac=1,ih=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${ee} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Ac}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${ee} {
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
${ee} {
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
    pargs[0] = max(1u, (total + ${ei-1}u) / ${ei}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${ee} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:ts,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${te}
${nh}
${ee} {
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
  /* Die Summen dieses Schritts von vorn (Σ m c_p der Teilchen für eine Leistung in die Flüssigkeit wuchs sonst von Schritt zu Schritt). */
  if (c == 0u) { atomicStore(&cnt[C_TMAX], 0u); setF_cnt(C_SUM_WM, 0.0); setF_cnt(C_SUM_WMT, 0.0); setF_cnt(C_SUM_CL, 0.0); }
  let sm = wsum(ms, lid);
  let sv = wsum(vs, lid);
  if (lid == 0u) { addF_cnt(C_SUM_M, sm); addF_cnt(C_SUM_V, sv); }
}`},{name:"classify",wg:ts,bind:"P:u cf:r cu:w",code:`${ee} {
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
}`},{name:"p2g",wg:ts,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${_c}
${ee} {
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
  var eta = 0.0;
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
        var qeta = 0.0;
        if (P.mixed != 0u) { qeta = muLM(matOf(parts[pk].flags), parts[pk].T); }
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
              eta += wm * qeta;
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
              eta += wm * qeta;
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
  var du = 0.0;
  if (m > empty) {
    du = dt * force / (rhoRef * P.vcell);
    if (!isU) { du -= dt * P.gy * (rv / m); }
    u = mom / m;
    /* Ohne andere Flüssigkeit gleich mit den Kräften; mit ihr erst nach dem zähen Schritt (viscForce, wie liquid.ts). */
    if (P.mixed == 0u) { u += du; }
  }
  if (P.mixed != 0u) {
    ff[ffi(FF_ETA, f)] = select(0.0, eta / m, m > empty);
    ff[ffi(FF_VF, f)] = du;
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
  if (P.mixed != 0u) { ff[ffi(FF_U0, f)] = u; }
  fu[fui(FU_KNOWN, f)] = known;
}`},{name:"liqAssemble",wg:ts,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Fc}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${ee} {
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
}`},{name:"liqPressure",wg:ts,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${ee} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:ts,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Fc}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${ee} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:ts,bind:"P:u ff:w fu:w",code:`${ee} {
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
}`})),{name:"g2p",wg:ei,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w",code:`${_c}
${te}
/* Keine flüssige Zelle in ±2 Zellen um (x, y): ein Tropfen in der Luft. */
fn stranded(x: f32, y: f32) -> bool {
  let c = cellAt(x, y);
  if (cu[U_KIND * P.n + c] == LIQUID) { return false; }
  let i0 = ci(c);
  let j0 = cj(c);
  for (var b = -2; b <= 2; b++) {
    for (var a = -2; a <= 2; a++) {
      let ii = i0 + a;
      let jj = j0 + b;
      if (inGrid(ii, jj) && cu[U_KIND * P.n + cellOf(ii, jj)] == LIQUID) { return false; }
    }
  }
  return true;
}
${eh}
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
${ee} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var speed = 0.0;
  var escM = 0.0;
  var escE = 0.0;
  var escO = 0.0;
  var escS = 0.0;
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
    /* Ein Tropfen fern jeder Flüssigkeit fliegt für sich: seine eigene Geschwindigkeit mit der Schwerkraft, keine Drehung. */
    let fly = stranded(x, y);
    if (fly) { u = q.vx; v = q.vy - P.gy * dt; cu0 = 0.0; cu1 = 0.0; cv0 = 0.0; cv1 = 0.0; }
    q.vx = u; q.vy = v;
    q.c00 = k4 * cu0; q.c01 = k4 * cu1; q.c10 = k4 * cv0; q.c11 = k4 * cv1;
    speed = sqrt(u * u + v * v);
    /* Die Rechenwache (extremes.ts): kein Teilchen schneller als P.vmax (20 m/s, beim Mildern 1,5); Δt richtet sich weiter nach dem Gitter. */
    var held = speed;
    if (speed > P.vmax) { let f = P.vmax / speed; q.vx *= f; q.vy *= f; held = P.vmax; atomicAdd(&cnt[C_SLOWED], 1u); }
    maxU_cnt(C_VMAXP, held);
    /* RK2 im Gitterfeld (ein fliegender Tropfen geradeaus). */
    var nxp = x + dt * q.vx;
    var nyp = y + dt * q.vy;
    if (!fly) {
      let v0 = velL(x, y);
      let vm = velL(x + 0.5 * dt * v0.x, y + 0.5 * dt * v0.y);
      nxp = x + dt * vm.x;
      nyp = y + dt * vm.y;
      if (P.mixed != 0u) { nyp += dropDrift(q, dt); }
    }
    if ((nxp < 0.0 && P.openL != 0u) || (nxp > P.boxw && P.openR != 0u) || (nyp < 0.0 && P.openB != 0u) || (nyp > P.boxh && P.openT != 0u)) {
      /* Entwichen: Wasser und andere Flüssigkeiten getrennt (die Energie aller). */
      if (matOf(q.flags) == 0u) { escM = q.mass - q.s; } else { escO = q.mass - q.s; }
      escS = q.s;
      escE = q.mass * q.h;
      q.flags = q.flags | ${Ac}u;
    } else {
      let mg = 1e-4 * dx;
      /* Ein fliegender Tropfen an einer Wand der Kiste bleibt dort (seine Geschwindigkeit in die Wand fällt weg). */
      if (fly && (nxp < mg || nxp > P.boxw - mg)) { q.vx = 0.0; }
      if (fly && (nyp < mg || nyp > P.boxh - mg)) { q.vy = 0.0; }
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
  let eo = wsum(escO, lid);
  let es = wsum(escS, lid);
  if (lid == 0u) {
    maxU_cnt(C_UMAXL, vmax);
    if (em != 0.0) { addF_cnt(C_ESC_WATER, em); }
    if (eo != 0.0) { addF_cnt(C_ESC_OTHER, eo); }
    if (es != 0.0) { addF_cnt(C_ESC_SALT, es); }
    if (ee != 0.0) { addF_cnt(C_ESC_ENERGY, ee); }
  }
}`},{name:"heatWeights",wg:ei,bind:"P:u cnt:a cu:r parts:w",code:`${te}
${ee} {
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
    /* Mittlere und höchste Temperatur des Wassers (wie Engine.waterTemperature). */
    if (matOf(q.flags) == 0u && (q.flags & 1u) == 0u) {
      m = q.mass;
      mt = q.mass * q.T;
      tmax = q.T;
    }
  }
  let sm = wsum(m, lid);
  let st = wsum(mt, lid);
  let tx = wmax(tmax, lid);
  if (lid == 0u) { addF_cnt(C_SUM_WM, sm); addF_cnt(C_SUM_WMT, st); maxU_cnt(C_TMAX, tx); }
}`}],Se=128,Me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Tc=`
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
`,Pc=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,kc=`
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
`,rh=[{name:"gasMaxOut",wg:Se,bind:"P:u cu:r ff:r cnt:a",code:`${te}
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
}`},{name:"gasFlux",wg:Se,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Tc}
${Pc}
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
}`},{name:"gasMove",wg:Se,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Tc}
${Pc}
${te}
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
}`},{name:"macFwd",wg:Se,bind:"P:u glob:r ff:w fu:r",code:`${kc}
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
}`},{name:"macBack",wg:Se,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${kc}
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
}`},{name:"viscosity",wg:Se,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Me} {
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
}`},{name:"gasAssemble",wg:Se,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Me} {
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
}`},{name:"gasPressure",wg:Se,bind:"P:u cf:w cu:r cgv:r",code:`${Me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:Se,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Me} {
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
}`}],Ve=128,Ne="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",_e=`
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
`,xo=`
fn depositSalt(px: f32, py: f32, x: f32, H: f32) {
  if (!(x > 0.0)) { return; }
  let n = P.n;
  let o = U_SOLID * n;
  let i = i32(clamp(floor(px * P.invdx), 0.0, f32(P.nx - 1u)));
  let j = i32(clamp(floor(py * P.invdx), 0.0, f32(P.ny - 1u)));
  let c0 = cellOf(i, j);
  var tgt = NONE;
  if (cu[o + c0] != 0u) { tgt = c0; }
  else if (j > 0 && cu[o + c0 - P.nx] != 0u) { tgt = c0 - P.nx; }
  else if (i > 0 && cu[o + c0 - 1u] != 0u) { tgt = c0 - 1u; }
  else if (i + 1 < i32(P.nx) && cu[o + c0 + 1u] != 0u) { tgt = c0 + 1u; }
  else if (j + 1 < i32(P.ny) && cu[o + c0 + P.nx] != 0u) { tgt = c0 + P.nx; }
  else {
    for (var jj = j - 2; jj >= 0; jj--) {
      let c = cellOf(i, jj);
      if (cu[o + c] != 0u) { tgt = c; break; }
    }
  }
  if (tgt != NONE) { addF_at(A_DCRUST * n + tgt, x); addF_at(A_DES * n + tgt, H); return; }
  if (P.openB != 0u) { addF_cnt(C_ESC_SALT, x); addF_cnt(C_ESC_ENERGY, H); return; }
  addF_at(A_DFLOOR * n + u32(i), x);
  addF_at(A_DFLOORH * n + u32(i), H);
}
`,oh=`
fn ysat(T: f32, p: f32, c: u32) -> f32 { return ysatA(T, p, c, 1.0); }
/* Über einer Lösung mit der Aktivität aw des Wassers (M2b). */
fn ysatA(T: f32, p: f32, c: u32, aw: f32) -> f32 {
  let x = min(0.999, aw * pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,ch=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:Ve,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${_e}
${Ne} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  var Cl = 0.0;
  var CT = 0.0;
  var acc = 0.0;
  var accH = 0.0;
  var accS = 0.0;
  var accM: array<f32, NLIQ>;
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
        let mat = matOf(parts[pk].flags);
        let s = parts[pk].s;
        let Cp = m * pCp(mat, T, s, m);
        Cl += w * Cp;
        CT += w * Cp * T;
        /* Nur Wasser verdampft und kondensiert: alles, was Masse zwischen Flüssigkeit und Dampf bewegt, liest acc und accH — in Lösungen nur das Wasser, mit h̄_w. */
        if (mat == 0u) {
          var hw = parts[pk].h;
          if (s > 0.0) { hw = hWaterIn(T, s / m); accS += w * s; }
          acc += w * (m - s);
          accH += w * (m - s) * hw;
        }
        accM[min(mat, NLIQ - 1u)] += w * m;
      }
    }
  }
  cf[F_PCL * n + c] = Cl;
  cf[F_PTL * n + c] = select(cf[F_T * n + c], CT / Cl, Cl > 0.0);
  cf[F_ACC * n + c] = acc;
  cf[F_ACCH * n + c] = accH;
  var all = 0.0;
  var host = 0u;
  for (var l = 0u; l < NLIQ; l++) { all += accM[l]; if (accM[l] > accM[host]) { host = l; } }
  cf[F_ACCALL * n + c] = all;
  cf[F_HOST * n + c] = f32(host);
  /* Salz (M2b): die Molalität des Wassers der Zelle und seine Aktivität bei T_l. */
  cf[F_ACCS * n + c] = accS;
  var mol = 0.0;
  if (accS > 0.0 && acc > 0.0) { mol = accS / (acc * S_MS); }
  cf[F_MOL * n + c] = mol;
  cf[F_AW * n + c] = select(1.0, waterAct(cf[F_PTL * n + c], mol), mol > 0.0);
  setF_at(A_FM * n + c, 0.0);
  setF_at(A_FE * n + c, 0.0);
  ${t?`setF_at(A_CHF * n + c, 0.0);
  if (cu[U_KIND * n + c] == LIQUID) {
    let pc = max(0.5 * P.pref, P.pref + cf[F_PL * n + c]);
    let Tw = tSat(pc);
    /* Sole siedet bei T_b(p, m) (die Grenzfläche einer Blase steht um ΔT_b über ihrem Dampf). */
    var Ts = Tw;
    if (mol > 0.0) { Ts = boilPt(pc, mol); }
    cf[F_TSAT * n + c] = Ts;
    cf[F_DTB * n + c] = Ts - Tw;
    setF_at(A_BUDGET * n + c, Cl * (cf[F_PTL * n + c] - Ts));
  } else { cf[F_TSAT * n + c] = 0.0; cf[F_DTB * n + c] = 0.0; setF_at(A_BUDGET * n + c, 0.0); }`:""}
}`})),{name:"applyMass",wg:Ve,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${_e}
${te}
${xo}
${Ne} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var made = 0.0;
  if (p < count) {
    var q = parts[p];
    if (alive(q) && matOf(q.flags) == 0u) {
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
        if (fm != 0.0 && acc > 0.0) { d += fm * w * (q.mass - q.s) / acc; }
      }
      let nominal = glob[G_RHOREF] * P.vcell / 4.0;
      if (d != 0.0 && q.s > 0.0) {
        /* Mit Salz (wie Phase.applySalty): das Wasser trägt h̄_w; bleibt kaum Wasser, wird der Rest Dampf über dem Teilchen und das Salz Kruste. */
        let s = q.s;
        let m0 = q.mass;
        let H = m0 * q.h + d * hWaterIn(q.T, s / m0);
        let mw1 = m0 - s + d;
        var dry = false;
        if (mw1 < MIN_MASS * nominal) {
          let c0 = cellAt(q.x, q.y);
          var gc = c0;
          for (var k = 0u; k < P.ny; k++) { if (cu[U_KIND * n + gc] == GAS) { break; } if (gc + P.nx < n) { gc += P.nx; } else { gc = NONE; break; } }
          if (gc != NONE && cu[U_KIND * n + gc] != GAS) { gc = NONE; }
          if (gc != NONE || !(mw1 > 0.0)) {
            dry = true;
            let T = q.T;
            let Hs = s * hCrys(T);
            depositSalt(q.x, q.y, s, Hs);
            var mv = 0.0;
            if (gc != NONE && mw1 > 0.0) { mv = mw1; addF_at(A_DV * n + gc, mv); addF_at(A_DH * n + gc, mv * hV(T)); made = mv; }
            addF_at(A_HSRC * n + c0, -(mv * hV(T) + Hs - H) / glob[G_DT]);
            q.flags = q.flags | 1u;
            q.mass = 0.0;
            q.s = 0.0;
          }
        }
        if (!dry) {
          let before = m0 / q.rho;
          q.mass = m0 + d;
          q.h = H / q.mass;
          pDerive(&q);
          q.dvp += q.mass / q.rho - before;
        }
        parts[p] = q;
      } else if (d != 0.0) {
        let before = q.mass / q.rho;
        let m = q.mass + d;
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
}`},{name:"diffPrep",wg:Ve,bind:"P:u cf:w cu:w reg:r",code:`${Ne} {
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
}`},{name:"diffAssemble",wg:Ve,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${oh}
${Ne} {
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
          yb = ysatA(cf[F_PTL * n + nb], p, c, cf[F_AW * n + nb]);
          var fw = 1.0;
          if (P.mixed != 0u) { let all = cf[F_ACCALL * n + nb]; fw = select(1.0, (cf[F_ACC * n + nb] + cf[F_ACCS * n + nb]) / all, all > 0.0); }
          /* Ohne Wasserteilchen in der Zelle (nur ihr Platz ist flüssig) verdunstet nichts — sonst entstünde Dampf aus nichts (wie die CPU). */
          if (!(cf[F_ACC * n + nb] > 0.0)) { fw = 0.0; }
          G = half * (1.0 - Y) * fw;
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
}`},{name:"diffFaces",wg:Ve,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Ne} {
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
}`},{name:"diffOut",wg:Ve,bind:"P:u cf:w cu:r ff:r",code:`${Ne} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  var sc = 1.0;
  if (cu[U_KIND * n + c] == GAS) {
    let i = ci(c);
    let j = cj(c);
    /* Links und unten ist c die Zelle b (sie gibt ab, wenn dV > 0), rechts und oben die Zelle a (wenn dV < 0). */
    let out = max(ff[ffi(FF_DV, uF(i, j))], 0.0) + max(ff[ffi(FF_DV, vF(i, j))], 0.0) + max(-ff[ffi(FF_DV, uF(i + 1, j))], 0.0) + max(-ff[ffi(FF_DV, vF(i, j + 1))], 0.0);
    let mv = cf[F_MV * n + c];
    if (out > mv && out > 0.0) { sc = mv / out; }
  }
  cf[F_SCALE * n + c] = sc;
}`},{name:"diffApply",wg:Ve,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${te}
${Ne} {
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
    /* Flächen: links und unten ist c die Zelle b, rechts und oben die Zelle a; je Fläche der Faktor ihrer abgebenden Zelle (diffOut). */
    let fl = uF(i, j); let fr = uF(i + 1, j); let fb = vF(i, j); let ft = vF(i, j + 1);
    var sr = 0.0; var st = 0.0; var sl = 0.0; var sb = 0.0;
    if (i + 1 < i32(P.nx)) { sr = select(cf[F_SCALE * n + c + 1u], cf[F_SCALE * n + c], ff[ffi(FF_DV, fr)] < 0.0); }
    if (j + 1 < i32(P.ny)) { st = select(cf[F_SCALE * n + c + P.nx], cf[F_SCALE * n + c], ff[ffi(FF_DV, ft)] < 0.0); }
    if (i > 0) { sl = select(cf[F_SCALE * n + c], cf[F_SCALE * n + c - 1u], ff[ffi(FF_DV, fl)] < 0.0); }
    if (j > 0) { sb = select(cf[F_SCALE * n + c], cf[F_SCALE * n + c - P.nx], ff[ffi(FF_DV, fb)] < 0.0); }
    mV += sr * ff[ffi(FF_DV, fr)] + st * ff[ffi(FF_DV, ft)] - sl * ff[ffi(FF_DV, fl)] - sb * ff[ffi(FF_DV, fb)];
    mN += sr * ff[ffi(FF_DN, fr)] + st * ff[ffi(FF_DN, ft)] - sl * ff[ffi(FF_DN, fl)] - sb * ff[ffi(FF_DN, fb)];
    mO += sr * ff[ffi(FF_DO, fr)] + st * ff[ffi(FF_DO, ft)] - sl * ff[ffi(FF_DO, fl)] - sb * ff[ffi(FF_DO, fb)];
    H += sr * ff[ffi(FF_DH, fr)] + st * ff[ffi(FF_DH, ft)] - sl * ff[ffi(FF_DH, fl)] - sb * ff[ffi(FF_DH, fb)];
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
}`},{name:"latentSrc",wg:Ve,bind:"P:u glob:r cf:r at:a",code:`${Ne} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],Sc=[.125,.75,.125];function ah(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),a=Uint8Array.from(t.kind),c=new Uint8Array(e),l=new Uint8Array(e),f=new Uint32Array(e),u=new Float64Array(e),h=new Float64Array(e),m=Float32Array.from(t.T),p=o.heat.heaters.map(()=>0),d=new Float64Array(Math.max(1,o.regions.count)),g=o.bodies.list,v=new Uint8Array(e);for(let A=0;A<e;A+=1)t.owner[A]!==0&&t.matB[A]!==0&&(t.solid[A]!==0||t.fs[A]>.5)&&(v[A]=1);const w=(A,b)=>{if(v[A]!==0||v[b]!==0)return;const P=t.owner[A]!==0&&t.matB[A]!==0?t.fs[A]:-1,M=t.owner[b]!==0&&t.matB[b]!==0?t.fs[b]:-1;P<0&&M<0||(v[M>P?b:A]=1)};for(let A=0;A<n;A+=1)for(let b=1;b<s;b+=1)t.au[b+A*(s+1)]<=0&&w(b-1+A*s,b+A*s);for(let A=1;A<n;A+=1)for(let b=0;b<s;b+=1)t.av[b+A*s]<=0&&w(b+(A-1)*s,b+A*s);for(let A=0;A<e;A+=1){if(c[A]=t.solid[A],l[A]=t.kind[A],f[A]=t.role[A]===1&&t.heater[A]>=0?t.heater[A]+1:0,u[A]=t.Es[A],h[A]=t.film[A],v[A]===0)continue;const b=t.owner[A],P=t.solid[A]!==0,M=g[b-1],k=t.matB[A]-1,S=ut[k];if(r[A]=1,!P){const C=o.regions.id[A];C>=0&&(d[C]+=(1-t.fs[A])*t.vCell)}c[A]=k+1,l[A]=ft;const O=t.Ts[A]>0?t.Ts[A]:uo(t.Es[A],t.capB[A],t.film[A],t.crust[A],t.T[A]);u[A]=(S.rho*S.cp*t.vCell+t.crust[A]*bs)*(O-et)+t.film[A]*Ft(O),m[A]=O,M!==void 0&&M.heater>=0&&M.heater<p.length&&(f[A]=M.heater+1,p[M.heater]+=1)}for(let A=0;A<e;A+=1)r[A]===0&&f[A]>0&&f[A]<=p.length&&(p[f[A]-1]+=1);const x=(A,b)=>A<0?t.openL?0:1:A>=s?t.openR?0:1:b<0?t.openB?0:1:b>=n?t.openT?0:1:c[A+b*s]!==0?1:0,_=new Float32Array(e),F=new Float32Array(e);for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const P=b+A*s;if(c[P]!==0){_[P]=1;continue}let M=0;for(let k=-1;k<=1;k+=1)for(let S=-1;S<=1;S+=1)M+=Sc[S+1]*Sc[k+1]*x(b+S,A+k);_[P]=M}const T=4;for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const P=b+A*s,M=c[P]!==0,k=(b+.5)*i,S=(A+.5)*i;let O=T*i;M||(t.openL||(O=Math.min(O,k)),t.openR||(O=Math.min(O,t.w-k)),t.openB||(O=Math.min(O,S)),t.openT||(O=Math.min(O,t.h-S)));for(let C=-T;C<=T;C+=1){const I=A+C;if(!(I<0||I>=n))for(let j=-T;j<=T;j+=1){const D=b+j;if(D<0||D>=s||c[D+I*s]!==0===M)continue;const E=Math.max(0,Math.abs(j)-.5)*i,V=Math.max(0,Math.abs(C)-.5)*i;O=Math.min(O,Math.hypot(E,V))}}F[P]=M?-O:O}return{body:r,kindCpu:a,solid:c,kind:l,hgrp:f,es:u,film:h,T:m,phiS:_,sdf:F,heaterCells:p,vFix:d}}function lh(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=ut[t.solid[n]-1],r=uo(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],e.crust[n],e.T[n]);e.Es[n]=Or(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const js=800,fh=24,Mc=6,Vt=4,Ns=16,Kt=256,Lc=`struct Levels { lv: array<Level, ${Ns}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Sn=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,li=`${Sn}
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
`,Oe=`
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
`,es=`
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
`,Cc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Oc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Tt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ue=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,za=6,Ss=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,vr=`
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
`,yr="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",uh=[{name:"cgPrep1",wg:Kt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Sn}
${Tt} {
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
}`},{name:"cgPrep2",wg:Kt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Ue}
${li}
${Tt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${za}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
${Tt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:Kt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Ue}
${vr}
${Ss}
${Tt} {
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
}`},{name:"cclProject",wg:Kt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ue}
${yr}
${Ss}
${Tt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Kt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Ue}
${Sn}
${es}
${Tt} {
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
}`},{name:"cgFoldInitMG",wg:Kt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${es}
${Oc}
${Tt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Ue}
${Oe}
${es}
${Cc}
${Tt} {
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
}`},{name:"cgB",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Ue}
${Oe}
${es}
${Cc}
var<workgroup> wpq: f32;
${Tt} {
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
}`},{name:"cgFoldRR",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Oe}
${es}
${Oc}
${Tt} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Oe}
${es}
${Tt} {
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
}`},{name:"cgZSum",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Oe}
${vr}
${Ss}
${Tt} {
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
}`},{name:"cgZSub",wg:Kt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Oe}
${yr}
${Ss}
${es}
${Tt} {
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
}`},{name:"cgEnd1",wg:Kt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Ue}
${vr}
${Ss}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${Tt} {
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
}`},{name:"cgEnd2",wg:Kt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ue}
${yr}
${Ss}
${Tt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],hh=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function dh(o,t){const e=[];let s=0,n=0,i=o,r=t,a=1,c=0;for(;;){const f=i+2,u=(i+2)*(r+2),h={};for(const d of hh)h[d]=s,s+=u;const m=n;n+=u;let p=0;if(h.pW=0,e.length>0&&(h.pW=s,s+=4*c,p=n,n+=4*c),e.push({nx:i,ny:r,stride:f,size:u,h:a,f:h,act:m,pIdx:p}),i*r<=fh||i<=2&&r<=2||e.length>=Ns)break;c=u,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let f=0;f<e.length;f+=1){let u=0;for(let h=f;h<e.length;h+=1)u+=e[h].size;if(u<=js){l=f;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function si(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const Qa={tol:1e-5,it:W.IT_L,cap:W.CAP_L,res:W.RES_L},Xa={tol:1e-5,it:W.IT_G,cap:W.CAP_G,res:W.RES_G},Ya={tol:1e-5,it:W.IT_H,cap:W.CAP_H,res:W.RES_H},Za={tol:1e-5,it:W.IT_D,cap:W.CAP_D,res:W.RES_H},Ms=200,me=256;class mh{constructor(t,e,s){y(this,"ctx");y(this,"plan");y(this,"b");y(this,"l0");y(this,"lp");y(this,"lv");y(this,"it");y(this,"cfg");y(this,"kinds",[]);y(this,"groups",new Map);y(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);si(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(me/4*n.length);for(let l=0;l<n.length;l+=1)si(l>0?n[l-1]:null,l-1,r,me/4*l),si(n[l],l,r,me/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*Ns+4);for(let l=0;l<n.length;l+=1)si(n[l],l,a,32*l);a[32*Ns]=e.lt,a[32*Ns+1]=n.length,this.lv=t.uniform("lv",a.buffer);const c=new Uint32Array(me/4*(Ms+1));for(let l=0;l<Ms;l+=1)c[me/4*l]=l;c[me/4*Ms]=4294967295,this.it=t.uniform("iter",c.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(me*4));for(const l of[Qa,Xa,Ya,Za])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,me*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,me*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:me*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,me)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,f)=>{const u={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,f,u),this.run(t,"cgZSub",r,f,u)):this.run(t,"cgRZ",r,f,u)};this.vcycle(t),a(Ms,`k${Ms}`);const c=Math.min(Ms,Math.max(1,s));for(let l=0;l<c;l+=1){const f={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,f),this.run(t,"cgB",r,`k${l}`,f),this.one(t,"cgFoldRR",`k${l}`,f),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Us=16,qc=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class ph{constructor(t,e){y(this,"stair",null);y(this,"ctx");y(this,"d");y(this,"plan");y(this,"params");y(this,"glob");y(this,"cnt");y(this,"cf");y(this,"cu");y(this,"at");y(this,"ff");y(this,"fu");y(this,"af");y(this,"partsA");y(this,"partsB");y(this,"ccountA");y(this,"ccountB");y(this,"cstart");y(this,"bsum");y(this,"pkey");y(this,"pslot");y(this,"pargs");y(this,"bubs");y(this,"bubs2");y(this,"bacc");y(this,"btarget");y(this,"sites");y(this,"sbub");y(this,"reg");y(this,"racc");y(this,"heat");y(this,"hacc");y(this,"mgF");y(this,"mgU");y(this,"cgv");y(this,"cgs");y(this,"lab");y(this,"cfl");y(this,"csum");y(this,"cgp");y(this,"meas");y(this,"probe");y(this,"regionMap",new Int32Array(0));y(this,"regionInv",new Int32Array(0));y(this,"measGroups");y(this,"nsites",0);y(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=dh(s.nx,s.ny);const r=(c,l,f=qc)=>{const u=t.buffer(c,4*Math.max(4,l),f);return this.own.push(u),u};this.params=r("params",gc,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Vs),this.cnt=r("cnt",fs),this.cf=r("cf",ar*i.n),this.cu=r("cu",lr*i.n),this.at=r("at",fr*i.n),this.ff=r("ff",ur*i.nf),this.fu=r("fu",pc*i.nf),this.af=r("af",hr*i.nf),this.partsA=r("partsA",Ts*i.pcap),this.partsB=r("partsB",Ts*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,qc|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Ps*i.bcap),this.bubs2=r("bubs2",Ps*i.bcap),this.bacc=r("bacc",Gr*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",mr*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Fe*i.nreg),this.racc=r("racc",Nr*i.nreg),this.heat=r("heat",ge*i.nheat),this.hacc=r("hacc",Ur*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",Ua),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",za*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",Us*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*gc),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[ot],t.ambientY[ct],t.ambientY[X],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let c=0;for(let f=0;f<t.regions.count;f+=1)t.regions.open[f]===0&&(c=1);i[40]=c,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=t.particles.hasOther()?1:0;const l=i0(t.scene.extremes,t.regions.pAmb,Math.abs(t.gy));r.set([l.chf,l.actMax,l.vmax,l.bubCap],44),this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(ge*this.d.nheat);s.forEach((i,r)=>{var c;const a=ge*r;n[a+Ht.MODE]=i.mode==="thermostat"?1:0,n[a+Ht.POWER]=i.power,n[a+Ht.TARGET]=i.target,n[a+Ht.ON]=i.on?1:0,n[a+Ht.P]=i.P,n[a+Ht.TMEAN]=i.Tmean,n[a+Ht.INTEGRAL]=i.integral,n[a+Ht.CELLS]=e!==null?e[r]??0:((c=this.stair)==null?void 0:c.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*ge*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n,r=ah(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r.heaterCells);const a=t.regions,c=Array.from({length:a.count},(q,$)=>$).sort((q,$)=>a.vFluid[$]-a.vFluid[q]);this.regionMap=new Int32Array(Math.max(1,a.count)),this.regionInv=new Int32Array(Math.max(1,a.count)),c.forEach((q,$)=>{this.regionMap[q]=$,this.regionInv[$]=q});const l=new Float32Array(Fe*s.nreg);for(let q=0;q<a.count;q+=1){const $=Fe*this.regionMap[q];l[$+Qt.OPEN]=a.open[q],l[$+Qt.VFLUID]=a.vFluid[q]-r.vFix[q],l[$+Qt.P0]=a.p0[q],l[$+Qt.RHOBAR]=a.rhoBar[q],l[$+Qt.VLIQ]=a.vLiq[q],l[$+Qt.VBUB]=a.vBub[q],l[$+Qt.VGAS]=a.vGas[q],l[$+Qt.P0START]=a.p0[q]}e.writeBuffer(this.reg,0,l);const f=new Uint32Array(lr*i);for(let q=0;q<i;q+=1){f[is.KIND*i+q]=r.kind[q],f[is.KPREV*i+q]=r.kind[q],f[is.SOLID*i+q]=r.solid[q],f[is.HGRP*i+q]=r.hgrp[q];const $=a.id[q];f[is.RID*i+q]=$<0?dr:this.regionMap[$]}e.writeBuffer(this.cu,0,f);const u=new Float32Array(ar*i),h=(q,$,U=0)=>{for(let H=0;H<i;H+=1)u[q*i+H]=$[U+H]};h(st.PHI,n.phi),h(st.ALPHA,n.alpha),h(st.ALPHAOLD,n.alpha),h(st.PL,n.pl),h(st.PG,n.pg),h(st.MN,n.mg,ot*i),h(st.MO,n.mg,ct*i),h(st.MV,n.mg,X*i),h(st.MF,n.mfog),h(st.HG,n.Hg),h(st.ES,r.es),h(st.FILM,r.film),h(st.T,r.T),h(st.TL,n.Tl),h(st.CL,n.Cl);const m=t.gas;h(st.VGAS,m.vgas),h(st.RHO,m.rho),h(st.NMOL,m.nmol),h(st.CAP,m.cap),h(st.MU,m.mu),h(st.VEOS,m.veos),h(st.SRCV,m.srcV),h(st.VEOSMID,m.veosMid),h(st.PHIS,r.phiS),h(st.SDF,r.sdf),h(st.PTL,r.T),h(st.CRUST,n.crust);for(let q=0;q<n.nx;q+=1)u[st.FLOOR*i+q]=t.salt.floor[q],u[st.FLOORH*i+q]=t.salt.floorH[q];u.fill(1,st.AW*i,(st.AW+1)*i),e.writeBuffer(this.cf,0,u);const p=new Float32Array(fr*i);for(let q=0;q<i;q+=1)p[Hr.VOLSRC*i+q]=t.liquid.volSrc[q];e.writeBuffer(this.at,0,p);const d=s.nf,g=new Float32Array(ur*d);for(let q=0;q<s.nu;q+=1)g[Le.UL*d+q]=n.ul[q],g[Le.UG*d+q]=n.ug[q];for(let q=0;q<s.nv;q+=1)g[Le.UL*d+s.nu+q]=n.vl[q],g[Le.UG*d+s.nu+q]=n.vg[q];e.writeBuffer(this.ff,0,g),e.writeBuffer(this.fu,0,new Uint32Array(pc*d));const v=new Float32Array(hr*d);for(let q=0;q<s.nu;q+=1)v[q]=t.liquid.fU[q];for(let q=0;q<s.nv;q+=1)v[s.nu+q]=t.liquid.fV[q];e.writeBuffer(this.af,0,v);const w=t.particles,x=t.liquid,_=new ArrayBuffer(4*Ts*Math.max(1,w.count)),F=new Float32Array(_),T=new Uint32Array(_),A=new Int32Array(_);for(let q=0;q<w.count;q+=1){const $=Ts*q;F.set([w.x[q],w.y[q],w.vx[q],w.vy[q],w.c00[q],w.c01[q],w.c10[q],w.c11[q],w.mass[q],w.h[q],w.T[q],w.rho[q],x.dVp[q]],$),T[$+13]=(w.mat[q]&255)<<8,T[$+14]=w.id[q],A[$+15]=x.bi[q],A[$+16]=x.bj[q];for(let U=0;U<9;U+=1)F[$+17+U]=x.wt[9*q+U];F[$+26]=w.smass[2*q]}w.count>0&&e.writeBuffer(this.partsA,0,_);const b=t.bubbles,P=t.bubbleModel.motionState,M=new ArrayBuffer(4*Ps*Math.max(1,b.count)),k=new Float32Array(M),S=new Uint32Array(M),O=new Int32Array(M);for(let q=0;q<b.count;q+=1){const $=Ps*q,U=q*at;k.set([b.x[q],b.y[q],b.z[q],b.vx[q],b.vy[q],b.m[U+ot],b.m[U+ct],b.m[U+X],b.H[q],b.age[q]],$),O[$+10]=b.site[q],k.set([b.r[q],b.V[q],b.pb[q],b.pv[q],b.Tb[q],b.dmdt[q],P.ux0[q],P.uy0[q]],$+11),S[$+19]=b.id[q],S[$+20]=1;for(let H=0;H<oe;H+=1)k[$+21+H]=b.force[q*oe+H]}b.count>0&&e.writeBuffer(this.bubs,0,M);const C=t.bubbleModel.cavities;this.nsites=C.count;const I=new ArrayBuffer(4*mr*s.nsites),j=new Uint32Array(I),D=new Float32Array(I),E=n.nx;for(let q=0;q<C.count;q+=1){const $=mr*q;let U=C.cell[q],H=C.r[q];if(U>=0&&r.solid[U]===0){const nt=C.dir[q],pt=nt===0?U+1:nt===1?U-1:nt===2?U+E:U-E;pt>=0&&pt<i&&r.solid[pt]!==0?U=pt:H=1e-9}j.set([U,C.fluid[q],C.dir[q],0],$),D.set([H,C.s[q],C.z[q],0],$+4)}e.writeBuffer(this.sites,0,I);const V=new Uint32Array(s.nsites);for(let q=0;q<C.count;q+=1)V[q]=C.bubble[q];e.writeBuffer(this.sbub,0,V);const z=new Float32Array(Vs);z[Is.DT]=t.dt,z[Is.TIME]=t.time,z[Is.RHOREF]=x.rhoRef,e.writeBuffer(this.glob,0,z);const N=new Uint32Array(fs),Z=new Float32Array(N.buffer);N[W.PCOUNT]=w.count,N[W.PSORT]=w.count,N[W.BCOUNT]=b.count,N[W.NEXTID_B]=Math.max(1,b.nextFree),N[W.NEXTID_P]=Math.max(1,w.nextFree);const tt=t.bubbleModel;N[W.WATCH]=tt.watch>=0?tt.watch:dr,N[W.WATCH_FATE]=tt.watchFate,tt.firstSuperheat!==null&&(Z[W.FIRST_SH]=tt.firstSuperheat+1e3,N[W.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,N),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(Gr*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Nr*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Ur*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(f=>Math.ceil(f.size/4)*4),n=s.reduce((f,u)=>f+u,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((f,u)=>{s[u]>0&&r.copyBufferToBuffer(f.buf,f.offset,i,a,s[u]),a+=s[u]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const c=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const f of s)l.push(c.slice(a,a+f)),a+=f;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,c,l,f,u,h,m]=await this.read([{buf:this.cnt,offset:0,size:4*fs},{buf:this.glob,offset:0,size:4*Vs},{buf:this.cf,offset:0,size:4*ar*s},{buf:this.cu,offset:0,size:4*lr*s},{buf:this.at,offset:0,size:4*fr*s},{buf:this.ff,offset:0,size:4*ur*e.nf},{buf:this.af,offset:0,size:4*hr*e.nf},{buf:this.heat,offset:0,size:4*ge*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Fe*e.nreg}]),p=new Uint32Array(n),d=Math.min(e.pcap,p[W.PCOUNT]),g=Math.min(e.bcap,p[W.BCOUNT]),[v,w]=await this.read([{buf:this.partsA,offset:0,size:4*Ts*Math.max(1,d)},{buf:this.bubs,offset:0,size:4*Ps*Math.max(1,g)}]),x=t.grid,_=new Float32Array(r),F=(L,R,B=0)=>{for(let Y=0;Y<s;Y+=1)R[B+Y]=_[L*s+Y]};F(st.PHI,x.phi),F(st.ALPHA,x.alpha),F(st.PL,x.pl),F(st.PG,x.pg),F(st.MN,x.mg,ot*s),F(st.MO,x.mg,ct*s),F(st.MV,x.mg,X*s),F(st.MF,x.mfog),F(st.HG,x.Hg),F(st.ES,x.Es),F(st.FILM,x.film),F(st.T,x.T),F(st.TL,x.Tl),F(st.CL,x.Cl);const T=t.gas;F(st.VGAS,T.vgas),F(st.RHO,T.rho),F(st.NMOL,T.nmol),F(st.CAP,T.cap),F(st.MU,T.mu),F(st.VEOS,T.veos),F(st.SRCV,T.srcV),F(st.VEOSMID,T.veosMid),F(st.CRUST,x.crust);for(let L=0;L<x.nx;L+=1)t.salt.floor[L]=_[st.FLOOR*s+L],t.salt.floorH[L]=_[st.FLOORH*s+L];const A=new Uint32Array(a);for(let L=0;L<s;L+=1)x.kind[L]=A[is.KIND*s+L];const b=new Float32Array(c);for(let L=0;L<s;L+=1)t.liquid.volSrc[L]=b[Hr.VOLSRC*s+L];const P=new Float32Array(l),M=new Float32Array(f),k=e.nf;for(let L=0;L<e.nu;L+=1)x.ul[L]=P[Le.UL*k+L],x.ug[L]=P[Le.UG*k+L],t.liquid.fU[L]=M[L];for(let L=0;L<e.nv;L+=1)x.vl[L]=P[Le.UL*k+e.nu+L],x.vg[L]=P[Le.UG*k+e.nu+L],t.liquid.fV[L]=M[e.nu+L];const S=t.particles,O=t.liquid,C=new Float32Array(v),I=new Uint32Array(v),j=new Int32Array(v);let D=0,E=0;for(let L=0;L<d;L+=1){const R=Ts*L;if(I[R+13]&1||!(C[R+8]>0))continue;const B=D;D+=1,S.x[B]=C[R],S.y[B]=C[R+1],S.vx[B]=C[R+2],S.vy[B]=C[R+3],S.c00[B]=C[R+4],S.c01[B]=C[R+5],S.c10[B]=C[R+6],S.c11[B]=C[R+7],S.mass[B]=C[R+8],S.h[B]=C[R+9];const Y=C[R+26]>0?C[R+26]:0;S.spc[2*B]=Y>0?Ni:0,S.spc[2*B+1]=0,S.smass[2*B]=Y,S.smass[2*B+1]=0,S.mat[B]=I[R+13]>>>8&255,S.id[B]=I[R+14],S.id[B]>E&&(E=S.id[B]),O.dVp[B]=C[R+12],O.bi[B]=j[R+15],O.bj[B]=j[R+16];for(let K=0;K<9;K+=1)O.wt[9*B+K]=C[R+17+K];S.derive(B)}S.count=D,S.reserveIds(Math.max(p[W.NEXTID_P],E+1)),O.weightsDirty=!0;const V=t.bubbles,z=t.bubbleModel.motionState,N=new Float32Array(w),Z=new Uint32Array(w),tt=new Int32Array(w);V.count=0;let q=0;for(let L=0;L<g;L+=1){const R=Ps*L;if(Z[R+20]===0)continue;const B=V.count;V.count+=1;const Y=B*at;V.x[B]=N[R],V.y[B]=N[R+1],V.z[B]=N[R+2],V.vx[B]=N[R+3],V.vy[B]=N[R+4];for(let K=0;K<at;K+=1)V.m[Y+K]=0;V.m[Y+ot]=N[R+5],V.m[Y+ct]=N[R+6],V.m[Y+X]=N[R+7],V.H[B]=N[R+8],V.age[B]=N[R+9],V.site[B]=tt[R+10],V.r[B]=N[R+11],V.V[B]=N[R+12],V.pb[B]=N[R+13],V.pv[B]=N[R+14],V.Tb[B]=N[R+15],V.dmdt[B]=N[R+16],z.ux0[B]=N[R+17],z.uy0[B]=N[R+18],V.id[B]=Z[R+19],V.id[B]>q&&(q=V.id[B]);for(let K=0;K<oe;K+=1)V.force[B*oe+K]=N[R+21+K]}V.reserveIds(Math.max(p[W.NEXTID_B],q+1));const $=t.bubbleModel.cavities,U=new Uint32Array(h);for(let L=0;L<$.count;L+=1)$.bubble[L]=U[L];const H=new Float32Array(m);for(let L=0;L<t.regions.count;L+=1){const R=Fe*this.regionMap[L];t.regions.p0[L]=H[R+Qt.P0],t.regions.rhoBar[L]=H[R+Qt.RHOBAR]}const nt=new Float32Array(u);t.heat.heaters.forEach((L,R)=>{const B=ge*R;L.P=nt[B+Ht.P],L.Tmean=nt[B+Ht.TMEAN],L.integral=nt[B+Ht.INTEGRAL]});const pt=new Float32Array(i);t.dt=pt[Is.DT];const wt=t.bubbleModel;wt.watch=p[W.WATCH]===dr?-1:p[W.WATCH],lh(t,this.stair)}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const He=128,zt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",gh=5,jc=30,Bc=`
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
`,xh=[{name:"heaterSums",wg:He,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
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
        let kp = power / ${gh}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${jc}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${jc}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:He,bind:"P:u cnt:a parts:r",code:`${te}
${zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:He,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${_e}
${te}
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
    /* Andere Flüssigkeiten: ihr Anteil an der Leitfähigkeit der Zelle (nach Wärmekapazität gewichtet, wie heat.ts). */
    var Co = 0.0;
    var CKo = 0.0;
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
          let mt = matOf(parts[pk].flags);
          let Cp = parts[pk].mass * pCp(mt, T, parts[pk].s, parts[pk].mass);
          Cl += w * Cp;
          CTl += w * Cp * T;
          if (mt != 0u) { Co += w * Cp; CKo += w * Cp * kLM(mt, T); }
        }
      }
    }
    let s = cu[U_SOLID * n + c];
    let T = cf[F_T * n + c];
    var cs = 0.0;
    var kc = 0.0;
    if (s != 0u) { cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_FILM * n + c] * cpL(T) + cf[F_CRUST * n + c] * CP_CRYSTAL; kc = solidK(s); }
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
        if (Cl >= cg) { kc = select(kL(Ts), ((Cl - Co) * kL(Ts) + CKo) / Cl, Co > 0.0); } else { kc = kMix(cf[F_MN * n + c], cf[F_MO * n + c], cf[F_MV * n + c], Ts); }
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
}`},{name:"heatAssemble",wg:He,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Bc}
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
}`},{name:"heatFlux",wg:He,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Bc}
${Li}
${te}
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
}`},{name:"heatParts",wg:He,bind:"P:u cnt:a cf:r parts:w",code:`${_e}
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
  { q.h += pCp(matOf(q.flags), q.T, q.s, q.mass) * dT; pDerive(&q); }
  q.dvp += q.mass / q.rho - before;
  parts[p] = q;
}`},{name:"heatShare",wg:He,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${_e}
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
    let mt = matOf(parts[pk].flags);
    let cp = pCp(mt, T, parts[pk].s, parts[pk].mass);
    let Cp = parts[pk].mass * cp;
    C += Cp;
    CT += Cp * T;
    CA += Cp * kLM(mt, T) / (parts[pk].rho * cp);
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
    { q.h += pCp(matOf(q.flags), q.T, q.s, q.mass) * dT; pDerive(&q); }
    q.dvp += q.mass / q.rho - before;
    parts[pk] = q;
  }
}`},{name:"pwParts",wg:He,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${zt} {
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
  pDerive(&q);
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
}`},{name:"measCells",wg:256,bind:"P:u cf:r cu:r meas:w probe:w",code:`var<workgroup> red: array<f32, ${11*256}>;
${zt} {
  let c = gid.x;
  let lid = lid3.x;
  if (c == 0u) { probe[31] = 0.0; }
  var v = array<f32, 11>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  let n = P.n;
  if (c < n) {
    let k = cu[U_KIND * n + c];
    if (c < P.nx) { v[9] = cf[F_FLOOR * n + c]; v[10] = cf[F_FLOORH * n + c]; }
    v[8] = cf[F_CRUST * n + c];
    if (k == SOLID || cu[U_SOLID * n + c] != 0u) { v[0] = cf[F_ES * n + c]; v[1] = cf[F_FILM * n + c]; }
    else {
      v[2] = cf[F_HG * n + c];
      v[3] = cf[F_MV * n + c];
      v[4] = cf[F_MF * n + c];
      v[5] = cf[F_MN * n + c] + cf[F_MO * n + c];
      if (k == LIQUID) { v[6] = 1.0; } else { v[7] = 1.0; }
    }
  }
  for (var q = 0u; q < 11u; q++) { red[q * 256u + lid] = v[q]; }
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var q = 0u; q < 11u; q++) { red[q * 256u + lid] += red[q * 256u + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 11u) { meas[wid3.x * ${Us}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = vec4<f32>(0.0);
  var o = vec2<f32>(0.0);
  var salt = 0.0;
  if (p < count) {
    let q = parts[p];
    if ((q.flags & 1u) == 0u && q.mass > 0.0) {
      /* 0: Enthalpie aller Teilchen, 1–3: Wasser (Masse ohne Salz, m T, fühlbare Wärme über T_sat), 4–5: andere Flüssigkeiten (Masse, m T), 6: Salz. */
      salt = q.s;
      if (matOf(q.flags) == 0u) { v = vec4<f32>(q.mass * q.h, q.mass - q.s, q.mass * q.T, q.mass * (q.h - hL(P.tsatAmb))); }
      else { v = vec4<f32>(q.mass * q.h, 0.0, 0.0, 0.0); o = vec2<f32>(q.mass, q.mass * q.T); }
    }
  }
  for (var k = 0u; k < 4u; k++) { red[k * 256u + lid] = v[k]; }
  red[4u * 256u + lid] = o.x;
  red[5u * 256u + lid] = o.y;
  red[6u * 256u + lid] = salt;
  workgroupBarrier();
  for (var s = 128u; s > 0u; s >>= 1u) {
    if (lid < s) { for (var k = 0u; k < 7u; k++) { red[k * 256u + lid] += red[k * 256u + lid + s]; } }
    workgroupBarrier();
  }
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Us}u + lid] = red[lid * 256u]; }
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Us}u + lid] = red[lid * 256u]; }
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
}`}],Ls=256,vh=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:Ls,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${li}
${Tt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Ls,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${li}
${Tt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Ls,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Lc}
${li}
${Tt} {
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
}`},{name:"mgPost",wg:Ls,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Sn}
${Oe}
const TILE: u32 = 16u;
const HALO: u32 = ${Vt}u;
const TS: u32 = ${16+2*Vt}u;
var<workgroup> sx: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Vt)**2}>;
${Tt} {
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
}`},{name:"mgPreR",wg:Ls,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Sn}
${Oe}
const TILE: u32 = 12u;
const HALO: u32 = ${Vt+2}u;
const TS: u32 = ${12+2*(Vt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Vt+2))**2}>;
${Tt} {
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
}`},{name:"mgTail",wg:Ls,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Lc}
${Oe}
var<workgroup> tx: array<f32, ${js}>;
var<workgroup> tb: array<f32, ${js}>;
var<workgroup> tax: array<f32, ${js}>;
var<workgroup> tay: array<f32, ${js}>;
var<workgroup> tinv: array<f32, ${js}>;
var<workgroup> toff: array<u32, ${Ns}>;
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
${Tt} {
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
  for (var k = 0u; k < ${Mc}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Mc}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],ss=128,ns="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",yh=[{name:"flashTs",wg:ss,bind:"P:u cf:w cu:r reg:r",code:`${ns} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let o = U_KIND * n;
  var ts = 0.0;
  /* Tröpfchen in einer Gaszelle (eine dünne Schicht, ein Spritzer): über T_sat verdampfen auch sie (wie flash.ts). */
  if (cu[o + c] == GAS && cf[F_PCL * n + c] > 0.0) {
    let pc = pAt(c);
    let mol = cf[F_MOL * n + c];
    var T = tSat(pc);
    if (mol > 0.0) { T = boilPt(pc, mol); }
    if (cf[F_PTL * n + c] > T) { ts = T; }
  }
  if (cu[o + c] == LIQUID) {
    let i = ci(c);
    let j = cj(c);
    let surface = (j + 1 < i32(P.ny) && cu[o + c + P.nx] == GAS) || (i > 0 && cu[o + c - 1u] == GAS) || (i + 1 < i32(P.nx) && cu[o + c + 1u] == GAS) || (j > 0 && cu[o + c - P.nx] == GAS);
    if (surface) {
      let pc = pAt(c);
      let mol = cf[F_MOL * n + c];
      var T = tSat(pc);
      if (mol > 0.0) { T = boilPt(pc, mol); }
      if (cf[F_PTL * n + c] > T) { ts = T; }
    }
  }
  cf[F_TS * n + c] = ts;
}`},{name:"flashVap",wg:ss,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${_e}
${ns} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let ts = cf[F_TS * n + c];
  var vap = 0.0;
  var vapH = 0.0;
  if (ts > 0.0) {
    let hl = hL(ts);
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
          if (matOf(parts[pk].flags) != 0u) { continue; }
          let s = parts[pk].s;
          var hs = hl;
          var hw = hl;
          if (s > 0.0) { let ws = s / parts[pk].mass; hs = hSol(ts, ws); hw = hWaterIn(ts, ws); }
          if (h <= hs) { continue; }
          let w = wtAtI(pk, i, j);
          if (w == 0.0 || !aliveI(pk)) { continue; }
          let dmv = w * parts[pk].mass * (h - hs) / (hv - hw);
          vap += dmv;
          vapH += dmv * hv;
        }
      }
    }
  }
  cf[F_VAP * n + c] = vap;
  cf[F_VAPH * n + c] = vapH;
}`},{name:"flashParts",wg:ss,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${_e}
${te}
${xo}
${ns} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var made = 0.0;
  if (p < count) { made = flashOne(p); }
  let sm = wsum(made, lid);
  if (lid == 0u && sm != 0.0) { addF_cnt(C_PRODUCED, sm); }
}
/* Ein Teilchen: bis T_sat jeder Zelle verdampfen (flashVap bucht denselben Dampf); liefert den Dampf, den es darüber hinaus beim ganzen Verdampfen gibt. */
fn flashOne(p: u32) -> f32 {
  var q = parts[p];
  if (!alive(q) || matOf(q.flags) != 0u) { return 0.0; }
  let n = P.n;
  var lost = 0.0;
  var lostE = 0.0;
  var mc = NONE;
  var mw = 0.0;
  let ws = q.s / q.mass;
  for (var k = 0; k < 9; k++) {
    let w = q.wt[k];
    if (w == 0.0) { continue; }
    let i = q.bi + k % 3;
    let j = q.bj + k / 3;
    if (!inGrid(i, j)) { continue; }
    let ts = cf[F_TS * n + cellOf(i, j)];
    if (ts == 0.0) { continue; }
    var hs = hL(ts);
    var hw = hs;
    if (q.s > 0.0) { hs = hSol(ts, ws); hw = hWaterIn(ts, ws); }
    if (q.h <= hs) { continue; }
    let hv = hV(ts);
    let dmv = w * q.mass * (q.h - hs) / (hv - hw);
    lost += dmv;
    lostE += dmv * hv;
    if (w > mw) { mw = w; mc = cellOf(i, j); }
  }
  if (lost == 0.0) { return 0.0; }
  let water = q.mass - q.s;
  if (water - lost < MIN_MASS * glob[G_RHOREF] * P.vcell / 4.0) {
    /* Kaum Wasser bliebe: der Rest wird Dampf bei T_sat der Hauptzelle über ihr, das Salz Kruste; was die Energie des Teilchens darüber hinaus hatte oder zu wenig hatte, gibt oder nimmt die Zelle (wie flash.ts). */
    var gc = mc;
    for (var k = 0u; k < P.ny; k++) { if (cu[U_KIND * n + gc] == GAS) { break; } if (gc + P.nx < n) { gc += P.nx; } else { gc = NONE; break; } }
    if (gc != NONE && cu[U_KIND * n + gc] == GAS) {
      let Tm = cf[F_TS * n + mc];
      let hv = hV(Tm);
      let rem = water - lost;
      let Hs = q.s * hCrys(Tm);
      addF_at(A_DV * n + gc, rem);
      addF_at(A_DH * n + gc, rem * hv);
      if (q.s > 0.0) { depositSalt(q.x, q.y, q.s, Hs); }
      addF_at(A_HSRC * n + mc, -(lostE + rem * hv + Hs - q.mass * q.h) / glob[G_DT]);
      q.flags = q.flags | 1u;
      q.mass = 0.0;
      q.s = 0.0;
      parts[p] = q;
      return rem;
    }
  }
  let half = 0.5 * water;
  if (lost > half) { lostE *= half / lost; lost = half; }
  let before = q.mass / q.rho;
  let m = q.mass - lost;
  q.h = (q.mass * q.h - lostE) / m;
  q.mass = m;
  pDerive(&q);
  q.dvp += m / q.rho - before;
  parts[p] = q;
  return 0.0;
}`},{name:"flashDist",wg:ss,bind:"P:u cnt:a cf:r cu:r at:a",code:`${te}
${ns} {
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
    if (cu[o + c] == GAS) {
      addF_at(A_DV * n + c, vap);
      addF_at(A_DH * n + c, vapH);
    } else if (j + 1 < i32(P.ny) && cu[o + c + P.nx] == GAS) {
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
}`},{name:"fog",wg:ss,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Li}
${te}
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
${ns} {
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
}`},{name:"spawnWater",wg:ss,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ns} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  if (!(fm > 0.0) || cf[F_ACC * n + c] > 0.0) { return; }
  let p = atomicAdd(&cnt[C_PCOUNT], 1u);
  if (p >= P.pcap) { atomicSub(&cnt[C_PCOUNT], 1u); atomicAdd(&cnt[C_PFULL], 1u); return; }
  let x = (f32(ci(c)) + 0.5) * P.dx;
  let y = (f32(cj(c)) + 0.5) * P.dx;
  var q: Particle;
  q.x = x; q.y = y; q.vx = 0.0; q.vy = 0.0; q.c00 = 0.0; q.c01 = 0.0; q.c10 = 0.0; q.c11 = 0.0;
  q.mass = fm; q.h = hL(cf[F_PTL * n + c]); q.T = tFromHL(q.h); q.rho = rhoL(q.T); q.flags = 0u;
  q.dvp = fm / q.rho;
  q.id = atomicAdd(&cnt[C_NEXTID_P], 1u);
  q.bi = i32(floor(x * P.invdx - 1.0));
  q.bj = i32(floor(y * P.invdx - 1.0));
  for (var k = 0; k < 9; k++) { q.wt[k] = 0.0; }
  q.wt[4] = 1.0;
  parts[p] = q;
  setF_at(A_FM * n + c, 0.0);
}`},{name:"films",wg:ss,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${ns} {
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
}`}],wr=128,br="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",wh=`
const STIR_FLOOR: f32 = 0.02;
fn lambertW(x: f32) -> f32 {
  if (!(x > 1e-8)) { return max(x, 0.0); }
  let l = log(1.0 + x);
  var w = select(l * (1.0 - log(1.0 + l) / (2.0 + l)), x * (1.0 - x / (1.0 + x)), x < 1.0);
  for (var k = 0; k < 4; k++) {
    let ew = exp(w);
    let fw = w * ew - x;
    w -= fw / (ew * (w + 1.0) - (w + 2.0) * fw / (2.0 * w + 2.0));
  }
  return w;
}
fn stirFactor(lambda: f32, tau: f32) -> f32 {
  let x = 2.0 * max(0.0, lambda - STIR_FLOOR) * tau;
  if (x > 1e-6) { return x / lambertW(x); }
  return 1.0;
}
fn ucS(a: i32, b: i32) -> f32 { let o = FF_UL * P.nf; return 0.5 * (ff[o + uF(a, b)] + ff[o + uF(a + 1, b)]); }
fn vcS(a: i32, b: i32) -> f32 { let o = FF_UL * P.nf; return 0.5 * (ff[o + vF(a, b)] + ff[o + vF(a, b + 1)]); }
fn strainAt(i: i32, j: i32) -> f32 {
  let o = FF_UL * P.nf;
  let dx = P.dx;
  let dudx = (ff[o + uF(i + 1, j)] - ff[o + uF(i, j)]) / dx;
  let dvdy = (ff[o + vF(i, j + 1)] - ff[o + vF(i, j)]) / dx;
  let jm = max(0, j - 1);
  let jp = min(i32(P.ny) - 1, j + 1);
  let im = max(0, i - 1);
  let ip = min(i32(P.nx) - 1, i + 1);
  var dudy = 0.0;
  var dvdx = 0.0;
  if (jp > jm) { dudy = (ucS(i, jp) - ucS(i, jm)) / (f32(jp - jm) * dx); }
  if (ip > im) { dvdx = (vcS(ip, j) - vcS(im, j)) / (f32(ip - im) * dx); }
  return length(vec2<f32>(0.5 * (dudx - dvdy), 0.5 * (dudy + dvdx)));
}
`,bh=`
fn fick(a: u32, b: u32, r: f32) -> vec2<f32> {
  let n = P.n;
  let Wa = cf[F_XW * n + a];
  let Wb = cf[F_XW * n + b];
  let Sa = cf[F_XS * n + a];
  let Sb = cf[F_XS * n + b];
  let ba = Sa / Wa;
  let bb = Sb / Wb;
  if (ba == bb) { return vec2<f32>(0.0); }
  let Ta = cf[F_XT * n + a];
  let Tb = cf[F_XT * n + b];
  let m = saltDiff(0.5 * (Ta + Tb)) * r * min(Wa, Wb) * abs(ba - bb);
  if (ba > bb) { return vec2<f32>(-m, -m * hSaltIn(Ta, Sa / (Sa + Wa))); }
  return vec2<f32>(m, m * hSaltIn(Tb, Sb / (Sb + Wb)));
}
`,Fh=[{name:"saltCryst",wg:wr,bind:"P:u cnt:a cu:r at:a parts:w",code:`${_e}
${te}
${xo}
${br} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var made = 0.0;
  if (p < count) {
    var q = parts[p];
    if (alive(q) && q.s > 0.0) {
      let m = q.mass;
      let ws = satFrac(q.T);
      if (q.s > ws * m * 1.000001) {
        let x = (q.s - ws * m) / (1.0 - ws);
        let Hx = x * hCrys(q.T);
        let before = m / q.rho;
        let H = m * q.h - Hx;
        q.mass = m - x;
        q.s = q.s - x;
        q.h = H / q.mass;
        pDerive(&q);
        q.dvp += q.mass / q.rho - before;
        parts[p] = q;
        depositSalt(q.x, q.y, x, Hx);
        made = x;
      }
    }
  }
  let sm = wsum(made, lid);
  if (lid == 0u && sm != 0.0) { addF_cnt(C_CRYST, sm); }
}`},{name:"saltSums",wg:wr,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${_e}
${br} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let ok = U_KIND * n;
  let kind = cu[ok + c];
  var on = kind == LIQUID;
  if (kind == GAS) {
    let i = ci(c);
    let j = cj(c);
    on = (i > 0 && cu[ok + c - 1u] == LIQUID) || (i + 1 < i32(P.nx) && cu[ok + c + 1u] == LIQUID)
      || (j > 0 && cu[ok + c - P.nx] == LIQUID) || (j + 1 < i32(P.ny) && cu[ok + c + P.nx] == LIQUID);
  }
  var C = 0.0;
  var CT = 0.0;
  var salt = 0.0;
  var water = 0.0;
  if (on) {
    let st = cellStart(c);
    let cn = ccount[c];
    for (var k = 0u; k < cn; k++) {
      let pk = st + k;
      if (!aliveI(pk)) { continue; }
      let m = parts[pk].mass;
      let s = parts[pk].s;
      let T = parts[pk].T;
      let mt = matOf(parts[pk].flags);
      let Cp = m * pCp(mt, T, s, m);
      C += Cp;
      CT += Cp * T;
      if (mt == 0u) { salt += s; water += m - s; }
    }
  }
  cf[F_XON * n + c] = select(0.0, 1.0, on && C > 0.0);
  cf[F_XS * n + c] = salt;
  cf[F_XW * n + c] = water;
  cf[F_XT * n + c] = select(cf[F_T * n + c], CT / C, C > 0.0);
}`},{name:"saltShare",wg:wr,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${_e}
${wh}
${bh}
${br} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cf[F_XON * n + c] == 0.0) { return; }
  let water = cf[F_XW * n + c];
  if (!(water > 0.0)) { return; }
  let salt = cf[F_XS * n + c];
  let dt = glob[G_DT];
  let i = ci(c);
  let j = cj(c);
  let r = dt * P.invdx * P.invdx;
  var inS = 0.0;
  var inH = 0.0;
  for (var k = 0u; k < 4u; k++) {
    var b = NONE;
    if (k == 0u && i > 0) { b = c - 1u; }
    else if (k == 1u && i + 1 < i32(P.nx)) { b = c + 1u; }
    else if (k == 2u && j > 0) { b = c - P.nx; }
    else if (k == 3u && j + 1 < i32(P.ny)) { b = c + P.nx; }
    if (b == NONE || cf[F_XON * n + b] == 0.0 || !(cf[F_XW * n + b] > 0.0)) { continue; }
    var v = vec2<f32>(0.0);
    if (c < b) { v = fick(c, b, r); } else { v = -fick(b, c, r); }
    inS += v.x;
    inH += v.y;
  }
  var fS = 0.0;
  if (salt > 0.0) {
    let kk = PI * PI * r;
    let D = saltDiff(cf[F_XT * n + c]);
    fS = 1.0 - exp(-kk * D * stirFactor(strainAt(i, j), dt / (kk * D)));
  }
  if (fS == 0.0 && inS == 0.0 && inH == 0.0) { return; }
  let st = cellStart(c);
  let cn = ccount[c];
  let bw = salt / water;
  var outS = 0.0;
  var outH = 0.0;
  if (fS > 0.0) {
    for (var k = 0u; k < cn; k++) {
      let pk = st + k;
      if (!aliveI(pk) || matOf(parts[pk].flags) != 0u) { continue; }
      let m = parts[pk].mass;
      let s = parts[pk].s;
      let d = fS * (bw * (m - s) - s);
      if (d < 0.0) { outS -= d; outH -= d * hSaltIn(parts[pk].T, s / m); }
    }
  }
  for (var k = 0u; k < cn; k++) {
    let pk = st + k;
    if (!aliveI(pk) || matOf(parts[pk].flags) != 0u) { continue; }
    var q = parts[pk];
    let m0 = q.mass;
    let s = q.s;
    var d = 0.0;
    var dH = 0.0;
    if (fS > 0.0) {
      d = fS * (bw * (m0 - s) - s);
      if (d < 0.0) { dH = d * hSaltIn(q.T, s / m0); }
      else if (d > 0.0) { if (outS > 0.0) { dH = d * outH / outS; } else { d = 0.0; } }
    }
    if (inS != 0.0 || inH != 0.0) {
      var wgt = (m0 - s) / water;
      if (inS < 0.0) { wgt = select(0.0, s / salt, salt > 0.0); }
      d += inS * wgt;
      dH += inH * wgt;
    }
    if (d == 0.0 && dH == 0.0) { continue; }
    let H = m0 * q.h + dH;
    let before = m0 / q.rho;
    q.mass = m0 + d;
    q.s = max(0.0, s + d);
    q.h = H / q.mass;
    pDerive(&q);
    q.dvp += q.mass / q.rho - before;
    parts[pk] = q;
  }
}`}],ni=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Mn(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const xe=[0,120],vo=.3;ut.map(o=>Mn(o.color));var Gc;Mn(((Gc=io[0])==null?void 0:Gc.color)??"#f4f3ee");const Cs=128,Os="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",_h=.006,Ah={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},Th=4*1e3*15e-7/(3*2*.07),yo=`
const VIR = array<vec3<f32>, ${ni.length}>(${ni.map(o=>`vec3<f32>(${Q(o[0]/255)}, ${Q(o[1]/255)}, ${Q(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${Q(ni.length-1)};
  let i = min(u32(floor(x)), ${ni.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Fr="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var $c;const Ph=[{name:"rScale",wg:Cs,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Fr}
var<workgroup> m4: array<vec4<f32>, WG>;
${Os} {
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
}`},{name:"rCells",wg:Cs,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Fr}
${yo}
const SOLID_RGB = array<vec3<f32>, ${ut.length}>(${ut.map(o=>{const t=Mn(o.color);return`vec3<f32>(${Q(t[0]/255)}, ${Q(t[1]/255)}, ${Q(t[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${Mn((($c=io[0])==null?void 0:$c.color)??"#f4f3ee").map(o=>Q(o/255)).join(", ")});
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${Q(Wl)} * P.dx * P.depth) / P.dx)); }
${Os} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${Q(xe[0])};
  let tspan = ${Q(xe[1]-xe[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${ut.length}u) - 1u];
    let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
    cell = vec4<f32>(rgb.x + (0.902 - rgb.x) * glow, rgb.y * (1.0 - 0.6 * glow), rgb.z * (1.0 - 0.8 * glow), 1.0);
    let cr = crustCover(cf[F_CRUST * n + c]);
    if (cr > 0.0) { cell = vec4<f32>(mix(cell.rgb, CRYSTAL_RGB, cr), 1.0); }
    if (ov == 1u) { cell = vec4<f32>(viridis((T - T0 - tmin) / tspan), 1.0); }
    else if (ov == 6u) { cell = vec4<f32>(0.353, 0.353, 0.353, 1.0); }
  } else if (ov == 6u) {
    if (k == LIQUID) { cell = vec4<f32>(0.239, 0.561, 0.847, 0.784); } else { cell = vec4<f32>(0.922, 0.922, 0.922, 0.471); }
    if (cf[F_ALPHA * n + c] > 0.02) { cell = vec4<f32>(0.98, 0.784, 0.314, 0.863); }
  } else if (k == GAS) {
    /* Salz am Boden der Kiste (wo unter der Lösung kein Feststoff lag): die unterste Zelle seiner Spalte. */
    if (j == 0) { let fc = crustCover(cf[F_FLOOR * n + c]); if (fc > 0.0) { cell = vec4<f32>(CRYSTAL_RGB, fc); } }
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
      var af = min(0.95, 1.0 - exp(-fog / ${Q(Th)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Cs,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${Os} {
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
  var wo = 0.0;
  var wsl = 0.0;
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
        if (((parts[pk].flags >> 8u) & 255u) != 0u) { wo += vp; }
        wsl += vp * parts[pk].s / m;
      }
    }
  }
  lq[4u * t] = w;
  lq[4u * t + 1u] = wt;
  lq[4u * t + 2u] = wo;
  lq[4u * t + 3u] = wsl;
}`},{name:"rLiqBlurX",wg:Cs,bind:"P:u lq:r lq2:w",code:`${Os} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:Cs,bind:"P:u lq2:r liquid:t",code:`${Os} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let J = t / lx;
  let b = select(t, t - lx, J > 0u);
  let u = select(t, t + lx, J + 1u < ly);
  let w = 0.25 * lq2[4u * b] + 0.5 * lq2[4u * t] + 0.25 * lq2[4u * u];
  let wt = 0.25 * lq2[4u * b + 1u] + 0.5 * lq2[4u * t + 1u] + 0.25 * lq2[4u * u + 1u];
  let wo = 0.25 * lq2[4u * b + 2u] + 0.5 * lq2[4u * t + 2u] + 0.25 * lq2[4u * u + 2u];
  let wsl = 0.25 * lq2[4u * b + 3u] + 0.5 * lq2[4u * t + 3u] + 0.25 * lq2[4u * u + 3u];
  var temp = 0.0;
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${Q(xe[0])}) / ${Q(xe[1]-xe[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${Q(vo)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:Cs,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Fr}
${Os} {
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
}`}],Vn=`
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
`;var Wc;const _r=`${Vn}
${yo}
const OIL_RGB = vec3<f32>(${Mn(((Wc=Jt[1])==null?void 0:Wc.color)??"#e3b437").map(o=>Q(o)).join(", ")});
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
  /* R.tint: 0 die Farbe der Flüssigkeit, 1 Temperatur (Kanal G), 2 Salzgehalt (Kanal A) — über die Farbskala. */
  var rgb = mix(mix(R.water.rgb, OIL_RGB, c.b), viridis(select(c.g, c.a, R.tint > 1.5)), select(0.0, 1.0, R.tint > 0.5));
  let edge = 1.0 - smoothstep(0.0, 0.12, abs(cover - 0.5));
  rgb *= 1.0 - 0.25 * edge;
  let alpha = 0.82 * a;
  return vec4<f32>(rgb * alpha, alpha);
}
`,kh=`${Vn}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Sh=`${Vn}
${(po.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${W.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,Mh=`${Vn}
${yo}
${(po.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${W.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${Q(273.15+xe[0])}) / ${Q(xe[1]-xe[0])}, 0.0, 1.0);
  if (R.tint > 1.5) { o.t = clamp(parts[p].s / max(1e-30, parts[p].mass) / ${Q(vo)}, 0.0, 1.0); }
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Lh=`${Vn}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Ic=48,Ar=256,Ch=12;class Oh{constructor(t,e){y(this,"gpu");y(this,"device");y(this,"context");y(this,"format");y(this,"rp");y(this,"ro");y(this,"sampLin");y(this,"sampNear");y(this,"pipes",{});y(this,"layouts",{});y(this,"size","");y(this,"cellsTex");y(this,"fieldTex");y(this,"liquidTex");y(this,"lq");y(this,"lq2");y(this,"arrows");y(this,"nArrows",0);y(this,"groups",new Map);y(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});y(this,"water",[.24,.56,.85]);y(this,"waterInk",[1,1,1]);y(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",Ar*Ch,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,p,d,g,v=[])=>{const w=t.createShaderModule({code:m}),_=(await w.getCompilationInfo()).messages.filter(F=>F.type==="error");if(_.length>0)throw new Error(`render WGSL: ${_.map(F=>`${F.lineNum}:${F.linePos} ${F.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:w,entryPoint:"vs",buffers:v},fragment:{module:w,entryPoint:p,targets:[{format:this.format,blend:e}]},primitive:{topology:g}})},[r,a,c,l,f,u,h]=await Promise.all([i(_r,"fsCells",this.layouts.quad,"triangle-strip"),i(_r,"fsField",this.layouts.quad,"triangle-strip"),i(_r,"fsLiquid",this.layouts.quad,"triangle-strip"),i(kh,"fs",this.layouts.rect,"triangle-strip"),i(Sh,"fs",this.layouts.store,"triangle-strip"),i(Mh,"fs",this.layouts.store,"triangle-strip"),i(Lh,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:c,rect:l,disc:f,point:u,line:h}}ensure(){var f,u,h,m,p,d;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(g,v)=>s.createTexture({size:[g,v],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(u=this.fieldTex)==null||u.destroy(),(h=this.liquidTex)==null||h.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(p=this.lq2)==null||p.destroy(),(d=this.arrows)==null||d.destroy(),this.lq=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(_h/this.gpu.cpu.grid.dx)),a=r>>1,c=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=c*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,c,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:Ar*s,size:4*Ic}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const c=this.gpu.state,l=this.gpu.ctx,f=this.device.queue;this.roData[0]=Ah[r],f.writeBuffer(this.ro,0,this.roData),t.clearBuffer(c.cnt,4*W.OV_PMAX,16);const u=t.beginComputePass(),h=c.d.n;l.dispatch(u,"rScale",this.computeGroup("rScale",{}),h),l.dispatch(u,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),h),a||(l.dispatch(u,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*h),l.dispatch(u,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*h),l.dispatch(u,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*h)),r==="velocity"&&l.dispatch(u,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),u.end();const m=this.gpu.cpu.grid,p=(x,_,F)=>{const T=new Float32Array(Ic),A=new Uint32Array(T.buffer);T.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),T.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),T.set(_,24),T.set(F,28),T[32]=r==="temperature"?1:r==="salt"?2:0,T[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),A[34]=c.d.bcap,A[35]=c.d.pcap,f.writeBuffer(this.rp,Ar*x,T)},d=.003;p(0,[0,0,m.w,m.h],[...this.theme.ground,1]),p(1,[0,0,0,0],[0,0,0,0]),p(2,[0,0,0,0],[...this.theme.ink,.85]),p(3,[0,0,0,0],[...this.waterInk,.9]);const g=[];i.left&&g.push([-d,-d,0,m.h+(i.top?d:0)]),i.right&&g.push([m.w,-d,m.w+d,m.h+(i.top?d:0)]),i.bottom&&g.push([-d,-d,m.w+d,0]),i.top&&g.push([-d,m.h,m.w+d,m.h+d]),g.forEach((x,_)=>p(4+_,x,[...this.theme.wall,1]));const v=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;v.setPipeline(w.rect),v.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),v.draw(4),a?(v.setPipeline(w.point),v.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:c.partsA})),v.draw(4,c.d.pcap)):(v.setPipeline(w.liquid),v.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),v.draw(4)),v.setPipeline(w.disc),v.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:c.bubs})),v.draw(4,c.d.bcap),v.setPipeline(w.field),v.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),v.draw(4),v.setPipeline(w.cells),v.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),v.draw(4),r==="velocity"&&(v.setPipeline(w.line),v.setVertexBuffer(0,this.arrows),v.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),v.draw(6*this.nArrows),v.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),v.draw(6*this.nArrows,1,6*this.nArrows)),v.setPipeline(w.rect),g.forEach((x,_)=>{v.setBindGroup(0,this.drawGroup(`d-wall${_}`,this.layouts.rect,4+_,{})),v.draw(4)}),v.end()}reset(){this.size="",this.groups.clear()}}const qh=[...uh,...vh,...ih,...sh,...th,...rh,...Yu,...Ju,...ch,...yh,...Fh,...xh,...Ph],Rc=[["heater",W.HEATER_E,"f"],["lossWalls",W.LOSS_WALLS,"f"],["lossOpen",W.LOSS_OPEN,"f"],["escapedEnergy",W.ESC_ENERGY,"f"],["escapedWater",W.ESC_WATER,"f"],["escapedAir",W.ESC_AIR,"f"],["escapedOther",W.ESC_OTHER,"f"],["escapedSalt",W.ESC_SALT,"f"],["crystallized",W.CRYST,"f"],["produced",W.PRODUCED,"f"],["condensed",W.CONDENSED,"f"],["dew",W.DEW,"f"],["fogMade",W.FOGMADE,"f"],["burstVapour",W.BURSTVAP,"f"],["fluxSL",W.FLUX_SL,"f"],["fluxLG",W.FLUX_LG,"f"],["fluxSG",W.FLUX_SG,"f"],["lossSolids",W.LOSS_SOLIDS,"f"],["nucleated",W.NUCLEATED,"u"],["departed",W.DEPARTED,"u"],["merged",W.MERGED,"u"],["burst",W.BURST,"u"],["collapsed",W.COLLAPSED,"u"],["burstCold",W.BURST_COLD,"u"],["burstWarm",W.BURST_WARM,"u"],["collapsedCold",W.COLL_COLD,"u"],["collapsedWarm",W.COLL_WARM,"u"]],Ec=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0}),jh=24,Tr=256,qs=2*ls;class wo{constructor(t,e){y(this,"ctx");y(this,"cpu");y(this,"state");y(this,"solver");y(this,"sub");y(this,"groups",new Map);y(this,"stateVersion",0);y(this,"itL",16);y(this,"itG",18);y(this,"itH",8);y(this,"itD",6);y(this,"nsub",0);y(this,"totals",Ec());y(this,"last",null);y(this,"stepped",null);y(this,"energy0",null);y(this,"water0",null);y(this,"other0",null);y(this,"salt0",null);y(this,"sealed",!1);y(this,"salty",!1);y(this,"mixed",!1);y(this,"staging",[]);y(this,"busy",new Set);y(this,"reading",new Map);y(this,"querySet");y(this,"queryBuf");y(this,"vapourMark",0);y(this,"vapourLast",0);y(this,"vapourRate",0);y(this,"stageMs",new Array(ls).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:qs}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*qs,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await go.create(),s=await e.compile(qh);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new wo(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new ph(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new mh(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Tr/4*16);for(let n=0;n<16;n+=1)s[Tr/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,s.escapedOther=e.escapedOther,s.escapedSalt=e.escapedSalt,t.salt.crystallized=e.crystallized,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*W.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*W.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Tr*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,qs,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);if(this.sort(n,1),this.mixed&&this.cells(n,"cellHost","B"),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.mixed){for(let i=0;i<jh;i+=2)this.faces(n,"viscJacA"),this.faces(n,"viscJacB");this.faces(n,"viscForce")}this.cells(n,"liqAssemble"),this.solver.encodeMG(n,Qa,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,Xa,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubVent"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,Za,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffOut"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),this.salty&&(this.parts(n,"saltCryst","A"),this.cells(n,"gasApply")),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,Ya,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),this.salty&&(this.cells(n,"saltSums","A"),this.cells(n,"saltShare","A")),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*fs,n=s+4*Vs,i=n+4*Fe*t.d.nreg,r=i+4*ge*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],c=r+4*Us*a,l=c+4*64,f=l+8*qs;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:c,ts:l,total:f}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(c=>!this.busy.has(c)&&c.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*fs),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Vs),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Fe*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*ge*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*qs),t.clearBuffer(s.cnt,4*mc,4*(lu-mc)),t.clearBuffer(s.cnt,4*W.VMAXP,4*4),t.clearBuffer(s.cnt,4*W.ESC_OTHER,4*3),this.busy.add(i);const a=[];for(let c=0;c<this.cpu.regions.count;c+=1)a.push(s.gpuRegion(c));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,fs),r=new Float32Array(t,n.cnt,fs),a=new Float32Array(t,n.glob,Vs),c=new Float32Array(t,n.reg,Fe*e.nreg),l=new Float32Array(t,n.heat,ge*e.nheat),f=new Float32Array(t,n.meas,(n.probe-n.meas)/4),u=new Float32Array(t,n.probe,64),[h,m,p]=e.groups,d=(F,T,A)=>{let b=0;for(let P=0;P<T;P+=1)b+=f[(F+P)*Us+A];return b},g=[];for(const F of e.regions){const T=Fe*F;g.push({p0:c[T+Qt.P0],sealed:c[T+Qt.OPEN]===0,vGas:c[T+Qt.VGAS],vFluid:c[T+Qt.VFLUID]})}const v=[];for(let F=0;F<e.heaters;F+=1){const T=ge*F;v.push({P:l[T+Ht.P],Tmean:l[T+Ht.TMEAN],integral:l[T+Ht.INTEGRAL],cells:l[T+Ht.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,qs);w=[];for(let T=0;T<ls;T+=1){const A=F[2*T],b=F[2*T+1];w.push(b>A&&A>0n?Number(b-A)/1e6:0)}}const x=r[W.SUM_WM],_={};for(const[F,T,A]of Rc)_[F]=A==="f"?r[T]:i[T];return{intervals:_,ov:[r[W.OV_PMAX],r[W.OV_VMAX],r[W.OV_VLIQ]],pcount:i[W.PCOUNT],bcount:i[W.BCOUNT],dt:a[Is.DT],stepsSince:i[W.STEPS],simSince:r[W.SIMTIME],itL:i[W.IT_L],itG:i[W.IT_G],itH:i[W.IT_H],itD:i[W.IT_D],capL:i[W.CAP_L],capG:i[W.CAP_G],capH:i[W.CAP_H],capD:i[W.CAP_D],resL:r[W.RES_L],resG:r[W.RES_G],resH:r[W.RES_H],nsub:i[W.NSUBMAX],uMaxG:r[W.UMAXG],waterMass:x,waterT:x>0?r[W.SUM_WMT]/x:0,waterTmax:r[W.TMAX],solids:d(0,h,0),film:d(0,h,1),gas:d(0,h,2),vapour:d(0,h,3),fog:d(0,h,4),air:d(0,h,5),liquidCells:Math.round(d(0,h,6)),gasCells:Math.round(d(0,h,7)),liquidH:d(h,m,0),liquidMass:d(h,m,1),sensible:d(h,m,3),otherMass:d(h,m,4),otherMT:d(h,m,5),saltLiquid:d(h,m,6),crust:d(0,h,8),floor:d(0,h,9),floorH:d(0,h,10),bubH:d(h+m,p,0),bubWater:d(h+m,p,1),bubAir:d(h+m,p,2),regions:g,heaters:v,watch:{found:u[31]===1,id:new Uint32Array(u.buffer,u.byteOffset+4*21,1)[0],fate:i[W.WATCH_FATE],data:new Float32Array(u)},firstSuperheat:i[W.FIRST_SH]!==0?r[W.FIRST_SH]-1e3:null,stageMs:w,vmaxP:r[W.VMAXP],rmaxB:r[W.RMAXB],slowed:i[W.SLOWED],vented:r[W.VENTED]}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of Rc)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD,e.slowed+=t.slowed,e.vented+=t.vented;const s=(n,i,r,a,c,l)=>{if(i===0&&r===0)return n;const f=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(c,Math.max(a,n>f?Math.max(f,n-2):f))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:i.escapedOther,editOther:e.ledger.other,escapedSalt:i.escapedSalt,editSalt:e.ledger.salt,bodyWork:0},c=this.energy0??r.energy,l=this.water0??r.water.total,f=r.energy-c-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),u=r.water.total-l-a.editWater,h=r.other.total-(this.other0??r.other.total)-a.editOther,m=r.salt.total-(this.salt0??r.salt.total)-a.editSalt,p=i.produced+i.burstVapour,d=i.time-this.vapourLast;d>.2&&(this.vapourRate=(p-this.vapourMark)/d,this.vapourMark=p,this.vapourLast=i.time);const g=e.heat.heaters.map((x,_)=>({h:x,k:_,rd:n==null?void 0:n.heaters[_]})).filter(({rd:x,h:_})=>((x==null?void 0:x.cells)??_.cells)>0).map(({h:x,rd:_})=>({group:x.group,P:(_==null?void 0:_.P)??x.P,Tmean:(_==null?void 0:_.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),v=(x,_,F)=>({iterations:x,residual:_,capped:F>0}),w=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:v((w==null?void 0:w.itL)??0,(w==null?void 0:w.resL)??0,(w==null?void 0:w.capL)??0),gas:v((w==null?void 0:w.itG)??0,(w==null?void 0:w.resG)??0,(w==null?void 0:w.capG)??0),heat:v((w==null?void 0:w.itH)??0,(w==null?void 0:w.resH)??0,(w==null?void 0:w.capH)??0),gasSubsteps:(w==null?void 0:w.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:(n==null?void 0:n.otherMass)??0,otherT:n!==null&&n.otherMass>0?n.otherMT/n.otherMass:0,saltMass:(n==null?void 0:n.saltLiquid)??0,saltSolid:((n==null?void 0:n.crust)??0)+((n==null?void 0:n.floor)??0),bodies:{count:this.cpu.bodies.list.filter(x=>!x.gone).length,free:0,awake:0},heaters:g,regions:((n==null?void 0:n.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:a,energyError:f,waterError:u,otherError:h,saltError:m,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:{...e.extremes.stats(),slowed:i.slowed,vented:i.vented},cpuOnly:!1}}budget(){const t=this.last,e=this.totals;let s=0;for(const f of(t==null?void 0:t.regions)??[])f.sealed&&(s-=f.p0*f.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=((t==null?void 0:t.solids)??0)+((t==null?void 0:t.floorH)??0),r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,c={liquid:(t==null?void 0:t.liquidMass)??0,ice:0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater},l=(t==null?void 0:t.otherMass)??0;return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:c,other:{liquid:l,escaped:e.escapedOther,total:l+e.escapedOther},salt:this.saltBudget(),air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}saltBudget(){const t=this.last,e=(t==null?void 0:t.saltLiquid)??0,s=(t==null?void 0:t.crust)??0,n=(t==null?void 0:t.floor)??0,i=this.totals.escapedSalt;return{liquid:e,crust:s,floor:n,escaped:i,total:e+s+n+i}}resetTotals(){Object.assign(this.totals,Ec()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water,this.other0=t.other.total-s.ledger.other,this.salt0=t.salt.total-s.ledger.salt}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}function Bh(o,t,e,s,n){const i=-n,r=-n,a=o+2*n,c=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/c>l){const u=a/l;return{x0:i,y0:r-(u-c)/2,x1:i+a,y1:r-(u-c)/2+u}}const f=c*l;return{x0:i-(f-a)/2,y0:r,x1:i-(f-a)/2+f,y1:r+c}}const zs=self,Pt=o=>zs.postMessage(o),Dc=8,Ih=.1,Rh=3,Vc=200,Eh=.25,Nc=273.15;let rt=null,J=null,Xe=null,Ci=null,Ie=null,Hs="",fi=1,ui=1,hi=1,Qs={x0:0,y0:0,x1:1,y1:1},Xs={left:!0,right:!0,bottom:!0,top:!1},ys=!1,zr=1,as="none",Ja=!1,$e=0,Gs=0,Oi=0,Pr=0,kr=!1,Ln=0,Uc=0,Qr=0,Xr=0,Hc=!1,Yr=0,Es=null,Zr=null;const rs=[],Jr=[];let qi=!1;const $s=[];function bo(){if(rt===null)return;const o=rt.scene.sides;Xs={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Fo(o,t,e){fi=Math.max(1,o),ui=Math.max(1,t),hi=Math.max(.5,Math.min(3,e)),Ie!==null&&(Ie.width=Math.round(fi*hi),Ie.height=Math.round(ui*hi)),rt!==null&&(Qs=Bh(rt.boxW,rt.boxH,fi,ui,.006))}function tl(o){Xe!==null&&(Xe.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function os(o){Jr.push(o),qi||Dh()}async function Dh(){if(J!==null){qi=!0;try{for(;Jr.length>0;){const o=Jr.shift();await J.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Pt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{qi=!1,Gs=performance.now()}}}async function di(){if(J===null)return;const o=J.ctx.device.createCommandEncoder(),t=J.encodeReadback(o,!1);J.ctx.device.queue.submit([o.finish()]),t!==null&&await J.finishReadback(t,!1),J.baselineFromLast()}function ji(){return rt===null||!rt.needsCpu()?!1:(Pt({type:"gpu",ok:!1,adapter:Hs,message:"cpu-only",scene:rt.serialize()}),!0)}function Bi(o){J!==null&&Xe!==null&&J.stateVersion!==o&&Xe.reset()}function Sr(){os(async()=>{if(J===null||rt===null||$s.length===0)return;const o=$s.splice(0,$s.length);await di(),await J.download();for(const e of o){const s=rt.apply(e);s!==null&&s.startsWith("refused")&&Pt({type:"refused",message:s})}if(ji())return;const t=J.stateVersion;J.upload(),Bi(t)})}function Vh(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(as==="temperature")return[Nc+xe[0],Nc+xe[1],e];if(as==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return as==="velocity"?[0,Math.max(.02,t[1]),e]:as==="vapour"?[0,.6,e]:as==="salt"?[0,vo,e]:[0,1,e]}function Nh(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return Es={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},Es}return Es!==null&&(t.fate===1||t.fate===2)?{...Es,fate:t.fate===1?"burst":"collapsed"}:null}function Uh(o,t){if(J===null||Ci===null)return;if(J.baselineFromLast(),rt!==null&&o.stepsSince>0){rt.extremes.observe(o.rmaxB,o.vmaxP,J.totals.time);const i=rt.extremes.take();i!==null&&(ys=!0,$e=0,Oi=0,Pt({type:"extreme",event:i}))}if(J.totals.time>=Yr){const i=Ci.sample();i!==null&&(rs.push(i),rs.length>400&&rs.splice(0,rs.length-400),Yr=J.totals.time+Eh)}const e=Math.max(.001,(t-Ln)/1e3),s=(o.stageMs??J.stageMs).reduce((i,r)=>i+r,0),n={engine:J.stats(s),stepsPerSecond:Xr/e,simRate:(J.totals.time-Uc)/e,fps:Qr/e,renderMs:0,mode:"gpu",adapter:Hs,paused:ys,samples:rs.splice(0,rs.length),bubble:Nh(o),object:Zr!==null&&rt!==null?k0(rt,Zr):null,overlayScale:Vh(o)};Pt({type:"stats",stats:n}),Qr=0,Xr=0,Uc=J.totals.time,Ln=t}function to(){var t;const o=performance.now();if(J!==null&&Xe!==null&&Ie!==null&&rt!==null&&!qi){const e=J.ctx.device,s=Gs===0?0:Math.min(.1,(o-Gs)/1e3);Gs=o;const n=((t=J.last)==null?void 0:t.dt)??rt.dt;let i=0;ys?(i=Math.min(Dc,Oi),Oi-=i,$e=0):($e=Math.min($e+s*zr,Ih*Math.max(1,zr)),i=Pr>=Rh?0:Math.min(Dc,Math.floor($e/Math.max(1e-5,n))),$e-=i*n);const r=!kr&&o-Ln>Vc&&(i>0||ys||o-Ln>4*Vc),a=e.createCommandEncoder();i>0&&J.encodeSteps(a,i,r);const c=r?J.encodeReadback(a,r&&i>0):null;if(Xe.encode(a,Qs,Ie.width,Ie.height,Xs,as,Ja),e.queue.submit([a.finish()]),Pr+=1,e.queue.onSubmittedWorkDone().then(()=>{Pr-=1}),Xr+=i,Qr+=1,c!==null){kr=!0;const l=i>0;J.finishReadback(c,l).then(f=>{kr=!1,f!==null&&Uh(f,performance.now())})}}typeof zs.requestAnimationFrame=="function"?zs.requestAnimationFrame(to):setTimeout(to,16)}async function Hh(o){if(rt=new au(o.scene),ys=o.paused===!0,ji())return;if(Ie=o.canvas,Ie===null)throw new Error("no OffscreenCanvas");J=await wo.create(rt),Hs=await(async()=>{var e;try{const s=await((e=zs.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),Xe=new Oh(J,Ie),await Xe.init(),tl(o.dark),Ci=new Na(J),J.ctx.device.addEventListener("uncapturederror",e=>Pt({type:"error",message:`WebGPU: ${e.error.message}`})),J.ctx.device.lost.then(e=>Pt({type:"gpu",ok:!1,adapter:Hs,message:e.message||e.reason})),bo(),Fo(o.width,o.height,o.dpr),Pt({type:"gpu",ok:!0,adapter:Hs,message:""}),Pt({type:"ready",offscreen:!0,warnings:rt.warnings,view:Qs,quality:rt.currentQuality,walls:Xs}),Ln=performance.now(),Gs=performance.now(),Hc||(Hc=!0,to())}function Mr(){if(J===null||rt===null)return;const o=J.stateVersion;J.cpu=rt,J.rebuild(),J.resetTotals(),Bi(o),Ci=new Na(J),Yr=0,rs.length=0,$e=0,Es=null,bo(),Fo(fi,ui,hi),Pt({type:"view",view:Qs,walls:Xs})}zs.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Pt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&zs.navigator.gpu!==void 0});break;case"init":Hh(t).catch(e=>Pt({type:"gpu",ok:!1,adapter:Hs,message:e instanceof Error?e.message:String(e)}));break;case"resize":Fo(t.width,t.height,t.dpr),Pt({type:"view",view:Qs,walls:Xs});break;case"op":$s.push(t.op),Sr();break;case"addLiquid":$s.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Sr();break;case"addSolid":$s.push({op:"solid",region:t.region,material:t.material,T:t.T}),Sr();break;case"setHeater":rt==null||rt.setHeater(t.group,t.mode,t.power,t.target,t.on),J==null||J.writeHeater(t.group);break;case"setAmbient":rt==null||rt.setAmbient(t.p,t.T,t.rh,t.g,t.air),J==null||J.writeParams();break;case"setBoundary":os(async()=>{if(J===null||rt===null)return;await di(),await J.download(),rt.setBoundary(t.side,t.value);const e=J.stateVersion;J.upload(),Bi(e),bo(),Pt({type:"view",view:Qs,walls:Xs})});break;case"query":os(async()=>{if(J===null||rt===null){Pt({type:"reply",id:t.id,data:null});return}await di(),await J.download(),Pt({type:"reply",id:t.id,data:rt.query(t.x,t.y)})});break;case"select":Es=null,J==null||J.watch(t.bubble);break;case"overlay":as=t.overlay;break;case"particles":Ja=t.on;break;case"pause":ys=t.paused,$e=0,Gs=performance.now();break;case"step":ys&&(Oi+=1);break;case"setSpeed":zr=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":rt==null||rt.setExtremes(t.mode),J==null||J.writeParams();break;case"setQuality":os(async()=>{rt!==null&&(rt.setQuality(t.quality),Mr())});break;case"serialize":J===null?Pt({type:"reply",id:t.id,data:(rt==null?void 0:rt.serialize())??null}):os(async()=>{Pt({type:"reply",id:t.id,data:(rt==null?void 0:rt.serialize())??null})});break;case"load":os(async()=>{rt!==null&&(rt.load(t.scene),!ji()&&Mr())});break;case"selectObject":Zr=t.object;break;case"editObject":os(async()=>{if(J===null||rt===null){Pt({type:"reply",id:t.id,data:null});return}await di(),await J.download();const e=P0(rt,t.object,t.patch);if(Pt({type:"reply",id:t.id,data:e}),ji())return;if(e.rebuilt){Mr();return}const s=J.stateVersion;J.upload(),Bi(s)});break;case"theme":tl(t.dark);break;case"frameDone":break}}catch(e){Pt({type:"error",message:e instanceof Error?e.message:String(e)})}});
