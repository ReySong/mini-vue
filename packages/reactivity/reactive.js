import { track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

const reactiveMap = new Map();
const arrayInstrumentations = {};
let shouldTrack = true;
["push", "pop", "unshift", "shift", "splice"].forEach((method) => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function(...args) {
        shouldTrack = false;
        let res = originMethod.apply(this, args);
        shouldTrack = true;
        return res;
    };
});
["includes", "indexOf", "lastIndexOf"].forEach((method) => {
    const originMethod = Array.prototype[method];
    arrayInstrumentations[method] = function(...args) {
        let res = originMethod.apply(this, args);
        if (res === false) res = originMethod.apply(this.raw, args);
        return res;
    };
});

function createReactiveObject(obj, { isShallow = false, isReadonly = false }) {
    const existionProxy = reactiveMap.get(obj);
    if (existionProxy) return existionProxy;
    const p = new Proxy(obj, {
        get(target, property, receiver) {
            if (property === "raw") return target;
            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(property))
                return Reflect.get(arrayInstrumentations, property, receiver);
            if (!isReadonly && typeof property !== "symbol") track(target, property, shouldTrack);
            const res = Reflect.get(target, property, receiver);
            if (isShallow) return res;
            if (typeof res === "object" && res !== null) return isReadonly ? readonly(res) : reactive(res);
            return res;
        },
        set(target, property, newVal, receiver) {
            if (isReadonly) {
                console.warn(`property ${property} is readonly !`);
                return true;
            }
            const oldVal = target[property];
            const type = Array.isArray(target) ?
                Number(property) < target.length ?
                TriggerType.SET :
                TriggerType.ADD :
                Object.prototype.hasOwnProperty.call(target, property) ?
                TriggerType.SET :
                TriggerType.ADD;
            const res = Reflect.set(target, property, newVal, receiver);
            if (target === receiver.raw)
                if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) trigger(target, property, type, newVal);
            return res;
        },
        has(target, property) {
            track(target, property);
            return Reflect.has(target, property);
        },
        ownKeys(target) {
            track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
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
    reactiveMap.set(obj, p);
    return p;
}

export function reactive(obj) {
    return createReactiveObject(obj, {});
}

export function shallowReactive(obj) {
    return createReactiveObject(obj, { isShallow: true });
}

export function readonly(obj) {
    return createReactiveObject(obj, { isReadonly: true });
}

export function shallowReadonly(obj) {
    return createReactiveObject(obj, { isShallow: true, isReadonly: true });
}