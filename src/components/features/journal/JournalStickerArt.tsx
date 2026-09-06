import { useId, type ReactElement, type ReactNode } from 'react'

/**
 * Hand-drawn multi-color sticker artwork, flat scrapbook style.
 * Every sticker paints its main shapes with `currentColor` and derives
 * shades via color-mix, so the per-item color picker keeps working;
 * only tiny accent details (carrot noses, clouds, ribbons) use fixed hues.
 * The optional die-cut outline is a true vector outline (feMorphology
 * dilation of the silhouette), so it scales with the sticker.
 */

const SHADE = 'color-mix(in srgb, currentColor 72%, #40364f)'
const DEEP = 'color-mix(in srgb, currentColor 52%, #40364f)'
const SOFT = 'color-mix(in srgb, currentColor 55%, #ffffff)'
const PALE = 'color-mix(in srgb, currentColor 28%, #ffffff)'
const INK = '#57494a'
const WHITE = '#ffffff'

export interface JournalStickerArtProps {
  icon: string
  size?: number | string
  color?: string
  outline?: boolean
}

export function JournalStickerArt({ icon, size = 44, color = '#d9c4ff', outline = false }: JournalStickerArtProps) {
  const Art = STICKER_ART[icon] || SparkleArt
  return (
    <StickerSvg size={size} color={color} outline={outline}>
      <Art />
    </StickerSvg>
  )
}

function StickerSvg({ size, color, outline, children }: { size: number | string; color: string; outline: boolean; children: ReactNode }) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '')
  const filterId = `osn-ol-${rawId}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" style={{ color, display: 'block' }} aria-hidden>
      {outline && (
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="dilate" />
          <feFlood floodColor={WHITE} />
          <feComposite in2="dilate" operator="in" result="outlineShape" />
          <feMerge>
            <feMergeNode in="outlineShape" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
      <g filter={outline ? `url(#${filterId})` : undefined}>{children}</g>
    </svg>
  )
}

function HeartArt() {
  return (
    <>
      <path d="M32 55 C19 45 9 36 9 25 C9 15 16 9 24 9 C28 9 31 11 32 14 C33 11 36 9 40 9 C48 9 55 15 55 25 C55 36 45 45 32 55 Z" fill="currentColor" />
      <path d="M32 55 C45 45 55 36 55 25 C55 22 54 19 52 17 C53 33 40 44 29 52 Z" fill={SHADE} opacity={0.5} />
      <ellipse cx={21} cy={18} rx={6} ry={4} transform="rotate(-24 21 18)" fill={WHITE} opacity={0.65} />
      <circle cx={47} cy={16} r={2} fill={WHITE} opacity={0.8} />
    </>
  )
}

function StarArt() {
  return (
    <>
      <path
        d="M32 9 L37.6 25.2 L54.8 25.6 L41.1 36 L46.1 52.4 L32 42.6 L17.9 52.4 L22.9 36 L9.2 25.6 L26.4 25.2 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M32 12 L36.5 25 L32 31 L27.5 25 Z" fill={SOFT} opacity={0.8} />
      <path d="M41.1 36 L46.1 52.4 L32 42.6 Z" fill={SHADE} opacity={0.35} />
      <circle cx={25} cy={19} r={2.4} fill={WHITE} opacity={0.8} />
    </>
  )
}

function SparkleArt() {
  return (
    <>
      <path d="M32 8 C33.5 23 41 30.5 56 32 C41 33.5 33.5 41 32 56 C30.5 41 23 33.5 8 32 C23 30.5 30.5 23 32 8 Z" fill="currentColor" />
      <path d="M32 16 C33 26 38 31 48 32 C38 33 33 38 32 48 C31 38 26 33 16 32 C26 31 31 26 32 16 Z" fill={SOFT} opacity={0.7} />
      <path d="M48 6 C48.7 12.5 51.5 15.3 58 16 C51.5 16.7 48.7 19.5 48 26 C47.3 19.5 44.5 16.7 38 16 C44.5 15.3 47.3 12.5 48 6 Z" fill={PALE} />
      <circle cx={14} cy={48} r={2.2} fill={SOFT} />
      <circle cx={52} cy={50} r={1.8} fill={SOFT} />
    </>
  )
}

