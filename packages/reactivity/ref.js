import { reactive, readonly, shallowReactive, shallowReadonly } from "./reactive.js";

export function ref(val) {
    const wrapper = { value: val };
    Object.defineProperty(wrapper, "isRef", { value: true, enumerable: false, writable: false });
    return reactive(wrapper);
}

export function shallowRef(val) {
    const wrapper = { value: val };
    Object.defineProperty(wrapper, "isRef", { value: true, enumerable: false, writable: false });
    return shallowReactive(wrapper);
}

export function readonlyRef(val) {
    const wrapper = { value: val };
    Object.defineProperty(wrapper, "isRef", { value: true, enumerable: false, writable: false });
    return readonly(wrapper);
}

export function shallowReadonlyRef(val) {
    const wrapper = { value: val };
    Object.defineProperty(wrapper, "isRef", { value: true, enumerable: false, writable: false });
    return shallowReadonly(wrapper);
}

export function toRef(obj, property) {
    const wrapper = {
        get value() {
            return obj[property];
        },
        set value(val) {
            obj[property] = val;
        },
    };
    Object.defineProperty(wrapper, "isRef", { value: true, enumerable: false, writable: false });
    return wrapper;
}

export function toRefs(obj) {
    const ret = {};
    for (const property in obj) {
        ret[property] = toRef(obj, property);
    }
    return ret;
}

export function proxyRefs(traget) {
    return new Proxy(traget, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            return value.isRef ? value.value : value;
        },
        set(target, property, newVal, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (value.isRef) {
                value.value = newVal;
                return true;
            }
            return Reflect.set(target, property, newVal, receiver);
        },
    });
}
