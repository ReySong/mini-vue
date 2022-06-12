import { compile } from "./packages/compiler/index.js";

const code = compile("<div><p>Vue</p><p>Hello World</p></div>");

console.log(code);
