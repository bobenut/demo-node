//Array.fill(), 使用元素填充数组，可以制定起始位置我结束位置

console.log('-----step1，采用一值填充数组全部元素')
const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr1.fill(7)
console.log('%s', arr1)

const arr2 = []
arr2.fill(7)
console.log('%s', arr2)

console.log('-----step2，指定开始位置，结束位置(实际到结束位置-1)')
const arr3 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr3.fill(7, 2, 5)
console.log('%s', arr3)

console.log('-----step3，指定开始位置，省略结束位置')
const arr4 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr4.fill(7, 2)
console.log('%s', arr4)