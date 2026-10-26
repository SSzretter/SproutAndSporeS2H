import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Vec3 } from './coords';

/**
 * World-anchored DOM labels (tent names, doors, harvest badges, floating action text).
 *
 * Labels are ordinary DOM in the app's own React tree, positioned every frame by projecting
 * their 3D anchor to the screen. (drei's <Html> mounts a separate React root per label, which
 * React 19 errors on when the canvas unmounts.)
 */

export type LabelVariant = 'tent' | 'tentActive' | 'door' | 'badge' | 'float' | 'issueCritical' | 'issueWarning';

export interface WorldLabel {
  id: string;
  position: Vec3;
  text: string;
  variant: LabelVariant;
  color?: string; // float labels
  stats?: LabelStat[]; // live readings shown under a tent's name
}

export interface LabelStat {
  icon: string;
  value: string;
  className?: string; // e.g. a VPD-zone colour
}

export type LabelRegistry = React.MutableRefObject<Map<string, HTMLDivElement>>;

// Vertical gap left between labels that had to be stacked to avoid overlapping
const LABEL_GAP_PX = 3;

/** Lives inside the <Canvas>: projects each label's anchor and moves its DOM element. */
export function LabelProjector({ labels, registry }: { labels: WorldLabel[]; registry: LabelRegistry }) {
  const { camera, size } = useThree();
  const v = useRef(new THREE.Vector3());

  useFrame(() => {
    // Screen boxes of labels already placed this frame; later labels that would overlap one are
    // nudged upward so neighbouring badges (e.g. two plants side by side) stay readable.
    // Floating action text is exempt: it's brief and animates on its own.
    const placed: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    for (const label of labels) {
      const el = registry.current.get(label.id);
      if (!el) continue;
      v.current.set(label.position[0], label.position[1], label.position[2]).project(camera);
      const visible = v.current.z < 1 && Math.abs(v.current.x) < 1.2 && Math.abs(v.current.y) < 1.2;
      el.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const x = (v.current.x * 0.5 + 0.5) * size.width;
      let y = (-v.current.y * 0.5 + 0.5) * size.height;
      if (label.variant !== 'float') {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        for (let guard = 0; guard < 8; guard++) {
          const box = { left: x - w / 2, right: x + w / 2, top: y - h, bottom: y };
          const hit = placed.find(p => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top);
          if (!hit) break;
          y = hit.top - LABEL_GAP_PX; // sit just above the label it collided with
        }
        placed.push({ left: x - w / 2, right: x + w / 2, top: y - h, bottom: y });
      }
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    }
  });

  return null;
}

const VARIANT_CLASSES: Record<LabelVariant, string> = {
  tent: 'px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap bg-zinc-900/85 border-zinc-700 text-zinc-200',
  tentActive: 'px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap bg-emerald-950/90 border-emerald-600 text-emerald-200',
  door: 'px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap bg-zinc-900/90 border-zinc-700 text-zinc-100',
  badge: 'w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-bold flex items-center justify-center shadow-lg animate-bounce',
  issueCritical: 'px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap bg-rose-600/95 border-rose-300 text-white shadow-lg animate-pulse',
  issueWarning: 'px-1.5 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap bg-amber-400/95 border-amber-200 text-zinc-950 shadow-lg',
  float: 'text-xs font-bold whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
};

/** Floating action text rises and fades out over 2s after it appears. */
function FloatText({ text, color }: { text: string; color?: string }) {
  const [risen, setRisen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRisen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={VARIANT_CLASSES.float}
      style={{
        color,
        transform: `translateY(${risen ? -40 : 0}px)`,
        opacity: risen ? 0 : 1,
        transition: 'transform 2s ease-out, opacity 2s ease-in'
      }}
    >
      {text}
    </div>
  );
}

/** Lives outside the <Canvas>, over it: the label DOM elements themselves. */
export function LabelLayer({ labels, registry }: { labels: WorldLabel[]; registry: LabelRegistry }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {labels.map(label => (
        <div
          key={label.id}
          ref={el => {
            if (el) registry.current.set(label.id, el);
            else registry.current.delete(label.id);
          }}
          className="absolute top-0 left-0"
          style={{ display: 'none', zIndex: label.variant === 'float' ? 20 : 10 }}
        >
          {label.variant === 'float' ? (
            <FloatText text={label.text} color={label.color} />
          ) : label.stats ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className={VARIANT_CLASSES[label.variant]}>{label.text}</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 px-2 py-1 rounded-md bg-zinc-950/85 border border-zinc-700/80 text-[10px] font-mono leading-tight shadow-lg">
                {label.stats.map(stat => (
                  <span key={stat.icon} className={`whitespace-nowrap ${stat.className ?? 'text-zinc-200'}`}>
                    {stat.icon} {stat.value}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className={VARIANT_CLASSES[label.variant]}>{label.text}</div>
          )}
        </div>
      ))}
    </div>
  );
}
