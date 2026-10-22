var Vo=Object.defineProperty;var No=(o,t,e)=>t in o?Vo(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var v=(o,t,e)=>No(o,typeof t!="symbol"?t+"":t,e);const Lt=8.314462618,kn=9.80665,Cs=101325,ot=273.15,Xi=1602176634e-28,Go=1380649e-29,Uo=602214076e15,Ho=88541878128e-22,U=0,ut=1,pt=2,it=0,rt=1,z=2,lt=6,gt=3,Xt=8;class $o{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"z");v(this,"vx");v(this,"vy");v(this,"m");v(this,"H");v(this,"age");v(this,"site");v(this,"r");v(this,"V");v(this,"pb");v(this,"pv");v(this,"Tb");v(this,"dmdt");v(this,"force");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*lt),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*Xt),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<lt;i+=1)this.m[n*lt+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<Xt;i+=1)this.force[n*Xt+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<lt;s+=1)e+=this.m[t*lt+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<lt;s+=1)this.m[t*lt+s]=this.m[e*lt+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<Xt;s+=1)this.force[t*Xt+s]=this.force[e*Xt+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Wo={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Ko=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],zo=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],Qo={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Xo=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},color:"#d8ccb4"}];var Yo={ambient:Wo,species:Ko,solutes:zo,vapourInAir:Qo,solids:Xo};const _t=Yo,Ct=_t.species[0],Fs=_t.species[1],_s=_t.species[2],ht=new Float64Array(lt);ht[it]=Fs.molarMass.v;ht[rt]=_s.molarMass.v;ht[z]=Ct.molarMass.v;Fs.name,_s.name,Ct.vapour.name;const Li=Fs.gas.cp.v,Ci=_s.gas.cp.v,[Os,Bs,Se]=Ct.vapour.cp.linear;function Jo(o,t){return o===z?Os+Bs*(t-Se):o===it?Li:o===rt?Ci:0}const Ce=Ct.liquid.kell.c,Gs=Ct.liquid.cp.table,Ft=new Float64Array(Gs.map(o=>o[0])),kt=new Float64Array(Gs.map(o=>o[1])),Qt=new Float64Array(Gs.length);Qt[0]=kt[0]*(Ft[0]-ot);for(let o=1;o<Gs.length;o+=1)Qt[o]=Qt[o-1]+.5*(kt[o]+kt[o-1])*(Ft[o]-Ft[o-1]);const Rt=Gs.length-1;function Wr(o){if(o<Ft[0])return-1;if(o>=Ft[Rt])return Rt;let t=Math.min(Rt-1,Math.max(0,Math.floor((o-ot)/10)));for(;t>0&&o<Ft[t];)t-=1;for(;t<Rt-1&&o>=Ft[t+1];)t+=1;return t}function Me(o){const t=Wr(o);return t<0?kt[0]:t===Rt?kt[Rt]:kt[t]+(kt[t+1]-kt[t])*(o-Ft[t])/(Ft[t+1]-Ft[t])}function yt(o){const t=Wr(o);if(t<0)return Qt[0]+kt[0]*(o-Ft[0]);if(t===Rt)return Qt[Rt]+kt[Rt]*(o-Ft[Rt]);const e=o-Ft[t],s=(kt[t+1]-kt[t])/(Ft[t+1]-Ft[t]);return Qt[t]+kt[t]*e+.5*s*e*e}function Kr(o){if(o<Qt[0])return Ft[0]+(o-Qt[0])/kt[0];if(o>=Qt[Rt])return Ft[Rt]+(o-Qt[Rt])/kt[Rt];let t=Math.min(Rt-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<Qt[t];)t-=1;for(;t<Rt-1&&o>=Qt[t+1];)t+=1;const e=(kt[t+1]-kt[t])/(Ft[t+1]-Ft[t]),s=o-Qt[t],n=kt[t];return Ft[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function pn(o){const t=o-ot;return(Ce[0]+t*(Ce[1]+t*(Ce[2]+t*(Ce[3]+t*(Ce[4]+t*Ce[5])))))/(1+Ce[6]*t)}const jn=Ct.liquid.k.poly;function fi(o){const t=Math.min(150,Math.max(0,o-ot));return jn[0]+t*(jn[1]+t*jn[2])}const[Zo,tc,Yi]=Ct.liquid.mu.vogel;function ec(o){return Zo*Math.pow(10,tc/(Math.max(o,Yi+60)-Yi))}const Rn=Ct.surfaceTension,sc=Ct.saturation.Tc.v;function Oi(o){const t=Math.max(0,1-o/sc);return Rn.B*Math.pow(t,Rn.mu)*(1+Rn.b*t)}const nc=Ct.saturation.hlv100.v,js=ot+100,zr=yt(js)+nc,ic=Ct.vapour.k.v,rc=Ct.vapour.mu.v;function mt(o){const t=o-Se,e=js-Se;return zr+Os*(o-js)+.5*Bs*(t*t-e*e)}function oc(o){return mt(o)-yt(o)}function Yt(o,t){return o===z?mt(t):Jo(o,t)*(t-ot)}const qn=Fs.gas.k.power,En=_s.gas.k.power,cc=Fs.gas.mu.sutherland,ac=_s.gas.mu.sutherland,Dn=_t.vapourInAir,Qr=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),Xr=150,gn=1001,Us=o=>{const t=new Float64Array(gn);for(let e=0;e<gn;e+=1)t[e]=o(Xr+e);return t},Ue=(o,t)=>{let e=t-Xr;e>0?e>gn-1.001&&(e=gn-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},Ji=Us(o=>qn[0]*Math.pow(o/qn[1],qn[2])),lc=Us(o=>En[0]*Math.pow(o/En[1],En[2])),Zi=Us(o=>Qr(cc,o)),fc=Us(o=>Qr(ac,o)),uc=Us(o=>Dn.D0.v*Math.pow(o/Dn.T0.v,Dn.exponent.v));function hc(o,t,e,s){const n=o+t+e;return n>0?(o*Ue(Ji,s)+t*Ue(lc,s)+e*ic)/n:Ue(Ji,s)}function dc(o,t,e,s){const n=o+t+e;return n>0?(o*Ue(Zi,s)+t*Ue(fc,s)+e*rc)/n:Ue(Zi,s)}function mc(o,t){return Ue(uc,o)*(Cs/t)}function Yr(o,t,e,s){const n=o*Li+t*Ci,i=js-Se,r=.5*e*Bs,a=n+e*Os;if(a<=0)return ot;const c=n*(Se-ot)+e*(zr+Os*(Se-js)-.5*Bs*i*i)-s,l=a*a-4*r*c;return Se+-2*c/(a+Math.sqrt(l>0?l:0))}function ui(o,t,e,s,n){return o*Li+t*Ci+e*(Os+Bs*(n-Se))+(s>0?s*Me(n):0)}const pc=_t.ambient.air.N2.v,gc=_t.ambient.air.O2.v,Jr=_t.ambient.hExt.v,qt=_t.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,color:o.color}));function nn(o){return qt.findIndex(t=>t.id===o)}const ft=0,Zr=_t.species.slice(3),tr=[null,...Zr.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*ot+.5*s*ot*ot}})],Jt=[{id:Ct.id,name:Ct.name,short:Ct.liquid.name,color:Ct.liquid.color,volatile:!0,range:[ot,ot+150]},...Zr.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function to(o){return Jt.findIndex(t=>t.id===o)}const Qe=o=>tr[o]??tr[1];function Bi(o,t){if(o===ft)return Me(t);const e=Qe(o);return e.cA+e.cB*t}function vc(o,t){if(o===ft)return yt(t);const e=Qe(o);return e.cA*t+.5*e.cB*t*t-e.h0}function xc(o,t){if(o===ft)return Kr(t);const e=Qe(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function We(o,t){if(o===ft)return pn(t);const e=Qe(o);return e.rA+e.rB*t}function rn(o,t){if(o===ft)return fi(t);const e=Qe(o);return e.kA+e.kB*t}function Rs(o,t){if(o===ft)return ec(t);const e=Qe(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function hs(o,t){return o===ft?Oi(t):Qe(o).sigma}Ct.thermo,Fs.thermo,_s.thermo;const Hs=_t.species[0].saturation,fe=Hs.if97.n,eo=fe[0],so=fe[1],no=fe[2],io=fe[3],ro=fe[4],oo=fe[5],co=fe[6],ao=fe[7],lo=fe[8],hi=fe[9],ks=Hs.Tc.v,bc=Hs.rhoc.v,vn=273.15,Xe=Hs.vapourDensity.c;Hs.liquidDensity.b;function Mn(o){const t=o<vn?vn:o>ks?ks:o,e=t+lo/(t-hi),s=e*e+eo*e+so,n=no*e*e+io*e+ro,i=oo*e*e+co*e+ao,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function wt(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+no*e+oo,n=eo*e*e+io*e+co,i=so*e*e+ro*e+ao,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=hi+r;return(a-Math.sqrt(a*a-4*(lo+hi*r)))/2}function fo(o){const e=1-(o<vn?vn:o>ks?ks:o)/ks,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,c=a*a*s,l=c*a*r*r;return bc*Math.exp(Xe[0]*n+Xe[1]*i+Xe[2]*r+Xe[3]*a+Xe[4]*c+Xe[5]*l)}const xn=250,bn=.01,$s=25001,on=new Float64Array($s),cn=new Float64Array($s);for(let o=0;o<$s;o+=1)on[o]=Mn(xn+o*bn),cn[o]=fo(xn+o*bn);function qs(o){const t=(o-xn)/bn;if(!(t>=0)||t>=$s-1)return Mn(o);const e=t|0;return on[e]+(t-e)*(on[e+1]-on[e])}function ke(o){const t=(o-xn)/bn;if(!(t>=0)||t>=$s-1)return fo(o);const e=t|0;return cn[e]+(t-e)*(cn[e+1]-cn[e])}const uo=200;function In(o,t,e,s){const n=wt(o);return t/ke(n)-e*Lt*n/(s-o)}function yc(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function wc(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function Fc(o,t,e,s,n,i,r,a=ft){const c=o[t+z],l=o[t+it]/ht[it]+o[t+rt]/ht[rt],u=c/ht[z];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(u+l)*Lt*s/e)/(4*Math.PI)),h=e,g=0,d=s,m=0;for(let p=0;p<8;p+=1){if(h=e+2*hs(a,d)/f,l<=0)g=h,d=wt(g),m=c/ke(d);else if(u<=1e-9*l)g=0,d=s,m=l*Lt*d/h;else{let w=611.213,b=h*(1-1e-12),F=In(w,c,l,h),y=In(b,c,l,h);if(F<=0)g=w;else if(y>=0)g=b;else{let A=0;g=.5*(w+b);for(let P=0;P<40;P+=1){g=(w*y-b*F)/(y-F);const _=In(g,c,l,h);if(Math.abs(_)<=1e-12*(c/ke(s)+1e-30))break;_>0?(w=g,F=_,A===1&&(y/=2),A=1):(b=g,y=_,A===-1&&(F/=2),A=-1)}}d=wt(g),m=c/ke(d)}const x=yc(m,n);if(Math.abs(x-f)<=1e-7*f){f=x;break}f=x}r.r=f,r.V=m,r.pb=e+2*hs(a,d)/f,r.pv=g,r.Tb=d,wc(m,f,n,r)}function er(o,t,e,s){let n=0;for(let i=0;i<lt;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function sr(o,t,e,s,n,i,r,a,c,l){let u=0;if(2*e<=3*i){const x=o/i-.5,w=t/i-.5,b=Math.floor(x-.5),F=Math.floor(w-.5),y=x-b,A=w-F,P=.5*(1.5-y)**2,_=.75-(y-1)**2,T=.5*(y-.5)**2,L=.5*(1.5-A)**2,C=.75-(A-1)**2,B=.5*(A-.5)**2;let Q=0;for(let O=0;O<3;O+=1){const W=F+O;if(W<0||W>=a)continue;const j=O===0?L:O===1?C:B;for(let R=0;R<3;R+=1){const E=b+R;if(E<0||E>=r)continue;const q=j*(R===0?P:R===1?_:T);c[u]=E+W*r,l[u]=q,Q+=q,u+=1}}for(let O=0;O<u;O+=1)l[O]/=Q;return u}const f=s<=Math.PI*n*n*n/6,h=Math.max(0,Math.floor((o-e)/i)),g=Math.min(r-1,Math.floor((o+e)/i)),d=Math.max(0,Math.floor((t-e)/i)),m=Math.min(a-1,Math.floor((t+e)/i));let p=0;for(let x=d;x<=m;x+=1)for(let w=h;w<=g;w+=1){let b=0;for(let F=0;F<4;F+=1){const y=(x+(F+.5)/4)*i-t;for(let A=0;A<4;A+=1){const P=(w+(A+.5)/4)*i-o,_=e*e-P*P-y*y;_>0&&(b+=f?Math.sqrt(_):1)}}b<=0||u>=c.length||(c[u]=w+x*r,l[u]=b,p+=b,u+=1)}if(p<=0)return c[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let x=0;x<u;x+=1)l[x]/=p;return u}function _c(o,t,e,s,n,i){const{nx:r,ny:a}=o,c=e%r,l=(e-c)/r;let u=0,f=0;for(let h=0;h<=6&&(u===0||f<2*s);h+=1)for(let g=0;g<=h;g+=1)for(let d=-h;d<=h;d+=1){if(Math.max(Math.abs(d),g)!==h)continue;const m=c+d,p=l+g;if(m<0||p<0||m>=r||p>=a)continue;const x=m+p*r;if(o.kind[x]!==U||u>=n.length)continue;const w=Math.max(.001*o.vCell,t[x]);n[u]=x,i[u]=w,f+=w,u+=1}for(let h=0;h<u;h+=1)i[h]/=f;return u}function Pc(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===U)return e+s*o.nx;return-1}const Ye=.5;class Ac{constructor(t){v(this,"e");v(this,"ux0");v(this,"uy0");v(this,"vel",new Float64Array(2));v(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,c=r.x[t],l=r.y[t],u=r.r[t],f=r.V[t],h=Math.max(u+i.dx,2*i.dx),g=this.vel;let d=0,m=0;for(let at=0;at<8;at+=1){const dt=at*Math.PI/4;a.velocityAt(c+h*Math.cos(dt),l+h*Math.sin(dt),g),d+=g[0]/8,m+=g[1]/8}const p=i.cellAt(c,l),x=p>=0&&n.phase.Cl[p]>0?n.phase.Tl[p]:r.Tb[t],w=p>=0?n.phase.host[p]:0,b=n.phase.mixed?We(w,x):a.rhoRef,F=Rs(w,x),y=r.totalMass(t)/Math.max(1e-30,f),A=(d-this.ux0[t])/Math.max(e,1e-6),P=(m-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=d,this.uy0[t]=m,u<2e-5){r.vx[t]=d,r.vy[t]=m,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,c+e*d)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*m));return}const _=r.vx[t]-d,T=r.vy[t]-m,L=Math.hypot(_,T),C=2*u,B=Math.max(1e-6,b*L*C/F),Q=Math.max(0,n.gy)*(b-y)*C*C/hs(w,x),W=.5*Math.max(24/B*(1+.15*Math.pow(B,.687)),8/3*(Q/(Q+4)))*b*this.front(t)*L,j=(y+Ye*b)*f,R=b*f*A,E=b*f*(P+n.gy),q=-y*f*n.gy,K=Ye*b*f*A,D=Ye*b*f*P,M=s>0?Ye*b*s:0,N=s<0?Math.min(-s,.2*f/e):0,tt=Ye*b*N*_,Y=Ye*b*N*T,X=(j*r.vx[t]+e*(R+K+tt)+e*(W+M)*d)/(j+e*(W+M)),S=(j*r.vy[t]+e*(E+q+D+Y)+e*(W+M)*m)/(j+e*(W+M));r.vx[t]=Number.isFinite(X)?X:d,r.vy[t]=Number.isFinite(S)?S:m;const $=-W*(X-d),V=-W*(S-m),st=t*Xt;r.force[st]=R,r.force[st+1]=E,r.force[st+2]=0,r.force[st+3]=q,r.force[st+4]=$,r.force[st+5]=V,r.force[st+6]=K+tt-M*(X-d),r.force[st+7]=D+Y-M*(S-m),this.spreadForce(c,l,-($+r.force[st+6])*(e/n.dt),-(V+r.force[st+7])*(e/n.dt));let k=c+e*X,I=l+e*S;const G=i.sdfAt(k,I);if(G<u){const at=.25*i.dx;let dt=i.sdfAt(k+at,I)-i.sdfAt(k-at,I),Pt=i.sdfAt(k,I+at)-i.sdfAt(k,I-at);const At=Math.hypot(dt,Pt);if(At>1e-12){dt/=At,Pt/=At,k+=(u-G)*dt,I+=(u-G)*Pt;const Fe=r.vx[t]*dt+r.vy[t]*Pt;Fe<0&&(r.vx[t]-=Fe*dt,r.vy[t]-=Fe*Pt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,k)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,I));const J=i.depth;r.z[t]=2*u>=J?J/2:Math.min(J-u,Math.max(u,r.z[t]))}spreadForce(t,e,s,n){const i=this.e.liquid,r=this.e.grid,{nx:a,ny:c,dx:l}=r,u=this.w3;let f=Math.floor(t/l-.5),h=t/l-f;u[0]=.5*(1.5-h)**2,u[1]=.75-(h-1)**2,u[2]=.5*(h-.5)**2;let g=Math.floor(e/l-1);h=e/l-.5-g,u[3]=.5*(1.5-h)**2,u[4]=.75-(h-1)**2,u[5]=.5*(h-.5)**2;for(let d=0;d<3;d+=1)for(let m=0;m<3;m+=1){const p=f+m,x=g+d;p<0||p>a||x<0||x>=c||(i.fU[p+x*(a+1)]+=s*u[m]*u[3+d])}f=Math.floor(t/l-1),h=t/l-.5-f,u[0]=.5*(1.5-h)**2,u[1]=.75-(h-1)**2,u[2]=.5*(h-.5)**2,g=Math.floor(e/l-.5),h=e/l-g,u[3]=.5*(1.5-h)**2,u[4]=.75-(h-1)**2,u[5]=.5*(h-.5)**2;for(let d=0;d<3;d+=1)for(let m=0;m<3;m+=1){const p=f+m,x=g+d;p<0||p>=a||x<0||x>c||(i.fV[p+x*a]+=n*u[m]*u[3+d])}}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const c=(n-r)/(a-r);return(1-c)*(Math.PI*s*s)/4+c*s*s}}class ho{constructor(t){v(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function Tc(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const Sc=8,kc=210,nr=1.805,Mc=3e-7;function ir(o,t){const e=wt(t);return wt(t+2*Oi(e)/o)-e}class Lc{constructor(){v(this,"count",0);v(this,"cell",new Int32Array(0));v(this,"fluid",new Int32Array(0));v(this,"dir",new Uint8Array(0));v(this,"r",new Float32Array(0));v(this,"s",new Float32Array(0));v(this,"z",new Float32Array(0));v(this,"bubble",new Uint32Array(0));v(this,"pos",new Float64Array(2))}rebuild(t,e){const{nx:s,ny:n}=t,i=wt(Cs),r=2*Oi(i)/(qs(i+1)-Cs),a=kc*r,c=t.dx*t.depth,l=[],u=[],f=[],h=[],g=[],d=[],m=new ho(1);for(let p=0;p<t.n;p+=1){if(t.solid[p]===0)continue;const x=qt[t.solid[p]-1],w=p%s,b=(p-w)/s;for(let F=0;F<4;F+=1){const y=F===0?w-1:F===1?w+1:w,A=F===2?b-1:F===3?b+1:b;if(y<0||A<0||y>=s||A>=n)continue;const P=y+A*s;if(t.solid[P]!==0)continue;m.state=Tc(e,p,F)||1;const _=Math.pow(a/x.cavRmax,nr);let T=0;for(let L=0;L<Sc;L+=1){T+=m.exp();const C=a*Math.pow(T/(c*x.cavScale)+_,-1/nr);if(C<Mc)break;l.push(p),u.push(P),f.push(F),h.push(C),g.push(m.next()),d.push(m.next())}}}this.count=l.length,this.cell=Int32Array.from(l),this.fluid=Int32Array.from(u),this.dir=Uint8Array.from(f),this.r=Float32Array.from(h),this.s=Float32Array.from(g),this.z=Float32Array.from(d),this.bubble=new Uint32Array(l.length)}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)qt[t.solid[this.cell[n]]-1].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){const n=this.cell[e],i=n%t.nx,r=(n-i)/t.nx,a=this.s[e],c=this.dir[e],l=t.dx;return c===0?(this.pos[0]=i*l-s,this.pos[1]=(r+a)*l):c===1?(this.pos[0]=(i+1)*l+s,this.pos[1]=(r+a)*l):c===2?(this.pos[0]=(i+a)*l,this.pos[1]=r*l-s):(this.pos[0]=(i+a)*l,this.pos[1]=(r+1)*l+s),this.pos}}const Cc=.0208,Oc=1;class Bc{constructor(t){v(this,"e");v(this,"burstVapour",0);v(this,"nucleated",0);v(this,"departed",0);v(this,"merged",0);v(this,"burst",0);v(this,"collapsed",0);v(this,"burstCold",0);v(this,"collapsedCold",0);v(this,"burstWarm",0);v(this,"collapsedWarm",0);v(this,"firstSuperheat",null);v(this,"firstMaterial",null);v(this,"departures",new Float64Array(256));v(this,"departureCount",0);v(this,"contactAngleOverride",null);v(this,"watch",-1);v(this,"watchFate",0);v(this,"sites",new Lc);v(this,"motion");v(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});v(this,"cells",new Int32Array(1024));v(this,"wts",new Float64Array(1024));v(this,"alphaTarget");v(this,"budget");v(this,"tsatCell");v(this,"dTb");v(this,"Fm");v(this,"vel",new Float64Array(2));v(this,"head");v(this,"next");v(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new Ac(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return ir(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),u=Math.floor(c),f=Math.floor(l),h=c-u,g=l-f;let d=0,m=0;for(let p=0;p<2;p+=1)for(let x=0;x<2;x+=1){const w=u+x+(f+p)*i;if(n.solid[w]!==0)continue;const b=(x===0?1-h:h)*(p===0?1-g:g);d+=b*n.pl[w],m+=b}return s.pRef+(m>0?d/m:0)}liquidFootprint(t){const s=this.e.grid,n=this.B,i=sr(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let c=0;c<i;c+=1){const l=this.cells[c];s.kind[l]===ut&&(this.cells[a]=l,this.wts[a]=this.wts[c],r+=this.wts[c],a+=1)}for(let c=0;c<a;c+=1)this.wts[c]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;Fc(s.m,t*lt,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==ut){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const u=e.pRef+s.pl[l],f=i.boilingAt(l,u);this.tsatCell[l]=f,i.salty&&(this.dTb[l]=f-wt(u)),this.budget[l]=i.Cl[l]*(i.Tl[l]-f)}this.Fm.fill(0);const c=e.waterTemperature();if(this.bulkCold=c.mass>0&&c.mean<=wt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);this.coalesce();for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r];if(s.kind[a]!==ut||i.acc[a]<=0||i.waterShare(a)<.5)continue;const c=this.sites.cell[r],l=qt[s.solid[c]-1],u=i.Tl[a],f=rn(i.host[a],u),h=(l.k*s.T[c]+f*u)/(l.k+f),g=e.pRef+s.pl[a],d=this.tsatCell[a]>0?this.tsatCell[a]:wt(g);if(h-d<0)continue;const m=this.sites.r[r];if(h-d<ir(m,g))continue;const p=g+2*hs(i.host[a],h)/m,x=wt(p),w=4/3*Math.PI*m*m*m,b=ke(x)*w;if(b*4>i.acc[a])continue;const F=this.sites.position(this.e.grid,r,m),y=n.add(F[0],F[1],Math.min(s.depth-m,Math.max(m,this.sites.z[r]*s.depth)));if(y<0)return;n.m[y*lt+z]=b,n.r[y]=m,n.V[y]=w,n.Tb[y]=x,n.pb[y]=p,n.pv[y]=p,n.H[y]=b*mt(x),n.site[y]=r,n.age[y]=0,this.sites.bubble[r]=n.id[y],this.motion.ux0[y]=0,this.motion.uy0[y]=0;const A=i.waterH(a);this.Fm[a]-=b,e.heat.src[c]-=b*(mt(x)-A)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=h-d,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*lt;let c=i.site[t],l=0;const u=i.V[t];let f=0,h=u;for(;l<e-1e-12;){h=i.V[t];const g=i.r[t],d=Math.hypot(i.vx[t],i.vy[t]);let m=Math.min(e-l,Math.max(1e-7,Oc*i.age[t]),.25*n.dx/(d+1e-9));m<1e-7&&(m=Math.min(e-l,1e-7));let p,x=-1,w=0;if(c>=0){const k=this.sites.fluid[c],I=this.sites.cell[c],G=qt[n.solid[I]-1],J=r.Tl[k],at=rn(r.host[k],J);p=(G.k*n.T[I]+at*J)/(G.k+at),x=I}else{if(w=this.liquidFootprint(t),w===0)break;p=0;for(let k=0;k<w;k+=1)p+=this.wts[k]*r.Tl[this.cells[k]]}let b=0;if(r.salty)if(c>=0)b=this.dTb[this.sites.fluid[c]];else for(let k=0;k<w;k+=1)b+=this.wts[k]*this.dTb[this.cells[k]];const F=i.Tb[t],y=c>=0?r.host[this.sites.fluid[c]]:r.hostAt(i.x[t],i.y[t]),A=rn(y,p),P=We(y,p),_=Bi(y,p),T=Rs(y,p),L=A/(P*_),C=2*g,B=i.age[t],Q=A*Math.sqrt(3/(Math.PI*L)),O=c>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),W=P*O*C/T,j=T*_/A,R=A/C*(2+.6*Math.sqrt(W)*Math.cbrt(j)),E=mt(F)-yt(p);let q=Math.max(Q*2*(Math.sqrt(B+m)-Math.sqrt(B)),R*m);if(c>=0&&p>F+b){const k=.5*this.fritz(t,p),I=i.m[a+z]>0?i.m[a+z]/i.V[t]:ke(F),G=q*(p-F-b)/(I*E);if(g<k&&g+G>k&&G>0){const J=q*(k-g)/G;if(R*m>=Q*2*(Math.sqrt(B+m)-Math.sqrt(B)))m=J/R;else{const at=Math.sqrt(B)+J/(2*Q);m=at*at-B}m=Math.max(1e-9,Math.min(e-l,m*(1+1e-6))),q=Math.max(Q*2*(Math.sqrt(B+m)-Math.sqrt(B)),R*m)}}const K=n.depth,D=i.V[t],M=i.m[a+z]>0?i.m[a+z]/D:ke(F),N=q*(p-F-b)/(M*E),tt=Math.max(0,g+N);let Y;D<=Math.PI*K*K*K/6?Y=4/3*Math.PI*(tt*tt*tt-g*g*g):D>=Math.PI*K*K*K/4?Y=Math.PI*K*(tt*tt-g*g):Y=Math.PI*K*K*q*(p-F-b)/(M*E);let X=M*Y*E;if(c>=0){const k=x,I=qt[n.solid[k]-1],G=I.rho*I.cp*n.vCell*Math.max(0,n.T[k]-F);X>0&&(X=Math.min(X,Math.max(0,G-this.used(k))))}else{let k=0;for(let I=0;I<w;I+=1)k+=this.wts[I]*this.budget[this.cells[I]];X>0?X=Math.min(X,Math.max(0,k)):X=Math.max(X,Math.min(0,k))}let S=X/E;S<0&&(S=Math.max(S,-i.m[a+z]));let $=1,V=!1;if(c<0&&S!==0&&!r.mixed)for(let k=0;k<w&&!V;k+=1)V=r.acc[this.cells[k]]<=0;const st=k=>r.acc[k]>0?r.waterShare(k):0;if(c<0&&S!==0&&(r.mixed||V)){$=0;for(let k=0;k<w;k+=1)$+=this.wts[k]*st(this.cells[k]);S*=$}if(S!==0){if(c>=0){const k=this.sites.fluid[c];S>0&&r.acc[k]+this.Fm[k]-S<0&&(S=Math.max(0,r.acc[k]+this.Fm[k]));const I=r.waterH(k);this.Fm[k]-=S,s.heat.src[x]-=S*(mt(F)-I)/e,this.budgetSolid(x,S*(mt(F)-I))}else for(let k=0;k<w;k+=1){const I=this.cells[k],G=r.mixed||V?this.wts[k]*st(I)/$:this.wts[k];if(G===0)continue;const J=r.waterH(I);this.Fm[I]-=S*G,s.heat.src[I]-=S*G*(mt(F)-J)/e,this.budget[I]-=S*G*(mt(F)-J)}i.m[a+z]+=S,i.H[t]+=S*mt(F),f+=S}if(this.solve(t,p),this.restoreEnthalpy(t,c,w,e),i.r[t]<1e-6||i.m[a+z]<=1e-18&&i.m[a+it]+i.m[a+rt]<=0){i.age[t]+=m;break}if(c>=0){const k=this.sites.position(this.e.grid,c,i.r[t]);i.x[t]=k[0],i.y[t]=k[1],this.departure(t,p),c=i.site[t]}else this.motion.move(t,m,(i.V[t]-h)/m);if(i.age[t]+=m,l+=m,i.m[a+z]<=0&&i.m[a+it]+i.m[a+rt]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=er(r.m,t*lt,r.Tb[t],Yt),c=a-r.H[t];if(c!==0){if(r.H[t]=a,e>=0){i.heat.src[this.sites.cell[e]]-=c/n;return}if(s!==0)for(let l=0;l<s;l+=1)i.heat.src[this.cells[l]]-=c*this.wts[l]/n}}fritz(t,e){const s=this.e,n=s.grid,i=this.B,r=i.site[t];if(r<0||s.gy<=0)return 1/0;const a=qt[n.solid[this.sites.cell[r]]-1],c=this.contactAngleOverride??a.contactAngle,l=i.totalMass(t)/Math.max(1e-30,i.V[t]),u=s.phase.host[this.sites.fluid[r]];return Cc*c*Math.sqrt(hs(u,i.Tb[t])/(s.gy*(We(u,e)-l)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const c=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],c),this.motion.ux0[t]=c[0],this.motion.uy0[t]=c[1],n.vx[t]=c[0],n.vy[t]=c[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const u=e.cellAt(s.x[l],s.y[l]);if(u<0){this.next[l]=-1;continue}this.next[l]=this.head[u],this.head[u]=l,s.r[l]>a&&(a=s.r[l])}const c=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const u=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let h=Math.max(0,f-c);h<=Math.min(i-1,f+c);h+=1)for(let g=Math.max(0,u-c);g<=Math.min(n-1,u+c);g+=1)for(let d=this.head[g+h*n];d>=0;d=this.next[d]){if(d<=l||s.V[d]<=0)continue;const m=s.x[d]-s.x[l],p=s.y[d]-s.y[l],x=e.depth,b=2*s.r[l]>=x||2*s.r[d]>=x?0:s.z[d]-s.z[l],F=s.r[l]+s.r[d];m*m+p*p+b*b>=F*F||this.merge(l,d)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<lt;a+=1)s.m[t*lt+a]+=s.m[e*lt+a],s.m[e*lt+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*lt,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+z]<=1e-18&&i.m[r+it]+i.m[r+rt]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const c=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(c<0||n.kind[c]===U||l<0||n.kind[l]===U)&&this.drop(t,!0,e)}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*lt,c=i.n,l=r.m[a+z],u=r.m[a+it]+r.m[a+rt];if(e||u>0){let g=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;g>=0&&i.kind[g]!==U;)g=g+i.nx<c?g+i.nx:-1;if(g<0&&(g=Pc(i,r.x[t])),g>=0){const d=_c(i,n.gas.vgas,g,r.V[t],this.cells,this.wts);for(let m=0;m<d;m+=1){const p=this.cells[m],x=this.wts[m];for(let w=0;w<lt;w+=1)i.mg[w*c+p]+=x*r.m[a+w];i.Hg[p]+=x*r.H[t],n.gas.deriveCell(p)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const g=this.liquidFootprint(t);if(g>0){const d=n.phase;let m=1;if(d.mixed){m=0;for(let p=0;p<g;p+=1)m+=this.wts[p]*d.waterShare(this.cells[p])}for(let p=0;p<g;p+=1){const x=this.cells[p],w=d.mixed&&m>0?this.wts[p]*d.waterShare(x)/m:this.wts[p];if(w===0)continue;const b=d.waterH(x);this.Fm[x]+=l*w,n.heat.src[x]+=w*(r.H[t]-l*b)/s}}else{const d=i.cellAt(r.x[t],r.y[t]);d>=0&&(i.mg[z*c+d]+=l,i.Hg[d]+=r.H[t],n.gas.deriveCell(d))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const h=r.count-1;if(t!==h){this.motion.ux0[t]=this.motion.ux0[h],this.motion.uy0[t]=this.motion.uy0[h];const g=r.site[h];g>=0&&(this.sites.bubble[g]=r.id[h])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let u=0;u<n.count;u+=1){const f=sr(n.x[u],n.y[u],n.r[u],n.V[u],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let h=0;h<f;h+=1)i[this.cells[h]]+=this.wts[h]*n.V[u]*r}const a=s.alpha,c=e.liquid.volSrc,l=uo*t;for(let u=0;u<s.n;u+=1){const f=i[u]-a[u];f!==0&&(f>l?(c[u]+=l*s.vCell/t,a[u]+=l):f<-l?(c[u]-=l*s.vCell/t,a[u]-=l):(c[u]+=f*s.vCell/t,a[u]=i[u]))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,c=a.add(t,e,s);if(c<0)return-1;const l=this.pressure(t,e),u=r.grid.cellAt(t,e),f=u>=0&&r.phase.Tl[u]>0?r.phase.Tl[u]:r.ambientT,h=l+2*hs(u>=0?r.phase.host[u]:0,f)/n,g=4/3*Math.PI*n*n*n,d=c*lt;if(i<=0){const m=wt(h);a.m[d+z]=ke(m)*g}else{const m=h*g/(8.314462618*f);a.m[d+it]=m*.79*ht[it],a.m[d+rt]=m*.21*ht[rt]}return a.r[c]=n,this.solve(c,f),a.H[c]=er(a.m,d,a.Tb[c],Yt),r.ledger.water+=a.m[d+z],r.ledger.air+=a.m[d+it]+a.m[d+rt],r.ledger.energy+=a.H[c],this.motion.ux0[c]=0,this.motion.uy0[c]=0,c}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*lt,n=t*Xt;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:wt(e.pb[t]),mv:e.m[s+z],ma:e.m[s+it]+e.m[s+rt],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+Xt))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return pt}}function rr(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0}}const jc={mass:0,energy:0};function Rc(o,t,e,s,n,i,r=jc){const a=o.n;let c=0,l=0,u=0,f=0,h=0,g=0,d=0;for(let T=0;T<a;T+=1){if(o.kind[T]===pt||o.solid[T]!==0){c+=o.Es[T],h+=o.film[T],g+=o.crust[T];continue}l+=o.Hg[T],u+=o.mg[z*a+T],f+=o.mfog[T],d+=o.mg[it*a+T]+o.mg[rt*a+T]}let m=0,p=0,x=0,w=0;for(let T=0;T<t.count;T+=1){m+=t.mass[T]*t.h[T];const L=t.smass[2*T];w+=L,t.mat[T]===ft?p+=t.mass[T]-L:x+=t.mass[T]-L}c+=r.energy;let b=0,F=0;for(let T=0;T<e.count;T+=1)b+=e.H[T],F+=e.m[T*lt+z],d+=e.m[T*lt+it]+e.m[T*lt+rt];const y=s.pvTerm();i.solids=c,i.liquid=m,i.gas=l,i.bubbles=b,i.pv=y,i.energy=c+m+l+b+y;const A=i.water;A.liquid=p,A.vapour=u,A.fog=f,A.film=h,A.bubbles=F,A.escaped=n.escapedWater,A.total=p+u+f+h+F+n.escapedWater;const P=i.other;P.liquid=x,P.escaped=n.escapedOther,P.total=x+n.escapedOther;const _=i.salt;return _.liquid=w,_.crust=g,_.floor=r.mass,_.escaped=n.escapedSalt,_.total=w+g+r.mass+n.escapedSalt,i.air=d+n.escapedAir,i}function qc(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0}}}const Vt=_t.solutes[0],mo=_t.species[0],ji=mo.molarMass.v,Es=Vt.molarMass.v,Ec=Vt.ions.v,Dc=1,po=_t.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function go(o){return po.findIndex(t=>t.id===o)}function vo(o){return o>0?o*Es/(1+o*Es):0}const ve=298.15,Ws=Vt.pitzer,Ic=Ws.b0.a,Vc=Ws.b1.a,Nc=Ws.c.a,Gc=Ws.b.v,Uc=Ws.alpha.v,an=Vt.pitzerCold,Hc=an.below.v;function Vn(o,t){return o[0]+o[1]*(1/t-1/ve)+o[2]*Math.log(t/ve)+o[3]*(t-ve)+o[4]*(t*t-ve*ve)+o[5]*(1/(t*t)-1/(ve*ve))}const zs=Vt.dielectric.c;function $c(o){const t=o-ot;return zs[0]+t*(zs[1]+t*(zs[2]+t*zs[3]))}function Wc(o){const t=Xi*Xi/(4*Math.PI*Ho*$c(o)*Go*o);return Math.sqrt(2*Math.PI*Uo*pn(o))*t*Math.sqrt(t)/3}function Kc(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<Hc,n=Vn(s?an.b0.a:Ic,o),i=Vn(s?an.b1.a:Vc,o),r=Vn(s?an.c.a:Nc,o);return 1-Wc(o)*e/(1+Gc*e)+t*(n+i*Math.exp(-Uc*e))+t*t*r}function yn(o,t){return t>0?Math.exp(-Ec*t*Kc(o,t)*ji):1}const xo=240,wn=221,bo=.05,Te=181;let Nn=null;function zc(){if(Nn!==null)return Nn;const o=new Float64Array(wn*Te);for(let t=0;t<wn;t+=1)for(let e=0;e<Te;e+=1)o[t*Te+e]=yn(xo+t,e*bo);return Nn=o,o}function yo(o,t){if(!(t>0))return 1;const e=t/bo;if(e>=Te-1)return yn(o,t);const s=zc();let n=o-xo;n>0?n>wn-1.000001&&(n=wn-1.000001):n=0;const i=n|0,r=e|0,a=n-i,c=e-r,l=i*Te+r,u=s[l]+c*(s[l+1]-s[l]),f=s[l+Te]+c*(s[l+Te+1]-s[l+Te]);return u+a*(f-u)}function wo(o,t){let e=wt(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=wt(o/yo(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Ln=mo.fusion,ae=Ln.T.v,Fo=Ln.h.v,Qc=Ln.cpIce.v;Ln.rhoIce.v;function Xc(o){const t=Me(ae)-Qc;return ji/Lt*((Fo-t*ae)*(1/ae-1/o)+t*Math.log(o/ae))}const Yc=Vt.eutectic.T.v,Jc=Vt.eutectic.w.v;function Zc(o){if(!(o>0))return ae;if(vo(o)>=Jc)return Yc;const t=s=>Math.log(yn(s,o))-Xc(s);let e=ae+Math.log(yn(ae,o))*Lt*ae*ae/(ji*Fo);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return ae;if(Math.abs(r)<1e-9)break}return e}const _e=Vt.solubility.table;function ta(o){if(o<=_e[0][0])return _e[0][1];for(let t=1;t<_e.length;t+=1)if(o<=_e[t][0]){const[e,s]=_e[t-1],[n,i]=_e[t];return s+(i-s)*(o-e)/(n-e)}return _e[_e.length-1][1]}function ea(o){return vo(ta(o))}Vt.solid.rho.v;const _o=Vt.solid.cp.v;function Cn(o){return _o*(o-ot)}const As=Vt.density.laliberte;function sa(o,t){const e=o-ot,s=e+As[4];return(As[0]*t+As[1])*Math.exp(1e-6*s*s)/(t+As[2]+As[3]*e)}function Ri(o,t){return t>0?1/((1-t)/pn(o)+t/sa(o,t)):pn(o)}const Ps=Vt.cp.laliberte,qi=Ps[0],na=Ps[1],ia=Ps[2],di=Ps[3],Po=Ps[4],mi=Ps[5],Ke=Vt.cp.range.lo,Fn=Vt.cp.range.hi,He=.5,ye=Math.round((Fn-Ke)/He)+1,Ht=new Float64Array(ye),Ds=new Float64Array(ye);for(let o=0;o<ye;o+=1){const t=Ke+o*He-ot;Ht[o]=Math.exp(na*t+ia*Math.exp(.01*t))}Ds[0]=Ht[0]*(Ke-ot);for(let o=1;o<ye;o+=1)Ds[o]=Ds[o-1]+.5*(Ht[o-1]+Ht[o])*He;function Ao(o){if(o<=Ke)return Ht[0];if(o>=Fn)return Ht[ye-1];const t=(o-Ke)/He,e=Math.min(ye-2,t|0);return Ht[e]+(t-e)*(Ht[e+1]-Ht[e])}function On(o){if(o<=Ke)return Ht[0]*(o-ot);if(o>=Fn)return Ds[ye-1]+Ht[ye-1]*(o-Fn);const t=(o-Ke)/He,e=Math.min(ye-2,t|0),s=(t-e)*He;return Ds[e]+Ht[e]*s+.5*(Ht[e+1]-Ht[e])*s*s/He}const Ei=o=>1e3*qi*o*Math.exp(di*o),Di=o=>1e3*Po*Math.pow(o,mi+1),To=Vt.dHsol.v/Es+Cn(ve)-1e3*qi*On(ve);function So(o,t){return t>0?(1-t)*yt(o)+t*To+Ei(t)*On(o)+Di(t)*(o-ot):yt(o)}function ra(o,t){return t>0?(1-t)*Me(o)+Ei(t)*Ao(o)+Di(t):Me(o)}function oa(o,t,e){if(!(t>0))return Kr(o);const s=Ei(t),n=Di(t),i=t*To,r=1-t;let a=e>200&&e<900?e:ot+(o-i)/(4e3*r+800*t);for(let c=0;c<30;c+=1){const u=(r*yt(a)+i+s*On(a)+n*(a-ot)-o)/(r*Me(a)+s*Ao(a)+n);if(a-=u,Math.abs(u)<1e-8)break}return a}function ln(o,t){return t>0?yt(o)-1e3*qi*di*t*t*Math.exp(di*t)*On(o)-1e3*Po*mi*Math.pow(t,mi+1)*(o-ot):yt(o)}const or=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Qs(o){if(o===null||typeof o!="object")return null;const t=o,e=(a,c)=>{if(!Array.isArray(a)||a.length!==c)return null;const l=a.map(or);return l.every(u=>u!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(c=>e(c,2));if(a.every(c=>c!==null))return{poly:a.map(c=>[c[0],c[1]])}}const i=e(t.line,4),r=or(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function ze(o,t,e){if("rect"in o){const[g,d,m,p]=o.rect;return t>=g&&t<=m&&e>=d&&e<=p}if("circle"in o){const[g,d,m]=o.circle;return(t-g)*(t-g)+(e-d)*(e-d)<=m*m}if("poly"in o){const g=o.poly;let d=!1;for(let m=0,p=g.length-1;m<g.length;p=m,m+=1){const[x,w]=g[m],[b,F]=g[p];w>e!=F>e&&t<(b-x)*(e-w)/(F-w)+x&&(d=!d)}return d}const[s,n,i,r]=o.line,a=i-s,c=r-n,l=a*a+c*c,u=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*c)/l)):0,f=t-(s+u*a),h=e-(n+u*c);return f*f+h*h<=.25*o.width*o.width}function ko(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,a,c]=o.circle;return[r-c,a-c,r+c,a+c]}if("poly"in o){let r=1/0,a=1/0,c=-1/0,l=-1/0;for(const[u,f]of o.poly)r=Math.min(r,u),a=Math.min(a,f),c=Math.max(c,u),l=Math.max(l,f);return[r,a,c,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Xs(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}function fn(o,t,e){const[s,n,i,r]=ko(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=l;f<=u;f+=1)for(let h=a;h<=c;h+=1)ze(t,(h+.5)*o.dx,(f+.5)*o.dx)&&e(h+f*o.nx,h,f)}function Bn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[z*s+t]+e.mfog[t],o.ledger.air-=e.mg[it*s+t]+e.mg[rt*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<lt;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function Ii(o,t,e,s){const n=o.grid,i=n.n;Bn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[z*i+t],o.ledger.air+=n.mg[it*i+t]+n.mg[rt*i+t],o.ledger.energy+=n.Hg[t]}function _n(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===ft?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function Vi(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function Gn(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)ze(t,e.x[n],e.y[n])&&(_n(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)ze(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*lt+z],o.ledger.air-=s.m[n*lt+it]+s.m[n*lt+rt],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function Un(o,t,e,s,n){const i=o.grid,r=qt[e];for(const c of t)i.solid[c]!==0?(o.ledger.energy-=i.Es[c],o.ledger.water-=i.film[c],Vi(o,c)):Bn(o,c),i.solid[c]=e+1,i.role[c]=n>=0?1:0,i.heater[c]=n,i.film[c]=0,i.T[c]=s,i.Es[c]=r.rho*r.cp*i.vCell*(s-ot),i.kind[c]=pt,o.ledger.energy+=i.Es[c];const a=o.particles;for(let c=0;c<a.count;c+=1){const l=i.cellAt(a.x[c],a.y[c]);l<0||i.solid[l]===0||(_n(o,c),o.liquid.removeParticle(c),c-=1)}o.solidsChanged()}function ca(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],Vi(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&Ii(o,n,o.ambientT,o.ambientY)}}const Ts=(o,t,e,s,n)=>{const i=[],r=Math.max(0,Math.round(t/o.dx)),a=Math.min(o.nx,Math.max(r+1,Math.round(s/o.dx))),c=Math.max(0,Math.round(e/o.dx)),l=Math.min(o.ny,Math.max(c+1,Math.round(n/o.dx)));for(let u=c;u<l;u+=1)for(let f=r;f<a;f+=1)i.push(f+u*o.nx);return i};function aa(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){Gn(o,t.region);const p=new Float64Array(lt);let x=0;for(const[w,b]of Object.entries(t.composition)){const F=w==="N2"?it:w==="O2"?rt:w==="H2O"?z:-1;F>=0&&(p[F]=b,x+=b)}if(x<=0)p.set(o.ambientY.subarray(0,lt));else for(let w=0;w<gt;w+=1)p[w]/=x;return fn(e,t.region,w=>{e.solid[w]===0&&Ii(o,w,t.T,p)}),null}Gn(o,t.region);const s=Jt.length;let n=0;for(const[p,x]of Object.entries(t.composition))go(p)>=0&&x>0&&(n+=x);const i=t.composition[Jt[ft].id]??0,r=n>0&&i>0?n/(n+i):0,a=p=>p===ft&&r>0?Ri(t.T,r):We(p,t.T),c=new Float64Array(s);let l=0;for(const[p,x]of Object.entries(t.composition)){const w=to(p);if(w<0||!(x>0))continue;const b=w===ft&&r>0?x+n:x;c[w]+=b/a(w),l+=b/a(w)}if(l<=0)return"fill: no known liquid in the composition";for(let p=0;p<s;p+=1)c[p]/=l;const u=new Float64Array(s),f=new Float64Array(s);for(let p=0;p<s;p+=1)u[p]=a(p)*e.vCell/4,f[p]=p===ft&&r>0?So(t.T,r):vc(p,t.T);const h=r*u[ft],g=new Float64Array(s),d=o.particles;let m=!1;return fa(e,t.region,(p,x)=>{const w=p+x*e.nx;if(e.solid[w]!==0)return;let b=0;for(let F=0;F<2;F+=1)for(let y=0;y<2;y+=1){const A=(p+.25+.5*y)*e.dx,P=(x+.25+.5*F)*e.dx;if(!ze(t.region,A,P))continue;let _=0;for(let B=0;B<s;B+=1)g[B]+=c[B],g[B]>g[_]&&(_=B);g[_]-=1;const T=u[_],L=f[_],C=_===ft?h:0;if(d.add(A,P,T,L,_,C)<0){m=!0;continue}b+=1,_===ft?o.ledger.water+=T-C:o.ledger.other+=T,o.ledger.salt+=C,o.ledger.energy+=T*L}b===4&&Bn(o,w)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":m?"fill: particle capacity reached":null}case"erase":{Gn(o,t.region);const s=[];return fn(e,t.region,n=>s.push(n)),ca(o,s),null}case"move":return la(o,t.region,Math.round(t.dx/e.dx),Math.round(t.dy/e.dx)),null;case"solid":{const s=nn(t.material);if(s<0)return`solid: unknown material ${t.material}`;const n=[];if(fn(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,c]=t.region.line,l=Math.ceil(Math.hypot(a-i,c-r)/(.5*e.dx))+1;for(let u=0;u<=l;u+=1){const f=e.cellAt(i+(a-i)*u/l,r+(c-r)*u/l);f>=0&&!n.includes(f)&&n.push(f)}}return Un(o,n,s,t.T,-1),null}case"beaker":{const s=nn(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.max(e.dx,t.wall),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,c=t.y+t.h,l=[...Ts(e,i,a,i+n,c),...Ts(e,r-n,a,r,c),...Ts(e,i,a,r,a+n),...t.lid?Ts(e,i,c-n,r,c):[]];return Un(o,[...new Set(l)],s,t.T,-1),null}case"hotplate":{const s=nn(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;return o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0}),Un(o,Ts(e,t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h),s,t.T,n),null}}}function la(o,t,e,s){const n=o.grid,{nx:i,ny:r,dx:a}=n;if(e===0&&s===0)return;const c=[];fn(n,t,d=>{n.solid[d]!==0&&c.push(d)});const l=o.particles,u=o.bubbles,f=e*a,h=s*a;for(let d=0;d<l.count;d+=1){if(!ze(t,l.x[d],l.y[d]))continue;const m=l.x[d]+f,p=l.y[d]+h;if(m<=0||p<=0||m>=n.w||p>=n.h){_n(o,d),o.liquid.removeParticle(d),d-=1;continue}l.x[d]=m,l.y[d]=p}for(let d=0;d<u.count;d+=1)ze(t,u.x[d],u.y[d])&&(u.x[d]=Math.min(n.w-1e-6,Math.max(1e-6,u.x[d]+f)),u.y[d]=Math.min(n.h-1e-6,Math.max(1e-6,u.y[d]+h)),u.site[d]=-1);if(o.liquid.weightsDirty=!0,c.length===0)return;const g=c.map(d=>({c:d,s:n.solid[d],role:n.role[d],heater:n.heater[d],T:n.T[d],Es:n.Es[d],film:n.film[d],crust:n.crust[d]}));for(const d of g)o.ledger.energy-=d.Es,o.ledger.water-=d.film,o.ledger.salt-=d.crust,n.solid[d.c]=0,n.role[d.c]=0,n.heater[d.c]=-1,n.Es[d.c]=0,n.film[d.c]=0,n.crust[d.c]=0,n.kind[d.c]=0;for(const d of g){const m=d.c%i+e,p=Math.floor(d.c/i)+s;if(m<0||p<0||m>=i||p>=r)continue;const x=m+p*i;n.solid[x]!==0?(o.ledger.energy-=n.Es[x],o.ledger.water-=n.film[x],Vi(o,x)):Bn(o,x),n.solid[x]=d.s,n.role[x]=d.role,n.heater[x]=d.heater,n.T[x]=d.T,n.Es[x]=d.Es,n.film[x]=d.film,n.crust[x]=d.crust,n.kind[x]=pt,o.ledger.energy+=d.Es,o.ledger.water+=d.film,o.ledger.salt+=d.crust}for(let d=0;d<l.count;d+=1){const m=n.cellAt(l.x[d],l.y[d]);m<0||n.solid[m]===0||(_n(o,d),o.liquid.removeParticle(d),d-=1)}o.solidsChanged();for(const d of g)n.solid[d.c]===0&&o.gas.massOf(d.c)<=0&&Ii(o,d.c,o.ambientT,o.ambientY)}function fa(o,t,e){const[s,n,i,r]=ko(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=l;f<=u;f+=1)for(let h=a;h<=c;h+=1)e(h,f)}const Bt=gt+2,zt=gt,te=gt+1,ua=.9,ha=16;class Ms{constructor(t,e){v(this,"g");v(this,"gas");v(this,"conc");v(this,"fu");v(this,"fv");v(this,"outM");v(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Bt*s),this.fu=new Float64Array(Bt*t.nu),this.fv=new Float64Array(Bt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,c=s+1,l=e.ug,u=e.vg;let f=0,h=0;for(let F=0;F<n;F+=1)for(let y=0;y<s;y+=1){const A=y+F*s;if(r[A]!==U)continue;const P=y+F*c,_=l[P],T=l[P+1],L=u[A],C=u[A+s],B=(_<0?-_:0)+(T>0?T:0)+(L<0?-L:0)+(C>0?C:0);B>f&&(f=B);const Q=Math.max(_<0?-_:_,T<0?-T:T,L<0?-L:L,C<0?-C:C);Q>h&&(h=Q)}this.gas.last.uMax=h;const g=Math.min(ha,Math.max(1,Math.ceil(f*t/a/ua))),d=t/g,{conc:m}=this,p=this.gas.vgas,x=e.mg,w=e.mfog,b=e.Hg;for(let F=0;F<g;F+=1){for(let y=0;y<i;y+=1){if(r[y]!==U){for(let P=0;P<Bt;P+=1)m[P*i+y]=0;continue}const A=1/p[y];for(let P=0;P<gt;P+=1)m[P*i+y]=x[P*i+y]*A;m[zt*i+y]=w[y]*A,m[te*i+y]=b[y]*A}this.fluxesU(d),this.fluxesV(d),this.limitOutflow(),this.applyFluxes()}for(let F=0;F<i;F+=1)r[F]===U&&this.gas.deriveCell(F);return this.gas.last.substeps=g,g}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,c=e.nu,l=e.ug,{conc:u,fu:f}=this,{amb:h,gasU:g}=this.gas,d=e.aFace,m=Ms.face;for(let p=0;p<n;p+=1){const x=p*s,w=p*a;for(let b=0;b<=s;b+=1){const F=w+b,y=l[F];if(g[F]===0||y===0){for(let L=0;L<Bt;L+=1)f[L*c+F]=0;continue}const A=y*d*t;if(b===0||b===s){const L=b===0?x:x+s-1,C=b===0?y>0:y<0;for(let B=0;B<Bt;B+=1)f[B*c+F]=A*(C?h[B]:u[B*i+L]);continue}let P,_,T;if(y>0?(P=x+b-1,_=x+b,T=b>=2&&r[x+b-2]===U?x+b-2:-1):(P=x+b,_=x+b-1,T=b+1<s&&r[x+b+1]===U?x+b+1:-1),T<0){for(let L=0;L<Bt;L+=1)f[L*c+F]=A*u[L*i+P];continue}for(let L=0;L<Bt;L+=1){const C=L*i;f[L*c+F]=A*m(u[C+P],u[C+T],u[C+_])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,c=e.vg,{conc:l,fv:u}=this,{amb:f,gasV:h}=this.gas,g=e.aFace,d=Ms.face;for(let m=0;m<=n;m+=1){const p=m*s;for(let x=0;x<s;x+=1){const w=p+x,b=c[w];if(h[w]===0||b===0){for(let _=0;_<Bt;_+=1)u[_*a+w]=0;continue}const F=b*g*t;if(m===0||m===n){const _=m===0?x:x+(n-1)*s,T=m===0?b>0:b<0;for(let L=0;L<Bt;L+=1)u[L*a+w]=F*(T?f[L]:l[L*i+_]);continue}let y,A,P;if(b>0?(y=w-s,A=w,P=m>=2&&r[w-2*s]===U?w-2*s:-1):(y=w,A=w-s,P=m+1<n&&r[w+s]===U?w+s:-1),P<0){for(let _=0;_<Bt;_+=1)u[_*a+w]=F*l[_*i+y];continue}for(let _=0;_<Bt;_+=1){const T=_*i;u[_*a+w]=F*d(l[T+y],l[T+P],l[T+A])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:c,fv:l}=this,{gasU:u,gasV:f,escaped:h}=this.gas,g=t.mg,d=t.mfog,m=t.Hg;for(let p=0;p<s;p+=1){const x=p*e,w=p*i;for(let F=1;F<e;F+=1){const y=w+F;if(u[y]===0)continue;const A=x+F-1,P=A+1;for(let L=0;L<gt;L+=1){const C=c[L*r+y];g[L*n+A]-=C,g[L*n+P]+=C}const _=c[zt*r+y];d[A]-=_,d[P]+=_;const T=c[te*r+y];m[A]-=T,m[P]+=T}if(u[w]!==0){const F=x;for(let P=0;P<gt;P+=1){const _=c[P*r+w];g[P*n+F]+=_,h[P]-=_}const y=c[zt*r+w];d[F]+=y,h[zt]-=y;const A=c[te*r+w];m[F]+=A,h[te]-=A}const b=w+e;if(u[b]!==0){const F=x+e-1;for(let P=0;P<gt;P+=1){const _=c[P*r+b];g[P*n+F]-=_,h[P]+=_}const y=c[zt*r+b];d[F]-=y,h[zt]+=y;const A=c[te*r+b];m[F]-=A,h[te]+=A}}for(let p=1;p<s;p+=1){const x=p*e;for(let w=0;w<e;w+=1){const b=x+w;if(f[b]===0)continue;const F=b-e,y=b;for(let _=0;_<gt;_+=1){const T=l[_*a+b];g[_*n+F]-=T,g[_*n+y]+=T}const A=l[zt*a+b];d[F]-=A,d[y]+=A;const P=l[te*a+b];m[F]-=P,m[y]+=P}}for(let p=0;p<e;p+=1){if(f[p]!==0){const w=p;for(let y=0;y<gt;y+=1){const A=l[y*a+p];g[y*n+w]+=A,h[y]-=A}const b=l[zt*a+p];d[w]+=b,h[zt]-=b;const F=l[te*a+p];m[w]+=F,h[te]-=F}const x=p+s*e;if(f[x]!==0){const w=p+(s-1)*e;for(let y=0;y<gt;y+=1){const A=l[y*a+x];g[y*n+w]-=A,h[y]+=A}const b=l[zt*a+x];d[w]-=b,h[zt]+=b;const F=l[te*a+x];m[w]-=F,h[te]+=F}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:c,scale:l}=this,u=t.nu,f=t.nv;c.fill(0);const h=Ms.massFlux,{gasU:g,gasV:d}=this.gas;for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*i;if(g[w]===0)continue;const b=h(r,u,w);b>0&&x>0?c[x-1+p*e]+=b:b<0&&x<e&&(c[x+p*e]-=b)}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(d[w]===0)continue;const b=h(a,f,w);b>0&&p>0?c[x+(p-1)*e]+=b:b<0&&p<s&&(c[x+p*e]-=b)}let m=!1;for(let p=0;p<n;p+=1){const x=.9*this.gas.massOf(p);l[p]=c[p]>x&&c[p]>0?x/c[p]:1,l[p]<1&&(m=!0)}if(m){for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*i;if(g[w]===0)continue;const F=h(r,u,w)>0?x>0?x-1+p*e:-1:x<e?x+p*e:-1;if(!(F<0||l[F]>=1))for(let y=0;y<Bt;y+=1)r[y*u+w]*=l[F]}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(d[w]===0)continue;const F=h(a,f,w)>0?p>0?x+(p-1)*e:-1:p<s?x+p*e:-1;if(!(F<0||l[F]>=1))for(let y=0;y<Bt;y+=1)a[y*f+w]*=l[F]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=zt;i+=1)n+=t[i*e+s];return n}}const Nt=.05;class da{constructor(t,e,s){v(this,"g");v(this,"R");v(this,"solver");v(this,"vgas");v(this,"rho");v(this,"nmol");v(this,"cap");v(this,"mu");v(this,"veos");v(this,"srcV");v(this,"veosMid");v(this,"mover");v(this,"gasU");v(this,"gasV");v(this,"u0");v(this,"v0");v(this,"u1");v(this,"v1");v(this,"lim");v(this,"amb",new Float64Array(Bt));v(this,"ambT",293.15);v(this,"escaped",new Float64Array(Bt));v(this,"dp0",new Float64Array(8));v(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});v(this,"lo",0);v(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new Ms(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<gt;a+=1)n+=s[a]/ht[a];const i=e/(Lt*t*n);let r=0;for(let a=0;a<gt;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*Yt(a,t);this.amb[zt]=0,this.amb[te]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*yt(e);for(let r=0;r<gt;r+=1)i+=s.mg[r*n+t]*Yt(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return ui(s.mg[t],s.mg[n+t],s.mg[z*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[z*s+t],c=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/ht[0]+r/ht[1]+a/ht[z],l+c<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let u;if(c<=0)u=Yr(i,r,a,e.Hg[t]);else{u=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const h=(e.Hg[t]-this.enthalpy(t,u))/this.heatCapacity(t,u);if(u+=h,Math.abs(h)<1e-10)break}}u>150&&u<3e3||(u=Math.min(3e3,Math.max(150,Number.isFinite(u)?u:this.ambT))),e.T[t]=u,this.cap[t]=ui(i,r,a,c,u),this.rho[t]=l/n,this.mu[t]=dc(i,r,a,u)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===pt){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===ut&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Lt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===pt){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[z*e+s];if(t.kind[s]===ut&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Lt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===pt||this.vgas[e]<=0?0:this.nmol[e]*Lt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<gt;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let c=0;for(let f=0;f<gt;f+=1)c+=s[f]/ht[f];const l=this.R.pAt(t)*a/(Lt*e*c);let u=0;for(let f=0;f<gt;f+=1)i.mg[f*r+t]=l*s[f],u+=l*s[f]*Yt(f,e);i.mfog[t]=0,i.Hg[t]=u,i.T[t]=e}transitions(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e;let a=0;for(let c=0;c<i;c+=1){const l=t[c],u=r[c];if(l===u||u===pt||l===pt)continue;a+=1;const f=c%s,h=(c-f)/s;let g=0;for(let d=0;d<4;d+=1){const m=d===0?f>0?c-1:-1:d===1?f<s-1?c+1:-1:d===2?h>0?c-s:-1:h<n-1?c+s:-1;m>=0&&r[m]===U&&t[m]===U&&(g+=this.vgas[m]>0?this.vgas[m]:e.vCell)}if(!(g<=0)){if(u===ut)for(let d=0;d<4;d+=1){const m=d===0?f>0?c-1:-1:d===1?f<s-1?c+1:-1:d===2?h>0?c-s:-1:h<n-1?c+s:-1;if(m<0||r[m]!==U||t[m]!==U)continue;const p=(this.vgas[m]>0?this.vgas[m]:e.vCell)/g;this.move(c,m,p)}else{let d=this.massOf(c),m=0;for(let p=0;p<4;p+=1){const x=p===0?f>0?c-1:-1:p===1?f<s-1?c+1:-1:p===2?h>0?c-s:-1:h<n-1?c+s:-1;if(x<0||r[x]!==U||t[x]!==U)continue;const w=(this.vgas[x]>0?this.vgas[x]:e.vCell)/g;m+=w*this.rho[x]}if(m*=Math.max(.001,1-e.phi[c]-e.alpha[c])*e.vCell,m<=d)continue;for(let p=0;p<4;p+=1){const x=p===0?f>0?c-1:-1:p===1?f<s-1?c+1:-1:p===2?h>0?c-s:-1:h<n-1?c+s:-1;if(x<0||r[x]!==U||t[x]!==U)continue;const w=(this.vgas[x]>0?this.vgas[x]:e.vCell)/g,b=this.massOf(x);if(b<=0)continue;const F=Math.min(.25,(m-d)*w/b);this.move(x,c,F)}d=this.massOf(c),d>0&&(e.T[c]=this.ambT)}this.deriveCell(c)}}return a}move(t,e,s){const n=this.g,i=n.n;for(let c=0;c<gt;c+=1){const l=n.mg[c*i+t]*s;n.mg[c*i+t]-=l,n.mg[c*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let c=0;c<s;c+=1)for(let l=0;l<=e;l+=1){const u=l+c*i,f=l>0?n[l-1+c*e]:-1,h=l<e?n[l+c*e]:-1;let g=0;(f===U&&h===U||l===0&&t.openL&&h===U||l===e&&t.openR&&f===U)&&(g=1),this.gasU[u]=g,g===0&&(r[u]=f===ut||h===ut?f===pt||h===pt||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[u]:0)}for(let c=0;c<=s;c+=1)for(let l=0;l<e;l+=1){const u=l+c*e,f=c>0?n[l+(c-1)*e]:-1,h=c<s?n[l+c*e]:-1;let g=0;(f===U&&h===U||c===0&&t.openB&&h===U||c===s&&t.openT&&f===U)&&(g=1),this.gasV[u]=g,g===0&&(a[u]=f===ut||h===ut?f===pt||h===pt||c===0&&!t.openB||c===s&&!t.openT?0:t.vl[u]:0)}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),u=Math.min(r-1.000001,Math.max(0,s/a-.5)),f=Math.floor(l),h=Math.floor(u),g=l-f,d=u-h,m=t[f+h*c],p=t[f+1+h*c],x=t[f+(h+1)*c],w=t[f+1+(h+1)*c];return this.lo=Math.min(m,p,x,w),this.hi=Math.max(m,p,x,w),(1-d)*((1-g)*m+g*p)+d*((1-g)*x+g*w)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),u=Math.floor(c),f=Math.floor(l),h=c-u,g=l-f,d=t[u+f*i],m=t[u+1+f*i],p=t[u+(f+1)*i],x=t[u+1+(f+1)*i];return this.lo=Math.min(d,m,p,x),this.hi=Math.max(d,m,p,x),(1-g)*((1-h)*d+h*m)+g*((1-h)*p+h*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,c=n+1,l=s.ug,u=s.vg,{u0:f,v0:h,u1:g,v1:d}=this,m=this.lim;f.set(l),h.set(u);for(let b=0;b<i;b+=1)for(let F=0;F<=n;F+=1){const y=F+b*c;if(this.gasU[y]===0){g[y]=f[y];continue}const A=F*r,P=(b+.5)*r,_=this.sampleV(h,A,P);g[y]=this.sampleU(f,A-t*f[y],P-t*_),m[2*y]=this.lo,m[2*y+1]=this.hi}const p=2*s.nu;for(let b=0;b<=i;b+=1)for(let F=0;F<n;F+=1){const y=F+b*n;if(this.gasV[y]===0){d[y]=h[y];continue}const A=(F+.5)*r,P=b*r,_=this.sampleU(f,A,P);d[y]=this.sampleV(h,A-t*_,P-t*h[y]),m[p+2*y]=this.lo,m[p+2*y+1]=this.hi}for(let b=0;b<i;b+=1)for(let F=0;F<=n;F+=1){const y=F+b*c;if(this.gasU[y]===0)continue;const A=F*r,P=(b+.5)*r,_=this.sampleV(h,A,P),T=this.sampleU(g,A+t*f[y],P+t*_);let L=g[y]+.5*(f[y]-T);(L<m[2*y]||L>m[2*y+1])&&(L=g[y]),l[y]=L}for(let b=0;b<=i;b+=1)for(let F=0;F<n;F+=1){const y=F+b*n;if(this.gasV[y]===0)continue;const A=(F+.5)*r,P=b*r,_=this.sampleU(f,A,P),T=this.sampleV(d,A+t*_,P+t*h[y]);let L=d[y]+.5*(h[y]-T);(L<m[p+2*y]||L>m[p+2*y+1])&&(L=d[y]),u[y]=L}const x=this.R;for(let b=0;b<=i;b+=1)for(let F=0;F<n;F+=1){const y=F+b*n;if(this.gasV[y]===0)continue;const A=b>0?F+(b-1)*n:-1,P=b<i?F+b*n:-1,_=A>=0&&a[A]===U?this.rho[A]:-1,T=P>=0&&a[P]===U?this.rho[P]:-1,L=Math.max(Nt,_>0&&T>0?.5*(_+T):Math.max(_,T));if(!(_>0||T>0))continue;const C=_>0?A:P,B=x.id[C],Q=B>=0?x.rhoBar[B]:x.rhoAmb;u[y]-=t*e*(L-Q)/L}g.set(l),d.set(u);const w=t/(r*r);for(let b=0;b<i;b+=1)for(let F=0;F<=n;F+=1){const y=F+b*c;if(this.gasU[y]===0)continue;const A=F<n&&a[F+b*n]===U?F+b*n:F-1+b*n,P=this.mu[A]/Math.max(Nt,this.rho[A]),_=g[y],T=F<n?g[y+1]:_,L=F>0?g[y-1]:_,C=b>0?g[y-c]:s.openB?_:-_,B=b<i-1?g[y+c]:s.openT?_:-_;l[y]=_+Math.min(.2,w*P)*(T+L+C+B-4*_)}for(let b=0;b<=i;b+=1)for(let F=0;F<n;F+=1){const y=F+b*n;if(this.gasV[y]===0)continue;const A=b<i&&a[F+b*n]===U?F+b*n:F+(b-1)*n,P=this.mu[A]/Math.max(Nt,this.rho[A]),_=d[y],T=b<i?d[y+n]:_,L=b>0?d[y-n]:_,C=F>0?d[y-1]:s.openL?_:-_,B=F<n-1?d[y+1]:s.openR?_:-_;u[y]=_+Math.min(.2,w*P)*(B+C+L+T-4*_)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==U){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:c}=n,l=i+1,u=n.ug,f=n.vg;let h=i,g=-1,d=r,m=-1,p=0;for(let P=0;P<r;P+=1)for(let _=0;_<i;_+=1)c[_+P*i]===U&&(p+=1,_<h&&(h=_),_>g&&(g=_),P<d&&(d=P),P>m&&(m=P));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=p,p===0)return this.last;const w=this.solver,b=w.begin(g-h+1,m-d+1),F=this.rho;for(let P=d;P<=m;P+=1)for(let _=h;_<=g;_+=1){const T=_+P*i;if(c[T]!==U)continue;const L=w.at(_-h,P-d);b.act[L]=1,b.x[L]=n.pg[T];const C=_+P*l,B=_+P*i,Q=u[C+1]-u[C]+f[B+i]-f[B];b.b[L]=n.Sg[T]*a*a-a*Q;const O=Math.max(Nt,F[T]);_+1<i?c[T+1]===U&&_+1<=g&&(b.ax[L]=2*t/(O+Math.max(Nt,F[T+1]))):n.openR&&(b.dDx[L]+=2*t/O),_===0&&n.openL&&(b.dDx[L]+=2*t/O),P+1<r?c[T+i]===U&&P+1<=m&&(b.ay[L]=2*t/(O+Math.max(Nt,F[T+i]))):n.openT&&(b.dDy[L]+=2*t/O),P===0&&n.openB&&(b.dDy[L]+=2*t/O)}const y=w.solve(e,s,!0);x.iterations=y.iterations,x.residual=y.residual,x.capped=y.capped;const A=n.pg;for(let P=0;P<n.n;P+=1)c[P]!==U&&(A[P]=0);for(let P=d;P<=m;P+=1)for(let _=h;_<=g;_+=1){const T=_+P*i;c[T]===U&&(A[T]=b.x[w.at(_-h,P-d)])}for(let P=0;P<r;P+=1)for(let _=0;_<=i;_+=1){const T=_+P*l;if(this.gasU[T]===0)continue;if(_===0){u[T]-=2*t/Math.max(Nt,F[P*i])/a*A[P*i];continue}if(_===i){u[T]+=2*t/Math.max(Nt,F[i-1+P*i])/a*A[i-1+P*i];continue}const L=_-1+P*i,C=_+P*i;u[T]-=2*t/(Math.max(Nt,F[L])+Math.max(Nt,F[C]))/a*(A[C]-A[L])}for(let P=0;P<=r;P+=1)for(let _=0;_<i;_+=1){const T=_+P*i;if(this.gasV[T]===0)continue;if(P===0){f[T]-=2*t/Math.max(Nt,F[_])/a*A[_];continue}if(P===r){f[T]+=2*t/Math.max(Nt,F[_+(r-1)*i])/a*A[_+(r-1)*i];continue}const L=_+(P-1)*i,C=_+P*i;f[T]-=2*t/(Math.max(Nt,F[L])+Math.max(Nt,F[C]))/a*(A[C]-A[L])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let c=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===pt||this.cap[f]<=0)continue;const h=this.nmol[f];c+=h*(h*Lt*e.T[f]/s.pAt(f))/this.cap[f]}c*=Lt/a;const l=1/Math.max(.05,1-c);let u=0;for(let f=0;f<4;f+=1){const h=s.statePressure(r);s.p0[r]=h;const g=(h-(t[r]+u))*l;if(Math.abs(g)<=1e-10*h)break;let d=0;for(let m=0;m<n;m+=1){if(s.id[m]!==r||e.kind[m]===pt||this.cap[m]<=0)continue;const p=this.nmol[m]*Lt*e.T[m]/s.pAt(m);d+=p,e.Hg[m]+=p*g,this.deriveCell(m)}u+=g,i+=d*g}s.p0[r]=s.statePressure(r),this.dp0[r]=u}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<gt;i+=1)n+=e.mg[i*s+t]/ht[i];return n<=0?0:e.mg[z*s+t]/ht[z]/n*this.R.pAt(t)}}const cr=[1/6,2/3,1/6];class ma{constructor(t,e,s,n){v(this,"nx");v(this,"ny");v(this,"n");v(this,"dx");v(this,"depth");v(this,"vCell");v(this,"aFace");v(this,"nu");v(this,"nv");v(this,"openL",!1);v(this,"openR",!1);v(this,"openB",!1);v(this,"openT",!0);v(this,"solid");v(this,"role");v(this,"heater");v(this,"phiS");v(this,"sdf");v(this,"phi");v(this,"alpha");v(this,"kind");v(this,"region");v(this,"pl");v(this,"pg");v(this,"mg");v(this,"mfog");v(this,"Hg");v(this,"Es");v(this,"film");v(this,"crust");v(this,"T");v(this,"Tl");v(this,"Cl");v(this,"Sl");v(this,"Sg");v(this,"ul");v(this,"vl");v(this,"ug");v(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(lt*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}updateStatic(){const{nx:t,ny:e,dx:s}=this;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const c=a+r*t;if(this.solid[c]!==0){this.phiS[c]=1;continue}let l=0;for(let u=-1;u<=1;u+=1)for(let f=-1;f<=1;f+=1)(f!==0||u!==0)&&this.solidAt(a+f,r+u)&&(l+=cr[f+1]*cr[u+1]);this.phiS[c]=l}const n=4,i=n*s;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const c=a+r*t,l=this.solid[c]!==0,u=(a+.5)*s,f=(r+.5)*s;let h=i;l||(this.openL||(h=Math.min(h,u)),this.openR||(h=Math.min(h,this.w-u)),this.openB||(h=Math.min(h,f)),this.openT||(h=Math.min(h,this.h-f)));for(let g=-n;g<=n;g+=1){const d=r+g;if(!(d<0||d>=e))for(let m=-n;m<=n;m+=1){const p=a+m;if(p<0||p>=t||this.solid[p+d*t]!==0===l)continue;const w=Math.max(0,Math.abs(p+.5-(a+.5))-.5)*s,b=Math.max(0,Math.abs(d+.5-(r+.5))-.5)*s,F=Math.hypot(w,b);F<h&&(h=F)}}this.sdf[c]=l?-h:h}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),c=Math.floor(r),l=Math.floor(a),u=r-c,f=a-l,h=Math.min(s-1,c+1),g=Math.min(n-1,l+1),d=this.sdf;let m=(1-f)*((1-u)*d[c+l*s]+u*d[h+l*s])+f*((1-u)*d[c+g*s]+u*d[h+g*s]);return this.openL||(m=Math.min(m,t)),this.openR||(m=Math.min(m,this.w-t)),this.openB||(m=Math.min(m,e)),this.openT||(m=Math.min(m,this.h-e)),m}}const pa=5,ar=30;class ga{constructor(t,e,s,n,i){v(this,"g");v(this,"P");v(this,"L");v(this,"G");v(this,"solver");v(this,"src");v(this,"C");v(this,"Cs");v(this,"Cg");v(this,"CTl");v(this,"Tstar");v(this,"k");v(this,"dE");v(this,"Tnew");v(this,"gx");v(this,"gy");v(this,"q");v(this,"Co");v(this,"CKo");v(this,"heaters",[]);v(this,"ambientT",293.15);v(this,"fluxSL",0);v(this,"fluxLG",0);v(this,"fluxSG",0);v(this,"lossSolids",0);v(this,"liquidPower",0);v(this,"hExt",Jr);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r)}solidCap(t){const e=qt[this.g.solid[t]-1];return e.rho*e.cp*this.g.vCell}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*_o}solidEnergy(t,e){return this.solidCapCrust(t)*(e-ot)+this.g.film[t]*yt(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t),n=e.film[t];if(n<=0){e.T[t]=ot+e.Es[t]/s;return}let i=e.T[t]>100?e.T[t]:ot+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*Me(i));e.T[t]=i}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/pa,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/ar);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/ar)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:c,ny:l,n:u,depth:f,dx:h}=n,{C:g,Cs:d,Cg:m,CTl:p,Tstar:x,k:w,q:b,src:F}=this;this.heaterPower(t),p.fill(0);const y=n.Cl;y.fill(0);const{Co:A,CKo:P}=this;let _=!1,T=0;for(let S=0;S<i.count;S+=1){const $=i.mat[S],V=i.T[S],st=i.mass[S]*i.cp(S);T+=st;const k=9*S,I=r.bi[S],G=r.bj[S],J=$===ft?0:rn($,V);$!==ft&&!_&&(_=!0,A.fill(0),P.fill(0));for(let at=0;at<9;at+=1){const dt=r.wt[k+at];if(dt===0)continue;const Pt=I+at%3,At=G+(at/3|0);if(Pt<0||At<0||Pt>=c||At>=l)continue;const Fe=Pt+At*c;y[Fe]+=dt*st,p[Fe]+=dt*st*V,$!==ft&&(A[Fe]+=dt*st,P[Fe]+=dt*st*J)}}let L=0;for(let S=0;S<u;S+=1){let $=0,V=0;n.solid[S]!==0&&($=this.solidCapCrust(S)+n.film[S]*Me(n.T[S]),V=qt[n.solid[S]-1].k);const st=a.cap[S]>0&&n.solid[S]===0?a.cap[S]:0,k=y[S],I=$+st+k;if(d[S]=$,m[S]=st,g[S]=I,I<=0){x[S]=n.T[S],w[S]=0,b[S]=0;continue}const G=($*n.T[S]+st*n.T[S]+p[S])/I;x[S]=G,k>0&&(n.Tl[S]=p[S]/k),n.solid[S]===0&&(k>=st?V=_&&A[S]>0?((k-A[S])*fi(G)+P[S])/k:fi(G):V=hc(n.mg[S],n.mg[u+S],n.mg[z*u+S],G)),w[S]=V;let J=F[S];if(this.liquidPower!==0&&k>0){const dt=this.liquidPower*k/T;J+=dt,L+=dt}const at=n.heater[S];if(at>=0&&n.role[S]===1){const dt=this.heaters[at];dt!==void 0&&dt.cells>0&&(J+=dt.P/dt.cells,L+=dt.P/dt.cells)}b[S]=J}const{gx:C,gy:B}=this;for(let S=0;S<l;S+=1)for(let $=0;$<c;$+=1){const V=$+S*c;if(C[V]=0,B[V]=0,g[V]<=0)continue;const st=w[V];if($+1<c&&g[V+1]>0){const k=w[V+1];st+k>0&&(C[V]=2*st*k/(st+k)*f)}if(S+1<l&&g[V+c]>0){const k=w[V+c];st+k>0&&(B[V]=2*st*k/(st+k)*f)}}const Q=this.solver,O=Q.begin(c,l),W=O.stride,j=h*f,R=this.hExt*j,E=this.ambientT;for(let S=0;S<l;S+=1)for(let $=0;$<c;$+=1){const V=$+S*c;if(g[V]<=0)continue;const st=$+1+(S+1)*W;O.act[st]=1,O.dH[st]=g[V]/t;let k=b[V];const I=w[V],G=x[V];$+1<c&&(O.ax[st]=C[V],k+=C[V]*(x[V+1]-G)),$>0&&(k+=C[V-1]*(x[V-1]-G)),S+1<l&&(O.ay[st]=B[V],k+=B[V]*(x[V+c]-G)),S>0&&(k+=B[V-c]*(x[V-c]-G));let J=0;$===0&&(J+=this.sideConductance(n.openL,I,R,f)),$===c-1&&(J+=this.sideConductance(n.openR,I,R,f)),S===0&&(J+=this.sideConductance(n.openB,I,R,f)),S===l-1&&(J+=this.sideConductance(n.openT,I,R,f)),J>0&&(O.dDx[st]=J,k+=J*(E-x[V])),O.b[st]=k}const q=Q.solve(e,s,!1),K=this.last.solve;K.iterations=q.iterations,K.residual=q.residual,K.capped=q.capped;const D=this.Tnew,M=O.x;for(let S=0;S<l;S+=1)for(let $=0;$<c;$+=1){const V=$+S*c;D[V]=g[V]>0?x[V]+M[$+1+(S+1)*W]:n.T[V]}const N=this.dE;let tt=0,Y=0;for(let S=0;S<u;S+=1)N[S]=g[S]>0?b[S]*t:0;for(let S=0;S<l;S+=1)for(let $=0;$<c;$+=1){const V=$+S*c;if(g[V]<=0)continue;const st=w[V];if(C[V]>0){const k=C[V]*(D[V+1]-D[V])*t;N[V]+=k,N[V+1]-=k,n.kind[V]!==n.kind[V+1]&&this.pair(n.kind[V],n.kind[V+1],k)}if(B[V]>0){const k=B[V]*(D[V+c]-D[V])*t;N[V]+=k,N[V+c]-=k,n.kind[V]!==n.kind[V+c]&&this.pair(n.kind[V],n.kind[V+c],k)}for(let k=0;k<4;k+=1){if(!(k===0?$===0:k===1?$===c-1:k===2?S===0:S===l-1))continue;const G=k===0?n.openL:k===1?n.openR:k===2?n.openB:n.openT,J=this.sideConductance(G,st,R,f)*(D[V]-E)*t;N[V]-=J,G?Y+=J:tt+=J,n.solid[V]!==0&&(this.lossSolids+=J)}}for(let S=0;S<u;S+=1){if(g[S]<=0)continue;const $=N[S]/g[S];d[S]>0&&(n.Es[S]+=$*d[S],this.deriveSolid(S)),m[S]>0&&(n.Hg[S]+=$*m[S]),D[S]=$}for(let S=0;S<i.count;S+=1){const $=9*S,V=r.bi[S],st=r.bj[S];let k=0;for(let J=0;J<9;J+=1){const at=r.wt[$+J];if(at===0)continue;const dt=V+J%3,Pt=st+(J/3|0);if(dt<0||Pt<0||dt>=c||Pt>=l)continue;const At=dt+Pt*c;g[At]>0&&(k+=at*D[At])}if(k===0)continue;const I=i.mass[S],G=I/i.rho[S];i.h[S]+=i.cp(S)*k,i.derive(S),r.dVp[S]+=I/i.rho[S]-G}for(let S=0;S<u;S+=1)m[S]>0&&a.deriveCell(S);F.fill(0);const X=this.last;return X.heater=L*t,X.lossWalls=tt,X.lossOpen=Y,X}pair(t,e,s){t===pt&&e===ut?this.fluxSL-=s:t===ut&&e===pt?this.fluxSL+=s:t===ut&&e===U?this.fluxLG-=s:t===U&&e===ut?this.fluxLG+=s:t===pt&&e===U?this.fluxSG-=s:t===U&&e===pt&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function va(o,t,e,s,n,i,r){const{nx:a,ny:c}=o,l=a+1,u=o.ul,f=o.vl;for(let h=0;h<o.nu;h+=1)s[h]=t[h]!==0?1:0;for(let h=0;h<o.nv;h+=1)n[h]=e[h]!==0?1:0;for(let h=0;h<2;h+=1){i.set(u),r.set(f);for(let g=0;g<c;g+=1)for(let d=0;d<=a;d+=1){const m=d+g*l;if(s[m]!==0)continue;let p=0,x=0;d>0&&s[m-1]===1&&(p+=u[m-1],x+=1),d<a&&s[m+1]===1&&(p+=u[m+1],x+=1),g>0&&s[m-l]===1&&(p+=u[m-l],x+=1),g<c-1&&s[m+l]===1&&(p+=u[m+l],x+=1),x>0&&(i[m]=p/x,s[m]=3)}for(let g=0;g<=c;g+=1)for(let d=0;d<a;d+=1){const m=d+g*a;if(n[m]!==0)continue;let p=0,x=0;d>0&&n[m-1]===1&&(p+=f[m-1],x+=1),d<a-1&&n[m+1]===1&&(p+=f[m+1],x+=1),g>0&&n[m-a]===1&&(p+=f[m-a],x+=1),g<c&&n[m+a]===1&&(p+=f[m+a],x+=1),x>0&&(r[m]=p/x,n[m]=3)}u.set(i),f.set(r);for(let g=0;g<o.nu;g+=1)s[g]===3&&(s[g]=1);for(let g=0;g<o.nv;g+=1)n[g]===3&&(n[g]=1)}for(let h=0;h<o.nu;h+=1)s[h]===0&&(u[h]=0);for(let h=0;h<o.nv;h+=1)n[h]===0&&(f[h]=0)}function xa(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<o.count;a+=1){const c=Math.min(s-1,Math.max(0,Math.floor(o.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[a]/t.dx)));if(i[c+l*s]===ut){e[a]=0;continue}let u=!1;for(let f=Math.max(0,l-2);f<=Math.min(n-1,l+2)&&!u;f+=1)for(let h=Math.max(0,c-2);h<=Math.min(s-1,c+2);h+=1)if(i[h+f*s]===ut){u=!0;break}e[a]=u?0:1,u||(r=!0)}return r}function ba(o,t,e,s){const{nx:n,ny:i,dx:r}=o,a=n+1,c=1/r;let l=Math.min(n-1e-6,Math.max(0,t*c)),u=Math.min(i-1.000001,Math.max(0,e*c-.5)),f=Math.floor(l),h=Math.floor(u),g=l-f,d=u-h;const m=o.ul;s[0]=(1-d)*((1-g)*m[f+h*a]+g*m[f+1+h*a])+d*((1-g)*m[f+(h+1)*a]+g*m[f+1+(h+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*c-.5)),u=Math.min(i-1e-6,Math.max(0,e*c)),f=Math.floor(l),h=Math.floor(u),g=l-f,d=u-h;const p=o.vl;s[1]=(1-d)*((1-g)*p[f+h*n]+g*p[f+1+h*n])+d*((1-g)*p[f+(h+1)*n]+g*p[f+1+(h+1)*n])}function ya(o,t,e,s,n,i,r,a,c,l,u){const{nx:f,ny:h,dx:g}=o;for(let x=0;x<o.nu;x+=1)e[x]=n[x]>l?e[x]/n[x]:0;for(let x=0;x<o.nv;x+=1)s[x]=i[x]>l?s[x]/i[x]:0;const d=c*g*g/u,m=(x,w)=>x+w>0?2*x*w/(x+w):0;let p=0;{const x=f+1,w=t.begin(x,h),b=o.ul;for(let y=0;y<h;y+=1)for(let A=0;A<=f;A+=1){const P=A+y*x;if(r[P]!==1)continue;const _=t.at(A,y),T=e[P];if(w.act[_]=1,w.dH[_]=d,w.x[_]=b[P],w.b[_]=d*b[P],A+1<=f){const L=r[P+1];L===1?w.ax[_]=m(T,e[P+1]):L===2&&(w.dDx[_]+=T)}if(A>0&&r[P-1]===2&&(w.dDx[_]+=T),y+1<h){const L=r[P+x];L===1?w.ay[_]=m(T,e[P+x]):L===2&&(w.dDy[_]+=2*T)}else o.openT||(w.dDy[_]+=2*T);y>0?r[P-x]===2&&(w.dDy[_]+=2*T):o.openB||(w.dDy[_]+=2*T)}const F=t.solve(1e-6,200,!1);p+=F.iterations;for(let y=0;y<h;y+=1)for(let A=0;A<=f;A+=1){const P=A+y*x;r[P]===1&&(b[P]=w.x[t.at(A,y)])}}{const x=t.begin(f,h+1),w=o.vl;for(let F=0;F<=h;F+=1)for(let y=0;y<f;y+=1){const A=y+F*f;if(a[A]!==1)continue;const P=t.at(y,F),_=s[A];if(x.act[P]=1,x.dH[P]=d,x.x[P]=w[A],x.b[P]=d*w[A],F+1<=h){const T=a[A+f];T===1?x.ay[P]=m(_,s[A+f]):T===2&&(x.dDy[P]+=_)}if(F>0&&a[A-f]===2&&(x.dDy[P]+=_),y+1<f){const T=a[A+1];T===1?x.ax[P]=m(_,s[A+1]):T===2&&(x.dDx[P]+=2*_)}else o.openR||(x.dDx[P]+=2*_);y>0?a[A-1]===2&&(x.dDx[P]+=2*_):o.openL||(x.dDx[P]+=2*_)}const b=t.solve(1e-6,200,!1);p+=b.iterations;for(let F=0;F<=h;F+=1)for(let y=0;y<f;y+=1){const A=y+F*f;a[A]===1&&(w[A]=x.x[t.at(y,F)])}}return p}class wa{constructor(){v(this,"cellMat",null);v(this,"cellHost",null);v(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:c}=e,l=Jt.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(c*l),this.cellHost=new Uint8Array(c));const u=this.cellMat,f=this.cellHost;u.fill(0);let h=!1;for(let m=0;m<t.count;m+=1){const p=Math.min(r-1,Math.max(0,Math.floor(t.x[m]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[m]/e.dx)));u[(p+x*r)*l+t.mat[m]]+=t.mass[m],t.smass[2*m]>0&&(h=!0)}if(h){this.cellVolW===null&&(this.cellVolW=new Float64Array(c));const m=this.cellVolW;m.fill(0);for(let p=0;p<t.count;p+=1){if(t.mat[p]!==ft)continue;const x=Math.min(r-1,Math.max(0,Math.floor(t.x[p]/e.dx))),w=Math.min(a-1,Math.max(0,Math.floor(t.y[p]/e.dx)));m[x+w*r]+=t.mass[p]/t.rho[p]}}for(let m=0;m<c;m+=1){let p=0;for(let x=1;x<l;x+=1)u[m*l+x]>u[m*l+p]&&(p=x);f[m]=p}let g=!1;const d=.25*e.dx;for(let m=0;m<t.count;m+=1){i[m]=0;const p=Math.min(r-1,Math.max(0,Math.floor(t.x[m]/e.dx))),x=Math.min(a-1,Math.max(0,Math.floor(t.y[m]/e.dx))),w=f[p+x*r],b=t.mat[m];if(b===w)continue;const F=t.T[m],y=this.cellVolW,A=p+x*r,P=h&&w===ft&&y!==null&&y[A]>0?u[A*l]/y[A]:We(w,F),_=t.rho[m],T=Rs(w,F),L=Rs(b,F),C=t.mass[m]/_,B=Math.cbrt(6*C/Math.PI),Q=Math.abs(P-_);if(Q<=0||n<=0)continue;const O=(2*T+3*L)/(3*T+3*L);let W=Q*n*B*B/(18*T*O);for(let R=0;R<8;R+=1){const E=Math.max(1e-9,P*W*B/T),q=24/E*O*(1+.15*Math.pow(E,.687));W=Math.sqrt(4*Q*n*B/(3*P*q))}const j=_<P?1:-1;i[m]=j*Math.min(d,W*s),g=!0}return g}}const Fa=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),lr=24,_a=1,Pa=1,fr=24,ur=1,se=(o,t)=>(o+2)*(t+2);function hr(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function Aa(o,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){o[a]+=n*e[a];const c=t[a]-n*s[a];t[a]=c,r+=c*c}return r}function Ta(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class xt{constructor(t,e){v(this,"levels",[]);v(this,"depth",1);v(this,"xs");v(this,"bs");v(this,"p");v(this,"q");v(this,"zj");v(this,"rj");v(this,"nullId");v(this,"stack");v(this,"nullSum",new Float64Array(16));v(this,"nullCnt",new Float64Array(16));v(this,"nullCount",0);v(this,"system");v(this,"result",{iterations:0,residual:0,capped:!1});v(this,"pw",new Float64Array(4));v(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(Fa(se(s,n),i)),!(s*n<=lr||s<=2&&n<=2);)i=se(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=se(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],c=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:c,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=se(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,diag:u,inv:f,act:h}=t;for(let g=1;g<=s;g+=1){let d=1+g*n;for(let m=1;m<=e;m+=1,d+=1){if(h[d]===0){u[d]=1,f[d]=1;continue}const p=a[d]+c[d]+l[d]+i[d]+i[d-1]+r[d]+r[d-n];if(!(p>0)){h[d]=0,u[d]=1,f[d]=1;continue}u[d]=p,f[d]=1/p}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:c,diag:l}=t;for(let u=1;u<=i;u+=1){let f=1+u*r;for(let h=1;h<=n;h+=1,f+=1)s[f]=l[f]*e[f]-a[f]*e[f+1]-a[f-1]*e[f-1]-c[f]*e[f+r]-c[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:c,x:l,b:u}=t;for(let f=1;f<=n;f+=1){let h=1+(1+f+e&1)+f*i;const g=s+f*i;for(;h<=g;h+=2)l[h]=(u[h]+r[h]*l[h+1]+r[h-1]*l[h-1]+a[h]*l[h+i]+a[h-i]*l[h-i])*c[h]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:c}=t;let l=0;for(let u=1;u<=s;u+=1){let f=1+u*n;for(let h=1;h<=e;h+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||a[f]>0)&&(c[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:c,band:l,bandCount:u}=t;for(let f=e>0?0:u-1;e>0?f<u:f>=0;f+=e){const h=l[f];a[h]=(c[h]+n[h]*a[h+1]+n[h-1]*a[h-1]+i[h]*a[h+s]+i[h-s]*a[h-s])*r[h]}}prepareFine(){const t=this.levels[0],e=se(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=lr||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=se(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,c=e.h,l=s.h;for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const h=f+1+(u+1)*s.stride;let g=0,d=0,m=0,p=0;for(let P=0;P<2;P+=1){const _=2*u+P;if(!(_>=e.ny))for(let T=0;T<2;T+=1){const L=2*f+T;if(L>=e.nx)continue;const C=L+1+(_+1)*a;if(e.act[C]===0)continue;const B=e.area[C];g+=B,d+=B*((T-.5)*c+e.ox[C]*c),m+=B*((P-.5)*c+e.oy[C]*c),p+=e.dH[C]}}if(g<=0){s.act[h]=0,s.dH[h]=0,s.dDx[h]=0,s.dDy[h]=0,s.gDx[h]=0,s.gDy[h]=0,s.ox[h]=0,s.oy[h]=0;continue}s.act[h]=1,s.area[h]=g/4;const x=d/g,w=m/g;s.ox[h]=x/l,s.oy[h]=w/l,s.dH[h]=p;let b=0,F=0,y=0,A=0;for(let P=0;P<2;P+=1){const _=2*u+P;if(!(_>=e.ny))for(let T=0;T<2;T+=1){const L=2*f+T;if(L>=e.nx)continue;const C=L+1+(_+1)*a;if(e.act[C]!==0){if(e.gDx[C]>0){const B=(T-.5)*c+e.ox[C]*c;b+=e.gDx[C],F+=e.gDx[C]/(e.eDx[C]+Math.abs(B-x))}if(e.gDy[C]>0){const B=(P-.5)*c+e.oy[C]*c;y+=e.gDy[C],A+=e.gDy[C]/(e.eDy[C]+Math.abs(B-w))}}}}s.gDx[h]=b,s.gDy[h]=y,s.dDx[h]=F,s.dDy[h]=A,s.eDx[h]=F>0?b/F:.5*l,s.eDy[h]=A>0?y/A:.5*l}for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const h=f+1+(u+1)*s.stride;if(s.act[h]!==0){if(f+1<n&&s.act[h+1]!==0){const g=2*f+1;let d=0;if(g+1<e.nx)for(let m=0;m<2;m+=1){const p=2*u+m;p>=e.ny||(d+=e.gx[g+1+(p+1)*a])}if(d>0){const m=l*(1+s.ox[h+1]-s.ox[h]);s.gx[h]=d,s.ax[h]=d/Math.max(.25*l,m)}}if(u+1<i&&s.act[h+s.stride]!==0){const g=2*u+1;let d=0;if(g+1<e.ny)for(let m=0;m<2;m+=1){const p=2*f+m;p>=e.nx||(d+=e.gy[p+1+(g+1)*a])}if(d>0){const m=l*(1+s.oy[h+s.stride]-s.oy[h]);s.gy[h]=d,s.ay[h]=d/Math.max(.25*l,m)}}}}xt.diagonal(s),xt.findBand(s);for(let u=0;u<e.ny;u+=1){let f=1+(u+1)*a;for(let h=0;h<e.nx;h+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}xt.weights(s,h,u,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let g=0;g<4;g+=1)s.pIdx[4*f+g]=this.pi[g],s.pW[4*f+g]=this.pw[g]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,c=s>>1,l=(e&1)===1?1:-1,u=(s&1)===1?1:-1,f=t.stride,h=a+1+(c+1)*f;r[0]=h,r[1]=h+l,r[2]=h+u*f,r[3]=h+l+u*f;const g=a+l>=0&&a+l<t.nx,d=c+u>=0&&c+u<t.ny;i[1]=g&&t.act[r[1]]!==0?3/16:0,i[2]=d&&t.act[r[2]]!==0?3/16:0,i[3]=g&&d&&t.act[r[3]]!==0?1/16:0,t.act[h]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let g=0;g<fr;g+=1)xt.color(e,0),xt.color(e,1);for(let g=0;g<fr;g+=1)xt.color(e,1),xt.color(e,0);return}for(let g=0;g<_a;g+=1)xt.color(e,0),xt.color(e,1);for(let g=0;g<ur;g+=1)xt.bandSweep(e,1);xt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,se(s.nx,s.ny)),s.x.fill(0,0,se(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:c}=e,{pIdx:l,pW:u}=s,f=s.b,h=s.x;for(let g=0;g<e.ny;g+=1){let d=1+(g+1)*n;for(let m=0;m<e.nx;m+=1,d+=1){if(i[d]===0)continue;const p=r[d]-a[d],x=4*d;f[l[x]]+=u[x]*p,f[l[x+1]]+=u[x+1]*p,f[l[x+2]]+=u[x+2]*p,f[l[x+3]]+=u[x+3]*p}}this.vcycle(t+1);for(let g=0;g<e.ny;g+=1){let d=1+(g+1)*n;for(let m=0;m<e.nx;m+=1,d+=1){if(i[d]===0)continue;const p=4*d;c[d]+=u[p]*h[l[p]]+u[p+1]*h[l[p+1]]+u[p+2]*h[l[p+2]]+u[p+3]*h[l[p+3]]}}for(let g=0;g<ur;g+=1)xt.bandSweep(e,-1);for(let g=0;g<Pa;g+=1)xt.color(e,1),xt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,act:u}=t,f=this.nullId,h=se(e,s);let g=!1;for(let d=0;d<h;d+=1)if(u[d]!==0&&!(a[d]>0)){g=!0;break}if(!g){this.nullCount=0;return}f.fill(-2,0,h),this.nullCount=0;for(let d=1;d<=s;d+=1)for(let m=1;m<=e;m+=1){const p=m+d*n;if(u[p]===0||f[p]!==-2)continue;let x=0,w=0,b=!1;const F=-3-this.nullCount;this.stack[x++]=p,f[p]=F;let y=p,A=p;for(;x>0;){const _=this.stack[--x];w+=1,_<y&&(y=_),_>A&&(A=_),(a[_]>0||c[_]>0||l[_]>0)&&(b=!0),i[_]>0&&f[_+1]===-2&&(f[_+1]=F,this.stack[x++]=_+1),i[_-1]>0&&f[_-1]===-2&&(f[_-1]=F,this.stack[x++]=_-1),r[_]>0&&f[_+n]===-2&&(f[_+n]=F,this.stack[x++]=_+n),r[_-n]>0&&f[_-n]===-2&&(f[_-n]=F,this.stack[x++]=_-n)}let P=-1;if(!b){if(P=this.nullCount,P>=this.nullSum.length){const _=T=>{const L=new Float64Array(2*T.length);return L.set(T),L};this.nullSum=_(this.nullSum),this.nullCnt=_(this.nullCnt)}this.nullCnt[P]=w,this.nullCount+=1}for(let _=y;_<=A;_+=1)f[_]===F&&(f[_]=P)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=se(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=se(i.nx,i.ny),{act:a}=i,c=this.xs,l=this.bs,u=i.stride;for(let y=0;y<r;y+=1){if(a[y]===0){c[y]=0,l[y]=0,i.ax[y]=0,i.ay[y]=0;continue}(y+1>=r||a[y+1]===0)&&(i.ax[y]=0),(y+u>=r||a[y+u]===0)&&(i.ay[y]=0)}xt.diagonal(i);for(let y=0;y<r;y+=1)a[y]===0&&(c[y]=0,l[y]=0);this.findNull(),this.project(l),s&&(xt.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,h=s?i.x:this.zj,{p:g,q:d}=this;d.fill(0,0,r),g.fill(0,0,r),h.fill(0,0,r),xt.apply(i,c,d);let m=0,p=0;for(let y=0;y<r;y+=1){const A=a[y]===0?0:l[y]-d[y];f[y]=A,m+=l[y]*l[y],p+=A*A}this.project(f);const x=Math.sqrt(m);if(x===0)return c.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let w=Math.sqrt(p)/x;if(w<=t)return n.iterations=0,n.residual=w,n.capped=!1,n;this.precondition(s,f,h,r);let b=0;for(let y=0;y<r;y+=1)g[y]=h[y],b+=f[y]*h[y];let F=0;for(;F<e;){F+=1,xt.apply(i,g,d);const y=hr(g,d,r);if(!(y>0))break;const A=b/y;if(p=Aa(c,f,g,d,A,r),w=Math.sqrt(p)/x,w<=t)break;this.precondition(s,f,h,r);const P=hr(f,h,r),_=P/b;b=P,Ta(g,h,_,r)}this.project(c);for(let y=0;y<r;y+=1)a[y]===0&&(c[y]=0);return n.iterations=F,n.residual=w,n.capped=w>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Sa=.1,dr=1e-9;function Zt(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class ka{constructor(t,e,s){v(this,"g");v(this,"P");v(this,"solver");v(this,"mu");v(this,"pu");v(this,"mv");v(this,"pv");v(this,"rv");v(this,"knownU");v(this,"knownV");v(this,"tmpU");v(this,"tmpV");v(this,"markU");v(this,"markV");v(this,"bi");v(this,"bj");v(this,"wr");v(this,"wt");v(this,"dVp");v(this,"volSrc");v(this,"fU");v(this,"fV");v(this,"pGas");v(this,"w",new Float64Array(12));v(this,"rhoRef",998);v(this,"weightsDirty",!0);v(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});v(this,"escM",0);v(this,"escO",0);v(this,"escS",0);v(this,"escE",0);v(this,"viscous",!1);v(this,"etaU",null);v(this,"etaV",null);v(this,"vsolver",null);v(this,"mf",0);v(this,"ms",1);v(this,"stranded",new Uint8Array(0));v(this,"vel",new Float64Array(2));v(this,"drifts",new wa);v(this,"dropletDrift",null);this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;for(let c=0;c<t.count;c+=1){n[c]=Zt(t.x[c]*a-.5,s,0),i[c]=Zt(t.y[c]*a-.5,s,3);const l=9*c;for(let u=0;u<3;u+=1)for(let f=0;f<3;f+=1)r[l+f+3*u]=s[f]*s[3+u]}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:c,kind:l}=e;for(let u=0;u<t.count;u+=1){const f=9*u,h=s[u],g=n[u];let d=0;for(let m=0;m<9;m+=1){const p=h+m%3,x=g+(m/3|0),b=p>=0&&x>=0&&p<a&&x<c&&l[p+x*a]===ut?i[f+m]:0;r[f+m]=b,d+=b}if(d>0){const m=1/d;for(let p=0;p<9;p+=1)r[f+p]*=m}else{for(let m=0;m<9;m+=1)r[f+m]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:c}=this,{nx:l,ny:u,kind:f}=s,h=1/s.dx;i[t]=Zt(e.x[t]*h-.5,n,0),r[t]=Zt(e.y[t]*h-.5,n,3);const g=9*t;let d=0;for(let m=0;m<3;m+=1)for(let p=0;p<3;p+=1){const x=p+3*m,w=n[p]*n[3+m];a[g+x]=w;const b=i[t]+p,F=r[t]+m,y=b>=0&&F>=0&&b<l&&F<u&&f[b+F*l]===ut;c[g+x]=y?w:0,y&&(d+=w)}if(d>0)for(let m=0;m<9;m+=1)c[g+m]/=d;else{for(let m=0;m<9;m+=1)c[g+m]=0;c[g+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:c}=e;c.fill(0);const l=1/e.vCell;let u=0,f=0;for(let h=0;h<t.count;h+=1){const g=t.mass[h]/t.rho[h];u+=t.mass[h],f+=g;const d=9*h,m=s[h],p=n[h];for(let x=0;x<9;x+=1){const w=m+x%3,b=p+(x/3|0);w<0||b<0||w>=r||b>=a||(c[w+b*r]+=i[d+x]*g*l)}}f>0&&(this.rhoRef=u/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=pt;continue}const a=e.phi[r];let c=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!c&&t!==null&&t[r]!==U&&t[r]!==pt){const l=r%s,u=(r-l)/s;(l>0?t[r-1]===U:e.openL)||(l<s-1?t[r+1]===U:e.openR)||(u>0?t[r-s]===U:e.openB)||(u<n-1?t[r+s]===U:e.openT)||(c=!0)}e.kind[r]=c?ut:U,c&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:c}=this,{nx:l,ny:u,dx:f}=e,h=1/f,g=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),c.fill(0);const d=1/this.rhoRef,m=this.viscous;m&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const p=this.etaU,x=this.etaV;m&&(p.fill(0),x.fill(0));for(let w=0;w<t.count;w+=1){const b=t.x[w],F=t.y[w],y=t.mass[w],A=m?Rs(t.mat[w],t.T[w]):0,P=t.vx[w],_=t.vy[w],T=t.c00[w],L=t.c01[w],C=t.c10[w],B=t.c11[w],Q=b*h,O=F*h;let W=Zt(Q,s,0),j=Zt(O-.5,s,3);for(let E=0;E<3;E+=1){const q=j+E,K=(q+.5)*f-F;for(let D=0;D<3;D+=1){const M=W+D,N=s[D]*s[3+E]*y,tt=N*(P+T*(M*f-b)+L*K);if(M>=0&&M<=l&&q>=0&&q<u){const Y=M+q*g;n[Y]+=N,i[Y]+=tt,m&&(p[Y]+=N*A)}else this.mirrorU(M,q),n[this.mf]+=N,i[this.mf]+=this.ms*tt,m&&(p[this.mf]+=N*A)}}W=Zt(Q-.5,s,0),j=Zt(O,s,3);const R=t.rho[w]*d;for(let E=0;E<3;E+=1){const q=j+E,K=q*f-F;for(let D=0;D<3;D+=1){const M=W+D,N=s[D]*s[3+E]*y,tt=N*(_+C*((M+.5)*f-b)+B*K);let Y,X=1;M>=0&&M<l&&q>=0&&q<=u?Y=M+q*l:(this.mirrorV(M,q),Y=this.mf,X=this.ms),r[Y]+=N,a[Y]+=X*tt,c[Y]+=N*R,m&&(x[Y]+=N*A)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?s.openL?r=0:(r=-r,c=-c):r>n&&(s.openR?r=n:(r=2*n-r,c=-c)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=c}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,c=-c):a>i&&(s.openT?a=i:(a=2*i-a,c=-c)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=c}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:c,dx:l,kind:u}=i,f=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:h,pu:g,mv:d,pv:m,rv:p,knownU:x,knownV:w}=this,b=i.ul,F=i.vl,y=this.rhoRef*i.vCell*.25,A=dr*y,P=this.viscous;for(let R=0;R<i.nu;R+=1)b[R]=h[R]>A?g[R]/h[R]+(P?0:t*this.fU[R]/(this.rhoRef*i.vCell)):0;for(let R=0;R<i.nv;R+=1)F[R]=d[R]>A?m[R]/d[R]+(P?0:-t*e*(p[R]/d[R])+t*this.fV[R]/(this.rhoRef*i.vCell)):0;for(let R=0;R<c;R+=1)for(let E=0;E<=a;E+=1){const q=E+R*f,K=E>0?u[E-1+R*a]:-1,D=E<a?u[E+R*a]:-1,M=E===0&&!i.openL,N=E===a&&!i.openR;if(M||N||K===pt||D===pt){b[q]=0,x[q]=2;continue}x[q]=K===ut||D===ut?1:0}for(let R=0;R<=c;R+=1)for(let E=0;E<a;E+=1){const q=E+R*a,K=R>0?u[E+(R-1)*a]:-1,D=R<c?u[E+R*a]:-1,M=R===0&&!i.openB,N=R===c&&!i.openT;if(M||N||K===pt||D===pt){F[q]=0,w[q]=2;continue}w[q]=K===ut||D===ut?1:0}if(this.last.viscIterations=0,P){this.viscosity(t);const R=t/(this.rhoRef*i.vCell);for(let E=0;E<i.nu;E+=1)x[E]!==2&&h[E]>A&&(b[E]+=R*this.fU[E]);for(let E=0;E<i.nv;E+=1)w[E]!==2&&d[E]>A&&(F[E]+=-t*e*(p[E]/d[E])+R*this.fV[E])}let _=a,T=-1,L=c,C=-1,B=0;for(let R=0;R<c;R+=1)for(let E=0;E<a;E+=1)u[E+R*a]===ut&&(B+=1,E<_&&(_=E),E>T&&(T=E),R<L&&(L=R),R>C&&(C=R));const Q=this.last.solve;if(Q.iterations=0,Q.residual=0,Q.capped=!1,B>0){const R=T-_+1,E=C-L+1,q=this.solver,K=q.begin(R,E),D=t/this.rhoRef,M=1/i.vCell,N=this.pGas;for(let X=L;X<=C;X+=1)for(let S=_;S<=T;S+=1){const $=S+X*a;if(u[$]!==ut)continue;const V=q.at(S-_,X-L);K.act[V]=1,K.x[V]=i.pl[$];const st=S+X*f,k=S+X*a,I=b[st+1]-b[st]+F[k+a]-F[k],G=i.phi[$]+i.phiS[$]+i.alpha[$];let J=this.volSrc[$]*M;const at=this.gasAt(S-1,X)||this.gasAt(S+1,X)||this.gasAt(S,X-1)||this.gasAt(S,X+1),dt=G-1;(dt>0||!at)&&(J+=Sa*dt/t);let Pt=J*l*l-l*I;if(S+1<a){const At=u[$+1];At===ut?S+1<=T&&(K.ax[V]=D):At===U&&(K.dDx[V]+=D,Pt+=D*N[$+1])}else i.openR&&(K.dDx[V]+=2*D);if(S>0?u[$-1]===U&&(K.dDx[V]+=D,Pt+=D*N[$-1]):i.openL&&(K.dDx[V]+=2*D),X+1<c){const At=u[$+a];At===ut?X+1<=C&&(K.ay[V]=D):At===U&&(K.dDy[V]+=D,Pt+=D*N[$+a])}else i.openT&&(K.dDy[V]+=2*D);X>0?u[$-a]===U&&(K.dDy[V]+=D,Pt+=D*N[$-a]):i.openB&&(K.dDy[V]+=2*D),K.b[V]=Pt}const tt=q.solve(s,n,!0);Q.iterations=tt.iterations,Q.residual=tt.residual,Q.capped=tt.capped;const Y=i.pl;for(let X=0;X<i.n;X+=1)Y[X]=u[X]===U?N[X]:0;for(let X=L;X<=C;X+=1)for(let S=_;S<=T;S+=1){const $=S+X*a;u[$]===ut&&(Y[$]=K.x[q.at(S-_,X-L)])}for(let X=0;X<c;X+=1)for(let S=0;S<=a;S+=1){const $=S+X*f;if(x[$]===1){if(S===0){b[$]-=D/l*2*(Y[X*a]-0);continue}if(S===a){b[$]-=D/l*2*(0-Y[a-1+X*a]);continue}b[$]-=D/l*(Y[S+X*a]-Y[S-1+X*a])}}for(let X=0;X<=c;X+=1)for(let S=0;S<a;S+=1){const $=S+X*a;if(w[$]===1){if(X===0){F[$]-=D/l*2*(Y[S]-0);continue}if(X===c){F[$]-=D/l*2*(0-Y[S+(c-1)*a]);continue}F[$]-=D/l*(Y[S+X*a]-Y[S+(X-1)*a])}}}this.extrapolate();const O=this.markStranded(),W=this.g2p(O?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const j=this.last;return j.cells=B,j.uMax=W,j.escapedMass=this.escM,j.escapedOther=this.escO,j.escapedSalt=this.escS,j.escapedEnergy=this.escE,j}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new xt(e.nx+1,e.ny+1));const s=dr*this.rhoRef*e.vCell*.25;this.last.viscIterations=ya(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===U}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:c}=this,{nx:l,ny:u}=s,f=1/t;for(let h=0;h<e.count;h+=1){const g=a[h];if(g===0)continue;const d=9*h,m=n[h],p=i[h];for(let x=0;x<9;x+=1){const w=m+x%3,b=p+(x/3|0);w<0||b<0||w>=l||b>=u||(c[w+b*l]+=r[d+x]*g*f)}}}extrapolate(){va(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:c,dx:l}=n,u=1/l,f=a+1,h=n.ul,g=n.vl,d=4/(l*l);let m=0;for(let p=0;p<s.count;p+=1){if(t>0&&r[p]!==0){s.vy[p]-=e*t,s.c00[p]=0,s.c01[p]=0,s.c10[p]=0,s.c11[p]=0;const O=s.vx[p]*s.vx[p]+s.vy[p]*s.vy[p];O>m&&(m=O);continue}const x=s.x[p],w=s.y[p],b=x*u,F=w*u;let y=Zt(b,i,0),A=Zt(F-.5,i,3),P=0,_=0,T=0;for(let O=0;O<3;O+=1){const W=A+O,j=(W+.5)*l-w;for(let R=0;R<3;R+=1){const E=y+R,q=i[R]*i[3+O];let K;E>=0&&E<=a&&W>=0&&W<c?K=h[E+W*f]:(this.mirrorU(E,W),K=this.ms*h[this.mf]),P+=q*K,_+=q*K*(E*l-x),T+=q*K*j}}y=Zt(b-.5,i,0),A=Zt(F,i,3);let L=0,C=0,B=0;for(let O=0;O<3;O+=1){const W=A+O,j=W*l-w;for(let R=0;R<3;R+=1){const E=y+R,q=i[R]*i[3+O];let K;E>=0&&E<a&&W>=0&&W<=c?K=g[E+W*a]:(this.mirrorV(E,W),K=this.ms*g[this.mf]),L+=q*K,C+=q*K*((E+.5)*l-x),B+=q*K*j}}s.vx[p]=P,s.vy[p]=L,s.c00[p]=d*_,s.c01[p]=d*T,s.c10[p]=d*C,s.c11[p]=d*B;const Q=P*P+L*L;Q>m&&(m=Q)}return Math.sqrt(m)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),xa(this.P,this.g,this.stranded)}velocityAt(t,e,s){ba(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const{P:s,g:n,vel:i}=this,r=n.w,a=n.h,c=n.dx;let l=0,u=0,f=0,h=0,g=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(g=this.dropletDrift));const d=this.stranded;for(let m=0;m<s.count;m+=1){const p=s.x[m],x=s.y[m],w=d[m]!==0;let b,F;if(w)b=p+t*s.vx[m],F=x+t*s.vy[m];else{this.velocityAt(p,x,i);const P=p+.5*t*i[0],_=x+.5*t*i[1];this.velocityAt(P,_,i),b=p+t*i[0],F=x+t*i[1]+(g!==null?g[m]:0)}if(b<0&&n.openL||b>r&&n.openR||F<0&&n.openB||F>a&&n.openT){const P=s.smass[2*m];s.mat[m]===ft?l+=s.mass[m]-P:u+=s.mass[m]-P,f+=P,h+=s.mass[m]*s.h[m],g!==null&&(g[m]=g[s.count-1]),d[m]=d[s.count-1],this.removeParticle(m),m-=1;continue}const y=1e-4*c;w&&(b<y||b>r-y)&&(s.vx[m]=0),w&&(F<y||F>a-y)&&(s.vy[m]=0),b=Math.min(r-y,Math.max(y,b)),F=Math.min(a-y,Math.max(y,F));let A=n.sdfAt(b,F);if(A<.05*c)for(let P=0;P<3&&A<.05*c;P+=1){const _=.25*c;let T=n.sdfAt(b+_,F)-n.sdfAt(b-_,F),L=n.sdfAt(b,F+_)-n.sdfAt(b,F-_);const C=Math.hypot(T,L);if(C<1e-12)break;T/=C,L/=C;const B=.05*c-A;b+=B*T,F+=B*L;const Q=s.vx[m]*T+s.vy[m]*L;w?(s.vx[m]=0,s.vy[m]=0):Q<0&&(s.vx[m]-=Q*T,s.vy[m]-=Q*L),b=Math.min(r-y,Math.max(y,b)),F=Math.min(a-y,Math.max(y,F)),A=n.sdfAt(b,F)}s.x[m]=b,s.y[m]=F}this.escM=l,this.escO=u,this.escS=f,this.escE=h}}class Ma{constructor(t){v(this,"cap");v(this,"count",0);v(this,"nextId",1);v(this,"x");v(this,"y");v(this,"vx");v(this,"vy");v(this,"c00");v(this,"c01");v(this,"c10");v(this,"c11");v(this,"mass");v(this,"h");v(this,"T");v(this,"rho");v(this,"spc");v(this,"smass");v(this,"mat");v(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?Dc:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=oa(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Ri(r,i);return}const s=this.mat[t],n=xc(s,this.h[t]);this.T[t]=n,this.rho[t]=We(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==ft)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?ra(this.T[t],e/this.mass[t]):Bi(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function La(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:c}=o,{nx:l,ny:u,n:f,kind:h}=s,{Tl:g}=t,d=t.rd;let m=!1;for(let b=0;b<f;b+=1){if(d[b]=0,h[b]===U&&t.Cl[b]>0){const T=t.boilingAt(b,r.pAt(b));g[b]>T&&(d[b]=T,m=!0);continue}if(h[b]!==ut)continue;const F=b%l,y=(b-F)/l,A=y+1<u?b+l:-1;if(!(A>=0&&h[A]===U||F>0&&h[b-1]===U||F<l-1&&h[b+1]===U||y>0&&h[b-l]===U))continue;const _=t.boilingAt(b,r.pAt(b));g[b]>_&&(d[b]=_,m=!0)}if(!m)return;const p=t.mtot;p.fill(0);const x=t.Y0;x.fill(0);const w=i.rhoRef*s.vCell/4;for(let b=0;b<n.count;b+=1){if(n.mat[b]!==ft)continue;const F=n.smass[2*b],y=F>0?F/n.mass[b]:0,A=9*b;let P=0,_=0,T=-1,L=0;for(let Q=0;Q<2;Q+=1){for(let O=0;O<9;O+=1){const W=i.wt[A+O];if(W===0)continue;const j=i.bi[b]+O%3,R=i.bj[b]+(O/3|0);if(j<0||R<0||j>=l||R>=u)continue;const E=j+R*l,q=d[E];if(q===0)continue;const K=F>0?So(q,y):yt(q);if(n.h[b]<=K)continue;const D=mt(q),M=W*n.mass[b]*(n.h[b]-K)/(D-(F>0?ln(q,y):K));Q===0?(P+=M,_+=M*D,W>L&&(L=W,T=E)):(p[E]+=M,x[E]+=M*D)}if(P===0)break;if(Q===0&&n.mass[b]-F-P<pi*w){const O=d[T],W=n.mass[b]-F,j=mt(O),R=F>0?F*Cn(O):0;p[T]+=W,x[T]+=W*j,F>0&&o.salt.deposit(n.x[b],n.y[b],F,R),c.src[T]-=(W*j+R-n.mass[b]*n.h[b])/e,P=-1;break}}if(P===0)continue;if(P<0){i.removeParticle(b),b-=1;continue}const C=n.mass[b]/n.rho[b],B=n.mass[b]-P;n.h[b]=(n.mass[b]*n.h[b]-_)/B,n.mass[b]=B,n.derive(b),i.dVp[b]+=B/n.rho[b]-C}for(let b=0;b<f;b+=1){if(p[b]===0)continue;const F=b%l,y=(b-F)/l;let A=0;const P=h[b]===U?b:y+1<u&&h[b+l]===U?b+l:-1;if(P>=0)s.mg[z*f+P]+=p[b],s.Hg[P]+=x[b],a.deriveCell(P);else{const _=t.side;_[0]=F>0&&h[b-1]===U?b-1:-1,_[1]=F<l-1&&h[b+1]===U?b+1:-1,_[2]=y>0&&h[b-l]===U?b-l:-1,_[3]=-1;for(let T=0;T<3;T+=1)_[T]>=0&&(A+=1);for(let T=0;T<3;T+=1)_[T]<0||(s.mg[z*f+_[T]]+=p[b]/A,s.Hg[_[T]]+=x[b]/A,a.deriveCell(_[T]))}t.produced+=p[b]}}function Ca(o,t,e,s,n){const i=o.grid,r=i.n,a=i.mg[it*r+t],c=i.mg[rt*r+t],l=i.Hg[t];if(s<=0)return Yr(a,c,e,l);let u=n;for(let f=0;f<6;f+=1){const h=a*Yt(it,u)+c*Yt(rt,u)+e*mt(u)+s*yt(u),g=(l-h)/ui(a,c,e,s,u);if(u+=g,Math.abs(g)<1e-10)break}return u}function Ss(o,t,e,s,n,i){const r=o.grid,a=r.n,c=r.mg[z*a+t]-e,l=r.mfog[t]+e,u=Ca(o,t,c,l,i),f=c/ht[z];return(f+s>0?f/(f+s)*n:0)-qs(u)}function Hn(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[z*r+e],s));n.mg[z*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function Oa(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==U)continue;const r=e.mg[z*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const c=e.mg[it*n+i]/ht[it]+e.mg[rt*n+i]/ht[rt],l=s.pAt(i),u=e.T[i];if(a<=0){const w=r/ht[z];if(w/(w+c)*l<.999*qs(u))continue}const f=Ss(o,i,0,c,l,u);if(f<=0&&a<=0)continue;let h,g,d,m;if(f>0)h=0,d=f,g=r,m=Ss(o,i,g,c,l,u);else if(g=0,m=f,h=-a,d=Ss(o,i,h,c,l,u),d<=0){Hn(o,t,i,h);continue}if(m>0){Hn(o,t,i,g);continue}let p=h,x=0;for(let w=0;w<40;w+=1){p=(h*m-g*d)/(m-d),(!Number.isFinite(p)||p<=Math.min(h,g)||p>=Math.max(h,g))&&(p=.5*(h+g));const b=Ss(o,i,p,c,l,u);if(Math.abs(b)<=1e-13*l)break;b>0?(h=p,d=b,x===1&&(m/=2),x=1):(g=p,m=b,x===-1&&(d/=2),x=-1)}if(Hn(o,t,i,p),f<0&&p>0&&(t.fogWrong+=1),e.mfog[i]>0){const w=Ss(o,i,0,c,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(w)/qs(e.T[i]))}}}const pi=.001;class Ba{constructor(t){v(this,"e");v(this,"produced",0);v(this,"condensed",0);v(this,"dew",0);v(this,"fogMade",0);v(this,"producedMark",0);v(this,"fogError",0);v(this,"fogWrong",0);v(this,"mtot");v(this,"rd");v(this,"Y0");v(this,"Tl");v(this,"Cl");v(this,"acc");v(this,"accH");v(this,"accAll");v(this,"host");v(this,"mixed",!1);v(this,"salty",!1);v(this,"accS");v(this,"mol");v(this,"aw");v(this,"accMat");v(this,"Fm");v(this,"Fe");v(this,"dm");v(this,"side",new Int32Array(4));v(this,"bG");v(this,"bY");v(this,"edge");v(this,"hvC");v(this,"hnC");v(this,"hoC");v(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*Jt.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*qs(t)/e),c=i.mg[it*r+s],l=i.mg[rt*r+s],u=c+l,f=u>0?u/(c/ht[it]+l/ht[rt]):.02885;return a*ht[z]/(a*ht[z]+(1-a)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:c,acc:l,accH:u,accAll:f,accS:h}=this;c.fill(0),a.fill(0),l.fill(0),u.fill(0);let g=!1,d=!1;for(let p=0;p<e.count;p+=1){const x=e.mass[p],w=e.mat[p],b=x*e.cp(p),F=e.smass[2*p],y=x-F,A=F>0?ln(e.T[p],F/x):e.h[p];F>0&&!d&&(d=!0,h.fill(0)),w!==ft&&!g&&(g=!0,f.fill(0),this.accMat.fill(0));const P=9*p;for(let _=0;_<9;_+=1){const T=s.wt[P+_];if(T===0)continue;const L=s.bi[p]+_%3,C=s.bj[p]+(_/3|0);if(L<0||C<0||L>=n||C>=i)continue;const B=L+C*n;c[B]+=T*b,a[B]+=T*b*e.T[p],w===ft&&(l[B]+=T*y,u[B]+=T*y*A),d&&(h[B]+=T*F),g&&(this.accMat[w*r+B]+=T*x)}}for(let p=0;p<r;p+=1)a[p]=c[p]>0?a[p]/c[p]:t.T[p];if(this.mixed=g,this.salty=d,d)for(let p=0;p<r;p+=1){const x=h[p]>0&&l[p]>0?h[p]/(l[p]*Es):0;this.mol[p]=x,this.aw[p]=x>0?yo(a[p],x):1}if(!g){f.set(l),this.host.fill(ft);return}const m=Jt.length;for(let p=0;p<r;p+=1){this.accMat[ft*r+p]=d?l[p]+h[p]:l[p];let x=0,w=ft,b=-1;for(let F=0;F<m;F+=1){const y=this.accMat[F*r+p];x+=y,y>b&&(b=y,w=F)}f[p]=x,this.host[p]=w}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?wo(e,this.mol[t]):wt(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:yt(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?ft:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:c,dm:l}=this;l.fill(0,0,n.count);for(let f=0;f<n.count;f+=1){if(n.mat[f]!==ft)continue;const h=9*f;let g=0;for(let d=0;d<9;d+=1){const m=i.wt[h+d];if(m===0)continue;const p=i.bi[f]+d%3,x=i.bj[f]+(d/3|0);if(p<0||x<0||p>=r||x>=a)continue;const w=p+x*r;t[w]!==0&&c[w]>0&&(g+=t[w]*m*(n.mass[f]-n.smass[2*f])/c[w])}l[f]=g}const u=i.rhoRef*s.vCell/4;for(let f=n.count-1;f>=0;f-=1){const h=l[f];if(h===0)continue;if(n.smass[2*f]>0){this.applySalty(f,h,u,e);continue}const g=n.mass[f]/n.rho[f],d=n.mass[f]+h;if(d<pi*u){this.track(f,-n.mass[f]),this.vanish(f,Math.max(0,d),e);continue}this.track(f,h),n.mass[f]=d,i.dVp[f]+=d/n.rho[f]-g}for(let f=0;f<s.n;f+=1){if(t[f]<=0||c[f]>0)continue;const h=f%r,g=(f-h)/r,d=n.add((h+.5)*s.dx,(g+.5)*s.dx,t[f],this.waterH(f),ft);d<0||(i.placeParticle(d),i.dVp[d]=t[f]/n.rho[d],this.track(d,t[f]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,c=9*t,l=Bi(n.mat[t],n.T[t]);for(let u=0;u<9;u+=1){const f=i.wt[c+u];if(f===0)continue;const h=i.bi[t]+u%3,g=i.bj[t]+(u/3|0);if(h<0||g<0||h>=r||g>=a)continue;const d=h+g*r;this.acc[d]+=f*e,this.accH[d]+=f*e*n.h[t],this.accAll[d]+=f*e,this.Cl[d]+=f*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],c=i.mass[t],l=c-a,u=ln(i.T[t],a/c),f=i.cp(t),h=c*i.h[t]+e*u,g=l+e;if(g<pi*s){this.trackSalty(t,-l,-l*u,-c,-a,-c*f),this.dryUp(t,Math.max(0,g),h,n);return}const d=c/i.rho[t];i.mass[t]=c+e,i.h[t]=h/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-d;const m=ln(i.T[t],a/i.mass[t]);this.trackSalty(t,e,g*m-l*u,e,0,i.mass[t]*i.cp(t)-c*f)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:c}=this.e,{nx:l,ny:u}=a,f=9*t;for(let h=0;h<9;h+=1){const g=c.wt[f+h];if(g===0)continue;const d=c.bi[t]+h%3,m=c.bj[t]+(h/3|0);if(d<0||m<0||d>=l||m>=u)continue;const p=d+m*l;this.acc[p]+=g*e,this.accH[p]+=g*s,this.accAll[p]+=g*n,this.accS[p]+=g*i,this.Cl[p]+=g*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:c,gas:l}=this.e,u=r.T[t],f=r.smass[2*t],h=f*Cn(u);this.e.salt.deposit(r.x[t],r.y[t],f,h);const g=i.cellAt(r.x[t],r.y[t]);let d=g;for(;d>=0&&i.kind[d]!==U;)d=d+i.nx<i.n?d+i.nx:-1;if(g>=0&&d>=0)e>0&&(i.mg[z*i.n+d]+=e,i.Hg[d]+=e*mt(u),this.produced+=e,l.deriveCell(d)),c.src[g]-=(e*mt(u)+h-s)/n;else if(g>=0){for(let m=0;m<r.count;m+=1)if(m!==t&&r.mat[m]===r.mat[t]&&i.cellAt(r.x[m],r.y[m])===g){const p=r.mass[m]*r.h[m]+(s-h);r.mass[m]+=e,r.h[m]=p/r.mass[m],r.derive(m);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:c}=this.e,l=n.cellAt(i.x[t],i.y[t]);let u=l;for(;u>=0&&n.kind[u]!==U;)u=u+n.nx<n.n?u+n.nx:-1;if(e>0&&u>=0&&l>=0){const f=i.T[t];n.mg[z*n.n+u]+=e,n.Hg[u]+=e*mt(f),a.src[l]-=e*(mt(f)-i.h[t])/s,this.produced+=e,c.deriveCell(u)}else if(e>0&&l>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===l){const h=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=h/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),La(this.e,this,t),Oa(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:c,ny:l,n:u,depth:f,kind:h}=s,{mtot:g,rd:d,Y0:m,Tl:p,Fm:x,Fe:w,edge:b,hvC:F,hnC:y,hoC:A}=this;let P=!1;for(let O=0;O<u;O+=1){if(h[O]!==U){g[O]=0;continue}const W=s.mg[O]+s.mg[u+O]+s.mg[z*u+O];g[O]=W,m[O]=W>0?s.mg[z*u+O]/W:0;const j=s.T[O];d[O]=n.rho[O]*mc(j,i.pAt(O)),F[O]=mt(j),y[O]=Yt(it,j),A[O]=Yt(rt,j),P=!0}if(!P)return;for(let O=0;O<l;O+=1)for(let W=0;W<c;W+=1){const j=W+O*c;b[j]=h[j]===U&&(W===0||O===0||W===c-1||O===l-1||h[j-1]!==U||h[j+1]!==U||h[j-c]!==U||h[j+c]!==U)?1:0}const _=a.begin(c,l),T=_.stride,L=e.ambientY[z],{bG:C,bY:B}=this;for(let O=0;O<l;O+=1)for(let W=0;W<c;W+=1){const j=W+O*c;if(h[j]!==U||g[j]<=0)continue;const R=W+1+(O+1)*T;_.act[R]=1,_.x[R]=m[j],_.dH[R]=g[j]/t;let E=g[j]*m[j]/t;if(W+1<c&&h[j+1]===U&&g[j+1]>0&&(_.ax[R]=.5*(d[j]+d[j+1])*f),O+1<l&&h[j+c]===U&&g[j+c]>0&&(_.ay[R]=.5*(d[j]+d[j+c])*f),b[j]===0){_.b[R]=E;continue}let q=0;for(let K=0;K<4;K+=1){const D=this.boundary(j,W,O,K,L);C[4*j+K]=D,B[4*j+K]=this.yb,!(D<=0)&&(q+=D,E+=D*this.yb)}_.dDx[R]=q,_.b[R]=E}a.solve(1e-9,200,!1),x.fill(0),w.fill(0);const Q=_.x;for(let O=0;O<l;O+=1)for(let W=0;W<c;W+=1){const j=W+O*c;if(h[j]!==U||g[j]<=0)continue;const R=W+1+(O+1)*T,E=Q[R];if(W+1<c&&h[j+1]===U&&g[j+1]>0&&this.exchange(j,j+1,t*.5*(d[j]+d[j+1])*f*(E-Q[R+1])),O+1<l&&h[j+c]===U&&g[j+c]>0&&this.exchange(j,j+c,t*.5*(d[j]+d[j+c])*f*(E-Q[R+T])),b[j]!==0)for(let q=0;q<4;q+=1){const K=C[4*j+q];if(K<=0)continue;const D=t*K*(B[4*j+q]-E),N=(q===0?W===0:q===1?W===c-1:q===2?O===0:O===l-1)?-1:q===0?j-1:q===1?j+1:q===2?j-c:j+c;if(N<0)this.ambientExchange(j,D);else if(h[N]===ut)if(D>0){const tt=p[N];s.mg[z*u+j]+=D,s.Hg[j]+=D*mt(tt),x[N]-=D,w[N]-=D*mt(tt),this.produced+=D}else{const tt=Math.min(-D,s.mg[z*u+j]);s.mg[z*u+j]-=tt,s.Hg[j]-=tt*mt(s.T[j]),x[N]+=tt,w[N]+=tt*mt(s.T[j]),this.condensed+=tt}else if(h[N]===pt){const tt=s.T[N];if(D<0){const Y=Math.min(-D,s.mg[z*u+j]);s.mg[z*u+j]-=Y,s.Hg[j]-=Y*mt(s.T[j]),s.film[N]+=Y,s.Es[N]+=Y*yt(tt),r.src[N]+=Y*(mt(s.T[j])-yt(tt))/t,this.dew+=Y}else{const Y=Math.min(D,s.film[N]);s.film[N]-=Y,s.Es[N]-=Y*yt(tt),s.mg[z*u+j]+=Y,s.Hg[j]+=Y*mt(tt),r.src[N]-=Y*(mt(tt)-yt(tt))/t,this.dew-=Y}}}}for(let O=0;O<u;O+=1)x[O]!==0&&(r.src[O]+=(w[O]-x[O]*this.waterH(O))/t);this.applyMass(x,t);for(let O=0;O<u;O+=1)h[O]===U&&g[O]>0&&n.deriveCell(O)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:c,depth:l,kind:u}=r,f=n===0?e===0:n===1?e===a-1:n===2?s===0:s===c-1,h=2*this.rd[t]*l;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,h):0;const g=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=g;const d=u[g],m=this.Y0[t],p=this.e.regions.pAt(t);if(d===ut){const x=this.waterShare(g);return x<=0||!(this.acc[g]>0)?0:(this.yb=this.ysat(this.Tl[g],p,t,this.salty?this.aw[g]:1),h*(1-m)*x)}if(d===pt){const x=this.ysat(r.T[g],p,t);return m>x||r.film[g]>0&&m<x?(this.yb=x,h*(1-m)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let c=Math.abs(s);c=Math.min(c,n.mg[z*i+r]);const l=n.mg[it*i+a],u=n.mg[rt*i+a],f=l+u,h=Math.min(c,f);if(c<=0)return;const g=this.hvC[r];if(n.mg[z*i+r]-=c,n.mg[z*i+a]+=c,n.Hg[r]-=c*g,n.Hg[a]+=c*g,h>0){const d=h*l/f,m=h-d;n.mg[it*i+a]-=d,n.mg[rt*i+a]-=m,n.mg[it*i+r]+=d,n.mg[rt*i+r]+=m;const p=d*this.hnC[a]+m*this.hoC[a];n.Hg[a]-=p,n.Hg[r]+=p}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[it*i+t]+n.mg[rt*i+t],c=Math.min(e,a);if(n.mg[z*i+t]+=e,n.Hg[t]+=e*mt(r),c>0){const l=c*n.mg[it*i+t]/a,u=c-l;n.mg[it*i+t]-=l,n.mg[rt*i+t]-=u;const f=l*Yt(it,n.T[t])+u*Yt(rt,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=c,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*mt(r)}else if(e<0){const a=Math.min(-e,n.mg[z*i+t]),c=s.ambientY[it],l=s.ambientY[rt],u=c+l>0?c+l:1;n.mg[z*i+t]-=a,n.Hg[t]-=a*mt(n.T[t]);const f=a*c/u,h=a-f;n.mg[it*i+t]+=f,n.mg[rt*i+t]+=h;const g=f*Yt(it,r)+h*Yt(rt,r);n.Hg[t]+=g,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*mt(n.T[t])-g}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,c=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<c)continue;const u=l%n,f=(l-u)/n,g=[u>0?l-1:-1,u<n-1?l+1:-1,f+1<i?l+n:-1,f>0?l-n:-1].find(F=>F>=0&&a[F]===U);if(g===void 0)continue;const d=g%n,m=(g-d)/n,p=(d+.5+.25*Math.sign(u-d))*t.dx,x=(m+.5+.25*Math.sign(f-m))*t.dx,w=t.T[l],b=e.add(p,x,c,yt(w),ft);b<0||(t.film[l]-=c,t.Es[l]-=c*yt(w),s.placeParticle(b),s.dVp[b]=c/e.rho[b])}}}function Mo(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(Jt.length);let r=0,a=0,c=0;for(let l=0;l<e.count;l+=1)for(let u=0;u<9;u+=1){const f=s.wt[9*l+u];if(f===0)continue;const h=s.bi[l]+u%3,g=s.bj[l]+(u/3|0);if(h<0||g<0||h>=n.nx||g>=n.ny||h+g*n.nx!==t)continue;i[e.mat[l]]+=f*e.mass[l],r+=f*e.mass[l];const d=e.smass[2*l];d>0?(a+=f*d,c+=f*(e.mass[l]-d)):e.mat[l]===0&&(c+=f*e.mass[l])}return{m:i,all:r,salt:a,water:c}}function ja(o,t){const{m:e,all:s}=Mo(o,t);if(s<=0)return[];const n=[];for(let i=0;i<Jt.length;i+=1)e[i]>0&&n.push({id:Jt[i].id,share:e[i]/s});return n}function Ra(o,t,e){var L;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===pt?"solid":s.kind[n]===ut?"liquid":"gas",a=o.pressureAt(n);let c=0;const l=[0,0,0];for(let C=0;C<gt;C+=1)l[C]=s.mg[C*i+n]/ht[C],c+=l[C];for(let C=0;C<gt;C+=1)l[C]=c>0?l[C]/c:0;const u=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?l[z]*a:0,h=Math.floor(t/s.dx),g=Math.floor(e/s.dx),d=r==="liquid"?.5*(s.ul[h+g*(s.nx+1)]+s.ul[h+1+g*(s.nx+1)]):.5*(s.ug[h+g*(s.nx+1)]+s.ug[h+1+g*(s.nx+1)]),m=r==="liquid"?.5*(s.vl[h+g*s.nx]+s.vl[h+(g+1)*s.nx]):.5*(s.vg[h+g*s.nx]+s.vg[h+(g+1)*s.nx]),p=o.particles;let x=-1,w=(1.5*s.dx)**2;for(let C=0;C<p.count;C+=1){const B=(p.x[C]-t)**2+(p.y[C]-e)**2;B<w&&(w=B,x=C)}const b=o.bubbles;let F=-1,y=1/0;for(let C=0;C<b.count;C+=1){const B=Math.hypot(b.x[C]-t,b.y[C]-e);B<=Math.max(b.r[C],3*s.dx)&&B<y&&(F=C,y=B)}const A=Mo(o,n),P=[];if(A.all>0)for(let C=0;C<Jt.length;C+=1)A.m[C]>0&&P.push({id:Jt[C].id,share:A.m[C]/A.all});let _=null;if(r==="liquid"&&A.salt>0&&A.water>0){const C=A.salt/(A.water*Es);_={w:A.salt/(A.salt+A.water),molality:C,Tb:wo(a,C),Tf:Zc(C)}}const T=r==="gas"?o.gas.rho[n]:r==="liquid"?_!==null&&!o.phase.mixed?Ri(u,_.w):o.phase.mixed?We(o.phase.host[n],u):o.liquid.rhoRef:s.solid[n]!==0?qt[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?qt[s.solid[n]-1].id:null,T:u,p:a,Tsat:wt(a),x:l,rh:r==="gas"?f/Mn(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:T,phi:s.phi[n],u:d,v:m,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:P,salt:_},particle:x<0?null:{id:p.id[x],T:p.T[x],vx:p.vx[x],vy:p.vy[x],mass:p.mass[x],rho:p.rho[x],dist:Math.sqrt(w),liquid:((L=Jt[p.mat[x]])==null?void 0:L.id)??Jt[0].id,salt:p.saltFraction(x)},bubble:F<0?null:o.bubbleModel.describe(F)}}class qa{constructor(t){v(this,"g");v(this,"id");v(this,"count",0);v(this,"open",new Uint8Array(4));v(this,"vFluid",new Float64Array(4));v(this,"p0",new Float64Array(4));v(this,"rhoBar",new Float64Array(4));v(this,"vLiq",new Float64Array(4));v(this,"vBub",new Float64Array(4));v(this,"vGas",new Float64Array(4));v(this,"nSum",new Float64Array(4));v(this,"mSum",new Float64Array(4));v(this,"stack");v(this,"pAmb",101325);v(this,"rhoAmb",1.2);v(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n}=t;this.id.fill(-1);let i=0;for(let r=0;r<t.n;r+=1){if(n[r]!==0||this.id[r]!==-1)continue;this.grow(i);let a=0,c=0,l=0;for(this.stack[a++]=r,this.id[r]=i;a>0;){const u=this.stack[--a];l+=1;const f=u%e,h=(u-f)/e;(f===0&&t.openL||f===e-1&&t.openR||h===0&&t.openB||h===s-1&&t.openT)&&(c=1),f>0&&n[u-1]===0&&this.id[u-1]===-1&&(this.id[u-1]=i,this.stack[a++]=u-1),f<e-1&&n[u+1]===0&&this.id[u+1]===-1&&(this.id[u+1]=i,this.stack[a++]=u+1),h>0&&n[u-e]===0&&this.id[u-e]===-1&&(this.id[u-e]=i,this.stack[a++]=u-e),h<s-1&&n[u+e]===0&&this.id[u+e]===-1&&(this.id[u+e]=i,this.stack[a++]=u+e)}this.open[i]=c,this.vFluid[i]=l*t.vCell,i+=1}this.count=i}volumes(t,e){const s=this.g;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<gt;a+=1){const c=s.mg[a*n+i];this.mSum[r]+=c,this.nSum[r]+=c/ht[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let c=0;c<s;c+=1){if(this.id[c]!==t||e.kind[c]===pt)continue;let l=0;for(let u=0;u<gt;u+=1)l+=e.mg[u*s+c]/ht[u];n+=l*Lt*e.T[c]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let c=0;c<2;c+=1){let l=-i,u=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===pt)continue;let h=0;for(let m=0;m<gt;m+=1)h+=e.mg[m*s+f]/ht[m];const g=r-a*(e.dx*((f-f%e.nx)/e.nx+.5)),d=h*Lt*e.T[f];l+=d/g,u-=d/(g*g)}r-=l/u}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===U)return s;return-1}}class Ea{constructor(t){v(this,"e");v(this,"floor");v(this,"floorH");v(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)e+=t.crust[s];return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:c}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),u=Math.min(c-1,Math.max(0,Math.floor(e/r.dx))),f=l+u*a;if(r.solid[f]!==0){this.toSolid(f,s,n);return}const h=[u>0?f-a:-1,l>0?f-1:-1,l<a-1?f+1:-1,u<c-1?f+a:-1];for(const g of h)if(g>=0&&r.solid[g]!==0){this.toSolid(g,s,n);return}for(let g=u-2;g>=0;g-=1){const d=l+g*a;if(r.solid[d]!==0){this.toSolid(d,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=ea(r);if(n<=a*i*(1+1e-9))continue;const c=(n-a*i)/(1-a),l=c*Cn(r),u=i/t.rho[s],f=i*t.h[s]-l;t.mass[s]=i-c,t.smass[2*s]=n-c,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-u,this.deposit(t.x[s],t.y[s],c,l),this.crystallized+=c}}}const gi="recreatio/lab2d",Da={"very-high":.001,high:.002,medium:.003},Ia=o=>o==="very-high"||o==="high"||o==="medium",Va=16e4,vt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Mt=(o,t,e)=>Math.min(e,Math.max(t,o)),Ee=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},Ys=(o,t)=>o==="wall"||o==="open"?o:t,mr=.25*kn,$n=2*kn;function pr(o){const t={};let e=0;for(const[s,n]of Object.entries(Ee(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Na(o,t,e){const s=Ee(o),n=ot+vt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return nn(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Qs(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",c=pr(s.composition),l=h=>a==="gas"?h==="N2"||h==="O2"||h==="H2O":to(h)>=0||go(h)>=0,u={};for(const[h,g]of Object.entries(c))l(h)?u[h]=g:t.push(`ops[${e}]: unknown ${a} "${h}" dropped`);const f=Object.keys(u).length>0?pr(u):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:f}}case"erase":{const r=Qs(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Qs(s.region);if(r===null)break;return{op:"move",region:r,dx:Mt(vt(s.dx,0),-1,1),dy:Mt(vt(s.dy,0),-1,1)}}case"solid":{const r=Qs(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",x:vt(s.x,.1),y:vt(s.y,0),w:Mt(vt(s.w,.07),.01,1),h:Mt(vt(s.h,.09),.01,1),wall:Mt(vt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0};case"hotplate":return{op:"hotplate",x:vt(s.x,.1),y:vt(s.y,0),w:Mt(vt(s.w,.12),.005,1),h:Mt(vt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Mt(vt(s.power,40),0,2e3),target:ot+Mt(vt(s.target,150),0,600),on:s.on!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function Wn(o,t={}){const e=Ee(o),s=[];e.format!==void 0&&e.format!==gi&&s.push(`format "${String(e.format)}" is not ${gi}`);const n=Ee(e.box),i=Ee(e.ambient),r=Ee(i.air),a=Ee(e.sides),c=vt(i.g,kn),l=t.harness===!0?Mt(c,0,$n):Mt(c,mr,$n);l!==c&&s.push(`ambient.g ${c} m/s² is outside ${mr.toFixed(2)}–${$n.toFixed(2)}, using ${l.toFixed(2)}`);const u=vt(r.N2,.7676),f=vt(r.O2,.2324),h=u+f>0?u+f:1,g=[];return Array.isArray(e.ops)&&e.ops.forEach((d,m)=>{const p=Na(d,s,m);p!==null&&g.push(p)}),{scene:{seed:Math.floor(vt(e.seed,1))>>>0,box:{w:Mt(vt(n.w,.2),.02,.6),h:Mt(vt(n.h,.15),.02,.4),depth:Mt(vt(n.depth,.01),.002,.05)},ambient:{p:Mt(vt(i.p,Cs/1e3),20,400)*1e3,T:ot+Mt(vt(i.T,20),-20,100),rh:Mt(vt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,u)/h,O2:Math.max(0,f)/h}},sides:{left:Ys(a.left,"wall"),right:Ys(a.right,"wall"),bottom:Ys(a.bottom,"wall"),top:Ys(a.top,"open")},quality:Ia(e.quality)?e.quality:"high",ops:g},warnings:s}}const ce=(o,t=6)=>Number(o.toFixed(t));function Ga(o){switch(o.op){case"fill":return{op:"fill",region:Xs(o.region),composition:{...o.composition},phase:o.phase,T:ce(o.T-ot,3)};case"erase":return{op:"erase",region:Xs(o.region)};case"move":return{op:"move",region:Xs(o.region),dx:ce(o.dx),dy:ce(o.dy)};case"solid":return{op:"solid",region:Xs(o.region),material:o.material,T:ce(o.T-ot,3)};case"beaker":return{op:"beaker",x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:ce(o.T-ot,3),...o.lid?{lid:!0}:{}};case"hotplate":return{op:"hotplate",x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:ce(o.target-ot,3),on:o.on,T:ce(o.T-ot,3)}}}function Ua(o){return{format:gi,version:1,seed:o.seed,box:{...o.box},ambient:{p:ce(o.ambient.p/1e3,4),T:ce(o.ambient.T-ot,3),rh:o.ambient.rh,g:ce(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,ops:o.ops.map(Ga)}}const Ha=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics"],Ve=Ha.length,gr=1/120;class $a{constructor(t,e={}){v(this,"scene");v(this,"options");v(this,"warnings",[]);v(this,"grid");v(this,"particles");v(this,"bubbles");v(this,"liquid");v(this,"gas");v(this,"regions");v(this,"heat");v(this,"bubbleModel");v(this,"phase");v(this,"salt");v(this,"solver");v(this,"prevKind");v(this,"p0Start",new Float64Array(8));v(this,"rng");v(this,"time",0);v(this,"steps",0);v(this,"dt",gr);v(this,"gy",9.81);v(this,"ambientY",new Float64Array(lt));v(this,"ambientT",293.15);v(this,"pRef",101325);v(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});v(this,"flows",rr());v(this,"snap",qc());v(this,"energy0",0);v(this,"water0",0);v(this,"other0",0);v(this,"salt0",0);v(this,"cappedCount",0);v(this,"vapourRate",0);v(this,"vapourLast",0);v(this,"timings",new Float64Array(Ve));v(this,"stamp",new Float64Array(Ve+1));v(this,"stepMs",0);v(this,"quality","high");v(this,"heaterOps",new Map);this.options=e;const s=vr(t)?t:Wn(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??gr}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=Da[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>Va;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new ma(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new Ma(Math.max(4096,4*i.n+1024)),this.bubbles=new $o(4096),this.solver=new xt(s,n),this.regions=new qa(i),this.liquid=new ka(i,this.particles,this.solver),this.gas=new da(i,this.regions,this.solver),this.heat=new ga(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new Bc(this),this.phase=new Ba(this),this.salt=new Ea(this),this.prevKind=new Uint8Array(i.n),this.rng=new ho(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=rr(),this.heaterOps.clear(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=U,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites();for(const r of t.ops)this.apply(r);this.settle(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)t.solid[s]!==0&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,c=(i>0?i:pc)/a,l=(r>0||i>0?r:gc)/a,u=1/(c/ht[it]+l/ht[rt]),f=Math.min(.99,s*Mn(e)/t),h=f*ht[z]/(f*ht[z]+(1-f)*u);this.ambientY.fill(0),this.ambientY[it]=(1-h)*c,this.ambientY[rt]=(1-h)*l,this.ambientY[z]=h;let g=0;for(let d=0;d<gt;d+=1)g+=this.ambientY[d]/ht[d];this.regions.pAmb=t,this.regions.rhoAmb=t/(Lt*e*g),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0}apply(t){if(t.op==="fill"&&t.phase==="liquid"&&!this.surfaceAfterFill(t))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const e=this.regions.pvTerm(),s=aa(this.world(),t);return t.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,t]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-e,s!==null&&this.warnings.push(s),s}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let c=0;c<n;c+=1)for(let l=0;l<s;l+=1){const u=l+c*s;e.solid[u]===0&&(e.kind[u]===ut||ze(t.region,(l+.5)*e.dx,(c+.5)*e.dx))&&(i[u]=1)}const r=new Uint8Array(e.n),a=[];for(let c=0;c<e.n;c+=1){if(i[c]===0||r[c]!==0)continue;let l=!1;for(a.push(c),r[c]=1;a.length>0;){const u=a.pop(),f=u%s,h=(u-f)/s,g=[f>0?u-1:-1,f<s-1?u+1:-1,h>0?u-s:-1,h<n-1?u+s:-1];(f===0&&e.openL||f===s-1&&e.openR||h===0&&e.openB||h===n-1&&e.openT)&&(l=!0);for(const d of g)if(!(d<0||e.solid[d]!==0)){if(i[d]===0){l=!0;continue}r[d]===0&&(r[d]=1,a.push(d))}}if(!l)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),c=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&c!==void 0&&c.op==="hotplate"){const l=[...this.scene.ops];l[a]={...c,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return Ua({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=vr(t)?t:Wn(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setQuality(t){const e=Wn(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,c=this.dt,l=this.stamp;l[0]=ue(),l[1]=ue(),e.splatVolumeChange(c),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let d=0;d<n.count;d+=1)this.p0Start[d]=n.p0[d];for(let d=0;d<t.n;d+=1)e.pGas[d]=t.kind[d]===U?n.pAt(d)-this.pRef:0;e.step(c,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=ue(),s.updateVolumes(),s.markFaces();const u=s.escaped[z]+s.escaped[gt],f=s.escaped[it]+s.escaped[rt],h=s.escaped[gt+1];s.transport(c),this.flows.escapedWater+=s.escaped[z]+s.escaped[gt]-u,this.flows.escapedAir+=s.escaped[it]+s.escaped[rt]-f,this.flows.escapedEnergy+=s.escaped[gt+1]-h,s.updateEos(),s.veosMid.set(s.veos),s.velocity(c,this.gy),s.sources(c),s.project(c,this.tol,this.maxIter),l[3]=ue(),this.bubbleModel.step(c),l[4]=ue(),this.phase.step(c),this.salt.step(),l[5]=ue(),i.step(c,1e-6,200),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=ue(),l[7]=ue(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let d=0;d<t.n;d+=1)s.srcV[d]=t.kind[d]===U?s.veos[d]-s.veosMid[d]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.time+=c,this.steps+=1,this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax),l[8]=ue();const g=this.steps<5?1:1/30;for(let d=0;d<Ve;d+=1)this.timings[d]+=g*(l[d+1]-l[d]-this.timings[d]);this.stepMs+=g*(l[Ve]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let c=0;c<e.count;c+=1)i.dp0[c]!==0&&(a=!0);if(a){for(let c=0;c<s.count;c+=1){const l=t.cellAt(s.x[c],s.y[c]),u=l<0?-1:e.id[l];if(u<0||i.dp0[u]===0)continue;const f=s.mass[c],h=f/s.rho[c];s.h[c]+=h*i.dp0[u]/f,s.derive(c),r.dVp[c]+=f/s.rho[c]-h}for(let c=0;c<n.count;c+=1){const l=t.cellAt(n.x[c],n.y[c]),u=l<0?-1:e.id[l];u>=0&&i.dp0[u]!==0&&(n.H[c]+=n.V[c]*i.dp0[u])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,Rc(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.particles.hasOther()||this.particles.hasSalt()||this.salt.crustMass()>0||this.salt.floorTotals().mass>0}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===ft&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==ft&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===ut?this.pRef+e.pl[t]:e.kind[t]===U?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return Ra(this,t,e)}liquidsAt(t){return ja(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let m=0;m<t.n;m+=1)t.kind[m]===ut?e+=1:t.kind[m]===U&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,c=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),l=r.water.total-this.water0-a.editWater,u=r.other.total-this.other0-a.editOther,f=r.salt.total-this.salt0-a.editSalt,h=this.phase.produced+this.bubbleModel.burstVapour,g=this.time-this.vapourLast;g>.2&&(this.vapourRate=(h-this.phase.producedMark)/g,this.phase.producedMark=h,this.vapourLast=this.time);const d=[];for(let m=0;m<this.regions.count;m+=1)d.push({p0:this.regions.p0[m],sealed:this.regions.open[m]===0,vGas:this.regions.vGas[m]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor,heaters:this.heat.heaters.filter(m=>m.cells>0).map(m=>({group:m.group,P:m.P,Tmean:m.Tmean,mode:m.mode,power:m.power,target:m.target,on:m.on})),regions:d,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:c,waterError:l,otherError:u,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy}}}const ue=()=>typeof performance<"u"?performance.now():Date.now();function vr(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class Lo{constructor(t){v(this,"g");v(this,"last",null);v(this,"latent0",0);v(this,"stored0",0);v(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=wt(t.cpu.regions.pAmb),i=oc(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},c=this.last;let l=0,u=0;if(c!==null&&a.t>c.t){const g=a.t-c.t,d=(a.heater-c.heater)/g,m=(a.solids-c.solids+a.SG-c.SG+a.lossS-c.lossS+a.LG-c.LG+a.sens-c.sens+a.bub-c.bub)/g;l=(a.vap-c.vap)/g,u=Math.max(0,(d-m)/i)}this.last=a;const f=this.vapour()*i,h=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=h),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:h-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:u}}}const ls={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},ds=16,H={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},Ne=96,xr=16,Wa=57,It={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},le=16,Ka={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},vi=8,jt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},re=8,za={TSUM:0,CELLS:1},xi=2,Qa={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Co=16,et={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},Kn=55,Re={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},zn=6,bi={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},Qn=13,pe={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},Xn=16,Xa={KNOWN:0,MARK:1,MARK2:2,GAS:3},br=4,Ya={F:0},Yn=1,Ja={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},yi=12,Gt=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),Za=[Gt("G_",ls),Gt("C_",H),Gt("R_",It),Gt("RA_",Ka),Gt("H_",jt),Gt("HA_",za),Gt("S_",Qa),Gt("F_",et),Gt("U_",Re),Gt("A_",bi),Gt("FF_",pe),Gt("FU_",Xa),Gt("AF_",Ya),Gt("BA_",Ja),`const RACC_STRIDE: u32 = ${vi}u;`,`const HEAT_STRIDE: u32 = ${re}u;`,`const HACC_STRIDE: u32 = ${xi}u;`,`const CGS_STRIDE: u32 = ${Co}u;`,`const BACC_STRIDE: u32 = ${yi}u;`].join(`
`);function nt(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Et=o=>o.map(nt).join(", "),Tt=_t.species[0],Js=_t.species[1],Zs=_t.species[2],Ge=Tt.liquid.cp.table,be=Ge.map(o=>o[0]),$e=Ge.map(o=>o[1]),Pn=[$e[0]*(be[0]-ot)];for(let o=1;o<Ge.length;o+=1)Pn.push(Pn[o-1]+.5*($e[o]+$e[o-1])*(be[o]-be[o-1]));const[tl,el,sl]=Tt.vapour.cp.linear,wi=ot+100,nl=(()=>{let o=0;for(;o<be.length-2&&wi>=be[o+1];)o+=1;const t=wi-be[o],e=($e[o+1]-$e[o])/(be[o+1]-be[o]);return Pn[o]+$e[o]*t+.5*e*t*t})(),il=nl+Tt.saturation.hlv100.v,he=_t.solids,Jn=4294967295,rl=`
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
}`,yr=44,ol=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,Je=26,cl=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Ze=29,al=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Zn=8,ll=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,fl=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${nt(ot)};
const R_GAS: f32 = ${nt(Lt)};
const P_ATM: f32 = ${nt(Cs)};
const G0: f32 = ${nt(kn)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${nt(Js.molarMass.v)};
const M_O2: f32 = ${nt(Zs.molarMass.v)};
const M_H2O: f32 = ${nt(Tt.molarMass.v)};
const CP_N2: f32 = ${nt(Js.gas.cp.v)};
const CP_O2: f32 = ${nt(Zs.gas.cp.v)};
const CPV0: f32 = ${nt(tl)};
const CPV1: f32 = ${nt(el)};
const CPV_T: f32 = ${nt(sl)};
const T100: f32 = ${nt(wi)};
const HV100: f32 = ${nt(il)};
const NCP: i32 = ${Ge.length};
const CP_T = array<f32, ${Ge.length}>(${Et(be)});
const CP_V = array<f32, ${Ge.length}>(${Et($e)});
const CP_H = array<f32, ${Ge.length}>(${Et(Pn)});
const KELL = array<f32, 7>(${Et(Tt.liquid.kell.c)});
const KL = array<f32, 3>(${Et(Tt.liquid.k.poly)});
const VA: f32 = ${nt(Tt.liquid.mu.vogel[0])};
const VB: f32 = ${nt(Tt.liquid.mu.vogel[1])};
const VC: f32 = ${nt(Tt.liquid.mu.vogel[2])};
const ST_B: f32 = ${nt(Tt.surfaceTension.B)};
const ST_b: f32 = ${nt(Tt.surfaceTension.b)};
const ST_MU: f32 = ${nt(Tt.surfaceTension.mu)};
const T_CRIT: f32 = ${nt(Tt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${nt(Tt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Et(Tt.saturation.if97.n)});
const RVC = array<f32, 6>(${Et(Tt.saturation.vapourDensity.c)});
const KV: f32 = ${nt(Tt.vapour.k.v)};
const MUV: f32 = ${nt(Tt.vapour.mu.v)};
const KN = array<f32, 3>(${Et(Js.gas.k.power)});
const KO = array<f32, 3>(${Et(Zs.gas.k.power)});
const MN = array<f32, 3>(${Et(Js.gas.mu.sutherland)});
const MO = array<f32, 3>(${Et(Zs.gas.mu.sutherland)});
const DV0: f32 = ${nt(_t.vapourInAir.D0.v)};
const DVT0: f32 = ${nt(_t.vapourInAir.T0.v)};
const DVE: f32 = ${nt(_t.vapourInAir.exponent.v)};
const NSOL: u32 = ${he.length}u;
const S_RHO = array<f32, ${he.length}>(${Et(he.map(o=>o.rho.v))});
const S_CP = array<f32, ${he.length}>(${Et(he.map(o=>o.cp.v))});
const S_K = array<f32, ${he.length}>(${Et(he.map(o=>o.k.v))});
const S_THETA = array<f32, ${he.length}>(${Et(he.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${nt(uo)};
const REG_STRIDE: u32 = ${le}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${nt(Jr)};
`,ul=`
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
`,hl=`
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
`,Ni=[rl,ol,cl,al,ll,fl,Za,ul,hl].join(`
`);class dl{constructor(t){v(this,"name");v(this,"binds");v(this,"wg");v(this,"source");v(this,"pipeline",null);v(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=pl(t.bind),this.source=xl(t,this.binds,this.wg)}}const ml={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function pl(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":ml[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const gl=`
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
`,vl=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function xl(o,t,e){const s=[Ni,`const WG: u32 = ${e}u;`,gl],n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of vl)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
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
`)}class Gi{constructor(t){v(this,"device");v(this,"kernels",new Map);v(this,"timestamps");v(this,"bufs",[]);v(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new Gi(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new dl(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const u of a)e.push(`${s.name}:${u.lineNum}:${u.linePos} ${u.message}
    ${l[u.lineNum-1]??""}`);return}const c=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,u)=>l.mode==="t"?{binding:u,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:u,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:u,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:u,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=c;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const wr=64,Fr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ls=`
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
`,Oo=`
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
`,bl=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,yl=`
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
`,wl=[{name:"bubNucleate",wg:wr,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Ls}
${Fr} {
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
}`},{name:"bubAdvance",wg:wr,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Ls}
${Oo}
${bl}
${yl}
${Fr} {
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
}`}],ts=64,Pe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Fl=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,_l=[{name:"bubTarget",wg:ts,bind:"P:u cnt:a bubs:r btarget:w",code:`${Pe} {
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
}`},{name:"bubMerge",wg:ts,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Pe} {
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
}`},{name:"bubMergeFinal",wg:ts,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ls}
${Pe} {
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
}`},{name:"bubFinish",wg:ts,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Ls}
${Oo}
${Fl}
${Pe} {
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
${Pe} {
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
}`},{name:"bubCopyBack",wg:ts,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Pe} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:ts,bind:"P:u cnt:a bubs:r at:a",code:`${Ls}
${Pe} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Pe} {
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
}`}],ge=128,ne="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",An=`
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
`,_r=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,ti=`
var<workgroup> rr: array<f32, ${16*ge}>;
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
`,Pl=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:ge,bind:"P:u cf:w cu:r at:w reg:r",code:`${An}
${ne} {
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
}`})),{name:"transitions",wg:ge,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${ne} {
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
}`},{name:"regCells",wg:ge,bind:"P:u cf:r cu:r racc:a",code:`${ti}
${ne} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${ti}
${ne} {
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
}`},{name:"regBubs",wg:ge,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${ne} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${_r}
${ne} {
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
}`})),{name:"compSums",wg:ge,bind:"P:u cf:r cu:r reg:r racc:a",code:`${ti}
${ne} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${_r}
${ne} {
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
}`})),{name:"compApply",wg:ge,bind:"P:u cf:w cu:r reg:r",code:`${An}
${ne} {
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
}`},{name:"gasVolumes",wg:ge,bind:"P:u cf:w cu:r reg:r",code:`${ne} {
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
}`},{name:"markFaces",wg:ge,bind:"P:u cu:r ff:w fu:w",code:`${ne} {
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
}`}],tn=128,Oe=128,$t="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ee=`
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
`,Pr=`
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
`,Al=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Ar=1,Tl=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${$t} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Ar}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${$t} {
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
${$t} {
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
    pargs[0] = max(1u, (total + ${tn-1}u) / ${tn}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${$t} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:Oe,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ee}
${Al}
${$t} {
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
}`},{name:"classify",wg:Oe,bind:"P:u cf:r cu:w",code:`${$t} {
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
}`},{name:"p2g",wg:Oe,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Pr}
${$t} {
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
}`},{name:"liqAssemble",wg:Oe,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${$t} {
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
    if (k == LIQUID) { mgF[L.ax + s] = a; } else if (k == GAS) { dDx += a; b += a * pGas(c + 1u); }
  } else if (P.openR != 0u) { dDx += 2.0 * a; }
  if (i > 0) {
    if (kindAt(i - 1, j) == GAS) { dDx += a; b += a * pGas(c - 1u); }
  } else if (P.openL != 0u) { dDx += 2.0 * a; }
  if (j + 1 < ny) {
    let k = kindAt(i, j + 1);
    if (k == LIQUID) { mgF[L.ay + s] = a; } else if (k == GAS) { dDy += a; b += a * pGas(c + P.nx); }
  } else if (P.openT != 0u) { dDy += 2.0 * a; }
  if (j > 0) {
    if (kindAt(i, j - 1) == GAS) { dDy += a; b += a * pGas(c - P.nx); }
  } else if (P.openB != 0u) { dDy += 2.0 * a; }
  mgF[L.dDx + s] = dDx;
  mgF[L.dDy + s] = dDy;
  cgv[P.n0 + s] = b;
}`},{name:"liqPressure",wg:Oe,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${$t} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:Oe,bind:"P:u glob:r cf:r ff:w fu:w",code:`${$t} {
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
    else { d = cf[o + i + j * nx] - cf[o + i - 1u + j * nx]; }
    ff[ffi(FF_UL, f)] -= k * d;
  } else {
    let g = f - P.nu;
    let i = g % nx;
    let j = g / nx;
    var d = 0.0;
    if (j == 0u) { d = 2.0 * cf[o + i]; }
    else if (j == P.ny) { d = -2.0 * cf[o + i + (P.ny - 1u) * nx]; }
    else { d = cf[o + i + j * nx] - cf[o + i + (j - 1u) * nx]; }
    ff[ffi(FF_UL, f)] -= k * d;
  }
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:Oe,bind:"P:u ff:w fu:w",code:`${$t} {
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
}`})),{name:"g2p",wg:tn,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${Pr}
${ee}
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
${$t} {
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
      q.flags = q.flags | ${Ar}u;
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
}`},{name:"heatWeights",wg:tn,bind:"P:u cnt:a cu:r parts:w",code:`${ee}
${$t} {
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
}`}],de=128,me="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Tr=`
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
`,Sr=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,kr=`
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
`,Sl=[{name:"gasMaxOut",wg:de,bind:"P:u cu:r ff:r cnt:a",code:`${ee}
${me} {
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
}`},{name:"gasFlux",wg:de,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Tr}
${Sr}
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
${me} {
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
}`},{name:"gasMove",wg:de,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Tr}
${Sr}
${ee}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${me} {
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
}`},{name:"macFwd",wg:de,bind:"P:u glob:r ff:w fu:r",code:`${kr}
${me} {
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
}`},{name:"macBack",wg:de,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${kr}
${me} {
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
}`},{name:"viscosity",wg:de,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${me} {
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
}`},{name:"gasAssemble",wg:de,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${me} {
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
}`},{name:"gasPressure",wg:de,bind:"P:u cf:w cu:r cgv:r",code:`${me} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:de,bind:"P:u glob:r cf:r ff:w fu:r",code:`${me} {
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
}`}],Wt=128,Kt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",fs=`
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
`,kl=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,Ml=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:Wt,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${fs}
${Kt} {
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
}`})),{name:"applyMass",wg:Wt,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${fs}
${ee}
${Kt} {
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
}`},{name:"diffPrep",wg:Wt,bind:"P:u cf:w cu:w reg:r",code:`${Kt} {
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
}`},{name:"diffAssemble",wg:Wt,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${kl}
${Kt} {
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
}`},{name:"diffFaces",wg:Wt,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Kt} {
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
}`},{name:"diffApply",wg:Wt,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ee}
${Kt} {
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
}`},{name:"latentSrc",wg:Wt,bind:"P:u glob:r cf:r at:a",code:`${Kt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:Wt,bind:"P:u cf:w cu:r reg:r",code:`${Kt} {
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
}`},{name:"flashVap",wg:Wt,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${fs}
${Kt} {
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
}`},{name:"flashParts",wg:Wt,bind:"P:u cnt:a cf:r parts:w",code:`${fs}
${Kt} {
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
}`},{name:"flashDist",wg:Wt,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ee}
${Kt} {
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
}`},{name:"fog",wg:Wt,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${An}
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
${Kt} {
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
}`},{name:"films",wg:Wt,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${Kt} {
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
}`}],cs=800,Ll=24,Mr=6,Ot=4,ms=16,Dt=256,Lr=`struct Levels { lv: array<Level, ${ms}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Is=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,un=`${Is}
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
`,xe=`
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
`,Be=`
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
`,Cr=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Or=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,bt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ae=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,Bo=6,es=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,ei=`
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
`,si="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Cl=[{name:"cgPrep1",wg:Dt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Is}
${bt} {
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
}`},{name:"cgPrep2",wg:Dt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Ae}
${un}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${Bo}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:Dt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:Dt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Ae}
${ei}
${es}
${bt} {
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
}`},{name:"cclProject",wg:Dt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ae}
${si}
${es}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Dt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Ae}
${Is}
${Be}
${bt} {
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
}`},{name:"cgFoldInitMG",wg:Dt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${Be}
${Or}
${bt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Ae}
${xe}
${Be}
${Cr}
${bt} {
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
}`},{name:"cgB",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Ae}
${xe}
${Be}
${Cr}
var<workgroup> wpq: f32;
${bt} {
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
}`},{name:"cgFoldRR",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${xe}
${Be}
${Or}
${bt} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${xe}
${Be}
${bt} {
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
}`},{name:"cgZSum",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${xe}
${ei}
${es}
${bt} {
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
}`},{name:"cgZSub",wg:Dt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${xe}
${si}
${es}
${Be}
${bt} {
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
}`},{name:"cgEnd1",wg:Dt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Ae}
${ei}
${es}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${bt} {
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
}`},{name:"cgEnd2",wg:Dt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Ae}
${si}
${es}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Ol=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Bl(o,t){const e=[];let s=0,n=0,i=o,r=t,a=1,c=0;for(;;){const u=i+2,f=(i+2)*(r+2),h={};for(const m of Ol)h[m]=s,s+=f;const g=n;n+=f;let d=0;if(h.pW=0,e.length>0&&(h.pW=s,s+=4*c,d=n,n+=4*c),e.push({nx:i,ny:r,stride:u,size:f,h:a,f:h,act:g,pIdx:d}),i*r<=Ll||i<=2&&r<=2||e.length>=ms)break;c=f,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let u=0;u<e.length;u+=1){let f=0;for(let h=u;h<e.length;h+=1)f+=e[h].size;if(f<=cs){l=u;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function en(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const jo={tol:1e-5,it:H.IT_L,cap:H.CAP_L,res:H.RES_L},Ro={tol:1e-5,it:H.IT_G,cap:H.CAP_G,res:H.RES_G},qo={tol:1e-5,it:H.IT_H,cap:H.CAP_H,res:H.RES_H},Eo={tol:1e-5,it:H.IT_D,cap:H.CAP_D,res:H.RES_H},ss=200,ie=256;class jl{constructor(t,e,s){v(this,"ctx");v(this,"plan");v(this,"b");v(this,"l0");v(this,"lp");v(this,"lv");v(this,"it");v(this,"cfg");v(this,"kinds",[]);v(this,"groups",new Map);v(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);en(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(ie/4*n.length);for(let l=0;l<n.length;l+=1)en(l>0?n[l-1]:null,l-1,r,ie/4*l),en(n[l],l,r,ie/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*ms+4);for(let l=0;l<n.length;l+=1)en(n[l],l,a,32*l);a[32*ms]=e.lt,a[32*ms+1]=n.length,this.lv=t.uniform("lv",a.buffer);const c=new Uint32Array(ie/4*(ss+1));for(let l=0;l<ss;l+=1)c[ie/4*l]=l;c[ie/4*ss]=4294967295,this.it=t.uniform("iter",c.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(ie*4));for(const l of[jo,Ro,qo,Eo])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,ie*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,ie*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:ie*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,ie)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,u)=>{const f={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,u,f),this.run(t,"cgZSub",r,u,f)):this.run(t,"cgRZ",r,u,f)};this.vcycle(t),a(ss,`k${ss}`);const c=Math.min(ss,Math.max(1,s));for(let l=0;l<c;l+=1){const u={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,u),this.run(t,"cgB",r,`k${l}`,u),this.one(t,"cgFoldRR",`k${l}`,u),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const ps=16,Br=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class Rl{constructor(t,e){v(this,"ctx");v(this,"d");v(this,"plan");v(this,"params");v(this,"glob");v(this,"cnt");v(this,"cf");v(this,"cu");v(this,"at");v(this,"ff");v(this,"fu");v(this,"af");v(this,"partsA");v(this,"partsB");v(this,"ccountA");v(this,"ccountB");v(this,"cstart");v(this,"bsum");v(this,"pkey");v(this,"pslot");v(this,"pargs");v(this,"bubs");v(this,"bubs2");v(this,"bacc");v(this,"btarget");v(this,"sites");v(this,"sbub");v(this,"reg");v(this,"racc");v(this,"heat");v(this,"hacc");v(this,"mgF");v(this,"mgU");v(this,"cgv");v(this,"cgs");v(this,"lab");v(this,"cfl");v(this,"csum");v(this,"cgp");v(this,"meas");v(this,"probe");v(this,"regionMap",new Int32Array(0));v(this,"regionInv",new Int32Array(0));v(this,"measGroups");v(this,"nsites",0);v(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=Bl(s.nx,s.ny);const r=(c,l,u=Br)=>{const f=t.buffer(c,4*Math.max(4,l),u);return this.own.push(f),f};this.params=r("params",yr,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",ds),this.cnt=r("cnt",Ne),this.cf=r("cf",Kn*i.n),this.cu=r("cu",zn*i.n),this.at=r("at",Qn*i.n),this.ff=r("ff",Xn*i.nf),this.fu=r("fu",br*i.nf),this.af=r("af",Yn*i.nf),this.partsA=r("partsA",Je*i.pcap),this.partsB=r("partsB",Je*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,Br|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Ze*i.bcap),this.bubs2=r("bubs2",Ze*i.bcap),this.bacc=r("bacc",yi*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",Zn*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",le*i.nreg),this.racc=r("racc",vi*i.nreg),this.heat=r("heat",re*i.nheat),this.hacc=r("hacc",xi*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",Co),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",Bo*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",ps*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*yr),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[it],t.ambientY[rt],t.ambientY[z],wt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let c=0;for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]===0&&(c=1);i[40]=c,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t){const e=t.heat.heaters,s=new Float32Array(re*this.d.nheat);e.forEach((n,i)=>{const r=re*i;s[r+jt.MODE]=n.mode==="thermostat"?1:0,s[r+jt.POWER]=n.power,s[r+jt.TARGET]=n.target,s[r+jt.ON]=n.on?1:0,s[r+jt.P]=n.P,s[r+jt.TMEAN]=n.Tmean,s[r+jt.INTEGRAL]=n.integral,s[r+jt.CELLS]=n.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,s)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*re*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n;this.writeParams(t),this.writeHeaters(t);const r=t.regions,a=Array.from({length:r.count},(M,N)=>N).sort((M,N)=>r.vFluid[N]-r.vFluid[M]);this.regionMap=new Int32Array(Math.max(1,r.count)),this.regionInv=new Int32Array(Math.max(1,r.count)),a.forEach((M,N)=>{this.regionMap[M]=N,this.regionInv[N]=M});const c=new Float32Array(le*s.nreg);for(let M=0;M<r.count;M+=1){const N=le*this.regionMap[M];c[N+It.OPEN]=r.open[M],c[N+It.VFLUID]=r.vFluid[M],c[N+It.P0]=r.p0[M],c[N+It.RHOBAR]=r.rhoBar[M],c[N+It.VLIQ]=r.vLiq[M],c[N+It.VBUB]=r.vBub[M],c[N+It.VGAS]=r.vGas[M],c[N+It.P0START]=r.p0[M]}e.writeBuffer(this.reg,0,c);const l=new Uint32Array(zn*i);for(let M=0;M<i;M+=1){l[Re.KIND*i+M]=n.kind[M],l[Re.KPREV*i+M]=n.kind[M],l[Re.SOLID*i+M]=n.solid[M],l[Re.HGRP*i+M]=n.role[M]===1&&n.heater[M]>=0?n.heater[M]+1:0;const N=r.id[M];l[Re.RID*i+M]=N<0?Jn:this.regionMap[N]}e.writeBuffer(this.cu,0,l);const u=new Float32Array(Kn*i),f=(M,N,tt=0)=>{for(let Y=0;Y<i;Y+=1)u[M*i+Y]=N[tt+Y]};f(et.PHI,n.phi),f(et.ALPHA,n.alpha),f(et.ALPHAOLD,n.alpha),f(et.PL,n.pl),f(et.PG,n.pg),f(et.MN,n.mg,it*i),f(et.MO,n.mg,rt*i),f(et.MV,n.mg,z*i),f(et.MF,n.mfog),f(et.HG,n.Hg),f(et.ES,n.Es),f(et.FILM,n.film),f(et.T,n.T),f(et.TL,n.Tl),f(et.CL,n.Cl);const h=t.gas;f(et.VGAS,h.vgas),f(et.RHO,h.rho),f(et.NMOL,h.nmol),f(et.CAP,h.cap),f(et.MU,h.mu),f(et.VEOS,h.veos),f(et.SRCV,h.srcV),f(et.VEOSMID,h.veosMid),f(et.PHIS,n.phiS),f(et.SDF,n.sdf),f(et.PTL,n.T),e.writeBuffer(this.cf,0,u);const g=new Float32Array(Qn*i);for(let M=0;M<i;M+=1)g[bi.VOLSRC*i+M]=t.liquid.volSrc[M];e.writeBuffer(this.at,0,g);const d=s.nf,m=new Float32Array(Xn*d);for(let M=0;M<s.nu;M+=1)m[pe.UL*d+M]=n.ul[M],m[pe.UG*d+M]=n.ug[M];for(let M=0;M<s.nv;M+=1)m[pe.UL*d+s.nu+M]=n.vl[M],m[pe.UG*d+s.nu+M]=n.vg[M];e.writeBuffer(this.ff,0,m),e.writeBuffer(this.fu,0,new Uint32Array(br*d));const p=new Float32Array(Yn*d);for(let M=0;M<s.nu;M+=1)p[M]=t.liquid.fU[M];for(let M=0;M<s.nv;M+=1)p[s.nu+M]=t.liquid.fV[M];e.writeBuffer(this.af,0,p);const x=t.particles,w=t.liquid,b=new ArrayBuffer(4*Je*Math.max(1,x.count)),F=new Float32Array(b),y=new Uint32Array(b),A=new Int32Array(b);for(let M=0;M<x.count;M+=1){const N=Je*M;F.set([x.x[M],x.y[M],x.vx[M],x.vy[M],x.c00[M],x.c01[M],x.c10[M],x.c11[M],x.mass[M],x.h[M],x.T[M],x.rho[M],w.dVp[M]],N),y[N+13]=0,y[N+14]=x.id[M],A[N+15]=w.bi[M],A[N+16]=w.bj[M];for(let tt=0;tt<9;tt+=1)F[N+17+tt]=w.wt[9*M+tt]}x.count>0&&e.writeBuffer(this.partsA,0,b);const P=t.bubbles,_=t.bubbleModel.motionState,T=new ArrayBuffer(4*Ze*Math.max(1,P.count)),L=new Float32Array(T),C=new Uint32Array(T),B=new Int32Array(T);for(let M=0;M<P.count;M+=1){const N=Ze*M,tt=M*lt;L.set([P.x[M],P.y[M],P.z[M],P.vx[M],P.vy[M],P.m[tt+it],P.m[tt+rt],P.m[tt+z],P.H[M],P.age[M]],N),B[N+10]=P.site[M],L.set([P.r[M],P.V[M],P.pb[M],P.pv[M],P.Tb[M],P.dmdt[M],_.ux0[M],_.uy0[M]],N+11),C[N+19]=P.id[M],C[N+20]=1;for(let Y=0;Y<Xt;Y+=1)L[N+21+Y]=P.force[M*Xt+Y]}P.count>0&&e.writeBuffer(this.bubs,0,T);const Q=t.bubbleModel.cavities;this.nsites=Q.count;const O=new ArrayBuffer(4*Zn*s.nsites),W=new Uint32Array(O),j=new Float32Array(O);for(let M=0;M<Q.count;M+=1){const N=Zn*M;W.set([Q.cell[M],Q.fluid[M],Q.dir[M],0],N),j.set([Q.r[M],Q.s[M],Q.z[M],0],N+4)}e.writeBuffer(this.sites,0,O);const R=new Uint32Array(s.nsites);for(let M=0;M<Q.count;M+=1)R[M]=Q.bubble[M];e.writeBuffer(this.sbub,0,R);const E=new Float32Array(ds);E[ls.DT]=t.dt,E[ls.TIME]=t.time,E[ls.RHOREF]=w.rhoRef,e.writeBuffer(this.glob,0,E);const q=new Uint32Array(Ne),K=new Float32Array(q.buffer);q[H.PCOUNT]=x.count,q[H.PSORT]=x.count,q[H.BCOUNT]=P.count,q[H.NEXTID_B]=Math.max(1,P.nextFree),q[H.NEXTID_P]=Math.max(1,x.nextFree);const D=t.bubbleModel;q[H.WATCH]=D.watch>=0?D.watch:Jn,q[H.WATCH_FATE]=D.watchFate,D.firstSuperheat!==null&&(K[H.FIRST_SH]=D.firstSuperheat+1e3,q[H.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,q),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(yi*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(vi*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(xi*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(u=>Math.ceil(u.size/4)*4),n=s.reduce((u,f)=>u+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((u,f)=>{s[f]>0&&r.copyBufferToBuffer(u.buf,u.offset,i,a,s[f]),a+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const c=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const u of s)l.push(c.slice(a,a+u)),a+=u;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,c,l,u,f,h,g]=await this.read([{buf:this.cnt,offset:0,size:4*Ne},{buf:this.glob,offset:0,size:4*ds},{buf:this.cf,offset:0,size:4*Kn*s},{buf:this.cu,offset:0,size:4*zn*s},{buf:this.at,offset:0,size:4*Qn*s},{buf:this.ff,offset:0,size:4*Xn*e.nf},{buf:this.af,offset:0,size:4*Yn*e.nf},{buf:this.heat,offset:0,size:4*re*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*le*e.nreg}]),d=new Uint32Array(n),m=Math.min(e.pcap,d[H.PCOUNT]),p=Math.min(e.bcap,d[H.BCOUNT]),[x,w]=await this.read([{buf:this.partsA,offset:0,size:4*Je*Math.max(1,m)},{buf:this.bubs,offset:0,size:4*Ze*Math.max(1,p)}]),b=t.grid,F=new Float32Array(r),y=(k,I,G=0)=>{for(let J=0;J<s;J+=1)I[G+J]=F[k*s+J]};y(et.PHI,b.phi),y(et.ALPHA,b.alpha),y(et.PL,b.pl),y(et.PG,b.pg),y(et.MN,b.mg,it*s),y(et.MO,b.mg,rt*s),y(et.MV,b.mg,z*s),y(et.MF,b.mfog),y(et.HG,b.Hg),y(et.ES,b.Es),y(et.FILM,b.film),y(et.T,b.T),y(et.TL,b.Tl),y(et.CL,b.Cl);const A=t.gas;y(et.VGAS,A.vgas),y(et.RHO,A.rho),y(et.NMOL,A.nmol),y(et.CAP,A.cap),y(et.MU,A.mu),y(et.VEOS,A.veos),y(et.SRCV,A.srcV),y(et.VEOSMID,A.veosMid);const P=new Uint32Array(a);for(let k=0;k<s;k+=1)b.kind[k]=P[Re.KIND*s+k];const _=new Float32Array(c);for(let k=0;k<s;k+=1)t.liquid.volSrc[k]=_[bi.VOLSRC*s+k];const T=new Float32Array(l),L=new Float32Array(u),C=e.nf;for(let k=0;k<e.nu;k+=1)b.ul[k]=T[pe.UL*C+k],b.ug[k]=T[pe.UG*C+k],t.liquid.fU[k]=L[k];for(let k=0;k<e.nv;k+=1)b.vl[k]=T[pe.UL*C+e.nu+k],b.vg[k]=T[pe.UG*C+e.nu+k],t.liquid.fV[k]=L[e.nu+k];const B=t.particles,Q=t.liquid,O=new Float32Array(x),W=new Uint32Array(x),j=new Int32Array(x);let R=0,E=0;for(let k=0;k<m;k+=1){const I=Je*k;if(W[I+13]&1||!(O[I+8]>0))continue;const G=R;R+=1,B.x[G]=O[I],B.y[G]=O[I+1],B.vx[G]=O[I+2],B.vy[G]=O[I+3],B.c00[G]=O[I+4],B.c01[G]=O[I+5],B.c10[G]=O[I+6],B.c11[G]=O[I+7],B.mass[G]=O[I+8],B.h[G]=O[I+9],B.spc[2*G]=0,B.spc[2*G+1]=0,B.smass[2*G]=0,B.smass[2*G+1]=0,B.mat[G]=0,B.id[G]=W[I+14],B.id[G]>E&&(E=B.id[G]),Q.dVp[G]=O[I+12],Q.bi[G]=j[I+15],Q.bj[G]=j[I+16];for(let J=0;J<9;J+=1)Q.wt[9*G+J]=O[I+17+J];B.derive(G)}B.count=R,B.reserveIds(Math.max(d[H.NEXTID_P],E+1)),Q.weightsDirty=!0;const q=t.bubbles,K=t.bubbleModel.motionState,D=new Float32Array(w),M=new Uint32Array(w),N=new Int32Array(w);q.count=0;let tt=0;for(let k=0;k<p;k+=1){const I=Ze*k;if(M[I+20]===0)continue;const G=q.count;q.count+=1;const J=G*lt;q.x[G]=D[I],q.y[G]=D[I+1],q.z[G]=D[I+2],q.vx[G]=D[I+3],q.vy[G]=D[I+4];for(let at=0;at<lt;at+=1)q.m[J+at]=0;q.m[J+it]=D[I+5],q.m[J+rt]=D[I+6],q.m[J+z]=D[I+7],q.H[G]=D[I+8],q.age[G]=D[I+9],q.site[G]=N[I+10],q.r[G]=D[I+11],q.V[G]=D[I+12],q.pb[G]=D[I+13],q.pv[G]=D[I+14],q.Tb[G]=D[I+15],q.dmdt[G]=D[I+16],K.ux0[G]=D[I+17],K.uy0[G]=D[I+18],q.id[G]=M[I+19],q.id[G]>tt&&(tt=q.id[G]);for(let at=0;at<Xt;at+=1)q.force[G*Xt+at]=D[I+21+at]}q.reserveIds(Math.max(d[H.NEXTID_B],tt+1));const Y=t.bubbleModel.cavities,X=new Uint32Array(h);for(let k=0;k<Y.count;k+=1)Y.bubble[k]=X[k];const S=new Float32Array(g);for(let k=0;k<t.regions.count;k+=1){const I=le*this.regionMap[k];t.regions.p0[k]=S[I+It.P0],t.regions.rhoBar[k]=S[I+It.RHOBAR]}const $=new Float32Array(f);t.heat.heaters.forEach((k,I)=>{const G=re*I;k.P=$[G+jt.P],k.Tmean=$[G+jt.TMEAN],k.integral=$[G+jt.INTEGRAL]});const V=new Float32Array(i);t.dt=V[ls.DT];const st=t.bubbleModel;st.watch=d[H.WATCH]===Jn?-1:d[H.WATCH]}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const je=128,Ut="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ql=5,jr=30,Rr=`
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
`,El=[{name:"heaterSums",wg:je,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Ut} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Ut} {
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
        let kp = power / ${ql}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${jr}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${jr}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:je,bind:"P:u cnt:a parts:r",code:`${ee}
${Ut} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:je,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${fs}
${ee}
${Ut} {
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
}`},{name:"heatAssemble",wg:je,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Rr}
${Ut} {
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
}`},{name:"heatFlux",wg:je,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Rr}
${An}
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
${Ut} {
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
}`},{name:"heatParts",wg:je,bind:"P:u cnt:a cf:r parts:w",code:`${fs}
${Ut} {
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
}`},{name:"pwParts",wg:je,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Ut} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Ut} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Ut} {
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
${Ut} {
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
  if (lid < 8u) { meas[wid3.x * ${ps}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${4*256}>;
${Ut} {
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
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${ps}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Ut} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${ps}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Ut} {
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
}`}],ns=256,Dl=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:ns,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${un}
${bt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:ns,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${un}
${bt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:ns,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Lr}
${un}
${bt} {
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
}`},{name:"mgPost",wg:ns,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Is}
${xe}
const TILE: u32 = 16u;
const HALO: u32 = ${Ot}u;
const TS: u32 = ${16+2*Ot}u;
var<workgroup> sx: array<f32, ${(16+2*Ot)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Ot)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Ot)**2}>;
var<workgroup> say: array<f32, ${(16+2*Ot)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Ot)**2}>;
${bt} {
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
  for (var k = 0u; k < ${Ot}u; k++) {
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
}`},{name:"mgPreR",wg:ns,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Is}
${xe}
const TILE: u32 = 12u;
const HALO: u32 = ${Ot+2}u;
const TS: u32 = ${12+2*(Ot+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Ot+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Ot+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Ot+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Ot+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Ot+2))**2}>;
${bt} {
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
  for (var k = 0u; k < ${Ot}u; k++) {
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
}`},{name:"mgTail",wg:ns,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Lr}
${xe}
var<workgroup> tx: array<f32, ${cs}>;
var<workgroup> tb: array<f32, ${cs}>;
var<workgroup> tax: array<f32, ${cs}>;
var<workgroup> tay: array<f32, ${cs}>;
var<workgroup> tinv: array<f32, ${cs}>;
var<workgroup> toff: array<u32, ${ms}>;
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
${bt} {
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
  for (var k = 0u; k < ${Mr}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Mr}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],sn=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Ui(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const oe=[0,120],is=128,rs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Il=.006,Vl={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},Nl=4*1e3*15e-7/(3*2*.07),Hi=`
const VIR = array<vec3<f32>, ${sn.length}>(${sn.map(o=>`vec3<f32>(${nt(o[0]/255)}, ${nt(o[1]/255)}, ${nt(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${nt(sn.length-1)};
  let i = min(u32(floor(x)), ${sn.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,ni="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",Gl=[{name:"rScale",wg:is,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${ni}
var<workgroup> m4: array<vec4<f32>, WG>;
${rs} {
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
}`},{name:"rCells",wg:is,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${ni}
${Hi}
const SOLID_RGB = array<vec3<f32>, ${qt.length}>(${qt.map(o=>{const t=Ui(o.color);return`vec3<f32>(${nt(t[0]/255)}, ${nt(t[1]/255)}, ${nt(t[2]/255)})`}).join(", ")});
${rs} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${nt(oe[0])};
  let tspan = ${nt(oe[1]-oe[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${qt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${nt(Nl)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:is,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${rs} {
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
}`},{name:"rLiqBlurX",wg:is,bind:"P:u lq:r lq2:w",code:`${rs} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:is,bind:"P:u lq2:r liquid:t",code:`${rs} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${nt(oe[0])}) / ${nt(oe[1]-oe[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:is,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${ni}
${rs} {
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
}`}],Ks=`
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
`,ii=`${Ks}
${Hi}
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
`,Ul=`${Ks}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Hl=`${Ks}
${(Ni.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
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
`,$l=`${Ks}
${Hi}
${(Ni.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
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
  o.t = clamp((parts[p].T - ${nt(273.15+oe[0])}) / ${nt(oe[1]-oe[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Wl=`${Ks}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,qr=48,ri=256,Kl=12;class zl{constructor(t,e){v(this,"gpu");v(this,"device");v(this,"context");v(this,"format");v(this,"rp");v(this,"ro");v(this,"sampLin");v(this,"sampNear");v(this,"pipes",{});v(this,"layouts",{});v(this,"size","");v(this,"cellsTex");v(this,"fieldTex");v(this,"liquidTex");v(this,"lq");v(this,"lq2");v(this,"arrows");v(this,"nArrows",0);v(this,"groups",new Map);v(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});v(this,"water",[.24,.56,.85]);v(this,"waterInk",[1,1,1]);v(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",ri*Kl,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=g=>t.createBindGroupLayout({entries:g});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(g,d,m,p,x=[])=>{const w=t.createShaderModule({code:g}),F=(await w.getCompilationInfo()).messages.filter(y=>y.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(y=>`${y.lineNum}:${y.linePos} ${y.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[m]}),vertex:{module:w,entryPoint:"vs",buffers:x},fragment:{module:w,entryPoint:d,targets:[{format:this.format,blend:e}]},primitive:{topology:p}})},[r,a,c,l,u,f,h]=await Promise.all([i(ii,"fsCells",this.layouts.quad,"triangle-strip"),i(ii,"fsField",this.layouts.quad,"triangle-strip"),i(ii,"fsLiquid",this.layouts.quad,"triangle-strip"),i(Ul,"fs",this.layouts.rect,"triangle-strip"),i(Hl,"fs",this.layouts.store,"triangle-strip"),i($l,"fs",this.layouts.store,"triangle-strip"),i(Wl,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:c,rect:l,disc:u,point:f,line:h}}ensure(){var u,f,h,g,d,m;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(p,x)=>s.createTexture({size:[p,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(u=this.cellsTex)==null||u.destroy(),(f=this.fieldTex)==null||f.destroy(),(h=this.liquidTex)==null||h.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(g=this.lq)==null||g.destroy(),(d=this.lq2)==null||d.destroy(),(m=this.arrows)==null||m.destroy(),this.lq=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(Il/this.gpu.cpu.grid.dx)),a=r>>1,c=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=c*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,c,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:ri*s,size:4*qr}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const c=this.gpu.state,l=this.gpu.ctx,u=this.device.queue;this.roData[0]=Vl[r],u.writeBuffer(this.ro,0,this.roData),t.clearBuffer(c.cnt,4*H.OV_PMAX,16);const f=t.beginComputePass(),h=c.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),h),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),h),a||(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*h),l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*h),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*h)),r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),f.end();const g=this.gpu.cpu.grid,d=(b,F,y)=>{const A=new Float32Array(qr),P=new Uint32Array(A.buffer);A.set([e.x0,e.y0,e.x1,e.y1,g.w,g.h,s,n],0),A.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),A.set(F,24),A.set(y,28),A[32]=r==="temperature"?1:0,A[33]=Math.max(1.5,.5*g.dx*s/(e.x1-e.x0)),P[34]=c.d.bcap,P[35]=c.d.pcap,u.writeBuffer(this.rp,ri*b,A)},m=.003;d(0,[0,0,g.w,g.h],[...this.theme.ground,1]),d(1,[0,0,0,0],[0,0,0,0]),d(2,[0,0,0,0],[...this.theme.ink,.85]),d(3,[0,0,0,0],[...this.waterInk,.9]);const p=[];i.left&&p.push([-m,-m,0,g.h+(i.top?m:0)]),i.right&&p.push([g.w,-m,g.w+m,g.h+(i.top?m:0)]),i.bottom&&p.push([-m,-m,g.w+m,0]),i.top&&p.push([-m,g.h,g.w+m,g.h+m]),p.forEach((b,F)=>d(4+F,b,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;x.setPipeline(w.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(w.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:c.partsA})),x.draw(4,c.d.pcap)):(x.setPipeline(w.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(w.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:c.bubs})),x.draw(4,c.d.bcap),x.setPipeline(w.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(w.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(w.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(w.rect),p.forEach((b,F)=>{x.setBindGroup(0,this.drawGroup(`d-wall${F}`,this.layouts.rect,4+F,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const Ql=[...Cl,...Dl,...Tl,...Pl,...Sl,...wl,..._l,...Ml,...El,...Gl],Er=[["heater",H.HEATER_E,"f"],["lossWalls",H.LOSS_WALLS,"f"],["lossOpen",H.LOSS_OPEN,"f"],["escapedEnergy",H.ESC_ENERGY,"f"],["escapedWater",H.ESC_WATER,"f"],["escapedAir",H.ESC_AIR,"f"],["produced",H.PRODUCED,"f"],["condensed",H.CONDENSED,"f"],["dew",H.DEW,"f"],["fogMade",H.FOGMADE,"f"],["burstVapour",H.BURSTVAP,"f"],["fluxSL",H.FLUX_SL,"f"],["fluxLG",H.FLUX_LG,"f"],["fluxSG",H.FLUX_SG,"f"],["lossSolids",H.LOSS_SOLIDS,"f"],["nucleated",H.NUCLEATED,"u"],["departed",H.DEPARTED,"u"],["merged",H.MERGED,"u"],["burst",H.BURST,"u"],["collapsed",H.COLLAPSED,"u"],["burstCold",H.BURST_COLD,"u"],["burstWarm",H.BURST_WARM,"u"],["collapsedCold",H.COLL_COLD,"u"],["collapsedWarm",H.COLL_WARM,"u"]],Dr=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),oi=256,os=2*Ve;class $i{constructor(t,e){v(this,"ctx");v(this,"cpu");v(this,"state");v(this,"solver");v(this,"sub");v(this,"groups",new Map);v(this,"stateVersion",0);v(this,"itL",16);v(this,"itG",18);v(this,"itH",8);v(this,"itD",6);v(this,"nsub",0);v(this,"totals",Dr());v(this,"last",null);v(this,"stepped",null);v(this,"energy0",null);v(this,"water0",null);v(this,"sealed",!1);v(this,"staging",[]);v(this,"busy",new Set);v(this,"reading",new Map);v(this,"querySet");v(this,"queryBuf");v(this,"vapourMark",0);v(this,"vapourLast",0);v(this,"vapourRate",0);v(this,"stageMs",new Array(Ve).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:os}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*os,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await Gi.create(),s=await e.compile(Ql);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new $i(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Rl(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new jl(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(oi/4*16);for(let n=0;n<16;n+=1)s[oi/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*H.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*H.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:oi*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,os,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);this.sort(n,1),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.cells(n,"liqAssemble"),this.solver.encodeMG(n,jo,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,Ro,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,Eo,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,qo,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*Ne,n=s+4*ds,i=n+4*le*t.d.nreg,r=i+4*re*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],c=r+4*ps*a,l=c+4*64,u=l+8*os;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:c,ts:l,total:u}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(c=>!this.busy.has(c)&&c.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*Ne),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*ds),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*le*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*re*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*os),t.clearBuffer(s.cnt,4*xr,4*(Wa-xr)),this.busy.add(i);const a=[];for(let c=0;c<this.cpu.regions.count;c+=1)a.push(s.gpuRegion(c));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,Ne),r=new Float32Array(t,n.cnt,Ne),a=new Float32Array(t,n.glob,ds),c=new Float32Array(t,n.reg,le*e.nreg),l=new Float32Array(t,n.heat,re*e.nheat),u=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[h,g,d]=e.groups,m=(y,A,P)=>{let _=0;for(let T=0;T<A;T+=1)_+=u[(y+T)*ps+P];return _},p=[];for(const y of e.regions){const A=le*y;p.push({p0:c[A+It.P0],sealed:c[A+It.OPEN]===0,vGas:c[A+It.VGAS],vFluid:c[A+It.VFLUID]})}const x=[];for(let y=0;y<e.heaters;y+=1){const A=re*y;x.push({P:l[A+jt.P],Tmean:l[A+jt.TMEAN],integral:l[A+jt.INTEGRAL],cells:l[A+jt.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const y=new BigUint64Array(t,n.ts,os);w=[];for(let A=0;A<Ve;A+=1){const P=y[2*A],_=y[2*A+1];w.push(_>P&&P>0n?Number(_-P)/1e6:0)}}const b=r[H.SUM_WM],F={};for(const[y,A,P]of Er)F[y]=P==="f"?r[A]:i[A];return{intervals:F,ov:[r[H.OV_PMAX],r[H.OV_VMAX],r[H.OV_VLIQ]],pcount:i[H.PCOUNT],bcount:i[H.BCOUNT],dt:a[ls.DT],stepsSince:i[H.STEPS],simSince:r[H.SIMTIME],itL:i[H.IT_L],itG:i[H.IT_G],itH:i[H.IT_H],itD:i[H.IT_D],capL:i[H.CAP_L],capG:i[H.CAP_G],capH:i[H.CAP_H],capD:i[H.CAP_D],resL:r[H.RES_L],resG:r[H.RES_G],resH:r[H.RES_H],nsub:i[H.NSUBMAX],uMaxG:r[H.UMAXG],waterMass:b,waterT:b>0?r[H.SUM_WMT]/b:0,waterTmax:r[H.TMAX],solids:m(0,h,0),film:m(0,h,1),gas:m(0,h,2),vapour:m(0,h,3),fog:m(0,h,4),air:m(0,h,5),liquidCells:Math.round(m(0,h,6)),gasCells:Math.round(m(0,h,7)),liquidH:m(h,g,0),liquidMass:m(h,g,1),sensible:m(h,g,3),bubH:m(h+g,d,0),bubWater:m(h+g,d,1),bubAir:m(h+g,d,2),regions:p,heaters:x,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[H.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[H.FIRST_SH]!==0?r[H.FIRST_SH]-1e3:null,stageMs:w}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of Er)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(n,i,r,a,c,l)=>{if(i===0&&r===0)return n;const u=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(c,Math.max(a,n>u?Math.max(u,n-2):u))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:0,editOther:e.ledger.other,escapedSalt:0,editSalt:e.ledger.salt},c=this.energy0??r.energy,l=this.water0??r.water.total,u=r.energy-c-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),f=r.water.total-l-a.editWater,h=i.produced+i.burstVapour,g=i.time-this.vapourLast;g>.2&&(this.vapourRate=(h-this.vapourMark)/g,this.vapourMark=h,this.vapourLast=i.time);const d=e.heat.heaters.map((x,w)=>({h:x,k:w,rd:n==null?void 0:n.heaters[w]})).filter(({rd:x,h:w})=>((x==null?void 0:x.cells)??w.cells)>0).map(({h:x,rd:w})=>({group:x.group,P:(w==null?void 0:w.P)??x.P,Tmean:(w==null?void 0:w.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),m=(x,w,b)=>({iterations:x,residual:w,capped:b>0}),p=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:m((p==null?void 0:p.itL)??0,(p==null?void 0:p.resL)??0,(p==null?void 0:p.capL)??0),gas:m((p==null?void 0:p.itG)??0,(p==null?void 0:p.resG)??0,(p==null?void 0:p.capG)??0),heat:m((p==null?void 0:p.itH)??0,(p==null?void 0:p.resH)??0,(p==null?void 0:p.capH)??0),gasSubsteps:(p==null?void 0:p.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:0,otherT:0,saltMass:0,saltSolid:0,heaters:d,regions:((n==null?void 0:n.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:a,energyError:u,waterError:f,otherError:0,saltError:0,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy}}budget(){const t=this.last,e=this.totals;let s=0;for(const l of(t==null?void 0:t.regions)??[])l.sealed&&(s-=l.p0*l.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,c={liquid:(t==null?void 0:t.liquidMass)??0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:c,other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0},air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,Dr()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return wt(this.cpu.regions.pAmb)}}const Xl=.3;qt.map(o=>Ui(o.color));var $r;Ui((($r=po[0])==null?void 0:$r.color)??"#f4f3ee");function Yl(o,t,e,s,n){const i=-n,r=-n,a=o+2*n,c=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/c>l){const f=a/l;return{x0:i,y0:r-(f-c)/2,x1:i+a,y1:r-(f-c)/2+f}}const u=c*l;return{x0:i-(u-a)/2,y0:r,x1:i-(u-a)/2+u,y1:r+c}}const bs=self,St=o=>bs.postMessage(o),Ir=8,Jl=.1,Zl=3,Vr=200,tf=.25,Nr=273.15;let ct=null,Z=null,Le=null,Tn=null,we=null,gs="",hn=1,dn=1,mn=1,ys={x0:0,y0:0,x1:1,y1:1},ws={left:!0,right:!0,bottom:!0,top:!1},Vs=!1,Fi=1,De="none",Do=!1,Ie=0,vs=0,_i=0,ci=0,ai=!1,Ns=0,Gr=0,Pi=0,Ai=0,Ur=!1,Ti=0,us=null;const qe=[],Si=[];let Sn=!1;const xs=[];function Wi(){if(ct===null)return;const o=ct.scene.sides;ws={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function Ki(o,t,e){hn=Math.max(1,o),dn=Math.max(1,t),mn=Math.max(.5,Math.min(3,e)),we!==null&&(we.width=Math.round(hn*mn),we.height=Math.round(dn*mn)),ct!==null&&(ys=Yl(ct.boxW,ct.boxH,hn,dn,.006))}function Io(o){Le!==null&&(Le.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function as(o){Si.push(o),Sn||ef()}async function ef(){if(Z!==null){Sn=!0;try{for(;Si.length>0;){const o=Si.shift();await Z.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){St({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{Sn=!1,vs=performance.now()}}}async function ki(){if(Z===null)return;const o=Z.ctx.device.createCommandEncoder(),t=Z.encodeReadback(o,!1);Z.ctx.device.queue.submit([o.finish()]),t!==null&&await Z.finishReadback(t,!1),Z.baselineFromLast()}function zi(){return ct===null||!ct.needsCpu()?!1:(St({type:"gpu",ok:!1,adapter:gs,message:"other-liquid",scene:ct.serialize()}),!0)}function Qi(o){Z!==null&&Le!==null&&Z.stateVersion!==o&&Le.reset()}function li(){as(async()=>{if(Z===null||ct===null||xs.length===0)return;const o=xs.splice(0,xs.length);await ki(),await Z.download();for(const e of o){const s=ct.apply(e);s!==null&&s.startsWith("refused")&&St({type:"refused",message:s})}if(zi())return;const t=Z.stateVersion;Z.upload(),Qi(t)})}function sf(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(De==="temperature")return[Nr+oe[0],Nr+oe[1],e];if(De==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return De==="velocity"?[0,Math.max(.02,t[1]),e]:De==="vapour"?[0,.6,e]:De==="salt"?[0,Xl,e]:[0,1,e]}function nf(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return us={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:wt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},us}return us!==null&&(t.fate===1||t.fate===2)?{...us,fate:t.fate===1?"burst":"collapsed"}:null}function rf(o,t){if(Z===null||Tn===null)return;if(Z.baselineFromLast(),Z.totals.time>=Ti){const i=Tn.sample();i!==null&&(qe.push(i),qe.length>400&&qe.splice(0,qe.length-400),Ti=Z.totals.time+tf)}const e=Math.max(.001,(t-Ns)/1e3),s=(o.stageMs??Z.stageMs).reduce((i,r)=>i+r,0),n={engine:Z.stats(s),stepsPerSecond:Ai/e,simRate:(Z.totals.time-Gr)/e,fps:Pi/e,renderMs:0,mode:"gpu",adapter:gs,paused:Vs,samples:qe.splice(0,qe.length),bubble:nf(o),overlayScale:sf(o)};St({type:"stats",stats:n}),Pi=0,Ai=0,Gr=Z.totals.time,Ns=t}function Mi(){var t;const o=performance.now();if(Z!==null&&Le!==null&&we!==null&&ct!==null&&!Sn){const e=Z.ctx.device,s=vs===0?0:Math.min(.1,(o-vs)/1e3);vs=o;const n=((t=Z.last)==null?void 0:t.dt)??ct.dt;let i=0;Vs?(i=Math.min(Ir,_i),_i-=i,Ie=0):(Ie=Math.min(Ie+s*Fi,Jl*Math.max(1,Fi)),i=ci>=Zl?0:Math.min(Ir,Math.floor(Ie/Math.max(1e-5,n))),Ie-=i*n);const r=!ai&&o-Ns>Vr&&(i>0||Vs||o-Ns>4*Vr),a=e.createCommandEncoder();i>0&&Z.encodeSteps(a,i,r);const c=r?Z.encodeReadback(a,r&&i>0):null;if(Le.encode(a,ys,we.width,we.height,ws,De,Do),e.queue.submit([a.finish()]),ci+=1,e.queue.onSubmittedWorkDone().then(()=>{ci-=1}),Ai+=i,Pi+=1,c!==null){ai=!0;const l=i>0;Z.finishReadback(c,l).then(u=>{ai=!1,u!==null&&rf(u,performance.now())})}}typeof bs.requestAnimationFrame=="function"?bs.requestAnimationFrame(Mi):setTimeout(Mi,16)}async function of(o){if(ct=new $a(o.scene),zi())return;if(we=o.canvas,we===null)throw new Error("no OffscreenCanvas");Z=await $i.create(ct),gs=await(async()=>{var e;try{const s=await((e=bs.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),Le=new zl(Z,we),await Le.init(),Io(o.dark),Tn=new Lo(Z),Z.ctx.device.addEventListener("uncapturederror",e=>St({type:"error",message:`WebGPU: ${e.error.message}`})),Z.ctx.device.lost.then(e=>St({type:"gpu",ok:!1,adapter:gs,message:e.message||e.reason})),Wi(),Ki(o.width,o.height,o.dpr),St({type:"gpu",ok:!0,adapter:gs,message:""}),St({type:"ready",offscreen:!0,warnings:ct.warnings,view:ys,quality:ct.currentQuality,walls:ws}),Ns=performance.now(),vs=performance.now(),Ur||(Ur=!0,Mi())}function Hr(){if(Z===null||ct===null)return;const o=Z.stateVersion;Z.cpu=ct,Z.rebuild(),Z.resetTotals(),Qi(o),Tn=new Lo(Z),Ti=0,qe.length=0,Ie=0,us=null,Wi(),Ki(hn,dn,mn),St({type:"view",view:ys,walls:ws})}bs.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":St({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&bs.navigator.gpu!==void 0});break;case"init":of(t).catch(e=>St({type:"gpu",ok:!1,adapter:gs,message:e instanceof Error?e.message:String(e)}));break;case"resize":Ki(t.width,t.height,t.dpr),St({type:"view",view:ys,walls:ws});break;case"op":xs.push(t.op),li();break;case"addLiquid":xs.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),li();break;case"addSolid":xs.push({op:"solid",region:t.region,material:t.material,T:t.T}),li();break;case"setHeater":ct==null||ct.setHeater(t.group,t.mode,t.power,t.target,t.on),Z==null||Z.writeHeater(t.group);break;case"setAmbient":ct==null||ct.setAmbient(t.p,t.T,t.rh,t.g,t.air),Z==null||Z.writeParams();break;case"setBoundary":as(async()=>{if(Z===null||ct===null)return;await ki(),await Z.download(),ct.setBoundary(t.side,t.value);const e=Z.stateVersion;Z.upload(),Qi(e),Wi(),St({type:"view",view:ys,walls:ws})});break;case"query":as(async()=>{if(Z===null||ct===null){St({type:"reply",id:t.id,data:null});return}await ki(),await Z.download(),St({type:"reply",id:t.id,data:ct.query(t.x,t.y)})});break;case"select":us=null,Z==null||Z.watch(t.bubble);break;case"overlay":De=t.overlay;break;case"particles":Do=t.on;break;case"pause":Vs=t.paused,Ie=0,vs=performance.now();break;case"step":Vs&&(_i+=1);break;case"setSpeed":Fi=Math.min(64,Math.max(.05,t.speed));break;case"setQuality":as(async()=>{ct!==null&&(ct.setQuality(t.quality),Hr())});break;case"serialize":Z===null?St({type:"reply",id:t.id,data:(ct==null?void 0:ct.serialize())??null}):as(async()=>{St({type:"reply",id:t.id,data:(ct==null?void 0:ct.serialize())??null})});break;case"load":as(async()=>{ct!==null&&(ct.load(t.scene),!zi()&&Hr())});break;case"theme":Io(t.dark);break;case"frameDone":break}}catch(e){St({type:"error",message:e instanceof Error?e.message:String(e)})}});
