const State = {
    initial: 1,
    tagOpen: 2,
    tagName: 3,
    text: 4,
    tagEnd: 5,
    tagEndName: 6,
};

function isAlpha(char) {
    return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
}

export function tokenize(str) {
    let currentState = State.initial;
    const chars = [];
    const tokens = [];
    while (str) {
        const char = str[0];
        switch (currentState) {
            case State.initial:
                if (char === "<") {
                    currentState = State.tagOpen;
                } else if (isAlpha) {
                    currentState = State.text;
                    chars.push(char); //  缓存文本
                }
                str = str.slice(1); //  消费字符
                break;
            case State.tagOpen:
                if (isAlpha(char)) {
                    currentState = State.tagName;
                    chars.push(char);
                } else if (char === "/") {
                    currentState = State.tagEnd;
                }
                str = str.slice(1);
                break;
            case State.tagName:
                if (isAlpha(char)) {
                    chars.push(char);
                } else if (char === ">") {
                    currentState = State.initial; //  切换回初始状态
                    tokens.push({
                        type: "tag",
                        name: chars.join(""),
                    });
                    chars.length = 0;
                }
                str = str.slice(1);
                break;
            case State.text:
                if (char === "<") {
                    currentState = State.tagOpen;
                    tokens.push({
                        type: "text",
                        content: chars.join(""),
                    });
                    chars.length = 0;
                } else if (char) {
                    chars.push(char);
                }
                str = str.slice(1);
                break;
            case State.tagEnd:
                if (isAlpha(char)) {
                    currentState = State.tagEndName;
                    chars.push(char);
                }
                str = str.slice(1);
                break;
            case State.tagEndName:
                if (isAlpha(char)) {
                    chars.push(char);
                } else if (char === ">") {
                    currentState = State.initial;
                    tokens.push({
                        type: "tagEnd",
                        name: chars.join(""),
                    });
                    chars.length = 0;
                }
                str = str.slice(1);
                break;
        }
    }
    return tokens;
}

export function parse(str) {
    const tokens = tokenize(str);
    const root = {
        type: "Root",
        children: [],
    };
    const elementStack = [root];
    while (tokens.length) {
        const parent = elementStack[elementStack.length - 1];
        const t = tokens[0];
        switch (t.type) {
            case "tag":
                const elementNode = {
                    type: "Element",
                    tag: t.name,
                    children: [],
                };
                parent.children.push(elementNode);
                elementStack.push(elementNode);
                break;
            case "text":
                const textNode = {
                    type: "Text",
                    content: t.content,
                };
                parent.children.push(textNode);
                break;
            case "tagEnd":
                elementStack.pop();
                break;
        }
        tokens.shift();
    }
    return root;
}

export function dump(node, indent = 0) {
    const type = node.type;
    const desc = node.type === "Root" ? "" : node.type === "Element" ? node.tag : node.content;
    console.log(`${"-".repeat(indent)}${type}: ${desc}`);
    if (node.children) {
        node.children.forEach((n) => dump(n, indent + 2));
    }
}

export function traverseNode(ast, context) {
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
        nodeTransforms: [transformB, transformA],
    };
    traverseNode(ast, context);
    dump(ast);
}

function transformA() {
    console.log("transformA 进入阶段执行");
    return () => {
        console.log("transformA 结束阶段执行");
    };
}

function transformB() {
    console.log("transformB 进入阶段执行");
    return () => {
        console.log("transformB 结束阶段执行");
    };
}

function transformElement(node) {
    if (node.type === "Element" && node.tag === "p") {
        node.tag = "h1";
    }
}

function transformText(node, context) {
    if (node.type === "Text") {
        // context.replaceNode({
        //     type: "Element",
        //     tag: "span",
        // });
        // context.removeNode();
    }
}
