import { compile } from "./packages/compiler/index.js";

const code = compile("<p>Vue</p>");

console.log(code);
