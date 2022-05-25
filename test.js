import { effect } from "./packages/reactivity/index.js";
import { reactive } from "./packages/reactivity/index.js";

const p = reactive(
    new Map([
        ["key1", "value1"],
        ["key2", "value2"],
    ])
);

effect(() => {
    for (const v of p.keys()) {
        console.log(v);
    }
});

p.set("key2", "value3");