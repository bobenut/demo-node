//Array.includes()，判断是否包含某一元素
//es5的Array.indexOf()用来找元素的位置，但它返回的值是位置或-1.不够语义化，并且由于===的原因NaN是找不出来的

console.log('-----step1，indexOf()，非语义话')
const arr1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', NaN]
console.log('%s', arr1.indexOf('c'))
console.log('%s', arr1.indexOf('z'))

console.log('-----step2，indexOf()，找不到NaN')
console.log('%s', arr1.indexOf(NaN))

console.log('-----step3，includes()，判断是否包含某个元素')
console.log('%s', arr1.includes('c'))
console.log('%s', arr1.includes('z'))
console.log('%s', arr1.includes(NaN))

console.log('-----step4，includes()，第二个参数是搜索的起始位置，可以是负数，但是查找的方式还是从左至右不变，不会因为是负数而改变查找方向')
console.log('%s', arr1.includes('d', 1))
console.log('%s', arr1.includes('d', 3))
console.log('%s', arr1.includes('d', 4))
console.log('%s', arr1.includes('k', -1))
console.log('%s', arr1.includes('k', -2))
console.log('%s', arr1.includes('i', -3))

console.log('-----step5，includes()，查找对象')
console.log('%s', arr1.includes({p1: 1, p2: 2}))