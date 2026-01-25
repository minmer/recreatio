import { useEffect, useMemo, useRef, useState } from 'react';

export type IntroSlide = {
  id: string;
  title: string;
  subtitle?: string;
  body?: string;
  micro?: string;
  cta: string;
  secondary?: string;
  bullets?: string[];
  panel: { x: string; y: string; scale: string };
  theme: { bg0: string; bg1: string; bg2: string; bloom: string; sat: string };
};

type LearningNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  level: number;
  role?: 'root' | 'goal';
};

type LearningLink = {
  from: string;
  to: string;
  key: string;
};

const LEARNING_MAP = {
  width: 420,
  height: 320,
  paddingX: 28,
  paddingY: 18,
  levels: [1, 4, 6, 6, 5, 4, 4]
} as const;

const EXPLORER_TIMING = {
  moveMs: 900,
  pauseMs: 220,
  errorMs: 900
} as const;

const createLearningTree = (seed = 11) => {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const { width, height, paddingX, paddingY, levels } = LEARNING_MAP;
  const levelStep = (height - paddingY * 2) / (levels.length - 1);
  const nodes: LearningNode[] = [];
  const links: LearningLink[] = [];

  const levelNodes: LearningNode[][] = [];
  levels.forEach((count, levelIndex) => {
    const y = height - paddingY - levelIndex * levelStep;
    const spread = width - paddingX * 2;
    const row: LearningNode[] = [];
    for (let i = 0; i < count; i += 1) {
      const baseX = paddingX + ((i + 1) * spread) / (count + 1);
      const jitter = (rand() - 0.5) * 18;
      const x = Math.max(paddingX, Math.min(width - paddingX, baseX + jitter));
      const r = levelIndex === 0 ? 3 : levelIndex < 2 ? 2.1 : 1.4;
      const id = levelIndex === 0 ? 'root' : `l${levelIndex}-${i}`;
      row.push({
        id,
        x: levelIndex === 0 ? width / 2 : x,
        y,
        r,
        level: levelIndex,
        role: levelIndex === 0 ? 'root' : undefined
      });
    }
    levelNodes.push(row);
    nodes.push(...row);
  });

  const topLevel = levelNodes[levelNodes.length - 1];
  if (topLevel?.length) {
    const goal = topLevel[Math.floor(topLevel.length / 2)];
    goal.role = 'goal';
    goal.r = 2;
  }

  for (let level = 1; level < levelNodes.length; level += 1) {
    const parents = levelNodes[level - 1];
    const row = levelNodes[level];
    row.forEach((node) => {
      const sortedParents = [...parents].sort((a, b) => Math.abs(a.x - node.x) - Math.abs(b.x - node.x));
      const primary = sortedParents[0];
      const secondary = sortedParents[1] && rand() < 0.45 ? sortedParents[1] : null;
      const parentIds = secondary ? [primary, secondary] : [primary];
      parentIds.forEach((parent) => {
        links.push({ from: parent.id, to: node.id, key: `${parent.id}-${node.id}` });
      });
      if (rand() < 0.2 && sortedParents[2]) {
        links.push({ from: sortedParents[2].id, to: node.id, key: `${sortedParents[2].id}-${node.id}` });
      }
    });
  }

  const parentsById = new Map<string, string[]>();
  links.forEach((link) => {
    const list = parentsById.get(link.to) ?? [];
    list.push(link.from);
    parentsById.set(link.to, list);
  });

  const linksByFrom = new Map<string, string[]>();
  const childrenByFrom = new Map<string, string[]>();
  const neighborsById = new Map<string, string[]>();
  links.forEach((link) => {
    const list = linksByFrom.get(link.from) ?? [];
    list.push(link.key);
    linksByFrom.set(link.from, list);
    const children = childrenByFrom.get(link.from) ?? [];
    children.push(link.to);
    childrenByFrom.set(link.from, children);
    const fromNeighbors = neighborsById.get(link.from) ?? [];
    fromNeighbors.push(link.to);
    neighborsById.set(link.from, fromNeighbors);
    const toNeighbors = neighborsById.get(link.to) ?? [];
    toNeighbors.push(link.from);
    neighborsById.set(link.to, toNeighbors);
  });

  const nodesById = new Map<string, LearningNode>();
  nodes.forEach((node) => {
    nodesById.set(node.id, node);
  });

  return { nodes, links, parentsById, linksByFrom, childrenByFrom, neighborsById, nodesById };
};

