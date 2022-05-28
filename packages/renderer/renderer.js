export function createRenderer(options = {}) {
    const { createElement, setElementText, insert } = options;

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
        insert(el, container);
    }

    return {
        render,
    };
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
});
