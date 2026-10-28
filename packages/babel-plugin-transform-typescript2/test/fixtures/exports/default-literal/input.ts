export function foo() : string {
  return "8";
}
export function bar() : number {
  return 7 + 8;
}
var quux1: () => void = function() : void { return }
export {quux1};

{var quux2 = function() : void { return }}
export {quux2};

function quux3() : void { return }
function quux4() : void { quux3(); return }
export {quux4};

var quux6a = function() : void { return }, quux6b = function() : void { return };
export {quux6a};

export default function() : void{}