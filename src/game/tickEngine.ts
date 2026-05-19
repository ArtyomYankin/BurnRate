import { useGame } from "./store";

const TICK_MS = 1000;

export function startTickEngine(): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const loop = () => {
    if (stopped) return;
    useGame.getState().tick();
  };

  timer = setInterval(loop, TICK_MS);

  return () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };
}
