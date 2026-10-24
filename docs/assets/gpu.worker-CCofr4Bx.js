var wl=Object.defineProperty;var bl=(o,t,e)=>t in o?wl(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var v=(o,t,e)=>bl(o,typeof t!="symbol"?t+"":t,e);function Fl(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,a)=>(r[0]-i[0])*(a[1]-i[1])-(r[1]-i[1])*(a[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const _l={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Al=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],Tl=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],kl={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Pl=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var Ml={ambient:_l,species:Al,solutes:Tl,vapourInAir:kl,solids:Pl};const Et=8.314462618,zi=9.80665,Tn=101325,et=273.15,Pi=1602176634e-28,ca=1380649e-29,aa=602214076e15,la=88541878128e-22,U=0,rt=1,dt=2,at=0,ft=1,Z=2,lt=6,Ft=3,Pt=Ml,Dt=Pt.species[0],ln=Pt.species[1],fn=Pt.species[2],gt=new Float64Array(lt);gt[at]=ln.molarMass.v;gt[ft]=fn.molarMass.v;gt[Z]=Dt.molarMass.v;ln.name,fn.name,Dt.vapour.name;const mo=ln.gas.cp.v,po=fn.gas.cp.v,[kn,Pn,Xe]=Dt.vapour.cp.linear;function Sl(o,t){return o===Z?kn+Pn*(t-Xe):o===at?mo:o===ft?po:0}const ns=Dt.liquid.kell.c,Vn=Dt.liquid.cp.table,jt=new Float64Array(Vn.map(o=>o[0])),Rt=new Float64Array(Vn.map(o=>o[1])),ie=new Float64Array(Vn.length);ie[0]=Rt[0]*(jt[0]-et);for(let o=1;o<Vn.length;o+=1)ie[o]=ie[o-1]+.5*(Rt[o]+Rt[o-1])*(jt[o]-jt[o-1]);const $t=Vn.length-1;function fa(o){if(o<jt[0])return-1;if(o>=jt[$t])return $t;let t=Math.min($t-1,Math.max(0,Math.floor((o-et)/10)));for(;t>0&&o<jt[t];)t-=1;for(;t<$t-1&&o>=jt[t+1];)t+=1;return t}function Me(o){const t=fa(o);return t<0?Rt[0]:t===$t?Rt[$t]:Rt[t]+(Rt[t+1]-Rt[t])*(o-jt[t])/(jt[t+1]-jt[t])}function At(o){const t=fa(o);if(t<0)return ie[0]+Rt[0]*(o-jt[0]);if(t===$t)return ie[$t]+Rt[$t]*(o-jt[$t]);const e=o-jt[t],s=(Rt[t+1]-Rt[t])/(jt[t+1]-jt[t]);return ie[t]+Rt[t]*e+.5*s*e*e}function ua(o){if(o<ie[0])return jt[0]+(o-ie[0])/Rt[0];if(o>=ie[$t])return jt[$t]+(o-ie[$t])/Rt[$t];let t=Math.min($t-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<ie[t];)t-=1;for(;t<$t-1&&o>=ie[t+1];)t+=1;const e=(Rt[t+1]-Rt[t])/(jt[t+1]-jt[t]),s=o-ie[t],n=Rt[t];return jt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function sn(o){const t=o-et;return(ns[0]+t*(ns[1]+t*(ns[2]+t*(ns[3]+t*(ns[4]+t*ns[5])))))/(1+ns[6]*t)}const er=Dt.liquid.k.poly;function Mn(o){const t=Math.min(150,Math.max(0,o-et));return er[0]+t*(er[1]+t*er[2])}const[Ll,Cl,jo]=Dt.liquid.mu.vogel;function bs(o){return Ll*Math.pow(10,Cl/(Math.max(o,jo+60)-jo))}const sr=Dt.surfaceTension,Ol=Dt.saturation.Tc.v;function Un(o){const t=Math.max(0,1-o/Ol);return sr.B*Math.pow(t,sr.mu)*(1+sr.b*t)}const ql=Dt.saturation.hlv100.v,Sn=et+100,ha=At(Sn)+ql,jl=Dt.vapour.k.v,Il=Dt.vapour.mu.v;function pt(o){const t=o-Xe,e=Sn-Xe;return ha+kn*(o-Sn)+.5*Pn*(t*t-e*e)}function da(o){return pt(o)-At(o)}function re(o,t){return o===Z?pt(t):Sl(o,t)*(t-et)}const nr=ln.gas.k.power,ir=fn.gas.k.power,Bl=ln.gas.mu.sutherland,Rl=fn.gas.mu.sutherland,rr=Pt.vapourInAir,ma=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),pa=150,Mi=1001,Hn=o=>{const t=new Float64Array(Mi);for(let e=0;e<Mi;e+=1)t[e]=o(pa+e);return t},vs=(o,t)=>{let e=t-pa;e>0?e>Mi-1.001&&(e=Mi-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Io=Hn(o=>nr[0]*Math.pow(o/nr[1],nr[2])),El=Hn(o=>ir[0]*Math.pow(o/ir[1],ir[2])),Bo=Hn(o=>ma(Bl,o)),Dl=Hn(o=>ma(Rl,o)),Nl=Hn(o=>rr.D0.v*Math.pow(o/rr.T0.v,rr.exponent.v));function go(o,t,e,s){const n=o+t+e;return n>0?(o*vs(Io,s)+t*vs(El,s)+e*jl)/n:vs(Io,s)}function Vl(o,t,e,s){const n=o+t+e;return n>0?(o*vs(Bo,s)+t*vs(Dl,s)+e*Il)/n:vs(Bo,s)}function Ul(o,t){return vs(Nl,o)*(Tn/t)}function ga(o,t,e,s){const n=o*mo+t*po,i=Sn-Xe,r=.5*e*Pn,a=n+e*kn;if(a<=0)return et;const c=n*(Xe-et)+e*(ha+kn*(Xe-Sn)-.5*Pn*i*i)-s,l=a*a-4*r*c;return Xe+-2*c/(a+Math.sqrt(l>0?l:0))}function Nr(o,t,e,s,n){return o*mo+t*po+e*(kn+Pn*(n-Xe))+(s>0?s*Me(n):0)}const Hl=Pt.ambient.air.N2.v,Gl=Pt.ambient.air.O2.v,xa=Pt.ambient.hExt.v,mt=Pt.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function Hs(o){return mt.findIndex(t=>t.id===o)}const ut=0,va=Pt.species.slice(3),Ro=[null,...va.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*et+.5*s*et*et}})],te=[{id:Dt.id,name:Dt.name,short:Dt.liquid.name,color:Dt.liquid.color,volatile:!0,range:[et,et+150]},...va.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function ya(o){return te.findIndex(t=>t.id===o)}const ks=o=>Ro[o]??Ro[1];function xo(o,t){if(o===ut)return Me(t);const e=ks(o);return e.cA+e.cB*t}function $l(o,t){if(o===ut)return At(t);const e=ks(o);return e.cA*t+.5*e.cB*t*t-e.h0}function Wl(o,t){if(o===ut)return ua(t);const e=ks(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function Fs(o,t){if(o===ut)return sn(t);const e=ks(o);return e.rA+e.rB*t}function bn(o,t){if(o===ut)return Mn(t);const e=ks(o);return e.kA+e.kB*t}function Ln(o,t){if(o===ut)return bs(t);const e=ks(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function Ks(o,t){return o===ut?Un(t):ks(o).sigma}Dt.thermo,ln.thermo,fn.thermo;const Gn=Pt.species[0].saturation,Se=Gn.if97.n,wa=Se[0],ba=Se[1],Fa=Se[2],_a=Se[3],Aa=Se[4],Ta=Se[5],ka=Se[6],Pa=Se[7],Ma=Se[8],Vr=Se[9],Fn=Gn.Tc.v,Kl=Gn.rhoc.v,Si=273.15,Ps=Gn.vapourDensity.c;Gn.liquidDensity.b;function Qi(o){const t=o<Si?Si:o>Fn?Fn:o,e=t+Ma/(t-Vr),s=e*e+wa*e+ba,n=Fa*e*e+_a*e+Aa,i=Ta*e*e+ka*e+Pa,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+Fa*e+Ta,n=wa*e*e+_a*e+ka,i=ba*e*e+Aa*e+Pa,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=Vr+r;return(a-Math.sqrt(a*a-4*(Ma+Vr*r)))/2}function Sa(o){const e=1-(o<Si?Si:o>Fn?Fn:o)/Fn,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,c=a*a*s,l=c*a*r*r;return Kl*Math.exp(Ps[0]*n+Ps[1]*i+Ps[2]*r+Ps[3]*a+Ps[4]*c+Ps[5]*l)}const Li=250,Ci=.01,$n=25001,vi=new Float64Array($n),yi=new Float64Array($n);for(let o=0;o<$n;o+=1)vi[o]=Qi(Li+o*Ci),yi[o]=Sa(Li+o*Ci);function Cn(o){const t=(o-Li)/Ci;if(!(t>=0)||t>=$n-1)return Qi(o);const e=t|0;return vi[e]+(t-e)*(vi[e+1]-vi[e])}function Te(o){const t=(o-Li)/Ci;if(!(t>=0)||t>=$n-1)return Sa(o);const e=t|0;return yi[e]+(t-e)*(yi[e+1]-yi[e])}const Wt=Pt.solutes[0],La=Pt.species[0],Xi=La.molarMass.v,Je=Wt.molarMass.v,zl=Wt.ions.v,Wn=1,Yi=Pt.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function Ca(o){return Yi.findIndex(t=>t.id===o)}function Oa(o){return o>0?o*Je/(1+o*Je):0}const ge=298.15,Kn=Wt.pitzer,Ql=Kn.b0.a,Xl=Kn.b1.a,Yl=Kn.c.a,Zl=Kn.b.v,Jl=Kn.alpha.v,wi=Wt.pitzerCold,tf=wi.below.v;function or(o,t){return o[0]+o[1]*(1/t-1/ge)+o[2]*Math.log(t/ge)+o[3]*(t-ge)+o[4]*(t*t-ge*ge)+o[5]*(1/(t*t)-1/(ge*ge))}const ti=Wt.dielectric.c;function ef(o){const t=o-et;return ti[0]+t*(ti[1]+t*(ti[2]+t*ti[3]))}function sf(o){const t=Pi*Pi/(4*Math.PI*la*ef(o)*ca*o);return Math.sqrt(2*Math.PI*aa*sn(o))*t*Math.sqrt(t)/3}function nf(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<tf,n=or(s?wi.b0.a:Ql,o),i=or(s?wi.b1.a:Xl,o),r=or(s?wi.c.a:Yl,o);return 1-sf(o)*e/(1+Zl*e)+t*(n+i*Math.exp(-Jl*e))+t*t*r}function Oi(o,t){return t>0?Math.exp(-zl*t*nf(o,t)*Xi):1}const qa=240,qi=221,ja=.05,ze=181;let cr=null;function rf(){if(cr!==null)return cr;const o=new Float64Array(qi*ze);for(let t=0;t<qi;t+=1)for(let e=0;e<ze;e+=1)o[t*ze+e]=Oi(qa+t,e*ja);return cr=o,o}function Ia(o,t){if(!(t>0))return 1;const e=t/ja;if(e>=ze-1)return Oi(o,t);const s=rf();let n=o-qa;n>0?n>qi-1.000001&&(n=qi-1.000001):n=0;const i=n|0,r=e|0,a=n-i,c=e-r,l=i*ze+r,u=s[l]+c*(s[l+1]-s[l]),f=s[l+ze]+c*(s[l+ze+1]-s[l+ze]);return u+a*(f-u)}function Ba(o,t){let e=kt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(o/Ia(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Zi=La.fusion,oe=Zi.T.v,vo=Zi.h.v,of=Zi.cpIce.v;Zi.rhoIce.v;function cf(o){const t=Me(oe)-of;return Xi/Et*((vo-t*oe)*(1/oe-1/o)+t*Math.log(o/oe))}const af=Wt.eutectic.T.v,lf=Wt.eutectic.w.v;function Ra(o){if(!(o>0))return oe;if(Oa(o)>=lf)return af;const t=s=>Math.log(Oi(s,o))-cf(s);let e=oe+Math.log(Oi(oe,o))*Et*oe*oe/(Xi*vo);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return oe;if(Math.abs(r)<1e-9)break}return e}const He=Wt.solubility.table;function ff(o){if(o<=He[0][0])return He[0][1];for(let t=1;t<He.length;t+=1)if(o<=He[t][0]){const[e,s]=He[t-1],[n,i]=He[t];return s+(i-s)*(o-e)/(n-e)}return He[He.length-1][1]}function Ea(o){return Oa(ff(o))}const Da=Wt.solid.rho.v,es=Wt.solid.cp.v;function zn(o){return es*(o-et)}const dn=Wt.density.laliberte;function uf(o,t){const e=o-et,s=e+dn[4];return(dn[0]*t+dn[1])*Math.exp(1e-6*s*s)/(t+dn[2]+dn[3]*e)}function Ji(o,t){return t>0?1/((1-t)/sn(o)+t/uf(o,t)):sn(o)}const un=Wt.cp.laliberte,tr=un[0],hf=un[1],df=un[2],On=un[3],yo=un[4],qn=un[5],_s=Wt.cp.range.lo,ji=Wt.cp.range.hi,ys=.5,De=Math.round((ji-_s)/ys)+1,Jt=new Float64Array(De),jn=new Float64Array(De);for(let o=0;o<De;o+=1){const t=_s+o*ys-et;Jt[o]=Math.exp(hf*t+df*Math.exp(.01*t))}jn[0]=Jt[0]*(_s-et);for(let o=1;o<De;o+=1)jn[o]=jn[o-1]+.5*(Jt[o-1]+Jt[o])*ys;function Na(o){if(o<=_s)return Jt[0];if(o>=ji)return Jt[De-1];const t=(o-_s)/ys,e=Math.min(De-2,t|0);return Jt[e]+(t-e)*(Jt[e+1]-Jt[e])}function Qn(o){if(o<=_s)return Jt[0]*(o-et);if(o>=ji)return jn[De-1]+Jt[De-1]*(o-ji);const t=(o-_s)/ys,e=Math.min(De-2,t|0),s=(t-e)*ys;return jn[e]+Jt[e]*s+.5*(Jt[e+1]-Jt[e])*s*s/ys}const wo=o=>1e3*tr*o*Math.exp(On*o),bo=o=>1e3*yo*Math.pow(o,qn+1),Fo=Wt.dHsol.v/Je+zn(ge)-1e3*tr*Qn(ge);function Va(o,t){return t>0?(1-t)*At(o)+t*Fo+wo(t)*Qn(o)+bo(t)*(o-et):At(o)}function mf(o,t){return t>0?(1-t)*Me(o)+wo(t)*Na(o)+bo(t):Me(o)}function pf(o,t,e){if(!(t>0))return ua(o);const s=wo(t),n=bo(t),i=t*Fo,r=1-t;let a=e>200&&e<900?e:et+(o-i)/(4e3*r+800*t);for(let c=0;c<30;c+=1){const u=(r*At(a)+i+s*Qn(a)+n*(a-et)-o)/(r*Me(a)+s*Na(a)+n);if(a-=u,Math.abs(u)<1e-8)break}return a}function Eo(o,t){const e=Math.exp(On*t),s=1e3*tr*e*(t+(1-t)*(1+On*t)),n=t>0?1e3*yo*Math.pow(t,qn)*(t+(1-t)*(qn+1)):0;return Fo+s*Qn(o)+n*(o-et)}const gf=Wt.diffusivity.v,xf=bs(ge);function Ur(o){return gf*(o/ge)*xf/bs(o)}function zs(o,t){return t>0?At(o)-1e3*tr*On*t*t*Math.exp(On*t)*Qn(o)-1e3*yo*qn*Math.pow(t,qn+1)*(o-et):At(o)}const vf=1e-6;function Ve(o){var t;return((t=mt[o])==null?void 0:t.id)==="ice"?oe:NaN}function wn(o){return Ve(o)>0?At(oe)-mt[o].cp*(oe-et)-vo:0}function Hr(o,t,e,s){return(o+e*es)*(s-et)+t*At(s)}function _o(o,t,e,s,n){const i=t+s*es;if(!(i>0))return n;if(e<=0)return et+o/i;let r=n>100?n:et+o/i;for(let a=0;a<3;a+=1)r-=(i*(r-et)+e*At(r)-o)/(i+e*Me(r));return r}class Nt{constructor(t,e,s,n){v(this,"mat",0);v(this,"heater",-1);v(this,"nr",0);v(this,"xs",[]);v(this,"ys",[]);v(this,"ni",new Int32Array(0));v(this,"nj",new Int32Array(0));v(this,"off",new Int32Array(0));v(this,"ncell",0);v(this,"E",new Float64Array(0));v(this,"film",new Float64Array(0));v(this,"crust",new Float64Array(0));v(this,"x",0);v(this,"y",0);v(this,"a",0);v(this,"vx",0);v(this,"vy",0);v(this,"w",0);v(this,"ux",0);v(this,"uy",0);v(this,"uw",0);v(this,"m",0);v(this,"I",0);v(this,"ma",0);v(this,"Ia",0);v(this,"ma6",new Float64Array(6));v(this,"maOk",!1);v(this,"pinned",!0);v(this,"asleep",!0);v(this,"gone",!1);v(this,"rest",0);v(this,"rx",0);v(this,"ry",0);v(this,"ra",0);v(this,"rmax",0);v(this,"hullA",0);v(this,"hullJ",0);v(this,"nseg",0);v(this,"segR",new Int32Array(0));v(this,"segS",new Uint8Array(0));v(this,"segT0",new Float64Array(0));v(this,"segT1",new Float64Array(0));v(this,"nw",0);v(this,"wk",new Int32Array(0));v(this,"wc",new Int32Array(0));v(this,"ww",new Float64Array(0));v(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,a,c=-1){const l=new Nt(t,e,s,n);l.mat=i,l.heater=c;const u=[],f=[];for(const[m,p,d,g]of r)!(d>m)||!(g>p)||(u.push(Nt.splits(m,d,s)),f.push(Nt.splits(p,g,s)));l.setRects(u,f);const h=mt[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=h.rho*h.cp*l.cellVolume(m)*(a-et);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=mt[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return _o(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],a=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[a])continue;let c=0;for(;c<r-1&&t>n[c+1];)c+=1;let l=0;for(;l<a-1&&e>i[l+1];)l+=1;return this.off[s]+c+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=wn(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=mt[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const f=Math.cos(this.a),h=Math.sin(this.a),m=f*e-h*s,p=h*e+f*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const a=[];for(let f=0;f<this.nr;f+=1){const[h,m,p,d]=this.bounds(f),g=p-h,x=d-m,w=t*g*x*this.depth,y=.5*(h+p),_=.5*(m+d);n+=w,i+=w*((g*g+x*x)/12+y*y+_*_);for(const[F,T]of[[h,m],[p,m],[p,d],[h,d]])a.push([F,T]),r=Math.max(r,Math.hypot(F,T))}this.m=n,this.I=i,this.rmax=r;const c=Fl(a);let l=0,u=0;for(let f=0;f<c.length;f+=1){const[h,m]=c[f],[p,d]=c[(f+1)%c.length],g=h*d-p*m;l+=g/2,u+=g*(h*h+h*p+p*p+m*m+m*d+d*d)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(u),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,a,c]=this.bounds(n),l=(a-i)*(c-r);e+=l,s+=l*(t===0?.5*(i+a):.5*(r+c))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=vf*this.dx;for(let r=0;r<this.nr;r+=1){const[a,c,l,u]=this.bounds(r);for(let f=0;f<4;f+=1){const h=f<2,m=f===0?a:f===1?l:f===2?c:u;let p=[h?[c,u]:[a,l]];for(let d=0;d<this.nr&&p.length>0;d+=1){if(d===r)continue;const[g,x,w,y]=this.bounds(d);if(!(f===0?Math.abs(w-m)<=i:f===1?Math.abs(g-m)<=i:f===2?Math.abs(y-m)<=i:Math.abs(x-m)<=i))continue;const F=h?x:g,T=h?y:w,A=[];for(const[b,k]of p){if(T<=b||F>=k){A.push([b,k]);continue}F>b&&A.push([b,F]),T<k&&A.push([T,k])}p=A}for(const[d,g]of p)g-d<=i||(t.push(r),e.push(f),s.push(d),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),a=this.segS[t],c=this.segT0[t],l=this.segT1[t];a===0?(e[0]=s,e[1]=c,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):a===1?(e[0]=i,e[1]=c,e[2]=i,e[3]=l,e[4]=1,e[5]=0):a===2?(e[0]=c,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=c,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s),l=n-t,u=i-e;r[0]=a*l+c*u,r[1]=-c*l+a*u}static toWorld(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s);r[0]=t+a*n-c*i,r[1]=e+c*n+a*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,a=this.y-e;this.x=t+n*r-i*a,this.y=e+i*r+n*a,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let a=1/0,c=1/0,l=-1/0,u=-1/0;for(let f=0;f<this.nr;f+=1){const[h,m,p,d]=this.bounds(f);for(let g=0;g<4;g+=1){const x=g===0||g===3?h:p,w=g<2?m:d,y=t+i*x-r*w,_=e+r*x+i*w;y<a&&(a=y),y>l&&(l=y),_<c&&(c=_),_>u&&(u=_)}}n[0]=a,n[1]=c,n[2]=l,n[3]=u}}const yf=.004,wf=.02,ei=1e-7,bf=.22,Ff=2.5;class _f{constructor(t,e){v(this,"nx",0);v(this,"ny",0);v(this,"count",0);v(this,"points",[Do(),Do()]);v(this,"friction");v(this,"bounce");v(this,"touched",!0);v(this,"k11",0);v(this,"k12",0);v(this,"k22",0);v(this,"i11",0);v(this,"i12",0);v(this,"i22",0);v(this,"block",!1);v(this,"h",1/120);v(this,"slop",yf);v(this,"spec",wf);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function Do(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function Af(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?Tf(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?No(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?No(o,e,t,!0):kf(o,t,e);for(let a=0;a<o.count;a+=1){const c=o.points[a];c.jn=0,c.jt=0;for(let l=0;l<r;l+=1)if(s[l]===c.id){c.jn=n[l],c.jt=i[l];break}}return o.count}function Ii(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function Tf(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,a=Math.hypot(i,r);if(a>s+n+o.spec)return;const c=a>1e-9?i/a:0,l=a>1e-9?r/a:1;o.nx=c,o.ny=l,Ii(o,t.x+c*(s-(s+n-a)/2),t.y+l*(s-(s+n-a)/2),a-s-n,0)}function No(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,a=0;for(let w=0;w<n.n;w+=1){const y=(e.x-t.wx[w])*t.wnx[w]+(e.y-t.wy[w])*t.wny[w];if(y>i+o.spec)return;y>r&&(r=y,a=w)}const c=(a+1)%n.n,l=t.wx[a],u=t.wy[a],f=t.wx[c],h=t.wy[c];let m,p,d,g,x;if(r<1e-9)m=t.wnx[a],p=t.wny[a],x=r-i,d=e.x-m*i,g=e.y-p*i;else{const w=(e.x-l)*(f-l)+(e.y-u)*(h-u),y=(e.x-f)*(l-f)+(e.y-h)*(u-h);if(w<=0||y<=0){const _=w<=0?l:f,F=w<=0?u:h,T=e.x-_,A=e.y-F,b=Math.hypot(T,A);if(b>i+o.spec)return;m=b>1e-9?T/b:t.wnx[a],p=b>1e-9?A/b:t.wny[a],x=b-i,d=_,g=F}else m=t.wnx[a],p=t.wny[a],x=r-i,d=e.x-m*i,g=e.y-p*i}o.nx=s?-m:m,o.ny=s?-p:p,Ii(o,d,g,x,a)}function Vo(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const a=o.wnx[r],c=o.wny[r],l=o.wx[r],u=o.wy[r];let f=1/0;for(let h=0;h<s.n;h+=1){const m=(t.wx[h]-l)*a+(t.wy[h]-u)*c;m<f&&(f=m)}f>n&&(n=f,i=r)}return{sep:n,edge:i}}function kf(o,t,e){const s=Vo(t,e);if(s.sep>o.spec)return;const n=Vo(e,t);if(n.sep>o.spec)return;let i=t,r=e,a=s.edge,c=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,a=n.edge,c=!0);const l=i.shape,u=r.shape;if(l.kind!=="poly"||u.kind!=="poly")return;const f=(a+1)%l.n,h=i.wx[a],m=i.wy[a],p=i.wx[f],d=i.wy[f],g=i.wnx[a],x=i.wny[a];let w=1/0,y=0;for(let E=0;E<u.n;E+=1){const W=r.wnx[E]*g+r.wny[E]*x;W<w&&(w=W,y=E)}const _=(y+1)%u.n;let F=r.wx[y],T=r.wy[y],A=r.wx[_],b=r.wy[_],k=y,P=_;const M=Math.hypot(p-h,d-m)||1,S=(p-h)/M,C=(d-m)/M,L=S*h+C*m,B=S*p+C*d;for(const[E,W]of[[-1,-L],[1,B]]){const N=E*(S*F+C*T)-W,J=E*(S*A+C*b)-W;if(N>ei&&J>ei)return;if(N>ei){const tt=N/(N-J);F+=(A-F)*tt,T+=(b-T)*tt,k=200+a}else if(J>ei){const tt=N/(N-J);A=F+(A-F)*tt,b=T+(b-T)*tt,P=300+a}}const I=(c?1e4:0)+a*1e3,j=(F-h)*g+(T-m)*x,R=(A-h)*g+(b-m)*x;o.nx=c?-g:g,o.ny=c?-x:x,j<=o.spec&&Ii(o,F-g*j/2,T-x*j/2,j,I+k),R<=o.spec&&Ii(o,A-g*R/2,b-x*R/2,R,I+P)}function Pf(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,a=-n;for(let c=0;c<o.count;c+=1){const l=o.points[c];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const u=l.rax*i-l.ray*n,f=l.rbx*i-l.rby*n,h=e.invM+s.invM+e.invI*u*u+s.invI*f*f;l.massN=h>0?1/h:0;const m=l.rax*a-l.ray*r,p=l.rbx*a-l.rby*r,d=e.invM+s.invM+e.invI*m*m+s.invI*p*p;l.massT=d>0?1/d:0,l.bias=l.sep>0?-l.sep/t:Math.min(Ff,bf/t*Math.max(0,-l.sep-o.slop));const g=s.vx-s.w*l.rby-e.vx+e.w*l.ray,x=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,w=g*n+x*i;l.bounce=w<-.6&&(l.sep<=o.slop||l.sep+w*t<0)?-o.bounce*w:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const c=o.points[0],l=o.points[1],u=c.rax*i-c.ray*n,f=c.rbx*i-c.rby*n,h=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,p=e.invM+s.invM;o.k11=p+e.invI*u*u+s.invI*f*f,o.k22=p+e.invI*h*h+s.invI*m*m,o.k12=p+e.invI*u*h+s.invI*f*m;const d=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*d&&d>0&&(o.block=!0,o.i11=o.k22/d,o.i12=-o.k12/d,o.i22=o.k11/d)}}function Mf(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];In(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function Sf(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,u=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,f=l*i+u*r,h=o.friction*c.jn,m=Math.max(-h,Math.min(h,c.jt-c.massT*f)),p=m-c.jt;c.jt=m,In(t,e,p*i,p*r,c)}if(o.block){Lf(o);return}for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,u=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,f=l*s+u*n;c.bounce===0&&o.bounce>=.5&&f<-.6&&(c.sep<=o.slop||c.sep+f*o.h<0)&&(c.bounce=-o.bounce*f);const h=Math.max(c.jn+c.massN*(-f+Gr(c)),c.fixed),m=h-c.jn;c.jn=h,In(t,e,m*s,m*n,c),c.bounce>0&&(c.fixed=h,c.bounce=-1,c.kicked=!0)}}const Gr=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function In(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function Lf(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],a=d=>{const g=e.vx-e.w*d.rby-t.vx+t.w*d.ray,x=e.vy+e.w*d.rbx-t.vy-t.w*d.rax;return g*s+x*n},c=i.jn,l=r.jn,u=a(i)-Gr(i)-(o.k11*c+o.k12*l),f=a(r)-Gr(r)-(o.k12*c+o.k22*l),h=(d,g)=>{const x=d-c,w=g-l;In(t,e,x*s,x*n,i),In(t,e,w*s,w*n,r),i.jn=d,r.jn=g};let m=-(o.i11*u+o.i12*f),p=-(o.i12*u+o.i22*f);if(m>=0&&p>=0){h(m,p);return}if(m=-u/o.k11,p=0,m>=0&&o.k12*m+f>=0){h(m,p);return}if(m=0,p=-f/o.k22,p>=0&&o.k12*p+u>=0){h(m,p);return}u>=0&&f>=0&&h(0,0)}const Cf=10,mn={friction:.5,bounce:.1},Of=.01;function is(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),a=new Float64Array([-1,0,1,0]);let c=0;for(let l=0;l<4;l+=1)c=Math.max(c,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:a,n:4,radius:c}}class Ms{constructor(t,e,s,n){v(this,"wx");v(this,"wy");v(this,"wnx");v(this,"wny");v(this,"minX",0);v(this,"minY",0);v(this,"maxX",0);v(this,"maxY",0);v(this,"invM",0);v(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let a=1/0,c=1/0,l=-1/0,u=-1/0;for(let f=0;f<t.n;f+=1){const h=s+i*t.xs[f]-r*t.ys[f],m=n+r*t.xs[f]+i*t.ys[f];this.wx[f]=h,this.wy[f]=m,this.wnx[f]=i*t.nx[f]-r*t.ny[f],this.wny[f]=r*t.nx[f]+i*t.ny[f],h<a&&(a=h),h>l&&(l=h),m<c&&(c=m),m>u&&(u=m)}this.minX=a,this.minY=c,this.maxX=l,this.maxY=u}}class qf{constructor(t){v(this,"parts",[]);v(this,"byBody",[]);v(this,"builtFor",-1);v(this,"warmKey",new Float64Array(0));v(this,"warmData",new Float64Array(0));v(this,"warmCount",0);v(this,"touching",new Uint8Array(0));v(this,"toWake",[]);v(this,"cache",new Map);v(this,"live",[]);v(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,a]=t.bounds(s);e[s].shape=is(n,i,r,a),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new Ms(1,null,is(-1,-1,0,r+1),mn)),s.openR||n.push(new Ms(2,null,is(i,-1,i+1,r+1),mn)),s.openB||n.push(new Ms(3,null,is(-1,-1,i+1,0),mn)),s.openT||n.push(new Ms(4,null,is(-1,r,i+1,r+1),mn));const{nx:a,ny:c,dx:l}=s;let u=new Map,f=10;for(let h=0;h<=c;h+=1){const m=new Map;if(h<c){let p=0;for(;p<a;){const d=p+h*a;if(s.solid[d]===0||s.owner[d]!==0){p+=1;continue}const g=s.solid[d];let x=p;for(;x+1<a&&s.solid[x+1+h*a]===g&&s.owner[x+1+h*a]===0;)x+=1;const w=g<<24|p<<12|x;m.set(w,u.has(w)?u.get(w):h),p=x+1}}for(const[p,d]of u){if(m.get(p)===d)continue;const g=this.solidMaterial(p>>>24);n.push(new Ms(f++,null,is((p>>12&4095)*l,d*l,((p&4095)+1)*l,h*l),g))}u=m}this.byBody=t.map(()=>[]);for(const h of t){if(h.gone)continue;const m=this.solidMaterial(h.mat+1);for(let p=0;p<h.nr;p+=1){const[d,g,x,w]=h.bounds(p),y=is(d,g,x,w),_=new Ms(1e5+h.index*1e3+p,h,y,m);n.push(_),this.byBody[h.index].push(_)}}for(const h of n)h.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=mt[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:mn}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const u of this.parts){const f=u.body;if(f===null)continue;const h=f.awake;u.invM=h?1/f.m:0,u.invI=h?1/f.I:0,u.update()}for(const u of this.cache.values())u.touched=!1;const r=this.live,a=this.liveKey;r.length=0,a.length=0;const c=this.parts;for(let u=0;u<c.length;u+=1){const f=c[u];for(let h=u+1;h<c.length;h+=1){const m=c[h],p=f.invM>0,d=m.invM>0;if(!p&&!d||f.body!==null&&f.body===m.body||m.minX>f.maxX+i||m.maxX<f.minX-i||m.minY>f.maxY+i||m.maxY<f.minY-i)continue;const g=f.id*1e6+m.id;let x=this.cache.get(g);x===void 0&&(x=new _f(f,m),x.slop=n,x.spec=i,this.restore(x,g),this.cache.set(g,x)),x.touched=!0,Af(x)>0?(r.push(x),a.push(g)):x.count=0}}const l=a.map((u,f)=>f).sort((u,f)=>a[u]-a[f]);for(const u of l)Pf(r[u],t);for(const u of l)Mf(r[u]);for(let u=0;u<Cf;u+=1)for(const f of l)Sf(r[f]);for(const u of l){const f=r[u],h=f.a.body,m=f.b.body;if(h!==null&&(this.touching[h.index]=1),m!==null&&(this.touching[m.index]=1),h!==null&&m!==null&&h.asleep!==m.asleep&&!h.pinned&&!m.pinned){const p=h.asleep?m:h,d=h.asleep?h:m;p.speed()>Of&&this.toWake.push(d.index)}}for(const[u,f]of this.cache)(!f.touched||f.count===0)&&this.cache.delete(u);this.save(l.map(u=>a[u]),l.map(u=>r[u]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let a=0;a<2;a+=1){const c=i.points[a];this.warmData[r+1+4*a]=c.id,this.warmData[r+2+4*a]=c.jn,this.warmData[r+3+4*a]=c.jt,this.warmData[r+4+4*a]=c.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const a=9*i;t.count=this.warmData[a];for(let c=0;c<2;c+=1){const l=t.points[c];l.id=this.warmData[a+1+4*c],l.jn=this.warmData[a+2+4*c],l.jt=this.warmData[a+3+4*c],l.kicked=this.warmData[a+4+4*c]===1}return}r<e?s=i+1:n=i-1}}}const be=new Float64Array(16),Fe=new Float64Array(16),si=new Float64Array(16),ni=new Float64Array(16);function ii(o,t,e,s,n,i,r,a){let c=0;for(let l=0;l<o;l+=1){const u=(l+1)%o,f=s*((t===0?n[l]:i[l])-e),h=s*((t===0?n[u]:i[u])-e);if(f<=0&&(r[c]=n[l],a[c]=i[l],c+=1),f<0&&h>0||f>0&&h<0){const m=f/(f-h);r[c]=n[l]+m*(n[u]-n[l]),a[c]=i[l]+m*(i[u]-i[l]),c+=1}}return c}function jf(o,t,e,s,n,i,r,a,c,l,u,f){be[0]=o,Fe[0]=t,be[1]=e,Fe[1]=s,be[2]=n,Fe[2]=i,be[3]=r,Fe[3]=a;let h=ii(4,0,c,-1,be,Fe,si,ni);if(h===0||(h=ii(h,0,u,1,si,ni,be,Fe),h===0)||(h=ii(h,1,l,-1,be,Fe,si,ni),h===0)||(h=ii(h,1,f,1,si,ni,be,Fe),h<3))return 0;let m=0;for(let p=0;p<h;p+=1){const d=(p+1)%h;m+=be[p]*Fe[d]-be[d]*Fe[p]}return Math.abs(.5*m)}function $r(o,t,e,s,n,i,r,a,c){const l=e-o,u=s-t;return ue[0]=0,ue[1]=1,!ri(-l,o-n)||!ri(l,r-o)||!ri(-u,t-i)||!ri(u,a-t)?(c[0]=1,c[1]=0,0):(c[0]=ue[0],c[1]=ue[1],Math.max(0,ue[1]-ue[0]))}const ue=new Float64Array(2);function ri(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>ue[1])return!1;e>ue[0]&&(ue[0]=e)}else{if(e<ue[0])return!1;e<ue[1]&&(ue[1]=e)}return!0}const ar=new Float64Array(2),oi=new Float64Array(16);function If(o,t,e,s,n,i,r,a,c,l,u){const f=Math.cos(e),h=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const x=g===0?a:g===1||g===2?l:a,w=g===0||g===1?c:u,y=g===0||g===1?l:a,_=g===0?c:g===1||g===2?u:c,F=f*(x-o)+h*(w-t),T=-h*(x-o)+f*(w-t),A=f*(y-o)+h*(_-t),b=-h*(y-o)+f*(_-t);$r(F,T,A,b,s,n,i,r,ar)<=0||(oi[2*m]=g+ar[0],oi[2*m+1]=g+ar[1],m+=1)}if(m<2)return!1;const p=1e-9;let d=m;for(let g=0;g<m;g+=1){const x=(g+1)%m,w=oi[2*g+1],y=oi[2*x]+(x===0?4:0);Math.abs(y-w)<=p&&(d-=1)}return d>=2}function Bf(o,t,e){const s=[],n=[];for(const d of o)s.push(d[0],d[2]),n.push(d[1],d[3]);for(const d of t)s.push(d.x0,d.x1),n.push(d.y0,d.y1);for(const d of e)s.push(d.x0,d.x1),n.push(d.y0,d.y1);const i=Uo(s),r=Uo(n),a=i.length-1,c=r.length-1,l=new Uint8Array(Math.max(0,a*c)),u=[],f=[],h=(d,g,x,w,y,_)=>d>x&&d<y&&g>w&&g<_;for(let d=0;d<c;d+=1){const g=.5*(r[d]+r[d+1]);for(let x=0;x<a;x+=1){const w=.5*(i[x]+i[x+1]);let y=!1;for(const F of o)if(h(w,g,F[0],F[1],F[2],F[3])){y=!0;break}let _=-1;if(y){for(const F of t)if(h(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0?u.push(i[x],r[d],i[x+1],r[d+1],_):l[x+d*a]=1}else{for(const F of e)if(h(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0&&(f.push(i[x],r[d],i[x+1],r[d+1],_),l[x+d*a]=1)}}}const m=[];let p=[];for(let d=0;d<=c;d+=1){const g=[];if(d<c)for(let x=0;x<a;){if(l[x+d*a]===0){x+=1;continue}let w=x;for(;w<a&&l[w+d*a]!==0;)w+=1;const y=p.find(_=>_.i0===x&&_.i1===w);g.push(y??{i0:x,i1:w,y0:r[d]}),x=w}for(const x of p)g.includes(x)||m.push([i[x.i0],x.y0,i[x.i1],r[d]]);p=g}return{rects:m,taken:u,added:f}}function Uo(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const Rf=.99,Ho=.5,Ef=.02;class Df{constructor(t){v(this,"w");v(this,"esSync");v(this,"filmSync");v(this,"crustSync");v(this,"wsum");v(this,"best");v(this,"acc");v(this,"split");v(this,"was");v(this,"now");v(this,"stamp");v(this,"fstamp");v(this,"tag",0);v(this,"ftag",0);v(this,"seen");v(this,"queue");v(this,"seenTag",0);v(this,"list",new Int32Array(256));v(this,"listN",0);v(this,"box",new Float64Array(4));v(this,"l0",new Float64Array(2));v(this,"l1",new Float64Array(2));v(this,"wp",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"cb",new Float64Array(4));v(this,"areaK",[]);v(this,"capK",[]);v(this,"splits",[]);v(this,"boxes",new Float64Array(64));v(this,"nx",0);v(this,"ny",0);v(this,"faceOwner");v(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let a=this.areaK[t.index],c=this.capK[t.index];(a===void 0||a.length!==t.ncell)&&(a=new Float64Array(t.ncell),c=new Float64Array(t.ncell),this.areaK[t.index]=a,this.capK[t.index]=c);for(let p=0;p<t.ncell;p+=1)a[p]=t.cellVolume(p)/t.depth,c[p]=t.cellCap(p);const l=Math.cos(t.a),u=Math.sin(t.a);let f=0;const h=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,h);const d=h[0],g=h[1],x=h[2],w=h[3],y=t.x+l*d-u*g,_=t.y+u*d+l*g,F=t.x+l*x-u*g,T=t.y+u*x+l*g,A=t.x+l*x-u*w,b=t.y+u*x+l*w,k=t.x+l*d-u*w,P=t.y+u*d+l*w,M=Math.max(0,Math.floor(Math.min(y,F,A,k)/i)),S=Math.min(s-1,Math.floor(Math.max(y,F,A,k)/i)),C=Math.max(0,Math.floor(Math.min(_,T,b,P)/i)),L=Math.min(n-1,Math.floor(Math.max(_,T,b,P)/i));for(let B=C;B<=L;B+=1)for(let I=M;I<=S;I+=1){const j=I+B*s;if(e.solid[j]!==0&&e.owner[j]===0)continue;const R=jf(y,_,F,T,A,b,k,P,I*i,B*i,(I+1)*i,(B+1)*i);R<=1e-12*a[p]||(f>=t.wk.length&&this.growWeights(t,2*f+64),t.wk[f]=p,t.wc[f]=j,t.ww[f]=R/a[p],f+=1)}}t.nw=f;for(let p=0;p<t.nr;p+=1){const d=t.xs[p][0],g=t.ys[p][0],x=t.xs[p][t.ni[p]],w=t.ys[p][t.nj[p]];let y=1/0,_=1/0,F=-1/0,T=-1/0;for(let M=0;M<4;M+=1){const S=M===0||M===3?d:x,C=M<2?g:w,L=t.x+l*S-u*C,B=t.y+u*S+l*C;y=Math.min(y,L),F=Math.max(F,L),_=Math.min(_,B),T=Math.max(T,B)}const A=Math.max(0,Math.floor(y/i)),b=Math.min(s-1,Math.floor(F/i)),k=Math.max(0,Math.floor(_/i)),P=Math.min(n-1,Math.floor(T/i));for(let M=k;M<=P;M+=1)for(let S=A;S<=b;S+=1)If(t.x,t.y,t.a,d,g,x,w,S*i,M*i,(S+1)*i,(M+1)*i)&&m.push(S+M*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const a=this.list[r],c=a%t,l=(a-c)/t;c<e&&(e=c),c>n&&(n=c),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,a=this.list,c=this.listN;if(this.listN=0,c===0)return 0;const l=1/(i*i);let u=s,f=-1,h=n,m=-1;for(let F=0;F<c;F+=1){const T=a[F],A=T%s,b=(T-A)/s;A<u&&(u=A),A>f&&(f=A),b<h&&(h=b),b>m&&(m=b);const k=e.solid[T]!==0&&e.owner[T]===0;this.was[T]=e.solid[T]!==0&&e.owner[T]!==0?1:0,e.fs[T]=0,e.capB[T]=0,this.wsum[T]=0,this.best[T]=0,this.split[T]=0,e.matB[T]=0,k||(e.Es[T]=0,e.film[T]=0,e.crust[T]=0,e.owner[T]=0)}const p=u*i,d=h*i,g=(f+1)*i,x=(m+1)*i;for(const F of t){if(F.gone||F.nw===0)continue;const T=this.boxOf(F);if(T[0]>g||T[2]<p||T[1]>x||T[3]<d)continue;const A=this.areaK[F.index],b=this.capK[F.index],k=this.acc;for(let M=0;M<F.nw;M+=1){const S=F.wc[M];if(this.stamp[S]!==r)continue;const C=F.wk[M],L=F.ww[M],B=L*A[C]*l;e.fs[S]+=B,k[S]+=B,e.capB[S]+=L*b[C],e.Es[S]+=L*F.E[C],e.film[S]+=L*F.film[C],e.crust[S]+=L*F.crust[C],this.wsum[S]+=L}for(let M=0;M<F.nw;M+=1){const S=F.wc[M];this.stamp[S]!==r||k[S]===0||(k[S]>this.best[S]&&(this.best[S]=k[S],e.owner[S]=F.index+1,e.matB[S]=F.mat+1),k[S]=0)}const P=this.splits[F.index];for(let M=0;M<P.length;M+=1)this.stamp[P[M]]===r&&(this.split[P[M]]=1)}const w=++this.ftag;for(let F=0;F<c;F+=1){const T=a[F],A=T%s,b=(T-A)/s;this.face(t,A,b,!0,w),this.face(t,A+1,b,!0,w),this.face(t,A,b,!1,w),this.face(t,A,b+1,!1,w)}for(let F=0;F<c;F+=1){const T=a[F];e.fs[T]>1&&(e.fs[T]=1);const A=e.solid[T]!==0&&e.owner[T]===0&&this.was[T]===0;this.now[T]=!A&&e.owner[T]!==0&&(e.fs[T]>=Rf||this.split[T]!==0)?1:0}for(let F=0;F<c;F+=1){const T=a[F];this.now[T]!==0||e.owner[T]===0||e.fs[T]<Ho||e.solid[T]!==0&&this.was[T]===0||this.besideOther(T)&&(this.now[T]=1)}let y=0;for(let F=0;F<c;F+=1){const T=a[F];if(this.now[T]===1){this.was[T]===0&&(y+=1,this.gasOut(T));const A=t[e.owner[T]-1];e.solid[T]=A.mat+1,e.kind[T]=dt,e.role[T]=0,e.heater[T]=-1}else this.was[T]===1&&(y+=1,e.solid[T]=0,e.role[T]=0,e.heater[T]=-1,this.vacate(T))}const _=this.w.heat;for(let F=0;F<c;F+=1){const T=a[F];this.esSync[T]=e.Es[T],this.filmSync[T]=e.film[T],this.crustSync[T]=e.crust[T],e.capB[T]>0&&_.deriveSolid(T)}return y}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,a=e.owner[t];for(let c=0;c<4;c+=1){const l=i+(c===0?-1:c===1?1:0),u=r+(c===2?-1:c===3?1:0);if(l<0||u<0||l>=s||u>=n){if(l<0?!e.openL:l>=s?!e.openR:u<0?!e.openB:!e.openT)return!0;continue}const f=l+u*s;if(e.solid[f]!==0&&e.owner[f]===0||e.owner[f]!==0&&e.owner[f]!==a&&(e.solid[f]!==0||e.fs[f]>=Ho))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:a,ny:c,dx:l}=r;if(n?e>a||s>=c:e>=a||s>c)return;const u=n?e+s*(a+1):e+s*a,f=n?u:r.nu+u;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const h=e*l,m=s*l,p=n?h:h+l,d=n?m+l:m;let g=0,x=0,w=0,y=0;const _=this.l0,F=this.l1;for(const b of t){if(b.gone||b.nw===0)continue;const k=this.boxOf(b);if(k[0]>Math.max(h,p)||k[2]<Math.min(h,p)||k[1]>Math.max(m,d)||k[3]<Math.min(m,d))continue;Nt.toLocal(b.x,b.y,b.a,h,m,_),Nt.toLocal(b.x,b.y,b.a,p,d,F);let P=0;for(let M=0;M<b.nr;M+=1){const S=b.xs[M][0],C=b.ys[M][0],L=b.xs[M][b.ni[M]],B=b.ys[M][b.nj[M]];P+=$r(_[0],_[1],F[0],F[1],S,C,L,B,this.seg)}if(!(P<=0)&&(g+=P,P>x)){x=P,y=b.index+1;const M=.5*(h+p),S=.5*(m+d);w=n?b.vx-b.w*(S-b.y):b.vy+b.w*(M-b.x)}}const T=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[u]:r.av[u])>0!=T>0&&(this.topologyChanged=!0),this.faceOwner[f]=y,n?(r.au[u]=T,r.usol[u]=g>0?w:0):(r.av[u]=T,r.vsol[u]=g>0?w:0)}collect(t){const e=this.w.grid;for(const s of t){if(s.gone||s.nw===0)continue;const n=this.capK[s.index],i=fr(0,s.ncell),r=fr(1,s.ncell),a=fr(2,s.ncell);let c=!1;for(let l=0;l<s.nw;l+=1){const u=s.wc[l],f=s.wk[l],h=s.ww[l],m=e.Es[u]-this.esSync[u];m!==0&&e.capB[u]>0&&(i[f]+=m*h*n[f]/e.capB[u],c=!0);const p=e.film[u]-this.filmSync[u];p>0&&this.wsum[u]>0?(r[f]+=p*h/this.wsum[u],c=!0):p<0&&this.filmSync[u]>0&&(r[f]+=p*h*s.film[f]/this.filmSync[u],c=!0);const d=e.crust[u]-this.crustSync[u];d>0&&this.wsum[u]>0?(a[f]+=d*h/this.wsum[u],c=!0):d<0&&this.crustSync[u]>0&&(a[f]+=d*h*s.crust[f]/this.crustSync[u],c=!0)}if(c)for(let l=0;l<s.ncell;l+=1)s.E[l]+=i[l],s.film[l]=Math.max(0,s.film[l]+r[l]),s.crust[l]=Math.max(0,s.crust[l]+a[l])}for(let s=0;s<e.n;s+=1)e.capB[s]<=0||(this.esSync[s]=e.Es[s],this.filmSync[s]=e.film[s],this.crustSync[s]=e.crust[s])}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,a=this.w.bubbles,c=this.box;t.worldBox(t.x,t.y,t.a,c);const l=2*i.dx;for(let u=0;u<r.count;u+=1){const f=r.x[u],h=r.y[u];f<c[0]-l||f>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,f,h,f,h,e,s,n)&&(r.x[u]=this.wp[0],r.y[u]=this.wp[1],this.stopInto(t,r.vx,r.vy,u))}for(let u=0;u<a.count;u+=1){const f=a.x[u],h=a.y[u];f<c[0]-l||f>c[2]+l||h<c[1]-l||h>c[3]+l||this.moveOut(t,f,h,f,h,e,s,n)&&(a.x[u]=this.wp[0],a.y[u]=this.wp[1],a.site[u]=-1,this.stopInto(t,a.vx,a.vy,u))}}hit(t,e,s,n,i,r){const a=2*this.w.grid.dx;let c=0,l=n,u=i;for(let f=0;f<3;f+=1){let h=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(l,e)<p[0]-a||Math.min(l,e)>p[2]+a||Math.max(u,s)<p[1]-a||Math.min(u,s)>p[3]+a||this.moveOut(m,l,u,e,s,m.x,m.y,m.a)&&(l=this.wp[0],u=this.wp[1],r[0]=l,r[1]=u,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(u-m.y),r[5]=m.vy+m.w*(l-m.x),c=1,h=!0)}if(!h)break}return c}moveOut(t,e,s,n,i,r,a,c){const l=this.l1,u=this.l0;Nt.toLocal(t.x,t.y,t.a,e,s,l),Nt.toLocal(r,a,c,n,i,u);const f=Ef*this.w.grid.dx;let h=1/0,m=-1,p=l[0],d=l[1];for(let b=0;b<t.nr;b+=1){const k=t.xs[b][0],P=t.ys[b][0],M=t.xs[b][t.ni[b]],S=t.ys[b][t.nj[b]],C=k-f,L=P-f,B=M+f,I=S+f,j=l[0]>C&&l[0]<B&&l[1]>L&&l[1]<I;if($r(u[0],u[1],l[0],l[1],C,L,B,I,this.seg)<=0&&!j)continue;if(u[0]>C&&u[0]<B&&u[1]>L&&u[1]<I){if(j&&h===1/0){const E=Go(l[0]-C,B-l[0],l[1]-L,I-l[1]);m=E,p=E===0?C:E===1?B:l[0],d=E===2?L:E===3?I:l[1],h=2}}else{const E=this.seg[0];if(E<h){h=E;const W=u[0]+E*(l[0]-u[0]),N=u[1]+E*(l[1]-u[1]),J=Go(Math.abs(W-C),Math.abs(W-B),Math.abs(N-L),Math.abs(N-I));m=J,p=J===0?C:J===1?B:W,d=J===2?L:J===3?I:N}}}if(m<0)return!1;const g=this.w.grid,x=1e-4*g.dx,w=Math.cos(t.a),y=Math.sin(t.a),_=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,T=p+_*x,A=d+F*x;return this.wp[0]=Math.min(g.w-x,Math.max(x,t.x+w*T-y*A)),this.wp[1]=Math.min(g.h-x,Math.max(x,t.y+y*T+w*A)),this.nx=w*_-y*F,this.ny=y*_+w*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,a=t.vx-t.w*r,c=t.vy+t.w*i,l=(e[n]-a)*this.nx+(s[n]-c)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,a=(t-r)/n,c=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let l=0,u=0;for(let g=0;g<4;g+=1){const x=s.across(t,r,a,g);x<0||!c(x)||(l+=s.vgas[x]>0?s.vgas[x]:e.vCell,u+=1)}if(u>0){let g=l;for(let x=0;x<4;x+=1){const w=s.across(t,r,a,x);if(w<0||!c(w))continue;const y=s.vgas[w]>0?s.vgas[w]:e.vCell;u-=1,s.move(t,w,u===0?1:Math.min(1,y/g)),g-=y}return}const f=this.seen,h=this.queue;let m=++this.seenTag,p=0,d=0;for(h[d++]=t,f[t]=m;p<d;){const g=h[p++];if(g!==t&&c(g)){s.move(t,g,1);return}const x=g%n,w=(g-x)/n;for(let y=0;y<4;y+=1){const _=s.across(g,x,w,y);_<0||f[_]===m||e.solid[_]!==0&&e.owner[_]===0||(f[_]=m,h[d++]=_)}}for(m=++this.seenTag,p=0,d=0,h[d++]=t,f[t]=m;p<d;){const g=h[p++];if(g!==t&&c(g)){s.move(t,g,1);return}const x=g%n,w=(g-x)/n;for(let y=0;y<4;y+=1){const _=x+(y===0?-1:y===1?1:0),F=w+(y===2?-1:y===3?1:0);if(_<0||F<0||_>=n||F>=i)continue;const T=_+F*n;f[T]!==m&&(f[T]=m,h[d++]=T)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let a=0,c=0,l=0,u=!1;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||(e.kind[m]===rt&&(u=!0),e.kind[m]!==U||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;a+=p,c+=p*s.rho[m],l+=p*e.T[m]}if(a<=0){e.kind[t]=u?rt:U,s.deriveCell(t);return}e.kind[t]=U,e.T[t]=l/a;const f=c/a*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||e.kind[m]!==U)continue;const p=s.massOf(m);if(p<=0)continue;const d=(s.vgas[m]>0?s.vgas[m]:e.vCell)/a;s.move(m,t,Math.min(.25,f*d/p))}s.deriveCell(t)}}function Go(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const lr=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function fr(o,t){lr[o].length<t&&(lr[o]=new Float64Array(2*t));const e=lr[o];return e.fill(0,0,t),e}const Nf=1.5,Vf=1;class Uf{constructor(t){v(this,"pe");v(this,"re");v(this,"known");v(this,"mass");v(this,"vol");v(this,"out",new Float64Array(3));v(this,"front");v(this,"next");v(this,"vp");v(this,"vr");v(this,"queued");v(this,"tag",0);v(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:a,ny:c,n:l,dx:u}=e,{pe:f,re:h,known:m,mass:p,vol:d}=this;p.fill(0),d.fill(0);for(let b=0;b<s.count;b+=1){const k=e.cellAt(s.x[b],s.y[b]);k<0||(p[k]+=s.mass[b],d[k]+=s.mass[b]/s.rho[b])}for(let b=0;b<l;b+=1){const k=e.kind[b];k===rt?(f[b]=e.pl[b],h[b]=d[b]>0?p[b]/d[b]:n.rhoRef,m[b]=1):k===U&&e.solid[b]===0?(f[b]=n.pGas[b]+e.pg[b],h[b]=i.rho[b]>0?i.rho[b]:r.rhoAmb,m[b]=1):(f[b]=0,h[b]=0,m[b]=0)}const g=t.gy*u,x=this.front,w=this.next,y=this.vp,_=this.vr,F=this.queued,T=++this.tag;let A=0;for(let b=0;b<l;b+=1){if(m[b]!==0)continue;const k=b%a,P=(b-k)/a;(k>0&&m[b-1]===1||k<a-1&&m[b+1]===1||P>0&&m[b-a]===1||P<c-1&&m[b+a]===1)&&(x[A++]=b,F[b]=T)}for(;A>0;){for(let k=0;k<A;k+=1){const P=x[k],M=P%a,S=(P-M)/a;let C=0,L=0,B=0;M>0&&m[P-1]!==0&&(C+=f[P-1],L+=h[P-1],B+=1),M<a-1&&m[P+1]!==0&&(C+=f[P+1],L+=h[P+1],B+=1),S>0&&m[P-a]!==0&&(C+=f[P-a]-h[P-a]*g,L+=h[P-a],B+=1),S<c-1&&m[P+a]!==0&&(C+=f[P+a]+h[P+a]*g,L+=h[P+a],B+=1),y[k]=B>0?C/B:0,_[k]=B>0?L/B:0}let b=0;for(let k=0;k<A;k+=1){const P=x[k];f[P]=y[k],h[P]=_[k],m[P]=2}for(let k=0;k<A;k+=1){const P=x[k],M=P%a,S=(P-M)/a;for(let C=0;C<4;C+=1){const L=M+(C===0?-1:C===1?1:0),B=S+(C===2?-1:C===3?1:0);if(L<0||B<0||L>=a||B>=c)continue;const I=L+B*a;m[I]!==0||F[I]===T||(F[I]=T,w[b++]=I)}}A=b;for(let k=0;k<b;k+=1)x[k]=w[k]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,a=Math.min(n-1.0001,Math.max(0,t/r-.5)),c=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(a),u=Math.floor(c),f=a-l,h=c-u;let m=0,p=0;for(let d=0;d<2;d+=1)for(let g=0;g<2;g+=1){const x=l+g+(u+d)*n;if(this.known[x]===0)continue;const w=(g===0?1-f:f)*(d===0?1-h:h);m+=w*this.pe[x],p+=w}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,a=0,c=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const u=Math.hypot(i[2]-i[0],i[3]-i[1]),f=Math.max(1,Math.ceil(u/(.5*t.dx))),h=u/f*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let d=0;d<f;d+=1){const g=(d+.5)/f,x=i[0]+g*(i[2]-i[0]),w=i[1]+g*(i[3]-i[1]),y=s*x-n*w,_=n*x+s*w,F=this.sideAt(t.x+y,t.y+_,m,p)*h;r-=F*m,a-=F*p,c-=F*(y*p-_*m)}}return e[0]=r,e[1]=a,e[2]=c,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:a}=r,c=t+.5*a*s,l=e+.5*a*n,u=Math.min(r.nx-1.0001,Math.max(0,c/a-.5)),f=Math.min(r.ny-1.0001,Math.max(0,l/a-.5)),h=Math.floor(u),m=Math.floor(f),p=u-h,d=f-m;let g=0,x=0,w=0,y=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const T=h+F,A=m+_,b=T+A*r.nx;if(this.known[b]!==1)continue;const k=(T+.5)*a,P=(A+.5)*a;if((k-t)*s+(P-e)*n<=0)continue;const M=(F===0?1-p:p)*(_===0?1-d:d)+1e-6,S=this.pe[b]+this.re[b]*i.gy*(P-e);r.kind[b]===rt?(g+=M*S,x+=M):(w+=M*S,y+=M)}return x>0&&y>0?Math.max(g/x,w/y):x>0?g/x:y>0?w/y:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let a=0,c=0;for(let f=0;f<t.nseg;f+=1){t.segment(f,r);const h=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(h/t.dx));for(let p=0;p<m;p+=1){const d=(p+.5)/m,g=r[0]+d*(r[2]-r[0])+.5*t.dx*r[4],x=r[1]+d*(r[3]-r[1])+.5*t.dx*r[5],w=s.cellAt(t.x+n*g-i*x,t.y+i*g+n*x);c+=h/m,w>=0&&s.kind[w]===rt&&(a+=h/m)}}const l=c>0?a/c:0,u=e.liquid.rhoRef;t.ma=Nf*u*l*t.hullA*t.depth,t.Ia=Vf*u*l*t.hullJ*t.depth}}const Hf=.1,Gf=1,$f=.002,Wf=.5,Kf=1.02,zf=.5;class Qf{constructor(t){v(this,"list",[]);v(this,"cover");v(this,"forces");v(this,"contacts");v(this,"version",0);v(this,"prev",new Float64Array(0));v(this,"awakeNow",0);v(this,"shapes",!1);v(this,"resized",!1);v(this,"afterCollect",null);v(this,"dv",new Float64Array(3));v(this,"probeS",[]);v(this,"probeJ",[]);v(this,"m9",new Float64Array(9));v(this,"at",new Float64Array(2));this.e=t,this.cover=new Df(t),this.forces=new Uf(()=>t),this.contacts=new qf(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const a=this.e.grid,c=Nt.fromRects(this.list.length,n,a.dx,a.depth,e,t,s,r);return c.gone?null:(c.pinned=i,c.asleep=!0,this.list.push(c),this.grow(),this.cover.weigh(c),this.cover.addCells(c),this.changed(),c)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list)e.awake&&(this.awakeNow+=1,t=!0,this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e));if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a,e.ux=e.vx,e.uy=e.vy,e.uw=e.w);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>Kf*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),a=3*i.index,c=i.ma6;i.maOk||(this.forces.addedMass(i),c.fill(0),c[0]=i.ma,c[3]=i.ma,c[5]=i.Ia);const l=t*r[0]+c[0]*n[a]+c[1]*n[a+1]+c[2]*n[a+2],u=t*(r[1]-i.m*e.gy)+c[1]*n[a]+c[3]*n[a+1]+c[4]*n[a+2],f=t*r[2]+c[2]*n[a]+c[4]*n[a+1]+c[5]*n[a+2];Xf(i.m+c[0],c[1],c[2],i.m+c[3],c[4],i.I+c[5],l,u,f,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[a]=this.dv[0],n[a+1]=this.dv[1],n[a+2]=this.dv[2]}this.contacts.step(t,this.list,this.version,Hf*s.dx,Gf*s.dx);for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<$f&&this.contacts.touches(i)?i.rest+t:0,i.rest>=Wf&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:a,dx:c,depth:l}=i,u=this.cover.faceOwner;for(const f of this.list){if(!f.awake)continue;const h=f.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const d=this.cover.boxOf(f),g=Math.max(0,Math.floor(d[0]/c)-1),x=Math.min(r,Math.floor(d[2]/c)+2),w=Math.max(0,Math.floor(d[1]/c)-1),y=Math.min(a,Math.floor(d[3]/c)+2);for(let A=w;A<Math.min(a,y);A+=1)for(let b=g;b<=x;b+=1){const k=b+A*(r+1);if(u[k]!==h)continue;const P=(A+.5)*c,M=b>0?b-1+A*r:-1,S=b<r?b+A*r:-1,L=M>=0&&i.kind[M]===dt||S>=0&&i.kind[S]===dt?1:1-i.au[k];L<=0||(M>=0&&i.kind[M]===rt&&(m.push(t.at(b-1-e,A-s)),p.push(L,0,-L*(P-f.y))),S>=0&&i.kind[S]===rt&&(m.push(t.at(b-e,A-s)),p.push(-L,0,L*(P-f.y))))}for(let A=w;A<=y;A+=1)for(let b=g;b<Math.min(r,x);b+=1){const k=b+A*r;if(u[i.nu+k]!==h)continue;const P=(b+.5)*c,M=A>0?b+(A-1)*r:-1,S=A<a?b+A*r:-1,L=M>=0&&i.kind[M]===dt||S>=0&&i.kind[S]===dt?1:1-i.av[k];L<=0||(M>=0&&i.kind[M]===rt&&(m.push(t.at(b-e,A-1-s)),p.push(0,L,L*(P-f.x))),S>=0&&i.kind[S]===rt&&(m.push(t.at(b-e,A-s)),p.push(0,-L,-L*(P-f.x))))}if(m.length===0){f.ma6.fill(0),f.maOk=!0;continue}const _=t.system,F=this.m9;for(let A=0;A<3;A+=1){_.b.fill(0),_.x.fill(0);for(let b=0;b<m.length;b+=1)_.b[m[b]]-=c*p[3*b+A];t.solve(1e-4,40,!0);for(let b=0;b<3;b+=1){let k=0;for(let P=0;P<m.length;P+=1)k+=_.x[m[P]]*p[3*P+b];F[3*b+A]=-n*c*l*k}}const T=f.ma6;T[0]=F[0],T[1]=.5*(F[1]+F[3]),T[2]=.5*(F[2]+F[6]),T[3]=F[4],T[4]=.5*(F[5]+F[7]),T[5]=F[8],f.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,zf*e.dx/s))}return t}wake(t){if(!t.free||!t.asleep)return;t.asleep=!1,t.rest=0,t.maOk=!1;const e=3*t.index;this.prev[e]=0,this.prev[e+1]=0,this.prev[e+2]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(Ve(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let a=this.list.length-1;a>=0;a-=1){const c=this.list[a];if(!c.gone&&(Nt.toLocal(c.x,c.y,c.a,t,e,n),c.insideLocal(n[0],n[1],r)))return c}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=new Float64Array(3*this.list.length+24);t.set(this.prev),this.prev=t}}}function Xf(o,t,e,s,n,i,r,a,c,l){const u=s*i-n*n,f=e*n-t*i,h=t*n-e*s,m=o*u+t*f+e*h,p=o*i-e*e,d=t*e-o*n,g=o*s-t*t;l[0]=(u*r+f*a+h*c)/m,l[1]=(f*r+p*a+d*c)/m,l[2]=(h*r+d*a+g*c)/m}const $o=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Ss(o){if(o===null||typeof o!="object")return null;const t=o,e=(a,c)=>{if(!Array.isArray(a)||a.length!==c)return null;const l=a.map($o);return l.every(u=>u!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(c=>e(c,2));if(a.every(c=>c!==null))return{poly:a.map(c=>[c[0],c[1]])}}const i=e(t.line,4),r=$o(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function Ue(o,t,e){if("rect"in o){const[m,p,d,g]=o.rect;return t>=m&&t<=d&&e>=p&&e<=g}if("circle"in o){const[m,p,d]=o.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=d*d}if("poly"in o){const m=o.poly;let p=!1;for(let d=0,g=m.length-1;d<m.length;g=d,d+=1){const[x,w]=m[d],[y,_]=m[g];w>e!=_>e&&t<(y-x)*(e-w)/(_-w)+x&&(p=!p)}return p}const[s,n,i,r]=o.line,a=i-s,c=r-n,l=a*a+c*c,u=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*c)/l)):0,f=t-(s+u*a),h=e-(n+u*c);return f*f+h*h<=.25*o.width*o.width}function hn(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,a,c]=o.circle;return[r-c,a-c,r+c,a+c]}if("poly"in o){let r=1/0,a=1/0,c=-1/0,l=-1/0;for(const[u,f]of o.poly)r=Math.min(r,u),a=Math.min(a,f),c=Math.max(c,u),l=Math.max(l,f);return[r,a,c,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Ls(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const Bi=.05;function Wo(o,t){const e=o.latentOffset(),s=Wr(o,t.filter(([n,i,r,a])=>r-n>Bi*o.dx&&a-i>Bi*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function Wr(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,a=o.nr,c=o.E,l=o.film,u=o.crust;let f=0,h=0,m=0;for(let y=0;y<o.ncell;y+=1)f+=c[y],h+=l[y],m+=u[y];const p=[],d=[];for(const[y,_,F,T]of t)!(F>y)||!(T>_)||(p.push(Nt.splits(y,F,o.dx)),d.push(Nt.splits(_,T,o.dx)));o.setRects(p,d);let g=0,x=0,w=0;for(let y=0;y<o.nr;y+=1){const _=o.xs[y],F=o.ys[y];for(let T=0;T<o.nj[y];T+=1)for(let A=0;A<o.ni[y];A+=1){const b=o.off[y]+A+T*o.ni[y],k=_[A],P=_[A+1],M=F[T],S=F[T+1];for(let C=0;C<a;C+=1){const L=e[C],B=s[C];if(!(L[0]>=P||L[n[C]]<=k||B[0]>=S||B[i[C]]<=M))for(let I=0;I<i[C];I+=1){const j=Math.min(S,B[I+1])-Math.max(M,B[I]);if(!(j<=0))for(let R=0;R<n[C];R+=1){const E=Math.min(P,L[R+1])-Math.max(k,L[R]);if(E<=0)continue;const W=r[C]+R+I*n[C],N=E*j/((L[R+1]-L[R])*(B[I+1]-B[I]));o.E[b]+=N*c[W],o.film[b]+=N*l[W],o.crust[b]+=N*u[W]}}}g+=o.E[b],x+=o.film[b],w+=o.crust[b]}}return{energy:f-g,film:h-x,crust:m-w}}function Yf(o,t,e,s,n){const[i,r,a,c]=o;if(s<=i||t>=a||n<=r||e>=c)return null;const l=[],u=Math.max(i,t),f=Math.min(a,s);return t>i&&l.push([i,r,t,c]),s<a&&l.push([s,r,a,c]),e>r&&l.push([u,r,f,e]),n<c&&l.push([u,n,f,c]),l}function Zf(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let a=0;a<r.length;a+=1){const[c,l,u,f]=o[r[a]];for(let h=0;h<e;h+=1){if(s[h]>=0)continue;const[m,p,d,g]=o[h],x=(Math.abs(u-m)<=t||Math.abs(d-c)<=t)&&Math.min(f,g)-Math.max(l,p)>t,w=(Math.abs(f-p)<=t||Math.abs(g-l)<=t)&&Math.min(u,d)-Math.max(c,m)>t,y=Math.min(u,d)-Math.max(c,m)>t&&Math.min(f,g)-Math.max(l,p)>t;(x||w||y)&&(s[h]=n.length,r.push(h))}}n.push(r)}return n}function Jf(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let a=0;a<n;a+=1){const c=s[a];if(c.gone)continue;let l=1/0,u=1/0,f=-1/0,h=-1/0;if("circle"in t){const[T,A,b]=t.circle;Nt.toLocal(c.x,c.y,c.a,T,A,i),l=i[0]-b,f=i[0]+b,u=i[1]-b,h=i[1]+b}else{const[T,A,b,k]=hn(t);for(const[P,M]of[[T,A],[b,A],[b,k],[T,k]])Nt.toLocal(c.x,c.y,c.a,P,M,i),l=Math.min(l,i[0]),f=Math.max(f,i[0]),u=Math.min(u,i[1]),h=Math.max(h,i[1])}const m=[];let p=!1;for(let T=0;T<c.nr;T+=1){const A=c.bounds(T),b=Yf(A,l,u,f,h);if(b===null){m.push(A);continue}p=!0;for(const k of b)m.push(k)}if(!p)continue;r=!0,o.cover.release(c);const d=Ve(c.mat)>0,g={E:c.energy(),F:c.filmMass(),K:c.crustMass(),M:d?c.m:0},x=Ua(o,c,m.filter(T=>T[2]-T[0]>Bi*c.dx&&T[3]-T[1]>Bi*c.dx));let w=0,y=0,_=0,F=0;for(const T of x)w+=T.energy(),y+=T.filmMass(),_+=T.crustMass(),F+=d?T.m:0;e.energy-=g.E-c.energy()-w,e.water-=g.F-c.filmMass()-y+(d?g.M-c.m-F:0),e.salt-=g.K-c.crustMass()-_,c.gone||c.ncell===0?(c.gone=!0,c.ncell=0):(o.cover.weigh(c),o.cover.addCells(c))}return r&&o.changed(),r}function Ua(o,t,e,s=!0){const n=o.list,i=Zf(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let a=1;a<i.length;a+=1){const c=new Nt(n.length,t.key,t.dx,t.depth);c.mat=t.mat,c.heater=t.heater,c.xs=t.xs.map(l=>l.slice()),c.ys=t.ys.map(l=>l.slice()),c.nr=t.nr,c.ni=t.ni.slice(),c.nj=t.nj.slice(),c.off=t.off.slice(),c.ncell=t.ncell,c.E=t.E.slice(),c.film=t.film.slice(),c.crust=t.crust.slice(),c.x=t.x,c.y=t.y,c.a=t.a,c.m=t.m,Wo(c,i[a].map(l=>e[l])),c.rx=c.x,c.ry=c.y,c.ra=c.a,c.pinned=t.pinned,c.asleep=t.asleep,c.vx=t.vx,c.vy=t.vy,c.w=t.w,n.push(c),o.grow(),o.cover.weigh(c),o.cover.addCells(c),r.push(c)}return Wo(t,i.length>0?i[0].map(a=>e[a]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function t0(o,t,e){const[s,n,i,r]=hn(t),a=[],c=new Float64Array(4);for(const l of o.list){if(l.gone||e!==void 0&&!e(l))continue;l.worldBox(l.x,l.y,l.a,c);const u=.001*l.dx;c[0]>=i-u||c[2]<=s+u||c[1]>=r-u||c[3]<=n+u||(o.cover.release(l),a.push(l))}return a}function e0(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(Ve(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function Ko(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const Kt=new Float64Array(6);function ci(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let a=0;a<r;a+=1){const c=e===0?0:e===1?n-1:a,l=e===2?0:e===3?i-1:a,u=o.off[t]+c+l*n,f=e<2?o.ys[t][l]:o.xs[t][c],h=e<2?o.ys[t][l+1]:o.xs[t][c+1],m=Ha(o,t,e,f,h);s(u,h-f,h>f?m/(h-f):0)}}function Ha(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function zo(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function Ga(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function s0(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=Ga(o,t,n);i>s&&(s=i,e=n)}return e}function $a(o,t,e,s){t.segment(e,Kt);const n=Math.hypot(Kt[2]-Kt[0],Kt[3]-Kt[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),a=Math.sin(t.a),c=r*Kt[4]-a*Kt[5],l=a*Kt[4]+r*Kt[5],u=Kt[0],f=Kt[1],h=Kt[2]-Kt[0],m=Kt[3]-Kt[1];for(let p=0;p<i;p+=1){const d=(p+.5)/i,g=u+d*h,x=f+d*m;s(t.x+r*g-a*x,t.y+a*g+r*x,c,l,n/i)}}function Kr(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx;let a=-1,c=-1,l=-1;$a(o,t,e,(u,f,h,m,p)=>{const d=i.cellAt(u+r*h,f+r*m);if(d<0||i.solid[d]!==0){a=d;return}if(d!==a&&s(d,p),a=d,n){const x=i.cellAt(u+(i.dx+r)*h,f+(i.dx+r)*m);x>=0&&x!==d&&x!==l&&i.solid[x]===0&&s(x,p),l=x}const g=i.cellAt(u-r*h,f-r*m);g>=0&&g!==d&&g!==c&&i.solid[g]===0&&i.kind[g]===rt&&s(g,p),c=g})}function n0(o,t,e,s,n){const i=o.exchange;let r=0,a=0;for(let c=0;c<t.nseg;c+=1)t.segR[c]!==e||t.segS[c]!==s||Kr(o,t,c,l=>{r+=i.salt[l],a+=i.water[l],n.add(4*e+s)});return!(a>0)||!(r>0)?Ve(t.mat):Ra(r/(a*Je))}function i0(o,t,e,s,n){const i=o.grid,r=o.exchange,a=i.n,c=.05*i.dx;let l=0;for(let u=0;u<t.nseg;u+=1)t.segR[u]!==e||t.segS[u]!==s||$a(o,t,u,(f,h,m,p,d)=>{var y;const g=i.cellAt(f+c*m,h+c*p);if(g<0)return;let x,w;i.solid[g]!==0?(x=i.T[g],w=((y=mt[i.solid[g]-1])==null?void 0:y.k)??0):r.cap[g]>0?(x=r.capT[g]/r.cap[g],w=Mn(x)):(x=i.T[g],w=go(i.mg[g],i.mg[a+g],i.mg[Z*a+g],x)),x>n&&(l+=w*(x-n)*d)});return l}const r0=.3,o0=1.6,ai=.05,c0=2,a0=.25,Qo=.5,ur=1e-6;class l0{constructor(t){v(this,"pending",[]);v(this,"melted",0);v(this,"frozen",0);v(this,"head",new Int32Array(0));v(this,"next",new Int32Array(0));v(this,"listed",!1);this.e=t}pendingTotals(){let t=0,e=0,s=0;for(const n of this.pending)n!==void 0&&(t+=n.m-n.s,e+=n.H,s+=n.s);return{m:t,H:e,s}}any(){return this.e.bodies.list.some((t,e)=>{var s;return!t.gone&&Ve(t.mat)>0||(((s=this.pending[e])==null?void 0:s.m)??0)>0})}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&Ve(i.mat)>0&&this.body(i)&&(t=!0);const r=this.pending[n];r!==void 0&&r.m>0&&this.spawn(i,r)}return t}body(t){const e=mt[t.mat].rho,s=mt[t.mat].cp,n=wn(t.mat),i=new Map,r=new Set,a=new Map;for(let y=0;y<t.nseg;y+=1){const _=4*t.segR[y]+t.segS[y];if(i.has(_))continue;const F=n0(this.e,t,t.segR[y],t.segS[y],r);i.set(_,F),a.set(_,i0(this.e,t,t.segR[y],t.segS[y],F))}const c=new Map;for(let y=0;y<t.nr;y+=1)this.excess(t,y,i,r,a,c);const l=this.walls(t,[...i.keys()]),u=new Map,f=new Map,h=new Map,m=new Map,p=new Map;for(const[y,_]of i){const F=y>>2,T=y&3,A=s*(_-et)+n,b=At(_)-A;let k=0;ci(t,F,T,(S,C,L)=>{L>0&&(k+=L*C*(b+s*(_-Math.min(_,t.cellT(S)))))});const P=this.planFreeze(t,F,T,_,b);u.set(y,{L:b,hIce:A,denom:k,plan:P});const M=l.get(y);f.set(M,(f.get(M)??0)+(c.get(y)??0)),h.set(M,(h.get(M)??0)+k),m.set(M,(m.get(M)??0)+((P==null?void 0:P.total)??0)),p.set(M,(p.get(M)??0)+Ga(t,F,T))}const d=[];for(const[y,_]of i){const F=y>>2,T=y&3,A=l.get(y),b=u.get(y),k=c.get(y)??0,P=f.get(A)??0,M=h.get(A)??0;P>0&&M>0?d.push({r:F,s:T,d:P/(e*t.depth*M),Q:k,Tf:_,hIce:b.hIce,freeze:null}):k>0&&this.giveBack(t,F,T,k);const S=m.get(A)??0;S>0&&d.push({r:F,s:T,d:S/(e*t.depth*p.get(A)),Q:0,Tf:_,hIce:b.hIce,freeze:b.plan??{p:[],dm:[],total:0}})}if(d.length===0)return!1;const g=Yo(t),x=this.e.bodies;if(x.cover.release(t),t.nr===1?this.moveSides(t,d):this.slabs(t,d),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,x.changed(),!0;let w=0;if(t.nr>1){const y=[];for(let _=0;_<t.nr;_+=1)y.push(t.bounds(_));w=Ua(x,t,y,!1).length}return t.derive(),x.cover.weigh(t),x.cover.addCells(t),d.some(y=>y.freeze!==null)&&x.cover.pushOut(t,t.x,t.y,t.a),x.reshaped(t,w>0||Yo(t)!==g),!0}excess(t,e,s,n,i,r){const a=[];for(let d=0;d<4;d+=1)n.has(4*e+d)&&a.push(d);if(a.length===0)for(let d=0;d<4;d+=1)s.has(4*e+d)&&a.push(d);let c=1/0;for(let d=0;d<4;d+=1)c=Math.min(c,s.get(4*e+d)??1/0);if(c===1/0)return;const l=t.xs[e],u=t.ys[e],f=t.ni[e],h=t.nj[e],m=[0,0],p=[0,0];for(let d=0;d<h;d+=1)for(let g=0;g<f;g+=1){const x=t.off[e]+g+d*f,w=t.cellT(x);if(!(w>c))continue;let y=0,_=0;for(let S=0;S<4&&y<2;S+=1){if(!(S===0?g===0:S===1?g===f-1:S===2?d===0:d===h-1))continue;const C=i.get(4*e+S)??0;!(C>0)||!(Ha(t,e,S,S<2?u[d]:l[g],S<2?u[d+1]:l[g+1])>0)||(m[y]=S,p[y]=C,_+=C,y+=1)}if(y>0){const S=t.E[x];for(let C=0;C<y;C+=1){const L=4*e+m[C],B=p[C]/_*(S-Hr(t.cellCap(x),t.film[x],t.crust[x],s.get(L)));B>0&&(t.E[x]-=B,r.set(L,(r.get(L)??0)+B))}continue}if(a.length===0)continue;const F=.5*(l[g]+l[g+1]),T=.5*(u[d]+u[d+1]);let A=a[0],b=1/0;for(const S of a){const C=S===0?F-l[0]:S===1?l[f]-F:S===2?T-u[0]:u[h]-T;C<b&&(b=C,A=S)}const k=4*e+A,P=s.get(k);if(!(w>P))continue;const M=t.E[x]-Hr(t.cellCap(x),t.film[x],t.crust[x],P);M>0&&(t.E[x]-=M,r.set(k,(r.get(k)??0)+M))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,a=this.e.particles,c={p:[],dm:[],total:0},l=u=>{if(!(r.cap[u]>0)||!(r.water[u]>0))return;const f=r.capT[u]/r.cap[u];if(f>=n)return;const h=Math.min(Qo*r.water[u],r.cap[u]*(n-f)/Math.max(1,i));if(!(h>0))return;let m=0;this.inCell(u,p=>{if(a.mat[p]!==ut)return;const d=a.mass[p]-a.smass[2*p],g=Math.min(Qo*d,h*d/r.water[u]);g>0&&(c.p.push(p),c.dm.push(g),m+=g)}),r.water[u]-=m,r.cap[u]=0,c.total+=m};for(let u=0;u<t.nseg;u+=1)t.segR[u]===e&&t.segS[u]===s&&Kr(this.e,t,u,l);return c.total>0?c:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let a=0;a<t.p.length;a+=1){const c=t.p[a],l=t.dm[a]*e;if(!(l>0))continue;const u=n.mass[c]/n.rho[c],f=n.mass[c]*n.h[c]-l*s;n.mass[c]-=l,n.h[c]=f/n.mass[c],n.derive(c),i.dVp[c]+=n.mass[c]/n.rho[c]-u,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=mt[t.mat].rho,a=Math.min(n,this.rowThickness(t,e,s));let c=0,l=0,u=0,f=0;if(ci(t,e,s,(h,m)=>{const p=t.cellVolume(h);if(!(p>0))return;const d=m*a*t.depth/p;l+=d*t.E[h],u+=d*t.film[h],f+=d*t.crust[h],t.E[h]-=d*t.E[h],t.film[h]-=d*t.film[h],t.crust[h]-=d*t.crust[h],c+=r*m*a*t.depth}),this.moveSide(t,e,s,-a),!(c>0)){this.giveBack(t,e,s,i+l);return}this.melted+=c,this.give(t,e,s,c+u+f,l+c*wn(t.mat)+i,f)}grow(t,e,s,n,i){const r=mt[t.mat].rho,a=mt[t.mat].cp,c=zo(t,e,s),l=n/(r*t.depth*c);ci(t,e,s,(u,f)=>{t.E[u]+=r*f*l*t.depth*a*(i-et)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=zo(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}ci(t,e,s,(r,a)=>{t.E[r]+=n*a/i})}slabs(t,e){const s=mt[t.mat].rho,n=mt[t.mat].cp,i=wn(t.mat),r=t.depth,a=e.length,c=this.walls(t,e.map(k=>4*k.r+k.s)),l=e.map(k=>c.get(4*k.r+k.s)),u=new Map;for(const k of e)k.freeze===null&&u.set(4*k.r+k.s,k.d);const f=[];for(let k=0;k<t.nr;k+=1)f.push(t.bounds(k));const h=new Map;for(const k of e)h.set(4*k.r+k.s,(h.get(4*k.r+k.s)??0)+(k.freeze!==null?k.d:-k.d));const m=[],p=[];for(let k=0;k<a;k+=1){const P=e[k],M=f[P.r];for(let S=0;S<t.nseg;S+=1)if(!(t.segR[S]!==P.r||t.segS[S]!==P.s))if(P.freeze===null){const C=t.segT0[S]-this.inner(t,S,!1,u),L=t.segT1[S]+this.inner(t,S,!0,u);m.push(Xo(P.s,M,C,L,Math.min(P.d,P.s<2?M[2]-M[0]:M[3]-M[1]),!0,k))}else{const C=t.segT0[S]-this.corner(t,P.r,P.s,!1,t.segT0[S],h),L=t.segT1[S]+this.corner(t,P.r,P.s,!0,t.segT1[S],h);L>C&&p.push(Xo(P.s,M,C,L,P.d,!1,k))}}const d=Bf(f,m,p),g=d.taken,x=new Float64Array(a);for(let k=0;k<g.length;k+=5)x[g[k+4]]+=(g[k+2]-g[k])*(g[k+3]-g[k+1]);for(let k=0;k<a;k+=1)e[k].freeze===null&&!(x[k]>0)&&this.giveBack(t,e[k].r,e[k].s,e[k].Q);const w=new Float64Array(a),y=new Float64Array(a),_=new Float64Array(a);for(let k=0;k<g.length;k+=5){const P=g[k+4];this.overlap(t,g[k],g[k+1],g[k+2],g[k+3],(M,S)=>{w[P]+=S*t.E[M],y[P]+=S*t.film[M],_[P]+=S*t.crust[M]})}for(let k=0;k<a;k+=1){const P=e[k];if(P.freeze!==null||!(x[k]>0))continue;const M=s*r*x[k];this.melted+=M,this.give(t,P.r,P.s,M+y[k]+_[k],w[k]+M*i+P.Q,_[k])}Wr(t,d.rects);const F=d.added,T=new Float64Array(a);for(let k=0;k<F.length;k+=5){const P=F[k+4],M=e[P].Tf;T[P]+=(F[k+2]-F[k])*(F[k+3]-F[k+1]),this.overlap(t,F[k],F[k+1],F[k+2],F[k+3],(S,C,L)=>{t.E[S]+=s*r*L*n*(M-et)})}const A=new Map,b=new Map;for(let k=0;k<a;k+=1){const P=e[k].freeze;if(P===null)continue;const M=l[k];A.set(M,(A.get(M)??0)+s*r*T[k]),b.set(M,(b.get(M)??0)+P.total)}for(let k=0;k<a;k+=1){const P=e[k].freeze;if(P===null||!(P.total>0))continue;const M=l[k];this.take(P,A.get(M)/b.get(M),e[k].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let a=r;for(;s.get(a)!==a;)a=s.get(a);return a};if(t.nr>1){const r=ur*t.dx,a=c=>{const l=t.segR[c],u=t.segS[c];return u===0?t.xs[l][0]:u===1?t.xs[l][t.ni[l]]:u===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let c=0;c<t.nseg;c+=1)for(let l=c+1;l<t.nseg;l+=1){if(t.segS[c]!==t.segS[l]||Math.abs(a(c)-a(l))>r||Math.abs(t.segT1[c]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[c])>r)continue;const u=4*t.segR[c]+t.segS[c],f=4*t.segR[l]+t.segS[l];if(!s.has(u)||!s.has(f))continue;const h=n(u),m=n(f);h!==m&&s.set(Math.max(h,m),Math.min(h,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=ur*t.dx,r=t.segR[e],a=t.segS[e],c=s?t.segT1[e]:t.segT0[e],l=a===0?t.xs[r][0]:a===1?t.xs[r][t.ni[r]]:a===2?t.ys[r][0]:t.ys[r][t.nj[r]],u=a<2?l:c,f=a<2?c:l,h=a===0?-1:a===1?1:0,m=a===2?-1:a===3?1:0;for(let p=0;p<t.nseg;p+=1){const d=t.segS[p];if(d<2==a<2)continue;const g=n.get(4*t.segR[p]+d);if(g===void 0)continue;const x=t.segR[p],w=d===0?t.xs[x][0]:d===1?t.xs[x][t.ni[x]]:d===2?t.ys[x][0]:t.ys[x][t.nj[x]];for(const[y,_]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const F=d<2?w:y,T=d<2?y:w;if(Math.abs(F-u)>i||Math.abs(T-f)>i)continue;const A=d<2?w:_,b=d<2?_:w;if((A-u)*h+(b-f)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[a,c,l,u]=t.bounds(e),f=ur*t.dx,h=s<2?n?u:c:n?l:a;if(Math.abs(i-h)>f)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?a:s===1?l:s===2?c:u;for(let d=0;d<t.nseg;d+=1)if(t.segR[d]===e&&t.segS[d]===m&&t.segT0[d]<=p+f&&t.segT1[d]>=p-f)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let a=0;a<t.nr;a+=1){const c=t.xs[a],l=t.ys[a],u=t.ni[a],f=t.nj[a];if(!(c[0]>=n||c[u]<=e||l[0]>=i||l[f]<=s))for(let h=0;h<f;h+=1){const m=Math.min(i,l[h+1])-Math.max(s,l[h]);if(!(m<=0))for(let p=0;p<u;p+=1){const d=Math.min(n,c[p+1])-Math.max(e,c[p]);d<=0||r(t.off[a]+p+h*u,d*m/((c[p+1]-c[p])*(l[h+1]-l[h])),d*m)}}}}give(t,e,s,n,i,r=0){const a=this.e.grid,c=this.e.particles,l=this.e.liquid,u=[],f=new Set;let h=0;for(let p=0;p<2&&u.length===0;p+=1)for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||Kr(this.e,t,d,g=>{a.kind[g]!==rt||f.has(g)||(f.add(g),this.inCell(g,x=>{c.mat[x]===ut&&(u.push(x),h+=c.mass[x])}))},p===1);if(u.length===0||!(h>0)){this.hold(t,e,s,n,i,r);return}const m=l.rhoRef*a.vCell/4;for(const p of u){const d=c.mass[p]/h,g=c.mass[p]/c.rho[p],x=c.mass[p]*c.h[p]+d*i;c.mass[p]+=d*n,r>0&&(c.smass[2*p]+=d*r,c.spc[2*p]=Wn),c.h[p]=x/c.mass[p],c.derive(p),l.dVp[p]+=c.mass[p]/c.rho[p]-g,c.mass[p]>c0*m&&this.split(p)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const u of[i,-i]){const f=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*u)),h=n.cellAt(f,e.y[t]);if(h>=0&&n.solid[h]===0&&this.e.bodies.bodyAt(f,e.y[t],0)===null){r=f;break}}if(Number.isNaN(r))return;const a=.5*e.mass[t],c=.5*e.smass[2*t],l=e.add(r,e.y[t],a,e.h[t],e.mat[t],c);l<0||(e.mass[t]=a,e.smass[2*t]=c,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r=0){const[a,c,l,u]=t.bounds(e),f=s===0?a:s===1?l:.5*(a+l),h=s===2?c:s===3?u:.5*(c+u),m=s===0?-1:s===1?1:0,p=s===2?-1:s===3?1:0,d=Math.cos(t.a),g=Math.sin(t.a),x=this.pending[t.index]??(this.pending[t.index]={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1});x.m+=n,x.H+=i,x.s+=r,x.x=t.x+d*f-g*h,x.y=t.y+g*f+d*h,x.nx=d*m-g*p,x.ny=g*m+d*p}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;if(e.m<a0*r&&!t.gone)return;const a=this.freeSpot(e.x+.3*s.dx*e.nx,e.y+.3*s.dx*e.ny);if(a===null)return;const c=n.add(a[0],a[1],e.m,e.H/e.m,ut,e.s);c<0||(n.vx[c]=t.gone?0:t.vx,n.vy[c]=t.gone?0:t.vy,i.placeParticle(c),i.dVp[c]=e.m/n.rho[c],e.m=0,e.H=0,e.s=0)}freeSpot(t,e){const s=this.e.grid,n=(i,r)=>{if(!(i>0&&r>0&&i<s.w&&r<s.h))return!1;const a=s.cellAt(i,r);return a>=0&&s.solid[a]===0&&this.e.bodies.bodyAt(i,r,0)===null};if(n(t,e))return[t,e];for(let i=1;i<=3;i+=1)for(let r=i;r>=-i;r-=1)for(let a=-i;a<=i;a+=1)if(Math.max(Math.abs(a),Math.abs(r))===i&&n(t+a*s.dx,e+r*s.dx))return[t+a*s.dx,e+r*s.dx];return null}tidy(t){const e=t.dx;let s=!1;for(let a=0;a<t.nr;a+=1){const[c,l,u,f]=t.bounds(a);if(u-c<ai*e||f-l<ai*e){s=!0;continue}for(let h=0;h<4;h+=1){const m=this.rowThickness(t,a,h),p=h<2?t.ni[a]:t.nj[a];(m<r0*e&&p>1||m>o0*e)&&(s=!0)}}if(!s)return;const n=mt[t.mat].rho,i=wn(t.mat),r=[];for(let a=0;a<t.nr;a+=1){const[c,l,u,f]=t.bounds(a);if(u-c>=ai*e&&f-l>=ai*e){r.push([c,l,u,f]);continue}const h=n*(u-c)*(f-l)*t.depth;let m=0,p=0,d=0;for(let g=t.off[a];g<t.off[a]+t.ni[a]*t.nj[a];g+=1)m+=t.E[g],p+=t.film[g],d+=t.crust[g];this.melted+=h,this.give(t,a,s0(t,a),h+p+d,m+h*i,d)}Wr(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function Xo(o,t,e,s,n,i,r){const[a,c,l,u]=t;return o===0?i?{x0:a,y0:e,x1:a+n,y1:s,move:r}:{x0:a-n,y0:e,x1:a,y1:s,move:r}:o===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:o===2?i?{x0:e,y0:c,x1:s,y1:c+n,move:r}:{x0:e,y0:c-n,x1:s,y1:c,move:r}:i?{x0:e,y0:u-n,x1:s,y1:u,move:r}:{x0:e,y0:u,x1:s,y1:u+n,move:r}}function Yo(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const ce=8;class f0{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*lt),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*ce),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<lt;i+=1)this.m[n*lt+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<ce;i+=1)this.force[n*ce+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<lt;s+=1)e+=this.m[t*lt+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<lt;s+=1)this.m[t*lt+s]=this.m[e*lt+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<ce;s+=1)this.force[t*ce+s]=this.force[e*ce+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Wa=200;function hr(o,t,e,s){const n=kt(o);return t/Te(n)-e*Et*n/(s-o)}function u0(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function h0(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function d0(o,t,e,s,n,i,r,a=ut){const c=o[t+Z],l=o[t+at]/gt[at]+o[t+ft]/gt[ft],u=c/gt[Z];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(u+l)*Et*s/e)/(4*Math.PI)),h=e,m=0,p=s,d=0;for(let g=0;g<8;g+=1){if(h=e+2*Ks(a,p)/f,l<=0)m=h,p=kt(m),d=c/Te(p);else if(u<=1e-9*l)m=0,p=s,d=l*Et*p/h;else{let w=611.213,y=h*(1-1e-12),_=hr(w,c,l,h),F=hr(y,c,l,h);if(_<=0)m=w;else if(F>=0)m=y;else{let T=0;m=.5*(w+y);for(let A=0;A<40;A+=1){m=(w*F-y*_)/(F-_);const b=hr(m,c,l,h);if(Math.abs(b)<=1e-12*(c/Te(s)+1e-30))break;b>0?(w=m,_=b,T===1&&(F/=2),T=1):(y=m,F=b,T===-1&&(_/=2),T=-1)}}p=kt(m),d=c/Te(p)}const x=u0(d,n);if(Math.abs(x-f)<=1e-7*f){f=x;break}f=x}r.r=f,r.V=d,r.pb=e+2*Ks(a,p)/f,r.pv=m,r.Tb=p,h0(d,f,n,r)}function Zo(o,t,e,s){let n=0;for(let i=0;i<lt;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function Jo(o,t,e,s,n,i,r,a,c,l){let u=0;if(2*e<=3*i){const x=o/i-.5,w=t/i-.5,y=Math.floor(x-.5),_=Math.floor(w-.5),F=x-y,T=w-_,A=.5*(1.5-F)**2,b=.75-(F-1)**2,k=.5*(F-.5)**2,P=.5*(1.5-T)**2,M=.75-(T-1)**2,S=.5*(T-.5)**2;let C=0;for(let L=0;L<3;L+=1){const B=_+L;if(B<0||B>=a)continue;const I=L===0?P:L===1?M:S;for(let j=0;j<3;j+=1){const R=y+j;if(R<0||R>=r)continue;const E=I*(j===0?A:j===1?b:k);c[u]=R+B*r,l[u]=E,C+=E,u+=1}}for(let L=0;L<u;L+=1)l[L]/=C;return u}const f=s<=Math.PI*n*n*n/6,h=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),d=Math.min(a-1,Math.floor((t+e)/i));let g=0;for(let x=p;x<=d;x+=1)for(let w=h;w<=m;w+=1){let y=0;for(let _=0;_<4;_+=1){const F=(x+(_+.5)/4)*i-t;for(let T=0;T<4;T+=1){const A=(w+(T+.5)/4)*i-o,b=e*e-A*A-F*F;b>0&&(y+=f?Math.sqrt(b):1)}}y<=0||u>=c.length||(c[u]=w+x*r,l[u]=y,g+=y,u+=1)}if(g<=0)return c[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let x=0;x<u;x+=1)l[x]/=g;return u}function tc(o,t,e,s,n,i){const{nx:r,ny:a}=o,c=e%r,l=(e-c)/r;let u=0,f=0;for(let h=0;h<=6&&(u===0||f<2*s);h+=1)for(let m=0;m<=h;m+=1)for(let p=-h;p<=h;p+=1){if(Math.max(Math.abs(p),m)!==h)continue;const d=c+p,g=l+m;if(d<0||g<0||d>=r||g>=a)continue;const x=d+g*r;if(o.kind[x]!==U||u>=n.length)continue;const w=Math.max(.001*o.vCell,t[x]);n[u]=x,i[u]=w,f+=w,u+=1}for(let h=0;h<u;h+=1)i[h]/=f;return u}function ec(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===U)return e+s*o.nx;return-1}const Cs=.5;class m0{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,c=r.x[t],l=r.y[t],u=r.r[t],f=r.V[t],h=Math.max(u+i.dx,2*i.dx),m=this.vel;let p=0,d=0;for(let K=0;K<8;K+=1){const z=K*Math.PI/4;a.velocityAt(c+h*Math.cos(z),l+h*Math.sin(z),m),p+=m[0]/8,d+=m[1]/8}const g=i.cellAt(c,l),x=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],w=g>=0?n.phase.host[g]:0,y=n.phase.mixed?Fs(w,x):a.rhoRef,_=Ln(w,x),F=r.totalMass(t)/Math.max(1e-30,f),T=(p-this.ux0[t])/Math.max(e,1e-6),A=(d-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=d,u<2e-5){r.vx[t]=p,r.vy[t]=d,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,c+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*d));return}const b=r.vx[t]-p,k=r.vy[t]-d,P=Math.hypot(b,k),M=2*u,S=Math.max(1e-6,y*P*M/_),C=Math.max(0,n.gy)*(y-F)*M*M/Ks(w,x),B=.5*Math.max(24/S*(1+.15*Math.pow(S,.687)),8/3*(C/(C+4)))*y*this.front(t)*P,I=(F+Cs*y)*f,j=y*f*T,R=y*f*(A+n.gy),E=-F*f*n.gy,W=Cs*y*f*T,N=Cs*y*f*A,J=s>0?Cs*y*s:0,tt=s<0?Math.min(-s,.2*f/e):0,q=Cs*y*tt*b,Q=Cs*y*tt*k,V=(I*r.vx[t]+e*(j+W+q)+e*(B+J)*p)/(I+e*(B+J)),G=(I*r.vy[t]+e*(R+E+N+Q)+e*(B+J)*d)/(I+e*(B+J));r.vx[t]=Number.isFinite(V)?V:p,r.vy[t]=Number.isFinite(G)?G:d;const st=-B*(V-p),vt=-B*(G-d),yt=t*ce;r.force[yt]=j,r.force[yt+1]=R,r.force[yt+2]=0,r.force[yt+3]=E,r.force[yt+4]=st,r.force[yt+5]=vt,r.force[yt+6]=W+q-J*(V-p),r.force[yt+7]=N+Q-J*(G-d),this.spreadForce(c,l,u,-(st+r.force[yt+6])*(e/n.dt),-(vt+r.force[yt+7])*(e/n.dt));let D=c+e*V,H=l+e*G;const X=i.sdfAt(D,H);if(X<u){const K=.25*i.dx;let z=i.sdfAt(D+K,H)-i.sdfAt(D-K,H),ht=i.sdfAt(D,H+K)-i.sdfAt(D,H-K);const ot=Math.hypot(z,ht);if(ot>1e-12){z/=ot,ht/=ot,D+=(u-X)*z,H+=(u-X)*ht;const bt=r.vx[t]*z+r.vy[t]*ht;bt<0&&(r.vx[t]-=bt*z,r.vy[t]-=bt*ht)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,D)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,H));const O=i.depth;r.z[t]=2*u>=O?O/2:Math.min(O-u,Math.max(u,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:u}=a;if(s>u&&this.spreadRing(t,e,s,n,i))return;const f=this.w3;let h=Math.floor(t/u-.5),m=t/u-h;f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2;let p=Math.floor(e/u-1);m=e/u-.5-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const x=h+g,w=p+d;x<0||x>c||w<0||w>=l||(r.fU[x+w*(c+1)]+=n*f[g]*f[3+d])}h=Math.floor(t/u-1),m=t/u-.5-h,f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2,p=Math.floor(e/u-.5),m=e/u-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const x=h+g,w=p+d;x<0||x>=c||w<0||w>l||(r.fV[x+w*c]+=i*f[g]*f[3+d])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,a=this.e.grid,{nx:c,ny:l,dx:u}=a,f=a.phi,h=Math.max(1.5*s,s+2*u),m=s*s,p=h*h,d=Math.max(0,Math.floor((t-h)/u)),g=Math.min(c,Math.ceil((t+h)/u)),x=Math.max(0,Math.floor((e-h)/u)),w=Math.min(l,Math.ceil((e+h)/u));let y=0,_=0;for(let F=0;F<2;F+=1){if(F===1){if(!(y>0)||!(_>0))return!1;y=n/y,_=i/_}for(let T=x;T<=w;T+=1)for(let A=d;A<=g;A+=1){if(T<l){const b=A*u-t,k=(T+.5)*u-e,P=b*b+k*k;if(P>=m&&P<=p){const M=A+T*c,S=.5*((A>0?f[M-1]:0)+(A<c?f[M]:0));S>0&&(F===0?y+=S:r.fU[A+T*(c+1)]+=y*S)}}if(A<c){const b=(A+.5)*u-t,k=T*u-e,P=b*b+k*k;if(P>=m&&P<=p){const M=A+T*c,S=.5*((T>0?f[M-c]:0)+(T<l?f[M]:0));S>0&&(F===0?_+=S:r.fV[M]+=_*S)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const c=(n-r)/(a-r);return(1-c)*(Math.PI*s*s)/4+c*s*s}}class Ka{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function sc(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const p0=8,g0=210,nc=1.805,x0=3e-7;function zr(o,t){const e=kt(t);return kt(t+2*Un(e)/o)-e}const fe=class fe{constructor(){v(this,"count",0);v(this,"fixed",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"mat",new Uint8Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"nx",new Float32Array(0));v(this,"ny",new Float32Array(0));v(this,"body",new Int16Array(0));v(this,"seg",new Int32Array(0));v(this,"t",new Float32Array(0));v(this,"pos",new Float64Array(2));v(this,"sg",new Float64Array(6))}static rRef(){if(fe.ref>0)return fe.ref;const t=kt(Tn),e=2*Un(t)/(Cn(t+1)-Tn);return fe.ref=g0*e,fe.ref}static draw(t,e,s,n){const i=mt[s],r=fe.rRef(),a=fe.rng;a.state=t||1;const c=Math.pow(r/i.cavRmax,nc);let l=0;for(let u=0;u<p0;u+=1){l+=a.exp();const f=r*Math.pow(l/(e*i.cavScale)+c,-1/nc);if(f<x0)break;n.r.push(f),n.s.push(a.next()),n.z.push(a.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,a=[],c=[],l=[],u=[],f=[],h=[],m=[],p={r:[],s:[],z:[]};for(let _=0;_<t.n;_+=1){if(t.solid[_]===0||t.owner[_]!==0)continue;const F=_%n,T=(_-F)/n;for(let A=0;A<4;A+=1){const b=A===0?F-1:A===1?F+1:F,k=A===2?T-1:A===3?T+1:T;if(b<0||k<0||b>=n||k>=i)continue;const P=b+k*n;if(t.solid[P]===0){p.r.length=0,p.s.length=0,p.z.length=0,fe.draw(sc(e,_,A),r,t.solid[_]-1,p);for(let M=0;M<p.r.length;M+=1)a.push(_),c.push(P),l.push(A),u.push(p.r[M]),f.push(p.s[M]),h.push(p.z[M]),m.push(t.solid[_]-1)}}}const d=a.length,g=[],x=[],w=[];for(const _ of s)if(!_.gone)for(let F=0;F<_.nseg;F+=1){_.segment(F,this.sg);const T=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),A=Math.max(1,Math.round(T/t.dx));for(let b=0;b<A;b+=1){p.r.length=0,p.s.length=0,p.z.length=0,fe.draw(sc(e,1e5+1e3*_.key+F,b),T/A*t.depth,_.mat,p);for(let k=0;k<p.r.length;k+=1)a.push(-1),c.push(-1),l.push(_.segS[F]),u.push(p.r[k]),f.push(p.s[k]),h.push(p.z[k]),m.push(_.mat),g.push(_.index),x.push(F),w.push((b+p.s[k])/A)}}const y=a.length;this.count=y,this.fixed=d,this.cell=Int32Array.from(a),this.fluid=Int32Array.from(c),this.dir=Uint8Array.from(l),this.r=Float32Array.from(u),this.s=Float32Array.from(f),this.z=Float32Array.from(h),this.bubble=new Uint32Array(y),this.mat=Uint8Array.from(m),this.px=new Float64Array(y),this.py=new Float64Array(y),this.nx=new Float32Array(y),this.ny=new Float32Array(y),this.body=new Int16Array(y).fill(-1),this.seg=new Int32Array(y),this.t=new Float32Array(y);for(let _=0;_<d;_+=1){const F=this.cell[_],T=F%n,A=(F-T)/n,b=this.s[_],k=this.dir[_],P=t.dx;this.px[_]=k===0?T*P:k===1?(T+1)*P:(T+b)*P,this.py[_]=k===2?A*P:k===3?(A+1)*P:(A+b)*P,this.nx[_]=k===0?-1:k===1?1:0,this.ny[_]=k===2?-1:k===3?1:0}for(let _=d;_<y;_+=1)this.body[_]=g[_-d],this.seg[_]=x[_-d],this.t[_]=w[_-d];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const a=this.t[i],c=this.sg[0]+a*(this.sg[2]-this.sg[0]),l=this.sg[1]+a*(this.sg[3]-this.sg[1]),u=Math.cos(r.a),f=Math.sin(r.a),h=r.x+u*c-f*l,m=r.y+f*c+u*l,p=u*this.sg[4]-f*this.sg[5],d=f*this.sg[4]+u*this.sg[5];this.px[i]=h,this.py[i]=m,this.nx[i]=p,this.ny[i]=d,this.dir[i]=Math.abs(p)>=Math.abs(d)?p<0?0:1:d<0?2:3;const g=t.cellAt(h-n*p,m-n*d),x=t.cellAt(h+n*p,m+n*d);this.cell[i]=g,this.fluid[i]=x>=0&&t.solid[x]===0?x:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)mt[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};v(fe,"ref",0),v(fe,"rng",new Ka(1));let Qr=fe;const v0=.0208,y0=1;class w0{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new Qr);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new m0(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return zr(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),u=Math.floor(c),f=Math.floor(l),h=c-u,m=l-f;let p=0,d=0;for(let g=0;g<2;g+=1)for(let x=0;x<2;x+=1){const w=u+x+(f+g)*i;if(n.solid[w]!==0)continue;const y=(x===0?1-h:h)*(g===0?1-m:m);p+=y*n.pl[w],d+=y}return Math.max(.5*s.pRef,s.pRef+(d>0?p/d:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=Jo(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let c=0;c<i;c+=1){const l=this.cells[c];s.kind[l]===rt&&(this.cells[a]=l,this.wts[a]=this.wts[c],r+=this.wts[c],a+=1)}for(let c=0;c<a;c+=1)this.wts[c]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;d0(s.m,t*lt,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==rt){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const u=Math.max(.5*e.pRef,e.pRef+s.pl[l]),f=i.boilingAt(l,u);this.tsatCell[l]=f,i.salty&&(this.dTb[l]=f-kt(u)),this.budget[l]=i.Cl[l]*(i.Tl[l]-f)}this.Fm.fill(0),e.extremes.beginStep();const c=e.waterTemperature();if(this.bulkCold=c.mass>0&&c.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);if(this.coalesce(),e.extremes.normalize)for(let l=0;l<n.count;l+=1)n.r[l]>e.extremes.bubbleCap&&this.vent(l);for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r],c=this.sites.cell[r];if(a<0||c<0||s.kind[a]!==rt||i.acc[a]<=0||i.waterShare(a)<.5||!e.heat.hasSolid(c))continue;const l=mt[this.sites.mat[r]],u=i.Tl[a],f=bn(i.host[a],u),h=(l.k*s.Ts[c]+f*u)/(l.k+f),m=Math.max(.5*e.pRef,e.pRef+s.pl[a]),p=this.tsatCell[a]>0?this.tsatCell[a]:kt(m);if(h-p<0)continue;const d=this.sites.r[r];if(h-p<e.extremes.activation(zr(d,m)))continue;const g=m+2*Ks(i.host[a],h)/d,x=kt(g),w=4/3*Math.PI*d*d*d,y=Te(x)*w;if(y*4>i.acc[a])continue;const _=this.sites.position(this.e.grid,r,d),F=n.add(_[0],_[1],Math.min(s.depth-d,Math.max(d,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*lt+Z]=y,n.r[F]=d,n.V[F]=w,n.Tb[F]=x,n.pb[F]=g,n.pv[F]=g,n.H[F]=y*pt(x),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const T=i.waterH(a);this.Fm[a]-=y,e.heat.src[c]-=y*(pt(x)-T)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=h-p,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*lt;let c=i.site[t],l=0;const u=i.V[t];let f=0,h=u;for(;l<e-1e-12;){h=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let d=Math.min(e-l,Math.max(1e-7,y0*i.age[t]),.25*n.dx/(p+1e-9));d<1e-7&&(d=Math.min(e-l,1e-7));let g,x=-1,w=0;if(c>=0){const D=this.sites.fluid[c],H=this.sites.cell[c];if(D<0||H<0||!s.heat.hasSolid(H)){this.detach(t),c=-1;continue}const X=mt[this.sites.mat[c]],O=r.Tl[D],K=bn(r.host[D],O);g=(X.k*n.Ts[H]+K*O)/(X.k+K),x=H}else{if(w=this.liquidFootprint(t),w===0)break;g=0;for(let D=0;D<w;D+=1)g+=this.wts[D]*r.Tl[this.cells[D]]}let y=0;if(r.salty)if(c>=0)y=this.dTb[this.sites.fluid[c]];else for(let D=0;D<w;D+=1)y+=this.wts[D]*this.dTb[this.cells[D]];const _=i.Tb[t],F=c>=0?r.host[this.sites.fluid[c]]:r.hostAt(i.x[t],i.y[t]),T=bn(F,g),A=Fs(F,g),b=xo(F,g),k=Ln(F,g),P=T/(A*b),M=2*m,S=i.age[t],C=T*Math.sqrt(3/(Math.PI*P)),L=c>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),B=A*L*M/k,I=k*b/T,j=T/M*(2+.6*Math.sqrt(B)*Math.cbrt(I)),R=pt(_)-At(g);let E=Math.max(C*2*(Math.sqrt(S+d)-Math.sqrt(S)),j*d);if(c>=0&&g>_+y){const D=.5*this.fritz(t,g),H=i.m[a+Z]>0?i.m[a+Z]/i.V[t]:Te(_),X=E*(g-_-y)/(H*R);if(m<D&&m+X>D&&X>0){const O=E*(D-m)/X;if(j*d>=C*2*(Math.sqrt(S+d)-Math.sqrt(S)))d=O/j;else{const K=Math.sqrt(S)+O/(2*C);d=K*K-S}d=Math.max(1e-9,Math.min(e-l,d*(1+1e-6))),E=Math.max(C*2*(Math.sqrt(S+d)-Math.sqrt(S)),j*d)}}const W=n.depth,N=i.V[t],J=i.m[a+Z]>0?i.m[a+Z]/N:Te(_),tt=E*(g-_-y)/(J*R),q=Math.max(0,m+tt);let Q;N<=Math.PI*W*W*W/6?Q=4/3*Math.PI*(q*q*q-m*m*m):N>=Math.PI*W*W*W/4?Q=Math.PI*W*(q*q-m*m):Q=Math.PI*W*W*E*(g-_-y)/(J*R);let V=J*Q*R;if(c>=0){const D=x,H=s.heat.solidCap(D)*Math.max(0,n.Ts[D]-_);if(V>0&&(V=Math.min(V,Math.max(0,H-this.used(D)))),V>0){const X=V;V=Math.min(V,s.extremes.wallLeft(D,e)),s.extremes.takeWall(D,V,X)}}else{let D=0;for(let H=0;H<w;H+=1)D+=this.wts[H]*this.budget[this.cells[H]];V>0?V=Math.min(V,Math.max(0,D)):V=Math.max(V,Math.min(0,D))}let G=V/R;G<0&&(G=Math.max(G,-i.m[a+Z]));let st=1,vt=!1;if(c<0&&G!==0&&!r.mixed)for(let D=0;D<w&&!vt;D+=1)vt=r.acc[this.cells[D]]<=0;const yt=D=>r.acc[D]>0?r.waterShare(D):0;if(c<0&&G!==0&&(r.mixed||vt)){st=0;for(let D=0;D<w;D+=1)st+=this.wts[D]*yt(this.cells[D]);G*=st}if(G!==0){if(c>=0){const D=this.sites.fluid[c];G>0&&r.acc[D]+this.Fm[D]-G<0&&(G=Math.max(0,r.acc[D]+this.Fm[D]));const H=r.waterH(D);this.Fm[D]-=G,s.heat.src[x]-=G*(pt(_)-H)/e,this.budgetSolid(x,G*(pt(_)-H))}else for(let D=0;D<w;D+=1){const H=this.cells[D],X=r.mixed||vt?this.wts[D]*yt(H)/st:this.wts[D];if(X===0)continue;const O=r.waterH(H);this.Fm[H]-=G*X,s.heat.src[H]-=G*X*(pt(_)-O)/e,this.budget[H]-=G*X*(pt(_)-O)}i.m[a+Z]+=G,i.H[t]+=G*pt(_),f+=G}if(this.solve(t,g),this.restoreEnthalpy(t,c,w,e),i.r[t]<1e-6||i.m[a+Z]<=1e-18&&i.m[a+at]+i.m[a+ft]<=0){i.age[t]+=d;break}if(c>=0){const D=this.sites.position(this.e.grid,c,i.r[t]);i.x[t]=D[0],i.y[t]=D[1],this.departure(t,g),c=i.site[t]}else this.motion.move(t,d,(i.V[t]-h)/d);if(i.age[t]+=d,l+=d,i.m[a+Z]<=0&&i.m[a+at]+i.m[a+ft]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=Zo(r.m,t*lt,r.Tb[t],re),c=a-r.H[t];if(c===0)return;if(e>=0){r.H[t]=a,i.heat.src[this.sites.cell[e]]-=c/n;return}const l=i.phase.Cl;let u=0;for(let f=0;f<s;f+=1)l[this.cells[f]]>0&&(u+=this.wts[f]);if(u>0){r.H[t]=a;for(let f=0;f<s;f+=1){const h=this.cells[f];l[h]>0&&(i.heat.src[h]-=c*this.wts[f]/(u*n))}}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=mt[this.sites.mat[i]],a=this.contactAngleOverride??r.contactAngle,c=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return v0*a*Math.sqrt(Ks(l,n.Tb[t])/(s.gy*(Fs(l,e)-c)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const c=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],c),this.motion.ux0[t]=c[0],this.motion.uy0[t]=c[1],n.vx[t]=c[0],n.vy[t]=c[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const u=e.cellAt(s.x[l],s.y[l]);if(u<0){this.next[l]=-1;continue}this.next[l]=this.head[u],this.head[u]=l,s.r[l]>a&&(a=s.r[l])}const c=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const u=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let h=Math.max(0,f-c);h<=Math.min(i-1,f+c);h+=1)for(let m=Math.max(0,u-c);m<=Math.min(n-1,u+c);m+=1)for(let p=this.head[m+h*n];p>=0;p=this.next[p]){if(p<=l||s.V[p]<=0)continue;const d=s.x[p]-s.x[l],g=s.y[p]-s.y[l],x=e.depth,y=2*s.r[l]>=x||2*s.r[p]>=x?0:s.z[p]-s.z[l],_=s.r[l]+s.r[p];d*d+g*g+y*y>=_*_||this.merge(l,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<lt;a+=1)s.m[t*lt+a]+=s.m[e*lt+a],s.m[e*lt+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*lt,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Z]<=1e-18&&i.m[r+at]+i.m[r+ft]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const c=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(c<0||n.kind[c]===U||l<0||n.kind[l]===U)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*lt,a=e.extremes.bubbleCap,c=2*a<=s.depth?4/3*Math.PI*a*a*a:Math.PI*a*a*s.depth;if(!(n.V[t]>c))return;const l=1-c/n.V[t];let u=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;u>=0&&s.kind[u]!==U;)u=u+s.nx<i?u+s.nx:-1;if(u<0&&(u=ec(s,n.x[t])),u<0)return;const f=tc(s,e.gas.vgas,u,l*n.V[t],this.cells,this.wts);for(let h=0;h<f;h+=1){const m=this.cells[h],p=this.wts[h];for(let d=0;d<lt;d+=1)s.mg[d*i+m]+=p*l*n.m[r+d];s.Hg[m]+=p*l*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=l*n.m[r+Z],this.burstVapour+=l*n.m[r+Z];for(let h=0;h<lt;h+=1)n.m[r+h]*=1-l;n.H[t]*=1-l,n.V[t]=c,n.r[t]=a}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*lt,c=i.n,l=r.m[a+Z],u=r.m[a+at]+r.m[a+ft];if(e||u>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==U;)m=m+i.nx<c?m+i.nx:-1;if(m<0&&(m=ec(i,r.x[t])),m>=0){const p=tc(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let d=0;d<p;d+=1){const g=this.cells[d],x=this.wts[d];for(let w=0;w<lt;w+=1)i.mg[w*c+g]+=x*r.m[a+w];i.Hg[g]+=x*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let d=1;if(p.mixed){d=0;for(let g=0;g<m;g+=1)d+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const x=this.cells[g],w=p.mixed&&d>0?this.wts[g]*p.waterShare(x)/d:this.wts[g];if(w===0)continue;const y=p.waterH(x);this.Fm[x]+=l*w,n.heat.src[x]+=w*(r.H[t]-l*y)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[Z*c+p]+=l,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const h=r.count-1;if(t!==h){this.motion.ux0[t]=this.motion.ux0[h],this.motion.uy0[t]=this.motion.uy0[h];const m=r.site[h];m>=0&&(this.sites.bubble[m]=r.id[h])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let u=0;u<n.count;u+=1){const f=Jo(n.x[u],n.y[u],n.r[u],n.V[u],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let h=0;h<f;h+=1)i[this.cells[h]]+=this.wts[h]*n.V[u]*r}const a=s.alpha,c=e.liquid.volSrc,l=Wa*t;for(let u=0;u<s.n;u+=1){const f=Math.min(i[u],Math.max(0,1-s.phiS[u])),h=f-a[u];h!==0&&(h>l?(c[u]+=l*s.vCell/t,a[u]+=l):h<-l?(c[u]-=l*s.vCell/t,a[u]-=l):(c[u]+=h*s.vCell/t,a[u]=f))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,c=a.add(t,e,s);if(c<0)return-1;const l=this.pressure(t,e),u=r.grid.cellAt(t,e),f=u>=0&&r.phase.Tl[u]>0?r.phase.Tl[u]:r.ambientT,h=l+2*Ks(u>=0?r.phase.host[u]:0,f)/n,m=4/3*Math.PI*n*n*n,p=c*lt;if(i<=0){const d=kt(h);a.m[p+Z]=Te(d)*m}else{const d=h*m/(8.314462618*f);a.m[p+at]=d*.79*gt[at],a.m[p+ft]=d*.21*gt[ft]}return a.r[c]=n,this.solve(c,f),a.H[c]=Zo(a.m,p,a.Tb[c],re),r.ledger.water+=a.m[p+Z],r.ledger.air+=a.m[p+at]+a.m[p+ft],r.ledger.energy+=a.H[c],this.motion.ux0[c]=0,this.motion.uy0[c]=0,c}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*lt,n=t*ce;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+Z],ma:e.m[s+at]+e.m[s+ft],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+ce))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return dt}}const za=20,Qa=.1,Xa=2,Ya=.004,Za=1.5,ic=.006,rc=2;function b0(o,t,e){const s=o==="normalize";return{chf:Ja(t,e)*(s?Qa:1),actMax:s?Xa:1e30,vmax:s?Za:za,bubCap:s?Ya:1e30}}function Ja(o,t){const e=kt(o),s=Te(e),n=sn(e);return .149*Math.sqrt(s)*da(e)*Math.pow(Math.max(0,Un(e)*t*(n-s)),.25)}class F0{constructor(t){v(this,"pending",null);v(this,"asked",!1);v(this,"heldHeat",0);v(this,"vented",0);v(this,"slowed",0);v(this,"maxBubble",0);v(this,"maxSpeed",0);v(this,"wall",new Float64Array(0));v(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?Ya:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=Ja(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?Qa:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,Xa):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?Za:za;let n=0;for(let r=0;r<t.count;r+=1){const a=Math.hypot(t.vx[r],t.vy[r]);if(a>s){const c=s/a;t.vx[r]*=c,t.vy[r]*=c,this.slowed+=1,n=Math.max(n,s)}else a>n&&(n=a)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>ic?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>rc&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}observe(t,e,s){this.maxBubble=t,this.maxSpeed=e,!(this.mode!=="ask"||this.asked)&&(t>ic?(this.pending={kind:"bubble",value:t,time:s},this.asked=!0):e>rc&&(this.pending={kind:"speed",value:e,time:s},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function oc(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const _0={mass:0,energy:0},A0={m:0,H:0,s:0},T0={salt:0,energy:0};function k0(o,t,e,s,n,i,r=_0,a=[],c=A0,l=T0){const u=o.n;let f=0,h=0,m=0,p=0,d=0,g=0,x=0;for(let C=0;C<u;C+=1){const L=o.owner[C]!==0||o.capB[C]>0;if(o.kind[C]===dt||o.solid[C]!==0){L||(f+=o.Es[C],d+=o.film[C],g+=o.crust[C]);continue}h+=o.Hg[C],m+=o.mg[Z*u+C],p+=o.mfog[C],x+=o.mg[at*u+C]+o.mg[ft*u+C]}let w=0,y=0,_=0,F=0;for(let C=0;C<t.count;C+=1){w+=t.mass[C]*t.h[C];const L=t.smass[2*C];F+=L,t.mat[C]===ut?y+=t.mass[C]-L:_+=t.mass[C]-L}f+=r.energy,f+=l.energy;let T=0;for(const C of a)C.gone||(f+=C.energy(),d+=C.filmMass(),g+=C.crustMass(),Ve(C.mat)>0&&(T+=C.m));w+=c.H,y+=c.m,F+=c.s;let A=0,b=0;for(let C=0;C<e.count;C+=1)A+=e.H[C],b+=e.m[C*lt+Z],x+=e.m[C*lt+at]+e.m[C*lt+ft];const k=s.pvTerm();i.solids=f,i.liquid=w,i.gas=h,i.bubbles=A,i.pv=k,i.energy=f+w+h+A+k;const P=i.water;P.liquid=y,P.ice=T,P.vapour=m,P.fog=p,P.film=d,P.bubbles=b,P.escaped=n.escapedWater,P.total=y+T+m+p+d+b+n.escapedWater;const M=i.other;M.liquid=_,M.escaped=n.escapedOther,M.total=_+n.escapedOther;const S=i.salt;return S.liquid=F,S.crust=g,S.grains=l.salt,S.floor=r.mass,S.escaped=n.escapedSalt,S.total=F+g+l.salt+r.mass+n.escapedSalt,i.air=x+n.escapedAir,i}function P0(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,grains:0,floor:0,escaped:0,total:0}}}var na;const ke=[{id:"NaCl",rho:Da,cp:es,color:((na=Yi[0])==null?void 0:na.color)??"#f4f3ee",dissolves:!0,repose:34}];function tl(o){return ke.findIndex(t=>t.id===o)}const M0=.58,S0=5e-4;class L0{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"m");v(this,"m0");v(this,"N");v(this,"T");v(this,"mat");v(this,"dry");v(this,"id");this.cap=t,this.x=new Float64Array(t),this.y=new Float64Array(t),this.vx=new Float64Array(t),this.vy=new Float64Array(t),this.m=new Float64Array(t),this.m0=new Float64Array(t),this.N=new Float64Array(t),this.T=new Float64Array(t),this.mat=new Uint8Array(t),this.dry=new Uint8Array(t),this.id=new Uint32Array(t)}add(t,e,s,n,i,r){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.m[a]=s,this.m0[a]=s,this.N[a]=n,this.T[a]=i,this.mat[a]=r,this.dry[a]=1,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,a}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.m[t]=this.m[e],this.m0[t]=this.m0[e],this.N[t]=this.N[e],this.T[t]=this.T[e],this.mat[t]=this.mat[e],this.dry[t]=this.dry[e],this.id[t]=this.id[e]),this.count=e}rho(t){return ke[this.mat[t]].rho}cp(t){return ke[this.mat[t]].cp}diameter(t){return Math.cbrt(6*this.m[t]/(this.N[t]*Math.PI*this.rho(t)))}enthalpy(t){return this.m[t]*this.cp(t)*(this.T[t]-et)}totals(){let t=0,e=0;for(let s=0;s<this.count;s+=1)ke[this.mat[s]].dissolves&&(t+=this.m[s]),e+=this.enthalpy(s);return{salt:t,energy:e}}clear(){this.count=0}}function pn(o,t){o.bodies.list.length!==0&&Jf(o.bodies,t,o.ledger)}function C0(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)Nt.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(Yn(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)Nt.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*lt+Z],o.ledger.air-=n.m[i*lt+at]+n.m[i*lt+ft],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function dr(o,t,e,s,n,i,r,a,c=-1){const l=o.bodies.adopt(t,e,s,o.opIndex,n,c);if(l===null)return null;i!==0&&o.bodies.turn(l,r,a,i*Math.PI/180),o.ledger.energy+=l.energy(),Ve(l.mat)>0&&(o.ledger.water+=l.m),C0(o,l);const u=o.grid,f=new Map,h=u.dx*u.dx;for(let m=0;m<l.nw;m+=1){const p=l.wc[m];f.set(p,(f.get(p)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*h))}for(const[m,p]of f)p>0&&u.solid[m]===0&&O0(o,m,Math.min(1,p));return l}function bi(o,t,e){const[s,n,i,r]=hn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=l;f<=u;f+=1)for(let h=a;h<=c;h+=1)Ue(t,(h+.5)*o.dx,(f+.5)*o.dx)&&e(h+f*o.nx,h,f)}function Xn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Z*s+t]+e.mfog[t],o.ledger.air-=e.mg[at*s+t]+e.mg[ft*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<lt;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function O0(o,t,e){if(e>=1){Xn(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[Z*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[at*n+t]+s.mg[ft*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<lt;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function Ao(o,t,e,s){const n=o.grid,i=n.n;Xn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Z*i+t],o.ledger.air+=n.mg[at*i+t]+n.mg[ft*i+t],o.ledger.energy+=n.Hg[t]}function Yn(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===ut?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function To(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function el(o,t){const e=o.grains,s=o.grid;for(let n=0;n<e.count;n+=1)(t!==null?!Ue(t,e.x[n],e.y[n]):s.solid[Math.max(0,s.cellAt(e.x[n],e.y[n]))]===0)||(ke[e.mat[n]].dissolves&&(o.ledger.salt-=e.m[n]),o.ledger.energy-=e.enthalpy(n),e.remove(n),n-=1)}function mr(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)Ue(t,e.x[n],e.y[n])&&(Yn(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)Ue(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*lt+Z],o.ledger.air-=s.m[n*lt+at]+s.m[n*lt+ft],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function q0(o,t,e,s,n){const i=o.grid,r=mt[e];for(const c of t)i.owner[c]!==0&&i.solid[c]!==0||(i.solid[c]!==0?(o.ledger.energy-=i.Es[c],o.ledger.water-=i.film[c],To(o,c)):Xn(o,c),i.owner[c]=0,i.capB[c]=0,i.fs[c]=0,i.crust[c]=0,i.solid[c]=e+1,i.role[c]=0,i.heater[c]=n,i.film[c]=0,i.T[c]=s,i.Es[c]=r.rho*r.cp*i.vCell*(s-et),i.kind[c]=dt,o.ledger.energy+=i.Es[c]);el(o,null);const a=o.particles;for(let c=0;c<a.count;c+=1){const l=i.cellAt(a.x[c],a.y[c]);l<0||i.solid[l]===0||(Yn(o,c),o.liquid.removeParticle(c),c-=1)}o.solidsChanged()}function j0(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],To(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&Ao(o,n,o.ambientT,o.ambientY)}}function I0(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){mr(o,t.region);const g=new Float64Array(lt);let x=0;for(const[w,y]of Object.entries(t.composition)){const _=w==="N2"?at:w==="O2"?ft:w==="H2O"?Z:-1;_>=0&&(g[_]=y,x+=y)}if(x<=0)g.set(o.ambientY.subarray(0,lt));else for(let w=0;w<Ft;w+=1)g[w]/=x;return bi(e,t.region,w=>{e.solid[w]===0&&Ao(o,w,t.T,g)}),null}mr(o,t.region);const s=te.length;let n=0;for(const[g,x]of Object.entries(t.composition))Ca(g)>=0&&x>0&&(n+=x);const i=t.composition[te[ut].id]??0,r=n>0&&i>0?n/(n+i):0,a=g=>g===ut&&r>0?Ji(t.T,r):Fs(g,t.T),c=new Float64Array(s);let l=0;for(const[g,x]of Object.entries(t.composition)){const w=ya(g);if(w<0||!(x>0))continue;const y=w===ut&&r>0?x+n:x;c[w]+=y/a(w),l+=y/a(w)}if(l<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)c[g]/=l;const u=new Float64Array(s),f=new Float64Array(s);for(let g=0;g<s;g+=1)u[g]=a(g)*e.vCell/4,f[g]=g===ut&&r>0?Va(t.T,r):$l(g,t.T);const h=r*u[ut],m=new Float64Array(s),p=o.particles;let d=!1;return lc(e,t.region,(g,x)=>{const w=g+x*e.nx;if(e.solid[w]!==0)return;let y=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const T=(g+.25+.5*F)*e.dx,A=(x+.25+.5*_)*e.dx;if(!Ue(t.region,T,A)||e.owner[w]!==0&&o.bodies.bodyAt(T,A,0)!==null)continue;let b=0;for(let S=0;S<s;S+=1)m[S]+=c[S],m[S]>m[b]&&(b=S);m[b]-=1;const k=u[b],P=f[b],M=b===ut?h:0;if(p.add(T,A,k,P,b,M)<0){d=!0;continue}y+=1,b===ut?o.ledger.water+=k-M:o.ledger.other+=k,o.ledger.salt+=M,o.ledger.energy+=k*P}y===4&&Xn(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":d?"fill: particle capacity reached":null}case"grains":{const s=tl(t.material);if(s<0)return`grains: unknown material "${t.material}"`;const n=ke[s],i=n.rho*M0*e.vCell/4,r=i/(n.rho*Math.PI*t.d*t.d*t.d/6);let a=!1;return lc(e,t.region,(c,l)=>{const u=c+l*e.nx;if(e.solid[u]===0)for(let f=0;f<2;f+=1)for(let h=0;h<2;h+=1){const m=(c+.25+.5*h)*e.dx,p=(l+.25+.5*f)*e.dx;if(Ue(t.region,m,p)&&!(e.owner[u]!==0&&o.bodies.bodyAt(m,p,0)!==null)){if(o.grains.add(m,p,i,r,t.T,s)<0){a=!0;continue}n.dissolves&&(o.ledger.salt+=i),o.ledger.energy+=i*n.cp*(t.T-et)}}}),a?"grains: capacity reached":null}case"erase":{pn(o,t.region),mr(o,t.region),el(o,t.region);const s=[];return bi(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),j0(o,s),null}case"move":{if(t.region!==null)return cc(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(c=>!c.gone&&c.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const c of s)c.worldBox(c.x,c.y,c.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,a=c=>s.includes(c)?!0:(c.worldBox(c.x,c.y,c.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return cc(o,{rect:i},t.dx,t.dy,a),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if(e0(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=Hs(t.material);if(s<0)return`solid: unknown material ${t.material}`;pn(o,t.region);const n=[];if(bi(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,c]=t.region.line,l=Math.ceil(Math.hypot(a-i,c-r)/(.5*e.dx))+1;for(let u=0;u<=l;u+=1){const f=e.cellAt(i+(a-i)*u/l,r+(c-r)*u/l);f>=0&&!n.includes(f)&&n.push(f)}}return o.bodies.sync(),q0(o,n,s,t.T,-1),null}case"body":{const s=Hs(t.material);if(s<0)return`body: unknown material ${t.material}`;pn(o,t.region);const n=t.region;let i=null,r,a=t.angle,c,l;if("line"in n){const[u,f,h,m]=n.line,p=Math.max(n.width,Math.hypot(h-u,m-f));c=(u+h)/2,l=(f+m)/2,r=[c-p/2,l-n.width/2,c+p/2,l+n.width/2],a+=Math.atan2(m-f,h-u)*180/Math.PI}else if("circle"in n){const[u,f,h]=n.circle,m=.5*h*Math.sqrt(Math.PI);r=[u-m,f-m,u+m,f+m],c=u,l=f,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[u,f,h,m]=hn(n);r=[u,f,h,m],c=(u+h)/2,l=(f+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return dr(o,[r],s,t.T,t.pinned,a,c,l),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=Hs(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,c=t.y+t.h,l=t.lid?c-n:c,u=[[i,a,r,a+n],[i,a+n,i+n,l],[r-n,a+n,r,l]];t.lid&&u.push([i,l,r,c]);for(const f of u)pn(o,{rect:[...f]});return dr(o,u,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=Hs(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return pn(o,{rect:[...i]}),dr(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function cc(o,t,e,s,n){const i=o.grid,{nx:r,ny:a,dx:c}=i,l=[];bi(i,t,w=>{i.solid[w]!==0&&i.owner[w]===0&&l.push(w)});const u=Math.round(e/c),f=Math.round(s/c),h=l.length>0?u*c:e,m=l.length>0?f*c:s;if(h===0&&m===0)return;const p=o.bodies.list.length>0?t0(o.bodies,t,n):[],d=o.particles,g=o.bubbles;for(let w=0;w<d.count;w+=1){if(!Ue(t,d.x[w],d.y[w]))continue;const y=d.x[w]+h,_=d.y[w]+m;if(y<=0||_<=0||y>=i.w||_>=i.h){Yn(o,w),o.liquid.removeParticle(w),w-=1;continue}d.x[w]=y,d.y[w]=_}for(let w=0;w<g.count;w+=1)Ue(t,g.x[w],g.y[w])&&(g.x[w]=Math.min(i.w-1e-6,Math.max(1e-6,g.x[w]+h)),g.y[w]=Math.min(i.h-1e-6,Math.max(1e-6,g.y[w]+m)),g.site[w]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(p.length===0)return;Ko(o.bodies,p,h,m),o.bodies.sync();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ac(o);return}const x=l.map(w=>({c:w,s:i.solid[w],role:i.role[w],heater:i.heater[w],T:i.T[w],Es:i.Es[w],film:i.film[w],crust:i.crust[w]}));for(const w of x)o.ledger.energy-=w.Es,o.ledger.water-=w.film,o.ledger.salt-=w.crust,i.solid[w.c]=0,i.role[w.c]=0,i.heater[w.c]=-1,i.Es[w.c]=0,i.film[w.c]=0,i.crust[w.c]=0,i.kind[w.c]=0;for(const w of x){const y=w.c%r+u,_=Math.floor(w.c/r)+f;if(y<0||_<0||y>=r||_>=a)continue;const F=y+_*r;i.solid[F]!==0?(o.ledger.energy-=i.Es[F],o.ledger.water-=i.film[F],To(o,F)):Xn(o,F),i.solid[F]=w.s,i.role[F]=w.role,i.heater[F]=w.heater,i.T[F]=w.T,i.Es[F]=w.Es,i.film[F]=w.film,i.crust[F]=w.crust,i.kind[F]=dt,o.ledger.energy+=w.Es,o.ledger.water+=w.film,o.ledger.salt+=w.crust}Ko(o.bodies,p,h,m),o.solidsChanged();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ac(o);for(const w of x)i.solid[w.c]===0&&o.gas.massOf(w.c)<=0&&Ao(o,w.c,o.ambientT,o.ambientY)}function ac(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(Yn(o,s),o.liquid.removeParticle(s),s-=1)}}function lc(o,t,e){const[s,n,i,r]=hn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=l;f<=u;f+=1)for(let h=a;h<=c;h+=1)e(h,f)}const Xr="recreatio/lab2d",B0=o=>o==="ask"||o==="compute"||o==="normalize",R0={"very-high":.001,high:.002,medium:.003},E0=o=>o==="very-high"||o==="high"||o==="medium",D0=16e4,nn=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function gn(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const wt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Ct=(o,t,e)=>Math.min(e,Math.max(t,o)),ds=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},li=(o,t)=>o==="wall"||o==="open"?o:t,fc=.25*zi,pr=2*zi;function uc(o){const t={};let e=0;for(const[s,n]of Object.entries(ds(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function N0(o,t,e){const s=ds(o),n=et+wt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return Hs(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Ss(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",c=uc(s.composition),l=h=>a==="gas"?h==="N2"||h==="O2"||h==="H2O":ya(h)>=0||Ca(h)>=0,u={};for(const[h,m]of Object.entries(c))l(h)?u[h]=m:t.push(`ops[${e}]: unknown ${a} "${h}" dropped`);const f=Object.keys(u).length>0?uc(u):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:f}}case"erase":{const r=Ss(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Ct(wt(s.dx,0),-1,1),a=Ct(wt(s.dy,0),-1,1),c=gn(s.id);if(c!=="")return{op:"move",region:null,id:c,dx:r,dy:a};const l=Ss(s.region);if(l===null)break;return{op:"move",region:l,id:null,dx:r,dy:a}}case"remove":{const r=gn(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=Ss(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:gn(s.id),x:wt(s.x,.1),y:wt(s.y,0),w:Ct(wt(s.w,.07),.01,1),h:Ct(wt(s.h,.09),.01,1),wall:Ct(wt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Ct(wt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:gn(s.id),x:wt(s.x,.1),y:wt(s.y,0),w:Ct(wt(s.w,.12),.005,1),h:Ct(wt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Ct(wt(s.power,40),0,2e3),target:et+Ct(wt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Ct(wt(s.angle,0),-180,180)};case"body":{const r=Ss(s.region);if(r===null)break;return{op:"body",id:gn(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Ct(wt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:wt(s.x,0),y:wt(s.y,0),pinned:s.pinned!==!1};case"grains":{const r=Ss(s.region);if(r===null)break;const a=typeof s.material=="string"&&tl(s.material)>=0;return s.material!==void 0&&!a&&t.push(`ops[${e}]: unknown grains "${String(s.material)}", using NaCl`),{op:"grains",region:r,material:a?s.material:"NaCl",d:Ct(wt(s.d,S0),5e-5,.005),T:n}}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function sl(o,t,e=new Set){const s=new Set(e);for(const i of o)nn(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function V0(o,t){const e=new Set;for(const r of o)nn(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>sl([],r,new Set([...s,...e])),i=[];return o.forEach((r,a)=>{if(nn(r)){let c=r.id;if(c==="")c=n(r.op);else if(s.has(c)){const l=n(r.op);t.push(`ops[${a}]: the name "${c}" is used twice, renamed to "${l}"`),c=l}s.add(c),i.push({...r,id:c});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const c=r.id;if(!s.has(c)){t.push(`ops[${a}]: no object "${c}" before this step`);return}}i.push(r)}),i}function gr(o,t={}){const e=ds(o),s=[];e.format!==void 0&&e.format!==Xr&&s.push(`format "${String(e.format)}" is not ${Xr}`);const n=ds(e.box),i=ds(e.ambient),r=ds(i.air),a=ds(e.sides),c=wt(i.g,zi),l=t.harness===!0?Ct(c,0,pr):Ct(c,fc,pr);l!==c&&s.push(`ambient.g ${c} m/s² is outside ${fc.toFixed(2)}–${pr.toFixed(2)}, using ${l.toFixed(2)}`);const u=wt(r.N2,.7676),f=wt(r.O2,.2324),h=u+f>0?u+f:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((d,g)=>{const x=N0(d,s,g);x!==null&&m.push(x)});const p=V0(m,s);return{scene:{seed:Math.floor(wt(e.seed,1))>>>0,box:{w:Ct(wt(n.w,.2),.02,.6),h:Ct(wt(n.h,.15),.02,.4),depth:Ct(wt(n.depth,.01),.002,.05)},ambient:{p:Ct(wt(i.p,Tn/1e3),20,400)*1e3,T:et+Ct(wt(i.T,20),-20,100),rh:Ct(wt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,u)/h,O2:Math.max(0,f)/h}},sides:{left:li(a.left,"wall"),right:li(a.right,"wall"),bottom:li(a.bottom,"wall"),top:li(a.top,"open")},quality:E0(e.quality)?e.quality:"high",extremes:B0(e.extremes)?e.extremes:"ask",ops:p},warnings:s}}const It=(o,t=6)=>Number(o.toFixed(t));function U0(o){switch(o.op){case"fill":return{op:"fill",region:Ls(o.region),composition:{...o.composition},phase:o.phase,T:It(o.T-et,3)};case"erase":return{op:"erase",region:Ls(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:It(o.dx),dy:It(o.dy)}:{op:"move",region:Ls(o.region),dx:It(o.dx),dy:It(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:Ls(o.region),material:o.material,T:It(o.T-et,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:It(o.T-et,3),...o.lid?{lid:!0}:{},...hc(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:It(o.target-et,3),on:o.on,T:It(o.T-et,3),...hc(o)};case"body":return{op:"body",id:o.id,region:Ls(o.region),material:o.material,T:It(o.T-et,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:It(o.angle,4)}:{}};case"pin":return{op:"pin",x:It(o.x),y:It(o.y),pinned:o.pinned};case"grains":return{op:"grains",region:Ls(o.region),material:o.material,d:It(o.d,7),T:It(o.T-et,3)}}}const hc=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:It(o.angle,4)}:{}});function H0(o){return{format:Xr,version:1,seed:o.seed,box:{...o.box},ambient:{p:It(o.ambient.p/1e3,4),T:It(o.ambient.T-et,3),rh:o.ambient.rh,g:It(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(U0)}}const G0=new Set(["pinned","mode","power","target","on"]);function Ri(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(nn(n)&&n.id===t)return s}return-1}function $0(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&Hs(t.material)>=0?t.material:o.material,r=(a,c,l,u)=>a===void 0||!Number.isFinite(a)?c:Math.max(l,Math.min(u,a));switch(o.op){case"body":{const[a,c,l,u]=hn(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const f=(a+l)/2,h=(c+u)/2,m=r(t.w,l-a,.002,.5),p=r(t.h,u-c,.002,.5);return{...o,region:{rect:[f-m/2,h-p/2,f+m/2,h+p/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function W0(o,t,e){const s=Ri(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=$0(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([c,l])=>l!==void 0&&!G0.has(c)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const c of o.bodies.list)c.gone||c.key!==s||(e.pinned!==void 0&&o.bodies.pin(c,e.pinned),i.op==="hotplate"&&c.heater>=0&&o.setHeater(c.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function K0(o,t){const e=Ri(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,a=0,c="gone";for(const l of o.bodies.list){if(l.gone||l.key!==e)continue;const u=Math.cos(l.a),f=Math.sin(l.a);for(let p=0;p<l.nr;p+=1){const[d,g,x,w]=l.bounds(p);for(const[y,_]of[[d,g],[x,g],[x,w],[d,w]])n.push(l.x+u*y-f*_,l.y+f*y+u*_)}i+=l.m;const h=l.m*mt[l.mat].cp;r+=h*l.meanT(),a+=h;const m=l.pinned?"pinned":l.asleep?"asleep":"moving";(c==="gone"||m==="moving")&&(c=m)}return{id:t,kind:s.op,outline:n,T:a>0?r/a:s.T,mass:i,state:c}}const z0=.02;function Q0(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function X0(o,t){const e=2*Math.max(0,o-z0)*t;return e>1e-8?e/Q0(e):1}function Y0(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:a}=o,c=s+1,l=(y,_)=>.5*(r[y+_*c]+r[y+1+_*c]),u=(y,_)=>.5*(a[y+_*s]+a[y+(_+1)*s]),f=(r[t+1+e*c]-r[t+e*c])/i,h=(a[t+(e+1)*s]-a[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),d=Math.max(0,t-1),g=Math.min(s-1,t+1),x=p>m?(l(t,p)-l(t,m))/((p-m)*i):0,w=g>d?(u(g,e)-u(d,e))/((g-d)*i):0;return Math.hypot(.5*(f-h),.5*(x+w))}class Z0{constructor(t){v(this,"e");v(this,"cap");v(this,"capT");v(this,"capA");v(this,"salt");v(this,"water");v(this,"fH");v(this,"fS");v(this,"outS");v(this,"outH");v(this,"inS");v(this,"inH");v(this,"cell",new Int32Array(0));v(this,"cpp",new Float64Array(0));v(this,"ds",new Float64Array(0));v(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:a,salt:c,water:l,fH:u,fS:f,cell:h,cpp:m}=this;i.fill(0),r.fill(0),a.fill(0),c.fill(0),l.fill(0);let p=!1;for(let y=0;y<e.count;y+=1){const _=s.cellAt(e.x[y],e.y[y]);if(h[y]=_,_<0)continue;const F=e.cp(y);m[y]=F;const T=e.mass[y]*F,A=e.T[y];if(i[_]+=T,r[_]+=T*A,a[_]+=T*bn(e.mat[y],A)/(e.rho[y]*F),e.mat[y]!==ut)continue;const b=e.smass[2*y];c[_]+=b,l[_]+=e.mass[y]-b,b>0&&(p=!0)}const{nx:d,ny:g,kind:x}=s,w=Math.PI*Math.PI*t/(s.dx*s.dx);for(let y=0;y<s.n;y+=1){if(u[y]=0,f[y]=0,!(i[y]>0))continue;const _=y%d,F=(y-_)/d;if(!(x[y]!==rt&&(x[y]!==U||!(_>0&&x[y-1]===rt||_<d-1&&x[y+1]===rt||F>0&&x[y-d]===rt||F<g-1&&x[y+d]===rt)))&&(u[y]=1-Math.exp(-w*a[y]/i[y]),p&&c[y]>0)){const T=Ur(r[y]/i[y]);f[y]=1-Math.exp(-w*T*X0(Y0(s,_,F),t/(w*T)))}}for(let y=0;y<e.count;y+=1){const _=h[y];if(_<0||u[_]===0)continue;const F=u[_]*(r[_]/i[_]-e.T[y]);if(F===0)continue;const T=e.mass[y]/e.rho[y];e.h[y]+=m[y]*F,e.derive(y),n.dVp[y]+=e.mass[y]/e.rho[y]-T}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:a,outH:c,inS:l,inH:u,cell:f,ds:h,hs:m}=this;a.fill(0),c.fill(0);for(let d=0;d<e.count;d+=1){h[d]=0;const g=f[d];if(g<0||r[g]===0||e.mat[d]!==ut)continue;const x=e.smass[2*d],w=r[g]*(n[g]/i[g]*(e.mass[d]-x)-x);if(h[d]=w,w<0){const y=Eo(e.T[d],x/e.mass[d]);m[d]=y,a[g]-=w,c[g]-=w*y}}const p=this.saltBetween(t);for(let d=0;d<e.count;d+=1){const g=f[d];if(g<0||e.mat[d]!==ut)continue;let x=h[d],w=0;x<0?w=x*m[d]:x>0&&(a[g]>0?w=x*c[g]/a[g]:x=0);const y=e.smass[2*d],_=e.mass[d];if(p&&(l[g]!==0||u[g]!==0)){const A=l[g]<0?y/n[g]:(_-y)/i[g];x+=l[g]*A,w+=u[g]*A}if(x===0&&w===0)continue;const F=_*e.h[d]+w,T=_/e.rho[d];e.mass[d]=_+x,e.smass[2*d]=y+x,e.spc[2*d]=y+x>0?Wn:0,e.h[d]=F/e.mass[d],e.derive(d),s.dVp[d]+=e.mass[d]/e.rho[d]-T}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:a,inS:c,inH:l}=this,{nx:u,ny:f}=e;c.fill(0),l.fill(0);const h=t/(e.dx*e.dx);let m=!1;const p=(d,g,x)=>{if(i[g]===0||!(n[g]>0)||!(x>0))return;const w=s[d]/n[d],y=s[g]/n[g];if(w===y)return;const _=w>y?d:g,F=w>y?g:d,T=Ur(.5*(a[d]/r[d]+a[g]/r[g])),A=(x<1?x*T:T)*h*Math.min(n[d],n[g])*Math.abs(w-y),b=Eo(a[_]/r[_],s[_]/(s[_]+n[_]));c[_]-=A,l[_]-=A*b,c[F]+=A,l[F]+=A*b,m=!0};for(let d=0;d<f;d+=1)for(let g=0;g<u;g+=1){const x=g+d*u;i[x]===0||!(n[x]>0)||(g+1<u&&p(x,x+1,e.au[g+1+d*(u+1)]),d+1<f&&p(x,x+u,e.av[x+u]))}return m}}function J0(o,t){const e=o.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let c=0;c<n;c+=1)for(let l=0;l<s;l+=1){const u=l+c*s;e.solid[u]===0&&(e.kind[u]===rt||Ue(t.region,(l+.5)*e.dx,(c+.5)*e.dx))&&(i[u]=1)}const r=new Uint8Array(e.n),a=[];for(let c=0;c<e.n;c+=1){if(i[c]===0||r[c]!==0)continue;let l=!1;for(a.push(c),r[c]=1;a.length>0;){const u=a.pop(),f=u%s,h=(u-f)/s,m=o.gas,p=[m.across(u,f,h,0),m.across(u,f,h,1),m.across(u,f,h,2),m.across(u,f,h,3)];(f===0&&e.openL||f===s-1&&e.openR||h===0&&e.openB||h===n-1&&e.openT)&&(l=!0);for(const d of p)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,a.push(d))}}if(!l)return!1}return!0}const Ht=Ft+2,ne=Ft,le=Ft+1,tu=.9,eu=16;class _n{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Ht*s),this.fu=new Float64Array(Ht*t.nu),this.fv=new Float64Array(Ht*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,c=s+1,l=e.ug,u=e.vg;let f=0,h=0;for(let _=0;_<n;_+=1)for(let F=0;F<s;F+=1){const T=F+_*s;if(r[T]!==U)continue;const A=F+_*c,b=l[A],k=l[A+1],P=u[T],M=u[T+s],S=(b<0?-b:0)+(k>0?k:0)+(P<0?-P:0)+(M>0?M:0);S>f&&(f=S);const C=Math.max(b<0?-b:b,k<0?-k:k,P<0?-P:P,M<0?-M:M);C>h&&(h=C)}this.gas.last.uMax=h;const m=Math.min(eu,Math.max(1,Math.ceil(f*t/a/tu))),p=t/m,{conc:d}=this,g=this.gas.vgas,x=e.mg,w=e.mfog,y=e.Hg;for(let _=0;_<m;_+=1){for(let F=0;F<i;F+=1){if(r[F]!==U){for(let A=0;A<Ht;A+=1)d[A*i+F]=0;continue}const T=1/g[F];for(let A=0;A<Ft;A+=1)d[A*i+F]=x[A*i+F]*T;d[ne*i+F]=w[F]*T,d[le*i+F]=y[F]*T}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let _=0;_<i;_+=1)r[_]===U&&this.gas.deriveCell(_);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,c=e.nu,l=e.ug,{conc:u,fu:f}=this,{amb:h,gasU:m}=this.gas,p=e.aFace,d=_n.face;for(let g=0;g<n;g+=1){const x=g*s,w=g*a;for(let y=0;y<=s;y+=1){const _=w+y,F=l[_];if(m[_]===0||F===0){for(let P=0;P<Ht;P+=1)f[P*c+_]=0;continue}const T=e.au[_]<1?F*p*t*e.au[_]:F*p*t;if(y===0||y===s){const P=y===0?x:x+s-1,M=y===0?F>0:F<0;for(let S=0;S<Ht;S+=1)f[S*c+_]=T*(M?h[S]:u[S*i+P]);continue}let A,b,k;if(F>0?(A=x+y-1,b=x+y,k=y>=2&&r[x+y-2]===U?x+y-2:-1):(A=x+y,b=x+y-1,k=y+1<s&&r[x+y+1]===U?x+y+1:-1),k<0){for(let P=0;P<Ht;P+=1)f[P*c+_]=T*u[P*i+A];continue}for(let P=0;P<Ht;P+=1){const M=P*i;f[P*c+_]=T*d(u[M+A],u[M+k],u[M+b])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,c=e.vg,{conc:l,fv:u}=this,{amb:f,gasV:h}=this.gas,m=e.aFace,p=_n.face;for(let d=0;d<=n;d+=1){const g=d*s;for(let x=0;x<s;x+=1){const w=g+x,y=c[w];if(h[w]===0||y===0){for(let b=0;b<Ht;b+=1)u[b*a+w]=0;continue}const _=e.av[w]<1?y*m*t*e.av[w]:y*m*t;if(d===0||d===n){const b=d===0?x:x+(n-1)*s,k=d===0?y>0:y<0;for(let P=0;P<Ht;P+=1)u[P*a+w]=_*(k?f[P]:l[P*i+b]);continue}let F,T,A;if(y>0?(F=w-s,T=w,A=d>=2&&r[w-2*s]===U?w-2*s:-1):(F=w,T=w-s,A=d+1<n&&r[w+s]===U?w+s:-1),A<0){for(let b=0;b<Ht;b+=1)u[b*a+w]=_*l[b*i+F];continue}for(let b=0;b<Ht;b+=1){const k=b*i;u[b*a+w]=_*p(l[k+F],l[k+A],l[k+T])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:c,fv:l}=this,{gasU:u,gasV:f,escaped:h}=this.gas,m=t.mg,p=t.mfog,d=t.Hg;for(let g=0;g<s;g+=1){const x=g*e,w=g*i;for(let _=1;_<e;_+=1){const F=w+_;if(u[F]===0)continue;const T=x+_-1,A=T+1;for(let P=0;P<Ft;P+=1){const M=c[P*r+F];m[P*n+T]-=M,m[P*n+A]+=M}const b=c[ne*r+F];p[T]-=b,p[A]+=b;const k=c[le*r+F];d[T]-=k,d[A]+=k}if(u[w]!==0){const _=x;for(let A=0;A<Ft;A+=1){const b=c[A*r+w];m[A*n+_]+=b,h[A]-=b}const F=c[ne*r+w];p[_]+=F,h[ne]-=F;const T=c[le*r+w];d[_]+=T,h[le]-=T}const y=w+e;if(u[y]!==0){const _=x+e-1;for(let A=0;A<Ft;A+=1){const b=c[A*r+y];m[A*n+_]-=b,h[A]+=b}const F=c[ne*r+y];p[_]-=F,h[ne]+=F;const T=c[le*r+y];d[_]-=T,h[le]+=T}}for(let g=1;g<s;g+=1){const x=g*e;for(let w=0;w<e;w+=1){const y=x+w;if(f[y]===0)continue;const _=y-e,F=y;for(let b=0;b<Ft;b+=1){const k=l[b*a+y];m[b*n+_]-=k,m[b*n+F]+=k}const T=l[ne*a+y];p[_]-=T,p[F]+=T;const A=l[le*a+y];d[_]-=A,d[F]+=A}}for(let g=0;g<e;g+=1){if(f[g]!==0){const w=g;for(let F=0;F<Ft;F+=1){const T=l[F*a+g];m[F*n+w]+=T,h[F]-=T}const y=l[ne*a+g];p[w]+=y,h[ne]-=y;const _=l[le*a+g];d[w]+=_,h[le]-=_}const x=g+s*e;if(f[x]!==0){const w=g+(s-1)*e;for(let F=0;F<Ft;F+=1){const T=l[F*a+x];m[F*n+w]-=T,h[F]+=T}const y=l[ne*a+x];p[w]-=y,h[ne]+=y;const _=l[le*a+x];d[w]-=_,h[le]+=_}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:c,scale:l}=this,u=t.nu,f=t.nv;c.fill(0);const h=_n.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const w=x+g*i;if(m[w]===0)continue;const y=h(r,u,w);y>0&&x>0?c[x-1+g*e]+=y:y<0&&x<e&&(c[x+g*e]-=y)}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const w=x+g*e;if(p[w]===0)continue;const y=h(a,f,w);y>0&&g>0?c[x+(g-1)*e]+=y:y<0&&g<s&&(c[x+g*e]-=y)}let d=!1;for(let g=0;g<n;g+=1){const x=.9*this.gas.massOf(g);l[g]=c[g]>x&&c[g]>0?x/c[g]:1,l[g]<1&&(d=!0)}if(d){for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const w=x+g*i;if(m[w]===0)continue;const _=h(r,u,w)>0?x>0?x-1+g*e:-1:x<e?x+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Ht;F+=1)r[F*u+w]*=l[_]}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const w=x+g*e;if(p[w]===0)continue;const _=h(a,f,w)>0?g>0?x+(g-1)*e:-1:g<s?x+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Ht;F+=1)a[F*f+w]*=l[_]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=ne;i+=1)n+=t[i*e+s];return n}}const Yt=.05;class su{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(Ht));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(Ht));v(this,"dp0",new Float64Array(8));v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new _n(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<Ft;a+=1)n+=s[a]/gt[a];const i=e/(Et*t*n);let r=0;for(let a=0;a<Ft;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*re(a,t);this.amb[ne]=0,this.amb[le]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*At(e);for(let r=0;r<Ft;r+=1)i+=s.mg[r*n+t]*re(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Nr(s.mg[t],s.mg[n+t],s.mg[Z*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[Z*s+t],c=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/gt[0]+r/gt[1]+a/gt[Z],l+c<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let u;if(c<=0)u=ga(i,r,a,e.Hg[t]);else{u=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const h=(e.Hg[t]-this.enthalpy(t,u))/this.heatCapacity(t,u);if(u+=h,Math.abs(h)<1e-10)break}}u>150&&u<3e3||(u=Math.min(3e3,Math.max(150,Number.isFinite(u)?u:this.ambT))),e.T[t]=u,this.cap[t]=Nr(i,r,a,c,u),this.rho[t]=l/n,this.mu[t]=Vl(i,r,a,u)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===dt){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===rt&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Et*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===dt){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Z*e+s];if(t.kind[s]===rt&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Et*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===dt||this.vgas[e]<=0?0:this.nmol[e]*Et*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<Ft;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let c=0;for(let f=0;f<Ft;f+=1)c+=s[f]/gt[f];const l=this.R.pAt(t)*a/(Et*e*c);let u=0;for(let f=0;f<Ft;f+=1)i.mg[f*r+t]=l*s[f],u+=l*s[f]*re(f,e);i.mfog[t]=0,i.Hg[t]=u,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let a=0;a<n;a+=1){const c=t[a],l=i[a];if(c===l||l===dt||c===dt)continue;r+=1;const u=a%s,f=(a-u)/s;let h=0;for(let m=0;m<4;m+=1){const p=this.across(a,u,f,m);p>=0&&i[p]===U&&t[p]===U&&(h+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(!(h<=0)){if(l===rt)for(let m=0;m<4;m+=1){const p=this.across(a,u,f,m);if(p<0||i[p]!==U||t[p]!==U)continue;const d=(this.vgas[p]>0?this.vgas[p]:e.vCell)/h;this.move(a,p,d)}else{let m=this.massOf(a),p=0;for(let d=0;d<4;d+=1){const g=this.across(a,u,f,d);if(g<0||i[g]!==U||t[g]!==U)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h;p+=x*this.rho[g]}if(p*=Math.max(.001,1-e.fs[a]-e.phi[a]-e.alpha[a])*e.vCell,p<=m)continue;for(let d=0;d<4;d+=1){const g=this.across(a,u,f,d);if(g<0||i[g]!==U||t[g]!==U)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h,w=this.massOf(g);if(w<=0)continue;const y=Math.min(.25,(p-m)*x/w);this.move(g,a,y)}m=this.massOf(a),m>0&&(e.T[a]=this.ambT)}this.deriveCell(a)}}return r}across(t,e,s,n){const i=this.g,{nx:r,ny:a}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<a-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let c=0;c<Ft;c+=1){const l=n.mg[c*i+t]*s;n.mg[c*i+t]-=l,n.mg[c*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let c=0;c<s;c+=1)for(let l=0;l<=e;l+=1){const u=l+c*i,f=l>0?n[l-1+c*e]:-1,h=l<e?n[l+c*e]:-1;let m=0;(f===U&&h===U||l===0&&t.openL&&h===U||l===e&&t.openR&&f===U)&&(m=1),t.au[u]<=0&&(m=0),this.gasU[u]=m,m===0&&(r[u]=f===rt||h===rt?f===dt||h===dt||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[u]:t.usol[u])}for(let c=0;c<=s;c+=1)for(let l=0;l<e;l+=1){const u=l+c*e,f=c>0?n[l+(c-1)*e]:-1,h=c<s?n[l+c*e]:-1;let m=0;(f===U&&h===U||c===0&&t.openB&&h===U||c===s&&t.openT&&f===U)&&(m=1),t.av[u]<=0&&(m=0),this.gasV[u]=m,m===0&&(a[u]=f===rt||h===rt?f===dt||h===dt||c===0&&!t.openB||c===s&&!t.openT?0:t.vl[u]:t.vsol[u])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),u=Math.min(r-1.000001,Math.max(0,s/a-.5)),f=Math.floor(l),h=Math.floor(u),m=l-f,p=u-h,d=t[f+h*c],g=t[f+1+h*c],x=t[f+(h+1)*c],w=t[f+1+(h+1)*c];return this.lo=Math.min(d,g,x,w),this.hi=Math.max(d,g,x,w),(1-p)*((1-m)*d+m*g)+p*((1-m)*x+m*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),u=Math.floor(c),f=Math.floor(l),h=c-u,m=l-f,p=t[u+f*i],d=t[u+1+f*i],g=t[u+(f+1)*i],x=t[u+1+(f+1)*i];return this.lo=Math.min(p,d,g,x),this.hi=Math.max(p,d,g,x),(1-m)*((1-h)*p+h*d)+m*((1-h)*g+h*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,c=n+1,l=s.ug,u=s.vg,{u0:f,v0:h,u1:m,v1:p}=this,d=this.lim;f.set(l),h.set(u);for(let y=0;y<i;y+=1)for(let _=0;_<=n;_+=1){const F=_+y*c;if(this.gasU[F]===0){m[F]=f[F];continue}const T=_*r,A=(y+.5)*r,b=this.sampleV(h,T,A);m[F]=this.sampleU(f,T-t*f[F],A-t*b),d[2*F]=this.lo,d[2*F+1]=this.hi}const g=2*s.nu;for(let y=0;y<=i;y+=1)for(let _=0;_<n;_+=1){const F=_+y*n;if(this.gasV[F]===0){p[F]=h[F];continue}const T=(_+.5)*r,A=y*r,b=this.sampleU(f,T,A);p[F]=this.sampleV(h,T-t*b,A-t*h[F]),d[g+2*F]=this.lo,d[g+2*F+1]=this.hi}for(let y=0;y<i;y+=1)for(let _=0;_<=n;_+=1){const F=_+y*c;if(this.gasU[F]===0)continue;const T=_*r,A=(y+.5)*r,b=this.sampleV(h,T,A),k=this.sampleU(m,T+t*f[F],A+t*b);let P=m[F]+.5*(f[F]-k);(P<d[2*F]||P>d[2*F+1])&&(P=m[F]),l[F]=P}for(let y=0;y<=i;y+=1)for(let _=0;_<n;_+=1){const F=_+y*n;if(this.gasV[F]===0)continue;const T=(_+.5)*r,A=y*r,b=this.sampleU(f,T,A),k=this.sampleV(p,T+t*b,A+t*h[F]);let P=p[F]+.5*(h[F]-k);(P<d[g+2*F]||P>d[g+2*F+1])&&(P=p[F]),u[F]=P}const x=this.R;for(let y=0;y<=i;y+=1)for(let _=0;_<n;_+=1){const F=_+y*n;if(this.gasV[F]===0)continue;const T=y>0?_+(y-1)*n:-1,A=y<i?_+y*n:-1,b=T>=0&&a[T]===U?this.rho[T]:-1,k=A>=0&&a[A]===U?this.rho[A]:-1,P=Math.max(Yt,b>0&&k>0?.5*(b+k):Math.max(b,k));if(!(b>0||k>0))continue;const M=b>0?T:A,S=x.id[M],C=S>=0?x.rhoBar[S]:x.rhoAmb;u[F]-=t*e*(P-C)/P}m.set(l),p.set(u);const w=t/(r*r);for(let y=0;y<i;y+=1)for(let _=0;_<=n;_+=1){const F=_+y*c;if(this.gasU[F]===0)continue;const T=_<n&&a[_+y*n]===U?_+y*n:_-1+y*n,A=this.mu[T]/Math.max(Yt,this.rho[T]),b=m[F],k=_<n?m[F+1]:b,P=_>0?m[F-1]:b,M=y>0?m[F-c]:s.openB?b:-b,S=y<i-1?m[F+c]:s.openT?b:-b;l[F]=b+Math.min(.2,w*A)*(k+P+M+S-4*b)}for(let y=0;y<=i;y+=1)for(let _=0;_<n;_+=1){const F=_+y*n;if(this.gasV[F]===0)continue;const T=y<i&&a[_+y*n]===U?_+y*n:_+(y-1)*n,A=this.mu[T]/Math.max(Yt,this.rho[T]),b=p[F],k=y<i?p[F+n]:b,P=y>0?p[F-n]:b,M=_>0?p[F-1]:s.openL?b:-b,S=_<n-1?p[F+1]:s.openR?b:-b;u[F]=b+Math.min(.2,w*A)*(S+M+P+k-4*b)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==U){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:c}=n,l=i+1,u=n.ug,f=n.vg;let h=i,m=-1,p=r,d=-1,g=0;for(let A=0;A<r;A+=1)for(let b=0;b<i;b+=1)c[b+A*i]===U&&(g+=1,b<h&&(h=b),b>m&&(m=b),A<p&&(p=A),A>d&&(d=A));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=g,g===0)return this.last;const w=this.solver,y=w.begin(m-h+1,d-p+1),_=this.rho;for(let A=p;A<=d;A+=1)for(let b=h;b<=m;b+=1){const k=b+A*i;if(c[k]!==U)continue;const P=w.at(b-h,A-p);y.act[P]=1,y.x[P]=n.pg[k];const M=b+A*l,S=b+A*i,C=this.fluxU(M+1)-this.fluxU(M)+this.fluxV(S+i)-this.fluxV(S);y.b[P]=n.Sg[k]*a*a-a*C;const L=Math.max(Yt,_[k]);b+1<i?c[k+1]===U&&b+1<=m&&this.gasU[M+1]!==0&&(y.ax[P]=n.au[M+1]*2*t/(L+Math.max(Yt,_[k+1]))):n.openR&&this.gasU[M+1]!==0&&(y.dDx[P]+=n.au[M+1]*2*t/L),b===0&&n.openL&&this.gasU[M]!==0&&(y.dDx[P]+=n.au[M]*2*t/L),A+1<r?c[k+i]===U&&A+1<=d&&this.gasV[S+i]!==0&&(y.ay[P]=n.av[S+i]*2*t/(L+Math.max(Yt,_[k+i]))):n.openT&&this.gasV[S+i]!==0&&(y.dDy[P]+=n.av[S+i]*2*t/L),A===0&&n.openB&&this.gasV[S]!==0&&(y.dDy[P]+=n.av[S]*2*t/L)}const F=w.solve(e,s,!0);x.iterations=F.iterations,x.residual=F.residual,x.capped=F.capped;const T=n.pg;for(let A=0;A<n.n;A+=1)c[A]!==U&&(T[A]=0);for(let A=p;A<=d;A+=1)for(let b=h;b<=m;b+=1){const k=b+A*i;c[k]===U&&(T[k]=y.x[w.at(b-h,A-p)])}for(let A=0;A<r;A+=1)for(let b=0;b<=i;b+=1){const k=b+A*l;if(this.gasU[k]===0)continue;if(b===0){u[k]-=2*t/Math.max(Yt,_[A*i])/a*T[A*i];continue}if(b===i){u[k]+=2*t/Math.max(Yt,_[i-1+A*i])/a*T[i-1+A*i];continue}const P=b-1+A*i,M=b+A*i;u[k]-=2*t/(Math.max(Yt,_[P])+Math.max(Yt,_[M]))/a*(T[M]-T[P])}for(let A=0;A<=r;A+=1)for(let b=0;b<i;b+=1){const k=b+A*i;if(this.gasV[k]===0)continue;if(A===0){f[k]-=2*t/Math.max(Yt,_[b])/a*T[b];continue}if(A===r){f[k]+=2*t/Math.max(Yt,_[b+(r-1)*i])/a*T[b+(r-1)*i];continue}const P=b+(A-1)*i,M=b+A*i;f[k]-=2*t/(Math.max(Yt,_[P])+Math.max(Yt,_[M]))/a*(T[M]-T[P])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let c=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===dt||this.cap[f]<=0)continue;const h=this.nmol[f];c+=h*(h*Et*e.T[f]/s.pAt(f))/this.cap[f]}c*=Et/a;const l=1/Math.max(.05,1-c);let u=0;for(let f=0;f<4;f+=1){const h=s.statePressure(r);s.p0[r]=h;const m=(h-(t[r]+u))*l;if(Math.abs(m)<=1e-10*h)break;let p=0;for(let d=0;d<n;d+=1){if(s.id[d]!==r||e.kind[d]===dt||this.cap[d]<=0)continue;const g=this.nmol[d]*Et*e.T[d]/s.pAt(d);p+=g,e.Hg[d]+=g*m,this.deriveCell(d)}u+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=u}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<Ft;i+=1)n+=e.mg[i*s+t]/gt[i];return n<=0?0:e.mg[Z*s+t]/gt[Z]/n*this.R.pAt(t)}}function nu(o,t,e,s,n,i,r){const{nx:a,ny:c}=o,l=a+1,u=o.ul,f=o.vl;for(let h=0;h<o.nu;h+=1)s[h]=t[h]!==0?1:0;for(let h=0;h<o.nv;h+=1)n[h]=e[h]!==0?1:0;for(let h=0;h<2;h+=1){i.set(u),r.set(f);for(let m=0;m<c;m+=1)for(let p=0;p<=a;p+=1){const d=p+m*l;if(s[d]!==0)continue;let g=0,x=0;p>0&&s[d-1]===1&&(g+=u[d-1],x+=1),p<a&&s[d+1]===1&&(g+=u[d+1],x+=1),m>0&&s[d-l]===1&&(g+=u[d-l],x+=1),m<c-1&&s[d+l]===1&&(g+=u[d+l],x+=1),x>0&&(i[d]=g/x,s[d]=3)}for(let m=0;m<=c;m+=1)for(let p=0;p<a;p+=1){const d=p+m*a;if(n[d]!==0)continue;let g=0,x=0;p>0&&n[d-1]===1&&(g+=f[d-1],x+=1),p<a-1&&n[d+1]===1&&(g+=f[d+1],x+=1),m>0&&n[d-a]===1&&(g+=f[d-a],x+=1),m<c&&n[d+a]===1&&(g+=f[d+a],x+=1),x>0&&(r[d]=g/x,n[d]=3)}u.set(i),f.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let h=0;h<o.nu;h+=1)s[h]===0&&(u[h]=0);for(let h=0;h<o.nv;h+=1)n[h]===0&&(f[h]=0)}function iu(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<o.count;a+=1){const c=Math.min(s-1,Math.max(0,Math.floor(o.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[a]/t.dx)));if(i[c+l*s]===rt){e[a]=0;continue}let u=!1;for(let f=Math.max(0,l-2);f<=Math.min(n-1,l+2)&&!u;f+=1)for(let h=Math.max(0,c-2);h<=Math.min(s-1,c+2);h+=1)if(i[h+f*s]===rt){u=!0;break}e[a]=u?0:1,u||(r=!0)}return r}function Bn(o,t,e,s){const{nx:n,ny:i,dx:r}=o,a=n+1,c=1/r;let l=Math.min(n-1e-6,Math.max(0,t*c)),u=Math.min(i-1.000001,Math.max(0,e*c-.5)),f=Math.floor(l),h=Math.floor(u),m=l-f,p=u-h;const d=o.ul;s[0]=(1-p)*((1-m)*d[f+h*a]+m*d[f+1+h*a])+p*((1-m)*d[f+(h+1)*a]+m*d[f+1+(h+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*c-.5)),u=Math.min(i-1e-6,Math.max(0,e*c)),f=Math.floor(l),h=Math.floor(u),m=l-f,p=u-h;const g=o.vl;s[1]=(1-p)*((1-m)*g[f+h*n]+m*g[f+1+h*n])+p*((1-m)*g[f+(h+1)*n]+m*g[f+1+(h+1)*n])}const ru=18,ou=1,cu=.002,au=4,dc=.2687,mc=.85,pc=.7;function lu(o,t,e,s,n){const i=Math.abs(t-e)/e,r=s/e;return i*n*o*o/(ru*r+Math.sqrt(.75*ou*i*n*o*o*o))}function Os(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class fu{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"rad",new Float64Array(0));v(this,"w",new Float64Array(6));v(this,"vel",new Float64Array(2));v(this,"hit",new Float64Array(6));v(this,"h",0);v(this,"ks",0);v(this,"vmax",0);this.e=t,this.head=new Int32Array(t.grid.n)}dtLimit(){return this.vmax>0?.5*this.e.grid.dx/this.vmax:1/0}splatVolume(){const{grid:t,grains:e}=this.e,{nx:s,ny:n,dx:i}=t,r=t.grain;r.fill(0);const a=this.w,c=1/i,l=1/t.vCell;for(let u=0;u<e.count;u+=1){const f=e.m[u]/e.rho(u)*l,h=Os(e.x[u]*c-.5,a,0),m=Os(e.y[u]*c-.5,a,3);for(let p=0;p<3;p+=1){const d=m+p;if(!(d<0||d>=n))for(let g=0;g<3;g+=1){const x=h+g;x<0||x>=s||(r[x+d*s]+=a[g]*a[3+p]*f)}}}}step(t){const e=this.e.grains;if(e.count===0){this.vmax=0;return}this.next.length<e.cap&&(this.next=new Int32Array(e.cap),this.px=new Float64Array(e.cap),this.py=new Float64Array(e.cap),this.rad=new Float64Array(e.cap)),this.forces(t);const s=this.e.grid.dx;for(let r=0;r<e.count;r+=1)this.rad[r]=dc*s*Math.sqrt(Math.max(0,e.m[r]/e.m0[r]));this.ks=1/(4*dc*s);const n=Math.max(1,Math.ceil(t/cu-1e-9));this.h=t/n;for(let r=0;r<n;r+=1)this.substep();this.escape();let i=0;for(let r=0;r<e.count;r+=1){const a=Math.hypot(e.vx[r],e.vy[r]);a>i&&(i=a)}this.vmax=i}forces(t){const e=this.e,{grid:s,grains:n}=e,i=e.liquid.rhoRef,r=e.gy,a=r>0?r:9.81;for(let c=0;c<n.count;c+=1){const l=s.cellAt(n.x[c],n.y[c]);if(!(l>=0&&s.kind[l]===rt)){n.vy[c]-=r*t;continue}const f=ke[n.mat[c]].rho,h=r*(1-i/f),m=s.Tl[l]>200?s.Tl[l]:293.15,p=lu(n.diameter(c),f,i,bs(m),a)/Math.max(1e-6,Math.abs(a*(1-i/f)));Bn(s,n.x[c],n.y[c],this.vel);const d=n.vx[c],g=n.vy[c]-h*t,x=t/p,w=(d+x*this.vel[0])/(1+x),y=(g+x*this.vel[1])/(1+x);n.vx[c]=w,n.vy[c]=y,this.spread(n.x[c],n.y[c],-n.m[c]*(w-d)/t,-n.m[c]*(y-g)/t)}}spread(t,e,s,n){const{grid:i,liquid:r}=this.e,{nx:a,ny:c,dx:l}=i,u=this.w,f=1/l;let h=Os(t*f,u,0),m=Os(e*f-.5,u,3);for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=h+d,x=m+p;g<0||g>a||x<0||x>=c||(r.fU[g+x*(a+1)]+=s*u[d]*u[3+p])}h=Os(t*f-.5,u,0),m=Os(e*f,u,3);for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=h+d,x=m+p;g<0||g>=a||x<0||x>c||(r.fV[g+x*a]+=n*u[d]*u[3+p])}}substep(){const{grid:t,grains:e}=this.e,{px:s,py:n,head:i,next:r}=this,{nx:a,ny:c}=t,l=this.h;for(let f=0;f<e.count;f+=1)s[f]=e.x[f],n[f]=e.y[f],e.x[f]+=l*e.vx[f],e.y[f]+=l*e.vy[f];i.fill(-1);for(let f=0;f<e.count;f+=1){const h=t.cellAt(e.x[f],e.y[f]);r[f]=i[h],i[h]=f}const u=1/t.dx;for(let f=0;f<au;f+=1){const h=(f&1)===1;for(let m=0;m<e.count;m+=1){const p=h?e.count-1-m:m,d=Math.min(a-1,Math.max(0,Math.floor(e.x[p]*u))),g=Math.min(c-1,Math.max(0,Math.floor(e.y[p]*u)));for(let x=-1;x<=1;x+=1){const w=g+x;if(!(w<0||w>=c))for(let y=-1;y<=1;y+=1){const _=d+y;if(!(_<0||_>=a))for(let F=i[_+w*a];F>=0;F=r[F])F!==p&&(h?F<p:F>p)&&this.pair(p,F)}}this.walls(p)}}for(let f=0;f<e.count;f+=1)e.vx[f]=(e.x[f]-s[f])/l,e.vy[f]=(e.y[f]-n[f])/l}pair(t,e){const s=this.e.grains,n=s.x[t]-s.x[e],i=s.y[t]-s.y[e],r=this.rad[t]+this.rad[e],a=n*n+i*i;if(a>=r*r||a<1e-24)return;const c=Math.sqrt(a),l=n/c,u=i/c,f=r-c,h=Math.exp(this.ks*s.y[t])/s.m[t],m=Math.exp(this.ks*s.y[e])/s.m[e],p=h/(h+m),d=m/(h+m);s.x[t]+=p*f*l,s.y[t]+=p*f*u,s.x[e]-=d*f*l,s.y[e]-=d*f*u;const g=s.x[t]-this.px[t]-(s.x[e]-this.px[e]),x=s.y[t]-this.py[t]-(s.y[e]-this.py[e]),w=g*l+x*u,y=g-w*l,_=x-w*u,F=Math.hypot(y,_);if(!(F>0))return;const T=F<mc*f?1:Math.min(1,pc*f/F);s.x[t]-=p*T*y,s.y[t]-=p*T*_,s.x[e]+=d*T*y,s.y[e]+=d*T*_}walls(t){const e=this.e,{grid:s,grains:n}=e,i=this.rad[t],r=s.w,a=s.h;!s.openL&&n.x[t]<i&&this.wallContact(t,1,0,i-n.x[t],0,0),!s.openR&&n.x[t]>r-i&&this.wallContact(t,-1,0,n.x[t]-(r-i),0,0),!s.openB&&n.y[t]<i&&this.wallContact(t,0,1,i-n.y[t],0,0),!s.openT&&n.y[t]>a-i&&this.wallContact(t,0,-1,n.y[t]-(a-i),0,0);const c=e.liquid.bodyHit,l=c!==null?c(this.px[t],this.py[t],n.x[t],n.y[t],this.hit):0;if(l===1){const d=this.hit,g=Math.hypot(d[0]-n.x[t],d[1]-n.y[t]);this.wallContact(t,d[2],d[3],g,d[4],d[5]);return}if(l===2)return;const u=s.sdfAt(n.x[t],n.y[t]);if(u>=i)return;const f=.25*s.dx;let h=s.sdfAt(n.x[t]+f,n.y[t])-s.sdfAt(n.x[t]-f,n.y[t]),m=s.sdfAt(n.x[t],n.y[t]+f)-s.sdfAt(n.x[t],n.y[t]-f);const p=Math.hypot(h,m);p>1e-12&&(h/=p,m/=p,this.wallContact(t,h,m,i-u,0,0))}wallContact(t,e,s,n,i,r){if(!(n>0))return;const a=this.e.grains;a.x[t]+=n*e,a.y[t]+=n*s;const c=a.x[t]-this.px[t]-i*this.h,l=a.y[t]-this.py[t]-r*this.h,u=c*e+l*s,f=c-u*e,h=l-u*s,m=Math.hypot(f,h);if(!(m>0))return;const p=m<mc*n?1:Math.min(1,pc*n/m);a.x[t]-=p*f,a.y[t]-=p*h}escape(){const t=this.e,{grid:e,grains:s}=t,n=e.w,i=e.h,r=1e-4*e.dx;for(let a=0;a<s.count;a+=1){const c=s.x[a],l=s.y[a];if(c<0&&e.openL||c>n&&e.openR||l<0&&e.openB||l>i&&e.openT){ke[s.mat[a]].dissolves&&(t.flows.escapedSalt+=s.m[a]),t.flows.escapedEnergy+=s.enthalpy(a),s.remove(a),a-=1;continue}(c<r||c>n-r)&&(s.vx[a]=0),(l<r||l>i-r)&&(s.vy[a]=0),s.x[a]=Math.min(n-r,Math.max(r,c)),s.y[a]=Math.min(i-r,Math.max(r,l))}}}const fi=1e-5,uu=1e-4;function gc(o,t){const e=o<=1?1:Math.pow(Math.min(o,400),.077);return 1+Math.cbrt(1+o*t)*e}class hu{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"gHead");v(this,"gNext",new Int32Array(0));v(this,"listed",!1);v(this,"dissolved",0);v(this,"grown",0);v(this,"burst",0);v(this,"vel",new Float64Array(2));this.e=t,this.head=new Int32Array(t.grid.n),this.gHead=new Int32Array(t.grid.n)}invalidate(){this.listed=!1}list(){if(this.listed)return;const{grid:t,particles:e,grains:s}=this.e;this.next.length<e.cap&&(this.next=new Int32Array(e.cap)),this.gNext.length<s.cap&&(this.gNext=new Int32Array(s.cap)),this.head.fill(-1),this.gHead.fill(-1);for(let n=0;n<e.count;n+=1){if(e.mat[n]!==ut)continue;const i=t.cellAt(e.x[n],e.y[n]);i<0||(this.next[n]=this.head[i],this.head[i]=n)}for(let n=0;n<s.count;n+=1){const i=t.cellAt(s.x[n],s.y[n]);i<0||(this.gNext[n]=this.gHead[i],this.gHead[i]=n)}this.listed=!0}step(t){const{grains:e}=this.e;e.count!==0&&(this.listed=!1,this.list(),this.nucleate(t),this.heatAndDissolve(t),this.listed=!1)}grow(t,e,s,n){const{grid:i,grains:r}=this.e;if(r.count===0)return!1;this.list();const a=i.cellAt(t,e);if(a<0)return!1;const c=a%i.nx,l=(a-c)/i.nx;let u=-1,f=1/0;for(let m=-1;m<=1;m+=1)for(let p=-1;p<=1;p+=1){const d=c+p,g=l+m;if(!(d<0||g<0||d>=i.nx||g>=i.ny))for(let x=this.gHead[d+g*i.nx];x>=0;x=this.gNext[x]){if(!ke[r.mat[x]].dissolves)continue;const w=(r.x[x]-t)**2+(r.y[x]-e)**2;w<f&&(f=w,u=x)}}if(u<0)return!1;const h=r.enthalpy(u)+n;return r.m[u]+=s,r.T[u]=et+h/(r.m[u]*r.cp(u)),this.grown+=s,!0}nucleate(t){const e=this.e,{grid:s,grains:n,bubbles:i,particles:r,liquid:a}=e;for(let c=0;c<n.count;c+=1){if(n.dry[c]===0)continue;const l=s.cellAt(n.x[c],n.y[c]);if(l<0||s.kind[l]!==rt||this.head[l]<0)continue;n.dry[c]=0;let u=0,f=0,h=0;for(let A=this.head[l];A>=0;A=this.next[A]){const b=r.smass[2*A],k=r.mass[A]-b;u+=k,f+=k*r.T[A],h+=k*(b>0?zs(r.T[A],b/r.mass[A]):r.h[A])}if(!(u>0))continue;const m=f/u,p=Math.max(.5*e.pRef,e.pRef+s.pl[l]),d=kt(p);if(m-d<zr(fi,p))continue;const g=p+2*Un(m)/fi,x=kt(g),w=4/3*Math.PI*fi**3,y=Te(x)*w;if(y*4>u)continue;const _=i.add(n.x[c],n.y[c],.5*s.depth);if(_<0)continue;i.m[_*lt+Z]=y,i.r[_]=fi,i.V[_]=w,i.Tb[_]=x,i.pb[_]=g,i.pv[_]=g,i.H[_]=y*pt(x),i.site[_]=-1,i.age[_]=0,Bn(s,n.x[c],n.y[c],this.vel);const F=e.bubbleModel.motionState;F.ux0[_]=this.vel[0],F.uy0[_]=this.vel[1],i.vx[_]=this.vel[0],i.vy[_]=this.vel[1];const T=h/u;for(let A=this.head[l];A>=0;A=this.next[A]){const b=r.smass[2*A],k=y*(r.mass[A]-b)/u,P=b>0?zs(r.T[A],b/r.mass[A]):r.h[A],M=r.mass[A]/r.rho[A],S=r.mass[A]*r.h[A]-k*P;r.mass[A]-=k,r.h[A]=S/r.mass[A],r.derive(A),a.dVp[A]+=r.mass[A]/r.rho[A]-M}e.heat.src[l]-=y*(pt(x)-T)/t,this.burst+=1}}heatAndDissolve(t){const e=this.e,{grid:s,grains:n,particles:i,liquid:r}=e,a=s.n;for(let c=0;c<n.count;c+=1){const l=s.cellAt(n.x[c],n.y[c]);if(l<0)continue;const u=ke[n.mat[c]];let f=0,h=0,m=0,p=0;for(let j=this.head[l];j>=0;j=this.next[j]){const R=i.smass[2*j];f+=i.mass[j]-R,h+=R,m+=i.mass[j]*i.T[j],p+=i.mass[j]}const d=f>0&&s.kind[l]===rt,g=n.diameter(c),x=n.N[c]*Math.PI*g*g;Bn(s,n.x[c],n.y[c],this.vel);const w=Math.hypot(n.vx[c]-this.vel[0],n.vy[c]-this.vel[1]),y=d?m/p:s.T[l];if(d||s.kind[l]===U){let j,R,E;if(d){const q=sn(y);j=Mn(y),R=bs(y)/q,E=j/(q*Me(y))}else j=go(s.mg[l],s.mg[a+l],s.mg[Z*a+l],y),R=16e-6,E=22e-6;const W=w*g/R,N=gc(W,R/E)*j/g,J=n.m[c]*u.cp,tt=(1-Math.exp(-t*N*x/J))*(y-n.T[c]);tt!==0&&(n.T[c]+=tt,e.heat.src[l]-=J*tt/t)}if(!d||!u.dissolves)continue;const _=m/p,F=h/(h+f),T=Ea(_);if(F>=T)continue;const A=Ji(_,F),b=Ur(_),k=bs(_)/A,P=w*g/k,M=gc(P,k/b)*b/g,S=(T-F)/(1-T);let C=x*M*A*Math.log(1+S)*t;const L=(T*(h+f)-h)/(1-T);C>L&&(C=Math.max(0,L));const B=n.m[c]-C<uu*n.m0[c];if(B&&(C=n.m[c]),!(C>0))continue;const I=zn(n.T[c]);for(let j=this.head[l];j>=0;j=this.next[j]){const R=i.smass[2*j],E=C*(i.mass[j]-R)/f;if(!(E>0))continue;const W=i.mass[j]/i.rho[j],N=i.mass[j]*i.h[j]+E*I;i.mass[j]+=E,i.smass[2*j]=R+E,i.spc[2*j]=Wn,i.h[j]=N/i.mass[j],i.derive(j),r.dVp[j]+=i.mass[j]/i.rho[j]-W}this.dissolved+=C,B?(n.remove(c),c-=1):n.m[c]-=C}}}const xc=[1/6,2/3,1/6];class du{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"owner");v(this,"fs");v(this,"capB");v(this,"matB");v(this,"Ts");v(this,"au");v(this,"av");v(this,"usol");v(this,"vsol");v(this,"thin");v(this,"thinAny",!1);v(this,"phi");v(this,"alpha");v(this,"grain");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.grain=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(lt*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const c=a+r*t;i[c]===0&&(a>0&&s[a+r*(t+1)]<=0&&i[c-1]===0&&this.thinBlock(a-1,a,r-1,r+1),r>0&&n[c]<=0&&i[c-t]===0&&this.thinBlock(a-1,a+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:a}=this,c=s+1,l=t+e*s;let u=0;if(a[l]===0)for(let f=0;f<9;f+=1){const h=f%3-1,m=(f/3|0)-1,p=t+h,d=e+m;if(f===4||p<0||d<0||p>=s||d>=n||a[p+d*s]!==0)continue;const g=(h>0?1:0)+e*c,x=(m>0?1:0)*s;let w;if(m===0)w=i[t+g]<=0;else if(h===0)w=r[t+e*s+x]<=0;else{const y=a[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+x]<=0),_=a[t+d*s]===0&&(r[t+e*s+x]<=0||i[t+(h>0?1:0)+d*c]<=0);w=y&&_}w&&(u|=1<<f)}this.thin[l]=u}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let a=0;a<9;a+=1)i>>a&1?s[n+a]=0:r+=s[n+a];if(r>0)for(let a=0;a<9;a+=1)s[n+a]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:a}=this,c=Math.max(0,t),l=Math.max(0,e),u=Math.min(i-1,s),f=Math.min(r-1,n);for(let p=l;p<=f;p+=1)for(let d=c;d<=u;d+=1){const g=d+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let x=0;for(let w=-1;w<=1;w+=1)for(let y=-1;y<=1;y+=1)x+=xc[y+1]*xc[w+1]*this.solidShare(d+y,p+w);this.phiS[g]=x}const h=4,m=h*a;for(let p=l;p<=f;p+=1)for(let d=c;d<=u;d+=1){const g=d+p*i,x=this.solid[g]!==0,w=(d+.5)*a,y=(p+.5)*a;let _=m;x||(this.openL||(_=Math.min(_,w)),this.openR||(_=Math.min(_,this.w-w)),this.openB||(_=Math.min(_,y)),this.openT||(_=Math.min(_,this.h-y)));for(let F=-h;F<=h;F+=1){const T=p+F;if(!(T<0||T>=r))for(let A=-h;A<=h;A+=1){const b=d+A;if(b<0||b>=i||this.solid[b+T*i]!==0===x)continue;const P=Math.max(0,Math.abs(b+.5-(d+.5))-.5)*a,M=Math.max(0,Math.abs(T+.5-(p+.5))-.5)*a,S=Math.hypot(P,M);S<_&&(_=S)}}this.sdf[g]=x?-_:_}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),c=Math.floor(r),l=Math.floor(a),u=r-c,f=a-l,h=Math.min(s-1,c+1),m=Math.min(n-1,l+1),p=this.sdf;let d=(1-f)*((1-u)*p[c+l*s]+u*p[h+l*s])+f*((1-u)*p[c+m*s]+u*p[h+m*s]);return this.openL||(d=Math.min(d,t)),this.openR||(d=Math.min(d,this.w-t)),this.openB||(d=Math.min(d,e)),this.openT||(d=Math.min(d,this.h-e)),d}}const mu=5,vc=30;class pu{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",xa);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});v(this,"bodies",[]);v(this,"grains",null);v(this,"Cgr");v(this,"CTgr");v(this,"qb");v(this,"kS");v(this,"kF");v(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r),this.Cgr=new Float64Array(r),this.CTgr=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=mt[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*es}solidEnergy(t,e){return this.solidCapCrust(t)*(e-et)+this.g.film[t]*At(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=et+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:et+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Me(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let c=0;c<s.ncell;c+=1)r+=s.cellVolume(c);if(!(r>0))continue;const a=n.P*i/r;for(let c=0;c<s.nw;c+=1){const l=a*s.ww[c]*s.cellVolume(s.wk[c]);t[s.wc[c]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/mu,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/vc);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/vc)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:c,ny:l,n:u,depth:f,dx:h}=n,{C:m,Cs:p,Cg:d,CTl:g,Tstar:x,k:w,q:y,src:_}=this;this.heaterPower(t),g.fill(0);const F=n.Cl;F.fill(0);const{Co:T,CKo:A}=this;let b=!1,k=0;for(let O=0;O<i.count;O+=1){const K=i.mat[O],z=i.T[O],ht=i.mass[O]*i.cp(O);k+=ht;const ot=9*O,bt=r.bi[O],Mt=r.bj[O],xt=K===ut?0:bn(K,z);K!==ut&&!b&&(b=!0,T.fill(0),A.fill(0));for(let qt=0;qt<9;qt+=1){const _t=r.wt[ot+qt];if(_t===0)continue;const we=bt+qt%3,Tt=Mt+(qt/3|0);if(we<0||Tt<0||we>=c||Tt>=l)continue;const ss=we+Tt*c;F[ss]+=_t*ht,g[ss]+=_t*ht*z,K!==ut&&(T[ss]+=_t*ht,A[ss]+=_t*ht*xt)}}const{Cgr:P,CTgr:M}=this;P.fill(0),M.fill(0);const S=this.grains;if(S!==null)for(let O=0;O<S.count;O+=1){const K=n.cellAt(S.x[O],S.y[O]);if(K<0||n.solid[K]!==0)continue;const z=S.m[O]*S.cp(O);P[K]+=z,M[K]+=z*S.T[O]}const C=this.qb;C.fill(0);let L=this.bodyHeat(C);const{kS:B,kF:I,dSF:j}=this;for(let O=0;O<u;O+=1){let K=0,z=0;const ht=n.solid[O]!==0?n.T[O]:n.Ts[O];if(n.solid[O]!==0||n.capB[O]>0){K=this.solidCapCrust(O)+n.film[O]*Me(ht);const Tt=n.solid[O]!==0?mt[n.solid[O]-1]:mt[n.matB[O]-1];z=Tt!==void 0?Tt.k:0}const ot=a.cap[O]>0&&n.solid[O]===0?a.cap[O]:0,bt=F[O],Mt=K+ot+bt+P[O];if(p[O]=K,d[O]=ot,m[O]=Mt,j[O]=0,Mt<=0){x[O]=n.T[O],w[O]=0,y[O]=0;continue}const xt=(K*ht+ot*n.T[O]+g[O]+M[O])/Mt;x[O]=xt,bt>0&&(n.Tl[O]=g[O]/bt);let qt=z;if(n.solid[O]===0){const Tt=bt>=ot?b&&T[O]>0?((bt-T[O])*Mn(xt)+A[O])/bt:Mn(xt):go(n.mg[O],n.mg[u+O],n.mg[Z*u+O],xt);if(K>0){const ss=Math.min(1,n.fs[O]);qt=ss*z+(1-ss)*Tt,B[O]=z,I[O]=Tt,ot+bt+P[O]>0&&(j[O]=ht-(ot*n.T[O]+g[O]+M[O])/(ot+bt+P[O]))}else qt=Tt}w[O]=qt;let _t=_[O]+C[O];if(this.liquidPower!==0&&bt>0){const Tt=this.liquidPower*bt/k;_t+=Tt,L+=Tt}const we=n.heater[O];if(we>=0&&n.role[O]===1){const Tt=this.heaters[we];Tt!==void 0&&Tt.cells>0&&(_t+=Tt.P/Tt.cells,L+=Tt.P/Tt.cells)}y[O]=_t}const{gx:R,gy:E}=this;for(let O=0;O<l;O+=1)for(let K=0;K<c;K+=1){const z=K+O*c;if(R[z]=0,E[z]=0,m[z]<=0)continue;const ht=w[z];if(K+1<c&&m[z+1]>0){const ot=w[z+1];ht+ot>0&&(R[z]=2*ht*ot/(ht+ot)*f)}if(O+1<l&&m[z+c]>0){const ot=w[z+c];ht+ot>0&&(E[z]=2*ht*ot/(ht+ot)*f)}}const W=this.solver,N=W.begin(c,l),J=N.stride,tt=h*f,q=this.hExt*tt,Q=this.ambientT;for(let O=0;O<l;O+=1)for(let K=0;K<c;K+=1){const z=K+O*c;if(m[z]<=0)continue;const ht=K+1+(O+1)*J;N.act[ht]=1,N.dH[ht]=m[z]/t;let ot=y[z];const bt=w[z],Mt=x[z];K+1<c&&(N.ax[ht]=R[z],ot+=R[z]*(x[z+1]-Mt)),K>0&&(ot+=R[z-1]*(x[z-1]-Mt)),O+1<l&&(N.ay[ht]=E[z],ot+=E[z]*(x[z+c]-Mt)),O>0&&(ot+=E[z-c]*(x[z-c]-Mt));let xt=0;K===0&&(xt+=this.sideConductance(n.openL,bt,q,f)),K===c-1&&(xt+=this.sideConductance(n.openR,bt,q,f)),O===0&&(xt+=this.sideConductance(n.openB,bt,q,f)),O===l-1&&(xt+=this.sideConductance(n.openT,bt,q,f)),xt>0&&(N.dDx[ht]=xt,ot+=xt*(Q-x[z])),N.b[ht]=ot}const V=W.solve(e,s,!1),G=this.last.solve;G.iterations=V.iterations,G.residual=V.residual,G.capped=V.capped;const st=this.Tnew,vt=N.x;for(let O=0;O<l;O+=1)for(let K=0;K<c;K+=1){const z=K+O*c;st[z]=m[z]>0?x[z]+vt[K+1+(O+1)*J]:n.T[z]}const yt=this.dE;let D=0,H=0;for(let O=0;O<u;O+=1)yt[O]=m[O]>0?y[O]*t:0;for(let O=0;O<l;O+=1)for(let K=0;K<c;K+=1){const z=K+O*c;if(m[z]<=0)continue;const ht=w[z];if(R[z]>0){const ot=R[z]*(st[z+1]-st[z])*t;yt[z]+=ot,yt[z+1]-=ot,n.kind[z]!==n.kind[z+1]&&this.pair(n.kind[z],n.kind[z+1],ot)}if(E[z]>0){const ot=E[z]*(st[z+c]-st[z])*t;yt[z]+=ot,yt[z+c]-=ot,n.kind[z]!==n.kind[z+c]&&this.pair(n.kind[z],n.kind[z+c],ot)}for(let ot=0;ot<4;ot+=1){if(!(ot===0?K===0:ot===1?K===c-1:ot===2?O===0:O===l-1))continue;const Mt=ot===0?n.openL:ot===1?n.openR:ot===2?n.openB:n.openT,xt=this.sideConductance(Mt,ht,q,f)*(st[z]-Q)*t;yt[z]-=xt,Mt?H+=xt:D+=xt,n.solid[z]!==0&&(this.lossSolids+=xt)}}for(let O=0;O<u;O+=1){if(m[O]<=0)continue;const K=yt[O]/m[O];st[O]=K;let z=0;const ht=d[O]+F[O]+P[O];if(j[O]!==0&&p[O]>0&&ht>0){const ot=Math.min(.999,Math.max(.001,n.fs[O])),bt=f/(.5*ot/Math.max(1e-9,B[O])+.5*(1-ot)/Math.max(1e-9,I[O])),Mt=p[O]*ht/(p[O]+ht);z=(1-Math.exp(-t*bt/Mt))*j[O]*Mt}p[O]>0&&(n.Es[O]+=K*p[O]-z,this.deriveSolid(O)),d[O]>0&&(n.Hg[O]+=K*d[O]+z*d[O]/ht),z!==0&&F[O]+P[O]>0&&(st[O]+=z/ht)}for(let O=0;O<i.count;O+=1){const K=9*O,z=r.bi[O],ht=r.bj[O];let ot=0;for(let xt=0;xt<9;xt+=1){const qt=r.wt[K+xt];if(qt===0)continue;const _t=z+xt%3,we=ht+(xt/3|0);if(_t<0||we<0||_t>=c||we>=l)continue;const Tt=_t+we*c;m[Tt]>0&&(ot+=qt*st[Tt])}if(ot===0)continue;const bt=i.mass[O],Mt=bt/i.rho[O];i.h[O]+=i.cp(O)*ot,i.derive(O),r.dVp[O]+=bt/i.rho[O]-Mt}if(S!==null)for(let O=0;O<S.count;O+=1){const K=n.cellAt(S.x[O],S.y[O]);K>=0&&n.solid[K]===0&&m[K]>0&&(S.T[O]+=st[K])}for(let O=0;O<u;O+=1)d[O]>0&&a.deriveCell(O);_.fill(0);const X=this.last;return X.heater=L*t,X.lossWalls=D,X.lossOpen=H,X}pair(t,e,s){t===dt&&e===rt?this.fluxSL-=s:t===rt&&e===dt?this.fluxSL+=s:t===rt&&e===U?this.fluxLG-=s:t===U&&e===rt?this.fluxLG+=s:t===dt&&e===U?this.fluxSG-=s:t===U&&e===dt&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function gu(o,t,e,s,n,i,r,a,c,l,u){const{nx:f,ny:h,dx:m}=o;for(let x=0;x<o.nu;x+=1)e[x]=n[x]>l?e[x]/n[x]:0;for(let x=0;x<o.nv;x+=1)s[x]=i[x]>l?s[x]/i[x]:0;const p=c*m*m/u,d=(x,w)=>x+w>0?2*x*w/(x+w):0;let g=0;{const x=f+1,w=t.begin(x,h),y=o.ul;for(let F=0;F<h;F+=1)for(let T=0;T<=f;T+=1){const A=T+F*x;if(r[A]!==1)continue;const b=t.at(T,F),k=e[A];if(w.act[b]=1,w.dH[b]=p,w.x[b]=y[A],w.b[b]=p*y[A],T+1<=f){const P=r[A+1];P===1?w.ax[b]=d(k,e[A+1]):P===2&&(w.dDx[b]+=k)}if(T>0&&r[A-1]===2&&(w.dDx[b]+=k),F+1<h){const P=r[A+x];P===1?w.ay[b]=d(k,e[A+x]):P===2&&(w.dDy[b]+=2*k)}else o.openT||(w.dDy[b]+=2*k);F>0?r[A-x]===2&&(w.dDy[b]+=2*k):o.openB||(w.dDy[b]+=2*k)}const _=t.solve(1e-6,200,!1);g+=_.iterations;for(let F=0;F<h;F+=1)for(let T=0;T<=f;T+=1){const A=T+F*x;r[A]===1&&(y[A]=w.x[t.at(T,F)])}}{const x=t.begin(f,h+1),w=o.vl;for(let _=0;_<=h;_+=1)for(let F=0;F<f;F+=1){const T=F+_*f;if(a[T]!==1)continue;const A=t.at(F,_),b=s[T];if(x.act[A]=1,x.dH[A]=p,x.x[A]=w[T],x.b[A]=p*w[T],_+1<=h){const k=a[T+f];k===1?x.ay[A]=d(b,s[T+f]):k===2&&(x.dDy[A]+=b)}if(_>0&&a[T-f]===2&&(x.dDy[A]+=b),F+1<f){const k=a[T+1];k===1?x.ax[A]=d(b,s[T+1]):k===2&&(x.dDx[A]+=2*b)}else o.openR||(x.dDx[A]+=2*b);F>0?a[T-1]===2&&(x.dDx[A]+=2*b):o.openL||(x.dDx[A]+=2*b)}const y=t.solve(1e-6,200,!1);g+=y.iterations;for(let _=0;_<=h;_+=1)for(let F=0;F<f;F+=1){const T=F+_*f;a[T]===1&&(w[T]=x.x[t.at(F,_)])}}return g}class xu{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:c}=e,l=te.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(c*l),this.cellHost=new Uint8Array(c));const u=this.cellMat,f=this.cellHost;u.fill(0);let h=!1;for(let d=0;d<t.count;d+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx)));u[(g+x*r)*l+t.mat[d]]+=t.mass[d],t.smass[2*d]>0&&(h=!0)}if(h){this.cellVolW===null&&(this.cellVolW=new Float64Array(c));const d=this.cellVolW;d.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==ut)continue;const x=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),w=Math.min(a-1,Math.max(0,Math.floor(t.y[g]/e.dx)));d[x+w*r]+=t.mass[g]/t.rho[g]}}for(let d=0;d<c;d+=1){let g=0;for(let x=1;x<l;x+=1)u[d*l+x]>u[d*l+g]&&(g=x);f[d]=g}let m=!1;const p=.25*e.dx;for(let d=0;d<t.count;d+=1){i[d]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx))),w=f[g+x*r],y=t.mat[d];if(y===w)continue;const _=t.T[d],F=this.cellVolW,T=g+x*r,A=h&&w===ut&&F!==null&&F[T]>0?u[T*l]/F[T]:Fs(w,_),b=t.rho[d],k=Ln(w,_),P=Ln(y,_),M=t.mass[d]/b,S=Math.cbrt(6*M/Math.PI),C=Math.abs(A-b);if(C<=0||n<=0)continue;const L=(2*k+3*P)/(3*k+3*P);let B=C*n*S*S/(18*k*L);for(let j=0;j<8;j+=1){const R=Math.max(1e-9,A*B*S/k),E=24/R*L*(1+.15*Math.pow(R,.687));B=Math.sqrt(4*C*n*S/(3*A*E))}const I=b<A?1:-1;i[d]=I*Math.min(p,B*s),m=!0}return m}}function vu(o,t,e,s,n,i,r,a,c,l,u){const f=t.w,h=t.h,m=t.dx;let p=0,d=0,g=0,x=0;const w=s;for(let y=0;y<o.count;y+=1){const _=o.x[y],F=o.y[y],T=w[y]!==0;let A,b;if(T)A=_+e*o.vx[y],b=F+e*o.vy[y];else{i(_,F,c);const M=_+.5*e*c[0],S=F+.5*e*c[1];i(M,S,c),A=_+e*c[0],b=F+e*c[1]+(n!==null?n[y]:0)}if(A<0&&t.openL||A>f&&t.openR||b<0&&t.openB||b>h&&t.openT){const M=o.smass[2*y];o.mat[y]===ut?p+=o.mass[y]-M:d+=o.mass[y]-M,g+=M,x+=o.mass[y]*o.h[y],n!==null&&(n[y]=n[o.count-1]),w[y]=w[o.count-1],r(y),y-=1;continue}const k=1e-4*m;T&&(A<k||A>f-k)&&(o.vx[y]=0),T&&(b<k||b>h-k)&&(o.vy[y]=0),A=Math.min(f-k,Math.max(k,A)),b=Math.min(h-k,Math.max(k,b));const P=a!==null?a(_,F,A,b,l):0;if(P===1){A=l[0],b=l[1];const M=l[2],S=l[3];if(T)o.vx[y]=l[4],o.vy[y]=l[5];else{const C=(o.vx[y]-l[4])*M+(o.vy[y]-l[5])*S;C<0&&(o.vx[y]-=C*M,o.vy[y]-=C*S)}}else if(P===0){let M=t.sdfAt(A,b);if(M<.05*m)for(let S=0;S<3&&M<.05*m;S+=1){const C=.25*m;let L=t.sdfAt(A+C,b)-t.sdfAt(A-C,b),B=t.sdfAt(A,b+C)-t.sdfAt(A,b-C);const I=Math.hypot(L,B);if(I<1e-12)break;L/=I,B/=I;const j=.05*m-M;A+=j*L,b+=j*B;const R=o.vx[y]*L+o.vy[y]*B;T?(o.vx[y]=0,o.vy[y]=0):R<0&&(o.vx[y]-=R*L,o.vy[y]-=R*B),A=Math.min(f-k,Math.max(k,A)),b=Math.min(h-k,Math.max(k,b)),M=t.sdfAt(A,b)}}o.x[y]=A,o.y[y]=b}u.m=p,u.o=d,u.s=g,u.e=x}const yu=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),yc=24,wu=1,bu=1,wc=24,bc=1,he=(o,t)=>(o+2)*(t+2);function Fc(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function Fu(o,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){o[a]+=n*e[a];const c=t[a]-n*s[a];t[a]=c,r+=c*c}return r}function _u(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class St{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(yu(he(s,n),i)),!(s*n<=yc||s<=2&&n<=2);)i=he(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=he(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],c=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:c,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=he(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,diag:u,inv:f,act:h}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let d=1;d<=e;d+=1,p+=1){if(h[p]===0){u[p]=1,f[p]=1;continue}const g=a[p]+c[p]+l[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){h[p]=0,u[p]=1,f[p]=1;continue}u[p]=g,f[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:c,diag:l}=t;for(let u=1;u<=i;u+=1){let f=1+u*r;for(let h=1;h<=n;h+=1,f+=1)s[f]=l[f]*e[f]-a[f]*e[f+1]-a[f-1]*e[f-1]-c[f]*e[f+r]-c[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:c,x:l,b:u}=t;for(let f=1;f<=n;f+=1){let h=1+(1+f+e&1)+f*i;const m=s+f*i;for(;h<=m;h+=2)l[h]=(u[h]+r[h]*l[h+1]+r[h-1]*l[h-1]+a[h]*l[h+i]+a[h-i]*l[h-i])*c[h]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:c}=t;let l=0;for(let u=1;u<=s;u+=1){let f=1+u*n;for(let h=1;h<=e;h+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||a[f]>0)&&(c[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:c,band:l,bandCount:u}=t;for(let f=e>0?0:u-1;e>0?f<u:f>=0;f+=e){const h=l[f];a[h]=(c[h]+n[h]*a[h+1]+n[h-1]*a[h-1]+i[h]*a[h+s]+i[h-s]*a[h-s])*r[h]}}prepareFine(){const t=this.levels[0],e=he(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=yc||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=he(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,c=e.h,l=s.h;for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const h=f+1+(u+1)*s.stride;let m=0,p=0,d=0,g=0;for(let A=0;A<2;A+=1){const b=2*u+A;if(!(b>=e.ny))for(let k=0;k<2;k+=1){const P=2*f+k;if(P>=e.nx)continue;const M=P+1+(b+1)*a;if(e.act[M]===0)continue;const S=e.area[M];m+=S,p+=S*((k-.5)*c+e.ox[M]*c),d+=S*((A-.5)*c+e.oy[M]*c),g+=e.dH[M]}}if(m<=0){s.act[h]=0,s.dH[h]=0,s.dDx[h]=0,s.dDy[h]=0,s.gDx[h]=0,s.gDy[h]=0,s.ox[h]=0,s.oy[h]=0;continue}s.act[h]=1,s.area[h]=m/4;const x=p/m,w=d/m;s.ox[h]=x/l,s.oy[h]=w/l,s.dH[h]=g;let y=0,_=0,F=0,T=0;for(let A=0;A<2;A+=1){const b=2*u+A;if(!(b>=e.ny))for(let k=0;k<2;k+=1){const P=2*f+k;if(P>=e.nx)continue;const M=P+1+(b+1)*a;if(e.act[M]!==0){if(e.gDx[M]>0){const S=(k-.5)*c+e.ox[M]*c;y+=e.gDx[M],_+=e.gDx[M]/(e.eDx[M]+Math.abs(S-x))}if(e.gDy[M]>0){const S=(A-.5)*c+e.oy[M]*c;F+=e.gDy[M],T+=e.gDy[M]/(e.eDy[M]+Math.abs(S-w))}}}}s.gDx[h]=y,s.gDy[h]=F,s.dDx[h]=_,s.dDy[h]=T,s.eDx[h]=_>0?y/_:.5*l,s.eDy[h]=T>0?F/T:.5*l}for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const h=f+1+(u+1)*s.stride;if(s.act[h]!==0){if(f+1<n&&s.act[h+1]!==0){const m=2*f+1;let p=0;if(m+1<e.nx)for(let d=0;d<2;d+=1){const g=2*u+d;g>=e.ny||(p+=e.gx[m+1+(g+1)*a])}if(p>0){const d=l*(1+s.ox[h+1]-s.ox[h]);s.gx[h]=p,s.ax[h]=p/Math.max(.25*l,d)}}if(u+1<i&&s.act[h+s.stride]!==0){const m=2*u+1;let p=0;if(m+1<e.ny)for(let d=0;d<2;d+=1){const g=2*f+d;g>=e.nx||(p+=e.gy[g+1+(m+1)*a])}if(p>0){const d=l*(1+s.oy[h+s.stride]-s.oy[h]);s.gy[h]=p,s.ay[h]=p/Math.max(.25*l,d)}}}}St.diagonal(s),St.findBand(s);for(let u=0;u<e.ny;u+=1){let f=1+(u+1)*a;for(let h=0;h<e.nx;h+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}St.weights(s,h,u,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,c=s>>1,l=(e&1)===1?1:-1,u=(s&1)===1?1:-1,f=t.stride,h=a+1+(c+1)*f;r[0]=h,r[1]=h+l,r[2]=h+u*f,r[3]=h+l+u*f;const m=a+l>=0&&a+l<t.nx,p=c+u>=0&&c+u<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[h]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<wc;m+=1)St.color(e,0),St.color(e,1);for(let m=0;m<wc;m+=1)St.color(e,1),St.color(e,0);return}for(let m=0;m<wu;m+=1)St.color(e,0),St.color(e,1);for(let m=0;m<bc;m+=1)St.bandSweep(e,1);St.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,he(s.nx,s.ny)),s.x.fill(0,0,he(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:c}=e,{pIdx:l,pW:u}=s,f=s.b,h=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=r[p]-a[p],x=4*p;f[l[x]]+=u[x]*g,f[l[x+1]]+=u[x+1]*g,f[l[x+2]]+=u[x+2]*g,f[l[x+3]]+=u[x+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=4*p;c[p]+=u[g]*h[l[g]]+u[g+1]*h[l[g+1]]+u[g+2]*h[l[g+2]]+u[g+3]*h[l[g+3]]}}for(let m=0;m<bc;m+=1)St.bandSweep(e,-1);for(let m=0;m<bu;m+=1)St.color(e,1),St.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,act:u}=t,f=this.nullId,h=he(e,s);let m=!1;for(let p=0;p<h;p+=1)if(u[p]!==0&&!(a[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,h),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let d=1;d<=e;d+=1){const g=d+p*n;if(u[g]===0||f[g]!==-2)continue;let x=0,w=0,y=!1;const _=-3-this.nullCount;this.stack[x++]=g,f[g]=_;let F=g,T=g;for(;x>0;){const b=this.stack[--x];w+=1,b<F&&(F=b),b>T&&(T=b),(a[b]>0||c[b]>0||l[b]>0)&&(y=!0),i[b]>0&&f[b+1]===-2&&(f[b+1]=_,this.stack[x++]=b+1),i[b-1]>0&&f[b-1]===-2&&(f[b-1]=_,this.stack[x++]=b-1),r[b]>0&&f[b+n]===-2&&(f[b+n]=_,this.stack[x++]=b+n),r[b-n]>0&&f[b-n]===-2&&(f[b-n]=_,this.stack[x++]=b-n)}let A=-1;if(!y){if(A=this.nullCount,A>=this.nullSum.length){const b=k=>{const P=new Float64Array(2*k.length);return P.set(k),P};this.nullSum=b(this.nullSum),this.nullCnt=b(this.nullCnt)}this.nullCnt[A]=w,this.nullCount+=1}for(let b=F;b<=T;b+=1)f[b]===_&&(f[b]=A)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=he(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=he(i.nx,i.ny),{act:a}=i,c=this.xs,l=this.bs,u=i.stride;for(let F=0;F<r;F+=1){if(a[F]===0){c[F]=0,l[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||a[F+1]===0)&&(i.ax[F]=0),(F+u>=r||a[F+u]===0)&&(i.ay[F]=0)}St.diagonal(i);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0,l[F]=0);this.findNull(),this.project(l),s&&(St.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,h=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),h.fill(0,0,r),St.apply(i,c,p);let d=0,g=0;for(let F=0;F<r;F+=1){const T=a[F]===0?0:l[F]-p[F];f[F]=T,d+=l[F]*l[F],g+=T*T}this.project(f);const x=Math.sqrt(d);if(x===0)return c.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(g)/x;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,f,h,r);let y=0;for(let F=0;F<r;F+=1)m[F]=h[F],y+=f[F]*h[F];let _=0;for(;_<e;){_+=1,St.apply(i,m,p);const F=Fc(m,p,r);if(!(F>0))break;const T=y/F;if(g=Fu(c,f,m,p,T,r),w=Math.sqrt(g)/x,w<=t)break;this.precondition(s,f,h,r);const A=Fc(f,h,r),b=A/y;y=A,_u(m,h,b,r)}this.project(c);for(let F=0;F<r;F+=1)a[F]===0&&(c[F]=0);return n.iterations=_,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Au=.1,_c=5e-4,Ac=1e-9,Yr=.1;function ui(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function ae(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Tu{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new xu);v(this,"dropletDrift",null);v(this,"bodyHit",null);v(this,"afterSolve",null);v(this,"hit",new Float64Array(6));v(this,"escaped",{m:0,o:0,s:0,e:0});v(this,"velocityAtFn",(t,e,s)=>{Bn(this.g,t,e,s)});v(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;e.updateThin();for(let c=0;c<t.count;c+=1){n[c]=ae(t.x[c]*a-.5,s,0),i[c]=ae(t.y[c]*a-.5,s,3);const l=9*c;for(let u=0;u<3;u+=1)for(let f=0;f<3;f+=1)r[l+f+3*u]=s[f]*s[3+u];e.thinAny&&e.cutWeights(n[c]+1,i[c]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:c,kind:l}=e;for(let u=0;u<t.count;u+=1){const f=9*u,h=s[u],m=n[u];let p=0;for(let d=0;d<9;d+=1){const g=h+d%3,x=m+(d/3|0),y=g>=0&&x>=0&&g<a&&x<c&&l[g+x*a]===rt?i[f+d]:0;r[f+d]=y,p+=y}if(p>0){const d=1/p;for(let g=0;g<9;g+=1)r[f+g]*=d}else{for(let d=0;d<9;d+=1)r[f+d]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:c}=this,{nx:l,ny:u,kind:f}=s,h=1/s.dx;i[t]=ae(e.x[t]*h-.5,n,0),r[t]=ae(e.y[t]*h-.5,n,3);const m=9*t;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1)a[m+g+3*d]=n[g]*n[3+d];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,a,m);let p=0;for(let d=0;d<9;d+=1){const g=i[t]+d%3,x=r[t]+(d/3|0),w=g>=0&&x>=0&&g<l&&x<u&&f[g+x*l]===rt;c[m+d]=w?a[m+d]:0,w&&(p+=a[m+d])}if(p>0)for(let d=0;d<9;d+=1)c[m+d]/=p;else{for(let d=0;d<9;d+=1)c[m+d]=0;c[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:c}=e;c.fill(0);const l=1/e.vCell;let u=0,f=0;for(let h=0;h<t.count;h+=1){const m=t.mass[h]/t.rho[h];u+=t.mass[h],f+=m;const p=9*h,d=s[h],g=n[h];for(let x=0;x<9;x+=1){const w=d+x%3,y=g+(x/3|0);w<0||y<0||w>=r||y>=a||(c[w+y*r]+=i[p+x]*m*l)}}f>0&&(this.rhoRef=u/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=dt;continue}const a=e.phi[r];let c=a>0&&a+e.phiS[r]+e.alpha[r]+e.grain[r]>=.5;if(!c&&t!==null&&t[r]!==U&&t[r]!==dt){const l=r%s,u=(r-l)/s;(l>0?t[r-1]===U&&e.faceOpen(r,0)>0:e.openL)||(l<s-1?t[r+1]===U&&e.faceOpen(r,1)>0:e.openR)||(u>0?t[r-s]===U&&e.faceOpen(r,2)>0:e.openB)||(u<n-1?t[r+s]===U&&e.faceOpen(r,3)>0:e.openT)||(c=!0)}e.kind[r]=c?rt:U,c&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:c}=this,{nx:l,ny:u,dx:f}=e,h=1/f,m=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),c.fill(0);const p=1/this.rhoRef,d=this.viscous;d&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,x=this.etaV;d&&(g.fill(0),x.fill(0));for(let w=0;w<t.count;w+=1){const y=t.x[w],_=t.y[w],F=t.mass[w],T=d?Ln(t.mat[w],t.T[w]):0,A=t.vx[w],b=t.vy[w],k=t.c00[w],P=t.c01[w],M=t.c10[w],S=t.c11[w],C=y*h,L=_*h;let B=ae(C,s,0),I=ae(L-.5,s,3);for(let R=0;R<3;R+=1){const E=I+R,W=(E+.5)*f-_;for(let N=0;N<3;N+=1){const J=B+N,tt=s[N]*s[3+R]*F,q=tt*(A+k*(J*f-y)+P*W);if(J>=0&&J<=l&&E>=0&&E<u){const Q=J+E*m;n[Q]+=tt,i[Q]+=q,d&&(g[Q]+=tt*T)}else this.mirrorU(J,E),n[this.mf]+=tt,i[this.mf]+=this.ms*q,d&&(g[this.mf]+=tt*T)}}B=ae(C-.5,s,0),I=ae(L,s,3);const j=t.rho[w]*p;for(let R=0;R<3;R+=1){const E=I+R,W=E*f-_;for(let N=0;N<3;N+=1){const J=B+N,tt=s[N]*s[3+R]*F,q=tt*(b+M*((J+.5)*f-y)+S*W);let Q,V=1;J>=0&&J<l&&E>=0&&E<=u?Q=J+E*l:(this.mirrorV(J,E),Q=this.mf,V=this.ms),r[Q]+=tt,a[Q]+=V*q,c[Q]+=tt*j,d&&(x[Q]+=tt*T)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?s.openL?r=0:(r=-r,c=-c):r>n&&(s.openR?r=n:(r=2*n-r,c=-c)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=c}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,c=-c):a>i&&(s.openT?a=i:(a=2*i-a,c=-c)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=c}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:c,dx:l,kind:u}=i,f=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:h,pu:m,mv:p,pv:d,rv:g,knownU:x,knownV:w}=this,y=i.ul,_=i.vl,F=this.rhoRef*i.vCell*.25,T=Ac*F,A=this.viscous;for(let j=0;j<i.nu;j+=1)y[j]=h[j]>T?m[j]/h[j]+(A?0:t*this.fU[j]/(this.rhoRef*i.vCell)):0;for(let j=0;j<i.nv;j+=1)_[j]=p[j]>T?d[j]/p[j]+(A?0:-t*e*(g[j]/p[j])+t*this.fV[j]/(this.rhoRef*i.vCell)):0;for(let j=0;j<c;j+=1)for(let R=0;R<=a;R+=1){const E=R+j*f,W=R>0?u[R-1+j*a]:-1,N=R<a?u[R+j*a]:-1,J=R===0&&!i.openL,tt=R===a&&!i.openR;if(J||tt||W===dt||N===dt||i.au[E]<=0){y[E]=J||tt?0:i.usol[E],x[E]=2;continue}x[E]=W===rt||N===rt?1:0}for(let j=0;j<=c;j+=1)for(let R=0;R<a;R+=1){const E=R+j*a,W=j>0?u[R+(j-1)*a]:-1,N=j<c?u[R+j*a]:-1,J=j===0&&!i.openB,tt=j===c&&!i.openT;if(J||tt||W===dt||N===dt||i.av[E]<=0){_[E]=J||tt?0:i.vsol[E],w[E]=2;continue}w[E]=W===rt||N===rt?1:0}if(this.last.viscIterations=0,A){this.viscosity(t);const j=t/(this.rhoRef*i.vCell);for(let R=0;R<i.nu;R+=1)x[R]!==2&&h[R]>T&&(y[R]+=j*this.fU[R]);for(let R=0;R<i.nv;R+=1)w[R]!==2&&p[R]>T&&(_[R]+=-t*e*(g[R]/p[R])+j*this.fV[R])}let b=a,k=-1,P=c,M=-1,S=0;for(let j=0;j<c;j+=1)for(let R=0;R<a;R+=1)u[R+j*a]===rt&&(S+=1,R<b&&(b=R),R>k&&(k=R),j<P&&(P=j),j>M&&(M=j));const C=this.last.solve;if(C.iterations=0,C.residual=0,C.capped=!1,S>0){const j=k-b+1,R=M-P+1,E=this.solver,W=E.begin(j,R),N=t/this.rhoRef,J=1/i.vCell,tt=this.pGas;for(let V=P;V<=M;V+=1)for(let G=b;G<=k;G+=1){const st=G+V*a;if(u[st]!==rt)continue;const vt=E.at(G-b,V-P);W.act[vt]=1,W.x[vt]=i.pl[st];const yt=G+V*f,D=G+V*a,H=x[yt+1]===2?0:i.au[yt+1],X=x[yt]===2?0:i.au[yt],O=w[D+a]===2?0:i.av[D+a],K=w[D]===2?0:i.av[D],z=ui(y,i.usol,yt+1,H,x)-ui(y,i.usol,yt,X,x)+ui(_,i.vsol,D+a,O,w)-ui(_,i.vsol,D,K,w),ht=i.phi[st]+i.phiS[st]+i.alpha[st]+i.grain[st];let ot=this.volSrc[st]*J;const bt=this.gasAt(G-1,V)||this.gasAt(G+1,V)||this.gasAt(G,V-1)||this.gasAt(G,V+1),Mt=ht-1;(Mt>0||!bt)&&(ot+=Au*Mt/Math.max(t,_c));let xt=ot*l*l-l*z;if(G+1<a){const qt=u[st+1];if(qt===rt)G+1<=k&&H>0&&(W.ax[vt]=H<1?N*H:N);else if(qt===U&&H>0){const _t=(H<1?N*H:N)/this.theta(st,st+1);W.dDx[vt]+=_t,xt+=_t*tt[st+1]}}else i.openR&&H>0&&(W.dDx[vt]+=H<1?2*N*H:2*N);if(G>0){if(u[st-1]===U&&X>0){const _t=(X<1?N*X:N)/this.theta(st,st-1);W.dDx[vt]+=_t,xt+=_t*tt[st-1]}}else i.openL&&X>0&&(W.dDx[vt]+=X<1?2*N*X:2*N);if(V+1<c){const qt=u[st+a];if(qt===rt)V+1<=M&&O>0&&(W.ay[vt]=O<1?N*O:N);else if(qt===U&&O>0){const _t=(O<1?N*O:N)/this.theta(st,st+a);W.dDy[vt]+=_t,xt+=_t*tt[st+a]}}else i.openT&&O>0&&(W.dDy[vt]+=O<1?2*N*O:2*N);if(V>0){if(u[st-a]===U&&K>0){const _t=(K<1?N*K:N)/this.theta(st,st-a);W.dDy[vt]+=_t,xt+=_t*tt[st-a]}}else i.openB&&K>0&&(W.dDy[vt]+=K<1?2*N*K:2*N);W.b[vt]=xt}const q=E.solve(s,n,!0);C.iterations=q.iterations,C.residual=q.residual,C.capped=q.capped;const Q=i.pl;for(let V=0;V<i.n;V+=1)Q[V]=u[V]===U?tt[V]:0;for(let V=P;V<=M;V+=1)for(let G=b;G<=k;G+=1){const st=G+V*a;u[st]===rt&&(Q[st]=W.x[E.at(G-b,V-P)])}for(let V=0;V<c;V+=1)for(let G=0;G<=a;G+=1){const st=G+V*f;if(x[st]===1){if(G===0){y[st]-=N/l*2*(Q[V*a]-0);continue}if(G===a){y[st]-=N/l*2*(0-Q[a-1+V*a]);continue}y[st]-=N/l*this.across(G-1+V*a,G+V*a)}}for(let V=0;V<=c;V+=1)for(let G=0;G<a;G+=1){const st=G+V*a;if(w[st]===1){if(V===0){_[st]-=N/l*2*(Q[G]-0);continue}if(V===c){_[st]-=N/l*2*(0-Q[G+(c-1)*a]);continue}_[st]-=N/l*this.across(G+(V-1)*a,G+V*a)}}this.afterSolve!==null&&this.afterSolve(E,b,P,t)}this.extrapolate();const L=this.markStranded(),B=this.g2p(L?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const I=this.last;return I.cells=S,I.uMax=B,I.escapedMass=this.escM,I.escapedOther=this.escO,I.escapedSalt=this.escS,I.escapedEnergy=this.escE,I}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t]+s.grain[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e]+s.grain[e];return!(n>.5)||!(n>i)?Yr:Math.max(Yr,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===U&&n[e]===rt?i/this.theta(e,t):n[e]===U&&n[t]===rt?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new St(e.nx+1,e.ny+1));const s=Ac*this.rhoRef*e.vCell*.25;this.last.viscIterations=gu(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===U}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:c}=this,{nx:l,ny:u}=s,f=1/Math.max(t,_c);for(let h=0;h<e.count;h+=1){const m=a[h];if(m===0)continue;const p=9*h,d=n[h],g=i[h];for(let x=0;x<9;x+=1){const w=d+x%3,y=g+(x/3|0);w<0||y<0||w>=l||y>=u||(c[w+y*l]+=r[p+x]*m*f)}}}extrapolate(){nu(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:c,dx:l}=n,u=1/l,f=a+1,h=n.ul,m=n.vl,p=4/(l*l);let d=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const L=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];L>d&&(d=L);continue}const x=s.x[g],w=s.y[g],y=x*u,_=w*u;let F=ae(y,i,0),T=ae(_-.5,i,3),A=0,b=0,k=0;for(let L=0;L<3;L+=1){const B=T+L,I=(B+.5)*l-w;for(let j=0;j<3;j+=1){const R=F+j,E=i[j]*i[3+L];let W;R>=0&&R<=a&&B>=0&&B<c?W=h[R+B*f]:(this.mirrorU(R,B),W=this.ms*h[this.mf]),A+=E*W,b+=E*W*(R*l-x),k+=E*W*I}}F=ae(y-.5,i,0),T=ae(_,i,3);let P=0,M=0,S=0;for(let L=0;L<3;L+=1){const B=T+L,I=B*l-w;for(let j=0;j<3;j+=1){const R=F+j,E=i[j]*i[3+L];let W;R>=0&&R<a&&B>=0&&B<=c?W=m[R+B*a]:(this.mirrorV(R,B),W=this.ms*m[this.mf]),P+=E*W,M+=E*W*((R+.5)*l-x),S+=E*W*I}}s.vx[g]=A,s.vy[g]=P,s.c00[g]=p*b,s.c01[g]=p*k,s.c10[g]=p*M,s.c11[g]=p*S;const C=A*A+P*P;C>d&&(d=C)}return Math.sqrt(d)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),iu(this.P,this.g,this.stranded)}velocityAt(t,e,s){Bn(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;vu(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class ku{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?Wn:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=pf(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Ji(r,i);return}const s=this.mat[t],n=Wl(s,this.h[t]);this.T[t]=n,this.rho[t]=Fs(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==ut)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?mf(this.T[t],e/this.mass[t]):xo(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function Pu(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:c}=o,{nx:l,ny:u,n:f,kind:h}=s,{Tl:m}=t,p=t.rd;let d=!1;for(let y=0;y<f;y+=1){if(p[y]=0,h[y]===U&&t.Cl[y]>0){const k=t.boilingAt(y,r.pAt(y));m[y]>k&&(p[y]=k,d=!0);continue}if(h[y]!==rt)continue;const _=y%l,F=(y-_)/l,T=F+1<u?y+l:-1;if(!(T>=0&&h[T]===U&&s.faceOpen(y,3)>0||_>0&&h[y-1]===U&&s.faceOpen(y,0)>0||_<l-1&&h[y+1]===U&&s.faceOpen(y,1)>0||F>0&&h[y-l]===U&&s.faceOpen(y,2)>0))continue;const b=t.boilingAt(y,r.pAt(y));m[y]>b&&(p[y]=b,d=!0)}if(!d)return;const g=t.mtot;g.fill(0);const x=t.Y0;x.fill(0);const w=i.rhoRef*s.vCell/4;for(let y=0;y<n.count;y+=1){if(n.mat[y]!==ut)continue;const _=n.smass[2*y],F=_>0?_/n.mass[y]:0,T=9*y;let A=0,b=0,k=-1,P=0;for(let C=0;C<2;C+=1){for(let L=0;L<9;L+=1){const B=i.wt[T+L];if(B===0)continue;const I=i.bi[y]+L%3,j=i.bj[y]+(L/3|0);if(I<0||j<0||I>=l||j>=u)continue;const R=I+j*l,E=p[R];if(E===0)continue;const W=_>0?Va(E,F):At(E);if(n.h[y]<=W)continue;const N=pt(E),J=B*n.mass[y]*(n.h[y]-W)/(N-(_>0?zs(E,F):W));C===0?(A+=J,b+=J*N,B>P&&(P=B,k=R)):(g[R]+=J,x[R]+=J*N)}if(A===0)break;if(C===0&&n.mass[y]-_-A<Zr*w){const L=p[k],B=n.mass[y]-_,I=pt(L),j=_>0?_*zn(L):0;g[k]+=B,x[k]+=B*I,_>0&&o.salt.deposit(n.x[y],n.y[y],_,j),c.src[k]-=(B*I+j-n.mass[y]*n.h[y])/e,A=-1;break}}if(A===0)continue;if(A<0){i.removeParticle(y),y-=1;continue}const M=n.mass[y]/n.rho[y],S=n.mass[y]-A;n.h[y]=(n.mass[y]*n.h[y]-b)/S,n.mass[y]=S,n.derive(y),i.dVp[y]+=S/n.rho[y]-M}for(let y=0;y<f;y+=1){if(g[y]===0)continue;const _=y%l,F=(y-_)/l;let T=0;const A=h[y]===U?y:F+1<u&&h[y+l]===U&&s.faceOpen(y,3)>0?y+l:-1;if(A>=0)s.mg[Z*f+A]+=g[y],s.Hg[A]+=x[y],a.deriveCell(A);else{const b=t.side;b[0]=_>0&&h[y-1]===U&&s.faceOpen(y,0)>0?y-1:-1,b[1]=_<l-1&&h[y+1]===U&&s.faceOpen(y,1)>0?y+1:-1,b[2]=F>0&&h[y-l]===U&&s.faceOpen(y,2)>0?y-l:-1,b[3]=-1;for(let k=0;k<3;k+=1)b[k]>=0&&(T+=1);for(let k=0;k<3;k+=1)b[k]<0||(s.mg[Z*f+b[k]]+=g[y]/T,s.Hg[b[k]]+=x[y]/T,a.deriveCell(b[k]))}t.produced+=g[y]}}function Mu(o,t,e,s,n){const i=o.grid,r=i.n,a=i.mg[at*r+t],c=i.mg[ft*r+t],l=i.Hg[t];if(s<=0)return ga(a,c,e,l);let u=n;for(let f=0;f<6;f+=1){const h=a*re(at,u)+c*re(ft,u)+e*pt(u)+s*At(u),m=(l-h)/Nr(a,c,e,s,u);if(u+=m,Math.abs(m)<1e-10)break}return u}function xn(o,t,e,s,n,i){const r=o.grid,a=r.n,c=r.mg[Z*a+t]-e,l=r.mfog[t]+e,u=Mu(o,t,c,l,i),f=c/gt[Z];return(f+s>0?f/(f+s)*n:0)-Cn(u)}function xr(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[Z*r+e],s));n.mg[Z*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function Su(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==U)continue;const r=e.mg[Z*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const c=e.mg[at*n+i]/gt[at]+e.mg[ft*n+i]/gt[ft],l=s.pAt(i),u=e.T[i];if(a<=0){const w=r/gt[Z];if(w/(w+c)*l<.999*Cn(u))continue}const f=xn(o,i,0,c,l,u);if(f<=0&&a<=0)continue;let h,m,p,d;if(f>0)h=0,p=f,m=r,d=xn(o,i,m,c,l,u);else if(m=0,d=f,h=-a,p=xn(o,i,h,c,l,u),p<=0){xr(o,t,i,h);continue}if(d>0){xr(o,t,i,m);continue}let g=h,x=0;for(let w=0;w<40;w+=1){g=(h*d-m*p)/(d-p),(!Number.isFinite(g)||g<=Math.min(h,m)||g>=Math.max(h,m))&&(g=.5*(h+m));const y=xn(o,i,g,c,l,u);if(Math.abs(y)<=1e-13*l)break;y>0?(h=g,p=y,x===1&&(d/=2),x=1):(m=g,d=y,x===-1&&(p/=2),x=-1)}if(xr(o,t,i,g),f<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=xn(o,i,0,c,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/Cn(e.T[i]))}}}const Zr=.001;class Lu{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*te.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*Cn(t)/e),c=i.mg[at*r+s],l=i.mg[ft*r+s],u=c+l,f=u>0?u/(c/gt[at]+l/gt[ft]):.02885;return a*gt[Z]/(a*gt[Z]+(1-a)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:c,acc:l,accH:u,accAll:f,accS:h}=this;c.fill(0),a.fill(0),l.fill(0),u.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const x=e.mass[g],w=e.mat[g],y=x*e.cp(g),_=e.smass[2*g],F=x-_,T=_>0?zs(e.T[g],_/x):e.h[g];_>0&&!p&&(p=!0,h.fill(0)),w!==ut&&!m&&(m=!0,f.fill(0),this.accMat.fill(0));const A=9*g;for(let b=0;b<9;b+=1){const k=s.wt[A+b];if(k===0)continue;const P=s.bi[g]+b%3,M=s.bj[g]+(b/3|0);if(P<0||M<0||P>=n||M>=i)continue;const S=P+M*n;c[S]+=k*y,a[S]+=k*y*e.T[g],w===ut&&(l[S]+=k*F,u[S]+=k*F*T),p&&(h[S]+=k*_),m&&(this.accMat[w*r+S]+=k*x)}}for(let g=0;g<r;g+=1)a[g]=c[g]>0?a[g]/c[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const x=h[g]>0&&l[g]>0?h[g]/(l[g]*Je):0;this.mol[g]=x,this.aw[g]=x>0?Ia(a[g],x):1}if(!m){f.set(l),this.host.fill(ut);return}const d=te.length;for(let g=0;g<r;g+=1){this.accMat[ut*r+g]=p?l[g]+h[g]:l[g];let x=0,w=ut,y=-1;for(let _=0;_<d;_+=1){const F=this.accMat[_*r+g];x+=F,F>y&&(y=F,w=_)}f[g]=x,this.host[g]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?Ba(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:At(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?ut:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:c,dm:l}=this;l.fill(0,0,n.count);for(let f=0;f<n.count;f+=1){if(n.mat[f]!==ut)continue;const h=9*f;let m=0;for(let p=0;p<9;p+=1){const d=i.wt[h+p];if(d===0)continue;const g=i.bi[f]+p%3,x=i.bj[f]+(p/3|0);if(g<0||x<0||g>=r||x>=a)continue;const w=g+x*r;t[w]!==0&&c[w]>0&&(m+=t[w]*d*(n.mass[f]-n.smass[2*f])/c[w])}l[f]=m}const u=i.rhoRef*s.vCell/4;for(let f=n.count-1;f>=0;f-=1){const h=l[f];if(h===0)continue;if(n.smass[2*f]>0){this.applySalty(f,h,u,e);continue}const m=n.mass[f]/n.rho[f],p=n.mass[f]+h;if(p<Zr*u){this.track(f,-n.mass[f]),this.vanish(f,Math.max(0,p),e);continue}this.track(f,h),n.mass[f]=p,i.dVp[f]+=p/n.rho[f]-m}for(let f=0;f<s.n;f+=1){if(t[f]<=0||c[f]>0)continue;const h=f%r,m=(f-h)/r,p=n.add((h+.5)*s.dx,(m+.5)*s.dx,t[f],this.waterH(f),ut);p<0||(i.placeParticle(p),i.dVp[p]=t[f]/n.rho[p],this.track(p,t[f]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,c=9*t,l=xo(n.mat[t],n.T[t]);for(let u=0;u<9;u+=1){const f=i.wt[c+u];if(f===0)continue;const h=i.bi[t]+u%3,m=i.bj[t]+(u/3|0);if(h<0||m<0||h>=r||m>=a)continue;const p=h+m*r;this.acc[p]+=f*e,this.accH[p]+=f*e*n.h[t],this.accAll[p]+=f*e,this.Cl[p]+=f*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],c=i.mass[t],l=c-a,u=zs(i.T[t],a/c),f=i.cp(t),h=c*i.h[t]+e*u,m=l+e;if(m<Zr*s){this.trackSalty(t,-l,-l*u,-c,-a,-c*f),this.dryUp(t,Math.max(0,m),h,n);return}const p=c/i.rho[t];i.mass[t]=c+e,i.h[t]=h/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const d=zs(i.T[t],a/i.mass[t]);this.trackSalty(t,e,m*d-l*u,e,0,i.mass[t]*i.cp(t)-c*f)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:c}=this.e,{nx:l,ny:u}=a,f=9*t;for(let h=0;h<9;h+=1){const m=c.wt[f+h];if(m===0)continue;const p=c.bi[t]+h%3,d=c.bj[t]+(h/3|0);if(p<0||d<0||p>=l||d>=u)continue;const g=p+d*l;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:c,gas:l}=this.e,u=r.T[t],f=r.smass[2*t],h=f*zn(u);this.e.salt.deposit(r.x[t],r.y[t],f,h);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==U;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[Z*i.n+p]+=e,i.Hg[p]+=e*pt(u),this.produced+=e,l.deriveCell(p)),c.src[m]-=(e*pt(u)+h-s)/n;else if(m>=0){for(let d=0;d<r.count;d+=1)if(d!==t&&r.mat[d]===r.mat[t]&&i.cellAt(r.x[d],r.y[d])===m){const g=r.mass[d]*r.h[d]+(s-h);r.mass[d]+=e,r.h[d]=g/r.mass[d],r.derive(d);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:c}=this.e,l=n.cellAt(i.x[t],i.y[t]);let u=l;for(;u>=0&&n.kind[u]!==U;)u=u+n.nx<n.n?u+n.nx:-1;if(e>0&&u>=0&&l>=0){const f=i.T[t];n.mg[Z*n.n+u]+=e,n.Hg[u]+=e*pt(f),a.src[l]-=e*(pt(f)-i.h[t])/s,this.produced+=e,c.deriveCell(u)}else if(e>0&&l>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===l){const h=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=h/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),Pu(this.e,this,t),Su(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:c,ny:l,n:u,depth:f,kind:h}=s,{mtot:m,rd:p,Y0:d,Tl:g,Fm:x,Fe:w,edge:y,hvC:_,hnC:F,hoC:T}=this;let A=!1;for(let L=0;L<u;L+=1){if(h[L]!==U){m[L]=0;continue}const B=s.mg[L]+s.mg[u+L]+s.mg[Z*u+L];m[L]=B,d[L]=B>0?s.mg[Z*u+L]/B:0;const I=s.T[L];p[L]=n.rho[L]*Ul(I,i.pAt(L)),_[L]=pt(I),F[L]=re(at,I),T[L]=re(ft,I),A=!0}if(!A)return;for(let L=0;L<l;L+=1)for(let B=0;B<c;B+=1){const I=B+L*c;y[I]=h[I]===U&&(B===0||L===0||B===c-1||L===l-1||h[I-1]!==U||h[I+1]!==U||h[I-c]!==U||h[I+c]!==U)?1:0}const b=a.begin(c,l),k=b.stride,P=e.ambientY[Z],{bG:M,bY:S}=this;for(let L=0;L<l;L+=1)for(let B=0;B<c;B+=1){const I=B+L*c;if(h[I]!==U||m[I]<=0)continue;const j=B+1+(L+1)*k;b.act[j]=1,b.x[j]=d[I],b.dH[j]=m[I]/t;let R=m[I]*d[I]/t;const E=s.au[B+1+L*(c+1)],W=s.av[I+c];if(B+1<c&&h[I+1]===U&&m[I+1]>0&&E>0&&(b.ax[j]=E*.5*(p[I]+p[I+1])*f),L+1<l&&h[I+c]===U&&m[I+c]>0&&W>0&&(b.ay[j]=W*.5*(p[I]+p[I+c])*f),y[I]===0){b.b[j]=R;continue}let N=0;for(let J=0;J<4;J+=1){const tt=this.boundary(I,B,L,J,P);M[4*I+J]=tt,S[4*I+J]=this.yb,!(tt<=0)&&(N+=tt,R+=tt*this.yb)}b.dDx[j]=N,b.b[j]=R}a.solve(1e-9,200,!1),x.fill(0),w.fill(0);const C=b.x;for(let L=0;L<l;L+=1)for(let B=0;B<c;B+=1){const I=B+L*c;if(h[I]!==U||m[I]<=0)continue;const j=B+1+(L+1)*k,R=C[j],E=s.au[B+1+L*(c+1)],W=s.av[I+c];if(B+1<c&&h[I+1]===U&&m[I+1]>0&&E>0&&this.exchange(I,I+1,t*E*.5*(p[I]+p[I+1])*f*(R-C[j+1])),L+1<l&&h[I+c]===U&&m[I+c]>0&&W>0&&this.exchange(I,I+c,t*W*.5*(p[I]+p[I+c])*f*(R-C[j+k])),y[I]!==0)for(let N=0;N<4;N+=1){const J=M[4*I+N];if(J<=0)continue;const tt=t*J*(S[4*I+N]-R),Q=(N===0?B===0:N===1?B===c-1:N===2?L===0:L===l-1)?-1:N===0?I-1:N===1?I+1:N===2?I-c:I+c;if(Q<0)this.ambientExchange(I,tt);else if(h[Q]===rt)if(tt>0){const V=g[Q];s.mg[Z*u+I]+=tt,s.Hg[I]+=tt*pt(V),x[Q]-=tt,w[Q]-=tt*pt(V),this.produced+=tt}else{const V=Math.min(-tt,s.mg[Z*u+I]);s.mg[Z*u+I]-=V,s.Hg[I]-=V*pt(s.T[I]),x[Q]+=V,w[Q]+=V*pt(s.T[I]),this.condensed+=V}else if(h[Q]===dt){const V=s.T[Q];if(tt<0){const G=Math.min(-tt,s.mg[Z*u+I]);s.mg[Z*u+I]-=G,s.Hg[I]-=G*pt(s.T[I]),s.film[Q]+=G,s.Es[Q]+=G*At(V),r.src[Q]+=G*(pt(s.T[I])-At(V))/t,this.dew+=G}else{const G=Math.min(tt,s.film[Q]);s.film[Q]-=G,s.Es[Q]-=G*At(V),s.mg[Z*u+I]+=G,s.Hg[I]+=G*pt(V),r.src[Q]-=G*(pt(V)-At(V))/t,this.dew-=G}}}}for(let L=0;L<u;L+=1)x[L]!==0&&(r.src[L]+=(w[L]-x[L]*this.waterH(L))/t);this.applyMass(x,t);for(let L=0;L<u;L+=1)h[L]===U&&m[L]>0&&n.deriveCell(L)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:c,depth:l,kind:u}=r,f=n===0?e===0:n===1?e===a-1:n===2?s===0:s===c-1,h=2*this.rd[t]*l;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,h):0;const m=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=m;const p=u[m],d=this.Y0[t],g=this.e.regions.pAt(t);if(p===rt){const x=r.faceOpen(t,n);if(!(x>0))return 0;const w=this.waterShare(m);return w<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),x*h*(1-d)*w)}if(p===dt){const x=this.ysat(r.T[m],g,t);return d>x||r.film[m]>0&&d<x?(this.yb=x,h*(1-d)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let c=Math.abs(s);c=Math.min(c,n.mg[Z*i+r]);const l=n.mg[at*i+a],u=n.mg[ft*i+a],f=l+u,h=Math.min(c,f);if(c<=0)return;const m=this.hvC[r];if(n.mg[Z*i+r]-=c,n.mg[Z*i+a]+=c,n.Hg[r]-=c*m,n.Hg[a]+=c*m,h>0){const p=h*l/f,d=h-p;n.mg[at*i+a]-=p,n.mg[ft*i+a]-=d,n.mg[at*i+r]+=p,n.mg[ft*i+r]+=d;const g=p*this.hnC[a]+d*this.hoC[a];n.Hg[a]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[at*i+t]+n.mg[ft*i+t],c=Math.min(e,a);if(n.mg[Z*i+t]+=e,n.Hg[t]+=e*pt(r),c>0){const l=c*n.mg[at*i+t]/a,u=c-l;n.mg[at*i+t]-=l,n.mg[ft*i+t]-=u;const f=l*re(at,n.T[t])+u*re(ft,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=c,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*pt(r)}else if(e<0){const a=Math.min(-e,n.mg[Z*i+t]),c=s.ambientY[at],l=s.ambientY[ft],u=c+l>0?c+l:1;n.mg[Z*i+t]-=a,n.Hg[t]-=a*pt(n.T[t]);const f=a*c/u,h=a-f;n.mg[at*i+t]+=f,n.mg[ft*i+t]+=h;const m=f*re(at,r)+h*re(ft,r);n.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*pt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,c=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<c)continue;const u=l%n,f=(l-u)/n,m=[u>0?l-1:-1,u<n-1?l+1:-1,f+1<i?l+n:-1,f>0?l-n:-1].find(_=>_>=0&&a[_]===U);if(m===void 0)continue;const p=m%n,d=(m-p)/n,g=(p+.5+.25*Math.sign(u-p))*t.dx,x=(d+.5+.25*Math.sign(f-d))*t.dx,w=t.T[l],y=e.add(g,x,c,At(w),ut);y<0||(t.film[l]-=c,t.Es[l]-=c*At(w),s.placeParticle(y),s.dVp[y]=c/e.rho[y])}}}function nl(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(te.length);let r=0,a=0,c=0;for(let l=0;l<e.count;l+=1)for(let u=0;u<9;u+=1){const f=s.wt[9*l+u];if(f===0)continue;const h=s.bi[l]+u%3,m=s.bj[l]+(u/3|0);if(h<0||m<0||h>=n.nx||m>=n.ny||h+m*n.nx!==t)continue;i[e.mat[l]]+=f*e.mass[l],r+=f*e.mass[l];const p=e.smass[2*l];p>0?(a+=f*p,c+=f*(e.mass[l]-p)):e.mat[l]===0&&(c+=f*e.mass[l])}return{m:i,all:r,salt:a,water:c}}function Cu(o,t){const{m:e,all:s}=nl(o,t);if(s<=0)return[];const n=[];for(let i=0;i<te.length;i+=1)e[i]>0&&n.push({id:te[i].id,share:e[i]/s});return n}function Ou(o,t,e){var P;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===dt?"solid":s.kind[n]===rt?"liquid":"gas",a=o.pressureAt(n);let c=0;const l=[0,0,0];for(let M=0;M<Ft;M+=1)l[M]=s.mg[M*i+n]/gt[M],c+=l[M];for(let M=0;M<Ft;M+=1)l[M]=c>0?l[M]/c:0;const u=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?l[Z]*a:0,h=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[h+m*(s.nx+1)]+s.ul[h+1+m*(s.nx+1)]):.5*(s.ug[h+m*(s.nx+1)]+s.ug[h+1+m*(s.nx+1)]),d=r==="liquid"?.5*(s.vl[h+m*s.nx]+s.vl[h+(m+1)*s.nx]):.5*(s.vg[h+m*s.nx]+s.vg[h+(m+1)*s.nx]),g=o.particles;let x=-1,w=(1.5*s.dx)**2;for(let M=0;M<g.count;M+=1){const S=(g.x[M]-t)**2+(g.y[M]-e)**2;S<w&&(w=S,x=M)}const y=o.bubbles;let _=-1,F=1/0;for(let M=0;M<y.count;M+=1){const S=Math.hypot(y.x[M]-t,y.y[M]-e);S<=Math.max(y.r[M],3*s.dx)&&S<F&&(_=M,F=S)}const T=nl(o,n),A=[];if(T.all>0)for(let M=0;M<te.length;M+=1)T.m[M]>0&&A.push({id:te[M].id,share:T.m[M]/T.all});let b=null;if(r==="liquid"&&T.salt>0&&T.water>0){const M=T.salt/(T.water*Je);b={w:T.salt/(T.salt+T.water),molality:M,Tb:Ba(a,M),Tf:Ra(M)}}const k=r==="gas"?o.gas.rho[n]:r==="liquid"?b!==null&&!o.phase.mixed?Ji(u,b.w):o.phase.mixed?Fs(o.phase.host[n],u):o.liquid.rhoRef:s.solid[n]!==0?mt[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?mt[s.solid[n]-1].id:null,T:u,p:a,Tsat:kt(a),x:l,rh:r==="gas"?f/Qi(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:k,phi:s.phi[n],u:p,v:d,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:A,salt:b},particle:x<0?null:{id:g.id[x],T:g.T[x],vx:g.vx[x],vy:g.vy[x],mass:g.mass[x],rho:g.rho[x],dist:Math.sqrt(w),liquid:((P=te[g.mat[x]])==null?void 0:P.id)??te[0].id,salt:g.saltFraction(x)},bubble:_<0?null:o.bubbleModel.describe(_),body:qu(o,t,e)}}function qu(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&nn(n)?n.id:"",material:mt[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}class ju{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,a=e+1;this.id.fill(-1);let c=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(c);let u=0,f=0,h=0;for(this.stack[u++]=l,this.id[l]=c;u>0;){const m=this.stack[--u];h+=1-t.fs[m];const p=m%e,d=(m-p)/e,g=p+d*a,x=p+d*e;(p===0&&t.openL&&i[g]>0||p===e-1&&t.openR&&i[g+1]>0||d===0&&t.openB&&r[x]>0||d===s-1&&t.openT&&r[x+e]>0)&&(f=1),p>0&&n[m-1]===0&&this.id[m-1]===-1&&i[g]>0&&(this.id[m-1]=c,this.stack[u++]=m-1),p<e-1&&n[m+1]===0&&this.id[m+1]===-1&&i[g+1]>0&&(this.id[m+1]=c,this.stack[u++]=m+1),d>0&&n[m-e]===0&&this.id[m-e]===-1&&r[x]>0&&(this.id[m-e]=c,this.stack[u++]=m-e),d<s-1&&n[m+e]===0&&this.id[m+e]===-1&&r[x+e]>0&&(this.id[m+e]=c,this.stack[u++]=m+e)}this.open[c]=f,this.vFluid[c]=h*t.vCell,c+=1}this.count=c}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<Ft;a+=1){const c=s.mg[a*n+i];this.mSum[r]+=c,this.nSum[r]+=c/gt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let c=0;c<s;c+=1){if(this.id[c]!==t||e.kind[c]===dt)continue;let l=0;for(let u=0;u<Ft;u+=1)l+=e.mg[u*s+c]/gt[u];n+=l*Et*e.T[c]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let c=0;c<2;c+=1){let l=-i,u=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===dt)continue;let h=0;for(let d=0;d<Ft;d+=1)h+=e.mg[d*s+f]/gt[d];const m=r-a*(e.dx*((f-f%e.nx)/e.nx+.5)),p=h*Et*e.T[f];l+=p/m,u-=p/(m*m)}r-=l/u}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===U)return s;return-1}}class Iu{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:c}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),u=Math.min(c-1,Math.max(0,Math.floor(e/r.dx))),f=l+u*a,h=i.heat;if(h.hasSolid(f)){this.toSolid(f,s,n);return}const m=[u>0?f-a:-1,l>0?f-1:-1,l<a-1?f+1:-1,u<c-1?f+a:-1];for(const p of m)if(p>=0&&h.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=u-2;p>=0;p-=1){const d=l+p*a;if(h.hasSolid(d)){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=Ea(r);if(n<=a*i*(1+1e-9))continue;const c=(n-a*i)/(1-a),l=c*zn(r),u=i/t.rho[s],f=i*t.h[s]-l;t.mass[s]=i-c,t.smass[2*s]=n-c,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-u,this.e.grainSalt.grow(t.x[s],t.y[s],c,l)||this.deposit(t.x[s],t.y[s],c,l),this.crystallized+=c}}}const Bu=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],ps=Bu.length,Tc=1/120;class Ru{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"grains");v(this,"grainFlow");v(this,"grainSalt");v(this,"exchange");v(this,"bodies");v(this,"melt");v(this,"solver");v(this,"extremes",new F0(this));v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",Tc);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(lt));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",oc());v(this,"snap",P0());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(ps));v(this,"stamp",new Float64Array(ps+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);v(this,"building",!1);this.options=e;const s=kc(t)?t:gr(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Tc}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=R0[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>D0;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new du(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new ku(Math.max(4096,4*i.n+1024)),this.bubbles=new f0(4096),this.solver=new St(s,n),this.regions=new ju(i),this.liquid=new Tu(i,this.particles,this.solver),this.gas=new su(i,this.regions,this.solver),this.heat=new pu(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new w0(this),this.phase=new Lu(this),this.salt=new Iu(this),this.grains=new L0(Math.max(1024,4*i.n)),this.grainFlow=new fu(this),this.grainSalt=new hu(this),this.exchange=new Z0(this),this.bodies=new Qf(this),this.heat.bodies=this.bodies.list,this.heat.grains=this.grains,this.melt=new l0(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,a,c,l,u)=>this.bodies.hitPoint(r,a,c,l,u),this.liquid.afterSolve=(r,a,c,l)=>this.bodies.probe(r,a,c,l),this.prevKind=new Uint8Array(i.n),this.rng=new Ka(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=oc(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=U,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),this.grainFlow.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,c=(i>0?i:Hl)/a,l=(r>0||i>0?r:Gl)/a,u=1/(c/gt[at]+l/gt[ft]),f=Math.min(.99,s*Qi(e)/t),h=f*gt[Z]/(f*gt[Z]+(1-f)*u);this.ambientY.fill(0),this.ambientY[at]=(1-h)*c,this.ambientY[ft]=(1-h)*l,this.ambientY[Z]=h;let m=0;for(let p=0;p<Ft;p+=1)m+=this.ambientY[p]/gt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(Et*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,grains:this.grains,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>Ri(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=nn(t)&&(t.id===""||Ri(this,t.id)>=0)?{...t,id:sl(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!J0(this,e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=I0(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),c=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&c!==void 0&&c.op==="hotplate"){const l=[...this.scene.ops];l[a]={...c,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return H0({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=kc(t)?t:gr(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=gr(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,c=this.dt,l=this.stamp;l[0]=_e();const u=n.pvTerm();this.bodies.prepare()&&(n.update(r,a),this.flows.bodyWork+=n.pvTerm()-u),l[1]=_e(),this.grainFlow.splatVolume(),e.splatVolumeChange(c),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===U?n.pAt(d)-this.pRef:0;e.step(c,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,this.grainFlow.step(c),l[2]=_e(),s.updateVolumes(),s.markFaces();const f=s.escaped[Z]+s.escaped[Ft],h=s.escaped[at]+s.escaped[ft],m=s.escaped[Ft+1];s.transport(c),this.flows.escapedWater+=s.escaped[Z]+s.escaped[Ft]-f,this.flows.escapedAir+=s.escaped[at]+s.escaped[ft]-h,this.flows.escapedEnergy+=s.escaped[Ft+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(c,this.gy),s.sources(c),s.project(c,this.tol,this.maxIter),l[3]=_e(),this.bubbleModel.step(c),l[4]=_e(),this.phase.step(c),this.salt.step(),this.grainSalt.step(c),l[5]=_e(),i.step(c,1e-6,200),this.exchange.step(c),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=_e(),l[7]=_e(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===U?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=c,this.steps+=1,l[8]=_e(),this.bodies.finish(c),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit(),this.grainFlow.dtLimit()),l[9]=_e();const p=this.steps<5?1:1/30;for(let d=0;d<ps;d+=1)this.timings[d]+=p*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=p*(l[ps]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let c=0;c<e.count;c+=1)i.dp0[c]!==0&&(a=!0);if(a){for(let c=0;c<s.count;c+=1){const l=t.cellAt(s.x[c],s.y[c]),u=l<0?-1:e.id[l];if(u<0||i.dp0[u]===0)continue;const f=s.mass[c],h=f/s.rho[c];s.h[c]+=h*i.dp0[u]/f,s.derive(c),r.dVp[c]+=f/s.rho[c]-h}for(let c=0;c<n.count;c+=1){const l=t.cellAt(n.x[c],n.y[c]),u=l<0?-1:e.id[l];u>=0&&i.dp0[u]!==0&&(n.H[c]+=n.V[c]*i.dp0[u])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,k0(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals(),this.grains.totals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.bodies.anyFree||this.melt.any()||this.grains.count>0}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===ut&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==ut&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===rt?this.pRef+e.pl[t]:e.kind[t]===U?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return Ou(this,t,e)}liquidsAt(t){return Cu(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===rt?e+=1:t.kind[d]===U&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,c=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy+a.bodyWork),l=r.water.total-this.water0-a.editWater,u=r.other.total-this.other0-a.editOther,f=r.salt.total-this.salt0-a.editSalt,h=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.phase.producedMark)/m,this.phase.producedMark=h,this.vapourLast=this.time);const p=[];for(let d=0;d<this.regions.count;d+=1)p.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor+r.salt.grains,bodies:{count:this.bodies.list.filter(d=>!d.gone).length,free:this.bodies.list.filter(d=>d.free).length,awake:this.bodies.list.filter(d=>d.awake).length},heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:c,waterError:l,otherError:u,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats(),cpuOnly:this.needsCpu()}}}const _e=()=>typeof performance<"u"?performance.now():Date.now();function kc(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class il{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=da(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},c=this.last;let l=0,u=0;if(c!==null&&a.t>c.t){const m=a.t-c.t,p=(a.heater-c.heater)/m,d=(a.solids-c.solids+a.SG-c.SG+a.lossS-c.lossS+a.LG-c.LG+a.sens-c.sens+a.bub-c.bub)/m;l=(a.vap-c.vap)/m,u=Math.max(0,(p-d)/i)}this.last=a;const f=this.vapour()*i,h=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=h),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:h-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:u}}}const Gs={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Qs=16,$={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},gs=96,Pc=16,Eu=57,Xt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Ae=16,Du={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Jr=8,Gt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},xe=8,Nu={TSUM:0,CELLS:1},to=2,Vu={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},rl=16,it={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69},vr=70,fs={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},yr=6,eo={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16},wr=17,Ie={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},br=20,Uu={KNOWN:0,MARK:1,MARK2:2,GAS:3},Mc=4,Hu={F:0},Fr=1,Gu={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},so=12,Zt=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),$u=[Zt("G_",Gs),Zt("C_",$),Zt("R_",Xt),Zt("RA_",Du),Zt("H_",Gt),Zt("HA_",Nu),Zt("S_",Vu),Zt("F_",it),Zt("U_",fs),Zt("A_",eo),Zt("FF_",Ie),Zt("FU_",Uu),Zt("AF_",Hu),Zt("BA_",Gu),`const RACC_STRIDE: u32 = ${Jr}u;`,`const HEAT_STRIDE: u32 = ${xe}u;`,`const HACC_STRIDE: u32 = ${to}u;`,`const CGS_STRIDE: u32 = ${rl}u;`,`const BACC_STRIDE: u32 = ${so}u;`].join(`
`);function Y(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Ut=o=>o.map(Y).join(", "),Bt=Pt.species[0],hi=Pt.species[1],di=Pt.species[2],xs=Bt.liquid.cp.table,Ee=xs.map(o=>o[0]),ws=xs.map(o=>o[1]),Ei=[ws[0]*(Ee[0]-et)];for(let o=1;o<xs.length;o+=1)Ei.push(Ei[o-1]+.5*(ws[o]+ws[o-1])*(Ee[o]-Ee[o-1]));const[Wu,Ku,zu]=Bt.vapour.cp.linear,no=et+100,Qu=(()=>{let o=0;for(;o<Ee.length-2&&no>=Ee[o+1];)o+=1;const t=no-Ee[o],e=(ws[o+1]-ws[o])/(Ee[o+1]-Ee[o]);return Ei[o]+ws[o]*t+.5*e*t*t})(),Xu=Qu+Bt.saturation.hlv100.v,Le=Pt.solids,ol=Pt.species.slice(3).map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{cA:e,cB:s,h0:e*et+.5*s*et*et,rA:t.rho.linear[0],rB:t.rho.linear[1],kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v}}),cl=1+ol.length,de=o=>`array<f32, ${cl}>(${Ut([0,...ol.map(o)])})`,_r=4294967295,Yu=`
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
}`,Sc=48,Zu=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,qs=27,Ju=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,js=29,th=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Ar=8,eh=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,sh=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${Y(et)};
const R_GAS: f32 = ${Y(Et)};
const P_ATM: f32 = ${Y(Tn)};
const G0: f32 = ${Y(zi)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${Y(hi.molarMass.v)};
const M_O2: f32 = ${Y(di.molarMass.v)};
const M_H2O: f32 = ${Y(Bt.molarMass.v)};
const CP_N2: f32 = ${Y(hi.gas.cp.v)};
const CP_O2: f32 = ${Y(di.gas.cp.v)};
const CPV0: f32 = ${Y(Wu)};
const CPV1: f32 = ${Y(Ku)};
const CPV_T: f32 = ${Y(zu)};
const T100: f32 = ${Y(no)};
const HV100: f32 = ${Y(Xu)};
const NCP: i32 = ${xs.length};
const CP_T = array<f32, ${xs.length}>(${Ut(Ee)});
const CP_V = array<f32, ${xs.length}>(${Ut(ws)});
const CP_H = array<f32, ${xs.length}>(${Ut(Ei)});
const KELL = array<f32, 7>(${Ut(Bt.liquid.kell.c)});
const KL = array<f32, 3>(${Ut(Bt.liquid.k.poly)});
const VA: f32 = ${Y(Bt.liquid.mu.vogel[0])};
const VB: f32 = ${Y(Bt.liquid.mu.vogel[1])};
const VC: f32 = ${Y(Bt.liquid.mu.vogel[2])};
const ST_B: f32 = ${Y(Bt.surfaceTension.B)};
const ST_b: f32 = ${Y(Bt.surfaceTension.b)};
const ST_MU: f32 = ${Y(Bt.surfaceTension.mu)};
const T_CRIT: f32 = ${Y(Bt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${Y(Bt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Ut(Bt.saturation.if97.n)});
const RVC = array<f32, 6>(${Ut(Bt.saturation.vapourDensity.c)});
const KV: f32 = ${Y(Bt.vapour.k.v)};
const MUV: f32 = ${Y(Bt.vapour.mu.v)};
const KN = array<f32, 3>(${Ut(hi.gas.k.power)});
const KO = array<f32, 3>(${Ut(di.gas.k.power)});
const MN = array<f32, 3>(${Ut(hi.gas.mu.sutherland)});
const MO = array<f32, 3>(${Ut(di.gas.mu.sutherland)});
const DV0: f32 = ${Y(Pt.vapourInAir.D0.v)};
const DVT0: f32 = ${Y(Pt.vapourInAir.T0.v)};
const DVE: f32 = ${Y(Pt.vapourInAir.exponent.v)};
const NSOL: u32 = ${Le.length}u;
const S_RHO = array<f32, ${Le.length}>(${Ut(Le.map(o=>o.rho.v))});
const S_CP = array<f32, ${Le.length}>(${Ut(Le.map(o=>o.cp.v))});
const S_K = array<f32, ${Le.length}>(${Ut(Le.map(o=>o.k.v))});
const S_THETA = array<f32, ${Le.length}>(${Ut(Le.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${Y(Wa)};
const REG_STRIDE: u32 = ${Ae}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${Y(xa)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${Y(es)};
const NLIQ: u32 = ${cl}u;
const L_CA = ${de(o=>o.cA)};
const L_CB = ${de(o=>o.cB)};
const L_H0 = ${de(o=>o.h0)};
const L_RA = ${de(o=>o.rA)};
const L_RB = ${de(o=>o.rB)};
const L_KA = ${de(o=>o.kA)};
const L_KB = ${de(o=>o.kB)};
const L_MA = ${de(o=>o.mA)};
const L_MB = ${de(o=>o.mB)};
const L_MC = ${de(o=>o.mC)};
const L_SIG = ${de(o=>o.sigma)};
`,nh=`
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
`,ih=`
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
`,ko=[Yu,Zu,Ju,th,eh,sh,$u,nh,ih].join(`
`),ye=Pt.solutes[0],An=298.15,Ce=o=>o.map(Y).join(", "),Zn=14,Ye=ye.cp.range.lo,Ze=ye.cp.range.hi,[al,rh,oh,ch,ah,lh]=ye.cp.laliberte,fh=o=>Math.exp(rh*(o-et)+oh*Math.exp(.01*(o-et))),Di=.5*(Ze-Ye),As=new Array(Zn).fill(0);{for(let t=0;t<64;t+=1){const e=Math.PI*(t+.5)/64,s=fh(.5*(Ze+Ye)+Di*Math.cos(e));for(let n=0;n<Zn;n+=1)As[n]+=2/64*s*Math.cos(n*e)}As[0]/=2}const io=o=>o<Zn?As[o]:0,rn=new Array(Zn+1).fill(0);rn[1]=As[0]-io(2)/2;for(let o=2;o<=Zn;o+=1)rn[o]=(io(o-1)-io(o+1))/(2*o);const Rn=(o,t)=>{let e=0,s=0;for(let n=o.length-1;n>=1;n-=1){const i=2*t*e-s+o[n];s=e,e=i}return t*e-s+o[0]},Ni=Rn(As,-1),ll=Rn(As,1),ro=Rn(rn,-1),fl=o=>{if(o<=Ye)return Ni*(o-et);const t=Ni*(Ye-et);return o>=Ze?t+Di*(Rn(rn,1)-ro)+ll*(o-Ze):t+Di*(Rn(rn,(2*o-Ye-Ze)/(Ze-Ye))-ro)},uh=Ni*(Ye-et),hh=fl(Ze),dh=ye.dHsol.v/Je+es*(An-et)-1e3*al*fl(An);function Lc(o,t){const e=[`fn ${o}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let s=t.length-1;s>=1;s-=1)e.push(`  t = 2.0 * x * b1 - b2 + ${Y(t[s])}; b2 = b1; b1 = t;`);return e.push(`  return x * b1 - b2 + ${Y(t[0])};`,"}"),e.join(`
`)}const vn=ye.pitzer,mi=ye.pitzerCold,mh=Math.sqrt(2*Math.PI*aa),ph=Pi*Pi/(4*Math.PI*la*ca),Is=ye.solubility.table,yn=ye.density.laliberte,gh=`
const S_TR: f32 = ${Y(An)};
const S_MS: f32 = ${Y(Je)};
const S_MW: f32 = ${Y(Xi)};
const S_NU: f32 = ${Y(ye.ions.v)};
const PZ_B: f32 = ${Y(vn.b.v)};
const PZ_ALPHA: f32 = ${Y(vn.alpha.v)};
const PZ_COLD: f32 = ${Y(mi.below.v)};
const PZ_B0 = array<f32, 6>(${Ce(vn.b0.a)});
const PZ_B1 = array<f32, 6>(${Ce(vn.b1.a)});
const PZ_C = array<f32, 6>(${Ce(vn.c.a)});
const PZC_B0 = array<f32, 6>(${Ce(mi.b0.a)});
const PZC_B1 = array<f32, 6>(${Ce(mi.b1.a)});
const PZC_C = array<f32, 6>(${Ce(mi.c.a)});
const S_EPS = array<f32, 4>(${Ce(ye.dielectric.c)});
const S_KN: f32 = ${Y(mh)};
const S_KLB: f32 = ${Y(ph)};
const SOL_T = array<f32, ${Is.length}>(${Ce(Is.map(o=>o[0]))});
const SOL_M = array<f32, ${Is.length}>(${Ce(Is.map(o=>o[1]))});
const LD0: f32 = ${Y(yn[0])};
const LD1: f32 = ${Y(yn[1])};
const LD2: f32 = ${Y(yn[2])};
const LD3: f32 = ${Y(yn[3])};
const LD4: f32 = ${Y(yn[4])};
const LA1: f32 = ${Y(al)};
const LA4: f32 = ${Y(ch)};
const LA5: f32 = ${Y(ah)};
const LA6: f32 = ${Y(lh)};
const E_LO: f32 = ${Y(Ye)};
const E_HI: f32 = ${Y(Ze)};
const E_LOV: f32 = ${Y(Ni)};
const E_HIV: f32 = ${Y(ll)};
const E_HALF: f32 = ${Y(Di)};
const E_FM1: f32 = ${Y(ro)};
const E_ILO: f32 = ${Y(uh)};
const E_IHI: f32 = ${Y(hh)};
const S_QS: f32 = ${Y(dh)};
const S_DMU: f32 = ${Y(ye.diffusivity.v*bs(An)/An)};

${Lc("eCh",As)}
${Lc("iCh",rn)}
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
  for (var k = 1; k < ${Is.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${Is.length-1}];
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
`,ul=[],Xs=new Map;{let o=[];const t=gh.split(`
`);for(let e=0;e<t.length;e+=1){const s=t[e];if(s.startsWith("const ")){ul.push(s),o=[];continue}if(s.startsWith("/*")){o=[s];continue}const n=/^fn (\w+)\(/.exec(s);if(n===null){s.trim()===""&&(o=[]);continue}const i=[...o,s];if(!s.trimEnd().endsWith("}"))for(;e+1<t.length&&t[e]!=="}";)e+=1,i.push(t[e]);Xs.set(n[1],i.join(`
`)),o=[]}}const hl=o=>new RegExp(`\\b${o}\\s*\\(`),xh=new Map([...Xs.entries()].map(([o,t])=>[o,[...Xs.keys()].filter(e=>e!==o&&hl(e).test(t))]));function vh(o){const t=new Set,e=s=>{if(!t.has(s)){t.add(s);for(const n of xh.get(s)??[])e(n)}};for(const s of Xs.keys())hl(s).test(o)&&e(s);return t.size===0?"":[...ul,...[...Xs.keys()].filter(s=>t.has(s)).map(s=>Xs.get(s))].join(`
`)}class yh{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=bh(t.bind),this.source=Ah(t,this.binds,this.wg)}}const wh={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function bh(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":wh[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const Fh=`
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
`,_h=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function Ah(o,t,e){const s=[ko,`const WG: u32 = ${e}u;`,Fh],n=vh(o.code);n!==""&&s.push(n);const i=new Set(t.map(r=>r.name));for(const r of t)r.mode==="a"&&i.add(`${r.name}!`);for(const r of _h)r.needs.every(a=>i.has(a))&&s.push(r.code);return t.forEach((r,a)=>{r.mode==="u"?s.push(`@group(0) @binding(${a}) var<uniform> ${r.name}: ${r.type};`):r.mode==="t"?s.push(`@group(0) @binding(${a}) var ${r.name}: texture_storage_2d<rgba8unorm, write>;`):r.mode==="x"?s.push(`@group(0) @binding(${a}) var ${r.name}: texture_2d<f32>;`):r.mode==="s"?s.push(`@group(0) @binding(${a}) var ${r.name}: sampler;`):r.mode==="r"?s.push(`@group(0) @binding(${a}) var<storage, read> ${r.name}: array<${r.type}>;`):r.mode==="w"?s.push(`@group(0) @binding(${a}) var<storage, read_write> ${r.name}: array<${r.type}>;`):(s.push(`@group(0) @binding(${a}) var<storage, read_write> ${r.name}: array<atomic<u32>>;`),s.push(`fn addF_${r.name}(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&${r.name}[i]);
  loop {
    let r = atomicCompareExchangeWeak(&${r.name}[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn getF_${r.name}(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&${r.name}[i])); }
fn setF_${r.name}(i: u32, v: f32) { atomicStore(&${r.name}[i], bitcast<u32>(v)); }
fn maxU_${r.name}(i: u32, v: f32) { atomicMax(&${r.name}[i], bitcast<u32>(max(v, 0.0))); }
fn takeF_${r.name}(i: u32, want: f32, lim: f32) -> f32 {
  var old = atomicLoad(&${r.name}[i]);
  loop {
    let cur = bitcast<f32>(old);
    let t = clamp(lim - cur, 0.0, want);
    if (!(t > 0.0)) { return 0.0; }
    let r = atomicCompareExchangeWeak(&${r.name}[i], old, bitcast<u32>(cur + t));
    if (r.exchanged) { return t; }
    old = r.old_value;
  }
}`))}),s.push(o.code),s.join(`
`)}class Po{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new Po(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new yh(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const u of a)e.push(`${s.name}:${u.lineNum}:${u.linePos} ${u.message}
    ${l[u.lineNum-1]??""}`);return}const c=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,u)=>l.mode==="t"?{binding:u,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:u,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:u,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:u,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=c;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const Cc=64,Oc="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",$s=`
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
`,Vi=`
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
`,Th=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,kh=`
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
`,Ph=[{name:"bubNucleate",wg:Cc,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${$s}
${Vi}
${Oc} {
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
}`},{name:"bubAdvance",wg:Cc,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${$s}
${Vi}
${Th}
${kh}
${Oc} {
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
}`}],rs=64,Oe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Mh=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,qc=`
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
`,Sh=[{name:"bubTarget",wg:rs,bind:"P:u cnt:a bubs:r btarget:w",code:`${Oe} {
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
}`},{name:"bubMerge",wg:rs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Oe} {
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
}`},{name:"bubMergeFinal",wg:rs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${$s}
${Oe} {
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
}`},{name:"bubVent",wg:rs,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${$s}
${Vi}
${qc}
${Oe} {
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
}`},{name:"bubFinish",wg:rs,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${$s}
${Vi}
${Mh}
${qc}
${Oe} {
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
${Oe} {
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
}`},{name:"bubCopyBack",wg:rs,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Oe} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:rs,bind:"P:u cnt:a bubs:r at:a",code:`${$s}
${Oe} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Oe} {
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
}`}],Be=128,me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ui=`
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
`,jc=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,Tr=`
var<workgroup> rr: array<f32, ${16*Be}>;
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
`,Lh=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:Be,bind:"P:u cf:w cu:r at:w reg:r",code:`${Ui}
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
}`})),{name:"transitions",wg:Be,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
}`},{name:"regCells",wg:Be,bind:"P:u cf:r cu:r racc:a",code:`${Tr}
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${Tr}
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
}`},{name:"regBubs",wg:Be,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${me} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${jc}
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
}`})),{name:"compSums",wg:Be,bind:"P:u cf:r cu:r reg:r racc:a",code:`${Tr}
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${jc}
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
}`})),{name:"compApply",wg:Be,bind:"P:u cf:w cu:r reg:r",code:`${Ui}
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
}`},{name:"gasVolumes",wg:Be,bind:"P:u cf:w cu:r reg:r",code:`${me} {
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
}`},{name:"markFaces",wg:Be,bind:"P:u cu:r ff:w fu:w",code:`${me} {
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
}`}],kr=128,Pr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ch=`
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
`,Oh=[...["viscJacA","viscJacB"].map(o=>{const[t,e]=o==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:o,wg:kr,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${Pr} {
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
}`}}),{name:"viscForce",wg:kr,bind:"P:u ff:w fu:r",code:`${Pr} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:kr,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Pr} {
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
}`}],Ic=`const THETA_MIN: f32 = ${Yr.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,pi=128,os=128,se="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ee=`
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
`,Bc=`
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
`,qh=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Rc=1,jh=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${se} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Rc}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${se} {
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
${se} {
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
    pargs[0] = max(1u, (total + ${pi-1}u) / ${pi}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${se} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:os,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ee}
${qh}
${se} {
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
}`},{name:"classify",wg:os,bind:"P:u cf:r cu:w",code:`${se} {
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
}`},{name:"p2g",wg:os,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Bc}
${se} {
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
}`},{name:"liqAssemble",wg:os,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Ic}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${se} {
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
}`},{name:"liqPressure",wg:os,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${se} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:os,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Ic}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${se} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:os,bind:"P:u ff:w fu:w",code:`${se} {
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
}`})),{name:"g2p",wg:pi,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w",code:`${Bc}
${ee}
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
${Ch}
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
${se} {
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
      q.flags = q.flags | ${Rc}u;
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
}`},{name:"heatWeights",wg:pi,bind:"P:u cnt:a cu:r parts:w",code:`${ee}
${se} {
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
}`}],qe=128,je="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ec=`
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
`,Dc=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,Nc=`
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
`,Ih=[{name:"gasMaxOut",wg:qe,bind:"P:u cu:r ff:r cnt:a",code:`${ee}
${je} {
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
}`},{name:"gasFlux",wg:qe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Ec}
${Dc}
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
${je} {
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
}`},{name:"gasMove",wg:qe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Ec}
${Dc}
${ee}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${je} {
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
}`},{name:"macFwd",wg:qe,bind:"P:u glob:r ff:w fu:r",code:`${Nc}
${je} {
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
}`},{name:"macBack",wg:qe,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${Nc}
${je} {
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
}`},{name:"viscosity",wg:qe,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${je} {
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
}`},{name:"gasAssemble",wg:qe,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${je} {
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
}`},{name:"gasPressure",wg:qe,bind:"P:u cf:w cu:r cgv:r",code:`${je} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:qe,bind:"P:u glob:r cf:r ff:w fu:r",code:`${je} {
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
}`}],Ge=128,$e="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Pe=`
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
`,Mo=`
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
`,Bh=`
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
`,Rh=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:Ge,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Pe}
${$e} {
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
}`})),{name:"applyMass",wg:Ge,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Pe}
${ee}
${Mo}
${$e} {
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
}`},{name:"diffPrep",wg:Ge,bind:"P:u cf:w cu:w reg:r",code:`${$e} {
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
}`},{name:"diffAssemble",wg:Ge,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${Bh}
${$e} {
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
}`},{name:"diffFaces",wg:Ge,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${$e} {
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
}`},{name:"diffOut",wg:Ge,bind:"P:u cf:w cu:r ff:r",code:`${$e} {
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
}`},{name:"diffApply",wg:Ge,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ee}
${$e} {
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
}`},{name:"latentSrc",wg:Ge,bind:"P:u glob:r cf:r at:a",code:`${$e} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],Vc=[.125,.75,.125];function Eh(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),a=Uint8Array.from(t.kind),c=new Uint8Array(e),l=new Uint8Array(e),u=new Uint32Array(e),f=new Float64Array(e),h=new Float64Array(e),m=Float32Array.from(t.T),p=o.heat.heaters.map(()=>0),d=new Float64Array(Math.max(1,o.regions.count)),g=o.bodies.list,x=new Uint8Array(e);for(let A=0;A<e;A+=1)t.owner[A]!==0&&t.matB[A]!==0&&(t.solid[A]!==0||t.fs[A]>.5)&&(x[A]=1);const w=(A,b)=>{if(x[A]!==0||x[b]!==0)return;const k=t.owner[A]!==0&&t.matB[A]!==0?t.fs[A]:-1,P=t.owner[b]!==0&&t.matB[b]!==0?t.fs[b]:-1;k<0&&P<0||(x[P>k?b:A]=1)};for(let A=0;A<n;A+=1)for(let b=1;b<s;b+=1)t.au[b+A*(s+1)]<=0&&w(b-1+A*s,b+A*s);for(let A=1;A<n;A+=1)for(let b=0;b<s;b+=1)t.av[b+A*s]<=0&&w(b+(A-1)*s,b+A*s);for(let A=0;A<e;A+=1){if(c[A]=t.solid[A],l[A]=t.kind[A],u[A]=t.role[A]===1&&t.heater[A]>=0?t.heater[A]+1:0,f[A]=t.Es[A],h[A]=t.film[A],x[A]===0)continue;const b=t.owner[A],k=t.solid[A]!==0,P=g[b-1],M=t.matB[A]-1,S=mt[M];if(r[A]=1,!k){const L=o.regions.id[A];L>=0&&(d[L]+=(1-t.fs[A])*t.vCell)}c[A]=M+1,l[A]=dt;const C=t.Ts[A]>0?t.Ts[A]:_o(t.Es[A],t.capB[A],t.film[A],t.crust[A],t.T[A]);f[A]=(S.rho*S.cp*t.vCell+t.crust[A]*es)*(C-et)+t.film[A]*At(C),m[A]=C,P!==void 0&&P.heater>=0&&P.heater<p.length&&(u[A]=P.heater+1,p[P.heater]+=1)}for(let A=0;A<e;A+=1)r[A]===0&&u[A]>0&&u[A]<=p.length&&(p[u[A]-1]+=1);const y=(A,b)=>A<0?t.openL?0:1:A>=s?t.openR?0:1:b<0?t.openB?0:1:b>=n?t.openT?0:1:c[A+b*s]!==0?1:0,_=new Float32Array(e),F=new Float32Array(e);for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const k=b+A*s;if(c[k]!==0){_[k]=1;continue}let P=0;for(let M=-1;M<=1;M+=1)for(let S=-1;S<=1;S+=1)P+=Vc[S+1]*Vc[M+1]*y(b+S,A+M);_[k]=P}const T=4;for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const k=b+A*s,P=c[k]!==0,M=(b+.5)*i,S=(A+.5)*i;let C=T*i;P||(t.openL||(C=Math.min(C,M)),t.openR||(C=Math.min(C,t.w-M)),t.openB||(C=Math.min(C,S)),t.openT||(C=Math.min(C,t.h-S)));for(let L=-T;L<=T;L+=1){const B=A+L;if(!(B<0||B>=n))for(let I=-T;I<=T;I+=1){const j=b+I;if(j<0||j>=s||c[j+B*s]!==0===P)continue;const R=Math.max(0,Math.abs(I)-.5)*i,E=Math.max(0,Math.abs(L)-.5)*i;C=Math.min(C,Math.hypot(R,E))}}F[k]=P?-C:C}return{body:r,kindCpu:a,solid:c,kind:l,hgrp:u,es:f,film:h,T:m,phiS:_,sdf:F,heaterCells:p,vFix:d}}function Dh(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=mt[t.solid[n]-1],r=_o(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],e.crust[n],e.T[n]);e.Es[n]=Hr(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const Us=800,Nh=24,Uc=6,Vt=4,Ys=16,zt=256,Hc=`struct Levels { lv: array<Level, ${Ys}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,En=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Fi=`${En}
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
`,Re=`
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
`,cs=`
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
`,Gc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,$c=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Lt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",We=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,dl=6,Bs=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,Mr=`
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
`,Sr="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Vh=[{name:"cgPrep1",wg:zt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${En}
${Lt} {
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
}`},{name:"cgPrep2",wg:zt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${We}
${Fi}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${dl}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:zt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:zt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${We}
${Mr}
${Bs}
${Lt} {
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
}`},{name:"cclProject",wg:zt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${We}
${Sr}
${Bs}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:zt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${We}
${En}
${cs}
${Lt} {
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
}`},{name:"cgFoldInitMG",wg:zt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${cs}
${$c}
${Lt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${We}
${Re}
${cs}
${Gc}
${Lt} {
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
}`},{name:"cgB",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${We}
${Re}
${cs}
${Gc}
var<workgroup> wpq: f32;
${Lt} {
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
}`},{name:"cgFoldRR",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Re}
${cs}
${$c}
${Lt} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Re}
${cs}
${Lt} {
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
}`},{name:"cgZSum",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Re}
${Mr}
${Bs}
${Lt} {
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
}`},{name:"cgZSub",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Re}
${Sr}
${Bs}
${cs}
${Lt} {
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
}`},{name:"cgEnd1",wg:zt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${We}
${Mr}
${Bs}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${Lt} {
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
}`},{name:"cgEnd2",wg:zt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${We}
${Sr}
${Bs}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Uh=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Hh(o,t){const e=[];let s=0,n=0,i=o,r=t,a=1,c=0;for(;;){const u=i+2,f=(i+2)*(r+2),h={};for(const d of Uh)h[d]=s,s+=f;const m=n;n+=f;let p=0;if(h.pW=0,e.length>0&&(h.pW=s,s+=4*c,p=n,n+=4*c),e.push({nx:i,ny:r,stride:u,size:f,h:a,f:h,act:m,pIdx:p}),i*r<=Nh||i<=2&&r<=2||e.length>=Ys)break;c=f,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let u=0;u<e.length;u+=1){let f=0;for(let h=u;h<e.length;h+=1)f+=e[h].size;if(f<=Us){l=u;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function gi(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const ml={tol:1e-5,it:$.IT_L,cap:$.CAP_L,res:$.RES_L},pl={tol:1e-5,it:$.IT_G,cap:$.CAP_G,res:$.RES_G},gl={tol:1e-5,it:$.IT_H,cap:$.CAP_H,res:$.RES_H},xl={tol:1e-5,it:$.IT_D,cap:$.CAP_D,res:$.RES_H},Rs=200,pe=256;class Gh{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);gi(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(pe/4*n.length);for(let l=0;l<n.length;l+=1)gi(l>0?n[l-1]:null,l-1,r,pe/4*l),gi(n[l],l,r,pe/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*Ys+4);for(let l=0;l<n.length;l+=1)gi(n[l],l,a,32*l);a[32*Ys]=e.lt,a[32*Ys+1]=n.length,this.lv=t.uniform("lv",a.buffer);const c=new Uint32Array(pe/4*(Rs+1));for(let l=0;l<Rs;l+=1)c[pe/4*l]=l;c[pe/4*Rs]=4294967295,this.it=t.uniform("iter",c.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(pe*4));for(const l of[ml,pl,gl,xl])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,pe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,pe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:pe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,pe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,u)=>{const f={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,u,f),this.run(t,"cgZSub",r,u,f)):this.run(t,"cgRZ",r,u,f)};this.vcycle(t),a(Rs,`k${Rs}`);const c=Math.min(Rs,Math.max(1,s));for(let l=0;l<c;l+=1){const u={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,u),this.run(t,"cgB",r,`k${l}`,u),this.one(t,"cgFoldRR",`k${l}`,u),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Zs=16,Wc=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class $h{constructor(t,e){v(this,"stair",null);v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=Hh(s.nx,s.ny);const r=(c,l,u=Wc)=>{const f=t.buffer(c,4*Math.max(4,l),u);return this.own.push(f),f};this.params=r("params",Sc,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Qs),this.cnt=r("cnt",gs),this.cf=r("cf",vr*i.n),this.cu=r("cu",yr*i.n),this.at=r("at",wr*i.n),this.ff=r("ff",br*i.nf),this.fu=r("fu",Mc*i.nf),this.af=r("af",Fr*i.nf),this.partsA=r("partsA",qs*i.pcap),this.partsB=r("partsB",qs*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,Wc|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",js*i.bcap),this.bubs2=r("bubs2",js*i.bcap),this.bacc=r("bacc",so*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",Ar*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Ae*i.nreg),this.racc=r("racc",Jr*i.nreg),this.heat=r("heat",xe*i.nheat),this.hacc=r("hacc",to*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",rl),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",dl*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",Zs*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*Sc),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[at],t.ambientY[ft],t.ambientY[Z],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let c=0;for(let u=0;u<t.regions.count;u+=1)t.regions.open[u]===0&&(c=1);i[40]=c,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=t.particles.hasOther()?1:0;const l=b0(t.scene.extremes,t.regions.pAmb,Math.abs(t.gy));r.set([l.chf,l.actMax,l.vmax,l.bubCap],44),this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(xe*this.d.nheat);s.forEach((i,r)=>{var c;const a=xe*r;n[a+Gt.MODE]=i.mode==="thermostat"?1:0,n[a+Gt.POWER]=i.power,n[a+Gt.TARGET]=i.target,n[a+Gt.ON]=i.on?1:0,n[a+Gt.P]=i.P,n[a+Gt.TMEAN]=i.Tmean,n[a+Gt.INTEGRAL]=i.integral,n[a+Gt.CELLS]=e!==null?e[r]??0:((c=this.stair)==null?void 0:c.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*xe*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n,r=Eh(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r.heaterCells);const a=t.regions,c=Array.from({length:a.count},(q,Q)=>Q).sort((q,Q)=>a.vFluid[Q]-a.vFluid[q]);this.regionMap=new Int32Array(Math.max(1,a.count)),this.regionInv=new Int32Array(Math.max(1,a.count)),c.forEach((q,Q)=>{this.regionMap[q]=Q,this.regionInv[Q]=q});const l=new Float32Array(Ae*s.nreg);for(let q=0;q<a.count;q+=1){const Q=Ae*this.regionMap[q];l[Q+Xt.OPEN]=a.open[q],l[Q+Xt.VFLUID]=a.vFluid[q]-r.vFix[q],l[Q+Xt.P0]=a.p0[q],l[Q+Xt.RHOBAR]=a.rhoBar[q],l[Q+Xt.VLIQ]=a.vLiq[q],l[Q+Xt.VBUB]=a.vBub[q],l[Q+Xt.VGAS]=a.vGas[q],l[Q+Xt.P0START]=a.p0[q]}e.writeBuffer(this.reg,0,l);const u=new Uint32Array(yr*i);for(let q=0;q<i;q+=1){u[fs.KIND*i+q]=r.kind[q],u[fs.KPREV*i+q]=r.kind[q],u[fs.SOLID*i+q]=r.solid[q],u[fs.HGRP*i+q]=r.hgrp[q];const Q=a.id[q];u[fs.RID*i+q]=Q<0?_r:this.regionMap[Q]}e.writeBuffer(this.cu,0,u);const f=new Float32Array(vr*i),h=(q,Q,V=0)=>{for(let G=0;G<i;G+=1)f[q*i+G]=Q[V+G]};h(it.PHI,n.phi),h(it.ALPHA,n.alpha),h(it.ALPHAOLD,n.alpha),h(it.PL,n.pl),h(it.PG,n.pg),h(it.MN,n.mg,at*i),h(it.MO,n.mg,ft*i),h(it.MV,n.mg,Z*i),h(it.MF,n.mfog),h(it.HG,n.Hg),h(it.ES,r.es),h(it.FILM,r.film),h(it.T,r.T),h(it.TL,n.Tl),h(it.CL,n.Cl);const m=t.gas;h(it.VGAS,m.vgas),h(it.RHO,m.rho),h(it.NMOL,m.nmol),h(it.CAP,m.cap),h(it.MU,m.mu),h(it.VEOS,m.veos),h(it.SRCV,m.srcV),h(it.VEOSMID,m.veosMid),h(it.PHIS,r.phiS),h(it.SDF,r.sdf),h(it.PTL,r.T),h(it.CRUST,n.crust);for(let q=0;q<n.nx;q+=1)f[it.FLOOR*i+q]=t.salt.floor[q],f[it.FLOORH*i+q]=t.salt.floorH[q];f.fill(1,it.AW*i,(it.AW+1)*i),e.writeBuffer(this.cf,0,f);const p=new Float32Array(wr*i);for(let q=0;q<i;q+=1)p[eo.VOLSRC*i+q]=t.liquid.volSrc[q];e.writeBuffer(this.at,0,p);const d=s.nf,g=new Float32Array(br*d);for(let q=0;q<s.nu;q+=1)g[Ie.UL*d+q]=n.ul[q],g[Ie.UG*d+q]=n.ug[q];for(let q=0;q<s.nv;q+=1)g[Ie.UL*d+s.nu+q]=n.vl[q],g[Ie.UG*d+s.nu+q]=n.vg[q];e.writeBuffer(this.ff,0,g),e.writeBuffer(this.fu,0,new Uint32Array(Mc*d));const x=new Float32Array(Fr*d);for(let q=0;q<s.nu;q+=1)x[q]=t.liquid.fU[q];for(let q=0;q<s.nv;q+=1)x[s.nu+q]=t.liquid.fV[q];e.writeBuffer(this.af,0,x);const w=t.particles,y=t.liquid,_=new ArrayBuffer(4*qs*Math.max(1,w.count)),F=new Float32Array(_),T=new Uint32Array(_),A=new Int32Array(_);for(let q=0;q<w.count;q+=1){const Q=qs*q;F.set([w.x[q],w.y[q],w.vx[q],w.vy[q],w.c00[q],w.c01[q],w.c10[q],w.c11[q],w.mass[q],w.h[q],w.T[q],w.rho[q],y.dVp[q]],Q),T[Q+13]=(w.mat[q]&255)<<8,T[Q+14]=w.id[q],A[Q+15]=y.bi[q],A[Q+16]=y.bj[q];for(let V=0;V<9;V+=1)F[Q+17+V]=y.wt[9*q+V];F[Q+26]=w.smass[2*q]}w.count>0&&e.writeBuffer(this.partsA,0,_);const b=t.bubbles,k=t.bubbleModel.motionState,P=new ArrayBuffer(4*js*Math.max(1,b.count)),M=new Float32Array(P),S=new Uint32Array(P),C=new Int32Array(P);for(let q=0;q<b.count;q+=1){const Q=js*q,V=q*lt;M.set([b.x[q],b.y[q],b.z[q],b.vx[q],b.vy[q],b.m[V+at],b.m[V+ft],b.m[V+Z],b.H[q],b.age[q]],Q),C[Q+10]=b.site[q],M.set([b.r[q],b.V[q],b.pb[q],b.pv[q],b.Tb[q],b.dmdt[q],k.ux0[q],k.uy0[q]],Q+11),S[Q+19]=b.id[q],S[Q+20]=1;for(let G=0;G<ce;G+=1)M[Q+21+G]=b.force[q*ce+G]}b.count>0&&e.writeBuffer(this.bubs,0,P);const L=t.bubbleModel.cavities;this.nsites=L.count;const B=new ArrayBuffer(4*Ar*s.nsites),I=new Uint32Array(B),j=new Float32Array(B),R=n.nx;for(let q=0;q<L.count;q+=1){const Q=Ar*q;let V=L.cell[q],G=L.r[q];if(V>=0&&r.solid[V]===0){const st=L.dir[q],vt=st===0?V+1:st===1?V-1:st===2?V+R:V-R;vt>=0&&vt<i&&r.solid[vt]!==0?V=vt:G=1e-9}I.set([V,L.fluid[q],L.dir[q],0],Q),j.set([G,L.s[q],L.z[q],0],Q+4)}e.writeBuffer(this.sites,0,B);const E=new Uint32Array(s.nsites);for(let q=0;q<L.count;q+=1)E[q]=L.bubble[q];e.writeBuffer(this.sbub,0,E);const W=new Float32Array(Qs);W[Gs.DT]=t.dt,W[Gs.TIME]=t.time,W[Gs.RHOREF]=y.rhoRef,e.writeBuffer(this.glob,0,W);const N=new Uint32Array(gs),J=new Float32Array(N.buffer);N[$.PCOUNT]=w.count,N[$.PSORT]=w.count,N[$.BCOUNT]=b.count,N[$.NEXTID_B]=Math.max(1,b.nextFree),N[$.NEXTID_P]=Math.max(1,w.nextFree);const tt=t.bubbleModel;N[$.WATCH]=tt.watch>=0?tt.watch:_r,N[$.WATCH_FATE]=tt.watchFate,tt.firstSuperheat!==null&&(J[$.FIRST_SH]=tt.firstSuperheat+1e3,N[$.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,N),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(so*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Jr*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(to*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(u=>Math.ceil(u.size/4)*4),n=s.reduce((u,f)=>u+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((u,f)=>{s[f]>0&&r.copyBufferToBuffer(u.buf,u.offset,i,a,s[f]),a+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const c=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const u of s)l.push(c.slice(a,a+u)),a+=u;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,c,l,u,f,h,m]=await this.read([{buf:this.cnt,offset:0,size:4*gs},{buf:this.glob,offset:0,size:4*Qs},{buf:this.cf,offset:0,size:4*vr*s},{buf:this.cu,offset:0,size:4*yr*s},{buf:this.at,offset:0,size:4*wr*s},{buf:this.ff,offset:0,size:4*br*e.nf},{buf:this.af,offset:0,size:4*Fr*e.nf},{buf:this.heat,offset:0,size:4*xe*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Ae*e.nreg}]),p=new Uint32Array(n),d=Math.min(e.pcap,p[$.PCOUNT]),g=Math.min(e.bcap,p[$.BCOUNT]),[x,w]=await this.read([{buf:this.partsA,offset:0,size:4*qs*Math.max(1,d)},{buf:this.bubs,offset:0,size:4*js*Math.max(1,g)}]),y=t.grid,_=new Float32Array(r),F=(D,H,X=0)=>{for(let O=0;O<s;O+=1)H[X+O]=_[D*s+O]};F(it.PHI,y.phi),F(it.ALPHA,y.alpha),F(it.PL,y.pl),F(it.PG,y.pg),F(it.MN,y.mg,at*s),F(it.MO,y.mg,ft*s),F(it.MV,y.mg,Z*s),F(it.MF,y.mfog),F(it.HG,y.Hg),F(it.ES,y.Es),F(it.FILM,y.film),F(it.T,y.T),F(it.TL,y.Tl),F(it.CL,y.Cl);const T=t.gas;F(it.VGAS,T.vgas),F(it.RHO,T.rho),F(it.NMOL,T.nmol),F(it.CAP,T.cap),F(it.MU,T.mu),F(it.VEOS,T.veos),F(it.SRCV,T.srcV),F(it.VEOSMID,T.veosMid),F(it.CRUST,y.crust);for(let D=0;D<y.nx;D+=1)t.salt.floor[D]=_[it.FLOOR*s+D],t.salt.floorH[D]=_[it.FLOORH*s+D];const A=new Uint32Array(a);for(let D=0;D<s;D+=1)y.kind[D]=A[fs.KIND*s+D];const b=new Float32Array(c);for(let D=0;D<s;D+=1)t.liquid.volSrc[D]=b[eo.VOLSRC*s+D];const k=new Float32Array(l),P=new Float32Array(u),M=e.nf;for(let D=0;D<e.nu;D+=1)y.ul[D]=k[Ie.UL*M+D],y.ug[D]=k[Ie.UG*M+D],t.liquid.fU[D]=P[D];for(let D=0;D<e.nv;D+=1)y.vl[D]=k[Ie.UL*M+e.nu+D],y.vg[D]=k[Ie.UG*M+e.nu+D],t.liquid.fV[D]=P[e.nu+D];const S=t.particles,C=t.liquid,L=new Float32Array(x),B=new Uint32Array(x),I=new Int32Array(x);let j=0,R=0;for(let D=0;D<d;D+=1){const H=qs*D;if(B[H+13]&1||!(L[H+8]>0))continue;const X=j;j+=1,S.x[X]=L[H],S.y[X]=L[H+1],S.vx[X]=L[H+2],S.vy[X]=L[H+3],S.c00[X]=L[H+4],S.c01[X]=L[H+5],S.c10[X]=L[H+6],S.c11[X]=L[H+7],S.mass[X]=L[H+8],S.h[X]=L[H+9];const O=L[H+26]>0?L[H+26]:0;S.spc[2*X]=O>0?Wn:0,S.spc[2*X+1]=0,S.smass[2*X]=O,S.smass[2*X+1]=0,S.mat[X]=B[H+13]>>>8&255,S.id[X]=B[H+14],S.id[X]>R&&(R=S.id[X]),C.dVp[X]=L[H+12],C.bi[X]=I[H+15],C.bj[X]=I[H+16];for(let K=0;K<9;K+=1)C.wt[9*X+K]=L[H+17+K];S.derive(X)}S.count=j,S.reserveIds(Math.max(p[$.NEXTID_P],R+1)),C.weightsDirty=!0;const E=t.bubbles,W=t.bubbleModel.motionState,N=new Float32Array(w),J=new Uint32Array(w),tt=new Int32Array(w);E.count=0;let q=0;for(let D=0;D<g;D+=1){const H=js*D;if(J[H+20]===0)continue;const X=E.count;E.count+=1;const O=X*lt;E.x[X]=N[H],E.y[X]=N[H+1],E.z[X]=N[H+2],E.vx[X]=N[H+3],E.vy[X]=N[H+4];for(let K=0;K<lt;K+=1)E.m[O+K]=0;E.m[O+at]=N[H+5],E.m[O+ft]=N[H+6],E.m[O+Z]=N[H+7],E.H[X]=N[H+8],E.age[X]=N[H+9],E.site[X]=tt[H+10],E.r[X]=N[H+11],E.V[X]=N[H+12],E.pb[X]=N[H+13],E.pv[X]=N[H+14],E.Tb[X]=N[H+15],E.dmdt[X]=N[H+16],W.ux0[X]=N[H+17],W.uy0[X]=N[H+18],E.id[X]=J[H+19],E.id[X]>q&&(q=E.id[X]);for(let K=0;K<ce;K+=1)E.force[X*ce+K]=N[H+21+K]}E.reserveIds(Math.max(p[$.NEXTID_B],q+1));const Q=t.bubbleModel.cavities,V=new Uint32Array(h);for(let D=0;D<Q.count;D+=1)Q.bubble[D]=V[D];const G=new Float32Array(m);for(let D=0;D<t.regions.count;D+=1){const H=Ae*this.regionMap[D];t.regions.p0[D]=G[H+Xt.P0],t.regions.rhoBar[D]=G[H+Xt.RHOBAR]}const st=new Float32Array(f);t.heat.heaters.forEach((D,H)=>{const X=xe*H;D.P=st[X+Gt.P],D.Tmean=st[X+Gt.TMEAN],D.integral=st[X+Gt.INTEGRAL]});const vt=new Float32Array(i);t.dt=vt[Gs.DT];const yt=t.bubbleModel;yt.watch=p[$.WATCH]===_r?-1:p[$.WATCH],Dh(t,this.stair)}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const Ke=128,Qt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Wh=5,Kc=30,zc=`
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
`,Kh=[{name:"heaterSums",wg:Ke,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Qt} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Qt} {
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
        let kp = power / ${Wh}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${Kc}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${Kc}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:Ke,bind:"P:u cnt:a parts:r",code:`${ee}
${Qt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:Ke,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Pe}
${ee}
${Qt} {
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
}`},{name:"heatAssemble",wg:Ke,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${zc}
${Qt} {
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
}`},{name:"heatFlux",wg:Ke,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${zc}
${Ui}
${ee}
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
${Qt} {
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
}`},{name:"heatParts",wg:Ke,bind:"P:u cnt:a cf:r parts:w",code:`${Pe}
${Qt} {
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
}`},{name:"heatShare",wg:Ke,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${Pe}
${Qt} {
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
}`},{name:"pwParts",wg:Ke,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Qt} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Qt} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Qt} {
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
${Qt} {
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
  if (lid < 11u) { meas[wid3.x * ${Zs}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${Qt} {
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Zs}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Qt} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Zs}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Qt} {
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
}`}],Es=256,zh=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:Es,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Fi}
${Lt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Es,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Fi}
${Lt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Es,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Hc}
${Fi}
${Lt} {
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
}`},{name:"mgPost",wg:Es,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${En}
${Re}
const TILE: u32 = 16u;
const HALO: u32 = ${Vt}u;
const TS: u32 = ${16+2*Vt}u;
var<workgroup> sx: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Vt)**2}>;
${Lt} {
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
}`},{name:"mgPreR",wg:Es,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${En}
${Re}
const TILE: u32 = 12u;
const HALO: u32 = ${Vt+2}u;
const TS: u32 = ${12+2*(Vt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Vt+2))**2}>;
${Lt} {
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
}`},{name:"mgTail",wg:Es,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Hc}
${Re}
var<workgroup> tx: array<f32, ${Us}>;
var<workgroup> tb: array<f32, ${Us}>;
var<workgroup> tax: array<f32, ${Us}>;
var<workgroup> tay: array<f32, ${Us}>;
var<workgroup> tinv: array<f32, ${Us}>;
var<workgroup> toff: array<u32, ${Ys}>;
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
${Lt} {
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
  for (var k = 0u; k < ${Uc}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Uc}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],as=128,ls="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Qh=[{name:"flashTs",wg:as,bind:"P:u cf:w cu:r reg:r",code:`${ls} {
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
}`},{name:"flashVap",wg:as,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Pe}
${ls} {
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
}`},{name:"flashParts",wg:as,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Pe}
${ee}
${Mo}
${ls} {
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
}`},{name:"flashDist",wg:as,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ee}
${ls} {
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
}`},{name:"fog",wg:as,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Ui}
${ee}
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
${ls} {
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
}`},{name:"spawnWater",wg:as,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ls} {
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
}`},{name:"films",wg:as,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${ls} {
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
}`}],Lr=128,Cr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Xh=`
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
`,Yh=`
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
`,Zh=[{name:"saltCryst",wg:Lr,bind:"P:u cnt:a cu:r at:a parts:w",code:`${Pe}
${ee}
${Mo}
${Cr} {
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
}`},{name:"saltSums",wg:Lr,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${Pe}
${Cr} {
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
}`},{name:"saltShare",wg:Lr,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${Pe}
${Xh}
${Yh}
${Cr} {
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
}`}],xi=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Dn(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const ve=[0,120],So=.3;mt.map(o=>Dn(o.color));var ia;Dn(((ia=Yi[0])==null?void 0:ia.color)??"#f4f3ee");const Ds=128,Ns="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Jh=.006,td={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},ed=4*1e3*15e-7/(3*2*.07),Lo=`
const VIR = array<vec3<f32>, ${xi.length}>(${xi.map(o=>`vec3<f32>(${Y(o[0]/255)}, ${Y(o[1]/255)}, ${Y(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${Y(xi.length-1)};
  let i = min(u32(floor(x)), ${xi.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Or="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var ra;const sd=[{name:"rScale",wg:Ds,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Or}
var<workgroup> m4: array<vec4<f32>, WG>;
${Ns} {
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
}`},{name:"rCells",wg:Ds,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Or}
${Lo}
const SOLID_RGB = array<vec3<f32>, ${mt.length}>(${mt.map(o=>{const t=Dn(o.color);return`vec3<f32>(${Y(t[0]/255)}, ${Y(t[1]/255)}, ${Y(t[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${Dn(((ra=Yi[0])==null?void 0:ra.color)??"#f4f3ee").map(o=>Y(o/255)).join(", ")});
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${Y(Da)} * P.dx * P.depth) / P.dx)); }
${Ns} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${Y(ve[0])};
  let tspan = ${Y(ve[1]-ve[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${mt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${Y(ed)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Ds,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${Ns} {
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
}`},{name:"rLiqBlurX",wg:Ds,bind:"P:u lq:r lq2:w",code:`${Ns} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:Ds,bind:"P:u lq2:r liquid:t",code:`${Ns} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${Y(ve[0])}) / ${Y(ve[1]-ve[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${Y(So)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:Ds,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Or}
${Ns} {
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
}`}],Jn=`
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
`;var oa;const qr=`${Jn}
${Lo}
const OIL_RGB = vec3<f32>(${Dn(((oa=te[1])==null?void 0:oa.color)??"#e3b437").map(o=>Y(o)).join(", ")});
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
`,nd=`${Jn}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,id=`${Jn}
${(ko.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${$.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,rd=`${Jn}
${Lo}
${(ko.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${$.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${Y(273.15+ve[0])}) / ${Y(ve[1]-ve[0])}, 0.0, 1.0);
  if (R.tint > 1.5) { o.t = clamp(parts[p].s / max(1e-30, parts[p].mass) / ${Y(So)}, 0.0, 1.0); }
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,od=`${Jn}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Qc=48,jr=256,cd=12;class ad{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",jr*cd,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,p,d,g,x=[])=>{const w=t.createShaderModule({code:m}),_=(await w.getCompilationInfo()).messages.filter(F=>F.type==="error");if(_.length>0)throw new Error(`render WGSL: ${_.map(F=>`${F.lineNum}:${F.linePos} ${F.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:w,entryPoint:"vs",buffers:x},fragment:{module:w,entryPoint:p,targets:[{format:this.format,blend:e}]},primitive:{topology:g}})},[r,a,c,l,u,f,h]=await Promise.all([i(qr,"fsCells",this.layouts.quad,"triangle-strip"),i(qr,"fsField",this.layouts.quad,"triangle-strip"),i(qr,"fsLiquid",this.layouts.quad,"triangle-strip"),i(nd,"fs",this.layouts.rect,"triangle-strip"),i(id,"fs",this.layouts.store,"triangle-strip"),i(rd,"fs",this.layouts.store,"triangle-strip"),i(od,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:c,rect:l,disc:u,point:f,line:h}}ensure(){var u,f,h,m,p,d;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(g,x)=>s.createTexture({size:[g,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(u=this.cellsTex)==null||u.destroy(),(f=this.fieldTex)==null||f.destroy(),(h=this.liquidTex)==null||h.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(p=this.lq2)==null||p.destroy(),(d=this.arrows)==null||d.destroy(),this.lq=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(Jh/this.gpu.cpu.grid.dx)),a=r>>1,c=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=c*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,c,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:jr*s,size:4*Qc}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const c=this.gpu.state,l=this.gpu.ctx,u=this.device.queue;this.roData[0]=td[r],u.writeBuffer(this.ro,0,this.roData),t.clearBuffer(c.cnt,4*$.OV_PMAX,16);const f=t.beginComputePass(),h=c.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),h),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),h),a||(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*h),l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*h),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*h)),r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),f.end();const m=this.gpu.cpu.grid,p=(y,_,F)=>{const T=new Float32Array(Qc),A=new Uint32Array(T.buffer);T.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),T.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),T.set(_,24),T.set(F,28),T[32]=r==="temperature"?1:r==="salt"?2:0,T[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),A[34]=c.d.bcap,A[35]=c.d.pcap,u.writeBuffer(this.rp,jr*y,T)},d=.003;p(0,[0,0,m.w,m.h],[...this.theme.ground,1]),p(1,[0,0,0,0],[0,0,0,0]),p(2,[0,0,0,0],[...this.theme.ink,.85]),p(3,[0,0,0,0],[...this.waterInk,.9]);const g=[];i.left&&g.push([-d,-d,0,m.h+(i.top?d:0)]),i.right&&g.push([m.w,-d,m.w+d,m.h+(i.top?d:0)]),i.bottom&&g.push([-d,-d,m.w+d,0]),i.top&&g.push([-d,m.h,m.w+d,m.h+d]),g.forEach((y,_)=>p(4+_,y,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;x.setPipeline(w.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(w.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:c.partsA})),x.draw(4,c.d.pcap)):(x.setPipeline(w.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(w.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:c.bubs})),x.draw(4,c.d.bcap),x.setPipeline(w.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(w.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(w.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(w.rect),g.forEach((y,_)=>{x.setBindGroup(0,this.drawGroup(`d-wall${_}`,this.layouts.rect,4+_,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const ld=[...Vh,...zh,...jh,...Oh,...Lh,...Ih,...Ph,...Sh,...Rh,...Qh,...Zh,...Kh,...sd],Xc=[["heater",$.HEATER_E,"f"],["lossWalls",$.LOSS_WALLS,"f"],["lossOpen",$.LOSS_OPEN,"f"],["escapedEnergy",$.ESC_ENERGY,"f"],["escapedWater",$.ESC_WATER,"f"],["escapedAir",$.ESC_AIR,"f"],["escapedOther",$.ESC_OTHER,"f"],["escapedSalt",$.ESC_SALT,"f"],["crystallized",$.CRYST,"f"],["produced",$.PRODUCED,"f"],["condensed",$.CONDENSED,"f"],["dew",$.DEW,"f"],["fogMade",$.FOGMADE,"f"],["burstVapour",$.BURSTVAP,"f"],["fluxSL",$.FLUX_SL,"f"],["fluxLG",$.FLUX_LG,"f"],["fluxSG",$.FLUX_SG,"f"],["lossSolids",$.LOSS_SOLIDS,"f"],["nucleated",$.NUCLEATED,"u"],["departed",$.DEPARTED,"u"],["merged",$.MERGED,"u"],["burst",$.BURST,"u"],["collapsed",$.COLLAPSED,"u"],["burstCold",$.BURST_COLD,"u"],["burstWarm",$.BURST_WARM,"u"],["collapsedCold",$.COLL_COLD,"u"],["collapsedWarm",$.COLL_WARM,"u"]],Yc=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0}),fd=24,Ir=256,Vs=2*ps;class Co{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",Yc());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"other0",null);v(this,"salt0",null);v(this,"sealed",!1);v(this,"salty",!1);v(this,"mixed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(ps).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:Vs}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*Vs,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await Po.create(),s=await e.compile(ld);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new Co(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new $h(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Gh(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Ir/4*16);for(let n=0;n<16;n+=1)s[Ir/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,s.escapedOther=e.escapedOther,s.escapedSalt=e.escapedSalt,t.salt.crystallized=e.crystallized,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*$.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*$.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Ir*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,Vs,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);if(this.sort(n,1),this.mixed&&this.cells(n,"cellHost","B"),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.mixed){for(let i=0;i<fd;i+=2)this.faces(n,"viscJacA"),this.faces(n,"viscJacB");this.faces(n,"viscForce")}this.cells(n,"liqAssemble"),this.solver.encodeMG(n,ml,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,pl,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubVent"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,xl,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffOut"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),this.salty&&(this.parts(n,"saltCryst","A"),this.cells(n,"gasApply")),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,gl,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),this.salty&&(this.cells(n,"saltSums","A"),this.cells(n,"saltShare","A")),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*gs,n=s+4*Qs,i=n+4*Ae*t.d.nreg,r=i+4*xe*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],c=r+4*Zs*a,l=c+4*64,u=l+8*Vs;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:c,ts:l,total:u}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(c=>!this.busy.has(c)&&c.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*gs),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Qs),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Ae*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*xe*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*Vs),t.clearBuffer(s.cnt,4*Pc,4*(Eu-Pc)),t.clearBuffer(s.cnt,4*$.VMAXP,4*4),t.clearBuffer(s.cnt,4*$.ESC_OTHER,4*3),this.busy.add(i);const a=[];for(let c=0;c<this.cpu.regions.count;c+=1)a.push(s.gpuRegion(c));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,gs),r=new Float32Array(t,n.cnt,gs),a=new Float32Array(t,n.glob,Qs),c=new Float32Array(t,n.reg,Ae*e.nreg),l=new Float32Array(t,n.heat,xe*e.nheat),u=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[h,m,p]=e.groups,d=(F,T,A)=>{let b=0;for(let k=0;k<T;k+=1)b+=u[(F+k)*Zs+A];return b},g=[];for(const F of e.regions){const T=Ae*F;g.push({p0:c[T+Xt.P0],sealed:c[T+Xt.OPEN]===0,vGas:c[T+Xt.VGAS],vFluid:c[T+Xt.VFLUID]})}const x=[];for(let F=0;F<e.heaters;F+=1){const T=xe*F;x.push({P:l[T+Gt.P],Tmean:l[T+Gt.TMEAN],integral:l[T+Gt.INTEGRAL],cells:l[T+Gt.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,Vs);w=[];for(let T=0;T<ps;T+=1){const A=F[2*T],b=F[2*T+1];w.push(b>A&&A>0n?Number(b-A)/1e6:0)}}const y=r[$.SUM_WM],_={};for(const[F,T,A]of Xc)_[F]=A==="f"?r[T]:i[T];return{intervals:_,ov:[r[$.OV_PMAX],r[$.OV_VMAX],r[$.OV_VLIQ]],pcount:i[$.PCOUNT],bcount:i[$.BCOUNT],dt:a[Gs.DT],stepsSince:i[$.STEPS],simSince:r[$.SIMTIME],itL:i[$.IT_L],itG:i[$.IT_G],itH:i[$.IT_H],itD:i[$.IT_D],capL:i[$.CAP_L],capG:i[$.CAP_G],capH:i[$.CAP_H],capD:i[$.CAP_D],resL:r[$.RES_L],resG:r[$.RES_G],resH:r[$.RES_H],nsub:i[$.NSUBMAX],uMaxG:r[$.UMAXG],waterMass:y,waterT:y>0?r[$.SUM_WMT]/y:0,waterTmax:r[$.TMAX],solids:d(0,h,0),film:d(0,h,1),gas:d(0,h,2),vapour:d(0,h,3),fog:d(0,h,4),air:d(0,h,5),liquidCells:Math.round(d(0,h,6)),gasCells:Math.round(d(0,h,7)),liquidH:d(h,m,0),liquidMass:d(h,m,1),sensible:d(h,m,3),otherMass:d(h,m,4),otherMT:d(h,m,5),saltLiquid:d(h,m,6),crust:d(0,h,8),floor:d(0,h,9),floorH:d(0,h,10),bubH:d(h+m,p,0),bubWater:d(h+m,p,1),bubAir:d(h+m,p,2),regions:g,heaters:x,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[$.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[$.FIRST_SH]!==0?r[$.FIRST_SH]-1e3:null,stageMs:w,vmaxP:r[$.VMAXP],rmaxB:r[$.RMAXB],slowed:i[$.SLOWED],vented:r[$.VENTED]}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of Xc)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD,e.slowed+=t.slowed,e.vented+=t.vented;const s=(n,i,r,a,c,l)=>{if(i===0&&r===0)return n;const u=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(c,Math.max(a,n>u?Math.max(u,n-2):u))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:i.escapedOther,editOther:e.ledger.other,escapedSalt:i.escapedSalt,editSalt:e.ledger.salt,bodyWork:0},c=this.energy0??r.energy,l=this.water0??r.water.total,u=r.energy-c-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),f=r.water.total-l-a.editWater,h=r.other.total-(this.other0??r.other.total)-a.editOther,m=r.salt.total-(this.salt0??r.salt.total)-a.editSalt,p=i.produced+i.burstVapour,d=i.time-this.vapourLast;d>.2&&(this.vapourRate=(p-this.vapourMark)/d,this.vapourMark=p,this.vapourLast=i.time);const g=e.heat.heaters.map((y,_)=>({h:y,k:_,rd:n==null?void 0:n.heaters[_]})).filter(({rd:y,h:_})=>((y==null?void 0:y.cells)??_.cells)>0).map(({h:y,rd:_})=>({group:y.group,P:(_==null?void 0:_.P)??y.P,Tmean:(_==null?void 0:_.Tmean)??y.Tmean,mode:y.mode,power:y.power,target:y.target,on:y.on})),x=(y,_,F)=>({iterations:y,residual:_,capped:F>0}),w=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:x((w==null?void 0:w.itL)??0,(w==null?void 0:w.resL)??0,(w==null?void 0:w.capL)??0),gas:x((w==null?void 0:w.itG)??0,(w==null?void 0:w.resG)??0,(w==null?void 0:w.capG)??0),heat:x((w==null?void 0:w.itH)??0,(w==null?void 0:w.resH)??0,(w==null?void 0:w.capH)??0),gasSubsteps:(w==null?void 0:w.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:(n==null?void 0:n.otherMass)??0,otherT:n!==null&&n.otherMass>0?n.otherMT/n.otherMass:0,saltMass:(n==null?void 0:n.saltLiquid)??0,saltSolid:((n==null?void 0:n.crust)??0)+((n==null?void 0:n.floor)??0),bodies:{count:this.cpu.bodies.list.filter(y=>!y.gone).length,free:0,awake:0},heaters:g,regions:((n==null?void 0:n.regions)??[]).map(y=>({p0:y.p0,sealed:y.sealed,vGas:y.vGas})),budget:r,flows:a,energyError:u,waterError:f,otherError:h,saltError:m,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:{...e.extremes.stats(),slowed:i.slowed,vented:i.vented},cpuOnly:!1}}budget(){const t=this.last,e=this.totals;let s=0;for(const u of(t==null?void 0:t.regions)??[])u.sealed&&(s-=u.p0*u.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=((t==null?void 0:t.solids)??0)+((t==null?void 0:t.floorH)??0),r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,c={liquid:(t==null?void 0:t.liquidMass)??0,ice:0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater},l=(t==null?void 0:t.otherMass)??0;return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:c,other:{liquid:l,escaped:e.escapedOther,total:l+e.escapedOther},salt:this.saltBudget(),air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}saltBudget(){const t=this.last,e=(t==null?void 0:t.saltLiquid)??0,s=(t==null?void 0:t.crust)??0,n=(t==null?void 0:t.floor)??0,i=this.totals.escapedSalt;return{liquid:e,crust:s,grains:0,floor:n,escaped:i,total:e+s+n+i}}resetTotals(){Object.assign(this.totals,Yc()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water,this.other0=t.other.total-s.ledger.other,this.salt0=t.salt.total-s.ledger.salt}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}function ud(o,t,e,s,n){const i=-n,r=-n,a=o+2*n,c=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/c>l){const f=a/l;return{x0:i,y0:r-(f-c)/2,x1:i+a,y1:r-(f-c)/2+f}}const u=c*l;return{x0:i-(u-a)/2,y0:r,x1:i-(u-a)/2+u,y1:r+c}}const on=self,Ot=o=>on.postMessage(o),Zc=8,hd=.1,dd=3,Jc=200,md=.25,ta=273.15;let ct=null,nt=null,ts=null,Hi=null,Ne=null,Js="",_i=1,Ai=1,Ti=1,cn={x0:0,y0:0,x1:1,y1:1},an={left:!0,right:!0,bottom:!0,top:!1},Ts=!1,oo=1,ms="none",vl=!1,Qe=0,tn=0,Gi=0,Br=0,Rr=!1,Nn=0,ea=0,co=0,ao=0,sa=!1,lo=0,Ws=null,fo=null;const us=[],uo=[];let $i=!1;const en=[];function Oo(){if(ct===null)return;const o=ct.scene.sides;an={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function qo(o,t,e){_i=Math.max(1,o),Ai=Math.max(1,t),Ti=Math.max(.5,Math.min(3,e)),Ne!==null&&(Ne.width=Math.round(_i*Ti),Ne.height=Math.round(Ai*Ti)),ct!==null&&(cn=ud(ct.boxW,ct.boxH,_i,Ai,.006))}function yl(o){ts!==null&&(ts.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function hs(o){uo.push(o),$i||pd()}async function pd(){if(nt!==null){$i=!0;try{for(;uo.length>0;){const o=uo.shift();await nt.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Ot({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{$i=!1,tn=performance.now()}}}async function ki(){if(nt===null)return;const o=nt.ctx.device.createCommandEncoder(),t=nt.encodeReadback(o,!1);nt.ctx.device.queue.submit([o.finish()]),t!==null&&await nt.finishReadback(t,!1),nt.baselineFromLast()}function Wi(){return ct===null||!ct.needsCpu()?!1:(Ot({type:"gpu",ok:!1,adapter:Js,message:"cpu-only",scene:ct.serialize()}),!0)}function Ki(o){nt!==null&&ts!==null&&nt.stateVersion!==o&&ts.reset()}function Er(){hs(async()=>{if(nt===null||ct===null||en.length===0)return;const o=en.splice(0,en.length);await ki(),await nt.download();for(const e of o){const s=ct.apply(e);s!==null&&s.startsWith("refused")&&Ot({type:"refused",message:s})}if(Wi())return;const t=nt.stateVersion;nt.upload(),Ki(t)})}function gd(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(ms==="temperature")return[ta+ve[0],ta+ve[1],e];if(ms==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return ms==="velocity"?[0,Math.max(.02,t[1]),e]:ms==="vapour"?[0,.6,e]:ms==="salt"?[0,So,e]:[0,1,e]}function xd(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return Ws={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},Ws}return Ws!==null&&(t.fate===1||t.fate===2)?{...Ws,fate:t.fate===1?"burst":"collapsed"}:null}function vd(o,t){if(nt===null||Hi===null)return;if(nt.baselineFromLast(),ct!==null&&o.stepsSince>0){ct.extremes.observe(o.rmaxB,o.vmaxP,nt.totals.time);const i=ct.extremes.take();i!==null&&(Ts=!0,Qe=0,Gi=0,Ot({type:"extreme",event:i}))}if(nt.totals.time>=lo){const i=Hi.sample();i!==null&&(us.push(i),us.length>400&&us.splice(0,us.length-400),lo=nt.totals.time+md)}const e=Math.max(.001,(t-Nn)/1e3),s=(o.stageMs??nt.stageMs).reduce((i,r)=>i+r,0),n={engine:nt.stats(s),stepsPerSecond:ao/e,simRate:(nt.totals.time-ea)/e,fps:co/e,renderMs:0,mode:"gpu",adapter:Js,paused:Ts,samples:us.splice(0,us.length),bubble:xd(o),object:fo!==null&&ct!==null?K0(ct,fo):null,overlayScale:gd(o)};Ot({type:"stats",stats:n}),co=0,ao=0,ea=nt.totals.time,Nn=t}function ho(){var t;const o=performance.now();if(nt!==null&&ts!==null&&Ne!==null&&ct!==null&&!$i){const e=nt.ctx.device,s=tn===0?0:Math.min(.1,(o-tn)/1e3);tn=o;const n=((t=nt.last)==null?void 0:t.dt)??ct.dt;let i=0;Ts?(i=Math.min(Zc,Gi),Gi-=i,Qe=0):(Qe=Math.min(Qe+s*oo,hd*Math.max(1,oo)),i=Br>=dd?0:Math.min(Zc,Math.floor(Qe/Math.max(1e-5,n))),Qe-=i*n);const r=!Rr&&o-Nn>Jc&&(i>0||Ts||o-Nn>4*Jc),a=e.createCommandEncoder();i>0&&nt.encodeSteps(a,i,r);const c=r?nt.encodeReadback(a,r&&i>0):null;if(ts.encode(a,cn,Ne.width,Ne.height,an,ms,vl),e.queue.submit([a.finish()]),Br+=1,e.queue.onSubmittedWorkDone().then(()=>{Br-=1}),ao+=i,co+=1,c!==null){Rr=!0;const l=i>0;nt.finishReadback(c,l).then(u=>{Rr=!1,u!==null&&vd(u,performance.now())})}}typeof on.requestAnimationFrame=="function"?on.requestAnimationFrame(ho):setTimeout(ho,16)}async function yd(o){if(ct=new Ru(o.scene),Ts=o.paused===!0,Wi())return;if(Ne=o.canvas,Ne===null)throw new Error("no OffscreenCanvas");nt=await Co.create(ct),Js=await(async()=>{var e;try{const s=await((e=on.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),ts=new ad(nt,Ne),await ts.init(),yl(o.dark),Hi=new il(nt),nt.ctx.device.addEventListener("uncapturederror",e=>Ot({type:"error",message:`WebGPU: ${e.error.message}`})),nt.ctx.device.lost.then(e=>Ot({type:"gpu",ok:!1,adapter:Js,message:e.message||e.reason})),Oo(),qo(o.width,o.height,o.dpr),Ot({type:"gpu",ok:!0,adapter:Js,message:""}),Ot({type:"ready",offscreen:!0,warnings:ct.warnings,view:cn,quality:ct.currentQuality,walls:an}),Nn=performance.now(),tn=performance.now(),sa||(sa=!0,ho())}function Dr(){if(nt===null||ct===null)return;const o=nt.stateVersion;nt.cpu=ct,nt.rebuild(),nt.resetTotals(),Ki(o),Hi=new il(nt),lo=0,us.length=0,Qe=0,Ws=null,Oo(),qo(_i,Ai,Ti),Ot({type:"view",view:cn,walls:an})}on.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Ot({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&on.navigator.gpu!==void 0});break;case"init":yd(t).catch(e=>Ot({type:"gpu",ok:!1,adapter:Js,message:e instanceof Error?e.message:String(e)}));break;case"resize":qo(t.width,t.height,t.dpr),Ot({type:"view",view:cn,walls:an});break;case"op":en.push(t.op),Er();break;case"addLiquid":en.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Er();break;case"addSolid":en.push({op:"solid",region:t.region,material:t.material,T:t.T}),Er();break;case"setHeater":ct==null||ct.setHeater(t.group,t.mode,t.power,t.target,t.on),nt==null||nt.writeHeater(t.group);break;case"setAmbient":ct==null||ct.setAmbient(t.p,t.T,t.rh,t.g,t.air),nt==null||nt.writeParams();break;case"setBoundary":hs(async()=>{if(nt===null||ct===null)return;await ki(),await nt.download(),ct.setBoundary(t.side,t.value);const e=nt.stateVersion;nt.upload(),Ki(e),Oo(),Ot({type:"view",view:cn,walls:an})});break;case"query":hs(async()=>{if(nt===null||ct===null){Ot({type:"reply",id:t.id,data:null});return}await ki(),await nt.download(),Ot({type:"reply",id:t.id,data:ct.query(t.x,t.y)})});break;case"select":Ws=null,nt==null||nt.watch(t.bubble);break;case"overlay":ms=t.overlay;break;case"particles":vl=t.on;break;case"pause":Ts=t.paused,Qe=0,tn=performance.now();break;case"step":Ts&&(Gi+=1);break;case"setSpeed":oo=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":ct==null||ct.setExtremes(t.mode),nt==null||nt.writeParams();break;case"setQuality":hs(async()=>{ct!==null&&(ct.setQuality(t.quality),Dr())});break;case"serialize":nt===null?Ot({type:"reply",id:t.id,data:(ct==null?void 0:ct.serialize())??null}):hs(async()=>{Ot({type:"reply",id:t.id,data:(ct==null?void 0:ct.serialize())??null})});break;case"load":hs(async()=>{ct!==null&&(ct.load(t.scene),!Wi()&&Dr())});break;case"selectObject":fo=t.object;break;case"editObject":hs(async()=>{if(nt===null||ct===null){Ot({type:"reply",id:t.id,data:null});return}await ki(),await nt.download();const e=W0(ct,t.object,t.patch);if(Ot({type:"reply",id:t.id,data:e}),Wi())return;if(e.rebuilt){Dr();return}const s=nt.stateVersion;nt.upload(),Ki(s)});break;case"theme":yl(t.dark);break;case"frameDone":break}}catch(e){Ot({type:"error",message:e instanceof Error?e.message:String(e)})}});
