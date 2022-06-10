import { parse, transform } from "./packages/compiler/index.js";

let root = parse("<p>Vue</p>");

transform(root);
