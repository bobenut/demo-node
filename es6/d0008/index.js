//Array.copyWithin()
//当前数组内部，将指定位置的成员复制到其他位置

console.log('-----step1，目标位置，源起始位置，源终止位置（复制到前一个）')
const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr1.copyWithin(1, 3, 6)
console.log('%s', JSON.stringify(arr1))

console.log('-----step2，源起始省略表示从0开始，源终止省略表示数组长度，不会溢出复制完为止')
const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr2.copyWithin(3)
console.log('%s', JSON.stringify(arr2))

console.log('-----step3，源起始为负数，表示从右侧数过来第几个')
const arr3 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
arr3.copyWithin(3, -3, -2)
console.log('%s', JSON.stringify(arr3))

