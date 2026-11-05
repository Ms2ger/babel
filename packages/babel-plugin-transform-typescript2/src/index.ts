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
  isClassPrivateMethod,
  isClassPrivateProperty,
  isExportDeclaration, isExportDefaultDeclaration, isFunctionDeclaration, isFunctionExpression,
  isIdentifier, isImportDefaultSpecifier, isImportNamespaceSpecifier, isImportSpecifier,
  isNumericLiteral,
  isPrivateName,
  isStringLiteral, isTSLiteralType, isTypeAnnotation, isTypeParameterDeclaration, privateName, stringTypeAnnotation, tsBigIntKeyword, tsDeclareFunction,
  TSLiteralType,
  tsLiteralType,
  tsNumberKeyword,
  tsPropertySignature,
  tsStringKeyword,
  TSType,
  TSTypeAnnotation,
  tsTypeLiteral,
  TSTypeParameterDeclaration,
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

      if (node.accessibility) node.accessibility = null;
      if (node.abstract) node.abstract = null;
      if (node.readonly) node.readonly = null;
      if (node.optional) node.optional = null;
      // if (node.typeAnnotation) node.typeAnnotation = null;
      if (node.definite) node.definite = null;
      if (node.declare) node.declare = null;
      if (node.override) node.override = null;
    },
    method({ node }: NodePath<t.ClassMethod | t.ClassPrivateMethod>) {
      if (node.accessibility) node.accessibility = null;
      if (node.abstract) node.abstract = null;
      if (node.optional) node.optional = null;
      if (node.override) node.override = null;

      // Rest handled by Function visitor
    },
    constructor(path: NodePath<t.ClassMethod>, classPath: NodePath<t.Class>) {
      if (path.node.accessibility) path.node.accessibility = null;
      // Collects parameter properties so that we can add an assignment
      // for each of them in the constructor body
      //
      // We use a WeakSet to ensure an assignment for a parameter
      // property is only added once. This is necessary for cases like
      // using `transform-classes`, which causes this visitor to run
      // twice.
      const assigns: t.ExpressionStatement[] = [];
      const { scope } = path;
      for (const paramPath of path.get("params")) {
        if (paramPath.isTSParameterProperty()) {
          const param = paramPath.node;
          const parameter = param.parameter;
          if (PARSED_PARAMS.has(parameter)) continue;
          PARSED_PARAMS.add(parameter);
          let id;
          if (t.isIdentifier(parameter)) {
            id = parameter;
          } else if (
            t.isAssignmentPattern(parameter) &&
            t.isIdentifier(parameter.left)
          ) {
            id = parameter.left;
          } else {
            throw paramPath.buildCodeFrameError(
              "Parameter properties can not be destructuring patterns.",
            );
          }
          assigns.push(
            template.statement.ast`
              this.${t.cloneNode(id)} = ${t.cloneNode(id)}
            ` as t.ExpressionStatement,
          );

          paramPath.replaceWith(param.parameter);
          scope.registerBinding("param", paramPath);
        }
      }
      injectInitialization(classPath, path, assigns);
    },
  };

  let output: (t.Node | string)[] = [];
  const dts = (pattern: string, s: string) => {
    console.log(`***${pattern}*** ${s}`);
    output.push(s);
  };
  const dts2 = (pattern: string, s: t.Node) => {
    console.log(`***${pattern}*** ${generate(s).code + "\n"}`);
    output.push(s);
  };
  function translateTypeParameters(arg: TSTypeParameterDeclaration | TypeParameterDeclaration | null | undefined): TSTypeParameterDeclaration | null | undefined {
    if (isTypeParameterDeclaration(arg)) {
      // TODO
      throw new Error(`Unexpected Flow TypeParameterDeclaration ${arg}`);
    }
    return arg;
  }
  function inferType(declaration, widen: boolean = false): TSType | undefined {
    if (isFunctionExpression(declaration)) {
      if (!declaration.returnType) {
        throw new Error(`Explicit return type is required`)
      }
      return t.tsFunctionType(
        translateTypeParameters(declaration.typeParameters),
        declaration.params,
        declaration.returnType,
      )
    }

    switch (declaration.type) {
      case "TemplateLiteral": {
        if (declaration.expressions.length) {
          throw new Error(`Template literal with expressions not supported`)
        }
        // TODO: any edge cases?
        if (widen) {
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
        if (widen) {
          return arg.type === "NumericLiteral" ? tsNumberKeyword() : tsBigIntKeyword();
        }
        if (op === "+") {
          return tsLiteralType(t.cloneNode(declaration.argument));
        }
        if (op === "-") {
          return tsLiteralType(t.cloneNode(declaration));
        }
      }
      case "StringLiteral": {
        if (widen) {
          return tsStringKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "NumericLiteral": {
        if (widen) {
          return tsNumberKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "BigIntLiteral": {
        if (widen) {
          return tsBigIntKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "BooleanLiteral": {
        if (widen) {
          return tsBooleanKeyword();
        }
        return tsLiteralType(t.cloneNode(declaration));
      }
      case "ObjectExpression": {
        let members = declaration.properties.map((prop: t.ObjectProperty) => {
          // TODO factor out
          if (isPrivateName(prop.key)) {
            throw new Error(`Unexpected private name`);
          }
          let key = t.cloneNode(prop.key);
          if (prop.computed) {
            if (isStringLiteral(key)) {
              key = t.identifier(key.value);
            } else if (isNumericLiteral(key)) {
              // Fine
            } else {
              // TODO: ts supports keys like `[Symbol.hasInstance]`
              throw new Error(`Unexpected property key ${key}`)
            }
          }
          let signature = tsPropertySignature(
            key,
            t.tsTypeAnnotation(inferType(prop.value, widen || true))
          );
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
        // dts2("ImportDeclaration", node);
        // dts("ImportDeclaration", `import `);
        // dts("ImportDeclaration", "type ");
        // dts("ImportDeclaration", `{ `);
        // for (const specifier of path.node.specifiers) {
        //   if (isImportNamespaceSpecifier(specifier)) {
        //     dts("ImportSpecifier", `*`);
        //     let local = specifier.local;
        //     // if (local) {
        //     dts("ImportSpecifier", ` as ${local.name}`);
        //     // }
        //   } else if (isImportDefaultSpecifier(specifier)) {
        //     dts("ImportSpecifier", `${specifier.local.name}`);
        //   } else {
        //     let imported = specifier.imported;
        //     if (isStringLiteral(imported)) {
        //       dts("ImportSpecifier", `${imported.value}`);
        //     } else {
        //       dts("ImportSpecifier", `${imported.name}`);
        //     }
        //     let local = specifier.local;
        //     if (local) {
        //       dts("ImportSpecifier", ` as ${local.name}`);
        //     }
        //   }
        // }
        // dts("ImportDeclaration", ` } from "${path.node.source.value}";\n`);
      },
      // ImportDeclaration: {
      //   enter(path, state) {
      //     dts("ImportDeclaration", `import `);
      //     if (path.node.importKind === "type") {
      //       dts("ImportDeclaration", "type ");
      //     }
      //   },
      //   exit() {
      //     dts("ImportDeclaration", "}");
      //   },
      // },
      // ImportSpecifier(path, state) {
      //   let imported = path.node.imported;
      //   if (isStringLiteral(imported)) {
      //     dts("ImportSpecifier", `${imported.value}`);
      //   } else {
      //     dts("ImportSpecifier", `${imported.name}`);
      //   }
      //   let local = path.node.local;
      //   if (local) {
      //     dts("ImportSpecifier", ` as ${local.name}`);
      //   }
      // },
      ExportNamedDeclaration(path, state) {
      },

      ExportAllDeclaration(path) {
        // if (path.node.exportKind === "type") path.remove();
      },

      ExportSpecifier(path) {
        // // remove type exports
        // type Parent = t.ExportDeclaration & { source?: t.StringLiteral };
        // const parent = path.parent as Parent;
        // if (
        //   (!parent.source &&
        //     isGlobalType(path, (path.node.local as t.Identifier).name)) ||
        //   path.node.exportKind === "type"
        // ) {
        //   path.remove();
        // }
      },

      ExportDefaultDeclaration: {
        // TODO:
        // export default "foo";
        // →
        // declare const _default: "foo";
        // export default _default;
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

          }
          // console.log(path.getTypeAnnotation());
          let {node} = path;
          // console.log("ExportDefaultDeclaration", node)
          // TODO: apply to normal `export const`. `export let` gets similar but no literal types
          // TODO: support `as foo`, `as const` annotations
          if (!isFunctionDeclaration(node.declaration)) {
            let inferred = inferType(node.declaration);
            if (inferred && isTSLiteralType(inferred)) {
              addExplicitVariable(inferred);
            }
          }

          // dts("ExportDefaultDeclaration", "export default ");
        },
        exit() {
          // dts("ExportDefaultDeclaration", `;\n`);
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
            throw new Error(`Must declare the return type of function ${node.id?.name ?? ""}`);
          }
          let newNode = t.tsDeclareFunction(
            t.cloneNode(node.id),
            t.cloneNode(translateTypeParameters(node.typeParameters)),
            node.params,
            t.cloneNode(node.returnType));
          if (!isDefaultExport) {
            newNode.declare = true;
          }
          // dts2("FunctionDeclaration", newNode);
          path.replaceWith(newNode);
          // console.log(node.returnType)
          // path.skip();

        },
        exit() {
          // dts("FunctionDeclaration", `;\n`);
        },
      },
      StringLiteral(path) {
        dts("StringLiteral", `"${path.node.value}"`);
      },
      TSTypeAnnotation(path) {
        // TODO unreached
        // dts("TSTypeAnnotation", `${path.node}`);
      },
      TSTypeAliasDeclaration(path) {
        // TODO unreached
        dts("TSTypeAliasDeclaration", generate(path.node).code);
        path.skip();
        // dts("TSTypeAnnotation", `${path.node}`);
      },
      // TSVoidKeyword() {
      //   dts("TSNumberKeyword", `void`);
      // },
      // TSNumberKeyword() {
      //   dts("TSNumberKeyword", `number`);
      // },
      // TSStringKeyword() {
      //   dts("TSNumberKeyword", `string`);
      // },
      TSType({node}) {
        dts("TSType", generate(node).code);

      },
      TSDeclareFunction(path) {
        // TODO
        // safeRemove(path);
      },

      TSDeclareMethod(path) {
        // if (seen.has(path.node)) {
        //   return;
        // }
        // let {node} = path;
        // let newNode = t.tsDeclareMethod(
        //   t.cloneNode(node.key),
        //   t.cloneNode(node.typeParameters),
        //   node.params,
        //   node.accessibility === "private" ? null : t.cloneNode(node.returnType)
        // );
        // console.log("~~~TSDeclareMethod: ", node.key, node.accessibility === "private", newNode.returnType)
        // newNode.kind = node.kind;
        // newNode.static = node.static;

        // // XXX What's the difference between these?
        // newNode.access = node.access;
        // newNode.accessibility = node.accessibility;

        // path.replaceWith(newNode);
        // seen.add(newNode);
        if (path.node.accessibility === "private") {
          path.node.returnType = null;
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
            if (isFunctionExpression(declarator.init)) {
              declarator.id.typeAnnotation = t.tsTypeAnnotation(t.tsFunctionType(
                translateTypeParameters(declarator.init.typeParameters),
                declarator.init.params,
                declarator.init.returnType,
              ))
              declarator.init = null;
            } else {
              let inferred = inferType(declarator.init, path.node.kind !== "const");
              if (!inferred) {
                throw 12
              }
              if (path.node.kind === "const" && isTSLiteralType(inferred)) {

              } else {

                declarator.id.typeAnnotation = t.tsTypeAnnotation(inferred);

                declarator.init = null;
              }
            }

          } else {
            declarator.init = null;
          }
          if (path.node.kind !== "const" || true) { // Sometimes
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
        // dts2("VariableDeclaration", decl);
        path.replaceWith(decl);
        seen.add(decl);
        // path.skip();
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
        // console.log(generate(path.node).code)
        // console.log(path.node)
        let node = path.node;
        if (node.kind === "method" && !node.returnType) {
          throw new Error(`Must declare the return type of method`);
        }
        if (isTypeParameterDeclaration(node.typeParameters)) {
          throw new Error("Found TypeParameterDeclaration");
        }
        if (isTypeAnnotation(node.returnType)) {
          throw new Error("Found TypeAnnotation");
        }
        let newNode = t.tsDeclareMethod(
          t.cloneNode(node.key),
          t.cloneNode(node.typeParameters),
          node.params,
          t.cloneNode(node.returnType)
        );
        // console.log("~~~ClassMethod: ", node.key, node.accessibility === "private", newNode.returnType)
        newNode.kind = node.kind;
        newNode.static = node.static;

        // XXX What's the difference between these?
        newNode.access = node.access;
        newNode.accessibility = node.accessibility;

        // if (!isDefaultExport) {
        //   newNode.declare = true;
        // }
        // dts2("FunctionDeclaration", newNode);
        path.replaceWith(newNode);
      // throw 8

      },

      Class(path) {
        const { node }: { node: typeof path.node & ExtraNodeProps } = path;
        // let hasPrivate = node.body.body.some(field =>
        //   isClassPrivateProperty(field) ||
        //   isClassPrivateMethod(field)

        // );
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

        // if (node.typeParameters) node.typeParameters = null;

        // if (node.superTypeArguments) node.superTypeArguments = null;

        // if (node.implements) node.implements = null;
        // if (node.abstract) node.abstract = null;

        // Similar to the logic in `transform-flow-strip-types`, we need to
        // handle `TSParameterProperty` and `ClassProperty` here because the
        // class transform would transform the class, causing more specific
        // visitors to not run.
        // path.get("body.body").forEach(child => {
        //   if (child.isClassMethod() || child.isClassPrivateMethod()) {
        //     if (child.node.kind === "constructor") {
        //       classMemberVisitors.constructor(
        //         // @ts-expect-error A constructor must not be a private method
        //         child,
        //         path,
        //       );
        //     } else {
        //       classMemberVisitors.method(child);
        //     }
        //   } else if (
        //     child.isClassProperty() ||
        //     child.isClassPrivateProperty() ||
        //     child.isClassAccessorProperty()
        //   ) {
        //     classMemberVisitors.field(child);
        //   }
        // });
      },
      Function(path) {
        const { node } = path;
        // if (node.typeParameters) node.typeParameters = null;
        // if (node.returnType) node.returnType = null;
        console.log(generate(path.node).code)
        throw 7
        if (node.body) node.body = null;
        let newNode = tsDeclareFunction(null, node.typeParameters, node.params, node.returnType)
        // TODO not unreached

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
