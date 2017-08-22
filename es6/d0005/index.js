console.log('-----step1，扩展输出')
console.log(...[3, 4, 5])

console.log('-----step2，合并数组')
let arr1 = [1, 2, 3]
let arr2 = [4, 5, 6]
let arr3 = [7, 8, 9]
console.log([...arr1, ...arr2, ...arr3])

console.log('-----step3，函数多参数传递, 替换Apply')
let arr4 = ['arg1', 'arg2', 'arg3', 'arg4']
let fun1 = (a1, a2, a3, a4) => {
  console.log( a1, a2, a3, a4)
}
fun1(...arr4)
fun1.apply(null, arr4)

console.log('-----step4，与结构配合赋值')
//只能放在最后一个参数上，可以把数组拆开
let [var1, ...arr5] = [1, 2, 3, 4, 5, 6]
console.log(var1)
console.log(arr5)

//报错
// let [...arr6, var2] = [1, 2, 3, 4, 5, 6]
// let [var3, ...arr7, var4] = [1, 2, 3, 4, 5, 6]

console.log('-----step5，可以展开实现了Iterator 接口的对象，Map，Set，not Object')
let set1 = new Set()
set1.add(1)
set1.add(2)
set1.add(3)
console.log(...set1)

let map1 = new Map();
map1.set('k1', 1);
map1.set('k2', 2);
map1.set('k3', 3);
console.log(...map1)

// let obj1 = {
//   p1: 1,
//   p2: 2,
//   p3: 3,
//   length: 3
// }
// console.log(...obj1)

