const ws = new WeakSet()
var a = {p1:'1', p2:'2'}

ws.add(a)
// ws.add(1)
a = null
console.log(ws.has(a));


// a = null
// console.log(ws);
