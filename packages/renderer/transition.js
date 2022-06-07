export const Transition = {
    name: "Transition",
    setup(props, { slots }) {
        return () => {
            const innerVNode = slots.default();
            const nextFrame = (cb) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        cb();
                    });
                });
            };
            innerVNode.transition = {
                beforeEnter(el) {
                    el.classList.add("enter-from");
                    el.classList.add("enter-active");
                },
                enter(el) {
                    nextFrame(() => {
                        el.classList.remove("enter-from");
                        el.classList.add("enter-to");
                        el.addEventListener("transitionend", () => {
                            el.classList.remove("enter-to");
                            el.classList.remove("enter-active");
                        });
                    });
                },
                leave(el, performRemove) {
                    el.classList.add("leave-from");
                    el.classList.add("leave-active");
                    document.body.offsetHeight;
                    nextFrame(() => {
                        el.classList.remove("leave-from");
                        el.classList.add("leave-to");
                        el.addEventListener("transitionend", () => {
                            el.classList.remove("leave-to");
                            el.classList.remove("leave-active");
                            performRemove();
                        });
                    });
                },
            };
            return innerVNode;
        };
    },
};
