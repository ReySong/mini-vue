import { parse } from "./parse.js";
import { transform } from "./transform.js";
import { generate } from "./generate.js";

export function compile(template) {
    const ast = parse(template);
    transform(ast);
    const code = generate(ast.jsNode);
    return code;
}
