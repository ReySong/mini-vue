import { renderer } from "./renderer";

const MyComponent = {
    name: "MyComponent",
    render() {
        return {
            type: "div",
            children: "我是文本内容",
        };
    },
};

const CompVNode = {
    type: MyComponent,
};

const app = document.querySelector("#app");
renderer.render(CompVNode, app);
