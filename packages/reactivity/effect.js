import { computed } from "./computed.js";

let activeEffect; //  存储被注册的副作用函数，目的是摆脱对副作用函数名称的依赖
const effectStack = []; //  副作用函数栈
const bucket = new WeakMap(); //  存储副作用函数的桶

const jobQueue = new Set(); //  任务队列
const p = Promise.resolve();

let isFlushing = false;

function flushJob() {
    if (isFlushing) return;
    isFlushing = true;
    p.then(() => {
        //  添加到微任务队列
        jobQueue.forEach((job) => job());
    }).finally(() => (isFlushing = false));
}

export function effect(fn, options = {}) {
    //  用于注册副作用函数
    const effectFn = () => {
        cleanup(effectFn);
        activeEffect = effectFn;
        effectStack.push(effectFn);
        const res = fn();
        effectStack.pop();
        activeEffect = effectStack[effectStack.length - 1];
        return res;
    };
    effectFn.options = options;
    effectFn.deps = [];
    if (!options.lazy) effectFn();
    return effectFn;
}

function cleanup(effectFn) {
    //  清除所有依赖集合，目的是避免副作用函数遗留
    for (let i = 0; i < effectFn.deps.length; ++i) {
        const deps = effectFn.deps[i];
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}

export function track(target, property) {
    if (!activeEffect) return target[property];
    let depsMap = bucket.get(target);
    if (!depsMap) bucket.set(target, (depsMap = new Map()));
    let deps = depsMap.get(property);
    if (!deps) depsMap.set(property, (deps = new Set()));
    deps.add(activeEffect);
    activeEffect.deps.push(deps); //  将与当前副作用函数相关的依赖函数添加到依赖集合中
}

export function trigger(target, property) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const effects = depsMap.get(property);
    const effectsToRun = new Set();
    effects &&
        effects.forEach((effectFn) => {
            if (effectFn !== activeEffect) effectsToRun.add(effectFn);
        });
    effectsToRun.forEach((effectFn) => {
        if (effectFn.options.scheduler) effectFn.options.scheduler(effectFn);
        else effectFn();
    });
}

const data = { foo: 1, bar: 2 };
const obj = new Proxy(data, {
    get(target, property) {
        track(target, property);
        return target[property];
    },

    set(target, property, newVal) {
        target[property] = newVal;
        trigger(target, property);
        return true;
    },
});

const sumRes = computed(() => obj.foo + obj.bar);
// effect(() => {
//     console.log(sumRes.value);
// });
obj.foo++;
console.log(sumRes.value);