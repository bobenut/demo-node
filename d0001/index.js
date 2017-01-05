var crypto = require('crypto');

function cipher(algorithm, data, key, inputEncoding, outputEncoding) {
    inputEncoding = inputEncoding || 'utf8';
    outputEncoding = outputEncoding || 'hex';

    const cipher = crypto.createCipher(algorithm, key);
    var encrypted = cipher.update(data, inputEncoding, outputEncoding);
    encrypted += cipher.final(outputEncoding);

    return encrypted;
}

function decipher(algorithm, encrypteData, key, inputEncoding, outputEncoding) {
    inputEncoding = inputEncoding || 'hex';
    outputEncoding = outputEncoding || 'utf8';

    const decipher = crypto.createDecipher(algorithm, key);
    var decrypted = decipher.update(encrypteData, inputEncoding, outputEncoding);
    decrypted += decipher.final();

    return decrypted;
}

var algorithm = 'aes-192-cbc',
    data = 'abC1!2@3#',
    key = 'mnB21@gb.com';

var encryptedData = cipher(algorithm, data, key);
console.log('encrypted: ' + encryptedData);

var decryptedData = decipher(algorithm, encryptedData, key);
console.log('dencrypted: ' + decryptedData);



