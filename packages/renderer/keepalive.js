import { currentInstance } from "./renderer.js";

export const KeepAlive = {
    __isKeepAlive: true,
    props: {
        include: RegExp,
        exclude: RegExp,
        max: Number, //  缓存池的最大数量
    },
    setup(props, { slots }) {
        const cache = new Map(); //  key: vnode.type; value: vnode
        const cacheStack = [];
        const instance = currentInstance;
        const { move, createElement } = instance.keepAliveCtx;
        const storageContainer = createElement("div");

        instance._deActivate = (vnode) => {
            move(vnode, storageContainer);
        };

        instance._activate = (vnode, container, anchor) => {
            move(vnode, container, anchor);
        };

        return () => {
            const children = slots.default();
            const rawVNode = Array.isArray(children) ? children[0] : children;
            if (children.length > 1) {
                console.error("KeepAlive should contain exactly one component child.");
                return children;
            }

            if (typeof rawVNode.type !== "object") return rawVNode; //  非组件无法被 KeepAlive
            const name = rawVNode.type.name;

            if (
                name &&
                //  无法被 include 匹配
                ((props.include && !props.include.test(name)) ||
                    //  或者被 exclude 匹配
                    (props.exclude && props.exclude.test(name)))
            ) {
                //  直接渲染内部组件
                return rawVNode;
            }

            const cachedVNode = cache.get(rawVNode.type);
            if (cachedVNode) {
                //  有缓存的内容，则不应执行挂载，应该执行激活
                rawVNode.component = cachedVNode.component;
                rawVNode.keptAlice = true; //  添加 keptAlive，避免被渲染器重新挂载
                const index = cacheStack.findIndex((c) => c === rawVNode.type);
                cacheStack.splice(index, 1);
                cacheStack.push(rawVNode.type);
            } else {
                cache.set(rawVNode.type, rawVNode);
                cacheStack.push(rawVNode.type);
                if (cache.size > props.max) {
                    cache.delete(cacheStack.pop());
                }
            }

            rawVNode.shouldKeepAlive = true; //  避免被渲染器卸载
            rawVNode.keepAliceInstance = instance;
            return rawVNode;
        };
    },
};
