//Array的遍历，entries()，keys()，values()，Iterator.next()

console.log('-----step1，keys()，key就是元素的index')
const arr1 = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k']
for (let index of arr1.keys()) {
  console.log(index);
}

console.log('-----step2，values()')
for (let val of  arr1.values()) {
  console.log(val);
}

console.log('-----step3，entries()配合解构，拿到每个元素的index和value')
for (let [index, val] of arr1.entries()) {
  console.log(index, val);
}

console.log('-----step4，Iterator.next()')
let arrEntries=arr1.entries();
let entry=arrEntries.next();
console.log(entry)
while(!entry.done){
  console.log(entry.value);
  entry=arrEntries.next();
}

