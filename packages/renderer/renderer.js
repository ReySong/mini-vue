import { reactive, shallowReactive, shallowReadonly, effect } from "../reactivity/index.js";

export const Text = Symbol();
export const Comment = Symbol();
export const Fragment = Symbol();

export let currentInstance = null;
function setCurrentInstance(instance) {
    const prev = currentInstance;
    currentInstance = instance;
    return prev;
}

const lifeCycleHooks = {};
["beforeMount", "mounted", "beforeUpdate", "updated"].forEach((method) => {
    let register = `on${method[0].toUpperCase() + method.slice(1)}`;
    lifeCycleHooks[register] = (fn) => {
        if (currentInstance) currentInstance[method].push(fn);
        else console.error(register + "can only be called in the setup function!");
    };
});
export const { onBeforeMount, onMounted, onBeforeUpdate, onUpdated } = lifeCycleHooks;

const queue = new Set();
let isFlushing = false;
const p = Promise.resolve();

function queueJob(job) {
    queue.add(job);
    if (!isFlushing) {
        isFlushing = true;
        p.then(() => {
            try {
                queue.forEach((job) => job());
            } finally {
                isFlushing = false;
                queue.clear();
            }
        });
    }
}

export function createRenderer(options = {}) {
    const { createElement, createTextNode, createCommentNode, setElementText, setText, insert, patchProps } = options;

    function render(vnode, container) {
        let display = container.style.display;
        container.style.display = "none"; //  DOM 离线
        if (vnode) patch(container._vnode, vnode, container);
        else if (container._vnode) unmount(container._vnode);
        container._vnode = vnode;
        container.style.display = display;
    }

    function patch(n1, n2, container, anchor) {
        if (n1 && n1.type !== n2.type) {
            unmount(n1);
            n1 = null;
        }
        const { type } = n2;

        if (typeof type === "string") {
            if (!n1) mount(n2, container, anchor);
            else patchElement(n1, n2);
        } else if (type === Text) {
            if (!n1) {
                const el = (n2.el = createTextNode(n2.children));
                insert(el, container);
            } else {
                const el = (n2.el = n1.el);
                if (n2.children !== n1.children) setText(el, n2.children);
            }
        } else if (type === Comment) {
            if (!n1) {
                const el = (n2.el = createCommentNode(n2.children));
                insert(el, container);
            } else {
                const el = (n2.el = n1.el);
                if (n2.children !== n1.children) setText(el, n2.children);
            }
        } else if (type === Fragment) {
            if (!n1)
                n2.children.forEach((c) => {
                    patch(null, c, container);
                });
            else patchChildren(n1, n2, container);
        } else if (typeof type === "object" && type.__isTeleport) {
            //  将控制权交给 Teleport 组件选项的 process 函数
            type.process(n1, n2, container, anchor, {
                patch,
                patchChildren,
                unmount,
                move(vnode, container, anchor) {
                    insert(vnode.component ? vnode.component.subTree.el : vnode.el, container, anchor);
                },
            });
        } else if (typeof type === "object" || typeof type === "function") {
            //  处理组件
            if (!n1) {
                if (n2.keptAlive) n2.keepAliveInstance._activate(n2, container, anchor);
                else mountComponent(n2, container, anchor);
            } else {
                patchComponent(n1, n2, anchor);
            }
        }
    }

    function mountComponent(vnode, container, anchor) {
        const isFunctional = typeof vnode.type === "function";
        const componentOptions = isFunctional
            ? {
                  render: vnode.type,
                  props: vnode.type.props,
              }
            : vnode.type;

        let { render } = componentOptions;
        const { data, setup, beforeCreate, created, props: propsOption } = componentOptions;

        beforeCreate && beforeCreate().forEach((hook) => hook()); //  调用生命周期钩子

        const state = data ? reactive(data()) : null;
        const [props, attrs] = resolveProps(propsOption, vnode.props);
        const slots = vnode.children || {};

        const instance = {
            //  组件实例
            state,
            props: shallowReactive(props),
            isMounted: false,
            subTree: null,
            slots,
            beforeMount: [],
            mounted: [],
            beforeUpdate: [],
            updated: [],
            keepAliveCtx: null,
        };

        const isKeepAlive = vnode.type.__isKeepAlive;
        if (isKeepAlive) {
            instance.keepAliveCtx = {
                move(vnode, container, anchor) {
                    insert(vnode.component.subTree.el, container, anchor);
                },
                createElement,
            };
        }

        function emit(event, ...payload) {
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
            const handler = instance.props[eventName];
            if (handler) handler(...payload);
            else console.warn("event is not exist!");
        }

        let setupState = null; //  用来存储 setup 返回的数据
        if (setup) {
            const setupContext = { attrs, emit, slots };
            const prevInstance = setCurrentInstance(instance);
            const setupResult = setup(shallowReadonly(instance.props), setupContext);
            setCurrentInstance(prevInstance);
            if (typeof setupResult === "function") {
                if (render) console.warn("setup function returns render function, the render option will be ignore!");
                render = setupResult;
            } else setupState = setupResult;
        }

        vnode.component = instance;

        const renderContext = new Proxy(instance, {
            get(t, k) {
                const { state, props, slots } = t;
                if (k === "$slots") return slots;
                if (state && k in state) {
                    return state[k];
                } else if (k in props) {
                    return props[k];
                } else if (setupState && key in setupState) {
                    return setupState[k];
                } else {
                    console.error("property do not exist");
                }
            },
            set(t, k, v) {
                const { state, props } = t;
                if (state && k in state) {
                    state[k] = v;
                } else if (k in props) {
                    props[k] = v;
                } else if (setupState && key in setupState) {
                    setupState[k] = v;
                } else {
                    console.error("property do not exist");
                    return false;
                }
                return true;
            },
        });

        created && created().forEach((hook) => hook.call(renderContext)); //  调用生命周期钩子

        effect(
            () => {
                const subTree = render.call(renderContext, renderContext); //  render 函数内部可以通过this访问自身状态数据
                if (!instance.isMounted) {
                    instance.beforeMount && instance.beforeMount.forEach((hook) => hook.call(renderContext)); //  调用生命周期钩子
                    patch(null, subTree, container, anchor);
                    instance.isMounted = true;
                    instance.mounted && instance.mounted.forEach((hook) => hook.call(renderContext)); //  调用生命周期钩子
                } else {
                    instance.beforeUpdate && instance.beforeUpdate.forEach((hook) => hook.call(renderContext)); //  调用生命周期钩子
                    patch(instance.subTree, subTree, container, anchor);
                    instance.updated && instance.updated.forEach((hook) => hook.call(renderContext)); //  调用生命周期钩子
                }
                instance.subTree = subTree;
            },
            { scheduler: queueJob }
        );
    }

    function resolveProps(options, propsData) {
        const props = {};
        const attrs = {};
        for (const key in propsData) {
            if (key in options || key.startsWith("on")) props[key] = propsData[key];
            else attrs[key] = propsData[key];
        }
        return [props, attrs];
    }

    function patchComponent(n1, n2) {
        const instance = (n2.component = n1.component);
        const { props } = instance;
        if (hasPropsChanged(n1.props, n2.props)) {
            const [nextProps] = resolveProps(n2.type.props, n2.props);
            for (const k in nextProps) props[k] = nextProps[k];
            for (const k in props) if (!(k in nextProps)) delete props[k];
        }
    }

    function hasPropsChanged(prevProps, nextProps) {
        const nextKeys = Object.keys(nextProps);
        if (nextKeys.length !== Object.keys(prevProps).length) return true;
        for (let i = 0; i < nextKeys.length; ++i) {
            const key = nextKeys[i];
            if (nextProps[key] !== prevProps[key]) return true;
        }
        return false;
    }

    function patchElement(n1, n2) {
        const el = (n2.el = n1.el);
        const oldProps = n1.props;
        const newProps = n2.props;
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) patchProps(el, key, oldProps[key], null);
        }
        patchChildren(n1, n2, el);
    }

    function patchChildren(n1, n2, container) {
        if (typeof n2.children === "string") {
            if (Array.isArray(n1.children)) {
                n1.children.forEach((c) => unmount(c));
            }
            setElementText(container, n2.children);
        } else if (Array.isArray(n2.children)) {
            if (Array.isArray(n1.children)) {
                patchKeyedChildren(n1, n2, container);
                /* 简单 Diff 算法
                const oldChildren = n1.children;
                const newChildren = n2.children;
                let lastIndex = 0;
                for (let i = 0; i < newChildren.length; ++i) {
                    const newVNode = newChildren[i];
                    let find = false;
                    for (let j = 0; j < oldChildren.length; ++j) {
                        const oldVNode = oldChildren[j];
                        if (newVNode.key === oldVNode.key) {
                            find = true;
                            patch(oldVNode, newVNode, container);
                            if (j < lastIndex) {
                                const prevVNode = newChildren[i - 1];
                                if (prevVNode) {
                                    const anchor = prevVNode.el.nextSibling;
                                    insert(newVNode.el, container, anchor);
                                }
                            } else lastIndex = j;
                            break;
                        }
                    }
                    for (let i = 0; i < oldChildren.length; ++i) {
                        const oldVNode = oldChildren[i];
                        const has = newChildren.find((vnode) => vnode.key === oldVNode.key);
                        if (!has) unmount(oldVNode);
                    }
                    if (!find) {
                        const prevVNode = newChildren[i - 1];
                        let anchor = null;
                        if (prevVNode) anchor = prevVNode.el.nextSibling;
                        else anchor = container.firstChild;
                        patch(null, newVNode, container, anchor);
                    }
                }   */
            } else {
                setElementText(container, "");
                n2.children.forEach((c) => patch(null, c, container));
            }
        } else {
            if (Array.isArray(n1.children)) {
                n1.children.forEach((c) => unmount(c));
            } else if (typeof n1.children === "string") {
                setElementText(container, "");
            }
        }
    }

    function patchKeyedChildren(n1, n2, container) {
        //  快速 Diff 算法

        const oldChildren = n1.children;
        const newChildren = n2.children;

        let index = 0;
        let oldVNode = oldChildren[index];
        let newVNode = newChildren[index];
        while (oldVNode.key === newVNode.key) {
            patch(oldVNode, newVNode, container);
            ++index;
            oldVNode = oldChildren[index];
            newVNode = newChildren[index];
        }
        let oldEnd = oldChildren.length - 1;
        let newEnd = newChildren.length - 1;
        oldVNode = oldChildren[oldEnd];
        newVNode = newChildren[newEnd];
        while (oldVNode.key === newVNode.key) {
            patch(oldVNode, newVNode, container);
            --oldEnd;
            --newEnd;
            oldVNode = oldChildren[oldEnd];
            newVNode = newChildren[newEnd];
        }

        if (index > oldEnd && index <= newEnd) {
            const anchorIndex = newEnd + 1;
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
            while (index <= newEnd) {
                patch(null, newChildren[index++], container, anchor);
            }
        } else if (index <= oldEnd && index > newEnd) {
            while (index <= oldEnd) {
                unmount(oldChildren[index++]);
            }
        } else {
            const count = newEnd - index + 1;
            const source = new Array(count).fill(-1); //  记录所有 key 值与旧节点对应的新节点位置
            const oldStart = index;
            const newStart = index;
            const keyIndex = new Map();
            let moved = false,
                pos = 0,
                patched = 0; //  已经更新过的节点数量
            for (let i = newStart; i <= newEnd; ++i) {
                keyIndex.set(newChildren[i].key, i);
            }
            for (let i = oldStart; i <= oldEnd; ++i) {
                oldVNode = oldChildren[i];
                if (patched <= count) {
                    const k = keyIndex.get(oldVNode.key);
                    if (typeof k !== "undefined") {
                        newVNode = newChildren[k];
                        patch(oldVNode, newVNode, container);
                        ++patched;
                        source[k - newStart] = i;
                        if (k < pos) {
                            moved = true;
                        } else {
                            pos = k;
                        }
                    } else {
                        unmount(oldVNode);
                    }
                } else {
                    unmount(oldVNode);
                }
            }
            if (moved) {
                const seq = lis(source);
                let s = seq.length - 1;
                let i = count - 1;
                for (i; i >= 0; --i) {
                    const pos = i + newStart;
                    const newVNode = newChildren[pos];
                    const nextPos = pos + 1;
                    const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                    if (source[i] === -1) {
                        //  新节点，需要挂载
                        patch(null, newVNode, container, anchor);
                    } else if (i !== seq[s]) {
                        // i 不在最长递增子序列中，需要移动
                        insert(newVNode.el, container, anchor);
                    } else --s;
                }
            }
        }

        /*  双端 Diff 算法
        const oldChildren = n1.children;
        const newChildren = n2.children;
        let oldStartIdx = 0;
        let oldEndIdx = oldChildren.length - 1;
        let newStartIdx = 0;
        let newEndIdx = newChildren.length - 1;
        let oldStartVNode = oldChildren[oldStartIdx];
        let oldEndVNode = oldChildren[oldEndIdx];
        let newStartVNode = newChildren[newStartIdx];
        let newEndVNode = newChildren[newEndIdx];

        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (!oldStartVNode) {
                oldStartVNode = oldChildren[++oldStartIdx];
            } else if (!oldEndVNode) {
                oldEndVNode = oldChildren[--oldEndIdx];
            } else if (oldStartVNode.key === newStartVNode.key) {
                patch(oldStartVNode, newStartVNode, container);
                oldStartVNode = oldChildren[++oldStartIdx];
                newStartVNode = newChildren[++newStartIdx];
            } else if (oldEndVNode.key === newEndVNode.key) {
                patch(oldEndVNode, newEndVNode, container);
                oldEndVNode = oldChildren[--oldEndIdx];
                newEndVNode = newChildren[--newEndIdx];
            } else if (oldStartVNode.key === newEndVNode.key) {
                patch(oldStartVNode, newEndVNode, container);
                insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
                oldStartVNode = oldChildren[++oldStartIdx];
                newEndVNode = newChildren[--newEndIdx];
            } else if (oldEndVNode.key === newStartVNode.key) {
                patch(oldEndVNode, newStartVNode, container);
                insert(oldEndVNode.el, container, oldStartVNode.el);
                oldEndVNode = oldChildren[--oldEndIdx];
                newStartVNode = newChildren[++newStartIdx];
            } else {
                const idxInOld = oldChildren.findIndex((node) => node.key === newStartVNode.key);
                if (idxInOld > 0) {
                    const vnodeToMove = oldChildren[idxInOld];
                    patch(vnodeToMove, newStartVNode, container);
                    insert(vnodeToMove.el, container, oldStartVNode.el);
                    oldChildren[idxInOld] = undefined;
                } else {
                    patch(null, newStartVNode, container, oldStartVNode.el);
                }
                newStartVNode = newChildren[++newStartIdx];
            }
        }
        if (oldStartIdx > oldEndIdx && newStartIdx <= newEndIdx) {
            for (let i = newStartIdx; i <= newEndIdx; ++i) {
                patch(null, newChildren[i], container, oldStartVNode.el);
            }
        } else if (oldStartIdx <= oldEndIdx && newStartIdx > newEndIdx) {
            for (let i = oldStartIdx; i <= oldEndIdx; ++i) {
                unmount(oldChildren[i]);
            }
        }   */
    }

    function mount(vnode, container, anchor) {
        const el = (vnode.el = createElement(vnode.type));
        if (typeof vnode.children === "string") setElementText(el, vnode.children);
        else if (Array.isArray(vnode.children))
            vnode.children.forEach((child) => {
                patch(null, child, el);
            });
        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }
        const needTransition = vnode.transition;
        if (needTransition) vnode.transition.beforeEnter(el);
        insert(el, container, anchor);
        if (needTransition) vnode.transition.enter(el);
    }

    function unmount(vnode) {
        const needTransition = vnode.transition;
        if (vnode.type === Fragment) {
            vnode.children.forEach((c) => unmount(c));
            return;
        } else if (vnode.shouldKeepAlive) {
            vnode.keepAliveInstance._deActivate(vnode);
        } else if (typeof vnode.type === "object") {
            unmount(vnode.component.subTree);
            return;
        }
        const parent = vnode.el.parentNode;
        if (parent) {
            const performRemove = () => parent.removeChild(vnode.el);
            if (needTransition) vnode.transition.leave(vnode.el, performRemove);
            else performRemove();
        }
    }

    return {
        render,
    };
}

