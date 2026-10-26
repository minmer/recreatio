var Nf=Object.defineProperty;var Df=(o,t,e)=>t in o?Nf(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var x=(o,t,e)=>Df(o,typeof t!="symbol"?t+"":t,e);const Ac=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Ds(o){if(o===null||typeof o!="object")return null;const t=o,e=(c,a)=>{if(!Array.isArray(c)||c.length!==a)return null;const l=c.map(Ac);return l.every(d=>d!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const c=t.poly.map(a=>e(a,2));if(c.every(a=>a!==null))return{poly:c.map(a=>[a[0],a[1]])}}const i=e(t.line,4),r=Ac(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function Xe(o,t,e){if("rect"in o){const[m,p,h,g]=o.rect;return t>=m&&t<=h&&e>=p&&e<=g}if("circle"in o){const[m,p,h]=o.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=h*h}if("poly"in o){const m=o.poly;let p=!1;for(let h=0,g=m.length-1;h<m.length;g=h,h+=1){const[v,w]=m[h],[b,_]=m[g];w>e!=_>e&&t<(b-v)*(e-w)/(_-w)+v&&(p=!p)}return p}const[s,n,i,r]=o.line,c=i-s,a=r-n,l=c*c+a*a,d=l>0?Math.max(0,Math.min(1,((t-s)*c+(e-n)*a)/l)):0,f=t-(s+d*c),u=e-(n+d*a);return f*f+u*u<=.25*o.width*o.width}function Tn(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,c,a]=o.circle;return[r-a,c-a,r+a,c+a]}if("poly"in o){let r=1/0,c=1/0,a=-1/0,l=-1/0;for(const[d,f]of o.poly)r=Math.min(r,d),c=Math.min(c,f),a=Math.max(a,d),l=Math.max(l,f);return[r,c,a,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Us(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const Uf={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Vf=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],Gf=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],Hf={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},$f=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var Wf={ambient:Uf,species:Vf,solutes:Gf,vapourInAir:Hf,solids:$f};const Dt=8.314462618,Lr=9.80665,zn=101325,nt=273.15,rr=1602176634e-28,ml=1380649e-29,pl=602214076e15,gl=88541878128e-22,H=0,it=1,pt=2,at=0,lt=1,Q=2,ft=6,Ft=3,Mt=Wf,Vt=Mt.species[0],Mn=Mt.species[1],Bn=Mt.species[2],gt=new Float64Array(ft);gt[at]=Mn.molarMass.v;gt[lt]=Bn.molarMass.v;gt[Q]=Vt.molarMass.v;Mn.name,Bn.name,Vt.vapour.name;const tc=Mn.gas.cp.v,ec=Bn.gas.cp.v,[Yn,Xn,as]=Vt.vapour.cp.linear;function Kf(o,t){return o===Q?Yn+Xn*(t-as):o===at?tc:o===lt?ec:0}const ms=Vt.liquid.kell.c,hi=Vt.liquid.cp.table,Et=new Float64Array(hi.map(o=>o[0])),Ut=new Float64Array(hi.map(o=>o[1])),le=new Float64Array(hi.length);le[0]=Ut[0]*(Et[0]-nt);for(let o=1;o<hi.length;o+=1)le[o]=le[o-1]+.5*(Ut[o]+Ut[o-1])*(Et[o]-Et[o-1]);const zt=hi.length-1;function bl(o){if(o<Et[0])return-1;if(o>=Et[zt])return zt;let t=Math.min(zt-1,Math.max(0,Math.floor((o-nt)/10)));for(;t>0&&o<Et[t];)t-=1;for(;t<zt-1&&o>=Et[t+1];)t+=1;return t}function Re(o){const t=bl(o);return t<0?Ut[0]:t===zt?Ut[zt]:Ut[t]+(Ut[t+1]-Ut[t])*(o-Et[t])/(Et[t+1]-Et[t])}function Pt(o){const t=bl(o);if(t<0)return le[0]+Ut[0]*(o-Et[0]);if(t===zt)return le[zt]+Ut[zt]*(o-Et[zt]);const e=o-Et[t],s=(Ut[t+1]-Ut[t])/(Et[t+1]-Et[t]);return le[t]+Ut[t]*e+.5*s*e*e}function xl(o){if(o<le[0])return Et[0]+(o-le[0])/Ut[0];if(o>=le[zt])return Et[zt]+(o-le[zt])/Ut[zt];let t=Math.min(zt-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<le[t];)t-=1;for(;t<zt-1&&o>=le[t+1];)t+=1;const e=(Ut[t+1]-Ut[t])/(Et[t+1]-Et[t]),s=o-le[t],n=Ut[t];return Et[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function _n(o){const t=o-nt;return(ms[0]+t*(ms[1]+t*(ms[2]+t*(ms[3]+t*(ms[4]+t*ms[5])))))/(1+ms[6]*t)}const Dr=Vt.liquid.k.poly;function Qn(o){const t=Math.min(150,Math.max(0,o-nt));return Dr[0]+t*(Dr[1]+t*Dr[2])}const[zf,Yf,kc]=Vt.liquid.mu.vogel;function Os(o){return zf*Math.pow(10,Yf/(Math.max(o,kc+60)-kc))}const Ur=Vt.surfaceTension,Xf=Vt.saturation.Tc.v;function mi(o){const t=Math.max(0,1-o/Xf);return Ur.B*Math.pow(t,Ur.mu)*(1+Ur.b*t)}const Qf=Vt.saturation.hlv100.v,Zn=nt+100,vl=Pt(Zn)+Qf,Zf=Vt.vapour.k.v,Jf=Vt.vapour.mu.v;function vt(o){const t=o-as,e=Zn-as;return vl+Yn*(o-Zn)+.5*Xn*(t*t-e*e)}function sc(o){return vt(o)-Pt(o)}function fe(o,t){return o===Q?vt(t):Kf(o,t)*(t-nt)}const Vr=Mn.gas.k.power,Gr=Bn.gas.k.power,t0=Mn.gas.mu.sutherland,e0=Bn.gas.mu.sutherland,Hr=Mt.vapourInAir,yl=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),wl=150,or=1001,pi=o=>{const t=new Float64Array(or);for(let e=0;e<or;e+=1)t[e]=o(wl+e);return t},Bs=(o,t)=>{let e=t-wl;e>0?e>or-1.001&&(e=or-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Sc=pi(o=>Vr[0]*Math.pow(o/Vr[1],Vr[2])),s0=pi(o=>Gr[0]*Math.pow(o/Gr[1],Gr[2])),Tc=pi(o=>yl(t0,o)),n0=pi(o=>yl(e0,o)),i0=pi(o=>Hr.D0.v*Math.pow(o/Hr.T0.v,Hr.exponent.v));function nc(o,t,e,s){const n=o+t+e;return n>0?(o*Bs(Sc,s)+t*Bs(s0,s)+e*Zf)/n:Bs(Sc,s)}function _l(o,t,e,s){const n=o+t+e;return n>0?(o*Bs(Tc,s)+t*Bs(n0,s)+e*Jf)/n:Bs(Tc,s)}function r0(o,t){return Bs(i0,o)*(zn/t)}function Fl(o,t,e,s){const n=o*tc+t*ec,i=Zn-as,r=.5*e*Xn,c=n+e*Yn;if(c<=0)return nt;const a=n*(as-nt)+e*(vl+Yn*(as-Zn)-.5*Xn*i*i)-s,l=c*c-4*r*a;return as+-2*a/(c+Math.sqrt(l>0?l:0))}function Ao(o,t,e,s,n){return o*tc+t*ec+e*(Yn+Xn*(n-as))+(s>0?s*Re(n):0)}const o0=Mt.ambient.air.N2.v,c0=Mt.ambient.air.O2.v,Pl=Mt.ambient.hExt.v,dt=Mt.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function cn(o){return dt.findIndex(t=>t.id===o)}const ut=0,Al=Mt.species.slice(3),Mc=[null,...Al.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*nt+.5*s*nt*nt}})],re=[{id:Vt.id,name:Vt.name,short:Vt.liquid.name,color:Vt.liquid.color,volatile:!0,range:[nt,nt+150]},...Al.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function kl(o){return re.findIndex(t=>t.id===o)}const Ns=o=>Mc[o]??Mc[1];function ic(o,t){if(o===ut)return Re(t);const e=Ns(o);return e.cA+e.cB*t}function a0(o,t){if(o===ut)return Pt(t);const e=Ns(o);return e.cA*t+.5*e.cB*t*t-e.h0}function l0(o,t){if(o===ut)return xl(t);const e=Ns(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function qs(o,t){if(o===ut)return _n(t);const e=Ns(o);return e.rA+e.rB*t}function Vn(o,t){if(o===ut)return Qn(t);const e=Ns(o);return e.kA+e.kB*t}function Jn(o,t){if(o===ut)return Os(t);const e=Ns(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function un(o,t){return o===ut?mi(t):Ns(o).sigma}Vt.thermo,Mn.thermo,Bn.thermo;const gi=Mt.species[0].saturation,je=gi.if97.n,Sl=je[0],Tl=je[1],Ml=je[2],Bl=je[3],Cl=je[4],Ll=je[5],Ol=je[6],ql=je[7],El=je[8],ko=je[9],Gn=gi.Tc.v,f0=gi.rhoc.v,cr=273.15,Vs=gi.vapourDensity.c;gi.liquidDensity.b;function Or(o){const t=o<cr?cr:o>Gn?Gn:o,e=t+El/(t-ko),s=e*e+Sl*e+Tl,n=Ml*e*e+Bl*e+Cl,i=Ll*e*e+Ol*e+ql,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+Ml*e+Ll,n=Sl*e*e+Bl*e+Ol,i=Tl*e*e+Cl*e+ql,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),c=ko+r;return(c-Math.sqrt(c*c-4*(El+ko*r)))/2}function Rl(o){const e=1-(o<cr?cr:o>Gn?Gn:o)/Gn,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,c=r*r*n,a=c*c*s,l=a*c*r*r;return f0*Math.exp(Vs[0]*n+Vs[1]*i+Vs[2]*r+Vs[3]*c+Vs[4]*a+Vs[5]*l)}const ar=250,lr=.01,bi=25001,$i=new Float64Array(bi),Wi=new Float64Array(bi);for(let o=0;o<bi;o+=1)$i[o]=Or(ar+o*lr),Wi[o]=Rl(ar+o*lr);function ti(o){const t=(o-ar)/lr;if(!(t>=0)||t>=bi-1)return Or(o);const e=t|0;return $i[e]+(t-e)*($i[e+1]-$i[e])}function Oe(o){const t=(o-ar)/lr;if(!(t>=0)||t>=bi-1)return Rl(o);const e=t|0;return Wi[e]+(t-e)*(Wi[e+1]-Wi[e])}const Yt=Mt.solutes[0],Il=Mt.species[0],qr=Il.molarMass.v,Qe=Yt.molarMass.v,u0=Yt.ions.v,xi=1,Er=Mt.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function jl(o){return Er.findIndex(t=>t.id===o)}function d0(o){return o>0?o/((1-o)*Qe):0}function Nl(o){return o>0?o*Qe/(1+o*Qe):0}const _e=298.15,vi=Yt.pitzer,h0=vi.b0.a,m0=vi.b1.a,p0=vi.c.a,g0=vi.b.v,b0=vi.alpha.v,Ki=Yt.pitzerCold,x0=Ki.below.v;function $r(o,t){return o[0]+o[1]*(1/t-1/_e)+o[2]*Math.log(t/_e)+o[3]*(t-_e)+o[4]*(t*t-_e*_e)+o[5]*(1/(t*t)-1/(_e*_e))}const Ai=Yt.dielectric.c;function v0(o){const t=o-nt;return Ai[0]+t*(Ai[1]+t*(Ai[2]+t*Ai[3]))}function y0(o){const t=rr*rr/(4*Math.PI*gl*v0(o)*ml*o);return Math.sqrt(2*Math.PI*pl*_n(o))*t*Math.sqrt(t)/3}function w0(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<x0,n=$r(s?Ki.b0.a:h0,o),i=$r(s?Ki.b1.a:m0,o),r=$r(s?Ki.c.a:p0,o);return 1-y0(o)*e/(1+g0*e)+t*(n+i*Math.exp(-b0*e))+t*t*r}function fr(o,t){return t>0?Math.exp(-u0*t*w0(o,t)*qr):1}const Dl=240,ur=221,Ul=.05,rs=181;let Wr=null;function _0(){if(Wr!==null)return Wr;const o=new Float64Array(ur*rs);for(let t=0;t<ur;t+=1)for(let e=0;e<rs;e+=1)o[t*rs+e]=fr(Dl+t,e*Ul);return Wr=o,o}function Vl(o,t){if(!(t>0))return 1;const e=t/Ul;if(e>=rs-1)return fr(o,t);const s=_0();let n=o-Dl;n>0?n>ur-1.000001&&(n=ur-1.000001):n=0;const i=n|0,r=e|0,c=n-i,a=e-r,l=i*rs+r,d=s[l]+a*(s[l+1]-s[l]),f=s[l+rs]+a*(s[l+rs+1]-s[l+rs]);return d+c*(f-d)}function rc(o,t){let e=kt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(o/Vl(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Rr=Il.fusion,ue=Rr.T.v,oc=Rr.h.v,F0=Rr.cpIce.v;Rr.rhoIce.v;function P0(o){const t=Re(ue)-F0;return qr/Dt*((oc-t*ue)*(1/ue-1/o)+t*Math.log(o/ue))}const A0=Yt.eutectic.T.v,k0=Yt.eutectic.w.v;function Gl(o){if(!(o>0))return ue;if(Nl(o)>=k0)return A0;const t=s=>Math.log(fr(s,o))-P0(s);let e=ue+Math.log(fr(ue,o))*Dt*ue*ue/(qr*oc);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return ue;if(Math.abs(r)<1e-9)break}return e}const Ze=Yt.solubility.table;function S0(o){if(o<=Ze[0][0])return Ze[0][1];for(let t=1;t<Ze.length;t+=1)if(o<=Ze[t][0]){const[e,s]=Ze[t-1],[n,i]=Ze[t];return s+(i-s)*(o-e)/(n-e)}return Ze[Ze.length-1][1]}function Hl(o){return Nl(S0(o))}const cc=Yt.solid.rho.v,ds=Yt.solid.cp.v;function yi(o){return ds*(o-nt)}const On=Yt.density.laliberte;function T0(o,t){const e=o-nt,s=e+On[4];return(On[0]*t+On[1])*Math.exp(1e-6*s*s)/(t+On[2]+On[3]*e)}function Ir(o,t){return t>0?1/((1-t)/_n(o)+t/T0(o,t)):_n(o)}const Cn=Yt.cp.laliberte,jr=Cn[0],M0=Cn[1],B0=Cn[2],ei=Cn[3],ac=Cn[4],si=Cn[5],Es=Yt.cp.range.lo,dr=Yt.cp.range.hi,Cs=.5,ze=Math.round((dr-Es)/Cs)+1,ne=new Float64Array(ze),ni=new Float64Array(ze);for(let o=0;o<ze;o+=1){const t=Es+o*Cs-nt;ne[o]=Math.exp(M0*t+B0*Math.exp(.01*t))}ni[0]=ne[0]*(Es-nt);for(let o=1;o<ze;o+=1)ni[o]=ni[o-1]+.5*(ne[o-1]+ne[o])*Cs;function $l(o){if(o<=Es)return ne[0];if(o>=dr)return ne[ze-1];const t=(o-Es)/Cs,e=Math.min(ze-2,t|0);return ne[e]+(t-e)*(ne[e+1]-ne[e])}function wi(o){if(o<=Es)return ne[0]*(o-nt);if(o>=dr)return ni[ze-1]+ne[ze-1]*(o-dr);const t=(o-Es)/Cs,e=Math.min(ze-2,t|0),s=(t-e)*Cs;return ni[e]+ne[e]*s+.5*(ne[e+1]-ne[e])*s*s/Cs}const lc=o=>1e3*jr*o*Math.exp(ei*o),fc=o=>1e3*ac*Math.pow(o,si+1),uc=Yt.dHsol.v/Qe+yi(_e)-1e3*jr*wi(_e);function Wl(o,t){return t>0?(1-t)*Pt(o)+t*uc+lc(t)*wi(o)+fc(t)*(o-nt):Pt(o)}function C0(o,t){return t>0?(1-t)*Re(o)+lc(t)*$l(o)+fc(t):Re(o)}function L0(o,t,e){if(!(t>0))return xl(o);const s=lc(t),n=fc(t),i=t*uc,r=1-t;let c=e>200&&e<900?e:nt+(o-i)/(4e3*r+800*t);for(let a=0;a<30;a+=1){const d=(r*Pt(c)+i+s*wi(c)+n*(c-nt)-o)/(r*Re(c)+s*$l(c)+n);if(c-=d,Math.abs(d)<1e-8)break}return c}function Bc(o,t){const e=Math.exp(ei*t),s=1e3*jr*e*(t+(1-t)*(1+ei*t)),n=t>0?1e3*ac*Math.pow(t,si)*(t+(1-t)*(si+1)):0;return uc+s*wi(o)+n*(o-nt)}const O0=Yt.diffusivity.v,q0=Os(_e);function So(o){return O0*(o/_e)*q0/Os(o)}function dn(o,t){return t>0?Pt(o)-1e3*jr*ei*t*t*Math.exp(ei*t)*wi(o)-1e3*ac*si*Math.pow(t,si+1)*(o-nt):Pt(o)}var fl;const qe=[{id:"NaCl",rho:cc,cp:ds,color:((fl=Er[0])==null?void 0:fl.color)??"#f4f3ee",dissolves:!0,repose:34}];function Kl(o){return qe.findIndex(t=>t.id===o)}const E0=.58,R0=5e-4;class I0{constructor(t){x(this,"cap");x(this,"count",0);x(this,"nextId",1);x(this,"x");x(this,"y");x(this,"vx");x(this,"vy");x(this,"m");x(this,"m0");x(this,"N");x(this,"T");x(this,"mat");x(this,"dry");x(this,"wet");x(this,"id");this.cap=t,this.x=new Float64Array(t),this.y=new Float64Array(t),this.vx=new Float64Array(t),this.vy=new Float64Array(t),this.m=new Float64Array(t),this.m0=new Float64Array(t),this.N=new Float64Array(t),this.T=new Float64Array(t),this.mat=new Uint8Array(t),this.dry=new Uint8Array(t),this.wet=new Float64Array(t),this.id=new Uint32Array(t)}add(t,e,s,n,i,r){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.m[c]=s,this.m0[c]=s,this.N[c]=n,this.T[c]=i,this.mat[c]=r,this.dry[c]=1,this.wet[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,c}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.m[t]=this.m[e],this.m0[t]=this.m0[e],this.N[t]=this.N[e],this.T[t]=this.T[e],this.mat[t]=this.mat[e],this.dry[t]=this.dry[e],this.wet[t]=this.wet[e],this.id[t]=this.id[e]),this.count=e}rho(t){return qe[this.mat[t]].rho}cp(t){return qe[this.mat[t]].cp}diameter(t){return Math.cbrt(6*this.m[t]/(this.N[t]*Math.PI*this.rho(t)))}enthalpy(t){return this.m[t]*this.cp(t)*(this.T[t]-nt)}totals(){let t=0,e=0;for(let s=0;s<this.count;s+=1)qe[this.mat[s]].dissolves&&(t+=this.m[s]),e+=this.enthalpy(s);return{salt:t,energy:e}}clear(){this.count=0}}const To="recreatio/lab2d",j0=o=>o==="ask"||o==="compute"||o==="normalize",N0={"very-high":.001,high:.002,medium:.003},D0=o=>o==="very-high"||o==="high"||o==="medium",U0=16e4,Fn=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function qn(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const wt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Ot=(o,t,e)=>Math.min(e,Math.max(t,o)),Ps=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},ki=(o,t)=>o==="wall"||o==="open"?o:t,Cc=.25*Lr,Kr=2*Lr;function Lc(o){const t={};let e=0;for(const[s,n]of Object.entries(Ps(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function V0(o,t,e){const s=Ps(o),n=nt+wt(s.T,20),i=r=>{const c=typeof s.material=="string"?s.material:r;return cn(c)>=0?c:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Ds(s.region);if(r===null)break;const c=s.phase==="gas"?"gas":"liquid",a=Lc(s.composition),l=u=>c==="gas"?u==="N2"||u==="O2"||u==="H2O":kl(u)>=0||jl(u)>=0,d={};for(const[u,m]of Object.entries(a))l(u)?d[u]=m:t.push(`ops[${e}]: unknown ${c} "${u}" dropped`);const f=Object.keys(d).length>0?Lc(d):c==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:c,T:n,composition:f}}case"erase":{const r=Ds(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Ot(wt(s.dx,0),-1,1),c=Ot(wt(s.dy,0),-1,1),a=qn(s.id);if(a!=="")return{op:"move",region:null,id:a,dx:r,dy:c};const l=Ds(s.region);if(l===null)break;return{op:"move",region:l,id:null,dx:r,dy:c}}case"remove":{const r=qn(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=Ds(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:qn(s.id),x:wt(s.x,.1),y:wt(s.y,0),w:Ot(wt(s.w,.07),.01,1),h:Ot(wt(s.h,.09),.01,1),wall:Ot(wt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Ot(wt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:qn(s.id),x:wt(s.x,.1),y:wt(s.y,0),w:Ot(wt(s.w,.12),.005,1),h:Ot(wt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Ot(wt(s.power,40),0,2e3),target:nt+Ot(wt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Ot(wt(s.angle,0),-180,180)};case"body":{const r=Ds(s.region);if(r===null)break;return{op:"body",id:qn(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Ot(wt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:wt(s.x,0),y:wt(s.y,0),pinned:s.pinned!==!1};case"grains":{const r=Ds(s.region);if(r===null)break;const c=typeof s.material=="string"&&Kl(s.material)>=0;return s.material!==void 0&&!c&&t.push(`ops[${e}]: unknown grains "${String(s.material)}", using NaCl`),{op:"grains",region:r,material:c?s.material:"NaCl",d:Ot(wt(s.d,R0),5e-5,.005),T:n}}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function zl(o,t,e=new Set){const s=new Set(e);for(const i of o)Fn(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function G0(o,t){const e=new Set;for(const r of o)Fn(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>zl([],r,new Set([...s,...e])),i=[];return o.forEach((r,c)=>{if(Fn(r)){let a=r.id;if(a==="")a=n(r.op);else if(s.has(a)){const l=n(r.op);t.push(`ops[${c}]: the name "${a}" is used twice, renamed to "${l}"`),a=l}s.add(a),i.push({...r,id:a});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const a=r.id;if(!s.has(a)){t.push(`ops[${c}]: no object "${a}" before this step`);return}}i.push(r)}),i}function zi(o,t={}){const e=Ps(o),s=[];e.format!==void 0&&e.format!==To&&s.push(`format "${String(e.format)}" is not ${To}`);const n=Ps(e.box),i=Ps(e.ambient),r=Ps(i.air),c=Ps(e.sides),a=wt(i.g,Lr),l=t.harness===!0?Ot(a,0,Kr):Ot(a,Cc,Kr);l!==a&&s.push(`ambient.g ${a} m/s² is outside ${Cc.toFixed(2)}–${Kr.toFixed(2)}, using ${l.toFixed(2)}`);const d=wt(r.N2,.7676),f=wt(r.O2,.2324),u=d+f>0?d+f:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((h,g)=>{const v=V0(h,s,g);v!==null&&m.push(v)});const p=G0(m,s);return{scene:{seed:Math.floor(wt(e.seed,1))>>>0,box:{w:Ot(wt(n.w,.2),.02,.6),h:Ot(wt(n.h,.15),.02,.4),depth:Ot(wt(n.depth,.01),.002,.05)},ambient:{p:Ot(wt(i.p,zn/1e3),20,400)*1e3,T:nt+Ot(wt(i.T,20),-20,100),rh:Ot(wt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,d)/u,O2:Math.max(0,f)/u}},sides:{left:ki(c.left,"wall"),right:ki(c.right,"wall"),bottom:ki(c.bottom,"wall"),top:ki(c.top,"open")},quality:D0(e.quality)?e.quality:"high",extremes:j0(e.extremes)?e.extremes:"ask",ops:p},warnings:s}}const Rt=(o,t=6)=>Number(o.toFixed(t));function H0(o){switch(o.op){case"fill":return{op:"fill",region:Us(o.region),composition:{...o.composition},phase:o.phase,T:Rt(o.T-nt,3)};case"erase":return{op:"erase",region:Us(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:Rt(o.dx),dy:Rt(o.dy)}:{op:"move",region:Us(o.region),dx:Rt(o.dx),dy:Rt(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:Us(o.region),material:o.material,T:Rt(o.T-nt,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:Rt(o.T-nt,3),...o.lid?{lid:!0}:{},...Oc(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:Rt(o.target-nt,3),on:o.on,T:Rt(o.T-nt,3),...Oc(o)};case"body":return{op:"body",id:o.id,region:Us(o.region),material:o.material,T:Rt(o.T-nt,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:Rt(o.angle,4)}:{}};case"pin":return{op:"pin",x:Rt(o.x),y:Rt(o.y),pinned:o.pinned};case"grains":return{op:"grains",region:Us(o.region),material:o.material,d:Rt(o.d,7),T:Rt(o.T-nt,3)}}}const Oc=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:Rt(o.angle,4)}:{}});function Yl(o){return{format:To,version:1,seed:o.seed,box:{...o.box},ambient:{p:Rt(o.ambient.p/1e3,4),T:Rt(o.ambient.T-nt,3),rh:o.ambient.rh,g:Rt(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(H0)}}function $0(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,c)=>(r[0]-i[0])*(c[1]-i[1])-(r[1]-i[1])*(c[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const W0=1e-6;function Ie(o){var t;return((t=dt[o])==null?void 0:t.id)==="ice"?ue:NaN}function ks(o){return Ie(o)>0?Pt(ue)-dt[o].cp*(ue-nt)-oc:0}function Mo(o,t,e,s){return(o+e*ds)*(s-nt)+t*Pt(s)}function dc(o,t,e,s,n){const i=t+s*ds;if(!(i>0))return n;if(e<=0)return nt+o/i;let r=n>100?n:nt+o/i;for(let c=0;c<3;c+=1)r-=(i*(r-nt)+e*Pt(r)-o)/(i+e*Re(r));return r}class It{constructor(t,e,s,n){x(this,"mat",0);x(this,"heater",-1);x(this,"nr",0);x(this,"xs",[]);x(this,"ys",[]);x(this,"ni",new Int32Array(0));x(this,"nj",new Int32Array(0));x(this,"off",new Int32Array(0));x(this,"ncell",0);x(this,"E",new Float64Array(0));x(this,"film",new Float64Array(0));x(this,"crust",new Float64Array(0));x(this,"x",0);x(this,"y",0);x(this,"a",0);x(this,"vx",0);x(this,"vy",0);x(this,"w",0);x(this,"ux",0);x(this,"uy",0);x(this,"uw",0);x(this,"m",0);x(this,"I",0);x(this,"ma",0);x(this,"Ia",0);x(this,"ma6",new Float64Array(6));x(this,"maOk",!1);x(this,"pinned",!0);x(this,"asleep",!0);x(this,"gone",!1);x(this,"rest",0);x(this,"rx",0);x(this,"ry",0);x(this,"ra",0);x(this,"rmax",0);x(this,"hullA",0);x(this,"hullJ",0);x(this,"nseg",0);x(this,"segR",new Int32Array(0));x(this,"segS",new Uint8Array(0));x(this,"segT0",new Float64Array(0));x(this,"segT1",new Float64Array(0));x(this,"nw",0);x(this,"wk",new Int32Array(0));x(this,"wc",new Int32Array(0));x(this,"ww",new Float64Array(0));x(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,c,a=-1){const l=new It(t,e,s,n);l.mat=i,l.heater=a;const d=[],f=[];for(const[m,p,h,g]of r)!(h>m)||!(g>p)||(d.push(It.splits(m,h,s)),f.push(It.splits(p,g,s)));l.setRects(d,f);const u=dt[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=u.rho*u.cp*l.cellVolume(m)*(c-nt);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=dt[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return dc(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],c=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[c])continue;let a=0;for(;a<r-1&&t>n[a+1];)a+=1;let l=0;for(;l<c-1&&e>i[l+1];)l+=1;return this.off[s]+a+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=ks(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=dt[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const f=Math.cos(this.a),u=Math.sin(this.a),m=f*e-u*s,p=u*e+f*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const c=[];for(let f=0;f<this.nr;f+=1){const[u,m,p,h]=this.bounds(f),g=p-u,v=h-m,w=t*g*v*this.depth,b=.5*(u+p),_=.5*(m+h);n+=w,i+=w*((g*g+v*v)/12+b*b+_*_);for(const[F,k]of[[u,m],[p,m],[p,h],[u,h]])c.push([F,k]),r=Math.max(r,Math.hypot(F,k))}this.m=n,this.I=i,this.rmax=r;const a=$0(c);let l=0,d=0;for(let f=0;f<a.length;f+=1){const[u,m]=a[f],[p,h]=a[(f+1)%a.length],g=u*h-p*m;l+=g/2,d+=g*(u*u+u*p+p*p+m*m+m*h+h*h)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(d),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,c,a]=this.bounds(n),l=(c-i)*(a-r);e+=l,s+=l*(t===0?.5*(i+c):.5*(r+a))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=W0*this.dx;for(let r=0;r<this.nr;r+=1){const[c,a,l,d]=this.bounds(r);for(let f=0;f<4;f+=1){const u=f<2,m=f===0?c:f===1?l:f===2?a:d;let p=[u?[a,d]:[c,l]];for(let h=0;h<this.nr&&p.length>0;h+=1){if(h===r)continue;const[g,v,w,b]=this.bounds(h);if(!(f===0?Math.abs(w-m)<=i:f===1?Math.abs(g-m)<=i:f===2?Math.abs(b-m)<=i:Math.abs(v-m)<=i))continue;const F=u?v:g,k=u?b:w,P=[];for(const[y,A]of p){if(k<=y||F>=A){P.push([y,A]);continue}F>y&&P.push([y,F]),k<A&&P.push([k,A])}p=P}for(const[h,g]of p)g-h<=i||(t.push(r),e.push(f),s.push(h),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),c=this.segS[t],a=this.segT0[t],l=this.segT1[t];c===0?(e[0]=s,e[1]=a,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):c===1?(e[0]=i,e[1]=a,e[2]=i,e[3]=l,e[4]=1,e[5]=0):c===2?(e[0]=a,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=a,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const c=Math.cos(s),a=Math.sin(s),l=n-t,d=i-e;r[0]=c*l+a*d,r[1]=-a*l+c*d}static toWorld(t,e,s,n,i,r){const c=Math.cos(s),a=Math.sin(s);r[0]=t+c*n-a*i,r[1]=e+a*n+c*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,c=this.y-e;this.x=t+n*r-i*c,this.y=e+i*r+n*c,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let c=1/0,a=1/0,l=-1/0,d=-1/0;for(let f=0;f<this.nr;f+=1){const[u,m,p,h]=this.bounds(f);for(let g=0;g<4;g+=1){const v=g===0||g===3?u:p,w=g<2?m:h,b=t+i*v-r*w,_=e+r*v+i*w;b<c&&(c=b),b>l&&(l=b),_<a&&(a=_),_>d&&(d=_)}}n[0]=c,n[1]=a,n[2]=l,n[3]=d}}const Si=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function ii(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const se=[0,120],hc=.3;dt.map(o=>ii(o.color));var ul;ii(((ul=Er[0])==null?void 0:ul.color)??"#f4f3ee");const Xl=new Set([".e.bubbleModel.Fm",".e.bubbleModel.alphaTarget",".e.bubbleModel.budget",".e.bubbleModel.cells",".e.bubbleModel.dTb",".e.bubbleModel.head",".e.bubbleModel.next",".e.bubbleModel.tsatCell",".e.bubbleModel.wts",".e.exchange.cap",".e.exchange.capA",".e.exchange.capT",".e.exchange.cell",".e.exchange.cpp",".e.exchange.ds",".e.exchange.fH",".e.exchange.fS",".e.exchange.hs",".e.exchange.inH",".e.exchange.inS",".e.exchange.outH",".e.exchange.outS",".e.exchange.salt",".e.exchange.water",".e.gas.R.stack",".e.gas.queue",".e.gas.seen",".e.gas.gasU",".e.gas.gasV",".e.gas.lim",".e.gas.mover.conc",".e.gas.mover.fu",".e.gas.mover.fv",".e.gas.mover.outM",".e.gas.mover.scale",".e.gas.mu",".e.gas.nmol",".e.gas.u0",".e.gas.u1",".e.gas.v0",".e.gas.v1",".e.gas.veos",".e.gas.veosMid",".e.grid.Cl",".e.grid.Sg",".e.grid.Sl",".e.grid.Tl",".e.grid.phi",".e.grid.region",".e.grid.thin",".e.heat.C",".e.heat.CKo",".e.heat.CTl",".e.heat.Cg",".e.heat.Co",".e.heat.Cs",".e.heat.Tnew",".e.heat.Tstar",".e.heat.dE",".e.heat.gx",".e.heat.gy",".e.heat.k",".e.heat.q",".e.liquid.knownU",".e.liquid.knownV",".e.liquid.markU",".e.liquid.markV",".e.liquid.mu",".e.liquid.mv",".e.liquid.pGas",".e.liquid.pu",".e.liquid.pv",".e.liquid.rv",".e.liquid.solver.bs",".e.liquid.solver.levels.0.act",".e.liquid.solver.levels.0.area",".e.liquid.solver.levels.0.ax",".e.liquid.solver.levels.0.ay",".e.liquid.solver.levels.0.b",".e.liquid.solver.levels.0.band",".e.liquid.solver.levels.0.dDx",".e.liquid.solver.levels.0.dDy",".e.liquid.solver.levels.0.dH",".e.liquid.solver.levels.0.diag",".e.liquid.solver.levels.0.eDx",".e.liquid.solver.levels.0.eDy",".e.liquid.solver.levels.0.gDx",".e.liquid.solver.levels.0.gDy",".e.liquid.solver.levels.0.gx",".e.liquid.solver.levels.0.gy",".e.liquid.solver.levels.0.ox",".e.liquid.solver.levels.0.oy",".e.liquid.solver.levels.0.r",".e.liquid.solver.levels.0.x",".e.liquid.solver.levels.1.pIdx",".e.liquid.solver.levels.1.pW",".e.liquid.solver.levels.2.pIdx",".e.liquid.solver.levels.2.pW",".e.liquid.solver.nullId",".e.liquid.solver.p",".e.liquid.solver.q",".e.liquid.solver.rj",".e.liquid.solver.stack",".e.liquid.solver.xs",".e.liquid.solver.zj",".e.liquid.tmpU",".e.liquid.tmpV",".e.liquid.vsolver",".e.liquid.wt",".e.phase.Cl",".e.phase.Fe",".e.phase.Fm",".e.phase.Tl",".e.phase.Y0",".e.phase.acc",".e.phase.accAll",".e.phase.accH",".e.phase.accMat",".e.phase.accS",".e.phase.aw",".e.phase.bG",".e.phase.bY",".e.phase.dm",".e.phase.edge",".e.phase.fed",".e.phase.hnC",".e.phase.hoC",".e.phase.host",".e.phase.hvC",".e.phase.mol",".e.phase.mtot",".e.phase.rd",".e.prevKind",".e.melt.head",".e.melt.next",".e.melt.water.sg",".e.bodies.cover.work.gF",".e.bodies.cover.work.gK",".e.bodies.cover.work.restF",".e.bodies.cover.work.restK",".e.grainFlow.head",".e.grainFlow.next",".e.grainFlow.px",".e.grainFlow.py",".e.grainFlow.rad",".e.grainFlow.w",".e.grainFlow.vel",".e.grainFlow.hit",".e.grainFlow.lm",".e.grainFlow.lmT",".e.grainFlow.lv",".e.grainFlow.loc",".e.grainSalt.head",".e.grainSalt.next",".e.grainSalt.gHead",".e.grainSalt.gNext",".e.grainSalt.vel",".e.heat.Cgr",".e.heat.CTgr",".e.bodies.forces.pe",".e.bodies.forces.re",".e.bodies.forces.known",".e.bodies.forces.mass",".e.bodies.forces.vol",".e.bodies.forces.out",".e.bodies.forces.front",".e.bodies.forces.next",".e.bodies.forces.vp",".e.bodies.forces.vr",".e.bodies.forces.queued",".e.bodies.forces.tag",".e.bodies.contacts.parts",".e.bodies.contacts.byBody",".e.bodies.contacts.builtFor",".e.bodies.contacts.cache",".e.bodies.contacts.live",".e.bodies.contacts.liveKey",".e.bodies.contacts.touching",".e.bodies.contacts.toWake",".e.bodies.hitOut",".e.bodies.dv",".e.bodies.probeS",".e.bodies.probeJ",".e.bodies.m9",".e.liquid.hit",".e.liquid.escaped"]),K0=new Set([".e.timings",".e.stamp",".e.stepMs",".e.warnings"]),Ti={Float64Array:o=>new Float64Array(o),Float32Array:o=>new Float32Array(o),Int32Array:o=>new Int32Array(o),Uint32Array:o=>new Uint32Array(o),Int16Array:o=>new Int16Array(o),Uint16Array:o=>new Uint16Array(o),Int8Array:o=>new Int8Array(o),Uint8Array:o=>new Uint8Array(o),Uint8ClampedArray:o=>new Uint8ClampedArray(o)},Ql=o=>ArrayBuffer.isView(o)&&!(o instanceof DataView);function Bo(o){return o===null||typeof o!="object"?typeof o!="function":Array.isArray(o)?o.every(Bo):Object.getPrototypeOf(o)!==Object.prototype?!1:Object.values(o).every(Bo)}const z0=o=>JSON.parse(o,(t,e)=>{if(e!==null&&typeof e=="object"&&typeof e.$n=="string"){const s=e.$n;return s==="-0"?-0:Number(s)}return e});function mc(o,t,e,s,n){var r;if(e.has(o))return;e.add(o);const i=o;for(const c of Object.keys(i)){if(((r=Object.getOwnPropertyDescriptor(i,c))==null?void 0:r.get)!==void 0)continue;const a=`${t}.${c}`,l=i[c];if(n.has(a)||K0.has(a)){l!==null&&typeof l=="object"&&e.add(l);continue}if(typeof l!="function")if(Ql(l)){if(e.has(l))continue;e.add(l),s.typed(i,c,a,l)}else l instanceof Map?s.map(i,c,a,l):l!==null&&typeof l=="object"&&!Bo(l)?mc(l,a,e,s,n):s.prim(i,c,a,l)}}function Y0(o){let t=2166136261,e=16777619;for(let s=0;s<o.length;s+=1){const n=o.charCodeAt(s);t=Math.imul(t^n,16777619)>>>0,e=Math.imul(e^n+40503,16777619)>>>0}return`${t.toString(16).padStart(8,"0")}${e.toString(16).padStart(8,"0")}`}function X0(o,t){const e=[];return mc(o,"",new Set,{typed:(s,n,i)=>e.push(i),prim:(s,n,i)=>e.push(i),map:(s,n,i)=>e.push(i)},t),e}function Zl(o,t=Xl){return Y0([...X0(o,t)].sort().join(`
`))}const Q0=o=>new Uint8Array(o.buffer,o.byteOffset,o.byteLength);function Z0(o){const t=new DataView(o.buffer,o.byteOffset,o.byteLength).getUint32(0,!0);return{head:z0(new TextDecoder().decode(o.subarray(4,4+t))),at:4+t+(8-(4+t)%8)%8}}function J0(o,t,e=Xl){const{head:s,at:n}=Z0(t);if(Zl(o,e)!==s.layout)throw new Error("snapshot: the engine is built differently");const r=new Float64Array(t.slice(n,n+8*s.nums).buffer),c=new Map;let a=n+8*s.nums;const l={t:0,n:0,j:0,m:0};s.paths.forEach((f,u)=>{var h;const m=s.kinds[u],p=l[m];if(l[m]+=1,c.set(f,{kind:m,index:p,offset:a}),m==="t"){const[g,,v]=s.typed[p];a+=v*(((h=Ti[g])==null?void 0:h.call(Ti,0).BYTES_PER_ELEMENT)??1)}});const d=(f,u,m,p)=>{const h=c.get(m);if(h===void 0)throw new Error(`snapshot: nothing stored for ${m}`);if(h.kind==="t"){const[g,v,w]=s.typed[h.index];let b=Ql(p)?p:null;if(b===null||b.length!==v||b.constructor.name!==g){const _=Ti[g];if(_===void 0)throw new Error(`snapshot: unknown array ${g} at ${m}`);b=_(v),f[u]=b}Q0(b).set(t.subarray(h.offset,h.offset+w*b.BYTES_PER_ELEMENT))}else if(h.kind==="n")f[u]=r[h.index];else if(h.kind==="j"){const g=s.json[h.index];f[u]=g!==null&&typeof g=="object"&&g.u===1?void 0:structuredClone(g)}else{const g=f[u];if(!(g instanceof Map))throw new Error(`snapshot: no map at ${m}`);g.clear();for(const[v,w]of s.maps[h.index]??[])g.set(v,w)}};mc(o,"",new Set,{typed:(f,u,m,p)=>d(f,u,m,p),prim:(f,u,m,p)=>d(f,u,m,p),map:(f,u,m,p)=>d(f,u,m,p)},e)}const tu="recreatio/lab2d-clip",eu=2;function Jl(o,t,e=null){const s=o.engine??"cpu";return{key:o.key,duration:o.duration,seconds:o.seconds,frames:o.frames,fps:o.fps,bytes:o.bytes,created:o.created,bakeMs:o.bakeMs,quality:o.quality,resumable:o.layout===t,exact:s==="cpu"&&o.exact!==!1,engine:s,samples:o.samples,alt:e===null?null:Jl(e,t)}}function su(o){return Yl(zi(o).scene)}async function qc(o,t="cpu"){const e=`${tu}/${eu}${t==="gpu"?"/gpu":""}
${JSON.stringify(o)}`,s=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return[...new Uint8Array(s)].map(n=>n.toString(16).padStart(2,"0")).join("")}const tf=(o,t)=>({e:o,charts:t}),nu=16,iu=6e8;function Ec(){const o=new Map,t=new Map;return{header:async e=>o.get(e)??null,chunk:async(e,s)=>t.get(`c:${e}:${s}`)??null,keyframe:async(e,s)=>t.get(`k:${e}:${s}`)??null,save:async(e,s,n)=>{o.set(e.key,e),s.forEach((i,r)=>t.set(`c:${e.key}:${r}`,i)),n.forEach((i,r)=>t.set(`k:${e.key}:${r}`,i))},touch:async e=>{const s=o.get(e);s!==void 0&&(s.used=Date.now())},remove:async e=>{o.delete(e);for(const s of[...t.keys()])s.includes(`:${e}:`)&&t.delete(s)}}}const ru="recreatio-lab2d";function Rc(o){return new Promise((t,e)=>{o.onsuccess=()=>t(o.result),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function zr(o){return new Promise((t,e)=>{o.oncomplete=()=>t(),o.onabort=()=>e(o.error??new Error("IndexedDB: aborted")),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function ou(){return new Promise((o,t)=>{const e=indexedDB.open(ru,1);e.onupgradeneeded=()=>{const s=e.result;s.objectStoreNames.contains("clips")||s.createObjectStore("clips",{keyPath:"key"}),s.objectStoreNames.contains("chunks")||s.createObjectStore("chunks"),s.objectStoreNames.contains("keys")||s.createObjectStore("keys")},e.onsuccess=()=>o(e.result),e.onerror=()=>t(e.error??new Error("IndexedDB")),e.onblocked=()=>t(new Error("IndexedDB: blocked"))})}async function cu(){if(typeof indexedDB>"u")return Ec();let o;try{o=await ou()}catch{return Ec()}const t=async(i,r)=>Rc(o.transaction(i,"readonly").objectStore(i).get(r)),e=i=>i instanceof Uint8Array?i:i instanceof ArrayBuffer?new Uint8Array(i):null,s=async(i,r,c)=>{const a=o.transaction(["clips","chunks","keys"],"readwrite");a.objectStore("clips").delete(i);for(let l=0;l<r;l+=1)a.objectStore("chunks").delete(`${i}:${l}`);for(let l=0;l<c;l+=1)a.objectStore("keys").delete(`${i}:${l}`);await zr(a)},n={header:async i=>await t("clips",i)??null,chunk:async(i,r)=>e(await t("chunks",`${i}:${r}`)),keyframe:async(i,r)=>e(await t("keys",`${i}:${r}`)),save:async(i,r,c)=>{const a=await n.header(i.key);a!==null&&await s(a.key,a.chunkBytes.length,a.keyframes.length);const l=await Rc(o.transaction("clips","readonly").objectStore("clips").getAll());l.sort((m,p)=>m.used-p.used);let d=l.length+1,f=l.reduce((m,p)=>m+p.bytes,0)+i.bytes;for(const m of l){if(d<=nu&&f<=iu)break;await s(m.key,m.chunkBytes.length,m.keyframes.length),d-=1,f-=m.bytes}const u=o.transaction(["clips","chunks","keys"],"readwrite");r.forEach((m,p)=>u.objectStore("chunks").put(m,`${i.key}:${p}`)),c.forEach((m,p)=>u.objectStore("keys").put(m,`${i.key}:${p}`)),u.objectStore("clips").put(i),await zr(u)},touch:async i=>{const r=await n.header(i);if(r===null)return;const c=o.transaction("clips","readwrite");c.objectStore("clips").put({...r,used:Date.now()}),await zr(c)},remove:async i=>{const r=await n.header(i);r!==null&&await s(i,r.chunkBytes.length,r.keyframes.length)}};return n}class ef{constructor(t){x(this,"e");x(this,"last",null);x(this,"latent0",0);x(this,"stored0",0);x(this,"started",!1);this.e=t}vapour(){const t=this.e;return t.phase.produced-t.phase.condensed+t.bubbleModel.burstVapour}mark(t){const e=this.e,s=e.measureBudget(),n=Pt(t);let i=0;const r=e.particles;for(let c=0;c<r.count;c+=1)i+=r.mass[c]*(r.h[c]-n);return{t:e.time,heater:e.flows.heater,solids:s.solids,sens:i,SG:e.heat.fluxSG,LG:e.heat.fluxLG,lossS:e.heat.lossSolids,bub:s.bubbles,vap:this.vapour()}}sample(){const t=this.e,e=kt(t.regions.pAmb),s=sc(e),n=t.waterTemperature(),i=t.measureBudget(),r=t.flows,c=this.mark(e),a=this.last;let l=0,d=0;if(a!==null&&c.t>a.t){const m=c.t-a.t,p=(c.heater-a.heater)/m,h=(c.solids-a.solids+c.SG-a.SG+c.lossS-a.lossS+c.LG-a.LG+c.sens-a.sens+c.bub-a.bub)/m;l=(c.vap-a.vap)/m,d=Math.max(0,(p-h)/s)}this.last=c;const f=this.vapour()*s,u=i.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=u),{t:t.time,waterT:n.mean,waterTmax:n.max,Tsat:e,heater:r.heater,latent:f-this.latent0,sensible:u-this.stored0-(f-this.latent0),losses:r.lossWalls+r.lossOpen,escaped:r.escapedEnergy,liquid:i.water.liquid,vapour:i.water.vapour,fog:i.water.fog,film:i.water.film,bubbles:i.water.bubbles,escapedWater:i.water.escaped,vapourRate:l,expectedRate:d}}}const au=.004,lu=.02,Mi=1e-7,fu=.22,uu=2.5;class du{constructor(t,e){x(this,"nx",0);x(this,"ny",0);x(this,"count",0);x(this,"points",[Ic(),Ic()]);x(this,"friction");x(this,"bounce");x(this,"touched",!0);x(this,"k11",0);x(this,"k12",0);x(this,"k22",0);x(this,"i11",0);x(this,"i12",0);x(this,"i22",0);x(this,"block",!1);x(this,"h",1/120);x(this,"slop",au);x(this,"spec",lu);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function Ic(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function hu(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?mu(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?jc(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?jc(o,e,t,!0):pu(o,t,e);for(let c=0;c<o.count;c+=1){const a=o.points[c];a.jn=0,a.jt=0;for(let l=0;l<r;l+=1)if(s[l]===a.id){a.jn=n[l],a.jt=i[l];break}}return o.count}function hr(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function mu(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,c=Math.hypot(i,r);if(c>s+n+o.spec)return;const a=c>1e-9?i/c:0,l=c>1e-9?r/c:1;o.nx=a,o.ny=l,hr(o,t.x+a*(s-(s+n-c)/2),t.y+l*(s-(s+n-c)/2),c-s-n,0)}function jc(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,c=0;for(let w=0;w<n.n;w+=1){const b=(e.x-t.wx[w])*t.wnx[w]+(e.y-t.wy[w])*t.wny[w];if(b>i+o.spec)return;b>r&&(r=b,c=w)}const a=(c+1)%n.n,l=t.wx[c],d=t.wy[c],f=t.wx[a],u=t.wy[a];let m,p,h,g,v;if(r<1e-9)m=t.wnx[c],p=t.wny[c],v=r-i,h=e.x-m*i,g=e.y-p*i;else{const w=(e.x-l)*(f-l)+(e.y-d)*(u-d),b=(e.x-f)*(l-f)+(e.y-u)*(d-u);if(w<=0||b<=0){const _=w<=0?l:f,F=w<=0?d:u,k=e.x-_,P=e.y-F,y=Math.hypot(k,P);if(y>i+o.spec)return;m=y>1e-9?k/y:t.wnx[c],p=y>1e-9?P/y:t.wny[c],v=y-i,h=_,g=F}else m=t.wnx[c],p=t.wny[c],v=r-i,h=e.x-m*i,g=e.y-p*i}o.nx=s?-m:m,o.ny=s?-p:p,hr(o,h,g,v,c)}function Nc(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const c=o.wnx[r],a=o.wny[r],l=o.wx[r],d=o.wy[r];let f=1/0;for(let u=0;u<s.n;u+=1){const m=(t.wx[u]-l)*c+(t.wy[u]-d)*a;m<f&&(f=m)}f>n&&(n=f,i=r)}return{sep:n,edge:i}}function pu(o,t,e){const s=Nc(t,e);if(s.sep>o.spec)return;const n=Nc(e,t);if(n.sep>o.spec)return;let i=t,r=e,c=s.edge,a=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,c=n.edge,a=!0);const l=i.shape,d=r.shape;if(l.kind!=="poly"||d.kind!=="poly")return;const f=(c+1)%l.n,u=i.wx[c],m=i.wy[c],p=i.wx[f],h=i.wy[f],g=i.wnx[c],v=i.wny[c];let w=1/0,b=0;for(let j=0;j<d.n;j+=1){const $=r.wnx[j]*g+r.wny[j]*v;$<w&&(w=$,b=j)}const _=(b+1)%d.n;let F=r.wx[b],k=r.wy[b],P=r.wx[_],y=r.wy[_],A=b,S=_;const T=Math.hypot(p-u,h-m)||1,M=(p-u)/T,B=(h-m)/T,L=M*u+B*m,q=M*p+B*h;for(const[j,$]of[[-1,-L],[1,q]]){const U=j*(M*F+B*k)-$,J=j*(M*P+B*y)-$;if(U>Mi&&J>Mi)return;if(U>Mi){const et=U/(U-J);F+=(P-F)*et,k+=(y-k)*et,A=200+c}else if(J>Mi){const et=U/(U-J);P=F+(P-F)*et,y=k+(y-k)*et,S=300+c}}const R=(a?1e4:0)+c*1e3,E=(F-u)*g+(k-m)*v,I=(P-u)*g+(y-m)*v;o.nx=a?-g:g,o.ny=a?-v:v,E<=o.spec&&hr(o,F-g*E/2,k-v*E/2,E,R+A),I<=o.spec&&hr(o,P-g*I/2,y-v*I/2,I,R+S)}function gu(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,c=-n;for(let a=0;a<o.count;a+=1){const l=o.points[a];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const d=l.rax*i-l.ray*n,f=l.rbx*i-l.rby*n,u=e.invM+s.invM+e.invI*d*d+s.invI*f*f;l.massN=u>0?1/u:0;const m=l.rax*c-l.ray*r,p=l.rbx*c-l.rby*r,h=e.invM+s.invM+e.invI*m*m+s.invI*p*p;l.massT=h>0?1/h:0,l.bias=l.sep>0?-l.sep/t:Math.min(uu,fu/t*Math.max(0,-l.sep-o.slop));const g=s.vx-s.w*l.rby-e.vx+e.w*l.ray,v=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,w=g*n+v*i;l.bounce=w<-.6&&(l.sep<=o.slop||l.sep+w*t<0)?-o.bounce*w:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const a=o.points[0],l=o.points[1],d=a.rax*i-a.ray*n,f=a.rbx*i-a.rby*n,u=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,p=e.invM+s.invM;o.k11=p+e.invI*d*d+s.invI*f*f,o.k22=p+e.invI*u*u+s.invI*m*m,o.k12=p+e.invI*d*u+s.invI*f*m;const h=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*h&&h>0&&(o.block=!0,o.i11=o.k22/h,o.i12=-o.k12/h,o.i22=o.k11/h)}}function bu(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];ri(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function xu(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let c=0;c<o.count;c+=1){const a=o.points[c],l=e.vx-e.w*a.rby-t.vx+t.w*a.ray,d=e.vy+e.w*a.rbx-t.vy-t.w*a.rax,f=l*i+d*r,u=o.friction*a.jn,m=Math.max(-u,Math.min(u,a.jt-a.massT*f)),p=m-a.jt;a.jt=m,ri(t,e,p*i,p*r,a)}if(o.block){vu(o);return}for(let c=0;c<o.count;c+=1){const a=o.points[c],l=e.vx-e.w*a.rby-t.vx+t.w*a.ray,d=e.vy+e.w*a.rbx-t.vy-t.w*a.rax,f=l*s+d*n;a.bounce===0&&o.bounce>=.5&&f<-.6&&(a.sep<=o.slop||a.sep+f*o.h<0)&&(a.bounce=-o.bounce*f);const u=Math.max(a.jn+a.massN*(-f+Co(a)),a.fixed),m=u-a.jn;a.jn=u,ri(t,e,m*s,m*n,a),a.bounce>0&&(a.fixed=u,a.bounce=-1,a.kicked=!0)}}const Co=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function ri(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function vu(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],c=h=>{const g=e.vx-e.w*h.rby-t.vx+t.w*h.ray,v=e.vy+e.w*h.rbx-t.vy-t.w*h.rax;return g*s+v*n},a=i.jn,l=r.jn,d=c(i)-Co(i)-(o.k11*a+o.k12*l),f=c(r)-Co(r)-(o.k12*a+o.k22*l),u=(h,g)=>{const v=h-a,w=g-l;ri(t,e,v*s,v*n,i),ri(t,e,w*s,w*n,r),i.jn=h,r.jn=g};let m=-(o.i11*d+o.i12*f),p=-(o.i12*d+o.i22*f);if(m>=0&&p>=0){u(m,p);return}if(m=-d/o.k11,p=0,m>=0&&o.k12*m+f>=0){u(m,p);return}if(m=0,p=-f/o.k22,p>=0&&o.k12*p+d>=0){u(m,p);return}d>=0&&f>=0&&u(0,0)}const yu=10,En={friction:.5,bounce:.1},wu=.01;function ps(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),c=new Float64Array([-1,0,1,0]);let a=0;for(let l=0;l<4;l+=1)a=Math.max(a,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:c,n:4,radius:a}}class Gs{constructor(t,e,s,n){x(this,"wx");x(this,"wy");x(this,"wnx");x(this,"wny");x(this,"minX",0);x(this,"minY",0);x(this,"maxX",0);x(this,"maxY",0);x(this,"invM",0);x(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let c=1/0,a=1/0,l=-1/0,d=-1/0;for(let f=0;f<t.n;f+=1){const u=s+i*t.xs[f]-r*t.ys[f],m=n+r*t.xs[f]+i*t.ys[f];this.wx[f]=u,this.wy[f]=m,this.wnx[f]=i*t.nx[f]-r*t.ny[f],this.wny[f]=r*t.nx[f]+i*t.ny[f],u<c&&(c=u),u>l&&(l=u),m<a&&(a=m),m>d&&(d=m)}this.minX=c,this.minY=a,this.maxX=l,this.maxY=d}}class _u{constructor(t){x(this,"parts",[]);x(this,"byBody",[]);x(this,"builtFor",-1);x(this,"warmKey",new Float64Array(0));x(this,"warmData",new Float64Array(0));x(this,"warmCount",0);x(this,"touching",new Uint8Array(0));x(this,"toWake",[]);x(this,"cache",new Map);x(this,"live",[]);x(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,c]=t.bounds(s);e[s].shape=ps(n,i,r,c),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new Gs(1,null,ps(-1,-1,0,r+1),En)),s.openR||n.push(new Gs(2,null,ps(i,-1,i+1,r+1),En)),s.openB||n.push(new Gs(3,null,ps(-1,-1,i+1,0),En)),s.openT||n.push(new Gs(4,null,ps(-1,r,i+1,r+1),En));const{nx:c,ny:a,dx:l}=s;let d=new Map,f=10;for(let u=0;u<=a;u+=1){const m=new Map;if(u<a){let p=0;for(;p<c;){const h=p+u*c;if(s.solid[h]===0||s.owner[h]!==0){p+=1;continue}const g=s.solid[h];let v=p;for(;v+1<c&&s.solid[v+1+u*c]===g&&s.owner[v+1+u*c]===0;)v+=1;const w=g<<24|p<<12|v;m.set(w,d.has(w)?d.get(w):u),p=v+1}}for(const[p,h]of d){if(m.get(p)===h)continue;const g=this.solidMaterial(p>>>24);n.push(new Gs(f++,null,ps((p>>12&4095)*l,h*l,((p&4095)+1)*l,u*l),g))}d=m}this.byBody=t.map(()=>[]);for(const u of t){if(u.gone)continue;const m=this.solidMaterial(u.mat+1);for(let p=0;p<u.nr;p+=1){const[h,g,v,w]=u.bounds(p),b=ps(h,g,v,w),_=new Gs(1e5+u.index*1e3+p,u,b,m);n.push(_),this.byBody[u.index].push(_)}}for(const u of n)u.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=dt[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:En}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const d of this.parts){const f=d.body;if(f===null)continue;const u=f.awake;d.invM=u?1/f.m:0,d.invI=u?1/f.I:0,d.update()}for(const d of this.cache.values())d.touched=!1;const r=this.live,c=this.liveKey;r.length=0,c.length=0;const a=this.parts;for(let d=0;d<a.length;d+=1){const f=a[d];for(let u=d+1;u<a.length;u+=1){const m=a[u],p=f.invM>0,h=m.invM>0;if(!p&&!h||f.body!==null&&f.body===m.body||m.minX>f.maxX+i||m.maxX<f.minX-i||m.minY>f.maxY+i||m.maxY<f.minY-i)continue;const g=f.id*1e6+m.id;let v=this.cache.get(g);v===void 0&&(v=new du(f,m),v.slop=n,v.spec=i,this.restore(v,g),this.cache.set(g,v)),v.touched=!0,hu(v)>0?(r.push(v),c.push(g)):v.count=0}}const l=c.map((d,f)=>f).sort((d,f)=>c[d]-c[f]);for(const d of l)gu(r[d],t);for(const d of l)bu(r[d]);for(let d=0;d<yu;d+=1)for(const f of l)xu(r[f]);for(const d of l){const f=r[d],u=f.a.body,m=f.b.body;if(u!==null&&(this.touching[u.index]=1),m!==null&&(this.touching[m.index]=1),u!==null&&m!==null&&u.asleep!==m.asleep&&!u.pinned&&!m.pinned){const p=u.asleep?m:u,h=u.asleep?u:m;p.speed()>wu&&this.toWake.push(h.index)}}for(const[d,f]of this.cache)(!f.touched||f.count===0)&&this.cache.delete(d);this.save(l.map(d=>c[d]),l.map(d=>r[d]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let c=0;c<2;c+=1){const a=i.points[c];this.warmData[r+1+4*c]=a.id,this.warmData[r+2+4*c]=a.jn,this.warmData[r+3+4*c]=a.jt,this.warmData[r+4+4*c]=a.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const c=9*i;t.count=this.warmData[c];for(let a=0;a<2;a+=1){const l=t.points[a];l.id=this.warmData[c+1+4*a],l.jn=this.warmData[c+2+4*a],l.jt=this.warmData[c+3+4*a],l.kicked=this.warmData[c+4+4*a]===1}return}r<e?s=i+1:n=i-1}}}class Fu{constructor(t){x(this,"gF");x(this,"gK");x(this,"seen");x(this,"restF",new Float64Array(8));x(this,"restK",new Float64Array(8));x(this,"tag",0);this.gF=new Float64Array(t),this.gK=new Float64Array(t),this.seen=new Int32Array(t)}}const Yr=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function Xr(o,t){Yr[o].length<t&&(Yr[o]=new Float64Array(2*t));const e=Yr[o];return e.fill(0,0,t),e}function Pu(o,t,e,s,n){const{gF:i,gK:r,seen:c}=n;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1)i[f.wc[u]]=0,r[f.wc[u]]=0;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1){const m=f.wc[u];i[m]+=f.ww[u]*f.film[f.wk[u]],r[m]+=f.ww[u]*f.crust[f.wk[u]]}n.restF.length<t.length&&(n.restF=new Float64Array(2*t.length),n.restK=new Float64Array(2*t.length));const a=n.restF,l=n.restK;a.fill(0),l.fill(0);const d=++n.tag;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1){const m=f.wc[u];if(c[m]===d)continue;c[m]=d;const p=o.owner[m]>0?o.owner[m]-1:f.index,h=o.film[m]-e.filmSync[m];h<0&&-h>i[m]&&(a[p]+=-h-i[m]);const g=o.crust[m]-e.crustSync[m];g<0&&-g>r[m]&&(l[p]+=-g-r[m])}for(const f of t){if(f.gone||f.nw===0)continue;const u=s[f.index],m=Xr(0,f.ncell),p=Xr(1,f.ncell),h=Xr(2,f.ncell);let g=a[f.index]>0||l[f.index]>0;for(let b=0;b<f.nw;b+=1){const _=f.wc[b],F=f.wk[b],k=f.ww[b],P=o.Es[_]-e.esSync[_];P!==0&&o.capB[_]>0&&(m[F]+=P*k*u[F]/o.capB[_],g=!0);const y=o.film[_]-e.filmSync[_];y>0&&e.wsum[_]>0?(p[F]+=y*k/e.wsum[_],g=!0):y<0&&i[_]>0&&(p[F]-=Math.min(1,-y/i[_])*k*f.film[F],g=!0);const A=o.crust[_]-e.crustSync[_];A>0&&e.wsum[_]>0?(h[F]+=A*k/e.wsum[_],g=!0):A<0&&r[_]>0&&(h[F]-=Math.min(1,-A/r[_])*k*f.crust[F],g=!0)}if(!g)continue;let v=0,w=0;for(let b=0;b<f.ncell;b+=1)f.E[b]+=m[b],f.film[b]=Math.max(0,f.film[b]+p[b]),f.crust[b]=Math.max(0,f.crust[b]+h[b]),v+=f.film[b],w+=f.crust[b];if(a[f.index]>0&&v>0){const b=Math.max(0,1-a[f.index]/v);for(let _=0;_<f.ncell;_+=1)f.film[_]*=b}if(l[f.index]>0&&w>0){const b=Math.max(0,1-l[f.index]/w);for(let _=0;_<f.ncell;_+=1)f.crust[_]*=b}}for(let f=0;f<o.n;f+=1)o.capB[f]<=0||(e.esSync[f]=o.Es[f],e.filmSync[f]=o.film[f],e.crustSync[f]=o.crust[f])}const Se=new Float64Array(16),Te=new Float64Array(16),Bi=new Float64Array(16),Ci=new Float64Array(16);function Li(o,t,e,s,n,i,r,c){let a=0;for(let l=0;l<o;l+=1){const d=(l+1)%o,f=s*((t===0?n[l]:i[l])-e),u=s*((t===0?n[d]:i[d])-e);if(f<=0&&(r[a]=n[l],c[a]=i[l],a+=1),f<0&&u>0||f>0&&u<0){const m=f/(f-u);r[a]=n[l]+m*(n[d]-n[l]),c[a]=i[l]+m*(i[d]-i[l]),a+=1}}return a}function Au(o,t,e,s,n,i,r,c,a,l,d,f){Se[0]=o,Te[0]=t,Se[1]=e,Te[1]=s,Se[2]=n,Te[2]=i,Se[3]=r,Te[3]=c;let u=Li(4,0,a,-1,Se,Te,Bi,Ci);if(u===0||(u=Li(u,0,d,1,Bi,Ci,Se,Te),u===0)||(u=Li(u,1,l,-1,Se,Te,Bi,Ci),u===0)||(u=Li(u,1,f,1,Bi,Ci,Se,Te),u<3))return 0;let m=0;for(let p=0;p<u;p+=1){const h=(p+1)%u;m+=Se[p]*Te[h]-Se[h]*Te[p]}return Math.abs(.5*m)}function mr(o,t,e,s,n,i,r,c,a){const l=e-o,d=s-t;return ge[0]=0,ge[1]=1,!Oi(-l,o-n)||!Oi(l,r-o)||!Oi(-d,t-i)||!Oi(d,c-t)?(a[0]=1,a[1]=0,0):(a[0]=ge[0],a[1]=ge[1],Math.max(0,ge[1]-ge[0]))}const ge=new Float64Array(2);function Oi(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>ge[1])return!1;e>ge[0]&&(ge[0]=e)}else{if(e<ge[0])return!1;e<ge[1]&&(ge[1]=e)}return!0}const Qr=new Float64Array(2),qi=new Float64Array(16);function ku(o,t,e,s,n,i,r,c,a,l,d){const f=Math.cos(e),u=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const v=g===0?c:g===1||g===2?l:c,w=g===0||g===1?a:d,b=g===0||g===1?l:c,_=g===0?a:g===1||g===2?d:a,F=f*(v-o)+u*(w-t),k=-u*(v-o)+f*(w-t),P=f*(b-o)+u*(_-t),y=-u*(b-o)+f*(_-t);mr(F,k,P,y,s,n,i,r,Qr)<=0||(qi[2*m]=g+Qr[0],qi[2*m+1]=g+Qr[1],m+=1)}if(m<2)return!1;const p=1e-9;let h=m;for(let g=0;g<m;g+=1){const v=(g+1)%m,w=qi[2*g+1],b=qi[2*v]+(v===0?4:0);Math.abs(b-w)<=p&&(h-=1)}return h>=2}function Su(o,t,e){const s=[],n=[];for(const h of o)s.push(h[0],h[2]),n.push(h[1],h[3]);for(const h of t)s.push(h.x0,h.x1),n.push(h.y0,h.y1);for(const h of e)s.push(h.x0,h.x1),n.push(h.y0,h.y1);const i=Dc(s),r=Dc(n),c=i.length-1,a=r.length-1,l=new Uint8Array(Math.max(0,c*a)),d=[],f=[],u=(h,g,v,w,b,_)=>h>v&&h<b&&g>w&&g<_;for(let h=0;h<a;h+=1){const g=.5*(r[h]+r[h+1]);for(let v=0;v<c;v+=1){const w=.5*(i[v]+i[v+1]);let b=!1;for(const F of o)if(u(w,g,F[0],F[1],F[2],F[3])){b=!0;break}let _=-1;if(b){for(const F of t)if(u(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0?d.push(i[v],r[h],i[v+1],r[h+1],_):l[v+h*c]=1}else{for(const F of e)if(u(w,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0&&(f.push(i[v],r[h],i[v+1],r[h+1],_),l[v+h*c]=1)}}}const m=[];let p=[];for(let h=0;h<=a;h+=1){const g=[];if(h<a)for(let v=0;v<c;){if(l[v+h*c]===0){v+=1;continue}let w=v;for(;w<c&&l[w+h*c]!==0;)w+=1;const b=p.find(_=>_.i0===v&&_.i1===w);g.push(b??{i0:v,i1:w,y0:r[h]}),v=w}for(const v of p)g.includes(v)||m.push([i[v.i0],v.y0,i[v.i1],r[h]]);p=g}return{rects:m,taken:d,added:f}}function Dc(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const pc=.99,gc=.9,Uc=.5,Tu=.02;class Mu{constructor(t){x(this,"w");x(this,"esSync");x(this,"filmSync");x(this,"crustSync");x(this,"wsum");x(this,"work");x(this,"best");x(this,"acc");x(this,"split");x(this,"was");x(this,"now");x(this,"stamp");x(this,"fstamp");x(this,"tag",0);x(this,"ftag",0);x(this,"seen");x(this,"queue");x(this,"seenTag",0);x(this,"list",new Int32Array(256));x(this,"listN",0);x(this,"box",new Float64Array(4));x(this,"l0",new Float64Array(2));x(this,"l1",new Float64Array(2));x(this,"wp",new Float64Array(2));x(this,"seg",new Float64Array(2));x(this,"cb",new Float64Array(4));x(this,"areaK",[]);x(this,"capK",[]);x(this,"splits",[]);x(this,"boxes",new Float64Array(64));x(this,"nx",0);x(this,"ny",0);x(this,"faceOwner");x(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.work=new Fu(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let c=this.areaK[t.index],a=this.capK[t.index];(c===void 0||c.length!==t.ncell)&&(c=new Float64Array(t.ncell),a=new Float64Array(t.ncell),this.areaK[t.index]=c,this.capK[t.index]=a);for(let p=0;p<t.ncell;p+=1)c[p]=t.cellVolume(p)/t.depth,a[p]=t.cellCap(p);const l=Math.cos(t.a),d=Math.sin(t.a);let f=0;const u=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,u);const h=u[0],g=u[1],v=u[2],w=u[3],b=t.x+l*h-d*g,_=t.y+d*h+l*g,F=t.x+l*v-d*g,k=t.y+d*v+l*g,P=t.x+l*v-d*w,y=t.y+d*v+l*w,A=t.x+l*h-d*w,S=t.y+d*h+l*w,T=Math.max(0,Math.floor(Math.min(b,F,P,A)/i)),M=Math.min(s-1,Math.floor(Math.max(b,F,P,A)/i)),B=Math.max(0,Math.floor(Math.min(_,k,y,S)/i)),L=Math.min(n-1,Math.floor(Math.max(_,k,y,S)/i));for(let q=B;q<=L;q+=1)for(let R=T;R<=M;R+=1){const E=R+q*s;if(e.solid[E]!==0&&e.owner[E]===0)continue;const I=Au(b,_,F,k,P,y,A,S,R*i,q*i,(R+1)*i,(q+1)*i);I<=1e-12*c[p]||(f>=t.wk.length&&this.growWeights(t,2*f+64),t.wk[f]=p,t.wc[f]=E,t.ww[f]=I/c[p],f+=1)}}t.nw=f;for(let p=0;p<t.nr;p+=1){const h=t.xs[p][0],g=t.ys[p][0],v=t.xs[p][t.ni[p]],w=t.ys[p][t.nj[p]];let b=1/0,_=1/0,F=-1/0,k=-1/0;for(let T=0;T<4;T+=1){const M=T===0||T===3?h:v,B=T<2?g:w,L=t.x+l*M-d*B,q=t.y+d*M+l*B;b=Math.min(b,L),F=Math.max(F,L),_=Math.min(_,q),k=Math.max(k,q)}const P=Math.max(0,Math.floor(b/i)),y=Math.min(s-1,Math.floor(F/i)),A=Math.max(0,Math.floor(_/i)),S=Math.min(n-1,Math.floor(k/i));for(let T=A;T<=S;T+=1)for(let M=P;M<=y;M+=1)ku(t.x,t.y,t.a,h,g,v,w,M*i,T*i,(M+1)*i,(T+1)*i)&&m.push(M+T*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const c=this.list[r],a=c%t,l=(c-a)/t;a<e&&(e=a),a>n&&(n=a),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){var k;const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,c=this.list,a=this.listN;if(this.listN=0,a===0)return 0;const l=1/(i*i);let d=s,f=-1,u=n,m=-1;for(let P=0;P<a;P+=1){const y=c[P],A=y%s,S=(y-A)/s;A<d&&(d=A),A>f&&(f=A),S<u&&(u=S),S>m&&(m=S);const T=e.solid[y]!==0&&e.owner[y]===0;this.was[y]=e.solid[y]!==0&&e.owner[y]!==0?1:0,e.fs[y]=0,e.capB[y]=0,this.wsum[y]=0,this.best[y]=0,this.split[y]=0,e.matB[y]=0,T||(e.Es[y]=0,e.film[y]=0,e.crust[y]=0,e.owner[y]=0)}const p=d*i,h=u*i,g=(f+1)*i,v=(m+1)*i;for(const P of t){if(P.gone||P.nw===0)continue;const y=this.boxOf(P);if(y[0]>g||y[2]<p||y[1]>v||y[3]<h)continue;const A=this.areaK[P.index],S=this.capK[P.index],T=this.acc;for(let B=0;B<P.nw;B+=1){const L=P.wc[B];if(this.stamp[L]!==r)continue;const q=P.wk[B],R=P.ww[B],E=R*A[q]*l;e.fs[L]+=E,T[L]+=E,e.capB[L]+=R*S[q],e.Es[L]+=R*P.E[q],e.film[L]+=R*P.film[q],e.crust[L]+=R*P.crust[q],this.wsum[L]+=R}for(let B=0;B<P.nw;B+=1){const L=P.wc[B];this.stamp[L]!==r||T[L]===0||(T[L]>this.best[L]&&(this.best[L]=T[L],e.owner[L]=P.index+1,e.matB[L]=P.mat+1),T[L]=0)}const M=this.splits[P.index];for(let B=0;B<M.length;B+=1)this.stamp[M[B]]===r&&(this.split[M[B]]=1)}const w=++this.ftag;for(let P=0;P<a;P+=1){const y=c[P],A=y%s,S=(y-A)/s;this.face(t,A,S,!0,w),this.face(t,A+1,S,!0,w),this.face(t,A,S,!1,w),this.face(t,A,S+1,!1,w)}for(let P=0;P<a;P+=1){const y=c[P];e.fs[y]>1&&(e.fs[y]=1);const A=e.solid[y]!==0&&e.owner[y]===0&&this.was[y]===0;this.now[y]=!A&&e.owner[y]!==0&&(e.fs[y]>=((k=t[e.owner[y]-1])!=null&&k.free?gc:pc)||this.split[y]!==0)?1:0}for(let P=0;P<a;P+=1){const y=c[P];this.now[y]!==0||e.owner[y]===0||e.fs[y]<Uc||e.solid[y]!==0&&this.was[y]===0||this.besideOther(y)&&(this.now[y]=1)}let b=0;for(let P=0;P<a;P+=1){const y=c[P];if(this.now[y]===1){this.was[y]===0&&(b+=1,this.gasOut(y));const A=t[e.owner[y]-1];e.solid[y]=A.mat+1,e.kind[y]=pt,e.role[y]=0,e.heater[y]=-1}else this.was[y]===1&&(b+=1,e.solid[y]=0,e.role[y]=0,e.heater[y]=-1,this.vacate(y))}const _=++this.ftag;for(let P=0;P<a;P+=1){const y=c[P],A=y%s,S=(y-A)/s;this.closedFace(t,A,S,!0,_),this.closedFace(t,A+1,S,!0,_),this.closedFace(t,A,S,!1,_),this.closedFace(t,A,S+1,!1,_)}const F=this.w.heat;for(let P=0;P<a;P+=1){const y=c[P];this.esSync[y]=e.Es[y],this.filmSync[y]=e.film[y],this.crustSync[y]=e.crust[y],e.capB[y]>0&&F.deriveSolid(y)}return b}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,c=e.owner[t];for(let a=0;a<4;a+=1){const l=i+(a===0?-1:a===1?1:0),d=r+(a===2?-1:a===3?1:0);if(l<0||d<0||l>=s||d>=n){if(l<0?!e.openL:l>=s?!e.openR:d<0?!e.openB:!e.openT)return!0;continue}const f=l+d*s;if(e.solid[f]!==0&&e.owner[f]===0||e.owner[f]!==0&&e.owner[f]!==c&&(e.solid[f]!==0||e.fs[f]>=Uc))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:a,dx:l}=r;if(n?e>c||s>=a:e>=c||s>a)return;const d=n?e+s*(c+1):e+s*c,f=n?d:r.nu+d;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const u=e*l,m=s*l,p=n?u:u+l,h=n?m+l:m;let g=0,v=0,w=0,b=0;const _=this.l0,F=this.l1;for(const y of t){if(y.gone||y.nw===0)continue;const A=this.boxOf(y);if(A[0]>Math.max(u,p)||A[2]<Math.min(u,p)||A[1]>Math.max(m,h)||A[3]<Math.min(m,h))continue;It.toLocal(y.x,y.y,y.a,u,m,_),It.toLocal(y.x,y.y,y.a,p,h,F);let S=0;for(let T=0;T<y.nr;T+=1){const M=y.xs[T][0],B=y.ys[T][0],L=y.xs[T][y.ni[T]],q=y.ys[T][y.nj[T]];S+=mr(_[0],_[1],F[0],F[1],M,B,L,q,this.seg)}if(!(S<=0)&&(g+=S,S>v)){v=S,b=y.index+1;const T=.5*(u+p),M=.5*(m+h);w=n?y.ux-y.uw*(M-y.y):y.uy+y.uw*(T-y.x)}}const k=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[d]:r.av[d])>0!=k>0&&(this.topologyChanged=!0),this.faceOwner[f]=b,n?(r.au[d]=k,r.usol[d]=g>0?w:0):(r.av[d]=k,r.vsol[d]=g>0?w:0)}closedFace(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:a,dx:l}=r;if(n?e>c||s>=a:e>=c||s>a)return;const d=n?e+s*(c+1):e+s*c,f=n?d:r.nu+d;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const u=n?e>0?d-1-s:-1:s>0?d-c:-1,m=n?e<c?d-s:-1:s<a?d:-1,p=u>=0&&r.solid[u]!==0;if(p===(m>=0&&r.solid[m]!==0))return;const h=r.owner[p?u:m],g=h>0?t[h-1]:void 0;g===void 0||g.gone||(this.faceOwner[f]=h,n?r.usol[d]=g.ux-g.uw*((s+.5)*l-g.y):r.vsol[d]=g.uy+g.uw*((e+.5)*l-g.x))}collect(t){Pu(this.w.grid,t,this,this.capK,this.work)}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,c=this.w.bubbles,a=this.box;t.worldBox(t.x,t.y,t.a,a);const l=2*i.dx;for(let d=0;d<r.count;d+=1){const f=r.x[d],u=r.y[d];f<a[0]-l||f>a[2]+l||u<a[1]-l||u>a[3]+l||this.moveOut(t,f,u,f,u,e,s,n)&&(r.x[d]=this.wp[0],r.y[d]=this.wp[1],this.stopInto(t,r.vx,r.vy,d))}for(let d=0;d<c.count;d+=1){const f=c.x[d],u=c.y[d];f<a[0]-l||f>a[2]+l||u<a[1]-l||u>a[3]+l||this.moveOut(t,f,u,f,u,e,s,n)&&(c.x[d]=this.wp[0],c.y[d]=this.wp[1],c.site[d]=-1,this.stopInto(t,c.vx,c.vy,d))}}hit(t,e,s,n,i,r){const c=2*this.w.grid.dx;let a=0,l=n,d=i;for(let f=0;f<3;f+=1){let u=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(l,e)<p[0]-c||Math.min(l,e)>p[2]+c||Math.max(d,s)<p[1]-c||Math.min(d,s)>p[3]+c||this.moveOut(m,l,d,e,s,m.x,m.y,m.a)&&(l=this.wp[0],d=this.wp[1],r[0]=l,r[1]=d,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(d-m.y),r[5]=m.vy+m.w*(l-m.x),a=1,u=!0)}if(!u)break}return a}moveOut(t,e,s,n,i,r,c,a){const l=this.l1,d=this.l0;It.toLocal(t.x,t.y,t.a,e,s,l),It.toLocal(r,c,a,n,i,d);const f=Tu*this.w.grid.dx;let u=1/0,m=-1,p=l[0],h=l[1];for(let y=0;y<t.nr;y+=1){const A=t.xs[y][0],S=t.ys[y][0],T=t.xs[y][t.ni[y]],M=t.ys[y][t.nj[y]],B=A-f,L=S-f,q=T+f,R=M+f,E=l[0]>B&&l[0]<q&&l[1]>L&&l[1]<R;if(mr(d[0],d[1],l[0],l[1],B,L,q,R,this.seg)<=0&&!E)continue;if(d[0]>B&&d[0]<q&&d[1]>L&&d[1]<R){if(E&&u===1/0){const j=Vc(l[0]-B,q-l[0],l[1]-L,R-l[1]);m=j,p=j===0?B:j===1?q:l[0],h=j===2?L:j===3?R:l[1],u=2}}else{const j=this.seg[0];if(j<u){u=j;const $=d[0]+j*(l[0]-d[0]),U=d[1]+j*(l[1]-d[1]),J=Vc(Math.abs($-B),Math.abs($-q),Math.abs(U-L),Math.abs(U-R));m=J,p=J===0?B:J===1?q:$,h=J===2?L:J===3?R:U}}}if(m<0)return!1;const g=this.w.grid,v=1e-4*g.dx,w=Math.cos(t.a),b=Math.sin(t.a),_=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,k=p+_*v,P=h+F*v;return this.wp[0]=Math.min(g.w-v,Math.max(v,t.x+w*k-b*P)),this.wp[1]=Math.min(g.h-v,Math.max(v,t.y+b*k+w*P)),this.nx=w*_-b*F,this.ny=b*_+w*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,c=t.vx-t.w*r,a=t.vy+t.w*i,l=(e[n]-c)*this.nx+(s[n]-a)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,c=(t-r)/n,a=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let l=0,d=0;for(let g=0;g<4;g+=1){const v=s.across(t,r,c,g);v<0||!a(v)||(l+=s.vgas[v]>0?s.vgas[v]:e.vCell,d+=1)}if(d>0){let g=l;for(let v=0;v<4;v+=1){const w=s.across(t,r,c,v);if(w<0||!a(w))continue;const b=s.vgas[w]>0?s.vgas[w]:e.vCell;d-=1,s.move(t,w,d===0?1:Math.min(1,b/g)),g-=b}return}const f=this.seen,u=this.queue;let m=++this.seenTag,p=0,h=0;for(u[h++]=t,f[t]=m;p<h;){const g=u[p++];if(g!==t&&a(g)){s.move(t,g,1);return}const v=g%n,w=(g-v)/n;for(let b=0;b<4;b+=1){const _=s.across(g,v,w,b);_<0||f[_]===m||e.solid[_]!==0&&e.owner[_]===0||(f[_]=m,u[h++]=_)}}for(m=++this.seenTag,p=0,h=0,u[h++]=t,f[t]=m;p<h;){const g=u[p++];if(g!==t&&a(g)){s.move(t,g,1);return}const v=g%n,w=(g-v)/n;for(let b=0;b<4;b+=1){const _=v+(b===0?-1:b===1?1:0),F=w+(b===2?-1:b===3?1:0);if(_<0||F<0||_>=n||F>=i)continue;const k=_+F*n;f[k]!==m&&(f[k]=m,u[h++]=k)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let c=0,a=0,l=0,d=!1;for(let u=0;u<4;u+=1){const m=s.across(t,i,r,u);if(m<0||(e.kind[m]===it&&(d=!0),e.kind[m]!==H||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;c+=p,a+=p*s.rho[m],l+=p*e.T[m]}if(c<=0){e.kind[t]=d?it:H,s.deriveCell(t);return}e.kind[t]=H,e.T[t]=l/c;const f=a/c*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let u=0;u<4;u+=1){const m=s.across(t,i,r,u);if(m<0||e.kind[m]!==H)continue;const p=s.massOf(m);if(p<=0)continue;const h=(s.vgas[m]>0?s.vgas[m]:e.vCell)/c;s.move(m,t,Math.min(.25,f*h/p))}s.deriveCell(t)}}function Vc(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const Bu=1.5,Cu=1;class Lu{constructor(t){x(this,"pe");x(this,"re");x(this,"known");x(this,"mass");x(this,"vol");x(this,"out",new Float64Array(3));x(this,"front");x(this,"next");x(this,"vp");x(this,"vr");x(this,"queued");x(this,"tag",0);x(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:c,ny:a,n:l,dx:d}=e,{pe:f,re:u,known:m,mass:p,vol:h}=this;p.fill(0),h.fill(0);for(let y=0;y<s.count;y+=1){const A=e.cellAt(s.x[y],s.y[y]);A<0||(p[A]+=s.mass[y],h[A]+=s.mass[y]/s.rho[y])}for(let y=0;y<l;y+=1){const A=e.kind[y];A===it?(f[y]=e.pl[y],u[y]=h[y]>0?p[y]/h[y]:n.rhoRef,m[y]=1):A===H&&e.solid[y]===0?(f[y]=n.pGas[y]+e.pg[y],u[y]=i.rho[y]>0?i.rho[y]:r.rhoAmb,m[y]=1):(f[y]=0,u[y]=0,m[y]=0)}const g=t.gy*d,v=this.front,w=this.next,b=this.vp,_=this.vr,F=this.queued,k=++this.tag;let P=0;for(let y=0;y<l;y+=1){if(m[y]!==0)continue;const A=y%c,S=(y-A)/c;(A>0&&m[y-1]===1||A<c-1&&m[y+1]===1||S>0&&m[y-c]===1||S<a-1&&m[y+c]===1)&&(v[P++]=y,F[y]=k)}for(;P>0;){for(let A=0;A<P;A+=1){const S=v[A],T=S%c,M=(S-T)/c;let B=0,L=0,q=0;T>0&&m[S-1]!==0&&(B+=f[S-1],L+=u[S-1],q+=1),T<c-1&&m[S+1]!==0&&(B+=f[S+1],L+=u[S+1],q+=1),M>0&&m[S-c]!==0&&(B+=f[S-c]-u[S-c]*g,L+=u[S-c],q+=1),M<a-1&&m[S+c]!==0&&(B+=f[S+c]+u[S+c]*g,L+=u[S+c],q+=1),b[A]=q>0?B/q:0,_[A]=q>0?L/q:0}let y=0;for(let A=0;A<P;A+=1){const S=v[A];f[S]=b[A],u[S]=_[A],m[S]=2}for(let A=0;A<P;A+=1){const S=v[A],T=S%c,M=(S-T)/c;for(let B=0;B<4;B+=1){const L=T+(B===0?-1:B===1?1:0),q=M+(B===2?-1:B===3?1:0);if(L<0||q<0||L>=c||q>=a)continue;const R=L+q*c;m[R]!==0||F[R]===k||(F[R]=k,w[y++]=R)}}P=y;for(let A=0;A<y;A+=1)v[A]=w[A]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,c=Math.min(n-1.0001,Math.max(0,t/r-.5)),a=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(c),d=Math.floor(a),f=c-l,u=a-d;let m=0,p=0;for(let h=0;h<2;h+=1)for(let g=0;g<2;g+=1){const v=l+g+(d+h)*n;if(this.known[v]===0)continue;const w=(g===0?1-f:f)*(h===0?1-u:u);m+=w*this.pe[v],p+=w}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,c=0,a=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const d=Math.hypot(i[2]-i[0],i[3]-i[1]),f=Math.max(1,Math.ceil(d/(.5*t.dx))),u=d/f*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let h=0;h<f;h+=1){const g=(h+.5)/f,v=i[0]+g*(i[2]-i[0]),w=i[1]+g*(i[3]-i[1]),b=s*v-n*w,_=n*v+s*w,F=this.sideAt(t.x+b,t.y+_,m,p)*u;r-=F*m,c-=F*p,a-=F*(b*p-_*m)}}return e[0]=r,e[1]=c,e[2]=a,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:c}=r,a=t+.5*c*s,l=e+.5*c*n,d=Math.min(r.nx-1.0001,Math.max(0,a/c-.5)),f=Math.min(r.ny-1.0001,Math.max(0,l/c-.5)),u=Math.floor(d),m=Math.floor(f),p=d-u,h=f-m;let g=0,v=0,w=0,b=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const k=u+F,P=m+_,y=k+P*r.nx;if(this.known[y]!==1)continue;const A=(k+.5)*c,S=(P+.5)*c;if((A-t)*s+(S-e)*n<=0)continue;const T=(F===0?1-p:p)*(_===0?1-h:h)+1e-6,M=this.pe[y]+this.re[y]*i.gy*(S-e);r.kind[y]===it?(g+=T*M,v+=T):(w+=T*M,b+=T)}return v>0&&b>0?Math.max(g/v,w/b):v>0?g/v:b>0?w/b:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let c=0,a=0;for(let f=0;f<t.nseg;f+=1){t.segment(f,r);const u=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(u/t.dx));for(let p=0;p<m;p+=1){const h=(p+.5)/m,g=r[0]+h*(r[2]-r[0])+.5*t.dx*r[4],v=r[1]+h*(r[3]-r[1])+.5*t.dx*r[5],w=s.cellAt(t.x+n*g-i*v,t.y+i*g+n*v);a+=u/m,w>=0&&s.kind[w]===it&&(c+=u/m)}}const l=a>0?c/a:0,d=e.liquid.rhoRef;t.ma=Bu*d*l*t.hullA*t.depth,t.Ia=Cu*d*l*t.hullJ*t.depth}}const Ou=.1,qu=1,Eu=.002,Ru=.5,Iu=1.02,ju=.5;class Nu{constructor(t){x(this,"list",[]);x(this,"cover");x(this,"forces");x(this,"contacts");x(this,"version",0);x(this,"prev",new Float64Array(0));x(this,"pred",new Float64Array(0));x(this,"predNow",new Float64Array(0));x(this,"predOld",new Float64Array(0));x(this,"vPre",new Float64Array(0));x(this,"awakeNow",0);x(this,"shapes",!1);x(this,"resized",!1);x(this,"afterCollect",null);x(this,"la",new Float64Array(2));x(this,"lb",new Float64Array(2));x(this,"seg",new Float64Array(2));x(this,"dv",new Float64Array(3));x(this,"probeS",[]);x(this,"probeJ",[]);x(this,"m9",new Float64Array(9));x(this,"at",new Float64Array(2));this.e=t,this.cover=new Mu(t),this.forces=new Lu(()=>t),this.contacts=new _u(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get motion(){return{prev:this.prev,pred:this.pred,predNow:this.predNow,predOld:this.predOld,vPre:this.vPre}}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const c=this.e.grid,a=It.fromRects(this.list.length,n,c.dx,c.depth,e,t,s,r);return a.gone?null:(a.pinned=i,a.asleep=!0,this.list.push(a),this.grow(),this.cover.weigh(a),this.cover.addCells(a),this.changed(),a)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list){if(!e.awake)continue;this.awakeNow+=1,t=!0;const s=3*e.index;this.predNow[s]=this.pred[s],this.predNow[s+1]=this.pred[s+1],this.predNow[s+2]=this.pred[s+2],e.ux=e.vx+this.pred[s],e.uy=e.vy+this.pred[s+1],e.uw=e.w+this.pred[s+2],this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e)}if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>Iu*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),c=3*i.index,a=i.ma6;i.maOk||(this.forces.addedMass(i),a.fill(0),a[0]=i.ma,a[3]=i.ma,a[5]=i.Ia);const l=this.predNow,d=this.predOld,f=n[c]+l[c]-d[c],u=n[c+1]+l[c+1]-d[c+1],m=n[c+2]+l[c+2]-d[c+2],p=t*r[0]+a[0]*f+a[1]*u+a[2]*m,h=t*(r[1]-i.m*e.gy)+a[1]*f+a[3]*u+a[4]*m,g=t*r[2]+a[2]*f+a[4]*u+a[5]*m;Du(i.m+a[0],a[1],a[2],i.m+a[3],a[4],i.I+a[5],p,h,g,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[c]=this.dv[0],n[c+1]=this.dv[1],n[c+2]=this.dv[2],d[c]=l[c],d[c+1]=l[c+1],d[c+2]=l[c+2],this.vPre[c]=i.vx,this.vPre[c+1]=i.vy,this.vPre[c+2]=i.w}this.contacts.step(t,this.list,this.version,Ou*s.dx,qu*s.dx);for(const i of this.list){if(!i.awake)continue;const r=3*i.index,c=Math.abs(i.vx-this.vPre[r])+Math.abs(i.vy-this.vPre[r+1])+Math.abs(i.w-this.vPre[r+2])*i.rmax>1e-9;this.pred[r]=c?0:n[r],this.pred[r+1]=c?0:n[r+1],this.pred[r+2]=c?0:n[r+2]}for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<Eu&&this.contacts.touches(i)?i.rest+t:0,i.rest>=Ru&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}blocks(t,e,s,n,i){const r=1e-6*this.e.grid.dx,c=this.la,a=this.lb;for(const l of this.list){if(l===t||l.gone||l.nw===0)continue;const d=this.cover.boxOf(l);if(!(Math.max(e,n)<d[0]||Math.min(e,n)>d[2]||Math.max(s,i)<d[1]||Math.min(s,i)>d[3])){It.toLocal(l.x,l.y,l.a,e,s,c),It.toLocal(l.x,l.y,l.a,n,i,a);for(let f=0;f<l.nr;f+=1){const u=l.xs[f][0]+r,m=l.ys[f][0]+r,p=l.xs[f][l.ni[f]]-r,h=l.ys[f][l.nj[f]]-r;if(p>u&&h>m&&mr(c[0],c[1],a[0],a[1],u,m,p,h,this.seg)>0)return!0}}}return!1}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:c,dx:a,depth:l}=i,d=this.cover.faceOwner;for(const f of this.list){if(!f.awake)continue;const u=f.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const h=this.cover.boxOf(f),g=Math.max(0,Math.floor(h[0]/a)-1),v=Math.min(r,Math.floor(h[2]/a)+2),w=Math.max(0,Math.floor(h[1]/a)-1),b=Math.min(c,Math.floor(h[3]/a)+2);for(let P=w;P<Math.min(c,b);P+=1)for(let y=g;y<=v;y+=1){const A=y+P*(r+1);if(d[A]!==u)continue;const S=(P+.5)*a,T=y>0?y-1+P*r:-1,M=y<r?y+P*r:-1,L=T>=0&&i.kind[T]===pt||M>=0&&i.kind[M]===pt?1:1-i.au[A];L<=0||(T>=0&&i.kind[T]===it&&(m.push(t.at(y-1-e,P-s)),p.push(L,0,-L*(S-f.y))),M>=0&&i.kind[M]===it&&(m.push(t.at(y-e,P-s)),p.push(-L,0,L*(S-f.y))))}for(let P=w;P<=b;P+=1)for(let y=g;y<Math.min(r,v);y+=1){const A=y+P*r;if(d[i.nu+A]!==u)continue;const S=(y+.5)*a,T=P>0?y+(P-1)*r:-1,M=P<c?y+P*r:-1,L=T>=0&&i.kind[T]===pt||M>=0&&i.kind[M]===pt?1:1-i.av[A];L<=0||(T>=0&&i.kind[T]===it&&(m.push(t.at(y-e,P-1-s)),p.push(0,L,L*(S-f.x))),M>=0&&i.kind[M]===it&&(m.push(t.at(y-e,P-s)),p.push(0,-L,-L*(S-f.x))))}if(m.length===0){f.ma6.fill(0),f.maOk=!0;continue}const _=t.system,F=this.m9;for(let P=0;P<3;P+=1){_.b.fill(0),_.x.fill(0);for(let y=0;y<m.length;y+=1)_.b[m[y]]-=a*p[3*y+P];t.solve(1e-4,40,!0);for(let y=0;y<3;y+=1){let A=0;for(let S=0;S<m.length;S+=1)A+=_.x[m[S]]*p[3*S+y];F[3*y+P]=-n*a*l*A}}const k=f.ma6;k[0]=F[0],k[1]=.5*(F[1]+F[3]),k[2]=.5*(F[2]+F[6]),k[3]=F[4],k[4]=.5*(F[5]+F[7]),k[5]=F[8],f.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,ju*e.dx/s))}return t}wake(t){!t.free||!t.asleep||(t.asleep=!1,t.rest=0,t.maOk=!1,this.forget(t))}forget(t){const e=3*t.index;for(let s=e;s<e+3;s+=1)this.prev[s]=0,this.pred[s]=0,this.predNow[s]=0,this.predOld[s]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.forget(t),this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(Ie(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let c=this.list.length-1;c>=0;c-=1){const a=this.list[c];if(!a.gone&&(It.toLocal(a.x,a.y,a.a,t,e,n),a.insideLocal(n[0],n[1],r)))return a}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=3*this.list.length+24,e=s=>{const n=new Float64Array(t);return n.set(s),n};this.prev=e(this.prev),this.pred=e(this.pred),this.predNow=e(this.predNow),this.predOld=e(this.predOld),this.vPre=e(this.vPre)}}}function Du(o,t,e,s,n,i,r,c,a,l){const d=s*i-n*n,f=e*n-t*i,u=t*n-e*s,m=o*d+t*f+e*u,p=o*i-e*e,h=t*e-o*n,g=o*s-t*t;l[0]=(d*r+f*c+u*a)/m,l[1]=(f*r+p*c+h*a)/m,l[2]=(u*r+h*c+g*a)/m}const pr=.05;function Gc(o,t){const e=o.latentOffset(),s=Lo(o,t.filter(([n,i,r,c])=>r-n>pr*o.dx&&c-i>pr*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function Lo(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,c=o.nr,a=o.E,l=o.film,d=o.crust;let f=0,u=0,m=0;for(let b=0;b<o.ncell;b+=1)f+=a[b],u+=l[b],m+=d[b];const p=[],h=[];for(const[b,_,F,k]of t)!(F>b)||!(k>_)||(p.push(It.splits(b,F,o.dx)),h.push(It.splits(_,k,o.dx)));o.setRects(p,h);let g=0,v=0,w=0;for(let b=0;b<o.nr;b+=1){const _=o.xs[b],F=o.ys[b];for(let k=0;k<o.nj[b];k+=1)for(let P=0;P<o.ni[b];P+=1){const y=o.off[b]+P+k*o.ni[b],A=_[P],S=_[P+1],T=F[k],M=F[k+1];for(let B=0;B<c;B+=1){const L=e[B],q=s[B];if(!(L[0]>=S||L[n[B]]<=A||q[0]>=M||q[i[B]]<=T))for(let R=0;R<i[B];R+=1){const E=Math.min(M,q[R+1])-Math.max(T,q[R]);if(!(E<=0))for(let I=0;I<n[B];I+=1){const j=Math.min(S,L[I+1])-Math.max(A,L[I]);if(j<=0)continue;const $=r[B]+I+R*n[B],U=j*E/((L[I+1]-L[I])*(q[R+1]-q[R]));o.E[y]+=U*a[$],o.film[y]+=U*l[$],o.crust[y]+=U*d[$]}}}g+=o.E[y],v+=o.film[y],w+=o.crust[y]}}return{energy:f-g,film:u-v,crust:m-w}}function Uu(o,t,e,s,n){const[i,r,c,a]=o;if(s<=i||t>=c||n<=r||e>=a)return null;const l=[],d=Math.max(i,t),f=Math.min(c,s);return t>i&&l.push([i,r,t,a]),s<c&&l.push([s,r,c,a]),e>r&&l.push([d,r,f,e]),n<a&&l.push([d,n,f,a]),l}function Vu(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let c=0;c<r.length;c+=1){const[a,l,d,f]=o[r[c]];for(let u=0;u<e;u+=1){if(s[u]>=0)continue;const[m,p,h,g]=o[u],v=(Math.abs(d-m)<=t||Math.abs(h-a)<=t)&&Math.min(f,g)-Math.max(l,p)>t,w=(Math.abs(f-p)<=t||Math.abs(g-l)<=t)&&Math.min(d,h)-Math.max(a,m)>t,b=Math.min(d,h)-Math.max(a,m)>t&&Math.min(f,g)-Math.max(l,p)>t;(v||w||b)&&(s[u]=n.length,r.push(u))}}n.push(r)}return n}function Gu(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let c=0;c<n;c+=1){const a=s[c];if(a.gone)continue;let l=1/0,d=1/0,f=-1/0,u=-1/0;if("circle"in t){const[k,P,y]=t.circle;It.toLocal(a.x,a.y,a.a,k,P,i),l=i[0]-y,f=i[0]+y,d=i[1]-y,u=i[1]+y}else{const[k,P,y,A]=Tn(t);for(const[S,T]of[[k,P],[y,P],[y,A],[k,A]])It.toLocal(a.x,a.y,a.a,S,T,i),l=Math.min(l,i[0]),f=Math.max(f,i[0]),d=Math.min(d,i[1]),u=Math.max(u,i[1])}const m=[];let p=!1;for(let k=0;k<a.nr;k+=1){const P=a.bounds(k),y=Uu(P,l,d,f,u);if(y===null){m.push(P);continue}p=!0;for(const A of y)m.push(A)}if(!p)continue;r=!0,o.cover.release(a);const h=Ie(a.mat)>0,g={E:a.energy(),F:a.filmMass(),K:a.crustMass(),M:h?a.m:0},v=sf(o,a,m.filter(k=>k[2]-k[0]>pr*a.dx&&k[3]-k[1]>pr*a.dx));let w=0,b=0,_=0,F=0;for(const k of v)w+=k.energy(),b+=k.filmMass(),_+=k.crustMass(),F+=h?k.m:0;e.energy-=g.E-a.energy()-w,e.water-=g.F-a.filmMass()-b+(h?g.M-a.m-F:0),e.salt-=g.K-a.crustMass()-_,a.gone||a.ncell===0?(a.gone=!0,a.ncell=0):(o.cover.weigh(a),o.cover.addCells(a))}return r&&o.changed(),r}function sf(o,t,e,s=!0){const n=o.list,i=Vu(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let c=1;c<i.length;c+=1){const a=new It(n.length,t.key,t.dx,t.depth);a.mat=t.mat,a.heater=t.heater,a.xs=t.xs.map(l=>l.slice()),a.ys=t.ys.map(l=>l.slice()),a.nr=t.nr,a.ni=t.ni.slice(),a.nj=t.nj.slice(),a.off=t.off.slice(),a.ncell=t.ncell,a.E=t.E.slice(),a.film=t.film.slice(),a.crust=t.crust.slice(),a.x=t.x,a.y=t.y,a.a=t.a,a.m=t.m,Gc(a,i[c].map(l=>e[l])),a.rx=a.x,a.ry=a.y,a.ra=a.a,a.pinned=t.pinned,a.asleep=t.asleep,a.vx=t.vx,a.vy=t.vy,a.w=t.w,n.push(a),o.grow(),o.cover.weigh(a),o.cover.addCells(a),r.push(a)}return Gc(t,i.length>0?i[0].map(c=>e[c]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function Hu(o,t,e){const[s,n,i,r]=Tn(t),c=[],a=new Float64Array(4);for(const l of o.list){if(l.gone||e!==void 0&&!e(l))continue;l.worldBox(l.x,l.y,l.a,a);const d=.001*l.dx;a[0]>=i-d||a[2]<=s+d||a[1]>=r-d||a[3]<=n+d||(o.cover.release(l),c.push(l))}return c}function $u(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(Ie(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function Hc(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const Xt=new Float64Array(6);function Ei(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let c=0;c<r;c+=1){const a=e===0?0:e===1?n-1:c,l=e===2?0:e===3?i-1:c,d=o.off[t]+a+l*n,f=e<2?o.ys[t][l]:o.xs[t][a],u=e<2?o.ys[t][l+1]:o.xs[t][a+1],m=nf(o,t,e,f,u);s(d,u-f,u>f?m/(u-f):0)}}function nf(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function $c(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function rf(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function Wu(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=rf(o,t,n);i>s&&(s=i,e=n)}return e}function of(o,t,e,s){t.segment(e,Xt);const n=Math.hypot(Xt[2]-Xt[0],Xt[3]-Xt[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),c=Math.sin(t.a),a=r*Xt[4]-c*Xt[5],l=c*Xt[4]+r*Xt[5],d=Xt[0],f=Xt[1],u=Xt[2]-Xt[0],m=Xt[3]-Xt[1];for(let p=0;p<i;p+=1){const h=(p+.5)/i,g=d+h*u,v=f+h*m;s(t.x+r*g-c*v,t.y+c*g+r*v,a,l,n/i)}}function cf(o,t,e,s,n,i,r){const c=.05*o.dx,a=o.cellAt(s+c*i,n+c*r);if(a<0||o.solid[a]===0||o.owner[a]!==t||o.fs[a]<e)return c;const l=a%o.nx,d=(a-l)/o.nx;let f=1/0;return i>1e-9?f=Math.min(f,((l+1)*o.dx-s)/i):i<-1e-9&&(f=Math.min(f,(l*o.dx-s)/i)),r>1e-9?f=Math.min(f,((d+1)*o.dx-n)/r):r<-1e-9&&(f=Math.min(f,(d*o.dx-n)/r)),Number.isFinite(f)?Math.max(c,f+c):c}function bc(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx,c=t.free?gc:pc;let a=-1,l=-1,d=-1;of(o,t,e,(f,u,m,p,h)=>{const g=cf(i,t.index+1,c,f,u,m,p),v=i.cellAt(f+g*m,u+g*p);if(v<0||i.solid[v]!==0){a=v;return}if(v!==a&&s(v,h),a=v,n){const b=f+(i.dx+g)*m,_=u+(i.dx+g)*p,F=i.cellAt(b,_);F>=0&&F!==v&&F!==d&&i.solid[F]===0&&!o.bodies.blocks(t,f,u,b,_)&&s(F,h),d=F}const w=i.cellAt(f-r*m,u-r*p);w>=0&&w!==v&&w!==l&&i.solid[w]===0&&i.kind[w]===it&&s(w,h),l=w})}function Ku(o,t,e,s,n){const i=o.exchange;let r=0,c=0;for(let a=0;a<t.nseg;a+=1)t.segR[a]!==e||t.segS[a]!==s||bc(o,t,a,l=>{r+=i.salt[l],c+=i.water[l],n.add(4*e+s)});return!(c>0)||!(r>0)?Ie(t.mat):Gl(r/(c*Qe))}function zu(o,t,e,s,n){const i=o.grid,r=o.exchange,c=i.n,a=t.free?gc:pc;let l=0;for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||of(o,t,d,(f,u,m,p,h)=>{var _;const g=cf(i,t.index+1,a,f,u,m,p),v=i.cellAt(f+g*m,u+g*p);if(v<0)return;let w,b;i.solid[v]!==0?(w=i.T[v],b=((_=dt[i.solid[v]-1])==null?void 0:_.k)??0):r.cap[v]>0?(w=r.capT[v]/r.cap[v],b=Qn(w)):(w=i.T[v],b=nc(i.mg[v],i.mg[c+v],i.mg[Q*c+v],w)),w>n&&(l+=b*(w-n)*h)});return l}const Yu=2,Xu=.25,Qu=4;class Zu{constructor(t,e){x(this,"pending",new Map);x(this,"sg",new Float64Array(6));this.e=t,this.inCell=e}totals(){let t=0,e=0,s=0;for(const n of this.pending.values())t+=n.m-n.s,e+=n.H,s+=n.s;return{m:t,H:e,s}}any(t){var e;for(let s=0;s<4;s+=1)if((((e=this.pending.get(4*t+s))==null?void 0:e.m)??0)>0)return!0;return!1}give(t,e,s,n,i,r=0,c=-1){const a=this.e.grid,l=this.e.particles,d=this.e.liquid,f=[],u=new Set;let m=0,p=!1;for(let g=0;g<2&&f.length===0;g+=1)for(let v=0;v<t.nseg;v+=1)t.segR[v]!==e||t.segS[v]!==s||bc(this.e,t,v,w=>{g===0&&(p=!0),!(a.kind[w]!==it||u.has(w))&&(u.add(w),this.inCell(w,b=>{l.mat[b]===ut&&(f.push(b),m+=l.mass[b])}))},g===1);if(f.length===0||!(m>0)){if(!p&&c<0){const g=s<2?[2,3]:[0,1];for(const v of g)this.give(t,e,v,.5*n,.5*i,.5*r,s);return}this.hold(t,e,s,n,i,r,c);return}const h=d.rhoRef*a.vCell/4;for(const g of f){const v=l.mass[g]/m,w=l.mass[g]/l.rho[g],b=l.mass[g]*l.h[g]+v*i;l.mass[g]+=v*n,r>0&&(l.smass[2*g]+=v*r,l.spc[2*g]=xi),l.h[g]=b/l.mass[g],l.derive(g),d.dVp[g]+=l.mass[g]/l.rho[g]-w,l.mass[g]>Yu*h&&this.split(g)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const d of[i,-i]){const f=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*d)),u=n.cellAt(f,e.y[t]);if(u>=0&&n.solid[u]===0&&this.e.bodies.bodyAt(f,e.y[t],0)===null){r=f;break}}if(Number.isNaN(r))return;const c=.5*e.mass[t],a=.5*e.smass[2*t],l=e.add(r,e.y[t],c,e.h[t],e.mat[t],a);l<0||(e.mass[t]=c,e.smass[2*t]=a,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r,c){const a=this.e.grid.dx,[l,d,f,u]=t.bounds(e);let m=s===0?l:s===1?f:.5*(l+f),p=s===2?d:s===3?u:.5*(d+u);c===2?p=Math.min(u,d+.5*a):c===3?p=Math.max(d,u-.5*a):c===0?m=Math.min(f,l+.5*a):c===1&&(m=Math.max(l,f-.5*a));const h=s===0?-1:s===1?1:0,g=s===2?-1:s===3?1:0,v=Math.cos(t.a),w=Math.sin(t.a),b=4*t.index+s;let _=this.pending.get(b);_===void 0&&(_={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1},this.pending.set(b,_)),_.m+=n,_.H+=i,_.s+=r,_.x=t.x+v*m-w*p,_.y=t.y+w*m+v*p,_.nx=v*h-w*g,_.ny=w*h+v*g}spawnAll(t){for(let e=0;e<4;e+=1){const s=this.pending.get(4*t.index+e);s!==void 0&&s.m>0&&this.spawn(t,s)}}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;for(let c=0;c<Qu&&e.m>0;c+=1){if(e.m<Xu*r&&!t.gone)return;const a=(c%2===0?1:-1)*Math.ceil(c/2)*.3*s.dx,l=e.x+.3*s.dx*e.nx-a*e.ny,d=e.y+.3*s.dx*e.ny+a*e.nx,f=this.freeSpot(t,e.x,e.y,l,d)??(t.gone?null:this.outlineSpot(t,l,d));if(f===null)return;const u=Math.min(e.m,r),m=u/e.m,p=n.add(f[0],f[1],u,e.H/e.m,ut,m*e.s);if(p<0)return;n.vx[p]=t.gone?0:t.vx,n.vy[p]=t.gone?0:t.vy,i.placeParticle(p),i.dVp[p]=u/n.rho[p],e.H-=m*e.H,e.s-=m*e.s,e.m-=u,e.m>1e-15||(e.m=0,e.H=0,e.s=0)}}fluidAt(t,e){const s=this.e.grid;if(!(t>0&&e>0&&t<s.w&&e<s.h))return!1;const n=s.cellAt(t,e);return n>=0&&s.solid[n]===0&&this.e.bodies.bodyAt(t,e,0)===null}freeSpot(t,e,s,n,i){const r=this.e.grid,c=(a,l)=>this.fluidAt(a,l)&&!this.e.bodies.blocks(t,e,s,a,l);if(c(n,i))return[n,i];for(let a=1;a<=3;a+=1)for(let l=a;l>=-a;l-=1)for(let d=-a;d<=a;d+=1)if(Math.max(Math.abs(d),Math.abs(l))===a&&c(n+d*r.dx,i+l*r.dx))return[n+d*r.dx,i+l*r.dx];return null}outlineSpot(t,e,s){const n=this.e.grid.dx,i=this.sg,r=Math.cos(t.a),c=Math.sin(t.a);let a=null,l=1/0;for(let d=0;d<t.nseg;d+=1){t.segment(d,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),u=Math.max(1,Math.ceil(f/(.5*n)));for(let m=0;m<u;m+=1){const p=(m+.5)/u,h=i[0]+p*(i[2]-i[0]),g=i[1]+p*(i[3]-i[1]),v=h+.3*n*i[4],w=g+.3*n*i[5],b=t.x+r*v-c*w,_=t.y+c*v+r*w,F=(b-e)*(b-e)+(_-s)*(_-s);F<l&&this.fluidAt(b,_)&&!this.e.bodies.blocks(t,t.x+r*h-c*g,t.y+c*h+r*g,b,_)&&(l=F,a=[b,_])}}return a}}const Ju=.3,td=1.6,Ri=.25,Wc=.5,Zr=1e-6;class ed{constructor(t){x(this,"water");x(this,"melted",0);x(this,"frozen",0);x(this,"head",new Int32Array(0));x(this,"next",new Int32Array(0));x(this,"listed",!1);this.e=t,this.water=new Zu(t,(e,s)=>this.inCell(e,s))}pendingTotals(){return this.water.totals()}any(){return this.e.bodies.list.some((t,e)=>!t.gone&&Ie(t.mat)>0||this.water.any(e))}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&Ie(i.mat)>0&&this.body(i)&&(t=!0),this.water.spawnAll(i)}return t}body(t){const e=dt[t.mat].rho,s=dt[t.mat].cp,n=ks(t.mat),i=new Map,r=new Set,c=new Map;for(let b=0;b<t.nseg;b+=1){const _=4*t.segR[b]+t.segS[b];if(i.has(_))continue;const F=Ku(this.e,t,t.segR[b],t.segS[b],r);i.set(_,F),c.set(_,zu(this.e,t,t.segR[b],t.segS[b],F))}const a=new Map;for(let b=0;b<t.nr;b+=1)this.excess(t,b,i,r,c,a);const l=this.walls(t,[...i.keys()]),d=new Map,f=new Map,u=new Map,m=new Map,p=new Map;for(const[b,_]of i){const F=b>>2,k=b&3,P=s*(_-nt)+n,y=Pt(_)-P;let A=0;Ei(t,F,k,(M,B,L)=>{L>0&&(A+=L*B*(y+s*(_-Math.min(_,t.cellT(M)))))});const S=this.planFreeze(t,F,k,_,y);d.set(b,{L:y,hIce:P,denom:A,plan:S});const T=l.get(b);f.set(T,(f.get(T)??0)+(a.get(b)??0)),u.set(T,(u.get(T)??0)+A),m.set(T,(m.get(T)??0)+((S==null?void 0:S.total)??0)),p.set(T,(p.get(T)??0)+rf(t,F,k))}const h=[];for(const[b,_]of i){const F=b>>2,k=b&3,P=l.get(b),y=d.get(b),A=a.get(b)??0,S=f.get(P)??0,T=u.get(P)??0;S>0&&T>0?h.push({r:F,s:k,d:S/(e*t.depth*T),Q:A,Tf:_,hIce:y.hIce,freeze:null}):A>0&&this.giveBack(t,F,k,A);const M=m.get(P)??0;M>0&&h.push({r:F,s:k,d:M/(e*t.depth*p.get(P)),Q:0,Tf:_,hIce:y.hIce,freeze:y.plan??{p:[],dm:[],total:0}})}if(h.length===0)return!1;const g=zc(t),v=this.e.bodies;if(v.cover.release(t),t.nr===1?this.moveSides(t,h):this.slabs(t,h),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,v.changed(),!0;let w=0;if(t.nr>1){const b=[];for(let _=0;_<t.nr;_+=1)b.push(t.bounds(_));w=sf(v,t,b,!1).length}return t.derive(),v.cover.weigh(t),v.cover.addCells(t),h.some(b=>b.freeze!==null)&&v.cover.pushOut(t,t.x,t.y,t.a),v.reshaped(t,w>0||zc(t)!==g),!0}excess(t,e,s,n,i,r){const c=[];for(let h=0;h<4;h+=1)n.has(4*e+h)&&c.push(h);if(c.length===0)for(let h=0;h<4;h+=1)s.has(4*e+h)&&c.push(h);let a=1/0;for(let h=0;h<4;h+=1)a=Math.min(a,s.get(4*e+h)??1/0);if(a===1/0)return;const l=t.xs[e],d=t.ys[e],f=t.ni[e],u=t.nj[e],m=[0,0],p=[0,0];for(let h=0;h<u;h+=1)for(let g=0;g<f;g+=1){const v=t.off[e]+g+h*f,w=t.cellT(v);if(!(w>a))continue;let b=0,_=0;for(let M=0;M<4&&b<2;M+=1){if(!(M===0?g===0:M===1?g===f-1:M===2?h===0:h===u-1))continue;const B=i.get(4*e+M)??0;!(B>0)||!(nf(t,e,M,M<2?d[h]:l[g],M<2?d[h+1]:l[g+1])>0)||(m[b]=M,p[b]=B,_+=B,b+=1)}if(b>0){const M=t.E[v];for(let B=0;B<b;B+=1){const L=4*e+m[B],q=p[B]/_*(M-Mo(t.cellCap(v),t.film[v],t.crust[v],s.get(L)));q>0&&(t.E[v]-=q,r.set(L,(r.get(L)??0)+q))}continue}if(c.length===0)continue;const F=.5*(l[g]+l[g+1]),k=.5*(d[h]+d[h+1]);let P=c[0],y=1/0;for(const M of c){const B=M===0?F-l[0]:M===1?l[f]-F:M===2?k-d[0]:d[u]-k;B<y&&(y=B,P=M)}const A=4*e+P,S=s.get(A);if(!(w>S))continue;const T=t.E[v]-Mo(t.cellCap(v),t.film[v],t.crust[v],S);T>0&&(t.E[v]-=T,r.set(A,(r.get(A)??0)+T))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,c=this.e.particles,a={p:[],dm:[],total:0},l=d=>{if(!(r.cap[d]>0)||!(r.water[d]>0))return;const f=r.capT[d]/r.cap[d];if(f>=n)return;const u=Math.min(Wc*r.water[d],r.cap[d]*(n-f)/Math.max(1,i));if(!(u>0))return;let m=0;this.inCell(d,p=>{if(c.mat[p]!==ut)return;const h=c.mass[p]-c.smass[2*p],g=Math.min(Wc*h,u*h/r.water[d]);g>0&&(a.p.push(p),a.dm.push(g),m+=g)}),r.water[d]-=m,r.cap[d]=0,a.total+=m};for(let d=0;d<t.nseg;d+=1)t.segR[d]===e&&t.segS[d]===s&&bc(this.e,t,d,l);return a.total>0?a:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let c=0;c<t.p.length;c+=1){const a=t.p[c],l=t.dm[c]*e;if(!(l>0))continue;const d=n.mass[a]/n.rho[a],f=n.mass[a]*n.h[a]-l*s;n.mass[a]-=l,n.h[a]=f/n.mass[a],n.derive(a),i.dVp[a]+=n.mass[a]/n.rho[a]-d,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=dt[t.mat].rho,c=Math.min(n,this.rowThickness(t,e,s));let a=0,l=0,d=0,f=0;if(Ei(t,e,s,(u,m)=>{const p=t.cellVolume(u);if(!(p>0))return;const h=m*c*t.depth/p;l+=h*t.E[u],d+=h*t.film[u],f+=h*t.crust[u],t.E[u]-=h*t.E[u],t.film[u]-=h*t.film[u],t.crust[u]-=h*t.crust[u],a+=r*m*c*t.depth}),this.moveSide(t,e,s,-c),!(a>0)){this.giveBack(t,e,s,i+l);return}this.melted+=a,this.water.give(t,e,s,a+d+f,l+a*ks(t.mat)+i,f)}grow(t,e,s,n,i){const r=dt[t.mat].rho,c=dt[t.mat].cp,a=$c(t,e,s),l=n/(r*t.depth*a);Ei(t,e,s,(d,f)=>{t.E[d]+=r*f*l*t.depth*c*(i-nt)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=$c(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}Ei(t,e,s,(r,c)=>{t.E[r]+=n*c/i})}slabs(t,e){const s=dt[t.mat].rho,n=dt[t.mat].cp,i=ks(t.mat),r=t.depth,c=e.length,a=this.walls(t,e.map(A=>4*A.r+A.s)),l=e.map(A=>a.get(4*A.r+A.s)),d=new Map;for(const A of e)A.freeze===null&&d.set(4*A.r+A.s,A.d);const f=[];for(let A=0;A<t.nr;A+=1)f.push(t.bounds(A));const u=new Map;for(const A of e)u.set(4*A.r+A.s,(u.get(4*A.r+A.s)??0)+(A.freeze!==null?A.d:-A.d));const m=[],p=[];for(let A=0;A<c;A+=1){const S=e[A],T=f[S.r];for(let M=0;M<t.nseg;M+=1)if(!(t.segR[M]!==S.r||t.segS[M]!==S.s))if(S.freeze===null){const B=t.segT0[M]-this.inner(t,M,!1,d),L=t.segT1[M]+this.inner(t,M,!0,d);m.push(Kc(S.s,T,B,L,Math.min(S.d,S.s<2?T[2]-T[0]:T[3]-T[1]),!0,A))}else{const B=t.segT0[M]-this.corner(t,S.r,S.s,!1,t.segT0[M],u),L=t.segT1[M]+this.corner(t,S.r,S.s,!0,t.segT1[M],u);L>B&&p.push(Kc(S.s,T,B,L,S.d,!1,A))}}const h=Su(f,m,p),g=h.taken,v=new Float64Array(c);for(let A=0;A<g.length;A+=5)v[g[A+4]]+=(g[A+2]-g[A])*(g[A+3]-g[A+1]);for(let A=0;A<c;A+=1)e[A].freeze===null&&!(v[A]>0)&&this.giveBack(t,e[A].r,e[A].s,e[A].Q);const w=new Float64Array(c),b=new Float64Array(c),_=new Float64Array(c);for(let A=0;A<g.length;A+=5){const S=g[A+4];this.overlap(t,g[A],g[A+1],g[A+2],g[A+3],(T,M)=>{w[S]+=M*t.E[T],b[S]+=M*t.film[T],_[S]+=M*t.crust[T]})}for(let A=0;A<c;A+=1){const S=e[A];if(S.freeze!==null||!(v[A]>0))continue;const T=s*r*v[A];this.melted+=T,this.water.give(t,S.r,S.s,T+b[A]+_[A],w[A]+T*i+S.Q,_[A])}Lo(t,h.rects);const F=h.added,k=new Float64Array(c);for(let A=0;A<F.length;A+=5){const S=F[A+4],T=e[S].Tf;k[S]+=(F[A+2]-F[A])*(F[A+3]-F[A+1]),this.overlap(t,F[A],F[A+1],F[A+2],F[A+3],(M,B,L)=>{t.E[M]+=s*r*L*n*(T-nt)})}const P=new Map,y=new Map;for(let A=0;A<c;A+=1){const S=e[A].freeze;if(S===null)continue;const T=l[A];P.set(T,(P.get(T)??0)+s*r*k[A]),y.set(T,(y.get(T)??0)+S.total)}for(let A=0;A<c;A+=1){const S=e[A].freeze;if(S===null||!(S.total>0))continue;const T=l[A];this.take(S,P.get(T)/y.get(T),e[A].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let c=r;for(;s.get(c)!==c;)c=s.get(c);return c};if(t.nr>1){const r=Zr*t.dx,c=a=>{const l=t.segR[a],d=t.segS[a];return d===0?t.xs[l][0]:d===1?t.xs[l][t.ni[l]]:d===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let a=0;a<t.nseg;a+=1)for(let l=a+1;l<t.nseg;l+=1){if(t.segS[a]!==t.segS[l]||Math.abs(c(a)-c(l))>r||Math.abs(t.segT1[a]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[a])>r)continue;const d=4*t.segR[a]+t.segS[a],f=4*t.segR[l]+t.segS[l];if(!s.has(d)||!s.has(f))continue;const u=n(d),m=n(f);u!==m&&s.set(Math.max(u,m),Math.min(u,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=Zr*t.dx,r=t.segR[e],c=t.segS[e],a=s?t.segT1[e]:t.segT0[e],l=c===0?t.xs[r][0]:c===1?t.xs[r][t.ni[r]]:c===2?t.ys[r][0]:t.ys[r][t.nj[r]],d=c<2?l:a,f=c<2?a:l,u=c===0?-1:c===1?1:0,m=c===2?-1:c===3?1:0;for(let p=0;p<t.nseg;p+=1){const h=t.segS[p];if(h<2==c<2)continue;const g=n.get(4*t.segR[p]+h);if(g===void 0)continue;const v=t.segR[p],w=h===0?t.xs[v][0]:h===1?t.xs[v][t.ni[v]]:h===2?t.ys[v][0]:t.ys[v][t.nj[v]];for(const[b,_]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const F=h<2?w:b,k=h<2?b:w;if(Math.abs(F-d)>i||Math.abs(k-f)>i)continue;const P=h<2?w:_,y=h<2?_:w;if((P-d)*u+(y-f)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[c,a,l,d]=t.bounds(e),f=Zr*t.dx,u=s<2?n?d:a:n?l:c;if(Math.abs(i-u)>f)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?c:s===1?l:s===2?a:d;for(let h=0;h<t.nseg;h+=1)if(t.segR[h]===e&&t.segS[h]===m&&t.segT0[h]<=p+f&&t.segT1[h]>=p-f)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let c=0;c<t.nr;c+=1){const a=t.xs[c],l=t.ys[c],d=t.ni[c],f=t.nj[c];if(!(a[0]>=n||a[d]<=e||l[0]>=i||l[f]<=s))for(let u=0;u<f;u+=1){const m=Math.min(i,l[u+1])-Math.max(s,l[u]);if(!(m<=0))for(let p=0;p<d;p+=1){const h=Math.min(n,a[p+1])-Math.max(e,a[p]);h<=0||r(t.off[c]+p+u*d,h*m/((a[p+1]-a[p])*(l[u+1]-l[u])),h*m)}}}}tidy(t){const e=t.dx;let s=!1;for(let c=0;c<t.nr;c+=1){const[a,l,d,f]=t.bounds(c);if(d-a<Ri*e||f-l<Ri*e){s=!0;continue}for(let u=0;u<4;u+=1){const m=this.rowThickness(t,c,u),p=u<2?t.ni[c]:t.nj[c];(m<Ju*e&&p>1||m>td*e)&&(s=!0)}}if(!s)return;const n=dt[t.mat].rho,i=ks(t.mat),r=[];for(let c=0;c<t.nr;c+=1){const[a,l,d,f]=t.bounds(c);if(d-a>=Ri*e&&f-l>=Ri*e){r.push([a,l,d,f]);continue}const u=n*(d-a)*(f-l)*t.depth;let m=0,p=0,h=0;for(let g=t.off[c];g<t.off[c]+t.ni[c]*t.nj[c];g+=1)m+=t.E[g],p+=t.film[g],h+=t.crust[g];this.melted+=u,this.water.give(t,c,Wu(t,c),u+p+h,m+u*i,h)}Lo(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function Kc(o,t,e,s,n,i,r){const[c,a,l,d]=t;return o===0?i?{x0:c,y0:e,x1:c+n,y1:s,move:r}:{x0:c-n,y0:e,x1:c,y1:s,move:r}:o===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:o===2?i?{x0:e,y0:a,x1:s,y1:a+n,move:r}:{x0:e,y0:a-n,x1:s,y1:a,move:r}:i?{x0:e,y0:d-n,x1:s,y1:d,move:r}:{x0:e,y0:d,x1:s,y1:d+n,move:r}}function zc(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const de=8;class sd{constructor(t){x(this,"cap");x(this,"count",0);x(this,"nextId",1);x(this,"x");x(this,"y");x(this,"z");x(this,"vx");x(this,"vy");x(this,"m");x(this,"H");x(this,"age");x(this,"site");x(this,"r");x(this,"V");x(this,"pb");x(this,"pv");x(this,"Tb");x(this,"dmdt");x(this,"force");x(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*ft),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*de),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<ft;i+=1)this.m[n*ft+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<de;i+=1)this.force[n*de+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<ft;s+=1)e+=this.m[t*ft+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<ft;s+=1)this.m[t*ft+s]=this.m[e*ft+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<de;s+=1)this.force[t*de+s]=this.force[e*de+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const af=200;function Jr(o,t,e,s){const n=kt(o);return t/Oe(n)-e*Dt*n/(s-o)}function nd(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function id(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function rd(o,t,e,s,n,i,r,c=ut){const a=o[t+Q],l=o[t+at]/gt[at]+o[t+lt]/gt[lt],d=a/gt[Q];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(d+l)*Dt*s/e)/(4*Math.PI)),u=e,m=0,p=s,h=0;for(let g=0;g<8;g+=1){if(u=e+2*un(c,p)/f,l<=0)m=u,p=kt(m),h=a/Oe(p);else if(d<=1e-9*l)m=0,p=s,h=l*Dt*p/u;else{let w=611.213,b=u*(1-1e-12),_=Jr(w,a,l,u),F=Jr(b,a,l,u);if(_<=0)m=w;else if(F>=0)m=b;else{let k=0;m=.5*(w+b);for(let P=0;P<40;P+=1){m=(w*F-b*_)/(F-_);const y=Jr(m,a,l,u);if(Math.abs(y)<=1e-12*(a/Oe(s)+1e-30))break;y>0?(w=m,_=y,k===1&&(F/=2),k=1):(b=m,F=y,k===-1&&(_/=2),k=-1)}}p=kt(m),h=a/Oe(p)}const v=nd(h,n);if(Math.abs(v-f)<=1e-7*f){f=v;break}f=v}r.r=f,r.V=h,r.pb=e+2*un(c,p)/f,r.pv=m,r.Tb=p,id(h,f,n,r)}function Yc(o,t,e,s){let n=0;for(let i=0;i<ft;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function Xc(o,t,e,s,n,i,r,c,a,l){let d=0;if(2*e<=3*i){const v=o/i-.5,w=t/i-.5,b=Math.floor(v-.5),_=Math.floor(w-.5),F=v-b,k=w-_,P=.5*(1.5-F)**2,y=.75-(F-1)**2,A=.5*(F-.5)**2,S=.5*(1.5-k)**2,T=.75-(k-1)**2,M=.5*(k-.5)**2;let B=0;for(let L=0;L<3;L+=1){const q=_+L;if(q<0||q>=c)continue;const R=L===0?S:L===1?T:M;for(let E=0;E<3;E+=1){const I=b+E;if(I<0||I>=r)continue;const j=R*(E===0?P:E===1?y:A);a[d]=I+q*r,l[d]=j,B+=j,d+=1}}for(let L=0;L<d;L+=1)l[L]/=B;return d}const f=s<=Math.PI*n*n*n/6,u=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),h=Math.min(c-1,Math.floor((t+e)/i));let g=0;for(let v=p;v<=h;v+=1)for(let w=u;w<=m;w+=1){let b=0;for(let _=0;_<4;_+=1){const F=(v+(_+.5)/4)*i-t;for(let k=0;k<4;k+=1){const P=(w+(k+.5)/4)*i-o,y=e*e-P*P-F*F;y>0&&(b+=f?Math.sqrt(y):1)}}b<=0||d>=a.length||(a[d]=w+v*r,l[d]=b,g+=b,d+=1)}if(g<=0)return a[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(c-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let v=0;v<d;v+=1)l[v]/=g;return d}function Qc(o,t,e,s,n,i){const{nx:r,ny:c}=o,a=e%r,l=(e-a)/r;let d=0,f=0;for(let u=0;u<=6&&(d===0||f<2*s);u+=1)for(let m=0;m<=u;m+=1)for(let p=-u;p<=u;p+=1){if(Math.max(Math.abs(p),m)!==u)continue;const h=a+p,g=l+m;if(h<0||g<0||h>=r||g>=c)continue;const v=h+g*r;if(o.kind[v]!==H||d>=n.length)continue;const w=Math.max(.001*o.vCell,t[v]);n[d]=v,i[d]=w,f+=w,d+=1}for(let u=0;u<d;u+=1)i[u]/=f;return d}function Zc(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===H)return e+s*o.nx;return-1}const Hs=.5;class od{constructor(t){x(this,"e");x(this,"ux0");x(this,"uy0");x(this,"vel",new Float64Array(2));x(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,c=n.liquid,a=r.x[t],l=r.y[t],d=r.r[t],f=r.V[t],u=Math.max(d+i.dx,2*i.dx),m=this.vel;let p=0,h=0;for(let W=0;W<8;W+=1){const G=W*Math.PI/4;c.velocityAt(a+u*Math.cos(G),l+u*Math.sin(G),m),p+=m[0]/8,h+=m[1]/8}const g=i.cellAt(a,l),v=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],w=g>=0?n.phase.host[g]:0,b=n.phase.mixed?qs(w,v):c.rhoRef,_=Jn(w,v),F=r.totalMass(t)/Math.max(1e-30,f),k=(p-this.ux0[t])/Math.max(e,1e-6),P=(h-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=h,d<2e-5){r.vx[t]=p,r.vy[t]=h,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,a+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*h));return}const y=r.vx[t]-p,A=r.vy[t]-h,S=Math.hypot(y,A),T=2*d,M=Math.max(1e-6,b*S*T/_),B=Math.max(0,n.gy)*(b-F)*T*T/un(w,v),q=.5*Math.max(24/M*(1+.15*Math.pow(M,.687)),8/3*(B/(B+4)))*b*this.front(t)*S,R=(F+Hs*b)*f,E=b*f*k,I=b*f*(P+n.gy),j=-F*f*n.gy,$=Hs*b*f*k,U=Hs*b*f*P,J=s>0?Hs*b*s:0,et=s<0?Math.min(-s,.2*f/e):0,bt=Hs*b*et*y,rt=Hs*b*et*A,C=(R*r.vx[t]+e*(E+$+bt)+e*(q+J)*p)/(R+e*(q+J)),D=(R*r.vy[t]+e*(I+j+U+rt)+e*(q+J)*h)/(R+e*(q+J));r.vx[t]=Number.isFinite(C)?C:p,r.vy[t]=Number.isFinite(D)?D:h;const z=-q*(C-p),mt=-q*(D-h),xt=t*de;r.force[xt]=E,r.force[xt+1]=I,r.force[xt+2]=0,r.force[xt+3]=j,r.force[xt+4]=z,r.force[xt+5]=mt,r.force[xt+6]=$+bt-J*(C-p),r.force[xt+7]=U+rt-J*(D-h),this.spreadForce(a,l,d,-(z+r.force[xt+6])*(e/n.dt),-(mt+r.force[xt+7])*(e/n.dt));let Y=a+e*C,N=l+e*D;const X=i.sdfAt(Y,N);if(X<d){const W=.25*i.dx;let G=i.sdfAt(Y+W,N)-i.sdfAt(Y-W,N),ht=i.sdfAt(Y,N+W)-i.sdfAt(Y,N-W);const ct=Math.hypot(G,ht);if(ct>1e-12){G/=ct,ht/=ct,Y+=(d-X)*G,N+=(d-X)*ht;const _t=r.vx[t]*G+r.vy[t]*ht;_t<0&&(r.vx[t]-=_t*G,r.vy[t]-=_t*ht)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,Y)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,N));const O=i.depth;r.z[t]=2*d>=O?O/2:Math.min(O-d,Math.max(d,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:a,ny:l,dx:d}=c;if(s>d&&this.spreadRing(t,e,s,n,i))return;const f=this.w3;let u=Math.floor(t/d-.5),m=t/d-u;f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2;let p=Math.floor(e/d-1);m=e/d-.5-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1){const v=u+g,w=p+h;v<0||v>a||w<0||w>=l||(r.fU[v+w*(a+1)]+=n*f[g]*f[3+h])}u=Math.floor(t/d-1),m=t/d-.5-u,f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2,p=Math.floor(e/d-.5),m=e/d-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1){const v=u+g,w=p+h;v<0||v>=a||w<0||w>l||(r.fV[v+w*a]+=i*f[g]*f[3+h])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:a,ny:l,dx:d}=c,f=c.phi,u=Math.max(1.5*s,s+2*d),m=s*s,p=u*u,h=Math.max(0,Math.floor((t-u)/d)),g=Math.min(a,Math.ceil((t+u)/d)),v=Math.max(0,Math.floor((e-u)/d)),w=Math.min(l,Math.ceil((e+u)/d));let b=0,_=0;for(let F=0;F<2;F+=1){if(F===1){if(!(b>0)||!(_>0))return!1;b=n/b,_=i/_}for(let k=v;k<=w;k+=1)for(let P=h;P<=g;P+=1){if(k<l){const y=P*d-t,A=(k+.5)*d-e,S=y*y+A*A;if(S>=m&&S<=p){const T=P+k*a,M=.5*((P>0?f[T-1]:0)+(P<a?f[T]:0));M>0&&(F===0?b+=M:r.fU[P+k*(a+1)]+=b*M)}}if(P<a){const y=(P+.5)*d-t,A=k*d-e,S=y*y+A*A;if(S>=m&&S<=p){const T=P+k*a,M=.5*((k>0?f[T-a]:0)+(k<l?f[T]:0));M>0&&(F===0?_+=M:r.fV[T]+=_*M)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,c=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=c)return 2*i*s;const a=(n-r)/(c-r);return(1-a)*(Math.PI*s*s)/4+a*s*s}}class lf{constructor(t){x(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function Jc(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const cd=8,ad=210,ta=1.805,ld=3e-7;function Oo(o,t){const e=kt(t);return kt(t+2*mi(e)/o)-e}const pe=class pe{constructor(){x(this,"count",0);x(this,"fixed",0);x(this,"cell",new Int32Array(0));x(this,"fluid",new Int32Array(0));x(this,"dir",new Uint8Array(0));x(this,"r",new Float32Array(0));x(this,"s",new Float32Array(0));x(this,"z",new Float32Array(0));x(this,"bubble",new Uint32Array(0));x(this,"mat",new Uint8Array(0));x(this,"px",new Float64Array(0));x(this,"py",new Float64Array(0));x(this,"nx",new Float32Array(0));x(this,"ny",new Float32Array(0));x(this,"body",new Int16Array(0));x(this,"seg",new Int32Array(0));x(this,"t",new Float32Array(0));x(this,"pos",new Float64Array(2));x(this,"sg",new Float64Array(6))}static rRef(){if(pe.ref>0)return pe.ref;const t=kt(zn),e=2*mi(t)/(ti(t+1)-zn);return pe.ref=ad*e,pe.ref}static draw(t,e,s,n){const i=dt[s],r=pe.rRef(),c=pe.rng;c.state=t||1;const a=Math.pow(r/i.cavRmax,ta);let l=0;for(let d=0;d<cd;d+=1){l+=c.exp();const f=r*Math.pow(l/(e*i.cavScale)+a,-1/ta);if(f<ld)break;n.r.push(f),n.s.push(c.next()),n.z.push(c.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,c=[],a=[],l=[],d=[],f=[],u=[],m=[],p={r:[],s:[],z:[]};for(let _=0;_<t.n;_+=1){if(t.solid[_]===0||t.owner[_]!==0)continue;const F=_%n,k=(_-F)/n;for(let P=0;P<4;P+=1){const y=P===0?F-1:P===1?F+1:F,A=P===2?k-1:P===3?k+1:k;if(y<0||A<0||y>=n||A>=i)continue;const S=y+A*n;if(t.solid[S]===0){p.r.length=0,p.s.length=0,p.z.length=0,pe.draw(Jc(e,_,P),r,t.solid[_]-1,p);for(let T=0;T<p.r.length;T+=1)c.push(_),a.push(S),l.push(P),d.push(p.r[T]),f.push(p.s[T]),u.push(p.z[T]),m.push(t.solid[_]-1)}}}const h=c.length,g=[],v=[],w=[];for(const _ of s)if(!_.gone)for(let F=0;F<_.nseg;F+=1){_.segment(F,this.sg);const k=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),P=Math.max(1,Math.round(k/t.dx));for(let y=0;y<P;y+=1){p.r.length=0,p.s.length=0,p.z.length=0,pe.draw(Jc(e,1e5+1e3*_.key+F,y),k/P*t.depth,_.mat,p);for(let A=0;A<p.r.length;A+=1)c.push(-1),a.push(-1),l.push(_.segS[F]),d.push(p.r[A]),f.push(p.s[A]),u.push(p.z[A]),m.push(_.mat),g.push(_.index),v.push(F),w.push((y+p.s[A])/P)}}const b=c.length;this.count=b,this.fixed=h,this.cell=Int32Array.from(c),this.fluid=Int32Array.from(a),this.dir=Uint8Array.from(l),this.r=Float32Array.from(d),this.s=Float32Array.from(f),this.z=Float32Array.from(u),this.bubble=new Uint32Array(b),this.mat=Uint8Array.from(m),this.px=new Float64Array(b),this.py=new Float64Array(b),this.nx=new Float32Array(b),this.ny=new Float32Array(b),this.body=new Int16Array(b).fill(-1),this.seg=new Int32Array(b),this.t=new Float32Array(b);for(let _=0;_<h;_+=1){const F=this.cell[_],k=F%n,P=(F-k)/n,y=this.s[_],A=this.dir[_],S=t.dx;this.px[_]=A===0?k*S:A===1?(k+1)*S:(k+y)*S,this.py[_]=A===2?P*S:A===3?(P+1)*S:(P+y)*S,this.nx[_]=A===0?-1:A===1?1:0,this.ny[_]=A===2?-1:A===3?1:0}for(let _=h;_<b;_+=1)this.body[_]=g[_-h],this.seg[_]=v[_-h],this.t[_]=w[_-h];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const c=this.t[i],a=this.sg[0]+c*(this.sg[2]-this.sg[0]),l=this.sg[1]+c*(this.sg[3]-this.sg[1]),d=Math.cos(r.a),f=Math.sin(r.a),u=r.x+d*a-f*l,m=r.y+f*a+d*l,p=d*this.sg[4]-f*this.sg[5],h=f*this.sg[4]+d*this.sg[5];this.px[i]=u,this.py[i]=m,this.nx[i]=p,this.ny[i]=h,this.dir[i]=Math.abs(p)>=Math.abs(h)?p<0?0:1:h<0?2:3;const g=t.cellAt(u-n*p,m-n*h),v=t.cellAt(u+n*p,m+n*h);this.cell[i]=g,this.fluid[i]=v>=0&&t.solid[v]===0?v:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)dt[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};x(pe,"ref",0),x(pe,"rng",new lf(1));let qo=pe;const fd=.0208,ud=1;class dd{constructor(t){x(this,"e");x(this,"burstVapour",0);x(this,"nucleated",0);x(this,"departed",0);x(this,"merged",0);x(this,"burst",0);x(this,"collapsed",0);x(this,"burstCold",0);x(this,"collapsedCold",0);x(this,"burstWarm",0);x(this,"collapsedWarm",0);x(this,"firstSuperheat",null);x(this,"firstMaterial",null);x(this,"departures",new Float64Array(256));x(this,"departureCount",0);x(this,"contactAngleOverride",null);x(this,"watch",-1);x(this,"watchFate",0);x(this,"sites",new qo);x(this,"motion");x(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});x(this,"cells",new Int32Array(1024));x(this,"wts",new Float64Array(1024));x(this,"alphaTarget");x(this,"budget");x(this,"tsatCell");x(this,"dTb");x(this,"Fm");x(this,"vel",new Float64Array(2));x(this,"head");x(this,"next");x(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new od(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return Oo(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:c}=n,a=Math.min(i-1.0001,Math.max(0,t/c-.5)),l=Math.min(r-1.0001,Math.max(0,e/c-.5)),d=Math.floor(a),f=Math.floor(l),u=a-d,m=l-f;let p=0,h=0;for(let g=0;g<2;g+=1)for(let v=0;v<2;v+=1){const w=d+v+(f+g)*i;if(n.solid[w]!==0)continue;const b=(v===0?1-u:u)*(g===0?1-m:m);p+=b*n.pl[w],h+=b}return Math.max(.5*s.pRef,s.pRef+(h>0?p/h:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=Xc(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,c=0;for(let a=0;a<i;a+=1){const l=this.cells[a];s.kind[l]===it&&(this.cells[c]=l,this.wts[c]=this.wts[a],r+=this.wts[a],c+=1)}for(let a=0;a<c;a+=1)this.wts[a]/=r;return r>0?c:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;rd(s.m,t*ft,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:c}=s;for(let l=0;l<r;l+=1){if(c[l]!==it){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const d=Math.max(.5*e.pRef,e.pRef+s.pl[l]),f=i.boilingAt(l,d);this.tsatCell[l]=f,i.salty&&(this.dTb[l]=f-kt(d)),this.budget[l]=i.Cl[l]*(i.Tl[l]-f)}this.Fm.fill(0),e.extremes.beginStep();const a=e.waterTemperature();if(this.bulkCold=a.mass>0&&a.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);if(this.coalesce(),e.extremes.normalize)for(let l=0;l<n.count;l+=1)n.r[l]>e.extremes.bubbleCap&&this.vent(l);for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const c=this.sites.fluid[r],a=this.sites.cell[r];if(c<0||a<0||s.kind[c]!==it||i.acc[c]<=0||i.waterShare(c)<.5||!e.heat.hasSolid(a))continue;const l=dt[this.sites.mat[r]],d=i.Tl[c],f=Vn(i.host[c],d),u=(l.k*s.Ts[a]+f*d)/(l.k+f),m=Math.max(.5*e.pRef,e.pRef+s.pl[c]),p=this.tsatCell[c]>0?this.tsatCell[c]:kt(m);if(u-p<0)continue;const h=this.sites.r[r];if(u-p<e.extremes.activation(Oo(h,m)))continue;const g=m+2*un(i.host[c],u)/h,v=kt(g),w=4/3*Math.PI*h*h*h,b=Oe(v)*w;if(b*4>i.acc[c])continue;const _=this.sites.position(this.e.grid,r,h),F=n.add(_[0],_[1],Math.min(s.depth-h,Math.max(h,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*ft+Q]=b,n.r[F]=h,n.V[F]=w,n.Tb[F]=v,n.pb[F]=g,n.pv[F]=g,n.H[F]=b*vt(v),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const k=i.waterH(c);this.Fm[c]-=b,e.heat.src[a]-=b*(vt(v)-k)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=u-p,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,c=t*ft;let a=i.site[t],l=0;const d=i.V[t];let f=0,u=d;for(;l<e-1e-12;){u=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let h=Math.min(e-l,Math.max(1e-7,ud*i.age[t]),.25*n.dx/(p+1e-9));h<1e-7&&(h=Math.min(e-l,1e-7));let g,v=-1,w=0;if(a>=0){const Y=this.sites.fluid[a],N=this.sites.cell[a];if(Y<0||N<0||!s.heat.hasSolid(N)){this.detach(t),a=-1;continue}const X=dt[this.sites.mat[a]],O=r.Tl[Y],W=Vn(r.host[Y],O);g=(X.k*n.Ts[N]+W*O)/(X.k+W),v=N}else{if(w=this.liquidFootprint(t),w===0)break;g=0;for(let Y=0;Y<w;Y+=1)g+=this.wts[Y]*r.Tl[this.cells[Y]]}let b=0;if(r.salty)if(a>=0)b=this.dTb[this.sites.fluid[a]];else for(let Y=0;Y<w;Y+=1)b+=this.wts[Y]*this.dTb[this.cells[Y]];const _=i.Tb[t],F=a>=0?r.host[this.sites.fluid[a]]:r.hostAt(i.x[t],i.y[t]),k=Vn(F,g),P=qs(F,g),y=ic(F,g),A=Jn(F,g),S=k/(P*y),T=2*m,M=i.age[t],B=k*Math.sqrt(3/(Math.PI*S)),L=a>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),q=P*L*T/A,R=A*y/k,E=k/T*(2+.6*Math.sqrt(q)*Math.cbrt(R)),I=vt(_)-Pt(g);let j=Math.max(B*2*(Math.sqrt(M+h)-Math.sqrt(M)),E*h);if(a>=0&&g>_+b){const Y=.5*this.fritz(t,g),N=i.m[c+Q]>0?i.m[c+Q]/i.V[t]:Oe(_),X=j*(g-_-b)/(N*I);if(m<Y&&m+X>Y&&X>0){const O=j*(Y-m)/X;if(E*h>=B*2*(Math.sqrt(M+h)-Math.sqrt(M)))h=O/E;else{const W=Math.sqrt(M)+O/(2*B);h=W*W-M}h=Math.max(1e-9,Math.min(e-l,h*(1+1e-6))),j=Math.max(B*2*(Math.sqrt(M+h)-Math.sqrt(M)),E*h)}}const $=n.depth,U=i.V[t],J=i.m[c+Q]>0?i.m[c+Q]/U:Oe(_),et=j*(g-_-b)/(J*I),bt=Math.max(0,m+et);let rt;U<=Math.PI*$*$*$/6?rt=4/3*Math.PI*(bt*bt*bt-m*m*m):U>=Math.PI*$*$*$/4?rt=Math.PI*$*(bt*bt-m*m):rt=Math.PI*$*$*j*(g-_-b)/(J*I);let C=J*rt*I;if(a>=0){const Y=v,N=s.heat.solidCap(Y)*Math.max(0,n.Ts[Y]-_);if(C>0&&(C=Math.min(C,Math.max(0,N-this.used(Y)))),C>0){const X=C;C=Math.min(C,s.extremes.wallLeft(Y,e)),s.extremes.takeWall(Y,C,X)}}else{let Y=0;for(let N=0;N<w;N+=1)Y+=this.wts[N]*this.budget[this.cells[N]];C>0?C=Math.min(C,Math.max(0,Y)):C=Math.max(C,Math.min(0,Y))}let D=C/I;D<0&&(D=Math.max(D,-i.m[c+Q]));let z=1,mt=!1;if(a<0&&D!==0&&!r.mixed)for(let Y=0;Y<w&&!mt;Y+=1)mt=r.acc[this.cells[Y]]<=0;const xt=Y=>r.acc[Y]>0?r.waterShare(Y):0;if(a<0&&D!==0&&(r.mixed||mt)){z=0;for(let Y=0;Y<w;Y+=1)z+=this.wts[Y]*xt(this.cells[Y]);D*=z}if(D!==0){if(a>=0){const Y=this.sites.fluid[a];D>0&&r.acc[Y]+this.Fm[Y]-D<0&&(D=Math.max(0,r.acc[Y]+this.Fm[Y]));const N=r.waterH(Y);this.Fm[Y]-=D,s.heat.src[v]-=D*(vt(_)-N)/e,this.budgetSolid(v,D*(vt(_)-N))}else for(let Y=0;Y<w;Y+=1){const N=this.cells[Y],X=r.mixed||mt?this.wts[Y]*xt(N)/z:this.wts[Y];if(X===0)continue;const O=r.waterH(N);this.Fm[N]-=D*X,s.heat.src[N]-=D*X*(vt(_)-O)/e,this.budget[N]-=D*X*(vt(_)-O)}i.m[c+Q]+=D,i.H[t]+=D*vt(_),f+=D}if(this.solve(t,g),this.restoreEnthalpy(t,a,w,e),i.r[t]<1e-6||i.m[c+Q]<=1e-18&&i.m[c+at]+i.m[c+lt]<=0){i.age[t]+=h;break}if(a>=0){const Y=this.sites.position(this.e.grid,a,i.r[t]);i.x[t]=Y[0],i.y[t]=Y[1],this.departure(t,g),a=i.site[t]}else this.motion.move(t,h,(i.V[t]-u)/h);if(i.age[t]+=h,l+=h,i.m[c+Q]<=0&&i.m[c+at]+i.m[c+lt]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,c=Yc(r.m,t*ft,r.Tb[t],fe),a=c-r.H[t];if(a===0)return;if(e>=0){r.H[t]=c,i.heat.src[this.sites.cell[e]]-=a/n;return}const l=i.phase.Cl;let d=0;for(let f=0;f<s;f+=1)l[this.cells[f]]>0&&(d+=this.wts[f]);if(d>0){r.H[t]=c;for(let f=0;f<s;f+=1){const u=this.cells[f];l[u]>0&&(i.heat.src[u]-=a*this.wts[f]/(d*n))}}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=dt[this.sites.mat[i]],c=this.contactAngleOverride??r.contactAngle,a=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return fd*c*Math.sqrt(un(l,n.Tb[t])/(s.gy*(qs(l,e)-a)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),c=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(c<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=c,this.departureCount+=1;const a=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],a),this.motion.ux0[t]=a[0],this.motion.uy0[t]=a[1],n.vx[t]=a[0],n.vy[t]=a[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let c=0;for(let l=0;l<s.count;l+=1){const d=e.cellAt(s.x[l],s.y[l]);if(d<0){this.next[l]=-1;continue}this.next[l]=this.head[d],this.head[d]=l,s.r[l]>c&&(c=s.r[l])}const a=Math.ceil(2*c/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const d=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let u=Math.max(0,f-a);u<=Math.min(i-1,f+a);u+=1)for(let m=Math.max(0,d-a);m<=Math.min(n-1,d+a);m+=1)for(let p=this.head[m+u*n];p>=0;p=this.next[p]){if(p<=l||s.V[p]<=0)continue;const h=s.x[p]-s.x[l],g=s.y[p]-s.y[l],v=e.depth,b=2*s.r[l]>=v||2*s.r[p]>=v?0:s.z[p]-s.z[l],_=s.r[l]+s.r[p];h*h+g*g+b*b>=_*_||this.merge(l,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let c=0;c<ft;c+=1)s.m[t*ft+c]+=s.m[e*ft+c],s.m[e*ft+c]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*ft,c=i.totalMass(t);if(i.V[t]<=0||c<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Q]<=1e-18&&i.m[r+at]+i.m[r+lt]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const a=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(a<0||n.kind[a]===H||l<0||n.kind[l]===H)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*ft,c=e.extremes.bubbleCap,a=2*c<=s.depth?4/3*Math.PI*c*c*c:Math.PI*c*c*s.depth;if(!(n.V[t]>a))return;const l=1-a/n.V[t];let d=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;d>=0&&s.kind[d]!==H;)d=d+s.nx<i?d+s.nx:-1;if(d<0&&(d=Zc(s,n.x[t])),d<0)return;const f=Qc(s,e.gas.vgas,d,l*n.V[t],this.cells,this.wts);for(let u=0;u<f;u+=1){const m=this.cells[u],p=this.wts[u];for(let h=0;h<ft;h+=1)s.mg[h*i+m]+=p*l*n.m[r+h];s.Hg[m]+=p*l*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=l*n.m[r+Q],this.burstVapour+=l*n.m[r+Q];for(let u=0;u<ft;u+=1)n.m[r+u]*=1-l;n.H[t]*=1-l,n.V[t]=a,n.r[t]=c}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,c=t*ft,a=i.n,l=r.m[c+Q],d=r.m[c+at]+r.m[c+lt];if(e||d>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==H;)m=m+i.nx<a?m+i.nx:-1;if(m<0&&(m=Zc(i,r.x[t])),m>=0){const p=Qc(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let h=0;h<p;h+=1){const g=this.cells[h],v=this.wts[h];for(let w=0;w<ft;w+=1)i.mg[w*a+g]+=v*r.m[c+w];i.Hg[g]+=v*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let h=1;if(p.mixed){h=0;for(let g=0;g<m;g+=1)h+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const v=this.cells[g],w=p.mixed&&h>0?this.wts[g]*p.waterShare(v)/h:this.wts[g];if(w===0)continue;const b=p.waterH(v);this.Fm[v]+=l*w,n.heat.src[v]+=w*(r.H[t]-l*b)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[Q*a+p]+=l,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const u=r.count-1;if(t!==u){this.motion.ux0[t]=this.motion.ux0[u],this.motion.uy0[t]=this.motion.uy0[u];const m=r.site[u];m>=0&&(this.sites.bubble[m]=r.id[u])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let d=0;d<n.count;d+=1){const f=Xc(n.x[d],n.y[d],n.r[d],n.V[d],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let u=0;u<f;u+=1)i[this.cells[u]]+=this.wts[u]*n.V[d]*r}const c=s.alpha,a=e.liquid.volSrc,l=af*t;for(let d=0;d<s.n;d+=1){const f=Math.min(i[d],Math.max(0,1-s.phiS[d])),u=f-c[d];u!==0&&(u>l?(a[d]+=l*s.vCell/t,c[d]+=l):u<-l?(a[d]-=l*s.vCell/t,c[d]-=l):(a[d]+=u*s.vCell/t,c[d]=f))}}spawn(t,e,s,n,i){const r=this.e,c=this.B,a=c.add(t,e,s);if(a<0)return-1;const l=this.pressure(t,e),d=r.grid.cellAt(t,e),f=d>=0&&r.phase.Tl[d]>0?r.phase.Tl[d]:r.ambientT,u=l+2*un(d>=0?r.phase.host[d]:0,f)/n,m=4/3*Math.PI*n*n*n,p=a*ft;if(i<=0){const h=kt(u);c.m[p+Q]=Oe(h)*m}else{const h=u*m/(8.314462618*f);c.m[p+at]=h*.79*gt[at],c.m[p+lt]=h*.21*gt[lt]}return c.r[a]=n,this.solve(a,f),c.H[a]=Yc(c.m,p,c.Tb[a],fe),r.ledger.water+=c.m[p+Q],r.ledger.air+=c.m[p+at]+c.m[p+lt],r.ledger.energy+=c.H[a],this.motion.ux0[a]=0,this.motion.uy0[a]=0,a}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*ft,n=t*de;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+Q],ma:e.m[s+at]+e.m[s+lt],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+de))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return pt}}const ff=20,uf=.1,df=2,hf=.004,mf=1.5,ea=.006,sa=2;function hd(o,t,e){const s=o==="normalize";return{chf:pf(t,e)*(s?uf:1),actMax:s?df:1e30,vmax:s?mf:ff,bubCap:s?hf:1e30}}function pf(o,t){const e=kt(o),s=Oe(e),n=_n(e);return .149*Math.sqrt(s)*sc(e)*Math.pow(Math.max(0,mi(e)*t*(n-s)),.25)}class md{constructor(t){x(this,"pending",null);x(this,"asked",!1);x(this,"heldHeat",0);x(this,"vented",0);x(this,"slowed",0);x(this,"maxBubble",0);x(this,"maxSpeed",0);x(this,"wall",new Float64Array(0));x(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?hf:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=pf(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?uf:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,df):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?mf:ff;let n=0;for(let r=0;r<t.count;r+=1){const c=Math.hypot(t.vx[r],t.vy[r]);if(c>s){const a=s/c;t.vx[r]*=a,t.vy[r]*=a,this.slowed+=1,n=Math.max(n,s)}else c>n&&(n=c)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>ea?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>sa&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}observe(t,e,s){this.maxBubble=t,this.maxSpeed=e,!(this.mode!=="ask"||this.asked)&&(t>ea?(this.pending={kind:"bubble",value:t,time:s},this.asked=!0):e>sa&&(this.pending={kind:"speed",value:e,time:s},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function na(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const pd={mass:0,energy:0},gd={m:0,H:0,s:0},bd={salt:0,energy:0};function xd(o,t,e,s,n,i,r=pd,c=[],a=gd,l=bd){const d=o.n;let f=0,u=0,m=0,p=0,h=0,g=0,v=0;for(let B=0;B<d;B+=1){const L=o.owner[B]!==0||o.capB[B]>0;if(o.kind[B]===pt||o.solid[B]!==0){L||(f+=o.Es[B],h+=o.film[B],g+=o.crust[B]);continue}u+=o.Hg[B],m+=o.mg[Q*d+B],p+=o.mfog[B],v+=o.mg[at*d+B]+o.mg[lt*d+B]}let w=0,b=0,_=0,F=0;for(let B=0;B<t.count;B+=1){w+=t.mass[B]*t.h[B];const L=t.smass[2*B];F+=L,t.mat[B]===ut?b+=t.mass[B]-L:_+=t.mass[B]-L}f+=r.energy,f+=l.energy;let k=0;for(const B of c)B.gone||(f+=B.energy(),h+=B.filmMass(),g+=B.crustMass(),Ie(B.mat)>0&&(k+=B.m));w+=a.H,b+=a.m,F+=a.s;let P=0,y=0;for(let B=0;B<e.count;B+=1)P+=e.H[B],y+=e.m[B*ft+Q],v+=e.m[B*ft+at]+e.m[B*ft+lt];const A=s.pvTerm();i.solids=f,i.liquid=w,i.gas=u,i.bubbles=P,i.pv=A,i.energy=f+w+u+P+A;const S=i.water;S.liquid=b,S.ice=k,S.vapour=m,S.fog=p,S.film=h,S.bubbles=y,S.escaped=n.escapedWater,S.total=b+k+m+p+h+y+n.escapedWater;const T=i.other;T.liquid=_,T.escaped=n.escapedOther,T.total=_+n.escapedOther;const M=i.salt;return M.liquid=F,M.crust=g,M.grains=l.salt,M.floor=r.mass,M.escaped=n.escapedSalt,M.total=F+g+l.salt+r.mass+n.escapedSalt,i.air=v+n.escapedAir,i}function vd(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,grains:0,floor:0,escaped:0,total:0}}}function Rn(o,t){o.bodies.list.length!==0&&Gu(o.bodies,t,o.ledger)}function yd(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)It.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(Fi(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)It.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*ft+Q],o.ledger.air-=n.m[i*ft+at]+n.m[i*ft+lt],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function to(o,t,e,s,n,i,r,c,a=-1){const l=o.bodies.adopt(t,e,s,o.opIndex,n,a);if(l===null)return null;i!==0&&o.bodies.turn(l,r,c,i*Math.PI/180),o.ledger.energy+=l.energy(),Ie(l.mat)>0&&(o.ledger.water+=l.m),yd(o,l);const d=o.grid,f=new Map,u=d.dx*d.dx;for(let m=0;m<l.nw;m+=1){const p=l.wc[m];f.set(p,(f.get(p)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*u))}for(const[m,p]of f)p>0&&d.solid[m]===0&&wd(o,m,Math.min(1,p));return l}function Yi(o,t,e){const[s,n,i,r]=Tn(t),c=Math.max(0,Math.floor(s/o.dx)),a=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),d=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=l;f<=d;f+=1)for(let u=c;u<=a;u+=1)Xe(t,(u+.5)*o.dx,(f+.5)*o.dx)&&e(u+f*o.nx,u,f)}function _i(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Q*s+t]+e.mfog[t],o.ledger.air-=e.mg[at*s+t]+e.mg[lt*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<ft;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function wd(o,t,e){if(e>=1){_i(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[Q*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[at*n+t]+s.mg[lt*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<ft;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function xc(o,t,e,s){const n=o.grid,i=n.n;_i(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Q*i+t],o.ledger.air+=n.mg[at*i+t]+n.mg[lt*i+t],o.ledger.energy+=n.Hg[t]}function Fi(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===ut?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function vc(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function gf(o,t){const e=o.grains,s=o.grid;for(let n=0;n<e.count;n+=1)(t!==null?!Xe(t,e.x[n],e.y[n]):s.solid[Math.max(0,s.cellAt(e.x[n],e.y[n]))]===0)||(qe[e.mat[n]].dissolves&&(o.ledger.salt-=e.m[n]),o.ledger.energy-=e.enthalpy(n),e.remove(n),n-=1)}function eo(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)Xe(t,e.x[n],e.y[n])&&(Fi(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)Xe(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*ft+Q],o.ledger.air-=s.m[n*ft+at]+s.m[n*ft+lt],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function _d(o,t,e,s,n){const i=o.grid,r=dt[e];for(const a of t)i.owner[a]!==0&&i.solid[a]!==0||(i.solid[a]!==0?(o.ledger.energy-=i.Es[a],o.ledger.water-=i.film[a],vc(o,a)):_i(o,a),i.owner[a]=0,i.capB[a]=0,i.fs[a]=0,i.crust[a]=0,i.solid[a]=e+1,i.role[a]=0,i.heater[a]=n,i.film[a]=0,i.T[a]=s,i.Es[a]=r.rho*r.cp*i.vCell*(s-nt),i.kind[a]=pt,o.ledger.energy+=i.Es[a]);gf(o,null);const c=o.particles;for(let a=0;a<c.count;a+=1){const l=i.cellAt(c.x[a],c.y[a]);l<0||i.solid[l]===0||(Fi(o,a),o.liquid.removeParticle(a),a-=1)}o.solidsChanged()}function Fd(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],vc(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&xc(o,n,o.ambientT,o.ambientY)}}function Pd(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){eo(o,t.region);const g=new Float64Array(ft);let v=0;for(const[w,b]of Object.entries(t.composition)){const _=w==="N2"?at:w==="O2"?lt:w==="H2O"?Q:-1;_>=0&&(g[_]=b,v+=b)}if(v<=0)g.set(o.ambientY.subarray(0,ft));else for(let w=0;w<Ft;w+=1)g[w]/=v;return Yi(e,t.region,w=>{e.solid[w]===0&&xc(o,w,t.T,g)}),null}eo(o,t.region);const s=re.length;let n=0;for(const[g,v]of Object.entries(t.composition))jl(g)>=0&&v>0&&(n+=v);const i=t.composition[re[ut].id]??0,r=n>0&&i>0?n/(n+i):0,c=g=>g===ut&&r>0?Ir(t.T,r):qs(g,t.T),a=new Float64Array(s);let l=0;for(const[g,v]of Object.entries(t.composition)){const w=kl(g);if(w<0||!(v>0))continue;const b=w===ut&&r>0?v+n:v;a[w]+=b/c(w),l+=b/c(w)}if(l<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)a[g]/=l;const d=new Float64Array(s),f=new Float64Array(s);for(let g=0;g<s;g+=1)d[g]=c(g)*e.vCell/4,f[g]=g===ut&&r>0?Wl(t.T,r):a0(g,t.T);const u=r*d[ut],m=new Float64Array(s),p=o.particles;let h=!1;return oa(e,t.region,(g,v)=>{const w=g+v*e.nx;if(e.solid[w]!==0)return;let b=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const k=(g+.25+.5*F)*e.dx,P=(v+.25+.5*_)*e.dx;if(!Xe(t.region,k,P)||e.owner[w]!==0&&o.bodies.bodyAt(k,P,0)!==null)continue;let y=0;for(let M=0;M<s;M+=1)m[M]+=a[M],m[M]>m[y]&&(y=M);m[y]-=1;const A=d[y],S=f[y],T=y===ut?u:0;if(p.add(k,P,A,S,y,T)<0){h=!0;continue}b+=1,y===ut?o.ledger.water+=A-T:o.ledger.other+=A,o.ledger.salt+=T,o.ledger.energy+=A*S}b===4&&_i(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":h?"fill: particle capacity reached":null}case"grains":{const s=Kl(t.material);if(s<0)return`grains: unknown material "${t.material}"`;const n=qe[s],i=n.rho*E0*e.vCell/4,r=i/(n.rho*Math.PI*t.d*t.d*t.d/6);let c=!1;const a=new Uint8Array(e.n);for(let l=0;l<o.grains.count;l+=1){const d=e.cellAt(o.grains.x[l],o.grains.y[l]);d>=0&&(a[d]=1)}return oa(e,t.region,(l,d)=>{const f=l+d*e.nx;if(!(e.solid[f]!==0||a[f]!==0))for(let u=0;u<2;u+=1)for(let m=0;m<2;m+=1){const p=(l+.25+.5*m)*e.dx,h=(d+.25+.5*u)*e.dx;if(Xe(t.region,p,h)&&!(e.owner[f]!==0&&o.bodies.bodyAt(p,h,0)!==null)){if(o.grains.add(p,h,i,r,t.T,s)<0){c=!0;continue}n.dissolves&&(o.ledger.salt+=i),o.ledger.energy+=i*n.cp*(t.T-nt)}}}),c?"grains: capacity reached":null}case"erase":{Rn(o,t.region),eo(o,t.region),gf(o,t.region);const s=[];return Yi(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),Fd(o,s),null}case"move":{if(t.region!==null)return ia(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(a=>!a.gone&&a.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const a of s)a.worldBox(a.x,a.y,a.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,c=a=>s.includes(a)?!0:(a.worldBox(a.x,a.y,a.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return ia(o,{rect:i},t.dx,t.dy,c),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if($u(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=cn(t.material);if(s<0)return`solid: unknown material ${t.material}`;Rn(o,t.region);const n=[];if(Yi(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,c,a]=t.region.line,l=Math.ceil(Math.hypot(c-i,a-r)/(.5*e.dx))+1;for(let d=0;d<=l;d+=1){const f=e.cellAt(i+(c-i)*d/l,r+(a-r)*d/l);f>=0&&!n.includes(f)&&n.push(f)}}return o.bodies.sync(),_d(o,n,s,t.T,-1),null}case"body":{const s=cn(t.material);if(s<0)return`body: unknown material ${t.material}`;Rn(o,t.region);const n=t.region;let i=null,r,c=t.angle,a,l;if("line"in n){const[d,f,u,m]=n.line,p=Math.max(n.width,Math.hypot(u-d,m-f));a=(d+u)/2,l=(f+m)/2,r=[a-p/2,l-n.width/2,a+p/2,l+n.width/2],c+=Math.atan2(m-f,u-d)*180/Math.PI}else if("circle"in n){const[d,f,u]=n.circle,m=.5*u*Math.sqrt(Math.PI);r=[d-m,f-m,d+m,f+m],a=d,l=f,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[d,f,u,m]=Tn(n);r=[d,f,u,m],a=(d+u)/2,l=(f+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return to(o,[r],s,t.T,t.pinned,c,a,l),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=cn(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,c=t.y,a=t.y+t.h,l=t.lid?a-n:a,d=[[i,c,r,c+n],[i,c+n,i+n,l],[r-n,c+n,r,l]];t.lid&&d.push([i,l,r,a]);for(const f of d)Rn(o,{rect:[...f]});return to(o,d,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=cn(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return Rn(o,{rect:[...i]}),to(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function ia(o,t,e,s,n){const i=o.grid,{nx:r,ny:c,dx:a}=i,l=[];Yi(i,t,w=>{i.solid[w]!==0&&i.owner[w]===0&&l.push(w)});const d=Math.round(e/a),f=Math.round(s/a),u=l.length>0?d*a:e,m=l.length>0?f*a:s;if(u===0&&m===0)return;const p=o.bodies.list.length>0?Hu(o.bodies,t,n):[],h=o.particles,g=o.bubbles;for(let w=0;w<h.count;w+=1){if(!Xe(t,h.x[w],h.y[w]))continue;const b=h.x[w]+u,_=h.y[w]+m;if(b<=0||_<=0||b>=i.w||_>=i.h){Fi(o,w),o.liquid.removeParticle(w),w-=1;continue}h.x[w]=b,h.y[w]=_}for(let w=0;w<g.count;w+=1)Xe(t,g.x[w],g.y[w])&&(g.x[w]=Math.min(i.w-1e-6,Math.max(1e-6,g.x[w]+u)),g.y[w]=Math.min(i.h-1e-6,Math.max(1e-6,g.y[w]+m)),g.site[w]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(p.length===0)return;Hc(o.bodies,p,u,m),o.bodies.sync();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ra(o);return}const v=l.map(w=>({c:w,s:i.solid[w],role:i.role[w],heater:i.heater[w],T:i.T[w],Es:i.Es[w],film:i.film[w],crust:i.crust[w]}));for(const w of v)o.ledger.energy-=w.Es,o.ledger.water-=w.film,o.ledger.salt-=w.crust,i.solid[w.c]=0,i.role[w.c]=0,i.heater[w.c]=-1,i.Es[w.c]=0,i.film[w.c]=0,i.crust[w.c]=0,i.kind[w.c]=0;for(const w of v){const b=w.c%r+d,_=Math.floor(w.c/r)+f;if(b<0||_<0||b>=r||_>=c)continue;const F=b+_*r;i.solid[F]!==0?(o.ledger.energy-=i.Es[F],o.ledger.water-=i.film[F],vc(o,F)):_i(o,F),i.solid[F]=w.s,i.role[F]=w.role,i.heater[F]=w.heater,i.T[F]=w.T,i.Es[F]=w.Es,i.film[F]=w.film,i.crust[F]=w.crust,i.kind[F]=pt,o.ledger.energy+=w.Es,o.ledger.water+=w.film,o.ledger.salt+=w.crust}Hc(o.bodies,p,u,m),o.solidsChanged();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ra(o);for(const w of v)i.solid[w.c]===0&&o.gas.massOf(w.c)<=0&&xc(o,w.c,o.ambientT,o.ambientY)}function ra(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(Fi(o,s),o.liquid.removeParticle(s),s-=1)}}function oa(o,t,e){const[s,n,i,r]=Tn(t),c=Math.max(0,Math.floor(s/o.dx)),a=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),d=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=l;f<=d;f+=1)for(let u=c;u<=a;u+=1)e(u,f)}const Ad=new Set(["pinned","mode","power","target","on"]);function oi(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(Fn(n)&&n.id===t)return s}return-1}function kd(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&cn(t.material)>=0?t.material:o.material,r=(c,a,l,d)=>c===void 0||!Number.isFinite(c)?a:Math.max(l,Math.min(d,c));switch(o.op){case"body":{const[c,a,l,d]=Tn(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const f=(c+l)/2,u=(a+d)/2,m=r(t.w,l-c,.002,.5),p=r(t.h,d-a,.002,.5);return{...o,region:{rect:[f-m/2,u-p/2,f+m/2,u+p/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function Sd(o,t,e){const s=oi(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=kd(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([a,l])=>l!==void 0&&!Ad.has(a)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const a of o.bodies.list)a.gone||a.key!==s||(e.pinned!==void 0&&o.bodies.pin(a,e.pinned),i.op==="hotplate"&&a.heater>=0&&o.setHeater(a.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function Td(o,t){const e=oi(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,c=0,a="gone";for(const l of o.bodies.list){if(l.gone||l.key!==e)continue;const d=Math.cos(l.a),f=Math.sin(l.a);for(let p=0;p<l.nr;p+=1){const[h,g,v,w]=l.bounds(p);for(const[b,_]of[[h,g],[v,g],[v,w],[h,w]])n.push(l.x+d*b-f*_,l.y+f*b+d*_)}i+=l.m;const u=l.m*dt[l.mat].cp;r+=u*l.meanT(),c+=u;const m=l.pinned?"pinned":l.asleep?"asleep":"moving";(a==="gone"||m==="moving")&&(a=m)}return{id:t,kind:s.op,outline:n,T:c>0?r/c:s.T,mass:i,state:a}}const Md=.02;function Bd(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function Cd(o,t){const e=2*Math.max(0,o-Md)*t;return e>1e-8?e/Bd(e):1}function Ld(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:c}=o,a=s+1,l=(b,_)=>.5*(r[b+_*a]+r[b+1+_*a]),d=(b,_)=>.5*(c[b+_*s]+c[b+(_+1)*s]),f=(r[t+1+e*a]-r[t+e*a])/i,u=(c[t+(e+1)*s]-c[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),h=Math.max(0,t-1),g=Math.min(s-1,t+1),v=p>m?(l(t,p)-l(t,m))/((p-m)*i):0,w=g>h?(d(g,e)-d(h,e))/((g-h)*i):0;return Math.hypot(.5*(f-u),.5*(v+w))}class Od{constructor(t){x(this,"e");x(this,"cap");x(this,"capT");x(this,"capA");x(this,"salt");x(this,"water");x(this,"fH");x(this,"fS");x(this,"outS");x(this,"outH");x(this,"inS");x(this,"inH");x(this,"cell",new Int32Array(0));x(this,"cpp",new Float64Array(0));x(this,"ds",new Float64Array(0));x(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:c,salt:a,water:l,fH:d,fS:f,cell:u,cpp:m}=this;i.fill(0),r.fill(0),c.fill(0),a.fill(0),l.fill(0);let p=!1;for(let b=0;b<e.count;b+=1){const _=s.cellAt(e.x[b],e.y[b]);if(u[b]=_,_<0)continue;const F=e.cp(b);m[b]=F;const k=e.mass[b]*F,P=e.T[b];if(i[_]+=k,r[_]+=k*P,c[_]+=k*Vn(e.mat[b],P)/(e.rho[b]*F),e.mat[b]!==ut)continue;const y=e.smass[2*b];a[_]+=y,l[_]+=e.mass[b]-y,y>0&&(p=!0)}const{nx:h,ny:g,kind:v}=s,w=Math.PI*Math.PI*t/(s.dx*s.dx);for(let b=0;b<s.n;b+=1){if(d[b]=0,f[b]=0,!(i[b]>0))continue;const _=b%h,F=(b-_)/h;if(!(v[b]!==it&&(v[b]!==H||!(_>0&&v[b-1]===it||_<h-1&&v[b+1]===it||F>0&&v[b-h]===it||F<g-1&&v[b+h]===it)))&&(d[b]=1-Math.exp(-w*c[b]/i[b]),p&&a[b]>0)){const k=So(r[b]/i[b]);f[b]=1-Math.exp(-w*k*Cd(Ld(s,_,F),t/(w*k)))}}for(let b=0;b<e.count;b+=1){const _=u[b];if(_<0||d[_]===0)continue;const F=d[_]*(r[_]/i[_]-e.T[b]);if(F===0)continue;const k=e.mass[b]/e.rho[b];e.h[b]+=m[b]*F,e.derive(b),n.dVp[b]+=e.mass[b]/e.rho[b]-k}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:c,outH:a,inS:l,inH:d,cell:f,ds:u,hs:m}=this;c.fill(0),a.fill(0);for(let h=0;h<e.count;h+=1){u[h]=0;const g=f[h];if(g<0||r[g]===0||e.mat[h]!==ut)continue;const v=e.smass[2*h],w=r[g]*(n[g]/i[g]*(e.mass[h]-v)-v);if(u[h]=w,w<0){const b=Bc(e.T[h],v/e.mass[h]);m[h]=b,c[g]-=w,a[g]-=w*b}}const p=this.saltBetween(t);for(let h=0;h<e.count;h+=1){const g=f[h];if(g<0||e.mat[h]!==ut)continue;let v=u[h],w=0;v<0?w=v*m[h]:v>0&&(c[g]>0?w=v*a[g]/c[g]:v=0);const b=e.smass[2*h],_=e.mass[h];if(p&&(l[g]!==0||d[g]!==0)){const P=l[g]<0?b/n[g]:(_-b)/i[g];v+=l[g]*P,w+=d[g]*P}if(v===0&&w===0)continue;const F=_*e.h[h]+w,k=_/e.rho[h];e.mass[h]=_+v,e.smass[2*h]=b+v,e.spc[2*h]=b+v>0?xi:0,e.h[h]=F/e.mass[h],e.derive(h),s.dVp[h]+=e.mass[h]/e.rho[h]-k}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:c,inS:a,inH:l}=this,{nx:d,ny:f}=e;a.fill(0),l.fill(0);const u=t/(e.dx*e.dx);let m=!1;const p=(h,g,v)=>{if(i[g]===0||!(n[g]>0)||!(v>0))return;const w=s[h]/n[h],b=s[g]/n[g];if(w===b)return;const _=w>b?h:g,F=w>b?g:h,k=So(.5*(c[h]/r[h]+c[g]/r[g])),P=(v<1?v*k:k)*u*Math.min(n[h],n[g])*Math.abs(w-b),y=Bc(c[_]/r[_],s[_]/(s[_]+n[_]));a[_]-=P,l[_]-=P*y,a[F]+=P,l[F]+=P*y,m=!0};for(let h=0;h<f;h+=1)for(let g=0;g<d;g+=1){const v=g+h*d;i[v]===0||!(n[v]>0)||(g+1<d&&p(v,v+1,e.au[g+1+h*(d+1)]),h+1<f&&p(v,v+d,e.av[v+d]))}return m}}function qd(o,t){const e=o.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let a=0;a<n;a+=1)for(let l=0;l<s;l+=1){const d=l+a*s;e.solid[d]===0&&(e.kind[d]===it||Xe(t.region,(l+.5)*e.dx,(a+.5)*e.dx))&&(i[d]=1)}const r=new Uint8Array(e.n),c=[];for(let a=0;a<e.n;a+=1){if(i[a]===0||r[a]!==0)continue;let l=!1;for(c.push(a),r[a]=1;c.length>0;){const d=c.pop(),f=d%s,u=(d-f)/s,m=o.gas,p=[m.across(d,f,u,0),m.across(d,f,u,1),m.across(d,f,u,2),m.across(d,f,u,3)];(f===0&&e.openL||f===s-1&&e.openR||u===0&&e.openB||u===n-1&&e.openT)&&(l=!0);for(const h of p)if(!(h<0||e.solid[h]!==0)){if(i[h]===0){l=!0;continue}r[h]===0&&(r[h]=1,c.push(h))}}if(!l)return!1}return!0}const Wt=Ft+2,ae=Ft,me=Ft+1,Ed=.9,Rd=16;class Hn{constructor(t,e){x(this,"g");x(this,"gas");x(this,"conc");x(this,"fu");x(this,"fv");x(this,"outM");x(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Wt*s),this.fu=new Float64Array(Wt*t.nu),this.fv=new Float64Array(Wt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:c}=e,a=s+1,l=e.ug,d=e.vg;let f=0,u=0;for(let _=0;_<n;_+=1)for(let F=0;F<s;F+=1){const k=F+_*s;if(r[k]!==H)continue;const P=F+_*a,y=l[P],A=l[P+1],S=d[k],T=d[k+s],M=(y<0?-y:0)+(A>0?A:0)+(S<0?-S:0)+(T>0?T:0);M>f&&(f=M);const B=Math.max(y<0?-y:y,A<0?-A:A,S<0?-S:S,T<0?-T:T);B>u&&(u=B)}this.gas.last.uMax=u;const m=Math.min(Rd,Math.max(1,Math.ceil(f*t/c/Ed))),p=t/m,{conc:h}=this,g=this.gas.vgas,v=e.mg,w=e.mfog,b=e.Hg;for(let _=0;_<m;_+=1){for(let F=0;F<i;F+=1){if(r[F]!==H){for(let P=0;P<Wt;P+=1)h[P*i+F]=0;continue}const k=1/g[F];for(let P=0;P<Ft;P+=1)h[P*i+F]=v[P*i+F]*k;h[ae*i+F]=w[F]*k,h[me*i+F]=b[F]*k}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let _=0;_<i;_+=1)r[_]===H&&this.gas.deriveCell(_);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=s+1,a=e.nu,l=e.ug,{conc:d,fu:f}=this,{amb:u,gasU:m}=this.gas,p=e.aFace,h=Hn.face;for(let g=0;g<n;g+=1){const v=g*s,w=g*c;for(let b=0;b<=s;b+=1){const _=w+b,F=l[_];if(m[_]===0||F===0){for(let S=0;S<Wt;S+=1)f[S*a+_]=0;continue}const k=e.au[_]<1?F*p*t*e.au[_]:F*p*t;if(b===0||b===s){const S=b===0?v:v+s-1,T=b===0?F>0:F<0;for(let M=0;M<Wt;M+=1)f[M*a+_]=k*(T?u[M]:d[M*i+S]);continue}let P,y,A;if(F>0?(P=v+b-1,y=v+b,A=b>=2&&r[v+b-2]===H?v+b-2:-1):(P=v+b,y=v+b-1,A=b+1<s&&r[v+b+1]===H?v+b+1:-1),A<0){for(let S=0;S<Wt;S+=1)f[S*a+_]=k*d[S*i+P];continue}for(let S=0;S<Wt;S+=1){const T=S*i;f[S*a+_]=k*h(d[T+P],d[T+A],d[T+y])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=e.nv,a=e.vg,{conc:l,fv:d}=this,{amb:f,gasV:u}=this.gas,m=e.aFace,p=Hn.face;for(let h=0;h<=n;h+=1){const g=h*s;for(let v=0;v<s;v+=1){const w=g+v,b=a[w];if(u[w]===0||b===0){for(let y=0;y<Wt;y+=1)d[y*c+w]=0;continue}const _=e.av[w]<1?b*m*t*e.av[w]:b*m*t;if(h===0||h===n){const y=h===0?v:v+(n-1)*s,A=h===0?b>0:b<0;for(let S=0;S<Wt;S+=1)d[S*c+w]=_*(A?f[S]:l[S*i+y]);continue}let F,k,P;if(b>0?(F=w-s,k=w,P=h>=2&&r[w-2*s]===H?w-2*s:-1):(F=w,k=w-s,P=h+1<n&&r[w+s]===H?w+s:-1),P<0){for(let y=0;y<Wt;y+=1)d[y*c+w]=_*l[y*i+F];continue}for(let y=0;y<Wt;y+=1){const A=y*i;d[y*c+w]=_*p(l[A+F],l[A+P],l[A+k])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,c=t.nv,{fu:a,fv:l}=this,{gasU:d,gasV:f,escaped:u}=this.gas,m=t.mg,p=t.mfog,h=t.Hg;for(let g=0;g<s;g+=1){const v=g*e,w=g*i;for(let _=1;_<e;_+=1){const F=w+_;if(d[F]===0)continue;const k=v+_-1,P=k+1;for(let S=0;S<Ft;S+=1){const T=a[S*r+F];m[S*n+k]-=T,m[S*n+P]+=T}const y=a[ae*r+F];p[k]-=y,p[P]+=y;const A=a[me*r+F];h[k]-=A,h[P]+=A}if(d[w]!==0){const _=v;for(let P=0;P<Ft;P+=1){const y=a[P*r+w];m[P*n+_]+=y,u[P]-=y}const F=a[ae*r+w];p[_]+=F,u[ae]-=F;const k=a[me*r+w];h[_]+=k,u[me]-=k}const b=w+e;if(d[b]!==0){const _=v+e-1;for(let P=0;P<Ft;P+=1){const y=a[P*r+b];m[P*n+_]-=y,u[P]+=y}const F=a[ae*r+b];p[_]-=F,u[ae]+=F;const k=a[me*r+b];h[_]-=k,u[me]+=k}}for(let g=1;g<s;g+=1){const v=g*e;for(let w=0;w<e;w+=1){const b=v+w;if(f[b]===0)continue;const _=b-e,F=b;for(let y=0;y<Ft;y+=1){const A=l[y*c+b];m[y*n+_]-=A,m[y*n+F]+=A}const k=l[ae*c+b];p[_]-=k,p[F]+=k;const P=l[me*c+b];h[_]-=P,h[F]+=P}}for(let g=0;g<e;g+=1){if(f[g]!==0){const w=g;for(let F=0;F<Ft;F+=1){const k=l[F*c+g];m[F*n+w]+=k,u[F]-=k}const b=l[ae*c+g];p[w]+=b,u[ae]-=b;const _=l[me*c+g];h[w]+=_,u[me]-=_}const v=g+s*e;if(f[v]!==0){const w=g+(s-1)*e;for(let F=0;F<Ft;F+=1){const k=l[F*c+v];m[F*n+w]-=k,u[F]+=k}const b=l[ae*c+v];p[w]-=b,u[ae]+=b;const _=l[me*c+v];h[w]-=_,u[me]+=_}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:c,outM:a,scale:l}=this,d=t.nu,f=t.nv;a.fill(0);const u=Hn.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let v=0;v<=e;v+=1){const w=v+g*i;if(m[w]===0)continue;const b=u(r,d,w);b>0&&v>0?a[v-1+g*e]+=b:b<0&&v<e&&(a[v+g*e]-=b)}for(let g=0;g<=s;g+=1)for(let v=0;v<e;v+=1){const w=v+g*e;if(p[w]===0)continue;const b=u(c,f,w);b>0&&g>0?a[v+(g-1)*e]+=b:b<0&&g<s&&(a[v+g*e]-=b)}let h=!1;for(let g=0;g<n;g+=1){const v=.9*this.gas.massOf(g);l[g]=a[g]>v&&a[g]>0?v/a[g]:1,l[g]<1&&(h=!0)}if(h){for(let g=0;g<s;g+=1)for(let v=0;v<=e;v+=1){const w=v+g*i;if(m[w]===0)continue;const _=u(r,d,w)>0?v>0?v-1+g*e:-1:v<e?v+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Wt;F+=1)r[F*d+w]*=l[_]}for(let g=0;g<=s;g+=1)for(let v=0;v<e;v+=1){const w=v+g*e;if(p[w]===0)continue;const _=u(c,f,w)>0?g>0?v+(g-1)*e:-1:g<s?v+g*e:-1;if(!(_<0||l[_]>=1))for(let F=0;F<Wt;F+=1)c[F*f+w]*=l[_]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=ae;i+=1)n+=t[i*e+s];return n}}const te=.05,Id=400;class jd{constructor(t,e,s){x(this,"g");x(this,"R");x(this,"solver");x(this,"vgas");x(this,"rho");x(this,"nmol");x(this,"cap");x(this,"mu");x(this,"veos");x(this,"srcV");x(this,"veosMid");x(this,"mover");x(this,"gasU");x(this,"gasV");x(this,"u0");x(this,"v0");x(this,"u1");x(this,"v1");x(this,"lim");x(this,"amb",new Float64Array(Wt));x(this,"ambT",293.15);x(this,"escaped",new Float64Array(Wt));x(this,"dp0",new Float64Array(8));x(this,"queue");x(this,"seen");x(this,"seenTag",0);x(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});x(this,"lo",0);x(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.queue=new Int32Array(n),this.seen=new Int32Array(n),this.mover=new Hn(t,this)}setAmbient(t,e,s){let n=0;for(let c=0;c<Ft;c+=1)n+=s[c]/gt[c];const i=e/(Dt*t*n);let r=0;for(let c=0;c<Ft;c+=1)this.amb[c]=i*s[c],r+=i*s[c]*fe(c,t);this.amb[ae]=0,this.amb[me]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*Pt(e);for(let r=0;r<Ft;r+=1)i+=s.mg[r*n+t]*fe(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Ao(s.mg[t],s.mg[n+t],s.mg[Q*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],c=e.mg[Q*s+t],a=e.mfog[t],l=i+r+c;if(this.nmol[t]=i/gt[0]+r/gt[1]+c/gt[Q],l+a<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let d;if(a<=0)d=Fl(i,r,c,e.Hg[t]);else{d=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const u=(e.Hg[t]-this.enthalpy(t,d))/this.heatCapacity(t,d);if(d+=u,Math.abs(u)<1e-10)break}}d>150&&d<3e3||(d=Math.min(3e3,Math.max(150,Number.isFinite(d)?d:this.ambT))),e.T[t]=d,this.cap[t]=Ao(i,r,c,a,d),this.rho[t]=l/n,this.mu[t]=_l(i,r,c,d)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===pt){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===it&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Dt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===pt){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Q*e+s];if(t.kind[s]===it&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Dt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===pt||this.vgas[e]<=0?0:this.nmol[e]*Dt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<Ft;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,c=Math.max(.001,n)*i.vCell;let a=0;for(let f=0;f<Ft;f+=1)a+=s[f]/gt[f];const l=this.R.pAt(t)*c/(Dt*e*a);let d=0;for(let f=0;f<Ft;f+=1)i.mg[f*r+t]=l*s[f],d+=l*s[f]*fe(f,e);i.mfog[t]=0,i.Hg[t]=d,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let c=0;c<n;c+=1){const a=t[c],l=i[c];if(a===l||l===pt||a===pt)continue;r+=1;const d=c%s,f=(c-d)/s;let u=0;for(let m=0;m<4;m+=1){const p=this.across(c,d,f,m);p>=0&&i[p]===H&&t[p]===H&&(u+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(u<=0){l===it&&this.release(c);continue}if(l===it)for(let m=0;m<4;m+=1){const p=this.across(c,d,f,m);if(p<0||i[p]!==H||t[p]!==H)continue;const h=(this.vgas[p]>0?this.vgas[p]:e.vCell)/u;this.move(c,p,h)}else{let m=this.massOf(c),p=0;for(let h=0;h<4;h+=1){const g=this.across(c,d,f,h);if(g<0||i[g]!==H||t[g]!==H)continue;const v=(this.vgas[g]>0?this.vgas[g]:e.vCell)/u;p+=v*this.rho[g]}if(p*=Math.max(.001,1-e.fs[c]-e.phi[c]-e.alpha[c])*e.vCell,p<=m)continue;for(let h=0;h<4;h+=1){const g=this.across(c,d,f,h);if(g<0||i[g]!==H||t[g]!==H)continue;const v=(this.vgas[g]>0?this.vgas[g]:e.vCell)/u,w=this.massOf(g);if(w<=0)continue;const b=Math.min(.25,(p-m)*v/w);this.move(g,c,b)}m=this.massOf(c),m>0&&(e.T[c]=this.ambT)}this.deriveCell(c)}for(let c=0;c<n;c+=1)i[c]===it&&this.massOf(c)>0&&this.release(c);return r}release(t){const e=this.g,{nx:s,kind:n}=e,i=++this.seenTag,r=this.queue,c=this.seen;let a=0,l=0;for(r[l++]=t,c[t]=i;a<l&&l<Id;){const d=r[a++],f=d%s,u=(d-f)/s;for(let m=0;m<4;m+=1){const p=this.across(d,f,u,m);if(!(p<0||c[p]===i||n[p]===pt)){if(c[p]=i,n[p]===H){this.move(t,p,1),this.deriveCell(p),this.deriveCell(t);return}r[l++]=p}}}}across(t,e,s,n){const i=this.g,{nx:r,ny:c}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<c-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let a=0;a<Ft;a+=1){const l=n.mg[a*i+t]*s;n.mg[a*i+t]-=l,n.mg[a*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const c=n.Hg[t]*s;n.Hg[t]-=c,n.Hg[e]+=c,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,c=t.vg;for(let a=0;a<s;a+=1)for(let l=0;l<=e;l+=1){const d=l+a*i,f=l>0?n[l-1+a*e]:-1,u=l<e?n[l+a*e]:-1;let m=0;(f===H&&u===H||l===0&&t.openL&&u===H||l===e&&t.openR&&f===H)&&(m=1),t.au[d]<=0&&(m=0),this.gasU[d]=m,m===0&&(r[d]=f===it||u===it?f===pt||u===pt||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[d]:t.usol[d])}for(let a=0;a<=s;a+=1)for(let l=0;l<e;l+=1){const d=l+a*e,f=a>0?n[l+(a-1)*e]:-1,u=a<s?n[l+a*e]:-1;let m=0;(f===H&&u===H||a===0&&t.openB&&u===H||a===s&&t.openT&&f===H)&&(m=1),t.av[d]<=0&&(m=0),this.gasV[d]=m,m===0&&(c[d]=f===it||u===it?f===pt||u===pt||a===0&&!t.openB||a===s&&!t.openT?0:t.vl[d]:t.vsol[d])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,a=i+1,l=Math.min(i-1e-6,Math.max(0,e/c)),d=Math.min(r-1.000001,Math.max(0,s/c-.5)),f=Math.floor(l),u=Math.floor(d),m=l-f,p=d-u,h=t[f+u*a],g=t[f+1+u*a],v=t[f+(u+1)*a],w=t[f+1+(u+1)*a];return this.lo=Math.min(h,g,v,w),this.hi=Math.max(h,g,v,w),(1-p)*((1-m)*h+m*g)+p*((1-m)*v+m*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,a=Math.min(i-1.000001,Math.max(0,e/c-.5)),l=Math.min(r-1e-6,Math.max(0,s/c)),d=Math.floor(a),f=Math.floor(l),u=a-d,m=l-f,p=t[d+f*i],h=t[d+1+f*i],g=t[d+(f+1)*i],v=t[d+1+(f+1)*i];return this.lo=Math.min(p,h,g,v),this.hi=Math.max(p,h,g,v),(1-m)*((1-u)*p+u*h)+m*((1-u)*g+u*v)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:c}=s,a=n+1,l=s.ug,d=s.vg,{u0:f,v0:u,u1:m,v1:p}=this,h=this.lim;f.set(l),u.set(d);for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*a;if(this.gasU[F]===0){m[F]=f[F];continue}const k=_*r,P=(b+.5)*r,y=this.sampleV(u,k,P);m[F]=this.sampleU(f,k-t*f[F],P-t*y),h[2*F]=this.lo,h[2*F+1]=this.hi}const g=2*s.nu;for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0){p[F]=u[F];continue}const k=(_+.5)*r,P=b*r,y=this.sampleU(f,k,P);p[F]=this.sampleV(u,k-t*y,P-t*u[F]),h[g+2*F]=this.lo,h[g+2*F+1]=this.hi}for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*a;if(this.gasU[F]===0)continue;const k=_*r,P=(b+.5)*r,y=this.sampleV(u,k,P),A=this.sampleU(m,k+t*f[F],P+t*y);let S=m[F]+.5*(f[F]-A);(S<h[2*F]||S>h[2*F+1])&&(S=m[F]),l[F]=S}for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const k=(_+.5)*r,P=b*r,y=this.sampleU(f,k,P),A=this.sampleV(p,k+t*y,P+t*u[F]);let S=p[F]+.5*(u[F]-A);(S<h[g+2*F]||S>h[g+2*F+1])&&(S=p[F]),d[F]=S}const v=this.R;for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const k=b>0?_+(b-1)*n:-1,P=b<i?_+b*n:-1,y=k>=0&&c[k]===H?this.rho[k]:-1,A=P>=0&&c[P]===H?this.rho[P]:-1,S=Math.max(te,y>0&&A>0?.5*(y+A):Math.max(y,A));if(!(y>0||A>0))continue;const T=y>0?k:P,M=v.id[T],B=M>=0?v.rhoBar[M]:v.rhoAmb;d[F]-=t*e*(S-B)/S}m.set(l),p.set(d);const w=t/(r*r);for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*a;if(this.gasU[F]===0)continue;const k=_<n&&c[_+b*n]===H?_+b*n:_-1+b*n,P=this.mu[k]/Math.max(te,this.rho[k]),y=m[F],A=_<n?m[F+1]:y,S=_>0?m[F-1]:y,T=b>0?m[F-a]:s.openB?y:-y,M=b<i-1?m[F+a]:s.openT?y:-y;l[F]=y+Math.min(.2,w*P)*(A+S+T+M-4*y)}for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const k=b<i&&c[_+b*n]===H?_+b*n:_+(b-1)*n,P=this.mu[k]/Math.max(te,this.rho[k]),y=p[F],A=b<i?p[F+n]:y,S=b>0?p[F-n]:y,T=_>0?p[F-1]:s.openL?y:-y,M=_<n-1?p[F+1]:s.openR?y:-y;d[F]=y+Math.min(.2,w*P)*(M+T+S+A-4*y)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==H){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:c,kind:a}=n,l=i+1,d=n.ug,f=n.vg;let u=i,m=-1,p=r,h=-1,g=0;for(let P=0;P<r;P+=1)for(let y=0;y<i;y+=1)a[y+P*i]===H&&(g+=1,y<u&&(u=y),y>m&&(m=y),P<p&&(p=P),P>h&&(h=P));const v=this.last.solve;if(v.iterations=0,v.residual=0,v.capped=!1,this.last.cells=g,g===0)return this.last;const w=this.solver,b=w.begin(m-u+1,h-p+1),_=this.rho;for(let P=p;P<=h;P+=1)for(let y=u;y<=m;y+=1){const A=y+P*i;if(a[A]!==H)continue;const S=w.at(y-u,P-p);b.act[S]=1,b.x[S]=n.pg[A];const T=y+P*l,M=y+P*i,B=this.fluxU(T+1)-this.fluxU(T)+this.fluxV(M+i)-this.fluxV(M);b.b[S]=n.Sg[A]*c*c-c*B;const L=Math.max(te,_[A]);y+1<i?a[A+1]===H&&y+1<=m&&this.gasU[T+1]!==0&&(b.ax[S]=n.au[T+1]*2*t/(L+Math.max(te,_[A+1]))):n.openR&&this.gasU[T+1]!==0&&(b.dDx[S]+=n.au[T+1]*2*t/L),y===0&&n.openL&&this.gasU[T]!==0&&(b.dDx[S]+=n.au[T]*2*t/L),P+1<r?a[A+i]===H&&P+1<=h&&this.gasV[M+i]!==0&&(b.ay[S]=n.av[M+i]*2*t/(L+Math.max(te,_[A+i]))):n.openT&&this.gasV[M+i]!==0&&(b.dDy[S]+=n.av[M+i]*2*t/L),P===0&&n.openB&&this.gasV[M]!==0&&(b.dDy[S]+=n.av[M]*2*t/L)}const F=w.solve(e,s,!0);v.iterations=F.iterations,v.residual=F.residual,v.capped=F.capped;const k=n.pg;for(let P=0;P<n.n;P+=1)a[P]!==H&&(k[P]=0);for(let P=p;P<=h;P+=1)for(let y=u;y<=m;y+=1){const A=y+P*i;a[A]===H&&(k[A]=b.x[w.at(y-u,P-p)])}for(let P=0;P<r;P+=1)for(let y=0;y<=i;y+=1){const A=y+P*l;if(this.gasU[A]===0)continue;if(y===0){d[A]-=2*t/Math.max(te,_[P*i])/c*k[P*i];continue}if(y===i){d[A]+=2*t/Math.max(te,_[i-1+P*i])/c*k[i-1+P*i];continue}const S=y-1+P*i,T=y+P*i;d[A]-=2*t/(Math.max(te,_[S])+Math.max(te,_[T]))/c*(k[T]-k[S])}for(let P=0;P<=r;P+=1)for(let y=0;y<i;y+=1){const A=y+P*i;if(this.gasV[A]===0)continue;if(P===0){f[A]-=2*t/Math.max(te,_[y])/c*k[y];continue}if(P===r){f[A]+=2*t/Math.max(te,_[y+(r-1)*i])/c*k[y+(r-1)*i];continue}const S=y+(P-1)*i,T=y+P*i;f[A]-=2*t/(Math.max(te,_[S])+Math.max(te,_[T]))/c*(k[T]-k[S])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const c=s.vGas[r];if(c<=0)continue;let a=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===pt||this.cap[f]<=0)continue;const u=this.nmol[f];a+=u*(u*Dt*e.T[f]/s.pAt(f))/this.cap[f]}a*=Dt/c;const l=1/Math.max(.05,1-a);let d=0;for(let f=0;f<4;f+=1){const u=s.statePressure(r);s.p0[r]=u;const m=(u-(t[r]+d))*l;if(Math.abs(m)<=1e-10*u)break;let p=0;for(let h=0;h<n;h+=1){if(s.id[h]!==r||e.kind[h]===pt||this.cap[h]<=0)continue;const g=this.nmol[h]*Dt*e.T[h]/s.pAt(h);p+=g,e.Hg[h]+=g*m,this.deriveCell(h)}d+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=d}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<Ft;i+=1)n+=e.mg[i*s+t]/gt[i];return n<=0?0:e.mg[Q*s+t]/gt[Q]/n*this.R.pAt(t)}}function Nd(o,t,e,s,n,i,r){const{nx:c,ny:a}=o,l=c+1,d=o.ul,f=o.vl;for(let u=0;u<o.nu;u+=1)s[u]=t[u]!==0?1:0;for(let u=0;u<o.nv;u+=1)n[u]=e[u]!==0?1:0;for(let u=0;u<2;u+=1){i.set(d),r.set(f);for(let m=0;m<a;m+=1)for(let p=0;p<=c;p+=1){const h=p+m*l;if(s[h]!==0)continue;let g=0,v=0;p>0&&s[h-1]===1&&(g+=d[h-1],v+=1),p<c&&s[h+1]===1&&(g+=d[h+1],v+=1),m>0&&s[h-l]===1&&(g+=d[h-l],v+=1),m<a-1&&s[h+l]===1&&(g+=d[h+l],v+=1),v>0&&(i[h]=g/v,s[h]=3)}for(let m=0;m<=a;m+=1)for(let p=0;p<c;p+=1){const h=p+m*c;if(n[h]!==0)continue;let g=0,v=0;p>0&&n[h-1]===1&&(g+=f[h-1],v+=1),p<c-1&&n[h+1]===1&&(g+=f[h+1],v+=1),m>0&&n[h-c]===1&&(g+=f[h-c],v+=1),m<a&&n[h+c]===1&&(g+=f[h+c],v+=1),v>0&&(r[h]=g/v,n[h]=3)}d.set(i),f.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let u=0;u<o.nu;u+=1)s[u]===0&&(d[u]=0);for(let u=0;u<o.nv;u+=1)n[u]===0&&(f[u]=0)}function Dd(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let c=0;c<o.count;c+=1){const a=Math.min(s-1,Math.max(0,Math.floor(o.x[c]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[c]/t.dx)));if(i[a+l*s]===it){e[c]=0;continue}let d=!1;for(let f=Math.max(0,l-2);f<=Math.min(n-1,l+2)&&!d;f+=1)for(let u=Math.max(0,a-2);u<=Math.min(s-1,a+2);u+=1)if(i[u+f*s]===it){d=!0;break}e[c]=d?0:1,d||(r=!0)}return r}function ci(o,t,e,s){const{nx:n,ny:i,dx:r}=o,c=n+1,a=1/r;let l=Math.min(n-1e-6,Math.max(0,t*a)),d=Math.min(i-1.000001,Math.max(0,e*a-.5)),f=Math.floor(l),u=Math.floor(d),m=l-f,p=d-u;const h=o.ul;s[0]=(1-p)*((1-m)*h[f+u*c]+m*h[f+1+u*c])+p*((1-m)*h[f+(u+1)*c]+m*h[f+1+(u+1)*c]),l=Math.min(n-1.000001,Math.max(0,t*a-.5)),d=Math.min(i-1e-6,Math.max(0,e*a)),f=Math.floor(l),u=Math.floor(d),m=l-f,p=d-u;const g=o.vl;s[1]=(1-p)*((1-m)*g[f+u*n]+m*g[f+1+u*n])+p*((1-m)*g[f+(u+1)*n]+m*g[f+1+(u+1)*n])}const Ud=18,Vd=1,Gd=.002,Hd=4,ca=.2687,aa=.245,la=.2;function $d(o,t,e,s,n){const i=Math.abs(t-e)/e,r=s/e;return i*n*o*o/(Ud*r+Math.sqrt(.75*Vd*i*n*o*o*o))}function $s(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Wd{constructor(t){x(this,"e");x(this,"head");x(this,"next",new Int32Array(0));x(this,"px",new Float64Array(0));x(this,"py",new Float64Array(0));x(this,"rad",new Float64Array(0));x(this,"w",new Float64Array(6));x(this,"vel",new Float64Array(2));x(this,"hit",new Float64Array(6));x(this,"lm");x(this,"lmT");x(this,"lv");x(this,"loc",new Float64Array(2));x(this,"h",0);x(this,"ks",0);x(this,"vmax",0);this.e=t,this.head=new Int32Array(t.grid.n),this.lm=new Float64Array(t.grid.n),this.lmT=new Float64Array(t.grid.n),this.lv=new Float64Array(t.grid.n)}dtLimit(){return this.vmax>0?.5*this.e.grid.dx/this.vmax:1/0}splatVolume(){const{grid:t,grains:e}=this.e,{nx:s,ny:n,dx:i}=t,r=t.grain;r.fill(0);const c=this.w,a=1/i,l=1/t.vCell;for(let d=0;d<e.count;d+=1){const f=e.m[d]/e.rho(d)*l,u=$s(e.x[d]*a-.5,c,0),m=$s(e.y[d]*a-.5,c,3);for(let p=0;p<3;p+=1){const h=m+p;if(!(h<0||h>=n))for(let g=0;g<3;g+=1){const v=u+g;v<0||v>=s||(r[v+h*s]+=c[g]*c[3+p]*f)}}}}step(t){const e=this.e.grains;if(e.count===0){this.vmax=0;return}this.next.length<e.cap&&(this.next=new Int32Array(e.cap),this.px=new Float64Array(e.cap),this.py=new Float64Array(e.cap),this.rad=new Float64Array(e.cap)),this.forces(t);const s=this.e.grid.dx;for(let r=0;r<e.count;r+=1)this.rad[r]=ca*s*Math.sqrt(Math.max(0,e.m[r]/e.m0[r]));this.ks=1/(4*ca*s);const n=Math.max(1,Math.ceil(t/Gd-1e-9));this.h=t/n;for(let r=0;r<n;r+=1)this.substep();this.escape();let i=0;for(let r=0;r<e.count;r+=1){const c=Math.hypot(e.vx[r],e.vy[r]);c>i&&(i=c)}this.vmax=i}forces(t){const e=this.e,{grid:s,grains:n}=e,i=e.gy,r=i>0?i:9.81;let c=!1;for(let a=0;a<n.count;a+=1){const l=s.cellAt(n.x[a],n.y[a]);if(!(l>=0&&s.kind[l]===it)){n.vy[a]-=i*t;continue}c||(this.gatherLiquid(),c=!0),this.liquidAt(l);const f=this.loc[0],u=this.loc[1],m=qe[n.mat[a]].rho,p=i*(1-u/m),h=$d(n.diameter(a),m,u,Os(f),r)/Math.max(1e-6,Math.abs(r*(1-u/m)));ci(s,n.x[a],n.y[a],this.vel);const g=n.vx[a],v=n.vy[a]-p*t,w=t/h,b=(g+w*this.vel[0])/(1+w),_=(v+w*this.vel[1])/(1+w);n.vx[a]=b,n.vy[a]=_,this.spread(n.x[a],n.y[a],-n.m[a]*(b-g)/t,-n.m[a]*(_-v)/t)}}gatherLiquid(){const{grid:t,particles:e}=this.e,{lm:s,lmT:n,lv:i}=this;s.fill(0),n.fill(0),i.fill(0);for(let r=0;r<e.count;r+=1){const c=t.cellAt(e.x[r],e.y[r]);if(c<0)continue;const a=e.mass[r];s[c]+=a,n[c]+=a*e.T[r],i[c]+=a/e.rho[r]}}liquidAt(t){const e=this.e.grid,{lm:s,lmT:n,lv:i,loc:r}=this;let c=s[t],a=n[t],l=i[t];if(!(c>0)){const d=t%e.nx,f=(t-d)/e.nx;for(let u=-1;u<=1;u+=1)for(let m=-1;m<=1;m+=1){const p=d+m,h=f+u;if(p<0||h<0||p>=e.nx||h>=e.ny)continue;const g=p+h*e.nx;c+=s[g],a+=n[g],l+=i[g]}}r[0]=c>0?a/c:this.e.ambientT,r[1]=c>0&&l>0?c/l:this.e.liquid.rhoRef}spread(t,e,s,n){const{grid:i,liquid:r}=this.e,{nx:c,ny:a,dx:l}=i,d=this.w,f=1/l;let u=$s(t*f,d,0),m=$s(e*f-.5,d,3);for(let p=0;p<3;p+=1)for(let h=0;h<3;h+=1){const g=u+h,v=m+p;g<0||g>c||v<0||v>=a||(r.fU[g+v*(c+1)]+=s*d[h]*d[3+p])}u=$s(t*f-.5,d,0),m=$s(e*f,d,3);for(let p=0;p<3;p+=1)for(let h=0;h<3;h+=1){const g=u+h,v=m+p;g<0||g>=c||v<0||v>a||(r.fV[g+v*c]+=n*d[h]*d[3+p])}}substep(){const{grid:t,grains:e}=this.e,{px:s,py:n,head:i,next:r}=this,{nx:c,ny:a}=t,l=this.h;for(let f=0;f<e.count;f+=1)s[f]=e.x[f],n[f]=e.y[f],e.x[f]+=l*e.vx[f],e.y[f]+=l*e.vy[f];i.fill(-1);for(let f=0;f<e.count;f+=1){const u=t.cellAt(e.x[f],e.y[f]);r[f]=i[u],i[u]=f}const d=1/t.dx;for(let f=0;f<Hd;f+=1){const u=(f&1)===1;for(let m=0;m<e.count;m+=1){const p=u?e.count-1-m:m,h=Math.min(c-1,Math.max(0,Math.floor(e.x[p]*d))),g=Math.min(a-1,Math.max(0,Math.floor(e.y[p]*d)));for(let v=-1;v<=1;v+=1){const w=g+v;if(!(w<0||w>=a))for(let b=-1;b<=1;b+=1){const _=h+b;if(!(_<0||_>=c))for(let F=i[_+w*c];F>=0;F=r[F])F!==p&&(u?F<p:F>p)&&this.pair(p,F)}}this.walls(p)}}for(let f=0;f<e.count;f+=1)e.vx[f]=(e.x[f]-s[f])/l,e.vy[f]=(e.y[f]-n[f])/l}pair(t,e){const s=this.e.grains,n=s.x[t]-s.x[e],i=s.y[t]-s.y[e],r=this.rad[t]+this.rad[e],c=n*n+i*i;if(c>=r*r||c<1e-24)return;const a=Math.sqrt(c),l=n/a,d=i/a,f=r-a,u=Math.exp(this.ks*s.y[t])/s.m[t],m=Math.exp(this.ks*s.y[e])/s.m[e],p=u/(u+m),h=m/(u+m);s.x[t]+=p*f*l,s.y[t]+=p*f*d,s.x[e]-=h*f*l,s.y[e]-=h*f*d;const g=s.x[t]-this.px[t]-(s.x[e]-this.px[e]),v=s.y[t]-this.py[t]-(s.y[e]-this.py[e]),w=g*l+v*d,b=g-w*l,_=v-w*d,F=Math.hypot(b,_);if(!(F>0))return;const k=F<aa*f?1:Math.min(1,la*f/F);s.x[t]-=p*k*b,s.y[t]-=p*k*_,s.x[e]+=h*k*b,s.y[e]+=h*k*_}walls(t){const e=this.e,{grid:s,grains:n}=e,i=this.rad[t],r=s.w,c=s.h;!s.openL&&n.x[t]<i&&this.wallContact(t,1,0,i-n.x[t],0,0),!s.openR&&n.x[t]>r-i&&this.wallContact(t,-1,0,n.x[t]-(r-i),0,0),!s.openB&&n.y[t]<i&&this.wallContact(t,0,1,i-n.y[t],0,0),!s.openT&&n.y[t]>c-i&&this.wallContact(t,0,-1,n.y[t]-(c-i),0,0);const a=e.liquid.bodyHit,l=a!==null?a(this.px[t],this.py[t],n.x[t],n.y[t],this.hit):0;if(l===1){const h=this.hit,g=Math.hypot(h[0]-n.x[t],h[1]-n.y[t]);this.wallContact(t,h[2],h[3],g,h[4],h[5]);return}if(l===2)return;const d=s.sdfAt(n.x[t],n.y[t]);if(d>=i)return;const f=.25*s.dx;let u=s.sdfAt(n.x[t]+f,n.y[t])-s.sdfAt(n.x[t]-f,n.y[t]),m=s.sdfAt(n.x[t],n.y[t]+f)-s.sdfAt(n.x[t],n.y[t]-f);const p=Math.hypot(u,m);p>1e-12&&(u/=p,m/=p,this.wallContact(t,u,m,i-d,0,0))}wallContact(t,e,s,n,i,r){if(!(n>0))return;const c=this.e.grains;c.x[t]+=n*e,c.y[t]+=n*s;const a=c.x[t]-this.px[t]-i*this.h,l=c.y[t]-this.py[t]-r*this.h,d=a*e+l*s,f=a-d*e,u=l-d*s,m=Math.hypot(f,u);if(!(m>0))return;const p=m<aa*n?1:Math.min(1,la*n/m);c.x[t]-=p*f,c.y[t]-=p*u}escape(){const t=this.e,{grid:e,grains:s}=t,n=e.w,i=e.h,r=1e-4*e.dx;for(let c=0;c<s.count;c+=1){const a=s.x[c],l=s.y[c];if(a<0&&e.openL||a>n&&e.openR||l<0&&e.openB||l>i&&e.openT){qe[s.mat[c]].dissolves&&(t.flows.escapedSalt+=s.m[c]),t.flows.escapedEnergy+=s.enthalpy(c),s.remove(c),c-=1;continue}(a<r||a>n-r)&&(s.vx[c]=0),(l<r||l>i-r)&&(s.vy[c]=0),s.x[c]=Math.min(n-r,Math.max(r,a)),s.y[c]=Math.min(i-r,Math.max(r,l))}}}const Ii=1e-5,Kd=2,fa=.025,zd=1e-4;function ua(o,t){const e=o<=1?1:Math.pow(Math.min(o,400),.077);return 1+Math.cbrt(1+o*t)*e}class Yd{constructor(t){x(this,"e");x(this,"head");x(this,"next",new Int32Array(0));x(this,"gHead");x(this,"gNext",new Int32Array(0));x(this,"listed",!1);x(this,"dissolved",0);x(this,"grown",0);x(this,"burst",0);x(this,"vel",new Float64Array(2));this.e=t,this.head=new Int32Array(t.grid.n),this.gHead=new Int32Array(t.grid.n)}invalidate(){this.listed=!1}list(){if(this.listed)return;const{grid:t,particles:e,grains:s}=this.e;this.next.length<e.cap&&(this.next=new Int32Array(e.cap)),this.gNext.length<s.cap&&(this.gNext=new Int32Array(s.cap)),this.head.fill(-1),this.gHead.fill(-1);for(let n=0;n<e.count;n+=1){if(e.mat[n]!==ut)continue;const i=t.cellAt(e.x[n],e.y[n]);i<0||(this.next[n]=this.head[i],this.head[i]=n)}for(let n=0;n<s.count;n+=1){const i=t.cellAt(s.x[n],s.y[n]);i<0||(this.gNext[n]=this.gHead[i],this.gHead[i]=n)}this.listed=!0}step(t){const{grains:e}=this.e;e.count!==0&&(this.listed=!1,this.list(),this.nucleate(t),this.heatAndDissolve(t),this.listed=!1)}grow(t,e,s,n){const{grid:i,grains:r}=this.e;if(r.count===0)return!1;this.list();const c=i.cellAt(t,e);if(c<0)return!1;const a=c%i.nx,l=(c-a)/i.nx;let d=-1,f=1/0;for(let m=-1;m<=1;m+=1)for(let p=-1;p<=1;p+=1){const h=a+p,g=l+m;if(!(h<0||g<0||h>=i.nx||g>=i.ny))for(let v=this.gHead[h+g*i.nx];v>=0;v=this.gNext[v]){if(!qe[r.mat[v]].dissolves)continue;const w=(r.x[v]-t)**2+(r.y[v]-e)**2;w<f&&(f=w,d=v)}}if(d<0)return!1;const u=r.enthalpy(d)+n;return r.m[d]+=s,r.T[d]=nt+u/(r.m[d]*r.cp(d)),this.grown+=s,!0}nucleate(t){const e=this.e,{grid:s,grains:n,bubbles:i,particles:r,liquid:c}=e;for(let a=0;a<n.count;a+=1){if(n.dry[a]===0)continue;const l=s.cellAt(n.x[a],n.y[a]);if(l<0||s.kind[l]!==it||this.head[l]<0)continue;const d=n.wet[a];if(n.wet[a]+=t,n.wet[a]>Kd){n.dry[a]=0;continue}if(d>0&&Math.floor(d/fa)===Math.floor(n.wet[a]/fa))continue;let f=0,u=0,m=0,p=0;for(let A=this.head[l];A>=0;A=this.next[A]){const S=r.smass[2*A],T=r.mass[A]-S;f+=T,u+=S,m+=T*r.T[A],p+=T*(S>0?dn(r.T[A],S/r.mass[A]):r.h[A])}if(!(f>0))continue;const h=m/f,g=Math.max(.5*e.pRef,e.pRef+s.pl[l]),v=u>0?rc(g,d0(u/(u+f))):kt(g);if(h-v<e.extremes.activation(Oo(Ii,g)))continue;const w=g+2*mi(h)/Ii,b=kt(w),_=4/3*Math.PI*Ii**3,F=Oe(b)*_;if(F*4>f)continue;const k=i.add(n.x[a],n.y[a],.5*s.depth);if(k<0)continue;i.m[k*ft+Q]=F,i.r[k]=Ii,i.V[k]=_,i.Tb[k]=b,i.pb[k]=w,i.pv[k]=w,i.H[k]=F*vt(b),i.site[k]=-1,i.age[k]=0,ci(s,n.x[a],n.y[a],this.vel);const P=e.bubbleModel.motionState;P.ux0[k]=this.vel[0],P.uy0[k]=this.vel[1],i.vx[k]=this.vel[0],i.vy[k]=this.vel[1];const y=p/f;for(let A=this.head[l];A>=0;A=this.next[A]){const S=r.smass[2*A],T=F*(r.mass[A]-S)/f,M=S>0?dn(r.T[A],S/r.mass[A]):r.h[A],B=r.mass[A]/r.rho[A],L=r.mass[A]*r.h[A]-T*M;r.mass[A]-=T,r.h[A]=L/r.mass[A],r.derive(A),c.dVp[A]+=r.mass[A]/r.rho[A]-B}e.heat.src[l]-=F*(vt(b)-y)/t,this.burst+=1}}heatAndDissolve(t){const e=this.e,{grid:s,grains:n,particles:i,liquid:r}=e,c=s.n;for(let a=0;a<n.count;a+=1){const l=s.cellAt(n.x[a],n.y[a]);if(l<0)continue;const d=qe[n.mat[a]];let f=0,u=0,m=0,p=0;for(let E=this.head[l];E>=0;E=this.next[E]){const I=i.smass[2*E];f+=i.mass[E]-I,u+=I,m+=i.mass[E]*i.T[E],p+=i.mass[E]}const h=f>0&&s.kind[l]===it,g=n.diameter(a),v=n.N[a]*Math.PI*g*g;ci(s,n.x[a],n.y[a],this.vel);const w=Math.hypot(n.vx[a]-this.vel[0],n.vy[a]-this.vel[1]),b=h?m/p:s.T[l];if(h||s.kind[l]===H){let E,I,j;if(h){const bt=_n(b);E=Qn(b),I=Os(b)/bt,j=E/(bt*Re(b))}else E=nc(s.mg[l],s.mg[c+l],s.mg[Q*c+l],b),I=16e-6,j=22e-6;const $=w*g/I,U=ua($,I/j)*E/g,J=n.m[a]*d.cp,et=(1-Math.exp(-t*U*v/J))*(b-n.T[a]);et!==0&&(n.T[a]+=et,e.heat.src[l]-=J*et/t)}if(!h||!d.dissolves)continue;const _=m/p,F=u/(u+f),k=Hl(_);if(F>=k)continue;const P=Ir(_,F),y=So(_),A=Os(_)/P,S=w*g/A,T=ua(S,A/y)*y/g,M=(k-F)/(1-k);let B=v*T*P*Math.log(1+M)*t;const L=(k*(u+f)-u)/(1-k);B>L&&(B=Math.max(0,L));const q=n.m[a]-B<zd*n.m0[a];if(q&&(B=n.m[a]),!(B>0))continue;const R=yi(n.T[a]);for(let E=this.head[l];E>=0;E=this.next[E]){const I=i.smass[2*E],j=B*(i.mass[E]-I)/f;if(!(j>0))continue;const $=i.mass[E]/i.rho[E],U=i.mass[E]*i.h[E]+j*R;i.mass[E]+=j,i.smass[2*E]=I+j,i.spc[2*E]=xi,i.h[E]=U/i.mass[E],i.derive(E),r.dVp[E]+=i.mass[E]/i.rho[E]-$}this.dissolved+=B,q?(n.remove(a),a-=1):n.m[a]-=B}}}const da=[1/6,2/3,1/6];class Xd{constructor(t,e,s,n){x(this,"nx");x(this,"ny");x(this,"n");x(this,"dx");x(this,"depth");x(this,"vCell");x(this,"aFace");x(this,"nu");x(this,"nv");x(this,"openL",!1);x(this,"openR",!1);x(this,"openB",!1);x(this,"openT",!0);x(this,"solid");x(this,"role");x(this,"heater");x(this,"phiS");x(this,"sdf");x(this,"owner");x(this,"fs");x(this,"capB");x(this,"matB");x(this,"Ts");x(this,"au");x(this,"av");x(this,"usol");x(this,"vsol");x(this,"thin");x(this,"thinAny",!1);x(this,"phi");x(this,"alpha");x(this,"grain");x(this,"kind");x(this,"region");x(this,"pl");x(this,"pg");x(this,"mg");x(this,"mfog");x(this,"Hg");x(this,"Es");x(this,"film");x(this,"crust");x(this,"T");x(this,"Tl");x(this,"Cl");x(this,"Sl");x(this,"Sg");x(this,"ul");x(this,"vl");x(this,"ug");x(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.grain=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(ft*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let c=0;c<t;c+=1){const a=c+r*t;i[a]===0&&(c>0&&s[c+r*(t+1)]<=0&&i[a-1]===0&&this.thinBlock(c-1,c,r-1,r+1),r>0&&n[a]<=0&&i[a-t]===0&&this.thinBlock(c-1,c+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:c}=this,a=s+1,l=t+e*s;let d=0;if(c[l]===0)for(let f=0;f<9;f+=1){const u=f%3-1,m=(f/3|0)-1,p=t+u,h=e+m;if(f===4||p<0||h<0||p>=s||h>=n||c[p+h*s]!==0)continue;const g=(u>0?1:0)+e*a,v=(m>0?1:0)*s;let w;if(m===0)w=i[t+g]<=0;else if(u===0)w=r[t+e*s+v]<=0;else{const b=c[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+v]<=0),_=c[t+h*s]===0&&(r[t+e*s+v]<=0||i[t+(u>0?1:0)+h*a]<=0);w=b&&_}w&&(d|=1<<f)}this.thin[l]=d}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let c=0;c<9;c+=1)i>>c&1?s[n+c]=0:r+=s[n+c];if(r>0)for(let c=0;c<9;c+=1)s[n+c]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:c}=this,a=Math.max(0,t),l=Math.max(0,e),d=Math.min(i-1,s),f=Math.min(r-1,n);for(let p=l;p<=f;p+=1)for(let h=a;h<=d;h+=1){const g=h+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let v=0;for(let w=-1;w<=1;w+=1)for(let b=-1;b<=1;b+=1)v+=da[b+1]*da[w+1]*this.solidShare(h+b,p+w);this.phiS[g]=v}const u=4,m=u*c;for(let p=l;p<=f;p+=1)for(let h=a;h<=d;h+=1){const g=h+p*i,v=this.solid[g]!==0,w=(h+.5)*c,b=(p+.5)*c;let _=m;v||(this.openL||(_=Math.min(_,w)),this.openR||(_=Math.min(_,this.w-w)),this.openB||(_=Math.min(_,b)),this.openT||(_=Math.min(_,this.h-b)));for(let F=-u;F<=u;F+=1){const k=p+F;if(!(k<0||k>=r))for(let P=-u;P<=u;P+=1){const y=h+P;if(y<0||y>=i||this.solid[y+k*i]!==0===v)continue;const S=Math.max(0,Math.abs(y+.5-(h+.5))-.5)*c,T=Math.max(0,Math.abs(k+.5-(p+.5))-.5)*c,M=Math.hypot(S,T);M<_&&(_=M)}}this.sdf[g]=v?-_:_}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),c=Math.min(n-1.0001,Math.max(0,e/i-.5)),a=Math.floor(r),l=Math.floor(c),d=r-a,f=c-l,u=Math.min(s-1,a+1),m=Math.min(n-1,l+1),p=this.sdf;let h=(1-f)*((1-d)*p[a+l*s]+d*p[u+l*s])+f*((1-d)*p[a+m*s]+d*p[u+m*s]);return this.openL||(h=Math.min(h,t)),this.openR||(h=Math.min(h,this.w-t)),this.openB||(h=Math.min(h,e)),this.openT||(h=Math.min(h,this.h-e)),h}}const Qd=5,ha=30;class Zd{constructor(t,e,s,n,i){x(this,"g");x(this,"P");x(this,"L");x(this,"G");x(this,"solver");x(this,"src");x(this,"C");x(this,"Cs");x(this,"Cg");x(this,"CTl");x(this,"Tstar");x(this,"k");x(this,"dE");x(this,"Tnew");x(this,"gx");x(this,"gy");x(this,"q");x(this,"Co");x(this,"CKo");x(this,"heaters",[]);x(this,"ambientT",293.15);x(this,"fluxSL",0);x(this,"fluxLG",0);x(this,"fluxSG",0);x(this,"lossSolids",0);x(this,"liquidPower",0);x(this,"hExt",Pl);x(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});x(this,"bodies",[]);x(this,"grains",null);x(this,"Cgr");x(this,"CTgr");x(this,"qb");x(this,"kS");x(this,"kF");x(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r),this.Cgr=new Float64Array(r),this.CTgr=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=dt[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*ds}solidEnergy(t,e){return this.solidCapCrust(t)*(e-nt)+this.g.film[t]*Pt(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=nt+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:nt+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Re(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let a=0;a<s.ncell;a+=1)r+=s.cellVolume(a);if(!(r>0))continue;const c=n.P*i/r;for(let a=0;a<s.nw;a+=1){const l=c*s.ww[a]*s.cellVolume(s.wk[a]);t[s.wc[a]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/Qd,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/ha);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/ha)))}}step(t,e,s){const{g:n,P:i,L:r,G:c}=this,{nx:a,ny:l,n:d,depth:f,dx:u}=n,{C:m,Cs:p,Cg:h,CTl:g,Tstar:v,k:w,q:b,src:_}=this;this.heaterPower(t),g.fill(0);const F=n.Cl;F.fill(0);const{Co:k,CKo:P}=this;let y=!1,A=0;for(let O=0;O<i.count;O+=1){const W=i.mat[O],G=i.T[O],ht=i.mass[O]*i.cp(O);A+=ht;const ct=9*O,_t=r.bi[O],Bt=r.bj[O],yt=W===ut?0:Vn(W,G);W!==ut&&!y&&(y=!0,k.fill(0),P.fill(0));for(let qt=0;qt<9;qt+=1){const At=r.wt[ct+qt];if(At===0)continue;const ke=_t+qt%3,St=Bt+(qt/3|0);if(ke<0||St<0||ke>=a||St>=l)continue;const hs=ke+St*a;F[hs]+=At*ht,g[hs]+=At*ht*G,W!==ut&&(k[hs]+=At*ht,P[hs]+=At*ht*yt)}}const{Cgr:S,CTgr:T}=this;S.fill(0),T.fill(0);const M=this.grains;if(M!==null)for(let O=0;O<M.count;O+=1){const W=n.cellAt(M.x[O],M.y[O]);if(W<0||n.solid[W]!==0)continue;const G=M.m[O]*M.cp(O);S[W]+=G,T[W]+=G*M.T[O]}const B=this.qb;B.fill(0);let L=this.bodyHeat(B);const{kS:q,kF:R,dSF:E}=this;for(let O=0;O<d;O+=1){let W=0,G=0;const ht=n.solid[O]!==0?n.T[O]:n.Ts[O];if(n.solid[O]!==0||n.capB[O]>0){W=this.solidCapCrust(O)+n.film[O]*Re(ht);const St=n.solid[O]!==0?dt[n.solid[O]-1]:dt[n.matB[O]-1];G=St!==void 0?St.k:0}const ct=c.cap[O]>0&&n.solid[O]===0?c.cap[O]:0,_t=F[O],Bt=W+ct+_t+S[O];if(p[O]=W,h[O]=ct,m[O]=Bt,E[O]=0,Bt<=0){v[O]=n.T[O],w[O]=0,b[O]=0;continue}const yt=(W*ht+ct*n.T[O]+g[O]+T[O])/Bt;v[O]=yt,_t>0&&(n.Tl[O]=g[O]/_t);let qt=G;if(n.solid[O]===0){const St=_t>=ct?y&&k[O]>0?((_t-k[O])*Qn(yt)+P[O])/_t:Qn(yt):nc(n.mg[O],n.mg[d+O],n.mg[Q*d+O],yt);if(W>0){const hs=Math.min(1,n.fs[O]);qt=hs*G+(1-hs)*St,q[O]=G,R[O]=St,ct+_t+S[O]>0&&(E[O]=ht-(ct*n.T[O]+g[O]+T[O])/(ct+_t+S[O]))}else qt=St}w[O]=qt;let At=_[O]+B[O];if(this.liquidPower!==0&&_t>0){const St=this.liquidPower*_t/A;At+=St,L+=St}const ke=n.heater[O];if(ke>=0&&n.role[O]===1){const St=this.heaters[ke];St!==void 0&&St.cells>0&&(At+=St.P/St.cells,L+=St.P/St.cells)}b[O]=At}const{gx:I,gy:j}=this;for(let O=0;O<l;O+=1)for(let W=0;W<a;W+=1){const G=W+O*a;if(I[G]=0,j[G]=0,m[G]<=0)continue;const ht=w[G];if(W+1<a&&m[G+1]>0){const ct=w[G+1];ht+ct>0&&(I[G]=2*ht*ct/(ht+ct)*f)}if(O+1<l&&m[G+a]>0){const ct=w[G+a];ht+ct>0&&(j[G]=2*ht*ct/(ht+ct)*f)}}const $=this.solver,U=$.begin(a,l),J=U.stride,et=u*f,bt=this.hExt*et,rt=this.ambientT;for(let O=0;O<l;O+=1)for(let W=0;W<a;W+=1){const G=W+O*a;if(m[G]<=0)continue;const ht=W+1+(O+1)*J;U.act[ht]=1,U.dH[ht]=m[G]/t;let ct=b[G];const _t=w[G],Bt=v[G];W+1<a&&(U.ax[ht]=I[G],ct+=I[G]*(v[G+1]-Bt)),W>0&&(ct+=I[G-1]*(v[G-1]-Bt)),O+1<l&&(U.ay[ht]=j[G],ct+=j[G]*(v[G+a]-Bt)),O>0&&(ct+=j[G-a]*(v[G-a]-Bt));let yt=0;W===0&&(yt+=this.sideConductance(n.openL,_t,bt,f)),W===a-1&&(yt+=this.sideConductance(n.openR,_t,bt,f)),O===0&&(yt+=this.sideConductance(n.openB,_t,bt,f)),O===l-1&&(yt+=this.sideConductance(n.openT,_t,bt,f)),yt>0&&(U.dDx[ht]=yt,ct+=yt*(rt-v[G])),U.b[ht]=ct}const C=$.solve(e,s,!1),D=this.last.solve;D.iterations=C.iterations,D.residual=C.residual,D.capped=C.capped;const z=this.Tnew,mt=U.x;for(let O=0;O<l;O+=1)for(let W=0;W<a;W+=1){const G=W+O*a;z[G]=m[G]>0?v[G]+mt[W+1+(O+1)*J]:n.T[G]}const xt=this.dE;let Y=0,N=0;for(let O=0;O<d;O+=1)xt[O]=m[O]>0?b[O]*t:0;for(let O=0;O<l;O+=1)for(let W=0;W<a;W+=1){const G=W+O*a;if(m[G]<=0)continue;const ht=w[G];if(I[G]>0){const ct=I[G]*(z[G+1]-z[G])*t;xt[G]+=ct,xt[G+1]-=ct,n.kind[G]!==n.kind[G+1]&&this.pair(n.kind[G],n.kind[G+1],ct)}if(j[G]>0){const ct=j[G]*(z[G+a]-z[G])*t;xt[G]+=ct,xt[G+a]-=ct,n.kind[G]!==n.kind[G+a]&&this.pair(n.kind[G],n.kind[G+a],ct)}for(let ct=0;ct<4;ct+=1){if(!(ct===0?W===0:ct===1?W===a-1:ct===2?O===0:O===l-1))continue;const Bt=ct===0?n.openL:ct===1?n.openR:ct===2?n.openB:n.openT,yt=this.sideConductance(Bt,ht,bt,f)*(z[G]-rt)*t;xt[G]-=yt,Bt?N+=yt:Y+=yt,n.solid[G]!==0&&(this.lossSolids+=yt)}}for(let O=0;O<d;O+=1){if(m[O]<=0)continue;const W=xt[O]/m[O];z[O]=W;let G=0;const ht=h[O]+F[O]+S[O];if(E[O]!==0&&p[O]>0&&ht>0){const ct=Math.min(.999,Math.max(.001,n.fs[O])),_t=f/(.5*ct/Math.max(1e-9,q[O])+.5*(1-ct)/Math.max(1e-9,R[O])),Bt=p[O]*ht/(p[O]+ht);G=(1-Math.exp(-t*_t/Bt))*E[O]*Bt}p[O]>0&&(n.Es[O]+=W*p[O]-G,this.deriveSolid(O)),h[O]>0&&(n.Hg[O]+=W*h[O]+G*h[O]/ht),G!==0&&F[O]+S[O]>0&&(z[O]+=G/ht)}for(let O=0;O<i.count;O+=1){const W=9*O,G=r.bi[O],ht=r.bj[O];let ct=0;for(let yt=0;yt<9;yt+=1){const qt=r.wt[W+yt];if(qt===0)continue;const At=G+yt%3,ke=ht+(yt/3|0);if(At<0||ke<0||At>=a||ke>=l)continue;const St=At+ke*a;m[St]>0&&(ct+=qt*z[St])}if(ct===0)continue;const _t=i.mass[O],Bt=_t/i.rho[O];i.h[O]+=i.cp(O)*ct,i.derive(O),r.dVp[O]+=_t/i.rho[O]-Bt}if(M!==null)for(let O=0;O<M.count;O+=1){const W=n.cellAt(M.x[O],M.y[O]);W>=0&&n.solid[W]===0&&m[W]>0&&(M.T[O]+=z[W])}for(let O=0;O<d;O+=1)h[O]>0&&c.deriveCell(O);_.fill(0);const X=this.last;return X.heater=L*t,X.lossWalls=Y,X.lossOpen=N,X}pair(t,e,s){t===pt&&e===it?this.fluxSL-=s:t===it&&e===pt?this.fluxSL+=s:t===it&&e===H?this.fluxLG-=s:t===H&&e===it?this.fluxLG+=s:t===pt&&e===H?this.fluxSG-=s:t===H&&e===pt&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function Jd(o,t,e,s,n,i,r,c,a,l,d){const{nx:f,ny:u,dx:m}=o;for(let v=0;v<o.nu;v+=1)e[v]=n[v]>l?e[v]/n[v]:0;for(let v=0;v<o.nv;v+=1)s[v]=i[v]>l?s[v]/i[v]:0;const p=a*m*m/d,h=(v,w)=>v+w>0?2*v*w/(v+w):0;let g=0;{const v=f+1,w=t.begin(v,u),b=o.ul;for(let F=0;F<u;F+=1)for(let k=0;k<=f;k+=1){const P=k+F*v;if(r[P]!==1)continue;const y=t.at(k,F),A=e[P];if(w.act[y]=1,w.dH[y]=p,w.x[y]=b[P],w.b[y]=p*b[P],k+1<=f){const S=r[P+1];S===1?w.ax[y]=h(A,e[P+1]):S===2&&(w.dDx[y]+=A)}if(k>0&&r[P-1]===2&&(w.dDx[y]+=A),F+1<u){const S=r[P+v];S===1?w.ay[y]=h(A,e[P+v]):S===2&&(w.dDy[y]+=2*A)}else o.openT||(w.dDy[y]+=2*A);F>0?r[P-v]===2&&(w.dDy[y]+=2*A):o.openB||(w.dDy[y]+=2*A)}const _=t.solve(1e-6,200,!1);g+=_.iterations;for(let F=0;F<u;F+=1)for(let k=0;k<=f;k+=1){const P=k+F*v;r[P]===1&&(b[P]=w.x[t.at(k,F)])}}{const v=t.begin(f,u+1),w=o.vl;for(let _=0;_<=u;_+=1)for(let F=0;F<f;F+=1){const k=F+_*f;if(c[k]!==1)continue;const P=t.at(F,_),y=s[k];if(v.act[P]=1,v.dH[P]=p,v.x[P]=w[k],v.b[P]=p*w[k],_+1<=u){const A=c[k+f];A===1?v.ay[P]=h(y,s[k+f]):A===2&&(v.dDy[P]+=y)}if(_>0&&c[k-f]===2&&(v.dDy[P]+=y),F+1<f){const A=c[k+1];A===1?v.ax[P]=h(y,s[k+1]):A===2&&(v.dDx[P]+=2*y)}else o.openR||(v.dDx[P]+=2*y);F>0?c[k-1]===2&&(v.dDx[P]+=2*y):o.openL||(v.dDx[P]+=2*y)}const b=t.solve(1e-6,200,!1);g+=b.iterations;for(let _=0;_<=u;_+=1)for(let F=0;F<f;F+=1){const k=F+_*f;c[k]===1&&(w[k]=v.x[t.at(F,_)])}}return g}class th{constructor(){x(this,"cellMat",null);x(this,"cellHost",null);x(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:c,n:a}=e,l=re.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(a*l),this.cellHost=new Uint8Array(a));const d=this.cellMat,f=this.cellHost;d.fill(0);let u=!1;for(let h=0;h<t.count;h+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),v=Math.min(c-1,Math.max(0,Math.floor(t.y[h]/e.dx)));d[(g+v*r)*l+t.mat[h]]+=t.mass[h],t.smass[2*h]>0&&(u=!0)}if(u){this.cellVolW===null&&(this.cellVolW=new Float64Array(a));const h=this.cellVolW;h.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==ut)continue;const v=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),w=Math.min(c-1,Math.max(0,Math.floor(t.y[g]/e.dx)));h[v+w*r]+=t.mass[g]/t.rho[g]}}for(let h=0;h<a;h+=1){let g=0;for(let v=1;v<l;v+=1)d[h*l+v]>d[h*l+g]&&(g=v);f[h]=g}let m=!1;const p=.25*e.dx;for(let h=0;h<t.count;h+=1){i[h]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),v=Math.min(c-1,Math.max(0,Math.floor(t.y[h]/e.dx))),w=f[g+v*r],b=t.mat[h];if(b===w)continue;const _=t.T[h],F=this.cellVolW,k=g+v*r,P=u&&w===ut&&F!==null&&F[k]>0?d[k*l]/F[k]:qs(w,_),y=t.rho[h],A=Jn(w,_),S=Jn(b,_),T=t.mass[h]/y,M=Math.cbrt(6*T/Math.PI),B=Math.abs(P-y);if(B<=0||n<=0)continue;const L=(2*A+3*S)/(3*A+3*S);let q=B*n*M*M/(18*A*L);for(let E=0;E<8;E+=1){const I=Math.max(1e-9,P*q*M/A),j=24/I*L*(1+.15*Math.pow(I,.687));q=Math.sqrt(4*B*n*M/(3*P*j))}const R=y<P?1:-1;i[h]=R*Math.min(p,q*s),m=!0}return m}}function eh(o,t,e,s,n,i,r,c,a,l,d){const f=t.w,u=t.h,m=t.dx;let p=0,h=0,g=0,v=0;const w=s;for(let b=0;b<o.count;b+=1){const _=o.x[b],F=o.y[b],k=w[b]!==0;let P,y;if(k)P=_+e*o.vx[b],y=F+e*o.vy[b];else{i(_,F,a);const T=_+.5*e*a[0],M=F+.5*e*a[1];i(T,M,a),P=_+e*a[0],y=F+e*a[1]+(n!==null?n[b]:0)}if(P<0&&t.openL||P>f&&t.openR||y<0&&t.openB||y>u&&t.openT){const T=o.smass[2*b];o.mat[b]===ut?p+=o.mass[b]-T:h+=o.mass[b]-T,g+=T,v+=o.mass[b]*o.h[b],n!==null&&(n[b]=n[o.count-1]),w[b]=w[o.count-1],r(b),b-=1;continue}const A=1e-4*m;k&&(P<A||P>f-A)&&(o.vx[b]=0),k&&(y<A||y>u-A)&&(o.vy[b]=0),P=Math.min(f-A,Math.max(A,P)),y=Math.min(u-A,Math.max(A,y));const S=c!==null?c(_,F,P,y,l):0;if(S===1){P=l[0],y=l[1];const T=l[2],M=l[3];if(k)o.vx[b]=l[4],o.vy[b]=l[5];else{const B=(o.vx[b]-l[4])*T+(o.vy[b]-l[5])*M;B<0&&(o.vx[b]-=B*T,o.vy[b]-=B*M)}}else if(S===0){let T=t.sdfAt(P,y);if(T<.05*m){const M=P,B=y;for(let L=0;L<3&&T<.05*m;L+=1){const q=.25*m;let R=t.sdfAt(P+q,y)-t.sdfAt(P-q,y),E=t.sdfAt(P,y+q)-t.sdfAt(P,y-q);const I=Math.hypot(R,E);if(I<1e-12)break;R/=I,E/=I;const j=.05*m-T;P+=j*R,y+=j*E;const $=o.vx[b]*R+o.vy[b]*E;k?(o.vx[b]=0,o.vy[b]=0):$<0&&(o.vx[b]-=$*R,o.vy[b]-=$*E),P=Math.min(f-A,Math.max(A,P)),y=Math.min(u-A,Math.max(A,y)),T=t.sdfAt(P,y)}if(c!==null&&(P!==M||y!==B)&&c(M,B,P,y,l)===1)if(P=l[0],y=l[1],k)o.vx[b]=l[4],o.vy[b]=l[5];else{const L=(o.vx[b]-l[4])*l[2]+(o.vy[b]-l[5])*l[3];L<0&&(o.vx[b]-=L*l[2],o.vy[b]-=L*l[3])}}}o.x[b]=P,o.y[b]=y}d.m=p,d.o=h,d.s=g,d.e=v}const sh=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),ma=24,nh=1,ih=1,pa=24,ga=1,be=(o,t)=>(o+2)*(t+2);function ba(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function rh(o,t,e,s,n,i){let r=0;for(let c=0;c<i;c+=1){o[c]+=n*e[c];const a=t[c]-n*s[c];t[c]=a,r+=a*a}return r}function oh(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class Ct{constructor(t,e){x(this,"levels",[]);x(this,"depth",1);x(this,"xs");x(this,"bs");x(this,"p");x(this,"q");x(this,"zj");x(this,"rj");x(this,"nullId");x(this,"stack");x(this,"nullSum",new Float64Array(16));x(this,"nullCnt",new Float64Array(16));x(this,"nullCount",0);x(this,"system");x(this,"result",{iterations:0,residual:0,capped:!1});x(this,"pw",new Float64Array(4));x(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(sh(be(s,n),i)),!(s*n<=ma||s<=2&&n<=2);)i=be(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=be(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const c=this.levels[0],a=this.xs,l=this.bs;this.system={get nx(){return c.nx},get ny(){return c.ny},get stride(){return c.stride},ax:c.ax,ay:c.ay,dH:c.dH,dDx:c.dDx,dDy:c.dDy,act:c.act,x:a,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=be(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:a,dDy:l,diag:d,inv:f,act:u}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let h=1;h<=e;h+=1,p+=1){if(u[p]===0){d[p]=1,f[p]=1;continue}const g=c[p]+a[p]+l[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){u[p]=0,d[p]=1,f[p]=1;continue}d[p]=g,f[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:c,ay:a,diag:l}=t;for(let d=1;d<=i;d+=1){let f=1+d*r;for(let u=1;u<=n;u+=1,f+=1)s[f]=l[f]*e[f]-c[f]*e[f+1]-c[f-1]*e[f-1]-a[f]*e[f+r]-a[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:c,inv:a,x:l,b:d}=t;for(let f=1;f<=n;f+=1){let u=1+(1+f+e&1)+f*i;const m=s+f*i;for(;u<=m;u+=2)l[u]=(d[u]+r[u]*l[u+1]+r[u-1]*l[u-1]+c[u]*l[u+i]+c[u-i]*l[u-i])*a[u]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:c,band:a}=t;let l=0;for(let d=1;d<=s;d+=1){let f=1+d*n;for(let u=1;u<=e;u+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||c[f]>0)&&(a[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:c,b:a,band:l,bandCount:d}=t;for(let f=e>0?0:d-1;e>0?f<d:f>=0;f+=e){const u=l[f];c[u]=(a[u]+n[u]*c[u+1]+n[u-1]*c[u-1]+i[u]*c[u+s]+i[u-s]*c[u-s])*r[u]}}prepareFine(){const t=this.levels[0],e=be(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=ma||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=be(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const c=e.stride,a=e.h,l=s.h;for(let d=0;d<i;d+=1)for(let f=0;f<n;f+=1){const u=f+1+(d+1)*s.stride;let m=0,p=0,h=0,g=0;for(let P=0;P<2;P+=1){const y=2*d+P;if(!(y>=e.ny))for(let A=0;A<2;A+=1){const S=2*f+A;if(S>=e.nx)continue;const T=S+1+(y+1)*c;if(e.act[T]===0)continue;const M=e.area[T];m+=M,p+=M*((A-.5)*a+e.ox[T]*a),h+=M*((P-.5)*a+e.oy[T]*a),g+=e.dH[T]}}if(m<=0){s.act[u]=0,s.dH[u]=0,s.dDx[u]=0,s.dDy[u]=0,s.gDx[u]=0,s.gDy[u]=0,s.ox[u]=0,s.oy[u]=0;continue}s.act[u]=1,s.area[u]=m/4;const v=p/m,w=h/m;s.ox[u]=v/l,s.oy[u]=w/l,s.dH[u]=g;let b=0,_=0,F=0,k=0;for(let P=0;P<2;P+=1){const y=2*d+P;if(!(y>=e.ny))for(let A=0;A<2;A+=1){const S=2*f+A;if(S>=e.nx)continue;const T=S+1+(y+1)*c;if(e.act[T]!==0){if(e.gDx[T]>0){const M=(A-.5)*a+e.ox[T]*a;b+=e.gDx[T],_+=e.gDx[T]/(e.eDx[T]+Math.abs(M-v))}if(e.gDy[T]>0){const M=(P-.5)*a+e.oy[T]*a;F+=e.gDy[T],k+=e.gDy[T]/(e.eDy[T]+Math.abs(M-w))}}}}s.gDx[u]=b,s.gDy[u]=F,s.dDx[u]=_,s.dDy[u]=k,s.eDx[u]=_>0?b/_:.5*l,s.eDy[u]=k>0?F/k:.5*l}for(let d=0;d<i;d+=1)for(let f=0;f<n;f+=1){const u=f+1+(d+1)*s.stride;if(s.act[u]!==0){if(f+1<n&&s.act[u+1]!==0){const m=2*f+1;let p=0;if(m+1<e.nx)for(let h=0;h<2;h+=1){const g=2*d+h;g>=e.ny||(p+=e.gx[m+1+(g+1)*c])}if(p>0){const h=l*(1+s.ox[u+1]-s.ox[u]);s.gx[u]=p,s.ax[u]=p/Math.max(.25*l,h)}}if(d+1<i&&s.act[u+s.stride]!==0){const m=2*d+1;let p=0;if(m+1<e.ny)for(let h=0;h<2;h+=1){const g=2*f+h;g>=e.nx||(p+=e.gy[g+1+(m+1)*c])}if(p>0){const h=l*(1+s.oy[u+s.stride]-s.oy[u]);s.gy[u]=p,s.ay[u]=p/Math.max(.25*l,h)}}}}Ct.diagonal(s),Ct.findBand(s);for(let d=0;d<e.ny;d+=1){let f=1+(d+1)*c;for(let u=0;u<e.nx;u+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}Ct.weights(s,u,d,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const c=e>>1,a=s>>1,l=(e&1)===1?1:-1,d=(s&1)===1?1:-1,f=t.stride,u=c+1+(a+1)*f;r[0]=u,r[1]=u+l,r[2]=u+d*f,r[3]=u+l+d*f;const m=c+l>=0&&c+l<t.nx,p=a+d>=0&&a+d<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[u]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<pa;m+=1)Ct.color(e,0),Ct.color(e,1);for(let m=0;m<pa;m+=1)Ct.color(e,1),Ct.color(e,0);return}for(let m=0;m<nh;m+=1)Ct.color(e,0),Ct.color(e,1);for(let m=0;m<ga;m+=1)Ct.bandSweep(e,1);Ct.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,be(s.nx,s.ny)),s.x.fill(0,0,be(s.nx,s.ny));const{stride:n,act:i,b:r,r:c,x:a}=e,{pIdx:l,pW:d}=s,f=s.b,u=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,p+=1){if(i[p]===0)continue;const g=r[p]-c[p],v=4*p;f[l[v]]+=d[v]*g,f[l[v+1]]+=d[v+1]*g,f[l[v+2]]+=d[v+2]*g,f[l[v+3]]+=d[v+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,p+=1){if(i[p]===0)continue;const g=4*p;a[p]+=d[g]*u[l[g]]+d[g+1]*u[l[g+1]]+d[g+2]*u[l[g+2]]+d[g+3]*u[l[g+3]]}}for(let m=0;m<ga;m+=1)Ct.bandSweep(e,-1);for(let m=0;m<ih;m+=1)Ct.color(e,1),Ct.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:a,dDy:l,act:d}=t,f=this.nullId,u=be(e,s);let m=!1;for(let p=0;p<u;p+=1)if(d[p]!==0&&!(c[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,u),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let h=1;h<=e;h+=1){const g=h+p*n;if(d[g]===0||f[g]!==-2)continue;let v=0,w=0,b=!1;const _=-3-this.nullCount;this.stack[v++]=g,f[g]=_;let F=g,k=g;for(;v>0;){const y=this.stack[--v];w+=1,y<F&&(F=y),y>k&&(k=y),(c[y]>0||a[y]>0||l[y]>0)&&(b=!0),i[y]>0&&f[y+1]===-2&&(f[y+1]=_,this.stack[v++]=y+1),i[y-1]>0&&f[y-1]===-2&&(f[y-1]=_,this.stack[v++]=y-1),r[y]>0&&f[y+n]===-2&&(f[y+n]=_,this.stack[v++]=y+n),r[y-n]>0&&f[y-n]===-2&&(f[y-n]=_,this.stack[v++]=y-n)}let P=-1;if(!b){if(P=this.nullCount,P>=this.nullSum.length){const y=A=>{const S=new Float64Array(2*A.length);return S.set(A),S};this.nullSum=y(this.nullSum),this.nullCnt=y(this.nullCnt)}this.nullCnt[P]=w,this.nullCount+=1}for(let y=F;y<=k;y+=1)f[y]===_&&(f[y]=P)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=be(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=be(i.nx,i.ny),{act:c}=i,a=this.xs,l=this.bs,d=i.stride;for(let F=0;F<r;F+=1){if(c[F]===0){a[F]=0,l[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||c[F+1]===0)&&(i.ax[F]=0),(F+d>=r||c[F+d]===0)&&(i.ay[F]=0)}Ct.diagonal(i);for(let F=0;F<r;F+=1)c[F]===0&&(a[F]=0,l[F]=0);this.findNull(),this.project(l),s&&(Ct.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,u=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),u.fill(0,0,r),Ct.apply(i,a,p);let h=0,g=0;for(let F=0;F<r;F+=1){const k=c[F]===0?0:l[F]-p[F];f[F]=k,h+=l[F]*l[F],g+=k*k}this.project(f);const v=Math.sqrt(h);if(v===0)return a.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(g)/v;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,f,u,r);let b=0;for(let F=0;F<r;F+=1)m[F]=u[F],b+=f[F]*u[F];let _=0;for(;_<e;){_+=1,Ct.apply(i,m,p);const F=ba(m,p,r);if(!(F>0))break;const k=b/F;if(g=rh(a,f,m,p,k,r),w=Math.sqrt(g)/v,w<=t)break;this.precondition(s,f,u,r);const P=ba(f,u,r),y=P/b;b=P,oh(m,u,y,r)}this.project(a);for(let F=0;F<r;F+=1)c[F]===0&&(a[F]=0);return n.iterations=_,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const ch=.1,xa=5e-4,va=1e-9,Eo=.1;function ji(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function he(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class ah{constructor(t,e,s){x(this,"g");x(this,"P");x(this,"solver");x(this,"mu");x(this,"pu");x(this,"mv");x(this,"pv");x(this,"rv");x(this,"knownU");x(this,"knownV");x(this,"tmpU");x(this,"tmpV");x(this,"markU");x(this,"markV");x(this,"bi");x(this,"bj");x(this,"wr");x(this,"wt");x(this,"dVp");x(this,"volSrc");x(this,"fU");x(this,"fV");x(this,"pGas");x(this,"w",new Float64Array(12));x(this,"rhoRef",998);x(this,"weightsDirty",!0);x(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});x(this,"escM",0);x(this,"escO",0);x(this,"escS",0);x(this,"escE",0);x(this,"viscous",!1);x(this,"etaU",null);x(this,"etaV",null);x(this,"vsolver",null);x(this,"mf",0);x(this,"ms",1);x(this,"stranded",new Uint8Array(0));x(this,"vel",new Float64Array(2));x(this,"drifts",new th);x(this,"dropletDrift",null);x(this,"bodyHit",null);x(this,"afterSolve",null);x(this,"hit",new Float64Array(6));x(this,"escaped",{m:0,o:0,s:0,e:0});x(this,"velocityAtFn",(t,e,s)=>{ci(this.g,t,e,s)});x(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,c=1/e.dx;e.updateThin();for(let a=0;a<t.count;a+=1){n[a]=he(t.x[a]*c-.5,s,0),i[a]=he(t.y[a]*c-.5,s,3);const l=9*a;for(let d=0;d<3;d+=1)for(let f=0;f<3;f+=1)r[l+f+3*d]=s[f]*s[3+d];e.thinAny&&e.cutWeights(n[a]+1,i[a]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:c,ny:a,kind:l}=e;for(let d=0;d<t.count;d+=1){const f=9*d,u=s[d],m=n[d];let p=0;for(let h=0;h<9;h+=1){const g=u+h%3,v=m+(h/3|0),b=g>=0&&v>=0&&g<c&&v<a&&l[g+v*c]===it?i[f+h]:0;r[f+h]=b,p+=b}if(p>0){const h=1/p;for(let g=0;g<9;g+=1)r[f+g]*=h}else{for(let h=0;h<9;h+=1)r[f+h]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:c,wt:a}=this,{nx:l,ny:d,kind:f}=s,u=1/s.dx;i[t]=he(e.x[t]*u-.5,n,0),r[t]=he(e.y[t]*u-.5,n,3);const m=9*t;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1)c[m+g+3*h]=n[g]*n[3+h];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,c,m);let p=0;for(let h=0;h<9;h+=1){const g=i[t]+h%3,v=r[t]+(h/3|0),w=g>=0&&v>=0&&g<l&&v<d&&f[g+v*l]===it;a[m+h]=w?c[m+h]:0,w&&(p+=c[m+h])}if(p>0)for(let h=0;h<9;h+=1)a[m+h]/=p;else{for(let h=0;h<9;h+=1)a[m+h]=0;a[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:c,phi:a}=e;a.fill(0);const l=1/e.vCell;let d=0,f=0;for(let u=0;u<t.count;u+=1){const m=t.mass[u]/t.rho[u];d+=t.mass[u],f+=m;const p=9*u,h=s[u],g=n[u];for(let v=0;v<9;v+=1){const w=h+v%3,b=g+(v/3|0);w<0||b<0||w>=r||b>=c||(a[w+b*r]+=i[p+v]*m*l)}}f>0&&(this.rhoRef=d/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=pt;continue}const c=e.phi[r];let a=c>0&&c+e.phiS[r]+e.alpha[r]+e.grain[r]>=.5;if(!a&&t!==null&&t[r]!==H&&t[r]!==pt){const l=r%s,d=(r-l)/s;(l>0?t[r-1]===H&&e.faceOpen(r,0)>0:e.openL)||(l<s-1?t[r+1]===H&&e.faceOpen(r,1)>0:e.openR)||(d>0?t[r-s]===H&&e.faceOpen(r,2)>0:e.openB)||(d<n-1?t[r+s]===H&&e.faceOpen(r,3)>0:e.openT)||(a=!0)}e.kind[r]=a?it:H,a&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:c,rv:a}=this,{nx:l,ny:d,dx:f}=e,u=1/f,m=l+1;n.fill(0),i.fill(0),r.fill(0),c.fill(0),a.fill(0);const p=1/this.rhoRef,h=this.viscous;h&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,v=this.etaV;h&&(g.fill(0),v.fill(0));for(let w=0;w<t.count;w+=1){const b=t.x[w],_=t.y[w],F=t.mass[w],k=h?Jn(t.mat[w],t.T[w]):0,P=t.vx[w],y=t.vy[w],A=t.c00[w],S=t.c01[w],T=t.c10[w],M=t.c11[w],B=b*u,L=_*u;let q=he(B,s,0),R=he(L-.5,s,3);for(let I=0;I<3;I+=1){const j=R+I,$=(j+.5)*f-_;for(let U=0;U<3;U+=1){const J=q+U,et=s[U]*s[3+I]*F,bt=et*(P+A*(J*f-b)+S*$);if(J>=0&&J<=l&&j>=0&&j<d){const rt=J+j*m;n[rt]+=et,i[rt]+=bt,h&&(g[rt]+=et*k)}else this.mirrorU(J,j),n[this.mf]+=et,i[this.mf]+=this.ms*bt,h&&(g[this.mf]+=et*k)}}q=he(B-.5,s,0),R=he(L,s,3);const E=t.rho[w]*p;for(let I=0;I<3;I+=1){const j=R+I,$=j*f-_;for(let U=0;U<3;U+=1){const J=q+U,et=s[U]*s[3+I]*F,bt=et*(y+T*((J+.5)*f-b)+M*$);let rt,C=1;J>=0&&J<l&&j>=0&&j<=d?rt=J+j*l:(this.mirrorV(J,j),rt=this.mf,C=this.ms),r[rt]+=et,c[rt]+=C*bt,a[rt]+=et*E,h&&(v[rt]+=et*k)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,a=1;r<0?s.openL?r=0:(r=-r,a=-a):r>n&&(s.openR?r=n:(r=2*n-r,a=-a)),c<0?c=s.openB?0:-1-c:c>=i&&(c=s.openT?i-1:2*i-1-c),r=Math.min(n,Math.max(0,r)),c=Math.min(i-1,Math.max(0,c)),this.mf=r+c*(n+1),this.ms=a}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,a=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),c<0?s.openB?c=0:(c=-c,a=-a):c>i&&(s.openT?c=i:(c=2*i-c,a=-a)),r=Math.min(n-1,Math.max(0,r)),c=Math.min(i,Math.max(0,c)),this.mf=r+c*n,this.ms=a}step(t,e,s,n){const{g:i,P:r}=this,{nx:c,ny:a,dx:l,kind:d}=i,f=c+1;this.viscous=r.hasOther(),this.p2g();const{mu:u,pu:m,mv:p,pv:h,rv:g,knownU:v,knownV:w}=this,b=i.ul,_=i.vl,F=this.rhoRef*i.vCell*.25,k=va*F,P=this.viscous;for(let E=0;E<i.nu;E+=1)b[E]=u[E]>k?m[E]/u[E]+(P?0:t*this.fU[E]/(this.rhoRef*i.vCell)):0;for(let E=0;E<i.nv;E+=1)_[E]=p[E]>k?h[E]/p[E]+(P?0:-t*e*(g[E]/p[E])+t*this.fV[E]/(this.rhoRef*i.vCell)):0;for(let E=0;E<a;E+=1)for(let I=0;I<=c;I+=1){const j=I+E*f,$=I>0?d[I-1+E*c]:-1,U=I<c?d[I+E*c]:-1,J=I===0&&!i.openL,et=I===c&&!i.openR;if(J||et||$===pt||U===pt||i.au[j]<=0){b[j]=J||et?0:i.usol[j],v[j]=2;continue}v[j]=$===it||U===it?1:0}for(let E=0;E<=a;E+=1)for(let I=0;I<c;I+=1){const j=I+E*c,$=E>0?d[I+(E-1)*c]:-1,U=E<a?d[I+E*c]:-1,J=E===0&&!i.openB,et=E===a&&!i.openT;if(J||et||$===pt||U===pt||i.av[j]<=0){_[j]=J||et?0:i.vsol[j],w[j]=2;continue}w[j]=$===it||U===it?1:0}if(this.last.viscIterations=0,P){this.viscosity(t);const E=t/(this.rhoRef*i.vCell);for(let I=0;I<i.nu;I+=1)v[I]!==2&&u[I]>k&&(b[I]+=E*this.fU[I]);for(let I=0;I<i.nv;I+=1)w[I]!==2&&p[I]>k&&(_[I]+=-t*e*(g[I]/p[I])+E*this.fV[I])}let y=c,A=-1,S=a,T=-1,M=0;for(let E=0;E<a;E+=1)for(let I=0;I<c;I+=1)d[I+E*c]===it&&(M+=1,I<y&&(y=I),I>A&&(A=I),E<S&&(S=E),E>T&&(T=E));const B=this.last.solve;if(B.iterations=0,B.residual=0,B.capped=!1,M>0){const E=A-y+1,I=T-S+1,j=this.solver,$=j.begin(E,I),U=t/this.rhoRef,J=1/i.vCell,et=this.pGas;for(let C=S;C<=T;C+=1)for(let D=y;D<=A;D+=1){const z=D+C*c;if(d[z]!==it)continue;const mt=j.at(D-y,C-S);$.act[mt]=1,$.x[mt]=i.pl[z];const xt=D+C*f,Y=D+C*c,N=v[xt+1]===2?0:i.au[xt+1],X=v[xt]===2?0:i.au[xt],O=w[Y+c]===2?0:i.av[Y+c],W=w[Y]===2?0:i.av[Y],G=ji(b,i.usol,xt+1,N,v)-ji(b,i.usol,xt,X,v)+ji(_,i.vsol,Y+c,O,w)-ji(_,i.vsol,Y,W,w),ht=i.phi[z]+i.phiS[z]+i.alpha[z]+i.grain[z];let ct=this.volSrc[z]*J;const _t=this.gasAt(D-1,C)||this.gasAt(D+1,C)||this.gasAt(D,C-1)||this.gasAt(D,C+1),Bt=ht-1;(Bt>0||!_t)&&(ct+=ch*Bt/Math.max(t,xa));let yt=ct*l*l-l*G;if(D+1<c){const qt=d[z+1];if(qt===it)D+1<=A&&N>0&&($.ax[mt]=N<1?U*N:U);else if(qt===H&&N>0){const At=(N<1?U*N:U)/this.theta(z,z+1);$.dDx[mt]+=At,yt+=At*et[z+1]}}else i.openR&&N>0&&($.dDx[mt]+=N<1?2*U*N:2*U);if(D>0){if(d[z-1]===H&&X>0){const At=(X<1?U*X:U)/this.theta(z,z-1);$.dDx[mt]+=At,yt+=At*et[z-1]}}else i.openL&&X>0&&($.dDx[mt]+=X<1?2*U*X:2*U);if(C+1<a){const qt=d[z+c];if(qt===it)C+1<=T&&O>0&&($.ay[mt]=O<1?U*O:U);else if(qt===H&&O>0){const At=(O<1?U*O:U)/this.theta(z,z+c);$.dDy[mt]+=At,yt+=At*et[z+c]}}else i.openT&&O>0&&($.dDy[mt]+=O<1?2*U*O:2*U);if(C>0){if(d[z-c]===H&&W>0){const At=(W<1?U*W:U)/this.theta(z,z-c);$.dDy[mt]+=At,yt+=At*et[z-c]}}else i.openB&&W>0&&($.dDy[mt]+=W<1?2*U*W:2*U);$.b[mt]=yt}const bt=j.solve(s,n,!0);B.iterations=bt.iterations,B.residual=bt.residual,B.capped=bt.capped;const rt=i.pl;for(let C=0;C<i.n;C+=1)rt[C]=d[C]===H?et[C]:0;for(let C=S;C<=T;C+=1)for(let D=y;D<=A;D+=1){const z=D+C*c;d[z]===it&&(rt[z]=$.x[j.at(D-y,C-S)])}for(let C=0;C<a;C+=1)for(let D=0;D<=c;D+=1){const z=D+C*f;if(v[z]===1){if(D===0){b[z]-=U/l*2*(rt[C*c]-0);continue}if(D===c){b[z]-=U/l*2*(0-rt[c-1+C*c]);continue}b[z]-=U/l*this.across(D-1+C*c,D+C*c)}}for(let C=0;C<=a;C+=1)for(let D=0;D<c;D+=1){const z=D+C*c;if(w[z]===1){if(C===0){_[z]-=U/l*2*(rt[D]-0);continue}if(C===a){_[z]-=U/l*2*(0-rt[D+(a-1)*c]);continue}_[z]-=U/l*this.across(D+(C-1)*c,D+C*c)}}this.afterSolve!==null&&this.afterSolve(j,y,S,t)}this.extrapolate();const L=this.markStranded(),q=this.g2p(L?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const R=this.last;return R.cells=M,R.uMax=q,R.escapedMass=this.escM,R.escapedOther=this.escO,R.escapedSalt=this.escS,R.escapedEnergy=this.escE,R}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t]+s.grain[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e]+s.grain[e];return!(n>.5)||!(n>i)?Eo:Math.max(Eo,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===H&&n[e]===it?i/this.theta(e,t):n[e]===H&&n[t]===it?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new Ct(e.nx+1,e.ny+1));const s=va*this.rhoRef*e.vCell*.25;this.last.viscIterations=Jd(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===H}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:c,volSrc:a}=this,{nx:l,ny:d}=s,f=1/Math.max(t,xa);for(let u=0;u<e.count;u+=1){const m=c[u];if(m===0)continue;const p=9*u,h=n[u],g=i[u];for(let v=0;v<9;v+=1){const w=h+v%3,b=g+(v/3|0);w<0||b<0||w>=l||b>=d||(a[w+b*l]+=r[p+v]*m*f)}}}extrapolate(){Nd(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:c,ny:a,dx:l}=n,d=1/l,f=c+1,u=n.ul,m=n.vl,p=4/(l*l);let h=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const L=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];L>h&&(h=L);continue}const v=s.x[g],w=s.y[g],b=v*d,_=w*d;let F=he(b,i,0),k=he(_-.5,i,3),P=0,y=0,A=0;for(let L=0;L<3;L+=1){const q=k+L,R=(q+.5)*l-w;for(let E=0;E<3;E+=1){const I=F+E,j=i[E]*i[3+L];let $;I>=0&&I<=c&&q>=0&&q<a?$=u[I+q*f]:(this.mirrorU(I,q),$=this.ms*u[this.mf]),P+=j*$,y+=j*$*(I*l-v),A+=j*$*R}}F=he(b-.5,i,0),k=he(_,i,3);let S=0,T=0,M=0;for(let L=0;L<3;L+=1){const q=k+L,R=q*l-w;for(let E=0;E<3;E+=1){const I=F+E,j=i[E]*i[3+L];let $;I>=0&&I<c&&q>=0&&q<=a?$=m[I+q*c]:(this.mirrorV(I,q),$=this.ms*m[this.mf]),S+=j*$,T+=j*$*((I+.5)*l-v),M+=j*$*R}}s.vx[g]=P,s.vy[g]=S,s.c00[g]=p*y,s.c01[g]=p*A,s.c10[g]=p*T,s.c11[g]=p*M;const B=P*P+S*S;B>h&&(h=B)}return Math.sqrt(h)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),Dd(this.P,this.g,this.stranded)}velocityAt(t,e,s){ci(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;eh(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class lh{constructor(t){x(this,"cap");x(this,"count",0);x(this,"nextId",1);x(this,"x");x(this,"y");x(this,"vx");x(this,"vy");x(this,"c00");x(this,"c01");x(this,"c10");x(this,"c11");x(this,"mass");x(this,"h");x(this,"T");x(this,"rho");x(this,"spc");x(this,"smass");x(this,"mat");x(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.c00[c]=0,this.c01[c]=0,this.c10[c]=0,this.c11[c]=0,this.mass[c]=s,this.h[c]=n,this.mat[c]=i,this.spc[2*c]=r>0?xi:0,this.spc[2*c+1]=0,this.smass[2*c]=r>0?r:0,this.smass[2*c+1]=0,this.T[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(c),c}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=L0(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Ir(r,i);return}const s=this.mat[t],n=l0(s,this.h[t]);this.T[t]=n,this.rho[t]=qs(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==ut)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?C0(this.T[t],e/this.mass[t]):ic(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function fh(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:c,heat:a}=o,{nx:l,ny:d,n:f,kind:u}=s,{Tl:m}=t,p=t.rd;let h=!1;for(let b=0;b<f;b+=1){if(p[b]=0,u[b]===H&&t.Cl[b]>0){const A=t.boilingAt(b,r.pAt(b));m[b]>A&&(p[b]=A,h=!0);continue}if(u[b]!==it)continue;const _=b%l,F=(b-_)/l,k=F+1<d?b+l:-1;if(!(k>=0&&u[k]===H&&s.faceOpen(b,3)>0||_>0&&u[b-1]===H&&s.faceOpen(b,0)>0||_<l-1&&u[b+1]===H&&s.faceOpen(b,1)>0||F>0&&u[b-l]===H&&s.faceOpen(b,2)>0))continue;const y=t.boilingAt(b,r.pAt(b));m[b]>y&&(p[b]=y,h=!0)}if(!h)return;const g=t.mtot;g.fill(0);const v=t.Y0;v.fill(0);const w=i.rhoRef*s.vCell/4;for(let b=0;b<n.count;b+=1){if(n.mat[b]!==ut)continue;const _=n.smass[2*b],F=_>0?_/n.mass[b]:0,k=9*b;let P=0,y=0,A=-1,S=0;for(let B=0;B<2;B+=1){for(let L=0;L<9;L+=1){const q=i.wt[k+L];if(q===0)continue;const R=i.bi[b]+L%3,E=i.bj[b]+(L/3|0);if(R<0||E<0||R>=l||E>=d)continue;const I=R+E*l,j=p[I];if(j===0)continue;const $=_>0?Wl(j,F):Pt(j);if(n.h[b]<=$)continue;const U=vt(j),J=q*n.mass[b]*(n.h[b]-$)/(U-(_>0?dn(j,F):$));B===0?(P+=J,y+=J*U,q>S&&(S=q,A=I)):(g[I]+=J,v[I]+=J*U)}if(P===0)break;if(B===0&&n.mass[b]-_-P<Ro*w){const L=p[A],q=n.mass[b]-_,R=vt(L),E=_>0?_*yi(L):0;g[A]+=q,v[A]+=q*R,_>0&&o.salt.deposit(n.x[b],n.y[b],_,E),a.src[A]-=(q*R+E-n.mass[b]*n.h[b])/e,P=-1;break}}if(P===0)continue;if(P<0){i.removeParticle(b),b-=1;continue}const T=n.mass[b]/n.rho[b],M=n.mass[b]-P;n.h[b]=(n.mass[b]*n.h[b]-y)/M,n.mass[b]=M,n.derive(b),i.dVp[b]+=M/n.rho[b]-T}for(let b=0;b<f;b+=1){if(g[b]===0)continue;const _=b%l,F=(b-_)/l;let k=0;const P=u[b]===H?b:F+1<d&&u[b+l]===H&&s.faceOpen(b,3)>0?b+l:-1;if(P>=0)s.mg[Q*f+P]+=g[b],s.Hg[P]+=v[b],c.deriveCell(P);else{const y=t.side;y[0]=_>0&&u[b-1]===H&&s.faceOpen(b,0)>0?b-1:-1,y[1]=_<l-1&&u[b+1]===H&&s.faceOpen(b,1)>0?b+1:-1,y[2]=F>0&&u[b-l]===H&&s.faceOpen(b,2)>0?b-l:-1,y[3]=-1;for(let A=0;A<3;A+=1)y[A]>=0&&(k+=1);for(let A=0;A<3;A+=1)y[A]<0||(s.mg[Q*f+y[A]]+=g[b]/k,s.Hg[y[A]]+=v[b]/k,c.deriveCell(y[A]))}t.produced+=g[b]}}function uh(o,t,e,s,n){const i=o.grid,r=i.n,c=i.mg[at*r+t],a=i.mg[lt*r+t],l=i.Hg[t];if(s<=0)return Fl(c,a,e,l);let d=n;for(let f=0;f<6;f+=1){const u=c*fe(at,d)+a*fe(lt,d)+e*vt(d)+s*Pt(d),m=(l-u)/Ao(c,a,e,s,d);if(d+=m,Math.abs(m)<1e-10)break}return d}function In(o,t,e,s,n,i){const r=o.grid,c=r.n,a=r.mg[Q*c+t]-e,l=r.mfog[t]+e,d=uh(o,t,a,l,i),f=a/gt[Q];return(f+s>0?f/(f+s)*n:0)-ti(d)}function so(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const c=Math.max(-n.mfog[e],Math.min(n.mg[Q*r+e],s));n.mg[Q*r+e]-=c,n.mfog[e]+=c,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=c,i.deriveCell(e)}function dh(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==H)continue;const r=e.mg[Q*n+i],c=e.mfog[i];if(r<=0&&c<=0)continue;const a=e.mg[at*n+i]/gt[at]+e.mg[lt*n+i]/gt[lt],l=s.pAt(i),d=e.T[i];if(c<=0){const w=r/gt[Q];if(w/(w+a)*l<.999*ti(d))continue}const f=In(o,i,0,a,l,d);if(f<=0&&c<=0)continue;let u,m,p,h;if(f>0)u=0,p=f,m=r,h=In(o,i,m,a,l,d);else if(m=0,h=f,u=-c,p=In(o,i,u,a,l,d),p<=0){so(o,t,i,u);continue}if(h>0){so(o,t,i,m);continue}let g=u,v=0;for(let w=0;w<40;w+=1){g=(u*h-m*p)/(h-p),(!Number.isFinite(g)||g<=Math.min(u,m)||g>=Math.max(u,m))&&(g=.5*(u+m));const b=In(o,i,g,a,l,d);if(Math.abs(b)<=1e-13*l)break;b>0?(u=g,p=b,v===1&&(h/=2),v=1):(m=g,h=b,v===-1&&(p/=2),v=-1)}if(so(o,t,i,g),f<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=In(o,i,0,a,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/ti(e.T[i]))}}}const Ro=.001;class hh{constructor(t){x(this,"e");x(this,"produced",0);x(this,"condensed",0);x(this,"dew",0);x(this,"fogMade",0);x(this,"producedMark",0);x(this,"fogError",0);x(this,"fogWrong",0);x(this,"mtot");x(this,"rd");x(this,"Y0");x(this,"Tl");x(this,"Cl");x(this,"acc");x(this,"accH");x(this,"accAll");x(this,"host");x(this,"mixed",!1);x(this,"salty",!1);x(this,"accS");x(this,"mol");x(this,"aw");x(this,"accMat");x(this,"Fm");x(this,"Fe");x(this,"dm");x(this,"fed");x(this,"side",new Int32Array(4));x(this,"bG");x(this,"bY");x(this,"edge");x(this,"hvC");x(this,"hnC");x(this,"hoC");x(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*re.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.fed=new Uint8Array(e),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,c=Math.min(.999,n*ti(t)/e),a=i.mg[at*r+s],l=i.mg[lt*r+s],d=a+l,f=d>0?d/(a/gt[at]+l/gt[lt]):.02885;return c*gt[Q]/(c*gt[Q]+(1-c)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:c,Cl:a,acc:l,accH:d,accAll:f,accS:u}=this;a.fill(0),c.fill(0),l.fill(0),d.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const v=e.mass[g],w=e.mat[g],b=v*e.cp(g),_=e.smass[2*g],F=v-_,k=_>0?dn(e.T[g],_/v):e.h[g];_>0&&!p&&(p=!0,u.fill(0)),w!==ut&&!m&&(m=!0,f.fill(0),this.accMat.fill(0));const P=9*g;for(let y=0;y<9;y+=1){const A=s.wt[P+y];if(A===0)continue;const S=s.bi[g]+y%3,T=s.bj[g]+(y/3|0);if(S<0||T<0||S>=n||T>=i)continue;const M=S+T*n;a[M]+=A*b,c[M]+=A*b*e.T[g],w===ut&&(l[M]+=A*F,d[M]+=A*F*k),p&&(u[M]+=A*_),m&&(this.accMat[w*r+M]+=A*v)}}for(let g=0;g<r;g+=1)c[g]=a[g]>0?c[g]/a[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const v=u[g]>0&&l[g]>0?u[g]/(l[g]*Qe):0;this.mol[g]=v,this.aw[g]=v>0?Vl(c[g],v):1}if(!m){f.set(l),this.host.fill(ut);return}const h=re.length;for(let g=0;g<r;g+=1){this.accMat[ut*r+g]=p?l[g]+u[g]:l[g];let v=0,w=ut,b=-1;for(let _=0;_<h;_+=1){const F=this.accMat[_*r+g];v+=F,F>b&&(b=F,w=_)}f[g]=v,this.host[g]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?rc(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:Pt(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?ut:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,{acc:a,dm:l,fed:d}=this;for(let u=0;u<s.n;u+=1)d[u]=a[u]>0?1:0;l.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){if(n.mat[u]!==ut)continue;const m=9*u;let p=0;for(let h=0;h<9;h+=1){const g=i.wt[m+h];if(g===0)continue;const v=i.bi[u]+h%3,w=i.bj[u]+(h/3|0);if(v<0||w<0||v>=r||w>=c)continue;const b=v+w*r;t[b]!==0&&a[b]>0&&(p+=t[b]*g*(n.mass[u]-n.smass[2*u])/a[b])}l[u]=p}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const m=l[u];if(m===0)continue;if(n.smass[2*u]>0){this.applySalty(u,m,f,e);continue}const p=n.mass[u]/n.rho[u],h=n.mass[u]+m;if(h<Ro*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,h),e);continue}this.track(u,m),n.mass[u]=h,i.dVp[u]+=h/n.rho[u]-p}for(let u=0;u<s.n;u+=1){if(t[u]<=0||d[u]!==0)continue;const m=u%r,p=(u-m)/r,h=n.add((m+.5)*s.dx,(p+.5)*s.dx,t[u],this.waterH(u),ut);h<0||(i.placeParticle(h),i.dVp[h]=t[u]/n.rho[h],this.track(h,t[u]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,a=9*t,l=ic(n.mat[t],n.T[t]);for(let d=0;d<9;d+=1){const f=i.wt[a+d];if(f===0)continue;const u=i.bi[t]+d%3,m=i.bj[t]+(d/3|0);if(u<0||m<0||u>=r||m>=c)continue;const p=u+m*r;this.acc[p]+=f*e,this.accH[p]+=f*e*n.h[t],this.accAll[p]+=f*e,this.Cl[p]+=f*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,c=i.smass[2*t],a=i.mass[t],l=a-c,d=dn(i.T[t],c/a),f=i.cp(t),u=a*i.h[t]+e*d,m=l+e;if(m<Ro*s){this.trackSalty(t,-l,-l*d,-a,-c,-a*f),this.dryUp(t,Math.max(0,m),u,n);return}const p=a/i.rho[t];i.mass[t]=a+e,i.h[t]=u/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const h=dn(i.T[t],c/i.mass[t]);this.trackSalty(t,e,m*h-l*d,e,0,i.mass[t]*i.cp(t)-a*f)}trackSalty(t,e,s,n,i,r){const{grid:c,liquid:a}=this.e,{nx:l,ny:d}=c,f=9*t;for(let u=0;u<9;u+=1){const m=a.wt[f+u];if(m===0)continue;const p=a.bi[t]+u%3,h=a.bj[t]+(u/3|0);if(p<0||h<0||p>=l||h>=d)continue;const g=p+h*l;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:c,heat:a,gas:l}=this.e,d=r.T[t],f=r.smass[2*t],u=f*yi(d);this.e.salt.deposit(r.x[t],r.y[t],f,u);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==H;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[Q*i.n+p]+=e,i.Hg[p]+=e*vt(d),this.produced+=e,l.deriveCell(p)),a.src[m]-=(e*vt(d)+u-s)/n;else if(m>=0){for(let h=0;h<r.count;h+=1)if(h!==t&&r.mat[h]===r.mat[t]&&i.cellAt(r.x[h],r.y[h])===m){const g=r.mass[h]*r.h[h]+(s-u);r.mass[h]+=e,r.h[h]=g/r.mass[h],r.derive(h);break}}c.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:c,gas:a}=this.e,l=n.cellAt(i.x[t],i.y[t]);let d=l;for(;d>=0&&n.kind[d]!==H;)d=d+n.nx<n.n?d+n.nx:-1;if(e>0&&d>=0&&l>=0){const f=i.T[t];n.mg[Q*n.n+d]+=e,n.Hg[d]+=e*vt(f),c.src[l]-=e*(vt(f)-i.h[t])/s,this.produced+=e,a.deriveCell(d)}else if(e>0&&l>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===l){const u=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=u/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),fh(this.e,this,t),dh(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:c}=e,{nx:a,ny:l,n:d,depth:f,kind:u}=s,{mtot:m,rd:p,Y0:h,Tl:g,Fm:v,Fe:w,edge:b,hvC:_,hnC:F,hoC:k}=this;let P=!1;for(let L=0;L<d;L+=1){if(u[L]!==H){m[L]=0;continue}const q=s.mg[L]+s.mg[d+L]+s.mg[Q*d+L];m[L]=q,h[L]=q>0?s.mg[Q*d+L]/q:0;const R=s.T[L];p[L]=n.rho[L]*r0(R,i.pAt(L)),_[L]=vt(R),F[L]=fe(at,R),k[L]=fe(lt,R),P=!0}if(!P)return;for(let L=0;L<l;L+=1)for(let q=0;q<a;q+=1){const R=q+L*a;b[R]=u[R]===H&&(q===0||L===0||q===a-1||L===l-1||u[R-1]!==H||u[R+1]!==H||u[R-a]!==H||u[R+a]!==H)?1:0}const y=c.begin(a,l),A=y.stride,S=e.ambientY[Q],{bG:T,bY:M}=this;for(let L=0;L<l;L+=1)for(let q=0;q<a;q+=1){const R=q+L*a;if(u[R]!==H||m[R]<=0)continue;const E=q+1+(L+1)*A;y.act[E]=1,y.x[E]=h[R],y.dH[E]=m[R]/t;let I=m[R]*h[R]/t;const j=s.au[q+1+L*(a+1)],$=s.av[R+a];if(q+1<a&&u[R+1]===H&&m[R+1]>0&&j>0&&(y.ax[E]=j*.5*(p[R]+p[R+1])*f),L+1<l&&u[R+a]===H&&m[R+a]>0&&$>0&&(y.ay[E]=$*.5*(p[R]+p[R+a])*f),b[R]===0){y.b[E]=I;continue}let U=0;for(let J=0;J<4;J+=1){const et=this.boundary(R,q,L,J,S);T[4*R+J]=et,M[4*R+J]=this.yb,!(et<=0)&&(U+=et,I+=et*this.yb)}y.dDx[E]=U,y.b[E]=I}c.solve(1e-9,200,!1),v.fill(0),w.fill(0);const B=y.x;for(let L=0;L<l;L+=1)for(let q=0;q<a;q+=1){const R=q+L*a;if(u[R]!==H||m[R]<=0)continue;const E=q+1+(L+1)*A,I=B[E],j=s.au[q+1+L*(a+1)],$=s.av[R+a];if(q+1<a&&u[R+1]===H&&m[R+1]>0&&j>0&&this.exchange(R,R+1,t*j*.5*(p[R]+p[R+1])*f*(I-B[E+1])),L+1<l&&u[R+a]===H&&m[R+a]>0&&$>0&&this.exchange(R,R+a,t*$*.5*(p[R]+p[R+a])*f*(I-B[E+A])),b[R]!==0)for(let U=0;U<4;U+=1){const J=T[4*R+U];if(J<=0)continue;const et=t*J*(M[4*R+U]-I),rt=(U===0?q===0:U===1?q===a-1:U===2?L===0:L===l-1)?-1:U===0?R-1:U===1?R+1:U===2?R-a:R+a;if(rt<0)this.ambientExchange(R,et);else if(u[rt]===it)if(et>0){const C=Math.min(et,Math.max(0,this.acc[rt]+v[rt]));if(!(C>0))continue;const D=g[rt];s.mg[Q*d+R]+=C,s.Hg[R]+=C*vt(D),v[rt]-=C,w[rt]-=C*vt(D),this.produced+=C}else{const C=Math.min(-et,s.mg[Q*d+R]);s.mg[Q*d+R]-=C,s.Hg[R]-=C*vt(s.T[R]),v[rt]+=C,w[rt]+=C*vt(s.T[R]),this.condensed+=C}else if(u[rt]===pt){const C=s.T[rt];if(et<0){const D=Math.min(-et,s.mg[Q*d+R]);s.mg[Q*d+R]-=D,s.Hg[R]-=D*vt(s.T[R]),s.film[rt]+=D,s.Es[rt]+=D*Pt(C),r.src[rt]+=D*(vt(s.T[R])-Pt(C))/t,this.dew+=D}else{const D=Math.min(et,s.film[rt]);s.film[rt]-=D,s.Es[rt]-=D*Pt(C),s.mg[Q*d+R]+=D,s.Hg[R]+=D*vt(C),r.src[rt]-=D*(vt(C)-Pt(C))/t,this.dew-=D}}}}for(let L=0;L<d;L+=1)v[L]!==0&&(r.src[L]+=(w[L]-v[L]*this.waterH(L))/t);this.applyMass(v,t);for(let L=0;L<d;L+=1)u[L]===H&&m[L]>0&&n.deriveCell(L)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:c,ny:a,depth:l,kind:d}=r,f=n===0?e===0:n===1?e===c-1:n===2?s===0:s===a-1,u=2*this.rd[t]*l;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,u):0;const m=n===0?t-1:n===1?t+1:n===2?t-c:t+c;this.side[n]=m;const p=d[m],h=this.Y0[t],g=this.e.regions.pAt(t);if(p===it){const v=r.faceOpen(t,n);if(!(v>0))return 0;const w=this.waterShare(m);return w<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),v*u*(1-h)*w)}if(p===pt){const v=this.ysat(r.T[m],g,t);return h>v||r.film[m]>0&&h<v?(this.yb=v,u*(1-h)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,c=s>0?e:t;let a=Math.abs(s);a=Math.min(a,n.mg[Q*i+r]);const l=n.mg[at*i+c],d=n.mg[lt*i+c],f=l+d,u=Math.min(a,f);if(a<=0)return;const m=this.hvC[r];if(n.mg[Q*i+r]-=a,n.mg[Q*i+c]+=a,n.Hg[r]-=a*m,n.Hg[c]+=a*m,u>0){const p=u*l/f,h=u-p;n.mg[at*i+c]-=p,n.mg[lt*i+c]-=h,n.mg[at*i+r]+=p,n.mg[lt*i+r]+=h;const g=p*this.hnC[c]+h*this.hoC[c];n.Hg[c]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const c=n.mg[at*i+t]+n.mg[lt*i+t],a=Math.min(e,c);if(n.mg[Q*i+t]+=e,n.Hg[t]+=e*vt(r),a>0){const l=a*n.mg[at*i+t]/c,d=a-l;n.mg[at*i+t]-=l,n.mg[lt*i+t]-=d;const f=l*fe(at,n.T[t])+d*fe(lt,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=a,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*vt(r)}else if(e<0){const c=Math.min(-e,n.mg[Q*i+t]),a=s.ambientY[at],l=s.ambientY[lt],d=a+l>0?a+l:1;n.mg[Q*i+t]-=c,n.Hg[t]-=c*vt(n.T[t]);const f=c*a/d,u=c-f;n.mg[at*i+t]+=f,n.mg[lt*i+t]+=u;const m=f*fe(at,r)+u*fe(lt,r);n.Hg[t]+=m,s.flows.escapedWater+=c,s.flows.escapedAir-=c,s.flows.escapedEnergy+=c*vt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:c}=t,a=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<a)continue;const d=l%n,f=(l-d)/n,m=[d>0?l-1:-1,d<n-1?l+1:-1,f+1<i?l+n:-1,f>0?l-n:-1].find(_=>_>=0&&c[_]===H);if(m===void 0)continue;const p=m%n,h=(m-p)/n,g=(p+.5+.25*Math.sign(d-p))*t.dx,v=(h+.5+.25*Math.sign(f-h))*t.dx,w=t.T[l],b=e.add(g,v,a,Pt(w),ut);b<0||(t.film[l]-=a,t.Es[l]-=a*Pt(w),s.placeParticle(b),s.dVp[b]=a/e.rho[b])}}}function bf(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(re.length);let r=0,c=0,a=0;for(let l=0;l<e.count;l+=1)for(let d=0;d<9;d+=1){const f=s.wt[9*l+d];if(f===0)continue;const u=s.bi[l]+d%3,m=s.bj[l]+(d/3|0);if(u<0||m<0||u>=n.nx||m>=n.ny||u+m*n.nx!==t)continue;i[e.mat[l]]+=f*e.mass[l],r+=f*e.mass[l];const p=e.smass[2*l];p>0?(c+=f*p,a+=f*(e.mass[l]-p)):e.mat[l]===0&&(a+=f*e.mass[l])}return{m:i,all:r,salt:c,water:a}}function mh(o,t){const{m:e,all:s}=bf(o,t);if(s<=0)return[];const n=[];for(let i=0;i<re.length;i+=1)e[i]>0&&n.push({id:re[i].id,share:e[i]/s});return n}function ph(o,t,e){var S;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===pt?"solid":s.kind[n]===it?"liquid":"gas",c=o.pressureAt(n);let a=0;const l=[0,0,0];for(let T=0;T<Ft;T+=1)l[T]=s.mg[T*i+n]/gt[T],a+=l[T];for(let T=0;T<Ft;T+=1)l[T]=a>0?l[T]/a:0;const d=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?l[Q]*c:0,u=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[u+m*(s.nx+1)]+s.ul[u+1+m*(s.nx+1)]):.5*(s.ug[u+m*(s.nx+1)]+s.ug[u+1+m*(s.nx+1)]),h=r==="liquid"?.5*(s.vl[u+m*s.nx]+s.vl[u+(m+1)*s.nx]):.5*(s.vg[u+m*s.nx]+s.vg[u+(m+1)*s.nx]),g=o.particles;let v=-1,w=(1.5*s.dx)**2;for(let T=0;T<g.count;T+=1){const M=(g.x[T]-t)**2+(g.y[T]-e)**2;M<w&&(w=M,v=T)}const b=o.bubbles;let _=-1,F=1/0;for(let T=0;T<b.count;T+=1){const M=Math.hypot(b.x[T]-t,b.y[T]-e);M<=Math.max(b.r[T],3*s.dx)&&M<F&&(_=T,F=M)}const k=bf(o,n),P=[];if(k.all>0)for(let T=0;T<re.length;T+=1)k.m[T]>0&&P.push({id:re[T].id,share:k.m[T]/k.all});let y=null;if(r==="liquid"&&k.salt>0&&k.water>0){const T=k.salt/(k.water*Qe);y={w:k.salt/(k.salt+k.water),molality:T,Tb:rc(c,T),Tf:Gl(T)}}const A=r==="gas"?o.gas.rho[n]:r==="liquid"?y!==null&&!o.phase.mixed?Ir(d,y.w):o.phase.mixed?qs(o.phase.host[n],d):o.liquid.rhoRef:s.solid[n]!==0?dt[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?dt[s.solid[n]-1].id:null,T:d,p:c,Tsat:kt(c),x:l,rh:r==="gas"?f/Or(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:A,phi:s.phi[n],u:p,v:h,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:P,salt:y},particle:v<0?null:{id:g.id[v],T:g.T[v],vx:g.vx[v],vy:g.vy[v],mass:g.mass[v],rho:g.rho[v],dist:Math.sqrt(w),liquid:((S=re[g.mat[v]])==null?void 0:S.id)??re[0].id,salt:g.saltFraction(v)},bubble:_<0?null:o.bubbleModel.describe(_),body:gh(o,t,e)}}function gh(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&Fn(n)?n.id:"",material:dt[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}const bh=2e-6;class xh{constructor(t){x(this,"g");x(this,"id");x(this,"count",0);x(this,"open",new Uint8Array(4));x(this,"vFluid",new Float64Array(4));x(this,"p0",new Float64Array(4));x(this,"rhoBar",new Float64Array(4));x(this,"vLiq",new Float64Array(4));x(this,"vBub",new Float64Array(4));x(this,"vGas",new Float64Array(4));x(this,"nSum",new Float64Array(4));x(this,"mSum",new Float64Array(4));x(this,"stack");x(this,"pAmb",101325);x(this,"rhoAmb",1.2);x(this,"gy",9.81);x(this,"freeAt",null);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,c=e+1;this.id.fill(-1);let a=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(a);let d=0,f=0,u=0,m=!1;for(this.stack[d++]=l,this.id[l]=a;d>0;){const p=this.stack[--d];u+=1-t.fs[p],!m&&t.owner[p]>0&&this.freeAt!==null&&this.freeAt(t.owner[p])&&(m=!0);const h=p%e,g=(p-h)/e,v=h+g*c,w=h+g*e;(h===0&&t.openL&&i[v]>0||h===e-1&&t.openR&&i[v+1]>0||g===0&&t.openB&&r[w]>0||g===s-1&&t.openT&&r[w+e]>0)&&(f=1),h>0&&n[p-1]===0&&this.id[p-1]===-1&&i[v]>0&&(this.id[p-1]=a,this.stack[d++]=p-1),h<e-1&&n[p+1]===0&&this.id[p+1]===-1&&i[v+1]>0&&(this.id[p+1]=a,this.stack[d++]=p+1),g>0&&n[p-e]===0&&this.id[p-e]===-1&&r[w]>0&&(this.id[p-e]=a,this.stack[d++]=p-e),g<s-1&&n[p+e]===0&&this.id[p+e]===-1&&r[w+e]>0&&(this.id[p+e]=a,this.stack[d++]=p+e)}f===0&&m&&u*t.vCell<bh&&(f=1),this.open[a]=f,this.vFluid[a]=u*t.vCell,a+=1}this.count=a}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let c=0;c<Ft;c+=1){const a=s.mg[c*n+i];this.mSum[r]+=a,this.nSum[r]+=a/gt[c]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let a=0;a<s;a+=1){if(this.id[a]!==t||e.kind[a]===pt)continue;let l=0;for(let d=0;d<Ft;d+=1)l+=e.mg[d*s+a]/gt[d];n+=l*Dt*e.T[a]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const c=this.rhoBar[t]*this.gy;if(c===0)return r;for(let a=0;a<2;a+=1){let l=-i,d=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===pt)continue;let u=0;for(let h=0;h<Ft;h+=1)u+=e.mg[h*s+f]/gt[h];const m=r-c*(e.dx*((f-f%e.nx)/e.nx+.5)),p=u*Dt*e.T[f];l+=p/m,d-=p/(m*m)}r-=l/d}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===H)return s;return-1}}class vh{constructor(t){x(this,"e");x(this,"floor");x(this,"floorH");x(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:c,ny:a}=r,l=Math.min(c-1,Math.max(0,Math.floor(t/r.dx))),d=Math.min(a-1,Math.max(0,Math.floor(e/r.dx))),f=l+d*c,u=i.heat;if(u.hasSolid(f)){this.toSolid(f,s,n);return}const m=[d>0?f-c:-1,l>0?f-1:-1,l<c-1?f+1:-1,d<a-1?f+c:-1];for(const p of m)if(p>=0&&u.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=d-2;p>=0;p-=1){const h=l+p*c;if(u.hasSolid(h)){this.toSolid(h,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],c=Hl(r);if(n<=c*i*(1+1e-9))continue;const a=(n-c*i)/(1-c),l=a*yi(r),d=i/t.rho[s],f=i*t.h[s]-l;t.mass[s]=i-a,t.smass[2*s]=n-a,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-d,this.e.grainSalt.grow(t.x[s],t.y[s],a,l)||this.deposit(t.x[s],t.y[s],a,l),this.crystallized+=a}}}const yh=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],Ss=yh.length,ya=1/120;class wh{constructor(t,e={}){x(this,"scene");x(this,"options");x(this,"warnings",[]);x(this,"grid");x(this,"particles");x(this,"bubbles");x(this,"liquid");x(this,"gas");x(this,"regions");x(this,"heat");x(this,"bubbleModel");x(this,"phase");x(this,"salt");x(this,"grains");x(this,"grainFlow");x(this,"grainSalt");x(this,"exchange");x(this,"bodies");x(this,"melt");x(this,"solver");x(this,"extremes",new md(this));x(this,"prevKind");x(this,"p0Start",new Float64Array(8));x(this,"rng");x(this,"time",0);x(this,"steps",0);x(this,"dt",ya);x(this,"gy",9.81);x(this,"ambientY",new Float64Array(ft));x(this,"ambientT",293.15);x(this,"pRef",101325);x(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});x(this,"flows",na());x(this,"snap",vd());x(this,"energy0",0);x(this,"water0",0);x(this,"other0",0);x(this,"salt0",0);x(this,"cappedCount",0);x(this,"vapourRate",0);x(this,"vapourLast",0);x(this,"timings",new Float64Array(Ss));x(this,"stamp",new Float64Array(Ss+1));x(this,"stepMs",0);x(this,"quality","high");x(this,"heaterOps",new Map);x(this,"building",!1);this.options=e;const s=wa(t)?t:zi(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??ya}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=N0[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>U0;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new Xd(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new lh(Math.max(4096,4*i.n+1024)),this.bubbles=new sd(4096),this.solver=new Ct(s,n),this.regions=new xh(i),this.liquid=new ah(i,this.particles,this.solver),this.gas=new jd(i,this.regions,this.solver),this.heat=new Zd(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new dd(this),this.phase=new hh(this),this.salt=new vh(this),this.grains=new I0(Math.max(1024,4*i.n)),this.grainFlow=new Wd(this),this.grainSalt=new Yd(this),this.exchange=new Od(this),this.bodies=new Nu(this),this.regions.freeAt=r=>{const c=this.bodies.list[r-1];return c!==void 0&&c.free},this.heat.bodies=this.bodies.list,this.heat.grains=this.grains,this.melt=new ed(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,c,a,l,d)=>this.bodies.hitPoint(r,c,a,l,d),this.liquid.afterSolve=(r,c,a,l)=>this.bodies.probe(r,c,a,l),this.prevKind=new Uint8Array(i.n),this.rng=new lf(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=na(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=H,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),this.grainFlow.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const c=i+r>0?i+r:1,a=(i>0?i:o0)/c,l=(r>0||i>0?r:c0)/c,d=1/(a/gt[at]+l/gt[lt]),f=Math.min(.99,s*Or(e)/t),u=f*gt[Q]/(f*gt[Q]+(1-f)*d);this.ambientY.fill(0),this.ambientY[at]=(1-u)*a,this.ambientY[lt]=(1-u)*l,this.ambientY[Q]=u;let m=0;for(let p=0;p<Ft;p+=1)m+=this.ambientY[p]/gt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(Dt*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,grains:this.grains,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>oi(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=Fn(t)&&(t.id===""||oi(this,t.id)>=0)?{...t,id:zl(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!qd(this,e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=Pd(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const c=this.heaterOps.get(t),a=c===void 0?void 0:this.scene.ops[c];if(c!==void 0&&a!==void 0&&a.op==="hotplate"){const l=[...this.scene.ops];l[c]={...a,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),c=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:c}},this.setAmbientState(t,e,s,r,c.N2,c.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return Yl({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=wa(t)?t:zi(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=zi(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:c}=this,a=this.dt,l=this.stamp;l[0]=Me();const d=n.pvTerm();this.bodies.prepare()&&(n.update(r,c),this.flows.bodyWork+=n.pvTerm()-d),l[1]=Me(),this.grainFlow.splatVolume(),e.splatVolumeChange(a),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,c),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let h=0;h<n.count;h+=1)this.p0Start[h]=n.p0[h];for(let h=0;h<t.n;h+=1)e.pGas[h]=t.kind[h]===H?n.pAt(h)-this.pRef:0;e.step(a,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,this.grainFlow.step(a),l[2]=Me(),s.updateVolumes(),s.markFaces();const f=s.escaped[Q]+s.escaped[Ft],u=s.escaped[at]+s.escaped[lt],m=s.escaped[Ft+1];s.transport(a),this.flows.escapedWater+=s.escaped[Q]+s.escaped[Ft]-f,this.flows.escapedAir+=s.escaped[at]+s.escaped[lt]-u,this.flows.escapedEnergy+=s.escaped[Ft+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(a,this.gy),s.sources(a),s.project(a,this.tol,this.maxIter),l[3]=Me(),this.bubbleModel.step(a),l[4]=Me(),this.phase.step(a),this.salt.step(),this.grainSalt.step(a),l[5]=Me(),i.step(a,1e-6,200),this.exchange.step(a),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=Me(),l[7]=Me(),n.update(r,c),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let h=0;h<t.n;h+=1)s.srcV[h]=t.kind[h]===H?s.veos[h]-s.veosMid[h]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=a,this.steps+=1,l[8]=Me(),this.bodies.finish(a),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit(),this.grainFlow.dtLimit()),l[9]=Me();const p=this.steps<5?1:1/30;for(let h=0;h<Ss;h+=1)this.timings[h]+=p*(l[h+1]-l[h]-this.timings[h]);this.stepMs+=p*(l[Ss]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let c=!1;for(let a=0;a<e.count;a+=1)i.dp0[a]!==0&&(c=!0);if(c){for(let a=0;a<s.count;a+=1){const l=t.cellAt(s.x[a],s.y[a]),d=l<0?-1:e.id[l];if(d<0||i.dp0[d]===0)continue;const f=s.mass[a],u=f/s.rho[a];s.h[a]+=u*i.dp0[d]/f,s.derive(a),r.dVp[a]+=f/s.rho[a]-u}for(let a=0;a<n.count;a+=1){const l=t.cellAt(n.x[a],n.y[a]),d=l<0?-1:e.id[l];d>=0&&i.dp0[d]!==0&&(n.H[a]+=n.V[a]*i.dp0[d])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,xd(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals(),this.grains.totals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){let t=0;for(const e of this.bodies.list)e.free&&(t+=1);return t>8||this.melt.any()||this.grains.count>0}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}rebaseline(t){const e=this.measureBudget(),s=this.flows;this.energy0=e.energy-(s.heater-s.lossWalls-s.lossOpen-s.escapedEnergy+s.editEnergy+s.bodyWork)-t.energy,this.water0=e.water.total-s.editWater-t.water,this.other0=e.other.total-s.editOther-t.other,this.salt0=e.salt.total-s.editSalt-t.salt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===ut&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==ut&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===it?this.pRef+e.pl[t]:e.kind[t]===H?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return ph(this,t,e)}liquidsAt(t){return mh(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let h=0;h<t.n;h+=1)t.kind[h]===it?e+=1:t.kind[h]===H&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),c=this.flows,a=r.energy-this.energy0-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),l=r.water.total-this.water0-c.editWater,d=r.other.total-this.other0-c.editOther,f=r.salt.total-this.salt0-c.editSalt,u=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(u-this.phase.producedMark)/m,this.phase.producedMark=u,this.vapourLast=this.time);const p=[];for(let h=0;h<this.regions.count;h+=1)p.push({p0:this.regions.p0[h],sealed:this.regions.open[h]===0,vGas:this.regions.vGas[h]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor+r.salt.grains,bodies:{count:this.bodies.list.filter(h=>!h.gone).length,free:this.bodies.list.filter(h=>h.free).length,awake:this.bodies.list.filter(h=>h.awake).length},heaters:this.heat.heaters.filter(h=>h.cells>0).map(h=>({group:h.group,P:h.P,Tmean:h.Tmean,mode:h.mode,power:h.power,target:h.target,on:h.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...c},energyError:a,waterError:l,otherError:d,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats(),cpuOnly:this.needsCpu()}}}const Me=()=>typeof performance<"u"?performance.now():Date.now();function wa(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}const Z={X:0,Y:1,A:2,VX:3,VY:4,W:5,UX:6,UY:7,UW:8,M:9,I:10,RMAX:11,HULLA:12,HULLJ:13,PINNED:14,ASLEEP:15,GONE:16,REST:17,RX:18,RY:19,RA:20,PREV:21,PRED:24,PNOW:27,POLD:30,VPRE:33,MA6:36,MAOK:42,MA:43,IA:44,MAT:45,HEATER:46,NR:47,RO:48,NCELL:49,KO:50,NSEG:51,SO:52,BX0:53,BY0:54,BX1:55,BY1:56,OX0:57,OY0:58,OX1:59,OY1:60,FX:61,FY:62,TQ:63,TOUCH:64,BAND:65,AGAIN:66,COS:67,SIN:68,PROBE:69,KEY:70,VOL:71,E0:72,MA9:73,HIT:82,WAKE:83},nn=88,ws={SEGS:0,PARTS:1,NPARTS:2,NRECT:3,NCELL:4,NBODY:5},rn=8,_h={X0:0,Y0:1,X1:2,Y1:3,NI:4,NJ:5,XO:6,YO:7,KO:8,BODY:9},$n=12,Fh={RECT:0,SIDE:1,T0:2,T1:3,BODY:4},xf=8,Ph={X0:0,Y0:1,X1:2,Y1:3,ID:4,FRIC:5,BOUNCE:6},Io=8,we=4,Ht={X:0,Y:1,A:2,VX:3,VY:4,W:5,STATE:6,M:7,T:8,E:9,FILM:10,CRUST:11,FX:12,FY:13,TQ:14,MAOK:15},hn=16,Ah=.99,kh=.9,Sh=.88,Th=.5,Mh=1e-5,Ws=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),gr=[Ws("B_",Z),Ws("GH_",ws),Ws("GR_",_h),Ws("GS_",Fh),Ws("GP_",Ph),Ws("BRD_",Ht),`const BS: u32 = ${nn}u;`,`const GEO_RECTS: u32 = ${rn}u;`,`const RS: u32 = ${$n}u;`,`const SS: u32 = ${xf}u;`,`const PS: u32 = ${Io}u;`,`const BC: u32 = ${we}u;`,`const BR: u32 = ${hn}u;`,`const CLOSED_P: f32 = ${Ah};`,`const CLOSED_F: f32 = ${kh};`,`const REOPEN_F: f32 = ${Sh};`,`const SQUEEZE_B: f32 = ${Th};`,`const COVERED_EPS: f32 = ${Mh};`].join(`
`),Pe=`${gr}
fn bv(b: u32, f: u32) -> f32 { return bod[b * BS + f]; }
fn bFree(b: u32) -> bool { return bv(b, B_PINNED) == 0.0 && bv(b, B_GONE) == 0.0; }
fn bAwake(b: u32) -> bool { return bFree(b) && bv(b, B_ASLEEP) == 0.0; }
fn bGone(b: u32) -> bool { return bv(b, B_GONE) != 0.0; }
/* Welt → eigener Rahmen des Körpers bei seiner jetzigen Lage (cos, sin aus bPrep). */
fn toLocalB(b: u32, w: vec2<f32>) -> vec2<f32> {
  let d = w - vec2<f32>(bv(b, B_X), bv(b, B_Y));
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * d.x + s * d.y, -s * d.x + c * d.y);
}
/* Eigener Rahmen → Welt relativ zum Punkt org (für genaue Flächen in f32). */
fn toWorldRel(b: u32, l: vec2<f32>, org: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return (vec2<f32>(bv(b, B_X), bv(b, B_Y)) - org) + vec2<f32>(c * l.x - s * l.y, s * l.x + c * l.y);
}
/* Die Geschwindigkeit, mit der die Projektionen den Körper sehen (U = V + Vorhersage, bodies.ts), an einem Punkt der Welt. */
fn bodyU(b: u32, p: vec2<f32>) -> vec2<f32> {
  let w = bv(b, B_UW);
  return vec2<f32>(bv(b, B_UX) - w * (p.y - bv(b, B_Y)), bv(b, B_UY) + w * (p.x - bv(b, B_X)));
}
/* Seine wirkliche Geschwindigkeit an einem Punkt. */
fn bodyV(b: u32, p: vec2<f32>) -> vec2<f32> {
  let w = bv(b, B_W);
  return vec2<f32>(bv(b, B_VX) - w * (p.y - bv(b, B_Y)), bv(b, B_VY) + w * (p.x - bv(b, B_X)));
}
`,ie=`${Pe}
fn rectOf(b: u32, r: u32) -> u32 { return u32(bv(b, B_RO)) + r; }
fn rv(q: u32, f: u32) -> f32 { return bgeo[GEO_RECTS + q * RS + f]; }
fn rBox(q: u32) -> vec4<f32> { return vec4<f32>(rv(q, GR_X0), rv(q, GR_Y0), rv(q, GR_X1), rv(q, GR_Y1)); }
fn rxs(q: u32, p: u32) -> f32 { return bgeo[u32(rv(q, GR_XO)) + p]; }
fn rys(q: u32, p: u32) -> f32 { return bgeo[u32(rv(q, GR_YO)) + p]; }
/* Die erste Spalte (Zeile) des Rechtecks q, deren rechte (obere) Grenze nicht links (unter) v liegt — binäre Suche über die Grenzen. */
fn firstCol(q: u32, n: u32, v: f32) -> u32 {
  var lo = 0u;
  var hi = n;
  loop { if (lo >= hi) { break; } let mid = (lo + hi) / 2u; if (rxs(q, mid + 1u) < v) { lo = mid + 1u; } else { hi = mid; } }
  return lo;
}
fn firstRow(q: u32, n: u32, v: f32) -> u32 {
  var lo = 0u;
  var hi = n;
  loop { if (lo >= hi) { break; } let mid = (lo + hi) / 2u; if (rys(q, mid + 1u) < v) { lo = mid + 1u; } else { hi = mid; } }
  return lo;
}
`,mn=`
/* Fläche des Vierecks q0…q3 (gegen den Uhrzeigersinn) im Kasten [c0, c1] — Sutherland–Hodgman wie geom.quadInBox. */
fn quadInBox(q0: vec2<f32>, q1: vec2<f32>, q2: vec2<f32>, q3: vec2<f32>, c0: vec2<f32>, c1: vec2<f32>) -> f32 {
  var p: array<vec2<f32>, 12>;
  var t: array<vec2<f32>, 12>;
  p[0] = q0; p[1] = q1; p[2] = q2; p[3] = q3;
  var n = 4u;
  for (var plane = 0u; plane < 4u; plane++) {
    let axis = plane / 2u;
    let s = select(-1.0, 1.0, (plane % 2u) == 1u);
    var v = c0.x;
    if (plane == 1u) { v = c1.x; } else if (plane == 2u) { v = c0.y; } else if (plane == 3u) { v = c1.y; }
    var m = 0u;
    for (var i = 0u; i < n; i++) {
      let jn = select(i + 1u, 0u, i + 1u == n);
      let pi = p[i];
      let pj = p[jn];
      let ci = s * (select(pi.x, pi.y, axis == 1u) - v);
      let cj = s * (select(pj.x, pj.y, axis == 1u) - v);
      if (ci <= 0.0) { t[m] = pi; m++; }
      if ((ci < 0.0 && cj > 0.0) || (ci > 0.0 && cj < 0.0)) { let tt = ci / (ci - cj); t[m] = pi + tt * (pj - pi); m++; }
    }
    n = m;
    for (var k = 0u; k < n; k++) { p[k] = t[k]; }
    if (n == 0u) { return 0.0; }
  }
  if (n < 3u) { return 0.0; }
  var a = 0.0;
  for (var i = 0u; i < n; i++) { let jn = select(i + 1u, 0u, i + 1u == n); a += p[i].x * p[jn].y - p[jn].x * p[i].y; }
  return abs(0.5 * a);
}
/* Liang–Barsky: der Teil [t0, t1] der Strecke p→q im Kasten (in lb), Länge t1 − t0 (Anteil). */
var<private> lb: vec2<f32>;
fn lbEdge(pp: f32, qq: f32) -> bool {
  if (pp == 0.0) { return qq >= 0.0; }
  let r = qq / pp;
  if (pp < 0.0) { if (r > lb.y) { return false; } if (r > lb.x) { lb.x = r; } }
  else { if (r < lb.x) { return false; } if (r < lb.y) { lb.y = r; } }
  return true;
}
fn clipSeg(p: vec2<f32>, q: vec2<f32>, x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
  let d = q - p;
  lb = vec2<f32>(0.0, 1.0);
  if (!lbEdge(-d.x, p.x - x0) || !lbEdge(d.x, x1 - p.x) || !lbEdge(-d.y, p.y - y0) || !lbEdge(d.y, y1 - p.y)) { lb = vec2<f32>(1.0, 0.0); return 0.0; }
  return max(0.0, lb.y - lb.x);
}
/* Die Seite mit dem kleinsten Abstand (0 links, 1 rechts, 2 unten, 3 oben), wie bodyCover.nearestSide. */
fn nearestSide(d0: f32, d1: f32, d2: f32, d3: f32) -> u32 {
  var s = 0u;
  var d = d0;
  if (d1 < d) { s = 1u; d = d1; }
  if (d2 < d) { s = 2u; d = d2; }
  if (d3 < d) { s = 3u; }
  return s;
}
`,Xi=`
/* Fläche der inneren Zelle (p, q) des Rechtecks q in der Gitterzelle (i, j) (m², relativ zur Ecke der Zelle gerechnet). */
fn areaIn(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
/* Liegt die Gitterzelle (i, j) in der Umgrenzung des Körpers (bei seiner jetzigen Lage)? */
fn boxHits(b: u32, i: i32, j: i32, m: f32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  return !(bv(b, B_BX0) > x0 + P.dx + m || bv(b, B_BX1) < x0 - m || bv(b, B_BY0) > y0 + P.dx + m || bv(b, B_BY1) < y0 - m);
}
/* Durchschneidet das Rechteck q des Körpers die Gitterzelle (i, j) in getrennte Teile (wie geom.splitsCell)? */
fn splitsCellB(b: u32, rq: u32, i: i32, j: i32) -> bool {
  let bx = rBox(rq);
  let c0 = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let c1 = c0 + vec2<f32>(P.dx, P.dx);
  var arcs: array<f32, 8>;
  var n = 0u;
  for (var e = 0u; e < 4u; e++) {
    var s0 = vec2<f32>(c0.x, c0.y); var e0 = vec2<f32>(c1.x, c0.y);
    if (e == 1u) { s0 = vec2<f32>(c1.x, c0.y); e0 = vec2<f32>(c1.x, c1.y); }
    else if (e == 2u) { s0 = vec2<f32>(c1.x, c1.y); e0 = vec2<f32>(c0.x, c1.y); }
    else if (e == 3u) { s0 = vec2<f32>(c0.x, c1.y); e0 = vec2<f32>(c0.x, c0.y); }
    if (clipSeg(toLocalB(b, s0), toLocalB(b, e0), bx.x, bx.y, bx.z, bx.w) <= 0.0) { continue; }
    arcs[2u * n] = f32(e) + lb.x;
    arcs[2u * n + 1u] = f32(e) + lb.y;
    n++;
  }
  if (n < 2u) { return false; }
  var count = n;
  for (var k = 0u; k < n; k++) {
    let jn = select(k + 1u, 0u, k + 1u == n);
    let en = arcs[2u * k + 1u];
    let st = arcs[2u * jn] + select(0.0, 4.0, jn == 0u);
    if (abs(st - en) <= 1e-6) { count--; }
  }
  return count >= 2u;
}
/* Wie viel der Strecke a→e (eine Seitenfläche) die Rechtecke aller Körper bedecken (Anteil, summiert wie BodyCover.face). */
fn faceCover(a: vec2<f32>, e: vec2<f32>) -> f32 {
  var cover = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (bv(b, B_BX0) > max(a.x, e.x) || bv(b, B_BX1) < min(a.x, e.x) || bv(b, B_BY0) > max(a.y, e.y) || bv(b, B_BY1) < min(a.y, e.y)) { continue; }
    let l0 = toLocalB(b, a);
    let l1 = toLocalB(b, e);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      cover += clipSeg(l0, l1, bx.x, bx.y, bx.z, bx.w);
    }
  }
  return cover;
}

/* -- Punkte aus den Rechtecken hinaus (bodyCover.moveOut) ------------------------------------------- */
struct Out { hit: bool, p: vec2<f32>, n: vec2<f32> }
/*
 * Liegt w jetzt in einem Rechteck des Körpers (mit dem Rand 0,02 Δx) oder kreuzt der Weg von dort, wo o unter der Lage
 * (x0, y0, a0) im Rahmen lag, eines? Dann an den Eintrittspunkt (knapp davor); war er schon vorher drin, zur nächsten Seite.
 */
fn moveOut(b: u32, w: vec2<f32>, o: vec2<f32>, pose0: vec3<f32>) -> Out {
  var res: Out;
  res.hit = false;
  let l1 = toLocalB(b, w);
  let c0 = cos(pose0.z);
  let s0 = sin(pose0.z);
  let d0 = o - pose0.xy;
  let l0 = vec2<f32>(c0 * d0.x + s0 * d0.y, -s0 * d0.x + c0 * d0.y);
  let m = 0.02 * P.dx;
  var bestT = 1e30;
  var side = 4u;
  var qx = l1;
  let nr = u32(bv(b, B_NR));
  for (var r = 0u; r < nr; r++) {
    let bx = rBox(rectOf(b, r));
    let ex0 = bx.x - m; let ey0 = bx.y - m; let ex1 = bx.z + m; let ey1 = bx.w + m;
    let in1 = l1.x > ex0 && l1.x < ex1 && l1.y > ey0 && l1.y < ey1;
    if (clipSeg(l0, l1, ex0, ey0, ex1, ey1) <= 0.0 && !in1) { continue; }
    let in0 = l0.x > ex0 && l0.x < ex1 && l0.y > ey0 && l0.y < ey1;
    if (!in0) {
      let t = lb.x;
      if (t < bestT) {
        bestT = t;
        let h = l0 + t * (l1 - l0);
        let s = nearestSide(abs(h.x - ex0), abs(h.x - ex1), abs(h.y - ey0), abs(h.y - ey1));
        side = s;
        qx = vec2<f32>(select(select(h.x, ex1, s == 1u), ex0, s == 0u), select(select(h.y, ey1, s == 3u), ey0, s == 2u));
      }
    } else if (in1 && bestT > 1e29) {
      let s = nearestSide(l1.x - ex0, ex1 - l1.x, l1.y - ey0, ey1 - l1.y);
      side = s;
      qx = vec2<f32>(select(select(l1.x, ex1, s == 1u), ex0, s == 0u), select(select(l1.y, ey1, s == 3u), ey0, s == 2u));
      bestT = 2.0;
    }
  }
  if (side > 3u) { return res; }
  let tiny = 1e-4 * P.dx;
  let nl = vec2<f32>(select(select(0.0, 1.0, side == 1u), -1.0, side == 0u), select(select(0.0, 1.0, side == 3u), -1.0, side == 2u));
  let lq = qx + nl * tiny;
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  let wx = bv(b, B_X) + c * lq.x - s * lq.y;
  let wy = bv(b, B_Y) + s * lq.x + c * lq.y;
  res.hit = true;
  res.p = vec2<f32>(clamp(wx, tiny, P.boxw - tiny), clamp(wy, tiny, P.boxh - tiny));
  res.n = vec2<f32>(c * nl.x - s * nl.y, s * nl.x + c * nl.y);
  return res;
}
/* Der Weg eines Teilchens von a nach w bei stehenden Körpern (BodyCover.hit, drei Durchgänge): Ort, Normale, Geschwindigkeit des Körpers. */
struct Hit { hit: bool, p: vec2<f32>, n: vec2<f32>, v: vec2<f32> }
fn hitAll(a: vec2<f32>, w: vec2<f32>) -> Hit {
  var h: Hit;
  h.hit = false;
  var p = w;
  let m = 2.0 * P.dx;
  for (var ps = 0u; ps < 3u; ps++) {
    var any = false;
    for (var b = 0u; b < P.nbody; b++) {
      if (bGone(b)) { continue; }
      if (max(p.x, a.x) < bv(b, B_BX0) - m || min(p.x, a.x) > bv(b, B_BX1) + m || max(p.y, a.y) < bv(b, B_BY0) - m || min(p.y, a.y) > bv(b, B_BY1) + m) { continue; }
      let o = moveOut(b, p, a, vec3<f32>(bv(b, B_X), bv(b, B_Y), bv(b, B_A)));
      if (!o.hit) { continue; }
      p = o.p;
      h.hit = true;
      h.p = p;
      h.n = o.n;
      h.v = bodyV(b, p);
      any = true;
    }
    if (!any) { break; }
  }
  return h;
}
`,Bh=`
struct PHit { p: vec2<f32>, v: vec2<f32>, hit: bool }
fn bodyHitP(a: vec2<f32>, w: vec2<f32>, v: vec2<f32>, fly: bool) -> PHit {
  var r = PHit(w, v, false);
  let h = hitAll(a, w);
  if (!h.hit) { return r; }
  r.hit = true;
  r.p = h.p;
  if (fly) { r.v = h.v; return r; }
  let vn = dot(v - h.v, h.n);
  if (vn < 0.0) { r.v = v - vn * h.n; }
  return r;
}
`,br=`
/* Fläche f (u: i + j (nx + 1), v: nu + …): die Körperzelle daneben, wenn genau eine ihrer Zellen fest ist und sie einem Körper gehört; sonst NONE. */
fn faceBody(f: u32) -> u32 {
  let n = P.n;
  var a = NONE;
  var c = NONE;
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    if (i > 0u) { a = i - 1u + j * P.nx; }
    if (i < P.nx) { c = i + j * P.nx; }
  } else {
    let g = f - P.nu;
    let i = g % P.nx;
    let j = g / P.nx;
    if (j > 0u) { a = i + (j - 1u) * P.nx; }
    if (j < P.ny) { c = i + j * P.nx; }
  }
  let sa = a != NONE && cu[U_SOLID * n + a] != 0u;
  let sc = c != NONE && cu[U_SOLID * n + c] != 0u;
  if (sa == sc) { return NONE; }
  let own = cu[U_OWNER * n + select(c, a, sa)];
  if (own == 0u) { return NONE; }
  return own - 1u;
}
/* Ihre Normalgeschwindigkeit mit dem Körper b (u: x-Komponente an (iΔx, (j + ½)Δx), v: y-Komponente an ((i + ½)Δx, jΔx)). */
fn faceVelB(f: u32, b: u32) -> f32 {
  if (f < P.nu) {
    let i = f % (P.nx + 1u);
    let j = f / (P.nx + 1u);
    return bodyU(b, vec2<f32>(f32(i) * P.dx, (f32(j) + 0.5) * P.dx)).x;
  }
  let g = f - P.nu;
  let i = g % P.nx;
  let j = g / P.nx;
  return bodyU(b, vec2<f32>((f32(i) + 0.5) * P.dx, f32(j) * P.dx)).y;
}
`,jn={RESTF:0,RESTK:1,FSUM:2,KSUM:3,M9:4},jo=16,Rs=128,vf=48,xr=11,vr=4,yr=vr+xr*Rs,Ch=yr+vf*Rs,Lh=8,Nn={friction:.5,bounce:.1};function No(o){return o.bodies.anyFree}function Oh(o){const t=new Float64Array(4);return o.worldBox(o.x,o.y,o.a,t),[t[0],t[1],t[2],t[3]]}class wr{constructor(t,e){x(this,"bod");x(this,"bgeo");x(this,"bcell");x(this,"bcon");x(this,"bat");x(this,"bread");x(this,"capBodies");x(this,"capCells");x(this,"capGeo");x(this,"nbody",0);x(this,"ncell",0);x(this,"nrect",0);x(this,"layers",2);x(this,"probed",[]);x(this,"ctx");x(this,"own",[]);this.ctx=t;const s=wr.need(e);this.capBodies=Math.max(4,s.bodies+4),this.capCells=Math.max(16,Math.ceil(s.cells*1.25)+64),this.capGeo=Math.max(64,Math.ceil(s.geo*1.25)+256);const n=(i,r)=>{const c=t.buffer(i,4*Math.max(4,r));return this.own.push(c),c};this.bod=n("bod",nn*this.capBodies),this.bgeo=n("bgeo",this.capGeo),this.bcell=n("bcell",we*this.capCells),this.bcon=n("bcon",Ch),this.bat=n("bat",jo*this.capBodies),this.bread=n("bread",hn*this.capBodies)}static need(t){if(!No(t))return{bodies:0,cells:0,geo:0};let e=0,s=rn;for(const n of t.bodies.list)if(!n.gone){e+=n.ncell,s+=n.nr*$n+xf*n.nseg;for(let i=0;i<n.nr;i+=1)s+=n.xs[i].length+n.ys[i].length}return s+=Io*(4+t.grid.n/2),{bodies:t.bodies.list.length,cells:e,geo:s}}fits(t){const e=wr.need(t);return e.bodies<=this.capBodies&&e.cells<=this.capCells&&e.geo<=this.capGeo}destroy(){this.ctx.release(this.own),this.own.length=0}upload(t){const e=this.ctx.device.queue;if(this.nbody=0,this.ncell=0,this.nrect=0,this.probed=[],!No(t))return;const s=t.bodies.list,n=t.bodies.motion,i=s.length,r=new Float32Array(nn*i),c=[],a=[],l=[],d=[];let f=0,u=0,m=0,p=0,h=0;for(const y of s)!y.gone&&y.ncell>0&&(h+=y.nr);let g=rn+$n*h;s.forEach((y,A)=>{const S=nn*A,T=y.gone||y.ncell===0,M=T?[1e9,1e9,-1e9,-1e9]:Oh(y),B=(q,R)=>{r[S+q]=R};B(Z.X,y.x),B(Z.Y,y.y),B(Z.A,y.a),B(Z.VX,y.vx),B(Z.VY,y.vy),B(Z.W,y.w),B(Z.UX,y.ux),B(Z.UY,y.uy),B(Z.UW,y.uw),B(Z.M,y.m),B(Z.I,y.I),B(Z.RMAX,y.rmax),B(Z.HULLA,y.hullA),B(Z.HULLJ,y.hullJ),B(Z.PINNED,y.pinned?1:0),B(Z.ASLEEP,y.asleep?1:0),B(Z.GONE,T?1:0),B(Z.REST,y.rest),B(Z.RX,y.rx),B(Z.RY,y.ry),B(Z.RA,y.ra);for(let q=0;q<3;q+=1)B(Z.PREV+q,n.prev[3*A+q]??0),B(Z.PRED+q,n.pred[3*A+q]??0),B(Z.PNOW+q,n.predNow[3*A+q]??0),B(Z.POLD+q,n.predOld[3*A+q]??0),B(Z.VPRE+q,n.vPre[3*A+q]??0);for(let q=0;q<6;q+=1)B(Z.MA6+q,y.ma6[q]);B(Z.MAOK,y.maOk?1:0),B(Z.MA,y.ma),B(Z.IA,y.Ia),B(Z.MAT,y.mat),B(Z.HEATER,y.heater),B(Z.NR,T?0:y.nr),B(Z.RO,f),B(Z.NCELL,T?0:y.ncell),B(Z.KO,u),B(Z.NSEG,T?0:y.nseg),B(Z.SO,m),B(Z.BX0,M[0]),B(Z.BY0,M[1]),B(Z.BX1,M[2]),B(Z.BY1,M[3]),B(Z.OX0,M[0]),B(Z.OY0,M[1]),B(Z.OX1,M[2]),B(Z.OY1,M[3]),B(Z.TOUCH,t.bodies.contacts.touches(y)?1:0),B(Z.AGAIN,T?0:1),B(Z.COS,Math.cos(y.a)),B(Z.SIN,Math.sin(y.a)),B(Z.PROBE,!T&&!y.pinned?1:0),B(Z.KEY,y.key);let L=0;for(let q=0;q<y.ncell;q+=1)L+=y.cellVolume(q);if(B(Z.VOL,L),B(Z.E0,ks(y.mat)),!T){!y.pinned&&this.probed.length<Lh&&this.probed.push(A);for(let q=0;q<y.nr;q+=1){const[R,E,I,j]=y.bounds(q);p=Math.max(p,Math.min(I-R,j-E));const $=g;for(const J of y.xs[q])a.push(J);g+=y.xs[q].length;const U=g;for(const J of y.ys[q])a.push(J);g+=y.ys[q].length,c.push(R,E,I,j,y.ni[q],y.nj[q],$,U,u+y.off[q],A,0,0);for(let J=0;J<y.ni[q]*y.nj[q];J+=1)d.push(f+q)}for(let q=0;q<y.nseg;q+=1)l.push(f+y.segR[q],y.segS[q],y.segT0[q],y.segT1[q],A,0,0,0);f+=y.nr,u+=y.ncell,m+=y.nseg}});const v=g,w=v+l.length,b=qh(t),_=new Float32Array(Math.max(rn,w+b.length));_[ws.SEGS]=v,_[ws.PARTS]=w,_[ws.NPARTS]=b.length/Io,_[ws.NRECT]=f,_[ws.NCELL]=u,_[ws.NBODY]=i,_.set(c,rn),_.set(a,rn+$n*h),_.set(l,v),_.set(b,w);const F=new Float32Array(we*Math.max(1,u));let k=0;for(const y of s)if(!(y.gone||y.ncell===0))for(let A=0;A<y.ncell;A+=1)F[we*k]=y.E[A],F[we*k+1]=y.film[A],F[we*k+2]=y.crust[A],F[we*k+3]=d[k],k+=1;e.writeBuffer(this.bod,0,r),e.writeBuffer(this.bgeo,0,_),e.writeBuffer(this.bcell,0,F),e.writeBuffer(this.bcon,0,this.warmTable(t)),e.writeBuffer(this.bat,0,new Uint32Array(jo*this.capBodies)),this.nbody=i,this.ncell=u,this.nrect=f;const P=Math.min(64,Math.ceil(p/t.grid.dx)+3);this.layers=P+P%2}warmTable(t){const e=t.bodies.contacts,s=new Uint32Array(yr),n=new Float32Array(s.buffer),i=Math.min(Rs,e.warmCount);s[0]=i;for(let r=0;r<i;r+=1){const c=e.warmKey[r],a=Math.floor(c/1e6),l=vr+xr*r;s[l]=a,s[l+1]=Math.round(c-a*1e6);const d=9*r;s[l+2]=e.warmData[d];for(let f=0;f<2;f+=1)s[l+3+4*f]=Math.max(0,Math.round(e.warmData[d+1+4*f]))>>>0,n[l+4+4*f]=e.warmData[d+2+4*f],n[l+5+4*f]=e.warmData[d+3+4*f],s[l+6+4*f]=e.warmData[d+4+4*f]===1?1:0}return s}async download(t,e){if(this.nbody===0)return;const[s,n,i]=await e([{buf:this.bod,offset:0,size:4*nn*this.nbody},{buf:this.bcell,offset:0,size:4*we*Math.max(1,this.ncell)},{buf:this.bcon,offset:0,size:4*yr}]),r=new Float32Array(s),c=new Float32Array(n),a=t.bodies.list,l=t.bodies.motion;let d=0;a.forEach((h,g)=>{if(g>=this.nbody)return;const v=nn*g,w=_=>r[v+_],b=h.gone||h.ncell===0;if(!b)for(let _=0;_<h.ncell;_+=1)h.E[_]=c[we*d],h.film[_]=c[we*d+1],h.crust[_]=c[we*d+2],d+=1;if(!b){h.x=w(Z.X),h.y=w(Z.Y),h.a=w(Z.A),h.vx=w(Z.VX),h.vy=w(Z.VY),h.w=w(Z.W),h.ux=w(Z.UX),h.uy=w(Z.UY),h.uw=w(Z.UW),h.asleep=w(Z.ASLEEP)!==0,h.rest=w(Z.REST),h.rx=w(Z.RX),h.ry=w(Z.RY),h.ra=w(Z.RA);for(let _=0;_<3;_+=1)l.prev[3*g+_]=w(Z.PREV+_),l.pred[3*g+_]=w(Z.PRED+_),l.predNow[3*g+_]=w(Z.PNOW+_),l.predOld[3*g+_]=w(Z.POLD+_),l.vPre[3*g+_]=w(Z.VPRE+_);for(let _=0;_<6;_+=1)h.ma6[_]=w(Z.MA6+_);h.maOk=w(Z.MAOK)!==0,h.ma=w(Z.MA),h.Ia=w(Z.IA),w(Z.GONE)!==0&&(t.bodies.cover.release(h),h.gone=!0,h.ncell=0)}});const f=new Uint32Array(i),u=new Float32Array(i),m=t.bodies.contacts,p=Math.min(Rs,f[0]);m.warmKey.length<p&&(m.warmKey=new Float64Array(2*p+8),m.warmData=new Float64Array(9*(2*p+8)));for(let h=0;h<p;h+=1){const g=vr+xr*h;m.warmKey[h]=f[g]*1e6+f[g+1];const v=9*h;m.warmData[v]=f[g+2];for(let w=0;w<2;w+=1)m.warmData[v+1+4*w]=f[g+3+4*w],m.warmData[v+2+4*w]=u[g+4+4*w],m.warmData[v+3+4*w]=u[g+5+4*w],m.warmData[v+4+4*w]=f[g+6+4*w]}m.warmCount=p,m.invalidate()}parse(t,e,s){const n=new Float32Array(t,e,hn*s),i=[];for(let r=0;r<s;r+=1){const c=hn*r,a=n[c+Ht.STATE];i.push({x:n[c+Ht.X],y:n[c+Ht.Y],a:n[c+Ht.A],vx:n[c+Ht.VX],vy:n[c+Ht.VY],w:n[c+Ht.W],pinned:(a&1)!==0,asleep:(a&2)!==0,gone:(a&4)!==0,m:n[c+Ht.M],T:n[c+Ht.T],E:n[c+Ht.E],film:n[c+Ht.FILM],crust:n[c+Ht.CRUST],fx:n[c+Ht.FX],fy:n[c+Ht.FY],tq:n[c+Ht.TQ]})}return i}}function qh(o){const t=o.grid,e=[],s=t.w,n=t.h,i=(u,m,p,h,g,v)=>{e.push(u,m,p,h,g,v.friction,v.bounce,0)};t.openL||i(-1,-1,0,n+1,1,Nn),t.openR||i(s,-1,s+1,n+1,2,Nn),t.openB||i(-1,-1,s+1,0,3,Nn),t.openT||i(-1,n,s+1,n+1,4,Nn);const{nx:r,ny:c,dx:a}=t,l=u=>{const m=dt[u-1];return m!==void 0?{friction:m.friction,bounce:m.bounce}:Nn};let d=new Map,f=10;for(let u=0;u<=c;u+=1){const m=new Map;if(u<c){let p=0;for(;p<r;){const h=p+u*r;if(t.solid[h]===0||t.owner[h]!==0){p+=1;continue}const g=t.solid[h];let v=p;for(;v+1<r&&t.solid[v+1+u*r]===g&&t.owner[v+1+u*r]===0;)v+=1;const w=g<<24|p<<12|v;m.set(w,d.has(w)?d.get(w):u),p=v+1}}for(const[p,h]of d)m.get(p)!==h&&i((p>>12&4095)*a,h*a,((p&4095)+1)*a,u*a,f++,l(p>>>24));d=m}return e}function Eh(o,t,e){const s=oi(o,t);if(s<0)return null;const n=o.scene.ops[s],i=[];let r=0,c=0,a=0,l="gone";return o.bodies.list.forEach((d,f)=>{const u=e==null?void 0:e[f];if(d.gone||d.key!==s||(u==null?void 0:u.gone)===!0)return;const m=(u==null?void 0:u.x)??d.x,p=(u==null?void 0:u.y)??d.y,h=(u==null?void 0:u.a)??d.a,g=Math.cos(h),v=Math.sin(h);for(let _=0;_<d.nr;_+=1){const[F,k,P,y]=d.bounds(_);for(const[A,S]of[[F,k],[P,k],[P,y],[F,y]])i.push(m+g*A-v*S,p+v*A+g*S)}r+=d.m;const w=d.m*dt[d.mat].cp;c+=w*(u!==void 0&&u.T>0?u.T:d.meanT()),a+=w;const b=d.pinned?"pinned":(u==null?void 0:u.asleep)??d.asleep?"asleep":"moving";(l==="gone"||b==="moving")&&(l=b)}),{id:t,kind:n.op,outline:i,T:a>0?c/a:n.T,mass:r,state:l}}function Rh(o,t){let e=0;return o.bodies.list.forEach((s,n)=>{const i=t[n];i!==void 0&&!i.gone&&Ie(s.mat)>0&&(e+=i.m)}),e}class yf{constructor(t){x(this,"g");x(this,"last",null);x(this,"latent0",0);x(this,"stored0",0);x(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=sc(n),r=t.budget(),c={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},a=this.last;let l=0,d=0;if(a!==null&&c.t>a.t){const m=c.t-a.t,p=(c.heater-a.heater)/m,h=(c.solids-a.solids+c.SG-a.SG+c.lossS-a.lossS+c.LG-a.LG+c.sens-a.sens+c.bub-a.bub)/m;l=(c.vap-a.vap)/m,d=Math.max(0,(p-h)/i)}this.last=c;const f=this.vapour()*i,u=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=u),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:u-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:d}}copyTo(t){const e=t;e.last=this.last===null?null:{...this.last},e.latent0=this.latent0,e.stored0=this.stored0,e.started=this.started}copyFrom(t){const e=t;this.last=e.last===null?null:{...e.last},this.latent0=e.latent0,this.stored0=e.stored0,this.started=e.started}}const on=800,Ih=24,_a=6,Gt=4,pn=16,Qt=256,Fa=`struct Levels { lv: array<Level, ${pn}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,ai=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Qi=`${ai}
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
`,We=`
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
`,gs=`
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
`,Pa=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Aa=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Lt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Je=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,wf=6,Ks=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,no=`
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
`,io="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",jh=[{name:"cgPrep1",wg:Qt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${ai}
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
}`},{name:"cgPrep2",wg:Qt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Je}
${Qi}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${wf}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:Qt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
}`},{name:"cclFinal",wg:Qt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Je}
${no}
${Ks}
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
}`},{name:"cclProject",wg:Qt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Je}
${io}
${Ks}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Qt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Je}
${ai}
${gs}
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
}`},{name:"cgFoldInitMG",wg:Qt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${gs}
${Aa}
${Lt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Je}
${We}
${gs}
${Pa}
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
}`},{name:"cgB",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Je}
${We}
${gs}
${Pa}
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
}`},{name:"cgFoldRR",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${We}
${gs}
${Aa}
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
}`},{name:"cgRZ",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${We}
${gs}
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
}`},{name:"cgZSum",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${We}
${no}
${Ks}
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
}`},{name:"cgZSub",wg:Qt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${We}
${io}
${Ks}
${gs}
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
}`},{name:"cgEnd1",wg:Qt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Je}
${no}
${Ks}
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
}`},{name:"cgEnd2",wg:Qt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Je}
${io}
${Ks}
${Lt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],an={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},gn=16,V={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72,REL_MASS:73,REL_N:74,REL_MISS:75,EVAP_CAP:76,BODYWORK:77,IT_P:78,CAP_P:79,RES_P:80,PARKED:81,CONT_FULL:82,BVMAX:83},Ts=96,ka=16,Nh=57,Jt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Le=16,Dh={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Do=8,Kt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},Fe=8,Uh={TSUM:0,CELLS:1},Uo=2,Vh={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},_f=16,tt={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69,FS:70,CAPB:71,TSB:72,ESY:73,FSY:74,KSY:75,WSUM:76,HW:77,COVL:78,COVB:79,KS:80,KF:81,DSF:82,GF:83,GK:84,PE0:85,RE0:86,KN0:87,PE1:88,RE1:89,KN1:90},ro=91,jt={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5,OWNER:6,MATB:7,PAINT:8,SPLIT:9,NOW1:10,NOW2:11,KNEW:12,BAND:13,HBODY:14},oo=15,Vo={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16},co=17,He={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},ao=20,Gh={KNOWN:0,MARK:1,MARK2:2,GAS:3},Sa=4,Hh={F:0},lo=1,$h={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},Go=12,ee=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),Wh=[ee("G_",an),ee("C_",V),ee("R_",Jt),ee("RA_",Dh),ee("H_",Kt),ee("HA_",Uh),ee("S_",Vh),ee("F_",tt),ee("U_",jt),ee("A_",Vo),ee("FF_",He),ee("FU_",Gh),ee("AF_",Hh),ee("BA_",$h),`const RACC_STRIDE: u32 = ${Do}u;`,`const HEAT_STRIDE: u32 = ${Fe}u;`,`const HACC_STRIDE: u32 = ${Uo}u;`,`const CGS_STRIDE: u32 = ${_f}u;`,`const BACC_STRIDE: u32 = ${Go}u;`].join(`
`),Kh=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function zh(o,t){const e=[];let s=0,n=0,i=o,r=t,c=1,a=0;for(;;){const d=i+2,f=(i+2)*(r+2),u={};for(const h of Kh)u[h]=s,s+=f;const m=n;n+=f;let p=0;if(u.pW=0,e.length>0&&(u.pW=s,s+=4*a,p=n,n+=4*a),e.push({nx:i,ny:r,stride:d,size:f,h:c,f:u,act:m,pIdx:p}),i*r<=Ih||i<=2&&r<=2||e.length>=pn)break;a=f,i=Math.ceil(i/2),r=Math.ceil(r/2),c*=2}let l=e.length-1;for(let d=0;d<e.length;d+=1){let f=0;for(let u=d;u<e.length;u+=1)f+=e[u].size;if(f<=on){l=d;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function Ni(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const Ff={tol:1e-5,it:V.IT_L,cap:V.CAP_L,res:V.RES_L},Pf={tol:1e-5,it:V.IT_G,cap:V.CAP_G,res:V.RES_G},Af={tol:1e-5,it:V.IT_H,cap:V.CAP_H,res:V.RES_H},kf={tol:1e-5,it:V.IT_D,cap:V.CAP_D,res:V.RES_H},Sf={tol:1e-4,it:V.IT_P,cap:V.CAP_P,res:V.RES_P},zs=200,xe=256;class Yh{constructor(t,e,s){x(this,"ctx");x(this,"plan");x(this,"b");x(this,"l0");x(this,"lp");x(this,"lv");x(this,"it");x(this,"cfg");x(this,"kinds",[]);x(this,"groups",new Map);x(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);Ni(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(xe/4*n.length);for(let l=0;l<n.length;l+=1)Ni(l>0?n[l-1]:null,l-1,r,xe/4*l),Ni(n[l],l,r,xe/4*l+32);this.lp=t.uniform("lp",r.buffer);const c=new Uint32Array(32*pn+4);for(let l=0;l<n.length;l+=1)Ni(n[l],l,c,32*l);c[32*pn]=e.lt,c[32*pn+1]=n.length,this.lv=t.uniform("lv",c.buffer);const a=new Uint32Array(xe/4*(zs+1));for(let l=0;l<zs;l+=1)a[xe/4*l]=l;a[xe/4*zs]=4294967295,this.it=t.uniform("iter",a.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(xe*8));for(const l of[Ff,Pf,Af,kf,Sf])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,xe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,xe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:xe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,xe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s,n=!1){const i=this.setKind(e),r={SV:this.range(this.cfg,i,16)},c=this.n0cells;this.run(t,"cgPrep1",c,`c${i}`,r),this.run(t,"cgPrep2",c),s&&(this.run(t,"cclMerge",c),this.run(t,"cclFinal",c),this.run(t,"cclProject",c)),n||this.coarsen(t),this.run(t,"cgInitMG",c),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],c={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,c)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n,r=!1){const c=this.n0cells;this.prepare(t,e,n,r);const a=(d,f)=>{const u={IT:this.itRes(d)};i?(this.run(t,"cgZSum",c,f,u),this.run(t,"cgZSub",c,f,u)):this.run(t,"cgRZ",c,f,u)};this.vcycle(t),a(zs,`k${zs}`);const l=Math.min(zs,Math.max(1,s));for(let d=0;d<l;d+=1){const f={IT:this.itRes(d)};this.run(t,"cgA",c,`k${d}`,f),this.run(t,"cgB",c,`k${d}`,f),this.one(t,"cgFoldRR",`k${d}`,f),this.vcycle(t),a(d,`k${d}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const fo=256,Xh=3*8;class Qh{constructor(t,e){x(this,"pb");x(this,"itP",12);this.state=t,this.solver=e,this.pb=t.ctx.buffer("probesel",fo*Xh,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.writeSel()}writeSel(){const t=this.state.ctx.device.queue,e=this.state.bodies.probed;for(let s=0;s<Math.min(8,e.length);s+=1)for(let n=0;n<3;n+=1)t.writeBuffer(this.pb,fo*(3*s+n),new Uint32Array([e[s],n,0,0]))}destroy(){this.state.ctx.release([this.pb])}prepare(t,e){e.one(t,"bPrep"),e.parts(t,"bPush"),e.bubs(t,"bPushB"),e.cells(t,"bCover"),e.cells(t,"bClose1"),e.cells(t,"bClose2"),e.cells(t,"bFlip"),e.cells(t,"bApply"),e.cells(t,"gasApply"),e.cells(t,"bStatic"),e.one(t,"bPrepEnd")}probe(t,e){const s=this.state.bodies.probed;if(s.length===0)return;const n=this.state.d.n,i=this.solver.level0;for(let r=0;r<Math.min(8,s.length);r+=1)for(let c=0;c<3;c+=1){const a=3*r+c,l={PB:{buffer:this.pb,offset:fo*a,size:16},L:i};e.run(t,"bProbeRhs",n,`pr${a}`,l),this.solver.encodeMG(t,Sf,this.itP,!0,!1,!0),e.run(t,"bProbeDot",n,`pd${a}`,l)}e.one(t,"bProbeFin")}finish(t,e){const s=this.state.bodies;e.cells(t,"bCollectPrep"),e.run(t,"bCollect",Math.max(1,s.ncell),"bCollect",{}),e.run(t,"bCollectRest",Math.max(1,s.ncell),"bCollectRest",{}),e.cells(t,"bCollectEnd"),e.cells(t,"bExtInit","A");for(let n=0;n<s.layers;n+=2)e.cells(t,"bExtA"),e.cells(t,"bExtB");e.run(t,"bForce",64*Math.max(1,s.nbody),"bForce",{}),e.one(t,"bDyn")}measure(t,e){e.run(t,"bMeas",64*Math.max(1,this.state.bodies.nbody),"bMeas",{})}adapt(t,e){if(t===0&&e===0)return;const s=e>0?Math.ceil(this.itP*1.5)+2:t+1;this.itP=Math.min(40,Math.max(4,this.itP>s?Math.max(s,this.itP-2):s))}}function K(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const $t=o=>o.map(K).join(", "),Nt=Mt.species[0],Di=Mt.species[1],Ui=Mt.species[2],Ms=Nt.liquid.cp.table,Ke=Ms.map(o=>o[0]),Ls=Ms.map(o=>o[1]),_r=[Ls[0]*(Ke[0]-nt)];for(let o=1;o<Ms.length;o+=1)_r.push(_r[o-1]+.5*(Ls[o]+Ls[o-1])*(Ke[o]-Ke[o-1]));const[Zh,Jh,t1]=Nt.vapour.cp.linear,Ho=nt+100,e1=(()=>{let o=0;for(;o<Ke.length-2&&Ho>=Ke[o+1];)o+=1;const t=Ho-Ke[o],e=(Ls[o+1]-Ls[o])/(Ke[o+1]-Ke[o]);return _r[o]+Ls[o]*t+.5*e*t*t})(),s1=e1+Nt.saturation.hlv100.v,Ne=Mt.solids,Tf=Mt.species.slice(3).map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{cA:e,cB:s,h0:e*nt+.5*s*nt*nt,rA:t.rho.linear[0],rB:t.rho.linear[1],kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v}}),Mf=1+Tf.length,ve=o=>`array<f32, ${Mf}>(${$t([0,...Tf.map(o)])})`,uo=4294967295,n1=`
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
  bodies: u32, nbody: u32, ext: u32, pad0: u32,
}`,Ta=52,i1=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,Ys=27,r1=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Xs=29,o1=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,ho=8,c1=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,a1=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${K(nt)};
const R_GAS: f32 = ${K(Dt)};
const P_ATM: f32 = ${K(zn)};
const G0: f32 = ${K(Lr)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${K(Di.molarMass.v)};
const M_O2: f32 = ${K(Ui.molarMass.v)};
const M_H2O: f32 = ${K(Nt.molarMass.v)};
const CP_N2: f32 = ${K(Di.gas.cp.v)};
const CP_O2: f32 = ${K(Ui.gas.cp.v)};
const CPV0: f32 = ${K(Zh)};
const CPV1: f32 = ${K(Jh)};
const CPV_T: f32 = ${K(t1)};
const T100: f32 = ${K(Ho)};
const HV100: f32 = ${K(s1)};
const NCP: i32 = ${Ms.length};
const CP_T = array<f32, ${Ms.length}>(${$t(Ke)});
const CP_V = array<f32, ${Ms.length}>(${$t(Ls)});
const CP_H = array<f32, ${Ms.length}>(${$t(_r)});
const KELL = array<f32, 7>(${$t(Nt.liquid.kell.c)});
const KL = array<f32, 3>(${$t(Nt.liquid.k.poly)});
const VA: f32 = ${K(Nt.liquid.mu.vogel[0])};
const VB: f32 = ${K(Nt.liquid.mu.vogel[1])};
const VC: f32 = ${K(Nt.liquid.mu.vogel[2])};
const ST_B: f32 = ${K(Nt.surfaceTension.B)};
const ST_b: f32 = ${K(Nt.surfaceTension.b)};
const ST_MU: f32 = ${K(Nt.surfaceTension.mu)};
const T_CRIT: f32 = ${K(Nt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${K(Nt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${$t(Nt.saturation.if97.n)});
const RVC = array<f32, 6>(${$t(Nt.saturation.vapourDensity.c)});
const KV: f32 = ${K(Nt.vapour.k.v)};
const MUV: f32 = ${K(Nt.vapour.mu.v)};
const KN = array<f32, 3>(${$t(Di.gas.k.power)});
const KO = array<f32, 3>(${$t(Ui.gas.k.power)});
const MN = array<f32, 3>(${$t(Di.gas.mu.sutherland)});
const MO = array<f32, 3>(${$t(Ui.gas.mu.sutherland)});
const DV0: f32 = ${K(Mt.vapourInAir.D0.v)};
const DVT0: f32 = ${K(Mt.vapourInAir.T0.v)};
const DVE: f32 = ${K(Mt.vapourInAir.exponent.v)};
const NSOL: u32 = ${Ne.length}u;
const S_RHO = array<f32, ${Ne.length}>(${$t(Ne.map(o=>o.rho.v))});
const S_CP = array<f32, ${Ne.length}>(${$t(Ne.map(o=>o.cp.v))});
const S_K = array<f32, ${Ne.length}>(${$t(Ne.map(o=>o.k.v))});
const S_THETA = array<f32, ${Ne.length}>(${$t(Ne.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${K(af)};
const REG_STRIDE: u32 = ${Le}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${K(Pl)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${K(ds)};
const NLIQ: u32 = ${Mf}u;
const L_CA = ${ve(o=>o.cA)};
const L_CB = ${ve(o=>o.cB)};
const L_H0 = ${ve(o=>o.h0)};
const L_RA = ${ve(o=>o.rA)};
const L_RB = ${ve(o=>o.rB)};
const L_KA = ${ve(o=>o.kA)};
const L_KB = ${ve(o=>o.kB)};
const L_MA = ${ve(o=>o.mA)};
const L_MB = ${ve(o=>o.mB)};
const L_MC = ${ve(o=>o.mC)};
const L_SIG = ${ve(o=>o.sigma)};
`,l1=`
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
`,f1=`
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
`,yc=[n1,i1,r1,o1,c1,a1,Wh,l1,f1].join(`
`),Ae=Mt.solutes[0],Wn=298.15,De=o=>o.map(K).join(", "),Pi=14,ls=Ae.cp.range.lo,fs=Ae.cp.range.hi,[Bf,u1,d1,h1,m1,p1]=Ae.cp.laliberte,g1=o=>Math.exp(u1*(o-nt)+d1*Math.exp(.01*(o-nt))),Fr=.5*(fs-ls),Is=new Array(Pi).fill(0);{for(let t=0;t<64;t+=1){const e=Math.PI*(t+.5)/64,s=g1(.5*(fs+ls)+Fr*Math.cos(e));for(let n=0;n<Pi;n+=1)Is[n]+=2/64*s*Math.cos(n*e)}Is[0]/=2}const $o=o=>o<Pi?Is[o]:0,Pn=new Array(Pi+1).fill(0);Pn[1]=Is[0]-$o(2)/2;for(let o=2;o<=Pi;o+=1)Pn[o]=($o(o-1)-$o(o+1))/(2*o);const li=(o,t)=>{let e=0,s=0;for(let n=o.length-1;n>=1;n-=1){const i=2*t*e-s+o[n];s=e,e=i}return t*e-s+o[0]},Pr=li(Is,-1),Cf=li(Is,1),Wo=li(Pn,-1),Lf=o=>{if(o<=ls)return Pr*(o-nt);const t=Pr*(ls-nt);return o>=fs?t+Fr*(li(Pn,1)-Wo)+Cf*(o-fs):t+Fr*(li(Pn,(2*o-ls-fs)/(fs-ls))-Wo)},b1=Pr*(ls-nt),x1=Lf(fs),v1=Ae.dHsol.v/Qe+ds*(Wn-nt)-1e3*Bf*Lf(Wn);function Ma(o,t){const e=[`fn ${o}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let s=t.length-1;s>=1;s-=1)e.push(`  t = 2.0 * x * b1 - b2 + ${K(t[s])}; b2 = b1; b1 = t;`);return e.push(`  return x * b1 - b2 + ${K(t[0])};`,"}"),e.join(`
`)}const Dn=Ae.pitzer,Vi=Ae.pitzerCold,y1=Math.sqrt(2*Math.PI*pl),w1=rr*rr/(4*Math.PI*gl*ml),Qs=Ae.solubility.table,Un=Ae.density.laliberte,_1=`
const S_TR: f32 = ${K(Wn)};
const S_MS: f32 = ${K(Qe)};
const S_MW: f32 = ${K(qr)};
const S_NU: f32 = ${K(Ae.ions.v)};
const PZ_B: f32 = ${K(Dn.b.v)};
const PZ_ALPHA: f32 = ${K(Dn.alpha.v)};
const PZ_COLD: f32 = ${K(Vi.below.v)};
const PZ_B0 = array<f32, 6>(${De(Dn.b0.a)});
const PZ_B1 = array<f32, 6>(${De(Dn.b1.a)});
const PZ_C = array<f32, 6>(${De(Dn.c.a)});
const PZC_B0 = array<f32, 6>(${De(Vi.b0.a)});
const PZC_B1 = array<f32, 6>(${De(Vi.b1.a)});
const PZC_C = array<f32, 6>(${De(Vi.c.a)});
const S_EPS = array<f32, 4>(${De(Ae.dielectric.c)});
const S_KN: f32 = ${K(y1)};
const S_KLB: f32 = ${K(w1)};
const SOL_T = array<f32, ${Qs.length}>(${De(Qs.map(o=>o[0]))});
const SOL_M = array<f32, ${Qs.length}>(${De(Qs.map(o=>o[1]))});
const LD0: f32 = ${K(Un[0])};
const LD1: f32 = ${K(Un[1])};
const LD2: f32 = ${K(Un[2])};
const LD3: f32 = ${K(Un[3])};
const LD4: f32 = ${K(Un[4])};
const LA1: f32 = ${K(Bf)};
const LA4: f32 = ${K(h1)};
const LA5: f32 = ${K(m1)};
const LA6: f32 = ${K(p1)};
const E_LO: f32 = ${K(ls)};
const E_HI: f32 = ${K(fs)};
const E_LOV: f32 = ${K(Pr)};
const E_HIV: f32 = ${K(Cf)};
const E_HALF: f32 = ${K(Fr)};
const E_FM1: f32 = ${K(Wo)};
const E_ILO: f32 = ${K(b1)};
const E_IHI: f32 = ${K(x1)};
const S_QS: f32 = ${K(v1)};
const S_DMU: f32 = ${K(Ae.diffusivity.v*Os(Wn)/Wn)};

${Ma("eCh",Is)}
${Ma("iCh",Pn)}
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
  for (var k = 1; k < ${Qs.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${Qs.length-1}];
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
`,Of=[],bn=new Map;{let o=[];const t=_1.split(`
`);for(let e=0;e<t.length;e+=1){const s=t[e];if(s.startsWith("const ")){Of.push(s),o=[];continue}if(s.startsWith("/*")){o=[s];continue}const n=/^fn (\w+)\(/.exec(s);if(n===null){s.trim()===""&&(o=[]);continue}const i=[...o,s];if(!s.trimEnd().endsWith("}"))for(;e+1<t.length&&t[e]!=="}";)e+=1,i.push(t[e]);bn.set(n[1],i.join(`
`)),o=[]}}const qf=o=>new RegExp(`\\b${o}\\s*\\(`),F1=new Map([...bn.entries()].map(([o,t])=>[o,[...bn.keys()].filter(e=>e!==o&&qf(e).test(t))]));function P1(o){const t=new Set,e=s=>{if(!t.has(s)){t.add(s);for(const n of F1.get(s)??[])e(n)}};for(const s of bn.keys())qf(s).test(o)&&e(s);return t.size===0?"":[...Of,...[...bn.keys()].filter(s=>t.has(s)).map(s=>bn.get(s))].join(`
`)}class A1{constructor(t){x(this,"name");x(this,"binds");x(this,"wg");x(this,"source");x(this,"pipeline",null);x(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=S1(t.bind),this.source=B1(t,this.binds,this.wg)}}const k1={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function S1(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":k1[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const T1=`
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
`,M1=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function B1(o,t,e){const s=[yc,`const WG: u32 = ${e}u;`,T1],n=P1(o.code);n!==""&&s.push(n);const i=new Set(t.map(r=>r.name));for(const r of t)r.mode==="a"&&i.add(`${r.name}!`);for(const r of M1)r.needs.every(c=>i.has(c))&&s.push(r.code);return t.forEach((r,c)=>{r.mode==="u"?s.push(`@group(0) @binding(${c}) var<uniform> ${r.name}: ${r.type};`):r.mode==="t"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_storage_2d<rgba8unorm, write>;`):r.mode==="x"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_2d<f32>;`):r.mode==="s"?s.push(`@group(0) @binding(${c}) var ${r.name}: sampler;`):r.mode==="r"?s.push(`@group(0) @binding(${c}) var<storage, read> ${r.name}: array<${r.type}>;`):r.mode==="w"?s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<${r.type}>;`):(s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<atomic<u32>>;`),s.push(`fn addF_${r.name}(i: u32, v: f32) {
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
`)}class wc{constructor(t){x(this,"device");x(this,"kernels",new Map);x(this,"timestamps");x(this,"adapter","");x(this,"bufs",[]);x(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}}),r=new wc(i),c=e.info;return c!==void 0&&(r.adapter=[c.vendor,c.architecture,c.description].filter(Boolean).join(" ")),r}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new A1(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),c=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(c.length>0){const l=n.source.split(`
`);for(const d of c)e.push(`${s.name}:${d.lineNum}:${d.linePos} ${d.message}
    ${l[d.lineNum-1]??""}`);return}const a=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,d)=>l.mode==="t"?{binding:d,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:d,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:d,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:d,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=a;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[a]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const ns=128,is="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ba="@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Zs=`const BA_STRIDE: u32 = ${jo}u;
const BA_RESTF: u32 = ${jn.RESTF}u;
const BA_RESTK: u32 = ${jn.RESTK}u;
const BA_FSUM: u32 = ${jn.FSUM}u;
const BA_KSUM: u32 = ${jn.KSUM}u;
const BA_M9: u32 = ${jn.M9}u;`,Ca=`
fn areaInC(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
`,Ef=`
fn inForceBand(c: u32) -> bool {
  let x0 = f32(ci(c)) * P.dx;
  let y0 = f32(cj(c)) * P.dx;
  let m = 4.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bFree(b)) { continue; }
    if (bv(b, B_BX0) - m > x0 + P.dx || bv(b, B_BX1) + m < x0 || bv(b, B_BY0) - m > y0 + P.dx || bv(b, B_BY1) + m < y0) { continue; }
    return true;
  }
  return false;
}
`;function La(o,t,e,s,n,i,r){return{name:o,wg:ns,bind:"P:u bod:r cf:w",code:`${Pe}
${Ef}
${is} {
  let c = gid.x;
  if (c >= P.n || !inForceBand(c)) { return; }
  let n = P.n;
  let kn = cf[${s} * n + c];
  if (kn != 0.0) { cf[${n} * n + c] = cf[${t} * n + c]; cf[${i} * n + c] = cf[${e} * n + c]; cf[${r} * n + c] = kn; return; }
  let i = ci(c);
  let j = cj(c);
  let gdx = P.gy * P.dx;
  var s = 0.0;
  var r = 0.0;
  var cnt = 0.0;
  if (i > 0 && cf[${s} * n + c - 1u] != 0.0) { s += cf[${t} * n + c - 1u]; r += cf[${e} * n + c - 1u]; cnt += 1.0; }
  if (i + 1 < i32(P.nx) && cf[${s} * n + c + 1u] != 0.0) { s += cf[${t} * n + c + 1u]; r += cf[${e} * n + c + 1u]; cnt += 1.0; }
  if (j > 0 && cf[${s} * n + c - P.nx] != 0.0) { s += cf[${t} * n + c - P.nx] - cf[${e} * n + c - P.nx] * gdx; r += cf[${e} * n + c - P.nx]; cnt += 1.0; }
  if (j + 1 < i32(P.ny) && cf[${s} * n + c + P.nx] != 0.0) { s += cf[${t} * n + c + P.nx] + cf[${e} * n + c + P.nx] * gdx; r += cf[${e} * n + c + P.nx]; cnt += 1.0; }
  if (cnt > 0.0) { cf[${n} * n + c] = s / cnt; cf[${i} * n + c] = r / cnt; cf[${r} * n + c] = 2.0; }
  else { cf[${n} * n + c] = 0.0; cf[${i} * n + c] = 0.0; cf[${r} * n + c] = 0.0; }
}`}}const Oa=`
fn jacobian(c: u32, b: u32) -> vec3<f32> {
  let i = ci(c);
  let j = cj(c);
  let bx = bv(b, B_X);
  let by = bv(b, B_Y);
  var J = vec3<f32>(0.0);
  /* Die rechte u-Fläche: die Zelle liegt links von ihr (+); die linke: rechts (−); die obere v-Fläche: darunter (+); die untere: darüber (−). */
  let fr = uF(i + 1, j);
  if (faceBody(fr) == b) { let yf = (f32(j) + 0.5) * P.dx; J += vec3<f32>(1.0, 0.0, -(yf - by)); }
  let fl = uF(i, j);
  if (faceBody(fl) == b) { let yf = (f32(j) + 0.5) * P.dx; J += vec3<f32>(-1.0, 0.0, yf - by); }
  let ft = vF(i, j + 1);
  if (faceBody(ft) == b) { let xf = (f32(i) + 0.5) * P.dx; J += vec3<f32>(0.0, 1.0, xf - bx); }
  let fb = vF(i, j);
  if (faceBody(fb) == b) { let xf = (f32(i) + 0.5) * P.dx; J += vec3<f32>(0.0, -1.0, -(xf - bx)); }
  return J;
}
`,qa="struct ProbeSel { b: u32, k: u32, p1: u32, p2: u32 }",C1=[{name:"bCollectPrep",wg:ns,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:r bat:a",code:`${ie}
${mn}
${Ca}
${Zs}
${is} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!(cf[F_WSUM * n + c] > 0.0) || cu[U_PAINT * n + c] != 0u) { return; }
  let df = cf[F_FILM * n + c] - cf[F_FSY * n + c];
  let dk = cf[F_CRUST * n + c] - cf[F_KSY * n + c];
  if (df >= 0.0 && dk >= 0.0) { return; }
  let i = ci(c);
  let j = cj(c);
  let w0 = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  var gF = 0.0;
  var gK = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (bv(b, B_BX0) > w0.x + P.dx || bv(b, B_BX1) < w0.x || bv(b, B_BY0) > w0.y + P.dx || bv(b, B_BY1) < w0.y) { continue; }
    let l0 = toLocalB(b, w0);
    let l1 = toLocalB(b, w0 + vec2<f32>(P.dx, 0.0));
    let l2 = toLocalB(b, w0 + vec2<f32>(P.dx, P.dx));
    let l3 = toLocalB(b, w0 + vec2<f32>(0.0, P.dx));
    let lmin = min(min(l0, l1), min(l2, l3));
    let lmax = max(max(l0, l1), max(l2, l3));
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let rq = rectOf(b, r);
      let bx = rBox(rq);
      if (lmin.x > bx.z || lmax.x < bx.x || lmin.y > bx.w || lmax.y < bx.y) { continue; }
      let ni = u32(rv(rq, GR_NI));
      let nj = u32(rv(rq, GR_NJ));
      let ko = u32(rv(rq, GR_KO));
      for (var qq = firstRow(rq, nj, lmin.y); qq < nj; qq++) {
        let ya = rys(rq, qq);
        if (ya > lmax.y) { break; }
        for (var pp = firstCol(rq, ni, lmin.x); pp < ni; pp++) {
          let xa = rxs(rq, pp);
          if (xa > lmax.x) { break; }
          let A = (rxs(rq, pp + 1u) - xa) * (rys(rq, qq + 1u) - ya);
          let area = areaInC(b, rq, pp, qq, i, j);
          if (area <= 1e-12 * A) { continue; }
          let k = ko + pp + qq * ni;
          gF += area / A * bcell[BC * k + 1u];
          gK += area / A * bcell[BC * k + 2u];
        }
      }
    }
  }
  cf[F_GF * n + c] = gF;
  cf[F_GK * n + c] = gK;
  let own = cu[U_OWNER * n + c];
  if (own == 0u) { return; }
  let o = (own - 1u) * BA_STRIDE;
  if (df < 0.0 && -df > gF) { addF_bat(o + BA_RESTF, -df - gF); }
  if (dk < 0.0 && -dk > gK) { addF_bat(o + BA_RESTK, -dk - gK); }
}`},{name:"bCollect",wg:ns,bind:"P:u bod:r bgeo:r bcell:w cf:r cu:r bat:a",code:`${ie}
${mn}
${Ca}
${Zs}
${is} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let n = P.n;
  let ni = u32(rv(rq, GR_NI));
  let loc = k - u32(rv(rq, GR_KO));
  let p = loc % ni;
  let q = loc / ni;
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  let A = (x1 - x0) * (y1 - y0);
  let mb = u32(bv(b, B_MAT)) + 1u;
  let Ck = solidRho(mb) * solidCp(mb) * A * P.depth;
  /* Die Gitterzellen der Umgrenzung des Vierecks in der Welt. */
  let w0 = toWorldRel(b, vec2<f32>(x0, y0), vec2<f32>(0.0));
  let w1 = toWorldRel(b, vec2<f32>(x1, y0), vec2<f32>(0.0));
  let w2 = toWorldRel(b, vec2<f32>(x1, y1), vec2<f32>(0.0));
  let w3 = toWorldRel(b, vec2<f32>(x0, y1), vec2<f32>(0.0));
  let lo = min(min(w0, w1), min(w2, w3));
  let hi = max(max(w0, w1), max(w2, w3));
  let i0 = max(0, i32(floor(lo.x * P.invdx)));
  let i1 = min(i32(P.nx) - 1, i32(floor(hi.x * P.invdx)));
  let j0 = max(0, i32(floor(lo.y * P.invdx)));
  let j1 = min(i32(P.ny) - 1, i32(floor(hi.y * P.invdx)));
  let film = bcell[BC * k + 1u];
  let crust = bcell[BC * k + 2u];
  var dE = 0.0;
  var dF = 0.0;
  var dK = 0.0;
  for (var j = j0; j <= j1; j++) {
    for (var i = i0; i <= i1; i++) {
      let c = cellOf(i, j);
      if (cu[U_PAINT * n + c] != 0u) { continue; }
      let area = areaInC(b, rq, p, q, i, j);
      if (area <= 1e-12 * A) { continue; }
      let w = area / A;
      let capB = cf[F_CAPB * n + c];
      let de = cf[F_ES * n + c] - cf[F_ESY * n + c];
      if (de != 0.0 && capB > 0.0) { dE += de * w * Ck / capB; }
      let ws = cf[F_WSUM * n + c];
      let df = cf[F_FILM * n + c] - cf[F_FSY * n + c];
      if (df > 0.0 && ws > 0.0) { dF += df * w / ws; }
      else if (df < 0.0 && cf[F_GF * n + c] > 0.0) { dF -= min(1.0, -df / cf[F_GF * n + c]) * w * film; }
      let dk = cf[F_CRUST * n + c] - cf[F_KSY * n + c];
      if (dk > 0.0 && ws > 0.0) { dK += dk * w / ws; }
      else if (dk < 0.0 && cf[F_GK * n + c] > 0.0) { dK -= min(1.0, -dk / cf[F_GK * n + c]) * w * crust; }
    }
  }
  bcell[BC * k] += dE;
  let f1 = max(0.0, film + dF);
  let k1 = max(0.0, crust + dK);
  bcell[BC * k + 1u] = f1;
  bcell[BC * k + 2u] = k1;
  if (f1 > 0.0) { addF_bat(b * BA_STRIDE + BA_FSUM, f1); }
  if (k1 > 0.0) { addF_bat(b * BA_STRIDE + BA_KSUM, k1); }
}`},{name:"bCollectRest",wg:ns,bind:"P:u bod:r bgeo:r bcell:w bat:a",code:`${ie}
${Zs}
${is} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let o = b * BA_STRIDE;
  let rf = getF_bat(o + BA_RESTF);
  let F = getF_bat(o + BA_FSUM);
  if (rf > 0.0 && F > 0.0) { bcell[BC * k + 1u] *= max(0.0, 1.0 - rf / F); }
  let rk = getF_bat(o + BA_RESTK);
  let K = getF_bat(o + BA_KSUM);
  if (rk > 0.0 && K > 0.0) { bcell[BC * k + 2u] *= max(0.0, 1.0 - rk / K); }
}`},{name:"bCollectEnd",wg:ns,bind:"P:u cf:w bat:a",code:`${Zs}
${is} {
  let c = gid.x;
  if (c == 0u) {
    for (var b = 0u; b < P.nbody; b++) { for (var f = 0u; f < 4u; f++) { atomicStore(&bat[b * BA_STRIDE + f], 0u); } }
  }
  if (c >= P.n) { return; }
  let n = P.n;
  if (!(cf[F_CAPB * n + c] > 0.0)) { return; }
  cf[F_ESY * n + c] = cf[F_ES * n + c];
  cf[F_FSY * n + c] = cf[F_FILM * n + c];
  cf[F_KSY * n + c] = cf[F_CRUST * n + c];
}`},{name:"bExtInit",wg:ns,bind:"P:u glob:r bod:r cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${Pe}
${Ef}
${is} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  cf[F_KN1 * n + c] = 0.0;
  if (!inForceBand(c)) { cf[F_KN0 * n + c] = 0.0; return; }
  let k = cu[U_KIND * n + c];
  var pe = 0.0;
  var re = 0.0;
  var kn = 0.0;
  if (k == LIQUID) {
    pe = cf[F_PL * n + c];
    var m = 0.0;
    var v = 0.0;
    let st = cellStart(c);
    let cn = ccount[c];
    for (var q = 0u; q < cn; q++) {
      let pk = st + q;
      if ((parts[pk].flags & 1u) != 0u || !(parts[pk].mass > 0.0)) { continue; }
      m += parts[pk].mass;
      v += parts[pk].mass / parts[pk].rho;
    }
    re = select(glob[G_RHOREF], m / v, v > 0.0);
    kn = 1.0;
  } else if (k == GAS && cu[U_SOLID * n + c] == 0u) {
    /* Der Druck, den die Flüssigkeit an ihrer Oberfläche sah (p0 vom Anfang des Schritts, liqPressure in F_PL), dazu p′. */
    pe = cf[F_PL * n + c] + cf[F_PG * n + c];
    let rho = cf[F_RHO * n + c];
    re = select(P.rhoamb, rho, rho > 0.0);
    kn = 1.0;
  }
  cf[F_PE0 * n + c] = pe;
  cf[F_RE0 * n + c] = re;
  cf[F_KN0 * n + c] = kn;
}`},La("bExtA","F_PE0","F_RE0","F_KN0","F_PE1","F_RE1","F_KN1"),La("bExtB","F_PE1","F_RE1","F_KN1","F_PE0","F_RE0","F_KN0"),{name:"bForce",wg:64,bind:"P:u glob:r bod:w bgeo:r cf:r cu:r",code:`${ie}
var<workgroup> rf: array<vec4<f32>, 64>;
var<workgroup> rw: array<vec2<f32>, 64>;
var<workgroup> wfree: u32;
/* Der fortgesetzte Druck an (x, y): bilinear über die bekannten Zellmitten (bodyForces.pressureAt). */
fn pressureAt(x: f32, y: f32) -> f32 {
  let fx = clamp(x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  var s = 0.0;
  var ws = 0.0;
  for (var b = 0u; b < 2u; b++) {
    for (var a = 0u; a < 2u; a++) {
      let c = i + a + (j + b) * P.nx;
      if (cf[F_KN0 * P.n + c] == 0.0) { continue; }
      let w = select(tx, 1.0 - tx, a == 0u) * select(ty, 1.0 - ty, b == 0u);
      s += w * cf[F_PE0 * P.n + c];
      ws += w;
    }
  }
  return select(0.0, s / ws, ws > 0.0);
}
/* Der Druck an einem Punkt des Umrisses mit der Aussennormalen nrm: aus den Fluidzellen eine halbe Zelle davor (bodyForces.sideAt). */
fn sideAt(m: vec2<f32>, nrm: vec2<f32>) -> f32 {
  let sp = m + 0.5 * P.dx * nrm;
  let fx = clamp(sp.x * P.invdx - 0.5, 0.0, f32(P.nx) - 1.0001);
  let fy = clamp(sp.y * P.invdx - 0.5, 0.0, f32(P.ny) - 1.0001);
  let i = u32(floor(fx));
  let j = u32(floor(fy));
  let tx = fx - f32(i);
  let ty = fy - f32(j);
  var ls = 0.0; var lw = 0.0; var gs = 0.0; var gw = 0.0;
  for (var b = 0u; b < 2u; b++) {
    for (var a = 0u; a < 2u; a++) {
      let ii = i + a;
      let jj = j + b;
      let c = ii + jj * P.nx;
      if (cf[F_KN0 * P.n + c] != 1.0) { continue; }
      let xc = (f32(ii) + 0.5) * P.dx;
      let yc = (f32(jj) + 0.5) * P.dx;
      if ((xc - m.x) * nrm.x + (yc - m.y) * nrm.y <= 0.0) { continue; }
      let w = select(tx, 1.0 - tx, a == 0u) * select(ty, 1.0 - ty, b == 0u) + 1e-6;
      let v = cf[F_PE0 * P.n + c] + cf[F_RE0 * P.n + c] * P.gy * (yc - m.y);
      if (cu[U_KIND * P.n + c] == LIQUID) { ls += w * v; lw += w; } else { gs += w * v; gw += w; }
    }
  }
  if (lw > 0.0 && gw > 0.0) { return max(ls / lw, gs / gw); }
  if (lw > 0.0) { return ls / lw; }
  if (gw > 0.0) { return gs / gw; }
  return pressureAt(m.x, m.y);
}
${Ba} {
  let b = wid3.x;
  let lid = lid3.x;
  if (lid == 0u) { wfree = select(0u, 1u, b < P.nbody && bFree(b)); }
  let fr = workgroupUniformLoad(&wfree);
  if (fr == 0u) { return; }
  let cs = bv(b, B_COS);
  let sn = bv(b, B_SIN);
  let bx = bv(b, B_X);
  let by = bv(b, B_Y);
  var acc = vec4<f32>(0.0);
  var wet = vec2<f32>(0.0);
  let ns = u32(bv(b, B_NSEG));
  let so = u32(bv(b, B_SO));
  let segBase = u32(bgeo[GH_SEGS]);
  for (var e = 0u; e < ns; e++) {
    let sb = segBase + (so + e) * SS;
    let rq = u32(bgeo[sb + GS_RECT]);
    let side = u32(bgeo[sb + GS_SIDE]);
    let t0 = bgeo[sb + GS_T0];
    let t1 = bgeo[sb + GS_T1];
    let bxr = rBox(rq);
    /* Das Stück als Strecke im eigenen Rahmen (Body2D.segment) und seine Aussennormale. */
    var a0 = vec2<f32>(bxr.x, t0); var a1 = vec2<f32>(bxr.x, t1); var nl = vec2<f32>(-1.0, 0.0);
    if (side == 1u) { a0 = vec2<f32>(bxr.z, t0); a1 = vec2<f32>(bxr.z, t1); nl = vec2<f32>(1.0, 0.0); }
    else if (side == 2u) { a0 = vec2<f32>(t0, bxr.y); a1 = vec2<f32>(t1, bxr.y); nl = vec2<f32>(0.0, -1.0); }
    else if (side == 3u) { a0 = vec2<f32>(t0, bxr.w); a1 = vec2<f32>(t1, bxr.w); nl = vec2<f32>(0.0, 1.0); }
    let len = length(a1 - a0);
    let nw = vec2<f32>(cs * nl.x - sn * nl.y, sn * nl.x + cs * nl.y);
    let np = max(1u, u32(ceil(len / (0.5 * P.dx))));
    let A = len / f32(np) * P.depth;
    for (var q = lid; q < np; q += 64u) {
      let t = (f32(q) + 0.5) / f32(np);
      let l = a0 + t * (a1 - a0);
      let r = vec2<f32>(cs * l.x - sn * l.y, sn * l.x + cs * l.y);
      let p = sideAt(vec2<f32>(bx, by) + r, nw) * A;
      acc += vec4<f32>(-p * nw.x, -p * nw.y, -p * (r.x * nw.y - r.y * nw.x), 0.0);
    }
    /* Die Schätzung der mitbewegten Masse: welcher Anteil der Seitenlänge vor Flüssigkeit liegt (Stücke ≤ Δx, eine halbe Zelle davor). */
    let n2 = max(1u, u32(ceil(len / P.dx)));
    for (var q = lid; q < n2; q += 64u) {
      let t = (f32(q) + 0.5) / f32(n2);
      let l = a0 + t * (a1 - a0) + 0.5 * P.dx * nl;
      let wp = vec2<f32>(bx + cs * l.x - sn * l.y, by + sn * l.x + cs * l.y);
      let c = cellAtN(wp.x, wp.y);
      wet += vec2<f32>(select(0.0, len / f32(n2), c != NONE && cu[U_KIND * P.n + c] == LIQUID), len / f32(n2));
    }
  }
  rf[lid] = acc;
  rw[lid] = wet;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) {
    if (lid < s) { rf[lid] += rf[lid + s]; rw[lid] += rw[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let o = b * BS;
    bod[o + B_FX] = rf[0].x;
    bod[o + B_FY] = rf[0].y;
    bod[o + B_TQ] = rf[0].z;
    let f = select(0.0, rw[0].x / rw[0].y, rw[0].y > 0.0);
    let rho = glob[G_RHOREF];
    bod[o + B_MA] = 1.5 * rho * f * bv(b, B_HULLA) * P.depth;
    bod[o + B_IA] = rho * f * bv(b, B_HULLJ) * P.depth;
  }
}`},{name:"bProbeRhs",wg:ns,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:w",code:`${qa}
${Pe}
${br}
${Oa}
${is} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let s = s0(c);
  var v = 0.0;
  let b = PB.b;
  if (b < P.nbody && bAwake(b) && mgU[L.act + s] != 0u && cu[U_KIND * P.n + c] == LIQUID) {
    let J = jacobian(c, b);
    v = -P.dx * J[PB.k];
  }
  cgv[s] = 0.0;
  cgv[P.n0 + s] = v;
}`},{name:"bProbeDot",wg:ns,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:r bat:a",code:`${qa}
${Pe}
${br}
${Oa}
${Zs}
var<workgroup> rj: array<vec3<f32>, WG>;
${is} {
  let c = gid.x;
  let lid = lid3.x;
  var v = vec3<f32>(0.0);
  let b = PB.b;
  if (c < P.n && b < P.nbody) {
    let s = s0(c);
    if (mgU[L.act + s] != 0u && cu[U_KIND * P.n + c] == LIQUID) { v = cgv[s] * jacobian(c, b); }
  }
  rj[lid] = v;
  workgroupBarrier();
  for (var st = WG / 2u; st > 0u; st >>= 1u) {
    if (lid < st) { rj[lid] += rj[lid + st]; }
    workgroupBarrier();
  }
  if (lid == 0u && b < P.nbody) {
    let o = b * BA_STRIDE + BA_M9 + PB.k;
    if (rj[0].x != 0.0) { addF_bat(o, rj[0].x); }
    if (rj[0].y != 0.0) { addF_bat(o + 3u, rj[0].y); }
    if (rj[0].z != 0.0) { addF_bat(o + 6u, rj[0].z); }
  }
}`},{name:"bProbeFin",wg:64,bind:"P:u glob:r bod:w bat:a",code:`${Pe}
${Zs}
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let a = b * BA_STRIDE + BA_M9;
    if (bod[b * BS + B_PROBE] != 0.0 && bAwake(b)) {
      let s = -glob[G_DT] * P.dx * P.depth;
      var m: array<f32, 9>;
      for (var i = 0u; i < 9u; i++) { m[i] = s * getF_bat(a + i); }
      let o = b * BS + B_MA6;
      bod[o] = m[0];
      bod[o + 1u] = 0.5 * (m[1] + m[3]);
      bod[o + 2u] = 0.5 * (m[2] + m[6]);
      bod[o + 3u] = m[4];
      bod[o + 4u] = 0.5 * (m[5] + m[7]);
      bod[o + 5u] = m[8];
      bod[b * BS + B_MAOK] = 1.0;
    }
    for (var i = 0u; i < 9u; i++) { atomicStore(&bat[a + i], 0u); }
  }
}`},{name:"bMeas",wg:64,bind:"P:u bod:r bgeo:r bcell:r bread:w",code:`${ie}
var<workgroup> rm: array<vec4<f32>, 64>;
var<workgroup> rk: array<f32, 64>;
fn cellT(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
${Ba} {
  let b = wid3.x;
  let lid = lid3.x;
  if (b >= P.nbody) { return; }
  let gone = bGone(b);
  let nk = select(u32(bv(b, B_NCELL)), 0u, gone);
  let ko = u32(bv(b, B_KO));
  let mb = u32(bv(b, B_MAT)) + 1u;
  let rcp = solidRho(mb) * solidCp(mb) * P.depth;
  var acc = vec4<f32>(0.0);
  var ck = 0.0;
  for (var k = lid; k < nk; k += 64u) {
    let kk = ko + k;
    let rq = u32(bcell[BC * kk + 3u]);
    let loc = kk - u32(rv(rq, GR_KO));
    let ni = u32(rv(rq, GR_NI));
    let p = loc % ni;
    let q = loc / ni;
    let C = rcp * (rxs(rq, p + 1u) - rxs(rq, p)) * (rys(rq, q + 1u) - rys(rq, q));
    let E = bcell[BC * kk];
    let film = bcell[BC * kk + 1u];
    let crust = bcell[BC * kk + 2u];
    acc += vec4<f32>(C * cellT(E, C, film, crust), E, film, crust);
    ck += C;
  }
  rm[lid] = acc;
  rk[lid] = ck;
  workgroupBarrier();
  for (var s = 32u; s > 0u; s >>= 1u) {
    if (lid < s) { rm[lid] += rm[lid + s]; rk[lid] += rk[lid + s]; }
    workgroupBarrier();
  }
  if (lid == 0u) {
    let o = b * BR;
    bread[o + BRD_X] = bv(b, B_X); bread[o + BRD_Y] = bv(b, B_Y); bread[o + BRD_A] = bv(b, B_A);
    bread[o + BRD_VX] = bv(b, B_VX); bread[o + BRD_VY] = bv(b, B_VY); bread[o + BRD_W] = bv(b, B_W);
    bread[o + BRD_STATE] = select(0.0, 1.0, bv(b, B_PINNED) != 0.0) + select(0.0, 2.0, bv(b, B_ASLEEP) != 0.0) + select(0.0, 4.0, gone);
    bread[o + BRD_M] = bv(b, B_M);
    bread[o + BRD_T] = select(0.0, rm[0].x / rk[0], rk[0] > 0.0);
    bread[o + BRD_E] = rm[0].y; bread[o + BRD_FILM] = rm[0].z; bread[o + BRD_CRUST] = rm[0].w;
    bread[o + BRD_FX] = bv(b, B_FX); bread[o + BRD_FY] = bv(b, B_FY); bread[o + BRD_TQ] = bv(b, B_TQ);
    bread[o + BRD_MAOK] = bv(b, B_MAOK);
  }
}`}],$e=128,ye="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",fi=`
fn massOf(c: u32) -> f32 {
  let n = P.n;
  return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c];
}
fn deriveCell(c: u32) {
  let n = P.n;
  let vg = max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
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
  let capB = cf[F_CAPB * n + c];
  var cs = 0.0;
  if (capB > 0.0) { cs = capB + cf[F_CRUST * n + c] * CP_CRYSTAL; }
  else { cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_CRUST * n + c] * CP_CRYSTAL; }
  let film = cf[F_FILM * n + c];
  let E = cf[F_ES * n + c];
  let solid = s != 0u;
  var T = 0.0;
  if (film <= 0.0) { T = T0 + E / cs; }
  else {
    T = select(cf[F_TSB * n + c], cf[F_T * n + c], solid);
    if (!(T > 100.0)) { T = T0 + E / cs; }
    for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  }
  cf[F_TSB * n + c] = T;
  if (solid) { cf[F_T * n + c] = T; }
}
`,Ea=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,Zi=`
var<workgroup> rr: array<f32, ${16*$e}>;
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
`,L1=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:$e,bind:"P:u cf:w cu:r at:w reg:r",code:`${fi}
${ye} {
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
  ${t===2?"":`/* Flüssige Zelle ohne Gas, auch eben geleert (release, Wechsel der Zellart): Mole, Wärmekapazität und Dichte 0, wie Gas.deriveCell
     nach move — sonst zählte heatPrep die alte Wärmekapazität mit, und heatShare liesse Enthalpie in der leeren Zelle. */
  if (k == LIQUID && massOf(c) <= 0.0) {
    cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; cf[F_NMOL * n + c] = 0.0; cf[F_CAP * n + c] = 0.0; cf[F_RHO * n + c] = 0.0;
    ${t===1?"cf[F_VEOSMID * n + c] = 0.0;":""}
    return;
  }
  deriveCell(c);`}
  var veos = 0.0;
  if (cf[F_VGAS * n + c] > 0.0) { veos = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c); }
  cf[F_VEOS * n + c] = veos;
  ${t===1?"cf[F_VEOSMID * n + c] = veos;":""}
  ${t===2?"cf[F_SRCV * n + c] = select(0.0, veos - cf[F_VEOSMID * n + c], k == GAS);":""}
}`})),{name:"transitions",wg:$e,bind:"P:u cf:r cu:r at:a cnt:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
/* Die nächste Gaszelle im Fenster 9 × 9 um c (Ringe 1…4), wie die Breitensuche von Gas.release: von Zelle zu Zelle über ihre
   Seiten (links, rechts, unten, oben wie die CPU), nur durch nicht feste Zellen desselben Gebiets und nur im Fenster; die erste
   Gaszelle ist das Ziel, NONE, wenn keine. Es zählt der Weg, nicht die Lage: dieselbe Nummer allein hiesse nur „irgendwo verbunden“,
   eine Gaszelle hinter einer dünnen Wand wäre sonst nah. Marken (81 Bit) und Warteschlange liegen im Speicher des Fadens. */
fn nearGas(c: u32) -> u32 {
  let n = P.n;
  let r = cu[U_RID * n + c];
  if (r == NONE) { return NONE; }
  /* Fensterzelle w = a + 9 b (a, b = 0…8); c ist w = 40. */
  let i0 = ci(c) - 4;
  let j0 = cj(c) - 4;
  var seen = array<u32, 3>(0u, 1u << 8u, 0u);
  var queue: array<u32, 81>;
  queue[0] = 40u;
  var head = 0u;
  var tail = 1u;
  loop {
    if (head >= tail) { break; }
    let w = queue[head];
    head += 1u;
    for (var k = 0u; k < 4u; k++) {
      var a = i32(w % 9u);
      var b = i32(w / 9u);
      if (k == 0u) { a -= 1; } else if (k == 1u) { a += 1; } else if (k == 2u) { b -= 1; } else { b += 1; }
      if (a < 0 || b < 0 || a > 8 || b > 8 || !inGrid(i0 + a, j0 + b)) { continue; }
      let v = u32(a + 9 * b);
      let bit = 1u << (v & 31u);
      if ((seen[v >> 5u] & bit) != 0u) { continue; }
      seen[v >> 5u] = seen[v >> 5u] | bit;
      let q = cellOf(i0 + a, j0 + b);
      let kq = cu[U_KIND * n + q];
      if (kq == SOLID || cu[U_RID * n + q] != r) { continue; }
      if (kq == GAS) { return q; }
      queue[tail] = v;
      tail += 1u;
    }
  }
  return NONE;
}
/* Wie Gas.release: das ganze Gas der flüssigen Zelle c zur ersten Gaszelle gerade darüber (durch nicht feste Zellen); versperren ein
   Feststoff oder der Deckel der Kiste den Weg, zur nächsten Gaszelle, die im Fenster um c erreichbar ist (nearGas). Ohne Ziel bleibt
   es (gezählt). Nur atomare Beiträge in at und cnt: gasApply bucht sie in der nächsten Dispatch. */
fn release(c: u32) {
  let m = mass(c);
  if (!(m > 0.0)) { return; }
  var t = NONE;
  var q = c;
  for (var k = 0u; k < P.ny; k++) {
    if (cj(q) + 1 >= i32(P.ny)) { break; }
    q += P.nx;
    let kq = cu[U_KIND * P.n + q];
    if (kq == SOLID) { break; }
    if (kq == GAS) { t = q; break; }
  }
  if (t == NONE) { t = nearGas(c); }
  if (t == NONE) { atomicAdd(&cnt[C_REL_MISS], 1u); return; }
  moveGas(c, t, 1.0);
  addF_cnt(C_REL_MASS, m);
  atomicAdd(&cnt[C_REL_N], 1u);
}
${ye} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let was = cu[U_KPREV * n + c];
  let now = cu[U_KIND * n + c];
  if (now == LIQUID && was == LIQUID) { release(c); return; }
  if (was == now || now == SOLID || was == SOLID) { return; }
  var wsum = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { wsum += vol(nb); } }
  if (wsum <= 0.0) { if (now == LIQUID) { release(c); } return; }
  if (now == LIQUID) {
    for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { moveGas(c, nb, vol(nb) / wsum); } }
    return;
  }
  let have = mass(c);
  var want = 0.0;
  for (var k = 0u; k < 4u; k++) { let nb = nbOf(c, k); if (stableGas(nb)) { want += vol(nb) / wsum * cf[F_RHO * n + nb]; } }
  want *= max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  if (want <= have) { return; }
  for (var k = 0u; k < 4u; k++) {
    let nb = nbOf(c, k);
    if (!stableGas(nb)) { continue; }
    let mnb = mass(nb);
    if (mnb <= 0.0) { continue; }
    moveGas(nb, c, min(0.25, (want - have) * (vol(nb) / wsum) / mnb));
  }
}`},{name:"regCells",wg:$e,bind:"P:u cf:r cu:r racc:a",code:`${Zi}
${ye} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${Zi}
${ye} {
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
}`},{name:"regBubs",wg:$e,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${ye} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a cnt:a",code:`${Ea}
${ye} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    let vfOld = reg[o + R_VFLUID];
    let p0Old = reg[o + R_P0];
    var vf = vfOld;
    if (P.bodies != 0u) { vf = max(1e-12, getF_racc(a + RA_VSUM)); reg[o + R_VFLUID] = vf; }
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
    ${t?"if (P.bodies != 0u && reg[o + R_OPEN] == 0.0 && r < P.nreg) { addF_cnt(C_BODYWORK, p0Old * vfOld - reg[o + R_P0] * vf); }":""}
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compSums",wg:$e,bind:"P:u cf:r cu:r reg:r racc:a",code:`${Zi}
${ye} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Ea}
${ye} {
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
}`})),{name:"compApply",wg:$e,bind:"P:u cf:w cu:r reg:r",code:`${fi}
${ye} {
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
}`},{name:"gasVolumes",wg:$e,bind:"P:u cf:w cu:r reg:r",code:`${ye} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let m = cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c];
  if (k == LIQUID && m + cf[F_MF * n + c] <= 0.0) { cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; return; }
  let vg = max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  cf[F_VGAS * n + c] = vg;
  cf[F_RHO * n + c] = m / vg;
  cf[F_VEOS * n + c] = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c);
}`},{name:"markFaces",wg:$e,bind:"P:u cu:r ff:w fu:w",code:`${ye} {
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
}`}],Be=128,Ce="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ra="@compute @workgroup_size(WG) fn main(@builtin(local_invocation_id) lid3: vec3<u32>)",Ia=`
fn inBandM(i: i32, j: i32, m: f32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (bv(b, B_BAND) == 0.0) { continue; }
    let bx0 = min(bv(b, B_BX0), bv(b, B_OX0)) - m;
    let by0 = min(bv(b, B_BY0), bv(b, B_OY0)) - m;
    let bx1 = max(bv(b, B_BX1), bv(b, B_OX1)) + m;
    let by1 = max(bv(b, B_BY1), bv(b, B_OY1)) + m;
    if (bx0 > x0 + P.dx || bx1 < x0 || by0 > y0 + P.dx || by1 < y0) { continue; }
    return true;
  }
  return false;
}
`,ja=`
fn paintedC(x: u32) -> bool { return cu[U_PAINT * P.n + x] != 0u; }
fn bandC(x: u32) -> bool { return cu[U_BAND * P.n + x] != 0u; }
fn ownerC(x: u32) -> u32 { return cu[U_OWNER * P.n + x]; }
fn fsC(x: u32) -> f32 { return cf[F_FS * P.n + x]; }
/* Die Fläche zwischen zwei Nachbarn ist ganz bedeckt (die linke bzw. untere Fläche der Zelle b). */
fn coveredU(b: u32) -> bool { return cf[F_COVL * P.n + b] >= 1.0 - COVERED_EPS; }
fn coveredV(b: u32) -> bool { return cf[F_COVB * P.n + b] >= 1.0 - COVERED_EPS; }
/* Welche Zelle eine ganz bedeckte Fläche zwischen a und b schliesst: die mit dem grösseren Anteil, gleich die erste — „gleich“ bis auf das
   Rauschen von f32 (zwei halbe Zellen einer Wand quer über zwei Zellen sind 0,4999992 und 0,5000027): sonst entschiede die Rundung. */
fn pickPair(a: u32, b: u32) -> u32 {
  let fa = select(-1.0, fsC(a), ownerC(a) != 0u);
  let fb = select(-1.0, fsC(b), ownerC(b) != 0u);
  if (fa < 0.0 && fb < 0.0) { return NONE; }
  return select(a, b, fb > fa + 1e-4);
}
`,O1=`
fn besideOther(x: u32) -> bool {
  let own = ownerC(x);
  let i = ci(x);
  let j = cj(x);
  for (var k = 0u; k < 4u; k++) {
    var ii = i;
    var jj = j;
    if (k == 0u) { ii -= 1; } else if (k == 1u) { ii += 1; } else if (k == 2u) { jj -= 1; } else { jj += 1; }
    if (!inGrid(ii, jj)) { if (!sideOpen(k)) { return true; } continue; }
    let nb = cellOf(ii, jj);
    if (paintedC(nb)) { return true; }
    let on = ownerC(nb);
    if (on != 0u && on != own && (cu[U_SOLID * P.n + nb] != 0u || fsC(nb) >= SQUEEZE_B)) { return true; }
  }
  return false;
}
/* Geschlossen nach Schwelle, Schnitt und SQUEEZE; eine gemalte Zelle zählt als zu; ausserhalb des Bands bleibt alles, wie es ist. */
fn now0(x: u32) -> bool {
  if (!bandC(x)) { return cu[U_SOLID * P.n + x] != 0u; }
  if (paintedC(x)) { return true; }
  let own = ownerC(x);
  if (own == 0u) { return false; }
  let fs = fsC(x);
  /* Ein freier Körper: zu ab CLOSED_F, eine schon geschlossene Zelle bleibt es bis unter REOPEN_F (kbodylib.ts). */
  let thrF = select(CLOSED_F, REOPEN_F, cu[U_SOLID * P.n + x] != 0u);
  if (fs >= select(CLOSED_P, thrF, bFree(own - 1u)) || cu[U_SPLIT * P.n + x] != 0u) { return true; }
  return fs >= SQUEEZE_B && besideOther(x);
}
`,q1=`
fn gasMass(c: u32) -> f32 { let n = P.n; return cf[F_MN * n + c] + cf[F_MO * n + c] + cf[F_MV * n + c] + cf[F_MF * n + c]; }
fn gasVol(c: u32) -> f32 { let v = cf[F_VGAS * P.n + c]; return select(P.vcell, v, v > 0.0); }
fn moveGasB(a: u32, b: u32, share: f32) {
  let n = P.n;
  let dN = cf[F_MN * n + a] * share; let dO = cf[F_MO * n + a] * share; let dV = cf[F_MV * n + a] * share;
  let dF = cf[F_MF * n + a] * share; let dH = cf[F_HG * n + a] * share;
  addF_at(A_DN * n + a, -dN); addF_at(A_DO * n + a, -dO); addF_at(A_DV * n + a, -dV); addF_at(A_DF * n + a, -dF); addF_at(A_DH * n + a, -dH);
  addF_at(A_DN * n + b, dN); addF_at(A_DO * n + b, dO); addF_at(A_DV * n + b, dV); addF_at(A_DF * n + b, dF); addF_at(A_DH * n + b, dH);
}
/* Der Nachbar über Seite k (0 links, 1 rechts, 2 unten, 3 oben), wenn kein Körper die Fläche ganz bedeckt (gas.across). */
fn acrossB(c: u32, k: u32) -> u32 {
  let i = ci(c);
  let j = cj(c);
  if (k == 0u) { if (i > 0 && cf[F_COVL * P.n + c] < 1.0 - COVERED_EPS) { return c - 1u; } return NONE; }
  if (k == 1u) { if (i + 1 < i32(P.nx) && cf[F_COVL * P.n + c + 1u] < 1.0 - COVERED_EPS) { return c + 1u; } return NONE; }
  if (k == 2u) { if (j > 0 && cf[F_COVB * P.n + c] < 1.0 - COVERED_EPS) { return c - P.nx; } return NONE; }
  if (j + 1 < i32(P.ny) && cf[F_COVB * P.n + c + P.nx] < 1.0 - COVERED_EPS) { return c + P.nx; }
  return NONE;
}
`,E1=[{name:"bPrep",wg:64,bind:"P:u bod:w bgeo:r",code:`${ie}
${Ra} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    let again = bod[o + B_AGAIN] != 0.0;
    bod[o + B_AGAIN] = 0.0;
    if (bod[o + B_GONE] != 0.0) {
      bod[o + B_BAND] = select(0.0, 1.0, again);
      bod[o + B_BX0] = 1e9; bod[o + B_BY0] = 1e9; bod[o + B_BX1] = -1e9; bod[o + B_BY1] = -1e9;
      continue;
    }
    let awake = bod[o + B_PINNED] == 0.0 && bod[o + B_ASLEEP] == 0.0;
    if (awake) {
      /* Der Randwert dieses Schritts: die Geschwindigkeit samt Vorhersage (bodies.prepare). */
      for (var d = 0u; d < 3u; d++) { bod[o + B_PNOW + d] = bod[o + B_PRED + d]; }
      bod[o + B_UX] = bod[o + B_VX] + bod[o + B_PRED];
      bod[o + B_UY] = bod[o + B_VY] + bod[o + B_PRED + 1u];
      bod[o + B_UW] = bod[o + B_W] + bod[o + B_PRED + 2u];
    }
    let c = cos(bod[o + B_A]);
    let s = sin(bod[o + B_A]);
    bod[o + B_COS] = c;
    bod[o + B_SIN] = s;
    var lo = vec2<f32>(1e30, 1e30);
    var hi = vec2<f32>(-1e30, -1e30);
    let x = bod[o + B_X];
    let y = bod[o + B_Y];
    let nr = u32(bod[o + B_NR]);
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      for (var q = 0u; q < 4u; q++) {
        let lx = select(bx.z, bx.x, q == 0u || q == 3u);
        let ly = select(bx.w, bx.y, q < 2u);
        let w = vec2<f32>(x + c * lx - s * ly, y + s * lx + c * ly);
        lo = min(lo, w);
        hi = max(hi, w);
      }
    }
    bod[o + B_BX0] = lo.x; bod[o + B_BY0] = lo.y; bod[o + B_BX1] = hi.x; bod[o + B_BY1] = hi.y;
    bod[o + B_BAND] = select(0.0, 1.0, awake || again);
  }
}`},{name:"bPush",wg:Be,bind:"P:u cnt:a bod:r bgeo:r parts:w",code:`${ie}
${mn}
${Xi}
${Ce} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if ((q.flags & 1u) != 0u || !(q.mass > 0.0)) { return; }
  var pos = vec2<f32>(q.x, q.y);
  var vel = vec2<f32>(q.vx, q.vy);
  var moved = false;
  let m = 2.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { q.x = pos.x; q.y = pos.y; q.vx = vel.x; q.vy = vel.y; parts[p] = q; }
}`},{name:"bPushB",wg:64,bind:"P:u cnt:a bod:r bgeo:r bubs:w",code:`${ie}
${mn}
${Xi}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>) {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let k = gid.x;
  if (k >= count) { return; }
  var B = bubs[k];
  if (B.alive == 0u) { return; }
  var pos = vec2<f32>(B.x, B.y);
  var vel = vec2<f32>(B.vx, B.vy);
  var moved = false;
  let m = 2.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { B.x = pos.x; B.y = pos.y; B.vx = vel.x; B.vy = vel.y; B.site = -1; bubs[k] = B; }
}`},{name:"bCover",wg:Be,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:w",code:`${ie}
${mn}
${Xi}
${Ia}
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  if (!inBandM(i, j, P.dx)) { cu[U_BAND * n + c] = 0u; return; }
  cu[U_BAND * n + c] = 1u;
  let dx = P.dx;
  let x0 = f32(i) * dx;
  let y0 = f32(j) * dx;
  cf[F_COVL * n + c] = faceCover(vec2<f32>(x0, y0), vec2<f32>(x0, y0 + dx));
  cf[F_COVB * n + c] = faceCover(vec2<f32>(x0, y0), vec2<f32>(x0 + dx, y0));
  if (cu[U_PAINT * n + c] != 0u) {
    /* Ein fester Bau aus „solid“ nimmt keinen Körper auf (seine Energie, sein Film und seine Kruste bleiben). */
    cf[F_FS * n + c] = 0.0; cf[F_CAPB * n + c] = 0.0; cf[F_WSUM * n + c] = 0.0; cf[F_HW * n + c] = 0.0;
    cu[U_OWNER * n + c] = 0u; cu[U_MATB * n + c] = 0u; cu[U_SPLIT * n + c] = 0u; cu[U_HBODY * n + c] = 0u;
    return;
  }
  let invA = 1.0 / (dx * dx);
  var fs = 0.0; var capB = 0.0; var Es = 0.0; var film = 0.0; var crust = 0.0; var wsum = 0.0;
  var best = 0.0; var owner = 0u; var mat = 0u; var split = 0u; var hw = 0.0; var hbest = 0.0; var hgrp = 0u;
  let w0 = vec2<f32>(x0, y0);
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b) || !boxHits(b, i, j, 0.0)) { continue; }
    let l0 = toLocalB(b, w0);
    let l1 = toLocalB(b, w0 + vec2<f32>(dx, 0.0));
    let l2 = toLocalB(b, w0 + vec2<f32>(dx, dx));
    let l3 = toLocalB(b, w0 + vec2<f32>(0.0, dx));
    let lmin = min(min(l0, l1), min(l2, l3));
    let lmax = max(max(l0, l1), max(l2, l3));
    let mb = u32(bv(b, B_MAT)) + 1u;
    let rc = solidRho(mb) * solidCp(mb) * P.depth;
    var acc = 0.0;
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let rq = rectOf(b, r);
      let bx = rBox(rq);
      if (lmin.x > bx.z || lmax.x < bx.x || lmin.y > bx.w || lmax.y < bx.y) { continue; }
      let ni = u32(rv(rq, GR_NI));
      let nj = u32(rv(rq, GR_NJ));
      let ko = u32(rv(rq, GR_KO));
      for (var qq = firstRow(rq, nj, lmin.y); qq < nj; qq++) {
        let ya = rys(rq, qq);
        if (ya > lmax.y) { break; }
        let yb = rys(rq, qq + 1u);
        for (var pp = firstCol(rq, ni, lmin.x); pp < ni; pp++) {
          let xa = rxs(rq, pp);
          if (xa > lmax.x) { break; }
          let A = (rxs(rq, pp + 1u) - xa) * (yb - ya);
          let area = areaIn(b, rq, pp, qq, i, j);
          if (area <= 1e-12 * A) { continue; }
          let k = ko + pp + qq * ni;
          let w = area / A;
          fs += area * invA;
          acc += area * invA;
          capB += w * rc * A;
          Es += w * bcell[BC * k];
          film += w * bcell[BC * k + 1u];
          crust += w * bcell[BC * k + 2u];
          wsum += w;
        }
      }
      if (splitsCellB(b, rq, i, j)) { split = 1u; }
    }
    /* Der Körper mit dem grössten Anteil besitzt die Zelle (bei Gleichstand der erste). */
    if (acc > best) { best = acc; owner = b + 1u; mat = mb; }
    /* Eine Heizplatte: ihr Anteil an der Leistung ihrer Gruppe nach dem Volumen (Heat.bodyHeat): ncell · bedecktes Volumen / Volumen. */
    if (bv(b, B_HEATER) >= 0.0 && acc > hbest) { hbest = acc; hgrp = u32(bv(b, B_HEATER)) + 1u; hw = bv(b, B_NCELL) * acc * P.vcell / max(1e-30, bv(b, B_VOL)); }
  }
  cf[F_FS * n + c] = min(1.0, fs);
  cf[F_CAPB * n + c] = capB;
  cf[F_ES * n + c] = Es;
  cf[F_FILM * n + c] = film;
  cf[F_CRUST * n + c] = crust;
  cf[F_WSUM * n + c] = wsum;
  cf[F_HW * n + c] = hw;
  cf[F_ESY * n + c] = Es;
  cf[F_FSY * n + c] = film;
  cf[F_KSY * n + c] = crust;
  cu[U_OWNER * n + c] = owner;
  cu[U_MATB * n + c] = mat;
  cu[U_SPLIT * n + c] = split;
  cu[U_HBODY * n + c] = hgrp;
}`},{name:"bClose1",wg:Be,bind:"P:u bod:r cf:r cu:w",code:`${Pe}
${ja}
${O1}
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!bandC(c)) { cu[U_NOW1 * n + c] = select(0u, 1u, cu[U_SOLID * n + c] != 0u); return; }
  var closed = now0(c);
  if (!closed && !paintedC(c)) {
    let i = ci(c);
    if (i > 0 && coveredU(c)) { let a = c - 1u; if (!now0(a) && pickPair(a, c) == c) { closed = true; } }
    if (i + 1 < i32(P.nx) && coveredU(c + 1u)) { let b = c + 1u; if (!now0(b) && pickPair(c, b) == c) { closed = true; } }
  }
  cu[U_NOW1 * n + c] = select(0u, 1u, closed);
}`},{name:"bClose2",wg:Be,bind:"P:u cf:r cu:w",code:`${gr}
${ja}
fn closedNow(x: u32) -> bool { return cu[U_NOW1 * P.n + x] != 0u || paintedC(x); }
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (!bandC(c)) { cu[U_NOW2 * n + c] = cu[U_NOW1 * n + c]; return; }
  var closed = cu[U_NOW1 * n + c] != 0u;
  if (!closed && !paintedC(c)) {
    let j = cj(c);
    if (j > 0 && coveredV(c)) { let a = c - P.nx; if (!closedNow(a) && pickPair(a, c) == c) { closed = true; } }
    if (j + 1 < i32(P.ny) && coveredV(c + P.nx)) { let b = c + P.nx; if (!closedNow(b) && pickPair(c, b) == c) { closed = true; } }
  }
  cu[U_NOW2 * n + c] = select(0u, 1u, closed);
}`},{name:"bFlip",wg:Be,bind:"P:u cf:r cu:w at:a cnt:a",code:`${gr}
${q1}
fn freeB(x: u32) -> bool { return cu[U_NOW2 * P.n + x] == 0u && cu[U_PAINT * P.n + x] == 0u; }
/* Die nächste freie Zelle im Fenster 9 × 9 um c, über Flächen, die kein Körper ganz bedeckt, durch alles ausser gemaltem Feststoff (Breitensuche). */
fn nearFree(c: u32) -> u32 {
  let i0 = ci(c) - 4;
  let j0 = cj(c) - 4;
  var seen = array<u32, 3>(0u, 1u << 8u, 0u);
  var queue: array<u32, 81>;
  queue[0] = 40u;
  var head = 0u;
  var tail = 1u;
  loop {
    if (head >= tail) { break; }
    let w = queue[head];
    head += 1u;
    let q = cellOf(i0 + i32(w % 9u), j0 + i32(w / 9u));
    for (var k = 0u; k < 4u; k++) {
      let nb = acrossB(q, k);
      if (nb == NONE) { continue; }
      let a = ci(nb) - i0;
      let bb = cj(nb) - j0;
      if (a < 0 || bb < 0 || a > 8 || bb > 8) { continue; }
      let v = u32(a + 9 * bb);
      let bit = 1u << (v & 31u);
      if ((seen[v >> 5u] & bit) != 0u) { continue; }
      seen[v >> 5u] = seen[v >> 5u] | bit;
      if (cu[U_PAINT * P.n + nb] != 0u) { continue; }
      if (freeB(nb)) { return nb; }
      queue[tail] = v;
      tail += 1u;
    }
  }
  return NONE;
}
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_BAND * n + c] == 0u || cu[U_PAINT * n + c] != 0u) { return; }
  let was = cu[U_SOLID * n + c] != 0u;
  let now = cu[U_NOW2 * n + c] != 0u;
  if (now && !was) {
    if (gasMass(c) <= 0.0 && cf[F_HG * n + c] == 0.0) { return; }
    var wsum = 0.0;
    var cntN = 0u;
    for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { wsum += gasVol(nb); cntN += 1u; } }
    if (cntN > 0u) {
      for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { moveGasB(c, nb, gasVol(nb) / wsum); } }
      return;
    }
    let t = nearFree(c);
    if (t != NONE) { moveGasB(c, t, 1.0); } else { atomicAdd(&cnt[C_PARKED], 1u); }
    return;
  }
  if (!now && was) {
    var liquidNear = false;
    var wsum = 0.0;
    var rho = 0.0;
    for (var k = 0u; k < 4u; k++) {
      let nb = acrossB(c, k);
      if (nb == NONE) { continue; }
      let kn = cu[U_KIND * n + nb];
      if (kn == LIQUID) { liquidNear = true; }
      if (kn != GAS || cu[U_NOW2 * n + nb] != 0u || gasMass(nb) <= 0.0) { continue; }
      let w = gasVol(nb);
      wsum += w;
      rho += w * cf[F_RHO * n + nb];
    }
    var kind = GAS;
    if (wsum <= 0.0) { kind = select(GAS, LIQUID, liquidNear); }
    else {
      let want = (rho / wsum) * max(1e-3, 1.0 - cf[F_FS * n + c] - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
      for (var k = 0u; k < 4u; k++) {
        let nb = acrossB(c, k);
        if (nb == NONE || cu[U_KIND * n + nb] != GAS || cu[U_NOW2 * n + nb] != 0u) { continue; }
        let mnb = gasMass(nb);
        if (mnb <= 0.0) { continue; }
        moveGasB(nb, c, min(0.25, want * (gasVol(nb) / wsum) / mnb));
      }
    }
    cu[U_KNEW * n + c] = kind;
    /* Das Gebiet eines Nachbarn (zuerst eines, der offen bleibt): Gebiete behalten ihre Nummern. */
    var rid = NONE;
    for (var ps = 0u; ps < 2u && rid == NONE; ps++) {
      for (var k = 0u; k < 4u; k++) {
        let nb = acrossB(c, k);
        if (nb == NONE || (ps == 0u && cu[U_NOW2 * n + nb] != 0u)) { continue; }
        let r = cu[U_RID * n + nb];
        if (r != NONE) { rid = r; break; }
      }
    }
    cu[U_SPLIT * n + c] = rid;
  }
}`},{name:"bApply",wg:Be,bind:"P:u cf:w cu:w",code:`${fi}
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_BAND * n + c] == 0u || cu[U_PAINT * n + c] != 0u) { return; }
  let was = cu[U_SOLID * n + c] != 0u;
  let now = cu[U_NOW2 * n + c] != 0u;
  if (now) {
    cu[U_SOLID * n + c] = max(1u, cu[U_MATB * n + c]);
    cu[U_KIND * n + c] = SOLID;
    cu[U_RID * n + c] = NONE;
  } else if (was) {
    cu[U_SOLID * n + c] = 0u;
    cu[U_KIND * n + c] = cu[U_KNEW * n + c];
    cu[U_RID * n + c] = cu[U_SPLIT * n + c];
  }
  if (cf[F_CAPB * n + c] > 0.0) { deriveSolid(c); }
}`},{name:"bStatic",wg:Be,bind:"P:u bod:r cf:w cu:r",code:`${Pe}
${Ia}
fn shareAt(i: i32, j: i32) -> f32 {
  if (i < 0) { return select(1.0, 0.0, P.openL != 0u); }
  if (i >= i32(P.nx)) { return select(1.0, 0.0, P.openR != 0u); }
  if (j < 0) { return select(1.0, 0.0, P.openB != 0u); }
  if (j >= i32(P.ny)) { return select(1.0, 0.0, P.openT != 0u); }
  let c = cellOf(i, j);
  return select(min(1.0, cf[F_FS * P.n + c]), 1.0, cu[U_SOLID * P.n + c] != 0u);
}
${Ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let i = ci(c);
  let j = cj(c);
  if (!inBandM(i, j, 6.0 * P.dx)) { return; }
  let n = P.n;
  let inSolid = cu[U_SOLID * n + c] != 0u;
  let K = array<f32, 3>(1.0 / 6.0, 2.0 / 3.0, 1.0 / 6.0);
  var phis = 1.0;
  if (!inSolid) {
    phis = 0.0;
    for (var b = -1; b <= 1; b++) { for (var a = -1; a <= 1; a++) { phis += K[a + 1] * K[b + 1] * shareAt(i + a, j + b); } }
  }
  cf[F_PHIS * n + c] = phis;
  let dx = P.dx;
  var best = 4.0 * dx;
  let x = (f32(i) + 0.5) * dx;
  let y = (f32(j) + 0.5) * dx;
  if (!inSolid) {
    if (P.openL == 0u) { best = min(best, x); }
    if (P.openR == 0u) { best = min(best, P.boxw - x); }
    if (P.openB == 0u) { best = min(best, y); }
    if (P.openT == 0u) { best = min(best, P.boxh - y); }
  }
  for (var b = -4; b <= 4; b++) {
    let jj = j + b;
    if (jj < 0 || jj >= i32(P.ny)) { continue; }
    for (var a = -4; a <= 4; a++) {
      let ii = i + a;
      if (ii < 0 || ii >= i32(P.nx)) { continue; }
      if ((cu[U_SOLID * n + cellOf(ii, jj)] != 0u) == inSolid) { continue; }
      let ex = max(0.0, abs(f32(a)) - 0.5) * dx;
      let ey = max(0.0, abs(f32(b)) - 0.5) * dx;
      best = min(best, sqrt(ex * ex + ey * ey));
    }
  }
  cf[F_SDF * n + c] = select(best, -best, inSolid);
}`},{name:"bPrepEnd",wg:64,bind:"P:u bod:w",code:`${Pe}
${Ra} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    bod[o + B_OX0] = bod[o + B_BX0]; bod[o + B_OY0] = bod[o + B_BY0]; bod[o + B_OX1] = bod[o + B_BX1]; bod[o + B_OY1] = bod[o + B_BY1];
    if (bAwake(b)) { bod[o + B_RX] = bod[o + B_X]; bod[o + B_RY] = bod[o + B_Y]; bod[o + B_RA] = bod[o + B_A]; }
  }
}`},{name:"bFaceL",wg:Be,bind:"P:u bod:r cu:r ff:w fu:r",code:`${Pe}
${br}
fn wallFace(f: u32) -> bool {
  if (f < P.nu) { let i = f % (P.nx + 1u); return (i == 0u && P.openL == 0u) || (i == P.nx && P.openR == 0u); }
  let j = (f - P.nu) / P.nx;
  return (j == 0u && P.openB == 0u) || (j == P.ny && P.openT == 0u);
}
${Ce} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] != 2u || wallFace(f)) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  ff[ffi(FF_UL, f)] = faceVelB(f, b);
}`},{name:"bFaceG",wg:Be,bind:"P:u bod:r cu:r ff:w fu:r",code:`${Pe}
${br}
${Ce} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_GAS, f)] != 0u) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  /* Die andere Seite: an Flüssigkeit bleibt die Fläche für das Gas still (wie die CPU). */
  var a = NONE;
  var c = NONE;
  if (f < P.nu) { let i = f % (P.nx + 1u); let j = f / (P.nx + 1u); if (i > 0u) { a = i - 1u + j * P.nx; } if (i < P.nx) { c = i + j * P.nx; } }
  else { let g = f - P.nu; let i = g % P.nx; let j = g / P.nx; if (j > 0u) { a = i + (j - 1u) * P.nx; } if (j < P.ny) { c = i + j * P.nx; } }
  if ((a != NONE && cu[U_KIND * P.n + a] == LIQUID) || (c != NONE && cu[U_KIND * P.n + c] == LIQUID)) { return; }
  ff[ffi(FF_UG, f)] = faceVelB(f, b);
}`},{name:"bRegVol",wg:Be,bind:"P:u cf:r cu:r racc:a",code:`${Zi}
${Ce} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) { v.x = (1.0 - cf[F_FS * P.n + c]) * P.vcell; }
  }
  regSum(lid, r, v, vec4<u32>(RA_VSUM, RA_VSUM, RA_VSUM, RA_VSUM));
}`},{name:"bHeaters",wg:256,bind:"P:u bod:r bgeo:r bcell:r hacc:a",code:`${ie}
var<workgroup> rc: array<f32, 256>;
var<workgroup> rt: array<f32, 256>;
fn cellT(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
@compute @workgroup_size(256) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  let lid = lid3.x;
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b) || bv(b, B_HEATER) < 0.0) { continue; }
    let g = u32(bv(b, B_HEATER));
    if (g >= P.nheat) { continue; }
    let mb = u32(bv(b, B_MAT)) + 1u;
    let rcp = solidRho(mb) * solidCp(mb) * P.depth;
    let ko = u32(bv(b, B_KO));
    let nk = u32(bv(b, B_NCELL));
    var sc = 0.0;
    var st = 0.0;
    for (var k = lid; k < nk; k += 256u) {
      let kk = ko + k;
      let rq = u32(bcell[BC * kk + 3u]);
      let loc = kk - u32(rv(rq, GR_KO));
      let ni = u32(rv(rq, GR_NI));
      let p = loc % ni;
      let q = loc / ni;
      let C = rcp * (rxs(rq, p + 1u) - rxs(rq, p)) * (rys(rq, q + 1u) - rys(rq, q));
      sc += C;
      st += C * cellT(bcell[BC * kk], C, bcell[BC * kk + 1u], bcell[BC * kk + 2u]);
    }
    rc[lid] = sc;
    rt[lid] = st;
    workgroupBarrier();
    for (var s = 128u; s > 0u; s >>= 1u) {
      if (lid < s) { rc[lid] += rc[lid + s]; rt[lid] += rt[lid + s]; }
      workgroupBarrier();
    }
    if (lid == 0u && rc[0] > 0.0) {
      addF_hacc(g * HACC_STRIDE + HA_TSUM, rt[0] / rc[0] * f32(nk));
      atomicAdd(&hacc[g * HACC_STRIDE + HA_CELLS], nk);
    }
    workgroupBarrier();
  }
}`}],Na=o=>o.map(K).join(", "),R1=`
const SLOP_F: f32 = 0.1;
const SPEC_F: f32 = 1.0;
const BAUMGARTE: f32 = 0.22;
const BOUNCE_FROM: f32 = 0.6;
const MAX_PUSH: f32 = 2.5;
const CLIP_EPS: f32 = 1e-7;
const ITERATIONS: u32 = 10u;
const WAKE_SPEED: f32 = 0.01;
const SLEEP_SPEED: f32 = 0.002;
const SLEEP_TIME: f32 = 0.5;
const BUOYANT: f32 = 1.02;
const BCON_WT: u32 = ${vr}u;
const WT_W: u32 = ${xr}u;
const BCON_LIVE: u32 = ${yr}u;
const CW: u32 = ${vf}u;
const MAXC: u32 = ${Rs}u;
/* Eine Berührung im Arbeitsspeicher: Kennungen a, b; Teile a, b; Punkte; Normale; Reibung, Rückprall; Block (K und K⁻¹); zwei Punkte zu je 16 Wörtern. */
const CO_IDA: u32 = 0u; const CO_IDB: u32 = 1u; const CO_PA: u32 = 2u; const CO_PB: u32 = 3u; const CO_N: u32 = 4u;
const CO_NX: u32 = 5u; const CO_NY: u32 = 6u; const CO_FR: u32 = 7u; const CO_BO: u32 = 8u; const CO_BLK: u32 = 9u;
const CO_K11: u32 = 10u; const CO_K12: u32 = 11u; const CO_K22: u32 = 12u; const CO_I11: u32 = 13u; const CO_I12: u32 = 14u; const CO_I22: u32 = 15u;
const CO_PT: u32 = 16u;
const PT_X: u32 = 0u; const PT_Y: u32 = 1u; const PT_SEP: u32 = 2u; const PT_ID: u32 = 3u; const PT_JN: u32 = 4u; const PT_JT: u32 = 5u;
const PT_RAX: u32 = 6u; const PT_RAY: u32 = 7u; const PT_RBX: u32 = 8u; const PT_RBY: u32 = 9u; const PT_MN: u32 = 10u; const PT_MT: u32 = 11u;
const PT_BIAS: u32 = 12u; const PT_BOUNCE: u32 = 13u; const PT_FIXED: u32 = 14u; const PT_KICK: u32 = 15u;
const S_FRIC = array<f32, ${dt.length}>(${Na(dt.map(o=>o.friction))});
const S_BOUNCE = array<f32, ${dt.length}>(${Na(dt.map(o=>o.bounce))});
`,I1=`
fn isBodyPart(p: u32) -> bool { return (p & 0x80000000u) != 0u; }
fn partBody(p: u32) -> u32 { return (p >> 12u) & 0x7ffffu; }
fn bodyPart(b: u32, r: u32) -> u32 { return 0x80000000u | (b << 12u) | r; }
fn partBase(s: u32) -> u32 { return u32(bgeo[GH_PARTS]) + s * PS; }
fn partId(p: u32) -> u32 {
  if (isBodyPart(p)) { return 100000u + partBody(p) * 1000u + (p & 0xfffu); }
  return u32(bgeo[partBase(p) + GP_ID]);
}
/* Die vier Ecken (gegen den Uhrzeigersinn ab unten links) und Aussennormalen (unten, rechts, oben, links) eines Kastens in der Welt. */
fn corner(bx: vec4<f32>, i: u32) -> vec2<f32> { return vec2<f32>(select(bx.z, bx.x, i == 0u || i == 3u), select(bx.w, bx.y, i < 2u)); }
fn normalL(i: u32) -> vec2<f32> {
  if (i == 0u) { return vec2<f32>(0.0, -1.0); }
  if (i == 1u) { return vec2<f32>(1.0, 0.0); }
  if (i == 2u) { return vec2<f32>(0.0, 1.0); }
  return vec2<f32>(-1.0, 0.0);
}
fn vert(p: u32, i: u32) -> vec2<f32> {
  if (!isBodyPart(p)) { let o = partBase(p); return corner(vec4<f32>(bgeo[o], bgeo[o + 1u], bgeo[o + 2u], bgeo[o + 3u]), i); }
  let b = partBody(p);
  let l = corner(rBox(rectOf(b, p & 0xfffu)), i);
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
fn nrmW(p: u32, i: u32) -> vec2<f32> {
  let n = normalL(i);
  if (!isBodyPart(p)) { return n; }
  let b = partBody(p);
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * n.x - s * n.y, s * n.x + c * n.y);
}
fn posOf(p: u32) -> vec2<f32> { if (!isBodyPart(p)) { return vec2<f32>(0.0); } let b = partBody(p); return vec2<f32>(bv(b, B_X), bv(b, B_Y)); }
fn velOf(p: u32) -> vec3<f32> { if (!isBodyPart(p)) { return vec3<f32>(0.0); } let b = partBody(p); return vec3<f32>(bv(b, B_VX), bv(b, B_VY), bv(b, B_W)); }
fn invM(p: u32) -> f32 { if (!isBodyPart(p)) { return 0.0; } let b = partBody(p); return select(0.0, 1.0 / bv(b, B_M), bAwake(b)); }
fn invI(p: u32) -> f32 { if (!isBodyPart(p)) { return 0.0; } let b = partBody(p); return select(0.0, 1.0 / bv(b, B_I), bAwake(b)); }
fn fricOf(p: u32) -> f32 { if (!isBodyPart(p)) { return bgeo[partBase(p) + GP_FRIC]; } return S_FRIC[min(u32(bv(partBody(p), B_MAT)), NSOL - 1u)]; }
fn bounceOf(p: u32) -> f32 { if (!isBodyPart(p)) { return bgeo[partBase(p) + GP_BOUNCE]; } return S_BOUNCE[min(u32(bv(partBody(p), B_MAT)), NSOL - 1u)]; }
fn aabb(p: u32) -> vec4<f32> {
  var lo = vec2<f32>(1e30);
  var hi = vec2<f32>(-1e30);
  for (var i = 0u; i < 4u; i++) { let v = vert(p, i); lo = min(lo, v); hi = max(hi, v); }
  return vec4<f32>(lo, hi);
}
`,j1=`
fn gf(i: u32) -> f32 { return bitcast<f32>(bcon[i]); }
fn sf(i: u32, v: f32) { bcon[i] = bitcast<u32>(v); }
fn co(k: u32) -> u32 { return BCON_LIVE + k * CW; }
fn pt(k: u32, i: u32) -> u32 { return co(k) + CO_PT + 16u * i; }
/* Ein Stoss P am Punkt (Hebel ra, rb) auf die Körper der Teile a und b (nur bewegliche ändern sich). */
fn impulse(a: u32, b: u32, P: vec2<f32>, q: u32) {
  let ima = invM(a);
  if (ima > 0.0) {
    let ba = partBody(a) * BS;
    bod[ba + B_VX] -= ima * P.x;
    bod[ba + B_VY] -= ima * P.y;
    bod[ba + B_W] -= invI(a) * (gf(q + PT_RAX) * P.y - gf(q + PT_RAY) * P.x);
  }
  let imb = invM(b);
  if (imb > 0.0) {
    let bb = partBody(b) * BS;
    bod[bb + B_VX] += imb * P.x;
    bod[bb + B_VY] += imb * P.y;
    bod[bb + B_W] += invI(b) * (gf(q + PT_RBX) * P.y - gf(q + PT_RBY) * P.x);
  }
}
/* Die Geschwindigkeit von b relativ zu a am Punkt q. */
fn relVel(a: u32, b: u32, q: u32) -> vec2<f32> {
  let va = velOf(a);
  let vb = velOf(b);
  return vec2<f32>(vb.x - vb.z * gf(q + PT_RBY) - va.x + va.z * gf(q + PT_RAY), vb.y + vb.z * gf(q + PT_RBX) - va.y - va.z * gf(q + PT_RAX));
}
fn targetV(q: u32) -> f32 { let bo = gf(q + PT_BOUNCE); return select(gf(q + PT_BIAS), max(gf(q + PT_BIAS), bo), bo > 0.0); }
`,N1=`
fn maxSep(A: u32, B: u32) -> vec2<f32> {
  var best = -1e30;
  var edge = 0u;
  for (var i = 0u; i < 4u; i++) {
    let n = nrmW(A, i);
    let v = vert(A, i);
    var mn = 1e30;
    for (var j = 0u; j < 4u; j++) { mn = min(mn, dot(vert(B, j) - v, n)); }
    if (mn > best) { best = mn; edge = i; }
  }
  return vec2<f32>(best, f32(edge));
}
fn setPoint(k: u32, at: vec2<f32>, sep: f32, id: u32) {
  let i = bcon[co(k) + CO_N];
  let q = pt(k, i);
  sf(q + PT_X, at.x); sf(q + PT_Y, at.y); sf(q + PT_SEP, sep); bcon[q + PT_ID] = id;
  bcon[co(k) + CO_N] = i + 1u;
}
fn collide(k: u32, a: u32, b: u32, spec: f32) {
  bcon[co(k) + CO_N] = 0u;
  let A = maxSep(a, b);
  if (A.x > spec) { return; }
  let B = maxSep(b, a);
  if (B.x > spec) { return; }
  var refP = a;
  var inc = b;
  var edge = u32(A.y);
  var flip = false;
  if (B.x > 0.98 * A.x + 0.001) { refP = b; inc = a; edge = u32(B.y); flip = true; }
  let i2 = (edge + 1u) % 4u;
  let v1 = vert(refP, edge);
  let v2 = vert(refP, i2);
  let n = nrmW(refP, edge);
  var mn = 1e30;
  var ie = 0u;
  for (var q = 0u; q < 4u; q++) { let d = dot(nrmW(inc, q), n); if (d < mn) { mn = d; ie = q; } }
  let ie2 = (ie + 1u) % 4u;
  var pa = vert(inc, ie);
  var pb = vert(inc, ie2);
  var ida = ie;
  var idb = ie2;
  var tl = length(v2 - v1);
  if (tl == 0.0) { tl = 1.0; }
  let t = (v2 - v1) / tl;
  let lo = dot(t, v1);
  let hi = dot(t, v2);
  for (var side = 0u; side < 2u; side++) {
    let sx = select(1.0, -1.0, side == 0u);
    let off = select(hi, -lo, side == 0u);
    let da = sx * dot(t, pa) - off;
    let db = sx * dot(t, pb) - off;
    if (da > CLIP_EPS && db > CLIP_EPS) { bcon[co(k) + CO_N] = 0u; return; }
    if (da > CLIP_EPS) { let tt = da / (da - db); pa += (pb - pa) * tt; ida = 200u + edge; }
    else if (db > CLIP_EPS) { let tt = da / (da - db); pb = pa + (pb - pa) * tt; idb = 300u + edge; }
  }
  let base = select(0u, 10000u, flip) + edge * 1000u;
  let sa = dot(pa - v1, n);
  let sb = dot(pb - v1, n);
  sf(co(k) + CO_NX, select(n.x, -n.x, flip));
  sf(co(k) + CO_NY, select(n.y, -n.y, flip));
  if (sa <= spec) { setPoint(k, pa - n * sa / 2.0, sa, base + ida); }
  if (sb <= spec) { setPoint(k, pb - n * sb / 2.0, sb, base + idb); }
}
`,D1=`
fn prestep(k: u32, h: f32, slop: f32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let pa = posOf(a);
  let pb = posOf(b);
  let ima = invM(a); let imb = invM(b); let iia = invI(a); let iib = invI(b);
  let cnt = bcon[o + CO_N];
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let p = vec2<f32>(gf(q + PT_X), gf(q + PT_Y));
    let ra = p - pa;
    let rb = p - pb;
    sf(q + PT_RAX, ra.x); sf(q + PT_RAY, ra.y); sf(q + PT_RBX, rb.x); sf(q + PT_RBY, rb.y);
    let rna = ra.x * n.y - ra.y * n.x;
    let rnb = rb.x * n.y - rb.y * n.x;
    let kn = ima + imb + iia * rna * rna + iib * rnb * rnb;
    sf(q + PT_MN, select(0.0, 1.0 / kn, kn > 0.0));
    let rta = ra.x * t.y - ra.y * t.x;
    let rtb = rb.x * t.y - rb.y * t.x;
    let kt = ima + imb + iia * rta * rta + iib * rtb * rtb;
    sf(q + PT_MT, select(0.0, 1.0 / kt, kt > 0.0));
    let sep = gf(q + PT_SEP);
    sf(q + PT_BIAS, select(min(MAX_PUSH, (BAUMGARTE / h) * max(0.0, -sep - slop)), -sep / h, sep > 0.0));
    let vn = dot(relVel(a, b, q), n);
    var bo = 0.0;
    if (vn < -BOUNCE_FROM && (sep <= slop || sep + vn * h < 0.0)) { bo = -gf(o + CO_BO) * vn; }
    sf(q + PT_BOUNCE, bo);
    if (bcon[q + PT_KICK] != 0u || bo > 0.0) { sf(q + PT_JN, 0.0); sf(q + PT_JT, 0.0); }
    bcon[q + PT_KICK] = 0u;
    sf(q + PT_FIXED, 0.0);
  }
  bcon[o + CO_BLK] = 0u;
  if (cnt == 2u) {
    let q1 = pt(k, 0u);
    let q2 = pt(k, 1u);
    let rn1a = gf(q1 + PT_RAX) * n.y - gf(q1 + PT_RAY) * n.x;
    let rn1b = gf(q1 + PT_RBX) * n.y - gf(q1 + PT_RBY) * n.x;
    let rn2a = gf(q2 + PT_RAX) * n.y - gf(q2 + PT_RAY) * n.x;
    let rn2b = gf(q2 + PT_RBX) * n.y - gf(q2 + PT_RBY) * n.x;
    let m = ima + imb;
    let k11 = m + iia * rn1a * rn1a + iib * rn1b * rn1b;
    let k22 = m + iia * rn2a * rn2a + iib * rn2b * rn2b;
    let k12 = m + iia * rn1a * rn2a + iib * rn1b * rn2b;
    sf(o + CO_K11, k11); sf(o + CO_K12, k12); sf(o + CO_K22, k22);
    let det = k11 * k22 - k12 * k12;
    if (k11 * k11 < 1000.0 * det && det > 0.0) {
      bcon[o + CO_BLK] = 1u;
      sf(o + CO_I11, k22 / det); sf(o + CO_I12, -k12 / det); sf(o + CO_I22, k11 / det);
    }
  }
}
fn warm(k: u32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let cnt = bcon[o + CO_N];
  for (var i = 0u; i < cnt; i++) { let q = pt(k, i); impulse(a, b, gf(q + PT_JN) * n + gf(q + PT_JT) * t, q); }
}
fn solveBlock(k: u32, a: u32, b: u32, n: vec2<f32>) {
  let o = co(k);
  let q1 = pt(k, 0u);
  let q2 = pt(k, 1u);
  let a1 = gf(q1 + PT_JN);
  let a2 = gf(q2 + PT_JN);
  let k11 = gf(o + CO_K11); let k12 = gf(o + CO_K12); let k22 = gf(o + CO_K22);
  let b1 = dot(relVel(a, b, q1), n) - targetV(q1) - (k11 * a1 + k12 * a2);
  let b2 = dot(relVel(a, b, q2), n) - targetV(q2) - (k12 * a1 + k22 * a2);
  var x1 = -(gf(o + CO_I11) * b1 + gf(o + CO_I12) * b2);
  var x2 = -(gf(o + CO_I12) * b1 + gf(o + CO_I22) * b2);
  var ok = x1 >= 0.0 && x2 >= 0.0;
  if (!ok) { x1 = -b1 / k11; x2 = 0.0; ok = x1 >= 0.0 && k12 * x1 + b2 >= 0.0; }
  if (!ok) { x1 = 0.0; x2 = -b2 / k22; ok = x2 >= 0.0 && k12 * x2 + b1 >= 0.0; }
  if (!ok) { if (b1 >= 0.0 && b2 >= 0.0) { x1 = 0.0; x2 = 0.0; ok = true; } }
  if (!ok) { return; }
  impulse(a, b, (x1 - a1) * n, q1);
  impulse(a, b, (x2 - a2) * n, q2);
  sf(q1 + PT_JN, x1);
  sf(q2 + PT_JN, x2);
}
fn solveC(k: u32, h: f32, slop: f32) {
  let o = co(k);
  let a = bcon[o + CO_PA];
  let b = bcon[o + CO_PB];
  let n = vec2<f32>(gf(o + CO_NX), gf(o + CO_NY));
  let t = vec2<f32>(n.y, -n.x);
  let cnt = bcon[o + CO_N];
  let fr = gf(o + CO_FR);
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let vt = dot(relVel(a, b, q), t);
    let lim = fr * gf(q + PT_JN);
    let jt = clamp(gf(q + PT_JT) - gf(q + PT_MT) * vt, -lim, lim);
    let d = jt - gf(q + PT_JT);
    sf(q + PT_JT, jt);
    impulse(a, b, d * t, q);
  }
  if (bcon[o + CO_BLK] != 0u) { solveBlock(k, a, b, n); return; }
  let bounce = gf(o + CO_BO);
  for (var i = 0u; i < cnt; i++) {
    let q = pt(k, i);
    let vn = dot(relVel(a, b, q), n);
    let sep = gf(q + PT_SEP);
    if (gf(q + PT_BOUNCE) == 0.0 && bounce >= 0.5 && vn < -BOUNCE_FROM && (sep <= slop || sep + vn * h < 0.0)) { sf(q + PT_BOUNCE, -bounce * vn); }
    let jn = max(gf(q + PT_JN) + gf(q + PT_MN) * (-vn + targetV(q)), gf(q + PT_FIXED));
    let d = jn - gf(q + PT_JN);
    sf(q + PT_JN, jn);
    impulse(a, b, d * n, q);
    if (gf(q + PT_BOUNCE) > 0.0) { sf(q + PT_FIXED, jn); sf(q + PT_BOUNCE, -1.0); bcon[q + PT_KICK] = 1u; }
  }
}
`,U1=`
fn solve3(a00: f32, a01: f32, a02: f32, a11: f32, a12: f32, a22: f32, r: vec3<f32>) -> vec3<f32> {
  let c00 = a11 * a22 - a12 * a12;
  let c01 = a02 * a12 - a01 * a22;
  let c02 = a01 * a12 - a02 * a11;
  let det = a00 * c00 + a01 * c01 + a02 * c02;
  let c11 = a00 * a22 - a02 * a02;
  let c12 = a01 * a02 - a00 * a12;
  let c22 = a00 * a11 - a01 * a01;
  return vec3<f32>(c00 * r.x + c01 * r.y + c02 * r.z, c01 * r.x + c11 * r.y + c12 * r.z, c02 * r.x + c12 * r.y + c22 * r.z) / det;
}
`,V1=[{name:"bDyn",wg:64,bind:"P:u glob:r cnt:a bod:w bgeo:r bcell:r bcon:w<u32>",code:`${ie}
${R1}
${I1}
${j1}
${N1}
${D1}
${U1}
fn speedOf(b: u32) -> f32 { return length(vec2<f32>(bv(b, B_VX), bv(b, B_VY))) + abs(bv(b, B_W)) * bv(b, B_RMAX); }
/* Kein Zuwachs und keine Vorhersage aus früheren Schritten (beim Aufwecken und Einschlafen). */
fn forget(b: u32) {
  let o = b * BS;
  for (var d = 0u; d < 3u; d++) { bod[o + B_PREV + d] = 0.0; bod[o + B_PRED + d] = 0.0; bod[o + B_PNOW + d] = 0.0; bod[o + B_POLD + d] = 0.0; }
}
fn wakeB(b: u32) {
  if (!bFree(b) || bv(b, B_ASLEEP) == 0.0) { return; }
  let o = b * BS;
  bod[o + B_ASLEEP] = 0.0;
  bod[o + B_REST] = 0.0;
  bod[o + B_MAOK] = 0.0;
  forget(b);
}
/* Der Warmstart einer Berührung (Kennungen ia, ib) aus der Tabelle des letzten Schritts (nach Schlüssel geordnet); NONE: keiner. */
fn findWarm(ia: u32, ib: u32) -> u32 {
  var lo = 0;
  var hi = i32(min(bcon[0], MAXC)) - 1;
  loop {
    if (lo > hi) { break; }
    let mid = (lo + hi) / 2;
    let o = BCON_WT + u32(mid) * WT_W;
    let ka = bcon[o];
    let kb = bcon[o + 1u];
    if (ka == ia && kb == ib) { return o; }
    if (ka < ia || (ka == ia && kb < ib)) { lo = mid + 1; } else { hi = mid - 1; }
  }
  return NONE;
}
/* Die Berührungen dieses Schritts: Zahl, Schlüssel (Kennungen a, b), Reihenfolge der Lösung. */
var<private> nlive: u32;
var<private> keys: array<vec2<u32>, ${Rs}>;
var<private> order: array<u32, ${Rs}>;
/* Ein Paar (a vor b in der Reihenfolge der Teile wie bodyContacts.build): berühren sie sich, eine neue Berührung mit dem Warmstart des letzten Schritts. */
fn tryPair(pa: u32, pb: u32, mine: vec4<f32>, other: u32, spec: f32) {
  let bo = aabb(other);
  if (bo.x > mine.z + spec || bo.z < mine.x - spec || bo.y > mine.w + spec || bo.w < mine.y - spec) { return; }
  if (nlive >= MAXC) { atomicAdd(&cnt[C_CONT_FULL], 1u); return; }
  let k = nlive;
  let o = co(k);
  let ia = partId(pa);
  let ib = partId(pb);
  bcon[o + CO_IDA] = ia; bcon[o + CO_IDB] = ib; bcon[o + CO_PA] = pa; bcon[o + CO_PB] = pb;
  sf(o + CO_FR, sqrt(fricOf(pa) * fricOf(pb)));
  sf(o + CO_BO, max(bounceOf(pa), bounceOf(pb)));
  collide(k, pa, pb, spec);
  let cntP = bcon[o + CO_N];
  if (cntP == 0u) { return; }
  /* Warm starten: dieselben Merkmale behalten ihre Stösse; „schon zurückgeprallt“ hängt am Platz des Punkts. */
  let w = findWarm(ia, ib);
  for (var i = 0u; i < 2u; i++) {
    let q = pt(k, i);
    sf(q + PT_JN, 0.0); sf(q + PT_JT, 0.0);
    bcon[q + PT_KICK] = select(0u, bcon[w + 6u + 4u * i], w != NONE);
  }
  if (w != NONE) {
    let oc = min(2u, bcon[w + 2u]);
    for (var i = 0u; i < cntP; i++) {
      let q = pt(k, i);
      for (var j = 0u; j < oc; j++) {
        if (bcon[w + 3u + 4u * j] == bcon[q + PT_ID]) { bcon[q + PT_JN] = bcon[w + 4u + 4u * j]; bcon[q + PT_JT] = bcon[w + 5u + 4u * j]; break; }
      }
    }
  }
  keys[k] = vec2<u32>(ia, ib);
  nlive = k + 1u;
}
@compute @workgroup_size(64) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  if (lid3.x != 0u) { return; }
  let dt = glob[G_DT];
  let slop = SLOP_F * P.dx;
  let spec = SPEC_F * P.dx;
  /* 1. Hebt die Flüssigkeit einen schlafenden Körper stärker, als er wiegt? Dann wacht er auf. */
  for (var b = 0u; b < P.nbody; b++) {
    if (bFree(b) && bv(b, B_ASLEEP) != 0.0 && bv(b, B_FY) > BUOYANT * bv(b, B_M) * P.gy) { wakeB(b); }
  }
  /* 2. Flüssigkeit und Schwerkraft: (M + M_a) ΔV = Δt (m g + F) + M_a (D^{n−1} + P^n − P^{n−1}). */
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    var m6 = array<f32, 6>(bv(b, B_MA), 0.0, 0.0, bv(b, B_MA), 0.0, bv(b, B_IA));
    if (bv(b, B_PROBE) != 0.0 && bv(b, B_MAOK) != 0.0) { for (var d = 0u; d < 6u; d++) { m6[d] = bv(b, B_MA6 + d); } }
    let c0 = bv(b, B_PREV) + bv(b, B_PNOW) - bv(b, B_POLD);
    let c1 = bv(b, B_PREV + 1u) + bv(b, B_PNOW + 1u) - bv(b, B_POLD + 1u);
    let c2 = bv(b, B_PREV + 2u) + bv(b, B_PNOW + 2u) - bv(b, B_POLD + 2u);
    let m = bv(b, B_M);
    let r = vec3<f32>(dt * bv(b, B_FX) + m6[0] * c0 + m6[1] * c1 + m6[2] * c2,
      dt * (bv(b, B_FY) - m * P.gy) + m6[1] * c0 + m6[3] * c1 + m6[4] * c2,
      dt * bv(b, B_TQ) + m6[2] * c0 + m6[4] * c1 + m6[5] * c2);
    let dv = solve3(m + m6[0], m6[1], m6[2], m + m6[3], m6[4], bv(b, B_I) + m6[5], r);
    bod[o + B_VX] += dv.x;
    bod[o + B_VY] += dv.y;
    bod[o + B_W] += dv.z;
    bod[o + B_PREV] = dv.x; bod[o + B_PREV + 1u] = dv.y; bod[o + B_PREV + 2u] = dv.z;
    for (var d = 0u; d < 3u; d++) { bod[o + B_POLD + d] = bod[o + B_PNOW + d]; }
    bod[o + B_VPRE] = bod[o + B_VX]; bod[o + B_VPRE + 1u] = bod[o + B_VY]; bod[o + B_VPRE + 2u] = bod[o + B_W];
  }
  /* 3. Berührungen: Paare (ein waches Teil gegen jedes andere eines anderen Körpers, Umgrenzungen mit dem spekulativen Spalt). */
  for (var b = 0u; b < P.nbody; b++) { bod[b * BS + B_TOUCH] = 0.0; bod[b * BS + B_WAKE] = 0.0; }
  nlive = 0u;
  let nstat = u32(bgeo[GH_NPARTS]);
  for (var A = 0u; A < P.nbody; A++) {
    if (!bAwake(A)) { continue; }
    let nrA = u32(bv(A, B_NR));
    for (var ra = 0u; ra < nrA; ra++) {
      let pA = bodyPart(A, ra);
      let bA = aabb(pA);
      for (var s = 0u; s < nstat; s++) { tryPair(s, pA, bA, s, spec); }
      for (var B = 0u; B < P.nbody; B++) {
        /* Zwei wache Körper: das Paar zählt bei dem mit der kleineren Nummer. */
        if (B == A || bGone(B) || (bAwake(B) && B < A)) { continue; }
        let nrB = u32(bv(B, B_NR));
        for (var rb = 0u; rb < nrB; rb++) {
          let pB = bodyPart(B, rb);
          if (B < A) { tryPair(pB, pA, bA, pB, spec); } else { tryPair(pA, pB, bA, pB, spec); }
        }
      }
    }
  }
  /* Nach Schlüssel geordnet lösen (dieselbe Reihenfolge wie nach einem Schlüsselbild). */
  for (var k = 0u; k < nlive; k++) {
    var at = k;
    loop {
      if (at == 0u) { break; }
      let pk = keys[order[at - 1u]];
      let ck = keys[k];
      if (pk.x < ck.x || (pk.x == ck.x && pk.y < ck.y)) { break; }
      order[at] = order[at - 1u];
      at -= 1u;
    }
    order[at] = k;
  }
  for (var k = 0u; k < nlive; k++) { prestep(order[k], dt, slop); }
  for (var k = 0u; k < nlive; k++) { warm(order[k]); }
  for (var it = 0u; it < ITERATIONS; it++) { for (var k = 0u; k < nlive; k++) { solveC(order[k], dt, slop); } }
  /* Wer berührt wen; wer wird geweckt (ein wacher Körper stösst einen schlafenden schneller als 1 cm/s an). */
  for (var k = 0u; k < nlive; k++) {
    let o = co(order[k]);
    let a = bcon[o + CO_PA];
    let b = bcon[o + CO_PB];
    let ba = select(NONE, partBody(a), isBodyPart(a));
    let bb = select(NONE, partBody(b), isBodyPart(b));
    if (ba != NONE) { bod[ba * BS + B_TOUCH] = 1.0; }
    if (bb != NONE) { bod[bb * BS + B_TOUCH] = 1.0; }
    if (ba != NONE && bb != NONE && (bv(ba, B_ASLEEP) != 0.0) != (bv(bb, B_ASLEEP) != 0.0) && bv(ba, B_PINNED) == 0.0 && bv(bb, B_PINNED) == 0.0) {
      let mover = select(ba, bb, bv(ba, B_ASLEEP) != 0.0);
      let sleeper = select(bb, ba, bv(ba, B_ASLEEP) != 0.0);
      if (speedOf(mover) > WAKE_SPEED) { bod[sleeper * BS + B_WAKE] = 1.0; }
    }
  }
  /* Der Warmstart für den nächsten Schritt (oder ein Schlüsselbild): die Berührungen nach Schlüssel. */
  bcon[0] = nlive;
  for (var k = 0u; k < nlive; k++) {
    let o = co(order[k]);
    let w = BCON_WT + k * WT_W;
    bcon[w] = bcon[o + CO_IDA];
    bcon[w + 1u] = bcon[o + CO_IDB];
    bcon[w + 2u] = bcon[o + CO_N];
    for (var i = 0u; i < 2u; i++) {
      let q = o + CO_PT + 16u * i;
      bcon[w + 3u + 4u * i] = bcon[q + PT_ID];
      bcon[w + 4u + 4u * i] = bcon[q + PT_JN];
      bcon[w + 5u + 4u * i] = bcon[q + PT_JT];
      bcon[w + 6u + 4u * i] = bcon[q + PT_KICK];
    }
  }
  /* 4. Die Vorhersage für die nächste Projektion: der Zuwachs aus Flüssigkeit und Schwerkraft, wenn keine Berührung die Geschwindigkeit änderte. */
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    let hit = abs(bv(b, B_VX) - bv(b, B_VPRE)) + abs(bv(b, B_VY) - bv(b, B_VPRE + 1u)) + abs(bv(b, B_W) - bv(b, B_VPRE + 2u)) * bv(b, B_RMAX) > 1e-9;
    for (var d = 0u; d < 3u; d++) { bod[o + B_PRED + d] = select(bod[o + B_PREV + d], 0.0, hit); }
  }
  for (var b = 0u; b < P.nbody; b++) { if (bv(b, B_WAKE) != 0.0) { wakeB(b); } }
  /* 5. Neue Lagen; durch eine offene Seite hinaus; einschlafen; der schnellste Punkt für Δt. */
  var vmax = 0.0;
  for (var b = 0u; b < P.nbody; b++) {
    if (!bAwake(b)) { continue; }
    let o = b * BS;
    bod[o + B_X] += dt * bod[o + B_VX];
    bod[o + B_Y] += dt * bod[o + B_VY];
    bod[o + B_A] += dt * bod[o + B_W];
    let x = bod[o + B_X];
    let y = bod[o + B_Y];
    if (x < 0.0 || y < 0.0 || x > P.boxw || y > P.boxh) {
      /* Entwichen: mit Energie, Film und Kruste gebucht wie Entwichenes; Eis ist Wasser. */
      var E = 0.0;
      var film = 0.0;
      var crust = 0.0;
      let ko = u32(bv(b, B_KO));
      let nk = u32(bv(b, B_NCELL));
      for (var k = 0u; k < nk; k++) { E += bcell[BC * (ko + k)]; film += bcell[BC * (ko + k) + 1u]; crust += bcell[BC * (ko + k) + 2u]; }
      let m = bv(b, B_M);
      let e0 = bv(b, B_E0);
      addF_cnt(C_ESC_ENERGY, E + e0 * m);
      addF_cnt(C_ESC_WATER, film + select(0.0, m, e0 != 0.0));
      addF_cnt(C_ESC_SALT, crust);
      bod[o + B_GONE] = 1.0;
      bod[o + B_AGAIN] = 1.0;
      bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
      continue;
    }
    if (speedOf(b) < SLEEP_SPEED && bv(b, B_TOUCH) != 0.0) { bod[o + B_REST] += dt; } else { bod[o + B_REST] = 0.0; }
    if (bod[o + B_REST] >= SLEEP_TIME) {
      bod[o + B_ASLEEP] = 1.0;
      bod[o + B_REST] = 0.0;
      bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
      bod[o + B_UX] = 0.0; bod[o + B_UY] = 0.0; bod[o + B_UW] = 0.0;
      forget(b);
      bod[o + B_AGAIN] = 1.0;
      continue;
    }
    vmax = max(vmax, speedOf(b));
  }
  if (vmax > 0.0) { maxU_cnt(C_BVMAX, vmax); }
}`}],Da=64,Ua="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",ln=`
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
`,Ar=`
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
`,G1=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,H1=`
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
`,$1=[{name:"bubNucleate",wg:Da,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${ln}
${Ar}
${Ua} {
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
  /* Mit genauen Anteilen der Körper kann die Wandzelle offen sein (die GPU schliesst dünne Wände anders als die CPU): dort keimt nichts. */
  if (mat == 0u) { return; }
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
}`},{name:"bubAdvance",wg:Da,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${ln}
${Ar}
${G1}
${H1}
${Ua} {
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
  /* Eine hängende Blase, deren Wandzelle nicht (mehr) fest ist (genaue Anteile, bubNucleate), löst sich. */
  if (site >= 0 && cu[U_SOLID * n + sites[u32(site)].cell] == 0u) {
    atomicStore(&sbub[u32(site)], 0u);
    site = -1;
    B.site = -1;
    let vel = velL(B.x, B.y);
    B.ux0 = vel.x; B.uy0 = vel.y; B.vx = vel.x; B.vy = vel.y;
  }
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
}`}],bs=64,Ue="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",W1=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,Va=`
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
`,K1=[{name:"bubTarget",wg:bs,bind:"P:u cnt:a bubs:r btarget:w",code:`${Ue} {
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
}`},{name:"bubMerge",wg:bs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ue} {
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
}`},{name:"bubMergeFinal",wg:bs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${ln}
${Ue} {
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
}`},{name:"bubVent",wg:bs,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${ln}
${Ar}
${Va}
${Ue} {
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
}`},{name:"bubFinish",wg:bs,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${ln}
${Ar}
${W1}
${Va}
${Ue} {
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
${Ue} {
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
}`},{name:"bubCopyBack",wg:bs,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Ue} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:bs,bind:"P:u cnt:a bubs:r at:a",code:`${ln}
${Ue} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Ue} {
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
}`}],mo=128,po="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",z1=`
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
`,Y1=[...["viscJacA","viscJacB"].map(o=>{const[t,e]=o==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:o,wg:mo,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${po} {
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
}`}}),{name:"viscForce",wg:mo,bind:"P:u ff:w fu:r",code:`${po} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:mo,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${po} {
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
}`}],Ga=`const THETA_MIN: f32 = ${Eo.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,Gi=128,xs=128,ce="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",oe=`
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
`,Ha=`
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
`,X1=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,$a=1,Q1=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${ce} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${$a}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${ce} {
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
${ce} {
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
    pargs[0] = max(1u, (total + ${Gi-1}u) / ${Gi}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${ce} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:xs,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${oe}
${X1}
${ce} {
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
}`},{name:"classify",wg:xs,bind:"P:u cf:r cu:w bod:r",code:`${gr}
${ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  if (cu[cui(U_SOLID, c)] != 0u) { cu[cui(U_KIND, c)] = SOLID; return; }
  let f = cf[cfi(F_PHI, c)];
  var liquid = f > 0.0 && f + cf[cfi(F_PHIS, c)] + cf[cfi(F_ALPHA, c)] >= 0.5;
  if (P.bodies != 0u && liquid) {
    let own = cu[cui(U_OWNER, c)];
    if (own != 0u && bod[(own - 1u) * BS + B_PINNED] == 0.0) { liquid = f / max(1e-3, 1.0 - cf[cfi(F_FS, c)]) + cf[cfi(F_ALPHA, c)] >= 0.5; }
  }
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
}`},{name:"p2g",wg:xs,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Ha}
${ce} {
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
}`},{name:"liqAssemble",wg:xs,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Ga}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${ce} {
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
}`},{name:"liqPressure",wg:xs,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${ce} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:xs,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Ga}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${ce} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:xs,bind:"P:u ff:w fu:w",code:`${ce} {
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
}`})),{name:"g2p",wg:Gi,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w bod:r bgeo:r",code:`${Ha}
${oe}
${ie}
${mn}
${Xi}
${Bh}
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
${z1}
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
${ce} {
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
      q.flags = q.flags | ${$a}u;
    } else {
      let mg = 1e-4 * dx;
      /* Ein fliegender Tropfen an einer Wand der Kiste bleibt dort (seine Geschwindigkeit in die Wand fällt weg). */
      if (fly && (nxp < mg || nxp > P.boxw - mg)) { q.vx = 0.0; }
      if (fly && (nyp < mg || nyp > P.boxh - mg)) { q.vy = 0.0; }
      nxp = clamp(nxp, mg, P.boxw - mg);
      nyp = clamp(nyp, mg, P.boxh - mg);
      /* Mit genauen Körpern (P.bodies) entscheidet zuerst ihre Form (liquidMove.ts); das Abstandsfeld nur, wenn keiner getroffen wurde. */
      var bh = PHit(vec2<f32>(nxp, nyp), vec2<f32>(q.vx, q.vy), false);
      if (P.bodies != 0u) { bh = bodyHitP(vec2<f32>(x, y), vec2<f32>(nxp, nyp), vec2<f32>(q.vx, q.vy), fly); }
      if (bh.hit) { nxp = bh.p.x; nyp = bh.p.y; q.vx = bh.v.x; q.vy = bh.v.y; }
      else {
      let xs = nxp;
      let ys = nyp;
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
      /* Der Schub endet vor dem ersten Körper auf seinem Weg (seit 2026-10-25 auf der CPU). */
      if (P.bodies != 0u && (nxp != xs || nyp != ys)) {
        let b2 = bodyHitP(vec2<f32>(xs, ys), vec2<f32>(nxp, nyp), vec2<f32>(q.vx, q.vy), fly);
        if (b2.hit) { nxp = b2.p.x; nyp = b2.p.y; q.vx = b2.v.x; q.vy = b2.v.y; }
      }
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
}`},{name:"heatWeights",wg:Gi,bind:"P:u cnt:a cu:r parts:w",code:`${oe}
${ce} {
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
}`}],Ve=128,Ge="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Wa=`
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
`,Ka=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,za=`
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
`,Z1=[{name:"gasMaxOut",wg:Ve,bind:"P:u cu:r ff:r cnt:a",code:`${oe}
${Ge} {
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
}`},{name:"gasFlux",wg:Ve,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Wa}
${Ka}
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
${Ge} {
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
}`},{name:"gasMove",wg:Ve,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Wa}
${Ka}
${oe}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Ge} {
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
}`},{name:"macFwd",wg:Ve,bind:"P:u glob:r ff:w fu:r",code:`${za}
${Ge} {
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
}`},{name:"macBack",wg:Ve,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${za}
${Ge} {
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
}`},{name:"viscosity",wg:Ve,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Ge} {
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
}`},{name:"gasAssemble",wg:Ve,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Ge} {
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
}`},{name:"gasPressure",wg:Ve,bind:"P:u cf:w cu:r cgv:r",code:`${Ge} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:Ve,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Ge} {
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
}`}],ts=128,es="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ee=`
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
`,_c=`
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
`,J1=`
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
`,tm=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:ts,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Ee}
${es} {
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
}`})),{name:"applyMass",wg:ts,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ee}
${oe}
${_c}
${es} {
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
}`},{name:"diffPrep",wg:ts,bind:"P:u cf:w cu:w reg:r",code:`${es} {
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
}`},{name:"diffAssemble",wg:ts,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${J1}
${es} {
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
}`},{name:"diffFaces",wg:ts,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${es} {
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
}`},{name:"diffOut",wg:ts,bind:"P:u glob:r cnt:a cf:w cu:r ff:r cgv:r",code:`/* Was die Gaszelle g über ihre Seite k aus der Flüssigkeit verdunsten lässt (genau das F, das diffApply bucht; sonst 0). */
fn evapFrom(g: u32, k: u32) -> f32 {
  let n = P.n;
  if (cu[U_KIND * n + g] != GAS || cu[U_EDGE * n + g] == 0u || !(cf[F_MTOT * n + g] > 0.0)) { return 0.0; }
  let G = cf[(F_BG + k) * n + g];
  if (!(G > 0.0)) { return 0.0; }
  return max(0.0, glob[G_DT] * G * (cf[(F_BY + k) * n + g] - cgv[s0(g)]));
}
${es} {
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
  } else if (cu[U_KIND * n + c] == LIQUID) {
    /* Wie phase.ts (Fv): eine flüssige Zelle lässt nie mehr verdunsten, als sie Wasser hat (Σ w m_w). Anders als die CPU: im
       Verhältnis gekürzt, und was andere Seiten in dieselbe Zelle kondensieren, zählt nicht mit (etwas strenger). */
    let acc = cf[F_ACC * n + c];
    if (acc > 0.0) {
      let i = ci(c);
      let j = cj(c);
      var dem = 0.0;
      if (i > 0) { dem += evapFrom(c - 1u, 1u); }
      if (i + 1 < i32(P.nx)) { dem += evapFrom(c + 1u, 0u); }
      if (j > 0) { dem += evapFrom(c - P.nx, 3u); }
      if (j + 1 < i32(P.ny)) { dem += evapFrom(c + P.nx, 2u); }
      if (dem > acc) { sc = acc / dem; atomicAdd(&cnt[C_EVAP_CAP], 1u); }
    }
  }
  cf[F_SCALE * n + c] = sc;
}`},{name:"diffApply",wg:ts,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${oe}
${es} {
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
            /* Gekürzt mit dem Faktor der flüssigen Zelle (diffOut). */
            let Fv = F * cf[F_SCALE * n + nb];
            let hv = hV(cf[F_PTL * n + nb]);
            mV += Fv;
            H += Fv * hv;
            addF_at(A_FM * n + nb, -Fv);
            addF_at(A_FE * n + nb, -Fv * hv);
            prod += Fv;
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
}`},{name:"latentSrc",wg:ts,bind:"P:u glob:r cf:r at:a",code:`${es} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],Ya=[1/6,2/3,1/6];function em(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),c=Uint8Array.from(t.kind),a=new Uint8Array(e),l=new Uint8Array(e),d=new Uint32Array(e),f=new Float64Array(e),u=new Float64Array(e),m=Float32Array.from(t.T),p=o.heat.heaters.map(()=>0),h=new Float64Array(Math.max(1,o.regions.count)),g=o.bodies.list,v=new Uint8Array(e);for(let P=0;P<e;P+=1)t.owner[P]!==0&&t.matB[P]!==0&&(t.solid[P]!==0||t.fs[P]>.5)&&(v[P]=1);const w=(P,y)=>{if(v[P]!==0||v[y]!==0)return;const A=t.owner[P]!==0&&t.matB[P]!==0?t.fs[P]:-1,S=t.owner[y]!==0&&t.matB[y]!==0?t.fs[y]:-1;A<0&&S<0||(v[S>A?y:P]=1)};for(let P=0;P<n;P+=1)for(let y=1;y<s;y+=1)t.au[y+P*(s+1)]<=0&&w(y-1+P*s,y+P*s);for(let P=1;P<n;P+=1)for(let y=0;y<s;y+=1)t.av[y+P*s]<=0&&w(y+(P-1)*s,y+P*s);for(let P=0;P<e;P+=1){if(a[P]=t.solid[P],l[P]=t.kind[P],d[P]=t.role[P]===1&&t.heater[P]>=0?t.heater[P]+1:0,f[P]=t.Es[P],u[P]=t.film[P],v[P]===0)continue;const y=t.owner[P],A=t.solid[P]!==0,S=g[y-1],T=t.matB[P]-1,M=dt[T];if(r[P]=1,!A){const L=o.regions.id[P];L>=0&&(h[L]+=(1-t.fs[P])*t.vCell)}a[P]=T+1,l[P]=pt;const B=t.Ts[P]>0?t.Ts[P]:dc(t.Es[P],t.capB[P],t.film[P],t.crust[P],t.T[P]);f[P]=(M.rho*M.cp*t.vCell+t.crust[P]*ds)*(B-nt)+t.film[P]*Pt(B),m[P]=B,S!==void 0&&S.heater>=0&&S.heater<p.length&&(d[P]=S.heater+1,p[S.heater]+=1)}for(let P=0;P<e;P+=1)r[P]===0&&d[P]>0&&d[P]<=p.length&&(p[d[P]-1]+=1);const b=(P,y)=>P<0?t.openL?0:1:P>=s?t.openR?0:1:y<0?t.openB?0:1:y>=n?t.openT?0:1:a[P+y*s]!==0?1:0,_=new Float32Array(e),F=new Float32Array(e);for(let P=0;P<n;P+=1)for(let y=0;y<s;y+=1){const A=y+P*s;if(a[A]!==0){_[A]=1;continue}let S=0;for(let T=-1;T<=1;T+=1)for(let M=-1;M<=1;M+=1)S+=Ya[M+1]*Ya[T+1]*b(y+M,P+T);_[A]=S}const k=4;for(let P=0;P<n;P+=1)for(let y=0;y<s;y+=1){const A=y+P*s,S=a[A]!==0,T=(y+.5)*i,M=(P+.5)*i;let B=k*i;S||(t.openL||(B=Math.min(B,T)),t.openR||(B=Math.min(B,t.w-T)),t.openB||(B=Math.min(B,M)),t.openT||(B=Math.min(B,t.h-M)));for(let L=-k;L<=k;L+=1){const q=P+L;if(!(q<0||q>=n))for(let R=-k;R<=k;R+=1){const E=y+R;if(E<0||E>=s||a[E+q*s]!==0===S)continue;const I=Math.max(0,Math.abs(R)-.5)*i,j=Math.max(0,Math.abs(L)-.5)*i;B=Math.min(B,Math.hypot(I,j))}}F[A]=S?-B:B}return{body:r,kindCpu:c,solid:a,kind:l,hgrp:d,es:f,film:u,T:m,phiS:_,sdf:F,heaterCells:p,vFix:h}}function sm(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=dt[t.solid[n]-1],r=dc(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],e.crust[n],e.T[n]);e.Es[n]=Mo(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const xn=16,Xa=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;function nm(o){const t=o.grid,e=t.n,s=new Float64Array(e),n=new Float64Array(e),i=new Float64Array(e);for(let r=0;r<e;r+=1){const c=t.mg[at*e+r],a=t.mg[lt*e+r],l=t.mg[Q*e+r];s[r]=c/gt[at]+a/gt[lt]+l/gt[Q],n[r]=c+a+l+t.mfog[r]<=1e-30?18e-6:_l(c,a,l,t.T[r]),i[r]=t.kind[r]===pt||o.gas.vgas[r]<=0?0:s[r]*Dt*t.T[r]/o.regions.pAt(r)}return{nmol:s,mu:n,veos:i}}class im{constructor(t,e){x(this,"stair",null);x(this,"body",!1);x(this,"bodies");x(this,"ctx");x(this,"d");x(this,"plan");x(this,"params");x(this,"glob");x(this,"cnt");x(this,"cf");x(this,"cu");x(this,"at");x(this,"ff");x(this,"fu");x(this,"af");x(this,"partsA");x(this,"partsB");x(this,"ccountA");x(this,"ccountB");x(this,"cstart");x(this,"bsum");x(this,"pkey");x(this,"pslot");x(this,"pargs");x(this,"bubs");x(this,"bubs2");x(this,"bacc");x(this,"btarget");x(this,"sites");x(this,"sbub");x(this,"reg");x(this,"racc");x(this,"heat");x(this,"hacc");x(this,"mgF");x(this,"mgU");x(this,"cgv");x(this,"cgs");x(this,"lab");x(this,"cfl");x(this,"csum");x(this,"cgp");x(this,"meas");x(this,"probe");x(this,"regionMap",new Int32Array(0));x(this,"regionInv",new Int32Array(0));x(this,"measGroups");x(this,"nsites",0);x(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=zh(s.nx,s.ny);const r=(a,l,d=Xa)=>{const f=t.buffer(a,4*Math.max(4,l),d);return this.own.push(f),f};this.params=r("params",Ta,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",gn),this.cnt=r("cnt",Ts),this.cf=r("cf",ro*i.n),this.cu=r("cu",oo*i.n),this.at=r("at",co*i.n),this.ff=r("ff",ao*i.nf),this.fu=r("fu",Sa*i.nf),this.af=r("af",lo*i.nf),this.partsA=r("partsA",Ys*i.pcap),this.partsB=r("partsB",Ys*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,Xa|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Xs*i.bcap),this.bubs2=r("bubs2",Xs*i.bcap),this.bacc=r("bacc",Go*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",ho*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Le*i.nreg),this.racc=r("racc",Do*i.nreg),this.heat=r("heat",Fe*i.nheat),this.hacc=r("hacc",Uo*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",_f),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",wf*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const c=256;this.measGroups=[Math.ceil(i.n/c),Math.ceil(i.pcap/c),Math.ceil(i.bcap/c)],this.meas=r("meas",xn*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64),this.bodies=new wr(t,e)}get staircase(){return this.stair}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat&&this.bodies.fits(t)}destroy(){this.ctx.release(this.own),this.own.length=0,this.bodies.destroy()}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*Ta),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const c=t.gas.amb;r.set([c[0],c[1],c[2],c[4]],28),r.set([t.ambientY[at],t.ambientY[lt],t.ambientY[Q],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let a=0;for(let d=0;d<t.regions.count;d+=1)t.regions.open[d]===0&&(a=1);i[40]=a,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=t.particles.hasOther()?1:0;const l=hd(t.scene.extremes,t.regions.pAmb,Math.abs(t.gy));r.set([l.chf,l.actMax,l.vmax,l.bubCap],44),i.set([this.body?1:0,this.body?this.bodies.nbody:0,this.bodies.layers,0],48),this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(Fe*this.d.nheat);s.forEach((i,r)=>{var a;const c=Fe*r;n[c+Kt.MODE]=i.mode==="thermostat"?1:0,n[c+Kt.POWER]=i.power,n[c+Kt.TARGET]=i.target,n[c+Kt.ON]=i.on?1:0,n[c+Kt.P]=i.P,n[c+Kt.TMEAN]=i.Tmean,n[c+Kt.INTEGRAL]=i.integral,n[c+Kt.CELLS]=e!==null?e[r]??0:((a=this.stair)==null?void 0:a.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*Fe*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n;this.body=No(t),this.bodies.upload(t);const r=this.body?null:em(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r!==null?r.heaterCells:null);const c=t.regions,a=Array.from({length:c.count},(C,D)=>D).sort((C,D)=>c.vFluid[D]-c.vFluid[C]);this.regionMap=new Int32Array(Math.max(1,c.count)),this.regionInv=new Int32Array(Math.max(1,c.count)),a.forEach((C,D)=>{this.regionMap[C]=D,this.regionInv[D]=C});const l=new Float32Array(Le*s.nreg);for(let C=0;C<c.count;C+=1){const D=Le*this.regionMap[C];l[D+Jt.OPEN]=c.open[C],l[D+Jt.VFLUID]=c.vFluid[C]-(r!==null?r.vFix[C]:0),l[D+Jt.P0]=c.p0[C],l[D+Jt.RHOBAR]=c.rhoBar[C],l[D+Jt.VLIQ]=c.vLiq[C],l[D+Jt.VBUB]=c.vBub[C],l[D+Jt.VGAS]=c.vGas[C],l[D+Jt.P0START]=c.p0[C]}e.writeBuffer(this.reg,0,l);const d=new Uint32Array(oo*i);for(let C=0;C<i;C+=1){const D=n.solid[C]!==0&&n.owner[C]===0;r!==null?(d[jt.KIND*i+C]=r.kind[C],d[jt.KPREV*i+C]=r.kind[C],d[jt.SOLID*i+C]=r.solid[C],d[jt.HGRP*i+C]=r.hgrp[C]):(d[jt.KIND*i+C]=n.kind[C],d[jt.KPREV*i+C]=n.kind[C],d[jt.SOLID*i+C]=n.solid[C],d[jt.HGRP*i+C]=D&&n.role[C]===1&&n.heater[C]>=0?n.heater[C]+1:0,d[jt.OWNER*i+C]=n.owner[C],d[jt.MATB*i+C]=n.matB[C],d[jt.PAINT*i+C]=D?1:0);const z=c.id[C];d[jt.RID*i+C]=z<0?uo:this.regionMap[z]}e.writeBuffer(this.cu,0,d);const f=new Float32Array(ro*i),u=(C,D,z=0)=>{for(let mt=0;mt<i;mt+=1)f[C*i+mt]=D[z+mt]};if(u(tt.PHI,n.phi),u(tt.ALPHA,n.alpha),u(tt.ALPHAOLD,n.alpha),u(tt.PL,n.pl),u(tt.PG,n.pg),u(tt.MN,n.mg,at*i),u(tt.MO,n.mg,lt*i),u(tt.MV,n.mg,Q*i),u(tt.MF,n.mfog),u(tt.HG,n.Hg),u(tt.ES,r!==null?r.es:n.Es),u(tt.FILM,r!==null?r.film:n.film),u(tt.T,r!==null?r.T:n.T),u(tt.TL,n.Tl),u(tt.CL,n.Cl),r===null){const C=t.bodies.cover;u(tt.FS,n.fs),u(tt.CAPB,n.capB),u(tt.TSB,n.Ts),u(tt.ESY,C.esSync),u(tt.FSY,C.filmSync),u(tt.KSY,C.crustSync),u(tt.WSUM,C.wsum)}const m=t.gas,p=nm(t);u(tt.VGAS,m.vgas),u(tt.RHO,m.rho),u(tt.NMOL,p.nmol),u(tt.CAP,m.cap),u(tt.MU,p.mu),u(tt.VEOS,p.veos),u(tt.SRCV,m.srcV),u(tt.VEOSMID,p.veos),u(tt.PHIS,r!==null?r.phiS:n.phiS),u(tt.SDF,r!==null?r.sdf:n.sdf),u(tt.PTL,r!==null?r.T:n.T),u(tt.CRUST,n.crust);for(let C=0;C<n.nx;C+=1)f[tt.FLOOR*i+C]=t.salt.floor[C],f[tt.FLOORH*i+C]=t.salt.floorH[C];f.fill(1,tt.AW*i,(tt.AW+1)*i),e.writeBuffer(this.cf,0,f);const h=new Float32Array(co*i);for(let C=0;C<i;C+=1)h[Vo.VOLSRC*i+C]=t.liquid.volSrc[C];e.writeBuffer(this.at,0,h);const g=s.nf,v=new Float32Array(ao*g);for(let C=0;C<s.nu;C+=1)v[He.UL*g+C]=n.ul[C],v[He.UG*g+C]=n.ug[C];for(let C=0;C<s.nv;C+=1)v[He.UL*g+s.nu+C]=n.vl[C],v[He.UG*g+s.nu+C]=n.vg[C];e.writeBuffer(this.ff,0,v),e.writeBuffer(this.fu,0,new Uint32Array(Sa*g));const w=new Float32Array(lo*g);for(let C=0;C<s.nu;C+=1)w[C]=t.liquid.fU[C];for(let C=0;C<s.nv;C+=1)w[s.nu+C]=t.liquid.fV[C];e.writeBuffer(this.af,0,w);const b=t.particles,_=t.liquid,F=new ArrayBuffer(4*Ys*Math.max(1,b.count)),k=new Float32Array(F),P=new Uint32Array(F),y=new Int32Array(F);for(let C=0;C<b.count;C+=1){const D=Ys*C;k.set([b.x[C],b.y[C],b.vx[C],b.vy[C],b.c00[C],b.c01[C],b.c10[C],b.c11[C],b.mass[C],b.h[C],b.T[C],b.rho[C],_.dVp[C]],D),P[D+13]=(b.mat[C]&255)<<8,P[D+14]=b.id[C],y[D+15]=_.bi[C],y[D+16]=_.bj[C];for(let z=0;z<9;z+=1)k[D+17+z]=_.wt[9*C+z];k[D+26]=b.smass[2*C]}b.count>0&&e.writeBuffer(this.partsA,0,F);const A=t.bubbles,S=t.bubbleModel.motionState,T=new ArrayBuffer(4*Xs*Math.max(1,A.count)),M=new Float32Array(T),B=new Uint32Array(T),L=new Int32Array(T);for(let C=0;C<A.count;C+=1){const D=Xs*C,z=C*ft;M.set([A.x[C],A.y[C],A.z[C],A.vx[C],A.vy[C],A.m[z+at],A.m[z+lt],A.m[z+Q],A.H[C],A.age[C]],D),L[D+10]=A.site[C],M.set([A.r[C],A.V[C],A.pb[C],A.pv[C],A.Tb[C],A.dmdt[C],S.ux0[C],S.uy0[C]],D+11),B[D+19]=A.id[C],B[D+20]=1;for(let mt=0;mt<de;mt+=1)M[D+21+mt]=A.force[C*de+mt]}A.count>0&&e.writeBuffer(this.bubs,0,T);const q=t.bubbleModel.cavities;this.nsites=q.count;const R=new ArrayBuffer(4*ho*s.nsites),E=new Uint32Array(R),I=new Float32Array(R),j=n.nx,$=C=>r!==null?r.solid[C]:n.solid[C];for(let C=0;C<q.count;C+=1){const D=ho*C;let z=q.cell[C],mt=q.r[C];const xt=q.body[C]>=0?t.bodies.list[q.body[C]]:void 0;if(xt!==void 0&&xt.free&&(mt=1e-9),z>=0&&$(z)===0){const Y=q.dir[C],N=Y===0?z+1:Y===1?z-1:Y===2?z+j:z-j;N>=0&&N<i&&$(N)!==0?z=N:mt=1e-9}z<0&&(z=0,mt=1e-9),E.set([z,q.fluid[C],q.dir[C],0],D),I.set([mt,q.s[C],q.z[C],0],D+4)}e.writeBuffer(this.sites,0,R);const U=new Uint32Array(s.nsites);for(let C=0;C<q.count;C+=1)U[C]=q.bubble[C];e.writeBuffer(this.sbub,0,U);const J=new Float32Array(gn);J[an.DT]=t.dt,J[an.TIME]=t.time,J[an.RHOREF]=_.rhoRef,e.writeBuffer(this.glob,0,J);const et=new Uint32Array(Ts),bt=new Float32Array(et.buffer);et[V.PCOUNT]=b.count,et[V.PSORT]=b.count,et[V.BCOUNT]=A.count,et[V.NEXTID_B]=Math.max(1,A.nextFree),et[V.NEXTID_P]=Math.max(1,b.nextFree);const rt=t.bubbleModel;et[V.WATCH]=rt.watch>=0?rt.watch:uo,et[V.WATCH_FATE]=rt.watchFate,rt.firstSuperheat!==null&&(bt[V.FIRST_SH]=rt.firstSuperheat+1e3,et[V.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,et),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(Go*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Do*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Uo*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(d=>Math.ceil(d.size/4)*4),n=s.reduce((d,f)=>d+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let c=0;t.forEach((d,f)=>{s[f]>0&&r.copyBufferToBuffer(d.buf,d.offset,i,c,s[f]),c+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const a=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];c=0;for(const d of s)l.push(a.slice(c,c+d)),c+=d;return l}async download(t){const e=this.d,s=e.n,[n,i,r,c,a,l,d,f,u,m]=await this.read([{buf:this.cnt,offset:0,size:4*Ts},{buf:this.glob,offset:0,size:4*gn},{buf:this.cf,offset:0,size:4*ro*s},{buf:this.cu,offset:0,size:4*oo*s},{buf:this.at,offset:0,size:4*co*s},{buf:this.ff,offset:0,size:4*ao*e.nf},{buf:this.af,offset:0,size:4*lo*e.nf},{buf:this.heat,offset:0,size:4*Fe*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Le*e.nreg}]),p=new Uint32Array(n),h=Math.min(e.pcap,p[V.PCOUNT]),g=Math.min(e.bcap,p[V.BCOUNT]),[v,w]=await this.read([{buf:this.partsA,offset:0,size:4*Ys*Math.max(1,h)},{buf:this.bubs,offset:0,size:4*Xs*Math.max(1,g)}]),b=t.grid,_=new Float32Array(r),F=(N,X,O=0)=>{for(let W=0;W<s;W+=1)X[O+W]=_[N*s+W]};F(tt.PHI,b.phi),F(tt.ALPHA,b.alpha),F(tt.PL,b.pl),F(tt.PG,b.pg),F(tt.MN,b.mg,at*s),F(tt.MO,b.mg,lt*s),F(tt.MV,b.mg,Q*s),F(tt.MF,b.mfog),F(tt.HG,b.Hg),F(tt.ES,b.Es),F(tt.FILM,b.film),F(tt.T,b.T),F(tt.TL,b.Tl),F(tt.CL,b.Cl);const k=t.gas;F(tt.VGAS,k.vgas),F(tt.RHO,k.rho),F(tt.NMOL,k.nmol),F(tt.CAP,k.cap),F(tt.MU,k.mu),F(tt.VEOS,k.veos),F(tt.SRCV,k.srcV),F(tt.VEOSMID,k.veosMid),F(tt.CRUST,b.crust);for(let N=0;N<b.nx;N+=1)t.salt.floor[N]=_[tt.FLOOR*s+N],t.salt.floorH[N]=_[tt.FLOORH*s+N];const P=new Uint32Array(c);for(let N=0;N<s;N+=1)b.kind[N]=P[jt.KIND*s+N];const y=new Float32Array(a);for(let N=0;N<s;N+=1)t.liquid.volSrc[N]=y[Vo.VOLSRC*s+N];const A=new Float32Array(l),S=new Float32Array(d),T=e.nf;for(let N=0;N<e.nu;N+=1)b.ul[N]=A[He.UL*T+N],b.ug[N]=A[He.UG*T+N],t.liquid.fU[N]=S[N];for(let N=0;N<e.nv;N+=1)b.vl[N]=A[He.UL*T+e.nu+N],b.vg[N]=A[He.UG*T+e.nu+N],t.liquid.fV[N]=S[e.nu+N];const M=t.particles,B=t.liquid,L=new Float32Array(v),q=new Uint32Array(v),R=new Int32Array(v);let E=0,I=0;for(let N=0;N<h;N+=1){const X=Ys*N;if(q[X+13]&1||!(L[X+8]>0))continue;const O=E;E+=1,M.x[O]=L[X],M.y[O]=L[X+1],M.vx[O]=L[X+2],M.vy[O]=L[X+3],M.c00[O]=L[X+4],M.c01[O]=L[X+5],M.c10[O]=L[X+6],M.c11[O]=L[X+7],M.mass[O]=L[X+8],M.h[O]=L[X+9];const W=L[X+26]>0?L[X+26]:0;M.spc[2*O]=W>0?xi:0,M.spc[2*O+1]=0,M.smass[2*O]=W,M.smass[2*O+1]=0,M.mat[O]=q[X+13]>>>8&255,M.id[O]=q[X+14],M.id[O]>I&&(I=M.id[O]),B.dVp[O]=L[X+12],B.bi[O]=R[X+15],B.bj[O]=R[X+16];for(let G=0;G<9;G+=1)B.wt[9*O+G]=L[X+17+G];M.derive(O)}M.count=E,M.reserveIds(Math.max(p[V.NEXTID_P],I+1)),B.weightsDirty=!0;const j=t.bubbles,$=t.bubbleModel.motionState,U=new Float32Array(w),J=new Uint32Array(w),et=new Int32Array(w);j.count=0;let bt=0;for(let N=0;N<g;N+=1){const X=Xs*N;if(J[X+20]===0)continue;const O=j.count;j.count+=1;const W=O*ft;j.x[O]=U[X],j.y[O]=U[X+1],j.z[O]=U[X+2],j.vx[O]=U[X+3],j.vy[O]=U[X+4];for(let G=0;G<ft;G+=1)j.m[W+G]=0;j.m[W+at]=U[X+5],j.m[W+lt]=U[X+6],j.m[W+Q]=U[X+7],j.H[O]=U[X+8],j.age[O]=U[X+9],j.site[O]=et[X+10],j.r[O]=U[X+11],j.V[O]=U[X+12],j.pb[O]=U[X+13],j.pv[O]=U[X+14],j.Tb[O]=U[X+15],j.dmdt[O]=U[X+16],$.ux0[O]=U[X+17],$.uy0[O]=U[X+18],j.id[O]=J[X+19],j.id[O]>bt&&(bt=j.id[O]);for(let G=0;G<de;G+=1)j.force[O*de+G]=U[X+21+G]}j.reserveIds(Math.max(p[V.NEXTID_B],bt+1));const rt=t.bubbleModel.cavities,C=new Uint32Array(u);for(let N=0;N<rt.count;N+=1)rt.bubble[N]=C[N];const D=new Float32Array(m);for(let N=0;N<t.regions.count;N+=1){const X=Le*this.regionMap[N];t.regions.p0[N]=D[X+Jt.P0],t.regions.rhoBar[N]=D[X+Jt.RHOBAR]}const z=new Float32Array(f);t.heat.heaters.forEach((N,X)=>{const O=Fe*X;N.P=z[O+Kt.P],N.Tmean=z[O+Kt.TMEAN],N.integral=z[O+Kt.INTEGRAL]});const mt=new Float32Array(i);t.dt=mt[an.DT];const xt=t.bubbleModel;if(xt.watch=p[V.WATCH]===uo?-1:p[V.WATCH],!this.body){sm(t,this.stair);return}for(let N=0;N<s;N+=1)P[jt.PAINT*s+N]===0&&(b.solid[N]=P[jt.SOLID*s+N],b.owner[N]=P[jt.OWNER*s+N],b.matB[N]=P[jt.MATB*s+N],b.fs[N]=_[tt.FS*s+N],b.capB[N]=_[tt.CAPB*s+N],b.Ts[N]=_[tt.TSB*s+N]);await this.bodies.download(t,N=>this.read(N));const Y=t.bodies.cover;for(const N of t.bodies.list)N.gone||Y.weigh(N);Y.addAll(),Y.topologyChanged=!0,t.bodies.sync()}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const ss=128,Zt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",rm=5,Qa=30,Za=`
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
`,om=[{name:"heaterSums",wg:ss,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Zt} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Zt} {
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
        let kp = power / ${rm}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${Qa}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${Qa}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:ss,bind:"P:u cnt:a parts:r",code:`${oe}
${Zt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:ss,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Ee}
${oe}
${Zt} {
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
    /* Körper (seit 2026-10-26): die Wärmekapazität der Körperteile capB; eine Zelle mit Fluid und einem Körperstück hat dessen Temperatur in F_TSB. */
    let capB = cf[F_CAPB * n + c];
    var cs = 0.0;
    var kc = 0.0;
    var ks = 0.0;
    var Tsol = T;
    if (s != 0u) {
      if (capB > 0.0) { cs = capB + cf[F_CRUST * n + c] * CP_CRYSTAL + cf[F_FILM * n + c] * cpL(T); }
      else { cs = solidRho(s) * solidCp(s) * P.vcell + cf[F_FILM * n + c] * cpL(T) + cf[F_CRUST * n + c] * CP_CRYSTAL; }
      kc = solidK(s);
    } else if (capB > 0.0) {
      Tsol = cf[F_TSB * n + c];
      cs = capB + cf[F_CRUST * n + c] * CP_CRYSTAL + cf[F_FILM * n + c] * cpL(Tsol);
      ks = solidK(max(1u, cu[U_MATB * n + c]));
    }
    var cg = 0.0;
    if (s == 0u && cf[F_CAP * n + c] > 0.0) { cg = cf[F_CAP * n + c]; }
    let sum = cs + cg + Cl;
    cf[F_CS * n + c] = cs;
    cf[F_CG * n + c] = cg;
    cf[F_C * n + c] = sum;
    cf[F_CL * n + c] = Cl;
    cf[F_DSF * n + c] = 0.0;
    let src = at[A_HSRC * n + c];
    at[A_HSRC * n + c] = 0.0;
    if (sum <= 0.0) { cf[F_TSTAR * n + c] = T; cf[F_K * n + c] = 0.0; cf[F_Q * n + c] = 0.0; }
    else {
      let Ts = (cs * Tsol + cg * T + CTl) / sum;
      cf[F_TSTAR * n + c] = Ts;
      if (Cl > 0.0) { cf[F_TL * n + c] = CTl / Cl; }
      if (s == 0u) {
        if (Cl >= cg) { kc = select(kL(Ts), ((Cl - Co) * kL(Ts) + CKo) / Cl, Co > 0.0); } else { kc = kMix(cf[F_MN * n + c], cf[F_MO * n + c], cf[F_MV * n + c], Ts); }
        /* Ein Körperstück neben Fluid: die Leitfähigkeit nach den Anteilen (parallel), der Unterschied der Teile für den Ausgleich in der Zelle (heat.ts). */
        if (cs > 0.0) {
          let fs = min(1.0, cf[F_FS * n + c]);
          let kf = kc;
          kc = fs * ks + (1.0 - fs) * kf;
          cf[F_KS * n + c] = ks;
          cf[F_KF * n + c] = kf;
          if (cg + Cl > 0.0) { cf[F_DSF * n + c] = Tsol - (cg * T + CTl) / (cg + Cl); }
        }
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
      /* Eine Heizplatte mit genauen Anteilen: ihre Leistung nach dem Volumen ihrer inneren Zellen in der Zelle (bCover: F_HW). */
      let hb = cu[U_HBODY * n + c];
      if (hb != 0u && hb <= P.nheat) {
        let o = (hb - 1u) * HEAT_STRIDE;
        let cells = heat[o + H_CELLS];
        if (cells > 0.0) { let w = heat[o + H_P] * cf[F_HW * n + c] / cells; qc += w; hw += w; }
      }
      cf[F_Q * n + c] = qc;
    }
  }
  let sh = wsum(hw, lid);
  if (lid == 0u && sh != 0.0) { addF_cnt(C_HEATER_E, sh * glob[G_DT]); }
}`},{name:"heatAssemble",wg:ss,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Za}
${Zt} {
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
}`},{name:"heatFlux",wg:ss,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Za}
${fi}
${oe}
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
${Zt} {
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
    let Cs = cf[F_CS * n + c];
    let Cg = cf[F_CG * n + c];
    /* Ein Körperstück neben Fluid gleicht sich mit ihm über ihre Grenzfläche aus (exponentiell, genau erhalten; heat.ts). */
    let dsf = cf[F_DSF * n + c];
    let Cf = Cg + cf[F_CL * n + c];
    if (dsf != 0.0 && Cs > 0.0 && Cf > 0.0) {
      let fs = clamp(cf[F_FS * n + c], 0.001, 0.999);
      let G = P.depth / (0.5 * fs / max(1e-9, cf[F_KS * n + c]) + 0.5 * (1.0 - fs) / max(1e-9, cf[F_KF * n + c]));
      let Cr = Cs * Cf / (Cs + Cf);
      let Q = (1.0 - exp(-glob[G_DT] * G / Cr)) * dsf * Cr;
      cf[F_SHARE * n + c] = share + select(0.0, Q / Cf, cf[F_CL * n + c] > 0.0);
      cf[F_ES * n + c] += share * Cs - Q;
      deriveSolid(c);
      if (Cg > 0.0) { cf[F_HG * n + c] += share * Cg + Q * Cg / Cf; deriveCell(c); }
    } else {
      cf[F_SHARE * n + c] = share;
      if (Cs > 0.0) { cf[F_ES * n + c] += share * Cs; deriveSolid(c); }
      if (Cg > 0.0) { cf[F_HG * n + c] += share * Cg; deriveCell(c); }
    }
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
}`},{name:"heatParts",wg:ss,bind:"P:u cnt:a cf:r parts:w",code:`${Ee}
${Zt} {
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
}`},{name:"heatShare",wg:ss,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${Ee}
${Zt} {
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
}`},{name:"pwParts",wg:ss,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Zt} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Zt} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Zt} {
  if (gid.x != 0u) { return; }
  let dt = glob[G_DT];
  glob[G_TIME] += dt;
  addF_cnt(C_SIMTIME, dt);
  atomicAdd(&cnt[C_STEPS], 1u);
  let um = bitcast<f32>(atomicLoad(&cnt[C_UMAXL]));
  var next = P.dtmax;
  if (um > 0.0) { next = min(P.dtmax, 0.9 * P.dx / um); }
  /* Kein Punkt eines wachen Körpers rückt mehr als eine halbe Zelle je Schritt (bodies.dtLimit). */
  if (P.bodies != 0u) {
    let bvm = bitcast<f32>(atomicLoad(&cnt[C_BVMAX]));
    if (bvm > 0.0) { next = min(next, 0.5 * P.dx / bvm); }
    atomicStore(&cnt[C_BVMAX], 0u);
  }
  glob[G_DT] = next;
  atomicStore(&cnt[C_UMAXL], 0u);
  atomicStore(&cnt[C_MAXOUT], 0u);
}`},{name:"measCells",wg:256,bind:"P:u cf:r cu:r meas:w probe:w",code:`var<workgroup> red: array<f32, ${11*256}>;
${Zt} {
  let c = gid.x;
  let lid = lid3.x;
  if (c == 0u) { probe[31] = 0.0; }
  var v = array<f32, 11>(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
  let n = P.n;
  if (c < n) {
    let k = cu[U_KIND * n + c];
    if (c < P.nx) { v[9] = cf[F_FLOOR * n + c]; v[10] = cf[F_FLOORH * n + c]; }
    /* Mit genauen Anteilen spiegeln die Körperteile der Zellen nur die inneren Zellen der Körper (die zählt bMeas, wie budget.ts); Gas, das in
       einer geschlossenen Körperzelle liegen blieb, zählt hier. */
    let body = P.bodies != 0u && (cu[U_OWNER * n + c] != 0u || cf[F_CAPB * n + c] > 0.0);
    if (!body) { v[8] = cf[F_CRUST * n + c]; }
    if ((k == SOLID || cu[U_SOLID * n + c] != 0u) && !body) { v[0] = cf[F_ES * n + c]; v[1] = cf[F_FILM * n + c]; }
    else if (k == SOLID || cu[U_SOLID * n + c] != 0u) {
      v[2] = cf[F_HG * n + c];
      v[3] = cf[F_MV * n + c];
      v[4] = cf[F_MF * n + c];
      v[5] = cf[F_MN * n + c] + cf[F_MO * n + c];
    } else {
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
  if (lid < 11u) { meas[wid3.x * ${xn}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${Zt} {
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${xn}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Zt} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${xn}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Zt} {
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
}`}],Js=256,cm=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:Js,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Qi}
${Lt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Js,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Qi}
${Lt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Js,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Fa}
${Qi}
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
}`},{name:"mgPost",wg:Js,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${ai}
${We}
const TILE: u32 = 16u;
const HALO: u32 = ${Gt}u;
const TS: u32 = ${16+2*Gt}u;
var<workgroup> sx: array<f32, ${(16+2*Gt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Gt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Gt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Gt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Gt)**2}>;
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
  for (var k = 0u; k < ${Gt}u; k++) {
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
}`},{name:"mgPreR",wg:Js,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${ai}
${We}
const TILE: u32 = 12u;
const HALO: u32 = ${Gt+2}u;
const TS: u32 = ${12+2*(Gt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Gt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Gt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Gt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Gt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Gt+2))**2}>;
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
  for (var k = 0u; k < ${Gt}u; k++) {
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
}`},{name:"mgTail",wg:Js,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Fa}
${We}
var<workgroup> tx: array<f32, ${on}>;
var<workgroup> tb: array<f32, ${on}>;
var<workgroup> tax: array<f32, ${on}>;
var<workgroup> tay: array<f32, ${on}>;
var<workgroup> tinv: array<f32, ${on}>;
var<workgroup> toff: array<u32, ${pn}>;
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
  for (var k = 0u; k < ${_a}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${_a}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],vs=128,ys="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",am=[{name:"flashTs",wg:vs,bind:"P:u cf:w cu:r reg:r",code:`${ys} {
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
}`},{name:"flashVap",wg:vs,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Ee}
${ys} {
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
}`},{name:"flashParts",wg:vs,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ee}
${oe}
${_c}
${ys} {
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
}`},{name:"flashDist",wg:vs,bind:"P:u cnt:a cf:r cu:r at:a",code:`${oe}
${ys} {
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
}`},{name:"fog",wg:vs,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${fi}
${oe}
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
${ys} {
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
}`},{name:"spawnWater",wg:vs,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ys} {
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
}`},{name:"films",wg:vs,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${ys} {
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
}`}],go=128,bo="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",lm=`
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
`,fm=`
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
`,um=[{name:"saltCryst",wg:go,bind:"P:u cnt:a cu:r at:a parts:w",code:`${Ee}
${oe}
${_c}
${bo} {
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
}`},{name:"saltSums",wg:go,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${Ee}
${bo} {
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
}`},{name:"saltShare",wg:go,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${Ee}
${lm}
${fm}
${bo} {
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
}`}],Nr=`
const VIR = array<vec3<f32>, ${Si.length}>(${Si.map(o=>`vec3<f32>(${K(o[0]/255)}, ${K(o[1]/255)}, ${K(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${K(Si.length-1)};
  let i = min(u32(floor(x)), ${Si.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Ji="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var dl;const Rf=`
const SOLID_RGB = array<vec3<f32>, ${dt.length}>(${dt.map(o=>{const t=ii(o.color);return`vec3<f32>(${K(t[0]/255)}, ${K(t[1]/255)}, ${K(t[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${ii(((dl=Er[0])==null?void 0:dl.color)??"#f4f3ee").map(o=>K(o/255)).join(", ")});
`,Ja=128,tl="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>)",kr=8,Ko=16,dm=[{name:"rBodies",wg:Ja,bind:"P:u RO:u<ROpt> bod:r bgeo:r bcell:r bq:w be:w",code:`${Ji}
${Nr}
${Rf}
${ie}
/* Temperatur einer inneren Zelle aus Energie, Wärmekapazität, Film und Kruste (wie bMeas). */
fn cellTemp(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn toWorld(b: u32, l: vec2<f32>) -> vec2<f32> {
  let a = bv(b, B_A);
  let c = cos(a);
  let s = sin(a);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
${tl} {
  let t = gid.x;
  let ncell = u32(bgeo[GH_NCELL]);
  let nrect = u32(bgeo[GH_NRECT]);
  if (t < ncell) {
    let o = ${kr}u * t;
    let rq = u32(bcell[BC * t + 3u]);
    let b = u32(rv(rq, GR_BODY));
    for (var k = 0u; k < ${kr}u; k++) { bq[o + k] = 0.0; }
    if (!bGone(b)) {
      let loc = t - u32(rv(rq, GR_KO));
      let ni = u32(rv(rq, GR_NI));
      let p = loc % ni;
      let q = loc / ni;
      let x0 = rxs(rq, p);
      let x1 = rxs(rq, p + 1u);
      let y0 = rys(rq, q);
      let y1 = rys(rq, q + 1u);
      let w = toWorld(b, vec2<f32>(0.5 * (x0 + x1), 0.5 * (y0 + y1)));
      bq[o] = w.x; bq[o + 1u] = w.y; bq[o + 2u] = 0.5 * (x1 - x0); bq[o + 3u] = 0.5 * (y1 - y0); bq[o + 4u] = bv(b, B_A);
      let mb = u32(bv(b, B_MAT)) + 1u;
      let C = solidRho(mb) * solidCp(mb) * P.depth * (x1 - x0) * (y1 - y0);
      let crust = bcell[BC * t + 2u];
      let T = cellTemp(bcell[BC * t], C, bcell[BC * t + 1u], crust);
      var rgb = vec3<f32>(0.353);
      if (RO.overlay == 1u) { rgb = viridis((T - T0 - ${K(se[0])}) / ${K(se[1]-se[0])}); }
      else if (RO.overlay != 6u) {
        let base = SOLID_RGB[min(mb, ${dt.length}u) - 1u];
        let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
        rgb = vec3<f32>(base.x + (0.902 - base.x) * glow, base.y * (1.0 - 0.6 * glow), base.z * (1.0 - 0.8 * glow));
        let size = max(1e-6, min(x1 - x0, y1 - y0));
        if (crust > 0.0) { rgb = mix(rgb, CRYSTAL_RGB, min(1.0, sqrt(crust / (${K(cc)} * size * P.depth) / size))); }
      }
      bq[o + 5u] = rgb.x; bq[o + 6u] = rgb.y; bq[o + 7u] = rgb.z;
    }
  }
  if (t < nrect) {
    let o = ${Ko}u * t;
    let b = u32(rv(t, GR_BODY));
    for (var k = 0u; k < ${Ko}u; k++) { be[o + k] = 0.0; }
    if (!bGone(b)) {
      let bx = rBox(t);
      let p0 = toWorld(b, bx.xy);
      let p1 = toWorld(b, vec2<f32>(bx.z, bx.y));
      let p2 = toWorld(b, bx.zw);
      let p3 = toWorld(b, vec2<f32>(bx.x, bx.w));
      be[o] = p0.x; be[o + 1u] = p0.y; be[o + 2u] = p1.x; be[o + 3u] = p1.y;
      be[o + 4u] = p1.x; be[o + 5u] = p1.y; be[o + 6u] = p2.x; be[o + 7u] = p2.y;
      be[o + 8u] = p2.x; be[o + 9u] = p2.y; be[o + 10u] = p3.x; be[o + 11u] = p3.y;
      be[o + 12u] = p3.x; be[o + 13u] = p3.y; be[o + 14u] = p0.x; be[o + 15u] = p0.y;
    }
  }
}`},{name:"rLiqUnder",wg:Ja,bind:"P:u bod:r bgeo:r src:r dst:w",code:`${ie}
fn inBodies(x: f32, y: f32) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    /* Die Umgrenzung stammt vom Anfang des Schritts: eine Zelle Rand für die Bewegung seither. */
    if (x < bv(b, B_BX0) - P.dx || x > bv(b, B_BX1) + P.dx || y < bv(b, B_BY0) - P.dx || y > bv(b, B_BY1) + P.dx) { continue; }
    let a = bv(b, B_A);
    let c = cos(a);
    let s = sin(a);
    let dx = x - bv(b, B_X);
    let dy = y - bv(b, B_Y);
    let l = vec2<f32>(c * dx + s * dy, -s * dx + c * dy);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      if (l.x >= bx.x && l.x <= bx.z && l.y >= bx.y && l.y <= bx.w) { return true; }
    }
  }
  return false;
}
${tl} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  for (var k = 0u; k < 4u; k++) { dst[4u * t + k] = src[4u * t + k]; }
  let I = t % lx;
  let J = t / lx;
  let h = 0.5 * P.dx;
  if (!inBodies((f32(I) + 0.5) * h, (f32(J) + 0.5) * h)) { return; }
  var best = t;
  var bw = src[4u * t];
  if (I > 0u && src[4u * (t - 1u)] > bw) { best = t - 1u; bw = src[4u * best]; }
  if (I + 1u < lx && src[4u * (t + 1u)] > bw) { best = t + 1u; bw = src[4u * best]; }
  if (J > 0u && src[4u * (t - lx)] > bw) { best = t - lx; bw = src[4u * best]; }
  if (J + 1u < ly && src[4u * (t + lx)] > bw) { best = t + lx; bw = src[4u * best]; }
  if (best != t) { for (var k = 0u; k < 4u; k++) { dst[4u * t + k] = src[4u * best + k]; } }
}`}],hm=`
@group(0) @binding(1) var<storage, read> bq: array<f32>;
struct BO { @builtin(position) pos: vec4<f32>, @location(0) rgb: vec3<f32> }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) q: u32) -> BO {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let o = ${kr}u * q;
  let l = corner * vec2<f32>(bq[o + 2u], bq[o + 3u]);
  let c = cos(bq[o + 4u]);
  let s = sin(bq[o + 4u]);
  var r: BO;
  r.pos = toClip(vec2<f32>(bq[o], bq[o + 1u]) + vec2<f32>(c * l.x - s * l.y, s * l.x + c * l.y));
  r.rgb = vec3<f32>(bq[o + 5u], bq[o + 6u], bq[o + 7u]);
  return r;
}
@fragment fn fs(i: BO) -> @location(0) vec4<f32> { return vec4<f32>(i.rgb, 1.0); }
`,tn=128,en="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",mm=.006,pm={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},gm=4*1e3*15e-7/(3*2*.07),bm=[{name:"rScale",wg:tn,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Ji}
var<workgroup> m4: array<vec4<f32>, WG>;
${en} {
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
}`},{name:"rCells",wg:tn,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Ji}
${Nr}
${Rf}
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${K(cc)} * P.dx * P.depth) / P.dx)); }
${en} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${K(se[0])};
  let tspan = ${K(se[1]-se[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  /* Mit genauen Anteilen zeichnet sich ein Körper selbst (renderBodies.ts): seine geschlossenen Zellen bleiben leer (wie layers.ts). */
  let ownBody = k == SOLID && P.bodies != 0u && cu[U_OWNER * n + c] != 0u;
  if (ownBody) { cell = vec4<f32>(0.0); }
  else if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${dt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${K(gm)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:tn,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${en} {
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
}`},{name:"rLiqBlurX",wg:tn,bind:"P:u lq:r lq2:w",code:`${en} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:tn,bind:"P:u lq2:r liquid:t",code:`${en} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${K(se[0])}) / ${K(se[1]-se[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${K(hc)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:tn,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Ji}
${en} {
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
}`},...dm],Ln=`
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
`;var hl;const xo=`${Ln}
${Nr}
const OIL_RGB = vec3<f32>(${ii(((hl=re[1])==null?void 0:hl.color)??"#e3b437").map(o=>K(o)).join(", ")});
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
`,xm=`${Ln}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,vm=`${Ln}
${(yc.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${V.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,ym=`${Ln}
${Nr}
${(yc.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${V.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${K(273.15+se[0])}) / ${K(se[1]-se[0])}, 0.0, 1.0);
  if (R.tint > 1.5) { o.t = clamp(parts[p].s / max(1e-30, parts[p].mass) / ${K(hc)}, 0.0, 1.0); }
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,wm=`${Ln}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,el=48,vo=256,_m=12;class Fm{constructor(t,e){x(this,"gpu");x(this,"device");x(this,"context");x(this,"format");x(this,"rp");x(this,"ro");x(this,"sampLin");x(this,"sampNear");x(this,"pipes",{});x(this,"layouts",{});x(this,"size","");x(this,"cellsTex");x(this,"fieldTex");x(this,"liquidTex");x(this,"lq");x(this,"lq2");x(this,"arrows");x(this,"bq");x(this,"be");x(this,"nArrows",0);x(this,"groups",new Map);x(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});x(this,"water",[.24,.56,.85]);x(this,"waterInk",[1,1,1]);x(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",vo*_m,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=p=>t.createBindGroupLayout({entries:p});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(p,h,g,v,w=[])=>{const b=t.createShaderModule({code:p}),F=(await b.getCompilationInfo()).messages.filter(k=>k.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(k=>`${k.lineNum}:${k.linePos} ${k.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[g]}),vertex:{module:b,entryPoint:"vs",buffers:w},fragment:{module:b,entryPoint:h,targets:[{format:this.format,blend:e}]},primitive:{topology:v}})},[r,c,a,l,d,f,u,m]=await Promise.all([i(xo,"fsCells",this.layouts.quad,"triangle-strip"),i(xo,"fsField",this.layouts.quad,"triangle-strip"),i(xo,"fsLiquid",this.layouts.quad,"triangle-strip"),i(xm,"fs",this.layouts.rect,"triangle-strip"),i(vm,"fs",this.layouts.store,"triangle-strip"),i(ym,"fs",this.layouts.store,"triangle-strip"),i(wm,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}]),i(`${Ln}${hm}`,"fs",this.layouts.store,"triangle-strip")]);this.pipes={cells:r,field:c,liquid:a,rect:l,disc:d,point:f,line:u,bquad:m}}ensure(){var f,u,m,p,h,g,v,w;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(b,_)=>s.createTexture({size:[b,_],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(u=this.fieldTex)==null||u.destroy(),(m=this.liquidTex)==null||m.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(p=this.lq)==null||p.destroy(),(h=this.lq2)==null||h.destroy(),(g=this.arrows)==null||g.destroy(),this.lq=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(mm/this.gpu.cpu.grid.dx)),c=r>>1,a=Math.max(1,Math.ceil((t.d.nx-c)/r)),l=Math.max(1,Math.ceil((t.d.ny-c)/r));this.nArrows=a*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,a,l]),(v=this.bq)==null||v.destroy(),(w=this.be)==null||w.destroy();const d=t.bodies;this.bq=s.createBuffer({size:4*kr*d.capCells,usage:GPUBufferUsage.STORAGE}),this.be=s.createBuffer({size:4*Ko*Math.max(4,Math.ceil(d.capGeo/$n)),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX})}computeGroup(t,e,s=t){let n=this.groups.get(s);if(n===void 0){const i=this.gpu.state;n=this.gpu.ctx.bind(t,{P:i.params,RO:this.ro,cf:i.cf,cu:i.cu,ff:i.ff,reg:i.reg,cnt:i.cnt,parts:i.partsA,ccount:i.ccountB,cstart:i.cstart,bsum:i.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,bod:i.bodies.bod,bgeo:i.bodies.bgeo,bcell:i.bodies.bcell,bq:this.bq,be:this.be,...e}),this.groups.set(s,n)}return n}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:vo*s,size:4*el}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,c){this.ensure();const a=this.gpu.state,l=this.gpu.ctx,d=this.device.queue;this.roData[0]=pm[r],d.writeBuffer(this.ro,0,this.roData),t.clearBuffer(a.cnt,4*V.OV_PMAX,16);const f=t.beginComputePass(),u=a.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),u),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),u);const m=a.bodies,p=a.body&&m.ncell>0;if(!c){if(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*u),p)for(let F=0;F<2;F+=1)l.dispatch(f,"rLiqUnder",this.computeGroup("rLiqUnder",{src:this.lq,dst:this.lq2},"rLiqUnderA"),4*u),l.dispatch(f,"rLiqUnder",this.computeGroup("rLiqUnder",{src:this.lq2,dst:this.lq},"rLiqUnderB"),4*u);l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*u),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*u)}r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),p&&l.dispatch(f,"rBodies",this.computeGroup("rBodies",{}),Math.max(m.ncell,m.nrect)),f.end();const h=this.gpu.cpu.grid,g=(F,k,P)=>{const y=new Float32Array(el),A=new Uint32Array(y.buffer);y.set([e.x0,e.y0,e.x1,e.y1,h.w,h.h,s,n],0),y.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),y.set(k,24),y.set(P,28),y[32]=r==="temperature"?1:r==="salt"?2:0,y[33]=Math.max(1.5,.5*h.dx*s/(e.x1-e.x0)),A[34]=a.d.bcap,A[35]=a.d.pcap,d.writeBuffer(this.rp,vo*F,y)},v=.003;g(0,[0,0,h.w,h.h],[...this.theme.ground,1]),g(1,[0,0,0,0],[0,0,0,0]),g(2,[0,0,0,0],[...this.theme.ink,.85]),g(3,[0,0,0,0],[...this.waterInk,.9]);const w=[];i.left&&w.push([-v,-v,0,h.h+(i.top?v:0)]),i.right&&w.push([h.w,-v,h.w+v,h.h+(i.top?v:0)]),i.bottom&&w.push([-v,-v,h.w+v,0]),i.top&&w.push([-v,h.h,h.w+v,h.h+v]),w.forEach((F,k)=>g(4+k,F,[...this.theme.wall,1])),p&&g(8,[0,0,0,0],[...this.theme.wall,.8]);const b=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),_=this.pipes;b.setPipeline(_.rect),b.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),b.draw(4),c?(b.setPipeline(_.point),b.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:a.partsA})),b.draw(4,a.d.pcap)):(b.setPipeline(_.liquid),b.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),b.draw(4)),b.setPipeline(_.disc),b.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:a.bubs})),b.draw(4,a.d.bcap),b.setPipeline(_.field),b.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),b.draw(4),b.setPipeline(_.cells),b.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),b.draw(4),p&&(b.setPipeline(_.bquad),b.setBindGroup(0,this.drawGroup("d-bodies",this.layouts.store,1,{store:this.bq})),b.draw(4,m.ncell),b.setPipeline(_.line),b.setVertexBuffer(0,this.be),b.setBindGroup(0,this.drawGroup("d-edges",this.layouts.rect,8,{})),b.draw(8*m.nrect)),r==="velocity"&&(b.setPipeline(_.line),b.setVertexBuffer(0,this.arrows),b.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),b.draw(6*this.nArrows),b.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),b.draw(6*this.nArrows,1,6*this.nArrows)),b.setPipeline(_.rect),w.forEach((F,k)=>{b.setBindGroup(0,this.drawGroup(`d-wall${k}`,this.layouts.rect,4+k,{})),b.draw(4)}),b.end()}reset(){this.size="",this.groups.clear()}}const Pm=[...jh,...cm,...Q1,...Y1,...L1,...Z1,...$1,...K1,...tm,...am,...um,...om,...bm,...E1,...C1,...V1],sl=[["heater",V.HEATER_E,"f"],["lossWalls",V.LOSS_WALLS,"f"],["lossOpen",V.LOSS_OPEN,"f"],["escapedEnergy",V.ESC_ENERGY,"f"],["escapedWater",V.ESC_WATER,"f"],["escapedAir",V.ESC_AIR,"f"],["escapedOther",V.ESC_OTHER,"f"],["escapedSalt",V.ESC_SALT,"f"],["crystallized",V.CRYST,"f"],["produced",V.PRODUCED,"f"],["condensed",V.CONDENSED,"f"],["dew",V.DEW,"f"],["fogMade",V.FOGMADE,"f"],["burstVapour",V.BURSTVAP,"f"],["fluxSL",V.FLUX_SL,"f"],["fluxLG",V.FLUX_LG,"f"],["fluxSG",V.FLUX_SG,"f"],["lossSolids",V.LOSS_SOLIDS,"f"],["nucleated",V.NUCLEATED,"u"],["departed",V.DEPARTED,"u"],["merged",V.MERGED,"u"],["burst",V.BURST,"u"],["collapsed",V.COLLAPSED,"u"],["burstCold",V.BURST_COLD,"u"],["burstWarm",V.BURST_WARM,"u"],["collapsedCold",V.COLL_COLD,"u"],["collapsedWarm",V.COLL_WARM,"u"],["releasedGas",V.REL_MASS,"f"],["releases",V.REL_N,"u"],["releaseMisses",V.REL_MISS,"u"],["evapCapped",V.EVAP_CAP,"u"],["bodyWork",V.BODYWORK,"f"],["parked",V.PARKED,"u"],["contFull",V.CONT_FULL,"u"]],nl=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0,releasedGas:0,releases:0,releaseMisses:0,evapCapped:0,bodyWork:0,parked:0,contFull:0}),Am=24,yo=256,sn=2*Ss;class Kn{constructor(t,e){x(this,"ctx");x(this,"cpu");x(this,"state");x(this,"solver");x(this,"bstep");x(this,"sub");x(this,"groups",new Map);x(this,"stateVersion",0);x(this,"itL",16);x(this,"itG",18);x(this,"itH",8);x(this,"itD",6);x(this,"nsub",0);x(this,"totals",nl());x(this,"last",null);x(this,"stepped",null);x(this,"energy0",null);x(this,"water0",null);x(this,"other0",null);x(this,"salt0",null);x(this,"carry",null);x(this,"sealed",!1);x(this,"salty",!1);x(this,"mixed",!1);x(this,"staging",[]);x(this,"busy",new Set);x(this,"reading",new Map);x(this,"querySet");x(this,"queryBuf");x(this,"vapourMark",0);x(this,"vapourLast",0);x(this,"vapourRate",0);x(this,"stageMs",new Array(Ss).fill(0));x(this,"hooks",{cells:(t,e,s)=>this.cells(t,e,s??""),faces:(t,e)=>this.faces(t,e),parts:(t,e)=>this.parts(t,e,"A"),bubs:(t,e)=>this.bubs(t,e),one:(t,e)=>this.one(t,e),run:(t,e,s,n,i)=>{const r=`${e}|run|${n}`;let c=this.groups.get(r);c===void 0&&(c=this.ctx.bind(e,{...this.resources("A"),...i}),this.groups.set(r,c)),this.ctx.dispatch(t,e,c,s)}});this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:sn}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*sn,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){return Kn.on(await Kn.prepare(),t)}static async prepare(t=[]){const e=await wc.create(),s=await e.compile([...Pm,...t]);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return e}static on(t,e){return new Kn(t,e)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.bstep!==void 0&&this.bstep.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new im(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Yh(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp}),this.bstep=new Qh(e,this.solver);const s=new Uint32Array(yo/4*16);for(let n=0;n<16;n+=1)s[yo/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}const t=this.state.body;this.state.upload(this.cpu),this.state.body!==t&&this.carryErrors({energy:this.cpu.energyError(),water:this.cpu.waterError(),other:this.cpu.otherError(),salt:this.cpu.saltError()}),this.bstep.writeSel(),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let n=0;n<this.cpu.regions.count;n+=1)this.cpu.regions.open[n]===0&&(this.sealed=!0);const e=this.ctx.device.createCommandEncoder(),s=e.beginComputePass();this.sort(s,1),this.sort(s,2),s.end(),this.ctx.device.queue.submit([e.finish()])}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,s.escapedOther=e.escapedOther,s.escapedSalt=e.escapedSalt,t.salt.crystallized=e.crystallized,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,s.bodyWork=e.bodyWork,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*V.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*V.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0,bod:e.bodies.bod,bgeo:e.bodies.bgeo,bcell:e.bodies.bcell,bcon:e.bodies.bcon,bat:e.bodies.bat,bread:e.bodies.bread};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:yo*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,sn,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu,n=this.state.body;let i;if(n&&(i=this.pass(t,e,0),this.bstep.prepare(i,this.hooks),i.end()),i=this.pass(t,e,1),this.sort(i,1),this.mixed&&this.cells(i,"cellHost","B"),this.cells(i,"splat","B"),this.cells(i,"classify"),this.cells(i,"transitions"),this.cells(i,"gasApply"),this.cells(i,"regCells"),this.parts(i,"regParts","B"),this.bubs(i,"regBubs"),n&&this.cells(i,"bRegVol"),this.one(i,"regFinishStart"),this.faces(i,"p2g","B"),n&&this.faces(i,"bFaceL"),this.mixed){for(let r=0;r<Am;r+=2)this.faces(i,"viscJacA"),this.faces(i,"viscJacB");this.faces(i,"viscForce")}this.cells(i,"liqAssemble"),this.solver.encodeMG(i,Ff,this.itL,!0,!1),this.cells(i,"liqPressure"),this.faces(i,"liqCorrect"),n&&this.bstep.probe(i,this.hooks),this.faces(i,"extrap1"),this.faces(i,"extrap2"),this.parts(i,"g2p","B"),this.sort(i,2),this.parts(i,"heatWeights","A"),i.end(),i=this.pass(t,e,2),this.cells(i,"gasVolumes"),this.faces(i,"markFaces"),n&&this.faces(i,"bFaceG"),this.cells(i,"gasMaxOut");for(let r=0;r<16;r+=1)this.cells(i,"gasFlux","",r),this.cells(i,"gasMove","",r);if(this.cells(i,"gasApplyMid"),this.faces(i,"macFwd"),this.faces(i,"macBack"),this.faces(i,"viscosity"),this.cells(i,"gasAssemble"),this.solver.encodeMG(i,Pf,this.itG,!0,!0),this.cells(i,"gasPressure"),this.faces(i,"gasCorrect"),i.end(),i=this.pass(t,e,3),this.cells(i,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(i,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(i,"bubAdvance"),this.bubs(i,"bubTarget"),this.bubs(i,"bubMerge"),this.bubs(i,"bubMergeFinal"),this.bubs(i,"bubVent"),this.bubs(i,"bubFinish"),this.one(i,"bubCompact"),this.bubs(i,"bubCopyBack"),this.parts(i,"applyMass","A"),this.cells(i,"spawnWater","A"),this.cells(i,"gatherPlain","A"),this.bubs(i,"bubAlpha"),this.cells(i,"cellAlpha"),this.cells(i,"gasApply"),i.end(),i=this.pass(t,e,4),this.cells(i,"diffPrep"),this.cells(i,"diffAssemble"),this.solver.encodeMG(i,kf,this.itD,!1),this.faces(i,"diffFaces"),this.cells(i,"diffOut"),this.cells(i,"diffApply"),this.cells(i,"latentSrc"),this.parts(i,"applyMass","A"),this.cells(i,"spawnWater","A"),this.cells(i,"gatherPlain","A"),this.cells(i,"gasApply"),this.cells(i,"flashTs"),this.cells(i,"flashVap","A"),this.parts(i,"flashParts","A"),this.cells(i,"flashDist"),this.cells(i,"gasApply"),this.cells(i,"fog"),this.cells(i,"films","A"),this.salty&&(this.parts(i,"saltCryst","A"),this.cells(i,"gasApply")),i.end(),i=this.pass(t,e,5),this.cells(i,"heaterSums"),n&&this.one(i,"bHeaters"),this.one(i,"heaterPI"),s.heat.liquidPower!==0&&this.parts(i,"sumCl","A"),this.cells(i,"heatPrep","A"),this.cells(i,"heatAssemble"),this.solver.encodeMG(i,Af,this.itH,!1),this.cells(i,"heatFlux"),this.parts(i,"heatParts","A"),this.cells(i,"heatShare","A"),this.salty&&(this.cells(i,"saltSums","A"),this.cells(i,"saltShare","A")),i.end(),i=this.pass(t,e,7),this.cells(i,"regCells"),this.parts(i,"regParts","A"),this.bubs(i,"regBubs"),n&&this.cells(i,"bRegVol"),this.one(i,"regFinish"),this.sealed&&(this.cells(i,"compSums"),this.one(i,"compStep0"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStep1"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStepEnd"),this.parts(i,"pwParts","A"),this.bubs(i,"pwBubs")),this.cells(i,"gasEos"),!n){this.one(i,"stepEnd"),i.end();return}i.end(),i=this.pass(t,e,8),this.bstep.finish(i,this.hooks),this.one(i,"stepEnd"),i.end()}layout(){const t=this.state,e=0,s=e+4*Ts,n=s+4*gn,i=n+4*Le*t.d.nreg,r=i+4*Fe*t.d.nheat,c=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],a=r+4*xn*c,l=a+4*64,d=l+8*sn,f=t.body?t.bodies.nbody:0,u=d+4*hn*f;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:a,ts:l,bodies:d,nbody:f,total:u}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(a=>!this.busy.has(a)&&a.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),n.nbody>0&&this.bstep.measure(r,this.hooks),r.end(),n.nbody>0&&t.copyBufferToBuffer(s.bodies.bread,0,i,n.bodies,4*hn*n.nbody),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*Ts),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*gn),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Le*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*Fe*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*sn),t.clearBuffer(s.cnt,4*ka,4*(Nh-ka)),t.clearBuffer(s.cnt,4*V.VMAXP,4*4),t.clearBuffer(s.cnt,4*V.ESC_OTHER,4*3),t.clearBuffer(s.cnt,4*V.REL_MASS,4*4),t.clearBuffer(s.cnt,4*V.BODYWORK,4*(V.CONT_FULL+1-V.BODYWORK)),this.busy.add(i);const c=[];for(let a=0;a<this.cpu.regions.count;a+=1)c.push(s.gpuRegion(a));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:c,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,Ts),r=new Float32Array(t,n.cnt,Ts),c=new Float32Array(t,n.glob,gn),a=new Float32Array(t,n.reg,Le*e.nreg),l=new Float32Array(t,n.heat,Fe*e.nheat),d=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[u,m,p]=e.groups,h=(F,k,P)=>{let y=0;for(let A=0;A<k;A+=1)y+=d[(F+A)*xn+P];return y},g=[];for(const F of e.regions){const k=Le*F;g.push({p0:a[k+Jt.P0],sealed:a[k+Jt.OPEN]===0,vGas:a[k+Jt.VGAS],vFluid:a[k+Jt.VFLUID]})}const v=[];for(let F=0;F<e.heaters;F+=1){const k=Fe*F;v.push({P:l[k+Kt.P],Tmean:l[k+Kt.TMEAN],integral:l[k+Kt.INTEGRAL],cells:l[k+Kt.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,sn);w=[];for(let k=0;k<Ss;k+=1){const P=F[2*k],y=F[2*k+1];w.push(y>P&&P>0n?Number(y-P)/1e6:0)}}const b=r[V.SUM_WM],_={};for(const[F,k,P]of sl)_[F]=P==="f"?r[k]:i[k];return{intervals:_,ov:[r[V.OV_PMAX],r[V.OV_VMAX],r[V.OV_VLIQ]],pcount:i[V.PCOUNT],bcount:i[V.BCOUNT],dt:c[an.DT],stepsSince:i[V.STEPS],simSince:r[V.SIMTIME],itL:i[V.IT_L],itG:i[V.IT_G],itH:i[V.IT_H],itD:i[V.IT_D],capL:i[V.CAP_L],capG:i[V.CAP_G],capH:i[V.CAP_H],capD:i[V.CAP_D],resL:r[V.RES_L],resG:r[V.RES_G],resH:r[V.RES_H],nsub:i[V.NSUBMAX],uMaxG:r[V.UMAXG],waterMass:b,waterT:b>0?r[V.SUM_WMT]/b:0,waterTmax:r[V.TMAX],solids:h(0,u,0),film:h(0,u,1),gas:h(0,u,2),vapour:h(0,u,3),fog:h(0,u,4),air:h(0,u,5),liquidCells:Math.round(h(0,u,6)),gasCells:Math.round(h(0,u,7)),liquidH:h(u,m,0),liquidMass:h(u,m,1),sensible:h(u,m,3),otherMass:h(u,m,4),otherMT:h(u,m,5),saltLiquid:h(u,m,6),crust:h(0,u,8),floor:h(0,u,9),floorH:h(0,u,10),bubH:h(u+m,p,0),bubWater:h(u+m,p,1),bubAir:h(u+m,p,2),regions:g,heaters:v,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[V.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[V.FIRST_SH]!==0?r[V.FIRST_SH]-1e3:null,stageMs:w,vmaxP:r[V.VMAXP],rmaxB:r[V.RMAXB],slowed:i[V.SLOWED],vented:r[V.VENTED],bodies:n.nbody>0?this.state.bodies.parse(t,n.bodies,n.nbody):[],itP:i[V.IT_P],capP:i[V.CAP_P]}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of sl)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD,e.slowed+=t.slowed,e.vented+=t.vented;const s=(n,i,r,c,a,l)=>{if(i===0&&r===0)return n;const d=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(a,Math.max(c,n>d?Math.max(d,n-2):d))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub,this.bstep.adapt(t.itP,t.capP))}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),c={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:i.escapedOther,editOther:e.ledger.other,escapedSalt:i.escapedSalt,editSalt:e.ledger.salt,bodyWork:i.bodyWork},a=this.energy0??r.energy,l=this.water0??r.water.total,d=r.energy-a-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),f=r.water.total-l-c.editWater,u=r.other.total-(this.other0??r.other.total)-c.editOther,m=r.salt.total-(this.salt0??r.salt.total)-c.editSalt,p=i.produced+i.burstVapour,h=i.time-this.vapourLast;h>.2&&(this.vapourRate=(p-this.vapourMark)/h,this.vapourMark=p,this.vapourLast=i.time);const g=e.heat.heaters.map((b,_)=>({h:b,k:_,rd:n==null?void 0:n.heaters[_]})).filter(({rd:b,h:_})=>((b==null?void 0:b.cells)??_.cells)>0).map(({h:b,rd:_})=>({group:b.group,P:(_==null?void 0:_.P)??b.P,Tmean:(_==null?void 0:_.Tmean)??b.Tmean,mode:b.mode,power:b.power,target:b.target,on:b.on})),v=(b,_,F)=>({iterations:b,residual:_,capped:F>0}),w=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:v((w==null?void 0:w.itL)??0,(w==null?void 0:w.resL)??0,(w==null?void 0:w.capL)??0),gas:v((w==null?void 0:w.itG)??0,(w==null?void 0:w.resG)??0,(w==null?void 0:w.capG)??0),heat:v((w==null?void 0:w.itH)??0,(w==null?void 0:w.resH)??0,(w==null?void 0:w.capH)??0),gasSubsteps:(w==null?void 0:w.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:(n==null?void 0:n.otherMass)??0,otherT:n!==null&&n.otherMass>0?n.otherMT/n.otherMass:0,saltMass:(n==null?void 0:n.saltLiquid)??0,saltSolid:((n==null?void 0:n.crust)??0)+((n==null?void 0:n.floor)??0),bodies:this.bodyCounts(),heaters:g,regions:((n==null?void 0:n.regions)??[]).map(b=>({p0:b.p0,sealed:b.sealed,vGas:b.vGas})),budget:r,flows:c,energyError:d,waterError:f,otherError:u,saltError:m,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:{...e.extremes.stats(),slowed:i.slowed,vented:i.vented},cpuOnly:!1}}bodyCounts(){var r;const t=this.cpu.bodies.list,e=((r=this.last)==null?void 0:r.bodies)??[];if(!this.state.body||e.length===0)return{count:t.filter(c=>!c.gone).length,free:0,awake:0};let s=0,n=0,i=0;for(const c of e)c.gone||(s+=1,c.pinned||(n+=1,c.asleep||(i+=1)));return{count:s,free:n,awake:i}}bodySums(){var r;const t=((r=this.last)==null?void 0:r.bodies)??[];let e=0,s=0,n=0;const i=this.cpu.bodies.list;return t.forEach((c,a)=>{var l;c.gone||(e+=c.E+ks(((l=i[a])==null?void 0:l.mat)??0)*c.m,s+=c.film,n+=c.crust)}),{E:e,film:s,crust:n,ice:t.length>0?Rh(this.cpu,t):0}}budget(){const t=this.last,e=this.totals;let s=0;for(const u of(t==null?void 0:t.regions)??[])u.sealed&&(s-=u.p0*u.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=this.bodySums(),r=((t==null?void 0:t.solids)??0)+((t==null?void 0:t.floorH)??0)+i.E,c=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,l=((t==null?void 0:t.film)??0)+i.film,d={liquid:(t==null?void 0:t.liquidMass)??0,ice:i.ice,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:l,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+i.ice+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+l+((t==null?void 0:t.bubWater)??0)+e.escapedWater},f=(t==null?void 0:t.otherMass)??0;return{energy:r+n+c+a+s,solids:r,liquid:n,gas:c,bubbles:a,pv:s,water:d,other:{liquid:f,escaped:e.escapedOther,total:f+e.escapedOther},salt:this.saltBudget(),air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}saltBudget(){const t=this.last,e=(t==null?void 0:t.saltLiquid)??0,s=((t==null?void 0:t.crust)??0)+this.bodySums().crust,n=(t==null?void 0:t.floor)??0,i=this.totals.escapedSalt;return{liquid:e,crust:s,grains:0,floor:n,escaped:i,total:e+s+n+i}}resetTotals(){Object.assign(this.totals,nl()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0,this.carry=null}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}carryErrors(t){this.resetBaseline(),this.carry=t}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu,n=this.carry??{energy:0,water:0,other:0,salt:0};this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy+e.bodyWork)-n.energy,this.water0=t.water.total-s.ledger.water-n.water,this.other0=t.other.total-s.ledger.other-n.other,this.salt0=t.salt.total-s.ledger.salt-n.salt,this.carry=null}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}function km(o){const t=o.cpu,e=t.flows,s=t.phase,n=t.bubbleModel,i=t.extremes.stats();Object.assign(o.totals,{time:t.time,steps:t.steps,heater:e.heater,lossWalls:e.lossWalls,lossOpen:e.lossOpen,escapedEnergy:e.escapedEnergy,escapedWater:e.escapedWater,escapedAir:e.escapedAir,escapedOther:e.escapedOther,escapedSalt:e.escapedSalt,crystallized:t.salt.crystallized,produced:s.produced,condensed:s.condensed,dew:s.dew,fogMade:s.fogMade,burstVapour:n.burstVapour,nucleated:n.nucleated,departed:n.departed,merged:n.merged,burst:n.burst,collapsed:n.collapsed,burstCold:n.burstCold,burstWarm:n.burstWarm,collapsedCold:n.collapsedCold,collapsedWarm:n.collapsedWarm,fluxSL:t.heat.fluxSL,fluxLG:t.heat.fluxLG,fluxSG:t.heat.fluxSG,lossSolids:t.heat.lossSolids,slowed:i.slowed,vented:i.vented}),o.carryErrors({energy:t.energyError(),water:t.waterError(),other:t.otherError(),salt:t.saltError()})}function Sm(o,t,e,s,n){const i=-n,r=-n,c=o+2*n,a=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(c/a>l){const f=c/l;return{x0:i,y0:r-(f-a)/2,x1:i+c,y1:r-(f-a)/2+f}}const d=a*l;return{x0:i-(d-c)/2,y0:r,x1:i-(d-c)/2+d,y1:r+a}}const An=self,Tt=o=>An.postMessage(o),il=8,Tm=.1,Mm=3,rl=200,Bm=.25,ol=273.15;let ot=null,st=null,us=null,ui=null,Ye=null,vn="",tr=1,er=1,sr=1,kn={x0:0,y0:0,x1:1,y1:1},Sn={left:!0,right:!0,bottom:!0,top:!1},js=!1,zo=1,As="none",If=!1,os=0,yn=0,Sr=0,wo=0,_o=!1,di=0,Yo=0,Xo=0,Qo=0,cl=!1,Tr=0,fn=null,nr=null;const _s=[],Zo=[];let Mr=!1;const wn=[];let al=null,Hi=null,ll=0;function cs(){Hi!==null&&clearTimeout(Hi),Hi=setTimeout(()=>{Hi=null,Cm()},300)}async function Cm(){const o=ot;if(o===null)return;const t=ll+=1;try{const e=su(o.serialize()),s=await qc(e,"cpu"),n=await qc(e,"gpu");al??(al=cu());const i=await al,[r,c]=await Promise.all([i.header(s),i.header(n)]);if(t!==ll||ot!==o)return;const a=c??r;Tt({type:"clip",info:a===null?null:Jl(a,Zl(tf(o,new ef(o))),c!==null?r:null)})}catch{}}function Fc(){if(ot===null)return;const o=ot.scene.sides;Sn={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Pc(o,t,e){tr=Math.max(1,o),er=Math.max(1,t),sr=Math.max(.5,Math.min(3,e)),Ye!==null&&(Ye.width=Math.round(tr*sr),Ye.height=Math.round(er*sr)),ot!==null&&(kn=Sm(ot.boxW,ot.boxH,tr,er,.006))}function jf(o){us!==null&&(us.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function Fs(o){Zo.push(o),Mr||Lm()}async function Lm(){if(st!==null){Mr=!0;try{for(;Zo.length>0;){const o=Zo.shift();await st.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Tt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{Mr=!1,yn=performance.now()}}}async function ir(){if(st===null)return;const o=st.ctx.device.createCommandEncoder(),t=st.encodeReadback(o,!1);st.ctx.device.queue.submit([o.finish()]),t!==null&&await st.finishReadback(t,!1),st.baselineFromLast()}function Br(){return ot===null||!ot.needsCpu()?!1:(Tt({type:"gpu",ok:!1,adapter:vn,message:"cpu-only",scene:ot.serialize()}),!0)}function Cr(o){st!==null&&us!==null&&st.stateVersion!==o&&us.reset()}function Fo(){Fs(async()=>{if(st===null||ot===null||wn.length===0)return;const o=wn.splice(0,wn.length);await ir(),await st.download();for(const e of o){const s=ot.apply(e);s!==null&&s.startsWith("refused")&&Tt({type:"refused",message:s})}if(Br())return;const t=st.stateVersion;st.upload(),Cr(t),cs()})}function Om(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(As==="temperature")return[ol+se[0],ol+se[1],e];if(As==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return As==="velocity"?[0,Math.max(.02,t[1]),e]:As==="vapour"?[0,.6,e]:As==="salt"?[0,hc,e]:[0,1,e]}function qm(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return fn={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},fn}return fn!==null&&(t.fate===1||t.fate===2)?{...fn,fate:t.fate===1?"burst":"collapsed"}:null}function Em(o,t){if(st===null||ui===null)return;if(st.baselineFromLast(),ot!==null&&o.stepsSince>0){ot.extremes.observe(o.rmaxB,o.vmaxP,st.totals.time);const i=ot.extremes.take();i!==null&&(js=!0,os=0,Sr=0,Tt({type:"extreme",event:i}))}if(st.totals.time>=Tr){const i=ui.sample();i!==null&&(_s.push(i),_s.length>400&&_s.splice(0,_s.length-400),Tr=st.totals.time+Bm)}const e=Math.max(.001,(t-di)/1e3),s=(o.stageMs??st.stageMs).reduce((i,r)=>i+r,0),n={engine:st.stats(s),stepsPerSecond:Qo/e,simRate:(st.totals.time-Yo)/e,fps:Xo/e,renderMs:0,mode:"gpu",adapter:vn,paused:js,samples:_s.splice(0,_s.length),bubble:qm(o),object:nr!==null&&ot!==null?st.state.body?Eh(ot,nr,o.bodies):Td(ot,nr):null,overlayScale:Om(o)};Tt({type:"stats",stats:n}),Xo=0,Qo=0,Yo=st.totals.time,di=t}function Jo(){var t;const o=performance.now();if(st!==null&&us!==null&&Ye!==null&&ot!==null&&!Mr){const e=st.ctx.device,s=yn===0?0:Math.min(.1,(o-yn)/1e3);yn=o;const n=((t=st.last)==null?void 0:t.dt)??ot.dt;let i=0;js?(i=Math.min(il,Sr),Sr-=i,os=0):(os=Math.min(os+s*zo,Tm*Math.max(1,zo)),i=wo>=Mm?0:Math.min(il,Math.floor(os/Math.max(1e-5,n))),os-=i*n);const r=!_o&&o-di>rl&&(i>0||js||o-di>4*rl),c=e.createCommandEncoder();i>0&&st.encodeSteps(c,i,r);const a=r?st.encodeReadback(c,r&&i>0):null;if(us.encode(c,kn,Ye.width,Ye.height,Sn,As,If),e.queue.submit([c.finish()]),wo+=1,e.queue.onSubmittedWorkDone().then(()=>{wo-=1}),Qo+=i,Xo+=1,a!==null){_o=!0;const l=i>0;st.finishReadback(a,l).then(d=>{_o=!1,d!==null&&Em(d,performance.now())})}}typeof An.requestAnimationFrame=="function"?An.requestAnimationFrame(Jo):setTimeout(Jo,16)}async function Rm(o){ot=new wh(o.scene);const t=new ef(ot);if(o.resume!==void 0&&J0(tf(ot,t),o.resume),js=o.paused===!0,Br())return;if(Ye=o.canvas,Ye===null)throw new Error("no OffscreenCanvas");st=await Kn.create(ot),o.resume!==void 0&&(km(st),Tr=ot.time,Yo=ot.time),vn=await(async()=>{var s;try{const n=await((s=An.navigator.gpu)==null?void 0:s.requestAdapter({powerPreference:"high-performance"})),i=n==null?void 0:n.info;return i===void 0?"":[i.vendor,i.architecture,i.description].filter(Boolean).join(" ")}catch{return""}})(),us=new Fm(st,Ye),await us.init(),jf(o.dark),ui=new yf(st),o.resume!==void 0&&ui.copyFrom(t),st.ctx.device.addEventListener("uncapturederror",s=>Tt({type:"error",message:`WebGPU: ${s.error.message}`})),st.ctx.device.lost.then(s=>Tt({type:"gpu",ok:!1,adapter:vn,message:s.message||s.reason})),Fc(),Pc(o.width,o.height,o.dpr),Tt({type:"gpu",ok:!0,adapter:vn,message:""}),Tt({type:"ready",offscreen:!0,warnings:ot.warnings,view:kn,quality:ot.currentQuality,walls:Sn}),o.resume!==void 0&&Tt({type:"live",t:ot.time}),di=performance.now(),yn=performance.now(),cl||(cl=!0,Jo()),cs()}function Po(){if(st===null||ot===null)return;const o=st.stateVersion;st.cpu=ot,st.rebuild(),st.resetTotals(),Cr(o),ui=new yf(st),Tr=0,_s.length=0,os=0,fn=null,Fc(),Pc(tr,er,sr),Tt({type:"view",view:kn,walls:Sn}),cs()}An.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Tt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&An.navigator.gpu!==void 0});break;case"init":Rm(t).catch(e=>Tt({type:"gpu",ok:!1,adapter:vn,message:e instanceof Error?e.message:String(e)}));break;case"resize":Pc(t.width,t.height,t.dpr),Tt({type:"view",view:kn,walls:Sn});break;case"op":wn.push(t.op),Fo();break;case"addLiquid":wn.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Fo();break;case"addSolid":wn.push({op:"solid",region:t.region,material:t.material,T:t.T}),Fo();break;case"setHeater":ot==null||ot.setHeater(t.group,t.mode,t.power,t.target,t.on),st==null||st.writeHeater(t.group),cs();break;case"setAmbient":ot==null||ot.setAmbient(t.p,t.T,t.rh,t.g,t.air),st==null||st.writeParams(),cs();break;case"setBoundary":Fs(async()=>{if(st===null||ot===null)return;await ir(),await st.download(),ot.setBoundary(t.side,t.value);const e=st.stateVersion;st.upload(),Cr(e),Fc(),Tt({type:"view",view:kn,walls:Sn}),cs()});break;case"query":Fs(async()=>{if(st===null||ot===null){Tt({type:"reply",id:t.id,data:null});return}await ir(),await st.download(),Tt({type:"reply",id:t.id,data:ot.query(t.x,t.y)})});break;case"select":fn=null,st==null||st.watch(t.bubble);break;case"overlay":As=t.overlay;break;case"particles":If=t.on;break;case"pause":js=t.paused,os=0,yn=performance.now();break;case"step":js&&(Sr+=1);break;case"setSpeed":zo=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":ot==null||ot.setExtremes(t.mode),st==null||st.writeParams(),cs();break;case"setQuality":Fs(async()=>{ot!==null&&(ot.setQuality(t.quality),Po())});break;case"serialize":st===null?Tt({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null}):Fs(async()=>{Tt({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null})});break;case"load":Fs(async()=>{ot!==null&&(ot.load(t.scene),!Br()&&Po())});break;case"selectObject":nr=t.object;break;case"editObject":Fs(async()=>{if(st===null||ot===null){Tt({type:"reply",id:t.id,data:null});return}await ir(),await st.download();const e=Sd(ot,t.object,t.patch);if(Tt({type:"reply",id:t.id,data:e}),Br())return;if(e.rebuilt){Po();return}const s=st.stateVersion;st.upload(),Cr(s),cs()});break;case"theme":jf(t.dark);break;case"frameDone":break}}catch(e){Tt({type:"error",message:e instanceof Error?e.message:String(e)})}});
