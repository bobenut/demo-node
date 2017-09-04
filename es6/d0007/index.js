//Array.of
//方法用于将一组值，转换为数组

console.log('-----step1，new Array的问题，生成数组的含义不一致')
const arr1 = new Array();
const arr2 = new Array(5);
const arr3 = new Array(1, 3, '白色', {p1: 'v1'});
console.log('%s', JSON.stringify(arr1))
console.log('%s', JSON.stringify(arr2))
console.log('%s', JSON.stringify(arr3))

console.log('-----step2，采用Array.of代替new Array')
const arr4 = Array.of();
const arr5 = Array.of(5);
const arr6 = Array.of(1, 3, '白色', {p1: 'v1'});
const arr7 = Array.of(undefined);
console.log('%s', JSON.stringify(arr4))
console.log('%s', JSON.stringify(arr5))
console.log('%s', JSON.stringify(arr6))
console.log('%s', JSON.stringify(arr7))
