//Array.from
//可以将部署了Iterator接口的对象，类数组的对象（该对象必须要有length属性）转换成数组

console.log('-----step1，转换map')
const map1 = new Map();
map1.set('k1', 1);
map1.set('k2', 2);
map1.set('k3', 3);
console.log('%s', Array.from(map1))

console.log('-----step2，转换set')
const set1 = new Set();
set1.add(1).add(2).add(3)
console.log('%s', Array.from(set1))

console.log('-----step3，转换字符串')
console.log('%s', Array.from('hello world'))

console.log('-----step4，类数组对象')

console.log('%s', Array.from({
  0: '0',
  1: '1',
  length:2
}))

console.log('%s', Array.from({
  '0': 0,
  '1': 1,
  length:2
}))

console.log('%s', Array.from({
  a: '1',
  b: '2',
  length:2
}))

console.log('-----step5，第二个参数作用')

console.log('%s', Array.from([1, 2, 3, 4, 5], (n) => n + 1))


console.log('-----step6，第三个参数作用，绑定this')

let aop = {
  handle: function(n){
    return n + 2
  }
}
console.log('%s', Array.from(
  [1, 2, 3, 4, 5], 
  function (x){
    return this.handle(x)
  }, 
  aop))