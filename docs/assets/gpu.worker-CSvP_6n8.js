var Er=Object.defineProperty;var Dr=(c,t,e)=>t in c?Er(c,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):c[t]=e;var g=(c,t,e)=>Dr(c,typeof t!="symbol"?t+"":t,e);const Et=8.314462618,ai=9.80665,ys=101325,mt=273.15,N=0,lt=1,ht=2,nt=0,rt=1,K=2,at=6,dt=3,zt=8;class Vr{constructor(t){g(this,"cap");g(this,"count",0);g(this,"nextId",1);g(this,"x");g(this,"y");g(this,"z");g(this,"vx");g(this,"vy");g(this,"m");g(this,"H");g(this,"age");g(this,"site");g(this,"r");g(this,"V");g(this,"pb");g(this,"pv");g(this,"Tb");g(this,"dmdt");g(this,"force");g(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*at),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*zt),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const i=this.count;this.count+=1,this.x[i]=t,this.y[i]=e,this.z[i]=s,this.vx[i]=0,this.vy[i]=0;for(let n=0;n<at;n+=1)this.m[i*at+n]=0;this.H[i]=0,this.age[i]=0,this.site[i]=-1,this.r[i]=0,this.V[i]=0,this.pb[i]=0,this.pv[i]=0,this.Tb[i]=0,this.dmdt[i]=0;for(let n=0;n<zt;n+=1)this.force[i*zt+n]=0;return this.id[i]=this.nextId,this.nextId=this.nextId+1>>>0||1,i}totalMass(t){let e=0;for(let s=0;s<at;s+=1)e+=this.m[t*at+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<at;s+=1)this.m[t*at+s]=this.m[e*at+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<zt;s+=1)this.force[t*zt+s]=this.force[e*zt+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Ir={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Nr=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}},{id:"oil-rapeseed",name:{pl:"olej rzepakowy",de:"Rapsöl",en:"rapeseed (canola) oil"},liquid:{name:{pl:"olej",de:"Öl",en:"oil"},rho:{linear:[990.07,-.237],src:"rojas2013"},cp:{linear:[287,5.3],src:"rojas2013"},k:{linear:[.13939,90714e-9],src:"rojas2013fit"},mu:{vogel:[335812e-10,593.635,120.95],src:"rojas2013fit"},sigma:{v:.0334,src:"melo2014"},range:{lo:293.15,hi:433.15,src:"rojas2013"},color:"#e3b437"}}],Gr={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Ur=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},color:"#d8ccb4"}];var Hr={ambient:Ir,species:Nr,vapourInAir:Gr,solids:Ur};const St=Hr,kt=St.species[0],hs=St.species[1],ds=St.species[2],ut=new Float64Array(at);ut[nt]=hs.molarMass.v;ut[rt]=ds.molarMass.v;ut[K]=kt.molarMass.v;hs.name,ds.name,kt.vapour.name;const Zi=hs.gas.cp.v,tn=ds.gas.cp.v,[ws,Fs,we]=kt.vapour.cp.linear;function $r(c,t){return c===K?ws+Fs*(t-we):c===nt?Zi:c===rt?tn:0}const Pe=kt.liquid.kell.c,Ss=kt.liquid.cp.table,wt=new Float64Array(Ss.map(c=>c[0])),At=new Float64Array(Ss.map(c=>c[1])),Kt=new Float64Array(Ss.length);Kt[0]=At[0]*(wt[0]-mt);for(let c=1;c<Ss.length;c+=1)Kt[c]=Kt[c-1]+.5*(At[c]+At[c-1])*(wt[c]-wt[c-1]);const Ot=Ss.length-1;function or(c){if(c<wt[0])return-1;if(c>=wt[Ot])return Ot;let t=Math.min(Ot-1,Math.max(0,Math.floor((c-mt)/10)));for(;t>0&&c<wt[t];)t-=1;for(;t<Ot-1&&c>=wt[t+1];)t+=1;return t}function Xs(c){const t=or(c);return t<0?At[0]:t===Ot?At[Ot]:At[t]+(At[t+1]-At[t])*(c-wt[t])/(wt[t+1]-wt[t])}function qt(c){const t=or(c);if(t<0)return Kt[0]+At[0]*(c-wt[0]);if(t===Ot)return Kt[Ot]+At[Ot]*(c-wt[Ot]);const e=c-wt[t],s=(At[t+1]-At[t])/(wt[t+1]-wt[t]);return Kt[t]+At[t]*e+.5*s*e*e}function Wr(c){if(c<Kt[0])return wt[0]+(c-Kt[0])/At[0];if(c>=Kt[Ot])return wt[Ot]+(c-Kt[Ot])/At[Ot];let t=Math.min(Ot-1,Math.max(0,Math.floor(c/41900)));for(;t>0&&c<Kt[t];)t-=1;for(;t<Ot-1&&c>=Kt[t+1];)t+=1;const e=(At[t+1]-At[t])/(wt[t+1]-wt[t]),s=c-Kt[t],i=At[t];return wt[t]+2*s/(i+Math.sqrt(Math.max(0,i*i+2*e*s)))}function Kr(c){const t=c-mt;return(Pe[0]+t*(Pe[1]+t*(Pe[2]+t*(Pe[3]+t*(Pe[4]+t*Pe[5])))))/(1+Pe[6]*t)}const li=kt.liquid.k.poly;function qi(c){const t=Math.min(150,Math.max(0,c-mt));return li[0]+t*(li[1]+t*li[2])}const[zr,Qr,hn]=kt.liquid.mu.vogel;function Xr(c){return zr*Math.pow(10,Qr/(Math.max(c,hn+60)-hn))}const fi=kt.surfaceTension,Yr=kt.saturation.Tc.v;function en(c){const t=Math.max(0,1-c/Yr);return fi.B*Math.pow(t,fi.mu)*(1+fi.b*t)}const Jr=kt.saturation.hlv100.v,_s=mt+100,ar=qt(_s)+Jr,Zr=kt.vapour.k.v,to=kt.vapour.mu.v;function gt(c){const t=c-we,e=_s-we;return ar+ws*(c-_s)+.5*Fs*(t*t-e*e)}function eo(c){return gt(c)-qt(c)}function Wt(c,t){return c===K?gt(t):$r(c,t)*(t-mt)}const ui=hs.gas.k.power,hi=ds.gas.k.power,so=hs.gas.mu.sutherland,io=ds.gas.mu.sutherland,di=St.vapourInAir,cr=(c,t)=>c[0]*Math.pow(t/c[1],1.5)*((c[1]+c[2])/(t+c[2])),lr=150,Ys=1001,Ms=c=>{const t=new Float64Array(Ys);for(let e=0;e<Ys;e+=1)t[e]=c(lr+e);return t},Re=(c,t)=>{let e=t-lr;e>0?e>Ys-1.001&&(e=Ys-1.001):e=0;const s=e|0;return c[s]+(e-s)*(c[s+1]-c[s])},dn=Ms(c=>ui[0]*Math.pow(c/ui[1],ui[2])),no=Ms(c=>hi[0]*Math.pow(c/hi[1],hi[2])),mn=Ms(c=>cr(so,c)),ro=Ms(c=>cr(io,c)),oo=Ms(c=>di.D0.v*Math.pow(c/di.T0.v,di.exponent.v));function ao(c,t,e,s){const i=c+t+e;return i>0?(c*Re(dn,s)+t*Re(no,s)+e*Zr)/i:Re(dn,s)}function co(c,t,e,s){const i=c+t+e;return i>0?(c*Re(mn,s)+t*Re(ro,s)+e*to)/i:Re(mn,s)}function lo(c,t){return Re(oo,c)*(ys/t)}function fr(c,t,e,s){const i=c*Zi+t*tn,n=_s-we,r=.5*e*Fs,a=i+e*ws;if(a<=0)return mt;const o=i*(we-mt)+e*(ar+ws*(we-_s)-.5*Fs*n*n)-s,l=a*a-4*r*o;return we+-2*o/(a+Math.sqrt(l>0?l:0))}function Ei(c,t,e,s,i){return c*Zi+t*tn+e*(ws+Fs*(i-we))+(s>0?s*Xs(i):0)}const fo=St.ambient.air.N2.v,uo=St.ambient.air.O2.v,ur=St.ambient.hExt.v,Dt=St.solids.map(c=>({id:c.id,name:c.name,rho:c.rho.v,cp:c.cp.v,k:c.k.v,contactAngle:c.contactAngle.v,cavScale:c.cavities.scale.v,cavRmax:c.cavities.rmax.v,color:c.color}));function Ns(c){return Dt.findIndex(t=>t.id===c)}const pt=0,hr=St.species.slice(3),pn=[null,...hr.map(c=>{const t=c.liquid,[e,s]=t.cp.linear;return{rA:t.rho.linear[0],rB:t.rho.linear[1],cA:e,cB:s,kA:t.k.linear[0],kB:t.k.linear[1],mA:t.mu.vogel[0],mB:t.mu.vogel[1],mC:t.mu.vogel[2],sigma:t.sigma.v,h0:e*mt+.5*s*mt*mt}})],re=[{id:kt.id,name:kt.name,short:kt.liquid.name,color:kt.liquid.color,volatile:!0,range:[mt,mt+150]},...hr.map(c=>({id:c.id,name:c.name,short:c.liquid.name,color:c.liquid.color,volatile:!1,range:[c.liquid.range.lo,c.liquid.range.hi]}))];function dr(c){return re.findIndex(t=>t.id===c)}const De=c=>pn[c]??pn[1];function Ps(c,t){if(c===pt)return Xs(t);const e=De(c);return e.cA+e.cB*t}function ho(c,t){if(c===pt)return qt(t);const e=De(c);return e.cA*t+.5*e.cB*t*t-e.h0}function mo(c,t){if(c===pt)return Wr(t);const e=De(c),s=t+e.h0;return e.cB===0?s/e.cA:2*s/(e.cA+Math.sqrt(Math.max(0,e.cA*e.cA+2*e.cB*s)))}function ge(c,t){if(c===pt)return Kr(t);const e=De(c);return e.rA+e.rB*t}function Gs(c,t){if(c===pt)return qi(t);const e=De(c);return e.kA+e.kB*t}function gs(c,t){if(c===pt)return Xr(t);const e=De(c);return e.mA*Math.pow(10,e.mB/(Math.max(t,e.mC+60)-e.mC))}function ss(c,t){return c===pt?en(t):De(c).sigma}kt.thermo,hs.thermo,ds.thermo;const Ls=St.species[0].saturation,ae=Ls.if97.n,mr=ae[0],pr=ae[1],gr=ae[2],vr=ae[3],xr=ae[4],br=ae[5],yr=ae[6],wr=ae[7],Fr=ae[8],Di=ae[9],vs=Ls.Tc.v,po=Ls.rhoc.v,Js=273.15,Ve=Ls.vapourDensity.c;Ls.liquidDensity.b;function Zs(c){const t=c<Js?Js:c>vs?vs:c,e=t+Fr/(t-Di),s=e*e+mr*e+pr,i=gr*e*e+vr*e+xr,n=br*e*e+yr*e+wr,r=2*n/(-i+Math.sqrt(i*i-4*s*n));return r*r*r*r*1e6}function Pt(c){const t=c<611.213?611.213:c>22064e3?22064e3:c,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+gr*e+br,i=mr*e*e+vr*e+yr,n=pr*e*e+xr*e+wr,r=2*n/(-i-Math.sqrt(i*i-4*s*n)),a=Di+r;return(a-Math.sqrt(a*a-4*(Fr+Di*r)))/2}function _r(c){const e=1-(c<Js?Js:c>vs?vs:c)/vs,s=Math.pow(e,1/6),i=s*s,n=i*i,r=n*n,a=r*r*i,o=a*a*s,l=o*a*r*r;return po*Math.exp(Ve[0]*i+Ve[1]*n+Ve[2]*r+Ve[3]*a+Ve[4]*o+Ve[5]*l)}const ti=250,ei=.01,Cs=25001,Us=new Float64Array(Cs),Hs=new Float64Array(Cs);for(let c=0;c<Cs;c+=1)Us[c]=Zs(ti+c*ei),Hs[c]=_r(ti+c*ei);function ps(c){const t=(c-ti)/ei;if(!(t>=0)||t>=Cs-1)return Zs(c);const e=t|0;return Us[e]+(t-e)*(Us[e+1]-Us[e])}function Fe(c){const t=(c-ti)/ei;if(!(t>=0)||t>=Cs-1)return _r(c);const e=t|0;return Hs[e]+(t-e)*(Hs[e+1]-Hs[e])}const Pr=200;function mi(c,t,e,s){const i=Pt(c);return t/Fe(i)-e*Et*i/(s-c)}function go(c,t){const e=Math.PI*t*t*t/6;if(c<=e)return Math.cbrt(3*c/(4*Math.PI));const s=Math.PI*t*t*t/4;return c<=s?t/2:Math.sqrt(c/(Math.PI*t))}function vo(c,t,e,s){const i=Math.PI*e*e*e/6,n=Math.PI*e*e*e/4;if(c<=i){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(c>=n){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(c-i)/(n-i);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function xo(c,t,e,s,i,n,r,a=pt){const o=c[t+K],l=c[t+nt]/ut[nt]+c[t+rt]/ut[rt],h=o/ut[K];let f=n>0?n:Math.cbrt(3*Math.max(1e-30,(h+l)*Et*s/e)/(4*Math.PI)),d=e,m=0,u=s,v=0;for(let p=0;p<8;p+=1){if(d=e+2*ss(a,u)/f,l<=0)m=d,u=Pt(m),v=o/Fe(u);else if(h<=1e-9*l)m=0,u=s,v=l*Et*u/d;else{let w=611.213,b=d*(1-1e-12),F=mi(w,o,l,d),y=mi(b,o,l,d);if(F<=0)m=w;else if(y>=0)m=b;else{let A=0;m=.5*(w+b);for(let _=0;_<40;_+=1){m=(w*y-b*F)/(y-F);const P=mi(m,o,l,d);if(Math.abs(P)<=1e-12*(o/Fe(s)+1e-30))break;P>0?(w=m,F=P,A===1&&(y/=2),A=1):(b=m,y=P,A===-1&&(F/=2),A=-1)}}u=Pt(m),v=o/Fe(u)}const x=go(v,i);if(Math.abs(x-f)<=1e-7*f){f=x;break}f=x}r.r=f,r.V=v,r.pb=e+2*ss(a,u)/f,r.pv=m,r.Tb=u,vo(v,f,i,r)}function gn(c,t,e,s){let i=0;for(let n=0;n<at;n+=1)c[t+n]>0&&(i+=c[t+n]*s(n,e));return i}function vn(c,t,e,s,i,n,r,a,o,l){let h=0;if(2*e<=3*n){const x=c/n-.5,w=t/n-.5,b=Math.floor(x-.5),F=Math.floor(w-.5),y=x-b,A=w-F,_=.5*(1.5-y)**2,P=.75-(y-1)**2,S=.5*(y-.5)**2,L=.5*(1.5-A)**2,O=.75-(A-1)**2,q=.5*(A-.5)**2;let Q=0;for(let C=0;C<3;C+=1){const W=F+C;if(W<0||W>=a)continue;const M=C===0?L:C===1?O:q;for(let D=0;D<3;D+=1){const J=b+D;if(J<0||J>=r)continue;const j=M*(D===0?_:D===1?P:S);o[h]=J+W*r,l[h]=j,Q+=j,h+=1}}for(let C=0;C<h;C+=1)l[C]/=Q;return h}const f=s<=Math.PI*i*i*i/6,d=Math.max(0,Math.floor((c-e)/n)),m=Math.min(r-1,Math.floor((c+e)/n)),u=Math.max(0,Math.floor((t-e)/n)),v=Math.min(a-1,Math.floor((t+e)/n));let p=0;for(let x=u;x<=v;x+=1)for(let w=d;w<=m;w+=1){let b=0;for(let F=0;F<4;F+=1){const y=(x+(F+.5)/4)*n-t;for(let A=0;A<4;A+=1){const _=(w+(A+.5)/4)*n-c,P=e*e-_*_-y*y;P>0&&(b+=f?Math.sqrt(P):1)}}b<=0||h>=o.length||(o[h]=w+x*r,l[h]=b,p+=b,h+=1)}if(p<=0)return o[0]=Math.min(r-1,Math.max(0,Math.floor(c/n)))+Math.min(a-1,Math.max(0,Math.floor(t/n)))*r,l[0]=1,1;for(let x=0;x<h;x+=1)l[x]/=p;return h}const Ie=.5;class bo{constructor(t){g(this,"e");g(this,"ux0");g(this,"uy0");g(this,"vel",new Float64Array(2));g(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const i=this.e,n=i.grid,r=i.bubbles,a=i.liquid,o=r.x[t],l=r.y[t],h=r.r[t],f=r.V[t],d=Math.max(h+n.dx,2*n.dx),m=this.vel;let u=0,v=0;for(let ft=0;ft<8;ft+=1){const ct=ft*Math.PI/4;a.velocityAt(o+d*Math.cos(ct),l+d*Math.sin(ct),m),u+=m[0]/8,v+=m[1]/8}const p=n.cellAt(o,l),x=p>=0&&i.phase.Cl[p]>0?i.phase.Tl[p]:r.Tb[t],w=p>=0?i.phase.host[p]:0,b=i.phase.mixed?ge(w,x):a.rhoRef,F=gs(w,x),y=r.totalMass(t)/Math.max(1e-30,f),A=(u-this.ux0[t])/Math.max(e,1e-6),_=(v-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=u,this.uy0[t]=v,h<2e-5){r.vx[t]=u,r.vy[t]=v,r.x[t]=Math.min(n.w-1e-6,Math.max(1e-6,o+e*u)),r.y[t]=Math.min(n.h-1e-6,Math.max(1e-6,l+e*v));return}const P=r.vx[t]-u,S=r.vy[t]-v,L=Math.hypot(P,S),O=2*h,q=Math.max(1e-6,b*L*O/F),Q=Math.max(0,i.gy)*(b-y)*O*O/ss(w,x),W=.5*Math.max(24/q*(1+.15*Math.pow(q,.687)),8/3*(Q/(Q+4)))*b*this.front(t)*L,M=(y+Ie*b)*f,D=b*f*A,J=b*f*(_+i.gy),j=-y*f*i.gy,Z=Ie*b*f*A,$=Ie*b*f*_,T=s>0?Ie*b*s:0,I=s<0?Math.min(-s,.2*f/e):0,X=Ie*b*I*P,V=Ie*b*I*S,z=(M*r.vx[t]+e*(D+Z+X)+e*(W+T)*u)/(M+e*(W+T)),k=(M*r.vy[t]+e*(J+j+$+V)+e*(W+T)*v)/(M+e*(W+T));r.vx[t]=Number.isFinite(z)?z:u,r.vy[t]=Number.isFinite(k)?k:v;const R=-W*(z-u),E=-W*(k-v),Y=t*zt;r.force[Y]=D,r.force[Y+1]=J,r.force[Y+2]=0,r.force[Y+3]=j,r.force[Y+4]=R,r.force[Y+5]=E,r.force[Y+6]=Z+X-T*(z-u),r.force[Y+7]=$+V-T*(k-v),this.spreadForce(o,l,-(R+r.force[Y+6])*(e/i.dt),-(E+r.force[Y+7])*(e/i.dt));let B=o+e*z,U=l+e*k;const H=n.sdfAt(B,U);if(H<h){const ft=.25*n.dx;let ct=n.sdfAt(B+ft,U)-n.sdfAt(B-ft,U),xt=n.sdfAt(B,U+ft)-n.sdfAt(B,U-ft);const ie=Math.hypot(ct,xt);if(ie>1e-12){ct/=ie,xt/=ie,B+=(h-H)*ct,U+=(h-H)*xt;const xe=r.vx[t]*ct+r.vy[t]*xt;xe<0&&(r.vx[t]-=xe*ct,r.vy[t]-=xe*xt)}}r.x[t]=Math.min(n.w-1e-6,Math.max(1e-6,B)),r.y[t]=Math.min(n.h-1e-6,Math.max(1e-6,U));const st=n.depth;r.z[t]=2*h>=st?st/2:Math.min(st-h,Math.max(h,r.z[t]))}spreadForce(t,e,s,i){const n=this.e.liquid,r=this.e.grid,{nx:a,ny:o,dx:l}=r,h=this.w3;let f=Math.floor(t/l-.5),d=t/l-f;h[0]=.5*(1.5-d)**2,h[1]=.75-(d-1)**2,h[2]=.5*(d-.5)**2;let m=Math.floor(e/l-1);d=e/l-.5-m,h[3]=.5*(1.5-d)**2,h[4]=.75-(d-1)**2,h[5]=.5*(d-.5)**2;for(let u=0;u<3;u+=1)for(let v=0;v<3;v+=1){const p=f+v,x=m+u;p<0||p>a||x<0||x>=o||(n.fU[p+x*(a+1)]+=s*h[v]*h[3+u])}f=Math.floor(t/l-1),d=t/l-.5-f,h[0]=.5*(1.5-d)**2,h[1]=.75-(d-1)**2,h[2]=.5*(d-.5)**2,m=Math.floor(e/l-.5),d=e/l-m,h[3]=.5*(1.5-d)**2,h[4]=.75-(d-1)**2,h[5]=.5*(d-.5)**2;for(let u=0;u<3;u+=1)for(let v=0;v<3;v+=1){const p=f+v,x=m+u;p<0||p>=a||x<0||x>o||(n.fV[p+x*a]+=i*h[v]*h[3+u])}}front(t){const e=this.e.bubbles,s=this.e.grid.depth,i=e.V[t],n=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(i<=r)return Math.PI*n*n;if(i>=a)return 2*n*s;const o=(i-r)/(a-r);return(1-o)*(Math.PI*s*s)/4+o*s*s}}class Ar{constructor(t){g(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function yo(c,t,e){let s=(c^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const wo=8,Fo=210,xn=1.805,_o=3e-7;function bn(c,t){const e=Pt(t);return Pt(t+2*en(e)/c)-e}class Po{constructor(){g(this,"count",0);g(this,"cell",new Int32Array(0));g(this,"fluid",new Int32Array(0));g(this,"dir",new Uint8Array(0));g(this,"r",new Float32Array(0));g(this,"s",new Float32Array(0));g(this,"z",new Float32Array(0));g(this,"bubble",new Uint32Array(0));g(this,"pos",new Float64Array(2))}rebuild(t,e){const{nx:s,ny:i}=t,n=Pt(ys),r=2*en(n)/(ps(n+1)-ys),a=Fo*r,o=t.dx*t.depth,l=[],h=[],f=[],d=[],m=[],u=[],v=new Ar(1);for(let p=0;p<t.n;p+=1){if(t.solid[p]===0)continue;const x=Dt[t.solid[p]-1],w=p%s,b=(p-w)/s;for(let F=0;F<4;F+=1){const y=F===0?w-1:F===1?w+1:w,A=F===2?b-1:F===3?b+1:b;if(y<0||A<0||y>=s||A>=i)continue;const _=y+A*s;if(t.solid[_]!==0)continue;v.state=yo(e,p,F)||1;const P=Math.pow(a/x.cavRmax,xn);let S=0;for(let L=0;L<wo;L+=1){S+=v.exp();const O=a*Math.pow(S/(o*x.cavScale)+P,-1/xn);if(O<_o)break;l.push(p),h.push(_),f.push(F),d.push(O),m.push(v.next()),u.push(v.next())}}}this.count=l.length,this.cell=Int32Array.from(l),this.fluid=Int32Array.from(h),this.dir=Uint8Array.from(f),this.r=Float32Array.from(d),this.s=Float32Array.from(m),this.z=Float32Array.from(u),this.bubble=new Uint32Array(l.length)}largest(t,e){let s=0;for(let i=0;i<this.count;i+=1)Dt[t.solid[this.cell[i]]-1].id===e&&this.r[i]>s&&(s=this.r[i]);return s}position(t,e,s){const i=this.cell[e],n=i%t.nx,r=(i-n)/t.nx,a=this.s[e],o=this.dir[e],l=t.dx;return o===0?(this.pos[0]=n*l-s,this.pos[1]=(r+a)*l):o===1?(this.pos[0]=(n+1)*l+s,this.pos[1]=(r+a)*l):o===2?(this.pos[0]=(n+a)*l,this.pos[1]=r*l-s):(this.pos[0]=(n+a)*l,this.pos[1]=(r+1)*l+s),this.pos}}const Ao=.0208,To=1;class ko{constructor(t){g(this,"e");g(this,"burstVapour",0);g(this,"nucleated",0);g(this,"departed",0);g(this,"merged",0);g(this,"burst",0);g(this,"collapsed",0);g(this,"burstCold",0);g(this,"collapsedCold",0);g(this,"burstWarm",0);g(this,"collapsedWarm",0);g(this,"firstSuperheat",null);g(this,"firstMaterial",null);g(this,"departures",new Float64Array(256));g(this,"departureCount",0);g(this,"contactAngleOverride",null);g(this,"watch",-1);g(this,"watchFate",0);g(this,"sites",new Po);g(this,"motion");g(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});g(this,"cells",new Int32Array(1024));g(this,"wts",new Float64Array(1024));g(this,"alphaTarget");g(this,"budget");g(this,"tsatCell");g(this,"Fm");g(this,"vel",new Float64Array(2));g(this,"head");g(this,"next");g(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new bo(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return bn(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,i=s.grid,{nx:n,ny:r,dx:a}=i,o=Math.min(n-1.0001,Math.max(0,t/a-.5)),l=Math.min(r-1.0001,Math.max(0,e/a-.5)),h=Math.floor(o),f=Math.floor(l),d=o-h,m=l-f;let u=0,v=0;for(let p=0;p<2;p+=1)for(let x=0;x<2;x+=1){const w=h+x+(f+p)*n;if(i.solid[w]!==0)continue;const b=(x===0?1-d:d)*(p===0?1-m:m);u+=b*i.pl[w],v+=b}return s.pRef+(v>0?u/v:0)}liquidFootprint(t){const s=this.e.grid,i=this.B,n=vn(i.x[t],i.y[t],i.r[t],i.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let o=0;o<n;o+=1){const l=this.cells[o];s.kind[l]===lt&&(this.cells[a]=l,this.wts[a]=this.wts[o],r+=this.wts[o],a+=1)}for(let o=0;o<a;o+=1)this.wts[o]/=r;return r>0?a:0}solve(t,e){const s=this.B,i=this.e.grid,n=this.shape;xo(s.m,t*at,this.pressure(s.x[t],s.y[t]),e,i.depth,s.r[t],n,this.e.phase.hostAt(s.x[t],s.y[t])),s.r[t]=n.r,s.V[t]=n.V,s.pb[t]=n.pb,s.pv[t]=n.pv,s.Tb[t]=n.Tb}step(t){const e=this.e,s=e.grid,i=this.B,n=e.phase;n.gatherLiquid();const{n:r,kind:a}=s;for(let l=0;l<r;l+=1){if(a[l]!==lt){this.budget[l]=0,this.tsatCell[l]=0;continue}const h=Pt(e.pRef+s.pl[l]);this.tsatCell[l]=h,this.budget[l]=n.Cl[l]*(n.Tl[l]-h)}this.Fm.fill(0);const o=e.waterTemperature();if(this.bulkCold=o.mass>0&&o.mean<=Pt(e.regions.pAmb)-5,i.count>0||this.sites.count>0){this.nucleate(t);for(let l=0;l<i.count;l+=1)this.advance(l,t);this.coalesce();for(let l=i.count-1;l>=0;l-=1)this.finish(l,t)}n.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,i=this.B,n=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r];if(s.kind[a]!==lt||n.acc[a]<=0||n.waterShare(a)<.5)continue;const o=this.sites.cell[r],l=Dt[s.solid[o]-1],h=n.Tl[a],f=Gs(n.host[a],h),d=(l.k*s.T[o]+f*h)/(l.k+f),m=e.pRef+s.pl[a],u=this.tsatCell[a]>0?this.tsatCell[a]:Pt(m);if(d-u<0)continue;const v=this.sites.r[r];if(d-u<bn(v,m))continue;const p=m+2*ss(n.host[a],d)/v,x=Pt(p),w=4/3*Math.PI*v*v*v,b=Fe(x)*w;if(b*4>n.acc[a])continue;const F=this.sites.position(this.e.grid,r,v),y=i.add(F[0],F[1],Math.min(s.depth-v,Math.max(v,this.sites.z[r]*s.depth)));if(y<0)return;i.m[y*at+K]=b,i.r[y]=v,i.V[y]=w,i.Tb[y]=x,i.pb[y]=p,i.pv[y]=p,i.H[y]=b*gt(x),i.site[y]=r,i.age[y]=0,this.sites.bubble[r]=i.id[y],this.motion.ux0[y]=0,this.motion.uy0[y]=0;const A=n.waterH(a);this.Fm[a]-=b,e.heat.src[o]-=b*(gt(x)-A)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=d-u,this.firstMaterial=l.id)}}advance(t,e){const s=this.e,i=s.grid,n=this.B,r=s.phase,a=t*at;let o=n.site[t],l=0;const h=n.V[t];let f=0,d=h;for(;l<e-1e-12;){d=n.V[t];const m=n.r[t],u=Math.hypot(n.vx[t],n.vy[t]);let v=Math.min(e-l,Math.max(1e-7,To*n.age[t]),.25*i.dx/(u+1e-9));v<1e-7&&(v=Math.min(e-l,1e-7));let p,x=-1,w=0;if(o>=0){const R=this.sites.fluid[o],E=this.sites.cell[o],Y=Dt[i.solid[E]-1],B=r.Tl[R],U=Gs(r.host[R],B);p=(Y.k*i.T[E]+U*B)/(Y.k+U),x=E}else{if(w=this.liquidFootprint(t),w===0)break;p=0;for(let R=0;R<w;R+=1)p+=this.wts[R]*r.Tl[this.cells[R]]}const b=n.Tb[t],F=o>=0?r.host[this.sites.fluid[o]]:r.hostAt(n.x[t],n.y[t]),y=Gs(F,p),A=ge(F,p),_=Ps(F,p),P=gs(F,p),S=y/(A*_),L=2*m,O=n.age[t],q=y*Math.sqrt(3/(Math.PI*S)),Q=o>=0?0:Math.hypot(n.vx[t]-this.motion.ux0[t],n.vy[t]-this.motion.uy0[t]),C=A*Q*L/P,W=P*_/y,M=y/L*(2+.6*Math.sqrt(C)*Math.cbrt(W)),D=gt(b)-qt(p);let J=Math.max(q*2*(Math.sqrt(O+v)-Math.sqrt(O)),M*v);if(o>=0&&p>b){const R=.5*this.fritz(t,p),E=n.m[a+K]>0?n.m[a+K]/n.V[t]:Fe(b),Y=J*(p-b)/(E*D);if(m<R&&m+Y>R&&Y>0){const B=J*(R-m)/Y;if(M*v>=q*2*(Math.sqrt(O+v)-Math.sqrt(O)))v=B/M;else{const U=Math.sqrt(O)+B/(2*q);v=U*U-O}v=Math.max(1e-9,Math.min(e-l,v*(1+1e-6))),J=Math.max(q*2*(Math.sqrt(O+v)-Math.sqrt(O)),M*v)}}const j=i.depth,Z=n.V[t],$=n.m[a+K]>0?n.m[a+K]/Z:Fe(b),T=J*(p-b)/($*D),I=Math.max(0,m+T);let X;Z<=Math.PI*j*j*j/6?X=4/3*Math.PI*(I*I*I-m*m*m):Z>=Math.PI*j*j*j/4?X=Math.PI*j*(I*I-m*m):X=Math.PI*j*j*J*(p-b)/($*D);let V=$*X*D;if(o>=0){const R=x,E=Dt[i.solid[R]-1],Y=E.rho*E.cp*i.vCell*Math.max(0,i.T[R]-b);V>0&&(V=Math.min(V,Math.max(0,Y-this.used(R))))}else{let R=0;for(let E=0;E<w;E+=1)R+=this.wts[E]*this.budget[this.cells[E]];V>0?V=Math.min(V,Math.max(0,R)):V=Math.max(V,Math.min(0,R))}let z=V/D;z<0&&(z=Math.max(z,-n.m[a+K]));let k=1;if(o<0&&z!==0&&r.mixed){k=0;for(let R=0;R<w;R+=1)k+=this.wts[R]*r.waterShare(this.cells[R]);z*=k}if(z!==0){if(o>=0){const R=this.sites.fluid[o];z>0&&r.acc[R]+this.Fm[R]-z<0&&(z=Math.max(0,r.acc[R]+this.Fm[R]));const E=r.waterH(R);this.Fm[R]-=z,s.heat.src[x]-=z*(gt(b)-E)/e,this.budgetSolid(x,z*(gt(b)-E))}else for(let R=0;R<w;R+=1){const E=this.cells[R],Y=r.mixed?this.wts[R]*r.waterShare(E)/k:this.wts[R],B=r.waterH(E);this.Fm[E]-=z*Y,s.heat.src[E]-=z*Y*(gt(b)-B)/e,this.budget[E]-=z*Y*(gt(b)-B)}n.m[a+K]+=z,n.H[t]+=z*gt(b),f+=z}if(this.solve(t,p),this.restoreEnthalpy(t,o,w,e),n.r[t]<1e-6||n.m[a+K]<=1e-18&&n.m[a+nt]+n.m[a+rt]<=0){n.age[t]+=v;break}if(o>=0){const R=this.sites.position(this.e.grid,o,n.r[t]);n.x[t]=R[0],n.y[t]=R[1],this.departure(t,p),o=n.site[t]}else this.motion.move(t,v,(n.V[t]-d)/v);if(n.age[t]+=v,l+=v,n.m[a+K]<=0&&n.m[a+nt]+n.m[a+rt]<=0)break}n.dmdt[t]=f/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,i){const n=this.e,r=this.B,a=gn(r.m,t*at,r.Tb[t],Wt),o=a-r.H[t];if(o!==0){if(r.H[t]=a,e>=0){n.heat.src[this.sites.cell[e]]-=o/i;return}if(s!==0)for(let l=0;l<s;l+=1)n.heat.src[this.cells[l]]-=o*this.wts[l]/i}}fritz(t,e){const s=this.e,i=s.grid,n=this.B,r=n.site[t];if(r<0||s.gy<=0)return 1/0;const a=Dt[i.solid[this.sites.cell[r]]-1],o=this.contactAngleOverride??a.contactAngle,l=n.totalMass(t)/Math.max(1e-30,n.V[t]),h=s.phase.host[this.sites.fluid[r]];return Ao*o*Math.sqrt(ss(h,n.Tb[t])/(s.gy*(ge(h,e)-l)))}departure(t,e){const s=this.e,i=this.B,n=i.site[t];if(n<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*i.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[n]=0,i.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const o=this.vel;s.liquid.velocityAt(i.x[t],i.y[t],o),this.motion.ux0[t]=o[0],this.motion.uy0[t]=o[1],i.vx[t]=o[0],i.vy[t]=o[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:i,ny:n,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let l=0;l<s.count;l+=1){const h=e.cellAt(s.x[l],s.y[l]);if(h<0){this.next[l]=-1;continue}this.next[l]=this.head[h],this.head[h]=l,s.r[l]>a&&(a=s.r[l])}const o=Math.ceil(2*a/r);for(let l=0;l<s.count;l+=1){if(s.V[l]<=0)continue;const h=Math.floor(s.x[l]/r),f=Math.floor(s.y[l]/r);for(let d=Math.max(0,f-o);d<=Math.min(n-1,f+o);d+=1)for(let m=Math.max(0,h-o);m<=Math.min(i-1,h+o);m+=1)for(let u=this.head[m+d*i];u>=0;u=this.next[u]){if(u<=l||s.V[u]<=0)continue;const v=s.x[u]-s.x[l],p=s.y[u]-s.y[l],x=e.depth,b=2*s.r[l]>=x||2*s.r[u]>=x?0:s.z[u]-s.z[l],F=s.r[l]+s.r[u];v*v+p*p+b*b>=F*F||this.merge(l,u)}}}merge(t,e){const s=this.B,i=s.V[t],n=s.V[e],r=i+n;s.x[t]=(s.x[t]*i+s.x[e]*n)/r,s.y[t]=(s.y[t]*i+s.y[e]*n)/r,s.z[t]=(s.z[t]*i+s.z[e]*n)/r,s.vx[t]=(s.vx[t]*i+s.vx[e]*n)/r,s.vy[t]=(s.vy[t]*i+s.vy[e]*n)/r;for(let a=0;a<at;a+=1)s.m[t*at+a]+=s.m[e*at+a],s.m[e*at+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const i=this.e.grid,n=this.B,r=t*at,a=n.totalMass(t);if(n.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(n.r[t]<1e-6||n.m[r+K]<=1e-18&&n.m[r+nt]+n.m[r+rt]<=0){this.drop(t,!1,e);return}if(n.site[t]>=0)return;const o=i.cellAt(n.x[t],n.y[t]+n.r[t]),l=i.cellAt(n.x[t],n.y[t]);(o<0||i.kind[o]===N||l<0||i.kind[l]===N)&&this.drop(t,!0,e)}drop(t,e,s){const i=this.e,n=i.grid,r=this.B,a=t*at,o=n.n,l=r.m[a+K],h=r.m[a+nt]+r.m[a+rt];if(e||h>0){let m=n.cellAt(r.x[t],Math.min(n.h-1e-9,r.y[t]+r.r[t]));for(;m>=0&&n.kind[m]!==N;)m=m+n.nx<o?m+n.nx:-1;if(m<0&&(m=this.anyGasAbove(r.x[t])),m>=0){const u=this.gasCellsAround(m,r.V[t]);for(let v=0;v<u;v+=1){const p=this.cells[v],x=this.wts[v];for(let w=0;w<at;w+=1)n.mg[w*o+p]+=x*r.m[a+w];n.Hg[p]+=x*r.H[t],i.gas.deriveCell(p)}this.burstVapour+=l,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(l>0){const m=this.liquidFootprint(t);if(m>0){const u=i.phase;let v=1;if(u.mixed){v=0;for(let p=0;p<m;p+=1)v+=this.wts[p]*u.waterShare(this.cells[p])}for(let p=0;p<m;p+=1){const x=this.cells[p],w=u.mixed&&v>0?this.wts[p]*u.waterShare(x)/v:this.wts[p];if(w===0)continue;const b=u.waterH(x);this.Fm[x]+=l*w,i.heat.src[x]+=w*(r.H[t]-l*b)/s}}else{const u=n.cellAt(r.x[t],r.y[t]);u>=0&&(n.mg[K*o+u]+=l,n.Hg[u]+=r.H[t],i.gas.deriveCell(u))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const f=r.site[t];f>=0&&(this.sites.bubble[f]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const d=r.count-1;if(t!==d){this.motion.ux0[t]=this.motion.ux0[d],this.motion.uy0[t]=this.motion.uy0[d];const m=r.site[d];m>=0&&(this.sites.bubble[m]=r.id[d])}r.remove(t)}gasCellsAround(t,e){const s=this.e.grid,{nx:i,ny:n}=s,r=this.e.gas.vgas,a=t%i,o=(t-a)/i;let l=0,h=0;for(let f=0;f<=6&&(l===0||h<2*e);f+=1)for(let d=0;d<=f;d+=1)for(let m=-f;m<=f;m+=1){if(Math.max(Math.abs(m),d)!==f)continue;const u=a+m,v=o+d;if(u<0||v<0||u>=i||v>=n)continue;const p=u+v*i;if(s.kind[p]!==N||l>=this.cells.length)continue;const x=Math.max(.001*s.vCell,r[p]);this.cells[l]=p,this.wts[l]=x,h+=x,l+=1}for(let f=0;f<l;f+=1)this.wts[f]/=h;return l}anyGasAbove(t){const e=this.e.grid,s=Math.min(e.nx-1,Math.max(0,Math.floor(t/e.dx)));for(let i=e.ny-1;i>=0;i-=1)if(e.kind[s+i*e.nx]===N)return s+i*e.nx;return-1}updateAlpha(t){const e=this.e,s=e.grid,i=this.B,n=this.alphaTarget;n.fill(0);const r=1/s.vCell;for(let h=0;h<i.count;h+=1){const f=vn(i.x[h],i.y[h],i.r[h],i.V[h],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let d=0;d<f;d+=1)n[this.cells[d]]+=this.wts[d]*i.V[h]*r}const a=s.alpha,o=e.liquid.volSrc,l=Pr*t;for(let h=0;h<s.n;h+=1){const f=n[h]-a[h];f!==0&&(f>l?(o[h]+=l*s.vCell/t,a[h]+=l):f<-l?(o[h]-=l*s.vCell/t,a[h]-=l):(o[h]+=f*s.vCell/t,a[h]=n[h]))}}spawn(t,e,s,i,n){const r=this.e,a=this.B,o=a.add(t,e,s);if(o<0)return-1;const l=this.pressure(t,e),h=r.grid.cellAt(t,e),f=h>=0&&r.phase.Tl[h]>0?r.phase.Tl[h]:r.ambientT,d=l+2*ss(h>=0?r.phase.host[h]:0,f)/i,m=4/3*Math.PI*i*i*i,u=o*at;if(n<=0){const v=Pt(d);a.m[u+K]=Fe(v)*m}else{const v=d*m/(8.314462618*f);a.m[u+nt]=v*.79*ut[nt],a.m[u+rt]=v*.21*ut[rt]}return a.r[o]=i,this.solve(o,f),a.H[o]=gn(a.m,u,a.Tb[o],Wt),r.ledger.water+=a.m[u+K],r.ledger.air+=a.m[u+nt]+a.m[u+rt],r.ledger.energy+=a.H[o],this.motion.ux0[o]=0,this.motion.uy0[o]=0,o}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*at,i=t*zt;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:Pt(e.pb[t]),mv:e.m[s+K],ma:e.m[s+nt]+e.m[s+rt],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(i,i+zt))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ht}}function yn(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0,escapedOther:0,editOther:0}}function So(c,t,e,s,i,n){const r=c.n;let a=0,o=0,l=0,h=0,f=0,d=0;for(let y=0;y<r;y+=1){if(c.kind[y]===ht||c.solid[y]!==0){a+=c.Es[y],f+=c.film[y];continue}o+=c.Hg[y],l+=c.mg[K*r+y],h+=c.mfog[y],d+=c.mg[nt*r+y]+c.mg[rt*r+y]}let m=0,u=0,v=0;for(let y=0;y<t.count;y+=1)m+=t.mass[y]*t.h[y],t.mat[y]===pt?u+=t.mass[y]:v+=t.mass[y];let p=0,x=0;for(let y=0;y<e.count;y+=1)p+=e.H[y],x+=e.m[y*at+K],d+=e.m[y*at+nt]+e.m[y*at+rt];const w=s.pvTerm();n.solids=a,n.liquid=m,n.gas=o,n.bubbles=p,n.pv=w,n.energy=a+m+o+p+w;const b=n.water;b.liquid=u,b.vapour=l,b.fog=h,b.film=f,b.bubbles=x,b.escaped=i.escapedWater,b.total=u+l+h+f+x+i.escapedWater;const F=n.other;return F.liquid=v,F.escaped=i.escapedOther,F.total=v+i.escapedOther,n.air=d+i.escapedAir,n}function Mo(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0},other:{liquid:0,escaped:0,total:0}}}const wn=c=>typeof c=="number"&&Number.isFinite(c)?c:null;function Bs(c){if(c===null||typeof c!="object")return null;const t=c,e=(a,o)=>{if(!Array.isArray(a)||a.length!==o)return null;const l=a.map(wn);return l.every(h=>h!==null)?l:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const i=e(t.circle,3);if(i!==null&&i[2]>0)return{circle:[i[0],i[1],i[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(o=>e(o,2));if(a.every(o=>o!==null))return{poly:a.map(o=>[o[0],o[1]])}}const n=e(t.line,4),r=wn(t.width);return n!==null&&r!==null&&r>0?{line:[n[0],n[1],n[2],n[3]],width:r}:null}function Ee(c,t,e){if("rect"in c){const[m,u,v,p]=c.rect;return t>=m&&t<=v&&e>=u&&e<=p}if("circle"in c){const[m,u,v]=c.circle;return(t-m)*(t-m)+(e-u)*(e-u)<=v*v}if("poly"in c){const m=c.poly;let u=!1;for(let v=0,p=m.length-1;v<m.length;p=v,v+=1){const[x,w]=m[v],[b,F]=m[p];w>e!=F>e&&t<(b-x)*(e-w)/(F-w)+x&&(u=!u)}return u}const[s,i,n,r]=c.line,a=n-s,o=r-i,l=a*a+o*o,h=l>0?Math.max(0,Math.min(1,((t-s)*a+(e-i)*o)/l)):0,f=t-(s+h*a),d=e-(i+h*o);return f*f+d*d<=.25*c.width*c.width}function Tr(c){if("rect"in c)return[c.rect[0],c.rect[1],c.rect[2],c.rect[3]];if("circle"in c){const[r,a,o]=c.circle;return[r-o,a-o,r+o,a+o]}if("poly"in c){let r=1/0,a=1/0,o=-1/0,l=-1/0;for(const[h,f]of c.poly)r=Math.min(r,h),a=Math.min(a,f),o=Math.max(o,h),l=Math.max(l,f);return[r,a,o,l]}const t=c.width/2,[e,s,i,n]=c.line;return[Math.min(e,i)-t,Math.min(s,n)-t,Math.max(e,i)+t,Math.max(s,n)+t]}function js(c){return"rect"in c?{rect:[...c.rect]}:"circle"in c?{circle:[...c.circle]}:"poly"in c?{poly:c.poly.map(t=>[t[0],t[1]])}:{line:[...c.line],width:c.width}}function $s(c,t,e){const[s,i,n,r]=Tr(t),a=Math.max(0,Math.floor(s/c.dx)),o=Math.min(c.nx-1,Math.ceil(n/c.dx)),l=Math.max(0,Math.floor(i/c.dx)),h=Math.min(c.ny-1,Math.ceil(r/c.dx));for(let f=l;f<=h;f+=1)for(let d=a;d<=o;d+=1)Ee(t,(d+.5)*c.dx,(f+.5)*c.dx)&&e(d+f*c.nx,d,f)}function ci(c,t){const e=c.grid,s=e.n;c.ledger.water-=e.mg[K*s+t]+e.mfog[t],c.ledger.air-=e.mg[nt*s+t]+e.mg[rt*s+t],c.ledger.energy-=e.Hg[t];for(let i=0;i<at;i+=1)e.mg[i*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function sn(c,t,e,s){const i=c.grid,n=i.n;ci(c,t),c.gas.fillCell(t,e,s,Math.max(.001,1-i.phi[t]-i.alpha[t])),c.ledger.water+=i.mg[K*n+t],c.ledger.air+=i.mg[nt*n+t]+i.mg[rt*n+t],c.ledger.energy+=i.Hg[t]}function si(c,t){const e=c.particles;e.mat[t]===pt?c.ledger.water-=e.mass[t]:c.ledger.other-=e.mass[t],c.ledger.energy-=e.mass[t]*e.h[t]}function pi(c,t){const e=c.particles;for(let i=0;i<e.count;i+=1)Ee(t,e.x[i],e.y[i])&&(si(c,i),c.liquid.removeParticle(i),i-=1);const s=c.bubbles;for(let i=0;i<s.count;i+=1)Ee(t,s.x[i],s.y[i])&&(c.ledger.water-=s.m[i*at+K],c.ledger.air-=s.m[i*at+nt]+s.m[i*at+rt],c.ledger.energy-=s.H[i],s.remove(i),i-=1);c.liquid.weightsDirty=!0}function gi(c,t,e,s,i){const n=c.grid,r=Dt[e];for(const o of t)n.solid[o]!==0?(c.ledger.energy-=n.Es[o],c.ledger.water-=n.film[o]):ci(c,o),n.solid[o]=e+1,n.role[o]=i>=0?1:0,n.heater[o]=i,n.film[o]=0,n.T[o]=s,n.Es[o]=r.rho*r.cp*n.vCell*(s-mt),n.kind[o]=ht,c.ledger.energy+=n.Es[o];const a=c.particles;for(let o=0;o<a.count;o+=1){const l=n.cellAt(a.x[o],a.y[o]);l<0||n.solid[l]===0||(si(c,o),c.liquid.removeParticle(o),o-=1)}c.solidsChanged()}function Lo(c,t){const e=c.grid;let s=!1;for(const i of t)e.solid[i]!==0&&(s=!0,c.ledger.energy-=e.Es[i],c.ledger.water-=e.film[i],e.solid[i]=0,e.role[i]=0,e.heater[i]=-1,e.Es[i]=0,e.film[i]=0,e.kind[i]=0);if(s){c.solidsChanged();for(const i of t)e.solid[i]===0&&c.gas.massOf(i)<=0&&sn(c,i,c.ambientT,c.ambientY)}}const ms=(c,t,e,s,i)=>{const n=[],r=Math.max(0,Math.round(t/c.dx)),a=Math.min(c.nx,Math.max(r+1,Math.round(s/c.dx))),o=Math.max(0,Math.round(e/c.dx)),l=Math.min(c.ny,Math.max(o+1,Math.round(i/c.dx)));for(let h=o;h<l;h+=1)for(let f=r;f<a;f+=1)n.push(f+h*c.nx);return n};function Co(c,t){const e=c.grid;switch(t.op){case"fill":{if(t.phase==="gas"){pi(c,t.region);const f=new Float64Array(at);let d=0;for(const[m,u]of Object.entries(t.composition)){const v=m==="N2"?nt:m==="O2"?rt:m==="H2O"?K:-1;v>=0&&(f[v]=u,d+=u)}if(d<=0)f.set(c.ambientY.subarray(0,at));else for(let m=0;m<dt;m+=1)f[m]/=d;return $s(e,t.region,m=>{e.solid[m]===0&&sn(c,m,t.T,f)}),null}pi(c,t.region);const s=re.length,i=new Float64Array(s);let n=0;for(const[f,d]of Object.entries(t.composition)){const m=dr(f);m<0||!(d>0)||(i[m]+=d/ge(m,t.T),n+=d/ge(m,t.T))}if(n<=0)return"fill: no known liquid in the composition";for(let f=0;f<s;f+=1)i[f]/=n;const r=new Float64Array(s),a=new Float64Array(s);for(let f=0;f<s;f+=1)r[f]=ge(f,t.T)*e.vCell/4,a[f]=ho(f,t.T);const o=new Float64Array(s),l=c.particles;let h=!1;return Bo(e,t.region,(f,d)=>{const m=f+d*e.nx;if(e.solid[m]!==0)return;let u=0;for(let v=0;v<2;v+=1)for(let p=0;p<2;p+=1){const x=(f+.25+.5*p)*e.dx,w=(d+.25+.5*v)*e.dx;if(!Ee(t.region,x,w))continue;let b=0;for(let A=0;A<s;A+=1)o[A]+=i[A],o[A]>o[b]&&(b=A);o[b]-=1;const F=r[b],y=a[b];if(l.add(x,w,F,y,b)<0){h=!0;continue}u+=1,b===pt?c.ledger.water+=F:c.ledger.other+=F,c.ledger.energy+=F*y}u===4&&ci(c,m)}),c.liquid.weightsDirty=!0,h?"fill: particle capacity reached":null}case"erase":{pi(c,t.region);const s=[];return $s(e,t.region,i=>s.push(i)),Lo(c,s),null}case"move":return Oo(c,t.region,Math.round(t.dx/e.dx),Math.round(t.dy/e.dx)),null;case"solid":{const s=Ns(t.material);if(s<0)return`solid: unknown material ${t.material}`;const i=[];if($s(e,t.region,n=>i.push(n)),i.length===0&&"line"in t.region){const[n,r,a,o]=t.region.line,l=Math.ceil(Math.hypot(a-n,o-r)/(.5*e.dx))+1;for(let h=0;h<=l;h+=1){const f=e.cellAt(n+(a-n)*h/l,r+(o-r)*h/l);f>=0&&!i.includes(f)&&i.push(f)}}return gi(c,i,s,t.T,-1),null}case"beaker":{const s=Ns(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const i=Math.max(e.dx,t.wall),n=t.x-t.w/2,r=t.x+t.w/2,a=t.y,o=t.y+t.h,l=[...ms(e,n,a,n+i,o),...ms(e,r-i,a,r,o),...ms(e,n,a,r,a+i),...t.lid?ms(e,n,o-i,r,o):[]];return gi(c,[...new Set(l)],s,t.T,-1),null}case"hotplate":{const s=Ns(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const i=c.heat.heaters.length;return c.heat.heaters.push({group:i,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0}),gi(c,ms(e,t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h),s,t.T,i),null}}}function Oo(c,t,e,s){const i=c.grid,{nx:n,ny:r,dx:a}=i;if(e===0&&s===0)return;const o=[];$s(i,t,u=>{i.solid[u]!==0&&o.push(u)});const l=c.particles,h=c.bubbles,f=e*a,d=s*a;for(let u=0;u<l.count;u+=1){if(!Ee(t,l.x[u],l.y[u]))continue;const v=l.x[u]+f,p=l.y[u]+d;if(v<=0||p<=0||v>=i.w||p>=i.h){si(c,u),c.liquid.removeParticle(u),u-=1;continue}l.x[u]=v,l.y[u]=p}for(let u=0;u<h.count;u+=1)Ee(t,h.x[u],h.y[u])&&(h.x[u]=Math.min(i.w-1e-6,Math.max(1e-6,h.x[u]+f)),h.y[u]=Math.min(i.h-1e-6,Math.max(1e-6,h.y[u]+d)),h.site[u]=-1);if(c.liquid.weightsDirty=!0,o.length===0)return;const m=o.map(u=>({c:u,s:i.solid[u],role:i.role[u],heater:i.heater[u],T:i.T[u],Es:i.Es[u],film:i.film[u]}));for(const u of m)c.ledger.energy-=u.Es,c.ledger.water-=u.film,i.solid[u.c]=0,i.role[u.c]=0,i.heater[u.c]=-1,i.Es[u.c]=0,i.film[u.c]=0,i.kind[u.c]=0;for(const u of m){const v=u.c%n+e,p=Math.floor(u.c/n)+s;if(v<0||p<0||v>=n||p>=r)continue;const x=v+p*n;i.solid[x]!==0?(c.ledger.energy-=i.Es[x],c.ledger.water-=i.film[x]):ci(c,x),i.solid[x]=u.s,i.role[x]=u.role,i.heater[x]=u.heater,i.T[x]=u.T,i.Es[x]=u.Es,i.film[x]=u.film,i.kind[x]=ht,c.ledger.energy+=u.Es,c.ledger.water+=u.film}for(let u=0;u<l.count;u+=1){const v=i.cellAt(l.x[u],l.y[u]);v<0||i.solid[v]===0||(si(c,u),c.liquid.removeParticle(u),u-=1)}c.solidsChanged();for(const u of m)i.solid[u.c]===0&&c.gas.massOf(u.c)<=0&&sn(c,u.c,c.ambientT,c.ambientY)}function Bo(c,t,e){const[s,i,n,r]=Tr(t),a=Math.max(0,Math.floor(s/c.dx)),o=Math.min(c.nx-1,Math.floor(n/c.dx)),l=Math.max(0,Math.floor(i/c.dx)),h=Math.min(c.ny-1,Math.floor(r/c.dx));for(let f=l;f<=h;f+=1)for(let d=a;d<=o;d+=1)e(d,f)}const Lt=dt+2,$t=dt,Xt=dt+1,jo=.9,Ro=16;class xs{constructor(t,e){g(this,"g");g(this,"gas");g(this,"conc");g(this,"fu");g(this,"fv");g(this,"outM");g(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(Lt*s),this.fu=new Float64Array(Lt*t.nu),this.fv=new Float64Array(Lt*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:i,n,kind:r,dx:a}=e,o=s+1,l=e.ug,h=e.vg;let f=0,d=0;for(let F=0;F<i;F+=1)for(let y=0;y<s;y+=1){const A=y+F*s;if(r[A]!==N)continue;const _=y+F*o,P=l[_],S=l[_+1],L=h[A],O=h[A+s],q=(P<0?-P:0)+(S>0?S:0)+(L<0?-L:0)+(O>0?O:0);q>f&&(f=q);const Q=Math.max(P<0?-P:P,S<0?-S:S,L<0?-L:L,O<0?-O:O);Q>d&&(d=Q)}this.gas.last.uMax=d;const m=Math.min(Ro,Math.max(1,Math.ceil(f*t/a/jo))),u=t/m,{conc:v}=this,p=this.gas.vgas,x=e.mg,w=e.mfog,b=e.Hg;for(let F=0;F<m;F+=1){for(let y=0;y<n;y+=1){if(r[y]!==N){for(let _=0;_<Lt;_+=1)v[_*n+y]=0;continue}const A=1/p[y];for(let _=0;_<dt;_+=1)v[_*n+y]=x[_*n+y]*A;v[$t*n+y]=w[y]*A,v[Xt*n+y]=b[y]*A}this.fluxesU(u),this.fluxesV(u),this.limitOutflow(),this.applyFluxes()}for(let F=0;F<n;F+=1)r[F]===N&&this.gas.deriveCell(F);return this.gas.last.substeps=m,m}static face(t,e,s){const i=t-e,n=s-t;return i*n>0?t+i*n/(i+n):t}fluxesU(t){const e=this.g,{nx:s,ny:i,n,kind:r}=e,a=s+1,o=e.nu,l=e.ug,{conc:h,fu:f}=this,{amb:d,gasU:m}=this.gas,u=e.aFace,v=xs.face;for(let p=0;p<i;p+=1){const x=p*s,w=p*a;for(let b=0;b<=s;b+=1){const F=w+b,y=l[F];if(m[F]===0||y===0){for(let L=0;L<Lt;L+=1)f[L*o+F]=0;continue}const A=y*u*t;if(b===0||b===s){const L=b===0?x:x+s-1,O=b===0?y>0:y<0;for(let q=0;q<Lt;q+=1)f[q*o+F]=A*(O?d[q]:h[q*n+L]);continue}let _,P,S;if(y>0?(_=x+b-1,P=x+b,S=b>=2&&r[x+b-2]===N?x+b-2:-1):(_=x+b,P=x+b-1,S=b+1<s&&r[x+b+1]===N?x+b+1:-1),S<0){for(let L=0;L<Lt;L+=1)f[L*o+F]=A*h[L*n+_];continue}for(let L=0;L<Lt;L+=1){const O=L*n;f[L*o+F]=A*v(h[O+_],h[O+S],h[O+P])}}}}fluxesV(t){const e=this.g,{nx:s,ny:i,n,kind:r}=e,a=e.nv,o=e.vg,{conc:l,fv:h}=this,{amb:f,gasV:d}=this.gas,m=e.aFace,u=xs.face;for(let v=0;v<=i;v+=1){const p=v*s;for(let x=0;x<s;x+=1){const w=p+x,b=o[w];if(d[w]===0||b===0){for(let P=0;P<Lt;P+=1)h[P*a+w]=0;continue}const F=b*m*t;if(v===0||v===i){const P=v===0?x:x+(i-1)*s,S=v===0?b>0:b<0;for(let L=0;L<Lt;L+=1)h[L*a+w]=F*(S?f[L]:l[L*n+P]);continue}let y,A,_;if(b>0?(y=w-s,A=w,_=v>=2&&r[w-2*s]===N?w-2*s:-1):(y=w,A=w-s,_=v+1<i&&r[w+s]===N?w+s:-1),_<0){for(let P=0;P<Lt;P+=1)h[P*a+w]=F*l[P*n+y];continue}for(let P=0;P<Lt;P+=1){const S=P*n;h[P*a+w]=F*u(l[S+y],l[S+_],l[S+A])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n:i}=t,n=e+1,r=t.nu,a=t.nv,{fu:o,fv:l}=this,{gasU:h,gasV:f,escaped:d}=this.gas,m=t.mg,u=t.mfog,v=t.Hg;for(let p=0;p<s;p+=1){const x=p*e,w=p*n;for(let F=1;F<e;F+=1){const y=w+F;if(h[y]===0)continue;const A=x+F-1,_=A+1;for(let L=0;L<dt;L+=1){const O=o[L*r+y];m[L*i+A]-=O,m[L*i+_]+=O}const P=o[$t*r+y];u[A]-=P,u[_]+=P;const S=o[Xt*r+y];v[A]-=S,v[_]+=S}if(h[w]!==0){const F=x;for(let _=0;_<dt;_+=1){const P=o[_*r+w];m[_*i+F]+=P,d[_]-=P}const y=o[$t*r+w];u[F]+=y,d[$t]-=y;const A=o[Xt*r+w];v[F]+=A,d[Xt]-=A}const b=w+e;if(h[b]!==0){const F=x+e-1;for(let _=0;_<dt;_+=1){const P=o[_*r+b];m[_*i+F]-=P,d[_]+=P}const y=o[$t*r+b];u[F]-=y,d[$t]+=y;const A=o[Xt*r+b];v[F]-=A,d[Xt]+=A}}for(let p=1;p<s;p+=1){const x=p*e;for(let w=0;w<e;w+=1){const b=x+w;if(f[b]===0)continue;const F=b-e,y=b;for(let P=0;P<dt;P+=1){const S=l[P*a+b];m[P*i+F]-=S,m[P*i+y]+=S}const A=l[$t*a+b];u[F]-=A,u[y]+=A;const _=l[Xt*a+b];v[F]-=_,v[y]+=_}}for(let p=0;p<e;p+=1){if(f[p]!==0){const w=p;for(let y=0;y<dt;y+=1){const A=l[y*a+p];m[y*i+w]+=A,d[y]-=A}const b=l[$t*a+p];u[w]+=b,d[$t]-=b;const F=l[Xt*a+p];v[w]+=F,d[Xt]-=F}const x=p+s*e;if(f[x]!==0){const w=p+(s-1)*e;for(let y=0;y<dt;y+=1){const A=l[y*a+x];m[y*i+w]-=A,d[y]+=A}const b=l[$t*a+x];u[w]-=b,d[$t]+=b;const F=l[Xt*a+x];v[w]-=F,d[Xt]+=F}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n:i}=t,n=e+1,{fu:r,fv:a,outM:o,scale:l}=this,h=t.nu,f=t.nv;o.fill(0);const d=xs.massFlux,{gasU:m,gasV:u}=this.gas;for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*n;if(m[w]===0)continue;const b=d(r,h,w);b>0&&x>0?o[x-1+p*e]+=b:b<0&&x<e&&(o[x+p*e]-=b)}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(u[w]===0)continue;const b=d(a,f,w);b>0&&p>0?o[x+(p-1)*e]+=b:b<0&&p<s&&(o[x+p*e]-=b)}let v=!1;for(let p=0;p<i;p+=1){const x=.9*this.gas.massOf(p);l[p]=o[p]>x&&o[p]>0?x/o[p]:1,l[p]<1&&(v=!0)}if(v){for(let p=0;p<s;p+=1)for(let x=0;x<=e;x+=1){const w=x+p*n;if(m[w]===0)continue;const F=d(r,h,w)>0?x>0?x-1+p*e:-1:x<e?x+p*e:-1;if(!(F<0||l[F]>=1))for(let y=0;y<Lt;y+=1)r[y*h+w]*=l[F]}for(let p=0;p<=s;p+=1)for(let x=0;x<e;x+=1){const w=x+p*e;if(u[w]===0)continue;const F=d(a,f,w)>0?p>0?x+(p-1)*e:-1:p<s?x+p*e:-1;if(!(F<0||l[F]>=1))for(let y=0;y<Lt;y+=1)a[y*f+w]*=l[F]}}}static massFlux(t,e,s){let i=0;for(let n=0;n<=$t;n+=1)i+=t[n*e+s];return i}}const Vt=.05;class qo{constructor(t,e,s){g(this,"g");g(this,"R");g(this,"solver");g(this,"vgas");g(this,"rho");g(this,"nmol");g(this,"cap");g(this,"mu");g(this,"veos");g(this,"srcV");g(this,"veosMid");g(this,"mover");g(this,"gasU");g(this,"gasV");g(this,"u0");g(this,"v0");g(this,"u1");g(this,"v1");g(this,"lim");g(this,"amb",new Float64Array(Lt));g(this,"ambT",293.15);g(this,"escaped",new Float64Array(Lt));g(this,"dp0",new Float64Array(8));g(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});g(this,"lo",0);g(this,"hi",0);this.g=t,this.R=e,this.solver=s;const i=t.n;this.vgas=new Float64Array(i),this.rho=new Float64Array(i),this.nmol=new Float64Array(i),this.cap=new Float64Array(i),this.mu=new Float64Array(i),this.veos=new Float64Array(i),this.srcV=new Float64Array(i),this.veosMid=new Float64Array(i),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new xs(t,this)}setAmbient(t,e,s){let i=0;for(let a=0;a<dt;a+=1)i+=s[a]/ut[a];const n=e/(Et*t*i);let r=0;for(let a=0;a<dt;a+=1)this.amb[a]=n*s[a],r+=n*s[a]*Wt(a,t);this.amb[$t]=0,this.amb[Xt]=r,this.ambT=t}enthalpy(t,e){const s=this.g,i=s.n;let n=s.mfog[t]*qt(e);for(let r=0;r<dt;r+=1)n+=s.mg[r*i+t]*Wt(r,e);return n}heatCapacity(t,e){const s=this.g,i=s.n;return Ei(s.mg[t],s.mg[i+t],s.mg[K*i+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,i=Math.max(.001,1-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=i;const n=e.mg[t],r=e.mg[s+t],a=e.mg[K*s+t],o=e.mfog[t],l=n+r+a;if(this.nmol[t]=n/ut[0]+r/ut[1]+a/ut[K],l+o<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let h;if(o<=0)h=fr(n,r,a,e.Hg[t]);else{h=e.T[t]>100?e.T[t]:this.ambT;for(let f=0;f<4;f+=1){const d=(e.Hg[t]-this.enthalpy(t,h))/this.heatCapacity(t,h);if(h+=d,Math.abs(d)<1e-10)break}}h>150&&h<3e3||(h=Math.min(3e3,Math.max(150,Number.isFinite(h)?h:this.ambT))),e.T[t]=h,this.cap[t]=Ei(n,r,a,o,h),this.rho[t]=l/i,this.mu[t]=co(n,r,a,h)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ht){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===lt&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Et*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ht){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const i=t.mg[s]+t.mg[e+s]+t.mg[K*e+s];if(t.kind[s]===lt&&i+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const n=Math.max(.001,1-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=n,this.rho[s]=i/n,this.veos[s]=this.nmol[s]*Et*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ht||this.vgas[e]<=0?0:this.nmol[e]*Et*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let i=0;i<dt;i+=1)s+=e.mg[i*e.n+t];return s}fillCell(t,e,s,i=1){const n=this.g,r=n.n,a=Math.max(.001,i)*n.vCell;let o=0;for(let f=0;f<dt;f+=1)o+=s[f]/ut[f];const l=this.R.pAt(t)*a/(Et*e*o);let h=0;for(let f=0;f<dt;f+=1)n.mg[f*r+t]=l*s[f],h+=l*s[f]*Wt(f,e);n.mfog[t]=0,n.Hg[t]=h,n.T[t]=e}transitions(t){const e=this.g,{nx:s,ny:i,n,kind:r}=e;let a=0;for(let o=0;o<n;o+=1){const l=t[o],h=r[o];if(l===h||h===ht||l===ht)continue;a+=1;const f=o%s,d=(o-f)/s;let m=0;for(let u=0;u<4;u+=1){const v=u===0?f>0?o-1:-1:u===1?f<s-1?o+1:-1:u===2?d>0?o-s:-1:d<i-1?o+s:-1;v>=0&&r[v]===N&&t[v]===N&&(m+=this.vgas[v]>0?this.vgas[v]:e.vCell)}if(!(m<=0)){if(h===lt)for(let u=0;u<4;u+=1){const v=u===0?f>0?o-1:-1:u===1?f<s-1?o+1:-1:u===2?d>0?o-s:-1:d<i-1?o+s:-1;if(v<0||r[v]!==N||t[v]!==N)continue;const p=(this.vgas[v]>0?this.vgas[v]:e.vCell)/m;this.move(o,v,p)}else{let u=this.massOf(o),v=0;for(let p=0;p<4;p+=1){const x=p===0?f>0?o-1:-1:p===1?f<s-1?o+1:-1:p===2?d>0?o-s:-1:d<i-1?o+s:-1;if(x<0||r[x]!==N||t[x]!==N)continue;const w=(this.vgas[x]>0?this.vgas[x]:e.vCell)/m;v+=w*this.rho[x]}if(v*=Math.max(.001,1-e.phi[o]-e.alpha[o])*e.vCell,v<=u)continue;for(let p=0;p<4;p+=1){const x=p===0?f>0?o-1:-1:p===1?f<s-1?o+1:-1:p===2?d>0?o-s:-1:d<i-1?o+s:-1;if(x<0||r[x]!==N||t[x]!==N)continue;const w=(this.vgas[x]>0?this.vgas[x]:e.vCell)/m,b=this.massOf(x);if(b<=0)continue;const F=Math.min(.25,(v-u)*w/b);this.move(x,o,F)}u=this.massOf(o),u>0&&(e.T[o]=this.ambT)}this.deriveCell(o)}}return a}move(t,e,s){const i=this.g,n=i.n;for(let o=0;o<dt;o+=1){const l=i.mg[o*n+t]*s;i.mg[o*n+t]-=l,i.mg[o*n+e]+=l}const r=i.mfog[t]*s;i.mfog[t]-=r,i.mfog[e]+=r;const a=i.Hg[t]*s;i.Hg[t]-=a,i.Hg[e]+=a,i.T[e]<100&&(i.T[e]=i.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:i}=t,n=e+1,r=t.ug,a=t.vg;for(let o=0;o<s;o+=1)for(let l=0;l<=e;l+=1){const h=l+o*n,f=l>0?i[l-1+o*e]:-1,d=l<e?i[l+o*e]:-1;let m=0;(f===N&&d===N||l===0&&t.openL&&d===N||l===e&&t.openR&&f===N)&&(m=1),this.gasU[h]=m,m===0&&(r[h]=f===lt||d===lt?f===ht||d===ht||l===0&&!t.openL||l===e&&!t.openR?0:t.ul[h]:0)}for(let o=0;o<=s;o+=1)for(let l=0;l<e;l+=1){const h=l+o*e,f=o>0?i[l+(o-1)*e]:-1,d=o<s?i[l+o*e]:-1;let m=0;(f===N&&d===N||o===0&&t.openB&&d===N||o===s&&t.openT&&f===N)&&(m=1),this.gasV[h]=m,m===0&&(a[h]=f===lt||d===lt?f===ht||d===ht||o===0&&!t.openB||o===s&&!t.openT?0:t.vl[h]:0)}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const i=this.g,{nx:n,ny:r,dx:a}=i,o=n+1,l=Math.min(n-1e-6,Math.max(0,e/a)),h=Math.min(r-1.000001,Math.max(0,s/a-.5)),f=Math.floor(l),d=Math.floor(h),m=l-f,u=h-d,v=t[f+d*o],p=t[f+1+d*o],x=t[f+(d+1)*o],w=t[f+1+(d+1)*o];return this.lo=Math.min(v,p,x,w),this.hi=Math.max(v,p,x,w),(1-u)*((1-m)*v+m*p)+u*((1-m)*x+m*w)}sampleV(t,e,s){const i=this.g,{nx:n,ny:r,dx:a}=i,o=Math.min(n-1.000001,Math.max(0,e/a-.5)),l=Math.min(r-1e-6,Math.max(0,s/a)),h=Math.floor(o),f=Math.floor(l),d=o-h,m=l-f,u=t[h+f*n],v=t[h+1+f*n],p=t[h+(f+1)*n],x=t[h+1+(f+1)*n];return this.lo=Math.min(u,v,p,x),this.hi=Math.max(u,v,p,x),(1-m)*((1-d)*u+d*v)+m*((1-d)*p+d*x)}velocity(t,e){const s=this.g,{nx:i,ny:n,dx:r,kind:a}=s,o=i+1,l=s.ug,h=s.vg,{u0:f,v0:d,u1:m,v1:u}=this,v=this.lim;f.set(l),d.set(h);for(let b=0;b<n;b+=1)for(let F=0;F<=i;F+=1){const y=F+b*o;if(this.gasU[y]===0){m[y]=f[y];continue}const A=F*r,_=(b+.5)*r,P=this.sampleV(d,A,_);m[y]=this.sampleU(f,A-t*f[y],_-t*P),v[2*y]=this.lo,v[2*y+1]=this.hi}const p=2*s.nu;for(let b=0;b<=n;b+=1)for(let F=0;F<i;F+=1){const y=F+b*i;if(this.gasV[y]===0){u[y]=d[y];continue}const A=(F+.5)*r,_=b*r,P=this.sampleU(f,A,_);u[y]=this.sampleV(d,A-t*P,_-t*d[y]),v[p+2*y]=this.lo,v[p+2*y+1]=this.hi}for(let b=0;b<n;b+=1)for(let F=0;F<=i;F+=1){const y=F+b*o;if(this.gasU[y]===0)continue;const A=F*r,_=(b+.5)*r,P=this.sampleV(d,A,_),S=this.sampleU(m,A+t*f[y],_+t*P);let L=m[y]+.5*(f[y]-S);(L<v[2*y]||L>v[2*y+1])&&(L=m[y]),l[y]=L}for(let b=0;b<=n;b+=1)for(let F=0;F<i;F+=1){const y=F+b*i;if(this.gasV[y]===0)continue;const A=(F+.5)*r,_=b*r,P=this.sampleU(f,A,_),S=this.sampleV(u,A+t*P,_+t*d[y]);let L=u[y]+.5*(d[y]-S);(L<v[p+2*y]||L>v[p+2*y+1])&&(L=u[y]),h[y]=L}const x=this.R;for(let b=0;b<=n;b+=1)for(let F=0;F<i;F+=1){const y=F+b*i;if(this.gasV[y]===0)continue;const A=b>0?F+(b-1)*i:-1,_=b<n?F+b*i:-1,P=A>=0&&a[A]===N?this.rho[A]:-1,S=_>=0&&a[_]===N?this.rho[_]:-1,L=Math.max(Vt,P>0&&S>0?.5*(P+S):Math.max(P,S));if(!(P>0||S>0))continue;const O=P>0?A:_,q=x.id[O],Q=q>=0?x.rhoBar[q]:x.rhoAmb;h[y]-=t*e*(L-Q)/L}m.set(l),u.set(h);const w=t/(r*r);for(let b=0;b<n;b+=1)for(let F=0;F<=i;F+=1){const y=F+b*o;if(this.gasU[y]===0)continue;const A=F<i&&a[F+b*i]===N?F+b*i:F-1+b*i,_=this.mu[A]/Math.max(Vt,this.rho[A]),P=m[y],S=F<i?m[y+1]:P,L=F>0?m[y-1]:P,O=b>0?m[y-o]:s.openB?P:-P,q=b<n-1?m[y+o]:s.openT?P:-P;l[y]=P+Math.min(.2,w*_)*(S+L+O+q-4*P)}for(let b=0;b<=n;b+=1)for(let F=0;F<i;F+=1){const y=F+b*i;if(this.gasV[y]===0)continue;const A=b<n&&a[F+b*i]===N?F+b*i:F+(b-1)*i,_=this.mu[A]/Math.max(Vt,this.rho[A]),P=u[y],S=b<n?u[y+i]:P,L=b>0?u[y-i]:P,O=F>0?u[y-1]:s.openL?P:-P,q=F<i-1?u[y+1]:s.openR?P:-P;h[y]=P+Math.min(.2,w*_)*(q+O+L+S-4*P)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let i=0;i<e.n;i+=1){if(e.kind[i]!==N){e.Sg[i]=0;continue}const n=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[i]-this.vgas[i])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[i]));e.Sg[i]=(n+r)*s}}project(t,e,s){const i=this.g,{nx:n,ny:r,dx:a,kind:o}=i,l=n+1,h=i.ug,f=i.vg;let d=n,m=-1,u=r,v=-1,p=0;for(let _=0;_<r;_+=1)for(let P=0;P<n;P+=1)o[P+_*n]===N&&(p+=1,P<d&&(d=P),P>m&&(m=P),_<u&&(u=_),_>v&&(v=_));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=p,p===0)return this.last;const w=this.solver,b=w.begin(m-d+1,v-u+1),F=this.rho;for(let _=u;_<=v;_+=1)for(let P=d;P<=m;P+=1){const S=P+_*n;if(o[S]!==N)continue;const L=w.at(P-d,_-u);b.act[L]=1,b.x[L]=i.pg[S];const O=P+_*l,q=P+_*n,Q=h[O+1]-h[O]+f[q+n]-f[q];b.b[L]=i.Sg[S]*a*a-a*Q;const C=Math.max(Vt,F[S]);P+1<n?o[S+1]===N&&P+1<=m&&(b.ax[L]=2*t/(C+Math.max(Vt,F[S+1]))):i.openR&&(b.dDx[L]+=2*t/C),P===0&&i.openL&&(b.dDx[L]+=2*t/C),_+1<r?o[S+n]===N&&_+1<=v&&(b.ay[L]=2*t/(C+Math.max(Vt,F[S+n]))):i.openT&&(b.dDy[L]+=2*t/C),_===0&&i.openB&&(b.dDy[L]+=2*t/C)}const y=w.solve(e,s,!0);x.iterations=y.iterations,x.residual=y.residual,x.capped=y.capped;const A=i.pg;for(let _=0;_<i.n;_+=1)o[_]!==N&&(A[_]=0);for(let _=u;_<=v;_+=1)for(let P=d;P<=m;P+=1){const S=P+_*n;o[S]===N&&(A[S]=b.x[w.at(P-d,_-u)])}for(let _=0;_<r;_+=1)for(let P=0;P<=n;P+=1){const S=P+_*l;if(this.gasU[S]===0)continue;if(P===0){h[S]-=2*t/Math.max(Vt,F[_*n])/a*A[_*n];continue}if(P===n){h[S]+=2*t/Math.max(Vt,F[n-1+_*n])/a*A[n-1+_*n];continue}const L=P-1+_*n,O=P+_*n;h[S]-=2*t/(Math.max(Vt,F[L])+Math.max(Vt,F[O]))/a*(A[O]-A[L])}for(let _=0;_<=r;_+=1)for(let P=0;P<n;P+=1){const S=P+_*n;if(this.gasV[S]===0)continue;if(_===0){f[S]-=2*t/Math.max(Vt,F[P])/a*A[P];continue}if(_===r){f[S]+=2*t/Math.max(Vt,F[P+(r-1)*n])/a*A[P+(r-1)*n];continue}const L=P+(_-1)*n,O=P+_*n;f[S]-=2*t/(Math.max(Vt,F[L])+Math.max(Vt,F[O]))/a*(A[O]-A[L])}return this.last}compressionHeating(t){const e=this.g,s=this.R,i=e.n;let n=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let o=0;for(let f=0;f<i;f+=1){if(s.id[f]!==r||e.kind[f]===ht||this.cap[f]<=0)continue;const d=this.nmol[f];o+=d*(d*Et*e.T[f]/s.pAt(f))/this.cap[f]}o*=Et/a;const l=1/Math.max(.05,1-o);let h=0;for(let f=0;f<4;f+=1){const d=s.statePressure(r);s.p0[r]=d;const m=(d-(t[r]+h))*l;if(Math.abs(m)<=1e-10*d)break;let u=0;for(let v=0;v<i;v+=1){if(s.id[v]!==r||e.kind[v]===ht||this.cap[v]<=0)continue;const p=this.nmol[v]*Et*e.T[v]/s.pAt(v);u+=p,e.Hg[v]+=p*m,this.deriveCell(v)}h+=m,n+=u*m}s.p0[r]=s.statePressure(r),this.dp0[r]=h}return n}vapourPressure(t){const e=this.g,s=e.n;let i=0;for(let n=0;n<dt;n+=1)i+=e.mg[n*s+t]/ut[n];return i<=0?0:e.mg[K*s+t]/ut[K]/i*this.R.pAt(t)}}const Fn=[1/6,2/3,1/6];class Eo{constructor(t,e,s,i){g(this,"nx");g(this,"ny");g(this,"n");g(this,"dx");g(this,"depth");g(this,"vCell");g(this,"aFace");g(this,"nu");g(this,"nv");g(this,"openL",!1);g(this,"openR",!1);g(this,"openB",!1);g(this,"openT",!0);g(this,"solid");g(this,"role");g(this,"heater");g(this,"phiS");g(this,"sdf");g(this,"phi");g(this,"alpha");g(this,"kind");g(this,"region");g(this,"pl");g(this,"pg");g(this,"mg");g(this,"mfog");g(this,"Hg");g(this,"Es");g(this,"film");g(this,"T");g(this,"Tl");g(this,"Cl");g(this,"Sl");g(this,"Sg");g(this,"ul");g(this,"vl");g(this,"ug");g(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=i,this.vCell=s*s*i,this.aFace=s*i,this.nu=(t+1)*e,this.nv=t*(e+1);const n=this.n;this.solid=new Uint8Array(n),this.role=new Uint8Array(n),this.heater=new Int16Array(n).fill(-1),this.phiS=new Float32Array(n),this.sdf=new Float32Array(n),this.phi=new Float32Array(n),this.alpha=new Float32Array(n),this.kind=new Uint8Array(n),this.region=new Int32Array(n).fill(-1),this.pl=new Float32Array(n),this.pg=new Float32Array(n),this.mg=new Float64Array(at*n),this.mfog=new Float64Array(n),this.Hg=new Float64Array(n),this.Es=new Float64Array(n),this.film=new Float64Array(n),this.T=new Float32Array(n),this.Tl=new Float32Array(n),this.Cl=new Float64Array(n),this.Sl=new Float32Array(n),this.Sg=new Float32Array(n),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),i=Math.floor(e/this.dx);return s<0||i<0||s>=this.nx||i>=this.ny?-1:s+i*this.nx}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}updateStatic(){const{nx:t,ny:e,dx:s}=this;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const o=a+r*t;if(this.solid[o]!==0){this.phiS[o]=1;continue}let l=0;for(let h=-1;h<=1;h+=1)for(let f=-1;f<=1;f+=1)(f!==0||h!==0)&&this.solidAt(a+f,r+h)&&(l+=Fn[f+1]*Fn[h+1]);this.phiS[o]=l}const i=4,n=i*s;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const o=a+r*t,l=this.solid[o]!==0,h=(a+.5)*s,f=(r+.5)*s;let d=n;l||(this.openL||(d=Math.min(d,h)),this.openR||(d=Math.min(d,this.w-h)),this.openB||(d=Math.min(d,f)),this.openT||(d=Math.min(d,this.h-f)));for(let m=-i;m<=i;m+=1){const u=r+m;if(!(u<0||u>=e))for(let v=-i;v<=i;v+=1){const p=a+v;if(p<0||p>=t||this.solid[p+u*t]!==0===l)continue;const w=Math.max(0,Math.abs(p+.5-(a+.5))-.5)*s,b=Math.max(0,Math.abs(u+.5-(r+.5))-.5)*s,F=Math.hypot(w,b);F<d&&(d=F)}}this.sdf[o]=l?-d:d}}sdfAt(t,e){const{nx:s,ny:i,dx:n}=this,r=Math.min(s-1.0001,Math.max(0,t/n-.5)),a=Math.min(i-1.0001,Math.max(0,e/n-.5)),o=Math.floor(r),l=Math.floor(a),h=r-o,f=a-l,d=Math.min(s-1,o+1),m=Math.min(i-1,l+1),u=this.sdf;let v=(1-f)*((1-h)*u[o+l*s]+h*u[d+l*s])+f*((1-h)*u[o+m*s]+h*u[d+m*s]);return this.openL||(v=Math.min(v,t)),this.openR||(v=Math.min(v,this.w-t)),this.openB||(v=Math.min(v,e)),this.openT||(v=Math.min(v,this.h-e)),v}}const Do=5,_n=30;class Vo{constructor(t,e,s,i,n){g(this,"g");g(this,"P");g(this,"L");g(this,"G");g(this,"solver");g(this,"src");g(this,"C");g(this,"Cs");g(this,"Cg");g(this,"CTl");g(this,"Tstar");g(this,"k");g(this,"dE");g(this,"Tnew");g(this,"gx");g(this,"gy");g(this,"q");g(this,"Co");g(this,"CKo");g(this,"heaters",[]);g(this,"ambientT",293.15);g(this,"fluxSL",0);g(this,"fluxLG",0);g(this,"fluxSG",0);g(this,"lossSolids",0);g(this,"liquidPower",0);g(this,"hExt",ur);g(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});this.g=t,this.P=e,this.L=s,this.G=i,this.solver=n;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r),this.Co=new Float64Array(r),this.CKo=new Float64Array(r)}solidCap(t){const e=Dt[this.g.solid[t]-1];return e.rho*e.cp*this.g.vCell}solidEnergy(t,e){return this.solidCap(t)*(e-mt)+this.g.film[t]*qt(e)}deriveSolid(t){const e=this.g,s=this.solidCap(t),i=e.film[t];if(i<=0){e.T[t]=mt+e.Es[t]/s;return}let n=e.T[t]>100?e.T[t]:mt+e.Es[t]/s;for(let r=0;r<3;r+=1)n-=(this.solidEnergy(t,n)-e.Es[t])/(s+i*Xs(n));e.T[t]=n}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const i=this.heaters[s];i!==void 0&&(i.Tmean+=t.T[e],i.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/Do,i=e.target-e.Tmean,n=e.integral+i*t,r=s*(i+n/_n);r>0&&r<e.power&&(e.integral=n),e.P=Math.min(e.power,Math.max(0,s*(i+e.integral/_n)))}}step(t,e,s){const{g:i,P:n,L:r,G:a}=this,{nx:o,ny:l,n:h,depth:f,dx:d}=i,{C:m,Cs:u,Cg:v,CTl:p,Tstar:x,k:w,q:b,src:F}=this;this.heaterPower(t),p.fill(0);const y=i.Cl;y.fill(0);const{Co:A,CKo:_}=this;let P=!1,S=0;for(let k=0;k<n.count;k+=1){const R=n.mat[k],E=n.T[k],Y=n.mass[k]*Ps(R,E);S+=Y;const B=9*k,U=r.bi[k],H=r.bj[k],st=R===pt?0:Gs(R,E);R!==pt&&!P&&(P=!0,A.fill(0),_.fill(0));for(let ft=0;ft<9;ft+=1){const ct=r.wt[B+ft];if(ct===0)continue;const xt=U+ft%3,ie=H+(ft/3|0);if(xt<0||ie<0||xt>=o||ie>=l)continue;const xe=xt+ie*o;y[xe]+=ct*Y,p[xe]+=ct*Y*E,R!==pt&&(A[xe]+=ct*Y,_[xe]+=ct*Y*st)}}let L=0;for(let k=0;k<h;k+=1){let R=0,E=0;i.solid[k]!==0&&(R=this.solidCap(k)+i.film[k]*Xs(i.T[k]),E=Dt[i.solid[k]-1].k);const Y=a.cap[k]>0&&i.solid[k]===0?a.cap[k]:0,B=y[k],U=R+Y+B;if(u[k]=R,v[k]=Y,m[k]=U,U<=0){x[k]=i.T[k],w[k]=0,b[k]=0;continue}const H=(R*i.T[k]+Y*i.T[k]+p[k])/U;x[k]=H,B>0&&(i.Tl[k]=p[k]/B),i.solid[k]===0&&(B>=Y?E=P&&A[k]>0?((B-A[k])*qi(H)+_[k])/B:qi(H):E=ao(i.mg[k],i.mg[h+k],i.mg[K*h+k],H)),w[k]=E;let st=F[k];if(this.liquidPower!==0&&B>0){const ct=this.liquidPower*B/S;st+=ct,L+=ct}const ft=i.heater[k];if(ft>=0&&i.role[k]===1){const ct=this.heaters[ft];ct!==void 0&&ct.cells>0&&(st+=ct.P/ct.cells,L+=ct.P/ct.cells)}b[k]=st}const{gx:O,gy:q}=this;for(let k=0;k<l;k+=1)for(let R=0;R<o;R+=1){const E=R+k*o;if(O[E]=0,q[E]=0,m[E]<=0)continue;const Y=w[E];if(R+1<o&&m[E+1]>0){const B=w[E+1];Y+B>0&&(O[E]=2*Y*B/(Y+B)*f)}if(k+1<l&&m[E+o]>0){const B=w[E+o];Y+B>0&&(q[E]=2*Y*B/(Y+B)*f)}}const Q=this.solver,C=Q.begin(o,l),W=C.stride,M=d*f,D=this.hExt*M,J=this.ambientT;for(let k=0;k<l;k+=1)for(let R=0;R<o;R+=1){const E=R+k*o;if(m[E]<=0)continue;const Y=R+1+(k+1)*W;C.act[Y]=1,C.dH[Y]=m[E]/t;let B=b[E];const U=w[E],H=x[E];R+1<o&&(C.ax[Y]=O[E],B+=O[E]*(x[E+1]-H)),R>0&&(B+=O[E-1]*(x[E-1]-H)),k+1<l&&(C.ay[Y]=q[E],B+=q[E]*(x[E+o]-H)),k>0&&(B+=q[E-o]*(x[E-o]-H));let st=0;R===0&&(st+=this.sideConductance(i.openL,U,D,f)),R===o-1&&(st+=this.sideConductance(i.openR,U,D,f)),k===0&&(st+=this.sideConductance(i.openB,U,D,f)),k===l-1&&(st+=this.sideConductance(i.openT,U,D,f)),st>0&&(C.dDx[Y]=st,B+=st*(J-x[E])),C.b[Y]=B}const j=Q.solve(e,s,!1),Z=this.last.solve;Z.iterations=j.iterations,Z.residual=j.residual,Z.capped=j.capped;const $=this.Tnew,T=C.x;for(let k=0;k<l;k+=1)for(let R=0;R<o;R+=1){const E=R+k*o;$[E]=m[E]>0?x[E]+T[R+1+(k+1)*W]:i.T[E]}const I=this.dE;let X=0,V=0;for(let k=0;k<h;k+=1)I[k]=m[k]>0?b[k]*t:0;for(let k=0;k<l;k+=1)for(let R=0;R<o;R+=1){const E=R+k*o;if(m[E]<=0)continue;const Y=w[E];if(O[E]>0){const B=O[E]*($[E+1]-$[E])*t;I[E]+=B,I[E+1]-=B,i.kind[E]!==i.kind[E+1]&&this.pair(i.kind[E],i.kind[E+1],B)}if(q[E]>0){const B=q[E]*($[E+o]-$[E])*t;I[E]+=B,I[E+o]-=B,i.kind[E]!==i.kind[E+o]&&this.pair(i.kind[E],i.kind[E+o],B)}for(let B=0;B<4;B+=1){if(!(B===0?R===0:B===1?R===o-1:B===2?k===0:k===l-1))continue;const H=B===0?i.openL:B===1?i.openR:B===2?i.openB:i.openT,st=this.sideConductance(H,Y,D,f)*($[E]-J)*t;I[E]-=st,H?V+=st:X+=st,i.solid[E]!==0&&(this.lossSolids+=st)}}for(let k=0;k<h;k+=1){if(m[k]<=0)continue;const R=I[k]/m[k];u[k]>0&&(i.Es[k]+=R*u[k],this.deriveSolid(k)),v[k]>0&&(i.Hg[k]+=R*v[k]),$[k]=R}for(let k=0;k<n.count;k+=1){const R=9*k,E=r.bi[k],Y=r.bj[k];let B=0;for(let st=0;st<9;st+=1){const ft=r.wt[R+st];if(ft===0)continue;const ct=E+st%3,xt=Y+(st/3|0);if(ct<0||xt<0||ct>=o||xt>=l)continue;const ie=ct+xt*o;m[ie]>0&&(B+=ft*$[ie])}if(B===0)continue;const U=n.mass[k],H=U/n.rho[k];n.h[k]+=Ps(n.mat[k],n.T[k])*B,n.derive(k),r.dVp[k]+=U/n.rho[k]-H}for(let k=0;k<h;k+=1)v[k]>0&&a.deriveCell(k);F.fill(0);const z=this.last;return z.heater=L*t,z.lossWalls=X,z.lossOpen=V,z}pair(t,e,s){t===ht&&e===lt?this.fluxSL-=s:t===lt&&e===ht?this.fluxSL+=s:t===lt&&e===N?this.fluxLG-=s:t===N&&e===lt?this.fluxLG+=s:t===ht&&e===N?this.fluxSG-=s:t===N&&e===ht&&(this.fluxSG+=s)}sideConductance(t,e,s,i){const n=2*e*i;return t?n:s<=0||n<=0?0:1/(1/s+1/n)}}const Io=(c,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(c),ay:new Float64Array(c),gx:new Float64Array(c),gy:new Float64Array(c),dH:new Float64Array(c),dDx:new Float64Array(c),dDy:new Float64Array(c),gDx:new Float64Array(c),gDy:new Float64Array(c),eDx:new Float64Array(c),eDy:new Float64Array(c),area:new Float64Array(c),ox:new Float64Array(c),oy:new Float64Array(c),diag:new Float64Array(c),inv:new Float64Array(c),act:new Uint8Array(c),x:new Float64Array(c),b:new Float64Array(c),r:new Float64Array(c),band:new Int32Array(c),bandCount:0}),Pn=24,No=1,Go=1,An=24,Tn=1,Jt=(c,t)=>(c+2)*(t+2);function kn(c,t,e){let s=0;for(let i=0;i<e;i+=1)s+=c[i]*t[i];return s}function Uo(c,t,e,s,i,n){let r=0;for(let a=0;a<n;a+=1){c[a]+=i*e[a];const o=t[a]-i*s[a];t[a]=o,r+=o*o}return r}function Ho(c,t,e,s){for(let i=0;i<s;i+=1)c[i]=t[i]+e*c[i]}class bt{constructor(t,e){g(this,"levels",[]);g(this,"depth",1);g(this,"xs");g(this,"bs");g(this,"p");g(this,"q");g(this,"zj");g(this,"rj");g(this,"nullId");g(this,"stack");g(this,"nullSum",new Float64Array(16));g(this,"nullCnt",new Float64Array(16));g(this,"nullCount",0);g(this,"system");g(this,"result",{iterations:0,residual:0,capped:!1});g(this,"pw",new Float64Array(4));g(this,"pi",new Int32Array(4));let s=t,i=e,n=0;for(;this.levels.push(Io(Jt(s,i),n)),!(s*i<=Pn||s<=2&&i<=2);)n=Jt(s,i),s=Math.ceil(s/2),i=Math.ceil(i/2);const r=Jt(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],o=this.xs,l=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:o,b:l}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const i=Jt(t,e);return s.ax.fill(0,0,i),s.ay.fill(0,0,i),s.dH.fill(0,0,i),s.dDx.fill(0,0,i),s.dDy.fill(0,0,i),s.act.fill(0,0,i),this.bs.fill(0,0,i),this.xs.fill(0,0,i),this.system}static diagonal(t){const{nx:e,ny:s,stride:i,ax:n,ay:r,dH:a,dDx:o,dDy:l,diag:h,inv:f,act:d}=t;for(let m=1;m<=s;m+=1){let u=1+m*i;for(let v=1;v<=e;v+=1,u+=1){if(d[u]===0){h[u]=1,f[u]=1;continue}const p=a[u]+o[u]+l[u]+n[u]+n[u-1]+r[u]+r[u-i];if(!(p>0)){d[u]=0,h[u]=1,f[u]=1;continue}h[u]=p,f[u]=1/p}}}static apply(t,e,s){const{nx:i,ny:n,stride:r,ax:a,ay:o,diag:l}=t;for(let h=1;h<=n;h+=1){let f=1+h*r;for(let d=1;d<=i;d+=1,f+=1)s[f]=l[f]*e[f]-a[f]*e[f+1]-a[f-1]*e[f-1]-o[f]*e[f+r]-o[f-r]*e[f-r]}}static color(t,e){const{nx:s,ny:i,stride:n,ax:r,ay:a,inv:o,x:l,b:h}=t;for(let f=1;f<=i;f+=1){let d=1+(1+f+e&1)+f*n;const m=s+f*n;for(;d<=m;d+=2)l[d]=(h[d]+r[d]*l[d+1]+r[d-1]*l[d-1]+a[d]*l[d+n]+a[d-n]*l[d-n])*o[d]}}static findBand(t){const{nx:e,ny:s,stride:i,act:n,dDx:r,dDy:a,band:o}=t;let l=0;for(let h=1;h<=s;h+=1){let f=1+h*i;for(let d=1;d<=e;d+=1,f+=1)n[f]!==0&&(n[f-1]===0||n[f+1]===0||n[f-i]===0||n[f+i]===0||r[f]>0||a[f]>0)&&(o[l++]=f)}t.bandCount=l}static bandSweep(t,e){const{stride:s,ax:i,ay:n,inv:r,x:a,b:o,band:l,bandCount:h}=t;for(let f=e>0?0:h-1;e>0?f<h:f>=0;f+=e){const d=l[f];a[d]=(o[d]+i[d]*a[d+1]+i[d-1]*a[d-1]+n[d]*a[d+s]+n[d-s]*a[d-s])*r[d]}}prepareFine(){const t=this.levels[0],e=Jt(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=Pn||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],i=Math.ceil(e.nx/2),n=Math.ceil(e.ny/2);s.nx=i,s.ny=n,s.stride=i+2,s.h=2*e.h;const r=Jt(i,n);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,o=e.h,l=s.h;for(let h=0;h<n;h+=1)for(let f=0;f<i;f+=1){const d=f+1+(h+1)*s.stride;let m=0,u=0,v=0,p=0;for(let _=0;_<2;_+=1){const P=2*h+_;if(!(P>=e.ny))for(let S=0;S<2;S+=1){const L=2*f+S;if(L>=e.nx)continue;const O=L+1+(P+1)*a;if(e.act[O]===0)continue;const q=e.area[O];m+=q,u+=q*((S-.5)*o+e.ox[O]*o),v+=q*((_-.5)*o+e.oy[O]*o),p+=e.dH[O]}}if(m<=0){s.act[d]=0,s.dH[d]=0,s.dDx[d]=0,s.dDy[d]=0,s.gDx[d]=0,s.gDy[d]=0,s.ox[d]=0,s.oy[d]=0;continue}s.act[d]=1,s.area[d]=m/4;const x=u/m,w=v/m;s.ox[d]=x/l,s.oy[d]=w/l,s.dH[d]=p;let b=0,F=0,y=0,A=0;for(let _=0;_<2;_+=1){const P=2*h+_;if(!(P>=e.ny))for(let S=0;S<2;S+=1){const L=2*f+S;if(L>=e.nx)continue;const O=L+1+(P+1)*a;if(e.act[O]!==0){if(e.gDx[O]>0){const q=(S-.5)*o+e.ox[O]*o;b+=e.gDx[O],F+=e.gDx[O]/(e.eDx[O]+Math.abs(q-x))}if(e.gDy[O]>0){const q=(_-.5)*o+e.oy[O]*o;y+=e.gDy[O],A+=e.gDy[O]/(e.eDy[O]+Math.abs(q-w))}}}}s.gDx[d]=b,s.gDy[d]=y,s.dDx[d]=F,s.dDy[d]=A,s.eDx[d]=F>0?b/F:.5*l,s.eDy[d]=A>0?y/A:.5*l}for(let h=0;h<n;h+=1)for(let f=0;f<i;f+=1){const d=f+1+(h+1)*s.stride;if(s.act[d]!==0){if(f+1<i&&s.act[d+1]!==0){const m=2*f+1;let u=0;if(m+1<e.nx)for(let v=0;v<2;v+=1){const p=2*h+v;p>=e.ny||(u+=e.gx[m+1+(p+1)*a])}if(u>0){const v=l*(1+s.ox[d+1]-s.ox[d]);s.gx[d]=u,s.ax[d]=u/Math.max(.25*l,v)}}if(h+1<n&&s.act[d+s.stride]!==0){const m=2*h+1;let u=0;if(m+1<e.ny)for(let v=0;v<2;v+=1){const p=2*f+v;p>=e.nx||(u+=e.gy[p+1+(m+1)*a])}if(u>0){const v=l*(1+s.oy[d+s.stride]-s.oy[d]);s.gy[d]=u,s.ay[d]=u/Math.max(.25*l,v)}}}}bt.diagonal(s),bt.findBand(s);for(let h=0;h<e.ny;h+=1){let f=1+(h+1)*a;for(let d=0;d<e.nx;d+=1,f+=1){if(e.act[f]===0){s.pW[4*f]=0,s.pW[4*f+1]=0,s.pW[4*f+2]=0,s.pW[4*f+3]=0,s.pIdx[4*f]=0,s.pIdx[4*f+1]=0,s.pIdx[4*f+2]=0,s.pIdx[4*f+3]=0;continue}bt.weights(s,d,h,e.dDx[f]+e.dDy[f]>0,this.pw,this.pi);for(let m=0;m<4;m+=1)s.pIdx[4*f+m]=this.pi[m],s.pW[4*f+m]=this.pw[m]}}this.depth=t+1}}static weights(t,e,s,i,n,r){const a=e>>1,o=s>>1,l=(e&1)===1?1:-1,h=(s&1)===1?1:-1,f=t.stride,d=a+1+(o+1)*f;r[0]=d,r[1]=d+l,r[2]=d+h*f,r[3]=d+l+h*f;const m=a+l>=0&&a+l<t.nx,u=o+h>=0&&o+h<t.ny;n[1]=m&&t.act[r[1]]!==0?3/16:0,n[2]=u&&t.act[r[2]]!==0?3/16:0,n[3]=m&&u&&t.act[r[3]]!==0?1/16:0,t.act[d]===0?n[0]=0:n[0]=i?9/16:1-n[1]-n[2]-n[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let m=0;m<An;m+=1)bt.color(e,0),bt.color(e,1);for(let m=0;m<An;m+=1)bt.color(e,1),bt.color(e,0);return}for(let m=0;m<No;m+=1)bt.color(e,0),bt.color(e,1);for(let m=0;m<Tn;m+=1)bt.bandSweep(e,1);bt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,Jt(s.nx,s.ny)),s.x.fill(0,0,Jt(s.nx,s.ny));const{stride:i,act:n,b:r,r:a,x:o}=e,{pIdx:l,pW:h}=s,f=s.b,d=s.x;for(let m=0;m<e.ny;m+=1){let u=1+(m+1)*i;for(let v=0;v<e.nx;v+=1,u+=1){if(n[u]===0)continue;const p=r[u]-a[u],x=4*u;f[l[x]]+=h[x]*p,f[l[x+1]]+=h[x+1]*p,f[l[x+2]]+=h[x+2]*p,f[l[x+3]]+=h[x+3]*p}}this.vcycle(t+1);for(let m=0;m<e.ny;m+=1){let u=1+(m+1)*i;for(let v=0;v<e.nx;v+=1,u+=1){if(n[u]===0)continue;const p=4*u;o[u]+=h[p]*d[l[p]]+h[p+1]*d[l[p+1]]+h[p+2]*d[l[p+2]]+h[p+3]*d[l[p+3]]}}for(let m=0;m<Tn;m+=1)bt.bandSweep(e,-1);for(let m=0;m<Go;m+=1)bt.color(e,1),bt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:i,ax:n,ay:r,dH:a,dDx:o,dDy:l,act:h}=t,f=this.nullId,d=Jt(e,s);let m=!1;for(let u=0;u<d;u+=1)if(h[u]!==0&&!(a[u]>0)){m=!0;break}if(!m){this.nullCount=0;return}f.fill(-2,0,d),this.nullCount=0;for(let u=1;u<=s;u+=1)for(let v=1;v<=e;v+=1){const p=v+u*i;if(h[p]===0||f[p]!==-2)continue;let x=0,w=0,b=!1;const F=-3-this.nullCount;this.stack[x++]=p,f[p]=F;let y=p,A=p;for(;x>0;){const P=this.stack[--x];w+=1,P<y&&(y=P),P>A&&(A=P),(a[P]>0||o[P]>0||l[P]>0)&&(b=!0),n[P]>0&&f[P+1]===-2&&(f[P+1]=F,this.stack[x++]=P+1),n[P-1]>0&&f[P-1]===-2&&(f[P-1]=F,this.stack[x++]=P-1),r[P]>0&&f[P+i]===-2&&(f[P+i]=F,this.stack[x++]=P+i),r[P-i]>0&&f[P-i]===-2&&(f[P-i]=F,this.stack[x++]=P-i)}let _=-1;if(!b){if(_=this.nullCount,_>=this.nullSum.length){const P=S=>{const L=new Float64Array(2*S.length);return L.set(S),L};this.nullSum=P(this.nullSum),this.nullCnt=P(this.nullCnt)}this.nullCnt[_]=w,this.nullCount+=1}for(let P=y;P<=A;P+=1)f[P]===F&&(f[P]=_)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=Jt(e.nx,e.ny),i=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let n=0;n<s;n+=1)i[n]>=0&&(this.nullSum[i[n]]+=t[n]);for(let n=0;n<this.nullCount;n+=1)this.nullSum[n]/=this.nullCnt[n];for(let n=0;n<s;n+=1)i[n]>=0&&(t[n]-=this.nullSum[i[n]])}nullRegions(){return this.nullCount}solve(t,e,s){const i=this.result,n=this.levels[0],r=Jt(n.nx,n.ny),{act:a}=n,o=this.xs,l=this.bs,h=n.stride;for(let y=0;y<r;y+=1){if(a[y]===0){o[y]=0,l[y]=0,n.ax[y]=0,n.ay[y]=0;continue}(y+1>=r||a[y+1]===0)&&(n.ax[y]=0),(y+h>=r||a[y+h]===0)&&(n.ay[y]=0)}bt.diagonal(n);for(let y=0;y<r;y+=1)a[y]===0&&(o[y]=0,l[y]=0);this.findNull(),this.project(l),s&&(bt.findBand(n),this.prepareFine(),this.coarsen());const f=s?n.b:this.rj,d=s?n.x:this.zj,{p:m,q:u}=this;u.fill(0,0,r),m.fill(0,0,r),d.fill(0,0,r),bt.apply(n,o,u);let v=0,p=0;for(let y=0;y<r;y+=1){const A=a[y]===0?0:l[y]-u[y];f[y]=A,v+=l[y]*l[y],p+=A*A}this.project(f);const x=Math.sqrt(v);if(x===0)return o.fill(0,0,r),i.iterations=0,i.residual=0,i.capped=!1,i;let w=Math.sqrt(p)/x;if(w<=t)return i.iterations=0,i.residual=w,i.capped=!1,i;this.precondition(s,f,d,r);let b=0;for(let y=0;y<r;y+=1)m[y]=d[y],b+=f[y]*d[y];let F=0;for(;F<e;){F+=1,bt.apply(n,m,u);const y=kn(m,u,r);if(!(y>0))break;const A=b/y;if(p=Uo(o,f,m,u,A,r),w=Math.sqrt(p)/x,w<=t)break;this.precondition(s,f,d,r);const _=kn(f,d,r),P=_/b;b=_,Ho(m,d,P,r)}this.project(o);for(let y=0;y<r;y+=1)a[y]===0&&(o[y]=0);return i.iterations=F,i.residual=w,i.capped=w>t,i}precondition(t,e,s,i){if(t)s.fill(0,0,i),this.vcycle(0);else{const n=this.levels[0].inv;for(let r=0;r<i;r+=1)s[r]=e[r]*n[r]}this.project(s)}}const $o=.1,Sn=1e-9;function Qt(c,t,e){const s=Math.floor(c-.5),i=c-s,n=1.5-i,r=i-.5;return t[e]=.5*n*n,t[e+1]=.75-(i-1)*(i-1),t[e+2]=.5*r*r,s}class Wo{constructor(t,e,s){g(this,"g");g(this,"P");g(this,"solver");g(this,"mu");g(this,"pu");g(this,"mv");g(this,"pv");g(this,"rv");g(this,"knownU");g(this,"knownV");g(this,"tmpU");g(this,"tmpV");g(this,"markU");g(this,"markV");g(this,"bi");g(this,"bj");g(this,"wr");g(this,"wt");g(this,"dVp");g(this,"volSrc");g(this,"fU");g(this,"fV");g(this,"pGas");g(this,"w",new Float64Array(12));g(this,"rhoRef",998);g(this,"weightsDirty",!0);g(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedOther:0,escapedEnergy:0,viscIterations:0});g(this,"escM",0);g(this,"escO",0);g(this,"escE",0);g(this,"viscous",!1);g(this,"etaU",null);g(this,"etaV",null);g(this,"vsolver",null);g(this,"mf",0);g(this,"ms",1);g(this,"vel",new Float64Array(2));g(this,"cellMat",null);g(this,"cellHost",null);g(this,"dropletDrift",null);this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const i=e.cap;this.bi=new Int16Array(i),this.bj=new Int16Array(i),this.wr=new Float32Array(9*i),this.wt=new Float32Array(9*i),this.dVp=new Float64Array(i),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:i,bj:n,wr:r}=this,a=1/e.dx;for(let o=0;o<t.count;o+=1){i[o]=Qt(t.x[o]*a-.5,s,0),n[o]=Qt(t.y[o]*a-.5,s,3);const l=9*o;for(let h=0;h<3;h+=1)for(let f=0;f<3;f+=1)r[l+f+3*h]=s[f]*s[3+h]}this.weightsDirty=!1}cellOf(t,e){const s=this.g,i=this.bi[t]+e%3,n=this.bj[t]+(e/3|0);return i<0||n<0||i>=s.nx||n>=s.ny?-1:i+n*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:i,wr:n,wt:r}=this,{nx:a,ny:o,kind:l}=e;for(let h=0;h<t.count;h+=1){const f=9*h,d=s[h],m=i[h];let u=0;for(let v=0;v<9;v+=1){const p=d+v%3,x=m+(v/3|0),b=p>=0&&x>=0&&p<a&&x<o&&l[p+x*a]===lt?n[f+v]:0;r[f+v]=b,u+=b}if(u>0){const v=1/u;for(let p=0;p<9;p+=1)r[f+p]*=v}else{for(let v=0;v<9;v+=1)r[f+v]=0;r[f+4]=1}}}placeParticle(t){const{P:e,g:s,w:i,bi:n,bj:r,wr:a,wt:o}=this,{nx:l,ny:h,kind:f}=s,d=1/s.dx;n[t]=Qt(e.x[t]*d-.5,i,0),r[t]=Qt(e.y[t]*d-.5,i,3);const m=9*t;let u=0;for(let v=0;v<3;v+=1)for(let p=0;p<3;p+=1){const x=p+3*v,w=i[p]*i[3+v];a[m+x]=w;const b=n[t]+p,F=r[t]+v,y=b>=0&&F>=0&&b<l&&F<h&&f[b+F*l]===lt;o[m+x]=y?w:0,y&&(u+=w)}if(u>0)for(let v=0;v<9;v+=1)o[m+v]/=u;else{for(let v=0;v<9;v+=1)o[m+v]=0;o[m+4]=1}this.dVp[t]=0}splatVolume(){const{P:t,g:e,bi:s,bj:i,wr:n}=this,{nx:r,ny:a,phi:o}=e;o.fill(0);const l=1/e.vCell;let h=0,f=0;for(let d=0;d<t.count;d+=1){const m=t.mass[d]/t.rho[d];h+=t.mass[d],f+=m;const u=9*d,v=s[d],p=i[d];for(let x=0;x<9;x+=1){const w=v+x%3,b=p+(x/3|0);w<0||b<0||w>=r||b>=a||(o[w+b*r]+=n[u+x]*m*l)}}f>0&&(this.rhoRef=h/f)}classify(t=null){const e=this.g,{nx:s,ny:i}=e;let n=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ht;continue}const a=e.phi[r];let o=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!o&&t!==null&&t[r]!==N&&t[r]!==ht){const l=r%s,h=(r-l)/s;(l>0?t[r-1]===N:e.openL)||(l<s-1?t[r+1]===N:e.openR)||(h>0?t[r-s]===N:e.openB)||(h<i-1?t[r+s]===N:e.openT)||(o=!0)}e.kind[r]=o?lt:N,o&&(n+=1)}return n}p2g(){const{P:t,g:e,w:s,mu:i,pu:n,mv:r,pv:a,rv:o}=this,{nx:l,ny:h,dx:f}=e,d=1/f,m=l+1;i.fill(0),n.fill(0),r.fill(0),a.fill(0),o.fill(0);const u=1/this.rhoRef,v=this.viscous;v&&(this.etaU===null||this.etaV===null)&&(this.etaU=new Float64Array(e.nu),this.etaV=new Float64Array(e.nv));const p=this.etaU,x=this.etaV;v&&(p.fill(0),x.fill(0));for(let w=0;w<t.count;w+=1){const b=t.x[w],F=t.y[w],y=t.mass[w],A=v?gs(t.mat[w],t.T[w]):0,_=t.vx[w],P=t.vy[w],S=t.c00[w],L=t.c01[w],O=t.c10[w],q=t.c11[w],Q=b*d,C=F*d;let W=Qt(Q,s,0),M=Qt(C-.5,s,3);for(let J=0;J<3;J+=1){const j=M+J,Z=(j+.5)*f-F;for(let $=0;$<3;$+=1){const T=W+$,I=s[$]*s[3+J]*y,X=I*(_+S*(T*f-b)+L*Z);if(T>=0&&T<=l&&j>=0&&j<h){const V=T+j*m;i[V]+=I,n[V]+=X,v&&(p[V]+=I*A)}else this.mirrorU(T,j),i[this.mf]+=I,n[this.mf]+=this.ms*X,v&&(p[this.mf]+=I*A)}}W=Qt(Q-.5,s,0),M=Qt(C,s,3);const D=t.rho[w]*u;for(let J=0;J<3;J+=1){const j=M+J,Z=j*f-F;for(let $=0;$<3;$+=1){const T=W+$,I=s[$]*s[3+J]*y,X=I*(P+O*((T+.5)*f-b)+q*Z);let V,z=1;T>=0&&T<l&&j>=0&&j<=h?V=T+j*l:(this.mirrorV(T,j),V=this.mf,z=this.ms),r[V]+=I,a[V]+=z*X,o[V]+=I*D,v&&(x[V]+=I*A)}}}}mirrorU(t,e){const s=this.g,{nx:i,ny:n}=s;let r=t,a=e,o=1;r<0?s.openL?r=0:(r=-r,o=-o):r>i&&(s.openR?r=i:(r=2*i-r,o=-o)),a<0?a=s.openB?0:-1-a:a>=n&&(a=s.openT?n-1:2*n-1-a),r=Math.min(i,Math.max(0,r)),a=Math.min(n-1,Math.max(0,a)),this.mf=r+a*(i+1),this.ms=o}mirrorV(t,e){const s=this.g,{nx:i,ny:n}=s;let r=t,a=e,o=1;r<0?r=s.openL?0:-1-r:r>=i&&(r=s.openR?i-1:2*i-1-r),a<0?s.openB?a=0:(a=-a,o=-o):a>n&&(s.openT?a=n:(a=2*n-a,o=-o)),r=Math.min(i-1,Math.max(0,r)),a=Math.min(n,Math.max(0,a)),this.mf=r+a*i,this.ms=o}step(t,e,s,i){const{g:n,P:r}=this,{nx:a,ny:o,dx:l,kind:h}=n,f=a+1;this.viscous=r.hasOther(),this.p2g();const{mu:d,pu:m,mv:u,pv:v,rv:p,knownU:x,knownV:w}=this,b=n.ul,F=n.vl,y=this.rhoRef*n.vCell*.25,A=Sn*y,_=this.viscous;for(let M=0;M<n.nu;M+=1)b[M]=d[M]>A?m[M]/d[M]+(_?0:t*this.fU[M]/(this.rhoRef*n.vCell)):0;for(let M=0;M<n.nv;M+=1)F[M]=u[M]>A?v[M]/u[M]+(_?0:-t*e*(p[M]/u[M])+t*this.fV[M]/(this.rhoRef*n.vCell)):0;for(let M=0;M<o;M+=1)for(let D=0;D<=a;D+=1){const J=D+M*f,j=D>0?h[D-1+M*a]:-1,Z=D<a?h[D+M*a]:-1,$=D===0&&!n.openL,T=D===a&&!n.openR;if($||T||j===ht||Z===ht){b[J]=0,x[J]=2;continue}x[J]=j===lt||Z===lt?1:0}for(let M=0;M<=o;M+=1)for(let D=0;D<a;D+=1){const J=D+M*a,j=M>0?h[D+(M-1)*a]:-1,Z=M<o?h[D+M*a]:-1,$=M===0&&!n.openB,T=M===o&&!n.openT;if($||T||j===ht||Z===ht){F[J]=0,w[J]=2;continue}w[J]=j===lt||Z===lt?1:0}if(this.last.viscIterations=0,_){this.viscosity(t);const M=t/(this.rhoRef*n.vCell);for(let D=0;D<n.nu;D+=1)x[D]!==2&&d[D]>A&&(b[D]+=M*this.fU[D]);for(let D=0;D<n.nv;D+=1)w[D]!==2&&u[D]>A&&(F[D]+=-t*e*(p[D]/u[D])+M*this.fV[D])}let P=a,S=-1,L=o,O=-1,q=0;for(let M=0;M<o;M+=1)for(let D=0;D<a;D+=1)h[D+M*a]===lt&&(q+=1,D<P&&(P=D),D>S&&(S=D),M<L&&(L=M),M>O&&(O=M));const Q=this.last.solve;if(Q.iterations=0,Q.residual=0,Q.capped=!1,q>0){const M=S-P+1,D=O-L+1,J=this.solver,j=J.begin(M,D),Z=t/this.rhoRef,$=1/n.vCell,T=this.pGas;for(let V=L;V<=O;V+=1)for(let z=P;z<=S;z+=1){const k=z+V*a;if(h[k]!==lt)continue;const R=J.at(z-P,V-L);j.act[R]=1,j.x[R]=n.pl[k];const E=z+V*f,Y=z+V*a,B=b[E+1]-b[E]+F[Y+a]-F[Y],U=n.phi[k]+n.phiS[k]+n.alpha[k];let H=this.volSrc[k]*$;const st=this.gasAt(z-1,V)||this.gasAt(z+1,V)||this.gasAt(z,V-1)||this.gasAt(z,V+1),ft=U-1;(ft>0||!st)&&(H+=$o*ft/t);let ct=H*l*l-l*B;if(z+1<a){const xt=h[k+1];xt===lt?z+1<=S&&(j.ax[R]=Z):xt===N&&(j.dDx[R]+=Z,ct+=Z*T[k+1])}else n.openR&&(j.dDx[R]+=2*Z);if(z>0?h[k-1]===N&&(j.dDx[R]+=Z,ct+=Z*T[k-1]):n.openL&&(j.dDx[R]+=2*Z),V+1<o){const xt=h[k+a];xt===lt?V+1<=O&&(j.ay[R]=Z):xt===N&&(j.dDy[R]+=Z,ct+=Z*T[k+a])}else n.openT&&(j.dDy[R]+=2*Z);V>0?h[k-a]===N&&(j.dDy[R]+=Z,ct+=Z*T[k-a]):n.openB&&(j.dDy[R]+=2*Z),j.b[R]=ct}const I=J.solve(s,i,!0);Q.iterations=I.iterations,Q.residual=I.residual,Q.capped=I.capped;const X=n.pl;for(let V=0;V<n.n;V+=1)X[V]=h[V]===N?T[V]:0;for(let V=L;V<=O;V+=1)for(let z=P;z<=S;z+=1){const k=z+V*a;h[k]===lt&&(X[k]=j.x[J.at(z-P,V-L)])}for(let V=0;V<o;V+=1)for(let z=0;z<=a;z+=1){const k=z+V*f;if(x[k]===1){if(z===0){b[k]-=Z/l*2*(X[V*a]-0);continue}if(z===a){b[k]-=Z/l*2*(0-X[a-1+V*a]);continue}b[k]-=Z/l*(X[z+V*a]-X[z-1+V*a])}}for(let V=0;V<=o;V+=1)for(let z=0;z<a;z+=1){const k=z+V*a;if(w[k]===1){if(V===0){F[k]-=Z/l*2*(X[z]-0);continue}if(V===o){F[k]-=Z/l*2*(0-X[z+(o-1)*a]);continue}F[k]-=Z/l*(X[z+V*a]-X[z+(V-1)*a])}}}this.extrapolate();const C=this.g2p();this.advect(t,e),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const W=this.last;return W.cells=q,W.uMax=C,W.escapedMass=this.escM,W.escapedOther=this.escO,W.escapedEnergy=this.escE,W}viscosity(t){const e=this.g,{nx:s,ny:i,dx:n,kind:r}=e;this.vsolver===null&&(this.vsolver=new bt(s+1,i+1));const a=this.vsolver,o=this.etaU,l=this.etaV,{mu:h,mv:f,knownU:d,knownV:m}=this,u=Sn*this.rhoRef*e.vCell*.25;for(let w=0;w<e.nu;w+=1)o[w]=h[w]>u?o[w]/h[w]:0;for(let w=0;w<e.nv;w+=1)l[w]=f[w]>u?l[w]/f[w]:0;const v=this.rhoRef*n*n/t,p=(w,b)=>w+b>0?2*w*b/(w+b):0;let x=0;{const w=s+1,b=a.begin(w,i),F=e.ul;for(let A=0;A<i;A+=1)for(let _=0;_<=s;_+=1){const P=_+A*w;if(d[P]!==1)continue;const S=a.at(_,A),L=o[P];if(b.act[S]=1,b.dH[S]=v,b.x[S]=F[P],b.b[S]=v*F[P],_+1<=s){const O=d[P+1];O===1?b.ax[S]=p(L,o[P+1]):O===2&&(b.dDx[S]+=L)}if(_>0&&d[P-1]===2&&(b.dDx[S]+=L),A+1<i){const O=d[P+w];O===1?b.ay[S]=p(L,o[P+w]):O===2&&(b.dDy[S]+=2*L)}else e.openT||(b.dDy[S]+=2*L);A>0?d[P-w]===2&&(b.dDy[S]+=2*L):e.openB||(b.dDy[S]+=2*L)}const y=a.solve(1e-6,200,!1);x+=y.iterations;for(let A=0;A<i;A+=1)for(let _=0;_<=s;_+=1){const P=_+A*w;d[P]===1&&(F[P]=b.x[a.at(_,A)])}}{const w=a.begin(s,i+1),b=e.vl;for(let y=0;y<=i;y+=1)for(let A=0;A<s;A+=1){const _=A+y*s;if(m[_]!==1)continue;const P=a.at(A,y),S=l[_];if(w.act[P]=1,w.dH[P]=v,w.x[P]=b[_],w.b[P]=v*b[_],y+1<=i){const L=m[_+s];L===1?w.ay[P]=p(S,l[_+s]):L===2&&(w.dDy[P]+=S)}if(y>0&&m[_-s]===2&&(w.dDy[P]+=S),A+1<s){const L=m[_+1];L===1?w.ax[P]=p(S,l[_+1]):L===2&&(w.dDx[P]+=2*S)}else e.openR||(w.dDx[P]+=2*S);A>0?m[_-1]===2&&(w.dDx[P]+=2*S):e.openL||(w.dDx[P]+=2*S)}const F=a.solve(1e-6,200,!1);x+=F.iterations;for(let y=0;y<=i;y+=1)for(let A=0;A<s;A+=1){const _=A+y*s;m[_]===1&&(b[_]=w.x[a.at(A,y)])}}this.last.viscIterations=x}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===N}splatVolumeChange(t){const{P:e,g:s,bi:i,bj:n,wr:r,dVp:a,volSrc:o}=this,{nx:l,ny:h}=s,f=1/t;for(let d=0;d<e.count;d+=1){const m=a[d];if(m===0)continue;const u=9*d,v=i[d],p=n[d];for(let x=0;x<9;x+=1){const w=v+x%3,b=p+(x/3|0);w<0||b<0||w>=l||b>=h||(o[w+b*l]+=r[u+x]*m*f)}}}extrapolate(){const{g:t,knownU:e,knownV:s,tmpU:i,tmpV:n,markU:r,markV:a}=this,{nx:o,ny:l}=t,h=o+1,f=t.ul,d=t.vl;for(let m=0;m<t.nu;m+=1)r[m]=e[m]!==0?1:0;for(let m=0;m<t.nv;m+=1)a[m]=s[m]!==0?1:0;for(let m=0;m<2;m+=1){i.set(f),n.set(d);for(let u=0;u<l;u+=1)for(let v=0;v<=o;v+=1){const p=v+u*h;if(r[p]!==0)continue;let x=0,w=0;v>0&&r[p-1]===1&&(x+=f[p-1],w+=1),v<o&&r[p+1]===1&&(x+=f[p+1],w+=1),u>0&&r[p-h]===1&&(x+=f[p-h],w+=1),u<l-1&&r[p+h]===1&&(x+=f[p+h],w+=1),w>0&&(i[p]=x/w,r[p]=3)}for(let u=0;u<=l;u+=1)for(let v=0;v<o;v+=1){const p=v+u*o;if(a[p]!==0)continue;let x=0,w=0;v>0&&a[p-1]===1&&(x+=d[p-1],w+=1),v<o-1&&a[p+1]===1&&(x+=d[p+1],w+=1),u>0&&a[p-o]===1&&(x+=d[p-o],w+=1),u<l&&a[p+o]===1&&(x+=d[p+o],w+=1),w>0&&(n[p]=x/w,a[p]=3)}f.set(i),d.set(n);for(let u=0;u<t.nu;u+=1)r[u]===3&&(r[u]=1);for(let u=0;u<t.nv;u+=1)a[u]===3&&(a[u]=1)}for(let m=0;m<t.nu;m+=1)r[m]===0&&(f[m]=0);for(let m=0;m<t.nv;m+=1)a[m]===0&&(d[m]=0)}g2p(){const{P:t,g:e,w:s}=this,{nx:i,ny:n,dx:r}=e,a=1/r,o=i+1,l=e.ul,h=e.vl,f=4/(r*r);let d=0;for(let m=0;m<t.count;m+=1){const u=t.x[m],v=t.y[m],p=u*a,x=v*a;let w=Qt(p,s,0),b=Qt(x-.5,s,3),F=0,y=0,A=0;for(let O=0;O<3;O+=1){const q=b+O,Q=(q+.5)*r-v;for(let C=0;C<3;C+=1){const W=w+C,M=s[C]*s[3+O];let D;W>=0&&W<=i&&q>=0&&q<n?D=l[W+q*o]:(this.mirrorU(W,q),D=this.ms*l[this.mf]),F+=M*D,y+=M*D*(W*r-u),A+=M*D*Q}}w=Qt(p-.5,s,0),b=Qt(x,s,3);let _=0,P=0,S=0;for(let O=0;O<3;O+=1){const q=b+O,Q=q*r-v;for(let C=0;C<3;C+=1){const W=w+C,M=s[C]*s[3+O];let D;W>=0&&W<i&&q>=0&&q<=n?D=h[W+q*i]:(this.mirrorV(W,q),D=this.ms*h[this.mf]),_+=M*D,P+=M*D*((W+.5)*r-u),S+=M*D*Q}}t.vx[m]=F,t.vy[m]=_,t.c00[m]=f*y,t.c01[m]=f*A,t.c10[m]=f*P,t.c11[m]=f*S;const L=F*F+_*_;L>d&&(d=L)}return Math.sqrt(d)}velocityAt(t,e,s){const i=this.g,{nx:n,ny:r,dx:a}=i,o=n+1,l=1/a;let h=Math.min(n-1e-6,Math.max(0,t*l)),f=Math.min(r-1.000001,Math.max(0,e*l-.5)),d=Math.floor(h),m=Math.floor(f),u=h-d,v=f-m;const p=i.ul;s[0]=(1-v)*((1-u)*p[d+m*o]+u*p[d+1+m*o])+v*((1-u)*p[d+(m+1)*o]+u*p[d+1+(m+1)*o]),h=Math.min(n-1.000001,Math.max(0,t*l-.5)),f=Math.min(r-1e-6,Math.max(0,e*l)),d=Math.floor(h),m=Math.floor(f),u=h-d,v=f-m;const x=i.vl;s[1]=(1-v)*((1-u)*x[d+m*n]+u*x[d+1+m*n])+v*((1-u)*x[d+(m+1)*n]+u*x[d+1+(m+1)*n])}droplets(t,e,s){const{P:i,g:n}=this,{nx:r,ny:a,n:o}=n,l=re.length;(this.cellMat===null||this.cellHost===null)&&(this.cellMat=new Float64Array(o*l),this.cellHost=new Uint8Array(o));const h=this.cellMat,f=this.cellHost;h.fill(0);for(let u=0;u<i.count;u+=1){const v=Math.min(r-1,Math.max(0,Math.floor(i.x[u]/n.dx))),p=Math.min(a-1,Math.max(0,Math.floor(i.y[u]/n.dx)));h[(v+p*r)*l+i.mat[u]]+=i.mass[u]}for(let u=0;u<o;u+=1){let v=0;for(let p=1;p<l;p+=1)h[u*l+p]>h[u*l+v]&&(v=p);f[u]=v}let d=!1;const m=.25*n.dx;for(let u=0;u<i.count;u+=1){s[u]=0;const v=Math.min(r-1,Math.max(0,Math.floor(i.x[u]/n.dx))),p=Math.min(a-1,Math.max(0,Math.floor(i.y[u]/n.dx))),x=f[v+p*r],w=i.mat[u];if(w===x)continue;const b=i.T[u],F=ge(x,b),y=i.rho[u],A=gs(x,b),_=gs(w,b),P=i.mass[u]/y,S=Math.cbrt(6*P/Math.PI),L=Math.abs(F-y);if(L<=0||e<=0)continue;const O=(2*A+3*_)/(3*A+3*_);let q=L*e*S*S/(18*A*O);for(let C=0;C<8;C+=1){const W=Math.max(1e-9,F*q*S/A),M=24/W*O*(1+.15*Math.pow(W,.687));q=Math.sqrt(4*L*e*S/(3*F*M))}const Q=y<F?1:-1;s[u]=Q*Math.min(m,q*t),d=!0}return d}advect(t,e){const{P:s,g:i,vel:n}=this,r=i.w,a=i.h,o=i.dx;let l=0,h=0,f=0,d=null;this.viscous&&((this.dropletDrift===null||this.dropletDrift.length<s.cap)&&(this.dropletDrift=new Float64Array(s.cap)),this.droplets(t,e,this.dropletDrift)&&(d=this.dropletDrift));for(let m=0;m<s.count;m+=1){const u=s.x[m],v=s.y[m];this.velocityAt(u,v,n);const p=u+.5*t*n[0],x=v+.5*t*n[1];this.velocityAt(p,x,n);let w=u+t*n[0],b=v+t*n[1]+(d!==null?d[m]:0);if(w<0&&i.openL||w>r&&i.openR||b<0&&i.openB||b>a&&i.openT){s.mat[m]===pt?l+=s.mass[m]:h+=s.mass[m],f+=s.mass[m]*s.h[m],d!==null&&(d[m]=d[s.count-1]),this.removeParticle(m),m-=1;continue}const F=1e-4*o;w=Math.min(r-F,Math.max(F,w)),b=Math.min(a-F,Math.max(F,b));let y=i.sdfAt(w,b);if(y<.05*o)for(let A=0;A<3&&y<.05*o;A+=1){const _=.25*o;let P=i.sdfAt(w+_,b)-i.sdfAt(w-_,b),S=i.sdfAt(w,b+_)-i.sdfAt(w,b-_);const L=Math.hypot(P,S);if(L<1e-12)break;P/=L,S/=L;const O=.05*o-y;w+=O*P,b+=O*S;const q=s.vx[m]*P+s.vy[m]*S;q<0&&(s.vx[m]-=q*P,s.vy[m]-=q*S),w=Math.min(r-F,Math.max(F,w)),b=Math.min(a-F,Math.max(F,b)),y=i.sdfAt(w,b)}s.x[m]=w,s.y[m]=b}this.escM=l,this.escO=h,this.escE=f}}class Ko{constructor(t){g(this,"cap");g(this,"count",0);g(this,"nextId",1);g(this,"x");g(this,"y");g(this,"vx");g(this,"vy");g(this,"c00");g(this,"c01");g(this,"c10");g(this,"c11");g(this,"mass");g(this,"h");g(this,"T");g(this,"rho");g(this,"spc");g(this,"smass");g(this,"mat");g(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,i,n){if(this.count>=this.cap)return-1;const r=this.count;return this.count+=1,this.x[r]=t,this.y[r]=e,this.vx[r]=0,this.vy[r]=0,this.c00[r]=0,this.c01[r]=0,this.c10[r]=0,this.c11[r]=0,this.mass[r]=s,this.h[r]=i,this.mat[r]=n,this.spc[2*r]=0,this.spc[2*r+1]=0,this.smass[2*r]=0,this.smass[2*r+1]=0,this.id[r]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(r),r}derive(t){const e=this.mat[t],s=mo(e,this.h[t]);this.T[t]=s,this.rho[t]=ge(e,s)}hasOther(){for(let t=0;t<this.count;t+=1)if(this.mat[t]!==pt)return!0;return!1}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const zo=.001;class Qo{constructor(t){g(this,"e");g(this,"produced",0);g(this,"condensed",0);g(this,"dew",0);g(this,"fogMade",0);g(this,"producedMark",0);g(this,"fogError",0);g(this,"fogWrong",0);g(this,"mtot");g(this,"rd");g(this,"Y0");g(this,"Tl");g(this,"Cl");g(this,"acc");g(this,"accH");g(this,"accAll");g(this,"host");g(this,"mixed",!1);g(this,"accMat");g(this,"Fm");g(this,"Fe");g(this,"dm");g(this,"side",new Int32Array(4));g(this,"bG");g(this,"bY");g(this,"edge");g(this,"hvC");g(this,"hnC");g(this,"hoC");g(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.accAll=new Float64Array(e),this.host=new Uint8Array(e),this.accMat=new Float64Array(e*re.length),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s){const i=this.e.grid,n=i.n,r=Math.min(.999,ps(t)/e),a=i.mg[nt*n+s],o=i.mg[rt*n+s],l=a+o,h=l>0?l/(a/ut[nt]+o/ut[rt]):.02885;return r*ut[K]/(r*ut[K]+(1-r)*h)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:i,ny:n,n:r}=t,{Tl:a,Cl:o,acc:l,accH:h,accAll:f}=this;o.fill(0),a.fill(0),l.fill(0),h.fill(0);let d=!1;for(let u=0;u<e.count;u+=1){const v=e.mass[u],p=e.mat[u],x=v*Ps(p,e.T[u]);p!==pt&&!d&&(d=!0,f.fill(0),this.accMat.fill(0));const w=9*u;for(let b=0;b<9;b+=1){const F=s.wt[w+b];if(F===0)continue;const y=s.bi[u]+b%3,A=s.bj[u]+(b/3|0);if(y<0||A<0||y>=i||A>=n)continue;const _=y+A*i;o[_]+=F*x,a[_]+=F*x*e.T[u],p===pt&&(l[_]+=F*v,h[_]+=F*v*e.h[u]),d&&(this.accMat[p*r+_]+=F*v)}}for(let u=0;u<r;u+=1)a[u]=o[u]>0?a[u]/o[u]:t.T[u];if(this.mixed=d,!d){f.set(l),this.host.fill(pt);return}const m=re.length;for(let u=0;u<r;u+=1){this.accMat[pt*r+u]=l[u];let v=0,p=pt,x=-1;for(let w=0;w<m;w+=1){const b=this.accMat[w*r+u];v+=b,b>x&&(x=b,p=w)}f[u]=v,this.host[u]=p}}waterShare(t){const e=this.accAll[t];return e>0?this.acc[t]/e:1}waterH(t){return this.acc[t]>0?this.accH[t]/this.acc[t]:qt(this.Tl[t])}hostAt(t,e){const s=this.e.grid.cellAt(t,e);return s<0?pt:this.host[s]}applyMass(t,e){const{grid:s,particles:i,liquid:n}=this.e,{nx:r,ny:a}=s,{acc:o,dm:l}=this;l.fill(0,0,i.count);for(let f=0;f<i.count;f+=1){if(i.mat[f]!==pt)continue;const d=9*f;let m=0;for(let u=0;u<9;u+=1){const v=n.wt[d+u];if(v===0)continue;const p=n.bi[f]+u%3,x=n.bj[f]+(u/3|0);if(p<0||x<0||p>=r||x>=a)continue;const w=p+x*r;t[w]!==0&&o[w]>0&&(m+=t[w]*v*i.mass[f]/o[w])}l[f]=m}const h=n.rhoRef*s.vCell/4;for(let f=i.count-1;f>=0;f-=1){const d=l[f];if(d===0)continue;const m=i.mass[f]/i.rho[f],u=i.mass[f]+d;if(u<zo*h){this.track(f,-i.mass[f]),this.vanish(f,Math.max(0,u),e);continue}this.track(f,d),i.mass[f]=u,n.dVp[f]+=u/i.rho[f]-m}for(let f=0;f<s.n;f+=1){if(t[f]<=0||o[f]>0)continue;const d=f%r,m=(f-d)/r,u=i.add((d+.5)*s.dx,(m+.5)*s.dx,t[f],this.waterH(f),pt);u<0||(n.placeParticle(u),n.dVp[u]=t[f]/i.rho[u],this.track(u,t[f]))}}track(t,e){const{grid:s,particles:i,liquid:n}=this.e,{nx:r,ny:a}=s,o=9*t,l=Ps(i.mat[t],i.T[t]);for(let h=0;h<9;h+=1){const f=n.wt[o+h];if(f===0)continue;const d=n.bi[t]+h%3,m=n.bj[t]+(h/3|0);if(d<0||m<0||d>=r||m>=a)continue;const u=d+m*r;this.acc[u]+=f*e,this.accH[u]+=f*e*i.h[t],this.accAll[u]+=f*e,this.Cl[u]+=f*e*l}}vanish(t,e,s){const{grid:i,particles:n,liquid:r,heat:a,gas:o}=this.e,l=i.cellAt(n.x[t],n.y[t]);let h=l;for(;h>=0&&i.kind[h]!==N;)h=h+i.nx<i.n?h+i.nx:-1;if(e>0&&h>=0&&l>=0){const f=n.T[t];i.mg[K*i.n+h]+=e,i.Hg[h]+=e*gt(f),a.src[l]-=e*(gt(f)-n.h[t])/s,this.produced+=e,o.deriveCell(h)}else if(e>0&&l>=0){for(let f=0;f<n.count;f+=1)if(f!==t&&n.mat[f]===n.mat[t]&&i.cellAt(n.x[f],n.y[f])===l){const d=n.mass[f]*n.h[f]+e*n.h[t];n.mass[f]+=e,n.h[f]=d/n.mass[f],n.derive(f);break}}r.removeParticle(t)}step(t){this.diffuse(t),this.flash(),this.fog(),this.films()}diffuse(t){const e=this.e,{grid:s,gas:i,regions:n,heat:r,solver:a}=e,{nx:o,ny:l,n:h,depth:f,kind:d}=s,{mtot:m,rd:u,Y0:v,Tl:p,Fm:x,Fe:w,edge:b,hvC:F,hnC:y,hoC:A}=this;let _=!1;for(let C=0;C<h;C+=1){if(d[C]!==N){m[C]=0;continue}const W=s.mg[C]+s.mg[h+C]+s.mg[K*h+C];m[C]=W,v[C]=W>0?s.mg[K*h+C]/W:0;const M=s.T[C];u[C]=i.rho[C]*lo(M,n.pAt(C)),F[C]=gt(M),y[C]=Wt(nt,M),A[C]=Wt(rt,M),_=!0}if(!_)return;for(let C=0;C<l;C+=1)for(let W=0;W<o;W+=1){const M=W+C*o;b[M]=d[M]===N&&(W===0||C===0||W===o-1||C===l-1||d[M-1]!==N||d[M+1]!==N||d[M-o]!==N||d[M+o]!==N)?1:0}const P=a.begin(o,l),S=P.stride,L=e.ambientY[K],{bG:O,bY:q}=this;for(let C=0;C<l;C+=1)for(let W=0;W<o;W+=1){const M=W+C*o;if(d[M]!==N||m[M]<=0)continue;const D=W+1+(C+1)*S;P.act[D]=1,P.x[D]=v[M],P.dH[D]=m[M]/t;let J=m[M]*v[M]/t;if(W+1<o&&d[M+1]===N&&m[M+1]>0&&(P.ax[D]=.5*(u[M]+u[M+1])*f),C+1<l&&d[M+o]===N&&m[M+o]>0&&(P.ay[D]=.5*(u[M]+u[M+o])*f),b[M]===0){P.b[D]=J;continue}let j=0;for(let Z=0;Z<4;Z+=1){const $=this.boundary(M,W,C,Z,L);O[4*M+Z]=$,q[4*M+Z]=this.yb,!($<=0)&&(j+=$,J+=$*this.yb)}P.dDx[D]=j,P.b[D]=J}a.solve(1e-9,200,!1),x.fill(0),w.fill(0);const Q=P.x;for(let C=0;C<l;C+=1)for(let W=0;W<o;W+=1){const M=W+C*o;if(d[M]!==N||m[M]<=0)continue;const D=W+1+(C+1)*S,J=Q[D];if(W+1<o&&d[M+1]===N&&m[M+1]>0&&this.exchange(M,M+1,t*.5*(u[M]+u[M+1])*f*(J-Q[D+1])),C+1<l&&d[M+o]===N&&m[M+o]>0&&this.exchange(M,M+o,t*.5*(u[M]+u[M+o])*f*(J-Q[D+S])),b[M]!==0)for(let j=0;j<4;j+=1){const Z=O[4*M+j];if(Z<=0)continue;const $=t*Z*(q[4*M+j]-J),I=(j===0?W===0:j===1?W===o-1:j===2?C===0:C===l-1)?-1:j===0?M-1:j===1?M+1:j===2?M-o:M+o;if(I<0)this.ambientExchange(M,$);else if(d[I]===lt)if($>0){const X=p[I];s.mg[K*h+M]+=$,s.Hg[M]+=$*gt(X),x[I]-=$,w[I]-=$*gt(X),this.produced+=$}else{const X=Math.min(-$,s.mg[K*h+M]);s.mg[K*h+M]-=X,s.Hg[M]-=X*gt(s.T[M]),x[I]+=X,w[I]+=X*gt(s.T[M]),this.condensed+=X}else if(d[I]===ht){const X=s.T[I];if($<0){const V=Math.min(-$,s.mg[K*h+M]);s.mg[K*h+M]-=V,s.Hg[M]-=V*gt(s.T[M]),s.film[I]+=V,s.Es[I]+=V*qt(X),r.src[I]+=V*(gt(s.T[M])-qt(X))/t,this.dew+=V}else{const V=Math.min($,s.film[I]);s.film[I]-=V,s.Es[I]-=V*qt(X),s.mg[K*h+M]+=V,s.Hg[M]+=V*gt(X),r.src[I]-=V*(gt(X)-qt(X))/t,this.dew-=V}}}}for(let C=0;C<h;C+=1)x[C]!==0&&(r.src[C]+=(w[C]-x[C]*this.waterH(C))/t);this.applyMass(x,t);for(let C=0;C<h;C+=1)d[C]===N&&m[C]>0&&i.deriveCell(C)}boundary(t,e,s,i,n){const r=this.e.grid,{nx:a,ny:o,depth:l,kind:h}=r,f=i===0?e===0:i===1?e===a-1:i===2?s===0:s===o-1,d=2*this.rd[t]*l;if(f)return this.side[i]=-1,(i===0?r.openL:i===1?r.openR:i===2?r.openB:r.openT)?(this.yb=n,d):0;const m=i===0?t-1:i===1?t+1:i===2?t-a:t+a;this.side[i]=m;const u=h[m],v=this.Y0[t],p=this.e.regions.pAt(t);if(u===lt){const x=this.waterShare(m);return x<=0?0:(this.yb=this.ysat(this.Tl[m],p,t),d*(1-v)*x)}if(u===ht){const x=this.ysat(r.T[m],p,t);return v>x||r.film[m]>0&&v<x?(this.yb=x,d*(1-v)):0}return 0}exchange(t,e,s){const i=this.e.grid,n=i.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let o=Math.abs(s);o=Math.min(o,i.mg[K*n+r]);const l=i.mg[nt*n+a],h=i.mg[rt*n+a],f=l+h,d=Math.min(o,f);if(o<=0)return;const m=this.hvC[r];if(i.mg[K*n+r]-=o,i.mg[K*n+a]+=o,i.Hg[r]-=o*m,i.Hg[a]+=o*m,d>0){const u=d*l/f,v=d-u;i.mg[nt*n+a]-=u,i.mg[rt*n+a]-=v,i.mg[nt*n+r]+=u,i.mg[rt*n+r]+=v;const p=u*this.hnC[a]+v*this.hoC[a];i.Hg[a]-=p,i.Hg[r]+=p}}ambientExchange(t,e){const s=this.e,i=s.grid,n=i.n,r=s.ambientT;if(e>0){const a=i.mg[nt*n+t]+i.mg[rt*n+t],o=Math.min(e,a);if(i.mg[K*n+t]+=e,i.Hg[t]+=e*gt(r),o>0){const l=o*i.mg[nt*n+t]/a,h=o-l;i.mg[nt*n+t]-=l,i.mg[rt*n+t]-=h;const f=l*Wt(nt,i.T[t])+h*Wt(rt,i.T[t]);i.Hg[t]-=f,s.flows.escapedAir+=o,s.flows.escapedEnergy+=f}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*gt(r)}else if(e<0){const a=Math.min(-e,i.mg[K*n+t]),o=s.ambientY[nt],l=s.ambientY[rt],h=o+l>0?o+l:1;i.mg[K*n+t]-=a,i.Hg[t]-=a*gt(i.T[t]);const f=a*o/h,d=a-f;i.mg[nt*n+t]+=f,i.mg[rt*n+t]+=d;const m=f*Wt(nt,r)+d*Wt(rt,r);i.Hg[t]+=m,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*gt(i.T[t])-m}}flash(){const t=this.e,{grid:e,particles:s,liquid:i,regions:n,gas:r}=t,{nx:a,ny:o,n:l,kind:h}=e,{Tl:f}=this,d=this.rd;let m=!1;for(let p=0;p<l;p+=1){if(d[p]=0,h[p]!==lt)continue;const x=p%a,w=(p-x)/a,b=w+1<o?p+a:-1;if(!(b>=0&&h[b]===N||x>0&&h[p-1]===N||x<a-1&&h[p+1]===N||w>0&&h[p-a]===N))continue;const y=Pt(n.pAt(p));f[p]>y&&(d[p]=y,m=!0)}if(!m)return;const u=this.mtot;u.fill(0);const v=this.Y0;v.fill(0);for(let p=0;p<s.count;p+=1){if(s.mat[p]!==pt)continue;const x=9*p;let w=0,b=0;for(let A=0;A<9;A+=1){const _=i.wt[x+A];if(_===0)continue;const P=i.bi[p]+A%3,S=i.bj[p]+(A/3|0);if(P<0||S<0||P>=a||S>=o)continue;const L=P+S*a,O=d[L];if(O===0)continue;const q=qt(O);if(s.h[p]<=q)continue;const Q=gt(O),C=_*s.mass[p]*(s.h[p]-q)/(Q-q);w+=C,b+=C*Q,u[L]+=C,v[L]+=C*Q}if(w===0)continue;const F=s.mass[p]/s.rho[p],y=s.mass[p]-w;s.h[p]=(s.mass[p]*s.h[p]-b)/y,s.mass[p]=y,s.derive(p),i.dVp[p]+=y/s.rho[p]-F}for(let p=0;p<l;p+=1){if(u[p]===0)continue;const x=p%a,w=(p-x)/a;let b=0;const F=w+1<o&&h[p+a]===N?p+a:-1;if(F>=0)e.mg[K*l+F]+=u[p],e.Hg[F]+=v[p],r.deriveCell(F);else{const y=this.side;y[0]=x>0&&h[p-1]===N?p-1:-1,y[1]=x<a-1&&h[p+1]===N?p+1:-1,y[2]=w>0&&h[p-a]===N?p-a:-1,y[3]=-1;for(let A=0;A<3;A+=1)y[A]>=0&&(b+=1);for(let A=0;A<3;A+=1)y[A]<0||(e.mg[K*l+y[A]]+=u[p]/b,e.Hg[y[A]]+=v[p]/b,r.deriveCell(y[A]))}this.produced+=u[p]}}tempWith(t,e,s,i){const n=this.e.grid,r=n.n,a=n.mg[nt*r+t],o=n.mg[rt*r+t],l=n.Hg[t];if(s<=0)return fr(a,o,e,l);let h=i;for(let f=0;f<6;f+=1){const d=a*Wt(nt,h)+o*Wt(rt,h)+e*gt(h)+s*qt(h),m=(l-d)/Ei(a,o,e,s,h);if(h+=m,Math.abs(m)<1e-10)break}return h}satGap(t,e,s,i,n){const r=this.e.grid,a=r.n,o=r.mg[K*a+t]-e,l=r.mfog[t]+e,h=this.tempWith(t,o,l,n),f=o/ut[K];return(f+s>0?f/(f+s)*i:0)-ps(h)}fog(){const{grid:t,gas:e,regions:s}=this.e,i=t.n;this.fogError=0,this.fogWrong=0;for(let n=0;n<i;n+=1){if(t.kind[n]!==N)continue;const r=t.mg[K*i+n],a=t.mfog[n];if(r<=0&&a<=0)continue;const o=t.mg[nt*i+n]/ut[nt]+t.mg[rt*i+n]/ut[rt],l=s.pAt(n),h=t.T[n];if(a<=0){const w=r/ut[K];if(w/(w+o)*l<.999*ps(h))continue}const f=this.satGap(n,0,o,l,h);if(f<=0&&a<=0)continue;let d,m,u,v;if(f>0)d=0,u=f,m=r,v=this.satGap(n,m,o,l,h);else if(m=0,v=f,d=-a,u=this.satGap(n,d,o,l,h),u<=0){this.setFog(n,d);continue}if(v>0){this.setFog(n,m);continue}let p=d,x=0;for(let w=0;w<40;w+=1){p=(d*v-m*u)/(v-u),(!Number.isFinite(p)||p<=Math.min(d,m)||p>=Math.max(d,m))&&(p=.5*(d+m));const b=this.satGap(n,p,o,l,h);if(Math.abs(b)<=1e-13*l)break;b>0?(d=p,u=b,x===1&&(v/=2),x=1):(m=p,v=b,x===-1&&(u/=2),x=-1)}if(this.setFog(n,p),f<0&&p>0&&(this.fogWrong+=1),t.mfog[n]>0){const w=this.satGap(n,0,o,l,t.T[n]);this.fogError=Math.max(this.fogError,Math.abs(w)/ps(t.T[n]))}}}setFog(t,e){const{grid:s,gas:i}=this.e,n=s.n;if(e===0||!Number.isFinite(e))return;const r=Math.max(-s.mfog[t],Math.min(s.mg[K*n+t],e));s.mg[K*n+t]-=r,s.mfog[t]+=r,s.mfog[t]<1e-30&&(s.mfog[t]=0),this.fogMade+=r,i.deriveCell(t)}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:i,ny:n,n:r,kind:a}=t,o=s.rhoRef*t.vCell/4;for(let l=0;l<r;l+=1){if(t.solid[l]===0||t.film[l]<o)continue;const h=l%i,f=(l-h)/i,m=[h>0?l-1:-1,h<i-1?l+1:-1,f+1<n?l+i:-1,f>0?l-i:-1].find(F=>F>=0&&a[F]===N);if(m===void 0)continue;const u=m%i,v=(m-u)/i,p=(u+.5+.25*Math.sign(h-u))*t.dx,x=(v+.5+.25*Math.sign(f-v))*t.dx,w=t.T[l],b=e.add(p,x,o,qt(w),pt);b<0||(t.film[l]-=o,t.Es[l]-=o*qt(w),s.placeParticle(b),s.dVp[b]=o/e.rho[b])}}}class Xo{constructor(t){g(this,"g");g(this,"id");g(this,"count",0);g(this,"open",new Uint8Array(4));g(this,"vFluid",new Float64Array(4));g(this,"p0",new Float64Array(4));g(this,"rhoBar",new Float64Array(4));g(this,"vLiq",new Float64Array(4));g(this,"vBub",new Float64Array(4));g(this,"vGas",new Float64Array(4));g(this,"nSum",new Float64Array(4));g(this,"mSum",new Float64Array(4));g(this,"stack");g(this,"pAmb",101325);g(this,"rhoAmb",1.2);g(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=n=>{const r=new Uint8Array(e);return r.set(n),r},i=n=>{const r=new Float64Array(e);return r.set(n),r};this.open=s(this.open),this.vFluid=i(this.vFluid),this.p0=i(this.p0),this.rhoBar=i(this.rhoBar),this.vLiq=i(this.vLiq),this.vBub=i(this.vBub),this.vGas=i(this.vGas),this.nSum=i(this.nSum),this.mSum=i(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:i}=t;this.id.fill(-1);let n=0;for(let r=0;r<t.n;r+=1){if(i[r]!==0||this.id[r]!==-1)continue;this.grow(n);let a=0,o=0,l=0;for(this.stack[a++]=r,this.id[r]=n;a>0;){const h=this.stack[--a];l+=1;const f=h%e,d=(h-f)/e;(f===0&&t.openL||f===e-1&&t.openR||d===0&&t.openB||d===s-1&&t.openT)&&(o=1),f>0&&i[h-1]===0&&this.id[h-1]===-1&&(this.id[h-1]=n,this.stack[a++]=h-1),f<e-1&&i[h+1]===0&&this.id[h+1]===-1&&(this.id[h+1]=n,this.stack[a++]=h+1),d>0&&i[h-e]===0&&this.id[h-e]===-1&&(this.id[h-e]=n,this.stack[a++]=h-e),d<s-1&&i[h+e]===0&&this.id[h+e]===-1&&(this.id[h+e]=n,this.stack[a++]=h+e)}this.open[n]=o,this.vFluid[n]=l*t.vCell,n+=1}this.count=n}volumes(t,e){const s=this.g;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let i=0;i<t.count;i+=1){const n=s.cellAt(t.x[i],t.y[i]),r=n<0?-1:this.id[n];r>=0&&(this.vLiq[r]+=t.mass[i]/t.rho[i])}for(let i=0;i<e.count;i+=1){const n=s.cellAt(e.x[i],e.y[i]),r=n<0?-1:this.id[n];r>=0&&(this.vBub[r]+=e.V[i])}for(let i=0;i<this.count;i+=1)this.vGas[i]=Math.max(.001*this.vFluid[i],this.vFluid[i]-this.vLiq[i]-this.vBub[i])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const i=s.n;for(let n=0;n<i;n+=1){const r=this.id[n];if(!(r<0))for(let a=0;a<dt;a+=1){const o=s.mg[a*i+n];this.mSum[r]+=o,this.nSum[r]+=o/ut[a]}}for(let n=0;n<this.count;n+=1){if(this.open[n]!==0){this.p0[n]=this.pAmb,this.rhoBar[n]=this.rhoAmb;continue}this.rhoBar[n]=this.mSum[n]/this.vGas[n],this.p0[n]=this.statePressure(n)}}statePressure(t){const e=this.g,s=e.n;let i=0;for(let o=0;o<s;o+=1){if(this.id[o]!==t||e.kind[o]===ht)continue;let l=0;for(let h=0;h<dt;h+=1)l+=e.mg[h*s+o]/ut[h];i+=l*Et*e.T[o]}if(i<=0)return this.pAmb;const n=this.vGas[t];let r=i/n;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let o=0;o<2;o+=1){let l=-n,h=0;for(let f=0;f<s;f+=1){if(this.id[f]!==t||e.kind[f]===ht)continue;let d=0;for(let v=0;v<dt;v+=1)d+=e.mg[v*s+f]/ut[v];const m=r-a*(e.dx*((f-f%e.nx)/e.nx+.5)),u=d*Et*e.T[f];l+=u/m,h-=u/(m*m)}r-=l/h}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,i=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*i}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===N)return s;return-1}}const Vi="recreatio/lab2d",Yo={"very-high":.001,high:.002,medium:.003},Jo=c=>c==="very-high"||c==="high"||c==="medium",Zo=16e4,vt=(c,t)=>typeof c=="number"&&Number.isFinite(c)?c:t,Tt=(c,t,e)=>Math.min(e,Math.max(t,c)),Le=c=>c!==null&&typeof c=="object"&&!Array.isArray(c)?c:{},Rs=(c,t)=>c==="wall"||c==="open"?c:t,Mn=.25*ai,vi=2*ai;function Ln(c){const t={};let e=0;for(const[s,i]of Object.entries(Le(c)))typeof i=="number"&&Number.isFinite(i)&&i>0&&(t[s]=i,e+=i);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function ta(c,t,e){const s=Le(c),i=mt+vt(s.T,20),n=r=>{const a=typeof s.material=="string"?s.material:r;return Ns(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=Bs(s.region);if(r===null)break;const a=s.phase==="gas"?"gas":"liquid",o=Ln(s.composition),l=d=>a==="gas"?d==="N2"||d==="O2"||d==="H2O":dr(d)>=0,h={};for(const[d,m]of Object.entries(o))l(d)?h[d]=m:t.push(`ops[${e}]: unknown ${a} "${d}" dropped`);const f=Object.keys(h).length>0?Ln(h):a==="gas"?{N2:.7676,O2:.2324}:{H2O:1};return{op:"fill",region:r,phase:a,T:i,composition:f}}case"erase":{const r=Bs(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=Bs(s.region);if(r===null)break;return{op:"move",region:r,dx:Tt(vt(s.dx,0),-1,1),dy:Tt(vt(s.dy,0),-1,1)}}case"solid":{const r=Bs(s.region);if(r===null)break;return{op:"solid",region:r,material:n("glass"),T:i}}case"beaker":return{op:"beaker",x:vt(s.x,.1),y:vt(s.y,0),w:Tt(vt(s.w,.07),.01,1),h:Tt(vt(s.h,.09),.01,1),wall:Tt(vt(s.wall,.002),5e-4,.02),material:n("glass"),T:i,lid:s.lid===!0};case"hotplate":return{op:"hotplate",x:vt(s.x,.1),y:vt(s.y,0),w:Tt(vt(s.w,.12),.005,1),h:Tt(vt(s.h,.008),.002,.1),material:n("steel"),T:i,mode:s.mode==="thermostat"?"thermostat":"power",power:Tt(vt(s.power,40),0,2e3),target:mt+Tt(vt(s.target,150),0,600),on:s.on!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function xi(c,t={}){const e=Le(c),s=[];e.format!==void 0&&e.format!==Vi&&s.push(`format "${String(e.format)}" is not ${Vi}`);const i=Le(e.box),n=Le(e.ambient),r=Le(n.air),a=Le(e.sides),o=vt(n.g,ai),l=t.harness===!0?Tt(o,0,vi):Tt(o,Mn,vi);l!==o&&s.push(`ambient.g ${o} m/s² is outside ${Mn.toFixed(2)}–${vi.toFixed(2)}, using ${l.toFixed(2)}`);const h=vt(r.N2,.7676),f=vt(r.O2,.2324),d=h+f>0?h+f:1,m=[];return Array.isArray(e.ops)&&e.ops.forEach((u,v)=>{const p=ta(u,s,v);p!==null&&m.push(p)}),{scene:{seed:Math.floor(vt(e.seed,1))>>>0,box:{w:Tt(vt(i.w,.2),.02,.6),h:Tt(vt(i.h,.15),.02,.4),depth:Tt(vt(i.depth,.01),.002,.05)},ambient:{p:Tt(vt(n.p,ys/1e3),20,400)*1e3,T:mt+Tt(vt(n.T,20),-20,100),rh:Tt(vt(n.rh,.5),0,1),g:l,air:{N2:Math.max(0,h)/d,O2:Math.max(0,f)/d}},sides:{left:Rs(a.left,"wall"),right:Rs(a.right,"wall"),bottom:Rs(a.bottom,"wall"),top:Rs(a.top,"open")},quality:Jo(e.quality)?e.quality:"high",ops:m},warnings:s}}const ne=(c,t=6)=>Number(c.toFixed(t));function ea(c){switch(c.op){case"fill":return{op:"fill",region:js(c.region),composition:{...c.composition},phase:c.phase,T:ne(c.T-mt,3)};case"erase":return{op:"erase",region:js(c.region)};case"move":return{op:"move",region:js(c.region),dx:ne(c.dx),dy:ne(c.dy)};case"solid":return{op:"solid",region:js(c.region),material:c.material,T:ne(c.T-mt,3)};case"beaker":return{op:"beaker",x:c.x,y:c.y,w:c.w,h:c.h,wall:c.wall,material:c.material,T:ne(c.T-mt,3),...c.lid?{lid:!0}:{}};case"hotplate":return{op:"hotplate",x:c.x,y:c.y,w:c.w,h:c.h,material:c.material,mode:c.mode,power:c.power,target:ne(c.target-mt,3),on:c.on,T:ne(c.T-mt,3)}}}function sa(c){return{format:Vi,version:1,seed:c.seed,box:{...c.box},ambient:{p:ne(c.ambient.p/1e3,4),T:ne(c.ambient.T-mt,3),rh:c.ambient.rh,g:ne(c.ambient.g,4),air:{...c.ambient.air}},sides:{...c.sides},quality:c.quality,ops:c.ops.map(ea)}}const ia=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics"],Oe=ia.length,Cn=1/120;class na{constructor(t,e={}){g(this,"scene");g(this,"options");g(this,"warnings",[]);g(this,"grid");g(this,"particles");g(this,"bubbles");g(this,"liquid");g(this,"gas");g(this,"regions");g(this,"heat");g(this,"bubbleModel");g(this,"phase");g(this,"solver");g(this,"prevKind");g(this,"p0Start",new Float64Array(8));g(this,"rng");g(this,"time",0);g(this,"steps",0);g(this,"dt",Cn);g(this,"gy",9.81);g(this,"ambientY",new Float64Array(at));g(this,"ambientT",293.15);g(this,"pRef",101325);g(this,"ledger",{water:0,air:0,energy:0,other:0});g(this,"flows",yn());g(this,"snap",Mo());g(this,"energy0",0);g(this,"water0",0);g(this,"other0",0);g(this,"cappedCount",0);g(this,"vapourRate",0);g(this,"vapourLast",0);g(this,"timings",new Float64Array(Oe));g(this,"stamp",new Float64Array(Oe+1));g(this,"stepMs",0);g(this,"quality","high");g(this,"heaterOps",new Map);this.options=e;const s=On(t)?t:xi(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??Cn}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=Yo[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),i=Math.max(4,Math.round(t.box.h/e));for(;s*i>Zo;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),i=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const n=new Eo(s,i,e,t.box.depth);n.openL=t.sides.left==="open",n.openR=t.sides.right==="open",n.openB=t.sides.bottom==="open",n.openT=t.sides.top==="open",this.grid=n,this.particles=new Ko(Math.max(4096,4*n.n+1024)),this.bubbles=new Vr(4096),this.solver=new bt(s,i),this.regions=new Xo(n),this.liquid=new Wo(n,this.particles,this.solver),this.gas=new qo(n,this.regions,this.solver),this.heat=new Vo(n,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new ko(this),this.phase=new Qo(this),this.prevKind=new Uint8Array(n.n),this.rng=new Ar(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.flows=yn(),this.heaterOps.clear(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),n.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<n.n;r+=1)n.kind[r]=N,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites();for(const r of t.ops)this.apply(r);this.settle(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.ledger.other=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total,this.other0=this.snap.other.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)t.solid[s]!==0&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,i,n,r){this.pRef=t,this.ambientT=e,this.gy=i;const a=n+r>0?n+r:1,o=(n>0?n:fo)/a,l=(r>0||n>0?r:uo)/a,h=1/(o/ut[nt]+l/ut[rt]),f=Math.min(.99,s*Zs(e)/t),d=f*ut[K]/(f*ut[K]+(1-f)*h);this.ambientY.fill(0),this.ambientY[nt]=(1-d)*o,this.ambientY[rt]=(1-d)*l,this.ambientY[K]=d;let m=0;for(let u=0;u<dt;u+=1)m+=this.ambientY[u]/ut[u];this.regions.pAmb=t,this.regions.rhoAmb=t/(Et*e*m),this.regions.gy=i,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0}apply(t){if(t.op==="fill"&&t.phase==="liquid"&&!this.surfaceAfterFill(t))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const e=this.regions.pvTerm(),s=Co(this.world(),t);return t.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,t]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-e,s!==null&&this.warnings.push(s),s}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:i}=e,n=new Uint8Array(e.n);for(let o=0;o<i;o+=1)for(let l=0;l<s;l+=1){const h=l+o*s;e.solid[h]===0&&(e.kind[h]===lt||Ee(t.region,(l+.5)*e.dx,(o+.5)*e.dx))&&(n[h]=1)}const r=new Uint8Array(e.n),a=[];for(let o=0;o<e.n;o+=1){if(n[o]===0||r[o]!==0)continue;let l=!1;for(a.push(o),r[o]=1;a.length>0;){const h=a.pop(),f=h%s,d=(h-f)/s,m=[f>0?h-1:-1,f<s-1?h+1:-1,d>0?h-s:-1,d<i-1?h+s:-1];(f===0&&e.openL||f===s-1&&e.openR||d===0&&e.openB||d===i-1&&e.openT)&&(l=!0);for(const u of m)if(!(u<0||e.solid[u]!==0)){if(n[u]===0){l=!0;continue}r[u]===0&&(r[u]=1,a.push(u))}}if(!l)return!1}return!0}setHeater(t,e,s,i,n){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=i,r.on=n;const a=this.heaterOps.get(t),o=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&o!==void 0&&o.op==="hotplate"){const l=[...this.scene.ops];l[a]={...o,mode:e,power:r.power,target:i,on:n},this.scene={...this.scene,ops:l}}}setAmbient(t,e,s,i,n){const r=this.options.harness===!0?i:Math.min(19.6133,Math.max(2.4516625,i)),a=n!==void 0&&n.N2>=0&&n.O2>=0&&n.N2+n.O2>0?{N2:n.N2/(n.N2+n.O2),O2:n.O2/(n.N2+n.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const i=this.grid;t==="left"&&(i.openL=e==="open"),t==="right"&&(i.openR=e==="open"),t==="bottom"&&(i.openB=e==="open"),t==="top"&&(i.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return sa({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=On(t)?t:xi(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setQuality(t){const e=xi(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:i,heat:n,particles:r,bubbles:a}=this,o=this.dt,l=this.stamp;l[0]=ce(),l[1]=ce(),e.splatVolumeChange(o),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),i.update(r,a),this.p0Start.length<i.count&&(this.p0Start=new Float64Array(2*i.count));for(let u=0;u<i.count;u+=1)this.p0Start[u]=i.p0[u];for(let u=0;u<t.n;u+=1)e.pGas[u]=t.kind[u]===N?i.pAt(u)-this.pRef:0;e.step(o,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedOther+=e.last.escapedOther,this.flows.escapedEnergy+=e.last.escapedEnergy,l[2]=ce(),s.updateVolumes(),s.markFaces();const h=s.escaped[K]+s.escaped[dt],f=s.escaped[nt]+s.escaped[rt],d=s.escaped[dt+1];s.transport(o),this.flows.escapedWater+=s.escaped[K]+s.escaped[dt]-h,this.flows.escapedAir+=s.escaped[nt]+s.escaped[rt]-f,this.flows.escapedEnergy+=s.escaped[dt+1]-d,s.updateEos(),s.veosMid.set(s.veos),s.velocity(o,this.gy),s.sources(o),s.project(o,this.tol,this.maxIter),l[3]=ce(),this.bubbleModel.step(o),l[4]=ce(),this.phase.step(o),l[5]=ce(),n.step(o,1e-6,200),this.flows.heater+=n.last.heater,this.flows.lossWalls+=n.last.lossWalls,this.flows.lossOpen+=n.last.lossOpen,l[6]=ce(),l[7]=ce(),i.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let u=0;u<t.n;u+=1)s.srcV[u]=t.kind[u]===N?s.veos[u]-s.veosMid[u]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),n.last.solve.capped&&(this.cappedCount+=1),this.time+=o,this.steps+=1,this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax),l[8]=ce();const m=this.steps<5?1:1/30;for(let u=0;u<Oe;u+=1)this.timings[u]+=m*(l[u+1]-l[u]-this.timings[u]);this.stepMs+=m*(l[Oe]-l[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:i,gas:n,liquid:r}=this;let a=!1;for(let o=0;o<e.count;o+=1)n.dp0[o]!==0&&(a=!0);if(a){for(let o=0;o<s.count;o+=1){const l=t.cellAt(s.x[o],s.y[o]),h=l<0?-1:e.id[l];if(h<0||n.dp0[h]===0)continue;const f=s.mass[o],d=f/s.rho[o];s.h[o]+=d*n.dp0[h]/f,s.derive(o),r.dVp[o]+=f/s.rho[o]-d}for(let o=0;o<i.count;o+=1){const l=t.cellAt(i.x[o],i.y[o]),h=l<0?-1:e.id[l];h>=0&&n.dp0[h]!==0&&(i.H[o]+=i.V[o]*n.dp0[h])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,t.editOther=this.ledger.other,So(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap)}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}otherError(){return this.measureBudget().other.total-this.other0-this.flows.editOther}waterTemperature(){const t=this.particles;let e=0,s=0,i=0;for(let n=0;n<t.count;n+=1)t.mat[n]===pt&&(e+=t.mass[n],s+=t.mass[n]*t.T[n],t.T[n]>i&&(i=t.T[n]));return{mean:e>0?s/e:0,max:i,mass:e}}otherTemperature(){const t=this.particles;let e=0,s=0;for(let i=0;i<t.count;i+=1)t.mat[i]!==pt&&(e+=t.mass[i],s+=t.mass[i]*t.T[i]);return{mean:e>0?s/e:0,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===lt?this.pRef+e.pl[t]:e.kind[t]===N?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){var A;const s=this.grid,i=s.cellAt(t,e);if(i<0)return null;const n=s.n,r=s.kind[i]===ht?"solid":s.kind[i]===lt?"liquid":"gas",a=this.pressureAt(i);let o=0;const l=[0,0,0];for(let _=0;_<dt;_+=1)l[_]=s.mg[_*n+i]/ut[_],o+=l[_];for(let _=0;_<dt;_+=1)l[_]=o>0?l[_]/o:0;const h=r==="liquid"&&s.Cl[i]>0?s.Tl[i]:s.T[i],f=r==="gas"?l[K]*a:0,d=Math.floor(t/s.dx),m=Math.floor(e/s.dx),u=r==="liquid"?.5*(s.ul[d+m*(s.nx+1)]+s.ul[d+1+m*(s.nx+1)]):.5*(s.ug[d+m*(s.nx+1)]+s.ug[d+1+m*(s.nx+1)]),v=r==="liquid"?.5*(s.vl[d+m*s.nx]+s.vl[d+(m+1)*s.nx]):.5*(s.vg[d+m*s.nx]+s.vg[d+(m+1)*s.nx]),p=this.particles;let x=-1,w=(1.5*s.dx)**2;for(let _=0;_<p.count;_+=1){const P=(p.x[_]-t)**2+(p.y[_]-e)**2;P<w&&(w=P,x=_)}const b=this.bubbles;let F=-1,y=1/0;for(let _=0;_<b.count;_+=1){const P=Math.hypot(b.x[_]-t,b.y[_]-e);P<=Math.max(b.r[_],3*s.dx)&&P<y&&(F=_,y=P)}return{x:t,y:e,cell:{kind:r,material:s.solid[i]!==0?Dt[s.solid[i]-1].id:null,T:h,p:a,Tsat:Pt(a),x:l,rh:r==="gas"?f/Zs(s.T[i]):0,fog:r==="gas"?s.mfog[i]/Math.max(1e-12,this.gas.vgas[i]):0,rho:r==="gas"?this.gas.rho[i]:r==="liquid"?this.phase.mixed?ge(this.phase.host[i],h):this.liquid.rhoRef:s.solid[i]!==0?Dt[s.solid[i]-1].rho:0,phi:s.phi[i],u,v,heater:s.role[i]===1,film:s.film[i],liquids:this.liquidsAt(i)},particle:x<0?null:{id:p.id[x],T:p.T[x],vx:p.vx[x],vy:p.vy[x],mass:p.mass[x],rho:p.rho[x],dist:Math.sqrt(w),liquid:((A=re[p.mat[x]])==null?void 0:A.id)??re[0].id},bubble:F<0?null:this.bubbleModel.describe(F)}}liquidsAt(t){const{particles:e,liquid:s,grid:i}=this,n=new Float64Array(re.length);let r=0;for(let o=0;o<e.count;o+=1)for(let l=0;l<9;l+=1){const h=s.wt[9*o+l];if(h===0)continue;const f=s.bi[o]+l%3,d=s.bj[o]+(l/3|0);f<0||d<0||f>=i.nx||d>=i.ny||f+d*i.nx!==t||(n[e.mat[o]]+=h*e.mass[o],r+=h*e.mass[o])}if(r<=0)return[];const a=[];for(let o=0;o<re.length;o+=1)n[o]>0&&a.push({id:re[o].id,share:n[o]/r});return a}stats(){const t=this.grid;let e=0,s=0;for(let u=0;u<t.n;u+=1)t.kind[u]===lt?e+=1:t.kind[u]===N&&(s+=1);const i=this.waterTemperature(),n=this.otherTemperature(),r=this.measureBudget(),a=this.flows,o=r.energy-this.energy0-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),l=r.water.total-this.water0-a.editWater,h=r.other.total-this.other0-a.editOther,f=this.phase.produced+this.bubbleModel.burstVapour,d=this.time-this.vapourLast;d>.2&&(this.vapourRate=(f-this.phase.producedMark)/d,this.phase.producedMark=f,this.vapourLast=this.time);const m=[];for(let u=0;u<this.regions.count;u+=1)m.push({p0:this.regions.p0[u],sealed:this.regions.open[u]===0,vGas:this.regions.vGas[u]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:i.mean,waterTmax:i.max,otherMass:n.mass,otherT:n.mean,heaters:this.heat.heaters.filter(u=>u.cells>0).map(u=>({group:u.group,P:u.P,Tmean:u.Tmean,mode:u.mode,power:u.power,target:u.target,on:u.on})),regions:m,budget:{...r,water:{...r.water},other:{...r.other}},flows:{...a},energyError:o,waterError:l,otherError:h,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy}}}const ce=()=>typeof performance<"u"?performance.now():Date.now();function On(c){return c!==null&&typeof c=="object"&&"box"in c&&"ops"in c&&"quality"in c&&"sides"in c&&"ambient"in c&&typeof c.ambient.p=="number"&&c.ambient.p>1e3}class kr{constructor(t){g(this,"g");g(this,"last",null);g(this,"latent0",0);g(this,"stored0",0);g(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,i=Pt(t.cpu.regions.pAmb),n=eo(i),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},o=this.last;let l=0,h=0;if(o!==null&&a.t>o.t){const m=a.t-o.t,u=(a.heater-o.heater)/m,v=(a.solids-o.solids+a.SG-o.SG+a.lossS-o.lossS+a.LG-o.LG+a.sens-o.sens+a.bub-o.bub)/m;l=(a.vap-o.vap)/m,h=Math.max(0,(u-v)/n)}this.last=a;const f=this.vapour()*n,d=r.energy;return this.started||(this.started=!0,this.latent0=f,this.stored0=d),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:i,heater:s.heater,latent:f-this.latent0,sensible:d-this.stored0-(f-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:l,expectedRate:h}}}const Je={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},is=16,G={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},Be=96,Bn=16,ra=57,Rt={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},oe=16,oa={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Ii=8,Ct={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},ee=8,aa={TSUM:0,CELLS:1},Ni=2,ca={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Sr=16,et={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},bi=55,Se={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},yi=6,Gi={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},wi=13,he={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},Fi=16,la={KNOWN:0,MARK:1,MARK2:2,GAS:3},jn=4,fa={F:0},_i=1,ua={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},Ui=12,It=(c,t)=>Object.entries(t).map(([e,s])=>`const ${c}${e}: u32 = ${s}u;`).join(`
`),ha=[It("G_",Je),It("C_",G),It("R_",Rt),It("RA_",oa),It("H_",Ct),It("HA_",aa),It("S_",ca),It("F_",et),It("U_",Se),It("A_",Gi),It("FF_",he),It("FU_",la),It("AF_",fa),It("BA_",ua),`const RACC_STRIDE: u32 = ${Ii}u;`,`const HEAT_STRIDE: u32 = ${ee}u;`,`const HACC_STRIDE: u32 = ${Ni}u;`,`const CGS_STRIDE: u32 = ${Sr}u;`,`const BACC_STRIDE: u32 = ${Ui}u;`].join(`
`);function it(c){if(!Number.isFinite(c))throw new Error(`not a finite constant: ${c}`);const t=Math.abs(c)>=1e-4&&Math.abs(c)<1e7?String(c):c.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Bt=c=>c.map(it).join(", "),Ft=St.species[0],qs=St.species[1],Es=St.species[2],je=Ft.liquid.cp.table,pe=je.map(c=>c[0]),qe=je.map(c=>c[1]),ii=[qe[0]*(pe[0]-mt)];for(let c=1;c<je.length;c+=1)ii.push(ii[c-1]+.5*(qe[c]+qe[c-1])*(pe[c]-pe[c-1]));const[da,ma,pa]=Ft.vapour.cp.linear,Hi=mt+100,ga=(()=>{let c=0;for(;c<pe.length-2&&Hi>=pe[c+1];)c+=1;const t=Hi-pe[c],e=(qe[c+1]-qe[c])/(pe[c+1]-pe[c]);return ii[c]+qe[c]*t+.5*e*t*t})(),va=ga+Ft.saturation.hlv100.v,le=St.solids,Pi=4294967295,xa=`
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
}`,Rn=44,ba=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,Ne=26,ya=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Ge=29,wa=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Ai=8,Fa=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,_a=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${it(mt)};
const R_GAS: f32 = ${it(Et)};
const P_ATM: f32 = ${it(ys)};
const G0: f32 = ${it(ai)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${it(qs.molarMass.v)};
const M_O2: f32 = ${it(Es.molarMass.v)};
const M_H2O: f32 = ${it(Ft.molarMass.v)};
const CP_N2: f32 = ${it(qs.gas.cp.v)};
const CP_O2: f32 = ${it(Es.gas.cp.v)};
const CPV0: f32 = ${it(da)};
const CPV1: f32 = ${it(ma)};
const CPV_T: f32 = ${it(pa)};
const T100: f32 = ${it(Hi)};
const HV100: f32 = ${it(va)};
const NCP: i32 = ${je.length};
const CP_T = array<f32, ${je.length}>(${Bt(pe)});
const CP_V = array<f32, ${je.length}>(${Bt(qe)});
const CP_H = array<f32, ${je.length}>(${Bt(ii)});
const KELL = array<f32, 7>(${Bt(Ft.liquid.kell.c)});
const KL = array<f32, 3>(${Bt(Ft.liquid.k.poly)});
const VA: f32 = ${it(Ft.liquid.mu.vogel[0])};
const VB: f32 = ${it(Ft.liquid.mu.vogel[1])};
const VC: f32 = ${it(Ft.liquid.mu.vogel[2])};
const ST_B: f32 = ${it(Ft.surfaceTension.B)};
const ST_b: f32 = ${it(Ft.surfaceTension.b)};
const ST_MU: f32 = ${it(Ft.surfaceTension.mu)};
const T_CRIT: f32 = ${it(Ft.saturation.Tc.v)};
const RHO_CRIT: f32 = ${it(Ft.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Bt(Ft.saturation.if97.n)});
const RVC = array<f32, 6>(${Bt(Ft.saturation.vapourDensity.c)});
const KV: f32 = ${it(Ft.vapour.k.v)};
const MUV: f32 = ${it(Ft.vapour.mu.v)};
const KN = array<f32, 3>(${Bt(qs.gas.k.power)});
const KO = array<f32, 3>(${Bt(Es.gas.k.power)});
const MN = array<f32, 3>(${Bt(qs.gas.mu.sutherland)});
const MO = array<f32, 3>(${Bt(Es.gas.mu.sutherland)});
const DV0: f32 = ${it(St.vapourInAir.D0.v)};
const DVT0: f32 = ${it(St.vapourInAir.T0.v)};
const DVE: f32 = ${it(St.vapourInAir.exponent.v)};
const NSOL: u32 = ${le.length}u;
const S_RHO = array<f32, ${le.length}>(${Bt(le.map(c=>c.rho.v))});
const S_CP = array<f32, ${le.length}>(${Bt(le.map(c=>c.cp.v))});
const S_K = array<f32, ${le.length}>(${Bt(le.map(c=>c.k.v))});
const S_THETA = array<f32, ${le.length}>(${Bt(le.map(c=>c.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${it(Pr)};
const REG_STRIDE: u32 = ${oe}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${it(ur)};
`,Pa=`
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
`,Aa=`
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
`,nn=[xa,ba,ya,wa,Fa,_a,ha,Pa,Aa].join(`
`);class Ta{constructor(t){g(this,"name");g(this,"binds");g(this,"wg");g(this,"source");g(this,"pipeline",null);g(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=Sa(t.bind),this.source=Ca(t,this.binds,this.wg)}}const ka={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function Sa(c){return c.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],i=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":ka[e[1]]??"f32");return{name:e[1],mode:s,type:i}})}const Ma=`
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
`,La=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function Ca(c,t,e){const s=[nn,`const WG: u32 = ${e}u;`,Ma],i=new Set(t.map(n=>n.name));for(const n of t)n.mode==="a"&&i.add(`${n.name}!`);for(const n of La)n.needs.every(r=>i.has(r))&&s.push(n.code);return t.forEach((n,r)=>{n.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${n.name}: ${n.type};`):n.mode==="t"?s.push(`@group(0) @binding(${r}) var ${n.name}: texture_storage_2d<rgba8unorm, write>;`):n.mode==="x"?s.push(`@group(0) @binding(${r}) var ${n.name}: texture_2d<f32>;`):n.mode==="s"?s.push(`@group(0) @binding(${r}) var ${n.name}: sampler;`):n.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${n.name}: array<${n.type}>;`):n.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${n.name}: array<${n.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${n.name}: array<atomic<u32>>;`),s.push(`fn addF_${n.name}(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&${n.name}[i]);
  loop {
    let r = atomicCompareExchangeWeak(&${n.name}[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn getF_${n.name}(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&${n.name}[i])); }
fn setF_${n.name}(i: u32, v: f32) { atomicStore(&${n.name}[i], bitcast<u32>(v)); }
fn maxU_${n.name}(i: u32, v: f32) { atomicMax(&${n.name}[i], bitcast<u32>(max(v, 0.0))); }`))}),s.push(c.code),s.join(`
`)}class rn{constructor(t){g(this,"device");g(this,"kernels",new Map);g(this,"timestamps");g(this,"bufs",[]);g(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const i=e.limits,n=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,i.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:i.maxStorageBufferBindingSize,maxBufferSize:i.maxBufferSize,maxComputeWorkgroupStorageSize:i.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,i.maxComputeInvocationsPerWorkgroup)}});return new rn(n)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const i=new Ta(s);this.kernels.set(s.name,i);const n=this.device.createShaderModule({code:i.source,label:s.name}),a=(await n.getCompilationInfo()).messages.filter(l=>l.type==="error");if(a.length>0){const l=i.source.split(`
`);for(const h of a)e.push(`${s.name}:${h.lineNum}:${h.linePos} ${h.message}
    ${l[h.lineNum-1]??""}`);return}const o=this.device.createBindGroupLayout({label:s.name,entries:i.binds.map((l,h)=>l.mode==="t"?{binding:h,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:l.mode==="x"?{binding:h,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:l.mode==="s"?{binding:h,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:h,visibility:GPUShaderStage.COMPUTE,buffer:{type:l.mode==="u"?"uniform":l.mode==="r"?"read-only-storage":"storage"}})});i.layout=o;try{i.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:n,entryPoint:"main"}})}catch(l){e.push(`${s.name}: ${l instanceof Error?l.message:String(l)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((i,n)=>{const r=e[i.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${i.name}"`);return"view"in r?{binding:n,resource:r.view}:"sampler"in r?{binding:n,resource:r.sampler}:{binding:n,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const i=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:i,endOfPassWriteIndex:i+1}})}dispatch(t,e,s,i){const n=this.kernel(e),r=this.own(t,e);r.setPipeline(n.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(i/n.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,i){const n=this.kernel(e),r=this.own(t,e);r.setPipeline(n.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(i,0),r!==t&&r.end()}dispatchOne(t,e,s){const i=this.kernel(e),n=this.own(t,e);n.setPipeline(i.pipeline),n.setBindGroup(0,s),n.dispatchWorkgroups(1),n!==t&&n.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const i=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(i),i}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const qn=64,En="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",bs=`
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
`,Mr=`
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
`,Oa=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,Ba=`
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
`,ja=[{name:"bubNucleate",wg:qn,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${bs}
${En} {
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
}`},{name:"bubAdvance",wg:qn,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${bs}
${Mr}
${Oa}
${Ba}
${En} {
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
}`}],Ue=64,be="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ra=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,qa=[{name:"bubTarget",wg:Ue,bind:"P:u cnt:a bubs:r btarget:w",code:`${be} {
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
}`},{name:"bubMerge",wg:Ue,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${be} {
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
}`},{name:"bubMergeFinal",wg:Ue,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${bs}
${be} {
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
}`},{name:"bubFinish",wg:Ue,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${bs}
${Mr}
${Ra}
${be} {
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
${be} {
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
}`},{name:"bubCopyBack",wg:Ue,bind:"P:u cnt:a bubs:w bubs2:r",code:`${be} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:Ue,bind:"P:u cnt:a bubs:r at:a",code:`${bs}
${be} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${be} {
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
}`}],de=128,Zt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ni=`
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
`,Dn=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,Ti=`
var<workgroup> rr: array<f32, ${16*de}>;
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
`,Ea=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([c,t])=>({name:c,wg:de,bind:"P:u cf:w cu:r at:w reg:r",code:`${ni}
${Zt} {
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
}`})),{name:"transitions",wg:de,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${Zt} {
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
}`},{name:"regCells",wg:de,bind:"P:u cf:r cu:r racc:a",code:`${Ti}
${Zt} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${Ti}
${Zt} {
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
}`},{name:"regBubs",wg:de,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${Zt} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([c,t])=>({name:c,wg:64,bind:"P:u reg:w racc:a",code:`${Dn}
${Zt} {
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
}`})),{name:"compSums",wg:de,bind:"P:u cf:r cu:r reg:r racc:a",code:`${Ti}
${Zt} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([c,t])=>({name:c,wg:64,bind:"P:u reg:w racc:a",code:`${Dn}
${Zt} {
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
}`})),{name:"compApply",wg:de,bind:"P:u cf:w cu:r reg:r",code:`${ni}
${Zt} {
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
}`},{name:"gasVolumes",wg:de,bind:"P:u cf:w cu:r reg:r",code:`${Zt} {
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
}`},{name:"markFaces",wg:de,bind:"P:u cu:r ff:w fu:w",code:`${Zt} {
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
}`}],Ds=128,Ae=128,Gt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Yt=`
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
`,Vn=`
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
`,Da=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,In=1,Va=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${Gt} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${In}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${Gt} {
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
${Gt} {
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
    pargs[0] = max(1u, (total + ${Ds-1}u) / ${Ds}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${Gt} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:Ae,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${Yt}
${Da}
${Gt} {
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
}`},{name:"classify",wg:Ae,bind:"P:u cf:r cu:w",code:`${Gt} {
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
}`},{name:"p2g",wg:Ae,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Vn}
${Gt} {
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
}`},{name:"liqAssemble",wg:Ae,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${Gt} {
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
}`},{name:"liqPressure",wg:Ae,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${Gt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:Ae,bind:"P:u glob:r cf:r ff:w fu:w",code:`${Gt} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([c,t,e,s,i,n])=>({name:c,wg:Ae,bind:"P:u ff:w fu:w",code:`${Gt} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let os = ${t} * P.nf;
  let om = ${s} * P.nf;
  let mk = fu[om + f];
  if (mk != 0u) {
    ff[${e} * P.nf + f] = ff[os + f];
    fu[${i} * P.nf + f] = mk;
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
  if (n > 0.0) { ff[${e} * P.nf + f] = s / n; fu[${i} * P.nf + f] = 1u; }
  else { ff[${e} * P.nf + f] = ${n?"0.0":"ff[os + f]"}; fu[${i} * P.nf + f] = 0u; }
}`})),{name:"g2p",wg:Ds,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${Vn}
${Yt}
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
${Gt} {
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
      q.flags = q.flags | ${In}u;
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
}`},{name:"heatWeights",wg:Ds,bind:"P:u cnt:a cu:r parts:w",code:`${Yt}
${Gt} {
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
}`}],fe=128,ue="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Nn=`
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
`,Gn=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,Un=`
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
`,Ia=[{name:"gasMaxOut",wg:fe,bind:"P:u cu:r ff:r cnt:a",code:`${Yt}
${ue} {
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
}`},{name:"gasFlux",wg:fe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Nn}
${Gn}
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
${ue} {
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
}`},{name:"gasMove",wg:fe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Nn}
${Gn}
${Yt}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${ue} {
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
}`},{name:"macFwd",wg:fe,bind:"P:u glob:r ff:w fu:r",code:`${Un}
${ue} {
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
}`},{name:"macBack",wg:fe,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${Un}
${ue} {
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
}`},{name:"viscosity",wg:fe,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${ue} {
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
}`},{name:"gasAssemble",wg:fe,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${ue} {
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
}`},{name:"gasPressure",wg:fe,bind:"P:u cf:w cu:r cgv:r",code:`${ue} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:fe,bind:"P:u glob:r cf:r ff:w fu:r",code:`${ue} {
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
}`}],Ut=128,Ht="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ze=`
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
`,Na=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,Ga=[...[["gatherFull",!0],["gatherPlain",!1]].map(([c,t])=>({name:c,wg:Ut,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Ze}
${Ht} {
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
}`})),{name:"applyMass",wg:Ut,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ze}
${Yt}
${Ht} {
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
}`},{name:"diffPrep",wg:Ut,bind:"P:u cf:w cu:w reg:r",code:`${Ht} {
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
}`},{name:"diffAssemble",wg:Ut,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${Na}
${Ht} {
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
}`},{name:"diffFaces",wg:Ut,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Ht} {
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
}`},{name:"diffApply",wg:Ut,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${Yt}
${Ht} {
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
}`},{name:"latentSrc",wg:Ut,bind:"P:u glob:r cf:r at:a",code:`${Ht} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:Ut,bind:"P:u cf:w cu:r reg:r",code:`${Ht} {
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
}`},{name:"flashVap",wg:Ut,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Ze}
${Ht} {
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
}`},{name:"flashParts",wg:Ut,bind:"P:u cnt:a cf:r parts:w",code:`${Ze}
${Ht} {
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
}`},{name:"flashDist",wg:Ut,bind:"P:u cnt:a cf:r cu:r at:a",code:`${Yt}
${Ht} {
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
}`},{name:"fog",wg:Ut,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${ni}
${Yt}
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
${Ht} {
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
}`},{name:"films",wg:Ut,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${Ht} {
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
}`}],Xe=800,Ua=24,Hn=6,Mt=4,ns=16,jt=256,$n=`struct Levels { lv: array<Level, ${ns}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,As=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Ws=`${As}
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
`,me=`
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
`,Te=`
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
`,Wn=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Kn=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,yt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ye=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,Lr=6,He=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,ki=`
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
`,Si="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Ha=[{name:"cgPrep1",wg:jt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${As}
${yt} {
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
}`},{name:"cgPrep2",wg:jt,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${ye}
${Ws}
${yt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${Lr}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:jt,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${yt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:jt,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${ye}
${ki}
${He}
${yt} {
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
}`},{name:"cclProject",wg:jt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${ye}
${Si}
${He}
${yt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:jt,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${ye}
${As}
${Te}
${yt} {
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
}`},{name:"cgFoldInitMG",wg:jt,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${Te}
${Kn}
${yt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${ye}
${me}
${Te}
${Wn}
${yt} {
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
}`},{name:"cgB",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${ye}
${me}
${Te}
${Wn}
var<workgroup> wpq: f32;
${yt} {
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
}`},{name:"cgFoldRR",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${me}
${Te}
${Kn}
${yt} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${me}
${Te}
${yt} {
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
}`},{name:"cgZSum",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${me}
${ki}
${He}
${yt} {
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
}`},{name:"cgZSub",wg:jt,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${me}
${Si}
${He}
${Te}
${yt} {
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
}`},{name:"cgEnd1",wg:jt,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${ye}
${ki}
${He}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${yt} {
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
}`},{name:"cgEnd2",wg:jt,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${ye}
${Si}
${He}
${yt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],$a=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Wa(c,t){const e=[];let s=0,i=0,n=c,r=t,a=1,o=0;for(;;){const h=n+2,f=(n+2)*(r+2),d={};for(const v of $a)d[v]=s,s+=f;const m=i;i+=f;let u=0;if(d.pW=0,e.length>0&&(d.pW=s,s+=4*o,u=i,i+=4*o),e.push({nx:n,ny:r,stride:h,size:f,h:a,f:d,act:m,pIdx:u}),n*r<=Ua||n<=2&&r<=2||e.length>=ns)break;o=f,n=Math.ceil(n/2),r=Math.ceil(r/2),a*=2}let l=e.length-1;for(let h=0;h<e.length;h+=1){let f=0;for(let d=h;d<e.length;d+=1)f+=e[d].size;if(f<=Xe){l=h;break}}return{levels:e,fSize:s,uSize:i,lt:l}}function Vs(c,t,e,s){if(c===null)return;const i=[c.nx,c.ny,c.stride,c.size,c.f.ax,c.f.ay,c.f.dH,c.f.dDx,c.f.dDy,c.f.diag,c.f.inv,c.f.x,c.f.b,c.h,c.f.gx,c.f.gy,c.f.gDx,c.f.gDy,c.f.eDx,c.f.eDy,c.f.area,c.f.ox,c.f.oy,c.act,c.pIdx,c.f.pW,t,c.f.xp,0,0,0,0];e.set(i,s)}const Cr={tol:1e-5,it:G.IT_L,cap:G.CAP_L,res:G.RES_L},Or={tol:1e-5,it:G.IT_G,cap:G.CAP_G,res:G.RES_G},Br={tol:1e-5,it:G.IT_H,cap:G.CAP_H,res:G.RES_H},jr={tol:1e-5,it:G.IT_D,cap:G.CAP_D,res:G.RES_H},$e=200,te=256;class Ka{constructor(t,e,s){g(this,"ctx");g(this,"plan");g(this,"b");g(this,"l0");g(this,"lp");g(this,"lv");g(this,"it");g(this,"cfg");g(this,"kinds",[]);g(this,"groups",new Map);g(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const i=e.levels;this.n0cells=i[0].nx*i[0].ny;const n=new Uint32Array(32);Vs(i[0],0,n,0),this.l0=t.uniform("l0",n.buffer);const r=new Uint32Array(te/4*i.length);for(let l=0;l<i.length;l+=1)Vs(l>0?i[l-1]:null,l-1,r,te/4*l),Vs(i[l],l,r,te/4*l+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*ns+4);for(let l=0;l<i.length;l+=1)Vs(i[l],l,a,32*l);a[32*ns]=e.lt,a[32*ns+1]=i.length,this.lv=t.uniform("lv",a.buffer);const o=new Uint32Array(te/4*($e+1));for(let l=0;l<$e;l+=1)o[te/4*l]=l;o[te/4*$e]=4294967295,this.it=t.uniform("iter",o.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(te*4));for(const l of[Cr,Or,Br,jr])this.setKind(l)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,te*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,te*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:te*e,size:s}}group(t,e,s){const i=`${t}|${e}`;let n=this.groups.get(i);if(n===void 0){const r=this.b;n=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(i,n)}return n}run(t,e,s,i="",n={}){this.ctx.dispatch(t,e,this.group(e,i,n),s)}one(t,e,s="",i={}){this.ctx.dispatchOne(t,e,this.group(e,s,i))}lpRes(t){return this.range(this.lp,t,te)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const i=this.setKind(e),n={SV:this.range(this.cfg,i,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${i}`,n),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let i=1;i<e.length&&i<=s;i+=1){const n=e[i],r=e[i-1],a={LP:this.lpRes(i)};this.run(t,"mgC1",n.nx*n.ny,`l${i}`,a),this.run(t,"mgC2",n.nx*n.ny,`l${i}`,a),this.run(t,"mgC3",n.nx*n.ny,`l${i}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${i}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,i=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),n=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,"mgPreR",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,i=!0,n=i){const r=this.n0cells;this.prepare(t,e,i);const a=(l,h)=>{const f={IT:this.itRes(l)};n?(this.run(t,"cgZSum",r,h,f),this.run(t,"cgZSub",r,h,f)):this.run(t,"cgRZ",r,h,f)};this.vcycle(t),a($e,`k${$e}`);const o=Math.min($e,Math.max(1,s));for(let l=0;l<o;l+=1){const h={IT:this.itRes(l)};this.run(t,"cgA",r,`k${l}`,h),this.run(t,"cgB",r,`k${l}`,h),this.one(t,"cgFoldRR",`k${l}`,h),this.vcycle(t),a(l,`k${l}`)}this.finish(t,e,i)}finish(t,e,s){const i=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${i}`,{SV:this.range(this.cfg,i,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const rs=16,zn=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class za{constructor(t,e){g(this,"ctx");g(this,"d");g(this,"plan");g(this,"params");g(this,"glob");g(this,"cnt");g(this,"cf");g(this,"cu");g(this,"at");g(this,"ff");g(this,"fu");g(this,"af");g(this,"partsA");g(this,"partsB");g(this,"ccountA");g(this,"ccountB");g(this,"cstart");g(this,"bsum");g(this,"pkey");g(this,"pslot");g(this,"pargs");g(this,"bubs");g(this,"bubs2");g(this,"bacc");g(this,"btarget");g(this,"sites");g(this,"sbub");g(this,"reg");g(this,"racc");g(this,"heat");g(this,"hacc");g(this,"mgF");g(this,"mgU");g(this,"cgv");g(this,"cgs");g(this,"lab");g(this,"cfl");g(this,"csum");g(this,"cgp");g(this,"meas");g(this,"probe");g(this,"regionMap",new Int32Array(0));g(this,"regionInv",new Int32Array(0));g(this,"measGroups");g(this,"nsites",0);g(this,"own",[]);this.ctx=t;const s=e.grid,i=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:i,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const n=this.d;this.plan=Wa(s.nx,s.ny);const r=(o,l,h=zn)=>{const f=t.buffer(o,4*Math.max(4,l),h);return this.own.push(f),f};this.params=r("params",Rn,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",is),this.cnt=r("cnt",Be),this.cf=r("cf",bi*n.n),this.cu=r("cu",yi*n.n),this.at=r("at",wi*n.n),this.ff=r("ff",Fi*n.nf),this.fu=r("fu",jn*n.nf),this.af=r("af",_i*n.nf),this.partsA=r("partsA",Ne*n.pcap),this.partsB=r("partsB",Ne*n.pcap),this.ccountA=r("ccountA",n.n+4),this.ccountB=r("ccountB",n.n+4),this.cstart=r("cstart",n.n+4),this.bsum=r("bsum",Math.ceil(n.n/1024)+4),this.pkey=r("pkey",n.pcap),this.pslot=r("pslot",n.pcap),this.pargs=r("pargs",8,zn|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Ge*n.bcap),this.bubs2=r("bubs2",Ge*n.bcap),this.bacc=r("bacc",Ui*n.bcap),this.btarget=r("btarget",n.bcap),this.sites=r("sites",Ai*n.nsites),this.sbub=r("sbub",n.nsites),this.reg=r("reg",oe*n.nreg),this.racc=r("racc",Ii*n.nreg),this.heat=r("heat",ee*n.nheat),this.hacc=r("hacc",Ni*n.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*n.n0),this.cgs=r("cgs",Sr),this.lab=r("lab",n.n0),this.cfl=r("cfl",n.n0),this.csum=r("csum",Lr*n.n0),this.cgp=r("cgp",4*Math.ceil(n.nx*n.ny/256)+16);const a=256;this.measGroups=[Math.ceil(n.n/a),Math.ceil(n.pcap/a),Math.ceil(n.bcap/a)],this.meas=r("meas",rs*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,i=new ArrayBuffer(4*Rn),n=new Uint32Array(i),r=new Float32Array(i);n.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[nt],t.ambientY[rt],t.ambientY[K],Pt(t.regions.pAmb)],32),n.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let o=0;for(let l=0;l<t.regions.count;l+=1)t.regions.open[l]===0&&(o=1);n[40]=o,n[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,n[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,i)}writeHeaters(t){const e=t.heat.heaters,s=new Float32Array(ee*this.d.nheat);e.forEach((i,n)=>{const r=ee*n;s[r+Ct.MODE]=i.mode==="thermostat"?1:0,s[r+Ct.POWER]=i.power,s[r+Ct.TARGET]=i.target,s[r+Ct.ON]=i.on?1:0,s[r+Ct.P]=i.P,s[r+Ct.TMEAN]=i.Tmean,s[r+Ct.INTEGRAL]=i.integral,s[r+Ct.CELLS]=i.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,s)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*ee*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,i=t.grid,n=s.n;this.writeParams(t),this.writeHeaters(t);const r=t.regions,a=Array.from({length:r.count},(T,I)=>I).sort((T,I)=>r.vFluid[I]-r.vFluid[T]);this.regionMap=new Int32Array(Math.max(1,r.count)),this.regionInv=new Int32Array(Math.max(1,r.count)),a.forEach((T,I)=>{this.regionMap[T]=I,this.regionInv[I]=T});const o=new Float32Array(oe*s.nreg);for(let T=0;T<r.count;T+=1){const I=oe*this.regionMap[T];o[I+Rt.OPEN]=r.open[T],o[I+Rt.VFLUID]=r.vFluid[T],o[I+Rt.P0]=r.p0[T],o[I+Rt.RHOBAR]=r.rhoBar[T],o[I+Rt.VLIQ]=r.vLiq[T],o[I+Rt.VBUB]=r.vBub[T],o[I+Rt.VGAS]=r.vGas[T],o[I+Rt.P0START]=r.p0[T]}e.writeBuffer(this.reg,0,o);const l=new Uint32Array(yi*n);for(let T=0;T<n;T+=1){l[Se.KIND*n+T]=i.kind[T],l[Se.KPREV*n+T]=i.kind[T],l[Se.SOLID*n+T]=i.solid[T],l[Se.HGRP*n+T]=i.role[T]===1&&i.heater[T]>=0?i.heater[T]+1:0;const I=r.id[T];l[Se.RID*n+T]=I<0?Pi:this.regionMap[I]}e.writeBuffer(this.cu,0,l);const h=new Float32Array(bi*n),f=(T,I,X=0)=>{for(let V=0;V<n;V+=1)h[T*n+V]=I[X+V]};f(et.PHI,i.phi),f(et.ALPHA,i.alpha),f(et.ALPHAOLD,i.alpha),f(et.PL,i.pl),f(et.PG,i.pg),f(et.MN,i.mg,nt*n),f(et.MO,i.mg,rt*n),f(et.MV,i.mg,K*n),f(et.MF,i.mfog),f(et.HG,i.Hg),f(et.ES,i.Es),f(et.FILM,i.film),f(et.T,i.T),f(et.TL,i.Tl),f(et.CL,i.Cl);const d=t.gas;f(et.VGAS,d.vgas),f(et.RHO,d.rho),f(et.NMOL,d.nmol),f(et.CAP,d.cap),f(et.MU,d.mu),f(et.VEOS,d.veos),f(et.SRCV,d.srcV),f(et.VEOSMID,d.veosMid),f(et.PHIS,i.phiS),f(et.SDF,i.sdf),f(et.PTL,i.T),e.writeBuffer(this.cf,0,h);const m=new Float32Array(wi*n);for(let T=0;T<n;T+=1)m[Gi.VOLSRC*n+T]=t.liquid.volSrc[T];e.writeBuffer(this.at,0,m);const u=s.nf,v=new Float32Array(Fi*u);for(let T=0;T<s.nu;T+=1)v[he.UL*u+T]=i.ul[T],v[he.UG*u+T]=i.ug[T];for(let T=0;T<s.nv;T+=1)v[he.UL*u+s.nu+T]=i.vl[T],v[he.UG*u+s.nu+T]=i.vg[T];e.writeBuffer(this.ff,0,v),e.writeBuffer(this.fu,0,new Uint32Array(jn*u));const p=new Float32Array(_i*u);for(let T=0;T<s.nu;T+=1)p[T]=t.liquid.fU[T];for(let T=0;T<s.nv;T+=1)p[s.nu+T]=t.liquid.fV[T];e.writeBuffer(this.af,0,p);const x=t.particles,w=t.liquid,b=new ArrayBuffer(4*Ne*Math.max(1,x.count)),F=new Float32Array(b),y=new Uint32Array(b),A=new Int32Array(b);for(let T=0;T<x.count;T+=1){const I=Ne*T;F.set([x.x[T],x.y[T],x.vx[T],x.vy[T],x.c00[T],x.c01[T],x.c10[T],x.c11[T],x.mass[T],x.h[T],x.T[T],x.rho[T],w.dVp[T]],I),y[I+13]=0,y[I+14]=x.id[T],A[I+15]=w.bi[T],A[I+16]=w.bj[T];for(let X=0;X<9;X+=1)F[I+17+X]=w.wt[9*T+X]}x.count>0&&e.writeBuffer(this.partsA,0,b);const _=t.bubbles,P=t.bubbleModel.motionState,S=new ArrayBuffer(4*Ge*Math.max(1,_.count)),L=new Float32Array(S),O=new Uint32Array(S),q=new Int32Array(S);for(let T=0;T<_.count;T+=1){const I=Ge*T,X=T*at;L.set([_.x[T],_.y[T],_.z[T],_.vx[T],_.vy[T],_.m[X+nt],_.m[X+rt],_.m[X+K],_.H[T],_.age[T]],I),q[I+10]=_.site[T],L.set([_.r[T],_.V[T],_.pb[T],_.pv[T],_.Tb[T],_.dmdt[T],P.ux0[T],P.uy0[T]],I+11),O[I+19]=_.id[T],O[I+20]=1;for(let V=0;V<zt;V+=1)L[I+21+V]=_.force[T*zt+V]}_.count>0&&e.writeBuffer(this.bubs,0,S);const Q=t.bubbleModel.cavities;this.nsites=Q.count;const C=new ArrayBuffer(4*Ai*s.nsites),W=new Uint32Array(C),M=new Float32Array(C);for(let T=0;T<Q.count;T+=1){const I=Ai*T;W.set([Q.cell[T],Q.fluid[T],Q.dir[T],0],I),M.set([Q.r[T],Q.s[T],Q.z[T],0],I+4)}e.writeBuffer(this.sites,0,C);const D=new Uint32Array(s.nsites);for(let T=0;T<Q.count;T+=1)D[T]=Q.bubble[T];e.writeBuffer(this.sbub,0,D);const J=new Float32Array(is);J[Je.DT]=t.dt,J[Je.TIME]=t.time,J[Je.RHOREF]=w.rhoRef,e.writeBuffer(this.glob,0,J);const j=new Uint32Array(Be),Z=new Float32Array(j.buffer);j[G.PCOUNT]=x.count,j[G.PSORT]=x.count,j[G.BCOUNT]=_.count,j[G.NEXTID_B]=Math.max(1,_.nextFree),j[G.NEXTID_P]=Math.max(1,x.nextFree);const $=t.bubbleModel;j[G.WATCH]=$.watch>=0?$.watch:Pi,j[G.WATCH_FATE]=$.watchFate,$.firstSuperheat!==null&&(Z[G.FIRST_SH]=$.firstSuperheat+1e3,j[G.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,j),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(Ui*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Ii*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Ni*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(h=>Math.ceil(h.size/4)*4),i=s.reduce((h,f)=>h+f,0),n=e.createBuffer({label:"read",size:Math.max(16,i),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((h,f)=>{s[f]>0&&r.copyBufferToBuffer(h.buf,h.offset,n,a,s[f]),a+=s[f]}),e.queue.submit([r.finish()]),await n.mapAsync(GPUMapMode.READ);const o=n.getMappedRange().slice(0);n.unmap(),n.destroy();const l=[];a=0;for(const h of s)l.push(o.slice(a,a+h)),a+=h;return l}async download(t){const e=this.d,s=e.n,[i,n,r,a,o,l,h,f,d,m]=await this.read([{buf:this.cnt,offset:0,size:4*Be},{buf:this.glob,offset:0,size:4*is},{buf:this.cf,offset:0,size:4*bi*s},{buf:this.cu,offset:0,size:4*yi*s},{buf:this.at,offset:0,size:4*wi*s},{buf:this.ff,offset:0,size:4*Fi*e.nf},{buf:this.af,offset:0,size:4*_i*e.nf},{buf:this.heat,offset:0,size:4*ee*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*oe*e.nreg}]),u=new Uint32Array(i),v=Math.min(e.pcap,u[G.PCOUNT]),p=Math.min(e.bcap,u[G.BCOUNT]),[x,w]=await this.read([{buf:this.partsA,offset:0,size:4*Ne*Math.max(1,v)},{buf:this.bubs,offset:0,size:4*Ge*Math.max(1,p)}]),b=t.grid,F=new Float32Array(r),y=(B,U,H=0)=>{for(let st=0;st<s;st+=1)U[H+st]=F[B*s+st]};y(et.PHI,b.phi),y(et.ALPHA,b.alpha),y(et.PL,b.pl),y(et.PG,b.pg),y(et.MN,b.mg,nt*s),y(et.MO,b.mg,rt*s),y(et.MV,b.mg,K*s),y(et.MF,b.mfog),y(et.HG,b.Hg),y(et.ES,b.Es),y(et.FILM,b.film),y(et.T,b.T),y(et.TL,b.Tl),y(et.CL,b.Cl);const A=t.gas;y(et.VGAS,A.vgas),y(et.RHO,A.rho),y(et.NMOL,A.nmol),y(et.CAP,A.cap),y(et.MU,A.mu),y(et.VEOS,A.veos),y(et.SRCV,A.srcV),y(et.VEOSMID,A.veosMid);const _=new Uint32Array(a);for(let B=0;B<s;B+=1)b.kind[B]=_[Se.KIND*s+B];const P=new Float32Array(o);for(let B=0;B<s;B+=1)t.liquid.volSrc[B]=P[Gi.VOLSRC*s+B];const S=new Float32Array(l),L=new Float32Array(h),O=e.nf;for(let B=0;B<e.nu;B+=1)b.ul[B]=S[he.UL*O+B],b.ug[B]=S[he.UG*O+B],t.liquid.fU[B]=L[B];for(let B=0;B<e.nv;B+=1)b.vl[B]=S[he.UL*O+e.nu+B],b.vg[B]=S[he.UG*O+e.nu+B],t.liquid.fV[B]=L[e.nu+B];const q=t.particles,Q=t.liquid,C=new Float32Array(x),W=new Uint32Array(x),M=new Int32Array(x);let D=0,J=0;for(let B=0;B<v;B+=1){const U=Ne*B;if(W[U+13]&1||!(C[U+8]>0))continue;const H=D;D+=1,q.x[H]=C[U],q.y[H]=C[U+1],q.vx[H]=C[U+2],q.vy[H]=C[U+3],q.c00[H]=C[U+4],q.c01[H]=C[U+5],q.c10[H]=C[U+6],q.c11[H]=C[U+7],q.mass[H]=C[U+8],q.h[H]=C[U+9],q.spc[2*H]=0,q.spc[2*H+1]=0,q.smass[2*H]=0,q.smass[2*H+1]=0,q.mat[H]=0,q.id[H]=W[U+14],q.id[H]>J&&(J=q.id[H]),Q.dVp[H]=C[U+12],Q.bi[H]=M[U+15],Q.bj[H]=M[U+16];for(let st=0;st<9;st+=1)Q.wt[9*H+st]=C[U+17+st];q.derive(H)}q.count=D,q.reserveIds(Math.max(u[G.NEXTID_P],J+1)),Q.weightsDirty=!0;const j=t.bubbles,Z=t.bubbleModel.motionState,$=new Float32Array(w),T=new Uint32Array(w),I=new Int32Array(w);j.count=0;let X=0;for(let B=0;B<p;B+=1){const U=Ge*B;if(T[U+20]===0)continue;const H=j.count;j.count+=1;const st=H*at;j.x[H]=$[U],j.y[H]=$[U+1],j.z[H]=$[U+2],j.vx[H]=$[U+3],j.vy[H]=$[U+4];for(let ft=0;ft<at;ft+=1)j.m[st+ft]=0;j.m[st+nt]=$[U+5],j.m[st+rt]=$[U+6],j.m[st+K]=$[U+7],j.H[H]=$[U+8],j.age[H]=$[U+9],j.site[H]=I[U+10],j.r[H]=$[U+11],j.V[H]=$[U+12],j.pb[H]=$[U+13],j.pv[H]=$[U+14],j.Tb[H]=$[U+15],j.dmdt[H]=$[U+16],Z.ux0[H]=$[U+17],Z.uy0[H]=$[U+18],j.id[H]=T[U+19],j.id[H]>X&&(X=j.id[H]);for(let ft=0;ft<zt;ft+=1)j.force[H*zt+ft]=$[U+21+ft]}j.reserveIds(Math.max(u[G.NEXTID_B],X+1));const V=t.bubbleModel.cavities,z=new Uint32Array(d);for(let B=0;B<V.count;B+=1)V.bubble[B]=z[B];const k=new Float32Array(m);for(let B=0;B<t.regions.count;B+=1){const U=oe*this.regionMap[B];t.regions.p0[B]=k[U+Rt.P0],t.regions.rhoBar[B]=k[U+Rt.RHOBAR]}const R=new Float32Array(f);t.heat.heaters.forEach((B,U)=>{const H=ee*U;B.P=R[H+Ct.P],B.Tmean=R[H+Ct.TMEAN],B.integral=R[H+Ct.INTEGRAL]});const E=new Float32Array(n);t.dt=E[Je.DT];const Y=t.bubbleModel;Y.watch=u[G.WATCH]===Pi?-1:u[G.WATCH]}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const ke=128,Nt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Qa=5,Qn=30,Xn=`
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
`,Xa=[{name:"heaterSums",wg:ke,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
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
        let kp = power / ${Qa}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${Qn}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${Qn}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:ke,bind:"P:u cnt:a parts:r",code:`${Yt}
${Nt} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:ke,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Ze}
${Yt}
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
}`},{name:"heatAssemble",wg:ke,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Xn}
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
}`},{name:"heatFlux",wg:ke,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Xn}
${ni}
${Yt}
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
}`},{name:"heatParts",wg:ke,bind:"P:u cnt:a cf:r parts:w",code:`${Ze}
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
}`},{name:"pwParts",wg:ke,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Nt} {
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
  if (lid < 8u) { meas[wid3.x * ${rs}u + lid] = red[lid * 256u]; }
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
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${rs}u + lid] = red[lid * 256u]; }
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${rs}u + lid] = red[lid * 256u]; }
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
}`}],We=256,Ya=[...[1,2,3].map(c=>({name:`mgC${c}`,wg:We,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Ws}
${yt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${c===1?"coarsen1(LP.F, C, t);":c===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:We,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Ws}
${yt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:We,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${$n}
${Ws}
${yt} {
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
}`},{name:"mgPost",wg:We,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${As}
${me}
const TILE: u32 = 16u;
const HALO: u32 = ${Mt}u;
const TS: u32 = ${16+2*Mt}u;
var<workgroup> sx: array<f32, ${(16+2*Mt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Mt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Mt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Mt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Mt)**2}>;
${yt} {
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
  for (var k = 0u; k < ${Mt}u; k++) {
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
}`},{name:"mgPreR",wg:We,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${As}
${me}
const TILE: u32 = 12u;
const HALO: u32 = ${Mt+2}u;
const TS: u32 = ${12+2*(Mt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Mt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Mt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Mt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Mt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Mt+2))**2}>;
${yt} {
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
  for (var k = 0u; k < ${Mt}u; k++) {
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
}`},{name:"mgTail",wg:We,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${$n}
${me}
var<workgroup> tx: array<f32, ${Xe}>;
var<workgroup> tb: array<f32, ${Xe}>;
var<workgroup> tax: array<f32, ${Xe}>;
var<workgroup> tay: array<f32, ${Xe}>;
var<workgroup> tinv: array<f32, ${Xe}>;
var<workgroup> toff: array<u32, ${ns}>;
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
${yt} {
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
  for (var k = 0u; k < ${Hn}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Hn}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],Is=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function Ja(c){const t=/^#?([0-9a-f]{6})$/i.exec(c.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const se=[0,120],Ke=128,ze="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Za=.006,tc={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,phase:6},ec=4*1e3*15e-7/(3*2*.07),on=`
const VIR = array<vec3<f32>, ${Is.length}>(${Is.map(c=>`vec3<f32>(${it(c[0]/255)}, ${it(c[1]/255)}, ${it(c[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${it(Is.length-1)};
  let i = min(u32(floor(x)), ${Is.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,Mi="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",sc=[{name:"rScale",wg:Ke,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${Mi}
var<workgroup> m4: array<vec4<f32>, WG>;
${ze} {
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
}`},{name:"rCells",wg:Ke,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${Mi}
${on}
const SOLID_RGB = array<vec3<f32>, ${Dt.length}>(${Dt.map(c=>{const t=Ja(c.color);return`vec3<f32>(${it(t[0]/255)}, ${it(t[1]/255)}, ${it(t[2]/255)})`}).join(", ")});
${ze} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${it(se[0])};
  let tspan = ${it(se[1]-se[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${Dt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${it(ec)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Ke,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${ze} {
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
}`},{name:"rLiqBlurX",wg:Ke,bind:"P:u lq:r lq2:w",code:`${ze} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:Ke,bind:"P:u lq2:r liquid:t",code:`${ze} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${it(se[0])}) / ${it(se[1]-se[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:Ke,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${Mi}
${ze} {
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
}`}],Os=`
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
`,Li=`${Os}
${on}
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
`,ic=`${Os}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,nc=`${Os}
${(nn.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${G.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,rc=`${Os}
${on}
${(nn.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${G.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${it(273.15+se[0])}) / ${it(se[1]-se[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,oc=`${Os}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Yn=48,Ci=256,ac=12;class cc{constructor(t,e){g(this,"gpu");g(this,"device");g(this,"context");g(this,"format");g(this,"rp");g(this,"ro");g(this,"sampLin");g(this,"sampNear");g(this,"pipes",{});g(this,"layouts",{});g(this,"size","");g(this,"cellsTex");g(this,"fieldTex");g(this,"liquidTex");g(this,"lq");g(this,"lq2");g(this,"arrows");g(this,"nArrows",0);g(this,"groups",new Map);g(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});g(this,"water",[.24,.56,.85]);g(this,"waterInk",[1,1,1]);g(this,"roData",new Uint32Array(4));var n;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((n=s.gpu)==null?void 0:n.getPreferredCanvasFormat())??"bgra8unorm";const i=e.getContext("webgpu");if(i===null)throw new Error("no webgpu canvas context");this.context=i,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",Ci*ac,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,i=m=>t.createBindGroupLayout({entries:m});this.layouts.quad=i([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=i([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=i([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const n=async(m,u,v,p,x=[])=>{const w=t.createShaderModule({code:m}),F=(await w.getCompilationInfo()).messages.filter(y=>y.type==="error");if(F.length>0)throw new Error(`render WGSL: ${F.map(y=>`${y.lineNum}:${y.linePos} ${y.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[v]}),vertex:{module:w,entryPoint:"vs",buffers:x},fragment:{module:w,entryPoint:u,targets:[{format:this.format,blend:e}]},primitive:{topology:p}})},[r,a,o,l,h,f,d]=await Promise.all([n(Li,"fsCells",this.layouts.quad,"triangle-strip"),n(Li,"fsField",this.layouts.quad,"triangle-strip"),n(Li,"fsLiquid",this.layouts.quad,"triangle-strip"),n(ic,"fs",this.layouts.rect,"triangle-strip"),n(nc,"fs",this.layouts.store,"triangle-strip"),n(rc,"fs",this.layouts.store,"triangle-strip"),n(oc,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:o,rect:l,disc:h,point:f,line:d}}ensure(){var h,f,d,m,u,v;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,i=(p,x)=>s.createTexture({size:[p,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(h=this.cellsTex)==null||h.destroy(),(f=this.fieldTex)==null||f.destroy(),(d=this.liquidTex)==null||d.destroy(),this.cellsTex=i(t.d.nx,t.d.ny),this.fieldTex=i(t.d.nx,t.d.ny),this.liquidTex=i(2*t.d.nx,2*t.d.ny);const n=4*t.d.nx*t.d.ny;(m=this.lq)==null||m.destroy(),(u=this.lq2)==null||u.destroy(),(v=this.arrows)==null||v.destroy(),this.lq=s.createBuffer({size:4*2*n,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*n,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(Za/this.gpu.cpu.grid.dx)),a=r>>1,o=Math.max(1,Math.ceil((t.d.nx-a)/r)),l=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=o*l,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,o,l])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const i=this.gpu.state;s=this.gpu.ctx.bind(t,{P:i.params,RO:this.ro,cf:i.cf,cu:i.cu,ff:i.ff,reg:i.reg,cnt:i.cnt,parts:i.partsA,ccount:i.ccountB,cstart:i.cstart,bsum:i.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,i){let n=this.groups.get(t);if(n===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:Ci*s,size:4*Yn}}];i.tex!==void 0&&r.push({binding:1,resource:i.tex.createView()},{binding:2,resource:i.smp}),i.store!==void 0&&r.push({binding:1,resource:{buffer:i.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),n=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,n)}return n}encode(t,e,s,i,n,r,a){this.ensure();const o=this.gpu.state,l=this.gpu.ctx,h=this.device.queue;this.roData[0]=tc[r],h.writeBuffer(this.ro,0,this.roData),t.clearBuffer(o.cnt,4*G.OV_PMAX,16);const f=t.beginComputePass(),d=o.d.n;l.dispatch(f,"rScale",this.computeGroup("rScale",{}),d),l.dispatch(f,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),d),a||(l.dispatch(f,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*d),l.dispatch(f,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*d),l.dispatch(f,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*d)),r==="velocity"&&l.dispatch(f,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),f.end();const m=this.gpu.cpu.grid,u=(b,F,y)=>{const A=new Float32Array(Yn),_=new Uint32Array(A.buffer);A.set([e.x0,e.y0,e.x1,e.y1,m.w,m.h,s,i],0),A.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),A.set(F,24),A.set(y,28),A[32]=r==="temperature"?1:0,A[33]=Math.max(1.5,.5*m.dx*s/(e.x1-e.x0)),_[34]=o.d.bcap,_[35]=o.d.pcap,h.writeBuffer(this.rp,Ci*b,A)},v=.003;u(0,[0,0,m.w,m.h],[...this.theme.ground,1]),u(1,[0,0,0,0],[0,0,0,0]),u(2,[0,0,0,0],[...this.theme.ink,.85]),u(3,[0,0,0,0],[...this.waterInk,.9]);const p=[];n.left&&p.push([-v,-v,0,m.h+(n.top?v:0)]),n.right&&p.push([m.w,-v,m.w+v,m.h+(n.top?v:0)]),n.bottom&&p.push([-v,-v,m.w+v,0]),n.top&&p.push([-v,m.h,m.w+v,m.h+v]),p.forEach((b,F)=>u(4+F,b,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),w=this.pipes;x.setPipeline(w.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(w.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:o.partsA})),x.draw(4,o.d.pcap)):(x.setPipeline(w.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(w.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:o.bubs})),x.draw(4,o.d.bcap),x.setPipeline(w.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(w.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(w.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(w.rect),p.forEach((b,F)=>{x.setBindGroup(0,this.drawGroup(`d-wall${F}`,this.layouts.rect,4+F,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const lc=[...Ha,...Ya,...Va,...Ea,...Ia,...ja,...qa,...Ga,...Xa,...sc],Jn=[["heater",G.HEATER_E,"f"],["lossWalls",G.LOSS_WALLS,"f"],["lossOpen",G.LOSS_OPEN,"f"],["escapedEnergy",G.ESC_ENERGY,"f"],["escapedWater",G.ESC_WATER,"f"],["escapedAir",G.ESC_AIR,"f"],["produced",G.PRODUCED,"f"],["condensed",G.CONDENSED,"f"],["dew",G.DEW,"f"],["fogMade",G.FOGMADE,"f"],["burstVapour",G.BURSTVAP,"f"],["fluxSL",G.FLUX_SL,"f"],["fluxLG",G.FLUX_LG,"f"],["fluxSG",G.FLUX_SG,"f"],["lossSolids",G.LOSS_SOLIDS,"f"],["nucleated",G.NUCLEATED,"u"],["departed",G.DEPARTED,"u"],["merged",G.MERGED,"u"],["burst",G.BURST,"u"],["collapsed",G.COLLAPSED,"u"],["burstCold",G.BURST_COLD,"u"],["burstWarm",G.BURST_WARM,"u"],["collapsedCold",G.COLL_COLD,"u"],["collapsedWarm",G.COLL_WARM,"u"]],Zn=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),Oi=256,Qe=2*Oe;class an{constructor(t,e){g(this,"ctx");g(this,"cpu");g(this,"state");g(this,"solver");g(this,"sub");g(this,"groups",new Map);g(this,"stateVersion",0);g(this,"itL",16);g(this,"itG",18);g(this,"itH",8);g(this,"itD",6);g(this,"nsub",0);g(this,"totals",Zn());g(this,"last",null);g(this,"stepped",null);g(this,"energy0",null);g(this,"water0",null);g(this,"sealed",!1);g(this,"staging",[]);g(this,"busy",new Set);g(this,"reading",new Map);g(this,"querySet");g(this,"queryBuf");g(this,"vapourMark",0);g(this,"vapourLast",0);g(this,"vapourRate",0);g(this,"stageMs",new Array(Oe).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:Qe}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*Qe,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await rn.create(),s=await e.compile(lc);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new an(e,t)}rebuild(){this.stateVersion+=1;const t=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new za(this.ctx,this.cpu);const e=this.state;(t===null||t.nx!==e.d.nx||t.ny!==e.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Ka(this.ctx,e.plan,{params:e.params,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,cnt:e.cnt,cgp:e.cgp});const s=new Uint32Array(Oi/4*16);for(let i=0;i<16;i+=1)s[Oi/4*i]=i;this.sub=this.ctx.uniform("sub",s.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const i=t.bubbleModel;i.burstVapour=e.burstVapour,i.nucleated=e.nucleated,i.departed=e.departed,i.merged=e.merged,i.burst=e.burst,i.collapsed=e.collapsed,i.burstCold=e.burstCold,i.burstWarm=e.burstWarm,i.collapsedCold=e.collapsedCold,i.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&i.firstSuperheat===null&&(i.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*G.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*G.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const i=`${t}|${e}|${s}`;let n=this.groups.get(i);if(n===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Oi*s,size:16}}:this.resources(e);n=this.ctx.bind(t,r),this.groups.set(i,n)}return n}cells(t,e,s="",i=-1){this.ctx.dispatch(t,e,this.group(e,s,i),this.state.d.n)}faces(t,e,s="",i=-1){this.ctx.dispatch(t,e,this.group(e,s,i),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",i=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),i.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(i.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),i.pcap)}encodeSteps(t,e,s){for(let i=0;i<e;i+=1)this.encodeStep(t,s&&i===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,Qe,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const i=()=>{};return{label:"",setPipeline:i,setBindGroup:i,dispatchWorkgroups:i,dispatchWorkgroupsIndirect:i,end:i}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let i=this.pass(t,e,1);this.sort(i,1),this.cells(i,"splat","B"),this.cells(i,"classify"),this.cells(i,"transitions"),this.cells(i,"gasApply"),this.cells(i,"regCells"),this.parts(i,"regParts","B"),this.bubs(i,"regBubs"),this.one(i,"regFinishStart"),this.faces(i,"p2g","B"),this.cells(i,"liqAssemble"),this.solver.encodeMG(i,Cr,this.itL,!0,!1),this.cells(i,"liqPressure"),this.faces(i,"liqCorrect"),this.faces(i,"extrap1"),this.faces(i,"extrap2"),this.parts(i,"g2p","B"),this.sort(i,2),this.parts(i,"heatWeights","A"),i.end(),i=this.pass(t,e,2),this.cells(i,"gasVolumes"),this.faces(i,"markFaces"),this.cells(i,"gasMaxOut");for(let n=0;n<16;n+=1)this.cells(i,"gasFlux","",n),this.cells(i,"gasMove","",n);this.cells(i,"gasApplyMid"),this.faces(i,"macFwd"),this.faces(i,"macBack"),this.faces(i,"viscosity"),this.cells(i,"gasAssemble"),this.solver.encodeMG(i,Or,this.itG,!0,!0),this.cells(i,"gasPressure"),this.faces(i,"gasCorrect"),i.end(),i=this.pass(t,e,3),this.cells(i,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(i,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(i,"bubAdvance"),this.bubs(i,"bubTarget"),this.bubs(i,"bubMerge"),this.bubs(i,"bubMergeFinal"),this.bubs(i,"bubFinish"),this.one(i,"bubCompact"),this.bubs(i,"bubCopyBack"),this.parts(i,"applyMass","A"),this.cells(i,"gatherPlain","A"),this.bubs(i,"bubAlpha"),this.cells(i,"cellAlpha"),this.cells(i,"gasApply"),i.end(),i=this.pass(t,e,4),this.cells(i,"diffPrep"),this.cells(i,"diffAssemble"),this.solver.encodeMG(i,jr,this.itD,!1),this.faces(i,"diffFaces"),this.cells(i,"diffApply"),this.cells(i,"latentSrc"),this.parts(i,"applyMass","A"),this.cells(i,"gatherPlain","A"),this.cells(i,"gasApply"),this.cells(i,"flashTs"),this.cells(i,"flashVap","A"),this.parts(i,"flashParts","A"),this.cells(i,"flashDist"),this.cells(i,"gasApply"),this.cells(i,"fog"),this.cells(i,"films","A"),i.end(),i=this.pass(t,e,5),this.cells(i,"heaterSums"),this.one(i,"heaterPI"),s.heat.liquidPower!==0&&this.parts(i,"sumCl","A"),this.cells(i,"heatPrep","A"),this.cells(i,"heatAssemble"),this.solver.encodeMG(i,Br,this.itH,!1),this.cells(i,"heatFlux"),this.parts(i,"heatParts","A"),i.end(),i=this.pass(t,e,7),this.cells(i,"regCells"),this.parts(i,"regParts","A"),this.bubs(i,"regBubs"),this.one(i,"regFinish"),this.sealed&&(this.cells(i,"compSums"),this.one(i,"compStep0"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStep1"),this.cells(i,"compApply"),this.cells(i,"compSums"),this.one(i,"compStepEnd"),this.parts(i,"pwParts","A"),this.bubs(i,"pwBubs")),this.cells(i,"gasEos"),this.one(i,"stepEnd"),i.end()}layout(){const t=this.state,e=0,s=e+4*Be,i=s+4*is,n=i+4*oe*t.d.nreg,r=n+4*ee*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],o=r+4*rs*a,l=o+4*64,h=l+8*Qe;return{cnt:e,glob:s,reg:i,heat:n,meas:r,probe:o,ts:l,total:h}}encodeReadback(t,e){const s=this.state,i=this.layout();let n=this.staging.find(o=>!this.busy.has(o)&&o.size>=i.total);if(n===void 0){if(this.staging.length>=3)return null;n=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(i.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(n)}const r=t.beginComputePass();this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,n,i.cnt,4*Be),t.copyBufferToBuffer(s.glob,0,n,i.glob,4*is),t.copyBufferToBuffer(s.reg,0,n,i.reg,4*oe*s.d.nreg),t.copyBufferToBuffer(s.heat,0,n,i.heat,4*ee*s.d.nheat),t.copyBufferToBuffer(s.meas,0,n,i.meas,i.probe-i.meas),t.copyBufferToBuffer(s.probe,0,n,i.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,n,i.ts,8*Qe),t.clearBuffer(s.cnt,4*Bn,4*(ra-Bn)),this.busy.add(n);const a=[];for(let o=0;o<this.cpu.regions.count;o+=1)a.push(s.gpuRegion(o));return this.reading.set(n,{version:this.stateVersion,layout:i,regions:a,heaters:this.cpu.heat.heaters.length,groups:[...s.measGroups],nreg:s.d.nreg,nheat:s.d.nheat}),n}async finishReadback(t,e){const s=this.reading.get(t),i=()=>{this.busy.delete(t),this.reading.delete(t)};try{await t.mapAsync(GPUMapMode.READ)}catch{return i(),null}if(s===void 0||s.version!==this.stateVersion)return t.unmap(),i(),null;const n=t.getMappedRange(0,Math.ceil(s.layout.total/16)*16).slice(0);t.unmap(),i();const r=this.parse(n,s,e);return this.absorb(r),r}parse(t,e,s){const i=e.layout,n=new Uint32Array(t,i.cnt,Be),r=new Float32Array(t,i.cnt,Be),a=new Float32Array(t,i.glob,is),o=new Float32Array(t,i.reg,oe*e.nreg),l=new Float32Array(t,i.heat,ee*e.nheat),h=new Float32Array(t,i.meas,(i.probe-i.meas)/4),f=new Float32Array(t,i.probe,64),[d,m,u]=e.groups,v=(y,A,_)=>{let P=0;for(let S=0;S<A;S+=1)P+=h[(y+S)*rs+_];return P},p=[];for(const y of e.regions){const A=oe*y;p.push({p0:o[A+Rt.P0],sealed:o[A+Rt.OPEN]===0,vGas:o[A+Rt.VGAS],vFluid:o[A+Rt.VFLUID]})}const x=[];for(let y=0;y<e.heaters;y+=1){const A=ee*y;x.push({P:l[A+Ct.P],Tmean:l[A+Ct.TMEAN],integral:l[A+Ct.INTEGRAL],cells:l[A+Ct.CELLS]})}let w=null;if(s&&this.queryBuf!==null){const y=new BigUint64Array(t,i.ts,Qe);w=[];for(let A=0;A<Oe;A+=1){const _=y[2*A],P=y[2*A+1];w.push(P>_&&_>0n?Number(P-_)/1e6:0)}}const b=r[G.SUM_WM],F={};for(const[y,A,_]of Jn)F[y]=_==="f"?r[A]:n[A];return{intervals:F,ov:[r[G.OV_PMAX],r[G.OV_VMAX],r[G.OV_VLIQ]],pcount:n[G.PCOUNT],bcount:n[G.BCOUNT],dt:a[Je.DT],stepsSince:n[G.STEPS],simSince:r[G.SIMTIME],itL:n[G.IT_L],itG:n[G.IT_G],itH:n[G.IT_H],itD:n[G.IT_D],capL:n[G.CAP_L],capG:n[G.CAP_G],capH:n[G.CAP_H],capD:n[G.CAP_D],resL:r[G.RES_L],resG:r[G.RES_G],resH:r[G.RES_H],nsub:n[G.NSUBMAX],uMaxG:r[G.UMAXG],waterMass:b,waterT:b>0?r[G.SUM_WMT]/b:0,waterTmax:r[G.TMAX],solids:v(0,d,0),film:v(0,d,1),gas:v(0,d,2),vapour:v(0,d,3),fog:v(0,d,4),air:v(0,d,5),liquidCells:Math.round(v(0,d,6)),gasCells:Math.round(v(0,d,7)),liquidH:v(d,m,0),liquidMass:v(d,m,1),sensible:v(d,m,3),bubH:v(d+m,u,0),bubWater:v(d+m,u,1),bubAir:v(d+m,u,2),regions:p,heaters:x,watch:{found:f[31]===1,id:new Uint32Array(f.buffer,f.byteOffset+4*21,1)[0],fate:n[G.WATCH_FATE],data:new Float32Array(f)},firstSuperheat:n[G.FIRST_SH]!==0?r[G.FIRST_SH]-1e3:null,stageMs:w}}absorb(t){const e=this.totals;this.last=t,t.stepsSince>0&&(this.stepped=t),t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[i]of Jn)e[i]+=t.intervals[i];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(i,n,r,a,o,l)=>{if(n===0&&r===0)return i;const h=r>0?Math.ceil(i*1.5)+2:n+l;return Math.min(o,Math.max(a,i>h?Math.max(h,i-2):h))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60,1),this.itG=s(this.itG,t.itG,t.capG,4,60,2),this.itH=s(this.itH,t.itH,t.capH,3,60,1),this.itD=s(this.itD,t.itD,t.capD,3,60,1),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,i=this.last,n=this.totals,r=this.budget(),a={heater:n.heater,lossWalls:n.lossWalls,lossOpen:n.lossOpen,escapedEnergy:n.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:n.escapedWater,escapedAir:n.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air,escapedOther:0,editOther:e.ledger.other},o=this.energy0??r.energy,l=this.water0??r.water.total,h=r.energy-o-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),f=r.water.total-l-a.editWater,d=n.produced+n.burstVapour,m=n.time-this.vapourLast;m>.2&&(this.vapourRate=(d-this.vapourMark)/m,this.vapourMark=d,this.vapourLast=n.time);const u=e.heat.heaters.map((x,w)=>({h:x,k:w,rd:i==null?void 0:i.heaters[w]})).filter(({rd:x,h:w})=>((x==null?void 0:x.cells)??w.cells)>0).map(({h:x,rd:w})=>({group:x.group,P:(w==null?void 0:w.P)??x.P,Tmean:(w==null?void 0:w.Tmean)??x.Tmean,mode:x.mode,power:x.power,target:x.target,on:x.on})),v=(x,w,b)=>({iterations:x,residual:w,capped:b>0}),p=this.stepped??i;return{time:n.time,dt:(i==null?void 0:i.dt)??e.dt,steps:n.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(i==null?void 0:i.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(i==null?void 0:i.bcount)??e.bubbles.count,liquidCells:(i==null?void 0:i.liquidCells)??0,gasCells:(i==null?void 0:i.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:v((p==null?void 0:p.itL)??0,(p==null?void 0:p.resL)??0,(p==null?void 0:p.capL)??0),gas:v((p==null?void 0:p.itG)??0,(p==null?void 0:p.resG)??0,(p==null?void 0:p.capG)??0),heat:v((p==null?void 0:p.itH)??0,(p==null?void 0:p.resH)??0,(p==null?void 0:p.capH)??0),gasSubsteps:(p==null?void 0:p.nsub)??0,capped:n.capped,waterT:(i==null?void 0:i.waterT)??0,waterTmax:(i==null?void 0:i.waterTmax)??0,otherMass:0,otherT:0,heaters:u,regions:((i==null?void 0:i.regions)??[]).map(x=>({p0:x.p0,sealed:x.sealed,vGas:x.vGas})),budget:r,flows:a,energyError:h,waterError:f,otherError:0,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy}}budget(){const t=this.last,e=this.totals;let s=0;for(const l of(t==null?void 0:t.regions)??[])l.sealed&&(s-=l.p0*l.vFluid);const i=(t==null?void 0:t.liquidH)??0,n=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,o={liquid:(t==null?void 0:t.liquidMass)??0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:n+i+r+a+s,solids:n,liquid:i,gas:r,bubbles:a,pv:s,water:o,other:{liquid:0,escaped:0,total:0},air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,Zn()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return Pt(this.cpu.regions.pAmb)}}function fc(c,t,e,s,i){const n=-i,r=-i,a=c+2*i,o=t+2*i,l=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/o>l){const f=a/l;return{x0:n,y0:r-(f-o)/2,x1:n+a,y1:r-(f-o)/2+f}}const h=o*l;return{x0:n-(h-a)/2,y0:r,x1:n-(h-a)/2+h,y1:r+o}}const ls=self,_t=c=>ls.postMessage(c),tr=8,uc=.1,hc=3,er=200,dc=.25,sr=273.15;let ot=null,tt=null,_e=null,ri=null,ve=null,os="",Ks=1,zs=1,Qs=1,fs={x0:0,y0:0,x1:1,y1:1},us={left:!0,right:!0,bottom:!0,top:!1},Ts=!1,$i=1,ts="none",Rr=!1,Ce=0,as=0,Wi=0,Bi=0,ji=!1,ks=0,ir=0,Ki=0,zi=0,nr=!1,Qi=0,es=null;const Me=[],Xi=[];let oi=!1;const cs=[];function cn(){if(ot===null)return;const c=ot.scene.sides;us={left:c.left==="wall",right:c.right==="wall",bottom:c.bottom==="wall",top:c.top==="wall"}}function ln(c,t,e){Ks=Math.max(1,c),zs=Math.max(1,t),Qs=Math.max(.5,Math.min(3,e)),ve!==null&&(ve.width=Math.round(Ks*Qs),ve.height=Math.round(zs*Qs)),ot!==null&&(fs=fc(ot.boxW,ot.boxH,Ks,zs,.006))}function qr(c){_e!==null&&(_e.theme={ground:c?[.1,.12,.15]:[.93,.95,.97],outside:c?[.06,.07,.09]:[.86,.88,.9],wall:c?[.55,.6,.66]:[.42,.46,.5],ink:c?[.9,.93,.96]:[.08,.1,.12]})}function Ye(c){Xi.push(c),oi||mc()}async function mc(){if(tt!==null){oi=!0;try{for(;Xi.length>0;){const c=Xi.shift();await tt.ctx.device.queue.onSubmittedWorkDone();try{await c()}catch(t){_t({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{oi=!1,as=performance.now()}}}async function Yi(){if(tt===null)return;const c=tt.ctx.device.createCommandEncoder(),t=tt.encodeReadback(c,!1);tt.ctx.device.queue.submit([c.finish()]),t!==null&&await tt.finishReadback(t,!1),tt.baselineFromLast()}function fn(){return ot===null||!ot.particles.hasOther()?!1:(_t({type:"gpu",ok:!1,adapter:os,message:"other-liquid",scene:ot.serialize()}),!0)}function un(c){tt!==null&&_e!==null&&tt.stateVersion!==c&&_e.reset()}function Ri(){Ye(async()=>{if(tt===null||ot===null||cs.length===0)return;const c=cs.splice(0,cs.length);await Yi(),await tt.download();for(const e of c){const s=ot.apply(e);s!==null&&s.startsWith("refused")&&_t({type:"refused",message:s})}if(fn())return;const t=tt.stateVersion;tt.upload(),un(t)})}function pc(c){const t=(c==null?void 0:c.ov)??[0,0,0],e=t[2];if(ts==="temperature")return[sr+se[0],sr+se[1],e];if(ts==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return ts==="velocity"?[0,Math.max(.02,t[1]),e]:ts==="vapour"?[0,.6,e]:[0,1,e]}function gc(c){if(c===null)return null;const t=c.watch;if(t.found){const e=t.data;return es={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:Pt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},es}return es!==null&&(t.fate===1||t.fate===2)?{...es,fate:t.fate===1?"burst":"collapsed"}:null}function vc(c,t){if(tt===null||ri===null)return;if(tt.baselineFromLast(),tt.totals.time>=Qi){const n=ri.sample();n!==null&&(Me.push(n),Me.length>400&&Me.splice(0,Me.length-400),Qi=tt.totals.time+dc)}const e=Math.max(.001,(t-ks)/1e3),s=(c.stageMs??tt.stageMs).reduce((n,r)=>n+r,0),i={engine:tt.stats(s),stepsPerSecond:zi/e,simRate:(tt.totals.time-ir)/e,fps:Ki/e,renderMs:0,mode:"gpu",adapter:os,paused:Ts,samples:Me.splice(0,Me.length),bubble:gc(c),overlayScale:pc(c)};_t({type:"stats",stats:i}),Ki=0,zi=0,ir=tt.totals.time,ks=t}function Ji(){var t;const c=performance.now();if(tt!==null&&_e!==null&&ve!==null&&ot!==null&&!oi){const e=tt.ctx.device,s=as===0?0:Math.min(.1,(c-as)/1e3);as=c;const i=((t=tt.last)==null?void 0:t.dt)??ot.dt;let n=0;Ts?(n=Math.min(tr,Wi),Wi-=n,Ce=0):(Ce=Math.min(Ce+s*$i,uc*Math.max(1,$i)),n=Bi>=hc?0:Math.min(tr,Math.floor(Ce/Math.max(1e-5,i))),Ce-=n*i);const r=!ji&&c-ks>er&&(n>0||Ts||c-ks>4*er),a=e.createCommandEncoder();n>0&&tt.encodeSteps(a,n,r);const o=r?tt.encodeReadback(a,r&&n>0):null;if(_e.encode(a,fs,ve.width,ve.height,us,ts,Rr),e.queue.submit([a.finish()]),Bi+=1,e.queue.onSubmittedWorkDone().then(()=>{Bi-=1}),zi+=n,Ki+=1,o!==null){ji=!0;const l=n>0;tt.finishReadback(o,l).then(h=>{ji=!1,h!==null&&vc(h,performance.now())})}}typeof ls.requestAnimationFrame=="function"?ls.requestAnimationFrame(Ji):setTimeout(Ji,16)}async function xc(c){if(ot=new na(c.scene),fn())return;if(ve=c.canvas,ve===null)throw new Error("no OffscreenCanvas");tt=await an.create(ot),os=await(async()=>{var e;try{const s=await((e=ls.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),i=s==null?void 0:s.info;return i===void 0?"":[i.vendor,i.architecture,i.description].filter(Boolean).join(" ")}catch{return""}})(),_e=new cc(tt,ve),await _e.init(),qr(c.dark),ri=new kr(tt),tt.ctx.device.addEventListener("uncapturederror",e=>_t({type:"error",message:`WebGPU: ${e.error.message}`})),tt.ctx.device.lost.then(e=>_t({type:"gpu",ok:!1,adapter:os,message:e.message||e.reason})),cn(),ln(c.width,c.height,c.dpr),_t({type:"gpu",ok:!0,adapter:os,message:""}),_t({type:"ready",offscreen:!0,warnings:ot.warnings,view:fs,quality:ot.currentQuality,walls:us}),ks=performance.now(),as=performance.now(),nr||(nr=!0,Ji())}function rr(){if(tt===null||ot===null)return;const c=tt.stateVersion;tt.cpu=ot,tt.rebuild(),tt.resetTotals(),un(c),ri=new kr(tt),Qi=0,Me.length=0,Ce=0,es=null,cn(),ln(Ks,zs,Qs),_t({type:"view",view:fs,walls:us})}ls.addEventListener("message",c=>{const t=c.data;try{switch(t.type){case"probe":_t({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&ls.navigator.gpu!==void 0});break;case"init":xc(t).catch(e=>_t({type:"gpu",ok:!1,adapter:os,message:e instanceof Error?e.message:String(e)}));break;case"resize":ln(t.width,t.height,t.dpr),_t({type:"view",view:fs,walls:us});break;case"op":cs.push(t.op),Ri();break;case"addLiquid":cs.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Ri();break;case"addSolid":cs.push({op:"solid",region:t.region,material:t.material,T:t.T}),Ri();break;case"setHeater":ot==null||ot.setHeater(t.group,t.mode,t.power,t.target,t.on),tt==null||tt.writeHeater(t.group);break;case"setAmbient":ot==null||ot.setAmbient(t.p,t.T,t.rh,t.g,t.air),tt==null||tt.writeParams();break;case"setBoundary":Ye(async()=>{if(tt===null||ot===null)return;await Yi(),await tt.download(),ot.setBoundary(t.side,t.value);const e=tt.stateVersion;tt.upload(),un(e),cn(),_t({type:"view",view:fs,walls:us})});break;case"query":Ye(async()=>{if(tt===null||ot===null){_t({type:"reply",id:t.id,data:null});return}await Yi(),await tt.download(),_t({type:"reply",id:t.id,data:ot.query(t.x,t.y)})});break;case"select":es=null,tt==null||tt.watch(t.bubble);break;case"overlay":ts=t.overlay;break;case"particles":Rr=t.on;break;case"pause":Ts=t.paused,Ce=0,as=performance.now();break;case"step":Ts&&(Wi+=1);break;case"setSpeed":$i=Math.min(64,Math.max(.05,t.speed));break;case"setQuality":Ye(async()=>{ot!==null&&(ot.setQuality(t.quality),rr())});break;case"serialize":tt===null?_t({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null}):Ye(async()=>{_t({type:"reply",id:t.id,data:(ot==null?void 0:ot.serialize())??null})});break;case"load":Ye(async()=>{ot!==null&&(ot.load(t.scene),!fn()&&rr())});break;case"theme":qr(t.dark);break;case"frameDone":break}}catch(e){_t({type:"error",message:e instanceof Error?e.message:String(e)})}});
