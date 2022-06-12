export function generate(node) {
    const context = {
        _code: "",
        push(code) {
            context._code += code;
        },
        currentIndent: 0, //  当前缩进的级别
        newLine() {
            context._code += "\n" + " ".repeat(context.currentIndent);
        },
        indent() {
            ++context.currentIndent;
            context.newLine();
        },
        deIndent() {
            --context.currentIndent;
            context.newLine();
        },
    };

    genNode(node, context);

    return context._code;
}

function genNode(node, context) {
    switch (node.type) {
        case "FunctionDecl":
            genFunctionDecl(node, context);
            break;
        case "ReturnStatement":
            genReturnStatement(node, context);
            break;
        case "CallExpresstion":
            genCallExpression(node, context);
            break;
        case "StringLiteral":
            genStringLiteral(node, context);
            break;
        case "ArrayExpression":
            genArrayExpression(node, context);
            break;
    }
}

function genFunctionDecl(node, context) {
    const { push, indent, deIndent } = context;
    push(`function ${node.id.name}(`);
    genNodeList(node.params, context); //  为函数参数生成代码
    push(") {");
    indent();
    node.body.forEach((n) => genNode(n, context));
    deIndent();
    push("}");
}

function genNodeList(nodes, context) {
    const { push } = context;
    for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i];
        genNode(node, context);
        if (i < nodes.length - 1) {
            push(",");
        }
    }
}

function genArrayExpression(node, context) {
    const { push } = context;
    push("[");
    genNodeList(node.elements, context);
    push("]");
}

function genReturnStatement(node, context) {
    const { push } = context;
    push("return ");
    genNode(node.return, context);
}

function genStringLiteral(node, context) {
    const { push } = context;
    push(`'${node.value}'`);
}

function genCallExpression(node, context) {
    const { push } = context;
    const { callee, args } = node;
    push(`${callee.name}(`);
    genNodeList(args, context);
    push(")");
}
