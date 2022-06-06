import { ref, shallowRef } from "../reactivity/index.js";

export function defineAsyncComponent(options) {
    if (typeof options === "function") options = { loader: options };
    const { loader } = options;
    let InnerComp = null;
    let retries = 0;

    function load() {
        return loader().catch((err) => {
            if (options.onError) {
                return new Promise((resolve, reject) => {
                    const retry = () => {
                        resolve(load());
                        ++retries;
                    };
                    const fail = () => reject(err);
                    options.onError(retry, fail, retries);
                });
            } else throw error;
        });
    }

    return {
        name: "AsyncComponetWrapper",
        setup() {
            const loaded = ref(false);
            const error = shallowRef(null);
            const loading = ref(false); //  代表是否正在加载

            let loadingTimer = null;
            if (options.delay) {
                loadingTimer = setTimeout(() => {
                    loading.value = true;
                }, options.delay);
            } else {
                loading.value = true;
            }

            load()
                .then((c) => {
                    InnerComp = c;
                    loaded.value = true;
                })
                .catch((err) => {
                    error.value = err;
                })
                .finally(() => {
                    loading.value = false;
                    clearTimeout(loadingTimer);
                });

            if (options.timeout) {
                setTimeout(() => {
                    const err = new Error(`Async component timed out after ${options.timeout}ms`);
                    error.value = err;
                }, options.timeout);
            }

            const placeholder = { type: "text", children: "This is placeholder" };

            return () => {
                if (loaded.value) return { type: InnerComp };
                else if (error.value && options.errorComponent)
                    return { type: options.errorComponent, props: { error: error.value } };
                else if (loading.value && options.loadingComponent) return { type: options.loadingComponent };
                return placeholder;
            };
        },
    };
}

