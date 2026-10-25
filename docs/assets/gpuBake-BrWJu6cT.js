var Ti=Object.defineProperty;var yi=(a,e,t)=>e in a?Ti(a,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):a[e]=t;var l=(a,e,t)=>yi(a,typeof e!="symbol"?e+"":e,t);import{d as Ce,T as ce,R as ni,P as Ai,G as Li,A as Ci,H as Oi,C as _r,a as qi,b as Bi,c as ai,S as ci,F as Ri,e as Di,V as Ei,f as ue,g as Fr,B as Mi,Q as li,h as Ii,O as fr,p as ji,s as Ni,v as Ar,i as Ui,j as Gi,t as wr,k as Vi,M as fi,l as $i,m as Hi,N as Wi,E as Lr,n as Ki,K as zi,o as Qi,q as Pt,r as ui,u as oi,w as Xi,x as Zi,y as He,z as We,D as Ke,I as Yi,J as At,L as Ji,U as Vt,W as $t,X as es,Y as Lt,Z as ur,_ as ts,$ as rs,a0 as or,a1 as is,a2 as Cr,a3 as ss,a4 as ns,a5 as Ht,a6 as Or,a7 as Wt,a8 as as,a9 as cs}from"./engine.worker-D1VfkwTR.js";const ut={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},dt=16,p={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72,REL_MASS:73,REL_N:74,REL_MISS:75,EVAP_CAP:76},ze=96,qr=16,ls=57,te={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},ge=16,fs={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},dr=8,Z={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},pe=8,us={TSUM:0,CELLS:1},mr=2,os={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},di=16,F={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69},Kt=70,$e={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5},zt=6,pr={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16},Qt=17,Te={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},Xt=20,ds={KNOWN:0,MARK:1,MARK2:2,GAS:3},Br=4,ms={F:0},Zt=1,ps={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},hr=12,re=(a,e)=>Object.entries(e).map(([t,i])=>`const ${a}${t}: u32 = ${i}u;`).join(`
`),hs=[re("G_",ut),re("C_",p),re("R_",te),re("RA_",fs),re("H_",Z),re("HA_",us),re("S_",os),re("F_",F),re("U_",$e),re("A_",pr),re("FF_",Te),re("FU_",ds),re("AF_",ms),re("BA_",ps),`const RACC_STRIDE: u32 = ${dr}u;`,`const HEAT_STRIDE: u32 = ${pe}u;`,`const HACC_STRIDE: u32 = ${mr}u;`,`const CGS_STRIDE: u32 = ${di}u;`,`const BACC_STRIDE: u32 = ${hr}u;`].join(`
`);function h(a){if(!Number.isFinite(a))throw new Error(`not a finite constant: ${a}`);const e=Math.abs(a)>=1e-4&&Math.abs(a)<1e7?String(a):a.toExponential(9);return/[.eE]/.test(e)?e:`${e}.0`}const X=a=>a.map(h).join(", "),K=Ce.species[0],Ct=Ce.species[1],Ot=Ce.species[2],Qe=K.liquid.cp.table,Le=Qe.map(a=>a[0]),Xe=Qe.map(a=>a[1]),Mt=[Xe[0]*(Le[0]-ce)];for(let a=1;a<Qe.length;a+=1)Mt.push(Mt[a-1]+.5*(Xe[a]+Xe[a-1])*(Le[a]-Le[a-1]));const[gs,bs,vs]=K.vapour.cp.linear,gr=ce+100,xs=(()=>{let a=0;for(;a<Le.length-2&&gr>=Le[a+1];)a+=1;const e=gr-Le[a],t=(Xe[a+1]-Xe[a])/(Le[a+1]-Le[a]);return Mt[a]+Xe[a]*e+.5*t*e*e})(),_s=xs+K.saturation.hlv100.v,xe=Ce.solids,mi=Ce.species.slice(3).map(a=>{const e=a.liquid,[t,i]=e.cp.linear;return{cA:t,cB:i,h0:t*ce+.5*i*ce*ce,rA:e.rho.linear[0],rB:e.rho.linear[1],kA:e.k.linear[0],kB:e.k.linear[1],mA:e.mu.vogel[0],mB:e.mu.vogel[1],mC:e.mu.vogel[2],sigma:e.sigma.v}}),pi=1+mi.length,oe=a=>`array<f32, ${pi}>(${X([0,...mi.map(a)])})`,Yt=4294967295,Fs=`
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
}`,Rr=48,ws=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,Je=27,Ps=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,et=29,ks=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,Jt=8,Ss=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,Ts=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${h(ce)};
const R_GAS: f32 = ${h(ni)};
const P_ATM: f32 = ${h(Ai)};
const G0: f32 = ${h(Li)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${h(Ct.molarMass.v)};
const M_O2: f32 = ${h(Ot.molarMass.v)};
const M_H2O: f32 = ${h(K.molarMass.v)};
const CP_N2: f32 = ${h(Ct.gas.cp.v)};
const CP_O2: f32 = ${h(Ot.gas.cp.v)};
const CPV0: f32 = ${h(gs)};
const CPV1: f32 = ${h(bs)};
const CPV_T: f32 = ${h(vs)};
const T100: f32 = ${h(gr)};
const HV100: f32 = ${h(_s)};
const NCP: i32 = ${Qe.length};
const CP_T = array<f32, ${Qe.length}>(${X(Le)});
const CP_V = array<f32, ${Qe.length}>(${X(Xe)});
const CP_H = array<f32, ${Qe.length}>(${X(Mt)});
const KELL = array<f32, 7>(${X(K.liquid.kell.c)});
const KL = array<f32, 3>(${X(K.liquid.k.poly)});
const VA: f32 = ${h(K.liquid.mu.vogel[0])};
const VB: f32 = ${h(K.liquid.mu.vogel[1])};
const VC: f32 = ${h(K.liquid.mu.vogel[2])};
const ST_B: f32 = ${h(K.surfaceTension.B)};
const ST_b: f32 = ${h(K.surfaceTension.b)};
const ST_MU: f32 = ${h(K.surfaceTension.mu)};
const T_CRIT: f32 = ${h(K.saturation.Tc.v)};
const RHO_CRIT: f32 = ${h(K.saturation.rhoc.v)};
const N97 = array<f32, 10>(${X(K.saturation.if97.n)});
const RVC = array<f32, 6>(${X(K.saturation.vapourDensity.c)});
const KV: f32 = ${h(K.vapour.k.v)};
const MUV: f32 = ${h(K.vapour.mu.v)};
const KN = array<f32, 3>(${X(Ct.gas.k.power)});
const KO = array<f32, 3>(${X(Ot.gas.k.power)});
const MN = array<f32, 3>(${X(Ct.gas.mu.sutherland)});
const MO = array<f32, 3>(${X(Ot.gas.mu.sutherland)});
const DV0: f32 = ${h(Ce.vapourInAir.D0.v)};
const DVT0: f32 = ${h(Ce.vapourInAir.T0.v)};
const DVE: f32 = ${h(Ce.vapourInAir.exponent.v)};
const NSOL: u32 = ${xe.length}u;
const S_RHO = array<f32, ${xe.length}>(${X(xe.map(a=>a.rho.v))});
const S_CP = array<f32, ${xe.length}>(${X(xe.map(a=>a.cp.v))});
const S_K = array<f32, ${xe.length}>(${X(xe.map(a=>a.k.v))});
const S_THETA = array<f32, ${xe.length}>(${X(xe.map(a=>a.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${h(Ci)};
const REG_STRIDE: u32 = ${ge}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${h(Oi)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${h(_r)};
const NLIQ: u32 = ${pi}u;
const L_CA = ${oe(a=>a.cA)};
const L_CB = ${oe(a=>a.cB)};
const L_H0 = ${oe(a=>a.h0)};
const L_RA = ${oe(a=>a.rA)};
const L_RB = ${oe(a=>a.rB)};
const L_KA = ${oe(a=>a.kA)};
const L_KB = ${oe(a=>a.kB)};
const L_MA = ${oe(a=>a.mA)};
const L_MB = ${oe(a=>a.mB)};
const L_MC = ${oe(a=>a.mC)};
const L_SIG = ${oe(a=>a.sigma)};
`,ys=`
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
`,As=`
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
`,Pr=[Fs,ws,Ps,ks,Ss,Ts,hs,ys,As].join(`
`),wt=60*2**24,_e={K:3,LOST:8,NEXT_LO:9,FRAMES:11,DT:12,PROBE:14},xt=16,W=8,qe={LO:0,PMAX:1,VMAX:2,NB:3,INDEX:4,HI:5},Ls=24,Fe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",tt=`
struct Bk {
  sw: u32, kmax: u32, period: u32, bcap: u32,
  oFlags: u32, oCrust: u32, oGlow: u32, oTemp: u32,
  oPres: u32, oSpeed: u32, oHum: u32, oVap: u32,
  oFog: u32, oLiq: u32, oArw: u32, oBub: u32,
  oQuad: u32, nq: u32, na: u32, nax: u32,
  astep: u32, ahalf: u32, every: u32, pad: u32,
}
fn rnd(x: f32) -> f32 { return floor(x + 0.5); }
fn u8q(x: f32) -> u32 { return u32(floor(255.0 * clamp(x, 0.0, 1.0) + 0.5)); }
fn tq(T: f32) -> u32 { return u32(clamp(rnd((T - ${h(qi)}) / ${h(Bi)}), 0.0, 65535.0)); }
fn crustCov(m: f32, size: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${h(ai)} * size * P.depth) / size)); }
fn velQ(u: f32) -> i32 { return i32(rnd(127.0 * sign(u) * sqrt(min(1.0, abs(u) / ${h(ci)})))); }
`,Cs=[{name:"bkClock",wg:64,bind:"P:u K:u<Bk> glob:r bkc:w<u32> bkh:a",code:`${tt}
${Fe} {
  if (gid.x != 0u) { return; }
  bkc[2] = 0u;
  if (bkc[14] != 0u) {
    let ps = K.kmax;
    bkc[2] = 1u;
    bkc[7] = ps;
    bkc[13] = 1u;
    atomicStore(&bkh[ps * 8u], bkc[0]);
    atomicStore(&bkh[ps * 8u + 1u], 0u);
    atomicStore(&bkh[ps * 8u + 2u], 0u);
    atomicStore(&bkh[ps * 8u + 3u], 0u);
    atomicStore(&bkh[ps * 8u + 4u], 0xffffffffu);
    atomicStore(&bkh[ps * 8u + 5u], bkc[1]);
    return;
  }
  let lo0 = bkc[0];
  let lo = lo0 + bkc[12];
  var hi = bkc[1];
  if (lo < lo0) { hi += 1u; }
  bkc[0] = lo;
  bkc[1] = hi;
  bkc[12] = u32(round(glob[G_DT] * ${h(wt)}));
  let nlo = bkc[9];
  let nhi = bkc[10];
  if (hi > nhi || (hi == nhi && lo >= nlo)) {
    let idx = bkc[11];
    let k = bkc[3];
    if (k < K.kmax) {
      bkc[2] = 1u;
      bkc[7] = k;
      bkc[3] = k + 1u;
      bkc[13] = select(0u, 1u, idx % K.every == 0u);
      atomicStore(&bkh[k * 8u], lo);
      atomicStore(&bkh[k * 8u + 1u], 0u);
      atomicStore(&bkh[k * 8u + 2u], 0u);
      atomicStore(&bkh[k * 8u + 3u], 0u);
      atomicStore(&bkh[k * 8u + 4u], idx);
      atomicStore(&bkh[k * 8u + 5u], hi);
    } else { bkc[8] = bkc[8] + 1u; }
    bkc[11] = idx + 1u;
    let n2 = nlo + K.period;
    var h2 = nhi;
    if (n2 < nlo) { h2 += 1u; }
    bkc[9] = n2;
    bkc[10] = h2;
  }
}`},{name:"bkCells",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> cf:r cu:r ff:r reg:r bkm:r<u32> bko:w<u32> bkh:a",code:`${tt}
${Fe} {
  if (bkc[2] == 0u) { return; }
  let w = gid.x;
  let n = P.n;
  if (w >= (n + 3u) / 4u) { return; }
  let ov = bkc[13] != 0u;
  let slot = bkc[7];
  let base = slot * K.sw;
  var code = 0u; var flags = 0u; var crust = 0u; var glow = 0u; var t01 = 0u; var t23 = 0u;
  var pres = 0u; var speed = 0u; var hum = 0u; var vap = 0u; var fog = 0u;
  var pm = 0u; var vm = 0u;
  for (var k = 0u; k < 4u; k++) {
    let c = 4u * w + k;
    if (c >= n) { break; }
    let kind = cu[U_KIND * n + c];
    let sol = cu[U_SOLID * n + c];
    let built = kind == SOLID && sol != 0u && bkm[c] == 0u;
    let T = cf[F_T * n + c];
    let i = ci(c);
    let j = cj(c);
    let cd = kind + 4u * select(0u, sol, built);
    var gl = 0u;
    if (built) { gl = u8q((T - T0 - 60.0) / 340.0); }
    var cr = 0u;
    if (built) { cr = u8q(crustCov(cf[F_CRUST * n + c], P.dx)); }
    else if (kind != SOLID && j == 0) {
      let fm = cf[F_FLOOR * n + u32(i)];
      if (fm > 0.0) { cr = u8q(crustCov(fm, P.dx)); }
    }
    var p = 128u; var s = 0u; var hu = 0u; var va = 0u; var fo = 0u; var fl = 0u; var tqv = 0u;
    if (kind == GAS) {
      let vg = max(1e-12, cf[F_VGAS * n + c]);
      let fgv = cf[F_MF * n + c] / vg;
      if (fgv > 0.0) { fo = u8q(min(0.95, 1.0 - exp(-fgv / ${h(Ri)}))); }
    }
    if (ov) {
      if (kind != LIQUID) { tqv = tq(T); }
      fl = select(0u, 1u, cf[F_ALPHA * n + c] > 0.02);
      if (kind == GAS) {
        let pg = cf[F_PG * n + c];
        let pq = 128 + i32(rnd(127.0 * sign(pg) * sqrt(min(1.0, abs(pg) / ${h(Di)}))));
        p = u32(pq);
        pm = max(pm, u32(abs(pq - 128)));
        let og = FF_UG * P.nf;
        let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
        let v = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
        s = u32(rnd(255.0 * sqrt(min(1.0, sqrt(u * u + v * v) / ${h(ci)}))));
        vm = max(vm, s);
        let mv = cf[F_MV * n + c];
        let nd = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
        let nv = mv / M_H2O;
        var x = 0.0;
        if (nv + nd > 0.0) { x = nv / (nv + nd); }
        hu = u32(rnd(63.0 * clamp(x * pAt(c) / pSat(T), 0.0, 1.0)));
        va = u8q(mv / max(1e-12, cf[F_VGAS * n + c]) / ${h(Ei)});
      }
    }
    let sh = 8u * k;
    code |= cd << sh; crust |= cr << sh; glow |= gl << sh; fog |= fo << sh;
    flags |= fl << sh; pres |= p << sh; speed |= s << sh; hum |= hu << sh; vap |= va << sh;
    if (k < 2u) { t01 |= tqv << (16u * k); } else { t23 |= tqv << (16u * (k - 2u)); }
  }
  bko[base + w] = code;
  bko[base + K.oCrust + w] = crust;
  bko[base + K.oGlow + w] = glow;
  bko[base + K.oFog + w] = fog;
  if (!ov) { return; }
  bko[base + K.oFlags + w] = flags;
  bko[base + K.oTemp + 2u * w] = t01;
  bko[base + K.oTemp + 2u * w + 1u] = t23;
  bko[base + K.oPres + w] = pres;
  bko[base + K.oSpeed + w] = speed;
  bko[base + K.oHum + w] = hum;
  bko[base + K.oVap + w] = vap;
  if (pm > 0u) { atomicMax(&bkh[slot * 8u + 1u], pm); }
  if (vm > 0u) { atomicMax(&bkh[slot * 8u + 2u], vm); }
}`},{name:"bkLiqSplat",wg:128,bind:"P:u bkc:r<u32> lq:w parts:r ccount:r cstart:r bsum:r",code:`${Fe} {
  if (bkc[2] == 0u) { return; }
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
  var w = 0.0; var wt = 0.0; var wo = 0.0; var wsl = 0.0;
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
  lq[4u * t] = w; lq[4u * t + 1u] = wt; lq[4u * t + 2u] = wo; lq[4u * t + 3u] = wsl;
}`},{name:"bkLiqExt",wg:128,bind:"P:u bkc:r<u32> lqa:r lqb:w bkt:r<u32>",code:`${Fe} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  var src = t;
  if (bkt[t] != 0u) {
    let I = t % lx;
    let J = t / lx;
    var best = 0xffffffffu;
    var bw = lqa[4u * t];
    if (I > 0u && lqa[4u * (t - 1u)] > bw) { best = t - 1u; bw = lqa[4u * best]; }
    if (I + 1u < lx && lqa[4u * (t + 1u)] > bw) { best = t + 1u; bw = lqa[4u * best]; }
    if (J > 0u && lqa[4u * (t - lx)] > bw) { best = t - lx; bw = lqa[4u * best]; }
    if (J + 1u < ly && lqa[4u * (t + lx)] > bw) { best = t + lx; bw = lqa[4u * best]; }
    if (best != 0xffffffffu) { src = best; }
  }
  for (var k = 0u; k < 4u; k++) { lqb[4u * t + k] = lqa[4u * src + k]; }
}`},{name:"bkLiqBlurX",wg:128,bind:"P:u bkc:r<u32> lqa:r lq2:w",code:`${Fe} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lqa[4u * l + k] + 0.5 * lqa[4u * t + k] + 0.25 * lqa[4u * r + k]; }
}`},{name:"bkLiqOut",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> lq2:r bko:w<u32>",code:`${tt}
${Fe} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let J = t / lx;
  let b = select(t, t - lx, J > 0u);
  let u = select(t, t + lx, J + 1u < ly);
  let w = 0.25 * lq2[4u * b] + 0.5 * lq2[4u * t] + 0.25 * lq2[4u * u];
  let wt = 0.25 * lq2[4u * b + 1u] + 0.5 * lq2[4u * t + 1u] + 0.25 * lq2[4u * u + 1u];
  let wo = 0.25 * lq2[4u * b + 2u] + 0.5 * lq2[4u * t + 2u] + 0.25 * lq2[4u * u + 2u];
  let wsl = 0.25 * lq2[4u * b + 3u] + 0.5 * lq2[4u * t + 3u] + 0.25 * lq2[4u * u + 3u];
  let R = u32(floor(clamp(255.0 * w, 0.0, 255.0)));
  var G = 0u; var Bc = 0u; var A = 0u;
  if (w > 0.0) {
    G = u32(floor(clamp(255.0 * (wt / w - T0 - ${h(ue[0])}) / ${h(ue[1]-ue[0])}, 0.0, 255.0)));
    Bc = u32(floor(clamp(255.0 * wo / w, 0.0, 255.0)));
    A = u32(floor(clamp(255.0 * wsl / (w * ${h(Fr)}), 0.0, 255.0)));
  }
  bko[bkc[7] * K.sw + K.oLiq + t] = R | (G << 8u) | (Bc << 16u) | (A << 24u);
}`},{name:"bkArrows",wg:64,bind:"P:u K:u<Bk> bkc:r<u32> cu:r ff:r bko:w<u32>",code:`${tt}
${Fe} {
  if (bkc[2] == 0u || bkc[13] == 0u) { return; }
  let w = gid.x;
  if (w >= (K.na + 1u) / 2u) { return; }
  var word = 0u;
  for (var k = 0u; k < 2u; k++) {
    let qq = 2u * w + k;
    if (qq >= K.na) { break; }
    let i = i32(K.ahalf + (qq % K.nax) * K.astep);
    let j = i32(K.ahalf + (qq / K.nax) * K.astep);
    let c = cellOf(i, j);
    let kind = cu[U_KIND * P.n + c];
    var qu = 0; var qv = 0;
    if (kind == GAS || kind == LIQUID) {
      let o = select(FF_UG, FF_UL, kind == LIQUID) * P.nf;
      qu = velQ(0.5 * (ff[o + uF(i, j)] + ff[o + uF(i + 1, j)]));
      qv = velQ(0.5 * (ff[o + vF(i, j)] + ff[o + vF(i, j + 1)]));
    }
    word |= ((u32(qu) & 255u) | ((u32(qv) & 255u) << 8u)) << (16u * k);
  }
  bko[bkc[7] * K.sw + K.oArw + w] = word;
}`},{name:"bkBubbles",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> cnt:r<u32> bubs:r bko:w<u32> bkh:a",code:`${tt}
${Fe} {
  if (bkc[2] == 0u) { return; }
  let b = gid.x;
  let slot = bkc[7];
  let count = min(cnt[C_BCOUNT], K.bcap);
  if (b == 0u) { atomicStore(&bkh[slot * 8u + 3u], count); }
  if (b >= count) { return; }
  let Bb = bubs[b];
  let x = u32(rnd(65535.0 * clamp(Bb.x / P.boxw, 0.0, 1.0)));
  let y = u32(rnd(65535.0 * clamp(Bb.y / P.boxh, 0.0, 1.0)));
  var r = u32(min(65535.0, rnd(Bb.r * 1e6)));
  if (Bb.alive == 0u) { r = 0u; }
  let tot = Bb.mN + Bb.mO + Bb.mV;
  var air = 0u;
  if (tot > 0.0) { air = u32(rnd(65535.0 * (Bb.mN + Bb.mO) / tot)); }
  bko[slot * K.sw + K.oBub + 2u * b] = x | (y << 16u);
  bko[slot * K.sw + K.oBub + 2u * b + 1u] = r | (air << 16u);
}`},{name:"bkQuads",wg:64,bind:"P:u K:u<Bk> bkc:r<u32> cf:r bkm:r<u32> qs:r<u32> qc:r<u32> qw:r qx:r q0:r c0:r bko:w<u32>",code:`${tt}
${Fe} {
  if (bkc[2] == 0u) { return; }
  let qd = gid.x;
  if (qd >= K.nq) { return; }
  var T = q0[3u * qd];
  var Kc = q0[3u * qd + 1u];
  for (var e = qs[qd]; e < qs[qd + 1u]; e++) {
    let c = qc[e];
    if (bkm[c] == 0u) { continue; }
    T += qw[e] * (cf[F_T * P.n + c] - c0[c]);
    Kc += qx[e] * (cf[F_CRUST * P.n + c] - c0[P.n + c]);
  }
  let gl = u8q((T - T0 - 60.0) / 340.0);
  let cr = u8q(crustCov(max(Kc, 0.0), q0[3u * qd + 2u]));
  bko[bkc[7] * K.sw + K.oQuad + qd] = gl | (cr << 8u) | (tq(T) << 16u);
}`}],qt=(a,e,t=1)=>a.length>0?a:e(t);function Os(a,e,t){const i=a.grid,r=i.n,s=new Uint32Array(r);for(let P=0;P<r;P+=1)s[P]=e.body[P];const n=2*i.nx,c=2*i.ny,o=i.dx/2,f=new Uint32Array(n*c),d=new Float64Array(2),b=new Float64Array(4);let g=0;for(const P of a.bodies.list){if(P.gone)continue;P.worldBox(P.x,P.y,P.a,b);const q=Math.max(0,Math.floor(b[0]/o)),B=Math.min(n-1,Math.floor(b[2]/o)),R=Math.max(0,Math.floor(b[1]/o)),j=Math.min(c-1,Math.floor(b[3]/o));for(let N=R;N<=j;N+=1)for(let V=q;V<=B;V+=1)Mi.toLocal(P.x,P.y,P.a,(V+.5)*o,(N+.5)*o,d),P.insideLocal(d[0],d[1],0)&&f[V+N*n]===0&&(f[V+N*n]=1,g+=1)}const w=t.nq,D=t.nr,L=t.quads.slice(0,li*w),U=t.rects.slice(0,Ii*D),C=[0],S=[],v=[],M=[],x=[],O=[],m=[],T=new Float64Array(r);for(const P of a.bodies.list)if(!P.gone)for(let q=0;q<P.nw;q+=1)T[P.wc[q]]+=P.ww[q];for(const[P,q]of a.bodies.list.entries()){if(q.gone)continue;const B=new Map;for(let R=0;R<q.nw;R+=1){const j=q.wk[R];let N=B.get(j);N===void 0&&(N=[],B.set(j,N)),N.push([q.wc[R],q.ww[R]])}for(let R=0;R<q.nr;R+=1){const j=q.xs[R],N=q.ys[R];for(let V=0;V<q.nj[R];V+=1)for(let Y=0;Y<q.ni[R];Y+=1){const le=q.off[R]+Y+V*q.ni[R];for(const[I,Oe]of B.get(le)??[])S.push(I),v.push(Oe),M.push(T[I]>0?Oe/T[I]:0);C.push(S.length),x.push(q.cellT(le),q.crust[le],Math.max(1e-6,Math.min(j[Y+1]-j[Y],N[V+1]-N[V]))),O.push(P),m.push(le)}}}if(C.length-1!==w)throw new Error(`capture: ${C.length-1} quads from the bodies, ${w} in the frame`);const k=new Float32Array(2*r);for(let P=0;P<r;P+=1)k[P]=e.T[P],k[r+P]=i.crust[P];return{cellMask:s,texMask:f,texInBody:g,nq:w,nr:D,quadGeo:L,rects:U,qs:Uint32Array.from(C),qc:qt(Uint32Array.from(S),P=>new Uint32Array(P)),qw:qt(Float32Array.from(v),P=>new Float32Array(P)),qx:qt(Float32Array.from(M),P=>new Float32Array(P)),q0:qt(Float32Array.from(x),P=>new Float32Array(P),3),c0:k,quadBody:Int32Array.from(O),quadCell:Int32Array.from(m)}}function qs(a,e){const t=a.bodies.list;for(let i=0;i<e.nq;i+=1){const r=t[e.quadBody[i]],s=e.quadCell[i];e.q0[3*i]=r.cellT(s),e.q0[3*i+1]=r.crust[s]}}function Bs(a,e,t){for(let i=0;i<a.nq;i+=1){const r=li*i;for(let s=0;s<6;s+=1)t[r+s]=a.quadGeo[r+s];t[r+6]=e[i]&65535,t[r+7]=e[i]>>>16}}function Rs(a,e,t,i,r){const s=a*e,n=Math.ceil(s/4),c=Ui(t),o=c>>1,f=Gi(a,e,t),d=11*n,b=d+4*s,g=b+Math.ceil(f/2),w=g+2*i;return{sw:4*Math.ceil((w+Math.max(1,r))/4),flags:n,crust:2*n,glow:3*n,temp:4*n,pres:6*n,speed:7*n,hum:8*n,vap:9*n,fog:10*n,liq:d,arw:b,bub:g,quad:w,na:f,nax:Math.max(0,Math.ceil((a-o)/c)),astep:c,ahalf:o}}class Ds{constructor(e,t,i,r){l(this,"kmax");l(this,"lay");l(this,"bodies");l(this,"batchBytes");l(this,"headAt",4*xt);l(this,"slotAt");l(this,"g");l(this,"e");l(this,"own",[]);l(this,"bkc");l(this,"bko");l(this,"bkh");l(this,"q0");l(this,"c0");l(this,"groups");l(this,"quads");l(this,"rects");this.g=e,this.e=e.cpu;const s=e.state,n=s.staircase;if(n===null)throw new Error("capture: no staircase (state not uploaded)");this.bodies=Os(this.e,n,r);const c=this.e.grid,o=c.n;this.lay=Rs(c.nx,c.ny,c.dx,s.d.bcap,this.bodies.nq);const f=Math.fround(this.e.dtMax);this.kmax=Math.min(i,Math.ceil(i*f*t)+1),this.slotAt=this.headAt+4*W*this.kmax,this.batchBytes=this.slotAt+4*this.lay.sw*this.kmax;const d=e.ctx,b=(O,m,T)=>{const k=d.buffer(O,4*Math.max(4,m));return this.own.push(k),T!==void 0&&d.device.queue.writeBuffer(k,0,T),k},g=this.kmax+1,w=this.bodies;this.bkc=b("bkc",xt),this.bko=b("bko",this.lay.sw*g),this.bkh=b("bkh",W*g);const D=b("lq",16*o),L=b("lqE",16*o),U=b("lq2",16*o),C=this.lay,S=new Uint32Array(Ls);S.set([C.sw,this.kmax,Math.round(wt/t),s.d.bcap,C.flags,C.crust,C.glow,C.temp,C.pres,C.speed,C.hum,C.vap,C.fog,C.liq,C.arw,C.bub,C.quad,w.nq,C.na,C.nax,C.astep,C.ahalf,fr,0]);const v=d.uniform("bk",S.buffer);this.own.push(v),this.q0=b("q0",w.q0.length,w.q0),this.c0=b("c0",w.c0.length,w.c0);const M={P:s.params,K:v,glob:s.glob,cnt:s.cnt,cf:s.cf,cu:s.cu,ff:s.ff,reg:s.reg,parts:s.partsA,ccount:s.ccountB,cstart:s.cstart,bsum:s.bsum,bubs:s.bubs,bkc:this.bkc,bko:this.bko,bkh:this.bkh,lq:D,lq2:U,bkm:b("bkm",o,w.cellMask),bkt:b("bkt",4*o,w.texMask),qs:b("qs",w.qs.length,w.qs),qc:b("qc",w.qc.length,w.qc),qw:b("qw",w.qw.length,w.qw),qx:b("qx",w.qx.length,w.qx),q0:this.q0,c0:this.c0},x=(O,m={})=>d.bind(O,{...M,...m});this.groups={clock:x("bkClock"),cells:x("bkCells"),splat:x("bkLiqSplat"),ext1:x("bkLiqExt",{lqa:D,lqb:L}),ext2:x("bkLiqExt",{lqa:L,lqb:D}),blurX:x("bkLiqBlurX",{lqa:L}),out:x("bkLiqOut"),arrows:x("bkArrows"),bubbles:x("bkBubbles"),quads:x("bkQuads")},this.quads=new Uint16Array(Math.max(16,r.quads.length)),this.rects=new Uint16Array(Math.max(16,r.rects.length)),this.rects.set(w.rects)}start(e){const t=new Uint32Array(xt);t[_e.NEXT_LO]=Math.round(wt/e),t[_e.FRAMES]=1,t[_e.DT]=Math.round(Math.fround(Math.fround(this.e.dt)*wt)),this.g.ctx.device.queue.writeBuffer(this.bkc,0,t)}rebase(){const e=this.bodies;if(e.nq===0)return;qs(this.e,e);const t=this.g.ctx.device;t.queue.writeBuffer(this.q0,0,e.q0);const i=this.e.grid.n,r=this.g.state.cf,s=t.createCommandEncoder();s.copyBufferToBuffer(r,4*F.T*i,this.c0,0,4*i),s.copyBufferToBuffer(r,4*F.CRUST*i,this.c0,4*i,4*i),t.queue.submit([s.finish()])}begin(e){e.clearBuffer(this.bkc,4*_e.K,4)}encode(e){const t=this.g.ctx,i=this.e.grid.n,r=this.groups,s=e.beginComputePass();t.dispatch(s,"bkClock",r.clock,1),t.dispatch(s,"bkCells",r.cells,Math.ceil(i/4)),t.dispatch(s,"bkLiqSplat",r.splat,4*i),t.dispatch(s,"bkLiqExt",r.ext1,4*i),t.dispatch(s,"bkLiqExt",r.ext2,4*i),t.dispatch(s,"bkLiqExt",r.ext1,4*i),t.dispatch(s,"bkLiqBlurX",r.blurX,4*i),t.dispatch(s,"bkLiqOut",r.out,4*i),t.dispatch(s,"bkArrows",r.arrows,Math.ceil(this.lay.na/2)),t.dispatch(s,"bkBubbles",r.bubbles,this.g.state.d.bcap),t.dispatch(s,"bkQuads",r.quads,Math.max(1,this.bodies.nq)),s.end()}copyOut(e,t){e.copyBufferToBuffer(this.bkc,0,t,0,4*xt),e.copyBufferToBuffer(this.bkh,0,t,this.headAt,4*W*this.kmax),e.copyBufferToBuffer(this.bko,0,t,this.slotAt,4*this.lay.sw*this.kmax)}read(e){const t=new Uint32Array(e,0,xt);return{count:t[_e.K],lost:t[_e.LOST],captured:t[_e.FRAMES]}}index(e,t){return new Uint32Array(e,this.headAt+4*W*t,W)[qe.INDEX]}frame(e,t,i){return this.layersAt(e,this.headAt+4*W*t,this.slotAt+4*this.lay.sw*t,i)}copyFrame(e,t,i){const r=4*W+4*this.lay.sw,s=i!==null&&i.byteLength===r?i:new ArrayBuffer(r),n=new Uint8Array(s);return n.set(new Uint8Array(e,this.headAt+4*W*t,4*W),0),n.set(new Uint8Array(e,this.slotAt+4*this.lay.sw*t,4*this.lay.sw),4*W),s}layersAt(e,t,i,r){const s=new Uint32Array(e,t,W),n=s[qe.INDEX]===4294967295||s[qe.INDEX]%fr===0;return this.view(e,i,s,n,r)}view(e,t,i,r,s){const n=this.e.grid,c=n.n,o=this.lay,f=(g,w)=>new Uint8Array(e,t+4*g,w);s.nx=n.nx,s.ny=n.ny,s.dx=n.dx,s.depth=n.depth,s.boxW=n.w,s.boxH=n.h,s.t=(i[qe.HI]*2**32+i[qe.LO])/wt,s.code=f(0,c),s.flags=f(o.flags,c),s.crust=f(o.crust,c),s.glow=f(o.glow,c),s.temp=new Uint16Array(e,t+4*o.temp,c),s.pres=f(o.pres,c),s.speed=f(o.speed,c),s.hum=f(o.hum,c),s.vap=f(o.vap,c),s.fog=f(o.fog,c),s.liquid=f(o.liq,16*c),s.arrows=new Int8Array(e,t+4*o.arw,2*o.na),s.pmax=Math.max(1,ji(128+i[qe.PMAX])),s.vmax=Math.max(.02,Ni(i[qe.VMAX])),s.nb=i[qe.NB],s.bubbles=new Uint16Array(e,t+4*o.bub,4*this.g.state.d.bcap);let d=0,b=0;if(r){let g=0;for(let w=o.ahalf;w<n.ny;w+=o.astep)for(let D=o.ahalf;D<n.nx;D+=o.astep,g+=1){const L=s.code[D+w*n.nx]&3;if(L!==0&&L!==1)continue;const U=Math.hypot(Ar(s.arrows[2*g]),Ar(s.arrows[2*g+1]));L===0?d=Math.max(d,U):b=Math.max(b,U)}}return s.vGas=d,s.vLiq=b,Bs(this.bodies,new Uint32Array(e,t+4*o.quad,Math.max(1,this.bodies.nq)),this.quads),s.quads=this.quads,s.rects=this.rects,s.nq=this.bodies.nq,s.nr=this.bodies.nr,s}async probe(){const e=this.g.ctx.device,t=this.kmax;e.queue.writeBuffer(this.bkc,4*_e.PROBE,new Uint32Array([1]));const i=4*W+4*this.lay.sw,r=e.createBuffer({label:"probe",size:Math.ceil(i/16)*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=e.createCommandEncoder();this.encode(s),s.clearBuffer(this.bkc,4*_e.PROBE,4),s.copyBufferToBuffer(this.bkh,4*W*t,r,0,4*W),s.copyBufferToBuffer(this.bko,4*this.lay.sw*t,r,4*W,4*this.lay.sw),e.queue.submit([s.finish()]),await r.mapAsync(GPUMapMode.READ);const n=r.getMappedRange().slice(0);r.unmap(),r.destroy();const c=br();return this.view(n,4*W,new Uint32Array(n,0,W),!0,c),c.quads=c.quads.slice(),c.rects=c.rects.slice(),c}destroy(){this.g.ctx.release(this.own),this.own.length=0}}function br(){const a=new Uint8Array(0);return{nx:0,ny:0,dx:0,depth:0,boxW:0,boxH:0,t:0,code:a,flags:a,crust:a,glow:a,temp:new Uint16Array(0),pres:a,speed:a,hum:a,vap:a,fog:a,liquid:a,arrows:new Int8Array(0),pmax:1,vmax:.02,vGas:0,vLiq:0,nb:0,bubbles:new Uint16Array(0),nq:0,quads:new Uint16Array(0),nr:0,rects:new Uint16Array(0)}}class Es{constructor(e){l(this,"g");l(this,"last",null);l(this,"latent0",0);l(this,"stored0",0);l(this,"started",!1);this.g=e}vapour(){const e=this.g.totals;return e.produced-e.condensed+e.burstVapour}sample(){const e=this.g,t=e.last;if(t===null)return null;const i=e.totals,r=wr(e.cpu.regions.pAmb),s=Vi(r),n=e.budget(),c={t:i.time,heater:i.heater,solids:n.solids,sens:t.sensible,SG:i.fluxSG,LG:i.fluxLG,lossS:i.lossSolids,bub:n.bubbles,vap:this.vapour()},o=this.last;let f=0,d=0;if(o!==null&&c.t>o.t){const w=c.t-o.t,D=(c.heater-o.heater)/w,L=(c.solids-o.solids+c.SG-o.SG+c.lossS-o.lossS+c.LG-o.LG+c.sens-o.sens+c.bub-o.bub)/w;f=(c.vap-o.vap)/w,d=Math.max(0,(D-L)/s)}this.last=c;const b=this.vapour()*s,g=n.energy;return this.started||(this.started=!0,this.latent0=b,this.stored0=g),{t:i.time,waterT:t.waterT,waterTmax:t.waterTmax,Tsat:r,heater:i.heater,latent:b-this.latent0,sensible:g-this.stored0-(b-this.latent0),losses:i.lossWalls+i.lossOpen,escaped:i.escapedEnergy,liquid:n.water.liquid,vapour:n.water.vapour,fog:n.water.fog,film:n.water.film,bubbles:n.water.bubbles,escapedWater:n.water.escaped,vapourRate:f,expectedRate:d}}copyTo(e){const t=e;t.last=this.last===null?null:{...this.last},t.latent0=this.latent0,t.stored0=this.stored0,t.started=this.started}copyFrom(e){const t=e;this.last=t.last===null?null:{...t.last},this.latent0=t.latent0,this.stored0=t.stored0,this.started=t.started}}const he=Ce.solutes[0],kt=298.15,we=a=>a.map(h).join(", "),yt=14,Me=he.cp.range.lo,Ie=he.cp.range.hi,[hi,Ms,Is,js,Ns,Us]=he.cp.laliberte,Gs=a=>Math.exp(Ms*(a-ce)+Is*Math.exp(.01*(a-ce))),It=.5*(Ie-Me),Ze=new Array(yt).fill(0);{for(let e=0;e<64;e+=1){const t=Math.PI*(e+.5)/64,i=Gs(.5*(Ie+Me)+It*Math.cos(t));for(let r=0;r<yt;r+=1)Ze[r]+=2/64*i*Math.cos(r*t)}Ze[0]/=2}const vr=a=>a<yt?Ze[a]:0,bt=new Array(yt+1).fill(0);bt[1]=Ze[0]-vr(2)/2;for(let a=2;a<=yt;a+=1)bt[a]=(vr(a-1)-vr(a+1))/(2*a);const St=(a,e)=>{let t=0,i=0;for(let r=a.length-1;r>=1;r-=1){const s=2*e*t-i+a[r];i=t,t=s}return e*t-i+a[0]},jt=St(Ze,-1),gi=St(Ze,1),xr=St(bt,-1),bi=a=>{if(a<=Me)return jt*(a-ce);const e=jt*(Me-ce);return a>=Ie?e+It*(St(bt,1)-xr)+gi*(a-Ie):e+It*(St(bt,(2*a-Me-Ie)/(Ie-Me))-xr)},Vs=jt*(Me-ce),$s=bi(Ie),Hs=he.dHsol.v/fi+_r*(kt-ce)-1e3*hi*bi(kt);function Dr(a,e){const t=[`fn ${a}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let i=e.length-1;i>=1;i-=1)t.push(`  t = 2.0 * x * b1 - b2 + ${h(e[i])}; b2 = b1; b1 = t;`);return t.push(`  return x * b1 - b2 + ${h(e[0])};`,"}"),t.join(`
`)}const _t=he.pitzer,Bt=he.pitzerCold,Ws=Math.sqrt(2*Math.PI*Wi),Ks=Lr*Lr/(4*Math.PI*Ki*zi),rt=he.solubility.table,Ft=he.density.laliberte,zs=`
const S_TR: f32 = ${h(kt)};
const S_MS: f32 = ${h(fi)};
const S_MW: f32 = ${h($i)};
const S_NU: f32 = ${h(he.ions.v)};
const PZ_B: f32 = ${h(_t.b.v)};
const PZ_ALPHA: f32 = ${h(_t.alpha.v)};
const PZ_COLD: f32 = ${h(Bt.below.v)};
const PZ_B0 = array<f32, 6>(${we(_t.b0.a)});
const PZ_B1 = array<f32, 6>(${we(_t.b1.a)});
const PZ_C = array<f32, 6>(${we(_t.c.a)});
const PZC_B0 = array<f32, 6>(${we(Bt.b0.a)});
const PZC_B1 = array<f32, 6>(${we(Bt.b1.a)});
const PZC_C = array<f32, 6>(${we(Bt.c.a)});
const S_EPS = array<f32, 4>(${we(he.dielectric.c)});
const S_KN: f32 = ${h(Ws)};
const S_KLB: f32 = ${h(Ks)};
const SOL_T = array<f32, ${rt.length}>(${we(rt.map(a=>a[0]))});
const SOL_M = array<f32, ${rt.length}>(${we(rt.map(a=>a[1]))});
const LD0: f32 = ${h(Ft[0])};
const LD1: f32 = ${h(Ft[1])};
const LD2: f32 = ${h(Ft[2])};
const LD3: f32 = ${h(Ft[3])};
const LD4: f32 = ${h(Ft[4])};
const LA1: f32 = ${h(hi)};
const LA4: f32 = ${h(js)};
const LA5: f32 = ${h(Ns)};
const LA6: f32 = ${h(Us)};
const E_LO: f32 = ${h(Me)};
const E_HI: f32 = ${h(Ie)};
const E_LOV: f32 = ${h(jt)};
const E_HIV: f32 = ${h(gi)};
const E_HALF: f32 = ${h(It)};
const E_FM1: f32 = ${h(xr)};
const E_ILO: f32 = ${h(Vs)};
const E_IHI: f32 = ${h($s)};
const S_QS: f32 = ${h(Hs)};
const S_DMU: f32 = ${h(he.diffusivity.v*Hi(kt)/kt)};

${Dr("eCh",Ze)}
${Dr("iCh",bt)}
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
  for (var k = 1; k < ${rt.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${rt.length-1}];
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
`,vi=[],mt=new Map;{let a=[];const e=zs.split(`
`);for(let t=0;t<e.length;t+=1){const i=e[t];if(i.startsWith("const ")){vi.push(i),a=[];continue}if(i.startsWith("/*")){a=[i];continue}const r=/^fn (\w+)\(/.exec(i);if(r===null){i.trim()===""&&(a=[]);continue}const s=[...a,i];if(!i.trimEnd().endsWith("}"))for(;t+1<e.length&&e[t]!=="}";)t+=1,s.push(e[t]);mt.set(r[1],s.join(`
`)),a=[]}}const xi=a=>new RegExp(`\\b${a}\\s*\\(`),Qs=new Map([...mt.entries()].map(([a,e])=>[a,[...mt.keys()].filter(t=>t!==a&&xi(t).test(e))]));function Xs(a){const e=new Set,t=i=>{if(!e.has(i)){e.add(i);for(const r of Qs.get(i)??[])t(r)}};for(const i of mt.keys())xi(i).test(a)&&t(i);return e.size===0?"":[...vi,...[...mt.keys()].filter(i=>e.has(i)).map(i=>mt.get(i))].join(`
`)}class Zs{constructor(e){l(this,"name");l(this,"binds");l(this,"wg");l(this,"source");l(this,"pipeline",null);l(this,"layout",null);this.name=e.name,this.wg=e.wg??128,this.binds=Js(e.bind),this.source=rn(e,this.binds,this.wg)}}const Ys={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function Js(a){return a.trim().split(/\s+/).filter(Boolean).map(e=>{const t=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(e);if(t===null)throw new Error(`bad binding "${e}"`);const i=t[2],r=t[3]??(i==="u"?"Params":i==="a"?"atomic<u32>":Ys[t[1]]??"f32");return{name:t[1],mode:i,type:r}})}const en=`
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
`,tn=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function rn(a,e,t){const i=[Pr,`const WG: u32 = ${t}u;`,en],r=Xs(a.code);r!==""&&i.push(r);const s=new Set(e.map(n=>n.name));for(const n of e)n.mode==="a"&&s.add(`${n.name}!`);for(const n of tn)n.needs.every(c=>s.has(c))&&i.push(n.code);return e.forEach((n,c)=>{n.mode==="u"?i.push(`@group(0) @binding(${c}) var<uniform> ${n.name}: ${n.type};`):n.mode==="t"?i.push(`@group(0) @binding(${c}) var ${n.name}: texture_storage_2d<rgba8unorm, write>;`):n.mode==="x"?i.push(`@group(0) @binding(${c}) var ${n.name}: texture_2d<f32>;`):n.mode==="s"?i.push(`@group(0) @binding(${c}) var ${n.name}: sampler;`):n.mode==="r"?i.push(`@group(0) @binding(${c}) var<storage, read> ${n.name}: array<${n.type}>;`):n.mode==="w"?i.push(`@group(0) @binding(${c}) var<storage, read_write> ${n.name}: array<${n.type}>;`):(i.push(`@group(0) @binding(${c}) var<storage, read_write> ${n.name}: array<atomic<u32>>;`),i.push(`fn addF_${n.name}(i: u32, v: f32) {
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
fn maxU_${n.name}(i: u32, v: f32) { atomicMax(&${n.name}[i], bitcast<u32>(max(v, 0.0))); }
fn takeF_${n.name}(i: u32, want: f32, lim: f32) -> f32 {
  var old = atomicLoad(&${n.name}[i]);
  loop {
    let cur = bitcast<f32>(old);
    let t = clamp(lim - cur, 0.0, want);
    if (!(t > 0.0)) { return 0.0; }
    let r = atomicCompareExchangeWeak(&${n.name}[i], old, bitcast<u32>(cur + t));
    if (r.exchanged) { return t; }
    old = r.old_value;
  }
}`))}),i.push(a.code),i.join(`
`)}class kr{constructor(e){l(this,"device");l(this,"kernels",new Map);l(this,"timestamps");l(this,"adapter","");l(this,"bufs",[]);l(this,"profiler",null);this.device=e,this.timestamps=e.features.has("timestamp-query")}static async create(){const e=navigator.gpu;if(e===void 0)throw new Error("WebGPU is not available");const t=await e.requestAdapter({powerPreference:"high-performance"});if(t===null)throw new Error("no WebGPU adapter");const i=[];t.features.has("timestamp-query")&&i.push("timestamp-query");const r=t.limits,s=await t.requestDevice({requiredFeatures:i,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,r.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:r.maxStorageBufferBindingSize,maxBufferSize:r.maxBufferSize,maxComputeWorkgroupStorageSize:r.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,r.maxComputeInvocationsPerWorkgroup)}}),n=new kr(s),c=t.info;return c!==void 0&&(n.adapter=[c.vendor,c.architecture,c.description].filter(Boolean).join(" ")),n}async compile(e){const t=[];return await Promise.all(e.map(async i=>{const r=new Zs(i);this.kernels.set(i.name,r);const s=this.device.createShaderModule({code:r.source,label:i.name}),c=(await s.getCompilationInfo()).messages.filter(f=>f.type==="error");if(c.length>0){const f=r.source.split(`
`);for(const d of c)t.push(`${i.name}:${d.lineNum}:${d.linePos} ${d.message}
    ${f[d.lineNum-1]??""}`);return}const o=this.device.createBindGroupLayout({label:i.name,entries:r.binds.map((f,d)=>f.mode==="t"?{binding:d,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:f.mode==="x"?{binding:d,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:f.mode==="s"?{binding:d,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:d,visibility:GPUShaderStage.COMPUTE,buffer:{type:f.mode==="u"?"uniform":f.mode==="r"?"read-only-storage":"storage"}})});r.layout=o;try{r.pipeline=await this.device.createComputePipelineAsync({label:i.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[o]}),compute:{module:s,entryPoint:"main"}})}catch(f){t.push(`${i.name}: ${f instanceof Error?f.message:String(f)}`)}})),t}kernel(e){const t=this.kernels.get(e);if(t===void 0||t.pipeline===null)throw new Error(`kernel ${e} not compiled`);return t}bind(e,t){const i=this.kernel(e);return this.device.createBindGroup({label:e,layout:i.layout,entries:i.binds.map((r,s)=>{const n=t[r.name];if(n===void 0)throw new Error(`kernel ${e}: no resource for "${r.name}"`);return"view"in n?{binding:s,resource:n.view}:"sampler"in n?{binding:s,resource:n.sampler}:{binding:s,resource:"buffer"in n?{buffer:n.buffer,offset:n.offset,size:n.size}:{buffer:n}}})})}own(e,t){const i=this.profiler;if(i===null)return e;const r=2*i.names.length;return i.names.push(t),i.enc.beginComputePass({timestampWrites:{querySet:i.qs,beginningOfPassWriteIndex:r,endOfPassWriteIndex:r+1}})}dispatch(e,t,i,r){const s=this.kernel(t),n=this.own(e,t);n.setPipeline(s.pipeline),n.setBindGroup(0,i),n.dispatchWorkgroups(Math.max(1,Math.ceil(r/s.wg))),n!==e&&n.end()}dispatchIndirect(e,t,i,r){const s=this.kernel(t),n=this.own(e,t);n.setPipeline(s.pipeline),n.setBindGroup(0,i),n.dispatchWorkgroupsIndirect(r,0),n!==e&&n.end()}dispatchOne(e,t,i){const r=this.kernel(t),s=this.own(e,t);s.setPipeline(r.pipeline),s.setBindGroup(0,i),s.dispatchWorkgroups(1),s!==e&&s.end()}buffer(e,t,i=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const r=this.device.createBuffer({label:e,size:Math.max(16,Math.ceil(t/16)*16),usage:i});return this.bufs.push(r),r}uniform(e,t){const i=this.buffer(e,t.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(i,0,t),i}release(e){const t=new Set(e);for(const i of e)i.destroy();for(let i=this.bufs.length-1;i>=0;i-=1)t.has(this.bufs[i])&&this.bufs.splice(i,1)}destroy(){for(const e of this.bufs)e.destroy();this.bufs.length=0,this.device.destroy()}}const Er=64,Mr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",ot=`
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
`,Nt=`
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
`,sn=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,nn=`
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
`,an=[{name:"bubNucleate",wg:Er,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${ot}
${Nt}
${Mr} {
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
}`},{name:"bubAdvance",wg:Er,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${ot}
${Nt}
${sn}
${nn}
${Mr} {
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
}`}],je=64,Pe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",cn=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,Ir=`
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
`,ln=[{name:"bubTarget",wg:je,bind:"P:u cnt:a bubs:r btarget:w",code:`${Pe} {
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
}`},{name:"bubMerge",wg:je,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Pe} {
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
}`},{name:"bubMergeFinal",wg:je,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${ot}
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
  /* Wie BubbleModel.merge: bis zum nächsten Lösen das Volumen beider und der Radius dazu (α_b folgt höchstens mit ALPHA_RATE). */
  B.V = V;
  B.r = cbrtf(3.0 * V / (4.0 * PI));
  bubs[b] = B;
  for (var k = 0u; k < BACC_STRIDE; k++) { atomicStore(&bacc[o + k], 0u); }
}`},{name:"bubVent",wg:je,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${ot}
${Nt}
${Ir}
${Pe} {
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
}`},{name:"bubFinish",wg:je,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${ot}
${Nt}
${cn}
${Ir}
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
}`},{name:"bubCopyBack",wg:je,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Pe} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:je,bind:"P:u cnt:a bubs:r at:a",code:`${ot}
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
}`}],ye=128,de="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Ut=`
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
`,jr=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,er=`
var<workgroup> rr: array<f32, ${16*ye}>;
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
`,fn=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([a,e])=>({name:a,wg:ye,bind:"P:u cf:w cu:r at:w reg:r",code:`${Ut}
${de} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let k = cu[U_KIND * n + c];
  ${e===2?"":`
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
  if (k == SOLID) { cf[F_VGAS * n + c] = 0.0; cf[F_RHO * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; ${e===2?"cf[F_SRCV * n + c] = 0.0;":""} return; }
  ${e===2?"":`/* Flüssige Zelle ohne Gas, auch eben geleert (release, Wechsel der Zellart): Mole, Wärmekapazität und Dichte 0, wie Gas.deriveCell
     nach move — sonst zählte heatPrep die alte Wärmekapazität mit, und heatShare liesse Enthalpie in der leeren Zelle. */
  if (k == LIQUID && massOf(c) <= 0.0) {
    cf[F_VGAS * n + c] = 0.0; cf[F_VEOS * n + c] = 0.0; cf[F_NMOL * n + c] = 0.0; cf[F_CAP * n + c] = 0.0; cf[F_RHO * n + c] = 0.0;
    ${e===1?"cf[F_VEOSMID * n + c] = 0.0;":""}
    return;
  }
  deriveCell(c);`}
  var veos = 0.0;
  if (cf[F_VGAS * n + c] > 0.0) { veos = cf[F_NMOL * n + c] * R_GAS * cf[F_T * n + c] / pAt(c); }
  cf[F_VEOS * n + c] = veos;
  ${e===1?"cf[F_VEOSMID * n + c] = veos;":""}
  ${e===2?"cf[F_SRCV * n + c] = select(0.0, veos - cf[F_VEOSMID * n + c], k == GAS);":""}
}`})),{name:"transitions",wg:ye,bind:"P:u cf:r cu:r at:a cnt:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${de} {
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
}`},{name:"regCells",wg:ye,bind:"P:u cf:r cu:r racc:a",code:`${er}
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${er}
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
}`},{name:"regBubs",wg:ye,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${de} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([a,e])=>({name:a,wg:64,bind:"P:u reg:w racc:a",code:`${jr}
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
    ${e?"reg[o + R_P0START] = reg[o + R_P0]; reg[o + R_DP0] = 0.0;":""}
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compSums",wg:ye,bind:"P:u cf:r cu:r reg:r racc:a",code:`${er}
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([a,e])=>({name:a,wg:64,bind:"P:u reg:w racc:a",code:`${jr}
${de} {
  for (var r = lid3.x; r < P.nreg; r += 64u) {
    let o = r * REG_STRIDE;
    let a = r * RACC_STRIDE;
    if (reg[o + R_OPEN] == 0.0 && reg[o + R_VGAS] > 0.0) {
      let V = reg[o + R_VGAS];
      let pState = statePressure(getF_racc(a + RA_A), getF_racc(a + RA_B), V, reg[o + R_RHOBAR]);
      reg[o + R_P0] = pState;
      ${e===0?`let aa = R_GAS / V * getF_racc(a + RA_ACOMP);
      reg[o + R_KCOMP] = 1.0 / max(0.05, 1.0 - aa);
      reg[o + R_TOTAL] = 0.0;`:""}
      ${e<2?`var d = (pState - (reg[o + R_P0START] + reg[o + R_TOTAL])) * reg[o + R_KCOMP];
      if (abs(d) <= 1e-7 * pState) { d = 0.0; }
      reg[o + R_DP0] = d;
      reg[o + R_TOTAL] += d;`:"reg[o + R_DP0] = reg[o + R_TOTAL];"}
    }
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compApply",wg:ye,bind:"P:u cf:w cu:r reg:r",code:`${Ut}
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
}`},{name:"gasVolumes",wg:ye,bind:"P:u cf:w cu:r reg:r",code:`${de} {
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
}`},{name:"markFaces",wg:ye,bind:"P:u cu:r ff:w fu:w",code:`${de} {
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
}`}],tr=128,rr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",un=`
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
`,on=[...["viscJacA","viscJacB"].map(a=>{const[e,t]=a==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:a,wg:tr,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${rr} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  if (fu[fui(FU_KNOWN, f)] != 1u) { ff[ffi(${t}, f)] = ff[ffi(${e}, f)]; return; }
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
    if (kn == 1u) { let a = hm(e, ff[ffi(FF_ETA, g)]); diag += a; rhs += a * ff[ffi(${e}, g)]; }
    else if (kn == 2u) { diag += select(2.0 * e, e, along); }
  }
  ff[ffi(${t}, f)] = rhs / diag;
}`}}),{name:"viscForce",wg:tr,bind:"P:u ff:w fu:r",code:`${rr} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:tr,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${rr} {
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
}`}],Nr=`const THETA_MIN: f32 = ${Qi.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,Rt=128,Ne=128,ae="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ie=`
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
`,Ur=`
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
`,dn=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,Gr=1,mn=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${ae} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${Gr}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${ae} {
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
${ae} {
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
    pargs[0] = max(1u, (total + ${Rt-1}u) / ${Rt}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${ae} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:Ne,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${ie}
${dn}
${ae} {
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
}`},{name:"classify",wg:Ne,bind:"P:u cf:r cu:w",code:`${ae} {
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
}`},{name:"p2g",wg:Ne,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${Ur}
${ae} {
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
}`},{name:"liqAssemble",wg:Ne,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${Nr}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${ae} {
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
}`},{name:"liqPressure",wg:Ne,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${ae} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:Ne,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${Nr}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${ae} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([a,e,t,i,r,s])=>({name:a,wg:Ne,bind:"P:u ff:w fu:w",code:`${ae} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let os = ${e} * P.nf;
  let om = ${i} * P.nf;
  let mk = fu[om + f];
  if (mk != 0u) {
    ff[${t} * P.nf + f] = ff[os + f];
    fu[${r} * P.nf + f] = mk;
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
  if (n > 0.0) { ff[${t} * P.nf + f] = s / n; fu[${r} * P.nf + f] = 1u; }
  else { ff[${t} * P.nf + f] = ${s?"0.0":"ff[os + f]"}; fu[${r} * P.nf + f] = 0u; }
}`})),{name:"g2p",wg:Rt,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w",code:`${Ur}
${ie}
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
${un}
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
${ae} {
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
      q.flags = q.flags | ${Gr}u;
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
}`},{name:"heatWeights",wg:Rt,bind:"P:u cnt:a cu:r parts:w",code:`${ie}
${ae} {
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
}`}],ke=128,Se="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Vr=`
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
`,$r=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,Hr=`
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
`,pn=[{name:"gasMaxOut",wg:ke,bind:"P:u cu:r ff:r cnt:a",code:`${ie}
${Se} {
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
}`},{name:"gasFlux",wg:ke,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${Vr}
${$r}
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
${Se} {
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
}`},{name:"gasMove",wg:ke,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${Vr}
${$r}
${ie}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Se} {
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
}`},{name:"macFwd",wg:ke,bind:"P:u glob:r ff:w fu:r",code:`${Hr}
${Se} {
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
}`},{name:"macBack",wg:ke,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${Hr}
${Se} {
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
}`},{name:"viscosity",wg:ke,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Se} {
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
}`},{name:"gasAssemble",wg:ke,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Se} {
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
}`},{name:"gasPressure",wg:ke,bind:"P:u cf:w cu:r cgv:r",code:`${Se} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:ke,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Se} {
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
}`}],Be=128,Re="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",be=`
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
`,Sr=`
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
`,hn=`
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
`,gn=[...[["gatherFull",!0],["gatherPlain",!1]].map(([a,e])=>({name:a,wg:Be,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${be}
${Re} {
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
  ${e?`setF_at(A_CHF * n + c, 0.0);
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
}`})),{name:"applyMass",wg:Be,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${be}
${ie}
${Sr}
${Re} {
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
}`},{name:"diffPrep",wg:Be,bind:"P:u cf:w cu:w reg:r",code:`${Re} {
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
}`},{name:"diffAssemble",wg:Be,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${hn}
${Re} {
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
}`},{name:"diffFaces",wg:Be,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${Re} {
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
}`},{name:"diffOut",wg:Be,bind:"P:u glob:r cnt:a cf:w cu:r ff:r cgv:r",code:`/* Was die Gaszelle g über ihre Seite k aus der Flüssigkeit verdunsten lässt (genau das F, das diffApply bucht; sonst 0). */
fn evapFrom(g: u32, k: u32) -> f32 {
  let n = P.n;
  if (cu[U_KIND * n + g] != GAS || cu[U_EDGE * n + g] == 0u || !(cf[F_MTOT * n + g] > 0.0)) { return 0.0; }
  let G = cf[(F_BG + k) * n + g];
  if (!(G > 0.0)) { return 0.0; }
  return max(0.0, glob[G_DT] * G * (cf[(F_BY + k) * n + g] - cgv[s0(g)]));
}
${Re} {
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
}`},{name:"diffApply",wg:Be,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${ie}
${Re} {
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
}`},{name:"latentSrc",wg:Be,bind:"P:u glob:r cf:r at:a",code:`${Re} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],Wr=[.125,.75,.125];function bn(a){const e=a.grid,{n:t,nx:i,ny:r,dx:s}=e,n=new Uint8Array(t),c=Uint8Array.from(e.kind),o=new Uint8Array(t),f=new Uint8Array(t),d=new Uint32Array(t),b=new Float64Array(t),g=new Float64Array(t),w=Float32Array.from(e.T),D=a.heat.heaters.map(()=>0),L=new Float64Array(Math.max(1,a.regions.count)),U=a.bodies.list,C=new Uint8Array(t);for(let m=0;m<t;m+=1)e.owner[m]!==0&&e.matB[m]!==0&&(e.solid[m]!==0||e.fs[m]>.5)&&(C[m]=1);const S=(m,T)=>{if(C[m]!==0||C[T]!==0)return;const k=e.owner[m]!==0&&e.matB[m]!==0?e.fs[m]:-1,P=e.owner[T]!==0&&e.matB[T]!==0?e.fs[T]:-1;k<0&&P<0||(C[P>k?T:m]=1)};for(let m=0;m<r;m+=1)for(let T=1;T<i;T+=1)e.au[T+m*(i+1)]<=0&&S(T-1+m*i,T+m*i);for(let m=1;m<r;m+=1)for(let T=0;T<i;T+=1)e.av[T+m*i]<=0&&S(T+(m-1)*i,T+m*i);for(let m=0;m<t;m+=1){if(o[m]=e.solid[m],f[m]=e.kind[m],d[m]=e.role[m]===1&&e.heater[m]>=0?e.heater[m]+1:0,b[m]=e.Es[m],g[m]=e.film[m],C[m]===0)continue;const T=e.owner[m],k=e.solid[m]!==0,P=U[T-1],q=e.matB[m]-1,B=Pt[q];if(n[m]=1,!k){const j=a.regions.id[m];j>=0&&(L[j]+=(1-e.fs[m])*e.vCell)}o[m]=q+1,f[m]=ui;const R=e.Ts[m]>0?e.Ts[m]:oi(e.Es[m],e.capB[m],e.film[m],e.crust[m],e.T[m]);b[m]=(B.rho*B.cp*e.vCell+e.crust[m]*_r)*(R-ce)+e.film[m]*Xi(R),w[m]=R,P!==void 0&&P.heater>=0&&P.heater<D.length&&(d[m]=P.heater+1,D[P.heater]+=1)}for(let m=0;m<t;m+=1)n[m]===0&&d[m]>0&&d[m]<=D.length&&(D[d[m]-1]+=1);const v=(m,T)=>m<0?e.openL?0:1:m>=i?e.openR?0:1:T<0?e.openB?0:1:T>=r?e.openT?0:1:o[m+T*i]!==0?1:0,M=new Float32Array(t),x=new Float32Array(t);for(let m=0;m<r;m+=1)for(let T=0;T<i;T+=1){const k=T+m*i;if(o[k]!==0){M[k]=1;continue}let P=0;for(let q=-1;q<=1;q+=1)for(let B=-1;B<=1;B+=1)P+=Wr[B+1]*Wr[q+1]*v(T+B,m+q);M[k]=P}const O=4;for(let m=0;m<r;m+=1)for(let T=0;T<i;T+=1){const k=T+m*i,P=o[k]!==0,q=(T+.5)*s,B=(m+.5)*s;let R=O*s;P||(e.openL||(R=Math.min(R,q)),e.openR||(R=Math.min(R,e.w-q)),e.openB||(R=Math.min(R,B)),e.openT||(R=Math.min(R,e.h-B)));for(let j=-O;j<=O;j+=1){const N=m+j;if(!(N<0||N>=r))for(let V=-O;V<=O;V+=1){const Y=T+V;if(Y<0||Y>=i||o[Y+N*i]!==0===P)continue;const le=Math.max(0,Math.abs(V)-.5)*s,I=Math.max(0,Math.abs(j)-.5)*s;R=Math.min(R,Math.hypot(le,I))}}x[k]=P?-R:R}return{body:n,kindCpu:c,solid:o,kind:f,hgrp:d,es:b,film:g,T:w,phiS:M,sdf:x,heaterCells:D,vFix:L}}function vn(a,e){if(e===null)return;const t=a.grid,i=t.n;for(let r=0;r<i;r+=1){if(e.body[r]===0)continue;const s=Pt[e.solid[r]-1],n=oi(t.Es[r],s.rho*s.cp*t.vCell,t.film[r],t.crust[r],t.T[r]);t.Es[r]=Zi(t.capB[r],t.film[r],t.crust[r],n),t.solid[r]===0&&(t.kind[r]=e.kindCpu[r])}a.bodies.cover.collect(a.bodies.list);for(let r=0;r<i;r+=1)e.body[r]!==0&&t.capB[r]>0&&a.heat.deriveSolid(r)}const ft=800,xn=24,Kr=6,Q=4,pt=16,J=256,zr=`struct Levels { lv: array<Level, ${pt}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Tt=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,Et=`${Tt}
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
`,Ae=`
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
`,Ue=`
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
`,Qr=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,Xr=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,H="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",De=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,_i=6,it=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,ir=`
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
`,sr="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",_n=[{name:"cgPrep1",wg:J,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Tt}
${H} {
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
}`},{name:"cgPrep2",wg:J,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${De}
${Et}
${H} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${_i}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:J,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${H} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:J,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${De}
${ir}
${it}
${H} {
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
}`},{name:"cclProject",wg:J,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${De}
${sr}
${it}
${H} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:J,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${De}
${Tt}
${Ue}
${H} {
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
}`},{name:"cgFoldInitMG",wg:J,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${Ue}
${Xr}
${H} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:J,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${De}
${Ae}
${Ue}
${Qr}
${H} {
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
}`},{name:"cgB",wg:J,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${De}
${Ae}
${Ue}
${Qr}
var<workgroup> wpq: f32;
${H} {
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
}`},{name:"cgFoldRR",wg:J,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Ae}
${Ue}
${Xr}
${H} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:J,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Ae}
${Ue}
${H} {
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
}`},{name:"cgZSum",wg:J,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Ae}
${ir}
${it}
${H} {
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
}`},{name:"cgZSub",wg:J,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Ae}
${sr}
${it}
${Ue}
${H} {
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
}`},{name:"cgEnd1",wg:J,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${De}
${ir}
${it}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${H} {
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
}`},{name:"cgEnd2",wg:J,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${De}
${sr}
${it}
${H} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Fn=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function wn(a,e){const t=[];let i=0,r=0,s=a,n=e,c=1,o=0;for(;;){const d=s+2,b=(s+2)*(n+2),g={};for(const L of Fn)g[L]=i,i+=b;const w=r;r+=b;let D=0;if(g.pW=0,t.length>0&&(g.pW=i,i+=4*o,D=r,r+=4*o),t.push({nx:s,ny:n,stride:d,size:b,h:c,f:g,act:w,pIdx:D}),s*n<=xn||s<=2&&n<=2||t.length>=pt)break;o=b,s=Math.ceil(s/2),n=Math.ceil(n/2),c*=2}let f=t.length-1;for(let d=0;d<t.length;d+=1){let b=0;for(let g=d;g<t.length;g+=1)b+=t[g].size;if(b<=ft){f=d;break}}return{levels:t,fSize:i,uSize:r,lt:f}}function Dt(a,e,t,i){if(a===null)return;const r=[a.nx,a.ny,a.stride,a.size,a.f.ax,a.f.ay,a.f.dH,a.f.dDx,a.f.dDy,a.f.diag,a.f.inv,a.f.x,a.f.b,a.h,a.f.gx,a.f.gy,a.f.gDx,a.f.gDy,a.f.eDx,a.f.eDy,a.f.area,a.f.ox,a.f.oy,a.act,a.pIdx,a.f.pW,e,a.f.xp,0,0,0,0];t.set(r,i)}const Fi={tol:1e-5,it:p.IT_L,cap:p.CAP_L,res:p.RES_L},wi={tol:1e-5,it:p.IT_G,cap:p.CAP_G,res:p.RES_G},Pi={tol:1e-5,it:p.IT_H,cap:p.CAP_H,res:p.RES_H},ki={tol:1e-5,it:p.IT_D,cap:p.CAP_D,res:p.RES_H},st=200,me=256;class Pn{constructor(e,t,i){l(this,"ctx");l(this,"plan");l(this,"b");l(this,"l0");l(this,"lp");l(this,"lv");l(this,"it");l(this,"cfg");l(this,"kinds",[]);l(this,"groups",new Map);l(this,"n0cells");this.ctx=e,this.plan=t,this.b=i;const r=t.levels;this.n0cells=r[0].nx*r[0].ny;const s=new Uint32Array(32);Dt(r[0],0,s,0),this.l0=e.uniform("l0",s.buffer);const n=new Uint32Array(me/4*r.length);for(let f=0;f<r.length;f+=1)Dt(f>0?r[f-1]:null,f-1,n,me/4*f),Dt(r[f],f,n,me/4*f+32);this.lp=e.uniform("lp",n.buffer);const c=new Uint32Array(32*pt+4);for(let f=0;f<r.length;f+=1)Dt(r[f],f,c,32*f);c[32*pt]=t.lt,c[32*pt+1]=r.length,this.lv=e.uniform("lv",c.buffer);const o=new Uint32Array(me/4*(st+1));for(let f=0;f<st;f+=1)o[me/4*f]=f;o[me/4*st]=4294967295,this.it=e.uniform("iter",o.buffer),this.cfg=e.uniform("solvecfg",new ArrayBuffer(me*4));for(const f of[Fi,wi,Pi,ki])this.setKind(f)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(e){let t=this.kinds.indexOf(e);if(t>=0)return t;t=this.kinds.length,this.kinds.push(e);const i=new ArrayBuffer(16);return new Float32Array(i,0,1)[0]=e.tol*e.tol,new Uint32Array(i,4,3).set([e.it,e.cap,e.res]),this.ctx.device.queue.writeBuffer(this.cfg,me*t,i),t}setTolerance(e,t){const i=this.setKind(e);this.ctx.device.queue.writeBuffer(this.cfg,me*i,new Float32Array([t*t]))}range(e,t,i){return{buffer:e,offset:me*t,size:i}}group(e,t,i){const r=`${e}|${t}`;let s=this.groups.get(r);if(s===void 0){const n=this.b;s=this.ctx.bind(e,{P:n.params,mgF:n.mgF,mgU:n.mgU,cgv:n.cgv,cgs:n.cgs,lab:n.lab,cfl:n.cfl,csum:n.csum,cnt:n.cnt,cgp:n.cgp,L:this.l0,LV:this.lv,...i}),this.groups.set(r,s)}return s}run(e,t,i,r="",s={}){this.ctx.dispatch(e,t,this.group(t,r,s),i)}one(e,t,i="",r={}){this.ctx.dispatchOne(e,t,this.group(t,i,r))}lpRes(e){return this.range(this.lp,e,me)}itRes(e){return this.range(this.it,e,16)}prepare(e,t,i){const r=this.setKind(t),s={SV:this.range(this.cfg,r,16)},n=this.n0cells;this.run(e,"cgPrep1",n,`c${r}`,s),this.run(e,"cgPrep2",n),i&&(this.run(e,"cclMerge",n),this.run(e,"cclFinal",n),this.run(e,"cclProject",n)),this.coarsen(e),this.run(e,"cgInitMG",n),this.ctx.dispatchOne(e,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(e){const{levels:t,lt:i}=this.plan;for(let r=1;r<t.length&&r<=i;r+=1){const s=t[r],n=t[r-1],c={LP:this.lpRes(r)};this.run(e,"mgC1",s.nx*s.ny,`l${r}`,c),this.run(e,"mgC2",s.nx*s.ny,`l${r}`,c),this.run(e,"mgC3",s.nx*s.ny,`l${r}`,c),this.run(e,"mgC4",n.nx*n.ny,`l${r}`,c)}i+1<t.length&&this.ctx.dispatchOne(e,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(e){const{levels:t,lt:i}=this.plan,r=n=>256*Math.ceil(n.nx/16)*Math.ceil(n.ny/16),s=n=>256*Math.ceil(n.nx/12)*Math.ceil(n.ny/12);for(let n=0;n<i;n+=1)this.run(e,"mgPreR",s(t[n]),`l${n+1}`,{LP:this.lpRes(n+1)});this.ctx.dispatchOne(e,"mgTail",this.group("mgTail","",{}));for(let n=i-1;n>=0;n-=1)this.run(e,"mgPost",r(t[n]),`l${n+1}`,{LP:this.lpRes(n+1)})}encodeMG(e,t,i,r=!0,s=r){const n=this.n0cells;this.prepare(e,t,r);const c=(f,d)=>{const b={IT:this.itRes(f)};s?(this.run(e,"cgZSum",n,d,b),this.run(e,"cgZSub",n,d,b)):this.run(e,"cgRZ",n,d,b)};this.vcycle(e),c(st,`k${st}`);const o=Math.min(st,Math.max(1,i));for(let f=0;f<o;f+=1){const d={IT:this.itRes(f)};this.run(e,"cgA",n,`k${f}`,d),this.run(e,"cgB",n,`k${f}`,d),this.one(e,"cgFoldRR",`k${f}`,d),this.vcycle(e),c(f,`k${f}`)}this.finish(e,t,r)}finish(e,t,i){const r=this.setKind(t);this.run(e,"cgEnd1",this.n0cells,`c${r}`,{SV:this.range(this.cfg,r,16)}),i&&this.run(e,"cgEnd2",this.n0cells)}}const ht=16,Zr=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;function kn(a){const e=a.grid,t=e.n,i=new Float64Array(t),r=new Float64Array(t),s=new Float64Array(t);for(let n=0;n<t;n+=1){const c=e.mg[He*t+n],o=e.mg[We*t+n],f=e.mg[Ke*t+n];i[n]=c/$t[He]+o/$t[We]+f/$t[Ke],r[n]=c+o+f+e.mfog[n]<=1e-30?18e-6:es(c,o,f,e.T[n]),s[n]=e.kind[n]===ui||a.gas.vgas[n]<=0?0:i[n]*ni*e.T[n]/a.regions.pAt(n)}return{nmol:i,mu:r,veos:s}}class Sn{constructor(e,t){l(this,"stair",null);l(this,"ctx");l(this,"d");l(this,"plan");l(this,"params");l(this,"glob");l(this,"cnt");l(this,"cf");l(this,"cu");l(this,"at");l(this,"ff");l(this,"fu");l(this,"af");l(this,"partsA");l(this,"partsB");l(this,"ccountA");l(this,"ccountB");l(this,"cstart");l(this,"bsum");l(this,"pkey");l(this,"pslot");l(this,"pargs");l(this,"bubs");l(this,"bubs2");l(this,"bacc");l(this,"btarget");l(this,"sites");l(this,"sbub");l(this,"reg");l(this,"racc");l(this,"heat");l(this,"hacc");l(this,"mgF");l(this,"mgU");l(this,"cgv");l(this,"cgs");l(this,"lab");l(this,"cfl");l(this,"csum");l(this,"cgp");l(this,"meas");l(this,"probe");l(this,"regionMap",new Int32Array(0));l(this,"regionInv",new Int32Array(0));l(this,"measGroups");l(this,"nsites",0);l(this,"own",[]);this.ctx=e;const i=t.grid,r=Math.max(1024,2*t.bubbleModel.cavities.count);this.d={nx:i.nx,ny:i.ny,n:i.n,nu:i.nu,nv:i.nv,nf:i.nu+i.nv,n0:(i.nx+2)*(i.ny+2),pcap:t.particles.cap,bcap:t.bubbles.cap,nsites:r,nreg:Math.max(64,2*t.regions.count),nheat:Math.max(16,2*t.heat.heaters.length)};const s=this.d;this.plan=wn(i.nx,i.ny);const n=(o,f,d=Zr)=>{const b=e.buffer(o,4*Math.max(4,f),d);return this.own.push(b),b};this.params=n("params",Rr,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=n("glob",dt),this.cnt=n("cnt",ze),this.cf=n("cf",Kt*s.n),this.cu=n("cu",zt*s.n),this.at=n("at",Qt*s.n),this.ff=n("ff",Xt*s.nf),this.fu=n("fu",Br*s.nf),this.af=n("af",Zt*s.nf),this.partsA=n("partsA",Je*s.pcap),this.partsB=n("partsB",Je*s.pcap),this.ccountA=n("ccountA",s.n+4),this.ccountB=n("ccountB",s.n+4),this.cstart=n("cstart",s.n+4),this.bsum=n("bsum",Math.ceil(s.n/1024)+4),this.pkey=n("pkey",s.pcap),this.pslot=n("pslot",s.pcap),this.pargs=n("pargs",8,Zr|GPUBufferUsage.INDIRECT),this.bubs=n("bubs",et*s.bcap),this.bubs2=n("bubs2",et*s.bcap),this.bacc=n("bacc",hr*s.bcap),this.btarget=n("btarget",s.bcap),this.sites=n("sites",Jt*s.nsites),this.sbub=n("sbub",s.nsites),this.reg=n("reg",ge*s.nreg),this.racc=n("racc",dr*s.nreg),this.heat=n("heat",pe*s.nheat),this.hacc=n("hacc",mr*s.nheat),this.mgF=n("mgF",this.plan.fSize),this.mgU=n("mgU",this.plan.uSize),this.cgv=n("cgv",5*s.n0),this.cgs=n("cgs",di),this.lab=n("lab",s.n0),this.cfl=n("cfl",s.n0),this.csum=n("csum",_i*s.n0),this.cgp=n("cgp",4*Math.ceil(s.nx*s.ny/256)+16);const c=256;this.measGroups=[Math.ceil(s.n/c),Math.ceil(s.pcap/c),Math.ceil(s.bcap/c)],this.meas=n("meas",ht*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=n("probe",64)}get staircase(){return this.stair}fits(e){const t=this.d;return e.grid.nx===t.nx&&e.grid.ny===t.ny&&e.particles.cap===t.pcap&&e.bubbles.cap===t.bcap&&e.bubbleModel.cavities.count<=t.nsites&&e.regions.count<=t.nreg&&e.heat.heaters.length<=t.nheat}destroy(){this.ctx.release(this.own),this.own.length=0}writeParams(e){const t=this.d,i=e.grid,r=new ArrayBuffer(4*Rr),s=new Uint32Array(r),n=new Float32Array(r);s.set([t.nx,t.ny,t.n,t.nu,t.nv,t.nf,t.pcap,t.bcap,e.bubbleModel.cavities.count,e.regions.count,e.heat.heaters.length,t.n0],0),n.set([i.dx,i.depth,i.vCell,i.aFace,1/i.dx,i.w,i.h,e.dtMax],12),n.set([e.gy,e.pRef,e.regions.pAmb,e.regions.rhoAmb,e.ambientT,e.heat.hExt,e.tol,e.heat.liquidPower],20);const c=e.gas.amb;n.set([c[0],c[1],c[2],c[4]],28),n.set([e.ambientY[He],e.ambientY[We],e.ambientY[Ke],wr(e.regions.pAmb)],32),s.set([i.openL?1:0,i.openR?1:0,i.openB?1:0,i.openT?1:0],36);let o=0;for(let d=0;d<e.regions.count;d+=1)e.regions.open[d]===0&&(o=1);s[40]=o,s[41]=e.optionsUsed.harness===!0?1:0,n[42]=e.bubbleModel.contactAngleOverride??-1,s[43]=e.particles.hasOther()?1:0;const f=Yi(e.scene.extremes,e.regions.pAmb,Math.abs(e.gy));n.set([f.chf,f.actMax,f.vmax,f.bubCap],44),this.ctx.device.queue.writeBuffer(this.params,0,r)}writeHeaters(e,t=null){const i=e.heat.heaters,r=new Float32Array(pe*this.d.nheat);i.forEach((s,n)=>{var o;const c=pe*n;r[c+Z.MODE]=s.mode==="thermostat"?1:0,r[c+Z.POWER]=s.power,r[c+Z.TARGET]=s.target,r[c+Z.ON]=s.on?1:0,r[c+Z.P]=s.P,r[c+Z.TMEAN]=s.Tmean,r[c+Z.INTEGRAL]=s.integral,r[c+Z.CELLS]=t!==null?t[n]??0:((o=this.stair)==null?void 0:o.heaterCells[n])??s.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,r)}writeHeaterSettings(e,t){const i=e.heat.heaters[t];i===void 0||t>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*pe*t,new Float32Array([i.mode==="thermostat"?1:0,i.power,i.target,i.on?1:0]))}upload(e){const t=this.ctx.device.queue,i=this.d,r=e.grid,s=i.n,n=bn(e);this.stair=n,this.writeParams(e),this.writeHeaters(e,n.heaterCells);const c=e.regions,o=Array.from({length:c.count},(u,E)=>E).sort((u,E)=>c.vFluid[E]-c.vFluid[u]);this.regionMap=new Int32Array(Math.max(1,c.count)),this.regionInv=new Int32Array(Math.max(1,c.count)),o.forEach((u,E)=>{this.regionMap[u]=E,this.regionInv[E]=u});const f=new Float32Array(ge*i.nreg);for(let u=0;u<c.count;u+=1){const E=ge*this.regionMap[u];f[E+te.OPEN]=c.open[u],f[E+te.VFLUID]=c.vFluid[u]-n.vFix[u],f[E+te.P0]=c.p0[u],f[E+te.RHOBAR]=c.rhoBar[u],f[E+te.VLIQ]=c.vLiq[u],f[E+te.VBUB]=c.vBub[u],f[E+te.VGAS]=c.vGas[u],f[E+te.P0START]=c.p0[u]}t.writeBuffer(this.reg,0,f);const d=new Uint32Array(zt*s);for(let u=0;u<s;u+=1){d[$e.KIND*s+u]=n.kind[u],d[$e.KPREV*s+u]=n.kind[u],d[$e.SOLID*s+u]=n.solid[u],d[$e.HGRP*s+u]=n.hgrp[u];const E=c.id[u];d[$e.RID*s+u]=E<0?Yt:this.regionMap[E]}t.writeBuffer(this.cu,0,d);const b=new Float32Array(Kt*s),g=(u,E,$=0)=>{for(let z=0;z<s;z+=1)b[u*s+z]=E[$+z]};g(F.PHI,r.phi),g(F.ALPHA,r.alpha),g(F.ALPHAOLD,r.alpha),g(F.PL,r.pl),g(F.PG,r.pg),g(F.MN,r.mg,He*s),g(F.MO,r.mg,We*s),g(F.MV,r.mg,Ke*s),g(F.MF,r.mfog),g(F.HG,r.Hg),g(F.ES,n.es),g(F.FILM,n.film),g(F.T,n.T),g(F.TL,r.Tl),g(F.CL,r.Cl);const w=e.gas,D=kn(e);g(F.VGAS,w.vgas),g(F.RHO,w.rho),g(F.NMOL,D.nmol),g(F.CAP,w.cap),g(F.MU,D.mu),g(F.VEOS,D.veos),g(F.SRCV,w.srcV),g(F.VEOSMID,D.veos),g(F.PHIS,n.phiS),g(F.SDF,n.sdf),g(F.PTL,n.T),g(F.CRUST,r.crust);for(let u=0;u<r.nx;u+=1)b[F.FLOOR*s+u]=e.salt.floor[u],b[F.FLOORH*s+u]=e.salt.floorH[u];b.fill(1,F.AW*s,(F.AW+1)*s),t.writeBuffer(this.cf,0,b);const L=new Float32Array(Qt*s);for(let u=0;u<s;u+=1)L[pr.VOLSRC*s+u]=e.liquid.volSrc[u];t.writeBuffer(this.at,0,L);const U=i.nf,C=new Float32Array(Xt*U);for(let u=0;u<i.nu;u+=1)C[Te.UL*U+u]=r.ul[u],C[Te.UG*U+u]=r.ug[u];for(let u=0;u<i.nv;u+=1)C[Te.UL*U+i.nu+u]=r.vl[u],C[Te.UG*U+i.nu+u]=r.vg[u];t.writeBuffer(this.ff,0,C),t.writeBuffer(this.fu,0,new Uint32Array(Br*U));const S=new Float32Array(Zt*U);for(let u=0;u<i.nu;u+=1)S[u]=e.liquid.fU[u];for(let u=0;u<i.nv;u+=1)S[i.nu+u]=e.liquid.fV[u];t.writeBuffer(this.af,0,S);const v=e.particles,M=e.liquid,x=new ArrayBuffer(4*Je*Math.max(1,v.count)),O=new Float32Array(x),m=new Uint32Array(x),T=new Int32Array(x);for(let u=0;u<v.count;u+=1){const E=Je*u;O.set([v.x[u],v.y[u],v.vx[u],v.vy[u],v.c00[u],v.c01[u],v.c10[u],v.c11[u],v.mass[u],v.h[u],v.T[u],v.rho[u],M.dVp[u]],E),m[E+13]=(v.mat[u]&255)<<8,m[E+14]=v.id[u],T[E+15]=M.bi[u],T[E+16]=M.bj[u];for(let $=0;$<9;$+=1)O[E+17+$]=M.wt[9*u+$];O[E+26]=v.smass[2*u]}v.count>0&&t.writeBuffer(this.partsA,0,x);const k=e.bubbles,P=e.bubbleModel.motionState,q=new ArrayBuffer(4*et*Math.max(1,k.count)),B=new Float32Array(q),R=new Uint32Array(q),j=new Int32Array(q);for(let u=0;u<k.count;u+=1){const E=et*u,$=u*Vt;B.set([k.x[u],k.y[u],k.z[u],k.vx[u],k.vy[u],k.m[$+He],k.m[$+We],k.m[$+Ke],k.H[u],k.age[u]],E),j[E+10]=k.site[u],B.set([k.r[u],k.V[u],k.pb[u],k.pv[u],k.Tb[u],k.dmdt[u],P.ux0[u],P.uy0[u]],E+11),R[E+19]=k.id[u],R[E+20]=1;for(let z=0;z<At;z+=1)B[E+21+z]=k.force[u*At+z]}k.count>0&&t.writeBuffer(this.bubs,0,q);const N=e.bubbleModel.cavities;this.nsites=N.count;const V=new ArrayBuffer(4*Jt*i.nsites),Y=new Uint32Array(V),le=new Float32Array(V),I=r.nx;for(let u=0;u<N.count;u+=1){const E=Jt*u;let $=N.cell[u],z=N.r[u];if($>=0&&n.solid[$]===0){const vt=N.dir[u],Ye=vt===0?$+1:vt===1?$-1:vt===2?$+I:$-I;Ye>=0&&Ye<s&&n.solid[Ye]!==0?$=Ye:z=1e-9}Y.set([$,N.fluid[u],N.dir[u],0],E),le.set([z,N.s[u],N.z[u],0],E+4)}t.writeBuffer(this.sites,0,V);const Oe=new Uint32Array(i.nsites);for(let u=0;u<N.count;u+=1)Oe[u]=N.bubble[u];t.writeBuffer(this.sbub,0,Oe);const G=new Float32Array(dt);G[ut.DT]=e.dt,G[ut.TIME]=e.time,G[ut.RHOREF]=M.rhoRef,t.writeBuffer(this.glob,0,G);const se=new Uint32Array(ze),Gt=new Float32Array(se.buffer);se[p.PCOUNT]=v.count,se[p.PSORT]=v.count,se[p.BCOUNT]=k.count,se[p.NEXTID_B]=Math.max(1,k.nextFree),se[p.NEXTID_P]=Math.max(1,v.nextFree);const ve=e.bubbleModel;se[p.WATCH]=ve.watch>=0?ve.watch:Yt,se[p.WATCH_FATE]=ve.watchFate,ve.firstSuperheat!==null&&(Gt[p.FIRST_SH]=ve.firstSuperheat+1e3,se[p.FIRST_MAT]=1),t.writeBuffer(this.cnt,0,se),t.writeBuffer(this.ccountA,0,new Uint32Array(i.n+4)),t.writeBuffer(this.ccountB,0,new Uint32Array(i.n+4)),t.writeBuffer(this.bacc,0,new Uint32Array(hr*i.bcap)),t.writeBuffer(this.racc,0,new Uint32Array(dr*i.nreg)),t.writeBuffer(this.hacc,0,new Uint32Array(mr*i.nheat))}async read(e){const t=this.ctx.device,i=e.map(d=>Math.ceil(d.size/4)*4),r=i.reduce((d,b)=>d+b,0),s=t.createBuffer({label:"read",size:Math.max(16,r),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),n=t.createCommandEncoder();let c=0;e.forEach((d,b)=>{i[b]>0&&n.copyBufferToBuffer(d.buf,d.offset,s,c,i[b]),c+=i[b]}),t.queue.submit([n.finish()]),await s.mapAsync(GPUMapMode.READ);const o=s.getMappedRange().slice(0);s.unmap(),s.destroy();const f=[];c=0;for(const d of i)f.push(o.slice(c,c+d)),c+=d;return f}async download(e){const t=this.d,i=t.n,[r,s,n,c,o,f,d,b,g,w]=await this.read([{buf:this.cnt,offset:0,size:4*ze},{buf:this.glob,offset:0,size:4*dt},{buf:this.cf,offset:0,size:4*Kt*i},{buf:this.cu,offset:0,size:4*zt*i},{buf:this.at,offset:0,size:4*Qt*i},{buf:this.ff,offset:0,size:4*Xt*t.nf},{buf:this.af,offset:0,size:4*Zt*t.nf},{buf:this.heat,offset:0,size:4*pe*t.nheat},{buf:this.sbub,offset:0,size:4*t.nsites},{buf:this.reg,offset:0,size:4*ge*t.nreg}]),D=new Uint32Array(r),L=Math.min(t.pcap,D[p.PCOUNT]),U=Math.min(t.bcap,D[p.BCOUNT]),[C,S]=await this.read([{buf:this.partsA,offset:0,size:4*Je*Math.max(1,L)},{buf:this.bubs,offset:0,size:4*et*Math.max(1,U)}]),v=e.grid,M=new Float32Array(n),x=(_,A,y=0)=>{for(let fe=0;fe<i;fe+=1)A[y+fe]=M[_*i+fe]};x(F.PHI,v.phi),x(F.ALPHA,v.alpha),x(F.PL,v.pl),x(F.PG,v.pg),x(F.MN,v.mg,He*i),x(F.MO,v.mg,We*i),x(F.MV,v.mg,Ke*i),x(F.MF,v.mfog),x(F.HG,v.Hg),x(F.ES,v.Es),x(F.FILM,v.film),x(F.T,v.T),x(F.TL,v.Tl),x(F.CL,v.Cl);const O=e.gas;x(F.VGAS,O.vgas),x(F.RHO,O.rho),x(F.NMOL,O.nmol),x(F.CAP,O.cap),x(F.MU,O.mu),x(F.VEOS,O.veos),x(F.SRCV,O.srcV),x(F.VEOSMID,O.veosMid),x(F.CRUST,v.crust);for(let _=0;_<v.nx;_+=1)e.salt.floor[_]=M[F.FLOOR*i+_],e.salt.floorH[_]=M[F.FLOORH*i+_];const m=new Uint32Array(c);for(let _=0;_<i;_+=1)v.kind[_]=m[$e.KIND*i+_];const T=new Float32Array(o);for(let _=0;_<i;_+=1)e.liquid.volSrc[_]=T[pr.VOLSRC*i+_];const k=new Float32Array(f),P=new Float32Array(d),q=t.nf;for(let _=0;_<t.nu;_+=1)v.ul[_]=k[Te.UL*q+_],v.ug[_]=k[Te.UG*q+_],e.liquid.fU[_]=P[_];for(let _=0;_<t.nv;_+=1)v.vl[_]=k[Te.UL*q+t.nu+_],v.vg[_]=k[Te.UG*q+t.nu+_],e.liquid.fV[_]=P[t.nu+_];const B=e.particles,R=e.liquid,j=new Float32Array(C),N=new Uint32Array(C),V=new Int32Array(C);let Y=0,le=0;for(let _=0;_<L;_+=1){const A=Je*_;if(N[A+13]&1||!(j[A+8]>0))continue;const y=Y;Y+=1,B.x[y]=j[A],B.y[y]=j[A+1],B.vx[y]=j[A+2],B.vy[y]=j[A+3],B.c00[y]=j[A+4],B.c01[y]=j[A+5],B.c10[y]=j[A+6],B.c11[y]=j[A+7],B.mass[y]=j[A+8],B.h[y]=j[A+9];const fe=j[A+26]>0?j[A+26]:0;B.spc[2*y]=fe>0?Ji:0,B.spc[2*y+1]=0,B.smass[2*y]=fe,B.smass[2*y+1]=0,B.mat[y]=N[A+13]>>>8&255,B.id[y]=N[A+14],B.id[y]>le&&(le=B.id[y]),R.dVp[y]=j[A+12],R.bi[y]=V[A+15],R.bj[y]=V[A+16];for(let ne=0;ne<9;ne+=1)R.wt[9*y+ne]=j[A+17+ne];B.derive(y)}B.count=Y,B.reserveIds(Math.max(D[p.NEXTID_P],le+1)),R.weightsDirty=!0;const I=e.bubbles,Oe=e.bubbleModel.motionState,G=new Float32Array(S),se=new Uint32Array(S),Gt=new Int32Array(S);I.count=0;let ve=0;for(let _=0;_<U;_+=1){const A=et*_;if(se[A+20]===0)continue;const y=I.count;I.count+=1;const fe=y*Vt;I.x[y]=G[A],I.y[y]=G[A+1],I.z[y]=G[A+2],I.vx[y]=G[A+3],I.vy[y]=G[A+4];for(let ne=0;ne<Vt;ne+=1)I.m[fe+ne]=0;I.m[fe+He]=G[A+5],I.m[fe+We]=G[A+6],I.m[fe+Ke]=G[A+7],I.H[y]=G[A+8],I.age[y]=G[A+9],I.site[y]=Gt[A+10],I.r[y]=G[A+11],I.V[y]=G[A+12],I.pb[y]=G[A+13],I.pv[y]=G[A+14],I.Tb[y]=G[A+15],I.dmdt[y]=G[A+16],Oe.ux0[y]=G[A+17],Oe.uy0[y]=G[A+18],I.id[y]=se[A+19],I.id[y]>ve&&(ve=I.id[y]);for(let ne=0;ne<At;ne+=1)I.force[y*At+ne]=G[A+21+ne]}I.reserveIds(Math.max(D[p.NEXTID_B],ve+1));const u=e.bubbleModel.cavities,E=new Uint32Array(g);for(let _=0;_<u.count;_+=1)u.bubble[_]=E[_];const $=new Float32Array(w);for(let _=0;_<e.regions.count;_+=1){const A=ge*this.regionMap[_];e.regions.p0[_]=$[A+te.P0],e.regions.rhoBar[_]=$[A+te.RHOBAR]}const z=new Float32Array(b);e.heat.heaters.forEach((_,A)=>{const y=pe*A;_.P=z[y+Z.P],_.Tmean=z[y+Z.TMEAN],_.integral=z[y+Z.INTEGRAL]});const vt=new Float32Array(s);e.dt=vt[ut.DT];const Ye=e.bubbleModel;Ye.watch=D[p.WATCH]===Yt?-1:D[p.WATCH],vn(e,this.stair)}gpuRegion(e){return this.regionMap[e]??0}cpuRegion(e){return this.regionInv[e]??0}}const Ee=128,ee="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Tn=5,Yr=30,Jr=`
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
`,yn=[{name:"heaterSums",wg:Ee,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${ee} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${ee} {
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
        let kp = power / ${Tn}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${Yr}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${Yr}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:Ee,bind:"P:u cnt:a parts:r",code:`${ie}
${ee} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:Ee,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${be}
${ie}
${ee} {
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
}`},{name:"heatAssemble",wg:Ee,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${Jr}
${ee} {
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
}`},{name:"heatFlux",wg:Ee,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${Jr}
${Ut}
${ie}
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
${ee} {
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
}`},{name:"heatParts",wg:Ee,bind:"P:u cnt:a cf:r parts:w",code:`${be}
${ee} {
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
}`},{name:"heatShare",wg:Ee,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${be}
${ee} {
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
}`},{name:"pwParts",wg:Ee,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${ee} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${ee} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${ee} {
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
${ee} {
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
  if (lid < 11u) { meas[wid3.x * ${ht}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${ee} {
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${ht}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${ee} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${ht}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${ee} {
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
}`}],nt=256,An=[...[1,2,3].map(a=>({name:`mgC${a}`,wg:nt,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Et}
${H} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${a===1?"coarsen1(LP.F, C, t);":a===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:nt,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${Et}
${H} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:nt,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${zr}
${Et}
${H} {
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
}`},{name:"mgPost",wg:nt,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Tt}
${Ae}
const TILE: u32 = 16u;
const HALO: u32 = ${Q}u;
const TS: u32 = ${16+2*Q}u;
var<workgroup> sx: array<f32, ${(16+2*Q)**2}>;
var<workgroup> sb: array<f32, ${(16+2*Q)**2}>;
var<workgroup> sax: array<f32, ${(16+2*Q)**2}>;
var<workgroup> say: array<f32, ${(16+2*Q)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*Q)**2}>;
${H} {
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
  for (var k = 0u; k < ${Q}u; k++) {
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
}`},{name:"mgPreR",wg:nt,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Tt}
${Ae}
const TILE: u32 = 12u;
const HALO: u32 = ${Q+2}u;
const TS: u32 = ${12+2*(Q+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(Q+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(Q+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(Q+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(Q+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(Q+2))**2}>;
${H} {
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
  for (var k = 0u; k < ${Q}u; k++) {
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
}`},{name:"mgTail",wg:nt,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${zr}
${Ae}
var<workgroup> tx: array<f32, ${ft}>;
var<workgroup> tb: array<f32, ${ft}>;
var<workgroup> tax: array<f32, ${ft}>;
var<workgroup> tay: array<f32, ${ft}>;
var<workgroup> tinv: array<f32, ${ft}>;
var<workgroup> toff: array<u32, ${pt}>;
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
${H} {
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
  for (var k = 0u; k < ${Kr}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Kr}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],Ge=128,Ve="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ln=[{name:"flashTs",wg:Ge,bind:"P:u cf:w cu:r reg:r",code:`${Ve} {
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
}`},{name:"flashVap",wg:Ge,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${be}
${Ve} {
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
}`},{name:"flashParts",wg:Ge,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${be}
${ie}
${Sr}
${Ve} {
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
}`},{name:"flashDist",wg:Ge,bind:"P:u cnt:a cf:r cu:r at:a",code:`${ie}
${Ve} {
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
}`},{name:"fog",wg:Ge,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${Ut}
${ie}
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
${Ve} {
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
}`},{name:"spawnWater",wg:Ge,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ve} {
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
}`},{name:"films",wg:Ge,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${Ve} {
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
}`}],nr=128,ar="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Cn=`
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
`,On=`
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
`,qn=[{name:"saltCryst",wg:nr,bind:"P:u cnt:a cu:r at:a parts:w",code:`${be}
${ie}
${Sr}
${ar} {
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
}`},{name:"saltSums",wg:nr,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${be}
${ar} {
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
}`},{name:"saltShare",wg:nr,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${be}
${Cn}
${On}
${ar} {
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
}`}],at=128,ct="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Bn=4*1e3*15e-7/(3*2*.07),Tr=`
const VIR = array<vec3<f32>, ${Lt.length}>(${Lt.map(a=>`vec3<f32>(${h(a[0]/255)}, ${h(a[1]/255)}, ${h(a[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${h(Lt.length-1)};
  let i = min(u32(floor(x)), ${Lt.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,cr="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var ii;const Rn=[{name:"rScale",wg:at,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${cr}
var<workgroup> m4: array<vec4<f32>, WG>;
${ct} {
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
}`},{name:"rCells",wg:at,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${cr}
${Tr}
const SOLID_RGB = array<vec3<f32>, ${Pt.length}>(${Pt.map(a=>{const e=ur(a.color);return`vec3<f32>(${h(e[0]/255)}, ${h(e[1]/255)}, ${h(e[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${ur(((ii=ts[0])==null?void 0:ii.color)??"#f4f3ee").map(a=>h(a/255)).join(", ")});
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${h(ai)} * P.dx * P.depth) / P.dx)); }
${ct} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${h(ue[0])};
  let tspan = ${h(ue[1]-ue[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${Pt.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${h(Bn)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:at,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${ct} {
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
}`},{name:"rLiqBlurX",wg:at,bind:"P:u lq:r lq2:w",code:`${ct} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:at,bind:"P:u lq2:r liquid:t",code:`${ct} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${h(ue[0])}) / ${h(ue[1]-ue[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${h(Fr)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:at,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${cr}
${ct} {
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
}`}],yr=`
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
`;var si;`${yr}${Tr}${ur(((si=rs[1])==null?void 0:si.color)??"#e3b437").map(a=>h(a)).join(", ")}`;`${yr}${(Pr.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}${p.BCOUNT}`;`${yr}${Tr}${(Pr.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}${p.PCOUNT}${h(273.15+ue[0])}${h(ue[1]-ue[0])}${h(Fr)}`;const Dn=[..._n,...An,...mn,...on,...fn,...pn,...an,...ln,...gn,...Ln,...qn,...yn,...Rn],ei=[["heater",p.HEATER_E,"f"],["lossWalls",p.LOSS_WALLS,"f"],["lossOpen",p.LOSS_OPEN,"f"],["escapedEnergy",p.ESC_ENERGY,"f"],["escapedWater",p.ESC_WATER,"f"],["escapedAir",p.ESC_AIR,"f"],["escapedOther",p.ESC_OTHER,"f"],["escapedSalt",p.ESC_SALT,"f"],["crystallized",p.CRYST,"f"],["produced",p.PRODUCED,"f"],["condensed",p.CONDENSED,"f"],["dew",p.DEW,"f"],["fogMade",p.FOGMADE,"f"],["burstVapour",p.BURSTVAP,"f"],["fluxSL",p.FLUX_SL,"f"],["fluxLG",p.FLUX_LG,"f"],["fluxSG",p.FLUX_SG,"f"],["lossSolids",p.LOSS_SOLIDS,"f"],["nucleated",p.NUCLEATED,"u"],["departed",p.DEPARTED,"u"],["merged",p.MERGED,"u"],["burst",p.BURST,"u"],["collapsed",p.COLLAPSED,"u"],["burstCold",p.BURST_COLD,"u"],["burstWarm",p.BURST_WARM,"u"],["collapsedCold",p.COLL_COLD,"u"],["collapsedWarm",p.COLL_WARM,"u"],["releasedGas",p.REL_MASS,"f"],["releases",p.REL_N,"u"],["releaseMisses",p.REL_MISS,"u"],["evapCapped",p.EVAP_CAP,"u"]],ti=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0,releasedGas:0,releases:0,releaseMisses:0,evapCapped:0}),En=24,lr=256,lt=2*or;class gt{constructor(e,t){l(this,"ctx");l(this,"cpu");l(this,"state");l(this,"solver");l(this,"sub");l(this,"groups",new Map);l(this,"stateVersion",0);l(this,"itL",16);l(this,"itG",18);l(this,"itH",8);l(this,"itD",6);l(this,"nsub",0);l(this,"totals",ti());l(this,"last",null);l(this,"stepped",null);l(this,"energy0",null);l(this,"water0",null);l(this,"other0",null);l(this,"salt0",null);l(this,"carry",null);l(this,"sealed",!1);l(this,"salty",!1);l(this,"mixed",!1);l(this,"staging",[]);l(this,"busy",new Set);l(this,"reading",new Map);l(this,"querySet");l(this,"queryBuf");l(this,"vapourMark",0);l(this,"vapourLast",0);l(this,"vapourRate",0);l(this,"stageMs",new Array(or).fill(0));this.ctx=e,this.cpu=t,this.querySet=e.timestamps?e.device.createQuerySet({type:"timestamp",count:lt}):null,this.queryBuf=e.timestamps?e.buffer("ts",8*lt,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(e){return gt.on(await gt.prepare(),e)}static async prepare(e=[]){const t=await kr.create(),i=await t.compile([...Dn,...e]);if(i.length>0)throw t.destroy(),new Error(`WGSL: ${i.slice(0,3).join(" | ")}`);return t}static on(e,t){return new gt(e,t)}rebuild(){this.stateVersion+=1;const e=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Sn(this.ctx,this.cpu);const t=this.state;(e===null||e.nx!==t.d.nx||e.ny!==t.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Pn(this.ctx,t.plan,{params:t.params,mgF:t.mgF,mgU:t.mgU,cgv:t.cgv,cgs:t.cgs,lab:t.lab,cfl:t.cfl,csum:t.csum,cnt:t.cnt,cgp:t.cgp});const i=new Uint32Array(lr/4*16);for(let r=0;r<16;r+=1)i[lr/4*r]=r;this.sub=this.ctx.uniform("sub",i.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let i=0;i<this.cpu.regions.count;i+=1)this.cpu.regions.open[i]===0&&(this.sealed=!0);const e=this.ctx.device.createCommandEncoder(),t=e.beginComputePass();this.sort(t,1),this.sort(t,2),t.end(),this.ctx.device.queue.submit([e.finish()])}async download(){await this.state.download(this.cpu);const e=this.cpu,t=this.totals;e.time=t.time,e.steps=t.steps;const i=e.flows;i.heater=t.heater,i.lossWalls=t.lossWalls,i.lossOpen=t.lossOpen,i.escapedEnergy=t.escapedEnergy,i.escapedWater=t.escapedWater,i.escapedAir=t.escapedAir,i.escapedOther=t.escapedOther,i.escapedSalt=t.escapedSalt,e.salt.crystallized=t.crystallized,e.phase.produced=t.produced,e.phase.condensed=t.condensed,e.phase.dew=t.dew,e.phase.fogMade=t.fogMade;const r=e.bubbleModel;r.burstVapour=t.burstVapour,r.nucleated=t.nucleated,r.departed=t.departed,r.merged=t.merged,r.burst=t.burst,r.collapsed=t.collapsed,r.burstCold=t.burstCold,r.burstWarm=t.burstWarm,r.collapsedCold=t.collapsedCold,r.collapsedWarm=t.collapsedWarm,e.heat.fluxSL=t.fluxSL,e.heat.fluxLG=t.fluxLG,e.heat.fluxSG=t.fluxSG,e.heat.lossSolids=t.lossSolids,this.last!==null&&this.last.firstSuperheat!==null&&r.firstSuperheat===null&&(r.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(e){this.state.writeHeaterSettings(this.cpu,e)}watch(e){this.ctx.device.queue.writeBuffer(this.state.cnt,4*p.WATCH,new Uint32Array([e??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*p.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(e){const t=this.state,i={P:t.params,glob:t.glob,cnt:t.cnt,cf:t.cf,cu:t.cu,at:t.at,ff:t.ff,fu:t.fu,af:t.af,reg:t.reg,racc:t.racc,heat:t.heat,hacc:t.hacc,sites:t.sites,sbub:t.sbub,bubs:t.bubs,bubs2:t.bubs2,bacc:t.bacc,btarget:t.btarget,meas:t.meas,probe:t.probe,mgF:t.mgF,mgU:t.mgU,cgv:t.cgv,cgs:t.cgs,lab:t.lab,cfl:t.cfl,csum:t.csum,pkey:t.pkey,pslot:t.pslot,pargs:t.pargs,cstart:t.cstart,bsum:t.bsum,L:this.solver.level0};return e==="A"&&(i.parts=t.partsA,i.ccount=t.ccountB),e==="B"&&(i.parts=t.partsB,i.ccount=t.ccountA),e==="S1"&&(i.parts=t.partsA,i.parts2=t.partsB,i.ccount=t.ccountA,i.cclear=t.ccountB),e==="S2"&&(i.parts=t.partsB,i.parts2=t.partsA,i.ccount=t.ccountB,i.cclear=t.ccountA),i}group(e,t,i=-1){const r=`${e}|${t}|${i}`;let s=this.groups.get(r);if(s===void 0){const n=i>=0?{...this.resources(t),SUB:{buffer:this.sub,offset:lr*i,size:16}}:this.resources(t);s=this.ctx.bind(e,n),this.groups.set(r,s)}return s}cells(e,t,i="",r=-1){this.ctx.dispatch(e,t,this.group(t,i,r),this.state.d.n)}faces(e,t,i="",r=-1){this.ctx.dispatch(e,t,this.group(t,i,r),this.state.d.nf)}parts(e,t,i){this.ctx.dispatch(e,t,this.group(t,i),this.state.d.pcap)}bubs(e,t){this.ctx.dispatch(e,t,this.group(t,""),this.state.d.bcap)}one(e,t,i=""){this.ctx.dispatchOne(e,t,this.group(t,i))}sort(e,t){const i=t===1?"S1":"S2",r=this.state.d;this.ctx.dispatch(e,"sortCount",this.group("sortCount",i),r.pcap),this.ctx.dispatch(e,"sortScan",this.group("sortScan",i),Math.ceil(r.n/4)),this.one(e,"sortTop",i),this.ctx.dispatch(e,"sortScatter",this.group("sortScatter",i),r.pcap)}encodeSteps(e,t,i){for(let r=0;r<t;r+=1)this.encodeStep(e,i&&r===0&&this.querySet!==null);i&&t>0&&this.querySet!==null&&this.queryBuf!==null&&e.resolveQuerySet(this.querySet,0,lt,this.queryBuf,0)}pass(e,t,i){if(this.ctx.profiler!==null){const r=()=>{};return{label:"",setPipeline:r,setBindGroup:r,dispatchWorkgroups:r,dispatchWorkgroupsIndirect:r,end:r}}return!t||this.querySet===null?e.beginComputePass():e.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*i,endOfPassWriteIndex:2*i+1}})}encodeStep(e,t){const i=this.cpu;let r=this.pass(e,t,1);if(this.sort(r,1),this.mixed&&this.cells(r,"cellHost","B"),this.cells(r,"splat","B"),this.cells(r,"classify"),this.cells(r,"transitions"),this.cells(r,"gasApply"),this.cells(r,"regCells"),this.parts(r,"regParts","B"),this.bubs(r,"regBubs"),this.one(r,"regFinishStart"),this.faces(r,"p2g","B"),this.mixed){for(let s=0;s<En;s+=2)this.faces(r,"viscJacA"),this.faces(r,"viscJacB");this.faces(r,"viscForce")}this.cells(r,"liqAssemble"),this.solver.encodeMG(r,Fi,this.itL,!0,!1),this.cells(r,"liqPressure"),this.faces(r,"liqCorrect"),this.faces(r,"extrap1"),this.faces(r,"extrap2"),this.parts(r,"g2p","B"),this.sort(r,2),this.parts(r,"heatWeights","A"),r.end(),r=this.pass(e,t,2),this.cells(r,"gasVolumes"),this.faces(r,"markFaces"),this.cells(r,"gasMaxOut");for(let s=0;s<16;s+=1)this.cells(r,"gasFlux","",s),this.cells(r,"gasMove","",s);this.cells(r,"gasApplyMid"),this.faces(r,"macFwd"),this.faces(r,"macBack"),this.faces(r,"viscosity"),this.cells(r,"gasAssemble"),this.solver.encodeMG(r,wi,this.itG,!0,!0),this.cells(r,"gasPressure"),this.faces(r,"gasCorrect"),r.end(),r=this.pass(e,t,3),this.cells(r,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(r,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(r,"bubAdvance"),this.bubs(r,"bubTarget"),this.bubs(r,"bubMerge"),this.bubs(r,"bubMergeFinal"),this.bubs(r,"bubVent"),this.bubs(r,"bubFinish"),this.one(r,"bubCompact"),this.bubs(r,"bubCopyBack"),this.parts(r,"applyMass","A"),this.cells(r,"spawnWater","A"),this.cells(r,"gatherPlain","A"),this.bubs(r,"bubAlpha"),this.cells(r,"cellAlpha"),this.cells(r,"gasApply"),r.end(),r=this.pass(e,t,4),this.cells(r,"diffPrep"),this.cells(r,"diffAssemble"),this.solver.encodeMG(r,ki,this.itD,!1),this.faces(r,"diffFaces"),this.cells(r,"diffOut"),this.cells(r,"diffApply"),this.cells(r,"latentSrc"),this.parts(r,"applyMass","A"),this.cells(r,"spawnWater","A"),this.cells(r,"gatherPlain","A"),this.cells(r,"gasApply"),this.cells(r,"flashTs"),this.cells(r,"flashVap","A"),this.parts(r,"flashParts","A"),this.cells(r,"flashDist"),this.cells(r,"gasApply"),this.cells(r,"fog"),this.cells(r,"films","A"),this.salty&&(this.parts(r,"saltCryst","A"),this.cells(r,"gasApply")),r.end(),r=this.pass(e,t,5),this.cells(r,"heaterSums"),this.one(r,"heaterPI"),i.heat.liquidPower!==0&&this.parts(r,"sumCl","A"),this.cells(r,"heatPrep","A"),this.cells(r,"heatAssemble"),this.solver.encodeMG(r,Pi,this.itH,!1),this.cells(r,"heatFlux"),this.parts(r,"heatParts","A"),this.cells(r,"heatShare","A"),this.salty&&(this.cells(r,"saltSums","A"),this.cells(r,"saltShare","A")),r.end(),r=this.pass(e,t,7),this.cells(r,"regCells"),this.parts(r,"regParts","A"),this.bubs(r,"regBubs"),this.one(r,"regFinish"),this.sealed&&(this.cells(r,"compSums"),this.one(r,"compStep0"),this.cells(r,"compApply"),this.cells(r,"compSums"),this.one(r,"compStep1"),this.cells(r,"compApply"),this.cells(r,"compSums"),this.one(r,"compStepEnd"),this.parts(r,"pwParts","A"),this.bubs(r,"pwBubs")),this.cells(r,"gasEos"),this.one(r,"stepEnd"),r.end()}layout(){const e=this.state,t=0,i=t+4*ze,r=i+4*dt,s=r+4*ge*e.d.nreg,n=s+4*pe*e.d.nheat,c=e.measGroups[0]+e.measGroups[1]+e.measGroups[2],o=n+4*ht*c,f=o+4*64,d=f+8*lt;return{cnt:t,glob:i,reg:r,heat:s,meas:n,probe:o,ts:f,total:d}}encodeReadback(e,t){const i=this.state,r=this.layout();let s=this.staging.find(o=>!this.busy.has(o)&&o.size>=r.total);if(s===void 0){if(this.staging.length>=3)return null;s=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(r.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(s)}const n=e.beginComputePass();this.ctx.dispatch(n,"measCells",this.group("measCells",""),i.d.n),this.ctx.dispatch(n,"measParts",this.group("measParts","A"),i.d.pcap),this.ctx.dispatch(n,"measBubs",this.group("measBubs",""),i.d.bcap),this.ctx.dispatch(n,"bubWatch",this.group("bubWatch",""),i.d.bcap),n.end(),e.copyBufferToBuffer(i.cnt,0,s,r.cnt,4*ze),e.copyBufferToBuffer(i.glob,0,s,r.glob,4*dt),e.copyBufferToBuffer(i.reg,0,s,r.reg,4*ge*i.d.nreg),e.copyBufferToBuffer(i.heat,0,s,r.heat,4*pe*i.d.nheat),e.copyBufferToBuffer(i.meas,0,s,r.meas,r.probe-r.meas),e.copyBufferToBuffer(i.probe,0,s,r.probe,4*64),t&&this.queryBuf!==null&&e.copyBufferToBuffer(this.queryBuf,0,s,r.ts,8*lt),e.clearBuffer(i.cnt,4*qr,4*(ls-qr)),e.clearBuffer(i.cnt,4*p.VMAXP,4*4),e.clearBuffer(i.cnt,4*p.ESC_OTHER,4*3),e.clearBuffer(i.cnt,4*p.REL_MASS,4*4),this.busy.add(s);const c=[];for(let o=0;o<this.cpu.regions.count;o+=1)c.push(i.gpuRegion(o));return this.reading.set(s,{version:this.stateVersion,layout:r,regions:c,heaters:this.cpu.heat.heaters.length,groups:[...i.measGroups],nreg:i.d.nreg,nheat:i.d.nheat}),s}async finishReadback(e,t){const i=this.reading.get(e),r=()=>{this.busy.delete(e),this.reading.delete(e)};try{await e.mapAsync(GPUMapMode.READ)}catch{return r(),null}if(i===void 0||i.version!==this.stateVersion)return e.unmap(),r(),null;const s=e.getMappedRange(0,Math.ceil(i.layout.total/16)*16).slice(0);e.unmap(),r();const n=this.parse(s,i,t);return this.absorb(n),n}parse(e,t,i){const r=t.layout,s=new Uint32Array(e,r.cnt,ze),n=new Float32Array(e,r.cnt,ze),c=new Float32Array(e,r.glob,dt),o=new Float32Array(e,r.reg,ge*t.nreg),f=new Float32Array(e,r.heat,pe*t.nheat),d=new Float32Array(e,r.meas,(r.probe-r.meas)/4),b=new Float32Array(e,r.probe,64),[g,w,D]=t.groups,L=(x,O,m)=>{let T=0;for(let k=0;k<O;k+=1)T+=d[(x+k)*ht+m];return T},U=[];for(const x of t.regions){const O=ge*x;U.push({p0:o[O+te.P0],sealed:o[O+te.OPEN]===0,vGas:o[O+te.VGAS],vFluid:o[O+te.VFLUID]})}const C=[];for(let x=0;x<t.heaters;x+=1){const O=pe*x;C.push({P:f[O+Z.P],Tmean:f[O+Z.TMEAN],integral:f[O+Z.INTEGRAL],cells:f[O+Z.CELLS]})}let S=null;if(i&&this.queryBuf!==null){const x=new BigUint64Array(e,r.ts,lt);S=[];for(let O=0;O<or;O+=1){const m=x[2*O],T=x[2*O+1];S.push(T>m&&m>0n?Number(T-m)/1e6:0)}}const v=n[p.SUM_WM],M={};for(const[x,O,m]of ei)M[x]=m==="f"?n[O]:s[O];return{intervals:M,ov:[n[p.OV_PMAX],n[p.OV_VMAX],n[p.OV_VLIQ]],pcount:s[p.PCOUNT],bcount:s[p.BCOUNT],dt:c[ut.DT],stepsSince:s[p.STEPS],simSince:n[p.SIMTIME],itL:s[p.IT_L],itG:s[p.IT_G],itH:s[p.IT_H],itD:s[p.IT_D],capL:s[p.CAP_L],capG:s[p.CAP_G],capH:s[p.CAP_H],capD:s[p.CAP_D],resL:n[p.RES_L],resG:n[p.RES_G],resH:n[p.RES_H],nsub:s[p.NSUBMAX],uMaxG:n[p.UMAXG],waterMass:v,waterT:v>0?n[p.SUM_WMT]/v:0,waterTmax:n[p.TMAX],solids:L(0,g,0),film:L(0,g,1),gas:L(0,g,2),vapour:L(0,g,3),fog:L(0,g,4),air:L(0,g,5),liquidCells:Math.round(L(0,g,6)),gasCells:Math.round(L(0,g,7)),liquidH:L(g,w,0),liquidMass:L(g,w,1),sensible:L(g,w,3),otherMass:L(g,w,4),otherMT:L(g,w,5),saltLiquid:L(g,w,6),crust:L(0,g,8),floor:L(0,g,9),floorH:L(0,g,10),bubH:L(g+w,D,0),bubWater:L(g+w,D,1),bubAir:L(g+w,D,2),regions:U,heaters:C,watch:{found:b[31]===1,id:new Uint32Array(b.buffer,b.byteOffset+4*21,1)[0],fate:s[p.WATCH_FATE],data:new Float32Array(b)},firstSuperheat:s[p.FIRST_SH]!==0?n[p.FIRST_SH]-1e3:null,stageMs:S,vmaxP:n[p.VMAXP],rmaxB:n[p.RMAXB],slowed:s[p.SLOWED],vented:n[p.VENTED]}}absorb(e){const t=this.totals;this.last=e,e.stepsSince>0&&(this.stepped=e),e.stageMs!==null&&(this.stageMs=e.stageMs);for(const[r]of ei)t[r]+=e.intervals[r];t.time+=e.simSince,t.steps+=e.stepsSince,t.capped+=e.capL+e.capG+e.capH+e.capD,t.slowed+=e.slowed,t.vented+=e.vented;const i=(r,s,n,c,o,f)=>{if(s===0&&n===0)return r;const d=n>0?Math.ceil(r*1.5)+2:s+f;return Math.min(o,Math.max(c,r>d?Math.max(d,r-2):d))};e.stepsSince>0&&(this.itL=i(this.itL,e.itL,e.capL,4,60,1),this.itG=i(this.itG,e.itG,e.capG,4,60,2),this.itH=i(this.itH,e.itH,e.capH,3,60,1),this.itD=i(this.itD,e.itD,e.capD,3,60,1),this.nsub=e.nsub)}stats(e){const t=this.cpu,i=t.grid,r=this.last,s=this.totals,n=this.budget(),c={heater:s.heater,lossWalls:s.lossWalls,lossOpen:s.lossOpen,escapedEnergy:s.escapedEnergy,editEnergy:t.ledger.energy,escapedWater:s.escapedWater,escapedAir:s.escapedAir,editWater:t.ledger.water,editAir:t.ledger.air,escapedOther:s.escapedOther,editOther:t.ledger.other,escapedSalt:s.escapedSalt,editSalt:t.ledger.salt,bodyWork:0},o=this.energy0??n.energy,f=this.water0??n.water.total,d=n.energy-o-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy),b=n.water.total-f-c.editWater,g=n.other.total-(this.other0??n.other.total)-c.editOther,w=n.salt.total-(this.salt0??n.salt.total)-c.editSalt,D=s.produced+s.burstVapour,L=s.time-this.vapourLast;L>.2&&(this.vapourRate=(D-this.vapourMark)/L,this.vapourMark=D,this.vapourLast=s.time);const U=t.heat.heaters.map((v,M)=>({h:v,k:M,rd:r==null?void 0:r.heaters[M]})).filter(({rd:v,h:M})=>((v==null?void 0:v.cells)??M.cells)>0).map(({h:v,rd:M})=>({group:v.group,P:(M==null?void 0:M.P)??v.P,Tmean:(M==null?void 0:M.Tmean)??v.Tmean,mode:v.mode,power:v.power,target:v.target,on:v.on})),C=(v,M,x)=>({iterations:v,residual:M,capped:x>0}),S=this.stepped??r;return{time:s.time,dt:(r==null?void 0:r.dt)??t.dt,steps:s.steps,nx:i.nx,ny:i.ny,dx:i.dx,quality:t.currentQuality,particles:(r==null?void 0:r.pcount)??t.particles.count,capacity:t.particles.cap,bubbles:(r==null?void 0:r.bcount)??t.bubbles.count,liquidCells:(r==null?void 0:r.liquidCells)??0,gasCells:(r==null?void 0:r.gasCells)??0,stages:[...this.stageMs],stepMs:e,liquid:C((S==null?void 0:S.itL)??0,(S==null?void 0:S.resL)??0,(S==null?void 0:S.capL)??0),gas:C((S==null?void 0:S.itG)??0,(S==null?void 0:S.resG)??0,(S==null?void 0:S.capG)??0),heat:C((S==null?void 0:S.itH)??0,(S==null?void 0:S.resH)??0,(S==null?void 0:S.capH)??0),gasSubsteps:(S==null?void 0:S.nsub)??0,capped:s.capped,waterT:(r==null?void 0:r.waterT)??0,waterTmax:(r==null?void 0:r.waterTmax)??0,otherMass:(r==null?void 0:r.otherMass)??0,otherT:r!==null&&r.otherMass>0?r.otherMT/r.otherMass:0,saltMass:(r==null?void 0:r.saltLiquid)??0,saltSolid:((r==null?void 0:r.crust)??0)+((r==null?void 0:r.floor)??0),bodies:{count:this.cpu.bodies.list.filter(v=>!v.gone).length,free:0,awake:0},heaters:U,regions:((r==null?void 0:r.regions)??[]).map(v=>({p0:v.p0,sealed:v.sealed,vGas:v.vGas})),budget:n,flows:c,energyError:d,waterError:b,otherError:g,saltError:w,vapourRate:this.vapourRate,ambientT:t.ambientT,ambientP:t.pRef,g:t.gy,extremes:{...t.extremes.stats(),slowed:s.slowed,vented:s.vented},cpuOnly:!1}}budget(){const e=this.last,t=this.totals;let i=0;for(const d of(e==null?void 0:e.regions)??[])d.sealed&&(i-=d.p0*d.vFluid);const r=(e==null?void 0:e.liquidH)??0,s=((e==null?void 0:e.solids)??0)+((e==null?void 0:e.floorH)??0),n=(e==null?void 0:e.gas)??0,c=(e==null?void 0:e.bubH)??0,o={liquid:(e==null?void 0:e.liquidMass)??0,ice:0,vapour:(e==null?void 0:e.vapour)??0,fog:(e==null?void 0:e.fog)??0,film:(e==null?void 0:e.film)??0,bubbles:(e==null?void 0:e.bubWater)??0,escaped:t.escapedWater,total:((e==null?void 0:e.liquidMass)??0)+((e==null?void 0:e.vapour)??0)+((e==null?void 0:e.fog)??0)+((e==null?void 0:e.film)??0)+((e==null?void 0:e.bubWater)??0)+t.escapedWater},f=(e==null?void 0:e.otherMass)??0;return{energy:s+r+n+c+i,solids:s,liquid:r,gas:n,bubbles:c,pv:i,water:o,other:{liquid:f,escaped:t.escapedOther,total:f+t.escapedOther},salt:this.saltBudget(),air:((e==null?void 0:e.air)??0)+((e==null?void 0:e.bubAir)??0)+t.escapedAir}}saltBudget(){const e=this.last,t=(e==null?void 0:e.saltLiquid)??0,i=(e==null?void 0:e.crust)??0,r=(e==null?void 0:e.floor)??0,s=this.totals.escapedSalt;return{liquid:t,crust:i,grains:0,floor:r,escaped:s,total:t+i+r+s}}resetTotals(){Object.assign(this.totals,ti()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0,this.carry=null}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}carryErrors(e){this.resetBaseline(),this.carry=e}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const e=this.budget(),t=this.totals,i=this.cpu,r=this.carry??{energy:0,water:0,other:0,salt:0};this.energy0=e.energy-(t.heater-t.lossWalls-t.lossOpen-t.escapedEnergy+i.ledger.energy)-r.energy,this.water0=e.water.total-i.ledger.water-r.water,this.other0=e.other.total-i.ledger.other-r.other,this.salt0=e.salt.total-i.ledger.salt-r.salt,this.carry=null}get tsatAmb(){return wr(this.cpu.regions.pAmb)}}const ri=8,Mn=3,In=.25,jn=250;function Nn(){return gt.prepare(Cs)}class Si{constructor(e,t,i,r,s,n,c,o){l(this,"e");l(this,"charts");l(this,"seconds");l(this,"fps");l(this,"total");l(this,"chunkFrames");l(this,"keyFrames");l(this,"frames",0);l(this,"onFrame",null);l(this,"onKey",null);l(this,"lost",null);l(this,"keyStallMs",[]);l(this,"lostFrames",0);l(this,"cpuMs",0);l(this,"computeMs",0);l(this,"gpu");l(this,"capture");l(this,"gcharts");l(this,"key");l(this,"scene");l(this,"layout");l(this,"writer");l(this,"chunks",[]);l(this,"keys",[]);l(this,"samples",[]);l(this,"nextSample",0);l(this,"nextKey");l(this,"captured",1);l(this,"issued",0);l(this,"stopping",!1);l(this,"released",!1);l(this,"chain",Promise.resolve());l(this,"inflight",[]);l(this,"free",[]);l(this,"view",br());l(this,"preview");l(this,"previewView",br());l(this,"previewBuf",null);l(this,"previewQuads",new Uint16Array(0));l(this,"previewAt",0);this.gpu=e,this.e=t,this.charts=i,this.scene=r,this.key=s,this.seconds=n,this.fps=Math.max(1,Math.round(c)),this.chunkFrames=2*this.fps,this.keyFrames=Math.max(1,Math.round(o*this.fps)),this.total=Math.round(n*this.fps)+1,this.nextKey=this.keyFrames,this.layout=is(Wt(t,i)),this.writer=new Cr(t.grid.nx,t.grid.ny,t.grid.dx);const f=ss(t.grid.nx,t.grid.ny,t.grid.dx,Math.max(64,Math.ceil(1.5*t.bubbles.count)));ns(t,f,null),this.writer.add(f),this.frames=1,this.preview=f,this.keys.push({frame:0,t:0,data:Ht(Or(Wt(t,i)))}),this.capture=new Ds(e,this.fps,ri,f),this.capture.start(this.fps),this.gcharts=new Es(e);const d=e.ctx.device;d.lost.then(b=>{this.released||(this.lost=b.message||b.reason||"lost")}),d.addEventListener("uncapturederror",b=>{!this.released&&this.lost===null&&(this.lost=`WebGPU: ${b.error.message}`)})}static async create(e,t,i,r,s,n,c,o){const f=o??await Nn();let d=null;try{return d=gt.on(f,e),new Si(d,e,t,i,r,s,n,c)}catch(b){throw d!==null?d.destroy():f.destroy(),b}}get time(){return this.frames>0?(this.frames-1)/this.fps:0}get done(){return this.frames>=this.total}get last(){return this.preview}stop(){this.stopping=!0}async run(e){const t=performance.now();try{for(;this.frames<this.total&&!this.stopping&&this.lost===null;){if(this.nextKey<this.total&&this.captured>this.nextKey){await this.drain(),await this.keyframe();continue}if(this.inflight.length>=Mn){await this.next(),e();continue}const i=this.room();if(i<=0&&this.inflight.length>0){await this.next(),e();continue}this.submit(Math.max(1,Math.min(ri,i)))}this.lost===null&&(await this.drain(),!this.stopping&&this.nextKey<=this.captured-1&&await this.keyframe())}catch(i){this.lost===null&&(this.lost=i instanceof Error?i.message:String(i))}this.computeMs=performance.now()-t}room(){const e=this.gpu,t=Math.fround(this.e.dtMax),i=e.totals.time+(this.issued-e.totals.steps)*t;return Math.ceil(((this.total-1)/this.fps-i)/t-1e-9)}staging(){const e=this.free.pop();return e!==void 0?e:this.gpu.ctx.device.createBuffer({label:"bake",size:Math.ceil(this.capture.batchBytes/16)*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}submit(e){const t=this.gpu,i=t.ctx.device,r=this.capture,s=i.createCommandEncoder();r.begin(s);for(let d=0;d<e;d+=1)t.encodeSteps(s,1,!1),r.encode(s);const n=this.staging();r.copyOut(s,n);const c=t.encodeReadback(s,!1);i.queue.submit([s.finish()]),this.issued+=e;const o=Promise.all([c!==null?t.finishReadback(c,!1):Promise.resolve(null),n.mapAsync(GPUMapMode.READ)]),f=this.chain.then(()=>o).then(()=>this.absorb(n));this.chain=f,f.catch(()=>{}),this.inflight.push(f)}async next(){const e=this.inflight.shift();e!==void 0&&await e}async drain(){for(;this.inflight.length>0;)await this.next()}absorb(e){var n;const t=performance.now(),i=this.gpu,r=this.capture;if(i.baselineFromLast(),i.totals.time>=this.nextSample){const c=this.gcharts.sample();c!==null&&(this.samples.push(c),this.nextSample=i.totals.time+In)}const s=e.getMappedRange();try{const c=r.read(s);this.lostFrames=c.lost,this.captured=c.captured;for(let o=0;o<c.count;o+=1){const f=r.index(s,o);if(f!==this.frames)throw new Error(`capture: frame ${f} arrived, ${this.frames} expected`);const d=r.frame(s,o,this.view);this.writer.add(d),(n=this.onFrame)==null||n.call(this,f,d),this.frames+=1,f%fr===0&&t-this.previewAt>=jn&&this.keepPreview(s,o,t),this.writer.count>=this.chunkFrames&&this.flush()}}finally{e.unmap(),this.free.push(e),this.cpuMs+=performance.now()-t}}keepPreview(e,t,i){this.previewAt=i,this.previewBuf=this.capture.copyFrame(e,t,this.previewBuf);const r=this.capture.layersAt(this.previewBuf,0,4*W,this.previewView);this.previewQuads.length<r.quads.length&&(this.previewQuads=new Uint16Array(r.quads.length)),this.previewQuads.set(r.quads),r.quads=this.previewQuads,this.preview=r}async keyframe(){const e=performance.now(),t=this.gpu,i=this.e,r=this.captured-1;await t.download(),this.gcharts.copyTo(this.charts);const s=t.stats(0),n={energy:s.energyError,water:s.waterError,other:s.otherError,salt:s.saltError};i.rebaseline(n),this.onKey!==null&&await this.onKey({frame:r,e:i,gpu:t,errors:n,probe:()=>this.capture.probe()}),this.capture.rebase(),this.keys.push({frame:r,t:r/this.fps,data:Ht(Or(Wt(i,this.charts)))}),this.keyStallMs.push(performance.now()-e),this.nextKey=(Math.floor(r/this.keyFrames)+1)*this.keyFrames}flush(){this.writer.count!==0&&(this.chunks.push(Ht(this.writer.finish())),this.writer=new Cr(this.e.grid.nx,this.e.grid.ny,this.e.grid.dx))}async finish(){this.flush();const e=this.gpu.ctx.adapter;if(this.release(),this.frames<2)return null;const t=await Promise.all(this.chunks),i=await Promise.all(this.keys.map(n=>n.data)),r=this.e.grid;return{header:{format:cs,version:as,key:this.key,scene:this.scene,quality:this.e.currentQuality,layout:this.layout,fps:this.fps,nx:r.nx,ny:r.ny,dx:r.dx,depth:r.depth,boxW:r.w,boxH:r.h,frames:this.frames,duration:(this.frames-1)/this.fps,seconds:this.seconds,chunkFrames:this.chunkFrames,chunkBytes:t.map(n=>n.length),keyframes:this.keys.map((n,c)=>({frame:n.frame,t:n.t,bytes:i[c].length})),samples:this.samples,created:Date.now(),bakeMs:Math.round(this.computeMs),bytes:t.reduce((n,c)=>n+c.length,0)+i.reduce((n,c)=>n+c.length,0),used:Date.now(),engine:"gpu",exact:!1,adapter:e},chunks:t,keys:i}}release(){this.released||(this.released=!0,this.capture.destroy(),this.gpu.destroy())}}export{Si as GpuBaker,Nn as prepareGpu};