function FlowerArt() {
  const petals: [number, number][] = [[32, 18], [43.4, 26.3], [39, 39.7], [25, 39.7], [20.6, 26.3]]
  return (
    <>
      <path d="M32 44 C28 50 30 56 36 57 C40 53 38 46 32 44 Z" fill="#8fce8f" />
      {petals.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={9.5} fill="currentColor" />
      ))}
      {petals.map(([cx, cy]) => (
        <circle key={`i-${cx}-${cy}`} cx={cx} cy={cy} r={4.5} fill={SOFT} opacity={0.6} />
      ))}
      <circle cx={32} cy={30} r={6.5} fill="#ffd97a" />
      <circle cx={32} cy={30} r={2.5} fill={WHITE} opacity={0.7} />
    </>
  )
}

function MusicArt() {
  return (
    <>
      <rect x={25.5} y={16} width={3.4} height={29} rx={1.5} fill="currentColor" />
      <rect x={46} y={20} width={3.4} height={26} rx={1.5} fill="currentColor" />
      <path d="M25.5 15 L49.4 20.5 L49.4 27 L25.5 21.5 Z" fill={SHADE} />
      <path d="M25.5 15 L49.4 20.5 L49.4 23.5 L25.5 18 Z" fill="currentColor" />
      <ellipse cx={21} cy={46} rx={7} ry={5.4} transform="rotate(-18 21 46)" fill="currentColor" />
      <ellipse cx={41.5} cy={47.5} rx={7} ry={5.4} transform="rotate(-18 41.5 47.5)" fill="currentColor" />
      <ellipse cx={21} cy={48} rx={7} ry={3} transform="rotate(-18 21 48)" fill={SHADE} opacity={0.4} />
      <ellipse cx={41.5} cy={49.5} rx={7} ry={3} transform="rotate(-18 41.5 49.5)" fill={SHADE} opacity={0.4} />
      <circle cx={18.5} cy={43.5} r={1.8} fill={WHITE} opacity={0.8} />
      <circle cx={39} cy={45} r={1.8} fill={WHITE} opacity={0.8} />
    </>
  )
}

function CameraArt() {
  return (
    <>
      <rect x={25} y={14} width={14} height={8} rx={3} fill="currentColor" />
      <rect x={8} y={20} width={48} height={30} rx={8} fill="currentColor" />
      <path d="M8 42 H56 V44 C56 47.5 53 50 48 50 H16 C11 50 8 47.5 8 44 Z" fill={SHADE} opacity={0.5} />
      <circle cx={32} cy={35} r={11} fill={DEEP} />
      <circle cx={32} cy={35} r={7} fill={PALE} />
      <circle cx={32} cy={35} r={4.5} fill="#7fb6d9" />
      <circle cx={29.5} cy={32.5} r={1.8} fill={WHITE} opacity={0.9} />
      <rect x={45} y={25} width={6} height={4} rx={1.5} fill={PALE} />
      <circle cx={16} cy={26} r={2.2} fill={SHADE} />
    </>
  )
}

function HeadphonesArt() {
  return (
    <>
      <path d="M13 40 C13 20 51 20 51 40" stroke="currentColor" strokeWidth={7} strokeLinecap="round" />
      <path d="M17 38 C17 25 47 25 47 38" stroke={SOFT} strokeWidth={2.5} strokeLinecap="round" opacity={0.7} />
      <path d="M22 22 C26 18 32 16 36 16.5" stroke={WHITE} strokeWidth={2} strokeLinecap="round" opacity={0.5} />
      <rect x={8} y={34} width={13} height={19} rx={6} fill="currentColor" />
      <rect x={43} y={34} width={13} height={19} rx={6} fill="currentColor" />
      <rect x={12} y={38} width={5} height={11} rx={2.5} fill={DEEP} />
      <rect x={47} y={38} width={5} height={11} rx={2.5} fill={DEEP} />
      <circle cx={13} cy={36} r={1.6} fill={WHITE} opacity={0.7} />
    </>
  )
}

