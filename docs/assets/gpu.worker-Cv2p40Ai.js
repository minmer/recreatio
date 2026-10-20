var wr=Object.defineProperty;var _r=(l,t,e)=>t in l?wr(l,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):l[t]=e;var p=(l,t,e)=>_r(l,typeof t!="symbol"?t+"":t,e);const Bt=8.314462618,Qs=9.80665,us=101325,pt=273.15,I=0,ct=1,ft=2,tt=0,et=1,K=2,rt=6,ut=3,$t=8;class Pr{constructor(t){p(this,"cap");p(this,"count",0);p(this,"nextId",1);p(this,"x");p(this,"y");p(this,"z");p(this,"vx");p(this,"vy");p(this,"m");p(this,"H");p(this,"age");p(this,"site");p(this,"r");p(this,"V");p(this,"pb");p(this,"pv");p(this,"Tb");p(this,"dmdt");p(this,"force");p(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.z=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.m=new Float64Array(t*rt),this.H=new Float64Array(t),this.age=new Float32Array(t),this.site=new Int32Array(t),this.r=new Float32Array(t),this.V=new Float64Array(t),this.pb=new Float32Array(t),this.pv=new Float32Array(t),this.Tb=new Float32Array(t),this.dmdt=new Float32Array(t),this.force=new Float32Array(t*$t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s){if(this.count>=this.cap)return-1;const n=this.count;this.count+=1,this.x[n]=t,this.y[n]=e,this.z[n]=s,this.vx[n]=0,this.vy[n]=0;for(let i=0;i<rt;i+=1)this.m[n*rt+i]=0;this.H[n]=0,this.age[n]=0,this.site[n]=-1,this.r[n]=0,this.V[n]=0,this.pb[n]=0,this.pv[n]=0,this.Tb[n]=0,this.dmdt[n]=0;for(let i=0;i<$t;i+=1)this.force[n*$t+i]=0;return this.id[n]=this.nextId,this.nextId=this.nextId+1>>>0||1,n}totalMass(t){let e=0;for(let s=0;s<rt;s+=1)e+=this.m[t*rt+s];return e}remove(t){const e=this.count-1;if(t!==e){this.x[t]=this.x[e],this.y[t]=this.y[e],this.z[t]=this.z[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e];for(let s=0;s<rt;s+=1)this.m[t*rt+s]=this.m[e*rt+s];this.H[t]=this.H[e],this.age[t]=this.age[e],this.site[t]=this.site[e],this.r[t]=this.r[e],this.V[t]=this.V[e],this.pb[t]=this.pb[e],this.pv[t]=this.pv[e],this.Tb[t]=this.Tb[e],this.dmdt[t]=this.dmdt[e];for(let s=0;s<$t;s+=1)this.force[t*$t+s]=this.force[e*$t+s];this.id[t]=this.id[e]}this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Ar={air:{N2:{v:.7676},O2:{v:.2324}},hExt:{v:10}},Tr=[{id:"H2O",name:{pl:"woda",de:"Wasser",en:"water"},molarMass:{v:.01801528,src:"codata"},liquid:{name:{pl:"woda",de:"Wasser",en:"water"},kell:{c:[999.83952,16.945176,-.0079870401,-46170461e-12,10556302e-14,-28054253e-17,.01687985],src:"kell"},cp:{table:[[273.16,4219.9],[283.15,4195.5],[293.15,4184.3],[303.15,4180.1],[313.15,4179.6],[323.15,4181.5],[333.15,4185.1],[343.15,4190.2],[353.15,4196.9],[363.15,4205.3],[373.15,4215.7],[383.15,4228.3],[393.15,4243.5],[403.15,4261.5],[413.15,4282.6],[423.15,4307]],src:"nist"},k:{poly:[.5587,.0021825,-978e-8],src:"iapws-k"},mu:{vogel:[2414e-8,247.8,140],src:"vogel"},color:"#3d8fd8"},vapour:{name:{pl:"para wodna",de:"Wasserdampf",en:"water vapour"},cp:{linear:[1864.5,.374,298.15],src:"janaf"},k:{v:.0248,src:"nist"},mu:{v:1227e-8,src:"nist"}},saturation:{if97:{n:[1167.0521452767,-724213.16703206,-17.073846940092,12020.82470247,-32325550322333e-7,14.91510861353,-4823.2657361591,405113.40542057,-.23855557567849,650.17534844798],src:"iapws-if97"},Tc:{v:647.096,src:"iapws-sat"},rhoc:{v:322,src:"iapws-sat"},vapourDensity:{c:[-2.0315024,-2.6830294,-5.38626492,-17.2991605,-44.7586581,-63.9201063],src:"iapws-sat"},liquidDensity:{b:[1.99274064,1.09965342,-.510839303,-1.75493479,-45.5170352,-674694.45],src:"iapws-sat"},hlv100:{v:2256400,src:"nist"}},surfaceTension:{B:.2358,b:-.625,mu:1.256,src:"iapws-st"},thermo:{liquid:{dHf:{v:-285830,src:"janaf"},S:{v:69.95,src:"janaf"}},gas:{dHf:{v:-241826,src:"janaf"},S:{v:188.835,src:"janaf"}}}},{id:"N2",name:{pl:"azot",de:"Stickstoff",en:"nitrogen"},molarMass:{v:.0280134,src:"codata"},gas:{cp:{v:1041,src:"incropera"},k:{power:[.0259,300,.81],src:"incropera"},mu:{sutherland:[1663e-8,273.15,107],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:191.609,src:"janaf"}}}},{id:"O2",name:{pl:"tlen",de:"Sauerstoff",en:"oxygen"},molarMass:{v:.0319988,src:"codata"},gas:{cp:{v:920,src:"incropera"},k:{power:[.0268,300,.8],src:"incropera"},mu:{sutherland:[1919e-8,273.15,139],src:"sutherland"}},thermo:{gas:{dHf:{v:0,src:"janaf"},S:{v:205.147,src:"janaf"}}}}],kr={D0:{v:2178e-8},T0:{v:273.15},exponent:{v:1.81}},Sr=[{id:"glass",name:{pl:"szkło borokrzemowe",de:"Borosilikatglas",en:"borosilicate glass"},rho:{v:2230,src:"schott"},cp:{v:830,src:"schott"},k:{v:1.2,src:"schott"},contactAngle:{v:25,src:"contact"},cavities:{scale:{v:.02,src:"lemmert"},rmax:{v:3e-6,src:"model"}},color:"#9cc3d5"},{id:"steel",name:{pl:"stal nierdzewna",de:"Edelstahl",en:"stainless steel"},rho:{v:7900,src:"incropera"},cp:{v:477,src:"incropera"},k:{v:14.9,src:"incropera"},contactAngle:{v:70,src:"contact"},cavities:{scale:{v:1,src:"lemmert"},rmax:{v:4e-5,src:"model"}},color:"#7d858e"},{id:"ceramic",name:{pl:"kamyczki wrzenne (ceramika porowata)",de:"Siedesteine (poröse Keramik)",en:"boiling chips (porous ceramic)"},rho:{v:1920,src:"incropera"},cp:{v:835,src:"incropera"},k:{v:.72,src:"incropera"},contactAngle:{v:10,src:"contact"},cavities:{scale:{v:50,src:"lemmert"},rmax:{v:15e-5,src:"model"}},color:"#d8ccb4"}];var Mr={ambient:Ar,species:Tr,vapourInAir:kr,solids:Sr};const Mt=Mr,Zt=Mt.species[0],Xs=Mt.species[1],Ys=Mt.species[2],lt=new Float64Array(rt);lt[tt]=Xs.molarMass.v;lt[et]=Ys.molarMass.v;lt[K]=Zt.molarMass.v;const Wn=Xs.gas.cp.v,Kn=Ys.gas.cp.v,[ds,hs,pe]=Zt.vapour.cp.linear;function Lr(l,t){return l===K?ds+hs*(t-pe):l===tt?Wn:l===et?Kn:0}const ye=Zt.liquid.kell.c,gs=Zt.liquid.cp.table,xt=new Float64Array(gs.map(l=>l[0])),Ft=new Float64Array(gs.map(l=>l[1])),Ht=new Float64Array(gs.length);Ht[0]=Ft[0]*(xt[0]-pt);for(let l=1;l<gs.length;l+=1)Ht[l]=Ht[l-1]+.5*(Ft[l]+Ft[l-1])*(xt[l]-xt[l-1]);const St=gs.length-1;function Wi(l){if(l<xt[0])return-1;if(l>=xt[St])return St;let t=Math.min(St-1,Math.max(0,Math.floor((l-pt)/10)));for(;t>0&&l<xt[t];)t-=1;for(;t<St-1&&l>=xt[t+1];)t+=1;return t}function ge(l){const t=Wi(l);return t<0?Ft[0]:t===St?Ft[St]:Ft[t]+(Ft[t+1]-Ft[t])*(l-xt[t])/(xt[t+1]-xt[t])}function _t(l){const t=Wi(l);if(t<0)return Ht[0]+Ft[0]*(l-xt[0]);if(t===St)return Ht[St]+Ft[St]*(l-xt[St]);const e=l-xt[t],s=(Ft[t+1]-Ft[t])/(xt[t+1]-xt[t]);return Ht[t]+Ft[t]*e+.5*s*e*e}function Cr(l){if(l<Ht[0])return xt[0]+(l-Ht[0])/Ft[0];if(l>=Ht[St])return xt[St]+(l-Ht[St])/Ft[St];let t=Math.min(St-1,Math.max(0,Math.floor(l/41900)));for(;t>0&&l<Ht[t];)t-=1;for(;t<St-1&&l>=Ht[t+1];)t+=1;const e=(Ft[t+1]-Ft[t])/(xt[t+1]-xt[t]),s=l-Ht[t],n=Ft[t];return xt[t]+2*s/(n+Math.sqrt(Math.max(0,n*n+2*e*s)))}function Es(l){const t=l-pt;return(ye[0]+t*(ye[1]+t*(ye[2]+t*(ye[3]+t*(ye[4]+t*ye[5])))))/(1+ye[6]*t)}const sn=Zt.liquid.k.poly;function Ss(l){const t=Math.min(150,Math.max(0,l-pt));return sn[0]+t*(sn[1]+t*sn[2])}const[Or,Br,si]=Zt.liquid.mu.vogel;function Ki(l){return Or*Math.pow(10,Br/(Math.max(l,si+60)-si))}const nn=Zt.surfaceTension,Rr=Zt.saturation.Tc.v;function xe(l){const t=Math.max(0,1-l/Rr);return nn.B*Math.pow(t,nn.mu)*(1+nn.b*t)}const jr=Zt.saturation.hlv100.v,ms=pt+100,zi=_t(ms)+jr,qr=Zt.vapour.k.v,Er=Zt.vapour.mu.v;function dt(l){const t=l-pe,e=ms-pe;return zi+ds*(l-ms)+.5*hs*(t*t-e*e)}function Vr(l){return dt(l)-_t(l)}function Ut(l,t){return l===K?dt(t):Lr(l,t)*(t-pt)}const rn=Xs.gas.k.power,on=Ys.gas.k.power,Dr=Xs.gas.mu.sutherland,Ir=Ys.gas.mu.sutherland,an=Mt.vapourInAir,Qi=(l,t)=>l[0]*Math.pow(t/l[1],1.5)*((l[1]+l[2])/(t+l[2])),Xi=150,Vs=1001,vs=l=>{const t=new Float64Array(Vs);for(let e=0;e<Vs;e+=1)t[e]=l(Xi+e);return t},Ce=(l,t)=>{let e=t-Xi;e>0?e>Vs-1.001&&(e=Vs-1.001):e=0;const s=e|0;return l[s]+(e-s)*(l[s+1]-l[s])},ni=vs(l=>rn[0]*Math.pow(l/rn[1],rn[2])),Gr=vs(l=>on[0]*Math.pow(l/on[1],on[2])),ii=vs(l=>Qi(Dr,l)),Nr=vs(l=>Qi(Ir,l)),Ur=vs(l=>an.D0.v*Math.pow(l/an.T0.v,an.exponent.v));function Hr(l,t,e,s){const n=l+t+e;return n>0?(l*Ce(ni,s)+t*Ce(Gr,s)+e*qr)/n:Ce(ni,s)}function $r(l,t,e,s){const n=l+t+e;return n>0?(l*Ce(ii,s)+t*Ce(Nr,s)+e*Er)/n:Ce(ii,s)}function Wr(l,t){return Ce(Ur,l)*(us/t)}function Yi(l,t,e,s){const n=l*Wn+t*Kn,i=ms-pe,r=.5*e*hs,a=n+e*ds;if(a<=0)return pt;const o=n*(pe-pt)+e*(zi+ds*(pe-ms)-.5*hs*i*i)-s,c=a*a-4*r*o;return pe+-2*o/(a+Math.sqrt(c>0?c:0))}function Ln(l,t,e,s,n){return l*Wn+t*Kn+e*(ds+hs*(n-pe))+(s>0?s*ge(n):0)}const Kr=Mt.ambient.air.N2.v,zr=Mt.ambient.air.O2.v,Ji=Mt.ambient.hExt.v,Rt=Mt.solids.map(l=>({id:l.id,name:l.name,rho:l.rho.v,cp:l.cp.v,k:l.k.v,contactAngle:l.contactAngle.v,cavScale:l.cavities.scale.v,cavRmax:l.cavities.rmax.v,color:l.color}));function Ms(l){return Rt.findIndex(t=>t.id===l)}const Js=Mt.species[0].saturation,ne=Js.if97.n,Zi=ne[0],tr=ne[1],er=ne[2],sr=ne[3],nr=ne[4],ir=ne[5],rr=ne[6],or=ne[7],ar=ne[8],Cn=ne[9],as=Js.Tc.v,Qr=Js.rhoc.v,Ds=273.15,Re=Js.vapourDensity.c;function Is(l){const t=l<Ds?Ds:l>as?as:l,e=t+ar/(t-Cn),s=e*e+Zi*e+tr,n=er*e*e+sr*e+nr,i=ir*e*e+rr*e+or,r=2*i/(-n+Math.sqrt(n*n-4*s*i));return r*r*r*r*1e6}function yt(l){const t=l<611.213?611.213:l>22064e3?22064e3:l,e=Math.sqrt(Math.sqrt(t/1e6)),s=e*e+er*e+ir,n=Zi*e*e+sr*e+rr,i=tr*e*e+nr*e+or,r=2*i/(-n-Math.sqrt(n*n-4*s*i)),a=Cn+r;return(a-Math.sqrt(a*a-4*(ar+Cn*r)))/2}function cr(l){const e=1-(l<Ds?Ds:l>as?as:l)/as,s=Math.pow(e,1/6),n=s*s,i=n*n,r=i*i,a=r*r*n,o=a*a*s,c=o*a*r*r;return Qr*Math.exp(Re[0]*n+Re[1]*i+Re[2]*r+Re[3]*a+Re[4]*o+Re[5]*c)}const Gs=250,Ns=.01,xs=25001,Ls=new Float64Array(xs),Cs=new Float64Array(xs);for(let l=0;l<xs;l+=1)Ls[l]=Is(Gs+l*Ns),Cs[l]=cr(Gs+l*Ns);function rs(l){const t=(l-Gs)/Ns;if(!(t>=0)||t>=xs-1)return Is(l);const e=t|0;return Ls[e]+(t-e)*(Ls[e+1]-Ls[e])}function ve(l){const t=(l-Gs)/Ns;if(!(t>=0)||t>=xs-1)return cr(l);const e=t|0;return Cs[e]+(t-e)*(Cs[e+1]-Cs[e])}const lr=200;function cn(l,t,e,s){const n=yt(l);return t/ve(n)-e*Bt*n/(s-l)}function Xr(l,t){const e=Math.PI*t*t*t/6;if(l<=e)return Math.cbrt(3*l/(4*Math.PI));const s=Math.PI*t*t*t/4;return l<=s?t/2:Math.sqrt(l/(Math.PI*t))}function Yr(l,t,e,s){const n=Math.PI*e*e*e/6,i=Math.PI*e*e*e/4;if(l<=n){s.area=4*Math.PI*t*t,s.front=Math.PI*t*t;return}if(l>=i){s.area=2*Math.PI*t*e,s.front=2*t*e;return}const r=(l-n)/(i-n);s.area=Math.PI*e*e,s.front=(1-r)*(Math.PI*e*e)/4+r*e*e}function Jr(l,t,e,s,n,i,r){const a=l[t+K],o=l[t+tt]/lt[tt]+l[t+et]/lt[et],c=a/lt[K];let f=i>0?i:Math.cbrt(3*Math.max(1e-30,(c+o)*Bt*s/e)/(4*Math.PI)),u=e,d=0,g=s,h=0;for(let v=0;v<8;v+=1){if(u=e+2*xe(g)/f,o<=0)d=u,g=yt(d),h=a/ve(g);else if(c<=1e-9*o)d=0,g=s,h=o*Bt*g/u;else{let x=611.213,F=u*(1-1e-12),y=cn(x,a,o,u),w=cn(F,a,o,u);if(y<=0)d=x;else if(w>=0)d=F;else{let b=0;d=.5*(x+F);for(let P=0;P<40;P+=1){d=(x*w-F*y)/(w-y);const _=cn(d,a,o,u);if(Math.abs(_)<=1e-12*(a/ve(s)+1e-30))break;_>0?(x=d,y=_,b===1&&(w/=2),b=1):(F=d,w=_,b===-1&&(y/=2),b=-1)}}g=yt(d),h=a/ve(g)}const m=Xr(h,n);if(Math.abs(m-f)<=1e-7*f){f=m;break}f=m}r.r=f,r.V=h,r.pb=e+2*xe(g)/f,r.pv=d,r.Tb=g,Yr(h,f,n,r)}function ri(l,t,e,s){let n=0;for(let i=0;i<rt;i+=1)l[t+i]>0&&(n+=l[t+i]*s(i,e));return n}function oi(l,t,e,s,n,i,r,a,o,c){let f=0;if(2*e<=3*i){const x=l/i-.5,F=t/i-.5,y=Math.floor(x-.5),w=Math.floor(F-.5),b=x-y,P=F-w,_=.5*(1.5-b)**2,A=.75-(b-1)**2,C=.5*(b-.5)**2,L=.5*(1.5-P)**2,R=.75-(P-1)**2,E=.5*(P-.5)**2;let J=0;for(let G=0;G<3;G+=1){const q=w+G;if(q<0||q>=a)continue;const B=G===0?L:G===1?R:E;for(let D=0;D<3;D+=1){const M=y+D;if(M<0||M>=r)continue;const j=B*(D===0?_:D===1?A:C);o[f]=M+q*r,c[f]=j,J+=j,f+=1}}for(let G=0;G<f;G+=1)c[G]/=J;return f}const u=s<=Math.PI*n*n*n/6,d=Math.max(0,Math.floor((l-e)/i)),g=Math.min(r-1,Math.floor((l+e)/i)),h=Math.max(0,Math.floor((t-e)/i)),v=Math.min(a-1,Math.floor((t+e)/i));let m=0;for(let x=h;x<=v;x+=1)for(let F=d;F<=g;F+=1){let y=0;for(let w=0;w<4;w+=1){const b=(x+(w+.5)/4)*i-t;for(let P=0;P<4;P+=1){const _=(F+(P+.5)/4)*i-l,A=e*e-_*_-b*b;A>0&&(y+=u?Math.sqrt(A):1)}}y<=0||f>=o.length||(o[f]=F+x*r,c[f]=y,m+=y,f+=1)}if(m<=0)return o[0]=Math.min(r-1,Math.max(0,Math.floor(l/i)))+Math.min(a-1,Math.max(0,Math.floor(t/i)))*r,c[0]=1,1;for(let x=0;x<f;x+=1)c[x]/=m;return f}const je=.5;class Zr{constructor(t){p(this,"e");p(this,"ux0");p(this,"uy0");p(this,"vel",new Float64Array(2));p(this,"w3",new Float64Array(6));this.e=t;const e=t.bubbles.cap;this.ux0=new Float32Array(e),this.uy0=new Float32Array(e)}move(t,e,s){const n=this.e,i=n.grid,r=n.bubbles,a=n.liquid,o=r.x[t],c=r.y[t],f=r.r[t],u=r.V[t],d=Math.max(f+i.dx,2*i.dx),g=this.vel;let h=0,v=0;for(let ot=0;ot<8;ot+=1){const ht=ot*Math.PI/4;a.velocityAt(o+d*Math.cos(ht),c+d*Math.sin(ht),g),h+=g[0]/8,v+=g[1]/8}const m=i.cellAt(o,c),x=m>=0&&n.phase.Cl[m]>0?n.phase.Tl[m]:r.Tb[t],F=a.rhoRef,y=Ki(x),w=r.totalMass(t)/Math.max(1e-30,u),b=(h-this.ux0[t])/Math.max(e,1e-6),P=(v-this.uy0[t])/Math.max(e,1e-6);if(this.ux0[t]=h,this.uy0[t]=v,f<2e-5){r.vx[t]=h,r.vy[t]=v,r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,o+e*h)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,c+e*v));return}const _=r.vx[t]-h,A=r.vy[t]-v,C=Math.hypot(_,A),L=2*f,R=Math.max(1e-6,F*C*L/y),E=Math.max(0,n.gy)*(F-w)*L*L/xe(x),G=.5*Math.max(24/R*(1+.15*Math.pow(R,.687)),8/3*(E/(E+4)))*F*this.front(t)*C,q=(w+je*F)*u,B=F*u*b,D=F*u*(P+n.gy),M=-w*u*n.gy,j=je*F*u*b,nt=je*F*u*P,W=s>0?je*F*s:0,S=s<0?Math.min(-s,.2*u/e):0,H=je*F*S*_,T=je*F*S*A,O=(q*r.vx[t]+e*(B+j+H)+e*(G+W)*h)/(q+e*(G+W)),k=(q*r.vy[t]+e*(D+M+nt+T)+e*(G+W)*v)/(q+e*(G+W));r.vx[t]=Number.isFinite(O)?O:h,r.vy[t]=Number.isFinite(k)?k:v;const N=-G*(O-h),z=-G*(k-v),st=t*$t;r.force[st]=B,r.force[st+1]=D,r.force[st+2]=0,r.force[st+3]=M,r.force[st+4]=N,r.force[st+5]=z,r.force[st+6]=j+H-W*(O-h),r.force[st+7]=nt+T-W*(k-v),this.spreadForce(o,c,-(N+r.force[st+6])*(e/n.dt),-(z+r.force[st+7])*(e/n.dt));let it=o+e*O,V=c+e*k;const Q=i.sdfAt(it,V);if(Q<f){const ot=.25*i.dx;let ht=i.sdfAt(it+ot,V)-i.sdfAt(it-ot,V),Vt=i.sdfAt(it,V+ot)-i.sdfAt(it,V-ot);const tn=Math.hypot(ht,Vt);if(tn>1e-12){ht/=tn,Vt/=tn,it+=(f-Q)*ht,V+=(f-Q)*Vt;const en=r.vx[t]*ht+r.vy[t]*Vt;en<0&&(r.vx[t]-=en*ht,r.vy[t]-=en*Vt)}}r.x[t]=Math.min(i.w-1e-6,Math.max(1e-6,it)),r.y[t]=Math.min(i.h-1e-6,Math.max(1e-6,V));const $=i.depth;r.z[t]=2*f>=$?$/2:Math.min($-f,Math.max(f,r.z[t]))}spreadForce(t,e,s,n){const i=this.e.liquid,r=this.e.grid,{nx:a,ny:o,dx:c}=r,f=this.w3;let u=Math.floor(t/c-.5),d=t/c-u;f[0]=.5*(1.5-d)**2,f[1]=.75-(d-1)**2,f[2]=.5*(d-.5)**2;let g=Math.floor(e/c-1);d=e/c-.5-g,f[3]=.5*(1.5-d)**2,f[4]=.75-(d-1)**2,f[5]=.5*(d-.5)**2;for(let h=0;h<3;h+=1)for(let v=0;v<3;v+=1){const m=u+v,x=g+h;m<0||m>a||x<0||x>=o||(i.fU[m+x*(a+1)]+=s*f[v]*f[3+h])}u=Math.floor(t/c-1),d=t/c-.5-u,f[0]=.5*(1.5-d)**2,f[1]=.75-(d-1)**2,f[2]=.5*(d-.5)**2,g=Math.floor(e/c-.5),d=e/c-g,f[3]=.5*(1.5-d)**2,f[4]=.75-(d-1)**2,f[5]=.5*(d-.5)**2;for(let h=0;h<3;h+=1)for(let v=0;v<3;v+=1){const m=u+v,x=g+h;m<0||m>=a||x<0||x>o||(i.fV[m+x*a]+=n*f[v]*f[3+h])}}front(t){const e=this.e.bubbles,s=this.e.grid.depth,n=e.V[t],i=e.r[t],r=Math.PI*s*s*s/6,a=Math.PI*s*s*s/4;if(n<=r)return Math.PI*i*i;if(n>=a)return 2*i*s;const o=(n-r)/(a-r);return(1-o)*(Math.PI*s*s)/4+o*s*s}}class fr{constructor(t){p(this,"state");this.state=t>>>0||2654435769}next(){let t=this.state=this.state+1831565813>>>0;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}exp(){return-Math.log(1-this.next())}}function to(l,t,e){let s=(l^Math.imul(t,2654435761)^Math.imul(e,2246822519))>>>0;return s^=s>>>16,s=Math.imul(s,2146121005),s^=s>>>15,s=Math.imul(s,2221713035),s^=s>>>16,s>>>0}const eo=8,so=210,ai=1.805,no=3e-7;function ci(l,t){const e=yt(t);return yt(t+2*xe(e)/l)-e}class io{constructor(){p(this,"count",0);p(this,"cell",new Int32Array(0));p(this,"fluid",new Int32Array(0));p(this,"dir",new Uint8Array(0));p(this,"r",new Float32Array(0));p(this,"s",new Float32Array(0));p(this,"z",new Float32Array(0));p(this,"bubble",new Uint32Array(0));p(this,"pos",new Float64Array(2))}rebuild(t,e){const{nx:s,ny:n}=t,i=yt(us),r=2*xe(i)/(rs(i+1)-us),a=so*r,o=t.dx*t.depth,c=[],f=[],u=[],d=[],g=[],h=[],v=new fr(1);for(let m=0;m<t.n;m+=1){if(t.solid[m]===0)continue;const x=Rt[t.solid[m]-1],F=m%s,y=(m-F)/s;for(let w=0;w<4;w+=1){const b=w===0?F-1:w===1?F+1:F,P=w===2?y-1:w===3?y+1:y;if(b<0||P<0||b>=s||P>=n)continue;const _=b+P*s;if(t.solid[_]!==0)continue;v.state=to(e,m,w)||1;const A=Math.pow(a/x.cavRmax,ai);let C=0;for(let L=0;L<eo;L+=1){C+=v.exp();const R=a*Math.pow(C/(o*x.cavScale)+A,-1/ai);if(R<no)break;c.push(m),f.push(_),u.push(w),d.push(R),g.push(v.next()),h.push(v.next())}}}this.count=c.length,this.cell=Int32Array.from(c),this.fluid=Int32Array.from(f),this.dir=Uint8Array.from(u),this.r=Float32Array.from(d),this.s=Float32Array.from(g),this.z=Float32Array.from(h),this.bubble=new Uint32Array(c.length)}largest(t,e){let s=0;for(let n=0;n<this.count;n+=1)Rt[t.solid[this.cell[n]]-1].id===e&&this.r[n]>s&&(s=this.r[n]);return s}position(t,e,s){const n=this.cell[e],i=n%t.nx,r=(n-i)/t.nx,a=this.s[e],o=this.dir[e],c=t.dx;return o===0?(this.pos[0]=i*c-s,this.pos[1]=(r+a)*c):o===1?(this.pos[0]=(i+1)*c+s,this.pos[1]=(r+a)*c):o===2?(this.pos[0]=(i+a)*c,this.pos[1]=r*c-s):(this.pos[0]=(i+a)*c,this.pos[1]=(r+1)*c+s),this.pos}}const ro=.0208,oo=1;class ao{constructor(t){p(this,"e");p(this,"burstVapour",0);p(this,"nucleated",0);p(this,"departed",0);p(this,"merged",0);p(this,"burst",0);p(this,"collapsed",0);p(this,"burstCold",0);p(this,"collapsedCold",0);p(this,"burstWarm",0);p(this,"collapsedWarm",0);p(this,"firstSuperheat",null);p(this,"firstMaterial",null);p(this,"departures",new Float64Array(256));p(this,"departureCount",0);p(this,"contactAngleOverride",null);p(this,"watch",-1);p(this,"watchFate",0);p(this,"sites",new io);p(this,"motion");p(this,"shape",{r:0,V:0,pb:0,pv:0,Tb:0,area:0,front:0});p(this,"cells",new Int32Array(1024));p(this,"wts",new Float64Array(1024));p(this,"alphaTarget");p(this,"budget");p(this,"tsatCell");p(this,"Fm");p(this,"vel",new Float64Array(2));p(this,"head");p(this,"next");p(this,"bulkCold",!1);this.e=t;const e=t.grid.n;this.alphaTarget=new Float32Array(e),this.budget=new Float64Array(e),this.tsatCell=new Float64Array(e),this.Fm=new Float64Array(e);const s=t.bubbles.cap;this.motion=new Zr(t),this.head=new Int32Array(e),this.next=new Int32Array(s)}get B(){return this.e.bubbles}rebuildSites(){this.sites.rebuild(this.e.grid,this.e.scene.seed);const t=this.B;for(let e=0;e<t.count;e+=1)t.site[e]=-1}largestCavity(t){return this.sites.largest(this.e.grid,t)}activation(t,e){return ci(t,e)}get siteCount(){return this.sites.count}get cavities(){return this.sites}get motionState(){return this.motion}pressure(t,e){const s=this.e,n=s.grid,{nx:i,ny:r,dx:a}=n,o=Math.min(i-1.0001,Math.max(0,t/a-.5)),c=Math.min(r-1.0001,Math.max(0,e/a-.5)),f=Math.floor(o),u=Math.floor(c),d=o-f,g=c-u;let h=0,v=0;for(let m=0;m<2;m+=1)for(let x=0;x<2;x+=1){const F=f+x+(u+m)*i;if(n.solid[F]!==0)continue;const y=(x===0?1-d:d)*(m===0?1-g:g);h+=y*n.pl[F],v+=y}return s.pRef+(v>0?h/v:0)}liquidFootprint(t){const s=this.e.grid,n=this.B,i=oi(n.x[t],n.y[t],n.r[t],n.V[t],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);let r=0,a=0;for(let o=0;o<i;o+=1){const c=this.cells[o];s.kind[c]===ct&&(this.cells[a]=c,this.wts[a]=this.wts[o],r+=this.wts[o],a+=1)}for(let o=0;o<a;o+=1)this.wts[o]/=r;return r>0?a:0}solve(t,e){const s=this.B,n=this.e.grid,i=this.shape;Jr(s.m,t*rt,this.pressure(s.x[t],s.y[t]),e,n.depth,s.r[t],i),s.r[t]=i.r,s.V[t]=i.V,s.pb[t]=i.pb,s.pv[t]=i.pv,s.Tb[t]=i.Tb}step(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;i.gatherLiquid();const{n:r,kind:a}=s;for(let c=0;c<r;c+=1){if(a[c]!==ct){this.budget[c]=0,this.tsatCell[c]=0;continue}const f=yt(e.pRef+s.pl[c]);this.tsatCell[c]=f,this.budget[c]=i.Cl[c]*(i.Tl[c]-f)}this.Fm.fill(0);const o=e.waterTemperature();if(this.bulkCold=o.mass>0&&o.mean<=yt(e.regions.pAmb)-5,n.count>0||this.sites.count>0){this.nucleate(t);for(let c=0;c<n.count;c+=1)this.advance(c,t);this.coalesce();for(let c=n.count-1;c>=0;c-=1)this.finish(c,t)}i.applyMass(this.Fm,t),this.updateAlpha(t)}nucleate(t){const e=this.e,s=e.grid,n=this.B,i=e.phase;for(let r=0;r<this.sites.count;r+=1){if(this.sites.bubble[r]!==0)continue;const a=this.sites.fluid[r];if(s.kind[a]!==ct||i.acc[a]<=0)continue;const o=this.sites.cell[r],c=Rt[s.solid[o]-1],f=i.Tl[a],u=Ss(f),d=(c.k*s.T[o]+u*f)/(c.k+u),g=e.pRef+s.pl[a],h=this.tsatCell[a]>0?this.tsatCell[a]:yt(g);if(d-h<0)continue;const v=this.sites.r[r];if(d-h<ci(v,g))continue;const m=g+2*xe(d)/v,x=yt(m),F=4/3*Math.PI*v*v*v,y=ve(x)*F;if(y*4>i.acc[a])continue;const w=this.sites.position(this.e.grid,r,v),b=n.add(w[0],w[1],Math.min(s.depth-v,Math.max(v,this.sites.z[r]*s.depth)));if(b<0)return;n.m[b*rt+K]=y,n.r[b]=v,n.V[b]=F,n.Tb[b]=x,n.pb[b]=m,n.pv[b]=m,n.H[b]=y*dt(x),n.site[b]=r,n.age[b]=0,this.sites.bubble[r]=n.id[b],this.motion.ux0[b]=0,this.motion.uy0[b]=0;const P=i.accH[a]/i.acc[a];this.Fm[a]-=y,e.heat.src[o]-=y*(dt(x)-P)/t,this.nucleated+=1,this.firstSuperheat===null&&(this.firstSuperheat=d-h,this.firstMaterial=c.id)}}advance(t,e){const s=this.e,n=s.grid,i=this.B,r=s.phase,a=t*rt;let o=i.site[t],c=0;const f=i.V[t];let u=0,d=f;for(;c<e-1e-12;){d=i.V[t];const g=i.r[t],h=Math.hypot(i.vx[t],i.vy[t]);let v=Math.min(e-c,Math.max(1e-7,oo*i.age[t]),.25*n.dx/(h+1e-9));v<1e-7&&(v=Math.min(e-c,1e-7));let m,x=-1,F=0;if(o>=0){const k=this.sites.fluid[o],N=this.sites.cell[o],z=Rt[n.solid[N]-1],st=r.Tl[k],it=Ss(st);m=(z.k*n.T[N]+it*st)/(z.k+it),x=N}else{if(F=this.liquidFootprint(t),F===0)break;m=0;for(let k=0;k<F;k+=1)m+=this.wts[k]*r.Tl[this.cells[k]]}const y=i.Tb[t],w=Ss(m),b=Es(m),P=ge(m),_=Ki(m),A=w/(b*P),C=2*g,L=i.age[t],R=w*Math.sqrt(3/(Math.PI*A)),E=o>=0?0:Math.hypot(i.vx[t]-this.motion.ux0[t],i.vy[t]-this.motion.uy0[t]),J=b*E*C/_,G=_*P/w,q=w/C*(2+.6*Math.sqrt(J)*Math.cbrt(G)),B=dt(y)-_t(m);let D=Math.max(R*2*(Math.sqrt(L+v)-Math.sqrt(L)),q*v);if(o>=0&&m>y){const k=.5*this.fritz(t,m),N=i.m[a+K]>0?i.m[a+K]/i.V[t]:ve(y),z=D*(m-y)/(N*B);if(g<k&&g+z>k&&z>0){const st=D*(k-g)/z;if(q*v>=R*2*(Math.sqrt(L+v)-Math.sqrt(L)))v=st/q;else{const it=Math.sqrt(L)+st/(2*R);v=it*it-L}v=Math.max(1e-9,Math.min(e-c,v*(1+1e-6))),D=Math.max(R*2*(Math.sqrt(L+v)-Math.sqrt(L)),q*v)}}const M=n.depth,j=i.V[t],nt=i.m[a+K]>0?i.m[a+K]/j:ve(y),W=D*(m-y)/(nt*B),S=Math.max(0,g+W);let H;j<=Math.PI*M*M*M/6?H=4/3*Math.PI*(S*S*S-g*g*g):j>=Math.PI*M*M*M/4?H=Math.PI*M*(S*S-g*g):H=Math.PI*M*M*D*(m-y)/(nt*B);let T=nt*H*B;if(o>=0){const k=x,N=Rt[n.solid[k]-1],z=N.rho*N.cp*n.vCell*Math.max(0,n.T[k]-y);T>0&&(T=Math.min(T,Math.max(0,z-this.used(k))))}else{let k=0;for(let N=0;N<F;N+=1)k+=this.wts[N]*this.budget[this.cells[N]];T>0?T=Math.min(T,Math.max(0,k)):T=Math.max(T,Math.min(0,k))}let O=T/B;if(O<0&&(O=Math.max(O,-i.m[a+K])),O!==0){if(o>=0){const k=this.sites.fluid[o];O>0&&r.acc[k]+this.Fm[k]-O<0&&(O=Math.max(0,r.acc[k]+this.Fm[k]));const N=r.acc[k]>0?r.accH[k]/r.acc[k]:_t(m);this.Fm[k]-=O,s.heat.src[x]-=O*(dt(y)-N)/e,this.budgetSolid(x,O*(dt(y)-N))}else for(let k=0;k<F;k+=1){const N=this.cells[k],z=this.wts[k],st=r.acc[N]>0?r.accH[N]/r.acc[N]:_t(m);this.Fm[N]-=O*z,s.heat.src[N]-=O*z*(dt(y)-st)/e,this.budget[N]-=O*z*(dt(y)-st)}i.m[a+K]+=O,i.H[t]+=O*dt(y),u+=O}if(this.solve(t,m),this.restoreEnthalpy(t,o,F,e),i.r[t]<1e-6||i.m[a+K]<=1e-18&&i.m[a+tt]+i.m[a+et]<=0){i.age[t]+=v;break}if(o>=0){const k=this.sites.position(this.e.grid,o,i.r[t]);i.x[t]=k[0],i.y[t]=k[1],this.departure(t,m),o=i.site[t]}else this.motion.move(t,v,(i.V[t]-d)/v);if(i.age[t]+=v,c+=v,i.m[a+K]<=0&&i.m[a+tt]+i.m[a+et]<=0)break}i.dmdt[t]=u/e}used(t){return-this.budget[t]}budgetSolid(t,e){this.budget[t]-=e}restoreEnthalpy(t,e,s,n){const i=this.e,r=this.B,a=ri(r.m,t*rt,r.Tb[t],Ut),o=a-r.H[t];if(o!==0){if(r.H[t]=a,e>=0){i.heat.src[this.sites.cell[e]]-=o/n;return}if(s!==0)for(let c=0;c<s;c+=1)i.heat.src[this.cells[c]]-=o*this.wts[c]/n}}fritz(t,e){const s=this.e,n=s.grid,i=this.B,r=i.site[t];if(r<0||s.gy<=0)return 1/0;const a=Rt[n.solid[this.sites.cell[r]]-1],o=this.contactAngleOverride??a.contactAngle,c=i.totalMass(t)/Math.max(1e-30,i.V[t]);return ro*o*Math.sqrt(xe(i.Tb[t])/(s.gy*(Es(e)-c)))}departure(t,e){const s=this.e,n=this.B,i=n.site[t];if(i<0||s.gy<=0)return;const r=this.fritz(t,e),a=2*Math.cbrt(3*n.V[t]/(4*Math.PI));if(a<r*(1-1e-4))return;this.sites.bubble[i]=0,n.site[t]=-1,this.departed+=1,this.departures[this.departureCount%this.departures.length]=a,this.departureCount+=1;const o=this.vel;s.liquid.velocityAt(n.x[t],n.y[t],o),this.motion.ux0[t]=o[0],this.motion.uy0[t]=o[1],n.vx[t]=o[0],n.vy[t]=o[1]}coalesce(){const e=this.e.grid,s=this.B,{nx:n,ny:i,dx:r}=e;if(s.count<2)return;this.head.fill(-1);let a=0;for(let c=0;c<s.count;c+=1){const f=e.cellAt(s.x[c],s.y[c]);if(f<0){this.next[c]=-1;continue}this.next[c]=this.head[f],this.head[f]=c,s.r[c]>a&&(a=s.r[c])}const o=Math.ceil(2*a/r);for(let c=0;c<s.count;c+=1){if(s.V[c]<=0)continue;const f=Math.floor(s.x[c]/r),u=Math.floor(s.y[c]/r);for(let d=Math.max(0,u-o);d<=Math.min(i-1,u+o);d+=1)for(let g=Math.max(0,f-o);g<=Math.min(n-1,f+o);g+=1)for(let h=this.head[g+d*n];h>=0;h=this.next[h]){if(h<=c||s.V[h]<=0)continue;const v=s.x[h]-s.x[c],m=s.y[h]-s.y[c],x=e.depth,y=2*s.r[c]>=x||2*s.r[h]>=x?0:s.z[h]-s.z[c],w=s.r[c]+s.r[h];v*v+m*m+y*y>=w*w||this.merge(c,h)}}}merge(t,e){const s=this.B,n=s.V[t],i=s.V[e],r=n+i;s.x[t]=(s.x[t]*n+s.x[e]*i)/r,s.y[t]=(s.y[t]*n+s.y[e]*i)/r,s.z[t]=(s.z[t]*n+s.z[e]*i)/r,s.vx[t]=(s.vx[t]*n+s.vx[e]*i)/r,s.vy[t]=(s.vy[t]*n+s.vy[e]*i)/r;for(let a=0;a<rt;a+=1)s.m[t*rt+a]+=s.m[e*rt+a],s.m[e*rt+a]=0;s.H[t]+=s.H[e],s.H[e]=0,s.age[t]=Math.max(s.age[t],s.age[e]),s.site[e]>=0&&(this.sites.bubble[s.site[e]]=0),s.site[t]>=0!=s.site[e]>=0&&s.site[t]>=0&&(this.sites.bubble[s.site[t]]=0,s.site[t]=-1),s.site[e]=-1,s.V[e]=0,s.id[e]===this.watch&&(this.watch=s.id[t],this.watchFate=3),s.r[t]=Math.cbrt(3*r/(4*Math.PI)),this.merged+=1}finish(t,e){const n=this.e.grid,i=this.B,r=t*rt,a=i.totalMass(t);if(i.V[t]<=0||a<=0){this.drop(t,!1,e);return}if(i.r[t]<1e-6||i.m[r+K]<=1e-18&&i.m[r+tt]+i.m[r+et]<=0){this.drop(t,!1,e);return}if(i.site[t]>=0)return;const o=n.cellAt(i.x[t],i.y[t]+i.r[t]),c=n.cellAt(i.x[t],i.y[t]);(o<0||n.kind[o]===I||c<0||n.kind[c]===I)&&this.drop(t,!0,e)}drop(t,e,s){const n=this.e,i=n.grid,r=this.B,a=t*rt,o=i.n,c=r.m[a+K],f=r.m[a+tt]+r.m[a+et];if(e||f>0){let g=i.cellAt(r.x[t],Math.min(i.h-1e-9,r.y[t]+r.r[t]));for(;g>=0&&i.kind[g]!==I;)g=g+i.nx<o?g+i.nx:-1;if(g<0&&(g=this.anyGasAbove(r.x[t])),g>=0){const h=this.gasCellsAround(g,r.V[t]);for(let v=0;v<h;v+=1){const m=this.cells[v],x=this.wts[v];for(let F=0;F<rt;F+=1)i.mg[F*o+m]+=x*r.m[a+F];i.Hg[m]+=x*r.H[t],n.gas.deriveCell(m)}this.burstVapour+=c,e&&(this.burst+=1,this.bulkCold?this.burstCold+=1:this.burstWarm+=1)}else return}else if(c>0){const g=this.liquidFootprint(t);if(g>0){const h=n.phase;for(let v=0;v<g;v+=1){const m=this.cells[v],x=this.wts[v],F=h.acc[m]>0?h.accH[m]/h.acc[m]:_t(r.Tb[t]);this.Fm[m]+=c*x,n.heat.src[m]+=x*(r.H[t]-c*F)/s}}else{const h=i.cellAt(r.x[t],r.y[t]);h>=0&&(i.mg[K*o+h]+=c,i.Hg[h]+=r.H[t],n.gas.deriveCell(h))}this.collapsed+=1,this.bulkCold?this.collapsedCold+=1:this.collapsedWarm+=1}const u=r.site[t];u>=0&&(this.sites.bubble[u]=0),r.id[t]===this.watch&&(this.watch=-1,this.watchFate=e?1:2);const d=r.count-1;if(t!==d){this.motion.ux0[t]=this.motion.ux0[d],this.motion.uy0[t]=this.motion.uy0[d];const g=r.site[d];g>=0&&(this.sites.bubble[g]=r.id[d])}r.remove(t)}gasCellsAround(t,e){const s=this.e.grid,{nx:n,ny:i}=s,r=this.e.gas.vgas,a=t%n,o=(t-a)/n;let c=0,f=0;for(let u=0;u<=6&&(c===0||f<2*e);u+=1)for(let d=0;d<=u;d+=1)for(let g=-u;g<=u;g+=1){if(Math.max(Math.abs(g),d)!==u)continue;const h=a+g,v=o+d;if(h<0||v<0||h>=n||v>=i)continue;const m=h+v*n;if(s.kind[m]!==I||c>=this.cells.length)continue;const x=Math.max(.001*s.vCell,r[m]);this.cells[c]=m,this.wts[c]=x,f+=x,c+=1}for(let u=0;u<c;u+=1)this.wts[u]/=f;return c}anyGasAbove(t){const e=this.e.grid,s=Math.min(e.nx-1,Math.max(0,Math.floor(t/e.dx)));for(let n=e.ny-1;n>=0;n-=1)if(e.kind[s+n*e.nx]===I)return s+n*e.nx;return-1}updateAlpha(t){const e=this.e,s=e.grid,n=this.B,i=this.alphaTarget;i.fill(0);const r=1/s.vCell;for(let f=0;f<n.count;f+=1){const u=oi(n.x[f],n.y[f],n.r[f],n.V[f],s.depth,s.dx,s.nx,s.ny,this.cells,this.wts);for(let d=0;d<u;d+=1)i[this.cells[d]]+=this.wts[d]*n.V[f]*r}const a=s.alpha,o=e.liquid.volSrc,c=lr*t;for(let f=0;f<s.n;f+=1){const u=i[f]-a[f];u!==0&&(u>c?(o[f]+=c*s.vCell/t,a[f]+=c):u<-c?(o[f]-=c*s.vCell/t,a[f]-=c):(o[f]+=u*s.vCell/t,a[f]=i[f]))}}spawn(t,e,s,n,i){const r=this.e,a=this.B,o=a.add(t,e,s);if(o<0)return-1;const c=this.pressure(t,e),f=r.grid.cellAt(t,e),u=f>=0&&r.phase.Tl[f]>0?r.phase.Tl[f]:r.ambientT,d=c+2*xe(u)/n,g=4/3*Math.PI*n*n*n,h=o*rt;if(i<=0){const v=yt(d);a.m[h+K]=ve(v)*g}else{const v=d*g/(8.314462618*u);a.m[h+tt]=v*.79*lt[tt],a.m[h+et]=v*.21*lt[et]}return a.r[o]=n,this.solve(o,u),a.H[o]=ri(a.m,h,a.Tb[o],Ut),r.ledger.water+=a.m[h+K],r.ledger.air+=a.m[h+tt]+a.m[h+et],r.ledger.energy+=a.H[o],this.motion.ux0[o]=0,this.motion.uy0[o]=0,o}describe(t){const e=this.B;if(t<0||t>=e.count)return null;const s=t*rt,n=t*$t;return{id:e.id[t],r:e.r[t],T:e.Tb[t],pb:e.pb[t],pv:e.pv[t],Tsat:yt(e.pb[t]),mv:e.m[s+K],ma:e.m[s+tt]+e.m[s+et],vx:e.vx[t],vy:e.vy[t],dmdt:e.dmdt[t],attached:e.site[t]>=0,force:Array.from(e.force.subarray(n,n+$t))}}liquidVelocity(t){return[this.motion.ux0[t],this.motion.uy0[t]]}get solidKind(){return ft}}function li(){return{heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,editEnergy:0,escapedWater:0,escapedAir:0,editWater:0,editAir:0}}function co(l,t,e,s,n,i){const r=l.n;let a=0,o=0,c=0,f=0,u=0,d=0;for(let y=0;y<r;y+=1){if(l.kind[y]===ft||l.solid[y]!==0){a+=l.Es[y],u+=l.film[y];continue}o+=l.Hg[y],c+=l.mg[K*r+y],f+=l.mfog[y],d+=l.mg[tt*r+y]+l.mg[et*r+y]}let g=0,h=0;for(let y=0;y<t.count;y+=1)g+=t.mass[y]*t.h[y],h+=t.mass[y];let v=0,m=0;for(let y=0;y<e.count;y+=1)v+=e.H[y],m+=e.m[y*rt+K],d+=e.m[y*rt+tt]+e.m[y*rt+et];const x=s.pvTerm();i.solids=a,i.liquid=g,i.gas=o,i.bubbles=v,i.pv=x,i.energy=a+g+o+v+x;const F=i.water;return F.liquid=h,F.vapour=c,F.fog=f,F.film=u,F.bubbles=m,F.escaped=n.escapedWater,F.total=h+c+f+u+m+n.escapedWater,i.air=d+n.escapedAir,i}function lo(){return{energy:0,solids:0,liquid:0,gas:0,bubbles:0,pv:0,air:0,water:{liquid:0,vapour:0,fog:0,film:0,bubbles:0,escaped:0,total:0}}}const fi=l=>typeof l=="number"&&Number.isFinite(l)?l:null;function ys(l){if(l===null||typeof l!="object")return null;const t=l,e=(a,o)=>{if(!Array.isArray(a)||a.length!==o)return null;const c=a.map(fi);return c.every(f=>f!==null)?c:null},s=e(t.rect,4);if(s!==null)return{rect:[Math.min(s[0],s[2]),Math.min(s[1],s[3]),Math.max(s[0],s[2]),Math.max(s[1],s[3])]};const n=e(t.circle,3);if(n!==null&&n[2]>0)return{circle:[n[0],n[1],n[2]]};if(Array.isArray(t.poly)&&t.poly.length>=3){const a=t.poly.map(o=>e(o,2));if(a.every(o=>o!==null))return{poly:a.map(o=>[o[0],o[1]])}}const i=e(t.line,4),r=fi(t.width);return i!==null&&r!==null&&r>0?{line:[i[0],i[1],i[2],i[3]],width:r}:null}function Be(l,t,e){if("rect"in l){const[g,h,v,m]=l.rect;return t>=g&&t<=v&&e>=h&&e<=m}if("circle"in l){const[g,h,v]=l.circle;return(t-g)*(t-g)+(e-h)*(e-h)<=v*v}if("poly"in l){const g=l.poly;let h=!1;for(let v=0,m=g.length-1;v<g.length;m=v,v+=1){const[x,F]=g[v],[y,w]=g[m];F>e!=w>e&&t<(y-x)*(e-F)/(w-F)+x&&(h=!h)}return h}const[s,n,i,r]=l.line,a=i-s,o=r-n,c=a*a+o*o,f=c>0?Math.max(0,Math.min(1,((t-s)*a+(e-n)*o)/c)):0,u=t-(s+f*a),d=e-(n+f*o);return u*u+d*d<=.25*l.width*l.width}function ur(l){if("rect"in l)return[l.rect[0],l.rect[1],l.rect[2],l.rect[3]];if("circle"in l){const[r,a,o]=l.circle;return[r-o,a-o,r+o,a+o]}if("poly"in l){let r=1/0,a=1/0,o=-1/0,c=-1/0;for(const[f,u]of l.poly)r=Math.min(r,f),a=Math.min(a,u),o=Math.max(o,f),c=Math.max(c,u);return[r,a,o,c]}const t=l.width/2,[e,s,n,i]=l.line;return[Math.min(e,n)-t,Math.min(s,i)-t,Math.max(e,n)+t,Math.max(s,i)+t]}function Fs(l){return"rect"in l?{rect:[...l.rect]}:"circle"in l?{circle:[...l.circle]}:"poly"in l?{poly:l.poly.map(t=>[t[0],t[1]])}:{line:[...l.line],width:l.width}}function Os(l,t,e){const[s,n,i,r]=ur(t),a=Math.max(0,Math.floor(s/l.dx)),o=Math.min(l.nx-1,Math.ceil(i/l.dx)),c=Math.max(0,Math.floor(n/l.dx)),f=Math.min(l.ny-1,Math.ceil(r/l.dx));for(let u=c;u<=f;u+=1)for(let d=a;d<=o;d+=1)Be(t,(d+.5)*l.dx,(u+.5)*l.dx)&&e(d+u*l.nx,d,u)}function Zs(l,t){const e=l.grid,s=e.n;l.ledger.water-=e.mg[K*s+t]+e.mfog[t],l.ledger.air-=e.mg[tt*s+t]+e.mg[et*s+t],l.ledger.energy-=e.Hg[t];for(let n=0;n<rt;n+=1)e.mg[n*s+t]=0;e.mfog[t]=0,e.Hg[t]=0}function zn(l,t,e,s){const n=l.grid,i=n.n;Zs(l,t),l.gas.fillCell(t,e,s,Math.max(.001,1-n.phi[t]-n.alpha[t])),l.ledger.water+=n.mg[K*i+t],l.ledger.air+=n.mg[tt*i+t]+n.mg[et*i+t],l.ledger.energy+=n.Hg[t]}function ln(l,t){const e=l.particles;for(let n=0;n<e.count;n+=1)Be(t,e.x[n],e.y[n])&&(l.ledger.water-=e.mass[n],l.ledger.energy-=e.mass[n]*e.h[n],l.liquid.removeParticle(n),n-=1);const s=l.bubbles;for(let n=0;n<s.count;n+=1)Be(t,s.x[n],s.y[n])&&(l.ledger.water-=s.m[n*rt+K],l.ledger.air-=s.m[n*rt+tt]+s.m[n*rt+et],l.ledger.energy-=s.H[n],s.remove(n),n-=1);l.liquid.weightsDirty=!0}function fn(l,t,e,s,n){const i=l.grid,r=Rt[e];for(const o of t)i.solid[o]!==0?(l.ledger.energy-=i.Es[o],l.ledger.water-=i.film[o]):Zs(l,o),i.solid[o]=e+1,i.role[o]=n>=0?1:0,i.heater[o]=n,i.film[o]=0,i.T[o]=s,i.Es[o]=r.rho*r.cp*i.vCell*(s-pt),i.kind[o]=ft,l.ledger.energy+=i.Es[o];const a=l.particles;for(let o=0;o<a.count;o+=1){const c=i.cellAt(a.x[o],a.y[o]);c<0||i.solid[c]===0||(l.ledger.water-=a.mass[o],l.ledger.energy-=a.mass[o]*a.h[o],l.liquid.removeParticle(o),o-=1)}l.solidsChanged()}function fo(l,t){const e=l.grid;let s=!1;for(const n of t)e.solid[n]!==0&&(s=!0,l.ledger.energy-=e.Es[n],l.ledger.water-=e.film[n],e.solid[n]=0,e.role[n]=0,e.heater[n]=-1,e.Es[n]=0,e.film[n]=0,e.kind[n]=0);if(s){l.solidsChanged();for(const n of t)e.solid[n]===0&&l.gas.massOf(n)<=0&&zn(l,n,l.ambientT,l.ambientY)}}const is=(l,t,e,s,n)=>{const i=[],r=Math.max(0,Math.round(t/l.dx)),a=Math.min(l.nx,Math.max(r+1,Math.round(s/l.dx))),o=Math.max(0,Math.round(e/l.dx)),c=Math.min(l.ny,Math.max(o+1,Math.round(n/l.dx)));for(let f=o;f<c;f+=1)for(let u=r;u<a;u+=1)i.push(u+f*l.nx);return i};function uo(l,t){const e=l.grid;switch(t.op){case"fill":{if(t.phase==="gas"){ln(l,t.region);const c=new Float64Array(rt);let f=0;for(const[u,d]of Object.entries(t.composition)){const g=u==="N2"?tt:u==="O2"?et:u==="H2O"?K:-1;g>=0&&(c[g]=d,f+=d)}if(f<=0)c.set(l.ambientY.subarray(0,rt));else for(let u=0;u<ut;u+=1)c[u]/=f;return Os(e,t.region,u=>{e.solid[u]===0&&zn(l,u,t.T,c)}),null}if(ln(l,t.region),(t.composition.H2O??0)<=0)return"fill: only water is a liquid in M1";const i=Es(t.T)*e.vCell/4,r=_t(t.T),a=l.particles;let o=!1;return mo(e,t.region,(c,f)=>{const u=c+f*e.nx;if(e.solid[u]!==0)return;let d=0;for(let g=0;g<2;g+=1)for(let h=0;h<2;h+=1){const v=(c+.25+.5*h)*e.dx,m=(f+.25+.5*g)*e.dx;if(Be(t.region,v,m)){if(a.add(v,m,i,r,0)<0){o=!0;continue}d+=1,l.ledger.water+=i,l.ledger.energy+=i*r}}d===4&&Zs(l,u)}),l.liquid.weightsDirty=!0,o?"fill: particle capacity reached":null}case"erase":{ln(l,t.region);const s=[];return Os(e,t.region,n=>s.push(n)),fo(l,s),null}case"move":return ho(l,t.region,Math.round(t.dx/e.dx),Math.round(t.dy/e.dx)),null;case"solid":{const s=Ms(t.material);if(s<0)return`solid: unknown material ${t.material}`;const n=[];if(Os(e,t.region,i=>n.push(i)),n.length===0&&"line"in t.region){const[i,r,a,o]=t.region.line,c=Math.ceil(Math.hypot(a-i,o-r)/(.5*e.dx))+1;for(let f=0;f<=c;f+=1){const u=e.cellAt(i+(a-i)*f/c,r+(o-r)*f/c);u>=0&&!n.includes(u)&&n.push(u)}}return fn(l,n,s,t.T,-1),null}case"beaker":{const s=Ms(t.material);if(s<0)return`beaker: unknown material ${t.material}`;const n=Math.max(e.dx,t.wall),i=t.x-t.w/2,r=t.x+t.w/2,a=t.y,o=t.y+t.h,c=[...is(e,i,a,i+n,o),...is(e,r-n,a,r,o),...is(e,i,a,r,a+n),...t.lid?is(e,i,o-n,r,o):[]];return fn(l,[...new Set(c)],s,t.T,-1),null}case"hotplate":{const s=Ms(t.material);if(s<0)return`hotplate: unknown material ${t.material}`;const n=l.heat.heaters.length;return l.heat.heaters.push({group:n,mode:t.mode,power:t.power,target:t.target,on:t.on,P:0,Tmean:t.T,integral:0,cells:0}),fn(l,is(e,t.x-t.w/2,t.y,t.x+t.w/2,t.y+t.h),s,t.T,n),null}}}function ho(l,t,e,s){const n=l.grid,{nx:i,ny:r,dx:a}=n;if(e===0&&s===0)return;const o=[];Os(n,t,h=>{n.solid[h]!==0&&o.push(h)});const c=l.particles,f=l.bubbles,u=e*a,d=s*a;for(let h=0;h<c.count;h+=1){if(!Be(t,c.x[h],c.y[h]))continue;const v=c.x[h]+u,m=c.y[h]+d;if(v<=0||m<=0||v>=n.w||m>=n.h){l.ledger.water-=c.mass[h],l.ledger.energy-=c.mass[h]*c.h[h],l.liquid.removeParticle(h),h-=1;continue}c.x[h]=v,c.y[h]=m}for(let h=0;h<f.count;h+=1)Be(t,f.x[h],f.y[h])&&(f.x[h]=Math.min(n.w-1e-6,Math.max(1e-6,f.x[h]+u)),f.y[h]=Math.min(n.h-1e-6,Math.max(1e-6,f.y[h]+d)),f.site[h]=-1);if(l.liquid.weightsDirty=!0,o.length===0)return;const g=o.map(h=>({c:h,s:n.solid[h],role:n.role[h],heater:n.heater[h],T:n.T[h],Es:n.Es[h],film:n.film[h]}));for(const h of g)l.ledger.energy-=h.Es,l.ledger.water-=h.film,n.solid[h.c]=0,n.role[h.c]=0,n.heater[h.c]=-1,n.Es[h.c]=0,n.film[h.c]=0,n.kind[h.c]=0;for(const h of g){const v=h.c%i+e,m=Math.floor(h.c/i)+s;if(v<0||m<0||v>=i||m>=r)continue;const x=v+m*i;n.solid[x]!==0?(l.ledger.energy-=n.Es[x],l.ledger.water-=n.film[x]):Zs(l,x),n.solid[x]=h.s,n.role[x]=h.role,n.heater[x]=h.heater,n.T[x]=h.T,n.Es[x]=h.Es,n.film[x]=h.film,n.kind[x]=ft,l.ledger.energy+=h.Es,l.ledger.water+=h.film}for(let h=0;h<c.count;h+=1){const v=n.cellAt(c.x[h],c.y[h]);v<0||n.solid[v]===0||(l.ledger.water-=c.mass[h],l.ledger.energy-=c.mass[h]*c.h[h],l.liquid.removeParticle(h),h-=1)}l.solidsChanged();for(const h of g)n.solid[h.c]===0&&l.gas.massOf(h.c)<=0&&zn(l,h.c,l.ambientT,l.ambientY)}function mo(l,t,e){const[s,n,i,r]=ur(t),a=Math.max(0,Math.floor(s/l.dx)),o=Math.min(l.nx-1,Math.floor(i/l.dx)),c=Math.max(0,Math.floor(n/l.dx)),f=Math.min(l.ny-1,Math.floor(r/l.dx));for(let u=c;u<=f;u+=1)for(let d=a;d<=o;d+=1)e(d,u)}const At=ut+2,Nt=ut,Wt=ut+1,po=.9,go=16;class cs{constructor(t,e){p(this,"g");p(this,"gas");p(this,"conc");p(this,"fu");p(this,"fv");p(this,"outM");p(this,"scale");this.g=t,this.gas=e;const s=t.n;this.conc=new Float64Array(At*s),this.fu=new Float64Array(At*t.nu),this.fv=new Float64Array(At*t.nv),this.outM=new Float64Array(s),this.scale=new Float64Array(s)}transport(t){const e=this.g,{nx:s,ny:n,n:i,kind:r,dx:a}=e,o=s+1,c=e.ug,f=e.vg;let u=0,d=0;for(let w=0;w<n;w+=1)for(let b=0;b<s;b+=1){const P=b+w*s;if(r[P]!==I)continue;const _=b+w*o,A=c[_],C=c[_+1],L=f[P],R=f[P+s],E=(A<0?-A:0)+(C>0?C:0)+(L<0?-L:0)+(R>0?R:0);E>u&&(u=E);const J=Math.max(A<0?-A:A,C<0?-C:C,L<0?-L:L,R<0?-R:R);J>d&&(d=J)}this.gas.last.uMax=d;const g=Math.min(go,Math.max(1,Math.ceil(u*t/a/po))),h=t/g,{conc:v}=this,m=this.gas.vgas,x=e.mg,F=e.mfog,y=e.Hg;for(let w=0;w<g;w+=1){for(let b=0;b<i;b+=1){if(r[b]!==I){for(let _=0;_<At;_+=1)v[_*i+b]=0;continue}const P=1/m[b];for(let _=0;_<ut;_+=1)v[_*i+b]=x[_*i+b]*P;v[Nt*i+b]=F[b]*P,v[Wt*i+b]=y[b]*P}this.fluxesU(h),this.fluxesV(h),this.limitOutflow(),this.applyFluxes()}for(let w=0;w<i;w+=1)r[w]===I&&this.gas.deriveCell(w);return this.gas.last.substeps=g,g}static face(t,e,s){const n=t-e,i=s-t;return n*i>0?t+n*i/(n+i):t}fluxesU(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=s+1,o=e.nu,c=e.ug,{conc:f,fu:u}=this,{amb:d,gasU:g}=this.gas,h=e.aFace,v=cs.face;for(let m=0;m<n;m+=1){const x=m*s,F=m*a;for(let y=0;y<=s;y+=1){const w=F+y,b=c[w];if(g[w]===0||b===0){for(let L=0;L<At;L+=1)u[L*o+w]=0;continue}const P=b*h*t;if(y===0||y===s){const L=y===0?x:x+s-1,R=y===0?b>0:b<0;for(let E=0;E<At;E+=1)u[E*o+w]=P*(R?d[E]:f[E*i+L]);continue}let _,A,C;if(b>0?(_=x+y-1,A=x+y,C=y>=2&&r[x+y-2]===I?x+y-2:-1):(_=x+y,A=x+y-1,C=y+1<s&&r[x+y+1]===I?x+y+1:-1),C<0){for(let L=0;L<At;L+=1)u[L*o+w]=P*f[L*i+_];continue}for(let L=0;L<At;L+=1){const R=L*i;u[L*o+w]=P*v(f[R+_],f[R+C],f[R+A])}}}}fluxesV(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e,a=e.nv,o=e.vg,{conc:c,fv:f}=this,{amb:u,gasV:d}=this.gas,g=e.aFace,h=cs.face;for(let v=0;v<=n;v+=1){const m=v*s;for(let x=0;x<s;x+=1){const F=m+x,y=o[F];if(d[F]===0||y===0){for(let A=0;A<At;A+=1)f[A*a+F]=0;continue}const w=y*g*t;if(v===0||v===n){const A=v===0?x:x+(n-1)*s,C=v===0?y>0:y<0;for(let L=0;L<At;L+=1)f[L*a+F]=w*(C?u[L]:c[L*i+A]);continue}let b,P,_;if(y>0?(b=F-s,P=F,_=v>=2&&r[F-2*s]===I?F-2*s:-1):(b=F,P=F-s,_=v+1<n&&r[F+s]===I?F+s:-1),_<0){for(let A=0;A<At;A+=1)f[A*a+F]=w*c[A*i+b];continue}for(let A=0;A<At;A+=1){const C=A*i;f[A*a+F]=w*h(c[C+b],c[C+_],c[C+P])}}}}applyFluxes(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,r=t.nu,a=t.nv,{fu:o,fv:c}=this,{gasU:f,gasV:u,escaped:d}=this.gas,g=t.mg,h=t.mfog,v=t.Hg;for(let m=0;m<s;m+=1){const x=m*e,F=m*i;for(let w=1;w<e;w+=1){const b=F+w;if(f[b]===0)continue;const P=x+w-1,_=P+1;for(let L=0;L<ut;L+=1){const R=o[L*r+b];g[L*n+P]-=R,g[L*n+_]+=R}const A=o[Nt*r+b];h[P]-=A,h[_]+=A;const C=o[Wt*r+b];v[P]-=C,v[_]+=C}if(f[F]!==0){const w=x;for(let _=0;_<ut;_+=1){const A=o[_*r+F];g[_*n+w]+=A,d[_]-=A}const b=o[Nt*r+F];h[w]+=b,d[Nt]-=b;const P=o[Wt*r+F];v[w]+=P,d[Wt]-=P}const y=F+e;if(f[y]!==0){const w=x+e-1;for(let _=0;_<ut;_+=1){const A=o[_*r+y];g[_*n+w]-=A,d[_]+=A}const b=o[Nt*r+y];h[w]-=b,d[Nt]+=b;const P=o[Wt*r+y];v[w]-=P,d[Wt]+=P}}for(let m=1;m<s;m+=1){const x=m*e;for(let F=0;F<e;F+=1){const y=x+F;if(u[y]===0)continue;const w=y-e,b=y;for(let A=0;A<ut;A+=1){const C=c[A*a+y];g[A*n+w]-=C,g[A*n+b]+=C}const P=c[Nt*a+y];h[w]-=P,h[b]+=P;const _=c[Wt*a+y];v[w]-=_,v[b]+=_}}for(let m=0;m<e;m+=1){if(u[m]!==0){const F=m;for(let b=0;b<ut;b+=1){const P=c[b*a+m];g[b*n+F]+=P,d[b]-=P}const y=c[Nt*a+m];h[F]+=y,d[Nt]-=y;const w=c[Wt*a+m];v[F]+=w,d[Wt]-=w}const x=m+s*e;if(u[x]!==0){const F=m+(s-1)*e;for(let b=0;b<ut;b+=1){const P=c[b*a+x];g[b*n+F]-=P,d[b]+=P}const y=c[Nt*a+x];h[F]-=y,d[Nt]+=y;const w=c[Wt*a+x];v[F]-=w,d[Wt]+=w}}}limitOutflow(){const t=this.g,{nx:e,ny:s,n}=t,i=e+1,{fu:r,fv:a,outM:o,scale:c}=this,f=t.nu,u=t.nv;o.fill(0);const d=cs.massFlux,{gasU:g,gasV:h}=this.gas;for(let m=0;m<s;m+=1)for(let x=0;x<=e;x+=1){const F=x+m*i;if(g[F]===0)continue;const y=d(r,f,F);y>0&&x>0?o[x-1+m*e]+=y:y<0&&x<e&&(o[x+m*e]-=y)}for(let m=0;m<=s;m+=1)for(let x=0;x<e;x+=1){const F=x+m*e;if(h[F]===0)continue;const y=d(a,u,F);y>0&&m>0?o[x+(m-1)*e]+=y:y<0&&m<s&&(o[x+m*e]-=y)}let v=!1;for(let m=0;m<n;m+=1){const x=.9*this.gas.massOf(m);c[m]=o[m]>x&&o[m]>0?x/o[m]:1,c[m]<1&&(v=!0)}if(v){for(let m=0;m<s;m+=1)for(let x=0;x<=e;x+=1){const F=x+m*i;if(g[F]===0)continue;const w=d(r,f,F)>0?x>0?x-1+m*e:-1:x<e?x+m*e:-1;if(!(w<0||c[w]>=1))for(let b=0;b<At;b+=1)r[b*f+F]*=c[w]}for(let m=0;m<=s;m+=1)for(let x=0;x<e;x+=1){const F=x+m*e;if(h[F]===0)continue;const w=d(a,u,F)>0?m>0?x+(m-1)*e:-1:m<s?x+m*e:-1;if(!(w<0||c[w]>=1))for(let b=0;b<At;b+=1)a[b*u+F]*=c[w]}}}static massFlux(t,e,s){let n=0;for(let i=0;i<=Nt;i+=1)n+=t[i*e+s];return n}}const jt=.05;class vo{constructor(t,e,s){p(this,"g");p(this,"R");p(this,"solver");p(this,"vgas");p(this,"rho");p(this,"nmol");p(this,"cap");p(this,"mu");p(this,"veos");p(this,"srcV");p(this,"veosMid");p(this,"mover");p(this,"gasU");p(this,"gasV");p(this,"u0");p(this,"v0");p(this,"u1");p(this,"v1");p(this,"lim");p(this,"amb",new Float64Array(At));p(this,"ambT",293.15);p(this,"escaped",new Float64Array(At));p(this,"dp0",new Float64Array(8));p(this,"last",{solve:{iterations:0,residual:0,capped:!1},substeps:0,cells:0,uMax:0});p(this,"lo",0);p(this,"hi",0);this.g=t,this.R=e,this.solver=s;const n=t.n;this.vgas=new Float64Array(n),this.rho=new Float64Array(n),this.nmol=new Float64Array(n),this.cap=new Float64Array(n),this.mu=new Float64Array(n),this.veos=new Float64Array(n),this.srcV=new Float64Array(n),this.veosMid=new Float64Array(n),this.gasU=new Uint8Array(t.nu),this.gasV=new Uint8Array(t.nv),this.u0=new Float32Array(t.nu),this.v0=new Float32Array(t.nv),this.u1=new Float32Array(t.nu),this.v1=new Float32Array(t.nv),this.lim=new Float32Array(2*(t.nu+t.nv)),this.mover=new cs(t,this)}setAmbient(t,e,s){let n=0;for(let a=0;a<ut;a+=1)n+=s[a]/lt[a];const i=e/(Bt*t*n);let r=0;for(let a=0;a<ut;a+=1)this.amb[a]=i*s[a],r+=i*s[a]*Ut(a,t);this.amb[Nt]=0,this.amb[Wt]=r,this.ambT=t}enthalpy(t,e){const s=this.g,n=s.n;let i=s.mfog[t]*_t(e);for(let r=0;r<ut;r+=1)i+=s.mg[r*n+t]*Ut(r,e);return i}heatCapacity(t,e){const s=this.g,n=s.n;return Ln(s.mg[t],s.mg[n+t],s.mg[K*n+t],s.mfog[t],e)}deriveCell(t){const e=this.g,s=e.n,n=Math.max(.001,1-e.phi[t]-e.alpha[t])*e.vCell;this.vgas[t]=n;const i=e.mg[t],r=e.mg[s+t],a=e.mg[K*s+t],o=e.mfog[t],c=i+r+a;if(this.nmol[t]=i/lt[0]+r/lt[1]+a/lt[K],c+o<=1e-30){this.rho[t]=0,this.cap[t]=0,this.mu[t]=18e-6;return}let f;if(o<=0)f=Yi(i,r,a,e.Hg[t]);else{f=e.T[t]>100?e.T[t]:this.ambT;for(let u=0;u<4;u+=1){const d=(e.Hg[t]-this.enthalpy(t,f))/this.heatCapacity(t,f);if(f+=d,Math.abs(d)<1e-10)break}}f>150&&f<3e3||(f=Math.min(3e3,Math.max(150,Number.isFinite(f)?f:this.ambT))),e.T[t]=f,this.cap[t]=Ln(i,r,a,o,f),this.rho[t]=c/n,this.mu[t]=$r(i,r,a,f)}deriveAll(){const t=this.g;for(let e=0;e<t.n;e+=1){if(t.kind[e]===ft){this.vgas[e]=0,this.rho[e]=0,this.veos[e]=0;continue}if(t.kind[e]===ct&&this.massOf(e)<=0){this.vgas[e]=0,this.veos[e]=0;continue}this.deriveCell(e),this.veos[e]=this.nmol[e]*Bt*t.T[e]/this.R.pAt(e)}}updateVolumes(){const t=this.g,e=t.n;for(let s=0;s<e;s+=1){if(t.kind[s]===ft){this.vgas[s]=0,this.rho[s]=0,this.veos[s]=0;continue}const n=t.mg[s]+t.mg[e+s]+t.mg[K*e+s];if(t.kind[s]===ct&&n+t.mfog[s]<=0){this.vgas[s]=0,this.veos[s]=0;continue}const i=Math.max(.001,1-t.phi[s]-t.alpha[s])*t.vCell;this.vgas[s]=i,this.rho[s]=n/i,this.veos[s]=this.nmol[s]*Bt*t.T[s]/this.R.pAt(s)}}updateEos(){const t=this.g;for(let e=0;e<t.n;e+=1)this.veos[e]=t.kind[e]===ft||this.vgas[e]<=0?0:this.nmol[e]*Bt*t.T[e]/this.R.pAt(e)}massOf(t){const e=this.g;let s=e.mfog[t];for(let n=0;n<ut;n+=1)s+=e.mg[n*e.n+t];return s}fillCell(t,e,s,n=1){const i=this.g,r=i.n,a=Math.max(.001,n)*i.vCell;let o=0;for(let u=0;u<ut;u+=1)o+=s[u]/lt[u];const c=this.R.pAt(t)*a/(Bt*e*o);let f=0;for(let u=0;u<ut;u+=1)i.mg[u*r+t]=c*s[u],f+=c*s[u]*Ut(u,e);i.mfog[t]=0,i.Hg[t]=f,i.T[t]=e}transitions(t){const e=this.g,{nx:s,ny:n,n:i,kind:r}=e;let a=0;for(let o=0;o<i;o+=1){const c=t[o],f=r[o];if(c===f||f===ft||c===ft)continue;a+=1;const u=o%s,d=(o-u)/s;let g=0;for(let h=0;h<4;h+=1){const v=h===0?u>0?o-1:-1:h===1?u<s-1?o+1:-1:h===2?d>0?o-s:-1:d<n-1?o+s:-1;v>=0&&r[v]===I&&t[v]===I&&(g+=this.vgas[v]>0?this.vgas[v]:e.vCell)}if(!(g<=0)){if(f===ct)for(let h=0;h<4;h+=1){const v=h===0?u>0?o-1:-1:h===1?u<s-1?o+1:-1:h===2?d>0?o-s:-1:d<n-1?o+s:-1;if(v<0||r[v]!==I||t[v]!==I)continue;const m=(this.vgas[v]>0?this.vgas[v]:e.vCell)/g;this.move(o,v,m)}else{let h=this.massOf(o),v=0;for(let m=0;m<4;m+=1){const x=m===0?u>0?o-1:-1:m===1?u<s-1?o+1:-1:m===2?d>0?o-s:-1:d<n-1?o+s:-1;if(x<0||r[x]!==I||t[x]!==I)continue;const F=(this.vgas[x]>0?this.vgas[x]:e.vCell)/g;v+=F*this.rho[x]}if(v*=Math.max(.001,1-e.phi[o]-e.alpha[o])*e.vCell,v<=h)continue;for(let m=0;m<4;m+=1){const x=m===0?u>0?o-1:-1:m===1?u<s-1?o+1:-1:m===2?d>0?o-s:-1:d<n-1?o+s:-1;if(x<0||r[x]!==I||t[x]!==I)continue;const F=(this.vgas[x]>0?this.vgas[x]:e.vCell)/g,y=this.massOf(x);if(y<=0)continue;const w=Math.min(.25,(v-h)*F/y);this.move(x,o,w)}h=this.massOf(o),h>0&&(e.T[o]=this.ambT)}this.deriveCell(o)}}return a}move(t,e,s){const n=this.g,i=n.n;for(let o=0;o<ut;o+=1){const c=n.mg[o*i+t]*s;n.mg[o*i+t]-=c,n.mg[o*i+e]+=c}const r=n.mfog[t]*s;n.mfog[t]-=r,n.mfog[e]+=r;const a=n.Hg[t]*s;n.Hg[t]-=a,n.Hg[e]+=a,n.T[e]<100&&(n.T[e]=n.T[t]),this.deriveCell(t),this.deriveCell(e)}markFaces(){const t=this.g,{nx:e,ny:s,kind:n}=t,i=e+1,r=t.ug,a=t.vg;for(let o=0;o<s;o+=1)for(let c=0;c<=e;c+=1){const f=c+o*i,u=c>0?n[c-1+o*e]:-1,d=c<e?n[c+o*e]:-1;let g=0;(u===I&&d===I||c===0&&t.openL&&d===I||c===e&&t.openR&&u===I)&&(g=1),this.gasU[f]=g,g===0&&(r[f]=u===ct||d===ct?u===ft||d===ft||c===0&&!t.openL||c===e&&!t.openR?0:t.ul[f]:0)}for(let o=0;o<=s;o+=1)for(let c=0;c<e;c+=1){const f=c+o*e,u=o>0?n[c+(o-1)*e]:-1,d=o<s?n[c+o*e]:-1;let g=0;(u===I&&d===I||o===0&&t.openB&&d===I||o===s&&t.openT&&u===I)&&(g=1),this.gasV[f]=g,g===0&&(a[f]=u===ct||d===ct?u===ft||d===ft||o===0&&!t.openB||o===s&&!t.openT?0:t.vl[f]:0)}}transport(t){return this.mover.transport(t)}sampleU(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,o=i+1,c=Math.min(i-1e-6,Math.max(0,e/a)),f=Math.min(r-1.000001,Math.max(0,s/a-.5)),u=Math.floor(c),d=Math.floor(f),g=c-u,h=f-d,v=t[u+d*o],m=t[u+1+d*o],x=t[u+(d+1)*o],F=t[u+1+(d+1)*o];return this.lo=Math.min(v,m,x,F),this.hi=Math.max(v,m,x,F),(1-h)*((1-g)*v+g*m)+h*((1-g)*x+g*F)}sampleV(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,o=Math.min(i-1.000001,Math.max(0,e/a-.5)),c=Math.min(r-1e-6,Math.max(0,s/a)),f=Math.floor(o),u=Math.floor(c),d=o-f,g=c-u,h=t[f+u*i],v=t[f+1+u*i],m=t[f+(u+1)*i],x=t[f+1+(u+1)*i];return this.lo=Math.min(h,v,m,x),this.hi=Math.max(h,v,m,x),(1-g)*((1-d)*h+d*v)+g*((1-d)*m+d*x)}velocity(t,e){const s=this.g,{nx:n,ny:i,dx:r,kind:a}=s,o=n+1,c=s.ug,f=s.vg,{u0:u,v0:d,u1:g,v1:h}=this,v=this.lim;u.set(c),d.set(f);for(let y=0;y<i;y+=1)for(let w=0;w<=n;w+=1){const b=w+y*o;if(this.gasU[b]===0){g[b]=u[b];continue}const P=w*r,_=(y+.5)*r,A=this.sampleV(d,P,_);g[b]=this.sampleU(u,P-t*u[b],_-t*A),v[2*b]=this.lo,v[2*b+1]=this.hi}const m=2*s.nu;for(let y=0;y<=i;y+=1)for(let w=0;w<n;w+=1){const b=w+y*n;if(this.gasV[b]===0){h[b]=d[b];continue}const P=(w+.5)*r,_=y*r,A=this.sampleU(u,P,_);h[b]=this.sampleV(d,P-t*A,_-t*d[b]),v[m+2*b]=this.lo,v[m+2*b+1]=this.hi}for(let y=0;y<i;y+=1)for(let w=0;w<=n;w+=1){const b=w+y*o;if(this.gasU[b]===0)continue;const P=w*r,_=(y+.5)*r,A=this.sampleV(d,P,_),C=this.sampleU(g,P+t*u[b],_+t*A);let L=g[b]+.5*(u[b]-C);(L<v[2*b]||L>v[2*b+1])&&(L=g[b]),c[b]=L}for(let y=0;y<=i;y+=1)for(let w=0;w<n;w+=1){const b=w+y*n;if(this.gasV[b]===0)continue;const P=(w+.5)*r,_=y*r,A=this.sampleU(u,P,_),C=this.sampleV(h,P+t*A,_+t*d[b]);let L=h[b]+.5*(d[b]-C);(L<v[m+2*b]||L>v[m+2*b+1])&&(L=h[b]),f[b]=L}const x=this.R;for(let y=0;y<=i;y+=1)for(let w=0;w<n;w+=1){const b=w+y*n;if(this.gasV[b]===0)continue;const P=y>0?w+(y-1)*n:-1,_=y<i?w+y*n:-1,A=P>=0&&a[P]===I?this.rho[P]:-1,C=_>=0&&a[_]===I?this.rho[_]:-1,L=Math.max(jt,A>0&&C>0?.5*(A+C):Math.max(A,C));if(!(A>0||C>0))continue;const R=A>0?P:_,E=x.id[R],J=E>=0?x.rhoBar[E]:x.rhoAmb;f[b]-=t*e*(L-J)/L}g.set(c),h.set(f);const F=t/(r*r);for(let y=0;y<i;y+=1)for(let w=0;w<=n;w+=1){const b=w+y*o;if(this.gasU[b]===0)continue;const P=w<n&&a[w+y*n]===I?w+y*n:w-1+y*n,_=this.mu[P]/Math.max(jt,this.rho[P]),A=g[b],C=w<n?g[b+1]:A,L=w>0?g[b-1]:A,R=y>0?g[b-o]:s.openB?A:-A,E=y<i-1?g[b+o]:s.openT?A:-A;c[b]=A+Math.min(.2,F*_)*(C+L+R+E-4*A)}for(let y=0;y<=i;y+=1)for(let w=0;w<n;w+=1){const b=w+y*n;if(this.gasV[b]===0)continue;const P=y<i&&a[w+y*n]===I?w+y*n:w+(y-1)*n,_=this.mu[P]/Math.max(jt,this.rho[P]),A=h[b],C=y<i?h[b+n]:A,L=y>0?h[b-n]:A,R=w>0?h[b-1]:s.openL?A:-A,E=w<n-1?h[b+1]:s.openR?A:-A;f[b]=A+Math.min(.2,F*_)*(E+R+L+C-4*A)}}sources(t){const e=this.g,s=1/(e.vCell*t);for(let n=0;n<e.n;n+=1){if(e.kind[n]!==I){e.Sg[n]=0;continue}const i=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.veos[n]-this.vgas[n])),r=Math.max(-.5*e.vCell,Math.min(.5*e.vCell,this.srcV[n]));e.Sg[n]=(i+r)*s}}project(t,e,s){const n=this.g,{nx:i,ny:r,dx:a,kind:o}=n,c=i+1,f=n.ug,u=n.vg;let d=i,g=-1,h=r,v=-1,m=0;for(let _=0;_<r;_+=1)for(let A=0;A<i;A+=1)o[A+_*i]===I&&(m+=1,A<d&&(d=A),A>g&&(g=A),_<h&&(h=_),_>v&&(v=_));const x=this.last.solve;if(x.iterations=0,x.residual=0,x.capped=!1,this.last.cells=m,m===0)return this.last;const F=this.solver,y=F.begin(g-d+1,v-h+1),w=this.rho;for(let _=h;_<=v;_+=1)for(let A=d;A<=g;A+=1){const C=A+_*i;if(o[C]!==I)continue;const L=F.at(A-d,_-h);y.act[L]=1,y.x[L]=n.pg[C];const R=A+_*c,E=A+_*i,J=f[R+1]-f[R]+u[E+i]-u[E];y.b[L]=n.Sg[C]*a*a-a*J;const G=Math.max(jt,w[C]);A+1<i?o[C+1]===I&&A+1<=g&&(y.ax[L]=2*t/(G+Math.max(jt,w[C+1]))):n.openR&&(y.dDx[L]+=2*t/G),A===0&&n.openL&&(y.dDx[L]+=2*t/G),_+1<r?o[C+i]===I&&_+1<=v&&(y.ay[L]=2*t/(G+Math.max(jt,w[C+i]))):n.openT&&(y.dDy[L]+=2*t/G),_===0&&n.openB&&(y.dDy[L]+=2*t/G)}const b=F.solve(e,s,!0);x.iterations=b.iterations,x.residual=b.residual,x.capped=b.capped;const P=n.pg;for(let _=0;_<n.n;_+=1)o[_]!==I&&(P[_]=0);for(let _=h;_<=v;_+=1)for(let A=d;A<=g;A+=1){const C=A+_*i;o[C]===I&&(P[C]=y.x[F.at(A-d,_-h)])}for(let _=0;_<r;_+=1)for(let A=0;A<=i;A+=1){const C=A+_*c;if(this.gasU[C]===0)continue;if(A===0){f[C]-=2*t/Math.max(jt,w[_*i])/a*P[_*i];continue}if(A===i){f[C]+=2*t/Math.max(jt,w[i-1+_*i])/a*P[i-1+_*i];continue}const L=A-1+_*i,R=A+_*i;f[C]-=2*t/(Math.max(jt,w[L])+Math.max(jt,w[R]))/a*(P[R]-P[L])}for(let _=0;_<=r;_+=1)for(let A=0;A<i;A+=1){const C=A+_*i;if(this.gasV[C]===0)continue;if(_===0){u[C]-=2*t/Math.max(jt,w[A])/a*P[A];continue}if(_===r){u[C]+=2*t/Math.max(jt,w[A+(r-1)*i])/a*P[A+(r-1)*i];continue}const L=A+(_-1)*i,R=A+_*i;u[C]-=2*t/(Math.max(jt,w[L])+Math.max(jt,w[R]))/a*(P[R]-P[L])}return this.last}compressionHeating(t){const e=this.g,s=this.R,n=e.n;let i=0;this.dp0.length<s.count&&(this.dp0=new Float64Array(2*s.count)),this.dp0.fill(0);for(let r=0;r<s.count;r+=1){if(s.open[r]!==0)continue;const a=s.vGas[r];if(a<=0)continue;let o=0;for(let u=0;u<n;u+=1){if(s.id[u]!==r||e.kind[u]===ft||this.cap[u]<=0)continue;const d=this.nmol[u];o+=d*(d*Bt*e.T[u]/s.pAt(u))/this.cap[u]}o*=Bt/a;const c=1/Math.max(.05,1-o);let f=0;for(let u=0;u<4;u+=1){const d=s.statePressure(r);s.p0[r]=d;const g=(d-(t[r]+f))*c;if(Math.abs(g)<=1e-10*d)break;let h=0;for(let v=0;v<n;v+=1){if(s.id[v]!==r||e.kind[v]===ft||this.cap[v]<=0)continue;const m=this.nmol[v]*Bt*e.T[v]/s.pAt(v);h+=m,e.Hg[v]+=m*g,this.deriveCell(v)}f+=g,i+=h*g}s.p0[r]=s.statePressure(r),this.dp0[r]=f}return i}vapourPressure(t){const e=this.g,s=e.n;let n=0;for(let i=0;i<ut;i+=1)n+=e.mg[i*s+t]/lt[i];return n<=0?0:e.mg[K*s+t]/lt[K]/n*this.R.pAt(t)}}const ui=[1/6,2/3,1/6];class xo{constructor(t,e,s,n){p(this,"nx");p(this,"ny");p(this,"n");p(this,"dx");p(this,"depth");p(this,"vCell");p(this,"aFace");p(this,"nu");p(this,"nv");p(this,"openL",!1);p(this,"openR",!1);p(this,"openB",!1);p(this,"openT",!0);p(this,"solid");p(this,"role");p(this,"heater");p(this,"phiS");p(this,"sdf");p(this,"phi");p(this,"alpha");p(this,"kind");p(this,"region");p(this,"pl");p(this,"pg");p(this,"mg");p(this,"mfog");p(this,"Hg");p(this,"Es");p(this,"film");p(this,"T");p(this,"Tl");p(this,"Cl");p(this,"Sl");p(this,"Sg");p(this,"ul");p(this,"vl");p(this,"ug");p(this,"vg");this.nx=t,this.ny=e,this.n=t*e,this.dx=s,this.depth=n,this.vCell=s*s*n,this.aFace=s*n,this.nu=(t+1)*e,this.nv=t*(e+1);const i=this.n;this.solid=new Uint8Array(i),this.role=new Uint8Array(i),this.heater=new Int16Array(i).fill(-1),this.phiS=new Float32Array(i),this.sdf=new Float32Array(i),this.phi=new Float32Array(i),this.alpha=new Float32Array(i),this.kind=new Uint8Array(i),this.region=new Int32Array(i).fill(-1),this.pl=new Float32Array(i),this.pg=new Float32Array(i),this.mg=new Float64Array(rt*i),this.mfog=new Float64Array(i),this.Hg=new Float64Array(i),this.Es=new Float64Array(i),this.film=new Float64Array(i),this.T=new Float32Array(i),this.Tl=new Float32Array(i),this.Cl=new Float64Array(i),this.Sl=new Float32Array(i),this.Sg=new Float32Array(i),this.ul=new Float32Array(this.nu),this.vl=new Float32Array(this.nv),this.ug=new Float32Array(this.nu),this.vg=new Float32Array(this.nv)}get w(){return this.nx*this.dx}get h(){return this.ny*this.dx}cellAt(t,e){const s=Math.floor(t/this.dx),n=Math.floor(e/this.dx);return s<0||n<0||s>=this.nx||n>=this.ny?-1:s+n*this.nx}solidAt(t,e){return t<0?!this.openL:t>=this.nx?!this.openR:e<0?!this.openB:e>=this.ny?!this.openT:this.solid[t+e*this.nx]!==0}updateStatic(){const{nx:t,ny:e,dx:s}=this;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const o=a+r*t;if(this.solid[o]!==0){this.phiS[o]=1;continue}let c=0;for(let f=-1;f<=1;f+=1)for(let u=-1;u<=1;u+=1)(u!==0||f!==0)&&this.solidAt(a+u,r+f)&&(c+=ui[u+1]*ui[f+1]);this.phiS[o]=c}const n=4,i=n*s;for(let r=0;r<e;r+=1)for(let a=0;a<t;a+=1){const o=a+r*t,c=this.solid[o]!==0,f=(a+.5)*s,u=(r+.5)*s;let d=i;c||(this.openL||(d=Math.min(d,f)),this.openR||(d=Math.min(d,this.w-f)),this.openB||(d=Math.min(d,u)),this.openT||(d=Math.min(d,this.h-u)));for(let g=-n;g<=n;g+=1){const h=r+g;if(!(h<0||h>=e))for(let v=-n;v<=n;v+=1){const m=a+v;if(m<0||m>=t||this.solid[m+h*t]!==0===c)continue;const F=Math.max(0,Math.abs(m+.5-(a+.5))-.5)*s,y=Math.max(0,Math.abs(h+.5-(r+.5))-.5)*s,w=Math.hypot(F,y);w<d&&(d=w)}}this.sdf[o]=c?-d:d}}sdfAt(t,e){const{nx:s,ny:n,dx:i}=this,r=Math.min(s-1.0001,Math.max(0,t/i-.5)),a=Math.min(n-1.0001,Math.max(0,e/i-.5)),o=Math.floor(r),c=Math.floor(a),f=r-o,u=a-c,d=Math.min(s-1,o+1),g=Math.min(n-1,c+1),h=this.sdf;let v=(1-u)*((1-f)*h[o+c*s]+f*h[d+c*s])+u*((1-f)*h[o+g*s]+f*h[d+g*s]);return this.openL||(v=Math.min(v,t)),this.openR||(v=Math.min(v,this.w-t)),this.openB||(v=Math.min(v,e)),this.openT||(v=Math.min(v,this.h-e)),v}}const bo=5,di=30;class yo{constructor(t,e,s,n,i){p(this,"g");p(this,"P");p(this,"L");p(this,"G");p(this,"solver");p(this,"src");p(this,"C");p(this,"Cs");p(this,"Cg");p(this,"CTl");p(this,"Tstar");p(this,"k");p(this,"dE");p(this,"Tnew");p(this,"gx");p(this,"gy");p(this,"q");p(this,"heaters",[]);p(this,"ambientT",293.15);p(this,"fluxSL",0);p(this,"fluxLG",0);p(this,"fluxSG",0);p(this,"lossSolids",0);p(this,"liquidPower",0);p(this,"hExt",Ji);p(this,"last",{solve:{iterations:0,residual:0,capped:!1},heater:0,lossWalls:0,lossOpen:0});this.g=t,this.P=e,this.L=s,this.G=n,this.solver=i;const r=t.n;this.src=new Float64Array(r),this.C=new Float64Array(r),this.Cs=new Float64Array(r),this.Cg=new Float64Array(r),this.CTl=new Float64Array(r),this.Tstar=new Float64Array(r),this.k=new Float64Array(r),this.dE=new Float64Array(r),this.Tnew=new Float64Array(r),this.gx=new Float64Array(r),this.gy=new Float64Array(r),this.q=new Float64Array(r)}solidCap(t){const e=Rt[this.g.solid[t]-1];return e.rho*e.cp*this.g.vCell}solidEnergy(t,e){return this.solidCap(t)*(e-pt)+this.g.film[t]*_t(e)}deriveSolid(t){const e=this.g,s=this.solidCap(t),n=e.film[t];if(n<=0){e.T[t]=pt+e.Es[t]/s;return}let i=e.T[t]>100?e.T[t]:pt+e.Es[t]/s;for(let r=0;r<3;r+=1)i-=(this.solidEnergy(t,i)-e.Es[t])/(s+n*ge(i));e.T[t]=i}countHeaters(){const t=this.g;for(const e of this.heaters)e.Tmean=0,e.cells=0;for(let e=0;e<t.n;e+=1){const s=t.heater[e];if(s<0||t.role[e]!==1)continue;const n=this.heaters[s];n!==void 0&&(n.Tmean+=t.T[e],n.cells+=1)}for(const e of this.heaters)e.cells>0&&(e.Tmean/=e.cells)}heaterPower(t){this.countHeaters();for(const e of this.heaters){if(e.cells===0){e.P=0;continue}if(!e.on){e.P=0,e.integral=0;continue}if(e.mode==="power"){e.P=e.power;continue}const s=e.power/bo,n=e.target-e.Tmean,i=e.integral+n*t,r=s*(n+i/di);r>0&&r<e.power&&(e.integral=i),e.P=Math.min(e.power,Math.max(0,s*(n+e.integral/di)))}}step(t,e,s){const{g:n,P:i,L:r,G:a}=this,{nx:o,ny:c,n:f,depth:u,dx:d}=n,{C:g,Cs:h,Cg:v,CTl:m,Tstar:x,k:F,q:y,src:w}=this;this.heaterPower(t),m.fill(0);const b=n.Cl;b.fill(0);let P=0;for(let T=0;T<i.count;T+=1){const O=i.mass[T]*ge(i.T[T]);P+=O;const k=i.T[T],N=9*T,z=r.bi[T],st=r.bj[T];for(let it=0;it<9;it+=1){const V=r.wt[N+it];if(V===0)continue;const Q=z+it%3,$=st+(it/3|0);if(Q<0||$<0||Q>=o||$>=c)continue;const ot=Q+$*o;b[ot]+=V*O,m[ot]+=V*O*k}}let _=0;for(let T=0;T<f;T+=1){let O=0,k=0;n.solid[T]!==0&&(O=this.solidCap(T)+n.film[T]*ge(n.T[T]),k=Rt[n.solid[T]-1].k);const N=a.cap[T]>0&&n.solid[T]===0?a.cap[T]:0,z=b[T],st=O+N+z;if(h[T]=O,v[T]=N,g[T]=st,st<=0){x[T]=n.T[T],F[T]=0,y[T]=0;continue}const it=(O*n.T[T]+N*n.T[T]+m[T])/st;x[T]=it,z>0&&(n.Tl[T]=m[T]/z),n.solid[T]===0&&(z>=N?k=Ss(it):k=Hr(n.mg[T],n.mg[f+T],n.mg[K*f+T],it)),F[T]=k;let V=w[T];if(this.liquidPower!==0&&z>0){const $=this.liquidPower*z/P;V+=$,_+=$}const Q=n.heater[T];if(Q>=0&&n.role[T]===1){const $=this.heaters[Q];$!==void 0&&$.cells>0&&(V+=$.P/$.cells,_+=$.P/$.cells)}y[T]=V}const{gx:A,gy:C}=this;for(let T=0;T<c;T+=1)for(let O=0;O<o;O+=1){const k=O+T*o;if(A[k]=0,C[k]=0,g[k]<=0)continue;const N=F[k];if(O+1<o&&g[k+1]>0){const z=F[k+1];N+z>0&&(A[k]=2*N*z/(N+z)*u)}if(T+1<c&&g[k+o]>0){const z=F[k+o];N+z>0&&(C[k]=2*N*z/(N+z)*u)}}const L=this.solver,R=L.begin(o,c),E=R.stride,J=d*u,G=this.hExt*J,q=this.ambientT;for(let T=0;T<c;T+=1)for(let O=0;O<o;O+=1){const k=O+T*o;if(g[k]<=0)continue;const N=O+1+(T+1)*E;R.act[N]=1,R.dH[N]=g[k]/t;let z=y[k];const st=F[k],it=x[k];O+1<o&&(R.ax[N]=A[k],z+=A[k]*(x[k+1]-it)),O>0&&(z+=A[k-1]*(x[k-1]-it)),T+1<c&&(R.ay[N]=C[k],z+=C[k]*(x[k+o]-it)),T>0&&(z+=C[k-o]*(x[k-o]-it));let V=0;O===0&&(V+=this.sideConductance(n.openL,st,G,u)),O===o-1&&(V+=this.sideConductance(n.openR,st,G,u)),T===0&&(V+=this.sideConductance(n.openB,st,G,u)),T===c-1&&(V+=this.sideConductance(n.openT,st,G,u)),V>0&&(R.dDx[N]=V,z+=V*(q-x[k])),R.b[N]=z}const B=L.solve(e,s,!1),D=this.last.solve;D.iterations=B.iterations,D.residual=B.residual,D.capped=B.capped;const M=this.Tnew,j=R.x;for(let T=0;T<c;T+=1)for(let O=0;O<o;O+=1){const k=O+T*o;M[k]=g[k]>0?x[k]+j[O+1+(T+1)*E]:n.T[k]}const nt=this.dE;let W=0,S=0;for(let T=0;T<f;T+=1)nt[T]=g[T]>0?y[T]*t:0;for(let T=0;T<c;T+=1)for(let O=0;O<o;O+=1){const k=O+T*o;if(g[k]<=0)continue;const N=F[k];if(A[k]>0){const z=A[k]*(M[k+1]-M[k])*t;nt[k]+=z,nt[k+1]-=z,n.kind[k]!==n.kind[k+1]&&this.pair(n.kind[k],n.kind[k+1],z)}if(C[k]>0){const z=C[k]*(M[k+o]-M[k])*t;nt[k]+=z,nt[k+o]-=z,n.kind[k]!==n.kind[k+o]&&this.pair(n.kind[k],n.kind[k+o],z)}for(let z=0;z<4;z+=1){if(!(z===0?O===0:z===1?O===o-1:z===2?T===0:T===c-1))continue;const it=z===0?n.openL:z===1?n.openR:z===2?n.openB:n.openT,V=this.sideConductance(it,N,G,u)*(M[k]-q)*t;nt[k]-=V,it?S+=V:W+=V,n.solid[k]!==0&&(this.lossSolids+=V)}}for(let T=0;T<f;T+=1){if(g[T]<=0)continue;const O=nt[T]/g[T];h[T]>0&&(n.Es[T]+=O*h[T],this.deriveSolid(T)),v[T]>0&&(n.Hg[T]+=O*v[T]),M[T]=O}for(let T=0;T<i.count;T+=1){const O=9*T,k=r.bi[T],N=r.bj[T];let z=0;for(let V=0;V<9;V+=1){const Q=r.wt[O+V];if(Q===0)continue;const $=k+V%3,ot=N+(V/3|0);if($<0||ot<0||$>=o||ot>=c)continue;const ht=$+ot*o;g[ht]>0&&(z+=Q*M[ht])}if(z===0)continue;const st=i.mass[T],it=st/i.rho[T];i.h[T]+=ge(i.T[T])*z,i.derive(T),r.dVp[T]+=st/i.rho[T]-it}for(let T=0;T<f;T+=1)v[T]>0&&a.deriveCell(T);w.fill(0);const H=this.last;return H.heater=_*t,H.lossWalls=W,H.lossOpen=S,H}pair(t,e,s){t===ft&&e===ct?this.fluxSL-=s:t===ct&&e===ft?this.fluxSL+=s:t===ct&&e===I?this.fluxLG-=s:t===I&&e===ct?this.fluxLG+=s:t===ft&&e===I?this.fluxSG-=s:t===I&&e===ft&&(this.fluxSG+=s)}sideConductance(t,e,s,n){const i=2*e*n;return t?i:s<=0||i<=0?0:1/(1/s+1/i)}}const Fo=.1,wo=1e-9;function te(l,t,e){const s=Math.floor(l-.5),n=l-s,i=1.5-n,r=n-.5;return t[e]=.5*i*i,t[e+1]=.75-(n-1)*(n-1),t[e+2]=.5*r*r,s}class _o{constructor(t,e,s){p(this,"g");p(this,"P");p(this,"solver");p(this,"mu");p(this,"pu");p(this,"mv");p(this,"pv");p(this,"rv");p(this,"knownU");p(this,"knownV");p(this,"tmpU");p(this,"tmpV");p(this,"markU");p(this,"markV");p(this,"bi");p(this,"bj");p(this,"wr");p(this,"wt");p(this,"dVp");p(this,"volSrc");p(this,"fU");p(this,"fV");p(this,"pGas");p(this,"w",new Float64Array(12));p(this,"rhoRef",998);p(this,"weightsDirty",!0);p(this,"last",{solve:{iterations:0,residual:0,capped:!1},cells:0,uMax:0,escapedMass:0,escapedEnergy:0});p(this,"escM",0);p(this,"escE",0);p(this,"mf",0);p(this,"ms",1);p(this,"vel",new Float64Array(2));this.g=t,this.P=e,this.solver=s,this.mu=new Float64Array(t.nu),this.pu=new Float64Array(t.nu),this.mv=new Float64Array(t.nv),this.pv=new Float64Array(t.nv),this.rv=new Float64Array(t.nv),this.knownU=new Uint8Array(t.nu),this.knownV=new Uint8Array(t.nv),this.tmpU=new Float32Array(t.nu),this.tmpV=new Float32Array(t.nv),this.markU=new Uint8Array(t.nu),this.markV=new Uint8Array(t.nv);const n=e.cap;this.bi=new Int16Array(n),this.bj=new Int16Array(n),this.wr=new Float32Array(9*n),this.wt=new Float32Array(9*n),this.dVp=new Float64Array(n),this.volSrc=new Float64Array(t.n),this.fU=new Float64Array(t.nu),this.fV=new Float64Array(t.nv),this.pGas=new Float32Array(t.n)}computeWeights(){const{P:t,g:e,w:s,bi:n,bj:i,wr:r}=this,a=1/e.dx;for(let o=0;o<t.count;o+=1){n[o]=te(t.x[o]*a-.5,s,0),i[o]=te(t.y[o]*a-.5,s,3);const c=9*o;for(let f=0;f<3;f+=1)for(let u=0;u<3;u+=1)r[c+u+3*f]=s[u]*s[3+f]}this.weightsDirty=!1}cellOf(t,e){const s=this.g,n=this.bi[t]+e%3,i=this.bj[t]+(e/3|0);return n<0||i<0||n>=s.nx||i>=s.ny?-1:n+i*s.nx}removeParticle(t){const e=this.P.count-1;if(t!==e){this.bi[t]=this.bi[e],this.bj[t]=this.bj[e],this.dVp[t]=this.dVp[e];for(let s=0;s<9;s+=1)this.wr[9*t+s]=this.wr[9*e+s],this.wt[9*t+s]=this.wt[9*e+s]}this.P.remove(t)}computeHeatWeights(){const{P:t,g:e,bi:s,bj:n,wr:i,wt:r}=this,{nx:a,ny:o,kind:c}=e;for(let f=0;f<t.count;f+=1){const u=9*f,d=s[f],g=n[f];let h=0;for(let v=0;v<9;v+=1){const m=d+v%3,x=g+(v/3|0),y=m>=0&&x>=0&&m<a&&x<o&&c[m+x*a]===ct?i[u+v]:0;r[u+v]=y,h+=y}if(h>0){const v=1/h;for(let m=0;m<9;m+=1)r[u+m]*=v}else{for(let v=0;v<9;v+=1)r[u+v]=0;r[u+4]=1}}}splatVolume(){const{P:t,g:e,bi:s,bj:n,wr:i}=this,{nx:r,ny:a,phi:o}=e;o.fill(0);const c=1/e.vCell;let f=0,u=0;for(let d=0;d<t.count;d+=1){const g=t.mass[d]/t.rho[d];f+=t.mass[d],u+=g;const h=9*d,v=s[d],m=n[d];for(let x=0;x<9;x+=1){const F=v+x%3,y=m+(x/3|0);F<0||y<0||F>=r||y>=a||(o[F+y*r]+=i[h+x]*g*c)}}u>0&&(this.rhoRef=f/u)}classify(t=null){const e=this.g,{nx:s,ny:n}=e;let i=0;for(let r=0;r<e.n;r+=1){if(e.solid[r]!==0){e.kind[r]=ft;continue}const a=e.phi[r];let o=a>0&&a+e.phiS[r]+e.alpha[r]>=.5;if(!o&&t!==null&&t[r]!==I&&t[r]!==ft){const c=r%s,f=(r-c)/s;(c>0?t[r-1]===I:e.openL)||(c<s-1?t[r+1]===I:e.openR)||(f>0?t[r-s]===I:e.openB)||(f<n-1?t[r+s]===I:e.openT)||(o=!0)}e.kind[r]=o?ct:I,o&&(i+=1)}return i}p2g(){const{P:t,g:e,w:s,mu:n,pu:i,mv:r,pv:a,rv:o}=this,{nx:c,ny:f,dx:u}=e,d=1/u,g=c+1;n.fill(0),i.fill(0),r.fill(0),a.fill(0),o.fill(0);const h=1/this.rhoRef;for(let v=0;v<t.count;v+=1){const m=t.x[v],x=t.y[v],F=t.mass[v],y=t.vx[v],w=t.vy[v],b=t.c00[v],P=t.c01[v],_=t.c10[v],A=t.c11[v],C=m*d,L=x*d;let R=te(C,s,0),E=te(L-.5,s,3);for(let G=0;G<3;G+=1){const q=E+G,B=(q+.5)*u-x;for(let D=0;D<3;D+=1){const M=R+D,j=s[D]*s[3+G]*F,nt=j*(y+b*(M*u-m)+P*B);if(M>=0&&M<=c&&q>=0&&q<f){const W=M+q*g;n[W]+=j,i[W]+=nt}else this.mirrorU(M,q),n[this.mf]+=j,i[this.mf]+=this.ms*nt}}R=te(C-.5,s,0),E=te(L,s,3);const J=t.rho[v]*h;for(let G=0;G<3;G+=1){const q=E+G,B=q*u-x;for(let D=0;D<3;D+=1){const M=R+D,j=s[D]*s[3+G]*F,nt=j*(w+_*((M+.5)*u-m)+A*B);let W,S=1;M>=0&&M<c&&q>=0&&q<=f?W=M+q*c:(this.mirrorV(M,q),W=this.mf,S=this.ms),r[W]+=j,a[W]+=S*nt,o[W]+=j*J}}}}mirrorU(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,o=1;r<0?s.openL?r=0:(r=-r,o=-o):r>n&&(s.openR?r=n:(r=2*n-r,o=-o)),a<0?a=s.openB?0:-1-a:a>=i&&(a=s.openT?i-1:2*i-1-a),r=Math.min(n,Math.max(0,r)),a=Math.min(i-1,Math.max(0,a)),this.mf=r+a*(n+1),this.ms=o}mirrorV(t,e){const s=this.g,{nx:n,ny:i}=s;let r=t,a=e,o=1;r<0?r=s.openL?0:-1-r:r>=n&&(r=s.openR?n-1:2*n-1-r),a<0?s.openB?a=0:(a=-a,o=-o):a>i&&(s.openT?a=i:(a=2*i-a,o=-o)),r=Math.min(n-1,Math.max(0,r)),a=Math.min(i,Math.max(0,a)),this.mf=r+a*n,this.ms=o}step(t,e,s,n){const{g:i,P:r}=this,{nx:a,ny:o,dx:c,kind:f}=i,u=a+1;this.p2g();const{mu:d,pu:g,mv:h,pv:v,rv:m,knownU:x,knownV:F}=this,y=i.ul,w=i.vl,b=this.rhoRef*i.vCell*.25,P=wo*b;for(let q=0;q<i.nu;q+=1)y[q]=d[q]>P?g[q]/d[q]+t*this.fU[q]/(this.rhoRef*i.vCell):0;for(let q=0;q<i.nv;q+=1)w[q]=h[q]>P?v[q]/h[q]-t*e*(m[q]/h[q])+t*this.fV[q]/(this.rhoRef*i.vCell):0;for(let q=0;q<o;q+=1)for(let B=0;B<=a;B+=1){const D=B+q*u,M=B>0?f[B-1+q*a]:-1,j=B<a?f[B+q*a]:-1,nt=B===0&&!i.openL,W=B===a&&!i.openR;if(nt||W||M===ft||j===ft){y[D]=0,x[D]=2;continue}x[D]=M===ct||j===ct?1:0}for(let q=0;q<=o;q+=1)for(let B=0;B<a;B+=1){const D=B+q*a,M=q>0?f[B+(q-1)*a]:-1,j=q<o?f[B+q*a]:-1,nt=q===0&&!i.openB,W=q===o&&!i.openT;if(nt||W||M===ft||j===ft){w[D]=0,F[D]=2;continue}F[D]=M===ct||j===ct?1:0}let _=a,A=-1,C=o,L=-1,R=0;for(let q=0;q<o;q+=1)for(let B=0;B<a;B+=1)f[B+q*a]===ct&&(R+=1,B<_&&(_=B),B>A&&(A=B),q<C&&(C=q),q>L&&(L=q));const E=this.last.solve;if(E.iterations=0,E.residual=0,E.capped=!1,R>0){const q=A-_+1,B=L-C+1,D=this.solver,M=D.begin(q,B),j=t/this.rhoRef,nt=1/i.vCell,W=this.pGas;for(let T=C;T<=L;T+=1)for(let O=_;O<=A;O+=1){const k=O+T*a;if(f[k]!==ct)continue;const N=D.at(O-_,T-C);M.act[N]=1,M.x[N]=i.pl[k];const z=O+T*u,st=O+T*a,it=y[z+1]-y[z]+w[st+a]-w[st],V=i.phi[k]+i.phiS[k]+i.alpha[k];let Q=this.volSrc[k]*nt;const $=this.gasAt(O-1,T)||this.gasAt(O+1,T)||this.gasAt(O,T-1)||this.gasAt(O,T+1),ot=V-1;(ot>0||!$)&&(Q+=Fo*ot/t);let ht=Q*c*c-c*it;if(O+1<a){const Vt=f[k+1];Vt===ct?O+1<=A&&(M.ax[N]=j):Vt===I&&(M.dDx[N]+=j,ht+=j*W[k+1])}else i.openR&&(M.dDx[N]+=2*j);if(O>0?f[k-1]===I&&(M.dDx[N]+=j,ht+=j*W[k-1]):i.openL&&(M.dDx[N]+=2*j),T+1<o){const Vt=f[k+a];Vt===ct?T+1<=L&&(M.ay[N]=j):Vt===I&&(M.dDy[N]+=j,ht+=j*W[k+a])}else i.openT&&(M.dDy[N]+=2*j);T>0?f[k-a]===I&&(M.dDy[N]+=j,ht+=j*W[k-a]):i.openB&&(M.dDy[N]+=2*j),M.b[N]=ht}const S=D.solve(s,n,!0);E.iterations=S.iterations,E.residual=S.residual,E.capped=S.capped;const H=i.pl;for(let T=0;T<i.n;T+=1)H[T]=f[T]===I?W[T]:0;for(let T=C;T<=L;T+=1)for(let O=_;O<=A;O+=1){const k=O+T*a;f[k]===ct&&(H[k]=M.x[D.at(O-_,T-C)])}for(let T=0;T<o;T+=1)for(let O=0;O<=a;O+=1){const k=O+T*u;if(x[k]===1){if(O===0){y[k]-=j/c*2*(H[T*a]-0);continue}if(O===a){y[k]-=j/c*2*(0-H[a-1+T*a]);continue}y[k]-=j/c*(H[O+T*a]-H[O-1+T*a])}}for(let T=0;T<=o;T+=1)for(let O=0;O<a;O+=1){const k=O+T*a;if(F[k]===1){if(T===0){w[k]-=j/c*2*(H[O]-0);continue}if(T===o){w[k]-=j/c*2*(0-H[O+(o-1)*a]);continue}w[k]-=j/c*(H[O+T*a]-H[O+(T-1)*a])}}}this.extrapolate();const J=this.g2p();this.advect(t),this.dVp.fill(0,0,r.count),this.volSrc.fill(0),this.fU.fill(0),this.fV.fill(0),this.computeWeights();const G=this.last;return G.cells=R,G.uMax=J,G.escapedMass=this.escM,G.escapedEnergy=this.escE,G}gasAt(t,e){const s=this.g;return t<0?s.openL:t>=s.nx?s.openR:e<0?s.openB:e>=s.ny?s.openT:s.kind[t+e*s.nx]===I}splatVolumeChange(t){const{P:e,g:s,bi:n,bj:i,wr:r,dVp:a,volSrc:o}=this,{nx:c,ny:f}=s,u=1/t;for(let d=0;d<e.count;d+=1){const g=a[d];if(g===0)continue;const h=9*d,v=n[d],m=i[d];for(let x=0;x<9;x+=1){const F=v+x%3,y=m+(x/3|0);F<0||y<0||F>=c||y>=f||(o[F+y*c]+=r[h+x]*g*u)}}}extrapolate(){const{g:t,knownU:e,knownV:s,tmpU:n,tmpV:i,markU:r,markV:a}=this,{nx:o,ny:c}=t,f=o+1,u=t.ul,d=t.vl;for(let g=0;g<t.nu;g+=1)r[g]=e[g]!==0?1:0;for(let g=0;g<t.nv;g+=1)a[g]=s[g]!==0?1:0;for(let g=0;g<2;g+=1){n.set(u),i.set(d);for(let h=0;h<c;h+=1)for(let v=0;v<=o;v+=1){const m=v+h*f;if(r[m]!==0)continue;let x=0,F=0;v>0&&r[m-1]===1&&(x+=u[m-1],F+=1),v<o&&r[m+1]===1&&(x+=u[m+1],F+=1),h>0&&r[m-f]===1&&(x+=u[m-f],F+=1),h<c-1&&r[m+f]===1&&(x+=u[m+f],F+=1),F>0&&(n[m]=x/F,r[m]=3)}for(let h=0;h<=c;h+=1)for(let v=0;v<o;v+=1){const m=v+h*o;if(a[m]!==0)continue;let x=0,F=0;v>0&&a[m-1]===1&&(x+=d[m-1],F+=1),v<o-1&&a[m+1]===1&&(x+=d[m+1],F+=1),h>0&&a[m-o]===1&&(x+=d[m-o],F+=1),h<c&&a[m+o]===1&&(x+=d[m+o],F+=1),F>0&&(i[m]=x/F,a[m]=3)}u.set(n),d.set(i);for(let h=0;h<t.nu;h+=1)r[h]===3&&(r[h]=1);for(let h=0;h<t.nv;h+=1)a[h]===3&&(a[h]=1)}for(let g=0;g<t.nu;g+=1)r[g]===0&&(u[g]=0);for(let g=0;g<t.nv;g+=1)a[g]===0&&(d[g]=0)}g2p(){const{P:t,g:e,w:s}=this,{nx:n,ny:i,dx:r}=e,a=1/r,o=n+1,c=e.ul,f=e.vl,u=4/(r*r);let d=0;for(let g=0;g<t.count;g+=1){const h=t.x[g],v=t.y[g],m=h*a,x=v*a;let F=te(m,s,0),y=te(x-.5,s,3),w=0,b=0,P=0;for(let R=0;R<3;R+=1){const E=y+R,J=(E+.5)*r-v;for(let G=0;G<3;G+=1){const q=F+G,B=s[G]*s[3+R];let D;q>=0&&q<=n&&E>=0&&E<i?D=c[q+E*o]:(this.mirrorU(q,E),D=this.ms*c[this.mf]),w+=B*D,b+=B*D*(q*r-h),P+=B*D*J}}F=te(m-.5,s,0),y=te(x,s,3);let _=0,A=0,C=0;for(let R=0;R<3;R+=1){const E=y+R,J=E*r-v;for(let G=0;G<3;G+=1){const q=F+G,B=s[G]*s[3+R];let D;q>=0&&q<n&&E>=0&&E<=i?D=f[q+E*n]:(this.mirrorV(q,E),D=this.ms*f[this.mf]),_+=B*D,A+=B*D*((q+.5)*r-h),C+=B*D*J}}t.vx[g]=w,t.vy[g]=_,t.c00[g]=u*b,t.c01[g]=u*P,t.c10[g]=u*A,t.c11[g]=u*C;const L=w*w+_*_;L>d&&(d=L)}return Math.sqrt(d)}velocityAt(t,e,s){const n=this.g,{nx:i,ny:r,dx:a}=n,o=i+1,c=1/a;let f=Math.min(i-1e-6,Math.max(0,t*c)),u=Math.min(r-1.000001,Math.max(0,e*c-.5)),d=Math.floor(f),g=Math.floor(u),h=f-d,v=u-g;const m=n.ul;s[0]=(1-v)*((1-h)*m[d+g*o]+h*m[d+1+g*o])+v*((1-h)*m[d+(g+1)*o]+h*m[d+1+(g+1)*o]),f=Math.min(i-1.000001,Math.max(0,t*c-.5)),u=Math.min(r-1e-6,Math.max(0,e*c)),d=Math.floor(f),g=Math.floor(u),h=f-d,v=u-g;const x=n.vl;s[1]=(1-v)*((1-h)*x[d+g*i]+h*x[d+1+g*i])+v*((1-h)*x[d+(g+1)*i]+h*x[d+1+(g+1)*i])}advect(t){const{P:e,g:s,vel:n}=this,i=s.w,r=s.h,a=s.dx;let o=0,c=0;for(let f=0;f<e.count;f+=1){const u=e.x[f],d=e.y[f];this.velocityAt(u,d,n);const g=u+.5*t*n[0],h=d+.5*t*n[1];this.velocityAt(g,h,n);let v=u+t*n[0],m=d+t*n[1];if(v<0&&s.openL||v>i&&s.openR||m<0&&s.openB||m>r&&s.openT){o+=e.mass[f],c+=e.mass[f]*e.h[f],this.removeParticle(f),f-=1;continue}const x=1e-4*a;v=Math.min(i-x,Math.max(x,v)),m=Math.min(r-x,Math.max(x,m));let F=s.sdfAt(v,m);if(F<.05*a)for(let y=0;y<3&&F<.05*a;y+=1){const w=.25*a;let b=s.sdfAt(v+w,m)-s.sdfAt(v-w,m),P=s.sdfAt(v,m+w)-s.sdfAt(v,m-w);const _=Math.hypot(b,P);if(_<1e-12)break;b/=_,P/=_;const A=.05*a-F;v+=A*b,m+=A*P;const C=e.vx[f]*b+e.vy[f]*P;C<0&&(e.vx[f]-=C*b,e.vy[f]-=C*P),v=Math.min(i-x,Math.max(x,v)),m=Math.min(r-x,Math.max(x,m)),F=s.sdfAt(v,m)}e.x[f]=v,e.y[f]=m}this.escM=o,this.escE=c}}class Po{constructor(t){p(this,"cap");p(this,"count",0);p(this,"nextId",1);p(this,"x");p(this,"y");p(this,"vx");p(this,"vy");p(this,"c00");p(this,"c01");p(this,"c10");p(this,"c11");p(this,"mass");p(this,"h");p(this,"T");p(this,"rho");p(this,"spc");p(this,"smass");p(this,"mat");p(this,"id");this.cap=t,this.x=new Float32Array(t),this.y=new Float32Array(t),this.vx=new Float32Array(t),this.vy=new Float32Array(t),this.c00=new Float32Array(t),this.c01=new Float32Array(t),this.c10=new Float32Array(t),this.c11=new Float32Array(t),this.mass=new Float64Array(t),this.h=new Float64Array(t),this.T=new Float32Array(t),this.rho=new Float32Array(t),this.spc=new Uint8Array(2*t),this.smass=new Float64Array(2*t),this.mat=new Uint8Array(t),this.id=new Uint32Array(t)}get nextFree(){return this.nextId}reserveIds(t){t>this.nextId&&(this.nextId=t>>>0||1)}add(t,e,s,n,i){if(this.count>=this.cap)return-1;const r=this.count;return this.count+=1,this.x[r]=t,this.y[r]=e,this.vx[r]=0,this.vy[r]=0,this.c00[r]=0,this.c01[r]=0,this.c10[r]=0,this.c11[r]=0,this.mass[r]=s,this.h[r]=n,this.mat[r]=i,this.spc[2*r]=0,this.spc[2*r+1]=0,this.smass[2*r]=0,this.smass[2*r+1]=0,this.id[r]=this.nextId,this.nextId=this.nextId+1>>>0||1,this.derive(r),r}derive(t){const e=Cr(this.h[t]);this.T[t]=e,this.rho[t]=Es(e)}remove(t){const e=this.count-1;t!==e&&(this.x[t]=this.x[e],this.y[t]=this.y[e],this.vx[t]=this.vx[e],this.vy[t]=this.vy[e],this.c00[t]=this.c00[e],this.c01[t]=this.c01[e],this.c10[t]=this.c10[e],this.c11[t]=this.c11[e],this.mass[t]=this.mass[e],this.h[t]=this.h[e],this.T[t]=this.T[e],this.rho[t]=this.rho[e],this.spc[2*t]=this.spc[2*e],this.spc[2*t+1]=this.spc[2*e+1],this.smass[2*t]=this.smass[2*e],this.smass[2*t+1]=this.smass[2*e+1],this.mat[t]=this.mat[e],this.id[t]=this.id[e]),this.count=e}find(t){for(let e=0;e<this.count;e+=1)if(this.id[e]===t)return e;return-1}clear(){this.count=0}}const Ao=.001;class To{constructor(t){p(this,"e");p(this,"produced",0);p(this,"condensed",0);p(this,"dew",0);p(this,"fogMade",0);p(this,"producedMark",0);p(this,"fogError",0);p(this,"fogWrong",0);p(this,"mtot");p(this,"rd");p(this,"Y0");p(this,"Tl");p(this,"Cl");p(this,"acc");p(this,"accH");p(this,"Fm");p(this,"Fe");p(this,"dm");p(this,"side",new Int32Array(4));p(this,"bG");p(this,"bY");p(this,"edge");p(this,"hvC");p(this,"hnC");p(this,"hoC");p(this,"yb",0);this.e=t;const e=t.grid.n;this.mtot=new Float64Array(e),this.rd=new Float64Array(e),this.Y0=new Float64Array(e),this.Tl=new Float64Array(e),this.Cl=new Float64Array(e),this.acc=new Float64Array(e),this.accH=new Float64Array(e),this.Fm=new Float64Array(e),this.Fe=new Float64Array(e),this.dm=new Float64Array(t.particles.cap),this.bG=new Float64Array(4*e),this.bY=new Float64Array(4*e),this.edge=new Uint8Array(e),this.hvC=new Float64Array(e),this.hnC=new Float64Array(e),this.hoC=new Float64Array(e)}ysat(t,e,s){const n=this.e.grid,i=n.n,r=Math.min(.999,rs(t)/e),a=n.mg[tt*i+s],o=n.mg[et*i+s],c=a+o,f=c>0?c/(a/lt[tt]+o/lt[et]):.02885;return r*lt[K]/(r*lt[K]+(1-r)*f)}gatherLiquid(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i}=t,{Tl:r,Cl:a,acc:o,accH:c}=this;a.fill(0),r.fill(0),o.fill(0),c.fill(0);for(let f=0;f<e.count;f+=1){const u=e.mass[f],d=u*ge(e.T[f]),g=9*f;for(let h=0;h<9;h+=1){const v=s.wt[g+h];if(v===0)continue;const m=s.bi[f]+h%3,x=s.bj[f]+(h/3|0);if(m<0||x<0||m>=n||x>=i)continue;const F=m+x*n;a[F]+=v*d,r[F]+=v*d*e.T[f],o[F]+=v*u,c[F]+=v*u*e.h[f]}}for(let f=0;f<t.n;f+=1)r[f]=a[f]>0?r[f]/a[f]:t.T[f]}applyMass(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,{acc:o,dm:c}=this;c.fill(0,0,n.count);for(let u=0;u<n.count;u+=1){const d=9*u;let g=0;for(let h=0;h<9;h+=1){const v=i.wt[d+h];if(v===0)continue;const m=i.bi[u]+h%3,x=i.bj[u]+(h/3|0);if(m<0||x<0||m>=r||x>=a)continue;const F=m+x*r;t[F]!==0&&o[F]>0&&(g+=t[F]*v*n.mass[u]/o[F])}c[u]=g}const f=i.rhoRef*s.vCell/4;for(let u=n.count-1;u>=0;u-=1){const d=c[u];if(d===0)continue;const g=n.mass[u]/n.rho[u],h=n.mass[u]+d;if(h<Ao*f){this.track(u,-n.mass[u]),this.vanish(u,Math.max(0,h),e);continue}this.track(u,d),n.mass[u]=h,i.dVp[u]+=h/n.rho[u]-g}}track(t,e){const{grid:s,particles:n,liquid:i}=this.e,{nx:r,ny:a}=s,o=9*t,c=ge(n.T[t]);for(let f=0;f<9;f+=1){const u=i.wt[o+f];if(u===0)continue;const d=i.bi[t]+f%3,g=i.bj[t]+(f/3|0);if(d<0||g<0||d>=r||g>=a)continue;const h=d+g*r;this.acc[h]+=u*e,this.accH[h]+=u*e*n.h[t],this.Cl[h]+=u*e*c}}vanish(t,e,s){const{grid:n,particles:i,liquid:r,heat:a,gas:o}=this.e,c=n.cellAt(i.x[t],i.y[t]);let f=c;for(;f>=0&&n.kind[f]!==I;)f=f+n.nx<n.n?f+n.nx:-1;if(e>0&&f>=0&&c>=0){const u=i.T[t];n.mg[K*n.n+f]+=e,n.Hg[f]+=e*dt(u),a.src[c]-=e*(dt(u)-i.h[t])/s,this.produced+=e,o.deriveCell(f)}else if(e>0&&c>=0){for(let u=0;u<i.count;u+=1)if(u!==t&&n.cellAt(i.x[u],i.y[u])===c){const d=i.mass[u]*i.h[u]+e*i.h[t];i.mass[u]+=e,i.h[u]=d/i.mass[u],i.derive(u);break}}r.removeParticle(t)}step(t){this.diffuse(t),this.flash(),this.fog(),this.films()}diffuse(t){const e=this.e,{grid:s,gas:n,regions:i,heat:r,solver:a}=e,{nx:o,ny:c,n:f,depth:u,kind:d}=s,{mtot:g,rd:h,Y0:v,Tl:m,Fm:x,Fe:F,accH:y,acc:w,edge:b,hvC:P,hnC:_,hoC:A}=this;let C=!1;for(let B=0;B<f;B+=1){if(d[B]!==I){g[B]=0;continue}const D=s.mg[B]+s.mg[f+B]+s.mg[K*f+B];g[B]=D,v[B]=D>0?s.mg[K*f+B]/D:0;const M=s.T[B];h[B]=n.rho[B]*Wr(M,i.pAt(B)),P[B]=dt(M),_[B]=Ut(tt,M),A[B]=Ut(et,M),C=!0}if(!C)return;for(let B=0;B<c;B+=1)for(let D=0;D<o;D+=1){const M=D+B*o;b[M]=d[M]===I&&(D===0||B===0||D===o-1||B===c-1||d[M-1]!==I||d[M+1]!==I||d[M-o]!==I||d[M+o]!==I)?1:0}const L=a.begin(o,c),R=L.stride,E=e.ambientY[K],{bG:J,bY:G}=this;for(let B=0;B<c;B+=1)for(let D=0;D<o;D+=1){const M=D+B*o;if(d[M]!==I||g[M]<=0)continue;const j=D+1+(B+1)*R;L.act[j]=1,L.x[j]=v[M],L.dH[j]=g[M]/t;let nt=g[M]*v[M]/t;if(D+1<o&&d[M+1]===I&&g[M+1]>0&&(L.ax[j]=.5*(h[M]+h[M+1])*u),B+1<c&&d[M+o]===I&&g[M+o]>0&&(L.ay[j]=.5*(h[M]+h[M+o])*u),b[M]===0){L.b[j]=nt;continue}let W=0;for(let S=0;S<4;S+=1){const H=this.boundary(M,D,B,S,E);J[4*M+S]=H,G[4*M+S]=this.yb,!(H<=0)&&(W+=H,nt+=H*this.yb)}L.dDx[j]=W,L.b[j]=nt}a.solve(1e-9,200,!1),x.fill(0),F.fill(0);const q=L.x;for(let B=0;B<c;B+=1)for(let D=0;D<o;D+=1){const M=D+B*o;if(d[M]!==I||g[M]<=0)continue;const j=D+1+(B+1)*R,nt=q[j];if(D+1<o&&d[M+1]===I&&g[M+1]>0&&this.exchange(M,M+1,t*.5*(h[M]+h[M+1])*u*(nt-q[j+1])),B+1<c&&d[M+o]===I&&g[M+o]>0&&this.exchange(M,M+o,t*.5*(h[M]+h[M+o])*u*(nt-q[j+R])),b[M]!==0)for(let W=0;W<4;W+=1){const S=J[4*M+W];if(S<=0)continue;const H=t*S*(G[4*M+W]-nt),O=(W===0?D===0:W===1?D===o-1:W===2?B===0:B===c-1)?-1:W===0?M-1:W===1?M+1:W===2?M-o:M+o;if(O<0)this.ambientExchange(M,H);else if(d[O]===ct)if(H>0){const k=m[O];s.mg[K*f+M]+=H,s.Hg[M]+=H*dt(k),x[O]-=H,F[O]-=H*dt(k),this.produced+=H}else{const k=Math.min(-H,s.mg[K*f+M]);s.mg[K*f+M]-=k,s.Hg[M]-=k*dt(s.T[M]),x[O]+=k,F[O]+=k*dt(s.T[M]),this.condensed+=k}else if(d[O]===ft){const k=s.T[O];if(H<0){const N=Math.min(-H,s.mg[K*f+M]);s.mg[K*f+M]-=N,s.Hg[M]-=N*dt(s.T[M]),s.film[O]+=N,s.Es[O]+=N*_t(k),r.src[O]+=N*(dt(s.T[M])-_t(k))/t,this.dew+=N}else{const N=Math.min(H,s.film[O]);s.film[O]-=N,s.Es[O]-=N*_t(k),s.mg[K*f+M]+=N,s.Hg[M]+=N*dt(k),r.src[O]-=N*(dt(k)-_t(k))/t,this.dew-=N}}}}for(let B=0;B<f;B+=1){if(x[B]===0||w[B]<=0)continue;const D=y[B]/w[B];r.src[B]+=(F[B]-x[B]*D)/t}this.applyMass(x,t);for(let B=0;B<f;B+=1)d[B]===I&&g[B]>0&&n.deriveCell(B)}boundary(t,e,s,n,i){const r=this.e.grid,{nx:a,ny:o,depth:c,kind:f}=r,u=n===0?e===0:n===1?e===a-1:n===2?s===0:s===o-1,d=2*this.rd[t]*c;if(u)return this.side[n]=-1,(n===0?r.openL:n===1?r.openR:n===2?r.openB:r.openT)?(this.yb=i,d):0;const g=n===0?t-1:n===1?t+1:n===2?t-a:t+a;this.side[n]=g;const h=f[g],v=this.Y0[t],m=this.e.regions.pAt(t);if(h===ct)return this.yb=this.ysat(this.Tl[g],m,t),d*(1-v);if(h===ft){const x=this.ysat(r.T[g],m,t);return v>x||r.film[g]>0&&v<x?(this.yb=x,d*(1-v)):0}return 0}exchange(t,e,s){const n=this.e.grid,i=n.n;if(s===0)return;const r=s>0?t:e,a=s>0?e:t;let o=Math.abs(s);o=Math.min(o,n.mg[K*i+r]);const c=n.mg[tt*i+a],f=n.mg[et*i+a],u=c+f,d=Math.min(o,u);if(o<=0)return;const g=this.hvC[r];if(n.mg[K*i+r]-=o,n.mg[K*i+a]+=o,n.Hg[r]-=o*g,n.Hg[a]+=o*g,d>0){const h=d*c/u,v=d-h;n.mg[tt*i+a]-=h,n.mg[et*i+a]-=v,n.mg[tt*i+r]+=h,n.mg[et*i+r]+=v;const m=h*this.hnC[a]+v*this.hoC[a];n.Hg[a]-=m,n.Hg[r]+=m}}ambientExchange(t,e){const s=this.e,n=s.grid,i=n.n,r=s.ambientT;if(e>0){const a=n.mg[tt*i+t]+n.mg[et*i+t],o=Math.min(e,a);if(n.mg[K*i+t]+=e,n.Hg[t]+=e*dt(r),o>0){const c=o*n.mg[tt*i+t]/a,f=o-c;n.mg[tt*i+t]-=c,n.mg[et*i+t]-=f;const u=c*Ut(tt,n.T[t])+f*Ut(et,n.T[t]);n.Hg[t]-=u,s.flows.escapedAir+=o,s.flows.escapedEnergy+=u}s.flows.escapedWater-=e,s.flows.escapedEnergy-=e*dt(r)}else if(e<0){const a=Math.min(-e,n.mg[K*i+t]),o=s.ambientY[tt],c=s.ambientY[et],f=o+c>0?o+c:1;n.mg[K*i+t]-=a,n.Hg[t]-=a*dt(n.T[t]);const u=a*o/f,d=a-u;n.mg[tt*i+t]+=u,n.mg[et*i+t]+=d;const g=u*Ut(tt,r)+d*Ut(et,r);n.Hg[t]+=g,s.flows.escapedWater+=a,s.flows.escapedAir-=a,s.flows.escapedEnergy+=a*dt(n.T[t])-g}}flash(){const t=this.e,{grid:e,particles:s,liquid:n,regions:i,gas:r}=t,{nx:a,ny:o,n:c,kind:f}=e,{Tl:u}=this,d=this.rd;let g=!1;for(let m=0;m<c;m+=1){if(d[m]=0,f[m]!==ct)continue;const x=m%a,F=(m-x)/a,y=F+1<o?m+a:-1;if(!(y>=0&&f[y]===I||x>0&&f[m-1]===I||x<a-1&&f[m+1]===I||F>0&&f[m-a]===I))continue;const b=yt(i.pAt(m));u[m]>b&&(d[m]=b,g=!0)}if(!g)return;const h=this.mtot;h.fill(0);const v=this.Y0;v.fill(0);for(let m=0;m<s.count;m+=1){const x=9*m;let F=0,y=0;for(let P=0;P<9;P+=1){const _=n.wt[x+P];if(_===0)continue;const A=n.bi[m]+P%3,C=n.bj[m]+(P/3|0);if(A<0||C<0||A>=a||C>=o)continue;const L=A+C*a,R=d[L];if(R===0)continue;const E=_t(R);if(s.h[m]<=E)continue;const J=dt(R),G=_*s.mass[m]*(s.h[m]-E)/(J-E);F+=G,y+=G*J,h[L]+=G,v[L]+=G*J}if(F===0)continue;const w=s.mass[m]/s.rho[m],b=s.mass[m]-F;s.h[m]=(s.mass[m]*s.h[m]-y)/b,s.mass[m]=b,s.derive(m),n.dVp[m]+=b/s.rho[m]-w}for(let m=0;m<c;m+=1){if(h[m]===0)continue;const x=m%a,F=(m-x)/a;let y=0;const w=F+1<o&&f[m+a]===I?m+a:-1;if(w>=0)e.mg[K*c+w]+=h[m],e.Hg[w]+=v[m],r.deriveCell(w);else{const b=this.side;b[0]=x>0&&f[m-1]===I?m-1:-1,b[1]=x<a-1&&f[m+1]===I?m+1:-1,b[2]=F>0&&f[m-a]===I?m-a:-1,b[3]=-1;for(let P=0;P<3;P+=1)b[P]>=0&&(y+=1);for(let P=0;P<3;P+=1)b[P]<0||(e.mg[K*c+b[P]]+=h[m]/y,e.Hg[b[P]]+=v[m]/y,r.deriveCell(b[P]))}this.produced+=h[m]}}tempWith(t,e,s,n){const i=this.e.grid,r=i.n,a=i.mg[tt*r+t],o=i.mg[et*r+t],c=i.Hg[t];if(s<=0)return Yi(a,o,e,c);let f=n;for(let u=0;u<6;u+=1){const d=a*Ut(tt,f)+o*Ut(et,f)+e*dt(f)+s*_t(f),g=(c-d)/Ln(a,o,e,s,f);if(f+=g,Math.abs(g)<1e-10)break}return f}satGap(t,e,s,n,i){const r=this.e.grid,a=r.n,o=r.mg[K*a+t]-e,c=r.mfog[t]+e,f=this.tempWith(t,o,c,i),u=o/lt[K];return(u+s>0?u/(u+s)*n:0)-rs(f)}fog(){const{grid:t,gas:e,regions:s}=this.e,n=t.n;this.fogError=0,this.fogWrong=0;for(let i=0;i<n;i+=1){if(t.kind[i]!==I)continue;const r=t.mg[K*n+i],a=t.mfog[i];if(r<=0&&a<=0)continue;const o=t.mg[tt*n+i]/lt[tt]+t.mg[et*n+i]/lt[et],c=s.pAt(i),f=t.T[i];if(a<=0){const F=r/lt[K];if(F/(F+o)*c<.999*rs(f))continue}const u=this.satGap(i,0,o,c,f);if(u<=0&&a<=0)continue;let d,g,h,v;if(u>0)d=0,h=u,g=r,v=this.satGap(i,g,o,c,f);else if(g=0,v=u,d=-a,h=this.satGap(i,d,o,c,f),h<=0){this.setFog(i,d);continue}if(v>0){this.setFog(i,g);continue}let m=d,x=0;for(let F=0;F<40;F+=1){m=(d*v-g*h)/(v-h),(!Number.isFinite(m)||m<=Math.min(d,g)||m>=Math.max(d,g))&&(m=.5*(d+g));const y=this.satGap(i,m,o,c,f);if(Math.abs(y)<=1e-13*c)break;y>0?(d=m,h=y,x===1&&(v/=2),x=1):(g=m,v=y,x===-1&&(h/=2),x=-1)}if(this.setFog(i,m),u<0&&m>0&&(this.fogWrong+=1),t.mfog[i]>0){const F=this.satGap(i,0,o,c,t.T[i]);this.fogError=Math.max(this.fogError,Math.abs(F)/rs(t.T[i]))}}}setFog(t,e){const{grid:s,gas:n}=this.e,i=s.n;if(e===0||!Number.isFinite(e))return;const r=Math.max(-s.mfog[t],Math.min(s.mg[K*i+t],e));s.mg[K*i+t]-=r,s.mfog[t]+=r,s.mfog[t]<1e-30&&(s.mfog[t]=0),this.fogMade+=r,n.deriveCell(t)}films(){const{grid:t,particles:e,liquid:s}=this.e,{nx:n,ny:i,n:r,kind:a}=t,o=s.rhoRef*t.vCell/4;for(let c=0;c<r;c+=1){if(t.solid[c]===0||t.film[c]<o)continue;const f=c%n,u=(c-f)/n,g=[f>0?c-1:-1,f<n-1?c+1:-1,u+1<i?c+n:-1,u>0?c-n:-1].find(w=>w>=0&&a[w]===I);if(g===void 0)continue;const h=g%n,v=(g-h)/n,m=(h+.5+.25*Math.sign(f-h))*t.dx,x=(v+.5+.25*Math.sign(u-v))*t.dx,F=t.T[c];e.add(m,x,o,_t(F),0)<0||(t.film[c]-=o,t.Es[c]-=o*_t(F),s.weightsDirty=!0)}}}class ko{constructor(t){p(this,"g");p(this,"id");p(this,"count",0);p(this,"open",new Uint8Array(4));p(this,"vFluid",new Float64Array(4));p(this,"p0",new Float64Array(4));p(this,"rhoBar",new Float64Array(4));p(this,"vLiq",new Float64Array(4));p(this,"vBub",new Float64Array(4));p(this,"vGas",new Float64Array(4));p(this,"nSum",new Float64Array(4));p(this,"mSum",new Float64Array(4));p(this,"stack");p(this,"pAmb",101325);p(this,"rhoAmb",1.2);p(this,"gy",9.81);this.g=t,this.id=new Int32Array(t.n).fill(-1),this.stack=new Int32Array(t.n)}grow(t){if(t<this.open.length)return;const e=Math.max(2*this.open.length,t+1),s=i=>{const r=new Uint8Array(e);return r.set(i),r},n=i=>{const r=new Float64Array(e);return r.set(i),r};this.open=s(this.open),this.vFluid=n(this.vFluid),this.p0=n(this.p0),this.rhoBar=n(this.rhoBar),this.vLiq=n(this.vLiq),this.vBub=n(this.vBub),this.vGas=n(this.vGas),this.nSum=n(this.nSum),this.mSum=n(this.mSum)}label(){const t=this.g,{nx:e,ny:s,solid:n}=t;this.id.fill(-1);let i=0;for(let r=0;r<t.n;r+=1){if(n[r]!==0||this.id[r]!==-1)continue;this.grow(i);let a=0,o=0,c=0;for(this.stack[a++]=r,this.id[r]=i;a>0;){const f=this.stack[--a];c+=1;const u=f%e,d=(f-u)/e;(u===0&&t.openL||u===e-1&&t.openR||d===0&&t.openB||d===s-1&&t.openT)&&(o=1),u>0&&n[f-1]===0&&this.id[f-1]===-1&&(this.id[f-1]=i,this.stack[a++]=f-1),u<e-1&&n[f+1]===0&&this.id[f+1]===-1&&(this.id[f+1]=i,this.stack[a++]=f+1),d>0&&n[f-e]===0&&this.id[f-e]===-1&&(this.id[f-e]=i,this.stack[a++]=f-e),d<s-1&&n[f+e]===0&&this.id[f+e]===-1&&(this.id[f+e]=i,this.stack[a++]=f+e)}this.open[i]=o,this.vFluid[i]=c*t.vCell,i+=1}this.count=i}volumes(t,e){const s=this.g;this.vLiq.fill(0,0,this.count),this.vBub.fill(0,0,this.count);for(let n=0;n<t.count;n+=1){const i=s.cellAt(t.x[n],t.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vLiq[r]+=t.mass[n]/t.rho[n])}for(let n=0;n<e.count;n+=1){const i=s.cellAt(e.x[n],e.y[n]),r=i<0?-1:this.id[i];r>=0&&(this.vBub[r]+=e.V[n])}for(let n=0;n<this.count;n+=1)this.vGas[n]=Math.max(.001*this.vFluid[n],this.vFluid[n]-this.vLiq[n]-this.vBub[n])}update(t,e){const s=this.g;this.volumes(t,e),this.nSum.fill(0,0,this.count),this.mSum.fill(0,0,this.count);const n=s.n;for(let i=0;i<n;i+=1){const r=this.id[i];if(!(r<0))for(let a=0;a<ut;a+=1){const o=s.mg[a*n+i];this.mSum[r]+=o,this.nSum[r]+=o/lt[a]}}for(let i=0;i<this.count;i+=1){if(this.open[i]!==0){this.p0[i]=this.pAmb,this.rhoBar[i]=this.rhoAmb;continue}this.rhoBar[i]=this.mSum[i]/this.vGas[i],this.p0[i]=this.statePressure(i)}}statePressure(t){const e=this.g,s=e.n;let n=0;for(let o=0;o<s;o+=1){if(this.id[o]!==t||e.kind[o]===ft)continue;let c=0;for(let f=0;f<ut;f+=1)c+=e.mg[f*s+o]/lt[f];n+=c*Bt*e.T[o]}if(n<=0)return this.pAmb;const i=this.vGas[t];let r=n/i;const a=this.rhoBar[t]*this.gy;if(a===0)return r;for(let o=0;o<2;o+=1){let c=-i,f=0;for(let u=0;u<s;u+=1){if(this.id[u]!==t||e.kind[u]===ft)continue;let d=0;for(let v=0;v<ut;v+=1)d+=e.mg[v*s+u]/lt[v];const g=r-a*(e.dx*((u-u%e.nx)/e.nx+.5)),h=d*Bt*e.T[u];c+=h/g,f-=h/(g*g)}r-=c/f}return r}pAt(t){const e=this.id[t];if(e<0)return this.pAmb;const s=this.g,n=s.dx*(Math.floor(t/s.nx)+.5);return this.p0[e]-this.rhoBar[e]*this.gy*n}isOpen(t){const e=this.id[t];return e>=0&&this.open[e]!==0}pvTerm(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t-=this.p0[e]*this.vFluid[e]);return t}sealedCount(){let t=0;for(let e=0;e<this.count;e+=1)this.open[e]===0&&(t+=1);return t}firstGasCell(t){const e=this.g;for(let s=0;s<e.n;s+=1)if(this.id[s]===t&&e.kind[s]===I)return s;return-1}}const On="recreatio/lab2d",So={"very-high":.001,high:.002,medium:.003},Mo=l=>l==="very-high"||l==="high"||l==="medium",Lo=16e4,mt=(l,t)=>typeof l=="number"&&Number.isFinite(l)?l:t,wt=(l,t,e)=>Math.min(e,Math.max(t,l)),Te=l=>l!==null&&typeof l=="object"&&!Array.isArray(l)?l:{},ws=(l,t)=>l==="wall"||l==="open"?l:t,hi=.25*Qs,un=2*Qs;function Co(l){const t={};let e=0;for(const[s,n]of Object.entries(Te(l)))typeof n=="number"&&Number.isFinite(n)&&n>0&&(t[s]=n,e+=n);if(e<=0)return{H2O:1};for(const s of Object.keys(t))t[s]/=e;return t}function Oo(l,t,e){const s=Te(l),n=pt+mt(s.T,20),i=r=>{const a=typeof s.material=="string"?s.material:r;return Ms(a)>=0?a:(t.push(`ops[${e}]: unknown material "${String(s.material)}", using ${r}`),r)};switch(s.op){case"fill":{const r=ys(s.region);if(r===null)break;return{op:"fill",region:r,phase:s.phase==="gas"?"gas":"liquid",T:n,composition:Co(s.composition)}}case"erase":{const r=ys(s.region);if(r===null)break;return{op:"erase",region:r}}case"move":{const r=ys(s.region);if(r===null)break;return{op:"move",region:r,dx:wt(mt(s.dx,0),-1,1),dy:wt(mt(s.dy,0),-1,1)}}case"solid":{const r=ys(s.region);if(r===null)break;return{op:"solid",region:r,material:i("glass"),T:n}}case"beaker":return{op:"beaker",x:mt(s.x,.1),y:mt(s.y,0),w:wt(mt(s.w,.07),.01,1),h:wt(mt(s.h,.09),.01,1),wall:wt(mt(s.wall,.002),5e-4,.02),material:i("glass"),T:n,lid:s.lid===!0};case"hotplate":return{op:"hotplate",x:mt(s.x,.1),y:mt(s.y,0),w:wt(mt(s.w,.12),.005,1),h:wt(mt(s.h,.008),.002,.1),material:i("steel"),T:n,mode:s.mode==="thermostat"?"thermostat":"power",power:wt(mt(s.power,40),0,2e3),target:pt+wt(mt(s.target,150),0,600),on:s.on!==!1}}return t.push(`ops[${e}]: not understood (${String(s.op)})`),null}function dn(l,t={}){const e=Te(l),s=[];e.format!==void 0&&e.format!==On&&s.push(`format "${String(e.format)}" is not ${On}`);const n=Te(e.box),i=Te(e.ambient),r=Te(i.air),a=Te(e.sides),o=mt(i.g,Qs),c=t.harness===!0?wt(o,0,un):wt(o,hi,un);c!==o&&s.push(`ambient.g ${o} m/s² is outside ${hi.toFixed(2)}–${un.toFixed(2)}, using ${c.toFixed(2)}`);const f=mt(r.N2,.7676),u=mt(r.O2,.2324),d=f+u>0?f+u:1,g=[];return Array.isArray(e.ops)&&e.ops.forEach((h,v)=>{const m=Oo(h,s,v);m!==null&&g.push(m)}),{scene:{seed:Math.floor(mt(e.seed,1))>>>0,box:{w:wt(mt(n.w,.2),.02,.6),h:wt(mt(n.h,.15),.02,.4),depth:wt(mt(n.depth,.01),.002,.05)},ambient:{p:wt(mt(i.p,us/1e3),20,400)*1e3,T:pt+wt(mt(i.T,20),-20,100),rh:wt(mt(i.rh,.5),0,1),g:c,air:{N2:Math.max(0,f)/d,O2:Math.max(0,u)/d}},sides:{left:ws(a.left,"wall"),right:ws(a.right,"wall"),bottom:ws(a.bottom,"wall"),top:ws(a.top,"open")},quality:Mo(e.quality)?e.quality:"high",ops:g},warnings:s}}const ee=(l,t=6)=>Number(l.toFixed(t));function Bo(l){switch(l.op){case"fill":return{op:"fill",region:Fs(l.region),composition:{...l.composition},phase:l.phase,T:ee(l.T-pt,3)};case"erase":return{op:"erase",region:Fs(l.region)};case"move":return{op:"move",region:Fs(l.region),dx:ee(l.dx),dy:ee(l.dy)};case"solid":return{op:"solid",region:Fs(l.region),material:l.material,T:ee(l.T-pt,3)};case"beaker":return{op:"beaker",x:l.x,y:l.y,w:l.w,h:l.h,wall:l.wall,material:l.material,T:ee(l.T-pt,3),...l.lid?{lid:!0}:{}};case"hotplate":return{op:"hotplate",x:l.x,y:l.y,w:l.w,h:l.h,material:l.material,mode:l.mode,power:l.power,target:ee(l.target-pt,3),on:l.on,T:ee(l.T-pt,3)}}}function Ro(l){return{format:On,version:1,seed:l.seed,box:{...l.box},ambient:{p:ee(l.ambient.p/1e3,4),T:ee(l.ambient.T-pt,3),rh:l.ambient.rh,g:ee(l.ambient.g,4),air:{...l.ambient.air}},sides:{...l.sides},quality:l.quality,ops:l.ops.map(Bo)}}const jo=(l,t)=>({nx:0,ny:0,stride:2,h:1,pIdx:new Int32Array(4*t),pW:new Float32Array(4*t),ax:new Float64Array(l),ay:new Float64Array(l),gx:new Float64Array(l),gy:new Float64Array(l),dH:new Float64Array(l),dDx:new Float64Array(l),dDy:new Float64Array(l),gDx:new Float64Array(l),gDy:new Float64Array(l),eDx:new Float64Array(l),eDy:new Float64Array(l),area:new Float64Array(l),ox:new Float64Array(l),oy:new Float64Array(l),diag:new Float64Array(l),inv:new Float64Array(l),act:new Uint8Array(l),x:new Float64Array(l),b:new Float64Array(l),r:new Float64Array(l),band:new Int32Array(l),bandCount:0}),mi=24,qo=1,Eo=1,pi=24,gi=1,zt=(l,t)=>(l+2)*(t+2);function vi(l,t,e){let s=0;for(let n=0;n<e;n+=1)s+=l[n]*t[n];return s}function Vo(l,t,e,s,n,i){let r=0;for(let a=0;a<i;a+=1){l[a]+=n*e[a];const o=t[a]-n*s[a];t[a]=o,r+=o*o}return r}function Do(l,t,e,s){for(let n=0;n<s;n+=1)l[n]=t[n]+e*l[n]}class vt{constructor(t,e){p(this,"levels",[]);p(this,"depth",1);p(this,"xs");p(this,"bs");p(this,"p");p(this,"q");p(this,"zj");p(this,"rj");p(this,"nullId");p(this,"stack");p(this,"nullSum",new Float64Array(16));p(this,"nullCnt",new Float64Array(16));p(this,"nullCount",0);p(this,"system");p(this,"result",{iterations:0,residual:0,capped:!1});p(this,"pw",new Float64Array(4));p(this,"pi",new Int32Array(4));let s=t,n=e,i=0;for(;this.levels.push(jo(zt(s,n),i)),!(s*n<=mi||s<=2&&n<=2);)i=zt(s,n),s=Math.ceil(s/2),n=Math.ceil(n/2);const r=zt(t,e);this.xs=new Float64Array(r),this.bs=new Float64Array(r),this.p=new Float64Array(r),this.q=new Float64Array(r),this.zj=new Float64Array(r),this.rj=new Float64Array(r),this.nullId=new Int32Array(r),this.stack=new Int32Array(r);const a=this.levels[0],o=this.xs,c=this.bs;this.system={get nx(){return a.nx},get ny(){return a.ny},get stride(){return a.stride},ax:a.ax,ay:a.ay,dH:a.dH,dDx:a.dDx,dDy:a.dDy,act:a.act,x:o,b:c}}at(t,e){return t+1+(e+1)*this.levels[0].stride}begin(t,e){const s=this.levels[0];s.nx=t,s.ny=e,s.stride=t+2,s.h=1;const n=zt(t,e);return s.ax.fill(0,0,n),s.ay.fill(0,0,n),s.dH.fill(0,0,n),s.dDx.fill(0,0,n),s.dDy.fill(0,0,n),s.act.fill(0,0,n),this.bs.fill(0,0,n),this.xs.fill(0,0,n),this.system}static diagonal(t){const{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:o,dDy:c,diag:f,inv:u,act:d}=t;for(let g=1;g<=s;g+=1){let h=1+g*n;for(let v=1;v<=e;v+=1,h+=1){if(d[h]===0){f[h]=1,u[h]=1;continue}const m=a[h]+o[h]+c[h]+i[h]+i[h-1]+r[h]+r[h-n];if(!(m>0)){d[h]=0,f[h]=1,u[h]=1;continue}f[h]=m,u[h]=1/m}}}static apply(t,e,s){const{nx:n,ny:i,stride:r,ax:a,ay:o,diag:c}=t;for(let f=1;f<=i;f+=1){let u=1+f*r;for(let d=1;d<=n;d+=1,u+=1)s[u]=c[u]*e[u]-a[u]*e[u+1]-a[u-1]*e[u-1]-o[u]*e[u+r]-o[u-r]*e[u-r]}}static color(t,e){const{nx:s,ny:n,stride:i,ax:r,ay:a,inv:o,x:c,b:f}=t;for(let u=1;u<=n;u+=1){let d=1+(1+u+e&1)+u*i;const g=s+u*i;for(;d<=g;d+=2)c[d]=(f[d]+r[d]*c[d+1]+r[d-1]*c[d-1]+a[d]*c[d+i]+a[d-i]*c[d-i])*o[d]}}static findBand(t){const{nx:e,ny:s,stride:n,act:i,dDx:r,dDy:a,band:o}=t;let c=0;for(let f=1;f<=s;f+=1){let u=1+f*n;for(let d=1;d<=e;d+=1,u+=1)i[u]!==0&&(i[u-1]===0||i[u+1]===0||i[u-n]===0||i[u+n]===0||r[u]>0||a[u]>0)&&(o[c++]=u)}t.bandCount=c}static bandSweep(t,e){const{stride:s,ax:n,ay:i,inv:r,x:a,b:o,band:c,bandCount:f}=t;for(let u=e>0?0:f-1;e>0?u<f:u>=0;u+=e){const d=c[u];a[d]=(o[d]+n[d]*a[d+1]+n[d-1]*a[d-1]+i[d]*a[d+s]+i[d-s]*a[d-s])*r[d]}}prepareFine(){const t=this.levels[0],e=zt(t.nx,t.ny);for(let s=0;s<e;s+=1){if(t.act[s]===0){t.gx[s]=0,t.gy[s]=0,t.gDx[s]=0,t.gDy[s]=0,t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=0,t.ox[s]=0,t.oy[s]=0;continue}t.gx[s]=t.ax[s],t.gy[s]=t.ay[s],t.gDx[s]=.5*t.dDx[s],t.gDy[s]=.5*t.dDy[s],t.eDx[s]=.5,t.eDy[s]=.5,t.area[s]=1,t.ox[s]=0,t.oy[s]=0}}coarsen(){this.depth=1;for(let t=1;t<this.levels.length;t+=1){const e=this.levels[t-1];if(e.nx*e.ny<=mi||e.nx<=2&&e.ny<=2)break;const s=this.levels[t],n=Math.ceil(e.nx/2),i=Math.ceil(e.ny/2);s.nx=n,s.ny=i,s.stride=n+2,s.h=2*e.h;const r=zt(n,i);s.ax.fill(0,0,r),s.ay.fill(0,0,r),s.gx.fill(0,0,r),s.gy.fill(0,0,r),s.act.fill(0,0,r),s.area.fill(0,0,r);const a=e.stride,o=e.h,c=s.h;for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const d=u+1+(f+1)*s.stride;let g=0,h=0,v=0,m=0;for(let _=0;_<2;_+=1){const A=2*f+_;if(!(A>=e.ny))for(let C=0;C<2;C+=1){const L=2*u+C;if(L>=e.nx)continue;const R=L+1+(A+1)*a;if(e.act[R]===0)continue;const E=e.area[R];g+=E,h+=E*((C-.5)*o+e.ox[R]*o),v+=E*((_-.5)*o+e.oy[R]*o),m+=e.dH[R]}}if(g<=0){s.act[d]=0,s.dH[d]=0,s.dDx[d]=0,s.dDy[d]=0,s.gDx[d]=0,s.gDy[d]=0,s.ox[d]=0,s.oy[d]=0;continue}s.act[d]=1,s.area[d]=g/4;const x=h/g,F=v/g;s.ox[d]=x/c,s.oy[d]=F/c,s.dH[d]=m;let y=0,w=0,b=0,P=0;for(let _=0;_<2;_+=1){const A=2*f+_;if(!(A>=e.ny))for(let C=0;C<2;C+=1){const L=2*u+C;if(L>=e.nx)continue;const R=L+1+(A+1)*a;if(e.act[R]!==0){if(e.gDx[R]>0){const E=(C-.5)*o+e.ox[R]*o;y+=e.gDx[R],w+=e.gDx[R]/(e.eDx[R]+Math.abs(E-x))}if(e.gDy[R]>0){const E=(_-.5)*o+e.oy[R]*o;b+=e.gDy[R],P+=e.gDy[R]/(e.eDy[R]+Math.abs(E-F))}}}}s.gDx[d]=y,s.gDy[d]=b,s.dDx[d]=w,s.dDy[d]=P,s.eDx[d]=w>0?y/w:.5*c,s.eDy[d]=P>0?b/P:.5*c}for(let f=0;f<i;f+=1)for(let u=0;u<n;u+=1){const d=u+1+(f+1)*s.stride;if(s.act[d]!==0){if(u+1<n&&s.act[d+1]!==0){const g=2*u+1;let h=0;if(g+1<e.nx)for(let v=0;v<2;v+=1){const m=2*f+v;m>=e.ny||(h+=e.gx[g+1+(m+1)*a])}if(h>0){const v=c*(1+s.ox[d+1]-s.ox[d]);s.gx[d]=h,s.ax[d]=h/Math.max(.25*c,v)}}if(f+1<i&&s.act[d+s.stride]!==0){const g=2*f+1;let h=0;if(g+1<e.ny)for(let v=0;v<2;v+=1){const m=2*u+v;m>=e.nx||(h+=e.gy[m+1+(g+1)*a])}if(h>0){const v=c*(1+s.oy[d+s.stride]-s.oy[d]);s.gy[d]=h,s.ay[d]=h/Math.max(.25*c,v)}}}}vt.diagonal(s),vt.findBand(s);for(let f=0;f<e.ny;f+=1){let u=1+(f+1)*a;for(let d=0;d<e.nx;d+=1,u+=1){if(e.act[u]===0){s.pW[4*u]=0,s.pW[4*u+1]=0,s.pW[4*u+2]=0,s.pW[4*u+3]=0,s.pIdx[4*u]=0,s.pIdx[4*u+1]=0,s.pIdx[4*u+2]=0,s.pIdx[4*u+3]=0;continue}vt.weights(s,d,f,e.dDx[u]+e.dDy[u]>0,this.pw,this.pi);for(let g=0;g<4;g+=1)s.pIdx[4*u+g]=this.pi[g],s.pW[4*u+g]=this.pw[g]}}this.depth=t+1}}static weights(t,e,s,n,i,r){const a=e>>1,o=s>>1,c=(e&1)===1?1:-1,f=(s&1)===1?1:-1,u=t.stride,d=a+1+(o+1)*u;r[0]=d,r[1]=d+c,r[2]=d+f*u,r[3]=d+c+f*u;const g=a+c>=0&&a+c<t.nx,h=o+f>=0&&o+f<t.ny;i[1]=g&&t.act[r[1]]!==0?3/16:0,i[2]=h&&t.act[r[2]]!==0?3/16:0,i[3]=g&&h&&t.act[r[3]]!==0?1/16:0,t.act[d]===0?i[0]=0:i[0]=n?9/16:1-i[1]-i[2]-i[3]}vcycle(t){const e=this.levels[t];if(t===this.depth-1){for(let g=0;g<pi;g+=1)vt.color(e,0),vt.color(e,1);for(let g=0;g<pi;g+=1)vt.color(e,1),vt.color(e,0);return}for(let g=0;g<qo;g+=1)vt.color(e,0),vt.color(e,1);for(let g=0;g<gi;g+=1)vt.bandSweep(e,1);vt.apply(e,e.x,e.r);const s=this.levels[t+1];s.b.fill(0,0,zt(s.nx,s.ny)),s.x.fill(0,0,zt(s.nx,s.ny));const{stride:n,act:i,b:r,r:a,x:o}=e,{pIdx:c,pW:f}=s,u=s.b,d=s.x;for(let g=0;g<e.ny;g+=1){let h=1+(g+1)*n;for(let v=0;v<e.nx;v+=1,h+=1){if(i[h]===0)continue;const m=r[h]-a[h],x=4*h;u[c[x]]+=f[x]*m,u[c[x+1]]+=f[x+1]*m,u[c[x+2]]+=f[x+2]*m,u[c[x+3]]+=f[x+3]*m}}this.vcycle(t+1);for(let g=0;g<e.ny;g+=1){let h=1+(g+1)*n;for(let v=0;v<e.nx;v+=1,h+=1){if(i[h]===0)continue;const m=4*h;o[h]+=f[m]*d[c[m]]+f[m+1]*d[c[m+1]]+f[m+2]*d[c[m+2]]+f[m+3]*d[c[m+3]]}}for(let g=0;g<gi;g+=1)vt.bandSweep(e,-1);for(let g=0;g<Eo;g+=1)vt.color(e,1),vt.color(e,0)}findNull(){const t=this.levels[0],{nx:e,ny:s,stride:n,ax:i,ay:r,dH:a,dDx:o,dDy:c,act:f}=t,u=this.nullId,d=zt(e,s);let g=!1;for(let h=0;h<d;h+=1)if(f[h]!==0&&!(a[h]>0)){g=!0;break}if(!g){this.nullCount=0;return}u.fill(-2,0,d),this.nullCount=0;for(let h=1;h<=s;h+=1)for(let v=1;v<=e;v+=1){const m=v+h*n;if(f[m]===0||u[m]!==-2)continue;let x=0,F=0,y=!1;const w=-3-this.nullCount;this.stack[x++]=m,u[m]=w;let b=m,P=m;for(;x>0;){const A=this.stack[--x];F+=1,A<b&&(b=A),A>P&&(P=A),(a[A]>0||o[A]>0||c[A]>0)&&(y=!0),i[A]>0&&u[A+1]===-2&&(u[A+1]=w,this.stack[x++]=A+1),i[A-1]>0&&u[A-1]===-2&&(u[A-1]=w,this.stack[x++]=A-1),r[A]>0&&u[A+n]===-2&&(u[A+n]=w,this.stack[x++]=A+n),r[A-n]>0&&u[A-n]===-2&&(u[A-n]=w,this.stack[x++]=A-n)}let _=-1;if(!y){if(_=this.nullCount,_>=this.nullSum.length){const A=C=>{const L=new Float64Array(2*C.length);return L.set(C),L};this.nullSum=A(this.nullSum),this.nullCnt=A(this.nullCnt)}this.nullCnt[_]=F,this.nullCount+=1}for(let A=b;A<=P;A+=1)u[A]===w&&(u[A]=_)}}project(t){if(this.nullCount===0)return;const e=this.levels[0],s=zt(e.nx,e.ny),n=this.nullId;this.nullSum.fill(0,0,this.nullCount);for(let i=0;i<s;i+=1)n[i]>=0&&(this.nullSum[n[i]]+=t[i]);for(let i=0;i<this.nullCount;i+=1)this.nullSum[i]/=this.nullCnt[i];for(let i=0;i<s;i+=1)n[i]>=0&&(t[i]-=this.nullSum[n[i]])}nullRegions(){return this.nullCount}solve(t,e,s){const n=this.result,i=this.levels[0],r=zt(i.nx,i.ny),{act:a}=i,o=this.xs,c=this.bs,f=i.stride;for(let b=0;b<r;b+=1){if(a[b]===0){o[b]=0,c[b]=0,i.ax[b]=0,i.ay[b]=0;continue}(b+1>=r||a[b+1]===0)&&(i.ax[b]=0),(b+f>=r||a[b+f]===0)&&(i.ay[b]=0)}vt.diagonal(i);for(let b=0;b<r;b+=1)a[b]===0&&(o[b]=0,c[b]=0);this.findNull(),this.project(c),s&&(vt.findBand(i),this.prepareFine(),this.coarsen());const u=s?i.b:this.rj,d=s?i.x:this.zj,{p:g,q:h}=this;h.fill(0,0,r),g.fill(0,0,r),d.fill(0,0,r),vt.apply(i,o,h);let v=0,m=0;for(let b=0;b<r;b+=1){const P=a[b]===0?0:c[b]-h[b];u[b]=P,v+=c[b]*c[b],m+=P*P}this.project(u);const x=Math.sqrt(v);if(x===0)return o.fill(0,0,r),n.iterations=0,n.residual=0,n.capped=!1,n;let F=Math.sqrt(m)/x;if(F<=t)return n.iterations=0,n.residual=F,n.capped=!1,n;this.precondition(s,u,d,r);let y=0;for(let b=0;b<r;b+=1)g[b]=d[b],y+=u[b]*d[b];let w=0;for(;w<e;){w+=1,vt.apply(i,g,h);const b=vi(g,h,r);if(!(b>0))break;const P=y/b;if(m=Vo(o,u,g,h,P,r),F=Math.sqrt(m)/x,F<=t)break;this.precondition(s,u,d,r);const _=vi(u,d,r),A=_/y;y=_,Do(g,d,A,r)}this.project(o);for(let b=0;b<r;b+=1)a[b]===0&&(o[b]=0);return n.iterations=w,n.residual=F,n.capped=F>t,n}precondition(t,e,s,n){if(t)s.fill(0,0,n),this.vcycle(0);else{const i=this.levels[0].inv;for(let r=0;r<n;r+=1)s[r]=e[r]*i[r]}this.project(s)}}const Io=["inputs","liquid","gas","bubbles","interface","heat","chemistry","diagnostics"],Se=Io.length,xi=1/120;class Go{constructor(t,e={}){p(this,"scene");p(this,"options");p(this,"warnings",[]);p(this,"grid");p(this,"particles");p(this,"bubbles");p(this,"liquid");p(this,"gas");p(this,"regions");p(this,"heat");p(this,"bubbleModel");p(this,"phase");p(this,"solver");p(this,"prevKind");p(this,"p0Start",new Float64Array(8));p(this,"rng");p(this,"time",0);p(this,"steps",0);p(this,"dt",xi);p(this,"gy",9.81);p(this,"ambientY",new Float64Array(rt));p(this,"ambientT",293.15);p(this,"pRef",101325);p(this,"ledger",{water:0,air:0,energy:0});p(this,"flows",li());p(this,"snap",lo());p(this,"energy0",0);p(this,"water0",0);p(this,"cappedCount",0);p(this,"vapourRate",0);p(this,"vapourLast",0);p(this,"timings",new Float64Array(Se));p(this,"stamp",new Float64Array(Se+1));p(this,"stepMs",0);p(this,"quality","high");p(this,"heaterOps",new Map);this.options=e;const s=bi(t)?t:dn(t,e).scene;this.scene={...s,ops:[]},this.build(s)}get tol(){return this.options.tol??1e-5}get dtMax(){return this.options.dtMax??xi}get maxIter(){return this.options.maxIter??60}get dx(){return this.grid.dx}get boxW(){return this.grid.w}get boxH(){return this.grid.h}get currentQuality(){return this.quality}get baseline(){return{energy0:this.energy0,water0:this.water0}}get optionsUsed(){return this.options}build(t){let e=So[t.quality];this.quality=t.quality;let s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e));for(;s*n>Lo;)e*=1.25,s=Math.max(4,Math.round(t.box.w/e)),n=Math.max(4,Math.round(t.box.h/e)),this.warnings.push(`too many cells for "${t.quality}", using ${(e*1e3).toFixed(2)} mm`);const i=new xo(s,n,e,t.box.depth);i.openL=t.sides.left==="open",i.openR=t.sides.right==="open",i.openB=t.sides.bottom==="open",i.openT=t.sides.top==="open",this.grid=i,this.particles=new Po(Math.max(4096,4*i.n+1024)),this.bubbles=new Pr(4096),this.solver=new vt(s,n),this.regions=new ko(i),this.liquid=new _o(i,this.particles,this.solver),this.gas=new vo(i,this.regions,this.solver),this.heat=new yo(i,this.particles,this.liquid,this.gas,this.solver),this.bubbleModel=new ao(this),this.phase=new To(this),this.prevKind=new Uint8Array(i.n),this.rng=new fr(t.seed),this.time=0,this.steps=0,this.dt=this.dtMax,this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.flows=li(),this.heaterOps.clear(),this.setAmbientState(t.ambient.p,t.ambient.T,t.ambient.rh,t.ambient.g,t.ambient.air.N2,t.ambient.air.O2),this.options.insulated===!0&&(this.heat.hExt=0),i.updateStatic(),this.regions.label();for(let r=0;r<this.regions.count;r+=1)this.regions.p0[r]=this.pRef,this.regions.rhoBar[r]=this.regions.rhoAmb;for(let r=0;r<i.n;r+=1)i.kind[r]=I,this.gas.fillCell(r,this.ambientT,this.ambientY);this.bubbleModel.rebuildSites();for(const r of t.ops)this.apply(r);this.settle(),this.ledger.water=0,this.ledger.air=0,this.ledger.energy=0,this.measureBudget(),this.energy0=this.snap.energy,this.water0=this.snap.water.total}settle(){const{grid:t,liquid:e}=this;e.computeWeights(),e.splatVolume(),e.classify(),this.prevKind.set(t.kind),this.regions.update(this.particles,this.bubbles),this.gas.deriveAll(),e.computeHeatWeights();for(let s=0;s<t.n;s+=1)t.solid[s]!==0&&this.heat.deriveSolid(s);this.heat.countHeaters()}setAmbientState(t,e,s,n,i,r){this.pRef=t,this.ambientT=e,this.gy=n;const a=i+r>0?i+r:1,o=(i>0?i:Kr)/a,c=(r>0||i>0?r:zr)/a,f=1/(o/lt[tt]+c/lt[et]),u=Math.min(.99,s*Is(e)/t),d=u*lt[K]/(u*lt[K]+(1-u)*f);this.ambientY.fill(0),this.ambientY[tt]=(1-d)*o,this.ambientY[et]=(1-d)*c,this.ambientY[K]=d;let g=0;for(let h=0;h<ut;h+=1)g+=this.ambientY[h]/lt[h];this.regions.pAmb=t,this.regions.rhoAmb=t/(Bt*e*g),this.regions.gy=n,this.gas.setAmbient(e,t,this.ambientY),this.heat.ambientT=e}world(){return{grid:this.grid,particles:this.particles,bubbles:this.bubbles,gas:this.gas,heat:this.heat,liquid:this.liquid,ambientY:this.ambientY,ambientT:this.ambientT,ledger:this.ledger,solidsChanged:()=>this.solidsChanged()}}solidsChanged(){this.grid.updateStatic(),this.regions.label();for(let t=0;t<this.regions.count;t+=1)this.regions.open[t]!==0&&(this.regions.p0[t]=this.pRef);this.bubbleModel.rebuildSites(),this.liquid.weightsDirty=!0}apply(t){if(t.op==="fill"&&t.phase==="liquid"&&!this.surfaceAfterFill(t))return"refused: the liquid would have no free surface (no pressure law for a region filled with liquid in M1)";const e=this.regions.pvTerm(),s=uo(this.world(),t);return t.op==="hotplate"&&this.heaterOps.set(this.heat.heaters.length-1,this.scene.ops.length),this.scene={...this.scene,ops:[...this.scene.ops,t]},this.settle(),this.ledger.energy+=this.regions.pvTerm()-e,s!==null&&this.warnings.push(s),s}surfaceAfterFill(t){const e=this.grid,{nx:s,ny:n}=e,i=new Uint8Array(e.n);for(let o=0;o<n;o+=1)for(let c=0;c<s;c+=1){const f=c+o*s;e.solid[f]===0&&(e.kind[f]===ct||Be(t.region,(c+.5)*e.dx,(o+.5)*e.dx))&&(i[f]=1)}const r=new Uint8Array(e.n),a=[];for(let o=0;o<e.n;o+=1){if(i[o]===0||r[o]!==0)continue;let c=!1;for(a.push(o),r[o]=1;a.length>0;){const f=a.pop(),u=f%s,d=(f-u)/s,g=[u>0?f-1:-1,u<s-1?f+1:-1,d>0?f-s:-1,d<n-1?f+s:-1];(u===0&&e.openL||u===s-1&&e.openR||d===0&&e.openB||d===n-1&&e.openT)&&(c=!0);for(const h of g)if(!(h<0||e.solid[h]!==0)){if(i[h]===0){c=!0;continue}r[h]===0&&(r[h]=1,a.push(h))}}if(!c)return!1}return!0}setHeater(t,e,s,n,i){const r=this.heat.heaters[t];if(r===void 0)return;r.mode=e,r.power=Math.max(0,s),r.target=n,r.on=i;const a=this.heaterOps.get(t),o=a===void 0?void 0:this.scene.ops[a];if(a!==void 0&&o!==void 0&&o.op==="hotplate"){const c=[...this.scene.ops];c[a]={...o,mode:e,power:r.power,target:n,on:i},this.scene={...this.scene,ops:c}}}setAmbient(t,e,s,n,i){const r=this.options.harness===!0?n:Math.min(19.6133,Math.max(2.4516625,n)),a=i!==void 0&&i.N2>=0&&i.O2>=0&&i.N2+i.O2>0?{N2:i.N2/(i.N2+i.O2),O2:i.O2/(i.N2+i.O2)}:this.scene.ambient.air;this.scene={...this.scene,ambient:{...this.scene.ambient,p:t,T:e,rh:s,g:r,air:a}},this.setAmbientState(t,e,s,r,a.N2,a.O2)}setBoundary(t,e){const s=this.regions.pvTerm();this.scene={...this.scene,sides:{...this.scene.sides,[t]:e}};const n=this.grid;t==="left"&&(n.openL=e==="open"),t==="right"&&(n.openR=e==="open"),t==="bottom"&&(n.openB=e==="open"),t==="top"&&(n.openT=e==="open"),this.solidsChanged(),this.settle(),this.ledger.energy+=this.regions.pvTerm()-s}serialize(){return Ro({...this.scene,quality:this.quality,seed:this.scene.seed})}load(t){const e=bi(t)?t:dn(t,this.options).scene;this.scene={...e,ops:[]},this.build(e)}setQuality(t){const e=dn(this.serialize(),this.options).scene;this.load({...e,quality:t})}step(){const{grid:t,liquid:e,gas:s,regions:n,heat:i,particles:r,bubbles:a}=this,o=this.dt,c=this.stamp;c[0]=ie(),c[1]=ie(),e.splatVolumeChange(o),e.weightsDirty&&e.computeWeights(),e.splatVolume(),this.prevKind.set(t.kind),e.classify(this.prevKind),s.transitions(this.prevKind),n.update(r,a),this.p0Start.length<n.count&&(this.p0Start=new Float64Array(2*n.count));for(let h=0;h<n.count;h+=1)this.p0Start[h]=n.p0[h];for(let h=0;h<t.n;h+=1)e.pGas[h]=t.kind[h]===I?n.pAt(h)-this.pRef:0;e.step(o,this.gy,this.tol,this.maxIter),e.computeHeatWeights(),this.flows.escapedWater+=e.last.escapedMass,this.flows.escapedEnergy+=e.last.escapedEnergy,c[2]=ie(),s.updateVolumes(),s.markFaces();const f=s.escaped[K]+s.escaped[ut],u=s.escaped[tt]+s.escaped[et],d=s.escaped[ut+1];s.transport(o),this.flows.escapedWater+=s.escaped[K]+s.escaped[ut]-f,this.flows.escapedAir+=s.escaped[tt]+s.escaped[et]-u,this.flows.escapedEnergy+=s.escaped[ut+1]-d,s.updateEos(),s.veosMid.set(s.veos),s.velocity(o,this.gy),s.sources(o),s.project(o,this.tol,this.maxIter),c[3]=ie(),this.bubbleModel.step(o),c[4]=ie(),this.phase.step(o),c[5]=ie(),i.step(o,1e-6,200),this.flows.heater+=i.last.heater,this.flows.lossWalls+=i.last.lossWalls,this.flows.lossOpen+=i.last.lossOpen,c[6]=ie(),c[7]=ie(),n.update(r,a),s.compressionHeating(this.p0Start),this.pressureWork(),s.updateEos();for(let h=0;h<t.n;h+=1)s.srcV[h]=t.kind[h]===I?s.veos[h]-s.veosMid[h]:0;e.last.solve.capped&&(this.cappedCount+=1),s.last.solve.capped&&(this.cappedCount+=1),i.last.solve.capped&&(this.cappedCount+=1),this.time+=o,this.steps+=1,this.dt=Math.min(this.dtMax,e.last.uMax>0?.9*t.dx/e.last.uMax:this.dtMax),c[8]=ie();const g=this.steps<5?1:1/30;for(let h=0;h<Se;h+=1)this.timings[h]+=g*(c[h+1]-c[h]-this.timings[h]);this.stepMs+=g*(c[Se]-c[0]-this.stepMs)}pressureWork(){const{grid:t,regions:e,particles:s,bubbles:n,gas:i,liquid:r}=this;let a=!1;for(let o=0;o<e.count;o+=1)i.dp0[o]!==0&&(a=!0);if(a){for(let o=0;o<s.count;o+=1){const c=t.cellAt(s.x[o],s.y[o]),f=c<0?-1:e.id[c];if(f<0||i.dp0[f]===0)continue;const u=s.mass[o],d=u/s.rho[o];s.h[o]+=d*i.dp0[f]/u,s.derive(o),r.dVp[o]+=u/s.rho[o]-d}for(let o=0;o<n.count;o+=1){const c=t.cellAt(n.x[o],n.y[o]),f=c<0?-1:e.id[c];f>=0&&i.dp0[f]!==0&&(n.H[o]+=n.V[o]*i.dp0[f])}}}measureBudget(){const t=this.flows;return t.editEnergy=this.ledger.energy,t.editWater=this.ledger.water,t.editAir=this.ledger.air,co(this.grid,this.particles,this.bubbles,this.regions,this.flows,this.snap)}energyError(){const t=this.measureBudget(),e=this.flows;return t.energy-this.energy0-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+e.editEnergy)}waterError(){return this.measureBudget().water.total-this.water0-this.flows.editWater}waterTemperature(){const t=this.particles;let e=0,s=0,n=0;for(let i=0;i<t.count;i+=1)e+=t.mass[i],s+=t.mass[i]*t.T[i],t.T[i]>n&&(n=t.T[i]);return{mean:e>0?s/e:0,max:n,mass:e}}pressureAt(t){const e=this.grid;return e.kind[t]===ct?this.pRef+e.pl[t]:e.kind[t]===I?this.regions.pAt(t)+e.pg[t]:this.regions.pAt(t)}query(t,e){const s=this.grid,n=s.cellAt(t,e);if(n<0)return null;const i=s.n,r=s.kind[n]===ft?"solid":s.kind[n]===ct?"liquid":"gas",a=this.pressureAt(n);let o=0;const c=[0,0,0];for(let P=0;P<ut;P+=1)c[P]=s.mg[P*i+n]/lt[P],o+=c[P];for(let P=0;P<ut;P+=1)c[P]=o>0?c[P]/o:0;const f=r==="liquid"&&s.Cl[n]>0?s.Tl[n]:s.T[n],u=r==="gas"?c[K]*a:0,d=Math.floor(t/s.dx),g=Math.floor(e/s.dx),h=r==="liquid"?.5*(s.ul[d+g*(s.nx+1)]+s.ul[d+1+g*(s.nx+1)]):.5*(s.ug[d+g*(s.nx+1)]+s.ug[d+1+g*(s.nx+1)]),v=r==="liquid"?.5*(s.vl[d+g*s.nx]+s.vl[d+(g+1)*s.nx]):.5*(s.vg[d+g*s.nx]+s.vg[d+(g+1)*s.nx]),m=this.particles;let x=-1,F=(1.5*s.dx)**2;for(let P=0;P<m.count;P+=1){const _=(m.x[P]-t)**2+(m.y[P]-e)**2;_<F&&(F=_,x=P)}const y=this.bubbles;let w=-1,b=1/0;for(let P=0;P<y.count;P+=1){const _=Math.hypot(y.x[P]-t,y.y[P]-e);_<=Math.max(y.r[P],3*s.dx)&&_<b&&(w=P,b=_)}return{x:t,y:e,cell:{kind:r,material:s.solid[n]!==0?Rt[s.solid[n]-1].id:null,T:f,p:a,Tsat:yt(a),x:c,rh:r==="gas"?u/Is(s.T[n]):0,fog:r==="gas"?s.mfog[n]/Math.max(1e-12,this.gas.vgas[n]):0,rho:r==="gas"?this.gas.rho[n]:r==="liquid"?this.liquid.rhoRef:s.solid[n]!==0?Rt[s.solid[n]-1].rho:0,phi:s.phi[n],u:h,v,heater:s.role[n]===1,film:s.film[n]},particle:x<0?null:{id:m.id[x],T:m.T[x],vx:m.vx[x],vy:m.vy[x],mass:m.mass[x],rho:m.rho[x],dist:Math.sqrt(F)},bubble:w<0?null:this.bubbleModel.describe(w)}}stats(){const t=this.grid;let e=0,s=0;for(let d=0;d<t.n;d+=1)t.kind[d]===ct?e+=1:t.kind[d]===I&&(s+=1);const n=this.waterTemperature(),i=this.measureBudget(),r=this.flows,a=i.energy-this.energy0-(r.heater-r.lossWalls-r.lossOpen-r.escapedEnergy+r.editEnergy),o=i.water.total-this.water0-r.editWater,c=this.phase.produced+this.bubbleModel.burstVapour,f=this.time-this.vapourLast;f>.2&&(this.vapourRate=(c-this.phase.producedMark)/f,this.phase.producedMark=c,this.vapourLast=this.time);const u=[];for(let d=0;d<this.regions.count;d+=1)u.push({p0:this.regions.p0[d],sealed:this.regions.open[d]===0,vGas:this.regions.vGas[d]});return{time:this.time,dt:this.dt,steps:this.steps,nx:t.nx,ny:t.ny,dx:t.dx,quality:this.quality,particles:this.particles.count,capacity:this.particles.cap,bubbles:this.bubbles.count,liquidCells:e,gasCells:s,stages:Array.from(this.timings),stepMs:this.stepMs,liquid:{...this.liquid.last.solve},gas:{...this.gas.last.solve},heat:{...this.heat.last.solve},gasSubsteps:this.gas.last.substeps,capped:this.cappedCount,waterT:n.mean,waterTmax:n.max,heaters:this.heat.heaters.filter(d=>d.cells>0).map(d=>({group:d.group,P:d.P,Tmean:d.Tmean,mode:d.mode,power:d.power,target:d.target,on:d.on})),regions:u,budget:{...i,water:{...i.water}},flows:{...r},energyError:a,waterError:o,vapourRate:this.vapourRate,ambientT:this.ambientT,ambientP:this.pRef,g:this.gy}}}const ie=()=>typeof performance<"u"?performance.now():Date.now();function bi(l){return l!==null&&typeof l=="object"&&"box"in l&&"ops"in l&&"quality"in l&&"sides"in l&&"ambient"in l&&typeof l.ambient.p=="number"&&l.ambient.p>1e3}class dr{constructor(t){p(this,"g");p(this,"last",null);p(this,"latent0",0);p(this,"stored0",0);p(this,"started",!1);this.g=t}vapour(){const t=this.g.totals;return t.produced-t.condensed+t.burstVapour}sample(){const t=this.g,e=t.last;if(e===null)return null;const s=t.totals,n=yt(t.cpu.regions.pAmb),i=Vr(n),r=t.budget(),a={t:s.time,heater:s.heater,solids:r.solids,sens:e.sensible,SG:s.fluxSG,LG:s.fluxLG,lossS:s.lossSolids,bub:r.bubbles,vap:this.vapour()},o=this.last;let c=0,f=0;if(o!==null&&a.t>o.t){const g=a.t-o.t,h=(a.heater-o.heater)/g,v=(a.solids-o.solids+a.SG-o.SG+a.lossS-o.lossS+a.LG-o.LG+a.sens-o.sens+a.bub-o.bub)/g;c=(a.vap-o.vap)/g,f=Math.max(0,(h-v)/i)}this.last=a;const u=this.vapour()*i,d=r.energy;return this.started||(this.started=!0,this.latent0=u,this.stored0=d),{t:s.time,waterT:e.waterT,waterTmax:e.waterTmax,Tsat:n,heater:s.heater,latent:u-this.latent0,sensible:d-this.stored0-(u-this.latent0),losses:s.lossWalls+s.lossOpen,escaped:s.escapedEnergy,liquid:r.water.liquid,vapour:r.water.vapour,fog:r.water.fog,film:r.water.film,bubbles:r.water.bubbles,escapedWater:r.water.escaped,vapourRate:c,expectedRate:f}}}const We={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Xe=16,U={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72},Me=96,yi=16,No=57,Ot={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},se=16,Uo={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Bn=8,Tt={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},Yt=8,Ho={TSUM:0,CELLS:1},Rn=2,$o={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},hr=16,Y={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54},hn=55,Pe={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},mn=6,jn={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12},pn=13,ce={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15},gn=16,Wo={KNOWN:0,MARK:1,MARK2:2,GAS:3},Fi=4,Ko={F:0},vn=1,zo={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},qn=12,qt=(l,t)=>Object.entries(t).map(([e,s])=>`const ${l}${e}: u32 = ${s}u;`).join(`
`),Qo=[qt("G_",We),qt("C_",U),qt("R_",Ot),qt("RA_",Uo),qt("H_",Tt),qt("HA_",Ho),qt("S_",$o),qt("F_",Y),qt("U_",Pe),qt("A_",jn),qt("FF_",ce),qt("FU_",Wo),qt("AF_",Ko),qt("BA_",zo),`const RACC_STRIDE: u32 = ${Bn}u;`,`const HEAT_STRIDE: u32 = ${Yt}u;`,`const HACC_STRIDE: u32 = ${Rn}u;`,`const CGS_STRIDE: u32 = ${hr}u;`,`const BACC_STRIDE: u32 = ${qn}u;`].join(`
`);function Z(l){if(!Number.isFinite(l))throw new Error(`not a finite constant: ${l}`);const t=Math.abs(l)>=1e-4&&Math.abs(l)<1e7?String(l):l.toExponential(9);return/[.eE]/.test(t)?t:`${t}.0`}const Lt=l=>l.map(Z).join(", "),bt=Mt.species[0],_s=Mt.species[1],Ps=Mt.species[2],Le=bt.liquid.cp.table,ue=Le.map(l=>l[0]),Oe=Le.map(l=>l[1]),Us=[Oe[0]*(ue[0]-pt)];for(let l=1;l<Le.length;l+=1)Us.push(Us[l-1]+.5*(Oe[l]+Oe[l-1])*(ue[l]-ue[l-1]));const[Xo,Yo,Jo]=bt.vapour.cp.linear,En=pt+100,Zo=(()=>{let l=0;for(;l<ue.length-2&&En>=ue[l+1];)l+=1;const t=En-ue[l],e=(Oe[l+1]-Oe[l])/(ue[l+1]-ue[l]);return Us[l]+Oe[l]*t+.5*e*t*t})(),ta=Zo+bt.saturation.hlv100.v,re=Mt.solids,xn=4294967295,ea=`
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
}`,wi=44,sa=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
}`,qe=26,na=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Ee=29,ia=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,bn=8,ra=`
struct Level {
  nx: u32, ny: u32, stride: u32, size: u32,
  ax: u32, ay: u32, dH: u32, dDx: u32,
  dDy: u32, diag: u32, inv: u32, x: u32,
  b: u32, h: u32, gx: u32, gy: u32,
  gDx: u32, gDy: u32, eDx: u32, eDy: u32,
  area: u32, ox: u32, oy: u32, act: u32,
  pIdx: u32, pW: u32, lv: u32, pad0: u32,
  pad1: u32, pad2: u32, pad3: u32, pad4: u32,
}
struct LevelPair { F: Level, C: Level }
struct Iter { k: u32, p0: u32, p1: u32, p2: u32 }
struct SolveCfg { tolsq: f32, it: u32, cap: u32, res: u32 }
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,oa=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${Z(pt)};
const R_GAS: f32 = ${Z(Bt)};
const P_ATM: f32 = ${Z(us)};
const G0: f32 = ${Z(Qs)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${Z(_s.molarMass.v)};
const M_O2: f32 = ${Z(Ps.molarMass.v)};
const M_H2O: f32 = ${Z(bt.molarMass.v)};
const CP_N2: f32 = ${Z(_s.gas.cp.v)};
const CP_O2: f32 = ${Z(Ps.gas.cp.v)};
const CPV0: f32 = ${Z(Xo)};
const CPV1: f32 = ${Z(Yo)};
const CPV_T: f32 = ${Z(Jo)};
const T100: f32 = ${Z(En)};
const HV100: f32 = ${Z(ta)};
const NCP: i32 = ${Le.length};
const CP_T = array<f32, ${Le.length}>(${Lt(ue)});
const CP_V = array<f32, ${Le.length}>(${Lt(Oe)});
const CP_H = array<f32, ${Le.length}>(${Lt(Us)});
const KELL = array<f32, 7>(${Lt(bt.liquid.kell.c)});
const KL = array<f32, 3>(${Lt(bt.liquid.k.poly)});
const VA: f32 = ${Z(bt.liquid.mu.vogel[0])};
const VB: f32 = ${Z(bt.liquid.mu.vogel[1])};
const VC: f32 = ${Z(bt.liquid.mu.vogel[2])};
const ST_B: f32 = ${Z(bt.surfaceTension.B)};
const ST_b: f32 = ${Z(bt.surfaceTension.b)};
const ST_MU: f32 = ${Z(bt.surfaceTension.mu)};
const T_CRIT: f32 = ${Z(bt.saturation.Tc.v)};
const RHO_CRIT: f32 = ${Z(bt.saturation.rhoc.v)};
const N97 = array<f32, 10>(${Lt(bt.saturation.if97.n)});
const RVC = array<f32, 6>(${Lt(bt.saturation.vapourDensity.c)});
const KV: f32 = ${Z(bt.vapour.k.v)};
const MUV: f32 = ${Z(bt.vapour.mu.v)};
const KN = array<f32, 3>(${Lt(_s.gas.k.power)});
const KO = array<f32, 3>(${Lt(Ps.gas.k.power)});
const MN = array<f32, 3>(${Lt(_s.gas.mu.sutherland)});
const MO = array<f32, 3>(${Lt(Ps.gas.mu.sutherland)});
const DV0: f32 = ${Z(Mt.vapourInAir.D0.v)};
const DVT0: f32 = ${Z(Mt.vapourInAir.T0.v)};
const DVE: f32 = ${Z(Mt.vapourInAir.exponent.v)};
const NSOL: u32 = ${re.length}u;
const S_RHO = array<f32, ${re.length}>(${Lt(re.map(l=>l.rho.v))});
const S_CP = array<f32, ${re.length}>(${Lt(re.map(l=>l.cp.v))});
const S_K = array<f32, ${re.length}>(${Lt(re.map(l=>l.k.v))});
const S_THETA = array<f32, ${re.length}>(${Lt(re.map(l=>l.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${Z(lr)};
const REG_STRIDE: u32 = ${se}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${Z(Ji)};
`,aa=`
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
`,ca=`
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
`,Qn=[ea,sa,na,ia,ra,oa,Qo,aa,ca].join(`
`);class la{constructor(t){p(this,"name");p(this,"binds");p(this,"wg");p(this,"source");p(this,"pipeline",null);p(this,"layout",null);this.name=t.name,this.wg=t.wg??128,this.binds=ua(t.bind),this.source=ma(t,this.binds,this.wg)}}const fa={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function ua(l){return l.trim().split(/\s+/).filter(Boolean).map(t=>{const e=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(t);if(e===null)throw new Error(`bad binding "${t}"`);const s=e[2],n=e[3]??(s==="u"?"Params":s==="a"?"atomic<u32>":fa[e[1]]??"f32");return{name:e[1],mode:s,type:n}})}const da=`
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
`,ha=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function ma(l,t,e){const s=[Qn,`const WG: u32 = ${e}u;`,da],n=new Set(t.map(i=>i.name));for(const i of t)i.mode==="a"&&n.add(`${i.name}!`);for(const i of ha)i.needs.every(r=>n.has(r))&&s.push(i.code);return t.forEach((i,r)=>{i.mode==="u"?s.push(`@group(0) @binding(${r}) var<uniform> ${i.name}: ${i.type};`):i.mode==="t"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_storage_2d<rgba8unorm, write>;`):i.mode==="x"?s.push(`@group(0) @binding(${r}) var ${i.name}: texture_2d<f32>;`):i.mode==="s"?s.push(`@group(0) @binding(${r}) var ${i.name}: sampler;`):i.mode==="r"?s.push(`@group(0) @binding(${r}) var<storage, read> ${i.name}: array<${i.type}>;`):i.mode==="w"?s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<${i.type}>;`):(s.push(`@group(0) @binding(${r}) var<storage, read_write> ${i.name}: array<atomic<u32>>;`),s.push(`fn addF_${i.name}(i: u32, v: f32) {
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
fn maxU_${i.name}(i: u32, v: f32) { atomicMax(&${i.name}[i], bitcast<u32>(max(v, 0.0))); }`))}),s.push(l.code),s.join(`
`)}class Xn{constructor(t){p(this,"device");p(this,"kernels",new Map);p(this,"timestamps");p(this,"bufs",[]);p(this,"profiler",null);this.device=t,this.timestamps=t.features.has("timestamp-query")}static async create(){const t=navigator.gpu;if(t===void 0)throw new Error("WebGPU is not available");const e=await t.requestAdapter({powerPreference:"high-performance"});if(e===null)throw new Error("no WebGPU adapter");const s=[];e.features.has("timestamp-query")&&s.push("timestamp-query");const n=e.limits,i=await e.requestDevice({requiredFeatures:s,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,n.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:n.maxStorageBufferBindingSize,maxBufferSize:n.maxBufferSize,maxComputeWorkgroupStorageSize:n.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,n.maxComputeInvocationsPerWorkgroup)}});return new Xn(i)}async compile(t){const e=[];return await Promise.all(t.map(async s=>{const n=new la(s);this.kernels.set(s.name,n);const i=this.device.createShaderModule({code:n.source,label:s.name}),a=(await i.getCompilationInfo()).messages.filter(c=>c.type==="error");if(a.length>0){const c=n.source.split(`
`);for(const f of a)e.push(`${s.name}:${f.lineNum}:${f.linePos} ${f.message}
    ${c[f.lineNum-1]??""}`);return}const o=this.device.createBindGroupLayout({label:s.name,entries:n.binds.map((c,f)=>c.mode==="t"?{binding:f,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:c.mode==="x"?{binding:f,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:c.mode==="s"?{binding:f,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:f,visibility:GPUShaderStage.COMPUTE,buffer:{type:c.mode==="u"?"uniform":c.mode==="r"?"read-only-storage":"storage"}})});n.layout=o;try{n.pipeline=await this.device.createComputePipelineAsync({label:s.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:i,entryPoint:"main"}})}catch(c){e.push(`${s.name}: ${c instanceof Error?c.message:String(c)}`)}})),e}kernel(t){const e=this.kernels.get(t);if(e===void 0||e.pipeline===null)throw new Error(`kernel ${t} not compiled`);return e}bind(t,e){const s=this.kernel(t);return this.device.createBindGroup({label:t,layout:s.layout,entries:s.binds.map((n,i)=>{const r=e[n.name];if(r===void 0)throw new Error(`kernel ${t}: no resource for "${n.name}"`);return"view"in r?{binding:i,resource:r.view}:"sampler"in r?{binding:i,resource:r.sampler}:{binding:i,resource:"buffer"in r?{buffer:r.buffer,offset:r.offset,size:r.size}:{buffer:r}}})})}own(t,e){const s=this.profiler;if(s===null)return t;const n=2*s.names.length;return s.names.push(e),s.enc.beginComputePass({timestampWrites:{querySet:s.qs,beginningOfPassWriteIndex:n,endOfPassWriteIndex:n+1}})}dispatch(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroups(Math.max(1,Math.ceil(n/i.wg))),r!==t&&r.end()}dispatchIndirect(t,e,s,n){const i=this.kernel(e),r=this.own(t,e);r.setPipeline(i.pipeline),r.setBindGroup(0,s),r.dispatchWorkgroupsIndirect(n,0),r!==t&&r.end()}dispatchOne(t,e,s){const n=this.kernel(e),i=this.own(t,e);i.setPipeline(n.pipeline),i.setBindGroup(0,s),i.dispatchWorkgroups(1),i!==t&&i.end()}buffer(t,e,s=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const n=this.device.createBuffer({label:t,size:Math.max(16,Math.ceil(e/16)*16),usage:s});return this.bufs.push(n),n}uniform(t,e){const s=this.buffer(t,e.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(s,0,e),s}release(t){const e=new Set(t);for(const s of t)s.destroy();for(let s=this.bufs.length-1;s>=0;s-=1)e.has(this.bufs[s])&&this.bufs.splice(s,1)}destroy(){for(const t of this.bufs)t.destroy();this.bufs.length=0,this.device.destroy()}}const _i=64,Pi="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",ls=`
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
`,mr=`
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
`,pa=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  return FRITZ * theta * sqrt(sigmaW(B.Tb) / (P.gy * (rhoL(Tl) - rhov)));
}
`,ga=`
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
`,va=[{name:"bubNucleate",wg:_i,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${ls}
${Pi} {
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
}`},{name:"bubAdvance",wg:_i,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${ls}
${mr}
${pa}
${ga}
${Pi} {
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
}`}],Ve=64,he="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",xa=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,ba=[{name:"bubTarget",wg:Ve,bind:"P:u cnt:a bubs:r btarget:w",code:`${he} {
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
}`},{name:"bubMerge",wg:Ve,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${he} {
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
}`},{name:"bubMergeFinal",wg:Ve,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${ls}
${he} {
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
}`},{name:"bubFinish",wg:Ve,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${ls}
${mr}
${xa}
${he} {
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
${he} {
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
}`},{name:"bubCopyBack",wg:Ve,bind:"P:u cnt:a bubs:w bubs2:r",code:`${he} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:Ve,bind:"P:u cnt:a bubs:r at:a",code:`${ls}
${he} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${he} {
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
}`}],le=128,Qt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Hs=`
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
`,Ai=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,yn=`
var<workgroup> rr: array<f32, ${16*le}>;
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
`,ya=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([l,t])=>({name:l,wg:le,bind:"P:u cf:w cu:r at:w reg:r",code:`${Hs}
${Qt} {
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
}`})),{name:"transitions",wg:le,bind:"P:u cf:r cu:r at:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${Qt} {
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
}`},{name:"regCells",wg:le,bind:"P:u cf:r cu:r racc:a",code:`${yn}
${Qt} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${yn}
${Qt} {
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
}`},{name:"regBubs",wg:le,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${Qt} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([l,t])=>({name:l,wg:64,bind:"P:u reg:w racc:a",code:`${Ai}
${Qt} {
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
}`})),{name:"compSums",wg:le,bind:"P:u cf:r cu:r reg:r racc:a",code:`${yn}
${Qt} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([l,t])=>({name:l,wg:64,bind:"P:u reg:w racc:a",code:`${Ai}
${Qt} {
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
}`})),{name:"compApply",wg:le,bind:"P:u cf:w cu:r reg:r",code:`${Hs}
${Qt} {
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
}`},{name:"gasVolumes",wg:le,bind:"P:u cf:w cu:r reg:r",code:`${Qt} {
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
}`},{name:"markFaces",wg:le,bind:"P:u cu:r ff:w fu:w",code:`${Qt} {
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
}`}],As=128,Fe=128,Dt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Kt=`
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
`,Ti=`
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
`,Fa=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,ki=1,wa=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${Dt} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${ki}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${Dt} {
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
${Dt} {
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
    pargs[0] = max(1u, (total + ${As-1}u) / ${As}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${Dt} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:Fe,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${Kt}
${Fa}
${Dt} {
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
}`},{name:"classify",wg:Fe,bind:"P:u cf:r cu:w",code:`${Dt} {
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
}`},{name:"p2g",wg:Fe,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Ti}
${Dt} {
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
}`},{name:"liqAssemble",wg:Fe,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${Dt} {
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
}`},{name:"liqPressure",wg:Fe,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${Dt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:Fe,bind:"P:u glob:r cf:r ff:w fu:w",code:`${Dt} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([l,t,e,s,n,i])=>({name:l,wg:Fe,bind:"P:u ff:w fu:w",code:`${Dt} {
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
}`})),{name:"g2p",wg:As,bind:"P:u glob:r cnt:a cf:r ff:r parts:w",code:`${Ti}
${Kt}
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
${Dt} {
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
      q.flags = q.flags | ${ki}u;
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
}`},{name:"heatWeights",wg:As,bind:"P:u cnt:a cu:r parts:w",code:`${Kt}
${Dt} {
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
}`}],oe=128,ae="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Si=`
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
`,Mi=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,Li=`
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
`,_a=[{name:"gasMaxOut",wg:oe,bind:"P:u cu:r ff:r cnt:a",code:`${Kt}
${ae} {
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
}`},{name:"gasFlux",wg:oe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Si}
${Mi}
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
${ae} {
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
}`},{name:"gasMove",wg:oe,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Si}
${Mi}
${Kt}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${ae} {
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
}`},{name:"macFwd",wg:oe,bind:"P:u glob:r ff:w fu:r",code:`${Li}
${ae} {
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
}`},{name:"macBack",wg:oe,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${Li}
${ae} {
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
}`},{name:"viscosity",wg:oe,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${ae} {
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
}`},{name:"gasAssemble",wg:oe,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${ae} {
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
}`},{name:"gasPressure",wg:oe,bind:"P:u cf:w cu:r cgv:r",code:`${ae} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:oe,bind:"P:u glob:r cf:r ff:w fu:r",code:`${ae} {
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
}`}],It=128,Gt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ke=`
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
`,Pa=`
fn ysat(T: f32, p: f32, c: u32) -> f32 {
  let x = min(0.999, pSat(T) / p);
  let mN = cf[F_MN * P.n + c];
  let mO = cf[F_MO * P.n + c];
  let dry = mN + mO;
  var mDry = 0.02885;
  if (dry > 0.0) { mDry = dry / (mN / M_N2 + mO / M_O2); }
  return x * M_H2O / (x * M_H2O + (1.0 - x) * mDry);
}
`,Aa=[...[["gatherFull",!0],["gatherPlain",!1]].map(([l,t])=>({name:l,wg:It,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Ke}
${Gt} {
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
}`})),{name:"applyMass",wg:It,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ke}
${Kt}
${Gt} {
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
}`},{name:"diffPrep",wg:It,bind:"P:u cf:w cu:w reg:r",code:`${Gt} {
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
}`},{name:"diffAssemble",wg:It,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${Pa}
${Gt} {
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
}`},{name:"diffFaces",wg:It,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Gt} {
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
}`},{name:"diffApply",wg:It,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${Kt}
${Gt} {
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
}`},{name:"latentSrc",wg:It,bind:"P:u glob:r cf:r at:a",code:`${Gt} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0 || !(acc > 0.0)) { return; }
  let hbar = cf[F_ACCH * n + c] / acc;
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`},{name:"flashTs",wg:It,bind:"P:u cf:w cu:r reg:r",code:`${Gt} {
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
}`},{name:"flashVap",wg:It,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Ke}
${Gt} {
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
}`},{name:"flashParts",wg:It,bind:"P:u cnt:a cf:r parts:w",code:`${Ke}
${Gt} {
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
}`},{name:"flashDist",wg:It,bind:"P:u cnt:a cf:r cu:r at:a",code:`${Kt}
${Gt} {
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
}`},{name:"fog",wg:It,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Hs}
${Kt}
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
${Gt} {
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
}`},{name:"films",wg:It,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${Gt} {
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
}`}],$e=800,Ta=24,Ci=6,Pt=4,Ye=16,Ct=256,Oi=`struct Levels { lv: array<Level, ${Ye}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,ps=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Bs=`${ps}
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
`,fe=`
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
`,we=`
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
`,Bi=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Ri=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,gt="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",me=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,pr=6,De=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,Fn=`
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
`,wn="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",ka=[{name:"cgPrep1",wg:Ct,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${ps}
${gt} {
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
}`},{name:"cgPrep2",wg:Ct,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${me}
${Bs}
${gt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${pr}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:Ct,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${gt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:Ct,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${me}
${Fn}
${De}
${gt} {
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
}`},{name:"cclProject",wg:Ct,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${me}
${wn}
${De}
${gt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:Ct,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${me}
${ps}
${we}
${gt} {
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
}`},{name:"cgFoldInitMG",wg:Ct,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${we}
${Ri}
${gt} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${me}
${fe}
${we}
${Bi}
${gt} {
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
}`},{name:"cgB",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${me}
${fe}
${we}
${Bi}
var<workgroup> wpq: f32;
${gt} {
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
}`},{name:"cgFoldRR",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${fe}
${we}
${Ri}
${gt} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${fe}
${we}
${gt} {
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
}`},{name:"cgZSum",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${fe}
${Fn}
${De}
${gt} {
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
}`},{name:"cgZSub",wg:Ct,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${fe}
${wn}
${De}
${we}
${gt} {
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
}`},{name:"cgEnd1",wg:Ct,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${me}
${Fn}
${De}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${gt} {
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
}`},{name:"cgEnd2",wg:Ct,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${me}
${wn}
${De}
${gt} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Sa=["ax","ay","dH","dDx","dDy","diag","inv","x","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function Ma(l,t){const e=[];let s=0,n=0,i=l,r=t,a=1,o=0;for(;;){const f=i+2,u=(i+2)*(r+2),d={};for(const v of Sa)d[v]=s,s+=u;const g=n;n+=u;let h=0;if(d.pW=0,e.length>0&&(d.pW=s,s+=4*o,h=n,n+=4*o),e.push({nx:i,ny:r,stride:f,size:u,h:a,f:d,act:g,pIdx:h}),i*r<=Ta||i<=2&&r<=2||e.length>=Ye)break;o=u,i=Math.ceil(i/2),r=Math.ceil(r/2),a*=2}let c=e.length-1;for(let f=0;f<e.length;f+=1){let u=0;for(let d=f;d<e.length;d+=1)u+=e[d].size;if(u<=$e){c=f;break}}return{levels:e,fSize:s,uSize:n,lt:c}}function Ts(l,t,e,s){if(l===null)return;const n=[l.nx,l.ny,l.stride,l.size,l.f.ax,l.f.ay,l.f.dH,l.f.dDx,l.f.dDy,l.f.diag,l.f.inv,l.f.x,l.f.b,l.h,l.f.gx,l.f.gy,l.f.gDx,l.f.gDy,l.f.eDx,l.f.eDy,l.f.area,l.f.ox,l.f.oy,l.act,l.pIdx,l.f.pW,t,0,0,0,0,0];e.set(n,s)}const gr={tol:1e-5,it:U.IT_L,cap:U.CAP_L,res:U.RES_L},vr={tol:1e-5,it:U.IT_G,cap:U.CAP_G,res:U.RES_G},xr={tol:1e-5,it:U.IT_H,cap:U.CAP_H,res:U.RES_H},br={tol:1e-5,it:U.IT_D,cap:U.CAP_D,res:U.RES_H},Ie=200,Xt=256;class La{constructor(t,e,s){p(this,"ctx");p(this,"plan");p(this,"b");p(this,"l0");p(this,"lp");p(this,"lv");p(this,"it");p(this,"cfg");p(this,"kinds",[]);p(this,"groups",new Map);p(this,"n0cells");this.ctx=t,this.plan=e,this.b=s;const n=e.levels;this.n0cells=n[0].nx*n[0].ny;const i=new Uint32Array(32);Ts(n[0],0,i,0),this.l0=t.uniform("l0",i.buffer);const r=new Uint32Array(Xt/4*n.length);for(let c=0;c<n.length;c+=1)Ts(c>0?n[c-1]:null,c-1,r,Xt/4*c),Ts(n[c],c,r,Xt/4*c+32);this.lp=t.uniform("lp",r.buffer);const a=new Uint32Array(32*Ye+4);for(let c=0;c<n.length;c+=1)Ts(n[c],c,a,32*c);a[32*Ye]=e.lt,a[32*Ye+1]=n.length,this.lv=t.uniform("lv",a.buffer);const o=new Uint32Array(Xt/4*(Ie+1));for(let c=0;c<Ie;c+=1)o[Xt/4*c]=c;o[Xt/4*Ie]=4294967295,this.it=t.uniform("iter",o.buffer),this.cfg=t.uniform("solvecfg",new ArrayBuffer(Xt*4));for(const c of[gr,vr,xr,br])this.setKind(c)}get levels(){return this.plan.levels.length}get level0(){return this.l0}setKind(t){let e=this.kinds.indexOf(t);if(e>=0)return e;e=this.kinds.length,this.kinds.push(t);const s=new ArrayBuffer(16);return new Float32Array(s,0,1)[0]=t.tol*t.tol,new Uint32Array(s,4,3).set([t.it,t.cap,t.res]),this.ctx.device.queue.writeBuffer(this.cfg,Xt*e,s),e}setTolerance(t,e){const s=this.setKind(t);this.ctx.device.queue.writeBuffer(this.cfg,Xt*s,new Float32Array([e*e]))}range(t,e,s){return{buffer:t,offset:Xt*e,size:s}}group(t,e,s){const n=`${t}|${e}`;let i=this.groups.get(n);if(i===void 0){const r=this.b;i=this.ctx.bind(t,{P:r.params,mgF:r.mgF,mgU:r.mgU,cgv:r.cgv,cgs:r.cgs,lab:r.lab,cfl:r.cfl,csum:r.csum,cnt:r.cnt,cgp:r.cgp,L:this.l0,LV:this.lv,...s}),this.groups.set(n,i)}return i}run(t,e,s,n="",i={}){this.ctx.dispatch(t,e,this.group(e,n,i),s)}one(t,e,s="",n={}){this.ctx.dispatchOne(t,e,this.group(e,s,n))}lpRes(t){return this.range(this.lp,t,Xt)}itRes(t){return this.range(this.it,t,16)}prepare(t,e,s){const n=this.setKind(e),i={SV:this.range(this.cfg,n,16)},r=this.n0cells;this.run(t,"cgPrep1",r,`c${n}`,i),this.run(t,"cgPrep2",r),s&&(this.run(t,"cclMerge",r),this.run(t,"cclFinal",r),this.run(t,"cclProject",r)),this.coarsen(t),this.run(t,"cgInitMG",r),this.ctx.dispatchOne(t,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(t){const{levels:e,lt:s}=this.plan;for(let n=1;n<e.length&&n<=s;n+=1){const i=e[n],r=e[n-1],a={LP:this.lpRes(n)};this.run(t,"mgC1",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC2",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC3",i.nx*i.ny,`l${n}`,a),this.run(t,"mgC4",r.nx*r.ny,`l${n}`,a)}s+1<e.length&&this.ctx.dispatchOne(t,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(t){const{levels:e,lt:s}=this.plan,n=r=>256*Math.ceil(r.nx/16)*Math.ceil(r.ny/16),i=r=>256*Math.ceil(r.nx/12)*Math.ceil(r.ny/12);for(let r=0;r<s;r+=1)this.run(t,r===0?"mgPreR0":"mgPreR",i(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)});this.ctx.dispatchOne(t,"mgTail",this.group("mgTail","",{}));for(let r=s-1;r>=0;r-=1)this.run(t,"mgPost",n(e[r]),`l${r+1}`,{LP:this.lpRes(r+1)})}encodeMG(t,e,s,n=!0,i=n){const r=this.n0cells;this.prepare(t,e,n);const a=(c,f)=>{const u={IT:this.itRes(c)};i?(this.run(t,"cgZSum",r,f,u),this.run(t,"cgZSub",r,f,u)):this.run(t,"cgRZ",r,f,u)};this.vcycle(t),a(Ie,`k${Ie}`);const o=Math.min(Ie,Math.max(1,s));for(let c=0;c<o;c+=1){const f={IT:this.itRes(c)};this.run(t,"cgA",r,`k${c}`,f),this.run(t,"cgB",r,`k${c}`,f),this.one(t,"cgFoldRR",`k${c}`,f),this.vcycle(t),a(c,`k${c}`)}this.finish(t,e,n)}finish(t,e,s){const n=this.setKind(e);this.run(t,"cgEnd1",this.n0cells,`c${n}`,{SV:this.range(this.cfg,n,16)}),s&&this.run(t,"cgEnd2",this.n0cells)}}const Je=16,ji=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;class Ca{constructor(t,e){p(this,"ctx");p(this,"d");p(this,"plan");p(this,"params");p(this,"glob");p(this,"cnt");p(this,"cf");p(this,"cu");p(this,"at");p(this,"ff");p(this,"fu");p(this,"af");p(this,"partsA");p(this,"partsB");p(this,"ccountA");p(this,"ccountB");p(this,"cstart");p(this,"bsum");p(this,"pkey");p(this,"pslot");p(this,"pargs");p(this,"bubs");p(this,"bubs2");p(this,"bacc");p(this,"btarget");p(this,"sites");p(this,"sbub");p(this,"reg");p(this,"racc");p(this,"heat");p(this,"hacc");p(this,"mgF");p(this,"mgU");p(this,"cgv");p(this,"cgs");p(this,"lab");p(this,"cfl");p(this,"csum");p(this,"cgp");p(this,"meas");p(this,"probe");p(this,"regionMap",new Int32Array(0));p(this,"regionInv",new Int32Array(0));p(this,"measGroups");p(this,"nsites",0);p(this,"own",[]);this.ctx=t;const s=e.grid,n=Math.max(1024,2*e.bubbleModel.cavities.count);this.d={nx:s.nx,ny:s.ny,n:s.n,nu:s.nu,nv:s.nv,nf:s.nu+s.nv,n0:(s.nx+2)*(s.ny+2),pcap:e.particles.cap,bcap:e.bubbles.cap,nsites:n,nreg:Math.max(64,2*e.regions.count),nheat:Math.max(16,2*e.heat.heaters.length)};const i=this.d;this.plan=Ma(s.nx,s.ny);const r=(o,c,f=ji)=>{const u=t.buffer(o,4*Math.max(4,c),f);return this.own.push(u),u};this.params=r("params",wi,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=r("glob",Xe),this.cnt=r("cnt",Me),this.cf=r("cf",hn*i.n),this.cu=r("cu",mn*i.n),this.at=r("at",pn*i.n),this.ff=r("ff",gn*i.nf),this.fu=r("fu",Fi*i.nf),this.af=r("af",vn*i.nf),this.partsA=r("partsA",qe*i.pcap),this.partsB=r("partsB",qe*i.pcap),this.ccountA=r("ccountA",i.n+4),this.ccountB=r("ccountB",i.n+4),this.cstart=r("cstart",i.n+4),this.bsum=r("bsum",Math.ceil(i.n/1024)+4),this.pkey=r("pkey",i.pcap),this.pslot=r("pslot",i.pcap),this.pargs=r("pargs",8,ji|GPUBufferUsage.INDIRECT),this.bubs=r("bubs",Ee*i.bcap),this.bubs2=r("bubs2",Ee*i.bcap),this.bacc=r("bacc",qn*i.bcap),this.btarget=r("btarget",i.bcap),this.sites=r("sites",bn*i.nsites),this.sbub=r("sbub",i.nsites),this.reg=r("reg",se*i.nreg),this.racc=r("racc",Bn*i.nreg),this.heat=r("heat",Yt*i.nheat),this.hacc=r("hacc",Rn*i.nheat),this.mgF=r("mgF",this.plan.fSize),this.mgU=r("mgU",this.plan.uSize),this.cgv=r("cgv",5*i.n0),this.cgs=r("cgs",hr),this.lab=r("lab",i.n0),this.cfl=r("cfl",i.n0),this.csum=r("csum",pr*i.n0),this.cgp=r("cgp",4*Math.ceil(i.nx*i.ny/256)+16);const a=256;this.measGroups=[Math.ceil(i.n/a),Math.ceil(i.pcap/a),Math.ceil(i.bcap/a)],this.meas=r("meas",Je*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=r("probe",64)}fits(t){const e=this.d;return t.grid.nx===e.nx&&t.grid.ny===e.ny&&t.particles.cap===e.pcap&&t.bubbles.cap===e.bcap&&t.bubbleModel.cavities.count<=e.nsites&&t.regions.count<=e.nreg&&t.heat.heaters.length<=e.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(t){const e=this.d,s=t.grid,n=new ArrayBuffer(4*wi),i=new Uint32Array(n),r=new Float32Array(n);i.set([e.nx,e.ny,e.n,e.nu,e.nv,e.nf,e.pcap,e.bcap,t.bubbleModel.cavities.count,t.regions.count,t.heat.heaters.length,e.n0],0),r.set([s.dx,s.depth,s.vCell,s.aFace,1/s.dx,s.w,s.h,t.dtMax],12),r.set([t.gy,t.pRef,t.regions.pAmb,t.regions.rhoAmb,t.ambientT,t.heat.hExt,t.tol,t.heat.liquidPower],20);const a=t.gas.amb;r.set([a[0],a[1],a[2],a[4]],28),r.set([t.ambientY[tt],t.ambientY[et],t.ambientY[K],yt(t.regions.pAmb)],32),i.set([s.openL?1:0,s.openR?1:0,s.openB?1:0,s.openT?1:0],36);let o=0;for(let c=0;c<t.regions.count;c+=1)t.regions.open[c]===0&&(o=1);i[40]=o,i[41]=t.optionsUsed.harness===!0?1:0,r[42]=t.bubbleModel.contactAngleOverride??-1,i[43]=0,this.ctx.device.queue.writeBuffer(this.params,0,n)}writeHeaters(t){const e=t.heat.heaters,s=new Float32Array(Yt*this.d.nheat);e.forEach((n,i)=>{const r=Yt*i;s[r+Tt.MODE]=n.mode==="thermostat"?1:0,s[r+Tt.POWER]=n.power,s[r+Tt.TARGET]=n.target,s[r+Tt.ON]=n.on?1:0,s[r+Tt.P]=n.P,s[r+Tt.TMEAN]=n.Tmean,s[r+Tt.INTEGRAL]=n.integral,s[r+Tt.CELLS]=n.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,s)}writeHeaterSettings(t,e){const s=t.heat.heaters[e];s===void 0||e>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*Yt*e,new Float32Array([s.mode==="thermostat"?1:0,s.power,s.target,s.on?1:0]))}upload(t){const e=this.ctx.device.queue,s=this.d,n=t.grid,i=s.n;this.writeParams(t),this.writeHeaters(t);const r=t.regions,a=Array.from({length:r.count},(S,H)=>H).sort((S,H)=>r.vFluid[H]-r.vFluid[S]);this.regionMap=new Int32Array(Math.max(1,r.count)),this.regionInv=new Int32Array(Math.max(1,r.count)),a.forEach((S,H)=>{this.regionMap[S]=H,this.regionInv[H]=S});const o=new Float32Array(se*s.nreg);for(let S=0;S<r.count;S+=1){const H=se*this.regionMap[S];o[H+Ot.OPEN]=r.open[S],o[H+Ot.VFLUID]=r.vFluid[S],o[H+Ot.P0]=r.p0[S],o[H+Ot.RHOBAR]=r.rhoBar[S],o[H+Ot.VLIQ]=r.vLiq[S],o[H+Ot.VBUB]=r.vBub[S],o[H+Ot.VGAS]=r.vGas[S],o[H+Ot.P0START]=r.p0[S]}e.writeBuffer(this.reg,0,o);const c=new Uint32Array(mn*i);for(let S=0;S<i;S+=1){c[Pe.KIND*i+S]=n.kind[S],c[Pe.KPREV*i+S]=n.kind[S],c[Pe.SOLID*i+S]=n.solid[S],c[Pe.HGRP*i+S]=n.role[S]===1&&n.heater[S]>=0?n.heater[S]+1:0;const H=r.id[S];c[Pe.RID*i+S]=H<0?xn:this.regionMap[H]}e.writeBuffer(this.cu,0,c);const f=new Float32Array(hn*i),u=(S,H,T=0)=>{for(let O=0;O<i;O+=1)f[S*i+O]=H[T+O]};u(Y.PHI,n.phi),u(Y.ALPHA,n.alpha),u(Y.ALPHAOLD,n.alpha),u(Y.PL,n.pl),u(Y.PG,n.pg),u(Y.MN,n.mg,tt*i),u(Y.MO,n.mg,et*i),u(Y.MV,n.mg,K*i),u(Y.MF,n.mfog),u(Y.HG,n.Hg),u(Y.ES,n.Es),u(Y.FILM,n.film),u(Y.T,n.T),u(Y.TL,n.Tl),u(Y.CL,n.Cl);const d=t.gas;u(Y.VGAS,d.vgas),u(Y.RHO,d.rho),u(Y.NMOL,d.nmol),u(Y.CAP,d.cap),u(Y.MU,d.mu),u(Y.VEOS,d.veos),u(Y.SRCV,d.srcV),u(Y.VEOSMID,d.veosMid),u(Y.PHIS,n.phiS),u(Y.SDF,n.sdf),u(Y.PTL,n.T),e.writeBuffer(this.cf,0,f);const g=new Float32Array(pn*i);for(let S=0;S<i;S+=1)g[jn.VOLSRC*i+S]=t.liquid.volSrc[S];e.writeBuffer(this.at,0,g);const h=s.nf,v=new Float32Array(gn*h);for(let S=0;S<s.nu;S+=1)v[ce.UL*h+S]=n.ul[S],v[ce.UG*h+S]=n.ug[S];for(let S=0;S<s.nv;S+=1)v[ce.UL*h+s.nu+S]=n.vl[S],v[ce.UG*h+s.nu+S]=n.vg[S];e.writeBuffer(this.ff,0,v),e.writeBuffer(this.fu,0,new Uint32Array(Fi*h));const m=new Float32Array(vn*h);for(let S=0;S<s.nu;S+=1)m[S]=t.liquid.fU[S];for(let S=0;S<s.nv;S+=1)m[s.nu+S]=t.liquid.fV[S];e.writeBuffer(this.af,0,m);const x=t.particles,F=t.liquid,y=new ArrayBuffer(4*qe*Math.max(1,x.count)),w=new Float32Array(y),b=new Uint32Array(y),P=new Int32Array(y);for(let S=0;S<x.count;S+=1){const H=qe*S;w.set([x.x[S],x.y[S],x.vx[S],x.vy[S],x.c00[S],x.c01[S],x.c10[S],x.c11[S],x.mass[S],x.h[S],x.T[S],x.rho[S],F.dVp[S]],H),b[H+13]=0,b[H+14]=x.id[S],P[H+15]=F.bi[S],P[H+16]=F.bj[S];for(let T=0;T<9;T+=1)w[H+17+T]=F.wt[9*S+T]}x.count>0&&e.writeBuffer(this.partsA,0,y);const _=t.bubbles,A=t.bubbleModel.motionState,C=new ArrayBuffer(4*Ee*Math.max(1,_.count)),L=new Float32Array(C),R=new Uint32Array(C),E=new Int32Array(C);for(let S=0;S<_.count;S+=1){const H=Ee*S,T=S*rt;L.set([_.x[S],_.y[S],_.z[S],_.vx[S],_.vy[S],_.m[T+tt],_.m[T+et],_.m[T+K],_.H[S],_.age[S]],H),E[H+10]=_.site[S],L.set([_.r[S],_.V[S],_.pb[S],_.pv[S],_.Tb[S],_.dmdt[S],A.ux0[S],A.uy0[S]],H+11),R[H+19]=_.id[S],R[H+20]=1;for(let O=0;O<$t;O+=1)L[H+21+O]=_.force[S*$t+O]}_.count>0&&e.writeBuffer(this.bubs,0,C);const J=t.bubbleModel.cavities;this.nsites=J.count;const G=new ArrayBuffer(4*bn*s.nsites),q=new Uint32Array(G),B=new Float32Array(G);for(let S=0;S<J.count;S+=1){const H=bn*S;q.set([J.cell[S],J.fluid[S],J.dir[S],0],H),B.set([J.r[S],J.s[S],J.z[S],0],H+4)}e.writeBuffer(this.sites,0,G);const D=new Uint32Array(s.nsites);for(let S=0;S<J.count;S+=1)D[S]=J.bubble[S];e.writeBuffer(this.sbub,0,D);const M=new Float32Array(Xe);M[We.DT]=t.dt,M[We.TIME]=t.time,M[We.RHOREF]=F.rhoRef,e.writeBuffer(this.glob,0,M);const j=new Uint32Array(Me),nt=new Float32Array(j.buffer);j[U.PCOUNT]=x.count,j[U.BCOUNT]=_.count,j[U.NEXTID_B]=Math.max(1,_.nextFree),j[U.NEXTID_P]=Math.max(1,x.nextFree);const W=t.bubbleModel;j[U.WATCH]=W.watch>=0?W.watch:xn,j[U.WATCH_FATE]=W.watchFate,W.firstSuperheat!==null&&(nt[U.FIRST_SH]=W.firstSuperheat+1e3,j[U.FIRST_MAT]=1),e.writeBuffer(this.cnt,0,j),e.writeBuffer(this.ccountA,0,new Uint32Array(s.n+4)),e.writeBuffer(this.ccountB,0,new Uint32Array(s.n+4)),e.writeBuffer(this.bacc,0,new Uint32Array(qn*s.bcap)),e.writeBuffer(this.racc,0,new Uint32Array(Bn*s.nreg)),e.writeBuffer(this.hacc,0,new Uint32Array(Rn*s.nheat))}async read(t){const e=this.ctx.device,s=t.map(f=>Math.ceil(f.size/4)*4),n=s.reduce((f,u)=>f+u,0),i=e.createBuffer({label:"read",size:Math.max(16,n),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();let a=0;t.forEach((f,u)=>{s[u]>0&&r.copyBufferToBuffer(f.buf,f.offset,i,a,s[u]),a+=s[u]}),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const o=i.getMappedRange().slice(0);i.unmap(),i.destroy();const c=[];a=0;for(const f of s)c.push(o.slice(a,a+f)),a+=f;return c}async download(t){const e=this.d,s=e.n,[n,i,r,a,o,c,f,u,d,g]=await this.read([{buf:this.cnt,offset:0,size:4*Me},{buf:this.glob,offset:0,size:4*Xe},{buf:this.cf,offset:0,size:4*hn*s},{buf:this.cu,offset:0,size:4*mn*s},{buf:this.at,offset:0,size:4*pn*s},{buf:this.ff,offset:0,size:4*gn*e.nf},{buf:this.af,offset:0,size:4*vn*e.nf},{buf:this.heat,offset:0,size:4*Yt*e.nheat},{buf:this.sbub,offset:0,size:4*e.nsites},{buf:this.reg,offset:0,size:4*se*e.nreg}]),h=new Uint32Array(n),v=Math.min(e.pcap,h[U.PCOUNT]),m=Math.min(e.bcap,h[U.BCOUNT]),[x,F]=await this.read([{buf:this.partsA,offset:0,size:4*qe*Math.max(1,v)},{buf:this.bubs,offset:0,size:4*Ee*Math.max(1,m)}]),y=t.grid,w=new Float32Array(r),b=(V,Q,$=0)=>{for(let ot=0;ot<s;ot+=1)Q[$+ot]=w[V*s+ot]};b(Y.PHI,y.phi),b(Y.ALPHA,y.alpha),b(Y.PL,y.pl),b(Y.PG,y.pg),b(Y.MN,y.mg,tt*s),b(Y.MO,y.mg,et*s),b(Y.MV,y.mg,K*s),b(Y.MF,y.mfog),b(Y.HG,y.Hg),b(Y.ES,y.Es),b(Y.FILM,y.film),b(Y.T,y.T),b(Y.TL,y.Tl),b(Y.CL,y.Cl);const P=t.gas;b(Y.VGAS,P.vgas),b(Y.RHO,P.rho),b(Y.NMOL,P.nmol),b(Y.CAP,P.cap),b(Y.MU,P.mu),b(Y.VEOS,P.veos),b(Y.SRCV,P.srcV),b(Y.VEOSMID,P.veosMid);const _=new Uint32Array(a);for(let V=0;V<s;V+=1)y.kind[V]=_[Pe.KIND*s+V];const A=new Float32Array(o);for(let V=0;V<s;V+=1)t.liquid.volSrc[V]=A[jn.VOLSRC*s+V];const C=new Float32Array(c),L=new Float32Array(f),R=e.nf;for(let V=0;V<e.nu;V+=1)y.ul[V]=C[ce.UL*R+V],y.ug[V]=C[ce.UG*R+V],t.liquid.fU[V]=L[V];for(let V=0;V<e.nv;V+=1)y.vl[V]=C[ce.UL*R+e.nu+V],y.vg[V]=C[ce.UG*R+e.nu+V],t.liquid.fV[V]=L[e.nu+V];const E=t.particles,J=t.liquid,G=new Float32Array(x),q=new Uint32Array(x),B=new Int32Array(x);let D=0,M=0;for(let V=0;V<v;V+=1){const Q=qe*V;if(q[Q+13]&1||!(G[Q+8]>0))continue;const $=D;D+=1,E.x[$]=G[Q],E.y[$]=G[Q+1],E.vx[$]=G[Q+2],E.vy[$]=G[Q+3],E.c00[$]=G[Q+4],E.c01[$]=G[Q+5],E.c10[$]=G[Q+6],E.c11[$]=G[Q+7],E.mass[$]=G[Q+8],E.h[$]=G[Q+9],E.spc[2*$]=0,E.spc[2*$+1]=0,E.smass[2*$]=0,E.smass[2*$+1]=0,E.mat[$]=0,E.id[$]=q[Q+14],E.id[$]>M&&(M=E.id[$]),J.dVp[$]=G[Q+12],J.bi[$]=B[Q+15],J.bj[$]=B[Q+16];for(let ot=0;ot<9;ot+=1)J.wt[9*$+ot]=G[Q+17+ot];E.derive($)}E.count=D,E.reserveIds(Math.max(h[U.NEXTID_P],M+1)),J.weightsDirty=!0;const j=t.bubbles,nt=t.bubbleModel.motionState,W=new Float32Array(F),S=new Uint32Array(F),H=new Int32Array(F);j.count=0;let T=0;for(let V=0;V<m;V+=1){const Q=Ee*V;if(S[Q+20]===0)continue;const $=j.count;j.count+=1;const ot=$*rt;j.x[$]=W[Q],j.y[$]=W[Q+1],j.z[$]=W[Q+2],j.vx[$]=W[Q+3],j.vy[$]=W[Q+4];for(let ht=0;ht<rt;ht+=1)j.m[ot+ht]=0;j.m[ot+tt]=W[Q+5],j.m[ot+et]=W[Q+6],j.m[ot+K]=W[Q+7],j.H[$]=W[Q+8],j.age[$]=W[Q+9],j.site[$]=H[Q+10],j.r[$]=W[Q+11],j.V[$]=W[Q+12],j.pb[$]=W[Q+13],j.pv[$]=W[Q+14],j.Tb[$]=W[Q+15],j.dmdt[$]=W[Q+16],nt.ux0[$]=W[Q+17],nt.uy0[$]=W[Q+18],j.id[$]=S[Q+19],j.id[$]>T&&(T=j.id[$]);for(let ht=0;ht<$t;ht+=1)j.force[$*$t+ht]=W[Q+21+ht]}j.reserveIds(Math.max(h[U.NEXTID_B],T+1));const O=t.bubbleModel.cavities,k=new Uint32Array(d);for(let V=0;V<O.count;V+=1)O.bubble[V]=k[V];const N=new Float32Array(g);for(let V=0;V<t.regions.count;V+=1){const Q=se*this.regionMap[V];t.regions.p0[V]=N[Q+Ot.P0],t.regions.rhoBar[V]=N[Q+Ot.RHOBAR]}const z=new Float32Array(u);t.heat.heaters.forEach((V,Q)=>{const $=Yt*Q;V.P=z[$+Tt.P],V.Tmean=z[$+Tt.TMEAN],V.integral=z[$+Tt.INTEGRAL]});const st=new Float32Array(i);t.dt=st[We.DT];const it=t.bubbleModel;it.watch=h[U.WATCH]===xn?-1:h[U.WATCH]}gpuRegion(t){return this.regionMap[t]??0}cpuRegion(t){return this.regionInv[t]??0}}const _e=128,Et="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Oa=5,qi=30,Ei=`
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
`,Ba=[{name:"heaterSums",wg:_e,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${Et} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${Et} {
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
        let kp = power / ${Oa}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${qi}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${qi}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:_e,bind:"P:u cnt:a parts:r",code:`${Kt}
${Et} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * cpL(q.T); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:_e,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Ke}
${Kt}
${Et} {
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
}`},{name:"heatAssemble",wg:_e,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Ei}
${Et} {
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
}`},{name:"heatFlux",wg:_e,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Ei}
${Hs}
${Kt}
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
${Et} {
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
}`},{name:"heatParts",wg:_e,bind:"P:u cnt:a cf:r parts:w",code:`${Ke}
${Et} {
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
}`},{name:"pwParts",wg:_e,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${Et} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${Et} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${Et} {
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
${Et} {
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
  if (lid < 8u) { meas[wid3.x * ${Je}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${4*256}>;
${Et} {
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
  if (lid < 4u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Je}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${Et} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Je}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${Et} {
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
}`}],Ge=256,Ra=[...[1,2,3].map(l=>({name:`mgC${l}`,wg:Ge,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Bs}
${gt} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${l===1?"coarsen1(LP.F, C, t);":l===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Ge,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Bs}
${gt} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Ge,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Oi}
${Bs}
${gt} {
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
}`},{name:"mgPost",wg:Ge,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${ps}
${fe}
const TILE: u32 = 16u;
const HALO: u32 = ${Pt}u;
const TS: u32 = ${16+2*Pt}u;
var<workgroup> sx: array<f32, ${(16+2*Pt)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Pt)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Pt)**2}>;
var<workgroup> say: array<f32, ${(16+2*Pt)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Pt)**2}>;
${gt} {
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
      x = mgF[L.x + s];
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
  for (var k = 0u; k < ${Pt}u; k++) {
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
}`},...[["mgPreR0",!0],["mgPreR",!1]].map(([l,t])=>({name:l,wg:Ge,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${ps}
${fe}
const TILE: u32 = 12u;
const HALO: u32 = ${Pt+2}u;
const TS: u32 = ${12+2*(Pt+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Pt+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Pt+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Pt+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Pt+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Pt+2))**2}>;
${gt} {
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
  for (var q = lid; q < TS * TS; q += WG) {
    let I = i0 + i32(q % TS);
    let J = j0 + i32(q / TS);
    var x = 0.0; var b = 0.0; var ax = 0.0; var ay = 0.0; var inv = 0.0;
    if (I >= -1 && J >= -1 && I <= i32(F.nx) && J <= i32(F.ny)) {
      let s = u32(I + 1) + u32(J + 1) * F.stride;
      ${t?"":"x = mgF[F.x + s];"}
      b = mgF[F.b + s]; ax = mgF[F.ax + s]; ay = mgF[F.ay + s]; inv = mgF[F.inv + s];
    }
    sx[q] = x; sb[q] = b; sax[q] = ax; say[q] = ay; sinv[q] = inv;
  }
  workgroupBarrier();
  for (var k = 0u; k < ${Pt}u; k++) {
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
  /* x der Kachel zurück; das Residuum b − A x (Diagonale = 1/inv) eine Zelle über die Kachel hinaus in sinv. */
  for (var q = lid; q < TILE * TILE; q += WG) {
    let a = q % TILE + HALO;
    let c = q / TILE + HALO;
    let I = i0 + i32(a);
    let J = j0 + i32(c);
    if (I < 0 || J < 0 || I >= i32(F.nx) || J >= i32(F.ny)) { continue; }
    mgF[F.x + u32(I + 1) + u32(J + 1) * F.stride] = sx[a + c * TS];
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
  /* Die 6 × 6 groben Zellen der Kachel: Σ pW r der feinen Zellen, die auf sie zeigen; x der groben Zelle 0. */
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
    mgF[C.x + sc] = 0.0;
  }
}`})),{name:"mgTail",wg:Ge,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Oi}
${fe}
var<workgroup> tx: array<f32, ${$e}>;
var<workgroup> tb: array<f32, ${$e}>;
var<workgroup> tax: array<f32, ${$e}>;
var<workgroup> tay: array<f32, ${$e}>;
var<workgroup> tinv: array<f32, ${$e}>;
var<workgroup> toff: array<u32, ${Ye}>;
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
${gt} {
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
  for (var k = 0u; k < ${Ci}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Ci}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],ks=[[68,1,84],[72,40,120],[62,74,137],[49,104,142],[38,130,142],[31,158,137],[53,183,121],[109,205,89],[180,222,44],[253,231,37]];function ja(l){const t=/^#?([0-9a-f]{6})$/i.exec(l.trim());if(t===null)return[128,128,128];const e=parseInt(t[1],16);return[e>>16&255,e>>8&255,e&255]}const Jt=[0,120],Ne=128,Ue="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",qa=.006,Ea={none:0,temperature:1,pressure:2,velocity:3,humidity:4,vapour:5,phase:6},Va=4*1e3*15e-7/(3*2*.07),Yn=`
const VIR = array<vec3<f32>, ${ks.length}>(${ks.map(l=>`vec3<f32>(${Z(l[0]/255)}, ${Z(l[1]/255)}, ${Z(l[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${Z(ks.length-1)};
  let i = min(u32(floor(x)), ${ks.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,_n="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }",Da=[{name:"rScale",wg:Ne,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${_n}
var<workgroup> m4: array<vec4<f32>, WG>;
${Ue} {
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
}`},{name:"rCells",wg:Ne,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${_n}
${Yn}
const SOLID_RGB = array<vec3<f32>, ${Rt.length}>(${Rt.map(l=>{const t=ja(l.color);return`vec3<f32>(${Z(t[0]/255)}, ${Z(t[1]/255)}, ${Z(t[2]/255)})`}).join(", ")});
${Ue} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${Z(Jt[0])};
  let tspan = ${Z(Jt[1]-Jt[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${Rt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${Z(Va)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Ne,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${Ue} {
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
}`},{name:"rLiqBlurX",wg:Ne,bind:"P:u lq:r lq2:w",code:`${Ue} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  lq2[2u * t] = 0.25 * lq[2u * l] + 0.5 * lq[2u * t] + 0.25 * lq[2u * r];
  lq2[2u * t + 1u] = 0.25 * lq[2u * l + 1u] + 0.5 * lq[2u * t + 1u] + 0.25 * lq[2u * r + 1u];
}`},{name:"rLiqBlurY",wg:Ne,bind:"P:u lq2:r liquid:t",code:`${Ue} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${Z(Jt[0])}) / ${Z(Jt[1]-Jt[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, 0.0, 1.0));
}`},{name:"rArrows",wg:Ne,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${_n}
${Ue} {
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
}`}],bs=`
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
`,Pn=`${bs}
${Yn}
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
`,Ia=`${bs}
@vertex fn vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4<f32> {
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u));
  return toClip(mix(R.rect.xy, R.rect.zw, corner));
}
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Ga=`${bs}
${(Qn.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> bubs: array<Bubble>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) air: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) b: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.air = 0.0;
  if (b >= min(cnt[${U.BCOUNT}u], R.bcount) || bubs[b].alive == 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
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
`,Na=`${bs}
${Yn}
${(Qn.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<storage, read> cnt: array<u32>;
struct VO { @builtin(position) pos: vec4<f32>, @location(0) local: vec2<f32>, @location(1) t: f32 }
@vertex fn vs(@builtin(vertex_index) v: u32, @builtin(instance_index) p: u32) -> VO {
  var o: VO;
  let corner = vec2<f32>(f32(v & 1u), f32((v >> 1u) & 1u)) * 2.0 - 1.0;
  o.local = corner;
  o.t = 0.0;
  if (p >= min(cnt[${U.PCOUNT}u], R.pcount) || (parts[p].flags & 1u) != 0u) { o.pos = vec4<f32>(2.0, 2.0, 0.0, 1.0); return o; }
  let c = toClip(vec2<f32>(parts[p].x, parts[p].y));
  o.pos = vec4<f32>(c.xy + corner * R.pointPx / R.canvas, 0.0, 1.0);
  o.t = clamp((parts[p].T - ${Z(273.15+Jt[0])}) / ${Z(Jt[1]-Jt[0])}, 0.0, 1.0);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4<f32> {
  if (dot(i.local, i.local) > 1.0) { discard; }
  return vec4<f32>(viridis(i.t) * 0.95, 0.95);
}
`,Ua=`${bs}
@vertex fn vs(@location(0) p: vec2<f32>) -> @builtin(position) vec4<f32> { return toClip(p); }
@fragment fn fs() -> @location(0) vec4<f32> { return vec4<f32>(R.fill.rgb * R.fill.a, R.fill.a); }
`,Vi=48,An=256,Ha=12;class $a{constructor(t,e){p(this,"gpu");p(this,"device");p(this,"context");p(this,"format");p(this,"rp");p(this,"ro");p(this,"sampLin");p(this,"sampNear");p(this,"pipes",{});p(this,"layouts",{});p(this,"size","");p(this,"cellsTex");p(this,"fieldTex");p(this,"liquidTex");p(this,"lq");p(this,"lq2");p(this,"arrows");p(this,"nArrows",0);p(this,"groups",new Map);p(this,"theme",{ground:[.93,.95,.97],outside:[.86,.88,.9],wall:[.42,.46,.5],ink:[.08,.1,.12]});p(this,"water",[.24,.56,.85]);p(this,"waterInk",[1,1,1]);p(this,"roData",new Uint32Array(4));var i;this.gpu=t,this.device=t.ctx.device;const s=globalThis.navigator;this.format=((i=s.gpu)==null?void 0:i.getPreferredCanvasFormat())??"bgra8unorm";const n=e.getContext("webgpu");if(n===null)throw new Error("no webgpu canvas context");this.context=n,this.context.configure({device:this.device,format:this.format,alphaMode:"opaque"}),this.rp=t.ctx.buffer("rp",An*Ha,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.ro=t.ctx.buffer("ro",16,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.sampLin=this.device.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),this.sampNear=this.device.createSampler({magFilter:"nearest",minFilter:"nearest",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"})}async init(){const t=this.device,e={color:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"},alpha:{srcFactor:"one",dstFactor:"one-minus-src-alpha",operation:"add"}},s=GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,n=g=>t.createBindGroupLayout({entries:g});this.layouts.quad=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"float"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"filtering"}}]),this.layouts.rect=n([{binding:0,visibility:s,buffer:{type:"uniform"}}]),this.layouts.store=n([{binding:0,visibility:s,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]);const i=async(g,h,v,m,x=[])=>{const F=t.createShaderModule({code:g}),w=(await F.getCompilationInfo()).messages.filter(b=>b.type==="error");if(w.length>0)throw new Error(`render WGSL: ${w.map(b=>`${b.lineNum}:${b.linePos} ${b.message}`).join(" | ")}`);return t.createRenderPipelineAsync({layout:t.createPipelineLayout({bindGroupLayouts:[v]}),vertex:{module:F,entryPoint:"vs",buffers:x},fragment:{module:F,entryPoint:h,targets:[{format:this.format,blend:e}]},primitive:{topology:m}})},[r,a,o,c,f,u,d]=await Promise.all([i(Pn,"fsCells",this.layouts.quad,"triangle-strip"),i(Pn,"fsField",this.layouts.quad,"triangle-strip"),i(Pn,"fsLiquid",this.layouts.quad,"triangle-strip"),i(Ia,"fs",this.layouts.rect,"triangle-strip"),i(Ga,"fs",this.layouts.store,"triangle-strip"),i(Na,"fs",this.layouts.store,"triangle-strip"),i(Ua,"fs",this.layouts.rect,"line-list",[{arrayStride:8,attributes:[{format:"float32x2",offset:0,shaderLocation:0}]}])]);this.pipes={cells:r,field:a,liquid:o,rect:c,disc:f,point:u,line:d}}ensure(){var f,u,d,g,h,v;const t=this.gpu.state,e=`${t.d.nx}x${t.d.ny}:${this.gpu.stateVersion}`;if(e===this.size)return;this.size=e,this.groups.clear();const s=this.device,n=(m,x)=>s.createTexture({size:[m,x],format:"rgba8unorm",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING});(f=this.cellsTex)==null||f.destroy(),(u=this.fieldTex)==null||u.destroy(),(d=this.liquidTex)==null||d.destroy(),this.cellsTex=n(t.d.nx,t.d.ny),this.fieldTex=n(t.d.nx,t.d.ny),this.liquidTex=n(2*t.d.nx,2*t.d.ny);const i=4*t.d.nx*t.d.ny;(g=this.lq)==null||g.destroy(),(h=this.lq2)==null||h.destroy(),(v=this.arrows)==null||v.destroy(),this.lq=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE}),this.lq2=s.createBuffer({size:4*2*i,usage:GPUBufferUsage.STORAGE});const r=Math.max(2,Math.round(qa/this.gpu.cpu.grid.dx)),a=r>>1,o=Math.max(1,Math.ceil((t.d.nx-a)/r)),c=Math.max(1,Math.ceil((t.d.ny-a)/r));this.nArrows=o*c,this.arrows=s.createBuffer({size:4*12*2*this.nArrows,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.VERTEX}),this.roData=new Uint32Array([0,r,o,c])}computeGroup(t,e){let s=this.groups.get(t);if(s===void 0){const n=this.gpu.state;s=this.gpu.ctx.bind(t,{P:n.params,RO:this.ro,cf:n.cf,cu:n.cu,ff:n.ff,reg:n.reg,cnt:n.cnt,parts:n.partsA,ccount:n.ccountB,cstart:n.cstart,bsum:n.bsum,lq:this.lq,lq2:this.lq2,arrows:this.arrows,...e}),this.groups.set(t,s)}return s}drawGroup(t,e,s,n){let i=this.groups.get(t);if(i===void 0){const r=[{binding:0,resource:{buffer:this.rp,offset:An*s,size:4*Vi}}];n.tex!==void 0&&r.push({binding:1,resource:n.tex.createView()},{binding:2,resource:n.smp}),n.store!==void 0&&r.push({binding:1,resource:{buffer:n.store}},{binding:2,resource:{buffer:this.gpu.state.cnt}}),i=this.device.createBindGroup({layout:e,entries:r}),this.groups.set(t,i)}return i}encode(t,e,s,n,i,r,a){this.ensure();const o=this.gpu.state,c=this.gpu.ctx,f=this.device.queue;this.roData[0]=Ea[r],f.writeBuffer(this.ro,0,this.roData),t.clearBuffer(o.cnt,4*U.OV_PMAX,16);const u=t.beginComputePass(),d=o.d.n;c.dispatch(u,"rScale",this.computeGroup("rScale",{}),d),c.dispatch(u,"rCells",this.computeGroup("rCells",{cells:{view:this.cellsTex.createView()},field:{view:this.fieldTex.createView()}}),d),a||(c.dispatch(u,"rLiqSplat",this.computeGroup("rLiqSplat",{}),4*d),c.dispatch(u,"rLiqBlurX",this.computeGroup("rLiqBlurX",{}),4*d),c.dispatch(u,"rLiqBlurY",this.computeGroup("rLiqBlurY",{liquid:{view:this.liquidTex.createView()}}),4*d)),r==="velocity"&&c.dispatch(u,"rArrows",this.computeGroup("rArrows",{}),2*this.nArrows),u.end();const g=this.gpu.cpu.grid,h=(y,w,b)=>{const P=new Float32Array(Vi),_=new Uint32Array(P.buffer);P.set([e.x0,e.y0,e.x1,e.y1,g.w,g.h,s,n],0),P.set([...this.theme.ground,1,...this.water,1,...this.theme.ink,.85,...this.waterInk,.9],8),P.set(w,24),P.set(b,28),P[32]=r==="temperature"?1:0,P[33]=Math.max(1.5,.5*g.dx*s/(e.x1-e.x0)),_[34]=o.d.bcap,_[35]=o.d.pcap,f.writeBuffer(this.rp,An*y,P)},v=.003;h(0,[0,0,g.w,g.h],[...this.theme.ground,1]),h(1,[0,0,0,0],[0,0,0,0]),h(2,[0,0,0,0],[...this.theme.ink,.85]),h(3,[0,0,0,0],[...this.waterInk,.9]);const m=[];i.left&&m.push([-v,-v,0,g.h+(i.top?v:0)]),i.right&&m.push([g.w,-v,g.w+v,g.h+(i.top?v:0)]),i.bottom&&m.push([-v,-v,g.w+v,0]),i.top&&m.push([-v,g.h,g.w+v,g.h+v]),m.forEach((y,w)=>h(4+w,y,[...this.theme.wall,1]));const x=t.beginRenderPass({colorAttachments:[{view:this.context.getCurrentTexture().createView(),clearValue:{r:this.theme.outside[0],g:this.theme.outside[1],b:this.theme.outside[2],a:1},loadOp:"clear",storeOp:"store"}]}),F=this.pipes;x.setPipeline(F.rect),x.setBindGroup(0,this.drawGroup("d-ground",this.layouts.rect,0,{})),x.draw(4),a?(x.setPipeline(F.point),x.setBindGroup(0,this.drawGroup("d-points",this.layouts.store,1,{store:o.partsA})),x.draw(4,o.d.pcap)):(x.setPipeline(F.liquid),x.setBindGroup(0,this.drawGroup("d-liquid",this.layouts.quad,1,{tex:this.liquidTex,smp:this.sampLin})),x.draw(4)),x.setPipeline(F.disc),x.setBindGroup(0,this.drawGroup("d-bubbles",this.layouts.store,1,{store:o.bubs})),x.draw(4,o.d.bcap),x.setPipeline(F.field),x.setBindGroup(0,this.drawGroup("d-field",this.layouts.quad,1,{tex:this.fieldTex,smp:this.sampLin})),x.draw(4),x.setPipeline(F.cells),x.setBindGroup(0,this.drawGroup("d-cells",this.layouts.quad,1,{tex:this.cellsTex,smp:this.sampNear})),x.draw(4),r==="velocity"&&(x.setPipeline(F.line),x.setVertexBuffer(0,this.arrows),x.setBindGroup(0,this.drawGroup("d-ink",this.layouts.rect,2,{})),x.draw(6*this.nArrows),x.setBindGroup(0,this.drawGroup("d-winks",this.layouts.rect,3,{})),x.draw(6*this.nArrows,1,6*this.nArrows)),x.setPipeline(F.rect),m.forEach((y,w)=>{x.setBindGroup(0,this.drawGroup(`d-wall${w}`,this.layouts.rect,4+w,{})),x.draw(4)}),x.end()}reset(){this.size="",this.groups.clear()}}const Wa=[...ka,...Ra,...wa,...ya,..._a,...va,...ba,...Aa,...Ba,...Da],Di=[["heater",U.HEATER_E,"f"],["lossWalls",U.LOSS_WALLS,"f"],["lossOpen",U.LOSS_OPEN,"f"],["escapedEnergy",U.ESC_ENERGY,"f"],["escapedWater",U.ESC_WATER,"f"],["escapedAir",U.ESC_AIR,"f"],["produced",U.PRODUCED,"f"],["condensed",U.CONDENSED,"f"],["dew",U.DEW,"f"],["fogMade",U.FOGMADE,"f"],["burstVapour",U.BURSTVAP,"f"],["fluxSL",U.FLUX_SL,"f"],["fluxLG",U.FLUX_LG,"f"],["fluxSG",U.FLUX_SG,"f"],["lossSolids",U.LOSS_SOLIDS,"f"],["nucleated",U.NUCLEATED,"u"],["departed",U.DEPARTED,"u"],["merged",U.MERGED,"u"],["burst",U.BURST,"u"],["collapsed",U.COLLAPSED,"u"],["burstCold",U.BURST_COLD,"u"],["burstWarm",U.BURST_WARM,"u"],["collapsedCold",U.COLL_COLD,"u"],["collapsedWarm",U.COLL_WARM,"u"]],Ii=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0}),Tn=256,He=2*Se;class Jn{constructor(t,e){p(this,"ctx");p(this,"cpu");p(this,"state");p(this,"solver");p(this,"sub");p(this,"groups",new Map);p(this,"stateVersion",0);p(this,"itL",16);p(this,"itG",18);p(this,"itH",8);p(this,"itD",6);p(this,"nsub",0);p(this,"totals",Ii());p(this,"last",null);p(this,"energy0",null);p(this,"water0",null);p(this,"sealed",!1);p(this,"staging",[]);p(this,"busy",new Set);p(this,"querySet");p(this,"queryBuf");p(this,"vapourMark",0);p(this,"vapourLast",0);p(this,"vapourRate",0);p(this,"stageMs",new Array(Se).fill(0));this.ctx=t,this.cpu=e,this.querySet=t.timestamps?t.device.createQuerySet({type:"timestamp",count:He}):null,this.queryBuf=t.timestamps?t.buffer("ts",8*He,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(t){const e=await Xn.create(),s=await e.compile(Wa);if(s.length>0)throw e.destroy(),new Error(`WGSL: ${s.slice(0,3).join(" | ")}`);return new Jn(e,t)}rebuild(){this.stateVersion+=1,this.state!==void 0&&this.state.destroy(),this.state=new Ca(this.ctx,this.cpu);const t=this.state;this.solver=new La(this.ctx,t.plan,{params:t.params,mgF:t.mgF,mgU:t.mgU,cgv:t.cgv,cgs:t.cgs,lab:t.lab,cfl:t.cfl,csum:t.csum,cnt:t.cnt,cgp:t.cgp});const e=new Uint32Array(Tn/4*16);for(let s=0;s<16;s+=1)e[Tn/4*s]=s;this.sub=this.ctx.uniform("sub",e.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.sealed=!1;for(let t=0;t<this.cpu.regions.count;t+=1)this.cpu.regions.open[t]===0&&(this.sealed=!0)}async download(){await this.state.download(this.cpu);const t=this.cpu,e=this.totals;t.time=e.time,t.steps=e.steps;const s=t.flows;s.heater=e.heater,s.lossWalls=e.lossWalls,s.lossOpen=e.lossOpen,s.escapedEnergy=e.escapedEnergy,s.escapedWater=e.escapedWater,s.escapedAir=e.escapedAir,t.phase.produced=e.produced,t.phase.condensed=e.condensed,t.phase.dew=e.dew,t.phase.fogMade=e.fogMade;const n=t.bubbleModel;n.burstVapour=e.burstVapour,n.nucleated=e.nucleated,n.departed=e.departed,n.merged=e.merged,n.burst=e.burst,n.collapsed=e.collapsed,n.burstCold=e.burstCold,n.burstWarm=e.burstWarm,n.collapsedCold=e.collapsedCold,n.collapsedWarm=e.collapsedWarm,t.heat.fluxSL=e.fluxSL,t.heat.fluxLG=e.fluxLG,t.heat.fluxSG=e.fluxSG,t.heat.lossSolids=e.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&n.firstSuperheat===null&&(n.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(t){this.state.writeHeaterSettings(this.cpu,t)}watch(t){this.ctx.device.queue.writeBuffer(this.state.cnt,4*U.WATCH,new Uint32Array([t??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*U.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(t){const e=this.state,s={P:e.params,glob:e.glob,cnt:e.cnt,cf:e.cf,cu:e.cu,at:e.at,ff:e.ff,fu:e.fu,af:e.af,reg:e.reg,racc:e.racc,heat:e.heat,hacc:e.hacc,sites:e.sites,sbub:e.sbub,bubs:e.bubs,bubs2:e.bubs2,bacc:e.bacc,btarget:e.btarget,meas:e.meas,probe:e.probe,mgF:e.mgF,mgU:e.mgU,cgv:e.cgv,cgs:e.cgs,lab:e.lab,cfl:e.cfl,csum:e.csum,pkey:e.pkey,pslot:e.pslot,pargs:e.pargs,cstart:e.cstart,bsum:e.bsum,L:this.solver.level0};return t==="A"&&(s.parts=e.partsA,s.ccount=e.ccountB),t==="B"&&(s.parts=e.partsB,s.ccount=e.ccountA),t==="S1"&&(s.parts=e.partsA,s.parts2=e.partsB,s.ccount=e.ccountA,s.cclear=e.ccountB),t==="S2"&&(s.parts=e.partsB,s.parts2=e.partsA,s.ccount=e.ccountB,s.cclear=e.ccountA),s}group(t,e,s=-1){const n=`${t}|${e}|${s}`;let i=this.groups.get(n);if(i===void 0){const r=s>=0?{...this.resources(e),SUB:{buffer:this.sub,offset:Tn*s,size:16}}:this.resources(e);i=this.ctx.bind(t,r),this.groups.set(n,i)}return i}cells(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.n)}faces(t,e,s="",n=-1){this.ctx.dispatch(t,e,this.group(e,s,n),this.state.d.nf)}parts(t,e,s){this.ctx.dispatch(t,e,this.group(e,s),this.state.d.pcap)}bubs(t,e){this.ctx.dispatch(t,e,this.group(e,""),this.state.d.bcap)}one(t,e,s=""){this.ctx.dispatchOne(t,e,this.group(e,s))}sort(t,e){const s=e===1?"S1":"S2",n=this.state.d;this.ctx.dispatch(t,"sortCount",this.group("sortCount",s),n.pcap),this.ctx.dispatch(t,"sortScan",this.group("sortScan",s),Math.ceil(n.n/4)),this.one(t,"sortTop",s),this.ctx.dispatch(t,"sortScatter",this.group("sortScatter",s),n.pcap)}encodeSteps(t,e,s){for(let n=0;n<e;n+=1)this.encodeStep(t,s&&n===0&&this.querySet!==null);s&&e>0&&this.querySet!==null&&this.queryBuf!==null&&t.resolveQuerySet(this.querySet,0,He,this.queryBuf,0)}pass(t,e,s){if(this.ctx.profiler!==null){const n=()=>{};return{label:"",setPipeline:n,setBindGroup:n,dispatchWorkgroups:n,dispatchWorkgroupsIndirect:n,end:n}}return!e||this.querySet===null?t.beginComputePass():t.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*s,endOfPassWriteIndex:2*s+1}})}encodeStep(t,e){const s=this.cpu;let n=this.pass(t,e,1);this.sort(n,1),this.cells(n,"splat","B"),this.cells(n,"classify"),this.cells(n,"transitions"),this.cells(n,"gasApply"),this.cells(n,"regCells"),this.parts(n,"regParts","B"),this.bubs(n,"regBubs"),this.one(n,"regFinishStart"),this.faces(n,"p2g","B"),this.cells(n,"liqAssemble"),this.solver.encodeMG(n,gr,this.itL,!0,!1),this.cells(n,"liqPressure"),this.faces(n,"liqCorrect"),this.faces(n,"extrap1"),this.faces(n,"extrap2"),this.parts(n,"g2p","B"),this.sort(n,2),this.parts(n,"heatWeights","A"),n.end(),n=this.pass(t,e,2),this.cells(n,"gasVolumes"),this.faces(n,"markFaces"),this.cells(n,"gasMaxOut");for(let i=0;i<16;i+=1)this.cells(n,"gasFlux","",i),this.cells(n,"gasMove","",i);this.cells(n,"gasApplyMid"),this.faces(n,"macFwd"),this.faces(n,"macBack"),this.faces(n,"viscosity"),this.cells(n,"gasAssemble"),this.solver.encodeMG(n,vr,this.itG,!0,!0),this.cells(n,"gasPressure"),this.faces(n,"gasCorrect"),n.end(),n=this.pass(t,e,3),this.cells(n,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(n,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(n,"bubAdvance"),this.bubs(n,"bubTarget"),this.bubs(n,"bubMerge"),this.bubs(n,"bubMergeFinal"),this.bubs(n,"bubFinish"),this.one(n,"bubCompact"),this.bubs(n,"bubCopyBack"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.bubs(n,"bubAlpha"),this.cells(n,"cellAlpha"),this.cells(n,"gasApply"),n.end(),n=this.pass(t,e,4),this.cells(n,"diffPrep"),this.cells(n,"diffAssemble"),this.solver.encodeMG(n,br,this.itD,!1),this.faces(n,"diffFaces"),this.cells(n,"diffApply"),this.cells(n,"latentSrc"),this.parts(n,"applyMass","A"),this.cells(n,"gatherPlain","A"),this.cells(n,"gasApply"),this.cells(n,"flashTs"),this.cells(n,"flashVap","A"),this.parts(n,"flashParts","A"),this.cells(n,"flashDist"),this.cells(n,"gasApply"),this.cells(n,"fog"),this.cells(n,"films","A"),n.end(),n=this.pass(t,e,5),this.cells(n,"heaterSums"),this.one(n,"heaterPI"),s.heat.liquidPower!==0&&this.parts(n,"sumCl","A"),this.cells(n,"heatPrep","A"),this.cells(n,"heatAssemble"),this.solver.encodeMG(n,xr,this.itH,!1),this.cells(n,"heatFlux"),this.parts(n,"heatParts","A"),n.end(),n=this.pass(t,e,7),this.cells(n,"regCells"),this.parts(n,"regParts","A"),this.bubs(n,"regBubs"),this.one(n,"regFinish"),this.sealed&&(this.cells(n,"compSums"),this.one(n,"compStep0"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStep1"),this.cells(n,"compApply"),this.cells(n,"compSums"),this.one(n,"compStepEnd"),this.parts(n,"pwParts","A"),this.bubs(n,"pwBubs")),this.cells(n,"gasEos"),this.one(n,"stepEnd"),n.end()}layout(){const t=this.state,e=0,s=e+4*Me,n=s+4*Xe,i=n+4*se*t.d.nreg,r=i+4*Yt*t.d.nheat,a=t.measGroups[0]+t.measGroups[1]+t.measGroups[2],o=r+4*Je*a,c=o+4*64,f=c+8*He;return{cnt:e,glob:s,reg:n,heat:i,meas:r,probe:o,ts:c,total:f}}encodeReadback(t,e){const s=this.state,n=this.layout();let i=this.staging.find(a=>!this.busy.has(a)&&a.size>=n.total);if(i===void 0){if(this.staging.length>=3)return null;i=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(n.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(i)}const r=t.beginComputePass();return this.ctx.dispatch(r,"measCells",this.group("measCells",""),s.d.n),this.ctx.dispatch(r,"measParts",this.group("measParts","A"),s.d.pcap),this.ctx.dispatch(r,"measBubs",this.group("measBubs",""),s.d.bcap),this.ctx.dispatch(r,"bubWatch",this.group("bubWatch",""),s.d.bcap),r.end(),t.copyBufferToBuffer(s.cnt,0,i,n.cnt,4*Me),t.copyBufferToBuffer(s.glob,0,i,n.glob,4*Xe),t.copyBufferToBuffer(s.reg,0,i,n.reg,4*se*s.d.nreg),t.copyBufferToBuffer(s.heat,0,i,n.heat,4*Yt*s.d.nheat),t.copyBufferToBuffer(s.meas,0,i,n.meas,n.probe-n.meas),t.copyBufferToBuffer(s.probe,0,i,n.probe,4*64),e&&this.queryBuf!==null&&t.copyBufferToBuffer(this.queryBuf,0,i,n.ts,8*He),t.clearBuffer(s.cnt,4*yi,4*(No-yi)),this.busy.add(i),i}async finishReadback(t,e){const s=this.layout();try{await t.mapAsync(GPUMapMode.READ)}catch{return this.busy.delete(t),null}const n=t.getMappedRange(0,Math.ceil(s.total/16)*16).slice(0);t.unmap(),this.busy.delete(t);const i=this.parse(n,s,e);return this.absorb(i),i}parse(t,e,s){const n=this.state,i=new Uint32Array(t,e.cnt,Me),r=new Float32Array(t,e.cnt,Me),a=new Float32Array(t,e.glob,Xe),o=new Float32Array(t,e.reg,se*n.d.nreg),c=new Float32Array(t,e.heat,Yt*n.d.nheat),f=new Float32Array(t,e.meas,(e.probe-e.meas)/4),u=new Float32Array(t,e.probe,64),[d,g,h]=n.measGroups,v=(b,P,_)=>{let A=0;for(let C=0;C<P;C+=1)A+=f[(b+C)*Je+_];return A},m=[];for(let b=0;b<this.cpu.regions.count;b+=1){const P=se*n.gpuRegion(b);m.push({p0:o[P+Ot.P0],sealed:o[P+Ot.OPEN]===0,vGas:o[P+Ot.VGAS],vFluid:o[P+Ot.VFLUID]})}const x=[];for(let b=0;b<this.cpu.heat.heaters.length;b+=1){const P=Yt*b;x.push({P:c[P+Tt.P],Tmean:c[P+Tt.TMEAN],integral:c[P+Tt.INTEGRAL],cells:c[P+Tt.CELLS]})}let F=null;if(s&&this.queryBuf!==null){const b=new BigUint64Array(t,e.ts,He);F=[];for(let P=0;P<Se;P+=1){const _=b[2*P],A=b[2*P+1];F.push(A>_&&_>0n?Number(A-_)/1e6:0)}}const y=r[U.SUM_WM],w={};for(const[b,P,_]of Di)w[b]=_==="f"?r[P]:i[P];return{intervals:w,ov:[r[U.OV_PMAX],r[U.OV_VMAX],r[U.OV_VLIQ]],pcount:i[U.PCOUNT],bcount:i[U.BCOUNT],dt:a[We.DT],stepsSince:i[U.STEPS],simSince:r[U.SIMTIME],itL:i[U.IT_L],itG:i[U.IT_G],itH:i[U.IT_H],itD:i[U.IT_D],capL:i[U.CAP_L],capG:i[U.CAP_G],capH:i[U.CAP_H],capD:i[U.CAP_D],resL:r[U.RES_L],resG:r[U.RES_G],resH:r[U.RES_H],nsub:i[U.NSUBMAX],uMaxG:r[U.UMAXG],waterMass:y,waterT:y>0?r[U.SUM_WMT]/y:0,waterTmax:r[U.TMAX],solids:v(0,d,0),film:v(0,d,1),gas:v(0,d,2),vapour:v(0,d,3),fog:v(0,d,4),air:v(0,d,5),liquidCells:Math.round(v(0,d,6)),gasCells:Math.round(v(0,d,7)),liquidH:v(d,g,0),liquidMass:v(d,g,1),sensible:v(d,g,3),bubH:v(d+g,h,0),bubWater:v(d+g,h,1),bubAir:v(d+g,h,2),regions:m,heaters:x,watch:{found:u[31]===1,id:new Uint32Array(u.buffer,u.byteOffset+4*21,1)[0],fate:i[U.WATCH_FATE],data:new Float32Array(u)},firstSuperheat:i[U.FIRST_SH]!==0?r[U.FIRST_SH]-1e3:null,stageMs:F}}absorb(t){const e=this.totals;this.last=t,t.stageMs!==null&&(this.stageMs=t.stageMs);for(const[n]of Di)e[n]+=t.intervals[n];e.time+=t.simSince,e.steps+=t.stepsSince,e.capped+=t.capL+t.capG+t.capH+t.capD;const s=(n,i,r,a,o)=>{if(i===0&&r===0)return n;const c=r>0?Math.ceil(n*1.5)+2:i+1;return Math.min(o,Math.max(a,n>c?Math.max(c,n-2):c))};t.stepsSince>0&&(this.itL=s(this.itL,t.itL,t.capL,4,60),this.itG=s(this.itG,t.itG,t.capG,4,60),this.itH=s(this.itH,t.itH,t.capH,3,60),this.itD=s(this.itD,t.itD,t.capD,3,60),this.nsub=t.nsub)}stats(t){const e=this.cpu,s=e.grid,n=this.last,i=this.totals,r=this.budget(),a={heater:i.heater,lossWalls:i.lossWalls,lossOpen:i.lossOpen,escapedEnergy:i.escapedEnergy,editEnergy:e.ledger.energy,escapedWater:i.escapedWater,escapedAir:i.escapedAir,editWater:e.ledger.water,editAir:e.ledger.air},o=this.energy0??r.energy,c=this.water0??r.water.total,f=r.energy-o-(a.heater-a.lossWalls-a.lossOpen-a.escapedEnergy+a.editEnergy),u=r.water.total-c-a.editWater,d=i.produced+i.burstVapour,g=i.time-this.vapourLast;g>.2&&(this.vapourRate=(d-this.vapourMark)/g,this.vapourMark=d,this.vapourLast=i.time);const h=e.heat.heaters.map((m,x)=>({h:m,k:x,rd:n==null?void 0:n.heaters[x]})).filter(({rd:m,h:x})=>((m==null?void 0:m.cells)??x.cells)>0).map(({h:m,rd:x})=>({group:m.group,P:(x==null?void 0:x.P)??m.P,Tmean:(x==null?void 0:x.Tmean)??m.Tmean,mode:m.mode,power:m.power,target:m.target,on:m.on})),v=(m,x,F)=>({iterations:m,residual:x,capped:F>0});return{time:i.time,dt:(n==null?void 0:n.dt)??e.dt,steps:i.steps,nx:s.nx,ny:s.ny,dx:s.dx,quality:e.currentQuality,particles:(n==null?void 0:n.pcount)??e.particles.count,capacity:e.particles.cap,bubbles:(n==null?void 0:n.bcount)??e.bubbles.count,liquidCells:(n==null?void 0:n.liquidCells)??0,gasCells:(n==null?void 0:n.gasCells)??0,stages:[...this.stageMs],stepMs:t,liquid:v((n==null?void 0:n.itL)??0,(n==null?void 0:n.resL)??0,(n==null?void 0:n.capL)??0),gas:v((n==null?void 0:n.itG)??0,(n==null?void 0:n.resG)??0,(n==null?void 0:n.capG)??0),heat:v((n==null?void 0:n.itH)??0,(n==null?void 0:n.resH)??0,(n==null?void 0:n.capH)??0),gasSubsteps:(n==null?void 0:n.nsub)??0,capped:i.capped,waterT:(n==null?void 0:n.waterT)??0,waterTmax:(n==null?void 0:n.waterTmax)??0,heaters:h,regions:((n==null?void 0:n.regions)??[]).map(m=>({p0:m.p0,sealed:m.sealed,vGas:m.vGas})),budget:r,flows:a,energyError:f,waterError:u,vapourRate:this.vapourRate,ambientT:e.ambientT,ambientP:e.pRef,g:e.gy}}budget(){const t=this.last,e=this.totals;let s=0;for(const c of(t==null?void 0:t.regions)??[])c.sealed&&(s-=c.p0*c.vFluid);const n=(t==null?void 0:t.liquidH)??0,i=(t==null?void 0:t.solids)??0,r=(t==null?void 0:t.gas)??0,a=(t==null?void 0:t.bubH)??0,o={liquid:(t==null?void 0:t.liquidMass)??0,vapour:(t==null?void 0:t.vapour)??0,fog:(t==null?void 0:t.fog)??0,film:(t==null?void 0:t.film)??0,bubbles:(t==null?void 0:t.bubWater)??0,escaped:e.escapedWater,total:((t==null?void 0:t.liquidMass)??0)+((t==null?void 0:t.vapour)??0)+((t==null?void 0:t.fog)??0)+((t==null?void 0:t.film)??0)+((t==null?void 0:t.bubWater)??0)+e.escapedWater};return{energy:i+n+r+a+s,solids:i,liquid:n,gas:r,bubbles:a,pv:s,water:o,air:((t==null?void 0:t.air)??0)+((t==null?void 0:t.bubAir)??0)+e.escapedAir}}resetTotals(){Object.assign(this.totals,Ii()),this.last=null,this.energy0=null,this.water0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0}resetBaseline(){this.energy0=null,this.water0=null}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const t=this.budget(),e=this.totals,s=this.cpu;this.energy0=t.energy-(e.heater-e.lossWalls-e.lossOpen-e.escapedEnergy+s.ledger.energy),this.water0=t.water.total-s.ledger.water}get tsatAmb(){return yt(this.cpu.regions.pAmb)}}function Ka(l,t,e,s,n){const i=-n,r=-n,a=l+2*n,o=t+2*n,c=Math.max(1e-6,e)/Math.max(1e-6,s);if(a/o>c){const u=a/c;return{x0:i,y0:r-(u-o)/2,x1:i+a,y1:r-(u-o)/2+u}}const f=o*c;return{x0:i-(f-a)/2,y0:r,x1:i-(f-a)/2+f,y1:r+o}}const es=self,kt=l=>es.postMessage(l),Gi=8,za=.1,Qa=3,Xa=200,Ya=.25,Ni=273.15;let at=null,X=null,be=null,$s=null,de=null,fs="",Rs=1,js=1,qs=1,ss={x0:0,y0:0,x1:1,y1:1},ns={left:!0,right:!0,bottom:!0,top:!1},Ws=!1,Vn=1,ze="none",yr=!1,ke=0,Ze=0,Dn=0,kn=0,Sn=!1,Ks=0,Ui=0,In=0,Gn=0,Hi=!1,Nn=0,Qe=null;const Ae=[],Un=[];let zs=!1;const ts=[];function Zn(){if(at===null)return;const l=at.scene.sides;ns={left:l.left==="wall",right:l.right==="wall",bottom:l.bottom==="wall",top:l.top==="wall"}}function ti(l,t,e){Rs=Math.max(1,l),js=Math.max(1,t),qs=Math.max(.5,Math.min(3,e)),de!==null&&(de.width=Math.round(Rs*qs),de.height=Math.round(js*qs)),at!==null&&(ss=Ka(at.boxW,at.boxH,Rs,js,.006))}function Fr(l){be!==null&&(be.theme={ground:l?[.1,.12,.15]:[.93,.95,.97],outside:l?[.06,.07,.09]:[.86,.88,.9],wall:l?[.55,.6,.66]:[.42,.46,.5],ink:l?[.9,.93,.96]:[.08,.1,.12]})}function os(l){Un.push(l),zs||Ja()}async function Ja(){if(X!==null){zs=!0;try{for(;Un.length>0;){const l=Un.shift();await X.ctx.device.queue.onSubmittedWorkDone();try{await l()}catch(t){kt({type:"error",message:t instanceof Error?t.message:String(t)})}}}finally{zs=!1,Ze=performance.now()}}}async function Hn(){if(X===null)return;const l=X.ctx.device.createCommandEncoder(),t=X.encodeReadback(l,!1);X.ctx.device.queue.submit([l.finish()]),t!==null&&await X.finishReadback(t,!1),X.baselineFromLast()}function ei(l){X!==null&&be!==null&&X.stateVersion!==l&&be.reset()}function Mn(){os(async()=>{if(X===null||at===null||ts.length===0)return;const l=ts.splice(0,ts.length);await Hn(),await X.download();for(const e of l){const s=at.apply(e);s!==null&&s.startsWith("refused")&&kt({type:"refused",message:s})}const t=X.stateVersion;X.upload(),ei(t)})}function Za(l){const t=(l==null?void 0:l.ov)??[0,0,0],e=t[2];if(ze==="temperature")return[Ni+Jt[0],Ni+Jt[1],e];if(ze==="pressure"){const s=Math.max(1,t[0]);return[-s,s,e]}return ze==="velocity"?[0,Math.max(.02,t[1]),e]:ze==="vapour"?[0,.6,e]:[0,1,e]}function tc(l){if(l===null)return null;const t=l.watch;if(t.found){const e=t.data;return Qe={id:t.id,r:e[2],T:e[3],pb:e[4],pv:e[5],Tsat:yt(e[4]),mv:e[6],ma:e[7],vx:e[8],vy:e[9],dmdt:e[10],attached:e[11]>.5,force:Array.from(e.subarray(12,20)),x:e[0],y:e[1],Tl:e[20],fate:t.fate===3?"merged":null},Qe}return Qe!==null&&(t.fate===1||t.fate===2)?{...Qe,fate:t.fate===1?"burst":"collapsed"}:null}function ec(l,t){if(X===null||$s===null)return;if(X.baselineFromLast(),X.totals.time>=Nn){const i=$s.sample();i!==null&&(Ae.push(i),Ae.length>400&&Ae.splice(0,Ae.length-400),Nn=X.totals.time+Ya)}const e=Math.max(.001,(t-Ks)/1e3),s=(l.stageMs??X.stageMs).reduce((i,r)=>i+r,0),n={engine:X.stats(s),stepsPerSecond:Gn/e,simRate:(X.totals.time-Ui)/e,fps:In/e,renderMs:0,mode:"gpu",adapter:fs,paused:Ws,samples:Ae.splice(0,Ae.length),bubble:tc(l),overlayScale:Za(l)};kt({type:"stats",stats:n}),In=0,Gn=0,Ui=X.totals.time,Ks=t}function $n(){var t;const l=performance.now();if(X!==null&&be!==null&&de!==null&&at!==null&&!zs){const e=X.ctx.device,s=Ze===0?0:Math.min(.1,(l-Ze)/1e3);Ze=l;const n=((t=X.last)==null?void 0:t.dt)??at.dt;let i=0;Ws?(i=Math.min(Gi,Dn),Dn-=i,ke=0):(ke=Math.min(ke+s*Vn,za*Math.max(1,Vn)),i=kn>=Qa?0:Math.min(Gi,Math.floor(ke/Math.max(1e-5,n))),ke-=i*n);const r=!Sn&&l-Ks>Xa,a=e.createCommandEncoder();i>0&&X.encodeSteps(a,i,r);const o=r?X.encodeReadback(a,r&&i>0):null;if(be.encode(a,ss,de.width,de.height,ns,ze,yr),e.queue.submit([a.finish()]),kn+=1,e.queue.onSubmittedWorkDone().then(()=>{kn-=1}),Gn+=i,In+=1,o!==null){Sn=!0;const c=i>0;X.finishReadback(o,c).then(f=>{Sn=!1,f!==null&&ec(f,performance.now())})}}typeof es.requestAnimationFrame=="function"?es.requestAnimationFrame($n):setTimeout($n,16)}async function sc(l){if(at=new Go(l.scene),de=l.canvas,de===null)throw new Error("no OffscreenCanvas");X=await Jn.create(at),fs=await(async()=>{var e;try{const s=await((e=es.navigator.gpu)==null?void 0:e.requestAdapter({powerPreference:"high-performance"})),n=s==null?void 0:s.info;return n===void 0?"":[n.vendor,n.architecture,n.description].filter(Boolean).join(" ")}catch{return""}})(),be=new $a(X,de),await be.init(),Fr(l.dark),$s=new dr(X),X.ctx.device.addEventListener("uncapturederror",e=>kt({type:"error",message:`WebGPU: ${e.error.message}`})),X.ctx.device.lost.then(e=>kt({type:"gpu",ok:!1,adapter:fs,message:e.message||e.reason})),Zn(),ti(l.width,l.height,l.dpr),kt({type:"gpu",ok:!0,adapter:fs,message:""}),kt({type:"ready",offscreen:!0,warnings:at.warnings,view:ss,quality:at.currentQuality,walls:ns}),Ks=performance.now(),Ze=performance.now(),Hi||(Hi=!0,$n())}function $i(){if(X===null||at===null)return;const l=X.stateVersion;X.cpu=at,X.rebuild(),X.resetTotals(),ei(l),$s=new dr(X),Nn=0,Ae.length=0,ke=0,Qe=null,Zn(),ti(Rs,js,qs),kt({type:"view",view:ss,walls:ns})}es.addEventListener("message",l=>{const t=l.data;try{switch(t.type){case"probe":kt({type:"probe",webgl2:typeof OffscreenCanvas<"u"&&es.navigator.gpu!==void 0});break;case"init":sc(t).catch(e=>kt({type:"gpu",ok:!1,adapter:fs,message:e instanceof Error?e.message:String(e)}));break;case"resize":ti(t.width,t.height,t.dpr),kt({type:"view",view:ss,walls:ns});break;case"op":ts.push(t.op),Mn();break;case"addLiquid":ts.push({op:"fill",region:t.region,phase:"liquid",T:t.T,composition:t.composition}),Mn();break;case"addSolid":ts.push({op:"solid",region:t.region,material:t.material,T:t.T}),Mn();break;case"setHeater":at==null||at.setHeater(t.group,t.mode,t.power,t.target,t.on),X==null||X.writeHeater(t.group);break;case"setAmbient":at==null||at.setAmbient(t.p,t.T,t.rh,t.g,t.air),X==null||X.writeParams();break;case"setBoundary":os(async()=>{if(X===null||at===null)return;await Hn(),await X.download(),at.setBoundary(t.side,t.value);const e=X.stateVersion;X.upload(),ei(e),Zn(),kt({type:"view",view:ss,walls:ns})});break;case"query":os(async()=>{if(X===null||at===null){kt({type:"reply",id:t.id,data:null});return}await Hn(),await X.download(),kt({type:"reply",id:t.id,data:at.query(t.x,t.y)})});break;case"select":Qe=null,X==null||X.watch(t.bubble);break;case"overlay":ze=t.overlay;break;case"particles":yr=t.on;break;case"pause":Ws=t.paused,ke=0,Ze=performance.now();break;case"step":Ws&&(Dn+=1);break;case"setSpeed":Vn=Math.min(64,Math.max(.05,t.speed));break;case"setQuality":os(async()=>{at!==null&&(at.setQuality(t.quality),$i())});break;case"serialize":kt({type:"reply",id:t.id,data:(at==null?void 0:at.serialize())??null});break;case"load":os(async()=>{at!==null&&(at.load(t.scene),$i())});break;case"theme":Fr(t.dark);break;case"frameDone":break}}catch(e){kt({type:"error",message:e instanceof Error?e.message:String(e)})}});
