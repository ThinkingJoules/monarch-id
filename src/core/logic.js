
export function parseReqText(infix,validKeys) {
    //make some pre parsing to make sure input is correct enough to process


    var outputQueue = [];
    var operatorStack = [];
    var operators = {
        "^": {
            precedence: 3,
            associativity: "Left"
        },
        "&": {
            precedence: 2,
            associativity: "Left"
        },
        "|": {
            precedence: 2,
            associativity: "Left"
        }
    }
    //infix = infix.replace(/\s+/g, "");
    infix = clean(infix.split(/([\(\)\s])/))
    for(var i = 0; i < infix.length; i++) {
        var token = infix[i];
        if(token === " ")continue
        let isOperand = ["^","!","&","|"].includes(token)

        if(isOperand && (infix[i-1] !== " " || infix[i+1] !== " ")){
            //operand inside of a string, ignore the operator and join these 3 elements together
            let prev = outputQueue.pop()
            prev += token + infix[i+1]
            outputQueue.push(prev)
            i++
            continue
        }
        if(["^","&","|"].includes(token)) {
            var o1 = token;
            var o2 = operatorStack[operatorStack.length - 1];
            while(["^","!","&","|"].includes(token) && operators[o2] && ((operators[o1].associativity === "Left" && operators[o1].precedence <= operators[o2].precedence) || (operators[o1].associativity === "Right" && operators[o1].precedence < operators[o2].precedence))) {
                outputQueue.push(operatorStack.pop())
                o2 = operatorStack[operatorStack.length - 1];
            }
            operatorStack.push(o1);
        } else if(token === "(") {
            operatorStack.push(token);
        } else if(token === ")") {
            while(operatorStack[operatorStack.length - 1] !== "(") {
                outputQueue.push(operatorStack.pop())
            }
            operatorStack.pop();
        }else if(typeof token === 'string'){
            let test = token
            if(token[0] === '!'){
                test = token.slice(1)
            }
            if(!validKeys.includes(test)){
                throw new Error('Invalid key in logical statement')
            }
            outputQueue.push(token)
        }
    }
    while(operatorStack.length > 0) {
        outputQueue.push(operatorStack.pop())
    }
    return outputQueue;
}

export function evalReqs(postFix,obj){
    const tokens = postFix
    const stack = [];
    let first;
    let second;
    for (let i = 0; i < tokens.length; i++) {
        let token = tokens[i];
        if (token === '^') {
            second = stack.pop();
            first = stack.pop();
            stack.push(!!(!first ^ !second));
            //http://www.howtocreate.co.uk/xor.html
        } else if (token === '&') {
            second = stack.pop();
            first = stack.pop();
            stack.push((first && second));
        } else if (token === '|') {
            second = stack.pop();
            first = stack.pop();
            stack.push((first || second));
        } else {
            let value
            if(token[0] === '!'){
                value = !(obj[token.slice(1)] !== undefined)
            }else{
                value = (obj[token] !== undefined)
            }
            stack.push(value);
        }
    }

    result = stack.pop();

    return result;
}

function clean(arr){
    let a = []
    for(var i = 0; i < arr.length; i++) {
        if(arr[i] !== "") {
            a.push(arr[i])
        }
    }
    return a
}