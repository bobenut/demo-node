//操作
//add
let set1 = new Set()
set1.add(1)
set1.add(2)
set1.add(3)
console.log('added:', set1)

//delete
set1.delete(1)
console.log('deleted:', set1)

//判断是否存在某个值
console.log('has(1):', set1.has(1))
console.log('has(2):', set1.has(2))

//clear
set1.clear()
console.log('cleared:', set1)


//set和array互转
//Array to Set
let set2 = new Set([4,5,6])
console.log('array to set 1:', set2)

let set3 = new Set(new Array(7, 8, 9))
console.log('array to set 2:', set3)

//Set to Array
let set4 = new Set([4, 5, 6])
console.log('set to array 1:', [...set4])
console.log('set to array 2:', Array.from(set4))

//遍历
let set5 = new Set([4, 5, 'hello'])
console.log('iterate useing Set.keys()')
for(let item of set5.keys()) {
  console.log(item)
}

console.log('iterate useing Set.values()')
for(let item of set5.values()) {
  console.log(item)
}

console.log('iterate useing Set.entries()')
for(let item of set5.entries()) {
  console.log(item)
}

//去重
let set6 = new Set([1, 2, 2, 3, 4, 3, 5])
console.log('distinct 1:', set6)

let arr1 = [1, 2, 3, 4]
let arr2 = [2, 3, 4, 5, 6]
let set7 = new Set([...arr1, ...arr2])
console.log('distinct 2:', set7)

//特性
//NaN等于自身
let set8 = new Set()
set8.add(NaN)
set8.add(NaN)
console.log('NaN===Nan is true:', set8)
