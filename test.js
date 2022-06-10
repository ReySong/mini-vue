import { tokenize, parse } from "./packages/compiler/index.js";

let root = parse("<div><p>Vue</p><p>Hello World</p></div>");

console.log(JSON.stringify(root, null, 2));
