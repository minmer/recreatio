var c0=Object.defineProperty;var l0=(o,t,e)=>t in o?c0(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var v=(o,t,e)=>l0(o,typeof t!="symbol"?t+"":t,e);const Nc=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Ws(o){if(o===null||typeof o!="object")return null;const t=o,e=(c,l)=>{if(!Array.isArray(c)||c.length!==l)return null;const a=c.map(Nc);return a.every(u=>u!==null)?a:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const c=t.poly.map(l=>e(l,2));if(c.every(l=>l!==null))return{poly:c.map(l=>[l[0],l[1]])}}const i=e(t.line,4),r=Nc(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function es(o,t,e){if("rect"in o){const[m,p,h,g]=o.rect;return t>=m&&t<=h&&e>=p&&e<=g}if("circle"in o){const[m,p,h]=o.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=h*h}if("poly"in o){const m=o.poly;let p=!1;for(let h=0,g=m.length-1;h<m.length;g=h,h+=1){const[x,y]=m[h],[b,_]=m[g];y>e!=_>e&&t<(b-x)*(e-y)/(_-y)+x&&(p=!p)}return p}const[s,n,i,r]=o.line,c=i-s,l=r-n,a=c*c+l*l,u=a>0?Math.max(0,Math.min(1,((t-s)*c+(e-n)*l)/a)):0,f=t-(s+u*c),d=e-(n+u*l);return f*f+d*d<=.25*o.width*o.width}function Ln(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,c,l]=o.circle;return[r-l,c-l,r+l,c+l]}if("poly"in o){let r=1/0,c=1/0,l=-1/0,a=-1/0;for(const[u,f]of o.poly)r=Math.min(r,u),c=Math.min(c,f),l=Math.max(l,u),a=Math.max(a,f);return[r,c,l,a]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Ks(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const a0={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},f0=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],u0=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],d0={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},h0=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var m0={ambient:a0,species:f0,solutes:u0,vapourInAir:d0,solids:h0};const Ut=8.314462618,Nr=9.80665,ei=101325,et=273.15,dr=1602176634e-28,Ba=1380649e-29,Ca=602214076e15,La=88541878128e-22,$=0,rt=1,pt=2,lt=0,at=1,Q=2,ut=6,Ft=3,Ct=m0,$t=Ct.species[0],qn=Ct.species[1],On=Ct.species[2],gt=new Float64Array(ut);gt[lt]=qn.molarMass.v;gt[at]=On.molarMass.v;gt[Q]=$t.molarMass.v;qn.name,On.name,$t.vapour.name;const uc=qn.gas.cp.v,dc=On.gas.cp.v,[si,ni,hs]=$t.vapour.cp.linear;function p0(o,t){return o===Q?si+ni*(t-hs):o===lt?uc:o===at?dc:0}const xs=$t.liquid.kell.c,_i=$t.liquid.cp.table,It=new Float64Array(_i.map(o=>o[0])),Vt=new Float64Array(_i.map(o=>o[1])),fe=new Float64Array(_i.length);fe[0]=Vt[0]*(It[0]-et);for(let o=1;o<_i.length;o+=1)fe[o]=fe[o-1]+.5*(Vt[o]+Vt[o-1])*(It[o]-It[o-1]);const Xt=_i.length-1;function qa(o){if(o<It[0])return-1;if(o>=It[Xt])return Xt;let t=Math.min(Xt-1,Math.max(0,Math.floor((o-et)/10)));for(;t>0&&o<It[t];)t-=1;for(;t<Xt-1&&o>=It[t+1];)t+=1;return t}function Ge(o){const t=qa(o);return t<0?Vt[0]:t===Xt?Vt[Xt]:Vt[t]+(Vt[t+1]-Vt[t])*(o-It[t])/(It[t+1]-It[t])}function kt(o){const t=qa(o);if(t<0)return fe[0]+Vt[0]*(o-It[0]);if(t===Xt)return fe[Xt]+Vt[Xt]*(o-It[Xt]);const e=o-It[t],s=(Vt[t+1]-Vt[t])/(It[t+1]-It[t]);return fe[t]+Vt[t]*e+.5*s*e*e}function Oa(o){if(o<fe[0])return It[0]+(o-fe[0])/Vt[0];if(o>=fe[Xt])return It[Xt]+(o-fe[Xt])/Vt[Xt];let t=Math.min(Xt-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<fe[t];)t-=1;for(;t<Xt-1&&o>=fe[t+1];)t+=1;const e=(Vt[t+1]-Vt[t])/(It[t+1]-It[t]),s=o-fe[t],n=Vt[t];return It[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function An(o){const t=o-et;return(xs[0]+t*(xs[1]+t*(xs[2]+t*(xs[3]+t*(xs[4]+t*xs[5])))))/(1+xs[6]*t)}const Wr=$t.liquid.k.poly;function ii(o){const t=Math.min(150,Math.max(0,o-et));return Wr[0]+t*(Wr[1]+t*Wr[2])}const[b0,g0,jc]=$t.liquid.mu.vogel;function js(o){return b0*Math.pow(10,g0/(Math.max(o,jc+60)-jc))}const Kr=$t.surfaceTension,v0=$t.saturation.Tc.v;function Fi(o){const t=Math.max(0,1-o/v0);return Kr.B*Math.pow(t,Kr.mu)*(1+Kr.b*t)}const x0=$t.saturation.hlv100.v,ri=et+100,Ea=kt(ri)+x0,y0=$t.vapour.k.v,w0=$t.vapour.mu.v;function xt(o){const t=o-hs,e=ri-hs;return Ea+si*(o-ri)+.5*ni*(t*t-e*e)}function hc(o){return xt(o)-kt(o)}function ue(o,t){return o===Q?xt(t):p0(o,t)*(t-et)}const zr=qn.gas.k.power,Yr=On.gas.k.power,_0=qn.gas.mu.sutherland,F0=On.gas.mu.sutherland,Xr=Ct.vapourInAir,Ra=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),Ia=150,hr=1001,Pi=o=>{const t=new Float64Array(hr);for(let e=0;e<hr;e+=1)t[e]=o(Ia+e);return t},Rs=(o,t)=>{let e=t-Ia;e>0?e>hr-1.001&&(e=hr-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Dc=Pi(o=>zr[0]*Math.pow(o/zr[1],zr[2])),P0=Pi(o=>Yr[0]*Math.pow(o/Yr[1],Yr[2])),Gc=Pi(o=>Ra(_0,o)),k0=Pi(o=>Ra(F0,o)),A0=Pi(o=>Xr.D0.v*Math.pow(o/Xr.T0.v,Xr.exponent.v));function mc(o,t,e,s){const n=o+t+e;return n>0?(o*Rs(Dc,s)+t*Rs(P0,s)+e*y0)/n:Rs(Dc,s)}function Na(o,t,e,s){const n=o+t+e;return n>0?(o*Rs(Gc,s)+t*Rs(k0,s)+e*w0)/n:Rs(Gc,s)}function S0(o,t){return Rs(A0,o)*(ei/t)}function ja(o,t,e,s){const n=o*uc+t*dc,i=ri-hs,r=.5*e*ni,c=n+e*si;if(c<=0)return et;const l=n*(hs-et)+e*(Ea+si*(hs-ri)-.5*ni*i*i)-s,a=c*c-4*r*l;return hs+-2*l/(c+Math.sqrt(a>0?a:0))}function Co(o,t,e,s,n){return o*uc+t*dc+e*(si+ni*(n-hs))+(s>0?s*Ge(n):0)}const T0=Ct.ambient.air.N2.v,M0=Ct.ambient.air.O2.v,Da=Ct.ambient.hExt.v,ht=Ct.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function un(o){return ht.findIndex(t=>t.id===o)}const dt=0,Ga=Ct.species.slice(3),Uc=[null,...Ga.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*et+.5*s*et*et}})],oe=[{id:$t.id,name:$t.name,short:$t.liquid.name,color:$t.liquid.color,volatile:!0,range:[et,et+150]},...Ga.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function Ua(o){return oe.findIndex(t=>t.id===o)}const $s=o=>Uc[o]??Uc[1];function pc(o,t){if(o===dt)return Ge(t);const e=$s(o);return e.cA+e.cB*t}function B0(o,t){if(o===dt)return kt(t);const e=$s(o);return e.cA*t+.5*e.cB*t*t-e.h0}function C0(o,t){if(o===dt)return Oa(t);const e=$s(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function Ds(o,t){if(o===dt)return An(t);const e=$s(o);return e.rA+e.rB*t}function zn(o,t){if(o===dt)return ii(t);const e=$s(o);return e.kA+e.kB*t}function oi(o,t){if(o===dt)return js(t);const e=$s(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function bn(o,t){return o===dt?Fi(t):$s(o).sigma}$t.thermo,qn.thermo,On.thermo;const ki=Ct.species[0].saturation,Ue=ki.if97.n,Va=Ue[0],Ha=Ue[1],$a=Ue[2],Wa=Ue[3],Ka=Ue[4],za=Ue[5],Ya=Ue[6],Xa=Ue[7],Qa=Ue[8],Lo=Ue[9],Yn=ki.Tc.v,L0=ki.rhoc.v,mr=273.15,zs=ki.vapourDensity.c;ki.liquidDensity.b;function jr(o){const t=o<mr?mr:o>Yn?Yn:o,e=t+Qa/(t-Lo),s=e*e+Va*e+Ha,n=$a*e*e+Wa*e+Ka,i=za*e*e+Ya*e+Xa,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function St(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+$a*e+za,n=Va*e*e+Wa*e+Ya,i=Ha*e*e+Ka*e+Xa,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),c=Lo+r;return(c-Math.sqrt(c*c-4*(Qa+Lo*r)))/2}function Za(o){const e=1-(o<mr?mr:o>Yn?Yn:o)/Yn,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,c=r*r*n,l=c*c*s,a=l*c*r*r;return L0*Math.exp(zs[0]*n+zs[1]*i+zs[2]*r+zs[3]*c+zs[4]*l+zs[5]*a)}const pr=250,br=.01,Ai=25001,Ji=new Float64Array(Ai),tr=new Float64Array(Ai);for(let o=0;o<Ai;o+=1)Ji[o]=jr(pr+o*br),tr[o]=Za(pr+o*br);function ci(o){const t=(o-pr)/br;if(!(t>=0)||t>=Ai-1)return jr(o);const e=t|0;return Ji[e]+(t-e)*(Ji[e+1]-Ji[e])}function Ne(o){const t=(o-pr)/br;if(!(t>=0)||t>=Ai-1)return Za(o);const e=t|0;return tr[e]+(t-e)*(tr[e+1]-tr[e])}const Qt=Ct.solutes[0],Ja=Ct.species[0],Dr=Ja.molarMass.v,Be=Qt.molarMass.v,q0=Qt.ions.v,Si=1,Gr=Ct.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function tf(o){return Gr.findIndex(t=>t.id===o)}function O0(o){return o>0?o/((1-o)*Be):0}function ef(o){return o>0?o*Be/(1+o*Be):0}const Ae=298.15,Ti=Qt.pitzer,E0=Ti.b0.a,R0=Ti.b1.a,I0=Ti.c.a,N0=Ti.b.v,j0=Ti.alpha.v,er=Qt.pitzerCold,D0=er.below.v;function Qr(o,t){return o[0]+o[1]*(1/t-1/Ae)+o[2]*Math.log(t/Ae)+o[3]*(t-Ae)+o[4]*(t*t-Ae*Ae)+o[5]*(1/(t*t)-1/(Ae*Ae))}const Oi=Qt.dielectric.c;function G0(o){const t=o-et;return Oi[0]+t*(Oi[1]+t*(Oi[2]+t*Oi[3]))}function U0(o){const t=dr*dr/(4*Math.PI*La*G0(o)*Ba*o);return Math.sqrt(2*Math.PI*Ca*An(o))*t*Math.sqrt(t)/3}function V0(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<D0,n=Qr(s?er.b0.a:E0,o),i=Qr(s?er.b1.a:R0,o),r=Qr(s?er.c.a:I0,o);return 1-U0(o)*e/(1+N0*e)+t*(n+i*Math.exp(-j0*e))+t*t*r}function gr(o,t){return t>0?Math.exp(-q0*t*V0(o,t)*Dr):1}const sf=240,vr=221,nf=.05,fs=181;let Zr=null;function H0(){if(Zr!==null)return Zr;const o=new Float64Array(vr*fs);for(let t=0;t<vr;t+=1)for(let e=0;e<fs;e+=1)o[t*fs+e]=gr(sf+t,e*nf);return Zr=o,o}function rf(o,t){if(!(t>0))return 1;const e=t/nf;if(e>=fs-1)return gr(o,t);const s=H0();let n=o-sf;n>0?n>vr-1.000001&&(n=vr-1.000001):n=0;const i=n|0,r=e|0,c=n-i,l=e-r,a=i*fs+r,u=s[a]+l*(s[a+1]-s[a]),f=s[a+fs]+l*(s[a+fs+1]-s[a+fs]);return u+c*(f-u)}function bc(o,t){let e=St(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=St(o/rf(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Ur=Ja.fusion,ne=Ur.T.v,gc=Ur.h.v,$0=Ur.cpIce.v;Ur.rhoIce.v;function W0(o){const t=Ge(ne)-$0;return Dr/Ut*((gc-t*ne)*(1/ne-1/o)+t*Math.log(o/ne))}const of=Qt.eutectic.T.v,qo=Qt.eutectic.w.v;function vc(o){if(!(o>0))return ne;if(ef(o)>=qo)return of;const t=s=>Math.log(gr(s,o))-W0(s);let e=ne+Math.log(gr(ne,o))*Ut*ne*ne/(Dr*gc);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return ne;if(Math.abs(r)<1e-9)break}return e}const ss=Qt.solubility.table;function K0(o){if(o<=ss[0][0])return ss[0][1];for(let t=1;t<ss.length;t+=1)if(o<=ss[t][0]){const[e,s]=ss[t-1],[n,i]=ss[t];return s+(i-s)*(o-e)/(n-e)}return ss[ss.length-1][1]}function cf(o){return ef(K0(o))}const xc=Qt.solid.rho.v,gs=Qt.solid.cp.v;function Mi(o){return gs*(o-et)}const In=Qt.density.laliberte;function z0(o,t){const e=o-et,s=e+In[4];return(In[0]*t+In[1])*Math.exp(1e-6*s*s)/(t+In[2]+In[3]*e)}function Vr(o,t){return t>0?1/((1-t)/An(o)+t/z0(o,t)):An(o)}const En=Qt.cp.laliberte,Hr=En[0],Y0=En[1],X0=En[2],li=En[3],yc=En[4],ai=En[5],Gs=Qt.cp.range.lo,xr=Qt.cp.range.hi,Is=.5,Ze=Math.round((xr-Gs)/Is)+1,re=new Float64Array(Ze),fi=new Float64Array(Ze);for(let o=0;o<Ze;o+=1){const t=Gs+o*Is-et;re[o]=Math.exp(Y0*t+X0*Math.exp(.01*t))}fi[0]=re[0]*(Gs-et);for(let o=1;o<Ze;o+=1)fi[o]=fi[o-1]+.5*(re[o-1]+re[o])*Is;function lf(o){if(o<=Gs)return re[0];if(o>=xr)return re[Ze-1];const t=(o-Gs)/Is,e=Math.min(Ze-2,t|0);return re[e]+(t-e)*(re[e+1]-re[e])}function Bi(o){if(o<=Gs)return re[0]*(o-et);if(o>=xr)return fi[Ze-1]+re[Ze-1]*(o-xr);const t=(o-Gs)/Is,e=Math.min(Ze-2,t|0),s=(t-e)*Is;return fi[e]+re[e]*s+.5*(re[e+1]-re[e])*s*s/Is}const wc=o=>1e3*Hr*o*Math.exp(li*o),_c=o=>1e3*yc*Math.pow(o,ai+1),Fc=Qt.dHsol.v/Be+Mi(Ae)-1e3*Hr*Bi(Ae);function af(o,t){return t>0?(1-t)*kt(o)+t*Fc+wc(t)*Bi(o)+_c(t)*(o-et):kt(o)}function Q0(o,t){return t>0?(1-t)*Ge(o)+wc(t)*lf(o)+_c(t):Ge(o)}function Z0(o,t,e){if(!(t>0))return Oa(o);const s=wc(t),n=_c(t),i=t*Fc,r=1-t;let c=e>200&&e<900?e:et+(o-i)/(4e3*r+800*t);for(let l=0;l<30;l+=1){const u=(r*kt(c)+i+s*Bi(c)+n*(c-et)-o)/(r*Ge(c)+s*lf(c)+n);if(c-=u,Math.abs(u)<1e-8)break}return c}function Vc(o,t){const e=Math.exp(li*t),s=1e3*Hr*e*(t+(1-t)*(1+li*t)),n=t>0?1e3*yc*Math.pow(t,ai)*(t+(1-t)*(ai+1)):0;return Fc+s*Bi(o)+n*(o-et)}const J0=Qt.diffusivity.v,tu=js(Ae);function Oo(o){return J0*(o/Ae)*tu/js(o)}function gn(o,t){return t>0?kt(o)-1e3*Hr*li*t*t*Math.exp(li*t)*Bi(o)-1e3*yc*ai*Math.pow(t,ai+1)*(o-et):kt(o)}var Aa;const je=[{id:"NaCl",rho:xc,cp:gs,color:((Aa=Gr[0])==null?void 0:Aa.color)??"#f4f3ee",dissolves:!0,repose:34}];function ff(o){return je.findIndex(t=>t.id===o)}const eu=.58,su=5e-4;class nu{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"m");v(this,"m0");v(this,"N");v(this,"T");v(this,"mat");v(this,"dry");v(this,"wet");v(this,"id");this.cap=t,this.x=new Float64Array(t),this.y=new Float64Array(t),this.vx=new Float64Array(t),this.vy=new Float64Array(t),this.m=new Float64Array(t),this.m0=new Float64Array(t),this.N=new Float64Array(t),this.T=new Float64Array(t),this.mat=new Uint8Array(t),this.dry=new Uint8Array(t),this.wet=new Float64Array(t),this.id=new Uint32Array(t)}add(t,e,s,n,i,r){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.m[c]=s,this.m0[c]=s,this.N[c]=n,this.T[c]=i,this.mat[c]=r,this.dry[c]=1,this.wet[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,c}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.m[t]=this.m[e],this.m0[t]=this.m0[e],this.N[t]=this.N[e],this.T[t]=this.T[e],this.mat[t]=this.mat[e],this.dry[t]=this.dry[e],this.wet[t]=this.wet[e],this.id[t]=this.id[e]),this.count=e}rho(t){return je[this.mat[t]].rho}cp(t){return je[this.mat[t]].cp}diameter(t){return Math.cbrt(6*this.m[t]/(this.N[t]*Math.PI*this.rho(t)))}enthalpy(t){return this.m[t]*this.cp(t)*(this.T[t]-et)}totals(){let t=0,e=0;for(let s=0;s<this.count;s+=1)je[this.mat[s]].dissolves&&(t+=this.m[s]),e+=this.enthalpy(s);return{salt:t,energy:e}}clear(){this.count=0}}const Eo="recreatio/lab2d",iu=o=>o==="ask"||o==="compute"||o==="normalize",ru={"very-high":.001,high:.002,medium:.003},ou=o=>o==="very-high"||o==="high"||o==="medium",cu=16e4,Sn=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function Nn(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const _t=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Et=(o,t,e)=>Math.min(e,Math.max(t,o)),Ms=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},Ei=(o,t)=>o==="wall"||o==="open"?o:t,Hc=.25*Nr,Jr=2*Nr;function $c(o){const t={};let e=0;for(const[s,n]of Object.entries(Ms(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function lu(o,t,e){const s=Ms(o),n=et+_t(s.T,20),i=r=>{const c=typeof s.material=="string"?s.material:r;return un(c)>=0?c:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Ws(s.region);if(r===null)break;const c=s.phase==="gas"?"gas":"liquid",l=$c(s.composition),a=d=>c==="gas"?d==="N2"||d==="O2"||d==="H2O":Ua(d)>=0||tf(d)>=0,u={};for(const[d,m]of Object.entries(l))a(d)?u[d]=m:t.push(`ops[${e}]: unknown ${c} "${d}" dropped`);const f=Object.keys(u).length>0?$c(u):c==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:c,T:n,composition:f}}case"erase":{const r=Ws(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Et(_t(s.dx,0),-1,1),c=Et(_t(s.dy,0),-1,1),l=Nn(s.id);if(l!=="")return{op:"move",region:null,id:l,dx:r,dy:c};const a=Ws(s.region);if(a===null)break;return{op:"move",region:a,id:null,dx:r,dy:c}}case"remove":{const r=Nn(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=Ws(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:Nn(s.id),x:_t(s.x,.1),y:_t(s.y,0),w:Et(_t(s.w,.07),.01,1),h:Et(_t(s.h,.09),.01,1),wall:Et(_t(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Et(_t(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:Nn(s.id),x:_t(s.x,.1),y:_t(s.y,0),w:Et(_t(s.w,.12),.005,1),h:Et(_t(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Et(_t(s.power,40),0,2e3),target:et+Et(_t(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Et(_t(s.angle,0),-180,180)};case"body":{const r=Ws(s.region);if(r===null)break;return{op:"body",id:Nn(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Et(_t(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:_t(s.x,0),y:_t(s.y,0),pinned:s.pinned!==!1};case"grains":{const r=Ws(s.region);if(r===null)break;const c=typeof s.material=="string"&&ff(s.material)>=0;return s.material!==void 0&&!c&&t.push(`ops[${e}]: unknown grains "${String(s.material)}", using NaCl`),{op:"grains",region:r,material:c?s.material:"NaCl",d:Et(_t(s.d,su),5e-5,.005),T:n}}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function uf(o,t,e=new Set){const s=new Set(e);for(const i of o)Sn(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function au(o,t){const e=new Set;for(const r of o)Sn(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>uf([],r,new Set([...s,...e])),i=[];return o.forEach((r,c)=>{if(Sn(r)){let l=r.id;if(l==="")l=n(r.op);else if(s.has(l)){const a=n(r.op);t.push(`ops[${c}]: the name "${l}" is used twice, renamed to "${a}"`),l=a}s.add(l),i.push({...r,id:l});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const l=r.id;if(!s.has(l)){t.push(`ops[${c}]: no object "${l}" before this step`);return}}i.push(r)}),i}function sr(o,t={}){const e=Ms(o),s=[];e.format!==void 0&&e.format!==Eo&&s.push(`format "${String(e.format)}" is not ${Eo}`);const n=Ms(e.box),i=Ms(e.ambient),r=Ms(i.air),c=Ms(e.sides),l=_t(i.g,Nr),a=t.harness===!0?Et(l,0,Jr):Et(l,Hc,Jr);a!==l&&s.push(`ambient.g ${l} m/s² is outside ${Hc.toFixed(2)}–${Jr.toFixed(2)}, using ${a.toFixed(2)}`);const u=_t(r.N2,.7676),f=_t(r.O2,.2324),d=u+f>0?u+f:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((h,g)=>{const x=lu(h,s,g);x!==null&&m.push(x)});const p=au(m,s);return{scene:{seed:Math.floor(_t(e.seed,1))>>>0,box:{w:Et(_t(n.w,.2),.02,.6),h:Et(_t(n.h,.15),.02,.4),depth:Et(_t(n.depth,.01),.002,.05)},ambient:{p:Et(_t(i.p,ei/1e3),20,400)*1e3,T:et+Et(_t(i.T,20),-20,100),rh:Et(_t(i.rh,.5),0,1),g:a,air:{N2:Math.max(0,u)/d,O2:Math.max(0,f)/d}},sides:{left:Ei(c.left,"wall"),right:Ei(c.right,"wall"),bottom:Ei(c.bottom,"wall"),top:Ei(c.top,"open")},quality:ou(e.quality)?e.quality:"high",extremes:iu(e.extremes)?e.extremes:"ask",ops:p},warnings:s}}const Nt=(o,t=6)=>Number(o.toFixed(t));function fu(o){switch(o.op){case"fill":return{op:"fill",region:Ks(o.region),composition:{...o.composition},phase:o.phase,T:Nt(o.T-et,3)};case"erase":return{op:"erase",region:Ks(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:Nt(o.dx),dy:Nt(o.dy)}:{op:"move",region:Ks(o.region),dx:Nt(o.dx),dy:Nt(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:Ks(o.region),material:o.material,T:Nt(o.T-et,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:Nt(o.T-et,3),...o.lid?{lid:!0}:{},...Wc(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:Nt(o.target-et,3),on:o.on,T:Nt(o.T-et,3),...Wc(o)};case"body":return{op:"body",id:o.id,region:Ks(o.region),material:o.material,T:Nt(o.T-et,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:Nt(o.angle,4)}:{}};case"pin":return{op:"pin",x:Nt(o.x),y:Nt(o.y),pinned:o.pinned};case"grains":return{op:"grains",region:Ks(o.region),material:o.material,d:Nt(o.d,7),T:Nt(o.T-et,3)}}}const Wc=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:Nt(o.angle,4)}:{}});function df(o){return{format:Eo,version:1,seed:o.seed,box:{...o.box},ambient:{p:Nt(o.ambient.p/1e3,4),T:Nt(o.ambient.T-et,3),rh:o.ambient.rh,g:Nt(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(fu)}}function uu(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,c)=>(r[0]-i[0])*(c[1]-i[1])-(r[1]-i[1])*(c[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const du=1e-6;function me(o){var t;return((t=ht[o])==null?void 0:t.id)==="ice"?ne:NaN}function Ls(o){return me(o)>0?kt(ne)-ht[o].cp*(ne-et)-gc:0}function Ro(o,t,e,s){return(o+e*gs)*(s-et)+t*kt(s)}function Pc(o,t,e,s,n){const i=t+s*gs;if(!(i>0))return n;if(e<=0)return et+o/i;let r=n>100?n:et+o/i;for(let c=0;c<3;c+=1)r-=(i*(r-et)+e*kt(r)-o)/(i+e*Ge(r));return r}class jt{constructor(t,e,s,n){v(this,"mat",0);v(this,"heater",-1);v(this,"nr",0);v(this,"xs",[]);v(this,"ys",[]);v(this,"ni",new Int32Array(0));v(this,"nj",new Int32Array(0));v(this,"off",new Int32Array(0));v(this,"ncell",0);v(this,"E",new Float64Array(0));v(this,"film",new Float64Array(0));v(this,"crust",new Float64Array(0));v(this,"x",0);v(this,"y",0);v(this,"a",0);v(this,"vx",0);v(this,"vy",0);v(this,"w",0);v(this,"ux",0);v(this,"uy",0);v(this,"uw",0);v(this,"m",0);v(this,"I",0);v(this,"ma",0);v(this,"Ia",0);v(this,"ma6",new Float64Array(6));v(this,"maOk",!1);v(this,"pinned",!0);v(this,"asleep",!0);v(this,"gone",!1);v(this,"rest",0);v(this,"rx",0);v(this,"ry",0);v(this,"ra",0);v(this,"rmax",0);v(this,"hullA",0);v(this,"hullJ",0);v(this,"nseg",0);v(this,"segR",new Int32Array(0));v(this,"segS",new Uint8Array(0));v(this,"segT0",new Float64Array(0));v(this,"segT1",new Float64Array(0));v(this,"nw",0);v(this,"wk",new Int32Array(0));v(this,"wc",new Int32Array(0));v(this,"ww",new Float64Array(0));v(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,c,l=-1){const a=new jt(t,e,s,n);a.mat=i,a.heater=l;const u=[],f=[];for(const[m,p,h,g]of r)!(h>m)||!(g>p)||(u.push(jt.splits(m,h,s)),f.push(jt.splits(p,g,s)));a.setRects(u,f);const d=ht[i];for(let m=0;m<a.ncell;m+=1)a.E[m]=d.rho*d.cp*a.cellVolume(m)*(c-et);return a.derive(),a.rx=a.x,a.ry=a.y,a.ra=0,a}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=ht[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return Pc(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],c=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[c])continue;let l=0;for(;l<r-1&&t>n[l+1];)l+=1;let a=0;for(;a<c-1&&e>i[a+1];)a+=1;return this.off[s]+l+a*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=Ls(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=ht[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const f=Math.cos(this.a),d=Math.sin(this.a),m=f*e-d*s,p=d*e+f*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const c=[];for(let f=0;f<this.nr;f+=1){const[d,m,p,h]=this.bounds(f),g=p-d,x=h-m,y=t*g*x*this.depth,b=.5*(d+p),_=.5*(m+h);n+=y,i+=y*((g*g+x*x)/12+b*b+_*_);for(const[F,A]of[[d,m],[p,m],[p,h],[d,h]])c.push([F,A]),r=Math.max(r,Math.hypot(F,A))}this.m=n,this.I=i,this.rmax=r;const l=uu(c);let a=0,u=0;for(let f=0;f<l.length;f+=1){const[d,m]=l[f],[p,h]=l[(f+1)%l.length],g=d*h-p*m;a+=g/2,u+=g*(d*d+d*p+p*p+m*m+m*h+h*h)/12}this.hullA=Math.abs(a),this.hullJ=Math.abs(u),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,c,l]=this.bounds(n),a=(c-i)*(l-r);e+=a,s+=a*(t===0?.5*(i+c):.5*(r+l))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=du*this.dx;for(let r=0;r<this.nr;r+=1){const[c,l,a,u]=this.bounds(r);for(let f=0;f<4;f+=1){const d=f<2,m=f===0?c:f===1?a:f===2?l:u;let p=[d?[l,u]:[c,a]];for(let h=0;h<this.nr&&p.length>0;h+=1){if(h===r)continue;const[g,x,y,b]=this.bounds(h);if(!(f===0?Math.abs(y-m)<=i:f===1?Math.abs(g-m)<=i:f===2?Math.abs(b-m)<=i:Math.abs(x-m)<=i))continue;const F=d?x:g,A=d?b:y,P=[];for(const[w,k]of p){if(A<=w||F>=k){P.push([w,k]);continue}F>w&&P.push([w,F]),A<k&&P.push([A,k])}p=P}for(const[h,g]of p)g-h<=i||(t.push(r),e.push(f),s.push(h),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),c=this.segS[t],l=this.segT0[t],a=this.segT1[t];c===0?(e[0]=s,e[1]=l,e[2]=s,e[3]=a,e[4]=-1,e[5]=0):c===1?(e[0]=i,e[1]=l,e[2]=i,e[3]=a,e[4]=1,e[5]=0):c===2?(e[0]=l,e[1]=n,e[2]=a,e[3]=n,e[4]=0,e[5]=-1):(e[0]=l,e[1]=r,e[2]=a,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const c=Math.cos(s),l=Math.sin(s),a=n-t,u=i-e;r[0]=c*a+l*u,r[1]=-l*a+c*u}static toWorld(t,e,s,n,i,r){const c=Math.cos(s),l=Math.sin(s);r[0]=t+c*n-l*i,r[1]=e+l*n+c*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,c=this.y-e;this.x=t+n*r-i*c,this.y=e+i*r+n*c,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let c=1/0,l=1/0,a=-1/0,u=-1/0;for(let f=0;f<this.nr;f+=1){const[d,m,p,h]=this.bounds(f);for(let g=0;g<4;g+=1){const x=g===0||g===3?d:p,y=g<2?m:h,b=t+i*x-r*y,_=e+r*x+i*y;b<c&&(c=b),b>a&&(a=b),_<l&&(l=_),_>u&&(u=_)}}n[0]=c,n[1]=l,n[2]=a,n[3]=u}}const Ri=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function ui(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const ie=[0,120],kc=.3;ht.map(o=>ui(o.color));var Sa;ui(((Sa=Gr[0])==null?void 0:Sa.color)??"#f4f3ee");const hf=new Set([".e.bubbleModel.Fm",".e.bubbleModel.alphaTarget",".e.bubbleModel.budget",".e.bubbleModel.cells",".e.bubbleModel.dTb",".e.bubbleModel.head",".e.bubbleModel.next",".e.bubbleModel.tsatCell",".e.bubbleModel.wts",".e.exchange.cap",".e.exchange.capA",".e.exchange.capT",".e.exchange.cell",".e.exchange.cpp",".e.exchange.ds",".e.exchange.fH",".e.exchange.fS",".e.exchange.hs",".e.exchange.inH",".e.exchange.inS",".e.exchange.outH",".e.exchange.outS",".e.exchange.salt",".e.exchange.water",".e.gas.R.stack",".e.gas.queue",".e.gas.seen",".e.gas.gasU",".e.gas.gasV",".e.gas.lim",".e.gas.mover.conc",".e.gas.mover.fu",".e.gas.mover.fv",".e.gas.mover.outM",".e.gas.mover.scale",".e.gas.mu",".e.gas.nmol",".e.gas.u0",".e.gas.u1",".e.gas.v0",".e.gas.v1",".e.gas.veos",".e.gas.veosMid",".e.grid.Cl",".e.grid.Sg",".e.grid.Sl",".e.grid.Tl",".e.grid.phi",".e.grid.region",".e.grid.thin",".e.heat.C",".e.heat.CKo",".e.heat.CTl",".e.heat.Cg",".e.heat.Co",".e.heat.Cs",".e.heat.Tnew",".e.heat.Tstar",".e.heat.dE",".e.heat.gx",".e.heat.gy",".e.heat.k",".e.heat.q",".e.liquid.knownU",".e.liquid.knownV",".e.liquid.markU",".e.liquid.markV",".e.liquid.mu",".e.liquid.mv",".e.liquid.pGas",".e.liquid.pu",".e.liquid.pv",".e.liquid.rv",".e.liquid.solver.bs",".e.liquid.solver.levels.0.act",".e.liquid.solver.levels.0.area",".e.liquid.solver.levels.0.ax",".e.liquid.solver.levels.0.ay",".e.liquid.solver.levels.0.b",".e.liquid.solver.levels.0.band",".e.liquid.solver.levels.0.dDx",".e.liquid.solver.levels.0.dDy",".e.liquid.solver.levels.0.dH",".e.liquid.solver.levels.0.diag",".e.liquid.solver.levels.0.eDx",".e.liquid.solver.levels.0.eDy",".e.liquid.solver.levels.0.gDx",".e.liquid.solver.levels.0.gDy",".e.liquid.solver.levels.0.gx",".e.liquid.solver.levels.0.gy",".e.liquid.solver.levels.0.ox",".e.liquid.solver.levels.0.oy",".e.liquid.solver.levels.0.r",".e.liquid.solver.levels.0.x",".e.liquid.solver.levels.1.pIdx",".e.liquid.solver.levels.1.pW",".e.liquid.solver.levels.2.pIdx",".e.liquid.solver.levels.2.pW",".e.liquid.solver.nullId",".e.liquid.solver.p",".e.liquid.solver.q",".e.liquid.solver.rj",".e.liquid.solver.stack",".e.liquid.solver.xs",".e.liquid.solver.zj",".e.liquid.tmpU",".e.liquid.tmpV",".e.liquid.vsolver",".e.liquid.wt",".e.phase.Cl",".e.phase.Fe",".e.phase.Fm",".e.phase.Tl",".e.phase.Y0",".e.phase.acc",".e.phase.accAll",".e.phase.accH",".e.phase.accMat",".e.phase.accS",".e.phase.aw",".e.phase.bG",".e.phase.bY",".e.phase.dm",".e.phase.edge",".e.phase.fed",".e.phase.hnC",".e.phase.hoC",".e.phase.host",".e.phase.hvC",".e.phase.mol",".e.phase.mtot",".e.phase.rd",".e.prevKind",".e.melt.head",".e.melt.next",".e.melt.water.sg",".e.bodies.cover.work.gF",".e.bodies.cover.work.gK",".e.bodies.cover.work.restF",".e.bodies.cover.work.restK",".e.grainFlow.head",".e.grainFlow.next",".e.grainFlow.px",".e.grainFlow.py",".e.grainFlow.rad",".e.grainFlow.w",".e.grainFlow.vel",".e.grainFlow.hit",".e.grainFlow.lm",".e.grainFlow.lmT",".e.grainFlow.lv",".e.grainFlow.loc",".e.grainSalt.head",".e.grainSalt.next",".e.grainSalt.gHead",".e.grainSalt.gNext",".e.grainSalt.vel",".e.heat.Cgr",".e.heat.CTgr",".e.bodies.forces.pe",".e.bodies.forces.re",".e.bodies.forces.known",".e.bodies.forces.mass",".e.bodies.forces.vol",".e.bodies.forces.out",".e.bodies.forces.front",".e.bodies.forces.next",".e.bodies.forces.vp",".e.bodies.forces.vr",".e.bodies.forces.queued",".e.bodies.forces.tag",".e.bodies.contacts.parts",".e.bodies.contacts.byBody",".e.bodies.contacts.builtFor",".e.bodies.contacts.cache",".e.bodies.contacts.live",".e.bodies.contacts.liveKey",".e.bodies.contacts.touching",".e.bodies.contacts.toWake",".e.bodies.hitOut",".e.bodies.dv",".e.bodies.probeS",".e.bodies.probeJ",".e.bodies.m9",".e.liquid.hit",".e.liquid.escaped"]),hu=new Set([".e.timings",".e.stamp",".e.stepMs",".e.warnings"]),Ii={Float64Array:o=>new Float64Array(o),Float32Array:o=>new Float32Array(o),Int32Array:o=>new Int32Array(o),Uint32Array:o=>new Uint32Array(o),Int16Array:o=>new Int16Array(o),Uint16Array:o=>new Uint16Array(o),Int8Array:o=>new Int8Array(o),Uint8Array:o=>new Uint8Array(o),Uint8ClampedArray:o=>new Uint8ClampedArray(o)},mf=o=>ArrayBuffer.isView(o)&&!(o instanceof DataView);function Io(o){return o===null||typeof o!="object"?typeof o!="function":Array.isArray(o)?o.every(Io):Object.getPrototypeOf(o)!==Object.prototype?!1:Object.values(o).every(Io)}const mu=o=>JSON.parse(o,(t,e)=>{if(e!==null&&typeof e=="object"&&typeof e.$n=="string"){const s=e.$n;return s==="-0"?-0:Number(s)}return e});function Ac(o,t,e,s,n){var r;if(e.has(o))return;e.add(o);const i=o;for(const c of Object.keys(i)){if(((r=Object.getOwnPropertyDescriptor(i,c))==null?void 0:r.get)!==void 0)continue;const l=`${t}.${c}`,a=i[c];if(n.has(l)||hu.has(l)){a!==null&&typeof a=="object"&&e.add(a);continue}if(typeof a!="function")if(mf(a)){if(e.has(a))continue;e.add(a),s.typed(i,c,l,a)}else a instanceof Map?s.map(i,c,l,a):a!==null&&typeof a=="object"&&!Io(a)?Ac(a,l,e,s,n):s.prim(i,c,l,a)}}function pu(o){let t=2166136261,e=16777619;for(let s=0;s<o.length;s+=1){const n=o.charCodeAt(s);t=Math.imul(t^n,16777619)>>>0,e=Math.imul(e^n+40503,16777619)>>>0}return`${t.toString(16).padStart(8,"0")}${e.toString(16).padStart(8,"0")}`}function bu(o,t){const e=[];return Ac(o,"",new Set,{typed:(s,n,i)=>e.push(i),prim:(s,n,i)=>e.push(i),map:(s,n,i)=>e.push(i)},t),e}function pf(o,t=hf){return pu([...bu(o,t)].sort().join(`
`))}const gu=o=>new Uint8Array(o.buffer,o.byteOffset,o.byteLength);function vu(o){const t=new DataView(o.buffer,o.byteOffset,o.byteLength).getUint32(0,!0);return{head:mu(new TextDecoder().decode(o.subarray(4,4+t))),at:4+t+(8-(4+t)%8)%8}}function xu(o,t,e=hf){const{head:s,at:n}=vu(t);if(pf(o,e)!==s.layout)throw new Error("snapshot: the engine is built differently");const r=new Float64Array(t.slice(n,n+8*s.nums).buffer),c=new Map;let l=n+8*s.nums;const a={t:0,n:0,j:0,m:0};s.paths.forEach((f,d)=>{var h;const m=s.kinds[d],p=a[m];if(a[m]+=1,c.set(f,{kind:m,index:p,offset:l}),m==="t"){const[g,,x]=s.typed[p];l+=x*(((h=Ii[g])==null?void 0:h.call(Ii,0).BYTES_PER_ELEMENT)??1)}});const u=(f,d,m,p)=>{const h=c.get(m);if(h===void 0)throw new Error(`snapshot: nothing stored for ${m}`);if(h.kind==="t"){const[g,x,y]=s.typed[h.index];let b=mf(p)?p:null;if(b===null||b.length!==x||b.constructor.name!==g){const _=Ii[g];if(_===void 0)throw new Error(`snapshot: unknown array ${g} at ${m}`);b=_(x),f[d]=b}gu(b).set(t.subarray(h.offset,h.offset+y*b.BYTES_PER_ELEMENT))}else if(h.kind==="n")f[d]=r[h.index];else if(h.kind==="j"){const g=s.json[h.index];f[d]=g!==null&&typeof g=="object"&&g.u===1?void 0:structuredClone(g)}else{const g=f[d];if(!(g instanceof Map))throw new Error(`snapshot: no map at ${m}`);g.clear();for(const[x,y]of s.maps[h.index]??[])g.set(x,y)}};Ac(o,"",new Set,{typed:(f,d,m,p)=>u(f,d,m,p),prim:(f,d,m,p)=>u(f,d,m,p),map:(f,d,m,p)=>u(f,d,m,p)},e)}const yu="recreatio/lab2d-clip",wu=2;function bf(o,t,e=null){const s=o.engine??"cpu";return{key:o.key,duration:o.duration,seconds:o.seconds,frames:o.frames,fps:o.fps,bytes:o.bytes,created:o.created,bakeMs:o.bakeMs,quality:o.quality,resumable:o.layout===t,exact:s==="cpu"&&o.exact!==!1,engine:s,samples:o.samples,alt:e===null?null:bf(e,t)}}function _u(o){return df(sr(o).scene)}async function Kc(o,t="cpu"){const e=`${yu}/${wu}${t==="gpu"?"/gpu":""}
${JSON.stringify(o)}`,s=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return[...new Uint8Array(s)].map(n=>n.toString(16).padStart(2,"0")).join("")}const gf=(o,t)=>({e:o,charts:t}),Fu=16,Pu=6e8;function zc(){const o=new Map,t=new Map;return{header:async e=>o.get(e)??null,chunk:async(e,s)=>t.get(`c:${e}:${s}`)??null,keyframe:async(e,s)=>t.get(`k:${e}:${s}`)??null,save:async(e,s,n)=>{o.set(e.key,e),s.forEach((i,r)=>t.set(`c:${e.key}:${r}`,i)),n.forEach((i,r)=>t.set(`k:${e.key}:${r}`,i))},touch:async e=>{const s=o.get(e);s!==void 0&&(s.used=Date.now())},remove:async e=>{o.delete(e);for(const s of[...t.keys()])s.includes(`:${e}:`)&&t.delete(s)}}}const ku="recreatio-lab2d";function Yc(o){return new Promise((t,e)=>{o.onsuccess=()=>t(o.result),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function to(o){return new Promise((t,e)=>{o.oncomplete=()=>t(),o.onabort=()=>e(o.error??new Error("IndexedDB: aborted")),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function Au(){return new Promise((o,t)=>{const e=indexedDB.open(ku,1);e.onupgradeneeded=()=>{const s=e.result;s.objectStoreNames.contains("clips")||s.createObjectStore("clips",{keyPath:"key"}),s.objectStoreNames.contains("chunks")||s.createObjectStore("chunks"),s.objectStoreNames.contains("keys")||s.createObjectStore("keys")},e.onsuccess=()=>o(e.result),e.onerror=()=>t(e.error??new Error("IndexedDB")),e.onblocked=()=>t(new Error("IndexedDB: blocked"))})}async function Su(){if(typeof indexedDB>"u")return zc();let o;try{o=await Au()}catch{return zc()}const t=async(i,r)=>Yc(o.transaction(i,"readonly").objectStore(i).get(r)),e=i=>i instanceof Uint8Array?i:i instanceof ArrayBuffer?new Uint8Array(i):null,s=async(i,r,c)=>{const l=o.transaction(["clips","chunks","keys"],"readwrite");l.objectStore("clips").delete(i);for(let a=0;a<r;a+=1)l.objectStore("chunks").delete(`${i}:${a}`);for(let a=0;a<c;a+=1)l.objectStore("keys").delete(`${i}:${a}`);await to(l)},n={header:async i=>await t("clips",i)??null,chunk:async(i,r)=>e(await t("chunks",`${i}:${r}`)),keyframe:async(i,r)=>e(await t("keys",`${i}:${r}`)),save:async(i,r,c)=>{const l=await n.header(i.key);l!==null&&await s(l.key,l.chunkBytes.length,l.keyframes.length);const a=await Yc(o.transaction("clips","readonly").objectStore("clips").getAll());a.sort((m,p)=>m.used-p.used);let u=a.length+1,f=a.reduce((m,p)=>m+p.bytes,0)+i.bytes;for(const m of a){if(u<=Fu&&f<=Pu)break;await s(m.key,m.chunkBytes.length,m.keyframes.length),u-=1,f-=m.bytes}const d=o.transaction(["clips","chunks","keys"],"readwrite");r.forEach((m,p)=>d.objectStore("chunks").put(m,`${i.key}:${p}`)),c.forEach((m,p)=>d.objectStore("keys").put(m,`${i.key}:${p}`)),d.objectStore("clips").put(i),await to(d)},touch:async i=>{const r=await n.header(i);if(r===null)return;const c=o.transaction("clips","readwrite");c.objectStore("clips").put({...r,used:Date.now()}),await to(c)},remove:async i=>{const r=await n.header(i);r!==null&&await s(i,r.chunkBytes.length,r.keyframes.length)}};return n}class vf{constructor(t){v(this,"e");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.e=t}vapour(){const t=this.e;return t.phase.produced-t.phase.condensed+t.bubbleModel.burstVapour}mark(t){const e=this.e,s=e.measureBudget(),n=kt(t);let i=0;const r=e.particles;for(let c=0;c<r.count;c+=1)i+=r.mass[c]*(r.h[c]-n);return{t:e.time,heater:e.flows.heater,solids:s.solids,sens:i,SG:e.heat.fluxSG,LG:e.heat.fluxLG,lossS:e.heat.lossSolids,bub:s.bubbles,vap:this.vapour()}}sample(){const t=this.e,e=St(t.regions.pAmb),s=hc(e),n=t.waterTemperature(),i=t.measureBudget(),r=t.flows,c=this.mark(e),l=this.last;let a=0,u=0;if(l!==null&&c.t>l.t){const m=c.t-l.t,p=(c.heater-l.heater)/m,h=(c.solids-l.solids+c.SG-l.SG+c.lossS-l.lossS+c.LG-l.LG+c.sens-l.sens+c.bub-l.bub)/m;a=(c.vap-l.vap)/m,u=Math.max(0,(p-h)/s)}this.last=c;const f=this.vapour()*s,d=i.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=d),{t:t.time,waterT:n.mean,waterTmax:n.max,Tsat:e,heater:r.heater,latent:f-this.latent0,sensible:d-this.stored0-(f-this.latent0),losses:r.lossWalls+r.lossOpen,escaped:r.escapedEnergy,liquid:i.water.liquid,vapour:i.water.vapour,fog:i.water.fog,film:i.water.film,bubbles:i.water.bubbles,escapedWater:i.water.escaped,vapourRate:a,expectedRate:u}}}const Tu=.004,Mu=.02,Ni=1e-7,Bu=.22,Cu=2.5;class Lu{constructor(t,e){v(this,"nx",0);v(this,"ny",0);v(this,"count",0);v(this,"points",[Xc(),Xc()]);v(this,"friction");v(this,"bounce");v(this,"touched",!0);v(this,"k11",0);v(this,"k12",0);v(this,"k22",0);v(this,"i11",0);v(this,"i12",0);v(this,"i22",0);v(this,"block",!1);v(this,"h",1/120);v(this,"slop",Tu);v(this,"spec",Mu);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function Xc(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function qu(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?Ou(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?Qc(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?Qc(o,e,t,!0):Eu(o,t,e);for(let c=0;c<o.count;c+=1){const l=o.points[c];l.jn=0,l.jt=0;for(let a=0;a<r;a+=1)if(s[a]===l.id){l.jn=n[a],l.jt=i[a];break}}return o.count}function yr(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function Ou(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,c=Math.hypot(i,r);if(c>s+n+o.spec)return;const l=c>1e-9?i/c:0,a=c>1e-9?r/c:1;o.nx=l,o.ny=a,yr(o,t.x+l*(s-(s+n-c)/2),t.y+a*(s-(s+n-c)/2),c-s-n,0)}function Qc(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,c=0;for(let y=0;y<n.n;y+=1){const b=(e.x-t.wx[y])*t.wnx[y]+(e.y-t.wy[y])*t.wny[y];if(b>i+o.spec)return;b>r&&(r=b,c=y)}const l=(c+1)%n.n,a=t.wx[c],u=t.wy[c],f=t.wx[l],d=t.wy[l];let m,p,h,g,x;if(r<1e-9)m=t.wnx[c],p=t.wny[c],x=r-i,h=e.x-m*i,g=e.y-p*i;else{const y=(e.x-a)*(f-a)+(e.y-u)*(d-u),b=(e.x-f)*(a-f)+(e.y-d)*(u-d);if(y<=0||b<=0){const _=y<=0?a:f,F=y<=0?u:d,A=e.x-_,P=e.y-F,w=Math.hypot(A,P);if(w>i+o.spec)return;m=w>1e-9?A/w:t.wnx[c],p=w>1e-9?P/w:t.wny[c],x=w-i,h=_,g=F}else m=t.wnx[c],p=t.wny[c],x=r-i,h=e.x-m*i,g=e.y-p*i}o.nx=s?-m:m,o.ny=s?-p:p,yr(o,h,g,x,c)}function Zc(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const c=o.wnx[r],l=o.wny[r],a=o.wx[r],u=o.wy[r];let f=1/0;for(let d=0;d<s.n;d+=1){const m=(t.wx[d]-a)*c+(t.wy[d]-u)*l;m<f&&(f=m)}f>n&&(n=f,i=r)}return{sep:n,edge:i}}function Eu(o,t,e){const s=Zc(t,e);if(s.sep>o.spec)return;const n=Zc(e,t);if(n.sep>o.spec)return;let i=t,r=e,c=s.edge,l=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,c=n.edge,l=!0);const a=i.shape,u=r.shape;if(a.kind!=="poly"||u.kind!=="poly")return;const f=(c+1)%a.n,d=i.wx[c],m=i.wy[c],p=i.wx[f],h=i.wy[f],g=i.wnx[c],x=i.wny[c];let y=1/0,b=0;for(let I=0;I<u.n;I+=1){const z=r.wnx[I]*g+r.wny[I]*x;z<y&&(y=z,b=I)}const _=(b+1)%u.n;let F=r.wx[b],A=r.wy[b],P=r.wx[_],w=r.wy[_],k=b,S=_;const T=Math.hypot(p-d,h-m)||1,M=(p-d)/T,O=(h-m)/T,q=M*d+O*m,N=M*p+O*h;for(const[I,z]of[[-1,-q],[1,N]]){const G=I*(M*F+O*A)-z,X=I*(M*P+O*w)-z;if(G>Ni&&X>Ni)return;if(G>Ni){const nt=G/(G-X);F+=(P-F)*nt,A+=(w-A)*nt,k=200+c}else if(X>Ni){const nt=G/(G-X);P=F+(P-F)*nt,w=A+(w-A)*nt,S=300+c}}const L=(l?1e4:0)+c*1e3,R=(F-d)*g+(A-m)*x,E=(P-d)*g+(w-m)*x;o.nx=l?-g:g,o.ny=l?-x:x,R<=o.spec&&yr(o,F-g*R/2,A-x*R/2,R,L+k),E<=o.spec&&yr(o,P-g*E/2,w-x*E/2,E,L+S)}function Ru(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,c=-n;for(let l=0;l<o.count;l+=1){const a=o.points[l];a.rax=a.x-e.x,a.ray=a.y-e.y,a.rbx=a.x-s.x,a.rby=a.y-s.y;const u=a.rax*i-a.ray*n,f=a.rbx*i-a.rby*n,d=e.invM+s.invM+e.invI*u*u+s.invI*f*f;a.massN=d>0?1/d:0;const m=a.rax*c-a.ray*r,p=a.rbx*c-a.rby*r,h=e.invM+s.invM+e.invI*m*m+s.invI*p*p;a.massT=h>0?1/h:0,a.bias=a.sep>0?-a.sep/t:Math.min(Cu,Bu/t*Math.max(0,-a.sep-o.slop));const g=s.vx-s.w*a.rby-e.vx+e.w*a.ray,x=s.vy+s.w*a.rbx-e.vy-e.w*a.rax,y=g*n+x*i;a.bounce=y<-.6&&(a.sep<=o.slop||a.sep+y*t<0)?-o.bounce*y:0,(a.kicked||a.bounce>0)&&(a.jn=0,a.jt=0),a.kicked=!1,a.fixed=0}if(o.block=!1,o.count===2){const l=o.points[0],a=o.points[1],u=l.rax*i-l.ray*n,f=l.rbx*i-l.rby*n,d=a.rax*i-a.ray*n,m=a.rbx*i-a.rby*n,p=e.invM+s.invM;o.k11=p+e.invI*u*u+s.invI*f*f,o.k22=p+e.invI*d*d+s.invI*m*m,o.k12=p+e.invI*u*d+s.invI*f*m;const h=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*h&&h>0&&(o.block=!0,o.i11=o.k22/h,o.i12=-o.k12/h,o.i22=o.k11/h)}}function Iu(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];di(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function Nu(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let c=0;c<o.count;c+=1){const l=o.points[c],a=e.vx-e.w*l.rby-t.vx+t.w*l.ray,u=e.vy+e.w*l.rbx-t.vy-t.w*l.rax,f=a*i+u*r,d=o.friction*l.jn,m=Math.max(-d,Math.min(d,l.jt-l.massT*f)),p=m-l.jt;l.jt=m,di(t,e,p*i,p*r,l)}if(o.block){ju(o);return}for(let c=0;c<o.count;c+=1){const l=o.points[c],a=e.vx-e.w*l.rby-t.vx+t.w*l.ray,u=e.vy+e.w*l.rbx-t.vy-t.w*l.rax,f=a*s+u*n;l.bounce===0&&o.bounce>=.5&&f<-.6&&(l.sep<=o.slop||l.sep+f*o.h<0)&&(l.bounce=-o.bounce*f);const d=Math.max(l.jn+l.massN*(-f+No(l)),l.fixed),m=d-l.jn;l.jn=d,di(t,e,m*s,m*n,l),l.bounce>0&&(l.fixed=d,l.bounce=-1,l.kicked=!0)}}const No=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function di(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function ju(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],c=h=>{const g=e.vx-e.w*h.rby-t.vx+t.w*h.ray,x=e.vy+e.w*h.rbx-t.vy-t.w*h.rax;return g*s+x*n},l=i.jn,a=r.jn,u=c(i)-No(i)-(o.k11*l+o.k12*a),f=c(r)-No(r)-(o.k12*l+o.k22*a),d=(h,g)=>{const x=h-l,y=g-a;di(t,e,x*s,x*n,i),di(t,e,y*s,y*n,r),i.jn=h,r.jn=g};let m=-(o.i11*u+o.i12*f),p=-(o.i12*u+o.i22*f);if(m>=0&&p>=0){d(m,p);return}if(m=-u/o.k11,p=0,m>=0&&o.k12*m+f>=0){d(m,p);return}if(m=0,p=-f/o.k22,p>=0&&o.k12*p+u>=0){d(m,p);return}u>=0&&f>=0&&d(0,0)}const Du=10,jn={friction:.5,bounce:.1},Gu=.01;function ys(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),c=new Float64Array([-1,0,1,0]);let l=0;for(let a=0;a<4;a+=1)l=Math.max(l,Math.hypot(n[a],i[a]));return{kind:"poly",xs:n,ys:i,nx:r,ny:c,n:4,radius:l}}class Ys{constructor(t,e,s,n){v(this,"wx");v(this,"wy");v(this,"wnx");v(this,"wny");v(this,"minX",0);v(this,"minY",0);v(this,"maxX",0);v(this,"maxY",0);v(this,"invM",0);v(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let c=1/0,l=1/0,a=-1/0,u=-1/0;for(let f=0;f<t.n;f+=1){const d=s+i*t.xs[f]-r*t.ys[f],m=n+r*t.xs[f]+i*t.ys[f];this.wx[f]=d,this.wy[f]=m,this.wnx[f]=i*t.nx[f]-r*t.ny[f],this.wny[f]=r*t.nx[f]+i*t.ny[f],d<c&&(c=d),d>a&&(a=d),m<l&&(l=m),m>u&&(u=m)}this.minX=c,this.minY=l,this.maxX=a,this.maxY=u}}class Uu{constructor(t){v(this,"parts",[]);v(this,"byBody",[]);v(this,"builtFor",-1);v(this,"warmKey",new Float64Array(0));v(this,"warmData",new Float64Array(0));v(this,"warmCount",0);v(this,"touching",new Uint8Array(0));v(this,"toWake",[]);v(this,"cache",new Map);v(this,"live",[]);v(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,c]=t.bounds(s);e[s].shape=ys(n,i,r,c),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new Ys(1,null,ys(-1,-1,0,r+1),jn)),s.openR||n.push(new Ys(2,null,ys(i,-1,i+1,r+1),jn)),s.openB||n.push(new Ys(3,null,ys(-1,-1,i+1,0),jn)),s.openT||n.push(new Ys(4,null,ys(-1,r,i+1,r+1),jn));const{nx:c,ny:l,dx:a}=s;let u=new Map,f=10;for(let d=0;d<=l;d+=1){const m=new Map;if(d<l){let p=0;for(;p<c;){const h=p+d*c;if(s.solid[h]===0||s.owner[h]!==0){p+=1;continue}const g=s.solid[h];let x=p;for(;x+1<c&&s.solid[x+1+d*c]===g&&s.owner[x+1+d*c]===0;)x+=1;const y=g<<24|p<<12|x;m.set(y,u.has(y)?u.get(y):d),p=x+1}}for(const[p,h]of u){if(m.get(p)===h)continue;const g=this.solidMaterial(p>>>24);n.push(new Ys(f++,null,ys((p>>12&4095)*a,h*a,((p&4095)+1)*a,d*a),g))}u=m}this.byBody=t.map(()=>[]);for(const d of t){if(d.gone)continue;const m=this.solidMaterial(d.mat+1);for(let p=0;p<d.nr;p+=1){const[h,g,x,y]=d.bounds(p),b=ys(h,g,x,y),_=new Ys(1e5+d.index*1e3+p,d,b,m);n.push(_),this.byBody[d.index].push(_)}}for(const d of n)d.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=ht[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:jn}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const u of this.parts){const f=u.body;if(f===null)continue;const d=f.awake;u.invM=d?1/f.m:0,u.invI=d?1/f.I:0,u.update()}for(const u of this.cache.values())u.touched=!1;const r=this.live,c=this.liveKey;r.length=0,c.length=0;const l=this.parts;for(let u=0;u<l.length;u+=1){const f=l[u];for(let d=u+1;d<l.length;d+=1){const m=l[d],p=f.invM>0,h=m.invM>0;if(!p&&!h||f.body!==null&&f.body===m.body||m.minX>f.maxX+i||m.maxX<f.minX-i||m.minY>f.maxY+i||m.maxY<f.minY-i)continue;const g=f.id*1e6+m.id;let x=this.cache.get(g);x===void 0&&(x=new Lu(f,m),x.slop=n,x.spec=i,this.restore(x,g),this.cache.set(g,x)),x.touched=!0,qu(x)>0?(r.push(x),c.push(g)):x.count=0}}const a=c.map((u,f)=>f).sort((u,f)=>c[u]-c[f]);for(const u of a)Ru(r[u],t);for(const u of a)Iu(r[u]);for(let u=0;u<Du;u+=1)for(const f of a)Nu(r[f]);for(const u of a){const f=r[u],d=f.a.body,m=f.b.body;if(d!==null&&(this.touching[d.index]=1),m!==null&&(this.touching[m.index]=1),d!==null&&m!==null&&d.asleep!==m.asleep&&!d.pinned&&!m.pinned){const p=d.asleep?m:d,h=d.asleep?d:m;p.speed()>Gu&&this.toWake.push(h.index)}}for(const[u,f]of this.cache)(!f.touched||f.count===0)&&this.cache.delete(u);this.save(a.map(u=>c[u]),a.map(u=>r[u]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let c=0;c<2;c+=1){const l=i.points[c];this.warmData[r+1+4*c]=l.id,this.warmData[r+2+4*c]=l.jn,this.warmData[r+3+4*c]=l.jt,this.warmData[r+4+4*c]=l.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const c=9*i;t.count=this.warmData[c];for(let l=0;l<2;l+=1){const a=t.points[l];a.id=this.warmData[c+1+4*l],a.jn=this.warmData[c+2+4*l],a.jt=this.warmData[c+3+4*l],a.kicked=this.warmData[c+4+4*l]===1}return}r<e?s=i+1:n=i-1}}}class Vu{constructor(t){v(this,"gF");v(this,"gK");v(this,"seen");v(this,"restF",new Float64Array(8));v(this,"restK",new Float64Array(8));v(this,"tag",0);this.gF=new Float64Array(t),this.gK=new Float64Array(t),this.seen=new Int32Array(t)}}const eo=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function so(o,t){eo[o].length<t&&(eo[o]=new Float64Array(2*t));const e=eo[o];return e.fill(0,0,t),e}function Hu(o,t,e,s,n){const{gF:i,gK:r,seen:c}=n;for(const f of t)if(!(f.gone||f.nw===0))for(let d=0;d<f.nw;d+=1)i[f.wc[d]]=0,r[f.wc[d]]=0;for(const f of t)if(!(f.gone||f.nw===0))for(let d=0;d<f.nw;d+=1){const m=f.wc[d];i[m]+=f.ww[d]*f.film[f.wk[d]],r[m]+=f.ww[d]*f.crust[f.wk[d]]}n.restF.length<t.length&&(n.restF=new Float64Array(2*t.length),n.restK=new Float64Array(2*t.length));const l=n.restF,a=n.restK;l.fill(0),a.fill(0);const u=++n.tag;for(const f of t)if(!(f.gone||f.nw===0))for(let d=0;d<f.nw;d+=1){const m=f.wc[d];if(c[m]===u)continue;c[m]=u;const p=o.owner[m]>0?o.owner[m]-1:f.index,h=o.film[m]-e.filmSync[m];h<0&&-h>i[m]&&(l[p]+=-h-i[m]);const g=o.crust[m]-e.crustSync[m];g<0&&-g>r[m]&&(a[p]+=-g-r[m])}for(const f of t){if(f.gone||f.nw===0)continue;const d=s[f.index],m=so(0,f.ncell),p=so(1,f.ncell),h=so(2,f.ncell);let g=l[f.index]>0||a[f.index]>0;for(let b=0;b<f.nw;b+=1){const _=f.wc[b],F=f.wk[b],A=f.ww[b],P=o.Es[_]-e.esSync[_];P!==0&&o.capB[_]>0&&(m[F]+=P*A*d[F]/o.capB[_],g=!0);const w=o.film[_]-e.filmSync[_];w>0&&e.wsum[_]>0?(p[F]+=w*A/e.wsum[_],g=!0):w<0&&i[_]>0&&(p[F]-=Math.min(1,-w/i[_])*A*f.film[F],g=!0);const k=o.crust[_]-e.crustSync[_];k>0&&e.wsum[_]>0?(h[F]+=k*A/e.wsum[_],g=!0):k<0&&r[_]>0&&(h[F]-=Math.min(1,-k/r[_])*A*f.crust[F],g=!0)}if(!g)continue;let x=0,y=0;for(let b=0;b<f.ncell;b+=1)f.E[b]+=m[b],f.film[b]=Math.max(0,f.film[b]+p[b]),f.crust[b]=Math.max(0,f.crust[b]+h[b]),x+=f.film[b],y+=f.crust[b];if(l[f.index]>0&&x>0){const b=Math.max(0,1-l[f.index]/x);for(let _=0;_<f.ncell;_+=1)f.film[_]*=b}if(a[f.index]>0&&y>0){const b=Math.max(0,1-a[f.index]/y);for(let _=0;_<f.ncell;_+=1)f.crust[_]*=b}}for(let f=0;f<o.n;f+=1)o.capB[f]<=0||(e.esSync[f]=o.Es[f],e.filmSync[f]=o.film[f],e.crustSync[f]=o.crust[f])}const Le=new Float64Array(16),qe=new Float64Array(16),ji=new Float64Array(16),Di=new Float64Array(16);function Gi(o,t,e,s,n,i,r,c){let l=0;for(let a=0;a<o;a+=1){const u=(a+1)%o,f=s*((t===0?n[a]:i[a])-e),d=s*((t===0?n[u]:i[u])-e);if(f<=0&&(r[l]=n[a],c[l]=i[a],l+=1),f<0&&d>0||f>0&&d<0){const m=f/(f-d);r[l]=n[a]+m*(n[u]-n[a]),c[l]=i[a]+m*(i[u]-i[a]),l+=1}}return l}function $u(o,t,e,s,n,i,r,c,l,a,u,f){Le[0]=o,qe[0]=t,Le[1]=e,qe[1]=s,Le[2]=n,qe[2]=i,Le[3]=r,qe[3]=c;let d=Gi(4,0,l,-1,Le,qe,ji,Di);if(d===0||(d=Gi(d,0,u,1,ji,Di,Le,qe),d===0)||(d=Gi(d,1,a,-1,Le,qe,ji,Di),d===0)||(d=Gi(d,1,f,1,ji,Di,Le,qe),d<3))return 0;let m=0;for(let p=0;p<d;p+=1){const h=(p+1)%d;m+=Le[p]*qe[h]-Le[h]*qe[p]}return Math.abs(.5*m)}function wr(o,t,e,s,n,i,r,c,l){const a=e-o,u=s-t;return ye[0]=0,ye[1]=1,!Ui(-a,o-n)||!Ui(a,r-o)||!Ui(-u,t-i)||!Ui(u,c-t)?(l[0]=1,l[1]=0,0):(l[0]=ye[0],l[1]=ye[1],Math.max(0,ye[1]-ye[0]))}const ye=new Float64Array(2);function Ui(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>ye[1])return!1;e>ye[0]&&(ye[0]=e)}else{if(e<ye[0])return!1;e<ye[1]&&(ye[1]=e)}return!0}const no=new Float64Array(2),Vi=new Float64Array(16);function Wu(o,t,e,s,n,i,r,c,l,a,u){const f=Math.cos(e),d=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const x=g===0?c:g===1||g===2?a:c,y=g===0||g===1?l:u,b=g===0||g===1?a:c,_=g===0?l:g===1||g===2?u:l,F=f*(x-o)+d*(y-t),A=-d*(x-o)+f*(y-t),P=f*(b-o)+d*(_-t),w=-d*(b-o)+f*(_-t);wr(F,A,P,w,s,n,i,r,no)<=0||(Vi[2*m]=g+no[0],Vi[2*m+1]=g+no[1],m+=1)}if(m<2)return!1;const p=1e-9;let h=m;for(let g=0;g<m;g+=1){const x=(g+1)%m,y=Vi[2*g+1],b=Vi[2*x]+(x===0?4:0);Math.abs(b-y)<=p&&(h-=1)}return h>=2}function Ku(o,t,e){const s=[],n=[];for(const h of o)s.push(h[0],h[2]),n.push(h[1],h[3]);for(const h of t)s.push(h.x0,h.x1),n.push(h.y0,h.y1);for(const h of e)s.push(h.x0,h.x1),n.push(h.y0,h.y1);const i=Jc(s),r=Jc(n),c=i.length-1,l=r.length-1,a=new Uint8Array(Math.max(0,c*l)),u=[],f=[],d=(h,g,x,y,b,_)=>h>x&&h<b&&g>y&&g<_;for(let h=0;h<l;h+=1){const g=.5*(r[h]+r[h+1]);for(let x=0;x<c;x+=1){const y=.5*(i[x]+i[x+1]);let b=!1;for(const F of o)if(d(y,g,F[0],F[1],F[2],F[3])){b=!0;break}let _=-1;if(b){for(const F of t)if(d(y,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0?u.push(i[x],r[h],i[x+1],r[h+1],_):a[x+h*c]=1}else{for(const F of e)if(d(y,g,F.x0,F.y0,F.x1,F.y1)){_=F.move;break}_>=0&&(f.push(i[x],r[h],i[x+1],r[h+1],_),a[x+h*c]=1)}}}const m=[];let p=[];for(let h=0;h<=l;h+=1){const g=[];if(h<l)for(let x=0;x<c;){if(a[x+h*c]===0){x+=1;continue}let y=x;for(;y<c&&a[y+h*c]!==0;)y+=1;const b=p.find(_=>_.i0===x&&_.i1===y);g.push(b??{i0:x,i1:y,y0:r[h]}),x=y}for(const x of p)g.includes(x)||m.push([i[x.i0],x.y0,i[x.i1],r[h]]);p=g}return{rects:m,taken:u,added:f}}function Jc(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const Sc=.99,Tc=.9,tl=.5,zu=.02;class Yu{constructor(t){v(this,"w");v(this,"esSync");v(this,"filmSync");v(this,"crustSync");v(this,"wsum");v(this,"work");v(this,"best");v(this,"acc");v(this,"split");v(this,"was");v(this,"now");v(this,"stamp");v(this,"fstamp");v(this,"tag",0);v(this,"ftag",0);v(this,"seen");v(this,"queue");v(this,"seenTag",0);v(this,"list",new Int32Array(256));v(this,"listN",0);v(this,"box",new Float64Array(4));v(this,"l0",new Float64Array(2));v(this,"l1",new Float64Array(2));v(this,"wp",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"cb",new Float64Array(4));v(this,"areaK",[]);v(this,"capK",[]);v(this,"splits",[]);v(this,"boxes",new Float64Array(64));v(this,"nx",0);v(this,"ny",0);v(this,"faceOwner");v(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.work=new Vu(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let c=this.areaK[t.index],l=this.capK[t.index];(c===void 0||c.length!==t.ncell)&&(c=new Float64Array(t.ncell),l=new Float64Array(t.ncell),this.areaK[t.index]=c,this.capK[t.index]=l);for(let p=0;p<t.ncell;p+=1)c[p]=t.cellVolume(p)/t.depth,l[p]=t.cellCap(p);const a=Math.cos(t.a),u=Math.sin(t.a);let f=0;const d=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,d);const h=d[0],g=d[1],x=d[2],y=d[3],b=t.x+a*h-u*g,_=t.y+u*h+a*g,F=t.x+a*x-u*g,A=t.y+u*x+a*g,P=t.x+a*x-u*y,w=t.y+u*x+a*y,k=t.x+a*h-u*y,S=t.y+u*h+a*y,T=Math.max(0,Math.floor(Math.min(b,F,P,k)/i)),M=Math.min(s-1,Math.floor(Math.max(b,F,P,k)/i)),O=Math.max(0,Math.floor(Math.min(_,A,w,S)/i)),q=Math.min(n-1,Math.floor(Math.max(_,A,w,S)/i));for(let N=O;N<=q;N+=1)for(let L=T;L<=M;L+=1){const R=L+N*s;if(e.solid[R]!==0&&e.owner[R]===0)continue;const E=$u(b,_,F,A,P,w,k,S,L*i,N*i,(L+1)*i,(N+1)*i);E<=1e-12*c[p]||(f>=t.wk.length&&this.growWeights(t,2*f+64),t.wk[f]=p,t.wc[f]=R,t.ww[f]=E/c[p],f+=1)}}t.nw=f;for(let p=0;p<t.nr;p+=1){const h=t.xs[p][0],g=t.ys[p][0],x=t.xs[p][t.ni[p]],y=t.ys[p][t.nj[p]];let b=1/0,_=1/0,F=-1/0,A=-1/0;for(let T=0;T<4;T+=1){const M=T===0||T===3?h:x,O=T<2?g:y,q=t.x+a*M-u*O,N=t.y+u*M+a*O;b=Math.min(b,q),F=Math.max(F,q),_=Math.min(_,N),A=Math.max(A,N)}const P=Math.max(0,Math.floor(b/i)),w=Math.min(s-1,Math.floor(F/i)),k=Math.max(0,Math.floor(_/i)),S=Math.min(n-1,Math.floor(A/i));for(let T=k;T<=S;T+=1)for(let M=P;M<=w;M+=1)Wu(t.x,t.y,t.a,h,g,x,y,M*i,T*i,(M+1)*i,(T+1)*i)&&m.push(M+T*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const c=this.list[r],l=c%t,a=(c-l)/t;l<e&&(e=l),l>n&&(n=l),a<s&&(s=a),a>i&&(i=a)}return[e,s,n,i]}rebuild(t){var A;const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,c=this.list,l=this.listN;if(this.listN=0,l===0)return 0;const a=1/(i*i);let u=s,f=-1,d=n,m=-1;for(let P=0;P<l;P+=1){const w=c[P],k=w%s,S=(w-k)/s;k<u&&(u=k),k>f&&(f=k),S<d&&(d=S),S>m&&(m=S);const T=e.solid[w]!==0&&e.owner[w]===0;this.was[w]=e.solid[w]!==0&&e.owner[w]!==0?1:0,e.fs[w]=0,e.capB[w]=0,this.wsum[w]=0,this.best[w]=0,this.split[w]=0,e.matB[w]=0,T||(e.Es[w]=0,e.film[w]=0,e.crust[w]=0,e.owner[w]=0)}const p=u*i,h=d*i,g=(f+1)*i,x=(m+1)*i;for(const P of t){if(P.gone||P.nw===0)continue;const w=this.boxOf(P);if(w[0]>g||w[2]<p||w[1]>x||w[3]<h)continue;const k=this.areaK[P.index],S=this.capK[P.index],T=this.acc;for(let O=0;O<P.nw;O+=1){const q=P.wc[O];if(this.stamp[q]!==r)continue;const N=P.wk[O],L=P.ww[O],R=L*k[N]*a;e.fs[q]+=R,T[q]+=R,e.capB[q]+=L*S[N],e.Es[q]+=L*P.E[N],e.film[q]+=L*P.film[N],e.crust[q]+=L*P.crust[N],this.wsum[q]+=L}for(let O=0;O<P.nw;O+=1){const q=P.wc[O];this.stamp[q]!==r||T[q]===0||(T[q]>this.best[q]&&(this.best[q]=T[q],e.owner[q]=P.index+1,e.matB[q]=P.mat+1),T[q]=0)}const M=this.splits[P.index];for(let O=0;O<M.length;O+=1)this.stamp[M[O]]===r&&(this.split[M[O]]=1)}const y=++this.ftag;for(let P=0;P<l;P+=1){const w=c[P],k=w%s,S=(w-k)/s;this.face(t,k,S,!0,y),this.face(t,k+1,S,!0,y),this.face(t,k,S,!1,y),this.face(t,k,S+1,!1,y)}for(let P=0;P<l;P+=1){const w=c[P];e.fs[w]>1&&(e.fs[w]=1);const k=e.solid[w]!==0&&e.owner[w]===0&&this.was[w]===0;this.now[w]=!k&&e.owner[w]!==0&&(e.fs[w]>=((A=t[e.owner[w]-1])!=null&&A.free?Tc:Sc)||this.split[w]!==0)?1:0}for(let P=0;P<l;P+=1){const w=c[P];this.now[w]!==0||e.owner[w]===0||e.fs[w]<tl||e.solid[w]!==0&&this.was[w]===0||this.besideOther(w)&&(this.now[w]=1)}let b=0;for(let P=0;P<l;P+=1){const w=c[P];if(this.now[w]===1){this.was[w]===0&&(b+=1,this.gasOut(w));const k=t[e.owner[w]-1];e.solid[w]=k.mat+1,e.kind[w]=pt,e.role[w]=0,e.heater[w]=-1}else this.was[w]===1&&(b+=1,e.solid[w]=0,e.role[w]=0,e.heater[w]=-1,this.vacate(w))}const _=++this.ftag;for(let P=0;P<l;P+=1){const w=c[P],k=w%s,S=(w-k)/s;this.closedFace(t,k,S,!0,_),this.closedFace(t,k+1,S,!0,_),this.closedFace(t,k,S,!1,_),this.closedFace(t,k,S+1,!1,_)}const F=this.w.heat;for(let P=0;P<l;P+=1){const w=c[P];this.esSync[w]=e.Es[w],this.filmSync[w]=e.film[w],this.crustSync[w]=e.crust[w],e.capB[w]>0&&F.deriveSolid(w)}return b}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,c=e.owner[t];for(let l=0;l<4;l+=1){const a=i+(l===0?-1:l===1?1:0),u=r+(l===2?-1:l===3?1:0);if(a<0||u<0||a>=s||u>=n){if(a<0?!e.openL:a>=s?!e.openR:u<0?!e.openB:!e.openT)return!0;continue}const f=a+u*s;if(e.solid[f]!==0&&e.owner[f]===0||e.owner[f]!==0&&e.owner[f]!==c&&(e.solid[f]!==0||e.fs[f]>=tl))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:l,dx:a}=r;if(n?e>c||s>=l:e>=c||s>l)return;const u=n?e+s*(c+1):e+s*c,f=n?u:r.nu+u;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const d=e*a,m=s*a,p=n?d:d+a,h=n?m+a:m;let g=0,x=0,y=0,b=0;const _=this.l0,F=this.l1;for(const w of t){if(w.gone||w.nw===0)continue;const k=this.boxOf(w);if(k[0]>Math.max(d,p)||k[2]<Math.min(d,p)||k[1]>Math.max(m,h)||k[3]<Math.min(m,h))continue;jt.toLocal(w.x,w.y,w.a,d,m,_),jt.toLocal(w.x,w.y,w.a,p,h,F);let S=0;for(let T=0;T<w.nr;T+=1){const M=w.xs[T][0],O=w.ys[T][0],q=w.xs[T][w.ni[T]],N=w.ys[T][w.nj[T]];S+=wr(_[0],_[1],F[0],F[1],M,O,q,N,this.seg)}if(!(S<=0)&&(g+=S,S>x)){x=S,b=w.index+1;const T=.5*(d+p),M=.5*(m+h);y=n?w.ux-w.uw*(M-w.y):w.uy+w.uw*(T-w.x)}}const A=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[u]:r.av[u])>0!=A>0&&(this.topologyChanged=!0),this.faceOwner[f]=b,n?(r.au[u]=A,r.usol[u]=g>0?y:0):(r.av[u]=A,r.vsol[u]=g>0?y:0)}closedFace(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:l,dx:a}=r;if(n?e>c||s>=l:e>=c||s>l)return;const u=n?e+s*(c+1):e+s*c,f=n?u:r.nu+u;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const d=n?e>0?u-1-s:-1:s>0?u-c:-1,m=n?e<c?u-s:-1:s<l?u:-1,p=d>=0&&r.solid[d]!==0;if(p===(m>=0&&r.solid[m]!==0))return;const h=r.owner[p?d:m],g=h>0?t[h-1]:void 0;g===void 0||g.gone||(this.faceOwner[f]=h,n?r.usol[u]=g.ux-g.uw*((s+.5)*a-g.y):r.vsol[u]=g.uy+g.uw*((e+.5)*a-g.x))}collect(t){Hu(this.w.grid,t,this,this.capK,this.work)}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,c=this.w.bubbles,l=this.box;t.worldBox(t.x,t.y,t.a,l);const a=2*i.dx;for(let u=0;u<r.count;u+=1){const f=r.x[u],d=r.y[u];f<l[0]-a||f>l[2]+a||d<l[1]-a||d>l[3]+a||this.moveOut(t,f,d,f,d,e,s,n)&&(r.x[u]=this.wp[0],r.y[u]=this.wp[1],this.stopInto(t,r.vx,r.vy,u))}for(let u=0;u<c.count;u+=1){const f=c.x[u],d=c.y[u];f<l[0]-a||f>l[2]+a||d<l[1]-a||d>l[3]+a||this.moveOut(t,f,d,f,d,e,s,n)&&(c.x[u]=this.wp[0],c.y[u]=this.wp[1],c.site[u]=-1,this.stopInto(t,c.vx,c.vy,u))}}hit(t,e,s,n,i,r){const c=2*this.w.grid.dx;let l=0,a=n,u=i;for(let f=0;f<3;f+=1){let d=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(a,e)<p[0]-c||Math.min(a,e)>p[2]+c||Math.max(u,s)<p[1]-c||Math.min(u,s)>p[3]+c||this.moveOut(m,a,u,e,s,m.x,m.y,m.a)&&(a=this.wp[0],u=this.wp[1],r[0]=a,r[1]=u,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(u-m.y),r[5]=m.vy+m.w*(a-m.x),l=1,d=!0)}if(!d)break}return l}moveOut(t,e,s,n,i,r,c,l){const a=this.l1,u=this.l0;jt.toLocal(t.x,t.y,t.a,e,s,a),jt.toLocal(r,c,l,n,i,u);const f=zu*this.w.grid.dx;let d=1/0,m=-1,p=a[0],h=a[1];for(let w=0;w<t.nr;w+=1){const k=t.xs[w][0],S=t.ys[w][0],T=t.xs[w][t.ni[w]],M=t.ys[w][t.nj[w]],O=k-f,q=S-f,N=T+f,L=M+f,R=a[0]>O&&a[0]<N&&a[1]>q&&a[1]<L;if(wr(u[0],u[1],a[0],a[1],O,q,N,L,this.seg)<=0&&!R)continue;if(u[0]>O&&u[0]<N&&u[1]>q&&u[1]<L){if(R&&d===1/0){const I=el(a[0]-O,N-a[0],a[1]-q,L-a[1]);m=I,p=I===0?O:I===1?N:a[0],h=I===2?q:I===3?L:a[1],d=2}}else{const I=this.seg[0];if(I<d){d=I;const z=u[0]+I*(a[0]-u[0]),G=u[1]+I*(a[1]-u[1]),X=el(Math.abs(z-O),Math.abs(z-N),Math.abs(G-q),Math.abs(G-L));m=X,p=X===0?O:X===1?N:z,h=X===2?q:X===3?L:G}}}if(m<0)return!1;const g=this.w.grid,x=1e-4*g.dx,y=Math.cos(t.a),b=Math.sin(t.a),_=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,A=p+_*x,P=h+F*x;return this.wp[0]=Math.min(g.w-x,Math.max(x,t.x+y*A-b*P)),this.wp[1]=Math.min(g.h-x,Math.max(x,t.y+b*A+y*P)),this.nx=y*_-b*F,this.ny=b*_+y*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,c=t.vx-t.w*r,l=t.vy+t.w*i,a=(e[n]-c)*this.nx+(s[n]-l)*this.ny;a<0&&(e[n]-=a*this.nx,s[n]-=a*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,c=(t-r)/n,l=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let a=0,u=0;for(let g=0;g<4;g+=1){const x=s.across(t,r,c,g);x<0||!l(x)||(a+=s.vgas[x]>0?s.vgas[x]:e.vCell,u+=1)}if(u>0){let g=a;for(let x=0;x<4;x+=1){const y=s.across(t,r,c,x);if(y<0||!l(y))continue;const b=s.vgas[y]>0?s.vgas[y]:e.vCell;u-=1,s.move(t,y,u===0?1:Math.min(1,b/g)),g-=b}return}const f=this.seen,d=this.queue;let m=++this.seenTag,p=0,h=0;for(d[h++]=t,f[t]=m;p<h;){const g=d[p++];if(g!==t&&l(g)){s.move(t,g,1);return}const x=g%n,y=(g-x)/n;for(let b=0;b<4;b+=1){const _=s.across(g,x,y,b);_<0||f[_]===m||e.solid[_]!==0&&e.owner[_]===0||(f[_]=m,d[h++]=_)}}for(m=++this.seenTag,p=0,h=0,d[h++]=t,f[t]=m;p<h;){const g=d[p++];if(g!==t&&l(g)){s.move(t,g,1);return}const x=g%n,y=(g-x)/n;for(let b=0;b<4;b+=1){const _=x+(b===0?-1:b===1?1:0),F=y+(b===2?-1:b===3?1:0);if(_<0||F<0||_>=n||F>=i)continue;const A=_+F*n;f[A]!==m&&(f[A]=m,d[h++]=A)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let c=0,l=0,a=0,u=!1;for(let d=0;d<4;d+=1){const m=s.across(t,i,r,d);if(m<0||(e.kind[m]===rt&&(u=!0),e.kind[m]!==$||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;c+=p,l+=p*s.rho[m],a+=p*e.T[m]}if(c<=0){e.kind[t]=u?rt:$,s.deriveCell(t);return}e.kind[t]=$,e.T[t]=a/c;const f=l/c*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let d=0;d<4;d+=1){const m=s.across(t,i,r,d);if(m<0||e.kind[m]!==$)continue;const p=s.massOf(m);if(p<=0)continue;const h=(s.vgas[m]>0?s.vgas[m]:e.vCell)/c;s.move(m,t,Math.min(.25,f*h/p))}s.deriveCell(t)}}function el(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const Xu=1.5,Qu=1;class Zu{constructor(t){v(this,"pe");v(this,"re");v(this,"known");v(this,"mass");v(this,"vol");v(this,"out",new Float64Array(3));v(this,"front");v(this,"next");v(this,"vp");v(this,"vr");v(this,"queued");v(this,"tag",0);v(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:c,ny:l,n:a,dx:u}=e,{pe:f,re:d,known:m,mass:p,vol:h}=this;p.fill(0),h.fill(0);for(let w=0;w<s.count;w+=1){const k=e.cellAt(s.x[w],s.y[w]);k<0||(p[k]+=s.mass[w],h[k]+=s.mass[w]/s.rho[w])}for(let w=0;w<a;w+=1){const k=e.kind[w];k===rt?(f[w]=e.pl[w],d[w]=h[w]>0?p[w]/h[w]:n.rhoRef,m[w]=1):k===$&&e.solid[w]===0?(f[w]=n.pGas[w]+e.pg[w],d[w]=i.rho[w]>0?i.rho[w]:r.rhoAmb,m[w]=1):(f[w]=0,d[w]=0,m[w]=0)}const g=t.gy*u,x=this.front,y=this.next,b=this.vp,_=this.vr,F=this.queued,A=++this.tag;let P=0;for(let w=0;w<a;w+=1){if(m[w]!==0)continue;const k=w%c,S=(w-k)/c;(k>0&&m[w-1]===1||k<c-1&&m[w+1]===1||S>0&&m[w-c]===1||S<l-1&&m[w+c]===1)&&(x[P++]=w,F[w]=A)}for(;P>0;){for(let k=0;k<P;k+=1){const S=x[k],T=S%c,M=(S-T)/c;let O=0,q=0,N=0;T>0&&m[S-1]!==0&&(O+=f[S-1],q+=d[S-1],N+=1),T<c-1&&m[S+1]!==0&&(O+=f[S+1],q+=d[S+1],N+=1),M>0&&m[S-c]!==0&&(O+=f[S-c]-d[S-c]*g,q+=d[S-c],N+=1),M<l-1&&m[S+c]!==0&&(O+=f[S+c]+d[S+c]*g,q+=d[S+c],N+=1),b[k]=N>0?O/N:0,_[k]=N>0?q/N:0}let w=0;for(let k=0;k<P;k+=1){const S=x[k];f[S]=b[k],d[S]=_[k],m[S]=2}for(let k=0;k<P;k+=1){const S=x[k],T=S%c,M=(S-T)/c;for(let O=0;O<4;O+=1){const q=T+(O===0?-1:O===1?1:0),N=M+(O===2?-1:O===3?1:0);if(q<0||N<0||q>=c||N>=l)continue;const L=q+N*c;m[L]!==0||F[L]===A||(F[L]=A,y[w++]=L)}}P=w;for(let k=0;k<w;k+=1)x[k]=y[k]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,c=Math.min(n-1.0001,Math.max(0,t/r-.5)),l=Math.min(i-1.0001,Math.max(0,e/r-.5)),a=Math.floor(c),u=Math.floor(l),f=c-a,d=l-u;let m=0,p=0;for(let h=0;h<2;h+=1)for(let g=0;g<2;g+=1){const x=a+g+(u+h)*n;if(this.known[x]===0)continue;const y=(g===0?1-f:f)*(h===0?1-d:d);m+=y*this.pe[x],p+=y}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,c=0,l=0;for(let a=0;a<t.nseg;a+=1){t.segment(a,i);const u=Math.hypot(i[2]-i[0],i[3]-i[1]),f=Math.max(1,Math.ceil(u/(.5*t.dx))),d=u/f*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let h=0;h<f;h+=1){const g=(h+.5)/f,x=i[0]+g*(i[2]-i[0]),y=i[1]+g*(i[3]-i[1]),b=s*x-n*y,_=n*x+s*y,F=this.sideAt(t.x+b,t.y+_,m,p)*d;r-=F*m,c-=F*p,l-=F*(b*p-_*m)}}return e[0]=r,e[1]=c,e[2]=l,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:c}=r,l=t+.5*c*s,a=e+.5*c*n,u=Math.min(r.nx-1.0001,Math.max(0,l/c-.5)),f=Math.min(r.ny-1.0001,Math.max(0,a/c-.5)),d=Math.floor(u),m=Math.floor(f),p=u-d,h=f-m;let g=0,x=0,y=0,b=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const A=d+F,P=m+_,w=A+P*r.nx;if(this.known[w]!==1)continue;const k=(A+.5)*c,S=(P+.5)*c;if((k-t)*s+(S-e)*n<=0)continue;const T=(F===0?1-p:p)*(_===0?1-h:h)+1e-6,M=this.pe[w]+this.re[w]*i.gy*(S-e);r.kind[w]===rt?(g+=T*M,x+=T):(y+=T*M,b+=T)}return x>0&&b>0?Math.max(g/x,y/b):x>0?g/x:b>0?y/b:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let c=0,l=0;for(let f=0;f<t.nseg;f+=1){t.segment(f,r);const d=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(d/t.dx));for(let p=0;p<m;p+=1){const h=(p+.5)/m,g=r[0]+h*(r[2]-r[0])+.5*t.dx*r[4],x=r[1]+h*(r[3]-r[1])+.5*t.dx*r[5],y=s.cellAt(t.x+n*g-i*x,t.y+i*g+n*x);l+=d/m,y>=0&&s.kind[y]===rt&&(c+=d/m)}}const a=l>0?c/l:0,u=e.liquid.rhoRef;t.ma=Xu*u*a*t.hullA*t.depth,t.Ia=Qu*u*a*t.hullJ*t.depth}}const Ju=.1,td=1,ed=.002,sd=.5,nd=1.02,id=.5;class rd{constructor(t){v(this,"list",[]);v(this,"cover");v(this,"forces");v(this,"contacts");v(this,"version",0);v(this,"prev",new Float64Array(0));v(this,"pred",new Float64Array(0));v(this,"predNow",new Float64Array(0));v(this,"predOld",new Float64Array(0));v(this,"vPre",new Float64Array(0));v(this,"awakeNow",0);v(this,"shapes",!1);v(this,"resized",!1);v(this,"afterCollect",null);v(this,"la",new Float64Array(2));v(this,"lb",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"dv",new Float64Array(3));v(this,"probeS",[]);v(this,"probeJ",[]);v(this,"m9",new Float64Array(9));v(this,"at",new Float64Array(2));this.e=t,this.cover=new Yu(t),this.forces=new Zu(()=>t),this.contacts=new Uu(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get motion(){return{prev:this.prev,pred:this.pred,predNow:this.predNow,predOld:this.predOld,vPre:this.vPre}}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const c=this.e.grid,l=jt.fromRects(this.list.length,n,c.dx,c.depth,e,t,s,r);return l.gone?null:(l.pinned=i,l.asleep=!0,this.list.push(l),this.grow(),this.cover.weigh(l),this.cover.addCells(l),this.changed(),l)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list){if(!e.awake)continue;this.awakeNow+=1,t=!0;const s=3*e.index;this.predNow[s]=this.pred[s],this.predNow[s+1]=this.pred[s+1],this.predNow[s+2]=this.pred[s+2],e.ux=e.vx+this.pred[s],e.uy=e.vy+this.pred[s+1],e.uw=e.w+this.pred[s+2],this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e)}if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>nd*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),c=3*i.index,l=i.ma6;i.maOk||(this.forces.addedMass(i),l.fill(0),l[0]=i.ma,l[3]=i.ma,l[5]=i.Ia);const a=this.predNow,u=this.predOld,f=n[c]+a[c]-u[c],d=n[c+1]+a[c+1]-u[c+1],m=n[c+2]+a[c+2]-u[c+2],p=t*r[0]+l[0]*f+l[1]*d+l[2]*m,h=t*(r[1]-i.m*e.gy)+l[1]*f+l[3]*d+l[4]*m,g=t*r[2]+l[2]*f+l[4]*d+l[5]*m;od(i.m+l[0],l[1],l[2],i.m+l[3],l[4],i.I+l[5],p,h,g,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[c]=this.dv[0],n[c+1]=this.dv[1],n[c+2]=this.dv[2],u[c]=a[c],u[c+1]=a[c+1],u[c+2]=a[c+2],this.vPre[c]=i.vx,this.vPre[c+1]=i.vy,this.vPre[c+2]=i.w}this.contacts.step(t,this.list,this.version,Ju*s.dx,td*s.dx);for(const i of this.list){if(!i.awake)continue;const r=3*i.index,c=Math.abs(i.vx-this.vPre[r])+Math.abs(i.vy-this.vPre[r+1])+Math.abs(i.w-this.vPre[r+2])*i.rmax>1e-9;this.pred[r]=c?0:n[r],this.pred[r+1]=c?0:n[r+1],this.pred[r+2]=c?0:n[r+2]}for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<ed&&this.contacts.touches(i)?i.rest+t:0,i.rest>=sd&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}blocks(t,e,s,n,i){const r=1e-6*this.e.grid.dx,c=this.la,l=this.lb;for(const a of this.list){if(a===t||a.gone||a.nw===0)continue;const u=this.cover.boxOf(a);if(!(Math.max(e,n)<u[0]||Math.min(e,n)>u[2]||Math.max(s,i)<u[1]||Math.min(s,i)>u[3])){jt.toLocal(a.x,a.y,a.a,e,s,c),jt.toLocal(a.x,a.y,a.a,n,i,l);for(let f=0;f<a.nr;f+=1){const d=a.xs[f][0]+r,m=a.ys[f][0]+r,p=a.xs[f][a.ni[f]]-r,h=a.ys[f][a.nj[f]]-r;if(p>d&&h>m&&wr(c[0],c[1],l[0],l[1],d,m,p,h,this.seg)>0)return!0}}}return!1}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:c,dx:l,depth:a}=i,u=this.cover.faceOwner;for(const f of this.list){if(!f.awake)continue;const d=f.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const h=this.cover.boxOf(f),g=Math.max(0,Math.floor(h[0]/l)-1),x=Math.min(r,Math.floor(h[2]/l)+2),y=Math.max(0,Math.floor(h[1]/l)-1),b=Math.min(c,Math.floor(h[3]/l)+2);for(let P=y;P<Math.min(c,b);P+=1)for(let w=g;w<=x;w+=1){const k=w+P*(r+1);if(u[k]!==d)continue;const S=(P+.5)*l,T=w>0?w-1+P*r:-1,M=w<r?w+P*r:-1,q=T>=0&&i.kind[T]===pt||M>=0&&i.kind[M]===pt?1:1-i.au[k];q<=0||(T>=0&&i.kind[T]===rt&&(m.push(t.at(w-1-e,P-s)),p.push(q,0,-q*(S-f.y))),M>=0&&i.kind[M]===rt&&(m.push(t.at(w-e,P-s)),p.push(-q,0,q*(S-f.y))))}for(let P=y;P<=b;P+=1)for(let w=g;w<Math.min(r,x);w+=1){const k=w+P*r;if(u[i.nu+k]!==d)continue;const S=(w+.5)*l,T=P>0?w+(P-1)*r:-1,M=P<c?w+P*r:-1,q=T>=0&&i.kind[T]===pt||M>=0&&i.kind[M]===pt?1:1-i.av[k];q<=0||(T>=0&&i.kind[T]===rt&&(m.push(t.at(w-e,P-1-s)),p.push(0,q,q*(S-f.x))),M>=0&&i.kind[M]===rt&&(m.push(t.at(w-e,P-s)),p.push(0,-q,-q*(S-f.x))))}if(m.length===0){f.ma6.fill(0),f.maOk=!0;continue}const _=t.system,F=this.m9;for(let P=0;P<3;P+=1){_.b.fill(0),_.x.fill(0);for(let w=0;w<m.length;w+=1)_.b[m[w]]-=l*p[3*w+P];t.solve(1e-4,40,!0);for(let w=0;w<3;w+=1){let k=0;for(let S=0;S<m.length;S+=1)k+=_.x[m[S]]*p[3*S+w];F[3*w+P]=-n*l*a*k}}const A=f.ma6;A[0]=F[0],A[1]=.5*(F[1]+F[3]),A[2]=.5*(F[2]+F[6]),A[3]=F[4],A[4]=.5*(F[5]+F[7]),A[5]=F[8],f.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,id*e.dx/s))}return t}wake(t){!t.free||!t.asleep||(t.asleep=!1,t.rest=0,t.maOk=!1,this.forget(t))}forget(t){const e=3*t.index;for(let s=e;s<e+3;s+=1)this.prev[s]=0,this.pred[s]=0,this.predNow[s]=0,this.predOld[s]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.forget(t),this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(me(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let c=this.list.length-1;c>=0;c-=1){const l=this.list[c];if(!l.gone&&(jt.toLocal(l.x,l.y,l.a,t,e,n),l.insideLocal(n[0],n[1],r)))return l}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=3*this.list.length+24,e=s=>{const n=new Float64Array(t);return n.set(s),n};this.prev=e(this.prev),this.pred=e(this.pred),this.predNow=e(this.predNow),this.predOld=e(this.predOld),this.vPre=e(this.vPre)}}}function od(o,t,e,s,n,i,r,c,l,a){const u=s*i-n*n,f=e*n-t*i,d=t*n-e*s,m=o*u+t*f+e*d,p=o*i-e*e,h=t*e-o*n,g=o*s-t*t;a[0]=(u*r+f*c+d*l)/m,a[1]=(f*r+p*c+h*l)/m,a[2]=(d*r+h*c+g*l)/m}const _r=.05;function sl(o,t){const e=o.latentOffset(),s=jo(o,t.filter(([n,i,r,c])=>r-n>_r*o.dx&&c-i>_r*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function jo(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,c=o.nr,l=o.E,a=o.film,u=o.crust;let f=0,d=0,m=0;for(let b=0;b<o.ncell;b+=1)f+=l[b],d+=a[b],m+=u[b];const p=[],h=[];for(const[b,_,F,A]of t)!(F>b)||!(A>_)||(p.push(jt.splits(b,F,o.dx)),h.push(jt.splits(_,A,o.dx)));o.setRects(p,h);let g=0,x=0,y=0;for(let b=0;b<o.nr;b+=1){const _=o.xs[b],F=o.ys[b];for(let A=0;A<o.nj[b];A+=1)for(let P=0;P<o.ni[b];P+=1){const w=o.off[b]+P+A*o.ni[b],k=_[P],S=_[P+1],T=F[A],M=F[A+1];for(let O=0;O<c;O+=1){const q=e[O],N=s[O];if(!(q[0]>=S||q[n[O]]<=k||N[0]>=M||N[i[O]]<=T))for(let L=0;L<i[O];L+=1){const R=Math.min(M,N[L+1])-Math.max(T,N[L]);if(!(R<=0))for(let E=0;E<n[O];E+=1){const I=Math.min(S,q[E+1])-Math.max(k,q[E]);if(I<=0)continue;const z=r[O]+E+L*n[O],G=I*R/((q[E+1]-q[E])*(N[L+1]-N[L]));o.E[w]+=G*l[z],o.film[w]+=G*a[z],o.crust[w]+=G*u[z]}}}g+=o.E[w],x+=o.film[w],y+=o.crust[w]}}return{energy:f-g,film:d-x,crust:m-y}}function cd(o,t,e,s,n){const[i,r,c,l]=o;if(s<=i||t>=c||n<=r||e>=l)return null;const a=[],u=Math.max(i,t),f=Math.min(c,s);return t>i&&a.push([i,r,t,l]),s<c&&a.push([s,r,c,l]),e>r&&a.push([u,r,f,e]),n<l&&a.push([u,n,f,l]),a}function ld(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let c=0;c<r.length;c+=1){const[l,a,u,f]=o[r[c]];for(let d=0;d<e;d+=1){if(s[d]>=0)continue;const[m,p,h,g]=o[d],x=(Math.abs(u-m)<=t||Math.abs(h-l)<=t)&&Math.min(f,g)-Math.max(a,p)>t,y=(Math.abs(f-p)<=t||Math.abs(g-a)<=t)&&Math.min(u,h)-Math.max(l,m)>t,b=Math.min(u,h)-Math.max(l,m)>t&&Math.min(f,g)-Math.max(a,p)>t;(x||y||b)&&(s[d]=n.length,r.push(d))}}n.push(r)}return n}function ad(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let c=0;c<n;c+=1){const l=s[c];if(l.gone)continue;let a=1/0,u=1/0,f=-1/0,d=-1/0;if("circle"in t){const[A,P,w]=t.circle;jt.toLocal(l.x,l.y,l.a,A,P,i),a=i[0]-w,f=i[0]+w,u=i[1]-w,d=i[1]+w}else{const[A,P,w,k]=Ln(t);for(const[S,T]of[[A,P],[w,P],[w,k],[A,k]])jt.toLocal(l.x,l.y,l.a,S,T,i),a=Math.min(a,i[0]),f=Math.max(f,i[0]),u=Math.min(u,i[1]),d=Math.max(d,i[1])}const m=[];let p=!1;for(let A=0;A<l.nr;A+=1){const P=l.bounds(A),w=cd(P,a,u,f,d);if(w===null){m.push(P);continue}p=!0;for(const k of w)m.push(k)}if(!p)continue;r=!0,o.cover.release(l);const h=me(l.mat)>0,g={E:l.energy(),F:l.filmMass(),K:l.crustMass(),M:h?l.m:0},x=xf(o,l,m.filter(A=>A[2]-A[0]>_r*l.dx&&A[3]-A[1]>_r*l.dx));let y=0,b=0,_=0,F=0;for(const A of x)y+=A.energy(),b+=A.filmMass(),_+=A.crustMass(),F+=h?A.m:0;e.energy-=g.E-l.energy()-y,e.water-=g.F-l.filmMass()-b+(h?g.M-l.m-F:0),e.salt-=g.K-l.crustMass()-_,l.gone||l.ncell===0?(l.gone=!0,l.ncell=0):(o.cover.weigh(l),o.cover.addCells(l))}return r&&o.changed(),r}function xf(o,t,e,s=!0){const n=o.list,i=ld(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let c=1;c<i.length;c+=1){const l=new jt(n.length,t.key,t.dx,t.depth);l.mat=t.mat,l.heater=t.heater,l.xs=t.xs.map(a=>a.slice()),l.ys=t.ys.map(a=>a.slice()),l.nr=t.nr,l.ni=t.ni.slice(),l.nj=t.nj.slice(),l.off=t.off.slice(),l.ncell=t.ncell,l.E=t.E.slice(),l.film=t.film.slice(),l.crust=t.crust.slice(),l.x=t.x,l.y=t.y,l.a=t.a,l.m=t.m,sl(l,i[c].map(a=>e[a])),l.rx=l.x,l.ry=l.y,l.ra=l.a,l.pinned=t.pinned,l.asleep=t.asleep,l.vx=t.vx,l.vy=t.vy,l.w=t.w,n.push(l),o.grow(),o.cover.weigh(l),o.cover.addCells(l),r.push(l)}return sl(t,i.length>0?i[0].map(c=>e[c]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function fd(o,t,e){const[s,n,i,r]=Ln(t),c=[],l=new Float64Array(4);for(const a of o.list){if(a.gone||e!==void 0&&!e(a))continue;a.worldBox(a.x,a.y,a.a,l);const u=.001*a.dx;l[0]>=i-u||l[2]<=s+u||l[1]>=r-u||l[3]<=n+u||(o.cover.release(a),c.push(a))}return c}function ud(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(me(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function nl(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const Zt=new Float64Array(6);function Hi(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let c=0;c<r;c+=1){const l=e===0?0:e===1?n-1:c,a=e===2?0:e===3?i-1:c,u=o.off[t]+l+a*n,f=e<2?o.ys[t][a]:o.xs[t][l],d=e<2?o.ys[t][a+1]:o.xs[t][l+1],m=yf(o,t,e,f,d);s(u,d-f,d>f?m/(d-f):0)}}function yf(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function il(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function wf(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function dd(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=wf(o,t,n);i>s&&(s=i,e=n)}return e}function _f(o,t,e,s){t.segment(e,Zt);const n=Math.hypot(Zt[2]-Zt[0],Zt[3]-Zt[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),c=Math.sin(t.a),l=r*Zt[4]-c*Zt[5],a=c*Zt[4]+r*Zt[5],u=Zt[0],f=Zt[1],d=Zt[2]-Zt[0],m=Zt[3]-Zt[1];for(let p=0;p<i;p+=1){const h=(p+.5)/i,g=u+h*d,x=f+h*m;s(t.x+r*g-c*x,t.y+c*g+r*x,l,a,n/i)}}function Ff(o,t,e,s,n,i,r){const c=.05*o.dx,l=o.cellAt(s+c*i,n+c*r);if(l<0||o.solid[l]===0||o.owner[l]!==t||o.fs[l]<e)return c;const a=l%o.nx,u=(l-a)/o.nx;let f=1/0;return i>1e-9?f=Math.min(f,((a+1)*o.dx-s)/i):i<-1e-9&&(f=Math.min(f,(a*o.dx-s)/i)),r>1e-9?f=Math.min(f,((u+1)*o.dx-n)/r):r<-1e-9&&(f=Math.min(f,(u*o.dx-n)/r)),Number.isFinite(f)?Math.max(c,f+c):c}function Mc(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx,c=t.free?Tc:Sc;let l=-1,a=-1,u=-1;_f(o,t,e,(f,d,m,p,h)=>{const g=Ff(i,t.index+1,c,f,d,m,p),x=i.cellAt(f+g*m,d+g*p);if(x<0||i.solid[x]!==0){l=x;return}if(x!==l&&s(x,h),l=x,n){const b=f+(i.dx+g)*m,_=d+(i.dx+g)*p,F=i.cellAt(b,_);F>=0&&F!==x&&F!==u&&i.solid[F]===0&&!o.bodies.blocks(t,f,d,b,_)&&s(F,h),u=F}const y=i.cellAt(f-r*m,d-r*p);y>=0&&y!==x&&y!==a&&i.solid[y]===0&&i.kind[y]===rt&&s(y,h),a=y})}function hd(o,t,e,s,n){const i=o.exchange;let r=0,c=0;for(let l=0;l<t.nseg;l+=1)t.segR[l]!==e||t.segS[l]!==s||Mc(o,t,l,a=>{r+=i.salt[a],c+=i.water[a],n.add(4*e+s)});return!(c>0)||!(r>0)?me(t.mat):vc(r/(c*Be))}function md(o,t,e,s,n){const i=o.grid,r=o.exchange,c=i.n,l=t.free?Tc:Sc;let a=0;for(let u=0;u<t.nseg;u+=1)t.segR[u]!==e||t.segS[u]!==s||_f(o,t,u,(f,d,m,p,h)=>{var _;const g=Ff(i,t.index+1,l,f,d,m,p),x=i.cellAt(f+g*m,d+g*p);if(x<0)return;let y,b;i.solid[x]!==0?(y=i.T[x],b=((_=ht[i.solid[x]-1])==null?void 0:_.k)??0):r.cap[x]>0?(y=r.capT[x]/r.cap[x],b=ii(y)):(y=i.T[x],b=mc(i.mg[x],i.mg[c+x],i.mg[Q*c+x],y)),y>n&&(a+=b*(y-n)*h)});return a}const Pf=2,kf=.25,Af=4;class pd{constructor(t,e){v(this,"pending",new Map);v(this,"sg",new Float64Array(6));this.e=t,this.inCell=e}totals(){let t=0,e=0,s=0;for(const n of this.pending.values())t+=n.m-n.s,e+=n.H,s+=n.s;return{m:t,H:e,s}}any(t){var e;for(let s=0;s<4;s+=1)if((((e=this.pending.get(4*t+s))==null?void 0:e.m)??0)>0)return!0;return!1}give(t,e,s,n,i,r=0,c=-1){const l=this.e.grid,a=this.e.particles,u=this.e.liquid,f=[],d=new Set;let m=0,p=!1;for(let g=0;g<2&&f.length===0;g+=1)for(let x=0;x<t.nseg;x+=1)t.segR[x]!==e||t.segS[x]!==s||Mc(this.e,t,x,y=>{g===0&&(p=!0),!(l.kind[y]!==rt||d.has(y))&&(d.add(y),this.inCell(y,b=>{a.mat[b]===dt&&(f.push(b),m+=a.mass[b])}))},g===1);if(f.length===0||!(m>0)){if(!p&&c<0){const g=s<2?[2,3]:[0,1];for(const x of g)this.give(t,e,x,.5*n,.5*i,.5*r,s);return}this.hold(t,e,s,n,i,r,c);return}const h=u.rhoRef*l.vCell/4;for(const g of f){const x=a.mass[g]/m,y=a.mass[g]/a.rho[g],b=a.mass[g]*a.h[g]+x*i;a.mass[g]+=x*n,r>0&&(a.smass[2*g]+=x*r,a.spc[2*g]=Si),a.h[g]=b/a.mass[g],a.derive(g),u.dVp[g]+=a.mass[g]/a.rho[g]-y,a.mass[g]>Pf*h&&this.split(g)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const u of[i,-i]){const f=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*u)),d=n.cellAt(f,e.y[t]);if(d>=0&&n.solid[d]===0&&this.e.bodies.bodyAt(f,e.y[t],0)===null){r=f;break}}if(Number.isNaN(r))return;const c=.5*e.mass[t],l=.5*e.smass[2*t],a=e.add(r,e.y[t],c,e.h[t],e.mat[t],l);a<0||(e.mass[t]=c,e.smass[2*t]=l,e.derive(t),e.vx[a]=e.vx[t],e.vy[a]=e.vy[t],s.placeParticle(a))}hold(t,e,s,n,i,r,c){const l=this.e.grid.dx,[a,u,f,d]=t.bounds(e);let m=s===0?a:s===1?f:.5*(a+f),p=s===2?u:s===3?d:.5*(u+d);c===2?p=Math.min(d,u+.5*l):c===3?p=Math.max(u,d-.5*l):c===0?m=Math.min(f,a+.5*l):c===1&&(m=Math.max(a,f-.5*l));const h=s===0?-1:s===1?1:0,g=s===2?-1:s===3?1:0,x=Math.cos(t.a),y=Math.sin(t.a),b=4*t.index+s;let _=this.pending.get(b);_===void 0&&(_={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1},this.pending.set(b,_)),_.m+=n,_.H+=i,_.s+=r,_.x=t.x+x*m-y*p,_.y=t.y+y*m+x*p,_.nx=x*h-y*g,_.ny=y*h+x*g}spawnAll(t){for(let e=0;e<4;e+=1){const s=this.pending.get(4*t.index+e);s!==void 0&&s.m>0&&this.spawn(t,s)}}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;for(let c=0;c<Af&&e.m>0;c+=1){if(e.m<kf*r&&!t.gone)return;const l=(c%2===0?1:-1)*Math.ceil(c/2)*.3*s.dx,a=e.x+.3*s.dx*e.nx-l*e.ny,u=e.y+.3*s.dx*e.ny+l*e.nx,f=this.freeSpot(t,e.x,e.y,a,u)??(t.gone?null:this.outlineSpot(t,a,u));if(f===null)return;const d=Math.min(e.m,r),m=d/e.m,p=n.add(f[0],f[1],d,e.H/e.m,dt,m*e.s);if(p<0)return;n.vx[p]=t.gone?0:t.vx,n.vy[p]=t.gone?0:t.vy,i.placeParticle(p),i.dVp[p]=d/n.rho[p],e.H-=m*e.H,e.s-=m*e.s,e.m-=d,e.m>1e-15||(e.m=0,e.H=0,e.s=0)}}fluidAt(t,e){const s=this.e.grid;if(!(t>0&&e>0&&t<s.w&&e<s.h))return!1;const n=s.cellAt(t,e);return n>=0&&s.solid[n]===0&&this.e.bodies.bodyAt(t,e,0)===null}freeSpot(t,e,s,n,i){const r=this.e.grid,c=(l,a)=>this.fluidAt(l,a)&&!this.e.bodies.blocks(t,e,s,l,a);if(c(n,i))return[n,i];for(let l=1;l<=3;l+=1)for(let a=l;a>=-l;a-=1)for(let u=-l;u<=l;u+=1)if(Math.max(Math.abs(u),Math.abs(a))===l&&c(n+u*r.dx,i+a*r.dx))return[n+u*r.dx,i+a*r.dx];return null}outlineSpot(t,e,s){const n=this.e.grid.dx,i=this.sg,r=Math.cos(t.a),c=Math.sin(t.a);let l=null,a=1/0;for(let u=0;u<t.nseg;u+=1){t.segment(u,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),d=Math.max(1,Math.ceil(f/(.5*n)));for(let m=0;m<d;m+=1){const p=(m+.5)/d,h=i[0]+p*(i[2]-i[0]),g=i[1]+p*(i[3]-i[1]),x=h+.3*n*i[4],y=g+.3*n*i[5],b=t.x+r*x-c*y,_=t.y+c*x+r*y,F=(b-e)*(b-e)+(_-s)*(_-s);F<a&&this.fluidAt(b,_)&&!this.e.bodies.blocks(t,t.x+r*h-c*g,t.y+c*h+r*g,b,_)&&(a=F,l=[b,_])}}return l}}const Sf=.3,Tf=1.6,Wn=.25,Do=.5,io=1e-6;class bd{constructor(t){v(this,"water");v(this,"melted",0);v(this,"frozen",0);v(this,"head",new Int32Array(0));v(this,"next",new Int32Array(0));v(this,"listed",!1);this.e=t,this.water=new pd(t,(e,s)=>this.inCell(e,s))}pendingTotals(){return this.water.totals()}any(){return this.e.bodies.list.some((t,e)=>!t.gone&&me(t.mat)>0||this.water.any(e))}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&me(i.mat)>0&&this.body(i)&&(t=!0),this.water.spawnAll(i)}return t}body(t){const e=ht[t.mat].rho,s=ht[t.mat].cp,n=Ls(t.mat),i=new Map,r=new Set,c=new Map;for(let b=0;b<t.nseg;b+=1){const _=4*t.segR[b]+t.segS[b];if(i.has(_))continue;const F=hd(this.e,t,t.segR[b],t.segS[b],r);i.set(_,F),c.set(_,md(this.e,t,t.segR[b],t.segS[b],F))}const l=new Map;for(let b=0;b<t.nr;b+=1)this.excess(t,b,i,r,c,l);const a=this.walls(t,[...i.keys()]),u=new Map,f=new Map,d=new Map,m=new Map,p=new Map;for(const[b,_]of i){const F=b>>2,A=b&3,P=s*(_-et)+n,w=kt(_)-P;let k=0;Hi(t,F,A,(M,O,q)=>{q>0&&(k+=q*O*(w+s*(_-Math.min(_,t.cellT(M)))))});const S=this.planFreeze(t,F,A,_,w);u.set(b,{L:w,hIce:P,denom:k,plan:S});const T=a.get(b);f.set(T,(f.get(T)??0)+(l.get(b)??0)),d.set(T,(d.get(T)??0)+k),m.set(T,(m.get(T)??0)+((S==null?void 0:S.total)??0)),p.set(T,(p.get(T)??0)+wf(t,F,A))}const h=[];for(const[b,_]of i){const F=b>>2,A=b&3,P=a.get(b),w=u.get(b),k=l.get(b)??0,S=f.get(P)??0,T=d.get(P)??0;S>0&&T>0?h.push({r:F,s:A,d:S/(e*t.depth*T),Q:k,Tf:_,hIce:w.hIce,freeze:null}):k>0&&this.giveBack(t,F,A,k);const M=m.get(P)??0;M>0&&h.push({r:F,s:A,d:M/(e*t.depth*p.get(P)),Q:0,Tf:_,hIce:w.hIce,freeze:w.plan??{p:[],dm:[],total:0}})}if(h.length===0)return!1;const g=ol(t),x=this.e.bodies;if(x.cover.release(t),t.nr===1?this.moveSides(t,h):this.slabs(t,h),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,x.changed(),!0;let y=0;if(t.nr>1){const b=[];for(let _=0;_<t.nr;_+=1)b.push(t.bounds(_));y=xf(x,t,b,!1).length}return t.derive(),x.cover.weigh(t),x.cover.addCells(t),h.some(b=>b.freeze!==null)&&x.cover.pushOut(t,t.x,t.y,t.a),x.reshaped(t,y>0||ol(t)!==g),!0}excess(t,e,s,n,i,r){const c=[];for(let h=0;h<4;h+=1)n.has(4*e+h)&&c.push(h);if(c.length===0)for(let h=0;h<4;h+=1)s.has(4*e+h)&&c.push(h);let l=1/0;for(let h=0;h<4;h+=1)l=Math.min(l,s.get(4*e+h)??1/0);if(l===1/0)return;const a=t.xs[e],u=t.ys[e],f=t.ni[e],d=t.nj[e],m=[0,0],p=[0,0];for(let h=0;h<d;h+=1)for(let g=0;g<f;g+=1){const x=t.off[e]+g+h*f,y=t.cellT(x);if(!(y>l))continue;let b=0,_=0;for(let M=0;M<4&&b<2;M+=1){if(!(M===0?g===0:M===1?g===f-1:M===2?h===0:h===d-1))continue;const O=i.get(4*e+M)??0;!(O>0)||!(yf(t,e,M,M<2?u[h]:a[g],M<2?u[h+1]:a[g+1])>0)||(m[b]=M,p[b]=O,_+=O,b+=1)}if(b>0){const M=t.E[x];for(let O=0;O<b;O+=1){const q=4*e+m[O],N=p[O]/_*(M-Ro(t.cellCap(x),t.film[x],t.crust[x],s.get(q)));N>0&&(t.E[x]-=N,r.set(q,(r.get(q)??0)+N))}continue}if(c.length===0)continue;const F=.5*(a[g]+a[g+1]),A=.5*(u[h]+u[h+1]);let P=c[0],w=1/0;for(const M of c){const O=M===0?F-a[0]:M===1?a[f]-F:M===2?A-u[0]:u[d]-A;O<w&&(w=O,P=M)}const k=4*e+P,S=s.get(k);if(!(y>S))continue;const T=t.E[x]-Ro(t.cellCap(x),t.film[x],t.crust[x],S);T>0&&(t.E[x]-=T,r.set(k,(r.get(k)??0)+T))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,c=this.e.particles,l={p:[],dm:[],total:0},a=u=>{if(!(r.cap[u]>0)||!(r.water[u]>0))return;const f=r.capT[u]/r.cap[u];if(f>=n)return;const d=Math.min(Do*r.water[u],r.cap[u]*(n-f)/Math.max(1,i));if(!(d>0))return;let m=0;this.inCell(u,p=>{if(c.mat[p]!==dt)return;const h=c.mass[p]-c.smass[2*p],g=Math.min(Do*h,d*h/r.water[u]);g>0&&(l.p.push(p),l.dm.push(g),m+=g)}),r.water[u]-=m,r.cap[u]=0,l.total+=m};for(let u=0;u<t.nseg;u+=1)t.segR[u]===e&&t.segS[u]===s&&Mc(this.e,t,u,a);return l.total>0?l:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let c=0;c<t.p.length;c+=1){const l=t.p[c],a=t.dm[c]*e;if(!(a>0))continue;const u=n.mass[l]/n.rho[l],f=n.mass[l]*n.h[l]-a*s;n.mass[l]-=a,n.h[l]=f/n.mass[l],n.derive(l),i.dVp[l]+=n.mass[l]/n.rho[l]-u,r+=a}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=ht[t.mat].rho,c=Math.min(n,this.rowThickness(t,e,s));let l=0,a=0,u=0,f=0;if(Hi(t,e,s,(d,m)=>{const p=t.cellVolume(d);if(!(p>0))return;const h=m*c*t.depth/p;a+=h*t.E[d],u+=h*t.film[d],f+=h*t.crust[d],t.E[d]-=h*t.E[d],t.film[d]-=h*t.film[d],t.crust[d]-=h*t.crust[d],l+=r*m*c*t.depth}),this.moveSide(t,e,s,-c),!(l>0)){this.giveBack(t,e,s,i+a);return}this.melted+=l,this.water.give(t,e,s,l+u+f,a+l*Ls(t.mat)+i,f)}grow(t,e,s,n,i){const r=ht[t.mat].rho,c=ht[t.mat].cp,l=il(t,e,s),a=n/(r*t.depth*l);Hi(t,e,s,(u,f)=>{t.E[u]+=r*f*a*t.depth*c*(i-et)}),this.moveSide(t,e,s,a)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=il(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}Hi(t,e,s,(r,c)=>{t.E[r]+=n*c/i})}slabs(t,e){const s=ht[t.mat].rho,n=ht[t.mat].cp,i=Ls(t.mat),r=t.depth,c=e.length,l=this.walls(t,e.map(k=>4*k.r+k.s)),a=e.map(k=>l.get(4*k.r+k.s)),u=new Map;for(const k of e)k.freeze===null&&u.set(4*k.r+k.s,k.d);const f=[];for(let k=0;k<t.nr;k+=1)f.push(t.bounds(k));const d=new Map;for(const k of e)d.set(4*k.r+k.s,(d.get(4*k.r+k.s)??0)+(k.freeze!==null?k.d:-k.d));const m=[],p=[];for(let k=0;k<c;k+=1){const S=e[k],T=f[S.r];for(let M=0;M<t.nseg;M+=1)if(!(t.segR[M]!==S.r||t.segS[M]!==S.s))if(S.freeze===null){const O=t.segT0[M]-this.inner(t,M,!1,u),q=t.segT1[M]+this.inner(t,M,!0,u);m.push(rl(S.s,T,O,q,Math.min(S.d,S.s<2?T[2]-T[0]:T[3]-T[1]),!0,k))}else{const O=t.segT0[M]-this.corner(t,S.r,S.s,!1,t.segT0[M],d),q=t.segT1[M]+this.corner(t,S.r,S.s,!0,t.segT1[M],d);q>O&&p.push(rl(S.s,T,O,q,S.d,!1,k))}}const h=Ku(f,m,p),g=h.taken,x=new Float64Array(c);for(let k=0;k<g.length;k+=5)x[g[k+4]]+=(g[k+2]-g[k])*(g[k+3]-g[k+1]);for(let k=0;k<c;k+=1)e[k].freeze===null&&!(x[k]>0)&&this.giveBack(t,e[k].r,e[k].s,e[k].Q);const y=new Float64Array(c),b=new Float64Array(c),_=new Float64Array(c);for(let k=0;k<g.length;k+=5){const S=g[k+4];this.overlap(t,g[k],g[k+1],g[k+2],g[k+3],(T,M)=>{y[S]+=M*t.E[T],b[S]+=M*t.film[T],_[S]+=M*t.crust[T]})}for(let k=0;k<c;k+=1){const S=e[k];if(S.freeze!==null||!(x[k]>0))continue;const T=s*r*x[k];this.melted+=T,this.water.give(t,S.r,S.s,T+b[k]+_[k],y[k]+T*i+S.Q,_[k])}jo(t,h.rects);const F=h.added,A=new Float64Array(c);for(let k=0;k<F.length;k+=5){const S=F[k+4],T=e[S].Tf;A[S]+=(F[k+2]-F[k])*(F[k+3]-F[k+1]),this.overlap(t,F[k],F[k+1],F[k+2],F[k+3],(M,O,q)=>{t.E[M]+=s*r*q*n*(T-et)})}const P=new Map,w=new Map;for(let k=0;k<c;k+=1){const S=e[k].freeze;if(S===null)continue;const T=a[k];P.set(T,(P.get(T)??0)+s*r*A[k]),w.set(T,(w.get(T)??0)+S.total)}for(let k=0;k<c;k+=1){const S=e[k].freeze;if(S===null||!(S.total>0))continue;const T=a[k];this.take(S,P.get(T)/w.get(T),e[k].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let c=r;for(;s.get(c)!==c;)c=s.get(c);return c};if(t.nr>1){const r=io*t.dx,c=l=>{const a=t.segR[l],u=t.segS[l];return u===0?t.xs[a][0]:u===1?t.xs[a][t.ni[a]]:u===2?t.ys[a][0]:t.ys[a][t.nj[a]]};for(let l=0;l<t.nseg;l+=1)for(let a=l+1;a<t.nseg;a+=1){if(t.segS[l]!==t.segS[a]||Math.abs(c(l)-c(a))>r||Math.abs(t.segT1[l]-t.segT0[a])>r&&Math.abs(t.segT1[a]-t.segT0[l])>r)continue;const u=4*t.segR[l]+t.segS[l],f=4*t.segR[a]+t.segS[a];if(!s.has(u)||!s.has(f))continue;const d=n(u),m=n(f);d!==m&&s.set(Math.max(d,m),Math.min(d,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=io*t.dx,r=t.segR[e],c=t.segS[e],l=s?t.segT1[e]:t.segT0[e],a=c===0?t.xs[r][0]:c===1?t.xs[r][t.ni[r]]:c===2?t.ys[r][0]:t.ys[r][t.nj[r]],u=c<2?a:l,f=c<2?l:a,d=c===0?-1:c===1?1:0,m=c===2?-1:c===3?1:0;for(let p=0;p<t.nseg;p+=1){const h=t.segS[p];if(h<2==c<2)continue;const g=n.get(4*t.segR[p]+h);if(g===void 0)continue;const x=t.segR[p],y=h===0?t.xs[x][0]:h===1?t.xs[x][t.ni[x]]:h===2?t.ys[x][0]:t.ys[x][t.nj[x]];for(const[b,_]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const F=h<2?y:b,A=h<2?b:y;if(Math.abs(F-u)>i||Math.abs(A-f)>i)continue;const P=h<2?y:_,w=h<2?_:y;if((P-u)*d+(w-f)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[c,l,a,u]=t.bounds(e),f=io*t.dx,d=s<2?n?u:l:n?a:c;if(Math.abs(i-d)>f)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?c:s===1?a:s===2?l:u;for(let h=0;h<t.nseg;h+=1)if(t.segR[h]===e&&t.segS[h]===m&&t.segT0[h]<=p+f&&t.segT1[h]>=p-f)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let c=0;c<t.nr;c+=1){const l=t.xs[c],a=t.ys[c],u=t.ni[c],f=t.nj[c];if(!(l[0]>=n||l[u]<=e||a[0]>=i||a[f]<=s))for(let d=0;d<f;d+=1){const m=Math.min(i,a[d+1])-Math.max(s,a[d]);if(!(m<=0))for(let p=0;p<u;p+=1){const h=Math.min(n,l[p+1])-Math.max(e,l[p]);h<=0||r(t.off[c]+p+d*u,h*m/((l[p+1]-l[p])*(a[d+1]-a[d])),h*m)}}}}tidy(t){const e=t.dx;let s=!1;for(let c=0;c<t.nr;c+=1){const[l,a,u,f]=t.bounds(c);if(u-l<Wn*e||f-a<Wn*e){s=!0;continue}for(let d=0;d<4;d+=1){const m=this.rowThickness(t,c,d),p=d<2?t.ni[c]:t.nj[c];(m<Sf*e&&p>1||m>Tf*e)&&(s=!0)}}if(!s)return;const n=ht[t.mat].rho,i=Ls(t.mat),r=[];for(let c=0;c<t.nr;c+=1){const[l,a,u,f]=t.bounds(c);if(u-l>=Wn*e&&f-a>=Wn*e){r.push([l,a,u,f]);continue}const d=n*(u-l)*(f-a)*t.depth;let m=0,p=0,h=0;for(let g=t.off[c];g<t.off[c]+t.ni[c]*t.nj[c];g+=1)m+=t.E[g],p+=t.film[g],h+=t.crust[g];this.melted+=d,this.water.give(t,c,dd(t,c),d+p+h,m+d*i,h)}jo(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function rl(o,t,e,s,n,i,r){const[c,l,a,u]=t;return o===0?i?{x0:c,y0:e,x1:c+n,y1:s,move:r}:{x0:c-n,y0:e,x1:c,y1:s,move:r}:o===1?i?{x0:a-n,y0:e,x1:a,y1:s,move:r}:{x0:a,y0:e,x1:a+n,y1:s,move:r}:o===2?i?{x0:e,y0:l,x1:s,y1:l+n,move:r}:{x0:e,y0:l-n,x1:s,y1:l,move:r}:i?{x0:e,y0:u-n,x1:s,y1:u,move:r}:{x0:e,y0:u,x1:s,y1:u+n,move:r}}function ol(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const de=8;class gd{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*ut),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*de),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<ut;i+=1)this.m[n*ut+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<de;i+=1)this.force[n*de+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<ut;s+=1)e+=this.m[t*ut+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<ut;s+=1)this.m[t*ut+s]=this.m[e*ut+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<de;s+=1)this.force[t*de+s]=this.force[e*de+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Mf=200;function ro(o,t,e,s){const n=St(o);return t/Ne(n)-e*Ut*n/(s-o)}function vd(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function xd(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function yd(o,t,e,s,n,i,r,c=dt){const l=o[t+Q],a=o[t+lt]/gt[lt]+o[t+at]/gt[at],u=l/gt[Q];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(u+a)*Ut*s/e)/(4*Math.PI)),d=e,m=0,p=s,h=0;for(let g=0;g<8;g+=1){if(d=e+2*bn(c,p)/f,a<=0)m=d,p=St(m),h=l/Ne(p);else if(u<=1e-9*a)m=0,p=s,h=a*Ut*p/d;else{let y=611.213,b=d*(1-1e-12),_=ro(y,l,a,d),F=ro(b,l,a,d);if(_<=0)m=y;else if(F>=0)m=b;else{let A=0;m=.5*(y+b);for(let P=0;P<40;P+=1){m=(y*F-b*_)/(F-_);const w=ro(m,l,a,d);if(Math.abs(w)<=1e-12*(l/Ne(s)+1e-30))break;w>0?(y=m,_=w,A===1&&(F/=2),A=1):(b=m,F=w,A===-1&&(_/=2),A=-1)}}p=St(m),h=l/Ne(p)}const x=vd(h,n);if(Math.abs(x-f)<=1e-7*f){f=x;break}f=x}r.r=f,r.V=h,r.pb=e+2*bn(c,p)/f,r.pv=m,r.Tb=p,xd(h,f,n,r)}function cl(o,t,e,s){let n=0;for(let i=0;i<ut;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function ll(o,t,e,s,n,i,r,c,l,a){let u=0;if(2*e<=3*i){const x=o/i-.5,y=t/i-.5,b=Math.floor(x-.5),_=Math.floor(y-.5),F=x-b,A=y-_,P=.5*(1.5-F)**2,w=.75-(F-1)**2,k=.5*(F-.5)**2,S=.5*(1.5-A)**2,T=.75-(A-1)**2,M=.5*(A-.5)**2;let O=0;for(let q=0;q<3;q+=1){const N=_+q;if(N<0||N>=c)continue;const L=q===0?S:q===1?T:M;for(let R=0;R<3;R+=1){const E=b+R;if(E<0||E>=r)continue;const I=L*(R===0?P:R===1?w:k);l[u]=E+N*r,a[u]=I,O+=I,u+=1}}for(let q=0;q<u;q+=1)a[q]/=O;return u}const f=s<=Math.PI*n*n*n/6,d=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),h=Math.min(c-1,Math.floor((t+e)/i));let g=0;for(let x=p;x<=h;x+=1)for(let y=d;y<=m;y+=1){let b=0;for(let _=0;_<4;_+=1){const F=(x+(_+.5)/4)*i-t;for(let A=0;A<4;A+=1){const P=(y+(A+.5)/4)*i-o,w=e*e-P*P-F*F;w>0&&(b+=f?Math.sqrt(w):1)}}b<=0||u>=l.length||(l[u]=y+x*r,a[u]=b,g+=b,u+=1)}if(g<=0)return l[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(c-1,Math.max(0,Math.floor(t/i)))*r,a[0]=1,1;for(let x=0;x<u;x+=1)a[x]/=g;return u}function al(o,t,e,s,n,i){const{nx:r,ny:c}=o,l=e%r,a=(e-l)/r;let u=0,f=0;for(let d=0;d<=6&&(u===0||f<2*s);d+=1)for(let m=0;m<=d;m+=1)for(let p=-d;p<=d;p+=1){if(Math.max(Math.abs(p),m)!==d)continue;const h=l+p,g=a+m;if(h<0||g<0||h>=r||g>=c)continue;const x=h+g*r;if(o.kind[x]!==$||u>=n.length)continue;const y=Math.max(.001*o.vCell,t[x]);n[u]=x,i[u]=y,f+=y,u+=1}for(let d=0;d<u;d+=1)i[d]/=f;return u}function fl(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===$)return e+s*o.nx;return-1}const Xs=.5;class wd{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,c=n.liquid,l=r.x[t],a=r.y[t],u=r.r[t],f=r.V[t],d=Math.max(u+i.dx,2*i.dx),m=this.vel;let p=0,h=0;for(let D=0;D<8;D+=1){const U=D*Math.PI/4;c.velocityAt(l+d*Math.cos(U),a+d*Math.sin(U),m),p+=m[0]/8,h+=m[1]/8}const g=i.cellAt(l,a),x=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],y=g>=0?n.phase.host[g]:0,b=n.phase.mixed?Ds(y,x):c.rhoRef,_=oi(y,x),F=r.totalMass(t)/Math.max(1e-30,f),A=(p-this.ux0[t])/Math.max(e,1e-6),P=(h-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=h,u<2e-5){r.vx[t]=p,r.vy[t]=h,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,l+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,a+e*h));return}const w=r.vx[t]-p,k=r.vy[t]-h,S=Math.hypot(w,k),T=2*u,M=Math.max(1e-6,b*S*T/_),O=Math.max(0,n.gy)*(b-F)*T*T/bn(y,x),N=.5*Math.max(24/M*(1+.15*Math.pow(M,.687)),8/3*(O/(O+4)))*b*this.front(t)*S,L=(F+Xs*b)*f,R=b*f*A,E=b*f*(P+n.gy),I=-F*f*n.gy,z=Xs*b*f*A,G=Xs*b*f*P,X=s>0?Xs*b*s:0,nt=s<0?Math.min(-s,.2*f/e):0,bt=Xs*b*nt*w,ct=Xs*b*nt*k,W=(L*r.vx[t]+e*(R+z+bt)+e*(N+X)*p)/(L+e*(N+X)),H=(L*r.vy[t]+e*(E+I+G+ct)+e*(N+X)*h)/(L+e*(N+X));r.vx[t]=Number.isFinite(W)?W:p,r.vy[t]=Number.isFinite(H)?H:h;const st=-N*(W-p),wt=-N*(H-h),mt=t*de;r.force[mt]=R,r.force[mt+1]=E,r.force[mt+2]=0,r.force[mt+3]=I,r.force[mt+4]=st,r.force[mt+5]=wt,r.force[mt+6]=z+bt-X*(W-p),r.force[mt+7]=G+ct-X*(H-h),this.spreadForce(l,a,u,-(st+r.force[mt+6])*(e/n.dt),-(wt+r.force[mt+7])*(e/n.dt));let Z=l+e*W,j=a+e*H;const B=i.sdfAt(Z,j);if(B<u){const D=.25*i.dx;let U=i.sdfAt(Z+D,j)-i.sdfAt(Z-D,j),ft=i.sdfAt(Z,j+D)-i.sdfAt(Z,j-D);const it=Math.hypot(U,ft);if(it>1e-12){U/=it,ft/=it,Z+=(u-B)*U,j+=(u-B)*ft;const vt=r.vx[t]*U+r.vy[t]*ft;vt<0&&(r.vx[t]-=vt*U,r.vy[t]-=vt*ft)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,Z)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,j));const C=i.depth;r.z[t]=2*u>=C?C/2:Math.min(C-u,Math.max(u,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:l,ny:a,dx:u}=c;if(s>u&&this.spreadRing(t,e,s,n,i))return;const f=this.w3;let d=Math.floor(t/u-.5),m=t/u-d;f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2;let p=Math.floor(e/u-1);m=e/u-.5-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1){const x=d+g,y=p+h;x<0||x>l||y<0||y>=a||(r.fU[x+y*(l+1)]+=n*f[g]*f[3+h])}d=Math.floor(t/u-1),m=t/u-.5-d,f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2,p=Math.floor(e/u-.5),m=e/u-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1){const x=d+g,y=p+h;x<0||x>=l||y<0||y>a||(r.fV[x+y*l]+=i*f[g]*f[3+h])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:l,ny:a,dx:u}=c,f=c.phi,d=Math.max(1.5*s,s+2*u),m=s*s,p=d*d,h=Math.max(0,Math.floor((t-d)/u)),g=Math.min(l,Math.ceil((t+d)/u)),x=Math.max(0,Math.floor((e-d)/u)),y=Math.min(a,Math.ceil((e+d)/u));let b=0,_=0;for(let F=0;F<2;F+=1){if(F===1){if(!(b>0)||!(_>0))return!1;b=n/b,_=i/_}for(let A=x;A<=y;A+=1)for(let P=h;P<=g;P+=1){if(A<a){const w=P*u-t,k=(A+.5)*u-e,S=w*w+k*k;if(S>=m&&S<=p){const T=P+A*l,M=.5*((P>0?f[T-1]:0)+(P<l?f[T]:0));M>0&&(F===0?b+=M:r.fU[P+A*(l+1)]+=b*M)}}if(P<l){const w=(P+.5)*u-t,k=A*u-e,S=w*w+k*k;if(S>=m&&S<=p){const T=P+A*l,M=.5*((A>0?f[T-l]:0)+(A<a?f[T]:0));M>0&&(F===0?_+=M:r.fV[T]+=_*M)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,c=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=c)return 2*i*s;const l=(n-r)/(c-r);return(1-l)*(Math.PI*s*s)/4+l*s*s}}class Bf{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function ul(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const _d=8,Fd=210,dl=1.805,Pd=3e-7;function Go(o,t){const e=St(t);return St(t+2*Fi(e)/o)-e}const xe=class xe{constructor(){v(this,"count",0);v(this,"fixed",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"mat",new Uint8Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"nx",new Float32Array(0));v(this,"ny",new Float32Array(0));v(this,"body",new Int16Array(0));v(this,"seg",new Int32Array(0));v(this,"t",new Float32Array(0));v(this,"pos",new Float64Array(2));v(this,"sg",new Float64Array(6))}static rRef(){if(xe.ref>0)return xe.ref;const t=St(ei),e=2*Fi(t)/(ci(t+1)-ei);return xe.ref=Fd*e,xe.ref}static draw(t,e,s,n){const i=ht[s],r=xe.rRef(),c=xe.rng;c.state=t||1;const l=Math.pow(r/i.cavRmax,dl);let a=0;for(let u=0;u<_d;u+=1){a+=c.exp();const f=r*Math.pow(a/(e*i.cavScale)+l,-1/dl);if(f<Pd)break;n.r.push(f),n.s.push(c.next()),n.z.push(c.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,c=[],l=[],a=[],u=[],f=[],d=[],m=[],p={r:[],s:[],z:[]};for(let _=0;_<t.n;_+=1){if(t.solid[_]===0||t.owner[_]!==0)continue;const F=_%n,A=(_-F)/n;for(let P=0;P<4;P+=1){const w=P===0?F-1:P===1?F+1:F,k=P===2?A-1:P===3?A+1:A;if(w<0||k<0||w>=n||k>=i)continue;const S=w+k*n;if(t.solid[S]===0){p.r.length=0,p.s.length=0,p.z.length=0,xe.draw(ul(e,_,P),r,t.solid[_]-1,p);for(let T=0;T<p.r.length;T+=1)c.push(_),l.push(S),a.push(P),u.push(p.r[T]),f.push(p.s[T]),d.push(p.z[T]),m.push(t.solid[_]-1)}}}const h=c.length,g=[],x=[],y=[];for(const _ of s)if(!_.gone)for(let F=0;F<_.nseg;F+=1){_.segment(F,this.sg);const A=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),P=Math.max(1,Math.round(A/t.dx));for(let w=0;w<P;w+=1){p.r.length=0,p.s.length=0,p.z.length=0,xe.draw(ul(e,1e5+1e3*_.key+F,w),A/P*t.depth,_.mat,p);for(let k=0;k<p.r.length;k+=1)c.push(-1),l.push(-1),a.push(_.segS[F]),u.push(p.r[k]),f.push(p.s[k]),d.push(p.z[k]),m.push(_.mat),g.push(_.index),x.push(F),y.push((w+p.s[k])/P)}}const b=c.length;this.count=b,this.fixed=h,this.cell=Int32Array.from(c),this.fluid=Int32Array.from(l),this.dir=Uint8Array.from(a),this.r=Float32Array.from(u),this.s=Float32Array.from(f),this.z=Float32Array.from(d),this.bubble=new Uint32Array(b),this.mat=Uint8Array.from(m),this.px=new Float64Array(b),this.py=new Float64Array(b),this.nx=new Float32Array(b),this.ny=new Float32Array(b),this.body=new Int16Array(b).fill(-1),this.seg=new Int32Array(b),this.t=new Float32Array(b);for(let _=0;_<h;_+=1){const F=this.cell[_],A=F%n,P=(F-A)/n,w=this.s[_],k=this.dir[_],S=t.dx;this.px[_]=k===0?A*S:k===1?(A+1)*S:(A+w)*S,this.py[_]=k===2?P*S:k===3?(P+1)*S:(P+w)*S,this.nx[_]=k===0?-1:k===1?1:0,this.ny[_]=k===2?-1:k===3?1:0}for(let _=h;_<b;_+=1)this.body[_]=g[_-h],this.seg[_]=x[_-h],this.t[_]=y[_-h];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const c=this.t[i],l=this.sg[0]+c*(this.sg[2]-this.sg[0]),a=this.sg[1]+c*(this.sg[3]-this.sg[1]),u=Math.cos(r.a),f=Math.sin(r.a),d=r.x+u*l-f*a,m=r.y+f*l+u*a,p=u*this.sg[4]-f*this.sg[5],h=f*this.sg[4]+u*this.sg[5];this.px[i]=d,this.py[i]=m,this.nx[i]=p,this.ny[i]=h,this.dir[i]=Math.abs(p)>=Math.abs(h)?p<0?0:1:h<0?2:3;const g=t.cellAt(d-n*p,m-n*h),x=t.cellAt(d+n*p,m+n*h);this.cell[i]=g,this.fluid[i]=x>=0&&t.solid[x]===0?x:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)ht[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};v(xe,"ref",0),v(xe,"rng",new Bf(1));let Uo=xe;const kd=.0208,Ad=1;class Sd{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new Uo);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new wd(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return Go(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:c}=n,l=Math.min(i-1.0001,Math.max(0,t/c-.5)),a=Math.min(r-1.0001,Math.max(0,e/c-.5)),u=Math.floor(l),f=Math.floor(a),d=l-u,m=a-f;let p=0,h=0;for(let g=0;g<2;g+=1)for(let x=0;x<2;x+=1){const y=u+x+(f+g)*i;if(n.solid[y]!==0)continue;const b=(x===0?1-d:d)*(g===0?1-m:m);p+=b*n.pl[y],h+=b}return Math.max(.5*s.pRef,s.pRef+(h>0?p/h:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=ll(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,c=0;for(let l=0;l<i;l+=1){const a=this.cells[l];s.kind[a]===rt&&(this.cells[c]=a,this.wts[c]=this.wts[l],r+=this.wts[l],c+=1)}for(let l=0;l<c;l+=1)this.wts[l]/=r;return r>0?c:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;yd(s.m,t*ut,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:c}=s;for(let a=0;a<r;a+=1){if(c[a]!==rt){this.budget[a]=0,this.tsatCell[a]=0,this.dTb[a]=0;continue}const u=Math.max(.5*e.pRef,e.pRef+s.pl[a]),f=i.boilingAt(a,u);this.tsatCell[a]=f,i.salty&&(this.dTb[a]=f-St(u)),this.budget[a]=i.Cl[a]*(i.Tl[a]-f)}this.Fm.fill(0),e.extremes.beginStep();const l=e.waterTemperature();if(this.bulkCold=l.mass>0&&l.mean<=St(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let a=0;a<n.count;a+=1)this.advance(a,t);if(this.coalesce(),e.extremes.normalize)for(let a=0;a<n.count;a+=1)n.r[a]>e.extremes.bubbleCap&&this.vent(a);for(let a=n.count-1;a>=0;a-=1)this.finish(a,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const c=this.sites.fluid[r],l=this.sites.cell[r];if(c<0||l<0||s.kind[c]!==rt||i.acc[c]<=0||i.waterShare(c)<.5||!e.heat.hasSolid(l))continue;const a=ht[this.sites.mat[r]],u=i.Tl[c],f=zn(i.host[c],u),d=(a.k*s.Ts[l]+f*u)/(a.k+f),m=Math.max(.5*e.pRef,e.pRef+s.pl[c]),p=this.tsatCell[c]>0?this.tsatCell[c]:St(m);if(d-p<0)continue;const h=this.sites.r[r];if(d-p<e.extremes.activation(Go(h,m)))continue;const g=m+2*bn(i.host[c],d)/h,x=St(g),y=4/3*Math.PI*h*h*h,b=Ne(x)*y;if(b*4>i.acc[c])continue;const _=this.sites.position(this.e.grid,r,h),F=n.add(_[0],_[1],Math.min(s.depth-h,Math.max(h,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*ut+Q]=b,n.r[F]=h,n.V[F]=y,n.Tb[F]=x,n.pb[F]=g,n.pv[F]=g,n.H[F]=b*xt(x),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const A=i.waterH(c);this.Fm[c]-=b,e.heat.src[l]-=b*(xt(x)-A)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=d-p,this.firstMaterial=a.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,c=t*ut;let l=i.site[t],a=0;const u=i.V[t];let f=0,d=u;for(;a<e-1e-12;){d=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let h=Math.min(e-a,Math.max(1e-7,Ad*i.age[t]),.25*n.dx/(p+1e-9));h<1e-7&&(h=Math.min(e-a,1e-7));let g,x=-1,y=0;if(l>=0){const Z=this.sites.fluid[l],j=this.sites.cell[l];if(Z<0||j<0||!s.heat.hasSolid(j)){this.detach(t),l=-1;continue}const B=ht[this.sites.mat[l]],C=r.Tl[Z],D=zn(r.host[Z],C);g=(B.k*n.Ts[j]+D*C)/(B.k+D),x=j}else{if(y=this.liquidFootprint(t),y===0)break;g=0;for(let Z=0;Z<y;Z+=1)g+=this.wts[Z]*r.Tl[this.cells[Z]]}let b=0;if(r.salty)if(l>=0)b=this.dTb[this.sites.fluid[l]];else for(let Z=0;Z<y;Z+=1)b+=this.wts[Z]*this.dTb[this.cells[Z]];const _=i.Tb[t],F=l>=0?r.host[this.sites.fluid[l]]:r.hostAt(i.x[t],i.y[t]),A=zn(F,g),P=Ds(F,g),w=pc(F,g),k=oi(F,g),S=A/(P*w),T=2*m,M=i.age[t],O=A*Math.sqrt(3/(Math.PI*S)),q=l>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),N=P*q*T/k,L=k*w/A,R=A/T*(2+.6*Math.sqrt(N)*Math.cbrt(L)),E=xt(_)-kt(g);let I=Math.max(O*2*(Math.sqrt(M+h)-Math.sqrt(M)),R*h);if(l>=0&&g>_+b){const Z=.5*this.fritz(t,g),j=i.m[c+Q]>0?i.m[c+Q]/i.V[t]:Ne(_),B=I*(g-_-b)/(j*E);if(m<Z&&m+B>Z&&B>0){const C=I*(Z-m)/B;if(R*h>=O*2*(Math.sqrt(M+h)-Math.sqrt(M)))h=C/R;else{const D=Math.sqrt(M)+C/(2*O);h=D*D-M}h=Math.max(1e-9,Math.min(e-a,h*(1+1e-6))),I=Math.max(O*2*(Math.sqrt(M+h)-Math.sqrt(M)),R*h)}}const z=n.depth,G=i.V[t],X=i.m[c+Q]>0?i.m[c+Q]/G:Ne(_),nt=I*(g-_-b)/(X*E),bt=Math.max(0,m+nt);let ct;G<=Math.PI*z*z*z/6?ct=4/3*Math.PI*(bt*bt*bt-m*m*m):G>=Math.PI*z*z*z/4?ct=Math.PI*z*(bt*bt-m*m):ct=Math.PI*z*z*I*(g-_-b)/(X*E);let W=X*ct*E;if(l>=0){const Z=x,j=s.heat.solidCap(Z)*Math.max(0,n.Ts[Z]-_);if(W>0&&(W=Math.min(W,Math.max(0,j-this.used(Z)))),W>0){const B=W;W=Math.min(W,s.extremes.wallLeft(Z,e)),s.extremes.takeWall(Z,W,B)}}else{let Z=0;for(let j=0;j<y;j+=1)Z+=this.wts[j]*this.budget[this.cells[j]];W>0?W=Math.min(W,Math.max(0,Z)):W=Math.max(W,Math.min(0,Z))}let H=W/E;H<0&&(H=Math.max(H,-i.m[c+Q]));let st=1,wt=!1;if(l<0&&H!==0&&!r.mixed)for(let Z=0;Z<y&&!wt;Z+=1)wt=r.acc[this.cells[Z]]<=0;const mt=Z=>r.acc[Z]>0?r.waterShare(Z):0;if(l<0&&H!==0&&(r.mixed||wt)){st=0;for(let Z=0;Z<y;Z+=1)st+=this.wts[Z]*mt(this.cells[Z]);H*=st}if(H!==0){if(l>=0){const Z=this.sites.fluid[l];H>0&&r.acc[Z]+this.Fm[Z]-H<0&&(H=Math.max(0,r.acc[Z]+this.Fm[Z]));const j=r.waterH(Z);this.Fm[Z]-=H,s.heat.src[x]-=H*(xt(_)-j)/e,this.budgetSolid(x,H*(xt(_)-j))}else for(let Z=0;Z<y;Z+=1){const j=this.cells[Z],B=r.mixed||wt?this.wts[Z]*mt(j)/st:this.wts[Z];if(B===0)continue;const C=r.waterH(j);this.Fm[j]-=H*B,s.heat.src[j]-=H*B*(xt(_)-C)/e,this.budget[j]-=H*B*(xt(_)-C)}i.m[c+Q]+=H,i.H[t]+=H*xt(_),f+=H}if(this.solve(t,g),this.restoreEnthalpy(t,l,y,e),i.r[t]<1e-6||i.m[c+Q]<=1e-18&&i.m[c+lt]+i.m[c+at]<=0){i.age[t]+=h;break}if(l>=0){const Z=this.sites.position(this.e.grid,l,i.r[t]);i.x[t]=Z[0],i.y[t]=Z[1],this.departure(t,g),l=i.site[t]}else this.motion.move(t,h,(i.V[t]-d)/h);if(i.age[t]+=h,a+=h,i.m[c+Q]<=0&&i.m[c+lt]+i.m[c+at]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,c=cl(r.m,t*ut,r.Tb[t],ue),l=c-r.H[t];if(l===0)return;if(e>=0){r.H[t]=c,i.heat.src[this.sites.cell[e]]-=l/n;return}const a=i.phase.Cl;let u=0;for(let f=0;f<s;f+=1)a[this.cells[f]]>0&&(u+=this.wts[f]);if(u>0){r.H[t]=c;for(let f=0;f<s;f+=1){const d=this.cells[f];a[d]>0&&(i.heat.src[d]-=l*this.wts[f]/(u*n))}}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=ht[this.sites.mat[i]],c=this.contactAngleOverride??r.contactAngle,l=n.totalMass(t)/Math.max(1e-30,n.V[t]),a=s.phase.host[this.sites.fluid[i]];return kd*c*Math.sqrt(bn(a,n.Tb[t])/(s.gy*(Ds(a,e)-l)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),c=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(c<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=c,this.departureCount+=1;const l=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],l),this.motion.ux0[t]=l[0],this.motion.uy0[t]=l[1],n.vx[t]=l[0],n.vy[t]=l[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let c=0;for(let a=0;a<s.count;a+=1){const u=e.cellAt(s.x[a],s.y[a]);if(u<0){this.next[a]=-1;continue}this.next[a]=this.head[u],this.head[u]=a,s.r[a]>c&&(c=s.r[a])}const l=Math.ceil(2*c/r);for(let a=0;a<s.count;a+=1){if(s.V[a]<=0)continue;const u=Math.floor(s.x[a]/r),f=Math.floor(s.y[a]/r);for(let d=Math.max(0,f-l);d<=Math.min(i-1,f+l);d+=1)for(let m=Math.max(0,u-l);m<=Math.min(n-1,u+l);m+=1)for(let p=this.head[m+d*n];p>=0;p=this.next[p]){if(p<=a||s.V[p]<=0)continue;const h=s.x[p]-s.x[a],g=s.y[p]-s.y[a],x=e.depth,b=2*s.r[a]>=x||2*s.r[p]>=x?0:s.z[p]-s.z[a],_=s.r[a]+s.r[p];h*h+g*g+b*b>=_*_||this.merge(a,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let c=0;c<ut;c+=1)s.m[t*ut+c]+=s.m[e*ut+c],s.m[e*ut+c]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*ut,c=i.totalMass(t);if(i.V[t]<=0||c<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Q]<=1e-18&&i.m[r+lt]+i.m[r+at]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const l=n.cellAt(i.x[t],i.y[t]+i.r[t]),a=n.cellAt(i.x[t],i.y[t]);(l<0||n.kind[l]===$||a<0||n.kind[a]===$)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*ut,c=e.extremes.bubbleCap,l=2*c<=s.depth?4/3*Math.PI*c*c*c:Math.PI*c*c*s.depth;if(!(n.V[t]>l))return;const a=1-l/n.V[t];let u=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;u>=0&&s.kind[u]!==$;)u=u+s.nx<i?u+s.nx:-1;if(u<0&&(u=fl(s,n.x[t])),u<0)return;const f=al(s,e.gas.vgas,u,a*n.V[t],this.cells,this.wts);for(let d=0;d<f;d+=1){const m=this.cells[d],p=this.wts[d];for(let h=0;h<ut;h+=1)s.mg[h*i+m]+=p*a*n.m[r+h];s.Hg[m]+=p*a*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=a*n.m[r+Q],this.burstVapour+=a*n.m[r+Q];for(let d=0;d<ut;d+=1)n.m[r+d]*=1-a;n.H[t]*=1-a,n.V[t]=l,n.r[t]=c}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,c=t*ut,l=i.n,a=r.m[c+Q],u=r.m[c+lt]+r.m[c+at];if(e||u>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==$;)m=m+i.nx<l?m+i.nx:-1;if(m<0&&(m=fl(i,r.x[t])),m>=0){const p=al(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let h=0;h<p;h+=1){const g=this.cells[h],x=this.wts[h];for(let y=0;y<ut;y+=1)i.mg[y*l+g]+=x*r.m[c+y];i.Hg[g]+=x*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=a,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(a>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let h=1;if(p.mixed){h=0;for(let g=0;g<m;g+=1)h+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const x=this.cells[g],y=p.mixed&&h>0?this.wts[g]*p.waterShare(x)/h:this.wts[g];if(y===0)continue;const b=p.waterH(x);this.Fm[x]+=a*y,n.heat.src[x]+=y*(r.H[t]-a*b)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[Q*l+p]+=a,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const d=r.count-1;if(t!==d){this.motion.ux0[t]=this.motion.ux0[d],this.motion.uy0[t]=this.motion.uy0[d];const m=r.site[d];m>=0&&(this.sites.bubble[m]=r.id[d])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let u=0;u<n.count;u+=1){const f=ll(n.x[u],n.y[u],n.r[u],n.V[u],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let d=0;d<f;d+=1)i[this.cells[d]]+=this.wts[d]*n.V[u]*r}const c=s.alpha,l=e.liquid.volSrc,a=Mf*t;for(let u=0;u<s.n;u+=1){const f=Math.min(i[u],Math.max(0,1-s.phiS[u])),d=f-c[u];d!==0&&(d>a?(l[u]+=a*s.vCell/t,c[u]+=a):d<-a?(l[u]-=a*s.vCell/t,c[u]-=a):(l[u]+=d*s.vCell/t,c[u]=f))}}spawn(t,e,s,n,i){const r=this.e,c=this.B,l=c.add(t,e,s);if(l<0)return-1;const a=this.pressure(t,e),u=r.grid.cellAt(t,e),f=u>=0&&r.phase.Tl[u]>0?r.phase.Tl[u]:r.ambientT,d=a+2*bn(u>=0?r.phase.host[u]:0,f)/n,m=4/3*Math.PI*n*n*n,p=l*ut;if(i<=0){const h=St(d);c.m[p+Q]=Ne(h)*m}else{const h=d*m/(8.314462618*f);c.m[p+lt]=h*.79*gt[lt],c.m[p+at]=h*.21*gt[at]}return c.r[l]=n,this.solve(l,f),c.H[l]=cl(c.m,p,c.Tb[l],ue),r.ledger.water+=c.m[p+Q],r.ledger.air+=c.m[p+lt]+c.m[p+at],r.ledger.energy+=c.H[l],this.motion.ux0[l]=0,this.motion.uy0[l]=0,l}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*ut,n=t*de;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:St(e.pb[t]),mv:e.m[s+Q],ma:e.m[s+lt]+e.m[s+at],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+de))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return pt}}const Cf=20,Lf=.1,qf=2,Of=.004,Ef=1.5,hl=.006,ml=2;function Td(o,t,e){const s=o==="normalize";return{chf:Rf(t,e)*(s?Lf:1),actMax:s?qf:1e30,vmax:s?Ef:Cf,bubCap:s?Of:1e30}}function Rf(o,t){const e=St(o),s=Ne(e),n=An(e);return .149*Math.sqrt(s)*hc(e)*Math.pow(Math.max(0,Fi(e)*t*(n-s)),.25)}class Md{constructor(t){v(this,"pending",null);v(this,"asked",!1);v(this,"heldHeat",0);v(this,"vented",0);v(this,"slowed",0);v(this,"maxBubble",0);v(this,"maxSpeed",0);v(this,"wall",new Float64Array(0));v(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?Of:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=Rf(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?Lf:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,qf):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?Ef:Cf;let n=0;for(let r=0;r<t.count;r+=1){const c=Math.hypot(t.vx[r],t.vy[r]);if(c>s){const l=s/c;t.vx[r]*=l,t.vy[r]*=l,this.slowed+=1,n=Math.max(n,s)}else c>n&&(n=c)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>hl?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>ml&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}observe(t,e,s){this.maxBubble=t,this.maxSpeed=e,!(this.mode!=="ask"||this.asked)&&(t>hl?(this.pending={kind:"bubble",value:t,time:s},this.asked=!0):e>ml&&(this.pending={kind:"speed",value:e,time:s},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function pl(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const Bd={mass:0,energy:0},Cd={m:0,H:0,s:0},Ld={salt:0,energy:0};function qd(o,t,e,s,n,i,r=Bd,c=[],l=Cd,a=Ld){const u=o.n;let f=0,d=0,m=0,p=0,h=0,g=0,x=0;for(let O=0;O<u;O+=1){const q=o.owner[O]!==0||o.capB[O]>0;if(o.kind[O]===pt||o.solid[O]!==0){q||(f+=o.Es[O],h+=o.film[O],g+=o.crust[O]);continue}d+=o.Hg[O],m+=o.mg[Q*u+O],p+=o.mfog[O],x+=o.mg[lt*u+O]+o.mg[at*u+O]}let y=0,b=0,_=0,F=0;for(let O=0;O<t.count;O+=1){y+=t.mass[O]*t.h[O];const q=t.smass[2*O];F+=q,t.mat[O]===dt?b+=t.mass[O]-q:_+=t.mass[O]-q}f+=r.energy,f+=a.energy;let A=0;for(const O of c)O.gone||(f+=O.energy(),h+=O.filmMass(),g+=O.crustMass(),me(O.mat)>0&&(A+=O.m));y+=l.H,b+=l.m,F+=l.s;let P=0,w=0;for(let O=0;O<e.count;O+=1)P+=e.H[O],w+=e.m[O*ut+Q],x+=e.m[O*ut+lt]+e.m[O*ut+at];const k=s.pvTerm();i.solids=f,i.liquid=y,i.gas=d,i.bubbles=P,i.pv=k,i.energy=f+y+d+P+k;const S=i.water;S.liquid=b,S.ice=A,S.vapour=m,S.fog=p,S.film=h,S.bubbles=w,S.escaped=n.escapedWater,S.total=b+A+m+p+h+w+n.escapedWater;const T=i.other;T.liquid=_,T.escaped=n.escapedOther,T.total=_+n.escapedOther;const M=i.salt;return M.liquid=F,M.crust=g,M.grains=a.salt,M.floor=r.mass,M.escaped=n.escapedSalt,M.total=F+g+a.salt+r.mass+n.escapedSalt,i.air=x+n.escapedAir,i}function Od(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,grains:0,floor:0,escaped:0,total:0}}}function Dn(o,t){o.bodies.list.length!==0&&ad(o.bodies,t,o.ledger)}function Ed(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)jt.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(Li(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)jt.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*ut+Q],o.ledger.air-=n.m[i*ut+lt]+n.m[i*ut+at],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function oo(o,t,e,s,n,i,r,c,l=-1){const a=o.bodies.adopt(t,e,s,o.opIndex,n,l);if(a===null)return null;i!==0&&o.bodies.turn(a,r,c,i*Math.PI/180),o.ledger.energy+=a.energy(),me(a.mat)>0&&(o.ledger.water+=a.m),Ed(o,a);const u=o.grid,f=new Map,d=u.dx*u.dx;for(let m=0;m<a.nw;m+=1){const p=a.wc[m];f.set(p,(f.get(p)??0)+a.ww[m]*a.cellVolume(a.wk[m])/(a.depth*d))}for(const[m,p]of f)p>0&&u.solid[m]===0&&Rd(o,m,Math.min(1,p));return a}function nr(o,t,e){const[s,n,i,r]=Ln(t),c=Math.max(0,Math.floor(s/o.dx)),l=Math.min(o.nx-1,Math.ceil(i/o.dx)),a=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=a;f<=u;f+=1)for(let d=c;d<=l;d+=1)es(t,(d+.5)*o.dx,(f+.5)*o.dx)&&e(d+f*o.nx,d,f)}function Ci(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Q*s+t]+e.mfog[t],o.ledger.air-=e.mg[lt*s+t]+e.mg[at*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<ut;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function Rd(o,t,e){if(e>=1){Ci(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[Q*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[lt*n+t]+s.mg[at*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<ut;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function Bc(o,t,e,s){const n=o.grid,i=n.n;Ci(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Q*i+t],o.ledger.air+=n.mg[lt*i+t]+n.mg[at*i+t],o.ledger.energy+=n.Hg[t]}function Li(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===dt?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function Cc(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function If(o,t){const e=o.grains,s=o.grid;for(let n=0;n<e.count;n+=1)(t!==null?!es(t,e.x[n],e.y[n]):s.solid[Math.max(0,s.cellAt(e.x[n],e.y[n]))]===0)||(je[e.mat[n]].dissolves&&(o.ledger.salt-=e.m[n]),o.ledger.energy-=e.enthalpy(n),e.remove(n),n-=1)}function co(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)es(t,e.x[n],e.y[n])&&(Li(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)es(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*ut+Q],o.ledger.air-=s.m[n*ut+lt]+s.m[n*ut+at],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function Id(o,t,e,s,n){const i=o.grid,r=ht[e];for(const l of t)i.owner[l]!==0&&i.solid[l]!==0||(i.solid[l]!==0?(o.ledger.energy-=i.Es[l],o.ledger.water-=i.film[l],Cc(o,l)):Ci(o,l),i.owner[l]=0,i.capB[l]=0,i.fs[l]=0,i.crust[l]=0,i.solid[l]=e+1,i.role[l]=0,i.heater[l]=n,i.film[l]=0,i.T[l]=s,i.Es[l]=r.rho*r.cp*i.vCell*(s-et),i.kind[l]=pt,o.ledger.energy+=i.Es[l]);If(o,null);const c=o.particles;for(let l=0;l<c.count;l+=1){const a=i.cellAt(c.x[l],c.y[l]);a<0||i.solid[a]===0||(Li(o,l),o.liquid.removeParticle(l),l-=1)}o.solidsChanged()}function Nd(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],Cc(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&Bc(o,n,o.ambientT,o.ambientY)}}function jd(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){co(o,t.region);const g=new Float64Array(ut);let x=0;for(const[y,b]of Object.entries(t.composition)){const _=y==="N2"?lt:y==="O2"?at:y==="H2O"?Q:-1;_>=0&&(g[_]=b,x+=b)}if(x<=0)g.set(o.ambientY.subarray(0,ut));else for(let y=0;y<Ft;y+=1)g[y]/=x;return nr(e,t.region,y=>{e.solid[y]===0&&Bc(o,y,t.T,g)}),null}co(o,t.region);const s=oe.length;let n=0;for(const[g,x]of Object.entries(t.composition))tf(g)>=0&&x>0&&(n+=x);const i=t.composition[oe[dt].id]??0,r=n>0&&i>0?n/(n+i):0,c=g=>g===dt&&r>0?Vr(t.T,r):Ds(g,t.T),l=new Float64Array(s);let a=0;for(const[g,x]of Object.entries(t.composition)){const y=Ua(g);if(y<0||!(x>0))continue;const b=y===dt&&r>0?x+n:x;l[y]+=b/c(y),a+=b/c(y)}if(a<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)l[g]/=a;const u=new Float64Array(s),f=new Float64Array(s);for(let g=0;g<s;g+=1)u[g]=c(g)*e.vCell/4,f[g]=g===dt&&r>0?af(t.T,r):B0(g,t.T);const d=r*u[dt],m=new Float64Array(s),p=o.particles;let h=!1;return vl(e,t.region,(g,x)=>{const y=g+x*e.nx;if(e.solid[y]!==0)return;let b=0;for(let _=0;_<2;_+=1)for(let F=0;F<2;F+=1){const A=(g+.25+.5*F)*e.dx,P=(x+.25+.5*_)*e.dx;if(!es(t.region,A,P)||e.owner[y]!==0&&o.bodies.bodyAt(A,P,0)!==null)continue;let w=0;for(let M=0;M<s;M+=1)m[M]+=l[M],m[M]>m[w]&&(w=M);m[w]-=1;const k=u[w],S=f[w],T=w===dt?d:0;if(p.add(A,P,k,S,w,T)<0){h=!0;continue}b+=1,w===dt?o.ledger.water+=k-T:o.ledger.other+=k,o.ledger.salt+=T,o.ledger.energy+=k*S}b===4&&Ci(o,y)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":h?"fill: particle capacity reached":null}case"grains":{const s=ff(t.material);if(s<0)return`grains: unknown material "${t.material}"`;const n=je[s],i=n.rho*eu*e.vCell/4,r=i/(n.rho*Math.PI*t.d*t.d*t.d/6);let c=!1;const l=new Uint8Array(e.n);for(let a=0;a<o.grains.count;a+=1){const u=e.cellAt(o.grains.x[a],o.grains.y[a]);u>=0&&(l[u]=1)}return vl(e,t.region,(a,u)=>{const f=a+u*e.nx;if(!(e.solid[f]!==0||l[f]!==0))for(let d=0;d<2;d+=1)for(let m=0;m<2;m+=1){const p=(a+.25+.5*m)*e.dx,h=(u+.25+.5*d)*e.dx;if(es(t.region,p,h)&&!(e.owner[f]!==0&&o.bodies.bodyAt(p,h,0)!==null)){if(o.grains.add(p,h,i,r,t.T,s)<0){c=!0;continue}n.dissolves&&(o.ledger.salt+=i),o.ledger.energy+=i*n.cp*(t.T-et)}}}),c?"grains: capacity reached":null}case"erase":{Dn(o,t.region),co(o,t.region),If(o,t.region);const s=[];return nr(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),Nd(o,s),null}case"move":{if(t.region!==null)return bl(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(l=>!l.gone&&l.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const l of s)l.worldBox(l.x,l.y,l.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,c=l=>s.includes(l)?!0:(l.worldBox(l.x,l.y,l.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return bl(o,{rect:i},t.dx,t.dy,c),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if(ud(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=un(t.material);if(s<0)return`solid: unknown material ${t.material}`;Dn(o,t.region);const n=[];if(nr(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,c,l]=t.region.line,a=Math.ceil(Math.hypot(c-i,l-r)/(.5*e.dx))+1;for(let u=0;u<=a;u+=1){const f=e.cellAt(i+(c-i)*u/a,r+(l-r)*u/a);f>=0&&!n.includes(f)&&n.push(f)}}return o.bodies.sync(),Id(o,n,s,t.T,-1),null}case"body":{const s=un(t.material);if(s<0)return`body: unknown material ${t.material}`;Dn(o,t.region);const n=t.region;let i=null,r,c=t.angle,l,a;if("line"in n){const[u,f,d,m]=n.line,p=Math.max(n.width,Math.hypot(d-u,m-f));l=(u+d)/2,a=(f+m)/2,r=[l-p/2,a-n.width/2,l+p/2,a+n.width/2],c+=Math.atan2(m-f,d-u)*180/Math.PI}else if("circle"in n){const[u,f,d]=n.circle,m=.5*d*Math.sqrt(Math.PI);r=[u-m,f-m,u+m,f+m],l=u,a=f,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[u,f,d,m]=Ln(n);r=[u,f,d,m],l=(u+d)/2,a=(f+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return oo(o,[r],s,t.T,t.pinned,c,l,a),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=un(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,c=t.y,l=t.y+t.h,a=t.lid?l-n:l,u=[[i,c,r,c+n],[i,c+n,i+n,a],[r-n,c+n,r,a]];t.lid&&u.push([i,a,r,l]);for(const f of u)Dn(o,{rect:[...f]});return oo(o,u,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=un(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return Dn(o,{rect:[...i]}),oo(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function bl(o,t,e,s,n){const i=o.grid,{nx:r,ny:c,dx:l}=i,a=[];nr(i,t,y=>{i.solid[y]!==0&&i.owner[y]===0&&a.push(y)});const u=Math.round(e/l),f=Math.round(s/l),d=a.length>0?u*l:e,m=a.length>0?f*l:s;if(d===0&&m===0)return;const p=o.bodies.list.length>0?fd(o.bodies,t,n):[],h=o.particles,g=o.bubbles;for(let y=0;y<h.count;y+=1){if(!es(t,h.x[y],h.y[y]))continue;const b=h.x[y]+d,_=h.y[y]+m;if(b<=0||_<=0||b>=i.w||_>=i.h){Li(o,y),o.liquid.removeParticle(y),y-=1;continue}h.x[y]=b,h.y[y]=_}for(let y=0;y<g.count;y+=1)es(t,g.x[y],g.y[y])&&(g.x[y]=Math.min(i.w-1e-6,Math.max(1e-6,g.x[y]+d)),g.y[y]=Math.min(i.h-1e-6,Math.max(1e-6,g.y[y]+m)),g.site[y]=-1);if(o.liquid.weightsDirty=!0,a.length===0){if(p.length===0)return;nl(o.bodies,p,d,m),o.bodies.sync();for(const y of p)o.bodies.cover.pushOut(y,y.x,y.y,y.a);gl(o);return}const x=a.map(y=>({c:y,s:i.solid[y],role:i.role[y],heater:i.heater[y],T:i.T[y],Es:i.Es[y],film:i.film[y],crust:i.crust[y]}));for(const y of x)o.ledger.energy-=y.Es,o.ledger.water-=y.film,o.ledger.salt-=y.crust,i.solid[y.c]=0,i.role[y.c]=0,i.heater[y.c]=-1,i.Es[y.c]=0,i.film[y.c]=0,i.crust[y.c]=0,i.kind[y.c]=0;for(const y of x){const b=y.c%r+u,_=Math.floor(y.c/r)+f;if(b<0||_<0||b>=r||_>=c)continue;const F=b+_*r;i.solid[F]!==0?(o.ledger.energy-=i.Es[F],o.ledger.water-=i.film[F],Cc(o,F)):Ci(o,F),i.solid[F]=y.s,i.role[F]=y.role,i.heater[F]=y.heater,i.T[F]=y.T,i.Es[F]=y.Es,i.film[F]=y.film,i.crust[F]=y.crust,i.kind[F]=pt,o.ledger.energy+=y.Es,o.ledger.water+=y.film,o.ledger.salt+=y.crust}nl(o.bodies,p,d,m),o.solidsChanged();for(const y of p)o.bodies.cover.pushOut(y,y.x,y.y,y.a);gl(o);for(const y of x)i.solid[y.c]===0&&o.gas.massOf(y.c)<=0&&Bc(o,y.c,o.ambientT,o.ambientY)}function gl(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(Li(o,s),o.liquid.removeParticle(s),s-=1)}}function vl(o,t,e){const[s,n,i,r]=Ln(t),c=Math.max(0,Math.floor(s/o.dx)),l=Math.min(o.nx-1,Math.floor(i/o.dx)),a=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=a;f<=u;f+=1)for(let d=c;d<=l;d+=1)e(d,f)}const Dd=new Set(["pinned","mode","power","target","on"]);function hi(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(Sn(n)&&n.id===t)return s}return-1}function Gd(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&un(t.material)>=0?t.material:o.material,r=(c,l,a,u)=>c===void 0||!Number.isFinite(c)?l:Math.max(a,Math.min(u,c));switch(o.op){case"body":{const[c,l,a,u]=Ln(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const f=(c+a)/2,d=(l+u)/2,m=r(t.w,a-c,.002,.5),p=r(t.h,u-l,.002,.5);return{...o,region:{rect:[f-m/2,d-p/2,f+m/2,d+p/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function Ud(o,t,e){const s=hi(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=Gd(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([l,a])=>a!==void 0&&!Dd.has(l)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const l of o.bodies.list)l.gone||l.key!==s||(e.pinned!==void 0&&o.bodies.pin(l,e.pinned),i.op==="hotplate"&&l.heater>=0&&o.setHeater(l.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function Vd(o,t){const e=hi(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,c=0,l="gone";for(const a of o.bodies.list){if(a.gone||a.key!==e)continue;const u=Math.cos(a.a),f=Math.sin(a.a);for(let p=0;p<a.nr;p+=1){const[h,g,x,y]=a.bounds(p);for(const[b,_]of[[h,g],[x,g],[x,y],[h,y]])n.push(a.x+u*b-f*_,a.y+f*b+u*_)}i+=a.m;const d=a.m*ht[a.mat].cp;r+=d*a.meanT(),c+=d;const m=a.pinned?"pinned":a.asleep?"asleep":"moving";(l==="gone"||m==="moving")&&(l=m)}return{id:t,kind:s.op,outline:n,T:c>0?r/c:s.T,mass:i,state:l}}const Hd=.02;function $d(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function Wd(o,t){const e=2*Math.max(0,o-Hd)*t;return e>1e-8?e/$d(e):1}function Kd(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:c}=o,l=s+1,a=(b,_)=>.5*(r[b+_*l]+r[b+1+_*l]),u=(b,_)=>.5*(c[b+_*s]+c[b+(_+1)*s]),f=(r[t+1+e*l]-r[t+e*l])/i,d=(c[t+(e+1)*s]-c[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),h=Math.max(0,t-1),g=Math.min(s-1,t+1),x=p>m?(a(t,p)-a(t,m))/((p-m)*i):0,y=g>h?(u(g,e)-u(h,e))/((g-h)*i):0;return Math.hypot(.5*(f-d),.5*(x+y))}class zd{constructor(t){v(this,"e");v(this,"cap");v(this,"capT");v(this,"capA");v(this,"salt");v(this,"water");v(this,"fH");v(this,"fS");v(this,"outS");v(this,"outH");v(this,"inS");v(this,"inH");v(this,"cell",new Int32Array(0));v(this,"cpp",new Float64Array(0));v(this,"ds",new Float64Array(0));v(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:c,salt:l,water:a,fH:u,fS:f,cell:d,cpp:m}=this;i.fill(0),r.fill(0),c.fill(0),l.fill(0),a.fill(0);let p=!1;for(let b=0;b<e.count;b+=1){const _=s.cellAt(e.x[b],e.y[b]);if(d[b]=_,_<0)continue;const F=e.cp(b);m[b]=F;const A=e.mass[b]*F,P=e.T[b];if(i[_]+=A,r[_]+=A*P,c[_]+=A*zn(e.mat[b],P)/(e.rho[b]*F),e.mat[b]!==dt)continue;const w=e.smass[2*b];l[_]+=w,a[_]+=e.mass[b]-w,w>0&&(p=!0)}const{nx:h,ny:g,kind:x}=s,y=Math.PI*Math.PI*t/(s.dx*s.dx);for(let b=0;b<s.n;b+=1){if(u[b]=0,f[b]=0,!(i[b]>0))continue;const _=b%h,F=(b-_)/h;if(!(x[b]!==rt&&(x[b]!==$||!(_>0&&x[b-1]===rt||_<h-1&&x[b+1]===rt||F>0&&x[b-h]===rt||F<g-1&&x[b+h]===rt)))&&(u[b]=1-Math.exp(-y*c[b]/i[b]),p&&l[b]>0)){const A=Oo(r[b]/i[b]);f[b]=1-Math.exp(-y*A*Wd(Kd(s,_,F),t/(y*A)))}}for(let b=0;b<e.count;b+=1){const _=d[b];if(_<0||u[_]===0)continue;const F=u[_]*(r[_]/i[_]-e.T[b]);if(F===0)continue;const A=e.mass[b]/e.rho[b];e.h[b]+=m[b]*F,e.derive(b),n.dVp[b]+=e.mass[b]/e.rho[b]-A}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:c,outH:l,inS:a,inH:u,cell:f,ds:d,hs:m}=this;c.fill(0),l.fill(0);for(let h=0;h<e.count;h+=1){d[h]=0;const g=f[h];if(g<0||r[g]===0||e.mat[h]!==dt)continue;const x=e.smass[2*h],y=r[g]*(n[g]/i[g]*(e.mass[h]-x)-x);if(d[h]=y,y<0){const b=Vc(e.T[h],x/e.mass[h]);m[h]=b,c[g]-=y,l[g]-=y*b}}const p=this.saltBetween(t);for(let h=0;h<e.count;h+=1){const g=f[h];if(g<0||e.mat[h]!==dt)continue;let x=d[h],y=0;x<0?y=x*m[h]:x>0&&(c[g]>0?y=x*l[g]/c[g]:x=0);const b=e.smass[2*h],_=e.mass[h];if(p&&(a[g]!==0||u[g]!==0)){const P=a[g]<0?b/n[g]:(_-b)/i[g];x+=a[g]*P,y+=u[g]*P}if(x===0&&y===0)continue;const F=_*e.h[h]+y,A=_/e.rho[h];e.mass[h]=_+x,e.smass[2*h]=b+x,e.spc[2*h]=b+x>0?Si:0,e.h[h]=F/e.mass[h],e.derive(h),s.dVp[h]+=e.mass[h]/e.rho[h]-A}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:c,inS:l,inH:a}=this,{nx:u,ny:f}=e;l.fill(0),a.fill(0);const d=t/(e.dx*e.dx);let m=!1;const p=(h,g,x)=>{if(i[g]===0||!(n[g]>0)||!(x>0))return;const y=s[h]/n[h],b=s[g]/n[g];if(y===b)return;const _=y>b?h:g,F=y>b?g:h,A=Oo(.5*(c[h]/r[h]+c[g]/r[g])),P=(x<1?x*A:A)*d*Math.min(n[h],n[g])*Math.abs(y-b),w=Vc(c[_]/r[_],s[_]/(s[_]+n[_]));l[_]-=P,a[_]-=P*w,l[F]+=P,a[F]+=P*w,m=!0};for(let h=0;h<f;h+=1)for(let g=0;g<u;g+=1){const x=g+h*u;i[x]===0||!(n[x]>0)||(g+1<u&&p(x,x+1,e.au[g+1+h*(u+1)]),h+1<f&&p(x,x+u,e.av[x+u]))}return m}}function Yd(o,t){const e=o.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let l=0;l<n;l+=1)for(let a=0;a<s;a+=1){const u=a+l*s;e.solid[u]===0&&(e.kind[u]===rt||es(t.region,(a+.5)*e.dx,(l+.5)*e.dx))&&(i[u]=1)}const r=new Uint8Array(e.n),c=[];for(let l=0;l<e.n;l+=1){if(i[l]===0||r[l]!==0)continue;let a=!1;for(c.push(l),r[l]=1;c.length>0;){const u=c.pop(),f=u%s,d=(u-f)/s,m=o.gas,p=[m.across(u,f,d,0),m.across(u,f,d,1),m.across(u,f,d,2),m.across(u,f,d,3)];(f===0&&e.openL||f===s-1&&e.openR||d===0&&e.openB||d===n-1&&e.openT)&&(a=!0);for(const h of p)if(!(h<0||e.solid[h]!==0)){if(i[h]===0){a=!0;continue}r[h]===0&&(r[h]=1,c.push(h))}}if(!a)return!1}return!0}const zt=Ft+2,ae=Ft,be=Ft+1,Xd=.9,Qd=16;class Xn{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(zt*s),this.fu=new Float64Array(zt*t.nu),this.fv=new Float64Array(zt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:c}=e,l=s+1,a=e.ug,u=e.vg;let f=0,d=0;for(let _=0;_<n;_+=1)for(let F=0;F<s;F+=1){const A=F+_*s;if(r[A]!==$)continue;const P=F+_*l,w=a[P],k=a[P+1],S=u[A],T=u[A+s],M=(w<0?-w:0)+(k>0?k:0)+(S<0?-S:0)+(T>0?T:0);M>f&&(f=M);const O=Math.max(w<0?-w:w,k<0?-k:k,S<0?-S:S,T<0?-T:T);O>d&&(d=O)}this.gas.last.uMax=d;const m=Math.min(Qd,Math.max(1,Math.ceil(f*t/c/Xd))),p=t/m,{conc:h}=this,g=this.gas.vgas,x=e.mg,y=e.mfog,b=e.Hg;for(let _=0;_<m;_+=1){for(let F=0;F<i;F+=1){if(r[F]!==$){for(let P=0;P<zt;P+=1)h[P*i+F]=0;continue}const A=1/g[F];for(let P=0;P<Ft;P+=1)h[P*i+F]=x[P*i+F]*A;h[ae*i+F]=y[F]*A,h[be*i+F]=b[F]*A}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let _=0;_<i;_+=1)r[_]===$&&this.gas.deriveCell(_);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=s+1,l=e.nu,a=e.ug,{conc:u,fu:f}=this,{amb:d,gasU:m}=this.gas,p=e.aFace,h=Xn.face;for(let g=0;g<n;g+=1){const x=g*s,y=g*c;for(let b=0;b<=s;b+=1){const _=y+b,F=a[_];if(m[_]===0||F===0){for(let S=0;S<zt;S+=1)f[S*l+_]=0;continue}const A=e.au[_]<1?F*p*t*e.au[_]:F*p*t;if(b===0||b===s){const S=b===0?x:x+s-1,T=b===0?F>0:F<0;for(let M=0;M<zt;M+=1)f[M*l+_]=A*(T?d[M]:u[M*i+S]);continue}let P,w,k;if(F>0?(P=x+b-1,w=x+b,k=b>=2&&r[x+b-2]===$?x+b-2:-1):(P=x+b,w=x+b-1,k=b+1<s&&r[x+b+1]===$?x+b+1:-1),k<0){for(let S=0;S<zt;S+=1)f[S*l+_]=A*u[S*i+P];continue}for(let S=0;S<zt;S+=1){const T=S*i;f[S*l+_]=A*h(u[T+P],u[T+k],u[T+w])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=e.nv,l=e.vg,{conc:a,fv:u}=this,{amb:f,gasV:d}=this.gas,m=e.aFace,p=Xn.face;for(let h=0;h<=n;h+=1){const g=h*s;for(let x=0;x<s;x+=1){const y=g+x,b=l[y];if(d[y]===0||b===0){for(let w=0;w<zt;w+=1)u[w*c+y]=0;continue}const _=e.av[y]<1?b*m*t*e.av[y]:b*m*t;if(h===0||h===n){const w=h===0?x:x+(n-1)*s,k=h===0?b>0:b<0;for(let S=0;S<zt;S+=1)u[S*c+y]=_*(k?f[S]:a[S*i+w]);continue}let F,A,P;if(b>0?(F=y-s,A=y,P=h>=2&&r[y-2*s]===$?y-2*s:-1):(F=y,A=y-s,P=h+1<n&&r[y+s]===$?y+s:-1),P<0){for(let w=0;w<zt;w+=1)u[w*c+y]=_*a[w*i+F];continue}for(let w=0;w<zt;w+=1){const k=w*i;u[w*c+y]=_*p(a[k+F],a[k+P],a[k+A])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,c=t.nv,{fu:l,fv:a}=this,{gasU:u,gasV:f,escaped:d}=this.gas,m=t.mg,p=t.mfog,h=t.Hg;for(let g=0;g<s;g+=1){const x=g*e,y=g*i;for(let _=1;_<e;_+=1){const F=y+_;if(u[F]===0)continue;const A=x+_-1,P=A+1;for(let S=0;S<Ft;S+=1){const T=l[S*r+F];m[S*n+A]-=T,m[S*n+P]+=T}const w=l[ae*r+F];p[A]-=w,p[P]+=w;const k=l[be*r+F];h[A]-=k,h[P]+=k}if(u[y]!==0){const _=x;for(let P=0;P<Ft;P+=1){const w=l[P*r+y];m[P*n+_]+=w,d[P]-=w}const F=l[ae*r+y];p[_]+=F,d[ae]-=F;const A=l[be*r+y];h[_]+=A,d[be]-=A}const b=y+e;if(u[b]!==0){const _=x+e-1;for(let P=0;P<Ft;P+=1){const w=l[P*r+b];m[P*n+_]-=w,d[P]+=w}const F=l[ae*r+b];p[_]-=F,d[ae]+=F;const A=l[be*r+b];h[_]-=A,d[be]+=A}}for(let g=1;g<s;g+=1){const x=g*e;for(let y=0;y<e;y+=1){const b=x+y;if(f[b]===0)continue;const _=b-e,F=b;for(let w=0;w<Ft;w+=1){const k=a[w*c+b];m[w*n+_]-=k,m[w*n+F]+=k}const A=a[ae*c+b];p[_]-=A,p[F]+=A;const P=a[be*c+b];h[_]-=P,h[F]+=P}}for(let g=0;g<e;g+=1){if(f[g]!==0){const y=g;for(let F=0;F<Ft;F+=1){const A=a[F*c+g];m[F*n+y]+=A,d[F]-=A}const b=a[ae*c+g];p[y]+=b,d[ae]-=b;const _=a[be*c+g];h[y]+=_,d[be]-=_}const x=g+s*e;if(f[x]!==0){const y=g+(s-1)*e;for(let F=0;F<Ft;F+=1){const A=a[F*c+x];m[F*n+y]-=A,d[F]+=A}const b=a[ae*c+x];p[y]-=b,d[ae]+=b;const _=a[be*c+x];h[y]-=_,d[be]+=_}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:c,outM:l,scale:a}=this,u=t.nu,f=t.nv;l.fill(0);const d=Xn.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const y=x+g*i;if(m[y]===0)continue;const b=d(r,u,y);b>0&&x>0?l[x-1+g*e]+=b:b<0&&x<e&&(l[x+g*e]-=b)}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const y=x+g*e;if(p[y]===0)continue;const b=d(c,f,y);b>0&&g>0?l[x+(g-1)*e]+=b:b<0&&g<s&&(l[x+g*e]-=b)}let h=!1;for(let g=0;g<n;g+=1){const x=.9*this.gas.massOf(g);a[g]=l[g]>x&&l[g]>0?x/l[g]:1,a[g]<1&&(h=!0)}if(h){for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const y=x+g*i;if(m[y]===0)continue;const _=d(r,u,y)>0?x>0?x-1+g*e:-1:x<e?x+g*e:-1;if(!(_<0||a[_]>=1))for(let F=0;F<zt;F+=1)r[F*u+y]*=a[_]}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const y=x+g*e;if(p[y]===0)continue;const _=d(c,f,y)>0?g>0?x+(g-1)*e:-1:g<s?x+g*e:-1;if(!(_<0||a[_]>=1))for(let F=0;F<zt;F+=1)c[F*f+y]*=a[_]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=ae;i+=1)n+=t[i*e+s];return n}}const ee=.05,Zd=400;class Jd{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(zt));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(zt));v(this,"dp0",new Float64Array(8));v(this,"queue");v(this,"seen");v(this,"seenTag",0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.queue=new Int32Array(n),this.seen=new Int32Array(n),this.mover=new Xn(t,this)}setAmbient(t,e,s){let n=0;for(let c=0;c<Ft;c+=1)n+=s[c]/gt[c];const i=e/(Ut*t*n);let r=0;for(let c=0;c<Ft;c+=1)this.amb[c]=i*s[c],r+=i*s[c]*ue(c,t);this.amb[ae]=0,this.amb[be]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*kt(e);for(let r=0;r<Ft;r+=1)i+=s.mg[r*n+t]*ue(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Co(s.mg[t],s.mg[n+t],s.mg[Q*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],c=e.mg[Q*s+t],l=e.mfog[t],a=i+r+c;if(this.nmol[t]=i/gt[0]+r/gt[1]+c/gt[Q],a+l<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let u;if(l<=0)u=ja(i,r,c,e.Hg[t]);else{u=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const d=(e.Hg[t]-this.enthalpy(t,u))/this.heatCapacity(t,u);if(u+=d,Math.abs(d)<1e-10)break}}u>150&&u<3e3||(u=Math.min(3e3,Math.max(150,Number.isFinite(u)?u:this.ambT))),e.T[t]=u,this.cap[t]=Co(i,r,c,l,u),this.rho[t]=a/n,this.mu[t]=Na(i,r,c,u)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===pt){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===rt&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Ut*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===pt){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Q*e+s];if(t.kind[s]===rt&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Ut*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===pt||this.vgas[e]<=0?0:this.nmol[e]*Ut*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<Ft;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,c=Math.max(.001,n)*i.vCell;let l=0;for(let f=0;f<Ft;f+=1)l+=s[f]/gt[f];const a=this.R.pAt(t)*c/(Ut*e*l);let u=0;for(let f=0;f<Ft;f+=1)i.mg[f*r+t]=a*s[f],u+=a*s[f]*ue(f,e);i.mfog[t]=0,i.Hg[t]=u,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let c=0;c<n;c+=1){const l=t[c],a=i[c];if(l===a||a===pt||l===pt)continue;r+=1;const u=c%s,f=(c-u)/s;let d=0;for(let m=0;m<4;m+=1){const p=this.across(c,u,f,m);p>=0&&i[p]===$&&t[p]===$&&(d+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(d<=0){a===rt&&this.release(c);continue}if(a===rt)for(let m=0;m<4;m+=1){const p=this.across(c,u,f,m);if(p<0||i[p]!==$||t[p]!==$)continue;const h=(this.vgas[p]>0?this.vgas[p]:e.vCell)/d;this.move(c,p,h)}else{let m=this.massOf(c),p=0;for(let h=0;h<4;h+=1){const g=this.across(c,u,f,h);if(g<0||i[g]!==$||t[g]!==$)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/d;p+=x*this.rho[g]}if(p*=Math.max(.001,1-e.fs[c]-e.phi[c]-e.alpha[c])*e.vCell,p<=m)continue;for(let h=0;h<4;h+=1){const g=this.across(c,u,f,h);if(g<0||i[g]!==$||t[g]!==$)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/d,y=this.massOf(g);if(y<=0)continue;const b=Math.min(.25,(p-m)*x/y);this.move(g,c,b)}m=this.massOf(c),m>0&&(e.T[c]=this.ambT)}this.deriveCell(c)}for(let c=0;c<n;c+=1)i[c]===rt&&this.massOf(c)>0&&this.release(c);return r}release(t){const e=this.g,{nx:s,kind:n}=e,i=++this.seenTag,r=this.queue,c=this.seen;let l=0,a=0;for(r[a++]=t,c[t]=i;l<a&&a<Zd;){const u=r[l++],f=u%s,d=(u-f)/s;for(let m=0;m<4;m+=1){const p=this.across(u,f,d,m);if(!(p<0||c[p]===i||n[p]===pt)){if(c[p]=i,n[p]===$){this.move(t,p,1),this.deriveCell(p),this.deriveCell(t);return}r[a++]=p}}}}across(t,e,s,n){const i=this.g,{nx:r,ny:c}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<c-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let l=0;l<Ft;l+=1){const a=n.mg[l*i+t]*s;n.mg[l*i+t]-=a,n.mg[l*i+e]+=a}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const c=n.Hg[t]*s;n.Hg[t]-=c,n.Hg[e]+=c,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,c=t.vg;for(let l=0;l<s;l+=1)for(let a=0;a<=e;a+=1){const u=a+l*i,f=a>0?n[a-1+l*e]:-1,d=a<e?n[a+l*e]:-1;let m=0;(f===$&&d===$||a===0&&t.openL&&d===$||a===e&&t.openR&&f===$)&&(m=1),t.au[u]<=0&&(m=0),this.gasU[u]=m,m===0&&(r[u]=f===rt||d===rt?f===pt||d===pt||a===0&&!t.openL||a===e&&!t.openR?0:t.ul[u]:t.usol[u])}for(let l=0;l<=s;l+=1)for(let a=0;a<e;a+=1){const u=a+l*e,f=l>0?n[a+(l-1)*e]:-1,d=l<s?n[a+l*e]:-1;let m=0;(f===$&&d===$||l===0&&t.openB&&d===$||l===s&&t.openT&&f===$)&&(m=1),t.av[u]<=0&&(m=0),this.gasV[u]=m,m===0&&(c[u]=f===rt||d===rt?f===pt||d===pt||l===0&&!t.openB||l===s&&!t.openT?0:t.vl[u]:t.vsol[u])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,l=i+1,a=Math.min(i-1e-6,Math.max(0,e/c)),u=Math.min(r-1.000001,Math.max(0,s/c-.5)),f=Math.floor(a),d=Math.floor(u),m=a-f,p=u-d,h=t[f+d*l],g=t[f+1+d*l],x=t[f+(d+1)*l],y=t[f+1+(d+1)*l];return this.lo=Math.min(h,g,x,y),this.hi=Math.max(h,g,x,y),(1-p)*((1-m)*h+m*g)+p*((1-m)*x+m*y)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,l=Math.min(i-1.000001,Math.max(0,e/c-.5)),a=Math.min(r-1e-6,Math.max(0,s/c)),u=Math.floor(l),f=Math.floor(a),d=l-u,m=a-f,p=t[u+f*i],h=t[u+1+f*i],g=t[u+(f+1)*i],x=t[u+1+(f+1)*i];return this.lo=Math.min(p,h,g,x),this.hi=Math.max(p,h,g,x),(1-m)*((1-d)*p+d*h)+m*((1-d)*g+d*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:c}=s,l=n+1,a=s.ug,u=s.vg,{u0:f,v0:d,u1:m,v1:p}=this,h=this.lim;f.set(a),d.set(u);for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*l;if(this.gasU[F]===0){m[F]=f[F];continue}const A=_*r,P=(b+.5)*r,w=this.sampleV(d,A,P);m[F]=this.sampleU(f,A-t*f[F],P-t*w),h[2*F]=this.lo,h[2*F+1]=this.hi}const g=2*s.nu;for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0){p[F]=d[F];continue}const A=(_+.5)*r,P=b*r,w=this.sampleU(f,A,P);p[F]=this.sampleV(d,A-t*w,P-t*d[F]),h[g+2*F]=this.lo,h[g+2*F+1]=this.hi}for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*l;if(this.gasU[F]===0)continue;const A=_*r,P=(b+.5)*r,w=this.sampleV(d,A,P),k=this.sampleU(m,A+t*f[F],P+t*w);let S=m[F]+.5*(f[F]-k);(S<h[2*F]||S>h[2*F+1])&&(S=m[F]),a[F]=S}for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const A=(_+.5)*r,P=b*r,w=this.sampleU(f,A,P),k=this.sampleV(p,A+t*w,P+t*d[F]);let S=p[F]+.5*(d[F]-k);(S<h[g+2*F]||S>h[g+2*F+1])&&(S=p[F]),u[F]=S}const x=this.R;for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const A=b>0?_+(b-1)*n:-1,P=b<i?_+b*n:-1,w=A>=0&&c[A]===$?this.rho[A]:-1,k=P>=0&&c[P]===$?this.rho[P]:-1,S=Math.max(ee,w>0&&k>0?.5*(w+k):Math.max(w,k));if(!(w>0||k>0))continue;const T=w>0?A:P,M=x.id[T],O=M>=0?x.rhoBar[M]:x.rhoAmb;u[F]-=t*e*(S-O)/S}m.set(a),p.set(u);const y=t/(r*r);for(let b=0;b<i;b+=1)for(let _=0;_<=n;_+=1){const F=_+b*l;if(this.gasU[F]===0)continue;const A=_<n&&c[_+b*n]===$?_+b*n:_-1+b*n,P=this.mu[A]/Math.max(ee,this.rho[A]),w=m[F],k=_<n?m[F+1]:w,S=_>0?m[F-1]:w,T=b>0?m[F-l]:s.openB?w:-w,M=b<i-1?m[F+l]:s.openT?w:-w;a[F]=w+Math.min(.2,y*P)*(k+S+T+M-4*w)}for(let b=0;b<=i;b+=1)for(let _=0;_<n;_+=1){const F=_+b*n;if(this.gasV[F]===0)continue;const A=b<i&&c[_+b*n]===$?_+b*n:_+(b-1)*n,P=this.mu[A]/Math.max(ee,this.rho[A]),w=p[F],k=b<i?p[F+n]:w,S=b>0?p[F-n]:w,T=_>0?p[F-1]:s.openL?w:-w,M=_<n-1?p[F+1]:s.openR?w:-w;u[F]=w+Math.min(.2,y*P)*(M+T+S+k-4*w)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==$){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:c,kind:l}=n,a=i+1,u=n.ug,f=n.vg;let d=i,m=-1,p=r,h=-1,g=0;for(let P=0;P<r;P+=1)for(let w=0;w<i;w+=1)l[w+P*i]===$&&(g+=1,w<d&&(d=w),w>m&&(m=w),P<p&&(p=P),P>h&&(h=P));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=g,g===0)return this.last;const y=this.solver,b=y.begin(m-d+1,h-p+1),_=this.rho;for(let P=p;P<=h;P+=1)for(let w=d;w<=m;w+=1){const k=w+P*i;if(l[k]!==$)continue;const S=y.at(w-d,P-p);b.act[S]=1,b.x[S]=n.pg[k];const T=w+P*a,M=w+P*i,O=this.fluxU(T+1)-this.fluxU(T)+this.fluxV(M+i)-this.fluxV(M);b.b[S]=n.Sg[k]*c*c-c*O;const q=Math.max(ee,_[k]);w+1<i?l[k+1]===$&&w+1<=m&&this.gasU[T+1]!==0&&(b.ax[S]=n.au[T+1]*2*t/(q+Math.max(ee,_[k+1]))):n.openR&&this.gasU[T+1]!==0&&(b.dDx[S]+=n.au[T+1]*2*t/q),w===0&&n.openL&&this.gasU[T]!==0&&(b.dDx[S]+=n.au[T]*2*t/q),P+1<r?l[k+i]===$&&P+1<=h&&this.gasV[M+i]!==0&&(b.ay[S]=n.av[M+i]*2*t/(q+Math.max(ee,_[k+i]))):n.openT&&this.gasV[M+i]!==0&&(b.dDy[S]+=n.av[M+i]*2*t/q),P===0&&n.openB&&this.gasV[M]!==0&&(b.dDy[S]+=n.av[M]*2*t/q)}const F=y.solve(e,s,!0);x.iterations=F.iterations,x.residual=F.residual,x.capped=F.capped;const A=n.pg;for(let P=0;P<n.n;P+=1)l[P]!==$&&(A[P]=0);for(let P=p;P<=h;P+=1)for(let w=d;w<=m;w+=1){const k=w+P*i;l[k]===$&&(A[k]=b.x[y.at(w-d,P-p)])}for(let P=0;P<r;P+=1)for(let w=0;w<=i;w+=1){const k=w+P*a;if(this.gasU[k]===0)continue;if(w===0){u[k]-=2*t/Math.max(ee,_[P*i])/c*A[P*i];continue}if(w===i){u[k]+=2*t/Math.max(ee,_[i-1+P*i])/c*A[i-1+P*i];continue}const S=w-1+P*i,T=w+P*i;u[k]-=2*t/(Math.max(ee,_[S])+Math.max(ee,_[T]))/c*(A[T]-A[S])}for(let P=0;P<=r;P+=1)for(let w=0;w<i;w+=1){const k=w+P*i;if(this.gasV[k]===0)continue;if(P===0){f[k]-=2*t/Math.max(ee,_[w])/c*A[w];continue}if(P===r){f[k]+=2*t/Math.max(ee,_[w+(r-1)*i])/c*A[w+(r-1)*i];continue}const S=w+(P-1)*i,T=w+P*i;f[k]-=2*t/(Math.max(ee,_[S])+Math.max(ee,_[T]))/c*(A[T]-A[S])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const c=s.vGas[r];if(c<=0)continue;let l=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===pt||this.cap[f]<=0)continue;const d=this.nmol[f];l+=d*(d*Ut*e.T[f]/s.pAt(f))/this.cap[f]}l*=Ut/c;const a=1/Math.max(.05,1-l);let u=0;for(let f=0;f<4;f+=1){const d=s.statePressure(r);s.p0[r]=d;const m=(d-(t[r]+u))*a;if(Math.abs(m)<=1e-10*d)break;let p=0;for(let h=0;h<n;h+=1){if(s.id[h]!==r||e.kind[h]===pt||this.cap[h]<=0)continue;const g=this.nmol[h]*Ut*e.T[h]/s.pAt(h);p+=g,e.Hg[h]+=g*m,this.deriveCell(h)}u+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=u}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<Ft;i+=1)n+=e.mg[i*s+t]/gt[i];return n<=0?0:e.mg[Q*s+t]/gt[Q]/n*this.R.pAt(t)}}function th(o,t,e,s,n,i,r){const{nx:c,ny:l}=o,a=c+1,u=o.ul,f=o.vl;for(let d=0;d<o.nu;d+=1)s[d]=t[d]!==0?1:0;for(let d=0;d<o.nv;d+=1)n[d]=e[d]!==0?1:0;for(let d=0;d<2;d+=1){i.set(u),r.set(f);for(let m=0;m<l;m+=1)for(let p=0;p<=c;p+=1){const h=p+m*a;if(s[h]!==0)continue;let g=0,x=0;p>0&&s[h-1]===1&&(g+=u[h-1],x+=1),p<c&&s[h+1]===1&&(g+=u[h+1],x+=1),m>0&&s[h-a]===1&&(g+=u[h-a],x+=1),m<l-1&&s[h+a]===1&&(g+=u[h+a],x+=1),x>0&&(i[h]=g/x,s[h]=3)}for(let m=0;m<=l;m+=1)for(let p=0;p<c;p+=1){const h=p+m*c;if(n[h]!==0)continue;let g=0,x=0;p>0&&n[h-1]===1&&(g+=f[h-1],x+=1),p<c-1&&n[h+1]===1&&(g+=f[h+1],x+=1),m>0&&n[h-c]===1&&(g+=f[h-c],x+=1),m<l&&n[h+c]===1&&(g+=f[h+c],x+=1),x>0&&(r[h]=g/x,n[h]=3)}u.set(i),f.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let d=0;d<o.nu;d+=1)s[d]===0&&(u[d]=0);for(let d=0;d<o.nv;d+=1)n[d]===0&&(f[d]=0)}function eh(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let c=0;c<o.count;c+=1){const l=Math.min(s-1,Math.max(0,Math.floor(o.x[c]/t.dx))),a=Math.min(n-1,Math.max(0,Math.floor(o.y[c]/t.dx)));if(i[l+a*s]===rt){e[c]=0;continue}let u=!1;for(let f=Math.max(0,a-2);f<=Math.min(n-1,a+2)&&!u;f+=1)for(let d=Math.max(0,l-2);d<=Math.min(s-1,l+2);d+=1)if(i[d+f*s]===rt){u=!0;break}e[c]=u?0:1,u||(r=!0)}return r}function mi(o,t,e,s){const{nx:n,ny:i,dx:r}=o,c=n+1,l=1/r;let a=Math.min(n-1e-6,Math.max(0,t*l)),u=Math.min(i-1.000001,Math.max(0,e*l-.5)),f=Math.floor(a),d=Math.floor(u),m=a-f,p=u-d;const h=o.ul;s[0]=(1-p)*((1-m)*h[f+d*c]+m*h[f+1+d*c])+p*((1-m)*h[f+(d+1)*c]+m*h[f+1+(d+1)*c]),a=Math.min(n-1.000001,Math.max(0,t*l-.5)),u=Math.min(i-1e-6,Math.max(0,e*l)),f=Math.floor(a),d=Math.floor(u),m=a-f,p=u-d;const g=o.vl;s[1]=(1-p)*((1-m)*g[f+d*n]+m*g[f+1+d*n])+p*((1-m)*g[f+(d+1)*n]+m*g[f+1+(d+1)*n])}const sh=18,nh=1,ih=.002,rh=4,xl=.2687,yl=.245,wl=.2;function oh(o,t,e,s,n){const i=Math.abs(t-e)/e,r=s/e;return i*n*o*o/(sh*r+Math.sqrt(.75*nh*i*n*o*o*o))}function Qs(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class ch{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"rad",new Float64Array(0));v(this,"w",new Float64Array(6));v(this,"vel",new Float64Array(2));v(this,"hit",new Float64Array(6));v(this,"lm");v(this,"lmT");v(this,"lv");v(this,"loc",new Float64Array(2));v(this,"h",0);v(this,"ks",0);v(this,"vmax",0);this.e=t,this.head=new Int32Array(t.grid.n),this.lm=new Float64Array(t.grid.n),this.lmT=new Float64Array(t.grid.n),this.lv=new Float64Array(t.grid.n)}dtLimit(){return this.vmax>0?.5*this.e.grid.dx/this.vmax:1/0}splatVolume(){const{grid:t,grains:e}=this.e,{nx:s,ny:n,dx:i}=t,r=t.grain;r.fill(0);const c=this.w,l=1/i,a=1/t.vCell;for(let u=0;u<e.count;u+=1){const f=e.m[u]/e.rho(u)*a,d=Qs(e.x[u]*l-.5,c,0),m=Qs(e.y[u]*l-.5,c,3);for(let p=0;p<3;p+=1){const h=m+p;if(!(h<0||h>=n))for(let g=0;g<3;g+=1){const x=d+g;x<0||x>=s||(r[x+h*s]+=c[g]*c[3+p]*f)}}}}step(t){const e=this.e.grains;if(e.count===0){this.vmax=0;return}this.next.length<e.cap&&(this.next=new Int32Array(e.cap),this.px=new Float64Array(e.cap),this.py=new Float64Array(e.cap),this.rad=new Float64Array(e.cap)),this.forces(t);const s=this.e.grid.dx;for(let r=0;r<e.count;r+=1)this.rad[r]=xl*s*Math.sqrt(Math.max(0,e.m[r]/e.m0[r]));this.ks=1/(4*xl*s);const n=Math.max(1,Math.ceil(t/ih-1e-9));this.h=t/n;for(let r=0;r<n;r+=1)this.substep();this.escape();let i=0;for(let r=0;r<e.count;r+=1){const c=Math.hypot(e.vx[r],e.vy[r]);c>i&&(i=c)}this.vmax=i}forces(t){const e=this.e,{grid:s,grains:n}=e,i=e.gy,r=i>0?i:9.81;let c=!1;for(let l=0;l<n.count;l+=1){const a=s.cellAt(n.x[l],n.y[l]);if(!(a>=0&&s.kind[a]===rt)){n.vy[l]-=i*t;continue}c||(this.gatherLiquid(),c=!0),this.liquidAt(a);const f=this.loc[0],d=this.loc[1],m=je[n.mat[l]].rho,p=i*(1-d/m),h=oh(n.diameter(l),m,d,js(f),r)/Math.max(1e-6,Math.abs(r*(1-d/m)));mi(s,n.x[l],n.y[l],this.vel);const g=n.vx[l],x=n.vy[l]-p*t,y=t/h,b=(g+y*this.vel[0])/(1+y),_=(x+y*this.vel[1])/(1+y);n.vx[l]=b,n.vy[l]=_,this.spread(n.x[l],n.y[l],-n.m[l]*(b-g)/t,-n.m[l]*(_-x)/t)}}gatherLiquid(){const{grid:t,particles:e}=this.e,{lm:s,lmT:n,lv:i}=this;s.fill(0),n.fill(0),i.fill(0);for(let r=0;r<e.count;r+=1){const c=t.cellAt(e.x[r],e.y[r]);if(c<0)continue;const l=e.mass[r];s[c]+=l,n[c]+=l*e.T[r],i[c]+=l/e.rho[r]}}liquidAt(t){const e=this.e.grid,{lm:s,lmT:n,lv:i,loc:r}=this;let c=s[t],l=n[t],a=i[t];if(!(c>0)){const u=t%e.nx,f=(t-u)/e.nx;for(let d=-1;d<=1;d+=1)for(let m=-1;m<=1;m+=1){const p=u+m,h=f+d;if(p<0||h<0||p>=e.nx||h>=e.ny)continue;const g=p+h*e.nx;c+=s[g],l+=n[g],a+=i[g]}}r[0]=c>0?l/c:this.e.ambientT,r[1]=c>0&&a>0?c/a:this.e.liquid.rhoRef}spread(t,e,s,n){const{grid:i,liquid:r}=this.e,{nx:c,ny:l,dx:a}=i,u=this.w,f=1/a;let d=Qs(t*f,u,0),m=Qs(e*f-.5,u,3);for(let p=0;p<3;p+=1)for(let h=0;h<3;h+=1){const g=d+h,x=m+p;g<0||g>c||x<0||x>=l||(r.fU[g+x*(c+1)]+=s*u[h]*u[3+p])}d=Qs(t*f-.5,u,0),m=Qs(e*f,u,3);for(let p=0;p<3;p+=1)for(let h=0;h<3;h+=1){const g=d+h,x=m+p;g<0||g>=c||x<0||x>l||(r.fV[g+x*c]+=n*u[h]*u[3+p])}}substep(){const{grid:t,grains:e}=this.e,{px:s,py:n,head:i,next:r}=this,{nx:c,ny:l}=t,a=this.h;for(let f=0;f<e.count;f+=1)s[f]=e.x[f],n[f]=e.y[f],e.x[f]+=a*e.vx[f],e.y[f]+=a*e.vy[f];i.fill(-1);for(let f=0;f<e.count;f+=1){const d=t.cellAt(e.x[f],e.y[f]);r[f]=i[d],i[d]=f}const u=1/t.dx;for(let f=0;f<rh;f+=1){const d=(f&1)===1;for(let m=0;m<e.count;m+=1){const p=d?e.count-1-m:m,h=Math.min(c-1,Math.max(0,Math.floor(e.x[p]*u))),g=Math.min(l-1,Math.max(0,Math.floor(e.y[p]*u)));for(let x=-1;x<=1;x+=1){const y=g+x;if(!(y<0||y>=l))for(let b=-1;b<=1;b+=1){const _=h+b;if(!(_<0||_>=c))for(let F=i[_+y*c];F>=0;F=r[F])F!==p&&(d?F<p:F>p)&&this.pair(p,F)}}this.walls(p)}}for(let f=0;f<e.count;f+=1)e.vx[f]=(e.x[f]-s[f])/a,e.vy[f]=(e.y[f]-n[f])/a}pair(t,e){const s=this.e.grains,n=s.x[t]-s.x[e],i=s.y[t]-s.y[e],r=this.rad[t]+this.rad[e],c=n*n+i*i;if(c>=r*r||c<1e-24)return;const l=Math.sqrt(c),a=n/l,u=i/l,f=r-l,d=Math.exp(this.ks*s.y[t])/s.m[t],m=Math.exp(this.ks*s.y[e])/s.m[e],p=d/(d+m),h=m/(d+m);s.x[t]+=p*f*a,s.y[t]+=p*f*u,s.x[e]-=h*f*a,s.y[e]-=h*f*u;const g=s.x[t]-this.px[t]-(s.x[e]-this.px[e]),x=s.y[t]-this.py[t]-(s.y[e]-this.py[e]),y=g*a+x*u,b=g-y*a,_=x-y*u,F=Math.hypot(b,_);if(!(F>0))return;const A=F<yl*f?1:Math.min(1,wl*f/F);s.x[t]-=p*A*b,s.y[t]-=p*A*_,s.x[e]+=h*A*b,s.y[e]+=h*A*_}walls(t){const e=this.e,{grid:s,grains:n}=e,i=this.rad[t],r=s.w,c=s.h;!s.openL&&n.x[t]<i&&this.wallContact(t,1,0,i-n.x[t],0,0),!s.openR&&n.x[t]>r-i&&this.wallContact(t,-1,0,n.x[t]-(r-i),0,0),!s.openB&&n.y[t]<i&&this.wallContact(t,0,1,i-n.y[t],0,0),!s.openT&&n.y[t]>c-i&&this.wallContact(t,0,-1,n.y[t]-(c-i),0,0);const l=e.liquid.bodyHit,a=l!==null?l(this.px[t],this.py[t],n.x[t],n.y[t],this.hit):0;if(a===1){const h=this.hit,g=Math.hypot(h[0]-n.x[t],h[1]-n.y[t]);this.wallContact(t,h[2],h[3],g,h[4],h[5]);return}if(a===2)return;const u=s.sdfAt(n.x[t],n.y[t]);if(u>=i)return;const f=.25*s.dx;let d=s.sdfAt(n.x[t]+f,n.y[t])-s.sdfAt(n.x[t]-f,n.y[t]),m=s.sdfAt(n.x[t],n.y[t]+f)-s.sdfAt(n.x[t],n.y[t]-f);const p=Math.hypot(d,m);p>1e-12&&(d/=p,m/=p,this.wallContact(t,d,m,i-u,0,0))}wallContact(t,e,s,n,i,r){if(!(n>0))return;const c=this.e.grains;c.x[t]+=n*e,c.y[t]+=n*s;const l=c.x[t]-this.px[t]-i*this.h,a=c.y[t]-this.py[t]-r*this.h,u=l*e+a*s,f=l-u*e,d=a-u*s,m=Math.hypot(f,d);if(!(m>0))return;const p=m<yl*n?1:Math.min(1,wl*n/m);c.x[t]-=p*f,c.y[t]-=p*d}escape(){const t=this.e,{grid:e,grains:s}=t,n=e.w,i=e.h,r=1e-4*e.dx;for(let c=0;c<s.count;c+=1){const l=s.x[c],a=s.y[c];if(l<0&&e.openL||l>n&&e.openR||a<0&&e.openB||a>i&&e.openT){je[s.mat[c]].dissolves&&(t.flows.escapedSalt+=s.m[c]),t.flows.escapedEnergy+=s.enthalpy(c),s.remove(c),c-=1;continue}(l<r||l>n-r)&&(s.vx[c]=0),(a<r||a>i-r)&&(s.vy[c]=0),s.x[c]=Math.min(n-r,Math.max(r,l)),s.y[c]=Math.min(i-r,Math.max(r,a))}}}const $i=1e-5,lh=2,_l=.025,ah=1e-4;function Fl(o,t){const e=o<=1?1:Math.pow(Math.min(o,400),.077);return 1+Math.cbrt(1+o*t)*e}class fh{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"gHead");v(this,"gNext",new Int32Array(0));v(this,"listed",!1);v(this,"dissolved",0);v(this,"grown",0);v(this,"burst",0);v(this,"vel",new Float64Array(2));this.e=t,this.head=new Int32Array(t.grid.n),this.gHead=new Int32Array(t.grid.n)}invalidate(){this.listed=!1}list(){if(this.listed)return;const{grid:t,particles:e,grains:s}=this.e;this.next.length<e.cap&&(this.next=new Int32Array(e.cap)),this.gNext.length<s.cap&&(this.gNext=new Int32Array(s.cap)),this.head.fill(-1),this.gHead.fill(-1);for(let n=0;n<e.count;n+=1){if(e.mat[n]!==dt)continue;const i=t.cellAt(e.x[n],e.y[n]);i<0||(this.next[n]=this.head[i],this.head[i]=n)}for(let n=0;n<s.count;n+=1){const i=t.cellAt(s.x[n],s.y[n]);i<0||(this.gNext[n]=this.gHead[i],this.gHead[i]=n)}this.listed=!0}step(t){const{grains:e}=this.e;e.count!==0&&(this.listed=!1,this.list(),this.nucleate(t),this.heatAndDissolve(t),this.listed=!1)}grow(t,e,s,n){const{grid:i,grains:r}=this.e;if(r.count===0)return!1;this.list();const c=i.cellAt(t,e);if(c<0)return!1;const l=c%i.nx,a=(c-l)/i.nx;let u=-1,f=1/0;for(let m=-1;m<=1;m+=1)for(let p=-1;p<=1;p+=1){const h=l+p,g=a+m;if(!(h<0||g<0||h>=i.nx||g>=i.ny))for(let x=this.gHead[h+g*i.nx];x>=0;x=this.gNext[x]){if(!je[r.mat[x]].dissolves)continue;const y=(r.x[x]-t)**2+(r.y[x]-e)**2;y<f&&(f=y,u=x)}}if(u<0)return!1;const d=r.enthalpy(u)+n;return r.m[u]+=s,r.T[u]=et+d/(r.m[u]*r.cp(u)),this.grown+=s,!0}nucleate(t){const e=this.e,{grid:s,grains:n,bubbles:i,particles:r,liquid:c}=e;for(let l=0;l<n.count;l+=1){if(n.dry[l]===0)continue;const a=s.cellAt(n.x[l],n.y[l]);if(a<0||s.kind[a]!==rt||this.head[a]<0)continue;const u=n.wet[l];if(n.wet[l]+=t,n.wet[l]>lh){n.dry[l]=0;continue}if(u>0&&Math.floor(u/_l)===Math.floor(n.wet[l]/_l))continue;let f=0,d=0,m=0,p=0;for(let k=this.head[a];k>=0;k=this.next[k]){const S=r.smass[2*k],T=r.mass[k]-S;f+=T,d+=S,m+=T*r.T[k],p+=T*(S>0?gn(r.T[k],S/r.mass[k]):r.h[k])}if(!(f>0))continue;const h=m/f,g=Math.max(.5*e.pRef,e.pRef+s.pl[a]),x=d>0?bc(g,O0(d/(d+f))):St(g);if(h-x<e.extremes.activation(Go($i,g)))continue;const y=g+2*Fi(h)/$i,b=St(y),_=4/3*Math.PI*$i**3,F=Ne(b)*_;if(F*4>f)continue;const A=i.add(n.x[l],n.y[l],.5*s.depth);if(A<0)continue;i.m[A*ut+Q]=F,i.r[A]=$i,i.V[A]=_,i.Tb[A]=b,i.pb[A]=y,i.pv[A]=y,i.H[A]=F*xt(b),i.site[A]=-1,i.age[A]=0,mi(s,n.x[l],n.y[l],this.vel);const P=e.bubbleModel.motionState;P.ux0[A]=this.vel[0],P.uy0[A]=this.vel[1],i.vx[A]=this.vel[0],i.vy[A]=this.vel[1];const w=p/f;for(let k=this.head[a];k>=0;k=this.next[k]){const S=r.smass[2*k],T=F*(r.mass[k]-S)/f,M=S>0?gn(r.T[k],S/r.mass[k]):r.h[k],O=r.mass[k]/r.rho[k],q=r.mass[k]*r.h[k]-T*M;r.mass[k]-=T,r.h[k]=q/r.mass[k],r.derive(k),c.dVp[k]+=r.mass[k]/r.rho[k]-O}e.heat.src[a]-=F*(xt(b)-w)/t,this.burst+=1}}heatAndDissolve(t){const e=this.e,{grid:s,grains:n,particles:i,liquid:r}=e,c=s.n;for(let l=0;l<n.count;l+=1){const a=s.cellAt(n.x[l],n.y[l]);if(a<0)continue;const u=je[n.mat[l]];let f=0,d=0,m=0,p=0;for(let R=this.head[a];R>=0;R=this.next[R]){const E=i.smass[2*R];f+=i.mass[R]-E,d+=E,m+=i.mass[R]*i.T[R],p+=i.mass[R]}const h=f>0&&s.kind[a]===rt,g=n.diameter(l),x=n.N[l]*Math.PI*g*g;mi(s,n.x[l],n.y[l],this.vel);const y=Math.hypot(n.vx[l]-this.vel[0],n.vy[l]-this.vel[1]),b=h?m/p:s.T[a];if(h||s.kind[a]===$){let R,E,I;if(h){const bt=An(b);R=ii(b),E=js(b)/bt,I=R/(bt*Ge(b))}else R=mc(s.mg[a],s.mg[c+a],s.mg[Q*c+a],b),E=16e-6,I=22e-6;const z=y*g/E,G=Fl(z,E/I)*R/g,X=n.m[l]*u.cp,nt=(1-Math.exp(-t*G*x/X))*(b-n.T[l]);nt!==0&&(n.T[l]+=nt,e.heat.src[a]-=X*nt/t)}if(!h||!u.dissolves)continue;const _=m/p,F=d/(d+f),A=cf(_);if(F>=A)continue;const P=Vr(_,F),w=Oo(_),k=js(_)/P,S=y*g/k,T=Fl(S,k/w)*w/g,M=(A-F)/(1-A);let O=x*T*P*Math.log(1+M)*t;const q=(A*(d+f)-d)/(1-A);O>q&&(O=Math.max(0,q));const N=n.m[l]-O<ah*n.m0[l];if(N&&(O=n.m[l]),!(O>0))continue;const L=Mi(n.T[l]);for(let R=this.head[a];R>=0;R=this.next[R]){const E=i.smass[2*R],I=O*(i.mass[R]-E)/f;if(!(I>0))continue;const z=i.mass[R]/i.rho[R],G=i.mass[R]*i.h[R]+I*L;i.mass[R]+=I,i.smass[2*R]=E+I,i.spc[2*R]=Si,i.h[R]=G/i.mass[R],i.derive(R),r.dVp[R]+=i.mass[R]/i.rho[R]-z}this.dissolved+=O,N?(n.remove(l),l-=1):n.m[l]-=O}}}const Pl=[1/6,2/3,1/6];class uh{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"owner");v(this,"fs");v(this,"capB");v(this,"matB");v(this,"Ts");v(this,"au");v(this,"av");v(this,"usol");v(this,"vsol");v(this,"thin");v(this,"thinAny",!1);v(this,"phi");v(this,"alpha");v(this,"grain");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.grain=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(ut*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let c=0;c<t;c+=1){const l=c+r*t;i[l]===0&&(c>0&&s[c+r*(t+1)]<=0&&i[l-1]===0&&this.thinBlock(c-1,c,r-1,r+1),r>0&&n[l]<=0&&i[l-t]===0&&this.thinBlock(c-1,c+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:c}=this,l=s+1,a=t+e*s;let u=0;if(c[a]===0)for(let f=0;f<9;f+=1){const d=f%3-1,m=(f/3|0)-1,p=t+d,h=e+m;if(f===4||p<0||h<0||p>=s||h>=n||c[p+h*s]!==0)continue;const g=(d>0?1:0)+e*l,x=(m>0?1:0)*s;let y;if(m===0)y=i[t+g]<=0;else if(d===0)y=r[t+e*s+x]<=0;else{const b=c[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+x]<=0),_=c[t+h*s]===0&&(r[t+e*s+x]<=0||i[t+(d>0?1:0)+h*l]<=0);y=b&&_}y&&(u|=1<<f)}this.thin[a]=u}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let c=0;c<9;c+=1)i>>c&1?s[n+c]=0:r+=s[n+c];if(r>0)for(let c=0;c<9;c+=1)s[n+c]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:c}=this,l=Math.max(0,t),a=Math.max(0,e),u=Math.min(i-1,s),f=Math.min(r-1,n);for(let p=a;p<=f;p+=1)for(let h=l;h<=u;h+=1){const g=h+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let x=0;for(let y=-1;y<=1;y+=1)for(let b=-1;b<=1;b+=1)x+=Pl[b+1]*Pl[y+1]*this.solidShare(h+b,p+y);this.phiS[g]=x}const d=4,m=d*c;for(let p=a;p<=f;p+=1)for(let h=l;h<=u;h+=1){const g=h+p*i,x=this.solid[g]!==0,y=(h+.5)*c,b=(p+.5)*c;let _=m;x||(this.openL||(_=Math.min(_,y)),this.openR||(_=Math.min(_,this.w-y)),this.openB||(_=Math.min(_,b)),this.openT||(_=Math.min(_,this.h-b)));for(let F=-d;F<=d;F+=1){const A=p+F;if(!(A<0||A>=r))for(let P=-d;P<=d;P+=1){const w=h+P;if(w<0||w>=i||this.solid[w+A*i]!==0===x)continue;const S=Math.max(0,Math.abs(w+.5-(h+.5))-.5)*c,T=Math.max(0,Math.abs(A+.5-(p+.5))-.5)*c,M=Math.hypot(S,T);M<_&&(_=M)}}this.sdf[g]=x?-_:_}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),c=Math.min(n-1.0001,Math.max(0,e/i-.5)),l=Math.floor(r),a=Math.floor(c),u=r-l,f=c-a,d=Math.min(s-1,l+1),m=Math.min(n-1,a+1),p=this.sdf;let h=(1-f)*((1-u)*p[l+a*s]+u*p[d+a*s])+f*((1-u)*p[l+m*s]+u*p[d+m*s]);return this.openL||(h=Math.min(h,t)),this.openR||(h=Math.min(h,this.w-t)),this.openB||(h=Math.min(h,e)),this.openT||(h=Math.min(h,this.h-e)),h}}const dh=5,kl=30;class hh{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",Da);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});v(this,"bodies",[]);v(this,"grains",null);v(this,"Cgr");v(this,"CTgr");v(this,"qb");v(this,"kS");v(this,"kF");v(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r),this.Cgr=new Float64Array(r),this.CTgr=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=ht[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*gs}solidEnergy(t,e){return this.solidCapCrust(t)*(e-et)+this.g.film[t]*kt(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=et+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:et+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Ge(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let l=0;l<s.ncell;l+=1)r+=s.cellVolume(l);if(!(r>0))continue;const c=n.P*i/r;for(let l=0;l<s.nw;l+=1){const a=c*s.ww[l]*s.cellVolume(s.wk[l]);t[s.wc[l]]+=a,e+=a}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/dh,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/kl);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/kl)))}}step(t,e,s){const{g:n,P:i,L:r,G:c}=this,{nx:l,ny:a,n:u,depth:f,dx:d}=n,{C:m,Cs:p,Cg:h,CTl:g,Tstar:x,k:y,q:b,src:_}=this;this.heaterPower(t),g.fill(0);const F=n.Cl;F.fill(0);const{Co:A,CKo:P}=this;let w=!1,k=0;for(let C=0;C<i.count;C+=1){const D=i.mat[C],U=i.T[C],ft=i.mass[C]*i.cp(C);k+=ft;const it=9*C,vt=r.bi[C],Lt=r.bj[C],yt=D===dt?0:zn(D,U);D!==dt&&!w&&(w=!0,A.fill(0),P.fill(0));for(let Rt=0;Rt<9;Rt+=1){const At=r.wt[it+Rt];if(At===0)continue;const Ce=vt+Rt%3,Tt=Lt+(Rt/3|0);if(Ce<0||Tt<0||Ce>=l||Tt>=a)continue;const vs=Ce+Tt*l;F[vs]+=At*ft,g[vs]+=At*ft*U,D!==dt&&(A[vs]+=At*ft,P[vs]+=At*ft*yt)}}const{Cgr:S,CTgr:T}=this;S.fill(0),T.fill(0);const M=this.grains;if(M!==null)for(let C=0;C<M.count;C+=1){const D=n.cellAt(M.x[C],M.y[C]);if(D<0||n.solid[D]!==0)continue;const U=M.m[C]*M.cp(C);S[D]+=U,T[D]+=U*M.T[C]}const O=this.qb;O.fill(0);let q=this.bodyHeat(O);const{kS:N,kF:L,dSF:R}=this;for(let C=0;C<u;C+=1){let D=0,U=0;const ft=n.solid[C]!==0?n.T[C]:n.Ts[C];if(n.solid[C]!==0||n.capB[C]>0){D=this.solidCapCrust(C)+n.film[C]*Ge(ft);const Tt=n.solid[C]!==0?ht[n.solid[C]-1]:ht[n.matB[C]-1];U=Tt!==void 0?Tt.k:0}const it=c.cap[C]>0&&n.solid[C]===0?c.cap[C]:0,vt=F[C],Lt=D+it+vt+S[C];if(p[C]=D,h[C]=it,m[C]=Lt,R[C]=0,Lt<=0){x[C]=n.T[C],y[C]=0,b[C]=0;continue}const yt=(D*ft+it*n.T[C]+g[C]+T[C])/Lt;x[C]=yt,vt>0&&(n.Tl[C]=g[C]/vt);let Rt=U;if(n.solid[C]===0){const Tt=vt>=it?w&&A[C]>0?((vt-A[C])*ii(yt)+P[C])/vt:ii(yt):mc(n.mg[C],n.mg[u+C],n.mg[Q*u+C],yt);if(D>0){const vs=Math.min(1,n.fs[C]);Rt=vs*U+(1-vs)*Tt,N[C]=U,L[C]=Tt,it+vt+S[C]>0&&(R[C]=ft-(it*n.T[C]+g[C]+T[C])/(it+vt+S[C]))}else Rt=Tt}y[C]=Rt;let At=_[C]+O[C];if(this.liquidPower!==0&&vt>0){const Tt=this.liquidPower*vt/k;At+=Tt,q+=Tt}const Ce=n.heater[C];if(Ce>=0&&n.role[C]===1){const Tt=this.heaters[Ce];Tt!==void 0&&Tt.cells>0&&(At+=Tt.P/Tt.cells,q+=Tt.P/Tt.cells)}b[C]=At}const{gx:E,gy:I}=this;for(let C=0;C<a;C+=1)for(let D=0;D<l;D+=1){const U=D+C*l;if(E[U]=0,I[U]=0,m[U]<=0)continue;const ft=y[U];if(D+1<l&&m[U+1]>0){const it=y[U+1];ft+it>0&&(E[U]=2*ft*it/(ft+it)*f)}if(C+1<a&&m[U+l]>0){const it=y[U+l];ft+it>0&&(I[U]=2*ft*it/(ft+it)*f)}}const z=this.solver,G=z.begin(l,a),X=G.stride,nt=d*f,bt=this.hExt*nt,ct=this.ambientT;for(let C=0;C<a;C+=1)for(let D=0;D<l;D+=1){const U=D+C*l;if(m[U]<=0)continue;const ft=D+1+(C+1)*X;G.act[ft]=1,G.dH[ft]=m[U]/t;let it=b[U];const vt=y[U],Lt=x[U];D+1<l&&(G.ax[ft]=E[U],it+=E[U]*(x[U+1]-Lt)),D>0&&(it+=E[U-1]*(x[U-1]-Lt)),C+1<a&&(G.ay[ft]=I[U],it+=I[U]*(x[U+l]-Lt)),C>0&&(it+=I[U-l]*(x[U-l]-Lt));let yt=0;D===0&&(yt+=this.sideConductance(n.openL,vt,bt,f)),D===l-1&&(yt+=this.sideConductance(n.openR,vt,bt,f)),C===0&&(yt+=this.sideConductance(n.openB,vt,bt,f)),C===a-1&&(yt+=this.sideConductance(n.openT,vt,bt,f)),yt>0&&(G.dDx[ft]=yt,it+=yt*(ct-x[U])),G.b[ft]=it}const W=z.solve(e,s,!1),H=this.last.solve;H.iterations=W.iterations,H.residual=W.residual,H.capped=W.capped;const st=this.Tnew,wt=G.x;for(let C=0;C<a;C+=1)for(let D=0;D<l;D+=1){const U=D+C*l;st[U]=m[U]>0?x[U]+wt[D+1+(C+1)*X]:n.T[U]}const mt=this.dE;let Z=0,j=0;for(let C=0;C<u;C+=1)mt[C]=m[C]>0?b[C]*t:0;for(let C=0;C<a;C+=1)for(let D=0;D<l;D+=1){const U=D+C*l;if(m[U]<=0)continue;const ft=y[U];if(E[U]>0){const it=E[U]*(st[U+1]-st[U])*t;mt[U]+=it,mt[U+1]-=it,n.kind[U]!==n.kind[U+1]&&this.pair(n.kind[U],n.kind[U+1],it)}if(I[U]>0){const it=I[U]*(st[U+l]-st[U])*t;mt[U]+=it,mt[U+l]-=it,n.kind[U]!==n.kind[U+l]&&this.pair(n.kind[U],n.kind[U+l],it)}for(let it=0;it<4;it+=1){if(!(it===0?D===0:it===1?D===l-1:it===2?C===0:C===a-1))continue;const Lt=it===0?n.openL:it===1?n.openR:it===2?n.openB:n.openT,yt=this.sideConductance(Lt,ft,bt,f)*(st[U]-ct)*t;mt[U]-=yt,Lt?j+=yt:Z+=yt,n.solid[U]!==0&&(this.lossSolids+=yt)}}for(let C=0;C<u;C+=1){if(m[C]<=0)continue;const D=mt[C]/m[C];st[C]=D;let U=0;const ft=h[C]+F[C]+S[C];if(R[C]!==0&&p[C]>0&&ft>0){const it=Math.min(.999,Math.max(.001,n.fs[C])),vt=f/(.5*it/Math.max(1e-9,N[C])+.5*(1-it)/Math.max(1e-9,L[C])),Lt=p[C]*ft/(p[C]+ft);U=(1-Math.exp(-t*vt/Lt))*R[C]*Lt}p[C]>0&&(n.Es[C]+=D*p[C]-U,this.deriveSolid(C)),h[C]>0&&(n.Hg[C]+=D*h[C]+U*h[C]/ft),U!==0&&F[C]+S[C]>0&&(st[C]+=U/ft)}for(let C=0;C<i.count;C+=1){const D=9*C,U=r.bi[C],ft=r.bj[C];let it=0;for(let yt=0;yt<9;yt+=1){const Rt=r.wt[D+yt];if(Rt===0)continue;const At=U+yt%3,Ce=ft+(yt/3|0);if(At<0||Ce<0||At>=l||Ce>=a)continue;const Tt=At+Ce*l;m[Tt]>0&&(it+=Rt*st[Tt])}if(it===0)continue;const vt=i.mass[C],Lt=vt/i.rho[C];i.h[C]+=i.cp(C)*it,i.derive(C),r.dVp[C]+=vt/i.rho[C]-Lt}if(M!==null)for(let C=0;C<M.count;C+=1){const D=n.cellAt(M.x[C],M.y[C]);D>=0&&n.solid[D]===0&&m[D]>0&&(M.T[C]+=st[D])}for(let C=0;C<u;C+=1)h[C]>0&&c.deriveCell(C);_.fill(0);const B=this.last;return B.heater=q*t,B.lossWalls=Z,B.lossOpen=j,B}pair(t,e,s){t===pt&&e===rt?this.fluxSL-=s:t===rt&&e===pt?this.fluxSL+=s:t===rt&&e===$?this.fluxLG-=s:t===$&&e===rt?this.fluxLG+=s:t===pt&&e===$?this.fluxSG-=s:t===$&&e===pt&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function mh(o,t,e,s,n,i,r,c,l,a,u){const{nx:f,ny:d,dx:m}=o;for(let x=0;x<o.nu;x+=1)e[x]=n[x]>a?e[x]/n[x]:0;for(let x=0;x<o.nv;x+=1)s[x]=i[x]>a?s[x]/i[x]:0;const p=l*m*m/u,h=(x,y)=>x+y>0?2*x*y/(x+y):0;let g=0;{const x=f+1,y=t.begin(x,d),b=o.ul;for(let F=0;F<d;F+=1)for(let A=0;A<=f;A+=1){const P=A+F*x;if(r[P]!==1)continue;const w=t.at(A,F),k=e[P];if(y.act[w]=1,y.dH[w]=p,y.x[w]=b[P],y.b[w]=p*b[P],A+1<=f){const S=r[P+1];S===1?y.ax[w]=h(k,e[P+1]):S===2&&(y.dDx[w]+=k)}if(A>0&&r[P-1]===2&&(y.dDx[w]+=k),F+1<d){const S=r[P+x];S===1?y.ay[w]=h(k,e[P+x]):S===2&&(y.dDy[w]+=2*k)}else o.openT||(y.dDy[w]+=2*k);F>0?r[P-x]===2&&(y.dDy[w]+=2*k):o.openB||(y.dDy[w]+=2*k)}const _=t.solve(1e-6,200,!1);g+=_.iterations;for(let F=0;F<d;F+=1)for(let A=0;A<=f;A+=1){const P=A+F*x;r[P]===1&&(b[P]=y.x[t.at(A,F)])}}{const x=t.begin(f,d+1),y=o.vl;for(let _=0;_<=d;_+=1)for(let F=0;F<f;F+=1){const A=F+_*f;if(c[A]!==1)continue;const P=t.at(F,_),w=s[A];if(x.act[P]=1,x.dH[P]=p,x.x[P]=y[A],x.b[P]=p*y[A],_+1<=d){const k=c[A+f];k===1?x.ay[P]=h(w,s[A+f]):k===2&&(x.dDy[P]+=w)}if(_>0&&c[A-f]===2&&(x.dDy[P]+=w),F+1<f){const k=c[A+1];k===1?x.ax[P]=h(w,s[A+1]):k===2&&(x.dDx[P]+=2*w)}else o.openR||(x.dDx[P]+=2*w);F>0?c[A-1]===2&&(x.dDx[P]+=2*w):o.openL||(x.dDx[P]+=2*w)}const b=t.solve(1e-6,200,!1);g+=b.iterations;for(let _=0;_<=d;_+=1)for(let F=0;F<f;F+=1){const A=F+_*f;c[A]===1&&(y[A]=x.x[t.at(F,_)])}}return g}class ph{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:c,n:l}=e,a=oe.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(l*a),this.cellHost=new Uint8Array(l));const u=this.cellMat,f=this.cellHost;u.fill(0);let d=!1;for(let h=0;h<t.count;h+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),x=Math.min(c-1,Math.max(0,Math.floor(t.y[h]/e.dx)));u[(g+x*r)*a+t.mat[h]]+=t.mass[h],t.smass[2*h]>0&&(d=!0)}if(d){this.cellVolW===null&&(this.cellVolW=new Float64Array(l));const h=this.cellVolW;h.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==dt)continue;const x=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),y=Math.min(c-1,Math.max(0,Math.floor(t.y[g]/e.dx)));h[x+y*r]+=t.mass[g]/t.rho[g]}}for(let h=0;h<l;h+=1){let g=0;for(let x=1;x<a;x+=1)u[h*a+x]>u[h*a+g]&&(g=x);f[h]=g}let m=!1;const p=.25*e.dx;for(let h=0;h<t.count;h+=1){i[h]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),x=Math.min(c-1,Math.max(0,Math.floor(t.y[h]/e.dx))),y=f[g+x*r],b=t.mat[h];if(b===y)continue;const _=t.T[h],F=this.cellVolW,A=g+x*r,P=d&&y===dt&&F!==null&&F[A]>0?u[A*a]/F[A]:Ds(y,_),w=t.rho[h],k=oi(y,_),S=oi(b,_),T=t.mass[h]/w,M=Math.cbrt(6*T/Math.PI),O=Math.abs(P-w);if(O<=0||n<=0)continue;const q=(2*k+3*S)/(3*k+3*S);let N=O*n*M*M/(18*k*q);for(let R=0;R<8;R+=1){const E=Math.max(1e-9,P*N*M/k),I=24/E*q*(1+.15*Math.pow(E,.687));N=Math.sqrt(4*O*n*M/(3*P*I))}const L=w<P?1:-1;i[h]=L*Math.min(p,N*s),m=!0}return m}}function bh(o,t,e,s,n,i,r,c,l,a,u){const f=t.w,d=t.h,m=t.dx;let p=0,h=0,g=0,x=0;const y=s;for(let b=0;b<o.count;b+=1){const _=o.x[b],F=o.y[b],A=y[b]!==0;let P,w;if(A)P=_+e*o.vx[b],w=F+e*o.vy[b];else{i(_,F,l);const T=_+.5*e*l[0],M=F+.5*e*l[1];i(T,M,l),P=_+e*l[0],w=F+e*l[1]+(n!==null?n[b]:0)}if(P<0&&t.openL||P>f&&t.openR||w<0&&t.openB||w>d&&t.openT){const T=o.smass[2*b];o.mat[b]===dt?p+=o.mass[b]-T:h+=o.mass[b]-T,g+=T,x+=o.mass[b]*o.h[b],n!==null&&(n[b]=n[o.count-1]),y[b]=y[o.count-1],r(b),b-=1;continue}const k=1e-4*m;A&&(P<k||P>f-k)&&(o.vx[b]=0),A&&(w<k||w>d-k)&&(o.vy[b]=0),P=Math.min(f-k,Math.max(k,P)),w=Math.min(d-k,Math.max(k,w));const S=c!==null?c(_,F,P,w,a):0;if(S===1){P=a[0],w=a[1];const T=a[2],M=a[3];if(A)o.vx[b]=a[4],o.vy[b]=a[5];else{const O=(o.vx[b]-a[4])*T+(o.vy[b]-a[5])*M;O<0&&(o.vx[b]-=O*T,o.vy[b]-=O*M)}}else if(S===0){let T=t.sdfAt(P,w);if(T<.05*m){const M=P,O=w;for(let q=0;q<3&&T<.05*m;q+=1){const N=.25*m;let L=t.sdfAt(P+N,w)-t.sdfAt(P-N,w),R=t.sdfAt(P,w+N)-t.sdfAt(P,w-N);const E=Math.hypot(L,R);if(E<1e-12)break;L/=E,R/=E;const I=.05*m-T;P+=I*L,w+=I*R;const z=o.vx[b]*L+o.vy[b]*R;A?(o.vx[b]=0,o.vy[b]=0):z<0&&(o.vx[b]-=z*L,o.vy[b]-=z*R),P=Math.min(f-k,Math.max(k,P)),w=Math.min(d-k,Math.max(k,w)),T=t.sdfAt(P,w)}if(c!==null&&(P!==M||w!==O)&&c(M,O,P,w,a)===1)if(P=a[0],w=a[1],A)o.vx[b]=a[4],o.vy[b]=a[5];else{const q=(o.vx[b]-a[4])*a[2]+(o.vy[b]-a[5])*a[3];q<0&&(o.vx[b]-=q*a[2],o.vy[b]-=q*a[3])}}}o.x[b]=P,o.y[b]=w}u.m=p,u.o=h,u.s=g,u.e=x}const gh=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),Al=24,vh=1,xh=1,Sl=24,Tl=1,we=(o,t)=>(o+2)*(t+2);function Ml(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function yh(o,t,e,s,n,i){let r=0;for(let c=0;c<i;c+=1){o[c]+=n*e[c];const l=t[c]-n*s[c];t[c]=l,r+=l*l}return r}function wh(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class qt{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(gh(we(s,n),i)),!(s*n<=Al||s<=2&&n<=2);)i=we(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=we(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const c=this.levels[0],l=this.xs,a=this.bs;this.system={get nx(){return c.nx},get ny(){return c.ny},get stride(){return c.stride},ax:c.ax,ay:c.ay,dH:c.dH,dDx:c.dDx,dDy:c.dDy,act:c.act,x:l,b:a}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=we(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:l,dDy:a,diag:u,inv:f,act:d}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let h=1;h<=e;h+=1,p+=1){if(d[p]===0){u[p]=1,f[p]=1;continue}const g=c[p]+l[p]+a[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){d[p]=0,u[p]=1,f[p]=1;continue}u[p]=g,f[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:c,ay:l,diag:a}=t;for(let u=1;u<=i;u+=1){let f=1+u*r;for(let d=1;d<=n;d+=1,f+=1)s[f]=a[f]*e[f]-c[f]*e[f+1]-c[f-1]*e[f-1]-l[f]*e[f+r]-l[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:c,inv:l,x:a,b:u}=t;for(let f=1;f<=n;f+=1){let d=1+(1+f+e&1)+f*i;const m=s+f*i;for(;d<=m;d+=2)a[d]=(u[d]+r[d]*a[d+1]+r[d-1]*a[d-1]+c[d]*a[d+i]+c[d-i]*a[d-i])*l[d]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:c,band:l}=t;let a=0;for(let u=1;u<=s;u+=1){let f=1+u*n;for(let d=1;d<=e;d+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||c[f]>0)&&(l[a++]=f)}t.bandCount=a}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:c,b:l,band:a,bandCount:u}=t;for(let f=e>0?0:u-1;e>0?f<u:f>=0;f+=e){const d=a[f];c[d]=(l[d]+n[d]*c[d+1]+n[d-1]*c[d-1]+i[d]*c[d+s]+i[d-s]*c[d-s])*r[d]}}prepareFine(){const t=this.levels[0],e=we(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=Al||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=we(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const c=e.stride,l=e.h,a=s.h;for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const d=f+1+(u+1)*s.stride;let m=0,p=0,h=0,g=0;for(let P=0;P<2;P+=1){const w=2*u+P;if(!(w>=e.ny))for(let k=0;k<2;k+=1){const S=2*f+k;if(S>=e.nx)continue;const T=S+1+(w+1)*c;if(e.act[T]===0)continue;const M=e.area[T];m+=M,p+=M*((k-.5)*l+e.ox[T]*l),h+=M*((P-.5)*l+e.oy[T]*l),g+=e.dH[T]}}if(m<=0){s.act[d]=0,s.dH[d]=0,s.dDx[d]=0,s.dDy[d]=0,s.gDx[d]=0,s.gDy[d]=0,s.ox[d]=0,s.oy[d]=0;continue}s.act[d]=1,s.area[d]=m/4;const x=p/m,y=h/m;s.ox[d]=x/a,s.oy[d]=y/a,s.dH[d]=g;let b=0,_=0,F=0,A=0;for(let P=0;P<2;P+=1){const w=2*u+P;if(!(w>=e.ny))for(let k=0;k<2;k+=1){const S=2*f+k;if(S>=e.nx)continue;const T=S+1+(w+1)*c;if(e.act[T]!==0){if(e.gDx[T]>0){const M=(k-.5)*l+e.ox[T]*l;b+=e.gDx[T],_+=e.gDx[T]/(e.eDx[T]+Math.abs(M-x))}if(e.gDy[T]>0){const M=(P-.5)*l+e.oy[T]*l;F+=e.gDy[T],A+=e.gDy[T]/(e.eDy[T]+Math.abs(M-y))}}}}s.gDx[d]=b,s.gDy[d]=F,s.dDx[d]=_,s.dDy[d]=A,s.eDx[d]=_>0?b/_:.5*a,s.eDy[d]=A>0?F/A:.5*a}for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const d=f+1+(u+1)*s.stride;if(s.act[d]!==0){if(f+1<n&&s.act[d+1]!==0){const m=2*f+1;let p=0;if(m+1<e.nx)for(let h=0;h<2;h+=1){const g=2*u+h;g>=e.ny||(p+=e.gx[m+1+(g+1)*c])}if(p>0){const h=a*(1+s.ox[d+1]-s.ox[d]);s.gx[d]=p,s.ax[d]=p/Math.max(.25*a,h)}}if(u+1<i&&s.act[d+s.stride]!==0){const m=2*u+1;let p=0;if(m+1<e.ny)for(let h=0;h<2;h+=1){const g=2*f+h;g>=e.nx||(p+=e.gy[g+1+(m+1)*c])}if(p>0){const h=a*(1+s.oy[d+s.stride]-s.oy[d]);s.gy[d]=p,s.ay[d]=p/Math.max(.25*a,h)}}}}qt.diagonal(s),qt.findBand(s);for(let u=0;u<e.ny;u+=1){let f=1+(u+1)*c;for(let d=0;d<e.nx;d+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}qt.weights(s,d,u,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const c=e>>1,l=s>>1,a=(e&1)===1?1:-1,u=(s&1)===1?1:-1,f=t.stride,d=c+1+(l+1)*f;r[0]=d,r[1]=d+a,r[2]=d+u*f,r[3]=d+a+u*f;const m=c+a>=0&&c+a<t.nx,p=l+u>=0&&l+u<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[d]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<Sl;m+=1)qt.color(e,0),qt.color(e,1);for(let m=0;m<Sl;m+=1)qt.color(e,1),qt.color(e,0);return}for(let m=0;m<vh;m+=1)qt.color(e,0),qt.color(e,1);for(let m=0;m<Tl;m+=1)qt.bandSweep(e,1);qt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,we(s.nx,s.ny)),s.x.fill(0,0,we(s.nx,s.ny));const{stride:n,act:i,b:r,r:c,x:l}=e,{pIdx:a,pW:u}=s,f=s.b,d=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,p+=1){if(i[p]===0)continue;const g=r[p]-c[p],x=4*p;f[a[x]]+=u[x]*g,f[a[x+1]]+=u[x+1]*g,f[a[x+2]]+=u[x+2]*g,f[a[x+3]]+=u[x+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,p+=1){if(i[p]===0)continue;const g=4*p;l[p]+=u[g]*d[a[g]]+u[g+1]*d[a[g+1]]+u[g+2]*d[a[g+2]]+u[g+3]*d[a[g+3]]}}for(let m=0;m<Tl;m+=1)qt.bandSweep(e,-1);for(let m=0;m<xh;m+=1)qt.color(e,1),qt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:l,dDy:a,act:u}=t,f=this.nullId,d=we(e,s);let m=!1;for(let p=0;p<d;p+=1)if(u[p]!==0&&!(c[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,d),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let h=1;h<=e;h+=1){const g=h+p*n;if(u[g]===0||f[g]!==-2)continue;let x=0,y=0,b=!1;const _=-3-this.nullCount;this.stack[x++]=g,f[g]=_;let F=g,A=g;for(;x>0;){const w=this.stack[--x];y+=1,w<F&&(F=w),w>A&&(A=w),(c[w]>0||l[w]>0||a[w]>0)&&(b=!0),i[w]>0&&f[w+1]===-2&&(f[w+1]=_,this.stack[x++]=w+1),i[w-1]>0&&f[w-1]===-2&&(f[w-1]=_,this.stack[x++]=w-1),r[w]>0&&f[w+n]===-2&&(f[w+n]=_,this.stack[x++]=w+n),r[w-n]>0&&f[w-n]===-2&&(f[w-n]=_,this.stack[x++]=w-n)}let P=-1;if(!b){if(P=this.nullCount,P>=this.nullSum.length){const w=k=>{const S=new Float64Array(2*k.length);return S.set(k),S};this.nullSum=w(this.nullSum),this.nullCnt=w(this.nullCnt)}this.nullCnt[P]=y,this.nullCount+=1}for(let w=F;w<=A;w+=1)f[w]===_&&(f[w]=P)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=we(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=we(i.nx,i.ny),{act:c}=i,l=this.xs,a=this.bs,u=i.stride;for(let F=0;F<r;F+=1){if(c[F]===0){l[F]=0,a[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||c[F+1]===0)&&(i.ax[F]=0),(F+u>=r||c[F+u]===0)&&(i.ay[F]=0)}qt.diagonal(i);for(let F=0;F<r;F+=1)c[F]===0&&(l[F]=0,a[F]=0);this.findNull(),this.project(a),s&&(qt.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,d=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),d.fill(0,0,r),qt.apply(i,l,p);let h=0,g=0;for(let F=0;F<r;F+=1){const A=c[F]===0?0:a[F]-p[F];f[F]=A,h+=a[F]*a[F],g+=A*A}this.project(f);const x=Math.sqrt(h);if(x===0)return l.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let y=Math.sqrt(g)/x;if(y<=t)return n.iterations=0,n.residual=y,n.capped=!1,n;this.precondition(s,f,d,r);let b=0;for(let F=0;F<r;F+=1)m[F]=d[F],b+=f[F]*d[F];let _=0;for(;_<e;){_+=1,qt.apply(i,m,p);const F=Ml(m,p,r);if(!(F>0))break;const A=b/F;if(g=yh(l,f,m,p,A,r),y=Math.sqrt(g)/x,y<=t)break;this.precondition(s,f,d,r);const P=Ml(f,d,r),w=P/b;b=P,wh(m,d,w,r)}this.project(l);for(let F=0;F<r;F+=1)c[F]===0&&(l[F]=0);return n.iterations=_,n.residual=y,n.capped=y>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const _h=.1,Bl=5e-4,Cl=1e-9,Vo=.1;function Wi(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function pe(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Fh{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new ph);v(this,"dropletDrift",null);v(this,"bodyHit",null);v(this,"afterSolve",null);v(this,"hit",new Float64Array(6));v(this,"escaped",{m:0,o:0,s:0,e:0});v(this,"velocityAtFn",(t,e,s)=>{mi(this.g,t,e,s)});v(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,c=1/e.dx;e.updateThin();for(let l=0;l<t.count;l+=1){n[l]=pe(t.x[l]*c-.5,s,0),i[l]=pe(t.y[l]*c-.5,s,3);const a=9*l;for(let u=0;u<3;u+=1)for(let f=0;f<3;f+=1)r[a+f+3*u]=s[f]*s[3+u];e.thinAny&&e.cutWeights(n[l]+1,i[l]+1,r,a)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:c,ny:l,kind:a}=e;for(let u=0;u<t.count;u+=1){const f=9*u,d=s[u],m=n[u];let p=0;for(let h=0;h<9;h+=1){const g=d+h%3,x=m+(h/3|0),b=g>=0&&x>=0&&g<c&&x<l&&a[g+x*c]===rt?i[f+h]:0;r[f+h]=b,p+=b}if(p>0){const h=1/p;for(let g=0;g<9;g+=1)r[f+g]*=h}else{for(let h=0;h<9;h+=1)r[f+h]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:c,wt:l}=this,{nx:a,ny:u,kind:f}=s,d=1/s.dx;i[t]=pe(e.x[t]*d-.5,n,0),r[t]=pe(e.y[t]*d-.5,n,3);const m=9*t;for(let h=0;h<3;h+=1)for(let g=0;g<3;g+=1)c[m+g+3*h]=n[g]*n[3+h];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,c,m);let p=0;for(let h=0;h<9;h+=1){const g=i[t]+h%3,x=r[t]+(h/3|0),y=g>=0&&x>=0&&g<a&&x<u&&f[g+x*a]===rt;l[m+h]=y?c[m+h]:0,y&&(p+=c[m+h])}if(p>0)for(let h=0;h<9;h+=1)l[m+h]/=p;else{for(let h=0;h<9;h+=1)l[m+h]=0;l[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:c,phi:l}=e;l.fill(0);const a=1/e.vCell;let u=0,f=0;for(let d=0;d<t.count;d+=1){const m=t.mass[d]/t.rho[d];u+=t.mass[d],f+=m;const p=9*d,h=s[d],g=n[d];for(let x=0;x<9;x+=1){const y=h+x%3,b=g+(x/3|0);y<0||b<0||y>=r||b>=c||(l[y+b*r]+=i[p+x]*m*a)}}f>0&&(this.rhoRef=u/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=pt;continue}const c=e.phi[r];let l=c>0&&c+e.phiS[r]+e.alpha[r]+e.grain[r]>=.5;if(!l&&t!==null&&t[r]!==$&&t[r]!==pt){const a=r%s,u=(r-a)/s;(a>0?t[r-1]===$&&e.faceOpen(r,0)>0:e.openL)||(a<s-1?t[r+1]===$&&e.faceOpen(r,1)>0:e.openR)||(u>0?t[r-s]===$&&e.faceOpen(r,2)>0:e.openB)||(u<n-1?t[r+s]===$&&e.faceOpen(r,3)>0:e.openT)||(l=!0)}e.kind[r]=l?rt:$,l&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:c,rv:l}=this,{nx:a,ny:u,dx:f}=e,d=1/f,m=a+1;n.fill(0),i.fill(0),r.fill(0),c.fill(0),l.fill(0);const p=1/this.rhoRef,h=this.viscous;h&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,x=this.etaV;h&&(g.fill(0),x.fill(0));for(let y=0;y<t.count;y+=1){const b=t.x[y],_=t.y[y],F=t.mass[y],A=h?oi(t.mat[y],t.T[y]):0,P=t.vx[y],w=t.vy[y],k=t.c00[y],S=t.c01[y],T=t.c10[y],M=t.c11[y],O=b*d,q=_*d;let N=pe(O,s,0),L=pe(q-.5,s,3);for(let E=0;E<3;E+=1){const I=L+E,z=(I+.5)*f-_;for(let G=0;G<3;G+=1){const X=N+G,nt=s[G]*s[3+E]*F,bt=nt*(P+k*(X*f-b)+S*z);if(X>=0&&X<=a&&I>=0&&I<u){const ct=X+I*m;n[ct]+=nt,i[ct]+=bt,h&&(g[ct]+=nt*A)}else this.mirrorU(X,I),n[this.mf]+=nt,i[this.mf]+=this.ms*bt,h&&(g[this.mf]+=nt*A)}}N=pe(O-.5,s,0),L=pe(q,s,3);const R=t.rho[y]*p;for(let E=0;E<3;E+=1){const I=L+E,z=I*f-_;for(let G=0;G<3;G+=1){const X=N+G,nt=s[G]*s[3+E]*F,bt=nt*(w+T*((X+.5)*f-b)+M*z);let ct,W=1;X>=0&&X<a&&I>=0&&I<=u?ct=X+I*a:(this.mirrorV(X,I),ct=this.mf,W=this.ms),r[ct]+=nt,c[ct]+=W*bt,l[ct]+=nt*R,h&&(x[ct]+=nt*A)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,l=1;r<0?s.openL?r=0:(r=-r,l=-l):r>n&&(s.openR?r=n:(r=2*n-r,l=-l)),c<0?c=s.openB?0:-1-c:c>=i&&(c=s.openT?i-1:2*i-1-c),r=Math.min(n,Math.max(0,r)),c=Math.min(i-1,Math.max(0,c)),this.mf=r+c*(n+1),this.ms=l}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,l=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),c<0?s.openB?c=0:(c=-c,l=-l):c>i&&(s.openT?c=i:(c=2*i-c,l=-l)),r=Math.min(n-1,Math.max(0,r)),c=Math.min(i,Math.max(0,c)),this.mf=r+c*n,this.ms=l}step(t,e,s,n){const{g:i,P:r}=this,{nx:c,ny:l,dx:a,kind:u}=i,f=c+1;this.viscous=r.hasOther(),this.p2g();const{mu:d,pu:m,mv:p,pv:h,rv:g,knownU:x,knownV:y}=this,b=i.ul,_=i.vl,F=this.rhoRef*i.vCell*.25,A=Cl*F,P=this.viscous;for(let R=0;R<i.nu;R+=1)b[R]=d[R]>A?m[R]/d[R]+(P?0:t*this.fU[R]/(this.rhoRef*i.vCell)):0;for(let R=0;R<i.nv;R+=1)_[R]=p[R]>A?h[R]/p[R]+(P?0:-t*e*(g[R]/p[R])+t*this.fV[R]/(this.rhoRef*i.vCell)):0;for(let R=0;R<l;R+=1)for(let E=0;E<=c;E+=1){const I=E+R*f,z=E>0?u[E-1+R*c]:-1,G=E<c?u[E+R*c]:-1,X=E===0&&!i.openL,nt=E===c&&!i.openR;if(X||nt||z===pt||G===pt||i.au[I]<=0){b[I]=X||nt?0:i.usol[I],x[I]=2;continue}x[I]=z===rt||G===rt?1:0}for(let R=0;R<=l;R+=1)for(let E=0;E<c;E+=1){const I=E+R*c,z=R>0?u[E+(R-1)*c]:-1,G=R<l?u[E+R*c]:-1,X=R===0&&!i.openB,nt=R===l&&!i.openT;if(X||nt||z===pt||G===pt||i.av[I]<=0){_[I]=X||nt?0:i.vsol[I],y[I]=2;continue}y[I]=z===rt||G===rt?1:0}if(this.last.viscIterations=0,P){this.viscosity(t);const R=t/(this.rhoRef*i.vCell);for(let E=0;E<i.nu;E+=1)x[E]!==2&&d[E]>A&&(b[E]+=R*this.fU[E]);for(let E=0;E<i.nv;E+=1)y[E]!==2&&p[E]>A&&(_[E]+=-t*e*(g[E]/p[E])+R*this.fV[E])}let w=c,k=-1,S=l,T=-1,M=0;for(let R=0;R<l;R+=1)for(let E=0;E<c;E+=1)u[E+R*c]===rt&&(M+=1,E<w&&(w=E),E>k&&(k=E),R<S&&(S=R),R>T&&(T=R));const O=this.last.solve;if(O.iterations=0,O.residual=0,O.capped=!1,M>0){const R=k-w+1,E=T-S+1,I=this.solver,z=I.begin(R,E),G=t/this.rhoRef,X=1/i.vCell,nt=this.pGas;for(let W=S;W<=T;W+=1)for(let H=w;H<=k;H+=1){const st=H+W*c;if(u[st]!==rt)continue;const wt=I.at(H-w,W-S);z.act[wt]=1,z.x[wt]=i.pl[st];const mt=H+W*f,Z=H+W*c,j=x[mt+1]===2?0:i.au[mt+1],B=x[mt]===2?0:i.au[mt],C=y[Z+c]===2?0:i.av[Z+c],D=y[Z]===2?0:i.av[Z],U=Wi(b,i.usol,mt+1,j,x)-Wi(b,i.usol,mt,B,x)+Wi(_,i.vsol,Z+c,C,y)-Wi(_,i.vsol,Z,D,y),ft=i.phi[st]+i.phiS[st]+i.alpha[st]+i.grain[st];let it=this.volSrc[st]*X;const vt=this.gasAt(H-1,W)||this.gasAt(H+1,W)||this.gasAt(H,W-1)||this.gasAt(H,W+1),Lt=ft-1;(Lt>0||!vt)&&(it+=_h*Lt/Math.max(t,Bl));let yt=it*a*a-a*U;if(H+1<c){const Rt=u[st+1];if(Rt===rt)H+1<=k&&j>0&&(z.ax[wt]=j<1?G*j:G);else if(Rt===$&&j>0){const At=(j<1?G*j:G)/this.theta(st,st+1);z.dDx[wt]+=At,yt+=At*nt[st+1]}}else i.openR&&j>0&&(z.dDx[wt]+=j<1?2*G*j:2*G);if(H>0){if(u[st-1]===$&&B>0){const At=(B<1?G*B:G)/this.theta(st,st-1);z.dDx[wt]+=At,yt+=At*nt[st-1]}}else i.openL&&B>0&&(z.dDx[wt]+=B<1?2*G*B:2*G);if(W+1<l){const Rt=u[st+c];if(Rt===rt)W+1<=T&&C>0&&(z.ay[wt]=C<1?G*C:G);else if(Rt===$&&C>0){const At=(C<1?G*C:G)/this.theta(st,st+c);z.dDy[wt]+=At,yt+=At*nt[st+c]}}else i.openT&&C>0&&(z.dDy[wt]+=C<1?2*G*C:2*G);if(W>0){if(u[st-c]===$&&D>0){const At=(D<1?G*D:G)/this.theta(st,st-c);z.dDy[wt]+=At,yt+=At*nt[st-c]}}else i.openB&&D>0&&(z.dDy[wt]+=D<1?2*G*D:2*G);z.b[wt]=yt}const bt=I.solve(s,n,!0);O.iterations=bt.iterations,O.residual=bt.residual,O.capped=bt.capped;const ct=i.pl;for(let W=0;W<i.n;W+=1)ct[W]=u[W]===$?nt[W]:0;for(let W=S;W<=T;W+=1)for(let H=w;H<=k;H+=1){const st=H+W*c;u[st]===rt&&(ct[st]=z.x[I.at(H-w,W-S)])}for(let W=0;W<l;W+=1)for(let H=0;H<=c;H+=1){const st=H+W*f;if(x[st]===1){if(H===0){b[st]-=G/a*2*(ct[W*c]-0);continue}if(H===c){b[st]-=G/a*2*(0-ct[c-1+W*c]);continue}b[st]-=G/a*this.across(H-1+W*c,H+W*c)}}for(let W=0;W<=l;W+=1)for(let H=0;H<c;H+=1){const st=H+W*c;if(y[st]===1){if(W===0){_[st]-=G/a*2*(ct[H]-0);continue}if(W===l){_[st]-=G/a*2*(0-ct[H+(l-1)*c]);continue}_[st]-=G/a*this.across(H+(W-1)*c,H+W*c)}}this.afterSolve!==null&&this.afterSolve(I,w,S,t)}this.extrapolate();const q=this.markStranded(),N=this.g2p(q?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const L=this.last;return L.cells=M,L.uMax=N,L.escapedMass=this.escM,L.escapedOther=this.escO,L.escapedSalt=this.escS,L.escapedEnergy=this.escE,L}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t]+s.grain[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e]+s.grain[e];return!(n>.5)||!(n>i)?Vo:Math.max(Vo,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===$&&n[e]===rt?i/this.theta(e,t):n[e]===$&&n[t]===rt?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new qt(e.nx+1,e.ny+1));const s=Cl*this.rhoRef*e.vCell*.25;this.last.viscIterations=mh(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===$}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:c,volSrc:l}=this,{nx:a,ny:u}=s,f=1/Math.max(t,Bl);for(let d=0;d<e.count;d+=1){const m=c[d];if(m===0)continue;const p=9*d,h=n[d],g=i[d];for(let x=0;x<9;x+=1){const y=h+x%3,b=g+(x/3|0);y<0||b<0||y>=a||b>=u||(l[y+b*a]+=r[p+x]*m*f)}}}extrapolate(){th(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:c,ny:l,dx:a}=n,u=1/a,f=c+1,d=n.ul,m=n.vl,p=4/(a*a);let h=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const q=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];q>h&&(h=q);continue}const x=s.x[g],y=s.y[g],b=x*u,_=y*u;let F=pe(b,i,0),A=pe(_-.5,i,3),P=0,w=0,k=0;for(let q=0;q<3;q+=1){const N=A+q,L=(N+.5)*a-y;for(let R=0;R<3;R+=1){const E=F+R,I=i[R]*i[3+q];let z;E>=0&&E<=c&&N>=0&&N<l?z=d[E+N*f]:(this.mirrorU(E,N),z=this.ms*d[this.mf]),P+=I*z,w+=I*z*(E*a-x),k+=I*z*L}}F=pe(b-.5,i,0),A=pe(_,i,3);let S=0,T=0,M=0;for(let q=0;q<3;q+=1){const N=A+q,L=N*a-y;for(let R=0;R<3;R+=1){const E=F+R,I=i[R]*i[3+q];let z;E>=0&&E<c&&N>=0&&N<=l?z=m[E+N*c]:(this.mirrorV(E,N),z=this.ms*m[this.mf]),S+=I*z,T+=I*z*((E+.5)*a-x),M+=I*z*L}}s.vx[g]=P,s.vy[g]=S,s.c00[g]=p*w,s.c01[g]=p*k,s.c10[g]=p*T,s.c11[g]=p*M;const O=P*P+S*S;O>h&&(h=O)}return Math.sqrt(h)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),eh(this.P,this.g,this.stranded)}velocityAt(t,e,s){mi(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;bh(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class Ph{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.c00[c]=0,this.c01[c]=0,this.c10[c]=0,this.c11[c]=0,this.mass[c]=s,this.h[c]=n,this.mat[c]=i,this.spc[2*c]=r>0?Si:0,this.spc[2*c+1]=0,this.smass[2*c]=r>0?r:0,this.smass[2*c+1]=0,this.T[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(c),c}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=Z0(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Vr(r,i);return}const s=this.mat[t],n=C0(s,this.h[t]);this.T[t]=n,this.rho[t]=Ds(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==dt)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?Q0(this.T[t],e/this.mass[t]):pc(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function kh(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:c,heat:l}=o,{nx:a,ny:u,n:f,kind:d}=s,{Tl:m}=t,p=t.rd;let h=!1;for(let b=0;b<f;b+=1){if(p[b]=0,d[b]===$&&t.Cl[b]>0){const k=t.boilingAt(b,r.pAt(b));m[b]>k&&(p[b]=k,h=!0);continue}if(d[b]!==rt)continue;const _=b%a,F=(b-_)/a,A=F+1<u?b+a:-1;if(!(A>=0&&d[A]===$&&s.faceOpen(b,3)>0||_>0&&d[b-1]===$&&s.faceOpen(b,0)>0||_<a-1&&d[b+1]===$&&s.faceOpen(b,1)>0||F>0&&d[b-a]===$&&s.faceOpen(b,2)>0))continue;const w=t.boilingAt(b,r.pAt(b));m[b]>w&&(p[b]=w,h=!0)}if(!h)return;const g=t.mtot;g.fill(0);const x=t.Y0;x.fill(0);const y=i.rhoRef*s.vCell/4;for(let b=0;b<n.count;b+=1){if(n.mat[b]!==dt)continue;const _=n.smass[2*b],F=_>0?_/n.mass[b]:0,A=9*b;let P=0,w=0,k=-1,S=0;for(let O=0;O<2;O+=1){for(let q=0;q<9;q+=1){const N=i.wt[A+q];if(N===0)continue;const L=i.bi[b]+q%3,R=i.bj[b]+(q/3|0);if(L<0||R<0||L>=a||R>=u)continue;const E=L+R*a,I=p[E];if(I===0)continue;const z=_>0?af(I,F):kt(I);if(n.h[b]<=z)continue;const G=xt(I),X=N*n.mass[b]*(n.h[b]-z)/(G-(_>0?gn(I,F):z));O===0?(P+=X,w+=X*G,N>S&&(S=N,k=E)):(g[E]+=X,x[E]+=X*G)}if(P===0)break;if(O===0&&n.mass[b]-_-P<Ho*y){const q=p[k],N=n.mass[b]-_,L=xt(q),R=_>0?_*Mi(q):0;g[k]+=N,x[k]+=N*L,_>0&&o.salt.deposit(n.x[b],n.y[b],_,R),l.src[k]-=(N*L+R-n.mass[b]*n.h[b])/e,P=-1;break}}if(P===0)continue;if(P<0){i.removeParticle(b),b-=1;continue}const T=n.mass[b]/n.rho[b],M=n.mass[b]-P;n.h[b]=(n.mass[b]*n.h[b]-w)/M,n.mass[b]=M,n.derive(b),i.dVp[b]+=M/n.rho[b]-T}for(let b=0;b<f;b+=1){if(g[b]===0)continue;const _=b%a,F=(b-_)/a;let A=0;const P=d[b]===$?b:F+1<u&&d[b+a]===$&&s.faceOpen(b,3)>0?b+a:-1;if(P>=0)s.mg[Q*f+P]+=g[b],s.Hg[P]+=x[b],c.deriveCell(P);else{const w=t.side;w[0]=_>0&&d[b-1]===$&&s.faceOpen(b,0)>0?b-1:-1,w[1]=_<a-1&&d[b+1]===$&&s.faceOpen(b,1)>0?b+1:-1,w[2]=F>0&&d[b-a]===$&&s.faceOpen(b,2)>0?b-a:-1,w[3]=-1;for(let k=0;k<3;k+=1)w[k]>=0&&(A+=1);for(let k=0;k<3;k+=1)w[k]<0||(s.mg[Q*f+w[k]]+=g[b]/A,s.Hg[w[k]]+=x[b]/A,c.deriveCell(w[k]))}t.produced+=g[b]}}function Ah(o,t,e,s,n){const i=o.grid,r=i.n,c=i.mg[lt*r+t],l=i.mg[at*r+t],a=i.Hg[t];if(s<=0)return ja(c,l,e,a);let u=n;for(let f=0;f<6;f+=1){const d=c*ue(lt,u)+l*ue(at,u)+e*xt(u)+s*kt(u),m=(a-d)/Co(c,l,e,s,u);if(u+=m,Math.abs(m)<1e-10)break}return u}function Gn(o,t,e,s,n,i){const r=o.grid,c=r.n,l=r.mg[Q*c+t]-e,a=r.mfog[t]+e,u=Ah(o,t,l,a,i),f=l/gt[Q];return(f+s>0?f/(f+s)*n:0)-ci(u)}function lo(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const c=Math.max(-n.mfog[e],Math.min(n.mg[Q*r+e],s));n.mg[Q*r+e]-=c,n.mfog[e]+=c,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=c,i.deriveCell(e)}function Sh(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==$)continue;const r=e.mg[Q*n+i],c=e.mfog[i];if(r<=0&&c<=0)continue;const l=e.mg[lt*n+i]/gt[lt]+e.mg[at*n+i]/gt[at],a=s.pAt(i),u=e.T[i];if(c<=0){const y=r/gt[Q];if(y/(y+l)*a<.999*ci(u))continue}const f=Gn(o,i,0,l,a,u);if(f<=0&&c<=0)continue;let d,m,p,h;if(f>0)d=0,p=f,m=r,h=Gn(o,i,m,l,a,u);else if(m=0,h=f,d=-c,p=Gn(o,i,d,l,a,u),p<=0){lo(o,t,i,d);continue}if(h>0){lo(o,t,i,m);continue}let g=d,x=0;for(let y=0;y<40;y+=1){g=(d*h-m*p)/(h-p),(!Number.isFinite(g)||g<=Math.min(d,m)||g>=Math.max(d,m))&&(g=.5*(d+m));const b=Gn(o,i,g,l,a,u);if(Math.abs(b)<=1e-13*a)break;b>0?(d=g,p=b,x===1&&(h/=2),x=1):(m=g,h=b,x===-1&&(p/=2),x=-1)}if(lo(o,t,i,g),f<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const y=Gn(o,i,0,l,a,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(y)/ci(e.T[i]))}}}const Ho=.001;class Th{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"fed");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*oe.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.fed=new Uint8Array(e),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,c=Math.min(.999,n*ci(t)/e),l=i.mg[lt*r+s],a=i.mg[at*r+s],u=l+a,f=u>0?u/(l/gt[lt]+a/gt[at]):.02885;return c*gt[Q]/(c*gt[Q]+(1-c)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:c,Cl:l,acc:a,accH:u,accAll:f,accS:d}=this;l.fill(0),c.fill(0),a.fill(0),u.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const x=e.mass[g],y=e.mat[g],b=x*e.cp(g),_=e.smass[2*g],F=x-_,A=_>0?gn(e.T[g],_/x):e.h[g];_>0&&!p&&(p=!0,d.fill(0)),y!==dt&&!m&&(m=!0,f.fill(0),this.accMat.fill(0));const P=9*g;for(let w=0;w<9;w+=1){const k=s.wt[P+w];if(k===0)continue;const S=s.bi[g]+w%3,T=s.bj[g]+(w/3|0);if(S<0||T<0||S>=n||T>=i)continue;const M=S+T*n;l[M]+=k*b,c[M]+=k*b*e.T[g],y===dt&&(a[M]+=k*F,u[M]+=k*F*A),p&&(d[M]+=k*_),m&&(this.accMat[y*r+M]+=k*x)}}for(let g=0;g<r;g+=1)c[g]=l[g]>0?c[g]/l[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const x=d[g]>0&&a[g]>0?d[g]/(a[g]*Be):0;this.mol[g]=x,this.aw[g]=x>0?rf(c[g],x):1}if(!m){f.set(a),this.host.fill(dt);return}const h=oe.length;for(let g=0;g<r;g+=1){this.accMat[dt*r+g]=p?a[g]+d[g]:a[g];let x=0,y=dt,b=-1;for(let _=0;_<h;_+=1){const F=this.accMat[_*r+g];x+=F,F>b&&(b=F,y=_)}f[g]=x,this.host[g]=y}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?bc(e,this.mol[t]):St(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:kt(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?dt:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,{acc:l,dm:a,fed:u}=this;for(let d=0;d<s.n;d+=1)u[d]=l[d]>0?1:0;a.fill(0,0,n.count);for(let d=0;d<n.count;d+=1){if(n.mat[d]!==dt)continue;const m=9*d;let p=0;for(let h=0;h<9;h+=1){const g=i.wt[m+h];if(g===0)continue;const x=i.bi[d]+h%3,y=i.bj[d]+(h/3|0);if(x<0||y<0||x>=r||y>=c)continue;const b=x+y*r;t[b]!==0&&l[b]>0&&(p+=t[b]*g*(n.mass[d]-n.smass[2*d])/l[b])}a[d]=p}const f=i.rhoRef*s.vCell/4;for(let d=n.count-1;d>=0;d-=1){const m=a[d];if(m===0)continue;if(n.smass[2*d]>0){this.applySalty(d,m,f,e);continue}const p=n.mass[d]/n.rho[d],h=n.mass[d]+m;if(h<Ho*f){this.track(d,-n.mass[d]),this.vanish(d,Math.max(0,h),e);continue}this.track(d,m),n.mass[d]=h,i.dVp[d]+=h/n.rho[d]-p}for(let d=0;d<s.n;d+=1){if(t[d]<=0||u[d]!==0)continue;const m=d%r,p=(d-m)/r,h=n.add((m+.5)*s.dx,(p+.5)*s.dx,t[d],this.waterH(d),dt);h<0||(i.placeParticle(h),i.dVp[h]=t[d]/n.rho[h],this.track(h,t[d]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,l=9*t,a=pc(n.mat[t],n.T[t]);for(let u=0;u<9;u+=1){const f=i.wt[l+u];if(f===0)continue;const d=i.bi[t]+u%3,m=i.bj[t]+(u/3|0);if(d<0||m<0||d>=r||m>=c)continue;const p=d+m*r;this.acc[p]+=f*e,this.accH[p]+=f*e*n.h[t],this.accAll[p]+=f*e,this.Cl[p]+=f*e*a}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,c=i.smass[2*t],l=i.mass[t],a=l-c,u=gn(i.T[t],c/l),f=i.cp(t),d=l*i.h[t]+e*u,m=a+e;if(m<Ho*s){this.trackSalty(t,-a,-a*u,-l,-c,-l*f),this.dryUp(t,Math.max(0,m),d,n);return}const p=l/i.rho[t];i.mass[t]=l+e,i.h[t]=d/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const h=gn(i.T[t],c/i.mass[t]);this.trackSalty(t,e,m*h-a*u,e,0,i.mass[t]*i.cp(t)-l*f)}trackSalty(t,e,s,n,i,r){const{grid:c,liquid:l}=this.e,{nx:a,ny:u}=c,f=9*t;for(let d=0;d<9;d+=1){const m=l.wt[f+d];if(m===0)continue;const p=l.bi[t]+d%3,h=l.bj[t]+(d/3|0);if(p<0||h<0||p>=a||h>=u)continue;const g=p+h*a;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:c,heat:l,gas:a}=this.e,u=r.T[t],f=r.smass[2*t],d=f*Mi(u);this.e.salt.deposit(r.x[t],r.y[t],f,d);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==$;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[Q*i.n+p]+=e,i.Hg[p]+=e*xt(u),this.produced+=e,a.deriveCell(p)),l.src[m]-=(e*xt(u)+d-s)/n;else if(m>=0){for(let h=0;h<r.count;h+=1)if(h!==t&&r.mat[h]===r.mat[t]&&i.cellAt(r.x[h],r.y[h])===m){const g=r.mass[h]*r.h[h]+(s-d);r.mass[h]+=e,r.h[h]=g/r.mass[h],r.derive(h);break}}c.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:c,gas:l}=this.e,a=n.cellAt(i.x[t],i.y[t]);let u=a;for(;u>=0&&n.kind[u]!==$;)u=u+n.nx<n.n?u+n.nx:-1;if(e>0&&u>=0&&a>=0){const f=i.T[t];n.mg[Q*n.n+u]+=e,n.Hg[u]+=e*xt(f),c.src[a]-=e*(xt(f)-i.h[t])/s,this.produced+=e,l.deriveCell(u)}else if(e>0&&a>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===a){const d=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=d/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),kh(this.e,this,t),Sh(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:c}=e,{nx:l,ny:a,n:u,depth:f,kind:d}=s,{mtot:m,rd:p,Y0:h,Tl:g,Fm:x,Fe:y,edge:b,hvC:_,hnC:F,hoC:A}=this;let P=!1;for(let q=0;q<u;q+=1){if(d[q]!==$){m[q]=0;continue}const N=s.mg[q]+s.mg[u+q]+s.mg[Q*u+q];m[q]=N,h[q]=N>0?s.mg[Q*u+q]/N:0;const L=s.T[q];p[q]=n.rho[q]*S0(L,i.pAt(q)),_[q]=xt(L),F[q]=ue(lt,L),A[q]=ue(at,L),P=!0}if(!P)return;for(let q=0;q<a;q+=1)for(let N=0;N<l;N+=1){const L=N+q*l;b[L]=d[L]===$&&(N===0||q===0||N===l-1||q===a-1||d[L-1]!==$||d[L+1]!==$||d[L-l]!==$||d[L+l]!==$)?1:0}const w=c.begin(l,a),k=w.stride,S=e.ambientY[Q],{bG:T,bY:M}=this;for(let q=0;q<a;q+=1)for(let N=0;N<l;N+=1){const L=N+q*l;if(d[L]!==$||m[L]<=0)continue;const R=N+1+(q+1)*k;w.act[R]=1,w.x[R]=h[L],w.dH[R]=m[L]/t;let E=m[L]*h[L]/t;const I=s.au[N+1+q*(l+1)],z=s.av[L+l];if(N+1<l&&d[L+1]===$&&m[L+1]>0&&I>0&&(w.ax[R]=I*.5*(p[L]+p[L+1])*f),q+1<a&&d[L+l]===$&&m[L+l]>0&&z>0&&(w.ay[R]=z*.5*(p[L]+p[L+l])*f),b[L]===0){w.b[R]=E;continue}let G=0;for(let X=0;X<4;X+=1){const nt=this.boundary(L,N,q,X,S);T[4*L+X]=nt,M[4*L+X]=this.yb,!(nt<=0)&&(G+=nt,E+=nt*this.yb)}w.dDx[R]=G,w.b[R]=E}c.solve(1e-9,200,!1),x.fill(0),y.fill(0);const O=w.x;for(let q=0;q<a;q+=1)for(let N=0;N<l;N+=1){const L=N+q*l;if(d[L]!==$||m[L]<=0)continue;const R=N+1+(q+1)*k,E=O[R],I=s.au[N+1+q*(l+1)],z=s.av[L+l];if(N+1<l&&d[L+1]===$&&m[L+1]>0&&I>0&&this.exchange(L,L+1,t*I*.5*(p[L]+p[L+1])*f*(E-O[R+1])),q+1<a&&d[L+l]===$&&m[L+l]>0&&z>0&&this.exchange(L,L+l,t*z*.5*(p[L]+p[L+l])*f*(E-O[R+k])),b[L]!==0)for(let G=0;G<4;G+=1){const X=T[4*L+G];if(X<=0)continue;const nt=t*X*(M[4*L+G]-E),ct=(G===0?N===0:G===1?N===l-1:G===2?q===0:q===a-1)?-1:G===0?L-1:G===1?L+1:G===2?L-l:L+l;if(ct<0)this.ambientExchange(L,nt);else if(d[ct]===rt)if(nt>0){const W=Math.min(nt,Math.max(0,this.acc[ct]+x[ct]));if(!(W>0))continue;const H=g[ct];s.mg[Q*u+L]+=W,s.Hg[L]+=W*xt(H),x[ct]-=W,y[ct]-=W*xt(H),this.produced+=W}else{const W=Math.min(-nt,s.mg[Q*u+L]);s.mg[Q*u+L]-=W,s.Hg[L]-=W*xt(s.T[L]),x[ct]+=W,y[ct]+=W*xt(s.T[L]),this.condensed+=W}else if(d[ct]===pt){const W=s.T[ct];if(nt<0){const H=Math.min(-nt,s.mg[Q*u+L]);s.mg[Q*u+L]-=H,s.Hg[L]-=H*xt(s.T[L]),s.film[ct]+=H,s.Es[ct]+=H*kt(W),r.src[ct]+=H*(xt(s.T[L])-kt(W))/t,this.dew+=H}else{const H=Math.min(nt,s.film[ct]);s.film[ct]-=H,s.Es[ct]-=H*kt(W),s.mg[Q*u+L]+=H,s.Hg[L]+=H*xt(W),r.src[ct]-=H*(xt(W)-kt(W))/t,this.dew-=H}}}}for(let q=0;q<u;q+=1)x[q]!==0&&(r.src[q]+=(y[q]-x[q]*this.waterH(q))/t);this.applyMass(x,t);for(let q=0;q<u;q+=1)d[q]===$&&m[q]>0&&n.deriveCell(q)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:c,ny:l,depth:a,kind:u}=r,f=n===0?e===0:n===1?e===c-1:n===2?s===0:s===l-1,d=2*this.rd[t]*a;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,d):0;const m=n===0?t-1:n===1?t+1:n===2?t-c:t+c;this.side[n]=m;const p=u[m],h=this.Y0[t],g=this.e.regions.pAt(t);if(p===rt){const x=r.faceOpen(t,n);if(!(x>0))return 0;const y=this.waterShare(m);return y<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),x*d*(1-h)*y)}if(p===pt){const x=this.ysat(r.T[m],g,t);return h>x||r.film[m]>0&&h<x?(this.yb=x,d*(1-h)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,c=s>0?e:t;let l=Math.abs(s);l=Math.min(l,n.mg[Q*i+r]);const a=n.mg[lt*i+c],u=n.mg[at*i+c],f=a+u,d=Math.min(l,f);if(l<=0)return;const m=this.hvC[r];if(n.mg[Q*i+r]-=l,n.mg[Q*i+c]+=l,n.Hg[r]-=l*m,n.Hg[c]+=l*m,d>0){const p=d*a/f,h=d-p;n.mg[lt*i+c]-=p,n.mg[at*i+c]-=h,n.mg[lt*i+r]+=p,n.mg[at*i+r]+=h;const g=p*this.hnC[c]+h*this.hoC[c];n.Hg[c]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const c=n.mg[lt*i+t]+n.mg[at*i+t],l=Math.min(e,c);if(n.mg[Q*i+t]+=e,n.Hg[t]+=e*xt(r),l>0){const a=l*n.mg[lt*i+t]/c,u=l-a;n.mg[lt*i+t]-=a,n.mg[at*i+t]-=u;const f=a*ue(lt,n.T[t])+u*ue(at,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=l,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*xt(r)}else if(e<0){const c=Math.min(-e,n.mg[Q*i+t]),l=s.ambientY[lt],a=s.ambientY[at],u=l+a>0?l+a:1;n.mg[Q*i+t]-=c,n.Hg[t]-=c*xt(n.T[t]);const f=c*l/u,d=c-f;n.mg[lt*i+t]+=f,n.mg[at*i+t]+=d;const m=f*ue(lt,r)+d*ue(at,r);n.Hg[t]+=m,s.flows.escapedWater+=c,s.flows.escapedAir-=c,s.flows.escapedEnergy+=c*xt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:c}=t,l=s.rhoRef*t.vCell/4;for(let a=0;a<r;a+=1){if(t.solid[a]===0||t.film[a]<l)continue;const u=a%n,f=(a-u)/n,m=[u>0?a-1:-1,u<n-1?a+1:-1,f+1<i?a+n:-1,f>0?a-n:-1].find(_=>_>=0&&c[_]===$);if(m===void 0)continue;const p=m%n,h=(m-p)/n,g=(p+.5+.25*Math.sign(u-p))*t.dx,x=(h+.5+.25*Math.sign(f-h))*t.dx,y=t.T[a],b=e.add(g,x,l,kt(y),dt);b<0||(t.film[a]-=l,t.Es[a]-=l*kt(y),s.placeParticle(b),s.dVp[b]=l/e.rho[b])}}}function Nf(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(oe.length);let r=0,c=0,l=0;for(let a=0;a<e.count;a+=1)for(let u=0;u<9;u+=1){const f=s.wt[9*a+u];if(f===0)continue;const d=s.bi[a]+u%3,m=s.bj[a]+(u/3|0);if(d<0||m<0||d>=n.nx||m>=n.ny||d+m*n.nx!==t)continue;i[e.mat[a]]+=f*e.mass[a],r+=f*e.mass[a];const p=e.smass[2*a];p>0?(c+=f*p,l+=f*(e.mass[a]-p)):e.mat[a]===0&&(l+=f*e.mass[a])}return{m:i,all:r,salt:c,water:l}}function Mh(o,t){const{m:e,all:s}=Nf(o,t);if(s<=0)return[];const n=[];for(let i=0;i<oe.length;i+=1)e[i]>0&&n.push({id:oe[i].id,share:e[i]/s});return n}function Bh(o,t,e){var S;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===pt?"solid":s.kind[n]===rt?"liquid":"gas",c=o.pressureAt(n);let l=0;const a=[0,0,0];for(let T=0;T<Ft;T+=1)a[T]=s.mg[T*i+n]/gt[T],l+=a[T];for(let T=0;T<Ft;T+=1)a[T]=l>0?a[T]/l:0;const u=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?a[Q]*c:0,d=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[d+m*(s.nx+1)]+s.ul[d+1+m*(s.nx+1)]):.5*(s.ug[d+m*(s.nx+1)]+s.ug[d+1+m*(s.nx+1)]),h=r==="liquid"?.5*(s.vl[d+m*s.nx]+s.vl[d+(m+1)*s.nx]):.5*(s.vg[d+m*s.nx]+s.vg[d+(m+1)*s.nx]),g=o.particles;let x=-1,y=(1.5*s.dx)**2;for(let T=0;T<g.count;T+=1){const M=(g.x[T]-t)**2+(g.y[T]-e)**2;M<y&&(y=M,x=T)}const b=o.bubbles;let _=-1,F=1/0;for(let T=0;T<b.count;T+=1){const M=Math.hypot(b.x[T]-t,b.y[T]-e);M<=Math.max(b.r[T],3*s.dx)&&M<F&&(_=T,F=M)}const A=Nf(o,n),P=[];if(A.all>0)for(let T=0;T<oe.length;T+=1)A.m[T]>0&&P.push({id:oe[T].id,share:A.m[T]/A.all});let w=null;if(r==="liquid"&&A.salt>0&&A.water>0){const T=A.salt/(A.water*Be);w={w:A.salt/(A.salt+A.water),molality:T,Tb:bc(c,T),Tf:vc(T)}}const k=r==="gas"?o.gas.rho[n]:r==="liquid"?w!==null&&!o.phase.mixed?Vr(u,w.w):o.phase.mixed?Ds(o.phase.host[n],u):o.liquid.rhoRef:s.solid[n]!==0?ht[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?ht[s.solid[n]-1].id:null,T:u,p:c,Tsat:St(c),x:a,rh:r==="gas"?f/jr(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:k,phi:s.phi[n],u:p,v:h,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:P,salt:w},particle:x<0?null:{id:g.id[x],T:g.T[x],vx:g.vx[x],vy:g.vy[x],mass:g.mass[x],rho:g.rho[x],dist:Math.sqrt(y),liquid:((S=oe[g.mat[x]])==null?void 0:S.id)??oe[0].id,salt:g.saltFraction(x)},bubble:_<0?null:o.bubbleModel.describe(_),body:Ch(o,t,e)}}function Ch(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&Sn(n)?n.id:"",material:ht[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}const Lh=2e-6;class qh{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);v(this,"freeAt",null);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,c=e+1;this.id.fill(-1);let l=0;for(let a=0;a<t.n;a+=1){if(n[a]!==0||this.id[a]!==-1)continue;this.grow(l);let u=0,f=0,d=0,m=!1;for(this.stack[u++]=a,this.id[a]=l;u>0;){const p=this.stack[--u];d+=1-t.fs[p],!m&&t.owner[p]>0&&this.freeAt!==null&&this.freeAt(t.owner[p])&&(m=!0);const h=p%e,g=(p-h)/e,x=h+g*c,y=h+g*e;(h===0&&t.openL&&i[x]>0||h===e-1&&t.openR&&i[x+1]>0||g===0&&t.openB&&r[y]>0||g===s-1&&t.openT&&r[y+e]>0)&&(f=1),h>0&&n[p-1]===0&&this.id[p-1]===-1&&i[x]>0&&(this.id[p-1]=l,this.stack[u++]=p-1),h<e-1&&n[p+1]===0&&this.id[p+1]===-1&&i[x+1]>0&&(this.id[p+1]=l,this.stack[u++]=p+1),g>0&&n[p-e]===0&&this.id[p-e]===-1&&r[y]>0&&(this.id[p-e]=l,this.stack[u++]=p-e),g<s-1&&n[p+e]===0&&this.id[p+e]===-1&&r[y+e]>0&&(this.id[p+e]=l,this.stack[u++]=p+e)}f===0&&m&&d*t.vCell<Lh&&(f=1),this.open[l]=f,this.vFluid[l]=d*t.vCell,l+=1}this.count=l}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let c=0;c<Ft;c+=1){const l=s.mg[c*n+i];this.mSum[r]+=l,this.nSum[r]+=l/gt[c]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let l=0;l<s;l+=1){if(this.id[l]!==t||e.kind[l]===pt)continue;let a=0;for(let u=0;u<Ft;u+=1)a+=e.mg[u*s+l]/gt[u];n+=a*Ut*e.T[l]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const c=this.rhoBar[t]*this.gy;if(c===0)return r;for(let l=0;l<2;l+=1){let a=-i,u=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===pt)continue;let d=0;for(let h=0;h<Ft;h+=1)d+=e.mg[h*s+f]/gt[h];const m=r-c*(e.dx*((f-f%e.nx)/e.nx+.5)),p=d*Ut*e.T[f];a+=p/m,u-=p/(m*m)}r-=a/u}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===$)return s;return-1}}class Oh{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:c,ny:l}=r,a=Math.min(c-1,Math.max(0,Math.floor(t/r.dx))),u=Math.min(l-1,Math.max(0,Math.floor(e/r.dx))),f=a+u*c,d=i.heat;if(d.hasSolid(f)){this.toSolid(f,s,n);return}const m=[u>0?f-c:-1,a>0?f-1:-1,a<c-1?f+1:-1,u<l-1?f+c:-1];for(const p of m)if(p>=0&&d.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=u-2;p>=0;p-=1){const h=a+p*c;if(d.hasSolid(h)){this.toSolid(h,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[a]+=s,this.floorH[a]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],c=cf(r);if(n<=c*i*(1+1e-9))continue;const l=(n-c*i)/(1-c),a=l*Mi(r),u=i/t.rho[s],f=i*t.h[s]-a;t.mass[s]=i-l,t.smass[2*s]=n-l,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-u,this.e.grainSalt.grow(t.x[s],t.y[s],l,a)||this.deposit(t.x[s],t.y[s],l,a),this.crystallized+=l}}}const Eh=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],qs=Eh.length,Ll=1/120;class Rh{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"grains");v(this,"grainFlow");v(this,"grainSalt");v(this,"exchange");v(this,"bodies");v(this,"melt");v(this,"solver");v(this,"extremes",new Md(this));v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",Ll);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(ut));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",pl());v(this,"snap",Od());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(qs));v(this,"stamp",new Float64Array(qs+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);v(this,"building",!1);this.options=e;const s=ql(t)?t:sr(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Ll}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=ru[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>cu;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new uh(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new Ph(Math.max(4096,4*i.n+1024)),this.bubbles=new gd(4096),this.solver=new qt(s,n),this.regions=new qh(i),this.liquid=new Fh(i,this.particles,this.solver),this.gas=new Jd(i,this.regions,this.solver),this.heat=new hh(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new Sd(this),this.phase=new Th(this),this.salt=new Oh(this),this.grains=new nu(Math.max(1024,4*i.n)),this.grainFlow=new ch(this),this.grainSalt=new fh(this),this.exchange=new zd(this),this.bodies=new rd(this),this.regions.freeAt=r=>{const c=this.bodies.list[r-1];return c!==void 0&&c.free},this.heat.bodies=this.bodies.list,this.heat.grains=this.grains,this.melt=new bd(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,c,l,a,u)=>this.bodies.hitPoint(r,c,l,a,u),this.liquid.afterSolve=(r,c,l,a)=>this.bodies.probe(r,c,l,a),this.prevKind=new Uint8Array(i.n),this.rng=new Bf(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=pl(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=$,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),this.grainFlow.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const c=i+r>0?i+r:1,l=(i>0?i:T0)/c,a=(r>0||i>0?r:M0)/c,u=1/(l/gt[lt]+a/gt[at]),f=Math.min(.99,s*jr(e)/t),d=f*gt[Q]/(f*gt[Q]+(1-f)*u);this.ambientY.fill(0),this.ambientY[lt]=(1-d)*l,this.ambientY[at]=(1-d)*a,this.ambientY[Q]=d;let m=0;for(let p=0;p<Ft;p+=1)m+=this.ambientY[p]/gt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(Ut*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,grains:this.grains,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>hi(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=Sn(t)&&(t.id===""||hi(this,t.id)>=0)?{...t,id:uf(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!Yd(this,e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=jd(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const c=this.heaterOps.get(t),l=c===void 0?void 0:this.scene.ops[c];if(c!==void 0&&l!==void 0&&l.op==="hotplate"){const a=[...this.scene.ops];a[c]={...l,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:a}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),c=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:c}},this.setAmbientState(t,e,s,r,c.N2,c.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return df({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=ql(t)?t:sr(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=sr(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:c}=this,l=this.dt,a=this.stamp;a[0]=Oe();const u=n.pvTerm();this.bodies.prepare()&&(n.update(r,c),this.flows.bodyWork+=n.pvTerm()-u),a[1]=Oe(),this.grainFlow.splatVolume(),e.splatVolumeChange(l),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,c),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let h=0;h<n.count;h+=1)this.p0Start[h]=n.p0[h];for(let h=0;h<t.n;h+=1)e.pGas[h]=t.kind[h]===$?n.pAt(h)-this.pRef:0;e.step(l,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,this.grainFlow.step(l),a[2]=Oe(),s.updateVolumes(),s.markFaces();const f=s.escaped[Q]+s.escaped[Ft],d=s.escaped[lt]+s.escaped[at],m=s.escaped[Ft+1];s.transport(l),this.flows.escapedWater+=s.escaped[Q]+s.escaped[Ft]-f,this.flows.escapedAir+=s.escaped[lt]+s.escaped[at]-d,this.flows.escapedEnergy+=s.escaped[Ft+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(l,this.gy),s.sources(l),s.project(l,this.tol,this.maxIter),a[3]=Oe(),this.bubbleModel.step(l),a[4]=Oe(),this.phase.step(l),this.salt.step(),this.grainSalt.step(l),a[5]=Oe(),i.step(l,1e-6,200),this.exchange.step(l),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,a[6]=Oe(),a[7]=Oe(),n.update(r,c),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let h=0;h<t.n;h+=1)s.srcV[h]=t.kind[h]===$?s.veos[h]-s.veosMid[h]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=l,this.steps+=1,a[8]=Oe(),this.bodies.finish(l),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit(),this.grainFlow.dtLimit()),a[9]=Oe();const p=this.steps<5?1:1/30;for(let h=0;h<qs;h+=1)this.timings[h]+=p*(a[h+1]-a[h]-this.timings[h]);this.stepMs+=p*(a[qs]-a[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let c=!1;for(let l=0;l<e.count;l+=1)i.dp0[l]!==0&&(c=!0);if(c){for(let l=0;l<s.count;l+=1){const a=t.cellAt(s.x[l],s.y[l]),u=a<0?-1:e.id[a];if(u<0||i.dp0[u]===0)continue;const f=s.mass[l],d=f/s.rho[l];s.h[l]+=d*i.dp0[u]/f,s.derive(l),r.dVp[l]+=f/s.rho[l]-d}for(let l=0;l<n.count;l+=1){const a=t.cellAt(n.x[l],n.y[l]),u=a<0?-1:e.id[a];u>=0&&i.dp0[u]!==0&&(n.H[l]+=n.V[l]*i.dp0[u])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,qd(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals(),this.grains.totals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){let t=0,e=!1;for(const s of this.bodies.list)s.free&&(t+=1),!s.gone&&s.nr>1&&me(s.mat)>0&&(e=!0);return t>8||e||this.grains.count>0}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}rebaseline(t){const e=this.measureBudget(),s=this.flows;this.energy0=e.energy-(s.heater-s.lossWalls-s.lossOpen-s.escapedEnergy+s.editEnergy+s.bodyWork)-t.energy,this.water0=e.water.total-s.editWater-t.water,this.other0=e.other.total-s.editOther-t.other,this.salt0=e.salt.total-s.editSalt-t.salt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===dt&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==dt&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===rt?this.pRef+e.pl[t]:e.kind[t]===$?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return Bh(this,t,e)}liquidsAt(t){return Mh(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let h=0;h<t.n;h+=1)t.kind[h]===rt?e+=1:t.kind[h]===$&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),c=this.flows,l=r.energy-this.energy0-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),a=r.water.total-this.water0-c.editWater,u=r.other.total-this.other0-c.editOther,f=r.salt.total-this.salt0-c.editSalt,d=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(d-this.phase.producedMark)/m,this.phase.producedMark=d,this.vapourLast=this.time);const p=[];for(let h=0;h<this.regions.count;h+=1)p.push({p0:this.regions.p0[h],sealed:this.regions.open[h]===0,vGas:this.regions.vGas[h]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor+r.salt.grains,bodies:{count:this.bodies.list.filter(h=>!h.gone).length,free:this.bodies.list.filter(h=>h.free).length,awake:this.bodies.list.filter(h=>h.awake).length},heaters:this.heat.heaters.filter(h=>h.cells>0).map(h=>({group:h.group,P:h.P,Tmean:h.Tmean,mode:h.mode,power:h.power,target:h.target,on:h.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...c},energyError:l,waterError:a,otherError:u,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats(),cpuOnly:this.needsCpu()}}}const Oe=()=>typeof performance<"u"?performance.now():Date.now();function ql(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}const Y={X:0,Y:1,A:2,VX:3,VY:4,W:5,UX:6,UY:7,UW:8,M:9,I:10,RMAX:11,HULLA:12,HULLJ:13,PINNED:14,ASLEEP:15,GONE:16,REST:17,RX:18,RY:19,RA:20,PREV:21,PRED:24,PNOW:27,POLD:30,VPRE:33,MA6:36,MAOK:42,MA:43,IA:44,MAT:45,HEATER:46,NR:47,RO:48,NCELL:49,KO:50,NSEG:51,SO:52,BX0:53,BY0:54,BX1:55,BY1:56,OX0:57,OY0:58,OX1:59,OY1:60,FX:61,FY:62,TQ:63,TOUCH:64,BAND:65,AGAIN:66,COS:67,SIN:68,PROBE:69,KEY:70,VOL:71,E0:72,MA9:73,HIT:82,WAKE:83,PUSH:84,MELT:85},Bs=88,As={SEGS:0,PARTS:1,NPARTS:2,NRECT:3,NCELL:4,NBODY:5},Ss=8,Kn={X0:0,Y0:1,X1:2,Y1:3,NI:4,NJ:5,XO:6,YO:7,KO:8,BODY:9},dn=12,Ih={RECT:0,SIDE:1,T0:2,T1:3,BODY:4},jf=8,Nh={X0:0,Y0:1,X1:2,Y1:3,ID:4,FRIC:5,BOUNCE:6},$o=8,ke=4,Mt={X:0,Y:1,A:2,VX:3,VY:4,W:5,STATE:6,M:7,T:8,E:9,FILM:10,CRUST:11,FX:12,FY:13,TQ:14,MAOK:15,PM:16,PH:17,PS:18,RX0:19,RY0:20,RX1:21,RY1:22},vn=24,jh=.99,Dh=.9,Gh=.88,Uh=.5,Vh=1e-5,Zs=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),Lc=[Zs("B_",Y),Zs("GH_",As),Zs("GR_",Kn),Zs("GS_",Ih),Zs("GP_",Nh),Zs("BRD_",Mt),`const BS: u32 = ${Bs}u;`,`const GEO_RECTS: u32 = ${Ss}u;`,`const RS: u32 = ${dn}u;`,`const SS: u32 = ${jf}u;`,`const PS: u32 = ${$o}u;`,`const BC: u32 = ${ke}u;`,`const BR: u32 = ${vn}u;`,`const CLOSED_P: f32 = ${jh};`,`const CLOSED_F: f32 = ${Dh};`,`const REOPEN_F: f32 = ${Gh};`,`const SQUEEZE_B: f32 = ${Uh};`,`const COVERED_EPS: f32 = ${Vh};`].join(`
`),he=`${Lc}
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
`,Ht=`${he}
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
`,Je=`
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
`,ir=`
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
`,Hh=`
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
`,Fr=`
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
`,hn={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},xn=16,V={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72,REL_MASS:73,REL_N:74,REL_MISS:75,EVAP_CAP:76,BODYWORK:77,IT_P:78,CAP_P:79,RES_P:80,PARKED:81,CONT_FULL:82,BVMAX:83,MELTED:84,FROZEN:85,MELTFULL:86},Os=96,Ol=16,$h=57,Pt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Se=16,Wh={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Wo=8,Yt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},Te=8,Kh={TSUM:0,CELLS:1},Ko=2,zh={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Df=16,tt={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69,FS:70,CAPB:71,TSB:72,ESY:73,FSY:74,KSY:75,WSUM:76,HW:77,COVL:78,COVB:79,KS:80,KF:81,DSF:82,GF:83,GK:84,PE0:85,RE0:86,KN0:87,PE1:88,RE1:89,KN1:90,MC:91,MCT:92,MW:93,MS:94,MWM:95,MFZ:96,MHI:97},ao=98,Dt={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5,OWNER:6,MATB:7,PAINT:8,SPLIT:9,NOW1:10,NOW2:11,KNEW:12,BAND:13,HBODY:14},fo=15,zo={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16,MGM:17,MGH:18,MGS:19,MCLAIM:20,MSEEN:21},uo=22,ze={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},ho=20,Yh={KNOWN:0,MARK:1,MARK2:2,GAS:3},El=4,Xh={F:0},mo=1,Qh={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},Yo=12,se=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),Zh=[se("G_",hn),se("C_",V),se("R_",Pt),se("RA_",Wh),se("H_",Yt),se("HA_",Kh),se("S_",zh),se("F_",tt),se("U_",Dt),se("A_",zo),se("FF_",ze),se("FU_",Yh),se("AF_",Xh),se("BA_",Qh),`const RACC_STRIDE: u32 = ${Wo}u;`,`const HEAT_STRIDE: u32 = ${Te}u;`,`const HACC_STRIDE: u32 = ${Ko}u;`,`const CGS_STRIDE: u32 = ${Df}u;`,`const BACC_STRIDE: u32 = ${Yo}u;`].join(`
`);function K(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Kt=o=>o.map(K).join(", "),Gt=Ct.species[0],Ki=Ct.species[1],zi=Ct.species[2],Es=Gt.liquid.cp.table,Qe=Es.map(o=>o[0]),Ns=Es.map(o=>o[1]),Pr=[Ns[0]*(Qe[0]-et)];for(let o=1;o<Es.length;o+=1)Pr.push(Pr[o-1]+.5*(Ns[o]+Ns[o-1])*(Qe[o]-Qe[o-1]));const[Jh,t1,e1]=Gt.vapour.cp.linear,Xo=et+100,s1=(()=>{let o=0;for(;o<Qe.length-2&&Xo>=Qe[o+1];)o+=1;const t=Xo-Qe[o],e=(Ns[o+1]-Ns[o])/(Qe[o+1]-Qe[o]);return Pr[o]+Ns[o]*t+.5*e*t*t})(),n1=s1+Gt.saturation.hlv100.v,Ve=Ct.solids,Gf=Ct.species.slice(3).map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{cA:e,cB:s,h0:e*et+.5*s*et*et,rA:t.rho.linear[0],rB:t.rho.linear[1],kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v}}),Uf=1+Gf.length,_e=o=>`array<f32, ${Uf}>(${Kt([0,...Gf.map(o)])})`,po=4294967295,i1=`
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
}`,Rl=52,r1=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,Js=27,o1=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,tn=29,c1=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,bo=8,l1=`
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
const T0: f32 = ${K(et)};
const R_GAS: f32 = ${K(Ut)};
const P_ATM: f32 = ${K(ei)};
const G0: f32 = ${K(Nr)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${K(Ki.molarMass.v)};
const M_O2: f32 = ${K(zi.molarMass.v)};
const M_H2O: f32 = ${K(Gt.molarMass.v)};
const CP_N2: f32 = ${K(Ki.gas.cp.v)};
const CP_O2: f32 = ${K(zi.gas.cp.v)};
const CPV0: f32 = ${K(Jh)};
const CPV1: f32 = ${K(t1)};
const CPV_T: f32 = ${K(e1)};
const T100: f32 = ${K(Xo)};
const HV100: f32 = ${K(n1)};
const NCP: i32 = ${Es.length};
const CP_T = array<f32, ${Es.length}>(${Kt(Qe)});
const CP_V = array<f32, ${Es.length}>(${Kt(Ns)});
const CP_H = array<f32, ${Es.length}>(${Kt(Pr)});
const KELL = array<f32, 7>(${Kt(Gt.liquid.kell.c)});
const KL = array<f32, 3>(${Kt(Gt.liquid.k.poly)});
const VA: f32 = ${K(Gt.liquid.mu.vogel[0])};
const VB: f32 = ${K(Gt.liquid.mu.vogel[1])};
const VC: f32 = ${K(Gt.liquid.mu.vogel[2])};
const ST_B: f32 = ${K(Gt.surfaceTension.B)};
const ST_b: f32 = ${K(Gt.surfaceTension.b)};
const ST_MU: f32 = ${K(Gt.surfaceTension.mu)};
const T_CRIT: f32 = ${K(Gt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${K(Gt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Kt(Gt.saturation.if97.n)});
const RVC = array<f32, 6>(${Kt(Gt.saturation.vapourDensity.c)});
const KV: f32 = ${K(Gt.vapour.k.v)};
const MUV: f32 = ${K(Gt.vapour.mu.v)};
const KN = array<f32, 3>(${Kt(Ki.gas.k.power)});
const KO = array<f32, 3>(${Kt(zi.gas.k.power)});
const MN = array<f32, 3>(${Kt(Ki.gas.mu.sutherland)});
const MO = array<f32, 3>(${Kt(zi.gas.mu.sutherland)});
const DV0: f32 = ${K(Ct.vapourInAir.D0.v)};
const DVT0: f32 = ${K(Ct.vapourInAir.T0.v)};
const DVE: f32 = ${K(Ct.vapourInAir.exponent.v)};
const NSOL: u32 = ${Ve.length}u;
const S_RHO = array<f32, ${Ve.length}>(${Kt(Ve.map(o=>o.rho.v))});
const S_CP = array<f32, ${Ve.length}>(${Kt(Ve.map(o=>o.cp.v))});
const S_K = array<f32, ${Ve.length}>(${Kt(Ve.map(o=>o.k.v))});
const S_THETA = array<f32, ${Ve.length}>(${Kt(Ve.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${K(Mf)};
const REG_STRIDE: u32 = ${Se}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${K(Da)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${K(gs)};
const NLIQ: u32 = ${Uf}u;
const L_CA = ${_e(o=>o.cA)};
const L_CB = ${_e(o=>o.cB)};
const L_H0 = ${_e(o=>o.h0)};
const L_RA = ${_e(o=>o.rA)};
const L_RB = ${_e(o=>o.rB)};
const L_KA = ${_e(o=>o.kA)};
const L_KB = ${_e(o=>o.kB)};
const L_MA = ${_e(o=>o.mA)};
const L_MB = ${_e(o=>o.mB)};
const L_MC = ${_e(o=>o.mC)};
const L_SIG = ${_e(o=>o.sigma)};
`,f1=`
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
`,u1=`
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
`,qc=[i1,r1,o1,c1,l1,a1,Zh,f1,u1].join(`
`),ge=4,ve=32,Ie={PEND:0,CAPC:28,CAPX:29,CAPY:30},kr=7,Qn=256,Vf=qo/((1-qo)*Be),d1=Array.from({length:Qn+1},(o,t)=>t===Qn?of:vc(Vf*t/Qn)),Qo=`
const THIN_M: f32 = ${K(Sf)};
const THICK_M: f32 = ${K(Tf)};
const GONE_M: f32 = ${K(Wn)};
const FREEZE_M: f32 = ${K(Do)};
const SPLIT_M: f32 = ${K(Pf)};
const SPAWN_M: f32 = ${K(kf)};
const SPAWN_N: u32 = ${Af}u;
const T_MELT_M: f32 = ${K(ne)};
const M_S_M: f32 = ${K(Be)};
const MLT_HEAD: u32 = ${ge}u;
const MLT_BODY: u32 = ${ve}u;
const MLT_PEND: u32 = ${Ie.PEND}u;
const MLT_CAPC: u32 = ${Ie.CAPC}u;
const MLT_CAPX: u32 = ${Ie.CAPX}u;
const MLT_CAPY: u32 = ${Ie.CAPY}u;
const PEND_W: u32 = ${kr}u;
const TF_N: u32 = ${Qn}u;
const TF_MMAX: f32 = ${K(Vf)};
const TF_TAB = array<f32, ${Qn+1}>(${d1.map(K).join(", ")});
/* Der Gefrierpunkt der Flüssigkeit vor einer Seite aus Salz und Wasser ihrer Zellen (meltSides.freezingAt): ohne beides der des reinen Wassers. */
fn tfOf(salt: f32, water: f32) -> f32 {
  if (!(water > 0.0) || !(salt > 0.0)) { return T_MELT_M; }
  let x = salt / (water * M_S_M) / TF_MMAX * f32(TF_N);
  if (x >= f32(TF_N)) { return TF_TAB[TF_N]; }
  let i = u32(floor(x));
  return TF_TAB[i] + (x - f32(i)) * (TF_TAB[i + 1u] - TF_TAB[i]);
}
/* Energie eines Feststoffanteils bei T und seine Temperatur aus der Energie (body.ts solidEnergy, solidTemperature). */
fn solidEnergyM(C: f32, film: f32, crust: f32, T: f32) -> f32 { return (C + crust * CP_CRYSTAL) * (T - T0) + film * hL(T); }
fn cellTM(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn mo(b: u32) -> u32 { return MLT_HEAD + b * MLT_BODY; }
`,Zo=`
/* Die Seite s eines Rechtecks im eigenen Rahmen (Body2D.segment): Anfang, Ende, Normale nach aussen, Länge, Punkte je ½ Δx (meltSides.along). */
struct Side { a: vec2<f32>, e: vec2<f32>, n: vec2<f32>, len: f32, np: u32 }
fn sideOf(rq: u32, s: u32) -> Side {
  let bx = rBox(rq);
  var d: Side;
  if (s == 0u) { d.a = bx.xy; d.e = vec2<f32>(bx.x, bx.w); d.n = vec2<f32>(-1.0, 0.0); }
  else if (s == 1u) { d.a = vec2<f32>(bx.z, bx.y); d.e = bx.zw; d.n = vec2<f32>(1.0, 0.0); }
  else if (s == 2u) { d.a = bx.xy; d.e = vec2<f32>(bx.z, bx.y); d.n = vec2<f32>(0.0, -1.0); }
  else { d.a = vec2<f32>(bx.x, bx.w); d.e = bx.zw; d.n = vec2<f32>(0.0, 1.0); }
  d.len = distance(d.a, d.e);
  /* ceil(len / ½Δx) wie die CPU; das Rauschen von f32 (eine Seite von genau 20 halben Zellen als 20,000002) zählt nicht. */
  d.np = max(1u, u32(ceil(d.len / (0.5 * P.dx) - 1e-4)));
  return d;
}
/* Ein Punkt des eigenen Rahmens in der Welt bei der jetzigen Lage. */
fn toWorldB(b: u32, l: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(bv(b, B_X) + c * l.x - s * l.y, bv(b, B_Y) + s * l.x + c * l.y);
}
fn rotB(b: u32, v: vec2<f32>) -> vec2<f32> {
  let c = bv(b, B_COS);
  let s = bv(b, B_SIN);
  return vec2<f32>(c * v.x - s * v.y, s * v.x + c * v.y);
}
/* Die t-te Randzelle der Seite s (meltSides.edgeCells): innere Zelle, Länge längs der Seite, Volumen. */
struct Edge { k: u32, len: f32, vol: f32 }
fn alongOf(rq: u32, s: u32) -> u32 { return select(u32(rv(rq, GR_NI)), u32(rv(rq, GR_NJ)), s < 2u); }
fn edgeCell(rq: u32, s: u32, t: u32) -> Edge {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  var p = t;
  var q = t;
  if (s == 0u) { p = 0u; } else if (s == 1u) { p = ni - 1u; }
  if (s == 2u) { q = 0u; } else if (s == 3u) { q = nj - 1u; }
  let w = rxs(rq, p + 1u) - rxs(rq, p);
  let h = rys(rq, q + 1u) - rys(rq, q);
  return Edge(u32(rv(rq, GR_KO)) + p + q * ni, select(w, h, s < 2u), w * h * P.depth);
}
/* Führt die Strecke a→e durch das Innere eines anderen Körpers als me (Bodies.blocks; Ränder zählen nicht)? */
fn blocksB(me: u32, a: vec2<f32>, e: vec2<f32>) -> bool {
  let eps = 1e-6 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (b == me || bGone(b)) { continue; }
    if (max(a.x, e.x) < bv(b, B_BX0) - P.dx || min(a.x, e.x) > bv(b, B_BX1) + P.dx || max(a.y, e.y) < bv(b, B_BY0) - P.dx || min(a.y, e.y) > bv(b, B_BY1) + P.dx) { continue; }
    let l0 = toLocalB(b, a);
    let l1 = toLocalB(b, e);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      let x0 = bx.x + eps; let y0 = bx.y + eps; let x1 = bx.z - eps; let y1 = bx.w - eps;
      if (x1 > x0 && y1 > y0 && clipSeg(l0, l1, x0, y0, x1, y1) > 0.0) { return true; }
    }
  }
  return false;
}
/* Liegt der Punkt in einem Körper (Bodies.bodyAt ohne Rand)? Die Umgrenzung vom Anfang des Schritts mit einer Zelle Rand (er wuchs vielleicht). */
fn bodyAtB(w: vec2<f32>) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    if (w.x < bv(b, B_BX0) - P.dx || w.x > bv(b, B_BX1) + P.dx || w.y < bv(b, B_BY0) - P.dx || w.y > bv(b, B_BY1) + P.dx) { continue; }
    let l = toLocalB(b, w);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      if (l.x >= bx.x && l.x <= bx.z && l.y >= bx.y && l.y <= bx.w) { return true; }
    }
  }
  return false;
}
`,h1=`
/*
 * Wie weit vor dem Punkt w (Normale nw) „knapp davor“ liegt (meltSides.frontGap): ein Zwanzigstel Δx, es sei denn, dort ist eine Zelle,
 * die dieser Körper selbst schloss, weil er sie fast ganz bedeckt — dann knapp hinter ihr. „Fast ganz“: ab closed (angeheftet 0,99; frei
 * 0,88 — auf der GPU bleibt eine Zelle eines freien Körpers bis unter 0,88 zu, kbodylib.REOPEN_FREE_GPU).
 */
fn frontGapM(own: u32, closed: f32, w: vec2<f32>, nw: vec2<f32>) -> f32 {
  let eps = 0.05 * P.dx;
  let c = cellAtN(w.x + eps * nw.x, w.y + eps * nw.y);
  if (c == NONE || cu[U_SOLID * P.n + c] == 0u || cu[U_OWNER * P.n + c] != own || cf[F_FS * P.n + c] < closed) { return eps; }
  let i = f32(ci(c));
  let j = f32(cj(c));
  var t = 1e30;
  if (nw.x > 1e-9) { t = min(t, ((i + 1.0) * P.dx - w.x) / nw.x); } else if (nw.x < -1e-9) { t = min(t, (i * P.dx - w.x) / nw.x); }
  if (nw.y > 1e-9) { t = min(t, ((j + 1.0) * P.dx - w.y) / nw.y); } else if (nw.y < -1e-9) { t = min(t, (j * P.dx - w.y) / nw.y); }
  return select(eps, max(eps, t + eps), t < 1e29);
}
/* Ein Punkt q der Seite sd: Weltort, Normale, Länge, die Zelle knapp davor (fluid: kein Feststoff), eine Zelle weiter, knapp innen. */
struct FP { w: vec2<f32>, nw: vec2<f32>, fw: vec2<f32>, len: f32, out: u32, far: u32, inn: u32, fluid: bool }
fn frontPoint(b: u32, sd: Side, q: u32, closed: f32) -> FP {
  var p: FP;
  let t = (f32(q) + 0.5) / f32(sd.np);
  p.w = toWorldB(b, sd.a + t * (sd.e - sd.a));
  p.nw = rotB(b, sd.n);
  p.len = sd.len / f32(sd.np);
  let d = frontGapM(b + 1u, closed, p.w, p.nw);
  let o = p.w + d * p.nw;
  p.out = cellAtN(o.x, o.y);
  p.fluid = p.out != NONE && cu[U_SOLID * P.n + p.out] == 0u;
  p.fw = p.w + (P.dx + d) * p.nw;
  p.far = cellAtN(p.fw.x, p.fw.y);
  let e = p.w - 0.05 * P.dx * p.nw;
  p.inn = cellAtN(e.x, e.y);
  return p;
}
/* Die Zelle eine weiter / knapp innen zählt (fluidFront, ohne die Wiederholung gleich daneben): */
fn farOk(b: u32, p: FP) -> bool {
  return p.fluid && p.far != NONE && p.far != p.out && cu[U_SOLID * P.n + p.far] == 0u && !blocksB(b, p.w, p.fw);
}
fn innOk(p: FP) -> bool {
  return p.fluid && p.inn != NONE && p.inn != p.out && cu[U_SOLID * P.n + p.inn] == 0u && cu[U_KIND * P.n + p.inn] == LIQUID;
}
`,Il=128,Nl="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",jl=`
fn addParticle(x: vec2<f32>, v: vec2<f32>, m: f32, h: f32, salt: f32, src: bool) -> bool {
  let p = atomicAdd(&cnt[C_PCOUNT], 1u);
  if (p >= P.pcap) { atomicSub(&cnt[C_PCOUNT], 1u); atomicAdd(&cnt[C_PFULL], 1u); return false; }
  var q: Particle;
  q.x = x.x; q.y = x.y; q.vx = v.x; q.vy = v.y; q.c00 = 0.0; q.c01 = 0.0; q.c10 = 0.0; q.c11 = 0.0;
  q.mass = m; q.h = h; q.s = max(0.0, salt); q.T = tFromHL(h); q.flags = 0u;
  pDerive(&q);
  q.dvp = select(0.0, m / q.rho, src);
  q.id = atomicAdd(&cnt[C_NEXTID_P], 1u);
  q.bi = i32(floor(x.x * P.invdx - 1.0));
  q.bj = i32(floor(x.y * P.invdx - 1.0));
  for (var k = 0; k < 9; k++) { q.wt[k] = 0.0; }
  q.wt[4] = 1.0;
  parts[p] = q;
  return true;
}
`,m1=[{name:"mSums",wg:Il,bind:"P:u bod:r cf:w at:a parts:r ccount:r cstart:r bsum:r",code:`${he}
fn inMeltBand(i: i32, j: i32) -> bool {
  let x0 = f32(i) * P.dx;
  let y0 = f32(j) * P.dx;
  let m = 3.0 * P.dx;
  for (var b = 0u; b < P.nbody; b++) {
    if (bv(b, B_MELT) == 0.0 || bGone(b)) { continue; }
    if (bv(b, B_BX0) - m > x0 + P.dx || bv(b, B_BX1) + m < x0 || bv(b, B_BY0) - m > y0 + P.dx || bv(b, B_BY1) + m < y0) { continue; }
    return true;
  }
  return false;
}
${Nl} {
  let c = gid.x;
  let n = P.n;
  if (c >= n) { return; }
  atomicStore(&at[A_MGM * n + c], 0u);
  atomicStore(&at[A_MGH * n + c], 0u);
  atomicStore(&at[A_MGS * n + c], 0u);
  atomicStore(&at[A_MCLAIM * n + c], 0u);
  atomicStore(&at[A_MSEEN * n + c], 0u);
  cf[F_MFZ * n + c] = 0.0;
  if (!inMeltBand(ci(c), cj(c))) { return; }
  var C = 0.0; var CT = 0.0; var W = 0.0; var S = 0.0; var WM = 0.0;
  let st = cellStart(c);
  let cn = ccount[c];
  for (var k = 0u; k < cn; k++) {
    let pk = st + k;
    let m = parts[pk].mass;
    if ((parts[pk].flags & 1u) != 0u || !(m > 0.0)) { continue; }
    let s = parts[pk].s;
    let T = parts[pk].T;
    let mt = matOf(parts[pk].flags);
    let Cp = m * pCp(mt, T, s, m);
    C += Cp;
    CT += Cp * T;
    if (mt == 0u) { W += m - s; S += s; WM += m; }
  }
  cf[F_MC * n + c] = C;
  cf[F_MCT * n + c] = CT;
  cf[F_MW * n + c] = W;
  cf[F_MS * n + c] = S;
  cf[F_MWM * n + c] = WM;
}`},{name:"mApply",wg:Il,bind:"P:u glob:r cnt:a cf:r cu:r at:a bod:r bgeo:r parts:w",code:`${Ht}
${Je}
${Qo}
${Zo}
${jl}
${Nl} {
  let count = cntWG(lid3.x, C_PSORT);
  let p = gid.x;
  if (p >= count) { return; }
  var q = parts[p];
  if ((q.flags & 1u) != 0u || !(q.mass > 0.0) || matOf(q.flags) != 0u) { return; }
  let n = P.n;
  let c = cellAt(q.x, q.y);
  let gm = getF_at(A_MGM * n + c);
  let want = cf[F_MFZ * n + c];
  if (!(gm > 0.0) && !(want > 0.0)) { return; }
  let w0 = q.mass - q.s;
  let m0 = q.mass;
  if (gm > 0.0) {
    let WM = cf[F_MWM * n + c];
    if (WM > 0.0) {
      let share = m0 / WM;
      let before = q.mass / q.rho;
      let H = q.mass * q.h + share * getF_at(A_MGH * n + c);
      q.mass += share * gm;
      let gs = getF_at(A_MGS * n + c);
      if (gs > 0.0) { q.s += share * gs; }
      q.h = H / q.mass;
      pDerive(&q);
      q.dvp += q.mass / q.rho - before;
    }
  }
  if (want > 0.0) {
    let W = cf[F_MW * n + c];
    if (W > 0.0 && w0 > 0.0) {
      let dm = want * w0 / W;
      let before = q.mass / q.rho;
      let H = q.mass * q.h - dm * cf[F_MHI * n + c];
      q.mass -= dm;
      q.h = H / q.mass;
      pDerive(&q);
      q.dvp += q.mass / q.rho - before;
    }
  }
  /* Zu schwer: in zwei gleiche (meltWater.split; das neue nicht in einem Bau oder Körper). */
  let nominal = glob[G_RHOREF] * P.vcell / 4.0;
  if (q.mass > SPLIT_M * nominal) {
    let side = select(-1.0, 1.0, q.id % 2u == 0u);
    var at2 = -1.0;
    for (var k = 0u; k < 2u; k++) {
      let sg = select(-side, side, k == 0u);
      let cx = clamp(q.x + 0.25 * P.dx * sg, 1e-6, P.boxw - 1e-6);
      let c2 = cellAtN(cx, q.y);
      if (c2 != NONE && cu[U_SOLID * n + c2] == 0u && !bodyAtB(vec2<f32>(cx, q.y))) { at2 = cx; break; }
    }
    if (at2 >= 0.0) {
      let half = 0.5 * q.mass;
      let hs = 0.5 * q.s;
      if (addParticle(vec2<f32>(at2, q.y), vec2<f32>(q.vx, q.vy), half, q.h, hs, false)) {
        q.mass = half;
        q.s = hs;
        pDerive(&q);
      }
    }
  }
  parts[p] = q;
}`},{name:"mSpawn",wg:64,bind:"P:u glob:r cnt:a bod:r bgeo:r bmelt:w cu:r parts:w",code:`${Ht}
${Je}
${Qo}
${Zo}
${jl}
fn fluidAtM(w: vec2<f32>) -> bool {
  if (!(w.x > 0.0 && w.y > 0.0 && w.x < P.boxw && w.y < P.boxh)) { return false; }
  let c = cellAtN(w.x, w.y);
  return c != NONE && cu[U_SOLID * P.n + c] == 0u && !bodyAtB(w);
}
struct Spot { ok: bool, p: vec2<f32> }
fn freeSpotM(me: u32, o: vec2<f32>, x: vec2<f32>) -> Spot {
  if (fluidAtM(x) && !blocksB(me, o, x)) { return Spot(true, x); }
  for (var ring = 1; ring <= 3; ring++) {
    for (var j = ring; j >= -ring; j--) {
      for (var i = -ring; i <= ring; i++) {
        if (max(abs(i), abs(j)) != ring) { continue; }
        let p = x + vec2<f32>(f32(i), f32(j)) * P.dx;
        if (fluidAtM(p) && !blocksB(me, o, p)) { return Spot(true, p); }
      }
    }
  }
  return Spot(false, x);
}
fn outlineSpotM(me: u32, x: vec2<f32>) -> Spot {
  var best = Spot(false, x);
  var bd = 1e30;
  let rq = rectOf(me, 0u);
  for (var s = 0u; s < 4u; s++) {
    let sd = sideOf(rq, s);
    for (var q = 0u; q < sd.np; q++) {
      let sl = sd.a + (f32(q) + 0.5) / f32(sd.np) * (sd.e - sd.a);
      let w = toWorldB(me, sl + 0.3 * P.dx * sd.n);
      let d = dot(w - x, w - x);
      if (d < bd && fluidAtM(w) && !blocksB(me, toWorldB(me, sl), w)) { bd = d; best = Spot(true, w); }
    }
  }
  return best;
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let b = gid.x / 4u;
  let s = gid.x % 4u;
  if (b >= P.nbody) { return; }
  let o = mo(b) + MLT_PEND + s * PEND_W;
  var pm = bmelt[o];
  if (!(pm > 0.0)) { return; }
  var pH = bmelt[o + 1u];
  var ps = bmelt[o + 2u];
  let px = vec2<f32>(bmelt[o + 3u], bmelt[o + 4u]);
  let pn = vec2<f32>(bmelt[o + 5u], bmelt[o + 6u]);
  let gone = bGone(b);
  let nominal = glob[G_RHOREF] * P.vcell / 4.0;
  let v = select(vec2<f32>(bv(b, B_VX), bv(b, B_VY)), vec2<f32>(0.0), gone);
  for (var k = 0u; k < SPAWN_N; k++) {
    if (!(pm > 0.0) || (pm < SPAWN_M * nominal && !gone)) { break; }
    let t = select(-1.0, 1.0, k % 2u == 0u) * ceil(f32(k) / 2.0) * 0.3 * P.dx;
    let x = px + 0.3 * P.dx * pn + t * vec2<f32>(-pn.y, pn.x);
    var at = freeSpotM(b, px, x);
    if (!at.ok && !gone) { at = outlineSpotM(b, x); }
    if (!at.ok) { break; }
    let take = min(pm, nominal);
    let fr = take / pm;
    if (!addParticle(at.p, v, take, pH / pm, fr * ps, true)) { break; }
    pH -= fr * pH;
    ps -= fr * ps;
    pm -= take;
    if (!(pm > 1e-15)) { pm = 0.0; pH = 0.0; ps = 0.0; }
  }
  bmelt[o] = pm;
  bmelt[o + 1u] = pH;
  bmelt[o + 2u] = ps;
}`}],Un={RESTF:0,RESTK:1,FSUM:2,KSUM:3,M9:4},Jo=16,Us=128,Hf=48,Ar=11,Sr=4,Tr=Sr+Ar*Us,p1=Tr+Hf*Us,b1=8,Vn={friction:.5,bounce:.1};function pi(o){return!o.gone&&o.ncell>0&&o.nr===1&&me(o.mat)>0}function tc(o){if(o.bodies.anyFree||o.bodies.list.some(t=>!t.gone&&me(t.mat)>0))return!0;for(const t of o.melt.water.pending.values())if(t.m>0)return!0;return!1}function Dl(o){if(!pi(o)){let t=0,e=0;for(let s=0;s<o.nr;s+=1)t+=o.xs[s].length,e+=o.ys[s].length;return{cells:o.ncell,xs:t,ys:e}}return{cells:(o.ni[0]+2)*(o.nj[0]+2),xs:o.ni[0]+3,ys:o.nj[0]+3}}function g1(o){const t=new Float64Array(4);return o.worldBox(o.x,o.y,o.a,t),[t[0],t[1],t[2],t[3]]}class Mr{constructor(t,e){v(this,"bod");v(this,"bgeo");v(this,"bcell");v(this,"bcon");v(this,"bat");v(this,"bread");v(this,"bmelt");v(this,"capBodies");v(this,"capCells");v(this,"capGeo");v(this,"capMelt");v(this,"nbody",0);v(this,"ncell",0);v(this,"nrect",0);v(this,"layers",2);v(this,"probed",[]);v(this,"melting",!1);v(this,"ctx");v(this,"own",[]);this.ctx=t;const s=Mr.need(e);this.capBodies=Math.max(4,s.bodies+4),this.capCells=Math.max(16,Math.ceil(s.cells*1.25)+64),this.capGeo=Math.max(64,Math.ceil(s.geo*1.25)+256),this.capMelt=Math.max(64,ge+ve*this.capBodies+Math.ceil(s.scratch*1.25)+64);const n=(i,r)=>{const c=t.buffer(i,4*Math.max(4,r));return this.own.push(c),c};this.bod=n("bod",Bs*this.capBodies),this.bgeo=n("bgeo",this.capGeo),this.bcell=n("bcell",ke*this.capCells),this.bcon=n("bcon",p1),this.bat=n("bat",Jo*this.capBodies),this.bread=n("bread",vn*this.capBodies),this.bmelt=n("bmelt",this.capMelt)}static need(t){if(!tc(t))return{bodies:0,cells:0,geo:0,scratch:0};let e=0,s=Ss,n=0;for(const i of t.bodies.list){if(i.gone)continue;const r=Dl(i);e+=r.cells,s+=i.nr*dn+jf*i.nseg+r.xs+r.ys,pi(i)&&(n=Math.max(n,3*r.cells+r.xs+r.ys))}return s+=$o*(4+t.grid.n/2),{bodies:t.bodies.list.length,cells:e,geo:s,scratch:n}}fits(t){const e=Mr.need(t);return e.bodies<=this.capBodies&&e.cells<=this.capCells&&e.geo<=this.capGeo&&ge+ve*e.bodies+e.scratch<=this.capMelt}destroy(){this.ctx.release(this.own),this.own.length=0}upload(t){const e=this.ctx.device.queue;if(this.nbody=0,this.ncell=0,this.nrect=0,this.probed=[],!tc(t))return;const s=t.bodies.list,n=t.bodies.motion,i=s.length,r=new Float32Array(Bs*i),c=[],l=[],a=[],u=[];let f=0,d=0,m=0,p=0;const h=[],g=new Float32Array(ge+ve*i);g[0]=ge+ve*i,this.melting=!1;let x=0;for(const k of s)!k.gone&&k.ncell>0&&(x+=k.nr);let y=Ss+dn*x;s.forEach((k,S)=>{const T=Bs*S,M=k.gone||k.ncell===0,O=M?[1e9,1e9,-1e9,-1e9]:g1(k),q=pi(k),N=Dl(k);for(let E=0;E<4;E+=1){const I=t.melt.water.pending.get(4*S+E);I===void 0||!(I.m>0)||(g.set([I.m,I.H,I.s,I.x,I.y,I.nx,I.ny],ge+ve*S+Ie.PEND+kr*E),this.melting=!0)}q&&(this.melting=!0,g[ge+ve*S+Ie.CAPC]=N.cells,g[ge+ve*S+Ie.CAPX]=N.xs,g[ge+ve*S+Ie.CAPY]=N.ys);const L=(E,I)=>{r[T+E]=I};L(Y.X,k.x),L(Y.Y,k.y),L(Y.A,k.a),L(Y.VX,k.vx),L(Y.VY,k.vy),L(Y.W,k.w),L(Y.UX,k.ux),L(Y.UY,k.uy),L(Y.UW,k.uw),L(Y.M,k.m),L(Y.I,k.I),L(Y.RMAX,k.rmax),L(Y.HULLA,k.hullA),L(Y.HULLJ,k.hullJ),L(Y.PINNED,k.pinned?1:0),L(Y.ASLEEP,k.asleep?1:0),L(Y.GONE,M?1:0),L(Y.REST,k.rest),L(Y.RX,k.rx),L(Y.RY,k.ry),L(Y.RA,k.ra);for(let E=0;E<3;E+=1)L(Y.PREV+E,n.prev[3*S+E]??0),L(Y.PRED+E,n.pred[3*S+E]??0),L(Y.PNOW+E,n.predNow[3*S+E]??0),L(Y.POLD+E,n.predOld[3*S+E]??0),L(Y.VPRE+E,n.vPre[3*S+E]??0);for(let E=0;E<6;E+=1)L(Y.MA6+E,k.ma6[E]);L(Y.MAOK,k.maOk?1:0),L(Y.MA,k.ma),L(Y.IA,k.Ia),L(Y.MAT,k.mat),L(Y.HEATER,k.heater),L(Y.NR,M?0:k.nr),L(Y.RO,f),L(Y.NCELL,M?0:k.ncell),L(Y.KO,d),L(Y.NSEG,M?0:k.nseg),L(Y.SO,m),L(Y.BX0,O[0]),L(Y.BY0,O[1]),L(Y.BX1,O[2]),L(Y.BY1,O[3]),L(Y.OX0,O[0]),L(Y.OY0,O[1]),L(Y.OX1,O[2]),L(Y.OY1,O[3]),L(Y.TOUCH,t.bodies.contacts.touches(k)?1:0),L(Y.AGAIN,M?0:1),L(Y.COS,Math.cos(k.a)),L(Y.SIN,Math.sin(k.a)),L(Y.PROBE,0),L(Y.KEY,k.key);let R=0;for(let E=0;E<k.ncell;E+=1)R+=k.cellVolume(E);if(L(Y.VOL,R),L(Y.E0,Ls(k.mat)),L(Y.PUSH,0),L(Y.MELT,q?1:0),h.push(d),!M){!k.pinned&&!k.asleep&&this.probed.length<b1&&(this.probed.push(S),L(Y.PROBE,1));for(let E=0;E<k.nr;E+=1){const[I,z,G,X]=k.bounds(E);p=Math.max(p,Math.min(G-I,X-z));const nt=y;for(const H of k.xs[E])l.push(H);const bt=q?N.xs:k.xs[E].length;for(let H=k.xs[E].length;H<bt;H+=1)l.push(0);y+=bt;const ct=y;for(const H of k.ys[E])l.push(H);const W=q?N.ys:k.ys[E].length;for(let H=k.ys[E].length;H<W;H+=1)l.push(0);y+=W,c.push(I,z,G,X,k.ni[E],k.nj[E],nt,ct,d+k.off[E],S,0,0);for(let H=0;H<k.ni[E]*k.nj[E];H+=1)u.push(f+E)}for(let E=k.ncell;E<N.cells;E+=1)u.push(f);for(let E=0;E<k.nseg;E+=1)a.push(f+k.segR[E],k.segS[E],k.segT0[E],k.segT1[E],S,0,0,0);f+=k.nr,d+=N.cells,m+=k.nseg}});const b=y,_=b+a.length,F=v1(t),A=new Float32Array(Math.max(Ss,_+F.length));A[As.SEGS]=b,A[As.PARTS]=_,A[As.NPARTS]=F.length/$o,A[As.NRECT]=f,A[As.NCELL]=d,A[As.NBODY]=i,A.set(c,Ss),A.set(l,Ss+dn*x),A.set(a,b),A.set(F,_);const P=new Float32Array(ke*Math.max(1,d));for(let k=0;k<d;k+=1)P[ke*k+3]=u[k];s.forEach((k,S)=>{if(k.gone||k.ncell===0)return;const T=h[S];for(let M=0;M<k.ncell;M+=1)P[ke*(T+M)]=k.E[M],P[ke*(T+M)+1]=k.film[M],P[ke*(T+M)+2]=k.crust[M]}),e.writeBuffer(this.bod,0,r),e.writeBuffer(this.bgeo,0,A),e.writeBuffer(this.bcell,0,P),e.writeBuffer(this.bcon,0,this.warmTable(t)),e.writeBuffer(this.bat,0,new Uint32Array(Jo*this.capBodies)),e.writeBuffer(this.bmelt,0,g),this.nbody=i,this.ncell=d,this.nrect=f;const w=Math.min(64,Math.ceil(p/t.grid.dx)+3);this.layers=w+w%2}warmTable(t){const e=t.bodies.contacts,s=new Uint32Array(Tr),n=new Float32Array(s.buffer),i=Math.min(Us,e.warmCount);s[0]=i;for(let r=0;r<i;r+=1){const c=e.warmKey[r],l=Math.floor(c/1e6),a=Sr+Ar*r;s[a]=l,s[a+1]=Math.round(c-l*1e6);const u=9*r;s[a+2]=e.warmData[u];for(let f=0;f<2;f+=1)s[a+3+4*f]=Math.max(0,Math.round(e.warmData[u+1+4*f]))>>>0,n[a+4+4*f]=e.warmData[u+2+4*f],n[a+5+4*f]=e.warmData[u+3+4*f],s[a+6+4*f]=e.warmData[u+4+4*f]===1?1:0}return s}async download(t,e){if(this.nbody===0)return;const[s,n,i,r,c]=await e([{buf:this.bod,offset:0,size:4*Bs*this.nbody},{buf:this.bcell,offset:0,size:4*ke*Math.max(1,this.ncell)},{buf:this.bcon,offset:0,size:4*Tr},{buf:this.bgeo,offset:0,size:4*this.capGeo},{buf:this.bmelt,offset:0,size:4*(ge+ve*this.nbody)}]),l=new Float32Array(s),a=new Float32Array(n),u=new Float32Array(r),f=new Float32Array(c),d=t.bodies.list,m=t.bodies.motion,p=t.melt.water.pending;d.forEach((b,_)=>{if(_>=this.nbody)return;const F=Bs*_,A=T=>l[F+T];for(let T=0;T<4;T+=1){const M=ge+ve*_+Ie.PEND+kr*T;f[M]>0?p.set(4*_+T,{m:f[M],H:f[M+1],s:f[M+2],x:f[M+3],y:f[M+4],nx:f[M+5],ny:f[M+6]}):p.delete(4*_+T)}if(b.gone||b.ncell===0)return;const w=A(Y.MELT)!==0&&A(Y.GONE)===0;if(w){const T=Ss+dn*A(Y.RO),M=u[T+Kn.XO],O=u[T+Kn.YO];b.setRects([Float64Array.from(u.subarray(M,M+u[T+Kn.NI]+1))],[Float64Array.from(u.subarray(O,O+u[T+Kn.NJ]+1))])}const k=A(Y.KO),S=A(Y.NCELL);if(S>0&&b.ncell===S)for(let T=0;T<S;T+=1)b.E[T]=a[ke*(k+T)],b.film[T]=a[ke*(k+T)+1],b.crust[T]=a[ke*(k+T)+2];b.x=A(Y.X),b.y=A(Y.Y),b.a=A(Y.A),b.vx=A(Y.VX),b.vy=A(Y.VY),b.w=A(Y.W),b.ux=A(Y.UX),b.uy=A(Y.UY),b.uw=A(Y.UW),b.asleep=A(Y.ASLEEP)!==0,b.rest=A(Y.REST),b.rx=A(Y.RX),b.ry=A(Y.RY),b.ra=A(Y.RA);for(let T=0;T<3;T+=1)m.prev[3*_+T]=A(Y.PREV+T),m.pred[3*_+T]=A(Y.PRED+T),m.predNow[3*_+T]=A(Y.PNOW+T),m.predOld[3*_+T]=A(Y.POLD+T),m.vPre[3*_+T]=A(Y.VPRE+T);for(let T=0;T<6;T+=1)b.ma6[T]=A(Y.MA6+T);b.maOk=A(Y.MAOK)!==0,b.ma=A(Y.MA),b.Ia=A(Y.IA),w&&b.derive(),A(Y.GONE)!==0&&(t.bodies.cover.release(b),b.gone=!0,b.ncell=0)});const h=new Uint32Array(i),g=new Float32Array(i),x=t.bodies.contacts,y=Math.min(Us,h[0]);x.warmKey.length<y&&(x.warmKey=new Float64Array(2*y+8),x.warmData=new Float64Array(9*(2*y+8)));for(let b=0;b<y;b+=1){const _=Sr+Ar*b;x.warmKey[b]=h[_]*1e6+h[_+1];const F=9*b;x.warmData[F]=h[_+2];for(let A=0;A<2;A+=1)x.warmData[F+1+4*A]=h[_+3+4*A],x.warmData[F+2+4*A]=g[_+4+4*A],x.warmData[F+3+4*A]=g[_+5+4*A],x.warmData[F+4+4*A]=h[_+6+4*A]}x.warmCount=y,x.invalidate()}parse(t,e,s){const n=new Float32Array(t,e,vn*s),i=[];for(let r=0;r<s;r+=1){const c=vn*r,l=n[c+Mt.STATE];i.push({x:n[c+Mt.X],y:n[c+Mt.Y],a:n[c+Mt.A],vx:n[c+Mt.VX],vy:n[c+Mt.VY],w:n[c+Mt.W],pinned:(l&1)!==0,asleep:(l&2)!==0,gone:(l&4)!==0,m:n[c+Mt.M],T:n[c+Mt.T],E:n[c+Mt.E],film:n[c+Mt.FILM],crust:n[c+Mt.CRUST],fx:n[c+Mt.FX],fy:n[c+Mt.FY],tq:n[c+Mt.TQ],pm:n[c+Mt.PM],pH:n[c+Mt.PH],ps:n[c+Mt.PS],rect:[n[c+Mt.RX0],n[c+Mt.RY0],n[c+Mt.RX1],n[c+Mt.RY1]]})}return i}}function v1(o){const t=o.grid,e=[],s=t.w,n=t.h,i=(d,m,p,h,g,x)=>{e.push(d,m,p,h,g,x.friction,x.bounce,0)};t.openL||i(-1,-1,0,n+1,1,Vn),t.openR||i(s,-1,s+1,n+1,2,Vn),t.openB||i(-1,-1,s+1,0,3,Vn),t.openT||i(-1,n,s+1,n+1,4,Vn);const{nx:r,ny:c,dx:l}=t,a=d=>{const m=ht[d-1];return m!==void 0?{friction:m.friction,bounce:m.bounce}:Vn};let u=new Map,f=10;for(let d=0;d<=c;d+=1){const m=new Map;if(d<c){let p=0;for(;p<r;){const h=p+d*r;if(t.solid[h]===0||t.owner[h]!==0){p+=1;continue}const g=t.solid[h];let x=p;for(;x+1<r&&t.solid[x+1+d*r]===g&&t.owner[x+1+d*r]===0;)x+=1;const y=g<<24|p<<12|x;m.set(y,u.has(y)?u.get(y):d),p=x+1}}for(const[p,h]of u)m.get(p)!==h&&i((p>>12&4095)*l,h*l,((p&4095)+1)*l,d*l,f++,a(p>>>24));u=m}return e}function x1(o,t,e){const s=hi(o,t);if(s<0)return null;const n=o.scene.ops[s],i=[];let r=0,c=0,l=0,a="gone";return o.bodies.list.forEach((u,f)=>{const d=e==null?void 0:e[f];if(u.gone||u.key!==s||(d==null?void 0:d.gone)===!0)return;const m=(d==null?void 0:d.x)??u.x,p=(d==null?void 0:d.y)??u.y,h=(d==null?void 0:d.a)??u.a,g=Math.cos(h),x=Math.sin(h),y=d!==void 0&&pi(u)&&d.rect[2]>d.rect[0];for(let A=0;A<u.nr;A+=1){const[P,w,k,S]=y?d.rect:u.bounds(A);for(const[T,M]of[[P,w],[k,w],[k,S],[P,S]])i.push(m+g*T-x*M,p+x*T+g*M)}const b=y?d.m:u.m;r+=b;const _=b*ht[u.mat].cp;c+=_*(d!==void 0&&d.T>0?d.T:u.meanT()),l+=_;const F=u.pinned?"pinned":(d==null?void 0:d.asleep)??u.asleep?"asleep":"moving";(a==="gone"||F==="moving")&&(a=F)}),{id:t,kind:n.op,outline:i,T:l>0?c/l:n.T,mass:r,state:a}}function y1(o,t){let e=0;return o.bodies.list.forEach((s,n)=>{const i=t[n];i!==void 0&&!i.gone&&me(s.mat)>0&&(e+=i.m)}),e}class $f{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=St(t.cpu.regions.pAmb),i=hc(n),r=t.budget(),c={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},l=this.last;let a=0,u=0;if(l!==null&&c.t>l.t){const m=c.t-l.t,p=(c.heater-l.heater)/m,h=(c.solids-l.solids+c.SG-l.SG+c.lossS-l.lossS+c.LG-l.LG+c.sens-l.sens+c.bub-l.bub)/m;a=(c.vap-l.vap)/m,u=Math.max(0,(p-h)/i)}this.last=c;const f=this.vapour()*i,d=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=d),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:d-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:a,expectedRate:u}}copyTo(t){const e=t;e.last=this.last===null?null:{...this.last},e.latent0=this.latent0,e.stored0=this.stored0,e.started=this.started}copyFrom(t){const e=t;this.last=e.last===null?null:{...e.last},this.latent0=e.latent0,this.stored0=e.stored0,this.started=e.started}}const fn=800,w1=24,Gl=6,Wt=4,yn=16,Jt=256,Ul=`struct Levels { lv: array<Level, ${yn}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,bi=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,rr=`${bi}
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
`,Xe=`
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
`,ws=`
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
`,Vl=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Hl=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Ot="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ns=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,Wf=6,en=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,go=`
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
`,vo="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",_1=[{name:"cgPrep1",wg:Jt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${bi}
${Ot} {
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
}`},{name:"cgPrep2",wg:Jt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${ns}
${rr}
${Ot} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${Wf}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:Jt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${Ot} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:Jt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${ns}
${go}
${en}
${Ot} {
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
}`},{name:"cclProject",wg:Jt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${ns}
${vo}
${en}
${Ot} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Jt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${ns}
${bi}
${ws}
${Ot} {
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
}`},{name:"cgFoldInitMG",wg:Jt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${ws}
${Hl}
${Ot} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${ns}
${Xe}
${ws}
${Vl}
${Ot} {
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
}`},{name:"cgB",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${ns}
${Xe}
${ws}
${Vl}
var<workgroup> wpq: f32;
${Ot} {
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
}`},{name:"cgFoldRR",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Xe}
${ws}
${Hl}
${Ot} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Xe}
${ws}
${Ot} {
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
}`},{name:"cgZSum",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Xe}
${go}
${en}
${Ot} {
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
}`},{name:"cgZSub",wg:Jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Xe}
${vo}
${en}
${ws}
${Ot} {
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
}`},{name:"cgEnd1",wg:Jt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${ns}
${go}
${en}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${Ot} {
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
}`},{name:"cgEnd2",wg:Jt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${ns}
${vo}
${en}
${Ot} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],F1=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function P1(o,t){const e=[];let s=0,n=0,i=o,r=t,c=1,l=0;for(;;){const u=i+2,f=(i+2)*(r+2),d={};for(const h of F1)d[h]=s,s+=f;const m=n;n+=f;let p=0;if(d.pW=0,e.length>0&&(d.pW=s,s+=4*l,p=n,n+=4*l),e.push({nx:i,ny:r,stride:u,size:f,h:c,f:d,act:m,pIdx:p}),i*r<=w1||i<=2&&r<=2||e.length>=yn)break;l=f,i=Math.ceil(i/2),r=Math.ceil(r/2),c*=2}let a=e.length-1;for(let u=0;u<e.length;u+=1){let f=0;for(let d=u;d<e.length;d+=1)f+=e[d].size;if(f<=fn){a=u;break}}return{levels:e,fSize:s,uSize:n,lt:a}}function Yi(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const Kf={tol:1e-5,it:V.IT_L,cap:V.CAP_L,res:V.RES_L},zf={tol:1e-5,it:V.IT_G,cap:V.CAP_G,res:V.RES_G},Yf={tol:1e-5,it:V.IT_H,cap:V.CAP_H,res:V.RES_H},Xf={tol:1e-5,it:V.IT_D,cap:V.CAP_D,res:V.RES_H},Qf={tol:1e-4,it:V.IT_P,cap:V.CAP_P,res:V.RES_P},sn=200,Fe=256;class k1{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);Yi(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(Fe/4*n.length);for(let a=0;a<n.length;a+=1)Yi(a>0?n[a-1]:null,a-1,r,Fe/4*a),Yi(n[a],a,r,Fe/4*a+32);this.lp=t.uniform("lp",r.buffer);const c=new Uint32Array(32*yn+4);for(let a=0;a<n.length;a+=1)Yi(n[a],a,c,32*a);c[32*yn]=e.lt,c[32*yn+1]=n.length,this.lv=t.uniform("lv",c.buffer);const l=new Uint32Array(Fe/4*(sn+1));for(let a=0;a<sn;a+=1)l[Fe/4*a]=a;l[Fe/4*sn]=4294967295,this.it=t.uniform("iter",l.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(Fe*8));for(const a of[Kf,zf,Yf,Xf,Qf])this.setKind(a)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,Fe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,Fe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:Fe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,Fe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s,n=!1){const i=this.setKind(e),r={SV:this.range(this.cfg,i,16)},c=this.n0cells;this.run(t,"cgPrep1",c,`c${i}`,r),this.run(t,"cgPrep2",c),s&&(this.run(t,"cclMerge",c),this.run(t,"cclFinal",c),this.run(t,"cclProject",c)),n||this.coarsen(t),this.run(t,"cgInitMG",c),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],c={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,c)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n,r=!1){const c=this.n0cells;this.prepare(t,e,n,r);const l=(u,f)=>{const d={IT:this.itRes(u)};i?(this.run(t,"cgZSum",c,f,d),this.run(t,"cgZSub",c,f,d)):this.run(t,"cgRZ",c,f,d)};this.vcycle(t),l(sn,`k${sn}`);const a=Math.min(sn,Math.max(1,s));for(let u=0;u<a;u+=1){const f={IT:this.itRes(u)};this.run(t,"cgA",c,`k${u}`,f),this.run(t,"cgB",c,`k${u}`,f),this.one(t,"cgFoldRR",`k${u}`,f),this.vcycle(t),l(u,`k${u}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const xo=256,A1=3*8;class S1{constructor(t,e){v(this,"pb");v(this,"itP",12);this.state=t,this.solver=e,this.pb=t.ctx.buffer("probesel",xo*A1,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.writeSel()}writeSel(){const t=this.state.ctx.device.queue,e=this.state.bodies,s=e.probed;for(let n=0;n<Math.min(8,s.length);n+=1)for(let i=0;i<3;i+=1)t.writeBuffer(this.pb,xo*(3*n+i),new Uint32Array([s[n],i,0,0]));for(let n=0;n<e.nbody;n+=1)t.writeBuffer(e.bod,4*(Bs*n+Y.PROBE),new Float32Array([s.includes(n)?1:0]))}select(t){const e=[];t.forEach((n,i)=>{!n.pinned&&!n.asleep&&!n.gone&&e.length<8&&e.push(i)});const s=this.state.bodies.probed;e.length===s.length&&e.every((n,i)=>s[i]===n)||(this.state.bodies.probed=e,this.writeSel())}destroy(){this.state.ctx.release([this.pb])}prepare(t,e){e.one(t,"bPrep"),e.parts(t,"bPush"),e.bubs(t,"bPushB"),e.cells(t,"bCover"),e.cells(t,"bClose1"),e.cells(t,"bClose2"),e.cells(t,"bFlip"),e.cells(t,"bApply"),e.cells(t,"gasApply"),e.cells(t,"bStatic"),e.one(t,"bPrepEnd")}probe(t,e){const s=this.state.bodies.probed;if(s.length===0)return;const n=this.state.d.n,i=this.solver.level0;for(let r=0;r<Math.min(8,s.length);r+=1)for(let c=0;c<3;c+=1){const l=3*r+c,a={PB:{buffer:this.pb,offset:xo*l,size:16},L:i};e.run(t,"bProbeRhs",n,`pr${l}`,a),this.solver.encodeMG(t,Qf,this.itP,!0,!1,!0),e.run(t,"bProbeDot",n,`pd${l}`,a)}e.one(t,"bProbeFin")}finish(t,e){const s=this.state.bodies;e.cells(t,"bCollectPrep"),e.run(t,"bCollect",Math.max(1,s.ncell),"bCollect",{}),e.run(t,"bCollectRest",Math.max(1,s.ncell),"bCollectRest",{}),e.cells(t,"bCollectEnd"),s.melting&&(e.cells(t,"mSums","A"),e.one(t,"mMelt"),e.parts(t,"mApply"),e.run(t,"mSpawn",4*Math.max(1,s.nbody),"mSpawn",{})),e.cells(t,"bExtInit","A");for(let n=0;n<s.layers;n+=2)e.cells(t,"bExtA"),e.cells(t,"bExtB");e.run(t,"bForce",64*Math.max(1,s.nbody),"bForce",{}),e.one(t,"bDyn")}measure(t,e){e.run(t,"bMeas",64*Math.max(1,this.state.bodies.nbody),"bMeas",{})}adapt(t,e){if(t===0&&e===0)return;const s=e>0?Math.ceil(this.itP*1.5)+2:t+1;this.itP=Math.min(40,Math.max(4,this.itP>s?Math.max(s,this.itP-2):s))}}const Me=Ct.solutes[0],Zn=298.15,He=o=>o.map(K).join(", "),qi=14,ms=Me.cp.range.lo,ps=Me.cp.range.hi,[Zf,T1,M1,B1,C1,L1]=Me.cp.laliberte,q1=o=>Math.exp(T1*(o-et)+M1*Math.exp(.01*(o-et))),Br=.5*(ps-ms),Vs=new Array(qi).fill(0);{for(let t=0;t<64;t+=1){const e=Math.PI*(t+.5)/64,s=q1(.5*(ps+ms)+Br*Math.cos(e));for(let n=0;n<qi;n+=1)Vs[n]+=2/64*s*Math.cos(n*e)}Vs[0]/=2}const ec=o=>o<qi?Vs[o]:0,Tn=new Array(qi+1).fill(0);Tn[1]=Vs[0]-ec(2)/2;for(let o=2;o<=qi;o+=1)Tn[o]=(ec(o-1)-ec(o+1))/(2*o);const gi=(o,t)=>{let e=0,s=0;for(let n=o.length-1;n>=1;n-=1){const i=2*t*e-s+o[n];s=e,e=i}return t*e-s+o[0]},Cr=gi(Vs,-1),Jf=gi(Vs,1),sc=gi(Tn,-1),t0=o=>{if(o<=ms)return Cr*(o-et);const t=Cr*(ms-et);return o>=ps?t+Br*(gi(Tn,1)-sc)+Jf*(o-ps):t+Br*(gi(Tn,(2*o-ms-ps)/(ps-ms))-sc)},O1=Cr*(ms-et),E1=t0(ps),R1=Me.dHsol.v/Be+gs*(Zn-et)-1e3*Zf*t0(Zn);function $l(o,t){const e=[`fn ${o}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let s=t.length-1;s>=1;s-=1)e.push(`  t = 2.0 * x * b1 - b2 + ${K(t[s])}; b2 = b1; b1 = t;`);return e.push(`  return x * b1 - b2 + ${K(t[0])};`,"}"),e.join(`
`)}const Hn=Me.pitzer,Xi=Me.pitzerCold,I1=Math.sqrt(2*Math.PI*Ca),N1=dr*dr/(4*Math.PI*La*Ba),nn=Me.solubility.table,$n=Me.density.laliberte,j1=`
const S_TR: f32 = ${K(Zn)};
const S_MS: f32 = ${K(Be)};
const S_MW: f32 = ${K(Dr)};
const S_NU: f32 = ${K(Me.ions.v)};
const PZ_B: f32 = ${K(Hn.b.v)};
const PZ_ALPHA: f32 = ${K(Hn.alpha.v)};
const PZ_COLD: f32 = ${K(Xi.below.v)};
const PZ_B0 = array<f32, 6>(${He(Hn.b0.a)});
const PZ_B1 = array<f32, 6>(${He(Hn.b1.a)});
const PZ_C = array<f32, 6>(${He(Hn.c.a)});
const PZC_B0 = array<f32, 6>(${He(Xi.b0.a)});
const PZC_B1 = array<f32, 6>(${He(Xi.b1.a)});
const PZC_C = array<f32, 6>(${He(Xi.c.a)});
const S_EPS = array<f32, 4>(${He(Me.dielectric.c)});
const S_KN: f32 = ${K(I1)};
const S_KLB: f32 = ${K(N1)};
const SOL_T = array<f32, ${nn.length}>(${He(nn.map(o=>o[0]))});
const SOL_M = array<f32, ${nn.length}>(${He(nn.map(o=>o[1]))});
const LD0: f32 = ${K($n[0])};
const LD1: f32 = ${K($n[1])};
const LD2: f32 = ${K($n[2])};
const LD3: f32 = ${K($n[3])};
const LD4: f32 = ${K($n[4])};
const LA1: f32 = ${K(Zf)};
const LA4: f32 = ${K(B1)};
const LA5: f32 = ${K(C1)};
const LA6: f32 = ${K(L1)};
const E_LO: f32 = ${K(ms)};
const E_HI: f32 = ${K(ps)};
const E_LOV: f32 = ${K(Cr)};
const E_HIV: f32 = ${K(Jf)};
const E_HALF: f32 = ${K(Br)};
const E_FM1: f32 = ${K(sc)};
const E_ILO: f32 = ${K(O1)};
const E_IHI: f32 = ${K(E1)};
const S_QS: f32 = ${K(R1)};
const S_DMU: f32 = ${K(Me.diffusivity.v*js(Zn)/Zn)};

${$l("eCh",Vs)}
${$l("iCh",Tn)}
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
  for (var k = 1; k < ${nn.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${nn.length-1}];
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
`,e0=[],wn=new Map;{let o=[];const t=j1.split(`
`);for(let e=0;e<t.length;e+=1){const s=t[e];if(s.startsWith("const ")){e0.push(s),o=[];continue}if(s.startsWith("/*")){o=[s];continue}const n=/^fn (\w+)\(/.exec(s);if(n===null){s.trim()===""&&(o=[]);continue}const i=[...o,s];if(!s.trimEnd().endsWith("}"))for(;e+1<t.length&&t[e]!=="}";)e+=1,i.push(t[e]);wn.set(n[1],i.join(`
`)),o=[]}}const s0=o=>new RegExp(`\\b${o}\\s*\\(`),D1=new Map([...wn.entries()].map(([o,t])=>[o,[...wn.keys()].filter(e=>e!==o&&s0(e).test(t))]));function G1(o){const t=new Set,e=s=>{if(!t.has(s)){t.add(s);for(const n of D1.get(s)??[])e(n)}};for(const s of wn.keys())s0(s).test(o)&&e(s);return t.size===0?"":[...e0,...[...wn.keys()].filter(s=>t.has(s)).map(s=>wn.get(s))].join(`
`)}class U1{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=H1(t.bind),this.source=K1(t,this.binds,this.wg)}}const V1={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function H1(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":V1[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const $1=`
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
`,W1=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function K1(o,t,e){const s=[qc,`const WG: u32 = ${e}u;`,$1],n=G1(o.code);n!==""&&s.push(n);const i=new Set(t.map(r=>r.name));for(const r of t)r.mode==="a"&&i.add(`${r.name}!`);for(const r of W1)r.needs.every(c=>i.has(c))&&s.push(r.code);return t.forEach((r,c)=>{r.mode==="u"?s.push(`@group(0) @binding(${c}) var<uniform> ${r.name}: ${r.type};`):r.mode==="t"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_storage_2d<rgba8unorm, write>;`):r.mode==="x"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_2d<f32>;`):r.mode==="s"?s.push(`@group(0) @binding(${c}) var ${r.name}: sampler;`):r.mode==="r"?s.push(`@group(0) @binding(${c}) var<storage, read> ${r.name}: array<${r.type}>;`):r.mode==="w"?s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<${r.type}>;`):(s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<atomic<u32>>;`),s.push(`fn addF_${r.name}(i: u32, v: f32) {
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
`)}class Oc{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"adapter","");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}}),r=new Oc(i),c=e.info;return c!==void 0&&(r.adapter=[c.vendor,c.architecture,c.description].filter(Boolean).join(" ")),r}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new U1(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),c=(await i.getCompilationInfo()).messages.filter(a=>a.type==="error");if(c.length>0){const a=n.source.split(`
`);for(const u of c)e.push(`${s.name}:${u.lineNum}:${u.linePos} ${u.message}
    ${a[u.lineNum-1]??""}`);return}const l=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((a,u)=>a.mode==="t"?{binding:u,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:a.mode==="x"?{binding:u,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:a.mode==="s"?{binding:u,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:u,visibility:GPUShaderStage.COMPUTE,buffer:{type:a.mode==="u"?"uniform":a.mode==="r"?"read-only-storage":"storage"}})});n.layout=l;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[l]}),compute:{module:i,entryPoint:"main"}})}catch(a){e.push(`${s.name}: ${a instanceof Error?a.message:String(a)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const cs=128,ls="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Wl="@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",rn=`const BA_STRIDE: u32 = ${Jo}u;
const BA_RESTF: u32 = ${Un.RESTF}u;
const BA_RESTK: u32 = ${Un.RESTK}u;
const BA_FSUM: u32 = ${Un.FSUM}u;
const BA_KSUM: u32 = ${Un.KSUM}u;
const BA_M9: u32 = ${Un.M9}u;`,Kl=`
fn areaInC(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
`,n0=`
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
`;function zl(o,t,e,s,n,i,r){return{name:o,wg:cs,bind:"P:u bod:r cf:w",code:`${he}
${n0}
${ls} {
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
}`}}const Yl=`
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
`,Xl="struct ProbeSel { b: u32, k: u32, p1: u32, p2: u32 }",z1=[{name:"bCollectPrep",wg:cs,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:r bat:a",code:`${Ht}
${Je}
${Kl}
${rn}
${ls} {
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
}`},{name:"bCollect",wg:cs,bind:"P:u bod:r bgeo:r bcell:w cf:r cu:r bat:a",code:`${Ht}
${Je}
${Kl}
${rn}
${ls} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let n = P.n;
  let ni = u32(rv(rq, GR_NI));
  let loc = k - u32(rv(rq, GR_KO));
  /* Die Reserve eines schmelzenden Körpers (kbodymelt.ts) ist keine innere Zelle. */
  if (loc >= ni * u32(rv(rq, GR_NJ))) { return; }
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
}`},{name:"bCollectRest",wg:cs,bind:"P:u bod:r bgeo:r bcell:w bat:a",code:`${Ht}
${rn}
${ls} {
  let k = gid.x;
  if (k >= u32(bgeo[GH_NCELL])) { return; }
  let rq = u32(bcell[BC * k + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b) || k - u32(rv(rq, GR_KO)) >= u32(rv(rq, GR_NI)) * u32(rv(rq, GR_NJ))) { return; }
  let o = b * BA_STRIDE;
  let rf = getF_bat(o + BA_RESTF);
  let F = getF_bat(o + BA_FSUM);
  if (rf > 0.0 && F > 0.0) { bcell[BC * k + 1u] *= max(0.0, 1.0 - rf / F); }
  let rk = getF_bat(o + BA_RESTK);
  let K = getF_bat(o + BA_KSUM);
  if (rk > 0.0 && K > 0.0) { bcell[BC * k + 2u] *= max(0.0, 1.0 - rk / K); }
}`},{name:"bCollectEnd",wg:cs,bind:"P:u cf:w bat:a",code:`${rn}
${ls} {
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
}`},{name:"bExtInit",wg:cs,bind:"P:u glob:r bod:r cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${he}
${n0}
${ls} {
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
}`},zl("bExtA","F_PE0","F_RE0","F_KN0","F_PE1","F_RE1","F_KN1"),zl("bExtB","F_PE1","F_RE1","F_KN1","F_PE0","F_RE0","F_KN0"),{name:"bForce",wg:64,bind:"P:u glob:r bod:w bgeo:r cf:r cu:r",code:`${Ht}
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
${Wl} {
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
}`},{name:"bProbeRhs",wg:cs,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:w",code:`${Xl}
${he}
${Fr}
${Yl}
${ls} {
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
}`},{name:"bProbeDot",wg:cs,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:r bat:a",code:`${Xl}
${he}
${Fr}
${Yl}
${rn}
var<workgroup> rj: array<vec3<f32>, WG>;
${ls} {
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
}`},{name:"bProbeFin",wg:64,bind:"P:u glob:r bod:w bat:a",code:`${he}
${rn}
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
}`},{name:"bMeas",wg:64,bind:"P:u bod:r bgeo:r bcell:r bmelt:r bread:w",code:`${Ht}
const MLT_HEAD_R: u32 = ${ge}u;
const MLT_BODY_R: u32 = ${ve}u;
const PEND_W_R: u32 = ${kr}u;
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
${Wl} {
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
    var pw = vec3<f32>(0.0);
    for (var s = 0u; s < 4u; s++) {
      let po = MLT_HEAD_R + b * MLT_BODY_R + ${Ie.PEND}u + s * PEND_W_R;
      pw += vec3<f32>(bmelt[po] - bmelt[po + 2u], bmelt[po + 1u], bmelt[po + 2u]);
    }
    bread[o + BRD_PM] = pw.x; bread[o + BRD_PH] = pw.y; bread[o + BRD_PS] = pw.z;
    var bx = vec4<f32>(0.0);
    if (!gone && bv(b, B_NR) > 0.0) { bx = rBox(rectOf(b, 0u)); }
    bread[o + BRD_RX0] = bx.x; bread[o + BRD_RY0] = bx.y; bread[o + BRD_RX1] = bx.z; bread[o + BRD_RY1] = bx.w;
  }
}`}],Ye=128,Pe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",vi=`
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
`,Ql=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,or=`
var<workgroup> rr: array<f32, ${16*Ye}>;
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
`,Y1=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:Ye,bind:"P:u cf:w cu:r at:w reg:r",code:`${vi}
${Pe} {
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
}`})),{name:"transitions",wg:Ye,bind:"P:u cf:r cu:r at:a cnt:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${Pe} {
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
}`},{name:"regCells",wg:Ye,bind:"P:u cf:r cu:r racc:a",code:`${or}
${Pe} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${or}
${Pe} {
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
}`},{name:"regBubs",wg:Ye,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${Pe} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a cnt:a",code:`${Ql}
${Pe} {
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
}`})),{name:"compSums",wg:Ye,bind:"P:u cf:r cu:r reg:r racc:a",code:`${or}
${Pe} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Ql}
${Pe} {
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
}`})),{name:"compApply",wg:Ye,bind:"P:u cf:w cu:r reg:r",code:`${vi}
${Pe} {
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
}`},{name:"gasVolumes",wg:Ye,bind:"P:u cf:w cu:r reg:r",code:`${Pe} {
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
}`},{name:"markFaces",wg:Ye,bind:"P:u cu:r ff:w fu:w",code:`${Pe} {
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
}`}],Ee=128,Re="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Zl="@compute @workgroup_size(WG) fn main(@builtin(local_invocation_id) lid3: vec3<u32>)",Jl=`
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
`,ta=`
fn paintedC(x: u32) -> bool { return cu[U_PAINT * P.n + x] != 0u; }
fn bandC(x: u32) -> bool { return cu[U_BAND * P.n + x] != 0u; }
fn ownerC(x: u32) -> u32 { return cu[U_OWNER * P.n + x]; }
fn fsC(x: u32) -> f32 { return cf[F_FS * P.n + x]; }
/* Die Fläche zwischen zwei Nachbarn ist ganz bedeckt (die linke bzw. untere Fläche der Zelle b). */
fn coveredU(b: u32) -> bool { return cf[F_COVL * P.n + b] >= 1.0 - COVERED_EPS; }
fn coveredV(b: u32) -> bool { return cf[F_COVB * P.n + b] >= 1.0 - COVERED_EPS; }
/* Abstand² der Mitte der Zelle x vom Schwerpunkt ihres Körpers. */
fn ownDist(x: u32) -> f32 {
  let o = ownerC(x) - 1u;
  let d = vec2<f32>((f32(ci(x)) + 0.5) * P.dx - bv(o, B_X), (f32(cj(x)) + 0.5) * P.dx - bv(o, B_Y));
  return dot(d, d);
}
/* Welche Zelle eine ganz bedeckte Fläche zwischen a und b schliesst: die mit dem grösseren Anteil — „gleich“ bis auf das Rauschen von f32 (zwei
   halbe Zellen einer Wand quer über zwei Zellen sind 0,4999992 und 0,5000027) die vom Schwerpunkt ihres Körpers weiter entfernte: die äussere
   Hälfte einer Becherwand schliesst auf allen Seiten, die innere bleibt offen wie auf der CPU (bis 2026-10-26 die linke/untere: links schloss
   die äussere, rechts die innere Hälfte). */
fn pickPair(a: u32, b: u32) -> u32 {
  let fa = select(-1.0, fsC(a), ownerC(a) != 0u);
  let fb = select(-1.0, fsC(b), ownerC(b) != 0u);
  if (fa < 0.0 && fb < 0.0) { return NONE; }
  if (fa >= 0.0 && fb >= 0.0 && abs(fb - fa) <= 1e-4) { return select(a, b, ownDist(b) > ownDist(a)); }
  return select(a, b, fb > fa);
}
`,X1=`
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
`,Q1=`
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
`,Z1=[{name:"bPrep",wg:64,bind:"P:u bod:w bgeo:r",code:`${Ht}
${Zl} {
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
}`},{name:"bPush",wg:Ee,bind:"P:u cnt:a bod:r bgeo:r parts:w",code:`${Ht}
${Je}
${ir}
${Re} {
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
    if (!bAwake(b) && bv(b, B_PUSH) == 0.0) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { q.x = pos.x; q.y = pos.y; q.vx = vel.x; q.vy = vel.y; parts[p] = q; }
}`},{name:"bPushB",wg:64,bind:"P:u cnt:a bod:r bgeo:r bubs:w",code:`${Ht}
${Je}
${ir}
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
    if (!bAwake(b) && bv(b, B_PUSH) == 0.0) { continue; }
    if (pos.x < bv(b, B_BX0) - m || pos.x > bv(b, B_BX1) + m || pos.y < bv(b, B_BY0) - m || pos.y > bv(b, B_BY1) + m) { continue; }
    let o = moveOut(b, pos, pos, vec3<f32>(bv(b, B_RX), bv(b, B_RY), bv(b, B_RA)));
    if (!o.hit) { continue; }
    pos = o.p;
    let vn = dot(vel - bodyV(b, pos), o.n);
    if (vn < 0.0) { vel -= vn * o.n; }
    moved = true;
  }
  if (moved) { B.x = pos.x; B.y = pos.y; B.vx = vel.x; B.vy = vel.y; B.site = -1; bubs[k] = B; }
}`},{name:"bCover",wg:Ee,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:w",code:`${Ht}
${Je}
${ir}
${Jl}
${Re} {
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
    /* Eine Heizplatte: ihr Anteil an der Leistung ihrer Gruppe nach dem Volumen (Heat.bodyHeat): ncell · bedecktes Volumen / Volumen; zwei Platten
       derselben Gruppe in einer Zelle zählen zusammen (verschiedene Gruppen: die mit dem grösseren Anteil). */
    if (bv(b, B_HEATER) >= 0.0 && acc > 0.0) {
      let grp = u32(bv(b, B_HEATER)) + 1u;
      let wh = bv(b, B_NCELL) * acc * P.vcell / max(1e-30, bv(b, B_VOL));
      if (grp == hgrp) { hw += wh; hbest += acc; }
      else if (acc > hbest) { hbest = acc; hgrp = grp; hw = wh; }
    }
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
}`},{name:"bClose1",wg:Ee,bind:"P:u bod:r cf:r cu:w",code:`${he}
${ta}
${X1}
${Re} {
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
}`},{name:"bClose2",wg:Ee,bind:"P:u bod:r cf:r cu:w",code:`${he}
${ta}
fn closedNow(x: u32) -> bool { return cu[U_NOW1 * P.n + x] != 0u || paintedC(x); }
${Re} {
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
}`},{name:"bFlip",wg:Ee,bind:"P:u cf:r cu:w at:a cnt:a",code:`${Lc}
${Q1}
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
${Re} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  if (cu[U_PAINT * n + c] != 0u) { return; }
  let was = cu[U_SOLID * n + c] != 0u;
  let now = cu[U_NOW2 * n + c] != 0u;
  if (now && was) {
    /* Gas, das beim Schliessen liegen blieb (C_PARKED: kein freier Nachbar, kein freier Platz im Fenster): zu den freien Nachbarn, sobald es welche
       gibt — auch ausserhalb des Bands (ein Körper, der eingeschlafen ist); sonst fiele es beim Zurückholen aus der Bilanz der CPU. */
    if (cu[U_OWNER * n + c] == 0u || (gasMass(c) <= 0.0 && cf[F_HG * n + c] == 0.0)) { return; }
    var ws = 0.0;
    for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { ws += gasVol(nb); } }
    if (ws > 0.0) { for (var k = 0u; k < 4u; k++) { let nb = acrossB(c, k); if (nb != NONE && freeB(nb)) { moveGasB(c, nb, gasVol(nb) / ws); } } }
    return;
  }
  if (cu[U_BAND * n + c] == 0u) { return; }
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
}`},{name:"bApply",wg:Ee,bind:"P:u cf:w cu:w",code:`${vi}
${Re} {
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
}`},{name:"bStatic",wg:Ee,bind:"P:u bod:r cf:w cu:r",code:`${he}
${Jl}
fn shareAt(i: i32, j: i32) -> f32 {
  if (i < 0) { return select(1.0, 0.0, P.openL != 0u); }
  if (i >= i32(P.nx)) { return select(1.0, 0.0, P.openR != 0u); }
  if (j < 0) { return select(1.0, 0.0, P.openB != 0u); }
  if (j >= i32(P.ny)) { return select(1.0, 0.0, P.openT != 0u); }
  let c = cellOf(i, j);
  return select(min(1.0, cf[F_FS * P.n + c]), 1.0, cu[U_SOLID * P.n + c] != 0u);
}
${Re} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let i = ci(c);
  let j = cj(c);
  if (!inBandM(i, j, 6.0 * P.dx)) { return; }
  let n = P.n;
  let inSolid = cu[U_SOLID * n + c] != 0u;
  /* var, nicht let: mit Laufzeit-Index (naga in Firefox). */
  var K = array<f32, 3>(1.0 / 6.0, 2.0 / 3.0, 1.0 / 6.0);
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
}`},{name:"bPrepEnd",wg:64,bind:"P:u bod:w",code:`${he}
${Zl} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    bod[o + B_OX0] = bod[o + B_BX0]; bod[o + B_OY0] = bod[o + B_BY0]; bod[o + B_OX1] = bod[o + B_BX1]; bod[o + B_OY1] = bod[o + B_BY1];
    if (bAwake(b)) { bod[o + B_RX] = bod[o + B_X]; bod[o + B_RY] = bod[o + B_Y]; bod[o + B_RA] = bod[o + B_A]; }
    bod[o + B_PUSH] = 0.0;
  }
}`},{name:"bFaceL",wg:Ee,bind:"P:u bod:r cu:r ff:w fu:r",code:`${he}
${Fr}
fn wallFace(f: u32) -> bool {
  if (f < P.nu) { let i = f % (P.nx + 1u); return (i == 0u && P.openL == 0u) || (i == P.nx && P.openR == 0u); }
  let j = (f - P.nu) / P.nx;
  return (j == 0u && P.openB == 0u) || (j == P.ny && P.openT == 0u);
}
${Re} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] != 2u || wallFace(f)) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  ff[ffi(FF_UL, f)] = faceVelB(f, b);
}`},{name:"bFaceG",wg:Ee,bind:"P:u bod:r cu:r ff:w fu:r",code:`${he}
${Fr}
${Re} {
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
}`},{name:"bRegVol",wg:Ee,bind:"P:u cf:r cu:r racc:a",code:`${or}
${Re} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) { v.x = (1.0 - cf[F_FS * P.n + c]) * P.vcell; }
  }
  regSum(lid, r, v, vec4<u32>(RA_VSUM, RA_VSUM, RA_VSUM, RA_VSUM));
}`},{name:"bHeaters",wg:256,bind:"P:u bod:r bgeo:r bcell:r hacc:a",code:`${Ht}
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
}`}],ea=o=>o.map(K).join(", "),J1=`
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
const BCON_WT: u32 = ${Sr}u;
const WT_W: u32 = ${Ar}u;
const BCON_LIVE: u32 = ${Tr}u;
const CW: u32 = ${Hf}u;
const MAXC: u32 = ${Us}u;
/* Eine Berührung im Arbeitsspeicher: Kennungen a, b; Teile a, b; Punkte; Normale; Reibung, Rückprall; Block (K und K⁻¹); zwei Punkte zu je 16 Wörtern. */
const CO_IDA: u32 = 0u; const CO_IDB: u32 = 1u; const CO_PA: u32 = 2u; const CO_PB: u32 = 3u; const CO_N: u32 = 4u;
const CO_NX: u32 = 5u; const CO_NY: u32 = 6u; const CO_FR: u32 = 7u; const CO_BO: u32 = 8u; const CO_BLK: u32 = 9u;
const CO_K11: u32 = 10u; const CO_K12: u32 = 11u; const CO_K22: u32 = 12u; const CO_I11: u32 = 13u; const CO_I12: u32 = 14u; const CO_I22: u32 = 15u;
const CO_PT: u32 = 16u;
const PT_X: u32 = 0u; const PT_Y: u32 = 1u; const PT_SEP: u32 = 2u; const PT_ID: u32 = 3u; const PT_JN: u32 = 4u; const PT_JT: u32 = 5u;
const PT_RAX: u32 = 6u; const PT_RAY: u32 = 7u; const PT_RBX: u32 = 8u; const PT_RBY: u32 = 9u; const PT_MN: u32 = 10u; const PT_MT: u32 = 11u;
const PT_BIAS: u32 = 12u; const PT_BOUNCE: u32 = 13u; const PT_FIXED: u32 = 14u; const PT_KICK: u32 = 15u;
const S_FRIC = array<f32, ${ht.length}>(${ea(ht.map(o=>o.friction))});
const S_BOUNCE = array<f32, ${ht.length}>(${ea(ht.map(o=>o.bounce))});
`,tm=`
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
`,em=`
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
`,sm=`
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
`,nm=`
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
`,im=`
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
`,rm=[{name:"bDyn",wg:64,bind:"P:u glob:r cnt:a bod:w bgeo:r bcell:r bcon:w<u32>",code:`${Ht}
${J1}
${tm}
${em}
${sm}
${nm}
${im}
fn speedOf(b: u32) -> f32 { return length(vec2<f32>(bv(b, B_VX), bv(b, B_VY))) + abs(bv(b, B_W)) * bv(b, B_RMAX); }
/* Kein Zuwachs und keine Vorhersage aus früheren Schritten (beim Aufwecken und Einschlafen). */
fn forget(b: u32) {
  let o = b * BS;
  for (var d = 0u; d < 3u; d++) { bod[o + B_PREV + d] = 0.0; bod[o + B_PRED + d] = 0.0; bod[o + B_PNOW + d] = 0.0; bod[o + B_POLD + d] = 0.0; }
}
/* Aufwecken: die zuletzt gemessene mitbewegte Masse bleibt (gemessen wird er erst wieder nach der nächsten Ablesung, BodyStep.select). */
fn wakeB(b: u32) {
  if (!bFree(b) || bv(b, B_ASLEEP) == 0.0) { return; }
  let o = b * BS;
  bod[o + B_ASLEEP] = 0.0;
  bod[o + B_REST] = 0.0;
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
var<private> keys: array<vec2<u32>, ${Us}>;
var<private> order: array<u32, ${Us}>;
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
    /* Gemessen (auch zuletzt, vor dem Einschlafen) oder, nie gemessen, die Schätzung. */
    var m6 = array<f32, 6>(bv(b, B_MA), 0.0, 0.0, bv(b, B_MA), 0.0, bv(b, B_IA));
    if (bv(b, B_MAOK) != 0.0) { for (var d = 0u; d < 6u; d++) { m6[d] = bv(b, B_MA6 + d); } }
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
}`}],nc=128,om=`
const WGM: u32 = ${nc}u;
const NLIST: u32 = 1024u;
var<workgroup> wacc: array<atomic<u32>, 32>;
var<workgroup> wv: array<f32, 40>;
var<workgroup> wlist: array<u32, NLIST>;
var<workgroup> wcount: atomic<u32>;
var<workgroup> wflag: atomic<u32>;
var<workgroup> wopen: u32;
var<workgroup> wstamp: u32;
var<workgroup> wdec: u32;
fn waddF(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&wacc[i]);
  loop {
    let r = atomicCompareExchangeWeak(&wacc[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn wgetF(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&wacc[i])); }
/* Der Wert von Faden 0 für alle (gleichförmig: Verzweigungen mit Barrieren dürfen davon abhängen). */
fn uni(lid: u32, v: u32) -> u32 {
  if (lid == 0u) { wdec = v; }
  let r = workgroupUniformLoad(&wdec);
  workgroupBarrier();
  return r;
}
/* Punkte aller vier Seiten (np je Seite) oder Randzellen (je Seite) der Reihe nach: (Seite, Index); Seite 4: dahinter. */
fn pointAt(np: vec4<u32>, t: u32) -> vec2<u32> {
  var q = t;
  for (var s = 0u; s < 4u; s++) { if (q < np[s]) { return vec2<u32>(s, q); } q -= np[s]; }
  return vec2<u32>(4u, 0u);
}
fn npOf(rq: u32) -> vec4<u32> { return vec4<u32>(sideOf(rq, 0u).np, sideOf(rq, 1u).np, sideOf(rq, 2u).np, sideOf(rq, 3u).np); }
fn sideLen(rq: u32, s: u32) -> f32 { let bx = rBox(rq); return select(bx.z - bx.x, bx.w - bx.y, s < 2u); }
/* Die Grenze, die an der Seite s rückt (Platz in bgeo), und die Dicke der Randreihe dort. */
fn coordAt(rq: u32, s: u32) -> u32 {
  if (s == 0u) { return u32(rv(rq, GR_XO)); }
  if (s == 1u) { return u32(rv(rq, GR_XO)) + u32(rv(rq, GR_NI)); }
  if (s == 2u) { return u32(rv(rq, GR_YO)); }
  return u32(rv(rq, GR_YO)) + u32(rv(rq, GR_NJ));
}
fn rowThick(rq: u32, s: u32) -> f32 {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  if (s == 0u) { return rxs(rq, 1u) - rxs(rq, 0u); }
  if (s == 1u) { return rxs(rq, ni) - rxs(rq, ni - 1u); }
  if (s == 2u) { return rys(rq, 1u) - rys(rq, 0u); }
  return rys(rq, nj) - rys(rq, nj - 1u);
}
/* Die Grenze der Seite s auf v (und das Rechteck mit ihr). */
fn setCoord(rq: u32, s: u32, v: f32) {
  bgeo[coordAt(rq, s)] = v;
  let r = GEO_RECTS + rq * RS;
  if (s == 0u) { bgeo[r + GR_X0] = v; } else if (s == 1u) { bgeo[r + GR_X1] = v; } else if (s == 2u) { bgeo[r + GR_Y0] = v; } else { bgeo[r + GR_Y1] = v; }
}
`,cm=`
fn wantOf(c: u32, s: u32) -> f32 {
  let n = P.n;
  let C = cf[F_MC * n + c];
  let W = cf[F_MW * n + c];
  if (!(C > 0.0) || !(W > 0.0)) { return 0.0; }
  let Tl = cf[F_MCT * n + c] / C;
  let tf = wv[s];
  if (Tl >= tf) { return 0.0; }
  return min(FREEZE_M * W, C * (tf - Tl) / max(1.0, wv[8u + s]));
}
/* Wer die Zelle bekommt: die kleinste Seite, dann der erste Punkt (der grösste Schlüssel). */
fn claimKey(s: u32, q: u32) -> u32 { return ((3u - s) << 24u) | (0xFFFFFFu - min(q, 0xFFFFFEu)); }
fn claimTry(c: u32, s: u32, key: u32) {
  if (wantOf(c, s) > 0.0) { atomicMax(&at[A_MCLAIM * P.n + c], key); atomicOr(&wflag, 1u); }
}
fn claimTake(c: u32, s: u32, key: u32) {
  let want = wantOf(c, s);
  if (!(want > 0.0) || atomicLoad(&at[A_MCLAIM * P.n + c]) != key) { return; }
  cf[F_MFZ * P.n + c] = want;
  cf[F_MHI * P.n + c] = wv[4u + s];
  waddF(20u + s, want);
}
`,lm=`
/* Eine Zelle vor der Seite nimmt Schmelzwasser, wenn sie Flüssigkeit mit Wasserteilchen ist (einmal je Geben). */
fn takerCell(c: u32, stamp: u32) {
  if (c == NONE || cu[U_KIND * P.n + c] != LIQUID) { return; }
  let old = atomicMax(&at[A_MSEEN * P.n + c], stamp);
  if (old >= stamp) { return; }
  let WM = cf[F_MWM * P.n + c];
  if (!(WM > 0.0)) { return; }
  let i = atomicAdd(&wcount, 1u);
  if (i >= NLIST) { return; }
  wlist[i] = c;
  waddF(27u, WM);
}
/* Schmelzwasser ohne Nehmer davor an der Seite a sammeln — vor ihrer Mitte oder, kam es von der aufliegenden Seite src, eine halbe Zelle vor der Ecke zu ihr. */
fn holdM(b: u32, rq: u32, a: u32, m: f32, H: f32, salt: f32, src: u32) {
  let bx = rBox(rq);
  var lx = 0.5 * (bx.x + bx.z);
  var ly = 0.5 * (bx.y + bx.w);
  var nl = vec2<f32>(0.0, 1.0);
  if (a == 0u) { lx = bx.x; nl = vec2<f32>(-1.0, 0.0); } else if (a == 1u) { lx = bx.z; nl = vec2<f32>(1.0, 0.0); }
  else if (a == 2u) { ly = bx.y; nl = vec2<f32>(0.0, -1.0); } else { ly = bx.w; }
  if (src == 2u) { ly = min(bx.w, bx.y + 0.5 * P.dx); } else if (src == 3u) { ly = max(bx.y, bx.w - 0.5 * P.dx); }
  else if (src == 0u) { lx = min(bx.z, bx.x + 0.5 * P.dx); } else if (src == 1u) { lx = max(bx.x, bx.z - 0.5 * P.dx); }
  let o = mo(b) + MLT_PEND + a * PEND_W;
  bmelt[o] += m;
  bmelt[o + 1u] += H;
  bmelt[o + 2u] += salt;
  let w = toWorldB(b, vec2<f32>(lx, ly));
  let nw = rotB(b, nl);
  bmelt[o + 3u] = w.x; bmelt[o + 4u] = w.y; bmelt[o + 5u] = nw.x; bmelt[o + 6u] = nw.y;
}
/*
 * Ein Geben an die Seite a (src 4: die eigene; 0–3: hervorgequollen von dieser aufliegenden Seite): erst die Zellen knapp vor und knapp
 * in der Seite, ohne Nehmer dort auch eine Zelle weiter; nach der Masse der Wasserteilchen in die Sammler der Zellen. Ohne Nehmer: liegt
 * kein Fluid davor (und ist es das eigene Wasser), 1 — es quillt an den Enden hervor; sonst wartet es an der Seite.
 */
fn giveTry(b: u32, rq: u32, a: u32, m: f32, H: f32, salt: f32, src: u32, lid: u32, closed: f32) -> u32 {
  if (lid == 0u) { wstamp += 1u; atomicStore(&wcount, 0u); atomicStore(&wacc[27], 0u); atomicStore(&wflag, 0u); }
  let stamp = uni(lid, wstamp);
  let sd = sideOf(rq, a);
  for (var q = lid; q < sd.np; q += WGM) {
    let p = frontPoint(b, sd, q, closed);
    if (!p.fluid) { continue; }
    atomicOr(&wflag, 1u);
    takerCell(p.out, stamp);
    if (innOk(p)) { takerCell(p.inn, stamp); }
  }
  workgroupBarrier();
  var st = 0u;
  if (lid == 0u) { st = select(2u, 1u, wgetF(27u) > 0.0); }
  st = uni(lid, st);
  if (st == 2u) {
    for (var q = lid; q < sd.np; q += WGM) {
      let p = frontPoint(b, sd, q, closed);
      if (!p.fluid) { continue; }
      takerCell(p.out, stamp);
      if (farOk(b, p)) { takerCell(p.far, stamp); }
      if (innOk(p)) { takerCell(p.inn, stamp); }
    }
    workgroupBarrier();
    var s2 = 4u;
    if (lid == 0u) {
      if (wgetF(27u) > 0.0) { s2 = 1u; } else if (atomicLoad(&wflag) == 0u && src > 3u) { s2 = 3u; }
    }
    st = uni(lid, s2);
  }
  if (st == 1u) {
    let wsum = wgetF(27u);
    let k = min(atomicLoad(&wcount), NLIST);
    for (var i = lid; i < k; i += WGM) {
      let c = wlist[i];
      let fr = cf[F_MWM * P.n + c] / wsum;
      addF_at(A_MGM * P.n + c, fr * m);
      addF_at(A_MGH * P.n + c, fr * H);
      if (salt > 0.0) { addF_at(A_MGS * P.n + c, fr * salt); }
    }
  }
  if (st == 4u && lid == 0u) { holdM(b, rq, a, m, H, salt, src); }
  storageBarrier();
  workgroupBarrier();
  return select(0u, 1u, st == 3u);
}
/* Das Schmelzwasser in wv[24–26] an die Seite s; ohne Fluid davor je zur Hälfte an die beiden Nachbarseiten, an das Ende zu s. */
fn giveTop(b: u32, rq: u32, s: u32, lid: u32, closed: f32) {
  let m = wv[24];
  let H = wv[25];
  let salt = wv[26];
  if (giveTry(b, rq, s, m, H, salt, 4u, lid, closed) == 1u) {
    let a1 = select(0u, 2u, s < 2u);
    giveTry(b, rq, a1, 0.5 * m, 0.5 * H, 0.5 * salt, s, lid, closed);
    giveTry(b, rq, a1 + 1u, 0.5 * m, 0.5 * H, 0.5 * salt, s, lid, closed);
  }
}
/* Die Wärme wv[16 + s] zurück in die Randzellen der Seite s (nach Länge; bodyMelt.giveBack). */
fn giveBackSide(rq: u32, s: u32, lid: u32) {
  let Q = wv[16u + s];
  let len = sideLen(rq, s);
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    if (len > 0.0) { bcell[BC * e.k] += Q * e.len / len; } else if (t == 0u) { bcell[BC * u32(rv(rq, GR_KO))] += Q; }
  }
  storageBarrier();
  workgroupBarrier();
}
`,am=`
/* Die Seite s um wv[12 + s] nach innen (höchstens die Randreihe): die Randzellen verlieren ihre Scheibe; das Schmelzwasser davor (bodyMelt.melt). */
fn meltSide(b: u32, rq: u32, s: u32, lid: u32, rho: f32, e0: f32, closed: f32) {
  if (lid == 0u) {
    let dd = min(wv[12u + s], rowThick(rq, s));
    let old = bgeo[coordAt(rq, s)];
    /* In f32 gerundet: die Scheibe ist, was die Grenze wirklich rückt (sonst stimmten Masse des Körpers und Schmelzwasser nicht überein). */
    let nw = old + select(-dd, dd, s == 0u || s == 2u);
    wv[20] = abs(nw - old);
    wv[21] = nw;
    atomicStore(&wacc[24], 0u); atomicStore(&wacc[25], 0u); atomicStore(&wacc[26], 0u);
  }
  workgroupBarrier();
  let dd = wv[20];
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    if (!(e.vol > 0.0)) { continue; }
    let fr = e.len * dd * P.depth / e.vol;
    let o = BC * e.k;
    let E = bcell[o];
    let F = bcell[o + 1u];
    let K = bcell[o + 2u];
    waddF(24u, fr * E); waddF(25u, fr * F); waddF(26u, fr * K);
    bcell[o] = E - fr * E; bcell[o + 1u] = F - fr * F; bcell[o + 2u] = K - fr * K;
  }
  storageBarrier();
  workgroupBarrier();
  var ok = 0u;
  if (lid == 0u) {
    let m = rho * sideLen(rq, s) * dd * P.depth;
    setCoord(rq, s, wv[21]);
    let Q = wgetF(12u + s);
    if (m > 0.0) {
      addF_cnt(C_MELTED, m);
      wv[24] = m + wgetF(25u) + wgetF(26u);
      wv[25] = wgetF(24u) + m * e0 + Q;
      wv[26] = wgetF(26u);
      ok = 1u;
    } else { wv[16u + s] = Q + wgetF(24u); }
  }
  ok = uni(lid, ok);
  if (ok == 1u) { giveTop(b, rq, s, lid, closed); } else { giveBackSide(rq, s, lid); }
}
/* Die Seite s wächst um die geplante Masse (aus der jetzigen Länge der Seite); die Randzellen bekommen die Scheibe Eis bei T_f (bodyMelt.grow). */
fn growSide(rq: u32, s: u32, lid: u32, rho: f32, cp: f32) {
  if (lid == 0u) {
    let m = wgetF(20u + s);
    let d = m / (rho * P.depth * sideLen(rq, s));
    let old = bgeo[coordAt(rq, s)];
    let nw = old + select(d, -d, s == 0u || s == 2u);
    wv[22] = abs(nw - old);
    wv[23] = nw;
    wv[32] = 1.0;
    addF_cnt(C_FROZEN, m);
  }
  workgroupBarrier();
  let d = wv[22];
  let tf = wv[s];
  let along = alongOf(rq, s);
  for (var t = lid; t < along; t += WGM) {
    let e = edgeCell(rq, s, t);
    bcell[BC * e.k] += rho * e.len * d * P.depth * cp * (tf - T0);
  }
  storageBarrier();
  workgroupBarrier();
  if (lid == 0u) { setCoord(rq, s, wv[23]); }
  storageBarrier();
  workgroupBarrier();
}
/* Ganz geschmolzen: Masse, Energie samt Versatz, Film und Kruste werden Schmelzwasser an der Seite mit der längsten freien Strecke; der Körper ist weg (bodyMelt.tidy). */
fn goneBody(b: u32, rq: u32, lid: u32, rho: f32, e0: f32, closed: f32) {
  if (lid == 0u) { atomicStore(&wacc[28], 0u); atomicStore(&wacc[29], 0u); atomicStore(&wacc[30], 0u); }
  workgroupBarrier();
  let nk = u32(rv(rq, GR_NI)) * u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  for (var k = lid; k < nk; k += WGM) { let o = BC * (ko + k); waddF(28u, bcell[o]); waddF(29u, bcell[o + 1u]); waddF(30u, bcell[o + 2u]); }
  workgroupBarrier();
  if (lid == 0u) {
    let bx = rBox(rq);
    let w = bx.z - bx.x;
    let h = bx.w - bx.y;
    let m = rho * w * h * P.depth;
    addF_cnt(C_MELTED, m);
    wv[24] = m + wgetF(29u) + wgetF(30u);
    wv[25] = wgetF(28u) + m * e0;
    wv[26] = wgetF(30u);
    wv[29] = select(0.0, 2.0, w > h);
  }
  workgroupBarrier();
  giveTop(b, rq, u32(wv[29]), lid, closed);
  if (lid == 0u) {
    let o = b * BS;
    bod[o + B_GONE] = 1.0; bod[o + B_AGAIN] = 1.0; bod[o + B_NCELL] = 0.0; bod[o + B_M] = 0.0;
    bod[o + B_VX] = 0.0; bod[o + B_VY] = 0.0; bod[o + B_W] = 0.0;
  }
  storageBarrier();
  workgroupBarrier();
}
/* Die inneren Zellen neu (gleich grosse Stücke von etwa Δx; regrid): Energie, Film und Kruste nach Fläche aus den alten (über bmelt). */
fn regridBody(b: u32, rq: u32, lid: u32) {
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  let xo = u32(rv(rq, GR_XO));
  let yo = u32(rv(rq, GR_YO));
  let scr = u32(bmelt[0]);
  let nk = ni * nj;
  let sx = scr + 3u * nk;
  let sy = sx + ni + 1u;
  for (var t = lid; t < nk; t += WGM) {
    let o = BC * (ko + t);
    bmelt[scr + 3u * t] = bcell[o]; bmelt[scr + 3u * t + 1u] = bcell[o + 1u]; bmelt[scr + 3u * t + 2u] = bcell[o + 2u];
  }
  for (var t = lid; t <= ni; t += WGM) { bmelt[sx + t] = bgeo[xo + t]; }
  for (var t = lid; t <= nj; t += WGM) { bmelt[sy + t] = bgeo[yo + t]; }
  storageBarrier();
  workgroupBarrier();
  let ni2 = u32(wv[27]);
  let nj2 = u32(wv[28]);
  let bx = rBox(rq);
  for (var t = lid; t <= ni2; t += WGM) { bgeo[xo + t] = select(bx.x + (bx.z - bx.x) * f32(t) / f32(ni2), bx.z, t == ni2); }
  for (var t = lid; t <= nj2; t += WGM) { bgeo[yo + t] = select(bx.y + (bx.w - bx.y) * f32(t) / f32(nj2), bx.w, t == nj2); }
  if (lid == 0u) {
    bgeo[GEO_RECTS + rq * RS + GR_NI] = f32(ni2);
    bgeo[GEO_RECTS + rq * RS + GR_NJ] = f32(nj2);
    bod[b * BS + B_NCELL] = f32(ni2 * nj2);
  }
  storageBarrier();
  workgroupBarrier();
  for (var k = lid; k < ni2 * nj2; k += WGM) {
    let p = k % ni2;
    let q = k / ni2;
    let ax0 = bgeo[xo + p]; let ax1 = bgeo[xo + p + 1u]; let ay0 = bgeo[yo + q]; let ay1 = bgeo[yo + q + 1u];
    var E = 0.0; var F = 0.0; var K = 0.0;
    for (var oq = 0u; oq < nj; oq++) {
      let oy = min(ay1, bmelt[sy + oq + 1u]) - max(ay0, bmelt[sy + oq]);
      if (oy <= 0.0) { continue; }
      for (var op = 0u; op < ni; op++) {
        let ox = min(ax1, bmelt[sx + op + 1u]) - max(ax0, bmelt[sx + op]);
        if (ox <= 0.0) { continue; }
        let share = ox * oy / ((bmelt[sx + op + 1u] - bmelt[sx + op]) * (bmelt[sy + oq + 1u] - bmelt[sy + oq]));
        let ok = scr + 3u * (op + oq * ni);
        E += share * bmelt[ok]; F += share * bmelt[ok + 1u]; K += share * bmelt[ok + 2u];
      }
    }
    let o = BC * (ko + k);
    bcell[o] = E; bcell[o + 1u] = F; bcell[o + 2u] = K; bcell[o + 3u] = f32(rq);
  }
  storageBarrier();
  workgroupBarrier();
}
/* Der Schwerpunkt (die Mitte des Rechtecks) in den Ursprung des Rahmens, die Lage mit (die Welt bleibt); Masse, Trägheit, Hülle, Seiten (Body2D.derive). */
fn deriveBody(b: u32, rq: u32, lid: u32, rho: f32) {
  let bx = rBox(rq);
  let cx = 0.5 * (bx.x + bx.z);
  let cy = 0.5 * (bx.y + bx.w);
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let xo = u32(rv(rq, GR_XO));
  let yo = u32(rv(rq, GR_YO));
  storageBarrier();
  workgroupBarrier();
  for (var t = lid; t <= ni; t += WGM) { bgeo[xo + t] -= cx; }
  for (var t = lid; t <= nj; t += WGM) { bgeo[yo + t] -= cy; }
  storageBarrier();
  workgroupBarrier();
  if (lid == 0u) {
    let x0 = bgeo[xo]; let x1 = bgeo[xo + ni]; let y0 = bgeo[yo]; let y1 = bgeo[yo + nj];
    let r = GEO_RECTS + rq * RS;
    bgeo[r + GR_X0] = x0; bgeo[r + GR_Y0] = y0; bgeo[r + GR_X1] = x1; bgeo[r + GR_Y1] = y1;
    let so = u32(bgeo[GH_SEGS]) + u32(bv(b, B_SO)) * SS;
    for (var s = 0u; s < 4u; s++) {
      bgeo[so + s * SS + GS_T0] = select(x0, y0, s < 2u);
      bgeo[so + s * SS + GS_T1] = select(x1, y1, s < 2u);
    }
    let o = b * BS;
    let c = bod[o + B_COS];
    let sn = bod[o + B_SIN];
    let ox = c * cx - sn * cy;
    let oy = sn * cx + c * cy;
    bod[o + B_X] += ox; bod[o + B_Y] += oy; bod[o + B_RX] += ox; bod[o + B_RY] += oy;
    let w = x1 - x0;
    let h = y1 - y0;
    let m = rho * w * h * P.depth;
    bod[o + B_M] = m;
    bod[o + B_I] = m * (w * w + h * h) / 12.0;
    bod[o + B_RMAX] = 0.5 * sqrt(w * w + h * h);
    bod[o + B_HULLA] = w * h;
    bod[o + B_HULLJ] = w * h * (w * w + h * h) / 12.0;
    bod[o + B_VOL] = w * h * P.depth;
    bod[o + B_AGAIN] = 1.0;
    if (wv[32] != 0.0) { bod[o + B_PUSH] = 1.0; }
    /* Er wacht auf (er sinkt oder steigt, wenn er leichter wird — Bodies.reshaped); seine zuletzt gemessene mitbewegte Masse bleibt (kbodydyn.ts wakeB). */
    if (bod[o + B_PINNED] == 0.0 && bod[o + B_ASLEEP] != 0.0) {
      bod[o + B_ASLEEP] = 0.0; bod[o + B_REST] = 0.0;
      for (var d = 0u; d < 3u; d++) { bod[o + B_PREV + d] = 0.0; bod[o + B_PRED + d] = 0.0; bod[o + B_PNOW + d] = 0.0; bod[o + B_POLD + d] = 0.0; }
    }
  }
  storageBarrier();
  workgroupBarrier();
}
`,fm=`
fn meltBody(b: u32, lid: u32) {
  let n = P.n;
  let rq = rectOf(b, 0u);
  let closed = select(CLOSED_P, REOPEN_F, bFree(b));
  let mb = u32(bv(b, B_MAT)) + 1u;
  let rho = solidRho(mb);
  let cp = solidCp(mb);
  let e0 = bv(b, B_E0);
  if (lid < 32u) { atomicStore(&wacc[lid], 0u); }
  if (lid == 0u) { atomicStore(&wflag, 0u); wv[32] = 0.0; }
  workgroupBarrier();
  let np = npOf(rq);
  let ntot = np.x + np.y + np.z + np.w;
  /* 1. T_f je Seite (freezingAt): Salz und Wasser der Zellen davor, die Wiederholung gleich daneben ausgelassen (fluidFront). */
  for (var t = lid; t < ntot; t += WGM) {
    let sq = pointAt(np, t);
    let s = sq.x;
    let sd = sideOf(rq, s);
    let p = frontPoint(b, sd, sq.y, closed);
    if (!p.fluid) { continue; }
    var lastOut = NONE;
    var lastFar = NONE;
    var lastIn = NONE;
    if (sq.y > 0u) {
      let p1 = frontPoint(b, sd, sq.y - 1u, closed);
      lastOut = p1.out;
      if (p1.fluid) { lastFar = p1.far; lastIn = p1.inn; }
      else {
        var k = sq.y - 1u;
        loop {
          if (k == 0u) { break; }
          k -= 1u;
          let pp = frontPoint(b, sd, k, closed);
          if (pp.fluid) { lastFar = pp.far; lastIn = pp.inn; break; }
        }
      }
    }
    atomicOr(&wflag, 1u << s);
    if (p.out != lastOut) { waddF(s, cf[F_MS * n + p.out]); waddF(4u + s, cf[F_MW * n + p.out]); }
    if (p.far != lastFar && farOk(b, p)) { waddF(s, cf[F_MS * n + p.far]); waddF(4u + s, cf[F_MW * n + p.far]); }
    if (p.inn != lastIn && innOk(p)) { waddF(s, cf[F_MS * n + p.inn]); waddF(4u + s, cf[F_MW * n + p.inn]); }
  }
  workgroupBarrier();
  if (lid == 0u) {
    wopen = atomicLoad(&wflag);
    atomicStore(&wflag, 0u);
    for (var s = 0u; s < 4u; s++) {
      let tf = tfOf(wgetF(s), wgetF(4u + s));
      let hIce = cp * (tf - T0) + e0;
      wv[s] = tf;
      wv[4u + s] = hIce;
      wv[8u + s] = hL(tf) - hIce;
    }
  }
  workgroupBarrier();
  /* 2. Zufuhr je Seite (supplyAt): Σ k (T − T_f)⁺ · Länge über die Zellen knapp davor; Ansprüche auf Anfrieren. */
  for (var t = lid; t < ntot; t += WGM) {
    let sq = pointAt(np, t);
    let s = sq.x;
    let p = frontPoint(b, sideOf(rq, s), sq.y, closed);
    let tf = wv[s];
    if (p.out != NONE) {
      let c = p.out;
      let sol = cu[U_SOLID * n + c];
      var T = cf[F_T * n + c];
      var kc = 0.0;
      if (sol != 0u) { kc = solidK(sol); }
      else if (cf[F_MC * n + c] > 0.0) { T = cf[F_MCT * n + c] / cf[F_MC * n + c]; kc = kL(T); }
      else { kc = kMix(cf[F_MN * n + c], cf[F_MO * n + c], cf[F_MV * n + c], T); }
      if (T > tf) { waddF(8u + s, kc * (T - tf) * p.len); }
    }
    if (p.fluid) {
      let key = claimKey(s, sq.y);
      claimTry(p.out, s, key);
      if (farOk(b, p)) { claimTry(p.far, s, key); }
      if (innOk(p)) { claimTry(p.inn, s, key); }
    }
  }
  workgroupBarrier();
  /* 3. Die Überschüsse über T_f (excess): eine Randzelle an ihre Seiten mit Zufuhr (nach deren Anteil), sonst an die nächste offene (ohne offene: die nächste) Seite. */
  let ni = u32(rv(rq, GR_NI));
  let nj = u32(rv(rq, GR_NJ));
  let ko = u32(rv(rq, GR_KO));
  let open = wopen;
  let tfs = vec4<f32>(wv[0], wv[1], wv[2], wv[3]);
  let lowest = min(min(tfs.x, tfs.y), min(tfs.z, tfs.w));
  let sups = vec4<f32>(wgetF(8u), wgetF(9u), wgetF(10u), wgetF(11u));
  let bx = rBox(rq);
  for (var k = lid; k < ni * nj; k += WGM) {
    let p = k % ni;
    let q = k / ni;
    let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u); let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
    let C = rho * cp * (x1 - x0) * (y1 - y0) * P.depth;
    let o = BC * (ko + k);
    let E = bcell[o];
    let film = bcell[o + 1u];
    let crust = bcell[o + 2u];
    let T = cellTM(E, C, film, crust);
    if (!(T > lowest)) { continue; }
    var cs = vec2<u32>(0u, 0u);
    var cw = vec2<f32>(0.0, 0.0);
    var nn = 0u;
    var ws = 0.0;
    for (var s = 0u; s < 4u; s++) {
      if (nn >= 2u) { break; }
      var edge = false;
      if (s == 0u) { edge = p == 0u; } else if (s == 1u) { edge = p == ni - 1u; } else if (s == 2u) { edge = q == 0u; } else { edge = q == nj - 1u; }
      if (!edge || !(sups[s] > 0.0)) { continue; }
      cs[nn] = s;
      cw[nn] = sups[s];
      ws += sups[s];
      nn += 1u;
    }
    if (nn > 0u) {
      var Ek = E;
      for (var i = 0u; i < nn; i++) {
        let ex = (cw[i] / ws) * (E - solidEnergyM(C, film, crust, tfs[cs[i]]));
        if (!(ex > 0.0)) { continue; }
        Ek -= ex;
        waddF(12u + cs[i], ex);
      }
      bcell[o] = Ek;
      continue;
    }
    let cx = 0.5 * (x0 + x1);
    let cy = 0.5 * (y0 + y1);
    var best = 0u;
    var dist = 1e30;
    for (var s = 0u; s < 4u; s++) {
      if (open != 0u && (open & (1u << s)) == 0u) { continue; }
      var d = cx - bx.x;
      if (s == 1u) { d = bx.z - cx; } else if (s == 2u) { d = cy - bx.y; } else if (s == 3u) { d = bx.w - cy; }
      if (d < dist) { dist = d; best = s; }
    }
    let tf = tfs[best];
    if (!(T > tf)) { continue; }
    let ex = E - solidEnergyM(C, film, crust, tf);
    if (!(ex > 0.0)) { continue; }
    bcell[o] = E - ex;
    waddF(12u + best, ex);
  }
  storageBarrier();
  workgroupBarrier();
  /* 4. Der Nenner je Seite (die Randzellen nach dem Überschuss); wer eine Zelle zum Anfrieren bekam, nimmt sie. */
  let along = vec4<u32>(nj, nj, ni, ni);
  let etot = 2u * (ni + nj);
  for (var t = lid; t < etot; t += WGM) {
    let st = pointAt(along, t);
    let s = st.x;
    let e = edgeCell(rq, s, st.y);
    let o = BC * e.k;
    let T = cellTM(bcell[o], rho * cp * e.vol, bcell[o + 1u], bcell[o + 2u]);
    let tf = wv[s];
    waddF(16u + s, e.len * (wv[8u + s] + cp * (tf - min(tf, T))));
  }
  var claims = 0u;
  if (lid == 0u) { claims = atomicLoad(&wflag); }
  claims = uni(lid, claims);
  if (claims != 0u) {
    for (var t = lid; t < ntot; t += WGM) {
      let sq = pointAt(np, t);
      let s = sq.x;
      let p = frontPoint(b, sideOf(rq, s), sq.y, closed);
      if (!p.fluid) { continue; }
      let key = claimKey(s, sq.y);
      claimTake(p.out, s, key);
      if (farOk(b, p)) { claimTake(p.far, s, key); }
      if (innOk(p)) { claimTake(p.inn, s, key); }
    }
  }
  workgroupBarrier();
  /* 5. Die Züge je Seite: schmelzen (Q und Nenner), sonst die Wärme zurück; anfrieren (geplant). Bits: 1 ein Zug, 4 + s zurück, 8 + 2 s die Züge der Seite. */
  var dec = 0u;
  if (lid == 0u) {
    for (var s = 0u; s < 4u; s++) {
      let Q = wgetF(12u + s);
      let den = wgetF(16u + s);
      var mv = 0u;
      wv[12u + s] = 0.0;
      wv[16u + s] = 0.0;
      if (Q > 0.0 && den > 0.0) { mv = 1u; wv[12u + s] = Q / (rho * P.depth * den); }
      else if (Q > 0.0) { wv[16u + s] = Q; dec |= 1u << (4u + s); }
      if (wgetF(20u + s) > 0.0) { mv |= 2u; }
      dec |= mv << (8u + 2u * s);
      if (mv != 0u) { dec |= 1u; }
    }
  }
  dec = uni(lid, dec);
  for (var s = 0u; s < 4u; s++) { if (((dec >> (4u + s)) & 1u) != 0u) { giveBackSide(rq, s, lid); } }
  if ((dec & 1u) == 0u) { return; }
  for (var s = 0u; s < 4u; s++) {
    let mv = (dec >> (8u + 2u * s)) & 3u;
    if ((mv & 1u) != 0u) { meltSide(b, rq, s, lid, rho, e0, closed); }
    if ((mv & 2u) != 0u) { growSide(rq, s, lid, rho, cp); }
  }
  /* 6. Ordnung: ganz geschmolzen, neue Aufteilung, neuer Schwerpunkt. */
  var td = 0u;
  if (lid == 0u) {
    let bb = rBox(rq);
    let w = bb.z - bb.x;
    let h = bb.w - bb.y;
    let ni1 = u32(rv(rq, GR_NI));
    let nj1 = u32(rv(rq, GR_NJ));
    if (w < GONE_M * P.dx || h < GONE_M * P.dx) { td = 2u; }
    else {
      var rebuild = false;
      for (var s = 0u; s < 4u; s++) {
        let th = rowThick(rq, s);
        if ((th < THIN_M * P.dx && select(nj1, ni1, s < 2u) > 1u) || th > THICK_M * P.dx) { rebuild = true; }
      }
      if (rebuild) {
        let ni2 = max(1u, u32(floor(w / P.dx + 0.5)));
        let nj2 = max(1u, u32(floor(h / P.dx + 0.5)));
        let o = mo(b);
        if (f32(ni2 * nj2) > bmelt[o + MLT_CAPC] || f32(ni2 + 1u) > bmelt[o + MLT_CAPX] || f32(nj2 + 1u) > bmelt[o + MLT_CAPY]) { atomicAdd(&cnt[C_MELTFULL], 1u); }
        else { td = 1u; wv[27] = f32(ni2); wv[28] = f32(nj2); }
      }
    }
  }
  td = uni(lid, td);
  if (td == 2u) { goneBody(b, rq, lid, rho, e0, closed); return; }
  if (td == 1u) { regridBody(b, rq, lid); }
  deriveBody(b, rq, lid, rho);
}
`,um=[{name:"mMelt",wg:nc,bind:"P:u cnt:a bod:w bgeo:w bcell:w bmelt:w cf:w cu:r at:a",code:`${Ht}
${Je}
${Qo}
${Zo}
${h1}
${om}
${cm}
${lm}
${am}
${fm}
@compute @workgroup_size(${nc}) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  let lid = lid3.x;
  if (lid == 0u) { wstamp = 0u; }
  for (var b = 0u; b < P.nbody; b++) {
    var go = 0u;
    if (lid == 0u) { go = select(0u, 1u, bv(b, B_MELT) != 0.0 && !bGone(b)); }
    go = uni(lid, go);
    if (go == 0u) { continue; }
    meltBody(b, lid);
  }
}`}],sa=64,na="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",mn=`
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
`,Lr=`
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
`,dm=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,hm=`
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
`,mm=[{name:"bubNucleate",wg:sa,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${mn}
${Lr}
${na} {
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
}`},{name:"bubAdvance",wg:sa,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${mn}
${Lr}
${dm}
${hm}
${na} {
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
}`}],_s=64,$e="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",pm=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,ia=`
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
`,bm=[{name:"bubTarget",wg:_s,bind:"P:u cnt:a bubs:r btarget:w",code:`${$e} {
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
}`},{name:"bubMerge",wg:_s,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${$e} {
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
}`},{name:"bubMergeFinal",wg:_s,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${mn}
${$e} {
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
}`},{name:"bubVent",wg:_s,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${mn}
${Lr}
${ia}
${$e} {
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
}`},{name:"bubFinish",wg:_s,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${mn}
${Lr}
${pm}
${ia}
${$e} {
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
${$e} {
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
}`},{name:"bubCopyBack",wg:_s,bind:"P:u cnt:a bubs:w bubs2:r",code:`${$e} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:_s,bind:"P:u cnt:a bubs:r at:a",code:`${mn}
${$e} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${$e} {
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
}`}],yo=128,wo="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",gm=`
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
`,vm=[...["viscJacA","viscJacB"].map(o=>{const[t,e]=o==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:o,wg:yo,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${wo} {
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
}`}}),{name:"viscForce",wg:yo,bind:"P:u ff:w fu:r",code:`${wo} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:yo,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${wo} {
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
}`}],ra=`const THETA_MIN: f32 = ${Vo.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,Qi=128,Fs=128,le="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ce=`
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
`,oa=`
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
`,xm=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,ca=1,ym=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${le} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${ca}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${le} {
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
${le} {
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
    pargs[0] = max(1u, (total + ${Qi-1}u) / ${Qi}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${le} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:Fs,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ce}
${xm}
${le} {
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
}`},{name:"classify",wg:Fs,bind:"P:u cf:r cu:w bod:r",code:`${Lc}
${le} {
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
}`},{name:"p2g",wg:Fs,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${oa}
${le} {
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
}`},{name:"liqAssemble",wg:Fs,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${ra}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${le} {
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
}`},{name:"liqPressure",wg:Fs,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${le} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:Fs,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${ra}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${le} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:Fs,bind:"P:u ff:w fu:w",code:`${le} {
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
}`})),{name:"g2p",wg:Qi,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w bod:r bgeo:r",code:`${oa}
${ce}
${Ht}
${Je}
${ir}
${Hh}
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
${gm}
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
${le} {
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
      q.flags = q.flags | ${ca}u;
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
}`},{name:"heatWeights",wg:Qi,bind:"P:u cnt:a cu:r parts:w",code:`${ce}
${le} {
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
}`}],We=128,Ke="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",la=`
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
`,aa=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,fa=`
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
`,wm=[{name:"gasMaxOut",wg:We,bind:"P:u cu:r ff:r cnt:a",code:`${ce}
${Ke} {
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
}`},{name:"gasFlux",wg:We,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${la}
${aa}
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
${Ke} {
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
}`},{name:"gasMove",wg:We,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${la}
${aa}
${ce}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Ke} {
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
}`},{name:"macFwd",wg:We,bind:"P:u glob:r ff:w fu:r",code:`${fa}
${Ke} {
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
}`},{name:"macBack",wg:We,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${fa}
${Ke} {
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
}`},{name:"viscosity",wg:We,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Ke} {
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
}`},{name:"gasAssemble",wg:We,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Ke} {
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
}`},{name:"gasPressure",wg:We,bind:"P:u cf:w cu:r cgv:r",code:`${Ke} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:We,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Ke} {
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
}`}],is=128,rs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",De=`
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
`,Ec=`
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
`,_m=`
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
`,Fm=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:is,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${De}
${rs} {
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
}`})),{name:"applyMass",wg:is,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${De}
${ce}
${Ec}
${rs} {
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
}`},{name:"diffPrep",wg:is,bind:"P:u cf:w cu:w reg:r",code:`${rs} {
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
}`},{name:"diffAssemble",wg:is,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${_m}
${rs} {
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
}`},{name:"diffFaces",wg:is,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${rs} {
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
}`},{name:"diffOut",wg:is,bind:"P:u glob:r cnt:a cf:w cu:r ff:r cgv:r",code:`/* Was die Gaszelle g über ihre Seite k aus der Flüssigkeit verdunsten lässt (genau das F, das diffApply bucht; sonst 0). */
fn evapFrom(g: u32, k: u32) -> f32 {
  let n = P.n;
  if (cu[U_KIND * n + g] != GAS || cu[U_EDGE * n + g] == 0u || !(cf[F_MTOT * n + g] > 0.0)) { return 0.0; }
  let G = cf[(F_BG + k) * n + g];
  if (!(G > 0.0)) { return 0.0; }
  return max(0.0, glob[G_DT] * G * (cf[(F_BY + k) * n + g] - cgv[s0(g)]));
}
${rs} {
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
}`},{name:"diffApply",wg:is,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ce}
${rs} {
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
}`},{name:"latentSrc",wg:is,bind:"P:u glob:r cf:r at:a",code:`${rs} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],ua=[1/6,2/3,1/6];function Pm(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),c=Uint8Array.from(t.kind),l=new Uint8Array(e),a=new Uint8Array(e),u=new Uint32Array(e),f=new Float64Array(e),d=new Float64Array(e),m=Float32Array.from(t.T),p=o.heat.heaters.map(()=>0),h=new Float64Array(Math.max(1,o.regions.count)),g=o.bodies.list,x=new Uint8Array(e);for(let P=0;P<e;P+=1)t.owner[P]!==0&&t.matB[P]!==0&&(t.solid[P]!==0||t.fs[P]>.5)&&(x[P]=1);const y=(P,w)=>{if(x[P]!==0||x[w]!==0)return;const k=t.owner[P]!==0&&t.matB[P]!==0?t.fs[P]:-1,S=t.owner[w]!==0&&t.matB[w]!==0?t.fs[w]:-1;k<0&&S<0||(x[S>k?w:P]=1)};for(let P=0;P<n;P+=1)for(let w=1;w<s;w+=1)t.au[w+P*(s+1)]<=0&&y(w-1+P*s,w+P*s);for(let P=1;P<n;P+=1)for(let w=0;w<s;w+=1)t.av[w+P*s]<=0&&y(w+(P-1)*s,w+P*s);for(let P=0;P<e;P+=1){if(l[P]=t.solid[P],a[P]=t.kind[P],u[P]=t.role[P]===1&&t.heater[P]>=0?t.heater[P]+1:0,f[P]=t.Es[P],d[P]=t.film[P],x[P]===0)continue;const w=t.owner[P],k=t.solid[P]!==0,S=g[w-1],T=t.matB[P]-1,M=ht[T];if(r[P]=1,!k){const q=o.regions.id[P];q>=0&&(h[q]+=(1-t.fs[P])*t.vCell)}l[P]=T+1,a[P]=pt;const O=t.Ts[P]>0?t.Ts[P]:Pc(t.Es[P],t.capB[P],t.film[P],t.crust[P],t.T[P]);f[P]=(M.rho*M.cp*t.vCell+t.crust[P]*gs)*(O-et)+t.film[P]*kt(O),m[P]=O,S!==void 0&&S.heater>=0&&S.heater<p.length&&(u[P]=S.heater+1,p[S.heater]+=1)}for(let P=0;P<e;P+=1)r[P]===0&&u[P]>0&&u[P]<=p.length&&(p[u[P]-1]+=1);const b=(P,w)=>P<0?t.openL?0:1:P>=s?t.openR?0:1:w<0?t.openB?0:1:w>=n?t.openT?0:1:l[P+w*s]!==0?1:0,_=new Float32Array(e),F=new Float32Array(e);for(let P=0;P<n;P+=1)for(let w=0;w<s;w+=1){const k=w+P*s;if(l[k]!==0){_[k]=1;continue}let S=0;for(let T=-1;T<=1;T+=1)for(let M=-1;M<=1;M+=1)S+=ua[M+1]*ua[T+1]*b(w+M,P+T);_[k]=S}const A=4;for(let P=0;P<n;P+=1)for(let w=0;w<s;w+=1){const k=w+P*s,S=l[k]!==0,T=(w+.5)*i,M=(P+.5)*i;let O=A*i;S||(t.openL||(O=Math.min(O,T)),t.openR||(O=Math.min(O,t.w-T)),t.openB||(O=Math.min(O,M)),t.openT||(O=Math.min(O,t.h-M)));for(let q=-A;q<=A;q+=1){const N=P+q;if(!(N<0||N>=n))for(let L=-A;L<=A;L+=1){const R=w+L;if(R<0||R>=s||l[R+N*s]!==0===S)continue;const E=Math.max(0,Math.abs(L)-.5)*i,I=Math.max(0,Math.abs(q)-.5)*i;O=Math.min(O,Math.hypot(E,I))}}F[k]=S?-O:O}return{body:r,kindCpu:c,solid:l,kind:a,hgrp:u,es:f,film:d,T:m,phiS:_,sdf:F,heaterCells:p,vFix:h}}function km(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=ht[t.solid[n]-1],r=Pc(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],e.crust[n],e.T[n]);e.Es[n]=Ro(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const _n=16,da=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;function Am(o){const t=o.grid,e=t.n,s=new Float64Array(e),n=new Float64Array(e),i=new Float64Array(e);for(let r=0;r<e;r+=1){const c=t.mg[lt*e+r],l=t.mg[at*e+r],a=t.mg[Q*e+r];s[r]=c/gt[lt]+l/gt[at]+a/gt[Q],n[r]=c+l+a+t.mfog[r]<=1e-30?18e-6:Na(c,l,a,t.T[r]),i[r]=t.kind[r]===pt||o.gas.vgas[r]<=0?0:s[r]*Ut*t.T[r]/o.regions.pAt(r)}return{nmol:s,mu:n,veos:i}}function Sm(o,t){const e=o.regions,s=Int32Array.from({length:e.count},(a,u)=>u),n=a=>{let u=a;for(;s[u]!==u;)s[u]=s[s[u]],u=s[u];return u},i=(a,u)=>{const f=n(a),d=n(u);f!==d&&(s[Math.max(f,d)]=Math.min(f,d))},r=o.bodies.list;if(t&&r.some(a=>a.free)){const a=o.grid,{nx:u,ny:f,n:d}=a,m=y=>{var b;return a.solid[y]!==0&&a.owner[y]>0&&((b=r[a.owner[y]-1])==null?void 0:b.free)===!0},p=new Uint8Array(d),h=[];for(let y=0;y<d;y+=1){if(p[y]!==0||!m(y))continue;p[y]=1,h.push(y);let b=-1;for(;h.length>0;){const _=h.pop(),F=_%u,A=(_-F)/u;for(let P=0;P<4;P+=1){const w=F+(P===0?-1:P===1?1:0),k=A+(P===2?-1:P===3?1:0);if(w<0||k<0||w>=u||k>=f)continue;const S=w+k*u;if(m(S)){p[S]===0&&(p[S]=1,h.push(S));continue}const T=e.id[S];T<0||(b<0?b=T:i(b,T))}}}const g=o.bodies.cover.faceOwner,x=y=>{var _;const b=g[y];return b>0&&((_=r[b-1])==null?void 0:_.free)===!0};for(let y=0;y<f;y+=1)for(let b=1;b<u;b+=1){const _=b-1+y*u,F=_+1,A=e.id[_],P=e.id[F];A>=0&&P>=0&&A!==P&&a.au[b+y*(u+1)]<=0&&x(b+y*(u+1))&&i(A,P)}for(let y=1;y<f;y+=1)for(let b=0;b<u;b+=1){const _=b+(y-1)*u,F=_+u,A=e.id[_],P=e.id[F];A>=0&&P>=0&&A!==P&&a.av[b+y*u]<=0&&x(a.nu+b+y*u)&&i(A,P)}}const c=new Int32Array(e.count),l=new Map;for(let a=0;a<e.count;a+=1){const u=n(a);let f=l.get(u);f===void 0&&(f=l.size,l.set(u,f)),c[a]=f}return{group:c,count:l.size}}function Tm(o){const t=o.grid,{nx:e,ny:s,n}=t;let i=null,r=null;for(let c=0;c<n;c+=1){if(t.solid[c]===0||t.owner[c]===0)continue;let l=t.mfog[c];for(let d=0;d<Ft;d+=1)l+=t.mg[d*n+c];if(!(l>0)&&t.Hg[c]===0)continue;i??(i=new Int32Array(n).fill(-1)),r??(r=new Int32Array(n));let a=0,u=0;r[u++]=c,i[c]=c;let f=-1;for(;a<u&&f<0;){const d=r[a++],m=d%e,p=(d-m)/e;for(let h=0;h<4&&f<0;h+=1){const g=m+(h===0?-1:h===1?1:0),x=p+(h===2?-1:h===3?1:0);if(g<0||x<0||g>=e||x>=s)continue;const y=g+x*e;i[y]!==c&&(i[y]=c,t.solid[y]===0?f=y:t.owner[y]!==0&&(r[u++]=y))}}f>=0&&o.gas.move(c,f,1)}}class Mm{constructor(t,e){v(this,"stair",null);v(this,"body",!1);v(this,"bodies");v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=P1(s.nx,s.ny);const r=(l,a,u=da)=>{const f=t.buffer(l,4*Math.max(4,a),u);return this.own.push(f),f};this.params=r("params",Rl,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",xn),this.cnt=r("cnt",Os),this.cf=r("cf",ao*i.n),this.cu=r("cu",fo*i.n),this.at=r("at",uo*i.n),this.ff=r("ff",ho*i.nf),this.fu=r("fu",El*i.nf),this.af=r("af",mo*i.nf),this.partsA=r("partsA",Js*i.pcap),this.partsB=r("partsB",Js*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,da|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",tn*i.bcap),this.bubs2=r("bubs2",tn*i.bcap),this.bacc=r("bacc",Yo*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",bo*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Se*i.nreg),this.racc=r("racc",Wo*i.nreg),this.heat=r("heat",Te*i.nheat),this.hacc=r("hacc",Ko*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",Df),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",Wf*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const c=256;this.measGroups=[Math.ceil(i.n/c),Math.ceil(i.pcap/c),Math.ceil(i.bcap/c)],this.meas=r("meas",_n*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64),this.bodies=new Mr(t,e)}get staircase(){return this.stair}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat&&this.bodies.fits(t)}destroy(){this.ctx.release(this.own),this.own.length=0,this.bodies.destroy()}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*Rl),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const c=t.gas.amb;r.set([c[0],c[1],c[2],c[4]],28),r.set([t.ambientY[lt],t.ambientY[at],t.ambientY[Q],St(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let l=0;for(let u=0;u<t.regions.count;u+=1)t.regions.open[u]===0&&(l=1);i[40]=l,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=t.particles.hasOther()?1:0;const a=Td(t.scene.extremes,t.regions.pAmb,Math.abs(t.gy));r.set([a.chf,a.actMax,a.vmax,a.bubCap],44),i.set([this.body?1:0,this.body?this.bodies.nbody:0,this.bodies.layers,0],48),this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(Te*this.d.nheat);s.forEach((i,r)=>{var l;const c=Te*r;n[c+Yt.MODE]=i.mode==="thermostat"?1:0,n[c+Yt.POWER]=i.power,n[c+Yt.TARGET]=i.target,n[c+Yt.ON]=i.on?1:0,n[c+Yt.P]=i.P,n[c+Yt.TMEAN]=i.Tmean,n[c+Yt.INTEGRAL]=i.integral,n[c+Yt.CELLS]=e!==null?e[r]??0:((l=this.stair)==null?void 0:l.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*Te*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n;this.body=tc(t),this.bodies.upload(t);const r=this.body?null:Pm(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r!==null?r.heaterCells:null);const c=t.regions,{group:l,count:a}=Sm(t,this.body),u=new Float64Array(Math.max(1,a)),f=new Int32Array(Math.max(1,a));for(let B=0;B<c.count;B+=1)u[l[B]]+=c.vFluid[B],f[l[B]]+=1;const d=Array.from({length:a},(B,C)=>C).sort((B,C)=>u[C]-u[B]),m=new Int32Array(Math.max(1,a));d.forEach((B,C)=>{m[B]=C}),this.regionMap=new Int32Array(Math.max(1,c.count)),this.regionInv=new Int32Array(Math.max(1,a));for(let B=c.count-1;B>=0;B-=1)this.regionMap[B]=m[l[B]],this.regionInv[m[l[B]]]=B;const p=new Float32Array(Se*s.nreg),h=new Float64Array(Math.max(1,a)),g=new Float64Array(Math.max(1,a));for(let B=0;B<c.count;B+=1){const C=l[B],D=Se*m[C];if(f[C]===1){p[D+Pt.OPEN]=c.open[B],p[D+Pt.VFLUID]=c.vFluid[B]-(r!==null?r.vFix[B]:0),p[D+Pt.P0]=c.p0[B],p[D+Pt.RHOBAR]=c.rhoBar[B],p[D+Pt.VLIQ]=c.vLiq[B],p[D+Pt.VBUB]=c.vBub[B],p[D+Pt.VGAS]=c.vGas[B],p[D+Pt.P0START]=c.p0[B];continue}c.open[B]!==0&&(p[D+Pt.OPEN]=1),p[D+Pt.VFLUID]+=c.vFluid[B],p[D+Pt.VLIQ]+=c.vLiq[B],p[D+Pt.VBUB]+=c.vBub[B],p[D+Pt.VGAS]+=c.vGas[B],h[C]+=c.p0[B]*c.vFluid[B],g[C]+=c.rhoBar[B]*c.vFluid[B]}for(let B=0;B<a;B+=1){if(f[B]===1)continue;const C=Se*m[B];p[C+Pt.P0]=u[B]>0?h[B]/u[B]:t.pRef,p[C+Pt.OPEN]!==0&&(p[C+Pt.P0]=t.regions.pAmb),p[C+Pt.RHOBAR]=u[B]>0?g[B]/u[B]:t.regions.rhoAmb,p[C+Pt.P0START]=p[C+Pt.P0]}e.writeBuffer(this.reg,0,p);const x=new Uint32Array(fo*i);for(let B=0;B<i;B+=1){const C=n.solid[B]!==0&&n.owner[B]===0;r!==null?(x[Dt.KIND*i+B]=r.kind[B],x[Dt.KPREV*i+B]=r.kind[B],x[Dt.SOLID*i+B]=r.solid[B],x[Dt.HGRP*i+B]=r.hgrp[B]):(x[Dt.KIND*i+B]=n.kind[B],x[Dt.KPREV*i+B]=n.kind[B],x[Dt.SOLID*i+B]=n.solid[B],x[Dt.HGRP*i+B]=C&&n.role[B]===1&&n.heater[B]>=0?n.heater[B]+1:0,x[Dt.OWNER*i+B]=n.owner[B],x[Dt.MATB*i+B]=n.matB[B],x[Dt.PAINT*i+B]=C?1:0);const D=c.id[B];x[Dt.RID*i+B]=D<0?po:this.regionMap[D]}e.writeBuffer(this.cu,0,x);const y=new Float32Array(ao*i),b=(B,C,D=0)=>{for(let U=0;U<i;U+=1)y[B*i+U]=C[D+U]};if(b(tt.PHI,n.phi),b(tt.ALPHA,n.alpha),b(tt.ALPHAOLD,n.alpha),b(tt.PL,n.pl),b(tt.PG,n.pg),b(tt.MN,n.mg,lt*i),b(tt.MO,n.mg,at*i),b(tt.MV,n.mg,Q*i),b(tt.MF,n.mfog),b(tt.HG,n.Hg),b(tt.ES,r!==null?r.es:n.Es),b(tt.FILM,r!==null?r.film:n.film),b(tt.T,r!==null?r.T:n.T),b(tt.TL,n.Tl),b(tt.CL,n.Cl),r===null){const B=t.bodies.cover;b(tt.FS,n.fs),b(tt.CAPB,n.capB),b(tt.TSB,n.Ts),b(tt.ESY,B.esSync),b(tt.FSY,B.filmSync),b(tt.KSY,B.crustSync),b(tt.WSUM,B.wsum)}const _=t.gas,F=Am(t);b(tt.VGAS,_.vgas),b(tt.RHO,_.rho),b(tt.NMOL,F.nmol),b(tt.CAP,_.cap),b(tt.MU,F.mu),b(tt.VEOS,F.veos),b(tt.SRCV,_.srcV),b(tt.VEOSMID,F.veos),b(tt.PHIS,r!==null?r.phiS:n.phiS),b(tt.SDF,r!==null?r.sdf:n.sdf),b(tt.PTL,r!==null?r.T:n.T),b(tt.CRUST,n.crust);for(let B=0;B<n.nx;B+=1)y[tt.FLOOR*i+B]=t.salt.floor[B],y[tt.FLOORH*i+B]=t.salt.floorH[B];y.fill(1,tt.AW*i,(tt.AW+1)*i),e.writeBuffer(this.cf,0,y);const A=new Float32Array(uo*i);for(let B=0;B<i;B+=1)A[zo.VOLSRC*i+B]=t.liquid.volSrc[B];e.writeBuffer(this.at,0,A);const P=s.nf,w=new Float32Array(ho*P);for(let B=0;B<s.nu;B+=1)w[ze.UL*P+B]=n.ul[B],w[ze.UG*P+B]=n.ug[B];for(let B=0;B<s.nv;B+=1)w[ze.UL*P+s.nu+B]=n.vl[B],w[ze.UG*P+s.nu+B]=n.vg[B];e.writeBuffer(this.ff,0,w),e.writeBuffer(this.fu,0,new Uint32Array(El*P));const k=new Float32Array(mo*P);for(let B=0;B<s.nu;B+=1)k[B]=t.liquid.fU[B];for(let B=0;B<s.nv;B+=1)k[s.nu+B]=t.liquid.fV[B];e.writeBuffer(this.af,0,k);const S=t.particles,T=t.liquid,M=new ArrayBuffer(4*Js*Math.max(1,S.count)),O=new Float32Array(M),q=new Uint32Array(M),N=new Int32Array(M);for(let B=0;B<S.count;B+=1){const C=Js*B;O.set([S.x[B],S.y[B],S.vx[B],S.vy[B],S.c00[B],S.c01[B],S.c10[B],S.c11[B],S.mass[B],S.h[B],S.T[B],S.rho[B],T.dVp[B]],C),q[C+13]=(S.mat[B]&255)<<8,q[C+14]=S.id[B],N[C+15]=T.bi[B],N[C+16]=T.bj[B];for(let D=0;D<9;D+=1)O[C+17+D]=T.wt[9*B+D];O[C+26]=S.smass[2*B]}S.count>0&&e.writeBuffer(this.partsA,0,M);const L=t.bubbles,R=t.bubbleModel.motionState,E=new ArrayBuffer(4*tn*Math.max(1,L.count)),I=new Float32Array(E),z=new Uint32Array(E),G=new Int32Array(E);for(let B=0;B<L.count;B+=1){const C=tn*B,D=B*ut;I.set([L.x[B],L.y[B],L.z[B],L.vx[B],L.vy[B],L.m[D+lt],L.m[D+at],L.m[D+Q],L.H[B],L.age[B]],C),G[C+10]=L.site[B],I.set([L.r[B],L.V[B],L.pb[B],L.pv[B],L.Tb[B],L.dmdt[B],R.ux0[B],R.uy0[B]],C+11),z[C+19]=L.id[B],z[C+20]=1;for(let U=0;U<de;U+=1)I[C+21+U]=L.force[B*de+U]}L.count>0&&e.writeBuffer(this.bubs,0,E);const X=t.bubbleModel.cavities;this.nsites=X.count;const nt=new ArrayBuffer(4*bo*s.nsites),bt=new Uint32Array(nt),ct=new Float32Array(nt),W=n.nx,H=B=>r!==null?r.solid[B]:n.solid[B];for(let B=0;B<X.count;B+=1){const C=bo*B;let D=X.cell[B],U=X.r[B];const ft=X.body[B]>=0?t.bodies.list[X.body[B]]:void 0;if(ft!==void 0&&(ft.free||pi(ft))&&(U=1e-9),D>=0&&H(D)===0){const it=X.dir[B],vt=it===0?D+1:it===1?D-1:it===2?D+W:D-W;vt>=0&&vt<i&&H(vt)!==0?D=vt:U=1e-9}D<0&&(D=0,U=1e-9),bt.set([D,X.fluid[B],X.dir[B],0],C),ct.set([U,X.s[B],X.z[B],0],C+4)}e.writeBuffer(this.sites,0,nt);const st=new Uint32Array(s.nsites);for(let B=0;B<X.count;B+=1)st[B]=X.bubble[B];e.writeBuffer(this.sbub,0,st);const wt=new Float32Array(xn);wt[hn.DT]=t.dt,wt[hn.TIME]=t.time,wt[hn.RHOREF]=T.rhoRef,e.writeBuffer(this.glob,0,wt);const mt=new Uint32Array(Os),Z=new Float32Array(mt.buffer);mt[V.PCOUNT]=S.count,mt[V.PSORT]=S.count,mt[V.BCOUNT]=L.count,mt[V.NEXTID_B]=Math.max(1,L.nextFree),mt[V.NEXTID_P]=Math.max(1,S.nextFree);const j=t.bubbleModel;mt[V.WATCH]=j.watch>=0?j.watch:po,mt[V.WATCH_FATE]=j.watchFate,j.firstSuperheat!==null&&(Z[V.FIRST_SH]=j.firstSuperheat+1e3,mt[V.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,mt),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(Yo*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Wo*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Ko*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(u=>Math.ceil(u.size/4)*4),n=s.reduce((u,f)=>u+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let c=0;t.forEach((u,f)=>{s[f]>0&&r.copyBufferToBuffer(u.buf,u.offset,i,c,s[f]),c+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const l=i.getMappedRange().slice(0);i.unmap(),i.destroy();const a=[];c=0;for(const u of s)a.push(l.slice(c,c+u)),c+=u;return a}async download(t){const e=this.d,s=e.n,[n,i,r,c,l,a,u,f,d,m]=await this.read([{buf:this.cnt,offset:0,size:4*Os},{buf:this.glob,offset:0,size:4*xn},{buf:this.cf,offset:0,size:4*ao*s},{buf:this.cu,offset:0,size:4*fo*s},{buf:this.at,offset:0,size:4*uo*s},{buf:this.ff,offset:0,size:4*ho*e.nf},{buf:this.af,offset:0,size:4*mo*e.nf},{buf:this.heat,offset:0,size:4*Te*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Se*e.nreg}]),p=new Uint32Array(n),h=Math.min(e.pcap,p[V.PCOUNT]),g=Math.min(e.bcap,p[V.BCOUNT]),[x,y]=await this.read([{buf:this.partsA,offset:0,size:4*Js*Math.max(1,h)},{buf:this.bubs,offset:0,size:4*tn*Math.max(1,g)}]),b=t.grid,_=new Float32Array(r),F=(j,B,C=0)=>{for(let D=0;D<s;D+=1)B[C+D]=_[j*s+D]};F(tt.PHI,b.phi),F(tt.ALPHA,b.alpha),F(tt.PL,b.pl),F(tt.PG,b.pg),F(tt.MN,b.mg,lt*s),F(tt.MO,b.mg,at*s),F(tt.MV,b.mg,Q*s),F(tt.MF,b.mfog),F(tt.HG,b.Hg),F(tt.ES,b.Es),F(tt.FILM,b.film),F(tt.T,b.T),F(tt.TL,b.Tl),F(tt.CL,b.Cl);const A=t.gas;F(tt.VGAS,A.vgas),F(tt.RHO,A.rho),F(tt.NMOL,A.nmol),F(tt.CAP,A.cap),F(tt.MU,A.mu),F(tt.VEOS,A.veos),F(tt.SRCV,A.srcV),F(tt.VEOSMID,A.veosMid),F(tt.CRUST,b.crust);for(let j=0;j<b.nx;j+=1)t.salt.floor[j]=_[tt.FLOOR*s+j],t.salt.floorH[j]=_[tt.FLOORH*s+j];const P=new Uint32Array(c);for(let j=0;j<s;j+=1)b.kind[j]=P[Dt.KIND*s+j];const w=new Float32Array(l);for(let j=0;j<s;j+=1)t.liquid.volSrc[j]=w[zo.VOLSRC*s+j];const k=new Float32Array(a),S=new Float32Array(u),T=e.nf;for(let j=0;j<e.nu;j+=1)b.ul[j]=k[ze.UL*T+j],b.ug[j]=k[ze.UG*T+j],t.liquid.fU[j]=S[j];for(let j=0;j<e.nv;j+=1)b.vl[j]=k[ze.UL*T+e.nu+j],b.vg[j]=k[ze.UG*T+e.nu+j],t.liquid.fV[j]=S[e.nu+j];const M=t.particles,O=t.liquid,q=new Float32Array(x),N=new Uint32Array(x),L=new Int32Array(x);let R=0,E=0;for(let j=0;j<h;j+=1){const B=Js*j;if(N[B+13]&1||!(q[B+8]>0))continue;const C=R;R+=1,M.x[C]=q[B],M.y[C]=q[B+1],M.vx[C]=q[B+2],M.vy[C]=q[B+3],M.c00[C]=q[B+4],M.c01[C]=q[B+5],M.c10[C]=q[B+6],M.c11[C]=q[B+7],M.mass[C]=q[B+8],M.h[C]=q[B+9];const D=q[B+26]>0?q[B+26]:0;M.spc[2*C]=D>0?Si:0,M.spc[2*C+1]=0,M.smass[2*C]=D,M.smass[2*C+1]=0,M.mat[C]=N[B+13]>>>8&255,M.id[C]=N[B+14],M.id[C]>E&&(E=M.id[C]),O.dVp[C]=q[B+12],O.bi[C]=L[B+15],O.bj[C]=L[B+16];for(let U=0;U<9;U+=1)O.wt[9*C+U]=q[B+17+U];M.derive(C)}M.count=R,M.reserveIds(Math.max(p[V.NEXTID_P],E+1)),O.weightsDirty=!0;const I=t.bubbles,z=t.bubbleModel.motionState,G=new Float32Array(y),X=new Uint32Array(y),nt=new Int32Array(y);I.count=0;let bt=0;for(let j=0;j<g;j+=1){const B=tn*j;if(X[B+20]===0)continue;const C=I.count;I.count+=1;const D=C*ut;I.x[C]=G[B],I.y[C]=G[B+1],I.z[C]=G[B+2],I.vx[C]=G[B+3],I.vy[C]=G[B+4];for(let U=0;U<ut;U+=1)I.m[D+U]=0;I.m[D+lt]=G[B+5],I.m[D+at]=G[B+6],I.m[D+Q]=G[B+7],I.H[C]=G[B+8],I.age[C]=G[B+9],I.site[C]=nt[B+10],I.r[C]=G[B+11],I.V[C]=G[B+12],I.pb[C]=G[B+13],I.pv[C]=G[B+14],I.Tb[C]=G[B+15],I.dmdt[C]=G[B+16],z.ux0[C]=G[B+17],z.uy0[C]=G[B+18],I.id[C]=X[B+19],I.id[C]>bt&&(bt=I.id[C]);for(let U=0;U<de;U+=1)I.force[C*de+U]=G[B+21+U]}I.reserveIds(Math.max(p[V.NEXTID_B],bt+1));const ct=t.bubbleModel.cavities,W=new Uint32Array(d);for(let j=0;j<ct.count;j+=1)ct.bubble[j]=W[j];const H=new Float32Array(m);for(let j=0;j<t.regions.count;j+=1){const B=Se*this.regionMap[j];t.regions.p0[j]=H[B+Pt.P0],t.regions.rhoBar[j]=H[B+Pt.RHOBAR]}const st=new Float32Array(f);t.heat.heaters.forEach((j,B)=>{const C=Te*B;j.P=st[C+Yt.P],j.Tmean=st[C+Yt.TMEAN],j.integral=st[C+Yt.INTEGRAL]});const wt=new Float32Array(i);t.dt=wt[hn.DT];const mt=t.bubbleModel;if(mt.watch=p[V.WATCH]===po?-1:p[V.WATCH],!this.body){km(t,this.stair);return}for(let j=0;j<s;j+=1)P[Dt.PAINT*s+j]===0&&(b.solid[j]=P[Dt.SOLID*s+j],b.owner[j]=P[Dt.OWNER*s+j],b.matB[j]=P[Dt.MATB*s+j],b.fs[j]=_[tt.FS*s+j],b.capB[j]=_[tt.CAPB*s+j],b.Ts[j]=_[tt.TSB*s+j]);Tm(t),await this.bodies.download(t,j=>this.read(j));const Z=t.bodies.cover;for(const j of t.bodies.list)j.gone||Z.weigh(j);Z.addAll(),Z.topologyChanged=!0,t.bodies.sync()}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const os=128,te="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Bm=5,ha=30,ma=`
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
`,Cm=[{name:"heaterSums",wg:os,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${te} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${te} {
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
        let kp = power / ${Bm}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${ha}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${ha}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:os,bind:"P:u cnt:a parts:r",code:`${ce}
${te} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:os,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${De}
${ce}
${te} {
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
}`},{name:"heatAssemble",wg:os,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${ma}
${te} {
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
}`},{name:"heatFlux",wg:os,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${ma}
${vi}
${ce}
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
${te} {
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
}`},{name:"heatParts",wg:os,bind:"P:u cnt:a cf:r parts:w",code:`${De}
${te} {
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
}`},{name:"heatShare",wg:os,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${De}
${te} {
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
}`},{name:"pwParts",wg:os,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${te} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${te} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${te} {
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
${te} {
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
  if (lid < 11u) { meas[wid3.x * ${_n}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${te} {
  let lid = lid3.x;
  /* Mit genauen Anteilen auch die Teilchen, die dieser Schritt anhängte (Schmelzwasser, geteilte Teilchen — kbodymelt.ts): sonst fehlte ihr
     Wasser bis zum nächsten Sortieren in der Bilanz. */
  let sorted = cntWG(lid, C_PSORT);
  let all = min(cntWG(lid, C_PCOUNT), P.pcap);
  let count = select(sorted, all, P.bodies != 0u);
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${_n}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${te} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${_n}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${te} {
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
}`}],on=256,Lm=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:on,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${rr}
${Ot} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:on,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${rr}
${Ot} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:on,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Ul}
${rr}
${Ot} {
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
}`},{name:"mgPost",wg:on,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${bi}
${Xe}
const TILE: u32 = 16u;
const HALO: u32 = ${Wt}u;
const TS: u32 = ${16+2*Wt}u;
var<workgroup> sx: array<f32, ${(16+2*Wt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Wt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Wt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Wt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Wt)**2}>;
${Ot} {
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
  for (var k = 0u; k < ${Wt}u; k++) {
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
}`},{name:"mgPreR",wg:on,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${bi}
${Xe}
const TILE: u32 = 12u;
const HALO: u32 = ${Wt+2}u;
const TS: u32 = ${12+2*(Wt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Wt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Wt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Wt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Wt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Wt+2))**2}>;
${Ot} {
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
  for (var k = 0u; k < ${Wt}u; k++) {
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
}`},{name:"mgTail",wg:on,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Ul}
${Xe}
var<workgroup> tx: array<f32, ${fn}>;
var<workgroup> tb: array<f32, ${fn}>;
var<workgroup> tax: array<f32, ${fn}>;
var<workgroup> tay: array<f32, ${fn}>;
var<workgroup> tinv: array<f32, ${fn}>;
var<workgroup> toff: array<u32, ${yn}>;
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
${Ot} {
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
  for (var k = 0u; k < ${Gl}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Gl}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],Ps=128,ks="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",qm=[{name:"flashTs",wg:Ps,bind:"P:u cf:w cu:r reg:r",code:`${ks} {
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
}`},{name:"flashVap",wg:Ps,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${De}
${ks} {
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
}`},{name:"flashParts",wg:Ps,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${De}
${ce}
${Ec}
${ks} {
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
}`},{name:"flashDist",wg:Ps,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ce}
${ks} {
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
}`},{name:"fog",wg:Ps,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${vi}
${ce}
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
${ks} {
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
}`},{name:"spawnWater",wg:Ps,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ks} {
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
}`},{name:"films",wg:Ps,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${ks} {
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
}`}],_o=128,Fo="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Om=`
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
`,Em=`
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
`,Rm=[{name:"saltCryst",wg:_o,bind:"P:u cnt:a cu:r at:a parts:w",code:`${De}
${ce}
${Ec}
${Fo} {
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
}`},{name:"saltSums",wg:_o,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${De}
${Fo} {
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
}`},{name:"saltShare",wg:_o,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${De}
${Om}
${Em}
${Fo} {
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
}`}],$r=`
const VIR = array<vec3<f32>, ${Ri.length}>(${Ri.map(o=>`vec3<f32>(${K(o[0]/255)}, ${K(o[1]/255)}, ${K(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${K(Ri.length-1)};
  let i = min(u32(floor(x)), ${Ri.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,cr="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var Ta;const i0=`
const SOLID_RGB = array<vec3<f32>, ${ht.length}>(${ht.map(o=>{const t=ui(o.color);return`vec3<f32>(${K(t[0]/255)}, ${K(t[1]/255)}, ${K(t[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${ui(((Ta=Gr[0])==null?void 0:Ta.color)??"#f4f3ee").map(o=>K(o/255)).join(", ")});
`,pa=128,ba="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>)",qr=8,ic=16,Im=[{name:"rBodies",wg:pa,bind:"P:u RO:u<ROpt> bod:r bgeo:r bcell:r bq:w be:w",code:`${cr}
${$r}
${i0}
${Ht}
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
${ba} {
  let t = gid.x;
  let ncell = u32(bgeo[GH_NCELL]);
  let nrect = u32(bgeo[GH_NRECT]);
  if (t < ncell) {
    let o = ${qr}u * t;
    let rq = u32(bcell[BC * t + 3u]);
    let b = u32(rv(rq, GR_BODY));
    for (var k = 0u; k < ${qr}u; k++) { bq[o + k] = 0.0; }
    /* Die Reserve eines schmelzenden Körpers (kbodymelt.ts) bleibt ein leeres Viereck. */
    if (!bGone(b) && t - u32(rv(rq, GR_KO)) < u32(rv(rq, GR_NI)) * u32(rv(rq, GR_NJ))) {
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
      if (RO.overlay == 1u) { rgb = viridis((T - T0 - ${K(ie[0])}) / ${K(ie[1]-ie[0])}); }
      else if (RO.overlay != 6u) {
        let base = SOLID_RGB[min(mb, ${ht.length}u) - 1u];
        let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
        rgb = vec3<f32>(base.x + (0.902 - base.x) * glow, base.y * (1.0 - 0.6 * glow), base.z * (1.0 - 0.8 * glow));
        let size = max(1e-6, min(x1 - x0, y1 - y0));
        if (crust > 0.0) { rgb = mix(rgb, CRYSTAL_RGB, min(1.0, sqrt(crust / (${K(xc)} * size * P.depth) / size))); }
      }
      bq[o + 5u] = rgb.x; bq[o + 6u] = rgb.y; bq[o + 7u] = rgb.z;
    }
  }
  if (t < nrect) {
    let o = ${ic}u * t;
    let b = u32(rv(t, GR_BODY));
    for (var k = 0u; k < ${ic}u; k++) { be[o + k] = 0.0; }
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
}`},{name:"rLiqUnder",wg:pa,bind:"P:u bod:r bgeo:r src:r dst:w",code:`${Ht}
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
${ba} {
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
}`}],Nm=`
@group(0) @binding(1) var<storage, read> bq: array<f32>;
struct BO { @builtin(position) pos: vec4<f32>, @location(0) rgb: vec3<f32> }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) q: u32) -> BO {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  let o = ${qr}u * q;
  let l = corner * vec2<f32>(bq[o + 2u], bq[o + 3u]);
  let c = cos(bq[o + 4u]);
  let s = sin(bq[o + 4u]);
  var r: BO;
  r.pos = toClip(vec2<f32>(bq[o], bq[o + 1u]) + vec2<f32>(c * l.x - s * l.y, s * l.x + c * l.y));
  r.rgb = vec3<f32>(bq[o + 5u], bq[o + 6u], bq[o + 7u]);
  return r;
}
@fragment fn fs(i: BO) -> @location(0) vec4<f32> { return vec4<f32>(i.rgb, 1.0); }
`,cn=128,ln="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",jm=.006,Dm={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},Gm=4*1e3*15e-7/(3*2*.07),Um=[{name:"rScale",wg:cn,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${cr}
var<workgroup> m4: array<vec4<f32>, WG>;
${ln} {
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
}`},{name:"rCells",wg:cn,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${cr}
${$r}
${i0}
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${K(xc)} * P.dx * P.depth) / P.dx)); }
${ln} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${K(ie[0])};
  let tspan = ${K(ie[1]-ie[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  /* Mit genauen Anteilen zeichnet sich ein Körper selbst (renderBodies.ts): seine geschlossenen Zellen bleiben leer (wie layers.ts). */
  let ownBody = k == SOLID && P.bodies != 0u && cu[U_OWNER * n + c] != 0u;
  if (ownBody) { cell = vec4<f32>(0.0); }
  else if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${ht.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${K(Gm)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:cn,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${ln} {
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
}`},{name:"rLiqBlurX",wg:cn,bind:"P:u lq:r lq2:w",code:`${ln} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:cn,bind:"P:u lq2:r liquid:t",code:`${ln} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${K(ie[0])}) / ${K(ie[1]-ie[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${K(kc)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:cn,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${cr}
${ln} {
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
}`},...Im],Rn=`
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
`;var Ma;const Po=`${Rn}
${$r}
const OIL_RGB = vec3<f32>(${ui(((Ma=oe[1])==null?void 0:Ma.color)??"#e3b437").map(o=>K(o)).join(", ")});
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
`,Vm=`${Rn}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Hm=`${Rn}
${(qc.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
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
`,$m=`${Rn}
${$r}
${(qc.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
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
  o.t = clamp((parts[p].T - ${K(273.15+ie[0])}) / ${K(ie[1]-ie[0])}, 0.0, 1.0);
  if (R.tint > 1.5) { o.t = clamp(parts[p].s / max(1e-30, parts[p].mass) / ${K(kc)}, 0.0, 1.0); }
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Wm=`${Rn}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,ga=48,ko=256,Km=12;class zm{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"bq");v(this,"be");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",ko*Km,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=p=>t.createBindGroupLayout({entries:p});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(p,h,g,x,y=[])=>{const b=t.createShaderModule({code:p}),F=(await b.getCompilationInfo()).messages.filter(A=>A.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(A=>`${A.lineNum}:${A.linePos} ${A.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[g]}),vertex:{module:b,entryPoint:"vs",buffers:y},fragment:{module:b,entryPoint:h,targets:[{format:this.format,blend:e}]},primitive:{topology:x}})},[r,c,l,a,u,f,d,m]=await Promise.all([i(Po,"fsCells",this.layouts.quad,"triangle-strip"),i(Po,"fsField",this.layouts.quad,"triangle-strip"),i(Po,"fsLiquid",this.layouts.quad,"triangle-strip"),i(Vm,"fs",this.layouts.rect,"triangle-strip"),i(Hm,"fs",this.layouts.store,"triangle-strip"),i($m,"fs",this.layouts.store,"triangle-strip"),i(Wm,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}]),i(`${Rn}${Nm}`,"fs",this.layouts.store,"triangle-strip")]);this.pipes={cells:r,field:c,liquid:l,rect:a,disc:u,point:f,line:d,bquad:m}}ensure(){var f,d,m,p,h,g,x,y;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(b,_)=>s.createTexture({size:[b,_],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(d=this.fieldTex)==null||d.destroy(),(m=this.liquidTex)==null||m.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(p=this.lq)==null||p.destroy(),(h=this.lq2)==null||h.destroy(),(g=this.arrows)==null||g.destroy(),this.lq=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(jm/this.gpu.cpu.grid.dx)),c=r>>1,l=Math.max(1,Math.ceil((t.d.nx-c)/r)),a=Math.max(1,Math.ceil((t.d.ny-c)/r));this.nArrows=l*a,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,l,a]),(x=this.bq)==null||x.destroy(),(y=this.be)==null||y.destroy();const u=t.bodies;this.bq=s.createBuffer({size:4*qr*u.capCells,usage:GPUBufferUsage.STORAGE}),this.be=s.createBuffer({size:4*ic*Math.max(4,Math.ceil(u.capGeo/dn)),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX})}computeGroup(t,e,s=t){let n=this.groups.get(s);if(n===void 0){const i=this.gpu.state;n=this.gpu.ctx.bind(t,{P:i.params,RO:this.ro,cf:i.cf,cu:i.cu,ff:i.ff,reg:i.reg,cnt:i.cnt,parts:i.partsA,ccount:i.ccountB,cstart:i.cstart,bsum:i.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,bod:i.bodies.bod,bgeo:i.bodies.bgeo,bcell:i.bodies.bcell,bq:this.bq,be:this.be,...e}),this.groups.set(s,n)}return n}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:ko*s,size:4*ga}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,c){this.ensure();const l=this.gpu.state,a=this.gpu.ctx,u=this.device.queue;this.roData[0]=Dm[r],u.writeBuffer(this.ro,0,this.roData),t.clearBuffer(l.cnt,4*V.OV_PMAX,16);const f=t.beginComputePass(),d=l.d.n;a.dispatch(f,"rScale",this.computeGroup("rScale",{}),d),a.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),d);const m=l.bodies,p=l.body&&m.ncell>0;if(!c){if(a.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*d),p)for(let F=0;F<2;F+=1)a.dispatch(f,"rLiqUnder",this.computeGroup("rLiqUnder",{src:this.lq,dst:this.lq2},"rLiqUnderA"),4*d),a.dispatch(f,"rLiqUnder",this.computeGroup("rLiqUnder",{src:this.lq2,dst:this.lq},"rLiqUnderB"),4*d);a.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*d),a.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*d)}r==="velocity"&&a.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),p&&a.dispatch(f,"rBodies",this.computeGroup("rBodies",{}),Math.max(m.ncell,m.nrect)),f.end();const h=this.gpu.cpu.grid,g=(F,A,P)=>{const w=new Float32Array(ga),k=new Uint32Array(w.buffer);w.set([e.x0,e.y0,e.x1,e.y1,h.w,h.h,s,n],0),w.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),w.set(A,24),w.set(P,28),w[32]=r==="temperature"?1:r==="salt"?2:0,w[33]=Math.max(1.5,.5*h.dx*s/(e.x1-e.x0)),k[34]=l.d.bcap,k[35]=l.d.pcap,u.writeBuffer(this.rp,ko*F,w)},x=.003;g(0,[0,0,h.w,h.h],[...this.theme.ground,1]),g(1,[0,0,0,0],[0,0,0,0]),g(2,[0,0,0,0],[...this.theme.ink,.85]),g(3,[0,0,0,0],[...this.waterInk,.9]);const y=[];i.left&&y.push([-x,-x,0,h.h+(i.top?x:0)]),i.right&&y.push([h.w,-x,h.w+x,h.h+(i.top?x:0)]),i.bottom&&y.push([-x,-x,h.w+x,0]),i.top&&y.push([-x,h.h,h.w+x,h.h+x]),y.forEach((F,A)=>g(4+A,F,[...this.theme.wall,1])),p&&g(8,[0,0,0,0],[...this.theme.wall,.8]);const b=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),_=this.pipes;b.setPipeline(_.rect),b.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),b.draw(4),c?(b.setPipeline(_.point),b.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:l.partsA})),b.draw(4,l.d.pcap)):(b.setPipeline(_.liquid),b.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),b.draw(4)),b.setPipeline(_.disc),b.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:l.bubs})),b.draw(4,l.d.bcap),b.setPipeline(_.field),b.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),b.draw(4),b.setPipeline(_.cells),b.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),b.draw(4),p&&(b.setPipeline(_.bquad),b.setBindGroup(0,this.drawGroup("d-bodies",this.layouts.store,1,{store:this.bq})),b.draw(4,m.ncell),b.setPipeline(_.line),b.setVertexBuffer(0,this.be),b.setBindGroup(0,this.drawGroup("d-edges",this.layouts.rect,8,{})),b.draw(8*m.nrect)),r==="velocity"&&(b.setPipeline(_.line),b.setVertexBuffer(0,this.arrows),b.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),b.draw(6*this.nArrows),b.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),b.draw(6*this.nArrows,1,6*this.nArrows)),b.setPipeline(_.rect),y.forEach((F,A)=>{b.setBindGroup(0,this.drawGroup(`d-wall${A}`,this.layouts.rect,4+A,{})),b.draw(4)}),b.end()}reset(){this.size="",this.groups.clear()}}const Ym=[..._1,...Lm,...ym,...vm,...Y1,...wm,...mm,...bm,...Fm,...qm,...Rm,...Cm,...Um,...Z1,...z1,...rm,...m1,...um],va=[["heater",V.HEATER_E,"f"],["lossWalls",V.LOSS_WALLS,"f"],["lossOpen",V.LOSS_OPEN,"f"],["escapedEnergy",V.ESC_ENERGY,"f"],["escapedWater",V.ESC_WATER,"f"],["escapedAir",V.ESC_AIR,"f"],["escapedOther",V.ESC_OTHER,"f"],["escapedSalt",V.ESC_SALT,"f"],["crystallized",V.CRYST,"f"],["produced",V.PRODUCED,"f"],["condensed",V.CONDENSED,"f"],["dew",V.DEW,"f"],["fogMade",V.FOGMADE,"f"],["burstVapour",V.BURSTVAP,"f"],["fluxSL",V.FLUX_SL,"f"],["fluxLG",V.FLUX_LG,"f"],["fluxSG",V.FLUX_SG,"f"],["lossSolids",V.LOSS_SOLIDS,"f"],["nucleated",V.NUCLEATED,"u"],["departed",V.DEPARTED,"u"],["merged",V.MERGED,"u"],["burst",V.BURST,"u"],["collapsed",V.COLLAPSED,"u"],["burstCold",V.BURST_COLD,"u"],["burstWarm",V.BURST_WARM,"u"],["collapsedCold",V.COLL_COLD,"u"],["collapsedWarm",V.COLL_WARM,"u"],["releasedGas",V.REL_MASS,"f"],["releases",V.REL_N,"u"],["releaseMisses",V.REL_MISS,"u"],["evapCapped",V.EVAP_CAP,"u"],["bodyWork",V.BODYWORK,"f"],["parked",V.PARKED,"u"],["contFull",V.CONT_FULL,"u"],["melted",V.MELTED,"f"],["frozen",V.FROZEN,"f"],["meltFull",V.MELTFULL,"u"]],xa=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0,releasedGas:0,releases:0,releaseMisses:0,evapCapped:0,bodyWork:0,parked:0,contFull:0,melted:0,frozen:0,meltFull:0}),Xm=24,Ao=256,an=2*qs;class Jn{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"bstep");v(this,"lastBody",null);v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",xa());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"other0",null);v(this,"salt0",null);v(this,"carry",null);v(this,"sealed",!1);v(this,"salty",!1);v(this,"mixed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(qs).fill(0));v(this,"hooks",{cells:(t,e,s)=>this.cells(t,e,s??""),faces:(t,e)=>this.faces(t,e),parts:(t,e)=>this.parts(t,e,"A"),bubs:(t,e)=>this.bubs(t,e),one:(t,e)=>this.one(t,e),run:(t,e,s,n,i)=>{const r=`${e}|run|${n}`;let c=this.groups.get(r);c===void 0&&(c=this.ctx.bind(e,{...this.resources("A"),...i}),this.groups.set(r,c)),this.ctx.dispatch(t,e,c,s)}});this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:an}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*an,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){return Jn.on(await Jn.prepare(),t)}static async prepare(t=[]){const e=await Oc.create(),s=await e.compile([...Ym,...t]);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return e}static on(t,e){return new Jn(t,e)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.bstep!==void 0&&this.bstep.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Mm(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new k1(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp}),this.bstep=new S1(e,this.solver);const s=new Uint32Array(Ao/4*16);for(let n=0;n<16;n+=1)s[Ao/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.lastBody!==null&&this.state.body!==this.lastBody&&this.carryErrors({energy:this.cpu.energyError(),water:this.cpu.waterError(),other:this.cpu.otherError(),salt:this.cpu.saltError()}),this.lastBody=this.state.body,this.bstep.writeSel(),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let s=0;s<this.cpu.regions.count;s+=1)this.cpu.regions.open[s]===0&&(this.sealed=!0);const t=this.ctx.device.createCommandEncoder(),e=t.beginComputePass();this.sort(e,1),this.sort(e,2),e.end(),this.ctx.device.queue.submit([t.finish()])}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,s.escapedOther=e.escapedOther,s.escapedSalt=e.escapedSalt,t.salt.crystallized=e.crystallized,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,s.bodyWork=e.bodyWork,t.melt.melted=e.melted,t.melt.frozen=e.frozen,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*V.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*V.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0,bod:e.bodies.bod,bgeo:e.bodies.bgeo,bcell:e.bodies.bcell,bcon:e.bodies.bcon,bat:e.bodies.bat,bread:e.bodies.bread,bmelt:e.bodies.bmelt};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Ao*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,an,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu,n=this.state.body;let i;if(n&&(i=this.pass(t,e,0),this.bstep.prepare(i,this.hooks),i.end()),i=this.pass(t,e,1),this.sort(i,1),this.mixed&&this.cells(i,"cellHost","B"),this.cells(i,"splat","B"),this.cells(i,"classify"),this.cells(i,"transitions"),this.cells(i,"gasApply"),this.cells(i,"regCells"),this.parts(i,"regParts","B"),this.bubs(i,"regBubs"),n&&this.cells(i,"bRegVol"),this.one(i,"regFinishStart"),this.faces(i,"p2g","B"),n&&this.faces(i,"bFaceL"),this.mixed){for(let r=0;r<Xm;r+=2)this.faces(i,"viscJacA"),this.faces(i,"viscJacB");this.faces(i,"viscForce")}this.cells(i,"liqAssemble"),this.solver.encodeMG(i,Kf,this.itL,!0,!1),this.cells(i,"liqPressure"),this.faces(i,"liqCorrect"),n&&this.bstep.probe(i,this.hooks),this.faces(i,"extrap1"),this.faces(i,"extrap2"),this.parts(i,"g2p","B"),this.sort(i,2),this.parts(i,"heatWeights","A"),i.end(),i=this.pass(t,e,2),this.cells(i,"gasVolumes"),this.faces(i,"markFaces"),n&&this.faces(i,"bFaceG"),this.cells(i,"gasMaxOut");for(let r=0;r<16;r+=1)this.cells(i,"gasFlux","",r),this.cells(i,"gasMove","",r);if(this.cells(i,"gasApplyMid"),this.faces(i,"macFwd"),this.faces(i,"macBack"),this.faces(i,"viscosity"),this.cells(i,"gasAssemble"),this.solver.encodeMG(i,zf,this.itG,!0,!0),this.cells(i,"gasPressure"),this.faces(i,"gasCorrect"),i.end(),i=this.pass(t,e,3),this.cells(i,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(i,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(i,"bubAdvance"),this.bubs(i,"bubTarget"),this.bubs(i,"bubMerge"),this.bubs(i,"bubMergeFinal"),this.bubs(i,"bubVent"),this.bubs(i,"bubFinish"),this.one(i,"bubCompact"),this.bubs(i,"bubCopyBack"),this.parts(i,"applyMass","A"),this.cells(i,"spawnWater","A"),this.cells(i,"gatherPlain","A"),this.bubs(i,"bubAlpha"),this.cells(i,"cellAlpha"),this.cells(i,"gasApply"),i.end(),i=this.pass(t,e,4),this.cells(i,"diffPrep"),this.cells(i,"diffAssemble"),this.solver.encodeMG(i,Xf,this.itD,!1),this.faces(i,"diffFaces"),this.cells(i,"diffOut"),this.cells(i,"diffApply"),this.cells(i,"latentSrc"),this.parts(i,"applyMass","A"),this.cells(i,"spawnWater","A"),this.cells(i,"gatherPlain","A"),this.cells(i,"gasApply"),this.cells(i,"flashTs"),this.cells(i,"flashVap","A"),this.parts(i,"flashParts","A"),this.cells(i,"flashDist"),this.cells(i,"gasApply"),this.cells(i,"fog"),this.cells(i,"films","A"),this.salty&&(this.parts(i,"saltCryst","A"),this.cells(i,"gasApply")),i.end(),i=this.pass(t,e,5),this.cells(i,"heaterSums"),n&&this.one(i,"bHeaters"),this.one(i,"heaterPI"),s.heat.liquidPower!==0&&this.parts(i,"sumCl","A"),this.cells(i,"heatPrep","A"),this.cells(i,"heatAssemble"),this.solver.encodeMG(i,Yf,this.itH,!1),this.cells(i,"heatFlux"),this.parts(i,"heatParts","A"),this.cells(i,"heatShare","A"),this.salty&&(this.cells(i,"saltSums","A"),this.cells(i,"saltShare","A")),i.end(),i=this.pass(t,e,7),this.cells(i,"regCells"),this.parts(i,"regParts","A"),this.bubs(i,"regBubs"),n&&this.cells(i,"bRegVol"),this.one(i,"regFinish"),this.sealed&&(this.cells(i,"compSums"),this.one(i,"compStep0"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStep1"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStepEnd"),this.parts(i,"pwParts","A"),this.bubs(i,"pwBubs")),this.cells(i,"gasEos"),!n){this.one(i,"stepEnd"),i.end();return}i.end(),i=this.pass(t,e,8),this.bstep.finish(i,this.hooks),this.one(i,"stepEnd"),i.end()}layout(){const t=this.state,e=0,s=e+4*Os,n=s+4*xn,i=n+4*Se*t.d.nreg,r=i+4*Te*t.d.nheat,c=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],l=r+4*_n*c,a=l+4*64,u=a+8*an,f=t.body?t.bodies.nbody:0,d=u+4*vn*f;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:l,ts:a,bodies:u,nbody:f,total:d}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(l=>!this.busy.has(l)&&l.size>=n.total);if(i===void 0){const l=this.staging.findIndex(a=>!this.busy.has(a)&&a.size<n.total);if(l>=0&&(this.staging[l].destroy(),this.staging.splice(l,1)),this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),n.nbody>0&&this.bstep.measure(r,this.hooks),r.end(),n.nbody>0&&t.copyBufferToBuffer(s.bodies.bread,0,i,n.bodies,4*vn*n.nbody),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*Os),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*xn),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Se*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*Te*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*an),t.clearBuffer(s.cnt,4*Ol,4*($h-Ol)),t.clearBuffer(s.cnt,4*V.VMAXP,4*4),t.clearBuffer(s.cnt,4*V.ESC_OTHER,4*3),t.clearBuffer(s.cnt,4*V.REL_MASS,4*4),t.clearBuffer(s.cnt,4*V.BODYWORK,4*(V.CONT_FULL+1-V.BODYWORK)),t.clearBuffer(s.cnt,4*V.MELTED,4*(V.MELTFULL+1-V.MELTED)),this.busy.add(i);const c=[];for(let l=0;l<this.cpu.regions.count;l+=1){const a=s.gpuRegion(l);c.includes(a)||c.push(a)}return this.reading.set(i,{version:this.stateVersion,layout:n,regions:c,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,Os),r=new Float32Array(t,n.cnt,Os),c=new Float32Array(t,n.glob,xn),l=new Float32Array(t,n.reg,Se*e.nreg),a=new Float32Array(t,n.heat,Te*e.nheat),u=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[d,m,p]=e.groups,h=(F,A,P)=>{let w=0;for(let k=0;k<A;k+=1)w+=u[(F+k)*_n+P];return w},g=[];for(const F of e.regions){const A=Se*F;g.push({p0:l[A+Pt.P0],sealed:l[A+Pt.OPEN]===0,vGas:l[A+Pt.VGAS],vFluid:l[A+Pt.VFLUID]})}const x=[];for(let F=0;F<e.heaters;F+=1){const A=Te*F;x.push({P:a[A+Yt.P],Tmean:a[A+Yt.TMEAN],integral:a[A+Yt.INTEGRAL],cells:a[A+Yt.CELLS]})}let y=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,an);y=[];for(let A=0;A<qs;A+=1){const P=F[2*A],w=F[2*A+1];y.push(w>P&&P>0n?Number(w-P)/1e6:0)}}const b=r[V.SUM_WM],_={};for(const[F,A,P]of va)_[F]=P==="f"?r[A]:i[A];return{intervals:_,ov:[r[V.OV_PMAX],r[V.OV_VMAX],r[V.OV_VLIQ]],pcount:i[V.PCOUNT],bcount:i[V.BCOUNT],dt:c[hn.DT],stepsSince:i[V.STEPS],simSince:r[V.SIMTIME],itL:i[V.IT_L],itG:i[V.IT_G],itH:i[V.IT_H],itD:i[V.IT_D],capL:i[V.CAP_L],capG:i[V.CAP_G],capH:i[V.CAP_H],capD:i[V.CAP_D],resL:r[V.RES_L],resG:r[V.RES_G],resH:r[V.RES_H],nsub:i[V.NSUBMAX],uMaxG:r[V.UMAXG],waterMass:b,waterT:b>0?r[V.SUM_WMT]/b:0,waterTmax:r[V.TMAX],solids:h(0,d,0),film:h(0,d,1),gas:h(0,d,2),vapour:h(0,d,3),fog:h(0,d,4),air:h(0,d,5),liquidCells:Math.round(h(0,d,6)),gasCells:Math.round(h(0,d,7)),liquidH:h(d,m,0),liquidMass:h(d,m,1),sensible:h(d,m,3),otherMass:h(d,m,4),otherMT:h(d,m,5),saltLiquid:h(d,m,6),crust:h(0,d,8),floor:h(0,d,9),floorH:h(0,d,10),bubH:h(d+m,p,0),bubWater:h(d+m,p,1),bubAir:h(d+m,p,2),regions:g,heaters:x,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[V.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[V.FIRST_SH]!==0?r[V.FIRST_SH]-1e3:null,stageMs:y,vmaxP:r[V.VMAXP],rmaxB:r[V.RMAXB],slowed:i[V.SLOWED],vented:r[V.VENTED],bodies:n.nbody>0?this.state.bodies.parse(t,n.bodies,n.nbody):[],itP:i[V.IT_P],capP:i[V.CAP_P]}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of va)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD,e.slowed+=t.slowed,e.vented+=t.vented;const s=(n,i,r,c,l,a)=>{if(i===0&&r===0)return n;const u=r>0?Math.ceil(n*1.5)+2:i+a;return Math.min(l,Math.max(c,n>u?Math.max(u,n-2):u))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub,this.bstep.adapt(t.itP,t.capP)),this.state.body&&t.bodies.length>0&&this.bstep.select(t.bodies)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),c={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:i.escapedOther,editOther:e.ledger.other,escapedSalt:i.escapedSalt,editSalt:e.ledger.salt,bodyWork:i.bodyWork},l=this.energy0??r.energy,a=this.water0??r.water.total,u=r.energy-l-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),f=r.water.total-a-c.editWater,d=r.other.total-(this.other0??r.other.total)-c.editOther,m=r.salt.total-(this.salt0??r.salt.total)-c.editSalt,p=i.produced+i.burstVapour,h=i.time-this.vapourLast;h>.2&&(this.vapourRate=(p-this.vapourMark)/h,this.vapourMark=p,this.vapourLast=i.time);const g=e.heat.heaters.map((b,_)=>({h:b,k:_,rd:n==null?void 0:n.heaters[_]})).filter(({rd:b,h:_})=>((b==null?void 0:b.cells)??_.cells)>0).map(({h:b,rd:_})=>({group:b.group,P:(_==null?void 0:_.P)??b.P,Tmean:(_==null?void 0:_.Tmean)??b.Tmean,mode:b.mode,power:b.power,target:b.target,on:b.on})),x=(b,_,F)=>({iterations:b,residual:_,capped:F>0}),y=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:x((y==null?void 0:y.itL)??0,(y==null?void 0:y.resL)??0,(y==null?void 0:y.capL)??0),gas:x((y==null?void 0:y.itG)??0,(y==null?void 0:y.resG)??0,(y==null?void 0:y.capG)??0),heat:x((y==null?void 0:y.itH)??0,(y==null?void 0:y.resH)??0,(y==null?void 0:y.capH)??0),gasSubsteps:(y==null?void 0:y.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:(n==null?void 0:n.otherMass)??0,otherT:n!==null&&n.otherMass>0?n.otherMT/n.otherMass:0,saltMass:(n==null?void 0:n.saltLiquid)??0,saltSolid:((n==null?void 0:n.crust)??0)+((n==null?void 0:n.floor)??0),bodies:this.bodyCounts(),heaters:g,regions:((n==null?void 0:n.regions)??[]).map(b=>({p0:b.p0,sealed:b.sealed,vGas:b.vGas})),budget:r,flows:c,energyError:u,waterError:f,otherError:d,saltError:m,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:{...e.extremes.stats(),slowed:i.slowed,vented:i.vented},cpuOnly:i.contFull>0}}bodyCounts(){var r;const t=this.cpu.bodies.list,e=((r=this.last)==null?void 0:r.bodies)??[];if(!this.state.body||e.length===0)return{count:t.filter(c=>!c.gone).length,free:0,awake:0};let s=0,n=0,i=0;for(const c of e)c.gone||(s+=1,c.pinned||(n+=1,c.asleep||(i+=1)));return{count:s,free:n,awake:i}}bodySums(){var a;const t=((a=this.last)==null?void 0:a.bodies)??[];let e=0,s=0,n=0,i=0,r=0,c=0;const l=this.cpu.bodies.list;return t.forEach((u,f)=>{var d;i+=u.pm,r+=u.pH,c+=u.ps,!u.gone&&(e+=u.E+Ls(((d=l[f])==null?void 0:d.mat)??0)*u.m,s+=u.film,n+=u.crust)}),{E:e,film:s,crust:n,ice:t.length>0?y1(this.cpu,t):0,pm:i,pH:r,ps:c}}budget(){const t=this.last,e=this.totals;let s=0;for(const m of(t==null?void 0:t.regions)??[])m.sealed&&(s-=m.p0*m.vFluid);const n=this.bodySums(),i=((t==null?void 0:t.liquidH)??0)+n.pH,r=((t==null?void 0:t.liquidMass)??0)+n.pm,c=((t==null?void 0:t.solids)??0)+((t==null?void 0:t.floorH)??0)+n.E,l=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,u=((t==null?void 0:t.film)??0)+n.film,f={liquid:r,ice:n.ice,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:u,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:r+n.ice+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+u+((t==null?void 0:t.bubWater)??0)+e.escapedWater},d=(t==null?void 0:t.otherMass)??0;return{energy:c+i+l+a+s,solids:c,liquid:i,gas:l,bubbles:a,pv:s,water:f,other:{liquid:d,escaped:e.escapedOther,total:d+e.escapedOther},salt:this.saltBudget(),air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}saltBudget(){const t=this.last,e=this.bodySums(),s=((t==null?void 0:t.saltLiquid)??0)+e.ps,n=((t==null?void 0:t.crust)??0)+e.crust,i=(t==null?void 0:t.floor)??0,r=this.totals.escapedSalt;return{liquid:s,crust:n,grains:0,floor:i,escaped:r,total:s+n+i+r}}resetTotals(){Object.assign(this.totals,xa()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0,this.carry=null}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}carryErrors(t){this.resetBaseline(),this.carry=t}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu,n=this.carry??{energy:0,water:0,other:0,salt:0};this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy+e.bodyWork)-n.energy,this.water0=t.water.total-s.ledger.water-n.water,this.other0=t.other.total-s.ledger.other-n.other,this.salt0=t.salt.total-s.ledger.salt-n.salt,this.carry=null}get tsatAmb(){return St(this.cpu.regions.pAmb)}}function Qm(o){const t=o.cpu,e=t.flows,s=t.phase,n=t.bubbleModel,i=t.extremes.stats();Object.assign(o.totals,{time:t.time,steps:t.steps,heater:e.heater,lossWalls:e.lossWalls,lossOpen:e.lossOpen,escapedEnergy:e.escapedEnergy,escapedWater:e.escapedWater,escapedAir:e.escapedAir,escapedOther:e.escapedOther,escapedSalt:e.escapedSalt,crystallized:t.salt.crystallized,produced:s.produced,condensed:s.condensed,dew:s.dew,fogMade:s.fogMade,burstVapour:n.burstVapour,nucleated:n.nucleated,departed:n.departed,merged:n.merged,burst:n.burst,collapsed:n.collapsed,burstCold:n.burstCold,burstWarm:n.burstWarm,collapsedCold:n.collapsedCold,collapsedWarm:n.collapsedWarm,fluxSL:t.heat.fluxSL,fluxLG:t.heat.fluxLG,fluxSG:t.heat.fluxSG,lossSolids:t.heat.lossSolids,slowed:i.slowed,vented:i.vented,melted:t.melt.melted,frozen:t.melt.frozen}),o.carryErrors({energy:t.energyError(),water:t.waterError(),other:t.otherError(),salt:t.saltError()})}function Zm(o,t,e,s,n){const i=-n,r=-n,c=o+2*n,l=t+2*n,a=Math.max(1e-6,e)/Math.max(1e-6,s);if(c/l>a){const f=c/a;return{x0:i,y0:r-(f-l)/2,x1:i+c,y1:r-(f-l)/2+f}}const u=l*a;return{x0:i-(u-c)/2,y0:r,x1:i-(u-c)/2+u,y1:r+l}}const Mn=self,Bt=o=>Mn.postMessage(o),ya=8,Jm=.1,tp=3,wa=200,ep=.25,_a=273.15;let ot=null,J=null,bs=null,xi=null,ts=null,Fn="",lr=1,ar=1,fr=1,Bn={x0:0,y0:0,x1:1,y1:1},Cn={left:!0,right:!0,bottom:!0,top:!1},Hs=!1,rc=1,Cs="none",r0=!1,us=0,Pn=0,Or=0,So=0,To=!1,yi=0,oc=0,cc=0,lc=0,Fa=!1,Er=0,pn=null,ur=null;const Ts=[],ac=[];let Rr=!1;const kn=[];let Pa=null,Zi=null,ka=0;function ds(){Zi!==null&&clearTimeout(Zi),Zi=setTimeout(()=>{Zi=null,sp()},300)}async function sp(){const o=ot;if(o===null)return;const t=ka+=1;try{const e=_u(o.serialize()),s=await Kc(e,"cpu"),n=await Kc(e,"gpu");Pa??(Pa=Su());const i=await Pa,[r,c]=await Promise.all([i.header(s),i.header(n)]);if(t!==ka||ot!==o)return;const l=c??r;Bt({type:"clip",info:l===null?null:bf(l,pf(gf(o,new vf(o))),c!==null?r:null)})}catch{}}function Rc(){if(ot===null)return;const o=ot.scene.sides;Cn={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Ic(o,t,e){lr=Math.max(1,o),ar=Math.max(1,t),fr=Math.max(.5,Math.min(3,e)),ts!==null&&(ts.width=Math.round(lr*fr),ts.height=Math.round(ar*fr)),ot!==null&&(Bn=Zm(ot.boxW,ot.boxH,lr,ar,.006))}function o0(o){bs!==null&&(bs.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function as(o){ac.push(o),Rr||np()}async function np(){if(J!==null){Rr=!0;try{for(;ac.length>0;){const o=ac.shift();await J.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Bt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{Rr=!1,Pn=performance.now()}}}async function ti(){if(J===null)return;const o=J.ctx.device.createCommandEncoder(),t=J.encodeReadback(o,!1);J.ctx.device.queue.submit([o.finish()]),t!==null&&await J.finishReadback(t,!1),J.baselineFromLast()}function Ir(){return ot===null||!ot.needsCpu()?!1:(Bt({type:"gpu",ok:!1,adapter:Fn,message:"cpu-only",scene:ot.serialize()}),!0)}function wi(o){J!==null&&bs!==null&&J.stateVersion!==o&&bs.reset()}function Mo(){as(async()=>{if(J===null||ot===null||kn.length===0)return;const o=kn.splice(0,kn.length);await ti(),await J.download();for(const e of o){const s=ot.apply(e);s!==null&&s.startsWith("refused")&&Bt({type:"refused",message:s})}if(Ir())return;const t=J.stateVersion;J.upload(),wi(t),ds()})}function ip(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(Cs==="temperature")return[_a+ie[0],_a+ie[1],e];if(Cs==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return Cs==="velocity"?[0,Math.max(.02,t[1]),e]:Cs==="vapour"?[0,.6,e]:Cs==="salt"?[0,kc,e]:[0,1,e]}function rp(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return pn={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:St(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},pn}return pn!==null&&(t.fate===1||t.fate===2)?{...pn,fate:t.fate===1?"burst":"collapsed"}:null}function op(o,t){if(J===null||xi===null)return;if(J.baselineFromLast(),o.intervals.meltFull>0&&as(async()=>{if(J===null)return;await ti(),await J.download();const i=J.stateVersion;J.upload(),wi(i)}),ot!==null&&o.stepsSince>0){ot.extremes.observe(o.rmaxB,o.vmaxP,J.totals.time);const i=ot.extremes.take();i!==null&&(Hs=!0,us=0,Or=0,Bt({type:"extreme",event:i}))}if(J.totals.time>=Er){const i=xi.sample();i!==null&&(Ts.push(i),Ts.length>400&&Ts.splice(0,Ts.length-400),Er=J.totals.time+ep)}const e=Math.max(.001,(t-yi)/1e3),s=(o.stageMs??J.stageMs).reduce((i,r)=>i+r,0),n={engine:J.stats(s),stepsPerSecond:lc/e,simRate:(J.totals.time-oc)/e,fps:cc/e,renderMs:0,mode:"gpu",adapter:Fn,paused:Hs,samples:Ts.splice(0,Ts.length),bubble:rp(o),object:ur!==null&&ot!==null?J.state.body?x1(ot,ur,o.bodies):Vd(ot,ur):null,overlayScale:ip(o)};Bt({type:"stats",stats:n}),cc=0,lc=0,oc=J.totals.time,yi=t}function fc(){var t;const o=performance.now();if(J!==null&&bs!==null&&ts!==null&&ot!==null&&!Rr){const e=J.ctx.device,s=Pn===0?0:Math.min(.1,(o-Pn)/1e3);Pn=o;const n=((t=J.last)==null?void 0:t.dt)??ot.dt;let i=0;Hs?(i=Math.min(ya,Or),Or-=i,us=0):(us=Math.min(us+s*rc,Jm*Math.max(1,rc)),i=So>=tp?0:Math.min(ya,Math.floor(us/Math.max(1e-5,n))),us-=i*n);const r=!To&&o-yi>wa&&(i>0||Hs||o-yi>4*wa),c=e.createCommandEncoder();i>0&&J.encodeSteps(c,i,r);const l=r?J.encodeReadback(c,r&&i>0):null;if(bs.encode(c,Bn,ts.width,ts.height,Cn,Cs,r0),e.queue.submit([c.finish()]),So+=1,e.queue.onSubmittedWorkDone().then(()=>{So-=1}),lc+=i,cc+=1,l!==null){To=!0;const a=i>0;J.finishReadback(l,a).then(u=>{To=!1,u!==null&&op(u,performance.now())})}}typeof Mn.requestAnimationFrame=="function"?Mn.requestAnimationFrame(fc):setTimeout(fc,16)}async function cp(o){ot=new Rh(o.scene);const t=new vf(ot);if(o.resume!==void 0&&xu(gf(ot,t),o.resume),Hs=o.paused===!0,Ir())return;if(ts=o.canvas,ts===null)throw new Error("no OffscreenCanvas");J=await Jn.create(ot),o.resume!==void 0&&(Qm(J),Er=ot.time,oc=ot.time),Fn=await(async()=>{var s;try{const n=await((s=Mn.navigator.gpu)==null?void 0:s.requestAdapter({powerPreference:"high-performance"})),i=n==null?void 0:n.info;return i===void 0?"":[i.vendor,i.architecture,i.description].filter(Boolean).join(" ")}catch{return""}})(),bs=new zm(J,ts),await bs.init(),o0(o.dark),xi=new $f(J),o.resume!==void 0&&xi.copyFrom(t),J.ctx.device.addEventListener("uncapturederror",s=>Bt({type:"error",message:`WebGPU: ${s.error.message}`})),J.ctx.device.lost.then(s=>Bt({type:"gpu",ok:!1,adapter:Fn,message:s.message||s.reason})),Rc(),Ic(o.width,o.height,o.dpr),Bt({type:"gpu",ok:!0,adapter:Fn,message:""}),Bt({type:"ready",offscreen:!0,warnings:ot.warnings,view:Bn,quality:ot.currentQuality,walls:Cn}),o.resume!==void 0&&Bt({type:"live",t:ot.time}),yi=performance.now(),Pn=performance.now(),Fa||(Fa=!0,fc()),ds()}function Bo(){if(J===null||ot===null)return;const o=J.stateVersion;J.cpu=ot,J.rebuild(),J.resetTotals(),wi(o),xi=new $f(J),Er=0,Ts.length=0,us=0,pn=null,Rc(),Ic(lr,ar,fr),Bt({type:"view",view:Bn,walls:Cn}),ds()}Mn.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Bt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&Mn.navigator.gpu!==void 0});break;case"init":cp(t).catch(e=>Bt({type:"gpu",ok:!1,adapter:Fn,message:e instanceof Error?e.message:String(e)}));break;case"resize":Ic(t.width,t.height,t.dpr),Bt({type:"view",view:Bn,walls:Cn});break;case"op":kn.push(t.op),Mo();break;case"addLiquid":kn.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Mo();break;case"addSolid":kn.push({op:"solid",region:t.region,material:t.material,T:t.T}),Mo();break;case"setHeater":ot==null||ot.setHeater(t.group,t.mode,t.power,t.target,t.on),J==null||J.writeHeater(t.group),ds();break;case"setAmbient":ot==null||ot.setAmbient(t.p,t.T,t.rh,t.g,t.air),J==null||J.writeParams(),ds();break;case"setBoundary":as(async()=>{if(J===null||ot===null)return;await ti(),await J.download(),ot.setBoundary(t.side,t.value);const e=J.stateVersion;J.upload(),wi(e),Rc(),Bt({type:"view",view:Bn,walls:Cn}),ds()});break;case"query":as(async()=>{if(J===null||ot===null){Bt({type:"reply",id:t.id,data:null});return}await ti(),await J.download(),Bt({type:"reply",id:t.id,data:ot.query(t.x,t.y)})});break;case"select":pn=null,J==null||J.watch(t.bubble);break;case"overlay":Cs=t.overlay;break;case"particles":r0=t.on;break;case"pause":Hs=t.paused,us=0,Pn=performance.now();break;case"step":Hs&&(Or+=1);break;case"setSpeed":rc=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":ot==null||ot.setExtremes(t.mode),J==null||J.writeParams(),ds();break;case"setQuality":as(async()=>{ot!==null&&(ot.setQuality(t.quality),Bo())});break;case"serialize":J===null?Bt({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null}):as(async()=>{Bt({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null})});break;case"load":as(async()=>{ot!==null&&(ot.load(t.scene),!Ir()&&Bo())});break;case"selectObject":ur=t.object;break;case"editObject":as(async()=>{if(J===null||ot===null){Bt({type:"reply",id:t.id,data:null});return}await ti(),await J.download();const e=Ud(ot,t.object,t.patch);if(Bt({type:"reply",id:t.id,data:e}),Ir())return;if(e.rebuilt){Bo();return}const s=J.stateVersion;J.upload(),wi(s),ds()});break;case"theme":o0(t.dark);break;case"frameDone":break}}catch(e){Bt({type:"error",message:e instanceof Error?e.message:String(e)})}});
