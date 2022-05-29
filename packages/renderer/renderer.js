export function createRenderer(options = {}) {
    const { createElement, setElementText, insert, patchProps } = options;

    function render(vnode, container) {
        if (vnode) patch(container._vnode, vnode, container);
        else if (container._vnode) container.innerHTML = "";
        container._vnode = vnode;
    }

    function patch(oldVNode, newVNode, container) {
        if (!oldVNode) mountElement(newVNode, container);
        else {
            //  打补丁
        }
    }

    function mountElement(vnode, container) {
        const el = createElement(vnode.type);
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
        insert(el, container);
    }

    return {
        render,
    };
}

function shouldSetAsProps(el, key, value) {
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
    setElementText(el, text) {
        el.textContent = text;
    },
    insert(el, parent, anchor = null) {
        parent.insertBefore(el, anchor);
    },
    patchProps(el, key, prevValue, nextValue) {
        if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key];
            if (type === "boolean" && nextValue === "") el[key] = true;
            else el[key] = nextValue;
        } else {
            if (key === "class") nextValue = normalizeClass(nextValue);
            el.className = nextValue;
        }
    },
});
