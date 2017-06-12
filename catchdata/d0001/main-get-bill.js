var http = require('http');
var fs = require('fs');
var rest   = require('restler');
var Promise = require('bluebird');
var zlib = require('zlib');

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

var persistedCookieArray = [];
var rdcode;

function getSearchPage(){
  return new Promise(function(resolve, reject){
    var options = {
      hostname: 'www.hb56.com',
      port: 80,
      path: '/PublicQuery/NewConGoods.aspx',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    };

    var req = http.request(options, (res) => {
      console.log('STATUS: %s', res.statusCode);
      console.log('HEADERS: %s', JSON.stringify(res.headers));

      var cookie = {};
      var gettedCookieString = res.headers['set-cookie'][0];
      var gettedcookieArray = gettedCookieString.split(';');
      
      for(var i = 0, cookieItem; cookieItem = gettedcookieArray[i++]; ){
        if(cookieItem === ' HttpOnly'){
          continue;
        }

        if(cookieItem === ' Path=/'){
          continue;
        }

        persistedCookieArray.push(cookieItem);
        
      }

      console.log(persistedCookieArray);
      console.log(persistedCookieArray.join(';'));

      

      // var chunks = [];
      // var gettedLen = 0; 

      res.on('data', (chunk) => {
        console.log('Getted chunck');
        //console.log('BODY: %s', chunk);
        // chunks.push(chunk);
        // gettedLen += chunk.length;
      });

      res.on('end', () => {
        console.log('Getted end.');

        //@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // getRdCode(persistedCookieArray);
        resolve(persistedCookieArray);
      });
    }); 

    req.on('error', (e) => {
      console.log('problem with request: %s', e.message);
      reject(e);
    });

    req.end();   
  });
}
    




function getRdCode(){

  return new Promise(function(resolve, reject){
   var options = {
      hostname: 'www.hb56.com',
      port: 80,
      path: '/RdCode.aspx?' + Math.random(),
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Accept': 'image/webp,image/*,*/*;q=0.8',
        'cookie': persistedCookieArray.join(';')
      }
    };

    var req = http.request(options, (res) => {
      console.log('STATUS: %s', res.statusCode);
      console.log('HEADERS: %s', JSON.stringify(res.headers));

      var chunks = [];
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        // console.log('BODY: %s', chunk);
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

        fs.writeFile('rdcode.jpg', dataBuffer, (err) => {
          console.log('created image file');

          resolve('rdcode.jpg');
        })
      });
    });

    req.on('error', (e) => {
      console.log('problem with request: %s', e.message);
      reject(e);
    });
    req.end();   
  });
}


function answerRdcode(rdcodeFilename){
  return new Promise(function(resolve, reject){
   rest.post('http://api.ysdm.net/create.json', {
      multipart: true,
      data: {
        'username': 'hbabaoh',
        'password': 'abc123456789',
        'typeid':'5000',
        'softid': '1',
        'softkey': 'b40ffbee5c1cf4e38028c197eb2fc751',
        'image': rest.file(rdcodeFilename, null, fs.statSync(rdcodeFilename).size, null, 'image/jpg')
      },
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
        'Content-Type' : 'application/x-www-form-urlencoded' 
      }
    }).on('complete', function(data) {
      var captcha = JSON.parse(data);
      console.log('Captcha Encoded.');
      captcha.Result = captcha.Result.toUpperCase();
      rdcode = captcha.Result;
      console.log(captcha);
      resolve(data);
    });   
  });
}

function searchInValidationRdcode(){
  return new Promise(function(resolve, reject){
    var postData = "method=3&rdcode=" + encodeURIComponent(rdcode);

    var options = {
      hostname: 'www.hb56.com',
      port: 80,
      path: '/PublicQuery/ConGoodSearch.ashx',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
        'cookie': persistedCookieArray.join(';') + '; ConGoodsCookiesKey=177EBWBWS00666@'
      }
    };

    var req = http.request(options, (res) => {
      console.log('STATUS: %s', res.statusCode);
      console.log('HEADERS: %s', JSON.stringify(res.headers));

      var data;
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        data = chunk;
      });

      res.on('end', () => {
        
        zlib.unzip(data, (err, buffer) => {
          if (!err) {
            // console.log();
            var rdcodeResult = buffer.toString();
            console.log('result validated rdcode: ' + rdcodeResult);
            if('OK' === rdcodeResult){
              searchData();
            }
          } else {
            // handle error
          }
        });
      });
    });

    req.on('error', (e) => {
      console.log('searchInValidationRdcode problem with request: %s', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();   
  });
}

function searchData(){
  // return new Promise(function(resolve, reject){
    var postData = "cid=177EBWBWS00666~&method=0&rdcode=" + encodeURIComponent(rdcode);

    var options = {
      hostname: 'www.hb56.com',
      port: 80,
      path: '/PublicQuery/ConGoodSearch.ashx?type=1',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
        'cookie': persistedCookieArray.join(';') + '; ConGoodsCookiesKey=177EBWBWS00666@'
      }
    };

    var req = http.request(options, (res) => {
      console.log('STATUS: %s', res.statusCode);
      console.log('HEADERS: %s', JSON.stringify(res.headers));

      var chunks = [];
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        // console.log('BODY: %s', chunk);
        chunks.push(chunk);
        gettedLen += chunk.length;
      });

      res.on('end', () => {
        console.log('search end.');

        var dataBuffer = new Buffer(gettedLen);
        for (var i = 0, pos = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            chunk.copy(dataBuffer, pos);
            pos += chunk.length;
        }

        zlib.unzip(dataBuffer, (err, buffer) => {
          if (!err) {
            // console.log();
            console.log(buffer.toString('utf8'));

          } else {
            // handle error
          }
        });

        
      });
    });

    req.on('error', (e) => {
      console.log('searchData problem with request: %s', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();       
  // });
}

getSearchPage()
  .then(getRdCode)
  .then(answerRdcode)
  .then(searchInValidationRdcode)
  .catch(function(error){
    console.error(error.message);
  });