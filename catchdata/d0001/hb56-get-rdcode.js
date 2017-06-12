var http = require('http');
var fs = require('fs');

// var postData = querystring.stringify({
//   'msg' : 'Hello World!'
// });

// var options = {
//   hostname: 'www.google.com',
//   port: 80,
//   path: '/upload',
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/x-www-form-urlencoded',
//     'Content-Length': Buffer.byteLength(postData)
//   }
// };

// var req = http.request(options, (res) => {
//   console.log(`STATUS: ${res.statusCode}`);
//   console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
//   res.setEncoding('utf8');
//   res.on('data', (chunk) => {
//     console.log(`BODY: ${chunk}`);
//   });
//   res.on('end', () => {
//     console.log('No more data in response.');
//   });
// });

// req.on('error', (e) => {
//   console.log(`problem with request: ${e.message}`);
// });

// // write data to request body
// req.write(postData);
// req.end();

var options = {
  hostname: 'www.hb56.com',
  port: 80,
  path: '/RdCode.aspx?' + Math.random(),
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
    'Accept': 'image/webp,image/*,*/*;q=0.8'
  }
};

console.log(options);

var req = http.request(options, (res) => {
  console.log('STATUS: %s', res.statusCode);
  console.log('HEADERS: %s', JSON.stringify(res.headers));

  var chunks = [];
  var gettedLen = 0; 

  res.on('data', (chunk) => {
    console.log('BODY: %s', chunk);
    chunks.push(chunk);
    gettedLen += chunk.length;
  });

  res.on('end', () => {
    console.log('Getted end.');

    var dataBuffer = new Buffer(gettedLen);
    for (var i = 0, pos = 0; i < chunks.length; i++) {
        var chunk = chunks[i];
        chunk.copy(dataBuffer, pos);
        pos += chunk.length;
    }

    fs.writeFile('im.jpg', dataBuffer, (err) => {
    	console.log('created image file');
    })
  });
});

req.on('error', (e) => {
  console.log('problem with request: %s', e.message);
});
req.end();
