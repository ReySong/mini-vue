import { effect, reactive, toRefs, proxyRefs } from "./packages/reactivity/index.js";

const obj = reactive({ foo: 1, bar: 2 });
const newObj = proxyRefs({...toRefs(obj) });

newObj.bar++;
console.log(newObj.bar);