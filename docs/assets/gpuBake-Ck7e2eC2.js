var Hi=Object.defineProperty;var Wi=(l,e,t)=>e in l?Hi(l,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):l[e]=t;var o=(l,e,t)=>Wi(l,typeof e!="symbol"?e+"":e,t);import{d as Ge,T as de,R as xi,P as Ki,G as zi,A as Xi,H as Yi,C as bn,a as Qi,b as Zi,c as pn,S as wi,F as Ji,e as es,V as ts,f as ce,g as mn,B as rs,Q as vn,h as gn,O as Xr,p as ns,s as is,v as kn,i as ss,j as ls,t as hn,k as cs,l as as,m as os,n as us,o as fs,q as ds,r as bs,u as ps,w as ms,M as Sr,x as vs,y as gs,W as Sn,z as _n,D as Pi,E as Fe,I as hs,J as _s,N as xs,K as Bn,L as ws,U as Ps,X as Fs,Y as Fi,Z as yi,_ as ys,$ as ks,a0 as at,a1 as ot,a2 as ut,a3 as Ss,a4 as nr,a5 as Bs,a6 as Cr,a7 as qr,a8 as Ts,a9 as As,aa as ir,ab as Yr,ac as Cs,ad as qs,ae as Qr,af as Ls,ag as Tn,ah as Os,ai as Es,aj as Lr,ak as An,al as Or,am as Rs,an as Ns}from"./engine.worker-Mg4VKFVv.js";const B={X:0,Y:1,A:2,VX:3,VY:4,W:5,UX:6,UY:7,UW:8,M:9,I:10,RMAX:11,HULLA:12,HULLJ:13,PINNED:14,ASLEEP:15,GONE:16,REST:17,RX:18,RY:19,RA:20,PREV:21,PRED:24,PNOW:27,POLD:30,VPRE:33,MA6:36,MAOK:42,MA:43,IA:44,MAT:45,HEATER:46,NR:47,RO:48,NCELL:49,KO:50,NSEG:51,SO:52,BX0:53,BY0:54,BX1:55,BY1:56,OX0:57,OY0:58,OX1:59,OY1:60,FX:61,FY:62,TQ:63,TOUCH:64,BAND:65,AGAIN:66,COS:67,SIN:68,PROBE:69,KEY:70,VOL:71,E0:72,MA9:73,HIT:82,WAKE:83,PUSH:84,MELT:85},ft=88,lt={SEGS:0,PARTS:1,NPARTS:2,NRECT:3,NCELL:4,NBODY:5},ct=8,Kt={X0:0,Y0:1,X1:2,Y1:3,NI:4,NJ:5,XO:6,YO:7,KO:8,BODY:9},zt=12,Ms={RECT:0,SIDE:1,T0:2,T1:3,BODY:4},ki=8,Ds={X0:0,Y0:1,X1:2,Y1:3,ID:4,FRIC:5,BOUNCE:6},Zr=8,xe=4,K={X:0,Y:1,A:2,VX:3,VY:4,W:5,STATE:6,M:7,T:8,E:9,FILM:10,CRUST:11,FX:12,FY:13,TQ:14,MAOK:15,PM:16,PH:17,PS:18,RX0:19,RY0:20,RX1:21,RY1:22},Et=24,Is=.99,js=.9,Gs=.88,Us=.5,Vs=1e-5,xt=(l,e)=>Object.entries(e).map(([t,n])=>`const ${l}${t}: u32 = ${n}u;`).join(`
`),xn=[xt("B_",B),xt("GH_",lt),xt("GR_",Kt),xt("GS_",Ms),xt("GP_",Ds),xt("BRD_",K),`const BS: u32 = ${ft}u;`,`const GEO_RECTS: u32 = ${ct}u;`,`const RS: u32 = ${zt}u;`,`const SS: u32 = ${ki}u;`,`const PS: u32 = ${Zr}u;`,`const BC: u32 = ${xe}u;`,`const BR: u32 = ${Et}u;`,`const CLOSED_P: f32 = ${Is};`,`const CLOSED_F: f32 = ${js};`,`const REOPEN_F: f32 = ${Gs};`,`const SQUEEZE_B: f32 = ${Us};`,`const COVERED_EPS: f32 = ${Vs};`].join(`
`),fe=`${xn}
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
`,Q=`${fe}
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
`,Ue=`
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
`,fr=`
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
`,$s=`
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
`,mr=`
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
`,Lt={DT:0,TIME:1,RHOREF:2,NSUB:3,CAPACITY_WARN:4},Rt=16,x={PCOUNT:0,POLD:1,BCOUNT:2,NEXTID_B:3,NEXTID_P:4,PFULL:5,BFULL:6,PSORT:7,SUM_M:8,SUM_V:9,SUM_WM:10,SUM_WMT:11,SUM_CL:12,UMAXL:13,MAXOUT:14,WATCH:15,ESC_WATER:16,ESC_AIR:17,ESC_ENERGY:18,PRODUCED:19,CONDENSED:20,DEW:21,FOGMADE:22,BURSTVAP:23,HEATER_E:24,LOSS_WALLS:25,LOSS_OPEN:26,LOSS_SOLIDS:27,FLUX_SL:28,FLUX_LG:29,FLUX_SG:30,SIMTIME:31,STEPS:32,NUCLEATED:33,DEPARTED:34,MERGED:35,BURST:36,COLLAPSED:37,BURST_COLD:38,BURST_WARM:39,COLL_COLD:40,COLL_WARM:41,CAPPED:42,NSUBMAX:43,IT_L:44,IT_G:45,IT_H:46,IT_D:47,CAP_L:48,CAP_G:49,CAP_H:50,CAP_D:51,UMAXG:52,FOGERR:53,RES_L:54,RES_G:55,RES_H:56,WATCH_FATE:57,FIRST_SH:58,FIRST_MAT:59,VMAXP:60,RMAXB:61,SLOWED:62,VENTED:63,ESC_OTHER:65,ESC_SALT:66,CRYST:67,TMAX:64,OV_PMAX:68,OV_VMAX:69,OV_VGAS:70,OV_VLIQ:71,ARROWS:72,REL_MASS:73,REL_N:74,REL_MISS:75,EVAP_CAP:76,BODYWORK:77,IT_P:78,CAP_P:79,RES_P:80,PARKED:81,CONT_FULL:82,BVMAX:83,MELTED:84,FROZEN:85,MELTFULL:86},dt=96,Cn=16,Hs=57,H={OPEN:0,VFLUID:1,P0:2,RHOBAR:3,VLIQ:4,VBUB:5,VGAS:6,NSUM:7,MSUM:8,P0START:9,DP0:10,KCOMP:11,TOTAL:12,WORK:13},we=16,Ws={VLIQ:0,VBUB:1,NSUM:2,MSUM:3,A:4,B:5,ACOMP:6,VSUM:7},Jr=8,ie={MODE:0,POWER:1,TARGET:2,ON:3,P:4,TMEAN:5,INTEGRAL:6,CELLS:7},Pe=8,Ks={TSUM:0,CELLS:1},en=2,zs={PQ0:0,PQ1:1,RR0:2,RR1:3,RZ0:4,RZ1:5,RZ2:6,BB:7,CURK:8,ITER:9,TOLSQ:10,DONE:11},Si=16,N={PHI:0,ALPHA:1,ALPHAOLD:2,PL:3,PG:4,MN:5,MO:6,MV:7,MF:8,HG:9,ES:10,FILM:11,T:12,TL:13,CL:14,VGAS:15,RHO:16,NMOL:17,CAP:18,MU:19,VEOS:20,SRCV:21,VEOSMID:22,PHIS:23,SDF:24,TSAT:25,PTL:26,PCL:27,ACC:28,ACCH:29,SCALE:30,C:31,CS:32,CG:33,TSTAR:34,K:35,Q:36,SHARE:37,MTOT:38,Y0:39,RD:40,HVC:41,HNC:42,HOC:43,BG:44,BY:48,TS:52,VAP:53,VAPH:54,ACCALL:55,HOST:56,DHOST:57,ACCS:58,MOL:59,AW:60,DTB:61,CRUST:62,FLOOR:63,FLOORH:64,XS:65,XW:66,XT:67,XON:68,RHOW:69,FS:70,CAPB:71,TSB:72,ESY:73,FSY:74,KSY:75,WSUM:76,HW:77,COVL:78,COVB:79,KS:80,KF:81,DSF:82,GF:83,GK:84,PE0:85,RE0:86,KN0:87,PE1:88,RE1:89,KN1:90,MC:91,MCT:92,MW:93,MS:94,MWM:95,MFZ:96,MHI:97},Er=98,J={KIND:0,KPREV:1,SOLID:2,HGRP:3,RID:4,EDGE:5,OWNER:6,MATB:7,PAINT:8,SPLIT:9,NOW1:10,NOW2:11,KNEW:12,BAND:13,HBODY:14},Rr=15,tn={VOLSRC:0,HSRC:1,FM:2,FE:3,BUDGET:4,DN:5,DO:6,DV:7,DF:8,DH:9,ALPHA:10,DFILM:11,DES:12,CHF:13,DCRUST:14,DFLOOR:15,DFLOORH:16,MGM:17,MGH:18,MGS:19,MCLAIM:20,MSEEN:21},Nr=22,Me={UL:0,UG:1,TMP:2,MAC1:3,LO:4,HI:5,TSCR:6,FLUX:7,DV:12,DN:13,DO:14,DH:15,ETA:16,U0:17,VF:18,VT:19},Mr=20,Xs={KNOWN:0,MARK:1,MARK2:2,GAS:3},qn=4,Ys={F:0},Dr=1,Qs={V:0,XV:1,YV:2,ZV:3,VXV:4,VYV:5,MN:6,MO:7,MV:8,H:9,AGE:10,FLAGS:11},rn=12,ae=(l,e)=>Object.entries(e).map(([t,n])=>`const ${l}${t}: u32 = ${n}u;`).join(`
`),Zs=[ae("G_",Lt),ae("C_",x),ae("R_",H),ae("RA_",Ws),ae("H_",ie),ae("HA_",Ks),ae("S_",zs),ae("F_",N),ae("U_",J),ae("A_",tn),ae("FF_",Me),ae("FU_",Xs),ae("AF_",Ys),ae("BA_",Qs),`const RACC_STRIDE: u32 = ${Jr}u;`,`const HEAT_STRIDE: u32 = ${Pe}u;`,`const HACC_STRIDE: u32 = ${en}u;`,`const CGS_STRIDE: u32 = ${Si}u;`,`const BACC_STRIDE: u32 = ${rn}u;`].join(`
`);function w(l){if(!Number.isFinite(l))throw new Error(`not a finite constant: ${l}`);const e=Math.abs(l)>=1e-4&&Math.abs(l)<1e7?String(l):l.toExponential(9);return/[.eE]/.test(e)?e:`${e}.0`}const ne=l=>l.map(w).join(", "),te=Ge.species[0],sr=Ge.species[1],lr=Ge.species[2],bt=te.liquid.cp.table,je=bt.map(l=>l[0]),pt=bt.map(l=>l[1]),vr=[pt[0]*(je[0]-de)];for(let l=1;l<bt.length;l+=1)vr.push(vr[l-1]+.5*(pt[l]+pt[l-1])*(je[l]-je[l-1]));const[Js,el,tl]=te.vapour.cp.linear,nn=de+100,rl=(()=>{let l=0;for(;l<je.length-2&&nn>=je[l+1];)l+=1;const e=nn-je[l],t=(pt[l+1]-pt[l])/(je[l+1]-je[l]);return vr[l]+pt[l]*e+.5*t*e*e})(),nl=rl+te.saturation.hlv100.v,qe=Ge.solids,Bi=Ge.species.slice(3).map(l=>{const e=l.liquid,[t,n]=e.cp.linear;return{cA:t,cB:n,h0:t*de+.5*n*de*de,rA:e.rho.linear[0],rB:e.rho.linear[1],kA:e.k.linear[0],kB:e.k.linear[1],mA:e.mu.vogel[0],mB:e.mu.vogel[1],mC:e.mu.vogel[2],sigma:e.sigma.v}}),Ti=1+Bi.length,ge=l=>`array<f32, ${Ti}>(${ne([0,...Bi.map(l)])})`,Ir=4294967295,il=`
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
}`,Ln=52,sl=`
struct Particle {
  x: f32, y: f32, vx: f32, vy: f32,
  c00: f32, c01: f32, c10: f32, c11: f32,
  mass: f32, h: f32, T: f32, rho: f32,
  dvp: f32, flags: u32, id: u32, bi: i32,
  bj: i32,
  wt: array<f32, 9>,
  s: f32,
}`,wt=27,ll=`
struct Bubble {
  x: f32, y: f32, z: f32, vx: f32,
  vy: f32, mN: f32, mO: f32, mV: f32,
  H: f32, age: f32, site: i32, r: f32,
  V: f32, pb: f32, pv: f32, Tb: f32,
  dmdt: f32, ux0: f32, uy0: f32, id: u32,
  alive: u32,
  force: array<f32, 8>,
}`,Pt=29,cl=`
struct Site {
  cell: u32, fluid: u32, dir: u32, bubble: u32,
  r: f32, s: f32, z: f32, pad: f32,
}`,jr=8,al=`
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
struct Sub { s: u32, p0: u32, p1: u32, p2: u32 }`,ol=`
const GAS: u32 = 0u;
const LIQUID: u32 = 1u;
const SOLID: u32 = 2u;
const NONE: u32 = 0xffffffffu;
const T0: f32 = ${w(de)};
const R_GAS: f32 = ${w(xi)};
const P_ATM: f32 = ${w(Ki)};
const G0: f32 = ${w(zi)};
const PI: f32 = 3.14159265358979;
const M_N2: f32 = ${w(sr.molarMass.v)};
const M_O2: f32 = ${w(lr.molarMass.v)};
const M_H2O: f32 = ${w(te.molarMass.v)};
const CP_N2: f32 = ${w(sr.gas.cp.v)};
const CP_O2: f32 = ${w(lr.gas.cp.v)};
const CPV0: f32 = ${w(Js)};
const CPV1: f32 = ${w(el)};
const CPV_T: f32 = ${w(tl)};
const T100: f32 = ${w(nn)};
const HV100: f32 = ${w(nl)};
const NCP: i32 = ${bt.length};
const CP_T = array<f32, ${bt.length}>(${ne(je)});
const CP_V = array<f32, ${bt.length}>(${ne(pt)});
const CP_H = array<f32, ${bt.length}>(${ne(vr)});
const KELL = array<f32, 7>(${ne(te.liquid.kell.c)});
const KL = array<f32, 3>(${ne(te.liquid.k.poly)});
const VA: f32 = ${w(te.liquid.mu.vogel[0])};
const VB: f32 = ${w(te.liquid.mu.vogel[1])};
const VC: f32 = ${w(te.liquid.mu.vogel[2])};
const ST_B: f32 = ${w(te.surfaceTension.B)};
const ST_b: f32 = ${w(te.surfaceTension.b)};
const ST_MU: f32 = ${w(te.surfaceTension.mu)};
const T_CRIT: f32 = ${w(te.saturation.Tc.v)};
const RHO_CRIT: f32 = ${w(te.saturation.rhoc.v)};
const N97 = array<f32, 10>(${ne(te.saturation.if97.n)});
const RVC = array<f32, 6>(${ne(te.saturation.vapourDensity.c)});
const KV: f32 = ${w(te.vapour.k.v)};
const MUV: f32 = ${w(te.vapour.mu.v)};
const KN = array<f32, 3>(${ne(sr.gas.k.power)});
const KO = array<f32, 3>(${ne(lr.gas.k.power)});
const MN = array<f32, 3>(${ne(sr.gas.mu.sutherland)});
const MO = array<f32, 3>(${ne(lr.gas.mu.sutherland)});
const DV0: f32 = ${w(Ge.vapourInAir.D0.v)};
const DVT0: f32 = ${w(Ge.vapourInAir.T0.v)};
const DVE: f32 = ${w(Ge.vapourInAir.exponent.v)};
const NSOL: u32 = ${qe.length}u;
const S_RHO = array<f32, ${qe.length}>(${ne(qe.map(l=>l.rho.v))});
const S_CP = array<f32, ${qe.length}>(${ne(qe.map(l=>l.cp.v))});
const S_K = array<f32, ${qe.length}>(${ne(qe.map(l=>l.k.v))});
const S_THETA = array<f32, ${qe.length}>(${ne(qe.map(l=>l.contactAngle.v))});
const DRIFT_GAIN: f32 = 0.1;
const DRIFT_DT: f32 = 5e-4;
const RHO_MIN: f32 = 0.05;
const MIN_MASS: f32 = 1e-3;
const FRITZ: f32 = 0.0208;
const C_A: f32 = 0.5;
const AGE_STEP: f32 = 1.0;
const ALPHA_RATE: f32 = ${w(Xi)};
const REG_STRIDE: u32 = ${we}u;
const EMPTY_FACE: f32 = 1e-9;
const H_EXT0: f32 = ${w(Yi)};
/* c_p des Salzkristalls (Kruste auf Feststoffen, M2b). */
const CP_CRYSTAL: f32 = ${w(bn)};
const NLIQ: u32 = ${Ti}u;
const L_CA = ${ge(l=>l.cA)};
const L_CB = ${ge(l=>l.cB)};
const L_H0 = ${ge(l=>l.h0)};
const L_RA = ${ge(l=>l.rA)};
const L_RB = ${ge(l=>l.rB)};
const L_KA = ${ge(l=>l.kA)};
const L_KB = ${ge(l=>l.kB)};
const L_MA = ${ge(l=>l.mA)};
const L_MB = ${ge(l=>l.mB)};
const L_MC = ${ge(l=>l.mC)};
const L_SIG = ${ge(l=>l.sigma)};
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
`,fl=`
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
`,wn=[il,sl,ll,cl,al,ol,Zs,ul,fl].join(`
`),Xt=60*2**24,Le={K:3,LOST:8,NEXT_LO:9,FRAMES:11,DT:12,PROBE:14},Ut=16,ee=8,ke={LO:0,PMAX:1,VMAX:2,NB:3,INDEX:4,HI:5,NQ:6,NR:7},dl=28,Se="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",et=`
struct Bk {
  sw: u32, kmax: u32, period: u32, bcap: u32,
  oFlags: u32, oCrust: u32, oGlow: u32, oTemp: u32,
  oPres: u32, oSpeed: u32, oHum: u32, oVap: u32,
  oFog: u32, oLiq: u32, oArw: u32, oBub: u32,
  oQuad: u32, nq: u32, na: u32, nax: u32,
  astep: u32, ahalf: u32, every: u32, body: u32,
  oRect: u32, ncell: u32, pad1: u32, pad2: u32,
}
fn rnd(x: f32) -> f32 { return floor(x + 0.5); }
fn u8q(x: f32) -> u32 { return u32(floor(255.0 * clamp(x, 0.0, 1.0) + 0.5)); }
fn tq(T: f32) -> u32 { return u32(clamp(rnd((T - ${w(Qi)}) / ${w(Zi)}), 0.0, 65535.0)); }
fn crustCov(m: f32, size: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${w(pn)} * size * P.depth) / size)); }
fn velQ(u: f32) -> i32 { return i32(rnd(127.0 * sign(u) * sqrt(min(1.0, abs(u) / ${w(wi)})))); }
`,bl=[{name:"bkClock",wg:64,bind:"P:u K:u<Bk> glob:r bkc:w<u32> bkh:a",code:`${et}
${Se} {
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
  bkc[12] = u32(round(glob[G_DT] * ${w(Xt)}));
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
}`},{name:"bkCells",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> cf:r cu:r ff:r reg:r bkm:r<u32> bko:w<u32> bkh:a",code:`${et}
${Se} {
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
    /* Ein Körper zeichnet sich selbst: die Treppenzellen (bkm) — mit genauen Anteilen die Zellen, die ein Körper besitzt (wie sampleLayers: owner). */
    var mine = bkm[c] != 0u;
    if (K.body != 0u) { mine = cu[U_OWNER * n + c] != 0u; }
    let built = kind == SOLID && sol != 0u && !mine;
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
      if (fgv > 0.0) { fo = u8q(min(0.95, 1.0 - exp(-fgv / ${w(Ji)}))); }
    }
    if (ov) {
      if (kind != LIQUID) { tqv = tq(T); }
      fl = select(0u, 1u, cf[F_ALPHA * n + c] > 0.02);
      if (kind == GAS) {
        let pg = cf[F_PG * n + c];
        let pq = 128 + i32(rnd(127.0 * sign(pg) * sqrt(min(1.0, abs(pg) / ${w(es)}))));
        p = u32(pq);
        pm = max(pm, u32(abs(pq - 128)));
        let og = FF_UG * P.nf;
        let u = 0.5 * (ff[og + uF(i, j)] + ff[og + uF(i + 1, j)]);
        let v = 0.5 * (ff[og + vF(i, j)] + ff[og + vF(i, j + 1)]);
        s = u32(rnd(255.0 * sqrt(min(1.0, sqrt(u * u + v * v) / ${w(wi)}))));
        vm = max(vm, s);
        let mv = cf[F_MV * n + c];
        let nd = cf[F_MN * n + c] / M_N2 + cf[F_MO * n + c] / M_O2;
        let nv = mv / M_H2O;
        var x = 0.0;
        if (nv + nd > 0.0) { x = nv / (nv + nd); }
        hu = u32(rnd(63.0 * clamp(x * pAt(c) / pSat(T), 0.0, 1.0)));
        va = u8q(mv / max(1e-12, cf[F_VGAS * n + c]) / ${w(ts)});
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
}`},{name:"bkLiqSplat",wg:128,bind:"P:u bkc:r<u32> lq:w parts:r ccount:r cstart:r bsum:r",code:`${Se} {
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
}`},{name:"bkLiqExt",wg:128,bind:"P:u bkc:r<u32> lqa:r lqb:w bkt:r<u32>",code:`${Se} {
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
}`},{name:"bkLiqBlurX",wg:128,bind:"P:u bkc:r<u32> lqa:r lq2:w",code:`${Se} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lqa[4u * l + k] + 0.5 * lqa[4u * t + k] + 0.25 * lqa[4u * r + k]; }
}`},{name:"bkLiqOut",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> lq2:r bko:w<u32>",code:`${et}
${Se} {
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
    G = u32(floor(clamp(255.0 * (wt / w - T0 - ${w(ce[0])}) / ${w(ce[1]-ce[0])}, 0.0, 255.0)));
    Bc = u32(floor(clamp(255.0 * wo / w, 0.0, 255.0)));
    A = u32(floor(clamp(255.0 * wsl / (w * ${w(mn)}), 0.0, 255.0)));
  }
  bko[bkc[7] * K.sw + K.oLiq + t] = R | (G << 8u) | (Bc << 16u) | (A << 24u);
}`},{name:"bkArrows",wg:64,bind:"P:u K:u<Bk> bkc:r<u32> cu:r ff:r bko:w<u32>",code:`${et}
${Se} {
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
}`},{name:"bkBubbles",wg:128,bind:"P:u K:u<Bk> bkc:r<u32> cnt:r<u32> bubs:r bko:w<u32> bkh:a",code:`${et}
${Se} {
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
}`},{name:"bkQuads",wg:64,bind:"P:u K:u<Bk> bkc:r<u32> cf:r bkm:r<u32> qs:r<u32> qc:r<u32> qw:r qx:r q0:r c0:r bko:w<u32>",code:`${et}
${Se} {
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
}`},{name:"bkTexB",wg:128,bind:"P:u bkc:r<u32> bod:r bgeo:r bkt:w<u32>",code:`${Q}
fn inBodiesT(x: f32, y: f32) -> bool {
  for (var b = 0u; b < P.nbody; b++) {
    if (bGone(b)) { continue; }
    let dx = x - bv(b, B_X);
    let dy = y - bv(b, B_Y);
    let rm = bv(b, B_RMAX) + 1e-6;
    if (dx * dx + dy * dy > rm * rm) { continue; }
    let a = bv(b, B_A);
    let c = cos(a);
    let s = sin(a);
    let l = vec2<f32>(c * dx + s * dy, -s * dx + c * dy);
    let nr = u32(bv(b, B_NR));
    for (var r = 0u; r < nr; r++) {
      let bx = rBox(rectOf(b, r));
      if (l.x >= bx.x && l.x <= bx.z && l.y >= bx.y && l.y <= bx.w) { return true; }
    }
  }
  return false;
}
${Se} {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let h = 0.5 * P.dx;
  bkt[t] = select(0u, 1u, inBodiesT((f32(t % lx) + 0.5) * h, (f32(t / lx) + 0.5) * h));
}`},{name:"bkBodyB",wg:64,bind:"P:u K:u<Bk> bkc:r<u32> bod:r bgeo:r bcell:r bko:w<u32> bkh:a",code:`${et}
${Q}
fn cellTK(E: f32, C: f32, film: f32, crust: f32) -> f32 {
  let cs = C + crust * CP_CRYSTAL;
  if (!(cs > 0.0)) { return 293.15; }
  if (film <= 0.0) { return T0 + E / cs; }
  var T = 293.15;
  for (var it = 0; it < 3; it++) { T -= (cs * (T - T0) + film * hL(T) - E) / (cs + film * cpL(T)); }
  return T;
}
fn angQ(a: f32) -> u32 { let t = a / ${w(2*Math.PI)} + 0.5; return u32(rnd(65535.0 * (t - floor(t)))) & 65535u; }
fn posQ(v: f32, w: f32) -> u32 { return u32(rnd(65535.0 * clamp(v / w, 0.0, 1.0))); }
fn putU16(w0: u32, i: u32, v: u32) {
  let w = w0 + i / 2u;
  if ((i & 1u) == 0u) { bko[w] = (bko[w] & 0xffff0000u) | v; } else { bko[w] = (bko[w] & 0xffffu) | (v << 16u); }
}
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (bkc[2] == 0u) { return; }
  let t = gid.x;
  let slot = bkc[7];
  let base = slot * K.sw;
  if (t == 0u) {
    var nq = 0u;
    var nr = 0u;
    for (var b = 0u; b < P.nbody; b++) {
      if (bGone(b)) { continue; }
      nq += u32(bv(b, B_NCELL));
      let a = bv(b, B_A);
      let c = cos(a);
      let s = sin(a);
      let nrb = u32(bv(b, B_NR));
      for (var r = 0u; r < nrb; r++) {
        let bx = rBox(rectOf(b, r));
        let lx = 0.5 * (bx.x + bx.z);
        let ly = 0.5 * (bx.y + bx.w);
        let o = base + K.oRect;
        putU16(o, 5u * nr, posQ(bv(b, B_X) + c * lx - s * ly, P.boxw));
        putU16(o, 5u * nr + 1u, posQ(bv(b, B_Y) + s * lx + c * ly, P.boxh));
        putU16(o, 5u * nr + 2u, min(65535u, u32(rnd(5e4 * (bx.z - bx.x)))));
        putU16(o, 5u * nr + 3u, min(65535u, u32(rnd(5e4 * (bx.w - bx.y)))));
        putU16(o, 5u * nr + 4u, angQ(a));
        nr += 1u;
      }
    }
    atomicStore(&bkh[slot * 8u + 6u], nq);
    atomicStore(&bkh[slot * 8u + 7u], nr);
  }
  if (t >= K.ncell) { return; }
  let rq = u32(bcell[BC * t + 3u]);
  let b = u32(rv(rq, GR_BODY));
  if (bGone(b)) { return; }
  let local = t - u32(bv(b, B_KO));
  if (local >= u32(bv(b, B_NCELL))) { return; }
  var qi = local;
  for (var o = 0u; o < b; o++) { if (!bGone(o)) { qi += u32(bv(o, B_NCELL)); } }
  let loc = t - u32(rv(rq, GR_KO));
  let ni = u32(rv(rq, GR_NI));
  let p = loc % ni;
  let q = loc / ni;
  let x0 = rxs(rq, p);
  let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q);
  let y1 = rys(rq, q + 1u);
  let a = bv(b, B_A);
  let c = cos(a);
  let s = sin(a);
  let lx = 0.5 * (x0 + x1);
  let ly = 0.5 * (y0 + y1);
  let mb = u32(bv(b, B_MAT)) + 1u;
  let C = solidRho(mb) * solidCp(mb) * P.depth * (x1 - x0) * (y1 - y0);
  let crust = bcell[BC * t + 2u];
  let T = cellTK(bcell[BC * t], C, bcell[BC * t + 1u], crust);
  let gl = u8q((T - T0 - 60.0) / 340.0);
  let cr = u8q(crustCov(crust, max(1e-6, min(x1 - x0, y1 - y0))));
  let o4 = base + K.oQuad + 4u * qi;
  bko[o4] = posQ(bv(b, B_X) + c * lx - s * ly, P.boxw) | (posQ(bv(b, B_Y) + s * lx + c * ly, P.boxh) << 16u);
  bko[o4 + 1u] = min(65535u, u32(rnd(5e5 * (x1 - x0)))) | (min(65535u, u32(rnd(5e5 * (y1 - y0)))) << 16u);
  bko[o4 + 2u] = angQ(a) | (mb << 16u);
  bko[o4 + 3u] = gl | (cr << 8u) | (tq(T) << 16u);
}`}],cr=(l,e,t=1)=>l.length>0?l:e(t);function pl(l,e,t){const n=l.grid,i=n.n,r=new Uint32Array(i);for(let P=0;P<i;P+=1)r[P]=e.body[P];const s=2*n.nx,c=2*n.ny,f=n.dx/2,u=new Uint32Array(s*c),d=new Float64Array(2),m=new Float64Array(4);let _=0;for(const P of l.bodies.list){if(P.gone)continue;P.worldBox(P.x,P.y,P.a,m);const k=Math.max(0,Math.floor(m[0]/f)),E=Math.min(s-1,Math.floor(m[2]/f)),D=Math.max(0,Math.floor(m[1]/f)),U=Math.min(c-1,Math.floor(m[3]/f));for(let V=D;V<=U;V+=1)for(let y=k;y<=E;y+=1)rs.toLocal(P.x,P.y,P.a,(y+.5)*f,(V+.5)*f,d),P.insideLocal(d[0],d[1],0)&&u[y+V*s]===0&&(u[y+V*s]=1,_+=1)}const L=t.nq,v=t.nr,A=t.quads.slice(0,vn*L),G=t.rects.slice(0,gn*v),C=[0],h=[],b=[],O=[],q=[],F=[],p=[],M=new Float64Array(i);for(const P of l.bodies.list)if(!P.gone)for(let k=0;k<P.nw;k+=1)M[P.wc[k]]+=P.ww[k];for(const[P,k]of l.bodies.list.entries()){if(k.gone)continue;const E=new Map;for(let D=0;D<k.nw;D+=1){const U=k.wk[D];let V=E.get(U);V===void 0&&(V=[],E.set(U,V)),V.push([k.wc[D],k.ww[D]])}for(let D=0;D<k.nr;D+=1){const U=k.xs[D],V=k.ys[D];for(let y=0;y<k.nj[D];y+=1)for(let X=0;X<k.ni[D];X+=1){const R=k.off[D]+X+y*k.ni[D];for(const[I,ve]of E.get(R)??[])h.push(I),b.push(ve),O.push(M[I]>0?ve/M[I]:0);C.push(h.length),q.push(k.cellT(R),k.crust[R],Math.max(1e-6,Math.min(U[X+1]-U[X],V[y+1]-V[y]))),F.push(P),p.push(R)}}}if(C.length-1!==L)throw new Error(`capture: ${C.length-1} quads from the bodies, ${L} in the frame`);const g=new Float32Array(2*i);for(let P=0;P<i;P+=1)g[P]=e.T[P],g[i+P]=n.crust[P];return{cellMask:r,texMask:u,texInBody:_,nq:L,nr:v,quadGeo:A,rects:G,qs:Uint32Array.from(C),qc:cr(Uint32Array.from(h),P=>new Uint32Array(P)),qw:cr(Float32Array.from(b),P=>new Float32Array(P)),qx:cr(Float32Array.from(O),P=>new Float32Array(P)),q0:cr(Float32Array.from(q),P=>new Float32Array(P),3),c0:g,quadBody:Int32Array.from(F),quadCell:Int32Array.from(p)}}function ml(l,e){const t=l.bodies.list;for(let n=0;n<e.nq;n+=1){const i=t[e.quadBody[n]],r=e.quadCell[n];e.q0[3*n]=i.cellT(r),e.q0[3*n+1]=i.crust[r]}}function vl(l,e,t){for(let n=0;n<l.nq;n+=1){const i=vn*n;for(let r=0;r<6;r+=1)t[i+r]=l.quadGeo[i+r];t[i+6]=e[n]&65535,t[i+7]=e[n]>>>16}}function gl(l,e,t,n,i,r=0,s=!1){const c=l*e,f=Math.ceil(c/4),u=ss(t),d=u>>1,m=ls(l,e,t),_=11*f,L=_+4*c,v=L+Math.ceil(m/2),A=v+2*n,G=A+(s?4:1)*Math.max(1,i),C=G+(s?Math.ceil(gn*Math.max(1,r)/2):0);return{sw:4*Math.ceil(C/4),flags:f,crust:2*f,glow:3*f,temp:4*f,pres:6*f,speed:7*f,hum:8*f,vap:9*f,fog:10*f,liq:_,arw:L,bub:v,quad:A,rect:G,na:m,nax:Math.max(0,Math.ceil((l-d)/u)),astep:u,ahalf:d}}class hl{constructor(e,t,n,i){o(this,"kmax");o(this,"lay");o(this,"bodies");o(this,"body");o(this,"batchBytes");o(this,"headAt",4*Ut);o(this,"slotAt");o(this,"g");o(this,"e");o(this,"own",[]);o(this,"bkc");o(this,"bko");o(this,"bkh");o(this,"q0");o(this,"c0");o(this,"groups");o(this,"quads");o(this,"rects");this.g=e,this.e=e.cpu;const r=e.state;this.body=r.body;const s=r.staircase;if(s===null&&!this.body)throw new Error("capture: no staircase (state not uploaded)");this.bodies=s!==null&&!this.body?pl(this.e,s,i):null;const c=this.e.grid,f=c.n,u=this.bodies!==null?this.bodies.nq:r.bodies.ncell;this.lay=gl(c.nx,c.ny,c.dx,r.d.bcap,u,r.bodies.nrect,this.body);const d=Math.fround(this.e.dtMax);this.kmax=Math.min(n,Math.ceil(n*d*t)+1),this.slotAt=this.headAt+4*ee*this.kmax,this.batchBytes=this.slotAt+4*this.lay.sw*this.kmax;const m=e.ctx,_=(M,g,P)=>{const k=m.buffer(M,4*Math.max(4,g));return this.own.push(k),P!==void 0&&m.device.queue.writeBuffer(k,0,P),k},L=this.kmax+1,v=this.bodies;this.bkc=_("bkc",Ut),this.bko=_("bko",this.lay.sw*L),this.bkh=_("bkh",ee*L);const A=_("lq",16*f),G=_("lqE",16*f),C=_("lq2",16*f),h=this.lay,b=new Uint32Array(dl);b.set([h.sw,this.kmax,Math.round(Xt/t),r.d.bcap,h.flags,h.crust,h.glow,h.temp,h.pres,h.speed,h.hum,h.vap,h.fog,h.liq,h.arw,h.bub,h.quad,v!==null?v.nq:0,h.na,h.nax,h.astep,h.ahalf,Xr,this.body?1:0,h.rect,r.bodies.ncell,0,0]);const O=m.uniform("bk",b.buffer);this.own.push(O);const q=new Uint32Array(4);this.q0=_("q0",v!==null?v.q0.length:4,(v==null?void 0:v.q0)??q),this.c0=_("c0",v!==null?v.c0.length:4,(v==null?void 0:v.c0)??q);const F={P:r.params,K:O,glob:r.glob,cnt:r.cnt,cf:r.cf,cu:r.cu,ff:r.ff,reg:r.reg,parts:r.partsA,ccount:r.ccountB,cstart:r.cstart,bsum:r.bsum,bubs:r.bubs,bkc:this.bkc,bko:this.bko,bkh:this.bkh,lq:A,lq2:C,bkm:_("bkm",f,(v==null?void 0:v.cellMask)??new Uint32Array(f)),bkt:_("bkt",4*f,v==null?void 0:v.texMask),qs:_("qs",v!==null?v.qs.length:4,(v==null?void 0:v.qs)??q),qc:_("qc",v!==null?v.qc.length:4,(v==null?void 0:v.qc)??q),qw:_("qw",v!==null?v.qw.length:4,(v==null?void 0:v.qw)??q),qx:_("qx",v!==null?v.qx.length:4,(v==null?void 0:v.qx)??q),q0:this.q0,c0:this.c0,bod:r.bodies.bod,bgeo:r.bodies.bgeo,bcell:r.bodies.bcell},p=(M,g={})=>m.bind(M,{...F,...g});this.groups={clock:p("bkClock"),cells:p("bkCells"),splat:p("bkLiqSplat"),ext1:p("bkLiqExt",{lqa:A,lqb:G}),ext2:p("bkLiqExt",{lqa:G,lqb:A}),blurX:p("bkLiqBlurX",{lqa:G}),out:p("bkLiqOut"),arrows:p("bkArrows"),bubbles:p("bkBubbles"),quads:p("bkQuads"),texB:p("bkTexB"),bodyB:p("bkBodyB")},this.quads=new Uint16Array(Math.max(16,i.quads.length)),this.rects=new Uint16Array(Math.max(16,i.rects.length)),v!==null&&this.rects.set(v.rects)}start(e){const t=new Uint32Array(Ut);t[Le.NEXT_LO]=Math.round(Xt/e),t[Le.FRAMES]=1,t[Le.DT]=Math.round(Math.fround(Math.fround(this.e.dt)*Xt)),this.g.ctx.device.queue.writeBuffer(this.bkc,0,t)}rebase(){const e=this.bodies;if(e===null||e.nq===0)return;ml(this.e,e);const t=this.g.ctx.device;t.queue.writeBuffer(this.q0,0,e.q0);const n=this.e.grid.n,i=this.g.state.cf,r=t.createCommandEncoder();r.copyBufferToBuffer(i,4*N.T*n,this.c0,0,4*n),r.copyBufferToBuffer(i,4*N.CRUST*n,this.c0,4*n,4*n),t.queue.submit([r.finish()])}begin(e){e.clearBuffer(this.bkc,4*Le.K,4)}encode(e){const t=this.g.ctx,n=this.e.grid.n,i=this.groups,r=e.beginComputePass();t.dispatch(r,"bkClock",i.clock,1),t.dispatch(r,"bkCells",i.cells,Math.ceil(n/4)),t.dispatch(r,"bkLiqSplat",i.splat,4*n),this.body&&t.dispatch(r,"bkTexB",i.texB,4*n),t.dispatch(r,"bkLiqExt",i.ext1,4*n),t.dispatch(r,"bkLiqExt",i.ext2,4*n),t.dispatch(r,"bkLiqExt",i.ext1,4*n),t.dispatch(r,"bkLiqBlurX",i.blurX,4*n),t.dispatch(r,"bkLiqOut",i.out,4*n),t.dispatch(r,"bkArrows",i.arrows,Math.ceil(this.lay.na/2)),t.dispatch(r,"bkBubbles",i.bubbles,this.g.state.d.bcap),this.bodies!==null?t.dispatch(r,"bkQuads",i.quads,Math.max(1,this.bodies.nq)):t.dispatch(r,"bkBodyB",i.bodyB,Math.max(1,this.g.state.bodies.ncell)),r.end()}copyOut(e,t){e.copyBufferToBuffer(this.bkc,0,t,0,4*Ut),e.copyBufferToBuffer(this.bkh,0,t,this.headAt,4*ee*this.kmax),e.copyBufferToBuffer(this.bko,0,t,this.slotAt,4*this.lay.sw*this.kmax)}read(e){const t=new Uint32Array(e,0,Ut);return{count:t[Le.K],lost:t[Le.LOST],captured:t[Le.FRAMES]}}index(e,t){return new Uint32Array(e,this.headAt+4*ee*t,ee)[ke.INDEX]}frame(e,t,n){return this.layersAt(e,this.headAt+4*ee*t,this.slotAt+4*this.lay.sw*t,n)}copyFrame(e,t,n){const i=4*ee+4*this.lay.sw,r=n!==null&&n.byteLength===i?n:new ArrayBuffer(i),s=new Uint8Array(r);return s.set(new Uint8Array(e,this.headAt+4*ee*t,4*ee),0),s.set(new Uint8Array(e,this.slotAt+4*this.lay.sw*t,4*this.lay.sw),4*ee),r}layersAt(e,t,n,i){const r=new Uint32Array(e,t,ee),s=r[ke.INDEX]===4294967295||r[ke.INDEX]%Xr===0;return this.view(e,n,r,s,i)}view(e,t,n,i,r){const s=this.e.grid,c=s.n,f=this.lay,u=(L,v)=>new Uint8Array(e,t+4*L,v);r.nx=s.nx,r.ny=s.ny,r.dx=s.dx,r.depth=s.depth,r.boxW=s.w,r.boxH=s.h,r.t=(n[ke.HI]*2**32+n[ke.LO])/Xt,r.code=u(0,c),r.flags=u(f.flags,c),r.crust=u(f.crust,c),r.glow=u(f.glow,c),r.temp=new Uint16Array(e,t+4*f.temp,c),r.pres=u(f.pres,c),r.speed=u(f.speed,c),r.hum=u(f.hum,c),r.vap=u(f.vap,c),r.fog=u(f.fog,c),r.liquid=u(f.liq,16*c),r.arrows=new Int8Array(e,t+4*f.arw,2*f.na),r.pmax=Math.max(1,ns(128+n[ke.PMAX])),r.vmax=Math.max(.02,is(n[ke.VMAX])),r.nb=n[ke.NB],r.bubbles=new Uint16Array(e,t+4*f.bub,4*this.g.state.d.bcap);let d=0,m=0;if(i){let L=0;for(let v=f.ahalf;v<s.ny;v+=f.astep)for(let A=f.ahalf;A<s.nx;A+=f.astep,L+=1){const G=r.code[A+v*s.nx]&3;if(G!==0&&G!==1)continue;const C=Math.hypot(kn(r.arrows[2*L]),kn(r.arrows[2*L+1]));G===0?d=Math.max(d,C):m=Math.max(m,C)}}r.vGas=d,r.vLiq=m;const _=this.bodies;return _===null?(r.nq=n[ke.NQ],r.nr=n[ke.NR],r.quads=new Uint16Array(e,t+4*f.quad,vn*r.nq),r.rects=new Uint16Array(e,t+4*f.rect,gn*r.nr),r):(vl(_,new Uint32Array(e,t+4*f.quad,Math.max(1,_.nq)),this.quads),r.quads=this.quads,r.rects=this.rects,r.nq=_.nq,r.nr=_.nr,r)}async probe(){const e=this.g.ctx.device,t=this.kmax;e.queue.writeBuffer(this.bkc,4*Le.PROBE,new Uint32Array([1]));const n=4*ee+4*this.lay.sw,i=e.createBuffer({label:"probe",size:Math.ceil(n/16)*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),r=e.createCommandEncoder();this.encode(r),r.clearBuffer(this.bkc,4*Le.PROBE,4),r.copyBufferToBuffer(this.bkh,4*ee*t,i,0,4*ee),r.copyBufferToBuffer(this.bko,4*this.lay.sw*t,i,4*ee,4*this.lay.sw),e.queue.submit([r.finish()]),await i.mapAsync(GPUMapMode.READ);const s=i.getMappedRange().slice(0);i.unmap(),i.destroy();const c=sn();return this.view(s,4*ee,new Uint32Array(s,0,ee),!0,c),c.quads=c.quads.slice(),c.rects=c.rects.slice(),c}destroy(){this.g.ctx.release(this.own),this.own.length=0}}function sn(){const l=new Uint8Array(0);return{nx:0,ny:0,dx:0,depth:0,boxW:0,boxH:0,t:0,code:l,flags:l,crust:l,glow:l,temp:new Uint16Array(0),pres:l,speed:l,hum:l,vap:l,fog:l,liquid:l,arrows:new Int8Array(0),pmax:1,vmax:.02,vGas:0,vLiq:0,nb:0,bubbles:new Uint16Array(0),nq:0,quads:new Uint16Array(0),nr:0,rects:new Uint16Array(0)}}class _l{constructor(e){o(this,"g");o(this,"last",null);o(this,"latent0",0);o(this,"stored0",0);o(this,"started",!1);this.g=e}vapour(){const e=this.g.totals;return e.produced-e.condensed+e.burstVapour}sample(){const e=this.g,t=e.last;if(t===null)return null;const n=e.totals,i=hn(e.cpu.regions.pAmb),r=cs(i),s=e.budget(),c={t:n.time,heater:n.heater,solids:s.solids,sens:t.sensible,SG:n.fluxSG,LG:n.fluxLG,lossS:n.lossSolids,bub:s.bubbles,vap:this.vapour()},f=this.last;let u=0,d=0;if(f!==null&&c.t>f.t){const L=c.t-f.t,v=(c.heater-f.heater)/L,A=(c.solids-f.solids+c.SG-f.SG+c.lossS-f.lossS+c.LG-f.LG+c.sens-f.sens+c.bub-f.bub)/L;u=(c.vap-f.vap)/L,d=Math.max(0,(v-A)/r)}this.last=c;const m=this.vapour()*r,_=s.energy;return this.started||(this.started=!0,this.latent0=m,this.stored0=_),{t:n.time,waterT:t.waterT,waterTmax:t.waterTmax,Tsat:i,heater:n.heater,latent:m-this.latent0,sensible:_-this.stored0-(m-this.latent0),losses:n.lossWalls+n.lossOpen,escaped:n.escapedEnergy,liquid:s.water.liquid,vapour:s.water.vapour,fog:s.water.fog,film:s.water.film,bubbles:s.water.bubbles,escapedWater:s.water.escaped,vapourRate:u,expectedRate:d}}copyTo(e){const t=e;t.last=this.last===null?null:{...this.last},t.latent0=this.latent0,t.stored0=this.stored0,t.started=this.started}copyFrom(e){const t=e;this.last=t.last===null?null:{...t.last},this.latent0=t.latent0,this.stored0=t.stored0,this.started=t.started}}const pe=4,me=32,Ae={PEND:0,CAPC:28,CAPX:29,CAPY:30},gr=7,Yt=256,Ai=Sn/((1-Sn)*Sr),xl=Array.from({length:Yt+1},(l,e)=>e===Yt?vs:gs(Ai*e/Yt)),ln=`
const THIN_M: f32 = ${w(os)};
const THICK_M: f32 = ${w(us)};
const GONE_M: f32 = ${w(fs)};
const FREEZE_M: f32 = ${w(ds)};
const SPLIT_M: f32 = ${w(bs)};
const SPAWN_M: f32 = ${w(ps)};
const SPAWN_N: u32 = ${as}u;
const T_MELT_M: f32 = ${w(ms)};
const M_S_M: f32 = ${w(Sr)};
const MLT_HEAD: u32 = ${pe}u;
const MLT_BODY: u32 = ${me}u;
const MLT_PEND: u32 = ${Ae.PEND}u;
const MLT_CAPC: u32 = ${Ae.CAPC}u;
const MLT_CAPX: u32 = ${Ae.CAPX}u;
const MLT_CAPY: u32 = ${Ae.CAPY}u;
const PEND_W: u32 = ${gr}u;
const TF_N: u32 = ${Yt}u;
const TF_MMAX: f32 = ${w(Ai)};
const TF_TAB = array<f32, ${Yt+1}>(${xl.map(w).join(", ")});
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
`,cn=`
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
`,wl=`
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
`,On=128,En="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Rn=`
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
`,Pl=[{name:"mSums",wg:On,bind:"P:u bod:r cf:w at:a parts:r ccount:r cstart:r bsum:r",code:`${fe}
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
${En} {
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
}`},{name:"mApply",wg:On,bind:"P:u glob:r cnt:a cf:r cu:r at:a bod:r bgeo:r parts:w",code:`${Q}
${Ue}
${ln}
${cn}
${Rn}
${En} {
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
}`},{name:"mSpawn",wg:64,bind:"P:u glob:r cnt:a bod:r bgeo:r bmelt:w cu:r parts:w",code:`${Q}
${Ue}
${ln}
${cn}
${Rn}
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
}`}],Vt={RESTF:0,RESTK:1,FSUM:2,KSUM:3,M9:4},an=16,mt=128,Ci=48,hr=11,_r=4,xr=_r+hr*mt,Fl=xr+Ci*mt,yl=8,$t={friction:.5,bounce:.1};function wr(l){return!l.gone&&l.ncell>0&&l.nr===1&&_n(l.mat)>0}function on(l){if(l.bodies.anyFree||l.bodies.list.some(e=>!e.gone&&_n(e.mat)>0))return!0;for(const e of l.melt.water.pending.values())if(e.m>0)return!0;return!1}function Nn(l){if(!wr(l)){let e=0,t=0;for(let n=0;n<l.nr;n+=1)e+=l.xs[n].length,t+=l.ys[n].length;return{cells:l.ncell,xs:e,ys:t}}return{cells:(l.ni[0]+2)*(l.nj[0]+2),xs:l.ni[0]+3,ys:l.nj[0]+3}}function kl(l){const e=new Float64Array(4);return l.worldBox(l.x,l.y,l.a,e),[e[0],e[1],e[2],e[3]]}class Pr{constructor(e,t){o(this,"bod");o(this,"bgeo");o(this,"bcell");o(this,"bcon");o(this,"bat");o(this,"bread");o(this,"bmelt");o(this,"capBodies");o(this,"capCells");o(this,"capGeo");o(this,"capMelt");o(this,"nbody",0);o(this,"ncell",0);o(this,"nrect",0);o(this,"layers",2);o(this,"probed",[]);o(this,"melting",!1);o(this,"ctx");o(this,"own",[]);this.ctx=e;const n=Pr.need(t);this.capBodies=Math.max(4,n.bodies+4),this.capCells=Math.max(16,Math.ceil(n.cells*1.25)+64),this.capGeo=Math.max(64,Math.ceil(n.geo*1.25)+256),this.capMelt=Math.max(64,pe+me*this.capBodies+Math.ceil(n.scratch*1.25)+64);const i=(r,s)=>{const c=e.buffer(r,4*Math.max(4,s));return this.own.push(c),c};this.bod=i("bod",ft*this.capBodies),this.bgeo=i("bgeo",this.capGeo),this.bcell=i("bcell",xe*this.capCells),this.bcon=i("bcon",Fl),this.bat=i("bat",an*this.capBodies),this.bread=i("bread",Et*this.capBodies),this.bmelt=i("bmelt",this.capMelt)}static need(e){if(!on(e))return{bodies:0,cells:0,geo:0,scratch:0};let t=0,n=ct,i=0;for(const r of e.bodies.list){if(r.gone)continue;const s=Nn(r);t+=s.cells,n+=r.nr*zt+ki*r.nseg+s.xs+s.ys,wr(r)&&(i=Math.max(i,3*s.cells+s.xs+s.ys))}return n+=Zr*(4+e.grid.n/2),{bodies:e.bodies.list.length,cells:t,geo:n,scratch:i}}fits(e){const t=Pr.need(e);return t.bodies<=this.capBodies&&t.cells<=this.capCells&&t.geo<=this.capGeo&&pe+me*t.bodies+t.scratch<=this.capMelt}destroy(){this.ctx.release(this.own),this.own.length=0}upload(e){const t=this.ctx.device.queue;if(this.nbody=0,this.ncell=0,this.nrect=0,this.probed=[],!on(e))return;const n=e.bodies.list,i=e.bodies.motion,r=n.length,s=new Float32Array(ft*r),c=[],f=[],u=[],d=[];let m=0,_=0,L=0,v=0;const A=[],G=new Float32Array(pe+me*r);G[0]=pe+me*r,this.melting=!1;let C=0;for(const g of n)!g.gone&&g.ncell>0&&(C+=g.nr);let h=ct+zt*C;n.forEach((g,P)=>{const k=ft*P,E=g.gone||g.ncell===0,D=E?[1e9,1e9,-1e9,-1e9]:kl(g),U=wr(g),V=Nn(g);for(let R=0;R<4;R+=1){const I=e.melt.water.pending.get(4*P+R);I===void 0||!(I.m>0)||(G.set([I.m,I.H,I.s,I.x,I.y,I.nx,I.ny],pe+me*P+Ae.PEND+gr*R),this.melting=!0)}U&&(this.melting=!0,G[pe+me*P+Ae.CAPC]=V.cells,G[pe+me*P+Ae.CAPX]=V.xs,G[pe+me*P+Ae.CAPY]=V.ys);const y=(R,I)=>{s[k+R]=I};y(B.X,g.x),y(B.Y,g.y),y(B.A,g.a),y(B.VX,g.vx),y(B.VY,g.vy),y(B.W,g.w),y(B.UX,g.ux),y(B.UY,g.uy),y(B.UW,g.uw),y(B.M,g.m),y(B.I,g.I),y(B.RMAX,g.rmax),y(B.HULLA,g.hullA),y(B.HULLJ,g.hullJ),y(B.PINNED,g.pinned?1:0),y(B.ASLEEP,g.asleep?1:0),y(B.GONE,E?1:0),y(B.REST,g.rest),y(B.RX,g.rx),y(B.RY,g.ry),y(B.RA,g.ra);for(let R=0;R<3;R+=1)y(B.PREV+R,i.prev[3*P+R]??0),y(B.PRED+R,i.pred[3*P+R]??0),y(B.PNOW+R,i.predNow[3*P+R]??0),y(B.POLD+R,i.predOld[3*P+R]??0),y(B.VPRE+R,i.vPre[3*P+R]??0);for(let R=0;R<6;R+=1)y(B.MA6+R,g.ma6[R]);y(B.MAOK,g.maOk?1:0),y(B.MA,g.ma),y(B.IA,g.Ia),y(B.MAT,g.mat),y(B.HEATER,g.heater),y(B.NR,E?0:g.nr),y(B.RO,m),y(B.NCELL,E?0:g.ncell),y(B.KO,_),y(B.NSEG,E?0:g.nseg),y(B.SO,L),y(B.BX0,D[0]),y(B.BY0,D[1]),y(B.BX1,D[2]),y(B.BY1,D[3]),y(B.OX0,D[0]),y(B.OY0,D[1]),y(B.OX1,D[2]),y(B.OY1,D[3]),y(B.TOUCH,e.bodies.contacts.touches(g)?1:0),y(B.AGAIN,E?0:1),y(B.COS,Math.cos(g.a)),y(B.SIN,Math.sin(g.a)),y(B.PROBE,0),y(B.KEY,g.key);let X=0;for(let R=0;R<g.ncell;R+=1)X+=g.cellVolume(R);if(y(B.VOL,X),y(B.E0,Pi(g.mat)),y(B.PUSH,0),y(B.MELT,U?1:0),A.push(_),!E){!g.pinned&&!g.asleep&&this.probed.length<yl&&(this.probed.push(P),y(B.PROBE,1));for(let R=0;R<g.nr;R+=1){const[I,ve,W,Y]=g.bounds(R);v=Math.max(v,Math.min(W-I,Y-ve));const Ze=h;for(const Z of g.xs[R])f.push(Z);const Ve=U?V.xs:g.xs[R].length;for(let Z=g.xs[R].length;Z<Ve;Z+=1)f.push(0);h+=Ve;const gt=h;for(const Z of g.ys[R])f.push(Z);const Je=U?V.ys:g.ys[R].length;for(let Z=g.ys[R].length;Z<Je;Z+=1)f.push(0);h+=Je,c.push(I,ve,W,Y,g.ni[R],g.nj[R],Ze,gt,_+g.off[R],P,0,0);for(let Z=0;Z<g.ni[R]*g.nj[R];Z+=1)d.push(m+R)}for(let R=g.ncell;R<V.cells;R+=1)d.push(m);for(let R=0;R<g.nseg;R+=1)u.push(m+g.segR[R],g.segS[R],g.segT0[R],g.segT1[R],P,0,0,0);m+=g.nr,_+=V.cells,L+=g.nseg}});const b=h,O=b+u.length,q=Sl(e),F=new Float32Array(Math.max(ct,O+q.length));F[lt.SEGS]=b,F[lt.PARTS]=O,F[lt.NPARTS]=q.length/Zr,F[lt.NRECT]=m,F[lt.NCELL]=_,F[lt.NBODY]=r,F.set(c,ct),F.set(f,ct+zt*C),F.set(u,b),F.set(q,O);const p=new Float32Array(xe*Math.max(1,_));for(let g=0;g<_;g+=1)p[xe*g+3]=d[g];n.forEach((g,P)=>{if(g.gone||g.ncell===0)return;const k=A[P];for(let E=0;E<g.ncell;E+=1)p[xe*(k+E)]=g.E[E],p[xe*(k+E)+1]=g.film[E],p[xe*(k+E)+2]=g.crust[E]}),t.writeBuffer(this.bod,0,s),t.writeBuffer(this.bgeo,0,F),t.writeBuffer(this.bcell,0,p),t.writeBuffer(this.bcon,0,this.warmTable(e)),t.writeBuffer(this.bat,0,new Uint32Array(an*this.capBodies)),t.writeBuffer(this.bmelt,0,G),this.nbody=r,this.ncell=_,this.nrect=m;const M=Math.min(64,Math.ceil(v/e.grid.dx)+3);this.layers=M+M%2}warmTable(e){const t=e.bodies.contacts,n=new Uint32Array(xr),i=new Float32Array(n.buffer),r=Math.min(mt,t.warmCount);n[0]=r;for(let s=0;s<r;s+=1){const c=t.warmKey[s],f=Math.floor(c/1e6),u=_r+hr*s;n[u]=f,n[u+1]=Math.round(c-f*1e6);const d=9*s;n[u+2]=t.warmData[d];for(let m=0;m<2;m+=1)n[u+3+4*m]=Math.max(0,Math.round(t.warmData[d+1+4*m]))>>>0,i[u+4+4*m]=t.warmData[d+2+4*m],i[u+5+4*m]=t.warmData[d+3+4*m],n[u+6+4*m]=t.warmData[d+4+4*m]===1?1:0}return n}async download(e,t){if(this.nbody===0)return;const[n,i,r,s,c]=await t([{buf:this.bod,offset:0,size:4*ft*this.nbody},{buf:this.bcell,offset:0,size:4*xe*Math.max(1,this.ncell)},{buf:this.bcon,offset:0,size:4*xr},{buf:this.bgeo,offset:0,size:4*this.capGeo},{buf:this.bmelt,offset:0,size:4*(pe+me*this.nbody)}]),f=new Float32Array(n),u=new Float32Array(i),d=new Float32Array(s),m=new Float32Array(c),_=e.bodies.list,L=e.bodies.motion,v=e.melt.water.pending;_.forEach((b,O)=>{if(O>=this.nbody)return;const q=ft*O,F=k=>f[q+k];for(let k=0;k<4;k+=1){const E=pe+me*O+Ae.PEND+gr*k;m[E]>0?v.set(4*O+k,{m:m[E],H:m[E+1],s:m[E+2],x:m[E+3],y:m[E+4],nx:m[E+5],ny:m[E+6]}):v.delete(4*O+k)}if(b.gone||b.ncell===0)return;const M=F(B.MELT)!==0&&F(B.GONE)===0;if(M){const k=ct+zt*F(B.RO),E=d[k+Kt.XO],D=d[k+Kt.YO];b.setRects([Float64Array.from(d.subarray(E,E+d[k+Kt.NI]+1))],[Float64Array.from(d.subarray(D,D+d[k+Kt.NJ]+1))])}const g=F(B.KO),P=F(B.NCELL);if(P>0&&b.ncell===P)for(let k=0;k<P;k+=1)b.E[k]=u[xe*(g+k)],b.film[k]=u[xe*(g+k)+1],b.crust[k]=u[xe*(g+k)+2];b.x=F(B.X),b.y=F(B.Y),b.a=F(B.A),b.vx=F(B.VX),b.vy=F(B.VY),b.w=F(B.W),b.ux=F(B.UX),b.uy=F(B.UY),b.uw=F(B.UW),b.asleep=F(B.ASLEEP)!==0,b.rest=F(B.REST),b.rx=F(B.RX),b.ry=F(B.RY),b.ra=F(B.RA);for(let k=0;k<3;k+=1)L.prev[3*O+k]=F(B.PREV+k),L.pred[3*O+k]=F(B.PRED+k),L.predNow[3*O+k]=F(B.PNOW+k),L.predOld[3*O+k]=F(B.POLD+k),L.vPre[3*O+k]=F(B.VPRE+k);for(let k=0;k<6;k+=1)b.ma6[k]=F(B.MA6+k);b.maOk=F(B.MAOK)!==0,b.ma=F(B.MA),b.Ia=F(B.IA),M&&b.derive(),F(B.GONE)!==0&&(e.bodies.cover.release(b),b.gone=!0,b.ncell=0)});const A=new Uint32Array(r),G=new Float32Array(r),C=e.bodies.contacts,h=Math.min(mt,A[0]);C.warmKey.length<h&&(C.warmKey=new Float64Array(2*h+8),C.warmData=new Float64Array(9*(2*h+8)));for(let b=0;b<h;b+=1){const O=_r+hr*b;C.warmKey[b]=A[O]*1e6+A[O+1];const q=9*b;C.warmData[q]=A[O+2];for(let F=0;F<2;F+=1)C.warmData[q+1+4*F]=A[O+3+4*F],C.warmData[q+2+4*F]=G[O+4+4*F],C.warmData[q+3+4*F]=G[O+5+4*F],C.warmData[q+4+4*F]=A[O+6+4*F]}C.warmCount=h,C.invalidate()}parse(e,t,n){const i=new Float32Array(e,t,Et*n),r=[];for(let s=0;s<n;s+=1){const c=Et*s,f=i[c+K.STATE];r.push({x:i[c+K.X],y:i[c+K.Y],a:i[c+K.A],vx:i[c+K.VX],vy:i[c+K.VY],w:i[c+K.W],pinned:(f&1)!==0,asleep:(f&2)!==0,gone:(f&4)!==0,m:i[c+K.M],T:i[c+K.T],E:i[c+K.E],film:i[c+K.FILM],crust:i[c+K.CRUST],fx:i[c+K.FX],fy:i[c+K.FY],tq:i[c+K.TQ],pm:i[c+K.PM],pH:i[c+K.PH],ps:i[c+K.PS],rect:[i[c+K.RX0],i[c+K.RY0],i[c+K.RX1],i[c+K.RY1]]})}return r}}function Sl(l){const e=l.grid,t=[],n=e.w,i=e.h,r=(_,L,v,A,G,C)=>{t.push(_,L,v,A,G,C.friction,C.bounce,0)};e.openL||r(-1,-1,0,i+1,1,$t),e.openR||r(n,-1,n+1,i+1,2,$t),e.openB||r(-1,-1,n+1,0,3,$t),e.openT||r(-1,i,n+1,i+1,4,$t);const{nx:s,ny:c,dx:f}=e,u=_=>{const L=Fe[_-1];return L!==void 0?{friction:L.friction,bounce:L.bounce}:$t};let d=new Map,m=10;for(let _=0;_<=c;_+=1){const L=new Map;if(_<c){let v=0;for(;v<s;){const A=v+_*s;if(e.solid[A]===0||e.owner[A]!==0){v+=1;continue}const G=e.solid[A];let C=v;for(;C+1<s&&e.solid[C+1+_*s]===G&&e.owner[C+1+_*s]===0;)C+=1;const h=G<<24|v<<12|C;L.set(h,d.has(h)?d.get(h):_),v=C+1}}for(const[v,A]of d)L.get(v)!==A&&r((v>>12&4095)*f,A*f,((v&4095)+1)*f,_*f,m++,u(v>>>24));d=L}return t}function Bl(l,e){let t=0;return l.bodies.list.forEach((n,i)=>{const r=e[i];r!==void 0&&!r.gone&&_n(n.mat)>0&&(t+=r.m)}),t}const qt=800,Tl=24,Mn=6,re=4,Nt=16,se=256,Dn=`struct Levels { lv: array<Level, ${Nt}>, lt: u32, depth: u32, q0: u32, q1: u32 }`,Zt=`
fn interior(L: Level, t: u32) -> u32 { return t % L.nx + 1u + (t / L.nx + 1u) * L.stride; }
fn applyA(L: Level, s: u32, xo: u32) -> f32 {
  let st = L.stride;
  return mgF[L.diag + s] * mgF[xo + s] - mgF[L.ax + s] * mgF[xo + s + 1u] - mgF[L.ax + s - 1u] * mgF[xo + s - 1u]
    - mgF[L.ay + s] * mgF[xo + s + st] - mgF[L.ay + s - st] * mgF[xo + s - st];
}
`,dr=`${Zt}
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
`,Ie=`
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
`,tt=`
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
`,In=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,jn=`
fn foldRow(row: u32, lid: u32) -> f32 {
  let n = pw();
  var acc = 0.0;
  for (var w = lid; w < n; w += WG) { acc += cgp[row * n + w]; }
  return reduce2(acc, 0.0, lid).x;
}
fn putF(i: u32, v: f32) { cgs[i] = bitcast<u32>(v); }
`,z="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",$e=`const V_XS: u32 = 0u; const V_BS: u32 = 1u; const V_P0: u32 = 2u; const V_P1: u32 = 3u; const V_Q: u32 = 4u;
fn vi(v: u32, s: u32) -> u32 { return v * P.n0 + s; }`,qi=6,Ft=`const CS_B: u32 = 0u; const CS_N: u32 = 1u; const CS_ANCH: u32 = 2u; const CS_X: u32 = 3u; const CS_Z0: u32 = 4u;
fn free(r: u32) -> bool { return r != NONE && csum_get(CS_ANCH, r) == 0.0 && csum_get(CS_N, r) > 0.0; }`,Gr=`
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
`,Ur="fn csum_get(part: u32, r: u32) -> f32 { return csum[part * P.n0 + r]; }",Al=[{name:"cgPrep1",wg:se,bind:"P:u L:u<Level> SV:u<SolveCfg> mgF:w mgU:r cgs:w<u32>",code:`${Zt}
${z} {
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
}`},{name:"cgPrep2",wg:se,bind:"P:u L:u<Level> mgF:w mgU:w cgv:w lab:a csum:a",code:`${$e}
${dr}
${z} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = interior(L, t);
  diagonalAt(L, t);
  for (var k = 0u; k < ${qi}u; k++) { atomicStore(&csum[k * P.n0 + s], 0u); }
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
}`},{name:"cclMerge",wg:se,bind:"P:u L:u<Level> mgF:r mgU:r lab:a",code:`fn find(x: u32) -> u32 {
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
${z} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  if (mgF[L.ax + s] > 0.0) { unite(s, s + 1u); }
  if (mgF[L.ay + s] > 0.0) { unite(s, s + L.stride); }
}`},{name:"cclFinal",wg:se,bind:"P:u L:u<Level> mgF:r mgU:r cgv:r lab:a csum:a",code:`${$e}
${Gr}
${Ft}
${z} {
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
}`},{name:"cclProject",wg:se,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${$e}
${Ur}
${Ft}
${z} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_BS, s)] -= csum_get(CS_B, r) / csum_get(CS_N, r);
}`},{name:"cgInitMG",wg:se,bind:"P:u L:u<Level> mgF:w mgU:r cgv:r cgp:w",code:`${$e}
${Zt}
${tt}
${z} {
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
}`},{name:"cgFoldInitMG",wg:se,bind:"P:u L:u<Level> cgs:w<u32> cgp:r",code:`${tt}
${jn}
${z} {
  let lid = lid3.x;
  let rr = foldRow(ROW_RR, lid);
  let bb = foldRow(ROW_BB, lid);
  if (lid == 0u) {
    putF(S_RR1, rr);
    putF(S_BB, bb);
  }
}`},{name:"cgA",wg:se,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgv:w cgs:w<u32> cgp:w",code:`${$e}
${Ie}
${tt}
${In}
${z} {
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
}`},{name:"cgB",wg:se,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgv:w cgs:w<u32> cgp:w csum:a",code:`${$e}
${Ie}
${tt}
${In}
var<workgroup> wpq: f32;
${z} {
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
}`},{name:"cgFoldRR",wg:se,bind:"P:u L:u<Level> IT:u<Iter> cgs:w<u32> cgp:r",code:`${Ie}
${tt}
${jn}
${z} {
  let k = IT.k;
  let lid = lid3.x;
  if (convergedWG(lid, cgs[S_CURK] & 1u)) { return; }
  let rr = foldRow(ROW_RR, lid);
  if (lid == 0u) {
    putF(S_RR0 + (k & 1u), rr);
    cgs[S_CURK] = k;
    cgs[S_ITER] = k + 1u;
  }
}`},{name:"cgRZ",wg:se,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> cgp:w",code:`${Ie}
${tt}
${z} {
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
}`},{name:"cgZSum",wg:se,bind:"P:u L:u<Level> IT:u<Iter> mgF:r mgU:r cgs:r<u32> lab:r<u32> csum:a",code:`${Ie}
${Gr}
${Ft}
${z} {
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
}`},{name:"cgZSub",wg:se,bind:"P:u L:u<Level> IT:u<Iter> mgF:w mgU:r cgs:r<u32> lab:r<u32> csum:r<f32> cgp:w",code:`${Ie}
${Ur}
${Ft}
${tt}
${z} {
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
}`},{name:"cgEnd1",wg:se,bind:"P:u L:u<Level> SV:u<SolveCfg> mgU:r cgv:w cgs:r<u32> lab:r<u32> csum:a cnt:a",code:`${$e}
${Gr}
${Ft}
fn cgF(i: u32) -> f32 { return bitcast<f32>(cgs[i]); }
${z} {
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
}`},{name:"cgEnd2",wg:se,bind:"P:u L:u<Level> mgU:r cgv:w lab:r<u32> csum:r<f32>",code:`${$e}
${Ur}
${Ft}
${z} {
  let t = gid.x;
  if (t >= L.nx * L.ny) { return; }
  let s = t % L.nx + 1u + (t / L.nx + 1u) * L.stride;
  if (mgU[L.act + s] == 0u) { return; }
  let r = lab[s];
  if (!free(r)) { return; }
  cgv[vi(V_XS, s)] -= csum_get(CS_X, r) / csum_get(CS_N, r);
}`}],Cl=["ax","ay","dH","dDx","dDy","diag","inv","x","xp","b","gx","gy","gDx","gDy","eDx","eDy","area","ox","oy"];function ql(l,e){const t=[];let n=0,i=0,r=l,s=e,c=1,f=0;for(;;){const d=r+2,m=(r+2)*(s+2),_={};for(const A of Cl)_[A]=n,n+=m;const L=i;i+=m;let v=0;if(_.pW=0,t.length>0&&(_.pW=n,n+=4*f,v=i,i+=4*f),t.push({nx:r,ny:s,stride:d,size:m,h:c,f:_,act:L,pIdx:v}),r*s<=Tl||r<=2&&s<=2||t.length>=Nt)break;f=m,r=Math.ceil(r/2),s=Math.ceil(s/2),c*=2}let u=t.length-1;for(let d=0;d<t.length;d+=1){let m=0;for(let _=d;_<t.length;_+=1)m+=t[_].size;if(m<=qt){u=d;break}}return{levels:t,fSize:n,uSize:i,lt:u}}function ar(l,e,t,n){if(l===null)return;const i=[l.nx,l.ny,l.stride,l.size,l.f.ax,l.f.ay,l.f.dH,l.f.dDx,l.f.dDy,l.f.diag,l.f.inv,l.f.x,l.f.b,l.h,l.f.gx,l.f.gy,l.f.gDx,l.f.gDy,l.f.eDx,l.f.eDy,l.f.area,l.f.ox,l.f.oy,l.act,l.pIdx,l.f.pW,e,l.f.xp,0,0,0,0];t.set(i,n)}const Li={tol:1e-5,it:x.IT_L,cap:x.CAP_L,res:x.RES_L},Oi={tol:1e-5,it:x.IT_G,cap:x.CAP_G,res:x.RES_G},Ei={tol:1e-5,it:x.IT_H,cap:x.CAP_H,res:x.RES_H},Ri={tol:1e-5,it:x.IT_D,cap:x.CAP_D,res:x.RES_H},Ni={tol:1e-4,it:x.IT_P,cap:x.CAP_P,res:x.RES_P},yt=200,he=256;class Ll{constructor(e,t,n){o(this,"ctx");o(this,"plan");o(this,"b");o(this,"l0");o(this,"lp");o(this,"lv");o(this,"it");o(this,"cfg");o(this,"kinds",[]);o(this,"groups",new Map);o(this,"n0cells");this.ctx=e,this.plan=t,this.b=n;const i=t.levels;this.n0cells=i[0].nx*i[0].ny;const r=new Uint32Array(32);ar(i[0],0,r,0),this.l0=e.uniform("l0",r.buffer);const s=new Uint32Array(he/4*i.length);for(let u=0;u<i.length;u+=1)ar(u>0?i[u-1]:null,u-1,s,he/4*u),ar(i[u],u,s,he/4*u+32);this.lp=e.uniform("lp",s.buffer);const c=new Uint32Array(32*Nt+4);for(let u=0;u<i.length;u+=1)ar(i[u],u,c,32*u);c[32*Nt]=t.lt,c[32*Nt+1]=i.length,this.lv=e.uniform("lv",c.buffer);const f=new Uint32Array(he/4*(yt+1));for(let u=0;u<yt;u+=1)f[he/4*u]=u;f[he/4*yt]=4294967295,this.it=e.uniform("iter",f.buffer),this.cfg=e.uniform("solvecfg",new ArrayBuffer(he*8));for(const u of[Li,Oi,Ei,Ri,Ni])this.setKind(u)}get levels(){return this.plan.levels.length}get level0(){return this.l0}destroy(){this.ctx.release([this.l0,this.lp,this.lv,this.it,this.cfg]),this.groups.clear()}setKind(e){let t=this.kinds.indexOf(e);if(t>=0)return t;t=this.kinds.length,this.kinds.push(e);const n=new ArrayBuffer(16);return new Float32Array(n,0,1)[0]=e.tol*e.tol,new Uint32Array(n,4,3).set([e.it,e.cap,e.res]),this.ctx.device.queue.writeBuffer(this.cfg,he*t,n),t}setTolerance(e,t){const n=this.setKind(e);this.ctx.device.queue.writeBuffer(this.cfg,he*n,new Float32Array([t*t]))}range(e,t,n){return{buffer:e,offset:he*t,size:n}}group(e,t,n){const i=`${e}|${t}`;let r=this.groups.get(i);if(r===void 0){const s=this.b;r=this.ctx.bind(e,{P:s.params,mgF:s.mgF,mgU:s.mgU,cgv:s.cgv,cgs:s.cgs,lab:s.lab,cfl:s.cfl,csum:s.csum,cnt:s.cnt,cgp:s.cgp,L:this.l0,LV:this.lv,...n}),this.groups.set(i,r)}return r}run(e,t,n,i="",r={}){this.ctx.dispatch(e,t,this.group(t,i,r),n)}one(e,t,n="",i={}){this.ctx.dispatchOne(e,t,this.group(t,n,i))}lpRes(e){return this.range(this.lp,e,he)}itRes(e){return this.range(this.it,e,16)}prepare(e,t,n,i=!1){const r=this.setKind(t),s={SV:this.range(this.cfg,r,16)},c=this.n0cells;this.run(e,"cgPrep1",c,`c${r}`,s),this.run(e,"cgPrep2",c),n&&(this.run(e,"cclMerge",c),this.run(e,"cclFinal",c),this.run(e,"cclProject",c)),i||this.coarsen(e),this.run(e,"cgInitMG",c),this.ctx.dispatchOne(e,"cgFoldInitMG",this.group("cgFoldInitMG","",{}))}coarsen(e){const{levels:t,lt:n}=this.plan;for(let i=1;i<t.length&&i<=n;i+=1){const r=t[i],s=t[i-1],c={LP:this.lpRes(i)};this.run(e,"mgC1",r.nx*r.ny,`l${i}`,c),this.run(e,"mgC2",r.nx*r.ny,`l${i}`,c),this.run(e,"mgC3",r.nx*r.ny,`l${i}`,c),this.run(e,"mgC4",s.nx*s.ny,`l${i}`,c)}n+1<t.length&&this.ctx.dispatchOne(e,"mgTailBuild",this.group("mgTailBuild","",{}))}vcycle(e){const{levels:t,lt:n}=this.plan,i=s=>256*Math.ceil(s.nx/16)*Math.ceil(s.ny/16),r=s=>256*Math.ceil(s.nx/12)*Math.ceil(s.ny/12);for(let s=0;s<n;s+=1)this.run(e,"mgPreR",r(t[s]),`l${s+1}`,{LP:this.lpRes(s+1)});this.ctx.dispatchOne(e,"mgTail",this.group("mgTail","",{}));for(let s=n-1;s>=0;s-=1)this.run(e,"mgPost",i(t[s]),`l${s+1}`,{LP:this.lpRes(s+1)})}encodeMG(e,t,n,i=!0,r=i,s=!1){const c=this.n0cells;this.prepare(e,t,i,s);const f=(d,m)=>{const _={IT:this.itRes(d)};r?(this.run(e,"cgZSum",c,m,_),this.run(e,"cgZSub",c,m,_)):this.run(e,"cgRZ",c,m,_)};this.vcycle(e),f(yt,`k${yt}`);const u=Math.min(yt,Math.max(1,n));for(let d=0;d<u;d+=1){const m={IT:this.itRes(d)};this.run(e,"cgA",c,`k${d}`,m),this.run(e,"cgB",c,`k${d}`,m),this.one(e,"cgFoldRR",`k${d}`,m),this.vcycle(e),f(d,`k${d}`)}this.finish(e,t,i)}finish(e,t,n){const i=this.setKind(t);this.run(e,"cgEnd1",this.n0cells,`c${i}`,{SV:this.range(this.cfg,i,16)}),n&&this.run(e,"cgEnd2",this.n0cells)}}const Vr=256,Ol=3*8;class El{constructor(e,t){o(this,"pb");o(this,"itP",12);this.state=e,this.solver=t,this.pb=e.ctx.buffer("probesel",Vr*Ol,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.writeSel()}writeSel(){const e=this.state.ctx.device.queue,t=this.state.bodies,n=t.probed;for(let i=0;i<Math.min(8,n.length);i+=1)for(let r=0;r<3;r+=1)e.writeBuffer(this.pb,Vr*(3*i+r),new Uint32Array([n[i],r,0,0]));for(let i=0;i<t.nbody;i+=1)e.writeBuffer(t.bod,4*(ft*i+B.PROBE),new Float32Array([n.includes(i)?1:0]))}select(e){const t=[];e.forEach((i,r)=>{!i.pinned&&!i.asleep&&!i.gone&&t.length<8&&t.push(r)});const n=this.state.bodies.probed;t.length===n.length&&t.every((i,r)=>n[r]===i)||(this.state.bodies.probed=t,this.writeSel())}destroy(){this.state.ctx.release([this.pb])}prepare(e,t){t.one(e,"bPrep"),t.parts(e,"bPush"),t.bubs(e,"bPushB"),t.cells(e,"bCover"),t.cells(e,"bClose1"),t.cells(e,"bClose2"),t.cells(e,"bFlip"),t.cells(e,"bApply"),t.cells(e,"gasApply"),t.cells(e,"bStatic"),t.one(e,"bPrepEnd")}probe(e,t){const n=this.state.bodies.probed;if(n.length===0)return;const i=this.state.d.n,r=this.solver.level0;for(let s=0;s<Math.min(8,n.length);s+=1)for(let c=0;c<3;c+=1){const f=3*s+c,u={PB:{buffer:this.pb,offset:Vr*f,size:16},L:r};t.run(e,"bProbeRhs",i,`pr${f}`,u),this.solver.encodeMG(e,Ni,this.itP,!0,!1,!0),t.run(e,"bProbeDot",i,`pd${f}`,u)}t.one(e,"bProbeFin")}finish(e,t){const n=this.state.bodies;t.cells(e,"bCollectPrep"),t.run(e,"bCollect",Math.max(1,n.ncell),"bCollect",{}),t.run(e,"bCollectRest",Math.max(1,n.ncell),"bCollectRest",{}),t.cells(e,"bCollectEnd"),n.melting&&(t.cells(e,"mSums","A"),t.one(e,"mMelt"),t.parts(e,"mApply"),t.run(e,"mSpawn",4*Math.max(1,n.nbody),"mSpawn",{})),t.cells(e,"bExtInit","A");for(let i=0;i<n.layers;i+=2)t.cells(e,"bExtA"),t.cells(e,"bExtB");t.run(e,"bForce",64*Math.max(1,n.nbody),"bForce",{}),t.one(e,"bDyn")}measure(e,t){t.run(e,"bMeas",64*Math.max(1,this.state.bodies.nbody),"bMeas",{})}adapt(e,t){if(e===0&&t===0)return;const n=t>0?Math.ceil(this.itP*1.5)+2:e+1;this.itP=Math.min(40,Math.max(4,this.itP>n?Math.max(n,this.itP-2):n))}}const ye=Ge.solutes[0],Qt=298.15,Oe=l=>l.map(w).join(", "),tr=14,Ye=ye.cp.range.lo,Qe=ye.cp.range.hi,[Mi,Rl,Nl,Ml,Dl,Il]=ye.cp.laliberte,jl=l=>Math.exp(Rl*(l-de)+Nl*Math.exp(.01*(l-de))),Fr=.5*(Qe-Ye),vt=new Array(tr).fill(0);{for(let e=0;e<64;e+=1){const t=Math.PI*(e+.5)/64,n=jl(.5*(Qe+Ye)+Fr*Math.cos(t));for(let i=0;i<tr;i+=1)vt[i]+=2/64*n*Math.cos(i*t)}vt[0]/=2}const un=l=>l<tr?vt[l]:0,jt=new Array(tr+1).fill(0);jt[1]=vt[0]-un(2)/2;for(let l=2;l<=tr;l+=1)jt[l]=(un(l-1)-un(l+1))/(2*l);const Jt=(l,e)=>{let t=0,n=0;for(let i=l.length-1;i>=1;i-=1){const r=2*e*t-n+l[i];n=t,t=r}return e*t-n+l[0]},yr=Jt(vt,-1),Di=Jt(vt,1),fn=Jt(jt,-1),Ii=l=>{if(l<=Ye)return yr*(l-de);const e=yr*(Ye-de);return l>=Qe?e+Fr*(Jt(jt,1)-fn)+Di*(l-Qe):e+Fr*(Jt(jt,(2*l-Ye-Qe)/(Qe-Ye))-fn)},Gl=yr*(Ye-de),Ul=Ii(Qe),Vl=ye.dHsol.v/Sr+bn*(Qt-de)-1e3*Mi*Ii(Qt);function Gn(l,e){const t=[`fn ${l}(x: f32) -> f32 {`,"  var b1 = 0.0;","  var b2 = 0.0;","  var t = 0.0;"];for(let n=e.length-1;n>=1;n-=1)t.push(`  t = 2.0 * x * b1 - b2 + ${w(e[n])}; b2 = b1; b1 = t;`);return t.push(`  return x * b1 - b2 + ${w(e[0])};`,"}"),t.join(`
`)}const Ht=ye.pitzer,or=ye.pitzerCold,$l=Math.sqrt(2*Math.PI*xs),Hl=Bn*Bn/(4*Math.PI*ws*Ps),kt=ye.solubility.table,Wt=ye.density.laliberte,Wl=`
const S_TR: f32 = ${w(Qt)};
const S_MS: f32 = ${w(Sr)};
const S_MW: f32 = ${w(hs)};
const S_NU: f32 = ${w(ye.ions.v)};
const PZ_B: f32 = ${w(Ht.b.v)};
const PZ_ALPHA: f32 = ${w(Ht.alpha.v)};
const PZ_COLD: f32 = ${w(or.below.v)};
const PZ_B0 = array<f32, 6>(${Oe(Ht.b0.a)});
const PZ_B1 = array<f32, 6>(${Oe(Ht.b1.a)});
const PZ_C = array<f32, 6>(${Oe(Ht.c.a)});
const PZC_B0 = array<f32, 6>(${Oe(or.b0.a)});
const PZC_B1 = array<f32, 6>(${Oe(or.b1.a)});
const PZC_C = array<f32, 6>(${Oe(or.c.a)});
const S_EPS = array<f32, 4>(${Oe(ye.dielectric.c)});
const S_KN: f32 = ${w($l)};
const S_KLB: f32 = ${w(Hl)};
const SOL_T = array<f32, ${kt.length}>(${Oe(kt.map(l=>l[0]))});
const SOL_M = array<f32, ${kt.length}>(${Oe(kt.map(l=>l[1]))});
const LD0: f32 = ${w(Wt[0])};
const LD1: f32 = ${w(Wt[1])};
const LD2: f32 = ${w(Wt[2])};
const LD3: f32 = ${w(Wt[3])};
const LD4: f32 = ${w(Wt[4])};
const LA1: f32 = ${w(Mi)};
const LA4: f32 = ${w(Ml)};
const LA5: f32 = ${w(Dl)};
const LA6: f32 = ${w(Il)};
const E_LO: f32 = ${w(Ye)};
const E_HI: f32 = ${w(Qe)};
const E_LOV: f32 = ${w(yr)};
const E_HIV: f32 = ${w(Di)};
const E_HALF: f32 = ${w(Fr)};
const E_FM1: f32 = ${w(fn)};
const E_ILO: f32 = ${w(Gl)};
const E_IHI: f32 = ${w(Ul)};
const S_QS: f32 = ${w(Vl)};
const S_DMU: f32 = ${w(ye.diffusivity.v*_s(Qt)/Qt)};

${Gn("eCh",vt)}
${Gn("iCh",jt)}
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
  for (var k = 1; k < ${kt.length}; k++) {
    if (T <= SOL_T[k]) { return SOL_M[k - 1] + (SOL_M[k] - SOL_M[k - 1]) * (T - SOL_T[k - 1]) / (SOL_T[k] - SOL_T[k - 1]); }
  }
  return SOL_M[${kt.length-1}];
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
`,ji=[],Mt=new Map;{let l=[];const e=Wl.split(`
`);for(let t=0;t<e.length;t+=1){const n=e[t];if(n.startsWith("const ")){ji.push(n),l=[];continue}if(n.startsWith("/*")){l=[n];continue}const i=/^fn (\w+)\(/.exec(n);if(i===null){n.trim()===""&&(l=[]);continue}const r=[...l,n];if(!n.trimEnd().endsWith("}"))for(;t+1<e.length&&e[t]!=="}";)t+=1,r.push(e[t]);Mt.set(i[1],r.join(`
`)),l=[]}}const Gi=l=>new RegExp(`\\b${l}\\s*\\(`),Kl=new Map([...Mt.entries()].map(([l,e])=>[l,[...Mt.keys()].filter(t=>t!==l&&Gi(t).test(e))]));function zl(l){const e=new Set,t=n=>{if(!e.has(n)){e.add(n);for(const i of Kl.get(n)??[])t(i)}};for(const n of Mt.keys())Gi(n).test(l)&&t(n);return e.size===0?"":[...ji,...[...Mt.keys()].filter(n=>e.has(n)).map(n=>Mt.get(n))].join(`
`)}class Xl{constructor(e){o(this,"name");o(this,"binds");o(this,"wg");o(this,"source");o(this,"pipeline",null);o(this,"layout",null);this.name=e.name,this.wg=e.wg??128,this.binds=Ql(e.bind),this.source=ec(e,this.binds,this.wg)}}const Yl={mgU:"u32",cu:"u32",fu:"u32",lab:"u32",cfl:"u32",ccount:"u32",cstart:"u32",bsum:"u32",pkey:"u32",pslot:"u32",pargs:"u32",parts:"Particle",parts2:"Particle",bubs:"Bubble",bubs2:"Bubble",sites:"Site",btarget:"u32"};function Ql(l){return l.trim().split(/\s+/).filter(Boolean).map(e=>{const t=/^(\w+):([urwatxs])(?:<([\w<>]+)>)?$/.exec(e);if(t===null)throw new Error(`bad binding "${e}"`);const n=t[2],i=t[3]??(n==="u"?"Params":n==="a"?"atomic<u32>":Yl[t[1]]??"f32");return{name:t[1],mode:n,type:i}})}const Zl=`
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
`,Jl=[{needs:["cf"],code:"fn cfi(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["cu"],code:"fn cui(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["at"],code:"fn ati(f: u32, c: u32) -> u32 { return f * P.n + c; }"},{needs:["ff"],code:"fn ffi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["fu"],code:"fn fui(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["af"],code:"fn afi(f: u32, k: u32) -> u32 { return f * P.nf + k; }"},{needs:["cstart","bsum"],code:"fn cellStart(c: u32) -> u32 { return cstart[c] + bsum[c >> 10u]; }"},{needs:["cnt!"],code:`var<workgroup> wcnt: u32;
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
}`}];function ec(l,e,t){const n=[wn,`const WG: u32 = ${t}u;`,Zl],i=zl(l.code);i!==""&&n.push(i);const r=new Set(e.map(s=>s.name));for(const s of e)s.mode==="a"&&r.add(`${s.name}!`);for(const s of Jl)s.needs.every(c=>r.has(c))&&n.push(s.code);return e.forEach((s,c)=>{s.mode==="u"?n.push(`@group(0) @binding(${c}) var<uniform> ${s.name}: ${s.type};`):s.mode==="t"?n.push(`@group(0) @binding(${c}) var ${s.name}: texture_storage_2d<rgba8unorm, write>;`):s.mode==="x"?n.push(`@group(0) @binding(${c}) var ${s.name}: texture_2d<f32>;`):s.mode==="s"?n.push(`@group(0) @binding(${c}) var ${s.name}: sampler;`):s.mode==="r"?n.push(`@group(0) @binding(${c}) var<storage, read> ${s.name}: array<${s.type}>;`):s.mode==="w"?n.push(`@group(0) @binding(${c}) var<storage, read_write> ${s.name}: array<${s.type}>;`):(n.push(`@group(0) @binding(${c}) var<storage, read_write> ${s.name}: array<atomic<u32>>;`),n.push(`fn addF_${s.name}(i: u32, v: f32) {
  if (v == 0.0) { return; }
  var old = atomicLoad(&${s.name}[i]);
  loop {
    let r = atomicCompareExchangeWeak(&${s.name}[i], old, bitcast<u32>(bitcast<f32>(old) + v));
    if (r.exchanged) { break; }
    old = r.old_value;
  }
}
fn getF_${s.name}(i: u32) -> f32 { return bitcast<f32>(atomicLoad(&${s.name}[i])); }
fn setF_${s.name}(i: u32, v: f32) { atomicStore(&${s.name}[i], bitcast<u32>(v)); }
fn maxU_${s.name}(i: u32, v: f32) { atomicMax(&${s.name}[i], bitcast<u32>(max(v, 0.0))); }
// Ein return hinter der Schleife: naga (Firefox) verwirft eine Funktion, die nur aus der Schleife heraus zurückgibt.
fn takeF_${s.name}(i: u32, want: f32, lim: f32) -> f32 {
  var old = atomicLoad(&${s.name}[i]);
  var got = 0.0;
  loop {
    let cur = bitcast<f32>(old);
    let t = clamp(lim - cur, 0.0, want);
    if (!(t > 0.0)) { break; }
    let r = atomicCompareExchangeWeak(&${s.name}[i], old, bitcast<u32>(cur + t));
    if (r.exchanged) { got = t; break; }
    old = r.old_value;
  }
  return got;
}`))}),n.push(l.code),n.join(`
`)}class Pn{constructor(e){o(this,"device");o(this,"kernels",new Map);o(this,"timestamps");o(this,"adapter","");o(this,"bufs",[]);o(this,"profiler",null);this.device=e,this.timestamps=e.features.has("timestamp-query")}static async create(){const e=navigator.gpu;if(e===void 0)throw new Error("WebGPU is not available");const t=await e.requestAdapter({powerPreference:"high-performance"});if(t===null)throw new Error("no WebGPU adapter");const n=[];t.features.has("timestamp-query")&&n.push("timestamp-query");const i=t.limits,r=await t.requestDevice({requiredFeatures:n,requiredLimits:{maxStorageBuffersPerShaderStage:Math.min(16,i.maxStorageBuffersPerShaderStage),maxStorageBufferBindingSize:i.maxStorageBufferBindingSize,maxBufferSize:i.maxBufferSize,maxComputeWorkgroupStorageSize:i.maxComputeWorkgroupStorageSize,maxComputeInvocationsPerWorkgroup:Math.min(1024,i.maxComputeInvocationsPerWorkgroup)}}),s=new Pn(r),c=t.info;return c!==void 0&&(s.adapter=[c.vendor,c.architecture,c.description].filter(Boolean).join(" ")),s}async compile(e){const t=[];return await Promise.all(e.map(async n=>{const i=new Xl(n);this.kernels.set(n.name,i);const r=this.device.createShaderModule({code:i.source,label:n.name}),c=(await r.getCompilationInfo()).messages.filter(u=>u.type==="error");if(c.length>0){const u=i.source.split(`
`);for(const d of c)t.push(`${n.name}:${d.lineNum}:${d.linePos} ${d.message}
    ${u[d.lineNum-1]??""}`);return}const f=this.device.createBindGroupLayout({label:n.name,entries:i.binds.map((u,d)=>u.mode==="t"?{binding:d,visibility:GPUShaderStage.COMPUTE,storageTexture:{access:"write-only",format:"rgba8unorm"}}:u.mode==="x"?{binding:d,visibility:GPUShaderStage.COMPUTE,texture:{sampleType:"float"}}:u.mode==="s"?{binding:d,visibility:GPUShaderStage.COMPUTE,sampler:{type:"filtering"}}:{binding:d,visibility:GPUShaderStage.COMPUTE,buffer:{type:u.mode==="u"?"uniform":u.mode==="r"?"read-only-storage":"storage"}})});i.layout=f;try{i.pipeline=await this.device.createComputePipelineAsync({label:n.name,layout:this.device.createPipelineLayout({bindGroupLayouts:[f]}),compute:{module:r,entryPoint:"main"}})}catch(u){t.push(`${n.name}: ${u instanceof Error?u.message:String(u)}`)}})),t}kernel(e){const t=this.kernels.get(e);if(t===void 0||t.pipeline===null)throw new Error(`kernel ${e} not compiled`);return t}bind(e,t){const n=this.kernel(e);return this.device.createBindGroup({label:e,layout:n.layout,entries:n.binds.map((i,r)=>{const s=t[i.name];if(s===void 0)throw new Error(`kernel ${e}: no resource for "${i.name}"`);return"view"in s?{binding:r,resource:s.view}:"sampler"in s?{binding:r,resource:s.sampler}:{binding:r,resource:"buffer"in s?{buffer:s.buffer,offset:s.offset,size:s.size}:{buffer:s}}})})}own(e,t){const n=this.profiler;if(n===null)return e;const i=2*n.names.length;return n.names.push(t),n.enc.beginComputePass({timestampWrites:{querySet:n.qs,beginningOfPassWriteIndex:i,endOfPassWriteIndex:i+1}})}dispatch(e,t,n,i){const r=this.kernel(t),s=this.own(e,t);s.setPipeline(r.pipeline),s.setBindGroup(0,n),s.dispatchWorkgroups(Math.max(1,Math.ceil(i/r.wg))),s!==e&&s.end()}dispatchIndirect(e,t,n,i){const r=this.kernel(t),s=this.own(e,t);s.setPipeline(r.pipeline),s.setBindGroup(0,n),s.dispatchWorkgroupsIndirect(i,0),s!==e&&s.end()}dispatchOne(e,t,n){const i=this.kernel(t),r=this.own(e,t);r.setPipeline(i.pipeline),r.setBindGroup(0,n),r.dispatchWorkgroups(1),r!==e&&r.end()}buffer(e,t,n=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC){const i=this.device.createBuffer({label:e,size:Math.max(16,Math.ceil(t/16)*16),usage:n});return this.bufs.push(i),i}uniform(e,t){const n=this.buffer(e,t.byteLength,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);return this.device.queue.writeBuffer(n,0,t),n}release(e){const t=new Set(e);for(const n of e)n.destroy();for(let n=this.bufs.length-1;n>=0;n-=1)t.has(this.bufs[n])&&this.bufs.splice(n,1)}destroy(){for(const e of this.bufs)e.destroy();this.bufs.length=0,this.device.destroy()}}const ze=128,Xe="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Un="@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",St=`const BA_STRIDE: u32 = ${an}u;
const BA_RESTF: u32 = ${Vt.RESTF}u;
const BA_RESTK: u32 = ${Vt.RESTK}u;
const BA_FSUM: u32 = ${Vt.FSUM}u;
const BA_KSUM: u32 = ${Vt.KSUM}u;
const BA_M9: u32 = ${Vt.M9}u;`,Vn=`
fn areaInC(b: u32, rq: u32, p: u32, q: u32, i: i32, j: i32) -> f32 {
  let org = vec2<f32>(f32(i) * P.dx, f32(j) * P.dx);
  let x0 = rxs(rq, p); let x1 = rxs(rq, p + 1u);
  let y0 = rys(rq, q); let y1 = rys(rq, q + 1u);
  return quadInBox(toWorldRel(b, vec2<f32>(x0, y0), org), toWorldRel(b, vec2<f32>(x1, y0), org), toWorldRel(b, vec2<f32>(x1, y1), org),
    toWorldRel(b, vec2<f32>(x0, y1), org), vec2<f32>(0.0, 0.0), vec2<f32>(P.dx, P.dx));
}
`,Ui=`
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
`;function $n(l,e,t,n,i,r,s){return{name:l,wg:ze,bind:"P:u bod:r cf:w",code:`${fe}
${Ui}
${Xe} {
  let c = gid.x;
  if (c >= P.n || !inForceBand(c)) { return; }
  let n = P.n;
  let kn = cf[${n} * n + c];
  if (kn != 0.0) { cf[${i} * n + c] = cf[${e} * n + c]; cf[${r} * n + c] = cf[${t} * n + c]; cf[${s} * n + c] = kn; return; }
  let i = ci(c);
  let j = cj(c);
  let gdx = P.gy * P.dx;
  var s = 0.0;
  var r = 0.0;
  var cnt = 0.0;
  if (i > 0 && cf[${n} * n + c - 1u] != 0.0) { s += cf[${e} * n + c - 1u]; r += cf[${t} * n + c - 1u]; cnt += 1.0; }
  if (i + 1 < i32(P.nx) && cf[${n} * n + c + 1u] != 0.0) { s += cf[${e} * n + c + 1u]; r += cf[${t} * n + c + 1u]; cnt += 1.0; }
  if (j > 0 && cf[${n} * n + c - P.nx] != 0.0) { s += cf[${e} * n + c - P.nx] - cf[${t} * n + c - P.nx] * gdx; r += cf[${t} * n + c - P.nx]; cnt += 1.0; }
  if (j + 1 < i32(P.ny) && cf[${n} * n + c + P.nx] != 0.0) { s += cf[${e} * n + c + P.nx] + cf[${t} * n + c + P.nx] * gdx; r += cf[${t} * n + c + P.nx]; cnt += 1.0; }
  if (cnt > 0.0) { cf[${i} * n + c] = s / cnt; cf[${r} * n + c] = r / cnt; cf[${s} * n + c] = 2.0; }
  else { cf[${i} * n + c] = 0.0; cf[${r} * n + c] = 0.0; cf[${s} * n + c] = 0.0; }
}`}}const Hn=`
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
`,Wn="struct ProbeSel { b: u32, k: u32, p1: u32, p2: u32 }",tc=[{name:"bCollectPrep",wg:ze,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:r bat:a",code:`${Q}
${Ue}
${Vn}
${St}
${Xe} {
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
}`},{name:"bCollect",wg:ze,bind:"P:u bod:r bgeo:r bcell:w cf:r cu:r bat:a",code:`${Q}
${Ue}
${Vn}
${St}
${Xe} {
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
}`},{name:"bCollectRest",wg:ze,bind:"P:u bod:r bgeo:r bcell:w bat:a",code:`${Q}
${St}
${Xe} {
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
}`},{name:"bCollectEnd",wg:ze,bind:"P:u cf:w bat:a",code:`${St}
${Xe} {
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
}`},{name:"bExtInit",wg:ze,bind:"P:u glob:r bod:r cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${fe}
${Ui}
${Xe} {
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
}`},$n("bExtA","F_PE0","F_RE0","F_KN0","F_PE1","F_RE1","F_KN1"),$n("bExtB","F_PE1","F_RE1","F_KN1","F_PE0","F_RE0","F_KN0"),{name:"bForce",wg:64,bind:"P:u glob:r bod:w bgeo:r cf:r cu:r",code:`${Q}
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
${Un} {
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
}`},{name:"bProbeRhs",wg:ze,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:w",code:`${Wn}
${fe}
${mr}
${Hn}
${Xe} {
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
}`},{name:"bProbeDot",wg:ze,bind:"P:u PB:u<ProbeSel> L:u<Level> bod:r cu:r mgU:r cgv:r bat:a",code:`${Wn}
${fe}
${mr}
${Hn}
${St}
var<workgroup> rj: array<vec3<f32>, WG>;
${Xe} {
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
}`},{name:"bProbeFin",wg:64,bind:"P:u glob:r bod:w bat:a",code:`${fe}
${St}
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
}`},{name:"bMeas",wg:64,bind:"P:u bod:r bgeo:r bcell:r bmelt:r bread:w",code:`${Q}
const MLT_HEAD_R: u32 = ${pe}u;
const MLT_BODY_R: u32 = ${me}u;
const PEND_W_R: u32 = ${gr}u;
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
${Un} {
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
      let po = MLT_HEAD_R + b * MLT_BODY_R + ${Ae.PEND}u + s * PEND_W_R;
      pw += vec3<f32>(bmelt[po] - bmelt[po + 2u], bmelt[po + 1u], bmelt[po + 2u]);
    }
    bread[o + BRD_PM] = pw.x; bread[o + BRD_PH] = pw.y; bread[o + BRD_PS] = pw.z;
    var bx = vec4<f32>(0.0);
    if (!gone && bv(b, B_NR) > 0.0) { bx = rBox(rectOf(b, 0u)); }
    bread[o + BRD_RX0] = bx.x; bread[o + BRD_RY0] = bx.y; bread[o + BRD_RX1] = bx.z; bread[o + BRD_RY1] = bx.w;
  }
}`}],De=128,_e="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",er=`
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
`,Kn=`
fn statePressure(A: f32, B: f32, V: f32, rhoBar: f32) -> f32 {
  if (!(A > 0.0)) { return P.pamb; }
  let rg = rhoBar * P.gy;
  if (rg == 0.0) { return A / V; }
  return (A + sqrt(A * A + 4.0 * V * rg * B)) / (2.0 * V);
}
`,br=`
var<workgroup> rr: array<f32, ${16*De}>;
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
`,rc=[...[["gasApply",0],["gasApplyMid",1],["gasEos",2]].map(([l,e])=>({name:l,wg:De,bind:"P:u cf:w cu:r at:w reg:r",code:`${er}
${_e} {
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
}`})),{name:"transitions",wg:De,bind:"P:u cf:r cu:r at:a cnt:a",code:`fn nbOf(c: u32, k: u32) -> u32 {
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
${_e} {
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
}`},{name:"regCells",wg:De,bind:"P:u cf:r cu:r racc:a",code:`${br}
${_e} {
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
}`},{name:"regParts",wg:128,bind:"P:u cnt:a cu:r parts:r racc:a",code:`${br}
${_e} {
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
}`},{name:"regBubs",wg:De,bind:"P:u cnt:a cu:r bubs:r racc:a",code:`${_e} {
  let count = cntWG(lid3.x, C_BCOUNT);
  let b = gid.x;
  if (b >= count) { return; }
  let q = bubs[b];
  if (q.alive == 0u) { return; }
  let c = cellAtN(q.x, q.y);
  if (c == NONE) { return; }
  let r = cu[U_RID * P.n + c];
  if (r != NONE) { addF_racc(r * RACC_STRIDE + RA_VBUB, q.V); }
}`},...[["regFinishStart",!0],["regFinish",!1]].map(([l,e])=>({name:l,wg:64,bind:"P:u reg:w racc:a cnt:a",code:`${Kn}
${_e} {
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
    ${e?"reg[o + R_P0START] = reg[o + R_P0]; reg[o + R_DP0] = 0.0;":""}
    ${e?"if (P.bodies != 0u && reg[o + R_OPEN] == 0.0 && r < P.nreg) { addF_cnt(C_BODYWORK, p0Old * vfOld - reg[o + R_P0] * vf); }":""}
    for (var k = 0u; k < RACC_STRIDE; k++) { atomicStore(&racc[a + k], 0u); }
  }
}`})),{name:"compSums",wg:De,bind:"P:u cf:r cu:r reg:r racc:a",code:`${br}
${_e} {
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
}`},...[["compStep0",0],["compStep1",1],["compStepEnd",2]].map(([l,e])=>({name:l,wg:64,bind:"P:u reg:w racc:a",code:`${Kn}
${_e} {
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
}`})),{name:"compApply",wg:De,bind:"P:u cf:w cu:r reg:r",code:`${er}
${_e} {
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
}`},{name:"gasVolumes",wg:De,bind:"P:u cf:w cu:r reg:r",code:`${_e} {
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
}`},{name:"markFaces",wg:De,bind:"P:u cu:r ff:w fu:w",code:`${_e} {
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
}`}],Be=128,Te="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",zn="@compute @workgroup_size(WG) fn main(@builtin(local_invocation_id) lid3: vec3<u32>)",Xn=`
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
`,Yn=`
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
`,nc=`
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
`,ic=`
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
`,sc=[{name:"bPrep",wg:64,bind:"P:u bod:w bgeo:r",code:`${Q}
${zn} {
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
}`},{name:"bPush",wg:Be,bind:"P:u cnt:a bod:r bgeo:r parts:w",code:`${Q}
${Ue}
${fr}
${Te} {
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
}`},{name:"bPushB",wg:64,bind:"P:u cnt:a bod:r bgeo:r bubs:w",code:`${Q}
${Ue}
${fr}
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
}`},{name:"bCover",wg:Be,bind:"P:u bod:r bgeo:r bcell:r cf:w cu:w",code:`${Q}
${Ue}
${fr}
${Xn}
${Te} {
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
}`},{name:"bClose1",wg:Be,bind:"P:u bod:r cf:r cu:w",code:`${fe}
${Yn}
${nc}
${Te} {
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
}`},{name:"bClose2",wg:Be,bind:"P:u bod:r cf:r cu:w",code:`${fe}
${Yn}
fn closedNow(x: u32) -> bool { return cu[U_NOW1 * P.n + x] != 0u || paintedC(x); }
${Te} {
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
}`},{name:"bFlip",wg:Be,bind:"P:u cf:r cu:w at:a cnt:a",code:`${xn}
${ic}
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
${Te} {
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
}`},{name:"bApply",wg:Be,bind:"P:u cf:w cu:w",code:`${er}
${Te} {
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
}`},{name:"bStatic",wg:Be,bind:"P:u bod:r cf:w cu:r",code:`${fe}
${Xn}
fn shareAt(i: i32, j: i32) -> f32 {
  if (i < 0) { return select(1.0, 0.0, P.openL != 0u); }
  if (i >= i32(P.nx)) { return select(1.0, 0.0, P.openR != 0u); }
  if (j < 0) { return select(1.0, 0.0, P.openB != 0u); }
  if (j >= i32(P.ny)) { return select(1.0, 0.0, P.openT != 0u); }
  let c = cellOf(i, j);
  return select(min(1.0, cf[F_FS * P.n + c]), 1.0, cu[U_SOLID * P.n + c] != 0u);
}
${Te} {
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
}`},{name:"bPrepEnd",wg:64,bind:"P:u bod:w",code:`${fe}
${zn} {
  for (var b = lid3.x; b < P.nbody; b += 64u) {
    let o = b * BS;
    bod[o + B_OX0] = bod[o + B_BX0]; bod[o + B_OY0] = bod[o + B_BY0]; bod[o + B_OX1] = bod[o + B_BX1]; bod[o + B_OY1] = bod[o + B_BY1];
    if (bAwake(b)) { bod[o + B_RX] = bod[o + B_X]; bod[o + B_RY] = bod[o + B_Y]; bod[o + B_RA] = bod[o + B_A]; }
    bod[o + B_PUSH] = 0.0;
  }
}`},{name:"bFaceL",wg:Be,bind:"P:u bod:r cu:r ff:w fu:r",code:`${fe}
${mr}
fn wallFace(f: u32) -> bool {
  if (f < P.nu) { let i = f % (P.nx + 1u); return (i == 0u && P.openL == 0u) || (i == P.nx && P.openR == 0u); }
  let j = (f - P.nu) / P.nx;
  return (j == 0u && P.openB == 0u) || (j == P.ny && P.openT == 0u);
}
${Te} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] != 2u || wallFace(f)) { return; }
  let b = faceBody(f);
  if (b == NONE) { return; }
  ff[ffi(FF_UL, f)] = faceVelB(f, b);
}`},{name:"bFaceG",wg:Be,bind:"P:u bod:r cu:r ff:w fu:r",code:`${fe}
${mr}
${Te} {
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
}`},{name:"bRegVol",wg:Be,bind:"P:u cf:r cu:r racc:a",code:`${br}
${Te} {
  let c = gid.x;
  let lid = lid3.x;
  var r = NONE;
  var v = vec4<f32>(0.0);
  if (c < P.n) {
    r = cu[U_RID * P.n + c];
    if (r != NONE) { v.x = (1.0 - cf[F_FS * P.n + c]) * P.vcell; }
  }
  regSum(lid, r, v, vec4<u32>(RA_VSUM, RA_VSUM, RA_VSUM, RA_VSUM));
}`},{name:"bHeaters",wg:256,bind:"P:u bod:r bgeo:r bcell:r hacc:a",code:`${Q}
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
}`}],Qn=l=>l.map(w).join(", "),lc=`
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
const BCON_WT: u32 = ${_r}u;
const WT_W: u32 = ${hr}u;
const BCON_LIVE: u32 = ${xr}u;
const CW: u32 = ${Ci}u;
const MAXC: u32 = ${mt}u;
/* Eine Berührung im Arbeitsspeicher: Kennungen a, b; Teile a, b; Punkte; Normale; Reibung, Rückprall; Block (K und K⁻¹); zwei Punkte zu je 16 Wörtern. */
const CO_IDA: u32 = 0u; const CO_IDB: u32 = 1u; const CO_PA: u32 = 2u; const CO_PB: u32 = 3u; const CO_N: u32 = 4u;
const CO_NX: u32 = 5u; const CO_NY: u32 = 6u; const CO_FR: u32 = 7u; const CO_BO: u32 = 8u; const CO_BLK: u32 = 9u;
const CO_K11: u32 = 10u; const CO_K12: u32 = 11u; const CO_K22: u32 = 12u; const CO_I11: u32 = 13u; const CO_I12: u32 = 14u; const CO_I22: u32 = 15u;
const CO_PT: u32 = 16u;
const PT_X: u32 = 0u; const PT_Y: u32 = 1u; const PT_SEP: u32 = 2u; const PT_ID: u32 = 3u; const PT_JN: u32 = 4u; const PT_JT: u32 = 5u;
const PT_RAX: u32 = 6u; const PT_RAY: u32 = 7u; const PT_RBX: u32 = 8u; const PT_RBY: u32 = 9u; const PT_MN: u32 = 10u; const PT_MT: u32 = 11u;
const PT_BIAS: u32 = 12u; const PT_BOUNCE: u32 = 13u; const PT_FIXED: u32 = 14u; const PT_KICK: u32 = 15u;
const S_FRIC = array<f32, ${Fe.length}>(${Qn(Fe.map(l=>l.friction))});
const S_BOUNCE = array<f32, ${Fe.length}>(${Qn(Fe.map(l=>l.bounce))});
`,cc=`
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
`,ac=`
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
`,oc=`
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
`,uc=`
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
`,fc=`
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
`,dc=[{name:"bDyn",wg:64,bind:"P:u glob:r cnt:a bod:w bgeo:r bcell:r bcon:w<u32>",code:`${Q}
${lc}
${cc}
${ac}
${oc}
${uc}
${fc}
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
var<private> keys: array<vec2<u32>, ${mt}>;
var<private> order: array<u32, ${mt}>;
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
}`}],dn=128,bc=`
const WGM: u32 = ${dn}u;
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
`,pc=`
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
`,mc=`
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
`,vc=`
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
`,gc=`
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
`,hc=[{name:"mMelt",wg:dn,bind:"P:u cnt:a bod:w bgeo:w bcell:w bmelt:w cf:w cu:r at:a",code:`${Q}
${Ue}
${ln}
${cn}
${wl}
${bc}
${pc}
${mc}
${vc}
${gc}
@compute @workgroup_size(${dn}) fn main(@builtin(local_invocation_id) lid3: vec3<u32>) {
  let lid = lid3.x;
  if (lid == 0u) { wstamp = 0u; }
  for (var b = 0u; b < P.nbody; b++) {
    var go = 0u;
    if (lid == 0u) { go = select(0u, 1u, bv(b, B_MELT) != 0.0 && !bGone(b)); }
    go = uni(lid, go);
    if (go == 0u) { continue; }
    meltBody(b, lid);
  }
}`}],Zn=64,Jn="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ot=`
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
`,kr=`
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
`,_c=`
fn fritzD(B: Bubble, Tl: f32) -> f32 {
  if (B.site < 0 || !(P.gy > 0.0)) { return 1e30; }
  let S = sites[u32(B.site)];
  var theta = P.theta;
  if (!(theta > 0.0)) { theta = solidTheta(cu[U_SOLID * P.n + S.cell]); }
  let rhov = (B.mN + B.mO + B.mV) / max(1e-30, B.V);
  let hm = hostC(S.fluid);
  return FRITZ * theta * sqrt(sigmaLM(hm, B.Tb) / (P.gy * (rhoLM(hm, Tl) - rhov)));
}
`,xc=`
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
`,wc=[{name:"bubNucleate",wg:Zn,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sites:r sbub:a",code:`${Ot}
${kr}
${Jn} {
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
}`},{name:"bubAdvance",wg:Zn,bind:"P:u glob:r cnt:a cf:r cu:r at:a ff:r af:a bubs:w sites:r sbub:a",code:`${Ot}
${kr}
${_c}
${xc}
${Jn} {
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
}`}],rt=64,Ee="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Pc=`
fn bulkCold() -> bool {
  let m = bitcast<f32>(atomicLoad(&cnt[C_SUM_WM]));
  let mt = bitcast<f32>(atomicLoad(&cnt[C_SUM_WMT]));
  return m > 0.0 && mt / m <= P.tsatAmb - 5.0;
}
`,ei=`
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
`,Fc=[{name:"bubTarget",wg:rt,bind:"P:u cnt:a bubs:r btarget:w",code:`${Ee} {
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
}`},{name:"bubMerge",wg:rt,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ee} {
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
}`},{name:"bubMergeFinal",wg:rt,bind:"P:u cnt:a bubs:w btarget:r bacc:a sbub:a",code:`${Ot}
${Ee} {
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
}`},{name:"bubVent",wg:rt,bind:"P:u cnt:a cf:r cu:r at:a bubs:w",code:`${Ot}
${kr}
${ei}
${Ee} {
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
}`},{name:"bubFinish",wg:rt,bind:"P:u glob:r cnt:a cf:r cu:r at:a bubs:w sbub:a",code:`${Ot}
${kr}
${Pc}
${ei}
${Ee} {
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
${Ee} {
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
}`},{name:"bubCopyBack",wg:rt,bind:"P:u cnt:a bubs:w bubs2:r",code:`${Ee} {
  let count = min(cntWG(lid3.x, C_BCOUNT), P.bcap);
  let b = gid.x;
  if (b >= count) { return; }
  bubs[b] = bubs2[b];
}`},{name:"bubAlpha",wg:rt,bind:"P:u cnt:a bubs:r at:a",code:`${Ot}
${Ee} {
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
}`},{name:"cellAlpha",wg:128,bind:"P:u glob:r cf:w at:w",code:`${Ee} {
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
}`}],$r=128,Hr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",yc=`
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
`,kc=[...["viscJacA","viscJacB"].map(l=>{const[e,t]=l==="viscJacA"?["FF_UL","FF_VT"]:["FF_VT","FF_UL"];return{name:l,wg:$r,bind:"P:u glob:r ff:w fu:r",code:`fn hm(a: f32, b: f32) -> f32 { return select(0.0, 2.0 * a * b / (a + b), a + b > 0.0); }
${Hr} {
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
}`}}),{name:"viscForce",wg:$r,bind:"P:u ff:w fu:r",code:`${Hr} {
  let f = gid.x;
  if (f >= P.nf || fu[fui(FU_KNOWN, f)] == 2u) { return; }
  ff[ffi(FF_UL, f)] += ff[ffi(FF_VF, f)];
}`},{name:"cellHost",wg:$r,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Hr} {
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
}`}],ti=`const THETA_MIN: f32 = ${Fs.toFixed(6)};
fn thetaAt(c: u32, n: u32) -> f32 {
  let fc = cf[cfi(F_PHI, c)] / (1.0 - min(0.9, cf[cfi(F_PHIS, c)])) + cf[cfi(F_ALPHA, c)];
  let fo = cf[cfi(F_PHI, n)] / (1.0 - min(0.9, cf[cfi(F_PHIS, n)])) + cf[cfi(F_ALPHA, n)];
  if (!(fc > 0.5) || !(fc > fo)) { return THETA_MIN; }
  return clamp((fc - 0.5) / (fc - fo), THETA_MIN, 1.0);
}`,ur=128,nt=128,ue="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",oe=`
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
`,ri=`
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
`,Sc=`
fn rawW(x: f32, y: f32, i: i32, j: i32) -> f32 {
  return bspline1(x * P.invdx - 0.5 - f32(i)) * bspline1(y * P.invdx - 0.5 - f32(j));
}
`,ni=1,Bc=[{name:"sortCount",wg:256,bind:"P:u cnt:a parts:r ccount:a pkey:w pslot:w",code:`${ue} {
  let count = min(cntWG(lid3.x, C_PCOUNT), P.pcap);
  let p = gid.x;
  if (p == 0u) { atomicStore(&cnt[C_POLD], count); }
  if (p >= count) { return; }
  let q = parts[p];
  if ((q.flags & ${ni}u) != 0u || !(q.mass > 0.0)) { pkey[p] = NONE; return; }
  let c = cellAt(q.x, q.y);
  pkey[p] = c;
  pslot[p] = atomicAdd(&ccount[c], 1u);
}`},{name:"sortScan",wg:256,bind:"P:u ccount:r cstart:w bsum:w cclear:w<u32>",code:`var<workgroup> sh: array<u32, 256>;
${ue} {
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
${ue} {
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
    pargs[0] = max(1u, (total + ${ur-1}u) / ${ur}u);
    pargs[1] = 1u;
    pargs[2] = 1u;
  }
}`},{name:"sortScatter",wg:256,bind:"P:u cnt:a pkey:r<u32> pslot:r<u32> cstart:r bsum:r parts:r parts2:w",code:`${ue} {
  let old = cntWG(lid3.x, C_POLD);
  let p = gid.x;
  if (p >= old) { return; }
  let c = pkey[p];
  if (c == NONE) { return; }
  parts2[cellStart(c) + pslot[p]] = parts[p];
}`},{name:"splat",wg:nt,bind:"P:u glob:r cnt:a cf:w cu:w at:a parts:r ccount:r cstart:r bsum:r",code:`${oe}
${Sc}
${ue} {
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
}`},{name:"classify",wg:nt,bind:"P:u cf:r cu:w bod:r",code:`${xn}
${ue} {
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
}`},{name:"p2g",wg:nt,bind:"P:u glob:w cnt:r<f32> cu:r ff:w fu:w af:w parts:r ccount:r cstart:r bsum:r",code:`${ri}
${ue} {
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
}`},{name:"liqAssemble",wg:nt,bind:"P:u L:u<Level> glob:r cf:r cu:r at:r ff:r reg:r mgF:w mgU:w cgv:w",code:`fn pGas(c: u32) -> f32 { return pAt(c) - P.pref; }
${ti}
fn kindAt(i: i32, j: i32) -> u32 { return cu[U_KIND * P.n + cellOf(i, j)]; }
fn gasAt(i: i32, j: i32) -> bool {
  if (i < 0) { return P.openL != 0u; }
  if (i >= i32(P.nx)) { return P.openR != 0u; }
  if (j < 0) { return P.openB != 0u; }
  if (j >= i32(P.ny)) { return P.openT != 0u; }
  return kindAt(i, j) == GAS;
}
${ue} {
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
}`},{name:"liqPressure",wg:nt,bind:"P:u cf:w cu:r reg:r cgv:r at:w",code:`${ue} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let k = cu[cui(U_KIND, c)];
  var p = 0.0;
  if (k == GAS) { p = pAt(c) - P.pref; } else if (k == LIQUID) { p = cgv[s0(c)]; }
  cf[cfi(F_PL, c)] = p;
  at[ati(A_VOLSRC, c)] = 0.0;
}`},{name:"liqCorrect",wg:nt,bind:"P:u glob:r cf:r cu:r ff:w fu:w",code:`${ti}
/** Der Druckunterschied von Zelle l nach r; zwischen Flüssigkeit und Gas über den Abstand θ zur Oberfläche. */
fn across(l: u32, r: u32, d: f32) -> f32 {
  let kl = cu[cui(U_KIND, l)];
  let kr = cu[cui(U_KIND, r)];
  if (kl == GAS && kr == LIQUID) { return d / thetaAt(r, l); }
  if (kr == GAS && kl == LIQUID) { return d / thetaAt(l, r); }
  return d;
}
${ue} {
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
}`},...[["extrap1","FF_UL","FF_TMP","FU_MARK","FU_MARK2",!1],["extrap2","FF_TMP","FF_UL","FU_MARK2","FU_MARK",!0]].map(([l,e,t,n,i,r])=>({name:l,wg:nt,bind:"P:u ff:w fu:w",code:`${ue} {
  let f = gid.x;
  if (f >= P.nf) { return; }
  let os = ${e} * P.nf;
  let om = ${n} * P.nf;
  let mk = fu[om + f];
  if (mk != 0u) {
    ff[${t} * P.nf + f] = ff[os + f];
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
  if (n > 0.0) { ff[${t} * P.nf + f] = s / n; fu[${i} * P.nf + f] = 1u; }
  else { ff[${t} * P.nf + f] = ${r?"0.0":"ff[os + f]"}; fu[${i} * P.nf + f] = 0u; }
}`})),{name:"g2p",wg:ur,bind:"P:u glob:r cnt:a cf:r cu:r ff:r parts:w bod:r bgeo:r",code:`${ri}
${oe}
${Q}
${Ue}
${fr}
${$s}
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
${yc}
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
${ue} {
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
      q.flags = q.flags | ${ni}u;
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
}`},{name:"heatWeights",wg:ur,bind:"P:u cnt:a cu:r parts:w",code:`${oe}
${ue} {
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
}`}],Re=128,Ne="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",ii=`
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
`,si=`
fn substepsOf(mo: f32) -> u32 {
  return u32(clamp(ceil(mo * glob[G_DT] / P.dx / 0.9), 1.0, 16.0));
}
`,li=`
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
`,Tc=[{name:"gasMaxOut",wg:Re,bind:"P:u cu:r ff:r cnt:a",code:`${oe}
${Ne} {
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
}`},{name:"gasFlux",wg:Re,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:w fu:r",code:`${ii}
${si}
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
${Ne} {
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
}`},{name:"gasMove",wg:Re,bind:"P:u SUB:u<Sub> glob:r cnt:a cf:w cu:r ff:r fu:r",code:`${ii}
${si}
${oe}
fn mflux(f: u32) -> f32 {
  let o = FF_FLUX * P.nf + f;
  return ff[o] + ff[o + P.nf] + ff[o + 2u * P.nf] + ff[o + 3u * P.nf];
}
${Ne} {
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
}`},{name:"macFwd",wg:Re,bind:"P:u glob:r ff:w fu:r",code:`${li}
${Ne} {
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
}`},{name:"macBack",wg:Re,bind:"P:u glob:r cf:r cu:r reg:r ff:w fu:r",code:`${li}
${Ne} {
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
}`},{name:"viscosity",wg:Re,bind:"P:u glob:r cf:r cu:r ff:w fu:r",code:`${Ne} {
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
}`},{name:"gasAssemble",wg:Re,bind:"P:u L:u<Level> glob:r cf:r cu:r ff:r mgF:w mgU:w cgv:w",code:`${Ne} {
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
}`},{name:"gasPressure",wg:Re,bind:"P:u cf:w cu:r cgv:r",code:`${Ne} {
  let c = gid.x;
  if (c >= P.n) { return; }
  cf[F_PG * P.n + c] = select(0.0, cgv[s0(c)], cu[U_KIND * P.n + c] == GAS);
}`},{name:"gasCorrect",wg:Re,bind:"P:u glob:r cf:r ff:w fu:r",code:`${Ne} {
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
}`}],He=128,We="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Ce=`
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
`,Fn=`
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
`,Ac=`
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
`,Cc=[...[["gatherFull",!0],["gatherPlain",!1]].map(([l,e])=>({name:l,wg:He,bind:"P:u cf:w cu:r at:a parts:r ccount:r cstart:r bsum:r",code:`${Ce}
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
}`})),{name:"applyMass",wg:He,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ce}
${oe}
${Fn}
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
}`},{name:"diffPrep",wg:He,bind:"P:u cf:w cu:w reg:r",code:`${We} {
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
}`},{name:"diffAssemble",wg:He,bind:"P:u L:u<Level> glob:r cf:w cu:r reg:r mgF:w mgU:w cgv:w",code:`${Ac}
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
}`},{name:"diffFaces",wg:He,bind:"P:u glob:r cf:r cu:r ff:w cgv:r",code:`${We} {
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
}`},{name:"diffOut",wg:He,bind:"P:u glob:r cnt:a cf:w cu:r ff:r cgv:r",code:`/* Was die Gaszelle g über ihre Seite k aus der Flüssigkeit verdunsten lässt (genau das F, das diffApply bucht; sonst 0). */
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
}`},{name:"diffApply",wg:He,bind:"P:u glob:r cnt:a cf:w cu:r at:a ff:r cgv:r",code:`${oe}
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
}`},{name:"latentSrc",wg:He,bind:"P:u glob:r cf:r at:a",code:`${We} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let fm = getF_at(A_FM * n + c);
  let acc = cf[F_ACC * n + c];
  if (fm == 0.0) { return; }
  let hbar = select(hL(cf[F_PTL * n + c]), cf[F_ACCH * n + c] / acc, acc > 0.0);
  addF_at(A_HSRC * n + c, (getF_at(A_FE * n + c) - fm * hbar) / glob[G_DT]);
}`}],ci=[1/6,2/3,1/6];function qc(l){const e=l.grid,{n:t,nx:n,ny:i,dx:r}=e,s=new Uint8Array(t),c=Uint8Array.from(e.kind),f=new Uint8Array(t),u=new Uint8Array(t),d=new Uint32Array(t),m=new Float64Array(t),_=new Float64Array(t),L=Float32Array.from(e.T),v=l.heat.heaters.map(()=>0),A=new Float64Array(Math.max(1,l.regions.count)),G=l.bodies.list,C=new Uint8Array(t);for(let p=0;p<t;p+=1)e.owner[p]!==0&&e.matB[p]!==0&&(e.solid[p]!==0||e.fs[p]>.5)&&(C[p]=1);const h=(p,M)=>{if(C[p]!==0||C[M]!==0)return;const g=e.owner[p]!==0&&e.matB[p]!==0?e.fs[p]:-1,P=e.owner[M]!==0&&e.matB[M]!==0?e.fs[M]:-1;g<0&&P<0||(C[P>g?M:p]=1)};for(let p=0;p<i;p+=1)for(let M=1;M<n;M+=1)e.au[M+p*(n+1)]<=0&&h(M-1+p*n,M+p*n);for(let p=1;p<i;p+=1)for(let M=0;M<n;M+=1)e.av[M+p*n]<=0&&h(M+(p-1)*n,M+p*n);for(let p=0;p<t;p+=1){if(f[p]=e.solid[p],u[p]=e.kind[p],d[p]=e.role[p]===1&&e.heater[p]>=0?e.heater[p]+1:0,m[p]=e.Es[p],_[p]=e.film[p],C[p]===0)continue;const M=e.owner[p],g=e.solid[p]!==0,P=G[M-1],k=e.matB[p]-1,E=Fe[k];if(s[p]=1,!g){const U=l.regions.id[p];U>=0&&(A[U]+=(1-e.fs[p])*e.vCell)}f[p]=k+1,u[p]=Fi;const D=e.Ts[p]>0?e.Ts[p]:yi(e.Es[p],e.capB[p],e.film[p],e.crust[p],e.T[p]);m[p]=(E.rho*E.cp*e.vCell+e.crust[p]*bn)*(D-de)+e.film[p]*ys(D),L[p]=D,P!==void 0&&P.heater>=0&&P.heater<v.length&&(d[p]=P.heater+1,v[P.heater]+=1)}for(let p=0;p<t;p+=1)s[p]===0&&d[p]>0&&d[p]<=v.length&&(v[d[p]-1]+=1);const b=(p,M)=>p<0?e.openL?0:1:p>=n?e.openR?0:1:M<0?e.openB?0:1:M>=i?e.openT?0:1:f[p+M*n]!==0?1:0,O=new Float32Array(t),q=new Float32Array(t);for(let p=0;p<i;p+=1)for(let M=0;M<n;M+=1){const g=M+p*n;if(f[g]!==0){O[g]=1;continue}let P=0;for(let k=-1;k<=1;k+=1)for(let E=-1;E<=1;E+=1)P+=ci[E+1]*ci[k+1]*b(M+E,p+k);O[g]=P}const F=4;for(let p=0;p<i;p+=1)for(let M=0;M<n;M+=1){const g=M+p*n,P=f[g]!==0,k=(M+.5)*r,E=(p+.5)*r;let D=F*r;P||(e.openL||(D=Math.min(D,k)),e.openR||(D=Math.min(D,e.w-k)),e.openB||(D=Math.min(D,E)),e.openT||(D=Math.min(D,e.h-E)));for(let U=-F;U<=F;U+=1){const V=p+U;if(!(V<0||V>=i))for(let y=-F;y<=F;y+=1){const X=M+y;if(X<0||X>=n||f[X+V*n]!==0===P)continue;const R=Math.max(0,Math.abs(y)-.5)*r,I=Math.max(0,Math.abs(U)-.5)*r;D=Math.min(D,Math.hypot(R,I))}}q[g]=P?-D:D}return{body:s,kindCpu:c,solid:f,kind:u,hgrp:d,es:m,film:_,T:L,phiS:O,sdf:q,heaterCells:v,vFix:A}}function Lc(l,e){if(e===null)return;const t=l.grid,n=t.n;for(let i=0;i<n;i+=1){if(e.body[i]===0)continue;const r=Fe[e.solid[i]-1],s=yi(t.Es[i],r.rho*r.cp*t.vCell,t.film[i],t.crust[i],t.T[i]);t.Es[i]=ks(t.capB[i],t.film[i],t.crust[i],s),t.solid[i]===0&&(t.kind[i]=e.kindCpu[i])}l.bodies.cover.collect(l.bodies.list);for(let i=0;i<n;i+=1)e.body[i]!==0&&t.capB[i]>0&&l.heat.deriveSolid(i)}const Dt=16,ai=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC;function Oc(l){const e=l.grid,t=e.n,n=new Float64Array(t),i=new Float64Array(t),r=new Float64Array(t);for(let s=0;s<t;s+=1){const c=e.mg[at*t+s],f=e.mg[ot*t+s],u=e.mg[ut*t+s];n[s]=c/qr[at]+f/qr[ot]+u/qr[ut],i[s]=c+f+u+e.mfog[s]<=1e-30?18e-6:Ts(c,f,u,e.T[s]),r[s]=e.kind[s]===Fi||l.gas.vgas[s]<=0?0:n[s]*xi*e.T[s]/l.regions.pAt(s)}return{nmol:n,mu:i,veos:r}}function Ec(l,e){const t=l.regions,n=Int32Array.from({length:t.count},(u,d)=>d),i=u=>{let d=u;for(;n[d]!==d;)n[d]=n[n[d]],d=n[d];return d},r=(u,d)=>{const m=i(u),_=i(d);m!==_&&(n[Math.max(m,_)]=Math.min(m,_))},s=l.bodies.list;if(e&&s.some(u=>u.free)){const u=l.grid,{nx:d,ny:m,n:_}=u,L=h=>{var b;return u.solid[h]!==0&&u.owner[h]>0&&((b=s[u.owner[h]-1])==null?void 0:b.free)===!0},v=new Uint8Array(_),A=[];for(let h=0;h<_;h+=1){if(v[h]!==0||!L(h))continue;v[h]=1,A.push(h);let b=-1;for(;A.length>0;){const O=A.pop(),q=O%d,F=(O-q)/d;for(let p=0;p<4;p+=1){const M=q+(p===0?-1:p===1?1:0),g=F+(p===2?-1:p===3?1:0);if(M<0||g<0||M>=d||g>=m)continue;const P=M+g*d;if(L(P)){v[P]===0&&(v[P]=1,A.push(P));continue}const k=t.id[P];k<0||(b<0?b=k:r(b,k))}}}const G=l.bodies.cover.faceOwner,C=h=>{var O;const b=G[h];return b>0&&((O=s[b-1])==null?void 0:O.free)===!0};for(let h=0;h<m;h+=1)for(let b=1;b<d;b+=1){const O=b-1+h*d,q=O+1,F=t.id[O],p=t.id[q];F>=0&&p>=0&&F!==p&&u.au[b+h*(d+1)]<=0&&C(b+h*(d+1))&&r(F,p)}for(let h=1;h<m;h+=1)for(let b=0;b<d;b+=1){const O=b+(h-1)*d,q=O+d,F=t.id[O],p=t.id[q];F>=0&&p>=0&&F!==p&&u.av[b+h*d]<=0&&C(u.nu+b+h*d)&&r(F,p)}}const c=new Int32Array(t.count),f=new Map;for(let u=0;u<t.count;u+=1){const d=i(u);let m=f.get(d);m===void 0&&(m=f.size,f.set(d,m)),c[u]=m}return{group:c,count:f.size}}function Rc(l){const e=l.grid,{nx:t,ny:n,n:i}=e;let r=null,s=null;for(let c=0;c<i;c+=1){if(e.solid[c]===0||e.owner[c]===0)continue;let f=e.mfog[c];for(let _=0;_<As;_+=1)f+=e.mg[_*i+c];if(!(f>0)&&e.Hg[c]===0)continue;r??(r=new Int32Array(i).fill(-1)),s??(s=new Int32Array(i));let u=0,d=0;s[d++]=c,r[c]=c;let m=-1;for(;u<d&&m<0;){const _=s[u++],L=_%t,v=(_-L)/t;for(let A=0;A<4&&m<0;A+=1){const G=L+(A===0?-1:A===1?1:0),C=v+(A===2?-1:A===3?1:0);if(G<0||C<0||G>=t||C>=n)continue;const h=G+C*t;r[h]!==c&&(r[h]=c,e.solid[h]===0?m=h:e.owner[h]!==0&&(s[d++]=h))}}m>=0&&l.gas.move(c,m,1)}}class Nc{constructor(e,t){o(this,"stair",null);o(this,"body",!1);o(this,"bodies");o(this,"ctx");o(this,"d");o(this,"plan");o(this,"params");o(this,"glob");o(this,"cnt");o(this,"cf");o(this,"cu");o(this,"at");o(this,"ff");o(this,"fu");o(this,"af");o(this,"partsA");o(this,"partsB");o(this,"ccountA");o(this,"ccountB");o(this,"cstart");o(this,"bsum");o(this,"pkey");o(this,"pslot");o(this,"pargs");o(this,"bubs");o(this,"bubs2");o(this,"bacc");o(this,"btarget");o(this,"sites");o(this,"sbub");o(this,"reg");o(this,"racc");o(this,"heat");o(this,"hacc");o(this,"mgF");o(this,"mgU");o(this,"cgv");o(this,"cgs");o(this,"lab");o(this,"cfl");o(this,"csum");o(this,"cgp");o(this,"meas");o(this,"probe");o(this,"regionMap",new Int32Array(0));o(this,"regionInv",new Int32Array(0));o(this,"measGroups");o(this,"nsites",0);o(this,"own",[]);this.ctx=e;const n=t.grid,i=Math.max(1024,2*t.bubbleModel.cavities.count);this.d={nx:n.nx,ny:n.ny,n:n.n,nu:n.nu,nv:n.nv,nf:n.nu+n.nv,n0:(n.nx+2)*(n.ny+2),pcap:t.particles.cap,bcap:t.bubbles.cap,nsites:i,nreg:Math.max(64,2*t.regions.count),nheat:Math.max(16,2*t.heat.heaters.length)};const r=this.d;this.plan=ql(n.nx,n.ny);const s=(f,u,d=ai)=>{const m=e.buffer(f,4*Math.max(4,u),d);return this.own.push(m),m};this.params=s("params",Ln,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST),this.glob=s("glob",Rt),this.cnt=s("cnt",dt),this.cf=s("cf",Er*r.n),this.cu=s("cu",Rr*r.n),this.at=s("at",Nr*r.n),this.ff=s("ff",Mr*r.nf),this.fu=s("fu",qn*r.nf),this.af=s("af",Dr*r.nf),this.partsA=s("partsA",wt*r.pcap),this.partsB=s("partsB",wt*r.pcap),this.ccountA=s("ccountA",r.n+4),this.ccountB=s("ccountB",r.n+4),this.cstart=s("cstart",r.n+4),this.bsum=s("bsum",Math.ceil(r.n/1024)+4),this.pkey=s("pkey",r.pcap),this.pslot=s("pslot",r.pcap),this.pargs=s("pargs",8,ai|GPUBufferUsage.INDIRECT),this.bubs=s("bubs",Pt*r.bcap),this.bubs2=s("bubs2",Pt*r.bcap),this.bacc=s("bacc",rn*r.bcap),this.btarget=s("btarget",r.bcap),this.sites=s("sites",jr*r.nsites),this.sbub=s("sbub",r.nsites),this.reg=s("reg",we*r.nreg),this.racc=s("racc",Jr*r.nreg),this.heat=s("heat",Pe*r.nheat),this.hacc=s("hacc",en*r.nheat),this.mgF=s("mgF",this.plan.fSize),this.mgU=s("mgU",this.plan.uSize),this.cgv=s("cgv",5*r.n0),this.cgs=s("cgs",Si),this.lab=s("lab",r.n0),this.cfl=s("cfl",r.n0),this.csum=s("csum",qi*r.n0),this.cgp=s("cgp",4*Math.ceil(r.nx*r.ny/256)+16);const c=256;this.measGroups=[Math.ceil(r.n/c),Math.ceil(r.pcap/c),Math.ceil(r.bcap/c)],this.meas=s("meas",Dt*(this.measGroups[0]+this.measGroups[1]+this.measGroups[2])),this.probe=s("probe",64),this.bodies=new Pr(e,t)}get staircase(){return this.stair}fits(e){const t=this.d;return e.grid.nx===t.nx&&e.grid.ny===t.ny&&e.particles.cap===t.pcap&&e.bubbles.cap===t.bcap&&e.bubbleModel.cavities.count<=t.nsites&&e.regions.count<=t.nreg&&e.heat.heaters.length<=t.nheat&&this.bodies.fits(e)}destroy(){this.ctx.release(this.own),this.own.length=0,this.bodies.destroy()}writeParams(e){const t=this.d,n=e.grid,i=new ArrayBuffer(4*Ln),r=new Uint32Array(i),s=new Float32Array(i);r.set([t.nx,t.ny,t.n,t.nu,t.nv,t.nf,t.pcap,t.bcap,e.bubbleModel.cavities.count,e.regions.count,e.heat.heaters.length,t.n0],0),s.set([n.dx,n.depth,n.vCell,n.aFace,1/n.dx,n.w,n.h,e.dtMax],12),s.set([e.gy,e.pRef,e.regions.pAmb,e.regions.rhoAmb,e.ambientT,e.heat.hExt,e.tol,e.heat.liquidPower],20);const c=e.gas.amb;s.set([c[0],c[1],c[2],c[4]],28),s.set([e.ambientY[at],e.ambientY[ot],e.ambientY[ut],hn(e.regions.pAmb)],32),r.set([n.openL?1:0,n.openR?1:0,n.openB?1:0,n.openT?1:0],36);let f=0;for(let d=0;d<e.regions.count;d+=1)e.regions.open[d]===0&&(f=1);r[40]=f,r[41]=e.optionsUsed.harness===!0?1:0,s[42]=e.bubbleModel.contactAngleOverride??-1,r[43]=e.particles.hasOther()?1:0;const u=Ss(e.scene.extremes,e.regions.pAmb,Math.abs(e.gy));s.set([u.chf,u.actMax,u.vmax,u.bubCap],44),r.set([this.body?1:0,this.body?this.bodies.nbody:0,this.bodies.layers,0],48),this.ctx.device.queue.writeBuffer(this.params,0,i)}writeHeaters(e,t=null){const n=e.heat.heaters,i=new Float32Array(Pe*this.d.nheat);n.forEach((r,s)=>{var f;const c=Pe*s;i[c+ie.MODE]=r.mode==="thermostat"?1:0,i[c+ie.POWER]=r.power,i[c+ie.TARGET]=r.target,i[c+ie.ON]=r.on?1:0,i[c+ie.P]=r.P,i[c+ie.TMEAN]=r.Tmean,i[c+ie.INTEGRAL]=r.integral,i[c+ie.CELLS]=t!==null?t[s]??0:((f=this.stair)==null?void 0:f.heaterCells[s])??r.cells}),this.ctx.device.queue.writeBuffer(this.heat,0,i)}writeHeaterSettings(e,t){const n=e.heat.heaters[t];n===void 0||t>=this.d.nheat||this.ctx.device.queue.writeBuffer(this.heat,4*Pe*t,new Float32Array([n.mode==="thermostat"?1:0,n.power,n.target,n.on?1:0]))}upload(e){const t=this.ctx.device.queue,n=this.d,i=e.grid,r=n.n;this.body=on(e),this.bodies.upload(e);const s=this.body?null:qc(e);this.stair=s,this.writeParams(e),this.writeHeaters(e,s!==null?s.heaterCells:null);const c=e.regions,{group:f,count:u}=Ec(e,this.body),d=new Float64Array(Math.max(1,u)),m=new Int32Array(Math.max(1,u));for(let a=0;a<c.count;a+=1)d[f[a]]+=c.vFluid[a],m[f[a]]+=1;const _=Array.from({length:u},(a,S)=>S).sort((a,S)=>d[S]-d[a]),L=new Int32Array(Math.max(1,u));_.forEach((a,S)=>{L[a]=S}),this.regionMap=new Int32Array(Math.max(1,c.count)),this.regionInv=new Int32Array(Math.max(1,u));for(let a=c.count-1;a>=0;a-=1)this.regionMap[a]=L[f[a]],this.regionInv[L[f[a]]]=a;const v=new Float32Array(we*n.nreg),A=new Float64Array(Math.max(1,u)),G=new Float64Array(Math.max(1,u));for(let a=0;a<c.count;a+=1){const S=f[a],j=we*L[S];if(m[S]===1){v[j+H.OPEN]=c.open[a],v[j+H.VFLUID]=c.vFluid[a]-(s!==null?s.vFix[a]:0),v[j+H.P0]=c.p0[a],v[j+H.RHOBAR]=c.rhoBar[a],v[j+H.VLIQ]=c.vLiq[a],v[j+H.VBUB]=c.vBub[a],v[j+H.VGAS]=c.vGas[a],v[j+H.P0START]=c.p0[a];continue}c.open[a]!==0&&(v[j+H.OPEN]=1),v[j+H.VFLUID]+=c.vFluid[a],v[j+H.VLIQ]+=c.vLiq[a],v[j+H.VBUB]+=c.vBub[a],v[j+H.VGAS]+=c.vGas[a],A[S]+=c.p0[a]*c.vFluid[a],G[S]+=c.rhoBar[a]*c.vFluid[a]}for(let a=0;a<u;a+=1){if(m[a]===1)continue;const S=we*L[a];v[S+H.P0]=d[a]>0?A[a]/d[a]:e.pRef,v[S+H.OPEN]!==0&&(v[S+H.P0]=e.regions.pAmb),v[S+H.RHOBAR]=d[a]>0?G[a]/d[a]:e.regions.rhoAmb,v[S+H.P0START]=v[S+H.P0]}t.writeBuffer(this.reg,0,v);const C=new Uint32Array(Rr*r);for(let a=0;a<r;a+=1){const S=i.solid[a]!==0&&i.owner[a]===0;s!==null?(C[J.KIND*r+a]=s.kind[a],C[J.KPREV*r+a]=s.kind[a],C[J.SOLID*r+a]=s.solid[a],C[J.HGRP*r+a]=s.hgrp[a]):(C[J.KIND*r+a]=i.kind[a],C[J.KPREV*r+a]=i.kind[a],C[J.SOLID*r+a]=i.solid[a],C[J.HGRP*r+a]=S&&i.role[a]===1&&i.heater[a]>=0?i.heater[a]+1:0,C[J.OWNER*r+a]=i.owner[a],C[J.MATB*r+a]=i.matB[a],C[J.PAINT*r+a]=S?1:0);const j=c.id[a];C[J.RID*r+a]=j<0?Ir:this.regionMap[j]}t.writeBuffer(this.cu,0,C);const h=new Float32Array(Er*r),b=(a,S,j=0)=>{for(let $=0;$<r;$+=1)h[a*r+$]=S[j+$]};if(b(N.PHI,i.phi),b(N.ALPHA,i.alpha),b(N.ALPHAOLD,i.alpha),b(N.PL,i.pl),b(N.PG,i.pg),b(N.MN,i.mg,at*r),b(N.MO,i.mg,ot*r),b(N.MV,i.mg,ut*r),b(N.MF,i.mfog),b(N.HG,i.Hg),b(N.ES,s!==null?s.es:i.Es),b(N.FILM,s!==null?s.film:i.film),b(N.T,s!==null?s.T:i.T),b(N.TL,i.Tl),b(N.CL,i.Cl),s===null){const a=e.bodies.cover;b(N.FS,i.fs),b(N.CAPB,i.capB),b(N.TSB,i.Ts),b(N.ESY,a.esSync),b(N.FSY,a.filmSync),b(N.KSY,a.crustSync),b(N.WSUM,a.wsum)}const O=e.gas,q=Oc(e);b(N.VGAS,O.vgas),b(N.RHO,O.rho),b(N.NMOL,q.nmol),b(N.CAP,O.cap),b(N.MU,q.mu),b(N.VEOS,q.veos),b(N.SRCV,O.srcV),b(N.VEOSMID,q.veos),b(N.PHIS,s!==null?s.phiS:i.phiS),b(N.SDF,s!==null?s.sdf:i.sdf),b(N.PTL,s!==null?s.T:i.T),b(N.CRUST,i.crust);for(let a=0;a<i.nx;a+=1)h[N.FLOOR*r+a]=e.salt.floor[a],h[N.FLOORH*r+a]=e.salt.floorH[a];h.fill(1,N.AW*r,(N.AW+1)*r),t.writeBuffer(this.cf,0,h);const F=new Float32Array(Nr*r);for(let a=0;a<r;a+=1)F[tn.VOLSRC*r+a]=e.liquid.volSrc[a];t.writeBuffer(this.at,0,F);const p=n.nf,M=new Float32Array(Mr*p);for(let a=0;a<n.nu;a+=1)M[Me.UL*p+a]=i.ul[a],M[Me.UG*p+a]=i.ug[a];for(let a=0;a<n.nv;a+=1)M[Me.UL*p+n.nu+a]=i.vl[a],M[Me.UG*p+n.nu+a]=i.vg[a];t.writeBuffer(this.ff,0,M),t.writeBuffer(this.fu,0,new Uint32Array(qn*p));const g=new Float32Array(Dr*p);for(let a=0;a<n.nu;a+=1)g[a]=e.liquid.fU[a];for(let a=0;a<n.nv;a+=1)g[n.nu+a]=e.liquid.fV[a];t.writeBuffer(this.af,0,g);const P=e.particles,k=e.liquid,E=new ArrayBuffer(4*wt*Math.max(1,P.count)),D=new Float32Array(E),U=new Uint32Array(E),V=new Int32Array(E);for(let a=0;a<P.count;a+=1){const S=wt*a;D.set([P.x[a],P.y[a],P.vx[a],P.vy[a],P.c00[a],P.c01[a],P.c10[a],P.c11[a],P.mass[a],P.h[a],P.T[a],P.rho[a],k.dVp[a]],S),U[S+13]=(P.mat[a]&255)<<8,U[S+14]=P.id[a],V[S+15]=k.bi[a],V[S+16]=k.bj[a];for(let j=0;j<9;j+=1)D[S+17+j]=k.wt[9*a+j];D[S+26]=P.smass[2*a]}P.count>0&&t.writeBuffer(this.partsA,0,E);const y=e.bubbles,X=e.bubbleModel.motionState,R=new ArrayBuffer(4*Pt*Math.max(1,y.count)),I=new Float32Array(R),ve=new Uint32Array(R),W=new Int32Array(R);for(let a=0;a<y.count;a+=1){const S=Pt*a,j=a*Cr;I.set([y.x[a],y.y[a],y.z[a],y.vx[a],y.vy[a],y.m[j+at],y.m[j+ot],y.m[j+ut],y.H[a],y.age[a]],S),W[S+10]=y.site[a],I.set([y.r[a],y.V[a],y.pb[a],y.pv[a],y.Tb[a],y.dmdt[a],X.ux0[a],X.uy0[a]],S+11),ve[S+19]=y.id[a],ve[S+20]=1;for(let $=0;$<nr;$+=1)I[S+21+$]=y.force[a*nr+$]}y.count>0&&t.writeBuffer(this.bubs,0,R);const Y=e.bubbleModel.cavities;this.nsites=Y.count;const Ze=new ArrayBuffer(4*jr*n.nsites),Ve=new Uint32Array(Ze),gt=new Float32Array(Ze),Je=i.nx,Z=a=>s!==null?s.solid[a]:i.solid[a];for(let a=0;a<Y.count;a+=1){const S=jr*a;let j=Y.cell[a],$=Y.r[a];const Tr=Y.body[a]>=0?e.bodies.list[Y.body[a]]:void 0;if(Tr!==void 0&&(Tr.free||wr(Tr))&&($=1e-9),j>=0&&Z(j)===0){const Ar=Y.dir[a],rr=Ar===0?j+1:Ar===1?j-1:Ar===2?j+Je:j-Je;rr>=0&&rr<r&&Z(rr)!==0?j=rr:$=1e-9}j<0&&(j=0,$=1e-9),Ve.set([j,Y.fluid[a],Y.dir[a],0],S),gt.set([$,Y.s[a],Y.z[a],0],S+4)}t.writeBuffer(this.sites,0,Ze);const ht=new Uint32Array(n.nsites);for(let a=0;a<Y.count;a+=1)ht[a]=Y.bubble[a];t.writeBuffer(this.sbub,0,ht);const _t=new Float32Array(Rt);_t[Lt.DT]=e.dt,_t[Lt.TIME]=e.time,_t[Lt.RHOREF]=k.rhoRef,t.writeBuffer(this.glob,0,_t);const be=new Uint32Array(dt),Gt=new Float32Array(be.buffer);be[x.PCOUNT]=P.count,be[x.PSORT]=P.count,be[x.BCOUNT]=y.count,be[x.NEXTID_B]=Math.max(1,y.nextFree),be[x.NEXTID_P]=Math.max(1,P.nextFree);const T=e.bubbleModel;be[x.WATCH]=T.watch>=0?T.watch:Ir,be[x.WATCH_FATE]=T.watchFate,T.firstSuperheat!==null&&(Gt[x.FIRST_SH]=T.firstSuperheat+1e3,be[x.FIRST_MAT]=1),t.writeBuffer(this.cnt,0,be),t.writeBuffer(this.ccountA,0,new Uint32Array(n.n+4)),t.writeBuffer(this.ccountB,0,new Uint32Array(n.n+4)),t.writeBuffer(this.bacc,0,new Uint32Array(rn*n.bcap)),t.writeBuffer(this.racc,0,new Uint32Array(Jr*n.nreg)),t.writeBuffer(this.hacc,0,new Uint32Array(en*n.nheat))}async read(e){const t=this.ctx.device,n=e.map(d=>Math.ceil(d.size/4)*4),i=n.reduce((d,m)=>d+m,0),r=t.createBuffer({label:"read",size:Math.max(16,i),usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=t.createCommandEncoder();let c=0;e.forEach((d,m)=>{n[m]>0&&s.copyBufferToBuffer(d.buf,d.offset,r,c,n[m]),c+=n[m]}),t.queue.submit([s.finish()]),await r.mapAsync(GPUMapMode.READ);const f=r.getMappedRange().slice(0);r.unmap(),r.destroy();const u=[];c=0;for(const d of n)u.push(f.slice(c,c+d)),c+=d;return u}async download(e){const t=this.d,n=t.n,[i,r,s,c,f,u,d,m,_,L]=await this.read([{buf:this.cnt,offset:0,size:4*dt},{buf:this.glob,offset:0,size:4*Rt},{buf:this.cf,offset:0,size:4*Er*n},{buf:this.cu,offset:0,size:4*Rr*n},{buf:this.at,offset:0,size:4*Nr*n},{buf:this.ff,offset:0,size:4*Mr*t.nf},{buf:this.af,offset:0,size:4*Dr*t.nf},{buf:this.heat,offset:0,size:4*Pe*t.nheat},{buf:this.sbub,offset:0,size:4*t.nsites},{buf:this.reg,offset:0,size:4*we*t.nreg}]),v=new Uint32Array(i),A=Math.min(t.pcap,v[x.PCOUNT]),G=Math.min(t.bcap,v[x.BCOUNT]),[C,h]=await this.read([{buf:this.partsA,offset:0,size:4*wt*Math.max(1,A)},{buf:this.bubs,offset:0,size:4*Pt*Math.max(1,G)}]),b=e.grid,O=new Float32Array(s),q=(T,a,S=0)=>{for(let j=0;j<n;j+=1)a[S+j]=O[T*n+j]};q(N.PHI,b.phi),q(N.ALPHA,b.alpha),q(N.PL,b.pl),q(N.PG,b.pg),q(N.MN,b.mg,at*n),q(N.MO,b.mg,ot*n),q(N.MV,b.mg,ut*n),q(N.MF,b.mfog),q(N.HG,b.Hg),q(N.ES,b.Es),q(N.FILM,b.film),q(N.T,b.T),q(N.TL,b.Tl),q(N.CL,b.Cl);const F=e.gas;q(N.VGAS,F.vgas),q(N.RHO,F.rho),q(N.NMOL,F.nmol),q(N.CAP,F.cap),q(N.MU,F.mu),q(N.VEOS,F.veos),q(N.SRCV,F.srcV),q(N.VEOSMID,F.veosMid),q(N.CRUST,b.crust);for(let T=0;T<b.nx;T+=1)e.salt.floor[T]=O[N.FLOOR*n+T],e.salt.floorH[T]=O[N.FLOORH*n+T];const p=new Uint32Array(c);for(let T=0;T<n;T+=1)b.kind[T]=p[J.KIND*n+T];const M=new Float32Array(f);for(let T=0;T<n;T+=1)e.liquid.volSrc[T]=M[tn.VOLSRC*n+T];const g=new Float32Array(u),P=new Float32Array(d),k=t.nf;for(let T=0;T<t.nu;T+=1)b.ul[T]=g[Me.UL*k+T],b.ug[T]=g[Me.UG*k+T],e.liquid.fU[T]=P[T];for(let T=0;T<t.nv;T+=1)b.vl[T]=g[Me.UL*k+t.nu+T],b.vg[T]=g[Me.UG*k+t.nu+T],e.liquid.fV[T]=P[t.nu+T];const E=e.particles,D=e.liquid,U=new Float32Array(C),V=new Uint32Array(C),y=new Int32Array(C);let X=0,R=0;for(let T=0;T<A;T+=1){const a=wt*T;if(V[a+13]&1||!(U[a+8]>0))continue;const S=X;X+=1,E.x[S]=U[a],E.y[S]=U[a+1],E.vx[S]=U[a+2],E.vy[S]=U[a+3],E.c00[S]=U[a+4],E.c01[S]=U[a+5],E.c10[S]=U[a+6],E.c11[S]=U[a+7],E.mass[S]=U[a+8],E.h[S]=U[a+9];const j=U[a+26]>0?U[a+26]:0;E.spc[2*S]=j>0?Bs:0,E.spc[2*S+1]=0,E.smass[2*S]=j,E.smass[2*S+1]=0,E.mat[S]=V[a+13]>>>8&255,E.id[S]=V[a+14],E.id[S]>R&&(R=E.id[S]),D.dVp[S]=U[a+12],D.bi[S]=y[a+15],D.bj[S]=y[a+16];for(let $=0;$<9;$+=1)D.wt[9*S+$]=U[a+17+$];E.derive(S)}E.count=X,E.reserveIds(Math.max(v[x.NEXTID_P],R+1)),D.weightsDirty=!0;const I=e.bubbles,ve=e.bubbleModel.motionState,W=new Float32Array(h),Y=new Uint32Array(h),Ze=new Int32Array(h);I.count=0;let Ve=0;for(let T=0;T<G;T+=1){const a=Pt*T;if(Y[a+20]===0)continue;const S=I.count;I.count+=1;const j=S*Cr;I.x[S]=W[a],I.y[S]=W[a+1],I.z[S]=W[a+2],I.vx[S]=W[a+3],I.vy[S]=W[a+4];for(let $=0;$<Cr;$+=1)I.m[j+$]=0;I.m[j+at]=W[a+5],I.m[j+ot]=W[a+6],I.m[j+ut]=W[a+7],I.H[S]=W[a+8],I.age[S]=W[a+9],I.site[S]=Ze[a+10],I.r[S]=W[a+11],I.V[S]=W[a+12],I.pb[S]=W[a+13],I.pv[S]=W[a+14],I.Tb[S]=W[a+15],I.dmdt[S]=W[a+16],ve.ux0[S]=W[a+17],ve.uy0[S]=W[a+18],I.id[S]=Y[a+19],I.id[S]>Ve&&(Ve=I.id[S]);for(let $=0;$<nr;$+=1)I.force[S*nr+$]=W[a+21+$]}I.reserveIds(Math.max(v[x.NEXTID_B],Ve+1));const gt=e.bubbleModel.cavities,Je=new Uint32Array(_);for(let T=0;T<gt.count;T+=1)gt.bubble[T]=Je[T];const Z=new Float32Array(L);for(let T=0;T<e.regions.count;T+=1){const a=we*this.regionMap[T];e.regions.p0[T]=Z[a+H.P0],e.regions.rhoBar[T]=Z[a+H.RHOBAR]}const ht=new Float32Array(m);e.heat.heaters.forEach((T,a)=>{const S=Pe*a;T.P=ht[S+ie.P],T.Tmean=ht[S+ie.TMEAN],T.integral=ht[S+ie.INTEGRAL]});const _t=new Float32Array(r);e.dt=_t[Lt.DT];const be=e.bubbleModel;if(be.watch=v[x.WATCH]===Ir?-1:v[x.WATCH],!this.body){Lc(e,this.stair);return}for(let T=0;T<n;T+=1)p[J.PAINT*n+T]===0&&(b.solid[T]=p[J.SOLID*n+T],b.owner[T]=p[J.OWNER*n+T],b.matB[T]=p[J.MATB*n+T],b.fs[T]=O[N.FS*n+T],b.capB[T]=O[N.CAPB*n+T],b.Ts[T]=O[N.TSB*n+T]);Rc(e),await this.bodies.download(e,T=>this.read(T));const Gt=e.bodies.cover;for(const T of e.bodies.list)T.gone||Gt.weigh(T);Gt.addAll(),Gt.topologyChanged=!0,e.bodies.sync()}gpuRegion(e){return this.regionMap[e]??0}cpuRegion(e){return this.regionInv[e]??0}}const Ke=128,le="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>, @builtin(workgroup_id) wid3: vec3<u32>)",Mc=5,oi=30,ui=`
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
`,Dc=[{name:"heaterSums",wg:Ke,bind:"P:u cf:r cu:r hacc:a",code:`var<workgroup> wkey: atomic<u32>;
var<workgroup> kt: array<f32, WG>;
var<workgroup> kn: array<f32, WG>;
${le} {
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
}`},{name:"heaterPI",wg:64,bind:"P:u glob:r heat:w hacc:a",code:`${le} {
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
        let kp = power / ${Mc}.0;
        let e = heat[o + H_TARGET] - Tm;
        let next = heat[o + H_INTEGRAL] + e * dt;
        let raw = kp * (e + next / ${oi}.0);
        if (raw > 0.0 && raw < power) { heat[o + H_INTEGRAL] = next; }
        Pw = min(power, max(0.0, kp * (e + heat[o + H_INTEGRAL] / ${oi}.0)));
      }
    }
    heat[o + H_P] = Pw;
  }
}`},{name:"sumCl",wg:Ke,bind:"P:u cnt:a parts:r",code:`${oe}
${le} {
  let lid = lid3.x;
  let count = cntWG(lid, C_PSORT);
  let p = gid.x;
  var v = 0.0;
  if (p < count) { let q = parts[p]; if ((q.flags & 1u) == 0u) { v = q.mass * pCp(matOf(q.flags), q.T, q.s, q.mass); } }
  let s = wsum(v, lid);
  if (lid == 0u && s != 0.0) { addF_cnt(C_SUM_CL, s); }
}`},{name:"heatPrep",wg:Ke,bind:"P:u glob:r cnt:a cf:w cu:r at:w heat:r parts:r ccount:r cstart:r bsum:r",code:`${Ce}
${oe}
${le} {
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
}`},{name:"heatAssemble",wg:Ke,bind:"P:u L:u<Level> glob:r cf:r cu:r mgF:w mgU:w cgv:w",code:`${ui}
${le} {
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
}`},{name:"heatFlux",wg:Ke,bind:"P:u glob:r cnt:a cf:w cu:r cgv:r",code:`${ui}
${er}
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
${le} {
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
}`},{name:"heatParts",wg:Ke,bind:"P:u cnt:a cf:r parts:w",code:`${Ce}
${le} {
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
}`},{name:"heatShare",wg:Ke,bind:"P:u glob:r cu:r parts:w ccount:r cstart:r bsum:r",code:`${Ce}
${le} {
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
}`},{name:"pwParts",wg:Ke,bind:"P:u cnt:a cu:r reg:r parts:w",code:`${le} {
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
}`},{name:"pwBubs",wg:64,bind:"P:u cnt:a cu:r reg:r bubs:w",code:`${le} {
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
}`},{name:"stepEnd",wg:64,bind:"P:u glob:w cnt:a",code:`${le} {
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
${le} {
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
  if (lid < 11u) { meas[wid3.x * ${Dt}u + lid] = red[lid * 256u]; }
}`},{name:"measParts",wg:256,bind:"P:u cnt:a parts:r meas:w",code:`var<workgroup> red: array<f32, ${7*256}>;
${le} {
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
  if (lid < 7u) { meas[((P.n + 255u) / 256u + wid3.x) * ${Dt}u + lid] = red[lid * 256u]; }
}`},{name:"measBubs",wg:256,bind:"P:u cnt:a bubs:r meas:w",code:`var<workgroup> red: array<f32, ${3*256}>;
${le} {
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
  if (lid < 3u) { meas[((P.n + 255u) / 256u + (P.pcap + 255u) / 256u + wid3.x) * ${Dt}u + lid] = red[lid * 256u]; }
}`},{name:"bubWatch",wg:64,bind:"P:u cnt:a cf:r bubs:r probe:w",code:`${le} {
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
}`}],Bt=256,Ic=[...[1,2,3].map(l=>({name:`mgC${l}`,wg:Bt,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${dr}
${z} {
  let C = LP.C;
  let t = gid.x;
  if (t >= C.nx * C.ny) { return; }
  ${l===1?"coarsen1(LP.F, C, t);":l===2?"coarsen2(LP.F, C, t);":"diagonalAt(C, t);"}
}`})),{name:"mgC4",wg:Bt,bind:"P:u LP:u<LevelPair> mgF:w mgU:w",code:`${dr}
${z} {
  let F = LP.F;
  let t = gid.x;
  if (t >= F.nx * F.ny) { return; }
  weightsAt(F, LP.C, t);
}`},{name:"mgTailBuild",wg:Bt,bind:"P:u LV:u<Levels> mgF:w mgU:w",code:`${Dn}
${dr}
${z} {
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
}`},{name:"mgPost",wg:Bt,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Zt}
${Ie}
const TILE: u32 = 16u;
const HALO: u32 = ${re}u;
const TS: u32 = ${16+2*re}u;
var<workgroup> sx: array<f32, ${(16+2*re)**2}>;
var<workgroup> sb: array<f32, ${(16+2*re)**2}>;
var<workgroup> sax: array<f32, ${(16+2*re)**2}>;
var<workgroup> say: array<f32, ${(16+2*re)**2}>;
var<workgroup> sinv: array<f32, ${(16+2*re)**2}>;
${z} {
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
  for (var k = 0u; k < ${re}u; k++) {
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
}`},{name:"mgPreR",wg:Bt,bind:"P:u LP:u<LevelPair> mgF:w mgU:r cgs:r<u32>",code:`${Zt}
${Ie}
const TILE: u32 = 12u;
const HALO: u32 = ${re+2}u;
const TS: u32 = ${12+2*(re+2)}u;
var<workgroup> sx: array<f32, ${(12+2*(re+2))**2}>;
var<workgroup> sb: array<f32, ${(12+2*(re+2))**2}>;
var<workgroup> sax: array<f32, ${(12+2*(re+2))**2}>;
var<workgroup> say: array<f32, ${(12+2*(re+2))**2}>;
var<workgroup> sinv: array<f32, ${(12+2*(re+2))**2}>;
${z} {
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
  for (var k = 0u; k < ${re}u; k++) {
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
}`},{name:"mgTail",wg:Bt,bind:"P:u LV:u<Levels> mgF:w mgU:r cgs:r<u32>",code:`${Dn}
${Ie}
var<workgroup> tx: array<f32, ${qt}>;
var<workgroup> tb: array<f32, ${qt}>;
var<workgroup> tax: array<f32, ${qt}>;
var<workgroup> tay: array<f32, ${qt}>;
var<workgroup> tinv: array<f32, ${qt}>;
var<workgroup> toff: array<u32, ${Nt}>;
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
${z} {
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
  for (var k = 0u; k < ${Mn}u; k++) { shSweep(Lc, ol, 0u, lid); shSweep(Lc, ol, 1u, lid); }
  for (var k = 0u; k < ${Mn}u; k++) { shSweep(Lc, ol, 1u, lid); shSweep(Lc, ol, 0u, lid); }
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
}`}],it=128,st="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",jc=[{name:"flashTs",wg:it,bind:"P:u cf:w cu:r reg:r",code:`${st} {
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
}`},{name:"flashVap",wg:it,bind:"P:u cf:w parts:r ccount:r cstart:r bsum:r",code:`${Ce}
${st} {
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
}`},{name:"flashParts",wg:it,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${Ce}
${oe}
${Fn}
${st} {
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
}`},{name:"flashDist",wg:it,bind:"P:u cnt:a cf:r cu:r at:a",code:`${oe}
${st} {
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
}`},{name:"fog",wg:it,bind:"P:u cnt:a cf:w cu:r reg:r",code:`${er}
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
${st} {
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
}`},{name:"spawnWater",wg:it,bind:"P:u glob:r cnt:a cf:r cu:r at:a parts:w",code:`${st} {
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
}`},{name:"films",wg:it,bind:"P:u glob:r cnt:a cf:w cu:r parts:w",code:`${st} {
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
}`}],Wr=128,Kr="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Gc=`
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
`,Uc=`
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
`,Vc=[{name:"saltCryst",wg:Wr,bind:"P:u cnt:a cu:r at:a parts:w",code:`${Ce}
${oe}
${Fn}
${Kr} {
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
}`},{name:"saltSums",wg:Wr,bind:"P:u cf:w cu:r parts:r ccount:r cstart:r bsum:r",code:`${Ce}
${Kr} {
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
}`},{name:"saltShare",wg:Wr,bind:"P:u glob:r cf:r ff:r parts:w ccount:r cstart:r bsum:r",code:`${Ce}
${Gc}
${Uc}
${Kr} {
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
}`}],Br=`
const VIR = array<vec3<f32>, ${ir.length}>(${ir.map(l=>`vec3<f32>(${w(l[0]/255)}, ${w(l[1]/255)}, ${w(l[2]/255)})`).join(", ")});
fn viridis(t: f32) -> vec3<f32> {
  let x = clamp(t, 0.0, 1.0) * ${w(ir.length-1)};
  let i = min(u32(floor(x)), ${ir.length-2}u);
  let fr = x - f32(i);
  return mix(VIR[i], VIR[i + 1u], fr);
}
`,pr="struct ROpt { overlay: u32, step: u32, nax: u32, nay: u32 }";var hi;const Vi=`
const SOLID_RGB = array<vec3<f32>, ${Fe.length}>(${Fe.map(l=>{const e=Yr(l.color);return`vec3<f32>(${w(e[0]/255)}, ${w(e[1]/255)}, ${w(e[2]/255)})`}).join(", ")});
const CRYSTAL_RGB = vec3<f32>(${Yr(((hi=Cs[0])==null?void 0:hi.color)??"#f4f3ee").map(l=>w(l/255)).join(", ")});
`,fi=128,di="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>)",bi=8,pi=16,$c=[{name:"rBodies",wg:fi,bind:"P:u RO:u<ROpt> bod:r bgeo:r bcell:r bq:w be:w",code:`${pr}
${Br}
${Vi}
${Q}
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
${di} {
  let t = gid.x;
  let ncell = u32(bgeo[GH_NCELL]);
  let nrect = u32(bgeo[GH_NRECT]);
  if (t < ncell) {
    let o = ${bi}u * t;
    let rq = u32(bcell[BC * t + 3u]);
    let b = u32(rv(rq, GR_BODY));
    for (var k = 0u; k < ${bi}u; k++) { bq[o + k] = 0.0; }
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
      if (RO.overlay == 1u) { rgb = viridis((T - T0 - ${w(ce[0])}) / ${w(ce[1]-ce[0])}); }
      else if (RO.overlay != 6u) {
        let base = SOLID_RGB[min(mb, ${Fe.length}u) - 1u];
        let glow = clamp((T - T0 - 60.0) / 340.0, 0.0, 1.0);
        rgb = vec3<f32>(base.x + (0.902 - base.x) * glow, base.y * (1.0 - 0.6 * glow), base.z * (1.0 - 0.8 * glow));
        let size = max(1e-6, min(x1 - x0, y1 - y0));
        if (crust > 0.0) { rgb = mix(rgb, CRYSTAL_RGB, min(1.0, sqrt(crust / (${w(pn)} * size * P.depth) / size))); }
      }
      bq[o + 5u] = rgb.x; bq[o + 6u] = rgb.y; bq[o + 7u] = rgb.z;
    }
  }
  if (t < nrect) {
    let o = ${pi}u * t;
    let b = u32(rv(t, GR_BODY));
    for (var k = 0u; k < ${pi}u; k++) { be[o + k] = 0.0; }
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
}`},{name:"rLiqUnder",wg:fi,bind:"P:u bod:r bgeo:r src:r dst:w",code:`${Q}
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
${di} {
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
}`}],Tt=128,At="@compute @workgroup_size(WG) fn main(@builtin(global_invocation_id) gid: vec3<u32>, @builtin(local_invocation_id) lid3: vec3<u32>)",Hc=4*1e3*15e-7/(3*2*.07),Wc=[{name:"rScale",wg:Tt,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r cnt:a",code:`${pr}
var<workgroup> m4: array<vec4<f32>, WG>;
${At} {
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
}`},{name:"rCells",wg:Tt,bind:"P:u RO:u<ROpt> cf:r cu:r ff:r reg:r cnt:r<f32> cells:t field:t",code:`${pr}
${Br}
${Vi}
/* Deckung einer Salzkruste (wie layers.ts): die Dicke m/(ρ Δx D) als Bruchteil der Zelle, mit der Wurzel. */
fn crustCover(m: f32) -> f32 { if (!(m > 0.0)) { return 0.0; } return min(1.0, sqrt(m / (${w(pn)} * P.dx * P.depth) / P.dx)); }
${At} {
  let c = gid.x;
  if (c >= P.n) { return; }
  let n = P.n;
  let i = ci(c);
  let j = cj(c);
  let px = vec2<i32>(i, i32(P.ny) - 1 - j);
  let k = cu[U_KIND * n + c];
  let ov = RO.overlay;
  let tmin = ${w(ce[0])};
  let tspan = ${w(ce[1]-ce[0])};
  var cell = vec4<f32>(0.0);
  var col = vec3<f32>(0.0);
  var a = 0.0;
  let T = cf[F_T * n + c];
  /* Mit genauen Anteilen zeichnet sich ein Körper selbst (renderBodies.ts): seine geschlossenen Zellen bleiben leer (wie layers.ts). */
  let ownBody = k == SOLID && P.bodies != 0u && cu[U_OWNER * n + c] != 0u;
  if (ownBody) { cell = vec4<f32>(0.0); }
  else if (k == SOLID) {
    let s = cu[U_SOLID * n + c];
    let rgb = SOLID_RGB[min(s, ${Fe.length}u) - 1u];
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
      var af = min(0.95, 1.0 - exp(-fog / ${w(Hc)}));
      if (ov == 1u || ov == 2u || ov == 3u) { af *= 0.3; }
      let outA = af + a * (1.0 - af);
      if (outA > 0.0) { col = (vec3<f32>(af) + col * a * (1.0 - af)) / outA; }
      a = outA;
    }
  }
  textureStore(cells, px, cell);
  textureStore(field, px, vec4<f32>(col * a, a));
}`},{name:"rLiqSplat",wg:Tt,bind:"P:u lq:w parts:r ccount:r cstart:r bsum:r",code:`${At} {
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
}`},{name:"rLiqBlurX",wg:Tt,bind:"P:u lq:r lq2:w",code:`${At} {
  let t = gid.x;
  let lx = 2u * P.nx;
  let ly = 2u * P.ny;
  if (t >= lx * ly) { return; }
  let I = t % lx;
  let l = select(t, t - 1u, I > 0u);
  let r = select(t, t + 1u, I + 1u < lx);
  for (var k = 0u; k < 4u; k++) { lq2[4u * t + k] = 0.25 * lq[4u * l + k] + 0.5 * lq[4u * t + k] + 0.25 * lq[4u * r + k]; }
}`},{name:"rLiqBlurY",wg:Tt,bind:"P:u lq2:r liquid:t",code:`${At} {
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
  if (w > 0.0) { temp = clamp((wt / w - T0 - ${w(ce[0])}) / ${w(ce[1]-ce[0])}, 0.0, 1.0); }
  textureStore(liquid, vec2<i32>(i32(I), i32(ly - 1u - J)), vec4<f32>(min(1.0, w), temp, select(0.0, clamp(wo / w, 0.0, 1.0), w > 0.0), select(0.0, clamp(wsl / (w * ${w(mn)}), 0.0, 1.0), w > 0.0)));
}`},{name:"rArrows",wg:Tt,bind:"P:u RO:u<ROpt> cu:r ff:r cnt:r<f32> arrows:w",code:`${pr}
${At} {
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
}`},...$c],yn=`
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
`;var _i;`${yn}${Br}${Yr(((_i=qs[1])==null?void 0:_i.color)??"#e3b437").map(l=>w(l)).join(", ")}`;`${yn}${(wn.match(/struct Bubble \{[\s\S]*?\n\}/)??[""])[0]}${x.BCOUNT}`;`${yn}${Br}${(wn.match(/struct Particle \{[\s\S]*?\n\}/)??[""])[0]}${x.PCOUNT}${w(273.15+ce[0])}${w(ce[1]-ce[0])}${w(mn)}`;const Kc=[...Al,...Ic,...Bc,...kc,...rc,...Tc,...wc,...Fc,...Cc,...jc,...Vc,...Dc,...Wc,...sc,...tc,...dc,...Pl,...hc],mi=[["heater",x.HEATER_E,"f"],["lossWalls",x.LOSS_WALLS,"f"],["lossOpen",x.LOSS_OPEN,"f"],["escapedEnergy",x.ESC_ENERGY,"f"],["escapedWater",x.ESC_WATER,"f"],["escapedAir",x.ESC_AIR,"f"],["escapedOther",x.ESC_OTHER,"f"],["escapedSalt",x.ESC_SALT,"f"],["crystallized",x.CRYST,"f"],["produced",x.PRODUCED,"f"],["condensed",x.CONDENSED,"f"],["dew",x.DEW,"f"],["fogMade",x.FOGMADE,"f"],["burstVapour",x.BURSTVAP,"f"],["fluxSL",x.FLUX_SL,"f"],["fluxLG",x.FLUX_LG,"f"],["fluxSG",x.FLUX_SG,"f"],["lossSolids",x.LOSS_SOLIDS,"f"],["nucleated",x.NUCLEATED,"u"],["departed",x.DEPARTED,"u"],["merged",x.MERGED,"u"],["burst",x.BURST,"u"],["collapsed",x.COLLAPSED,"u"],["burstCold",x.BURST_COLD,"u"],["burstWarm",x.BURST_WARM,"u"],["collapsedCold",x.COLL_COLD,"u"],["collapsedWarm",x.COLL_WARM,"u"],["releasedGas",x.REL_MASS,"f"],["releases",x.REL_N,"u"],["releaseMisses",x.REL_MISS,"u"],["evapCapped",x.EVAP_CAP,"u"],["bodyWork",x.BODYWORK,"f"],["parked",x.PARKED,"u"],["contFull",x.CONT_FULL,"u"],["melted",x.MELTED,"f"],["frozen",x.FROZEN,"f"],["meltFull",x.MELTFULL,"u"]],vi=()=>({time:0,steps:0,heater:0,lossWalls:0,lossOpen:0,escapedEnergy:0,escapedWater:0,escapedAir:0,escapedOther:0,escapedSalt:0,crystallized:0,produced:0,condensed:0,dew:0,fogMade:0,burstVapour:0,nucleated:0,departed:0,merged:0,burst:0,collapsed:0,burstCold:0,burstWarm:0,collapsedCold:0,collapsedWarm:0,fluxSL:0,fluxLG:0,fluxSG:0,lossSolids:0,capped:0,slowed:0,vented:0,releasedGas:0,releases:0,releaseMisses:0,evapCapped:0,bodyWork:0,parked:0,contFull:0,melted:0,frozen:0,meltFull:0}),zc=24,zr=256,Ct=2*Qr;class It{constructor(e,t){o(this,"ctx");o(this,"cpu");o(this,"state");o(this,"solver");o(this,"bstep");o(this,"lastBody",null);o(this,"sub");o(this,"groups",new Map);o(this,"stateVersion",0);o(this,"itL",16);o(this,"itG",18);o(this,"itH",8);o(this,"itD",6);o(this,"nsub",0);o(this,"totals",vi());o(this,"last",null);o(this,"stepped",null);o(this,"energy0",null);o(this,"water0",null);o(this,"other0",null);o(this,"salt0",null);o(this,"carry",null);o(this,"sealed",!1);o(this,"salty",!1);o(this,"mixed",!1);o(this,"staging",[]);o(this,"busy",new Set);o(this,"reading",new Map);o(this,"querySet");o(this,"queryBuf");o(this,"vapourMark",0);o(this,"vapourLast",0);o(this,"vapourRate",0);o(this,"stageMs",new Array(Qr).fill(0));o(this,"hooks",{cells:(e,t,n)=>this.cells(e,t,n??""),faces:(e,t)=>this.faces(e,t),parts:(e,t)=>this.parts(e,t,"A"),bubs:(e,t)=>this.bubs(e,t),one:(e,t)=>this.one(e,t),run:(e,t,n,i,r)=>{const s=`${t}|run|${i}`;let c=this.groups.get(s);c===void 0&&(c=this.ctx.bind(t,{...this.resources("A"),...r}),this.groups.set(s,c)),this.ctx.dispatch(e,t,c,n)}});this.ctx=e,this.cpu=t,this.querySet=e.timestamps?e.device.createQuerySet({type:"timestamp",count:Ct}):null,this.queryBuf=e.timestamps?e.buffer("ts",8*Ct,GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC):null,this.rebuild()}static async create(e){return It.on(await It.prepare(),e)}static async prepare(e=[]){const t=await Pn.create(),n=await t.compile([...Kc,...e]);if(n.length>0)throw t.destroy(),new Error(`WGSL: ${n.slice(0,3).join(" | ")}`);return t}static on(e,t){return new It(e,t)}rebuild(){this.stateVersion+=1;const e=this.state===void 0?null:this.state.d;this.state!==void 0&&this.state.destroy(),this.solver!==void 0&&this.solver.destroy(),this.bstep!==void 0&&this.bstep.destroy(),this.sub!==void 0&&this.ctx.release([this.sub]),this.state=new Nc(this.ctx,this.cpu);const t=this.state;(e===null||e.nx!==t.d.nx||e.ny!==t.d.ny)&&(this.itL=16,this.itG=18,this.itH=8,this.itD=6),this.solver=new Ll(this.ctx,t.plan,{params:t.params,mgF:t.mgF,mgU:t.mgU,cgv:t.cgv,cgs:t.cgs,lab:t.lab,cfl:t.cfl,csum:t.csum,cnt:t.cnt,cgp:t.cgp}),this.bstep=new El(t,this.solver);const n=new Uint32Array(zr/4*16);for(let i=0;i<16;i+=1)n[zr/4*i]=i;this.sub=this.ctx.uniform("sub",n.buffer),this.groups.clear(),this.upload()}upload(){if(!this.state.fits(this.cpu)){this.rebuild();return}this.state.upload(this.cpu),this.lastBody!==null&&this.state.body!==this.lastBody&&this.carryErrors({energy:this.cpu.energyError(),water:this.cpu.waterError(),other:this.cpu.otherError(),salt:this.cpu.saltError()}),this.lastBody=this.state.body,this.bstep.writeSel(),this.mixed=this.cpu.particles.hasOther(),this.salty=this.cpu.particles.hasSalt(),this.sealed=!1;for(let n=0;n<this.cpu.regions.count;n+=1)this.cpu.regions.open[n]===0&&(this.sealed=!0);const e=this.ctx.device.createCommandEncoder(),t=e.beginComputePass();this.sort(t,1),this.sort(t,2),t.end(),this.ctx.device.queue.submit([e.finish()])}async download(){await this.state.download(this.cpu);const e=this.cpu,t=this.totals;e.time=t.time,e.steps=t.steps;const n=e.flows;n.heater=t.heater,n.lossWalls=t.lossWalls,n.lossOpen=t.lossOpen,n.escapedEnergy=t.escapedEnergy,n.escapedWater=t.escapedWater,n.escapedAir=t.escapedAir,n.escapedOther=t.escapedOther,n.escapedSalt=t.escapedSalt,e.salt.crystallized=t.crystallized,e.phase.produced=t.produced,e.phase.condensed=t.condensed,e.phase.dew=t.dew,e.phase.fogMade=t.fogMade;const i=e.bubbleModel;i.burstVapour=t.burstVapour,i.nucleated=t.nucleated,i.departed=t.departed,i.merged=t.merged,i.burst=t.burst,i.collapsed=t.collapsed,i.burstCold=t.burstCold,i.burstWarm=t.burstWarm,i.collapsedCold=t.collapsedCold,i.collapsedWarm=t.collapsedWarm,e.heat.fluxSL=t.fluxSL,e.heat.fluxLG=t.fluxLG,e.heat.fluxSG=t.fluxSG,e.heat.lossSolids=t.lossSolids,n.bodyWork=t.bodyWork,e.melt.melted=t.melted,e.melt.frozen=t.frozen,this.last!==null&&this.last.firstSuperheat!==null&&i.firstSuperheat===null&&(i.firstSuperheat=this.last.firstSuperheat)}writeParams(){this.state.writeParams(this.cpu)}writeHeater(e){this.state.writeHeaterSettings(this.cpu,e)}watch(e){this.ctx.device.queue.writeBuffer(this.state.cnt,4*x.WATCH,new Uint32Array([e??4294967295])),this.ctx.device.queue.writeBuffer(this.state.cnt,4*x.WATCH_FATE,new Uint32Array([0]))}destroy(){this.state.destroy(),this.ctx.destroy()}resources(e){const t=this.state,n={P:t.params,glob:t.glob,cnt:t.cnt,cf:t.cf,cu:t.cu,at:t.at,ff:t.ff,fu:t.fu,af:t.af,reg:t.reg,racc:t.racc,heat:t.heat,hacc:t.hacc,sites:t.sites,sbub:t.sbub,bubs:t.bubs,bubs2:t.bubs2,bacc:t.bacc,btarget:t.btarget,meas:t.meas,probe:t.probe,mgF:t.mgF,mgU:t.mgU,cgv:t.cgv,cgs:t.cgs,lab:t.lab,cfl:t.cfl,csum:t.csum,pkey:t.pkey,pslot:t.pslot,pargs:t.pargs,cstart:t.cstart,bsum:t.bsum,L:this.solver.level0,bod:t.bodies.bod,bgeo:t.bodies.bgeo,bcell:t.bodies.bcell,bcon:t.bodies.bcon,bat:t.bodies.bat,bread:t.bodies.bread,bmelt:t.bodies.bmelt};return e==="A"&&(n.parts=t.partsA,n.ccount=t.ccountB),e==="B"&&(n.parts=t.partsB,n.ccount=t.ccountA),e==="S1"&&(n.parts=t.partsA,n.parts2=t.partsB,n.ccount=t.ccountA,n.cclear=t.ccountB),e==="S2"&&(n.parts=t.partsB,n.parts2=t.partsA,n.ccount=t.ccountB,n.cclear=t.ccountA),n}group(e,t,n=-1){const i=`${e}|${t}|${n}`;let r=this.groups.get(i);if(r===void 0){const s=n>=0?{...this.resources(t),SUB:{buffer:this.sub,offset:zr*n,size:16}}:this.resources(t);r=this.ctx.bind(e,s),this.groups.set(i,r)}return r}cells(e,t,n="",i=-1){this.ctx.dispatch(e,t,this.group(t,n,i),this.state.d.n)}faces(e,t,n="",i=-1){this.ctx.dispatch(e,t,this.group(t,n,i),this.state.d.nf)}parts(e,t,n){this.ctx.dispatch(e,t,this.group(t,n),this.state.d.pcap)}bubs(e,t){this.ctx.dispatch(e,t,this.group(t,""),this.state.d.bcap)}one(e,t,n=""){this.ctx.dispatchOne(e,t,this.group(t,n))}sort(e,t){const n=t===1?"S1":"S2",i=this.state.d;this.ctx.dispatch(e,"sortCount",this.group("sortCount",n),i.pcap),this.ctx.dispatch(e,"sortScan",this.group("sortScan",n),Math.ceil(i.n/4)),this.one(e,"sortTop",n),this.ctx.dispatch(e,"sortScatter",this.group("sortScatter",n),i.pcap)}encodeSteps(e,t,n){for(let i=0;i<t;i+=1)this.encodeStep(e,n&&i===0&&this.querySet!==null);n&&t>0&&this.querySet!==null&&this.queryBuf!==null&&e.resolveQuerySet(this.querySet,0,Ct,this.queryBuf,0)}pass(e,t,n){if(this.ctx.profiler!==null){const i=()=>{};return{label:"",setPipeline:i,setBindGroup:i,dispatchWorkgroups:i,dispatchWorkgroupsIndirect:i,end:i}}return!t||this.querySet===null?e.beginComputePass():e.beginComputePass({timestampWrites:{querySet:this.querySet,beginningOfPassWriteIndex:2*n,endOfPassWriteIndex:2*n+1}})}encodeStep(e,t){const n=this.cpu,i=this.state.body;let r;if(i&&(r=this.pass(e,t,0),this.bstep.prepare(r,this.hooks),r.end()),r=this.pass(e,t,1),this.sort(r,1),this.mixed&&this.cells(r,"cellHost","B"),this.cells(r,"splat","B"),this.cells(r,"classify"),this.cells(r,"transitions"),this.cells(r,"gasApply"),this.cells(r,"regCells"),this.parts(r,"regParts","B"),this.bubs(r,"regBubs"),i&&this.cells(r,"bRegVol"),this.one(r,"regFinishStart"),this.faces(r,"p2g","B"),i&&this.faces(r,"bFaceL"),this.mixed){for(let s=0;s<zc;s+=2)this.faces(r,"viscJacA"),this.faces(r,"viscJacB");this.faces(r,"viscForce")}this.cells(r,"liqAssemble"),this.solver.encodeMG(r,Li,this.itL,!0,!1),this.cells(r,"liqPressure"),this.faces(r,"liqCorrect"),i&&this.bstep.probe(r,this.hooks),this.faces(r,"extrap1"),this.faces(r,"extrap2"),this.parts(r,"g2p","B"),this.sort(r,2),this.parts(r,"heatWeights","A"),r.end(),r=this.pass(e,t,2),this.cells(r,"gasVolumes"),this.faces(r,"markFaces"),i&&this.faces(r,"bFaceG"),this.cells(r,"gasMaxOut");for(let s=0;s<16;s+=1)this.cells(r,"gasFlux","",s),this.cells(r,"gasMove","",s);if(this.cells(r,"gasApplyMid"),this.faces(r,"macFwd"),this.faces(r,"macBack"),this.faces(r,"viscosity"),this.cells(r,"gasAssemble"),this.solver.encodeMG(r,Oi,this.itG,!0,!0),this.cells(r,"gasPressure"),this.faces(r,"gasCorrect"),r.end(),r=this.pass(e,t,3),this.cells(r,"gatherFull","A"),this.state.nsites>0&&this.ctx.dispatch(r,"bubNucleate",this.group("bubNucleate",""),this.state.nsites),this.bubs(r,"bubAdvance"),this.bubs(r,"bubTarget"),this.bubs(r,"bubMerge"),this.bubs(r,"bubMergeFinal"),this.bubs(r,"bubVent"),this.bubs(r,"bubFinish"),this.one(r,"bubCompact"),this.bubs(r,"bubCopyBack"),this.parts(r,"applyMass","A"),this.cells(r,"spawnWater","A"),this.cells(r,"gatherPlain","A"),this.bubs(r,"bubAlpha"),this.cells(r,"cellAlpha"),this.cells(r,"gasApply"),r.end(),r=this.pass(e,t,4),this.cells(r,"diffPrep"),this.cells(r,"diffAssemble"),this.solver.encodeMG(r,Ri,this.itD,!1),this.faces(r,"diffFaces"),this.cells(r,"diffOut"),this.cells(r,"diffApply"),this.cells(r,"latentSrc"),this.parts(r,"applyMass","A"),this.cells(r,"spawnWater","A"),this.cells(r,"gatherPlain","A"),this.cells(r,"gasApply"),this.cells(r,"flashTs"),this.cells(r,"flashVap","A"),this.parts(r,"flashParts","A"),this.cells(r,"flashDist"),this.cells(r,"gasApply"),this.cells(r,"fog"),this.cells(r,"films","A"),this.salty&&(this.parts(r,"saltCryst","A"),this.cells(r,"gasApply")),r.end(),r=this.pass(e,t,5),this.cells(r,"heaterSums"),i&&this.one(r,"bHeaters"),this.one(r,"heaterPI"),n.heat.liquidPower!==0&&this.parts(r,"sumCl","A"),this.cells(r,"heatPrep","A"),this.cells(r,"heatAssemble"),this.solver.encodeMG(r,Ei,this.itH,!1),this.cells(r,"heatFlux"),this.parts(r,"heatParts","A"),this.cells(r,"heatShare","A"),this.salty&&(this.cells(r,"saltSums","A"),this.cells(r,"saltShare","A")),r.end(),r=this.pass(e,t,7),this.cells(r,"regCells"),this.parts(r,"regParts","A"),this.bubs(r,"regBubs"),i&&this.cells(r,"bRegVol"),this.one(r,"regFinish"),this.sealed&&(this.cells(r,"compSums"),this.one(r,"compStep0"),this.cells(r,"compApply"),this.cells(r,"compSums"),this.one(r,"compStep1"),this.cells(r,"compApply"),this.cells(r,"compSums"),this.one(r,"compStepEnd"),this.parts(r,"pwParts","A"),this.bubs(r,"pwBubs")),this.cells(r,"gasEos"),!i){this.one(r,"stepEnd"),r.end();return}r.end(),r=this.pass(e,t,8),this.bstep.finish(r,this.hooks),this.one(r,"stepEnd"),r.end()}layout(){const e=this.state,t=0,n=t+4*dt,i=n+4*Rt,r=i+4*we*e.d.nreg,s=r+4*Pe*e.d.nheat,c=e.measGroups[0]+e.measGroups[1]+e.measGroups[2],f=s+4*Dt*c,u=f+4*64,d=u+8*Ct,m=e.body?e.bodies.nbody:0,_=d+4*Et*m;return{cnt:t,glob:n,reg:i,heat:r,meas:s,probe:f,ts:u,bodies:d,nbody:m,total:_}}encodeReadback(e,t){const n=this.state,i=this.layout();let r=this.staging.find(f=>!this.busy.has(f)&&f.size>=i.total);if(r===void 0){const f=this.staging.findIndex(u=>!this.busy.has(u)&&u.size<i.total);if(f>=0&&(this.staging[f].destroy(),this.staging.splice(f,1)),this.staging.length>=3)return null;r=this.ctx.device.createBuffer({label:"readback",size:Math.ceil(i.total/16)*16+16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.staging.push(r)}const s=e.beginComputePass();this.ctx.dispatch(s,"measCells",this.group("measCells",""),n.d.n),this.ctx.dispatch(s,"measParts",this.group("measParts","A"),n.d.pcap),this.ctx.dispatch(s,"measBubs",this.group("measBubs",""),n.d.bcap),this.ctx.dispatch(s,"bubWatch",this.group("bubWatch",""),n.d.bcap),i.nbody>0&&this.bstep.measure(s,this.hooks),s.end(),i.nbody>0&&e.copyBufferToBuffer(n.bodies.bread,0,r,i.bodies,4*Et*i.nbody),e.copyBufferToBuffer(n.cnt,0,r,i.cnt,4*dt),e.copyBufferToBuffer(n.glob,0,r,i.glob,4*Rt),e.copyBufferToBuffer(n.reg,0,r,i.reg,4*we*n.d.nreg),e.copyBufferToBuffer(n.heat,0,r,i.heat,4*Pe*n.d.nheat),e.copyBufferToBuffer(n.meas,0,r,i.meas,i.probe-i.meas),e.copyBufferToBuffer(n.probe,0,r,i.probe,4*64),t&&this.queryBuf!==null&&e.copyBufferToBuffer(this.queryBuf,0,r,i.ts,8*Ct),e.clearBuffer(n.cnt,4*Cn,4*(Hs-Cn)),e.clearBuffer(n.cnt,4*x.VMAXP,4*4),e.clearBuffer(n.cnt,4*x.ESC_OTHER,4*3),e.clearBuffer(n.cnt,4*x.REL_MASS,4*4),e.clearBuffer(n.cnt,4*x.BODYWORK,4*(x.CONT_FULL+1-x.BODYWORK)),e.clearBuffer(n.cnt,4*x.MELTED,4*(x.MELTFULL+1-x.MELTED)),this.busy.add(r);const c=[];for(let f=0;f<this.cpu.regions.count;f+=1){const u=n.gpuRegion(f);c.includes(u)||c.push(u)}return this.reading.set(r,{version:this.stateVersion,layout:i,regions:c,heaters:this.cpu.heat.heaters.length,groups:[...n.measGroups],nreg:n.d.nreg,nheat:n.d.nheat}),r}async finishReadback(e,t){const n=this.reading.get(e),i=()=>{this.busy.delete(e),this.reading.delete(e)};try{await e.mapAsync(GPUMapMode.READ)}catch{return i(),null}if(n===void 0||n.version!==this.stateVersion)return e.unmap(),i(),null;const r=e.getMappedRange(0,Math.ceil(n.layout.total/16)*16).slice(0);e.unmap(),i();const s=this.parse(r,n,t);return this.absorb(s),s}parse(e,t,n){const i=t.layout,r=new Uint32Array(e,i.cnt,dt),s=new Float32Array(e,i.cnt,dt),c=new Float32Array(e,i.glob,Rt),f=new Float32Array(e,i.reg,we*t.nreg),u=new Float32Array(e,i.heat,Pe*t.nheat),d=new Float32Array(e,i.meas,(i.probe-i.meas)/4),m=new Float32Array(e,i.probe,64),[_,L,v]=t.groups,A=(q,F,p)=>{let M=0;for(let g=0;g<F;g+=1)M+=d[(q+g)*Dt+p];return M},G=[];for(const q of t.regions){const F=we*q;G.push({p0:f[F+H.P0],sealed:f[F+H.OPEN]===0,vGas:f[F+H.VGAS],vFluid:f[F+H.VFLUID]})}const C=[];for(let q=0;q<t.heaters;q+=1){const F=Pe*q;C.push({P:u[F+ie.P],Tmean:u[F+ie.TMEAN],integral:u[F+ie.INTEGRAL],cells:u[F+ie.CELLS]})}let h=null;if(n&&this.queryBuf!==null){const q=new BigUint64Array(e,i.ts,Ct);h=[];for(let F=0;F<Qr;F+=1){const p=q[2*F],M=q[2*F+1];h.push(M>p&&p>0n?Number(M-p)/1e6:0)}}const b=s[x.SUM_WM],O={};for(const[q,F,p]of mi)O[q]=p==="f"?s[F]:r[F];return{intervals:O,ov:[s[x.OV_PMAX],s[x.OV_VMAX],s[x.OV_VLIQ]],pcount:r[x.PCOUNT],bcount:r[x.BCOUNT],dt:c[Lt.DT],stepsSince:r[x.STEPS],simSince:s[x.SIMTIME],itL:r[x.IT_L],itG:r[x.IT_G],itH:r[x.IT_H],itD:r[x.IT_D],capL:r[x.CAP_L],capG:r[x.CAP_G],capH:r[x.CAP_H],capD:r[x.CAP_D],resL:s[x.RES_L],resG:s[x.RES_G],resH:s[x.RES_H],nsub:r[x.NSUBMAX],uMaxG:s[x.UMAXG],waterMass:b,waterT:b>0?s[x.SUM_WMT]/b:0,waterTmax:s[x.TMAX],solids:A(0,_,0),film:A(0,_,1),gas:A(0,_,2),vapour:A(0,_,3),fog:A(0,_,4),air:A(0,_,5),liquidCells:Math.round(A(0,_,6)),gasCells:Math.round(A(0,_,7)),liquidH:A(_,L,0),liquidMass:A(_,L,1),sensible:A(_,L,3),otherMass:A(_,L,4),otherMT:A(_,L,5),saltLiquid:A(_,L,6),crust:A(0,_,8),floor:A(0,_,9),floorH:A(0,_,10),bubH:A(_+L,v,0),bubWater:A(_+L,v,1),bubAir:A(_+L,v,2),regions:G,heaters:C,watch:{found:m[31]===1,id:new Uint32Array(m.buffer,m.byteOffset+4*21,1)[0],fate:r[x.WATCH_FATE],data:new Float32Array(m)},firstSuperheat:r[x.FIRST_SH]!==0?s[x.FIRST_SH]-1e3:null,stageMs:h,vmaxP:s[x.VMAXP],rmaxB:s[x.RMAXB],slowed:r[x.SLOWED],vented:s[x.VENTED],bodies:i.nbody>0?this.state.bodies.parse(e,i.bodies,i.nbody):[],itP:r[x.IT_P],capP:r[x.CAP_P]}}absorb(e){const t=this.totals;this.last=e,e.stepsSince>0&&(this.stepped=e),e.stageMs!==null&&(this.stageMs=e.stageMs);for(const[i]of mi)t[i]+=e.intervals[i];t.time+=e.simSince,t.steps+=e.stepsSince,t.capped+=e.capL+e.capG+e.capH+e.capD,t.slowed+=e.slowed,t.vented+=e.vented;const n=(i,r,s,c,f,u)=>{if(r===0&&s===0)return i;const d=s>0?Math.ceil(i*1.5)+2:r+u;return Math.min(f,Math.max(c,i>d?Math.max(d,i-2):d))};e.stepsSince>0&&(this.itL=n(this.itL,e.itL,e.capL,4,60,1),this.itG=n(this.itG,e.itG,e.capG,4,60,2),this.itH=n(this.itH,e.itH,e.capH,3,60,1),this.itD=n(this.itD,e.itD,e.capD,3,60,1),this.nsub=e.nsub,this.bstep.adapt(e.itP,e.capP)),this.state.body&&e.bodies.length>0&&this.bstep.select(e.bodies)}stats(e){const t=this.cpu,n=t.grid,i=this.last,r=this.totals,s=this.budget(),c={heater:r.heater,lossWalls:r.lossWalls,lossOpen:r.lossOpen,escapedEnergy:r.escapedEnergy,editEnergy:t.ledger.energy,escapedWater:r.escapedWater,escapedAir:r.escapedAir,editWater:t.ledger.water,editAir:t.ledger.air,escapedOther:r.escapedOther,editOther:t.ledger.other,escapedSalt:r.escapedSalt,editSalt:t.ledger.salt,bodyWork:r.bodyWork},f=this.energy0??s.energy,u=this.water0??s.water.total,d=s.energy-f-(c.heater-c.lossWalls-c.lossOpen-c.escapedEnergy+c.editEnergy+c.bodyWork),m=s.water.total-u-c.editWater,_=s.other.total-(this.other0??s.other.total)-c.editOther,L=s.salt.total-(this.salt0??s.salt.total)-c.editSalt,v=r.produced+r.burstVapour,A=r.time-this.vapourLast;A>.2&&(this.vapourRate=(v-this.vapourMark)/A,this.vapourMark=v,this.vapourLast=r.time);const G=t.heat.heaters.map((b,O)=>({h:b,k:O,rd:i==null?void 0:i.heaters[O]})).filter(({rd:b,h:O})=>((b==null?void 0:b.cells)??O.cells)>0).map(({h:b,rd:O})=>({group:b.group,P:(O==null?void 0:O.P)??b.P,Tmean:(O==null?void 0:O.Tmean)??b.Tmean,mode:b.mode,power:b.power,target:b.target,on:b.on})),C=(b,O,q)=>({iterations:b,residual:O,capped:q>0}),h=this.stepped??i;return{time:r.time,dt:(i==null?void 0:i.dt)??t.dt,steps:r.steps,nx:n.nx,ny:n.ny,dx:n.dx,quality:t.currentQuality,particles:(i==null?void 0:i.pcount)??t.particles.count,capacity:t.particles.cap,bubbles:(i==null?void 0:i.bcount)??t.bubbles.count,liquidCells:(i==null?void 0:i.liquidCells)??0,gasCells:(i==null?void 0:i.gasCells)??0,stages:[...this.stageMs],stepMs:e,liquid:C((h==null?void 0:h.itL)??0,(h==null?void 0:h.resL)??0,(h==null?void 0:h.capL)??0),gas:C((h==null?void 0:h.itG)??0,(h==null?void 0:h.resG)??0,(h==null?void 0:h.capG)??0),heat:C((h==null?void 0:h.itH)??0,(h==null?void 0:h.resH)??0,(h==null?void 0:h.capH)??0),gasSubsteps:(h==null?void 0:h.nsub)??0,capped:r.capped,waterT:(i==null?void 0:i.waterT)??0,waterTmax:(i==null?void 0:i.waterTmax)??0,otherMass:(i==null?void 0:i.otherMass)??0,otherT:i!==null&&i.otherMass>0?i.otherMT/i.otherMass:0,saltMass:(i==null?void 0:i.saltLiquid)??0,saltSolid:((i==null?void 0:i.crust)??0)+((i==null?void 0:i.floor)??0),bodies:this.bodyCounts(),heaters:G,regions:((i==null?void 0:i.regions)??[]).map(b=>({p0:b.p0,sealed:b.sealed,vGas:b.vGas})),budget:s,flows:c,energyError:d,waterError:m,otherError:_,saltError:L,vapourRate:this.vapourRate,ambientT:t.ambientT,ambientP:t.pRef,g:t.gy,extremes:{...t.extremes.stats(),slowed:r.slowed,vented:r.vented},cpuOnly:r.contFull>0}}bodyCounts(){var s;const e=this.cpu.bodies.list,t=((s=this.last)==null?void 0:s.bodies)??[];if(!this.state.body||t.length===0)return{count:e.filter(c=>!c.gone).length,free:0,awake:0};let n=0,i=0,r=0;for(const c of t)c.gone||(n+=1,c.pinned||(i+=1,c.asleep||(r+=1)));return{count:n,free:i,awake:r}}bodySums(){var u;const e=((u=this.last)==null?void 0:u.bodies)??[];let t=0,n=0,i=0,r=0,s=0,c=0;const f=this.cpu.bodies.list;return e.forEach((d,m)=>{var _;r+=d.pm,s+=d.pH,c+=d.ps,!d.gone&&(t+=d.E+Pi(((_=f[m])==null?void 0:_.mat)??0)*d.m,n+=d.film,i+=d.crust)}),{E:t,film:n,crust:i,ice:e.length>0?Bl(this.cpu,e):0,pm:r,pH:s,ps:c}}budget(){const e=this.last,t=this.totals;let n=0;for(const L of(e==null?void 0:e.regions)??[])L.sealed&&(n-=L.p0*L.vFluid);const i=this.bodySums(),r=((e==null?void 0:e.liquidH)??0)+i.pH,s=((e==null?void 0:e.liquidMass)??0)+i.pm,c=((e==null?void 0:e.solids)??0)+((e==null?void 0:e.floorH)??0)+i.E,f=(e==null?void 0:e.gas)??0,u=(e==null?void 0:e.bubH)??0,d=((e==null?void 0:e.film)??0)+i.film,m={liquid:s,ice:i.ice,vapour:(e==null?void 0:e.vapour)??0,fog:(e==null?void 0:e.fog)??0,film:d,bubbles:(e==null?void 0:e.bubWater)??0,escaped:t.escapedWater,total:s+i.ice+((e==null?void 0:e.vapour)??0)+((e==null?void 0:e.fog)??0)+d+((e==null?void 0:e.bubWater)??0)+t.escapedWater},_=(e==null?void 0:e.otherMass)??0;return{energy:c+r+f+u+n,solids:c,liquid:r,gas:f,bubbles:u,pv:n,water:m,other:{liquid:_,escaped:t.escapedOther,total:_+t.escapedOther},salt:this.saltBudget(),air:((e==null?void 0:e.air)??0)+((e==null?void 0:e.bubAir)??0)+t.escapedAir}}saltBudget(){const e=this.last,t=this.bodySums(),n=((e==null?void 0:e.saltLiquid)??0)+t.ps,i=((e==null?void 0:e.crust)??0)+t.crust,r=(e==null?void 0:e.floor)??0,s=this.totals.escapedSalt;return{liquid:n,crust:i,grains:0,floor:r,escaped:s,total:n+i+r+s}}resetTotals(){Object.assign(this.totals,vi()),this.last=null,this.stepped=null,this.energy0=null,this.water0=null,this.other0=null,this.salt0=null,this.vapourMark=0,this.vapourLast=0,this.vapourRate=0,this.carry=null}resetBaseline(){this.energy0=null,this.water0=null,this.other0=null,this.salt0=null}carryErrors(e){this.resetBaseline(),this.carry=e}baselineFromLast(){if(this.last===null||this.energy0!==null)return;const e=this.budget(),t=this.totals,n=this.cpu,i=this.carry??{energy:0,water:0,other:0,salt:0};this.energy0=e.energy-(t.heater-t.lossWalls-t.lossOpen-t.escapedEnergy+n.ledger.energy+t.bodyWork)-i.energy,this.water0=e.water.total-n.ledger.water-i.water,this.other0=e.other.total-n.ledger.other-i.other,this.salt0=e.salt.total-n.ledger.salt-i.salt,this.carry=null}get tsatAmb(){return hn(this.cpu.regions.pAmb)}}const gi=8,Xc=3,Yc=.25,Qc=250;function Zc(){return It.prepare(bl)}class $i{constructor(e,t,n,i,r,s,c,f){o(this,"e");o(this,"charts");o(this,"seconds");o(this,"fps");o(this,"total");o(this,"chunkFrames");o(this,"keyFrames");o(this,"frames",0);o(this,"onFrame",null);o(this,"onKey",null);o(this,"lost",null);o(this,"keyStallMs",[]);o(this,"lostFrames",0);o(this,"cpuMs",0);o(this,"computeMs",0);o(this,"gpu");o(this,"capture");o(this,"gcharts");o(this,"key");o(this,"scene");o(this,"layout");o(this,"writer");o(this,"chunks",[]);o(this,"keys",[]);o(this,"samples",[]);o(this,"nextSample",0);o(this,"nextKey");o(this,"captured",1);o(this,"issued",0);o(this,"stopping",!1);o(this,"released",!1);o(this,"chain",Promise.resolve());o(this,"inflight",[]);o(this,"free",[]);o(this,"view",sn());o(this,"preview");o(this,"previewView",sn());o(this,"previewBuf",null);o(this,"previewQuads",new Uint16Array(0));o(this,"previewAt",0);this.gpu=e,this.e=t,this.charts=n,this.scene=i,this.key=r,this.seconds=s,this.fps=Math.max(1,Math.round(c)),this.chunkFrames=2*this.fps,this.keyFrames=Math.max(1,Math.round(f*this.fps)),this.total=Math.round(s*this.fps)+1,this.nextKey=this.keyFrames,this.layout=Ls(Or(t,n)),this.writer=new Tn(t.grid.nx,t.grid.ny,t.grid.dx);const u=Os(t.grid.nx,t.grid.ny,t.grid.dx,Math.max(64,Math.ceil(1.5*t.bubbles.count)));Es(t,u,null),this.writer.add(u),this.frames=1,this.preview=u,this.keys.push({frame:0,t:0,data:Lr(An(Or(t,n)))}),this.capture=new hl(e,this.fps,gi,u),this.capture.start(this.fps),this.gcharts=new _l(e);const d=e.ctx.device;d.lost.then(m=>{this.released||(this.lost=m.message||m.reason||"lost")}),d.addEventListener("uncapturederror",m=>{!this.released&&this.lost===null&&(this.lost=`WebGPU: ${m.error.message}`)})}static async create(e,t,n,i,r,s,c,f){const u=f??await Zc();let d=null;try{return d=It.on(u,e),new $i(d,e,t,n,i,r,s,c)}catch(m){throw d!==null?d.destroy():u.destroy(),m}}get time(){return this.frames>0?(this.frames-1)/this.fps:0}get done(){return this.frames>=this.total}get last(){return this.preview}stop(){this.stopping=!0}async run(e){const t=performance.now();try{for(;this.frames<this.total&&!this.stopping&&this.lost===null;){if(this.nextKey<this.total&&this.captured>this.nextKey){await this.drain(),await this.keyframe();continue}if(this.inflight.length>=Xc){await this.next(),e();continue}const n=this.room();if(n<=0&&this.inflight.length>0){await this.next(),e();continue}this.submit(Math.max(1,Math.min(gi,n)))}this.lost===null&&(await this.drain(),!this.stopping&&this.nextKey<=this.captured-1&&await this.keyframe())}catch(n){this.lost===null&&(this.lost=n instanceof Error?n.message:String(n))}this.computeMs=performance.now()-t}room(){const e=this.gpu,t=Math.fround(this.e.dtMax),n=e.totals.time+(this.issued-e.totals.steps)*t;return Math.ceil(((this.total-1)/this.fps-n)/t-1e-9)}staging(){const e=this.free.pop();return e!==void 0?e:this.gpu.ctx.device.createBuffer({label:"bake",size:Math.ceil(this.capture.batchBytes/16)*16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST})}submit(e){const t=this.gpu,n=t.ctx.device,i=this.capture,r=n.createCommandEncoder();i.begin(r);for(let d=0;d<e;d+=1)t.encodeSteps(r,1,!1),i.encode(r);const s=this.staging();i.copyOut(r,s);const c=t.encodeReadback(r,!1);n.queue.submit([r.finish()]),this.issued+=e;const f=Promise.all([c!==null?t.finishReadback(c,!1):Promise.resolve(null),s.mapAsync(GPUMapMode.READ)]),u=this.chain.then(()=>f).then(()=>this.absorb(s));this.chain=u,u.catch(()=>{}),this.inflight.push(u)}async next(){const e=this.inflight.shift();e!==void 0&&await e}async drain(){for(;this.inflight.length>0;)await this.next()}absorb(e){var s;const t=performance.now(),n=this.gpu,i=this.capture;if(n.baselineFromLast(),n.totals.time>=this.nextSample){const c=this.gcharts.sample();c!==null&&(this.samples.push(c),this.nextSample=n.totals.time+Yc)}const r=e.getMappedRange();try{const c=i.read(r);this.lostFrames=c.lost,this.captured=c.captured;for(let f=0;f<c.count;f+=1){const u=i.index(r,f);if(u!==this.frames)throw new Error(`capture: frame ${u} arrived, ${this.frames} expected`);const d=i.frame(r,f,this.view);this.writer.add(d),(s=this.onFrame)==null||s.call(this,u,d),this.frames+=1,u%Xr===0&&t-this.previewAt>=Qc&&this.keepPreview(r,f,t),this.writer.count>=this.chunkFrames&&this.flush()}}finally{e.unmap(),this.free.push(e),this.cpuMs+=performance.now()-t}}keepPreview(e,t,n){this.previewAt=n,this.previewBuf=this.capture.copyFrame(e,t,this.previewBuf);const i=this.capture.layersAt(this.previewBuf,0,4*ee,this.previewView);this.previewQuads.length<i.quads.length&&(this.previewQuads=new Uint16Array(i.quads.length)),this.previewQuads.set(i.quads),i.quads=this.previewQuads,this.preview=i}async keyframe(){const e=performance.now(),t=this.gpu,n=this.e,i=this.captured-1;await t.download(),this.gcharts.copyTo(this.charts);const r=t.stats(0),s={energy:r.energyError,water:r.waterError,other:r.otherError,salt:r.saltError};n.rebaseline(s),this.onKey!==null&&await this.onKey({frame:i,e:n,gpu:t,errors:s,probe:()=>this.capture.probe()}),this.capture.rebase(),this.keys.push({frame:i,t:i/this.fps,data:Lr(An(Or(n,this.charts)))}),this.keyStallMs.push(performance.now()-e),this.nextKey=(Math.floor(i/this.keyFrames)+1)*this.keyFrames}flush(){this.writer.count!==0&&(this.chunks.push(Lr(this.writer.finish())),this.writer=new Tn(this.e.grid.nx,this.e.grid.ny,this.e.grid.dx))}async finish(){this.flush();const e=this.gpu.ctx.adapter;if(this.release(),this.frames<2)return null;const t=await Promise.all(this.chunks),n=await Promise.all(this.keys.map(s=>s.data)),i=this.e.grid;return{header:{format:Ns,version:Rs,key:this.key,scene:this.scene,quality:this.e.currentQuality,layout:this.layout,fps:this.fps,nx:i.nx,ny:i.ny,dx:i.dx,depth:i.depth,boxW:i.w,boxH:i.h,frames:this.frames,duration:(this.frames-1)/this.fps,seconds:this.seconds,chunkFrames:this.chunkFrames,chunkBytes:t.map(s=>s.length),keyframes:this.keys.map((s,c)=>({frame:s.frame,t:s.t,bytes:n[c].length})),samples:this.samples,created:Date.now(),bakeMs:Math.round(this.computeMs),bytes:t.reduce((s,c)=>s+c.length,0)+n.reduce((s,c)=>s+c.length,0),used:Date.now(),engine:"gpu",exact:!1,adapter:e},chunks:t,keys:n}}release(){this.released||(this.released=!0,this.capture.destroy(),this.gpu.destroy())}}export{$i as GpuBaker,Zc as prepareGpu};
