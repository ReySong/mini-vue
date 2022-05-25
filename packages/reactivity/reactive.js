import { track, trigger, ITERATE_KEY, TriggerType, MAP_KEY_ITERATE_KEY } from "./effect.js";

let shouldTrack = true;
let raw = Symbol("raw");

const TargetType = {
    INVALID: 0,
    COMMON: 1,
    COLLECTION: 2,
};

function getTargetType(value) {
    return Object.prototype.toString.call(value).slice(8, -1);
}

function targetTypeMap(rawType) {
    switch (rawType) {
        case "Object":
        case "Array":
            return TargetType.COMMON;
        case "Map":
        case "Set":
        case "WeakMap":
        case "WeakSet":
            return TargetType.COLLECTION;
        default:
            return TargetType.INVALID;
    }
}

const reactiveMap = new Map();

const arrayInstrumentations = {};
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
        if (res === false) res = originMethod.apply(this[raw], args);
        return res;
    };
});

function iterationMethod(itrType) {
    return function() {
        const target = this[raw];
        const wrap = (val) => (typeof val === "object" ? reactive(val) : val);
        const itr = (function(itrType) {
            switch (itrType) {
                case "entries":
                    return target[Symbol.iterator]();
                case "values":
                    return target.values();
                case "keys":
                    return target.keys();
            }
        })(itrType);
        track(target, itrType === "keys" ? MAP_KEY_ITERATE_KEY : ITERATE_KEY);
        return {
            next() {
                const { value, done } = itr.next();
                return {
                    value: typeof value === "object" ? (value ? [wrap(value[0]), wrap(value[1])] : value) : wrap(value),
                    done,
                };
            },
            [Symbol.iterator]() {
                return this;
            },
        };
    };
}

const mutableInstrumentations = {
    add(property) {
        const target = this[raw];
        const hadProperty = target.has(property);
        const res = target.add(property);
        if (!hadProperty) {
            trigger(target, property, TriggerType.ADD);
        }
        return res;
    },
    delete(property) {
        const target = this[raw];
        const hadProperty = target.has(property);
        const res = target.delete(property);
        if (hadProperty) {
            trigger(target, property, TriggerType.DELETE);
        }
        return res;
    },
    get(key) {
        const target = this[raw];
        const hadProperty = target.has(key);
        track(target, key);
        if (hadProperty) {
            const res = target.get(key);
            return res === "object" ? reactive(res) : res;
        }
    },
    set(key, value) {
        const target = this[raw];
        const hadProperty = target.has(key);
        const oldVal = target.get(key);
        const rawValue = value[raw] || value;
        target.set(key, rawValue);
        if (!hadProperty) {
            trigger(target, key, TriggerType.ADD);
        } else if (oldVal !== value && oldVal === oldVal && value === value) {
            trigger(target, key, TriggerType.SET);
        }
    },
    forEach(callback, thisArg) {
        const target = this[raw];
        const wrap = (val) => (typeof val === "object" ? reactive(val) : val);
        track(target, ITERATE_KEY);
        target.forEach((v, k) => {
            callback.call(thisArg, wrap(v), wrap(k), this);
        });
    },
    [Symbol.iterator]: iterationMethod("entries"),
    entries: iterationMethod("entries"),
    values: iterationMethod("values"),
    keys: iterationMethod("keys"),
};

function createReactiveObject(obj, { isShallow = false, isReadonly = false }) {
    const targetType = targetTypeMap(getTargetType(obj));
    if (targetType === 0) return obj;
    const existionProxy = reactiveMap.get(obj);
    if (existionProxy) return existionProxy;
    let p;
    const baseHandler = {
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
            if (target === receiver[raw])
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
    };
    const collectionHandler = {
        get(target, property, receiver) {
            if (property === raw) return target;
            if (property === "size") {
                track(target, ITERATE_KEY);
                return Reflect.get(target, property, target);
            }
            return Reflect.get(mutableInstrumentations, property, receiver);
        },
    };
    if (targetType === 1) p = new Proxy(obj, baseHandler);
    else p = new Proxy(obj, collectionHandler);
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