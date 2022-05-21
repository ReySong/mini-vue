import { effect, track, trigger } from "./effect.js";

export function computed(getter) {
    let value; //  缓存上一次计算的值
    let dirty = true; //  为 true 表示数据为“脏”，需要重新计算
    const effectFn = effect(getter, {
        lazy: true,
        scheduler() {
            dirty = true;
            // trigger(obj, "value");
        },
    });
    const obj = {
        get value() {
            if (dirty) {
                value = effectFn();
                dirty = false;
            }
            // track(obj, "value");
            return value;
        },
    };
    return obj;
}