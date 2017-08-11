//特性
//1.键值对，键可以是对象
console.log('-----特性，键可以是对象')
const map1 = new Map()
const objkey = {p1: 'v1'}

map1.set(objkey, 'hello')
console.log(map1.get(objkey))
//对象是按照引用地址来做识别

//2.Map可以接受数组作为参数，数组成员还是一个数组，其中有两个元素，一个表示键一个表示值
console.log('-----特性，接受数组作为参数')
const map2 = new Map([
  ['name', 'Aissen'],
  ['age', 12]
])
console.log(map2.get('name'))
console.log(map2.get('age'))

//操作
//size
console.log('-----操作，size')
const map3 = new Map();
map3.set('k1', 1);
map3.set('k2', 2);
map3.set('k3', 3);
console.log('%s', map3.size)

//set设置键值对，键可以是各种类型
console.log('-----操作，set')
const map4 = new Map();
map4.set('k1', 6)        // 键是字符串
map4.set(222, '哈哈哈')     // 键是数值
map4.set(undefined, 'gagaga')    // 键是 undefined

const fun = function() {console.log('hello');}
map4.set(fun, 'fun') // 键是 function

console.log('map4 size: %s', map4.size)
console.log('undefined value: %s', map4.get(undefined))
console.log('fun value: %s', map4.get(fun))

//链式调用
console.log('-----操作，set链式调用')
map4.set('k2', 2).set('k3', 4).set('k4', 5)
console.log('map4 size: %s', map4.size)

//get
console.log('-----操作，get')
const map5 = new Map();
map5.set('k1', 6)  
console.log('map5 value: %s', map5.get('k1'))

//has
console.log('-----操作，has')
const map6 = new Map();
map6.set(undefined, 4)
console.log('map6 undefined: %s', map6.has(undefined))
console.log('map6 no exited: %s', map6.has('k1'))

//delete
console.log('-----操作，delete')
const map7 = new Map();
map7.set(undefined, 4)
map7.delete(undefined)
console.log('map7 undefined: %s', map7.has(undefined))

//clear
console.log('-----操作，clear')
const map8 = new Map();
map8.set('k1', 1);
map8.set('k2', 2);
map8.set('k3', 3);
console.log('map8, pre-clear size: %s', map8.size)
map8.clear()
console.log('map8, post-clear size: %s', map8.size)

//遍历
//keys()
console.log('-----遍历，keys()')
const map9 = new Map();
map9.set('k1', 1);
map9.set('k2', 2);
map9.set('k3', 3);
for (let key of map9.keys()) {
  console.log(key);
}

//values()
console.log('-----遍历，values()')
for (let value of map9.values()) {
  console.log(value);
}

//entries()
console.log('-----entries() 1')
for (let item of map9.entries()) {
  console.log(item[0], item[1]);
}

console.log('-----entries() 2')
for (let [key, value] of map9.entries()) {
  console.log(key, value);
}

//forEach()
console.log('-----forEach()')
map9.forEach(function(value, key, map) {
  console.log("Key: %s, Value: %s", key, value);
});

//forEach() 绑定this
console.log('-----forEach(), bind this')
const output = {
  log: function(key, value) {
    console.log("Key: %s, Value: %s", key, value);
  }
};

map9.forEach(function(value, key, map) {
  this.log(key, value);
}, output);

//和其他结构的转换
//Map to Array
console.log('-----Map To Array')
const map10 = new Map();
map10.set('k1', 1);
map10.set('k2', 2);
map10.set('k3', 3);
console.log([...map10]);

//Array to Map
console.log('-----Array To Map')
const map11 = new Map([
  ['name', 'Aissen'],
  ['age', 12]
])
console.log(map11)

//Map To Object
console.log('-----Map To Object')

function mapToObj(map) {
  let obj = Object.create(null);
  for (let [k,v] of map) {
    obj[k] = v;
  }
  return obj;
}

const map12 = new Map()
  .set('k1', 1)
  .set({pa:1}, 2);
console.log(mapToObj(map12))

//Object To Map
console.log('-----Object To Map')
function objToMap(obj) {
  let map = new Map();
  for (let k of Object.keys(obj)) {
    map.set(k, obj[k]);
  }
  return map;
}

console.log(objToMap({yes: true, no: false}))

//Set To Map
console.log('-----Set To Map')
const set = new Set([
  ['foo', 1],
  ['bar', 2]
]);
const map13 = new Map(set)
console.log(map13)

//Map To Set
console.log('-----Map To Set')
function mapToSet(map) {
  let set = new Set()
  for (let [k,v] of map) {
    set.add([k, v])
  }
  return set;
}

const map14 = new Map()
  .set('k1', 1)
  .set({pa:1}, 2);
console.log(mapToSet(map14))
