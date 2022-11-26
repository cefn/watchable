export async function manyTicks() {
  // wait for multiple ticks
  for (let countdown = 100; countdown-- > 0; ) {
    await Promise.resolve();
  }
}
