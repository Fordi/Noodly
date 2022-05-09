// eslint-disable-next-line
import { jest } from '@jest/globals';
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
  it('allows signal subscription control', async () => {
    const store = Noodly({ value: 0 });
    const action = store.action({
      async* action() {
        yield { value: 1 };
        yield { value: 2 };
      },
    });
    const steps = [];
    const unlisten = store.listen((newState, oldState, signal, path) => {
      steps.push([{ ...newState }, { ...oldState }, signal, [...path]]);
    });
    await action();
    expect(steps).toMatchSnapshot();
    unlisten();
    steps.length = 0;
    await action();
    expect(steps.length).toBe(0);
  });
  it('talks to logs', async () => {
    const store = Noodly({ value: 0 });
    global.console.info = jest.fn();
    store.log(true);
    const action = store.action({
      async* action() {
        yield { value: 2 };
      },
    });
    await action();
    expect(global.console.info).toHaveBeenCalled();
  });
  it('rejects bad actions', () => {
    const store = Noodly({ value: 0 });
    expect(() => {
      store.action(() => {});
    }).toThrow();
  });
  it('supports child machines', async () => {
    const left = Noodly({ left: false });
    const leftAction = left.action({
      async* leftAction() {
        yield { hasRun: true };
      },
    });
    const right = Noodly({ right: false });
    const rightAction = right.action({
      async* rightAction() {
        yield { hasRun: true };
      },
    });
    const main = Noodly({}, { left, right });
    let steps = [];
    const unlisten = main.listen((newState, oldState, signal, path) => {
      steps.push([{ ...newState }, { ...oldState }, signal, [...path]]);
    });
    expect(main.getState()).toMatchSnapshot();
    await leftAction();
    await rightAction();
    expect(steps).toMatchSnapshot();
    unlisten();
    steps = [];
    await leftAction();
    await rightAction();
    expect(steps.length).toBe(0);
    expect(left.getState(1)).toBe(main.getState());
  });
  it('handle errors automatically, logging if logging is set', async () => {
    const store = Noodly({ });
    const action = store.action({
      // eslint-disable-next-line require-yield
      async* action() {
        throw new Error('failure');
      },
    });
    await action();
    expect(store.getState().error).toMatchSnapshot();
    store.log(true);
    global.console.warn = jest.fn();
    await action();
    expect(global.console.warn).toHaveBeenCalled();
  });
});
