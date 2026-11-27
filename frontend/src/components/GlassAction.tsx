import { GlassButton, type GlassButtonProps } from "@form-glass/react";

// The Controls capsule and its light, with native button semantics.
export function GlassAction({children, className = "", ...props}: GlassButtonProps) {
  return <GlassButton {...props} shape="capsule" className={`glass-state-switch map-action-capsule ${className}`}>
    <span className="glass-switch-light" aria-hidden="true" />
    <span className="glass-switch-label">{children}</span>
  </GlassButton>;
}
