var Gl=Object.defineProperty;var Hl=(o,t,e)=>t in o?Gl(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var v=(o,t,e)=>Hl(o,typeof t!="symbol"?t+"":t,e);const $o=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Ms(o){if(o===null||typeof o!="object")return null;const t=o,e=(c,a)=>{if(!Array.isArray(c)||c.length!==a)return null;const l=c.map($o);return l.every(h=>h!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const c=t.poly.map(a=>e(a,2));if(c.every(a=>a!==null))return{poly:c.map(a=>[a[0],a[1]])}}const i=e(t.line,4),r=$o(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function Ve(o,t,e){if("rect"in o){const[m,p,d,g]=o.rect;return t>=m&&t<=d&&e>=p&&e<=g}if("circle"in o){const[m,p,d]=o.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=d*d}if("poly"in o){const m=o.poly;let p=!1;for(let d=0,g=m.length-1;d<m.length;g=d,d+=1){const[y,w]=m[d],[x,F]=m[g];w>e!=F>e&&t<(x-y)*(e-w)/(F-w)+y&&(p=!p)}return p}const[s,n,i,r]=o.line,c=i-s,a=r-n,l=c*c+a*a,h=l>0?Math.max(0,Math.min(1,((t-s)*c+(e-n)*a)/l)):0,f=t-(s+h*c),u=e-(n+h*a);return f*f+u*u<=.25*o.width*o.width}function fn(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,c,a]=o.circle;return[r-a,c-a,r+a,c+a]}if("poly"in o){let r=1/0,c=1/0,a=-1/0,l=-1/0;for(const[h,f]of o.poly)r=Math.min(r,h),c=Math.min(c,f),a=Math.max(a,h),l=Math.max(l,f);return[r,c,a,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Ps(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}const $l={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Wl=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],Kl=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],zl={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Ql=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var Xl={ambient:$l,species:Wl,solutes:Kl,vapourInAir:zl,solids:Ql};const Rt=8.314462618,er=9.80665,Sn=101325,et=273.15,qi=1602176634e-28,_c=1380649e-29,Ac=602214076e15,kc=88541878128e-22,G=0,st=1,ht=2,at=0,ct=1,Y=2,lt=6,Ft=3,Mt=Xl,Nt=Mt.species[0],un=Mt.species[1],hn=Mt.species[2],gt=new Float64Array(lt);gt[at]=un.molarMass.v;gt[ct]=hn.molarMass.v;gt[Y]=Nt.molarMass.v;un.name,hn.name,Nt.vapour.name;const wo=un.gas.cp.v,bo=hn.gas.cp.v,[Mn,Pn,Ze]=Nt.vapour.cp.linear;function Yl(o,t){return o===Y?Mn+Pn*(t-Ze):o===at?wo:o===ct?bo:0}const is=Nt.liquid.kell.c,Hn=Nt.liquid.cp.table,jt=new Float64Array(Hn.map(o=>o[0])),Dt=new Float64Array(Hn.map(o=>o[1])),ie=new Float64Array(Hn.length);ie[0]=Dt[0]*(jt[0]-et);for(let o=1;o<Hn.length;o+=1)ie[o]=ie[o-1]+.5*(Dt[o]+Dt[o-1])*(jt[o]-jt[o-1]);const $t=Hn.length-1;function Tc(o){if(o<jt[0])return-1;if(o>=jt[$t])return $t;let t=Math.min($t-1,Math.max(0,Math.floor((o-et)/10)));for(;t>0&&o<jt[t];)t-=1;for(;t<$t-1&&o>=jt[t+1];)t+=1;return t}function Me(o){const t=Tc(o);return t<0?Dt[0]:t===$t?Dt[$t]:Dt[t]+(Dt[t+1]-Dt[t])*(o-jt[t])/(jt[t+1]-jt[t])}function _t(o){const t=Tc(o);if(t<0)return ie[0]+Dt[0]*(o-jt[0]);if(t===$t)return ie[$t]+Dt[$t]*(o-jt[$t]);const e=o-jt[t],s=(Dt[t+1]-Dt[t])/(jt[t+1]-jt[t]);return ie[t]+Dt[t]*e+.5*s*e*e}function Sc(o){if(o<ie[0])return jt[0]+(o-ie[0])/Dt[0];if(o>=ie[$t])return jt[$t]+(o-ie[$t])/Dt[$t];let t=Math.min($t-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<ie[t];)t-=1;for(;t<$t-1&&o>=ie[t+1];)t+=1;const e=(Dt[t+1]-Dt[t])/(jt[t+1]-jt[t]),s=o-ie[t],n=Dt[t];return jt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function nn(o){const t=o-et;return(is[0]+t*(is[1]+t*(is[2]+t*(is[3]+t*(is[4]+t*is[5])))))/(1+is[6]*t)}const cr=Nt.liquid.k.poly;function Ln(o){const t=Math.min(150,Math.max(0,o-et));return cr[0]+t*(cr[1]+t*cr[2])}const[Zl,Jl,Wo]=Nt.liquid.mu.vogel;function Fs(o){return Zl*Math.pow(10,Jl/(Math.max(o,Wo+60)-Wo))}const lr=Nt.surfaceTension,tf=Nt.saturation.Tc.v;function $n(o){const t=Math.max(0,1-o/tf);return lr.B*Math.pow(t,lr.mu)*(1+lr.b*t)}const ef=Nt.saturation.hlv100.v,Cn=et+100,Mc=_t(Cn)+ef,sf=Nt.vapour.k.v,nf=Nt.vapour.mu.v;function xt(o){const t=o-Ze,e=Cn-Ze;return Mc+Mn*(o-Cn)+.5*Pn*(t*t-e*e)}function Fo(o){return xt(o)-_t(o)}function re(o,t){return o===Y?xt(t):Yl(o,t)*(t-et)}const fr=un.gas.k.power,ur=hn.gas.k.power,rf=un.gas.mu.sutherland,of=hn.gas.mu.sutherland,hr=Mt.vapourInAir,Pc=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),Lc=150,ji=1001,Wn=o=>{const t=new Float64Array(ji);for(let e=0;e<ji;e+=1)t[e]=o(Lc+e);return t},ys=(o,t)=>{let e=t-Lc;e>0?e>ji-1.001&&(e=ji-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Ko=Wn(o=>fr[0]*Math.pow(o/fr[1],fr[2])),af=Wn(o=>ur[0]*Math.pow(o/ur[1],ur[2])),zo=Wn(o=>Pc(rf,o)),cf=Wn(o=>Pc(of,o)),lf=Wn(o=>hr.D0.v*Math.pow(o/hr.T0.v,hr.exponent.v));function _o(o,t,e,s){const n=o+t+e;return n>0?(o*ys(Ko,s)+t*ys(af,s)+e*sf)/n:ys(Ko,s)}function Cc(o,t,e,s){const n=o+t+e;return n>0?(o*ys(zo,s)+t*ys(cf,s)+e*nf)/n:ys(zo,s)}function ff(o,t){return ys(lf,o)*(Sn/t)}function Oc(o,t,e,s){const n=o*wo+t*bo,i=Cn-Ze,r=.5*e*Pn,c=n+e*Mn;if(c<=0)return et;const a=n*(Ze-et)+e*(Mc+Mn*(Ze-Cn)-.5*Pn*i*i)-s,l=c*c-4*r*a;return Ze+-2*a/(c+Math.sqrt(l>0?l:0))}function Kr(o,t,e,s,n){return o*wo+t*bo+e*(Mn+Pn*(n-Ze))+(s>0?s*Me(n):0)}const uf=Mt.ambient.air.N2.v,hf=Mt.ambient.air.O2.v,qc=Mt.ambient.hExt.v,pt=Mt.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function Hs(o){return pt.findIndex(t=>t.id===o)}const ft=0,jc=Mt.species.slice(3),Qo=[null,...jc.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*et+.5*s*et*et}})],te=[{id:Nt.id,name:Nt.name,short:Nt.liquid.name,color:Nt.liquid.color,volatile:!0,range:[et,et+150]},...jc.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function Ic(o){return te.findIndex(t=>t.id===o)}const Ss=o=>Qo[o]??Qo[1];function Ao(o,t){if(o===ft)return Me(t);const e=Ss(o);return e.cA+e.cB*t}function df(o,t){if(o===ft)return _t(t);const e=Ss(o);return e.cA*t+.5*e.cB*t*t-e.h0}function mf(o,t){if(o===ft)return Sc(t);const e=Ss(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function _s(o,t){if(o===ft)return nn(t);const e=Ss(o);return e.rA+e.rB*t}function Fn(o,t){if(o===ft)return Ln(t);const e=Ss(o);return e.kA+e.kB*t}function On(o,t){if(o===ft)return Fs(t);const e=Ss(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function zs(o,t){return o===ft?$n(t):Ss(o).sigma}Nt.thermo,un.thermo,hn.thermo;const Kn=Mt.species[0].saturation,Pe=Kn.if97.n,Bc=Pe[0],Ec=Pe[1],Rc=Pe[2],Dc=Pe[3],Nc=Pe[4],Vc=Pe[5],Uc=Pe[6],Gc=Pe[7],Hc=Pe[8],zr=Pe[9],_n=Kn.Tc.v,pf=Kn.rhoc.v,Ii=273.15,Ls=Kn.vapourDensity.c;Kn.liquidDensity.b;function sr(o){const t=o<Ii?Ii:o>_n?_n:o,e=t+Hc/(t-zr),s=e*e+Bc*e+Ec,n=Rc*e*e+Dc*e+Nc,i=Vc*e*e+Uc*e+Gc,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+Rc*e+Vc,n=Bc*e*e+Dc*e+Uc,i=Ec*e*e+Nc*e+Gc,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),c=zr+r;return(c-Math.sqrt(c*c-4*(Hc+zr*r)))/2}function $c(o){const e=1-(o<Ii?Ii:o>_n?_n:o)/_n,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,c=r*r*n,a=c*c*s,l=a*c*r*r;return pf*Math.exp(Ls[0]*n+Ls[1]*i+Ls[2]*r+Ls[3]*c+Ls[4]*a+Ls[5]*l)}const Bi=250,Ei=.01,zn=25001,_i=new Float64Array(zn),Ai=new Float64Array(zn);for(let o=0;o<zn;o+=1)_i[o]=sr(Bi+o*Ei),Ai[o]=$c(Bi+o*Ei);function qn(o){const t=(o-Bi)/Ei;if(!(t>=0)||t>=zn-1)return sr(o);const e=t|0;return _i[e]+(t-e)*(_i[e+1]-_i[e])}function ke(o){const t=(o-Bi)/Ei;if(!(t>=0)||t>=zn-1)return $c(o);const e=t|0;return Ai[e]+(t-e)*(Ai[e+1]-Ai[e])}const Wt=Mt.solutes[0],Wc=Mt.species[0],nr=Wc.molarMass.v,Ue=Wt.molarMass.v,gf=Wt.ions.v,Qn=1,ir=Mt.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function Kc(o){return ir.findIndex(t=>t.id===o)}function xf(o){return o>0?o/((1-o)*Ue):0}function zc(o){return o>0?o*Ue/(1+o*Ue):0}const ge=298.15,Xn=Wt.pitzer,vf=Xn.b0.a,yf=Xn.b1.a,wf=Xn.c.a,bf=Xn.b.v,Ff=Xn.alpha.v,ki=Wt.pitzerCold,_f=ki.below.v;function dr(o,t){return o[0]+o[1]*(1/t-1/ge)+o[2]*Math.log(t/ge)+o[3]*(t-ge)+o[4]*(t*t-ge*ge)+o[5]*(1/(t*t)-1/(ge*ge))}const ni=Wt.dielectric.c;function Af(o){const t=o-et;return ni[0]+t*(ni[1]+t*(ni[2]+t*ni[3]))}function kf(o){const t=qi*qi/(4*Math.PI*kc*Af(o)*_c*o);return Math.sqrt(2*Math.PI*Ac*nn(o))*t*Math.sqrt(t)/3}function Tf(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<_f,n=dr(s?ki.b0.a:vf,o),i=dr(s?ki.b1.a:yf,o),r=dr(s?ki.c.a:wf,o);return 1-kf(o)*e/(1+bf*e)+t*(n+i*Math.exp(-Ff*e))+t*t*r}function Ri(o,t){return t>0?Math.exp(-gf*t*Tf(o,t)*nr):1}const Qc=240,Di=221,Xc=.05,Qe=181;let mr=null;function Sf(){if(mr!==null)return mr;const o=new Float64Array(Di*Qe);for(let t=0;t<Di;t+=1)for(let e=0;e<Qe;e+=1)o[t*Qe+e]=Ri(Qc+t,e*Xc);return mr=o,o}function Yc(o,t){if(!(t>0))return 1;const e=t/Xc;if(e>=Qe-1)return Ri(o,t);const s=Sf();let n=o-Qc;n>0?n>Di-1.000001&&(n=Di-1.000001):n=0;const i=n|0,r=e|0,c=n-i,a=e-r,l=i*Qe+r,h=s[l]+a*(s[l+1]-s[l]),f=s[l+Qe]+a*(s[l+Qe+1]-s[l+Qe]);return h+c*(f-h)}function ko(o,t){let e=kt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(o/Yc(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const rr=Wc.fusion,oe=rr.T.v,To=rr.h.v,Mf=rr.cpIce.v;rr.rhoIce.v;function Pf(o){const t=Me(oe)-Mf;return nr/Rt*((To-t*oe)*(1/oe-1/o)+t*Math.log(o/oe))}const Lf=Wt.eutectic.T.v,Cf=Wt.eutectic.w.v;function Zc(o){if(!(o>0))return oe;if(zc(o)>=Cf)return Lf;const t=s=>Math.log(Ri(s,o))-Pf(s);let e=oe+Math.log(Ri(oe,o))*Rt*oe*oe/(nr*To);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return oe;if(Math.abs(r)<1e-9)break}return e}const He=Wt.solubility.table;function Of(o){if(o<=He[0][0])return He[0][1];for(let t=1;t<He.length;t+=1)if(o<=He[t][0]){const[e,s]=He[t-1],[n,i]=He[t];return s+(i-s)*(o-e)/(n-e)}return He[He.length-1][1]}function Jc(o){return zc(Of(o))}const tl=Wt.solid.rho.v,ss=Wt.solid.cp.v;function Yn(o){return ss*(o-et)}const mn=Wt.density.laliberte;function qf(o,t){const e=o-et,s=e+mn[4];return(mn[0]*t+mn[1])*Math.exp(1e-6*s*s)/(t+mn[2]+mn[3]*e)}function or(o,t){return t>0?1/((1-t)/nn(o)+t/qf(o,t)):nn(o)}const dn=Wt.cp.laliberte,ar=dn[0],jf=dn[1],If=dn[2],jn=dn[3],So=dn[4],In=dn[5],As=Wt.cp.range.lo,Ni=Wt.cp.range.hi,ws=.5,De=Math.round((Ni-As)/ws)+1,Jt=new Float64Array(De),Bn=new Float64Array(De);for(let o=0;o<De;o+=1){const t=As+o*ws-et;Jt[o]=Math.exp(jf*t+If*Math.exp(.01*t))}Bn[0]=Jt[0]*(As-et);for(let o=1;o<De;o+=1)Bn[o]=Bn[o-1]+.5*(Jt[o-1]+Jt[o])*ws;function el(o){if(o<=As)return Jt[0];if(o>=Ni)return Jt[De-1];const t=(o-As)/ws,e=Math.min(De-2,t|0);return Jt[e]+(t-e)*(Jt[e+1]-Jt[e])}function Zn(o){if(o<=As)return Jt[0]*(o-et);if(o>=Ni)return Bn[De-1]+Jt[De-1]*(o-Ni);const t=(o-As)/ws,e=Math.min(De-2,t|0),s=(t-e)*ws;return Bn[e]+Jt[e]*s+.5*(Jt[e+1]-Jt[e])*s*s/ws}const Mo=o=>1e3*ar*o*Math.exp(jn*o),Po=o=>1e3*So*Math.pow(o,In+1),Lo=Wt.dHsol.v/Ue+Yn(ge)-1e3*ar*Zn(ge);function sl(o,t){return t>0?(1-t)*_t(o)+t*Lo+Mo(t)*Zn(o)+Po(t)*(o-et):_t(o)}function Bf(o,t){return t>0?(1-t)*Me(o)+Mo(t)*el(o)+Po(t):Me(o)}function Ef(o,t,e){if(!(t>0))return Sc(o);const s=Mo(t),n=Po(t),i=t*Lo,r=1-t;let c=e>200&&e<900?e:et+(o-i)/(4e3*r+800*t);for(let a=0;a<30;a+=1){const h=(r*_t(c)+i+s*Zn(c)+n*(c-et)-o)/(r*Me(c)+s*el(c)+n);if(c-=h,Math.abs(h)<1e-8)break}return c}function Xo(o,t){const e=Math.exp(jn*t),s=1e3*ar*e*(t+(1-t)*(1+jn*t)),n=t>0?1e3*So*Math.pow(t,In)*(t+(1-t)*(In+1)):0;return Lo+s*Zn(o)+n*(o-et)}const Rf=Wt.diffusivity.v,Df=Fs(ge);function Qr(o){return Rf*(o/ge)*Df/Fs(o)}function Qs(o,t){return t>0?_t(o)-1e3*ar*jn*t*t*Math.exp(jn*t)*Zn(o)-1e3*So*In*Math.pow(t,In+1)*(o-et):_t(o)}var yc;const Te=[{id:"NaCl",rho:tl,cp:ss,color:((yc=ir[0])==null?void 0:yc.color)??"#f4f3ee",dissolves:!0,repose:34}];function nl(o){return Te.findIndex(t=>t.id===o)}const Nf=.58,Vf=5e-4;class Uf{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"m");v(this,"m0");v(this,"N");v(this,"T");v(this,"mat");v(this,"dry");v(this,"wet");v(this,"id");this.cap=t,this.x=new Float64Array(t),this.y=new Float64Array(t),this.vx=new Float64Array(t),this.vy=new Float64Array(t),this.m=new Float64Array(t),this.m0=new Float64Array(t),this.N=new Float64Array(t),this.T=new Float64Array(t),this.mat=new Uint8Array(t),this.dry=new Uint8Array(t),this.wet=new Float64Array(t),this.id=new Uint32Array(t)}add(t,e,s,n,i,r){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.m[c]=s,this.m0[c]=s,this.N[c]=n,this.T[c]=i,this.mat[c]=r,this.dry[c]=1,this.wet[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,c}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.m[t]=this.m[e],this.m0[t]=this.m0[e],this.N[t]=this.N[e],this.T[t]=this.T[e],this.mat[t]=this.mat[e],this.dry[t]=this.dry[e],this.wet[t]=this.wet[e],this.id[t]=this.id[e]),this.count=e}rho(t){return Te[this.mat[t]].rho}cp(t){return Te[this.mat[t]].cp}diameter(t){return Math.cbrt(6*this.m[t]/(this.N[t]*Math.PI*this.rho(t)))}enthalpy(t){return this.m[t]*this.cp(t)*(this.T[t]-et)}totals(){let t=0,e=0;for(let s=0;s<this.count;s+=1)Te[this.mat[s]].dissolves&&(t+=this.m[s]),e+=this.enthalpy(s);return{salt:t,energy:e}}clear(){this.count=0}}const Xr="recreatio/lab2d",Gf=o=>o==="ask"||o==="compute"||o==="normalize",Hf={"very-high":.001,high:.002,medium:.003},$f=o=>o==="very-high"||o==="high"||o==="medium",Wf=16e4,rn=o=>o.op==="body"||o.op==="beaker"||o.op==="hotplate";function pn(o){return typeof o!="string"?"":o.trim().replace(/\s+/g,"-").replace(/[^\p{L}\p{N}_-]/gu,"").slice(0,40)}const yt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Ot=(o,t,e)=>Math.min(e,Math.max(t,o)),ms=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},ii=(o,t)=>o==="wall"||o==="open"?o:t,Yo=.25*er,pr=2*er;function Zo(o){const t={};let e=0;for(const[s,n]of Object.entries(ms(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Kf(o,t,e){const s=ms(o),n=et+yt(s.T,20),i=r=>{const c=typeof s.material=="string"?s.material:r;return Hs(c)>=0?c:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Ms(s.region);if(r===null)break;const c=s.phase==="gas"?"gas":"liquid",a=Zo(s.composition),l=u=>c==="gas"?u==="N2"||u==="O2"||u==="H2O":Ic(u)>=0||Kc(u)>=0,h={};for(const[u,m]of Object.entries(a))l(u)?h[u]=m:t.push(`ops[${e}]: unknown ${c} "${u}" dropped`);const f=Object.keys(h).length>0?Zo(h):c==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:c,T:n,composition:f}}case"erase":{const r=Ms(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Ot(yt(s.dx,0),-1,1),c=Ot(yt(s.dy,0),-1,1),a=pn(s.id);if(a!=="")return{op:"move",region:null,id:a,dx:r,dy:c};const l=Ms(s.region);if(l===null)break;return{op:"move",region:l,id:null,dx:r,dy:c}}case"remove":{const r=pn(s.id);if(r==="")break;return{op:"remove",id:r}}case"solid":{const r=Ms(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",id:pn(s.id),x:yt(s.x,.1),y:yt(s.y,0),w:Ot(yt(s.w,.07),.01,1),h:Ot(yt(s.h,.09),.01,1),wall:Ot(yt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Ot(yt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",id:pn(s.id),x:yt(s.x,.1),y:yt(s.y,0),w:Ot(yt(s.w,.12),.005,1),h:Ot(yt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Ot(yt(s.power,40),0,2e3),target:et+Ot(yt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Ot(yt(s.angle,0),-180,180)};case"body":{const r=Ms(s.region);if(r===null)break;return{op:"body",id:pn(s.id),region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Ot(yt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:yt(s.x,0),y:yt(s.y,0),pinned:s.pinned!==!1};case"grains":{const r=Ms(s.region);if(r===null)break;const c=typeof s.material=="string"&&nl(s.material)>=0;return s.material!==void 0&&!c&&t.push(`ops[${e}]: unknown grains "${String(s.material)}", using NaCl`),{op:"grains",region:r,material:c?s.material:"NaCl",d:Ot(yt(s.d,Vf),5e-5,.005),T:n}}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function il(o,t,e=new Set){const s=new Set(e);for(const i of o)rn(i)&&s.add(i.id);let n=1;for(;s.has(`${t}-${n}`);)n+=1;return`${t}-${n}`}function zf(o,t){const e=new Set;for(const r of o)rn(r)&&r.id!==""&&e.add(r.id);const s=new Set,n=r=>il([],r,new Set([...s,...e])),i=[];return o.forEach((r,c)=>{if(rn(r)){let a=r.id;if(a==="")a=n(r.op);else if(s.has(a)){const l=n(r.op);t.push(`ops[${c}]: the name "${a}" is used twice, renamed to "${l}"`),a=l}s.add(a),i.push({...r,id:a});return}if(r.op==="remove"||r.op==="move"&&r.id!==null){const a=r.id;if(!s.has(a)){t.push(`ops[${c}]: no object "${a}" before this step`);return}}i.push(r)}),i}function Ti(o,t={}){const e=ms(o),s=[];e.format!==void 0&&e.format!==Xr&&s.push(`format "${String(e.format)}" is not ${Xr}`);const n=ms(e.box),i=ms(e.ambient),r=ms(i.air),c=ms(e.sides),a=yt(i.g,er),l=t.harness===!0?Ot(a,0,pr):Ot(a,Yo,pr);l!==a&&s.push(`ambient.g ${a} m/s² is outside ${Yo.toFixed(2)}–${pr.toFixed(2)}, using ${l.toFixed(2)}`);const h=yt(r.N2,.7676),f=yt(r.O2,.2324),u=h+f>0?h+f:1,m=[];Array.isArray(e.ops)&&e.ops.forEach((d,g)=>{const y=Kf(d,s,g);y!==null&&m.push(y)});const p=zf(m,s);return{scene:{seed:Math.floor(yt(e.seed,1))>>>0,box:{w:Ot(yt(n.w,.2),.02,.6),h:Ot(yt(n.h,.15),.02,.4),depth:Ot(yt(n.depth,.01),.002,.05)},ambient:{p:Ot(yt(i.p,Sn/1e3),20,400)*1e3,T:et+Ot(yt(i.T,20),-20,100),rh:Ot(yt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,h)/u,O2:Math.max(0,f)/u}},sides:{left:ii(c.left,"wall"),right:ii(c.right,"wall"),bottom:ii(c.bottom,"wall"),top:ii(c.top,"open")},quality:$f(e.quality)?e.quality:"high",extremes:Gf(e.extremes)?e.extremes:"ask",ops:p},warnings:s}}const It=(o,t=6)=>Number(o.toFixed(t));function Qf(o){switch(o.op){case"fill":return{op:"fill",region:Ps(o.region),composition:{...o.composition},phase:o.phase,T:It(o.T-et,3)};case"erase":return{op:"erase",region:Ps(o.region)};case"move":return o.id!==null||o.region===null?{op:"move",id:o.id??"",dx:It(o.dx),dy:It(o.dy)}:{op:"move",region:Ps(o.region),dx:It(o.dx),dy:It(o.dy)};case"remove":return{op:"remove",id:o.id};case"solid":return{op:"solid",region:Ps(o.region),material:o.material,T:It(o.T-et,3)};case"beaker":return{op:"beaker",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:It(o.T-et,3),...o.lid?{lid:!0}:{},...Jo(o)};case"hotplate":return{op:"hotplate",id:o.id,x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:It(o.target-et,3),on:o.on,T:It(o.T-et,3),...Jo(o)};case"body":return{op:"body",id:o.id,region:Ps(o.region),material:o.material,T:It(o.T-et,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:It(o.angle,4)}:{}};case"pin":return{op:"pin",x:It(o.x),y:It(o.y),pinned:o.pinned};case"grains":return{op:"grains",region:Ps(o.region),material:o.material,d:It(o.d,7),T:It(o.T-et,3)}}}const Jo=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:It(o.angle,4)}:{}});function rl(o){return{format:Xr,version:1,seed:o.seed,box:{...o.box},ambient:{p:It(o.ambient.p/1e3,4),T:It(o.ambient.T-et,3),rh:o.ambient.rh,g:It(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,...o.extremes!=="ask"?{extremes:o.extremes}:{},ops:o.ops.map(Qf)}}function Xf(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,c)=>(r[0]-i[0])*(c[1]-i[1])-(r[1]-i[1])*(c[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const Yf=1e-6;function Ge(o){var t;return((t=pt[o])==null?void 0:t.id)==="ice"?oe:NaN}function bn(o){return Ge(o)>0?_t(oe)-pt[o].cp*(oe-et)-To:0}function Yr(o,t,e,s){return(o+e*ss)*(s-et)+t*_t(s)}function Co(o,t,e,s,n){const i=t+s*ss;if(!(i>0))return n;if(e<=0)return et+o/i;let r=n>100?n:et+o/i;for(let c=0;c<3;c+=1)r-=(i*(r-et)+e*_t(r)-o)/(i+e*Me(r));return r}class Bt{constructor(t,e,s,n){v(this,"mat",0);v(this,"heater",-1);v(this,"nr",0);v(this,"xs",[]);v(this,"ys",[]);v(this,"ni",new Int32Array(0));v(this,"nj",new Int32Array(0));v(this,"off",new Int32Array(0));v(this,"ncell",0);v(this,"E",new Float64Array(0));v(this,"film",new Float64Array(0));v(this,"crust",new Float64Array(0));v(this,"x",0);v(this,"y",0);v(this,"a",0);v(this,"vx",0);v(this,"vy",0);v(this,"w",0);v(this,"ux",0);v(this,"uy",0);v(this,"uw",0);v(this,"m",0);v(this,"I",0);v(this,"ma",0);v(this,"Ia",0);v(this,"ma6",new Float64Array(6));v(this,"maOk",!1);v(this,"pinned",!0);v(this,"asleep",!0);v(this,"gone",!1);v(this,"rest",0);v(this,"rx",0);v(this,"ry",0);v(this,"ra",0);v(this,"rmax",0);v(this,"hullA",0);v(this,"hullJ",0);v(this,"nseg",0);v(this,"segR",new Int32Array(0));v(this,"segS",new Uint8Array(0));v(this,"segT0",new Float64Array(0));v(this,"segT1",new Float64Array(0));v(this,"nw",0);v(this,"wk",new Int32Array(0));v(this,"wc",new Int32Array(0));v(this,"ww",new Float64Array(0));v(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,c,a=-1){const l=new Bt(t,e,s,n);l.mat=i,l.heater=a;const h=[],f=[];for(const[m,p,d,g]of r)!(d>m)||!(g>p)||(h.push(Bt.splits(m,d,s)),f.push(Bt.splits(p,g,s)));l.setRects(h,f);const u=pt[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=u.rho*u.cp*l.cellVolume(m)*(c-et);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=pt[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return Co(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],c=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[c])continue;let a=0;for(;a<r-1&&t>n[a+1];)a+=1;let l=0;for(;l<c-1&&e>i[l+1];)l+=1;return this.off[s]+a+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=bn(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=pt[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const f=Math.cos(this.a),u=Math.sin(this.a),m=f*e-u*s,p=u*e+f*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const c=[];for(let f=0;f<this.nr;f+=1){const[u,m,p,d]=this.bounds(f),g=p-u,y=d-m,w=t*g*y*this.depth,x=.5*(u+p),F=.5*(m+d);n+=w,i+=w*((g*g+y*y)/12+x*x+F*F);for(const[_,T]of[[u,m],[p,m],[p,d],[u,d]])c.push([_,T]),r=Math.max(r,Math.hypot(_,T))}this.m=n,this.I=i,this.rmax=r;const a=Xf(c);let l=0,h=0;for(let f=0;f<a.length;f+=1){const[u,m]=a[f],[p,d]=a[(f+1)%a.length],g=u*d-p*m;l+=g/2,h+=g*(u*u+u*p+p*p+m*m+m*d+d*d)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(h),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,c,a]=this.bounds(n),l=(c-i)*(a-r);e+=l,s+=l*(t===0?.5*(i+c):.5*(r+a))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=Yf*this.dx;for(let r=0;r<this.nr;r+=1){const[c,a,l,h]=this.bounds(r);for(let f=0;f<4;f+=1){const u=f<2,m=f===0?c:f===1?l:f===2?a:h;let p=[u?[a,h]:[c,l]];for(let d=0;d<this.nr&&p.length>0;d+=1){if(d===r)continue;const[g,y,w,x]=this.bounds(d);if(!(f===0?Math.abs(w-m)<=i:f===1?Math.abs(g-m)<=i:f===2?Math.abs(x-m)<=i:Math.abs(y-m)<=i))continue;const _=u?y:g,T=u?x:w,A=[];for(const[b,k]of p){if(T<=b||_>=k){A.push([b,k]);continue}_>b&&A.push([b,_]),T<k&&A.push([T,k])}p=A}for(const[d,g]of p)g-d<=i||(t.push(r),e.push(f),s.push(d),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),c=this.segS[t],a=this.segT0[t],l=this.segT1[t];c===0?(e[0]=s,e[1]=a,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):c===1?(e[0]=i,e[1]=a,e[2]=i,e[3]=l,e[4]=1,e[5]=0):c===2?(e[0]=a,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=a,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const c=Math.cos(s),a=Math.sin(s),l=n-t,h=i-e;r[0]=c*l+a*h,r[1]=-a*l+c*h}static toWorld(t,e,s,n,i,r){const c=Math.cos(s),a=Math.sin(s);r[0]=t+c*n-a*i,r[1]=e+a*n+c*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,c=this.y-e;this.x=t+n*r-i*c,this.y=e+i*r+n*c,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let c=1/0,a=1/0,l=-1/0,h=-1/0;for(let f=0;f<this.nr;f+=1){const[u,m,p,d]=this.bounds(f);for(let g=0;g<4;g+=1){const y=g===0||g===3?u:p,w=g<2?m:d,x=t+i*y-r*w,F=e+r*y+i*w;x<c&&(c=x),x>l&&(l=x),F<a&&(a=F),F>h&&(h=F)}}n[0]=c,n[1]=a,n[2]=l,n[3]=h}}const ri=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function En(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const xe=[0,120],Oo=.3;pt.map(o=>En(o.color));var wc;En(((wc=ir[0])==null?void 0:wc.color)??"#f4f3ee");const ol=new Set([".e.bubbleModel.Fm",".e.bubbleModel.alphaTarget",".e.bubbleModel.budget",".e.bubbleModel.cells",".e.bubbleModel.dTb",".e.bubbleModel.head",".e.bubbleModel.next",".e.bubbleModel.tsatCell",".e.bubbleModel.wts",".e.exchange.cap",".e.exchange.capA",".e.exchange.capT",".e.exchange.cell",".e.exchange.cpp",".e.exchange.ds",".e.exchange.fH",".e.exchange.fS",".e.exchange.hs",".e.exchange.inH",".e.exchange.inS",".e.exchange.outH",".e.exchange.outS",".e.exchange.salt",".e.exchange.water",".e.gas.R.stack",".e.gas.queue",".e.gas.seen",".e.gas.gasU",".e.gas.gasV",".e.gas.lim",".e.gas.mover.conc",".e.gas.mover.fu",".e.gas.mover.fv",".e.gas.mover.outM",".e.gas.mover.scale",".e.gas.mu",".e.gas.nmol",".e.gas.u0",".e.gas.u1",".e.gas.v0",".e.gas.v1",".e.gas.veos",".e.gas.veosMid",".e.grid.Cl",".e.grid.Sg",".e.grid.Sl",".e.grid.Tl",".e.grid.phi",".e.grid.region",".e.grid.thin",".e.heat.C",".e.heat.CKo",".e.heat.CTl",".e.heat.Cg",".e.heat.Co",".e.heat.Cs",".e.heat.Tnew",".e.heat.Tstar",".e.heat.dE",".e.heat.gx",".e.heat.gy",".e.heat.k",".e.heat.q",".e.liquid.knownU",".e.liquid.knownV",".e.liquid.markU",".e.liquid.markV",".e.liquid.mu",".e.liquid.mv",".e.liquid.pGas",".e.liquid.pu",".e.liquid.pv",".e.liquid.rv",".e.liquid.solver.bs",".e.liquid.solver.levels.0.act",".e.liquid.solver.levels.0.area",".e.liquid.solver.levels.0.ax",".e.liquid.solver.levels.0.ay",".e.liquid.solver.levels.0.b",".e.liquid.solver.levels.0.band",".e.liquid.solver.levels.0.dDx",".e.liquid.solver.levels.0.dDy",".e.liquid.solver.levels.0.dH",".e.liquid.solver.levels.0.diag",".e.liquid.solver.levels.0.eDx",".e.liquid.solver.levels.0.eDy",".e.liquid.solver.levels.0.gDx",".e.liquid.solver.levels.0.gDy",".e.liquid.solver.levels.0.gx",".e.liquid.solver.levels.0.gy",".e.liquid.solver.levels.0.ox",".e.liquid.solver.levels.0.oy",".e.liquid.solver.levels.0.r",".e.liquid.solver.levels.0.x",".e.liquid.solver.levels.1.pIdx",".e.liquid.solver.levels.1.pW",".e.liquid.solver.levels.2.pIdx",".e.liquid.solver.levels.2.pW",".e.liquid.solver.nullId",".e.liquid.solver.p",".e.liquid.solver.q",".e.liquid.solver.rj",".e.liquid.solver.stack",".e.liquid.solver.xs",".e.liquid.solver.zj",".e.liquid.tmpU",".e.liquid.tmpV",".e.liquid.vsolver",".e.liquid.wt",".e.phase.Cl",".e.phase.Fe",".e.phase.Fm",".e.phase.Tl",".e.phase.Y0",".e.phase.acc",".e.phase.accAll",".e.phase.accH",".e.phase.accMat",".e.phase.accS",".e.phase.aw",".e.phase.bG",".e.phase.bY",".e.phase.dm",".e.phase.edge",".e.phase.fed",".e.phase.hnC",".e.phase.hoC",".e.phase.host",".e.phase.hvC",".e.phase.mol",".e.phase.mtot",".e.phase.rd",".e.prevKind",".e.melt.head",".e.melt.next",".e.melt.water.sg",".e.bodies.cover.work.gF",".e.bodies.cover.work.gK",".e.bodies.cover.work.restF",".e.bodies.cover.work.restK",".e.grainFlow.head",".e.grainFlow.next",".e.grainFlow.px",".e.grainFlow.py",".e.grainFlow.rad",".e.grainFlow.w",".e.grainFlow.vel",".e.grainFlow.hit",".e.grainFlow.lm",".e.grainFlow.lmT",".e.grainFlow.lv",".e.grainFlow.loc",".e.grainSalt.head",".e.grainSalt.next",".e.grainSalt.gHead",".e.grainSalt.gNext",".e.grainSalt.vel",".e.heat.Cgr",".e.heat.CTgr",".e.bodies.forces.pe",".e.bodies.forces.re",".e.bodies.forces.known",".e.bodies.forces.mass",".e.bodies.forces.vol",".e.bodies.forces.out",".e.bodies.forces.front",".e.bodies.forces.next",".e.bodies.forces.vp",".e.bodies.forces.vr",".e.bodies.forces.queued",".e.bodies.forces.tag",".e.bodies.contacts.parts",".e.bodies.contacts.byBody",".e.bodies.contacts.builtFor",".e.bodies.contacts.cache",".e.bodies.contacts.live",".e.bodies.contacts.liveKey",".e.bodies.contacts.touching",".e.bodies.contacts.toWake",".e.bodies.hitOut",".e.bodies.dv",".e.bodies.probeS",".e.bodies.probeJ",".e.bodies.m9",".e.liquid.hit",".e.liquid.escaped"]),Zf=new Set([".e.timings",".e.stamp",".e.stepMs",".e.warnings"]),oi={Float64Array:o=>new Float64Array(o),Float32Array:o=>new Float32Array(o),Int32Array:o=>new Int32Array(o),Uint32Array:o=>new Uint32Array(o),Int16Array:o=>new Int16Array(o),Uint16Array:o=>new Uint16Array(o),Int8Array:o=>new Int8Array(o),Uint8Array:o=>new Uint8Array(o),Uint8ClampedArray:o=>new Uint8ClampedArray(o)},al=o=>ArrayBuffer.isView(o)&&!(o instanceof DataView);function Zr(o){return o===null||typeof o!="object"?typeof o!="function":Array.isArray(o)?o.every(Zr):Object.getPrototypeOf(o)!==Object.prototype?!1:Object.values(o).every(Zr)}const Jf=o=>JSON.parse(o,(t,e)=>{if(e!==null&&typeof e=="object"&&typeof e.$n=="string"){const s=e.$n;return s==="-0"?-0:Number(s)}return e});function qo(o,t,e,s,n){var r;if(e.has(o))return;e.add(o);const i=o;for(const c of Object.keys(i)){if(((r=Object.getOwnPropertyDescriptor(i,c))==null?void 0:r.get)!==void 0)continue;const a=`${t}.${c}`,l=i[c];if(n.has(a)||Zf.has(a)){l!==null&&typeof l=="object"&&e.add(l);continue}if(typeof l!="function")if(al(l)){if(e.has(l))continue;e.add(l),s.typed(i,c,a,l)}else l instanceof Map?s.map(i,c,a,l):l!==null&&typeof l=="object"&&!Zr(l)?qo(l,a,e,s,n):s.prim(i,c,a,l)}}function t0(o){let t=2166136261,e=16777619;for(let s=0;s<o.length;s+=1){const n=o.charCodeAt(s);t=Math.imul(t^n,16777619)>>>0,e=Math.imul(e^n+40503,16777619)>>>0}return`${t.toString(16).padStart(8,"0")}${e.toString(16).padStart(8,"0")}`}function e0(o,t){const e=[];return qo(o,"",new Set,{typed:(s,n,i)=>e.push(i),prim:(s,n,i)=>e.push(i),map:(s,n,i)=>e.push(i)},t),e}function cl(o,t=ol){return t0([...e0(o,t)].sort().join(`
`))}const s0=o=>new Uint8Array(o.buffer,o.byteOffset,o.byteLength);function n0(o){const t=new DataView(o.buffer,o.byteOffset,o.byteLength).getUint32(0,!0);return{head:Jf(new TextDecoder().decode(o.subarray(4,4+t))),at:4+t+(8-(4+t)%8)%8}}function i0(o,t,e=ol){const{head:s,at:n}=n0(t);if(cl(o,e)!==s.layout)throw new Error("snapshot: the engine is built differently");const r=new Float64Array(t.slice(n,n+8*s.nums).buffer),c=new Map;let a=n+8*s.nums;const l={t:0,n:0,j:0,m:0};s.paths.forEach((f,u)=>{var d;const m=s.kinds[u],p=l[m];if(l[m]+=1,c.set(f,{kind:m,index:p,offset:a}),m==="t"){const[g,,y]=s.typed[p];a+=y*(((d=oi[g])==null?void 0:d.call(oi,0).BYTES_PER_ELEMENT)??1)}});const h=(f,u,m,p)=>{const d=c.get(m);if(d===void 0)throw new Error(`snapshot: nothing stored for ${m}`);if(d.kind==="t"){const[g,y,w]=s.typed[d.index];let x=al(p)?p:null;if(x===null||x.length!==y||x.constructor.name!==g){const F=oi[g];if(F===void 0)throw new Error(`snapshot: unknown array ${g} at ${m}`);x=F(y),f[u]=x}s0(x).set(t.subarray(d.offset,d.offset+w*x.BYTES_PER_ELEMENT))}else if(d.kind==="n")f[u]=r[d.index];else if(d.kind==="j"){const g=s.json[d.index];f[u]=g!==null&&typeof g=="object"&&g.u===1?void 0:structuredClone(g)}else{const g=f[u];if(!(g instanceof Map))throw new Error(`snapshot: no map at ${m}`);g.clear();for(const[y,w]of s.maps[d.index]??[])g.set(y,w)}};qo(o,"",new Set,{typed:(f,u,m,p)=>h(f,u,m,p),prim:(f,u,m,p)=>h(f,u,m,p),map:(f,u,m,p)=>h(f,u,m,p)},e)}const r0="recreatio/lab2d-clip",o0=2;function ll(o,t,e=null){const s=o.engine??"cpu";return{key:o.key,duration:o.duration,seconds:o.seconds,frames:o.frames,fps:o.fps,bytes:o.bytes,created:o.created,bakeMs:o.bakeMs,quality:o.quality,resumable:o.layout===t,exact:s==="cpu"&&o.exact!==!1,engine:s,samples:o.samples,alt:e===null?null:ll(e,t)}}function a0(o){return rl(Ti(o).scene)}async function ta(o,t="cpu"){const e=`${r0}/${o0}${t==="gpu"?"/gpu":""}
${JSON.stringify(o)}`,s=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return[...new Uint8Array(s)].map(n=>n.toString(16).padStart(2,"0")).join("")}const fl=(o,t)=>({e:o,charts:t}),c0=16,l0=6e8;function ea(){const o=new Map,t=new Map;return{header:async e=>o.get(e)??null,chunk:async(e,s)=>t.get(`c:${e}:${s}`)??null,keyframe:async(e,s)=>t.get(`k:${e}:${s}`)??null,save:async(e,s,n)=>{o.set(e.key,e),s.forEach((i,r)=>t.set(`c:${e.key}:${r}`,i)),n.forEach((i,r)=>t.set(`k:${e.key}:${r}`,i))},touch:async e=>{const s=o.get(e);s!==void 0&&(s.used=Date.now())},remove:async e=>{o.delete(e);for(const s of[...t.keys()])s.includes(`:${e}:`)&&t.delete(s)}}}const f0="recreatio-lab2d";function sa(o){return new Promise((t,e)=>{o.onsuccess=()=>t(o.result),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function gr(o){return new Promise((t,e)=>{o.oncomplete=()=>t(),o.onabort=()=>e(o.error??new Error("IndexedDB: aborted")),o.onerror=()=>e(o.error??new Error("IndexedDB"))})}function u0(){return new Promise((o,t)=>{const e=indexedDB.open(f0,1);e.onupgradeneeded=()=>{const s=e.result;s.objectStoreNames.contains("clips")||s.createObjectStore("clips",{keyPath:"key"}),s.objectStoreNames.contains("chunks")||s.createObjectStore("chunks"),s.objectStoreNames.contains("keys")||s.createObjectStore("keys")},e.onsuccess=()=>o(e.result),e.onerror=()=>t(e.error??new Error("IndexedDB")),e.onblocked=()=>t(new Error("IndexedDB: blocked"))})}async function h0(){if(typeof indexedDB>"u")return ea();let o;try{o=await u0()}catch{return ea()}const t=async(i,r)=>sa(o.transaction(i,"readonly").objectStore(i).get(r)),e=i=>i instanceof Uint8Array?i:i instanceof ArrayBuffer?new Uint8Array(i):null,s=async(i,r,c)=>{const a=o.transaction(["clips","chunks","keys"],"readwrite");a.objectStore("clips").delete(i);for(let l=0;l<r;l+=1)a.objectStore("chunks").delete(`${i}:${l}`);for(let l=0;l<c;l+=1)a.objectStore("keys").delete(`${i}:${l}`);await gr(a)},n={header:async i=>await t("clips",i)??null,chunk:async(i,r)=>e(await t("chunks",`${i}:${r}`)),keyframe:async(i,r)=>e(await t("keys",`${i}:${r}`)),save:async(i,r,c)=>{const a=await n.header(i.key);a!==null&&await s(a.key,a.chunkBytes.length,a.keyframes.length);const l=await sa(o.transaction("clips","readonly").objectStore("clips").getAll());l.sort((m,p)=>m.used-p.used);let h=l.length+1,f=l.reduce((m,p)=>m+p.bytes,0)+i.bytes;for(const m of l){if(h<=c0&&f<=l0)break;await s(m.key,m.chunkBytes.length,m.keyframes.length),h-=1,f-=m.bytes}const u=o.transaction(["clips","chunks","keys"],"readwrite");r.forEach((m,p)=>u.objectStore("chunks").put(m,`${i.key}:${p}`)),c.forEach((m,p)=>u.objectStore("keys").put(m,`${i.key}:${p}`)),u.objectStore("clips").put(i),await gr(u)},touch:async i=>{const r=await n.header(i);if(r===null)return;const c=o.transaction("clips","readwrite");c.objectStore("clips").put({...r,used:Date.now()}),await gr(c)},remove:async i=>{const r=await n.header(i);r!==null&&await s(i,r.chunkBytes.length,r.keyframes.length)}};return n}class ul{constructor(t){v(this,"e");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.e=t}vapour(){const t=this.e;return t.phase.produced-t.phase.condensed+t.bubbleModel.burstVapour}mark(t){const e=this.e,s=e.measureBudget(),n=_t(t);let i=0;const r=e.particles;for(let c=0;c<r.count;c+=1)i+=r.mass[c]*(r.h[c]-n);return{t:e.time,heater:e.flows.heater,solids:s.solids,sens:i,SG:e.heat.fluxSG,LG:e.heat.fluxLG,lossS:e.heat.lossSolids,bub:s.bubbles,vap:this.vapour()}}sample(){const t=this.e,e=kt(t.regions.pAmb),s=Fo(e),n=t.waterTemperature(),i=t.measureBudget(),r=t.flows,c=this.mark(e),a=this.last;let l=0,h=0;if(a!==null&&c.t>a.t){const m=c.t-a.t,p=(c.heater-a.heater)/m,d=(c.solids-a.solids+c.SG-a.SG+c.lossS-a.lossS+c.LG-a.LG+c.sens-a.sens+c.bub-a.bub)/m;l=(c.vap-a.vap)/m,h=Math.max(0,(p-d)/s)}this.last=c;const f=this.vapour()*s,u=i.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=u),{t:t.time,waterT:n.mean,waterTmax:n.max,Tsat:e,heater:r.heater,latent:f-this.latent0,sensible:u-this.stored0-(f-this.latent0),losses:r.lossWalls+r.lossOpen,escaped:r.escapedEnergy,liquid:i.water.liquid,vapour:i.water.vapour,fog:i.water.fog,film:i.water.film,bubbles:i.water.bubbles,escapedWater:i.water.escaped,vapourRate:l,expectedRate:h}}}const d0=.004,m0=.02,ai=1e-7,p0=.22,g0=2.5;class x0{constructor(t,e){v(this,"nx",0);v(this,"ny",0);v(this,"count",0);v(this,"points",[na(),na()]);v(this,"friction");v(this,"bounce");v(this,"touched",!0);v(this,"k11",0);v(this,"k12",0);v(this,"k22",0);v(this,"i11",0);v(this,"i12",0);v(this,"i22",0);v(this,"block",!1);v(this,"h",1/120);v(this,"slop",d0);v(this,"spec",m0);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function na(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function v0(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?y0(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?ia(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?ia(o,e,t,!0):w0(o,t,e);for(let c=0;c<o.count;c+=1){const a=o.points[c];a.jn=0,a.jt=0;for(let l=0;l<r;l+=1)if(s[l]===a.id){a.jn=n[l],a.jt=i[l];break}}return o.count}function Vi(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function y0(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,c=Math.hypot(i,r);if(c>s+n+o.spec)return;const a=c>1e-9?i/c:0,l=c>1e-9?r/c:1;o.nx=a,o.ny=l,Vi(o,t.x+a*(s-(s+n-c)/2),t.y+l*(s-(s+n-c)/2),c-s-n,0)}function ia(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,c=0;for(let w=0;w<n.n;w+=1){const x=(e.x-t.wx[w])*t.wnx[w]+(e.y-t.wy[w])*t.wny[w];if(x>i+o.spec)return;x>r&&(r=x,c=w)}const a=(c+1)%n.n,l=t.wx[c],h=t.wy[c],f=t.wx[a],u=t.wy[a];let m,p,d,g,y;if(r<1e-9)m=t.wnx[c],p=t.wny[c],y=r-i,d=e.x-m*i,g=e.y-p*i;else{const w=(e.x-l)*(f-l)+(e.y-h)*(u-h),x=(e.x-f)*(l-f)+(e.y-u)*(h-u);if(w<=0||x<=0){const F=w<=0?l:f,_=w<=0?h:u,T=e.x-F,A=e.y-_,b=Math.hypot(T,A);if(b>i+o.spec)return;m=b>1e-9?T/b:t.wnx[c],p=b>1e-9?A/b:t.wny[c],y=b-i,d=F,g=_}else m=t.wnx[c],p=t.wny[c],y=r-i,d=e.x-m*i,g=e.y-p*i}o.nx=s?-m:m,o.ny=s?-p:p,Vi(o,d,g,y,c)}function ra(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const c=o.wnx[r],a=o.wny[r],l=o.wx[r],h=o.wy[r];let f=1/0;for(let u=0;u<s.n;u+=1){const m=(t.wx[u]-l)*c+(t.wy[u]-h)*a;m<f&&(f=m)}f>n&&(n=f,i=r)}return{sep:n,edge:i}}function w0(o,t,e){const s=ra(t,e);if(s.sep>o.spec)return;const n=ra(e,t);if(n.sep>o.spec)return;let i=t,r=e,c=s.edge,a=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,c=n.edge,a=!0);const l=i.shape,h=r.shape;if(l.kind!=="poly"||h.kind!=="poly")return;const f=(c+1)%l.n,u=i.wx[c],m=i.wy[c],p=i.wx[f],d=i.wy[f],g=i.wnx[c],y=i.wny[c];let w=1/0,x=0;for(let R=0;R<h.n;R+=1){const W=r.wnx[R]*g+r.wny[R]*y;W<w&&(w=W,x=R)}const F=(x+1)%h.n;let _=r.wx[x],T=r.wy[x],A=r.wx[F],b=r.wy[F],k=x,S=F;const M=Math.hypot(p-u,d-m)||1,P=(p-u)/M,C=(d-m)/M,L=P*u+C*m,B=P*p+C*d;for(const[R,W]of[[-1,-L],[1,B]]){const V=R*(P*_+C*T)-W,Z=R*(P*A+C*b)-W;if(V>ai&&Z>ai)return;if(V>ai){const it=V/(V-Z);_+=(A-_)*it,T+=(b-T)*it,k=200+c}else if(Z>ai){const it=V/(V-Z);A=_+(A-_)*it,b=T+(b-T)*it,S=300+c}}const I=(a?1e4:0)+c*1e3,j=(_-u)*g+(T-m)*y,E=(A-u)*g+(b-m)*y;o.nx=a?-g:g,o.ny=a?-y:y,j<=o.spec&&Vi(o,_-g*j/2,T-y*j/2,j,I+k),E<=o.spec&&Vi(o,A-g*E/2,b-y*E/2,E,I+S)}function b0(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,c=-n;for(let a=0;a<o.count;a+=1){const l=o.points[a];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const h=l.rax*i-l.ray*n,f=l.rbx*i-l.rby*n,u=e.invM+s.invM+e.invI*h*h+s.invI*f*f;l.massN=u>0?1/u:0;const m=l.rax*c-l.ray*r,p=l.rbx*c-l.rby*r,d=e.invM+s.invM+e.invI*m*m+s.invI*p*p;l.massT=d>0?1/d:0,l.bias=l.sep>0?-l.sep/t:Math.min(g0,p0/t*Math.max(0,-l.sep-o.slop));const g=s.vx-s.w*l.rby-e.vx+e.w*l.ray,y=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,w=g*n+y*i;l.bounce=w<-.6&&(l.sep<=o.slop||l.sep+w*t<0)?-o.bounce*w:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const a=o.points[0],l=o.points[1],h=a.rax*i-a.ray*n,f=a.rbx*i-a.rby*n,u=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,p=e.invM+s.invM;o.k11=p+e.invI*h*h+s.invI*f*f,o.k22=p+e.invI*u*u+s.invI*m*m,o.k12=p+e.invI*h*u+s.invI*f*m;const d=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*d&&d>0&&(o.block=!0,o.i11=o.k22/d,o.i12=-o.k12/d,o.i22=o.k11/d)}}function F0(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];Rn(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function _0(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let c=0;c<o.count;c+=1){const a=o.points[c],l=e.vx-e.w*a.rby-t.vx+t.w*a.ray,h=e.vy+e.w*a.rbx-t.vy-t.w*a.rax,f=l*i+h*r,u=o.friction*a.jn,m=Math.max(-u,Math.min(u,a.jt-a.massT*f)),p=m-a.jt;a.jt=m,Rn(t,e,p*i,p*r,a)}if(o.block){A0(o);return}for(let c=0;c<o.count;c+=1){const a=o.points[c],l=e.vx-e.w*a.rby-t.vx+t.w*a.ray,h=e.vy+e.w*a.rbx-t.vy-t.w*a.rax,f=l*s+h*n;a.bounce===0&&o.bounce>=.5&&f<-.6&&(a.sep<=o.slop||a.sep+f*o.h<0)&&(a.bounce=-o.bounce*f);const u=Math.max(a.jn+a.massN*(-f+Jr(a)),a.fixed),m=u-a.jn;a.jn=u,Rn(t,e,m*s,m*n,a),a.bounce>0&&(a.fixed=u,a.bounce=-1,a.kicked=!0)}}const Jr=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function Rn(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function A0(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],c=d=>{const g=e.vx-e.w*d.rby-t.vx+t.w*d.ray,y=e.vy+e.w*d.rbx-t.vy-t.w*d.rax;return g*s+y*n},a=i.jn,l=r.jn,h=c(i)-Jr(i)-(o.k11*a+o.k12*l),f=c(r)-Jr(r)-(o.k12*a+o.k22*l),u=(d,g)=>{const y=d-a,w=g-l;Rn(t,e,y*s,y*n,i),Rn(t,e,w*s,w*n,r),i.jn=d,r.jn=g};let m=-(o.i11*h+o.i12*f),p=-(o.i12*h+o.i22*f);if(m>=0&&p>=0){u(m,p);return}if(m=-h/o.k11,p=0,m>=0&&o.k12*m+f>=0){u(m,p);return}if(m=0,p=-f/o.k22,p>=0&&o.k12*p+h>=0){u(m,p);return}h>=0&&f>=0&&u(0,0)}const k0=10,gn={friction:.5,bounce:.1},T0=.01;function rs(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),c=new Float64Array([-1,0,1,0]);let a=0;for(let l=0;l<4;l+=1)a=Math.max(a,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:c,n:4,radius:a}}class Cs{constructor(t,e,s,n){v(this,"wx");v(this,"wy");v(this,"wnx");v(this,"wny");v(this,"minX",0);v(this,"minY",0);v(this,"maxX",0);v(this,"maxY",0);v(this,"invM",0);v(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let c=1/0,a=1/0,l=-1/0,h=-1/0;for(let f=0;f<t.n;f+=1){const u=s+i*t.xs[f]-r*t.ys[f],m=n+r*t.xs[f]+i*t.ys[f];this.wx[f]=u,this.wy[f]=m,this.wnx[f]=i*t.nx[f]-r*t.ny[f],this.wny[f]=r*t.nx[f]+i*t.ny[f],u<c&&(c=u),u>l&&(l=u),m<a&&(a=m),m>h&&(h=m)}this.minX=c,this.minY=a,this.maxX=l,this.maxY=h}}class S0{constructor(t){v(this,"parts",[]);v(this,"byBody",[]);v(this,"builtFor",-1);v(this,"warmKey",new Float64Array(0));v(this,"warmData",new Float64Array(0));v(this,"warmCount",0);v(this,"touching",new Uint8Array(0));v(this,"toWake",[]);v(this,"cache",new Map);v(this,"live",[]);v(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,c]=t.bounds(s);e[s].shape=rs(n,i,r,c),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new Cs(1,null,rs(-1,-1,0,r+1),gn)),s.openR||n.push(new Cs(2,null,rs(i,-1,i+1,r+1),gn)),s.openB||n.push(new Cs(3,null,rs(-1,-1,i+1,0),gn)),s.openT||n.push(new Cs(4,null,rs(-1,r,i+1,r+1),gn));const{nx:c,ny:a,dx:l}=s;let h=new Map,f=10;for(let u=0;u<=a;u+=1){const m=new Map;if(u<a){let p=0;for(;p<c;){const d=p+u*c;if(s.solid[d]===0||s.owner[d]!==0){p+=1;continue}const g=s.solid[d];let y=p;for(;y+1<c&&s.solid[y+1+u*c]===g&&s.owner[y+1+u*c]===0;)y+=1;const w=g<<24|p<<12|y;m.set(w,h.has(w)?h.get(w):u),p=y+1}}for(const[p,d]of h){if(m.get(p)===d)continue;const g=this.solidMaterial(p>>>24);n.push(new Cs(f++,null,rs((p>>12&4095)*l,d*l,((p&4095)+1)*l,u*l),g))}h=m}this.byBody=t.map(()=>[]);for(const u of t){if(u.gone)continue;const m=this.solidMaterial(u.mat+1);for(let p=0;p<u.nr;p+=1){const[d,g,y,w]=u.bounds(p),x=rs(d,g,y,w),F=new Cs(1e5+u.index*1e3+p,u,x,m);n.push(F),this.byBody[u.index].push(F)}}for(const u of n)u.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=pt[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:gn}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const h of this.parts){const f=h.body;if(f===null)continue;const u=f.awake;h.invM=u?1/f.m:0,h.invI=u?1/f.I:0,h.update()}for(const h of this.cache.values())h.touched=!1;const r=this.live,c=this.liveKey;r.length=0,c.length=0;const a=this.parts;for(let h=0;h<a.length;h+=1){const f=a[h];for(let u=h+1;u<a.length;u+=1){const m=a[u],p=f.invM>0,d=m.invM>0;if(!p&&!d||f.body!==null&&f.body===m.body||m.minX>f.maxX+i||m.maxX<f.minX-i||m.minY>f.maxY+i||m.maxY<f.minY-i)continue;const g=f.id*1e6+m.id;let y=this.cache.get(g);y===void 0&&(y=new x0(f,m),y.slop=n,y.spec=i,this.restore(y,g),this.cache.set(g,y)),y.touched=!0,v0(y)>0?(r.push(y),c.push(g)):y.count=0}}const l=c.map((h,f)=>f).sort((h,f)=>c[h]-c[f]);for(const h of l)b0(r[h],t);for(const h of l)F0(r[h]);for(let h=0;h<k0;h+=1)for(const f of l)_0(r[f]);for(const h of l){const f=r[h],u=f.a.body,m=f.b.body;if(u!==null&&(this.touching[u.index]=1),m!==null&&(this.touching[m.index]=1),u!==null&&m!==null&&u.asleep!==m.asleep&&!u.pinned&&!m.pinned){const p=u.asleep?m:u,d=u.asleep?u:m;p.speed()>T0&&this.toWake.push(d.index)}}for(const[h,f]of this.cache)(!f.touched||f.count===0)&&this.cache.delete(h);this.save(l.map(h=>c[h]),l.map(h=>r[h]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let c=0;c<2;c+=1){const a=i.points[c];this.warmData[r+1+4*c]=a.id,this.warmData[r+2+4*c]=a.jn,this.warmData[r+3+4*c]=a.jt,this.warmData[r+4+4*c]=a.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const c=9*i;t.count=this.warmData[c];for(let a=0;a<2;a+=1){const l=t.points[a];l.id=this.warmData[c+1+4*a],l.jn=this.warmData[c+2+4*a],l.jt=this.warmData[c+3+4*a],l.kicked=this.warmData[c+4+4*a]===1}return}r<e?s=i+1:n=i-1}}}class M0{constructor(t){v(this,"gF");v(this,"gK");v(this,"seen");v(this,"restF",new Float64Array(8));v(this,"restK",new Float64Array(8));v(this,"tag",0);this.gF=new Float64Array(t),this.gK=new Float64Array(t),this.seen=new Int32Array(t)}}const xr=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function vr(o,t){xr[o].length<t&&(xr[o]=new Float64Array(2*t));const e=xr[o];return e.fill(0,0,t),e}function P0(o,t,e,s,n){const{gF:i,gK:r,seen:c}=n;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1)i[f.wc[u]]=0,r[f.wc[u]]=0;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1){const m=f.wc[u];i[m]+=f.ww[u]*f.film[f.wk[u]],r[m]+=f.ww[u]*f.crust[f.wk[u]]}n.restF.length<t.length&&(n.restF=new Float64Array(2*t.length),n.restK=new Float64Array(2*t.length));const a=n.restF,l=n.restK;a.fill(0),l.fill(0);const h=++n.tag;for(const f of t)if(!(f.gone||f.nw===0))for(let u=0;u<f.nw;u+=1){const m=f.wc[u];if(c[m]===h)continue;c[m]=h;const p=o.owner[m]>0?o.owner[m]-1:f.index,d=o.film[m]-e.filmSync[m];d<0&&-d>i[m]&&(a[p]+=-d-i[m]);const g=o.crust[m]-e.crustSync[m];g<0&&-g>r[m]&&(l[p]+=-g-r[m])}for(const f of t){if(f.gone||f.nw===0)continue;const u=s[f.index],m=vr(0,f.ncell),p=vr(1,f.ncell),d=vr(2,f.ncell);let g=a[f.index]>0||l[f.index]>0;for(let x=0;x<f.nw;x+=1){const F=f.wc[x],_=f.wk[x],T=f.ww[x],A=o.Es[F]-e.esSync[F];A!==0&&o.capB[F]>0&&(m[_]+=A*T*u[_]/o.capB[F],g=!0);const b=o.film[F]-e.filmSync[F];b>0&&e.wsum[F]>0?(p[_]+=b*T/e.wsum[F],g=!0):b<0&&i[F]>0&&(p[_]-=Math.min(1,-b/i[F])*T*f.film[_],g=!0);const k=o.crust[F]-e.crustSync[F];k>0&&e.wsum[F]>0?(d[_]+=k*T/e.wsum[F],g=!0):k<0&&r[F]>0&&(d[_]-=Math.min(1,-k/r[F])*T*f.crust[_],g=!0)}if(!g)continue;let y=0,w=0;for(let x=0;x<f.ncell;x+=1)f.E[x]+=m[x],f.film[x]=Math.max(0,f.film[x]+p[x]),f.crust[x]=Math.max(0,f.crust[x]+d[x]),y+=f.film[x],w+=f.crust[x];if(a[f.index]>0&&y>0){const x=Math.max(0,1-a[f.index]/y);for(let F=0;F<f.ncell;F+=1)f.film[F]*=x}if(l[f.index]>0&&w>0){const x=Math.max(0,1-l[f.index]/w);for(let F=0;F<f.ncell;F+=1)f.crust[F]*=x}}for(let f=0;f<o.n;f+=1)o.capB[f]<=0||(e.esSync[f]=o.Es[f],e.filmSync[f]=o.film[f],e.crustSync[f]=o.crust[f])}const be=new Float64Array(16),Fe=new Float64Array(16),ci=new Float64Array(16),li=new Float64Array(16);function fi(o,t,e,s,n,i,r,c){let a=0;for(let l=0;l<o;l+=1){const h=(l+1)%o,f=s*((t===0?n[l]:i[l])-e),u=s*((t===0?n[h]:i[h])-e);if(f<=0&&(r[a]=n[l],c[a]=i[l],a+=1),f<0&&u>0||f>0&&u<0){const m=f/(f-u);r[a]=n[l]+m*(n[h]-n[l]),c[a]=i[l]+m*(i[h]-i[l]),a+=1}}return a}function L0(o,t,e,s,n,i,r,c,a,l,h,f){be[0]=o,Fe[0]=t,be[1]=e,Fe[1]=s,be[2]=n,Fe[2]=i,be[3]=r,Fe[3]=c;let u=fi(4,0,a,-1,be,Fe,ci,li);if(u===0||(u=fi(u,0,h,1,ci,li,be,Fe),u===0)||(u=fi(u,1,l,-1,be,Fe,ci,li),u===0)||(u=fi(u,1,f,1,ci,li,be,Fe),u<3))return 0;let m=0;for(let p=0;p<u;p+=1){const d=(p+1)%u;m+=be[p]*Fe[d]-be[d]*Fe[p]}return Math.abs(.5*m)}function Ui(o,t,e,s,n,i,r,c,a){const l=e-o,h=s-t;return ue[0]=0,ue[1]=1,!ui(-l,o-n)||!ui(l,r-o)||!ui(-h,t-i)||!ui(h,c-t)?(a[0]=1,a[1]=0,0):(a[0]=ue[0],a[1]=ue[1],Math.max(0,ue[1]-ue[0]))}const ue=new Float64Array(2);function ui(o,t){if(o===0)return t>=0;const e=t/o;if(o<0){if(e>ue[1])return!1;e>ue[0]&&(ue[0]=e)}else{if(e<ue[0])return!1;e<ue[1]&&(ue[1]=e)}return!0}const yr=new Float64Array(2),hi=new Float64Array(16);function C0(o,t,e,s,n,i,r,c,a,l,h){const f=Math.cos(e),u=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const y=g===0?c:g===1||g===2?l:c,w=g===0||g===1?a:h,x=g===0||g===1?l:c,F=g===0?a:g===1||g===2?h:a,_=f*(y-o)+u*(w-t),T=-u*(y-o)+f*(w-t),A=f*(x-o)+u*(F-t),b=-u*(x-o)+f*(F-t);Ui(_,T,A,b,s,n,i,r,yr)<=0||(hi[2*m]=g+yr[0],hi[2*m+1]=g+yr[1],m+=1)}if(m<2)return!1;const p=1e-9;let d=m;for(let g=0;g<m;g+=1){const y=(g+1)%m,w=hi[2*g+1],x=hi[2*y]+(y===0?4:0);Math.abs(x-w)<=p&&(d-=1)}return d>=2}function O0(o,t,e){const s=[],n=[];for(const d of o)s.push(d[0],d[2]),n.push(d[1],d[3]);for(const d of t)s.push(d.x0,d.x1),n.push(d.y0,d.y1);for(const d of e)s.push(d.x0,d.x1),n.push(d.y0,d.y1);const i=oa(s),r=oa(n),c=i.length-1,a=r.length-1,l=new Uint8Array(Math.max(0,c*a)),h=[],f=[],u=(d,g,y,w,x,F)=>d>y&&d<x&&g>w&&g<F;for(let d=0;d<a;d+=1){const g=.5*(r[d]+r[d+1]);for(let y=0;y<c;y+=1){const w=.5*(i[y]+i[y+1]);let x=!1;for(const _ of o)if(u(w,g,_[0],_[1],_[2],_[3])){x=!0;break}let F=-1;if(x){for(const _ of t)if(u(w,g,_.x0,_.y0,_.x1,_.y1)){F=_.move;break}F>=0?h.push(i[y],r[d],i[y+1],r[d+1],F):l[y+d*c]=1}else{for(const _ of e)if(u(w,g,_.x0,_.y0,_.x1,_.y1)){F=_.move;break}F>=0&&(f.push(i[y],r[d],i[y+1],r[d+1],F),l[y+d*c]=1)}}}const m=[];let p=[];for(let d=0;d<=a;d+=1){const g=[];if(d<a)for(let y=0;y<c;){if(l[y+d*c]===0){y+=1;continue}let w=y;for(;w<c&&l[w+d*c]!==0;)w+=1;const x=p.find(F=>F.i0===y&&F.i1===w);g.push(x??{i0:y,i1:w,y0:r[d]}),y=w}for(const y of p)g.includes(y)||m.push([i[y.i0],y.y0,i[y.i1],r[d]]);p=g}return{rects:m,taken:h,added:f}}function oa(o){o.sort((e,s)=>e-s);const t=[];for(const e of o)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const jo=.99,Io=.9,aa=.5,q0=.02;class j0{constructor(t){v(this,"w");v(this,"esSync");v(this,"filmSync");v(this,"crustSync");v(this,"wsum");v(this,"work");v(this,"best");v(this,"acc");v(this,"split");v(this,"was");v(this,"now");v(this,"stamp");v(this,"fstamp");v(this,"tag",0);v(this,"ftag",0);v(this,"seen");v(this,"queue");v(this,"seenTag",0);v(this,"list",new Int32Array(256));v(this,"listN",0);v(this,"box",new Float64Array(4));v(this,"l0",new Float64Array(2));v(this,"l1",new Float64Array(2));v(this,"wp",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"cb",new Float64Array(4));v(this,"areaK",[]);v(this,"capK",[]);v(this,"splits",[]);v(this,"boxes",new Float64Array(64));v(this,"nx",0);v(this,"ny",0);v(this,"faceOwner");v(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.work=new M0(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let c=this.areaK[t.index],a=this.capK[t.index];(c===void 0||c.length!==t.ncell)&&(c=new Float64Array(t.ncell),a=new Float64Array(t.ncell),this.areaK[t.index]=c,this.capK[t.index]=a);for(let p=0;p<t.ncell;p+=1)c[p]=t.cellVolume(p)/t.depth,a[p]=t.cellCap(p);const l=Math.cos(t.a),h=Math.sin(t.a);let f=0;const u=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,u);const d=u[0],g=u[1],y=u[2],w=u[3],x=t.x+l*d-h*g,F=t.y+h*d+l*g,_=t.x+l*y-h*g,T=t.y+h*y+l*g,A=t.x+l*y-h*w,b=t.y+h*y+l*w,k=t.x+l*d-h*w,S=t.y+h*d+l*w,M=Math.max(0,Math.floor(Math.min(x,_,A,k)/i)),P=Math.min(s-1,Math.floor(Math.max(x,_,A,k)/i)),C=Math.max(0,Math.floor(Math.min(F,T,b,S)/i)),L=Math.min(n-1,Math.floor(Math.max(F,T,b,S)/i));for(let B=C;B<=L;B+=1)for(let I=M;I<=P;I+=1){const j=I+B*s;if(e.solid[j]!==0&&e.owner[j]===0)continue;const E=L0(x,F,_,T,A,b,k,S,I*i,B*i,(I+1)*i,(B+1)*i);E<=1e-12*c[p]||(f>=t.wk.length&&this.growWeights(t,2*f+64),t.wk[f]=p,t.wc[f]=j,t.ww[f]=E/c[p],f+=1)}}t.nw=f;for(let p=0;p<t.nr;p+=1){const d=t.xs[p][0],g=t.ys[p][0],y=t.xs[p][t.ni[p]],w=t.ys[p][t.nj[p]];let x=1/0,F=1/0,_=-1/0,T=-1/0;for(let M=0;M<4;M+=1){const P=M===0||M===3?d:y,C=M<2?g:w,L=t.x+l*P-h*C,B=t.y+h*P+l*C;x=Math.min(x,L),_=Math.max(_,L),F=Math.min(F,B),T=Math.max(T,B)}const A=Math.max(0,Math.floor(x/i)),b=Math.min(s-1,Math.floor(_/i)),k=Math.max(0,Math.floor(F/i)),S=Math.min(n-1,Math.floor(T/i));for(let M=k;M<=S;M+=1)for(let P=A;P<=b;P+=1)C0(t.x,t.y,t.a,d,g,y,w,P*i,M*i,(P+1)*i,(M+1)*i)&&m.push(P+M*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const c=this.list[r],a=c%t,l=(c-a)/t;a<e&&(e=a),a>n&&(n=a),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){var T;const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,c=this.list,a=this.listN;if(this.listN=0,a===0)return 0;const l=1/(i*i);let h=s,f=-1,u=n,m=-1;for(let A=0;A<a;A+=1){const b=c[A],k=b%s,S=(b-k)/s;k<h&&(h=k),k>f&&(f=k),S<u&&(u=S),S>m&&(m=S);const M=e.solid[b]!==0&&e.owner[b]===0;this.was[b]=e.solid[b]!==0&&e.owner[b]!==0?1:0,e.fs[b]=0,e.capB[b]=0,this.wsum[b]=0,this.best[b]=0,this.split[b]=0,e.matB[b]=0,M||(e.Es[b]=0,e.film[b]=0,e.crust[b]=0,e.owner[b]=0)}const p=h*i,d=u*i,g=(f+1)*i,y=(m+1)*i;for(const A of t){if(A.gone||A.nw===0)continue;const b=this.boxOf(A);if(b[0]>g||b[2]<p||b[1]>y||b[3]<d)continue;const k=this.areaK[A.index],S=this.capK[A.index],M=this.acc;for(let C=0;C<A.nw;C+=1){const L=A.wc[C];if(this.stamp[L]!==r)continue;const B=A.wk[C],I=A.ww[C],j=I*k[B]*l;e.fs[L]+=j,M[L]+=j,e.capB[L]+=I*S[B],e.Es[L]+=I*A.E[B],e.film[L]+=I*A.film[B],e.crust[L]+=I*A.crust[B],this.wsum[L]+=I}for(let C=0;C<A.nw;C+=1){const L=A.wc[C];this.stamp[L]!==r||M[L]===0||(M[L]>this.best[L]&&(this.best[L]=M[L],e.owner[L]=A.index+1,e.matB[L]=A.mat+1),M[L]=0)}const P=this.splits[A.index];for(let C=0;C<P.length;C+=1)this.stamp[P[C]]===r&&(this.split[P[C]]=1)}const w=++this.ftag;for(let A=0;A<a;A+=1){const b=c[A],k=b%s,S=(b-k)/s;this.face(t,k,S,!0,w),this.face(t,k+1,S,!0,w),this.face(t,k,S,!1,w),this.face(t,k,S+1,!1,w)}for(let A=0;A<a;A+=1){const b=c[A];e.fs[b]>1&&(e.fs[b]=1);const k=e.solid[b]!==0&&e.owner[b]===0&&this.was[b]===0;this.now[b]=!k&&e.owner[b]!==0&&(e.fs[b]>=((T=t[e.owner[b]-1])!=null&&T.free?Io:jo)||this.split[b]!==0)?1:0}for(let A=0;A<a;A+=1){const b=c[A];this.now[b]!==0||e.owner[b]===0||e.fs[b]<aa||e.solid[b]!==0&&this.was[b]===0||this.besideOther(b)&&(this.now[b]=1)}let x=0;for(let A=0;A<a;A+=1){const b=c[A];if(this.now[b]===1){this.was[b]===0&&(x+=1,this.gasOut(b));const k=t[e.owner[b]-1];e.solid[b]=k.mat+1,e.kind[b]=ht,e.role[b]=0,e.heater[b]=-1}else this.was[b]===1&&(x+=1,e.solid[b]=0,e.role[b]=0,e.heater[b]=-1,this.vacate(b))}const F=++this.ftag;for(let A=0;A<a;A+=1){const b=c[A],k=b%s,S=(b-k)/s;this.closedFace(t,k,S,!0,F),this.closedFace(t,k+1,S,!0,F),this.closedFace(t,k,S,!1,F),this.closedFace(t,k,S+1,!1,F)}const _=this.w.heat;for(let A=0;A<a;A+=1){const b=c[A];this.esSync[b]=e.Es[b],this.filmSync[b]=e.film[b],this.crustSync[b]=e.crust[b],e.capB[b]>0&&_.deriveSolid(b)}return x}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,c=e.owner[t];for(let a=0;a<4;a+=1){const l=i+(a===0?-1:a===1?1:0),h=r+(a===2?-1:a===3?1:0);if(l<0||h<0||l>=s||h>=n){if(l<0?!e.openL:l>=s?!e.openR:h<0?!e.openB:!e.openT)return!0;continue}const f=l+h*s;if(e.solid[f]!==0&&e.owner[f]===0||e.owner[f]!==0&&e.owner[f]!==c&&(e.solid[f]!==0||e.fs[f]>=aa))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:a,dx:l}=r;if(n?e>c||s>=a:e>=c||s>a)return;const h=n?e+s*(c+1):e+s*c,f=n?h:r.nu+h;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const u=e*l,m=s*l,p=n?u:u+l,d=n?m+l:m;let g=0,y=0,w=0,x=0;const F=this.l0,_=this.l1;for(const b of t){if(b.gone||b.nw===0)continue;const k=this.boxOf(b);if(k[0]>Math.max(u,p)||k[2]<Math.min(u,p)||k[1]>Math.max(m,d)||k[3]<Math.min(m,d))continue;Bt.toLocal(b.x,b.y,b.a,u,m,F),Bt.toLocal(b.x,b.y,b.a,p,d,_);let S=0;for(let M=0;M<b.nr;M+=1){const P=b.xs[M][0],C=b.ys[M][0],L=b.xs[M][b.ni[M]],B=b.ys[M][b.nj[M]];S+=Ui(F[0],F[1],_[0],_[1],P,C,L,B,this.seg)}if(!(S<=0)&&(g+=S,S>y)){y=S,x=b.index+1;const M=.5*(u+p),P=.5*(m+d);w=n?b.ux-b.uw*(P-b.y):b.uy+b.uw*(M-b.x)}}const T=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[h]:r.av[h])>0!=T>0&&(this.topologyChanged=!0),this.faceOwner[f]=x,n?(r.au[h]=T,r.usol[h]=g>0?w:0):(r.av[h]=T,r.vsol[h]=g>0?w:0)}closedFace(t,e,s,n,i){const r=this.w.grid,{nx:c,ny:a,dx:l}=r;if(n?e>c||s>=a:e>=c||s>a)return;const h=n?e+s*(c+1):e+s*c,f=n?h:r.nu+h;if(this.fstamp[f]===i)return;this.fstamp[f]=i;const u=n?e>0?h-1-s:-1:s>0?h-c:-1,m=n?e<c?h-s:-1:s<a?h:-1,p=u>=0&&r.solid[u]!==0;if(p===(m>=0&&r.solid[m]!==0))return;const d=r.owner[p?u:m],g=d>0?t[d-1]:void 0;g===void 0||g.gone||(this.faceOwner[f]=d,n?r.usol[h]=g.ux-g.uw*((s+.5)*l-g.y):r.vsol[h]=g.uy+g.uw*((e+.5)*l-g.x))}collect(t){P0(this.w.grid,t,this,this.capK,this.work)}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,c=this.w.bubbles,a=this.box;t.worldBox(t.x,t.y,t.a,a);const l=2*i.dx;for(let h=0;h<r.count;h+=1){const f=r.x[h],u=r.y[h];f<a[0]-l||f>a[2]+l||u<a[1]-l||u>a[3]+l||this.moveOut(t,f,u,f,u,e,s,n)&&(r.x[h]=this.wp[0],r.y[h]=this.wp[1],this.stopInto(t,r.vx,r.vy,h))}for(let h=0;h<c.count;h+=1){const f=c.x[h],u=c.y[h];f<a[0]-l||f>a[2]+l||u<a[1]-l||u>a[3]+l||this.moveOut(t,f,u,f,u,e,s,n)&&(c.x[h]=this.wp[0],c.y[h]=this.wp[1],c.site[h]=-1,this.stopInto(t,c.vx,c.vy,h))}}hit(t,e,s,n,i,r){const c=2*this.w.grid.dx;let a=0,l=n,h=i;for(let f=0;f<3;f+=1){let u=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(l,e)<p[0]-c||Math.min(l,e)>p[2]+c||Math.max(h,s)<p[1]-c||Math.min(h,s)>p[3]+c||this.moveOut(m,l,h,e,s,m.x,m.y,m.a)&&(l=this.wp[0],h=this.wp[1],r[0]=l,r[1]=h,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(h-m.y),r[5]=m.vy+m.w*(l-m.x),a=1,u=!0)}if(!u)break}return a}moveOut(t,e,s,n,i,r,c,a){const l=this.l1,h=this.l0;Bt.toLocal(t.x,t.y,t.a,e,s,l),Bt.toLocal(r,c,a,n,i,h);const f=q0*this.w.grid.dx;let u=1/0,m=-1,p=l[0],d=l[1];for(let b=0;b<t.nr;b+=1){const k=t.xs[b][0],S=t.ys[b][0],M=t.xs[b][t.ni[b]],P=t.ys[b][t.nj[b]],C=k-f,L=S-f,B=M+f,I=P+f,j=l[0]>C&&l[0]<B&&l[1]>L&&l[1]<I;if(Ui(h[0],h[1],l[0],l[1],C,L,B,I,this.seg)<=0&&!j)continue;if(h[0]>C&&h[0]<B&&h[1]>L&&h[1]<I){if(j&&u===1/0){const R=ca(l[0]-C,B-l[0],l[1]-L,I-l[1]);m=R,p=R===0?C:R===1?B:l[0],d=R===2?L:R===3?I:l[1],u=2}}else{const R=this.seg[0];if(R<u){u=R;const W=h[0]+R*(l[0]-h[0]),V=h[1]+R*(l[1]-h[1]),Z=ca(Math.abs(W-C),Math.abs(W-B),Math.abs(V-L),Math.abs(V-I));m=Z,p=Z===0?C:Z===1?B:W,d=Z===2?L:Z===3?I:V}}}if(m<0)return!1;const g=this.w.grid,y=1e-4*g.dx,w=Math.cos(t.a),x=Math.sin(t.a),F=m===0?-1:m===1?1:0,_=m===2?-1:m===3?1:0,T=p+F*y,A=d+_*y;return this.wp[0]=Math.min(g.w-y,Math.max(y,t.x+w*T-x*A)),this.wp[1]=Math.min(g.h-y,Math.max(y,t.y+x*T+w*A)),this.nx=w*F-x*_,this.ny=x*F+w*_,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,c=t.vx-t.w*r,a=t.vy+t.w*i,l=(e[n]-c)*this.nx+(s[n]-a)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,c=(t-r)/n,a=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let l=0,h=0;for(let g=0;g<4;g+=1){const y=s.across(t,r,c,g);y<0||!a(y)||(l+=s.vgas[y]>0?s.vgas[y]:e.vCell,h+=1)}if(h>0){let g=l;for(let y=0;y<4;y+=1){const w=s.across(t,r,c,y);if(w<0||!a(w))continue;const x=s.vgas[w]>0?s.vgas[w]:e.vCell;h-=1,s.move(t,w,h===0?1:Math.min(1,x/g)),g-=x}return}const f=this.seen,u=this.queue;let m=++this.seenTag,p=0,d=0;for(u[d++]=t,f[t]=m;p<d;){const g=u[p++];if(g!==t&&a(g)){s.move(t,g,1);return}const y=g%n,w=(g-y)/n;for(let x=0;x<4;x+=1){const F=s.across(g,y,w,x);F<0||f[F]===m||e.solid[F]!==0&&e.owner[F]===0||(f[F]=m,u[d++]=F)}}for(m=++this.seenTag,p=0,d=0,u[d++]=t,f[t]=m;p<d;){const g=u[p++];if(g!==t&&a(g)){s.move(t,g,1);return}const y=g%n,w=(g-y)/n;for(let x=0;x<4;x+=1){const F=y+(x===0?-1:x===1?1:0),_=w+(x===2?-1:x===3?1:0);if(F<0||_<0||F>=n||_>=i)continue;const T=F+_*n;f[T]!==m&&(f[T]=m,u[d++]=T)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let c=0,a=0,l=0,h=!1;for(let u=0;u<4;u+=1){const m=s.across(t,i,r,u);if(m<0||(e.kind[m]===st&&(h=!0),e.kind[m]!==G||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;c+=p,a+=p*s.rho[m],l+=p*e.T[m]}if(c<=0){e.kind[t]=h?st:G,s.deriveCell(t);return}e.kind[t]=G,e.T[t]=l/c;const f=a/c*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let u=0;u<4;u+=1){const m=s.across(t,i,r,u);if(m<0||e.kind[m]!==G)continue;const p=s.massOf(m);if(p<=0)continue;const d=(s.vgas[m]>0?s.vgas[m]:e.vCell)/c;s.move(m,t,Math.min(.25,f*d/p))}s.deriveCell(t)}}function ca(o,t,e,s){let n=0,i=o;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const I0=1.5,B0=1;class E0{constructor(t){v(this,"pe");v(this,"re");v(this,"known");v(this,"mass");v(this,"vol");v(this,"out",new Float64Array(3));v(this,"front");v(this,"next");v(this,"vp");v(this,"vr");v(this,"queued");v(this,"tag",0);v(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:c,ny:a,n:l,dx:h}=e,{pe:f,re:u,known:m,mass:p,vol:d}=this;p.fill(0),d.fill(0);for(let b=0;b<s.count;b+=1){const k=e.cellAt(s.x[b],s.y[b]);k<0||(p[k]+=s.mass[b],d[k]+=s.mass[b]/s.rho[b])}for(let b=0;b<l;b+=1){const k=e.kind[b];k===st?(f[b]=e.pl[b],u[b]=d[b]>0?p[b]/d[b]:n.rhoRef,m[b]=1):k===G&&e.solid[b]===0?(f[b]=n.pGas[b]+e.pg[b],u[b]=i.rho[b]>0?i.rho[b]:r.rhoAmb,m[b]=1):(f[b]=0,u[b]=0,m[b]=0)}const g=t.gy*h,y=this.front,w=this.next,x=this.vp,F=this.vr,_=this.queued,T=++this.tag;let A=0;for(let b=0;b<l;b+=1){if(m[b]!==0)continue;const k=b%c,S=(b-k)/c;(k>0&&m[b-1]===1||k<c-1&&m[b+1]===1||S>0&&m[b-c]===1||S<a-1&&m[b+c]===1)&&(y[A++]=b,_[b]=T)}for(;A>0;){for(let k=0;k<A;k+=1){const S=y[k],M=S%c,P=(S-M)/c;let C=0,L=0,B=0;M>0&&m[S-1]!==0&&(C+=f[S-1],L+=u[S-1],B+=1),M<c-1&&m[S+1]!==0&&(C+=f[S+1],L+=u[S+1],B+=1),P>0&&m[S-c]!==0&&(C+=f[S-c]-u[S-c]*g,L+=u[S-c],B+=1),P<a-1&&m[S+c]!==0&&(C+=f[S+c]+u[S+c]*g,L+=u[S+c],B+=1),x[k]=B>0?C/B:0,F[k]=B>0?L/B:0}let b=0;for(let k=0;k<A;k+=1){const S=y[k];f[S]=x[k],u[S]=F[k],m[S]=2}for(let k=0;k<A;k+=1){const S=y[k],M=S%c,P=(S-M)/c;for(let C=0;C<4;C+=1){const L=M+(C===0?-1:C===1?1:0),B=P+(C===2?-1:C===3?1:0);if(L<0||B<0||L>=c||B>=a)continue;const I=L+B*c;m[I]!==0||_[I]===T||(_[I]=T,w[b++]=I)}}A=b;for(let k=0;k<b;k+=1)y[k]=w[k]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,c=Math.min(n-1.0001,Math.max(0,t/r-.5)),a=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(c),h=Math.floor(a),f=c-l,u=a-h;let m=0,p=0;for(let d=0;d<2;d+=1)for(let g=0;g<2;g+=1){const y=l+g+(h+d)*n;if(this.known[y]===0)continue;const w=(g===0?1-f:f)*(d===0?1-u:u);m+=w*this.pe[y],p+=w}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,c=0,a=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const h=Math.hypot(i[2]-i[0],i[3]-i[1]),f=Math.max(1,Math.ceil(h/(.5*t.dx))),u=h/f*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let d=0;d<f;d+=1){const g=(d+.5)/f,y=i[0]+g*(i[2]-i[0]),w=i[1]+g*(i[3]-i[1]),x=s*y-n*w,F=n*y+s*w,_=this.sideAt(t.x+x,t.y+F,m,p)*u;r-=_*m,c-=_*p,a-=_*(x*p-F*m)}}return e[0]=r,e[1]=c,e[2]=a,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:c}=r,a=t+.5*c*s,l=e+.5*c*n,h=Math.min(r.nx-1.0001,Math.max(0,a/c-.5)),f=Math.min(r.ny-1.0001,Math.max(0,l/c-.5)),u=Math.floor(h),m=Math.floor(f),p=h-u,d=f-m;let g=0,y=0,w=0,x=0;for(let F=0;F<2;F+=1)for(let _=0;_<2;_+=1){const T=u+_,A=m+F,b=T+A*r.nx;if(this.known[b]!==1)continue;const k=(T+.5)*c,S=(A+.5)*c;if((k-t)*s+(S-e)*n<=0)continue;const M=(_===0?1-p:p)*(F===0?1-d:d)+1e-6,P=this.pe[b]+this.re[b]*i.gy*(S-e);r.kind[b]===st?(g+=M*P,y+=M):(w+=M*P,x+=M)}return y>0&&x>0?Math.max(g/y,w/x):y>0?g/y:x>0?w/x:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let c=0,a=0;for(let f=0;f<t.nseg;f+=1){t.segment(f,r);const u=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(u/t.dx));for(let p=0;p<m;p+=1){const d=(p+.5)/m,g=r[0]+d*(r[2]-r[0])+.5*t.dx*r[4],y=r[1]+d*(r[3]-r[1])+.5*t.dx*r[5],w=s.cellAt(t.x+n*g-i*y,t.y+i*g+n*y);a+=u/m,w>=0&&s.kind[w]===st&&(c+=u/m)}}const l=a>0?c/a:0,h=e.liquid.rhoRef;t.ma=I0*h*l*t.hullA*t.depth,t.Ia=B0*h*l*t.hullJ*t.depth}}const R0=.1,D0=1,N0=.002,V0=.5,U0=1.02,G0=.5;class H0{constructor(t){v(this,"list",[]);v(this,"cover");v(this,"forces");v(this,"contacts");v(this,"version",0);v(this,"prev",new Float64Array(0));v(this,"pred",new Float64Array(0));v(this,"predNow",new Float64Array(0));v(this,"predOld",new Float64Array(0));v(this,"vPre",new Float64Array(0));v(this,"awakeNow",0);v(this,"shapes",!1);v(this,"resized",!1);v(this,"afterCollect",null);v(this,"la",new Float64Array(2));v(this,"lb",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"dv",new Float64Array(3));v(this,"probeS",[]);v(this,"probeJ",[]);v(this,"m9",new Float64Array(9));v(this,"at",new Float64Array(2));this.e=t,this.cover=new j0(t),this.forces=new E0(()=>t),this.contacts=new S0(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const c=this.e.grid,a=Bt.fromRects(this.list.length,n,c.dx,c.depth,e,t,s,r);return a.gone?null:(a.pinned=i,a.asleep=!0,this.list.push(a),this.grow(),this.cover.weigh(a),this.cover.addCells(a),this.changed(),a)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list){if(!e.awake)continue;this.awakeNow+=1,t=!0;const s=3*e.index;this.predNow[s]=this.pred[s],this.predNow[s+1]=this.pred[s+1],this.predNow[s+2]=this.pred[s+2],e.ux=e.vx+this.pred[s],e.uy=e.vy+this.pred[s+1],e.uw=e.w+this.pred[s+2],this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e)}if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>U0*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),c=3*i.index,a=i.ma6;i.maOk||(this.forces.addedMass(i),a.fill(0),a[0]=i.ma,a[3]=i.ma,a[5]=i.Ia);const l=this.predNow,h=this.predOld,f=n[c]+l[c]-h[c],u=n[c+1]+l[c+1]-h[c+1],m=n[c+2]+l[c+2]-h[c+2],p=t*r[0]+a[0]*f+a[1]*u+a[2]*m,d=t*(r[1]-i.m*e.gy)+a[1]*f+a[3]*u+a[4]*m,g=t*r[2]+a[2]*f+a[4]*u+a[5]*m;$0(i.m+a[0],a[1],a[2],i.m+a[3],a[4],i.I+a[5],p,d,g,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[c]=this.dv[0],n[c+1]=this.dv[1],n[c+2]=this.dv[2],h[c]=l[c],h[c+1]=l[c+1],h[c+2]=l[c+2],this.vPre[c]=i.vx,this.vPre[c+1]=i.vy,this.vPre[c+2]=i.w}this.contacts.step(t,this.list,this.version,R0*s.dx,D0*s.dx);for(const i of this.list){if(!i.awake)continue;const r=3*i.index,c=Math.abs(i.vx-this.vPre[r])+Math.abs(i.vy-this.vPre[r+1])+Math.abs(i.w-this.vPre[r+2])*i.rmax>1e-9;this.pred[r]=c?0:n[r],this.pred[r+1]=c?0:n[r+1],this.pred[r+2]=c?0:n[r+2]}for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<N0&&this.contacts.touches(i)?i.rest+t:0,i.rest>=V0&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}blocks(t,e,s,n,i){const r=1e-6*this.e.grid.dx,c=this.la,a=this.lb;for(const l of this.list){if(l===t||l.gone||l.nw===0)continue;const h=this.cover.boxOf(l);if(!(Math.max(e,n)<h[0]||Math.min(e,n)>h[2]||Math.max(s,i)<h[1]||Math.min(s,i)>h[3])){Bt.toLocal(l.x,l.y,l.a,e,s,c),Bt.toLocal(l.x,l.y,l.a,n,i,a);for(let f=0;f<l.nr;f+=1){const u=l.xs[f][0]+r,m=l.ys[f][0]+r,p=l.xs[f][l.ni[f]]-r,d=l.ys[f][l.nj[f]]-r;if(p>u&&d>m&&Ui(c[0],c[1],a[0],a[1],u,m,p,d,this.seg)>0)return!0}}}return!1}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:c,dx:a,depth:l}=i,h=this.cover.faceOwner;for(const f of this.list){if(!f.awake)continue;const u=f.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const d=this.cover.boxOf(f),g=Math.max(0,Math.floor(d[0]/a)-1),y=Math.min(r,Math.floor(d[2]/a)+2),w=Math.max(0,Math.floor(d[1]/a)-1),x=Math.min(c,Math.floor(d[3]/a)+2);for(let A=w;A<Math.min(c,x);A+=1)for(let b=g;b<=y;b+=1){const k=b+A*(r+1);if(h[k]!==u)continue;const S=(A+.5)*a,M=b>0?b-1+A*r:-1,P=b<r?b+A*r:-1,L=M>=0&&i.kind[M]===ht||P>=0&&i.kind[P]===ht?1:1-i.au[k];L<=0||(M>=0&&i.kind[M]===st&&(m.push(t.at(b-1-e,A-s)),p.push(L,0,-L*(S-f.y))),P>=0&&i.kind[P]===st&&(m.push(t.at(b-e,A-s)),p.push(-L,0,L*(S-f.y))))}for(let A=w;A<=x;A+=1)for(let b=g;b<Math.min(r,y);b+=1){const k=b+A*r;if(h[i.nu+k]!==u)continue;const S=(b+.5)*a,M=A>0?b+(A-1)*r:-1,P=A<c?b+A*r:-1,L=M>=0&&i.kind[M]===ht||P>=0&&i.kind[P]===ht?1:1-i.av[k];L<=0||(M>=0&&i.kind[M]===st&&(m.push(t.at(b-e,A-1-s)),p.push(0,L,L*(S-f.x))),P>=0&&i.kind[P]===st&&(m.push(t.at(b-e,A-s)),p.push(0,-L,-L*(S-f.x))))}if(m.length===0){f.ma6.fill(0),f.maOk=!0;continue}const F=t.system,_=this.m9;for(let A=0;A<3;A+=1){F.b.fill(0),F.x.fill(0);for(let b=0;b<m.length;b+=1)F.b[m[b]]-=a*p[3*b+A];t.solve(1e-4,40,!0);for(let b=0;b<3;b+=1){let k=0;for(let S=0;S<m.length;S+=1)k+=F.x[m[S]]*p[3*S+b];_[3*b+A]=-n*a*l*k}}const T=f.ma6;T[0]=_[0],T[1]=.5*(_[1]+_[3]),T[2]=.5*(_[2]+_[6]),T[3]=_[4],T[4]=.5*(_[5]+_[7]),T[5]=_[8],f.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,G0*e.dx/s))}return t}wake(t){!t.free||!t.asleep||(t.asleep=!1,t.rest=0,t.maOk=!1,this.forget(t))}forget(t){const e=3*t.index;for(let s=e;s<e+3;s+=1)this.prev[s]=0,this.pred[s]=0,this.predNow[s]=0,this.predOld[s]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.forget(t),this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(Ge(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let c=this.list.length-1;c>=0;c-=1){const a=this.list[c];if(!a.gone&&(Bt.toLocal(a.x,a.y,a.a,t,e,n),a.insideLocal(n[0],n[1],r)))return a}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=3*this.list.length+24,e=s=>{const n=new Float64Array(t);return n.set(s),n};this.prev=e(this.prev),this.pred=e(this.pred),this.predNow=e(this.predNow),this.predOld=e(this.predOld),this.vPre=e(this.vPre)}}}function $0(o,t,e,s,n,i,r,c,a,l){const h=s*i-n*n,f=e*n-t*i,u=t*n-e*s,m=o*h+t*f+e*u,p=o*i-e*e,d=t*e-o*n,g=o*s-t*t;l[0]=(h*r+f*c+u*a)/m,l[1]=(f*r+p*c+d*a)/m,l[2]=(u*r+d*c+g*a)/m}const Gi=.05;function la(o,t){const e=o.latentOffset(),s=to(o,t.filter(([n,i,r,c])=>r-n>Gi*o.dx&&c-i>Gi*o.dx));return o.derive(),s.energy+=e-o.latentOffset(),s}function to(o,t){const e=o.xs,s=o.ys,n=o.ni,i=o.nj,r=o.off,c=o.nr,a=o.E,l=o.film,h=o.crust;let f=0,u=0,m=0;for(let x=0;x<o.ncell;x+=1)f+=a[x],u+=l[x],m+=h[x];const p=[],d=[];for(const[x,F,_,T]of t)!(_>x)||!(T>F)||(p.push(Bt.splits(x,_,o.dx)),d.push(Bt.splits(F,T,o.dx)));o.setRects(p,d);let g=0,y=0,w=0;for(let x=0;x<o.nr;x+=1){const F=o.xs[x],_=o.ys[x];for(let T=0;T<o.nj[x];T+=1)for(let A=0;A<o.ni[x];A+=1){const b=o.off[x]+A+T*o.ni[x],k=F[A],S=F[A+1],M=_[T],P=_[T+1];for(let C=0;C<c;C+=1){const L=e[C],B=s[C];if(!(L[0]>=S||L[n[C]]<=k||B[0]>=P||B[i[C]]<=M))for(let I=0;I<i[C];I+=1){const j=Math.min(P,B[I+1])-Math.max(M,B[I]);if(!(j<=0))for(let E=0;E<n[C];E+=1){const R=Math.min(S,L[E+1])-Math.max(k,L[E]);if(R<=0)continue;const W=r[C]+E+I*n[C],V=R*j/((L[E+1]-L[E])*(B[I+1]-B[I]));o.E[b]+=V*a[W],o.film[b]+=V*l[W],o.crust[b]+=V*h[W]}}}g+=o.E[b],y+=o.film[b],w+=o.crust[b]}}return{energy:f-g,film:u-y,crust:m-w}}function W0(o,t,e,s,n){const[i,r,c,a]=o;if(s<=i||t>=c||n<=r||e>=a)return null;const l=[],h=Math.max(i,t),f=Math.min(c,s);return t>i&&l.push([i,r,t,a]),s<c&&l.push([s,r,c,a]),e>r&&l.push([h,r,f,e]),n<a&&l.push([h,n,f,a]),l}function K0(o,t){const e=o.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let c=0;c<r.length;c+=1){const[a,l,h,f]=o[r[c]];for(let u=0;u<e;u+=1){if(s[u]>=0)continue;const[m,p,d,g]=o[u],y=(Math.abs(h-m)<=t||Math.abs(d-a)<=t)&&Math.min(f,g)-Math.max(l,p)>t,w=(Math.abs(f-p)<=t||Math.abs(g-l)<=t)&&Math.min(h,d)-Math.max(a,m)>t,x=Math.min(h,d)-Math.max(a,m)>t&&Math.min(f,g)-Math.max(l,p)>t;(y||w||x)&&(s[u]=n.length,r.push(u))}}n.push(r)}return n}function z0(o,t,e){const s=o.list,n=s.length,i=new Float64Array(2);let r=!1;for(let c=0;c<n;c+=1){const a=s[c];if(a.gone)continue;let l=1/0,h=1/0,f=-1/0,u=-1/0;if("circle"in t){const[T,A,b]=t.circle;Bt.toLocal(a.x,a.y,a.a,T,A,i),l=i[0]-b,f=i[0]+b,h=i[1]-b,u=i[1]+b}else{const[T,A,b,k]=fn(t);for(const[S,M]of[[T,A],[b,A],[b,k],[T,k]])Bt.toLocal(a.x,a.y,a.a,S,M,i),l=Math.min(l,i[0]),f=Math.max(f,i[0]),h=Math.min(h,i[1]),u=Math.max(u,i[1])}const m=[];let p=!1;for(let T=0;T<a.nr;T+=1){const A=a.bounds(T),b=W0(A,l,h,f,u);if(b===null){m.push(A);continue}p=!0;for(const k of b)m.push(k)}if(!p)continue;r=!0,o.cover.release(a);const d=Ge(a.mat)>0,g={E:a.energy(),F:a.filmMass(),K:a.crustMass(),M:d?a.m:0},y=hl(o,a,m.filter(T=>T[2]-T[0]>Gi*a.dx&&T[3]-T[1]>Gi*a.dx));let w=0,x=0,F=0,_=0;for(const T of y)w+=T.energy(),x+=T.filmMass(),F+=T.crustMass(),_+=d?T.m:0;e.energy-=g.E-a.energy()-w,e.water-=g.F-a.filmMass()-x+(d?g.M-a.m-_:0),e.salt-=g.K-a.crustMass()-F,a.gone||a.ncell===0?(a.gone=!0,a.ncell=0):(o.cover.weigh(a),o.cover.addCells(a))}return r&&o.changed(),r}function hl(o,t,e,s=!0){const n=o.list,i=K0(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let c=1;c<i.length;c+=1){const a=new Bt(n.length,t.key,t.dx,t.depth);a.mat=t.mat,a.heater=t.heater,a.xs=t.xs.map(l=>l.slice()),a.ys=t.ys.map(l=>l.slice()),a.nr=t.nr,a.ni=t.ni.slice(),a.nj=t.nj.slice(),a.off=t.off.slice(),a.ncell=t.ncell,a.E=t.E.slice(),a.film=t.film.slice(),a.crust=t.crust.slice(),a.x=t.x,a.y=t.y,a.a=t.a,a.m=t.m,la(a,i[c].map(l=>e[l])),a.rx=a.x,a.ry=a.y,a.ra=a.a,a.pinned=t.pinned,a.asleep=t.asleep,a.vx=t.vx,a.vy=t.vy,a.w=t.w,n.push(a),o.grow(),o.cover.weigh(a),o.cover.addCells(a),r.push(a)}return la(t,i.length>0?i[0].map(c=>e[c]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function Q0(o,t,e){const[s,n,i,r]=fn(t),c=[],a=new Float64Array(4);for(const l of o.list){if(l.gone||e!==void 0&&!e(l))continue;l.worldBox(l.x,l.y,l.a,a);const h=.001*l.dx;a[0]>=i-h||a[2]<=s+h||a[1]>=r-h||a[3]<=n+h||(o.cover.release(l),c.push(l))}return c}function X0(o,t,e){t.gone||(o.cover.release(t),e.energy-=t.energy(),e.water-=t.filmMass()+(Ge(t.mat)>0?t.m:0),e.salt-=t.crustMass(),t.gone=!0,t.ncell=0,o.changed())}function fa(o,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,o.cover.weigh(n),o.cover.addCells(n);t.length>0&&o.changed()}const Kt=new Float64Array(6);function di(o,t,e,s){const n=o.ni[t],i=o.nj[t],r=e<2?i:n;for(let c=0;c<r;c+=1){const a=e===0?0:e===1?n-1:c,l=e===2?0:e===3?i-1:c,h=o.off[t]+a+l*n,f=e<2?o.ys[t][l]:o.xs[t][a],u=e<2?o.ys[t][l+1]:o.xs[t][a+1],m=dl(o,t,e,f,u);s(h,u-f,u>f?m/(u-f):0)}}function dl(o,t,e,s,n){let i=0;for(let r=0;r<o.nseg;r+=1)o.segR[r]!==t||o.segS[r]!==e||(i+=Math.max(0,Math.min(n,o.segT1[r])-Math.max(s,o.segT0[r])));return i}function ua(o,t,e){const[s,n,i,r]=o.bounds(t);return e<2?r-n:i-s}function ml(o,t,e){let s=0;for(let n=0;n<o.nseg;n+=1)o.segR[n]===t&&o.segS[n]===e&&(s+=o.segT1[n]-o.segT0[n]);return s}function Y0(o,t){let e=3,s=0;for(let n=0;n<4;n+=1){const i=ml(o,t,n);i>s&&(s=i,e=n)}return e}function pl(o,t,e,s){t.segment(e,Kt);const n=Math.hypot(Kt[2]-Kt[0],Kt[3]-Kt[1]),i=Math.max(1,Math.ceil(n/(.5*o.grid.dx))),r=Math.cos(t.a),c=Math.sin(t.a),a=r*Kt[4]-c*Kt[5],l=c*Kt[4]+r*Kt[5],h=Kt[0],f=Kt[1],u=Kt[2]-Kt[0],m=Kt[3]-Kt[1];for(let p=0;p<i;p+=1){const d=(p+.5)/i,g=h+d*u,y=f+d*m;s(t.x+r*g-c*y,t.y+c*g+r*y,a,l,n/i)}}function gl(o,t,e,s,n,i,r){const c=.05*o.dx,a=o.cellAt(s+c*i,n+c*r);if(a<0||o.solid[a]===0||o.owner[a]!==t||o.fs[a]<e)return c;const l=a%o.nx,h=(a-l)/o.nx;let f=1/0;return i>1e-9?f=Math.min(f,((l+1)*o.dx-s)/i):i<-1e-9&&(f=Math.min(f,(l*o.dx-s)/i)),r>1e-9?f=Math.min(f,((h+1)*o.dx-n)/r):r<-1e-9&&(f=Math.min(f,(h*o.dx-n)/r)),Number.isFinite(f)?Math.max(c,f+c):c}function Bo(o,t,e,s,n=!0){const i=o.grid,r=.05*i.dx,c=t.free?Io:jo;let a=-1,l=-1,h=-1;pl(o,t,e,(f,u,m,p,d)=>{const g=gl(i,t.index+1,c,f,u,m,p),y=i.cellAt(f+g*m,u+g*p);if(y<0||i.solid[y]!==0){a=y;return}if(y!==a&&s(y,d),a=y,n){const x=f+(i.dx+g)*m,F=u+(i.dx+g)*p,_=i.cellAt(x,F);_>=0&&_!==y&&_!==h&&i.solid[_]===0&&!o.bodies.blocks(t,f,u,x,F)&&s(_,d),h=_}const w=i.cellAt(f-r*m,u-r*p);w>=0&&w!==y&&w!==l&&i.solid[w]===0&&i.kind[w]===st&&s(w,d),l=w})}function Z0(o,t,e,s,n){const i=o.exchange;let r=0,c=0;for(let a=0;a<t.nseg;a+=1)t.segR[a]!==e||t.segS[a]!==s||Bo(o,t,a,l=>{r+=i.salt[l],c+=i.water[l],n.add(4*e+s)});return!(c>0)||!(r>0)?Ge(t.mat):Zc(r/(c*Ue))}function J0(o,t,e,s,n){const i=o.grid,r=o.exchange,c=i.n,a=t.free?Io:jo;let l=0;for(let h=0;h<t.nseg;h+=1)t.segR[h]!==e||t.segS[h]!==s||pl(o,t,h,(f,u,m,p,d)=>{var F;const g=gl(i,t.index+1,a,f,u,m,p),y=i.cellAt(f+g*m,u+g*p);if(y<0)return;let w,x;i.solid[y]!==0?(w=i.T[y],x=((F=pt[i.solid[y]-1])==null?void 0:F.k)??0):r.cap[y]>0?(w=r.capT[y]/r.cap[y],x=Ln(w)):(w=i.T[y],x=_o(i.mg[y],i.mg[c+y],i.mg[Y*c+y],w)),w>n&&(l+=x*(w-n)*d)});return l}const tu=2,eu=.25,su=4;class nu{constructor(t,e){v(this,"pending",new Map);v(this,"sg",new Float64Array(6));this.e=t,this.inCell=e}totals(){let t=0,e=0,s=0;for(const n of this.pending.values())t+=n.m-n.s,e+=n.H,s+=n.s;return{m:t,H:e,s}}any(t){var e;for(let s=0;s<4;s+=1)if((((e=this.pending.get(4*t+s))==null?void 0:e.m)??0)>0)return!0;return!1}give(t,e,s,n,i,r=0,c=-1){const a=this.e.grid,l=this.e.particles,h=this.e.liquid,f=[],u=new Set;let m=0,p=!1;for(let g=0;g<2&&f.length===0;g+=1)for(let y=0;y<t.nseg;y+=1)t.segR[y]!==e||t.segS[y]!==s||Bo(this.e,t,y,w=>{g===0&&(p=!0),!(a.kind[w]!==st||u.has(w))&&(u.add(w),this.inCell(w,x=>{l.mat[x]===ft&&(f.push(x),m+=l.mass[x])}))},g===1);if(f.length===0||!(m>0)){if(!p&&c<0){const g=s<2?[2,3]:[0,1];for(const y of g)this.give(t,e,y,.5*n,.5*i,.5*r,s);return}this.hold(t,e,s,n,i,r,c);return}const d=h.rhoRef*a.vCell/4;for(const g of f){const y=l.mass[g]/m,w=l.mass[g]/l.rho[g],x=l.mass[g]*l.h[g]+y*i;l.mass[g]+=y*n,r>0&&(l.smass[2*g]+=y*r,l.spc[2*g]=Qn),l.h[g]=x/l.mass[g],l.derive(g),h.dVp[g]+=l.mass[g]/l.rho[g]-w,l.mass[g]>tu*d&&this.split(g)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const h of[i,-i]){const f=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*h)),u=n.cellAt(f,e.y[t]);if(u>=0&&n.solid[u]===0&&this.e.bodies.bodyAt(f,e.y[t],0)===null){r=f;break}}if(Number.isNaN(r))return;const c=.5*e.mass[t],a=.5*e.smass[2*t],l=e.add(r,e.y[t],c,e.h[t],e.mat[t],a);l<0||(e.mass[t]=c,e.smass[2*t]=a,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r,c){const a=this.e.grid.dx,[l,h,f,u]=t.bounds(e);let m=s===0?l:s===1?f:.5*(l+f),p=s===2?h:s===3?u:.5*(h+u);c===2?p=Math.min(u,h+.5*a):c===3?p=Math.max(h,u-.5*a):c===0?m=Math.min(f,l+.5*a):c===1&&(m=Math.max(l,f-.5*a));const d=s===0?-1:s===1?1:0,g=s===2?-1:s===3?1:0,y=Math.cos(t.a),w=Math.sin(t.a),x=4*t.index+s;let F=this.pending.get(x);F===void 0&&(F={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1},this.pending.set(x,F)),F.m+=n,F.H+=i,F.s+=r,F.x=t.x+y*m-w*p,F.y=t.y+w*m+y*p,F.nx=y*d-w*g,F.ny=w*d+y*g}spawnAll(t){for(let e=0;e<4;e+=1){const s=this.pending.get(4*t.index+e);s!==void 0&&s.m>0&&this.spawn(t,s)}}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;for(let c=0;c<su&&e.m>0;c+=1){if(e.m<eu*r&&!t.gone)return;const a=(c%2===0?1:-1)*Math.ceil(c/2)*.3*s.dx,l=e.x+.3*s.dx*e.nx-a*e.ny,h=e.y+.3*s.dx*e.ny+a*e.nx,f=this.freeSpot(t,e.x,e.y,l,h)??(t.gone?null:this.outlineSpot(t,l,h));if(f===null)return;const u=Math.min(e.m,r),m=u/e.m,p=n.add(f[0],f[1],u,e.H/e.m,ft,m*e.s);if(p<0)return;n.vx[p]=t.gone?0:t.vx,n.vy[p]=t.gone?0:t.vy,i.placeParticle(p),i.dVp[p]=u/n.rho[p],e.H-=m*e.H,e.s-=m*e.s,e.m-=u,e.m>1e-15||(e.m=0,e.H=0,e.s=0)}}fluidAt(t,e){const s=this.e.grid;if(!(t>0&&e>0&&t<s.w&&e<s.h))return!1;const n=s.cellAt(t,e);return n>=0&&s.solid[n]===0&&this.e.bodies.bodyAt(t,e,0)===null}freeSpot(t,e,s,n,i){const r=this.e.grid,c=(a,l)=>this.fluidAt(a,l)&&!this.e.bodies.blocks(t,e,s,a,l);if(c(n,i))return[n,i];for(let a=1;a<=3;a+=1)for(let l=a;l>=-a;l-=1)for(let h=-a;h<=a;h+=1)if(Math.max(Math.abs(h),Math.abs(l))===a&&c(n+h*r.dx,i+l*r.dx))return[n+h*r.dx,i+l*r.dx];return null}outlineSpot(t,e,s){const n=this.e.grid.dx,i=this.sg,r=Math.cos(t.a),c=Math.sin(t.a);let a=null,l=1/0;for(let h=0;h<t.nseg;h+=1){t.segment(h,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),u=Math.max(1,Math.ceil(f/(.5*n)));for(let m=0;m<u;m+=1){const p=(m+.5)/u,d=i[0]+p*(i[2]-i[0]),g=i[1]+p*(i[3]-i[1]),y=d+.3*n*i[4],w=g+.3*n*i[5],x=t.x+r*y-c*w,F=t.y+c*y+r*w,_=(x-e)*(x-e)+(F-s)*(F-s);_<l&&this.fluidAt(x,F)&&!this.e.bodies.blocks(t,t.x+r*d-c*g,t.y+c*d+r*g,x,F)&&(l=_,a=[x,F])}}return a}}const iu=.3,ru=1.6,mi=.25,ha=.5,wr=1e-6;class ou{constructor(t){v(this,"water");v(this,"melted",0);v(this,"frozen",0);v(this,"head",new Int32Array(0));v(this,"next",new Int32Array(0));v(this,"listed",!1);this.e=t,this.water=new nu(t,(e,s)=>this.inCell(e,s))}pendingTotals(){return this.water.totals()}any(){return this.e.bodies.list.some((t,e)=>!t.gone&&Ge(t.mat)>0||this.water.any(e))}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&Ge(i.mat)>0&&this.body(i)&&(t=!0),this.water.spawnAll(i)}return t}body(t){const e=pt[t.mat].rho,s=pt[t.mat].cp,n=bn(t.mat),i=new Map,r=new Set,c=new Map;for(let x=0;x<t.nseg;x+=1){const F=4*t.segR[x]+t.segS[x];if(i.has(F))continue;const _=Z0(this.e,t,t.segR[x],t.segS[x],r);i.set(F,_),c.set(F,J0(this.e,t,t.segR[x],t.segS[x],_))}const a=new Map;for(let x=0;x<t.nr;x+=1)this.excess(t,x,i,r,c,a);const l=this.walls(t,[...i.keys()]),h=new Map,f=new Map,u=new Map,m=new Map,p=new Map;for(const[x,F]of i){const _=x>>2,T=x&3,A=s*(F-et)+n,b=_t(F)-A;let k=0;di(t,_,T,(P,C,L)=>{L>0&&(k+=L*C*(b+s*(F-Math.min(F,t.cellT(P)))))});const S=this.planFreeze(t,_,T,F,b);h.set(x,{L:b,hIce:A,denom:k,plan:S});const M=l.get(x);f.set(M,(f.get(M)??0)+(a.get(x)??0)),u.set(M,(u.get(M)??0)+k),m.set(M,(m.get(M)??0)+((S==null?void 0:S.total)??0)),p.set(M,(p.get(M)??0)+ml(t,_,T))}const d=[];for(const[x,F]of i){const _=x>>2,T=x&3,A=l.get(x),b=h.get(x),k=a.get(x)??0,S=f.get(A)??0,M=u.get(A)??0;S>0&&M>0?d.push({r:_,s:T,d:S/(e*t.depth*M),Q:k,Tf:F,hIce:b.hIce,freeze:null}):k>0&&this.giveBack(t,_,T,k);const P=m.get(A)??0;P>0&&d.push({r:_,s:T,d:P/(e*t.depth*p.get(A)),Q:0,Tf:F,hIce:b.hIce,freeze:b.plan??{p:[],dm:[],total:0}})}if(d.length===0)return!1;const g=ma(t),y=this.e.bodies;if(y.cover.release(t),t.nr===1?this.moveSides(t,d):this.slabs(t,d),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,y.changed(),!0;let w=0;if(t.nr>1){const x=[];for(let F=0;F<t.nr;F+=1)x.push(t.bounds(F));w=hl(y,t,x,!1).length}return t.derive(),y.cover.weigh(t),y.cover.addCells(t),d.some(x=>x.freeze!==null)&&y.cover.pushOut(t,t.x,t.y,t.a),y.reshaped(t,w>0||ma(t)!==g),!0}excess(t,e,s,n,i,r){const c=[];for(let d=0;d<4;d+=1)n.has(4*e+d)&&c.push(d);if(c.length===0)for(let d=0;d<4;d+=1)s.has(4*e+d)&&c.push(d);let a=1/0;for(let d=0;d<4;d+=1)a=Math.min(a,s.get(4*e+d)??1/0);if(a===1/0)return;const l=t.xs[e],h=t.ys[e],f=t.ni[e],u=t.nj[e],m=[0,0],p=[0,0];for(let d=0;d<u;d+=1)for(let g=0;g<f;g+=1){const y=t.off[e]+g+d*f,w=t.cellT(y);if(!(w>a))continue;let x=0,F=0;for(let P=0;P<4&&x<2;P+=1){if(!(P===0?g===0:P===1?g===f-1:P===2?d===0:d===u-1))continue;const C=i.get(4*e+P)??0;!(C>0)||!(dl(t,e,P,P<2?h[d]:l[g],P<2?h[d+1]:l[g+1])>0)||(m[x]=P,p[x]=C,F+=C,x+=1)}if(x>0){const P=t.E[y];for(let C=0;C<x;C+=1){const L=4*e+m[C],B=p[C]/F*(P-Yr(t.cellCap(y),t.film[y],t.crust[y],s.get(L)));B>0&&(t.E[y]-=B,r.set(L,(r.get(L)??0)+B))}continue}if(c.length===0)continue;const _=.5*(l[g]+l[g+1]),T=.5*(h[d]+h[d+1]);let A=c[0],b=1/0;for(const P of c){const C=P===0?_-l[0]:P===1?l[f]-_:P===2?T-h[0]:h[u]-T;C<b&&(b=C,A=P)}const k=4*e+A,S=s.get(k);if(!(w>S))continue;const M=t.E[y]-Yr(t.cellCap(y),t.film[y],t.crust[y],S);M>0&&(t.E[y]-=M,r.set(k,(r.get(k)??0)+M))}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,c=this.e.particles,a={p:[],dm:[],total:0},l=h=>{if(!(r.cap[h]>0)||!(r.water[h]>0))return;const f=r.capT[h]/r.cap[h];if(f>=n)return;const u=Math.min(ha*r.water[h],r.cap[h]*(n-f)/Math.max(1,i));if(!(u>0))return;let m=0;this.inCell(h,p=>{if(c.mat[p]!==ft)return;const d=c.mass[p]-c.smass[2*p],g=Math.min(ha*d,u*d/r.water[h]);g>0&&(a.p.push(p),a.dm.push(g),m+=g)}),r.water[h]-=m,r.cap[h]=0,a.total+=m};for(let h=0;h<t.nseg;h+=1)t.segR[h]===e&&t.segS[h]===s&&Bo(this.e,t,h,l);return a.total>0?a:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let c=0;c<t.p.length;c+=1){const a=t.p[c],l=t.dm[c]*e;if(!(l>0))continue;const h=n.mass[a]/n.rho[a],f=n.mass[a]*n.h[a]-l*s;n.mass[a]-=l,n.h[a]=f/n.mass[a],n.derive(a),i.dVp[a]+=n.mass[a]/n.rho[a]-h,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=pt[t.mat].rho,c=Math.min(n,this.rowThickness(t,e,s));let a=0,l=0,h=0,f=0;if(di(t,e,s,(u,m)=>{const p=t.cellVolume(u);if(!(p>0))return;const d=m*c*t.depth/p;l+=d*t.E[u],h+=d*t.film[u],f+=d*t.crust[u],t.E[u]-=d*t.E[u],t.film[u]-=d*t.film[u],t.crust[u]-=d*t.crust[u],a+=r*m*c*t.depth}),this.moveSide(t,e,s,-c),!(a>0)){this.giveBack(t,e,s,i+l);return}this.melted+=a,this.water.give(t,e,s,a+h+f,l+a*bn(t.mat)+i,f)}grow(t,e,s,n,i){const r=pt[t.mat].rho,c=pt[t.mat].cp,a=ua(t,e,s),l=n/(r*t.depth*a);di(t,e,s,(h,f)=>{t.E[h]+=r*f*l*t.depth*c*(i-et)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=ua(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}di(t,e,s,(r,c)=>{t.E[r]+=n*c/i})}slabs(t,e){const s=pt[t.mat].rho,n=pt[t.mat].cp,i=bn(t.mat),r=t.depth,c=e.length,a=this.walls(t,e.map(k=>4*k.r+k.s)),l=e.map(k=>a.get(4*k.r+k.s)),h=new Map;for(const k of e)k.freeze===null&&h.set(4*k.r+k.s,k.d);const f=[];for(let k=0;k<t.nr;k+=1)f.push(t.bounds(k));const u=new Map;for(const k of e)u.set(4*k.r+k.s,(u.get(4*k.r+k.s)??0)+(k.freeze!==null?k.d:-k.d));const m=[],p=[];for(let k=0;k<c;k+=1){const S=e[k],M=f[S.r];for(let P=0;P<t.nseg;P+=1)if(!(t.segR[P]!==S.r||t.segS[P]!==S.s))if(S.freeze===null){const C=t.segT0[P]-this.inner(t,P,!1,h),L=t.segT1[P]+this.inner(t,P,!0,h);m.push(da(S.s,M,C,L,Math.min(S.d,S.s<2?M[2]-M[0]:M[3]-M[1]),!0,k))}else{const C=t.segT0[P]-this.corner(t,S.r,S.s,!1,t.segT0[P],u),L=t.segT1[P]+this.corner(t,S.r,S.s,!0,t.segT1[P],u);L>C&&p.push(da(S.s,M,C,L,S.d,!1,k))}}const d=O0(f,m,p),g=d.taken,y=new Float64Array(c);for(let k=0;k<g.length;k+=5)y[g[k+4]]+=(g[k+2]-g[k])*(g[k+3]-g[k+1]);for(let k=0;k<c;k+=1)e[k].freeze===null&&!(y[k]>0)&&this.giveBack(t,e[k].r,e[k].s,e[k].Q);const w=new Float64Array(c),x=new Float64Array(c),F=new Float64Array(c);for(let k=0;k<g.length;k+=5){const S=g[k+4];this.overlap(t,g[k],g[k+1],g[k+2],g[k+3],(M,P)=>{w[S]+=P*t.E[M],x[S]+=P*t.film[M],F[S]+=P*t.crust[M]})}for(let k=0;k<c;k+=1){const S=e[k];if(S.freeze!==null||!(y[k]>0))continue;const M=s*r*y[k];this.melted+=M,this.water.give(t,S.r,S.s,M+x[k]+F[k],w[k]+M*i+S.Q,F[k])}to(t,d.rects);const _=d.added,T=new Float64Array(c);for(let k=0;k<_.length;k+=5){const S=_[k+4],M=e[S].Tf;T[S]+=(_[k+2]-_[k])*(_[k+3]-_[k+1]),this.overlap(t,_[k],_[k+1],_[k+2],_[k+3],(P,C,L)=>{t.E[P]+=s*r*L*n*(M-et)})}const A=new Map,b=new Map;for(let k=0;k<c;k+=1){const S=e[k].freeze;if(S===null)continue;const M=l[k];A.set(M,(A.get(M)??0)+s*r*T[k]),b.set(M,(b.get(M)??0)+S.total)}for(let k=0;k<c;k+=1){const S=e[k].freeze;if(S===null||!(S.total>0))continue;const M=l[k];this.take(S,A.get(M)/b.get(M),e[k].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let c=r;for(;s.get(c)!==c;)c=s.get(c);return c};if(t.nr>1){const r=wr*t.dx,c=a=>{const l=t.segR[a],h=t.segS[a];return h===0?t.xs[l][0]:h===1?t.xs[l][t.ni[l]]:h===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let a=0;a<t.nseg;a+=1)for(let l=a+1;l<t.nseg;l+=1){if(t.segS[a]!==t.segS[l]||Math.abs(c(a)-c(l))>r||Math.abs(t.segT1[a]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[a])>r)continue;const h=4*t.segR[a]+t.segS[a],f=4*t.segR[l]+t.segS[l];if(!s.has(h)||!s.has(f))continue;const u=n(h),m=n(f);u!==m&&s.set(Math.max(u,m),Math.min(u,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=wr*t.dx,r=t.segR[e],c=t.segS[e],a=s?t.segT1[e]:t.segT0[e],l=c===0?t.xs[r][0]:c===1?t.xs[r][t.ni[r]]:c===2?t.ys[r][0]:t.ys[r][t.nj[r]],h=c<2?l:a,f=c<2?a:l,u=c===0?-1:c===1?1:0,m=c===2?-1:c===3?1:0;for(let p=0;p<t.nseg;p+=1){const d=t.segS[p];if(d<2==c<2)continue;const g=n.get(4*t.segR[p]+d);if(g===void 0)continue;const y=t.segR[p],w=d===0?t.xs[y][0]:d===1?t.xs[y][t.ni[y]]:d===2?t.ys[y][0]:t.ys[y][t.nj[y]];for(const[x,F]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const _=d<2?w:x,T=d<2?x:w;if(Math.abs(_-h)>i||Math.abs(T-f)>i)continue;const A=d<2?w:F,b=d<2?F:w;if((A-h)*u+(b-f)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[c,a,l,h]=t.bounds(e),f=wr*t.dx,u=s<2?n?h:a:n?l:c;if(Math.abs(i-u)>f)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?c:s===1?l:s===2?a:h;for(let d=0;d<t.nseg;d+=1)if(t.segR[d]===e&&t.segS[d]===m&&t.segT0[d]<=p+f&&t.segT1[d]>=p-f)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let c=0;c<t.nr;c+=1){const a=t.xs[c],l=t.ys[c],h=t.ni[c],f=t.nj[c];if(!(a[0]>=n||a[h]<=e||l[0]>=i||l[f]<=s))for(let u=0;u<f;u+=1){const m=Math.min(i,l[u+1])-Math.max(s,l[u]);if(!(m<=0))for(let p=0;p<h;p+=1){const d=Math.min(n,a[p+1])-Math.max(e,a[p]);d<=0||r(t.off[c]+p+u*h,d*m/((a[p+1]-a[p])*(l[u+1]-l[u])),d*m)}}}}tidy(t){const e=t.dx;let s=!1;for(let c=0;c<t.nr;c+=1){const[a,l,h,f]=t.bounds(c);if(h-a<mi*e||f-l<mi*e){s=!0;continue}for(let u=0;u<4;u+=1){const m=this.rowThickness(t,c,u),p=u<2?t.ni[c]:t.nj[c];(m<iu*e&&p>1||m>ru*e)&&(s=!0)}}if(!s)return;const n=pt[t.mat].rho,i=bn(t.mat),r=[];for(let c=0;c<t.nr;c+=1){const[a,l,h,f]=t.bounds(c);if(h-a>=mi*e&&f-l>=mi*e){r.push([a,l,h,f]);continue}const u=n*(h-a)*(f-l)*t.depth;let m=0,p=0,d=0;for(let g=t.off[c];g<t.off[c]+t.ni[c]*t.nj[c];g+=1)m+=t.E[g],p+=t.film[g],d+=t.crust[g];this.melted+=u,this.water.give(t,c,Y0(t,c),u+p+d,m+u*i,d)}to(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function da(o,t,e,s,n,i,r){const[c,a,l,h]=t;return o===0?i?{x0:c,y0:e,x1:c+n,y1:s,move:r}:{x0:c-n,y0:e,x1:c,y1:s,move:r}:o===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:o===2?i?{x0:e,y0:a,x1:s,y1:a+n,move:r}:{x0:e,y0:a-n,x1:s,y1:a,move:r}:i?{x0:e,y0:h-n,x1:s,y1:h,move:r}:{x0:e,y0:h,x1:s,y1:h+n,move:r}}function ma(o){let t=o.nr*7919+o.nseg;for(let e=0;e<o.nseg;e+=1)t=Math.imul(t,31)+4*o.segR[e]+o.segS[e]|0;return t}const ae=8;class au{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*lt),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*ae),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<lt;i+=1)this.m[n*lt+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<ae;i+=1)this.force[n*ae+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<lt;s+=1)e+=this.m[t*lt+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<lt;s+=1)this.m[t*lt+s]=this.m[e*lt+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<ae;s+=1)this.force[t*ae+s]=this.force[e*ae+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const xl=200;function br(o,t,e,s){const n=kt(o);return t/ke(n)-e*Rt*n/(s-o)}function cu(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function lu(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function fu(o,t,e,s,n,i,r,c=ft){const a=o[t+Y],l=o[t+at]/gt[at]+o[t+ct]/gt[ct],h=a/gt[Y];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(h+l)*Rt*s/e)/(4*Math.PI)),u=e,m=0,p=s,d=0;for(let g=0;g<8;g+=1){if(u=e+2*zs(c,p)/f,l<=0)m=u,p=kt(m),d=a/ke(p);else if(h<=1e-9*l)m=0,p=s,d=l*Rt*p/u;else{let w=611.213,x=u*(1-1e-12),F=br(w,a,l,u),_=br(x,a,l,u);if(F<=0)m=w;else if(_>=0)m=x;else{let T=0;m=.5*(w+x);for(let A=0;A<40;A+=1){m=(w*_-x*F)/(_-F);const b=br(m,a,l,u);if(Math.abs(b)<=1e-12*(a/ke(s)+1e-30))break;b>0?(w=m,F=b,T===1&&(_/=2),T=1):(x=m,_=b,T===-1&&(F/=2),T=-1)}}p=kt(m),d=a/ke(p)}const y=cu(d,n);if(Math.abs(y-f)<=1e-7*f){f=y;break}f=y}r.r=f,r.V=d,r.pb=e+2*zs(c,p)/f,r.pv=m,r.Tb=p,lu(d,f,n,r)}function pa(o,t,e,s){let n=0;for(let i=0;i<lt;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function ga(o,t,e,s,n,i,r,c,a,l){let h=0;if(2*e<=3*i){const y=o/i-.5,w=t/i-.5,x=Math.floor(y-.5),F=Math.floor(w-.5),_=y-x,T=w-F,A=.5*(1.5-_)**2,b=.75-(_-1)**2,k=.5*(_-.5)**2,S=.5*(1.5-T)**2,M=.75-(T-1)**2,P=.5*(T-.5)**2;let C=0;for(let L=0;L<3;L+=1){const B=F+L;if(B<0||B>=c)continue;const I=L===0?S:L===1?M:P;for(let j=0;j<3;j+=1){const E=x+j;if(E<0||E>=r)continue;const R=I*(j===0?A:j===1?b:k);a[h]=E+B*r,l[h]=R,C+=R,h+=1}}for(let L=0;L<h;L+=1)l[L]/=C;return h}const f=s<=Math.PI*n*n*n/6,u=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),d=Math.min(c-1,Math.floor((t+e)/i));let g=0;for(let y=p;y<=d;y+=1)for(let w=u;w<=m;w+=1){let x=0;for(let F=0;F<4;F+=1){const _=(y+(F+.5)/4)*i-t;for(let T=0;T<4;T+=1){const A=(w+(T+.5)/4)*i-o,b=e*e-A*A-_*_;b>0&&(x+=f?Math.sqrt(b):1)}}x<=0||h>=a.length||(a[h]=w+y*r,l[h]=x,g+=x,h+=1)}if(g<=0)return a[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(c-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let y=0;y<h;y+=1)l[y]/=g;return h}function xa(o,t,e,s,n,i){const{nx:r,ny:c}=o,a=e%r,l=(e-a)/r;let h=0,f=0;for(let u=0;u<=6&&(h===0||f<2*s);u+=1)for(let m=0;m<=u;m+=1)for(let p=-u;p<=u;p+=1){if(Math.max(Math.abs(p),m)!==u)continue;const d=a+p,g=l+m;if(d<0||g<0||d>=r||g>=c)continue;const y=d+g*r;if(o.kind[y]!==G||h>=n.length)continue;const w=Math.max(.001*o.vCell,t[y]);n[h]=y,i[h]=w,f+=w,h+=1}for(let u=0;u<h;u+=1)i[u]/=f;return h}function va(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===G)return e+s*o.nx;return-1}const Os=.5;class uu{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,c=n.liquid,a=r.x[t],l=r.y[t],h=r.r[t],f=r.V[t],u=Math.max(h+i.dx,2*i.dx),m=this.vel;let p=0,d=0;for(let K=0;K<8;K+=1){const z=K*Math.PI/4;c.velocityAt(a+u*Math.cos(z),l+u*Math.sin(z),m),p+=m[0]/8,d+=m[1]/8}const g=i.cellAt(a,l),y=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],w=g>=0?n.phase.host[g]:0,x=n.phase.mixed?_s(w,y):c.rhoRef,F=On(w,y),_=r.totalMass(t)/Math.max(1e-30,f),T=(p-this.ux0[t])/Math.max(e,1e-6),A=(d-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=d,h<2e-5){r.vx[t]=p,r.vy[t]=d,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,a+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*d));return}const b=r.vx[t]-p,k=r.vy[t]-d,S=Math.hypot(b,k),M=2*h,P=Math.max(1e-6,x*S*M/F),C=Math.max(0,n.gy)*(x-_)*M*M/zs(w,y),B=.5*Math.max(24/P*(1+.15*Math.pow(P,.687)),8/3*(C/(C+4)))*x*this.front(t)*S,I=(_+Os*x)*f,j=x*f*T,E=x*f*(A+n.gy),R=-_*f*n.gy,W=Os*x*f*T,V=Os*x*f*A,Z=s>0?Os*x*s:0,it=s<0?Math.min(-s,.2*f/e):0,dt=Os*x*it*b,q=Os*x*it*k,N=(I*r.vx[t]+e*(j+W+dt)+e*(B+Z)*p)/(I+e*(B+Z)),U=(I*r.vy[t]+e*(E+R+V+q)+e*(B+Z)*d)/(I+e*(B+Z));r.vx[t]=Number.isFinite(N)?N:p,r.vy[t]=Number.isFinite(U)?U:d;const J=-B*(N-p),wt=-B*(U-d),mt=t*ae;r.force[mt]=j,r.force[mt+1]=E,r.force[mt+2]=0,r.force[mt+3]=R,r.force[mt+4]=J,r.force[mt+5]=wt,r.force[mt+6]=W+dt-Z*(N-p),r.force[mt+7]=V+q-Z*(U-d),this.spreadForce(a,l,h,-(J+r.force[mt+6])*(e/n.dt),-(wt+r.force[mt+7])*(e/n.dt));let D=a+e*N,$=l+e*U;const Q=i.sdfAt(D,$);if(Q<h){const K=.25*i.dx;let z=i.sdfAt(D+K,$)-i.sdfAt(D-K,$),ut=i.sdfAt(D,$+K)-i.sdfAt(D,$-K);const rt=Math.hypot(z,ut);if(rt>1e-12){z/=rt,ut/=rt,D+=(h-Q)*z,$+=(h-Q)*ut;const bt=r.vx[t]*z+r.vy[t]*ut;bt<0&&(r.vx[t]-=bt*z,r.vy[t]-=bt*ut)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,D)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,$));const O=i.depth;r.z[t]=2*h>=O?O/2:Math.min(O-h,Math.max(h,r.z[t]))}spreadForce(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:a,ny:l,dx:h}=c;if(s>h&&this.spreadRing(t,e,s,n,i))return;const f=this.w3;let u=Math.floor(t/h-.5),m=t/h-u;f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2;let p=Math.floor(e/h-1);m=e/h-.5-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const y=u+g,w=p+d;y<0||y>a||w<0||w>=l||(r.fU[y+w*(a+1)]+=n*f[g]*f[3+d])}u=Math.floor(t/h-1),m=t/h-.5-u,f[0]=.5*(1.5-m)**2,f[1]=.75-(m-1)**2,f[2]=.5*(m-.5)**2,p=Math.floor(e/h-.5),m=e/h-p,f[3]=.5*(1.5-m)**2,f[4]=.75-(m-1)**2,f[5]=.5*(m-.5)**2;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1){const y=u+g,w=p+d;y<0||y>=a||w<0||w>l||(r.fV[y+w*a]+=i*f[g]*f[3+d])}}spreadRing(t,e,s,n,i){const r=this.e.liquid,c=this.e.grid,{nx:a,ny:l,dx:h}=c,f=c.phi,u=Math.max(1.5*s,s+2*h),m=s*s,p=u*u,d=Math.max(0,Math.floor((t-u)/h)),g=Math.min(a,Math.ceil((t+u)/h)),y=Math.max(0,Math.floor((e-u)/h)),w=Math.min(l,Math.ceil((e+u)/h));let x=0,F=0;for(let _=0;_<2;_+=1){if(_===1){if(!(x>0)||!(F>0))return!1;x=n/x,F=i/F}for(let T=y;T<=w;T+=1)for(let A=d;A<=g;A+=1){if(T<l){const b=A*h-t,k=(T+.5)*h-e,S=b*b+k*k;if(S>=m&&S<=p){const M=A+T*a,P=.5*((A>0?f[M-1]:0)+(A<a?f[M]:0));P>0&&(_===0?x+=P:r.fU[A+T*(a+1)]+=x*P)}}if(A<a){const b=(A+.5)*h-t,k=T*h-e,S=b*b+k*k;if(S>=m&&S<=p){const M=A+T*a,P=.5*((T>0?f[M-a]:0)+(T<l?f[M]:0));P>0&&(_===0?F+=P:r.fV[M]+=F*P)}}}}return!0}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,c=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=c)return 2*i*s;const a=(n-r)/(c-r);return(1-a)*(Math.PI*s*s)/4+a*s*s}}class vl{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function ya(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const hu=8,du=210,wa=1.805,mu=3e-7;function eo(o,t){const e=kt(t);return kt(t+2*$n(e)/o)-e}const fe=class fe{constructor(){v(this,"count",0);v(this,"fixed",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"mat",new Uint8Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"nx",new Float32Array(0));v(this,"ny",new Float32Array(0));v(this,"body",new Int16Array(0));v(this,"seg",new Int32Array(0));v(this,"t",new Float32Array(0));v(this,"pos",new Float64Array(2));v(this,"sg",new Float64Array(6))}static rRef(){if(fe.ref>0)return fe.ref;const t=kt(Sn),e=2*$n(t)/(qn(t+1)-Sn);return fe.ref=du*e,fe.ref}static draw(t,e,s,n){const i=pt[s],r=fe.rRef(),c=fe.rng;c.state=t||1;const a=Math.pow(r/i.cavRmax,wa);let l=0;for(let h=0;h<hu;h+=1){l+=c.exp();const f=r*Math.pow(l/(e*i.cavScale)+a,-1/wa);if(f<mu)break;n.r.push(f),n.s.push(c.next()),n.z.push(c.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,c=[],a=[],l=[],h=[],f=[],u=[],m=[],p={r:[],s:[],z:[]};for(let F=0;F<t.n;F+=1){if(t.solid[F]===0||t.owner[F]!==0)continue;const _=F%n,T=(F-_)/n;for(let A=0;A<4;A+=1){const b=A===0?_-1:A===1?_+1:_,k=A===2?T-1:A===3?T+1:T;if(b<0||k<0||b>=n||k>=i)continue;const S=b+k*n;if(t.solid[S]===0){p.r.length=0,p.s.length=0,p.z.length=0,fe.draw(ya(e,F,A),r,t.solid[F]-1,p);for(let M=0;M<p.r.length;M+=1)c.push(F),a.push(S),l.push(A),h.push(p.r[M]),f.push(p.s[M]),u.push(p.z[M]),m.push(t.solid[F]-1)}}}const d=c.length,g=[],y=[],w=[];for(const F of s)if(!F.gone)for(let _=0;_<F.nseg;_+=1){F.segment(_,this.sg);const T=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),A=Math.max(1,Math.round(T/t.dx));for(let b=0;b<A;b+=1){p.r.length=0,p.s.length=0,p.z.length=0,fe.draw(ya(e,1e5+1e3*F.key+_,b),T/A*t.depth,F.mat,p);for(let k=0;k<p.r.length;k+=1)c.push(-1),a.push(-1),l.push(F.segS[_]),h.push(p.r[k]),f.push(p.s[k]),u.push(p.z[k]),m.push(F.mat),g.push(F.index),y.push(_),w.push((b+p.s[k])/A)}}const x=c.length;this.count=x,this.fixed=d,this.cell=Int32Array.from(c),this.fluid=Int32Array.from(a),this.dir=Uint8Array.from(l),this.r=Float32Array.from(h),this.s=Float32Array.from(f),this.z=Float32Array.from(u),this.bubble=new Uint32Array(x),this.mat=Uint8Array.from(m),this.px=new Float64Array(x),this.py=new Float64Array(x),this.nx=new Float32Array(x),this.ny=new Float32Array(x),this.body=new Int16Array(x).fill(-1),this.seg=new Int32Array(x),this.t=new Float32Array(x);for(let F=0;F<d;F+=1){const _=this.cell[F],T=_%n,A=(_-T)/n,b=this.s[F],k=this.dir[F],S=t.dx;this.px[F]=k===0?T*S:k===1?(T+1)*S:(T+b)*S,this.py[F]=k===2?A*S:k===3?(A+1)*S:(A+b)*S,this.nx[F]=k===0?-1:k===1?1:0,this.ny[F]=k===2?-1:k===3?1:0}for(let F=d;F<x;F+=1)this.body[F]=g[F-d],this.seg[F]=y[F-d],this.t[F]=w[F-d];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const c=this.t[i],a=this.sg[0]+c*(this.sg[2]-this.sg[0]),l=this.sg[1]+c*(this.sg[3]-this.sg[1]),h=Math.cos(r.a),f=Math.sin(r.a),u=r.x+h*a-f*l,m=r.y+f*a+h*l,p=h*this.sg[4]-f*this.sg[5],d=f*this.sg[4]+h*this.sg[5];this.px[i]=u,this.py[i]=m,this.nx[i]=p,this.ny[i]=d,this.dir[i]=Math.abs(p)>=Math.abs(d)?p<0?0:1:d<0?2:3;const g=t.cellAt(u-n*p,m-n*d),y=t.cellAt(u+n*p,m+n*d);this.cell[i]=g,this.fluid[i]=y>=0&&t.solid[y]===0?y:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)pt[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};v(fe,"ref",0),v(fe,"rng",new vl(1));let so=fe;const pu=.0208,gu=1;class xu{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new so);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new uu(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return eo(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:c}=n,a=Math.min(i-1.0001,Math.max(0,t/c-.5)),l=Math.min(r-1.0001,Math.max(0,e/c-.5)),h=Math.floor(a),f=Math.floor(l),u=a-h,m=l-f;let p=0,d=0;for(let g=0;g<2;g+=1)for(let y=0;y<2;y+=1){const w=h+y+(f+g)*i;if(n.solid[w]!==0)continue;const x=(y===0?1-u:u)*(g===0?1-m:m);p+=x*n.pl[w],d+=x}return Math.max(.5*s.pRef,s.pRef+(d>0?p/d:0))}liquidFootprint(t){const s=this.e.grid,n=this.B,i=ga(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,c=0;for(let a=0;a<i;a+=1){const l=this.cells[a];s.kind[l]===st&&(this.cells[c]=l,this.wts[c]=this.wts[a],r+=this.wts[a],c+=1)}for(let a=0;a<c;a+=1)this.wts[a]/=r;return r>0?c:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;fu(s.m,t*lt,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:c}=s;for(let l=0;l<r;l+=1){if(c[l]!==st){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const h=Math.max(.5*e.pRef,e.pRef+s.pl[l]),f=i.boilingAt(l,h);this.tsatCell[l]=f,i.salty&&(this.dTb[l]=f-kt(h)),this.budget[l]=i.Cl[l]*(i.Tl[l]-f)}this.Fm.fill(0),e.extremes.beginStep();const a=e.waterTemperature();if(this.bulkCold=a.mass>0&&a.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);if(this.coalesce(),e.extremes.normalize)for(let l=0;l<n.count;l+=1)n.r[l]>e.extremes.bubbleCap&&this.vent(l);for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const c=this.sites.fluid[r],a=this.sites.cell[r];if(c<0||a<0||s.kind[c]!==st||i.acc[c]<=0||i.waterShare(c)<.5||!e.heat.hasSolid(a))continue;const l=pt[this.sites.mat[r]],h=i.Tl[c],f=Fn(i.host[c],h),u=(l.k*s.Ts[a]+f*h)/(l.k+f),m=Math.max(.5*e.pRef,e.pRef+s.pl[c]),p=this.tsatCell[c]>0?this.tsatCell[c]:kt(m);if(u-p<0)continue;const d=this.sites.r[r];if(u-p<e.extremes.activation(eo(d,m)))continue;const g=m+2*zs(i.host[c],u)/d,y=kt(g),w=4/3*Math.PI*d*d*d,x=ke(y)*w;if(x*4>i.acc[c])continue;const F=this.sites.position(this.e.grid,r,d),_=n.add(F[0],F[1],Math.min(s.depth-d,Math.max(d,this.sites.z[r]*s.depth)));if(_<0)return;n.m[_*lt+Y]=x,n.r[_]=d,n.V[_]=w,n.Tb[_]=y,n.pb[_]=g,n.pv[_]=g,n.H[_]=x*xt(y),n.site[_]=r,n.age[_]=0,this.sites.bubble[r]=n.id[_],this.motion.ux0[_]=0,this.motion.uy0[_]=0;const T=i.waterH(c);this.Fm[c]-=x,e.heat.src[a]-=x*(xt(y)-T)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=u-p,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,c=t*lt;let a=i.site[t],l=0;const h=i.V[t];let f=0,u=h;for(;l<e-1e-12;){u=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let d=Math.min(e-l,Math.max(1e-7,gu*i.age[t]),.25*n.dx/(p+1e-9));d<1e-7&&(d=Math.min(e-l,1e-7));let g,y=-1,w=0;if(a>=0){const D=this.sites.fluid[a],$=this.sites.cell[a];if(D<0||$<0||!s.heat.hasSolid($)){this.detach(t),a=-1;continue}const Q=pt[this.sites.mat[a]],O=r.Tl[D],K=Fn(r.host[D],O);g=(Q.k*n.Ts[$]+K*O)/(Q.k+K),y=$}else{if(w=this.liquidFootprint(t),w===0)break;g=0;for(let D=0;D<w;D+=1)g+=this.wts[D]*r.Tl[this.cells[D]]}let x=0;if(r.salty)if(a>=0)x=this.dTb[this.sites.fluid[a]];else for(let D=0;D<w;D+=1)x+=this.wts[D]*this.dTb[this.cells[D]];const F=i.Tb[t],_=a>=0?r.host[this.sites.fluid[a]]:r.hostAt(i.x[t],i.y[t]),T=Fn(_,g),A=_s(_,g),b=Ao(_,g),k=On(_,g),S=T/(A*b),M=2*m,P=i.age[t],C=T*Math.sqrt(3/(Math.PI*S)),L=a>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),B=A*L*M/k,I=k*b/T,j=T/M*(2+.6*Math.sqrt(B)*Math.cbrt(I)),E=xt(F)-_t(g);let R=Math.max(C*2*(Math.sqrt(P+d)-Math.sqrt(P)),j*d);if(a>=0&&g>F+x){const D=.5*this.fritz(t,g),$=i.m[c+Y]>0?i.m[c+Y]/i.V[t]:ke(F),Q=R*(g-F-x)/($*E);if(m<D&&m+Q>D&&Q>0){const O=R*(D-m)/Q;if(j*d>=C*2*(Math.sqrt(P+d)-Math.sqrt(P)))d=O/j;else{const K=Math.sqrt(P)+O/(2*C);d=K*K-P}d=Math.max(1e-9,Math.min(e-l,d*(1+1e-6))),R=Math.max(C*2*(Math.sqrt(P+d)-Math.sqrt(P)),j*d)}}const W=n.depth,V=i.V[t],Z=i.m[c+Y]>0?i.m[c+Y]/V:ke(F),it=R*(g-F-x)/(Z*E),dt=Math.max(0,m+it);let q;V<=Math.PI*W*W*W/6?q=4/3*Math.PI*(dt*dt*dt-m*m*m):V>=Math.PI*W*W*W/4?q=Math.PI*W*(dt*dt-m*m):q=Math.PI*W*W*R*(g-F-x)/(Z*E);let N=Z*q*E;if(a>=0){const D=y,$=s.heat.solidCap(D)*Math.max(0,n.Ts[D]-F);if(N>0&&(N=Math.min(N,Math.max(0,$-this.used(D)))),N>0){const Q=N;N=Math.min(N,s.extremes.wallLeft(D,e)),s.extremes.takeWall(D,N,Q)}}else{let D=0;for(let $=0;$<w;$+=1)D+=this.wts[$]*this.budget[this.cells[$]];N>0?N=Math.min(N,Math.max(0,D)):N=Math.max(N,Math.min(0,D))}let U=N/E;U<0&&(U=Math.max(U,-i.m[c+Y]));let J=1,wt=!1;if(a<0&&U!==0&&!r.mixed)for(let D=0;D<w&&!wt;D+=1)wt=r.acc[this.cells[D]]<=0;const mt=D=>r.acc[D]>0?r.waterShare(D):0;if(a<0&&U!==0&&(r.mixed||wt)){J=0;for(let D=0;D<w;D+=1)J+=this.wts[D]*mt(this.cells[D]);U*=J}if(U!==0){if(a>=0){const D=this.sites.fluid[a];U>0&&r.acc[D]+this.Fm[D]-U<0&&(U=Math.max(0,r.acc[D]+this.Fm[D]));const $=r.waterH(D);this.Fm[D]-=U,s.heat.src[y]-=U*(xt(F)-$)/e,this.budgetSolid(y,U*(xt(F)-$))}else for(let D=0;D<w;D+=1){const $=this.cells[D],Q=r.mixed||wt?this.wts[D]*mt($)/J:this.wts[D];if(Q===0)continue;const O=r.waterH($);this.Fm[$]-=U*Q,s.heat.src[$]-=U*Q*(xt(F)-O)/e,this.budget[$]-=U*Q*(xt(F)-O)}i.m[c+Y]+=U,i.H[t]+=U*xt(F),f+=U}if(this.solve(t,g),this.restoreEnthalpy(t,a,w,e),i.r[t]<1e-6||i.m[c+Y]<=1e-18&&i.m[c+at]+i.m[c+ct]<=0){i.age[t]+=d;break}if(a>=0){const D=this.sites.position(this.e.grid,a,i.r[t]);i.x[t]=D[0],i.y[t]=D[1],this.departure(t,g),a=i.site[t]}else this.motion.move(t,d,(i.V[t]-u)/d);if(i.age[t]+=d,l+=d,i.m[c+Y]<=0&&i.m[c+at]+i.m[c+ct]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,c=pa(r.m,t*lt,r.Tb[t],re),a=c-r.H[t];if(a===0)return;if(e>=0){r.H[t]=c,i.heat.src[this.sites.cell[e]]-=a/n;return}const l=i.phase.Cl;let h=0;for(let f=0;f<s;f+=1)l[this.cells[f]]>0&&(h+=this.wts[f]);if(h>0){r.H[t]=c;for(let f=0;f<s;f+=1){const u=this.cells[f];l[u]>0&&(i.heat.src[u]-=a*this.wts[f]/(h*n))}}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=pt[this.sites.mat[i]],c=this.contactAngleOverride??r.contactAngle,a=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return pu*c*Math.sqrt(zs(l,n.Tb[t])/(s.gy*(_s(l,e)-a)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),c=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(c<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=c,this.departureCount+=1;const a=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],a),this.motion.ux0[t]=a[0],this.motion.uy0[t]=a[1],n.vx[t]=a[0],n.vy[t]=a[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let c=0;for(let l=0;l<s.count;l+=1){const h=e.cellAt(s.x[l],s.y[l]);if(h<0){this.next[l]=-1;continue}this.next[l]=this.head[h],this.head[h]=l,s.r[l]>c&&(c=s.r[l])}const a=Math.ceil(2*c/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const h=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let u=Math.max(0,f-a);u<=Math.min(i-1,f+a);u+=1)for(let m=Math.max(0,h-a);m<=Math.min(n-1,h+a);m+=1)for(let p=this.head[m+u*n];p>=0;p=this.next[p]){if(p<=l||s.V[p]<=0)continue;const d=s.x[p]-s.x[l],g=s.y[p]-s.y[l],y=e.depth,x=2*s.r[l]>=y||2*s.r[p]>=y?0:s.z[p]-s.z[l],F=s.r[l]+s.r[p];d*d+g*g+x*x>=F*F||this.merge(l,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let c=0;c<lt;c+=1)s.m[t*lt+c]+=s.m[e*lt+c],s.m[e*lt+c]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.V[t]=r,s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*lt,c=i.totalMass(t);if(i.V[t]<=0||c<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Y]<=1e-18&&i.m[r+at]+i.m[r+ct]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const a=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(a<0||n.kind[a]===G||l<0||n.kind[l]===G)&&this.drop(t,!0,e)}vent(t){const e=this.e,s=e.grid,n=this.B,i=s.n,r=t*lt,c=e.extremes.bubbleCap,a=2*c<=s.depth?4/3*Math.PI*c*c*c:Math.PI*c*c*s.depth;if(!(n.V[t]>a))return;const l=1-a/n.V[t];let h=s.cellAt(n.x[t],Math.min(s.h-1e-9,n.y[t]+n.r[t]));for(;h>=0&&s.kind[h]!==G;)h=h+s.nx<i?h+s.nx:-1;if(h<0&&(h=va(s,n.x[t])),h<0)return;const f=xa(s,e.gas.vgas,h,l*n.V[t],this.cells,this.wts);for(let u=0;u<f;u+=1){const m=this.cells[u],p=this.wts[u];for(let d=0;d<lt;d+=1)s.mg[d*i+m]+=p*l*n.m[r+d];s.Hg[m]+=p*l*n.H[t],e.gas.deriveCell(m)}e.extremes.vented+=l*n.m[r+Y],this.burstVapour+=l*n.m[r+Y];for(let u=0;u<lt;u+=1)n.m[r+u]*=1-l;n.H[t]*=1-l,n.V[t]=a,n.r[t]=c}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,c=t*lt,a=i.n,l=r.m[c+Y],h=r.m[c+at]+r.m[c+ct];if(e||h>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==G;)m=m+i.nx<a?m+i.nx:-1;if(m<0&&(m=va(i,r.x[t])),m>=0){const p=xa(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let d=0;d<p;d+=1){const g=this.cells[d],y=this.wts[d];for(let w=0;w<lt;w+=1)i.mg[w*a+g]+=y*r.m[c+w];i.Hg[g]+=y*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let d=1;if(p.mixed){d=0;for(let g=0;g<m;g+=1)d+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const y=this.cells[g],w=p.mixed&&d>0?this.wts[g]*p.waterShare(y)/d:this.wts[g];if(w===0)continue;const x=p.waterH(y);this.Fm[y]+=l*w,n.heat.src[y]+=w*(r.H[t]-l*x)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[Y*a+p]+=l,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const u=r.count-1;if(t!==u){this.motion.ux0[t]=this.motion.ux0[u],this.motion.uy0[t]=this.motion.uy0[u];const m=r.site[u];m>=0&&(this.sites.bubble[m]=r.id[u])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let h=0;h<n.count;h+=1){const f=ga(n.x[h],n.y[h],n.r[h],n.V[h],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let u=0;u<f;u+=1)i[this.cells[u]]+=this.wts[u]*n.V[h]*r}const c=s.alpha,a=e.liquid.volSrc,l=xl*t;for(let h=0;h<s.n;h+=1){const f=Math.min(i[h],Math.max(0,1-s.phiS[h])),u=f-c[h];u!==0&&(u>l?(a[h]+=l*s.vCell/t,c[h]+=l):u<-l?(a[h]-=l*s.vCell/t,c[h]-=l):(a[h]+=u*s.vCell/t,c[h]=f))}}spawn(t,e,s,n,i){const r=this.e,c=this.B,a=c.add(t,e,s);if(a<0)return-1;const l=this.pressure(t,e),h=r.grid.cellAt(t,e),f=h>=0&&r.phase.Tl[h]>0?r.phase.Tl[h]:r.ambientT,u=l+2*zs(h>=0?r.phase.host[h]:0,f)/n,m=4/3*Math.PI*n*n*n,p=a*lt;if(i<=0){const d=kt(u);c.m[p+Y]=ke(d)*m}else{const d=u*m/(8.314462618*f);c.m[p+at]=d*.79*gt[at],c.m[p+ct]=d*.21*gt[ct]}return c.r[a]=n,this.solve(a,f),c.H[a]=pa(c.m,p,c.Tb[a],re),r.ledger.water+=c.m[p+Y],r.ledger.air+=c.m[p+at]+c.m[p+ct],r.ledger.energy+=c.H[a],this.motion.ux0[a]=0,this.motion.uy0[a]=0,a}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*lt,n=t*ae;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+Y],ma:e.m[s+at]+e.m[s+ct],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+ae))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ht}}const yl=20,wl=.1,bl=2,Fl=.004,_l=1.5,ba=.006,Fa=2;function vu(o,t,e){const s=o==="normalize";return{chf:Al(t,e)*(s?wl:1),actMax:s?bl:1e30,vmax:s?_l:yl,bubCap:s?Fl:1e30}}function Al(o,t){const e=kt(o),s=ke(e),n=nn(e);return .149*Math.sqrt(s)*Fo(e)*Math.pow(Math.max(0,$n(e)*t*(n-s)),.25)}class yu{constructor(t){v(this,"pending",null);v(this,"asked",!1);v(this,"heldHeat",0);v(this,"vented",0);v(this,"slowed",0);v(this,"maxBubble",0);v(this,"maxSpeed",0);v(this,"wall",new Float64Array(0));v(this,"flux",0);this.e=t}get mode(){return this.e.scene.extremes}get normalize(){return this.e.scene.extremes==="normalize"}get bubbleCap(){return this.normalize?Fl:1/0}beginStep(){const t=this.e.grid.n;this.wall.length!==t&&(this.wall=new Float64Array(t)),this.wall.fill(-1),this.flux=Al(this.e.regions.pAmb,Math.abs(this.e.gy))*(this.normalize?wl:1)}wallLeft(t,e){if(this.wall[t]<0){const s=this.e.grid;this.wall[t]=this.flux*s.dx*s.depth*e}return this.wall[t]}takeWall(t,e,s){e>0&&(this.wall[t]=Math.max(0,this.wall[t]-e)),s>e&&(this.heldHeat+=s-e)}activation(t){return this.normalize?Math.min(t,bl):t}afterStep(){const t=this.e.particles,e=this.e.bubbles,s=this.normalize?_l:yl;let n=0;for(let r=0;r<t.count;r+=1){const c=Math.hypot(t.vx[r],t.vy[r]);if(c>s){const a=s/c;t.vx[r]*=a,t.vy[r]*=a,this.slowed+=1,n=Math.max(n,s)}else c>n&&(n=c)}let i=0;for(let r=0;r<e.count;r+=1)e.r[r]>i&&(i=e.r[r]);this.maxSpeed=n,this.maxBubble=i,!(this.mode!=="ask"||this.asked)&&(i>ba?(this.pending={kind:"bubble",value:i,time:this.e.time},this.asked=!0):n>Fa&&(this.pending={kind:"speed",value:n,time:this.e.time},this.asked=!0))}observe(t,e,s){this.maxBubble=t,this.maxSpeed=e,!(this.mode!=="ask"||this.asked)&&(t>ba?(this.pending={kind:"bubble",value:t,time:s},this.asked=!0):e>Fa&&(this.pending={kind:"speed",value:e,time:s},this.asked=!0))}take(){const t=this.pending;return this.pending=null,t}reset(){this.pending=null,this.asked=!1,this.heldHeat=0,this.vented=0,this.slowed=0,this.maxBubble=0,this.maxSpeed=0}stats(){return{mode:this.mode,pending:this.pending,maxBubble:this.maxBubble,maxSpeed:this.maxSpeed,heldHeat:this.heldHeat,vented:this.vented,slowed:this.slowed}}}function _a(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const wu={mass:0,energy:0},bu={m:0,H:0,s:0},Fu={salt:0,energy:0};function _u(o,t,e,s,n,i,r=wu,c=[],a=bu,l=Fu){const h=o.n;let f=0,u=0,m=0,p=0,d=0,g=0,y=0;for(let C=0;C<h;C+=1){const L=o.owner[C]!==0||o.capB[C]>0;if(o.kind[C]===ht||o.solid[C]!==0){L||(f+=o.Es[C],d+=o.film[C],g+=o.crust[C]);continue}u+=o.Hg[C],m+=o.mg[Y*h+C],p+=o.mfog[C],y+=o.mg[at*h+C]+o.mg[ct*h+C]}let w=0,x=0,F=0,_=0;for(let C=0;C<t.count;C+=1){w+=t.mass[C]*t.h[C];const L=t.smass[2*C];_+=L,t.mat[C]===ft?x+=t.mass[C]-L:F+=t.mass[C]-L}f+=r.energy,f+=l.energy;let T=0;for(const C of c)C.gone||(f+=C.energy(),d+=C.filmMass(),g+=C.crustMass(),Ge(C.mat)>0&&(T+=C.m));w+=a.H,x+=a.m,_+=a.s;let A=0,b=0;for(let C=0;C<e.count;C+=1)A+=e.H[C],b+=e.m[C*lt+Y],y+=e.m[C*lt+at]+e.m[C*lt+ct];const k=s.pvTerm();i.solids=f,i.liquid=w,i.gas=u,i.bubbles=A,i.pv=k,i.energy=f+w+u+A+k;const S=i.water;S.liquid=x,S.ice=T,S.vapour=m,S.fog=p,S.film=d,S.bubbles=b,S.escaped=n.escapedWater,S.total=x+T+m+p+d+b+n.escapedWater;const M=i.other;M.liquid=F,M.escaped=n.escapedOther,M.total=F+n.escapedOther;const P=i.salt;return P.liquid=_,P.crust=g,P.grains=l.salt,P.floor=r.mass,P.escaped=n.escapedSalt,P.total=_+g+l.salt+r.mass+n.escapedSalt,i.air=y+n.escapedAir,i}function Au(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,grains:0,floor:0,escaped:0,total:0}}}function xn(o,t){o.bodies.list.length!==0&&z0(o.bodies,t,o.ledger)}function ku(o,t){const e=new Float64Array(2),s=o.particles;for(let i=0;i<s.count;i+=1)Bt.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(ti(o,i),o.liquid.removeParticle(i),i-=1);const n=o.bubbles;for(let i=0;i<n.count;i+=1)Bt.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(o.ledger.water-=n.m[i*lt+Y],o.ledger.air-=n.m[i*lt+at]+n.m[i*lt+ct],o.ledger.energy-=n.H[i],n.remove(i),i-=1);o.liquid.weightsDirty=!0}function Fr(o,t,e,s,n,i,r,c,a=-1){const l=o.bodies.adopt(t,e,s,o.opIndex,n,a);if(l===null)return null;i!==0&&o.bodies.turn(l,r,c,i*Math.PI/180),o.ledger.energy+=l.energy(),Ge(l.mat)>0&&(o.ledger.water+=l.m),ku(o,l);const h=o.grid,f=new Map,u=h.dx*h.dx;for(let m=0;m<l.nw;m+=1){const p=l.wc[m];f.set(p,(f.get(p)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*u))}for(const[m,p]of f)p>0&&h.solid[m]===0&&Tu(o,m,Math.min(1,p));return l}function Si(o,t,e){const[s,n,i,r]=fn(t),c=Math.max(0,Math.floor(s/o.dx)),a=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),h=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=l;f<=h;f+=1)for(let u=c;u<=a;u+=1)Ve(t,(u+.5)*o.dx,(f+.5)*o.dx)&&e(u+f*o.nx,u,f)}function Jn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Y*s+t]+e.mfog[t],o.ledger.air-=e.mg[at*s+t]+e.mg[ct*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<lt;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function Tu(o,t,e){if(e>=1){Jn(o,t);return}const s=o.grid,n=s.n;o.ledger.water-=e*(s.mg[Y*n+t]+s.mfog[t]),o.ledger.air-=e*(s.mg[at*n+t]+s.mg[ct*n+t]),o.ledger.energy-=e*s.Hg[t];for(let i=0;i<lt;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function Eo(o,t,e,s){const n=o.grid,i=n.n;Jn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Y*i+t],o.ledger.air+=n.mg[at*i+t]+n.mg[ct*i+t],o.ledger.energy+=n.Hg[t]}function ti(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===ft?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function Ro(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function kl(o,t){const e=o.grains,s=o.grid;for(let n=0;n<e.count;n+=1)(t!==null?!Ve(t,e.x[n],e.y[n]):s.solid[Math.max(0,s.cellAt(e.x[n],e.y[n]))]===0)||(Te[e.mat[n]].dissolves&&(o.ledger.salt-=e.m[n]),o.ledger.energy-=e.enthalpy(n),e.remove(n),n-=1)}function _r(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)Ve(t,e.x[n],e.y[n])&&(ti(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)Ve(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*lt+Y],o.ledger.air-=s.m[n*lt+at]+s.m[n*lt+ct],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function Su(o,t,e,s,n){const i=o.grid,r=pt[e];for(const a of t)i.owner[a]!==0&&i.solid[a]!==0||(i.solid[a]!==0?(o.ledger.energy-=i.Es[a],o.ledger.water-=i.film[a],Ro(o,a)):Jn(o,a),i.owner[a]=0,i.capB[a]=0,i.fs[a]=0,i.crust[a]=0,i.solid[a]=e+1,i.role[a]=0,i.heater[a]=n,i.film[a]=0,i.T[a]=s,i.Es[a]=r.rho*r.cp*i.vCell*(s-et),i.kind[a]=ht,o.ledger.energy+=i.Es[a]);kl(o,null);const c=o.particles;for(let a=0;a<c.count;a+=1){const l=i.cellAt(c.x[a],c.y[a]);l<0||i.solid[l]===0||(ti(o,a),o.liquid.removeParticle(a),a-=1)}o.solidsChanged()}function Mu(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],Ro(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&Eo(o,n,o.ambientT,o.ambientY)}}function Pu(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){_r(o,t.region);const g=new Float64Array(lt);let y=0;for(const[w,x]of Object.entries(t.composition)){const F=w==="N2"?at:w==="O2"?ct:w==="H2O"?Y:-1;F>=0&&(g[F]=x,y+=x)}if(y<=0)g.set(o.ambientY.subarray(0,lt));else for(let w=0;w<Ft;w+=1)g[w]/=y;return Si(e,t.region,w=>{e.solid[w]===0&&Eo(o,w,t.T,g)}),null}_r(o,t.region);const s=te.length;let n=0;for(const[g,y]of Object.entries(t.composition))Kc(g)>=0&&y>0&&(n+=y);const i=t.composition[te[ft].id]??0,r=n>0&&i>0?n/(n+i):0,c=g=>g===ft&&r>0?or(t.T,r):_s(g,t.T),a=new Float64Array(s);let l=0;for(const[g,y]of Object.entries(t.composition)){const w=Ic(g);if(w<0||!(y>0))continue;const x=w===ft&&r>0?y+n:y;a[w]+=x/c(w),l+=x/c(w)}if(l<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)a[g]/=l;const h=new Float64Array(s),f=new Float64Array(s);for(let g=0;g<s;g+=1)h[g]=c(g)*e.vCell/4,f[g]=g===ft&&r>0?sl(t.T,r):df(g,t.T);const u=r*h[ft],m=new Float64Array(s),p=o.particles;let d=!1;return Ta(e,t.region,(g,y)=>{const w=g+y*e.nx;if(e.solid[w]!==0)return;let x=0;for(let F=0;F<2;F+=1)for(let _=0;_<2;_+=1){const T=(g+.25+.5*_)*e.dx,A=(y+.25+.5*F)*e.dx;if(!Ve(t.region,T,A)||e.owner[w]!==0&&o.bodies.bodyAt(T,A,0)!==null)continue;let b=0;for(let P=0;P<s;P+=1)m[P]+=a[P],m[P]>m[b]&&(b=P);m[b]-=1;const k=h[b],S=f[b],M=b===ft?u:0;if(p.add(T,A,k,S,b,M)<0){d=!0;continue}x+=1,b===ft?o.ledger.water+=k-M:o.ledger.other+=k,o.ledger.salt+=M,o.ledger.energy+=k*S}x===4&&Jn(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":d?"fill: particle capacity reached":null}case"grains":{const s=nl(t.material);if(s<0)return`grains: unknown material "${t.material}"`;const n=Te[s],i=n.rho*Nf*e.vCell/4,r=i/(n.rho*Math.PI*t.d*t.d*t.d/6);let c=!1;const a=new Uint8Array(e.n);for(let l=0;l<o.grains.count;l+=1){const h=e.cellAt(o.grains.x[l],o.grains.y[l]);h>=0&&(a[h]=1)}return Ta(e,t.region,(l,h)=>{const f=l+h*e.nx;if(!(e.solid[f]!==0||a[f]!==0))for(let u=0;u<2;u+=1)for(let m=0;m<2;m+=1){const p=(l+.25+.5*m)*e.dx,d=(h+.25+.5*u)*e.dx;if(Ve(t.region,p,d)&&!(e.owner[f]!==0&&o.bodies.bodyAt(p,d,0)!==null)){if(o.grains.add(p,d,i,r,t.T,s)<0){c=!0;continue}n.dissolves&&(o.ledger.salt+=i),o.ledger.energy+=i*n.cp*(t.T-et)}}}),c?"grains: capacity reached":null}case"erase":{xn(o,t.region),_r(o,t.region),kl(o,t.region);const s=[];return Si(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),Mu(o,s),null}case"move":{if(t.region!==null)return Aa(o,t.region,t.dx,t.dy),null;const s=o.bodies.list.filter(a=>!a.gone&&a.key===o.objectKey(t.id??""));if(s.length===0)return`move: no object "${t.id??""}"`;const n=new Float64Array(4),i=[1/0,1/0,-1/0,-1/0];for(const a of s)a.worldBox(a.x,a.y,a.a,n),i[0]=Math.min(i[0],n[0]),i[1]=Math.min(i[1],n[1]),i[2]=Math.max(i[2],n[2]),i[3]=Math.max(i[3],n[3]);const r=.001*e.dx,c=a=>s.includes(a)?!0:(a.worldBox(a.x,a.y,a.a,n),n[0]>=i[0]-r&&n[1]>=i[1]-r&&n[2]<=i[2]+r&&n[3]<=i[3]+r);return Aa(o,{rect:i},t.dx,t.dy,c),null}case"remove":{const s=o.objectKey(t.id);let n=!1;for(const i of o.bodies.list)if(!(i.gone||i.key!==s)){if(X0(o.bodies,i,o.ledger),i.heater>=0){const r=o.heat.heaters[i.heater];r!==void 0&&(r.on=!1)}n=!0}return n?null:`remove: no object "${t.id}"`}case"solid":{const s=Hs(t.material);if(s<0)return`solid: unknown material ${t.material}`;xn(o,t.region);const n=[];if(Si(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,c,a]=t.region.line,l=Math.ceil(Math.hypot(c-i,a-r)/(.5*e.dx))+1;for(let h=0;h<=l;h+=1){const f=e.cellAt(i+(c-i)*h/l,r+(a-r)*h/l);f>=0&&!n.includes(f)&&n.push(f)}}return o.bodies.sync(),Su(o,n,s,t.T,-1),null}case"body":{const s=Hs(t.material);if(s<0)return`body: unknown material ${t.material}`;xn(o,t.region);const n=t.region;let i=null,r,c=t.angle,a,l;if("line"in n){const[h,f,u,m]=n.line,p=Math.max(n.width,Math.hypot(u-h,m-f));a=(h+u)/2,l=(f+m)/2,r=[a-p/2,l-n.width/2,a+p/2,l+n.width/2],c+=Math.atan2(m-f,u-h)*180/Math.PI}else if("circle"in n){const[h,f,u]=n.circle,m=.5*u*Math.sqrt(Math.PI);r=[h-m,f-m,h+m,f+m],a=h,l=f,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[h,f,u,m]=fn(n);r=[h,f,u,m],a=(h+u)/2,l=(f+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return Fr(o,[r],s,t.T,t.pinned,c,a,l),i}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=Hs(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,c=t.y,a=t.y+t.h,l=t.lid?a-n:a,h=[[i,c,r,c+n],[i,c+n,i+n,l],[r-n,c+n,r,l]];t.lid&&h.push([i,l,r,a]);for(const f of h)xn(o,{rect:[...f]});return Fr(o,h,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=Hs(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return xn(o,{rect:[...i]}),Fr(o,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function Aa(o,t,e,s,n){const i=o.grid,{nx:r,ny:c,dx:a}=i,l=[];Si(i,t,w=>{i.solid[w]!==0&&i.owner[w]===0&&l.push(w)});const h=Math.round(e/a),f=Math.round(s/a),u=l.length>0?h*a:e,m=l.length>0?f*a:s;if(u===0&&m===0)return;const p=o.bodies.list.length>0?Q0(o.bodies,t,n):[],d=o.particles,g=o.bubbles;for(let w=0;w<d.count;w+=1){if(!Ve(t,d.x[w],d.y[w]))continue;const x=d.x[w]+u,F=d.y[w]+m;if(x<=0||F<=0||x>=i.w||F>=i.h){ti(o,w),o.liquid.removeParticle(w),w-=1;continue}d.x[w]=x,d.y[w]=F}for(let w=0;w<g.count;w+=1)Ve(t,g.x[w],g.y[w])&&(g.x[w]=Math.min(i.w-1e-6,Math.max(1e-6,g.x[w]+u)),g.y[w]=Math.min(i.h-1e-6,Math.max(1e-6,g.y[w]+m)),g.site[w]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(p.length===0)return;fa(o.bodies,p,u,m),o.bodies.sync();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ka(o);return}const y=l.map(w=>({c:w,s:i.solid[w],role:i.role[w],heater:i.heater[w],T:i.T[w],Es:i.Es[w],film:i.film[w],crust:i.crust[w]}));for(const w of y)o.ledger.energy-=w.Es,o.ledger.water-=w.film,o.ledger.salt-=w.crust,i.solid[w.c]=0,i.role[w.c]=0,i.heater[w.c]=-1,i.Es[w.c]=0,i.film[w.c]=0,i.crust[w.c]=0,i.kind[w.c]=0;for(const w of y){const x=w.c%r+h,F=Math.floor(w.c/r)+f;if(x<0||F<0||x>=r||F>=c)continue;const _=x+F*r;i.solid[_]!==0?(o.ledger.energy-=i.Es[_],o.ledger.water-=i.film[_],Ro(o,_)):Jn(o,_),i.solid[_]=w.s,i.role[_]=w.role,i.heater[_]=w.heater,i.T[_]=w.T,i.Es[_]=w.Es,i.film[_]=w.film,i.crust[_]=w.crust,i.kind[_]=ht,o.ledger.energy+=w.Es,o.ledger.water+=w.film,o.ledger.salt+=w.crust}fa(o.bodies,p,u,m),o.solidsChanged();for(const w of p)o.bodies.cover.pushOut(w,w.x,w.y,w.a);ka(o);for(const w of y)i.solid[w.c]===0&&o.gas.massOf(w.c)<=0&&Eo(o,w.c,o.ambientT,o.ambientY)}function ka(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(ti(o,s),o.liquid.removeParticle(s),s-=1)}}function Ta(o,t,e){const[s,n,i,r]=fn(t),c=Math.max(0,Math.floor(s/o.dx)),a=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),h=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=l;f<=h;f+=1)for(let u=c;u<=a;u+=1)e(u,f)}const Lu=new Set(["pinned","mode","power","target","on"]);function Hi(o,t){const e=o.scene.ops;for(let s=0;s<e.length;s+=1){const n=e[s];if(rn(n)&&n.id===t)return s}return-1}function Cu(o,t){const e=t.T??o.T,s=t.pinned??o.pinned,n=Math.max(-180,Math.min(180,t.angle??o.angle)),i=t.material!==void 0&&Hs(t.material)>=0?t.material:o.material,r=(c,a,l,h)=>c===void 0||!Number.isFinite(c)?a:Math.max(l,Math.min(h,c));switch(o.op){case"body":{const[c,a,l,h]=fn(o.region);if(t.w===void 0&&t.h===void 0)return{...o,T:e,pinned:s,angle:n,material:i};const f=(c+l)/2,u=(a+h)/2,m=r(t.w,l-c,.002,.5),p=r(t.h,h-a,.002,.5);return{...o,region:{rect:[f-m/2,u-p/2,f+m/2,u+p/2]},T:e,pinned:s,angle:n,material:i}}case"beaker":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.01,1),h:r(t.h,o.h,.01,1),lid:t.lid??o.lid};case"hotplate":return{...o,T:e,pinned:s,angle:n,material:i,w:r(t.w,o.w,.005,1),h:r(t.h,o.h,.002,.1),mode:t.mode??o.mode,power:Math.max(0,t.power??o.power),target:t.target??o.target,on:t.on??o.on}}}function Ou(o,t,e){const s=Hi(o,t);if(s<0)return{rebuilt:!1,warning:`object: no "${t}"`};const n=o.scene.ops[s],i=Cu(n,e),r=[...o.scene.ops];if(r[s]=i,Object.entries(e).some(([a,l])=>l!==void 0&&!Lu.has(a)))return o.time>0?{rebuilt:!1,warning:"refused: this setting changes the set-up — change it at the start"}:(o.load({...o.scene,ops:r,quality:o.currentQuality}),{rebuilt:!0,warning:null});o.scene={...o.scene,ops:r};for(const a of o.bodies.list)a.gone||a.key!==s||(e.pinned!==void 0&&o.bodies.pin(a,e.pinned),i.op==="hotplate"&&a.heater>=0&&o.setHeater(a.heater,i.mode,i.power,i.target,i.on));return{rebuilt:!1,warning:null}}function qu(o,t){const e=Hi(o,t);if(e<0)return null;const s=o.scene.ops[e],n=[];let i=0,r=0,c=0,a="gone";for(const l of o.bodies.list){if(l.gone||l.key!==e)continue;const h=Math.cos(l.a),f=Math.sin(l.a);for(let p=0;p<l.nr;p+=1){const[d,g,y,w]=l.bounds(p);for(const[x,F]of[[d,g],[y,g],[y,w],[d,w]])n.push(l.x+h*x-f*F,l.y+f*x+h*F)}i+=l.m;const u=l.m*pt[l.mat].cp;r+=u*l.meanT(),c+=u;const m=l.pinned?"pinned":l.asleep?"asleep":"moving";(a==="gone"||m==="moving")&&(a=m)}return{id:t,kind:s.op,outline:n,T:c>0?r/c:s.T,mass:i,state:a}}const ju=.02;function Iu(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function Bu(o,t){const e=2*Math.max(0,o-ju)*t;return e>1e-8?e/Iu(e):1}function Eu(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:c}=o,a=s+1,l=(x,F)=>.5*(r[x+F*a]+r[x+1+F*a]),h=(x,F)=>.5*(c[x+F*s]+c[x+(F+1)*s]),f=(r[t+1+e*a]-r[t+e*a])/i,u=(c[t+(e+1)*s]-c[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),d=Math.max(0,t-1),g=Math.min(s-1,t+1),y=p>m?(l(t,p)-l(t,m))/((p-m)*i):0,w=g>d?(h(g,e)-h(d,e))/((g-d)*i):0;return Math.hypot(.5*(f-u),.5*(y+w))}class Ru{constructor(t){v(this,"e");v(this,"cap");v(this,"capT");v(this,"capA");v(this,"salt");v(this,"water");v(this,"fH");v(this,"fS");v(this,"outS");v(this,"outH");v(this,"inS");v(this,"inH");v(this,"cell",new Int32Array(0));v(this,"cpp",new Float64Array(0));v(this,"ds",new Float64Array(0));v(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:c,salt:a,water:l,fH:h,fS:f,cell:u,cpp:m}=this;i.fill(0),r.fill(0),c.fill(0),a.fill(0),l.fill(0);let p=!1;for(let x=0;x<e.count;x+=1){const F=s.cellAt(e.x[x],e.y[x]);if(u[x]=F,F<0)continue;const _=e.cp(x);m[x]=_;const T=e.mass[x]*_,A=e.T[x];if(i[F]+=T,r[F]+=T*A,c[F]+=T*Fn(e.mat[x],A)/(e.rho[x]*_),e.mat[x]!==ft)continue;const b=e.smass[2*x];a[F]+=b,l[F]+=e.mass[x]-b,b>0&&(p=!0)}const{nx:d,ny:g,kind:y}=s,w=Math.PI*Math.PI*t/(s.dx*s.dx);for(let x=0;x<s.n;x+=1){if(h[x]=0,f[x]=0,!(i[x]>0))continue;const F=x%d,_=(x-F)/d;if(!(y[x]!==st&&(y[x]!==G||!(F>0&&y[x-1]===st||F<d-1&&y[x+1]===st||_>0&&y[x-d]===st||_<g-1&&y[x+d]===st)))&&(h[x]=1-Math.exp(-w*c[x]/i[x]),p&&a[x]>0)){const T=Qr(r[x]/i[x]);f[x]=1-Math.exp(-w*T*Bu(Eu(s,F,_),t/(w*T)))}}for(let x=0;x<e.count;x+=1){const F=u[x];if(F<0||h[F]===0)continue;const _=h[F]*(r[F]/i[F]-e.T[x]);if(_===0)continue;const T=e.mass[x]/e.rho[x];e.h[x]+=m[x]*_,e.derive(x),n.dVp[x]+=e.mass[x]/e.rho[x]-T}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:c,outH:a,inS:l,inH:h,cell:f,ds:u,hs:m}=this;c.fill(0),a.fill(0);for(let d=0;d<e.count;d+=1){u[d]=0;const g=f[d];if(g<0||r[g]===0||e.mat[d]!==ft)continue;const y=e.smass[2*d],w=r[g]*(n[g]/i[g]*(e.mass[d]-y)-y);if(u[d]=w,w<0){const x=Xo(e.T[d],y/e.mass[d]);m[d]=x,c[g]-=w,a[g]-=w*x}}const p=this.saltBetween(t);for(let d=0;d<e.count;d+=1){const g=f[d];if(g<0||e.mat[d]!==ft)continue;let y=u[d],w=0;y<0?w=y*m[d]:y>0&&(c[g]>0?w=y*a[g]/c[g]:y=0);const x=e.smass[2*d],F=e.mass[d];if(p&&(l[g]!==0||h[g]!==0)){const A=l[g]<0?x/n[g]:(F-x)/i[g];y+=l[g]*A,w+=h[g]*A}if(y===0&&w===0)continue;const _=F*e.h[d]+w,T=F/e.rho[d];e.mass[d]=F+y,e.smass[2*d]=x+y,e.spc[2*d]=x+y>0?Qn:0,e.h[d]=_/e.mass[d],e.derive(d),s.dVp[d]+=e.mass[d]/e.rho[d]-T}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:c,inS:a,inH:l}=this,{nx:h,ny:f}=e;a.fill(0),l.fill(0);const u=t/(e.dx*e.dx);let m=!1;const p=(d,g,y)=>{if(i[g]===0||!(n[g]>0)||!(y>0))return;const w=s[d]/n[d],x=s[g]/n[g];if(w===x)return;const F=w>x?d:g,_=w>x?g:d,T=Qr(.5*(c[d]/r[d]+c[g]/r[g])),A=(y<1?y*T:T)*u*Math.min(n[d],n[g])*Math.abs(w-x),b=Xo(c[F]/r[F],s[F]/(s[F]+n[F]));a[F]-=A,l[F]-=A*b,a[_]+=A,l[_]+=A*b,m=!0};for(let d=0;d<f;d+=1)for(let g=0;g<h;g+=1){const y=g+d*h;i[y]===0||!(n[y]>0)||(g+1<h&&p(y,y+1,e.au[g+1+d*(h+1)]),d+1<f&&p(y,y+h,e.av[y+h]))}return m}}function Du(o,t){const e=o.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let a=0;a<n;a+=1)for(let l=0;l<s;l+=1){const h=l+a*s;e.solid[h]===0&&(e.kind[h]===st||Ve(t.region,(l+.5)*e.dx,(a+.5)*e.dx))&&(i[h]=1)}const r=new Uint8Array(e.n),c=[];for(let a=0;a<e.n;a+=1){if(i[a]===0||r[a]!==0)continue;let l=!1;for(c.push(a),r[a]=1;c.length>0;){const h=c.pop(),f=h%s,u=(h-f)/s,m=o.gas,p=[m.across(h,f,u,0),m.across(h,f,u,1),m.across(h,f,u,2),m.across(h,f,u,3)];(f===0&&e.openL||f===s-1&&e.openR||u===0&&e.openB||u===n-1&&e.openT)&&(l=!0);for(const d of p)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,c.push(d))}}if(!l)return!1}return!0}const Gt=Ft+2,ne=Ft,le=Ft+1,Nu=.9,Vu=16;class An{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Gt*s),this.fu=new Float64Array(Gt*t.nu),this.fv=new Float64Array(Gt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:c}=e,a=s+1,l=e.ug,h=e.vg;let f=0,u=0;for(let F=0;F<n;F+=1)for(let _=0;_<s;_+=1){const T=_+F*s;if(r[T]!==G)continue;const A=_+F*a,b=l[A],k=l[A+1],S=h[T],M=h[T+s],P=(b<0?-b:0)+(k>0?k:0)+(S<0?-S:0)+(M>0?M:0);P>f&&(f=P);const C=Math.max(b<0?-b:b,k<0?-k:k,S<0?-S:S,M<0?-M:M);C>u&&(u=C)}this.gas.last.uMax=u;const m=Math.min(Vu,Math.max(1,Math.ceil(f*t/c/Nu))),p=t/m,{conc:d}=this,g=this.gas.vgas,y=e.mg,w=e.mfog,x=e.Hg;for(let F=0;F<m;F+=1){for(let _=0;_<i;_+=1){if(r[_]!==G){for(let A=0;A<Gt;A+=1)d[A*i+_]=0;continue}const T=1/g[_];for(let A=0;A<Ft;A+=1)d[A*i+_]=y[A*i+_]*T;d[ne*i+_]=w[_]*T,d[le*i+_]=x[_]*T}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let F=0;F<i;F+=1)r[F]===G&&this.gas.deriveCell(F);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=s+1,a=e.nu,l=e.ug,{conc:h,fu:f}=this,{amb:u,gasU:m}=this.gas,p=e.aFace,d=An.face;for(let g=0;g<n;g+=1){const y=g*s,w=g*c;for(let x=0;x<=s;x+=1){const F=w+x,_=l[F];if(m[F]===0||_===0){for(let S=0;S<Gt;S+=1)f[S*a+F]=0;continue}const T=e.au[F]<1?_*p*t*e.au[F]:_*p*t;if(x===0||x===s){const S=x===0?y:y+s-1,M=x===0?_>0:_<0;for(let P=0;P<Gt;P+=1)f[P*a+F]=T*(M?u[P]:h[P*i+S]);continue}let A,b,k;if(_>0?(A=y+x-1,b=y+x,k=x>=2&&r[y+x-2]===G?y+x-2:-1):(A=y+x,b=y+x-1,k=x+1<s&&r[y+x+1]===G?y+x+1:-1),k<0){for(let S=0;S<Gt;S+=1)f[S*a+F]=T*h[S*i+A];continue}for(let S=0;S<Gt;S+=1){const M=S*i;f[S*a+F]=T*d(h[M+A],h[M+k],h[M+b])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,c=e.nv,a=e.vg,{conc:l,fv:h}=this,{amb:f,gasV:u}=this.gas,m=e.aFace,p=An.face;for(let d=0;d<=n;d+=1){const g=d*s;for(let y=0;y<s;y+=1){const w=g+y,x=a[w];if(u[w]===0||x===0){for(let b=0;b<Gt;b+=1)h[b*c+w]=0;continue}const F=e.av[w]<1?x*m*t*e.av[w]:x*m*t;if(d===0||d===n){const b=d===0?y:y+(n-1)*s,k=d===0?x>0:x<0;for(let S=0;S<Gt;S+=1)h[S*c+w]=F*(k?f[S]:l[S*i+b]);continue}let _,T,A;if(x>0?(_=w-s,T=w,A=d>=2&&r[w-2*s]===G?w-2*s:-1):(_=w,T=w-s,A=d+1<n&&r[w+s]===G?w+s:-1),A<0){for(let b=0;b<Gt;b+=1)h[b*c+w]=F*l[b*i+_];continue}for(let b=0;b<Gt;b+=1){const k=b*i;h[b*c+w]=F*p(l[k+_],l[k+A],l[k+T])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,c=t.nv,{fu:a,fv:l}=this,{gasU:h,gasV:f,escaped:u}=this.gas,m=t.mg,p=t.mfog,d=t.Hg;for(let g=0;g<s;g+=1){const y=g*e,w=g*i;for(let F=1;F<e;F+=1){const _=w+F;if(h[_]===0)continue;const T=y+F-1,A=T+1;for(let S=0;S<Ft;S+=1){const M=a[S*r+_];m[S*n+T]-=M,m[S*n+A]+=M}const b=a[ne*r+_];p[T]-=b,p[A]+=b;const k=a[le*r+_];d[T]-=k,d[A]+=k}if(h[w]!==0){const F=y;for(let A=0;A<Ft;A+=1){const b=a[A*r+w];m[A*n+F]+=b,u[A]-=b}const _=a[ne*r+w];p[F]+=_,u[ne]-=_;const T=a[le*r+w];d[F]+=T,u[le]-=T}const x=w+e;if(h[x]!==0){const F=y+e-1;for(let A=0;A<Ft;A+=1){const b=a[A*r+x];m[A*n+F]-=b,u[A]+=b}const _=a[ne*r+x];p[F]-=_,u[ne]+=_;const T=a[le*r+x];d[F]-=T,u[le]+=T}}for(let g=1;g<s;g+=1){const y=g*e;for(let w=0;w<e;w+=1){const x=y+w;if(f[x]===0)continue;const F=x-e,_=x;for(let b=0;b<Ft;b+=1){const k=l[b*c+x];m[b*n+F]-=k,m[b*n+_]+=k}const T=l[ne*c+x];p[F]-=T,p[_]+=T;const A=l[le*c+x];d[F]-=A,d[_]+=A}}for(let g=0;g<e;g+=1){if(f[g]!==0){const w=g;for(let _=0;_<Ft;_+=1){const T=l[_*c+g];m[_*n+w]+=T,u[_]-=T}const x=l[ne*c+g];p[w]+=x,u[ne]-=x;const F=l[le*c+g];d[w]+=F,u[le]-=F}const y=g+s*e;if(f[y]!==0){const w=g+(s-1)*e;for(let _=0;_<Ft;_+=1){const T=l[_*c+y];m[_*n+w]-=T,u[_]+=T}const x=l[ne*c+y];p[w]-=x,u[ne]+=x;const F=l[le*c+y];d[w]-=F,u[le]+=F}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:c,outM:a,scale:l}=this,h=t.nu,f=t.nv;a.fill(0);const u=An.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let y=0;y<=e;y+=1){const w=y+g*i;if(m[w]===0)continue;const x=u(r,h,w);x>0&&y>0?a[y-1+g*e]+=x:x<0&&y<e&&(a[y+g*e]-=x)}for(let g=0;g<=s;g+=1)for(let y=0;y<e;y+=1){const w=y+g*e;if(p[w]===0)continue;const x=u(c,f,w);x>0&&g>0?a[y+(g-1)*e]+=x:x<0&&g<s&&(a[y+g*e]-=x)}let d=!1;for(let g=0;g<n;g+=1){const y=.9*this.gas.massOf(g);l[g]=a[g]>y&&a[g]>0?y/a[g]:1,l[g]<1&&(d=!0)}if(d){for(let g=0;g<s;g+=1)for(let y=0;y<=e;y+=1){const w=y+g*i;if(m[w]===0)continue;const F=u(r,h,w)>0?y>0?y-1+g*e:-1:y<e?y+g*e:-1;if(!(F<0||l[F]>=1))for(let _=0;_<Gt;_+=1)r[_*h+w]*=l[F]}for(let g=0;g<=s;g+=1)for(let y=0;y<e;y+=1){const w=y+g*e;if(p[w]===0)continue;const F=u(c,f,w)>0?g>0?y+(g-1)*e:-1:g<s?y+g*e:-1;if(!(F<0||l[F]>=1))for(let _=0;_<Gt;_+=1)c[_*f+w]*=l[F]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=ne;i+=1)n+=t[i*e+s];return n}}const Yt=.05,Uu=400;class Gu{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(Gt));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(Gt));v(this,"dp0",new Float64Array(8));v(this,"queue");v(this,"seen");v(this,"seenTag",0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.queue=new Int32Array(n),this.seen=new Int32Array(n),this.mover=new An(t,this)}setAmbient(t,e,s){let n=0;for(let c=0;c<Ft;c+=1)n+=s[c]/gt[c];const i=e/(Rt*t*n);let r=0;for(let c=0;c<Ft;c+=1)this.amb[c]=i*s[c],r+=i*s[c]*re(c,t);this.amb[ne]=0,this.amb[le]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*_t(e);for(let r=0;r<Ft;r+=1)i+=s.mg[r*n+t]*re(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Kr(s.mg[t],s.mg[n+t],s.mg[Y*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],c=e.mg[Y*s+t],a=e.mfog[t],l=i+r+c;if(this.nmol[t]=i/gt[0]+r/gt[1]+c/gt[Y],l+a<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let h;if(a<=0)h=Oc(i,r,c,e.Hg[t]);else{h=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const u=(e.Hg[t]-this.enthalpy(t,h))/this.heatCapacity(t,h);if(h+=u,Math.abs(u)<1e-10)break}}h>150&&h<3e3||(h=Math.min(3e3,Math.max(150,Number.isFinite(h)?h:this.ambT))),e.T[t]=h,this.cap[t]=Kr(i,r,c,a,h),this.rho[t]=l/n,this.mu[t]=Cc(i,r,c,h)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ht){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===st&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Rt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ht){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Y*e+s];if(t.kind[s]===st&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Rt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ht||this.vgas[e]<=0?0:this.nmol[e]*Rt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<Ft;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,c=Math.max(.001,n)*i.vCell;let a=0;for(let f=0;f<Ft;f+=1)a+=s[f]/gt[f];const l=this.R.pAt(t)*c/(Rt*e*a);let h=0;for(let f=0;f<Ft;f+=1)i.mg[f*r+t]=l*s[f],h+=l*s[f]*re(f,e);i.mfog[t]=0,i.Hg[t]=h,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let c=0;c<n;c+=1){const a=t[c],l=i[c];if(a===l||l===ht||a===ht)continue;r+=1;const h=c%s,f=(c-h)/s;let u=0;for(let m=0;m<4;m+=1){const p=this.across(c,h,f,m);p>=0&&i[p]===G&&t[p]===G&&(u+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(u<=0){l===st&&this.release(c);continue}if(l===st)for(let m=0;m<4;m+=1){const p=this.across(c,h,f,m);if(p<0||i[p]!==G||t[p]!==G)continue;const d=(this.vgas[p]>0?this.vgas[p]:e.vCell)/u;this.move(c,p,d)}else{let m=this.massOf(c),p=0;for(let d=0;d<4;d+=1){const g=this.across(c,h,f,d);if(g<0||i[g]!==G||t[g]!==G)continue;const y=(this.vgas[g]>0?this.vgas[g]:e.vCell)/u;p+=y*this.rho[g]}if(p*=Math.max(.001,1-e.fs[c]-e.phi[c]-e.alpha[c])*e.vCell,p<=m)continue;for(let d=0;d<4;d+=1){const g=this.across(c,h,f,d);if(g<0||i[g]!==G||t[g]!==G)continue;const y=(this.vgas[g]>0?this.vgas[g]:e.vCell)/u,w=this.massOf(g);if(w<=0)continue;const x=Math.min(.25,(p-m)*y/w);this.move(g,c,x)}m=this.massOf(c),m>0&&(e.T[c]=this.ambT)}this.deriveCell(c)}for(let c=0;c<n;c+=1)i[c]===st&&this.massOf(c)>0&&this.release(c);return r}release(t){const e=this.g,{nx:s,kind:n}=e,i=++this.seenTag,r=this.queue,c=this.seen;let a=0,l=0;for(r[l++]=t,c[t]=i;a<l&&l<Uu;){const h=r[a++],f=h%s,u=(h-f)/s;for(let m=0;m<4;m+=1){const p=this.across(h,f,u,m);if(!(p<0||c[p]===i||n[p]===ht)){if(c[p]=i,n[p]===G){this.move(t,p,1),this.deriveCell(p),this.deriveCell(t);return}r[l++]=p}}}}across(t,e,s,n){const i=this.g,{nx:r,ny:c}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<c-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let a=0;a<Ft;a+=1){const l=n.mg[a*i+t]*s;n.mg[a*i+t]-=l,n.mg[a*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const c=n.Hg[t]*s;n.Hg[t]-=c,n.Hg[e]+=c,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,c=t.vg;for(let a=0;a<s;a+=1)for(let l=0;l<=e;l+=1){const h=l+a*i,f=l>0?n[l-1+a*e]:-1,u=l<e?n[l+a*e]:-1;let m=0;(f===G&&u===G||l===0&&t.openL&&u===G||l===e&&t.openR&&f===G)&&(m=1),t.au[h]<=0&&(m=0),this.gasU[h]=m,m===0&&(r[h]=f===st||u===st?f===ht||u===ht||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[h]:t.usol[h])}for(let a=0;a<=s;a+=1)for(let l=0;l<e;l+=1){const h=l+a*e,f=a>0?n[l+(a-1)*e]:-1,u=a<s?n[l+a*e]:-1;let m=0;(f===G&&u===G||a===0&&t.openB&&u===G||a===s&&t.openT&&f===G)&&(m=1),t.av[h]<=0&&(m=0),this.gasV[h]=m,m===0&&(c[h]=f===st||u===st?f===ht||u===ht||a===0&&!t.openB||a===s&&!t.openT?0:t.vl[h]:t.vsol[h])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,a=i+1,l=Math.min(i-1e-6,Math.max(0,e/c)),h=Math.min(r-1.000001,Math.max(0,s/c-.5)),f=Math.floor(l),u=Math.floor(h),m=l-f,p=h-u,d=t[f+u*a],g=t[f+1+u*a],y=t[f+(u+1)*a],w=t[f+1+(u+1)*a];return this.lo=Math.min(d,g,y,w),this.hi=Math.max(d,g,y,w),(1-p)*((1-m)*d+m*g)+p*((1-m)*y+m*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:c}=n,a=Math.min(i-1.000001,Math.max(0,e/c-.5)),l=Math.min(r-1e-6,Math.max(0,s/c)),h=Math.floor(a),f=Math.floor(l),u=a-h,m=l-f,p=t[h+f*i],d=t[h+1+f*i],g=t[h+(f+1)*i],y=t[h+1+(f+1)*i];return this.lo=Math.min(p,d,g,y),this.hi=Math.max(p,d,g,y),(1-m)*((1-u)*p+u*d)+m*((1-u)*g+u*y)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:c}=s,a=n+1,l=s.ug,h=s.vg,{u0:f,v0:u,u1:m,v1:p}=this,d=this.lim;f.set(l),u.set(h);for(let x=0;x<i;x+=1)for(let F=0;F<=n;F+=1){const _=F+x*a;if(this.gasU[_]===0){m[_]=f[_];continue}const T=F*r,A=(x+.5)*r,b=this.sampleV(u,T,A);m[_]=this.sampleU(f,T-t*f[_],A-t*b),d[2*_]=this.lo,d[2*_+1]=this.hi}const g=2*s.nu;for(let x=0;x<=i;x+=1)for(let F=0;F<n;F+=1){const _=F+x*n;if(this.gasV[_]===0){p[_]=u[_];continue}const T=(F+.5)*r,A=x*r,b=this.sampleU(f,T,A);p[_]=this.sampleV(u,T-t*b,A-t*u[_]),d[g+2*_]=this.lo,d[g+2*_+1]=this.hi}for(let x=0;x<i;x+=1)for(let F=0;F<=n;F+=1){const _=F+x*a;if(this.gasU[_]===0)continue;const T=F*r,A=(x+.5)*r,b=this.sampleV(u,T,A),k=this.sampleU(m,T+t*f[_],A+t*b);let S=m[_]+.5*(f[_]-k);(S<d[2*_]||S>d[2*_+1])&&(S=m[_]),l[_]=S}for(let x=0;x<=i;x+=1)for(let F=0;F<n;F+=1){const _=F+x*n;if(this.gasV[_]===0)continue;const T=(F+.5)*r,A=x*r,b=this.sampleU(f,T,A),k=this.sampleV(p,T+t*b,A+t*u[_]);let S=p[_]+.5*(u[_]-k);(S<d[g+2*_]||S>d[g+2*_+1])&&(S=p[_]),h[_]=S}const y=this.R;for(let x=0;x<=i;x+=1)for(let F=0;F<n;F+=1){const _=F+x*n;if(this.gasV[_]===0)continue;const T=x>0?F+(x-1)*n:-1,A=x<i?F+x*n:-1,b=T>=0&&c[T]===G?this.rho[T]:-1,k=A>=0&&c[A]===G?this.rho[A]:-1,S=Math.max(Yt,b>0&&k>0?.5*(b+k):Math.max(b,k));if(!(b>0||k>0))continue;const M=b>0?T:A,P=y.id[M],C=P>=0?y.rhoBar[P]:y.rhoAmb;h[_]-=t*e*(S-C)/S}m.set(l),p.set(h);const w=t/(r*r);for(let x=0;x<i;x+=1)for(let F=0;F<=n;F+=1){const _=F+x*a;if(this.gasU[_]===0)continue;const T=F<n&&c[F+x*n]===G?F+x*n:F-1+x*n,A=this.mu[T]/Math.max(Yt,this.rho[T]),b=m[_],k=F<n?m[_+1]:b,S=F>0?m[_-1]:b,M=x>0?m[_-a]:s.openB?b:-b,P=x<i-1?m[_+a]:s.openT?b:-b;l[_]=b+Math.min(.2,w*A)*(k+S+M+P-4*b)}for(let x=0;x<=i;x+=1)for(let F=0;F<n;F+=1){const _=F+x*n;if(this.gasV[_]===0)continue;const T=x<i&&c[F+x*n]===G?F+x*n:F+(x-1)*n,A=this.mu[T]/Math.max(Yt,this.rho[T]),b=p[_],k=x<i?p[_+n]:b,S=x>0?p[_-n]:b,M=F>0?p[_-1]:s.openL?b:-b,P=F<n-1?p[_+1]:s.openR?b:-b;h[_]=b+Math.min(.2,w*A)*(P+M+S+k-4*b)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==G){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:c,kind:a}=n,l=i+1,h=n.ug,f=n.vg;let u=i,m=-1,p=r,d=-1,g=0;for(let A=0;A<r;A+=1)for(let b=0;b<i;b+=1)a[b+A*i]===G&&(g+=1,b<u&&(u=b),b>m&&(m=b),A<p&&(p=A),A>d&&(d=A));const y=this.last.solve;if(y.iterations=0,y.residual=0,y.capped=!1,this.last.cells=g,g===0)return this.last;const w=this.solver,x=w.begin(m-u+1,d-p+1),F=this.rho;for(let A=p;A<=d;A+=1)for(let b=u;b<=m;b+=1){const k=b+A*i;if(a[k]!==G)continue;const S=w.at(b-u,A-p);x.act[S]=1,x.x[S]=n.pg[k];const M=b+A*l,P=b+A*i,C=this.fluxU(M+1)-this.fluxU(M)+this.fluxV(P+i)-this.fluxV(P);x.b[S]=n.Sg[k]*c*c-c*C;const L=Math.max(Yt,F[k]);b+1<i?a[k+1]===G&&b+1<=m&&this.gasU[M+1]!==0&&(x.ax[S]=n.au[M+1]*2*t/(L+Math.max(Yt,F[k+1]))):n.openR&&this.gasU[M+1]!==0&&(x.dDx[S]+=n.au[M+1]*2*t/L),b===0&&n.openL&&this.gasU[M]!==0&&(x.dDx[S]+=n.au[M]*2*t/L),A+1<r?a[k+i]===G&&A+1<=d&&this.gasV[P+i]!==0&&(x.ay[S]=n.av[P+i]*2*t/(L+Math.max(Yt,F[k+i]))):n.openT&&this.gasV[P+i]!==0&&(x.dDy[S]+=n.av[P+i]*2*t/L),A===0&&n.openB&&this.gasV[P]!==0&&(x.dDy[S]+=n.av[P]*2*t/L)}const _=w.solve(e,s,!0);y.iterations=_.iterations,y.residual=_.residual,y.capped=_.capped;const T=n.pg;for(let A=0;A<n.n;A+=1)a[A]!==G&&(T[A]=0);for(let A=p;A<=d;A+=1)for(let b=u;b<=m;b+=1){const k=b+A*i;a[k]===G&&(T[k]=x.x[w.at(b-u,A-p)])}for(let A=0;A<r;A+=1)for(let b=0;b<=i;b+=1){const k=b+A*l;if(this.gasU[k]===0)continue;if(b===0){h[k]-=2*t/Math.max(Yt,F[A*i])/c*T[A*i];continue}if(b===i){h[k]+=2*t/Math.max(Yt,F[i-1+A*i])/c*T[i-1+A*i];continue}const S=b-1+A*i,M=b+A*i;h[k]-=2*t/(Math.max(Yt,F[S])+Math.max(Yt,F[M]))/c*(T[M]-T[S])}for(let A=0;A<=r;A+=1)for(let b=0;b<i;b+=1){const k=b+A*i;if(this.gasV[k]===0)continue;if(A===0){f[k]-=2*t/Math.max(Yt,F[b])/c*T[b];continue}if(A===r){f[k]+=2*t/Math.max(Yt,F[b+(r-1)*i])/c*T[b+(r-1)*i];continue}const S=b+(A-1)*i,M=b+A*i;f[k]-=2*t/(Math.max(Yt,F[S])+Math.max(Yt,F[M]))/c*(T[M]-T[S])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const c=s.vGas[r];if(c<=0)continue;let a=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===ht||this.cap[f]<=0)continue;const u=this.nmol[f];a+=u*(u*Rt*e.T[f]/s.pAt(f))/this.cap[f]}a*=Rt/c;const l=1/Math.max(.05,1-a);let h=0;for(let f=0;f<4;f+=1){const u=s.statePressure(r);s.p0[r]=u;const m=(u-(t[r]+h))*l;if(Math.abs(m)<=1e-10*u)break;let p=0;for(let d=0;d<n;d+=1){if(s.id[d]!==r||e.kind[d]===ht||this.cap[d]<=0)continue;const g=this.nmol[d]*Rt*e.T[d]/s.pAt(d);p+=g,e.Hg[d]+=g*m,this.deriveCell(d)}h+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=h}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<Ft;i+=1)n+=e.mg[i*s+t]/gt[i];return n<=0?0:e.mg[Y*s+t]/gt[Y]/n*this.R.pAt(t)}}function Hu(o,t,e,s,n,i,r){const{nx:c,ny:a}=o,l=c+1,h=o.ul,f=o.vl;for(let u=0;u<o.nu;u+=1)s[u]=t[u]!==0?1:0;for(let u=0;u<o.nv;u+=1)n[u]=e[u]!==0?1:0;for(let u=0;u<2;u+=1){i.set(h),r.set(f);for(let m=0;m<a;m+=1)for(let p=0;p<=c;p+=1){const d=p+m*l;if(s[d]!==0)continue;let g=0,y=0;p>0&&s[d-1]===1&&(g+=h[d-1],y+=1),p<c&&s[d+1]===1&&(g+=h[d+1],y+=1),m>0&&s[d-l]===1&&(g+=h[d-l],y+=1),m<a-1&&s[d+l]===1&&(g+=h[d+l],y+=1),y>0&&(i[d]=g/y,s[d]=3)}for(let m=0;m<=a;m+=1)for(let p=0;p<c;p+=1){const d=p+m*c;if(n[d]!==0)continue;let g=0,y=0;p>0&&n[d-1]===1&&(g+=f[d-1],y+=1),p<c-1&&n[d+1]===1&&(g+=f[d+1],y+=1),m>0&&n[d-c]===1&&(g+=f[d-c],y+=1),m<a&&n[d+c]===1&&(g+=f[d+c],y+=1),y>0&&(r[d]=g/y,n[d]=3)}h.set(i),f.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let u=0;u<o.nu;u+=1)s[u]===0&&(h[u]=0);for(let u=0;u<o.nv;u+=1)n[u]===0&&(f[u]=0)}function $u(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let c=0;c<o.count;c+=1){const a=Math.min(s-1,Math.max(0,Math.floor(o.x[c]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[c]/t.dx)));if(i[a+l*s]===st){e[c]=0;continue}let h=!1;for(let f=Math.max(0,l-2);f<=Math.min(n-1,l+2)&&!h;f+=1)for(let u=Math.max(0,a-2);u<=Math.min(s-1,a+2);u+=1)if(i[u+f*s]===st){h=!0;break}e[c]=h?0:1,h||(r=!0)}return r}function Dn(o,t,e,s){const{nx:n,ny:i,dx:r}=o,c=n+1,a=1/r;let l=Math.min(n-1e-6,Math.max(0,t*a)),h=Math.min(i-1.000001,Math.max(0,e*a-.5)),f=Math.floor(l),u=Math.floor(h),m=l-f,p=h-u;const d=o.ul;s[0]=(1-p)*((1-m)*d[f+u*c]+m*d[f+1+u*c])+p*((1-m)*d[f+(u+1)*c]+m*d[f+1+(u+1)*c]),l=Math.min(n-1.000001,Math.max(0,t*a-.5)),h=Math.min(i-1e-6,Math.max(0,e*a)),f=Math.floor(l),u=Math.floor(h),m=l-f,p=h-u;const g=o.vl;s[1]=(1-p)*((1-m)*g[f+u*n]+m*g[f+1+u*n])+p*((1-m)*g[f+(u+1)*n]+m*g[f+1+(u+1)*n])}const Wu=18,Ku=1,zu=.002,Qu=4,Sa=.2687,Ma=.245,Pa=.2;function Xu(o,t,e,s,n){const i=Math.abs(t-e)/e,r=s/e;return i*n*o*o/(Wu*r+Math.sqrt(.75*Ku*i*n*o*o*o))}function qs(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Yu{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"rad",new Float64Array(0));v(this,"w",new Float64Array(6));v(this,"vel",new Float64Array(2));v(this,"hit",new Float64Array(6));v(this,"lm");v(this,"lmT");v(this,"lv");v(this,"loc",new Float64Array(2));v(this,"h",0);v(this,"ks",0);v(this,"vmax",0);this.e=t,this.head=new Int32Array(t.grid.n),this.lm=new Float64Array(t.grid.n),this.lmT=new Float64Array(t.grid.n),this.lv=new Float64Array(t.grid.n)}dtLimit(){return this.vmax>0?.5*this.e.grid.dx/this.vmax:1/0}splatVolume(){const{grid:t,grains:e}=this.e,{nx:s,ny:n,dx:i}=t,r=t.grain;r.fill(0);const c=this.w,a=1/i,l=1/t.vCell;for(let h=0;h<e.count;h+=1){const f=e.m[h]/e.rho(h)*l,u=qs(e.x[h]*a-.5,c,0),m=qs(e.y[h]*a-.5,c,3);for(let p=0;p<3;p+=1){const d=m+p;if(!(d<0||d>=n))for(let g=0;g<3;g+=1){const y=u+g;y<0||y>=s||(r[y+d*s]+=c[g]*c[3+p]*f)}}}}step(t){const e=this.e.grains;if(e.count===0){this.vmax=0;return}this.next.length<e.cap&&(this.next=new Int32Array(e.cap),this.px=new Float64Array(e.cap),this.py=new Float64Array(e.cap),this.rad=new Float64Array(e.cap)),this.forces(t);const s=this.e.grid.dx;for(let r=0;r<e.count;r+=1)this.rad[r]=Sa*s*Math.sqrt(Math.max(0,e.m[r]/e.m0[r]));this.ks=1/(4*Sa*s);const n=Math.max(1,Math.ceil(t/zu-1e-9));this.h=t/n;for(let r=0;r<n;r+=1)this.substep();this.escape();let i=0;for(let r=0;r<e.count;r+=1){const c=Math.hypot(e.vx[r],e.vy[r]);c>i&&(i=c)}this.vmax=i}forces(t){const e=this.e,{grid:s,grains:n}=e,i=e.gy,r=i>0?i:9.81;let c=!1;for(let a=0;a<n.count;a+=1){const l=s.cellAt(n.x[a],n.y[a]);if(!(l>=0&&s.kind[l]===st)){n.vy[a]-=i*t;continue}c||(this.gatherLiquid(),c=!0),this.liquidAt(l);const f=this.loc[0],u=this.loc[1],m=Te[n.mat[a]].rho,p=i*(1-u/m),d=Xu(n.diameter(a),m,u,Fs(f),r)/Math.max(1e-6,Math.abs(r*(1-u/m)));Dn(s,n.x[a],n.y[a],this.vel);const g=n.vx[a],y=n.vy[a]-p*t,w=t/d,x=(g+w*this.vel[0])/(1+w),F=(y+w*this.vel[1])/(1+w);n.vx[a]=x,n.vy[a]=F,this.spread(n.x[a],n.y[a],-n.m[a]*(x-g)/t,-n.m[a]*(F-y)/t)}}gatherLiquid(){const{grid:t,particles:e}=this.e,{lm:s,lmT:n,lv:i}=this;s.fill(0),n.fill(0),i.fill(0);for(let r=0;r<e.count;r+=1){const c=t.cellAt(e.x[r],e.y[r]);if(c<0)continue;const a=e.mass[r];s[c]+=a,n[c]+=a*e.T[r],i[c]+=a/e.rho[r]}}liquidAt(t){const e=this.e.grid,{lm:s,lmT:n,lv:i,loc:r}=this;let c=s[t],a=n[t],l=i[t];if(!(c>0)){const h=t%e.nx,f=(t-h)/e.nx;for(let u=-1;u<=1;u+=1)for(let m=-1;m<=1;m+=1){const p=h+m,d=f+u;if(p<0||d<0||p>=e.nx||d>=e.ny)continue;const g=p+d*e.nx;c+=s[g],a+=n[g],l+=i[g]}}r[0]=c>0?a/c:this.e.ambientT,r[1]=c>0&&l>0?c/l:this.e.liquid.rhoRef}spread(t,e,s,n){const{grid:i,liquid:r}=this.e,{nx:c,ny:a,dx:l}=i,h=this.w,f=1/l;let u=qs(t*f,h,0),m=qs(e*f-.5,h,3);for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=u+d,y=m+p;g<0||g>c||y<0||y>=a||(r.fU[g+y*(c+1)]+=s*h[d]*h[3+p])}u=qs(t*f-.5,h,0),m=qs(e*f,h,3);for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=u+d,y=m+p;g<0||g>=c||y<0||y>a||(r.fV[g+y*c]+=n*h[d]*h[3+p])}}substep(){const{grid:t,grains:e}=this.e,{px:s,py:n,head:i,next:r}=this,{nx:c,ny:a}=t,l=this.h;for(let f=0;f<e.count;f+=1)s[f]=e.x[f],n[f]=e.y[f],e.x[f]+=l*e.vx[f],e.y[f]+=l*e.vy[f];i.fill(-1);for(let f=0;f<e.count;f+=1){const u=t.cellAt(e.x[f],e.y[f]);r[f]=i[u],i[u]=f}const h=1/t.dx;for(let f=0;f<Qu;f+=1){const u=(f&1)===1;for(let m=0;m<e.count;m+=1){const p=u?e.count-1-m:m,d=Math.min(c-1,Math.max(0,Math.floor(e.x[p]*h))),g=Math.min(a-1,Math.max(0,Math.floor(e.y[p]*h)));for(let y=-1;y<=1;y+=1){const w=g+y;if(!(w<0||w>=a))for(let x=-1;x<=1;x+=1){const F=d+x;if(!(F<0||F>=c))for(let _=i[F+w*c];_>=0;_=r[_])_!==p&&(u?_<p:_>p)&&this.pair(p,_)}}this.walls(p)}}for(let f=0;f<e.count;f+=1)e.vx[f]=(e.x[f]-s[f])/l,e.vy[f]=(e.y[f]-n[f])/l}pair(t,e){const s=this.e.grains,n=s.x[t]-s.x[e],i=s.y[t]-s.y[e],r=this.rad[t]+this.rad[e],c=n*n+i*i;if(c>=r*r||c<1e-24)return;const a=Math.sqrt(c),l=n/a,h=i/a,f=r-a,u=Math.exp(this.ks*s.y[t])/s.m[t],m=Math.exp(this.ks*s.y[e])/s.m[e],p=u/(u+m),d=m/(u+m);s.x[t]+=p*f*l,s.y[t]+=p*f*h,s.x[e]-=d*f*l,s.y[e]-=d*f*h;const g=s.x[t]-this.px[t]-(s.x[e]-this.px[e]),y=s.y[t]-this.py[t]-(s.y[e]-this.py[e]),w=g*l+y*h,x=g-w*l,F=y-w*h,_=Math.hypot(x,F);if(!(_>0))return;const T=_<Ma*f?1:Math.min(1,Pa*f/_);s.x[t]-=p*T*x,s.y[t]-=p*T*F,s.x[e]+=d*T*x,s.y[e]+=d*T*F}walls(t){const e=this.e,{grid:s,grains:n}=e,i=this.rad[t],r=s.w,c=s.h;!s.openL&&n.x[t]<i&&this.wallContact(t,1,0,i-n.x[t],0,0),!s.openR&&n.x[t]>r-i&&this.wallContact(t,-1,0,n.x[t]-(r-i),0,0),!s.openB&&n.y[t]<i&&this.wallContact(t,0,1,i-n.y[t],0,0),!s.openT&&n.y[t]>c-i&&this.wallContact(t,0,-1,n.y[t]-(c-i),0,0);const a=e.liquid.bodyHit,l=a!==null?a(this.px[t],this.py[t],n.x[t],n.y[t],this.hit):0;if(l===1){const d=this.hit,g=Math.hypot(d[0]-n.x[t],d[1]-n.y[t]);this.wallContact(t,d[2],d[3],g,d[4],d[5]);return}if(l===2)return;const h=s.sdfAt(n.x[t],n.y[t]);if(h>=i)return;const f=.25*s.dx;let u=s.sdfAt(n.x[t]+f,n.y[t])-s.sdfAt(n.x[t]-f,n.y[t]),m=s.sdfAt(n.x[t],n.y[t]+f)-s.sdfAt(n.x[t],n.y[t]-f);const p=Math.hypot(u,m);p>1e-12&&(u/=p,m/=p,this.wallContact(t,u,m,i-h,0,0))}wallContact(t,e,s,n,i,r){if(!(n>0))return;const c=this.e.grains;c.x[t]+=n*e,c.y[t]+=n*s;const a=c.x[t]-this.px[t]-i*this.h,l=c.y[t]-this.py[t]-r*this.h,h=a*e+l*s,f=a-h*e,u=l-h*s,m=Math.hypot(f,u);if(!(m>0))return;const p=m<Ma*n?1:Math.min(1,Pa*n/m);c.x[t]-=p*f,c.y[t]-=p*u}escape(){const t=this.e,{grid:e,grains:s}=t,n=e.w,i=e.h,r=1e-4*e.dx;for(let c=0;c<s.count;c+=1){const a=s.x[c],l=s.y[c];if(a<0&&e.openL||a>n&&e.openR||l<0&&e.openB||l>i&&e.openT){Te[s.mat[c]].dissolves&&(t.flows.escapedSalt+=s.m[c]),t.flows.escapedEnergy+=s.enthalpy(c),s.remove(c),c-=1;continue}(a<r||a>n-r)&&(s.vx[c]=0),(l<r||l>i-r)&&(s.vy[c]=0),s.x[c]=Math.min(n-r,Math.max(r,a)),s.y[c]=Math.min(i-r,Math.max(r,l))}}}const pi=1e-5,Zu=2,La=.025,Ju=1e-4;function Ca(o,t){const e=o<=1?1:Math.pow(Math.min(o,400),.077);return 1+Math.cbrt(1+o*t)*e}class th{constructor(t){v(this,"e");v(this,"head");v(this,"next",new Int32Array(0));v(this,"gHead");v(this,"gNext",new Int32Array(0));v(this,"listed",!1);v(this,"dissolved",0);v(this,"grown",0);v(this,"burst",0);v(this,"vel",new Float64Array(2));this.e=t,this.head=new Int32Array(t.grid.n),this.gHead=new Int32Array(t.grid.n)}invalidate(){this.listed=!1}list(){if(this.listed)return;const{grid:t,particles:e,grains:s}=this.e;this.next.length<e.cap&&(this.next=new Int32Array(e.cap)),this.gNext.length<s.cap&&(this.gNext=new Int32Array(s.cap)),this.head.fill(-1),this.gHead.fill(-1);for(let n=0;n<e.count;n+=1){if(e.mat[n]!==ft)continue;const i=t.cellAt(e.x[n],e.y[n]);i<0||(this.next[n]=this.head[i],this.head[i]=n)}for(let n=0;n<s.count;n+=1){const i=t.cellAt(s.x[n],s.y[n]);i<0||(this.gNext[n]=this.gHead[i],this.gHead[i]=n)}this.listed=!0}step(t){const{grains:e}=this.e;e.count!==0&&(this.listed=!1,this.list(),this.nucleate(t),this.heatAndDissolve(t),this.listed=!1)}grow(t,e,s,n){const{grid:i,grains:r}=this.e;if(r.count===0)return!1;this.list();const c=i.cellAt(t,e);if(c<0)return!1;const a=c%i.nx,l=(c-a)/i.nx;let h=-1,f=1/0;for(let m=-1;m<=1;m+=1)for(let p=-1;p<=1;p+=1){const d=a+p,g=l+m;if(!(d<0||g<0||d>=i.nx||g>=i.ny))for(let y=this.gHead[d+g*i.nx];y>=0;y=this.gNext[y]){if(!Te[r.mat[y]].dissolves)continue;const w=(r.x[y]-t)**2+(r.y[y]-e)**2;w<f&&(f=w,h=y)}}if(h<0)return!1;const u=r.enthalpy(h)+n;return r.m[h]+=s,r.T[h]=et+u/(r.m[h]*r.cp(h)),this.grown+=s,!0}nucleate(t){const e=this.e,{grid:s,grains:n,bubbles:i,particles:r,liquid:c}=e;for(let a=0;a<n.count;a+=1){if(n.dry[a]===0)continue;const l=s.cellAt(n.x[a],n.y[a]);if(l<0||s.kind[l]!==st||this.head[l]<0)continue;const h=n.wet[a];if(n.wet[a]+=t,n.wet[a]>Zu){n.dry[a]=0;continue}if(h>0&&Math.floor(h/La)===Math.floor(n.wet[a]/La))continue;let f=0,u=0,m=0,p=0;for(let k=this.head[l];k>=0;k=this.next[k]){const S=r.smass[2*k],M=r.mass[k]-S;f+=M,u+=S,m+=M*r.T[k],p+=M*(S>0?Qs(r.T[k],S/r.mass[k]):r.h[k])}if(!(f>0))continue;const d=m/f,g=Math.max(.5*e.pRef,e.pRef+s.pl[l]),y=u>0?ko(g,xf(u/(u+f))):kt(g);if(d-y<e.extremes.activation(eo(pi,g)))continue;const w=g+2*$n(d)/pi,x=kt(w),F=4/3*Math.PI*pi**3,_=ke(x)*F;if(_*4>f)continue;const T=i.add(n.x[a],n.y[a],.5*s.depth);if(T<0)continue;i.m[T*lt+Y]=_,i.r[T]=pi,i.V[T]=F,i.Tb[T]=x,i.pb[T]=w,i.pv[T]=w,i.H[T]=_*xt(x),i.site[T]=-1,i.age[T]=0,Dn(s,n.x[a],n.y[a],this.vel);const A=e.bubbleModel.motionState;A.ux0[T]=this.vel[0],A.uy0[T]=this.vel[1],i.vx[T]=this.vel[0],i.vy[T]=this.vel[1];const b=p/f;for(let k=this.head[l];k>=0;k=this.next[k]){const S=r.smass[2*k],M=_*(r.mass[k]-S)/f,P=S>0?Qs(r.T[k],S/r.mass[k]):r.h[k],C=r.mass[k]/r.rho[k],L=r.mass[k]*r.h[k]-M*P;r.mass[k]-=M,r.h[k]=L/r.mass[k],r.derive(k),c.dVp[k]+=r.mass[k]/r.rho[k]-C}e.heat.src[l]-=_*(xt(x)-b)/t,this.burst+=1}}heatAndDissolve(t){const e=this.e,{grid:s,grains:n,particles:i,liquid:r}=e,c=s.n;for(let a=0;a<n.count;a+=1){const l=s.cellAt(n.x[a],n.y[a]);if(l<0)continue;const h=Te[n.mat[a]];let f=0,u=0,m=0,p=0;for(let j=this.head[l];j>=0;j=this.next[j]){const E=i.smass[2*j];f+=i.mass[j]-E,u+=E,m+=i.mass[j]*i.T[j],p+=i.mass[j]}const d=f>0&&s.kind[l]===st,g=n.diameter(a),y=n.N[a]*Math.PI*g*g;Dn(s,n.x[a],n.y[a],this.vel);const w=Math.hypot(n.vx[a]-this.vel[0],n.vy[a]-this.vel[1]),x=d?m/p:s.T[l];if(d||s.kind[l]===G){let j,E,R;if(d){const dt=nn(x);j=Ln(x),E=Fs(x)/dt,R=j/(dt*Me(x))}else j=_o(s.mg[l],s.mg[c+l],s.mg[Y*c+l],x),E=16e-6,R=22e-6;const W=w*g/E,V=Ca(W,E/R)*j/g,Z=n.m[a]*h.cp,it=(1-Math.exp(-t*V*y/Z))*(x-n.T[a]);it!==0&&(n.T[a]+=it,e.heat.src[l]-=Z*it/t)}if(!d||!h.dissolves)continue;const F=m/p,_=u/(u+f),T=Jc(F);if(_>=T)continue;const A=or(F,_),b=Qr(F),k=Fs(F)/A,S=w*g/k,M=Ca(S,k/b)*b/g,P=(T-_)/(1-T);let C=y*M*A*Math.log(1+P)*t;const L=(T*(u+f)-u)/(1-T);C>L&&(C=Math.max(0,L));const B=n.m[a]-C<Ju*n.m0[a];if(B&&(C=n.m[a]),!(C>0))continue;const I=Yn(n.T[a]);for(let j=this.head[l];j>=0;j=this.next[j]){const E=i.smass[2*j],R=C*(i.mass[j]-E)/f;if(!(R>0))continue;const W=i.mass[j]/i.rho[j],V=i.mass[j]*i.h[j]+R*I;i.mass[j]+=R,i.smass[2*j]=E+R,i.spc[2*j]=Qn,i.h[j]=V/i.mass[j],i.derive(j),r.dVp[j]+=i.mass[j]/i.rho[j]-W}this.dissolved+=C,B?(n.remove(a),a-=1):n.m[a]-=C}}}const Oa=[1/6,2/3,1/6];class eh{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"owner");v(this,"fs");v(this,"capB");v(this,"matB");v(this,"Ts");v(this,"au");v(this,"av");v(this,"usol");v(this,"vsol");v(this,"thin");v(this,"thinAny",!1);v(this,"phi");v(this,"alpha");v(this,"grain");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.grain=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(lt*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}besideThin(t){const{nx:e,ny:s}=this,n=t%e,i=(t-n)/e;return n>0&&this.au[n+i*(e+1)]<=0&&this.solid[t-1]===0||n<e-1&&this.au[n+1+i*(e+1)]<=0&&this.solid[t+1]===0||i>0&&this.av[t]<=0&&this.solid[t-e]===0||i<s-1&&this.av[t+e]<=0&&this.solid[t+e]===0}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let c=0;c<t;c+=1){const a=c+r*t;i[a]===0&&(c>0&&s[c+r*(t+1)]<=0&&i[a-1]===0&&this.thinBlock(c-1,c,r-1,r+1),r>0&&n[a]<=0&&i[a-t]===0&&this.thinBlock(c-1,c+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:c}=this,a=s+1,l=t+e*s;let h=0;if(c[l]===0)for(let f=0;f<9;f+=1){const u=f%3-1,m=(f/3|0)-1,p=t+u,d=e+m;if(f===4||p<0||d<0||p>=s||d>=n||c[p+d*s]!==0)continue;const g=(u>0?1:0)+e*a,y=(m>0?1:0)*s;let w;if(m===0)w=i[t+g]<=0;else if(u===0)w=r[t+e*s+y]<=0;else{const x=c[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+y]<=0),F=c[t+d*s]===0&&(r[t+e*s+y]<=0||i[t+(u>0?1:0)+d*a]<=0);w=x&&F}w&&(h|=1<<f)}this.thin[l]=h}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let c=0;c<9;c+=1)i>>c&1?s[n+c]=0:r+=s[n+c];if(r>0)for(let c=0;c<9;c+=1)s[n+c]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:c}=this,a=Math.max(0,t),l=Math.max(0,e),h=Math.min(i-1,s),f=Math.min(r-1,n);for(let p=l;p<=f;p+=1)for(let d=a;d<=h;d+=1){const g=d+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let y=0;for(let w=-1;w<=1;w+=1)for(let x=-1;x<=1;x+=1)y+=Oa[x+1]*Oa[w+1]*this.solidShare(d+x,p+w);this.phiS[g]=y}const u=4,m=u*c;for(let p=l;p<=f;p+=1)for(let d=a;d<=h;d+=1){const g=d+p*i,y=this.solid[g]!==0,w=(d+.5)*c,x=(p+.5)*c;let F=m;y||(this.openL||(F=Math.min(F,w)),this.openR||(F=Math.min(F,this.w-w)),this.openB||(F=Math.min(F,x)),this.openT||(F=Math.min(F,this.h-x)));for(let _=-u;_<=u;_+=1){const T=p+_;if(!(T<0||T>=r))for(let A=-u;A<=u;A+=1){const b=d+A;if(b<0||b>=i||this.solid[b+T*i]!==0===y)continue;const S=Math.max(0,Math.abs(b+.5-(d+.5))-.5)*c,M=Math.max(0,Math.abs(T+.5-(p+.5))-.5)*c,P=Math.hypot(S,M);P<F&&(F=P)}}this.sdf[g]=y?-F:F}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),c=Math.min(n-1.0001,Math.max(0,e/i-.5)),a=Math.floor(r),l=Math.floor(c),h=r-a,f=c-l,u=Math.min(s-1,a+1),m=Math.min(n-1,l+1),p=this.sdf;let d=(1-f)*((1-h)*p[a+l*s]+h*p[u+l*s])+f*((1-h)*p[a+m*s]+h*p[u+m*s]);return this.openL||(d=Math.min(d,t)),this.openR||(d=Math.min(d,this.w-t)),this.openB||(d=Math.min(d,e)),this.openT||(d=Math.min(d,this.h-e)),d}}const sh=5,qa=30;class nh{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",qc);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});v(this,"bodies",[]);v(this,"grains",null);v(this,"Cgr");v(this,"CTgr");v(this,"qb");v(this,"kS");v(this,"kF");v(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r),this.Cgr=new Float64Array(r),this.CTgr=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=pt[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*ss}solidEnergy(t,e){return this.solidCapCrust(t)*(e-et)+this.g.film[t]*_t(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=et+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:et+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Me(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let a=0;a<s.ncell;a+=1)r+=s.cellVolume(a);if(!(r>0))continue;const c=n.P*i/r;for(let a=0;a<s.nw;a+=1){const l=c*s.ww[a]*s.cellVolume(s.wk[a]);t[s.wc[a]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/sh,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/qa);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/qa)))}}step(t,e,s){const{g:n,P:i,L:r,G:c}=this,{nx:a,ny:l,n:h,depth:f,dx:u}=n,{C:m,Cs:p,Cg:d,CTl:g,Tstar:y,k:w,q:x,src:F}=this;this.heaterPower(t),g.fill(0);const _=n.Cl;_.fill(0);const{Co:T,CKo:A}=this;let b=!1,k=0;for(let O=0;O<i.count;O+=1){const K=i.mat[O],z=i.T[O],ut=i.mass[O]*i.cp(O);k+=ut;const rt=9*O,bt=r.bi[O],Pt=r.bj[O],vt=K===ft?0:Fn(K,z);K!==ft&&!b&&(b=!0,T.fill(0),A.fill(0));for(let qt=0;qt<9;qt+=1){const At=r.wt[rt+qt];if(At===0)continue;const we=bt+qt%3,Tt=Pt+(qt/3|0);if(we<0||Tt<0||we>=a||Tt>=l)continue;const ns=we+Tt*a;_[ns]+=At*ut,g[ns]+=At*ut*z,K!==ft&&(T[ns]+=At*ut,A[ns]+=At*ut*vt)}}const{Cgr:S,CTgr:M}=this;S.fill(0),M.fill(0);const P=this.grains;if(P!==null)for(let O=0;O<P.count;O+=1){const K=n.cellAt(P.x[O],P.y[O]);if(K<0||n.solid[K]!==0)continue;const z=P.m[O]*P.cp(O);S[K]+=z,M[K]+=z*P.T[O]}const C=this.qb;C.fill(0);let L=this.bodyHeat(C);const{kS:B,kF:I,dSF:j}=this;for(let O=0;O<h;O+=1){let K=0,z=0;const ut=n.solid[O]!==0?n.T[O]:n.Ts[O];if(n.solid[O]!==0||n.capB[O]>0){K=this.solidCapCrust(O)+n.film[O]*Me(ut);const Tt=n.solid[O]!==0?pt[n.solid[O]-1]:pt[n.matB[O]-1];z=Tt!==void 0?Tt.k:0}const rt=c.cap[O]>0&&n.solid[O]===0?c.cap[O]:0,bt=_[O],Pt=K+rt+bt+S[O];if(p[O]=K,d[O]=rt,m[O]=Pt,j[O]=0,Pt<=0){y[O]=n.T[O],w[O]=0,x[O]=0;continue}const vt=(K*ut+rt*n.T[O]+g[O]+M[O])/Pt;y[O]=vt,bt>0&&(n.Tl[O]=g[O]/bt);let qt=z;if(n.solid[O]===0){const Tt=bt>=rt?b&&T[O]>0?((bt-T[O])*Ln(vt)+A[O])/bt:Ln(vt):_o(n.mg[O],n.mg[h+O],n.mg[Y*h+O],vt);if(K>0){const ns=Math.min(1,n.fs[O]);qt=ns*z+(1-ns)*Tt,B[O]=z,I[O]=Tt,rt+bt+S[O]>0&&(j[O]=ut-(rt*n.T[O]+g[O]+M[O])/(rt+bt+S[O]))}else qt=Tt}w[O]=qt;let At=F[O]+C[O];if(this.liquidPower!==0&&bt>0){const Tt=this.liquidPower*bt/k;At+=Tt,L+=Tt}const we=n.heater[O];if(we>=0&&n.role[O]===1){const Tt=this.heaters[we];Tt!==void 0&&Tt.cells>0&&(At+=Tt.P/Tt.cells,L+=Tt.P/Tt.cells)}x[O]=At}const{gx:E,gy:R}=this;for(let O=0;O<l;O+=1)for(let K=0;K<a;K+=1){const z=K+O*a;if(E[z]=0,R[z]=0,m[z]<=0)continue;const ut=w[z];if(K+1<a&&m[z+1]>0){const rt=w[z+1];ut+rt>0&&(E[z]=2*ut*rt/(ut+rt)*f)}if(O+1<l&&m[z+a]>0){const rt=w[z+a];ut+rt>0&&(R[z]=2*ut*rt/(ut+rt)*f)}}const W=this.solver,V=W.begin(a,l),Z=V.stride,it=u*f,dt=this.hExt*it,q=this.ambientT;for(let O=0;O<l;O+=1)for(let K=0;K<a;K+=1){const z=K+O*a;if(m[z]<=0)continue;const ut=K+1+(O+1)*Z;V.act[ut]=1,V.dH[ut]=m[z]/t;let rt=x[z];const bt=w[z],Pt=y[z];K+1<a&&(V.ax[ut]=E[z],rt+=E[z]*(y[z+1]-Pt)),K>0&&(rt+=E[z-1]*(y[z-1]-Pt)),O+1<l&&(V.ay[ut]=R[z],rt+=R[z]*(y[z+a]-Pt)),O>0&&(rt+=R[z-a]*(y[z-a]-Pt));let vt=0;K===0&&(vt+=this.sideConductance(n.openL,bt,dt,f)),K===a-1&&(vt+=this.sideConductance(n.openR,bt,dt,f)),O===0&&(vt+=this.sideConductance(n.openB,bt,dt,f)),O===l-1&&(vt+=this.sideConductance(n.openT,bt,dt,f)),vt>0&&(V.dDx[ut]=vt,rt+=vt*(q-y[z])),V.b[ut]=rt}const N=W.solve(e,s,!1),U=this.last.solve;U.iterations=N.iterations,U.residual=N.residual,U.capped=N.capped;const J=this.Tnew,wt=V.x;for(let O=0;O<l;O+=1)for(let K=0;K<a;K+=1){const z=K+O*a;J[z]=m[z]>0?y[z]+wt[K+1+(O+1)*Z]:n.T[z]}const mt=this.dE;let D=0,$=0;for(let O=0;O<h;O+=1)mt[O]=m[O]>0?x[O]*t:0;for(let O=0;O<l;O+=1)for(let K=0;K<a;K+=1){const z=K+O*a;if(m[z]<=0)continue;const ut=w[z];if(E[z]>0){const rt=E[z]*(J[z+1]-J[z])*t;mt[z]+=rt,mt[z+1]-=rt,n.kind[z]!==n.kind[z+1]&&this.pair(n.kind[z],n.kind[z+1],rt)}if(R[z]>0){const rt=R[z]*(J[z+a]-J[z])*t;mt[z]+=rt,mt[z+a]-=rt,n.kind[z]!==n.kind[z+a]&&this.pair(n.kind[z],n.kind[z+a],rt)}for(let rt=0;rt<4;rt+=1){if(!(rt===0?K===0:rt===1?K===a-1:rt===2?O===0:O===l-1))continue;const Pt=rt===0?n.openL:rt===1?n.openR:rt===2?n.openB:n.openT,vt=this.sideConductance(Pt,ut,dt,f)*(J[z]-q)*t;mt[z]-=vt,Pt?$+=vt:D+=vt,n.solid[z]!==0&&(this.lossSolids+=vt)}}for(let O=0;O<h;O+=1){if(m[O]<=0)continue;const K=mt[O]/m[O];J[O]=K;let z=0;const ut=d[O]+_[O]+S[O];if(j[O]!==0&&p[O]>0&&ut>0){const rt=Math.min(.999,Math.max(.001,n.fs[O])),bt=f/(.5*rt/Math.max(1e-9,B[O])+.5*(1-rt)/Math.max(1e-9,I[O])),Pt=p[O]*ut/(p[O]+ut);z=(1-Math.exp(-t*bt/Pt))*j[O]*Pt}p[O]>0&&(n.Es[O]+=K*p[O]-z,this.deriveSolid(O)),d[O]>0&&(n.Hg[O]+=K*d[O]+z*d[O]/ut),z!==0&&_[O]+S[O]>0&&(J[O]+=z/ut)}for(let O=0;O<i.count;O+=1){const K=9*O,z=r.bi[O],ut=r.bj[O];let rt=0;for(let vt=0;vt<9;vt+=1){const qt=r.wt[K+vt];if(qt===0)continue;const At=z+vt%3,we=ut+(vt/3|0);if(At<0||we<0||At>=a||we>=l)continue;const Tt=At+we*a;m[Tt]>0&&(rt+=qt*J[Tt])}if(rt===0)continue;const bt=i.mass[O],Pt=bt/i.rho[O];i.h[O]+=i.cp(O)*rt,i.derive(O),r.dVp[O]+=bt/i.rho[O]-Pt}if(P!==null)for(let O=0;O<P.count;O+=1){const K=n.cellAt(P.x[O],P.y[O]);K>=0&&n.solid[K]===0&&m[K]>0&&(P.T[O]+=J[K])}for(let O=0;O<h;O+=1)d[O]>0&&c.deriveCell(O);F.fill(0);const Q=this.last;return Q.heater=L*t,Q.lossWalls=D,Q.lossOpen=$,Q}pair(t,e,s){t===ht&&e===st?this.fluxSL-=s:t===st&&e===ht?this.fluxSL+=s:t===st&&e===G?this.fluxLG-=s:t===G&&e===st?this.fluxLG+=s:t===ht&&e===G?this.fluxSG-=s:t===G&&e===ht&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function ih(o,t,e,s,n,i,r,c,a,l,h){const{nx:f,ny:u,dx:m}=o;for(let y=0;y<o.nu;y+=1)e[y]=n[y]>l?e[y]/n[y]:0;for(let y=0;y<o.nv;y+=1)s[y]=i[y]>l?s[y]/i[y]:0;const p=a*m*m/h,d=(y,w)=>y+w>0?2*y*w/(y+w):0;let g=0;{const y=f+1,w=t.begin(y,u),x=o.ul;for(let _=0;_<u;_+=1)for(let T=0;T<=f;T+=1){const A=T+_*y;if(r[A]!==1)continue;const b=t.at(T,_),k=e[A];if(w.act[b]=1,w.dH[b]=p,w.x[b]=x[A],w.b[b]=p*x[A],T+1<=f){const S=r[A+1];S===1?w.ax[b]=d(k,e[A+1]):S===2&&(w.dDx[b]+=k)}if(T>0&&r[A-1]===2&&(w.dDx[b]+=k),_+1<u){const S=r[A+y];S===1?w.ay[b]=d(k,e[A+y]):S===2&&(w.dDy[b]+=2*k)}else o.openT||(w.dDy[b]+=2*k);_>0?r[A-y]===2&&(w.dDy[b]+=2*k):o.openB||(w.dDy[b]+=2*k)}const F=t.solve(1e-6,200,!1);g+=F.iterations;for(let _=0;_<u;_+=1)for(let T=0;T<=f;T+=1){const A=T+_*y;r[A]===1&&(x[A]=w.x[t.at(T,_)])}}{const y=t.begin(f,u+1),w=o.vl;for(let F=0;F<=u;F+=1)for(let _=0;_<f;_+=1){const T=_+F*f;if(c[T]!==1)continue;const A=t.at(_,F),b=s[T];if(y.act[A]=1,y.dH[A]=p,y.x[A]=w[T],y.b[A]=p*w[T],F+1<=u){const k=c[T+f];k===1?y.ay[A]=d(b,s[T+f]):k===2&&(y.dDy[A]+=b)}if(F>0&&c[T-f]===2&&(y.dDy[A]+=b),_+1<f){const k=c[T+1];k===1?y.ax[A]=d(b,s[T+1]):k===2&&(y.dDx[A]+=2*b)}else o.openR||(y.dDx[A]+=2*b);_>0?c[T-1]===2&&(y.dDx[A]+=2*b):o.openL||(y.dDx[A]+=2*b)}const x=t.solve(1e-6,200,!1);g+=x.iterations;for(let F=0;F<=u;F+=1)for(let _=0;_<f;_+=1){const T=_+F*f;c[T]===1&&(w[T]=y.x[t.at(_,F)])}}return g}class rh{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:c,n:a}=e,l=te.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(a*l),this.cellHost=new Uint8Array(a));const h=this.cellMat,f=this.cellHost;h.fill(0);let u=!1;for(let d=0;d<t.count;d+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),y=Math.min(c-1,Math.max(0,Math.floor(t.y[d]/e.dx)));h[(g+y*r)*l+t.mat[d]]+=t.mass[d],t.smass[2*d]>0&&(u=!0)}if(u){this.cellVolW===null&&(this.cellVolW=new Float64Array(a));const d=this.cellVolW;d.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==ft)continue;const y=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),w=Math.min(c-1,Math.max(0,Math.floor(t.y[g]/e.dx)));d[y+w*r]+=t.mass[g]/t.rho[g]}}for(let d=0;d<a;d+=1){let g=0;for(let y=1;y<l;y+=1)h[d*l+y]>h[d*l+g]&&(g=y);f[d]=g}let m=!1;const p=.25*e.dx;for(let d=0;d<t.count;d+=1){i[d]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),y=Math.min(c-1,Math.max(0,Math.floor(t.y[d]/e.dx))),w=f[g+y*r],x=t.mat[d];if(x===w)continue;const F=t.T[d],_=this.cellVolW,T=g+y*r,A=u&&w===ft&&_!==null&&_[T]>0?h[T*l]/_[T]:_s(w,F),b=t.rho[d],k=On(w,F),S=On(x,F),M=t.mass[d]/b,P=Math.cbrt(6*M/Math.PI),C=Math.abs(A-b);if(C<=0||n<=0)continue;const L=(2*k+3*S)/(3*k+3*S);let B=C*n*P*P/(18*k*L);for(let j=0;j<8;j+=1){const E=Math.max(1e-9,A*B*P/k),R=24/E*L*(1+.15*Math.pow(E,.687));B=Math.sqrt(4*C*n*P/(3*A*R))}const I=b<A?1:-1;i[d]=I*Math.min(p,B*s),m=!0}return m}}function oh(o,t,e,s,n,i,r,c,a,l,h){const f=t.w,u=t.h,m=t.dx;let p=0,d=0,g=0,y=0;const w=s;for(let x=0;x<o.count;x+=1){const F=o.x[x],_=o.y[x],T=w[x]!==0;let A,b;if(T)A=F+e*o.vx[x],b=_+e*o.vy[x];else{i(F,_,a);const M=F+.5*e*a[0],P=_+.5*e*a[1];i(M,P,a),A=F+e*a[0],b=_+e*a[1]+(n!==null?n[x]:0)}if(A<0&&t.openL||A>f&&t.openR||b<0&&t.openB||b>u&&t.openT){const M=o.smass[2*x];o.mat[x]===ft?p+=o.mass[x]-M:d+=o.mass[x]-M,g+=M,y+=o.mass[x]*o.h[x],n!==null&&(n[x]=n[o.count-1]),w[x]=w[o.count-1],r(x),x-=1;continue}const k=1e-4*m;T&&(A<k||A>f-k)&&(o.vx[x]=0),T&&(b<k||b>u-k)&&(o.vy[x]=0),A=Math.min(f-k,Math.max(k,A)),b=Math.min(u-k,Math.max(k,b));const S=c!==null?c(F,_,A,b,l):0;if(S===1){A=l[0],b=l[1];const M=l[2],P=l[3];if(T)o.vx[x]=l[4],o.vy[x]=l[5];else{const C=(o.vx[x]-l[4])*M+(o.vy[x]-l[5])*P;C<0&&(o.vx[x]-=C*M,o.vy[x]-=C*P)}}else if(S===0){let M=t.sdfAt(A,b);if(M<.05*m){const P=A,C=b;for(let L=0;L<3&&M<.05*m;L+=1){const B=.25*m;let I=t.sdfAt(A+B,b)-t.sdfAt(A-B,b),j=t.sdfAt(A,b+B)-t.sdfAt(A,b-B);const E=Math.hypot(I,j);if(E<1e-12)break;I/=E,j/=E;const R=.05*m-M;A+=R*I,b+=R*j;const W=o.vx[x]*I+o.vy[x]*j;T?(o.vx[x]=0,o.vy[x]=0):W<0&&(o.vx[x]-=W*I,o.vy[x]-=W*j),A=Math.min(f-k,Math.max(k,A)),b=Math.min(u-k,Math.max(k,b)),M=t.sdfAt(A,b)}if(c!==null&&(A!==P||b!==C)&&c(P,C,A,b,l)===1)if(A=l[0],b=l[1],T)o.vx[x]=l[4],o.vy[x]=l[5];else{const L=(o.vx[x]-l[4])*l[2]+(o.vy[x]-l[5])*l[3];L<0&&(o.vx[x]-=L*l[2],o.vy[x]-=L*l[3])}}}o.x[x]=A,o.y[x]=b}h.m=p,h.o=d,h.s=g,h.e=y}const ah=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),ja=24,ch=1,lh=1,Ia=24,Ba=1,he=(o,t)=>(o+2)*(t+2);function Ea(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function fh(o,t,e,s,n,i){let r=0;for(let c=0;c<i;c+=1){o[c]+=n*e[c];const a=t[c]-n*s[c];t[c]=a,r+=a*a}return r}function uh(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class Lt{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(ah(he(s,n),i)),!(s*n<=ja||s<=2&&n<=2);)i=he(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=he(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const c=this.levels[0],a=this.xs,l=this.bs;this.system={get nx(){return c.nx},get ny(){return c.ny},get stride(){return c.stride},ax:c.ax,ay:c.ay,dH:c.dH,dDx:c.dDx,dDy:c.dDy,act:c.act,x:a,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=he(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:a,dDy:l,diag:h,inv:f,act:u}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let d=1;d<=e;d+=1,p+=1){if(u[p]===0){h[p]=1,f[p]=1;continue}const g=c[p]+a[p]+l[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){u[p]=0,h[p]=1,f[p]=1;continue}h[p]=g,f[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:c,ay:a,diag:l}=t;for(let h=1;h<=i;h+=1){let f=1+h*r;for(let u=1;u<=n;u+=1,f+=1)s[f]=l[f]*e[f]-c[f]*e[f+1]-c[f-1]*e[f-1]-a[f]*e[f+r]-a[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:c,inv:a,x:l,b:h}=t;for(let f=1;f<=n;f+=1){let u=1+(1+f+e&1)+f*i;const m=s+f*i;for(;u<=m;u+=2)l[u]=(h[u]+r[u]*l[u+1]+r[u-1]*l[u-1]+c[u]*l[u+i]+c[u-i]*l[u-i])*a[u]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:c,band:a}=t;let l=0;for(let h=1;h<=s;h+=1){let f=1+h*n;for(let u=1;u<=e;u+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||c[f]>0)&&(a[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:c,b:a,band:l,bandCount:h}=t;for(let f=e>0?0:h-1;e>0?f<h:f>=0;f+=e){const u=l[f];c[u]=(a[u]+n[u]*c[u+1]+n[u-1]*c[u-1]+i[u]*c[u+s]+i[u-s]*c[u-s])*r[u]}}prepareFine(){const t=this.levels[0],e=he(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=ja||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=he(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const c=e.stride,a=e.h,l=s.h;for(let h=0;h<i;h+=1)for(let f=0;f<n;f+=1){const u=f+1+(h+1)*s.stride;let m=0,p=0,d=0,g=0;for(let A=0;A<2;A+=1){const b=2*h+A;if(!(b>=e.ny))for(let k=0;k<2;k+=1){const S=2*f+k;if(S>=e.nx)continue;const M=S+1+(b+1)*c;if(e.act[M]===0)continue;const P=e.area[M];m+=P,p+=P*((k-.5)*a+e.ox[M]*a),d+=P*((A-.5)*a+e.oy[M]*a),g+=e.dH[M]}}if(m<=0){s.act[u]=0,s.dH[u]=0,s.dDx[u]=0,s.dDy[u]=0,s.gDx[u]=0,s.gDy[u]=0,s.ox[u]=0,s.oy[u]=0;continue}s.act[u]=1,s.area[u]=m/4;const y=p/m,w=d/m;s.ox[u]=y/l,s.oy[u]=w/l,s.dH[u]=g;let x=0,F=0,_=0,T=0;for(let A=0;A<2;A+=1){const b=2*h+A;if(!(b>=e.ny))for(let k=0;k<2;k+=1){const S=2*f+k;if(S>=e.nx)continue;const M=S+1+(b+1)*c;if(e.act[M]!==0){if(e.gDx[M]>0){const P=(k-.5)*a+e.ox[M]*a;x+=e.gDx[M],F+=e.gDx[M]/(e.eDx[M]+Math.abs(P-y))}if(e.gDy[M]>0){const P=(A-.5)*a+e.oy[M]*a;_+=e.gDy[M],T+=e.gDy[M]/(e.eDy[M]+Math.abs(P-w))}}}}s.gDx[u]=x,s.gDy[u]=_,s.dDx[u]=F,s.dDy[u]=T,s.eDx[u]=F>0?x/F:.5*l,s.eDy[u]=T>0?_/T:.5*l}for(let h=0;h<i;h+=1)for(let f=0;f<n;f+=1){const u=f+1+(h+1)*s.stride;if(s.act[u]!==0){if(f+1<n&&s.act[u+1]!==0){const m=2*f+1;let p=0;if(m+1<e.nx)for(let d=0;d<2;d+=1){const g=2*h+d;g>=e.ny||(p+=e.gx[m+1+(g+1)*c])}if(p>0){const d=l*(1+s.ox[u+1]-s.ox[u]);s.gx[u]=p,s.ax[u]=p/Math.max(.25*l,d)}}if(h+1<i&&s.act[u+s.stride]!==0){const m=2*h+1;let p=0;if(m+1<e.ny)for(let d=0;d<2;d+=1){const g=2*f+d;g>=e.nx||(p+=e.gy[g+1+(m+1)*c])}if(p>0){const d=l*(1+s.oy[u+s.stride]-s.oy[u]);s.gy[u]=p,s.ay[u]=p/Math.max(.25*l,d)}}}}Lt.diagonal(s),Lt.findBand(s);for(let h=0;h<e.ny;h+=1){let f=1+(h+1)*c;for(let u=0;u<e.nx;u+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}Lt.weights(s,u,h,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const c=e>>1,a=s>>1,l=(e&1)===1?1:-1,h=(s&1)===1?1:-1,f=t.stride,u=c+1+(a+1)*f;r[0]=u,r[1]=u+l,r[2]=u+h*f,r[3]=u+l+h*f;const m=c+l>=0&&c+l<t.nx,p=a+h>=0&&a+h<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[u]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<Ia;m+=1)Lt.color(e,0),Lt.color(e,1);for(let m=0;m<Ia;m+=1)Lt.color(e,1),Lt.color(e,0);return}for(let m=0;m<ch;m+=1)Lt.color(e,0),Lt.color(e,1);for(let m=0;m<Ba;m+=1)Lt.bandSweep(e,1);Lt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,he(s.nx,s.ny)),s.x.fill(0,0,he(s.nx,s.ny));const{stride:n,act:i,b:r,r:c,x:a}=e,{pIdx:l,pW:h}=s,f=s.b,u=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=r[p]-c[p],y=4*p;f[l[y]]+=h[y]*g,f[l[y+1]]+=h[y+1]*g,f[l[y+2]]+=h[y+2]*g,f[l[y+3]]+=h[y+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=4*p;a[p]+=h[g]*u[l[g]]+h[g+1]*u[l[g+1]]+h[g+2]*u[l[g+2]]+h[g+3]*u[l[g+3]]}}for(let m=0;m<Ba;m+=1)Lt.bandSweep(e,-1);for(let m=0;m<lh;m+=1)Lt.color(e,1),Lt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:c,dDx:a,dDy:l,act:h}=t,f=this.nullId,u=he(e,s);let m=!1;for(let p=0;p<u;p+=1)if(h[p]!==0&&!(c[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,u),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let d=1;d<=e;d+=1){const g=d+p*n;if(h[g]===0||f[g]!==-2)continue;let y=0,w=0,x=!1;const F=-3-this.nullCount;this.stack[y++]=g,f[g]=F;let _=g,T=g;for(;y>0;){const b=this.stack[--y];w+=1,b<_&&(_=b),b>T&&(T=b),(c[b]>0||a[b]>0||l[b]>0)&&(x=!0),i[b]>0&&f[b+1]===-2&&(f[b+1]=F,this.stack[y++]=b+1),i[b-1]>0&&f[b-1]===-2&&(f[b-1]=F,this.stack[y++]=b-1),r[b]>0&&f[b+n]===-2&&(f[b+n]=F,this.stack[y++]=b+n),r[b-n]>0&&f[b-n]===-2&&(f[b-n]=F,this.stack[y++]=b-n)}let A=-1;if(!x){if(A=this.nullCount,A>=this.nullSum.length){const b=k=>{const S=new Float64Array(2*k.length);return S.set(k),S};this.nullSum=b(this.nullSum),this.nullCnt=b(this.nullCnt)}this.nullCnt[A]=w,this.nullCount+=1}for(let b=_;b<=T;b+=1)f[b]===F&&(f[b]=A)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=he(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=he(i.nx,i.ny),{act:c}=i,a=this.xs,l=this.bs,h=i.stride;for(let _=0;_<r;_+=1){if(c[_]===0){a[_]=0,l[_]=0,i.ax[_]=0,i.ay[_]=0;continue}(_+1>=r||c[_+1]===0)&&(i.ax[_]=0),(_+h>=r||c[_+h]===0)&&(i.ay[_]=0)}Lt.diagonal(i);for(let _=0;_<r;_+=1)c[_]===0&&(a[_]=0,l[_]=0);this.findNull(),this.project(l),s&&(Lt.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,u=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),u.fill(0,0,r),Lt.apply(i,a,p);let d=0,g=0;for(let _=0;_<r;_+=1){const T=c[_]===0?0:l[_]-p[_];f[_]=T,d+=l[_]*l[_],g+=T*T}this.project(f);const y=Math.sqrt(d);if(y===0)return a.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(g)/y;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,f,u,r);let x=0;for(let _=0;_<r;_+=1)m[_]=u[_],x+=f[_]*u[_];let F=0;for(;F<e;){F+=1,Lt.apply(i,m,p);const _=Ea(m,p,r);if(!(_>0))break;const T=x/_;if(g=fh(a,f,m,p,T,r),w=Math.sqrt(g)/y,w<=t)break;this.precondition(s,f,u,r);const A=Ea(f,u,r),b=A/x;x=A,uh(m,u,b,r)}this.project(a);for(let _=0;_<r;_+=1)c[_]===0&&(a[_]=0);return n.iterations=F,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const hh=.1,Ra=5e-4,Da=1e-9,no=.1;function gi(o,t,e,s,n){return n[e]===2||s>=1?o[e]:s*o[e]+(1-s)*t[e]}function ce(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class dh{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new rh);v(this,"dropletDrift",null);v(this,"bodyHit",null);v(this,"afterSolve",null);v(this,"hit",new Float64Array(6));v(this,"escaped",{m:0,o:0,s:0,e:0});v(this,"velocityAtFn",(t,e,s)=>{Dn(this.g,t,e,s)});v(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,c=1/e.dx;e.updateThin();for(let a=0;a<t.count;a+=1){n[a]=ce(t.x[a]*c-.5,s,0),i[a]=ce(t.y[a]*c-.5,s,3);const l=9*a;for(let h=0;h<3;h+=1)for(let f=0;f<3;f+=1)r[l+f+3*h]=s[f]*s[3+h];e.thinAny&&e.cutWeights(n[a]+1,i[a]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:c,ny:a,kind:l}=e;for(let h=0;h<t.count;h+=1){const f=9*h,u=s[h],m=n[h];let p=0;for(let d=0;d<9;d+=1){const g=u+d%3,y=m+(d/3|0),x=g>=0&&y>=0&&g<c&&y<a&&l[g+y*c]===st?i[f+d]:0;r[f+d]=x,p+=x}if(p>0){const d=1/p;for(let g=0;g<9;g+=1)r[f+g]*=d}else{for(let d=0;d<9;d+=1)r[f+d]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:c,wt:a}=this,{nx:l,ny:h,kind:f}=s,u=1/s.dx;i[t]=ce(e.x[t]*u-.5,n,0),r[t]=ce(e.y[t]*u-.5,n,3);const m=9*t;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1)c[m+g+3*d]=n[g]*n[3+d];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,c,m);let p=0;for(let d=0;d<9;d+=1){const g=i[t]+d%3,y=r[t]+(d/3|0),w=g>=0&&y>=0&&g<l&&y<h&&f[g+y*l]===st;a[m+d]=w?c[m+d]:0,w&&(p+=c[m+d])}if(p>0)for(let d=0;d<9;d+=1)a[m+d]/=p;else{for(let d=0;d<9;d+=1)a[m+d]=0;a[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:c,phi:a}=e;a.fill(0);const l=1/e.vCell;let h=0,f=0;for(let u=0;u<t.count;u+=1){const m=t.mass[u]/t.rho[u];h+=t.mass[u],f+=m;const p=9*u,d=s[u],g=n[u];for(let y=0;y<9;y+=1){const w=d+y%3,x=g+(y/3|0);w<0||x<0||w>=r||x>=c||(a[w+x*r]+=i[p+y]*m*l)}}f>0&&(this.rhoRef=h/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ht;continue}const c=e.phi[r],a=e.fs[r]>0&&e.besideThin(r)?c/(1-Math.min(.9,e.phiS[r])):c+e.phiS[r];let l=c>0&&a+e.alpha[r]+e.grain[r]>=.5;if(!l&&t!==null&&t[r]!==G&&t[r]!==ht){const h=r%s,f=(r-h)/s;(h>0?t[r-1]===G&&e.faceOpen(r,0)>0:e.openL)||(h<s-1?t[r+1]===G&&e.faceOpen(r,1)>0:e.openR)||(f>0?t[r-s]===G&&e.faceOpen(r,2)>0:e.openB)||(f<n-1?t[r+s]===G&&e.faceOpen(r,3)>0:e.openT)||(l=!0)}e.kind[r]=l?st:G,l&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:c,rv:a}=this,{nx:l,ny:h,dx:f}=e,u=1/f,m=l+1;n.fill(0),i.fill(0),r.fill(0),c.fill(0),a.fill(0);const p=1/this.rhoRef,d=this.viscous;d&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,y=this.etaV;d&&(g.fill(0),y.fill(0));for(let w=0;w<t.count;w+=1){const x=t.x[w],F=t.y[w],_=t.mass[w],T=d?On(t.mat[w],t.T[w]):0,A=t.vx[w],b=t.vy[w],k=t.c00[w],S=t.c01[w],M=t.c10[w],P=t.c11[w],C=x*u,L=F*u;let B=ce(C,s,0),I=ce(L-.5,s,3);for(let E=0;E<3;E+=1){const R=I+E,W=(R+.5)*f-F;for(let V=0;V<3;V+=1){const Z=B+V,it=s[V]*s[3+E]*_,dt=it*(A+k*(Z*f-x)+S*W);if(Z>=0&&Z<=l&&R>=0&&R<h){const q=Z+R*m;n[q]+=it,i[q]+=dt,d&&(g[q]+=it*T)}else this.mirrorU(Z,R),n[this.mf]+=it,i[this.mf]+=this.ms*dt,d&&(g[this.mf]+=it*T)}}B=ce(C-.5,s,0),I=ce(L,s,3);const j=t.rho[w]*p;for(let E=0;E<3;E+=1){const R=I+E,W=R*f-F;for(let V=0;V<3;V+=1){const Z=B+V,it=s[V]*s[3+E]*_,dt=it*(b+M*((Z+.5)*f-x)+P*W);let q,N=1;Z>=0&&Z<l&&R>=0&&R<=h?q=Z+R*l:(this.mirrorV(Z,R),q=this.mf,N=this.ms),r[q]+=it,c[q]+=N*dt,a[q]+=it*j,d&&(y[q]+=it*T)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,a=1;r<0?s.openL?r=0:(r=-r,a=-a):r>n&&(s.openR?r=n:(r=2*n-r,a=-a)),c<0?c=s.openB?0:-1-c:c>=i&&(c=s.openT?i-1:2*i-1-c),r=Math.min(n,Math.max(0,r)),c=Math.min(i-1,Math.max(0,c)),this.mf=r+c*(n+1),this.ms=a}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,c=e,a=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),c<0?s.openB?c=0:(c=-c,a=-a):c>i&&(s.openT?c=i:(c=2*i-c,a=-a)),r=Math.min(n-1,Math.max(0,r)),c=Math.min(i,Math.max(0,c)),this.mf=r+c*n,this.ms=a}step(t,e,s,n){const{g:i,P:r}=this,{nx:c,ny:a,dx:l,kind:h}=i,f=c+1;this.viscous=r.hasOther(),this.p2g();const{mu:u,pu:m,mv:p,pv:d,rv:g,knownU:y,knownV:w}=this,x=i.ul,F=i.vl,_=this.rhoRef*i.vCell*.25,T=Da*_,A=this.viscous;for(let j=0;j<i.nu;j+=1)x[j]=u[j]>T?m[j]/u[j]+(A?0:t*this.fU[j]/(this.rhoRef*i.vCell)):0;for(let j=0;j<i.nv;j+=1)F[j]=p[j]>T?d[j]/p[j]+(A?0:-t*e*(g[j]/p[j])+t*this.fV[j]/(this.rhoRef*i.vCell)):0;for(let j=0;j<a;j+=1)for(let E=0;E<=c;E+=1){const R=E+j*f,W=E>0?h[E-1+j*c]:-1,V=E<c?h[E+j*c]:-1,Z=E===0&&!i.openL,it=E===c&&!i.openR;if(Z||it||W===ht||V===ht||i.au[R]<=0){x[R]=Z||it?0:i.usol[R],y[R]=2;continue}y[R]=W===st||V===st?1:0}for(let j=0;j<=a;j+=1)for(let E=0;E<c;E+=1){const R=E+j*c,W=j>0?h[E+(j-1)*c]:-1,V=j<a?h[E+j*c]:-1,Z=j===0&&!i.openB,it=j===a&&!i.openT;if(Z||it||W===ht||V===ht||i.av[R]<=0){F[R]=Z||it?0:i.vsol[R],w[R]=2;continue}w[R]=W===st||V===st?1:0}if(this.last.viscIterations=0,A){this.viscosity(t);const j=t/(this.rhoRef*i.vCell);for(let E=0;E<i.nu;E+=1)y[E]!==2&&u[E]>T&&(x[E]+=j*this.fU[E]);for(let E=0;E<i.nv;E+=1)w[E]!==2&&p[E]>T&&(F[E]+=-t*e*(g[E]/p[E])+j*this.fV[E])}let b=c,k=-1,S=a,M=-1,P=0;for(let j=0;j<a;j+=1)for(let E=0;E<c;E+=1)h[E+j*c]===st&&(P+=1,E<b&&(b=E),E>k&&(k=E),j<S&&(S=j),j>M&&(M=j));const C=this.last.solve;if(C.iterations=0,C.residual=0,C.capped=!1,P>0){const j=k-b+1,E=M-S+1,R=this.solver,W=R.begin(j,E),V=t/this.rhoRef,Z=1/i.vCell,it=this.pGas;for(let N=S;N<=M;N+=1)for(let U=b;U<=k;U+=1){const J=U+N*c;if(h[J]!==st)continue;const wt=R.at(U-b,N-S);W.act[wt]=1,W.x[wt]=i.pl[J];const mt=U+N*f,D=U+N*c,$=y[mt+1]===2?0:i.au[mt+1],Q=y[mt]===2?0:i.au[mt],O=w[D+c]===2?0:i.av[D+c],K=w[D]===2?0:i.av[D],z=gi(x,i.usol,mt+1,$,y)-gi(x,i.usol,mt,Q,y)+gi(F,i.vsol,D+c,O,w)-gi(F,i.vsol,D,K,w),ut=i.phi[J]+i.phiS[J]+i.alpha[J]+i.grain[J];let rt=this.volSrc[J]*Z;const bt=this.gasAt(U-1,N)||this.gasAt(U+1,N)||this.gasAt(U,N-1)||this.gasAt(U,N+1),Pt=ut-1;(Pt>0||!bt)&&(rt+=hh*Pt/Math.max(t,Ra));let vt=rt*l*l-l*z;if(U+1<c){const qt=h[J+1];if(qt===st)U+1<=k&&$>0&&(W.ax[wt]=$<1?V*$:V);else if(qt===G&&$>0){const At=($<1?V*$:V)/this.theta(J,J+1);W.dDx[wt]+=At,vt+=At*it[J+1]}}else i.openR&&$>0&&(W.dDx[wt]+=$<1?2*V*$:2*V);if(U>0){if(h[J-1]===G&&Q>0){const At=(Q<1?V*Q:V)/this.theta(J,J-1);W.dDx[wt]+=At,vt+=At*it[J-1]}}else i.openL&&Q>0&&(W.dDx[wt]+=Q<1?2*V*Q:2*V);if(N+1<a){const qt=h[J+c];if(qt===st)N+1<=M&&O>0&&(W.ay[wt]=O<1?V*O:V);else if(qt===G&&O>0){const At=(O<1?V*O:V)/this.theta(J,J+c);W.dDy[wt]+=At,vt+=At*it[J+c]}}else i.openT&&O>0&&(W.dDy[wt]+=O<1?2*V*O:2*V);if(N>0){if(h[J-c]===G&&K>0){const At=(K<1?V*K:V)/this.theta(J,J-c);W.dDy[wt]+=At,vt+=At*it[J-c]}}else i.openB&&K>0&&(W.dDy[wt]+=K<1?2*V*K:2*V);W.b[wt]=vt}const dt=R.solve(s,n,!0);C.iterations=dt.iterations,C.residual=dt.residual,C.capped=dt.capped;const q=i.pl;for(let N=0;N<i.n;N+=1)q[N]=h[N]===G?it[N]:0;for(let N=S;N<=M;N+=1)for(let U=b;U<=k;U+=1){const J=U+N*c;h[J]===st&&(q[J]=W.x[R.at(U-b,N-S)])}for(let N=0;N<a;N+=1)for(let U=0;U<=c;U+=1){const J=U+N*f;if(y[J]===1){if(U===0){x[J]-=V/l*2*(q[N*c]-0);continue}if(U===c){x[J]-=V/l*2*(0-q[c-1+N*c]);continue}x[J]-=V/l*this.across(U-1+N*c,U+N*c)}}for(let N=0;N<=a;N+=1)for(let U=0;U<c;U+=1){const J=U+N*c;if(w[J]===1){if(N===0){F[J]-=V/l*2*(q[U]-0);continue}if(N===a){F[J]-=V/l*2*(0-q[U+(a-1)*c]);continue}F[J]-=V/l*this.across(U+(N-1)*c,U+N*c)}}this.afterSolve!==null&&this.afterSolve(R,b,S,t)}this.extrapolate();const L=this.markStranded(),B=this.g2p(L?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const I=this.last;return I.cells=P,I.uMax=B,I.escapedMass=this.escM,I.escapedOther=this.escO,I.escapedSalt=this.escS,I.escapedEnergy=this.escE,I}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t]+s.grain[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e]+s.grain[e];return!(n>.5)||!(n>i)?no:Math.max(no,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===G&&n[e]===st?i/this.theta(e,t):n[e]===G&&n[t]===st?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new Lt(e.nx+1,e.ny+1));const s=Da*this.rhoRef*e.vCell*.25;this.last.viscIterations=ih(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===G}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:c,volSrc:a}=this,{nx:l,ny:h}=s,f=1/Math.max(t,Ra);for(let u=0;u<e.count;u+=1){const m=c[u];if(m===0)continue;const p=9*u,d=n[u],g=i[u];for(let y=0;y<9;y+=1){const w=d+y%3,x=g+(y/3|0);w<0||x<0||w>=l||x>=h||(a[w+x*l]+=r[p+y]*m*f)}}}extrapolate(){Hu(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:c,ny:a,dx:l}=n,h=1/l,f=c+1,u=n.ul,m=n.vl,p=4/(l*l);let d=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const L=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];L>d&&(d=L);continue}const y=s.x[g],w=s.y[g],x=y*h,F=w*h;let _=ce(x,i,0),T=ce(F-.5,i,3),A=0,b=0,k=0;for(let L=0;L<3;L+=1){const B=T+L,I=(B+.5)*l-w;for(let j=0;j<3;j+=1){const E=_+j,R=i[j]*i[3+L];let W;E>=0&&E<=c&&B>=0&&B<a?W=u[E+B*f]:(this.mirrorU(E,B),W=this.ms*u[this.mf]),A+=R*W,b+=R*W*(E*l-y),k+=R*W*I}}_=ce(x-.5,i,0),T=ce(F,i,3);let S=0,M=0,P=0;for(let L=0;L<3;L+=1){const B=T+L,I=B*l-w;for(let j=0;j<3;j+=1){const E=_+j,R=i[j]*i[3+L];let W;E>=0&&E<c&&B>=0&&B<=a?W=m[E+B*c]:(this.mirrorV(E,B),W=this.ms*m[this.mf]),S+=R*W,M+=R*W*((E+.5)*l-y),P+=R*W*I}}s.vx[g]=A,s.vy[g]=S,s.c00[g]=p*b,s.c01[g]=p*k,s.c10[g]=p*M,s.c11[g]=p*P;const C=A*A+S*S;C>d&&(d=C)}return Math.sqrt(d)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),$u(this.P,this.g,this.stranded)}velocityAt(t,e,s){Dn(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;oh(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class mh{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const c=this.count;return this.count+=1,this.x[c]=t,this.y[c]=e,this.vx[c]=0,this.vy[c]=0,this.c00[c]=0,this.c01[c]=0,this.c10[c]=0,this.c11[c]=0,this.mass[c]=s,this.h[c]=n,this.mat[c]=i,this.spc[2*c]=r>0?Qn:0,this.spc[2*c+1]=0,this.smass[2*c]=r>0?r:0,this.smass[2*c+1]=0,this.T[c]=0,this.id[c]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(c),c}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=Ef(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=or(r,i);return}const s=this.mat[t],n=mf(s,this.h[t]);this.T[t]=n,this.rho[t]=_s(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==ft)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?Bf(this.T[t],e/this.mass[t]):Ao(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function ph(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:c,heat:a}=o,{nx:l,ny:h,n:f,kind:u}=s,{Tl:m}=t,p=t.rd;let d=!1;for(let x=0;x<f;x+=1){if(p[x]=0,u[x]===G&&t.Cl[x]>0){const k=t.boilingAt(x,r.pAt(x));m[x]>k&&(p[x]=k,d=!0);continue}if(u[x]!==st)continue;const F=x%l,_=(x-F)/l,T=_+1<h?x+l:-1;if(!(T>=0&&u[T]===G&&s.faceOpen(x,3)>0||F>0&&u[x-1]===G&&s.faceOpen(x,0)>0||F<l-1&&u[x+1]===G&&s.faceOpen(x,1)>0||_>0&&u[x-l]===G&&s.faceOpen(x,2)>0))continue;const b=t.boilingAt(x,r.pAt(x));m[x]>b&&(p[x]=b,d=!0)}if(!d)return;const g=t.mtot;g.fill(0);const y=t.Y0;y.fill(0);const w=i.rhoRef*s.vCell/4;for(let x=0;x<n.count;x+=1){if(n.mat[x]!==ft)continue;const F=n.smass[2*x],_=F>0?F/n.mass[x]:0,T=9*x;let A=0,b=0,k=-1,S=0;for(let C=0;C<2;C+=1){for(let L=0;L<9;L+=1){const B=i.wt[T+L];if(B===0)continue;const I=i.bi[x]+L%3,j=i.bj[x]+(L/3|0);if(I<0||j<0||I>=l||j>=h)continue;const E=I+j*l,R=p[E];if(R===0)continue;const W=F>0?sl(R,_):_t(R);if(n.h[x]<=W)continue;const V=xt(R),Z=B*n.mass[x]*(n.h[x]-W)/(V-(F>0?Qs(R,_):W));C===0?(A+=Z,b+=Z*V,B>S&&(S=B,k=E)):(g[E]+=Z,y[E]+=Z*V)}if(A===0)break;if(C===0&&n.mass[x]-F-A<io*w){const L=p[k],B=n.mass[x]-F,I=xt(L),j=F>0?F*Yn(L):0;g[k]+=B,y[k]+=B*I,F>0&&o.salt.deposit(n.x[x],n.y[x],F,j),a.src[k]-=(B*I+j-n.mass[x]*n.h[x])/e,A=-1;break}}if(A===0)continue;if(A<0){i.removeParticle(x),x-=1;continue}const M=n.mass[x]/n.rho[x],P=n.mass[x]-A;n.h[x]=(n.mass[x]*n.h[x]-b)/P,n.mass[x]=P,n.derive(x),i.dVp[x]+=P/n.rho[x]-M}for(let x=0;x<f;x+=1){if(g[x]===0)continue;const F=x%l,_=(x-F)/l;let T=0;const A=u[x]===G?x:_+1<h&&u[x+l]===G&&s.faceOpen(x,3)>0?x+l:-1;if(A>=0)s.mg[Y*f+A]+=g[x],s.Hg[A]+=y[x],c.deriveCell(A);else{const b=t.side;b[0]=F>0&&u[x-1]===G&&s.faceOpen(x,0)>0?x-1:-1,b[1]=F<l-1&&u[x+1]===G&&s.faceOpen(x,1)>0?x+1:-1,b[2]=_>0&&u[x-l]===G&&s.faceOpen(x,2)>0?x-l:-1,b[3]=-1;for(let k=0;k<3;k+=1)b[k]>=0&&(T+=1);for(let k=0;k<3;k+=1)b[k]<0||(s.mg[Y*f+b[k]]+=g[x]/T,s.Hg[b[k]]+=y[x]/T,c.deriveCell(b[k]))}t.produced+=g[x]}}function gh(o,t,e,s,n){const i=o.grid,r=i.n,c=i.mg[at*r+t],a=i.mg[ct*r+t],l=i.Hg[t];if(s<=0)return Oc(c,a,e,l);let h=n;for(let f=0;f<6;f+=1){const u=c*re(at,h)+a*re(ct,h)+e*xt(h)+s*_t(h),m=(l-u)/Kr(c,a,e,s,h);if(h+=m,Math.abs(m)<1e-10)break}return h}function vn(o,t,e,s,n,i){const r=o.grid,c=r.n,a=r.mg[Y*c+t]-e,l=r.mfog[t]+e,h=gh(o,t,a,l,i),f=a/gt[Y];return(f+s>0?f/(f+s)*n:0)-qn(h)}function Ar(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const c=Math.max(-n.mfog[e],Math.min(n.mg[Y*r+e],s));n.mg[Y*r+e]-=c,n.mfog[e]+=c,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=c,i.deriveCell(e)}function xh(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==G)continue;const r=e.mg[Y*n+i],c=e.mfog[i];if(r<=0&&c<=0)continue;const a=e.mg[at*n+i]/gt[at]+e.mg[ct*n+i]/gt[ct],l=s.pAt(i),h=e.T[i];if(c<=0){const w=r/gt[Y];if(w/(w+a)*l<.999*qn(h))continue}const f=vn(o,i,0,a,l,h);if(f<=0&&c<=0)continue;let u,m,p,d;if(f>0)u=0,p=f,m=r,d=vn(o,i,m,a,l,h);else if(m=0,d=f,u=-c,p=vn(o,i,u,a,l,h),p<=0){Ar(o,t,i,u);continue}if(d>0){Ar(o,t,i,m);continue}let g=u,y=0;for(let w=0;w<40;w+=1){g=(u*d-m*p)/(d-p),(!Number.isFinite(g)||g<=Math.min(u,m)||g>=Math.max(u,m))&&(g=.5*(u+m));const x=vn(o,i,g,a,l,h);if(Math.abs(x)<=1e-13*l)break;x>0?(u=g,p=x,y===1&&(d/=2),y=1):(m=g,d=x,y===-1&&(p/=2),y=-1)}if(Ar(o,t,i,g),f<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=vn(o,i,0,a,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/qn(e.T[i]))}}}const io=.001;class vh{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"fed");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*te.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.fed=new Uint8Array(e),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,c=Math.min(.999,n*qn(t)/e),a=i.mg[at*r+s],l=i.mg[ct*r+s],h=a+l,f=h>0?h/(a/gt[at]+l/gt[ct]):.02885;return c*gt[Y]/(c*gt[Y]+(1-c)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:c,Cl:a,acc:l,accH:h,accAll:f,accS:u}=this;a.fill(0),c.fill(0),l.fill(0),h.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const y=e.mass[g],w=e.mat[g],x=y*e.cp(g),F=e.smass[2*g],_=y-F,T=F>0?Qs(e.T[g],F/y):e.h[g];F>0&&!p&&(p=!0,u.fill(0)),w!==ft&&!m&&(m=!0,f.fill(0),this.accMat.fill(0));const A=9*g;for(let b=0;b<9;b+=1){const k=s.wt[A+b];if(k===0)continue;const S=s.bi[g]+b%3,M=s.bj[g]+(b/3|0);if(S<0||M<0||S>=n||M>=i)continue;const P=S+M*n;a[P]+=k*x,c[P]+=k*x*e.T[g],w===ft&&(l[P]+=k*_,h[P]+=k*_*T),p&&(u[P]+=k*F),m&&(this.accMat[w*r+P]+=k*y)}}for(let g=0;g<r;g+=1)c[g]=a[g]>0?c[g]/a[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const y=u[g]>0&&l[g]>0?u[g]/(l[g]*Ue):0;this.mol[g]=y,this.aw[g]=y>0?Yc(c[g],y):1}if(!m){f.set(l),this.host.fill(ft);return}const d=te.length;for(let g=0;g<r;g+=1){this.accMat[ft*r+g]=p?l[g]+u[g]:l[g];let y=0,w=ft,x=-1;for(let F=0;F<d;F+=1){const _=this.accMat[F*r+g];y+=_,_>x&&(x=_,w=F)}f[g]=y,this.host[g]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?ko(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:_t(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?ft:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,{acc:a,dm:l,fed:h}=this;for(let u=0;u<s.n;u+=1)h[u]=a[u]>0?1:0;l.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){if(n.mat[u]!==ft)continue;const m=9*u;let p=0;for(let d=0;d<9;d+=1){const g=i.wt[m+d];if(g===0)continue;const y=i.bi[u]+d%3,w=i.bj[u]+(d/3|0);if(y<0||w<0||y>=r||w>=c)continue;const x=y+w*r;t[x]!==0&&a[x]>0&&(p+=t[x]*g*(n.mass[u]-n.smass[2*u])/a[x])}l[u]=p}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const m=l[u];if(m===0)continue;if(n.smass[2*u]>0){this.applySalty(u,m,f,e);continue}const p=n.mass[u]/n.rho[u],d=n.mass[u]+m;if(d<io*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,d),e);continue}this.track(u,m),n.mass[u]=d,i.dVp[u]+=d/n.rho[u]-p}for(let u=0;u<s.n;u+=1){if(t[u]<=0||h[u]!==0)continue;const m=u%r,p=(u-m)/r,d=n.add((m+.5)*s.dx,(p+.5)*s.dx,t[u],this.waterH(u),ft);d<0||(i.placeParticle(d),i.dVp[d]=t[u]/n.rho[d],this.track(d,t[u]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:c}=s,a=9*t,l=Ao(n.mat[t],n.T[t]);for(let h=0;h<9;h+=1){const f=i.wt[a+h];if(f===0)continue;const u=i.bi[t]+h%3,m=i.bj[t]+(h/3|0);if(u<0||m<0||u>=r||m>=c)continue;const p=u+m*r;this.acc[p]+=f*e,this.accH[p]+=f*e*n.h[t],this.accAll[p]+=f*e,this.Cl[p]+=f*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,c=i.smass[2*t],a=i.mass[t],l=a-c,h=Qs(i.T[t],c/a),f=i.cp(t),u=a*i.h[t]+e*h,m=l+e;if(m<io*s){this.trackSalty(t,-l,-l*h,-a,-c,-a*f),this.dryUp(t,Math.max(0,m),u,n);return}const p=a/i.rho[t];i.mass[t]=a+e,i.h[t]=u/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const d=Qs(i.T[t],c/i.mass[t]);this.trackSalty(t,e,m*d-l*h,e,0,i.mass[t]*i.cp(t)-a*f)}trackSalty(t,e,s,n,i,r){const{grid:c,liquid:a}=this.e,{nx:l,ny:h}=c,f=9*t;for(let u=0;u<9;u+=1){const m=a.wt[f+u];if(m===0)continue;const p=a.bi[t]+u%3,d=a.bj[t]+(u/3|0);if(p<0||d<0||p>=l||d>=h)continue;const g=p+d*l;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:c,heat:a,gas:l}=this.e,h=r.T[t],f=r.smass[2*t],u=f*Yn(h);this.e.salt.deposit(r.x[t],r.y[t],f,u);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==G;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[Y*i.n+p]+=e,i.Hg[p]+=e*xt(h),this.produced+=e,l.deriveCell(p)),a.src[m]-=(e*xt(h)+u-s)/n;else if(m>=0){for(let d=0;d<r.count;d+=1)if(d!==t&&r.mat[d]===r.mat[t]&&i.cellAt(r.x[d],r.y[d])===m){const g=r.mass[d]*r.h[d]+(s-u);r.mass[d]+=e,r.h[d]=g/r.mass[d],r.derive(d);break}}c.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:c,gas:a}=this.e,l=n.cellAt(i.x[t],i.y[t]);let h=l;for(;h>=0&&n.kind[h]!==G;)h=h+n.nx<n.n?h+n.nx:-1;if(e>0&&h>=0&&l>=0){const f=i.T[t];n.mg[Y*n.n+h]+=e,n.Hg[h]+=e*xt(f),c.src[l]-=e*(xt(f)-i.h[t])/s,this.produced+=e,a.deriveCell(h)}else if(e>0&&l>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===l){const u=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=u/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),ph(this.e,this,t),xh(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:c}=e,{nx:a,ny:l,n:h,depth:f,kind:u}=s,{mtot:m,rd:p,Y0:d,Tl:g,Fm:y,Fe:w,edge:x,hvC:F,hnC:_,hoC:T}=this;let A=!1;for(let L=0;L<h;L+=1){if(u[L]!==G){m[L]=0;continue}const B=s.mg[L]+s.mg[h+L]+s.mg[Y*h+L];m[L]=B,d[L]=B>0?s.mg[Y*h+L]/B:0;const I=s.T[L];p[L]=n.rho[L]*ff(I,i.pAt(L)),F[L]=xt(I),_[L]=re(at,I),T[L]=re(ct,I),A=!0}if(!A)return;for(let L=0;L<l;L+=1)for(let B=0;B<a;B+=1){const I=B+L*a;x[I]=u[I]===G&&(B===0||L===0||B===a-1||L===l-1||u[I-1]!==G||u[I+1]!==G||u[I-a]!==G||u[I+a]!==G)?1:0}const b=c.begin(a,l),k=b.stride,S=e.ambientY[Y],{bG:M,bY:P}=this;for(let L=0;L<l;L+=1)for(let B=0;B<a;B+=1){const I=B+L*a;if(u[I]!==G||m[I]<=0)continue;const j=B+1+(L+1)*k;b.act[j]=1,b.x[j]=d[I],b.dH[j]=m[I]/t;let E=m[I]*d[I]/t;const R=s.au[B+1+L*(a+1)],W=s.av[I+a];if(B+1<a&&u[I+1]===G&&m[I+1]>0&&R>0&&(b.ax[j]=R*.5*(p[I]+p[I+1])*f),L+1<l&&u[I+a]===G&&m[I+a]>0&&W>0&&(b.ay[j]=W*.5*(p[I]+p[I+a])*f),x[I]===0){b.b[j]=E;continue}let V=0;for(let Z=0;Z<4;Z+=1){const it=this.boundary(I,B,L,Z,S);M[4*I+Z]=it,P[4*I+Z]=this.yb,!(it<=0)&&(V+=it,E+=it*this.yb)}b.dDx[j]=V,b.b[j]=E}c.solve(1e-9,200,!1),y.fill(0),w.fill(0);const C=b.x;for(let L=0;L<l;L+=1)for(let B=0;B<a;B+=1){const I=B+L*a;if(u[I]!==G||m[I]<=0)continue;const j=B+1+(L+1)*k,E=C[j],R=s.au[B+1+L*(a+1)],W=s.av[I+a];if(B+1<a&&u[I+1]===G&&m[I+1]>0&&R>0&&this.exchange(I,I+1,t*R*.5*(p[I]+p[I+1])*f*(E-C[j+1])),L+1<l&&u[I+a]===G&&m[I+a]>0&&W>0&&this.exchange(I,I+a,t*W*.5*(p[I]+p[I+a])*f*(E-C[j+k])),x[I]!==0)for(let V=0;V<4;V+=1){const Z=M[4*I+V];if(Z<=0)continue;const it=t*Z*(P[4*I+V]-E),q=(V===0?B===0:V===1?B===a-1:V===2?L===0:L===l-1)?-1:V===0?I-1:V===1?I+1:V===2?I-a:I+a;if(q<0)this.ambientExchange(I,it);else if(u[q]===st)if(it>0){const N=Math.min(it,Math.max(0,this.acc[q]+y[q]));if(!(N>0))continue;const U=g[q];s.mg[Y*h+I]+=N,s.Hg[I]+=N*xt(U),y[q]-=N,w[q]-=N*xt(U),this.produced+=N}else{const N=Math.min(-it,s.mg[Y*h+I]);s.mg[Y*h+I]-=N,s.Hg[I]-=N*xt(s.T[I]),y[q]+=N,w[q]+=N*xt(s.T[I]),this.condensed+=N}else if(u[q]===ht){const N=s.T[q];if(it<0){const U=Math.min(-it,s.mg[Y*h+I]);s.mg[Y*h+I]-=U,s.Hg[I]-=U*xt(s.T[I]),s.film[q]+=U,s.Es[q]+=U*_t(N),r.src[q]+=U*(xt(s.T[I])-_t(N))/t,this.dew+=U}else{const U=Math.min(it,s.film[q]);s.film[q]-=U,s.Es[q]-=U*_t(N),s.mg[Y*h+I]+=U,s.Hg[I]+=U*xt(N),r.src[q]-=U*(xt(N)-_t(N))/t,this.dew-=U}}}}for(let L=0;L<h;L+=1)y[L]!==0&&(r.src[L]+=(w[L]-y[L]*this.waterH(L))/t);this.applyMass(y,t);for(let L=0;L<h;L+=1)u[L]===G&&m[L]>0&&n.deriveCell(L)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:c,ny:a,depth:l,kind:h}=r,f=n===0?e===0:n===1?e===c-1:n===2?s===0:s===a-1,u=2*this.rd[t]*l;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,u):0;const m=n===0?t-1:n===1?t+1:n===2?t-c:t+c;this.side[n]=m;const p=h[m],d=this.Y0[t],g=this.e.regions.pAt(t);if(p===st){const y=r.faceOpen(t,n);if(!(y>0))return 0;const w=this.waterShare(m);return w<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),y*u*(1-d)*w)}if(p===ht){const y=this.ysat(r.T[m],g,t);return d>y||r.film[m]>0&&d<y?(this.yb=y,u*(1-d)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,c=s>0?e:t;let a=Math.abs(s);a=Math.min(a,n.mg[Y*i+r]);const l=n.mg[at*i+c],h=n.mg[ct*i+c],f=l+h,u=Math.min(a,f);if(a<=0)return;const m=this.hvC[r];if(n.mg[Y*i+r]-=a,n.mg[Y*i+c]+=a,n.Hg[r]-=a*m,n.Hg[c]+=a*m,u>0){const p=u*l/f,d=u-p;n.mg[at*i+c]-=p,n.mg[ct*i+c]-=d,n.mg[at*i+r]+=p,n.mg[ct*i+r]+=d;const g=p*this.hnC[c]+d*this.hoC[c];n.Hg[c]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const c=n.mg[at*i+t]+n.mg[ct*i+t],a=Math.min(e,c);if(n.mg[Y*i+t]+=e,n.Hg[t]+=e*xt(r),a>0){const l=a*n.mg[at*i+t]/c,h=a-l;n.mg[at*i+t]-=l,n.mg[ct*i+t]-=h;const f=l*re(at,n.T[t])+h*re(ct,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=a,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*xt(r)}else if(e<0){const c=Math.min(-e,n.mg[Y*i+t]),a=s.ambientY[at],l=s.ambientY[ct],h=a+l>0?a+l:1;n.mg[Y*i+t]-=c,n.Hg[t]-=c*xt(n.T[t]);const f=c*a/h,u=c-f;n.mg[at*i+t]+=f,n.mg[ct*i+t]+=u;const m=f*re(at,r)+u*re(ct,r);n.Hg[t]+=m,s.flows.escapedWater+=c,s.flows.escapedAir-=c,s.flows.escapedEnergy+=c*xt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:c}=t,a=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<a)continue;const h=l%n,f=(l-h)/n,m=[h>0?l-1:-1,h<n-1?l+1:-1,f+1<i?l+n:-1,f>0?l-n:-1].find(F=>F>=0&&c[F]===G);if(m===void 0)continue;const p=m%n,d=(m-p)/n,g=(p+.5+.25*Math.sign(h-p))*t.dx,y=(d+.5+.25*Math.sign(f-d))*t.dx,w=t.T[l],x=e.add(g,y,a,_t(w),ft);x<0||(t.film[l]-=a,t.Es[l]-=a*_t(w),s.placeParticle(x),s.dVp[x]=a/e.rho[x])}}}function Tl(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(te.length);let r=0,c=0,a=0;for(let l=0;l<e.count;l+=1)for(let h=0;h<9;h+=1){const f=s.wt[9*l+h];if(f===0)continue;const u=s.bi[l]+h%3,m=s.bj[l]+(h/3|0);if(u<0||m<0||u>=n.nx||m>=n.ny||u+m*n.nx!==t)continue;i[e.mat[l]]+=f*e.mass[l],r+=f*e.mass[l];const p=e.smass[2*l];p>0?(c+=f*p,a+=f*(e.mass[l]-p)):e.mat[l]===0&&(a+=f*e.mass[l])}return{m:i,all:r,salt:c,water:a}}function yh(o,t){const{m:e,all:s}=Tl(o,t);if(s<=0)return[];const n=[];for(let i=0;i<te.length;i+=1)e[i]>0&&n.push({id:te[i].id,share:e[i]/s});return n}function wh(o,t,e){var S;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ht?"solid":s.kind[n]===st?"liquid":"gas",c=o.pressureAt(n);let a=0;const l=[0,0,0];for(let M=0;M<Ft;M+=1)l[M]=s.mg[M*i+n]/gt[M],a+=l[M];for(let M=0;M<Ft;M+=1)l[M]=a>0?l[M]/a:0;const h=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?l[Y]*c:0,u=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[u+m*(s.nx+1)]+s.ul[u+1+m*(s.nx+1)]):.5*(s.ug[u+m*(s.nx+1)]+s.ug[u+1+m*(s.nx+1)]),d=r==="liquid"?.5*(s.vl[u+m*s.nx]+s.vl[u+(m+1)*s.nx]):.5*(s.vg[u+m*s.nx]+s.vg[u+(m+1)*s.nx]),g=o.particles;let y=-1,w=(1.5*s.dx)**2;for(let M=0;M<g.count;M+=1){const P=(g.x[M]-t)**2+(g.y[M]-e)**2;P<w&&(w=P,y=M)}const x=o.bubbles;let F=-1,_=1/0;for(let M=0;M<x.count;M+=1){const P=Math.hypot(x.x[M]-t,x.y[M]-e);P<=Math.max(x.r[M],3*s.dx)&&P<_&&(F=M,_=P)}const T=Tl(o,n),A=[];if(T.all>0)for(let M=0;M<te.length;M+=1)T.m[M]>0&&A.push({id:te[M].id,share:T.m[M]/T.all});let b=null;if(r==="liquid"&&T.salt>0&&T.water>0){const M=T.salt/(T.water*Ue);b={w:T.salt/(T.salt+T.water),molality:M,Tb:ko(c,M),Tf:Zc(M)}}const k=r==="gas"?o.gas.rho[n]:r==="liquid"?b!==null&&!o.phase.mixed?or(h,b.w):o.phase.mixed?_s(o.phase.host[n],h):o.liquid.rhoRef:s.solid[n]!==0?pt[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?pt[s.solid[n]-1].id:null,T:h,p:c,Tsat:kt(c),x:l,rh:r==="gas"?f/sr(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:k,phi:s.phi[n],u:p,v:d,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:A,salt:b},particle:y<0?null:{id:g.id[y],T:g.T[y],vx:g.vx[y],vy:g.vy[y],mass:g.mass[y],rho:g.rho[y],dist:Math.sqrt(w),liquid:((S=te[g.mat[y]])==null?void 0:S.id)??te[0].id,salt:g.saltFraction(y)},bubble:F<0?null:o.bubbleModel.describe(F),body:bh(o,t,e)}}function bh(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=o.scene.ops[s.key];return{index:s.index,id:n!==void 0&&rn(n)?n.id:"",material:pt[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}const Fh=2e-6;class _h{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);v(this,"freeAt",null);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,c=e+1;this.id.fill(-1);let a=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(a);let h=0,f=0,u=0,m=!1;for(this.stack[h++]=l,this.id[l]=a;h>0;){const p=this.stack[--h];u+=1-t.fs[p],!m&&t.owner[p]>0&&this.freeAt!==null&&this.freeAt(t.owner[p])&&(m=!0);const d=p%e,g=(p-d)/e,y=d+g*c,w=d+g*e;(d===0&&t.openL&&i[y]>0||d===e-1&&t.openR&&i[y+1]>0||g===0&&t.openB&&r[w]>0||g===s-1&&t.openT&&r[w+e]>0)&&(f=1),d>0&&n[p-1]===0&&this.id[p-1]===-1&&i[y]>0&&(this.id[p-1]=a,this.stack[h++]=p-1),d<e-1&&n[p+1]===0&&this.id[p+1]===-1&&i[y+1]>0&&(this.id[p+1]=a,this.stack[h++]=p+1),g>0&&n[p-e]===0&&this.id[p-e]===-1&&r[w]>0&&(this.id[p-e]=a,this.stack[h++]=p-e),g<s-1&&n[p+e]===0&&this.id[p+e]===-1&&r[w+e]>0&&(this.id[p+e]=a,this.stack[h++]=p+e)}f===0&&m&&u*t.vCell<Fh&&(f=1),this.open[a]=f,this.vFluid[a]=u*t.vCell,a+=1}this.count=a}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let c=0;c<Ft;c+=1){const a=s.mg[c*n+i];this.mSum[r]+=a,this.nSum[r]+=a/gt[c]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let a=0;a<s;a+=1){if(this.id[a]!==t||e.kind[a]===ht)continue;let l=0;for(let h=0;h<Ft;h+=1)l+=e.mg[h*s+a]/gt[h];n+=l*Rt*e.T[a]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const c=this.rhoBar[t]*this.gy;if(c===0)return r;for(let a=0;a<2;a+=1){let l=-i,h=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===ht)continue;let u=0;for(let d=0;d<Ft;d+=1)u+=e.mg[d*s+f]/gt[d];const m=r-c*(e.dx*((f-f%e.nx)/e.nx+.5)),p=u*Rt*e.T[f];l+=p/m,h-=p/(m*m)}r-=l/h}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===G)return s;return-1}}class Ah{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:c,ny:a}=r,l=Math.min(c-1,Math.max(0,Math.floor(t/r.dx))),h=Math.min(a-1,Math.max(0,Math.floor(e/r.dx))),f=l+h*c,u=i.heat;if(u.hasSolid(f)){this.toSolid(f,s,n);return}const m=[h>0?f-c:-1,l>0?f-1:-1,l<c-1?f+1:-1,h<a-1?f+c:-1];for(const p of m)if(p>=0&&u.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=h-2;p>=0;p-=1){const d=l+p*c;if(u.hasSolid(d)){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],c=Jc(r);if(n<=c*i*(1+1e-9))continue;const a=(n-c*i)/(1-c),l=a*Yn(r),h=i/t.rho[s],f=i*t.h[s]-l;t.mass[s]=i-a,t.smass[2*s]=n-a,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-h,this.e.grainSalt.grow(t.x[s],t.y[s],a,l)||this.deposit(t.x[s],t.y[s],a,l),this.crystallized+=a}}}const kh=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],gs=kh.length,Na=1/120;class Th{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"grains");v(this,"grainFlow");v(this,"grainSalt");v(this,"exchange");v(this,"bodies");v(this,"melt");v(this,"solver");v(this,"extremes",new yu(this));v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",Na);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(lt));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",_a());v(this,"snap",Au());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(gs));v(this,"stamp",new Float64Array(gs+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);v(this,"building",!1);this.options=e;const s=Va(t)?t:Ti(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Na}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=Hf[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>Wf;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new eh(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new mh(Math.max(4096,4*i.n+1024)),this.bubbles=new au(4096),this.solver=new Lt(s,n),this.regions=new _h(i),this.liquid=new dh(i,this.particles,this.solver),this.gas=new Gu(i,this.regions,this.solver),this.heat=new nh(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new xu(this),this.phase=new vh(this),this.salt=new Ah(this),this.grains=new Uf(Math.max(1024,4*i.n)),this.grainFlow=new Yu(this),this.grainSalt=new th(this),this.exchange=new Ru(this),this.bodies=new H0(this),this.regions.freeAt=r=>{const c=this.bodies.list[r-1];return c!==void 0&&c.free},this.heat.bodies=this.bodies.list,this.heat.grains=this.grains,this.melt=new ou(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,c,a,l,h)=>this.bodies.hitPoint(r,c,a,l,h),this.liquid.afterSolve=(r,c,a,l)=>this.bodies.probe(r,c,a,l),this.prevKind=new Uint8Array(i.n),this.rng=new vl(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=_a(),this.heaterOps.clear(),this.extremes.reset(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=G,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),this.grainFlow.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const c=i+r>0?i+r:1,a=(i>0?i:uf)/c,l=(r>0||i>0?r:hf)/c,h=1/(a/gt[at]+l/gt[ct]),f=Math.min(.99,s*sr(e)/t),u=f*gt[Y]/(f*gt[Y]+(1-f)*h);this.ambientY.fill(0),this.ambientY[at]=(1-u)*a,this.ambientY[ct]=(1-u)*l,this.ambientY[Y]=u;let m=0;for(let p=0;p<Ft;p+=1)m+=this.ambientY[p]/gt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(Rt*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,grains:this.grains,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,objectKey:t=>Hi(this,t),solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){const e=rn(t)&&(t.id===""||Hi(this,t.id)>=0)?{...t,id:il(this.scene.ops,t.op)}:t;if(e.op==="fill"&&e.phase==="liquid"&&!Du(this,e))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const s=this.regions.pvTerm(),n=Pu(this.world(),e);return this.bodies.sync(),e.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,e]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-s,this.building||this.bodies.wakeFree(),n!==null&&this.warnings.push(n),n}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const c=this.heaterOps.get(t),a=c===void 0?void 0:this.scene.ops[c];if(c!==void 0&&a!==void 0&&a.op==="hotplate"){const l=[...this.scene.ops];l[c]={...a,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),c=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:c}},this.setAmbientState(t,e,s,r,c.N2,c.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return rl({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=Va(t)?t:Ti(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setExtremes(t){this.scene={...this.scene,extremes:t},this.extremes.pending=null}setQuality(t){const e=Ti(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:c}=this,a=this.dt,l=this.stamp;l[0]=_e();const h=n.pvTerm();this.bodies.prepare()&&(n.update(r,c),this.flows.bodyWork+=n.pvTerm()-h),l[1]=_e(),this.grainFlow.splatVolume(),e.splatVolumeChange(a),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,c),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===G?n.pAt(d)-this.pRef:0;e.step(a,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,this.grainFlow.step(a),l[2]=_e(),s.updateVolumes(),s.markFaces();const f=s.escaped[Y]+s.escaped[Ft],u=s.escaped[at]+s.escaped[ct],m=s.escaped[Ft+1];s.transport(a),this.flows.escapedWater+=s.escaped[Y]+s.escaped[Ft]-f,this.flows.escapedAir+=s.escaped[at]+s.escaped[ct]-u,this.flows.escapedEnergy+=s.escaped[Ft+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(a,this.gy),s.sources(a),s.project(a,this.tol,this.maxIter),l[3]=_e(),this.bubbleModel.step(a),l[4]=_e(),this.phase.step(a),this.salt.step(),this.grainSalt.step(a),l[5]=_e(),i.step(a,1e-6,200),this.exchange.step(a),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=_e(),l[7]=_e(),n.update(r,c),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===G?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.extremes.afterStep(),this.time+=a,this.steps+=1,l[8]=_e(),this.bodies.finish(a),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit(),this.grainFlow.dtLimit()),l[9]=_e();const p=this.steps<5?1:1/30;for(let d=0;d<gs;d+=1)this.timings[d]+=p*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=p*(l[gs]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let c=!1;for(let a=0;a<e.count;a+=1)i.dp0[a]!==0&&(c=!0);if(c){for(let a=0;a<s.count;a+=1){const l=t.cellAt(s.x[a],s.y[a]),h=l<0?-1:e.id[l];if(h<0||i.dp0[h]===0)continue;const f=s.mass[a],u=f/s.rho[a];s.h[a]+=u*i.dp0[h]/f,s.derive(a),r.dVp[a]+=f/s.rho[a]-u}for(let a=0;a<n.count;a+=1){const l=t.cellAt(n.x[a],n.y[a]),h=l<0?-1:e.id[l];h>=0&&i.dp0[h]!==0&&(n.H[a]+=n.V[a]*i.dp0[h])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,_u(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals(),this.grains.totals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.bodies.anyFree||this.melt.any()||this.grains.count>0}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}rebaseline(t){const e=this.measureBudget(),s=this.flows;this.energy0=e.energy-(s.heater-s.lossWalls-s.lossOpen-s.escapedEnergy+s.editEnergy+s.bodyWork)-t.energy,this.water0=e.water.total-s.editWater-t.water,this.other0=e.other.total-s.editOther-t.other,this.salt0=e.salt.total-s.editSalt-t.salt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===ft&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==ft&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===st?this.pRef+e.pl[t]:e.kind[t]===G?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return wh(this,t,e)}liquidsAt(t){return yh(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===st?e+=1:t.kind[d]===G&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),c=this.flows,a=r.energy-this.energy0-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),l=r.water.total-this.water0-c.editWater,h=r.other.total-this.other0-c.editOther,f=r.salt.total-this.salt0-c.editSalt,u=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(u-this.phase.producedMark)/m,this.phase.producedMark=u,this.vapourLast=this.time);const p=[];for(let d=0;d<this.regions.count;d+=1)p.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor+r.salt.grains,bodies:{count:this.bodies.list.filter(d=>!d.gone).length,free:this.bodies.list.filter(d=>d.free).length,awake:this.bodies.list.filter(d=>d.awake).length},heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...c},energyError:a,waterError:l,otherError:h,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy,extremes:this.extremes.stats(),cpuOnly:this.needsCpu()}}}const _e=()=>typeof performance<"u"?performance.now():Date.now();function Va(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class Sl{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=Fo(n),r=t.budget(),c={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},a=this.last;let l=0,h=0;if(a!==null&&c.t>a.t){const m=c.t-a.t,p=(c.heater-a.heater)/m,d=(c.solids-a.solids+c.SG-a.SG+c.lossS-a.lossS+c.LG-a.LG+c.sens-a.sens+c.bub-a.bub)/m;l=(c.vap-a.vap)/m,h=Math.max(0,(p-d)/i)}this.last=c;const f=this.vapour()*i,u=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=u),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:u-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:h}}copyTo(t){const e=t;e.last=this.last===null?null:{...this.last},e.latent0=this.latent0,e.stored0=this.stored0,e.started=this.started}copyFrom(t){const e=t;this.last=e.last===null?null:{...e.last},this.latent0=e.latent0,this.stored0=e.stored0,this.started=e.started}}const $s={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Xs=16,H={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72,REL_MASS:73,REL_N:74,REL_MISS:75,EVAP_CAP:76},xs=96,Ua=16,Sh=57,Xt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},Ae=16,Mh={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},ro=8,Ht={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},ve=8,Ph={TSUM:0,CELLS:1},oo=2,Lh={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Ml=16,nt={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69},kr=70,us={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},Tr=6,ao={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16},Sr=17,Ie={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},Mr=20,Ch={KNOWN:0,MARK:1,MARK2:2,GAS:3},Ga=4,Oh={F:0},Pr=1,qh={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},co=12,Zt=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),jh=[Zt("G_",$s),Zt("C_",H),Zt("R_",Xt),Zt("RA_",Mh),Zt("H_",Ht),Zt("HA_",Ph),Zt("S_",Lh),Zt("F_",nt),Zt("U_",us),Zt("A_",ao),Zt("FF_",Ie),Zt("FU_",Ch),Zt("AF_",Oh),Zt("BA_",qh),`const RACC_STRIDE: u32 = ${ro}u;`,`const HEAT_STRIDE: u32 = ${ve}u;`,`const HACC_STRIDE: u32 = ${oo}u;`,`const CGS_STRIDE: u32 = ${Ml}u;`,`const BACC_STRIDE: u32 = ${co}u;`].join(`
`);function X(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Ut=o=>o.map(X).join(", "),Et=Mt.species[0],xi=Mt.species[1],vi=Mt.species[2],vs=Et.liquid.cp.table,Re=vs.map(o=>o[0]),bs=vs.map(o=>o[1]),$i=[bs[0]*(Re[0]-et)];for(let o=1;o<vs.length;o+=1)$i.push($i[o-1]+.5*(bs[o]+bs[o-1])*(Re[o]-Re[o-1]));const[Ih,Bh,Eh]=Et.vapour.cp.linear,lo=et+100,Rh=(()=>{let o=0;for(;o<Re.length-2&&lo>=Re[o+1];)o+=1;const t=lo-Re[o],e=(bs[o+1]-bs[o])/(Re[o+1]-Re[o]);return $i[o]+bs[o]*t+.5*e*t*t})(),Dh=Rh+Et.saturation.hlv100.v,Le=Mt.solids,Pl=Mt.species.slice(3).map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{cA:e,cB:s,h0:e*et+.5*s*et*et,rA:t.rho.linear[0],rB:t.rho.linear[1],kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v}}),Ll=1+Pl.length,de=o=>`array<f32, ${Ll}>(${Ut([0,...Pl.map(o)])})`,Lr=4294967295,Nh=`
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
}`,Ha=48,Vh=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,js=27,Uh=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Is=29,Gh=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Cr=8,Hh=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,$h=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${X(et)};
const R_GAS: f32 = ${X(Rt)};
const P_ATM: f32 = ${X(Sn)};
const G0: f32 = ${X(er)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${X(xi.molarMass.v)};
const M_O2: f32 = ${X(vi.molarMass.v)};
const M_H2O: f32 = ${X(Et.molarMass.v)};
const CP_N2: f32 = ${X(xi.gas.cp.v)};
const CP_O2: f32 = ${X(vi.gas.cp.v)};
const CPV0: f32 = ${X(Ih)};
const CPV1: f32 = ${X(Bh)};
const CPV_T: f32 = ${X(Eh)};
const T100: f32 = ${X(lo)};
const HV100: f32 = ${X(Dh)};
const NCP: i32 = ${vs.length};
const CP_T = array<f32, ${vs.length}>(${Ut(Re)});
const CP_V = array<f32, ${vs.length}>(${Ut(bs)});
const CP_H = array<f32, ${vs.length}>(${Ut($i)});
const KELL = array<f32, 7>(${Ut(Et.liquid.kell.c)});
const KL = array<f32, 3>(${Ut(Et.liquid.k.poly)});
const VA: f32 = ${X(Et.liquid.mu.vogel[0])};
const VB: f32 = ${X(Et.liquid.mu.vogel[1])};
const VC: f32 = ${X(Et.liquid.mu.vogel[2])};
const ST_B: f32 = ${X(Et.surfaceTension.B)};
const ST_b: f32 = ${X(Et.surfaceTension.b)};
const ST_MU: f32 = ${X(Et.surfaceTension.mu)};
const T_CRIT: f32 = ${X(Et.saturation.Tc.v)};
const RHO_CRIT: f32 = ${X(Et.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Ut(Et.saturation.if97.n)});
const RVC = array<f32, 6>(${Ut(Et.saturation.vapourDensity.c)});
const KV: f32 = ${X(Et.vapour.k.v)};
const MUV: f32 = ${X(Et.vapour.mu.v)};
const KN = array<f32, 3>(${Ut(xi.gas.k.power)});
const KO = array<f32, 3>(${Ut(vi.gas.k.power)});
const MN = array<f32, 3>(${Ut(xi.gas.mu.sutherland)});
const MO = array<f32, 3>(${Ut(vi.gas.mu.sutherland)});
const DV0: f32 = ${X(Mt.vapourInAir.D0.v)};
const DVT0: f32 = ${X(Mt.vapourInAir.T0.v)};
const DVE: f32 = ${X(Mt.vapourInAir.exponent.v)};
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
const ALPHA_RATE: f32 = ${X(xl)};
const REG_STRIDE: u32 = ${Ae}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${X(qc)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${X(ss)};
const NLIQ: u32 = ${Ll}u;
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
`,Wh=`
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
`,Kh=`
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
`,Do=[Nh,Vh,Uh,Gh,Hh,$h,jh,Wh,Kh].join(`
`),ye=Mt.solutes[0],kn=298.15,Ce=o=>o.map(X).join(", "),ei=14,Je=ye.cp.range.lo,ts=ye.cp.range.hi,[Cl,zh,Qh,Xh,Yh,Zh]=ye.cp.laliberte,Jh=o=>Math.exp(zh*(o-et)+Qh*Math.exp(.01*(o-et))),Wi=.5*(ts-Je),ks=new Array(ei).fill(0);{for(let t=0;t<64;t+=1){const e=Math.PI*(t+.5)/64,s=Jh(.5*(ts+Je)+Wi*Math.cos(e));for(let n=0;n<ei;n+=1)ks[n]+=2/64*s*Math.cos(n*e)}ks[0]/=2}const fo=o=>o<ei?ks[o]:0,on=new Array(ei+1).fill(0);on[1]=ks[0]-fo(2)/2;for(let o=2;o<=ei;o+=1)on[o]=(fo(o-1)-fo(o+1))/(2*o);const Nn=(o,t)=>{let e=0,s=0;for(let n=o.length-1;n>=1;n-=1){const i=2*t*e-s+o[n];s=e,e=i}return t*e-s+o[0]},Ki=Nn(ks,-1),Ol=Nn(ks,1),uo=Nn(on,-1),ql=o=>{if(o<=Je)return Ki*(o-et);const t=Ki*(Je-et);return o>=ts?t+Wi*(Nn(on,1)-uo)+Ol*(o-ts):t+Wi*(Nn(on,(2*o-Je-ts)/(ts-Je))-uo)},td=Ki*(Je-et),ed=ql(ts),sd=ye.dHsol.v/Ue+ss*(kn-et)-1e3*Cl*ql(kn);function $a(o,t){const e=[`fn ${o}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let s=t.length-1;s>=1;s-=1)e.push(`  t = 2.0 * x * b1 - b2 + ${X(t[s])}; b2 = b1; b1 = t;`);return e.push(`  return x * b1 - b2 + ${X(t[0])};`,"}"),e.join(`
`)}const yn=ye.pitzer,yi=ye.pitzerCold,nd=Math.sqrt(2*Math.PI*Ac),id=qi*qi/(4*Math.PI*kc*_c),Bs=ye.solubility.table,wn=ye.density.laliberte,rd=`
const S_TR: f32 = ${X(kn)};
const S_MS: f32 = ${X(Ue)};
const S_MW: f32 = ${X(nr)};
const S_NU: f32 = ${X(ye.ions.v)};
const PZ_B: f32 = ${X(yn.b.v)};
const PZ_ALPHA: f32 = ${X(yn.alpha.v)};
const PZ_COLD: f32 = ${X(yi.below.v)};
const PZ_B0 = array<f32, 6>(${Ce(yn.b0.a)});
const PZ_B1 = array<f32, 6>(${Ce(yn.b1.a)});
const PZ_C = array<f32, 6>(${Ce(yn.c.a)});
const PZC_B0 = array<f32, 6>(${Ce(yi.b0.a)});
const PZC_B1 = array<f32, 6>(${Ce(yi.b1.a)});
const PZC_C = array<f32, 6>(${Ce(yi.c.a)});
const S_EPS = array<f32, 4>(${Ce(ye.dielectric.c)});
const S_KN: f32 = ${X(nd)};
const S_KLB: f32 = ${X(id)};
const SOL_T = array<f32, ${Bs.length}>(${Ce(Bs.map(o=>o[0]))});
const SOL_M = array<f32, ${Bs.length}>(${Ce(Bs.map(o=>o[1]))});
const LD0: f32 = ${X(wn[0])};
const LD1: f32 = ${X(wn[1])};
const LD2: f32 = ${X(wn[2])};
const LD3: f32 = ${X(wn[3])};
const LD4: f32 = ${X(wn[4])};
const LA1: f32 = ${X(Cl)};
const LA4: f32 = ${X(Xh)};
const LA5: f32 = ${X(Yh)};
const LA6: f32 = ${X(Zh)};
const E_LO: f32 = ${X(Je)};
const E_HI: f32 = ${X(ts)};
const E_LOV: f32 = ${X(Ki)};
const E_HIV: f32 = ${X(Ol)};
const E_HALF: f32 = ${X(Wi)};
const E_FM1: f32 = ${X(uo)};
const E_ILO: f32 = ${X(td)};
const E_IHI: f32 = ${X(ed)};
const S_QS: f32 = ${X(sd)};
const S_DMU: f32 = ${X(ye.diffusivity.v*Fs(kn)/kn)};

${$a("eCh",ks)}
${$a("iCh",on)}
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
  for (var k = 1; k < ${Bs.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${Bs.length-1}];
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
`,jl=[],Ys=new Map;{let o=[];const t=rd.split(`
`);for(let e=0;e<t.length;e+=1){const s=t[e];if(s.startsWith("const ")){jl.push(s),o=[];continue}if(s.startsWith("/*")){o=[s];continue}const n=/^fn (\w+)\(/.exec(s);if(n===null){s.trim()===""&&(o=[]);continue}const i=[...o,s];if(!s.trimEnd().endsWith("}"))for(;e+1<t.length&&t[e]!=="}";)e+=1,i.push(t[e]);Ys.set(n[1],i.join(`
`)),o=[]}}const Il=o=>new RegExp(`\\b${o}\\s*\\(`),od=new Map([...Ys.entries()].map(([o,t])=>[o,[...Ys.keys()].filter(e=>e!==o&&Il(e).test(t))]));function ad(o){const t=new Set,e=s=>{if(!t.has(s)){t.add(s);for(const n of od.get(s)??[])e(n)}};for(const s of Ys.keys())Il(s).test(o)&&e(s);return t.size===0?"":[...jl,...[...Ys.keys()].filter(s=>t.has(s)).map(s=>Ys.get(s))].join(`
`)}class cd{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=fd(t.bind),this.source=dd(t,this.binds,this.wg)}}const ld={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function fd(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":ld[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const ud=`
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
`,hd=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function dd(o,t,e){const s=[Do,`const WG: u32 = ${e}u;`,ud],n=ad(o.code);n!==""&&s.push(n);const i=new Set(t.map(r=>r.name));for(const r of t)r.mode==="a"&&i.add(`${r.name}!`);for(const r of hd)r.needs.every(c=>i.has(c))&&s.push(r.code);return t.forEach((r,c)=>{r.mode==="u"?s.push(`@group(0) @binding(${c}) var<uniform> ${r.name}: ${r.type};`):r.mode==="t"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_storage_2d<rgba8unorm, write>;`):r.mode==="x"?s.push(`@group(0) @binding(${c}) var ${r.name}: texture_2d<f32>;`):r.mode==="s"?s.push(`@group(0) @binding(${c}) var ${r.name}: sampler;`):r.mode==="r"?s.push(`@group(0) @binding(${c}) var<storage, read> ${r.name}: array<${r.type}>;`):r.mode==="w"?s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<${r.type}>;`):(s.push(`@group(0) @binding(${c}) var<storage, read_write> ${r.name}: array<atomic<u32>>;`),s.push(`fn addF_${r.name}(i: u32, v: f32) {
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
`)}class No{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"adapter","");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}}),r=new No(i),c=e.info;return c!==void 0&&(r.adapter=[c.vendor,c.architecture,c.description].filter(Boolean).join(" ")),r}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new cd(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),c=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(c.length>0){const l=n.source.split(`
`);for(const h of c)e.push(`${s.name}:${h.lineNum}:${h.linePos} ${h.message}
    ${l[h.lineNum-1]??""}`);return}const a=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,h)=>l.mode==="t"?{binding:h,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:h,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:h,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:h,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=a;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[a]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const Wa=64,Ka="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ws=`
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
`,zi=`
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
`,md=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,pd=`
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
`,gd=[{name:"bubNucleate",wg:Wa,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Ws}
${zi}
${Ka} {
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
}`},{name:"bubAdvance",wg:Wa,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Ws}
${zi}
${md}
${pd}
${Ka} {
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
}`}],os=64,Oe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",xd=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,za=`
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
`,vd=[{name:"bubTarget",wg:os,bind:"P:u cnt:a bubs:r btarget:w",code:`${Oe} {
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
}`},{name:"bubMerge",wg:os,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Oe} {
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
}`},{name:"bubMergeFinal",wg:os,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ws}
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
}`},{name:"bubVent",wg:os,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${Ws}
${zi}
${za}
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
}`},{name:"bubFinish",wg:os,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Ws}
${zi}
${xd}
${za}
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
}`},{name:"bubCopyBack",wg:os,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Oe} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:os,bind:"P:u cnt:a bubs:r at:a",code:`${Ws}
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
}`}],Be=128,me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Qi=`
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
`,Qa=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,Or=`
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
`,yd=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:Be,bind:"P:u cf:w cu:r at:w reg:r",code:`${Qi}
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
}`})),{name:"transitions",wg:Be,bind:"P:u cf:r cu:r at:a cnt:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${me} {
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
  want *= max(1e-3, 1.0 - cf[F_PHI * n + c] - cf[F_ALPHA * n + c]) * P.vcell;
  if (want <= have) { return; }
  for (var k = 0u; k < 4u; k++) {
    let nb = nbOf(c, k);
    if (!stableGas(nb)) { continue; }
    let mnb = mass(nb);
    if (mnb <= 0.0) { continue; }
    moveGas(nb, c, min(0.25, (want - have) * (vol(nb) / wsum) / mnb));
  }
}`},{name:"regCells",wg:Be,bind:"P:u cf:r cu:r racc:a",code:`${Or}
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${Or}
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
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Qa}
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
}`})),{name:"compSums",wg:Be,bind:"P:u cf:r cu:r reg:r racc:a",code:`${Or}
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${Qa}
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
}`})),{name:"compApply",wg:Be,bind:"P:u cf:w cu:r reg:r",code:`${Qi}
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
}`}],qr=128,jr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",wd=`
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
`,bd=[...["viscJacA","viscJacB"].map(o=>{const[t,e]=o==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:o,wg:qr,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${jr} {
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
}`}}),{name:"viscForce",wg:qr,bind:"P:u ff:w fu:r",code:`${jr} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:qr,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${jr} {
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
}`}],Xa=`const THETA_MIN: f32 = ${no.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,wi=128,as=128,se="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ee=`
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
`,Ya=`
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
`,Fd=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Za=1,_d=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${se} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Za}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
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
    pargs[0] = max(1u, (total + ${wi-1}u) / ${wi}u);
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
}`},{name:"splat",wg:as,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ee}
${Fd}
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
}`},{name:"classify",wg:as,bind:"P:u cf:r cu:w",code:`${se} {
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
}`},{name:"p2g",wg:as,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Ya}
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
}`},{name:"liqAssemble",wg:as,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Xa}
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
}`},{name:"liqPressure",wg:as,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${se} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:as,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Xa}
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:as,bind:"P:u ff:w fu:w",code:`${se} {
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
}`})),{name:"g2p",wg:wi,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w",code:`${Ya}
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
${wd}
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
      q.flags = q.flags | ${Za}u;
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
}`},{name:"heatWeights",wg:wi,bind:"P:u cnt:a cu:r parts:w",code:`${ee}
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
}`}],qe=128,je="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ja=`
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
`,tc=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,ec=`
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
`,Ad=[{name:"gasMaxOut",wg:qe,bind:"P:u cu:r ff:r cnt:a",code:`${ee}
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
}`},{name:"gasFlux",wg:qe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Ja}
${tc}
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
}`},{name:"gasMove",wg:qe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Ja}
${tc}
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
}`},{name:"macFwd",wg:qe,bind:"P:u glob:r ff:w fu:r",code:`${ec}
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
}`},{name:"macBack",wg:qe,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${ec}
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
}`}],$e=128,We="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Se=`
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
`,Vo=`
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
`,kd=`
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
`,Td=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:$e,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Se}
${We} {
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
}`})),{name:"applyMass",wg:$e,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Se}
${ee}
${Vo}
${We} {
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
}`},{name:"diffPrep",wg:$e,bind:"P:u cf:w cu:w reg:r",code:`${We} {
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
}`},{name:"diffAssemble",wg:$e,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${kd}
${We} {
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
}`},{name:"diffFaces",wg:$e,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${We} {
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
}`},{name:"diffOut",wg:$e,bind:"P:u glob:r cnt:a cf:w cu:r ff:r cgv:r",code:`/* Was die Gaszelle g über ihre Seite k aus der Flüssigkeit verdunsten lässt (genau das F, das diffApply bucht; sonst 0). */
fn evapFrom(g: u32, k: u32) -> f32 {
  let n = P.n;
  if (cu[U_KIND * n + g] != GAS || cu[U_EDGE * n + g] == 0u || !(cf[F_MTOT * n + g] > 0.0)) { return 0.0; }
  let G = cf[(F_BG + k) * n + g];
  if (!(G > 0.0)) { return 0.0; }
  return max(0.0, glob[G_DT] * G * (cf[(F_BY + k) * n + g] - cgv[s0(g)]));
}
${We} {
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
}`},{name:"diffApply",wg:$e,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ee}
${We} {
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
}`},{name:"latentSrc",wg:$e,bind:"P:u glob:r cf:r at:a",code:`${We} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],sc=[.125,.75,.125];function Sd(o){const t=o.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),c=Uint8Array.from(t.kind),a=new Uint8Array(e),l=new Uint8Array(e),h=new Uint32Array(e),f=new Float64Array(e),u=new Float64Array(e),m=Float32Array.from(t.T),p=o.heat.heaters.map(()=>0),d=new Float64Array(Math.max(1,o.regions.count)),g=o.bodies.list,y=new Uint8Array(e);for(let A=0;A<e;A+=1)t.owner[A]!==0&&t.matB[A]!==0&&(t.solid[A]!==0||t.fs[A]>.5)&&(y[A]=1);const w=(A,b)=>{if(y[A]!==0||y[b]!==0)return;const k=t.owner[A]!==0&&t.matB[A]!==0?t.fs[A]:-1,S=t.owner[b]!==0&&t.matB[b]!==0?t.fs[b]:-1;k<0&&S<0||(y[S>k?b:A]=1)};for(let A=0;A<n;A+=1)for(let b=1;b<s;b+=1)t.au[b+A*(s+1)]<=0&&w(b-1+A*s,b+A*s);for(let A=1;A<n;A+=1)for(let b=0;b<s;b+=1)t.av[b+A*s]<=0&&w(b+(A-1)*s,b+A*s);for(let A=0;A<e;A+=1){if(a[A]=t.solid[A],l[A]=t.kind[A],h[A]=t.role[A]===1&&t.heater[A]>=0?t.heater[A]+1:0,f[A]=t.Es[A],u[A]=t.film[A],y[A]===0)continue;const b=t.owner[A],k=t.solid[A]!==0,S=g[b-1],M=t.matB[A]-1,P=pt[M];if(r[A]=1,!k){const L=o.regions.id[A];L>=0&&(d[L]+=(1-t.fs[A])*t.vCell)}a[A]=M+1,l[A]=ht;const C=t.Ts[A]>0?t.Ts[A]:Co(t.Es[A],t.capB[A],t.film[A],t.crust[A],t.T[A]);f[A]=(P.rho*P.cp*t.vCell+t.crust[A]*ss)*(C-et)+t.film[A]*_t(C),m[A]=C,S!==void 0&&S.heater>=0&&S.heater<p.length&&(h[A]=S.heater+1,p[S.heater]+=1)}for(let A=0;A<e;A+=1)r[A]===0&&h[A]>0&&h[A]<=p.length&&(p[h[A]-1]+=1);const x=(A,b)=>A<0?t.openL?0:1:A>=s?t.openR?0:1:b<0?t.openB?0:1:b>=n?t.openT?0:1:a[A+b*s]!==0?1:0,F=new Float32Array(e),_=new Float32Array(e);for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const k=b+A*s;if(a[k]!==0){F[k]=1;continue}let S=0;for(let M=-1;M<=1;M+=1)for(let P=-1;P<=1;P+=1)S+=sc[P+1]*sc[M+1]*x(b+P,A+M);F[k]=S}const T=4;for(let A=0;A<n;A+=1)for(let b=0;b<s;b+=1){const k=b+A*s,S=a[k]!==0,M=(b+.5)*i,P=(A+.5)*i;let C=T*i;S||(t.openL||(C=Math.min(C,M)),t.openR||(C=Math.min(C,t.w-M)),t.openB||(C=Math.min(C,P)),t.openT||(C=Math.min(C,t.h-P)));for(let L=-T;L<=T;L+=1){const B=A+L;if(!(B<0||B>=n))for(let I=-T;I<=T;I+=1){const j=b+I;if(j<0||j>=s||a[j+B*s]!==0===S)continue;const E=Math.max(0,Math.abs(I)-.5)*i,R=Math.max(0,Math.abs(L)-.5)*i;C=Math.min(C,Math.hypot(E,R))}}_[k]=S?-C:C}return{body:r,kindCpu:c,solid:a,kind:l,hgrp:h,es:f,film:u,T:m,phiS:F,sdf:_,heaterCells:p,vFix:d}}function Md(o,t){if(t===null)return;const e=o.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=pt[t.solid[n]-1],r=Co(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],e.crust[n],e.T[n]);e.Es[n]=Yr(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}o.bodies.cover.collect(o.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&o.heat.deriveSolid(n)}const Gs=800,Pd=24,nc=6,Vt=4,Zs=16,zt=256,ic=`struct Levels { lv: array<Level, ${Zs}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Vn=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Mi=`${Vn}
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
`,Ee=`
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
`,rc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,oc=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Ct="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ke=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,Bl=6,Es=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,Ir=`
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
`,Br="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Ld=[{name:"cgPrep1",wg:zt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Vn}
${Ct} {
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
}`},{name:"cgPrep2",wg:zt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Ke}
${Mi}
${Ct} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${Bl}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
${Ct} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:zt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Ke}
${Ir}
${Es}
${Ct} {
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
}`},{name:"cclProject",wg:zt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ke}
${Br}
${Es}
${Ct} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:zt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Ke}
${Vn}
${cs}
${Ct} {
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
${oc}
${Ct} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Ke}
${Ee}
${cs}
${rc}
${Ct} {
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
}`},{name:"cgB",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Ke}
${Ee}
${cs}
${rc}
var<workgroup> wpq: f32;
${Ct} {
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
}`},{name:"cgFoldRR",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Ee}
${cs}
${oc}
${Ct} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Ee}
${cs}
${Ct} {
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
}`},{name:"cgZSum",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Ee}
${Ir}
${Es}
${Ct} {
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
}`},{name:"cgZSub",wg:zt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Ee}
${Br}
${Es}
${cs}
${Ct} {
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
}`},{name:"cgEnd1",wg:zt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Ke}
${Ir}
${Es}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${Ct} {
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
}`},{name:"cgEnd2",wg:zt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ke}
${Br}
${Es}
${Ct} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Cd=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Od(o,t){const e=[];let s=0,n=0,i=o,r=t,c=1,a=0;for(;;){const h=i+2,f=(i+2)*(r+2),u={};for(const d of Cd)u[d]=s,s+=f;const m=n;n+=f;let p=0;if(u.pW=0,e.length>0&&(u.pW=s,s+=4*a,p=n,n+=4*a),e.push({nx:i,ny:r,stride:h,size:f,h:c,f:u,act:m,pIdx:p}),i*r<=Pd||i<=2&&r<=2||e.length>=Zs)break;a=f,i=Math.ceil(i/2),r=Math.ceil(r/2),c*=2}let l=e.length-1;for(let h=0;h<e.length;h+=1){let f=0;for(let u=h;u<e.length;u+=1)f+=e[u].size;if(f<=Gs){l=h;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function bi(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const El={tol:1e-5,it:H.IT_L,cap:H.CAP_L,res:H.RES_L},Rl={tol:1e-5,it:H.IT_G,cap:H.CAP_G,res:H.RES_G},Dl={tol:1e-5,it:H.IT_H,cap:H.CAP_H,res:H.RES_H},Nl={tol:1e-5,it:H.IT_D,cap:H.CAP_D,res:H.RES_H},Rs=200,pe=256;class qd{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);bi(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(pe/4*n.length);for(let l=0;l<n.length;l+=1)bi(l>0?n[l-1]:null,l-1,r,pe/4*l),bi(n[l],l,r,pe/4*l+32);this.lp=t.uniform("lp",r.buffer);const c=new Uint32Array(32*Zs+4);for(let l=0;l<n.length;l+=1)bi(n[l],l,c,32*l);c[32*Zs]=e.lt,c[32*Zs+1]=n.length,this.lv=t.uniform("lv",c.buffer);const a=new Uint32Array(pe/4*(Rs+1));for(let l=0;l<Rs;l+=1)a[pe/4*l]=l;a[pe/4*Rs]=4294967295,this.it=t.uniform("iter",a.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(pe*4));for(const l of[El,Rl,Dl,Nl])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,pe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,pe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:pe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,pe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],c={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,c),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,c)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const c=(l,h)=>{const f={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,h,f),this.run(t,"cgZSub",r,h,f)):this.run(t,"cgRZ",r,h,f)};this.vcycle(t),c(Rs,`k${Rs}`);const a=Math.min(Rs,Math.max(1,s));for(let l=0;l<a;l+=1){const h={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,h),this.run(t,"cgB",r,`k${l}`,h),this.one(t,"cgFoldRR",`k${l}`,h),this.vcycle(t),c(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Js=16,ac=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;function jd(o){const t=o.grid,e=t.n,s=new Float64Array(e),n=new Float64Array(e),i=new Float64Array(e);for(let r=0;r<e;r+=1){const c=t.mg[at*e+r],a=t.mg[ct*e+r],l=t.mg[Y*e+r];s[r]=c/gt[at]+a/gt[ct]+l/gt[Y],n[r]=c+a+l+t.mfog[r]<=1e-30?18e-6:Cc(c,a,l,t.T[r]),i[r]=t.kind[r]===ht||o.gas.vgas[r]<=0?0:s[r]*Rt*t.T[r]/o.regions.pAt(r)}return{nmol:s,mu:n,veos:i}}class Id{constructor(t,e){v(this,"stair",null);v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=Od(s.nx,s.ny);const r=(a,l,h=ac)=>{const f=t.buffer(a,4*Math.max(4,l),h);return this.own.push(f),f};this.params=r("params",Ha,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Xs),this.cnt=r("cnt",xs),this.cf=r("cf",kr*i.n),this.cu=r("cu",Tr*i.n),this.at=r("at",Sr*i.n),this.ff=r("ff",Mr*i.nf),this.fu=r("fu",Ga*i.nf),this.af=r("af",Pr*i.nf),this.partsA=r("partsA",js*i.pcap),this.partsB=r("partsB",js*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,ac|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Is*i.bcap),this.bubs2=r("bubs2",Is*i.bcap),this.bacc=r("bacc",co*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",Cr*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",Ae*i.nreg),this.racc=r("racc",ro*i.nreg),this.heat=r("heat",ve*i.nheat),this.hacc=r("hacc",oo*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",Ml),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",Bl*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const c=256;this.measGroups=[Math.ceil(i.n/c),Math.ceil(i.pcap/c),Math.ceil(i.bcap/c)],this.meas=r("meas",Js*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}get staircase(){return this.stair}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*Ha),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const c=t.gas.amb;r.set([c[0],c[1],c[2],c[4]],28),r.set([t.ambientY[at],t.ambientY[ct],t.ambientY[Y],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let a=0;for(let h=0;h<t.regions.count;h+=1)t.regions.open[h]===0&&(a=1);i[40]=a,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=t.particles.hasOther()?1:0;const l=vu(t.scene.extremes,t.regions.pAmb,Math.abs(t.gy));r.set([l.chf,l.actMax,l.vmax,l.bubCap],44),this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(ve*this.d.nheat);s.forEach((i,r)=>{var a;const c=ve*r;n[c+Ht.MODE]=i.mode==="thermostat"?1:0,n[c+Ht.POWER]=i.power,n[c+Ht.TARGET]=i.target,n[c+Ht.ON]=i.on?1:0,n[c+Ht.P]=i.P,n[c+Ht.TMEAN]=i.Tmean,n[c+Ht.INTEGRAL]=i.integral,n[c+Ht.CELLS]=e!==null?e[r]??0:((a=this.stair)==null?void 0:a.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*ve*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n,r=Sd(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r.heaterCells);const c=t.regions,a=Array.from({length:c.count},(q,N)=>N).sort((q,N)=>c.vFluid[N]-c.vFluid[q]);this.regionMap=new Int32Array(Math.max(1,c.count)),this.regionInv=new Int32Array(Math.max(1,c.count)),a.forEach((q,N)=>{this.regionMap[q]=N,this.regionInv[N]=q});const l=new Float32Array(Ae*s.nreg);for(let q=0;q<c.count;q+=1){const N=Ae*this.regionMap[q];l[N+Xt.OPEN]=c.open[q],l[N+Xt.VFLUID]=c.vFluid[q]-r.vFix[q],l[N+Xt.P0]=c.p0[q],l[N+Xt.RHOBAR]=c.rhoBar[q],l[N+Xt.VLIQ]=c.vLiq[q],l[N+Xt.VBUB]=c.vBub[q],l[N+Xt.VGAS]=c.vGas[q],l[N+Xt.P0START]=c.p0[q]}e.writeBuffer(this.reg,0,l);const h=new Uint32Array(Tr*i);for(let q=0;q<i;q+=1){h[us.KIND*i+q]=r.kind[q],h[us.KPREV*i+q]=r.kind[q],h[us.SOLID*i+q]=r.solid[q],h[us.HGRP*i+q]=r.hgrp[q];const N=c.id[q];h[us.RID*i+q]=N<0?Lr:this.regionMap[N]}e.writeBuffer(this.cu,0,h);const f=new Float32Array(kr*i),u=(q,N,U=0)=>{for(let J=0;J<i;J+=1)f[q*i+J]=N[U+J]};u(nt.PHI,n.phi),u(nt.ALPHA,n.alpha),u(nt.ALPHAOLD,n.alpha),u(nt.PL,n.pl),u(nt.PG,n.pg),u(nt.MN,n.mg,at*i),u(nt.MO,n.mg,ct*i),u(nt.MV,n.mg,Y*i),u(nt.MF,n.mfog),u(nt.HG,n.Hg),u(nt.ES,r.es),u(nt.FILM,r.film),u(nt.T,r.T),u(nt.TL,n.Tl),u(nt.CL,n.Cl);const m=t.gas,p=jd(t);u(nt.VGAS,m.vgas),u(nt.RHO,m.rho),u(nt.NMOL,p.nmol),u(nt.CAP,m.cap),u(nt.MU,p.mu),u(nt.VEOS,p.veos),u(nt.SRCV,m.srcV),u(nt.VEOSMID,p.veos),u(nt.PHIS,r.phiS),u(nt.SDF,r.sdf),u(nt.PTL,r.T),u(nt.CRUST,n.crust);for(let q=0;q<n.nx;q+=1)f[nt.FLOOR*i+q]=t.salt.floor[q],f[nt.FLOORH*i+q]=t.salt.floorH[q];f.fill(1,nt.AW*i,(nt.AW+1)*i),e.writeBuffer(this.cf,0,f);const d=new Float32Array(Sr*i);for(let q=0;q<i;q+=1)d[ao.VOLSRC*i+q]=t.liquid.volSrc[q];e.writeBuffer(this.at,0,d);const g=s.nf,y=new Float32Array(Mr*g);for(let q=0;q<s.nu;q+=1)y[Ie.UL*g+q]=n.ul[q],y[Ie.UG*g+q]=n.ug[q];for(let q=0;q<s.nv;q+=1)y[Ie.UL*g+s.nu+q]=n.vl[q],y[Ie.UG*g+s.nu+q]=n.vg[q];e.writeBuffer(this.ff,0,y),e.writeBuffer(this.fu,0,new Uint32Array(Ga*g));const w=new Float32Array(Pr*g);for(let q=0;q<s.nu;q+=1)w[q]=t.liquid.fU[q];for(let q=0;q<s.nv;q+=1)w[s.nu+q]=t.liquid.fV[q];e.writeBuffer(this.af,0,w);const x=t.particles,F=t.liquid,_=new ArrayBuffer(4*js*Math.max(1,x.count)),T=new Float32Array(_),A=new Uint32Array(_),b=new Int32Array(_);for(let q=0;q<x.count;q+=1){const N=js*q;T.set([x.x[q],x.y[q],x.vx[q],x.vy[q],x.c00[q],x.c01[q],x.c10[q],x.c11[q],x.mass[q],x.h[q],x.T[q],x.rho[q],F.dVp[q]],N),A[N+13]=(x.mat[q]&255)<<8,A[N+14]=x.id[q],b[N+15]=F.bi[q],b[N+16]=F.bj[q];for(let U=0;U<9;U+=1)T[N+17+U]=F.wt[9*q+U];T[N+26]=x.smass[2*q]}x.count>0&&e.writeBuffer(this.partsA,0,_);const k=t.bubbles,S=t.bubbleModel.motionState,M=new ArrayBuffer(4*Is*Math.max(1,k.count)),P=new Float32Array(M),C=new Uint32Array(M),L=new Int32Array(M);for(let q=0;q<k.count;q+=1){const N=Is*q,U=q*lt;P.set([k.x[q],k.y[q],k.z[q],k.vx[q],k.vy[q],k.m[U+at],k.m[U+ct],k.m[U+Y],k.H[q],k.age[q]],N),L[N+10]=k.site[q],P.set([k.r[q],k.V[q],k.pb[q],k.pv[q],k.Tb[q],k.dmdt[q],S.ux0[q],S.uy0[q]],N+11),C[N+19]=k.id[q],C[N+20]=1;for(let J=0;J<ae;J+=1)P[N+21+J]=k.force[q*ae+J]}k.count>0&&e.writeBuffer(this.bubs,0,M);const B=t.bubbleModel.cavities;this.nsites=B.count;const I=new ArrayBuffer(4*Cr*s.nsites),j=new Uint32Array(I),E=new Float32Array(I),R=n.nx;for(let q=0;q<B.count;q+=1){const N=Cr*q;let U=B.cell[q],J=B.r[q];if(U>=0&&r.solid[U]===0){const wt=B.dir[q],mt=wt===0?U+1:wt===1?U-1:wt===2?U+R:U-R;mt>=0&&mt<i&&r.solid[mt]!==0?U=mt:J=1e-9}j.set([U,B.fluid[q],B.dir[q],0],N),E.set([J,B.s[q],B.z[q],0],N+4)}e.writeBuffer(this.sites,0,I);const W=new Uint32Array(s.nsites);for(let q=0;q<B.count;q+=1)W[q]=B.bubble[q];e.writeBuffer(this.sbub,0,W);const V=new Float32Array(Xs);V[$s.DT]=t.dt,V[$s.TIME]=t.time,V[$s.RHOREF]=F.rhoRef,e.writeBuffer(this.glob,0,V);const Z=new Uint32Array(xs),it=new Float32Array(Z.buffer);Z[H.PCOUNT]=x.count,Z[H.PSORT]=x.count,Z[H.BCOUNT]=k.count,Z[H.NEXTID_B]=Math.max(1,k.nextFree),Z[H.NEXTID_P]=Math.max(1,x.nextFree);const dt=t.bubbleModel;Z[H.WATCH]=dt.watch>=0?dt.watch:Lr,Z[H.WATCH_FATE]=dt.watchFate,dt.firstSuperheat!==null&&(it[H.FIRST_SH]=dt.firstSuperheat+1e3,Z[H.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,Z),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(co*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(ro*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(oo*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(h=>Math.ceil(h.size/4)*4),n=s.reduce((h,f)=>h+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let c=0;t.forEach((h,f)=>{s[f]>0&&r.copyBufferToBuffer(h.buf,h.offset,i,c,s[f]),c+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const a=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];c=0;for(const h of s)l.push(a.slice(c,c+h)),c+=h;return l}async download(t){const e=this.d,s=e.n,[n,i,r,c,a,l,h,f,u,m]=await this.read([{buf:this.cnt,offset:0,size:4*xs},{buf:this.glob,offset:0,size:4*Xs},{buf:this.cf,offset:0,size:4*kr*s},{buf:this.cu,offset:0,size:4*Tr*s},{buf:this.at,offset:0,size:4*Sr*s},{buf:this.ff,offset:0,size:4*Mr*e.nf},{buf:this.af,offset:0,size:4*Pr*e.nf},{buf:this.heat,offset:0,size:4*ve*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*Ae*e.nreg}]),p=new Uint32Array(n),d=Math.min(e.pcap,p[H.PCOUNT]),g=Math.min(e.bcap,p[H.BCOUNT]),[y,w]=await this.read([{buf:this.partsA,offset:0,size:4*js*Math.max(1,d)},{buf:this.bubs,offset:0,size:4*Is*Math.max(1,g)}]),x=t.grid,F=new Float32Array(r),_=(D,$,Q=0)=>{for(let O=0;O<s;O+=1)$[Q+O]=F[D*s+O]};_(nt.PHI,x.phi),_(nt.ALPHA,x.alpha),_(nt.PL,x.pl),_(nt.PG,x.pg),_(nt.MN,x.mg,at*s),_(nt.MO,x.mg,ct*s),_(nt.MV,x.mg,Y*s),_(nt.MF,x.mfog),_(nt.HG,x.Hg),_(nt.ES,x.Es),_(nt.FILM,x.film),_(nt.T,x.T),_(nt.TL,x.Tl),_(nt.CL,x.Cl);const T=t.gas;_(nt.VGAS,T.vgas),_(nt.RHO,T.rho),_(nt.NMOL,T.nmol),_(nt.CAP,T.cap),_(nt.MU,T.mu),_(nt.VEOS,T.veos),_(nt.SRCV,T.srcV),_(nt.VEOSMID,T.veosMid),_(nt.CRUST,x.crust);for(let D=0;D<x.nx;D+=1)t.salt.floor[D]=F[nt.FLOOR*s+D],t.salt.floorH[D]=F[nt.FLOORH*s+D];const A=new Uint32Array(c);for(let D=0;D<s;D+=1)x.kind[D]=A[us.KIND*s+D];const b=new Float32Array(a);for(let D=0;D<s;D+=1)t.liquid.volSrc[D]=b[ao.VOLSRC*s+D];const k=new Float32Array(l),S=new Float32Array(h),M=e.nf;for(let D=0;D<e.nu;D+=1)x.ul[D]=k[Ie.UL*M+D],x.ug[D]=k[Ie.UG*M+D],t.liquid.fU[D]=S[D];for(let D=0;D<e.nv;D+=1)x.vl[D]=k[Ie.UL*M+e.nu+D],x.vg[D]=k[Ie.UG*M+e.nu+D],t.liquid.fV[D]=S[e.nu+D];const P=t.particles,C=t.liquid,L=new Float32Array(y),B=new Uint32Array(y),I=new Int32Array(y);let j=0,E=0;for(let D=0;D<d;D+=1){const $=js*D;if(B[$+13]&1||!(L[$+8]>0))continue;const Q=j;j+=1,P.x[Q]=L[$],P.y[Q]=L[$+1],P.vx[Q]=L[$+2],P.vy[Q]=L[$+3],P.c00[Q]=L[$+4],P.c01[Q]=L[$+5],P.c10[Q]=L[$+6],P.c11[Q]=L[$+7],P.mass[Q]=L[$+8],P.h[Q]=L[$+9];const O=L[$+26]>0?L[$+26]:0;P.spc[2*Q]=O>0?Qn:0,P.spc[2*Q+1]=0,P.smass[2*Q]=O,P.smass[2*Q+1]=0,P.mat[Q]=B[$+13]>>>8&255,P.id[Q]=B[$+14],P.id[Q]>E&&(E=P.id[Q]),C.dVp[Q]=L[$+12],C.bi[Q]=I[$+15],C.bj[Q]=I[$+16];for(let K=0;K<9;K+=1)C.wt[9*Q+K]=L[$+17+K];P.derive(Q)}P.count=j,P.reserveIds(Math.max(p[H.NEXTID_P],E+1)),C.weightsDirty=!0;const R=t.bubbles,W=t.bubbleModel.motionState,V=new Float32Array(w),Z=new Uint32Array(w),it=new Int32Array(w);R.count=0;let dt=0;for(let D=0;D<g;D+=1){const $=Is*D;if(Z[$+20]===0)continue;const Q=R.count;R.count+=1;const O=Q*lt;R.x[Q]=V[$],R.y[Q]=V[$+1],R.z[Q]=V[$+2],R.vx[Q]=V[$+3],R.vy[Q]=V[$+4];for(let K=0;K<lt;K+=1)R.m[O+K]=0;R.m[O+at]=V[$+5],R.m[O+ct]=V[$+6],R.m[O+Y]=V[$+7],R.H[Q]=V[$+8],R.age[Q]=V[$+9],R.site[Q]=it[$+10],R.r[Q]=V[$+11],R.V[Q]=V[$+12],R.pb[Q]=V[$+13],R.pv[Q]=V[$+14],R.Tb[Q]=V[$+15],R.dmdt[Q]=V[$+16],W.ux0[Q]=V[$+17],W.uy0[Q]=V[$+18],R.id[Q]=Z[$+19],R.id[Q]>dt&&(dt=R.id[Q]);for(let K=0;K<ae;K+=1)R.force[Q*ae+K]=V[$+21+K]}R.reserveIds(Math.max(p[H.NEXTID_B],dt+1));const q=t.bubbleModel.cavities,N=new Uint32Array(u);for(let D=0;D<q.count;D+=1)q.bubble[D]=N[D];const U=new Float32Array(m);for(let D=0;D<t.regions.count;D+=1){const $=Ae*this.regionMap[D];t.regions.p0[D]=U[$+Xt.P0],t.regions.rhoBar[D]=U[$+Xt.RHOBAR]}const J=new Float32Array(f);t.heat.heaters.forEach((D,$)=>{const Q=ve*$;D.P=J[Q+Ht.P],D.Tmean=J[Q+Ht.TMEAN],D.integral=J[Q+Ht.INTEGRAL]});const wt=new Float32Array(i);t.dt=wt[$s.DT];const mt=t.bubbleModel;mt.watch=p[H.WATCH]===Lr?-1:p[H.WATCH],Md(t,this.stair)}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const ze=128,Qt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Bd=5,cc=30,lc=`
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
`,Ed=[{name:"heaterSums",wg:ze,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
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
        let kp = power / ${Bd}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${cc}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${cc}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:ze,bind:"P:u cnt:a parts:r",code:`${ee}
${Qt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:ze,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Se}
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
}`},{name:"heatAssemble",wg:ze,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${lc}
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
}`},{name:"heatFlux",wg:ze,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${lc}
${Qi}
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
}`},{name:"heatParts",wg:ze,bind:"P:u cnt:a cf:r parts:w",code:`${Se}
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
}`},{name:"heatShare",wg:ze,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${Se}
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
}`},{name:"pwParts",wg:ze,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Qt} {
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
  if (lid < 11u) { meas[wid3.x * ${Js}u + lid] = red[lid * 256u]; }
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Js}u + lid] = red[lid * 256u]; }
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Js}u + lid] = red[lid * 256u]; }
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
}`}],Ds=256,Rd=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:Ds,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Mi}
${Ct} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Ds,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Mi}
${Ct} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Ds,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${ic}
${Mi}
${Ct} {
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
}`},{name:"mgPost",wg:Ds,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Vn}
${Ee}
const TILE: u32 = 16u;
const HALO: u32 = ${Vt}u;
const TS: u32 = ${16+2*Vt}u;
var<workgroup> sx: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Vt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Vt)**2}>;
${Ct} {
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
}`},{name:"mgPreR",wg:Ds,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Vn}
${Ee}
const TILE: u32 = 12u;
const HALO: u32 = ${Vt+2}u;
const TS: u32 = ${12+2*(Vt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Vt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Vt+2))**2}>;
${Ct} {
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
}`},{name:"mgTail",wg:Ds,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${ic}
${Ee}
var<workgroup> tx: array<f32, ${Gs}>;
var<workgroup> tb: array<f32, ${Gs}>;
var<workgroup> tax: array<f32, ${Gs}>;
var<workgroup> tay: array<f32, ${Gs}>;
var<workgroup> tinv: array<f32, ${Gs}>;
var<workgroup> toff: array<u32, ${Zs}>;
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
${Ct} {
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
  for (var k = 0u; k < ${nc}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${nc}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],ls=128,fs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Dd=[{name:"flashTs",wg:ls,bind:"P:u cf:w cu:r reg:r",code:`${fs} {
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
}`},{name:"flashVap",wg:ls,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Se}
${fs} {
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
}`},{name:"flashParts",wg:ls,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Se}
${ee}
${Vo}
${fs} {
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
}`},{name:"flashDist",wg:ls,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ee}
${fs} {
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
}`},{name:"fog",wg:ls,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Qi}
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
${fs} {
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
}`},{name:"spawnWater",wg:ls,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${fs} {
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
}`},{name:"films",wg:ls,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${fs} {
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
}`}],Er=128,Rr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Nd=`
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
`,Vd=`
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
`,Ud=[{name:"saltCryst",wg:Er,bind:"P:u cnt:a cu:r at:a parts:w",code:`${Se}
${ee}
${Vo}
${Rr} {
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
}`},{name:"saltSums",wg:Er,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${Se}
${Rr} {
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
}`},{name:"saltShare",wg:Er,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${Se}
${Nd}
${Vd}
${Rr} {
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
}`}],Ns=128,Vs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Gd=.006,Hd={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},$d=4*1e3*15e-7/(3*2*.07),Uo=`
const VIR = array<vec3<f32>, ${ri.length}>(${ri.map(o=>`vec3<f32>(${X(o[0]/255)}, ${X(o[1]/255)}, ${X(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${X(ri.length-1)};
  let i = min(u32(floor(x)), ${ri.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Dr="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var bc;const Wd=[{name:"rScale",wg:Ns,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Dr}
var<workgroup> m4: array<vec4<f32>, WG>;
${Vs} {
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
}`},{name:"rCells",wg:Ns,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Dr}
${Uo}
const SOLID_RGB = array<vec3<f32>, ${pt.length}>(${pt.map(o=>{const t=En(o.color);return`vec3<f32>(${X(t[0]/255)}, ${X(t[1]/255)}, ${X(t[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${En(((bc=ir[0])==null?void 0:bc.color)??"#f4f3ee").map(o=>X(o/255)).join(", ")});
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${X(tl)} * P.dx * P.depth) / P.dx)); }
${Vs} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${X(xe[0])};
  let tspan = ${X(xe[1]-xe[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${pt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${X($d)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Ns,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${Vs} {
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
}`},{name:"rLiqBlurX",wg:Ns,bind:"P:u lq:r lq2:w",code:`${Vs} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:Ns,bind:"P:u lq2:r liquid:t",code:`${Vs} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${X(xe[0])}) / ${X(xe[1]-xe[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${X(Oo)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:Ns,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Dr}
${Vs} {
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
}`}],si=`
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
`;var Fc;const Nr=`${si}
${Uo}
const OIL_RGB = vec3<f32>(${En(((Fc=te[1])==null?void 0:Fc.color)??"#e3b437").map(o=>X(o)).join(", ")});
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
`,Kd=`${si}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,zd=`${si}
${(Do.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${H.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,Qd=`${si}
${Uo}
${(Do.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${H.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${X(273.15+xe[0])}) / ${X(xe[1]-xe[0])}, 0.0, 1.0);
  if (R.tint > 1.5) { o.t = clamp(parts[p].s / max(1e-30, parts[p].mass) / ${X(Oo)}, 0.0, 1.0); }
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Xd=`${si}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,fc=48,Vr=256,Yd=12;class Zd{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",Vr*Yd,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,p,d,g,y=[])=>{const w=t.createShaderModule({code:m}),F=(await w.getCompilationInfo()).messages.filter(_=>_.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(_=>`${_.lineNum}:${_.linePos} ${_.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:w,entryPoint:"vs",buffers:y},fragment:{module:w,entryPoint:p,targets:[{format:this.format,blend:e}]},primitive:{topology:g}})},[r,c,a,l,h,f,u]=await Promise.all([i(Nr,"fsCells",this.layouts.quad,"triangle-strip"),i(Nr,"fsField",this.layouts.quad,"triangle-strip"),i(Nr,"fsLiquid",this.layouts.quad,"triangle-strip"),i(Kd,"fs",this.layouts.rect,"triangle-strip"),i(zd,"fs",this.layouts.store,"triangle-strip"),i(Qd,"fs",this.layouts.store,"triangle-strip"),i(Xd,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:c,liquid:a,rect:l,disc:h,point:f,line:u}}ensure(){var h,f,u,m,p,d;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(g,y)=>s.createTexture({size:[g,y],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(h=this.cellsTex)==null||h.destroy(),(f=this.fieldTex)==null||f.destroy(),(u=this.liquidTex)==null||u.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(p=this.lq2)==null||p.destroy(),(d=this.arrows)==null||d.destroy(),this.lq=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*4*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(Gd/this.gpu.cpu.grid.dx)),c=r>>1,a=Math.max(1,Math.ceil((t.d.nx-c)/r)),l=Math.max(1,Math.ceil((t.d.ny-c)/r));this.nArrows=a*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,a,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:Vr*s,size:4*fc}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,c){this.ensure();const a=this.gpu.state,l=this.gpu.ctx,h=this.device.queue;this.roData[0]=Hd[r],h.writeBuffer(this.ro,0,this.roData),t.clearBuffer(a.cnt,4*H.OV_PMAX,16);const f=t.beginComputePass(),u=a.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),u),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),u),c||(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*u),l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*u),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*u)),r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),f.end();const m=this.gpu.cpu.grid,p=(x,F,_)=>{const T=new Float32Array(fc),A=new Uint32Array(T.buffer);T.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),T.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),T.set(F,24),T.set(_,28),T[32]=r==="temperature"?1:r==="salt"?2:0,T[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),A[34]=a.d.bcap,A[35]=a.d.pcap,h.writeBuffer(this.rp,Vr*x,T)},d=.003;p(0,[0,0,m.w,m.h],[...this.theme.ground,1]),p(1,[0,0,0,0],[0,0,0,0]),p(2,[0,0,0,0],[...this.theme.ink,.85]),p(3,[0,0,0,0],[...this.waterInk,.9]);const g=[];i.left&&g.push([-d,-d,0,m.h+(i.top?d:0)]),i.right&&g.push([m.w,-d,m.w+d,m.h+(i.top?d:0)]),i.bottom&&g.push([-d,-d,m.w+d,0]),i.top&&g.push([-d,m.h,m.w+d,m.h+d]),g.forEach((x,F)=>p(4+F,x,[...this.theme.wall,1]));const y=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;y.setPipeline(w.rect),y.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),y.draw(4),c?(y.setPipeline(w.point),y.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:a.partsA})),y.draw(4,a.d.pcap)):(y.setPipeline(w.liquid),y.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),y.draw(4)),y.setPipeline(w.disc),y.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:a.bubs})),y.draw(4,a.d.bcap),y.setPipeline(w.field),y.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),y.draw(4),y.setPipeline(w.cells),y.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),y.draw(4),r==="velocity"&&(y.setPipeline(w.line),y.setVertexBuffer(0,this.arrows),y.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),y.draw(6*this.nArrows),y.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),y.draw(6*this.nArrows,1,6*this.nArrows)),y.setPipeline(w.rect),g.forEach((x,F)=>{y.setBindGroup(0,this.drawGroup(`d-wall${F}`,this.layouts.rect,4+F,{})),y.draw(4)}),y.end()}reset(){this.size="",this.groups.clear()}}const Jd=[...Ld,...Rd,..._d,...bd,...yd,...Ad,...gd,...vd,...Td,...Dd,...Ud,...Ed,...Wd],uc=[["heater",H.HEATER_E,"f"],["lossWalls",H.LOSS_WALLS,"f"],["lossOpen",H.LOSS_OPEN,"f"],["escapedEnergy",H.ESC_ENERGY,"f"],["escapedWater",H.ESC_WATER,"f"],["escapedAir",H.ESC_AIR,"f"],["escapedOther",H.ESC_OTHER,"f"],["escapedSalt",H.ESC_SALT,"f"],["crystallized",H.CRYST,"f"],["produced",H.PRODUCED,"f"],["condensed",H.CONDENSED,"f"],["dew",H.DEW,"f"],["fogMade",H.FOGMADE,"f"],["burstVapour",H.BURSTVAP,"f"],["fluxSL",H.FLUX_SL,"f"],["fluxLG",H.FLUX_LG,"f"],["fluxSG",H.FLUX_SG,"f"],["lossSolids",H.LOSS_SOLIDS,"f"],["nucleated",H.NUCLEATED,"u"],["departed",H.DEPARTED,"u"],["merged",H.MERGED,"u"],["burst",H.BURST,"u"],["collapsed",H.COLLAPSED,"u"],["burstCold",H.BURST_COLD,"u"],["burstWarm",H.BURST_WARM,"u"],["collapsedCold",H.COLL_COLD,"u"],["collapsedWarm",H.COLL_WARM,"u"],["releasedGas",H.REL_MASS,"f"],["releases",H.REL_N,"u"],["releaseMisses",H.REL_MISS,"u"],["evapCapped",H.EVAP_CAP,"u"]],hc=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0,releasedGas:0,releases:0,releaseMisses:0,evapCapped:0}),t1=24,Ur=256,Us=2*gs;class Tn{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",hc());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"other0",null);v(this,"salt0",null);v(this,"carry",null);v(this,"sealed",!1);v(this,"salty",!1);v(this,"mixed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(gs).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:Us}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*Us,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){return Tn.on(await Tn.prepare(),t)}static async prepare(t=[]){const e=await No.create(),s=await e.compile([...Jd,...t]);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return e}static on(t,e){return new Tn(t,e)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Id(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new qd(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Ur/4*16);for(let n=0;n<16;n+=1)s[Ur/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let s=0;s<this.cpu.regions.count;s+=1)this.cpu.regions.open[s]===0&&(this.sealed=!0);const t=this.ctx.device.createCommandEncoder(),e=t.beginComputePass();this.sort(e,1),this.sort(e,2),e.end(),this.ctx.device.queue.submit([t.finish()])}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,s.escapedOther=e.escapedOther,s.escapedSalt=e.escapedSalt,t.salt.crystallized=e.crystallized,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*H.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*H.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Ur*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,Us,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);if(this.sort(n,1),this.mixed&&this.cells(n,"cellHost","B"),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.mixed){for(let i=0;i<t1;i+=2)this.faces(n,"viscJacA"),this.faces(n,"viscJacB");this.faces(n,"viscForce")}this.cells(n,"liqAssemble"),this.solver.encodeMG(n,El,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,Rl,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubVent"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,Nl,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffOut"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"spawnWater","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),this.salty&&(this.parts(n,"saltCryst","A"),this.cells(n,"gasApply")),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,Dl,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),this.salty&&(this.cells(n,"saltSums","A"),this.cells(n,"saltShare","A")),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*xs,n=s+4*Xs,i=n+4*Ae*t.d.nreg,r=i+4*ve*t.d.nheat,c=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],a=r+4*Js*c,l=a+4*64,h=l+8*Us;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:a,ts:l,total:h}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(a=>!this.busy.has(a)&&a.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*xs),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Xs),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*Ae*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*ve*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*Us),t.clearBuffer(s.cnt,4*Ua,4*(Sh-Ua)),t.clearBuffer(s.cnt,4*H.VMAXP,4*4),t.clearBuffer(s.cnt,4*H.ESC_OTHER,4*3),t.clearBuffer(s.cnt,4*H.REL_MASS,4*4),this.busy.add(i);const c=[];for(let a=0;a<this.cpu.regions.count;a+=1)c.push(s.gpuRegion(a));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:c,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,xs),r=new Float32Array(t,n.cnt,xs),c=new Float32Array(t,n.glob,Xs),a=new Float32Array(t,n.reg,Ae*e.nreg),l=new Float32Array(t,n.heat,ve*e.nheat),h=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[u,m,p]=e.groups,d=(_,T,A)=>{let b=0;for(let k=0;k<T;k+=1)b+=h[(_+k)*Js+A];return b},g=[];for(const _ of e.regions){const T=Ae*_;g.push({p0:a[T+Xt.P0],sealed:a[T+Xt.OPEN]===0,vGas:a[T+Xt.VGAS],vFluid:a[T+Xt.VFLUID]})}const y=[];for(let _=0;_<e.heaters;_+=1){const T=ve*_;y.push({P:l[T+Ht.P],Tmean:l[T+Ht.TMEAN],integral:l[T+Ht.INTEGRAL],cells:l[T+Ht.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const _=new BigUint64Array(t,n.ts,Us);w=[];for(let T=0;T<gs;T+=1){const A=_[2*T],b=_[2*T+1];w.push(b>A&&A>0n?Number(b-A)/1e6:0)}}const x=r[H.SUM_WM],F={};for(const[_,T,A]of uc)F[_]=A==="f"?r[T]:i[T];return{intervals:F,ov:[r[H.OV_PMAX],r[H.OV_VMAX],r[H.OV_VLIQ]],pcount:i[H.PCOUNT],bcount:i[H.BCOUNT],dt:c[$s.DT],stepsSince:i[H.STEPS],simSince:r[H.SIMTIME],itL:i[H.IT_L],itG:i[H.IT_G],itH:i[H.IT_H],itD:i[H.IT_D],capL:i[H.CAP_L],capG:i[H.CAP_G],capH:i[H.CAP_H],capD:i[H.CAP_D],resL:r[H.RES_L],resG:r[H.RES_G],resH:r[H.RES_H],nsub:i[H.NSUBMAX],uMaxG:r[H.UMAXG],waterMass:x,waterT:x>0?r[H.SUM_WMT]/x:0,waterTmax:r[H.TMAX],solids:d(0,u,0),film:d(0,u,1),gas:d(0,u,2),vapour:d(0,u,3),fog:d(0,u,4),air:d(0,u,5),liquidCells:Math.round(d(0,u,6)),gasCells:Math.round(d(0,u,7)),liquidH:d(u,m,0),liquidMass:d(u,m,1),sensible:d(u,m,3),otherMass:d(u,m,4),otherMT:d(u,m,5),saltLiquid:d(u,m,6),crust:d(0,u,8),floor:d(0,u,9),floorH:d(0,u,10),bubH:d(u+m,p,0),bubWater:d(u+m,p,1),bubAir:d(u+m,p,2),regions:g,heaters:y,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[H.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[H.FIRST_SH]!==0?r[H.FIRST_SH]-1e3:null,stageMs:w,vmaxP:r[H.VMAXP],rmaxB:r[H.RMAXB],slowed:i[H.SLOWED],vented:r[H.VENTED]}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of uc)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD,e.slowed+=t.slowed,e.vented+=t.vented;const s=(n,i,r,c,a,l)=>{if(i===0&&r===0)return n;const h=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(a,Math.max(c,n>h?Math.max(h,n-2):h))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),c={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:i.escapedOther,editOther:e.ledger.other,escapedSalt:i.escapedSalt,editSalt:e.ledger.salt,bodyWork:0},a=this.energy0??r.energy,l=this.water0??r.water.total,h=r.energy-a-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy),f=r.water.total-l-c.editWater,u=r.other.total-(this.other0??r.other.total)-c.editOther,m=r.salt.total-(this.salt0??r.salt.total)-c.editSalt,p=i.produced+i.burstVapour,d=i.time-this.vapourLast;d>.2&&(this.vapourRate=(p-this.vapourMark)/d,this.vapourMark=p,this.vapourLast=i.time);const g=e.heat.heaters.map((x,F)=>({h:x,k:F,rd:n==null?void 0:n.heaters[F]})).filter(({rd:x,h:F})=>((x==null?void 0:x.cells)??F.cells)>0).map(({h:x,rd:F})=>({group:x.group,P:(F==null?void 0:F.P)??x.P,Tmean:(F==null?void 0:F.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),y=(x,F,_)=>({iterations:x,residual:F,capped:_>0}),w=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:y((w==null?void 0:w.itL)??0,(w==null?void 0:w.resL)??0,(w==null?void 0:w.capL)??0),gas:y((w==null?void 0:w.itG)??0,(w==null?void 0:w.resG)??0,(w==null?void 0:w.capG)??0),heat:y((w==null?void 0:w.itH)??0,(w==null?void 0:w.resH)??0,(w==null?void 0:w.capH)??0),gasSubsteps:(w==null?void 0:w.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:(n==null?void 0:n.otherMass)??0,otherT:n!==null&&n.otherMass>0?n.otherMT/n.otherMass:0,saltMass:(n==null?void 0:n.saltLiquid)??0,saltSolid:((n==null?void 0:n.crust)??0)+((n==null?void 0:n.floor)??0),bodies:{count:this.cpu.bodies.list.filter(x=>!x.gone).length,free:0,awake:0},heaters:g,regions:((n==null?void 0:n.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:c,energyError:h,waterError:f,otherError:u,saltError:m,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy,extremes:{...e.extremes.stats(),slowed:i.slowed,vented:i.vented},cpuOnly:!1}}budget(){const t=this.last,e=this.totals;let s=0;for(const h of(t==null?void 0:t.regions)??[])h.sealed&&(s-=h.p0*h.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=((t==null?void 0:t.solids)??0)+((t==null?void 0:t.floorH)??0),r=(t==null?void 0:t.gas)??0,c=(t==null?void 0:t.bubH)??0,a={liquid:(t==null?void 0:t.liquidMass)??0,ice:0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater},l=(t==null?void 0:t.otherMass)??0;return{energy:i+n+r+c+s,solids:i,liquid:n,gas:r,bubbles:c,pv:s,water:a,other:{liquid:l,escaped:e.escapedOther,total:l+e.escapedOther},salt:this.saltBudget(),air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}saltBudget(){const t=this.last,e=(t==null?void 0:t.saltLiquid)??0,s=(t==null?void 0:t.crust)??0,n=(t==null?void 0:t.floor)??0,i=this.totals.escapedSalt;return{liquid:e,crust:s,grains:0,floor:n,escaped:i,total:e+s+n+i}}resetTotals(){Object.assign(this.totals,hc()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0,this.carry=null}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}carryErrors(t){this.resetBaseline(),this.carry=t}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu,n=this.carry??{energy:0,water:0,other:0,salt:0};this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy)-n.energy,this.water0=t.water.total-s.ledger.water-n.water,this.other0=t.other.total-s.ledger.other-n.other,this.salt0=t.salt.total-s.ledger.salt-n.salt,this.carry=null}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}function e1(o){const t=o.cpu,e=t.flows,s=t.phase,n=t.bubbleModel,i=t.extremes.stats();Object.assign(o.totals,{time:t.time,steps:t.steps,heater:e.heater,lossWalls:e.lossWalls,lossOpen:e.lossOpen,escapedEnergy:e.escapedEnergy,escapedWater:e.escapedWater,escapedAir:e.escapedAir,escapedOther:e.escapedOther,escapedSalt:e.escapedSalt,crystallized:t.salt.crystallized,produced:s.produced,condensed:s.condensed,dew:s.dew,fogMade:s.fogMade,burstVapour:n.burstVapour,nucleated:n.nucleated,departed:n.departed,merged:n.merged,burst:n.burst,collapsed:n.collapsed,burstCold:n.burstCold,burstWarm:n.burstWarm,collapsedCold:n.collapsedCold,collapsedWarm:n.collapsedWarm,fluxSL:t.heat.fluxSL,fluxLG:t.heat.fluxLG,fluxSG:t.heat.fluxSG,lossSolids:t.heat.lossSolids,slowed:i.slowed,vented:i.vented}),o.carryErrors({energy:t.energyError(),water:t.waterError(),other:t.otherError(),salt:t.saltError()})}function s1(o,t,e,s,n){const i=-n,r=-n,c=o+2*n,a=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(c/a>l){const f=c/l;return{x0:i,y0:r-(f-a)/2,x1:i+c,y1:r-(f-a)/2+f}}const h=a*l;return{x0:i-(h-c)/2,y0:r,x1:i-(h-c)/2+h,y1:r+a}}const an=self,St=o=>an.postMessage(o),dc=8,n1=.1,i1=3,mc=200,r1=.25,pc=273.15;let ot=null,tt=null,es=null,Un=null,Ne=null,tn="",Pi=1,Li=1,Ci=1,cn={x0:0,y0:0,x1:1,y1:1},ln={left:!0,right:!0,bottom:!0,top:!1},Ts=!1,ho=1,ps="none",Vl=!1,Xe=0,en=0,Xi=0,Gr=0,Hr=!1,Gn=0,mo=0,po=0,go=0,gc=!1,Yi=0,Ks=null,xo=null;const hs=[],vo=[];let Zi=!1;const sn=[];let xc=null,Fi=null,vc=0;function Ye(){Fi!==null&&clearTimeout(Fi),Fi=setTimeout(()=>{Fi=null,o1()},300)}async function o1(){const o=ot;if(o===null)return;const t=vc+=1;try{const e=a0(o.serialize()),s=await ta(e,"cpu"),n=await ta(e,"gpu");xc??(xc=h0());const i=await xc,[r,c]=await Promise.all([i.header(s),i.header(n)]);if(t!==vc||ot!==o)return;const a=c??r;St({type:"clip",info:a===null?null:ll(a,cl(fl(o,new ul(o))),c!==null?r:null)})}catch{}}function Go(){if(ot===null)return;const o=ot.scene.sides;ln={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Ho(o,t,e){Pi=Math.max(1,o),Li=Math.max(1,t),Ci=Math.max(.5,Math.min(3,e)),Ne!==null&&(Ne.width=Math.round(Pi*Ci),Ne.height=Math.round(Li*Ci)),ot!==null&&(cn=s1(ot.boxW,ot.boxH,Pi,Li,.006))}function Ul(o){es!==null&&(es.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function ds(o){vo.push(o),Zi||a1()}async function a1(){if(tt!==null){Zi=!0;try{for(;vo.length>0;){const o=vo.shift();await tt.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){St({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{Zi=!1,en=performance.now()}}}async function Oi(){if(tt===null)return;const o=tt.ctx.device.createCommandEncoder(),t=tt.encodeReadback(o,!1);tt.ctx.device.queue.submit([o.finish()]),t!==null&&await tt.finishReadback(t,!1),tt.baselineFromLast()}function Ji(){return ot===null||!ot.needsCpu()?!1:(St({type:"gpu",ok:!1,adapter:tn,message:"cpu-only",scene:ot.serialize()}),!0)}function tr(o){tt!==null&&es!==null&&tt.stateVersion!==o&&es.reset()}function $r(){ds(async()=>{if(tt===null||ot===null||sn.length===0)return;const o=sn.splice(0,sn.length);await Oi(),await tt.download();for(const e of o){const s=ot.apply(e);s!==null&&s.startsWith("refused")&&St({type:"refused",message:s})}if(Ji())return;const t=tt.stateVersion;tt.upload(),tr(t),Ye()})}function c1(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(ps==="temperature")return[pc+xe[0],pc+xe[1],e];if(ps==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return ps==="velocity"?[0,Math.max(.02,t[1]),e]:ps==="vapour"?[0,.6,e]:ps==="salt"?[0,Oo,e]:[0,1,e]}function l1(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return Ks={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},Ks}return Ks!==null&&(t.fate===1||t.fate===2)?{...Ks,fate:t.fate===1?"burst":"collapsed"}:null}function f1(o,t){if(tt===null||Un===null)return;if(tt.baselineFromLast(),ot!==null&&o.stepsSince>0){ot.extremes.observe(o.rmaxB,o.vmaxP,tt.totals.time);const i=ot.extremes.take();i!==null&&(Ts=!0,Xe=0,Xi=0,St({type:"extreme",event:i}))}if(tt.totals.time>=Yi){const i=Un.sample();i!==null&&(hs.push(i),hs.length>400&&hs.splice(0,hs.length-400),Yi=tt.totals.time+r1)}const e=Math.max(.001,(t-Gn)/1e3),s=(o.stageMs??tt.stageMs).reduce((i,r)=>i+r,0),n={engine:tt.stats(s),stepsPerSecond:go/e,simRate:(tt.totals.time-mo)/e,fps:po/e,renderMs:0,mode:"gpu",adapter:tn,paused:Ts,samples:hs.splice(0,hs.length),bubble:l1(o),object:xo!==null&&ot!==null?qu(ot,xo):null,overlayScale:c1(o)};St({type:"stats",stats:n}),po=0,go=0,mo=tt.totals.time,Gn=t}function yo(){var t;const o=performance.now();if(tt!==null&&es!==null&&Ne!==null&&ot!==null&&!Zi){const e=tt.ctx.device,s=en===0?0:Math.min(.1,(o-en)/1e3);en=o;const n=((t=tt.last)==null?void 0:t.dt)??ot.dt;let i=0;Ts?(i=Math.min(dc,Xi),Xi-=i,Xe=0):(Xe=Math.min(Xe+s*ho,n1*Math.max(1,ho)),i=Gr>=i1?0:Math.min(dc,Math.floor(Xe/Math.max(1e-5,n))),Xe-=i*n);const r=!Hr&&o-Gn>mc&&(i>0||Ts||o-Gn>4*mc),c=e.createCommandEncoder();i>0&&tt.encodeSteps(c,i,r);const a=r?tt.encodeReadback(c,r&&i>0):null;if(es.encode(c,cn,Ne.width,Ne.height,ln,ps,Vl),e.queue.submit([c.finish()]),Gr+=1,e.queue.onSubmittedWorkDone().then(()=>{Gr-=1}),go+=i,po+=1,a!==null){Hr=!0;const l=i>0;tt.finishReadback(a,l).then(h=>{Hr=!1,h!==null&&f1(h,performance.now())})}}typeof an.requestAnimationFrame=="function"?an.requestAnimationFrame(yo):setTimeout(yo,16)}async function u1(o){ot=new Th(o.scene);const t=new ul(ot);if(o.resume!==void 0&&i0(fl(ot,t),o.resume),Ts=o.paused===!0,Ji())return;if(Ne=o.canvas,Ne===null)throw new Error("no OffscreenCanvas");tt=await Tn.create(ot),o.resume!==void 0&&(e1(tt),Yi=ot.time,mo=ot.time),tn=await(async()=>{var s;try{const n=await((s=an.navigator.gpu)==null?void 0:s.requestAdapter({powerPreference:"high-performance"})),i=n==null?void 0:n.info;return i===void 0?"":[i.vendor,i.architecture,i.description].filter(Boolean).join(" ")}catch{return""}})(),es=new Zd(tt,Ne),await es.init(),Ul(o.dark),Un=new Sl(tt),o.resume!==void 0&&Un.copyFrom(t),tt.ctx.device.addEventListener("uncapturederror",s=>St({type:"error",message:`WebGPU: ${s.error.message}`})),tt.ctx.device.lost.then(s=>St({type:"gpu",ok:!1,adapter:tn,message:s.message||s.reason})),Go(),Ho(o.width,o.height,o.dpr),St({type:"gpu",ok:!0,adapter:tn,message:""}),St({type:"ready",offscreen:!0,warnings:ot.warnings,view:cn,quality:ot.currentQuality,walls:ln}),o.resume!==void 0&&St({type:"live",t:ot.time}),Gn=performance.now(),en=performance.now(),gc||(gc=!0,yo()),Ye()}function Wr(){if(tt===null||ot===null)return;const o=tt.stateVersion;tt.cpu=ot,tt.rebuild(),tt.resetTotals(),tr(o),Un=new Sl(tt),Yi=0,hs.length=0,Xe=0,Ks=null,Go(),Ho(Pi,Li,Ci),St({type:"view",view:cn,walls:ln}),Ye()}an.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":St({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&an.navigator.gpu!==void 0});break;case"init":u1(t).catch(e=>St({type:"gpu",ok:!1,adapter:tn,message:e instanceof Error?e.message:String(e)}));break;case"resize":Ho(t.width,t.height,t.dpr),St({type:"view",view:cn,walls:ln});break;case"op":sn.push(t.op),$r();break;case"addLiquid":sn.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),$r();break;case"addSolid":sn.push({op:"solid",region:t.region,material:t.material,T:t.T}),$r();break;case"setHeater":ot==null||ot.setHeater(t.group,t.mode,t.power,t.target,t.on),tt==null||tt.writeHeater(t.group),Ye();break;case"setAmbient":ot==null||ot.setAmbient(t.p,t.T,t.rh,t.g,t.air),tt==null||tt.writeParams(),Ye();break;case"setBoundary":ds(async()=>{if(tt===null||ot===null)return;await Oi(),await tt.download(),ot.setBoundary(t.side,t.value);const e=tt.stateVersion;tt.upload(),tr(e),Go(),St({type:"view",view:cn,walls:ln}),Ye()});break;case"query":ds(async()=>{if(tt===null||ot===null){St({type:"reply",id:t.id,data:null});return}await Oi(),await tt.download(),St({type:"reply",id:t.id,data:ot.query(t.x,t.y)})});break;case"select":Ks=null,tt==null||tt.watch(t.bubble);break;case"overlay":ps=t.overlay;break;case"particles":Vl=t.on;break;case"pause":Ts=t.paused,Xe=0,en=performance.now();break;case"step":Ts&&(Xi+=1);break;case"setSpeed":ho=Math.min(64,Math.max(.05,t.speed));break;case"setExtremes":ot==null||ot.setExtremes(t.mode),tt==null||tt.writeParams(),Ye();break;case"setQuality":ds(async()=>{ot!==null&&(ot.setQuality(t.quality),Wr())});break;case"serialize":tt===null?St({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null}):ds(async()=>{St({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null})});break;case"load":ds(async()=>{ot!==null&&(ot.load(t.scene),!Ji()&&Wr())});break;case"selectObject":xo=t.object;break;case"editObject":ds(async()=>{if(tt===null||ot===null){St({type:"reply",id:t.id,data:null});return}await Oi(),await tt.download();const e=Ou(ot,t.object,t.patch);if(St({type:"reply",id:t.id,data:e}),Ji())return;if(e.rebuilt){Wr();return}const s=tt.stateVersion;tt.upload(),tr(s),Ye()});break;case"theme":Ul(t.dark);break;case"frameDone":break}}catch(e){St({type:"error",message:e instanceof Error?e.message:String(e)})}});
