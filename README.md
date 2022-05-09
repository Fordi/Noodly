# Noodly

Noodly is a Functional State Machine (FSM), meant to be used as a store for reactive apps.

> Demo...

## API

### `Noodly`

Signature: `Noodly(initialState:Object, children:Object):NoodlyInstance`

This is the main function.  It creates a state machine from an initial state:

```javascript
import Noodly from 'noodly';

const myMachine = Noodly({
  loadState: 'new',
  data: undefined
});
```

`initialState` is an object representing your machine's initial state.  `children` is
a map of child states, e.g.,

```javascript
const bill = Noodly({ loading: false });
const account = Noodly({ loading: false });
const store = Noodly({}, { bill, account });
```

Your NoodlyInstance exposes the following functions:

### `action`

Signature:

> `instance.action(actor:Actor):Action`

An Actor is either an async generator function, or an object with a single key, which is an async generator function.  This latter form is provided because it is more readable.

The following are equivalent:

```javascript
export const doTheThing = action(async function *doTheThing() {
  // ...
});
```
Or:

```javascript
export const doTheThing = action({
  async *doTheThing(curState) {
    // ...
  }
});
```

Actions/Actors should be named like verbs. A yield from an action will update the state destructively (the new state will not contain the old state).  Actors are called with no context, and arguments passed to the Action are passed into the Actor.  Any errors thrown during execution of the Actor are passed into the `error` field of the state, and execution is halted.  For more information about an Actor's lifecycle, see [listen](#listen).

Example:

```javascript
const bill = Noodly({
  loadStates: {},
  // Not actually necessary, but I find "knowing at the top what
  // metadata exists" is nice.
  promises: {},
  data: {},
});

export const fetchBill = action({
  async *fetchBill(accountNumber) {
    // Another call has already initiated the fetch.
    const last = bill.getState();
    if (last.promises[accountNumber]) return;
    const promise = fetch(`/api/bill/current/${accountNumber}`).then(r => r.json());
    const next = {
      loadStates: {
        ...last.loadStates,
        [accountNumber]: true,
      },
      promises: {
        ...last.promises,
        [accountNumber]: promise,
      },
      data: last.data,
    };
    yield next;
    const data = await next.promise;
    yield { 
      loadStates: {
        ...next.loadStates,
        [accountNumber]: false,
      },
      promises: next.promises,
      data: {
        ...next.data,
        [accountNumber]: data,
      }
    };
  }
});
```

### `listen`

Signatures:

> `instance.listen(signal:String, listener:SignalHandler):Unlistener`  
> `instance.listen(listener:SignalHandler):Unlistener`

`signal` can be:

 * 'start' - called before the Actor is called.
 * 'step' - called after each `yield` in the Actor.
 * 'complete' - called when the Actor exits.
 * 'error' - called when the Actor throws an error.


`listener` is an SignalHandler, a function with the signature:

> `listener(newState:Object, oldState:Object, type:String, path:Array<String>):void`

* `newState` is the state after the action / step has completed.
* `olsState` is the state as it was before the action / step was run.
* `type` is the event type ('step' or 'complete')
* `path` is the path from the root store to the current state machine, split by dots.

An Unlistener is a function that can be called to stop listening for signals.  Its signature is:

> `unlisten():void`

For reactive apps, it's unlikely you'll be using `listen` directly, as the built-in
`select` function handles all the necessary maintenance under the hood.

Example:

```javascript
bill.listen(state => {
  if (!state.loading && state.data && !state.error) {
    updateComponentState({ bill: state.data });
  }
});
```

### `log`

Signature:

> instance.log(enabled:Boolean):Boolean

Enable or disable logging for this Noodly instance.

### `setTools`

Signature:

> instance.setTools(tools:Tools):void

Set the reactive tools (`{ useState, useEffect }` with the normal signatures) for the Noodly instance's selectors.  If using Noodly reactively, this _must_ be called before using any selectors.

Example:

```javascript
const bill = Noodly({
  loading: false,
  // Not actually necessary, but I find "knowing at the top what
  // metadata exists" is nice.
  promise: undefined,
  data: undefined,
});

bill.setTools({ useState, useEffect });
```

### `select`

> Note: Please call `setTools({ useState, useEffect })` before using any of the generated selectors.

Signature:

> select(selector:SelectorFunction):HookFunction

Generates a reactive hook function that selects into the store.

Example:

```javascript
export const useBalanceDue = bill.select(
  ({ data: { balanceDue } = { } }) => balanceDue
);

// ... 

export const Balance = () => {
  const balanceDue = useBalanceDue();
  return (
    <div className="balance">
      {formatAsCurrency(balanceDue)}
    </div>
  );
};
```

### `getState`

Signature:

> getState():Object

Gets the current state of the Noodly instance.

### `machine`

`machine` is a public-safe subset of the Noodly instance; it contains only `getState` and `listen`.  The consumer is responsible for exposing actions.

### `useError`

The only built-in selector.  It retrieves the `error` field.