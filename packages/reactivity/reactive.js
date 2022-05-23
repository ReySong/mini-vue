import { effect, track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

const obj = {};
const proto = { foo: 1 };

export function reactive(obj) {
    const p = new Proxy(obj, {
        get(target, property, receiver) {
            if (property === "raw") return target;
            track(target, property);
            return Reflect.get(target, property, receiver);
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

const child = reactive(obj);
const parent = reactive(proto);
Object.setPrototypeOf(child, parent);

effect(() => {
    console.log(child.foo);
});

child.foo = 2;