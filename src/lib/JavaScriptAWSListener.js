import JavaScriptParser from './JavaScriptParser.js';
import JavaScriptParserListener from './JavaScriptParserListener.js';

export default class JavaScriptAWSListener extends JavaScriptParserListener {

    constructor() {
        super();
        this.SDKDeclarations = [];
        this.ClientDeclarations = [];
        this.ClientCalls = [];
        this.VariableDeclarations = [];
    }

    generateObjectLiteralMap(treeitem) {
        let propertyMap = {};

        for (let objectLiteralChild of treeitem.children[0].children) {
            if (objectLiteralChild instanceof JavaScriptParser.PropertyExpressionAssignmentContext) {
                let propertyName = objectLiteralChild.children[0].getText().replace(/^['"](.*)['"]$/g, '$1'); // blah = {###'abc'###: 'def'}
                if (objectLiteralChild.children[2] instanceof JavaScriptParser.LiteralExpressionContext) { // blah = {'abc': ###'def'###}
                    let propertyValue = objectLiteralChild.children[2].getText().replace(/^['"](.*)['"]$/g, '$1');
                    propertyMap[propertyName] = {
                        'type': 'literal',
                        'value': propertyValue
                    };
                }
                if (objectLiteralChild.children[2] instanceof JavaScriptParser.ObjectLiteralExpressionContext) { // blah = {'abc': ###{...}###}
                    propertyMap[propertyName] = {
                        'type': 'object',
                        'value': this.generateObjectLiteralMap(objectLiteralChild.children[2])
                    };
                }
            }
        }

        return propertyMap;
    }

    resolvePropertyMap(obj) {
        let ret = {};

        for (let k of Object.keys(obj)) {
            if (obj[k].type == "object") {
                ret[k] = this.resolvePropertyMap(obj[k].value);
            } else {
                ret[k] = obj[k].value;
            }
        }

        return ret;
    }

    resolveArgs(argsRaw) {
        let args = {};

        for (let argument of argsRaw.children) {
            if (argument instanceof JavaScriptParser.ArgumentContext) {
                if (argument.children.length == 1) { // blah(###abc###) 
                    if (argument.children[0] instanceof JavaScriptParser.IdentifierExpressionContext) {
                        let argumentsVariable = argument.children[0].getText();

                        for (let variable of this.VariableDeclarations) {
                            if (variable.variable == argumentsVariable) {
                                if (variable.type == "object") {
                                    args = this.resolvePropertyMap(variable.propertyMap);
                                }
                            }
                        }
                    }
                }
                // else blah(...###x###, )
            }
        }

        return args;
    }

    exitAssignmentExpression(ctx) {
        this.aggregateVariableOrAssignmentDeclaration(ctx);
    }

    exitVariableDeclaration(ctx) {
        this.aggregateVariableOrAssignmentDeclaration(ctx);
    }

    aggregateVariableOrAssignmentDeclaration(ctx) {
        const assignable = ctx.children[0]; // ### = blah
        if (assignable.children.length && assignable.children[0] instanceof JavaScriptParser.IdentifierContext) {
            if (ctx.children.length == 3) {
                const expression = ctx.children[2]; // blah = ###

                if (expression instanceof JavaScriptParser.ArgumentsExpressionContext) { // find SDK requires
                    if (expression.children[0].getText() == "require" && ["('aws-sdk')", "(\"aws-sdk\")"].includes(expression.children[1].getText())) {
                        this.SDKDeclarations.push({
                            'variable': assignable.getText()
                        });
                    }
                }

                if (expression instanceof JavaScriptParser.NewExpressionContext) { // find client instantiations
                    const className = expression.children[1]; // new ### (...)
                    let argsRaw = null;
                    if (expression.children.length == 3) {
                        argsRaw = expression.children[2]; // new blah###(...)###
                    }
                    if (className instanceof JavaScriptParser.MemberDotExpressionContext) { // blah.blah
                        const namespace = className.children[0] // ###.blah
                        const method = className.children[className.children.length - 1] // blah.###
                        let foundDeclaration = false;

                        for (let sdkDeclaration of this.SDKDeclarations) {
                            if (namespace.getText() == sdkDeclaration['variable']) {
                                this.ClientDeclarations.push({
                                    'type': method.getText(),
                                    'variable': assignable.getText(),
                                    'argsRaw': argsRaw,
                                    'sdk': sdkDeclaration
                                });
                                foundDeclaration = true;
                                break;
                            }
                        }
                        if (!foundDeclaration && namespace.getText() == "AWS") { // 2nd chance default
                            this.ClientDeclarations.push({
                                'type': method.getText(),
                                'variable': assignable.getText(),
                                'argsRaw': argsRaw,
                                'sdk': null
                            });
                        }
                    }
                }

                if (expression instanceof JavaScriptParser.ObjectLiteralExpressionContext) { // blah = ###{...}###
                    this.VariableDeclarations.push({
                        'variable': assignable.getText(),
                        'type': 'object',
                        'propertyMap': this.generateObjectLiteralMap(expression)
                    });
                }
            }
        }
    }

    exitArgumentsExpression(ctx) {
        const callMethod = ctx.children[0] // ###()
        const argsRaw = ctx.children[1] // blah###
        if (callMethod instanceof JavaScriptParser.MemberDotExpressionContext) {
            const namespace = callMethod.children[0] // ###.blah
            const method = callMethod.children[callMethod.children.length - 1] // blah.###

            for (let clientDeclaration of this.ClientDeclarations) {
                if (namespace.getText() == clientDeclaration['variable']) {
                    this.ClientCalls.push({
                        'client': clientDeclaration,
                        'method': method.getText(),
                        'argsRaw': argsRaw,
                        'args': this.resolveArgs(argsRaw)
                    });
                    break;
                }
            }
        }
	}
}