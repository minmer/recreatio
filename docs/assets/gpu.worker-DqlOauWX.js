var $c=Object.defineProperty;var Wc=(c,t,e)=>t in c?$c(c,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):c[t]=e;var v=(c,t,e)=>Wc(c,typeof t!="symbol"?t+"":t,e);function Kc(c){const t=[...c].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,a)=>(r[0]-i[0])*(a[1]-i[1])-(r[1]-i[1])*(a[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const zc={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Qc=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],Xc=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],Yc={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Jc=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var Zc={ambient:zc,species:Qc,solutes:Xc,vapourInAir:Yc,solids:Jc};const jt=8.314462618,ii=9.80665,Ys=101325,st=273.15,Er=1602176634e-28,ta=1380649e-29,ea=602214076e15,sa=88541878128e-22,H=0,et=1,ft=2,it=0,rt=1,Q=2,at=6,yt=3,Tt=Zc,qt=Tt.species[0],Is=Tt.species[1],Rs=Tt.species[2],mt=new Float64Array(at);mt[it]=Is.molarMass.v;mt[rt]=Rs.molarMass.v;mt[Q]=qt.molarMass.v;Is.name,Rs.name,qt.vapour.name;const dr=Is.gas.cp.v,mr=Rs.gas.cp.v,[Js,Zs,Ee]=qt.vapour.cp.linear;function na(c,t){return c===Q?Js+Zs*(t-Ee):c===it?dr:c===rt?mr:0}const Ue=qt.liquid.kell.c,fn=qt.liquid.cp.table,Mt=new Float64Array(fn.map(c=>c[0])),Bt=new Float64Array(fn.map(c=>c[1])),se=new Float64Array(fn.length);se[0]=Bt[0]*(Mt[0]-st);for(let c=1;c<fn.length;c+=1)se[c]=se[c-1]+.5*(Bt[c]+Bt[c-1])*(Mt[c]-Mt[c-1]);const Ut=fn.length-1;function tc(c){if(c<Mt[0])return-1;if(c>=Mt[Ut])return Ut;let t=Math.min(Ut-1,Math.max(0,Math.floor((c-st)/10)));for(;t>0&&c<Mt[t];)t-=1;for(;t<Ut-1&&c>=Mt[t+1];)t+=1;return t}function Oe(c){const t=tc(c);return t<0?Bt[0]:t===Ut?Bt[Ut]:Bt[t]+(Bt[t+1]-Bt[t])*(c-Mt[t])/(Mt[t+1]-Mt[t])}function Ft(c){const t=tc(c);if(t<0)return se[0]+Bt[0]*(c-Mt[0]);if(t===Ut)return se[Ut]+Bt[Ut]*(c-Mt[Ut]);const e=c-Mt[t],s=(Bt[t+1]-Bt[t])/(Mt[t+1]-Mt[t]);return se[t]+Bt[t]*e+.5*s*e*e}function ec(c){if(c<se[0])return Mt[0]+(c-se[0])/Bt[0];if(c>=se[Ut])return Mt[Ut]+(c-se[Ut])/Bt[Ut];let t=Math.min(Ut-1,Math.max(0,Math.floor(c/41900)));for(;t>0&&c<se[t];)t-=1;for(;t<Ut-1&&c>=se[t+1];)t+=1;const e=(Bt[t+1]-Bt[t])/(Mt[t+1]-Mt[t]),s=c-se[t],n=Bt[t];return Mt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function Hn(c){const t=c-st;return(Ue[0]+t*(Ue[1]+t*(Ue[2]+t*(Ue[3]+t*(Ue[4]+t*Ue[5])))))/(1+Ue[6]*t)}const fi=qt.liquid.k.poly;function Hi(c){const t=Math.min(150,Math.max(0,c-st));return fi[0]+t*(fi[1]+t*fi[2])}const[ia,ra,Dr]=qt.liquid.mu.vogel;function pr(c){return ia*Math.pow(10,ra/(Math.max(c,Dr+60)-Dr))}const ui=qt.surfaceTension,oa=qt.saturation.Tc.v;function gr(c){const t=Math.max(0,1-c/oa);return ui.B*Math.pow(t,ui.mu)*(1+ui.b*t)}const ca=qt.saturation.hlv100.v,tn=st+100,sc=Ft(tn)+ca,aa=qt.vapour.k.v,la=qt.vapour.mu.v;function xt(c){const t=c-Ee,e=tn-Ee;return sc+Js*(c-tn)+.5*Zs*(t*t-e*e)}function fa(c){return xt(c)-Ft(c)}function ne(c,t){return c===Q?xt(t):na(c,t)*(t-st)}const hi=Is.gas.k.power,di=Rs.gas.k.power,ua=Is.gas.mu.sutherland,ha=Rs.gas.mu.sutherland,mi=Tt.vapourInAir,nc=(c,t)=>c[0]*Math.pow(t/c[1],1.5)*((c[1]+c[2])/(t+c[2])),ic=150,$n=1001,un=c=>{const t=new Float64Array($n);for(let e=0;e<$n;e+=1)t[e]=c(ic+e);return t},es=(c,t)=>{let e=t-ic;e>0?e>$n-1.001&&(e=$n-1.001):e=0;const s=e|0;return c[s]+(e-s)*(c[s+1]-c[s])},Vr=un(c=>hi[0]*Math.pow(c/hi[1],hi[2])),da=un(c=>di[0]*Math.pow(c/di[1],di[2])),Nr=un(c=>nc(ua,c)),ma=un(c=>nc(ha,c)),pa=un(c=>mi.D0.v*Math.pow(c/mi.T0.v,mi.exponent.v));function ga(c,t,e,s){const n=c+t+e;return n>0?(c*es(Vr,s)+t*es(da,s)+e*aa)/n:es(Vr,s)}function xa(c,t,e,s){const n=c+t+e;return n>0?(c*es(Nr,s)+t*es(ma,s)+e*la)/n:es(Nr,s)}function va(c,t){return es(pa,c)*(Ys/t)}function rc(c,t,e,s){const n=c*dr+t*mr,i=tn-Ee,r=.5*e*Zs,a=n+e*Js;if(a<=0)return st;const o=n*(Ee-st)+e*(sc+Js*(Ee-tn)-.5*Zs*i*i)-s,l=a*a-4*r*o;return Ee+-2*o/(a+Math.sqrt(l>0?l:0))}function $i(c,t,e,s,n){return c*dr+t*mr+e*(Js+Zs*(n-Ee))+(s>0?s*Oe(n):0)}const ya=Tt.ambient.air.N2.v,wa=Tt.ambient.air.O2.v,oc=Tt.ambient.hExt.v,ht=Tt.solids.map(c=>({id:c.id,name:c.name,rho:c.rho.v,cp:c.cp.v,k:c.k.v,contactAngle:c.contactAngle.v,cavScale:c.cavities.scale.v,cavRmax:c.cavities.rmax.v,friction:c.friction.v,bounce:c.restitution.v,color:c.color}));function $s(c){return ht.findIndex(t=>t.id===c)}const ct=0,cc=Tt.species.slice(3),Ur=[null,...cc.map(c=>{const t=c.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*st+.5*s*st*st}})],oe=[{id:qt.id,name:qt.name,short:qt.liquid.name,color:qt.liquid.color,volatile:!0,range:[st,st+150]},...cc.map(c=>({id:c.id,name:c.name,short:c.liquid.name,color:c.liquid.color,volatile:!1,range:[c.liquid.range.lo,c.liquid.range.hi]}))];function ac(c){return oe.findIndex(t=>t.id===c)}const cs=c=>Ur[c]??Ur[1];function xr(c,t){if(c===ct)return Oe(t);const e=cs(c);return e.cA+e.cB*t}function ba(c,t){if(c===ct)return Ft(t);const e=cs(c);return e.cA*t+.5*e.cB*t*t-e.h0}function Fa(c,t){if(c===ct)return ec(t);const e=cs(c),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function is(c,t){if(c===ct)return Hn(t);const e=cs(c);return e.rA+e.rB*t}function Ks(c,t){if(c===ct)return Hi(t);const e=cs(c);return e.kA+e.kB*t}function en(c,t){if(c===ct)return pr(t);const e=cs(c);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function _s(c,t){return c===ct?gr(t):cs(c).sigma}qt.thermo,Is.thermo,Rs.thermo;const hn=Tt.species[0].saturation,Fe=hn.if97.n,lc=Fe[0],fc=Fe[1],uc=Fe[2],hc=Fe[3],dc=Fe[4],mc=Fe[5],pc=Fe[6],gc=Fe[7],xc=Fe[8],Wi=Fe[9],zs=hn.Tc.v,Aa=hn.rhoc.v,Wn=273.15,as=hn.vapourDensity.c;hn.liquidDensity.b;function ri(c){const t=c<Wn?Wn:c>zs?zs:c,e=t+xc/(t-Wi),s=e*e+lc*e+fc,n=uc*e*e+hc*e+dc,i=mc*e*e+pc*e+gc,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function kt(c){const t=c<611.213?611.213:c>22064e3?22064e3:c,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+uc*e+mc,n=lc*e*e+hc*e+pc,i=fc*e*e+dc*e+gc,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=Wi+r;return(a-Math.sqrt(a*a-4*(xc+Wi*r)))/2}function vc(c){const e=1-(c<Wn?Wn:c>zs?zs:c)/zs,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,o=a*a*s,l=o*a*r*r;return Aa*Math.exp(as[0]*n+as[1]*i+as[2]*r+as[3]*a+as[4]*o+as[5]*l)}const Kn=250,zn=.01,dn=25001,qn=new Float64Array(dn),In=new Float64Array(dn);for(let c=0;c<dn;c+=1)qn[c]=ri(Kn+c*zn),In[c]=vc(Kn+c*zn);function sn(c){const t=(c-Kn)/zn;if(!(t>=0)||t>=dn-1)return ri(c);const e=t|0;return qn[e]+(t-e)*(qn[e+1]-qn[e])}function De(c){const t=(c-Kn)/zn;if(!(t>=0)||t>=dn-1)return vc(c);const e=t|0;return In[e]+(t-e)*(In[e+1]-In[e])}const Gt=Tt.solutes[0],yc=Tt.species[0],vr=yc.molarMass.v,Ls=Gt.molarMass.v,_a=Gt.ions.v,yr=1,wc=Tt.solutes.map(c=>({id:c.id,name:c.name,short:c.short,color:c.solid.color}));function bc(c){return wc.findIndex(t=>t.id===c)}function Fc(c){return c>0?c*Ls/(1+c*Ls):0}const pe=298.15,mn=Gt.pitzer,Pa=mn.b0.a,ka=mn.b1.a,Ma=mn.c.a,Ta=mn.b.v,Sa=mn.alpha.v,Rn=Gt.pitzerCold,Ca=Rn.below.v;function pi(c,t){return c[0]+c[1]*(1/t-1/pe)+c[2]*Math.log(t/pe)+c[3]*(t-pe)+c[4]*(t*t-pe*pe)+c[5]*(1/(t*t)-1/(pe*pe))}const wn=Gt.dielectric.c;function La(c){const t=c-st;return wn[0]+t*(wn[1]+t*(wn[2]+t*wn[3]))}function Oa(c){const t=Er*Er/(4*Math.PI*sa*La(c)*ta*c);return Math.sqrt(2*Math.PI*ea*Hn(c))*t*Math.sqrt(t)/3}function Ba(c,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=c<Ca,n=pi(s?Rn.b0.a:Pa,c),i=pi(s?Rn.b1.a:ka,c),r=pi(s?Rn.c.a:Ma,c);return 1-Oa(c)*e/(1+Ta*e)+t*(n+i*Math.exp(-Sa*e))+t*t*r}function Qn(c,t){return t>0?Math.exp(-_a*t*Ba(c,t)*vr):1}const Ac=240,Xn=221,_c=.05,Re=181;let gi=null;function ja(){if(gi!==null)return gi;const c=new Float64Array(Xn*Re);for(let t=0;t<Xn;t+=1)for(let e=0;e<Re;e+=1)c[t*Re+e]=Qn(Ac+t,e*_c);return gi=c,c}function Pc(c,t){if(!(t>0))return 1;const e=t/_c;if(e>=Re-1)return Qn(c,t);const s=ja();let n=c-Ac;n>0?n>Xn-1.000001&&(n=Xn-1.000001):n=0;const i=n|0,r=e|0,a=n-i,o=e-r,l=i*Re+r,f=s[l]+o*(s[l+1]-s[l]),u=s[l+Re]+o*(s[l+Re+1]-s[l+Re]);return f+a*(u-f)}function kc(c,t){let e=kt(c);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=kt(c/Pc(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const oi=yc.fusion,ie=oi.T.v,wr=oi.h.v,qa=oi.cpIce.v;oi.rhoIce.v;function Ia(c){const t=Oe(ie)-qa;return vr/jt*((wr-t*ie)*(1/ie-1/c)+t*Math.log(c/ie))}const Ra=Gt.eutectic.T.v,Ea=Gt.eutectic.w.v;function Mc(c){if(!(c>0))return ie;if(Fc(c)>=Ea)return Ra;const t=s=>Math.log(Qn(s,c))-Ia(s);let e=ie+Math.log(Qn(ie,c))*jt*ie*ie/(vr*wr);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return ie;if(Math.abs(r)<1e-9)break}return e}const Be=Gt.solubility.table;function Da(c){if(c<=Be[0][0])return Be[0][1];for(let t=1;t<Be.length;t+=1)if(c<=Be[t][0]){const[e,s]=Be[t-1],[n,i]=Be[t];return s+(i-s)*(c-e)/(n-e)}return Be[Be.length-1][1]}function Va(c){return Fc(Da(c))}Gt.solid.rho.v;const ci=Gt.solid.cp.v;function ai(c){return ci*(c-st)}const Ds=Gt.density.laliberte;function Na(c,t){const e=c-st,s=e+Ds[4];return(Ds[0]*t+Ds[1])*Math.exp(1e-6*s*s)/(t+Ds[2]+Ds[3]*e)}function br(c,t){return t>0?1/((1-t)/Hn(c)+t/Na(c,t)):Hn(c)}const Es=Gt.cp.laliberte,li=Es[0],Ua=Es[1],Ga=Es[2],nn=Es[3],Fr=Es[4],rn=Es[5],rs=Gt.cp.range.lo,Yn=Gt.cp.range.hi,ss=.5,Ce=Math.round((Yn-rs)/ss)+1,Yt=new Float64Array(Ce),on=new Float64Array(Ce);for(let c=0;c<Ce;c+=1){const t=rs+c*ss-st;Yt[c]=Math.exp(Ua*t+Ga*Math.exp(.01*t))}on[0]=Yt[0]*(rs-st);for(let c=1;c<Ce;c+=1)on[c]=on[c-1]+.5*(Yt[c-1]+Yt[c])*ss;function Tc(c){if(c<=rs)return Yt[0];if(c>=Yn)return Yt[Ce-1];const t=(c-rs)/ss,e=Math.min(Ce-2,t|0);return Yt[e]+(t-e)*(Yt[e+1]-Yt[e])}function pn(c){if(c<=rs)return Yt[0]*(c-st);if(c>=Yn)return on[Ce-1]+Yt[Ce-1]*(c-Yn);const t=(c-rs)/ss,e=Math.min(Ce-2,t|0),s=(t-e)*ss;return on[e]+Yt[e]*s+.5*(Yt[e+1]-Yt[e])*s*s/ss}const Ar=c=>1e3*li*c*Math.exp(nn*c),_r=c=>1e3*Fr*Math.pow(c,rn+1),Pr=Gt.dHsol.v/Ls+ai(pe)-1e3*li*pn(pe);function Sc(c,t){return t>0?(1-t)*Ft(c)+t*Pr+Ar(t)*pn(c)+_r(t)*(c-st):Ft(c)}function Ha(c,t){return t>0?(1-t)*Oe(c)+Ar(t)*Tc(c)+_r(t):Oe(c)}function $a(c,t,e){if(!(t>0))return ec(c);const s=Ar(t),n=_r(t),i=t*Pr,r=1-t;let a=e>200&&e<900?e:st+(c-i)/(4e3*r+800*t);for(let o=0;o<30;o+=1){const f=(r*Ft(a)+i+s*pn(a)+n*(a-st)-c)/(r*Oe(a)+s*Tc(a)+n);if(a-=f,Math.abs(f)<1e-8)break}return a}function Gr(c,t){const e=Math.exp(nn*t),s=1e3*li*e*(t+(1-t)*(1+nn*t)),n=t>0?1e3*Fr*Math.pow(t,rn)*(t+(1-t)*(rn+1)):0;return Pr+s*pn(c)+n*(c-st)}const Wa=Gt.diffusivity.v,Ka=pr(pe);function Hr(c){return Wa*(c/pe)*Ka/pr(c)}function En(c,t){return t>0?Ft(c)-1e3*li*nn*t*t*Math.exp(nn*t)*pn(c)-1e3*Fr*rn*Math.pow(t,rn+1)*(c-st):Ft(c)}const za=1e-6;function Ve(c){var t;return((t=ht[c])==null?void 0:t.id)==="ice"?ie:NaN}function Ws(c){return Ve(c)>0?Ft(ie)-ht[c].cp*(ie-st)-wr:0}function Cc(c,t,e,s){return(c+e*ci)*(s-st)+t*Ft(s)}function kr(c,t,e,s,n){const i=t+s*ci;if(!(i>0))return n;if(e<=0)return st+c/i;let r=n>100?n:st+c/i;for(let a=0;a<3;a+=1)r-=(i*(r-st)+e*Ft(r)-c)/(i+e*Oe(r));return r}class It{constructor(t,e,s,n){v(this,"mat",0);v(this,"heater",-1);v(this,"nr",0);v(this,"xs",[]);v(this,"ys",[]);v(this,"ni",new Int32Array(0));v(this,"nj",new Int32Array(0));v(this,"off",new Int32Array(0));v(this,"ncell",0);v(this,"E",new Float64Array(0));v(this,"film",new Float64Array(0));v(this,"crust",new Float64Array(0));v(this,"x",0);v(this,"y",0);v(this,"a",0);v(this,"vx",0);v(this,"vy",0);v(this,"w",0);v(this,"ux",0);v(this,"uy",0);v(this,"uw",0);v(this,"m",0);v(this,"I",0);v(this,"ma",0);v(this,"Ia",0);v(this,"ma6",new Float64Array(6));v(this,"maOk",!1);v(this,"pinned",!0);v(this,"asleep",!0);v(this,"gone",!1);v(this,"rest",0);v(this,"rx",0);v(this,"ry",0);v(this,"ra",0);v(this,"rmax",0);v(this,"hullA",0);v(this,"hullJ",0);v(this,"nseg",0);v(this,"segR",new Int32Array(0));v(this,"segS",new Uint8Array(0));v(this,"segT0",new Float64Array(0));v(this,"segT1",new Float64Array(0));v(this,"nw",0);v(this,"wk",new Int32Array(0));v(this,"wc",new Int32Array(0));v(this,"ww",new Float64Array(0));v(this,"pq",new Int32Array(2));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}static fromRects(t,e,s,n,i,r,a,o=-1){const l=new It(t,e,s,n);l.mat=i,l.heater=o;const f=[],u=[];for(const[m,p,d,g]of r)!(d>m)||!(g>p)||(f.push(It.splits(m,d,s)),u.push(It.splits(p,g,s)));l.setRects(f,u);const h=ht[i];for(let m=0;m<l.ncell;m+=1)l.E[m]=h.rho*h.cp*l.cellVolume(m)*(a-st);return l.derive(),l.rx=l.x,l.ry=l.y,l.ra=0,l}static splits(t,e,s){const n=Math.max(1,Math.round((e-t)/s)),i=new Float64Array(n+1);for(let r=0;r<=n;r+=1)i[r]=t+(e-t)*r/n;return i[n]=e,i}setRects(t,e){this.nr=t.length,this.xs=t,this.ys=e,this.ni=new Int32Array(this.nr),this.nj=new Int32Array(this.nr),this.off=new Int32Array(this.nr);let s=0;for(let n=0;n<this.nr;n+=1)this.ni[n]=t[n].length-1,this.nj[n]=e[n].length-1,this.off[n]=s,s+=this.ni[n]*this.nj[n];this.ncell=s,this.E=new Float64Array(s),this.film=new Float64Array(s),this.crust=new Float64Array(s)}shiftFrame(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s];for(let r=0;r<n.length;r+=1)n[r]-=t;for(let r=0;r<i.length;r+=1)i[r]-=e}}rectOf(t,e){let s=this.nr-1;for(;s>0&&this.off[s]>t;)s-=1;if(e!==void 0){const n=t-this.off[s];e[0]=n%this.ni[s],e[1]=(n-e[0])/this.ni[s]}return s}cellBox(t,e){const s=this.rectOf(t,this.pq),n=this.pq[0],i=this.pq[1];e[0]=this.xs[s][n],e[1]=this.ys[s][i],e[2]=this.xs[s][n+1],e[3]=this.ys[s][i+1]}cellVolume(t){const e=this.rectOf(t,this.pq),s=this.pq[0],n=this.pq[1];return(this.xs[e][s+1]-this.xs[e][s])*(this.ys[e][n+1]-this.ys[e][n])*this.depth}cellCap(t){const e=ht[this.mat];return e.rho*e.cp*this.cellVolume(t)}cellT(t){return kr(this.E[t],this.cellCap(t),this.film[t],this.crust[t],293.15)}cellAtLocal(t,e){for(let s=0;s<this.nr;s+=1){const n=this.xs[s],i=this.ys[s],r=this.ni[s],a=this.nj[s];if(t<n[0]||t>n[r]||e<i[0]||e>i[a])continue;let o=0;for(;o<r-1&&t>n[o+1];)o+=1;let l=0;for(;l<a-1&&e>i[l+1];)l+=1;return this.off[s]+o+l*r}return-1}insideLocal(t,e,s=0){for(let n=0;n<this.nr;n+=1){const i=this.xs[n],r=this.ys[n];if(t>=i[0]-s&&t<=i[i.length-1]+s&&e>=r[0]-s&&e<=r[r.length-1]+s)return!0}return!1}energy(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.E[e];return t+this.latentOffset()}latentOffset(){const t=Ws(this.mat);return t!==0?t*this.m:0}filmMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.film[e];return t}crustMass(){let t=0;for(let e=0;e<this.ncell;e+=1)t+=this.crust[e];return t}meanT(){let t=0,e=0;for(let s=0;s<this.ncell;s+=1){const n=this.cellCap(s);t+=n,e+=n*this.cellT(s)}return t>0?e/t:0}derive(){if(this.nr===0||this.ncell===0){this.m=0,this.I=0,this.rmax=0,this.nseg=0,this.gone=!0;return}const t=ht[this.mat].rho,e=this.moment(0),s=this.moment(1);if(e!==0||s!==0){this.shiftFrame(e,s);const u=Math.cos(this.a),h=Math.sin(this.a),m=u*e-h*s,p=h*e+u*s;this.x+=m,this.y+=p,this.rx+=m,this.ry+=p}let n=0,i=0,r=0;const a=[];for(let u=0;u<this.nr;u+=1){const[h,m,p,d]=this.bounds(u),g=p-h,x=d-m,b=t*g*x*this.depth,y=.5*(h+p),A=.5*(m+d);n+=b,i+=b*((g*g+x*x)/12+y*y+A*A);for(const[F,P]of[[h,m],[p,m],[p,d],[h,d]])a.push([F,P]),r=Math.max(r,Math.hypot(F,P))}this.m=n,this.I=i,this.rmax=r;const o=Kc(a);let l=0,f=0;for(let u=0;u<o.length;u+=1){const[h,m]=o[u],[p,d]=o[(u+1)%o.length],g=h*d-p*m;l+=g/2,f+=g*(h*h+h*p+p*p+m*m+m*d+d*d)/12}this.hullA=Math.abs(l),this.hullJ=Math.abs(f),this.segments()}moment(t){let e=0,s=0;for(let n=0;n<this.nr;n+=1){const[i,r,a,o]=this.bounds(n),l=(a-i)*(o-r);e+=l,s+=l*(t===0?.5*(i+a):.5*(r+o))}return e>0?s/e:0}segments(){const t=[],e=[],s=[],n=[],i=za*this.dx;for(let r=0;r<this.nr;r+=1){const[a,o,l,f]=this.bounds(r);for(let u=0;u<4;u+=1){const h=u<2,m=u===0?a:u===1?l:u===2?o:f;let p=[h?[o,f]:[a,l]];for(let d=0;d<this.nr&&p.length>0;d+=1){if(d===r)continue;const[g,x,b,y]=this.bounds(d);if(!(u===0?Math.abs(b-m)<=i:u===1?Math.abs(g-m)<=i:u===2?Math.abs(y-m)<=i:Math.abs(x-m)<=i))continue;const F=h?x:g,P=h?y:b,_=[];for(const[w,k]of p){if(P<=w||F>=k){_.push([w,k]);continue}F>w&&_.push([w,F]),P<k&&_.push([P,k])}p=_}for(const[d,g]of p)g-d<=i||(t.push(r),e.push(u),s.push(d),n.push(g))}}this.nseg=t.length,this.segR=Int32Array.from(t),this.segS=Uint8Array.from(e),this.segT0=Float64Array.from(s),this.segT1=Float64Array.from(n)}bounds(t){return[this.xs[t][0],this.ys[t][0],this.xs[t][this.ni[t]],this.ys[t][this.nj[t]]]}segment(t,e){const[s,n,i,r]=this.bounds(this.segR[t]),a=this.segS[t],o=this.segT0[t],l=this.segT1[t];a===0?(e[0]=s,e[1]=o,e[2]=s,e[3]=l,e[4]=-1,e[5]=0):a===1?(e[0]=i,e[1]=o,e[2]=i,e[3]=l,e[4]=1,e[5]=0):a===2?(e[0]=o,e[1]=n,e[2]=l,e[3]=n,e[4]=0,e[5]=-1):(e[0]=o,e[1]=r,e[2]=l,e[3]=r,e[4]=0,e[5]=1)}static toLocal(t,e,s,n,i,r){const a=Math.cos(s),o=Math.sin(s),l=n-t,f=i-e;r[0]=a*l+o*f,r[1]=-o*l+a*f}static toWorld(t,e,s,n,i,r){const a=Math.cos(s),o=Math.sin(s);r[0]=t+a*n-o*i,r[1]=e+o*n+a*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,a=this.y-e;this.x=t+n*r-i*a,this.y=e+i*r+n*a,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}worldBox(t,e,s,n){const i=Math.cos(s),r=Math.sin(s);let a=1/0,o=1/0,l=-1/0,f=-1/0;for(let u=0;u<this.nr;u+=1){const[h,m,p,d]=this.bounds(u);for(let g=0;g<4;g+=1){const x=g===0||g===3?h:p,b=g<2?m:d,y=t+i*x-r*b,A=e+r*x+i*b;y<a&&(a=y),y>l&&(l=y),A<o&&(o=A),A>f&&(f=A)}}n[0]=a,n[1]=o,n[2]=l,n[3]=f}}const Qa=.004,Xa=.02,bn=1e-7,Ya=.22,Ja=2.5;class Za{constructor(t,e){v(this,"nx",0);v(this,"ny",0);v(this,"count",0);v(this,"points",[$r(),$r()]);v(this,"friction");v(this,"bounce");v(this,"touched",!0);v(this,"k11",0);v(this,"k12",0);v(this,"k22",0);v(this,"i11",0);v(this,"i12",0);v(this,"i22",0);v(this,"block",!1);v(this,"h",1/120);v(this,"slop",Qa);v(this,"spec",Xa);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function $r(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function tl(c){const t=c.a,e=c.b,s=[c.points[0].id,c.points[1].id],n=[c.points[0].jn,c.points[1].jn],i=[c.points[0].jt,c.points[1].jt],r=c.count;c.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?el(c,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?Wr(c,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?Wr(c,e,t,!0):sl(c,t,e);for(let a=0;a<c.count;a+=1){const o=c.points[a];o.jn=0,o.jt=0;for(let l=0;l<r;l+=1)if(s[l]===o.id){o.jn=n[l],o.jt=i[l];break}}return c.count}function Jn(c,t,e,s,n){const i=c.points[c.count];i.x=t,i.y=e,i.sep=s,i.id=n,c.count+=1}function el(c,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,a=Math.hypot(i,r);if(a>s+n+c.spec)return;const o=a>1e-9?i/a:0,l=a>1e-9?r/a:1;c.nx=o,c.ny=l,Jn(c,t.x+o*(s-(s+n-a)/2),t.y+l*(s-(s+n-a)/2),a-s-n,0)}function Wr(c,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,a=0;for(let b=0;b<n.n;b+=1){const y=(e.x-t.wx[b])*t.wnx[b]+(e.y-t.wy[b])*t.wny[b];if(y>i+c.spec)return;y>r&&(r=y,a=b)}const o=(a+1)%n.n,l=t.wx[a],f=t.wy[a],u=t.wx[o],h=t.wy[o];let m,p,d,g,x;if(r<1e-9)m=t.wnx[a],p=t.wny[a],x=r-i,d=e.x-m*i,g=e.y-p*i;else{const b=(e.x-l)*(u-l)+(e.y-f)*(h-f),y=(e.x-u)*(l-u)+(e.y-h)*(f-h);if(b<=0||y<=0){const A=b<=0?l:u,F=b<=0?f:h,P=e.x-A,_=e.y-F,w=Math.hypot(P,_);if(w>i+c.spec)return;m=w>1e-9?P/w:t.wnx[a],p=w>1e-9?_/w:t.wny[a],x=w-i,d=A,g=F}else m=t.wnx[a],p=t.wny[a],x=r-i,d=e.x-m*i,g=e.y-p*i}c.nx=s?-m:m,c.ny=s?-p:p,Jn(c,d,g,x,a)}function Kr(c,t){const e=c.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const a=c.wnx[r],o=c.wny[r],l=c.wx[r],f=c.wy[r];let u=1/0;for(let h=0;h<s.n;h+=1){const m=(t.wx[h]-l)*a+(t.wy[h]-f)*o;m<u&&(u=m)}u>n&&(n=u,i=r)}return{sep:n,edge:i}}function sl(c,t,e){const s=Kr(t,e);if(s.sep>c.spec)return;const n=Kr(e,t);if(n.sep>c.spec)return;let i=t,r=e,a=s.edge,o=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,a=n.edge,o=!0);const l=i.shape,f=r.shape;if(l.kind!=="poly"||f.kind!=="poly")return;const u=(a+1)%l.n,h=i.wx[a],m=i.wy[a],p=i.wx[u],d=i.wy[u],g=i.wnx[a],x=i.wny[a];let b=1/0,y=0;for(let V=0;V<f.n;V+=1){const W=r.wnx[V]*g+r.wny[V]*x;W<b&&(b=W,y=V)}const A=(y+1)%f.n;let F=r.wx[y],P=r.wy[y],_=r.wx[A],w=r.wy[A],k=y,M=A;const T=Math.hypot(p-h,d-m)||1,S=(p-h)/T,q=(d-m)/T,L=S*h+q*m,I=S*p+q*d;for(const[V,W]of[[-1,-L],[1,I]]){const N=V*(S*F+q*P)-W,Y=V*(S*_+q*w)-W;if(N>bn&&Y>bn)return;if(N>bn){const J=N/(N-Y);F+=(_-F)*J,P+=(w-P)*J,k=200+a}else if(Y>bn){const J=N/(N-Y);_=F+(_-F)*J,w=P+(w-P)*J,M=300+a}}const O=(o?1e4:0)+a*1e3,D=(F-h)*g+(P-m)*x,R=(_-h)*g+(w-m)*x;c.nx=o?-g:g,c.ny=o?-x:x,D<=c.spec&&Jn(c,F-g*D/2,P-x*D/2,D,O+k),R<=c.spec&&Jn(c,_-g*R/2,w-x*R/2,R,O+M)}function nl(c,t){c.h=t;const e=c.a,s=c.b,n=c.nx,i=c.ny,r=i,a=-n;for(let o=0;o<c.count;o+=1){const l=c.points[o];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const f=l.rax*i-l.ray*n,u=l.rbx*i-l.rby*n,h=e.invM+s.invM+e.invI*f*f+s.invI*u*u;l.massN=h>0?1/h:0;const m=l.rax*a-l.ray*r,p=l.rbx*a-l.rby*r,d=e.invM+s.invM+e.invI*m*m+s.invI*p*p;l.massT=d>0?1/d:0,l.bias=l.sep>0?-l.sep/t:Math.min(Ja,Ya/t*Math.max(0,-l.sep-c.slop));const g=s.vx-s.w*l.rby-e.vx+e.w*l.ray,x=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,b=g*n+x*i;l.bounce=b<-.6&&(l.sep<=c.slop||l.sep+b*t<0)?-c.bounce*b:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(c.block=!1,c.count===2){const o=c.points[0],l=c.points[1],f=o.rax*i-o.ray*n,u=o.rbx*i-o.rby*n,h=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,p=e.invM+s.invM;c.k11=p+e.invI*f*f+s.invI*u*u,c.k22=p+e.invI*h*h+s.invI*m*m,c.k12=p+e.invI*f*h+s.invI*u*m;const d=c.k11*c.k22-c.k12*c.k12;c.k11*c.k11<1e3*d&&d>0&&(c.block=!0,c.i11=c.k22/d,c.i12=-c.k12/d,c.i22=c.k11/d)}}function il(c){const t=c.ny,e=-c.nx;for(let s=0;s<c.count;s+=1){const n=c.points[s];cn(c.a,c.b,n.jn*c.nx+n.jt*t,n.jn*c.ny+n.jt*e,n)}}function rl(c){const t=c.a,e=c.b,s=c.nx,n=c.ny,i=n,r=-s;for(let a=0;a<c.count;a+=1){const o=c.points[a],l=e.vx-e.w*o.rby-t.vx+t.w*o.ray,f=e.vy+e.w*o.rbx-t.vy-t.w*o.rax,u=l*i+f*r,h=c.friction*o.jn,m=Math.max(-h,Math.min(h,o.jt-o.massT*u)),p=m-o.jt;o.jt=m,cn(t,e,p*i,p*r,o)}if(c.block){ol(c);return}for(let a=0;a<c.count;a+=1){const o=c.points[a],l=e.vx-e.w*o.rby-t.vx+t.w*o.ray,f=e.vy+e.w*o.rbx-t.vy-t.w*o.rax,u=l*s+f*n;o.bounce===0&&c.bounce>=.5&&u<-.6&&(o.sep<=c.slop||o.sep+u*c.h<0)&&(o.bounce=-c.bounce*u);const h=Math.max(o.jn+o.massN*(-u+Ki(o)),o.fixed),m=h-o.jn;o.jn=h,cn(t,e,m*s,m*n,o),o.bounce>0&&(o.fixed=h,o.bounce=-1,o.kicked=!0)}}const Ki=c=>c.bounce>0?Math.max(c.bias,c.bounce):c.bias;function cn(c,t,e,s,n){c.vx-=c.invM*e,c.vy-=c.invM*s,c.w-=c.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function ol(c){const t=c.a,e=c.b,s=c.nx,n=c.ny,i=c.points[0],r=c.points[1],a=d=>{const g=e.vx-e.w*d.rby-t.vx+t.w*d.ray,x=e.vy+e.w*d.rbx-t.vy-t.w*d.rax;return g*s+x*n},o=i.jn,l=r.jn,f=a(i)-Ki(i)-(c.k11*o+c.k12*l),u=a(r)-Ki(r)-(c.k12*o+c.k22*l),h=(d,g)=>{const x=d-o,b=g-l;cn(t,e,x*s,x*n,i),cn(t,e,b*s,b*n,r),i.jn=d,r.jn=g};let m=-(c.i11*f+c.i12*u),p=-(c.i12*f+c.i22*u);if(m>=0&&p>=0){h(m,p);return}if(m=-f/c.k11,p=0,m>=0&&c.k12*m+u>=0){h(m,p);return}if(m=0,p=-u/c.k22,p>=0&&c.k12*p+f>=0){h(m,p);return}f>=0&&u>=0&&h(0,0)}const cl=10,Vs={friction:.5,bounce:.1},al=.01;function Ge(c,t,e,s){const n=new Float64Array([c,e,e,c]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),a=new Float64Array([-1,0,1,0]);let o=0;for(let l=0;l<4;l+=1)o=Math.max(o,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:a,n:4,radius:o}}class ls{constructor(t,e,s,n){v(this,"wx");v(this,"wy");v(this,"wnx");v(this,"wny");v(this,"minX",0);v(this,"minY",0);v(this,"maxX",0);v(this,"maxY",0);v(this,"invM",0);v(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let a=1/0,o=1/0,l=-1/0,f=-1/0;for(let u=0;u<t.n;u+=1){const h=s+i*t.xs[u]-r*t.ys[u],m=n+r*t.xs[u]+i*t.ys[u];this.wx[u]=h,this.wy[u]=m,this.wnx[u]=i*t.nx[u]-r*t.ny[u],this.wny[u]=r*t.nx[u]+i*t.ny[u],h<a&&(a=h),h>l&&(l=h),m<o&&(o=m),m>f&&(f=m)}this.minX=a,this.minY=o,this.maxX=l,this.maxY=f}}class ll{constructor(t){v(this,"parts",[]);v(this,"byBody",[]);v(this,"builtFor",-1);v(this,"warmKey",new Float64Array(0));v(this,"warmData",new Float64Array(0));v(this,"warmCount",0);v(this,"touching",new Uint8Array(0));v(this,"toWake",[]);v(this,"cache",new Map);v(this,"live",[]);v(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}reshape(t){if(this.builtFor<0)return;const e=this.byBody[t.index];if(e===void 0||e.length!==t.nr){this.invalidate();return}for(let s=0;s<t.nr;s+=1){const[n,i,r,a]=t.bounds(s);e[s].shape=Ge(n,i,r,a),e[s].update()}}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new ls(1,null,Ge(-1,-1,0,r+1),Vs)),s.openR||n.push(new ls(2,null,Ge(i,-1,i+1,r+1),Vs)),s.openB||n.push(new ls(3,null,Ge(-1,-1,i+1,0),Vs)),s.openT||n.push(new ls(4,null,Ge(-1,r,i+1,r+1),Vs));const{nx:a,ny:o,dx:l}=s;let f=new Map,u=10;for(let h=0;h<=o;h+=1){const m=new Map;if(h<o){let p=0;for(;p<a;){const d=p+h*a;if(s.solid[d]===0||s.owner[d]!==0){p+=1;continue}const g=s.solid[d];let x=p;for(;x+1<a&&s.solid[x+1+h*a]===g&&s.owner[x+1+h*a]===0;)x+=1;const b=g<<24|p<<12|x;m.set(b,f.has(b)?f.get(b):h),p=x+1}}for(const[p,d]of f){if(m.get(p)===d)continue;const g=this.solidMaterial(p>>>24);n.push(new ls(u++,null,Ge((p>>12&4095)*l,d*l,((p&4095)+1)*l,h*l),g))}f=m}this.byBody=t.map(()=>[]);for(const h of t){if(h.gone)continue;const m=this.solidMaterial(h.mat+1);for(let p=0;p<h.nr;p+=1){const[d,g,x,b]=h.bounds(p),y=Ge(d,g,x,b),A=new ls(1e5+h.index*1e3+p,h,y,m);n.push(A),this.byBody[h.index].push(A)}}for(const h of n)h.update();this.parts=n,this.builtFor=e}solidMaterial(t){const e=ht[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:Vs}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const f of this.parts){const u=f.body;if(u===null)continue;const h=u.awake;f.invM=h?1/u.m:0,f.invI=h?1/u.I:0,f.update()}for(const f of this.cache.values())f.touched=!1;const r=this.live,a=this.liveKey;r.length=0,a.length=0;const o=this.parts;for(let f=0;f<o.length;f+=1){const u=o[f];for(let h=f+1;h<o.length;h+=1){const m=o[h],p=u.invM>0,d=m.invM>0;if(!p&&!d||u.body!==null&&u.body===m.body||m.minX>u.maxX+i||m.maxX<u.minX-i||m.minY>u.maxY+i||m.maxY<u.minY-i)continue;const g=u.id*1e6+m.id;let x=this.cache.get(g);x===void 0&&(x=new Za(u,m),x.slop=n,x.spec=i,this.restore(x,g),this.cache.set(g,x)),x.touched=!0,tl(x)>0?(r.push(x),a.push(g)):x.count=0}}const l=a.map((f,u)=>u).sort((f,u)=>a[f]-a[u]);for(const f of l)nl(r[f],t);for(const f of l)il(r[f]);for(let f=0;f<cl;f+=1)for(const u of l)rl(r[u]);for(const f of l){const u=r[f],h=u.a.body,m=u.b.body;if(h!==null&&(this.touching[h.index]=1),m!==null&&(this.touching[m.index]=1),h!==null&&m!==null&&h.asleep!==m.asleep&&!h.pinned&&!m.pinned){const p=h.asleep?m:h,d=h.asleep?h:m;p.speed()>al&&this.toWake.push(d.index)}}for(const[f,u]of this.cache)(!u.touched||u.count===0)&&this.cache.delete(f);this.save(l.map(f=>a[f]),l.map(f=>r[f]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let a=0;a<2;a+=1){const o=i.points[a];this.warmData[r+1+4*a]=o.id,this.warmData[r+2+4*a]=o.jn,this.warmData[r+3+4*a]=o.jt,this.warmData[r+4+4*a]=o.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const a=9*i;t.count=this.warmData[a];for(let o=0;o<2;o+=1){const l=t.points[o];l.id=this.warmData[a+1+4*o],l.jn=this.warmData[a+2+4*o],l.jt=this.warmData[a+3+4*o],l.kicked=this.warmData[a+4+4*o]===1}return}r<e?s=i+1:n=i-1}}}const ve=new Float64Array(16),ye=new Float64Array(16),Fn=new Float64Array(16),An=new Float64Array(16);function _n(c,t,e,s,n,i,r,a){let o=0;for(let l=0;l<c;l+=1){const f=(l+1)%c,u=s*((t===0?n[l]:i[l])-e),h=s*((t===0?n[f]:i[f])-e);if(u<=0&&(r[o]=n[l],a[o]=i[l],o+=1),u<0&&h>0||u>0&&h<0){const m=u/(u-h);r[o]=n[l]+m*(n[f]-n[l]),a[o]=i[l]+m*(i[f]-i[l]),o+=1}}return o}function fl(c,t,e,s,n,i,r,a,o,l,f,u){ve[0]=c,ye[0]=t,ve[1]=e,ye[1]=s,ve[2]=n,ye[2]=i,ve[3]=r,ye[3]=a;let h=_n(4,0,o,-1,ve,ye,Fn,An);if(h===0||(h=_n(h,0,f,1,Fn,An,ve,ye),h===0)||(h=_n(h,1,l,-1,ve,ye,Fn,An),h===0)||(h=_n(h,1,u,1,Fn,An,ve,ye),h<3))return 0;let m=0;for(let p=0;p<h;p+=1){const d=(p+1)%h;m+=ve[p]*ye[d]-ve[d]*ye[p]}return Math.abs(.5*m)}function zi(c,t,e,s,n,i,r,a,o){const l=e-c,f=s-t;return fe[0]=0,fe[1]=1,!Pn(-l,c-n)||!Pn(l,r-c)||!Pn(-f,t-i)||!Pn(f,a-t)?(o[0]=1,o[1]=0,0):(o[0]=fe[0],o[1]=fe[1],Math.max(0,fe[1]-fe[0]))}const fe=new Float64Array(2);function Pn(c,t){if(c===0)return t>=0;const e=t/c;if(c<0){if(e>fe[1])return!1;e>fe[0]&&(fe[0]=e)}else{if(e<fe[0])return!1;e<fe[1]&&(fe[1]=e)}return!0}const xi=new Float64Array(2),kn=new Float64Array(16);function ul(c,t,e,s,n,i,r,a,o,l,f){const u=Math.cos(e),h=Math.sin(e);let m=0;for(let g=0;g<4;g+=1){const x=g===0?a:g===1||g===2?l:a,b=g===0||g===1?o:f,y=g===0||g===1?l:a,A=g===0?o:g===1||g===2?f:o,F=u*(x-c)+h*(b-t),P=-h*(x-c)+u*(b-t),_=u*(y-c)+h*(A-t),w=-h*(y-c)+u*(A-t);zi(F,P,_,w,s,n,i,r,xi)<=0||(kn[2*m]=g+xi[0],kn[2*m+1]=g+xi[1],m+=1)}if(m<2)return!1;const p=1e-9;let d=m;for(let g=0;g<m;g+=1){const x=(g+1)%m,b=kn[2*g+1],y=kn[2*x]+(x===0?4:0);Math.abs(y-b)<=p&&(d-=1)}return d>=2}function hl(c,t,e){const s=[],n=[];for(const d of c)s.push(d[0],d[2]),n.push(d[1],d[3]);for(const d of t)s.push(d.x0,d.x1),n.push(d.y0,d.y1);for(const d of e)s.push(d.x0,d.x1),n.push(d.y0,d.y1);const i=zr(s),r=zr(n),a=i.length-1,o=r.length-1,l=new Uint8Array(Math.max(0,a*o)),f=[],u=[],h=(d,g,x,b,y,A)=>d>x&&d<y&&g>b&&g<A;for(let d=0;d<o;d+=1){const g=.5*(r[d]+r[d+1]);for(let x=0;x<a;x+=1){const b=.5*(i[x]+i[x+1]);let y=!1;for(const F of c)if(h(b,g,F[0],F[1],F[2],F[3])){y=!0;break}let A=-1;if(y){for(const F of t)if(h(b,g,F.x0,F.y0,F.x1,F.y1)){A=F.move;break}A>=0?f.push(i[x],r[d],i[x+1],r[d+1],A):l[x+d*a]=1}else{for(const F of e)if(h(b,g,F.x0,F.y0,F.x1,F.y1)){A=F.move;break}A>=0&&(u.push(i[x],r[d],i[x+1],r[d+1],A),l[x+d*a]=1)}}}const m=[];let p=[];for(let d=0;d<=o;d+=1){const g=[];if(d<o)for(let x=0;x<a;){if(l[x+d*a]===0){x+=1;continue}let b=x;for(;b<a&&l[b+d*a]!==0;)b+=1;const y=p.find(A=>A.i0===x&&A.i1===b);g.push(y??{i0:x,i1:b,y0:r[d]}),x=b}for(const x of p)g.includes(x)||m.push([i[x.i0],x.y0,i[x.i1],r[d]]);p=g}return{rects:m,taken:f,added:u}}function zr(c){c.sort((e,s)=>e-s);const t=[];for(const e of c)(t.length===0||e!==t[t.length-1])&&t.push(e);return t}const dl=.99,Qr=.5,ml=.02;class pl{constructor(t){v(this,"w");v(this,"esSync");v(this,"filmSync");v(this,"crustSync");v(this,"wsum");v(this,"best");v(this,"acc");v(this,"split");v(this,"was");v(this,"now");v(this,"stamp");v(this,"fstamp");v(this,"tag",0);v(this,"ftag",0);v(this,"seen");v(this,"queue");v(this,"seenTag",0);v(this,"list",new Int32Array(256));v(this,"listN",0);v(this,"box",new Float64Array(4));v(this,"l0",new Float64Array(2));v(this,"l1",new Float64Array(2));v(this,"wp",new Float64Array(2));v(this,"seg",new Float64Array(2));v(this,"cb",new Float64Array(4));v(this,"areaK",[]);v(this,"capK",[]);v(this,"splits",[]);v(this,"boxes",new Float64Array(64));v(this,"nx",0);v(this,"ny",0);v(this,"faceOwner");v(this,"topologyChanged",!1);this.w=t;const e=t.grid.n;this.faceOwner=new Int16Array(t.grid.nu+t.grid.nv),this.esSync=new Float64Array(e),this.filmSync=new Float64Array(e),this.crustSync=new Float64Array(e),this.wsum=new Float64Array(e),this.best=new Float64Array(e),this.acc=new Float64Array(e),this.split=new Uint8Array(e),this.was=new Uint8Array(e),this.now=new Uint8Array(e),this.stamp=new Int32Array(e),this.fstamp=new Int32Array(t.grid.nu+t.grid.nv),this.seen=new Int32Array(e),this.queue=new Int32Array(e)}boxOf(t){return this.boxes.subarray(4*t.index,4*t.index+4)}weigh(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e;if(this.boxes.length<4*(t.index+1)){const p=new Float64Array(8*(t.index+1));p.set(this.boxes),this.boxes=p}const r=this.boxOf(t);if(t.gone||t.ncell===0){t.nw=0,this.splits[t.index]=new Int32Array(0),r[0]=1,r[1]=1,r[2]=0,r[3]=0;return}t.worldBox(t.x,t.y,t.a,r);let a=this.areaK[t.index],o=this.capK[t.index];(a===void 0||a.length!==t.ncell)&&(a=new Float64Array(t.ncell),o=new Float64Array(t.ncell),this.areaK[t.index]=a,this.capK[t.index]=o);for(let p=0;p<t.ncell;p+=1)a[p]=t.cellVolume(p)/t.depth,o[p]=t.cellCap(p);const l=Math.cos(t.a),f=Math.sin(t.a);let u=0;const h=this.cb,m=[];for(let p=0;p<t.ncell;p+=1){t.cellBox(p,h);const d=h[0],g=h[1],x=h[2],b=h[3],y=t.x+l*d-f*g,A=t.y+f*d+l*g,F=t.x+l*x-f*g,P=t.y+f*x+l*g,_=t.x+l*x-f*b,w=t.y+f*x+l*b,k=t.x+l*d-f*b,M=t.y+f*d+l*b,T=Math.max(0,Math.floor(Math.min(y,F,_,k)/i)),S=Math.min(s-1,Math.floor(Math.max(y,F,_,k)/i)),q=Math.max(0,Math.floor(Math.min(A,P,w,M)/i)),L=Math.min(n-1,Math.floor(Math.max(A,P,w,M)/i));for(let I=q;I<=L;I+=1)for(let O=T;O<=S;O+=1){const D=O+I*s;if(e.solid[D]!==0&&e.owner[D]===0)continue;const R=fl(y,A,F,P,_,w,k,M,O*i,I*i,(O+1)*i,(I+1)*i);R<=1e-12*a[p]||(u>=t.wk.length&&this.growWeights(t,2*u+64),t.wk[u]=p,t.wc[u]=D,t.ww[u]=R/a[p],u+=1)}}t.nw=u;for(let p=0;p<t.nr;p+=1){const d=t.xs[p][0],g=t.ys[p][0],x=t.xs[p][t.ni[p]],b=t.ys[p][t.nj[p]];let y=1/0,A=1/0,F=-1/0,P=-1/0;for(let T=0;T<4;T+=1){const S=T===0||T===3?d:x,q=T<2?g:b,L=t.x+l*S-f*q,I=t.y+f*S+l*q;y=Math.min(y,L),F=Math.max(F,L),A=Math.min(A,I),P=Math.max(P,I)}const _=Math.max(0,Math.floor(y/i)),w=Math.min(s-1,Math.floor(F/i)),k=Math.max(0,Math.floor(A/i)),M=Math.min(n-1,Math.floor(P/i));for(let T=k;T<=M;T+=1)for(let S=_;S<=w;S+=1)ul(t.x,t.y,t.a,d,g,x,b,S*i,T*i,(S+1)*i,(T+1)*i)&&m.push(S+T*s)}this.splits[t.index]=Int32Array.from(m)}growWeights(t,e){const s=new Int32Array(e),n=new Int32Array(e),i=new Float64Array(e);s.set(t.wk.subarray(0,Math.min(t.wk.length,e))),n.set(t.wc.subarray(0,Math.min(t.wc.length,e))),i.set(t.ww.subarray(0,Math.min(t.ww.length,e))),t.wk=s,t.wc=n,t.ww=i}addCells(t){for(let s=0;s<t.nw;s+=1)this.push(t.wc[s]);const e=this.splits[t.index];if(e!==void 0)for(let s=0;s<e.length;s+=1)this.push(e[s])}addAll(){const t=this.w.grid.n;for(let e=0;e<t;e+=1)this.push(e)}push(t){if(this.stamp[t]!==this.tag+1){if(this.stamp[t]=this.tag+1,this.listN>=this.list.length){const e=new Int32Array(2*this.list.length);e.set(this.list),this.list=e}this.list[this.listN++]=t}}get pending(){return this.listN>0}pendingBox(){const t=this.w.grid.nx;let e=1/0,s=1/0,n=-1/0,i=-1/0;for(let r=0;r<this.listN;r+=1){const a=this.list[r],o=a%t,l=(a-o)/t;o<e&&(e=o),o>n&&(n=o),l<s&&(s=l),l>i&&(i=l)}return[e,s,n,i]}rebuild(t){const e=this.w.grid,{nx:s,ny:n,dx:i}=e,r=++this.tag,a=this.list,o=this.listN;if(this.listN=0,o===0)return 0;const l=1/(i*i);let f=s,u=-1,h=n,m=-1;for(let F=0;F<o;F+=1){const P=a[F],_=P%s,w=(P-_)/s;_<f&&(f=_),_>u&&(u=_),w<h&&(h=w),w>m&&(m=w);const k=e.solid[P]!==0&&e.owner[P]===0;this.was[P]=e.solid[P]!==0&&e.owner[P]!==0?1:0,e.fs[P]=0,e.capB[P]=0,this.wsum[P]=0,this.best[P]=0,this.split[P]=0,e.matB[P]=0,k||(e.Es[P]=0,e.film[P]=0,e.crust[P]=0,e.owner[P]=0)}const p=f*i,d=h*i,g=(u+1)*i,x=(m+1)*i;for(const F of t){if(F.gone||F.nw===0)continue;const P=this.boxOf(F);if(P[0]>g||P[2]<p||P[1]>x||P[3]<d)continue;const _=this.areaK[F.index],w=this.capK[F.index],k=this.acc;for(let T=0;T<F.nw;T+=1){const S=F.wc[T];if(this.stamp[S]!==r)continue;const q=F.wk[T],L=F.ww[T],I=L*_[q]*l;e.fs[S]+=I,k[S]+=I,e.capB[S]+=L*w[q],e.Es[S]+=L*F.E[q],e.film[S]+=L*F.film[q],e.crust[S]+=L*F.crust[q],this.wsum[S]+=L}for(let T=0;T<F.nw;T+=1){const S=F.wc[T];this.stamp[S]!==r||k[S]===0||(k[S]>this.best[S]&&(this.best[S]=k[S],e.owner[S]=F.index+1,e.matB[S]=F.mat+1),k[S]=0)}const M=this.splits[F.index];for(let T=0;T<M.length;T+=1)this.stamp[M[T]]===r&&(this.split[M[T]]=1)}const b=++this.ftag;for(let F=0;F<o;F+=1){const P=a[F],_=P%s,w=(P-_)/s;this.face(t,_,w,!0,b),this.face(t,_+1,w,!0,b),this.face(t,_,w,!1,b),this.face(t,_,w+1,!1,b)}for(let F=0;F<o;F+=1){const P=a[F];e.fs[P]>1&&(e.fs[P]=1);const _=e.solid[P]!==0&&e.owner[P]===0&&this.was[P]===0;this.now[P]=!_&&e.owner[P]!==0&&(e.fs[P]>=dl||this.split[P]!==0)?1:0}for(let F=0;F<o;F+=1){const P=a[F];this.now[P]!==0||e.owner[P]===0||e.fs[P]<Qr||e.solid[P]!==0&&this.was[P]===0||this.besideOther(P)&&(this.now[P]=1)}let y=0;for(let F=0;F<o;F+=1){const P=a[F];if(this.now[P]===1){this.was[P]===0&&(y+=1,this.gasOut(P));const _=t[e.owner[P]-1];e.solid[P]=_.mat+1,e.kind[P]=ft,e.role[P]=0,e.heater[P]=-1}else this.was[P]===1&&(y+=1,e.solid[P]=0,e.role[P]=0,e.heater[P]=-1,this.vacate(P))}const A=this.w.heat;for(let F=0;F<o;F+=1){const P=a[F];this.esSync[P]=e.Es[P],this.filmSync[P]=e.film[P],this.crustSync[P]=e.crust[P],e.capB[P]>0&&A.deriveSolid(P)}return y}besideOther(t){const e=this.w.grid,{nx:s,ny:n}=e,i=t%s,r=(t-i)/s,a=e.owner[t];for(let o=0;o<4;o+=1){const l=i+(o===0?-1:o===1?1:0),f=r+(o===2?-1:o===3?1:0);if(l<0||f<0||l>=s||f>=n){if(l<0?!e.openL:l>=s?!e.openR:f<0?!e.openB:!e.openT)return!0;continue}const u=l+f*s;if(e.solid[u]!==0&&e.owner[u]===0||e.owner[u]!==0&&e.owner[u]!==a&&(e.solid[u]!==0||e.fs[u]>=Qr))return!0}return!1}face(t,e,s,n,i){const r=this.w.grid,{nx:a,ny:o,dx:l}=r;if(n?e>a||s>=o:e>=a||s>o)return;const f=n?e+s*(a+1):e+s*a,u=n?f:r.nu+f;if(this.fstamp[u]===i)return;this.fstamp[u]=i;const h=e*l,m=s*l,p=n?h:h+l,d=n?m+l:m;let g=0,x=0,b=0,y=0;const A=this.l0,F=this.l1;for(const w of t){if(w.gone||w.nw===0)continue;const k=this.boxOf(w);if(k[0]>Math.max(h,p)||k[2]<Math.min(h,p)||k[1]>Math.max(m,d)||k[3]<Math.min(m,d))continue;It.toLocal(w.x,w.y,w.a,h,m,A),It.toLocal(w.x,w.y,w.a,p,d,F);let M=0;for(let T=0;T<w.nr;T+=1){const S=w.xs[T][0],q=w.ys[T][0],L=w.xs[T][w.ni[T]],I=w.ys[T][w.nj[T]];M+=zi(A[0],A[1],F[0],F[1],S,q,L,I,this.seg)}if(!(M<=0)&&(g+=M,M>x)){x=M,y=w.index+1;const T=.5*(h+p),S=.5*(m+d);b=n?w.vx-w.w*(S-w.y):w.vy+w.w*(T-w.x)}}const P=g>=1-1e-9?0:Math.max(0,1-g);(n?r.au[f]:r.av[f])>0!=P>0&&(this.topologyChanged=!0),this.faceOwner[u]=y,n?(r.au[f]=P,r.usol[f]=g>0?b:0):(r.av[f]=P,r.vsol[f]=g>0?b:0)}collect(t){const e=this.w.grid;for(const s of t){if(s.gone||s.nw===0)continue;const n=this.capK[s.index],i=yi(0,s.ncell),r=yi(1,s.ncell),a=yi(2,s.ncell);let o=!1;for(let l=0;l<s.nw;l+=1){const f=s.wc[l],u=s.wk[l],h=s.ww[l],m=e.Es[f]-this.esSync[f];m!==0&&e.capB[f]>0&&(i[u]+=m*h*n[u]/e.capB[f],o=!0);const p=e.film[f]-this.filmSync[f];p>0&&this.wsum[f]>0?(r[u]+=p*h/this.wsum[f],o=!0):p<0&&this.filmSync[f]>0&&(r[u]+=p*h*s.film[u]/this.filmSync[f],o=!0);const d=e.crust[f]-this.crustSync[f];d>0&&this.wsum[f]>0?(a[u]+=d*h/this.wsum[f],o=!0):d<0&&this.crustSync[f]>0&&(a[u]+=d*h*s.crust[u]/this.crustSync[f],o=!0)}if(o)for(let l=0;l<s.ncell;l+=1)s.E[l]+=i[l],s.film[l]=Math.max(0,s.film[l]+r[l]),s.crust[l]=Math.max(0,s.crust[l]+a[l])}for(let s=0;s<e.n;s+=1)e.capB[s]<=0||(this.esSync[s]=e.Es[s],this.filmSync[s]=e.film[s],this.crustSync[s]=e.crust[s])}release(t){this.addCells(t),t.nw=0,this.splits[t.index]=new Int32Array(0)}pushOut(t,e,s,n){const i=this.w.grid,r=this.w.particles,a=this.w.bubbles,o=this.box;t.worldBox(t.x,t.y,t.a,o);const l=2*i.dx;for(let f=0;f<r.count;f+=1){const u=r.x[f],h=r.y[f];u<o[0]-l||u>o[2]+l||h<o[1]-l||h>o[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(r.x[f]=this.wp[0],r.y[f]=this.wp[1],this.stopInto(t,r.vx,r.vy,f))}for(let f=0;f<a.count;f+=1){const u=a.x[f],h=a.y[f];u<o[0]-l||u>o[2]+l||h<o[1]-l||h>o[3]+l||this.moveOut(t,u,h,u,h,e,s,n)&&(a.x[f]=this.wp[0],a.y[f]=this.wp[1],a.site[f]=-1,this.stopInto(t,a.vx,a.vy,f))}}hit(t,e,s,n,i,r){const a=2*this.w.grid.dx;let o=0,l=n,f=i;for(let u=0;u<3;u+=1){let h=!1;for(const m of t){if(m.gone||m.nw===0)continue;const p=this.boxOf(m);Math.max(l,e)<p[0]-a||Math.min(l,e)>p[2]+a||Math.max(f,s)<p[1]-a||Math.min(f,s)>p[3]+a||this.moveOut(m,l,f,e,s,m.x,m.y,m.a)&&(l=this.wp[0],f=this.wp[1],r[0]=l,r[1]=f,r[2]=this.nx,r[3]=this.ny,r[4]=m.vx-m.w*(f-m.y),r[5]=m.vy+m.w*(l-m.x),o=1,h=!0)}if(!h)break}return o}moveOut(t,e,s,n,i,r,a,o){const l=this.l1,f=this.l0;It.toLocal(t.x,t.y,t.a,e,s,l),It.toLocal(r,a,o,n,i,f);const u=ml*this.w.grid.dx;let h=1/0,m=-1,p=l[0],d=l[1];for(let w=0;w<t.nr;w+=1){const k=t.xs[w][0],M=t.ys[w][0],T=t.xs[w][t.ni[w]],S=t.ys[w][t.nj[w]],q=k-u,L=M-u,I=T+u,O=S+u,D=l[0]>q&&l[0]<I&&l[1]>L&&l[1]<O;if(zi(f[0],f[1],l[0],l[1],q,L,I,O,this.seg)<=0&&!D)continue;if(f[0]>q&&f[0]<I&&f[1]>L&&f[1]<O){if(D&&h===1/0){const V=Xr(l[0]-q,I-l[0],l[1]-L,O-l[1]);m=V,p=V===0?q:V===1?I:l[0],d=V===2?L:V===3?O:l[1],h=2}}else{const V=this.seg[0];if(V<h){h=V;const W=f[0]+V*(l[0]-f[0]),N=f[1]+V*(l[1]-f[1]),Y=Xr(Math.abs(W-q),Math.abs(W-I),Math.abs(N-L),Math.abs(N-O));m=Y,p=Y===0?q:Y===1?I:W,d=Y===2?L:Y===3?O:N}}}if(m<0)return!1;const g=this.w.grid,x=1e-4*g.dx,b=Math.cos(t.a),y=Math.sin(t.a),A=m===0?-1:m===1?1:0,F=m===2?-1:m===3?1:0,P=p+A*x,_=d+F*x;return this.wp[0]=Math.min(g.w-x,Math.max(x,t.x+b*P-y*_)),this.wp[1]=Math.min(g.h-x,Math.max(x,t.y+y*P+b*_)),this.nx=b*A-y*F,this.ny=y*A+b*F,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,a=t.vx-t.w*r,o=t.vy+t.w*i,l=(e[n]-a)*this.nx+(s[n]-o)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}gasOut(t){const e=this.w.grid,s=this.w.gas;if(s.massOf(t)<=0&&e.Hg[t]===0)return;const{nx:n,ny:i}=e,r=t%n,a=(t-r)/n,o=g=>(this.stamp[g]===this.tag?this.now[g]===0:e.solid[g]===0)&&!(e.solid[g]!==0&&e.owner[g]===0);let l=0,f=0;for(let g=0;g<4;g+=1){const x=s.across(t,r,a,g);x<0||!o(x)||(l+=s.vgas[x]>0?s.vgas[x]:e.vCell,f+=1)}if(f>0){let g=l;for(let x=0;x<4;x+=1){const b=s.across(t,r,a,x);if(b<0||!o(b))continue;const y=s.vgas[b]>0?s.vgas[b]:e.vCell;f-=1,s.move(t,b,f===0?1:Math.min(1,y/g)),g-=y}return}const u=this.seen,h=this.queue;let m=++this.seenTag,p=0,d=0;for(h[d++]=t,u[t]=m;p<d;){const g=h[p++];if(g!==t&&o(g)){s.move(t,g,1);return}const x=g%n,b=(g-x)/n;for(let y=0;y<4;y+=1){const A=s.across(g,x,b,y);A<0||u[A]===m||e.solid[A]!==0&&e.owner[A]===0||(u[A]=m,h[d++]=A)}}for(m=++this.seenTag,p=0,d=0,h[d++]=t,u[t]=m;p<d;){const g=h[p++];if(g!==t&&o(g)){s.move(t,g,1);return}const x=g%n,b=(g-x)/n;for(let y=0;y<4;y+=1){const A=x+(y===0?-1:y===1?1:0),F=b+(y===2?-1:y===3?1:0);if(A<0||F<0||A>=n||F>=i)continue;const P=A+F*n;u[P]!==m&&(u[P]=m,h[d++]=P)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n}=e,i=t%n,r=(t-i)/n;let a=0,o=0,l=0,f=!1;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||(e.kind[m]===et&&(f=!0),e.kind[m]!==H||s.massOf(m)<=0))continue;const p=s.vgas[m]>0?s.vgas[m]:e.vCell;a+=p,o+=p*s.rho[m],l+=p*e.T[m]}if(a<=0){e.kind[t]=f?et:H,s.deriveCell(t);return}e.kind[t]=H,e.T[t]=l/a;const u=o/a*Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;for(let h=0;h<4;h+=1){const m=s.across(t,i,r,h);if(m<0||e.kind[m]!==H)continue;const p=s.massOf(m);if(p<=0)continue;const d=(s.vgas[m]>0?s.vgas[m]:e.vCell)/a;s.move(m,t,Math.min(.25,u*d/p))}s.deriveCell(t)}}function Xr(c,t,e,s){let n=0,i=c;return t<i&&(n=1,i=t),e<i&&(n=2,i=e),s<i&&(n=3),n}const vi=[new Float64Array(64),new Float64Array(64),new Float64Array(64)];function yi(c,t){vi[c].length<t&&(vi[c]=new Float64Array(2*t));const e=vi[c];return e.fill(0,0,t),e}const gl=1.5,xl=1;class vl{constructor(t){v(this,"pe");v(this,"re");v(this,"known");v(this,"mass");v(this,"vol");v(this,"out",new Float64Array(3));v(this,"front");v(this,"next");v(this,"vp");v(this,"vr");v(this,"queued");v(this,"tag",0);v(this,"sg",new Float64Array(6));this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:a,ny:o,n:l,dx:f}=e,{pe:u,re:h,known:m,mass:p,vol:d}=this;p.fill(0),d.fill(0);for(let w=0;w<s.count;w+=1){const k=e.cellAt(s.x[w],s.y[w]);k<0||(p[k]+=s.mass[w],d[k]+=s.mass[w]/s.rho[w])}for(let w=0;w<l;w+=1){const k=e.kind[w];k===et?(u[w]=e.pl[w],h[w]=d[w]>0?p[w]/d[w]:n.rhoRef,m[w]=1):k===H&&e.solid[w]===0?(u[w]=n.pGas[w]+e.pg[w],h[w]=i.rho[w]>0?i.rho[w]:r.rhoAmb,m[w]=1):(u[w]=0,h[w]=0,m[w]=0)}const g=t.gy*f,x=this.front,b=this.next,y=this.vp,A=this.vr,F=this.queued,P=++this.tag;let _=0;for(let w=0;w<l;w+=1){if(m[w]!==0)continue;const k=w%a,M=(w-k)/a;(k>0&&m[w-1]===1||k<a-1&&m[w+1]===1||M>0&&m[w-a]===1||M<o-1&&m[w+a]===1)&&(x[_++]=w,F[w]=P)}for(;_>0;){for(let k=0;k<_;k+=1){const M=x[k],T=M%a,S=(M-T)/a;let q=0,L=0,I=0;T>0&&m[M-1]!==0&&(q+=u[M-1],L+=h[M-1],I+=1),T<a-1&&m[M+1]!==0&&(q+=u[M+1],L+=h[M+1],I+=1),S>0&&m[M-a]!==0&&(q+=u[M-a]-h[M-a]*g,L+=h[M-a],I+=1),S<o-1&&m[M+a]!==0&&(q+=u[M+a]+h[M+a]*g,L+=h[M+a],I+=1),y[k]=I>0?q/I:0,A[k]=I>0?L/I:0}let w=0;for(let k=0;k<_;k+=1){const M=x[k];u[M]=y[k],h[M]=A[k],m[M]=2}for(let k=0;k<_;k+=1){const M=x[k],T=M%a,S=(M-T)/a;for(let q=0;q<4;q+=1){const L=T+(q===0?-1:q===1?1:0),I=S+(q===2?-1:q===3?1:0);if(L<0||I<0||L>=a||I>=o)continue;const O=L+I*a;m[O]!==0||F[O]===P||(F[O]=P,b[w++]=O)}}_=w;for(let k=0;k<w;k+=1)x[k]=b[k]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,a=Math.min(n-1.0001,Math.max(0,t/r-.5)),o=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(a),f=Math.floor(o),u=a-l,h=o-f;let m=0,p=0;for(let d=0;d<2;d+=1)for(let g=0;g<2;g+=1){const x=l+g+(f+d)*n;if(this.known[x]===0)continue;const b=(g===0?1-u:u)*(d===0?1-h:h);m+=b*this.pe[x],p+=b}return p>0?m/p:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=this.sg;let r=0,a=0,o=0;for(let l=0;l<t.nseg;l+=1){t.segment(l,i);const f=Math.hypot(i[2]-i[0],i[3]-i[1]),u=Math.max(1,Math.ceil(f/(.5*t.dx))),h=f/u*t.depth,m=s*i[4]-n*i[5],p=n*i[4]+s*i[5];for(let d=0;d<u;d+=1){const g=(d+.5)/u,x=i[0]+g*(i[2]-i[0]),b=i[1]+g*(i[3]-i[1]),y=s*x-n*b,A=n*x+s*b,F=this.sideAt(t.x+y,t.y+A,m,p)*h;r-=F*m,a-=F*p,o-=F*(y*p-A*m)}}return e[0]=r,e[1]=a,e[2]=o,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:a}=r,o=t+.5*a*s,l=e+.5*a*n,f=Math.min(r.nx-1.0001,Math.max(0,o/a-.5)),u=Math.min(r.ny-1.0001,Math.max(0,l/a-.5)),h=Math.floor(f),m=Math.floor(u),p=f-h,d=u-m;let g=0,x=0,b=0,y=0;for(let A=0;A<2;A+=1)for(let F=0;F<2;F+=1){const P=h+F,_=m+A,w=P+_*r.nx;if(this.known[w]!==1)continue;const k=(P+.5)*a,M=(_+.5)*a;if((k-t)*s+(M-e)*n<=0)continue;const T=(F===0?1-p:p)*(A===0?1-d:d)+1e-6,S=this.pe[w]+this.re[w]*i.gy*(M-e);r.kind[w]===et?(g+=T*S,x+=T):(b+=T*S,y+=T)}return x>0&&y>0?Math.max(g/x,b/y):x>0?g/x:y>0?b/y:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a),r=this.sg;let a=0,o=0;for(let u=0;u<t.nseg;u+=1){t.segment(u,r);const h=Math.hypot(r[2]-r[0],r[3]-r[1]),m=Math.max(1,Math.ceil(h/t.dx));for(let p=0;p<m;p+=1){const d=(p+.5)/m,g=r[0]+d*(r[2]-r[0])+.5*t.dx*r[4],x=r[1]+d*(r[3]-r[1])+.5*t.dx*r[5],b=s.cellAt(t.x+n*g-i*x,t.y+i*g+n*x);o+=h/m,b>=0&&s.kind[b]===et&&(a+=h/m)}}const l=o>0?a/o:0,f=e.liquid.rhoRef;t.ma=gl*f*l*t.hullA*t.depth,t.Ia=xl*f*l*t.hullJ*t.depth}}const yl=.1,wl=1,bl=.002,Fl=.5,Al=1.02,_l=.5;class Pl{constructor(t){v(this,"list",[]);v(this,"cover");v(this,"forces");v(this,"contacts");v(this,"version",0);v(this,"prev",new Float64Array(0));v(this,"awakeNow",0);v(this,"shapes",!1);v(this,"resized",!1);v(this,"afterCollect",null);v(this,"dv",new Float64Array(3));v(this,"probeS",[]);v(this,"probeJ",[]);v(this,"m9",new Float64Array(9));v(this,"at",new Float64Array(2));this.e=t,this.cover=new pl(t),this.forces=new vl(()=>t),this.contacts=new ll(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}get any(){return this.list.some(t=>!t.gone)}changed(){this.version+=1,this.shapes=!0,this.contacts.invalidate()}reshaped(t,e){e?this.changed():(this.contacts.reshape(t),this.resized=!0),this.wake(t)}adopt(t,e,s,n,i,r=-1){const a=this.e.grid,o=It.fromRects(this.list.length,n,a.dx,a.depth,e,t,s,r);return o.gone?null:(o.pinned=i,o.asleep=!0,this.list.push(o),this.grow(),this.cover.weigh(o),this.cover.addCells(o),this.changed(),o)}turn(t,e,s,n){n!==0&&(this.cover.addCells(t),t.rotateAbout(e,s,n),t.rx=t.x,t.ry=t.y,t.ra=t.a,this.cover.weigh(t),this.cover.addCells(t),this.changed())}sync(){const t=this.e,e=t.grid;if(!this.cover.pending)return 0;const s=this.cover.pendingBox(),n=this.cover.rebuild(this.list);if(e.updateStatic(s[0]-5,s[1]-5,s[2]+5,s[3]+5),n>0||this.cover.topologyChanged){t.regions.label();for(let i=0;i<t.regions.count;i+=1)t.regions.open[i]!==0&&(t.regions.p0[i]=t.pRef);this.cover.topologyChanged=!1}return n>0||this.shapes?(t.bubbleModel.rebuildSites(),this.shapes=!1):t.bubbleModel.refreshBodySites(!this.resized),this.resized=!1,t.liquid.weightsDirty=!0,n}reweigh(){if(this.any){for(const t of this.list)t.gone||this.cover.weigh(t);this.cover.addAll(),this.sync()}}prepare(){let t=!1;this.awakeNow=0;for(const e of this.list)e.awake&&(this.awakeNow+=1,t=!0,this.cover.addCells(e),this.cover.weigh(e),this.cover.addCells(e));if(!t&&!this.cover.pending)return!1;this.sync();for(const e of this.list)e.awake&&(this.cover.pushOut(e,e.rx,e.ry,e.ra),e.rx=e.x,e.ry=e.y,e.ra=e.a,e.ux=e.vx,e.uy=e.vy,e.uw=e.w);return!0}finish(t){if(this.cover.collect(this.list),this.afterCollect!==null&&this.afterCollect(),!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>Al*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;const r=this.forces.force(i),a=3*i.index,o=i.ma6;i.maOk||(this.forces.addedMass(i),o.fill(0),o[0]=i.ma,o[3]=i.ma,o[5]=i.Ia);const l=t*r[0]+o[0]*n[a]+o[1]*n[a+1]+o[2]*n[a+2],f=t*(r[1]-i.m*e.gy)+o[1]*n[a]+o[3]*n[a+1]+o[4]*n[a+2],u=t*r[2]+o[2]*n[a]+o[4]*n[a+1]+o[5]*n[a+2];kl(i.m+o[0],o[1],o[2],i.m+o[3],o[4],i.I+o[5],l,f,u,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[a]=this.dv[0],n[a+1]=this.dv[1],n[a+2]=this.dv[2]}this.contacts.step(t,this.list,this.version,yl*s.dx,wl*s.dx);for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<bl&&this.contacts.touches(i)?i.rest+t:0,i.rest>=Fl&&this.sleep(i)}}hitPoint(t,e,s,n,i){return this.cover.hit(this.list,t,e,s,n,i)}probe(t,e,s,n){const i=this.e.grid,{nx:r,ny:a,dx:o,depth:l}=i,f=this.cover.faceOwner;for(const u of this.list){if(!u.awake)continue;const h=u.index+1,m=this.probeS,p=this.probeJ;m.length=0,p.length=0;const d=this.cover.boxOf(u),g=Math.max(0,Math.floor(d[0]/o)-1),x=Math.min(r,Math.floor(d[2]/o)+2),b=Math.max(0,Math.floor(d[1]/o)-1),y=Math.min(a,Math.floor(d[3]/o)+2);for(let _=b;_<Math.min(a,y);_+=1)for(let w=g;w<=x;w+=1){const k=w+_*(r+1);if(f[k]!==h)continue;const M=(_+.5)*o,T=w>0?w-1+_*r:-1,S=w<r?w+_*r:-1,L=T>=0&&i.kind[T]===ft||S>=0&&i.kind[S]===ft?1:1-i.au[k];L<=0||(T>=0&&i.kind[T]===et&&(m.push(t.at(w-1-e,_-s)),p.push(L,0,-L*(M-u.y))),S>=0&&i.kind[S]===et&&(m.push(t.at(w-e,_-s)),p.push(-L,0,L*(M-u.y))))}for(let _=b;_<=y;_+=1)for(let w=g;w<Math.min(r,x);w+=1){const k=w+_*r;if(f[i.nu+k]!==h)continue;const M=(w+.5)*o,T=_>0?w+(_-1)*r:-1,S=_<a?w+_*r:-1,L=T>=0&&i.kind[T]===ft||S>=0&&i.kind[S]===ft?1:1-i.av[k];L<=0||(T>=0&&i.kind[T]===et&&(m.push(t.at(w-e,_-1-s)),p.push(0,L,L*(M-u.x))),S>=0&&i.kind[S]===et&&(m.push(t.at(w-e,_-s)),p.push(0,-L,-L*(M-u.x))))}if(m.length===0){u.ma6.fill(0),u.maOk=!0;continue}const A=t.system,F=this.m9;for(let _=0;_<3;_+=1){A.b.fill(0),A.x.fill(0);for(let w=0;w<m.length;w+=1)A.b[m[w]]-=o*p[3*w+_];t.solve(1e-4,40,!0);for(let w=0;w<3;w+=1){let k=0;for(let M=0;M<m.length;M+=1)k+=A.x[m[M]]*p[3*M+w];F[3*w+_]=-n*o*l*k}}const P=u.ma6;P[0]=F[0],P[1]=.5*(F[1]+F[3]),P[2]=.5*(F[2]+F[6]),P[3]=F[4],P[4]=.5*(F[5]+F[7]),P[5]=F[8],u.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,_l*e.dx/s))}return t}wake(t){if(!t.free||!t.asleep)return;t.asleep=!1,t.rest=0,t.maOk=!1;const e=3*t.index;this.prev[e]=0,this.prev[e+1]=0,this.prev[e+2]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.cover.addCells(t),this.cover.weigh(t),this.cover.addCells(t)}escape(t){const e=this.e.flows;e.escapedEnergy+=t.energy(),e.escapedWater+=t.filmMass()+(Ve(t.mat)>0?t.m:0),e.escapedSalt+=t.crustMass(),this.cover.release(t),t.gone=!0,t.ncell=0,this.changed(),this.sync()}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e,s=this.e.grid.dx){const n=this.at;for(let i=0;i<(s>0?2:1);i+=1){const r=i===0?0:s;for(let a=this.list.length-1;a>=0;a-=1){const o=this.list[a];if(!o.gone&&(It.toLocal(o.x,o.y,o.a,t,e,n),o.insideLocal(n[0],n[1],r)))return o}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&this.sleep(t),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}grow(){if(this.prev.length<3*this.list.length){const t=new Float64Array(3*this.list.length+24);t.set(this.prev),this.prev=t}}}function kl(c,t,e,s,n,i,r,a,o,l){const f=s*i-n*n,u=e*n-t*i,h=t*n-e*s,m=c*f+t*u+e*h,p=c*i-e*e,d=t*e-c*n,g=c*s-t*t;l[0]=(f*r+u*a+h*o)/m,l[1]=(u*r+p*a+d*o)/m,l[2]=(h*r+d*a+g*o)/m}const Yr=c=>typeof c=="number"&&Number.isFinite(c)?c:null;function Ns(c){if(c===null||typeof c!="object")return null;const t=c,e=(a,o)=>{if(!Array.isArray(a)||a.length!==o)return null;const l=a.map(Yr);return l.every(f=>f!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(o=>e(o,2));if(a.every(o=>o!==null))return{poly:a.map(o=>[o[0],o[1]])}}const i=e(t.line,4),r=Yr(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function os(c,t,e){if("rect"in c){const[m,p,d,g]=c.rect;return t>=m&&t<=d&&e>=p&&e<=g}if("circle"in c){const[m,p,d]=c.circle;return(t-m)*(t-m)+(e-p)*(e-p)<=d*d}if("poly"in c){const m=c.poly;let p=!1;for(let d=0,g=m.length-1;d<m.length;g=d,d+=1){const[x,b]=m[d],[y,A]=m[g];b>e!=A>e&&t<(y-x)*(e-b)/(A-b)+x&&(p=!p)}return p}const[s,n,i,r]=c.line,a=i-s,o=r-n,l=a*a+o*o,f=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*o)/l)):0,u=t-(s+f*a),h=e-(n+f*o);return u*u+h*h<=.25*c.width*c.width}function gn(c){if("rect"in c)return[c.rect[0],c.rect[1],c.rect[2],c.rect[3]];if("circle"in c){const[r,a,o]=c.circle;return[r-o,a-o,r+o,a+o]}if("poly"in c){let r=1/0,a=1/0,o=-1/0,l=-1/0;for(const[f,u]of c.poly)r=Math.min(r,f),a=Math.min(a,u),o=Math.max(o,f),l=Math.max(l,u);return[r,a,o,l]}const t=c.width/2,[e,s,n,i]=c.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Us(c){return"rect"in c?{rect:[...c.rect]}:"circle"in c?{circle:[...c.circle]}:"poly"in c?{poly:c.poly.map(t=>[t[0],t[1]])}:{line:[...c.line],width:c.width}}const Zn=.05;function Jr(c,t){const e=c.latentOffset(),s=Qi(c,t.filter(([n,i,r,a])=>r-n>Zn*c.dx&&a-i>Zn*c.dx));return c.derive(),s.energy+=e-c.latentOffset(),s}function Qi(c,t){const e=c.xs,s=c.ys,n=c.ni,i=c.nj,r=c.off,a=c.nr,o=c.E,l=c.film,f=c.crust;let u=0,h=0,m=0;for(let y=0;y<c.ncell;y+=1)u+=o[y],h+=l[y],m+=f[y];const p=[],d=[];for(const[y,A,F,P]of t)!(F>y)||!(P>A)||(p.push(It.splits(y,F,c.dx)),d.push(It.splits(A,P,c.dx)));c.setRects(p,d);let g=0,x=0,b=0;for(let y=0;y<c.nr;y+=1){const A=c.xs[y],F=c.ys[y];for(let P=0;P<c.nj[y];P+=1)for(let _=0;_<c.ni[y];_+=1){const w=c.off[y]+_+P*c.ni[y],k=A[_],M=A[_+1],T=F[P],S=F[P+1];for(let q=0;q<a;q+=1){const L=e[q],I=s[q];if(!(L[0]>=M||L[n[q]]<=k||I[0]>=S||I[i[q]]<=T))for(let O=0;O<i[q];O+=1){const D=Math.min(S,I[O+1])-Math.max(T,I[O]);if(!(D<=0))for(let R=0;R<n[q];R+=1){const V=Math.min(M,L[R+1])-Math.max(k,L[R]);if(V<=0)continue;const W=r[q]+R+O*n[q],N=V*D/((L[R+1]-L[R])*(I[O+1]-I[O]));c.E[w]+=N*o[W],c.film[w]+=N*l[W],c.crust[w]+=N*f[W]}}}g+=c.E[w],x+=c.film[w],b+=c.crust[w]}}return{energy:u-g,film:h-x,crust:m-b}}function Ml(c,t,e,s,n){const[i,r,a,o]=c;if(s<=i||t>=a||n<=r||e>=o)return null;const l=[],f=Math.max(i,t),u=Math.min(a,s);return t>i&&l.push([i,r,t,o]),s<a&&l.push([s,r,a,o]),e>r&&l.push([f,r,u,e]),n<o&&l.push([f,n,u,o]),l}function Tl(c,t){const e=c.length,s=new Int32Array(e).fill(-1),n=[];for(let i=0;i<e;i+=1){if(s[i]>=0)continue;const r=[i];s[i]=n.length;for(let a=0;a<r.length;a+=1){const[o,l,f,u]=c[r[a]];for(let h=0;h<e;h+=1){if(s[h]>=0)continue;const[m,p,d,g]=c[h],x=(Math.abs(f-m)<=t||Math.abs(d-o)<=t)&&Math.min(u,g)-Math.max(l,p)>t,b=(Math.abs(u-p)<=t||Math.abs(g-l)<=t)&&Math.min(f,d)-Math.max(o,m)>t,y=Math.min(f,d)-Math.max(o,m)>t&&Math.min(u,g)-Math.max(l,p)>t;(x||b||y)&&(s[h]=n.length,r.push(h))}}n.push(r)}return n}function Sl(c,t,e){const s=c.list,n=s.length,i=new Float64Array(2);let r=!1;for(let a=0;a<n;a+=1){const o=s[a];if(o.gone)continue;let l=1/0,f=1/0,u=-1/0,h=-1/0;if("circle"in t){const[P,_,w]=t.circle;It.toLocal(o.x,o.y,o.a,P,_,i),l=i[0]-w,u=i[0]+w,f=i[1]-w,h=i[1]+w}else{const[P,_,w,k]=gn(t);for(const[M,T]of[[P,_],[w,_],[w,k],[P,k]])It.toLocal(o.x,o.y,o.a,M,T,i),l=Math.min(l,i[0]),u=Math.max(u,i[0]),f=Math.min(f,i[1]),h=Math.max(h,i[1])}const m=[];let p=!1;for(let P=0;P<o.nr;P+=1){const _=o.bounds(P),w=Ml(_,l,f,u,h);if(w===null){m.push(_);continue}p=!0;for(const k of w)m.push(k)}if(!p)continue;r=!0,c.cover.release(o);const d=Ve(o.mat)>0,g={E:o.energy(),F:o.filmMass(),K:o.crustMass(),M:d?o.m:0},x=Lc(c,o,m.filter(P=>P[2]-P[0]>Zn*o.dx&&P[3]-P[1]>Zn*o.dx));let b=0,y=0,A=0,F=0;for(const P of x)b+=P.energy(),y+=P.filmMass(),A+=P.crustMass(),F+=d?P.m:0;e.energy-=g.E-o.energy()-b,e.water-=g.F-o.filmMass()-y+(d?g.M-o.m-F:0),e.salt-=g.K-o.crustMass()-A,o.gone||o.ncell===0?(o.gone=!0,o.ncell=0):(c.cover.weigh(o),c.cover.addCells(o))}return r&&c.changed(),r}function Lc(c,t,e,s=!0){const n=c.list,i=Tl(e,1e-6*t.dx),r=[];if(!s&&i.length<=1)return r;for(let a=1;a<i.length;a+=1){const o=new It(n.length,t.key,t.dx,t.depth);o.mat=t.mat,o.heater=t.heater,o.xs=t.xs.map(l=>l.slice()),o.ys=t.ys.map(l=>l.slice()),o.nr=t.nr,o.ni=t.ni.slice(),o.nj=t.nj.slice(),o.off=t.off.slice(),o.ncell=t.ncell,o.E=t.E.slice(),o.film=t.film.slice(),o.crust=t.crust.slice(),o.x=t.x,o.y=t.y,o.a=t.a,o.m=t.m,Jr(o,i[a].map(l=>e[l])),o.rx=o.x,o.ry=o.y,o.ra=o.a,o.pinned=t.pinned,o.asleep=t.asleep,o.vx=t.vx,o.vy=t.vy,o.w=t.w,n.push(o),c.grow(),c.cover.weigh(o),c.cover.addCells(o),r.push(o)}return Jr(t,i.length>0?i[0].map(a=>e[a]):[]),t.rx=t.x,t.ry=t.y,t.ra=t.a,r}function Cl(c,t){const[e,s,n,i]=gn(t),r=[],a=new Float64Array(4);for(const o of c.list){if(o.gone)continue;o.worldBox(o.x,o.y,o.a,a);const l=.001*o.dx;a[0]>=n-l||a[2]<=e+l||a[1]>=i-l||a[3]<=s+l||(c.cover.release(o),r.push(o))}return r}function Zr(c,t,e,s){for(const n of t)n.x+=e,n.y+=s,n.rx=n.x,n.ry=n.y,n.ra=n.a,c.cover.weigh(n),c.cover.addCells(n);t.length>0&&c.changed()}const Ll=.3,Ol=1.6,Mn=.05,Bl=2,jl=.25,to=.5,wi=1e-6;class ql{constructor(t){v(this,"pending",[]);v(this,"melted",0);v(this,"frozen",0);v(this,"sg",new Float64Array(6));v(this,"head",new Int32Array(0));v(this,"next",new Int32Array(0));v(this,"listed",!1);this.e=t}pendingTotals(){let t=0,e=0,s=0;for(const n of this.pending)n!==void 0&&(t+=n.m-n.s,e+=n.H,s+=n.s);return{m:t,H:e,s}}any(){return this.e.bodies.list.some((t,e)=>{var s;return!t.gone&&Ve(t.mat)>0||(((s=this.pending[e])==null?void 0:s.m)??0)>0})}step(){this.listed=!1;let t=!1;const e=this.e.bodies.list,s=e.length;for(let n=0;n<s;n+=1){const i=e[n];!i.gone&&Ve(i.mat)>0&&this.body(i)&&(t=!0);const r=this.pending[n];r!==void 0&&r.m>0&&this.spawn(i,r)}return t}body(t){const e=ht[t.mat].rho,s=ht[t.mat].cp,n=Ws(t.mat),i=new Map,r=new Set;for(let b=0;b<t.nseg;b+=1){const y=4*t.segR[b]+t.segS[b];i.has(y)||i.set(y,this.freezingAt(t,t.segR[b],t.segS[b],r))}const a=new Map;for(let b=0;b<t.nr;b+=1)this.excess(t,b,i,r,a);const o=this.walls(t,[...i.keys()]),l=new Map,f=new Map,u=new Map,h=new Map,m=new Map;for(const[b,y]of i){const A=b>>2,F=b&3,P=s*(y-st)+n,_=Ft(y)-P;let w=0;this.edge(t,A,F,(T,S,q)=>{q>0&&(w+=q*S*(_+s*(y-Math.min(y,t.cellT(T)))))});const k=this.planFreeze(t,A,F,y,_);l.set(b,{L:_,hIce:P,denom:w,plan:k});const M=o.get(b);f.set(M,(f.get(M)??0)+(a.get(b)??0)),u.set(M,(u.get(M)??0)+w),h.set(M,(h.get(M)??0)+((k==null?void 0:k.total)??0)),m.set(M,(m.get(M)??0)+this.freeLength(t,A,F))}const p=[];for(const[b,y]of i){const A=b>>2,F=b&3,P=o.get(b),_=l.get(b),w=a.get(b)??0,k=f.get(P)??0,M=u.get(P)??0;k>0&&M>0?p.push({r:A,s:F,d:k/(e*t.depth*M),Q:w,Tf:y,hIce:_.hIce,freeze:null}):w>0&&this.giveBack(t,A,F,w);const T=h.get(P)??0;T>0&&p.push({r:A,s:F,d:T/(e*t.depth*m.get(P)),Q:0,Tf:y,hIce:_.hIce,freeze:_.plan??{p:[],dm:[],total:0}})}if(p.length===0)return!1;const d=so(t),g=this.e.bodies;if(g.cover.release(t),t.nr===1?this.moveSides(t,p):this.slabs(t,p),this.tidy(t),t.gone||t.nr===0)return t.gone=!0,t.ncell=0,g.changed(),!0;let x=0;if(t.nr>1){const b=[];for(let y=0;y<t.nr;y+=1)b.push(t.bounds(y));x=Lc(g,t,b,!1).length}return t.derive(),g.cover.weigh(t),g.cover.addCells(t),p.some(b=>b.freeze!==null)&&g.cover.pushOut(t,t.x,t.y,t.a),g.reshaped(t,x>0||so(t)!==d),!0}excess(t,e,s,n,i){const r=[];for(let h=0;h<4;h+=1)n.has(4*e+h)&&r.push(h);if(r.length===0)for(let h=0;h<4;h+=1)s.has(4*e+h)&&r.push(h);if(r.length===0)return;let a=1/0;for(const h of r)a=Math.min(a,s.get(4*e+h));const o=t.xs[e],l=t.ys[e],f=t.ni[e],u=t.nj[e];for(let h=0;h<u;h+=1)for(let m=0;m<f;m+=1){const p=t.off[e]+m+h*f,d=t.cellT(p);if(!(d>a))continue;const g=.5*(o[m]+o[m+1]),x=.5*(l[h]+l[h+1]);let b=r[0],y=1/0;for(const _ of r){const w=_===0?g-o[0]:_===1?o[f]-g:_===2?x-l[0]:l[u]-x;w<y&&(y=w,b=_)}const A=4*e+b,F=s.get(A);if(!(d>F))continue;const P=t.E[p]-Cc(t.cellCap(p),t.film[p],t.crust[p],F);P>0&&(t.E[p]-=P,i.set(A,(i.get(A)??0)+P))}}edge(t,e,s,n){const i=t.ni[e],r=t.nj[e],a=s<2?r:i;for(let o=0;o<a;o+=1){const l=s===0?0:s===1?i-1:o,f=s===2?0:s===3?r-1:o,u=t.off[e]+l+f*i,h=s<2?t.ys[e][f]:t.xs[e][l],m=s<2?t.ys[e][f+1]:t.xs[e][l+1];let p=0;for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||(p+=Math.max(0,Math.min(m,t.segT1[d])-Math.max(h,t.segT0[d])));n(u,m-h,m>h?p/(m-h):0)}}sideLength(t,e,s){const[n,i,r,a]=t.bounds(e);return s<2?a-i:r-n}freeLength(t,e,s){let n=0;for(let i=0;i<t.nseg;i+=1)t.segR[i]===e&&t.segS[i]===s&&(n+=t.segT1[i]-t.segT0[i]);return n}widestFree(t,e){let s=3,n=0;for(let i=0;i<4;i+=1){const r=this.freeLength(t,e,i);r>n&&(n=r,s=i)}return s}freezingAt(t,e,s,n){const i=this.e.exchange;let r=0,a=0;for(let o=0;o<t.nseg;o+=1)t.segR[o]!==e||t.segS[o]!==s||this.samples(t,o,l=>{r+=i.salt[l],a+=i.water[l],n.add(4*e+s)});return!(a>0)||!(r>0)?Ve(t.mat):Mc(r/(a*Ls))}samples(t,e,s,n=!0){const i=this.e.grid;t.segment(e,this.sg);const r=this.sg,a=Math.hypot(r[2]-r[0],r[3]-r[1]),o=Math.max(1,Math.ceil(a/(.5*i.dx))),l=Math.cos(t.a),f=Math.sin(t.a),u=l*r[4]-f*r[5],h=f*r[4]+l*r[5],m=.05*i.dx;let p=-1,d=-1,g=-1;for(let x=0;x<o;x+=1){const b=(x+.5)/o,y=r[0]+b*(r[2]-r[0]),A=r[1]+b*(r[3]-r[1]),F=t.x+l*y-f*A,P=t.y+f*y+l*A,_=i.cellAt(F+m*u,P+m*h);if(_<0||i.solid[_]!==0){p=_;continue}if(_!==p&&s(_,a/o),p=_,n){const k=i.cellAt(F+(i.dx+m)*u,P+(i.dx+m)*h);k>=0&&k!==_&&k!==g&&i.solid[k]===0&&s(k,a/o),g=k}const w=i.cellAt(F-m*u,P-m*h);w>=0&&w!==_&&w!==d&&i.solid[w]===0&&i.kind[w]===et&&s(w,a/o),d=w}}inCell(t,e){this.listed||this.buildLists();for(let s=this.head[t];s>=0;s=this.next[s])e(s)}buildLists(){const t=this.e.grid,e=this.e.particles;this.head.length!==t.n&&(this.head=new Int32Array(t.n)),this.head.fill(-1),this.next.length<e.count&&(this.next=new Int32Array(Math.max(e.cap,e.count)));for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||(this.next[s]=this.head[n],this.head[n]=s)}this.listed=!0}planFreeze(t,e,s,n,i){const r=this.e.exchange,a=this.e.particles,o={p:[],dm:[],total:0},l=f=>{if(!(r.cap[f]>0)||!(r.water[f]>0))return;const u=r.capT[f]/r.cap[f];if(u>=n)return;const h=Math.min(to*r.water[f],r.cap[f]*(n-u)/Math.max(1,i));if(!(h>0))return;let m=0;this.inCell(f,p=>{if(a.mat[p]!==ct)return;const d=a.mass[p]-a.smass[2*p],g=Math.min(to*d,h*d/r.water[f]);g>0&&(o.p.push(p),o.dm.push(g),m+=g)}),r.water[f]-=m,r.cap[f]=0,o.total+=m};for(let f=0;f<t.nseg;f+=1)t.segR[f]===e&&t.segS[f]===s&&this.samples(t,f,l);return o.total>0?o:null}take(t,e,s){const n=this.e.particles,i=this.e.liquid;let r=0;for(let a=0;a<t.p.length;a+=1){const o=t.p[a],l=t.dm[a]*e;if(!(l>0))continue;const f=n.mass[o]/n.rho[o],u=n.mass[o]*n.h[o]-l*s;n.mass[o]-=l,n.h[o]=u/n.mass[o],n.derive(o),i.dVp[o]+=n.mass[o]/n.rho[o]-f,r+=l}this.frozen+=r}moveSides(t,e){for(const s of e){if(s.freeze===null){this.melt(t,s.r,s.s,s.d,s.Q);continue}const n=s.freeze.total;this.take(s.freeze,1,s.hIce),this.grow(t,s.r,s.s,n,s.Tf)}}melt(t,e,s,n,i){const r=ht[t.mat].rho,a=Math.min(n,this.rowThickness(t,e,s));let o=0,l=0,f=0,u=0;if(this.edge(t,e,s,(h,m)=>{const p=t.cellVolume(h);if(!(p>0))return;const d=m*a*t.depth/p;l+=d*t.E[h],f+=d*t.film[h],u+=d*t.crust[h],t.E[h]-=d*t.E[h],t.film[h]-=d*t.film[h],t.crust[h]-=d*t.crust[h],o+=r*m*a*t.depth}),this.moveSide(t,e,s,-a),!(o>0)){this.giveBack(t,e,s,i+l);return}this.melted+=o,this.give(t,e,s,o+f+u,l+o*Ws(t.mat)+i,u)}grow(t,e,s,n,i){const r=ht[t.mat].rho,a=ht[t.mat].cp,o=this.sideLength(t,e,s),l=n/(r*t.depth*o);this.edge(t,e,s,(f,u)=>{t.E[f]+=r*u*l*t.depth*a*(i-st)}),this.moveSide(t,e,s,l)}rowThickness(t,e,s){const n=t.xs[e],i=t.ys[e];return s===0?n[1]-n[0]:s===1?n[t.ni[e]]-n[t.ni[e]-1]:s===2?i[1]-i[0]:i[t.nj[e]]-i[t.nj[e]-1]}moveSide(t,e,s,n){s===0?t.xs[e][0]-=n:s===1?t.xs[e][t.ni[e]]+=n:s===2?t.ys[e][0]-=n:t.ys[e][t.nj[e]]+=n}giveBack(t,e,s,n){const i=this.sideLength(t,e,s);if(!(i>0)){t.E[t.off[e]]+=n;return}this.edge(t,e,s,(r,a)=>{t.E[r]+=n*a/i})}slabs(t,e){const s=ht[t.mat].rho,n=ht[t.mat].cp,i=Ws(t.mat),r=t.depth,a=e.length,o=this.walls(t,e.map(k=>4*k.r+k.s)),l=e.map(k=>o.get(4*k.r+k.s)),f=new Map;for(const k of e)k.freeze===null&&f.set(4*k.r+k.s,k.d);const u=[];for(let k=0;k<t.nr;k+=1)u.push(t.bounds(k));const h=new Map;for(const k of e)h.set(4*k.r+k.s,(h.get(4*k.r+k.s)??0)+(k.freeze!==null?k.d:-k.d));const m=[],p=[];for(let k=0;k<a;k+=1){const M=e[k],T=u[M.r];for(let S=0;S<t.nseg;S+=1)if(!(t.segR[S]!==M.r||t.segS[S]!==M.s))if(M.freeze===null){const q=t.segT0[S]-this.inner(t,S,!1,f),L=t.segT1[S]+this.inner(t,S,!0,f);m.push(eo(M.s,T,q,L,Math.min(M.d,M.s<2?T[2]-T[0]:T[3]-T[1]),!0,k))}else{const q=t.segT0[S]-this.corner(t,M.r,M.s,!1,t.segT0[S],h),L=t.segT1[S]+this.corner(t,M.r,M.s,!0,t.segT1[S],h);L>q&&p.push(eo(M.s,T,q,L,M.d,!1,k))}}const d=hl(u,m,p),g=d.taken,x=new Float64Array(a);for(let k=0;k<g.length;k+=5)x[g[k+4]]+=(g[k+2]-g[k])*(g[k+3]-g[k+1]);for(let k=0;k<a;k+=1)e[k].freeze===null&&!(x[k]>0)&&this.giveBack(t,e[k].r,e[k].s,e[k].Q);const b=new Float64Array(a),y=new Float64Array(a),A=new Float64Array(a);for(let k=0;k<g.length;k+=5){const M=g[k+4];this.overlap(t,g[k],g[k+1],g[k+2],g[k+3],(T,S)=>{b[M]+=S*t.E[T],y[M]+=S*t.film[T],A[M]+=S*t.crust[T]})}for(let k=0;k<a;k+=1){const M=e[k];if(M.freeze!==null||!(x[k]>0))continue;const T=s*r*x[k];this.melted+=T,this.give(t,M.r,M.s,T+y[k]+A[k],b[k]+T*i+M.Q,A[k])}Qi(t,d.rects);const F=d.added,P=new Float64Array(a);for(let k=0;k<F.length;k+=5){const M=F[k+4],T=e[M].Tf;P[M]+=(F[k+2]-F[k])*(F[k+3]-F[k+1]),this.overlap(t,F[k],F[k+1],F[k+2],F[k+3],(S,q,L)=>{t.E[S]+=s*r*L*n*(T-st)})}const _=new Map,w=new Map;for(let k=0;k<a;k+=1){const M=e[k].freeze;if(M===null)continue;const T=l[k];_.set(T,(_.get(T)??0)+s*r*P[k]),w.set(T,(w.get(T)??0)+M.total)}for(let k=0;k<a;k+=1){const M=e[k].freeze;if(M===null||!(M.total>0))continue;const T=l[k];this.take(M,_.get(T)/w.get(T),e[k].hIce)}}walls(t,e){const s=new Map;for(const r of e)s.set(r,r);const n=r=>{let a=r;for(;s.get(a)!==a;)a=s.get(a);return a};if(t.nr>1){const r=wi*t.dx,a=o=>{const l=t.segR[o],f=t.segS[o];return f===0?t.xs[l][0]:f===1?t.xs[l][t.ni[l]]:f===2?t.ys[l][0]:t.ys[l][t.nj[l]]};for(let o=0;o<t.nseg;o+=1)for(let l=o+1;l<t.nseg;l+=1){if(t.segS[o]!==t.segS[l]||Math.abs(a(o)-a(l))>r||Math.abs(t.segT1[o]-t.segT0[l])>r&&Math.abs(t.segT1[l]-t.segT0[o])>r)continue;const f=4*t.segR[o]+t.segS[o],u=4*t.segR[l]+t.segS[l];if(!s.has(f)||!s.has(u))continue;const h=n(f),m=n(u);h!==m&&s.set(Math.max(h,m),Math.min(h,m))}}const i=new Map;for(const r of e)i.set(r,n(r));return i}inner(t,e,s,n){const i=wi*t.dx,r=t.segR[e],a=t.segS[e],o=s?t.segT1[e]:t.segT0[e],l=a===0?t.xs[r][0]:a===1?t.xs[r][t.ni[r]]:a===2?t.ys[r][0]:t.ys[r][t.nj[r]],f=a<2?l:o,u=a<2?o:l,h=a===0?-1:a===1?1:0,m=a===2?-1:a===3?1:0;for(let p=0;p<t.nseg;p+=1){const d=t.segS[p];if(d<2==a<2)continue;const g=n.get(4*t.segR[p]+d);if(g===void 0)continue;const x=t.segR[p],b=d===0?t.xs[x][0]:d===1?t.xs[x][t.ni[x]]:d===2?t.ys[x][0]:t.ys[x][t.nj[x]];for(const[y,A]of[[t.segT0[p],t.segT1[p]],[t.segT1[p],t.segT0[p]]]){const F=d<2?b:y,P=d<2?y:b;if(Math.abs(F-f)>i||Math.abs(P-u)>i)continue;const _=d<2?b:A,w=d<2?A:b;if((_-f)*h+(w-u)*m>i)return g}}return 0}corner(t,e,s,n,i,r){const[a,o,l,f]=t.bounds(e),u=wi*t.dx,h=s<2?n?f:o:n?l:a;if(Math.abs(i-h)>u)return 0;const m=s<2?n?3:2:n?1:0,p=s===0?a:s===1?l:s===2?o:f;for(let d=0;d<t.nseg;d+=1)if(t.segR[d]===e&&t.segS[d]===m&&t.segT0[d]<=p+u&&t.segT1[d]>=p-u)return r.get(4*e+m)??0;return 0}overlap(t,e,s,n,i,r){for(let a=0;a<t.nr;a+=1){const o=t.xs[a],l=t.ys[a],f=t.ni[a],u=t.nj[a];if(!(o[0]>=n||o[f]<=e||l[0]>=i||l[u]<=s))for(let h=0;h<u;h+=1){const m=Math.min(i,l[h+1])-Math.max(s,l[h]);if(!(m<=0))for(let p=0;p<f;p+=1){const d=Math.min(n,o[p+1])-Math.max(e,o[p]);d<=0||r(t.off[a]+p+h*f,d*m/((o[p+1]-o[p])*(l[h+1]-l[h])),d*m)}}}}give(t,e,s,n,i,r=0){const a=this.e.grid,o=this.e.particles,l=this.e.liquid,f=[],u=new Set;let h=0;for(let p=0;p<2&&f.length===0;p+=1)for(let d=0;d<t.nseg;d+=1)t.segR[d]!==e||t.segS[d]!==s||this.samples(t,d,g=>{a.kind[g]!==et||u.has(g)||(u.add(g),this.inCell(g,x=>{o.mat[x]===ct&&(f.push(x),h+=o.mass[x])}))},p===1);if(f.length===0||!(h>0)){this.hold(t,e,s,n,i,r);return}const m=l.rhoRef*a.vCell/4;for(const p of f){const d=o.mass[p]/h,g=o.mass[p]/o.rho[p],x=o.mass[p]*o.h[p]+d*i;o.mass[p]+=d*n,r>0&&(o.smass[2*p]+=d*r,o.spc[2*p]=yr),o.h[p]=x/o.mass[p],o.derive(p),l.dVp[p]+=o.mass[p]/o.rho[p]-g,o.mass[p]>Bl*m&&this.split(p)}}split(t){const e=this.e.particles,s=this.e.liquid,n=this.e.grid,i=e.id[t]%2===0?1:-1;let r=NaN;for(const f of[i,-i]){const u=Math.min(n.w-1e-6,Math.max(1e-6,e.x[t]+.25*n.dx*f)),h=n.cellAt(u,e.y[t]);if(h>=0&&n.solid[h]===0&&this.e.bodies.bodyAt(u,e.y[t],0)===null){r=u;break}}if(Number.isNaN(r))return;const a=.5*e.mass[t],o=.5*e.smass[2*t],l=e.add(r,e.y[t],a,e.h[t],e.mat[t],o);l<0||(e.mass[t]=a,e.smass[2*t]=o,e.derive(t),e.vx[l]=e.vx[t],e.vy[l]=e.vy[t],s.placeParticle(l))}hold(t,e,s,n,i,r=0){const[a,o,l,f]=t.bounds(e),u=s===0?a:s===1?l:.5*(a+l),h=s===2?o:s===3?f:.5*(o+f),m=s===0?-1:s===1?1:0,p=s===2?-1:s===3?1:0,d=Math.cos(t.a),g=Math.sin(t.a),x=this.pending[t.index]??(this.pending[t.index]={m:0,H:0,s:0,x:0,y:0,nx:0,ny:1});x.m+=n,x.H+=i,x.s+=r,x.x=t.x+d*u-g*h,x.y=t.y+g*u+d*h,x.nx=d*m-g*p,x.ny=g*m+d*p}spawn(t,e){const s=this.e.grid,n=this.e.particles,i=this.e.liquid,r=i.rhoRef*s.vCell/4;if(e.m<jl*r&&!t.gone)return;const a=this.freeSpot(e.x+.3*s.dx*e.nx,e.y+.3*s.dx*e.ny);if(a===null)return;const o=n.add(a[0],a[1],e.m,e.H/e.m,ct,e.s);o<0||(n.vx[o]=t.gone?0:t.vx,n.vy[o]=t.gone?0:t.vy,i.placeParticle(o),i.dVp[o]=e.m/n.rho[o],e.m=0,e.H=0,e.s=0)}freeSpot(t,e){const s=this.e.grid,n=(i,r)=>{if(!(i>0&&r>0&&i<s.w&&r<s.h))return!1;const a=s.cellAt(i,r);return a>=0&&s.solid[a]===0&&this.e.bodies.bodyAt(i,r,0)===null};if(n(t,e))return[t,e];for(let i=1;i<=3;i+=1)for(let r=i;r>=-i;r-=1)for(let a=-i;a<=i;a+=1)if(Math.max(Math.abs(a),Math.abs(r))===i&&n(t+a*s.dx,e+r*s.dx))return[t+a*s.dx,e+r*s.dx];return null}tidy(t){const e=t.dx;let s=!1;for(let a=0;a<t.nr;a+=1){const[o,l,f,u]=t.bounds(a);if(f-o<Mn*e||u-l<Mn*e){s=!0;continue}for(let h=0;h<4;h+=1){const m=this.rowThickness(t,a,h),p=h<2?t.ni[a]:t.nj[a];(m<Ll*e&&p>1||m>Ol*e)&&(s=!0)}}if(!s)return;const n=ht[t.mat].rho,i=Ws(t.mat),r=[];for(let a=0;a<t.nr;a+=1){const[o,l,f,u]=t.bounds(a);if(f-o>=Mn*e&&u-l>=Mn*e){r.push([o,l,f,u]);continue}const h=n*(f-o)*(u-l)*t.depth;let m=0,p=0,d=0;for(let g=t.off[a];g<t.off[a]+t.ni[a]*t.nj[a];g+=1)m+=t.E[g],p+=t.film[g],d+=t.crust[g];this.melted+=h,this.give(t,a,this.widestFree(t,a),h+p+d,m+h*i,d)}Qi(t,r),(t.nr===0||t.ncell===0)&&(t.gone=!0,t.ncell=0)}}function eo(c,t,e,s,n,i,r){const[a,o,l,f]=t;return c===0?i?{x0:a,y0:e,x1:a+n,y1:s,move:r}:{x0:a-n,y0:e,x1:a,y1:s,move:r}:c===1?i?{x0:l-n,y0:e,x1:l,y1:s,move:r}:{x0:l,y0:e,x1:l+n,y1:s,move:r}:c===2?i?{x0:e,y0:o,x1:s,y1:o+n,move:r}:{x0:e,y0:o-n,x1:s,y1:o,move:r}:i?{x0:e,y0:f-n,x1:s,y1:f,move:r}:{x0:e,y0:f,x1:s,y1:f+n,move:r}}function so(c){let t=c.nr*7919+c.nseg;for(let e=0;e<c.nseg;e+=1)t=Math.imul(t,31)+4*c.segR[e]+c.segS[e]|0;return t}const re=8;class Il{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*at),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*re),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<at;i+=1)this.m[n*at+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<re;i+=1)this.force[n*re+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<at;s+=1)e+=this.m[t*at+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<at;s+=1)this.m[t*at+s]=this.m[e*at+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<re;s+=1)this.force[t*re+s]=this.force[e*re+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Oc=200;function bi(c,t,e,s){const n=kt(c);return t/De(n)-e*jt*n/(s-c)}function Rl(c,t){const e=Math.PI*t*t*t/6;if(c<=e)return Math.cbrt(3*c/(4*Math.PI));const s=Math.PI*t*t*t/4;return c<=s?t/2:Math.sqrt(c/(Math.PI*t))}function El(c,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(c<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(c>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(c-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function Dl(c,t,e,s,n,i,r,a=ct){const o=c[t+Q],l=c[t+it]/mt[it]+c[t+rt]/mt[rt],f=o/mt[Q];let u=i>0?i:Math.cbrt(3*Math.max(1e-30,(f+l)*jt*s/e)/(4*Math.PI)),h=e,m=0,p=s,d=0;for(let g=0;g<8;g+=1){if(h=e+2*_s(a,p)/u,l<=0)m=h,p=kt(m),d=o/De(p);else if(f<=1e-9*l)m=0,p=s,d=l*jt*p/h;else{let b=611.213,y=h*(1-1e-12),A=bi(b,o,l,h),F=bi(y,o,l,h);if(A<=0)m=b;else if(F>=0)m=y;else{let P=0;m=.5*(b+y);for(let _=0;_<40;_+=1){m=(b*F-y*A)/(F-A);const w=bi(m,o,l,h);if(Math.abs(w)<=1e-12*(o/De(s)+1e-30))break;w>0?(b=m,A=w,P===1&&(F/=2),P=1):(y=m,F=w,P===-1&&(A/=2),P=-1)}}p=kt(m),d=o/De(p)}const x=Rl(d,n);if(Math.abs(x-u)<=1e-7*u){u=x;break}u=x}r.r=u,r.V=d,r.pb=e+2*_s(a,p)/u,r.pv=m,r.Tb=p,El(d,u,n,r)}function no(c,t,e,s){let n=0;for(let i=0;i<at;i+=1)c[t+i]>0&&(n+=c[t+i]*s(i,e));return n}function io(c,t,e,s,n,i,r,a,o,l){let f=0;if(2*e<=3*i){const x=c/i-.5,b=t/i-.5,y=Math.floor(x-.5),A=Math.floor(b-.5),F=x-y,P=b-A,_=.5*(1.5-F)**2,w=.75-(F-1)**2,k=.5*(F-.5)**2,M=.5*(1.5-P)**2,T=.75-(P-1)**2,S=.5*(P-.5)**2;let q=0;for(let L=0;L<3;L+=1){const I=A+L;if(I<0||I>=a)continue;const O=L===0?M:L===1?T:S;for(let D=0;D<3;D+=1){const R=y+D;if(R<0||R>=r)continue;const V=O*(D===0?_:D===1?w:k);o[f]=R+I*r,l[f]=V,q+=V,f+=1}}for(let L=0;L<f;L+=1)l[L]/=q;return f}const u=s<=Math.PI*n*n*n/6,h=Math.max(0,Math.floor((c-e)/i)),m=Math.min(r-1,Math.floor((c+e)/i)),p=Math.max(0,Math.floor((t-e)/i)),d=Math.min(a-1,Math.floor((t+e)/i));let g=0;for(let x=p;x<=d;x+=1)for(let b=h;b<=m;b+=1){let y=0;for(let A=0;A<4;A+=1){const F=(x+(A+.5)/4)*i-t;for(let P=0;P<4;P+=1){const _=(b+(P+.5)/4)*i-c,w=e*e-_*_-F*F;w>0&&(y+=u?Math.sqrt(w):1)}}y<=0||f>=o.length||(o[f]=b+x*r,l[f]=y,g+=y,f+=1)}if(g<=0)return o[0]=Math.min(r-1,Math.max(0,Math.floor(c/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let x=0;x<f;x+=1)l[x]/=g;return f}function Vl(c,t,e,s,n,i){const{nx:r,ny:a}=c,o=e%r,l=(e-o)/r;let f=0,u=0;for(let h=0;h<=6&&(f===0||u<2*s);h+=1)for(let m=0;m<=h;m+=1)for(let p=-h;p<=h;p+=1){if(Math.max(Math.abs(p),m)!==h)continue;const d=o+p,g=l+m;if(d<0||g<0||d>=r||g>=a)continue;const x=d+g*r;if(c.kind[x]!==H||f>=n.length)continue;const b=Math.max(.001*c.vCell,t[x]);n[f]=x,i[f]=b,u+=b,f+=1}for(let h=0;h<f;h+=1)i[h]/=u;return f}function Nl(c,t){const e=Math.min(c.nx-1,Math.max(0,Math.floor(t/c.dx)));for(let s=c.ny-1;s>=0;s-=1)if(c.kind[e+s*c.nx]===H)return e+s*c.nx;return-1}const fs=.5;class Ul{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,o=r.x[t],l=r.y[t],f=r.r[t],u=r.V[t],h=Math.max(f+i.dx,2*i.dx),m=this.vel;let p=0,d=0;for(let z=0;z<8;z+=1){const ut=z*Math.PI/4;a.velocityAt(o+h*Math.cos(ut),l+h*Math.sin(ut),m),p+=m[0]/8,d+=m[1]/8}const g=i.cellAt(o,l),x=g>=0&&n.phase.Cl[g]>0?n.phase.Tl[g]:r.Tb[t],b=g>=0?n.phase.host[g]:0,y=n.phase.mixed?is(b,x):a.rhoRef,A=en(b,x),F=r.totalMass(t)/Math.max(1e-30,u),P=(p-this.ux0[t])/Math.max(e,1e-6),_=(d-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=p,this.uy0[t]=d,f<2e-5){r.vx[t]=p,r.vy[t]=d,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,o+e*p)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*d));return}const w=r.vx[t]-p,k=r.vy[t]-d,M=Math.hypot(w,k),T=2*f,S=Math.max(1e-6,y*M*T/A),q=Math.max(0,n.gy)*(y-F)*T*T/_s(b,x),I=.5*Math.max(24/S*(1+.15*Math.pow(S,.687)),8/3*(q/(q+4)))*y*this.front(t)*M,O=(F+fs*y)*u,D=y*u*P,R=y*u*(_+n.gy),V=-F*u*n.gy,W=fs*y*u*P,N=fs*y*u*_,Y=s>0?fs*y*s:0,J=s<0?Math.min(-s,.2*u/e):0,j=fs*y*J*w,$=fs*y*J*k,U=(O*r.vx[t]+e*(D+W+j)+e*(I+Y)*p)/(O+e*(I+Y)),G=(O*r.vy[t]+e*(R+V+N+$)+e*(I+Y)*d)/(O+e*(I+Y));r.vx[t]=Number.isFinite(U)?U:p,r.vy[t]=Number.isFinite(G)?G:d;const tt=-I*(U-p),pt=-I*(G-d),wt=t*re;r.force[wt]=D,r.force[wt+1]=R,r.force[wt+2]=0,r.force[wt+3]=V,r.force[wt+4]=tt,r.force[wt+5]=pt,r.force[wt+6]=W+j-Y*(U-p),r.force[wt+7]=N+$-Y*(G-d),this.spreadForce(o,l,-(tt+r.force[wt+6])*(e/n.dt),-(pt+r.force[wt+7])*(e/n.dt));let C=o+e*U,E=l+e*G;const B=i.sdfAt(C,E);if(B<f){const z=.25*i.dx;let ut=i.sdfAt(C+z,E)-i.sdfAt(C-z,E),bt=i.sdfAt(C,E+z)-i.sdfAt(C,E-z);const dt=Math.hypot(ut,bt);if(dt>1e-12){ut/=dt,bt/=dt,C+=(f-B)*ut,E+=(f-B)*bt;const Ct=r.vx[t]*ut+r.vy[t]*bt;Ct<0&&(r.vx[t]-=Ct*ut,r.vy[t]-=Ct*bt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,C)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,E));const X=i.depth;r.z[t]=2*f>=X?X/2:Math.min(X-f,Math.max(f,r.z[t]))}spreadForce(t,e,s,n){const i=this.e.liquid,r=this.e.grid,{nx:a,ny:o,dx:l}=r,f=this.w3;let u=Math.floor(t/l-.5),h=t/l-u;f[0]=.5*(1.5-h)**2,f[1]=.75-(h-1)**2,f[2]=.5*(h-.5)**2;let m=Math.floor(e/l-1);h=e/l-.5-m,f[3]=.5*(1.5-h)**2,f[4]=.75-(h-1)**2,f[5]=.5*(h-.5)**2;for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=u+d,x=m+p;g<0||g>a||x<0||x>=o||(i.fU[g+x*(a+1)]+=s*f[d]*f[3+p])}u=Math.floor(t/l-1),h=t/l-.5-u,f[0]=.5*(1.5-h)**2,f[1]=.75-(h-1)**2,f[2]=.5*(h-.5)**2,m=Math.floor(e/l-.5),h=e/l-m,f[3]=.5*(1.5-h)**2,f[4]=.75-(h-1)**2,f[5]=.5*(h-.5)**2;for(let p=0;p<3;p+=1)for(let d=0;d<3;d+=1){const g=u+d,x=m+p;g<0||g>=a||x<0||x>o||(i.fV[g+x*a]+=n*f[d]*f[3+p])}}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const o=(n-r)/(a-r);return(1-o)*(Math.PI*s*s)/4+o*s*s}}class Bc{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function ro(c,t,e){let s=(c^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const Gl=8,Hl=210,oo=1.805,$l=3e-7;function co(c,t){const e=kt(t);return kt(t+2*gr(e)/c)-e}const le=class le{constructor(){v(this,"count",0);v(this,"fixed",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"mat",new Uint8Array(0));v(this,"px",new Float64Array(0));v(this,"py",new Float64Array(0));v(this,"nx",new Float32Array(0));v(this,"ny",new Float32Array(0));v(this,"body",new Int16Array(0));v(this,"seg",new Int32Array(0));v(this,"t",new Float32Array(0));v(this,"pos",new Float64Array(2));v(this,"sg",new Float64Array(6))}static rRef(){if(le.ref>0)return le.ref;const t=kt(Ys),e=2*gr(t)/(sn(t+1)-Ys);return le.ref=Hl*e,le.ref}static draw(t,e,s,n){const i=ht[s],r=le.rRef(),a=le.rng;a.state=t||1;const o=Math.pow(r/i.cavRmax,oo);let l=0;for(let f=0;f<Gl;f+=1){l+=a.exp();const u=r*Math.pow(l/(e*i.cavScale)+o,-1/oo);if(u<$l)break;n.r.push(u),n.s.push(a.next()),n.z.push(a.next())}}rebuild(t,e,s=[]){const{nx:n,ny:i}=t,r=t.dx*t.depth,a=[],o=[],l=[],f=[],u=[],h=[],m=[],p={r:[],s:[],z:[]};for(let A=0;A<t.n;A+=1){if(t.solid[A]===0||t.owner[A]!==0)continue;const F=A%n,P=(A-F)/n;for(let _=0;_<4;_+=1){const w=_===0?F-1:_===1?F+1:F,k=_===2?P-1:_===3?P+1:P;if(w<0||k<0||w>=n||k>=i)continue;const M=w+k*n;if(t.solid[M]===0){p.r.length=0,p.s.length=0,p.z.length=0,le.draw(ro(e,A,_),r,t.solid[A]-1,p);for(let T=0;T<p.r.length;T+=1)a.push(A),o.push(M),l.push(_),f.push(p.r[T]),u.push(p.s[T]),h.push(p.z[T]),m.push(t.solid[A]-1)}}}const d=a.length,g=[],x=[],b=[];for(const A of s)if(!A.gone)for(let F=0;F<A.nseg;F+=1){A.segment(F,this.sg);const P=Math.hypot(this.sg[2]-this.sg[0],this.sg[3]-this.sg[1]),_=Math.max(1,Math.round(P/t.dx));for(let w=0;w<_;w+=1){p.r.length=0,p.s.length=0,p.z.length=0,le.draw(ro(e,1e5+1e3*A.key+F,w),P/_*t.depth,A.mat,p);for(let k=0;k<p.r.length;k+=1)a.push(-1),o.push(-1),l.push(A.segS[F]),f.push(p.r[k]),u.push(p.s[k]),h.push(p.z[k]),m.push(A.mat),g.push(A.index),x.push(F),b.push((w+p.s[k])/_)}}const y=a.length;this.count=y,this.fixed=d,this.cell=Int32Array.from(a),this.fluid=Int32Array.from(o),this.dir=Uint8Array.from(l),this.r=Float32Array.from(f),this.s=Float32Array.from(u),this.z=Float32Array.from(h),this.bubble=new Uint32Array(y),this.mat=Uint8Array.from(m),this.px=new Float64Array(y),this.py=new Float64Array(y),this.nx=new Float32Array(y),this.ny=new Float32Array(y),this.body=new Int16Array(y).fill(-1),this.seg=new Int32Array(y),this.t=new Float32Array(y);for(let A=0;A<d;A+=1){const F=this.cell[A],P=F%n,_=(F-P)/n,w=this.s[A],k=this.dir[A],M=t.dx;this.px[A]=k===0?P*M:k===1?(P+1)*M:(P+w)*M,this.py[A]=k===2?_*M:k===3?(_+1)*M:(_+w)*M,this.nx[A]=k===0?-1:k===1?1:0,this.ny[A]=k===2?-1:k===3?1:0}for(let A=d;A<y;A+=1)this.body[A]=g[A-d],this.seg[A]=x[A-d],this.t[A]=b[A-d];this.refresh(t,s,!1)}refresh(t,e,s=!0){const n=.05*t.dx;for(let i=this.fixed;i<this.count;i+=1){const r=e[this.body[i]];if(r===void 0||r.gone){this.cell[i]=-1,this.fluid[i]=-1;continue}if(s&&!r.awake)continue;r.segment(this.seg[i],this.sg);const a=this.t[i],o=this.sg[0]+a*(this.sg[2]-this.sg[0]),l=this.sg[1]+a*(this.sg[3]-this.sg[1]),f=Math.cos(r.a),u=Math.sin(r.a),h=r.x+f*o-u*l,m=r.y+u*o+f*l,p=f*this.sg[4]-u*this.sg[5],d=u*this.sg[4]+f*this.sg[5];this.px[i]=h,this.py[i]=m,this.nx[i]=p,this.ny[i]=d,this.dir[i]=Math.abs(p)>=Math.abs(d)?p<0?0:1:d<0?2:3;const g=t.cellAt(h-n*p,m-n*d),x=t.cellAt(h+n*p,m+n*d);this.cell[i]=g,this.fluid[i]=x>=0&&t.solid[x]===0?x:-1}}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)ht[this.mat[n]].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){return this.pos[0]=this.px[e]+s*this.nx[e],this.pos[1]=this.py[e]+s*this.ny[e],this.pos}};v(le,"ref",0),v(le,"rng",new Bc(1));let Xi=le;const Wl=.0208,Kl=1;class zl{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new Xi);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new Ul(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed,this.e.bodies!==void 0?this.e.bodies.list:[]);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}refreshBodySites(t=!0){this.sites.refresh(this.e.grid,this.e.bodies.list,t)}detach(t){const e=this.B.site[t];e>=0&&(this.sites.bubble[e]=0),this.B.site[t]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return co(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,o=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),f=Math.floor(o),u=Math.floor(l),h=o-f,m=l-u;let p=0,d=0;for(let g=0;g<2;g+=1)for(let x=0;x<2;x+=1){const b=f+x+(u+g)*i;if(n.solid[b]!==0)continue;const y=(x===0?1-h:h)*(g===0?1-m:m);p+=y*n.pl[b],d+=y}return s.pRef+(d>0?p/d:0)}liquidFootprint(t){const s=this.e.grid,n=this.B,i=io(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let o=0;o<i;o+=1){const l=this.cells[o];s.kind[l]===et&&(this.cells[a]=l,this.wts[a]=this.wts[o],r+=this.wts[o],a+=1)}for(let o=0;o<a;o+=1)this.wts[o]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;Dl(s.m,t*at,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==et){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const f=e.pRef+s.pl[l],u=i.boilingAt(l,f);this.tsatCell[l]=u,i.salty&&(this.dTb[l]=u-kt(f)),this.budget[l]=i.Cl[l]*(i.Tl[l]-u)}this.Fm.fill(0);const o=e.waterTemperature();if(this.bulkCold=o.mass>0&&o.mean<=kt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);this.coalesce();for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r],o=this.sites.cell[r];if(a<0||o<0||s.kind[a]!==et||i.acc[a]<=0||i.waterShare(a)<.5||!e.heat.hasSolid(o))continue;const l=ht[this.sites.mat[r]],f=i.Tl[a],u=Ks(i.host[a],f),h=(l.k*s.Ts[o]+u*f)/(l.k+u),m=e.pRef+s.pl[a],p=this.tsatCell[a]>0?this.tsatCell[a]:kt(m);if(h-p<0)continue;const d=this.sites.r[r];if(h-p<co(d,m))continue;const g=m+2*_s(i.host[a],h)/d,x=kt(g),b=4/3*Math.PI*d*d*d,y=De(x)*b;if(y*4>i.acc[a])continue;const A=this.sites.position(this.e.grid,r,d),F=n.add(A[0],A[1],Math.min(s.depth-d,Math.max(d,this.sites.z[r]*s.depth)));if(F<0)return;n.m[F*at+Q]=y,n.r[F]=d,n.V[F]=b,n.Tb[F]=x,n.pb[F]=g,n.pv[F]=g,n.H[F]=y*xt(x),n.site[F]=r,n.age[F]=0,this.sites.bubble[r]=n.id[F],this.motion.ux0[F]=0,this.motion.uy0[F]=0;const P=i.waterH(a);this.Fm[a]-=y,e.heat.src[o]-=y*(xt(x)-P)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=h-p,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*at;let o=i.site[t],l=0;const f=i.V[t];let u=0,h=f;for(;l<e-1e-12;){h=i.V[t];const m=i.r[t],p=Math.hypot(i.vx[t],i.vy[t]);let d=Math.min(e-l,Math.max(1e-7,Kl*i.age[t]),.25*n.dx/(p+1e-9));d<1e-7&&(d=Math.min(e-l,1e-7));let g,x=-1,b=0;if(o>=0){const C=this.sites.fluid[o],E=this.sites.cell[o];if(C<0||E<0||!s.heat.hasSolid(E)){this.detach(t),o=-1;continue}const B=ht[this.sites.mat[o]],X=r.Tl[C],z=Ks(r.host[C],X);g=(B.k*n.Ts[E]+z*X)/(B.k+z),x=E}else{if(b=this.liquidFootprint(t),b===0)break;g=0;for(let C=0;C<b;C+=1)g+=this.wts[C]*r.Tl[this.cells[C]]}let y=0;if(r.salty)if(o>=0)y=this.dTb[this.sites.fluid[o]];else for(let C=0;C<b;C+=1)y+=this.wts[C]*this.dTb[this.cells[C]];const A=i.Tb[t],F=o>=0?r.host[this.sites.fluid[o]]:r.hostAt(i.x[t],i.y[t]),P=Ks(F,g),_=is(F,g),w=xr(F,g),k=en(F,g),M=P/(_*w),T=2*m,S=i.age[t],q=P*Math.sqrt(3/(Math.PI*M)),L=o>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),I=_*L*T/k,O=k*w/P,D=P/T*(2+.6*Math.sqrt(I)*Math.cbrt(O)),R=xt(A)-Ft(g);let V=Math.max(q*2*(Math.sqrt(S+d)-Math.sqrt(S)),D*d);if(o>=0&&g>A+y){const C=.5*this.fritz(t,g),E=i.m[a+Q]>0?i.m[a+Q]/i.V[t]:De(A),B=V*(g-A-y)/(E*R);if(m<C&&m+B>C&&B>0){const X=V*(C-m)/B;if(D*d>=q*2*(Math.sqrt(S+d)-Math.sqrt(S)))d=X/D;else{const z=Math.sqrt(S)+X/(2*q);d=z*z-S}d=Math.max(1e-9,Math.min(e-l,d*(1+1e-6))),V=Math.max(q*2*(Math.sqrt(S+d)-Math.sqrt(S)),D*d)}}const W=n.depth,N=i.V[t],Y=i.m[a+Q]>0?i.m[a+Q]/N:De(A),J=V*(g-A-y)/(Y*R),j=Math.max(0,m+J);let $;N<=Math.PI*W*W*W/6?$=4/3*Math.PI*(j*j*j-m*m*m):N>=Math.PI*W*W*W/4?$=Math.PI*W*(j*j-m*m):$=Math.PI*W*W*V*(g-A-y)/(Y*R);let U=Y*$*R;if(o>=0){const C=x,E=s.heat.solidCap(C)*Math.max(0,n.Ts[C]-A);U>0&&(U=Math.min(U,Math.max(0,E-this.used(C))))}else{let C=0;for(let E=0;E<b;E+=1)C+=this.wts[E]*this.budget[this.cells[E]];U>0?U=Math.min(U,Math.max(0,C)):U=Math.max(U,Math.min(0,C))}let G=U/R;G<0&&(G=Math.max(G,-i.m[a+Q]));let tt=1,pt=!1;if(o<0&&G!==0&&!r.mixed)for(let C=0;C<b&&!pt;C+=1)pt=r.acc[this.cells[C]]<=0;const wt=C=>r.acc[C]>0?r.waterShare(C):0;if(o<0&&G!==0&&(r.mixed||pt)){tt=0;for(let C=0;C<b;C+=1)tt+=this.wts[C]*wt(this.cells[C]);G*=tt}if(G!==0){if(o>=0){const C=this.sites.fluid[o];G>0&&r.acc[C]+this.Fm[C]-G<0&&(G=Math.max(0,r.acc[C]+this.Fm[C]));const E=r.waterH(C);this.Fm[C]-=G,s.heat.src[x]-=G*(xt(A)-E)/e,this.budgetSolid(x,G*(xt(A)-E))}else for(let C=0;C<b;C+=1){const E=this.cells[C],B=r.mixed||pt?this.wts[C]*wt(E)/tt:this.wts[C];if(B===0)continue;const X=r.waterH(E);this.Fm[E]-=G*B,s.heat.src[E]-=G*B*(xt(A)-X)/e,this.budget[E]-=G*B*(xt(A)-X)}i.m[a+Q]+=G,i.H[t]+=G*xt(A),u+=G}if(this.solve(t,g),this.restoreEnthalpy(t,o,b,e),i.r[t]<1e-6||i.m[a+Q]<=1e-18&&i.m[a+it]+i.m[a+rt]<=0){i.age[t]+=d;break}if(o>=0){const C=this.sites.position(this.e.grid,o,i.r[t]);i.x[t]=C[0],i.y[t]=C[1],this.departure(t,g),o=i.site[t]}else this.motion.move(t,d,(i.V[t]-h)/d);if(i.age[t]+=d,l+=d,i.m[a+Q]<=0&&i.m[a+it]+i.m[a+rt]<=0)break}i.dmdt[t]=u/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=no(r.m,t*at,r.Tb[t],ne),o=a-r.H[t];if(o!==0){if(r.H[t]=a,e>=0){i.heat.src[this.sites.cell[e]]-=o/n;return}if(s!==0)for(let l=0;l<s;l+=1)i.heat.src[this.cells[l]]-=o*this.wts[l]/n}}fritz(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return 1/0;const r=ht[this.sites.mat[i]],a=this.contactAngleOverride??r.contactAngle,o=n.totalMass(t)/Math.max(1e-30,n.V[t]),l=s.phase.host[this.sites.fluid[i]];return Wl*a*Math.sqrt(_s(l,n.Tb[t])/(s.gy*(is(l,e)-o)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const o=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],o),this.motion.ux0[t]=o[0],this.motion.uy0[t]=o[1],n.vx[t]=o[0],n.vy[t]=o[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const f=e.cellAt(s.x[l],s.y[l]);if(f<0){this.next[l]=-1;continue}this.next[l]=this.head[f],this.head[f]=l,s.r[l]>a&&(a=s.r[l])}const o=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const f=Math.floor(s.x[l]/r),u=Math.floor(s.y[l]/r);for(let h=Math.max(0,u-o);h<=Math.min(i-1,u+o);h+=1)for(let m=Math.max(0,f-o);m<=Math.min(n-1,f+o);m+=1)for(let p=this.head[m+h*n];p>=0;p=this.next[p]){if(p<=l||s.V[p]<=0)continue;const d=s.x[p]-s.x[l],g=s.y[p]-s.y[l],x=e.depth,y=2*s.r[l]>=x||2*s.r[p]>=x?0:s.z[p]-s.z[l],A=s.r[l]+s.r[p];d*d+g*g+y*y>=A*A||this.merge(l,p)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<at;a+=1)s.m[t*at+a]+=s.m[e*at+a],s.m[e*at+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*at,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Q]<=1e-18&&i.m[r+it]+i.m[r+rt]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const o=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(o<0||n.kind[o]===H||l<0||n.kind[l]===H)&&this.drop(t,!0,e)}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*at,o=i.n,l=r.m[a+Q],f=r.m[a+it]+r.m[a+rt];if(e||f>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==H;)m=m+i.nx<o?m+i.nx:-1;if(m<0&&(m=Nl(i,r.x[t])),m>=0){const p=Vl(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let d=0;d<p;d+=1){const g=this.cells[d],x=this.wts[d];for(let b=0;b<at;b+=1)i.mg[b*o+g]+=x*r.m[a+b];i.Hg[g]+=x*r.H[t],n.gas.deriveCell(g)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const p=n.phase;let d=1;if(p.mixed){d=0;for(let g=0;g<m;g+=1)d+=this.wts[g]*p.waterShare(this.cells[g])}for(let g=0;g<m;g+=1){const x=this.cells[g],b=p.mixed&&d>0?this.wts[g]*p.waterShare(x)/d:this.wts[g];if(b===0)continue;const y=p.waterH(x);this.Fm[x]+=l*b,n.heat.src[x]+=b*(r.H[t]-l*y)/s}}else{const p=i.cellAt(r.x[t],r.y[t]);p>=0&&(i.mg[Q*o+p]+=l,i.Hg[p]+=r.H[t],n.gas.deriveCell(p))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const u=r.site[t];u>=0&&(this.sites.bubble[u]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const h=r.count-1;if(t!==h){this.motion.ux0[t]=this.motion.ux0[h],this.motion.uy0[t]=this.motion.uy0[h];const m=r.site[h];m>=0&&(this.sites.bubble[m]=r.id[h])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let f=0;f<n.count;f+=1){const u=io(n.x[f],n.y[f],n.r[f],n.V[f],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let h=0;h<u;h+=1)i[this.cells[h]]+=this.wts[h]*n.V[f]*r}const a=s.alpha,o=e.liquid.volSrc,l=Oc*t;for(let f=0;f<s.n;f+=1){const u=i[f]-a[f];u!==0&&(u>l?(o[f]+=l*s.vCell/t,a[f]+=l):u<-l?(o[f]-=l*s.vCell/t,a[f]-=l):(o[f]+=u*s.vCell/t,a[f]=i[f]))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,o=a.add(t,e,s);if(o<0)return-1;const l=this.pressure(t,e),f=r.grid.cellAt(t,e),u=f>=0&&r.phase.Tl[f]>0?r.phase.Tl[f]:r.ambientT,h=l+2*_s(f>=0?r.phase.host[f]:0,u)/n,m=4/3*Math.PI*n*n*n,p=o*at;if(i<=0){const d=kt(h);a.m[p+Q]=De(d)*m}else{const d=h*m/(8.314462618*u);a.m[p+it]=d*.79*mt[it],a.m[p+rt]=d*.21*mt[rt]}return a.r[o]=n,this.solve(o,u),a.H[o]=no(a.m,p,a.Tb[o],ne),r.ledger.water+=a.m[p+Q],r.ledger.air+=a.m[p+it]+a.m[p+rt],r.ledger.energy+=a.H[o],this.motion.ux0[o]=0,this.motion.uy0[o]=0,o}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*at,n=t*re;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:kt(e.pb[t]),mv:e.m[s+Q],ma:e.m[s+it]+e.m[s+rt],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+re))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ft}}function ao(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const Ql={mass:0,energy:0},Xl={m:0,H:0,s:0};function Yl(c,t,e,s,n,i,r=Ql,a=[],o=Xl){const l=c.n;let f=0,u=0,h=0,m=0,p=0,d=0,g=0;for(let S=0;S<l;S+=1){const q=c.owner[S]!==0||c.capB[S]>0;if(c.kind[S]===ft||c.solid[S]!==0){q||(f+=c.Es[S],p+=c.film[S],d+=c.crust[S]);continue}u+=c.Hg[S],h+=c.mg[Q*l+S],m+=c.mfog[S],g+=c.mg[it*l+S]+c.mg[rt*l+S]}let x=0,b=0,y=0,A=0;for(let S=0;S<t.count;S+=1){x+=t.mass[S]*t.h[S];const q=t.smass[2*S];A+=q,t.mat[S]===ct?b+=t.mass[S]-q:y+=t.mass[S]-q}f+=r.energy;let F=0;for(const S of a)S.gone||(f+=S.energy(),p+=S.filmMass(),d+=S.crustMass(),Ve(S.mat)>0&&(F+=S.m));x+=o.H,b+=o.m,A+=o.s;let P=0,_=0;for(let S=0;S<e.count;S+=1)P+=e.H[S],_+=e.m[S*at+Q],g+=e.m[S*at+it]+e.m[S*at+rt];const w=s.pvTerm();i.solids=f,i.liquid=x,i.gas=u,i.bubbles=P,i.pv=w,i.energy=f+x+u+P+w;const k=i.water;k.liquid=b,k.ice=F,k.vapour=h,k.fog=m,k.film=p,k.bubbles=_,k.escaped=n.escapedWater,k.total=b+F+h+m+p+_+n.escapedWater;const M=i.other;M.liquid=y,M.escaped=n.escapedOther,M.total=y+n.escapedOther;const T=i.salt;return T.liquid=A,T.crust=d,T.floor=r.mass,T.escaped=n.escapedSalt,T.total=A+d+r.mass+n.escapedSalt,i.air=g+n.escapedAir,i}function Jl(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,ice:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0}}}function Gs(c,t){c.bodies.list.length!==0&&Sl(c.bodies,t,c.ledger)}function Zl(c,t){const e=new Float64Array(2),s=c.particles;for(let i=0;i<s.count;i+=1)It.toLocal(t.x,t.y,t.a,s.x[i],s.y[i],e),t.insideLocal(e[0],e[1])&&(vn(c,i),c.liquid.removeParticle(i),i-=1);const n=c.bubbles;for(let i=0;i<n.count;i+=1)It.toLocal(t.x,t.y,t.a,n.x[i],n.y[i],e),t.insideLocal(e[0],e[1])&&(c.ledger.water-=n.m[i*at+Q],c.ledger.air-=n.m[i*at+it]+n.m[i*at+rt],c.ledger.energy-=n.H[i],n.remove(i),i-=1);c.liquid.weightsDirty=!0}function Fi(c,t,e,s,n,i,r,a,o=-1){const l=c.bodies.adopt(t,e,s,c.opIndex,n,o);if(l===null)return null;i!==0&&c.bodies.turn(l,r,a,i*Math.PI/180),c.ledger.energy+=l.energy(),Ve(l.mat)>0&&(c.ledger.water+=l.m),Zl(c,l);const f=c.grid,u=new Map,h=f.dx*f.dx;for(let m=0;m<l.nw;m+=1){const p=l.wc[m];u.set(p,(u.get(p)??0)+l.ww[m]*l.cellVolume(l.wk[m])/(l.depth*h))}for(const[m,p]of u)p>0&&f.solid[m]===0&&tf(c,m,Math.min(1,p));return l}function Dn(c,t,e){const[s,n,i,r]=gn(t),a=Math.max(0,Math.floor(s/c.dx)),o=Math.min(c.nx-1,Math.ceil(i/c.dx)),l=Math.max(0,Math.floor(n/c.dx)),f=Math.min(c.ny-1,Math.ceil(r/c.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=o;h+=1)os(t,(h+.5)*c.dx,(u+.5)*c.dx)&&e(h+u*c.nx,h,u)}function xn(c,t){const e=c.grid,s=e.n;c.ledger.water-=e.mg[Q*s+t]+e.mfog[t],c.ledger.air-=e.mg[it*s+t]+e.mg[rt*s+t],c.ledger.energy-=e.Hg[t];for(let n=0;n<at;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function tf(c,t,e){if(e>=1){xn(c,t);return}const s=c.grid,n=s.n;c.ledger.water-=e*(s.mg[Q*n+t]+s.mfog[t]),c.ledger.air-=e*(s.mg[it*n+t]+s.mg[rt*n+t]),c.ledger.energy-=e*s.Hg[t];for(let i=0;i<at;i+=1)s.mg[i*n+t]*=1-e;s.mfog[t]*=1-e,s.Hg[t]*=1-e}function Mr(c,t,e,s){const n=c.grid,i=n.n;xn(c,t),c.gas.fillCell(t,e,s,Math.max(.001,1-n.fs[t]-n.phi[t]-n.alpha[t])),c.ledger.water+=n.mg[Q*i+t],c.ledger.air+=n.mg[it*i+t]+n.mg[rt*i+t],c.ledger.energy+=n.Hg[t]}function vn(c,t){const e=c.particles,s=e.smass[2*t];e.mat[t]===ct?c.ledger.water-=e.mass[t]-s:c.ledger.other-=e.mass[t]-s,c.ledger.salt-=s,c.ledger.energy-=e.mass[t]*e.h[t]}function Tr(c,t){c.ledger.salt-=c.grid.crust[t],c.grid.crust[t]=0}function Ai(c,t){const e=c.particles;for(let n=0;n<e.count;n+=1)os(t,e.x[n],e.y[n])&&(vn(c,n),c.liquid.removeParticle(n),n-=1);const s=c.bubbles;for(let n=0;n<s.count;n+=1)os(t,s.x[n],s.y[n])&&(c.ledger.water-=s.m[n*at+Q],c.ledger.air-=s.m[n*at+it]+s.m[n*at+rt],c.ledger.energy-=s.H[n],s.remove(n),n-=1);c.liquid.weightsDirty=!0}function ef(c,t,e,s,n){const i=c.grid,r=ht[e];for(const o of t)i.owner[o]!==0&&i.solid[o]!==0||(i.solid[o]!==0?(c.ledger.energy-=i.Es[o],c.ledger.water-=i.film[o],Tr(c,o)):xn(c,o),i.owner[o]=0,i.capB[o]=0,i.fs[o]=0,i.crust[o]=0,i.solid[o]=e+1,i.role[o]=0,i.heater[o]=n,i.film[o]=0,i.T[o]=s,i.Es[o]=r.rho*r.cp*i.vCell*(s-st),i.kind[o]=ft,c.ledger.energy+=i.Es[o]);const a=c.particles;for(let o=0;o<a.count;o+=1){const l=i.cellAt(a.x[o],a.y[o]);l<0||i.solid[l]===0||(vn(c,o),c.liquid.removeParticle(o),o-=1)}c.solidsChanged()}function sf(c,t){const e=c.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,c.ledger.energy-=e.Es[n],c.ledger.water-=e.film[n],Tr(c,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){c.solidsChanged();for(const n of t)e.solid[n]===0&&c.gas.massOf(n)<=0&&Mr(c,n,c.ambientT,c.ambientY)}}function nf(c,t){const e=c.grid;switch(t.op){case"fill":{if(t.phase==="gas"){Ai(c,t.region);const g=new Float64Array(at);let x=0;for(const[b,y]of Object.entries(t.composition)){const A=b==="N2"?it:b==="O2"?rt:b==="H2O"?Q:-1;A>=0&&(g[A]=y,x+=y)}if(x<=0)g.set(c.ambientY.subarray(0,at));else for(let b=0;b<yt;b+=1)g[b]/=x;return Dn(e,t.region,b=>{e.solid[b]===0&&Mr(c,b,t.T,g)}),null}Ai(c,t.region);const s=oe.length;let n=0;for(const[g,x]of Object.entries(t.composition))bc(g)>=0&&x>0&&(n+=x);const i=t.composition[oe[ct].id]??0,r=n>0&&i>0?n/(n+i):0,a=g=>g===ct&&r>0?br(t.T,r):is(g,t.T),o=new Float64Array(s);let l=0;for(const[g,x]of Object.entries(t.composition)){const b=ac(g);if(b<0||!(x>0))continue;const y=b===ct&&r>0?x+n:x;o[b]+=y/a(b),l+=y/a(b)}if(l<=0)return"fill: no known liquid in the composition";for(let g=0;g<s;g+=1)o[g]/=l;const f=new Float64Array(s),u=new Float64Array(s);for(let g=0;g<s;g+=1)f[g]=a(g)*e.vCell/4,u[g]=g===ct&&r>0?Sc(t.T,r):ba(g,t.T);const h=r*f[ct],m=new Float64Array(s),p=c.particles;let d=!1;return of(e,t.region,(g,x)=>{const b=g+x*e.nx;if(e.solid[b]!==0)return;let y=0;for(let A=0;A<2;A+=1)for(let F=0;F<2;F+=1){const P=(g+.25+.5*F)*e.dx,_=(x+.25+.5*A)*e.dx;if(!os(t.region,P,_)||e.owner[b]!==0&&c.bodies.bodyAt(P,_,0)!==null)continue;let w=0;for(let S=0;S<s;S+=1)m[S]+=o[S],m[S]>m[w]&&(w=S);m[w]-=1;const k=f[w],M=u[w],T=w===ct?h:0;if(p.add(P,_,k,M,w,T)<0){d=!0;continue}y+=1,w===ct?c.ledger.water+=k-T:c.ledger.other+=k,c.ledger.salt+=T,c.ledger.energy+=k*M}y===4&&xn(c,b)}),c.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":d?"fill: particle capacity reached":null}case"erase":{Gs(c,t.region),Ai(c,t.region);const s=[];return Dn(e,t.region,n=>{e.owner[n]===0&&s.push(n)}),sf(c,s),null}case"move":return rf(c,t.region,t.dx,t.dy),null;case"solid":{const s=$s(t.material);if(s<0)return`solid: unknown material ${t.material}`;Gs(c,t.region);const n=[];if(Dn(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,o]=t.region.line,l=Math.ceil(Math.hypot(a-i,o-r)/(.5*e.dx))+1;for(let f=0;f<=l;f+=1){const u=e.cellAt(i+(a-i)*f/l,r+(o-r)*f/l);u>=0&&!n.includes(u)&&n.push(u)}}return c.bodies.sync(),ef(c,n,s,t.T,-1),null}case"body":{const s=$s(t.material);if(s<0)return`body: unknown material ${t.material}`;Gs(c,t.region);const n=t.region;let i=null,r,a=t.angle,o,l;if("line"in n){const[f,u,h,m]=n.line,p=Math.max(n.width,Math.hypot(h-f,m-u));o=(f+h)/2,l=(u+m)/2,r=[o-p/2,l-n.width/2,o+p/2,l+n.width/2],a+=Math.atan2(m-u,h-f)*180/Math.PI}else if("circle"in n){const[f,u,h]=n.circle,m=.5*h*Math.sqrt(Math.PI);r=[f-m,u-m,f+m,u+m],o=f,l=u,i="body: bodies are rectangles — the circle became a square of the same area"}else{const[f,u,h,m]=gn(n);r=[f,u,h,m],o=(f+h)/2,l=(u+m)/2,"poly"in n&&(i="body: bodies are rectangles — the polygon became its bounding rectangle")}return Fi(c,[r],s,t.T,t.pinned,a,o,l),i}case"pin":{const s=c.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(c.bodies.pin(s,t.pinned),null)}case"beaker":{const s=$s(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.min(t.wall,.45*t.w,.45*t.h),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,o=t.y+t.h,l=t.lid?o-n:o,f=[[i,a,r,a+n],[i,a+n,i+n,l],[r-n,a+n,r,l]];t.lid&&f.push([i,l,r,o]);for(const u of f)Gs(c,{rect:[...u]});return Fi(c,f,s,t.T,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=$s(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=c.heat.heaters.length;c.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=[t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h];return Gs(c,{rect:[...i]}),Fi(c,[i],s,t.T,t.pinned,t.angle,t.x,t.y,n),null}}}function rf(c,t,e,s){const n=c.grid,{nx:i,ny:r,dx:a}=n,o=[];Dn(n,t,x=>{n.solid[x]!==0&&n.owner[x]===0&&o.push(x)});const l=Math.round(e/a),f=Math.round(s/a),u=o.length>0?l*a:e,h=o.length>0?f*a:s;if(u===0&&h===0)return;const m=c.bodies.list.length>0?Cl(c.bodies,t):[],p=c.particles,d=c.bubbles;for(let x=0;x<p.count;x+=1){if(!os(t,p.x[x],p.y[x]))continue;const b=p.x[x]+u,y=p.y[x]+h;if(b<=0||y<=0||b>=n.w||y>=n.h){vn(c,x),c.liquid.removeParticle(x),x-=1;continue}p.x[x]=b,p.y[x]=y}for(let x=0;x<d.count;x+=1)os(t,d.x[x],d.y[x])&&(d.x[x]=Math.min(n.w-1e-6,Math.max(1e-6,d.x[x]+u)),d.y[x]=Math.min(n.h-1e-6,Math.max(1e-6,d.y[x]+h)),d.site[x]=-1);if(c.liquid.weightsDirty=!0,o.length===0){if(m.length===0)return;Zr(c.bodies,m,u,h),c.bodies.sync();for(const x of m)c.bodies.cover.pushOut(x,x.x,x.y,x.a);lo(c);return}const g=o.map(x=>({c:x,s:n.solid[x],role:n.role[x],heater:n.heater[x],T:n.T[x],Es:n.Es[x],film:n.film[x],crust:n.crust[x]}));for(const x of g)c.ledger.energy-=x.Es,c.ledger.water-=x.film,c.ledger.salt-=x.crust,n.solid[x.c]=0,n.role[x.c]=0,n.heater[x.c]=-1,n.Es[x.c]=0,n.film[x.c]=0,n.crust[x.c]=0,n.kind[x.c]=0;for(const x of g){const b=x.c%i+l,y=Math.floor(x.c/i)+f;if(b<0||y<0||b>=i||y>=r)continue;const A=b+y*i;n.solid[A]!==0?(c.ledger.energy-=n.Es[A],c.ledger.water-=n.film[A],Tr(c,A)):xn(c,A),n.solid[A]=x.s,n.role[A]=x.role,n.heater[A]=x.heater,n.T[A]=x.T,n.Es[A]=x.Es,n.film[A]=x.film,n.crust[A]=x.crust,n.kind[A]=ft,c.ledger.energy+=x.Es,c.ledger.water+=x.film,c.ledger.salt+=x.crust}Zr(c.bodies,m,u,h),c.solidsChanged();for(const x of m)c.bodies.cover.pushOut(x,x.x,x.y,x.a);lo(c);for(const x of g)n.solid[x.c]===0&&c.gas.massOf(x.c)<=0&&Mr(c,x.c,c.ambientT,c.ambientY)}function lo(c){const t=c.grid,e=c.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||t.owner[n]!==0||(vn(c,s),c.liquid.removeParticle(s),s-=1)}}function of(c,t,e){const[s,n,i,r]=gn(t),a=Math.max(0,Math.floor(s/c.dx)),o=Math.min(c.nx-1,Math.floor(i/c.dx)),l=Math.max(0,Math.floor(n/c.dx)),f=Math.min(c.ny-1,Math.floor(r/c.dx));for(let u=l;u<=f;u+=1)for(let h=a;h<=o;h+=1)e(h,u)}const cf=.02;function af(c){if(!(c>1e-8))return c>0?c:0;const t=Math.log(1+c);let e=c<1?c*(1-c/(1+c)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-c;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function lf(c,t){const e=2*Math.max(0,c-cf)*t;return e>1e-8?e/af(e):1}function ff(c,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:a}=c,o=s+1,l=(y,A)=>.5*(r[y+A*o]+r[y+1+A*o]),f=(y,A)=>.5*(a[y+A*s]+a[y+(A+1)*s]),u=(r[t+1+e*o]-r[t+e*o])/i,h=(a[t+(e+1)*s]-a[t+e*s])/i,m=Math.max(0,e-1),p=Math.min(n-1,e+1),d=Math.max(0,t-1),g=Math.min(s-1,t+1),x=p>m?(l(t,p)-l(t,m))/((p-m)*i):0,b=g>d?(f(g,e)-f(d,e))/((g-d)*i):0;return Math.hypot(.5*(u-h),.5*(x+b))}class uf{constructor(t){v(this,"e");v(this,"cap");v(this,"capT");v(this,"capA");v(this,"salt");v(this,"water");v(this,"fH");v(this,"fS");v(this,"outS");v(this,"outH");v(this,"inS");v(this,"inH");v(this,"cell",new Int32Array(0));v(this,"cpp",new Float64Array(0));v(this,"ds",new Float64Array(0));v(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0){this.cap.fill(0),this.capT.fill(0),this.salt.fill(0),this.water.fill(0);return}this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:a,salt:o,water:l,fH:f,fS:u,cell:h,cpp:m}=this;i.fill(0),r.fill(0),a.fill(0),o.fill(0),l.fill(0);let p=!1;for(let y=0;y<e.count;y+=1){const A=s.cellAt(e.x[y],e.y[y]);if(h[y]=A,A<0)continue;const F=e.cp(y);m[y]=F;const P=e.mass[y]*F,_=e.T[y];if(i[A]+=P,r[A]+=P*_,a[A]+=P*Ks(e.mat[y],_)/(e.rho[y]*F),e.mat[y]!==ct)continue;const w=e.smass[2*y];o[A]+=w,l[A]+=e.mass[y]-w,w>0&&(p=!0)}const{nx:d,ny:g,kind:x}=s,b=Math.PI*Math.PI*t/(s.dx*s.dx);for(let y=0;y<s.n;y+=1){if(f[y]=0,u[y]=0,!(i[y]>0))continue;const A=y%d,F=(y-A)/d;if(!(x[y]!==et&&(x[y]!==H||!(A>0&&x[y-1]===et||A<d-1&&x[y+1]===et||F>0&&x[y-d]===et||F<g-1&&x[y+d]===et)))&&(f[y]=1-Math.exp(-b*a[y]/i[y]),p&&o[y]>0)){const P=Hr(r[y]/i[y]);u[y]=1-Math.exp(-b*P*lf(ff(s,A,F),t/(b*P)))}}for(let y=0;y<e.count;y+=1){const A=h[y];if(A<0||f[A]===0)continue;const F=f[A]*(r[A]/i[A]-e.T[y]);if(F===0)continue;const P=e.mass[y]/e.rho[y];e.h[y]+=m[y]*F,e.derive(y),n.dVp[y]+=e.mass[y]/e.rho[y]-P}p&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:a,outH:o,inS:l,inH:f,cell:u,ds:h,hs:m}=this;a.fill(0),o.fill(0);for(let d=0;d<e.count;d+=1){h[d]=0;const g=u[d];if(g<0||r[g]===0||e.mat[d]!==ct)continue;const x=e.smass[2*d],b=r[g]*(n[g]/i[g]*(e.mass[d]-x)-x);if(h[d]=b,b<0){const y=Gr(e.T[d],x/e.mass[d]);m[d]=y,a[g]-=b,o[g]-=b*y}}const p=this.saltBetween(t);for(let d=0;d<e.count;d+=1){const g=u[d];if(g<0||e.mat[d]!==ct)continue;let x=h[d],b=0;x<0?b=x*m[d]:x>0&&(a[g]>0?b=x*o[g]/a[g]:x=0);const y=e.smass[2*d],A=e.mass[d];if(p&&(l[g]!==0||f[g]!==0)){const _=l[g]<0?y/n[g]:(A-y)/i[g];x+=l[g]*_,b+=f[g]*_}if(x===0&&b===0)continue;const F=A*e.h[d]+b,P=A/e.rho[d];e.mass[d]=A+x,e.smass[2*d]=y+x,e.spc[2*d]=y+x>0?yr:0,e.h[d]=F/e.mass[d],e.derive(d),s.dVp[d]+=e.mass[d]/e.rho[d]-P}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:a,inS:o,inH:l}=this,{nx:f,ny:u}=e;o.fill(0),l.fill(0);const h=t/(e.dx*e.dx);let m=!1;const p=(d,g,x)=>{if(i[g]===0||!(n[g]>0)||!(x>0))return;const b=s[d]/n[d],y=s[g]/n[g];if(b===y)return;const A=b>y?d:g,F=b>y?g:d,P=Hr(.5*(a[d]/r[d]+a[g]/r[g])),_=(x<1?x*P:P)*h*Math.min(n[d],n[g])*Math.abs(b-y),w=Gr(a[A]/r[A],s[A]/(s[A]+n[A]));o[A]-=_,l[A]-=_*w,o[F]+=_,l[F]+=_*w,m=!0};for(let d=0;d<u;d+=1)for(let g=0;g<f;g+=1){const x=g+d*f;i[x]===0||!(n[x]>0)||(g+1<f&&p(x,x+1,e.au[g+1+d*(f+1)]),d+1<u&&p(x,x+f,e.av[x+f]))}return m}}const Vt=yt+2,ee=yt,ae=yt+1,hf=.9,df=16;class Qs{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Vt*s),this.fu=new Float64Array(Vt*t.nu),this.fv=new Float64Array(Vt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,o=s+1,l=e.ug,f=e.vg;let u=0,h=0;for(let A=0;A<n;A+=1)for(let F=0;F<s;F+=1){const P=F+A*s;if(r[P]!==H)continue;const _=F+A*o,w=l[_],k=l[_+1],M=f[P],T=f[P+s],S=(w<0?-w:0)+(k>0?k:0)+(M<0?-M:0)+(T>0?T:0);S>u&&(u=S);const q=Math.max(w<0?-w:w,k<0?-k:k,M<0?-M:M,T<0?-T:T);q>h&&(h=q)}this.gas.last.uMax=h;const m=Math.min(df,Math.max(1,Math.ceil(u*t/a/hf))),p=t/m,{conc:d}=this,g=this.gas.vgas,x=e.mg,b=e.mfog,y=e.Hg;for(let A=0;A<m;A+=1){for(let F=0;F<i;F+=1){if(r[F]!==H){for(let _=0;_<Vt;_+=1)d[_*i+F]=0;continue}const P=1/g[F];for(let _=0;_<yt;_+=1)d[_*i+F]=x[_*i+F]*P;d[ee*i+F]=b[F]*P,d[ae*i+F]=y[F]*P}this.fluxesU(p),this.fluxesV(p),this.limitOutflow(),this.applyFluxes()}for(let A=0;A<i;A+=1)r[A]===H&&this.gas.deriveCell(A);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,o=e.nu,l=e.ug,{conc:f,fu:u}=this,{amb:h,gasU:m}=this.gas,p=e.aFace,d=Qs.face;for(let g=0;g<n;g+=1){const x=g*s,b=g*a;for(let y=0;y<=s;y+=1){const A=b+y,F=l[A];if(m[A]===0||F===0){for(let M=0;M<Vt;M+=1)u[M*o+A]=0;continue}const P=e.au[A]<1?F*p*t*e.au[A]:F*p*t;if(y===0||y===s){const M=y===0?x:x+s-1,T=y===0?F>0:F<0;for(let S=0;S<Vt;S+=1)u[S*o+A]=P*(T?h[S]:f[S*i+M]);continue}let _,w,k;if(F>0?(_=x+y-1,w=x+y,k=y>=2&&r[x+y-2]===H?x+y-2:-1):(_=x+y,w=x+y-1,k=y+1<s&&r[x+y+1]===H?x+y+1:-1),k<0){for(let M=0;M<Vt;M+=1)u[M*o+A]=P*f[M*i+_];continue}for(let M=0;M<Vt;M+=1){const T=M*i;u[M*o+A]=P*d(f[T+_],f[T+k],f[T+w])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,o=e.vg,{conc:l,fv:f}=this,{amb:u,gasV:h}=this.gas,m=e.aFace,p=Qs.face;for(let d=0;d<=n;d+=1){const g=d*s;for(let x=0;x<s;x+=1){const b=g+x,y=o[b];if(h[b]===0||y===0){for(let w=0;w<Vt;w+=1)f[w*a+b]=0;continue}const A=e.av[b]<1?y*m*t*e.av[b]:y*m*t;if(d===0||d===n){const w=d===0?x:x+(n-1)*s,k=d===0?y>0:y<0;for(let M=0;M<Vt;M+=1)f[M*a+b]=A*(k?u[M]:l[M*i+w]);continue}let F,P,_;if(y>0?(F=b-s,P=b,_=d>=2&&r[b-2*s]===H?b-2*s:-1):(F=b,P=b-s,_=d+1<n&&r[b+s]===H?b+s:-1),_<0){for(let w=0;w<Vt;w+=1)f[w*a+b]=A*l[w*i+F];continue}for(let w=0;w<Vt;w+=1){const k=w*i;f[w*a+b]=A*p(l[k+F],l[k+_],l[k+P])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:o,fv:l}=this,{gasU:f,gasV:u,escaped:h}=this.gas,m=t.mg,p=t.mfog,d=t.Hg;for(let g=0;g<s;g+=1){const x=g*e,b=g*i;for(let A=1;A<e;A+=1){const F=b+A;if(f[F]===0)continue;const P=x+A-1,_=P+1;for(let M=0;M<yt;M+=1){const T=o[M*r+F];m[M*n+P]-=T,m[M*n+_]+=T}const w=o[ee*r+F];p[P]-=w,p[_]+=w;const k=o[ae*r+F];d[P]-=k,d[_]+=k}if(f[b]!==0){const A=x;for(let _=0;_<yt;_+=1){const w=o[_*r+b];m[_*n+A]+=w,h[_]-=w}const F=o[ee*r+b];p[A]+=F,h[ee]-=F;const P=o[ae*r+b];d[A]+=P,h[ae]-=P}const y=b+e;if(f[y]!==0){const A=x+e-1;for(let _=0;_<yt;_+=1){const w=o[_*r+y];m[_*n+A]-=w,h[_]+=w}const F=o[ee*r+y];p[A]-=F,h[ee]+=F;const P=o[ae*r+y];d[A]-=P,h[ae]+=P}}for(let g=1;g<s;g+=1){const x=g*e;for(let b=0;b<e;b+=1){const y=x+b;if(u[y]===0)continue;const A=y-e,F=y;for(let w=0;w<yt;w+=1){const k=l[w*a+y];m[w*n+A]-=k,m[w*n+F]+=k}const P=l[ee*a+y];p[A]-=P,p[F]+=P;const _=l[ae*a+y];d[A]-=_,d[F]+=_}}for(let g=0;g<e;g+=1){if(u[g]!==0){const b=g;for(let F=0;F<yt;F+=1){const P=l[F*a+g];m[F*n+b]+=P,h[F]-=P}const y=l[ee*a+g];p[b]+=y,h[ee]-=y;const A=l[ae*a+g];d[b]+=A,h[ae]-=A}const x=g+s*e;if(u[x]!==0){const b=g+(s-1)*e;for(let F=0;F<yt;F+=1){const P=l[F*a+x];m[F*n+b]-=P,h[F]+=P}const y=l[ee*a+x];p[b]-=y,h[ee]+=y;const A=l[ae*a+x];d[b]-=A,h[ae]+=A}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:o,scale:l}=this,f=t.nu,u=t.nv;o.fill(0);const h=Qs.massFlux,{gasU:m,gasV:p}=this.gas;for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const b=x+g*i;if(m[b]===0)continue;const y=h(r,f,b);y>0&&x>0?o[x-1+g*e]+=y:y<0&&x<e&&(o[x+g*e]-=y)}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const b=x+g*e;if(p[b]===0)continue;const y=h(a,u,b);y>0&&g>0?o[x+(g-1)*e]+=y:y<0&&g<s&&(o[x+g*e]-=y)}let d=!1;for(let g=0;g<n;g+=1){const x=.9*this.gas.massOf(g);l[g]=o[g]>x&&o[g]>0?x/o[g]:1,l[g]<1&&(d=!0)}if(d){for(let g=0;g<s;g+=1)for(let x=0;x<=e;x+=1){const b=x+g*i;if(m[b]===0)continue;const A=h(r,f,b)>0?x>0?x-1+g*e:-1:x<e?x+g*e:-1;if(!(A<0||l[A]>=1))for(let F=0;F<Vt;F+=1)r[F*f+b]*=l[A]}for(let g=0;g<=s;g+=1)for(let x=0;x<e;x+=1){const b=x+g*e;if(p[b]===0)continue;const A=h(a,u,b)>0?g>0?x+(g-1)*e:-1:g<s?x+g*e:-1;if(!(A<0||l[A]>=1))for(let F=0;F<Vt;F+=1)a[F*u+b]*=l[A]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=ee;i+=1)n+=t[i*e+s];return n}}const Qt=.05;class mf{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(Vt));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(Vt));v(this,"dp0",new Float64Array(8));v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new Qs(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<yt;a+=1)n+=s[a]/mt[a];const i=e/(jt*t*n);let r=0;for(let a=0;a<yt;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*ne(a,t);this.amb[ee]=0,this.amb[ae]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*Ft(e);for(let r=0;r<yt;r+=1)i+=s.mg[r*n+t]*ne(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return $i(s.mg[t],s.mg[n+t],s.mg[Q*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.fs[t]-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[Q*s+t],o=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/mt[0]+r/mt[1]+a/mt[Q],l+o<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let f;if(o<=0)f=rc(i,r,a,e.Hg[t]);else{f=e.T[t]>100?e.T[t]:this.ambT;for(let u=0;u<4;u+=1){const h=(e.Hg[t]-this.enthalpy(t,f))/this.heatCapacity(t,f);if(f+=h,Math.abs(h)<1e-10)break}}f>150&&f<3e3||(f=Math.min(3e3,Math.max(150,Number.isFinite(f)?f:this.ambT))),e.T[t]=f,this.cap[t]=$i(i,r,a,o,f),this.rho[t]=l/n,this.mu[t]=xa(i,r,a,f)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ft){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===et&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*jt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ft){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Q*e+s];if(t.kind[s]===et&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.fs[s]-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*jt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ft||this.vgas[e]<=0?0:this.nmol[e]*jt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<yt;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let o=0;for(let u=0;u<yt;u+=1)o+=s[u]/mt[u];const l=this.R.pAt(t)*a/(jt*e*o);let f=0;for(let u=0;u<yt;u+=1)i.mg[u*r+t]=l*s[u],f+=l*s[u]*ne(u,e);i.mfog[t]=0,i.Hg[t]=f,i.T[t]=e}transitions(t){const e=this.g,{nx:s,n,kind:i}=e;let r=0;for(let a=0;a<n;a+=1){const o=t[a],l=i[a];if(o===l||l===ft||o===ft)continue;r+=1;const f=a%s,u=(a-f)/s;let h=0;for(let m=0;m<4;m+=1){const p=this.across(a,f,u,m);p>=0&&i[p]===H&&t[p]===H&&(h+=this.vgas[p]>0?this.vgas[p]:e.vCell)}if(!(h<=0)){if(l===et)for(let m=0;m<4;m+=1){const p=this.across(a,f,u,m);if(p<0||i[p]!==H||t[p]!==H)continue;const d=(this.vgas[p]>0?this.vgas[p]:e.vCell)/h;this.move(a,p,d)}else{let m=this.massOf(a),p=0;for(let d=0;d<4;d+=1){const g=this.across(a,f,u,d);if(g<0||i[g]!==H||t[g]!==H)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h;p+=x*this.rho[g]}if(p*=Math.max(.001,1-e.fs[a]-e.phi[a]-e.alpha[a])*e.vCell,p<=m)continue;for(let d=0;d<4;d+=1){const g=this.across(a,f,u,d);if(g<0||i[g]!==H||t[g]!==H)continue;const x=(this.vgas[g]>0?this.vgas[g]:e.vCell)/h,b=this.massOf(g);if(b<=0)continue;const y=Math.min(.25,(p-m)*x/b);this.move(g,a,y)}m=this.massOf(a),m>0&&(e.T[a]=this.ambT)}this.deriveCell(a)}}return r}across(t,e,s,n){const i=this.g,{nx:r,ny:a}=i;return n===0?e>0&&i.au[e+s*(r+1)]>0?t-1:-1:n===1?e<r-1&&i.au[e+1+s*(r+1)]>0?t+1:-1:n===2?s>0&&i.av[t]>0?t-r:-1:s<a-1&&i.av[t+r]>0?t+r:-1}move(t,e,s){const n=this.g,i=n.n;for(let o=0;o<yt;o+=1){const l=n.mg[o*i+t]*s;n.mg[o*i+t]-=l,n.mg[o*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let o=0;o<s;o+=1)for(let l=0;l<=e;l+=1){const f=l+o*i,u=l>0?n[l-1+o*e]:-1,h=l<e?n[l+o*e]:-1;let m=0;(u===H&&h===H||l===0&&t.openL&&h===H||l===e&&t.openR&&u===H)&&(m=1),t.au[f]<=0&&(m=0),this.gasU[f]=m,m===0&&(r[f]=u===et||h===et?u===ft||h===ft||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[f]:t.usol[f])}for(let o=0;o<=s;o+=1)for(let l=0;l<e;l+=1){const f=l+o*e,u=o>0?n[l+(o-1)*e]:-1,h=o<s?n[l+o*e]:-1;let m=0;(u===H&&h===H||o===0&&t.openB&&h===H||o===s&&t.openT&&u===H)&&(m=1),t.av[f]<=0&&(m=0),this.gasV[f]=m,m===0&&(a[f]=u===et||h===et?u===ft||h===ft||o===0&&!t.openB||o===s&&!t.openT?0:t.vl[f]:t.vsol[f])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,o=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),f=Math.min(r-1.000001,Math.max(0,s/a-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h,d=t[u+h*o],g=t[u+1+h*o],x=t[u+(h+1)*o],b=t[u+1+(h+1)*o];return this.lo=Math.min(d,g,x,b),this.hi=Math.max(d,g,x,b),(1-p)*((1-m)*d+m*g)+p*((1-m)*x+m*b)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,o=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),f=Math.floor(o),u=Math.floor(l),h=o-f,m=l-u,p=t[f+u*i],d=t[f+1+u*i],g=t[f+(u+1)*i],x=t[f+1+(u+1)*i];return this.lo=Math.min(p,d,g,x),this.hi=Math.max(p,d,g,x),(1-m)*((1-h)*p+h*d)+m*((1-h)*g+h*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,o=n+1,l=s.ug,f=s.vg,{u0:u,v0:h,u1:m,v1:p}=this,d=this.lim;u.set(l),h.set(f);for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*o;if(this.gasU[F]===0){m[F]=u[F];continue}const P=A*r,_=(y+.5)*r,w=this.sampleV(h,P,_);m[F]=this.sampleU(u,P-t*u[F],_-t*w),d[2*F]=this.lo,d[2*F+1]=this.hi}const g=2*s.nu;for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0){p[F]=h[F];continue}const P=(A+.5)*r,_=y*r,w=this.sampleU(u,P,_);p[F]=this.sampleV(h,P-t*w,_-t*h[F]),d[g+2*F]=this.lo,d[g+2*F+1]=this.hi}for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*o;if(this.gasU[F]===0)continue;const P=A*r,_=(y+.5)*r,w=this.sampleV(h,P,_),k=this.sampleU(m,P+t*u[F],_+t*w);let M=m[F]+.5*(u[F]-k);(M<d[2*F]||M>d[2*F+1])&&(M=m[F]),l[F]=M}for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const P=(A+.5)*r,_=y*r,w=this.sampleU(u,P,_),k=this.sampleV(p,P+t*w,_+t*h[F]);let M=p[F]+.5*(h[F]-k);(M<d[g+2*F]||M>d[g+2*F+1])&&(M=p[F]),f[F]=M}const x=this.R;for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const P=y>0?A+(y-1)*n:-1,_=y<i?A+y*n:-1,w=P>=0&&a[P]===H?this.rho[P]:-1,k=_>=0&&a[_]===H?this.rho[_]:-1,M=Math.max(Qt,w>0&&k>0?.5*(w+k):Math.max(w,k));if(!(w>0||k>0))continue;const T=w>0?P:_,S=x.id[T],q=S>=0?x.rhoBar[S]:x.rhoAmb;f[F]-=t*e*(M-q)/M}m.set(l),p.set(f);const b=t/(r*r);for(let y=0;y<i;y+=1)for(let A=0;A<=n;A+=1){const F=A+y*o;if(this.gasU[F]===0)continue;const P=A<n&&a[A+y*n]===H?A+y*n:A-1+y*n,_=this.mu[P]/Math.max(Qt,this.rho[P]),w=m[F],k=A<n?m[F+1]:w,M=A>0?m[F-1]:w,T=y>0?m[F-o]:s.openB?w:-w,S=y<i-1?m[F+o]:s.openT?w:-w;l[F]=w+Math.min(.2,b*_)*(k+M+T+S-4*w)}for(let y=0;y<=i;y+=1)for(let A=0;A<n;A+=1){const F=A+y*n;if(this.gasV[F]===0)continue;const P=y<i&&a[A+y*n]===H?A+y*n:A+(y-1)*n,_=this.mu[P]/Math.max(Qt,this.rho[P]),w=p[F],k=y<i?p[F+n]:w,M=y>0?p[F-n]:w,T=A>0?p[F-1]:s.openL?w:-w,S=A<n-1?p[F+1]:s.openR?w:-w;f[F]=w+Math.min(.2,b*_)*(S+T+M+k-4*w)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==H){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}fluxU(t){const e=this.g,s=e.au[t];return this.gasU[t]!==0&&s<1?s*e.ug[t]+(1-s)*e.usol[t]:e.ug[t]}fluxV(t){const e=this.g,s=e.av[t];return this.gasV[t]!==0&&s<1?s*e.vg[t]+(1-s)*e.vsol[t]:e.vg[t]}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:o}=n,l=i+1,f=n.ug,u=n.vg;let h=i,m=-1,p=r,d=-1,g=0;for(let _=0;_<r;_+=1)for(let w=0;w<i;w+=1)o[w+_*i]===H&&(g+=1,w<h&&(h=w),w>m&&(m=w),_<p&&(p=_),_>d&&(d=_));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=g,g===0)return this.last;const b=this.solver,y=b.begin(m-h+1,d-p+1),A=this.rho;for(let _=p;_<=d;_+=1)for(let w=h;w<=m;w+=1){const k=w+_*i;if(o[k]!==H)continue;const M=b.at(w-h,_-p);y.act[M]=1,y.x[M]=n.pg[k];const T=w+_*l,S=w+_*i,q=this.fluxU(T+1)-this.fluxU(T)+this.fluxV(S+i)-this.fluxV(S);y.b[M]=n.Sg[k]*a*a-a*q;const L=Math.max(Qt,A[k]);w+1<i?o[k+1]===H&&w+1<=m&&this.gasU[T+1]!==0&&(y.ax[M]=n.au[T+1]*2*t/(L+Math.max(Qt,A[k+1]))):n.openR&&this.gasU[T+1]!==0&&(y.dDx[M]+=n.au[T+1]*2*t/L),w===0&&n.openL&&this.gasU[T]!==0&&(y.dDx[M]+=n.au[T]*2*t/L),_+1<r?o[k+i]===H&&_+1<=d&&this.gasV[S+i]!==0&&(y.ay[M]=n.av[S+i]*2*t/(L+Math.max(Qt,A[k+i]))):n.openT&&this.gasV[S+i]!==0&&(y.dDy[M]+=n.av[S+i]*2*t/L),_===0&&n.openB&&this.gasV[S]!==0&&(y.dDy[M]+=n.av[S]*2*t/L)}const F=b.solve(e,s,!0);x.iterations=F.iterations,x.residual=F.residual,x.capped=F.capped;const P=n.pg;for(let _=0;_<n.n;_+=1)o[_]!==H&&(P[_]=0);for(let _=p;_<=d;_+=1)for(let w=h;w<=m;w+=1){const k=w+_*i;o[k]===H&&(P[k]=y.x[b.at(w-h,_-p)])}for(let _=0;_<r;_+=1)for(let w=0;w<=i;w+=1){const k=w+_*l;if(this.gasU[k]===0)continue;if(w===0){f[k]-=2*t/Math.max(Qt,A[_*i])/a*P[_*i];continue}if(w===i){f[k]+=2*t/Math.max(Qt,A[i-1+_*i])/a*P[i-1+_*i];continue}const M=w-1+_*i,T=w+_*i;f[k]-=2*t/(Math.max(Qt,A[M])+Math.max(Qt,A[T]))/a*(P[T]-P[M])}for(let _=0;_<=r;_+=1)for(let w=0;w<i;w+=1){const k=w+_*i;if(this.gasV[k]===0)continue;if(_===0){u[k]-=2*t/Math.max(Qt,A[w])/a*P[w];continue}if(_===r){u[k]+=2*t/Math.max(Qt,A[w+(r-1)*i])/a*P[w+(r-1)*i];continue}const M=w+(_-1)*i,T=w+_*i;u[k]-=2*t/(Math.max(Qt,A[M])+Math.max(Qt,A[T]))/a*(P[T]-P[M])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let o=0;for(let u=0;u<n;u+=1){if(s.id[u]!==r||e.kind[u]===ft||this.cap[u]<=0)continue;const h=this.nmol[u];o+=h*(h*jt*e.T[u]/s.pAt(u))/this.cap[u]}o*=jt/a;const l=1/Math.max(.05,1-o);let f=0;for(let u=0;u<4;u+=1){const h=s.statePressure(r);s.p0[r]=h;const m=(h-(t[r]+f))*l;if(Math.abs(m)<=1e-10*h)break;let p=0;for(let d=0;d<n;d+=1){if(s.id[d]!==r||e.kind[d]===ft||this.cap[d]<=0)continue;const g=this.nmol[d]*jt*e.T[d]/s.pAt(d);p+=g,e.Hg[d]+=g*m,this.deriveCell(d)}f+=m,i+=p*m}s.p0[r]=s.statePressure(r),this.dp0[r]=f}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<yt;i+=1)n+=e.mg[i*s+t]/mt[i];return n<=0?0:e.mg[Q*s+t]/mt[Q]/n*this.R.pAt(t)}}const fo=[1/6,2/3,1/6];class pf{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"owner");v(this,"fs");v(this,"capB");v(this,"matB");v(this,"Ts");v(this,"au");v(this,"av");v(this,"usol");v(this,"vsol");v(this,"thin");v(this,"thinAny",!1);v(this,"phi");v(this,"alpha");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.fs=new Float32Array(i),this.capB=new Float64Array(i),this.matB=new Uint8Array(i),this.Ts=new Float32Array(i),this.au=new Float32Array(this.nu).fill(1),this.av=new Float32Array(this.nv).fill(1),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.thin=new Uint16Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(at*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}faceOpen(t,e){const s=t%this.nx,n=(t-s)/this.nx;return e===0?this.au[s+n*(this.nx+1)]:e===1?this.au[s+1+n*(this.nx+1)]:e===2?this.av[t]:this.av[t+this.nx]}updateThin(){const{nx:t,ny:e,au:s,av:n,solid:i}=this;this.thinAny&&this.thin.fill(0),this.thinAny=!1;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const o=a+r*t;i[o]===0&&(a>0&&s[a+r*(t+1)]<=0&&i[o-1]===0&&this.thinBlock(a-1,a,r-1,r+1),r>0&&n[o]<=0&&i[o-t]===0&&this.thinBlock(a-1,a+1,r-1,r))}}thinBlock(t,e,s,n){this.thinAny=!0;for(let i=Math.max(0,s);i<=Math.min(this.ny-1,n);i+=1)for(let r=Math.max(0,t);r<=Math.min(this.nx-1,e);r+=1)this.thinCell(r,i)}thinCell(t,e){const{nx:s,ny:n,au:i,av:r,solid:a}=this,o=s+1,l=t+e*s;let f=0;if(a[l]===0)for(let u=0;u<9;u+=1){const h=u%3-1,m=(u/3|0)-1,p=t+h,d=e+m;if(u===4||p<0||d<0||p>=s||d>=n||a[p+d*s]!==0)continue;const g=(h>0?1:0)+e*o,x=(m>0?1:0)*s;let b;if(m===0)b=i[t+g]<=0;else if(h===0)b=r[t+e*s+x]<=0;else{const y=a[p+e*s]===0&&(i[t+g]<=0||r[p+e*s+x]<=0),A=a[t+d*s]===0&&(r[t+e*s+x]<=0||i[t+(h>0?1:0)+d*o]<=0);b=y&&A}b&&(f|=1<<u)}this.thin[l]=f}cutWeights(t,e,s,n){const i=t>=0&&e>=0&&t<this.nx&&e<this.ny?this.thin[t+e*this.nx]:0;if(i===0)return;let r=0;for(let a=0;a<9;a+=1)i>>a&1?s[n+a]=0:r+=s[n+a];if(r>0)for(let a=0;a<9;a+=1)s[n+a]/=r}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}solidShare(t,e){if(t<0)return this.openL?0:1;if(t>=this.nx)return this.openR?0:1;if(e<0)return this.openB?0:1;if(e>=this.ny)return this.openT?0:1;const s=t+e*this.nx;return this.solid[s]!==0?1:this.fs[s]}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:a}=this,o=Math.max(0,t),l=Math.max(0,e),f=Math.min(i-1,s),u=Math.min(r-1,n);for(let p=l;p<=u;p+=1)for(let d=o;d<=f;d+=1){const g=d+p*i;if(this.solid[g]!==0){this.phiS[g]=1;continue}let x=0;for(let b=-1;b<=1;b+=1)for(let y=-1;y<=1;y+=1)x+=fo[y+1]*fo[b+1]*this.solidShare(d+y,p+b);this.phiS[g]=x}const h=4,m=h*a;for(let p=l;p<=u;p+=1)for(let d=o;d<=f;d+=1){const g=d+p*i,x=this.solid[g]!==0,b=(d+.5)*a,y=(p+.5)*a;let A=m;x||(this.openL||(A=Math.min(A,b)),this.openR||(A=Math.min(A,this.w-b)),this.openB||(A=Math.min(A,y)),this.openT||(A=Math.min(A,this.h-y)));for(let F=-h;F<=h;F+=1){const P=p+F;if(!(P<0||P>=r))for(let _=-h;_<=h;_+=1){const w=d+_;if(w<0||w>=i||this.solid[w+P*i]!==0===x)continue;const M=Math.max(0,Math.abs(w+.5-(d+.5))-.5)*a,T=Math.max(0,Math.abs(P+.5-(p+.5))-.5)*a,S=Math.hypot(M,T);S<A&&(A=S)}}this.sdf[g]=x?-A:A}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),o=Math.floor(r),l=Math.floor(a),f=r-o,u=a-l,h=Math.min(s-1,o+1),m=Math.min(n-1,l+1),p=this.sdf;let d=(1-u)*((1-f)*p[o+l*s]+f*p[h+l*s])+u*((1-f)*p[o+m*s]+f*p[h+m*s]);return this.openL||(d=Math.min(d,t)),this.openR||(d=Math.min(d,this.w-t)),this.openB||(d=Math.min(d,e)),this.openT||(d=Math.min(d,this.h-e)),d}}const gf=5,uo=30;class xf{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",oc);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});v(this,"bodies",[]);v(this,"qb");v(this,"kS");v(this,"kF");v(this,"dSF");this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r),this.qb=new Float64Array(r),this.kS=new Float64Array(r),this.kF=new Float64Array(r),this.dSF=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=ht[this.g.solid[t]-1];return s!==void 0?s.rho*s.cp*this.g.vCell:0}hasSolid(t){return this.g.solid[t]!==0||this.g.capB[t]>0}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*ci}solidEnergy(t,e){return this.solidCapCrust(t)*(e-st)+this.g.film[t]*Ft(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t);if(!(s>0))return;const n=e.film[t];let i;if(n<=0)i=st+e.Es[t]/s;else{i=e.Ts[t]>100?e.Ts[t]:st+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Oe(i))}e.Ts[t]=i,e.solid[t]!==0&&(e.T[t]=i)}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(const e of this.bodies){if(e.gone||e.heater<0)continue;const s=this.heaters[e.heater];s!==void 0&&(s.Tmean+=e.meanT()*e.ncell,s.cells+=e.ncell)}for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}bodyHeat(t){let e=0;for(const s of this.bodies){if(s.gone||s.heater<0||s.nw===0)continue;const n=this.heaters[s.heater];if(n===void 0||n.cells===0||n.P===0)continue;const i=s.ncell/n.cells;let r=0;for(let o=0;o<s.ncell;o+=1)r+=s.cellVolume(o);if(!(r>0))continue;const a=n.P*i/r;for(let o=0;o<s.nw;o+=1){const l=a*s.ww[o]*s.cellVolume(s.wk[o]);t[s.wc[o]]+=l,e+=l}}return e}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/gf,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/uo);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/uo)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:o,ny:l,n:f,depth:u,dx:h}=n,{C:m,Cs:p,Cg:d,CTl:g,Tstar:x,k:b,q:y,src:A}=this;this.heaterPower(t),g.fill(0);const F=n.Cl;F.fill(0);const{Co:P,CKo:_}=this;let w=!1,k=0;for(let C=0;C<i.count;C+=1){const E=i.mat[C],B=i.T[C],X=i.mass[C]*i.cp(C);k+=X;const z=9*C,ut=r.bi[C],bt=r.bj[C],dt=E===ct?0:Ks(E,B);E!==ct&&!w&&(w=!0,P.fill(0),_.fill(0));for(let Ct=0;Ct<9;Ct+=1){const Rt=r.wt[z+Ct];if(Rt===0)continue;const Et=ut+Ct%3,gt=bt+(Ct/3|0);if(Et<0||gt<0||Et>=o||gt>=l)continue;const St=Et+gt*o;F[St]+=Rt*X,g[St]+=Rt*X*B,E!==ct&&(P[St]+=Rt*X,_[St]+=Rt*X*dt)}}const M=this.qb;M.fill(0);let T=this.bodyHeat(M);const{kS:S,kF:q,dSF:L}=this;for(let C=0;C<f;C+=1){let E=0,B=0;const X=n.solid[C]!==0?n.T[C]:n.Ts[C];if(n.solid[C]!==0||n.capB[C]>0){E=this.solidCapCrust(C)+n.film[C]*Oe(X);const gt=n.solid[C]!==0?ht[n.solid[C]-1]:ht[n.matB[C]-1];B=gt!==void 0?gt.k:0}const z=a.cap[C]>0&&n.solid[C]===0?a.cap[C]:0,ut=F[C],bt=E+z+ut;if(p[C]=E,d[C]=z,m[C]=bt,L[C]=0,bt<=0){x[C]=n.T[C],b[C]=0,y[C]=0;continue}const dt=(E*X+z*n.T[C]+g[C])/bt;x[C]=dt,ut>0&&(n.Tl[C]=g[C]/ut);let Ct=B;if(n.solid[C]===0){const gt=ut>=z?w&&P[C]>0?((ut-P[C])*Hi(dt)+_[C])/ut:Hi(dt):ga(n.mg[C],n.mg[f+C],n.mg[Q*f+C],dt);if(E>0){const St=Math.min(1,n.fs[C]);Ct=St*B+(1-St)*gt,S[C]=B,q[C]=gt,z+ut>0&&(L[C]=X-(z*n.T[C]+g[C])/(z+ut))}else Ct=gt}b[C]=Ct;let Rt=A[C]+M[C];if(this.liquidPower!==0&&ut>0){const gt=this.liquidPower*ut/k;Rt+=gt,T+=gt}const Et=n.heater[C];if(Et>=0&&n.role[C]===1){const gt=this.heaters[Et];gt!==void 0&&gt.cells>0&&(Rt+=gt.P/gt.cells,T+=gt.P/gt.cells)}y[C]=Rt}const{gx:I,gy:O}=this;for(let C=0;C<l;C+=1)for(let E=0;E<o;E+=1){const B=E+C*o;if(I[B]=0,O[B]=0,m[B]<=0)continue;const X=b[B];if(E+1<o&&m[B+1]>0){const z=b[B+1];X+z>0&&(I[B]=2*X*z/(X+z)*u)}if(C+1<l&&m[B+o]>0){const z=b[B+o];X+z>0&&(O[B]=2*X*z/(X+z)*u)}}const D=this.solver,R=D.begin(o,l),V=R.stride,W=h*u,N=this.hExt*W,Y=this.ambientT;for(let C=0;C<l;C+=1)for(let E=0;E<o;E+=1){const B=E+C*o;if(m[B]<=0)continue;const X=E+1+(C+1)*V;R.act[X]=1,R.dH[X]=m[B]/t;let z=y[B];const ut=b[B],bt=x[B];E+1<o&&(R.ax[X]=I[B],z+=I[B]*(x[B+1]-bt)),E>0&&(z+=I[B-1]*(x[B-1]-bt)),C+1<l&&(R.ay[X]=O[B],z+=O[B]*(x[B+o]-bt)),C>0&&(z+=O[B-o]*(x[B-o]-bt));let dt=0;E===0&&(dt+=this.sideConductance(n.openL,ut,N,u)),E===o-1&&(dt+=this.sideConductance(n.openR,ut,N,u)),C===0&&(dt+=this.sideConductance(n.openB,ut,N,u)),C===l-1&&(dt+=this.sideConductance(n.openT,ut,N,u)),dt>0&&(R.dDx[X]=dt,z+=dt*(Y-x[B])),R.b[X]=z}const J=D.solve(e,s,!1),j=this.last.solve;j.iterations=J.iterations,j.residual=J.residual,j.capped=J.capped;const $=this.Tnew,U=R.x;for(let C=0;C<l;C+=1)for(let E=0;E<o;E+=1){const B=E+C*o;$[B]=m[B]>0?x[B]+U[E+1+(C+1)*V]:n.T[B]}const G=this.dE;let tt=0,pt=0;for(let C=0;C<f;C+=1)G[C]=m[C]>0?y[C]*t:0;for(let C=0;C<l;C+=1)for(let E=0;E<o;E+=1){const B=E+C*o;if(m[B]<=0)continue;const X=b[B];if(I[B]>0){const z=I[B]*($[B+1]-$[B])*t;G[B]+=z,G[B+1]-=z,n.kind[B]!==n.kind[B+1]&&this.pair(n.kind[B],n.kind[B+1],z)}if(O[B]>0){const z=O[B]*($[B+o]-$[B])*t;G[B]+=z,G[B+o]-=z,n.kind[B]!==n.kind[B+o]&&this.pair(n.kind[B],n.kind[B+o],z)}for(let z=0;z<4;z+=1){if(!(z===0?E===0:z===1?E===o-1:z===2?C===0:C===l-1))continue;const bt=z===0?n.openL:z===1?n.openR:z===2?n.openB:n.openT,dt=this.sideConductance(bt,X,N,u)*($[B]-Y)*t;G[B]-=dt,bt?pt+=dt:tt+=dt,n.solid[B]!==0&&(this.lossSolids+=dt)}}for(let C=0;C<f;C+=1){if(m[C]<=0)continue;const E=G[C]/m[C];$[C]=E;let B=0;const X=d[C]+F[C];if(L[C]!==0&&p[C]>0&&X>0){const z=Math.min(.999,Math.max(.001,n.fs[C])),ut=u/(.5*z/Math.max(1e-9,S[C])+.5*(1-z)/Math.max(1e-9,q[C])),bt=p[C]*X/(p[C]+X);B=(1-Math.exp(-t*ut/bt))*L[C]*bt}p[C]>0&&(n.Es[C]+=E*p[C]-B,this.deriveSolid(C)),d[C]>0&&(n.Hg[C]+=E*d[C]+B*d[C]/X),B!==0&&F[C]>0&&($[C]+=B/X)}for(let C=0;C<i.count;C+=1){const E=9*C,B=r.bi[C],X=r.bj[C];let z=0;for(let dt=0;dt<9;dt+=1){const Ct=r.wt[E+dt];if(Ct===0)continue;const Rt=B+dt%3,Et=X+(dt/3|0);if(Rt<0||Et<0||Rt>=o||Et>=l)continue;const gt=Rt+Et*o;m[gt]>0&&(z+=Ct*$[gt])}if(z===0)continue;const ut=i.mass[C],bt=ut/i.rho[C];i.h[C]+=i.cp(C)*z,i.derive(C),r.dVp[C]+=ut/i.rho[C]-bt}for(let C=0;C<f;C+=1)d[C]>0&&a.deriveCell(C);A.fill(0);const wt=this.last;return wt.heater=T*t,wt.lossWalls=tt,wt.lossOpen=pt,wt}pair(t,e,s){t===ft&&e===et?this.fluxSL-=s:t===et&&e===ft?this.fluxSL+=s:t===et&&e===H?this.fluxLG-=s:t===H&&e===et?this.fluxLG+=s:t===ft&&e===H?this.fluxSG-=s:t===H&&e===ft&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function vf(c,t,e,s,n,i,r){const{nx:a,ny:o}=c,l=a+1,f=c.ul,u=c.vl;for(let h=0;h<c.nu;h+=1)s[h]=t[h]!==0?1:0;for(let h=0;h<c.nv;h+=1)n[h]=e[h]!==0?1:0;for(let h=0;h<2;h+=1){i.set(f),r.set(u);for(let m=0;m<o;m+=1)for(let p=0;p<=a;p+=1){const d=p+m*l;if(s[d]!==0)continue;let g=0,x=0;p>0&&s[d-1]===1&&(g+=f[d-1],x+=1),p<a&&s[d+1]===1&&(g+=f[d+1],x+=1),m>0&&s[d-l]===1&&(g+=f[d-l],x+=1),m<o-1&&s[d+l]===1&&(g+=f[d+l],x+=1),x>0&&(i[d]=g/x,s[d]=3)}for(let m=0;m<=o;m+=1)for(let p=0;p<a;p+=1){const d=p+m*a;if(n[d]!==0)continue;let g=0,x=0;p>0&&n[d-1]===1&&(g+=u[d-1],x+=1),p<a-1&&n[d+1]===1&&(g+=u[d+1],x+=1),m>0&&n[d-a]===1&&(g+=u[d-a],x+=1),m<o&&n[d+a]===1&&(g+=u[d+a],x+=1),x>0&&(r[d]=g/x,n[d]=3)}f.set(i),u.set(r);for(let m=0;m<c.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<c.nv;m+=1)n[m]===3&&(n[m]=1)}for(let h=0;h<c.nu;h+=1)s[h]===0&&(f[h]=0);for(let h=0;h<c.nv;h+=1)n[h]===0&&(u[h]=0)}function yf(c,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<c.count;a+=1){const o=Math.min(s-1,Math.max(0,Math.floor(c.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(c.y[a]/t.dx)));if(i[o+l*s]===et){e[a]=0;continue}let f=!1;for(let u=Math.max(0,l-2);u<=Math.min(n-1,l+2)&&!f;u+=1)for(let h=Math.max(0,o-2);h<=Math.min(s-1,o+2);h+=1)if(i[h+u*s]===et){f=!0;break}e[a]=f?0:1,f||(r=!0)}return r}function ho(c,t,e,s){const{nx:n,ny:i,dx:r}=c,a=n+1,o=1/r;let l=Math.min(n-1e-6,Math.max(0,t*o)),f=Math.min(i-1.000001,Math.max(0,e*o-.5)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h;const d=c.ul;s[0]=(1-p)*((1-m)*d[u+h*a]+m*d[u+1+h*a])+p*((1-m)*d[u+(h+1)*a]+m*d[u+1+(h+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*o-.5)),f=Math.min(i-1e-6,Math.max(0,e*o)),u=Math.floor(l),h=Math.floor(f),m=l-u,p=f-h;const g=c.vl;s[1]=(1-p)*((1-m)*g[u+h*n]+m*g[u+1+h*n])+p*((1-m)*g[u+(h+1)*n]+m*g[u+1+(h+1)*n])}function wf(c,t,e,s,n,i,r,a,o,l,f){const{nx:u,ny:h,dx:m}=c;for(let x=0;x<c.nu;x+=1)e[x]=n[x]>l?e[x]/n[x]:0;for(let x=0;x<c.nv;x+=1)s[x]=i[x]>l?s[x]/i[x]:0;const p=o*m*m/f,d=(x,b)=>x+b>0?2*x*b/(x+b):0;let g=0;{const x=u+1,b=t.begin(x,h),y=c.ul;for(let F=0;F<h;F+=1)for(let P=0;P<=u;P+=1){const _=P+F*x;if(r[_]!==1)continue;const w=t.at(P,F),k=e[_];if(b.act[w]=1,b.dH[w]=p,b.x[w]=y[_],b.b[w]=p*y[_],P+1<=u){const M=r[_+1];M===1?b.ax[w]=d(k,e[_+1]):M===2&&(b.dDx[w]+=k)}if(P>0&&r[_-1]===2&&(b.dDx[w]+=k),F+1<h){const M=r[_+x];M===1?b.ay[w]=d(k,e[_+x]):M===2&&(b.dDy[w]+=2*k)}else c.openT||(b.dDy[w]+=2*k);F>0?r[_-x]===2&&(b.dDy[w]+=2*k):c.openB||(b.dDy[w]+=2*k)}const A=t.solve(1e-6,200,!1);g+=A.iterations;for(let F=0;F<h;F+=1)for(let P=0;P<=u;P+=1){const _=P+F*x;r[_]===1&&(y[_]=b.x[t.at(P,F)])}}{const x=t.begin(u,h+1),b=c.vl;for(let A=0;A<=h;A+=1)for(let F=0;F<u;F+=1){const P=F+A*u;if(a[P]!==1)continue;const _=t.at(F,A),w=s[P];if(x.act[_]=1,x.dH[_]=p,x.x[_]=b[P],x.b[_]=p*b[P],A+1<=h){const k=a[P+u];k===1?x.ay[_]=d(w,s[P+u]):k===2&&(x.dDy[_]+=w)}if(A>0&&a[P-u]===2&&(x.dDy[_]+=w),F+1<u){const k=a[P+1];k===1?x.ax[_]=d(w,s[P+1]):k===2&&(x.dDx[_]+=2*w)}else c.openR||(x.dDx[_]+=2*w);F>0?a[P-1]===2&&(x.dDx[_]+=2*w):c.openL||(x.dDx[_]+=2*w)}const y=t.solve(1e-6,200,!1);g+=y.iterations;for(let A=0;A<=h;A+=1)for(let F=0;F<u;F+=1){const P=F+A*u;a[P]===1&&(b[P]=x.x[t.at(F,A)])}}return g}class bf{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:o}=e,l=oe.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(o*l),this.cellHost=new Uint8Array(o));const f=this.cellMat,u=this.cellHost;f.fill(0);let h=!1;for(let d=0;d<t.count;d+=1){const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx)));f[(g+x*r)*l+t.mat[d]]+=t.mass[d],t.smass[2*d]>0&&(h=!0)}if(h){this.cellVolW===null&&(this.cellVolW=new Float64Array(o));const d=this.cellVolW;d.fill(0);for(let g=0;g<t.count;g+=1){if(t.mat[g]!==ct)continue;const x=Math.min(r-1,Math.max(0,Math.floor(t.x[g]/e.dx))),b=Math.min(a-1,Math.max(0,Math.floor(t.y[g]/e.dx)));d[x+b*r]+=t.mass[g]/t.rho[g]}}for(let d=0;d<o;d+=1){let g=0;for(let x=1;x<l;x+=1)f[d*l+x]>f[d*l+g]&&(g=x);u[d]=g}let m=!1;const p=.25*e.dx;for(let d=0;d<t.count;d+=1){i[d]=0;const g=Math.min(r-1,Math.max(0,Math.floor(t.x[d]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[d]/e.dx))),b=u[g+x*r],y=t.mat[d];if(y===b)continue;const A=t.T[d],F=this.cellVolW,P=g+x*r,_=h&&b===ct&&F!==null&&F[P]>0?f[P*l]/F[P]:is(b,A),w=t.rho[d],k=en(b,A),M=en(y,A),T=t.mass[d]/w,S=Math.cbrt(6*T/Math.PI),q=Math.abs(_-w);if(q<=0||n<=0)continue;const L=(2*k+3*M)/(3*k+3*M);let I=q*n*S*S/(18*k*L);for(let D=0;D<8;D+=1){const R=Math.max(1e-9,_*I*S/k),V=24/R*L*(1+.15*Math.pow(R,.687));I=Math.sqrt(4*q*n*S/(3*_*V))}const O=w<_?1:-1;i[d]=O*Math.min(p,I*s),m=!0}return m}}function Ff(c,t,e,s,n,i,r,a,o,l,f){const u=t.w,h=t.h,m=t.dx;let p=0,d=0,g=0,x=0;const b=s;for(let y=0;y<c.count;y+=1){const A=c.x[y],F=c.y[y],P=b[y]!==0;let _,w;if(P)_=A+e*c.vx[y],w=F+e*c.vy[y];else{i(A,F,o);const T=A+.5*e*o[0],S=F+.5*e*o[1];i(T,S,o),_=A+e*o[0],w=F+e*o[1]+(n!==null?n[y]:0)}if(_<0&&t.openL||_>u&&t.openR||w<0&&t.openB||w>h&&t.openT){const T=c.smass[2*y];c.mat[y]===ct?p+=c.mass[y]-T:d+=c.mass[y]-T,g+=T,x+=c.mass[y]*c.h[y],n!==null&&(n[y]=n[c.count-1]),b[y]=b[c.count-1],r(y),y-=1;continue}const k=1e-4*m;P&&(_<k||_>u-k)&&(c.vx[y]=0),P&&(w<k||w>h-k)&&(c.vy[y]=0),_=Math.min(u-k,Math.max(k,_)),w=Math.min(h-k,Math.max(k,w));const M=a!==null?a(A,F,_,w,l):0;if(M===1){_=l[0],w=l[1];const T=l[2],S=l[3];if(P)c.vx[y]=l[4],c.vy[y]=l[5];else{const q=(c.vx[y]-l[4])*T+(c.vy[y]-l[5])*S;q<0&&(c.vx[y]-=q*T,c.vy[y]-=q*S)}}else if(M===0){let T=t.sdfAt(_,w);if(T<.05*m)for(let S=0;S<3&&T<.05*m;S+=1){const q=.25*m;let L=t.sdfAt(_+q,w)-t.sdfAt(_-q,w),I=t.sdfAt(_,w+q)-t.sdfAt(_,w-q);const O=Math.hypot(L,I);if(O<1e-12)break;L/=O,I/=O;const D=.05*m-T;_+=D*L,w+=D*I;const R=c.vx[y]*L+c.vy[y]*I;P?(c.vx[y]=0,c.vy[y]=0):R<0&&(c.vx[y]-=R*L,c.vy[y]-=R*I),_=Math.min(u-k,Math.max(k,_)),w=Math.min(h-k,Math.max(k,w)),T=t.sdfAt(_,w)}}c.x[y]=_,c.y[y]=w}f.m=p,f.o=d,f.s=g,f.e=x}const Af=(c,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(c),ay:new Float64Array(c),gx:new Float64Array(c),gy:new Float64Array(c),dH:new Float64Array(c),dDx:new Float64Array(c),dDy:new Float64Array(c),gDx:new Float64Array(c),gDy:new Float64Array(c),eDx:new Float64Array(c),eDy:new Float64Array(c),area:new Float64Array(c),ox:new Float64Array(c),oy:new Float64Array(c),diag:new Float64Array(c),inv:new Float64Array(c),act:new Uint8Array(c),x:new Float64Array(c),b:new Float64Array(c),r:new Float64Array(c),band:new Int32Array(c),bandCount:0}),mo=24,_f=1,Pf=1,po=24,go=1,he=(c,t)=>(c+2)*(t+2);function xo(c,t,e){let s=0;for(let n=0;n<e;n+=1)s+=c[n]*t[n];return s}function kf(c,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){c[a]+=n*e[a];const o=t[a]-n*s[a];t[a]=o,r+=o*o}return r}function Mf(c,t,e,s){for(let n=0;n<s;n+=1)c[n]=t[n]+e*c[n]}class At{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(Af(he(s,n),i)),!(s*n<=mo||s<=2&&n<=2);)i=he(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=he(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],o=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:o,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=he(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:o,dDy:l,diag:f,inv:u,act:h}=t;for(let m=1;m<=s;m+=1){let p=1+m*n;for(let d=1;d<=e;d+=1,p+=1){if(h[p]===0){f[p]=1,u[p]=1;continue}const g=a[p]+o[p]+l[p]+i[p]+i[p-1]+r[p]+r[p-n];if(!(g>0)){h[p]=0,f[p]=1,u[p]=1;continue}f[p]=g,u[p]=1/g}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:o,diag:l}=t;for(let f=1;f<=i;f+=1){let u=1+f*r;for(let h=1;h<=n;h+=1,u+=1)s[u]=l[u]*e[u]-a[u]*e[u+1]-a[u-1]*e[u-1]-o[u]*e[u+r]-o[u-r]*e[u-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:o,x:l,b:f}=t;for(let u=1;u<=n;u+=1){let h=1+(1+u+e&1)+u*i;const m=s+u*i;for(;h<=m;h+=2)l[h]=(f[h]+r[h]*l[h+1]+r[h-1]*l[h-1]+a[h]*l[h+i]+a[h-i]*l[h-i])*o[h]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:o}=t;let l=0;for(let f=1;f<=s;f+=1){let u=1+f*n;for(let h=1;h<=e;h+=1,u+=1)i[u]!==0&&(i[u-1]===0||i[u+1]===0||i[u-n]===0||i[u+n]===0||r[u]>0||a[u]>0)&&(o[l++]=u)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:o,band:l,bandCount:f}=t;for(let u=e>0?0:f-1;e>0?u<f:u>=0;u+=e){const h=l[u];a[h]=(o[h]+n[h]*a[h+1]+n[h-1]*a[h-1]+i[h]*a[h+s]+i[h-s]*a[h-s])*r[h]}}prepareFine(){const t=this.levels[0],e=he(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=mo||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=he(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,o=e.h,l=s.h;for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;let m=0,p=0,d=0,g=0;for(let _=0;_<2;_+=1){const w=2*f+_;if(!(w>=e.ny))for(let k=0;k<2;k+=1){const M=2*u+k;if(M>=e.nx)continue;const T=M+1+(w+1)*a;if(e.act[T]===0)continue;const S=e.area[T];m+=S,p+=S*((k-.5)*o+e.ox[T]*o),d+=S*((_-.5)*o+e.oy[T]*o),g+=e.dH[T]}}if(m<=0){s.act[h]=0,s.dH[h]=0,s.dDx[h]=0,s.dDy[h]=0,s.gDx[h]=0,s.gDy[h]=0,s.ox[h]=0,s.oy[h]=0;continue}s.act[h]=1,s.area[h]=m/4;const x=p/m,b=d/m;s.ox[h]=x/l,s.oy[h]=b/l,s.dH[h]=g;let y=0,A=0,F=0,P=0;for(let _=0;_<2;_+=1){const w=2*f+_;if(!(w>=e.ny))for(let k=0;k<2;k+=1){const M=2*u+k;if(M>=e.nx)continue;const T=M+1+(w+1)*a;if(e.act[T]!==0){if(e.gDx[T]>0){const S=(k-.5)*o+e.ox[T]*o;y+=e.gDx[T],A+=e.gDx[T]/(e.eDx[T]+Math.abs(S-x))}if(e.gDy[T]>0){const S=(_-.5)*o+e.oy[T]*o;F+=e.gDy[T],P+=e.gDy[T]/(e.eDy[T]+Math.abs(S-b))}}}}s.gDx[h]=y,s.gDy[h]=F,s.dDx[h]=A,s.dDy[h]=P,s.eDx[h]=A>0?y/A:.5*l,s.eDy[h]=P>0?F/P:.5*l}for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const h=u+1+(f+1)*s.stride;if(s.act[h]!==0){if(u+1<n&&s.act[h+1]!==0){const m=2*u+1;let p=0;if(m+1<e.nx)for(let d=0;d<2;d+=1){const g=2*f+d;g>=e.ny||(p+=e.gx[m+1+(g+1)*a])}if(p>0){const d=l*(1+s.ox[h+1]-s.ox[h]);s.gx[h]=p,s.ax[h]=p/Math.max(.25*l,d)}}if(f+1<i&&s.act[h+s.stride]!==0){const m=2*f+1;let p=0;if(m+1<e.ny)for(let d=0;d<2;d+=1){const g=2*u+d;g>=e.nx||(p+=e.gy[g+1+(m+1)*a])}if(p>0){const d=l*(1+s.oy[h+s.stride]-s.oy[h]);s.gy[h]=p,s.ay[h]=p/Math.max(.25*l,d)}}}}At.diagonal(s),At.findBand(s);for(let f=0;f<e.ny;f+=1){let u=1+(f+1)*a;for(let h=0;h<e.nx;h+=1,u+=1){if(e.act[u]===0){s.pW[4*u]=0,s.pW[4*u+1]=0,s.pW[4*u+2]=0,s.pW[4*u+3]=0,s.pIdx[4*u]=0,s.pIdx[4*u+1]=0,s.pIdx[4*u+2]=0,s.pIdx[4*u+3]=0;continue}At.weights(s,h,f,e.dDx[u]+e.dDy[u]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*u+m]=this.pi[m],s.pW[4*u+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,o=s>>1,l=(e&1)===1?1:-1,f=(s&1)===1?1:-1,u=t.stride,h=a+1+(o+1)*u;r[0]=h,r[1]=h+l,r[2]=h+f*u,r[3]=h+l+f*u;const m=a+l>=0&&a+l<t.nx,p=o+f>=0&&o+f<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=p&&t.act[r[2]]!==0?3/16:0,i[3]=m&&p&&t.act[r[3]]!==0?1/16:0,t.act[h]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<po;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<po;m+=1)At.color(e,1),At.color(e,0);return}for(let m=0;m<_f;m+=1)At.color(e,0),At.color(e,1);for(let m=0;m<go;m+=1)At.bandSweep(e,1);At.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,he(s.nx,s.ny)),s.x.fill(0,0,he(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:o}=e,{pIdx:l,pW:f}=s,u=s.b,h=s.x;for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=r[p]-a[p],x=4*p;u[l[x]]+=f[x]*g,u[l[x+1]]+=f[x+1]*g,u[l[x+2]]+=f[x+2]*g,u[l[x+3]]+=f[x+3]*g}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let p=1+(m+1)*n;for(let d=0;d<e.nx;d+=1,p+=1){if(i[p]===0)continue;const g=4*p;o[p]+=f[g]*h[l[g]]+f[g+1]*h[l[g+1]]+f[g+2]*h[l[g+2]]+f[g+3]*h[l[g+3]]}}for(let m=0;m<go;m+=1)At.bandSweep(e,-1);for(let m=0;m<Pf;m+=1)At.color(e,1),At.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:o,dDy:l,act:f}=t,u=this.nullId,h=he(e,s);let m=!1;for(let p=0;p<h;p+=1)if(f[p]!==0&&!(a[p]>0)){m=!0;break}if(!m){this.nullCount=0;return}u.fill(-2,0,h),this.nullCount=0;for(let p=1;p<=s;p+=1)for(let d=1;d<=e;d+=1){const g=d+p*n;if(f[g]===0||u[g]!==-2)continue;let x=0,b=0,y=!1;const A=-3-this.nullCount;this.stack[x++]=g,u[g]=A;let F=g,P=g;for(;x>0;){const w=this.stack[--x];b+=1,w<F&&(F=w),w>P&&(P=w),(a[w]>0||o[w]>0||l[w]>0)&&(y=!0),i[w]>0&&u[w+1]===-2&&(u[w+1]=A,this.stack[x++]=w+1),i[w-1]>0&&u[w-1]===-2&&(u[w-1]=A,this.stack[x++]=w-1),r[w]>0&&u[w+n]===-2&&(u[w+n]=A,this.stack[x++]=w+n),r[w-n]>0&&u[w-n]===-2&&(u[w-n]=A,this.stack[x++]=w-n)}let _=-1;if(!y){if(_=this.nullCount,_>=this.nullSum.length){const w=k=>{const M=new Float64Array(2*k.length);return M.set(k),M};this.nullSum=w(this.nullSum),this.nullCnt=w(this.nullCnt)}this.nullCnt[_]=b,this.nullCount+=1}for(let w=F;w<=P;w+=1)u[w]===A&&(u[w]=_)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=he(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=he(i.nx,i.ny),{act:a}=i,o=this.xs,l=this.bs,f=i.stride;for(let F=0;F<r;F+=1){if(a[F]===0){o[F]=0,l[F]=0,i.ax[F]=0,i.ay[F]=0;continue}(F+1>=r||a[F+1]===0)&&(i.ax[F]=0),(F+f>=r||a[F+f]===0)&&(i.ay[F]=0)}At.diagonal(i);for(let F=0;F<r;F+=1)a[F]===0&&(o[F]=0,l[F]=0);this.findNull(),this.project(l),s&&(At.findBand(i),this.prepareFine(),this.coarsen());const u=s?i.b:this.rj,h=s?i.x:this.zj,{p:m,q:p}=this;p.fill(0,0,r),m.fill(0,0,r),h.fill(0,0,r),At.apply(i,o,p);let d=0,g=0;for(let F=0;F<r;F+=1){const P=a[F]===0?0:l[F]-p[F];u[F]=P,d+=l[F]*l[F],g+=P*P}this.project(u);const x=Math.sqrt(d);if(x===0)return o.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let b=Math.sqrt(g)/x;if(b<=t)return n.iterations=0,n.residual=b,n.capped=!1,n;this.precondition(s,u,h,r);let y=0;for(let F=0;F<r;F+=1)m[F]=h[F],y+=u[F]*h[F];let A=0;for(;A<e;){A+=1,At.apply(i,m,p);const F=xo(m,p,r);if(!(F>0))break;const P=y/F;if(g=kf(o,u,m,p,P,r),b=Math.sqrt(g)/x,b<=t)break;this.precondition(s,u,h,r);const _=xo(u,h,r),w=_/y;y=_,Mf(m,h,w,r)}this.project(o);for(let F=0;F<r;F+=1)a[F]===0&&(o[F]=0);return n.iterations=A,n.residual=b,n.capped=b>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Tf=.1,vo=1e-9,Yi=.1;function Tn(c,t,e,s,n){return n[e]===2||s>=1?c[e]:s*c[e]+(1-s)*t[e]}function ce(c,t,e){const s=Math.floor(c-.5),n=c-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Sf{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new bf);v(this,"dropletDrift",null);v(this,"bodyHit",null);v(this,"afterSolve",null);v(this,"hit",new Float64Array(6));v(this,"escaped",{m:0,o:0,s:0,e:0});v(this,"velocityAtFn",(t,e,s)=>{ho(this.g,t,e,s)});v(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;e.updateThin();for(let o=0;o<t.count;o+=1){n[o]=ce(t.x[o]*a-.5,s,0),i[o]=ce(t.y[o]*a-.5,s,3);const l=9*o;for(let f=0;f<3;f+=1)for(let u=0;u<3;u+=1)r[l+u+3*f]=s[u]*s[3+f];e.thinAny&&e.cutWeights(n[o]+1,i[o]+1,r,l)}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:o,kind:l}=e;for(let f=0;f<t.count;f+=1){const u=9*f,h=s[f],m=n[f];let p=0;for(let d=0;d<9;d+=1){const g=h+d%3,x=m+(d/3|0),y=g>=0&&x>=0&&g<a&&x<o&&l[g+x*a]===et?i[u+d]:0;r[u+d]=y,p+=y}if(p>0){const d=1/p;for(let g=0;g<9;g+=1)r[u+g]*=d}else{for(let d=0;d<9;d+=1)r[u+d]=0;r[u+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:o}=this,{nx:l,ny:f,kind:u}=s,h=1/s.dx;i[t]=ce(e.x[t]*h-.5,n,0),r[t]=ce(e.y[t]*h-.5,n,3);const m=9*t;for(let d=0;d<3;d+=1)for(let g=0;g<3;g+=1)a[m+g+3*d]=n[g]*n[3+d];s.thinAny&&s.cutWeights(i[t]+1,r[t]+1,a,m);let p=0;for(let d=0;d<9;d+=1){const g=i[t]+d%3,x=r[t]+(d/3|0),b=g>=0&&x>=0&&g<l&&x<f&&u[g+x*l]===et;o[m+d]=b?a[m+d]:0,b&&(p+=a[m+d])}if(p>0)for(let d=0;d<9;d+=1)o[m+d]/=p;else{for(let d=0;d<9;d+=1)o[m+d]=0;o[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:o}=e;o.fill(0);const l=1/e.vCell;let f=0,u=0;for(let h=0;h<t.count;h+=1){const m=t.mass[h]/t.rho[h];f+=t.mass[h],u+=m;const p=9*h,d=s[h],g=n[h];for(let x=0;x<9;x+=1){const b=d+x%3,y=g+(x/3|0);b<0||y<0||b>=r||y>=a||(o[b+y*r]+=i[p+x]*m*l)}}u>0&&(this.rhoRef=f/u)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ft;continue}const a=e.phi[r];let o=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!o&&t!==null&&t[r]!==H&&t[r]!==ft){const l=r%s,f=(r-l)/s;(l>0?t[r-1]===H&&e.faceOpen(r,0)>0:e.openL)||(l<s-1?t[r+1]===H&&e.faceOpen(r,1)>0:e.openR)||(f>0?t[r-s]===H&&e.faceOpen(r,2)>0:e.openB)||(f<n-1?t[r+s]===H&&e.faceOpen(r,3)>0:e.openT)||(o=!0)}e.kind[r]=o?et:H,o&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:o}=this,{nx:l,ny:f,dx:u}=e,h=1/u,m=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),o.fill(0);const p=1/this.rhoRef,d=this.viscous;d&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const g=this.etaU,x=this.etaV;d&&(g.fill(0),x.fill(0));for(let b=0;b<t.count;b+=1){const y=t.x[b],A=t.y[b],F=t.mass[b],P=d?en(t.mat[b],t.T[b]):0,_=t.vx[b],w=t.vy[b],k=t.c00[b],M=t.c01[b],T=t.c10[b],S=t.c11[b],q=y*h,L=A*h;let I=ce(q,s,0),O=ce(L-.5,s,3);for(let R=0;R<3;R+=1){const V=O+R,W=(V+.5)*u-A;for(let N=0;N<3;N+=1){const Y=I+N,J=s[N]*s[3+R]*F,j=J*(_+k*(Y*u-y)+M*W);if(Y>=0&&Y<=l&&V>=0&&V<f){const $=Y+V*m;n[$]+=J,i[$]+=j,d&&(g[$]+=J*P)}else this.mirrorU(Y,V),n[this.mf]+=J,i[this.mf]+=this.ms*j,d&&(g[this.mf]+=J*P)}}I=ce(q-.5,s,0),O=ce(L,s,3);const D=t.rho[b]*p;for(let R=0;R<3;R+=1){const V=O+R,W=V*u-A;for(let N=0;N<3;N+=1){const Y=I+N,J=s[N]*s[3+R]*F,j=J*(w+T*((Y+.5)*u-y)+S*W);let $,U=1;Y>=0&&Y<l&&V>=0&&V<=f?$=Y+V*l:(this.mirrorV(Y,V),$=this.mf,U=this.ms),r[$]+=J,a[$]+=U*j,o[$]+=J*D,d&&(x[$]+=J*P)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,o=1;r<0?s.openL?r=0:(r=-r,o=-o):r>n&&(s.openR?r=n:(r=2*n-r,o=-o)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=o}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,o=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,o=-o):a>i&&(s.openT?a=i:(a=2*i-a,o=-o)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=o}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:o,dx:l,kind:f}=i,u=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:h,pu:m,mv:p,pv:d,rv:g,knownU:x,knownV:b}=this,y=i.ul,A=i.vl,F=this.rhoRef*i.vCell*.25,P=vo*F,_=this.viscous;for(let D=0;D<i.nu;D+=1)y[D]=h[D]>P?m[D]/h[D]+(_?0:t*this.fU[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<i.nv;D+=1)A[D]=p[D]>P?d[D]/p[D]+(_?0:-t*e*(g[D]/p[D])+t*this.fV[D]/(this.rhoRef*i.vCell)):0;for(let D=0;D<o;D+=1)for(let R=0;R<=a;R+=1){const V=R+D*u,W=R>0?f[R-1+D*a]:-1,N=R<a?f[R+D*a]:-1,Y=R===0&&!i.openL,J=R===a&&!i.openR;if(Y||J||W===ft||N===ft||i.au[V]<=0){y[V]=Y||J?0:i.usol[V],x[V]=2;continue}x[V]=W===et||N===et?1:0}for(let D=0;D<=o;D+=1)for(let R=0;R<a;R+=1){const V=R+D*a,W=D>0?f[R+(D-1)*a]:-1,N=D<o?f[R+D*a]:-1,Y=D===0&&!i.openB,J=D===o&&!i.openT;if(Y||J||W===ft||N===ft||i.av[V]<=0){A[V]=Y||J?0:i.vsol[V],b[V]=2;continue}b[V]=W===et||N===et?1:0}if(this.last.viscIterations=0,_){this.viscosity(t);const D=t/(this.rhoRef*i.vCell);for(let R=0;R<i.nu;R+=1)x[R]!==2&&h[R]>P&&(y[R]+=D*this.fU[R]);for(let R=0;R<i.nv;R+=1)b[R]!==2&&p[R]>P&&(A[R]+=-t*e*(g[R]/p[R])+D*this.fV[R])}let w=a,k=-1,M=o,T=-1,S=0;for(let D=0;D<o;D+=1)for(let R=0;R<a;R+=1)f[R+D*a]===et&&(S+=1,R<w&&(w=R),R>k&&(k=R),D<M&&(M=D),D>T&&(T=D));const q=this.last.solve;if(q.iterations=0,q.residual=0,q.capped=!1,S>0){const D=k-w+1,R=T-M+1,V=this.solver,W=V.begin(D,R),N=t/this.rhoRef,Y=1/i.vCell,J=this.pGas;for(let U=M;U<=T;U+=1)for(let G=w;G<=k;G+=1){const tt=G+U*a;if(f[tt]!==et)continue;const pt=V.at(G-w,U-M);W.act[pt]=1,W.x[pt]=i.pl[tt];const wt=G+U*u,C=G+U*a,E=x[wt+1]===2?0:i.au[wt+1],B=x[wt]===2?0:i.au[wt],X=b[C+a]===2?0:i.av[C+a],z=b[C]===2?0:i.av[C],ut=Tn(y,i.usol,wt+1,E,x)-Tn(y,i.usol,wt,B,x)+Tn(A,i.vsol,C+a,X,b)-Tn(A,i.vsol,C,z,b),bt=i.phi[tt]+i.phiS[tt]+i.alpha[tt];let dt=this.volSrc[tt]*Y;const Ct=this.gasAt(G-1,U)||this.gasAt(G+1,U)||this.gasAt(G,U-1)||this.gasAt(G,U+1),Rt=bt-1;(Rt>0||!Ct)&&(dt+=Tf*Rt/t);let Et=dt*l*l-l*ut;if(G+1<a){const gt=f[tt+1];if(gt===et)G+1<=k&&E>0&&(W.ax[pt]=E<1?N*E:N);else if(gt===H&&E>0){const St=(E<1?N*E:N)/this.theta(tt,tt+1);W.dDx[pt]+=St,Et+=St*J[tt+1]}}else i.openR&&E>0&&(W.dDx[pt]+=E<1?2*N*E:2*N);if(G>0){if(f[tt-1]===H&&B>0){const St=(B<1?N*B:N)/this.theta(tt,tt-1);W.dDx[pt]+=St,Et+=St*J[tt-1]}}else i.openL&&B>0&&(W.dDx[pt]+=B<1?2*N*B:2*N);if(U+1<o){const gt=f[tt+a];if(gt===et)U+1<=T&&X>0&&(W.ay[pt]=X<1?N*X:N);else if(gt===H&&X>0){const St=(X<1?N*X:N)/this.theta(tt,tt+a);W.dDy[pt]+=St,Et+=St*J[tt+a]}}else i.openT&&X>0&&(W.dDy[pt]+=X<1?2*N*X:2*N);if(U>0){if(f[tt-a]===H&&z>0){const St=(z<1?N*z:N)/this.theta(tt,tt-a);W.dDy[pt]+=St,Et+=St*J[tt-a]}}else i.openB&&z>0&&(W.dDy[pt]+=z<1?2*N*z:2*N);W.b[pt]=Et}const j=V.solve(s,n,!0);q.iterations=j.iterations,q.residual=j.residual,q.capped=j.capped;const $=i.pl;for(let U=0;U<i.n;U+=1)$[U]=f[U]===H?J[U]:0;for(let U=M;U<=T;U+=1)for(let G=w;G<=k;G+=1){const tt=G+U*a;f[tt]===et&&($[tt]=W.x[V.at(G-w,U-M)])}for(let U=0;U<o;U+=1)for(let G=0;G<=a;G+=1){const tt=G+U*u;if(x[tt]===1){if(G===0){y[tt]-=N/l*2*($[U*a]-0);continue}if(G===a){y[tt]-=N/l*2*(0-$[a-1+U*a]);continue}y[tt]-=N/l*this.across(G-1+U*a,G+U*a)}}for(let U=0;U<=o;U+=1)for(let G=0;G<a;G+=1){const tt=G+U*a;if(b[tt]===1){if(U===0){A[tt]-=N/l*2*($[G]-0);continue}if(U===o){A[tt]-=N/l*2*(0-$[G+(o-1)*a]);continue}A[tt]-=N/l*this.across(G+(U-1)*a,G+U*a)}}this.afterSolve!==null&&this.afterSolve(V,w,M,t)}this.extrapolate();const L=this.markStranded(),I=this.g2p(L?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const O=this.last;return O.cells=S,O.uMax=I,O.escapedMass=this.escM,O.escapedOther=this.escO,O.escapedSalt=this.escS,O.escapedEnergy=this.escE,O}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e];return!(n>.5)||!(n>i)?Yi:Math.max(Yi,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===H&&n[e]===et?i/this.theta(e,t):n[e]===H&&n[t]===et?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new At(e.nx+1,e.ny+1));const s=vo*this.rhoRef*e.vCell*.25;this.last.viscIterations=wf(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===H}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:o}=this,{nx:l,ny:f}=s,u=1/t;for(let h=0;h<e.count;h+=1){const m=a[h];if(m===0)continue;const p=9*h,d=n[h],g=i[h];for(let x=0;x<9;x+=1){const b=d+x%3,y=g+(x/3|0);b<0||y<0||b>=l||y>=f||(o[b+y*l]+=r[p+x]*m*u)}}}extrapolate(){vf(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:o,dx:l}=n,f=1/l,u=a+1,h=n.ul,m=n.vl,p=4/(l*l);let d=0;for(let g=0;g<s.count;g+=1){if(t>0&&r[g]!==0){s.vy[g]-=e*t,s.c00[g]=0,s.c01[g]=0,s.c10[g]=0,s.c11[g]=0;const L=s.vx[g]*s.vx[g]+s.vy[g]*s.vy[g];L>d&&(d=L);continue}const x=s.x[g],b=s.y[g],y=x*f,A=b*f;let F=ce(y,i,0),P=ce(A-.5,i,3),_=0,w=0,k=0;for(let L=0;L<3;L+=1){const I=P+L,O=(I+.5)*l-b;for(let D=0;D<3;D+=1){const R=F+D,V=i[D]*i[3+L];let W;R>=0&&R<=a&&I>=0&&I<o?W=h[R+I*u]:(this.mirrorU(R,I),W=this.ms*h[this.mf]),_+=V*W,w+=V*W*(R*l-x),k+=V*W*O}}F=ce(y-.5,i,0),P=ce(A,i,3);let M=0,T=0,S=0;for(let L=0;L<3;L+=1){const I=P+L,O=I*l-b;for(let D=0;D<3;D+=1){const R=F+D,V=i[D]*i[3+L];let W;R>=0&&R<a&&I>=0&&I<=o?W=m[R+I*a]:(this.mirrorV(R,I),W=this.ms*m[this.mf]),M+=V*W,T+=V*W*((R+.5)*l-x),S+=V*W*O}}s.vx[g]=_,s.vy[g]=M,s.c00[g]=p*w,s.c01[g]=p*k,s.c10[g]=p*T,s.c11[g]=p*S;const q=_*_+M*M;q>d&&(d=q)}return Math.sqrt(d)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),yf(this.P,this.g,this.stranded)}velocityAt(t,e,s){ho(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;Ff(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class Cf{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?yr:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=$a(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=br(r,i);return}const s=this.mat[t],n=Fa(s,this.h[t]);this.T[t]=n,this.rho[t]=is(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==ct)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?Ha(this.T[t],e/this.mass[t]):xr(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function Lf(c,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:o}=c,{nx:l,ny:f,n:u,kind:h}=s,{Tl:m}=t,p=t.rd;let d=!1;for(let y=0;y<u;y+=1){if(p[y]=0,h[y]===H&&t.Cl[y]>0){const k=t.boilingAt(y,r.pAt(y));m[y]>k&&(p[y]=k,d=!0);continue}if(h[y]!==et)continue;const A=y%l,F=(y-A)/l,P=F+1<f?y+l:-1;if(!(P>=0&&h[P]===H&&s.faceOpen(y,3)>0||A>0&&h[y-1]===H&&s.faceOpen(y,0)>0||A<l-1&&h[y+1]===H&&s.faceOpen(y,1)>0||F>0&&h[y-l]===H&&s.faceOpen(y,2)>0))continue;const w=t.boilingAt(y,r.pAt(y));m[y]>w&&(p[y]=w,d=!0)}if(!d)return;const g=t.mtot;g.fill(0);const x=t.Y0;x.fill(0);const b=i.rhoRef*s.vCell/4;for(let y=0;y<n.count;y+=1){if(n.mat[y]!==ct)continue;const A=n.smass[2*y],F=A>0?A/n.mass[y]:0,P=9*y;let _=0,w=0,k=-1,M=0;for(let q=0;q<2;q+=1){for(let L=0;L<9;L+=1){const I=i.wt[P+L];if(I===0)continue;const O=i.bi[y]+L%3,D=i.bj[y]+(L/3|0);if(O<0||D<0||O>=l||D>=f)continue;const R=O+D*l,V=p[R];if(V===0)continue;const W=A>0?Sc(V,F):Ft(V);if(n.h[y]<=W)continue;const N=xt(V),Y=I*n.mass[y]*(n.h[y]-W)/(N-(A>0?En(V,F):W));q===0?(_+=Y,w+=Y*N,I>M&&(M=I,k=R)):(g[R]+=Y,x[R]+=Y*N)}if(_===0)break;if(q===0&&n.mass[y]-A-_<Ji*b){const L=p[k],I=n.mass[y]-A,O=xt(L),D=A>0?A*ai(L):0;g[k]+=I,x[k]+=I*O,A>0&&c.salt.deposit(n.x[y],n.y[y],A,D),o.src[k]-=(I*O+D-n.mass[y]*n.h[y])/e,_=-1;break}}if(_===0)continue;if(_<0){i.removeParticle(y),y-=1;continue}const T=n.mass[y]/n.rho[y],S=n.mass[y]-_;n.h[y]=(n.mass[y]*n.h[y]-w)/S,n.mass[y]=S,n.derive(y),i.dVp[y]+=S/n.rho[y]-T}for(let y=0;y<u;y+=1){if(g[y]===0)continue;const A=y%l,F=(y-A)/l;let P=0;const _=h[y]===H?y:F+1<f&&h[y+l]===H&&s.faceOpen(y,3)>0?y+l:-1;if(_>=0)s.mg[Q*u+_]+=g[y],s.Hg[_]+=x[y],a.deriveCell(_);else{const w=t.side;w[0]=A>0&&h[y-1]===H&&s.faceOpen(y,0)>0?y-1:-1,w[1]=A<l-1&&h[y+1]===H&&s.faceOpen(y,1)>0?y+1:-1,w[2]=F>0&&h[y-l]===H&&s.faceOpen(y,2)>0?y-l:-1,w[3]=-1;for(let k=0;k<3;k+=1)w[k]>=0&&(P+=1);for(let k=0;k<3;k+=1)w[k]<0||(s.mg[Q*u+w[k]]+=g[y]/P,s.Hg[w[k]]+=x[y]/P,a.deriveCell(w[k]))}t.produced+=g[y]}}function Of(c,t,e,s,n){const i=c.grid,r=i.n,a=i.mg[it*r+t],o=i.mg[rt*r+t],l=i.Hg[t];if(s<=0)return rc(a,o,e,l);let f=n;for(let u=0;u<6;u+=1){const h=a*ne(it,f)+o*ne(rt,f)+e*xt(f)+s*Ft(f),m=(l-h)/$i(a,o,e,s,f);if(f+=m,Math.abs(m)<1e-10)break}return f}function Hs(c,t,e,s,n,i){const r=c.grid,a=r.n,o=r.mg[Q*a+t]-e,l=r.mfog[t]+e,f=Of(c,t,o,l,i),u=o/mt[Q];return(u+s>0?u/(u+s)*n:0)-sn(f)}function _i(c,t,e,s){const{grid:n,gas:i}=c,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[Q*r+e],s));n.mg[Q*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function Bf(c,t){const{grid:e,regions:s}=c,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==H)continue;const r=e.mg[Q*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const o=e.mg[it*n+i]/mt[it]+e.mg[rt*n+i]/mt[rt],l=s.pAt(i),f=e.T[i];if(a<=0){const b=r/mt[Q];if(b/(b+o)*l<.999*sn(f))continue}const u=Hs(c,i,0,o,l,f);if(u<=0&&a<=0)continue;let h,m,p,d;if(u>0)h=0,p=u,m=r,d=Hs(c,i,m,o,l,f);else if(m=0,d=u,h=-a,p=Hs(c,i,h,o,l,f),p<=0){_i(c,t,i,h);continue}if(d>0){_i(c,t,i,m);continue}let g=h,x=0;for(let b=0;b<40;b+=1){g=(h*d-m*p)/(d-p),(!Number.isFinite(g)||g<=Math.min(h,m)||g>=Math.max(h,m))&&(g=.5*(h+m));const y=Hs(c,i,g,o,l,f);if(Math.abs(y)<=1e-13*l)break;y>0?(h=g,p=y,x===1&&(d/=2),x=1):(m=g,d=y,x===-1&&(p/=2),x=-1)}if(_i(c,t,i,g),u<0&&g>0&&(t.fogWrong+=1),e.mfog[i]>0){const b=Hs(c,i,0,o,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(b)/sn(e.T[i]))}}}const Ji=.001;class jf{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*oe.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*sn(t)/e),o=i.mg[it*r+s],l=i.mg[rt*r+s],f=o+l,u=f>0?f/(o/mt[it]+l/mt[rt]):.02885;return a*mt[Q]/(a*mt[Q]+(1-a)*u)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:o,acc:l,accH:f,accAll:u,accS:h}=this;o.fill(0),a.fill(0),l.fill(0),f.fill(0);let m=!1,p=!1;for(let g=0;g<e.count;g+=1){const x=e.mass[g],b=e.mat[g],y=x*e.cp(g),A=e.smass[2*g],F=x-A,P=A>0?En(e.T[g],A/x):e.h[g];A>0&&!p&&(p=!0,h.fill(0)),b!==ct&&!m&&(m=!0,u.fill(0),this.accMat.fill(0));const _=9*g;for(let w=0;w<9;w+=1){const k=s.wt[_+w];if(k===0)continue;const M=s.bi[g]+w%3,T=s.bj[g]+(w/3|0);if(M<0||T<0||M>=n||T>=i)continue;const S=M+T*n;o[S]+=k*y,a[S]+=k*y*e.T[g],b===ct&&(l[S]+=k*F,f[S]+=k*F*P),p&&(h[S]+=k*A),m&&(this.accMat[b*r+S]+=k*x)}}for(let g=0;g<r;g+=1)a[g]=o[g]>0?a[g]/o[g]:t.T[g];if(this.mixed=m,this.salty=p,p)for(let g=0;g<r;g+=1){const x=h[g]>0&&l[g]>0?h[g]/(l[g]*Ls):0;this.mol[g]=x,this.aw[g]=x>0?Pc(a[g],x):1}if(!m){u.set(l),this.host.fill(ct);return}const d=oe.length;for(let g=0;g<r;g+=1){this.accMat[ct*r+g]=p?l[g]+h[g]:l[g];let x=0,b=ct,y=-1;for(let A=0;A<d;A+=1){const F=this.accMat[A*r+g];x+=F,F>y&&(y=F,b=A)}u[g]=x,this.host[g]=b}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?kc(e,this.mol[t]):kt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:Ft(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?ct:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:o,dm:l}=this;l.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){if(n.mat[u]!==ct)continue;const h=9*u;let m=0;for(let p=0;p<9;p+=1){const d=i.wt[h+p];if(d===0)continue;const g=i.bi[u]+p%3,x=i.bj[u]+(p/3|0);if(g<0||x<0||g>=r||x>=a)continue;const b=g+x*r;t[b]!==0&&o[b]>0&&(m+=t[b]*d*(n.mass[u]-n.smass[2*u])/o[b])}l[u]=m}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const h=l[u];if(h===0)continue;if(n.smass[2*u]>0){this.applySalty(u,h,f,e);continue}const m=n.mass[u]/n.rho[u],p=n.mass[u]+h;if(p<Ji*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,p),e);continue}this.track(u,h),n.mass[u]=p,i.dVp[u]+=p/n.rho[u]-m}for(let u=0;u<s.n;u+=1){if(t[u]<=0||o[u]>0)continue;const h=u%r,m=(u-h)/r,p=n.add((h+.5)*s.dx,(m+.5)*s.dx,t[u],this.waterH(u),ct);p<0||(i.placeParticle(p),i.dVp[p]=t[u]/n.rho[p],this.track(p,t[u]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,o=9*t,l=xr(n.mat[t],n.T[t]);for(let f=0;f<9;f+=1){const u=i.wt[o+f];if(u===0)continue;const h=i.bi[t]+f%3,m=i.bj[t]+(f/3|0);if(h<0||m<0||h>=r||m>=a)continue;const p=h+m*r;this.acc[p]+=u*e,this.accH[p]+=u*e*n.h[t],this.accAll[p]+=u*e,this.Cl[p]+=u*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],o=i.mass[t],l=o-a,f=En(i.T[t],a/o),u=i.cp(t),h=o*i.h[t]+e*f,m=l+e;if(m<Ji*s){this.trackSalty(t,-l,-l*f,-o,-a,-o*u),this.dryUp(t,Math.max(0,m),h,n);return}const p=o/i.rho[t];i.mass[t]=o+e,i.h[t]=h/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-p;const d=En(i.T[t],a/i.mass[t]);this.trackSalty(t,e,m*d-l*f,e,0,i.mass[t]*i.cp(t)-o*u)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:o}=this.e,{nx:l,ny:f}=a,u=9*t;for(let h=0;h<9;h+=1){const m=o.wt[u+h];if(m===0)continue;const p=o.bi[t]+h%3,d=o.bj[t]+(h/3|0);if(p<0||d<0||p>=l||d>=f)continue;const g=p+d*l;this.acc[g]+=m*e,this.accH[g]+=m*s,this.accAll[g]+=m*n,this.accS[g]+=m*i,this.Cl[g]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:o,gas:l}=this.e,f=r.T[t],u=r.smass[2*t],h=u*ai(f);this.e.salt.deposit(r.x[t],r.y[t],u,h);const m=i.cellAt(r.x[t],r.y[t]);let p=m;for(;p>=0&&i.kind[p]!==H;)p=p+i.nx<i.n?p+i.nx:-1;if(m>=0&&p>=0)e>0&&(i.mg[Q*i.n+p]+=e,i.Hg[p]+=e*xt(f),this.produced+=e,l.deriveCell(p)),o.src[m]-=(e*xt(f)+h-s)/n;else if(m>=0){for(let d=0;d<r.count;d+=1)if(d!==t&&r.mat[d]===r.mat[t]&&i.cellAt(r.x[d],r.y[d])===m){const g=r.mass[d]*r.h[d]+(s-h);r.mass[d]+=e,r.h[d]=g/r.mass[d],r.derive(d);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:o}=this.e,l=n.cellAt(i.x[t],i.y[t]);let f=l;for(;f>=0&&n.kind[f]!==H;)f=f+n.nx<n.n?f+n.nx:-1;if(e>0&&f>=0&&l>=0){const u=i.T[t];n.mg[Q*n.n+f]+=e,n.Hg[f]+=e*xt(u),a.src[l]-=e*(xt(u)-i.h[t])/s,this.produced+=e,o.deriveCell(f)}else if(e>0&&l>=0){for(let u=0;u<i.count;u+=1)if(u!==t&&i.mat[u]===i.mat[t]&&n.cellAt(i.x[u],i.y[u])===l){const h=i.mass[u]*i.h[u]+e*i.h[t];i.mass[u]+=e,i.h[u]=h/i.mass[u],i.derive(u);break}}r.removeParticle(t)}step(t){this.diffuse(t),Lf(this.e,this,t),Bf(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:o,ny:l,n:f,depth:u,kind:h}=s,{mtot:m,rd:p,Y0:d,Tl:g,Fm:x,Fe:b,edge:y,hvC:A,hnC:F,hoC:P}=this;let _=!1;for(let L=0;L<f;L+=1){if(h[L]!==H){m[L]=0;continue}const I=s.mg[L]+s.mg[f+L]+s.mg[Q*f+L];m[L]=I,d[L]=I>0?s.mg[Q*f+L]/I:0;const O=s.T[L];p[L]=n.rho[L]*va(O,i.pAt(L)),A[L]=xt(O),F[L]=ne(it,O),P[L]=ne(rt,O),_=!0}if(!_)return;for(let L=0;L<l;L+=1)for(let I=0;I<o;I+=1){const O=I+L*o;y[O]=h[O]===H&&(I===0||L===0||I===o-1||L===l-1||h[O-1]!==H||h[O+1]!==H||h[O-o]!==H||h[O+o]!==H)?1:0}const w=a.begin(o,l),k=w.stride,M=e.ambientY[Q],{bG:T,bY:S}=this;for(let L=0;L<l;L+=1)for(let I=0;I<o;I+=1){const O=I+L*o;if(h[O]!==H||m[O]<=0)continue;const D=I+1+(L+1)*k;w.act[D]=1,w.x[D]=d[O],w.dH[D]=m[O]/t;let R=m[O]*d[O]/t;const V=s.au[I+1+L*(o+1)],W=s.av[O+o];if(I+1<o&&h[O+1]===H&&m[O+1]>0&&V>0&&(w.ax[D]=V*.5*(p[O]+p[O+1])*u),L+1<l&&h[O+o]===H&&m[O+o]>0&&W>0&&(w.ay[D]=W*.5*(p[O]+p[O+o])*u),y[O]===0){w.b[D]=R;continue}let N=0;for(let Y=0;Y<4;Y+=1){const J=this.boundary(O,I,L,Y,M);T[4*O+Y]=J,S[4*O+Y]=this.yb,!(J<=0)&&(N+=J,R+=J*this.yb)}w.dDx[D]=N,w.b[D]=R}a.solve(1e-9,200,!1),x.fill(0),b.fill(0);const q=w.x;for(let L=0;L<l;L+=1)for(let I=0;I<o;I+=1){const O=I+L*o;if(h[O]!==H||m[O]<=0)continue;const D=I+1+(L+1)*k,R=q[D],V=s.au[I+1+L*(o+1)],W=s.av[O+o];if(I+1<o&&h[O+1]===H&&m[O+1]>0&&V>0&&this.exchange(O,O+1,t*V*.5*(p[O]+p[O+1])*u*(R-q[D+1])),L+1<l&&h[O+o]===H&&m[O+o]>0&&W>0&&this.exchange(O,O+o,t*W*.5*(p[O]+p[O+o])*u*(R-q[D+k])),y[O]!==0)for(let N=0;N<4;N+=1){const Y=T[4*O+N];if(Y<=0)continue;const J=t*Y*(S[4*O+N]-R),$=(N===0?I===0:N===1?I===o-1:N===2?L===0:L===l-1)?-1:N===0?O-1:N===1?O+1:N===2?O-o:O+o;if($<0)this.ambientExchange(O,J);else if(h[$]===et)if(J>0){const U=g[$];s.mg[Q*f+O]+=J,s.Hg[O]+=J*xt(U),x[$]-=J,b[$]-=J*xt(U),this.produced+=J}else{const U=Math.min(-J,s.mg[Q*f+O]);s.mg[Q*f+O]-=U,s.Hg[O]-=U*xt(s.T[O]),x[$]+=U,b[$]+=U*xt(s.T[O]),this.condensed+=U}else if(h[$]===ft){const U=s.T[$];if(J<0){const G=Math.min(-J,s.mg[Q*f+O]);s.mg[Q*f+O]-=G,s.Hg[O]-=G*xt(s.T[O]),s.film[$]+=G,s.Es[$]+=G*Ft(U),r.src[$]+=G*(xt(s.T[O])-Ft(U))/t,this.dew+=G}else{const G=Math.min(J,s.film[$]);s.film[$]-=G,s.Es[$]-=G*Ft(U),s.mg[Q*f+O]+=G,s.Hg[O]+=G*xt(U),r.src[$]-=G*(xt(U)-Ft(U))/t,this.dew-=G}}}}for(let L=0;L<f;L+=1)x[L]!==0&&(r.src[L]+=(b[L]-x[L]*this.waterH(L))/t);this.applyMass(x,t);for(let L=0;L<f;L+=1)h[L]===H&&m[L]>0&&n.deriveCell(L)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:o,depth:l,kind:f}=r,u=n===0?e===0:n===1?e===a-1:n===2?s===0:s===o-1,h=2*this.rd[t]*l;if(u)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,h):0;const m=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=m;const p=f[m],d=this.Y0[t],g=this.e.regions.pAt(t);if(p===et){const x=r.faceOpen(t,n);if(!(x>0))return 0;const b=this.waterShare(m);return b<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],g,t,this.salty?this.aw[m]:1),x*h*(1-d)*b)}if(p===ft){const x=this.ysat(r.T[m],g,t);return d>x||r.film[m]>0&&d<x?(this.yb=x,h*(1-d)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let o=Math.abs(s);o=Math.min(o,n.mg[Q*i+r]);const l=n.mg[it*i+a],f=n.mg[rt*i+a],u=l+f,h=Math.min(o,u);if(o<=0)return;const m=this.hvC[r];if(n.mg[Q*i+r]-=o,n.mg[Q*i+a]+=o,n.Hg[r]-=o*m,n.Hg[a]+=o*m,h>0){const p=h*l/u,d=h-p;n.mg[it*i+a]-=p,n.mg[rt*i+a]-=d,n.mg[it*i+r]+=p,n.mg[rt*i+r]+=d;const g=p*this.hnC[a]+d*this.hoC[a];n.Hg[a]-=g,n.Hg[r]+=g}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[it*i+t]+n.mg[rt*i+t],o=Math.min(e,a);if(n.mg[Q*i+t]+=e,n.Hg[t]+=e*xt(r),o>0){const l=o*n.mg[it*i+t]/a,f=o-l;n.mg[it*i+t]-=l,n.mg[rt*i+t]-=f;const u=l*ne(it,n.T[t])+f*ne(rt,n.T[t]);n.Hg[t]-=u,s.flows.escapedAir+=o,s.flows.escapedEnergy+=u}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*xt(r)}else if(e<0){const a=Math.min(-e,n.mg[Q*i+t]),o=s.ambientY[it],l=s.ambientY[rt],f=o+l>0?o+l:1;n.mg[Q*i+t]-=a,n.Hg[t]-=a*xt(n.T[t]);const u=a*o/f,h=a-u;n.mg[it*i+t]+=u,n.mg[rt*i+t]+=h;const m=u*ne(it,r)+h*ne(rt,r);n.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*xt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,o=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<o)continue;const f=l%n,u=(l-f)/n,m=[f>0?l-1:-1,f<n-1?l+1:-1,u+1<i?l+n:-1,u>0?l-n:-1].find(A=>A>=0&&a[A]===H);if(m===void 0)continue;const p=m%n,d=(m-p)/n,g=(p+.5+.25*Math.sign(f-p))*t.dx,x=(d+.5+.25*Math.sign(u-d))*t.dx,b=t.T[l],y=e.add(g,x,o,Ft(b),ct);y<0||(t.film[l]-=o,t.Es[l]-=o*Ft(b),s.placeParticle(y),s.dVp[y]=o/e.rho[y])}}}function jc(c,t){const{particles:e,liquid:s,grid:n}=c,i=new Float64Array(oe.length);let r=0,a=0,o=0;for(let l=0;l<e.count;l+=1)for(let f=0;f<9;f+=1){const u=s.wt[9*l+f];if(u===0)continue;const h=s.bi[l]+f%3,m=s.bj[l]+(f/3|0);if(h<0||m<0||h>=n.nx||m>=n.ny||h+m*n.nx!==t)continue;i[e.mat[l]]+=u*e.mass[l],r+=u*e.mass[l];const p=e.smass[2*l];p>0?(a+=u*p,o+=u*(e.mass[l]-p)):e.mat[l]===0&&(o+=u*e.mass[l])}return{m:i,all:r,salt:a,water:o}}function qf(c,t){const{m:e,all:s}=jc(c,t);if(s<=0)return[];const n=[];for(let i=0;i<oe.length;i+=1)e[i]>0&&n.push({id:oe[i].id,share:e[i]/s});return n}function If(c,t,e){var M;const s=c.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ft?"solid":s.kind[n]===et?"liquid":"gas",a=c.pressureAt(n);let o=0;const l=[0,0,0];for(let T=0;T<yt;T+=1)l[T]=s.mg[T*i+n]/mt[T],o+=l[T];for(let T=0;T<yt;T+=1)l[T]=o>0?l[T]/o:0;const f=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],u=r==="gas"?l[Q]*a:0,h=Math.floor(t/s.dx),m=Math.floor(e/s.dx),p=r==="liquid"?.5*(s.ul[h+m*(s.nx+1)]+s.ul[h+1+m*(s.nx+1)]):.5*(s.ug[h+m*(s.nx+1)]+s.ug[h+1+m*(s.nx+1)]),d=r==="liquid"?.5*(s.vl[h+m*s.nx]+s.vl[h+(m+1)*s.nx]):.5*(s.vg[h+m*s.nx]+s.vg[h+(m+1)*s.nx]),g=c.particles;let x=-1,b=(1.5*s.dx)**2;for(let T=0;T<g.count;T+=1){const S=(g.x[T]-t)**2+(g.y[T]-e)**2;S<b&&(b=S,x=T)}const y=c.bubbles;let A=-1,F=1/0;for(let T=0;T<y.count;T+=1){const S=Math.hypot(y.x[T]-t,y.y[T]-e);S<=Math.max(y.r[T],3*s.dx)&&S<F&&(A=T,F=S)}const P=jc(c,n),_=[];if(P.all>0)for(let T=0;T<oe.length;T+=1)P.m[T]>0&&_.push({id:oe[T].id,share:P.m[T]/P.all});let w=null;if(r==="liquid"&&P.salt>0&&P.water>0){const T=P.salt/(P.water*Ls);w={w:P.salt/(P.salt+P.water),molality:T,Tb:kc(a,T),Tf:Mc(T)}}const k=r==="gas"?c.gas.rho[n]:r==="liquid"?w!==null&&!c.phase.mixed?br(f,w.w):c.phase.mixed?is(c.phase.host[n],f):c.liquid.rhoRef:s.solid[n]!==0?ht[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?ht[s.solid[n]-1].id:null,T:f,p:a,Tsat:kt(a),x:l,rh:r==="gas"?u/ri(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,c.gas.vgas[n]):0,rho:k,phi:s.phi[n],u:p,v:d,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:_,salt:w},particle:x<0?null:{id:g.id[x],T:g.T[x],vx:g.vx[x],vy:g.vy[x],mass:g.mass[x],rho:g.rho[x],dist:Math.sqrt(b),liquid:((M=oe[g.mat[x]])==null?void 0:M.id)??oe[0].id,salt:g.saltFraction(x)},bubble:A<0?null:c.bubbleModel.describe(A),body:Rf(c,t,e)}}function Rf(c,t,e){const s=c.bodies.bodyAt(t,e);return s===null?null:{index:s.index,material:ht[s.mat].id,mass:s.m,T:s.meanT(),vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}class Ef{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n,au:i,av:r}=t,a=e+1;this.id.fill(-1);let o=0;for(let l=0;l<t.n;l+=1){if(n[l]!==0||this.id[l]!==-1)continue;this.grow(o);let f=0,u=0,h=0;for(this.stack[f++]=l,this.id[l]=o;f>0;){const m=this.stack[--f];h+=1-t.fs[m];const p=m%e,d=(m-p)/e,g=p+d*a,x=p+d*e;(p===0&&t.openL&&i[g]>0||p===e-1&&t.openR&&i[g+1]>0||d===0&&t.openB&&r[x]>0||d===s-1&&t.openT&&r[x+e]>0)&&(u=1),p>0&&n[m-1]===0&&this.id[m-1]===-1&&i[g]>0&&(this.id[m-1]=o,this.stack[f++]=m-1),p<e-1&&n[m+1]===0&&this.id[m+1]===-1&&i[g+1]>0&&(this.id[m+1]=o,this.stack[f++]=m+1),d>0&&n[m-e]===0&&this.id[m-e]===-1&&r[x]>0&&(this.id[m-e]=o,this.stack[f++]=m-e),d<s-1&&n[m+e]===0&&this.id[m+e]===-1&&r[x+e]>0&&(this.id[m+e]=o,this.stack[f++]=m+e)}this.open[o]=u,this.vFluid[o]=h*t.vCell,o+=1}this.count=o}volumes(t,e){const s=this.g;this.vFluid.fill(0,0,this.count);for(let n=0;n<s.n;n+=1){const i=this.id[n];i>=0&&(this.vFluid[i]+=1-s.fs[n])}for(let n=0;n<this.count;n+=1)this.vFluid[n]*=s.vCell;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<yt;a+=1){const o=s.mg[a*n+i];this.mSum[r]+=o,this.nSum[r]+=o/mt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let o=0;o<s;o+=1){if(this.id[o]!==t||e.kind[o]===ft)continue;let l=0;for(let f=0;f<yt;f+=1)l+=e.mg[f*s+o]/mt[f];n+=l*jt*e.T[o]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let o=0;o<2;o+=1){let l=-i,f=0;for(let u=0;u<s;u+=1){if(this.id[u]!==t||e.kind[u]===ft)continue;let h=0;for(let d=0;d<yt;d+=1)h+=e.mg[d*s+u]/mt[d];const m=r-a*(e.dx*((u-u%e.nx)/e.nx+.5)),p=h*jt*e.T[u];l+=p/m,f-=p/(m*m)}r-=l/f}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===H)return s;return-1}}class Df{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)t.owner[s]===0&&t.capB[s]===0&&(e+=t.crust[s]);for(const s of this.e.bodies.list)s.gone||(e+=s.crustMass());return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:o}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),f=Math.min(o-1,Math.max(0,Math.floor(e/r.dx))),u=l+f*a,h=i.heat;if(h.hasSolid(u)){this.toSolid(u,s,n);return}const m=[f>0?u-a:-1,l>0?u-1:-1,l<a-1?u+1:-1,f<o-1?u+a:-1];for(const p of m)if(p>=0&&h.hasSolid(p)){this.toSolid(p,s,n);return}for(let p=f-2;p>=0;p-=1){const d=l+p*a;if(h.hasSolid(d)){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=Va(r);if(n<=a*i*(1+1e-9))continue;const o=(n-a*i)/(1-a),l=o*ai(r),f=i/t.rho[s],u=i*t.h[s]-l;t.mass[s]=i-o,t.smass[2*s]=n-o,t.h[s]=u/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-f,this.deposit(t.x[s],t.y[s],o,l),this.crystallized+=o}}}const Zi="recreatio/lab2d",Vf={"very-high":.001,high:.002,medium:.003},Nf=c=>c==="very-high"||c==="high"||c==="medium",Uf=16e4,vt=(c,t)=>typeof c=="number"&&Number.isFinite(c)?c:t,Pt=(c,t,e)=>Math.min(e,Math.max(t,c)),ze=c=>c!==null&&typeof c=="object"&&!Array.isArray(c)?c:{},Sn=(c,t)=>c==="wall"||c==="open"?c:t,yo=.25*ii,Pi=2*ii;function wo(c){const t={};let e=0;for(const[s,n]of Object.entries(ze(c)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Gf(c,t,e){const s=ze(c),n=st+vt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return $s(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Ns(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",o=wo(s.composition),l=h=>a==="gas"?h==="N2"||h==="O2"||h==="H2O":ac(h)>=0||bc(h)>=0,f={};for(const[h,m]of Object.entries(o))l(h)?f[h]=m:t.push(`ops[${e}]: unknown ${a} "${h}" dropped`);const u=Object.keys(f).length>0?wo(f):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:u}}case"erase":{const r=Ns(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Ns(s.region);if(r===null)break;return{op:"move",region:r,dx:Pt(vt(s.dx,0),-1,1),dy:Pt(vt(s.dy,0),-1,1)}}case"solid":{const r=Ns(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",x:vt(s.x,.1),y:vt(s.y,0),w:Pt(vt(s.w,.07),.01,1),h:Pt(vt(s.h,.09),.01,1),wall:Pt(vt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Pt(vt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",x:vt(s.x,.1),y:vt(s.y,0),w:Pt(vt(s.w,.12),.005,1),h:Pt(vt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Pt(vt(s.power,40),0,2e3),target:st+Pt(vt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Pt(vt(s.angle,0),-180,180)};case"body":{const r=Ns(s.region);if(r===null)break;return{op:"body",region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Pt(vt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:vt(s.x,0),y:vt(s.y,0),pinned:s.pinned!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function ki(c,t={}){const e=ze(c),s=[];e.format!==void 0&&e.format!==Zi&&s.push(`format "${String(e.format)}" is not ${Zi}`);const n=ze(e.box),i=ze(e.ambient),r=ze(i.air),a=ze(e.sides),o=vt(i.g,ii),l=t.harness===!0?Pt(o,0,Pi):Pt(o,yo,Pi);l!==o&&s.push(`ambient.g ${o} m/s² is outside ${yo.toFixed(2)}–${Pi.toFixed(2)}, using ${l.toFixed(2)}`);const f=vt(r.N2,.7676),u=vt(r.O2,.2324),h=f+u>0?f+u:1,m=[];return Array.isArray(e.ops)&&e.ops.forEach((p,d)=>{const g=Gf(p,s,d);g!==null&&m.push(g)}),{scene:{seed:Math.floor(vt(e.seed,1))>>>0,box:{w:Pt(vt(n.w,.2),.02,.6),h:Pt(vt(n.h,.15),.02,.4),depth:Pt(vt(n.depth,.01),.002,.05)},ambient:{p:Pt(vt(i.p,Ys/1e3),20,400)*1e3,T:st+Pt(vt(i.T,20),-20,100),rh:Pt(vt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,f)/h,O2:Math.max(0,u)/h}},sides:{left:Sn(a.left,"wall"),right:Sn(a.right,"wall"),bottom:Sn(a.bottom,"wall"),top:Sn(a.top,"open")},quality:Nf(e.quality)?e.quality:"high",ops:m},warnings:s}}const Kt=(c,t=6)=>Number(c.toFixed(t));function Hf(c){switch(c.op){case"fill":return{op:"fill",region:Us(c.region),composition:{...c.composition},phase:c.phase,T:Kt(c.T-st,3)};case"erase":return{op:"erase",region:Us(c.region)};case"move":return{op:"move",region:Us(c.region),dx:Kt(c.dx),dy:Kt(c.dy)};case"solid":return{op:"solid",region:Us(c.region),material:c.material,T:Kt(c.T-st,3)};case"beaker":return{op:"beaker",x:c.x,y:c.y,w:c.w,h:c.h,wall:c.wall,material:c.material,T:Kt(c.T-st,3),...c.lid?{lid:!0}:{},...bo(c)};case"hotplate":return{op:"hotplate",x:c.x,y:c.y,w:c.w,h:c.h,material:c.material,mode:c.mode,power:c.power,target:Kt(c.target-st,3),on:c.on,T:Kt(c.T-st,3),...bo(c)};case"body":return{op:"body",region:Us(c.region),material:c.material,T:Kt(c.T-st,3),...c.pinned?{pinned:!0}:{},...c.angle!==0?{angle:Kt(c.angle,4)}:{}};case"pin":return{op:"pin",x:Kt(c.x),y:Kt(c.y),pinned:c.pinned}}}const bo=c=>({...c.pinned?{}:{pinned:!1},...c.angle!==0?{angle:Kt(c.angle,4)}:{}});function $f(c){return{format:Zi,version:1,seed:c.seed,box:{...c.box},ambient:{p:Kt(c.ambient.p/1e3,4),T:Kt(c.ambient.T-st,3),rh:c.ambient.rh,g:Kt(c.ambient.g,4),air:{...c.ambient.air}},sides:{...c.sides},quality:c.quality,ops:c.ops.map(Hf)}}const Wf=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],Ye=Wf.length,Fo=1/120;class Kf{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"exchange");v(this,"bodies");v(this,"melt");v(this,"solver");v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",Fo);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(at));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",ao());v(this,"snap",Jl());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(Ye));v(this,"stamp",new Float64Array(Ye+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);v(this,"building",!1);this.options=e;const s=Ao(t)?t:ki(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Fo}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=Vf[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>Uf;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new pf(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new Cf(Math.max(4096,4*i.n+1024)),this.bubbles=new Il(4096),this.solver=new At(s,n),this.regions=new Ef(i),this.liquid=new Sf(i,this.particles,this.solver),this.gas=new mf(i,this.regions,this.solver),this.heat=new xf(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new zl(this),this.phase=new jf(this),this.salt=new Df(this),this.exchange=new uf(this),this.bodies=new Pl(this),this.heat.bodies=this.bodies.list,this.melt=new ql(this),this.bodies.afterCollect=()=>{this.melt.step()},this.liquid.bodyHit=(r,a,o,l,f)=>this.bodies.hitPoint(r,a,o,l,f),this.liquid.afterSolve=(r,a,o,l)=>this.bodies.probe(r,a,o,l),this.prevKind=new Uint8Array(i.n),this.rng=new Bc(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=ao(),this.heaterOps.clear(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=H,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)(t.solid[s]!==0||t.capB[s]>0)&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,o=(i>0?i:ya)/a,l=(r>0||i>0?r:wa)/a,f=1/(o/mt[it]+l/mt[rt]),u=Math.min(.99,s*ri(e)/t),h=u*mt[Q]/(u*mt[Q]+(1-u)*f);this.ambientY.fill(0),this.ambientY[it]=(1-h)*o,this.ambientY[rt]=(1-h)*l,this.ambientY[Q]=h;let m=0;for(let p=0;p<yt;p+=1)m+=this.ambientY[p]/mt[p];this.regions.pAmb=t,this.regions.rhoAmb=t/(jt*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.bodies.reweigh(),this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){if(t.op==="fill"&&t.phase==="liquid"&&!this.surfaceAfterFill(t))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const e=this.regions.pvTerm(),s=nf(this.world(),t);return this.bodies.sync(),t.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,t]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-e,this.building||this.bodies.wakeFree(),s!==null&&this.warnings.push(s),s}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let o=0;o<n;o+=1)for(let l=0;l<s;l+=1){const f=l+o*s;e.solid[f]===0&&(e.kind[f]===et||os(t.region,(l+.5)*e.dx,(o+.5)*e.dx))&&(i[f]=1)}const r=new Uint8Array(e.n),a=[];for(let o=0;o<e.n;o+=1){if(i[o]===0||r[o]!==0)continue;let l=!1;for(a.push(o),r[o]=1;a.length>0;){const f=a.pop(),u=f%s,h=(f-u)/s,m=this.gas,p=[m.across(f,u,h,0),m.across(f,u,h,1),m.across(f,u,h,2),m.across(f,u,h,3)];(u===0&&e.openL||u===s-1&&e.openR||h===0&&e.openB||h===n-1&&e.openT)&&(l=!0);for(const d of p)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,a.push(d))}}if(!l)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),o=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&o!==void 0&&o.op==="hotplate"){const l=[...this.scene.ops];l[a]={...o,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return $f({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=Ao(t)?t:ki(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setQuality(t){const e=ki(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,o=this.dt,l=this.stamp;l[0]=we();const f=n.pvTerm();this.bodies.prepare()&&(n.update(r,a),this.flows.bodyWork+=n.pvTerm()-f),l[1]=we(),e.splatVolumeChange(o),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===H?n.pAt(d)-this.pRef:0;e.step(o,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=we(),s.updateVolumes(),s.markFaces();const u=s.escaped[Q]+s.escaped[yt],h=s.escaped[it]+s.escaped[rt],m=s.escaped[yt+1];s.transport(o),this.flows.escapedWater+=s.escaped[Q]+s.escaped[yt]-u,this.flows.escapedAir+=s.escaped[it]+s.escaped[rt]-h,this.flows.escapedEnergy+=s.escaped[yt+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(o,this.gy),s.sources(o),s.project(o,this.tol,this.maxIter),l[3]=we(),this.bubbleModel.step(o),l[4]=we(),this.phase.step(o),this.salt.step(),l[5]=we(),i.step(o,1e-6,200),this.exchange.step(o),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=we(),l[7]=we(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===H?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.time+=o,this.steps+=1,l[8]=we(),this.bodies.finish(o),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit()),l[9]=we();const p=this.steps<5?1:1/30;for(let d=0;d<Ye;d+=1)this.timings[d]+=p*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=p*(l[Ye]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let o=0;o<e.count;o+=1)i.dp0[o]!==0&&(a=!0);if(a){for(let o=0;o<s.count;o+=1){const l=t.cellAt(s.x[o],s.y[o]),f=l<0?-1:e.id[l];if(f<0||i.dp0[f]===0)continue;const u=s.mass[o],h=u/s.rho[o];s.h[o]+=h*i.dp0[f]/u,s.derive(o),r.dVp[o]+=u/s.rho[o]-h}for(let o=0;o<n.count;o+=1){const l=t.cellAt(n.x[o],n.y[o]),f=l<0?-1:e.id[l];f>=0&&i.dp0[f]!==0&&(n.H[o]+=n.V[o]*i.dp0[f])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,Yl(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals(),this.bodies.list,this.melt.pendingTotals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.particles.hasOther()||this.particles.hasSalt()||this.salt.crustMass()>0||this.salt.floorTotals().mass>0||this.bodies.anyFree||this.melt.any()}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===ct&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==ct&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===et?this.pRef+e.pl[t]:e.kind[t]===H?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return If(this,t,e)}liquidsAt(t){return qf(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===et?e+=1:t.kind[d]===H&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,o=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy+a.bodyWork),l=r.water.total-this.water0-a.editWater,f=r.other.total-this.other0-a.editOther,u=r.salt.total-this.salt0-a.editSalt,h=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.phase.producedMark)/m,this.phase.producedMark=h,this.vapourLast=this.time);const p=[];for(let d=0;d<this.regions.count;d+=1)p.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor,bodies:{count:this.bodies.list.filter(d=>!d.gone).length,free:this.bodies.list.filter(d=>d.free).length,awake:this.bodies.list.filter(d=>d.awake).length},heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:p,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:o,waterError:l,otherError:f,saltError:u,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy}}}const we=()=>typeof performance<"u"?performance.now():Date.now();function Ao(c){return c!==null&&typeof c=="object"&&"box"in c&&"ops"in c&&"quality"in c&&"sides"in c&&"ambient"in c&&typeof c.ambient.p=="number"&&c.ambient.p>1e3}class qc{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=kt(t.cpu.regions.pAmb),i=fa(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},o=this.last;let l=0,f=0;if(o!==null&&a.t>o.t){const m=a.t-o.t,p=(a.heater-o.heater)/m,d=(a.solids-o.solids+a.SG-o.SG+a.lossS-o.lossS+a.LG-o.LG+a.sens-o.sens+a.bub-o.bub)/m;l=(a.vap-o.vap)/m,f=Math.max(0,(p-d)/i)}this.last=a;const u=this.vapour()*i,h=r.energy;return this.started||(this.started=!0,this.latent0=u,this.stored0=h),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:u-this.latent0,sensible:h-this.stored0-(u-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:f}}}const Fs={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Ps=16,K={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},Je=96,_o=16,zf=57,zt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},be=16,Qf={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},tr=8,Nt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},ge=8,Xf={TSUM:0,CELLS:1},er=2,Yf={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Ic=16,nt={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},Mi=55,We={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},Ti=6,sr={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},Si=13,ke={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},Ci=16,Jf={KNOWN:0,MARK:1,MARK2:2,GAS:3},Po=4,Zf={F:0},Li=1,t0={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},nr=12,Xt=(c,t)=>Object.entries(t).map(([e,s])=>`const ${c}${e}: u32 = ${s}u;`).join(`
`),e0=[Xt("G_",Fs),Xt("C_",K),Xt("R_",zt),Xt("RA_",Qf),Xt("H_",Nt),Xt("HA_",Xf),Xt("S_",Yf),Xt("F_",nt),Xt("U_",We),Xt("A_",sr),Xt("FF_",ke),Xt("FU_",Jf),Xt("AF_",Zf),Xt("BA_",t0),`const RACC_STRIDE: u32 = ${tr}u;`,`const HEAT_STRIDE: u32 = ${ge}u;`,`const HACC_STRIDE: u32 = ${er}u;`,`const CGS_STRIDE: u32 = ${Ic}u;`,`const BACC_STRIDE: u32 = ${nr}u;`].join(`
`);function ot(c){if(!Number.isFinite(c))throw new Error(`not a finite constant: ${c}`);const t=Math.abs(c)>=1e-4&&Math.abs(c)<1e7?String(c):c.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Ht=c=>c.map(ot).join(", "),Lt=Tt.species[0],Cn=Tt.species[1],Ln=Tt.species[2],Ze=Lt.liquid.cp.table,Se=Ze.map(c=>c[0]),ns=Ze.map(c=>c[1]),ti=[ns[0]*(Se[0]-st)];for(let c=1;c<Ze.length;c+=1)ti.push(ti[c-1]+.5*(ns[c]+ns[c-1])*(Se[c]-Se[c-1]));const[s0,n0,i0]=Lt.vapour.cp.linear,ir=st+100,r0=(()=>{let c=0;for(;c<Se.length-2&&ir>=Se[c+1];)c+=1;const t=ir-Se[c],e=(ns[c+1]-ns[c])/(Se[c+1]-Se[c]);return ti[c]+ns[c]*t+.5*e*t*t})(),o0=r0+Lt.saturation.hlv100.v,Ae=Tt.solids,Oi=4294967295,c0=`
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
}`,ko=44,a0=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,us=26,l0=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,hs=29,f0=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Bi=8,u0=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,h0=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${ot(st)};
const R_GAS: f32 = ${ot(jt)};
const P_ATM: f32 = ${ot(Ys)};
const G0: f32 = ${ot(ii)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${ot(Cn.molarMass.v)};
const M_O2: f32 = ${ot(Ln.molarMass.v)};
const M_H2O: f32 = ${ot(Lt.molarMass.v)};
const CP_N2: f32 = ${ot(Cn.gas.cp.v)};
const CP_O2: f32 = ${ot(Ln.gas.cp.v)};
const CPV0: f32 = ${ot(s0)};
const CPV1: f32 = ${ot(n0)};
const CPV_T: f32 = ${ot(i0)};
const T100: f32 = ${ot(ir)};
const HV100: f32 = ${ot(o0)};
const NCP: i32 = ${Ze.length};
const CP_T = array<f32, ${Ze.length}>(${Ht(Se)});
const CP_V = array<f32, ${Ze.length}>(${Ht(ns)});
const CP_H = array<f32, ${Ze.length}>(${Ht(ti)});
const KELL = array<f32, 7>(${Ht(Lt.liquid.kell.c)});
const KL = array<f32, 3>(${Ht(Lt.liquid.k.poly)});
const VA: f32 = ${ot(Lt.liquid.mu.vogel[0])};
const VB: f32 = ${ot(Lt.liquid.mu.vogel[1])};
const VC: f32 = ${ot(Lt.liquid.mu.vogel[2])};
const ST_B: f32 = ${ot(Lt.surfaceTension.B)};
const ST_b: f32 = ${ot(Lt.surfaceTension.b)};
const ST_MU: f32 = ${ot(Lt.surfaceTension.mu)};
const T_CRIT: f32 = ${ot(Lt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${ot(Lt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Ht(Lt.saturation.if97.n)});
const RVC = array<f32, 6>(${Ht(Lt.saturation.vapourDensity.c)});
const KV: f32 = ${ot(Lt.vapour.k.v)};
const MUV: f32 = ${ot(Lt.vapour.mu.v)};
const KN = array<f32, 3>(${Ht(Cn.gas.k.power)});
const KO = array<f32, 3>(${Ht(Ln.gas.k.power)});
const MN = array<f32, 3>(${Ht(Cn.gas.mu.sutherland)});
const MO = array<f32, 3>(${Ht(Ln.gas.mu.sutherland)});
const DV0: f32 = ${ot(Tt.vapourInAir.D0.v)};
const DVT0: f32 = ${ot(Tt.vapourInAir.T0.v)};
const DVE: f32 = ${ot(Tt.vapourInAir.exponent.v)};
const NSOL: u32 = ${Ae.length}u;
const S_RHO = array<f32, ${Ae.length}>(${Ht(Ae.map(c=>c.rho.v))});
const S_CP = array<f32, ${Ae.length}>(${Ht(Ae.map(c=>c.cp.v))});
const S_K = array<f32, ${Ae.length}>(${Ht(Ae.map(c=>c.k.v))});
const S_THETA = array<f32, ${Ae.length}>(${Ht(Ae.map(c=>c.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${ot(Oc)};
const REG_STRIDE: u32 = ${be}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${ot(oc)};
`,d0=`
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
`,m0=`
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
`,Sr=[c0,a0,l0,f0,u0,h0,e0,d0,m0].join(`
`);class p0{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=x0(t.bind),this.source=w0(t,this.binds,this.wg)}}const g0={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function x0(c){return c.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":g0[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const v0=`
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
`,y0=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function w0(c,t,e){const s=[Sr,`const WG: u32 = ${e}u;`,v0],n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of y0)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
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
fn maxU_${i.name}(i: u32, v: f32) { atomicMax(&${i.name}[i], bitcast<u32>(max(v, 0.0))); }`))}),s.push(c.code),s.join(`
`)}class Cr{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new Cr(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new p0(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const f of a)e.push(`${s.name}:${f.lineNum}:${f.linePos} ${f.message}
    ${l[f.lineNum-1]??""}`);return}const o=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,f)=>l.mode==="t"?{binding:f,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:f,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:f,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:f,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=o;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const Mo=64,To="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Xs=`
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
`,Rc=`
fn kindOf(c: u32) -> u32 { return cu[U_KIND * P.n + c]; }
/* Absoluter Druck der Flüssigkeit an (x, y): bilinear über die nicht festen Zellmitten. */
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
  return P.pref + select(0.0, s / w, w > 0.0);
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
`,b0=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,F0=`
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
`,A0=[{name:"bubNucleate",wg:Mo,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Xs}
${To} {
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
  let pl = P.pref + cf[F_PL * n + fc];
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
}`},{name:"bubAdvance",wg:Mo,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Xs}
${Rc}
${b0}
${F0}
${To} {
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
}`}],ds=64,je="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",_0=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,P0=[{name:"bubTarget",wg:ds,bind:"P:u cnt:a bubs:r btarget:w",code:`${je} {
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
}`},{name:"bubMerge",wg:ds,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${je} {
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
}`},{name:"bubMergeFinal",wg:ds,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Xs}
${je} {
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
}`},{name:"bubFinish",wg:ds,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Xs}
${Rc}
${_0}
${je} {
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
${je} {
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
}`},{name:"bubCopyBack",wg:ds,bind:"P:u cnt:a bubs:w bubs2:r",code:`${je} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:ds,bind:"P:u cnt:a bubs:r at:a",code:`${Xs}
${je} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${je} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let a = at[A_ALPHA * n + c];
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
}`}],Me=128,de="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ei=`
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
`,So=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,ji=`
var<workgroup> rr: array<f32, ${16*Me}>;
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
`,k0=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([c,t])=>({name:c,wg:Me,bind:"P:u cf:w cu:r at:w reg:r",code:`${ei}
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
}`})),{name:"transitions",wg:Me,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
}`},{name:"regCells",wg:Me,bind:"P:u cf:r cu:r racc:a",code:`${ji}
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${ji}
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
}`},{name:"regBubs",wg:Me,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${de} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([c,t])=>({name:c,wg:64,bind:"P:u reg:w racc:a",code:`${So}
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
}`})),{name:"compSums",wg:Me,bind:"P:u cf:r cu:r reg:r racc:a",code:`${ji}
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([c,t])=>({name:c,wg:64,bind:"P:u reg:w racc:a",code:`${So}
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
}`})),{name:"compApply",wg:Me,bind:"P:u cf:w cu:r reg:r",code:`${ei}
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
}`},{name:"gasVolumes",wg:Me,bind:"P:u cf:w cu:r reg:r",code:`${de} {
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
}`},{name:"markFaces",wg:Me,bind:"P:u cu:r ff:w fu:w",code:`${de} {
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
}`}],Co=`const THETA_MIN: f32 = ${Yi.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,On=128,He=128,Jt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ue=`
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
`,Lo=`
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
`,M0=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Oo=1,T0=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${Jt} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Oo}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${Jt} {
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
${Jt} {
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
    pargs[0] = max(1u, (total + ${On-1}u) / ${On}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${Jt} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:He,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ue}
${M0}
${Jt} {
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
    if (dv != 0.0) { addF_at(ati(A_VOLSRC, c), dv / glob[G_DT]); }
    cu[cui(U_KPREV, c)] = cu[cui(U_KIND, c)];
  }
  if (c == 0u) { atomicStore(&cnt[C_TMAX], 0u); setF_cnt(C_SUM_WM, 0.0); setF_cnt(C_SUM_WMT, 0.0); }
  let sm = wsum(ms, lid);
  let sv = wsum(vs, lid);
  if (lid == 0u) { addF_cnt(C_SUM_M, sm); addF_cnt(C_SUM_V, sv); }
}`},{name:"classify",wg:He,bind:"P:u cf:r cu:w",code:`${Jt} {
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
}`},{name:"p2g",wg:He,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Lo}
${Jt} {
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
}`},{name:"liqAssemble",wg:He,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Co}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${Jt} {
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
  if (err > 0.0 || !surface) { src += DRIFT_GAIN * err / dt; }
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
}`},{name:"liqPressure",wg:He,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${Jt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:He,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Co}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${Jt} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([c,t,e,s,n,i])=>({name:c,wg:He,bind:"P:u ff:w fu:w",code:`${Jt} {
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
}`})),{name:"g2p",wg:On,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${Lo}
${ue}
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
${Jt} {
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
      q.flags = q.flags | ${Oo}u;
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
}`},{name:"heatWeights",wg:On,bind:"P:u cnt:a cu:r parts:w",code:`${ue}
${Jt} {
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
}`}],_e=128,Pe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Bo=`
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
`,jo=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,qo=`
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
`,S0=[{name:"gasMaxOut",wg:_e,bind:"P:u cu:r ff:r cnt:a",code:`${ue}
${Pe} {
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
}`},{name:"gasFlux",wg:_e,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Bo}
${jo}
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
${Pe} {
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
}`},{name:"gasMove",wg:_e,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Bo}
${jo}
${ue}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Pe} {
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
}`},{name:"macFwd",wg:_e,bind:"P:u glob:r ff:w fu:r",code:`${qo}
${Pe} {
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
}`},{name:"macBack",wg:_e,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${qo}
${Pe} {
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
}`},{name:"viscosity",wg:_e,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Pe} {
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
}`},{name:"gasAssemble",wg:_e,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Pe} {
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
}`},{name:"gasPressure",wg:_e,bind:"P:u cf:w cu:r cgv:r",code:`${Pe} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:_e,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Pe} {
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
}`}],Zt=128,te="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",ts=`
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
`,C0=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,L0=[...[["gatherFull",!0],["gatherPlain",!1]].map(([c,t])=>({name:c,wg:Zt,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${ts}
${te} {
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
    let Ts = tSat(P.pref + cf[F_PL * n + c]);
    cf[F_TSAT * n + c] = Ts;
    setF_at(A_BUDGET * n + c, Cl * (cf[F_PTL * n + c] - Ts));
  } else { cf[F_TSAT * n + c] = 0.0; setF_at(A_BUDGET * n + c, 0.0); }`:""}
}`})),{name:"applyMass",wg:Zt,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${ts}
${ue}
${te} {
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
}`},{name:"diffPrep",wg:Zt,bind:"P:u cf:w cu:w reg:r",code:`${te} {
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
}`},{name:"diffAssemble",wg:Zt,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${C0}
${te} {
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
}`},{name:"diffFaces",wg:Zt,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${te} {
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
}`},{name:"diffApply",wg:Zt,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ue}
${te} {
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
}`},{name:"latentSrc",wg:Zt,bind:"P:u glob:r cf:r at:a",code:`${te} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:Zt,bind:"P:u cf:w cu:r reg:r",code:`${te} {
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
}`},{name:"flashVap",wg:Zt,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${ts}
${te} {
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
}`},{name:"flashParts",wg:Zt,bind:"P:u cnt:a cf:r parts:w",code:`${ts}
${te} {
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
}`},{name:"flashDist",wg:Zt,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ue}
${te} {
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
}`},{name:"fog",wg:Zt,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${ei}
${ue}
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
${te} {
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
}`},{name:"films",wg:Zt,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${te} {
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
}`}],Io=[.125,.75,.125];function O0(c){const t=c.grid,{n:e,nx:s,ny:n,dx:i}=t,r=new Uint8Array(e),a=Uint8Array.from(t.kind),o=new Uint8Array(e),l=new Uint8Array(e),f=new Uint32Array(e),u=new Float64Array(e),h=new Float64Array(e),m=Float32Array.from(t.T),p=c.heat.heaters.map(()=>0),d=new Float64Array(Math.max(1,c.regions.count)),g=c.bodies.list,x=new Uint8Array(e);for(let _=0;_<e;_+=1)t.owner[_]!==0&&t.matB[_]!==0&&(t.solid[_]!==0||t.fs[_]>.5)&&(x[_]=1);const b=(_,w)=>{if(x[_]!==0||x[w]!==0)return;const k=t.owner[_]!==0&&t.matB[_]!==0?t.fs[_]:-1,M=t.owner[w]!==0&&t.matB[w]!==0?t.fs[w]:-1;k<0&&M<0||(x[M>k?w:_]=1)};for(let _=0;_<n;_+=1)for(let w=1;w<s;w+=1)t.au[w+_*(s+1)]<=0&&b(w-1+_*s,w+_*s);for(let _=1;_<n;_+=1)for(let w=0;w<s;w+=1)t.av[w+_*s]<=0&&b(w+(_-1)*s,w+_*s);for(let _=0;_<e;_+=1){if(o[_]=t.solid[_],l[_]=t.kind[_],f[_]=t.role[_]===1&&t.heater[_]>=0?t.heater[_]+1:0,u[_]=t.Es[_],h[_]=t.film[_],x[_]===0)continue;const w=t.owner[_],k=t.solid[_]!==0,M=g[w-1],T=t.matB[_]-1,S=ht[T];if(r[_]=1,!k){const L=c.regions.id[_];L>=0&&(d[L]+=(1-t.fs[_])*t.vCell)}o[_]=T+1,l[_]=ft;const q=t.Ts[_]>0?t.Ts[_]:kr(t.Es[_],t.capB[_],t.film[_],t.crust[_],t.T[_]);u[_]=S.rho*S.cp*t.vCell*(q-st)+t.film[_]*Ft(q),m[_]=q,M!==void 0&&M.heater>=0&&M.heater<p.length&&(f[_]=M.heater+1,p[M.heater]+=1)}for(let _=0;_<e;_+=1)r[_]===0&&f[_]>0&&f[_]<=p.length&&(p[f[_]-1]+=1);const y=(_,w)=>_<0?t.openL?0:1:_>=s?t.openR?0:1:w<0?t.openB?0:1:w>=n?t.openT?0:1:o[_+w*s]!==0?1:0,A=new Float32Array(e),F=new Float32Array(e);for(let _=0;_<n;_+=1)for(let w=0;w<s;w+=1){const k=w+_*s;if(o[k]!==0){A[k]=1;continue}let M=0;for(let T=-1;T<=1;T+=1)for(let S=-1;S<=1;S+=1)M+=Io[S+1]*Io[T+1]*y(w+S,_+T);A[k]=M}const P=4;for(let _=0;_<n;_+=1)for(let w=0;w<s;w+=1){const k=w+_*s,M=o[k]!==0,T=(w+.5)*i,S=(_+.5)*i;let q=P*i;M||(t.openL||(q=Math.min(q,T)),t.openR||(q=Math.min(q,t.w-T)),t.openB||(q=Math.min(q,S)),t.openT||(q=Math.min(q,t.h-S)));for(let L=-P;L<=P;L+=1){const I=_+L;if(!(I<0||I>=n))for(let O=-P;O<=P;O+=1){const D=w+O;if(D<0||D>=s||o[D+I*s]!==0===M)continue;const R=Math.max(0,Math.abs(O)-.5)*i,V=Math.max(0,Math.abs(L)-.5)*i;q=Math.min(q,Math.hypot(R,V))}}F[k]=M?-q:q}return{body:r,kindCpu:a,solid:o,kind:l,hgrp:f,es:u,film:h,T:m,phiS:A,sdf:F,heaterCells:p,vFix:d}}function B0(c,t){if(t===null)return;const e=c.grid,s=e.n;for(let n=0;n<s;n+=1){if(t.body[n]===0)continue;const i=ht[t.solid[n]-1],r=kr(e.Es[n],i.rho*i.cp*e.vCell,e.film[n],0,e.T[n]);e.Es[n]=Cc(e.capB[n],e.film[n],e.crust[n],r),e.solid[n]===0&&(e.kind[n]=t.kindCpu[n])}c.bodies.cover.collect(c.bodies.list);for(let n=0;n<s;n+=1)t.body[n]!==0&&e.capB[n]>0&&c.heat.deriveSolid(n)}const ws=800,j0=24,Ro=6,Dt=4,ks=16,$t=256,Eo=`struct Levels { lv: array<Level, ${ks}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,an=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Vn=`${an}
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
`,Te=`
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
`,$e=`
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
`,Do=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Vo=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,_t="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",qe=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,Ec=6,ms=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,qi=`
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
`,Ii="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",q0=[{name:"cgPrep1",wg:$t,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${an}
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
}`},{name:"cgPrep2",wg:$t,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${qe}
${Vn}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${Ec}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:$t,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
}`},{name:"cclFinal",wg:$t,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${qe}
${qi}
${ms}
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
}`},{name:"cclProject",wg:$t,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${qe}
${Ii}
${ms}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:$t,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${qe}
${an}
${$e}
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
}`},{name:"cgFoldInitMG",wg:$t,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${$e}
${Vo}
${_t} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${qe}
${Te}
${$e}
${Do}
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
}`},{name:"cgB",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${qe}
${Te}
${$e}
${Do}
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
}`},{name:"cgFoldRR",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Te}
${$e}
${Vo}
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
}`},{name:"cgRZ",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Te}
${$e}
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
}`},{name:"cgZSum",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Te}
${qi}
${ms}
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
}`},{name:"cgZSub",wg:$t,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Te}
${Ii}
${ms}
${$e}
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
}`},{name:"cgEnd1",wg:$t,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${qe}
${qi}
${ms}
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
}`},{name:"cgEnd2",wg:$t,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${qe}
${Ii}
${ms}
${_t} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],I0=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function R0(c,t){const e=[];let s=0,n=0,i=c,r=t,a=1,o=0;for(;;){const f=i+2,u=(i+2)*(r+2),h={};for(const d of I0)h[d]=s,s+=u;const m=n;n+=u;let p=0;if(h.pW=0,e.length>0&&(h.pW=s,s+=4*o,p=n,n+=4*o),e.push({nx:i,ny:r,stride:f,size:u,h:a,f:h,act:m,pIdx:p}),i*r<=j0||i<=2&&r<=2||e.length>=ks)break;o=u,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let f=0;f<e.length;f+=1){let u=0;for(let h=f;h<e.length;h+=1)u+=e[h].size;if(u<=ws){l=f;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function Bn(c,t,e,s){if(c===null)return;const n=[c.nx,c.ny,c.stride,c.size,c.f.ax,c.f.ay,c.f.dH,c.f.dDx,c.f.dDy,c.f.diag,c.f.inv,c.f.x,c.f.b,c.h,c.f.gx,c.f.gy,c.f.gDx,c.f.gDy,c.f.eDx,c.f.eDy,c.f.area,c.f.ox,c.f.oy,c.act,c.pIdx,c.f.pW,t,c.f.xp,0,0,0,0];e.set(n,s)}const Dc={tol:1e-5,it:K.IT_L,cap:K.CAP_L,res:K.RES_L},Vc={tol:1e-5,it:K.IT_G,cap:K.CAP_G,res:K.RES_G},Nc={tol:1e-5,it:K.IT_H,cap:K.CAP_H,res:K.RES_H},Uc={tol:1e-5,it:K.IT_D,cap:K.CAP_D,res:K.RES_H},ps=200,me=256;class E0{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);Bn(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(me/4*n.length);for(let l=0;l<n.length;l+=1)Bn(l>0?n[l-1]:null,l-1,r,me/4*l),Bn(n[l],l,r,me/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*ks+4);for(let l=0;l<n.length;l+=1)Bn(n[l],l,a,32*l);a[32*ks]=e.lt,a[32*ks+1]=n.length,this.lv=t.uniform("lv",a.buffer);const o=new Uint32Array(me/4*(ps+1));for(let l=0;l<ps;l+=1)o[me/4*l]=l;o[me/4*ps]=4294967295,this.it=t.uniform("iter",o.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(me*4));for(const l of[Dc,Vc,Nc,Uc])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,me*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,me*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:me*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,me)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,f)=>{const u={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,f,u),this.run(t,"cgZSub",r,f,u)):this.run(t,"cgRZ",r,f,u)};this.vcycle(t),a(ps,`k${ps}`);const o=Math.min(ps,Math.max(1,s));for(let l=0;l<o;l+=1){const f={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,f),this.run(t,"cgB",r,`k${l}`,f),this.one(t,"cgFoldRR",`k${l}`,f),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Ms=16,No=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class D0{constructor(t,e){v(this,"stair",null);v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=R0(s.nx,s.ny);const r=(o,l,f=No)=>{const u=t.buffer(o,4*Math.max(4,l),f);return this.own.push(u),u};this.params=r("params",ko,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Ps),this.cnt=r("cnt",Je),this.cf=r("cf",Mi*i.n),this.cu=r("cu",Ti*i.n),this.at=r("at",Si*i.n),this.ff=r("ff",Ci*i.nf),this.fu=r("fu",Po*i.nf),this.af=r("af",Li*i.nf),this.partsA=r("partsA",us*i.pcap),this.partsB=r("partsB",us*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,No|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",hs*i.bcap),this.bubs2=r("bubs2",hs*i.bcap),this.bacc=r("bacc",nr*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",Bi*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",be*i.nreg),this.racc=r("racc",tr*i.nreg),this.heat=r("heat",ge*i.nheat),this.hacc=r("hacc",er*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",Ic),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",Ec*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",Ms*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*ko),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[it],t.ambientY[rt],t.ambientY[Q],kt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let o=0;for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]===0&&(o=1);i[40]=o,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t,e=null){const s=t.heat.heaters,n=new Float32Array(ge*this.d.nheat);s.forEach((i,r)=>{var o;const a=ge*r;n[a+Nt.MODE]=i.mode==="thermostat"?1:0,n[a+Nt.POWER]=i.power,n[a+Nt.TARGET]=i.target,n[a+Nt.ON]=i.on?1:0,n[a+Nt.P]=i.P,n[a+Nt.TMEAN]=i.Tmean,n[a+Nt.INTEGRAL]=i.integral,n[a+Nt.CELLS]=e!==null?e[r]??0:((o=this.stair)==null?void 0:o.heaterCells[r])??i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,n)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*ge*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n,r=O0(t);this.stair=r,this.writeParams(t),this.writeHeaters(t,r.heaterCells);const a=t.regions,o=Array.from({length:a.count},(j,$)=>$).sort((j,$)=>a.vFluid[$]-a.vFluid[j]);this.regionMap=new Int32Array(Math.max(1,a.count)),this.regionInv=new Int32Array(Math.max(1,a.count)),o.forEach((j,$)=>{this.regionMap[j]=$,this.regionInv[$]=j});const l=new Float32Array(be*s.nreg);for(let j=0;j<a.count;j+=1){const $=be*this.regionMap[j];l[$+zt.OPEN]=a.open[j],l[$+zt.VFLUID]=a.vFluid[j]-r.vFix[j],l[$+zt.P0]=a.p0[j],l[$+zt.RHOBAR]=a.rhoBar[j],l[$+zt.VLIQ]=a.vLiq[j],l[$+zt.VBUB]=a.vBub[j],l[$+zt.VGAS]=a.vGas[j],l[$+zt.P0START]=a.p0[j]}e.writeBuffer(this.reg,0,l);const f=new Uint32Array(Ti*i);for(let j=0;j<i;j+=1){f[We.KIND*i+j]=r.kind[j],f[We.KPREV*i+j]=r.kind[j],f[We.SOLID*i+j]=r.solid[j],f[We.HGRP*i+j]=r.hgrp[j];const $=a.id[j];f[We.RID*i+j]=$<0?Oi:this.regionMap[$]}e.writeBuffer(this.cu,0,f);const u=new Float32Array(Mi*i),h=(j,$,U=0)=>{for(let G=0;G<i;G+=1)u[j*i+G]=$[U+G]};h(nt.PHI,n.phi),h(nt.ALPHA,n.alpha),h(nt.ALPHAOLD,n.alpha),h(nt.PL,n.pl),h(nt.PG,n.pg),h(nt.MN,n.mg,it*i),h(nt.MO,n.mg,rt*i),h(nt.MV,n.mg,Q*i),h(nt.MF,n.mfog),h(nt.HG,n.Hg),h(nt.ES,r.es),h(nt.FILM,r.film),h(nt.T,r.T),h(nt.TL,n.Tl),h(nt.CL,n.Cl);const m=t.gas;h(nt.VGAS,m.vgas),h(nt.RHO,m.rho),h(nt.NMOL,m.nmol),h(nt.CAP,m.cap),h(nt.MU,m.mu),h(nt.VEOS,m.veos),h(nt.SRCV,m.srcV),h(nt.VEOSMID,m.veosMid),h(nt.PHIS,r.phiS),h(nt.SDF,r.sdf),h(nt.PTL,r.T),e.writeBuffer(this.cf,0,u);const p=new Float32Array(Si*i);for(let j=0;j<i;j+=1)p[sr.VOLSRC*i+j]=t.liquid.volSrc[j];e.writeBuffer(this.at,0,p);const d=s.nf,g=new Float32Array(Ci*d);for(let j=0;j<s.nu;j+=1)g[ke.UL*d+j]=n.ul[j],g[ke.UG*d+j]=n.ug[j];for(let j=0;j<s.nv;j+=1)g[ke.UL*d+s.nu+j]=n.vl[j],g[ke.UG*d+s.nu+j]=n.vg[j];e.writeBuffer(this.ff,0,g),e.writeBuffer(this.fu,0,new Uint32Array(Po*d));const x=new Float32Array(Li*d);for(let j=0;j<s.nu;j+=1)x[j]=t.liquid.fU[j];for(let j=0;j<s.nv;j+=1)x[s.nu+j]=t.liquid.fV[j];e.writeBuffer(this.af,0,x);const b=t.particles,y=t.liquid,A=new ArrayBuffer(4*us*Math.max(1,b.count)),F=new Float32Array(A),P=new Uint32Array(A),_=new Int32Array(A);for(let j=0;j<b.count;j+=1){const $=us*j;F.set([b.x[j],b.y[j],b.vx[j],b.vy[j],b.c00[j],b.c01[j],b.c10[j],b.c11[j],b.mass[j],b.h[j],b.T[j],b.rho[j],y.dVp[j]],$),P[$+13]=0,P[$+14]=b.id[j],_[$+15]=y.bi[j],_[$+16]=y.bj[j];for(let U=0;U<9;U+=1)F[$+17+U]=y.wt[9*j+U]}b.count>0&&e.writeBuffer(this.partsA,0,A);const w=t.bubbles,k=t.bubbleModel.motionState,M=new ArrayBuffer(4*hs*Math.max(1,w.count)),T=new Float32Array(M),S=new Uint32Array(M),q=new Int32Array(M);for(let j=0;j<w.count;j+=1){const $=hs*j,U=j*at;T.set([w.x[j],w.y[j],w.z[j],w.vx[j],w.vy[j],w.m[U+it],w.m[U+rt],w.m[U+Q],w.H[j],w.age[j]],$),q[$+10]=w.site[j],T.set([w.r[j],w.V[j],w.pb[j],w.pv[j],w.Tb[j],w.dmdt[j],k.ux0[j],k.uy0[j]],$+11),S[$+19]=w.id[j],S[$+20]=1;for(let G=0;G<re;G+=1)T[$+21+G]=w.force[j*re+G]}w.count>0&&e.writeBuffer(this.bubs,0,M);const L=t.bubbleModel.cavities;this.nsites=L.count;const I=new ArrayBuffer(4*Bi*s.nsites),O=new Uint32Array(I),D=new Float32Array(I),R=n.nx;for(let j=0;j<L.count;j+=1){const $=Bi*j;let U=L.cell[j],G=L.r[j];if(U>=0&&r.solid[U]===0){const tt=L.dir[j],pt=tt===0?U+1:tt===1?U-1:tt===2?U+R:U-R;pt>=0&&pt<i&&r.solid[pt]!==0?U=pt:G=1e-9}O.set([U,L.fluid[j],L.dir[j],0],$),D.set([G,L.s[j],L.z[j],0],$+4)}e.writeBuffer(this.sites,0,I);const V=new Uint32Array(s.nsites);for(let j=0;j<L.count;j+=1)V[j]=L.bubble[j];e.writeBuffer(this.sbub,0,V);const W=new Float32Array(Ps);W[Fs.DT]=t.dt,W[Fs.TIME]=t.time,W[Fs.RHOREF]=y.rhoRef,e.writeBuffer(this.glob,0,W);const N=new Uint32Array(Je),Y=new Float32Array(N.buffer);N[K.PCOUNT]=b.count,N[K.PSORT]=b.count,N[K.BCOUNT]=w.count,N[K.NEXTID_B]=Math.max(1,w.nextFree),N[K.NEXTID_P]=Math.max(1,b.nextFree);const J=t.bubbleModel;N[K.WATCH]=J.watch>=0?J.watch:Oi,N[K.WATCH_FATE]=J.watchFate,J.firstSuperheat!==null&&(Y[K.FIRST_SH]=J.firstSuperheat+1e3,N[K.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,N),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(nr*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(tr*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(er*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(f=>Math.ceil(f.size/4)*4),n=s.reduce((f,u)=>f+u,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((f,u)=>{s[u]>0&&r.copyBufferToBuffer(f.buf,f.offset,i,a,s[u]),a+=s[u]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const o=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const f of s)l.push(o.slice(a,a+f)),a+=f;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,o,l,f,u,h,m]=await this.read([{buf:this.cnt,offset:0,size:4*Je},{buf:this.glob,offset:0,size:4*Ps},{buf:this.cf,offset:0,size:4*Mi*s},{buf:this.cu,offset:0,size:4*Ti*s},{buf:this.at,offset:0,size:4*Si*s},{buf:this.ff,offset:0,size:4*Ci*e.nf},{buf:this.af,offset:0,size:4*Li*e.nf},{buf:this.heat,offset:0,size:4*ge*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*be*e.nreg}]),p=new Uint32Array(n),d=Math.min(e.pcap,p[K.PCOUNT]),g=Math.min(e.bcap,p[K.BCOUNT]),[x,b]=await this.read([{buf:this.partsA,offset:0,size:4*us*Math.max(1,d)},{buf:this.bubs,offset:0,size:4*hs*Math.max(1,g)}]),y=t.grid,A=new Float32Array(r),F=(C,E,B=0)=>{for(let X=0;X<s;X+=1)E[B+X]=A[C*s+X]};F(nt.PHI,y.phi),F(nt.ALPHA,y.alpha),F(nt.PL,y.pl),F(nt.PG,y.pg),F(nt.MN,y.mg,it*s),F(nt.MO,y.mg,rt*s),F(nt.MV,y.mg,Q*s),F(nt.MF,y.mfog),F(nt.HG,y.Hg),F(nt.ES,y.Es),F(nt.FILM,y.film),F(nt.T,y.T),F(nt.TL,y.Tl),F(nt.CL,y.Cl);const P=t.gas;F(nt.VGAS,P.vgas),F(nt.RHO,P.rho),F(nt.NMOL,P.nmol),F(nt.CAP,P.cap),F(nt.MU,P.mu),F(nt.VEOS,P.veos),F(nt.SRCV,P.srcV),F(nt.VEOSMID,P.veosMid);const _=new Uint32Array(a);for(let C=0;C<s;C+=1)y.kind[C]=_[We.KIND*s+C];const w=new Float32Array(o);for(let C=0;C<s;C+=1)t.liquid.volSrc[C]=w[sr.VOLSRC*s+C];const k=new Float32Array(l),M=new Float32Array(f),T=e.nf;for(let C=0;C<e.nu;C+=1)y.ul[C]=k[ke.UL*T+C],y.ug[C]=k[ke.UG*T+C],t.liquid.fU[C]=M[C];for(let C=0;C<e.nv;C+=1)y.vl[C]=k[ke.UL*T+e.nu+C],y.vg[C]=k[ke.UG*T+e.nu+C],t.liquid.fV[C]=M[e.nu+C];const S=t.particles,q=t.liquid,L=new Float32Array(x),I=new Uint32Array(x),O=new Int32Array(x);let D=0,R=0;for(let C=0;C<d;C+=1){const E=us*C;if(I[E+13]&1||!(L[E+8]>0))continue;const B=D;D+=1,S.x[B]=L[E],S.y[B]=L[E+1],S.vx[B]=L[E+2],S.vy[B]=L[E+3],S.c00[B]=L[E+4],S.c01[B]=L[E+5],S.c10[B]=L[E+6],S.c11[B]=L[E+7],S.mass[B]=L[E+8],S.h[B]=L[E+9],S.spc[2*B]=0,S.spc[2*B+1]=0,S.smass[2*B]=0,S.smass[2*B+1]=0,S.mat[B]=0,S.id[B]=I[E+14],S.id[B]>R&&(R=S.id[B]),q.dVp[B]=L[E+12],q.bi[B]=O[E+15],q.bj[B]=O[E+16];for(let X=0;X<9;X+=1)q.wt[9*B+X]=L[E+17+X];S.derive(B)}S.count=D,S.reserveIds(Math.max(p[K.NEXTID_P],R+1)),q.weightsDirty=!0;const V=t.bubbles,W=t.bubbleModel.motionState,N=new Float32Array(b),Y=new Uint32Array(b),J=new Int32Array(b);V.count=0;let j=0;for(let C=0;C<g;C+=1){const E=hs*C;if(Y[E+20]===0)continue;const B=V.count;V.count+=1;const X=B*at;V.x[B]=N[E],V.y[B]=N[E+1],V.z[B]=N[E+2],V.vx[B]=N[E+3],V.vy[B]=N[E+4];for(let z=0;z<at;z+=1)V.m[X+z]=0;V.m[X+it]=N[E+5],V.m[X+rt]=N[E+6],V.m[X+Q]=N[E+7],V.H[B]=N[E+8],V.age[B]=N[E+9],V.site[B]=J[E+10],V.r[B]=N[E+11],V.V[B]=N[E+12],V.pb[B]=N[E+13],V.pv[B]=N[E+14],V.Tb[B]=N[E+15],V.dmdt[B]=N[E+16],W.ux0[B]=N[E+17],W.uy0[B]=N[E+18],V.id[B]=Y[E+19],V.id[B]>j&&(j=V.id[B]);for(let z=0;z<re;z+=1)V.force[B*re+z]=N[E+21+z]}V.reserveIds(Math.max(p[K.NEXTID_B],j+1));const $=t.bubbleModel.cavities,U=new Uint32Array(h);for(let C=0;C<$.count;C+=1)$.bubble[C]=U[C];const G=new Float32Array(m);for(let C=0;C<t.regions.count;C+=1){const E=be*this.regionMap[C];t.regions.p0[C]=G[E+zt.P0],t.regions.rhoBar[C]=G[E+zt.RHOBAR]}const tt=new Float32Array(u);t.heat.heaters.forEach((C,E)=>{const B=ge*E;C.P=tt[B+Nt.P],C.Tmean=tt[B+Nt.TMEAN],C.integral=tt[B+Nt.INTEGRAL]});const pt=new Float32Array(i);t.dt=pt[Fs.DT];const wt=t.bubbleModel;wt.watch=p[K.WATCH]===Oi?-1:p[K.WATCH],B0(t,this.stair)}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const Ie=128,Wt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",V0=5,Uo=30,Go=`
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
`,N0=[{name:"heaterSums",wg:Ie,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Wt} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Wt} {
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
        let kp = power / ${V0}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${Uo}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${Uo}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:Ie,bind:"P:u cnt:a parts:r",code:`${ue}
${Wt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:Ie,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${ts}
${ue}
${Wt} {
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
}`},{name:"heatAssemble",wg:Ie,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Go}
${Wt} {
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
}`},{name:"heatFlux",wg:Ie,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Go}
${ei}
${ue}
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
${Wt} {
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
}`},{name:"heatParts",wg:Ie,bind:"P:u cnt:a cf:r parts:w",code:`${ts}
${Wt} {
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
}`},{name:"heatShare",wg:Ie,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${ts}
${Wt} {
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
}`},{name:"pwParts",wg:Ie,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Wt} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Wt} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Wt} {
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
${Wt} {
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
  if (lid < 8u) { meas[wid3.x * ${Ms}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${4*256}>;
${Wt} {
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
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Ms}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Wt} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Ms}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Wt} {
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
}`}],gs=256,U0=[...[1,2,3].map(c=>({name:`mgC${c}`,wg:gs,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Vn}
${_t} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${c===1?"coarsen1(LP.F, C, t);":c===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:gs,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Vn}
${_t} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:gs,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Eo}
${Vn}
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
}`},{name:"mgPost",wg:gs,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${an}
${Te}
const TILE: u32 = 16u;
const HALO: u32 = ${Dt}u;
const TS: u32 = ${16+2*Dt}u;
var<workgroup> sx: array<f32, ${(16+2*Dt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Dt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Dt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Dt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Dt)**2}>;
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
  for (var k = 0u; k < ${Dt}u; k++) {
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
}`},{name:"mgPreR",wg:gs,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${an}
${Te}
const TILE: u32 = 12u;
const HALO: u32 = ${Dt+2}u;
const TS: u32 = ${12+2*(Dt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Dt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Dt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Dt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Dt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Dt+2))**2}>;
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
  for (var k = 0u; k < ${Dt}u; k++) {
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
}`},{name:"mgTail",wg:gs,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Eo}
${Te}
var<workgroup> tx: array<f32, ${ws}>;
var<workgroup> tb: array<f32, ${ws}>;
var<workgroup> tax: array<f32, ${ws}>;
var<workgroup> tay: array<f32, ${ws}>;
var<workgroup> tinv: array<f32, ${ws}>;
var<workgroup> toff: array<u32, ${ks}>;
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
  for (var k = 0u; k < ${Ro}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Ro}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],jn=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Lr(c){const t=/^#?([0-9a-f]{6})$/i.exec(c.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const xe=[0,120],xs=128,vs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",G0=.006,H0={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},$0=4*1e3*15e-7/(3*2*.07),Or=`
const VIR = array<vec3<f32>, ${jn.length}>(${jn.map(c=>`vec3<f32>(${ot(c[0]/255)}, ${ot(c[1]/255)}, ${ot(c[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${ot(jn.length-1)};
  let i = min(u32(floor(x)), ${jn.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Ri="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",W0=[{name:"rScale",wg:xs,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Ri}
var<workgroup> m4: array<vec4<f32>, WG>;
${vs} {
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
}`},{name:"rCells",wg:xs,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Ri}
${Or}
const SOLID_RGB = array<vec3<f32>, ${ht.length}>(${ht.map(c=>{const t=Lr(c.color);return`vec3<f32>(${ot(t[0]/255)}, ${ot(t[1]/255)}, ${ot(t[2]/255)})`}).join(", ")});
${vs} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${ot(xe[0])};
  let tspan = ${ot(xe[1]-xe[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${ht.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${ot($0)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:xs,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${vs} {
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
}`},{name:"rLiqBlurX",wg:xs,bind:"P:u lq:r lq2:w",code:`${vs} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:xs,bind:"P:u lq2:r liquid:t",code:`${vs} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${ot(xe[0])}) / ${ot(xe[1]-xe[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:xs,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Ri}
${vs} {
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
}`}],yn=`
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
`,Ei=`${yn}
${Or}
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
`,K0=`${yn}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,z0=`${yn}
${(Sr.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
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
`,Q0=`${yn}
${Or}
${(Sr.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
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
  o.t = clamp((parts[p].T - ${ot(273.15+xe[0])}) / ${ot(xe[1]-xe[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,X0=`${yn}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Ho=48,Di=256,Y0=12;class J0{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",Di*Y0,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,p,d,g,x=[])=>{const b=t.createShaderModule({code:m}),A=(await b.getCompilationInfo()).messages.filter(F=>F.type==="error");if(A.length>0)throw new Error(`render WGSL: ${A.map(F=>`${F.lineNum}:${F.linePos} ${F.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[d]}),vertex:{module:b,entryPoint:"vs",buffers:x},fragment:{module:b,entryPoint:p,targets:[{format:this.format,blend:e}]},primitive:{topology:g}})},[r,a,o,l,f,u,h]=await Promise.all([i(Ei,"fsCells",this.layouts.quad,"triangle-strip"),i(Ei,"fsField",this.layouts.quad,"triangle-strip"),i(Ei,"fsLiquid",this.layouts.quad,"triangle-strip"),i(K0,"fs",this.layouts.rect,"triangle-strip"),i(z0,"fs",this.layouts.store,"triangle-strip"),i(Q0,"fs",this.layouts.store,"triangle-strip"),i(X0,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:o,rect:l,disc:f,point:u,line:h}}ensure(){var f,u,h,m,p,d;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(g,x)=>s.createTexture({size:[g,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(u=this.fieldTex)==null||u.destroy(),(h=this.liquidTex)==null||h.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(p=this.lq2)==null||p.destroy(),(d=this.arrows)==null||d.destroy(),this.lq=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(G0/this.gpu.cpu.grid.dx)),a=r>>1,o=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=o*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,o,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:Di*s,size:4*Ho}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const o=this.gpu.state,l=this.gpu.ctx,f=this.device.queue;this.roData[0]=H0[r],f.writeBuffer(this.ro,0,this.roData),t.clearBuffer(o.cnt,4*K.OV_PMAX,16);const u=t.beginComputePass(),h=o.d.n;l.dispatch(u,"rScale",this.computeGroup("rScale",{}),h),l.dispatch(u,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),h),a||(l.dispatch(u,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*h),l.dispatch(u,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*h),l.dispatch(u,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*h)),r==="velocity"&&l.dispatch(u,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),u.end();const m=this.gpu.cpu.grid,p=(y,A,F)=>{const P=new Float32Array(Ho),_=new Uint32Array(P.buffer);P.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),P.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),P.set(A,24),P.set(F,28),P[32]=r==="temperature"?1:0,P[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),_[34]=o.d.bcap,_[35]=o.d.pcap,f.writeBuffer(this.rp,Di*y,P)},d=.003;p(0,[0,0,m.w,m.h],[...this.theme.ground,1]),p(1,[0,0,0,0],[0,0,0,0]),p(2,[0,0,0,0],[...this.theme.ink,.85]),p(3,[0,0,0,0],[...this.waterInk,.9]);const g=[];i.left&&g.push([-d,-d,0,m.h+(i.top?d:0)]),i.right&&g.push([m.w,-d,m.w+d,m.h+(i.top?d:0)]),i.bottom&&g.push([-d,-d,m.w+d,0]),i.top&&g.push([-d,m.h,m.w+d,m.h+d]),g.forEach((y,A)=>p(4+A,y,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),b=this.pipes;x.setPipeline(b.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(b.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:o.partsA})),x.draw(4,o.d.pcap)):(x.setPipeline(b.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(b.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:o.bubs})),x.draw(4,o.d.bcap),x.setPipeline(b.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(b.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(b.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(b.rect),g.forEach((y,A)=>{x.setBindGroup(0,this.drawGroup(`d-wall${A}`,this.layouts.rect,4+A,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const Z0=[...q0,...U0,...T0,...k0,...S0,...A0,...P0,...L0,...N0,...W0],$o=[["heater",K.HEATER_E,"f"],["lossWalls",K.LOSS_WALLS,"f"],["lossOpen",K.LOSS_OPEN,"f"],["escapedEnergy",K.ESC_ENERGY,"f"],["escapedWater",K.ESC_WATER,"f"],["escapedAir",K.ESC_AIR,"f"],["produced",K.PRODUCED,"f"],["condensed",K.CONDENSED,"f"],["dew",K.DEW,"f"],["fogMade",K.FOGMADE,"f"],["burstVapour",K.BURSTVAP,"f"],["fluxSL",K.FLUX_SL,"f"],["fluxLG",K.FLUX_LG,"f"],["fluxSG",K.FLUX_SG,"f"],["lossSolids",K.LOSS_SOLIDS,"f"],["nucleated",K.NUCLEATED,"u"],["departed",K.DEPARTED,"u"],["merged",K.MERGED,"u"],["burst",K.BURST,"u"],["collapsed",K.COLLAPSED,"u"],["burstCold",K.BURST_COLD,"u"],["burstWarm",K.BURST_WARM,"u"],["collapsedCold",K.COLL_COLD,"u"],["collapsedWarm",K.COLL_WARM,"u"]],Wo=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),Vi=256,ys=2*Ye;class Br{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",Wo());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"sealed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(Ye).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:ys}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*ys,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await Cr.create(),s=await e.compile(Z0);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new Br(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new D0(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new E0(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Vi/4*16);for(let n=0;n<16;n+=1)s[Vi/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Vi*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,ys,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);this.sort(n,1),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.cells(n,"liqAssemble"),this.solver.encodeMG(n,Dc,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,Vc,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,Uc,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,Nc,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*Je,n=s+4*Ps,i=n+4*be*t.d.nreg,r=i+4*ge*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],o=r+4*Ms*a,l=o+4*64,f=l+8*ys;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:o,ts:l,total:f}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(o=>!this.busy.has(o)&&o.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*Je),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Ps),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*be*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*ge*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*ys),t.clearBuffer(s.cnt,4*_o,4*(zf-_o)),this.busy.add(i);const a=[];for(let o=0;o<this.cpu.regions.count;o+=1)a.push(s.gpuRegion(o));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,Je),r=new Float32Array(t,n.cnt,Je),a=new Float32Array(t,n.glob,Ps),o=new Float32Array(t,n.reg,be*e.nreg),l=new Float32Array(t,n.heat,ge*e.nheat),f=new Float32Array(t,n.meas,(n.probe-n.meas)/4),u=new Float32Array(t,n.probe,64),[h,m,p]=e.groups,d=(F,P,_)=>{let w=0;for(let k=0;k<P;k+=1)w+=f[(F+k)*Ms+_];return w},g=[];for(const F of e.regions){const P=be*F;g.push({p0:o[P+zt.P0],sealed:o[P+zt.OPEN]===0,vGas:o[P+zt.VGAS],vFluid:o[P+zt.VFLUID]})}const x=[];for(let F=0;F<e.heaters;F+=1){const P=ge*F;x.push({P:l[P+Nt.P],Tmean:l[P+Nt.TMEAN],integral:l[P+Nt.INTEGRAL],cells:l[P+Nt.CELLS]})}let b=null;if(s&&this.queryBuf!==null){const F=new BigUint64Array(t,n.ts,ys);b=[];for(let P=0;P<Ye;P+=1){const _=F[2*P],w=F[2*P+1];b.push(w>_&&_>0n?Number(w-_)/1e6:0)}}const y=r[K.SUM_WM],A={};for(const[F,P,_]of $o)A[F]=_==="f"?r[P]:i[P];return{intervals:A,ov:[r[K.OV_PMAX],r[K.OV_VMAX],r[K.OV_VLIQ]],pcount:i[K.PCOUNT],bcount:i[K.BCOUNT],dt:a[Fs.DT],stepsSince:i[K.STEPS],simSince:r[K.SIMTIME],itL:i[K.IT_L],itG:i[K.IT_G],itH:i[K.IT_H],itD:i[K.IT_D],capL:i[K.CAP_L],capG:i[K.CAP_G],capH:i[K.CAP_H],capD:i[K.CAP_D],resL:r[K.RES_L],resG:r[K.RES_G],resH:r[K.RES_H],nsub:i[K.NSUBMAX],uMaxG:r[K.UMAXG],waterMass:y,waterT:y>0?r[K.SUM_WMT]/y:0,waterTmax:r[K.TMAX],solids:d(0,h,0),film:d(0,h,1),gas:d(0,h,2),vapour:d(0,h,3),fog:d(0,h,4),air:d(0,h,5),liquidCells:Math.round(d(0,h,6)),gasCells:Math.round(d(0,h,7)),liquidH:d(h,m,0),liquidMass:d(h,m,1),sensible:d(h,m,3),bubH:d(h+m,p,0),bubWater:d(h+m,p,1),bubAir:d(h+m,p,2),regions:g,heaters:x,watch:{found:u[31]===1,id:new Uint32Array(u.buffer,u.byteOffset+4*21,1)[0],fate:i[K.WATCH_FATE],data:new Float32Array(u)},firstSuperheat:i[K.FIRST_SH]!==0?r[K.FIRST_SH]-1e3:null,stageMs:b}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of $o)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(n,i,r,a,o,l)=>{if(i===0&&r===0)return n;const f=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(o,Math.max(a,n>f?Math.max(f,n-2):f))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:0,editOther:e.ledger.other,escapedSalt:0,editSalt:e.ledger.salt,bodyWork:0},o=this.energy0??r.energy,l=this.water0??r.water.total,f=r.energy-o-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),u=r.water.total-l-a.editWater,h=i.produced+i.burstVapour,m=i.time-this.vapourLast;m>.2&&(this.vapourRate=(h-this.vapourMark)/m,this.vapourMark=h,this.vapourLast=i.time);const p=e.heat.heaters.map((x,b)=>({h:x,k:b,rd:n==null?void 0:n.heaters[b]})).filter(({rd:x,h:b})=>((x==null?void 0:x.cells)??b.cells)>0).map(({h:x,rd:b})=>({group:x.group,P:(b==null?void 0:b.P)??x.P,Tmean:(b==null?void 0:b.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),d=(x,b,y)=>({iterations:x,residual:b,capped:y>0}),g=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:d((g==null?void 0:g.itL)??0,(g==null?void 0:g.resL)??0,(g==null?void 0:g.capL)??0),gas:d((g==null?void 0:g.itG)??0,(g==null?void 0:g.resG)??0,(g==null?void 0:g.capG)??0),heat:d((g==null?void 0:g.itH)??0,(g==null?void 0:g.resH)??0,(g==null?void 0:g.capH)??0),gasSubsteps:(g==null?void 0:g.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:0,otherT:0,saltMass:0,saltSolid:0,bodies:{count:this.cpu.bodies.list.filter(x=>!x.gone).length,free:0,awake:0},heaters:p,regions:((n==null?void 0:n.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:a,energyError:f,waterError:u,otherError:0,saltError:0,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy}}budget(){const t=this.last,e=this.totals;let s=0;for(const l of(t==null?void 0:t.regions)??[])l.sealed&&(s-=l.p0*l.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,o={liquid:(t==null?void 0:t.liquidMass)??0,ice:0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:o,other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0},air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,Wo()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return kt(this.cpu.regions.pAmb)}}const tu=.3;ht.map(c=>Lr(c.color));var Zo;Lr(((Zo=wc[0])==null?void 0:Zo.color)??"#f4f3ee");function eu(c,t,e,s,n){const i=-n,r=-n,a=c+2*n,o=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/o>l){const u=a/l;return{x0:i,y0:r-(u-o)/2,x1:i+a,y1:r-(u-o)/2+u}}const f=o*l;return{x0:i-(f-a)/2,y0:r,x1:i-(f-a)/2+f,y1:r+o}}const Os=self,Ot=c=>Os.postMessage(c),Ko=8,su=.1,nu=3,zo=200,iu=.25,Qo=273.15;let lt=null,Z=null,Ne=null,si=null,Le=null,Ts="",Nn=1,Un=1,Gn=1,Bs={x0:0,y0:0,x1:1,y1:1},js={left:!0,right:!0,bottom:!0,top:!1},qs=!1,rr=1,Qe="none",Gc=!1,Xe=0,Ss=0,or=0,Ni=0,Ui=!1,ln=0,Xo=0,cr=0,ar=0,Yo=!1,lr=0,As=null;const Ke=[],fr=[];let ni=!1;const Cs=[];function jr(){if(lt===null)return;const c=lt.scene.sides;js={left:c.left==="wall",right:c.right==="wall",bottom:c.bottom==="wall",top:c.top==="wall"}}function qr(c,t,e){Nn=Math.max(1,c),Un=Math.max(1,t),Gn=Math.max(.5,Math.min(3,e)),Le!==null&&(Le.width=Math.round(Nn*Gn),Le.height=Math.round(Un*Gn)),lt!==null&&(Bs=eu(lt.boxW,lt.boxH,Nn,Un,.006))}function Hc(c){Ne!==null&&(Ne.theme={ground:c?[.1,.12,.15]:[.93,.95,.97],outside:c?[.06,.07,.09]:[.86,.88,.9],wall:c?[.55,.6,.66]:[.42,.46,.5],ink:c?[.9,.93,.96]:[.08,.1,.12]})}function bs(c){fr.push(c),ni||ru()}async function ru(){if(Z!==null){ni=!0;try{for(;fr.length>0;){const c=fr.shift();await Z.ctx.device.queue.onSubmittedWorkDone();try{await c()}catch(t){Ot({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{ni=!1,Ss=performance.now()}}}async function ur(){if(Z===null)return;const c=Z.ctx.device.createCommandEncoder(),t=Z.encodeReadback(c,!1);Z.ctx.device.queue.submit([c.finish()]),t!==null&&await Z.finishReadback(t,!1),Z.baselineFromLast()}function Ir(){return lt===null||!lt.needsCpu()?!1:(Ot({type:"gpu",ok:!1,adapter:Ts,message:"other-liquid",scene:lt.serialize()}),!0)}function Rr(c){Z!==null&&Ne!==null&&Z.stateVersion!==c&&Ne.reset()}function Gi(){bs(async()=>{if(Z===null||lt===null||Cs.length===0)return;const c=Cs.splice(0,Cs.length);await ur(),await Z.download();for(const e of c){const s=lt.apply(e);s!==null&&s.startsWith("refused")&&Ot({type:"refused",message:s})}if(Ir())return;const t=Z.stateVersion;Z.upload(),Rr(t)})}function ou(c){const t=(c==null?void 0:c.ov)??[0,0,0],e=t[2];if(Qe==="temperature")return[Qo+xe[0],Qo+xe[1],e];if(Qe==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return Qe==="velocity"?[0,Math.max(.02,t[1]),e]:Qe==="vapour"?[0,.6,e]:Qe==="salt"?[0,tu,e]:[0,1,e]}function cu(c){if(c===null)return null;const t=c.watch;if(t.found){const e=t.data;return As={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:kt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},As}return As!==null&&(t.fate===1||t.fate===2)?{...As,fate:t.fate===1?"burst":"collapsed"}:null}function au(c,t){if(Z===null||si===null)return;if(Z.baselineFromLast(),Z.totals.time>=lr){const i=si.sample();i!==null&&(Ke.push(i),Ke.length>400&&Ke.splice(0,Ke.length-400),lr=Z.totals.time+iu)}const e=Math.max(.001,(t-ln)/1e3),s=(c.stageMs??Z.stageMs).reduce((i,r)=>i+r,0),n={engine:Z.stats(s),stepsPerSecond:ar/e,simRate:(Z.totals.time-Xo)/e,fps:cr/e,renderMs:0,mode:"gpu",adapter:Ts,paused:qs,samples:Ke.splice(0,Ke.length),bubble:cu(c),overlayScale:ou(c)};Ot({type:"stats",stats:n}),cr=0,ar=0,Xo=Z.totals.time,ln=t}function hr(){var t;const c=performance.now();if(Z!==null&&Ne!==null&&Le!==null&&lt!==null&&!ni){const e=Z.ctx.device,s=Ss===0?0:Math.min(.1,(c-Ss)/1e3);Ss=c;const n=((t=Z.last)==null?void 0:t.dt)??lt.dt;let i=0;qs?(i=Math.min(Ko,or),or-=i,Xe=0):(Xe=Math.min(Xe+s*rr,su*Math.max(1,rr)),i=Ni>=nu?0:Math.min(Ko,Math.floor(Xe/Math.max(1e-5,n))),Xe-=i*n);const r=!Ui&&c-ln>zo&&(i>0||qs||c-ln>4*zo),a=e.createCommandEncoder();i>0&&Z.encodeSteps(a,i,r);const o=r?Z.encodeReadback(a,r&&i>0):null;if(Ne.encode(a,Bs,Le.width,Le.height,js,Qe,Gc),e.queue.submit([a.finish()]),Ni+=1,e.queue.onSubmittedWorkDone().then(()=>{Ni-=1}),ar+=i,cr+=1,o!==null){Ui=!0;const l=i>0;Z.finishReadback(o,l).then(f=>{Ui=!1,f!==null&&au(f,performance.now())})}}typeof Os.requestAnimationFrame=="function"?Os.requestAnimationFrame(hr):setTimeout(hr,16)}async function lu(c){if(lt=new Kf(c.scene),qs=c.paused===!0,Ir())return;if(Le=c.canvas,Le===null)throw new Error("no OffscreenCanvas");Z=await Br.create(lt),Ts=await(async()=>{var e;try{const s=await((e=Os.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),Ne=new J0(Z,Le),await Ne.init(),Hc(c.dark),si=new qc(Z),Z.ctx.device.addEventListener("uncapturederror",e=>Ot({type:"error",message:`WebGPU: ${e.error.message}`})),Z.ctx.device.lost.then(e=>Ot({type:"gpu",ok:!1,adapter:Ts,message:e.message||e.reason})),jr(),qr(c.width,c.height,c.dpr),Ot({type:"gpu",ok:!0,adapter:Ts,message:""}),Ot({type:"ready",offscreen:!0,warnings:lt.warnings,view:Bs,quality:lt.currentQuality,walls:js}),ln=performance.now(),Ss=performance.now(),Yo||(Yo=!0,hr())}function Jo(){if(Z===null||lt===null)return;const c=Z.stateVersion;Z.cpu=lt,Z.rebuild(),Z.resetTotals(),Rr(c),si=new qc(Z),lr=0,Ke.length=0,Xe=0,As=null,jr(),qr(Nn,Un,Gn),Ot({type:"view",view:Bs,walls:js})}Os.addEventListener("message",c=>{const t=c.data;try{switch(t.type){case"probe":Ot({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&Os.navigator.gpu!==void 0});break;case"init":lu(t).catch(e=>Ot({type:"gpu",ok:!1,adapter:Ts,message:e instanceof Error?e.message:String(e)}));break;case"resize":qr(t.width,t.height,t.dpr),Ot({type:"view",view:Bs,walls:js});break;case"op":Cs.push(t.op),Gi();break;case"addLiquid":Cs.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Gi();break;case"addSolid":Cs.push({op:"solid",region:t.region,material:t.material,T:t.T}),Gi();break;case"setHeater":lt==null||lt.setHeater(t.group,t.mode,t.power,t.target,t.on),Z==null||Z.writeHeater(t.group);break;case"setAmbient":lt==null||lt.setAmbient(t.p,t.T,t.rh,t.g,t.air),Z==null||Z.writeParams();break;case"setBoundary":bs(async()=>{if(Z===null||lt===null)return;await ur(),await Z.download(),lt.setBoundary(t.side,t.value);const e=Z.stateVersion;Z.upload(),Rr(e),jr(),Ot({type:"view",view:Bs,walls:js})});break;case"query":bs(async()=>{if(Z===null||lt===null){Ot({type:"reply",id:t.id,data:null});return}await ur(),await Z.download(),Ot({type:"reply",id:t.id,data:lt.query(t.x,t.y)})});break;case"select":As=null,Z==null||Z.watch(t.bubble);break;case"overlay":Qe=t.overlay;break;case"particles":Gc=t.on;break;case"pause":qs=t.paused,Xe=0,Ss=performance.now();break;case"step":qs&&(or+=1);break;case"setSpeed":rr=Math.min(64,Math.max(.05,t.speed));break;case"setQuality":bs(async()=>{lt!==null&&(lt.setQuality(t.quality),Jo())});break;case"serialize":Z===null?Ot({type:"reply",id:t.id,data:(lt==null?void 0:lt.serialize())??null}):bs(async()=>{Ot({type:"reply",id:t.id,data:(lt==null?void 0:lt.serialize())??null})});break;case"load":bs(async()=>{lt!==null&&(lt.load(t.scene),!Ir()&&Jo())});break;case"theme":Hc(t.dark);break;case"frameDone":break}}catch(e){Ot({type:"error",message:e instanceof Error?e.message:String(e)})}});
