//Array.find(), 通过callback查找元素，找到返回其值，找不到返回undefined
//Array.ffindIndex()，通过callback查找元素，找到返回其index，找不到返回undefined
//都能查找NaN

console.log('-----step1，查找元素，返回找到的值，找不到返回undefined')
const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
var ret1 = arr1.find((value, index, arr) => {
  return value > 4
})

var ret2 = arr1.find((value, index, arr) => {
  return value > 14
})
console.log('%s', ret1)
console.log('%s', ret2)

console.log('-----step2，查找元素，返回找到的index，找不到返回-1')
var ret3 = arr1.findIndex((value, index, arr) => {
  return value > 4
})

var ret4 = arr1.findIndex((value, index, arr) => {
  return value > 14
})
console.log('%s', ret3)
console.log('%s', ret4)

console.log('-----step3，查找NaN')
const arr2 = [1, 2, NaN, 4, 5, 6, 7, 8, 9, 10, 11]
var ret5 = arr2.find((value, index, arr) => {
  return Object.is(NaN, value)
})

var ret6 = arr2.findIndex((value, index, arr) => {
  return Object.is(NaN, value)
})
console.log('%s', ret5)
console.log('%s', ret6)