import Noodly from './index.mjs';

describe('Noodly', () => {
  it('exists', () => {
    expect(Noodly instanceof Function).toBe(true);
  });
  it('creates a state machine', async () => {
    const store = Noodly({ value: 0 });
    const action = store.action({
      async* action() {
        yield { value: 1 };
        yield { value: 2 };
      },
    });
    expect(store.getState().value).toBe(0);
    await action();
    expect(store.getState().value).toBe(2);
  });
});