function MonitorArt() {
  return (
    <>
      <rect x={8} y={12} width={48} height={33} rx={6} fill="currentColor" />
      <rect x={12.5} y={16.5} width={39} height={24} rx={3.5} fill={PALE} />
      <path d="M28 24 L40 28.5 L28 33 Z" fill="currentColor" />
      <path d="M14 38 L26 17 L31 17 L19 38 Z" fill={WHITE} opacity={0.35} />
      <path d="M29 45 L35 45 L37 52 L27 52 Z" fill={SHADE} />
      <rect x={20} y={51} width={24} height={4.5} rx={2.2} fill={DEEP} />
      <circle cx={32} cy={43} r={1.2} fill={PALE} />
    </>
  )
}

function GamepadArt() {
  return (
    <>
      <path
        d="M11 24 C15 19 21 17 32 17 C43 17 49 19 53 24 C56 28 57 36 56 42 C55 47 50 49 46 45 C43 42 41 39 32 39 C23 39 21 42 18 45 C14 49 9 47 8 42 C7 36 8 28 11 24 Z"
        fill="currentColor"
      />
      <path d="M11 24 C15 19 21 17 32 17 C43 17 49 19 53 24 C54 25 54.5 26.5 55 28 C45 23 19 23 9 28 C9.5 26.5 10 25 11 24 Z" fill={SOFT} opacity={0.6} />
      <rect x={16} y={28} width={12} height={4.4} rx={1.5} fill={DEEP} />
      <rect x={19.8} y={24.2} width={4.4} height={12} rx={1.5} fill={DEEP} />
      <circle cx={44} cy={26} r={2.6} fill="#ffd97a" />
      <circle cx={49} cy={30.5} r={2.6} fill="#f28ba8" />
      <circle cx={44} cy={35} r={2.6} fill="#8fce8f" />
      <circle cx={39} cy={30.5} r={2.6} fill="#9fc9f0" />
      <circle cx={32} cy={26} r={1.8} fill={DEEP} />
    </>
  )
}

function SakuraArt() {
  const angles = [0, 72, 144, 216, 288]
  return (
    <>
      {angles.map((angle) => (
        <g key={angle} transform={`rotate(${angle} 32 33)`}>
          <path
            d="M32 35 C24 29 22.5 17 29 10.5 C31 8.6 32.6 10.4 32 13 C31.4 10.4 33 8.6 35 10.5 C41.5 17 40 29 32 35 Z"
            fill="currentColor"
          />
          <path d="M32 32 L32 16" stroke={SHADE} strokeWidth={1.4} opacity={0.5} strokeLinecap="round" />
        </g>
      ))}
      <circle cx={32} cy={33} r={4.5} fill="#ffd97a" />
      {[[32, 26.2], [38.5, 30.9], [36, 38.5], [28, 38.5], [25.5, 30.9]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.3} fill="#f5b84f" />
      ))}
    </>
  )
}

function StrawHatArt() {
  return (
    <>
      <ellipse cx={32} cy={43} rx={26} ry={8.5} fill="currentColor" />
      <path d="M18 41 C18 27 25 18 32 18 C39 18 46 27 46 41 C40 44 24 44 18 41 Z" fill={SOFT} />
      <path d="M39 20 C44 26 46.5 33 46 41 C43 42.5 40 43 37 43.2 C41 36 41 27 37 21 Z" fill="currentColor" opacity={0.35} />
      <path d="M18.5 37 C24 40 40 40 45.5 37 L45.5 33 C40 36 24 36 18.5 33 Z" fill="#e985a6" />
      <ellipse cx={32} cy={42} rx={19} ry={5.8} stroke={SHADE} strokeWidth={1.2} opacity={0.4} strokeDasharray="3 3" />
    </>
  )
}

