import { effect, track, trigger, ITERATE_KEY, TriggerType } from "./effect.js";

function createReactiveObject(obj, { isShallow = false, isReadonly = false }) {
    obj.raw = obj;
    return new Proxy(obj, {
        get(target, property, receiver) {
            if (property === "raw") return target;
            track(target, property);
            const res = Reflect.get(target, property, receiver);
            if (isShallow) return res;
            if (typeof res === "object" && res !== null) return reactive(res);
            return res;
        },
        set(target, property, newVal, receiver) {
            if (isReadonly) {
                console.warn(`property ${property} is readonly !`);
                return true;
            }
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