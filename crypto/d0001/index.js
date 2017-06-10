var crypto = require('crypto');

function cipher(algorithm, data, key, inputEncoding, outputEncoding) {
    inputEncoding = inputEncoding || 'utf8';
    outputEncoding = outputEncoding || 'base64';

    const cipher = crypto.createCipher(algorithm, key);
    var encrypted = cipher.update(data, inputEncoding, outputEncoding);
    encrypted += cipher.final(outputEncoding);

    return encrypted;
}

function decipher(algorithm, encrypteData, key, inputEncoding, outputEncoding) {
    inputEncoding = inputEncoding || 'base64';
    outputEncoding = outputEncoding || 'utf8';

    const decipher = crypto.createDecipher(algorithm, key);
    var decrypted = decipher.update(encrypteData, inputEncoding, outputEncoding);
    decrypted += decipher.final();

    return decrypted;
}

var algorithm = 'aes-128-ecb',
    data = 'aaaaaaaaaaaaaaaa',
    key = 'bbbbbbbbbbbbbbbb';

var encryptedData = cipher(algorithm, data, key);
console.log('encrypted: ' + encryptedData);

var decryptedData = decipher(algorithm, encryptedData, key);
console.log('dencrypted: ' + decryptedData);



