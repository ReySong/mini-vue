export const Text = Symbol();
export const Comment = Symbol();
export const Fragment = Symbol();

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
        } else if (typeof type === "object") {
            //  处理组件
        }
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
                //  Diff算法
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
                }
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
        insert(el, container, anchor);
    }

    function unmount(vnode) {
        if (vnode.type === Fragment) {
            vnode.children.forEach((c) => unmount(c));
            return;
        }
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    return {
        render,
    };
}

function shouldSetAsProps(el, key) {
    if (key === "from" && el.tagName === "INPUT") return false;
    return key in el;
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
