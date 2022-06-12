const FunctionDeclNode = {
    type: "FunctionDecl", //  代表该节点是函数声明
    id: {
        type: "Identifier",
        name: "render",
    },
    params: [], //  参数
    body: [
        {
            type: "ReturnStatement",
            return: {
                type: "CallExpresstion",
                callee: {
                    type: "Identifier",
                    name: "h",
                },
                args: [
                    {
                        type: "StringLiteral",
                        value: "div",
                    },
                    {
                        type: "ArrayExpression",
                        elements: [],
                    },
                ],
            },
        },
    ],
};

function createStringLiteral(value) {
    //  用来创建 StringLiteral 节点
    return {
        type: "StringLiteral",
        value,
    };
}

function createIdentifier(name) {
    //  用来创建 Identifier 节点
    return {
        type: "Identifier",
        name,
    };
}

function createArrayExpression(elements) {
    //  用来创建 ArrayExpression 节点
    return {
        type: "ArrayExpression",
        elements,
    };
}

function createCallExpression(callee, args) {
    //  用来创建 CallExpresstion 节点
    return {
        type: "CallExpresstion",
        callee: createIdentifier(callee),
        args,
    };
}

export function dump(node, indent = 0) {
    const type = node.type;
    const desc = node.type === "Root" ? "" : node.type === "Element" ? node.tag : node.content;
    console.log(`${"-".repeat(indent)}${type}: ${desc}`);
    if (node.children) {
        node.children.forEach((n) => dump(n, indent + 2));
    }
}

function traverseNode(ast, context) {
    context.currentNode = ast;

    const exitCbs = []; //  退出阶段回调数组
    const transforms = context.nodeTransforms;
    for (let i = 0; i < transforms.length; ++i) {
        const onExit = transforms[i](context.currentNode, context);
        if (onExit) {
            exitCbs.push(onExit);
        }
    }

    const children = context?.currentNode?.children;
    if (children) {
        for (let i = 0; i < children.length; ++i) {
            context.parent = context.currentNode;
            context.childIndex = i;
            traverseNode(children[i], context);
        }
    }

    let i = exitCbs.length;
    while (i--) {
        exitCbs[i]();
    }
}

export function transform(ast) {
    const context = {
        currentNode: null,
        childIndex: 0, //  当前节点在父节点的 children 中的位置索引
        parent: null,
        replaceNode(node) {
            context.parent.children[context.childIndex] = node;
            context.currentNode = node;
        },
        removeNode() {
            if (context.parent) {
                context.parent.children.splice(context.childIndex, 1);
                context.currentNode = null;
            }
        },
        nodeTransforms: [transformRoot, transformElement, transformText],
    };
    traverseNode(ast, context);
}

function transformText(node) {
    if (node.type !== "Text") return;
    node.jsNode = createStringLiteral(node.content);
}

function transformElement(node) {
    //  将转换逻辑编写在退出逻辑中，这样才能保证处理该节点时其子节点全部处理完毕
    return () => {
        if (node.type !== "Element") return;

        //  1. 创建 h 函数调用语句
        const callExp = createCallExpression("h", [createStringLiteral(node.tag)]);
        //  2. 处理 h 函数调用的参数
        node.children.length === 1
            ? callExp.args.push(node.children[0].jsNode)
            : callExp.args.push(createArrayExpression(node.children.map((c) => c.jsNode)));
        node.jsNode = callExp;
    };
}

function transformRoot(node) {
    return () => {
        if (node.type !== "Root") return;

        const vnodeJSAST = node.children[0].jsNode;
        node.jsNode = {
            type: "FunctionDecl",
            id: {
                type: "Identifier",
                name: "render",
            },
            params: [],
            body: [
                {
                    type: "ReturnStatement",
                    return: vnodeJSAST,
                },
            ],
        };
    };
}
