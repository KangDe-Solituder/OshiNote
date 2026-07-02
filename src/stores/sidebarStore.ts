import { create } from 'zustand'

export const SIDEBAR_WIDTH = {
  collapsed: 64,
  standard: 200,
  wide: 248,
  max: 280,
} as const

const STORAGE_KEY = 'oshinote.sidebar'

interface SidebarState {
  collapsed: boolean
  width: number
  dragEnabled: boolean
  snapEnabled: boolean
  toggle: () => void
  setCollapsed: (v: boolean) => void
  setWidth: (width: number) => void
  setDragEnabled: (enabled: boolean) => void
  setSnapEnabled: (enabled: boolean) => void
  snapWidth: (width?: number) => void
}

const initialState = loadSidebarState()

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: initialState.collapsed,
  width: initialState.width,
  dragEnabled: initialState.dragEnabled,
  snapEnabled: initialState.snapEnabled,
  toggle: () => set((s) => {
    const collapsed = !s.collapsed
    saveSidebarState({ ...s, collapsed })
    return { collapsed }
  }),
  setCollapsed: (collapsed) => set((s) => {
    saveSidebarState({ ...s, collapsed })
    return { collapsed }
  }),
  setWidth: (width) => set((s) => {
    const nextWidth = clampSidebarWidth(width)
    saveSidebarState({ ...s, width: nextWidth, collapsed: nextWidth <= SIDEBAR_WIDTH.collapsed })
    return { width: nextWidth, collapsed: nextWidth <= SIDEBAR_WIDTH.collapsed }
  }),
  setDragEnabled: (dragEnabled) => set((s) => {
    saveSidebarState({ ...s, dragEnabled })
    return { dragEnabled }
  }),
  setSnapEnabled: (snapEnabled) => set((s) => {
    saveSidebarState({ ...s, snapEnabled })
    return { snapEnabled }
  }),
  snapWidth: (width) => set((s) => {
    const targetWidth = width ?? get().width
    const nextWidth = s.snapEnabled ? nearestSnapWidth(targetWidth) : clampSidebarWidth(targetWidth)
    const collapsed = nextWidth <= SIDEBAR_WIDTH.collapsed
    saveSidebarState({ ...s, width: nextWidth, collapsed })
    return { width: nextWidth, collapsed }
  }),
}))

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.collapsed, Math.round(width)))
}

function nearestSnapWidth(width: number): number {
  const targetWidth = clampSidebarWidth(width)
  return [SIDEBAR_WIDTH.collapsed, SIDEBAR_WIDTH.standard, SIDEBAR_WIDTH.wide].reduce((best, candidate) => (
    Math.abs(candidate - targetWidth) < Math.abs(best - targetWidth) ? candidate : best
  ), SIDEBAR_WIDTH.standard)
}

function loadSidebarState() {
  if (typeof localStorage === 'undefined') {
    return { collapsed: false, width: SIDEBAR_WIDTH.standard, dragEnabled: true, snapEnabled: true }
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Pick<SidebarState, 'collapsed' | 'width' | 'dragEnabled' | 'snapEnabled'>>
    return {
      collapsed: parsed.collapsed === true,
      width: clampSidebarWidth(typeof parsed.width === 'number' ? parsed.width : SIDEBAR_WIDTH.standard),
      dragEnabled: parsed.dragEnabled !== false,
      snapEnabled: parsed.snapEnabled !== false,
    }
  } catch {
    return { collapsed: false, width: SIDEBAR_WIDTH.standard, dragEnabled: true, snapEnabled: true }
  }
}

function saveSidebarState(state: Pick<SidebarState, 'collapsed' | 'width' | 'dragEnabled' | 'snapEnabled'>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    collapsed: state.collapsed,
    width: state.width,
    dragEnabled: state.dragEnabled,
    snapEnabled: state.snapEnabled,
  }))
}
