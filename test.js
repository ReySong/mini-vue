import { effect } from "./packages/reactivity/effect.js";
import { reactive } from "./packages/reactivity/reactive.js";
import { toRefs, proxyRefs } from "./packages/reactivity/ref.js";

const obj = reactive({ foo: 1, bar: 2 });
const newObj = proxyRefs({...toRefs(obj) });

newObj.bar++;
console.log(newObj.bar);