function MapleLeafArt() {
  return (
    <>
      <path
        d="M32 6 L37 15 L44 11 L41 21 L50 20 L45 28 L53 32 L45 35 L48 43 L38 41 L34 47 L34 50 L30 50 L30 47 L26 41 L16 43 L19 35 L11 32 L19 28 L14 20 L23 21 L20 11 L27 15 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <path d="M32 47 L32 12 M32 40 L22 18 M32 40 L42 18 M32 42 L18 34 M32 42 L46 34" stroke={SHADE} strokeWidth={1.5} opacity={0.5} strokeLinecap="round" />
      <rect x={30.4} y={47} width={3.2} height={10} rx={1.6} fill={DEEP} />
    </>
  )
}

function SnowmanArt() {
  return (
    <>
      <path d="M19 44 L10 38 M10 38 L12 34 M10 38 L7 39" stroke="#9a7855" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M45 44 L54 38 M54 38 L52 34 M54 38 L57 39" stroke="#9a7855" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={32} cy={46} r={13.5} fill="#fdfefe" stroke="#cfe3ef" strokeWidth={1.4} />
      <path d="M20 52 C24 58 40 58 44 52 C40 56 24 56 20 52 Z" fill="#dcebf4" />
      <circle cx={32} cy={25} r={10.5} fill="#fdfefe" stroke="#cfe3ef" strokeWidth={1.4} />
      <rect x={22} y={15.5} width={20} height={3} rx={1.5} fill={DEEP} />
      <rect x={25} y={9} width={14} height={7} rx={2} fill={DEEP} />
      <rect x={25} y={13.5} width={14} height={2} fill={SOFT} />
      <circle cx={28} cy={23} r={1.7} fill={INK} />
      <circle cx={36} cy={23} r={1.7} fill={INK} />
      <path d="M32 26 L41 28 L32 30 Z" fill="#f08c3c" />
      {[[27, 29.5], [29.5, 31], [34.5, 31], [37, 29.5]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={0.9} fill={INK} />
      ))}
      <path d="M22.5 32 C27 35.5 37 35.5 41.5 32 L41.5 36.5 C37 40 27 40 22.5 36.5 Z" fill="currentColor" />
      <rect x={37} y={36} width={5} height={9} rx={2} transform="rotate(-14 37 36)" fill="currentColor" />
      <circle cx={32} cy={42} r={1.9} fill={INK} />
      <circle cx={32} cy={49} r={1.9} fill={INK} />
    </>
  )
}

function RainbowArt() {
  return (
    <>
      <path d="M9 47 A23 23 0 0 1 55 47" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
      <path d="M14.5 47 A17.5 17.5 0 0 1 49.5 47" stroke={SOFT} strokeWidth={5} strokeLinecap="round" />
      <path d="M20 47 A12 12 0 0 1 44 47" stroke={PALE} strokeWidth={5} strokeLinecap="round" />
      <g fill={WHITE} stroke="#dbe9f2" strokeWidth={1.2}>
        <circle cx={12} cy={47} r={5} />
        <circle cx={18} cy={44} r={6} />
        <circle cx={24} cy={48} r={4.5} />
        <circle cx={52} cy={47} r={5} />
        <circle cx={46} cy={44} r={6} />
        <circle cx={40} cy={48} r={4.5} />
      </g>
      <circle cx={32} cy={22} r={1.6} fill="currentColor" opacity={0.6} />
      <circle cx={44} cy={26} r={1.3} fill="currentColor" opacity={0.5} />
    </>
  )
}

