//var Buffer = require('buffer').Buffer;

var data = 'xxxxxxxx';
var key = 0x73;
var buf1 = new Buffer(data, 'utf8');
var buf2 = new Buffer(buf1.length);
var buf3 = new Buffer(buf1.length);
for (var i = 0, b; b = buf1[i]; i++) {
    buf2[i] = b ^ key;
}

for (var i = 0, c; c = buf2[i]; i++) {
    buf3[i] = c ^ key;
}
console.log(buf1);
console.log(buf2);
console.log(buf3);
var encryptedData = buf2.toString('hex');
console.log('encryptedData: ' + encryptedData);
console.log('******************');

var buf5 = new Buffer(encryptedData, 'hex');
var buf6 = new Buffer(buf5.length);
for (var i = 0, b; b = buf5[i]; i++) {
    buf6[i] = b ^ key;
}
console.log(buf5);
console.log(buf6.toString());

console.log('#######################')

var buftt = new Buffer('s');
console.log(buftt);

function cipher(text, key) {
    var keyBuffer = new Buffer(key);

    //console.log(keyBuffer);
    var textBuffer = new Buffer(text, 'utf8');
    //console.log(textBuffer);
    var textCipheredBuffer = new Buffer(textBuffer.length);
    for (var i = 0; i < textBuffer.length; i++) {
        textCipheredBuffer[i] = textBuffer[i];
        for (var j = 0; j < keyBuffer.length; j++) {
            textCipheredBuffer[i] ^= keyBuffer[j];
        }
    }
    console.log(textCipheredBuffer);

    return textCipheredBuffer.toString('base64');
}

function decipher(textCiphered, key) {
    var keyBuffer = new Buffer(key);

    var textCipheredBuffer = new Buffer(textCiphered, 'base64');
    //console.log(textCipheredBuffer);
    var textDecipheredBuffer = new Buffer(textCipheredBuffer.length);
    for (var i = 0; i < textCipheredBuffer.length; i++) {
        textDecipheredBuffer[i] = textCipheredBuffer[i];
        for (var j = keyBuffer.length - 1; j >= 0; j--) {
            textDecipheredBuffer[i] ^= keyBuffer[j];
        }
    }
    console.log(textDecipheredBuffer);
    return textDecipheredBuffer.toString('utf8');
}

var userCount = {
    name: 'bobeut',
    password: 'Abc32145t@#'
};
var userCountnString = JSON.stringify(userCount, null, 0);
console.log('cipher text:' + userCountnString);

var textCiphered = cipher(userCountnString, 's1@');
var textDeciphered = decipher(textCiphered, 's1@');
console.log('cipheredText: ' + textCiphered);
console.log('decipheredText: ' + textDeciphered);