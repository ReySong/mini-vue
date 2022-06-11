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
                arguments: [
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

function createCallExpression(callee, arguments) {
    //  用来创建 CallExpresstion 节点
    return {
        type: "CallExpresstion",
        callee: createIdentifier(callee),
        arguments,
    };
}