function AstronautArt() {
  return (
    <>
      <rect x={44} y={34} width={8} height={17} rx={3.5} fill={SOFT} />
      <circle cx={48} cy={39} r={1.6} fill={SHADE} />
      <circle cx={32} cy={29} r={16.5} fill="#fdfdfe" stroke="#d8e4ee" strokeWidth={1.6} />
      <path d="M21 25 C21 20 26 17 32 17 C38 17 43 20 43 25 C43 30 38 33 32 33 C26 33 21 30 21 25 Z" fill="#41557a" />
      <path d="M25 21 C27 19 30 18.5 32 18.7" stroke={WHITE} strokeWidth={1.8} strokeLinecap="round" opacity={0.8} />
      <rect x={26} y={39.5} width={12} height={4} rx={2} fill="currentColor" />
      <rect x={19} y={42} width={26} height={15} rx={6} fill="#fdfdfe" stroke="#d8e4ee" strokeWidth={1.6} />
      <rect x={26} y={46} width={12} height={7} rx={2} fill={PALE} />
      <circle cx={29.5} cy={49.5} r={1.3} fill="currentColor" />
      <circle cx={34.5} cy={49.5} r={1.3} fill="currentColor" />
      <rect x={12} y={42} width={7} height={13} rx={3.5} transform="rotate(10 15 42)" fill="#fdfdfe" stroke="#d8e4ee" strokeWidth={1.4} />
    </>
  )
}

function EarthArt() {
  return (
    <>
      <circle cx={32} cy={32} r={21} fill="currentColor" />
      <path d="M53 32 A21 21 0 0 1 32 53 C40 50 47 42 49 32 Z" fill={SHADE} opacity={0.35} />
      <path d="M18 26 C18 20 24 16 29 18 C33 20 32 25 28 27 C25 30 19 31 18 26 Z" fill="#7cc47f" />
      <path d="M37 24 C41 22 46 25 45 30 C44 34 38 34 36 31 C34 28 34 26 37 24 Z" fill="#7cc47f" />
      <path d="M26 40 C30 38 35 40 34 44 C33 48 26 48 24 44 Z" fill="#7cc47f" />
      <circle cx={44} cy={42} r={2} fill="#7cc47f" />
      <ellipse cx={26} cy={21} rx={6} ry={2} transform="rotate(-18 26 21)" fill={WHITE} opacity={0.75} />
      <ellipse cx={40} cy={38} rx={5} ry={1.8} transform="rotate(-10 40 38)" fill={WHITE} opacity={0.7} />
      <path d="M16 28 C17 20 24 14 31 13" stroke={WHITE} strokeWidth={2.4} strokeLinecap="round" opacity={0.55} />
    </>
  )
}

function OrbitArt() {
  return (
    <>
      <ellipse cx={32} cy={34} rx={25} ry={8.5} transform="rotate(-16 32 34)" stroke={SHADE} strokeWidth={3} />
      <circle cx={32} cy={34} r={14} fill="currentColor" />
      <path d="M19 30 C24 33 40 33 45 30" stroke={SOFT} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
      <path d="M20 39 C26 42 38 42 44 39" stroke={SHADE} strokeWidth={2.4} strokeLinecap="round" opacity={0.5} />
      <path d="M46 34 A14 14 0 0 1 32 48 C38 46 43 41 44 34 Z" fill={SHADE} opacity={0.35} />
      <path d="M9.5 39.5 C15 47 49 45 54.5 28.5" stroke={SHADE} strokeWidth={3} strokeLinecap="round" />
      <circle cx={12} cy={16} r={1.8} fill="currentColor" />
      <circle cx={52} cy={12} r={1.5} fill="currentColor" />
      <circle cx={46} cy={8} r={1.1} fill={SOFT} />
    </>
  )
}