function shouldSetAsProps(el, key) {
    if (key === "from" && el.tagName === "INPUT") return false;
    return key in el;
}

function lis(arr) {
    const p = arr.slice();
    const result = [0];
    let i, j, u, v, c;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }
            u = 0;
            v = result.length - 1;
            while (u < v) {
                c = ((u + v) / 2) | 0;
                if (arr[result[c]] < arrI) {
                    u = c + 1;
                } else {
                    v = c;
                }
            }
            if (arrI < arr[result[u]]) {
                if (u > 0) {
                    p[i] = result[u - 1];
                }
                result[u] = i;
            }
        }
    }
    u = result.length;
    v = result[u - 1];
    while (u-- > 0) {
        result[u] = v;
        v = p[v];
    }
    return result;
}

function normalizeClass(value) {
    let res = "";
    if (typeof value === "string") res = value;
    else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; ++i) {
            const normalized = normalizeClass(value[i]);
            if (normalized) res += normalized + " ";
        }
    } else if (typeof value === "object") {
        for (const name in value) {
            if (value[name]) res += name + " ";
        }
    }
    return res.trim();
}

export const renderer = createRenderer({
    createElement(tag) {
        return document.createElement(tag);
    },
    createTextNode(text) {
        return document.createTextNode(text);
    },
    createCommentNode(text) {
        return document.createComment(text);
    },
    setText(el, text) {
        el.nodeValue = text;
    },
    setElementText(el, text) {
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    },
    patchProps(el, key, prevValue, nextValue) {
        if (/^on/.test(key)) {
            const invokers = el._vei || (el._vei = {}); //   vue event invoker
            let invoker = invokers[key];
            const name = key.slice(2).toLowerCase();
            if (nextValue) {
                if (!invoker) {
                    invoker = el._vei[key] = (e) => {
                        if (e.timeStamp < invoker.attached) return;
                        if (Array.isArray(invoker.value)) {
                            invoker.value.forEach((fn) => {
                                fn(e);
                            });
                        } else invoker.value(e);
                    };
                    invoker.value = nextValue;
                    invoker.attached = performance.now();
                    el.addEventListener(name, invoker);
                } else invoker.value = nextValue;
            } else if (invoker) {
                el.removeEventListener(name, invoker);
            }
        } else if (key === "class") {
            nextValue = normalizeClass(nextValue);
            el.className = nextValue;
        } else if (shouldSetAsProps(el, key)) {
            const type = typeof el[key];
            if (type === "boolean" && nextValue === "") el[key] = true;
            else el[key] = nextValue;
        }
    },
});
