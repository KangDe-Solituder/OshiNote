export const OVERLAY_Z_INDEX = {
  drawer: 100,
  popover: 130,
  modal: 140,
  // Dropdowns render in a body portal and may originate inside modals,
  // so they must sit above the modal layer to remain clickable.
  dropdown: 145,
  toast: 150,
  fullscreen: 160,
} as const
