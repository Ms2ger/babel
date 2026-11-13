import { declare } from "@babel/helper-plugin-utils";
import syntaxTypeScript from "@babel/plugin-syntax-typescript";
import { generate } from "@babel/generator";
import type {
  PluginPass,
  types as t,
  Scope,
  NodePath,
  Visitor,
} from "@babel/core";
import { injectInitialization } from "@babel/helper-create-class-features-plugin";
import type { Options as SyntaxOptions } from "@babel/plugin-syntax-typescript";

import transpileConstEnum from "./const-enum.ts";
import type { NodePathConstEnum } from "./const-enum.ts";
import transpileEnum from "./enum.ts";
import {
  GLOBAL_TYPES,
  isGlobalType,
  registerGlobalType,
} from "./global-types.ts";
import transpileNamespace, { getFirstIdentifier } from "./namespace.ts";
import {
  classPrivateProperty,
  FunctionParameter,
  isArrayExpression,
  isArrayPattern,
  isAssignmentPattern,
  isClassMethod,
  isClassPrivateMethod,
  isClassPrivateProperty,
  isExportDeclaration, isExportDefaultDeclaration, isExpression, isFunctionDeclaration, isFunctionExpression,
  isFunctionParameter,
  isIdentifier, isImportDefaultSpecifier, isImportExpression, isImportNamespaceSpecifier, isImportSpecifier,
  isMemberExpression,
  isNumericLiteral,
  isObjectMember,
  isObjectMethod,
  isObjectProperty,
  isPrivateName,
  isReturnStatement,
  isSpreadElement,
  isStringLiteral, isTSAsExpression, isTSLiteralType, isTSParameterProperty, isTSPropertySignature, isTSTypeReference, isTypeAnnotation, isTypeParameterDeclaration, isVoidPattern, privateName, stringTypeAnnotation, tsBigIntKeyword, tsBooleanKeyword, tsDeclareFunction,
  TSLiteralType,
  tsLiteralType,
  tsMethodSignature,
  tsNeverKeyword,
  tsNumberKeyword,
  tsPropertySignature,
  tsStringKeyword,
  TSType,
  tsTypeAnnotation,
  TSTypeAnnotation,
  tsTypeLiteral,
  TSTypeParameter,
  TSTypeParameterDeclaration,
  tsUndefinedKeyword,
  TypeParameterDeclaration
} from "@babel/types";
// import { Identifier } from "../../babel-generator/src/node/parentheses.ts";
// import { ImportDeclaration } from "../../babel-generator/src/generators/modules.ts";

function isInType(path: NodePath) {
  switch (path.parent.type) {
    case "TSTypeReference":
    case "TSClassImplements":
    case "TSInterfaceHeritage":
    case "TSTypeQuery":
      return true;
    case "TSQualifiedName":
      return (
        // `import foo = ns.bar` is transformed to `var foo = ns.bar` and should not be removed
        path.parentPath.findParent(path => path.type !== "TSQualifiedName")!
          .type !== "TSImportEqualsDeclaration"
      );
    case "ExportSpecifier":
      return (
        // export { type foo };
        path.parent.exportKind === "type" ||
        // export type { foo };
        // @ts-expect-error: DeclareExportDeclaration does not have `exportKind`
        (path.parentPath as NodePath<t.ExportSpecifier>).parent.exportKind ===
          "type"
      );
    default:
      return false;
  }
}

// Track programs which contain imports/exports of values, so that we can include
// empty exports for programs that do not, but were parsed as modules. This allows
// tools to infer unambiguously that results are ESM.
const NEEDS_EXPLICIT_ESM = new WeakMap();
const PARSED_PARAMS = new WeakSet();

// A hack to avoid removing the impl Binding when we remove the declare NodePath
function safeRemove(path: NodePath) {
  const ids = path.getBindingIdentifiers();
  for (const name of Object.keys(ids)) {
    const binding = path.scope.getBinding(name);
    if (binding?.identifier === ids[name]) {
      binding.scope.removeBinding(name);
    }
  }
  path.opts.noScope = true;
  path.remove();
  path.opts.noScope = false;
}

function assertCjsTransformEnabled(
  path: NodePath,
  pass: PluginPass,
  wrong: string,
  suggestion: string,
  extra: string = "",
): void {
  if (pass.file.get("@babel/plugin-transform-modules-*") !== "commonjs") {
    throw path.buildCodeFrameError(
      `\`${wrong}\` is only supported when compiling modules to CommonJS.\n` +
        `Please consider using \`${suggestion}\`${extra}, or add ` +
        `@babel/plugin-transform-modules-commonjs to your Babel config.`,
    );
  }
}

