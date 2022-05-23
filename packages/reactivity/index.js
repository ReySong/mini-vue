import { readonly, shallowReadonly } from "./reactive.js";

export { effect, track, trigger }
from "./effect.js";
export { computed }
from "./computed.js";
export { watch }
from "./watch.js";
export { reactive, shallowReactive, readonly, shallowReadonly }
from "./reactive.js";

const obj = readonly({ foo: { bar: 1 } });

obj.foo.bar++;