function RabbitArt() {
  return (
    <>
      <ellipse cx={24} cy={15} rx={5.5} ry={12} transform="rotate(-9 24 15)" fill="#fdfdfe" stroke="#e3d5da" strokeWidth={1.2} />
      <ellipse cx={40} cy={15} rx={5.5} ry={12} transform="rotate(9 40 15)" fill="#fdfdfe" stroke="#e3d5da" strokeWidth={1.2} />
      <ellipse cx={24} cy={16} rx={2.6} ry={7.5} transform="rotate(-9 24 16)" fill="currentColor" />
      <ellipse cx={40} cy={16} rx={2.6} ry={7.5} transform="rotate(9 40 16)" fill="currentColor" />
      <circle cx={32} cy={39} r={15.5} fill="#fdfdfe" stroke="#e8dde2" strokeWidth={1.4} />
      <circle cx={22} cy={42} r={3} fill="currentColor" opacity={0.35} />
      <circle cx={42} cy={42} r={3} fill="currentColor" opacity={0.35} />
      <circle cx={26} cy={37} r={1.9} fill={INK} />
      <circle cx={38} cy={37} r={1.9} fill={INK} />
      <path d="M30 42 C30 40.8 34 40.8 34 42 C34 43.4 32 44.2 32 44.2 C32 44.2 30 43.4 30 42 Z" fill="currentColor" />
      <path d="M32 44.5 C31 46 29.5 46.3 28.5 45.5 M32 44.5 C33 46 34.5 46.3 35.5 45.5" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    </>
  )
}

function CatArt() {
  return (
    <>
      <path d="M18 27 L19.5 11 L31 19 Z" fill="currentColor" />
      <path d="M46 27 L44.5 11 L33 19 Z" fill="currentColor" />
      <path d="M20.5 23 L21.5 15 L27 19.5 Z" fill={SOFT} />
      <path d="M43.5 23 L42.5 15 L37 19.5 Z" fill={SOFT} />
      <circle cx={32} cy={37} r={16.5} fill="currentColor" />
      <ellipse cx={32} cy={43} rx={8} ry={5.5} fill={SOFT} opacity={0.8} />
      <path d="M28 22 L28 26 M32 21 L32 25 M36 22 L36 26" stroke={SHADE} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      <circle cx={25.5} cy={35} r={2} fill={INK} />
      <circle cx={38.5} cy={35} r={2} fill={INK} />
      <circle cx={26.2} cy={34.3} r={0.7} fill={WHITE} />
      <circle cx={39.2} cy={34.3} r={0.7} fill={WHITE} />
      <circle cx={20} cy={41} r={2.6} fill="#f6b8c8" opacity={0.55} />
      <circle cx={44} cy={41} r={2.6} fill="#f6b8c8" opacity={0.55} />
      <path d="M30 40.5 C30 39.4 34 39.4 34 40.5 C34 41.8 32 42.6 32 42.6 C32 42.6 30 41.8 30 40.5 Z" fill="#f28ba8" />
      <path d="M32 43 C31 44.6 29.4 45 28.2 44.2 M32 43 C33 44.6 34.6 45 35.8 44.2" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
      <path d="M12 36 L21 37.5 M12.5 41 L21 40.5 M52 36 L43 37.5 M51.5 41 L43 40.5" stroke={WHITE} strokeWidth={1.4} strokeLinecap="round" opacity={0.85} />
    </>
  )
}