export interface Options extends SyntaxOptions {
  /** @default true */
  allowNamespaces?: boolean;
  /** @default "React.createElement" */
  jsxPragma?: string;
  /** @default "React.Fragment" */
  jsxPragmaFrag?: string;
  onlyRemoveTypeImports?: boolean;
  optimizeConstEnums?: boolean;
}

type ExtraNodeProps = {
  declare?: unknown;
  accessibility?: unknown;
  abstract?: unknown;
  optional?: unknown;
  override?: unknown;
};

export default declare((api, opts: Options) => {
  // `@babel/core` and `@babel/types` are bundled in some downstream libraries.
  // Ref: https://github.com/babel/babel/issues/15089
  const { types: t, template, traverse } = api;

  api.assertVersion(REQUIRED_VERSION("^7.0.0-0 || ^8.0.0"));

  const JSX_PRAGMA_REGEX = /\*?\s*@jsx((?:Frag)?)\s+(\S+)/;

  const {
    allowNamespaces = true,
    jsxPragma = "React.createElement",
    jsxPragmaFrag = "React.Fragment",
    onlyRemoveTypeImports = false,
    optimizeConstEnums = false,
  } = opts;

  const classMemberVisitors = {
    field(
      path: NodePath<
        (t.ClassPrivateProperty | t.ClassProperty | t.ClassAccessorProperty) &
          ExtraNodeProps
      >,
    ) {
      const { node } = path;

      if (node.declare) {
        if (node.value) {
          throw path.buildCodeFrameError(
            `Fields with the 'declare' modifier cannot be initialized here, but only in the constructor`,
          );
        }
        if (!node.decorators) {
          path.remove();
        }
      } else if (node.definite) {
        if (node.value) {
          throw path.buildCodeFrameError(
            `Definitely assigned fields cannot be initialized here, but only in the constructor`,
          );
        }
      } else if (node.abstract) {
        path.remove();
      }
    },
    method({ node }: NodePath<t.ClassMethod | t.ClassPrivateMethod>) {
    },
    constructor(path: NodePath<t.ClassMethod>, classPath: NodePath<t.Class>) {
      // if (path.node.accessibility) path.node.accessibility = null;
      // Collects parameter properties so that we can add an assignment
      // for each of them in the constructor body
      //
      // We use a WeakSet to ensure an assignment for a parameter
      // property is only added once. This is necessary for cases like
      // using `transform-classes`, which causes this visitor to run
      // twice.
      const generatedProperties: t.ClassProperty[] = [];
      const { scope } = path;
      for (const paramPath of path.get("params")) {
        if (paramPath.isTSParameterProperty()) {
          const param = paramPath.node;
          const parameter = param.parameter;
          if (PARSED_PARAMS.has(parameter)) continue;
          PARSED_PARAMS.add(parameter);
          let id = translateFunctionParameter(parameter);
          if (!isIdentifier(id)) {
            throw paramPath.buildCodeFrameError(
              "Parameter properties can not be destructuring patterns.",
            );
          }
          let newNode = t.classProperty(
            t.cloneNode(id),
            undefined,
            t.cloneNode(id.typeAnnotation)
          );
          newNode.accessibility = param.accessibility;
          newNode.readonly = param.readonly;
          generatedProperties.push(newNode);

          paramPath.replaceWith(id);
          scope.registerBinding("param", paramPath);
        }
      }
      classPath.node.body.body.unshift(
        ...generatedProperties
      )
    },
  };

  function translateTypeParameters(arg: TSTypeParameterDeclaration | TypeParameterDeclaration | null | undefined): TSTypeParameterDeclaration | null | undefined {
    if (isTypeParameterDeclaration(arg)) {
      // TODO
      throw new Error(`Unexpected Flow TypeParameterDeclaration ${arg}`);
    }
    return arg;
  }
  function translateTypeAnnotation(arg: t.TypeAnnotation | TSTypeAnnotation) : TSTypeAnnotation {
    if (isTypeAnnotation(arg)) {
      // TODO
      throw new Error(`Unexpected Flow TypeAnnotation ${arg}`);
    }
    return arg;
  }
  function translateFunctionParameter(param: t.FunctionParameter):
    (t.ArrayPattern | t.Identifier | t.ObjectPattern | t.RestElement) // TODO review - all of those?
  {
    if (isVoidPattern(param)) {
      throw new Error("Void patterns not supported");
    }
    if (isAssignmentPattern(param)) {
      if (!isIdentifier(param.left)) {
        throw new Error("Assignment pattern in function parameter only supported with identifier LHS");
      }
      let typeAnnotation: t.TSTypeAnnotation;
      if (param.left.typeAnnotation) {
        typeAnnotation = translateTypeAnnotation(param.left.typeAnnotation);
      } else {
        let inferred = inferType(param.right, InferApproach.Widen);
        if (!inferred) {
          throw new Error("Could not infer type from RHS of assignment pattern");
        }
        typeAnnotation = tsTypeAnnotation(inferred);
      }
      param = param.left;
      param.optional = true;
      param.typeAnnotation = typeAnnotation;
    }
    if (!param.typeAnnotation) {
      throw new Error(`Explicit parameter type is required`);
    }
    // if (isIdentifier(param)) {
    //   return param;
    // }
    // throw new Error(`translateFunctionParameter found ${param.type}`)
    return param;
  }
  function translateFunctionParameters(origParams: t.FunctionParameter[]):
    (t.ArrayPattern | t.Identifier | t.ObjectPattern | t.RestElement)[] // TODO review - all of those?
  {
    return origParams.map(translateFunctionParameter);
  }
  function inferFunctionType(declaration : t.Function): [
      TSTypeParameterDeclaration | null | undefined,
      (t.ArrayPattern | t.Identifier | t.ObjectPattern | t.RestElement)[], // TODO review - all of those?
      t.TSTypeAnnotation | null | undefined
  ] {
    if (!declaration.params.every(p => isFunctionParameter(p))) {
      throw new Error(`Unexpected parameter property`)
    }
    return [
      translateTypeParameters(declaration.typeParameters), // TODO test type parameters
      translateFunctionParameters(declaration.params as FunctionParameter[]),
      declaration.returnType ? translateTypeAnnotation(declaration.returnType) : declaration.returnType,
    ]
  }

  enum InferApproach {
    Default,
    Widen,
    Const,
  }
  function inferType(declaration: t.Statement | t.Expression, approach: InferApproach = InferApproach.Default): TSType | undefined {
    if (!declaration) {
      throw new Error("Missing declaration in inferType()")
    }
    if (isTSAsExpression(declaration)) {
      let typeAnnotation = declaration.typeAnnotation;
      if (isTSTypeReference(typeAnnotation) && typeAnnotation.typeName.name === "const") {
        let inferred = inferType(declaration.expression, InferApproach.Const);
        console.log(inferred);
        // throw 1
        return inferred;
      }
      return typeAnnotation;
    }
    if (isFunctionExpression(declaration)) {
      let [typeParameters, params, returnType] = inferFunctionType(declaration);
      if (!returnType) {
        // TODO test
        throw new Error(`Explicit return type is required`)
      }
      return t.tsFunctionType(
        typeParameters,
        params,
        returnType,
      )
    }
    // console.log("inferType:", declaration)

    if (isArrayExpression(declaration)) {
      if (approach !== InferApproach.Const) {
        throw new Error("Can't infer array type unless it's const")
      }
      let elementTypes: t.TSType[] = [];
      for (const elt of declaration.elements) {
        if (isSpreadElement(elt)) {
          throw new Error("Can't infer array type with spread element")
        }
        let inferred = elt ? inferType(elt, approach) : tsUndefinedKeyword();
        if (!inferred) {
          throw new Error("Can't infer type for array element");
        }
        elementTypes.push(
          inferred
        );
      }
      let tupleType = t.tsTupleType(elementTypes);
      return t.tsTypeOperator(tupleType, "readonly");
    }

    switch (declaration.type) {
      case "TemplateLiteral": {
        if (declaration.expressions.length) {
          throw new Error(`Template literal with expressions not supported`)
        }
        // TODO: any edge cases?
        if (approach === InferApproach.Widen) {
          return tsStringKeyword();
        }
        return tsLiteralType(t.stringLiteral(declaration.quasis[0].value.raw));
      }
      case "UnaryExpression": {
        const {operator: op, argument: arg} = declaration;
        // These seem to be the only cases ts supports.
        if (op !== "+" && op !== "-") {
          throw new Error(`Unary operator ${op} not supported`);
        }
        if (arg.type !== "NumericLiteral" && arg.type !== "BigIntLiteral") {
          throw new Error(`Unary operator ${op} not supported with argument ${arg}`);
        }
        if (approach === InferApproach.Widen) {
          return arg.type === "NumericLiteral" ? tsNumberKeyword() : tsBigIntKeyword();
        }
        if (op === "+") {
          return tsLiteralType(t.cloneNode(arg));
        }
        if (op === "-") {
          return tsLiteralType(t.cloneNode(declaration));
        }
      }
      case "StringLiteral": {
        if (approach === InferApproach.Widen) {
          return tsStringKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "NumericLiteral": {
        if (approach === InferApproach.Widen) {
          return tsNumberKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "BigIntLiteral": {
        if (approach === InferApproach.Widen) {
          return tsBigIntKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "BooleanLiteral": {
        if (approach === InferApproach.Widen) {
          return tsBooleanKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "ObjectExpression": {
          // TODO rm PrivateName
          function referenceToGlobalSymbol(key: t.Expression): t.Expression | t.PrivateName | undefined {
            if (!isMemberExpression(key)) {
              return undefined;
            }
            if (isIdentifier(key.object) && key.object.name === "Symbol") {
              // TODO: check this is a reference to the real Symbol
              // TODO: check the property is valid
              return key.property;
            }
            if (isMemberExpression(key.object) &&
                isIdentifier(key.object.object) && key.object.object.name === "globalThis" &&
                isIdentifier(key.object.property) && key.object.property.name === "Symbol") {
              // TODO: check this is a reference to the real Symbol
              // TODO: check the property is valid
              return key.property;
            }
            return undefined;
          }
          let members = declaration.properties.map((prop: t.ObjectProperty | t.ObjectMethod | t.SpreadElement) => {
          // TODO factor out
          if (isSpreadElement(prop)) {
            throw new Error(`Object with spread assignment not supported`);
          }
          if (isPrivateName(prop.key)) {
            throw new Error(`Unexpected private name`);
          }
          let key = t.cloneNode(prop.key);
          let symbol;
          if (prop.computed) {
            if (isStringLiteral(key)) {
              key = t.identifier(key.value);
            } else if (isNumericLiteral(key)) {
              // Fine
            } else if ((symbol = referenceToGlobalSymbol(key))) {
              // TODO: ts supports keys like `[Symbol.hasInstance]`
              if (!isIdentifier(symbol)) {
                throw new Error(`Unexpected property key ${generate(key).code}`)
              }
            } else {
              throw new Error(`Unexpected property key ${key}`)
            }
          }
          let signature;
          if (isObjectMethod(prop)) {
            let [typeParameters, params, returnType] = inferFunctionType(prop)
            if (!returnType) {
              // TODO test
              throw new Error(`Explicit return type is required`)
            }
            signature = tsMethodSignature(
              key,
              typeParameters,
              params,
              returnType,
            );
          } else {
            let inferred;
            if (!prop.value) {
              console.log(key)
              throw new Error(`Property without value in object literal (${key})`)
            }
            inferred = inferType(
              prop.value,
              approach === InferApproach.Const ? InferApproach.Const : InferApproach.Widen // XXX check approach
            );
            if (!inferred) {
              throw new Error(`Untyped property in object literal (${key})`)
            }
            signature = tsPropertySignature(
              key,
              t.tsTypeAnnotation(inferred)
            );
            if (approach === InferApproach.Const) {
              signature.readonly = true;
            }
          }
          return signature;
        })
        let literal = tsTypeLiteral(members);
        return literal;
      }
      default: {
        break;
      }
    }

  }
  function isReachableFromExport(id: string | undefined, scope) : boolean {
    console.log(`isReachableFromExport(${id})`)
    // console.log(scope)
    if (!id) {
      return false;
    }
    let binding = scope.getBinding(id);
    if (!binding) {
      // throw new Error(`Unexpected missing binding for id ${id}`);
      console.error(`Unexpected missing binding for id ${id}`);
      return true;
    }
    // console.log(`binding: referencePaths for ${id} are`, binding?.referencePaths)
    for (const ref of binding.referencePaths) {
      if (ref.container.type === "ExportSpecifier") {
        return true;
      }
      if (ref.container.type === "TSTypeReference") {
        // FIXME implement
        continue;
        // FIXME bad perf likely
        // console.log(ref)
        // let parent = ref.parentPath.parentPath;
        // console.log("parent.type = ", parent.node.type)
        // console.log(`parent.scope === scope: ${parent.scope === scope}`)
        // return isReachableFromExport(parent.node.id.name, parent.scope)

        // FIXME ref.container.typeName.name is the
      }
      console.log("ref.container.type = ",ref.container.type)


    }

    return false;
  }
  function isExported(path: NodePath) {
    let parent: NodePath = path;
    let isExport = false, isDefaultExport = false;
    while ((parent = parent.parentPath)) {
      if (isExportDefaultDeclaration(parent.node)) {
        isDefaultExport = true;
        break;
      }
      if (isExportDeclaration(parent.node)) {
        isExport = true;
        break;
      }
    }
    console.log(`isExport=${isExport}`)
    return [isExport, isDefaultExport];
  }


  const seen = new WeakSet();
  return {
    name: "transform-typescript2",
    inherits: syntaxTypeScript,

    visitor: traverse.explode({

      //"Pattern" alias doesn't include Identifier or RestElement.
      Pattern: visitPattern,
      Identifier: visitPattern,
      RestElement: visitPattern,


      // BlockStatement(path) {
      //   path.skip();
      // },
      Program: {
        enter(path, state) {
          // throw 7;
          const { file } = state;
          // console.log(file);
          let fileJsxPragma = null;
          let fileJsxPragmaFrag = null;
          const programScope = path.scope;

          if (!GLOBAL_TYPES.has(programScope)) {
            GLOBAL_TYPES.set(programScope, new Set());
          }

          if (file.ast.comments) {
            for (const comment of file.ast.comments) {
              const jsxMatches = JSX_PRAGMA_REGEX.exec(comment.value);
              if (jsxMatches) {
                if (jsxMatches[1]) {
                  // isFragment
                  fileJsxPragmaFrag = jsxMatches[2];
                } else {
                  fileJsxPragma = jsxMatches[2];
                }
              }
            }
          }

          let pragmaImportName = fileJsxPragma || jsxPragma;
          if (pragmaImportName) {
            [pragmaImportName] = pragmaImportName.split(".");
          }

          let pragmaFragImportName = fileJsxPragmaFrag || jsxPragmaFrag;
          if (pragmaFragImportName) {
            [pragmaFragImportName] = pragmaFragImportName.split(".");
          }

          // remove type imports
          for (let stmt of path.get("body") as Iterable<
            NodePath<t.Statement | t.Expression>
          >) {
            if (!(
              stmt.isImportDeclaration() ||
              stmt.isExportDeclaration() ||
              false
            )) {
              // stmt.remove(); // FIXME
            }
          }

        },
        exit(path) {
          // console.log(output);
          // path.node.body = output.filter(x => typeof x === "object");
          // if (
          //   path.node.sourceType === "module" &&
          //   NEEDS_EXPLICIT_ESM.get(path.node)
          // ) {
          //   // If there are no remaining value exports, this file can no longer
          //   // be inferred to be ESM. Leave behind an empty export declaration
          //   // so it can be.
          //   path.pushContainer("body", t.exportNamedDeclaration());
          // }
        },
      },
      EmptyStatement(path) {
        path.remove();
      },
      ImportDeclaration(path, state) {

        // let node;
        if (path.node.importKind === "type") {
          // node = path.node;
        } else {
          console.log('---ImportDeclaration---', generate(path.node).code)
          // console.log('---ImportDeclaration---', path.node.specifiers)
          const specifiers = path.node.specifiers.filter(sp => {
            let result = (() => {
              if (isImportDefaultSpecifier(sp)) {
                // TODO test more deeply
                return isReachableFromExport(sp.local.name, path.scope);
              }
              if (isImportNamespaceSpecifier(sp)) {
                // TODO test more deeply
                return isReachableFromExport(sp.local.name, path.scope);
              }
              if (isImportSpecifier(sp)) {
                return sp.importKind == "type" // how about "typeof"?
                  || isReachableFromExport(sp.local.name, path.scope);
              }
              throw new Error(`Unexpected specifier ${sp}`);
            })();
            console.log('---ImportDeclaration---', result);
            return result;
          });
          if (!specifiers.length) {
            path.remove();
            return;
          }
          let node = t.importDeclaration(specifiers, path.node.source, path.node.attributes);
          path.replaceWith(node);
          path.skip();
        }
      },
      // ImportDeclaration: {
      // },
      // ImportSpecifier(path, state) {
      // },
      ExportNamedDeclaration(path, state) {
      },

      ExportAllDeclaration(path) {
      },

      ExportSpecifier(path) {
      },

      ExportDefaultDeclaration: {
        enter(path) {
          function addExplicitVariable(declaration: TSLiteralType) {
            let id = t.identifier("_default");
            id.typeAnnotation = t.tsTypeAnnotation(
              declaration
            );
            let constDecl: t.VariableDeclarator = t.variableDeclarator(
              id,
              declaration.literal
            );
            let newConst = t.variableDeclaration("const", [
              constDecl
            ]);
            let newExport = t.exportDefaultDeclaration(t.identifier("_default"));
            path.replaceWithMultiple([
              newConst,
              newExport,
            ]);
            path.scope.registerBinding("const", path); // TODO check
          }
          let {node} = path;
          if (!isFunctionDeclaration(node.declaration)) {
            let inferred = inferType(node.declaration);
            if (inferred && isTSLiteralType(inferred)) {
              addExplicitVariable(inferred);
            }
          }
        },
        exit() {
        },
      },

      FunctionDeclaration: {
        enter(path) {
          let node = path.node;
          console.log(`---FunctionDeclaration ${path.node.id?.name}`)
          let [isExport, isDefaultExport] = isExported(path);
          console.log(`isExport=${isExport}`)
          if (!isExport && !isDefaultExport && !isReachableFromExport(path.node.id?.name, path.scope)) {
            console.log("    -- skipping")
            path.remove();
            return;
          }
          console.log("    -- not skipping")
          // dts("FunctionDeclaration", `function ${node.id?.name ?? ""}(): `);
          if (!node.returnType) {
            let returns: t.ReturnStatement[] = node.body.body.filter(isReturnStatement);
            if (returns.length === 1) {
              let inferred = inferType(returns[0].argument)
              console.log("inferred from return statement", inferred)
              if (inferred) {
                node.returnType = tsTypeAnnotation(inferred);
              }

            }
            if (!node.returnType) {
              throw new Error(`Must declare the return type of function ${node.id?.name ?? ""}`);
            }
          }
          let newNode = t.tsDeclareFunction(
            t.cloneNode(node.id),
            t.cloneNode(translateTypeParameters(node.typeParameters)),
            node.params,
            t.cloneNode(translateTypeAnnotation(node.returnType)));
          if (!isDefaultExport) {
            newNode.declare = true;
          }
          path.replaceWith(newNode);

        },
        exit() {
        },
      },
      StringLiteral(path) {
      },
      TSTypeAnnotation(path) {
        // TODO not unreached
      },
      TSTypeAliasDeclaration(path) {
        // TODO not unreached
        path.skip();
      },
      TSType({node}) {
      },
      TSDeclareFunction(path) {
        // TODO
      },

      TSDeclareMethod(path) {
        let node = path.node;
        if (node.accessibility === "private") {
          if (node.kind === "method") {
            // Duplicated below
            let newNode = t.classProperty(
              t.cloneNode(node.key),
              undefined,
              undefined,
              /* todo decorators */ undefined,
              node.computed,
              node.static
            );
            newNode.accessibility = "private";
            path.replaceWith(newNode);
            return;
          }
          // TODO review.
          node.returnType = null;
        }
      },

      BlockStatement: {
        exit(path) {
          console.log("BlockStatement", path.node.body)
          if (path.node.body.length) {
            path.replaceWithMultiple(path.node.body);
          } else {
            path.remove();
          }
        }
      },

      VariableDeclaration(path) {
        if (seen.has(path.node)) {
          return;
        }
        console.log("VariableDeclaration:", generate(path.node).code);
        // console.log("VariableDeclaration: before=", path.node.declarations)
        const vars = path.node.declarations.filter(decl => {
          if (!isIdentifier(decl.id)) {
            return false;
          }
          let [isExport, isDefaultExport] = isExported(path);
          return isExport || isDefaultExport || isReachableFromExport(decl.id.name, path.scope);
        }).map(decl => {
          const declarator = t.cloneNode(decl);
          if (!isIdentifier(declarator.id)) {
            throw undefined;
          }
          if (!declarator.id.typeAnnotation) {
            let inferred = inferType(declarator.init, path.node.kind === "const" ? InferApproach.Default : InferApproach.Widen);
            if (!inferred) {
              inferred = tsNeverKeyword();
              throw 12
            }
            // TODO clean up
            if (isTSAsExpression(declarator.init) && isTSTypeReference(declarator.init.typeAnnotation) && declarator.init.typeAnnotation.typeName.name === "const") {
              // export declare const a: 7;
              declarator.id.typeAnnotation = t.tsTypeAnnotation(inferred);
              declarator.init = null;
            } else if (path.node.kind !== "const" || !isTSLiteralType(inferred)) {
              // export declare const a: 7;
              declarator.id.typeAnnotation = t.tsTypeAnnotation(inferred);
              declarator.init = null;
            } else {
              // export declare const a = 7;
            }
          } else {
            declarator.init = null;
          }
          return declarator;
        });
        // console.log("VariableDeclaration: after=", vars)
        if (!vars.length) {
          console.log("VariableDeclaration: removing decl")
          path.remove();
          return;
        }
        let decl = t.variableDeclaration(path.node.kind, vars);
        decl.declare = true;
        path.replaceWith(decl);
        seen.add(decl);
      },

      VariableDeclarator({ node }) {
        if (node.definite) node.definite = null;
      },

      TSIndexSignature(path) {
        path.remove();
      },

      ClassDeclaration(path) {
        const { node } = path;
        node.declare = true;
      },
      ClassProperty(path) {
        path.node.value = null;
        if (path.node.accessibility === "private") {
          path.node.typeAnnotation = null;
        } else if (path.node.accessibility === "public") {
          path.node.accessibility = null;
        }
      },
      ClassPrivateProperty(path) {
        // console.log("ClassPrivateProperty", path.node)
        if (path.node.key.id.name !== "private") {
          throw new Error("This should have been filtered out already");
        }
      },
      ClassPrivateMethod(path) {
        throw new Error("This should have been filtered out already");
      },

      ClassMethod(path) {
        let node: t.ClassMethodComputed | t.ClassMethodNonComputed = path.node;

        switch (node.kind) {
          case "method": {
            if (!node.returnType && node.accessibility !== "private") {
              throw new Error(`Must declare the return type of method`);
            }
            break;
          }
          case "constructor": {
            break;
          }
          case "get": {
            break;
          }
          case "set": {
            break;
          }

        }
        let [typeParameters, params, returnType] = inferFunctionType(node);
        // Note: private methods will be replaced again in TSDeclareMethod.
        let newNode: t.TSDeclareMethod = t.tsDeclareMethod(
          t.cloneNode(node.key),
          t.cloneNode(typeParameters),
          node.accessibility === "private" ? [] : params,
          t.cloneNode(returnType)
        );
        newNode.computed = node.computed; // TODO weird things happening with type annotation
        // console.log("~~~ClassMethod: ", node.key, node.accessibility === "private", newNode.returnType)
        newNode.kind = node.kind;
        newNode.static = node.static;

        // XXX What's the difference between these?
        newNode.access = node.access;
        newNode.accessibility = node.accessibility === "public" ? null : node.accessibility;

        path.replaceWith(newNode);
      },
      StaticBlock(path) {
        path.remove();
      },

      Class(path) {
        const { node }: { node: typeof path.node & ExtraNodeProps } = path;
        let filtered = node.body.body.filter(field =>
          !isClassPrivateProperty(field) &&
          !isClassPrivateMethod(field)
        );
        let hasPrivate = node.body.body.length !== filtered.length;
        node.body.body = filtered;
        if (hasPrivate) {
          node.body.body.unshift(
            classPrivateProperty(
              privateName(t.identifier("private"))
            )
          )
        }

        // Similar to the logic in `transform-flow-strip-types`, we need to
        // handle `TSParameterProperty` and `ClassProperty` here because the
        // class transform would transform the class, causing more specific
        // visitors to not run.
        path.get("body.body").forEach(child => {
          if (child.isClassMethod() || child.isClassPrivateMethod()) {
            if (child.node.kind === "constructor") {
              classMemberVisitors.constructor(
                // @ts-expect-error A constructor must not be a private method
                child,
                path,
              );
            } else {
              classMemberVisitors.method(child);
            }
          } else if (
            child.isClassProperty() ||
            child.isClassPrivateProperty() ||
            child.isClassAccessorProperty()
          ) {
            classMemberVisitors.field(child);
          }
        });
      },
      Function(path) {
        const { node } = path;
        console.log(generate(path.node).code)
        throw 7
        // TODO review
        // const params = node.params;
        // if (params.length > 0 && t.isIdentifier(params[0], { name: "this" })) {
        //   params.shift();
        // }
      },

      TSModuleDeclaration(path) {
        transpileNamespace(path, allowNamespaces);
      },

      TSInterfaceDeclaration(path) {
        // path.remove();
      },

      TSEnumDeclaration(path) {
      },

      TSImportEqualsDeclaration(
        path: NodePath<t.TSImportEqualsDeclaration>,
        pass,
      ) {
        // TODO
        const { id, moduleReference } = path.node;

        let init: t.Expression;
        let varKind: "var" | "const";
        if (t.isTSExternalModuleReference(moduleReference)) {
          // import alias = require('foo');
          assertCjsTransformEnabled(
            path,
            pass,
            `import ${id.name} = require(...);`,
            `import ${id.name} from '...';`,
            " alongside Typescript's --allowSyntheticDefaultImports option",
          );
          init = t.callExpression(t.identifier("require"), [
            moduleReference.expression,
          ]);
          varKind = "const";
        } else {
          // import alias = Namespace;
          init = entityNameToExpr(moduleReference);
          varKind = "var";
        }
        const newNode = t.variableDeclaration(varKind, [
          t.variableDeclarator(id, init),
        ]);

        path.replaceWith(newNode);

        path.scope.registerDeclaration(path);
      },
      TSExportAssignment(path, pass) {
        console.log(path);
        assertCjsTransformEnabled(
          path,
          pass,
          `export = <value>;`,
          `export default <value>;`,
        );
        path.replaceWith(
          template.statement.ast`module.exports = ${path.node.expression}`,
        );
      },

      TSTypeAssertion(path) {
        path.replaceWith(path.node.expression);
      },

      "TSAsExpression|TSSatisfiesExpression"(
        path: NodePath<t.TSAsExpression | t.TSSatisfiesExpression>,
      ) {
        let { node }: { node: t.Expression } = path;
        do {
          node = node.expression;
        } while (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node));
        path.replaceWith(node);
      },

      "TSNonNullExpression|TSInstantiationExpression"(
        path: NodePath<t.TSNonNullExpression | t.TSInstantiationExpression>,
      ) {
        path.replaceWith(path.node.expression);
      },
      ExpressionStatement(path) {
        path.remove();
      },


      // XXX
      CallExpression(path) {
        path.node.typeArguments = null;
      },

      OptionalCallExpression(path) {
        path.node.typeArguments = null;
      },

      NewExpression(path) {
        path.node.typeArguments = null;
      },

      JSXOpeningElement(path) {
        path.node.typeArguments = null;
      },

      TaggedTemplateExpression(path) {
        path.node.typeArguments = null;
      },
    }) satisfies Visitor<PluginPass>,
  };

  function entityNameToExpr(node: t.TSEntityName): t.Expression {
    if (t.isTSQualifiedName(node)) {
      return t.memberExpression(entityNameToExpr(node.left), node.right);
    }

    return node;
  }

  function visitPattern({
    node,
  }: NodePath<t.Identifier | t.Pattern | t.RestElement>) {
    // // @ts-expect-error typeAnnotation does not exist in VoidPattern
    // if (node.typeAnnotation) node.typeAnnotation = null;
    // if (t.isIdentifier(node) && node.optional) node.optional = null;
    // 'access' and 'readonly' are only for parameter properties, so constructor visitor will handle them.
  }

  function isImportTypeOnly({
    binding,
    programPath,
    pragmaImportName,
    pragmaFragImportName,
  }: {
    binding: Scope.Binding;
    programPath: NodePath<t.Program>;
    pragmaImportName: string;
    pragmaFragImportName: string;
  }) {
    for (const path of binding.referencePaths) {
      if (!isInType(path)) {
        return false;
      }
    }

    if (
      binding.identifier.name !== pragmaImportName &&
      binding.identifier.name !== pragmaFragImportName
    ) {
      return true;
    }

    // "React" or the JSX pragma is referenced as a value if there are any JSX elements/fragments in the code.
    const sourceFileHasJsx = t.traverseFast(programPath.node, node => {
      if (t.isJSXElement(node) || t.isJSXFragment(node)) {
        return t.traverseFast.stop;
      }
    });

    return !sourceFileHasJsx;
  }
}) as object;
