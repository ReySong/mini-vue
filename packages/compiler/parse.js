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
