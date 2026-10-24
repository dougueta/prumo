/**
 * Piso de tempo de resposta (FR-002, SC-002): todos os ramos de pedir/verificar código levam pelo
 * menos `ms`, para o tempo não revelar se o e-mail tem acesso. Vale também quando `fn` lança.
 */
type Clock = { now: () => number; sleep: (ms: number) => Promise<void> };

const realClock: Clock = {
  now: () => performance.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export async function withFloor<T>(
  ms: number,
  fn: () => Promise<T>,
  clock: Clock = realClock,
): Promise<T> {
  const start = clock.now();
  const wait = async () => {
    const remaining = ms - (clock.now() - start);
    if (remaining > 0) await clock.sleep(remaining);
  };
  try {
    const result = await fn();
    await wait();
    return result;
  } catch (error) {
    await wait();
    throw error;
  }
}
