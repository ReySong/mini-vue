import { effect, track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

function createReactiveObject(obj, isShallow = false) {
    const p = new Proxy(obj, {
        get(target, property, receiver) {
            if (property === "raw") return target;
            track(target, property);
            const res = Reflect.get(target, property, receiver);
            if (isShallow) return res;
            if (typeof res === "object" && res !== null) return reactive(res);
            return res;
        },
        set(target, property, newVal, receiver) {
            const oldVal = target[property];
            const type = Object.prototype.hasOwnProperty.call(target, property) ? TriggerType.SET : TriggerType.ADD;
            const res = Reflect.set(target, property, newVal, receiver);
            if (target === receiver.raw)
                if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) trigger(target, property, type);
            return res;
        },
        has(target, property) {
            track(target, property);
            return Reflect.has(target, property);
        },
        ownKeys(target) {
            track(target, ITERATE_KEY);
            return Reflect.ownKeys(target);
        },
        deleteProperty(target, property) {
            const hadKey = Object.prototype.hasOwnProperty.call(target, property);
            const res = Reflect.deleteProperty(target, property);
            if (res && hadKey) {
                trigger(target, property, TriggerType.DELETE);
            }
            return res;
        },
    });
    p.raw = obj;
    return p;
}

export function reactive(obj) {
    return createReactiveObject(obj);
}

export function shallowReactive(obj) {
    return createReactiveObject(obj, true);
}

const obj = reactive({ foo: { bar: 1 } });

effect(() => {
    console.log(obj.foo.bar);
});
obj.foo.bar = 2;