export function CogitaIntroSlides({
  slides,
  activeIndex,
  introOpen,
  prefersReducedMotion,
  onNext,
  onPrev,
  onSelect,
  onExit,
  onOpen,
  onRegister
}: {
  slides: IntroSlide[];
  activeIndex: number;
  introOpen: boolean;
  prefersReducedMotion: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSelect: (index: number) => void;
  onExit: () => void;
  onOpen: () => void;
  onRegister: () => void;
}) {
  const isFinal = activeIndex === slides.length - 1;
  const logoState = introOpen && activeIndex === 0 ? 'entry' : 'docked';
  const staticSlide = slides[slides.length - 1];
  const [logoEntered, setLogoEntered] = useState(false);
  const logoLayers = useMemo(
    () =>
      Array.from({ length: 20 }, (_, idx) => {
        const num = String(idx).padStart(2, '0');
        return {
          src: `/cogita/logo/Cogita${num}.png`,
          kind: idx <= 11 ? 'bubble' : idx <= 17 ? 'text' : 'recreatio'
        } as const;
      }),
    []
  );
  const isEntry = introOpen && activeIndex === 0;
  useEffect(() => {
    if (!introOpen) {
      setLogoEntered(false);
      return;
    }
    if (activeIndex > 0 && !logoEntered) {
      setLogoEntered(true);
    }
  }, [activeIndex, introOpen, logoEntered]);
  const wheelLockRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const progressPoints = useMemo(() => {
    const start = { x: 40, y: 160 };
    const end = { x: 260, y: 48 };
    const segments = 6;
    const totalX = end.x - start.x;
    const totalY = start.y - end.y;
    const stepX = totalX / segments;
    const weights = [0.3, 0.45, 0.6, 0.65, 1.4, 2.2];
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    const stepYs = weights.map((weight) => (totalY * weight) / weightSum);
    const points = [start];
    let currentX = start.x;
    let currentY = start.y;

    for (let idx = 1; idx <= segments; idx += 1) {
      const jitterX = (Math.random() - 0.5) * 14;
      const jitterY = (Math.random() - 0.5) * 28;
      currentX = Math.max(start.x + idx * 14, Math.min(end.x - (segments - idx) * 14, currentX + stepX + jitterX));
      const segmentRise = stepYs[idx - 1] ?? stepYs[stepYs.length - 1];
      currentY = currentY - segmentRise + jitterY;
      const clampedY = Math.max(end.y, Math.min(start.y - 4, currentY));
      points.push({ x: Math.round(currentX), y: Math.round(clampedY) });
    }

    points[points.length - 1] = end;
    return points;
  }, []);
  const progressRange = useMemo(() => {
    const xMin = 40;
    const xMax = 260;
    const yMin = 40;
    const yMax = 170;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const upper = progressPoints.map((point) => {
      const delta = 10 + Math.random() * 36;
      return {
        x: clamp(point.x, xMin, xMax),
        y: clamp(point.y - delta, yMin, yMax - 30)
      };
    });
    const lower = progressPoints.map((point, idx) => {
      const delta = 12 + Math.random() * 40;
      const upperY = upper[idx]?.y ?? point.y;
      return {
        x: clamp(point.x, xMin, xMax),
        y: clamp(Math.max(upperY + 10, point.y + delta), yMin + 20, yMax)
      };
    });
    return { upper, lower };
  }, [progressPoints]);
  const rangeClipMid = useMemo(() => {
    const raw = progressPoints[4]?.x ?? 260;
    return Math.max(0, Math.min(240, raw - 40));
  }, [progressPoints]);
  const progressPeers = useMemo(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const buildPeer = (bias: number, minOffset: number, maxOffset: number) =>
      progressPoints.map((point, idx) => {
        const upper = progressRange.upper[idx]?.y ?? point.y;
        const lower = progressRange.lower[idx]?.y ?? point.y;
        const jitter = (Math.random() - 0.5) * 70;
        const target = point.y + bias + jitter;
        const minY = clamp(point.y + minOffset, upper + 6, lower - 6);
        const maxY = clamp(point.y + maxOffset, upper + 6, lower - 6);
        return {
          x: point.x,
          y: clamp(target, Math.min(minY, maxY), Math.max(minY, maxY))
        };
      });

    const higherBias = -14 + Math.random() * 28;
    const lowerBias = 14 + Math.random() * 28;
    const higher = buildPeer(higherBias, -80, 12);
    const lower = buildPeer(lowerBias, -12, 80);

    for (let idx = 4; idx < progressPoints.length; idx += 1) {
      const point = progressPoints[idx];
      const upperY = progressRange.upper[idx]?.y ?? point.y;
      const lowerY = progressRange.lower[idx]?.y ?? point.y;
      higher[idx] = {
        x: point.x,
        y: clamp(point.y - 12, upperY + 6, lowerY - 6)
      };
      lower[idx] = {
        x: point.x,
        y: clamp(point.y + 12, upperY + 6, lowerY - 6)
      };
    }

    const lastUpperY = progressRange.upper.length
      ? progressRange.upper[progressRange.upper.length - 1].y
      : 40;
    const lastLowerY = progressRange.lower.length
      ? progressRange.lower[progressRange.lower.length - 1].y
      : 170;
    higher[higher.length - 1] = {
      x: progressPoints[progressPoints.length - 1].x,
      y: clamp(progressPoints[progressPoints.length - 1].y - 14, lastUpperY, lastLowerY)
    };
    lower[lower.length - 1] = {
      x: progressPoints[progressPoints.length - 1].x,
      y: clamp(progressPoints[progressPoints.length - 1].y + 12, lastUpperY, lastLowerY)
    };

    return { higher, lower };
  }, [progressPoints, progressRange]);
  const cardCycleMs = 10000;
  const indexCards = useMemo(() => {
    let seed = 17;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const gridPositions = [
      { x: -180, y: -70 },
      { x: -60, y: -70 },
      { x: 60, y: -70 },
      { x: 180, y: -70 },
      { x: -120, y: 60 },
      { x: 0, y: 60 },
      { x: 120, y: 60 }
    ];
    return gridPositions.map((grid, index) => {
      const throwX = (rand() - 0.5) * 240;
      const throwY = (rand() - 0.5) * 180;
      const throwRot = (rand() - 0.5) * 24;
      return {
        id: `card-${index + 1}`,
        throw: { x: `${throwX.toFixed(0)}px`, y: `${throwY.toFixed(0)}px`, rot: `${throwRot.toFixed(1)}deg` },
        grid: { x: `${grid.x}px`, y: `${grid.y}px` },
        delay: `${index * 0.12}s`
      };
    });
  }, []);
  const stackTargets = useMemo(
    () => [
      { x: '-80px', y: '-120px' },
      { x: '-80px', y: '-15px' },
      { x: '-80px', y: '90px' },
      { x: '-80px', y: '195px' }
    ],
    []
  );
  const [stackOrder, setStackOrder] = useState<string[]>([]);
  const roundCards = useMemo(
    () => [
      { id: 'round-1', x: '14%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-2', x: '30%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-3', x: '46%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-4', x: '62%', y: 'calc(80% + var(--round-card-drop))' },
      { id: 'round-5', x: '78%', y: 'calc(80% + var(--round-card-drop))' }
    ],
    []
  );
  const roundPlayers = useMemo(() => {
    const count = 6;
    const positions: Array<{ x: number; y: number }> = [];
    const minDistance = 12;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const maxAttempts = 80;

    for (let i = 0; i < count; i += 1) {
      let placed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const x = rand(14, 86);
        const y = rand(10, 34);
        const ok = positions.every((p) => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.hypot(dx, dy) >= minDistance;
        });
        if (ok) {
          positions.push({ x, y });
          placed = true;
          break;
        }
      }
      if (!placed) {
        positions.push({ x: rand(16, 84), y: rand(12, 32) });
      }
    }

    return positions.map((pos, idx) => ({
      id: `p${idx + 1}`,
      x: `${pos.x.toFixed(1)}%`,
      y: `${pos.y.toFixed(1)}%`,
      xNum: pos.x,
      yNum: pos.y,
      jitterX: `${(Math.random() - 0.5) * 12}px`,
      jitterY: `${(Math.random() - 0.5) * 10}px`,
      delay: `${(Math.random() * 1.2).toFixed(2)}s`
    }));
  }, []);
  const [roundKey, setRoundKey] = useState(0);
  const [activeRoundCard, setActiveRoundCard] = useState(0);
  const [roundResults, setRoundResults] = useState<Array<'good' | 'bad'>>([]);
  const roundCycleMs = 10000;
  const roundLinks = useMemo(() => {
    if (roundPlayers.length < 2) return [];
    const seeded = (seed: number) => {
      let t = seed + 0x6d2b79f5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = (seed: number, max: number) => Math.floor(seeded(seed) * max);
    const pairs = new Set<string>();
    const links: Array<{
      id: string;
      from: typeof roundPlayers[number];
      to: typeof roundPlayers[number];
      delay: string;
    }> = [];
    const targetCount = Math.min(3, roundPlayers.length);
    let attempts = 0;
    while (links.length < targetCount && attempts < 30) {
      attempts += 1;
      const a = pick(roundKey * 13 + attempts * 5, roundPlayers.length);
      const b = pick(roundKey * 29 + attempts * 7, roundPlayers.length);
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (pairs.has(key)) continue;
      pairs.add(key);
      links.push({
        id: `link-${key}`,
        from: roundPlayers[a],
        to: roundPlayers[b],
        delay: `${(attempts * 0.35).toFixed(2)}s`
      });
    }
    return links;
  }, [roundKey, roundPlayers]);

  useEffect(() => {
    if (!introOpen || activeIndex !== 2) return;
    const pickOrder = () => {
      const ids = indexCards.map((card) => card.id);
      for (let i = ids.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      return ids.slice(0, 4);
    };
    setStackOrder(pickOrder());
    const interval = window.setInterval(() => {
      setStackOrder(pickOrder());
    }, cardCycleMs);
    return () => window.clearInterval(interval);
  }, [activeIndex, introOpen, indexCards, cardCycleMs]);

  useEffect(() => {
    if (!introOpen || activeIndex !== 3) return;
    const nextRound = () => {
      setActiveRoundCard(Math.floor(Math.random() * roundCards.length));
      setRoundResults(
        roundPlayers.map(() => (Math.random() < 0.6 ? 'good' : 'bad'))
      );
      setRoundKey((prev) => prev + 1);
    };
    nextRound();
    const interval = window.setInterval(nextRound, roundCycleMs);
    return () => window.clearInterval(interval);
  }, [activeIndex, introOpen, roundCards.length, roundPlayers, roundCycleMs]);
  const learningTree = useMemo(() => createLearningTree(11), []);
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set(['root']));
  const [errorNodes, setErrorNodes] = useState<Set<string>>(new Set());
  const [errorLinks, setErrorLinks] = useState<Set<string>>(new Set());
  const [explorer, setExplorer] = useState<{ fromId: string; toId: string; key: number }>({
    fromId: 'root',
    toId: 'root',
    key: 0
  });
  const activeNodesRef = useRef(activeNodes);
  const explorerRef = useRef('root');
  const explorerKeyRef = useRef(0);
  const moveTimerRef = useRef<number | null>(null);
  const errorTargetRef = useRef<{ fromId: string; toId: string } | null>(null);
  const recoveryStackRef = useRef<string[]>([]);

  useEffect(() => {
    activeNodesRef.current = activeNodes;
  }, [activeNodes]);
  const activeLinks = useMemo(() => {
    const next = new Set<string>();
    activeNodes.forEach((nodeId) => {
      const list = learningTree.linksByFrom.get(nodeId);
      if (!list) return;
      list.forEach((key) => next.add(key));
    });
    return next;
  }, [activeNodes, learningTree]);
  const explorerNode =
    learningTree.nodesById.get(explorer.toId) ?? learningTree.nodesById.get('root');
  const explorerLeft = explorerNode
    ? `${(explorerNode.x / LEARNING_MAP.width) * 100}%`
    : '50%';
  const explorerTop = explorerNode
    ? `${(explorerNode.y / LEARNING_MAP.height) * 100}%`
    : '90%';

  useEffect(() => {
    if (!introOpen || activeIndex !== 1 || prefersReducedMotion) return;
    const reset = () => {
      const nextActive = new Set<string>(['root']);
      setActiveNodes(nextActive);
      setErrorNodes(new Set());
      setErrorLinks(new Set());
      setExplorer({ fromId: 'root', toId: 'root', key: 0 });
      errorTargetRef.current = null;
      explorerKeyRef.current = 0;
      explorerRef.current = 'root';
      recoveryStackRef.current = [];
    };
    reset();

    const pickNextTarget = () => {
      const currentId = explorerRef.current;
      const currentActive = activeNodesRef.current;
      const children = learningTree.childrenByFrom.get(currentId) ?? [];
      const unexploredChildren = children.filter((child) => !currentActive.has(child));
      if (unexploredChildren.length) {
        return unexploredChildren[Math.floor(Math.random() * unexploredChildren.length)];
      }
      if (currentActive.size >= learningTree.nodes.length) {
        const neighbors = learningTree.neighborsById.get(currentId) ?? [];
        return neighbors.length ? neighbors[Math.floor(Math.random() * neighbors.length)] : null;
      }
      const hasUnexploredChildren = (nodeId: string) => {
        const nodeChildren = learningTree.childrenByFrom.get(nodeId) ?? [];
        return nodeChildren.some((child) => !currentActive.has(child));
      };
      const queue: string[] = [currentId];
      const visited = new Set<string>([currentId]);
      const prev = new Map<string, string>();
      let target: string | null = null;
      while (queue.length) {
        const nodeId = queue.shift();
        if (!nodeId) break;
        if (nodeId !== currentId && hasUnexploredChildren(nodeId)) {
          target = nodeId;
          break;
        }
        const neighbors = learningTree.neighborsById.get(nodeId) ?? [];
        neighbors.forEach((neighbor) => {
          if (visited.has(neighbor)) return;
          visited.add(neighbor);
          prev.set(neighbor, nodeId);
          queue.push(neighbor);
        });
      }
      if (!target) return null;
      let step = target;
      while (prev.get(step) && prev.get(step) !== currentId) {
        step = prev.get(step) ?? step;
      }
      return step;
    };

    const scheduleMove = (fromId: string, toId: string) => {
      if (fromId === toId) {
        const nextTarget = pickNextTarget();
        if (nextTarget) {
          scheduleMove(fromId, nextTarget);
        }
        return;
      }
      explorerKeyRef.current += 1;
      setExplorer({ fromId, toId, key: explorerKeyRef.current });
      explorerRef.current = toId;
      moveTimerRef.current = window.setTimeout(() => {
        const parents = learningTree.parentsById.get(toId) ?? [];
        const currentActive = activeNodesRef.current;
        const missingParents = parents.filter((parent) => !currentActive.has(parent));
        if (!missingParents.length) {
          const nextActive = new Set(currentActive);
          nextActive.add(toId);
          setActiveNodes(nextActive);
          moveTimerRef.current = window.setTimeout(() => {
            while (recoveryStackRef.current.length) {
              const target = recoveryStackRef.current[recoveryStackRef.current.length - 1];
              if (!nextActive.has(target)) {
                if (target !== toId) {
                  scheduleMove(toId, target);
                  return;
                }
                break;
              }
              recoveryStackRef.current.pop();
            }
            const nextTarget = pickNextTarget();
            if (!nextTarget) return;
            scheduleMove(toId, nextTarget);
          }, EXPLORER_TIMING.pauseMs);
          return;
        }

        const nextErrorNodes = new Set<string>([toId, ...missingParents]);
        const nextErrorLinks = new Set<string>(
          missingParents.map((parent) => `${parent}-${toId}`)
        );
        setErrorNodes(nextErrorNodes);
        setErrorLinks(nextErrorLinks);
        if (!recoveryStackRef.current.includes(toId)) {
          recoveryStackRef.current.push(toId);
        }
        const fallback = missingParents[Math.floor(Math.random() * missingParents.length)];
        errorTargetRef.current = { fromId: toId, toId: fallback };
        moveTimerRef.current = window.setTimeout(() => {
          setErrorNodes(new Set());
          setErrorLinks(new Set());
          const next = errorTargetRef.current;
          if (!next) return;
          scheduleMove(next.fromId, next.toId);
        }, EXPLORER_TIMING.errorMs);
      }, EXPLORER_TIMING.moveMs);
    };

    moveTimerRef.current = window.setTimeout(() => {
      const target = pickNextTarget();
      if (!target) return;
      scheduleMove(explorerRef.current, target);
    }, EXPLORER_TIMING.pauseMs);

    return () => {
      if (moveTimerRef.current) {
        window.clearTimeout(moveTimerRef.current);
      }
    };
  }, [activeIndex, introOpen, learningTree, prefersReducedMotion]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 520) return;
    if (Math.abs(event.deltaY) < 10) return;
    wheelLockRef.current = now;
    if (event.deltaY > 0) {
      onNext();
    } else {
      onPrev();
    }
    event.preventDefault();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!introOpen) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
    if (dy < 0) {
      onNext();
    } else {
      onPrev();
    }
  };

  return (
    <div
      className={`cogita-intro ${introOpen ? 'is-open' : 'is-closed'} ${
        prefersReducedMotion ? 'is-reduced' : ''
      } ${isFinal ? 'is-final' : ''}`}
      data-slide={activeIndex + 1}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="cogita-intro-stage">
        <div className="cogita-intro-logo" data-state={logoState} aria-hidden="true">
          <div className={`cogita-logo-layers ${isEntry && !logoEntered ? 'is-entry' : ''}`}>
            {logoLayers.map((layer, idx) => (
              <img
                key={layer.src}
                src={layer.src}
                alt=""
                className={`cogita-logo-layer ${idx === 0 ? 'is-base' : ''} ${
                  layer.kind === 'text' ? 'is-text' : layer.kind === 'recreatio' ? 'is-recreatio' : ''
                } ${layer.kind === 'bubble' ? 'is-bubble' : ''}`}
              />
            ))}
          </div>
        </div>
        {introOpen &&
          slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <section
                key={slide.id}
                className={`cogita-intro-slide slide-${index + 1} ${isActive ? 'is-active' : ''}`}
                aria-hidden={!isActive}
              >
                <div className="cogita-intro-text">
                  {slide.subtitle ? (
                    <>
                      <p className="cogita-intro-kicker">Cogita</p>
                      <h1>{slide.title}</h1>
                      <p className="cogita-intro-subtitle">{slide.subtitle}</p>
                    </>
                  ) : (
                    <>
                      <p className="cogita-intro-kicker">Cogita</p>
                      <h2>{slide.title}</h2>
                      {slide.body && (
                        <p>
                          {slide.body.split('\n').map((line, lineIndex) => (
                            <span key={String(lineIndex)}>
                              {line}
                              {lineIndex === 0 && <br />}
                            </span>
                          ))}
                        </p>
                      )}
                    </>
                  )}
                  {slide.micro && <p className="cogita-intro-micro">{slide.micro}</p>}
                  <div className="cogita-intro-actions">
                    <button
                      type="button"
                      className="cta"
                      onClick={isFinal ? onRegister : onNext}
                    >
                      {slide.cta}
                    </button>
                    {isFinal && slide.secondary && (
                      <button type="button" className="ghost" onClick={() => onSelect(0)}>
                        {slide.secondary}
                      </button>
                    )}
                  </div>
                </div>
                <div className="cogita-intro-visual" aria-hidden="true">
                  {index === 1 && (
                    <div className="cogita-learning-map">
                      <svg
                        className="learning-map-svg"
                        viewBox={`0 0 ${LEARNING_MAP.width} ${LEARNING_MAP.height}`}
                        preserveAspectRatio="none"
                      >
                        {learningTree.links.map((link) => {
                          const start = learningTree.nodesById.get(link.from);
                          const end = learningTree.nodesById.get(link.to);
                          if (!start || !end) return null;
                          const isActive = activeLinks.has(link.key);
                          const isError = errorLinks.has(link.key);
                          return (
                            <line
                              key={link.key}
                              className={`map-link ${isActive ? 'is-active' : ''} ${
                                isError ? 'is-error' : ''
                              }`}
                              x1={start.x}
                              y1={start.y}
                              x2={end.x}
                              y2={end.y}
                            />
                          );
                        })}
                        {learningTree.nodes.map((node) => {
                          const isActive = activeNodes.has(node.id);
                          const isError = errorNodes.has(node.id);
                          return (
                            <circle
                              key={node.id}
                              className={`map-node ${node.role ? `is-${node.role}` : ''} ${
                                isActive ? 'is-active' : ''
                              } ${isError ? 'is-error' : ''}`}
                              cx={node.x}
                              cy={node.y}
                              r={node.r}
                            />
                          );
                        })}
                      </svg>
                      {explorerNode && (
                        <span
                          className="map-explorer-dot"
                          style={
                            {
                              left: explorerLeft,
                              top: explorerTop,
                              '--move': `${EXPLORER_TIMING.moveMs}ms`
                            } as CSSProperties
                          }
                        />
                      )}
                    </div>
                  )}
                  {index === 2 && (
                    <div className="cogita-index-cards">
                      {indexCards.map((card) => {
                        const stackIndex = stackOrder.indexOf(card.id);
                        const stackTarget = stackIndex >= 0 ? stackTargets[stackIndex] : null;
                        const stackX = stackTarget?.x ?? '140px';
                        const stackY = stackTarget?.y ?? '140px';
                        const stackOpacity = stackIndex >= 0 ? 1 : 0;
                        return (
                          <div
                            key={card.id}
                            className="cogita-index-card"
                            style={
                              {
                                '--throw-x': card.throw.x,
                                '--throw-y': card.throw.y,
                                '--throw-rot': card.throw.rot,
                                '--grid-x': card.grid.x,
                                '--grid-y': card.grid.y,
                                '--stack-x': stackX,
                                '--stack-y': stackY,
                                '--stack-opacity': stackOpacity,
                                '--delay': card.delay
                              } as CSSProperties
                            }
                          >
                            <span className="card-title" />
                            <span className="card-line" />
                            <span className="card-line short" />
                            <span className="card-quote" />
                            <span className="card-source" />
                            <span className="card-tags">
                              <i />
                              <i />
                              <i />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {index === 3 && (
                    <div className="cogita-round-board" key={`round-${roundKey}`}>
                      <div className="round-cards">
                        {roundCards.map((card, idx) => (
                          <div
                            key={card.id}
                            className={`round-card ${idx === activeRoundCard ? 'is-active' : ''}`}
                            style={
                              {
                                '--card-x': card.x,
                                '--card-y': card.y
                              } as CSSProperties
                            }
                          >
                            <span className="card-title" />
                            <span className="card-line" />
                            <span className="card-line short" />
                          </div>
                        ))}
                        {roundCards[activeRoundCard] && (
                          <span
                            className="round-ring"
                            style={
                              {
                                '--card-x': roundCards[activeRoundCard].x,
                                '--card-y': `calc(${roundCards[activeRoundCard].y} - var(--round-card-lift))`
                              } as CSSProperties
                            }
                          />
                        )}
                      </div>
                      <div className="round-players">
                        {roundPlayers.map((player) => (
                          <span
                            key={player.id}
                            className="player-dot"
                            style={
                              {
                                left: player.x,
                                top: player.y,
                                '--jitter-x': player.jitterX,
                                '--jitter-y': player.jitterY,
                                '--breath-delay': player.delay
                              } as CSSProperties
                            }
                          />
                        ))}
                      </div>
                      <svg className="round-link-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {roundLinks.map((link) => (
                          <line
                            key={link.id}
                            className="round-link"
                            x1={link.from.xNum}
                            y1={link.from.yNum}
                            x2={link.to.xNum}
                            y2={link.to.yNum}
                            style={{ '--delay': link.delay } as CSSProperties}
                          />
                        ))}
                      </svg>
                      <div className="round-flows">
                        {roundPlayers.map((player, idx) => {
                          const result = roundResults[idx] ?? 'good';
                          const active = roundCards[activeRoundCard];
                          if (!active) return null;
                          const activeLiftedY = `calc(${active.y} - var(--round-card-lift))`;
                          return (
                            <div key={`${player.id}-${roundKey}`} className="round-flow">
                              <span
                                className="flow-dot"
                                style={
                                  {
                                    '--from-x': player.x,
                                    '--from-y': player.y,
                                    '--to-x': active.x,
                                    '--to-y': activeLiftedY,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                              <span
                                className={`return-dot is-${result}`}
                                style={
                                  {
                                    '--from-x': active.x,
                                    '--from-y': activeLiftedY,
                                    '--to-x': player.x,
                                    '--to-y': player.y,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                              <span
                                className={`result-pop is-${result}`}
                                style={
                                  {
                                    '--at-x': player.x,
                                    '--at-y': player.y,
                                    '--delay': `${idx * 0.12}s`
                                  } as CSSProperties
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {index === 4 && (
                    <div className="cogita-progress-story">
                      <div className="progress-chart progress-chart--steps">
                        <div className="progress-chart-content">
                          <svg
                            className="progress-svg"
                            viewBox="0 0 300 200"
                            preserveAspectRatio="none"
                            role="presentation"
                          >
                            <g className="chart-grid">
                              <line x1="40" y1="30" x2="40" y2="170" />
                              <line x1="75" y1="30" x2="75" y2="170" />
                              <line x1="110" y1="30" x2="110" y2="170" />
                              <line x1="145" y1="30" x2="145" y2="170" />
                              <line x1="180" y1="30" x2="180" y2="170" />
                              <line x1="215" y1="30" x2="215" y2="170" />
                              <line x1="250" y1="30" x2="250" y2="170" />
                              <line x1="40" y1="170" x2="260" y2="170" />
                              <line x1="40" y1="150" x2="260" y2="150" />
                              <line x1="40" y1="130" x2="260" y2="130" />
                              <line x1="40" y1="110" x2="260" y2="110" />
                              <line x1="40" y1="90" x2="260" y2="90" />
                              <line x1="40" y1="70" x2="260" y2="70" />
                              <line x1="40" y1="50" x2="260" y2="50" />
                            </g>
                            <g className="chart-axes">
                              <line x1="40" y1="170" x2="260" y2="170" />
                              <line x1="40" y1="170" x2="40" y2="30" />
                            </g>
                            <g className="chart-paths">
                              <path
                                className="chart-seg seg-1"
                                d={`M${progressPoints[0].x} ${progressPoints[0].y} L${progressPoints[1].x} ${progressPoints[1].y}`}
                                pathLength="100"
                              />
                              <path
                                className="chart-seg seg-2"
                                d={`M${progressPoints[1].x} ${progressPoints[1].y} L${progressPoints[2].x} ${progressPoints[2].y}`}
                                pathLength="100"
                              />
                              <path
                                className="chart-seg seg-3"
                                d={`M${progressPoints[2].x} ${progressPoints[2].y} L${progressPoints[3].x} ${progressPoints[3].y}`}
                                pathLength="100"
                              />
                            <path
                              className="chart-seg seg-4"
                              d={`M${progressPoints[3].x} ${progressPoints[3].y} L${progressPoints[4].x} ${progressPoints[4].y}`}
                              pathLength="100"
                            />
                            <path
                              className="chart-seg seg-5"
                              d={`M${progressPoints[4].x} ${progressPoints[4].y} L${progressPoints[5].x} ${progressPoints[5].y}`}
                              pathLength="100"
                            />
                            <path
                              className="chart-seg seg-6"
                              d={`M${progressPoints[5].x} ${progressPoints[5].y} L${progressPoints[6].x} ${progressPoints[6].y}`}
                              pathLength="100"
                            />
                          </g>
                            <defs>
                              <clipPath id="chart-range-clip" clipPathUnits="userSpaceOnUse">
                                <rect x="40" y="30" width="0" height="140">
                                  <animate
                                    attributeName="width"
                                    dur="24s"
                                    begin="0s"
                                    repeatCount="indefinite"
                                    values={`0;0;${rangeClipMid};${rangeClipMid};240;240`}
                                    keyTimes="0;0.25;0.3125;0.75;0.9167;1"
                                    calcMode="linear"
                                  />
                                </rect>
                              </clipPath>
                            </defs>
                            <g className="chart-range" clipPath="url(#chart-range-clip)">
                              <animate
                                attributeName="opacity"
                                dur="24s"
                                begin="0s"
                                repeatCount="indefinite"
                                values="0;0;0.9;0.7;0.7"
                                keyTimes="0;0.1667;0.2917;0.6;1"
                                calcMode="linear"
                              />
                              <path
                                className="chart-range-fill"
                                d={`${progressRange.upper
                                  .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
                                  .join(' ')} ${progressRange.lower
                                  .slice()
                                  .reverse()
                                  .map((point) => `L${point.x} ${point.y}`)
                                  .join(' ')} Z`}
                              />
                              <path
                                className="chart-range-line range-top"
                                d={`${progressRange.upper
                                  .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
                                  .join(' ')}`}
                              />
                              <path
                                className="chart-range-line range-bottom"
                                d={`${progressRange.lower
                                  .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
                                  .join(' ')}`}
                              />
                            </g>
                            <g className="chart-peers">
                            {progressPeers.higher.slice(0, 6).map((point, idx) => (
                              <path
                                key={`peer-1-${idx}`}
                                className={`chart-peer-seg peer-1 seg-${idx + 1}`}
                                d={`M${point.x} ${point.y} L${progressPeers.higher[idx + 1].x} ${progressPeers.higher[idx + 1].y}`}
                                pathLength="100"
                              />
                            ))}
                            {progressPeers.lower.slice(0, 6).map((point, idx) => (
                              <path
                                key={`peer-2-${idx}`}
                                className={`chart-peer-seg peer-2 seg-${idx + 1}`}
                                d={`M${point.x} ${point.y} L${progressPeers.lower[idx + 1].x} ${progressPeers.lower[idx + 1].y}`}
                                pathLength="100"
                              />
                            ))}
                            </g>
                          </svg>
                          <span className="chart-orbit" aria-hidden="true">
                            <span className="chart-orbit-ring" />
                          <span className="chart-orbit-triangle">
                            <svg viewBox="0 0 100 100" role="presentation">
                              <polygon points="100 50 25 93.3 25 6.7" />
                            </svg>
                          </span>
                          <span className="chart-orbit-triangle accent fast">
                            <svg viewBox="0 0 100 100" role="presentation">
                              <polygon points="100 50 25 93.3 25 6.7" />
                            </svg>
                          </span>
                          <span className="chart-orbit-triangle accent slow">
                            <svg viewBox="0 0 100 100" role="presentation">
                              <polygon points="100 50 25 93.3 25 6.7" />
                            </svg>
                          </span>
                        </span>
                          <span
                            className="chart-dot-step"
                            style={
                              {
                                '--p0x': `${(progressPoints[0].x / 300) * 100}%`,
                                '--p0y': `${(progressPoints[0].y / 200) * 100}%`,
                                '--p1x': `${(progressPoints[1].x / 300) * 100}%`,
                                '--p1y': `${(progressPoints[1].y / 200) * 100}%`,
                                '--p2x': `${(progressPoints[2].x / 300) * 100}%`,
                                '--p2y': `${(progressPoints[2].y / 200) * 100}%`,
                              '--p3x': `${(progressPoints[3].x / 300) * 100}%`,
                              '--p3y': `${(progressPoints[3].y / 200) * 100}%`,
                              '--p4x': `${(progressPoints[4].x / 300) * 100}%`,
                              '--p4y': `${(progressPoints[4].y / 200) * 100}%`,
                              '--p5x': `${(progressPoints[5].x / 300) * 100}%`,
                              '--p5y': `${(progressPoints[5].y / 200) * 100}%`,
                              '--p6x': `${(progressPoints[6].x / 300) * 100}%`,
                              '--p6y': `${(progressPoints[6].y / 200) * 100}%`
                            } as CSSProperties
                          }
                        />
                          <span
                            className="chart-dot-peer dot-peer-1"
                            style={
                              {
                                '--q0x': `${(progressPeers.higher[0].x / 300) * 100}%`,
                                '--q0y': `${(progressPeers.higher[0].y / 200) * 100}%`,
                                '--q1x': `${(progressPeers.higher[1].x / 300) * 100}%`,
                                '--q1y': `${(progressPeers.higher[1].y / 200) * 100}%`,
                                '--q2x': `${(progressPeers.higher[2].x / 300) * 100}%`,
                                '--q2y': `${(progressPeers.higher[2].y / 200) * 100}%`,
                              '--q3x': `${(progressPeers.higher[3].x / 300) * 100}%`,
                              '--q3y': `${(progressPeers.higher[3].y / 200) * 100}%`,
                              '--q4x': `${(progressPeers.higher[4].x / 300) * 100}%`,
                              '--q4y': `${(progressPeers.higher[4].y / 200) * 100}%`,
                              '--q5x': `${(progressPeers.higher[5].x / 300) * 100}%`,
                              '--q5y': `${(progressPeers.higher[5].y / 200) * 100}%`,
                              '--q6x': `${(progressPeers.higher[6].x / 300) * 100}%`,
                              '--q6y': `${(progressPeers.higher[6].y / 200) * 100}%`
                            } as CSSProperties
                          }
                        />
                          <span
                            className="chart-dot-peer dot-peer-2"
                            style={
                              {
                                '--q0x': `${(progressPeers.lower[0].x / 300) * 100}%`,
                                '--q0y': `${(progressPeers.lower[0].y / 200) * 100}%`,
                                '--q1x': `${(progressPeers.lower[1].x / 300) * 100}%`,
                                '--q1y': `${(progressPeers.lower[1].y / 200) * 100}%`,
                                '--q2x': `${(progressPeers.lower[2].x / 300) * 100}%`,
                                '--q2y': `${(progressPeers.lower[2].y / 200) * 100}%`,
                              '--q3x': `${(progressPeers.lower[3].x / 300) * 100}%`,
                              '--q3y': `${(progressPeers.lower[3].y / 200) * 100}%`,
                              '--q4x': `${(progressPeers.lower[4].x / 300) * 100}%`,
                              '--q4y': `${(progressPeers.lower[4].y / 200) * 100}%`,
                              '--q5x': `${(progressPeers.lower[5].x / 300) * 100}%`,
                              '--q5y': `${(progressPeers.lower[5].y / 200) * 100}%`,
                              '--q6x': `${(progressPeers.lower[6].x / 300) * 100}%`,
                              '--q6y': `${(progressPeers.lower[6].y / 200) * 100}%`
                            } as CSSProperties
                          }
                        />
                        </div>
                      </div>
                    </div>
                  )}
                  {index === 5 && (
                    <div className="cogita-shield">
                      <svg viewBox="0 0 120 140" role="presentation">
                        <path
                          d="M60 10l42 16v44c0 30-19 54-42 62C37 124 18 100 18 70V26z"
                          fill="none"
                        />
                        <path d="M44 66l10 12 22-26" fill="none" />
                      </svg>
                      <span className="cogita-shield-glow" />
                    </div>
                  )}
                  {index === 6 && <div className="cogita-final-glow" />}
                </div>
              </section>
            );
          })}
        {!introOpen && (
          <section className="cogita-intro-static">
            <div className="cogita-intro-text">
              <p className="cogita-intro-kicker">Cogita</p>
              <h2>{staticSlide.title}</h2>
              {staticSlide.body && <p>{staticSlide.body}</p>}
              {staticSlide.micro && <p className="cogita-intro-micro">{staticSlide.micro}</p>}
              <div className="cogita-intro-actions">
                <button type="button" className="cta" onClick={onRegister}>
                  {staticSlide.cta}
                </button>
                <button type="button" className="ghost" onClick={onOpen}>
                  Otwórz pokaz
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
      {introOpen && (
        <>
          <div className="cogita-intro-dots" aria-label="Nawigacja slajdów">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`dot ${activeIndex === index ? 'active' : ''}`}
                aria-label={slide.title}
                onClick={() => onSelect(index)}
              />
            ))}
          </div>
          <button type="button" className="cogita-intro-skip" onClick={onExit}>
            Pomiń
          </button>
        </>
      )}
    </div>
  );
}
