import { effect } from "./effect.js";

export function watch(source, cb, options = {}) {
    let getter;
    if (typeof source === "function") {
        getter = source;
    } else {
        getter = () => traverse(source);
    }
    let oldVal, newVal;
    const job = () => {
        newVal = effectFn();
        cb(newVal, oldVal);
        oldVal = newVal;
    };
    const effectFn = effect(() => getter(), {
        lazy: true,
        scheduler: job,
    });
    if (options.immediate) job();
    else oldVal = effectFn();
}

function traverse(value, seen = new Set()) {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);
    for (const k in value) {
        traverse(value[k], seen);
    }
    return value;
}