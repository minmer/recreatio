var fc=Object.defineProperty;var uc=(o,t,e)=>t in o?fc(o,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):o[t]=e;var x=(o,t,e)=>uc(o,typeof t!="symbol"?t+"":t,e);function hc(o){const t=[...o].filter(i=>Number.isFinite(i[0])&&Number.isFinite(i[1])).sort((i,r)=>i[0]-r[0]||i[1]-r[1]);if(t.length<3)return t;const e=(i,r,a)=>(r[0]-i[0])*(a[1]-i[1])-(r[1]-i[1])*(a[0]-i[0]),s=[];for(const i of t){for(;s.length>=2&&e(s[s.length-2],s[s.length-1],i)<=1e-12;)s.pop();s.push(i)}const n=[];for(let i=t.length-1;i>=0;i-=1){const r=t[i];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],r)<=1e-12;)n.pop();n.push(r)}return[...s.slice(0,-1),...n.slice(0,-1)]}const dc={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},mc=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},fusion:{T:{v:273.152519,src:"iapws-ice"},h:{v:333444.87,src:"iapws-ice"},cpIce:{v:2096.784,src:"iapws-ice"},rhoIce:{v:916.709,src:"iapws-ice"}},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],pc=[{id:"NaCl",name:{pl:"sól kuchenna (chlorek sodu)",de:"Kochsalz (Natriumchlorid)",en:"table salt (sodium chloride)"},short:{pl:"sól",de:"Salz",en:"salt"},solvent:"H2O",molarMass:{v:.0584428,src:"codata"},ions:{v:2,src:"phreeqc-pitzer"},pitzer:{b0:{a:[.07534,9598.4,35.48,-.058731,1798e-8,-5e5],src:"phreeqc-pitzer"},b1:{a:[.2769,13770,46.8,-.069512,2e-5,-748230],src:"phreeqc-pitzer"},c:{a:[.00148,-120.5,-.2081,0,1166e-10,11121],src:"phreeqc-pitzer"},b:{v:1.2,src:"phreeqc-pitzer"},alpha:{v:2,src:"phreeqc-pitzer"}},pitzerCold:{below:{v:273.15,src:"smw1990"},b0:{a:[.076276,-886.777,-4.19728,.00613645,-11006e-10,8942.9],src:"smw1990"},b1:{a:[.280431,-8677.858,-94.69966,.2944375,-147476e-9,-191956],src:"smw1990"},c:{a:[.001271,52.6,.07951,31974e-8,-3195e-10,-1237.7],src:"smw1990"}},dielectric:{c:[87.74,-.40008,9398e-7,-141e-8],src:"malmberg1956"},density:{laliberte:[-.00324112223655149,.0636354335906616,1.01371399467365,.0145951015210159,3317.34854426537],src:"laliberte2009"},cp:{laliberte:[-.0693559668993322,-.0782134167486952,3.84798479408635,-11.2762109247072,8.73187698542672,1.81245930472755],range:{lo:274.65,hi:393.15},src:"laliberte2009"},solubility:{table:[[273.15,6.097],[298.15,6.146],[323.15,6.275],[348.15,6.46],[373.15,6.68],[398.15,6.935],[423.15,7.198]],src:"ppb1984"},dHsol:{v:3883,src:"nbs1982"},diffusivity:{v:1611e-12,src:"crc-diffusion"},eutectic:{T:{v:251.95,src:"bodnar1993"},w:{v:.232,src:"bodnar1993"}},solid:{rho:{v:2165,src:"crc-nacl"},cp:{v:864.1,src:"nbs1982"},color:"#f4f3ee"}}],gc={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},xc=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},friction:{v:.4,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},friction:{v:.42,src:"friction-dry"},restitution:{v:.3,src:"model"},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},friction:{v:.5,src:"model"},restitution:{v:.2,src:"model"},color:"#d8ccb4"},{id:"wood",name:{pl:"drewno (sosna)",de:"Holz (Kiefer)",en:"wood (pine)"},rho:{v:510,src:"incropera"},cp:{v:1380,src:"incropera"},k:{v:.12,src:"incropera"},contactAngle:{v:70,src:"model"},cavities:{scale:{v:10,src:"model"},rmax:{v:1e-4,src:"model"}},friction:{v:.48,src:"nasa-rp1228"},restitution:{v:.3,src:"model"},color:"#c08a52"},{id:"ice",name:{pl:"lód",de:"Eis",en:"ice"},rho:{v:916.709,src:"iapws-ice"},cp:{v:2096.784,src:"iapws-ice"},k:{v:2.24,src:"slack1980"},contactAngle:{v:12,src:"knight1967"},cavities:{scale:{v:.01,src:"model"},rmax:{v:2e-6,src:"model"}},friction:{v:.02,src:"friction-dry"},restitution:{v:.1,src:"model"},color:"#d4ecf7"},{id:"stone",name:{pl:"kamień (granit)",de:"Stein (Granit)",en:"stone (granite)"},rho:{v:2630,src:"incropera"},cp:{v:775,src:"incropera"},k:{v:2.79,src:"incropera"},contactAngle:{v:45,src:"model"},cavities:{scale:{v:5,src:"model"},rmax:{v:8e-5,src:"model"}},friction:{v:.6,src:"byerlee1978"},restitution:{v:.2,src:"model"},color:"#8e8a83"}];var vc={ambient:dc,species:mc,solutes:pc,vapourInAir:gc,solids:xc};const Ot=8.314462618,Nn=9.80665,Us=101325,ct=273.15,hr=1602176634e-28,yc=1380649e-29,bc=602214076e15,wc=88541878128e-22,U=0,st=1,ht=2,rt=0,ot=1,Q=2,ut=6,xt=3,kt=vc,jt=kt.species[0],Ts=kt.species[1],Ms=kt.species[2],dt=new Float64Array(ut);dt[rt]=Ts.molarMass.v;dt[ot]=Ms.molarMass.v;dt[Q]=jt.molarMass.v;Ts.name,Ms.name,jt.vapour.name;const Gi=Ts.gas.cp.v,Hi=Ms.gas.cp.v,[Gs,Hs,Ce]=jt.vapour.cp.linear;function Fc(o,t){return o===Q?Gs+Hs*(t-Ce):o===rt?Gi:o===ot?Hi:0}const Ie=jt.liquid.kell.c,en=jt.liquid.cp.table,Pt=new Float64Array(en.map(o=>o[0])),Ct=new Float64Array(en.map(o=>o[1])),Yt=new Float64Array(en.length);Yt[0]=Ct[0]*(Pt[0]-ct);for(let o=1;o<en.length;o+=1)Yt[o]=Yt[o-1]+.5*(Ct[o]+Ct[o-1])*(Pt[o]-Pt[o-1]);const Et=en.length-1;function yo(o){if(o<Pt[0])return-1;if(o>=Pt[Et])return Et;let t=Math.min(Et-1,Math.max(0,Math.floor((o-ct)/10)));for(;t>0&&o<Pt[t];)t-=1;for(;t<Et-1&&o>=Pt[t+1];)t+=1;return t}function je(o){const t=yo(o);return t<0?Ct[0]:t===Et?Ct[Et]:Ct[t]+(Ct[t+1]-Ct[t])*(o-Pt[t])/(Pt[t+1]-Pt[t])}function At(o){const t=yo(o);if(t<0)return Yt[0]+Ct[0]*(o-Pt[0]);if(t===Et)return Yt[Et]+Ct[Et]*(o-Pt[Et]);const e=o-Pt[t],s=(Ct[t+1]-Ct[t])/(Pt[t+1]-Pt[t]);return Yt[t]+Ct[t]*e+.5*s*e*e}function bo(o){if(o<Yt[0])return Pt[0]+(o-Yt[0])/Ct[0];if(o>=Yt[Et])return Pt[Et]+(o-Yt[Et])/Ct[Et];let t=Math.min(Et-1,Math.max(0,Math.floor(o/41900)));for(;t>0&&o<Yt[t];)t-=1;for(;t<Et-1&&o>=Yt[t+1];)t+=1;const e=(Ct[t+1]-Ct[t])/(Pt[t+1]-Pt[t]),s=o-Yt[t],n=Ct[t];return Pt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function Tn(o){const t=o-ct;return(Ie[0]+t*(Ie[1]+t*(Ie[2]+t*(Ie[3]+t*(Ie[4]+t*Ie[5])))))/(1+Ie[6]*t)}const zn=jt.liquid.k.poly;function Ai(o){const t=Math.min(150,Math.max(0,o-ct));return zn[0]+t*(zn[1]+t*zn[2])}const[Ac,_c,dr]=jt.liquid.mu.vogel;function $i(o){return Ac*Math.pow(10,_c/(Math.max(o,dr+60)-dr))}const Qn=jt.surfaceTension,Pc=jt.saturation.Tc.v;function Wi(o){const t=Math.max(0,1-o/Pc);return Qn.B*Math.pow(t,Qn.mu)*(1+Qn.b*t)}const kc=jt.saturation.hlv100.v,$s=ct+100,wo=At($s)+kc,Tc=jt.vapour.k.v,Mc=jt.vapour.mu.v;function pt(o){const t=o-Ce,e=$s-Ce;return wo+Gs*(o-$s)+.5*Hs*(t*t-e*e)}function Sc(o){return pt(o)-At(o)}function Jt(o,t){return o===Q?pt(t):Fc(o,t)*(t-ct)}const Xn=Ts.gas.k.power,Yn=Ms.gas.k.power,Lc=Ts.gas.mu.sutherland,Cc=Ms.gas.mu.sutherland,Jn=kt.vapourInAir,Fo=(o,t)=>o[0]*Math.pow(t/o[1],1.5)*((o[1]+o[2])/(t+o[2])),Ao=150,Mn=1001,sn=o=>{const t=new Float64Array(Mn);for(let e=0;e<Mn;e+=1)t[e]=o(Ao+e);return t},Ke=(o,t)=>{let e=t-Ao;e>0?e>Mn-1.001&&(e=Mn-1.001):e=0;const s=e|0;return o[s]+(e-s)*(o[s+1]-o[s])},mr=sn(o=>Xn[0]*Math.pow(o/Xn[1],Xn[2])),Oc=sn(o=>Yn[0]*Math.pow(o/Yn[1],Yn[2])),pr=sn(o=>Fo(Lc,o)),jc=sn(o=>Fo(Cc,o)),Bc=sn(o=>Jn.D0.v*Math.pow(o/Jn.T0.v,Jn.exponent.v));function Ic(o,t,e,s){const n=o+t+e;return n>0?(o*Ke(mr,s)+t*Ke(Oc,s)+e*Tc)/n:Ke(mr,s)}function qc(o,t,e,s){const n=o+t+e;return n>0?(o*Ke(pr,s)+t*Ke(jc,s)+e*Mc)/n:Ke(pr,s)}function Ec(o,t){return Ke(Bc,o)*(Us/t)}function _o(o,t,e,s){const n=o*Gi+t*Hi,i=$s-Ce,r=.5*e*Hs,a=n+e*Gs;if(a<=0)return ct;const c=n*(Ce-ct)+e*(wo+Gs*(Ce-$s)-.5*Hs*i*i)-s,l=a*a-4*r*c;return Ce+-2*c/(a+Math.sqrt(l>0?l:0))}function _i(o,t,e,s,n){return o*Gi+t*Hi+e*(Gs+Hs*(n-Ce))+(s>0?s*je(n):0)}const Rc=kt.ambient.air.N2.v,Dc=kt.ambient.air.O2.v,Po=kt.ambient.hExt.v,vt=kt.solids.map(o=>({id:o.id,name:o.name,rho:o.rho.v,cp:o.cp.v,k:o.k.v,contactAngle:o.contactAngle.v,cavScale:o.cavities.scale.v,cavRmax:o.cavities.rmax.v,friction:o.friction.v,bounce:o.restitution.v,color:o.color}));function qs(o){return vt.findIndex(t=>t.id===o)}const at=0,ko=kt.species.slice(3),gr=[null,...ko.map(o=>{const t=o.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*ct+.5*s*ct*ct}})],te=[{id:jt.id,name:jt.name,short:jt.liquid.name,color:jt.liquid.color,volatile:!0,range:[ct,ct+150]},...ko.map(o=>({id:o.id,name:o.name,short:o.liquid.name,color:o.liquid.color,volatile:!1,range:[o.liquid.range.lo,o.liquid.range.hi]}))];function To(o){return te.findIndex(t=>t.id===o)}const Je=o=>gr[o]??gr[1];function Ki(o,t){if(o===at)return je(t);const e=Je(o);return e.cA+e.cB*t}function Vc(o,t){if(o===at)return At(t);const e=Je(o);return e.cA*t+.5*e.cB*t*t-e.h0}function Nc(o,t){if(o===at)return bo(t);const e=Je(o),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function Xe(o,t){if(o===at)return Tn(t);const e=Je(o);return e.rA+e.rB*t}function Rs(o,t){if(o===at)return Ai(t);const e=Je(o);return e.kA+e.kB*t}function Ws(o,t){if(o===at)return $i(t);const e=Je(o);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function gs(o,t){return o===at?Wi(t):Je(o).sigma}jt.thermo,Ts.thermo,Ms.thermo;const Uc=0,zi=1;class we{constructor(t,e,s,n){x(this,"nv",0);x(this,"vi",new Int32Array(0));x(this,"vj",new Int32Array(0));x(this,"mat",new Uint8Array(0));x(this,"E",new Float64Array(0));x(this,"heater",new Int16Array(0));x(this,"film",new Float64Array(0));x(this,"crust",new Float64Array(0));x(this,"bi0",0);x(this,"bj0",0);x(this,"bw",0);x(this,"bh",0);x(this,"occ",new Int32Array(0));x(this,"cx",0);x(this,"cy",0);x(this,"x",0);x(this,"y",0);x(this,"a",0);x(this,"vx",0);x(this,"vy",0);x(this,"w",0);x(this,"ux",0);x(this,"uy",0);x(this,"uw",0);x(this,"m",0);x(this,"I",0);x(this,"ma",0);x(this,"Ia",0);x(this,"ma6",new Float64Array(6));x(this,"maOk",!1);x(this,"pinned",!0);x(this,"asleep",!0);x(this,"gone",!1);x(this,"rest",0);x(this,"rx",0);x(this,"ry",0);x(this,"ra",0);x(this,"ne",0);x(this,"ex",new Float64Array(0));x(this,"ey",new Float64Array(0));x(this,"ed",new Uint8Array(0));x(this,"np",0);x(this,"parts",new Float64Array(0));x(this,"shape",Uc);x(this,"radius",0);x(this,"hullA",0);x(this,"hullJ",0);x(this,"rmax",0);x(this,"nc",0);x(this,"cells",new Int32Array(0));x(this,"E0",new Float64Array(0));x(this,"F0",new Float64Array(0));x(this,"K0",new Float64Array(0));x(this,"nw",0);x(this,"wv",new Int32Array(0));x(this,"wc",new Int32Array(0));x(this,"ww",new Float64Array(0));x(this,"nf",0);x(this,"faces",new Int32Array(0));this.index=t,this.key=e,this.dx=s,this.depth=n}get free(){return!this.pinned&&!this.gone}get awake(){return!this.pinned&&!this.asleep&&!this.gone}setVoxels(t,e,s,n,i,r,a,c){this.nv=t,this.vi=e,this.vj=s,this.mat=n,this.E=i,this.heater=r,this.film=a,this.crust=c,this.derive()}derive(){const{dx:t,depth:e,nv:s,vi:n,vj:i,mat:r}=this;let a=1/0,c=1/0,l=-1/0,u=-1/0,f=0,d=0,m=0;const g=t*t*e;for(let b=0;b<s;b+=1){const y=vt[r[b]].rho*g;f+=y,d+=y*(n[b]+.5)*t,m+=y*(i[b]+.5)*t,n[b]<a&&(a=n[b]),n[b]>l&&(l=n[b]),i[b]<c&&(c=i[b]),i[b]>u&&(u=i[b])}if(s===0){this.m=0,this.I=0,this.bw=0,this.bh=0,this.ne=0,this.np=0,this.rmax=0,this.gone=!0;return}const h=d/f,p=m/f;if(this.m>0){const b=Math.cos(this.a),y=Math.sin(this.a),F=h-this.cx,w=p-this.cy;this.x+=b*F-y*w,this.y+=y*F+b*w,this.rx+=b*F-y*w,this.ry+=y*F+b*w}this.cx=h,this.cy=p,this.m=f;let v=0;for(let b=0;b<s;b+=1){const y=(n[b]+.5)*t-h,F=(i[b]+.5)*t-p;v+=vt[r[b]].rho*g*(y*y+F*F+t*t/6)}this.I=v,this.bi0=a,this.bj0=c,this.bw=l-a+1,this.bh=u-c+1,this.occ=new Int32Array(this.bw*this.bh);for(let b=0;b<s;b+=1)this.occ[n[b]-a+(i[b]-c)*this.bw]=b+1;this.edges(),this.buildParts(),this.buildHull()}voxel(t,e){const s=t-this.bi0,n=e-this.bj0;return s<0||n<0||s>=this.bw||n>=this.bh?-1:this.occ[s+n*this.bw]-1}voxelAtLocal(t,e){return this.voxel(Math.floor((t+this.cx)/this.dx),Math.floor((e+this.cy)/this.dx))}static toLocal(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s),l=n-t,u=i-e;r[0]=a*l+c*u,r[1]=-c*l+a*u}static toWorld(t,e,s,n,i,r){const a=Math.cos(s),c=Math.sin(s);r[0]=t+a*n-c*i,r[1]=e+c*n+a*i}rotateAbout(t,e,s){const n=Math.cos(s),i=Math.sin(s),r=this.x-t,a=this.y-e;this.x=t+n*r-i*a,this.y=e+i*r+n*a,this.a+=s}speed(){return Math.hypot(this.vx,this.vy)+Math.abs(this.w)*this.rmax}kinetic(){return .5*this.m*(this.vx*this.vx+this.vy*this.vy)+.5*this.I*this.w*this.w}components(t){const{nv:e,vi:s,vj:n}=this;t.fill(-1,0,e);const i=new Int32Array(e);let r=0;for(let a=0;a<e;a+=1){if(t[a]>=0)continue;let c=0;for(i[c++]=a,t[a]=r;c>0;){const l=i[--c];for(let u=0;u<4;u+=1){const f=this.voxel(s[l]+(u===0?-1:u===1?1:0),n[l]+(u===2?-1:u===3?1:0));f>=0&&t[f]<0&&(t[f]=r,i[c++]=f)}}r+=1}return r}keepVoxels(t){const e=[];for(let n=0;n<this.nv;n+=1)t(n)&&e.push(n);const s=(n,i)=>{const r=i(e.length);return e.forEach((a,c)=>{r[c]=n[a]}),r};this.setVoxels(e.length,s(this.vi,n=>new Int32Array(n)),s(this.vj,n=>new Int32Array(n)),s(this.mat,n=>new Uint8Array(n)),s(this.E,n=>new Float64Array(n)),s(this.heater,n=>new Int16Array(n)),s(this.film,n=>new Float64Array(n)),s(this.crust,n=>new Float64Array(n)))}edges(){const{nv:t,vi:e,vj:s,dx:n,cx:i,cy:r}=this;let a=0;for(let u=0;u<t;u+=1)for(let f=0;f<4;f+=1)this.voxel(e[u]+(f===0?-1:f===1?1:0),s[u]+(f===2?-1:f===3?1:0))<0&&(a+=1);this.ne=a,this.ex=new Float64Array(a),this.ey=new Float64Array(a),this.ed=new Uint8Array(a);let c=0,l=0;for(let u=0;u<t;u+=1){const f=(e[u]+.5)*n-i,d=(s[u]+.5)*n-r;for(let m=0;m<4;m+=1)this.voxel(e[u]+(m===0?-1:m===1?1:0),s[u]+(m===2?-1:m===3?1:0))>=0||(this.ex[c]=f+(m===0?-.5:m===1?.5:0)*n,this.ey[c]=d+(m===2?-.5:m===3?.5:0)*n,this.ed[c]=m,c+=1);l=Math.max(l,Math.hypot(Math.abs(f)+.5*n,Math.abs(d)+.5*n))}this.rmax=l}buildParts(){if(this.shape===zi&&this.radius>0){this.np=1,this.parts=new Float64Array([-this.radius,-this.radius,this.radius,this.radius]);return}const{bw:t,bh:e,bi0:s,bj0:n,dx:i,cx:r,cy:a}=this,c=[];let l=new Map;const u=(f,d,m)=>{const g=f>>16,h=f&65535;c.push((s+g)*i-r,(n+d)*i-a,(s+h+1)*i-r,(n+m+1)*i-a)};for(let f=0;f<=e;f+=1){const d=new Map;if(f<e){let m=0;for(;m<t;){if(this.occ[m+f*t]===0){m+=1;continue}let g=m;for(;g+1<t&&this.occ[g+1+f*t]!==0;)g+=1;const h=m<<16|g;d.set(h,l.has(h)?l.get(h):f),m=g+1}}for(const[m,g]of l)(!d.has(m)||d.get(m)!==g)&&u(m,g,f-1);l=d}this.np=c.length/4,this.parts=Float64Array.from(c)}buildHull(){const t=[];for(let i=0;i<this.ne;i+=1){const r=this.ed[i],a=.5*this.dx,c=this.ex[i],l=this.ey[i];r<2?t.push([c,l-a],[c,l+a]):t.push([c-a,l],[c+a,l])}const e=hc(t);let s=0,n=0;for(let i=0;i<e.length;i+=1){const[r,a]=e[i],[c,l]=e[(i+1)%e.length],u=r*l-c*a;s+=u/2,n+=u*(r*r+r*c+c*c+a*a+a*l+l*l)/12}this.hullA=Math.abs(s),this.hullJ=Math.abs(n)}static fromCells(t,e,s,n){const i=new we(t,e,s.dx,s.depth),r=n.length,a=new Int32Array(r),c=new Int32Array(r),l=new Uint8Array(r),u=new Float64Array(r),f=new Int16Array(r),d=new Float64Array(r),m=new Float64Array(r);return n.forEach((g,h)=>{a[h]=g%s.nx,c[h]=Math.floor(g/s.nx),l[h]=s.solid[g]-1,u[h]=s.Es[g],f[h]=s.heater[g],d[h]=s.film[g],m[h]=s.crust[g]}),i.setVoxels(r,a,c,l,u,f,d,m),i.x=i.cx,i.y=i.cy,i.rx=i.x,i.ry=i.y,i}}const Gc=.004,Hc=.02,ln=1e-7,$c=.22,Wc=2.5;class Kc{constructor(t,e){x(this,"nx",0);x(this,"ny",0);x(this,"count",0);x(this,"points",[xr(),xr()]);x(this,"friction");x(this,"bounce");x(this,"touched",!0);x(this,"k11",0);x(this,"k12",0);x(this,"k22",0);x(this,"i11",0);x(this,"i12",0);x(this,"i22",0);x(this,"block",!1);x(this,"h",1/120);x(this,"slop",Gc);x(this,"spec",Hc);this.a=t,this.b=e,this.friction=Math.sqrt(t.material.friction*e.material.friction),this.bounce=Math.max(t.material.bounce,e.material.bounce)}}function xr(){return{x:0,y:0,sep:0,id:-1,jn:0,jt:0,rax:0,ray:0,rbx:0,rby:0,massN:0,massT:0,bias:0,bounce:0,fixed:0,kicked:!1}}function zc(o){const t=o.a,e=o.b,s=[o.points[0].id,o.points[1].id],n=[o.points[0].jn,o.points[1].jn],i=[o.points[0].jt,o.points[1].jt],r=o.count;o.count=0,t.shape.kind==="circle"&&e.shape.kind==="circle"?Qc(o,t,e):t.shape.kind==="poly"&&e.shape.kind==="circle"?vr(o,t,e,!1):t.shape.kind==="circle"&&e.shape.kind==="poly"?vr(o,e,t,!0):Xc(o,t,e);for(let a=0;a<o.count;a+=1){const c=o.points[a];c.jn=0,c.jt=0;for(let l=0;l<r;l+=1)if(s[l]===c.id){c.jn=n[l],c.jt=i[l];break}}return o.count}function Sn(o,t,e,s,n){const i=o.points[o.count];i.x=t,i.y=e,i.sep=s,i.id=n,o.count+=1}function Qc(o,t,e){const s=t.shape.r,n=e.shape.r,i=e.x-t.x,r=e.y-t.y,a=Math.hypot(i,r);if(a>s+n+o.spec)return;const c=a>1e-9?i/a:0,l=a>1e-9?r/a:1;o.nx=c,o.ny=l,Sn(o,t.x+c*(s-(s+n-a)/2),t.y+l*(s-(s+n-a)/2),a-s-n,0)}function vr(o,t,e,s){const n=t.shape;if(n.kind!=="poly")return;const i=e.shape.r;let r=-1/0,a=0;for(let b=0;b<n.n;b+=1){const y=(e.x-t.wx[b])*t.wnx[b]+(e.y-t.wy[b])*t.wny[b];if(y>i+o.spec)return;y>r&&(r=y,a=b)}const c=(a+1)%n.n,l=t.wx[a],u=t.wy[a],f=t.wx[c],d=t.wy[c];let m,g,h,p,v;if(r<1e-9)m=t.wnx[a],g=t.wny[a],v=r-i,h=e.x-m*i,p=e.y-g*i;else{const b=(e.x-l)*(f-l)+(e.y-u)*(d-u),y=(e.x-f)*(l-f)+(e.y-d)*(u-d);if(b<=0||y<=0){const F=b<=0?l:f,w=b<=0?u:d,P=e.x-F,_=e.y-w,A=Math.hypot(P,_);if(A>i+o.spec)return;m=A>1e-9?P/A:t.wnx[a],g=A>1e-9?_/A:t.wny[a],v=A-i,h=F,p=w}else m=t.wnx[a],g=t.wny[a],v=r-i,h=e.x-m*i,p=e.y-g*i}o.nx=s?-m:m,o.ny=s?-g:g,Sn(o,h,p,v,a)}function yr(o,t){const e=o.shape,s=t.shape;if(e.kind!=="poly"||s.kind!=="poly")return{sep:1/0,edge:0};let n=-1/0,i=0;for(let r=0;r<e.n;r+=1){const a=o.wnx[r],c=o.wny[r],l=o.wx[r],u=o.wy[r];let f=1/0;for(let d=0;d<s.n;d+=1){const m=(t.wx[d]-l)*a+(t.wy[d]-u)*c;m<f&&(f=m)}f>n&&(n=f,i=r)}return{sep:n,edge:i}}function Xc(o,t,e){const s=yr(t,e);if(s.sep>o.spec)return;const n=yr(e,t);if(n.sep>o.spec)return;let i=t,r=e,a=s.edge,c=!1;n.sep>.98*s.sep+.001&&(i=e,r=t,a=n.edge,c=!0);const l=i.shape,u=r.shape;if(l.kind!=="poly"||u.kind!=="poly")return;const f=(a+1)%l.n,d=i.wx[a],m=i.wy[a],g=i.wx[f],h=i.wy[f],p=i.wnx[a],v=i.wny[a];let b=1/0,y=0;for(let E=0;E<u.n;E+=1){const z=r.wnx[E]*p+r.wny[E]*v;z<b&&(b=z,y=E)}const F=(y+1)%u.n;let w=r.wx[y],P=r.wy[y],_=r.wx[F],A=r.wy[F],k=y,M=F;const S=Math.hypot(g-d,h-m)||1,T=(g-d)/S,I=(h-m)/S,O=T*d+I*m,D=T*g+I*h;for(const[E,z]of[[-1,-O],[1,D]]){const N=E*(T*w+I*P)-z,L=E*(T*_+I*A)-z;if(N>ln&&L>ln)return;if(N>ln){const V=N/(N-L);w+=(_-w)*V,P+=(A-P)*V,k=200+a}else if(L>ln){const V=N/(N-L);_=w+(_-w)*V,A=P+(A-P)*V,M=300+a}}const B=(c?1e4:0)+a*1e3,q=(w-d)*p+(P-m)*v,R=(_-d)*p+(A-m)*v;o.nx=c?-p:p,o.ny=c?-v:v,q<=o.spec&&Sn(o,w-p*q/2,P-v*q/2,q,B+k),R<=o.spec&&Sn(o,_-p*R/2,A-v*R/2,R,B+M)}function Yc(o,t){o.h=t;const e=o.a,s=o.b,n=o.nx,i=o.ny,r=i,a=-n;for(let c=0;c<o.count;c+=1){const l=o.points[c];l.rax=l.x-e.x,l.ray=l.y-e.y,l.rbx=l.x-s.x,l.rby=l.y-s.y;const u=l.rax*i-l.ray*n,f=l.rbx*i-l.rby*n,d=e.invM+s.invM+e.invI*u*u+s.invI*f*f;l.massN=d>0?1/d:0;const m=l.rax*a-l.ray*r,g=l.rbx*a-l.rby*r,h=e.invM+s.invM+e.invI*m*m+s.invI*g*g;l.massT=h>0?1/h:0,l.bias=l.sep>0?-l.sep/t:Math.min(Wc,$c/t*Math.max(0,-l.sep-o.slop));const p=s.vx-s.w*l.rby-e.vx+e.w*l.ray,v=s.vy+s.w*l.rbx-e.vy-e.w*l.rax,b=p*n+v*i;l.bounce=b<-.6&&(l.sep<=o.slop||l.sep+b*t<0)?-o.bounce*b:0,(l.kicked||l.bounce>0)&&(l.jn=0,l.jt=0),l.kicked=!1,l.fixed=0}if(o.block=!1,o.count===2){const c=o.points[0],l=o.points[1],u=c.rax*i-c.ray*n,f=c.rbx*i-c.rby*n,d=l.rax*i-l.ray*n,m=l.rbx*i-l.rby*n,g=e.invM+s.invM;o.k11=g+e.invI*u*u+s.invI*f*f,o.k22=g+e.invI*d*d+s.invI*m*m,o.k12=g+e.invI*u*d+s.invI*f*m;const h=o.k11*o.k22-o.k12*o.k12;o.k11*o.k11<1e3*h&&h>0&&(o.block=!0,o.i11=o.k22/h,o.i12=-o.k12/h,o.i22=o.k11/h)}}function Jc(o){const t=o.ny,e=-o.nx;for(let s=0;s<o.count;s+=1){const n=o.points[s];Ks(o.a,o.b,n.jn*o.nx+n.jt*t,n.jn*o.ny+n.jt*e,n)}}function Zc(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=n,r=-s;for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,u=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,f=l*i+u*r,d=o.friction*c.jn,m=Math.max(-d,Math.min(d,c.jt-c.massT*f)),g=m-c.jt;c.jt=m,Ks(t,e,g*i,g*r,c)}if(o.block){ta(o);return}for(let a=0;a<o.count;a+=1){const c=o.points[a],l=e.vx-e.w*c.rby-t.vx+t.w*c.ray,u=e.vy+e.w*c.rbx-t.vy-t.w*c.rax,f=l*s+u*n;c.bounce===0&&o.bounce>=.5&&f<-.6&&(c.sep<=o.slop||c.sep+f*o.h<0)&&(c.bounce=-o.bounce*f);const d=Math.max(c.jn+c.massN*(-f+Pi(c)),c.fixed),m=d-c.jn;c.jn=d,Ks(t,e,m*s,m*n,c),c.bounce>0&&(c.fixed=d,c.bounce=-1,c.kicked=!0)}}const Pi=o=>o.bounce>0?Math.max(o.bias,o.bounce):o.bias;function Ks(o,t,e,s,n){o.vx-=o.invM*e,o.vy-=o.invM*s,o.w-=o.invI*(n.rax*s-n.ray*e),t.vx+=t.invM*e,t.vy+=t.invM*s,t.w+=t.invI*(n.rbx*s-n.rby*e)}function ta(o){const t=o.a,e=o.b,s=o.nx,n=o.ny,i=o.points[0],r=o.points[1],a=h=>{const p=e.vx-e.w*h.rby-t.vx+t.w*h.ray,v=e.vy+e.w*h.rbx-t.vy-t.w*h.rax;return p*s+v*n},c=i.jn,l=r.jn,u=a(i)-Pi(i)-(o.k11*c+o.k12*l),f=a(r)-Pi(r)-(o.k12*c+o.k22*l),d=(h,p)=>{const v=h-c,b=p-l;Ks(t,e,v*s,v*n,i),Ks(t,e,b*s,b*n,r),i.jn=h,r.jn=p};let m=-(o.i11*u+o.i12*f),g=-(o.i12*u+o.i22*f);if(m>=0&&g>=0){d(m,g);return}if(m=-u/o.k11,g=0,m>=0&&o.k12*m+f>=0){d(m,g);return}if(m=0,g=-f/o.k22,g>=0&&o.k12*g+u>=0){d(m,g);return}u>=0&&f>=0&&d(0,0)}const ea=10,Ls={friction:.5,bounce:.1},sa=.01;function Ze(o,t,e,s){const n=new Float64Array([o,e,e,o]),i=new Float64Array([t,t,s,s]),r=new Float64Array([0,1,0,-1]),a=new Float64Array([-1,0,1,0]);let c=0;for(let l=0;l<4;l+=1)c=Math.max(c,Math.hypot(n[l],i[l]));return{kind:"poly",xs:n,ys:i,nx:r,ny:a,n:4,radius:c}}class ts{constructor(t,e,s,n){x(this,"wx");x(this,"wy");x(this,"wnx");x(this,"wny");x(this,"minX",0);x(this,"minY",0);x(this,"maxX",0);x(this,"maxY",0);x(this,"invM",0);x(this,"invI",0);this.id=t,this.body=e,this.shape=s,this.material=n;const i=s.kind==="poly"?s.n:0;this.wx=new Float64Array(i),this.wy=new Float64Array(i),this.wnx=new Float64Array(i),this.wny=new Float64Array(i)}get x(){return this.body!==null?this.body.x:0}set x(t){this.body!==null&&(this.body.x=t)}get y(){return this.body!==null?this.body.y:0}set y(t){this.body!==null&&(this.body.y=t)}get vx(){return this.body!==null?this.body.vx:0}set vx(t){this.body!==null&&this.invM>0&&(this.body.vx=t)}get vy(){return this.body!==null?this.body.vy:0}set vy(t){this.body!==null&&this.invM>0&&(this.body.vy=t)}get w(){return this.body!==null?this.body.w:0}set w(t){this.body!==null&&this.invI>0&&(this.body.w=t)}update(){const t=this.shape,e=this.body,s=e!==null?e.x:0,n=e!==null?e.y:0;if(t.kind==="circle"){this.minX=s-t.r,this.maxX=s+t.r,this.minY=n-t.r,this.maxY=n+t.r;return}const i=e!==null?Math.cos(e.a):1,r=e!==null?Math.sin(e.a):0;let a=1/0,c=1/0,l=-1/0,u=-1/0;for(let f=0;f<t.n;f+=1){const d=s+i*t.xs[f]-r*t.ys[f],m=n+r*t.xs[f]+i*t.ys[f];this.wx[f]=d,this.wy[f]=m,this.wnx[f]=i*t.nx[f]-r*t.ny[f],this.wny[f]=r*t.nx[f]+i*t.ny[f],d<a&&(a=d),d>l&&(l=d),m<c&&(c=m),m>u&&(u=m)}this.minX=a,this.minY=c,this.maxX=l,this.maxY=u}}class na{constructor(t){x(this,"parts",[]);x(this,"byBody",[]);x(this,"builtFor",-1);x(this,"warmKey",new Float64Array(0));x(this,"warmData",new Float64Array(0));x(this,"warmCount",0);x(this,"touching",new Uint8Array(0));x(this,"toWake",[]);x(this,"cache",new Map);x(this,"live",[]);x(this,"liveKey",[]);this.grid=t}invalidate(){this.builtFor=-1}build(t,e){const s=this.grid(),n=[],i=s.w,r=s.h;s.openL||n.push(new ts(1,null,Ze(-1,-1,0,r+1),Ls)),s.openR||n.push(new ts(2,null,Ze(i,-1,i+1,r+1),Ls)),s.openB||n.push(new ts(3,null,Ze(-1,-1,i+1,0),Ls)),s.openT||n.push(new ts(4,null,Ze(-1,r,i+1,r+1),Ls));const{nx:a,ny:c,dx:l}=s;let u=new Map,f=10;for(let d=0;d<=c;d+=1){const m=new Map;if(d<c){let g=0;for(;g<a;){const h=g+d*a;if(s.solid[h]===0||s.owner[h]!==0){g+=1;continue}const p=s.solid[h];let v=g;for(;v+1<a&&s.solid[v+1+d*a]===p&&s.owner[v+1+d*a]===0;)v+=1;const b=p<<24|g<<12|v;m.set(b,u.has(b)?u.get(b):d),g=v+1}}for(const[g,h]of u){if(m.get(g)===h)continue;const p=this.solidMaterial(g>>>24);n.push(new ts(f++,null,Ze((g>>12&4095)*l,h*l,((g&4095)+1)*l,d*l),p))}u=m}this.byBody=t.map(()=>[]);for(const d of t){if(d.gone)continue;const m=this.bodyMaterial(d);for(let g=0;g<d.np;g+=1){const h=d.shape===zi?{kind:"circle",r:d.radius}:Ze(d.parts[4*g],d.parts[4*g+1],d.parts[4*g+2],d.parts[4*g+3]),p=new ts(1e5+d.index*1e3+g,d,h,m);n.push(p),this.byBody[d.index].push(p)}}for(const d of n)d.update();this.parts=n,this.builtFor=e}bodyMaterial(t){const e=new Map;for(let i=0;i<t.nv;i+=1)e.set(t.mat[i],(e.get(t.mat[i])??0)+1);let s=t.mat[0],n=-1;for(const[i,r]of e)r>n&&(n=r,s=i);return this.solidMaterial(s+1)}solidMaterial(t){const e=vt[t-1];return e!==void 0?{friction:e.friction,bounce:e.bounce}:Ls}step(t,e,s,n,i){this.builtFor!==s&&(this.build(e,s),this.cache.clear()),this.touching.length<e.length&&(this.touching=new Uint8Array(e.length+8)),this.touching.fill(0),this.toWake.length=0;for(const u of this.parts){const f=u.body;if(f===null)continue;const d=f.awake;u.invM=d?1/f.m:0,u.invI=d?1/f.I:0,u.update()}for(const u of this.cache.values())u.touched=!1;const r=this.live,a=this.liveKey;r.length=0,a.length=0;const c=this.parts;for(let u=0;u<c.length;u+=1){const f=c[u];for(let d=u+1;d<c.length;d+=1){const m=c[d],g=f.invM>0,h=m.invM>0;if(!g&&!h||f.body!==null&&f.body===m.body||m.minX>f.maxX+i||m.maxX<f.minX-i||m.minY>f.maxY+i||m.maxY<f.minY-i)continue;const p=f.id*1e6+m.id;let v=this.cache.get(p);v===void 0&&(v=new Kc(f,m),v.slop=n,v.spec=i,this.restore(v,p),this.cache.set(p,v)),v.touched=!0,zc(v)>0?(r.push(v),a.push(p)):v.count=0}}const l=a.map((u,f)=>f).sort((u,f)=>a[u]-a[f]);for(const u of l)Yc(r[u],t);for(const u of l)Jc(r[u]);for(let u=0;u<ea;u+=1)for(const f of l)Zc(r[f]);for(const u of l){const f=r[u],d=f.a.body,m=f.b.body;if(d!==null&&(this.touching[d.index]=1),m!==null&&(this.touching[m.index]=1),d!==null&&m!==null&&d.asleep!==m.asleep&&!d.pinned&&!m.pinned){const g=d.asleep?m:d,h=d.asleep?d:m;g.speed()>sa&&this.toWake.push(h.index)}}for(const[u,f]of this.cache)(!f.touched||f.count===0)&&this.cache.delete(u);this.save(l.map(u=>a[u]),l.map(u=>r[u]))}touches(t){return this.touching[t.index]===1}save(t,e){const s=t.length;this.warmKey.length<s&&(this.warmKey=new Float64Array(2*s+8),this.warmData=new Float64Array(9*(2*s+8)));for(let n=0;n<s;n+=1){const i=e[n];this.warmKey[n]=t[n];const r=9*n;this.warmData[r]=i.count;for(let a=0;a<2;a+=1){const c=i.points[a];this.warmData[r+1+4*a]=c.id,this.warmData[r+2+4*a]=c.jn,this.warmData[r+3+4*a]=c.jt,this.warmData[r+4+4*a]=c.kicked?1:0}}this.warmCount=s}restore(t,e){let s=0,n=this.warmCount-1;for(;s<=n;){const i=s+n>>1,r=this.warmKey[i];if(r===e){const a=9*i;t.count=this.warmData[a];for(let c=0;c<2;c+=1){const l=t.points[c];l.id=this.warmData[a+1+4*c],l.jn=this.warmData[a+2+4*c],l.jt=this.warmData[a+3+4*c],l.kicked=this.warmData[a+4+4*c]===1}return}r<e?s=i+1:n=i-1}}}const ia=1.5,ra=1;class oa{constructor(t){x(this,"pe");x(this,"re");x(this,"known");x(this,"mass");x(this,"vol");x(this,"out",new Float64Array(3));x(this,"front");x(this,"next");x(this,"vp");x(this,"vr");x(this,"queued");x(this,"tag",0);this.w=t;const e=t().grid.n;this.pe=new Float64Array(e),this.re=new Float64Array(e),this.known=new Uint8Array(e),this.mass=new Float64Array(e),this.vol=new Float64Array(e),this.front=new Int32Array(e),this.next=new Int32Array(e),this.vp=new Float64Array(e),this.vr=new Float64Array(e),this.queued=new Int32Array(e)}extend(){const t=this.w(),{grid:e,particles:s,liquid:n,gas:i,regions:r}=t,{nx:a,ny:c,n:l,dx:u}=e,{pe:f,re:d,known:m,mass:g,vol:h}=this;g.fill(0),h.fill(0);for(let A=0;A<s.count;A+=1){const k=e.cellAt(s.x[A],s.y[A]);k<0||(g[k]+=s.mass[A],h[k]+=s.mass[A]/s.rho[A])}for(let A=0;A<l;A+=1){const k=e.kind[A];k===st?(f[A]=e.pl[A],d[A]=h[A]>0?g[A]/h[A]:n.rhoRef,m[A]=1):k===U&&e.solid[A]===0?(f[A]=r.pAt(A)-t.pRef+e.pg[A],d[A]=i.rho[A]>0?i.rho[A]:r.rhoAmb,m[A]=1):(f[A]=0,d[A]=0,m[A]=0)}const p=t.gy*u,v=this.front,b=this.next,y=this.vp,F=this.vr,w=this.queued,P=++this.tag;let _=0;for(let A=0;A<l;A+=1){if(m[A]!==0)continue;const k=A%a,M=(A-k)/a;(k>0&&m[A-1]===1||k<a-1&&m[A+1]===1||M>0&&m[A-a]===1||M<c-1&&m[A+a]===1)&&(v[_++]=A,w[A]=P)}for(;_>0;){for(let k=0;k<_;k+=1){const M=v[k],S=M%a,T=(M-S)/a;let I=0,O=0,D=0;S>0&&m[M-1]!==0&&(I+=f[M-1],O+=d[M-1],D+=1),S<a-1&&m[M+1]!==0&&(I+=f[M+1],O+=d[M+1],D+=1),T>0&&m[M-a]!==0&&(I+=f[M-a]-d[M-a]*p,O+=d[M-a],D+=1),T<c-1&&m[M+a]!==0&&(I+=f[M+a]+d[M+a]*p,O+=d[M+a],D+=1),y[k]=D>0?I/D:0,F[k]=D>0?O/D:0}let A=0;for(let k=0;k<_;k+=1){const M=v[k];f[M]=y[k],d[M]=F[k],m[M]=2}for(let k=0;k<_;k+=1){const M=v[k],S=M%a,T=(M-S)/a;for(let I=0;I<4;I+=1){const O=S+(I===0?-1:I===1?1:0),D=T+(I===2?-1:I===3?1:0);if(O<0||D<0||O>=a||D>=c)continue;const B=O+D*a;m[B]!==0||w[B]===P||(w[B]=P,b[A++]=B)}}_=A;for(let k=0;k<A;k+=1)v[k]=b[k]}}pressureAt(t,e){const s=this.w().grid,{nx:n,ny:i,dx:r}=s,a=Math.min(n-1.0001,Math.max(0,t/r-.5)),c=Math.min(i-1.0001,Math.max(0,e/r-.5)),l=Math.floor(a),u=Math.floor(c),f=a-l,d=c-u;let m=0,g=0;for(let h=0;h<2;h+=1)for(let p=0;p<2;p+=1){const v=l+p+(u+h)*n;if(this.known[v]===0)continue;const b=(p===0?1-f:f)*(h===0?1-d:d);m+=b*this.pe[v],g+=b}return g>0?m/g:0}force(t){const e=this.out,s=Math.cos(t.a),n=Math.sin(t.a),i=t.dx*t.depth;let r=0,a=0,c=0;for(let l=0;l<t.ne;l+=1){const u=t.ex[l],f=t.ey[l],d=t.ed[l],m=d===0?-1:d===1?1:0,g=d===2?-1:d===3?1:0,h=s*u-n*f,p=n*u+s*f,v=s*m-n*g,b=n*m+s*g,y=this.sideAt(t.x+h,t.y+p,v,b)*i;r-=y*v,a-=y*b,c-=y*(h*b-p*v)}return e[0]=r,e[1]=a,e[2]=c,e}sideAt(t,e,s,n){const i=this.w(),r=i.grid,{dx:a}=r,c=t+.5*a*s,l=e+.5*a*n,u=Math.min(r.nx-1.0001,Math.max(0,c/a-.5)),f=Math.min(r.ny-1.0001,Math.max(0,l/a-.5)),d=Math.floor(u),m=Math.floor(f),g=u-d,h=f-m;let p=0,v=0,b=0,y=0;for(let F=0;F<2;F+=1)for(let w=0;w<2;w+=1){const P=d+w,_=m+F,A=P+_*r.nx;if(this.known[A]!==1)continue;const k=(P+.5)*a,M=(_+.5)*a;if((k-t)*s+(M-e)*n<=0)continue;const S=(w===0?1-g:g)*(F===0?1-h:h)+1e-6,T=this.pe[A]+this.re[A]*i.gy*(M-e);r.kind[A]===st?(p+=S*T,v+=S):(b+=S*T,y+=S)}return v>0&&y>0?Math.max(p/v,b/y):v>0?p/v:y>0?b/y:this.pressureAt(t,e)}addedMass(t){const e=this.w(),s=e.grid,n=Math.cos(t.a),i=Math.sin(t.a);let r=0;for(let l=0;l<t.ne;l+=1){const u=t.ed[l],f=t.ex[l]+(u===0?-.5:u===1?.5:0)*t.dx,d=t.ey[l]+(u===2?-.5:u===3?.5:0)*t.dx,m=s.cellAt(t.x+n*f-i*d,t.y+i*f+n*d);m>=0&&s.kind[m]===st&&(r+=1)}const a=t.ne>0?r/t.ne:0,c=e.liquid.rhoRef;t.ma=ia*c*a*t.hullA*t.depth,t.Ia=ra*c*a*t.hullJ*t.depth}}const Pe=.01;class ca{constructor(t){x(this,"w");x(this,"mark");x(this,"pos");x(this,"stamp",0);x(this,"cells",new Int32Array(64));x(this,"cellVoxel",new Int32Array(64));x(this,"count",new Int32Array(64));x(this,"l0",new Float64Array(2));x(this,"l1",new Float64Array(2));x(this,"wp",new Float64Array(2));x(this,"seen");x(this,"queue");x(this,"nx",0);x(this,"ny",0);x(this,"seenStamp",0);x(this,"sumA",new Float64Array(64));x(this,"sumB",new Float64Array(64));this.w=t,this.mark=new Int32Array(t.grid.n),this.pos=new Int32Array(t.grid.n),this.seen=new Int32Array(t.grid.n),this.queue=new Int32Array(t.grid.n)}rasterise(t,e){const s=this.w.grid,{nx:n,ny:i,dx:r}=s,a=t.index+1,c=++this.stamp,l=this.mark,u=this.pos,f=t.rmax+r,d=Math.max(0,Math.floor((t.x-f)/r)),m=Math.min(n-1,Math.floor((t.x+f)/r)),g=Math.max(0,Math.floor((t.y-f)/r)),h=Math.min(i-1,Math.floor((t.y+f)/r)),p=Math.cos(t.a),v=Math.sin(t.a),b=(m-d+1)*(h-g+1)+1;this.cells.length<b&&(this.cells=new Int32Array(2*b),this.cellVoxel=new Int32Array(2*b));const y=this.cells,F=this.cellVoxel;let w=0;for(let T=g;T<=h;T+=1){const I=(T+.5)*r-t.y;for(let O=d;O<=m;O+=1){const D=O+T*n;if(s.solid[D]!==0&&s.owner[D]!==a||e!==void 0&&e(D))continue;const B=(O+.5)*r-t.x,q=t.voxelAtLocal(p*B+v*I,-v*B+p*I);q<0||(y[w]=D,F[w]=q,l[D]=c,u[D]=w,w+=1)}}if(w===0){const T=s.cellAt(t.x,t.y);if(T<0||s.solid[T]!==0&&s.owner[T]!==a)return 0;y[0]=T,F[0]=this.nearestVoxel(t,0,0),l[T]=c,u[T]=0,w=1}let P=0;for(let T=0;T<w;T+=1){const I=y[T];s.owner[I]!==a&&(P+=1,this.gasOut(I,c),s.kind[I]=ht,s.owner[I]=a,s.solid[I]=t.mat[F[T]]+1)}for(let T=0;T<t.nc;T+=1){const I=t.cells[T];l[I]===c||s.owner[I]!==a||(P+=1,this.vacate(I))}this.count.length<t.nv&&(this.count=new Int32Array(2*t.nv));const _=this.count;_.fill(0,0,t.nv);for(let T=0;T<w;T+=1)_[F[T]]+=1;let A=w;for(let T=0;T<t.nv;T+=1)_[T]===0&&(A+=1);t.wv.length<A&&(t.wv=new Int32Array(A),t.wc=new Int32Array(A),t.ww=new Float64Array(A));let k=0;for(let T=0;T<w;T+=1)t.wv[k]=F[T],t.wc[k]=T,t.ww[k]=1/_[F[T]],k+=1;for(let T=0;T<t.nv;T+=1)_[T]===0&&(t.wv[k]=T,t.wc[k]=this.hostOf(t,T,w,c),t.ww[k]=1,k+=1);t.nw=k,t.cells.length<w&&(t.cells=new Int32Array(w),t.E0=new Float64Array(w),t.F0=new Float64Array(w),t.K0=new Float64Array(w));for(let T=0;T<w;T+=1){const I=y[T];t.cells[T]=I,s.Es[I]=0,s.capB[I]=0,s.film[I]=0,s.crust[I]=0}t.nc=w;const M=s.vCell;for(let T=0;T<k;T+=1){const I=t.wv[T],O=t.cells[t.wc[T]],D=t.ww[T],B=vt[t.mat[I]];s.Es[O]+=D*t.E[I],s.capB[O]+=D*B.rho*B.cp*M,s.film[O]+=D*t.film[I],s.crust[O]+=D*t.crust[I]}const S=this.w.heat;for(let T=0;T<w;T+=1){const I=t.cells[T],O=F[T];s.solid[I]=t.mat[O]+1,s.heater[I]=t.heater[O],s.role[I]=t.heater[O]>=0?1:0,s.owner[I]=a,s.kind[I]=ht,S.deriveSolid(I),t.E0[T]=s.Es[I],t.F0[T]=s.film[I],t.K0[T]=s.crust[I]}return this.faces(t,c),t.ux=t.vx,t.uy=t.vy,t.uw=t.w,t.rx=t.x,t.ry=t.y,t.ra=t.a,P}collect(t){const e=this.w.grid;if(t.nc===0)return;const s=e.vCell,n=this.scratchSum(t.nc),i=this.scratchSum2(t.nc);for(let r=0;r<t.nw;r+=1){const a=vt[t.mat[t.wv[r]]];n[t.wc[r]]+=t.ww[r]*a.rho*a.cp*s,i[t.wc[r]]+=t.ww[r]}for(let r=0;r<t.nw;r+=1){const a=t.wv[r],c=t.wc[r],l=t.cells[c],u=vt[t.mat[a]],f=e.Es[l]-t.E0[c];f!==0&&n[c]>0&&(t.E[a]+=f*t.ww[r]*u.rho*u.cp*s/n[c]);const d=e.film[l]-t.F0[c];d>0?t.film[a]+=d*t.ww[r]/i[c]:d<0&&t.F0[c]>0&&(t.film[a]+=d*t.ww[r]*t.film[a]/t.F0[c]);const m=e.crust[l]-t.K0[c];m>0?t.crust[a]+=m*t.ww[r]/i[c]:m<0&&t.K0[c]>0&&(t.crust[a]+=m*t.ww[r]*t.crust[a]/t.K0[c])}for(let r=0;r<t.nc;r+=1){const a=t.cells[r];t.E0[r]=e.Es[a],t.F0[r]=e.film[a],t.K0[r]=e.crust[a]}}release(t){const e=this.w.grid;for(let s=0;s<t.nf;s+=1)this.clearFace(t.faces[s]);t.nf=0;for(let s=0;s<t.nc;s+=1)e.owner[t.cells[s]]===t.index+1&&this.vacate(t.cells[s]);t.nc=0,t.nw=0}stopFaces(t){for(let e=0;e<t.nf;e+=1)this.clearFace(t.faces[e]);t.nf=0}pushOut(t,e,s,n){const i=this.w.particles,r=this.w.bubbles,a=t.rmax+this.w.grid.dx;for(let c=0;c<i.count;c+=1){const l=i.x[c],u=i.y[c];Math.abs(l-t.x)>a||Math.abs(u-t.y)>a||this.moveOut(t,l,u,l,u,e,s,n)&&(i.x[c]=this.wp[0],i.y[c]=this.wp[1],this.stopInto(t,i.vx,i.vy,c))}for(let c=0;c<r.count;c+=1){const l=r.x[c],u=r.y[c];Math.abs(l-t.x)>a||Math.abs(u-t.y)>a||this.moveOut(t,l,u,l,u,e,s,n)&&(r.x[c]=this.wp[0],r.y[c]=this.wp[1],r.site[c]=-1,this.stopInto(t,r.vx,r.vy,c))}}collidePoint(t,e,s,n,i,r){return this.moveOut(t,n,i,e,s,t.x,t.y,t.a)?(r[0]=this.wp[0],r[1]=this.wp[1],r[2]=this.nx,r[3]=this.ny,!0):!1}moveOut(t,e,s,n,i,r,a,c){const l=this.l1;if(we.toLocal(t.x,t.y,t.a,e,s,l),t.voxelAtLocal(l[0],l[1])<0)return!1;const u=this.l0;we.toLocal(r,a,c,n,i,u);const f=t.dx,d=(u[0]+t.cx)/f,m=(u[1]+t.cy)/f,g=(l[0]+t.cx)/f,h=(l[1]+t.cy)/f;let p=-1,v=g,b=h;if(t.voxel(Math.floor(d),Math.floor(m))<0){const S=g-d,T=h-m;let I=Math.floor(d),O=Math.floor(m);const D=S>0?1:-1,B=T>0?1:-1;let q=S!==0?(I+(D>0?1:0)-d)/S:1/0,R=T!==0?(O+(B>0?1:0)-m)/T:1/0;const E=S!==0?Math.abs(1/S):1/0,z=T!==0?Math.abs(1/T):1/0;for(let N=0;N<4096;N+=1){let L,V;if(q<R?(I+=D,L=q,q+=E,V=D>0?0:1):(O+=B,L=R,R+=z,V=B>0?2:3),L>1+1e-9)break;if(t.voxel(I,O)>=0){p=V,v=d+L*S+(V===0?-Pe:V===1?Pe:0),b=m+L*T+(V===2?-Pe:V===3?Pe:0);break}}}if(p<0){const S=Math.floor(g),T=Math.floor(h);let I=1/0;for(let O=1;O<=4&&I===1/0;O+=1)for(let D=T-O;D<=T+O;D+=1)for(let B=S-O;B<=S+O;B+=1){if(t.voxel(B,D)>=0)continue;const q=Math.min(B+1-Pe,Math.max(B+Pe,g)),R=Math.min(D+1-Pe,Math.max(D+Pe,h)),E=(q-g)**2+(R-h)**2;E<I&&(I=E,v=q,b=R,p=Math.abs(q-g)>Math.abs(R-h)?q<g?0:1:R<h?2:3)}if(p<0)return!1}const y=Math.cos(t.a),F=Math.sin(t.a),w=v*f-t.cx,P=b*f-t.cy,_=this.w.grid,A=1e-4*f;this.wp[0]=Math.min(_.w-A,Math.max(A,t.x+y*w-F*P)),this.wp[1]=Math.min(_.h-A,Math.max(A,t.y+F*w+y*P));const k=p===0?-1:p===1?1:0,M=p===2?-1:p===3?1:0;return this.nx=y*k-F*M,this.ny=F*k+y*M,!0}stopInto(t,e,s,n){const i=this.wp[0]-t.x,r=this.wp[1]-t.y,a=t.vx-t.w*r,c=t.vy+t.w*i,l=(e[n]-a)*this.nx+(s[n]-c)*this.ny;l<0&&(e[n]-=l*this.nx,s[n]-=l*this.ny)}nearestVoxel(t,e,s){let n=0,i=1/0;for(let r=0;r<t.nv;r+=1){const a=((t.vi[r]+.5)*t.dx-t.cx-e)**2+((t.vj[r]+.5)*t.dx-t.cy-s)**2;a<i&&(i=a,n=r)}return n}hostOf(t,e,s,n){const i=this.w.grid,r=(t.vi[e]+.5)*t.dx-t.cx,a=(t.vj[e]+.5)*t.dx-t.cy,c=this.wp;we.toWorld(t.x,t.y,t.a,r,a,c);const l=Math.floor(c[0]/i.dx),u=Math.floor(c[1]/i.dx);let f=-1,d=1/0;for(let m=-1;m<=1;m+=1)for(let g=-1;g<=1;g+=1){const h=l+g,p=u+m;if(h<0||p<0||h>=i.nx||p>=i.ny)continue;const v=h+p*i.nx;if(this.mark[v]!==n)continue;const b=((h+.5)*i.dx-c[0])**2+((p+.5)*i.dx-c[1])**2;b<d&&(d=b,f=this.pos[v])}if(f>=0)return f;for(let m=0;m<s;m+=1){const g=this.cells[m],h=((g%i.nx+.5)*i.dx-c[0])**2+((Math.floor(g/i.nx)+.5)*i.dx-c[1])**2;h<d&&(d=h,f=m)}return Math.max(0,f)}faces(t,e){const s=this.w.grid,{nx:n,ny:i,dx:r,nu:a}=s;for(let u=0;u<t.nf;u+=1)this.clearFace(t.faces[u]);t.faces.length<4*t.nc&&(t.faces=new Int32Array(4*t.nc+16));let c=0;const l=(u,f)=>{u<a?s.usol[u]=f:s.vsol[u-a]=f,t.faces[c++]=u};for(let u=0;u<t.nc;u+=1){const f=t.cells[u],d=f%n,m=(f-d)/n,g=(d+.5)*r,h=(m+.5)*r;d>0&&this.mark[f-1]!==e&&l(d+m*(n+1),t.vx-t.w*(h-t.y)),d<n-1&&this.mark[f+1]!==e&&l(d+1+m*(n+1),t.vx-t.w*(h-t.y)),m>0&&this.mark[f-n]!==e&&l(a+d+m*n,t.vy+t.w*(g-t.x)),m<i-1&&this.mark[f+n]!==e&&l(a+d+(m+1)*n,t.vy+t.w*(g-t.x))}t.nf=c}clearFace(t){const e=this.w.grid;t<e.nu?e.usol[t]=0:e.vsol[t-e.nu]=0}gasOut(t,e){const s=this.w.grid,n=this.w.gas;if(n.massOf(t)<=0&&s.Hg[t]===0)return;const{nx:i,ny:r}=s,a=t%i,c=(t-a)/i;for(let g=1;g<=3;g+=1){let h=0,p=0;for(let b=c-g;b<=c+g;b+=1)for(let y=a-g;y<=a+g;y+=1){if(Math.max(Math.abs(y-a),Math.abs(b-c))!==g||y<0||b<0||y>=i||b>=r)continue;const F=y+b*i;s.solid[F]!==0||this.mark[F]===e||(h+=n.vgas[F]>0?n.vgas[F]:s.vCell,p+=1)}if(p===0)continue;let v=h;for(let b=c-g;b<=c+g;b+=1)for(let y=a-g;y<=a+g;y+=1){if(Math.max(Math.abs(y-a),Math.abs(b-c))!==g||y<0||b<0||y>=i||b>=r)continue;const F=y+b*i;if(s.solid[F]!==0||this.mark[F]===e)continue;const w=n.vgas[F]>0?n.vgas[F]:s.vCell;p-=1,n.move(t,F,p===0?1:Math.min(1,w/v)),v-=w}return}const l=this.seen,u=this.queue,f=++this.seenStamp;let d=0,m=0;for(u[m++]=t,l[t]=f;d<m;){const g=u[d++];if(g!==t&&s.solid[g]===0&&this.mark[g]!==e){n.move(t,g,1);return}const h=g%i,p=(g-h)/i;for(let v=0;v<4;v+=1){const b=h+(v===0?-1:v===1?1:0),y=p+(v===2?-1:v===3?1:0);if(b<0||y<0||b>=i||y>=r)continue;const F=b+y*i;l[F]!==f&&(l[F]=f,u[m++]=F)}}}vacate(t){const e=this.w.grid,s=this.w.gas,{nx:n,ny:i}=e;e.solid[t]=0,e.role[t]=0,e.heater[t]=-1,e.Es[t]=0,e.film[t]=0,e.crust[t]=0,e.owner[t]=0,e.capB[t]=0;const r=t%n,a=(t-r)/n;let c=0,l=0,u=0,f=!1;for(let m=0;m<4;m+=1){const g=r+(m===0?-1:m===1?1:0),h=a+(m===2?-1:m===3?1:0);if(g<0||h<0||g>=n||h>=i)continue;const p=g+h*n;if(e.kind[p]===st&&(f=!0),e.kind[p]!==U||s.massOf(p)<=0)continue;const v=s.vgas[p]>0?s.vgas[p]:e.vCell;c+=v,l+=v*s.rho[p],u+=v*e.T[p]}if(c<=0){e.kind[t]=f?st:U,s.deriveCell(t);return}e.kind[t]=U,e.T[t]=u/c;const d=l/c*Math.max(.001,1-e.phi[t]-e.alpha[t])*e.vCell;for(let m=0;m<4;m+=1){const g=r+(m===0?-1:m===1?1:0),h=a+(m===2?-1:m===3?1:0);if(g<0||h<0||g>=n||h>=i)continue;const p=g+h*n;if(e.kind[p]!==U)continue;const v=s.massOf(p);if(v<=0)continue;const b=(s.vgas[p]>0?s.vgas[p]:e.vCell)/c;s.move(p,t,Math.min(.25,d*b/v))}s.deriveCell(t)}scratchSum(t){return this.sumA.length<t&&(this.sumA=new Float64Array(2*t)),this.sumA.fill(0,0,t),this.sumA}scratchSum2(t){return this.sumB.length<t&&(this.sumB=new Float64Array(2*t)),this.sumB.fill(0,0,t),this.sumB}}const aa=.1,la=1,fa=.002,ua=.5,ha=1.02,da=.5;class ma{constructor(t){x(this,"list",[]);x(this,"raster");x(this,"forces");x(this,"contacts");x(this,"version",0);x(this,"prev",new Float64Array(0));x(this,"awakeNow",0);x(this,"hitOut",new Float64Array(4));x(this,"dv",new Float64Array(3));x(this,"probeS",[]);x(this,"probeJ",[]);x(this,"m9",new Float64Array(9));this.e=t,this.raster=new ca(t),this.forces=new oa(()=>t),this.contacts=new na(()=>t.grid)}get anyFree(){return this.list.some(t=>t.free)}get anyAwake(){return this.list.some(t=>t.awake)}changed(){this.version+=1,this.contacts.invalidate()}adopt(t,e,s,n=0){if(t.length===0)return null;const i=this.e.grid,r=we.fromCells(this.list.length,e,i,t);n>0&&(r.shape=zi,r.radius=n,r.derive()),r.pinned=s,r.asleep=!0;const a=t.length;r.nc=a,r.cells=Int32Array.from(t),r.E0=new Float64Array(a),r.F0=new Float64Array(a),r.K0=new Float64Array(a),r.wv=new Int32Array(a),r.wc=new Int32Array(a),r.ww=new Float64Array(a),r.nw=a;for(let c=0;c<a;c+=1){const l=t[c];r.E0[c]=i.Es[l],r.F0[c]=i.film[l],r.K0[c]=i.crust[l],r.wv[c]=c,r.wc[c]=c,r.ww[c]=1,i.owner[l]=r.index+1}return this.list.push(r),this.growPrev(),this.changed(),r}turn(t,e,s,n){if(n===0)return;this.raster.collect(t),this.raster.release(t);const i=t.x,r=t.y,a=t.a;t.rotateAbout(e,s,n),this.raster.rasterise(t),this.raster.pushOut(t,i,r,a),this.changed()}prepare(){const t=this.e,e=t.grid;let s=0,n=!1,i=e.nx,r=e.ny,a=-1,c=-1;this.awakeNow=0;for(const l of this.list){if(!l.awake)continue;n=!0,this.awakeNow+=1;const u=l.rmax+e.dx;for(const[g,h]of[[l.rx,l.ry],[l.x,l.y]])i=Math.min(i,Math.floor((g-u)/e.dx)),a=Math.max(a,Math.floor((g+u)/e.dx)),r=Math.min(r,Math.floor((h-u)/e.dx)),c=Math.max(c,Math.floor((h+u)/e.dx));const f=l.rx,d=l.ry,m=l.ra;s+=this.raster.rasterise(l),this.raster.pushOut(l,f,d,m)}if(n&&(t.liquid.weightsDirty=!0),s>0){e.updateStatic(i-5,r-5,a+5,c+5),t.regions.label();for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]!==0&&(t.regions.p0[l]=t.pRef);t.bubbleModel.rebuildSites()}return s}finish(t){if(!this.anyFree)return;const e=this.e,s=e.grid;this.forces.extend();for(const i of this.list){if(!i.free||!i.asleep)continue;this.forces.force(i)[1]>ha*i.m*e.gy&&this.wake(i)}const n=this.prev;for(const i of this.list){if(!i.awake)continue;this.raster.collect(i);const r=this.forces.force(i),a=3*i.index,c=i.ma6;i.maOk||(this.forces.addedMass(i),c.fill(0),c[0]=i.ma,c[3]=i.ma,c[5]=i.Ia);const l=t*r[0]+c[0]*n[a]+c[1]*n[a+1]+c[2]*n[a+2],u=t*(r[1]-i.m*e.gy)+c[1]*n[a]+c[3]*n[a+1]+c[4]*n[a+2],f=t*r[2]+c[2]*n[a]+c[4]*n[a+1]+c[5]*n[a+2];pa(i.m+c[0],c[1],c[2],i.m+c[3],c[4],i.I+c[5],l,u,f,this.dv),i.vx+=this.dv[0],i.vy+=this.dv[1],i.w+=this.dv[2],n[a]=this.dv[0],n[a+1]=this.dv[1],n[a+2]=this.dv[2]}this.contacts.step(t,this.list,this.version,aa*s.dx,la*s.dx);for(const i of this.contacts.toWake)this.wake(this.list[i]);for(const i of this.list)if(i.awake){if(i.x+=t*i.vx,i.y+=t*i.vy,i.a+=t*i.w,i.x<0||i.y<0||i.x>s.w||i.y>s.h){this.escape(i);continue}i.rest=i.speed()<fa&&this.contacts.touches(i)?i.rest+t:0,i.rest>=ua&&this.sleep(i)}}hitPoint(t,e,s,n,i){if(this.awakeNow===0)return 0;const r=this.e.grid,a=this.hitOut;let c=0;for(const l of this.list){if(!l.awake)continue;const u=l.rmax+r.dx;if(Math.abs(s-l.x)>u||Math.abs(n-l.y)>u)continue;if(this.raster.collidePoint(l,t,e,s,n,a))return i[0]=a[0],i[1]=a[1],i[2]=a[2],i[3]=a[3],i[4]=l.vx-l.w*(a[1]-l.y),i[5]=l.vy+l.w*(a[0]-l.x),1;const f=r.cellAt(s,n);f>=0&&r.owner[f]===l.index+1&&(c=2)}return c}probe(t,e,s,n){const i=this.e.grid,{nx:r,dx:a,depth:c}=i;for(const l of this.list){if(!l.awake)continue;const u=l.index+1,f=this.probeS,d=this.probeJ;f.length=0,d.length=0;for(let p=0;p<l.nc;p+=1){const v=l.cells[p];if(i.owner[v]!==u)continue;const b=v%r,y=(v-b)/r;for(let F=0;F<4;F+=1){const w=b+(F===0?-1:F===1?1:0),P=y+(F===2?-1:F===3?1:0);if(w<0||P<0||w>=r||P>=i.ny)continue;const _=w+P*r;if(i.kind[_]!==st)continue;const A=(b+.5+(F===0?-.5:F===1?.5:0))*a,k=(y+.5+(F===2?-.5:F===3?.5:0))*a;f.push(t.at(w-e,P-s)),F===0?d.push(1,0,-(k-l.y)):F===1?d.push(-1,0,k-l.y):F===2?d.push(0,1,A-l.x):d.push(0,-1,-(A-l.x))}}if(f.length===0){l.ma6.fill(0),l.maOk=!0;continue}const m=t.system,g=this.m9;for(let p=0;p<3;p+=1){m.b.fill(0),m.x.fill(0);for(let v=0;v<f.length;v+=1)m.b[f[v]]-=a*d[3*v+p];t.solve(1e-4,40,!0);for(let v=0;v<3;v+=1){let b=0;for(let y=0;y<f.length;y+=1)b+=m.x[f[y]]*d[3*y+v];g[3*v+p]=-n*a*c*b}}const h=l.ma6;h[0]=g[0],h[1]=.5*(g[1]+g[3]),h[2]=.5*(g[2]+g[6]),h[3]=g[4],h[4]=.5*(g[5]+g[7]),h[5]=g[8],l.maOk=!0}}dtLimit(){let t=1/0;for(const e of this.list){if(!e.awake)continue;const s=e.speed();s>0&&(t=Math.min(t,da*e.dx/s))}return t}wake(t){if(!t.free||!t.asleep)return;this.raster.collect(t),t.asleep=!1,t.rest=0,t.maOk=!1;const e=3*t.index;this.prev[e]=0,this.prev[e+1]=0,this.prev[e+2]=0}sleep(t){t.asleep=!0,t.rest=0,t.vx=0,t.vy=0,t.w=0,t.ux=0,t.uy=0,t.uw=0,this.raster.stopFaces(t)}escape(t){const e=this.e.flows;this.raster.collect(t);for(let n=0;n<t.nv;n+=1)e.escapedEnergy+=t.E[n],e.escapedWater+=t.film[n],e.escapedSalt+=t.crust[n];this.raster.release(t),t.keepVoxels(()=>!1),t.gone=!0,this.changed();const s=this.e;s.grid.updateStatic(),s.regions.label();for(let n=0;n<s.regions.count;n+=1)s.regions.open[n]!==0&&(s.regions.p0[n]=s.pRef);s.bubbleModel.rebuildSites(),s.liquid.weightsDirty=!0}wakeFree(){for(const t of this.list)this.wake(t)}settleStart(){for(const t of this.list)t.free&&this.wake(t)}bodyAt(t,e){const s=new Float64Array(2),n=this.e.grid.dx;for(const i of[0,1])for(let r=this.list.length-1;r>=0;r-=1){const a=this.list[r];if(!a.gone){for(let c=-i;c<=i;c+=1)for(let l=-i;l<=i;l+=1)if(!(i===1&&l===0&&c===0)&&(we.toLocal(a.x,a.y,a.a,t+l*n,e+c*n,s),a.voxelAtLocal(s[0],s[1])>=0))return a}}return null}pin(t,e){t.pinned!==e&&(e?(t.awake&&(this.raster.collect(t),this.sleep(t)),t.pinned=!0):(t.pinned=!1,t.asleep=!0,this.wake(t)))}carve(t){const e=this.e,s=e.grid,n=new Float64Array(2),i=a=>t((a%s.nx+.5)*s.dx,(Math.floor(a/s.nx)+.5)*s.dx),r=this.list.length;for(let a=0;a<r;a+=1){const c=this.list[a];if(c.gone)continue;const l=new Uint8Array(c.nv);let u=!1;for(let g=0;g<c.nv;g+=1)we.toWorld(c.x,c.y,c.a,(c.vi[g]+.5)*c.dx-c.cx,(c.vj[g]+.5)*c.dx-c.cy,n),t(n[0],n[1])&&(l[g]=1,u=!0);let f=!1;for(let g=0;g<c.nc;g+=1)s.owner[c.cells[g]]===c.index+1&&i(c.cells[g])&&(f=!0);if(!u&&!f)continue;this.raster.collect(c),this.raster.release(c);for(let g=0;g<c.nv;g+=1)l[g]!==0&&(e.ledger.energy-=c.E[g],e.ledger.water-=c.film[g],e.ledger.salt-=c.crust[g]);if(c.keepVoxels(g=>l[g]===0),c.gone)continue;const d=new Int32Array(c.nv),m=c.components(d);for(let g=1;g<m;g+=1){const h=new we(this.list.length,c.key,c.dx,c.depth),p=[];for(let y=0;y<c.nv;y+=1)d[y]===g&&p.push(y);h.setVoxels(p.length,Int32Array.from(p,y=>c.vi[y]),Int32Array.from(p,y=>c.vj[y]),Uint8Array.from(p,y=>c.mat[y]),Float64Array.from(p,y=>c.E[y]),Int16Array.from(p,y=>c.heater[y]),Float64Array.from(p,y=>c.film[y]),Float64Array.from(p,y=>c.crust[y]));const v=Math.cos(c.a),b=Math.sin(c.a);h.a=c.a,h.x=c.x+v*(h.cx-c.cx)-b*(h.cy-c.cy),h.y=c.y+b*(h.cx-c.cx)+v*(h.cy-c.cy),h.pinned=c.pinned,h.asleep=c.asleep,h.vx=c.vx,h.vy=c.vy,h.w=c.w,this.list.push(h),this.growPrev(),this.raster.rasterise(h,i)}m>1&&c.keepVoxels(g=>d[g]===0),this.raster.rasterise(c,i)}this.changed()}lift(t){const e=this.e.grid,s=[];for(const n of this.list){if(n.gone)continue;let i=!1;for(let r=0;r<n.nc&&!i;r+=1)e.owner[n.cells[r]]===n.index+1&&t(n.cells[r])&&(i=!0);i&&(this.raster.collect(n),this.raster.release(n),s.push(n))}return s}place(t,e,s){const n=this.e.grid;for(const i of t)i.x+=e*n.dx,i.y+=s*n.dx,this.raster.rasterise(i),this.raster.pushOut(i,i.x,i.y,i.a);t.length>0&&this.changed()}growPrev(){if(this.prev.length>=3*this.list.length)return;const t=new Float64Array(3*this.list.length+24);t.set(this.prev),this.prev=t}}function pa(o,t,e,s,n,i,r,a,c,l){const u=s*i-n*n,f=e*n-t*i,d=t*n-e*s,m=o*u+t*f+e*d,g=o*i-e*e,h=t*e-o*n,p=o*s-t*t;l[0]=(u*r+f*a+d*c)/m,l[1]=(f*r+g*a+h*c)/m,l[2]=(d*r+h*a+p*c)/m}const Zt=8;class ga{constructor(t){x(this,"cap");x(this,"count",0);x(this,"nextId",1);x(this,"x");x(this,"y");x(this,"z");x(this,"vx");x(this,"vy");x(this,"m");x(this,"H");x(this,"age");x(this,"site");x(this,"r");x(this,"V");x(this,"pb");x(this,"pv");x(this,"Tb");x(this,"dmdt");x(this,"force");x(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*ut),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*Zt),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<ut;i+=1)this.m[n*ut+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<Zt;i+=1)this.force[n*Zt+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<ut;s+=1)e+=this.m[t*ut+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<ut;s+=1)this.m[t*ut+s]=this.m[e*ut+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<Zt;s+=1)this.force[t*Zt+s]=this.force[e*Zt+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const nn=kt.species[0].saturation,de=nn.if97.n,Mo=de[0],So=de[1],Lo=de[2],Co=de[3],Oo=de[4],jo=de[5],Bo=de[6],Io=de[7],qo=de[8],ki=de[9],Ds=nn.Tc.v,xa=nn.rhoc.v,Ln=273.15,es=nn.vapourDensity.c;nn.liquidDensity.b;function Un(o){const t=o<Ln?Ln:o>Ds?Ds:o,e=t+qo/(t-ki),s=e*e+Mo*e+So,n=Lo*e*e+Co*e+Oo,i=jo*e*e+Bo*e+Io,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function _t(o){const t=o<611.213?611.213:o>22064e3?22064e3:o,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+Lo*e+jo,n=Mo*e*e+Co*e+Bo,i=So*e*e+Oo*e+Io,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=ki+r;return(a-Math.sqrt(a*a-4*(qo+ki*r)))/2}function Eo(o){const e=1-(o<Ln?Ln:o>Ds?Ds:o)/Ds,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,c=a*a*s,l=c*a*r*r;return xa*Math.exp(es[0]*n+es[1]*i+es[2]*r+es[3]*a+es[4]*c+es[5]*l)}const Cn=250,On=.01,rn=25001,yn=new Float64Array(rn),bn=new Float64Array(rn);for(let o=0;o<rn;o+=1)yn[o]=Un(Cn+o*On),bn[o]=Eo(Cn+o*On);function zs(o){const t=(o-Cn)/On;if(!(t>=0)||t>=rn-1)return Un(o);const e=t|0;return yn[e]+(t-e)*(yn[e+1]-yn[e])}function Oe(o){const t=(o-Cn)/On;if(!(t>=0)||t>=rn-1)return Eo(o);const e=t|0;return bn[e]+(t-e)*(bn[e+1]-bn[e])}const Ro=200;function Zn(o,t,e,s){const n=_t(o);return t/Oe(n)-e*Ot*n/(s-o)}function va(o,t){const e=Math.PI*t*t*t/6;if(o<=e)return Math.cbrt(3*o/(4*Math.PI));const s=Math.PI*t*t*t/4;return o<=s?t/2:Math.sqrt(o/(Math.PI*t))}function ya(o,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(o<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(o>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(o-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function ba(o,t,e,s,n,i,r,a=at){const c=o[t+Q],l=o[t+rt]/dt[rt]+o[t+ot]/dt[ot],u=c/dt[Q];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(u+l)*Ot*s/e)/(4*Math.PI)),d=e,m=0,g=s,h=0;for(let p=0;p<8;p+=1){if(d=e+2*gs(a,g)/f,l<=0)m=d,g=_t(m),h=c/Oe(g);else if(u<=1e-9*l)m=0,g=s,h=l*Ot*g/d;else{let b=611.213,y=d*(1-1e-12),F=Zn(b,c,l,d),w=Zn(y,c,l,d);if(F<=0)m=b;else if(w>=0)m=y;else{let P=0;m=.5*(b+y);for(let _=0;_<40;_+=1){m=(b*w-y*F)/(w-F);const A=Zn(m,c,l,d);if(Math.abs(A)<=1e-12*(c/Oe(s)+1e-30))break;A>0?(b=m,F=A,P===1&&(w/=2),P=1):(y=m,w=A,P===-1&&(F/=2),P=-1)}}g=_t(m),h=c/Oe(g)}const v=va(h,n);if(Math.abs(v-f)<=1e-7*f){f=v;break}f=v}r.r=f,r.V=h,r.pb=e+2*gs(a,g)/f,r.pv=m,r.Tb=g,ya(h,f,n,r)}function br(o,t,e,s){let n=0;for(let i=0;i<ut;i+=1)o[t+i]>0&&(n+=o[t+i]*s(i,e));return n}function wr(o,t,e,s,n,i,r,a,c,l){let u=0;if(2*e<=3*i){const v=o/i-.5,b=t/i-.5,y=Math.floor(v-.5),F=Math.floor(b-.5),w=v-y,P=b-F,_=.5*(1.5-w)**2,A=.75-(w-1)**2,k=.5*(w-.5)**2,M=.5*(1.5-P)**2,S=.75-(P-1)**2,T=.5*(P-.5)**2;let I=0;for(let O=0;O<3;O+=1){const D=F+O;if(D<0||D>=a)continue;const B=O===0?M:O===1?S:T;for(let q=0;q<3;q+=1){const R=y+q;if(R<0||R>=r)continue;const E=B*(q===0?_:q===1?A:k);c[u]=R+D*r,l[u]=E,I+=E,u+=1}}for(let O=0;O<u;O+=1)l[O]/=I;return u}const f=s<=Math.PI*n*n*n/6,d=Math.max(0,Math.floor((o-e)/i)),m=Math.min(r-1,Math.floor((o+e)/i)),g=Math.max(0,Math.floor((t-e)/i)),h=Math.min(a-1,Math.floor((t+e)/i));let p=0;for(let v=g;v<=h;v+=1)for(let b=d;b<=m;b+=1){let y=0;for(let F=0;F<4;F+=1){const w=(v+(F+.5)/4)*i-t;for(let P=0;P<4;P+=1){const _=(b+(P+.5)/4)*i-o,A=e*e-_*_-w*w;A>0&&(y+=f?Math.sqrt(A):1)}}y<=0||u>=c.length||(c[u]=b+v*r,l[u]=y,p+=y,u+=1)}if(p<=0)return c[0]=Math.min(r-1,Math.max(0,Math.floor(o/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,l[0]=1,1;for(let v=0;v<u;v+=1)l[v]/=p;return u}function wa(o,t,e,s,n,i){const{nx:r,ny:a}=o,c=e%r,l=(e-c)/r;let u=0,f=0;for(let d=0;d<=6&&(u===0||f<2*s);d+=1)for(let m=0;m<=d;m+=1)for(let g=-d;g<=d;g+=1){if(Math.max(Math.abs(g),m)!==d)continue;const h=c+g,p=l+m;if(h<0||p<0||h>=r||p>=a)continue;const v=h+p*r;if(o.kind[v]!==U||u>=n.length)continue;const b=Math.max(.001*o.vCell,t[v]);n[u]=v,i[u]=b,f+=b,u+=1}for(let d=0;d<u;d+=1)i[d]/=f;return u}function Fa(o,t){const e=Math.min(o.nx-1,Math.max(0,Math.floor(t/o.dx)));for(let s=o.ny-1;s>=0;s-=1)if(o.kind[e+s*o.nx]===U)return e+s*o.nx;return-1}const ss=.5;class Aa{constructor(t){x(this,"e");x(this,"ux0");x(this,"uy0");x(this,"vel",new Float64Array(2));x(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,c=r.x[t],l=r.y[t],u=r.r[t],f=r.V[t],d=Math.max(u+i.dx,2*i.dx),m=this.vel;let g=0,h=0;for(let ft=0;ft<8;ft+=1){const mt=ft*Math.PI/4;a.velocityAt(c+d*Math.cos(mt),l+d*Math.sin(mt),m),g+=m[0]/8,h+=m[1]/8}const p=i.cellAt(c,l),v=p>=0&&n.phase.Cl[p]>0?n.phase.Tl[p]:r.Tb[t],b=p>=0?n.phase.host[p]:0,y=n.phase.mixed?Xe(b,v):a.rhoRef,F=Ws(b,v),w=r.totalMass(t)/Math.max(1e-30,f),P=(g-this.ux0[t])/Math.max(e,1e-6),_=(h-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=g,this.uy0[t]=h,u<2e-5){r.vx[t]=g,r.vy[t]=h,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,c+e*g)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,l+e*h));return}const A=r.vx[t]-g,k=r.vy[t]-h,M=Math.hypot(A,k),S=2*u,T=Math.max(1e-6,y*M*S/F),I=Math.max(0,n.gy)*(y-w)*S*S/gs(b,v),D=.5*Math.max(24/T*(1+.15*Math.pow(T,.687)),8/3*(I/(I+4)))*y*this.front(t)*M,B=(w+ss*y)*f,q=y*f*P,R=y*f*(_+n.gy),E=-w*f*n.gy,z=ss*y*f*P,N=ss*y*f*_,L=s>0?ss*y*s:0,V=s<0?Math.min(-s,.2*f/e):0,tt=ss*y*V*A,Y=ss*y*V*k,X=(B*r.vx[t]+e*(q+z+tt)+e*(D+L)*g)/(B+e*(D+L)),C=(B*r.vy[t]+e*(R+E+N+Y)+e*(D+L)*h)/(B+e*(D+L));r.vx[t]=Number.isFinite(X)?X:g,r.vy[t]=Number.isFinite(C)?C:h;const $=-D*(X-g),H=-D*(C-h),nt=t*Zt;r.force[nt]=q,r.force[nt+1]=R,r.force[nt+2]=0,r.force[nt+3]=E,r.force[nt+4]=$,r.force[nt+5]=H,r.force[nt+6]=z+tt-L*(X-g),r.force[nt+7]=N+Y-L*(C-h),this.spreadForce(c,l,-($+r.force[nt+6])*(e/n.dt),-(H+r.force[nt+7])*(e/n.dt));let j=c+e*X,G=l+e*C;const W=i.sdfAt(j,G);if(W<u){const ft=.25*i.dx;let mt=i.sdfAt(j+ft,G)-i.sdfAt(j-ft,G),Tt=i.sdfAt(j,G+ft)-i.sdfAt(j,G-ft);const Mt=Math.hypot(mt,Tt);if(Mt>1e-12){mt/=Mt,Tt/=Mt,j+=(u-W)*mt,G+=(u-W)*Tt;const wt=r.vx[t]*mt+r.vy[t]*Tt;wt<0&&(r.vx[t]-=wt*mt,r.vy[t]-=wt*Tt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,j)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,G));const J=i.depth;r.z[t]=2*u>=J?J/2:Math.min(J-u,Math.max(u,r.z[t]))}spreadForce(t,e,s,n){const i=this.e.liquid,r=this.e.grid,{nx:a,ny:c,dx:l}=r,u=this.w3;let f=Math.floor(t/l-.5),d=t/l-f;u[0]=.5*(1.5-d)**2,u[1]=.75-(d-1)**2,u[2]=.5*(d-.5)**2;let m=Math.floor(e/l-1);d=e/l-.5-m,u[3]=.5*(1.5-d)**2,u[4]=.75-(d-1)**2,u[5]=.5*(d-.5)**2;for(let g=0;g<3;g+=1)for(let h=0;h<3;h+=1){const p=f+h,v=m+g;p<0||p>a||v<0||v>=c||(i.fU[p+v*(a+1)]+=s*u[h]*u[3+g])}f=Math.floor(t/l-1),d=t/l-.5-f,u[0]=.5*(1.5-d)**2,u[1]=.75-(d-1)**2,u[2]=.5*(d-.5)**2,m=Math.floor(e/l-.5),d=e/l-m,u[3]=.5*(1.5-d)**2,u[4]=.75-(d-1)**2,u[5]=.5*(d-.5)**2;for(let g=0;g<3;g+=1)for(let h=0;h<3;h+=1){const p=f+h,v=m+g;p<0||p>=a||v<0||v>c||(i.fV[p+v*a]+=n*u[h]*u[3+g])}}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const c=(n-r)/(a-r);return(1-c)*(Math.PI*s*s)/4+c*s*s}}class Do{constructor(t){x(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function _a(o,t,e){let s=(o^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const Pa=8,ka=210,Fr=1.805,Ta=3e-7;function Ar(o,t){const e=_t(t);return _t(t+2*Wi(e)/o)-e}class Ma{constructor(){x(this,"count",0);x(this,"cell",new Int32Array(0));x(this,"fluid",new Int32Array(0));x(this,"dir",new Uint8Array(0));x(this,"r",new Float32Array(0));x(this,"s",new Float32Array(0));x(this,"z",new Float32Array(0));x(this,"bubble",new Uint32Array(0));x(this,"pos",new Float64Array(2))}rebuild(t,e){const{nx:s,ny:n}=t,i=_t(Us),r=2*Wi(i)/(zs(i+1)-Us),a=ka*r,c=t.dx*t.depth,l=[],u=[],f=[],d=[],m=[],g=[],h=new Do(1);for(let p=0;p<t.n;p+=1){if(t.solid[p]===0)continue;const v=vt[t.solid[p]-1],b=p%s,y=(p-b)/s;for(let F=0;F<4;F+=1){const w=F===0?b-1:F===1?b+1:b,P=F===2?y-1:F===3?y+1:y;if(w<0||P<0||w>=s||P>=n)continue;const _=w+P*s;if(t.solid[_]!==0)continue;h.state=_a(e,p,F)||1;const A=Math.pow(a/v.cavRmax,Fr);let k=0;for(let M=0;M<Pa;M+=1){k+=h.exp();const S=a*Math.pow(k/(c*v.cavScale)+A,-1/Fr);if(S<Ta)break;l.push(p),u.push(_),f.push(F),d.push(S),m.push(h.next()),g.push(h.next())}}}this.count=l.length,this.cell=Int32Array.from(l),this.fluid=Int32Array.from(u),this.dir=Uint8Array.from(f),this.r=Float32Array.from(d),this.s=Float32Array.from(m),this.z=Float32Array.from(g),this.bubble=new Uint32Array(l.length)}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)vt[t.solid[this.cell[n]]-1].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){const n=this.cell[e],i=n%t.nx,r=(n-i)/t.nx,a=this.s[e],c=this.dir[e],l=t.dx;return c===0?(this.pos[0]=i*l-s,this.pos[1]=(r+a)*l):c===1?(this.pos[0]=(i+1)*l+s,this.pos[1]=(r+a)*l):c===2?(this.pos[0]=(i+a)*l,this.pos[1]=r*l-s):(this.pos[0]=(i+a)*l,this.pos[1]=(r+1)*l+s),this.pos}}const Sa=.0208,La=1;class Ca{constructor(t){x(this,"e");x(this,"burstVapour",0);x(this,"nucleated",0);x(this,"departed",0);x(this,"merged",0);x(this,"burst",0);x(this,"collapsed",0);x(this,"burstCold",0);x(this,"collapsedCold",0);x(this,"burstWarm",0);x(this,"collapsedWarm",0);x(this,"firstSuperheat",null);x(this,"firstMaterial",null);x(this,"departures",new Float64Array(256));x(this,"departureCount",0);x(this,"contactAngleOverride",null);x(this,"watch",-1);x(this,"watchFate",0);x(this,"sites",new Ma);x(this,"motion");x(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});x(this,"cells",new Int32Array(1024));x(this,"wts",new Float64Array(1024));x(this,"alphaTarget");x(this,"budget");x(this,"tsatCell");x(this,"dTb");x(this,"Fm");x(this,"vel",new Float64Array(2));x(this,"head");x(this,"next");x(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.dTb=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new Aa(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return Ar(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),u=Math.floor(c),f=Math.floor(l),d=c-u,m=l-f;let g=0,h=0;for(let p=0;p<2;p+=1)for(let v=0;v<2;v+=1){const b=u+v+(f+p)*i;if(n.solid[b]!==0)continue;const y=(v===0?1-d:d)*(p===0?1-m:m);g+=y*n.pl[b],h+=y}return s.pRef+(h>0?g/h:0)}liquidFootprint(t){const s=this.e.grid,n=this.B,i=wr(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let c=0;c<i;c+=1){const l=this.cells[c];s.kind[l]===st&&(this.cells[a]=l,this.wts[a]=this.wts[c],r+=this.wts[c],a+=1)}for(let c=0;c<a;c+=1)this.wts[c]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;ba(s.m,t*ut,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==st){this.budget[l]=0,this.tsatCell[l]=0,this.dTb[l]=0;continue}const u=e.pRef+s.pl[l],f=i.boilingAt(l,u);this.tsatCell[l]=f,i.salty&&(this.dTb[l]=f-_t(u)),this.budget[l]=i.Cl[l]*(i.Tl[l]-f)}this.Fm.fill(0);const c=e.waterTemperature();if(this.bulkCold=c.mass>0&&c.mean<=_t(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<n.count;l+=1)this.advance(l,t);this.coalesce();for(let l=n.count-1;l>=0;l-=1)this.finish(l,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r];if(s.kind[a]!==st||i.acc[a]<=0||i.waterShare(a)<.5)continue;const c=this.sites.cell[r];if(s.solid[c]===0)continue;const l=vt[s.solid[c]-1],u=i.Tl[a],f=Rs(i.host[a],u),d=(l.k*s.T[c]+f*u)/(l.k+f),m=e.pRef+s.pl[a],g=this.tsatCell[a]>0?this.tsatCell[a]:_t(m);if(d-g<0)continue;const h=this.sites.r[r];if(d-g<Ar(h,m))continue;const p=m+2*gs(i.host[a],d)/h,v=_t(p),b=4/3*Math.PI*h*h*h,y=Oe(v)*b;if(y*4>i.acc[a])continue;const F=this.sites.position(this.e.grid,r,h),w=n.add(F[0],F[1],Math.min(s.depth-h,Math.max(h,this.sites.z[r]*s.depth)));if(w<0)return;n.m[w*ut+Q]=y,n.r[w]=h,n.V[w]=b,n.Tb[w]=v,n.pb[w]=p,n.pv[w]=p,n.H[w]=y*pt(v),n.site[w]=r,n.age[w]=0,this.sites.bubble[r]=n.id[w],this.motion.ux0[w]=0,this.motion.uy0[w]=0;const P=i.waterH(a);this.Fm[a]-=y,e.heat.src[c]-=y*(pt(v)-P)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=d-g,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*ut;let c=i.site[t],l=0;const u=i.V[t];let f=0,d=u;for(;l<e-1e-12;){d=i.V[t];const m=i.r[t],g=Math.hypot(i.vx[t],i.vy[t]);let h=Math.min(e-l,Math.max(1e-7,La*i.age[t]),.25*n.dx/(g+1e-9));h<1e-7&&(h=Math.min(e-l,1e-7));let p,v=-1,b=0;if(c>=0){const j=this.sites.fluid[c],G=this.sites.cell[c],W=vt[n.solid[G]-1],J=r.Tl[j],ft=Rs(r.host[j],J);p=(W.k*n.T[G]+ft*J)/(W.k+ft),v=G}else{if(b=this.liquidFootprint(t),b===0)break;p=0;for(let j=0;j<b;j+=1)p+=this.wts[j]*r.Tl[this.cells[j]]}let y=0;if(r.salty)if(c>=0)y=this.dTb[this.sites.fluid[c]];else for(let j=0;j<b;j+=1)y+=this.wts[j]*this.dTb[this.cells[j]];const F=i.Tb[t],w=c>=0?r.host[this.sites.fluid[c]]:r.hostAt(i.x[t],i.y[t]),P=Rs(w,p),_=Xe(w,p),A=Ki(w,p),k=Ws(w,p),M=P/(_*A),S=2*m,T=i.age[t],I=P*Math.sqrt(3/(Math.PI*M)),O=c>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),D=_*O*S/k,B=k*A/P,q=P/S*(2+.6*Math.sqrt(D)*Math.cbrt(B)),R=pt(F)-At(p);let E=Math.max(I*2*(Math.sqrt(T+h)-Math.sqrt(T)),q*h);if(c>=0&&p>F+y){const j=.5*this.fritz(t,p),G=i.m[a+Q]>0?i.m[a+Q]/i.V[t]:Oe(F),W=E*(p-F-y)/(G*R);if(m<j&&m+W>j&&W>0){const J=E*(j-m)/W;if(q*h>=I*2*(Math.sqrt(T+h)-Math.sqrt(T)))h=J/q;else{const ft=Math.sqrt(T)+J/(2*I);h=ft*ft-T}h=Math.max(1e-9,Math.min(e-l,h*(1+1e-6))),E=Math.max(I*2*(Math.sqrt(T+h)-Math.sqrt(T)),q*h)}}const z=n.depth,N=i.V[t],L=i.m[a+Q]>0?i.m[a+Q]/N:Oe(F),V=E*(p-F-y)/(L*R),tt=Math.max(0,m+V);let Y;N<=Math.PI*z*z*z/6?Y=4/3*Math.PI*(tt*tt*tt-m*m*m):N>=Math.PI*z*z*z/4?Y=Math.PI*z*(tt*tt-m*m):Y=Math.PI*z*z*E*(p-F-y)/(L*R);let X=L*Y*R;if(c>=0){const j=v,G=vt[n.solid[j]-1],W=G.rho*G.cp*n.vCell*Math.max(0,n.T[j]-F);X>0&&(X=Math.min(X,Math.max(0,W-this.used(j))))}else{let j=0;for(let G=0;G<b;G+=1)j+=this.wts[G]*this.budget[this.cells[G]];X>0?X=Math.min(X,Math.max(0,j)):X=Math.max(X,Math.min(0,j))}let C=X/R;C<0&&(C=Math.max(C,-i.m[a+Q]));let $=1,H=!1;if(c<0&&C!==0&&!r.mixed)for(let j=0;j<b&&!H;j+=1)H=r.acc[this.cells[j]]<=0;const nt=j=>r.acc[j]>0?r.waterShare(j):0;if(c<0&&C!==0&&(r.mixed||H)){$=0;for(let j=0;j<b;j+=1)$+=this.wts[j]*nt(this.cells[j]);C*=$}if(C!==0){if(c>=0){const j=this.sites.fluid[c];C>0&&r.acc[j]+this.Fm[j]-C<0&&(C=Math.max(0,r.acc[j]+this.Fm[j]));const G=r.waterH(j);this.Fm[j]-=C,s.heat.src[v]-=C*(pt(F)-G)/e,this.budgetSolid(v,C*(pt(F)-G))}else for(let j=0;j<b;j+=1){const G=this.cells[j],W=r.mixed||H?this.wts[j]*nt(G)/$:this.wts[j];if(W===0)continue;const J=r.waterH(G);this.Fm[G]-=C*W,s.heat.src[G]-=C*W*(pt(F)-J)/e,this.budget[G]-=C*W*(pt(F)-J)}i.m[a+Q]+=C,i.H[t]+=C*pt(F),f+=C}if(this.solve(t,p),this.restoreEnthalpy(t,c,b,e),i.r[t]<1e-6||i.m[a+Q]<=1e-18&&i.m[a+rt]+i.m[a+ot]<=0){i.age[t]+=h;break}if(c>=0){const j=this.sites.position(this.e.grid,c,i.r[t]);i.x[t]=j[0],i.y[t]=j[1],this.departure(t,p),c=i.site[t]}else this.motion.move(t,h,(i.V[t]-d)/h);if(i.age[t]+=h,l+=h,i.m[a+Q]<=0&&i.m[a+rt]+i.m[a+ot]<=0)break}i.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=br(r.m,t*ut,r.Tb[t],Jt),c=a-r.H[t];if(c!==0){if(r.H[t]=a,e>=0){i.heat.src[this.sites.cell[e]]-=c/n;return}if(s!==0)for(let l=0;l<s;l+=1)i.heat.src[this.cells[l]]-=c*this.wts[l]/n}}fritz(t,e){const s=this.e,n=s.grid,i=this.B,r=i.site[t];if(r<0||s.gy<=0)return 1/0;const a=vt[n.solid[this.sites.cell[r]]-1],c=this.contactAngleOverride??a.contactAngle,l=i.totalMass(t)/Math.max(1e-30,i.V[t]),u=s.phase.host[this.sites.fluid[r]];return Sa*c*Math.sqrt(gs(u,i.Tb[t])/(s.gy*(Xe(u,e)-l)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const c=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],c),this.motion.ux0[t]=c[0],this.motion.uy0[t]=c[1],n.vx[t]=c[0],n.vy[t]=c[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const u=e.cellAt(s.x[l],s.y[l]);if(u<0){this.next[l]=-1;continue}this.next[l]=this.head[u],this.head[u]=l,s.r[l]>a&&(a=s.r[l])}const c=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const u=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let d=Math.max(0,f-c);d<=Math.min(i-1,f+c);d+=1)for(let m=Math.max(0,u-c);m<=Math.min(n-1,u+c);m+=1)for(let g=this.head[m+d*n];g>=0;g=this.next[g]){if(g<=l||s.V[g]<=0)continue;const h=s.x[g]-s.x[l],p=s.y[g]-s.y[l],v=e.depth,y=2*s.r[l]>=v||2*s.r[g]>=v?0:s.z[g]-s.z[l],F=s.r[l]+s.r[g];h*h+p*p+y*y>=F*F||this.merge(l,g)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<ut;a+=1)s.m[t*ut+a]+=s.m[e*ut+a],s.m[e*ut+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*ut,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+Q]<=1e-18&&i.m[r+rt]+i.m[r+ot]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const c=n.cellAt(i.x[t],i.y[t]+i.r[t]),l=n.cellAt(i.x[t],i.y[t]);(c<0||n.kind[c]===U||l<0||n.kind[l]===U)&&this.drop(t,!0,e)}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*ut,c=i.n,l=r.m[a+Q],u=r.m[a+rt]+r.m[a+ot];if(e||u>0){let m=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&i.kind[m]!==U;)m=m+i.nx<c?m+i.nx:-1;if(m<0&&(m=Fa(i,r.x[t])),m>=0){const g=wa(i,n.gas.vgas,m,r.V[t],this.cells,this.wts);for(let h=0;h<g;h+=1){const p=this.cells[h],v=this.wts[h];for(let b=0;b<ut;b+=1)i.mg[b*c+p]+=v*r.m[a+b];i.Hg[p]+=v*r.H[t],n.gas.deriveCell(p)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const g=n.phase;let h=1;if(g.mixed){h=0;for(let p=0;p<m;p+=1)h+=this.wts[p]*g.waterShare(this.cells[p])}for(let p=0;p<m;p+=1){const v=this.cells[p],b=g.mixed&&h>0?this.wts[p]*g.waterShare(v)/h:this.wts[p];if(b===0)continue;const y=g.waterH(v);this.Fm[v]+=l*b,n.heat.src[v]+=b*(r.H[t]-l*y)/s}}else{const g=i.cellAt(r.x[t],r.y[t]);g>=0&&(i.mg[Q*c+g]+=l,i.Hg[g]+=r.H[t],n.gas.deriveCell(g))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const d=r.count-1;if(t!==d){this.motion.ux0[t]=this.motion.ux0[d],this.motion.uy0[t]=this.motion.uy0[d];const m=r.site[d];m>=0&&(this.sites.bubble[m]=r.id[d])}r.remove(t)}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let u=0;u<n.count;u+=1){const f=wr(n.x[u],n.y[u],n.r[u],n.V[u],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let d=0;d<f;d+=1)i[this.cells[d]]+=this.wts[d]*n.V[u]*r}const a=s.alpha,c=e.liquid.volSrc,l=Ro*t;for(let u=0;u<s.n;u+=1){const f=i[u]-a[u];f!==0&&(f>l?(c[u]+=l*s.vCell/t,a[u]+=l):f<-l?(c[u]-=l*s.vCell/t,a[u]-=l):(c[u]+=f*s.vCell/t,a[u]=i[u]))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,c=a.add(t,e,s);if(c<0)return-1;const l=this.pressure(t,e),u=r.grid.cellAt(t,e),f=u>=0&&r.phase.Tl[u]>0?r.phase.Tl[u]:r.ambientT,d=l+2*gs(u>=0?r.phase.host[u]:0,f)/n,m=4/3*Math.PI*n*n*n,g=c*ut;if(i<=0){const h=_t(d);a.m[g+Q]=Oe(h)*m}else{const h=d*m/(8.314462618*f);a.m[g+rt]=h*.79*dt[rt],a.m[g+ot]=h*.21*dt[ot]}return a.r[c]=n,this.solve(c,f),a.H[c]=br(a.m,g,a.Tb[c],Jt),r.ledger.water+=a.m[g+Q],r.ledger.air+=a.m[g+rt]+a.m[g+ot],r.ledger.energy+=a.H[c],this.motion.ux0[c]=0,this.motion.uy0[c]=0,c}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*ut,n=t*Zt;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:_t(e.pb[t]),mv:e.m[s+Q],ma:e.m[s+rt]+e.m[s+ot],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+Zt))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ht}}function _r(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0,escapedSalt:0,editSalt:0,bodyWork:0}}const Oa={mass:0,energy:0};function ja(o,t,e,s,n,i,r=Oa){const a=o.n;let c=0,l=0,u=0,f=0,d=0,m=0,g=0;for(let k=0;k<a;k+=1){if(o.kind[k]===ht||o.solid[k]!==0){c+=o.Es[k],d+=o.film[k],m+=o.crust[k];continue}l+=o.Hg[k],u+=o.mg[Q*a+k],f+=o.mfog[k],g+=o.mg[rt*a+k]+o.mg[ot*a+k]}let h=0,p=0,v=0,b=0;for(let k=0;k<t.count;k+=1){h+=t.mass[k]*t.h[k];const M=t.smass[2*k];b+=M,t.mat[k]===at?p+=t.mass[k]-M:v+=t.mass[k]-M}c+=r.energy;let y=0,F=0;for(let k=0;k<e.count;k+=1)y+=e.H[k],F+=e.m[k*ut+Q],g+=e.m[k*ut+rt]+e.m[k*ut+ot];const w=s.pvTerm();i.solids=c,i.liquid=h,i.gas=l,i.bubbles=y,i.pv=w,i.energy=c+h+l+y+w;const P=i.water;P.liquid=p,P.vapour=u,P.fog=f,P.film=d,P.bubbles=F,P.escaped=n.escapedWater,P.total=p+u+f+d+F+n.escapedWater;const _=i.other;_.liquid=v,_.escaped=n.escapedOther,_.total=v+n.escapedOther;const A=i.salt;return A.liquid=b,A.crust=m,A.floor=r.mass,A.escaped=n.escapedSalt,A.total=b+m+r.mass+n.escapedSalt,i.air=g+n.escapedAir,i}function Ba(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0}}}const Rt=kt.solutes[0],Vo=kt.species[0],Qi=Vo.molarMass.v,Qs=Rt.molarMass.v,Ia=Rt.ions.v,No=1,Uo=kt.solutes.map(o=>({id:o.id,name:o.name,short:o.short,color:o.solid.color}));function Go(o){return Uo.findIndex(t=>t.id===o)}function Ho(o){return o>0?o*Qs/(1+o*Qs):0}const ce=298.15,on=Rt.pitzer,qa=on.b0.a,Ea=on.b1.a,Ra=on.c.a,Da=on.b.v,Va=on.alpha.v,wn=Rt.pitzerCold,Na=wn.below.v;function ti(o,t){return o[0]+o[1]*(1/t-1/ce)+o[2]*Math.log(t/ce)+o[3]*(t-ce)+o[4]*(t*t-ce*ce)+o[5]*(1/(t*t)-1/(ce*ce))}const fn=Rt.dielectric.c;function Ua(o){const t=o-ct;return fn[0]+t*(fn[1]+t*(fn[2]+t*fn[3]))}function Ga(o){const t=hr*hr/(4*Math.PI*wc*Ua(o)*yc*o);return Math.sqrt(2*Math.PI*bc*Tn(o))*t*Math.sqrt(t)/3}function Ha(o,t){if(!(t>0))return 1;const e=Math.sqrt(t),s=o<Na,n=ti(s?wn.b0.a:qa,o),i=ti(s?wn.b1.a:Ea,o),r=ti(s?wn.c.a:Ra,o);return 1-Ga(o)*e/(1+Da*e)+t*(n+i*Math.exp(-Va*e))+t*t*r}function jn(o,t){return t>0?Math.exp(-Ia*t*Ha(o,t)*Qi):1}const $o=240,Bn=221,Wo=.05,Le=181;let ei=null;function $a(){if(ei!==null)return ei;const o=new Float64Array(Bn*Le);for(let t=0;t<Bn;t+=1)for(let e=0;e<Le;e+=1)o[t*Le+e]=jn($o+t,e*Wo);return ei=o,o}function Ko(o,t){if(!(t>0))return 1;const e=t/Wo;if(e>=Le-1)return jn(o,t);const s=$a();let n=o-$o;n>0?n>Bn-1.000001&&(n=Bn-1.000001):n=0;const i=n|0,r=e|0,a=n-i,c=e-r,l=i*Le+r,u=s[l]+c*(s[l+1]-s[l]),f=s[l+Le]+c*(s[l+Le+1]-s[l+Le]);return u+a*(f-u)}function zo(o,t){let e=_t(o);if(!(t>0))return e;for(let s=0;s<8;s+=1){const n=_t(o/Ko(e,t)),i=n-e;if(e=n,Math.abs(i)<1e-8)break}return e}const Gn=Vo.fusion,ue=Gn.T.v,Qo=Gn.h.v,Wa=Gn.cpIce.v;Gn.rhoIce.v;function Ka(o){const t=je(ue)-Wa;return Qi/Ot*((Qo-t*ue)*(1/ue-1/o)+t*Math.log(o/ue))}const za=Rt.eutectic.T.v,Qa=Rt.eutectic.w.v;function Xa(o){if(!(o>0))return ue;if(Ho(o)>=Qa)return za;const t=s=>Math.log(jn(s,o))-Ka(s);let e=ue+Math.log(jn(ue,o))*Ot*ue*ue/(Qi*Qo);for(let s=0;s<30;s+=1){const n=t(e),i=(t(e+.001)-t(e-.001))/.002,r=n/i;if(e-=r,!Number.isFinite(e))return ue;if(Math.abs(r)<1e-9)break}return e}const ke=Rt.solubility.table;function Ya(o){if(o<=ke[0][0])return ke[0][1];for(let t=1;t<ke.length;t+=1)if(o<=ke[t][0]){const[e,s]=ke[t-1],[n,i]=ke[t];return s+(i-s)*(o-e)/(n-e)}return ke[ke.length-1][1]}function Ja(o){return Ho(Ya(o))}Rt.solid.rho.v;const Xo=Rt.solid.cp.v;function Hn(o){return Xo*(o-ct)}const Cs=Rt.density.laliberte;function Za(o,t){const e=o-ct,s=e+Cs[4];return(Cs[0]*t+Cs[1])*Math.exp(1e-6*s*s)/(t+Cs[2]+Cs[3]*e)}function Xi(o,t){return t>0?1/((1-t)/Tn(o)+t/Za(o,t)):Tn(o)}const Ss=Rt.cp.laliberte,$n=Ss[0],tl=Ss[1],el=Ss[2],Xs=Ss[3],Yi=Ss[4],Ys=Ss[5],Ye=Rt.cp.range.lo,In=Rt.cp.range.hi,ze=.5,Fe=Math.round((In-Ye)/ze)+1,Wt=new Float64Array(Fe),Js=new Float64Array(Fe);for(let o=0;o<Fe;o+=1){const t=Ye+o*ze-ct;Wt[o]=Math.exp(tl*t+el*Math.exp(.01*t))}Js[0]=Wt[0]*(Ye-ct);for(let o=1;o<Fe;o+=1)Js[o]=Js[o-1]+.5*(Wt[o-1]+Wt[o])*ze;function Yo(o){if(o<=Ye)return Wt[0];if(o>=In)return Wt[Fe-1];const t=(o-Ye)/ze,e=Math.min(Fe-2,t|0);return Wt[e]+(t-e)*(Wt[e+1]-Wt[e])}function cn(o){if(o<=Ye)return Wt[0]*(o-ct);if(o>=In)return Js[Fe-1]+Wt[Fe-1]*(o-In);const t=(o-Ye)/ze,e=Math.min(Fe-2,t|0),s=(t-e)*ze;return Js[e]+Wt[e]*s+.5*(Wt[e+1]-Wt[e])*s*s/ze}const Ji=o=>1e3*$n*o*Math.exp(Xs*o),Zi=o=>1e3*Yi*Math.pow(o,Ys+1),tr=Rt.dHsol.v/Qs+Hn(ce)-1e3*$n*cn(ce);function Jo(o,t){return t>0?(1-t)*At(o)+t*tr+Ji(t)*cn(o)+Zi(t)*(o-ct):At(o)}function sl(o,t){return t>0?(1-t)*je(o)+Ji(t)*Yo(o)+Zi(t):je(o)}function nl(o,t,e){if(!(t>0))return bo(o);const s=Ji(t),n=Zi(t),i=t*tr,r=1-t;let a=e>200&&e<900?e:ct+(o-i)/(4e3*r+800*t);for(let c=0;c<30;c+=1){const u=(r*At(a)+i+s*cn(a)+n*(a-ct)-o)/(r*je(a)+s*Yo(a)+n);if(a-=u,Math.abs(u)<1e-8)break}return a}function Pr(o,t){const e=Math.exp(Xs*t),s=1e3*$n*e*(t+(1-t)*(1+Xs*t)),n=t>0?1e3*Yi*Math.pow(t,Ys)*(t+(1-t)*(Ys+1)):0;return tr+s*cn(o)+n*(o-ct)}const il=Rt.diffusivity.v,rl=$i(ce);function kr(o){return il*(o/ce)*rl/$i(o)}function Fn(o,t){return t>0?At(o)-1e3*$n*Xs*t*t*Math.exp(Xs*t)*cn(o)-1e3*Yi*Ys*Math.pow(t,Ys+1)*(o-ct):At(o)}const Tr=o=>typeof o=="number"&&Number.isFinite(o)?o:null;function Os(o){if(o===null||typeof o!="object")return null;const t=o,e=(a,c)=>{if(!Array.isArray(a)||a.length!==c)return null;const l=a.map(Tr);return l.every(u=>u!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(c=>e(c,2));if(a.every(c=>c!==null))return{poly:a.map(c=>[c[0],c[1]])}}const i=e(t.line,4),r=Tr(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function Ae(o,t,e){if("rect"in o){const[m,g,h,p]=o.rect;return t>=m&&t<=h&&e>=g&&e<=p}if("circle"in o){const[m,g,h]=o.circle;return(t-m)*(t-m)+(e-g)*(e-g)<=h*h}if("poly"in o){const m=o.poly;let g=!1;for(let h=0,p=m.length-1;h<m.length;p=h,h+=1){const[v,b]=m[h],[y,F]=m[p];b>e!=F>e&&t<(y-v)*(e-b)/(F-b)+v&&(g=!g)}return g}const[s,n,i,r]=o.line,a=i-s,c=r-n,l=a*a+c*c,u=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*c)/l)):0,f=t-(s+u*a),d=e-(n+u*c);return f*f+d*d<=.25*o.width*o.width}function qn(o){if("rect"in o)return[o.rect[0],o.rect[1],o.rect[2],o.rect[3]];if("circle"in o){const[r,a,c]=o.circle;return[r-c,a-c,r+c,a+c]}if("poly"in o){let r=1/0,a=1/0,c=-1/0,l=-1/0;for(const[u,f]of o.poly)r=Math.min(r,u),a=Math.min(a,f),c=Math.max(c,u),l=Math.max(l,f);return[r,a,c,l]}const t=o.width/2,[e,s,n,i]=o.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function js(o){return"rect"in o?{rect:[...o.rect]}:"circle"in o?{circle:[...o.circle]}:"poly"in o?{poly:o.poly.map(t=>[t[0],t[1]])}:{line:[...o.line],width:o.width}}function un(o,t){if(t.length===0||o.bodies.list.length===0)return;const e=o.grid,s=new Uint8Array(e.n);for(const n of t)s[n]=1;o.bodies.carve((n,i)=>{const r=e.cellAt(n,i);return r>=0&&s[r]===1})}function Es(o,t,e){const[s,n,i,r]=qn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.ceil(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.ceil(r/o.dx));for(let f=l;f<=u;f+=1)for(let d=a;d<=c;d+=1)Ae(t,(d+.5)*o.dx,(f+.5)*o.dx)&&e(d+f*o.nx,d,f)}function Wn(o,t){const e=o.grid,s=e.n;o.ledger.water-=e.mg[Q*s+t]+e.mfog[t],o.ledger.air-=e.mg[rt*s+t]+e.mg[ot*s+t],o.ledger.energy-=e.Hg[t];for(let n=0;n<ut;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function er(o,t,e,s){const n=o.grid,i=n.n;Wn(o,t),o.gas.fillCell(t,e,s,Math.max(.001,1-n.phi[t]-n.alpha[t])),o.ledger.water+=n.mg[Q*i+t],o.ledger.air+=n.mg[rt*i+t]+n.mg[ot*i+t],o.ledger.energy+=n.Hg[t]}function Kn(o,t){const e=o.particles,s=e.smass[2*t];e.mat[t]===at?o.ledger.water-=e.mass[t]-s:o.ledger.other-=e.mass[t]-s,o.ledger.salt-=s,o.ledger.energy-=e.mass[t]*e.h[t]}function sr(o,t){o.ledger.salt-=o.grid.crust[t],o.grid.crust[t]=0}function si(o,t){const e=o.particles;for(let n=0;n<e.count;n+=1)Ae(t,e.x[n],e.y[n])&&(Kn(o,n),o.liquid.removeParticle(n),n-=1);const s=o.bubbles;for(let n=0;n<s.count;n+=1)Ae(t,s.x[n],s.y[n])&&(o.ledger.water-=s.m[n*ut+Q],o.ledger.air-=s.m[n*ut+rt]+s.m[n*ut+ot],o.ledger.energy-=s.H[n],s.remove(n),n-=1);o.liquid.weightsDirty=!0}function hn(o,t,e,s,n){const i=o.grid,r=vt[e];for(const c of t)i.solid[c]!==0?(o.ledger.energy-=i.Es[c],o.ledger.water-=i.film[c],sr(o,c)):Wn(o,c),i.solid[c]=e+1,i.role[c]=n>=0?1:0,i.heater[c]=n,i.film[c]=0,i.T[c]=s,i.Es[c]=r.rho*r.cp*i.vCell*(s-ct),i.kind[c]=ht,o.ledger.energy+=i.Es[c];const a=o.particles;for(let c=0;c<a.count;c+=1){const l=i.cellAt(a.x[c],a.y[c]);l<0||i.solid[l]===0||(Kn(o,c),o.liquid.removeParticle(c),c-=1)}o.solidsChanged()}function ol(o,t){const e=o.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,o.ledger.energy-=e.Es[n],o.ledger.water-=e.film[n],sr(o,n),e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){o.solidsChanged();for(const n of t)e.solid[n]===0&&o.gas.massOf(n)<=0&&er(o,n,o.ambientT,o.ambientY)}}const Bs=(o,t,e,s,n)=>{const i=[],r=Math.max(0,Math.round(t/o.dx)),a=Math.min(o.nx,Math.max(r+1,Math.round(s/o.dx))),c=Math.max(0,Math.round(e/o.dx)),l=Math.min(o.ny,Math.max(c+1,Math.round(n/o.dx)));for(let u=c;u<l;u+=1)for(let f=r;f<a;f+=1)i.push(f+u*o.nx);return i};function cl(o,t){const e=o.grid;switch(t.op){case"fill":{if(t.phase==="gas"){si(o,t.region);const p=new Float64Array(ut);let v=0;for(const[b,y]of Object.entries(t.composition)){const F=b==="N2"?rt:b==="O2"?ot:b==="H2O"?Q:-1;F>=0&&(p[F]=y,v+=y)}if(v<=0)p.set(o.ambientY.subarray(0,ut));else for(let b=0;b<xt;b+=1)p[b]/=v;return Es(e,t.region,b=>{e.solid[b]===0&&er(o,b,t.T,p)}),null}si(o,t.region);const s=te.length;let n=0;for(const[p,v]of Object.entries(t.composition))Go(p)>=0&&v>0&&(n+=v);const i=t.composition[te[at].id]??0,r=n>0&&i>0?n/(n+i):0,a=p=>p===at&&r>0?Xi(t.T,r):Xe(p,t.T),c=new Float64Array(s);let l=0;for(const[p,v]of Object.entries(t.composition)){const b=To(p);if(b<0||!(v>0))continue;const y=b===at&&r>0?v+n:v;c[b]+=y/a(b),l+=y/a(b)}if(l<=0)return"fill: no known liquid in the composition";for(let p=0;p<s;p+=1)c[p]/=l;const u=new Float64Array(s),f=new Float64Array(s);for(let p=0;p<s;p+=1)u[p]=a(p)*e.vCell/4,f[p]=p===at&&r>0?Jo(t.T,r):Vc(p,t.T);const d=r*u[at],m=new Float64Array(s),g=o.particles;let h=!1;return ll(e,t.region,(p,v)=>{const b=p+v*e.nx;if(e.solid[b]!==0)return;let y=0;for(let F=0;F<2;F+=1)for(let w=0;w<2;w+=1){const P=(p+.25+.5*w)*e.dx,_=(v+.25+.5*F)*e.dx;if(!Ae(t.region,P,_))continue;let A=0;for(let T=0;T<s;T+=1)m[T]+=c[T],m[T]>m[A]&&(A=T);m[A]-=1;const k=u[A],M=f[A],S=A===at?d:0;if(g.add(P,_,k,M,A,S)<0){h=!0;continue}y+=1,A===at?o.ledger.water+=k-S:o.ledger.other+=k,o.ledger.salt+=S,o.ledger.energy+=k*M}y===4&&Wn(o,b)}),o.liquid.weightsDirty=!0,n>0&&i<=0?"fill: salt needs water to dissolve in (NaCl dropped)":h?"fill: particle capacity reached":null}case"erase":{o.bodies.list.length>0&&o.bodies.carve((n,i)=>Ae(t.region,n,i)),si(o,t.region);const s=[];return Es(e,t.region,n=>s.push(n)),ol(o,s),null}case"move":return al(o,t.region,Math.round(t.dx/e.dx),Math.round(t.dy/e.dx)),null;case"solid":{const s=qs(t.material);if(s<0)return`solid: unknown material ${t.material}`;const n=[];if(Es(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,c]=t.region.line,l=Math.ceil(Math.hypot(a-i,c-r)/(.5*e.dx))+1;for(let u=0;u<=l;u+=1){const f=e.cellAt(i+(a-i)*u/l,r+(c-r)*u/l);f>=0&&!n.includes(f)&&n.push(f)}}return un(o,n),hn(o,n,s,t.T,-1),null}case"body":{const s=qs(t.material);if(s<0)return`body: unknown material ${t.material}`;const n=[];if(Es(e,t.region,r=>n.push(r)),n.length===0){const[r,a,c,l]=qn(t.region),u=e.cellAt((r+c)/2,(a+l)/2);u>=0&&n.push(u)}un(o,n),hn(o,n,s,t.T,-1);const i=o.bodies.adopt(n,o.opIndex,t.pinned,"circle"in t.region?t.region.circle[2]:0);if(i!==null&&t.angle!==0){const[r,a,c,l]=qn(t.region);o.bodies.turn(i,(r+c)/2,(a+l)/2,t.angle*Math.PI/180),o.solidsChanged()}return null}case"pin":{const s=o.bodies.bodyAt(t.x,t.y);return s===null?"pin: no body at this point":(o.bodies.pin(s,t.pinned),null)}case"beaker":{const s=qs(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.max(e.dx,t.wall),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,c=t.y+t.h,l=[...Bs(e,i,a,i+n,c),...Bs(e,r-n,a,r,c),...Bs(e,i,a,r,a+n),...t.lid?Bs(e,i,c-n,r,c):[]],u=[...new Set(l)];return un(o,u),hn(o,u,s,t.T,-1),Mr(o,u,t.pinned,t.angle,t.x,t.y),null}case"hotplate":{const s=qs(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=o.heat.heaters.length;o.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0});const i=Bs(e,t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h);return un(o,i),hn(o,i,s,t.T,n),Mr(o,i,t.pinned,t.angle,t.x,t.y),null}}}function Mr(o,t,e,s,n,i){const r=o.bodies.adopt(t,o.opIndex,e);r===null||s===0||(o.bodies.turn(r,n,i,s*Math.PI/180),o.solidsChanged())}function al(o,t,e,s){const n=o.grid,{nx:i,ny:r,dx:a}=n;if(e===0&&s===0)return;const c=o.bodies.list.length>0?o.bodies.lift(h=>Ae(t,(h%i+.5)*a,(Math.floor(h/i)+.5)*a)):[],l=[];Es(n,t,h=>{n.solid[h]!==0&&l.push(h)});const u=o.particles,f=o.bubbles,d=e*a,m=s*a;for(let h=0;h<u.count;h+=1){if(!Ae(t,u.x[h],u.y[h]))continue;const p=u.x[h]+d,v=u.y[h]+m;if(p<=0||v<=0||p>=n.w||v>=n.h){Kn(o,h),o.liquid.removeParticle(h),h-=1;continue}u.x[h]=p,u.y[h]=v}for(let h=0;h<f.count;h+=1)Ae(t,f.x[h],f.y[h])&&(f.x[h]=Math.min(n.w-1e-6,Math.max(1e-6,f.x[h]+d)),f.y[h]=Math.min(n.h-1e-6,Math.max(1e-6,f.y[h]+m)),f.site[h]=-1);if(o.liquid.weightsDirty=!0,l.length===0){if(c.length===0)return;o.bodies.place(c,e,s),Sr(o),o.solidsChanged();return}const g=l.map(h=>({c:h,s:n.solid[h],role:n.role[h],heater:n.heater[h],T:n.T[h],Es:n.Es[h],film:n.film[h],crust:n.crust[h]}));for(const h of g)o.ledger.energy-=h.Es,o.ledger.water-=h.film,o.ledger.salt-=h.crust,n.solid[h.c]=0,n.role[h.c]=0,n.heater[h.c]=-1,n.Es[h.c]=0,n.film[h.c]=0,n.crust[h.c]=0,n.kind[h.c]=0;for(const h of g){const p=h.c%i+e,v=Math.floor(h.c/i)+s;if(p<0||v<0||p>=i||v>=r)continue;const b=p+v*i;n.solid[b]!==0?(o.ledger.energy-=n.Es[b],o.ledger.water-=n.film[b],sr(o,b)):Wn(o,b),n.solid[b]=h.s,n.role[b]=h.role,n.heater[b]=h.heater,n.T[b]=h.T,n.Es[b]=h.Es,n.film[b]=h.film,n.crust[b]=h.crust,n.kind[b]=ht,o.ledger.energy+=h.Es,o.ledger.water+=h.film,o.ledger.salt+=h.crust}o.bodies.place(c,e,s),Sr(o),o.solidsChanged();for(const h of g)n.solid[h.c]===0&&o.gas.massOf(h.c)<=0&&er(o,h.c,o.ambientT,o.ambientY)}function Sr(o){const t=o.grid,e=o.particles;for(let s=0;s<e.count;s+=1){const n=t.cellAt(e.x[s],e.y[s]);n<0||t.solid[n]===0||(Kn(o,s),o.liquid.removeParticle(s),s-=1)}}function ll(o,t,e){const[s,n,i,r]=qn(t),a=Math.max(0,Math.floor(s/o.dx)),c=Math.min(o.nx-1,Math.floor(i/o.dx)),l=Math.max(0,Math.floor(n/o.dx)),u=Math.min(o.ny-1,Math.floor(r/o.dx));for(let f=l;f<=u;f+=1)for(let d=a;d<=c;d+=1)e(d,f)}const fl=.02;function ul(o){if(!(o>1e-8))return o>0?o:0;const t=Math.log(1+o);let e=o<1?o*(1-o/(1+o)):t*(1-Math.log(1+t)/(2+t));for(let s=0;s<4;s+=1){const n=Math.exp(e),i=e*n-o;e-=i/(n*(e+1)-(e+2)*i/(2*e+2))}return e}function hl(o,t){const e=2*Math.max(0,o-fl)*t;return e>1e-8?e/ul(e):1}function dl(o,t,e){const{nx:s,ny:n,dx:i,ul:r,vl:a}=o,c=s+1,l=(y,F)=>.5*(r[y+F*c]+r[y+1+F*c]),u=(y,F)=>.5*(a[y+F*s]+a[y+(F+1)*s]),f=(r[t+1+e*c]-r[t+e*c])/i,d=(a[t+(e+1)*s]-a[t+e*s])/i,m=Math.max(0,e-1),g=Math.min(n-1,e+1),h=Math.max(0,t-1),p=Math.min(s-1,t+1),v=g>m?(l(t,g)-l(t,m))/((g-m)*i):0,b=p>h?(u(p,e)-u(h,e))/((p-h)*i):0;return Math.hypot(.5*(f-d),.5*(v+b))}class ml{constructor(t){x(this,"e");x(this,"cap");x(this,"capT");x(this,"capA");x(this,"salt");x(this,"water");x(this,"fH");x(this,"fS");x(this,"outS");x(this,"outH");x(this,"inS");x(this,"inH");x(this,"cell",new Int32Array(0));x(this,"cpp",new Float64Array(0));x(this,"ds",new Float64Array(0));x(this,"hs",new Float64Array(0));this.e=t;const e=t.grid.n;this.cap=new Float64Array(e),this.capT=new Float64Array(e),this.capA=new Float64Array(e),this.salt=new Float64Array(e),this.water=new Float64Array(e),this.fH=new Float64Array(e),this.fS=new Float64Array(e),this.outS=new Float64Array(e),this.outH=new Float64Array(e),this.inS=new Float64Array(e),this.inH=new Float64Array(e)}step(t){const{particles:e,grid:s,liquid:n}=this.e;if(e.count===0)return;this.cell.length<e.cap&&(this.cell=new Int32Array(e.cap),this.cpp=new Float64Array(e.cap),this.ds=new Float64Array(e.cap),this.hs=new Float64Array(e.cap));const{cap:i,capT:r,capA:a,salt:c,water:l,fH:u,fS:f,cell:d,cpp:m}=this;i.fill(0),r.fill(0),a.fill(0),c.fill(0),l.fill(0);let g=!1;for(let y=0;y<e.count;y+=1){const F=s.cellAt(e.x[y],e.y[y]);if(d[y]=F,F<0)continue;const w=e.cp(y);m[y]=w;const P=e.mass[y]*w,_=e.T[y];if(i[F]+=P,r[F]+=P*_,a[F]+=P*Rs(e.mat[y],_)/(e.rho[y]*w),e.mat[y]!==at)continue;const A=e.smass[2*y];c[F]+=A,l[F]+=e.mass[y]-A,A>0&&(g=!0)}const{nx:h,ny:p,kind:v}=s,b=Math.PI*Math.PI*t/(s.dx*s.dx);for(let y=0;y<s.n;y+=1){if(u[y]=0,f[y]=0,!(i[y]>0))continue;const F=y%h,w=(y-F)/h;if(!(v[y]!==st&&(v[y]!==U||!(F>0&&v[y-1]===st||F<h-1&&v[y+1]===st||w>0&&v[y-h]===st||w<p-1&&v[y+h]===st)))&&(u[y]=1-Math.exp(-b*a[y]/i[y]),g&&c[y]>0)){const P=kr(r[y]/i[y]);f[y]=1-Math.exp(-b*P*hl(dl(s,F,w),t/(b*P)))}}for(let y=0;y<e.count;y+=1){const F=d[y];if(F<0||u[F]===0)continue;const w=u[F]*(r[F]/i[F]-e.T[y]);if(w===0)continue;const P=e.mass[y]/e.rho[y];e.h[y]+=m[y]*w,e.derive(y),n.dVp[y]+=e.mass[y]/e.rho[y]-P}g&&this.saltStep(t)}saltStep(t){const{particles:e,liquid:s}=this.e,{salt:n,water:i,fS:r,outS:a,outH:c,inS:l,inH:u,cell:f,ds:d,hs:m}=this;a.fill(0),c.fill(0);for(let h=0;h<e.count;h+=1){d[h]=0;const p=f[h];if(p<0||r[p]===0||e.mat[h]!==at)continue;const v=e.smass[2*h],b=r[p]*(n[p]/i[p]*(e.mass[h]-v)-v);if(d[h]=b,b<0){const y=Pr(e.T[h],v/e.mass[h]);m[h]=y,a[p]-=b,c[p]-=b*y}}const g=this.saltBetween(t);for(let h=0;h<e.count;h+=1){const p=f[h];if(p<0||e.mat[h]!==at)continue;let v=d[h],b=0;v<0?b=v*m[h]:v>0&&(a[p]>0?b=v*c[p]/a[p]:v=0);const y=e.smass[2*h],F=e.mass[h];if(g&&(l[p]!==0||u[p]!==0)){const _=l[p]<0?y/n[p]:(F-y)/i[p];v+=l[p]*_,b+=u[p]*_}if(v===0&&b===0)continue;const w=F*e.h[h]+b,P=F/e.rho[h];e.mass[h]=F+v,e.smass[2*h]=y+v,e.spc[2*h]=y+v>0?No:0,e.h[h]=w/e.mass[h],e.derive(h),s.dVp[h]+=e.mass[h]/e.rho[h]-P}}saltBetween(t){const e=this.e.grid,{salt:s,water:n,fH:i,cap:r,capT:a,inS:c,inH:l}=this,{nx:u,ny:f}=e;c.fill(0),l.fill(0);const d=t/(e.dx*e.dx);let m=!1;const g=(h,p)=>{if(i[p]===0||!(n[p]>0))return;const v=s[h]/n[h],b=s[p]/n[p];if(v===b)return;const y=v>b?h:p,F=v>b?p:h,P=kr(.5*(a[h]/r[h]+a[p]/r[p]))*d*Math.min(n[h],n[p])*Math.abs(v-b),_=Pr(a[y]/r[y],s[y]/(s[y]+n[y]));c[y]-=P,l[y]-=P*_,c[F]+=P,l[F]+=P*_,m=!0};for(let h=0;h<f;h+=1)for(let p=0;p<u;p+=1){const v=p+h*u;i[v]===0||!(n[v]>0)||(p+1<u&&g(v,v+1),h+1<f&&g(v,v+u))}return m}}const It=xt+2,Xt=xt,se=xt+1,pl=.9,gl=16;class Vs{constructor(t,e){x(this,"g");x(this,"gas");x(this,"conc");x(this,"fu");x(this,"fv");x(this,"outM");x(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(It*s),this.fu=new Float64Array(It*t.nu),this.fv=new Float64Array(It*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,c=s+1,l=e.ug,u=e.vg;let f=0,d=0;for(let F=0;F<n;F+=1)for(let w=0;w<s;w+=1){const P=w+F*s;if(r[P]!==U)continue;const _=w+F*c,A=l[_],k=l[_+1],M=u[P],S=u[P+s],T=(A<0?-A:0)+(k>0?k:0)+(M<0?-M:0)+(S>0?S:0);T>f&&(f=T);const I=Math.max(A<0?-A:A,k<0?-k:k,M<0?-M:M,S<0?-S:S);I>d&&(d=I)}this.gas.last.uMax=d;const m=Math.min(gl,Math.max(1,Math.ceil(f*t/a/pl))),g=t/m,{conc:h}=this,p=this.gas.vgas,v=e.mg,b=e.mfog,y=e.Hg;for(let F=0;F<m;F+=1){for(let w=0;w<i;w+=1){if(r[w]!==U){for(let _=0;_<It;_+=1)h[_*i+w]=0;continue}const P=1/p[w];for(let _=0;_<xt;_+=1)h[_*i+w]=v[_*i+w]*P;h[Xt*i+w]=b[w]*P,h[se*i+w]=y[w]*P}this.fluxesU(g),this.fluxesV(g),this.limitOutflow(),this.applyFluxes()}for(let F=0;F<i;F+=1)r[F]===U&&this.gas.deriveCell(F);return this.gas.last.substeps=m,m}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,c=e.nu,l=e.ug,{conc:u,fu:f}=this,{amb:d,gasU:m}=this.gas,g=e.aFace,h=Vs.face;for(let p=0;p<n;p+=1){const v=p*s,b=p*a;for(let y=0;y<=s;y+=1){const F=b+y,w=l[F];if(m[F]===0||w===0){for(let M=0;M<It;M+=1)f[M*c+F]=0;continue}const P=w*g*t;if(y===0||y===s){const M=y===0?v:v+s-1,S=y===0?w>0:w<0;for(let T=0;T<It;T+=1)f[T*c+F]=P*(S?d[T]:u[T*i+M]);continue}let _,A,k;if(w>0?(_=v+y-1,A=v+y,k=y>=2&&r[v+y-2]===U?v+y-2:-1):(_=v+y,A=v+y-1,k=y+1<s&&r[v+y+1]===U?v+y+1:-1),k<0){for(let M=0;M<It;M+=1)f[M*c+F]=P*u[M*i+_];continue}for(let M=0;M<It;M+=1){const S=M*i;f[M*c+F]=P*h(u[S+_],u[S+k],u[S+A])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,c=e.vg,{conc:l,fv:u}=this,{amb:f,gasV:d}=this.gas,m=e.aFace,g=Vs.face;for(let h=0;h<=n;h+=1){const p=h*s;for(let v=0;v<s;v+=1){const b=p+v,y=c[b];if(d[b]===0||y===0){for(let A=0;A<It;A+=1)u[A*a+b]=0;continue}const F=y*m*t;if(h===0||h===n){const A=h===0?v:v+(n-1)*s,k=h===0?y>0:y<0;for(let M=0;M<It;M+=1)u[M*a+b]=F*(k?f[M]:l[M*i+A]);continue}let w,P,_;if(y>0?(w=b-s,P=b,_=h>=2&&r[b-2*s]===U?b-2*s:-1):(w=b,P=b-s,_=h+1<n&&r[b+s]===U?b+s:-1),_<0){for(let A=0;A<It;A+=1)u[A*a+b]=F*l[A*i+w];continue}for(let A=0;A<It;A+=1){const k=A*i;u[A*a+b]=F*g(l[k+w],l[k+_],l[k+P])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:c,fv:l}=this,{gasU:u,gasV:f,escaped:d}=this.gas,m=t.mg,g=t.mfog,h=t.Hg;for(let p=0;p<s;p+=1){const v=p*e,b=p*i;for(let F=1;F<e;F+=1){const w=b+F;if(u[w]===0)continue;const P=v+F-1,_=P+1;for(let M=0;M<xt;M+=1){const S=c[M*r+w];m[M*n+P]-=S,m[M*n+_]+=S}const A=c[Xt*r+w];g[P]-=A,g[_]+=A;const k=c[se*r+w];h[P]-=k,h[_]+=k}if(u[b]!==0){const F=v;for(let _=0;_<xt;_+=1){const A=c[_*r+b];m[_*n+F]+=A,d[_]-=A}const w=c[Xt*r+b];g[F]+=w,d[Xt]-=w;const P=c[se*r+b];h[F]+=P,d[se]-=P}const y=b+e;if(u[y]!==0){const F=v+e-1;for(let _=0;_<xt;_+=1){const A=c[_*r+y];m[_*n+F]-=A,d[_]+=A}const w=c[Xt*r+y];g[F]-=w,d[Xt]+=w;const P=c[se*r+y];h[F]-=P,d[se]+=P}}for(let p=1;p<s;p+=1){const v=p*e;for(let b=0;b<e;b+=1){const y=v+b;if(f[y]===0)continue;const F=y-e,w=y;for(let A=0;A<xt;A+=1){const k=l[A*a+y];m[A*n+F]-=k,m[A*n+w]+=k}const P=l[Xt*a+y];g[F]-=P,g[w]+=P;const _=l[se*a+y];h[F]-=_,h[w]+=_}}for(let p=0;p<e;p+=1){if(f[p]!==0){const b=p;for(let w=0;w<xt;w+=1){const P=l[w*a+p];m[w*n+b]+=P,d[w]-=P}const y=l[Xt*a+p];g[b]+=y,d[Xt]-=y;const F=l[se*a+p];h[b]+=F,d[se]-=F}const v=p+s*e;if(f[v]!==0){const b=p+(s-1)*e;for(let w=0;w<xt;w+=1){const P=l[w*a+v];m[w*n+b]-=P,d[w]+=P}const y=l[Xt*a+v];g[b]-=y,d[Xt]+=y;const F=l[se*a+v];h[b]-=F,d[se]+=F}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:c,scale:l}=this,u=t.nu,f=t.nv;c.fill(0);const d=Vs.massFlux,{gasU:m,gasV:g}=this.gas;for(let p=0;p<s;p+=1)for(let v=0;v<=e;v+=1){const b=v+p*i;if(m[b]===0)continue;const y=d(r,u,b);y>0&&v>0?c[v-1+p*e]+=y:y<0&&v<e&&(c[v+p*e]-=y)}for(let p=0;p<=s;p+=1)for(let v=0;v<e;v+=1){const b=v+p*e;if(g[b]===0)continue;const y=d(a,f,b);y>0&&p>0?c[v+(p-1)*e]+=y:y<0&&p<s&&(c[v+p*e]-=y)}let h=!1;for(let p=0;p<n;p+=1){const v=.9*this.gas.massOf(p);l[p]=c[p]>v&&c[p]>0?v/c[p]:1,l[p]<1&&(h=!0)}if(h){for(let p=0;p<s;p+=1)for(let v=0;v<=e;v+=1){const b=v+p*i;if(m[b]===0)continue;const F=d(r,u,b)>0?v>0?v-1+p*e:-1:v<e?v+p*e:-1;if(!(F<0||l[F]>=1))for(let w=0;w<It;w+=1)r[w*u+b]*=l[F]}for(let p=0;p<=s;p+=1)for(let v=0;v<e;v+=1){const b=v+p*e;if(g[b]===0)continue;const F=d(a,f,b)>0?p>0?v+(p-1)*e:-1:p<s?v+p*e:-1;if(!(F<0||l[F]>=1))for(let w=0;w<It;w+=1)a[w*f+b]*=l[F]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=Xt;i+=1)n+=t[i*e+s];return n}}const Ht=.05;class xl{constructor(t,e,s){x(this,"g");x(this,"R");x(this,"solver");x(this,"vgas");x(this,"rho");x(this,"nmol");x(this,"cap");x(this,"mu");x(this,"veos");x(this,"srcV");x(this,"veosMid");x(this,"mover");x(this,"gasU");x(this,"gasV");x(this,"u0");x(this,"v0");x(this,"u1");x(this,"v1");x(this,"lim");x(this,"amb",new Float64Array(It));x(this,"ambT",293.15);x(this,"escaped",new Float64Array(It));x(this,"dp0",new Float64Array(8));x(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});x(this,"lo",0);x(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new Vs(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<xt;a+=1)n+=s[a]/dt[a];const i=e/(Ot*t*n);let r=0;for(let a=0;a<xt;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*Jt(a,t);this.amb[Xt]=0,this.amb[se]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*At(e);for(let r=0;r<xt;r+=1)i+=s.mg[r*n+t]*Jt(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return _i(s.mg[t],s.mg[n+t],s.mg[Q*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[Q*s+t],c=e.mfog[t],l=i+r+a;if(this.nmol[t]=i/dt[0]+r/dt[1]+a/dt[Q],l+c<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let u;if(c<=0)u=_o(i,r,a,e.Hg[t]);else{u=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const d=(e.Hg[t]-this.enthalpy(t,u))/this.heatCapacity(t,u);if(u+=d,Math.abs(d)<1e-10)break}}u>150&&u<3e3||(u=Math.min(3e3,Math.max(150,Number.isFinite(u)?u:this.ambT))),e.T[t]=u,this.cap[t]=_i(i,r,a,c,u),this.rho[t]=l/n,this.mu[t]=qc(i,r,a,u)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ht){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===st&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Ot*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ht){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[Q*e+s];if(t.kind[s]===st&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Ot*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ht||this.vgas[e]<=0?0:this.nmol[e]*Ot*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<xt;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let c=0;for(let f=0;f<xt;f+=1)c+=s[f]/dt[f];const l=this.R.pAt(t)*a/(Ot*e*c);let u=0;for(let f=0;f<xt;f+=1)i.mg[f*r+t]=l*s[f],u+=l*s[f]*Jt(f,e);i.mfog[t]=0,i.Hg[t]=u,i.T[t]=e}transitions(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e;let a=0;for(let c=0;c<i;c+=1){const l=t[c],u=r[c];if(l===u||u===ht||l===ht)continue;a+=1;const f=c%s,d=(c-f)/s;let m=0;for(let g=0;g<4;g+=1){const h=g===0?f>0?c-1:-1:g===1?f<s-1?c+1:-1:g===2?d>0?c-s:-1:d<n-1?c+s:-1;h>=0&&r[h]===U&&t[h]===U&&(m+=this.vgas[h]>0?this.vgas[h]:e.vCell)}if(!(m<=0)){if(u===st)for(let g=0;g<4;g+=1){const h=g===0?f>0?c-1:-1:g===1?f<s-1?c+1:-1:g===2?d>0?c-s:-1:d<n-1?c+s:-1;if(h<0||r[h]!==U||t[h]!==U)continue;const p=(this.vgas[h]>0?this.vgas[h]:e.vCell)/m;this.move(c,h,p)}else{let g=this.massOf(c),h=0;for(let p=0;p<4;p+=1){const v=p===0?f>0?c-1:-1:p===1?f<s-1?c+1:-1:p===2?d>0?c-s:-1:d<n-1?c+s:-1;if(v<0||r[v]!==U||t[v]!==U)continue;const b=(this.vgas[v]>0?this.vgas[v]:e.vCell)/m;h+=b*this.rho[v]}if(h*=Math.max(.001,1-e.phi[c]-e.alpha[c])*e.vCell,h<=g)continue;for(let p=0;p<4;p+=1){const v=p===0?f>0?c-1:-1:p===1?f<s-1?c+1:-1:p===2?d>0?c-s:-1:d<n-1?c+s:-1;if(v<0||r[v]!==U||t[v]!==U)continue;const b=(this.vgas[v]>0?this.vgas[v]:e.vCell)/m,y=this.massOf(v);if(y<=0)continue;const F=Math.min(.25,(h-g)*b/y);this.move(v,c,F)}g=this.massOf(c),g>0&&(e.T[c]=this.ambT)}this.deriveCell(c)}}return a}move(t,e,s){const n=this.g,i=n.n;for(let c=0;c<xt;c+=1){const l=n.mg[c*i+t]*s;n.mg[c*i+t]-=l,n.mg[c*i+e]+=l}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let c=0;c<s;c+=1)for(let l=0;l<=e;l+=1){const u=l+c*i,f=l>0?n[l-1+c*e]:-1,d=l<e?n[l+c*e]:-1;let m=0;(f===U&&d===U||l===0&&t.openL&&d===U||l===e&&t.openR&&f===U)&&(m=1),this.gasU[u]=m,m===0&&(r[u]=f===st||d===st?f===ht||d===ht||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[u]:t.usol[u])}for(let c=0;c<=s;c+=1)for(let l=0;l<e;l+=1){const u=l+c*e,f=c>0?n[l+(c-1)*e]:-1,d=c<s?n[l+c*e]:-1;let m=0;(f===U&&d===U||c===0&&t.openB&&d===U||c===s&&t.openT&&f===U)&&(m=1),this.gasV[u]=m,m===0&&(a[u]=f===st||d===st?f===ht||d===ht||c===0&&!t.openB||c===s&&!t.openT?0:t.vl[u]:t.vsol[u])}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=i+1,l=Math.min(i-1e-6,Math.max(0,e/a)),u=Math.min(r-1.000001,Math.max(0,s/a-.5)),f=Math.floor(l),d=Math.floor(u),m=l-f,g=u-d,h=t[f+d*c],p=t[f+1+d*c],v=t[f+(d+1)*c],b=t[f+1+(d+1)*c];return this.lo=Math.min(h,p,v,b),this.hi=Math.max(h,p,v,b),(1-g)*((1-m)*h+m*p)+g*((1-m)*v+m*b)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,c=Math.min(i-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),u=Math.floor(c),f=Math.floor(l),d=c-u,m=l-f,g=t[u+f*i],h=t[u+1+f*i],p=t[u+(f+1)*i],v=t[u+1+(f+1)*i];return this.lo=Math.min(g,h,p,v),this.hi=Math.max(g,h,p,v),(1-m)*((1-d)*g+d*h)+m*((1-d)*p+d*v)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,c=n+1,l=s.ug,u=s.vg,{u0:f,v0:d,u1:m,v1:g}=this,h=this.lim;f.set(l),d.set(u);for(let y=0;y<i;y+=1)for(let F=0;F<=n;F+=1){const w=F+y*c;if(this.gasU[w]===0){m[w]=f[w];continue}const P=F*r,_=(y+.5)*r,A=this.sampleV(d,P,_);m[w]=this.sampleU(f,P-t*f[w],_-t*A),h[2*w]=this.lo,h[2*w+1]=this.hi}const p=2*s.nu;for(let y=0;y<=i;y+=1)for(let F=0;F<n;F+=1){const w=F+y*n;if(this.gasV[w]===0){g[w]=d[w];continue}const P=(F+.5)*r,_=y*r,A=this.sampleU(f,P,_);g[w]=this.sampleV(d,P-t*A,_-t*d[w]),h[p+2*w]=this.lo,h[p+2*w+1]=this.hi}for(let y=0;y<i;y+=1)for(let F=0;F<=n;F+=1){const w=F+y*c;if(this.gasU[w]===0)continue;const P=F*r,_=(y+.5)*r,A=this.sampleV(d,P,_),k=this.sampleU(m,P+t*f[w],_+t*A);let M=m[w]+.5*(f[w]-k);(M<h[2*w]||M>h[2*w+1])&&(M=m[w]),l[w]=M}for(let y=0;y<=i;y+=1)for(let F=0;F<n;F+=1){const w=F+y*n;if(this.gasV[w]===0)continue;const P=(F+.5)*r,_=y*r,A=this.sampleU(f,P,_),k=this.sampleV(g,P+t*A,_+t*d[w]);let M=g[w]+.5*(d[w]-k);(M<h[p+2*w]||M>h[p+2*w+1])&&(M=g[w]),u[w]=M}const v=this.R;for(let y=0;y<=i;y+=1)for(let F=0;F<n;F+=1){const w=F+y*n;if(this.gasV[w]===0)continue;const P=y>0?F+(y-1)*n:-1,_=y<i?F+y*n:-1,A=P>=0&&a[P]===U?this.rho[P]:-1,k=_>=0&&a[_]===U?this.rho[_]:-1,M=Math.max(Ht,A>0&&k>0?.5*(A+k):Math.max(A,k));if(!(A>0||k>0))continue;const S=A>0?P:_,T=v.id[S],I=T>=0?v.rhoBar[T]:v.rhoAmb;u[w]-=t*e*(M-I)/M}m.set(l),g.set(u);const b=t/(r*r);for(let y=0;y<i;y+=1)for(let F=0;F<=n;F+=1){const w=F+y*c;if(this.gasU[w]===0)continue;const P=F<n&&a[F+y*n]===U?F+y*n:F-1+y*n,_=this.mu[P]/Math.max(Ht,this.rho[P]),A=m[w],k=F<n?m[w+1]:A,M=F>0?m[w-1]:A,S=y>0?m[w-c]:s.openB?A:-A,T=y<i-1?m[w+c]:s.openT?A:-A;l[w]=A+Math.min(.2,b*_)*(k+M+S+T-4*A)}for(let y=0;y<=i;y+=1)for(let F=0;F<n;F+=1){const w=F+y*n;if(this.gasV[w]===0)continue;const P=y<i&&a[F+y*n]===U?F+y*n:F+(y-1)*n,_=this.mu[P]/Math.max(Ht,this.rho[P]),A=g[w],k=y<i?g[w+n]:A,M=y>0?g[w-n]:A,S=F>0?g[w-1]:s.openL?A:-A,T=F<n-1?g[w+1]:s.openR?A:-A;u[w]=A+Math.min(.2,b*_)*(T+S+M+k-4*A)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==U){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:c}=n,l=i+1,u=n.ug,f=n.vg;let d=i,m=-1,g=r,h=-1,p=0;for(let _=0;_<r;_+=1)for(let A=0;A<i;A+=1)c[A+_*i]===U&&(p+=1,A<d&&(d=A),A>m&&(m=A),_<g&&(g=_),_>h&&(h=_));const v=this.last.solve;if(v.iterations=0,v.residual=0,v.capped=!1,this.last.cells=p,p===0)return this.last;const b=this.solver,y=b.begin(m-d+1,h-g+1),F=this.rho;for(let _=g;_<=h;_+=1)for(let A=d;A<=m;A+=1){const k=A+_*i;if(c[k]!==U)continue;const M=b.at(A-d,_-g);y.act[M]=1,y.x[M]=n.pg[k];const S=A+_*l,T=A+_*i,I=u[S+1]-u[S]+f[T+i]-f[T];y.b[M]=n.Sg[k]*a*a-a*I;const O=Math.max(Ht,F[k]);A+1<i?c[k+1]===U&&A+1<=m&&(y.ax[M]=2*t/(O+Math.max(Ht,F[k+1]))):n.openR&&(y.dDx[M]+=2*t/O),A===0&&n.openL&&(y.dDx[M]+=2*t/O),_+1<r?c[k+i]===U&&_+1<=h&&(y.ay[M]=2*t/(O+Math.max(Ht,F[k+i]))):n.openT&&(y.dDy[M]+=2*t/O),_===0&&n.openB&&(y.dDy[M]+=2*t/O)}const w=b.solve(e,s,!0);v.iterations=w.iterations,v.residual=w.residual,v.capped=w.capped;const P=n.pg;for(let _=0;_<n.n;_+=1)c[_]!==U&&(P[_]=0);for(let _=g;_<=h;_+=1)for(let A=d;A<=m;A+=1){const k=A+_*i;c[k]===U&&(P[k]=y.x[b.at(A-d,_-g)])}for(let _=0;_<r;_+=1)for(let A=0;A<=i;A+=1){const k=A+_*l;if(this.gasU[k]===0)continue;if(A===0){u[k]-=2*t/Math.max(Ht,F[_*i])/a*P[_*i];continue}if(A===i){u[k]+=2*t/Math.max(Ht,F[i-1+_*i])/a*P[i-1+_*i];continue}const M=A-1+_*i,S=A+_*i;u[k]-=2*t/(Math.max(Ht,F[M])+Math.max(Ht,F[S]))/a*(P[S]-P[M])}for(let _=0;_<=r;_+=1)for(let A=0;A<i;A+=1){const k=A+_*i;if(this.gasV[k]===0)continue;if(_===0){f[k]-=2*t/Math.max(Ht,F[A])/a*P[A];continue}if(_===r){f[k]+=2*t/Math.max(Ht,F[A+(r-1)*i])/a*P[A+(r-1)*i];continue}const M=A+(_-1)*i,S=A+_*i;f[k]-=2*t/(Math.max(Ht,F[M])+Math.max(Ht,F[S]))/a*(P[S]-P[M])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let c=0;for(let f=0;f<n;f+=1){if(s.id[f]!==r||e.kind[f]===ht||this.cap[f]<=0)continue;const d=this.nmol[f];c+=d*(d*Ot*e.T[f]/s.pAt(f))/this.cap[f]}c*=Ot/a;const l=1/Math.max(.05,1-c);let u=0;for(let f=0;f<4;f+=1){const d=s.statePressure(r);s.p0[r]=d;const m=(d-(t[r]+u))*l;if(Math.abs(m)<=1e-10*d)break;let g=0;for(let h=0;h<n;h+=1){if(s.id[h]!==r||e.kind[h]===ht||this.cap[h]<=0)continue;const p=this.nmol[h]*Ot*e.T[h]/s.pAt(h);g+=p,e.Hg[h]+=p*m,this.deriveCell(h)}u+=m,i+=g*m}s.p0[r]=s.statePressure(r),this.dp0[r]=u}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<xt;i+=1)n+=e.mg[i*s+t]/dt[i];return n<=0?0:e.mg[Q*s+t]/dt[Q]/n*this.R.pAt(t)}}const Lr=[1/6,2/3,1/6];class vl{constructor(t,e,s,n){x(this,"nx");x(this,"ny");x(this,"n");x(this,"dx");x(this,"depth");x(this,"vCell");x(this,"aFace");x(this,"nu");x(this,"nv");x(this,"openL",!1);x(this,"openR",!1);x(this,"openB",!1);x(this,"openT",!0);x(this,"solid");x(this,"role");x(this,"heater");x(this,"phiS");x(this,"sdf");x(this,"owner");x(this,"capB");x(this,"usol");x(this,"vsol");x(this,"phi");x(this,"alpha");x(this,"kind");x(this,"region");x(this,"pl");x(this,"pg");x(this,"mg");x(this,"mfog");x(this,"Hg");x(this,"Es");x(this,"film");x(this,"crust");x(this,"T");x(this,"Tl");x(this,"Cl");x(this,"Sl");x(this,"Sg");x(this,"ul");x(this,"vl");x(this,"ug");x(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.owner=new Int16Array(i),this.capB=new Float64Array(i),this.usol=new Float32Array(this.nu),this.vsol=new Float32Array(this.nv),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(ut*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.crust=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}updateStatic(t=0,e=0,s=this.nx-1,n=this.ny-1){const{nx:i,ny:r,dx:a}=this,c=Math.max(0,t),l=Math.max(0,e),u=Math.min(i-1,s),f=Math.min(r-1,n);for(let g=l;g<=f;g+=1)for(let h=c;h<=u;h+=1){const p=h+g*i;if(this.solid[p]!==0){this.phiS[p]=1;continue}let v=0;for(let b=-1;b<=1;b+=1)for(let y=-1;y<=1;y+=1)(y!==0||b!==0)&&this.solidAt(h+y,g+b)&&(v+=Lr[y+1]*Lr[b+1]);this.phiS[p]=v}const d=4,m=d*a;for(let g=l;g<=f;g+=1)for(let h=c;h<=u;h+=1){const p=h+g*i,v=this.solid[p]!==0,b=(h+.5)*a,y=(g+.5)*a;let F=m;v||(this.openL||(F=Math.min(F,b)),this.openR||(F=Math.min(F,this.w-b)),this.openB||(F=Math.min(F,y)),this.openT||(F=Math.min(F,this.h-y)));for(let w=-d;w<=d;w+=1){const P=g+w;if(!(P<0||P>=r))for(let _=-d;_<=d;_+=1){const A=h+_;if(A<0||A>=i||this.solid[A+P*i]!==0===v)continue;const M=Math.max(0,Math.abs(A+.5-(h+.5))-.5)*a,S=Math.max(0,Math.abs(P+.5-(g+.5))-.5)*a,T=Math.hypot(M,S);T<F&&(F=T)}}this.sdf[p]=v?-F:F}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),c=Math.floor(r),l=Math.floor(a),u=r-c,f=a-l,d=Math.min(s-1,c+1),m=Math.min(n-1,l+1),g=this.sdf;let h=(1-f)*((1-u)*g[c+l*s]+u*g[d+l*s])+f*((1-u)*g[c+m*s]+u*g[d+m*s]);return this.openL||(h=Math.min(h,t)),this.openR||(h=Math.min(h,this.w-t)),this.openB||(h=Math.min(h,e)),this.openT||(h=Math.min(h,this.h-e)),h}}const yl=5,Cr=30;class bl{constructor(t,e,s,n,i){x(this,"g");x(this,"P");x(this,"L");x(this,"G");x(this,"solver");x(this,"src");x(this,"C");x(this,"Cs");x(this,"Cg");x(this,"CTl");x(this,"Tstar");x(this,"k");x(this,"dE");x(this,"Tnew");x(this,"gx");x(this,"gy");x(this,"q");x(this,"Co");x(this,"CKo");x(this,"heaters",[]);x(this,"ambientT",293.15);x(this,"fluxSL",0);x(this,"fluxLG",0);x(this,"fluxSG",0);x(this,"lossSolids",0);x(this,"liquidPower",0);x(this,"hExt",Po);x(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r)}solidCap(t){const e=this.g.capB[t];if(e>0)return e;const s=vt[this.g.solid[t]-1];return s.rho*s.cp*this.g.vCell}solidCapCrust(t){return this.solidCap(t)+this.g.crust[t]*Xo}solidEnergy(t,e){return this.solidCapCrust(t)*(e-ct)+this.g.film[t]*At(e)}deriveSolid(t){const e=this.g,s=this.solidCapCrust(t),n=e.film[t];if(n<=0){e.T[t]=ct+e.Es[t]/s;return}let i=e.T[t]>100?e.T[t]:ct+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*je(i));e.T[t]=i}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/yl,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/Cr);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/Cr)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:c,ny:l,n:u,depth:f,dx:d}=n,{C:m,Cs:g,Cg:h,CTl:p,Tstar:v,k:b,q:y,src:F}=this;this.heaterPower(t),p.fill(0);const w=n.Cl;w.fill(0);const{Co:P,CKo:_}=this;let A=!1,k=0;for(let C=0;C<i.count;C+=1){const $=i.mat[C],H=i.T[C],nt=i.mass[C]*i.cp(C);k+=nt;const j=9*C,G=r.bi[C],W=r.bj[C],J=$===at?0:Rs($,H);$!==at&&!A&&(A=!0,P.fill(0),_.fill(0));for(let ft=0;ft<9;ft+=1){const mt=r.wt[j+ft];if(mt===0)continue;const Tt=G+ft%3,Mt=W+(ft/3|0);if(Tt<0||Mt<0||Tt>=c||Mt>=l)continue;const wt=Tt+Mt*c;w[wt]+=mt*nt,p[wt]+=mt*nt*H,$!==at&&(P[wt]+=mt*nt,_[wt]+=mt*nt*J)}}let M=0;for(let C=0;C<u;C+=1){let $=0,H=0;n.solid[C]!==0&&($=this.solidCapCrust(C)+n.film[C]*je(n.T[C]),H=vt[n.solid[C]-1].k);const nt=a.cap[C]>0&&n.solid[C]===0?a.cap[C]:0,j=w[C],G=$+nt+j;if(g[C]=$,h[C]=nt,m[C]=G,G<=0){v[C]=n.T[C],b[C]=0,y[C]=0;continue}const W=($*n.T[C]+nt*n.T[C]+p[C])/G;v[C]=W,j>0&&(n.Tl[C]=p[C]/j),n.solid[C]===0&&(j>=nt?H=A&&P[C]>0?((j-P[C])*Ai(W)+_[C])/j:Ai(W):H=Ic(n.mg[C],n.mg[u+C],n.mg[Q*u+C],W)),b[C]=H;let J=F[C];if(this.liquidPower!==0&&j>0){const mt=this.liquidPower*j/k;J+=mt,M+=mt}const ft=n.heater[C];if(ft>=0&&n.role[C]===1){const mt=this.heaters[ft];mt!==void 0&&mt.cells>0&&(J+=mt.P/mt.cells,M+=mt.P/mt.cells)}y[C]=J}const{gx:S,gy:T}=this;for(let C=0;C<l;C+=1)for(let $=0;$<c;$+=1){const H=$+C*c;if(S[H]=0,T[H]=0,m[H]<=0)continue;const nt=b[H];if($+1<c&&m[H+1]>0){const j=b[H+1];nt+j>0&&(S[H]=2*nt*j/(nt+j)*f)}if(C+1<l&&m[H+c]>0){const j=b[H+c];nt+j>0&&(T[H]=2*nt*j/(nt+j)*f)}}const I=this.solver,O=I.begin(c,l),D=O.stride,B=d*f,q=this.hExt*B,R=this.ambientT;for(let C=0;C<l;C+=1)for(let $=0;$<c;$+=1){const H=$+C*c;if(m[H]<=0)continue;const nt=$+1+(C+1)*D;O.act[nt]=1,O.dH[nt]=m[H]/t;let j=y[H];const G=b[H],W=v[H];$+1<c&&(O.ax[nt]=S[H],j+=S[H]*(v[H+1]-W)),$>0&&(j+=S[H-1]*(v[H-1]-W)),C+1<l&&(O.ay[nt]=T[H],j+=T[H]*(v[H+c]-W)),C>0&&(j+=T[H-c]*(v[H-c]-W));let J=0;$===0&&(J+=this.sideConductance(n.openL,G,q,f)),$===c-1&&(J+=this.sideConductance(n.openR,G,q,f)),C===0&&(J+=this.sideConductance(n.openB,G,q,f)),C===l-1&&(J+=this.sideConductance(n.openT,G,q,f)),J>0&&(O.dDx[nt]=J,j+=J*(R-v[H])),O.b[nt]=j}const E=I.solve(e,s,!1),z=this.last.solve;z.iterations=E.iterations,z.residual=E.residual,z.capped=E.capped;const N=this.Tnew,L=O.x;for(let C=0;C<l;C+=1)for(let $=0;$<c;$+=1){const H=$+C*c;N[H]=m[H]>0?v[H]+L[$+1+(C+1)*D]:n.T[H]}const V=this.dE;let tt=0,Y=0;for(let C=0;C<u;C+=1)V[C]=m[C]>0?y[C]*t:0;for(let C=0;C<l;C+=1)for(let $=0;$<c;$+=1){const H=$+C*c;if(m[H]<=0)continue;const nt=b[H];if(S[H]>0){const j=S[H]*(N[H+1]-N[H])*t;V[H]+=j,V[H+1]-=j,n.kind[H]!==n.kind[H+1]&&this.pair(n.kind[H],n.kind[H+1],j)}if(T[H]>0){const j=T[H]*(N[H+c]-N[H])*t;V[H]+=j,V[H+c]-=j,n.kind[H]!==n.kind[H+c]&&this.pair(n.kind[H],n.kind[H+c],j)}for(let j=0;j<4;j+=1){if(!(j===0?$===0:j===1?$===c-1:j===2?C===0:C===l-1))continue;const W=j===0?n.openL:j===1?n.openR:j===2?n.openB:n.openT,J=this.sideConductance(W,nt,q,f)*(N[H]-R)*t;V[H]-=J,W?Y+=J:tt+=J,n.solid[H]!==0&&(this.lossSolids+=J)}}for(let C=0;C<u;C+=1){if(m[C]<=0)continue;const $=V[C]/m[C];g[C]>0&&(n.Es[C]+=$*g[C],this.deriveSolid(C)),h[C]>0&&(n.Hg[C]+=$*h[C]),N[C]=$}for(let C=0;C<i.count;C+=1){const $=9*C,H=r.bi[C],nt=r.bj[C];let j=0;for(let J=0;J<9;J+=1){const ft=r.wt[$+J];if(ft===0)continue;const mt=H+J%3,Tt=nt+(J/3|0);if(mt<0||Tt<0||mt>=c||Tt>=l)continue;const Mt=mt+Tt*c;m[Mt]>0&&(j+=ft*N[Mt])}if(j===0)continue;const G=i.mass[C],W=G/i.rho[C];i.h[C]+=i.cp(C)*j,i.derive(C),r.dVp[C]+=G/i.rho[C]-W}for(let C=0;C<u;C+=1)h[C]>0&&a.deriveCell(C);F.fill(0);const X=this.last;return X.heater=M*t,X.lossWalls=tt,X.lossOpen=Y,X}pair(t,e,s){t===ht&&e===st?this.fluxSL-=s:t===st&&e===ht?this.fluxSL+=s:t===st&&e===U?this.fluxLG-=s:t===U&&e===st?this.fluxLG+=s:t===ht&&e===U?this.fluxSG-=s:t===U&&e===ht&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}function wl(o,t,e,s,n,i,r){const{nx:a,ny:c}=o,l=a+1,u=o.ul,f=o.vl;for(let d=0;d<o.nu;d+=1)s[d]=t[d]!==0?1:0;for(let d=0;d<o.nv;d+=1)n[d]=e[d]!==0?1:0;for(let d=0;d<2;d+=1){i.set(u),r.set(f);for(let m=0;m<c;m+=1)for(let g=0;g<=a;g+=1){const h=g+m*l;if(s[h]!==0)continue;let p=0,v=0;g>0&&s[h-1]===1&&(p+=u[h-1],v+=1),g<a&&s[h+1]===1&&(p+=u[h+1],v+=1),m>0&&s[h-l]===1&&(p+=u[h-l],v+=1),m<c-1&&s[h+l]===1&&(p+=u[h+l],v+=1),v>0&&(i[h]=p/v,s[h]=3)}for(let m=0;m<=c;m+=1)for(let g=0;g<a;g+=1){const h=g+m*a;if(n[h]!==0)continue;let p=0,v=0;g>0&&n[h-1]===1&&(p+=f[h-1],v+=1),g<a-1&&n[h+1]===1&&(p+=f[h+1],v+=1),m>0&&n[h-a]===1&&(p+=f[h-a],v+=1),m<c&&n[h+a]===1&&(p+=f[h+a],v+=1),v>0&&(r[h]=p/v,n[h]=3)}u.set(i),f.set(r);for(let m=0;m<o.nu;m+=1)s[m]===3&&(s[m]=1);for(let m=0;m<o.nv;m+=1)n[m]===3&&(n[m]=1)}for(let d=0;d<o.nu;d+=1)s[d]===0&&(u[d]=0);for(let d=0;d<o.nv;d+=1)n[d]===0&&(f[d]=0)}function Fl(o,t,e){const{nx:s,ny:n,kind:i}=t;let r=!1;for(let a=0;a<o.count;a+=1){const c=Math.min(s-1,Math.max(0,Math.floor(o.x[a]/t.dx))),l=Math.min(n-1,Math.max(0,Math.floor(o.y[a]/t.dx)));if(i[c+l*s]===st){e[a]=0;continue}let u=!1;for(let f=Math.max(0,l-2);f<=Math.min(n-1,l+2)&&!u;f+=1)for(let d=Math.max(0,c-2);d<=Math.min(s-1,c+2);d+=1)if(i[d+f*s]===st){u=!0;break}e[a]=u?0:1,u||(r=!0)}return r}function Or(o,t,e,s){const{nx:n,ny:i,dx:r}=o,a=n+1,c=1/r;let l=Math.min(n-1e-6,Math.max(0,t*c)),u=Math.min(i-1.000001,Math.max(0,e*c-.5)),f=Math.floor(l),d=Math.floor(u),m=l-f,g=u-d;const h=o.ul;s[0]=(1-g)*((1-m)*h[f+d*a]+m*h[f+1+d*a])+g*((1-m)*h[f+(d+1)*a]+m*h[f+1+(d+1)*a]),l=Math.min(n-1.000001,Math.max(0,t*c-.5)),u=Math.min(i-1e-6,Math.max(0,e*c)),f=Math.floor(l),d=Math.floor(u),m=l-f,g=u-d;const p=o.vl;s[1]=(1-g)*((1-m)*p[f+d*n]+m*p[f+1+d*n])+g*((1-m)*p[f+(d+1)*n]+m*p[f+1+(d+1)*n])}function Al(o,t,e,s,n,i,r,a,c,l,u){const{nx:f,ny:d,dx:m}=o;for(let v=0;v<o.nu;v+=1)e[v]=n[v]>l?e[v]/n[v]:0;for(let v=0;v<o.nv;v+=1)s[v]=i[v]>l?s[v]/i[v]:0;const g=c*m*m/u,h=(v,b)=>v+b>0?2*v*b/(v+b):0;let p=0;{const v=f+1,b=t.begin(v,d),y=o.ul;for(let w=0;w<d;w+=1)for(let P=0;P<=f;P+=1){const _=P+w*v;if(r[_]!==1)continue;const A=t.at(P,w),k=e[_];if(b.act[A]=1,b.dH[A]=g,b.x[A]=y[_],b.b[A]=g*y[_],P+1<=f){const M=r[_+1];M===1?b.ax[A]=h(k,e[_+1]):M===2&&(b.dDx[A]+=k)}if(P>0&&r[_-1]===2&&(b.dDx[A]+=k),w+1<d){const M=r[_+v];M===1?b.ay[A]=h(k,e[_+v]):M===2&&(b.dDy[A]+=2*k)}else o.openT||(b.dDy[A]+=2*k);w>0?r[_-v]===2&&(b.dDy[A]+=2*k):o.openB||(b.dDy[A]+=2*k)}const F=t.solve(1e-6,200,!1);p+=F.iterations;for(let w=0;w<d;w+=1)for(let P=0;P<=f;P+=1){const _=P+w*v;r[_]===1&&(y[_]=b.x[t.at(P,w)])}}{const v=t.begin(f,d+1),b=o.vl;for(let F=0;F<=d;F+=1)for(let w=0;w<f;w+=1){const P=w+F*f;if(a[P]!==1)continue;const _=t.at(w,F),A=s[P];if(v.act[_]=1,v.dH[_]=g,v.x[_]=b[P],v.b[_]=g*b[P],F+1<=d){const k=a[P+f];k===1?v.ay[_]=h(A,s[P+f]):k===2&&(v.dDy[_]+=A)}if(F>0&&a[P-f]===2&&(v.dDy[_]+=A),w+1<f){const k=a[P+1];k===1?v.ax[_]=h(A,s[P+1]):k===2&&(v.dDx[_]+=2*A)}else o.openR||(v.dDx[_]+=2*A);w>0?a[P-1]===2&&(v.dDx[_]+=2*A):o.openL||(v.dDx[_]+=2*A)}const y=t.solve(1e-6,200,!1);p+=y.iterations;for(let F=0;F<=d;F+=1)for(let w=0;w<f;w+=1){const P=w+F*f;a[P]===1&&(b[P]=v.x[t.at(w,F)])}}return p}class _l{constructor(){x(this,"cellMat",null);x(this,"cellHost",null);x(this,"cellVolW",null)}compute(t,e,s,n,i){const{nx:r,ny:a,n:c}=e,l=te.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(c*l),this.cellHost=new Uint8Array(c));const u=this.cellMat,f=this.cellHost;u.fill(0);let d=!1;for(let h=0;h<t.count;h+=1){const p=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),v=Math.min(a-1,Math.max(0,Math.floor(t.y[h]/e.dx)));u[(p+v*r)*l+t.mat[h]]+=t.mass[h],t.smass[2*h]>0&&(d=!0)}if(d){this.cellVolW===null&&(this.cellVolW=new Float64Array(c));const h=this.cellVolW;h.fill(0);for(let p=0;p<t.count;p+=1){if(t.mat[p]!==at)continue;const v=Math.min(r-1,Math.max(0,Math.floor(t.x[p]/e.dx))),b=Math.min(a-1,Math.max(0,Math.floor(t.y[p]/e.dx)));h[v+b*r]+=t.mass[p]/t.rho[p]}}for(let h=0;h<c;h+=1){let p=0;for(let v=1;v<l;v+=1)u[h*l+v]>u[h*l+p]&&(p=v);f[h]=p}let m=!1;const g=.25*e.dx;for(let h=0;h<t.count;h+=1){i[h]=0;const p=Math.min(r-1,Math.max(0,Math.floor(t.x[h]/e.dx))),v=Math.min(a-1,Math.max(0,Math.floor(t.y[h]/e.dx))),b=f[p+v*r],y=t.mat[h];if(y===b)continue;const F=t.T[h],w=this.cellVolW,P=p+v*r,_=d&&b===at&&w!==null&&w[P]>0?u[P*l]/w[P]:Xe(b,F),A=t.rho[h],k=Ws(b,F),M=Ws(y,F),S=t.mass[h]/A,T=Math.cbrt(6*S/Math.PI),I=Math.abs(_-A);if(I<=0||n<=0)continue;const O=(2*k+3*M)/(3*k+3*M);let D=I*n*T*T/(18*k*O);for(let q=0;q<8;q+=1){const R=Math.max(1e-9,_*D*T/k),E=24/R*O*(1+.15*Math.pow(R,.687));D=Math.sqrt(4*I*n*T/(3*_*E))}const B=A<_?1:-1;i[h]=B*Math.min(g,D*s),m=!0}return m}}function Pl(o,t,e,s,n,i,r,a,c,l,u){const f=t.w,d=t.h,m=t.dx;let g=0,h=0,p=0,v=0;const b=s;for(let y=0;y<o.count;y+=1){const F=o.x[y],w=o.y[y],P=b[y]!==0;let _,A;if(P)_=F+e*o.vx[y],A=w+e*o.vy[y];else{i(F,w,c);const S=F+.5*e*c[0],T=w+.5*e*c[1];i(S,T,c),_=F+e*c[0],A=w+e*c[1]+(n!==null?n[y]:0)}if(_<0&&t.openL||_>f&&t.openR||A<0&&t.openB||A>d&&t.openT){const S=o.smass[2*y];o.mat[y]===at?g+=o.mass[y]-S:h+=o.mass[y]-S,p+=S,v+=o.mass[y]*o.h[y],n!==null&&(n[y]=n[o.count-1]),b[y]=b[o.count-1],r(y),y-=1;continue}const k=1e-4*m;P&&(_<k||_>f-k)&&(o.vx[y]=0),P&&(A<k||A>d-k)&&(o.vy[y]=0),_=Math.min(f-k,Math.max(k,_)),A=Math.min(d-k,Math.max(k,A));const M=a!==null?a(F,w,_,A,l):0;if(M===1){_=l[0],A=l[1];const S=l[2],T=l[3];if(P)o.vx[y]=l[4],o.vy[y]=l[5];else{const I=(o.vx[y]-l[4])*S+(o.vy[y]-l[5])*T;I<0&&(o.vx[y]-=I*S,o.vy[y]-=I*T)}}else if(M===0){let S=t.sdfAt(_,A);if(S<.05*m)for(let T=0;T<3&&S<.05*m;T+=1){const I=.25*m;let O=t.sdfAt(_+I,A)-t.sdfAt(_-I,A),D=t.sdfAt(_,A+I)-t.sdfAt(_,A-I);const B=Math.hypot(O,D);if(B<1e-12)break;O/=B,D/=B;const q=.05*m-S;_+=q*O,A+=q*D;const R=o.vx[y]*O+o.vy[y]*D;P?(o.vx[y]=0,o.vy[y]=0):R<0&&(o.vx[y]-=R*O,o.vy[y]-=R*D),_=Math.min(f-k,Math.max(k,_)),A=Math.min(d-k,Math.max(k,A)),S=t.sdfAt(_,A)}}o.x[y]=_,o.y[y]=A}u.m=g,u.o=h,u.s=p,u.e=v}const kl=(o,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(o),ay:new Float64Array(o),gx:new Float64Array(o),gy:new Float64Array(o),dH:new Float64Array(o),dDx:new Float64Array(o),dDy:new Float64Array(o),gDx:new Float64Array(o),gDy:new Float64Array(o),eDx:new Float64Array(o),eDy:new Float64Array(o),area:new Float64Array(o),ox:new Float64Array(o),oy:new Float64Array(o),diag:new Float64Array(o),inv:new Float64Array(o),act:new Uint8Array(o),x:new Float64Array(o),b:new Float64Array(o),r:new Float64Array(o),band:new Int32Array(o),bandCount:0}),jr=24,Tl=1,Ml=1,Br=24,Ir=1,ie=(o,t)=>(o+2)*(t+2);function qr(o,t,e){let s=0;for(let n=0;n<e;n+=1)s+=o[n]*t[n];return s}function Sl(o,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){o[a]+=n*e[a];const c=t[a]-n*s[a];t[a]=c,r+=c*c}return r}function Ll(o,t,e,s){for(let n=0;n<s;n+=1)o[n]=t[n]+e*o[n]}class yt{constructor(t,e){x(this,"levels",[]);x(this,"depth",1);x(this,"xs");x(this,"bs");x(this,"p");x(this,"q");x(this,"zj");x(this,"rj");x(this,"nullId");x(this,"stack");x(this,"nullSum",new Float64Array(16));x(this,"nullCnt",new Float64Array(16));x(this,"nullCount",0);x(this,"system");x(this,"result",{iterations:0,residual:0,capped:!1});x(this,"pw",new Float64Array(4));x(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(kl(ie(s,n),i)),!(s*n<=jr||s<=2&&n<=2);)i=ie(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=ie(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],c=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:c,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=ie(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,diag:u,inv:f,act:d}=t;for(let m=1;m<=s;m+=1){let g=1+m*n;for(let h=1;h<=e;h+=1,g+=1){if(d[g]===0){u[g]=1,f[g]=1;continue}const p=a[g]+c[g]+l[g]+i[g]+i[g-1]+r[g]+r[g-n];if(!(p>0)){d[g]=0,u[g]=1,f[g]=1;continue}u[g]=p,f[g]=1/p}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:c,diag:l}=t;for(let u=1;u<=i;u+=1){let f=1+u*r;for(let d=1;d<=n;d+=1,f+=1)s[f]=l[f]*e[f]-a[f]*e[f+1]-a[f-1]*e[f-1]-c[f]*e[f+r]-c[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:c,x:l,b:u}=t;for(let f=1;f<=n;f+=1){let d=1+(1+f+e&1)+f*i;const m=s+f*i;for(;d<=m;d+=2)l[d]=(u[d]+r[d]*l[d+1]+r[d-1]*l[d-1]+a[d]*l[d+i]+a[d-i]*l[d-i])*c[d]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:c}=t;let l=0;for(let u=1;u<=s;u+=1){let f=1+u*n;for(let d=1;d<=e;d+=1,f+=1)i[f]!==0&&(i[f-1]===0||i[f+1]===0||i[f-n]===0||i[f+n]===0||r[f]>0||a[f]>0)&&(c[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:c,band:l,bandCount:u}=t;for(let f=e>0?0:u-1;e>0?f<u:f>=0;f+=e){const d=l[f];a[d]=(c[d]+n[d]*a[d+1]+n[d-1]*a[d-1]+i[d]*a[d+s]+i[d-s]*a[d-s])*r[d]}}prepareFine(){const t=this.levels[0],e=ie(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=jr||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=ie(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,c=e.h,l=s.h;for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const d=f+1+(u+1)*s.stride;let m=0,g=0,h=0,p=0;for(let _=0;_<2;_+=1){const A=2*u+_;if(!(A>=e.ny))for(let k=0;k<2;k+=1){const M=2*f+k;if(M>=e.nx)continue;const S=M+1+(A+1)*a;if(e.act[S]===0)continue;const T=e.area[S];m+=T,g+=T*((k-.5)*c+e.ox[S]*c),h+=T*((_-.5)*c+e.oy[S]*c),p+=e.dH[S]}}if(m<=0){s.act[d]=0,s.dH[d]=0,s.dDx[d]=0,s.dDy[d]=0,s.gDx[d]=0,s.gDy[d]=0,s.ox[d]=0,s.oy[d]=0;continue}s.act[d]=1,s.area[d]=m/4;const v=g/m,b=h/m;s.ox[d]=v/l,s.oy[d]=b/l,s.dH[d]=p;let y=0,F=0,w=0,P=0;for(let _=0;_<2;_+=1){const A=2*u+_;if(!(A>=e.ny))for(let k=0;k<2;k+=1){const M=2*f+k;if(M>=e.nx)continue;const S=M+1+(A+1)*a;if(e.act[S]!==0){if(e.gDx[S]>0){const T=(k-.5)*c+e.ox[S]*c;y+=e.gDx[S],F+=e.gDx[S]/(e.eDx[S]+Math.abs(T-v))}if(e.gDy[S]>0){const T=(_-.5)*c+e.oy[S]*c;w+=e.gDy[S],P+=e.gDy[S]/(e.eDy[S]+Math.abs(T-b))}}}}s.gDx[d]=y,s.gDy[d]=w,s.dDx[d]=F,s.dDy[d]=P,s.eDx[d]=F>0?y/F:.5*l,s.eDy[d]=P>0?w/P:.5*l}for(let u=0;u<i;u+=1)for(let f=0;f<n;f+=1){const d=f+1+(u+1)*s.stride;if(s.act[d]!==0){if(f+1<n&&s.act[d+1]!==0){const m=2*f+1;let g=0;if(m+1<e.nx)for(let h=0;h<2;h+=1){const p=2*u+h;p>=e.ny||(g+=e.gx[m+1+(p+1)*a])}if(g>0){const h=l*(1+s.ox[d+1]-s.ox[d]);s.gx[d]=g,s.ax[d]=g/Math.max(.25*l,h)}}if(u+1<i&&s.act[d+s.stride]!==0){const m=2*u+1;let g=0;if(m+1<e.ny)for(let h=0;h<2;h+=1){const p=2*f+h;p>=e.nx||(g+=e.gy[p+1+(m+1)*a])}if(g>0){const h=l*(1+s.oy[d+s.stride]-s.oy[d]);s.gy[d]=g,s.ay[d]=g/Math.max(.25*l,h)}}}}yt.diagonal(s),yt.findBand(s);for(let u=0;u<e.ny;u+=1){let f=1+(u+1)*a;for(let d=0;d<e.nx;d+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}yt.weights(s,d,u,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,c=s>>1,l=(e&1)===1?1:-1,u=(s&1)===1?1:-1,f=t.stride,d=a+1+(c+1)*f;r[0]=d,r[1]=d+l,r[2]=d+u*f,r[3]=d+l+u*f;const m=a+l>=0&&a+l<t.nx,g=c+u>=0&&c+u<t.ny;i[1]=m&&t.act[r[1]]!==0?3/16:0,i[2]=g&&t.act[r[2]]!==0?3/16:0,i[3]=m&&g&&t.act[r[3]]!==0?1/16:0,t.act[d]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<Br;m+=1)yt.color(e,0),yt.color(e,1);for(let m=0;m<Br;m+=1)yt.color(e,1),yt.color(e,0);return}for(let m=0;m<Tl;m+=1)yt.color(e,0),yt.color(e,1);for(let m=0;m<Ir;m+=1)yt.bandSweep(e,1);yt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,ie(s.nx,s.ny)),s.x.fill(0,0,ie(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:c}=e,{pIdx:l,pW:u}=s,f=s.b,d=s.x;for(let m=0;m<e.ny;m+=1){let g=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,g+=1){if(i[g]===0)continue;const p=r[g]-a[g],v=4*g;f[l[v]]+=u[v]*p,f[l[v+1]]+=u[v+1]*p,f[l[v+2]]+=u[v+2]*p,f[l[v+3]]+=u[v+3]*p}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let g=1+(m+1)*n;for(let h=0;h<e.nx;h+=1,g+=1){if(i[g]===0)continue;const p=4*g;c[g]+=u[p]*d[l[p]]+u[p+1]*d[l[p+1]]+u[p+2]*d[l[p+2]]+u[p+3]*d[l[p+3]]}}for(let m=0;m<Ir;m+=1)yt.bandSweep(e,-1);for(let m=0;m<Ml;m+=1)yt.color(e,1),yt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:c,dDy:l,act:u}=t,f=this.nullId,d=ie(e,s);let m=!1;for(let g=0;g<d;g+=1)if(u[g]!==0&&!(a[g]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,d),this.nullCount=0;for(let g=1;g<=s;g+=1)for(let h=1;h<=e;h+=1){const p=h+g*n;if(u[p]===0||f[p]!==-2)continue;let v=0,b=0,y=!1;const F=-3-this.nullCount;this.stack[v++]=p,f[p]=F;let w=p,P=p;for(;v>0;){const A=this.stack[--v];b+=1,A<w&&(w=A),A>P&&(P=A),(a[A]>0||c[A]>0||l[A]>0)&&(y=!0),i[A]>0&&f[A+1]===-2&&(f[A+1]=F,this.stack[v++]=A+1),i[A-1]>0&&f[A-1]===-2&&(f[A-1]=F,this.stack[v++]=A-1),r[A]>0&&f[A+n]===-2&&(f[A+n]=F,this.stack[v++]=A+n),r[A-n]>0&&f[A-n]===-2&&(f[A-n]=F,this.stack[v++]=A-n)}let _=-1;if(!y){if(_=this.nullCount,_>=this.nullSum.length){const A=k=>{const M=new Float64Array(2*k.length);return M.set(k),M};this.nullSum=A(this.nullSum),this.nullCnt=A(this.nullCnt)}this.nullCnt[_]=b,this.nullCount+=1}for(let A=w;A<=P;A+=1)f[A]===F&&(f[A]=_)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=ie(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=ie(i.nx,i.ny),{act:a}=i,c=this.xs,l=this.bs,u=i.stride;for(let w=0;w<r;w+=1){if(a[w]===0){c[w]=0,l[w]=0,i.ax[w]=0,i.ay[w]=0;continue}(w+1>=r||a[w+1]===0)&&(i.ax[w]=0),(w+u>=r||a[w+u]===0)&&(i.ay[w]=0)}yt.diagonal(i);for(let w=0;w<r;w+=1)a[w]===0&&(c[w]=0,l[w]=0);this.findNull(),this.project(l),s&&(yt.findBand(i),this.prepareFine(),this.coarsen());const f=s?i.b:this.rj,d=s?i.x:this.zj,{p:m,q:g}=this;g.fill(0,0,r),m.fill(0,0,r),d.fill(0,0,r),yt.apply(i,c,g);let h=0,p=0;for(let w=0;w<r;w+=1){const P=a[w]===0?0:l[w]-g[w];f[w]=P,h+=l[w]*l[w],p+=P*P}this.project(f);const v=Math.sqrt(h);if(v===0)return c.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let b=Math.sqrt(p)/v;if(b<=t)return n.iterations=0,n.residual=b,n.capped=!1,n;this.precondition(s,f,d,r);let y=0;for(let w=0;w<r;w+=1)m[w]=d[w],y+=f[w]*d[w];let F=0;for(;F<e;){F+=1,yt.apply(i,m,g);const w=qr(m,g,r);if(!(w>0))break;const P=y/w;if(p=Sl(c,f,m,g,P,r),b=Math.sqrt(p)/v,b<=t)break;this.precondition(s,f,d,r);const _=qr(f,d,r),A=_/y;y=_,Ll(m,d,A,r)}this.project(c);for(let w=0;w<r;w+=1)a[w]===0&&(c[w]=0);return n.iterations=F,n.residual=b,n.capped=b>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Cl=.1,Er=1e-9,Ti=.1;function ee(o,t,e){const s=Math.floor(o-.5),n=o-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class Ol{constructor(t,e,s){x(this,"g");x(this,"P");x(this,"solver");x(this,"mu");x(this,"pu");x(this,"mv");x(this,"pv");x(this,"rv");x(this,"knownU");x(this,"knownV");x(this,"tmpU");x(this,"tmpV");x(this,"markU");x(this,"markV");x(this,"bi");x(this,"bj");x(this,"wr");x(this,"wt");x(this,"dVp");x(this,"volSrc");x(this,"fU");x(this,"fV");x(this,"pGas");x(this,"w",new Float64Array(12));x(this,"rhoRef",998);x(this,"weightsDirty",!0);x(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedSalt:0,escapedEnergy:0,viscIterations:0});x(this,"escM",0);x(this,"escO",0);x(this,"escS",0);x(this,"escE",0);x(this,"viscous",!1);x(this,"etaU",null);x(this,"etaV",null);x(this,"vsolver",null);x(this,"mf",0);x(this,"ms",1);x(this,"stranded",new Uint8Array(0));x(this,"vel",new Float64Array(2));x(this,"drifts",new _l);x(this,"dropletDrift",null);x(this,"bodyHit",null);x(this,"afterSolve",null);x(this,"hit",new Float64Array(6));x(this,"escaped",{m:0,o:0,s:0,e:0});x(this,"velocityAtFn",(t,e,s)=>{Or(this.g,t,e,s)});x(this,"removeFn",t=>{this.removeParticle(t)});this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;for(let c=0;c<t.count;c+=1){n[c]=ee(t.x[c]*a-.5,s,0),i[c]=ee(t.y[c]*a-.5,s,3);const l=9*c;for(let u=0;u<3;u+=1)for(let f=0;f<3;f+=1)r[l+f+3*u]=s[f]*s[3+u]}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:c,kind:l}=e;for(let u=0;u<t.count;u+=1){const f=9*u,d=s[u],m=n[u];let g=0;for(let h=0;h<9;h+=1){const p=d+h%3,v=m+(h/3|0),y=p>=0&&v>=0&&p<a&&v<c&&l[p+v*a]===st?i[f+h]:0;r[f+h]=y,g+=y}if(g>0){const h=1/g;for(let p=0;p<9;p+=1)r[f+p]*=h}else{for(let h=0;h<9;h+=1)r[f+h]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:n,bi:i,bj:r,wr:a,wt:c}=this,{nx:l,ny:u,kind:f}=s,d=1/s.dx;i[t]=ee(e.x[t]*d-.5,n,0),r[t]=ee(e.y[t]*d-.5,n,3);const m=9*t;let g=0;for(let h=0;h<3;h+=1)for(let p=0;p<3;p+=1){const v=p+3*h,b=n[p]*n[3+h];a[m+v]=b;const y=i[t]+p,F=r[t]+h,w=y>=0&&F>=0&&y<l&&F<u&&f[y+F*l]===st;c[m+v]=w?b:0,w&&(g+=b)}if(g>0)for(let h=0;h<9;h+=1)c[m+h]/=g;else{for(let h=0;h<9;h+=1)c[m+h]=0;c[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:c}=e;c.fill(0);const l=1/e.vCell;let u=0,f=0;for(let d=0;d<t.count;d+=1){const m=t.mass[d]/t.rho[d];u+=t.mass[d],f+=m;const g=9*d,h=s[d],p=n[d];for(let v=0;v<9;v+=1){const b=h+v%3,y=p+(v/3|0);b<0||y<0||b>=r||y>=a||(c[b+y*r]+=i[g+v]*m*l)}}f>0&&(this.rhoRef=u/f)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ht;continue}const a=e.phi[r];let c=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!c&&t!==null&&t[r]!==U&&t[r]!==ht){const l=r%s,u=(r-l)/s;(l>0?t[r-1]===U:e.openL)||(l<s-1?t[r+1]===U:e.openR)||(u>0?t[r-s]===U:e.openB)||(u<n-1?t[r+s]===U:e.openT)||(c=!0)}e.kind[r]=c?st:U,c&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:c}=this,{nx:l,ny:u,dx:f}=e,d=1/f,m=l+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),c.fill(0);const g=1/this.rhoRef,h=this.viscous;h&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const p=this.etaU,v=this.etaV;h&&(p.fill(0),v.fill(0));for(let b=0;b<t.count;b+=1){const y=t.x[b],F=t.y[b],w=t.mass[b],P=h?Ws(t.mat[b],t.T[b]):0,_=t.vx[b],A=t.vy[b],k=t.c00[b],M=t.c01[b],S=t.c10[b],T=t.c11[b],I=y*d,O=F*d;let D=ee(I,s,0),B=ee(O-.5,s,3);for(let R=0;R<3;R+=1){const E=B+R,z=(E+.5)*f-F;for(let N=0;N<3;N+=1){const L=D+N,V=s[N]*s[3+R]*w,tt=V*(_+k*(L*f-y)+M*z);if(L>=0&&L<=l&&E>=0&&E<u){const Y=L+E*m;n[Y]+=V,i[Y]+=tt,h&&(p[Y]+=V*P)}else this.mirrorU(L,E),n[this.mf]+=V,i[this.mf]+=this.ms*tt,h&&(p[this.mf]+=V*P)}}D=ee(I-.5,s,0),B=ee(O,s,3);const q=t.rho[b]*g;for(let R=0;R<3;R+=1){const E=B+R,z=E*f-F;for(let N=0;N<3;N+=1){const L=D+N,V=s[N]*s[3+R]*w,tt=V*(A+S*((L+.5)*f-y)+T*z);let Y,X=1;L>=0&&L<l&&E>=0&&E<=u?Y=L+E*l:(this.mirrorV(L,E),Y=this.mf,X=this.ms),r[Y]+=V,a[Y]+=X*tt,c[Y]+=V*q,h&&(v[Y]+=V*P)}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?s.openL?r=0:(r=-r,c=-c):r>n&&(s.openR?r=n:(r=2*n-r,c=-c)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=c}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,c=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,c=-c):a>i&&(s.openT?a=i:(a=2*i-a,c=-c)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=c}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:c,dx:l,kind:u}=i,f=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:d,pu:m,mv:g,pv:h,rv:p,knownU:v,knownV:b}=this,y=i.ul,F=i.vl,w=this.rhoRef*i.vCell*.25,P=Er*w,_=this.viscous;for(let q=0;q<i.nu;q+=1)y[q]=d[q]>P?m[q]/d[q]+(_?0:t*this.fU[q]/(this.rhoRef*i.vCell)):0;for(let q=0;q<i.nv;q+=1)F[q]=g[q]>P?h[q]/g[q]+(_?0:-t*e*(p[q]/g[q])+t*this.fV[q]/(this.rhoRef*i.vCell)):0;for(let q=0;q<c;q+=1)for(let R=0;R<=a;R+=1){const E=R+q*f,z=R>0?u[R-1+q*a]:-1,N=R<a?u[R+q*a]:-1,L=R===0&&!i.openL,V=R===a&&!i.openR;if(L||V||z===ht||N===ht){y[E]=L||V?0:i.usol[E],v[E]=2;continue}v[E]=z===st||N===st?1:0}for(let q=0;q<=c;q+=1)for(let R=0;R<a;R+=1){const E=R+q*a,z=q>0?u[R+(q-1)*a]:-1,N=q<c?u[R+q*a]:-1,L=q===0&&!i.openB,V=q===c&&!i.openT;if(L||V||z===ht||N===ht){F[E]=L||V?0:i.vsol[E],b[E]=2;continue}b[E]=z===st||N===st?1:0}if(this.last.viscIterations=0,_){this.viscosity(t);const q=t/(this.rhoRef*i.vCell);for(let R=0;R<i.nu;R+=1)v[R]!==2&&d[R]>P&&(y[R]+=q*this.fU[R]);for(let R=0;R<i.nv;R+=1)b[R]!==2&&g[R]>P&&(F[R]+=-t*e*(p[R]/g[R])+q*this.fV[R])}let A=a,k=-1,M=c,S=-1,T=0;for(let q=0;q<c;q+=1)for(let R=0;R<a;R+=1)u[R+q*a]===st&&(T+=1,R<A&&(A=R),R>k&&(k=R),q<M&&(M=q),q>S&&(S=q));const I=this.last.solve;if(I.iterations=0,I.residual=0,I.capped=!1,T>0){const q=k-A+1,R=S-M+1,E=this.solver,z=E.begin(q,R),N=t/this.rhoRef,L=1/i.vCell,V=this.pGas;for(let X=M;X<=S;X+=1)for(let C=A;C<=k;C+=1){const $=C+X*a;if(u[$]!==st)continue;const H=E.at(C-A,X-M);z.act[H]=1,z.x[H]=i.pl[$];const nt=C+X*f,j=C+X*a,G=y[nt+1]-y[nt]+F[j+a]-F[j],W=i.phi[$]+i.phiS[$]+i.alpha[$];let J=this.volSrc[$]*L;const ft=this.gasAt(C-1,X)||this.gasAt(C+1,X)||this.gasAt(C,X-1)||this.gasAt(C,X+1),mt=W-1;(mt>0||!ft)&&(J+=Cl*mt/t);let Tt=J*l*l-l*G;if(C+1<a){const Mt=u[$+1];if(Mt===st)C+1<=k&&(z.ax[H]=N);else if(Mt===U){const wt=N/this.theta($,$+1);z.dDx[H]+=wt,Tt+=wt*V[$+1]}}else i.openR&&(z.dDx[H]+=2*N);if(C>0){if(u[$-1]===U){const wt=N/this.theta($,$-1);z.dDx[H]+=wt,Tt+=wt*V[$-1]}}else i.openL&&(z.dDx[H]+=2*N);if(X+1<c){const Mt=u[$+a];if(Mt===st)X+1<=S&&(z.ay[H]=N);else if(Mt===U){const wt=N/this.theta($,$+a);z.dDy[H]+=wt,Tt+=wt*V[$+a]}}else i.openT&&(z.dDy[H]+=2*N);if(X>0){if(u[$-a]===U){const wt=N/this.theta($,$-a);z.dDy[H]+=wt,Tt+=wt*V[$-a]}}else i.openB&&(z.dDy[H]+=2*N);z.b[H]=Tt}const tt=E.solve(s,n,!0);I.iterations=tt.iterations,I.residual=tt.residual,I.capped=tt.capped;const Y=i.pl;for(let X=0;X<i.n;X+=1)Y[X]=u[X]===U?V[X]:0;for(let X=M;X<=S;X+=1)for(let C=A;C<=k;C+=1){const $=C+X*a;u[$]===st&&(Y[$]=z.x[E.at(C-A,X-M)])}for(let X=0;X<c;X+=1)for(let C=0;C<=a;C+=1){const $=C+X*f;if(v[$]===1){if(C===0){y[$]-=N/l*2*(Y[X*a]-0);continue}if(C===a){y[$]-=N/l*2*(0-Y[a-1+X*a]);continue}y[$]-=N/l*this.across(C-1+X*a,C+X*a)}}for(let X=0;X<=c;X+=1)for(let C=0;C<a;C+=1){const $=C+X*a;if(b[$]===1){if(X===0){F[$]-=N/l*2*(Y[C]-0);continue}if(X===c){F[$]-=N/l*2*(0-Y[C+(c-1)*a]);continue}F[$]-=N/l*this.across(C+(X-1)*a,C+X*a)}}this.afterSolve!==null&&this.afterSolve(E,A,M,t)}this.extrapolate();const O=this.markStranded(),D=this.g2p(O?t:0,e);this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const B=this.last;return B.cells=T,B.uMax=D,B.escapedMass=this.escM,B.escapedOther=this.escO,B.escapedSalt=this.escS,B.escapedEnergy=this.escE,B}theta(t,e){const s=this.g,n=s.phi[t]/(1-Math.min(.9,s.phiS[t]))+s.alpha[t],i=s.phi[e]/(1-Math.min(.9,s.phiS[e]))+s.alpha[e];return!(n>.5)||!(n>i)?Ti:Math.max(Ti,Math.min(1,(n-.5)/(n-i)))}across(t,e){const{pl:s,kind:n}=this.g,i=s[e]-s[t];return n[t]===U&&n[e]===st?i/this.theta(e,t):n[e]===U&&n[t]===st?i/this.theta(t,e):i}viscosity(t){const e=this.g;this.vsolver===null&&(this.vsolver=new yt(e.nx+1,e.ny+1));const s=Er*this.rhoRef*e.vCell*.25;this.last.viscIterations=Al(e,this.vsolver,this.etaU,this.etaV,this.mu,this.mv,this.knownU,this.knownV,this.rhoRef,s,t)}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===U}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:c}=this,{nx:l,ny:u}=s,f=1/t;for(let d=0;d<e.count;d+=1){const m=a[d];if(m===0)continue;const g=9*d,h=n[d],p=i[d];for(let v=0;v<9;v+=1){const b=h+v%3,y=p+(v/3|0);b<0||y<0||b>=l||y>=u||(c[b+y*l]+=r[g+v]*m*f)}}}extrapolate(){wl(this.g,this.knownU,this.knownV,this.markU,this.markV,this.tmpU,this.tmpV)}g2p(t,e){const{P:s,g:n,w:i,stranded:r}=this,{nx:a,ny:c,dx:l}=n,u=1/l,f=a+1,d=n.ul,m=n.vl,g=4/(l*l);let h=0;for(let p=0;p<s.count;p+=1){if(t>0&&r[p]!==0){s.vy[p]-=e*t,s.c00[p]=0,s.c01[p]=0,s.c10[p]=0,s.c11[p]=0;const O=s.vx[p]*s.vx[p]+s.vy[p]*s.vy[p];O>h&&(h=O);continue}const v=s.x[p],b=s.y[p],y=v*u,F=b*u;let w=ee(y,i,0),P=ee(F-.5,i,3),_=0,A=0,k=0;for(let O=0;O<3;O+=1){const D=P+O,B=(D+.5)*l-b;for(let q=0;q<3;q+=1){const R=w+q,E=i[q]*i[3+O];let z;R>=0&&R<=a&&D>=0&&D<c?z=d[R+D*f]:(this.mirrorU(R,D),z=this.ms*d[this.mf]),_+=E*z,A+=E*z*(R*l-v),k+=E*z*B}}w=ee(y-.5,i,0),P=ee(F,i,3);let M=0,S=0,T=0;for(let O=0;O<3;O+=1){const D=P+O,B=D*l-b;for(let q=0;q<3;q+=1){const R=w+q,E=i[q]*i[3+O];let z;R>=0&&R<a&&D>=0&&D<=c?z=m[R+D*a]:(this.mirrorV(R,D),z=this.ms*m[this.mf]),M+=E*z,S+=E*z*((R+.5)*l-v),T+=E*z*B}}s.vx[p]=_,s.vy[p]=M,s.c00[p]=g*A,s.c01[p]=g*k,s.c10[p]=g*S,s.c11[p]=g*T;const I=_*_+M*M;I>h&&(h=I)}return Math.sqrt(h)}markStranded(){return this.stranded.length<this.P.cap&&(this.stranded=new Uint8Array(this.P.cap)),Fl(this.P,this.g,this.stranded)}velocityAt(t,e,s){Or(this.g,t,e,s)}droplets(t,e,s){return this.drifts.compute(this.P,this.g,t,e,s)}advect(t,e){const s=this.P;let n=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(n=this.dropletDrift));const i=this.escaped;Pl(s,this.g,t,this.stranded,n,this.velocityAtFn,this.removeFn,this.bodyHit,this.vel,this.hit,i),this.escM=i.m,this.escO=i.o,this.escS=i.s,this.escE=i.e}}class jl{constructor(t){x(this,"cap");x(this,"count",0);x(this,"nextId",1);x(this,"x");x(this,"y");x(this,"vx");x(this,"vy");x(this,"c00");x(this,"c01");x(this,"c10");x(this,"c11");x(this,"mass");x(this,"h");x(this,"T");x(this,"rho");x(this,"spc");x(this,"smass");x(this,"mat");x(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i,r=0){if(this.count>=this.cap)return-1;const a=this.count;return this.count+=1,this.x[a]=t,this.y[a]=e,this.vx[a]=0,this.vy[a]=0,this.c00[a]=0,this.c01[a]=0,this.c10[a]=0,this.c11[a]=0,this.mass[a]=s,this.h[a]=n,this.mat[a]=i,this.spc[2*a]=r>0?No:0,this.spc[2*a+1]=0,this.smass[2*a]=r>0?r:0,this.smass[2*a+1]=0,this.T[a]=0,this.id[a]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(a),a}derive(t){const e=this.smass[2*t];if(e>0){const i=e/this.mass[t],r=nl(this.h[t],i,this.T[t]);this.T[t]=r,this.rho[t]=Xi(r,i);return}const s=this.mat[t],n=Nc(s,this.h[t]);this.T[t]=n,this.rho[t]=Xe(s,n)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==at)return!0;return!1}cp(t){const e=this.smass[2*t];return e>0?sl(this.T[t],e/this.mass[t]):Ki(this.mat[t],this.T[t])}hasSalt(){for(let t=0;t<this.count;t+=1)if(this.smass[2*t]>0)return!0;return!1}saltMass(){let t=0;for(let e=0;e<this.count;e+=1)t+=this.smass[2*e];return t}saltFraction(t){const e=this.smass[2*t];return e>0?e/this.mass[t]:0}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}function Bl(o,t,e){const{grid:s,particles:n,liquid:i,regions:r,gas:a,heat:c}=o,{nx:l,ny:u,n:f,kind:d}=s,{Tl:m}=t,g=t.rd;let h=!1;for(let y=0;y<f;y+=1){if(g[y]=0,d[y]===U&&t.Cl[y]>0){const k=t.boilingAt(y,r.pAt(y));m[y]>k&&(g[y]=k,h=!0);continue}if(d[y]!==st)continue;const F=y%l,w=(y-F)/l,P=w+1<u?y+l:-1;if(!(P>=0&&d[P]===U||F>0&&d[y-1]===U||F<l-1&&d[y+1]===U||w>0&&d[y-l]===U))continue;const A=t.boilingAt(y,r.pAt(y));m[y]>A&&(g[y]=A,h=!0)}if(!h)return;const p=t.mtot;p.fill(0);const v=t.Y0;v.fill(0);const b=i.rhoRef*s.vCell/4;for(let y=0;y<n.count;y+=1){if(n.mat[y]!==at)continue;const F=n.smass[2*y],w=F>0?F/n.mass[y]:0,P=9*y;let _=0,A=0,k=-1,M=0;for(let I=0;I<2;I+=1){for(let O=0;O<9;O+=1){const D=i.wt[P+O];if(D===0)continue;const B=i.bi[y]+O%3,q=i.bj[y]+(O/3|0);if(B<0||q<0||B>=l||q>=u)continue;const R=B+q*l,E=g[R];if(E===0)continue;const z=F>0?Jo(E,w):At(E);if(n.h[y]<=z)continue;const N=pt(E),L=D*n.mass[y]*(n.h[y]-z)/(N-(F>0?Fn(E,w):z));I===0?(_+=L,A+=L*N,D>M&&(M=D,k=R)):(p[R]+=L,v[R]+=L*N)}if(_===0)break;if(I===0&&n.mass[y]-F-_<Mi*b){const O=g[k],D=n.mass[y]-F,B=pt(O),q=F>0?F*Hn(O):0;p[k]+=D,v[k]+=D*B,F>0&&o.salt.deposit(n.x[y],n.y[y],F,q),c.src[k]-=(D*B+q-n.mass[y]*n.h[y])/e,_=-1;break}}if(_===0)continue;if(_<0){i.removeParticle(y),y-=1;continue}const S=n.mass[y]/n.rho[y],T=n.mass[y]-_;n.h[y]=(n.mass[y]*n.h[y]-A)/T,n.mass[y]=T,n.derive(y),i.dVp[y]+=T/n.rho[y]-S}for(let y=0;y<f;y+=1){if(p[y]===0)continue;const F=y%l,w=(y-F)/l;let P=0;const _=d[y]===U?y:w+1<u&&d[y+l]===U?y+l:-1;if(_>=0)s.mg[Q*f+_]+=p[y],s.Hg[_]+=v[y],a.deriveCell(_);else{const A=t.side;A[0]=F>0&&d[y-1]===U?y-1:-1,A[1]=F<l-1&&d[y+1]===U?y+1:-1,A[2]=w>0&&d[y-l]===U?y-l:-1,A[3]=-1;for(let k=0;k<3;k+=1)A[k]>=0&&(P+=1);for(let k=0;k<3;k+=1)A[k]<0||(s.mg[Q*f+A[k]]+=p[y]/P,s.Hg[A[k]]+=v[y]/P,a.deriveCell(A[k]))}t.produced+=p[y]}}function Il(o,t,e,s,n){const i=o.grid,r=i.n,a=i.mg[rt*r+t],c=i.mg[ot*r+t],l=i.Hg[t];if(s<=0)return _o(a,c,e,l);let u=n;for(let f=0;f<6;f+=1){const d=a*Jt(rt,u)+c*Jt(ot,u)+e*pt(u)+s*At(u),m=(l-d)/_i(a,c,e,s,u);if(u+=m,Math.abs(m)<1e-10)break}return u}function Is(o,t,e,s,n,i){const r=o.grid,a=r.n,c=r.mg[Q*a+t]-e,l=r.mfog[t]+e,u=Il(o,t,c,l,i),f=c/dt[Q];return(f+s>0?f/(f+s)*n:0)-zs(u)}function ni(o,t,e,s){const{grid:n,gas:i}=o,r=n.n;if(s===0||!Number.isFinite(s))return;const a=Math.max(-n.mfog[e],Math.min(n.mg[Q*r+e],s));n.mg[Q*r+e]-=a,n.mfog[e]+=a,n.mfog[e]<1e-30&&(n.mfog[e]=0),t.fogMade+=a,i.deriveCell(e)}function ql(o,t){const{grid:e,regions:s}=o,n=e.n;t.fogError=0,t.fogWrong=0;for(let i=0;i<n;i+=1){if(e.kind[i]!==U)continue;const r=e.mg[Q*n+i],a=e.mfog[i];if(r<=0&&a<=0)continue;const c=e.mg[rt*n+i]/dt[rt]+e.mg[ot*n+i]/dt[ot],l=s.pAt(i),u=e.T[i];if(a<=0){const b=r/dt[Q];if(b/(b+c)*l<.999*zs(u))continue}const f=Is(o,i,0,c,l,u);if(f<=0&&a<=0)continue;let d,m,g,h;if(f>0)d=0,g=f,m=r,h=Is(o,i,m,c,l,u);else if(m=0,h=f,d=-a,g=Is(o,i,d,c,l,u),g<=0){ni(o,t,i,d);continue}if(h>0){ni(o,t,i,m);continue}let p=d,v=0;for(let b=0;b<40;b+=1){p=(d*h-m*g)/(h-g),(!Number.isFinite(p)||p<=Math.min(d,m)||p>=Math.max(d,m))&&(p=.5*(d+m));const y=Is(o,i,p,c,l,u);if(Math.abs(y)<=1e-13*l)break;y>0?(d=p,g=y,v===1&&(h/=2),v=1):(m=p,h=y,v===-1&&(g/=2),v=-1)}if(ni(o,t,i,p),f<0&&p>0&&(t.fogWrong+=1),e.mfog[i]>0){const b=Is(o,i,0,c,l,e.T[i]);t.fogError=Math.max(t.fogError,Math.abs(b)/zs(e.T[i]))}}}const Mi=.001;class El{constructor(t){x(this,"e");x(this,"produced",0);x(this,"condensed",0);x(this,"dew",0);x(this,"fogMade",0);x(this,"producedMark",0);x(this,"fogError",0);x(this,"fogWrong",0);x(this,"mtot");x(this,"rd");x(this,"Y0");x(this,"Tl");x(this,"Cl");x(this,"acc");x(this,"accH");x(this,"accAll");x(this,"host");x(this,"mixed",!1);x(this,"salty",!1);x(this,"accS");x(this,"mol");x(this,"aw");x(this,"accMat");x(this,"Fm");x(this,"Fe");x(this,"dm");x(this,"side",new Int32Array(4));x(this,"bG");x(this,"bY");x(this,"edge");x(this,"hvC");x(this,"hnC");x(this,"hoC");x(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*te.length),this.accS=new Float64Array(e),this.mol=new Float64Array(e),this.aw=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s,n=1){const i=this.e.grid,r=i.n,a=Math.min(.999,n*zs(t)/e),c=i.mg[rt*r+s],l=i.mg[ot*r+s],u=c+l,f=u>0?u/(c/dt[rt]+l/dt[ot]):.02885;return a*dt[Q]/(a*dt[Q]+(1-a)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r}=t,{Tl:a,Cl:c,acc:l,accH:u,accAll:f,accS:d}=this;c.fill(0),a.fill(0),l.fill(0),u.fill(0);let m=!1,g=!1;for(let p=0;p<e.count;p+=1){const v=e.mass[p],b=e.mat[p],y=v*e.cp(p),F=e.smass[2*p],w=v-F,P=F>0?Fn(e.T[p],F/v):e.h[p];F>0&&!g&&(g=!0,d.fill(0)),b!==at&&!m&&(m=!0,f.fill(0),this.accMat.fill(0));const _=9*p;for(let A=0;A<9;A+=1){const k=s.wt[_+A];if(k===0)continue;const M=s.bi[p]+A%3,S=s.bj[p]+(A/3|0);if(M<0||S<0||M>=n||S>=i)continue;const T=M+S*n;c[T]+=k*y,a[T]+=k*y*e.T[p],b===at&&(l[T]+=k*w,u[T]+=k*w*P),g&&(d[T]+=k*F),m&&(this.accMat[b*r+T]+=k*v)}}for(let p=0;p<r;p+=1)a[p]=c[p]>0?a[p]/c[p]:t.T[p];if(this.mixed=m,this.salty=g,g)for(let p=0;p<r;p+=1){const v=d[p]>0&&l[p]>0?d[p]/(l[p]*Qs):0;this.mol[p]=v,this.aw[p]=v>0?Ko(a[p],v):1}if(!m){f.set(l),this.host.fill(at);return}const h=te.length;for(let p=0;p<r;p+=1){this.accMat[at*r+p]=g?l[p]+d[p]:l[p];let v=0,b=at,y=-1;for(let F=0;F<h;F+=1){const w=this.accMat[F*r+p];v+=w,w>y&&(y=w,b=F)}f[p]=v,this.host[p]=b}}waterShare(t){if(!this.mixed)return 1;const e=this.accAll[t];return e>0?(this.salty?this.acc[t]+this.accS[t]:this.acc[t])/e:1}boilingAt(t,e){return this.salty&&this.mol[t]>0?zo(e,this.mol[t]):_t(e)}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:At(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?at:this.host[s]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:c,dm:l}=this;l.fill(0,0,n.count);for(let f=0;f<n.count;f+=1){if(n.mat[f]!==at)continue;const d=9*f;let m=0;for(let g=0;g<9;g+=1){const h=i.wt[d+g];if(h===0)continue;const p=i.bi[f]+g%3,v=i.bj[f]+(g/3|0);if(p<0||v<0||p>=r||v>=a)continue;const b=p+v*r;t[b]!==0&&c[b]>0&&(m+=t[b]*h*(n.mass[f]-n.smass[2*f])/c[b])}l[f]=m}const u=i.rhoRef*s.vCell/4;for(let f=n.count-1;f>=0;f-=1){const d=l[f];if(d===0)continue;if(n.smass[2*f]>0){this.applySalty(f,d,u,e);continue}const m=n.mass[f]/n.rho[f],g=n.mass[f]+d;if(g<Mi*u){this.track(f,-n.mass[f]),this.vanish(f,Math.max(0,g),e);continue}this.track(f,d),n.mass[f]=g,i.dVp[f]+=g/n.rho[f]-m}for(let f=0;f<s.n;f+=1){if(t[f]<=0||c[f]>0)continue;const d=f%r,m=(f-d)/r,g=n.add((d+.5)*s.dx,(m+.5)*s.dx,t[f],this.waterH(f),at);g<0||(i.placeParticle(g),i.dVp[g]=t[f]/n.rho[g],this.track(g,t[f]))}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,c=9*t,l=Ki(n.mat[t],n.T[t]);for(let u=0;u<9;u+=1){const f=i.wt[c+u];if(f===0)continue;const d=i.bi[t]+u%3,m=i.bj[t]+(u/3|0);if(d<0||m<0||d>=r||m>=a)continue;const g=d+m*r;this.acc[g]+=f*e,this.accH[g]+=f*e*n.h[t],this.accAll[g]+=f*e,this.Cl[g]+=f*e*l}}applySalty(t,e,s,n){const{particles:i,liquid:r}=this.e,a=i.smass[2*t],c=i.mass[t],l=c-a,u=Fn(i.T[t],a/c),f=i.cp(t),d=c*i.h[t]+e*u,m=l+e;if(m<Mi*s){this.trackSalty(t,-l,-l*u,-c,-a,-c*f),this.dryUp(t,Math.max(0,m),d,n);return}const g=c/i.rho[t];i.mass[t]=c+e,i.h[t]=d/i.mass[t],i.derive(t),r.dVp[t]+=i.mass[t]/i.rho[t]-g;const h=Fn(i.T[t],a/i.mass[t]);this.trackSalty(t,e,m*h-l*u,e,0,i.mass[t]*i.cp(t)-c*f)}trackSalty(t,e,s,n,i,r){const{grid:a,liquid:c}=this.e,{nx:l,ny:u}=a,f=9*t;for(let d=0;d<9;d+=1){const m=c.wt[f+d];if(m===0)continue;const g=c.bi[t]+d%3,h=c.bj[t]+(d/3|0);if(g<0||h<0||g>=l||h>=u)continue;const p=g+h*l;this.acc[p]+=m*e,this.accH[p]+=m*s,this.accAll[p]+=m*n,this.accS[p]+=m*i,this.Cl[p]+=m*r}}dryUp(t,e,s,n){const{grid:i,particles:r,liquid:a,heat:c,gas:l}=this.e,u=r.T[t],f=r.smass[2*t],d=f*Hn(u);this.e.salt.deposit(r.x[t],r.y[t],f,d);const m=i.cellAt(r.x[t],r.y[t]);let g=m;for(;g>=0&&i.kind[g]!==U;)g=g+i.nx<i.n?g+i.nx:-1;if(m>=0&&g>=0)e>0&&(i.mg[Q*i.n+g]+=e,i.Hg[g]+=e*pt(u),this.produced+=e,l.deriveCell(g)),c.src[m]-=(e*pt(u)+d-s)/n;else if(m>=0){for(let h=0;h<r.count;h+=1)if(h!==t&&r.mat[h]===r.mat[t]&&i.cellAt(r.x[h],r.y[h])===m){const p=r.mass[h]*r.h[h]+(s-d);r.mass[h]+=e,r.h[h]=p/r.mass[h],r.derive(h);break}}a.removeParticle(t)}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:c}=this.e,l=n.cellAt(i.x[t],i.y[t]);let u=l;for(;u>=0&&n.kind[u]!==U;)u=u+n.nx<n.n?u+n.nx:-1;if(e>0&&u>=0&&l>=0){const f=i.T[t];n.mg[Q*n.n+u]+=e,n.Hg[u]+=e*pt(f),a.src[l]-=e*(pt(f)-i.h[t])/s,this.produced+=e,c.deriveCell(u)}else if(e>0&&l>=0){for(let f=0;f<i.count;f+=1)if(f!==t&&i.mat[f]===i.mat[t]&&n.cellAt(i.x[f],i.y[f])===l){const d=i.mass[f]*i.h[f]+e*i.h[t];i.mass[f]+=e,i.h[f]=d/i.mass[f],i.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),Bl(this.e,this,t),ql(this.e,this),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:c,ny:l,n:u,depth:f,kind:d}=s,{mtot:m,rd:g,Y0:h,Tl:p,Fm:v,Fe:b,edge:y,hvC:F,hnC:w,hoC:P}=this;let _=!1;for(let O=0;O<u;O+=1){if(d[O]!==U){m[O]=0;continue}const D=s.mg[O]+s.mg[u+O]+s.mg[Q*u+O];m[O]=D,h[O]=D>0?s.mg[Q*u+O]/D:0;const B=s.T[O];g[O]=n.rho[O]*Ec(B,i.pAt(O)),F[O]=pt(B),w[O]=Jt(rt,B),P[O]=Jt(ot,B),_=!0}if(!_)return;for(let O=0;O<l;O+=1)for(let D=0;D<c;D+=1){const B=D+O*c;y[B]=d[B]===U&&(D===0||O===0||D===c-1||O===l-1||d[B-1]!==U||d[B+1]!==U||d[B-c]!==U||d[B+c]!==U)?1:0}const A=a.begin(c,l),k=A.stride,M=e.ambientY[Q],{bG:S,bY:T}=this;for(let O=0;O<l;O+=1)for(let D=0;D<c;D+=1){const B=D+O*c;if(d[B]!==U||m[B]<=0)continue;const q=D+1+(O+1)*k;A.act[q]=1,A.x[q]=h[B],A.dH[q]=m[B]/t;let R=m[B]*h[B]/t;if(D+1<c&&d[B+1]===U&&m[B+1]>0&&(A.ax[q]=.5*(g[B]+g[B+1])*f),O+1<l&&d[B+c]===U&&m[B+c]>0&&(A.ay[q]=.5*(g[B]+g[B+c])*f),y[B]===0){A.b[q]=R;continue}let E=0;for(let z=0;z<4;z+=1){const N=this.boundary(B,D,O,z,M);S[4*B+z]=N,T[4*B+z]=this.yb,!(N<=0)&&(E+=N,R+=N*this.yb)}A.dDx[q]=E,A.b[q]=R}a.solve(1e-9,200,!1),v.fill(0),b.fill(0);const I=A.x;for(let O=0;O<l;O+=1)for(let D=0;D<c;D+=1){const B=D+O*c;if(d[B]!==U||m[B]<=0)continue;const q=D+1+(O+1)*k,R=I[q];if(D+1<c&&d[B+1]===U&&m[B+1]>0&&this.exchange(B,B+1,t*.5*(g[B]+g[B+1])*f*(R-I[q+1])),O+1<l&&d[B+c]===U&&m[B+c]>0&&this.exchange(B,B+c,t*.5*(g[B]+g[B+c])*f*(R-I[q+k])),y[B]!==0)for(let E=0;E<4;E+=1){const z=S[4*B+E];if(z<=0)continue;const N=t*z*(T[4*B+E]-R),V=(E===0?D===0:E===1?D===c-1:E===2?O===0:O===l-1)?-1:E===0?B-1:E===1?B+1:E===2?B-c:B+c;if(V<0)this.ambientExchange(B,N);else if(d[V]===st)if(N>0){const tt=p[V];s.mg[Q*u+B]+=N,s.Hg[B]+=N*pt(tt),v[V]-=N,b[V]-=N*pt(tt),this.produced+=N}else{const tt=Math.min(-N,s.mg[Q*u+B]);s.mg[Q*u+B]-=tt,s.Hg[B]-=tt*pt(s.T[B]),v[V]+=tt,b[V]+=tt*pt(s.T[B]),this.condensed+=tt}else if(d[V]===ht){const tt=s.T[V];if(N<0){const Y=Math.min(-N,s.mg[Q*u+B]);s.mg[Q*u+B]-=Y,s.Hg[B]-=Y*pt(s.T[B]),s.film[V]+=Y,s.Es[V]+=Y*At(tt),r.src[V]+=Y*(pt(s.T[B])-At(tt))/t,this.dew+=Y}else{const Y=Math.min(N,s.film[V]);s.film[V]-=Y,s.Es[V]-=Y*At(tt),s.mg[Q*u+B]+=Y,s.Hg[B]+=Y*pt(tt),r.src[V]-=Y*(pt(tt)-At(tt))/t,this.dew-=Y}}}}for(let O=0;O<u;O+=1)v[O]!==0&&(r.src[O]+=(b[O]-v[O]*this.waterH(O))/t);this.applyMass(v,t);for(let O=0;O<u;O+=1)d[O]===U&&m[O]>0&&n.deriveCell(O)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:c,depth:l,kind:u}=r,f=n===0?e===0:n===1?e===a-1:n===2?s===0:s===c-1,d=2*this.rd[t]*l;if(f)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,d):0;const m=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=m;const g=u[m],h=this.Y0[t],p=this.e.regions.pAt(t);if(g===st){const v=this.waterShare(m);return v<=0||!(this.acc[m]>0)?0:(this.yb=this.ysat(this.Tl[m],p,t,this.salty?this.aw[m]:1),d*(1-h)*v)}if(g===ht){const v=this.ysat(r.T[m],p,t);return h>v||r.film[m]>0&&h<v?(this.yb=v,d*(1-h)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let c=Math.abs(s);c=Math.min(c,n.mg[Q*i+r]);const l=n.mg[rt*i+a],u=n.mg[ot*i+a],f=l+u,d=Math.min(c,f);if(c<=0)return;const m=this.hvC[r];if(n.mg[Q*i+r]-=c,n.mg[Q*i+a]+=c,n.Hg[r]-=c*m,n.Hg[a]+=c*m,d>0){const g=d*l/f,h=d-g;n.mg[rt*i+a]-=g,n.mg[ot*i+a]-=h,n.mg[rt*i+r]+=g,n.mg[ot*i+r]+=h;const p=g*this.hnC[a]+h*this.hoC[a];n.Hg[a]-=p,n.Hg[r]+=p}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[rt*i+t]+n.mg[ot*i+t],c=Math.min(e,a);if(n.mg[Q*i+t]+=e,n.Hg[t]+=e*pt(r),c>0){const l=c*n.mg[rt*i+t]/a,u=c-l;n.mg[rt*i+t]-=l,n.mg[ot*i+t]-=u;const f=l*Jt(rt,n.T[t])+u*Jt(ot,n.T[t]);n.Hg[t]-=f,s.flows.escapedAir+=c,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*pt(r)}else if(e<0){const a=Math.min(-e,n.mg[Q*i+t]),c=s.ambientY[rt],l=s.ambientY[ot],u=c+l>0?c+l:1;n.mg[Q*i+t]-=a,n.Hg[t]-=a*pt(n.T[t]);const f=a*c/u,d=a-f;n.mg[rt*i+t]+=f,n.mg[ot*i+t]+=d;const m=f*Jt(rt,r)+d*Jt(ot,r);n.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*pt(n.T[t])-m}}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,c=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<c)continue;const u=l%n,f=(l-u)/n,m=[u>0?l-1:-1,u<n-1?l+1:-1,f+1<i?l+n:-1,f>0?l-n:-1].find(F=>F>=0&&a[F]===U);if(m===void 0)continue;const g=m%n,h=(m-g)/n,p=(g+.5+.25*Math.sign(u-g))*t.dx,v=(h+.5+.25*Math.sign(f-h))*t.dx,b=t.T[l],y=e.add(p,v,c,At(b),at);y<0||(t.film[l]-=c,t.Es[l]-=c*At(b),s.placeParticle(y),s.dVp[y]=c/e.rho[y])}}}function Zo(o,t){const{particles:e,liquid:s,grid:n}=o,i=new Float64Array(te.length);let r=0,a=0,c=0;for(let l=0;l<e.count;l+=1)for(let u=0;u<9;u+=1){const f=s.wt[9*l+u];if(f===0)continue;const d=s.bi[l]+u%3,m=s.bj[l]+(u/3|0);if(d<0||m<0||d>=n.nx||m>=n.ny||d+m*n.nx!==t)continue;i[e.mat[l]]+=f*e.mass[l],r+=f*e.mass[l];const g=e.smass[2*l];g>0?(a+=f*g,c+=f*(e.mass[l]-g)):e.mat[l]===0&&(c+=f*e.mass[l])}return{m:i,all:r,salt:a,water:c}}function Rl(o,t){const{m:e,all:s}=Zo(o,t);if(s<=0)return[];const n=[];for(let i=0;i<te.length;i+=1)e[i]>0&&n.push({id:te[i].id,share:e[i]/s});return n}function Dl(o,t,e){var M;const s=o.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ht?"solid":s.kind[n]===st?"liquid":"gas",a=o.pressureAt(n);let c=0;const l=[0,0,0];for(let S=0;S<xt;S+=1)l[S]=s.mg[S*i+n]/dt[S],c+=l[S];for(let S=0;S<xt;S+=1)l[S]=c>0?l[S]/c:0;const u=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],f=r==="gas"?l[Q]*a:0,d=Math.floor(t/s.dx),m=Math.floor(e/s.dx),g=r==="liquid"?.5*(s.ul[d+m*(s.nx+1)]+s.ul[d+1+m*(s.nx+1)]):.5*(s.ug[d+m*(s.nx+1)]+s.ug[d+1+m*(s.nx+1)]),h=r==="liquid"?.5*(s.vl[d+m*s.nx]+s.vl[d+(m+1)*s.nx]):.5*(s.vg[d+m*s.nx]+s.vg[d+(m+1)*s.nx]),p=o.particles;let v=-1,b=(1.5*s.dx)**2;for(let S=0;S<p.count;S+=1){const T=(p.x[S]-t)**2+(p.y[S]-e)**2;T<b&&(b=T,v=S)}const y=o.bubbles;let F=-1,w=1/0;for(let S=0;S<y.count;S+=1){const T=Math.hypot(y.x[S]-t,y.y[S]-e);T<=Math.max(y.r[S],3*s.dx)&&T<w&&(F=S,w=T)}const P=Zo(o,n),_=[];if(P.all>0)for(let S=0;S<te.length;S+=1)P.m[S]>0&&_.push({id:te[S].id,share:P.m[S]/P.all});let A=null;if(r==="liquid"&&P.salt>0&&P.water>0){const S=P.salt/(P.water*Qs);A={w:P.salt/(P.salt+P.water),molality:S,Tb:zo(a,S),Tf:Xa(S)}}const k=r==="gas"?o.gas.rho[n]:r==="liquid"?A!==null&&!o.phase.mixed?Xi(u,A.w):o.phase.mixed?Xe(o.phase.host[n],u):o.liquid.rhoRef:s.solid[n]!==0?vt[s.solid[n]-1].rho:0;return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?vt[s.solid[n]-1].id:null,T:u,p:a,Tsat:_t(a),x:l,rh:r==="gas"?f/Un(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,o.gas.vgas[n]):0,rho:k,phi:s.phi[n],u:g,v:h,heater:s.role[n]===1,film:s.film[n],crust:s.crust[n],liquids:_,salt:A},particle:v<0?null:{id:p.id[v],T:p.T[v],vx:p.vx[v],vy:p.vy[v],mass:p.mass[v],rho:p.rho[v],dist:Math.sqrt(b),liquid:((M=te[p.mat[v]])==null?void 0:M.id)??te[0].id,salt:p.saltFraction(v)},bubble:F<0?null:o.bubbleModel.describe(F),body:Vl(o,t,e)}}function Vl(o,t,e){const s=o.bodies.bodyAt(t,e);if(s===null)return null;const n=new Map;let i=0,r=0;for(let u=0;u<s.nv;u+=1){n.set(s.mat[u],(n.get(s.mat[u])??0)+1);const f=vt[s.mat[u]],d=f.rho*f.cp*o.grid.vCell;i+=d,r+=s.E[u]}let a=s.mat[0],c=-1;for(const[u,f]of n)f>c&&(c=f,a=u);let l=0;for(let u=0;u<s.nc;u+=1)o.grid.owner[s.cells[u]]===s.index+1&&(l+=o.grid.Es[s.cells[u]]-s.E0[u]);return{index:s.index,material:vt[a].id,mass:s.m,T:i>0?273.15+(r+l)/i:0,vx:s.vx,vy:s.vy,angle:s.a,w:s.w,state:s.pinned?"pinned":s.asleep?"asleep":"moving"}}class Nl{constructor(t){x(this,"g");x(this,"id");x(this,"count",0);x(this,"open",new Uint8Array(4));x(this,"vFluid",new Float64Array(4));x(this,"p0",new Float64Array(4));x(this,"rhoBar",new Float64Array(4));x(this,"vLiq",new Float64Array(4));x(this,"vBub",new Float64Array(4));x(this,"vGas",new Float64Array(4));x(this,"nSum",new Float64Array(4));x(this,"mSum",new Float64Array(4));x(this,"stack");x(this,"pAmb",101325);x(this,"rhoAmb",1.2);x(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n}=t;this.id.fill(-1);let i=0;for(let r=0;r<t.n;r+=1){if(n[r]!==0||this.id[r]!==-1)continue;this.grow(i);let a=0,c=0,l=0;for(this.stack[a++]=r,this.id[r]=i;a>0;){const u=this.stack[--a];l+=1;const f=u%e,d=(u-f)/e;(f===0&&t.openL||f===e-1&&t.openR||d===0&&t.openB||d===s-1&&t.openT)&&(c=1),f>0&&n[u-1]===0&&this.id[u-1]===-1&&(this.id[u-1]=i,this.stack[a++]=u-1),f<e-1&&n[u+1]===0&&this.id[u+1]===-1&&(this.id[u+1]=i,this.stack[a++]=u+1),d>0&&n[u-e]===0&&this.id[u-e]===-1&&(this.id[u-e]=i,this.stack[a++]=u-e),d<s-1&&n[u+e]===0&&this.id[u+e]===-1&&(this.id[u+e]=i,this.stack[a++]=u+e)}this.open[i]=c,this.vFluid[i]=l*t.vCell,i+=1}this.count=i}volumes(t,e){const s=this.g;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<xt;a+=1){const c=s.mg[a*n+i];this.mSum[r]+=c,this.nSum[r]+=c/dt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let c=0;c<s;c+=1){if(this.id[c]!==t||e.kind[c]===ht)continue;let l=0;for(let u=0;u<xt;u+=1)l+=e.mg[u*s+c]/dt[u];n+=l*Ot*e.T[c]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let c=0;c<2;c+=1){let l=-i,u=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===ht)continue;let d=0;for(let h=0;h<xt;h+=1)d+=e.mg[h*s+f]/dt[h];const m=r-a*(e.dx*((f-f%e.nx)/e.nx+.5)),g=d*Ot*e.T[f];l+=g/m,u-=g/(m*m)}r-=l/u}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===U)return s;return-1}}class Ul{constructor(t){x(this,"e");x(this,"floor");x(this,"floorH");x(this,"crystallized",0);this.e=t,this.floor=new Float64Array(t.grid.nx),this.floorH=new Float64Array(t.grid.nx)}floorTotals(){let t=0,e=0;for(let s=0;s<this.floor.length;s+=1)t+=this.floor[s],e+=this.floorH[s];return{mass:t,energy:e}}crustMass(){const t=this.e.grid;let e=0;for(let s=0;s<t.n;s+=1)e+=t.crust[s];return e}deposit(t,e,s,n){if(!(s>0))return;const i=this.e,r=i.grid,{nx:a,ny:c}=r,l=Math.min(a-1,Math.max(0,Math.floor(t/r.dx))),u=Math.min(c-1,Math.max(0,Math.floor(e/r.dx))),f=l+u*a;if(r.solid[f]!==0){this.toSolid(f,s,n);return}const d=[u>0?f-a:-1,l>0?f-1:-1,l<a-1?f+1:-1,u<c-1?f+a:-1];for(const m of d)if(m>=0&&r.solid[m]!==0){this.toSolid(m,s,n);return}for(let m=u-2;m>=0;m-=1){const g=l+m*a;if(r.solid[g]!==0){this.toSolid(g,s,n);return}}if(r.openB){i.flows.escapedSalt+=s,i.flows.escapedEnergy+=n;return}this.floor[l]+=s,this.floorH[l]+=n}toSolid(t,e,s){const n=this.e.grid;n.crust[t]+=e,n.Es[t]+=s,this.e.heat.deriveSolid(t)}step(){const{particles:t,liquid:e}=this.e;for(let s=0;s<t.count;s+=1){const n=t.smass[2*s];if(!(n>0))continue;const i=t.mass[s],r=t.T[s],a=Ja(r);if(n<=a*i*(1+1e-9))continue;const c=(n-a*i)/(1-a),l=c*Hn(r),u=i/t.rho[s],f=i*t.h[s]-l;t.mass[s]=i-c,t.smass[2*s]=n-c,t.h[s]=f/t.mass[s],t.derive(s),e.dVp[s]+=t.mass[s]/t.rho[s]-u,this.deposit(t.x[s],t.y[s],c,l),this.crystallized+=c}}}const Si="recreatio/lab2d",Gl={"very-high":.001,high:.002,medium:.003},Hl=o=>o==="very-high"||o==="high"||o==="medium",$l=16e4,gt=(o,t)=>typeof o=="number"&&Number.isFinite(o)?o:t,Ft=(o,t,e)=>Math.min(e,Math.max(t,o)),Ve=o=>o!==null&&typeof o=="object"&&!Array.isArray(o)?o:{},dn=(o,t)=>o==="wall"||o==="open"?o:t,Rr=.25*Nn,ii=2*Nn;function Dr(o){const t={};let e=0;for(const[s,n]of Object.entries(Ve(o)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Wl(o,t,e){const s=Ve(o),n=ct+gt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return qs(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Os(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",c=Dr(s.composition),l=d=>a==="gas"?d==="N2"||d==="O2"||d==="H2O":To(d)>=0||Go(d)>=0,u={};for(const[d,m]of Object.entries(c))l(d)?u[d]=m:t.push(`ops[${e}]: unknown ${a} "${d}" dropped`);const f=Object.keys(u).length>0?Dr(u):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:n,composition:f}}case"erase":{const r=Os(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Os(s.region);if(r===null)break;return{op:"move",region:r,dx:Ft(gt(s.dx,0),-1,1),dy:Ft(gt(s.dy,0),-1,1)}}case"solid":{const r=Os(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",x:gt(s.x,.1),y:gt(s.y,0),w:Ft(gt(s.w,.07),.01,1),h:Ft(gt(s.h,.09),.01,1),wall:Ft(gt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0,pinned:s.pinned!==!1,angle:Ft(gt(s.angle,0),-180,180)};case"hotplate":return{op:"hotplate",x:gt(s.x,.1),y:gt(s.y,0),w:Ft(gt(s.w,.12),.005,1),h:Ft(gt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:Ft(gt(s.power,40),0,2e3),target:ct+Ft(gt(s.target,150),0,600),on:s.on!==!1,pinned:s.pinned!==!1,angle:Ft(gt(s.angle,0),-180,180)};case"body":{const r=Os(s.region);if(r===null)break;return{op:"body",region:r,material:i("wood"),T:n,pinned:s.pinned===!0,angle:Ft(gt(s.angle,0),-180,180)}}case"pin":return{op:"pin",x:gt(s.x,0),y:gt(s.y,0),pinned:s.pinned!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function ri(o,t={}){const e=Ve(o),s=[];e.format!==void 0&&e.format!==Si&&s.push(`format "${String(e.format)}" is not ${Si}`);const n=Ve(e.box),i=Ve(e.ambient),r=Ve(i.air),a=Ve(e.sides),c=gt(i.g,Nn),l=t.harness===!0?Ft(c,0,ii):Ft(c,Rr,ii);l!==c&&s.push(`ambient.g ${c} m/s² is outside ${Rr.toFixed(2)}–${ii.toFixed(2)}, using ${l.toFixed(2)}`);const u=gt(r.N2,.7676),f=gt(r.O2,.2324),d=u+f>0?u+f:1,m=[];return Array.isArray(e.ops)&&e.ops.forEach((g,h)=>{const p=Wl(g,s,h);p!==null&&m.push(p)}),{scene:{seed:Math.floor(gt(e.seed,1))>>>0,box:{w:Ft(gt(n.w,.2),.02,.6),h:Ft(gt(n.h,.15),.02,.4),depth:Ft(gt(n.depth,.01),.002,.05)},ambient:{p:Ft(gt(i.p,Us/1e3),20,400)*1e3,T:ct+Ft(gt(i.T,20),-20,100),rh:Ft(gt(i.rh,.5),0,1),g:l,air:{N2:Math.max(0,u)/d,O2:Math.max(0,f)/d}},sides:{left:dn(a.left,"wall"),right:dn(a.right,"wall"),bottom:dn(a.bottom,"wall"),top:dn(a.top,"open")},quality:Hl(e.quality)?e.quality:"high",ops:m},warnings:s}}const Ut=(o,t=6)=>Number(o.toFixed(t));function Kl(o){switch(o.op){case"fill":return{op:"fill",region:js(o.region),composition:{...o.composition},phase:o.phase,T:Ut(o.T-ct,3)};case"erase":return{op:"erase",region:js(o.region)};case"move":return{op:"move",region:js(o.region),dx:Ut(o.dx),dy:Ut(o.dy)};case"solid":return{op:"solid",region:js(o.region),material:o.material,T:Ut(o.T-ct,3)};case"beaker":return{op:"beaker",x:o.x,y:o.y,w:o.w,h:o.h,wall:o.wall,material:o.material,T:Ut(o.T-ct,3),...o.lid?{lid:!0}:{},...Vr(o)};case"hotplate":return{op:"hotplate",x:o.x,y:o.y,w:o.w,h:o.h,material:o.material,mode:o.mode,power:o.power,target:Ut(o.target-ct,3),on:o.on,T:Ut(o.T-ct,3),...Vr(o)};case"body":return{op:"body",region:js(o.region),material:o.material,T:Ut(o.T-ct,3),...o.pinned?{pinned:!0}:{},...o.angle!==0?{angle:Ut(o.angle,4)}:{}};case"pin":return{op:"pin",x:Ut(o.x),y:Ut(o.y),pinned:o.pinned}}}const Vr=o=>({...o.pinned?{}:{pinned:!1},...o.angle!==0?{angle:Ut(o.angle,4)}:{}});function zl(o){return{format:Si,version:1,seed:o.seed,box:{...o.box},ambient:{p:Ut(o.ambient.p/1e3,4),T:Ut(o.ambient.T-ct,3),rh:o.ambient.rh,g:Ut(o.ambient.g,4),air:{...o.ambient.air}},sides:{...o.sides},quality:o.quality,ops:o.ops.map(Kl)}}const Ql=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics","bodies"],Ge=Ql.length,Nr=1/120;class Xl{constructor(t,e={}){x(this,"scene");x(this,"options");x(this,"warnings",[]);x(this,"grid");x(this,"particles");x(this,"bubbles");x(this,"liquid");x(this,"gas");x(this,"regions");x(this,"heat");x(this,"bubbleModel");x(this,"phase");x(this,"salt");x(this,"exchange");x(this,"bodies");x(this,"solver");x(this,"prevKind");x(this,"p0Start",new Float64Array(8));x(this,"rng");x(this,"time",0);x(this,"steps",0);x(this,"dt",Nr);x(this,"gy",9.81);x(this,"ambientY",new Float64Array(ut));x(this,"ambientT",293.15);x(this,"pRef",101325);x(this,"ledger",{water:0,air:0,energy:0,other:0,salt:0});x(this,"flows",_r());x(this,"snap",Ba());x(this,"energy0",0);x(this,"water0",0);x(this,"other0",0);x(this,"salt0",0);x(this,"cappedCount",0);x(this,"vapourRate",0);x(this,"vapourLast",0);x(this,"timings",new Float64Array(Ge));x(this,"stamp",new Float64Array(Ge+1));x(this,"stepMs",0);x(this,"quality","high");x(this,"heaterOps",new Map);x(this,"building",!1);this.options=e;const s=Ur(t)?t:ri(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Nr}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=Gl[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>$l;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new vl(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new jl(Math.max(4096,4*i.n+1024)),this.bubbles=new ga(4096),this.solver=new yt(s,n),this.regions=new Nl(i),this.liquid=new Ol(i,this.particles,this.solver),this.gas=new xl(i,this.regions,this.solver),this.heat=new bl(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new Ca(this),this.phase=new El(this),this.salt=new Ul(this),this.exchange=new ml(this),this.bodies=new ma(this),this.liquid.bodyHit=(r,a,c,l,u)=>this.bodies.hitPoint(r,a,c,l,u),this.liquid.afterSolve=(r,a,c,l)=>this.bodies.probe(r,a,c,l),this.prevKind=new Uint8Array(i.n),this.rng=new Do(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.flows=_r(),this.heaterOps.clear(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=U,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites(),this.building=!0;for(const r of t.ops)this.apply(r);this.building=!1,this.settle(),this.bodies.settleStart(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.ledger.salt=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total,this.salt0=this.snap.salt.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)t.solid[s]!==0&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,c=(i>0?i:Rc)/a,l=(r>0||i>0?r:Dc)/a,u=1/(c/dt[rt]+l/dt[ot]),f=Math.min(.99,s*Un(e)/t),d=f*dt[Q]/(f*dt[Q]+(1-f)*u);this.ambientY.fill(0),this.ambientY[rt]=(1-d)*c,this.ambientY[ot]=(1-d)*l,this.ambientY[Q]=d;let m=0;for(let g=0;g<xt;g+=1)m+=this.ambientY[g]/dt[g];this.regions.pAmb=t,this.regions.rhoAmb=t/(Ot*e*m),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,bodies:this.bodies,opIndex:this.scene.ops.length,solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0,this.bodies.changed()}apply(t){if(t.op==="fill"&&t.phase==="liquid"&&!this.surfaceAfterFill(t))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const e=this.regions.pvTerm(),s=cl(this.world(),t);return t.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,t]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-e,this.building||this.bodies.wakeFree(),s!==null&&this.warnings.push(s),s}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let c=0;c<n;c+=1)for(let l=0;l<s;l+=1){const u=l+c*s;e.solid[u]===0&&(e.kind[u]===st||Ae(t.region,(l+.5)*e.dx,(c+.5)*e.dx))&&(i[u]=1)}const r=new Uint8Array(e.n),a=[];for(let c=0;c<e.n;c+=1){if(i[c]===0||r[c]!==0)continue;let l=!1;for(a.push(c),r[c]=1;a.length>0;){const u=a.pop(),f=u%s,d=(u-f)/s,m=[f>0?u-1:-1,f<s-1?u+1:-1,d>0?u-s:-1,d<n-1?u+s:-1];(f===0&&e.openL||f===s-1&&e.openR||d===0&&e.openB||d===n-1&&e.openT)&&(l=!0);for(const g of m)if(!(g<0||e.solid[g]!==0)){if(i[g]===0){l=!0;continue}r[g]===0&&(r[g]=1,a.push(g))}}if(!l)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),c=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&c!==void 0&&c.op==="hotplate"){const l=[...this.scene.ops];l[a]={...c,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return zl({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=Ur(t)?t:ri(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setQuality(t){const e=ri(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,c=this.dt,l=this.stamp;l[0]=fe();const u=n.pvTerm();this.bodies.prepare()>0&&(n.update(r,a),this.flows.bodyWork+=n.pvTerm()-u),l[1]=fe(),e.splatVolumeChange(c),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let h=0;h<n.count;h+=1)this.p0Start[h]=n.p0[h];for(let h=0;h<t.n;h+=1)e.pGas[h]=t.kind[h]===U?n.pAt(h)-this.pRef:0;e.step(c,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedSalt+=e.last.escapedSalt,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=fe(),s.updateVolumes(),s.markFaces();const f=s.escaped[Q]+s.escaped[xt],d=s.escaped[rt]+s.escaped[ot],m=s.escaped[xt+1];s.transport(c),this.flows.escapedWater+=s.escaped[Q]+s.escaped[xt]-f,this.flows.escapedAir+=s.escaped[rt]+s.escaped[ot]-d,this.flows.escapedEnergy+=s.escaped[xt+1]-m,s.updateEos(),s.veosMid.set(s.veos),s.velocity(c,this.gy),s.sources(c),s.project(c,this.tol,this.maxIter),l[3]=fe(),this.bubbleModel.step(c),l[4]=fe(),this.phase.step(c),this.salt.step(),l[5]=fe(),i.step(c,1e-6,200),this.exchange.step(c),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,l[6]=fe(),l[7]=fe(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let h=0;h<t.n;h+=1)s.srcV[h]=t.kind[h]===U?s.veos[h]-s.veosMid[h]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.time+=c,this.steps+=1,l[8]=fe(),this.bodies.finish(c),this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax,this.bodies.dtLimit()),l[9]=fe();const g=this.steps<5?1:1/30;for(let h=0;h<Ge;h+=1)this.timings[h]+=g*(l[h+1]-l[h]-this.timings[h]);this.stepMs+=g*(l[Ge]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let c=0;c<e.count;c+=1)i.dp0[c]!==0&&(a=!0);if(a){for(let c=0;c<s.count;c+=1){const l=t.cellAt(s.x[c],s.y[c]),u=l<0?-1:e.id[l];if(u<0||i.dp0[u]===0)continue;const f=s.mass[c],d=f/s.rho[c];s.h[c]+=d*i.dp0[u]/f,s.derive(c),r.dVp[c]+=f/s.rho[c]-d}for(let c=0;c<n.count;c+=1){const l=t.cellAt(n.x[c],n.y[c]),u=l<0?-1:e.id[l];u>=0&&i.dp0[u]!==0&&(n.H[c]+=n.V[c]*i.dp0[u])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,t.editSalt=this.ledger.salt,ja(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap,this.salt.floorTotals())}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy+e.bodyWork)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}needsCpu(){return this.particles.hasOther()||this.particles.hasSalt()||this.salt.crustMass()>0||this.salt.floorTotals().mass>0||this.bodies.anyFree}saltError(){return this.measureBudget().salt.total-this.salt0-this.flows.editSalt}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)t.mat[i]===at&&(e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]));return{mean:e>0?s/e:0,max:n,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let n=0;n<t.count;n+=1)t.mat[n]!==at&&(e+=t.mass[n],s+=t.mass[n]*t.T[n]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===st?this.pRef+e.pl[t]:e.kind[t]===U?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){return Dl(this,t,e)}liquidsAt(t){return Rl(this,t)}stats(){const t=this.grid;let e=0,s=0;for(let h=0;h<t.n;h+=1)t.kind[h]===st?e+=1:t.kind[h]===U&&(s+=1);const n=this.waterTemperature(),i=this.otherTemperature(),r=this.measureBudget(),a=this.flows,c=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy+a.bodyWork),l=r.water.total-this.water0-a.editWater,u=r.other.total-this.other0-a.editOther,f=r.salt.total-this.salt0-a.editSalt,d=this.phase.produced+this.bubbleModel.burstVapour,m=this.time-this.vapourLast;m>.2&&(this.vapourRate=(d-this.phase.producedMark)/m,this.phase.producedMark=d,this.vapourLast=this.time);const g=[];for(let h=0;h<this.regions.count;h+=1)g.push({p0:this.regions.p0[h],sealed:this.regions.open[h]===0,vGas:this.regions.vGas[h]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,otherMass:i.mass,otherT:i.mean,saltMass:r.salt.liquid,saltSolid:r.salt.crust+r.salt.floor,bodies:{count:this.bodies.list.filter(h=>!h.gone).length,free:this.bodies.list.filter(h=>h.free).length,awake:this.bodies.list.filter(h=>h.awake).length},heaters:this.heat.heaters.filter(h=>h.cells>0).map(h=>({group:h.group,P:h.P,Tmean:h.Tmean,mode:h.mode,power:h.power,target:h.target,on:h.on})),regions:g,budget:{...r,water:{...r.water},other:{...r.other},salt:{...r.salt}},flows:{...a},energyError:c,waterError:l,otherError:u,saltError:f,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy}}}const fe=()=>typeof performance<"u"?performance.now():Date.now();function Ur(o){return o!==null&&typeof o=="object"&&"box"in o&&"ops"in o&&"quality"in o&&"sides"in o&&"ambient"in o&&typeof o.ambient.p=="number"&&o.ambient.p>1e3}class tc{constructor(t){x(this,"g");x(this,"last",null);x(this,"latent0",0);x(this,"stored0",0);x(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=_t(t.cpu.regions.pAmb),i=Sc(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},c=this.last;let l=0,u=0;if(c!==null&&a.t>c.t){const m=a.t-c.t,g=(a.heater-c.heater)/m,h=(a.solids-c.solids+a.SG-c.SG+a.lossS-c.lossS+a.LG-c.LG+a.sens-c.sens+a.bub-c.bub)/m;l=(a.vap-c.vap)/m,u=Math.max(0,(g-h)/i)}this.last=a;const f=this.vapour()*i,d=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=d),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:f-this.latent0,sensible:d-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:u}}}const ms={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},xs=16,K={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},He=96,Gr=16,Yl=57,Gt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},he=16,Jl={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Li=8,qt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},ae=8,Zl={TSUM:0,CELLS:1},Ci=2,tf={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},ec=16,et={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},oi=55,Re={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},ci=6,Oi={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},ai=13,xe={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},li=16,ef={KNOWN:0,MARK:1,MARK2:2,GAS:3},Hr=4,sf={F:0},fi=1,nf={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},ji=12,$t=(o,t)=>Object.entries(t).map(([e,s])=>`const ${o}${e}: u32 = ${s}u;`).join(`
`),rf=[$t("G_",ms),$t("C_",K),$t("R_",Gt),$t("RA_",Jl),$t("H_",qt),$t("HA_",Zl),$t("S_",tf),$t("F_",et),$t("U_",Re),$t("A_",Oi),$t("FF_",xe),$t("FU_",ef),$t("AF_",sf),$t("BA_",nf),`const RACC_STRIDE: u32 = ${Li}u;`,`const HEAT_STRIDE: u32 = ${ae}u;`,`const HACC_STRIDE: u32 = ${Ci}u;`,`const CGS_STRIDE: u32 = ${ec}u;`,`const BACC_STRIDE: u32 = ${ji}u;`].join(`
`);function it(o){if(!Number.isFinite(o))throw new Error(`not a finite constant: ${o}`);const t=Math.abs(o)>=1e-4&&Math.abs(o)<1e7?String(o):o.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Dt=o=>o.map(it).join(", "),St=kt.species[0],mn=kt.species[1],pn=kt.species[2],$e=St.liquid.cp.table,be=$e.map(o=>o[0]),Qe=$e.map(o=>o[1]),En=[Qe[0]*(be[0]-ct)];for(let o=1;o<$e.length;o+=1)En.push(En[o-1]+.5*(Qe[o]+Qe[o-1])*(be[o]-be[o-1]));const[of,cf,af]=St.vapour.cp.linear,Bi=ct+100,lf=(()=>{let o=0;for(;o<be.length-2&&Bi>=be[o+1];)o+=1;const t=Bi-be[o],e=(Qe[o+1]-Qe[o])/(be[o+1]-be[o]);return En[o]+Qe[o]*t+.5*e*t*t})(),ff=lf+St.saturation.hlv100.v,me=kt.solids,ui=4294967295,uf=`
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
}`,$r=44,hf=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,ns=26,df=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,is=29,mf=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,hi=8,pf=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,gf=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${it(ct)};
const R_GAS: f32 = ${it(Ot)};
const P_ATM: f32 = ${it(Us)};
const G0: f32 = ${it(Nn)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${it(mn.molarMass.v)};
const M_O2: f32 = ${it(pn.molarMass.v)};
const M_H2O: f32 = ${it(St.molarMass.v)};
const CP_N2: f32 = ${it(mn.gas.cp.v)};
const CP_O2: f32 = ${it(pn.gas.cp.v)};
const CPV0: f32 = ${it(of)};
const CPV1: f32 = ${it(cf)};
const CPV_T: f32 = ${it(af)};
const T100: f32 = ${it(Bi)};
const HV100: f32 = ${it(ff)};
const NCP: i32 = ${$e.length};
const CP_T = array<f32, ${$e.length}>(${Dt(be)});
const CP_V = array<f32, ${$e.length}>(${Dt(Qe)});
const CP_H = array<f32, ${$e.length}>(${Dt(En)});
const KELL = array<f32, 7>(${Dt(St.liquid.kell.c)});
const KL = array<f32, 3>(${Dt(St.liquid.k.poly)});
const VA: f32 = ${it(St.liquid.mu.vogel[0])};
const VB: f32 = ${it(St.liquid.mu.vogel[1])};
const VC: f32 = ${it(St.liquid.mu.vogel[2])};
const ST_B: f32 = ${it(St.surfaceTension.B)};
const ST_b: f32 = ${it(St.surfaceTension.b)};
const ST_MU: f32 = ${it(St.surfaceTension.mu)};
const T_CRIT: f32 = ${it(St.saturation.Tc.v)};
const RHO_CRIT: f32 = ${it(St.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Dt(St.saturation.if97.n)});
const RVC = array<f32, 6>(${Dt(St.saturation.vapourDensity.c)});
const KV: f32 = ${it(St.vapour.k.v)};
const MUV: f32 = ${it(St.vapour.mu.v)};
const KN = array<f32, 3>(${Dt(mn.gas.k.power)});
const KO = array<f32, 3>(${Dt(pn.gas.k.power)});
const MN = array<f32, 3>(${Dt(mn.gas.mu.sutherland)});
const MO = array<f32, 3>(${Dt(pn.gas.mu.sutherland)});
const DV0: f32 = ${it(kt.vapourInAir.D0.v)};
const DVT0: f32 = ${it(kt.vapourInAir.T0.v)};
const DVE: f32 = ${it(kt.vapourInAir.exponent.v)};
const NSOL: u32 = ${me.length}u;
const S_RHO = array<f32, ${me.length}>(${Dt(me.map(o=>o.rho.v))});
const S_CP = array<f32, ${me.length}>(${Dt(me.map(o=>o.cp.v))});
const S_K = array<f32, ${me.length}>(${Dt(me.map(o=>o.k.v))});
const S_THETA = array<f32, ${me.length}>(${Dt(me.map(o=>o.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${it(Ro)};
const REG_STRIDE: u32 = ${he}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${it(Po)};
`,xf=`
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
`,vf=`
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
`,nr=[uf,hf,df,mf,pf,gf,rf,xf,vf].join(`
`);class yf{constructor(t){x(this,"name");x(this,"binds");x(this,"wg");x(this,"source");x(this,"pipeline",null);x(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=wf(t.bind),this.source=_f(t,this.binds,this.wg)}}const bf={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function wf(o){return o.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":bf[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const Ff=`
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
`,Af=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function _f(o,t,e){const s=[nr,`const WG: u32 = ${e}u;`,Ff],n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of Af)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
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
`)}class ir{constructor(t){x(this,"device");x(this,"kernels",new Map);x(this,"timestamps");x(this,"bufs",[]);x(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new ir(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new yf(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=n.source.split(`
`);for(const u of a)e.push(`${s.name}:${u.lineNum}:${u.linePos} ${u.message}
    ${l[u.lineNum-1]??""}`);return}const c=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((l,u)=>l.mode==="t"?{binding:u,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:u,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:u,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:u,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});n.layout=c;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[c]}),compute:{module:i,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const Wr=64,Kr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ns=`
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
`,sc=`
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
`,Pf=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,kf=`
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
`,Tf=[{name:"bubNucleate",wg:Wr,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Ns}
${Kr} {
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
}`},{name:"bubAdvance",wg:Wr,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Ns}
${sc}
${Pf}
${kf}
${Kr} {
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
}`}],rs=64,Te="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Mf=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,Sf=[{name:"bubTarget",wg:rs,bind:"P:u cnt:a bubs:r btarget:w",code:`${Te} {
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
}`},{name:"bubMerge",wg:rs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Te} {
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
}`},{name:"bubMergeFinal",wg:rs,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ns}
${Te} {
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
}`},{name:"bubFinish",wg:rs,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Ns}
${sc}
${Mf}
${Te} {
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
${Te} {
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
}`},{name:"bubCopyBack",wg:rs,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Te} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:rs,bind:"P:u cnt:a bubs:r at:a",code:`${Ns}
${Te} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Te} {
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
}`}],ve=128,re="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Rn=`
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
`,zr=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,di=`
var<workgroup> rr: array<f32, ${16*ve}>;
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
`,Lf=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([o,t])=>({name:o,wg:ve,bind:"P:u cf:w cu:r at:w reg:r",code:`${Rn}
${re} {
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
}`})),{name:"transitions",wg:ve,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${re} {
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
}`},{name:"regCells",wg:ve,bind:"P:u cf:r cu:r racc:a",code:`${di}
${re} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${di}
${re} {
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
}`},{name:"regBubs",wg:ve,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${re} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${zr}
${re} {
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
}`})),{name:"compSums",wg:ve,bind:"P:u cf:r cu:r reg:r racc:a",code:`${di}
${re} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([o,t])=>({name:o,wg:64,bind:"P:u reg:w racc:a",code:`${zr}
${re} {
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
}`})),{name:"compApply",wg:ve,bind:"P:u cf:w cu:r reg:r",code:`${Rn}
${re} {
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
}`},{name:"gasVolumes",wg:ve,bind:"P:u cf:w cu:r reg:r",code:`${re} {
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
}`},{name:"markFaces",wg:ve,bind:"P:u cu:r ff:w fu:w",code:`${re} {
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
}`}],Qr=`const THETA_MIN: f32 = ${Ti.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,gn=128,qe=128,Kt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ne=`
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
`,Xr=`
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
`,Cf=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Yr=1,Of=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${Kt} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Yr}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${Kt} {
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
${Kt} {
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
    pargs[0] = max(1u, (total + ${gn-1}u) / ${gn}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${Kt} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:qe,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ne}
${Cf}
${Kt} {
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
}`},{name:"classify",wg:qe,bind:"P:u cf:r cu:w",code:`${Kt} {
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
}`},{name:"p2g",wg:qe,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Xr}
${Kt} {
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
}`},{name:"liqAssemble",wg:qe,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Qr}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${Kt} {
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
}`},{name:"liqPressure",wg:qe,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${Kt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:qe,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Qr}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${Kt} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([o,t,e,s,n,i])=>({name:o,wg:qe,bind:"P:u ff:w fu:w",code:`${Kt} {
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
}`})),{name:"g2p",wg:gn,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${Xr}
${ne}
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
${Kt} {
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
      q.flags = q.flags | ${Yr}u;
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
}`},{name:"heatWeights",wg:gn,bind:"P:u cnt:a cu:r parts:w",code:`${ne}
${Kt} {
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
}`}],pe=128,ge="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Jr=`
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
`,Zr=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,to=`
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
`,jf=[{name:"gasMaxOut",wg:pe,bind:"P:u cu:r ff:r cnt:a",code:`${ne}
${ge} {
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
}`},{name:"gasFlux",wg:pe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Jr}
${Zr}
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
${ge} {
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
}`},{name:"gasMove",wg:pe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Jr}
${Zr}
${ne}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${ge} {
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
}`},{name:"macFwd",wg:pe,bind:"P:u glob:r ff:w fu:r",code:`${to}
${ge} {
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
}`},{name:"macBack",wg:pe,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${to}
${ge} {
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
}`},{name:"viscosity",wg:pe,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${ge} {
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
}`},{name:"gasAssemble",wg:pe,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${ge} {
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
}`},{name:"gasPressure",wg:pe,bind:"P:u cf:w cu:r cgv:r",code:`${ge} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:pe,bind:"P:u glob:r cf:r ff:w fu:r",code:`${ge} {
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
}`}],zt=128,Qt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",We=`
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
`,Bf=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,If=[...[["gatherFull",!0],["gatherPlain",!1]].map(([o,t])=>({name:o,wg:zt,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${We}
${Qt} {
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
}`})),{name:"applyMass",wg:zt,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${We}
${ne}
${Qt} {
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
}`},{name:"diffPrep",wg:zt,bind:"P:u cf:w cu:w reg:r",code:`${Qt} {
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
}`},{name:"diffAssemble",wg:zt,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${Bf}
${Qt} {
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
}`},{name:"diffFaces",wg:zt,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Qt} {
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
}`},{name:"diffApply",wg:zt,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ne}
${Qt} {
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
}`},{name:"latentSrc",wg:zt,bind:"P:u glob:r cf:r at:a",code:`${Qt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:zt,bind:"P:u cf:w cu:r reg:r",code:`${Qt} {
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
}`},{name:"flashVap",wg:zt,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${We}
${Qt} {
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
}`},{name:"flashParts",wg:zt,bind:"P:u cnt:a cf:r parts:w",code:`${We}
${Qt} {
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
}`},{name:"flashDist",wg:zt,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ne}
${Qt} {
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
}`},{name:"fog",wg:zt,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Rn}
${ne}
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
${Qt} {
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
}`},{name:"films",wg:zt,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${Qt} {
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
}`}],hs=800,qf=24,eo=6,Bt=4,vs=16,Vt=256,so=`struct Levels { lv: array<Level, ${vs}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Zs=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,An=`${Zs}
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
`,ye=`
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
`,Ee=`
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
`,no=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,io=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,bt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Me=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,nc=6,os=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,mi=`
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
`,pi="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Ef=[{name:"cgPrep1",wg:Vt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Zs}
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
}`},{name:"cgPrep2",wg:Vt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${Me}
${An}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${nc}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:Vt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
}`},{name:"cclFinal",wg:Vt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${Me}
${mi}
${os}
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
}`},{name:"cclProject",wg:Vt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Me}
${pi}
${os}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Vt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${Me}
${Zs}
${Ee}
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
}`},{name:"cgFoldInitMG",wg:Vt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${Ee}
${io}
${bt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${Me}
${ye}
${Ee}
${no}
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
}`},{name:"cgB",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${Me}
${ye}
${Ee}
${no}
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
}`},{name:"cgFoldRR",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${ye}
${Ee}
${io}
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
}`},{name:"cgRZ",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${ye}
${Ee}
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
}`},{name:"cgZSum",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${ye}
${mi}
${os}
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
}`},{name:"cgZSub",wg:Vt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${ye}
${pi}
${os}
${Ee}
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
}`},{name:"cgEnd1",wg:Vt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${Me}
${mi}
${os}
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
}`},{name:"cgEnd2",wg:Vt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${Me}
${pi}
${os}
${bt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Rf=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Df(o,t){const e=[];let s=0,n=0,i=o,r=t,a=1,c=0;for(;;){const u=i+2,f=(i+2)*(r+2),d={};for(const h of Rf)d[h]=s,s+=f;const m=n;n+=f;let g=0;if(d.pW=0,e.length>0&&(d.pW=s,s+=4*c,g=n,n+=4*c),e.push({nx:i,ny:r,stride:u,size:f,h:a,f:d,act:m,pIdx:g}),i*r<=qf||i<=2&&r<=2||e.length>=vs)break;c=f,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let u=0;u<e.length;u+=1){let f=0;for(let d=u;d<e.length;d+=1)f+=e[d].size;if(f<=hs){l=u;break}}return{levels:e,fSize:s,uSize:n,lt:l}}function xn(o,t,e,s){if(o===null)return;const n=[o.nx,o.ny,o.stride,o.size,o.f.ax,o.f.ay,o.f.dH,o.f.dDx,o.f.dDy,o.f.diag,o.f.inv,o.f.x,o.f.b,o.h,o.f.gx,o.f.gy,o.f.gDx,o.f.gDy,o.f.eDx,o.f.eDy,o.f.area,o.f.ox,o.f.oy,o.act,o.pIdx,o.f.pW,t,o.f.xp,0,0,0,0];e.set(n,s)}const ic={tol:1e-5,it:K.IT_L,cap:K.CAP_L,res:K.RES_L},rc={tol:1e-5,it:K.IT_G,cap:K.CAP_G,res:K.RES_G},oc={tol:1e-5,it:K.IT_H,cap:K.CAP_H,res:K.RES_H},cc={tol:1e-5,it:K.IT_D,cap:K.CAP_D,res:K.RES_H},cs=200,oe=256;class Vf{constructor(t,e,s){x(this,"ctx");x(this,"plan");x(this,"b");x(this,"l0");x(this,"lp");x(this,"lv");x(this,"it");x(this,"cfg");x(this,"kinds",[]);x(this,"groups",new Map);x(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);xn(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(oe/4*n.length);for(let l=0;l<n.length;l+=1)xn(l>0?n[l-1]:null,l-1,r,oe/4*l),xn(n[l],l,r,oe/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*vs+4);for(let l=0;l<n.length;l+=1)xn(n[l],l,a,32*l);a[32*vs]=e.lt,a[32*vs+1]=n.length,this.lv=t.uniform("lv",a.buffer);const c=new Uint32Array(oe/4*(cs+1));for(let l=0;l<cs;l+=1)c[oe/4*l]=l;c[oe/4*cs]=4294967295,this.it=t.uniform("iter",c.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(oe*4));for(const l of[ic,rc,oc,cc])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,oe*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,oe*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:oe*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,oe)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(l,u)=>{const f={IT:this.itRes(l)};i?(this.run(t,"cgZSum",r,u,f),this.run(t,"cgZSub",r,u,f)):this.run(t,"cgRZ",r,u,f)};this.vcycle(t),a(cs,`k${cs}`);const c=Math.min(cs,Math.max(1,s));for(let l=0;l<c;l+=1){const u={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,u),this.run(t,"cgB",r,`k${l}`,u),this.one(t,"cgFoldRR",`k${l}`,u),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const ys=16,ro=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class Nf{constructor(t,e){x(this,"ctx");x(this,"d");x(this,"plan");x(this,"params");x(this,"glob");x(this,"cnt");x(this,"cf");x(this,"cu");x(this,"at");x(this,"ff");x(this,"fu");x(this,"af");x(this,"partsA");x(this,"partsB");x(this,"ccountA");x(this,"ccountB");x(this,"cstart");x(this,"bsum");x(this,"pkey");x(this,"pslot");x(this,"pargs");x(this,"bubs");x(this,"bubs2");x(this,"bacc");x(this,"btarget");x(this,"sites");x(this,"sbub");x(this,"reg");x(this,"racc");x(this,"heat");x(this,"hacc");x(this,"mgF");x(this,"mgU");x(this,"cgv");x(this,"cgs");x(this,"lab");x(this,"cfl");x(this,"csum");x(this,"cgp");x(this,"meas");x(this,"probe");x(this,"regionMap",new Int32Array(0));x(this,"regionInv",new Int32Array(0));x(this,"measGroups");x(this,"nsites",0);x(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=Df(s.nx,s.ny);const r=(c,l,u=ro)=>{const f=t.buffer(c,4*Math.max(4,l),u);return this.own.push(f),f};this.params=r("params",$r,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",xs),this.cnt=r("cnt",He),this.cf=r("cf",oi*i.n),this.cu=r("cu",ci*i.n),this.at=r("at",ai*i.n),this.ff=r("ff",li*i.nf),this.fu=r("fu",Hr*i.nf),this.af=r("af",fi*i.nf),this.partsA=r("partsA",ns*i.pcap),this.partsB=r("partsB",ns*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,ro|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",is*i.bcap),this.bubs2=r("bubs2",is*i.bcap),this.bacc=r("bacc",ji*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",hi*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",he*i.nreg),this.racc=r("racc",Li*i.nreg),this.heat=r("heat",ae*i.nheat),this.hacc=r("hacc",Ci*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",ec),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",nc*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",ys*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*$r),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[rt],t.ambientY[ot],t.ambientY[Q],_t(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let c=0;for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]===0&&(c=1);i[40]=c,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t){const e=t.heat.heaters,s=new Float32Array(ae*this.d.nheat);e.forEach((n,i)=>{const r=ae*i;s[r+qt.MODE]=n.mode==="thermostat"?1:0,s[r+qt.POWER]=n.power,s[r+qt.TARGET]=n.target,s[r+qt.ON]=n.on?1:0,s[r+qt.P]=n.P,s[r+qt.TMEAN]=n.Tmean,s[r+qt.INTEGRAL]=n.integral,s[r+qt.CELLS]=n.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,s)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*ae*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n;this.writeParams(t),this.writeHeaters(t);const r=t.regions,a=Array.from({length:r.count},(L,V)=>V).sort((L,V)=>r.vFluid[V]-r.vFluid[L]);this.regionMap=new Int32Array(Math.max(1,r.count)),this.regionInv=new Int32Array(Math.max(1,r.count)),a.forEach((L,V)=>{this.regionMap[L]=V,this.regionInv[V]=L});const c=new Float32Array(he*s.nreg);for(let L=0;L<r.count;L+=1){const V=he*this.regionMap[L];c[V+Gt.OPEN]=r.open[L],c[V+Gt.VFLUID]=r.vFluid[L],c[V+Gt.P0]=r.p0[L],c[V+Gt.RHOBAR]=r.rhoBar[L],c[V+Gt.VLIQ]=r.vLiq[L],c[V+Gt.VBUB]=r.vBub[L],c[V+Gt.VGAS]=r.vGas[L],c[V+Gt.P0START]=r.p0[L]}e.writeBuffer(this.reg,0,c);const l=new Uint32Array(ci*i);for(let L=0;L<i;L+=1){l[Re.KIND*i+L]=n.kind[L],l[Re.KPREV*i+L]=n.kind[L],l[Re.SOLID*i+L]=n.solid[L],l[Re.HGRP*i+L]=n.role[L]===1&&n.heater[L]>=0?n.heater[L]+1:0;const V=r.id[L];l[Re.RID*i+L]=V<0?ui:this.regionMap[V]}e.writeBuffer(this.cu,0,l);const u=new Float32Array(oi*i),f=(L,V,tt=0)=>{for(let Y=0;Y<i;Y+=1)u[L*i+Y]=V[tt+Y]};f(et.PHI,n.phi),f(et.ALPHA,n.alpha),f(et.ALPHAOLD,n.alpha),f(et.PL,n.pl),f(et.PG,n.pg),f(et.MN,n.mg,rt*i),f(et.MO,n.mg,ot*i),f(et.MV,n.mg,Q*i),f(et.MF,n.mfog),f(et.HG,n.Hg),f(et.ES,n.Es),f(et.FILM,n.film),f(et.T,n.T),f(et.TL,n.Tl),f(et.CL,n.Cl);const d=t.gas;f(et.VGAS,d.vgas),f(et.RHO,d.rho),f(et.NMOL,d.nmol),f(et.CAP,d.cap),f(et.MU,d.mu),f(et.VEOS,d.veos),f(et.SRCV,d.srcV),f(et.VEOSMID,d.veosMid),f(et.PHIS,n.phiS),f(et.SDF,n.sdf),f(et.PTL,n.T),e.writeBuffer(this.cf,0,u);const m=new Float32Array(ai*i);for(let L=0;L<i;L+=1)m[Oi.VOLSRC*i+L]=t.liquid.volSrc[L];e.writeBuffer(this.at,0,m);const g=s.nf,h=new Float32Array(li*g);for(let L=0;L<s.nu;L+=1)h[xe.UL*g+L]=n.ul[L],h[xe.UG*g+L]=n.ug[L];for(let L=0;L<s.nv;L+=1)h[xe.UL*g+s.nu+L]=n.vl[L],h[xe.UG*g+s.nu+L]=n.vg[L];e.writeBuffer(this.ff,0,h),e.writeBuffer(this.fu,0,new Uint32Array(Hr*g));const p=new Float32Array(fi*g);for(let L=0;L<s.nu;L+=1)p[L]=t.liquid.fU[L];for(let L=0;L<s.nv;L+=1)p[s.nu+L]=t.liquid.fV[L];e.writeBuffer(this.af,0,p);const v=t.particles,b=t.liquid,y=new ArrayBuffer(4*ns*Math.max(1,v.count)),F=new Float32Array(y),w=new Uint32Array(y),P=new Int32Array(y);for(let L=0;L<v.count;L+=1){const V=ns*L;F.set([v.x[L],v.y[L],v.vx[L],v.vy[L],v.c00[L],v.c01[L],v.c10[L],v.c11[L],v.mass[L],v.h[L],v.T[L],v.rho[L],b.dVp[L]],V),w[V+13]=0,w[V+14]=v.id[L],P[V+15]=b.bi[L],P[V+16]=b.bj[L];for(let tt=0;tt<9;tt+=1)F[V+17+tt]=b.wt[9*L+tt]}v.count>0&&e.writeBuffer(this.partsA,0,y);const _=t.bubbles,A=t.bubbleModel.motionState,k=new ArrayBuffer(4*is*Math.max(1,_.count)),M=new Float32Array(k),S=new Uint32Array(k),T=new Int32Array(k);for(let L=0;L<_.count;L+=1){const V=is*L,tt=L*ut;M.set([_.x[L],_.y[L],_.z[L],_.vx[L],_.vy[L],_.m[tt+rt],_.m[tt+ot],_.m[tt+Q],_.H[L],_.age[L]],V),T[V+10]=_.site[L],M.set([_.r[L],_.V[L],_.pb[L],_.pv[L],_.Tb[L],_.dmdt[L],A.ux0[L],A.uy0[L]],V+11),S[V+19]=_.id[L],S[V+20]=1;for(let Y=0;Y<Zt;Y+=1)M[V+21+Y]=_.force[L*Zt+Y]}_.count>0&&e.writeBuffer(this.bubs,0,k);const I=t.bubbleModel.cavities;this.nsites=I.count;const O=new ArrayBuffer(4*hi*s.nsites),D=new Uint32Array(O),B=new Float32Array(O);for(let L=0;L<I.count;L+=1){const V=hi*L;D.set([I.cell[L],I.fluid[L],I.dir[L],0],V),B.set([I.r[L],I.s[L],I.z[L],0],V+4)}e.writeBuffer(this.sites,0,O);const q=new Uint32Array(s.nsites);for(let L=0;L<I.count;L+=1)q[L]=I.bubble[L];e.writeBuffer(this.sbub,0,q);const R=new Float32Array(xs);R[ms.DT]=t.dt,R[ms.TIME]=t.time,R[ms.RHOREF]=b.rhoRef,e.writeBuffer(this.glob,0,R);const E=new Uint32Array(He),z=new Float32Array(E.buffer);E[K.PCOUNT]=v.count,E[K.PSORT]=v.count,E[K.BCOUNT]=_.count,E[K.NEXTID_B]=Math.max(1,_.nextFree),E[K.NEXTID_P]=Math.max(1,v.nextFree);const N=t.bubbleModel;E[K.WATCH]=N.watch>=0?N.watch:ui,E[K.WATCH_FATE]=N.watchFate,N.firstSuperheat!==null&&(z[K.FIRST_SH]=N.firstSuperheat+1e3,E[K.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,E),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(ji*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Li*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Ci*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(u=>Math.ceil(u.size/4)*4),n=s.reduce((u,f)=>u+f,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((u,f)=>{s[f]>0&&r.copyBufferToBuffer(u.buf,u.offset,i,a,s[f]),a+=s[f]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const c=i.getMappedRange().slice(0);i.unmap(),i.destroy();const l=[];a=0;for(const u of s)l.push(c.slice(a,a+u)),a+=u;return l}async download(t){const e=this.d,s=e.n,[n,i,r,a,c,l,u,f,d,m]=await this.read([{buf:this.cnt,offset:0,size:4*He},{buf:this.glob,offset:0,size:4*xs},{buf:this.cf,offset:0,size:4*oi*s},{buf:this.cu,offset:0,size:4*ci*s},{buf:this.at,offset:0,size:4*ai*s},{buf:this.ff,offset:0,size:4*li*e.nf},{buf:this.af,offset:0,size:4*fi*e.nf},{buf:this.heat,offset:0,size:4*ae*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*he*e.nreg}]),g=new Uint32Array(n),h=Math.min(e.pcap,g[K.PCOUNT]),p=Math.min(e.bcap,g[K.BCOUNT]),[v,b]=await this.read([{buf:this.partsA,offset:0,size:4*ns*Math.max(1,h)},{buf:this.bubs,offset:0,size:4*is*Math.max(1,p)}]),y=t.grid,F=new Float32Array(r),w=(j,G,W=0)=>{for(let J=0;J<s;J+=1)G[W+J]=F[j*s+J]};w(et.PHI,y.phi),w(et.ALPHA,y.alpha),w(et.PL,y.pl),w(et.PG,y.pg),w(et.MN,y.mg,rt*s),w(et.MO,y.mg,ot*s),w(et.MV,y.mg,Q*s),w(et.MF,y.mfog),w(et.HG,y.Hg),w(et.ES,y.Es),w(et.FILM,y.film),w(et.T,y.T),w(et.TL,y.Tl),w(et.CL,y.Cl);const P=t.gas;w(et.VGAS,P.vgas),w(et.RHO,P.rho),w(et.NMOL,P.nmol),w(et.CAP,P.cap),w(et.MU,P.mu),w(et.VEOS,P.veos),w(et.SRCV,P.srcV),w(et.VEOSMID,P.veosMid);const _=new Uint32Array(a);for(let j=0;j<s;j+=1)y.kind[j]=_[Re.KIND*s+j];const A=new Float32Array(c);for(let j=0;j<s;j+=1)t.liquid.volSrc[j]=A[Oi.VOLSRC*s+j];const k=new Float32Array(l),M=new Float32Array(u),S=e.nf;for(let j=0;j<e.nu;j+=1)y.ul[j]=k[xe.UL*S+j],y.ug[j]=k[xe.UG*S+j],t.liquid.fU[j]=M[j];for(let j=0;j<e.nv;j+=1)y.vl[j]=k[xe.UL*S+e.nu+j],y.vg[j]=k[xe.UG*S+e.nu+j],t.liquid.fV[j]=M[e.nu+j];const T=t.particles,I=t.liquid,O=new Float32Array(v),D=new Uint32Array(v),B=new Int32Array(v);let q=0,R=0;for(let j=0;j<h;j+=1){const G=ns*j;if(D[G+13]&1||!(O[G+8]>0))continue;const W=q;q+=1,T.x[W]=O[G],T.y[W]=O[G+1],T.vx[W]=O[G+2],T.vy[W]=O[G+3],T.c00[W]=O[G+4],T.c01[W]=O[G+5],T.c10[W]=O[G+6],T.c11[W]=O[G+7],T.mass[W]=O[G+8],T.h[W]=O[G+9],T.spc[2*W]=0,T.spc[2*W+1]=0,T.smass[2*W]=0,T.smass[2*W+1]=0,T.mat[W]=0,T.id[W]=D[G+14],T.id[W]>R&&(R=T.id[W]),I.dVp[W]=O[G+12],I.bi[W]=B[G+15],I.bj[W]=B[G+16];for(let J=0;J<9;J+=1)I.wt[9*W+J]=O[G+17+J];T.derive(W)}T.count=q,T.reserveIds(Math.max(g[K.NEXTID_P],R+1)),I.weightsDirty=!0;const E=t.bubbles,z=t.bubbleModel.motionState,N=new Float32Array(b),L=new Uint32Array(b),V=new Int32Array(b);E.count=0;let tt=0;for(let j=0;j<p;j+=1){const G=is*j;if(L[G+20]===0)continue;const W=E.count;E.count+=1;const J=W*ut;E.x[W]=N[G],E.y[W]=N[G+1],E.z[W]=N[G+2],E.vx[W]=N[G+3],E.vy[W]=N[G+4];for(let ft=0;ft<ut;ft+=1)E.m[J+ft]=0;E.m[J+rt]=N[G+5],E.m[J+ot]=N[G+6],E.m[J+Q]=N[G+7],E.H[W]=N[G+8],E.age[W]=N[G+9],E.site[W]=V[G+10],E.r[W]=N[G+11],E.V[W]=N[G+12],E.pb[W]=N[G+13],E.pv[W]=N[G+14],E.Tb[W]=N[G+15],E.dmdt[W]=N[G+16],z.ux0[W]=N[G+17],z.uy0[W]=N[G+18],E.id[W]=L[G+19],E.id[W]>tt&&(tt=E.id[W]);for(let ft=0;ft<Zt;ft+=1)E.force[W*Zt+ft]=N[G+21+ft]}E.reserveIds(Math.max(g[K.NEXTID_B],tt+1));const Y=t.bubbleModel.cavities,X=new Uint32Array(d);for(let j=0;j<Y.count;j+=1)Y.bubble[j]=X[j];const C=new Float32Array(m);for(let j=0;j<t.regions.count;j+=1){const G=he*this.regionMap[j];t.regions.p0[j]=C[G+Gt.P0],t.regions.rhoBar[j]=C[G+Gt.RHOBAR]}const $=new Float32Array(f);t.heat.heaters.forEach((j,G)=>{const W=ae*G;j.P=$[W+qt.P],j.Tmean=$[W+qt.TMEAN],j.integral=$[W+qt.INTEGRAL]});const H=new Float32Array(i);t.dt=H[ms.DT];const nt=t.bubbleModel;nt.watch=g[K.WATCH]===ui?-1:g[K.WATCH]}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const Se=128,Nt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Uf=5,oo=30,co=`
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
`,Gf=[{name:"heaterSums",wg:Se,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Nt} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Nt} {
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
        let kp = power / ${Uf}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${oo}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${oo}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:Se,bind:"P:u cnt:a parts:r",code:`${ne}
