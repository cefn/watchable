import { lock } from './lock';

describe('lock', () => {
  it('should work', () => {
    expect(lock()).toEqual('lock');
  });
});