function TennisBallArt() {
  return (
    <>
      <circle cx={32} cy={32} r={22} fill="currentColor" />
      <path d="M54 32 A22 22 0 0 1 32 54 C42 51 49 42 51 32 Z" fill={SHADE} opacity={0.35} />
      <path d="M15 17 C24 24 24 40 15 47" stroke={WHITE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <path d="M49 17 C40 24 40 40 49 47" stroke={WHITE} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <ellipse cx={22} cy={18} rx={5} ry={3.2} transform="rotate(-28 22 18)" fill={WHITE} opacity={0.55} />
    </>
  )
}

function TennisRacketArt() {
  const clipId = `osn-racket-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <>
      <clipPath id={clipId}>
        <ellipse cx={32} cy={23} rx={13.5} ry={15.5} />
      </clipPath>
      <ellipse cx={32} cy={23} rx={13.5} ry={15.5} fill={PALE} opacity={0.35} />
      <g clipPath={`url(#${clipId})`} stroke={PALE} strokeWidth={1.6}>
        {[24.5, 28.5, 32.5, 36.5, 40.5].map((x) => (
          <line key={x} x1={x} y1={8} x2={x} y2={39} />
        ))}
        {[13, 18, 23, 28, 33].map((y) => (
          <line key={y} x1={18} y1={y} x2={46} y2={y} />
        ))}
      </g>
      <ellipse cx={32} cy={23} rx={16.5} ry={18.5} fill="none" stroke="currentColor" strokeWidth={4.5} />
      <path d="M21 11 C24 7.5 29 5.8 33 6.2" stroke={SOFT} strokeWidth={2.2} strokeLinecap="round" fill="none" opacity={0.9} />
      <path d="M25.5 40 L29 49 M38.5 40 L35 49" stroke="currentColor" strokeWidth={4.5} strokeLinecap="round" />
      <rect x={28.5} y={48} width={7} height={13} rx={3} fill={SHADE} />
      <path d="M29.5 52.5 L34.5 52.5 M29.5 56.5 L34.5 56.5" stroke={PALE} strokeWidth={1.4} strokeLinecap="round" />
    </>
  )
}

function GnomeHatArt() {
  return (
    <>
      <path d="M13 47 C13 28 22 12 33 8 C40 6 46 8 48 14 C49 18 47 22 44 24 C47 30 51 38 51 47 Z" fill="currentColor" />
      <path d="M44 24 C47 30 51 38 51 47 L38 47 C41 39 43 31 44 24 Z" fill={SHADE} opacity={0.4} />
      <path d="M21 38 C20 28 24 18 31 13" stroke={PALE} strokeWidth={3.5} strokeLinecap="round" opacity={0.8} />
      <rect x={9} y={44} width={46} height={10} rx={5} fill={SHADE} />
      <rect x={9} y={44} width={46} height={4} rx={2} fill={DEEP} opacity={0.35} />
    </>
  )
}

function AnchorArt() {
  return (
    <>
      <path d="M12 35 C12 45 20 52 32 53 C44 52 52 45 52 35" stroke="currentColor" strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M12 36 L3 30 L11 24 Z" fill="currentColor" />
      <path d="M52 36 L61 30 L53 24 Z" fill="currentColor" />
      <rect x={29.5} y={14} width={5} height={36} rx={2.5} fill="currentColor" />
      <rect x={17} y={22} width={30} height={5.5} rx={2.75} fill={SHADE} />
      <circle cx={32} cy={13} r={6.5} stroke="currentColor" strokeWidth={5} />
      <circle cx={31} cy={12} r={6.5} stroke={PALE} strokeWidth={1.6} opacity={0.6} />
    </>
  )
}

const STICKER_ART: Record<string, () => ReactElement> = {
  heart: HeartArt,
  star: StarArt,
  sparkle: SparkleArt,
  flower: FlowerArt,
  music: MusicArt,
  camera: CameraArt,
  headphones: HeadphonesArt,
  monitor: MonitorArt,
  gamepad: GamepadArt,
  sakura: SakuraArt,
  'straw-hat': StrawHatArt,
  'maple-leaf': MapleLeafArt,
  snowman: SnowmanArt,
  rainbow: RainbowArt,
  astronaut: AstronautArt,
  earth: EarthArt,
  orbit: OrbitArt,
  rabbit: RabbitArt,
  cat: CatArt,
  'gnome-hat': GnomeHatArt,
  anchor: AnchorArt,
  'tennis-ball': TennisBallArt,
  'tennis-racket': TennisRacketArt,
}