${Nt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:Se,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${We}
${ne}
${Nt} {
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
}`},{name:"heatAssemble",wg:Se,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${co}
${Nt} {
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
}`},{name:"heatFlux",wg:Se,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${co}
${Rn}
${ne}
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
${Nt} {
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
}`},{name:"heatParts",wg:Se,bind:"P:u cnt:a cf:r parts:w",code:`${We}
${Nt} {
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
}`},{name:"heatShare",wg:Se,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${We}
${Nt} {
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
}`},{name:"pwParts",wg:Se,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Nt} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Nt} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Nt} {
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
${Nt} {
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
  if (lid < 8u) { meas[wid3.x * ${ys}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${4*256}>;
${Nt} {
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
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${ys}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Nt} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${ys}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Nt} {
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
}`}],as=256,Hf=[...[1,2,3].map(o=>({name:`mgC${o}`,wg:as,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${An}
${bt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${o===1?"coarsen1(LP.F, C, t);":o===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:as,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${An}
${bt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:as,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${so}
${An}
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
}`},{name:"mgPost",wg:as,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Zs}
${ye}
const TILE: u32 = 16u;
const HALO: u32 = ${Bt}u;
const TS: u32 = ${16+2*Bt}u;
var<workgroup> sx: array<f32, ${(16+2*Bt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Bt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Bt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Bt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Bt)**2}>;
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
  for (var k = 0u; k < ${Bt}u; k++) {
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
}`},{name:"mgPreR",wg:as,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Zs}
${ye}
const TILE: u32 = 12u;
const HALO: u32 = ${Bt+2}u;
const TS: u32 = ${12+2*(Bt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Bt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Bt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Bt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Bt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Bt+2))**2}>;
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
  for (var k = 0u; k < ${Bt}u; k++) {
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
}`},{name:"mgTail",wg:as,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${so}
${ye}
var<workgroup> tx: array<f32, ${hs}>;
var<workgroup> tb: array<f32, ${hs}>;
var<workgroup> tax: array<f32, ${hs}>;
var<workgroup> tay: array<f32, ${hs}>;
var<workgroup> tinv: array<f32, ${hs}>;
var<workgroup> toff: array<u32, ${vs}>;
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
  for (var k = 0u; k < ${eo}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${eo}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],vn=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function rr(o){const t=/^#?([0-9a-f]{6})$/i.exec(o.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const le=[0,120],ls=128,fs="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",$f=.006,Wf={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,salt:0,phase:6},Kf=4*1e3*15e-7/(3*2*.07),or=`
const VIR = array<vec3<f32>, ${vn.length}>(${vn.map(o=>`vec3<f32>(${it(o[0]/255)}, ${it(o[1]/255)}, ${it(o[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${it(vn.length-1)};
  let i = min(u32(floor(x)), ${vn.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,gi="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",zf=[{name:"rScale",wg:ls,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${gi}
var<workgroup> m4: array<vec4<f32>, WG>;
${fs} {
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
}`},{name:"rCells",wg:ls,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${gi}
${or}
const SOLID_RGB = array<vec3<f32>, ${vt.length}>(${vt.map(o=>{const t=rr(o.color);return`vec3<f32>(${it(t[0]/255)}, ${it(t[1]/255)}, ${it(t[2]/255)})`}).join(", ")});
${fs} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${it(le[0])};
  let tspan = ${it(le[1]-le[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${vt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${it(Kf)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:ls,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${fs} {
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
}`},{name:"rLiqBlurX",wg:ls,bind:"P:u lq:r lq2:w",code:`${fs} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:ls,bind:"P:u lq2:r liquid:t",code:`${fs} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${it(le[0])}) / ${it(le[1]-le[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:ls,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${gi}
${fs} {
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
}`}],an=`
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
`,xi=`${an}
${or}
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
`,Qf=`${an}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Xf=`${an}
${(nr.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
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
`,Yf=`${an}
${or}
${(nr.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
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
  o.t = clamp((parts[p].T - ${it(273.15+le[0])}) / ${it(le[1]-le[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Jf=`${an}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,ao=48,vi=256,Zf=12;class t0{constructor(t,e){x(this,"gpu");x(this,"device");x(this,"context");x(this,"format");x(this,"rp");x(this,"ro");x(this,"sampLin");x(this,"sampNear");x(this,"pipes",{});x(this,"layouts",{});x(this,"size","");x(this,"cellsTex");x(this,"fieldTex");x(this,"liquidTex");x(this,"lq");x(this,"lq2");x(this,"arrows");x(this,"nArrows",0);x(this,"groups",new Map);x(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});x(this,"water",[.24,.56,.85]);x(this,"waterInk",[1,1,1]);x(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",vi*Zf,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(m,g,h,p,v=[])=>{const b=t.createShaderModule({code:m}),F=(await b.getCompilationInfo()).messages.filter(w=>w.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(w=>`${w.lineNum}:${w.linePos} ${w.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[h]}),vertex:{module:b,entryPoint:"vs",buffers:v},fragment:{module:b,entryPoint:g,targets:[{format:this.format,blend:e}]},primitive:{topology:p}})},[r,a,c,l,u,f,d]=await Promise.all([i(xi,"fsCells",this.layouts.quad,"triangle-strip"),i(xi,"fsField",this.layouts.quad,"triangle-strip"),i(xi,"fsLiquid",this.layouts.quad,"triangle-strip"),i(Qf,"fs",this.layouts.rect,"triangle-strip"),i(Xf,"fs",this.layouts.store,"triangle-strip"),i(Yf,"fs",this.layouts.store,"triangle-strip"),i(Jf,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:c,rect:l,disc:u,point:f,line:d}}ensure(){var u,f,d,m,g,h;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(p,v)=>s.createTexture({size:[p,v],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(u=this.cellsTex)==null||u.destroy(),(f=this.fieldTex)==null||f.destroy(),(d=this.liquidTex)==null||d.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(g=this.lq2)==null||g.destroy(),(h=this.arrows)==null||h.destroy(),this.lq=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round($f/this.gpu.cpu.grid.dx)),a=r>>1,c=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=c*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,c,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:vi*s,size:4*ao}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const c=this.gpu.state,l=this.gpu.ctx,u=this.device.queue;this.roData[0]=Wf[r],u.writeBuffer(this.ro,0,this.roData),t.clearBuffer(c.cnt,4*K.OV_PMAX,16);const f=t.beginComputePass(),d=c.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),d),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),d),a||(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*d),l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*d),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*d)),r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),f.end();const m=this.gpu.cpu.grid,g=(y,F,w)=>{const P=new Float32Array(ao),_=new Uint32Array(P.buffer);P.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,n],0),P.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),P.set(F,24),P.set(w,28),P[32]=r==="temperature"?1:0,P[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),_[34]=c.d.bcap,_[35]=c.d.pcap,u.writeBuffer(this.rp,vi*y,P)},h=.003;g(0,[0,0,m.w,m.h],[...this.theme.ground,1]),g(1,[0,0,0,0],[0,0,0,0]),g(2,[0,0,0,0],[...this.theme.ink,.85]),g(3,[0,0,0,0],[...this.waterInk,.9]);const p=[];i.left&&p.push([-h,-h,0,m.h+(i.top?h:0)]),i.right&&p.push([m.w,-h,m.w+h,m.h+(i.top?h:0)]),i.bottom&&p.push([-h,-h,m.w+h,0]),i.top&&p.push([-h,m.h,m.w+h,m.h+h]),p.forEach((y,F)=>g(4+F,y,[...this.theme.wall,1]));const v=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),b=this.pipes;v.setPipeline(b.rect),v.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),v.draw(4),a?(v.setPipeline(b.point),v.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:c.partsA})),v.draw(4,c.d.pcap)):(v.setPipeline(b.liquid),v.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),v.draw(4)),v.setPipeline(b.disc),v.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:c.bubs})),v.draw(4,c.d.bcap),v.setPipeline(b.field),v.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),v.draw(4),v.setPipeline(b.cells),v.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),v.draw(4),r==="velocity"&&(v.setPipeline(b.line),v.setVertexBuffer(0,this.arrows),v.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),v.draw(6*this.nArrows),v.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),v.draw(6*this.nArrows,1,6*this.nArrows)),v.setPipeline(b.rect),p.forEach((y,F)=>{v.setBindGroup(0,this.drawGroup(`d-wall${F}`,this.layouts.rect,4+F,{})),v.draw(4)}),v.end()}reset(){this.size="",this.groups.clear()}}const e0=[...Ef,...Hf,...Of,...Lf,...jf,...Tf,...Sf,...If,...Gf,...zf],lo=[["heater",K.HEATER_E,"f"],["lossWalls",K.LOSS_WALLS,"f"],["lossOpen",K.LOSS_OPEN,"f"],["escapedEnergy",K.ESC_ENERGY,"f"],["escapedWater",K.ESC_WATER,"f"],["escapedAir",K.ESC_AIR,"f"],["produced",K.PRODUCED,"f"],["condensed",K.CONDENSED,"f"],["dew",K.DEW,"f"],["fogMade",K.FOGMADE,"f"],["burstVapour",K.BURSTVAP,"f"],["fluxSL",K.FLUX_SL,"f"],["fluxLG",K.FLUX_LG,"f"],["fluxSG",K.FLUX_SG,"f"],["lossSolids",K.LOSS_SOLIDS,"f"],["nucleated",K.NUCLEATED,"u"],["departed",K.DEPARTED,"u"],["merged",K.MERGED,"u"],["burst",K.BURST,"u"],["collapsed",K.COLLAPSED,"u"],["burstCold",K.BURST_COLD,"u"],["burstWarm",K.BURST_WARM,"u"],["collapsedCold",K.COLL_COLD,"u"],["collapsedWarm",K.COLL_WARM,"u"]],fo=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),yi=256,us=2*Ge;class cr{constructor(t,e){x(this,"ctx");x(this,"cpu");x(this,"state");x(this,"solver");x(this,"sub");x(this,"groups",new Map);x(this,"stateVersion",0);x(this,"itL",16);x(this,"itG",18);x(this,"itH",8);x(this,"itD",6);x(this,"nsub",0);x(this,"totals",fo());x(this,"last",null);x(this,"stepped",null);x(this,"energy0",null);x(this,"water0",null);x(this,"sealed",!1);x(this,"staging",[]);x(this,"busy",new Set);x(this,"reading",new Map);x(this,"querySet");x(this,"queryBuf");x(this,"vapourMark",0);x(this,"vapourLast",0);x(this,"vapourRate",0);x(this,"stageMs",new Array(Ge).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:us}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*us,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await ir.create(),s=await e.compile(e0);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new cr(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Nf(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Vf(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(yi/4*16);for(let n=0;n<16;n+=1)s[yi/4*n]=n;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*K.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:yi*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,us,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);this.sort(n,1),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.cells(n,"liqAssemble"),this.solver.encodeMG(n,ic,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,rc,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,cc,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,oc,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),this.cells(n,"heatShare","A"),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*He,n=s+4*xs,i=n+4*he*t.d.nreg,r=i+4*ae*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],c=r+4*ys*a,l=c+4*64,u=l+8*us;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:c,ts:l,total:u}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(c=>!this.busy.has(c)&&c.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*He),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*xs),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*he*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*ae*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*us),t.clearBuffer(s.cnt,4*Gr,4*(Yl-Gr)),this.busy.add(i);const a=[];for(let c=0;c<this.cpu.regions.count;c+=1)a.push(s.gpuRegion(c));return this.reading.set(i,{version:this.stateVersion,layout:n,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),i}async finishReadback(t,e){const s=this.reading.get(t),n=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return n(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),n(),null;const i=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),n();const r=this.parse(i,s,e);return this.absorb(r),r}parse(t,e,s){const n=e.layout,i=new Uint32Array(t,n.cnt,He),r=new Float32Array(t,n.cnt,He),a=new Float32Array(t,n.glob,xs),c=new Float32Array(t,n.reg,he*e.nreg),l=new Float32Array(t,n.heat,ae*e.nheat),u=new Float32Array(t,n.meas,(n.probe-n.meas)/4),f=new Float32Array(t,n.probe,64),[d,m,g]=e.groups,h=(w,P,_)=>{let A=0;for(let k=0;k<P;k+=1)A+=u[(w+k)*ys+_];return A},p=[];for(const w of e.regions){const P=he*w;p.push({p0:c[P+Gt.P0],sealed:c[P+Gt.OPEN]===0,vGas:c[P+Gt.VGAS],vFluid:c[P+Gt.VFLUID]})}const v=[];for(let w=0;w<e.heaters;w+=1){const P=ae*w;v.push({P:l[P+qt.P],Tmean:l[P+qt.TMEAN],integral:l[P+qt.INTEGRAL],cells:l[P+qt.CELLS]})}let b=null;if(s&&this.queryBuf!==null){const w=new BigUint64Array(t,n.ts,us);b=[];for(let P=0;P<Ge;P+=1){const _=w[2*P],A=w[2*P+1];b.push(A>_&&_>0n?Number(A-_)/1e6:0)}}const y=r[K.SUM_WM],F={};for(const[w,P,_]of lo)F[w]=_==="f"?r[P]:i[P];return{intervals:F,ov:[r[K.OV_PMAX],r[K.OV_VMAX],r[K.OV_VLIQ]],pcount:i[K.PCOUNT],bcount:i[K.BCOUNT],dt:a[ms.DT],stepsSince:i[K.STEPS],simSince:r[K.SIMTIME],itL:i[K.IT_L],itG:i[K.IT_G],itH:i[K.IT_H],itD:i[K.IT_D],capL:i[K.CAP_L],capG:i[K.CAP_G],capH:i[K.CAP_H],capD:i[K.CAP_D],resL:r[K.RES_L],resG:r[K.RES_G],resH:r[K.RES_H],nsub:i[K.NSUBMAX],uMaxG:r[K.UMAXG],waterMass:y,waterT:y>0?r[K.SUM_WMT]/y:0,waterTmax:r[K.TMAX],solids:h(0,d,0),film:h(0,d,1),gas:h(0,d,2),vapour:h(0,d,3),fog:h(0,d,4),air:h(0,d,5),liquidCells:Math.round(h(0,d,6)),gasCells:Math.round(h(0,d,7)),liquidH:h(d,m,0),liquidMass:h(d,m,1),sensible:h(d,m,3),bubH:h(d+m,g,0),bubWater:h(d+m,g,1),bubAir:h(d+m,g,2),regions:p,heaters:v,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:i[K.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:i[K.FIRST_SH]!==0?r[K.FIRST_SH]-1e3:null,stageMs:b}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of lo)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(n,i,r,a,c,l)=>{if(i===0&&r===0)return n;const u=r>0?Math.ceil(n*1.5)+2:i+l;return Math.min(c,Math.max(a,n>u?Math.max(u,n-2):u))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:0,editOther:e.ledger.other,escapedSalt:0,editSalt:e.ledger.salt,bodyWork:0},c=this.energy0??r.energy,l=this.water0??r.water.total,u=r.energy-c-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),f=r.water.total-l-a.editWater,d=i.produced+i.burstVapour,m=i.time-this.vapourLast;m>.2&&(this.vapourRate=(d-this.vapourMark)/m,this.vapourMark=d,this.vapourLast=i.time);const g=e.heat.heaters.map((v,b)=>({h:v,k:b,rd:n==null?void 0:n.heaters[b]})).filter(({rd:v,h:b})=>((v==null?void 0:v.cells)??b.cells)>0).map(({h:v,rd:b})=>({group:v.group,P:(b==null?void 0:b.P)??v.P,Tmean:(b==null?void 0:b.Tmean)??v.Tmean,mode:v.mode,power:v.power,target:v.target,on:v.on})),h=(v,b,y)=>({iterations:v,residual:b,capped:y>0}),p=this.stepped??n;return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:h((p==null?void 0:p.itL)??0,(p==null?void 0:p.resL)??0,(p==null?void 0:p.capL)??0),gas:h((p==null?void 0:p.itG)??0,(p==null?void 0:p.resG)??0,(p==null?void 0:p.capG)??0),heat:h((p==null?void 0:p.itH)??0,(p==null?void 0:p.resH)??0,(p==null?void 0:p.capH)??0),gasSubsteps:(p==null?void 0:p.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,otherMass:0,otherT:0,saltMass:0,saltSolid:0,bodies:{count:this.cpu.bodies.list.filter(v=>!v.gone).length,free:0,awake:0},heaters:g,regions:((n==null?void 0:n.regions)??[]).map(v=>({p0:v.p0,sealed:v.sealed,vGas:v.vGas})),budget:r,flows:a,energyError:u,waterError:f,otherError:0,saltError:0,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy}}budget(){const t=this.last,e=this.totals;let s=0;for(const l of(t==null?void 0:t.regions)??[])l.sealed&&(s-=l.p0*l.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,c={liquid:(t==null?void 0:t.liquidMass)??0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:c,other:{liquid:0,escaped:0,total:0},salt:{liquid:0,crust:0,floor:0,escaped:0,total:0},air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,fo()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return _t(this.cpu.regions.pAmb)}}const s0=.3;vt.map(o=>rr(o.color));var vo;rr(((vo=Uo[0])==null?void 0:vo.color)??"#f4f3ee");function n0(o,t,e,s,n){const i=-n,r=-n,a=o+2*n,c=t+2*n,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/c>l){const f=a/l;return{x0:i,y0:r-(f-c)/2,x1:i+a,y1:r-(f-c)/2+f}}const u=c*l;return{x0:i-(u-a)/2,y0:r,x1:i-(u-a)/2+u,y1:r+c}}const As=self,Lt=o=>As.postMessage(o),uo=8,i0=.1,r0=3,ho=200,o0=.25,mo=273.15;let lt=null,Z=null,Be=null,Dn=null,_e=null,bs="",_n=1,Pn=1,kn=1,_s={x0:0,y0:0,x1:1,y1:1},Ps={left:!0,right:!0,bottom:!0,top:!1},ks=!1,Ii=1,Ne="none",ac=!1,Ue=0,ws=0,qi=0,bi=0,wi=!1,tn=0,po=0,Ei=0,Ri=0,go=!1,Di=0,ps=null;const De=[],Vi=[];let Vn=!1;const Fs=[];function ar(){if(lt===null)return;const o=lt.scene.sides;Ps={left:o.left==="wall",right:o.right==="wall",bottom:o.bottom==="wall",top:o.top==="wall"}}function lr(o,t,e){_n=Math.max(1,o),Pn=Math.max(1,t),kn=Math.max(.5,Math.min(3,e)),_e!==null&&(_e.width=Math.round(_n*kn),_e.height=Math.round(Pn*kn)),lt!==null&&(_s=n0(lt.boxW,lt.boxH,_n,Pn,.006))}function lc(o){Be!==null&&(Be.theme={ground:o?[.1,.12,.15]:[.93,.95,.97],outside:o?[.06,.07,.09]:[.86,.88,.9],wall:o?[.55,.6,.66]:[.42,.46,.5],ink:o?[.9,.93,.96]:[.08,.1,.12]})}function ds(o){Vi.push(o),Vn||c0()}async function c0(){if(Z!==null){Vn=!0;try{for(;Vi.length>0;){const o=Vi.shift();await Z.ctx.device.queue.onSubmittedWorkDone();try{await o()}catch(t){Lt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{Vn=!1,ws=performance.now()}}}async function Ni(){if(Z===null)return;const o=Z.ctx.device.createCommandEncoder(),t=Z.encodeReadback(o,!1);Z.ctx.device.queue.submit([o.finish()]),t!==null&&await Z.finishReadback(t,!1),Z.baselineFromLast()}function fr(){return lt===null||!lt.needsCpu()?!1:(Lt({type:"gpu",ok:!1,adapter:bs,message:"other-liquid",scene:lt.serialize()}),!0)}function ur(o){Z!==null&&Be!==null&&Z.stateVersion!==o&&Be.reset()}function Fi(){ds(async()=>{if(Z===null||lt===null||Fs.length===0)return;const o=Fs.splice(0,Fs.length);await Ni(),await Z.download();for(const e of o){const s=lt.apply(e);s!==null&&s.startsWith("refused")&&Lt({type:"refused",message:s})}if(fr())return;const t=Z.stateVersion;Z.upload(),ur(t)})}function a0(o){const t=(o==null?void 0:o.ov)??[0,0,0],e=t[2];if(Ne==="temperature")return[mo+le[0],mo+le[1],e];if(Ne==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return Ne==="velocity"?[0,Math.max(.02,t[1]),e]:Ne==="vapour"?[0,.6,e]:Ne==="salt"?[0,s0,e]:[0,1,e]}function l0(o){if(o===null)return null;const t=o.watch;if(t.found){const e=t.data;return ps={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:_t(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},ps}return ps!==null&&(t.fate===1||t.fate===2)?{...ps,fate:t.fate===1?"burst":"collapsed"}:null}function f0(o,t){if(Z===null||Dn===null)return;if(Z.baselineFromLast(),Z.totals.time>=Di){const i=Dn.sample();i!==null&&(De.push(i),De.length>400&&De.splice(0,De.length-400),Di=Z.totals.time+o0)}const e=Math.max(.001,(t-tn)/1e3),s=(o.stageMs??Z.stageMs).reduce((i,r)=>i+r,0),n={engine:Z.stats(s),stepsPerSecond:Ri/e,simRate:(Z.totals.time-po)/e,fps:Ei/e,renderMs:0,mode:"gpu",adapter:bs,paused:ks,samples:De.splice(0,De.length),bubble:l0(o),overlayScale:a0(o)};Lt({type:"stats",stats:n}),Ei=0,Ri=0,po=Z.totals.time,tn=t}function Ui(){var t;const o=performance.now();if(Z!==null&&Be!==null&&_e!==null&&lt!==null&&!Vn){const e=Z.ctx.device,s=ws===0?0:Math.min(.1,(o-ws)/1e3);ws=o;const n=((t=Z.last)==null?void 0:t.dt)??lt.dt;let i=0;ks?(i=Math.min(uo,qi),qi-=i,Ue=0):(Ue=Math.min(Ue+s*Ii,i0*Math.max(1,Ii)),i=bi>=r0?0:Math.min(uo,Math.floor(Ue/Math.max(1e-5,n))),Ue-=i*n);const r=!wi&&o-tn>ho&&(i>0||ks||o-tn>4*ho),a=e.createCommandEncoder();i>0&&Z.encodeSteps(a,i,r);const c=r?Z.encodeReadback(a,r&&i>0):null;if(Be.encode(a,_s,_e.width,_e.height,Ps,Ne,ac),e.queue.submit([a.finish()]),bi+=1,e.queue.onSubmittedWorkDone().then(()=>{bi-=1}),Ri+=i,Ei+=1,c!==null){wi=!0;const l=i>0;Z.finishReadback(c,l).then(u=>{wi=!1,u!==null&&f0(u,performance.now())})}}typeof As.requestAnimationFrame=="function"?As.requestAnimationFrame(Ui):setTimeout(Ui,16)}async function u0(o){if(lt=new Xl(o.scene),ks=o.paused===!0,fr())return;if(_e=o.canvas,_e===null)throw new Error("no OffscreenCanvas");Z=await cr.create(lt),bs=await(async()=>{var e;try{const s=await((e=As.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),Be=new t0(Z,_e),await Be.init(),lc(o.dark),Dn=new tc(Z),Z.ctx.device.addEventListener("uncapturederror",e=>Lt({type:"error",message:`WebGPU: ${e.error.message}`})),Z.ctx.device.lost.then(e=>Lt({type:"gpu",ok:!1,adapter:bs,message:e.message||e.reason})),ar(),lr(o.width,o.height,o.dpr),Lt({type:"gpu",ok:!0,adapter:bs,message:""}),Lt({type:"ready",offscreen:!0,warnings:lt.warnings,view:_s,quality:lt.currentQuality,walls:Ps}),tn=performance.now(),ws=performance.now(),go||(go=!0,Ui())}function xo(){if(Z===null||lt===null)return;const o=Z.stateVersion;Z.cpu=lt,Z.rebuild(),Z.resetTotals(),ur(o),Dn=new tc(Z),Di=0,De.length=0,Ue=0,ps=null,ar(),lr(_n,Pn,kn),Lt({type:"view",view:_s,walls:Ps})}As.addEventListener("message",o=>{const t=o.data;try{switch(t.type){case"probe":Lt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&As.navigator.gpu!==void 0});break;case"init":u0(t).catch(e=>Lt({type:"gpu",ok:!1,adapter:bs,message:e instanceof Error?e.message:String(e)}));break;case"resize":lr(t.width,t.height,t.dpr),Lt({type:"view",view:_s,walls:Ps});break;case"op":Fs.push(t.op),Fi();break;case"addLiquid":Fs.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Fi();break;case"addSolid":Fs.push({op:"solid",region:t.region,material:t.material,T:t.T}),Fi();break;case"setHeater":lt==null||lt.setHeater(t.group,t.mode,t.power,t.target,t.on),Z==null||Z.writeHeater(t.group);break;case"setAmbient":lt==null||lt.setAmbient(t.p,t.T,t.rh,t.g,t.air),Z==null||Z.writeParams();break;case"setBoundary":ds(async()=>{if(Z===null||lt===null)return;await Ni(),await Z.download(),lt.setBoundary(t.side,t.value);const e=Z.stateVersion;Z.upload(),ur(e),ar(),Lt({type:"view",view:_s,walls:Ps})});break;case"query":ds(async()=>{if(Z===null||lt===null){Lt({type:"reply",id:t.id,data:null});return}await Ni(),await Z.download(),Lt({type:"reply",id:t.id,data:lt.query(t.x,t.y)})});break;case"select":ps=null,Z==null||Z.watch(t.bubble);break;case"overlay":Ne=t.overlay;break;case"particles":ac=t.on;break;case"pause":ks=t.paused,Ue=0,ws=performance.now();break;case"step":ks&&(qi+=1);break;case"setSpeed":Ii=Math.min(64,Math.max(.05,t.speed));break;case"setQuality":ds(async()=>{lt!==null&&(lt.setQuality(t.quality),xo())});break;case"serialize":Z===null?Lt({type:"reply",id:t.id,data:(lt==null?void 0:lt.serialize())??null}):ds(async()=>{Lt({type:"reply",id:t.id,data:(lt==null?void 0:lt.serialize())??null})});break;case"load":ds(async()=>{lt!==null&&(lt.load(t.scene),!fr()&&xo())});break;case"theme":lc(t.dark);break;case"frameDone":break}}catch(e){Lt({type:"error",message:e instanceof Error?e.message:String(e)})}});
