var http = require('http');
var fs = require('fs');
var rest   = require('restler');
var Promise = require('bluebird');
var zlib = require('zlib');

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

    console.log('1.获取箱货查询页面的http响应头，获取sessionid')
    console.log('  查询页面地址: %s', 'http://'+options.hostname+options.path);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);

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

      console.log('  获取的cookie: %s', persistedCookieArray.join(';'));

      res.on('data', (chunk) => {
        //console.log('Getted chunck');
      });

      res.on('end', () => {
        //console.log('Getted end.');
        resolve(persistedCookieArray);
      });
    }); 

    req.on('error', (e) => {
      console.log('  获取异常: %s', e.message);
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

    console.log('2.获取验证码，请求必须带上sessionid')
    console.log('  验证码地址: %s', 'http://'+options.hostname+options.path);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);
      //console.log('HEADERS: %s', JSON.stringify(res.headers));

      var chunks = [];
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        chunks.push(chunk);
        gettedLen += chunk.length;
        console.log('  正在收取验证码图片')
      });

      res.on('end', () => {
        var dataBuffer = new Buffer(gettedLen);
        for (var i = 0, pos = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            chunk.copy(dataBuffer, pos);
            pos += chunk.length;
        }

        console.log('  已完成收取验证码图片')

        fs.writeFile('rdcode.jpg', dataBuffer, (err) => {
          console.log('  已保存收取的验证码图片rdcode.jpg');

          resolve('rdcode.jpg');
        })
      });
    });

    req.on('error', (e) => {
      console.log('  获取验证码异常: %s', e.message);
      reject(e);
    });
    req.end();   
  });
}


function answerRdcode(rdcodeFilename){
  return new Promise(function(resolve, reject){
    console.log('3.破解验证码，将验证码图片发给破解站点')
    rest.post('http://api.ysdm.net/create.json', {
        multipart: true,
        data: {
          'username': 'hba',
          'password': 'ab',
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
        captcha.Result = captcha.Result.toUpperCase();
        rdcode = captcha.Result;
        console.log('  破解结果：%s', JSON.stringify(captcha));
        resolve(data);
      });   
  });
}

function searchInValidationRdcode(){
  return new Promise(function(resolve, reject){
    var postData = "method=3&rdcode=" + encodeURIComponent(rdcode);

    var reqCookie = persistedCookieArray.join(';') + '; ConGoodsCookiesKey=177EBWBWS00666@';

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
        'cookie': reqCookie
      }
    };

    console.log('4.箱货查询前的验证码校验，校验通过方可查询数据，需要发送包含sessionid和单号的cookie')
    console.log('  验证码校验地址: %s', 'http://'+options.hostname+options.path);
    console.log('  验证码校验cookie: %s', reqCookie);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);
      // console.log('HEADERS: %s', JSON.stringify(res.headers));

      var data;
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        data = chunk;
      });

      res.on('end', () => {
        
        zlib.unzip(data, (err, buffer) => {
          if (!err) {
            var rdcodeResult = buffer.toString();
            console.log('  验证结果（unzip后）：' + rdcodeResult);
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
      console.log('  验证异常: %s', e.message);
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

    console.log('5.箱货数据查询')
    console.log('  数据查询地址: %s', 'http://'+options.hostname+options.path);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);
      // console.log('HEADERS: %s', JSON.stringify(res.headers));

      var chunks = [];
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        chunks.push(chunk);
        gettedLen += chunk.length;
      });

      res.on('end', () => {
        var dataBuffer = new Buffer(gettedLen);
        for (var i = 0, pos = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            chunk.copy(dataBuffer, pos);
            pos += chunk.length;
        }

        zlib.unzip(dataBuffer, (err, buffer) => {
          if (!err) {
            console.log('  查询结果：');
            console.log(buffer.toString('utf8'));

          } else {
            // handle error
          }
        });

        
      });
    });

    req.on('error', (e) => {
      console.log('  查询数据异常: %s', e.message);
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