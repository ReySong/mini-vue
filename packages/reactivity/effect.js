const data = { foo: true, bar: true };

let activeEffect; //  存储被注册的副作用函数，目的是摆脱对副作用函数名称的依赖
const effectStack = [];

function effect(fn) {
    //  用于注册副作用函数
    const effectFn = () => {
        cleanup(effectFn);
        activeEffect = effectFn;
        effectStack.push(effectFn);
        fn();
        effectStack.pop();
        activeEffect = effectStack[effectStack.length - 1];
    };
    effectFn.deps = [];
    effectFn();
}

function cleanup(effectFn) {
    //  清除所有依赖集合，目的是避免副作用函数遗留
    for (let i = 0; i < effectFn.deps.length; ++i) {
        const deps = effectFn.deps[i];
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}

function track(target, property) {
    if (!activeEffect) return target[property];
    let depsMap = bucket.get(target);
    if (!depsMap) bucket.set(target, (depsMap = new Map()));
    let deps = depsMap.get(property);
    if (!deps) depsMap.set(property, (deps = new Set()));
    deps.add(activeEffect);
    activeEffect.deps.push(deps); //  将与当前副作用函数相关的依赖函数添加到依赖集合中
}

function trigger(target, property) {
    const depsMap = bucket.get(target);
    if (!depsMap) return;
    const effects = depsMap.get(property);
    const effectsToRun = new Set(effects);
    effects && effectsToRun.forEach((fn) => fn());
}

const bucket = new WeakMap(); //  存储副作用函数的桶

const obj = new Proxy(data, {
    get(target, property) {
        track(target, property);
        return target[property];
    },

    set(target, property, newVal) {
        target[property] = newVal;
        trigger(target, property);
    },
});

let temp1, temp2;

effect(function effectFn1() {
    console.log("effectFn1");
    effect(function effectFn2() {
        console.log("effectFn2");
        temp2 = obj.bar;
    });
    temp1 = obj.foo;
});
obj.foo = 1;