/** Shade only the native selection, without changing PDF text/highlight stacking. */
export function trackSelectionShade(getContainer: () => HTMLElement | null) {
  let frame: number | undefined;
  const shades: HTMLElement[] = [];
  const clear = () => {
    shades.splice(0).forEach(shade => shade.remove());
  };
  const render = () => {
    frame = undefined;
    clear();
    const container = getContainer();
    const selection = window.getSelection();
    if (!container) return;
    const hasNativeSelection = selection && !selection.isCollapsed && selection.rangeCount &&
      container.contains(selection.anchorNode) && container.contains(selection.focusNode);
    const bounds = container.getBoundingClientRect();
    // Range rectangles can overlap for nested PDF text spans. Build a single
    // SVG path so overlaps darken once, not once per rectangle.
    const rectangles = hasNativeSelection
      ? Array.from(selection.getRangeAt(0).getClientRects())
      : Array.from(container.querySelectorAll('.reader-selection-preview .TextHighlight__part'),
        part => part.getBoundingClientRect());
    const path = rectangles.flatMap(rect => {
      const left = Math.max(rect.left, bounds.left);
      const top = Math.max(rect.top, bounds.top);
      const right = Math.min(rect.right, bounds.right);
      const bottom = Math.min(rect.bottom, bounds.bottom);
      return right > left && bottom > top
        ? [`M${left},${top}H${right}V${bottom}H${left}Z`] : [];
    }).join(' ');
    if (!path) return;
    const shade = document.createElement('div');
    shade.className = 'reader-selection-shade';
    shade.setAttribute('aria-hidden', 'true');
    shade.style.inset = '0';
    shade.style.clipPath = `path("${path}")`;
    document.body.appendChild(shade);
    shades.push(shade);
  };
  const schedule = () => {
    if (frame === undefined) frame = window.requestAnimationFrame(render);
  };
  document.addEventListener('selectionchange', schedule);
  document.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  // Ghost selection is created/removed by React after native selection clears.
  // Observe only preview-related changes; our own overlay must not retrigger it.
  const observer = new MutationObserver(records => {
    const affectsPreview = (node: Node) => node instanceof Element &&
      (node.matches('.reader-selection-preview') || node.closest('.reader-selection-preview') ||
        node.querySelector('.reader-selection-preview'));
    if (records.some(record => (record.target instanceof Element &&
      record.target.closest('.reader-selection-preview')) ||
      [...record.addedNodes, ...record.removedNodes].some(affectsPreview))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  return () => {
    observer.disconnect();
    document.removeEventListener('selectionchange', schedule);
    document.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    clear();
  };
}
