import { useEffect, useRef } from 'preact/hooks';

export default function ModuleHelp({ id, label, children }) {
  const button = useRef(null);
  const tip = useRef(null);

  function position() {
    const panel = tip.current;
    if (!panel?.matches(':popover-open')) return;
    const anchor = button.current.getBoundingClientRect();
    const left = Math.min(anchor.left, document.documentElement.clientWidth - panel.offsetWidth - 10);
    panel.style.left = Math.max(10, left) + 'px';
    panel.style.top = (anchor.bottom + panel.offsetHeight <= innerHeight
      ? anchor.bottom : Math.max(0, anchor.top - panel.offsetHeight)) + 'px';
  }

  function show() {
    tip.current.showPopover();
    position();
  }

  useEffect(() => {
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, []);

  return (
    <span class="module-help"
      onPointerEnter={event => { if (event.pointerType !== 'touch') show(); }}
      onPointerLeave={event => {
        if (event.pointerType !== 'touch' && !button.current.matches(':focus-visible')) tip.current.hidePopover();
      }}>
      <button ref={button} class="module-help-button" type="button" aria-label={label + '帮助'} aria-describedby={id}
        onFocus={() => { if (button.current.matches(':focus-visible')) show(); }}
        onBlur={() => tip.current.hidePopover()}
        onClick={() => show()}><span aria-hidden="true">?</span></button>
      <span ref={tip} id={id} class="module-help-tip" role="tooltip" popover="auto">{children}</span>
    </span>
  );
}
