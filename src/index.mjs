// Disabling Jest on this line because this function will never be executed.
/* istanbul ignore next */
const ACTION_TYPE = ({ async* test() { /* */ } }).test.constructor;

const Noodly = (initialState, children = {}) => {
  let state = { ...initialState };
  let logging = false;
  const listeners = {
    start: new Set(),
    complete: new Set(),
    step: new Set(),
    error: new Set(),
  };
  const self = {};
  const machine = {};

  const announce = (signal, newState, oldState, path = []) => (
    listeners[signal].forEach((listener) => listener(newState, oldState, signal, path))
  );

  const getState = (up = 0) => (
    (up === 0 || !self.parent)
      ? state
      : self.parent.getState(up - 1)
  );

  async function act(iter, name) {
    const initState = state;
    try {
      for await (const newState of iter) {
        const interState = state;
        state = newState;
        if (logging) console.info(`[${name} step]`, interState, state);
        announce('step', state, interState);
      }
    } catch (error) {
      const interState = state;
      state = { ...state, error };
      if (logging) console.warn(`[${name} Error]`, error);
      announce('error', state, interState);
      return state;
    }
    await iter.return();
    if (logging) console.info(`[${name} complete]`, initState, state);
    announce('complete', state, initState);
    return state;
  }

  const action = (fn) => {
    if (typeof fn === 'object' && Object.keys(fn).length === 1) {
      return action(fn[Object.keys(fn)[0]]);
    }
    if (!fn || !fn.name || fn.constructor !== ACTION_TYPE) {
      throw new Error('Actions MUST be of the form `async function* actionName() { ... }` or `{ async *actionName() { ... } }`');
    }
    return (...args) => {
      if (logging) console.info(`[${fn.name} start]`, state);
      announce('start', state, state);
      return act(fn(self, ...args), fn.name);
    };
  };

  const add = (name, child) => {
    child.parent = self;
    state[name] = child.getState();
    Object.keys(listeners).forEach((signal) => {
      child.listen(signal, (newState, _, __, path) => {
        const oldState = state;
        state[name] = newState;
        announce(signal, state, oldState, [name, ...path]);
      });
    });
  };

  const listen = (signal, listener) => {
    if (typeof signal === 'function') {
      const unlisteners = Object.keys(listeners).map((t) => listen(t, signal));
      return () => unlisteners.forEach((u) => u());
    }
    listeners[signal]?.add(listener);
    return () => listeners[signal]?.delete(listener);
  };
  let warned = false;

  const tools = {
    useState: (init) => {
      if (!warned) {
        console.warn([
          'Your Noodly instance has not been initialized with the necessary reactive hooks; as a result, your app is not likely to work as expected.',
          'Please call {instance}.setTools({ useEffect, useState }) immediately after you create your instance to correct this.',
        ].join('\n'));
        warned = true;
      }
      return [init, null];
    },
    useEffect: () => {},
  };

  const setTools = ({ useState, useEffect }) => (
    Object.assign(tools, { useState, useEffect })
  );

  const select = (selector) => () => {
    const [value, setValue] = tools.useState(selector(getState()));
    tools.useEffect(() => listen('step', (newState, oldState) => {
      const gnu = selector(newState);
      const old = selector(oldState);
      console.error({ gnu, old });
      if (gnu !== old) setValue(gnu);
    }), [selector]);
    return value;
  };

  const useError = select(({ error }) => error);

  const log = (v) => {
    logging = v;
    return logging;
  };

  // Public stuff
  Object.assign(machine, {
    getState,
    listen,
  });

  // Stuff you'll need for making actions / selectors
  Object.assign(self, machine, {
    machine,
    action,
    select,
    log,
    useError,
    setTools,
  });

  Object.keys(children).forEach((name) => add(name, children[name]));

  return self;
};

export default Noodly;
