import { cn } from '@/lib/utils';
import type { AgentAnimationProps, AgentAnimationStrategy } from '../AgentAnimation.types';
import { AGENT_ICON_SIZE } from '../constants';

const ICON_CLASSES = `${AGENT_ICON_SIZE} shrink-0 text-foreground`;

/**
 * Legacy behaviour: the agent icon spins while a run is in flight, sits static
 * when idle. Preserved as a selectable strategy for branders who prefer it.
 */
function SpinAnimation({ active, Icon, className }: AgentAnimationProps) {
  return (
    <Icon
      className={cn(ICON_CLASSES, active && 'animate-[spin_3s_linear_infinite]', className)}
      aria-hidden="true"
    />
  );
}

export const spinAnimation: AgentAnimationStrategy = {
  key: 'spin',
  label: 'Spin',
  Component: SpinAnimation,
};
