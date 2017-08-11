var http = require('http');
var fs = require('fs');
var rest   = require('restler');
var Promise = require('bluebird');
var zlib = require('zlib');

var persistedCookieArray = [];
var rdcode;

function getShow(){
  return new Promise(function(resolve, reject){
    var options = {
      hostname: 'wx.7dianw.com',
      port: 80,
      path: '/app/index.php?c=entry&do=show&m=xiaof_toupiao&i=2380&sid=714&id=20741&wxref=mp.weixin.qq.com',
      method: 'GET',
      headers: {
        'Host': 'wx.7dianw.com',
        'Connection': 'keep-alive',
        // 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        // 'Upgrade-Insecure-Requests': '1',
        // 'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 MicroMessenger/6.5.2.501 NetType/WIFI WindowsWechat QBCore/3.43.656.400 QQBrowser/9.0.2524.400',
        'Accept-Encoding': 'gzip, deflate',
        // 'Accept-Language': 'zh-CN,zh;q=0.8,en-us;q=0.6,en;q=0.5;q=0.4',
        // 'Cookie': 'PHPSESSID=b6672d24e25dd7e34ad10138f2302df2;',
        'Accept': 'text/html, application/xhtml+xml, image/jxr, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
        'Accept-Language': 'en-US,en;q=0.8,zh-Hans-CN;q=0.5,zh-Hans;q=0.3',
        // 'Cookie': 'PHPSESSID=b6672d24e25dd7e34ad10138f2302df2; Hm_lvt_029e15886cdeb8aeadf835eae9ace446=1502432006; Hm_lpvt_029e15886cdeb8aeadf835eae9ace446=1502442777; PHPSESSID=b6672d24e25dd7e34ad10138f2302df2'
      }
    };

    console.log('1.投票页面1阶段的http响应头，获取sessionid')
    console.log('  查询页面地址: %s', 'http://'+options.hostname+options.path);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);

      var cookie = {};
      var gettedCookieString = res.headers['set-cookie'][0];
      // console.log('cookie: %s', gettedCookieString)
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
    
function getDoVote(){

  return new Promise(function(resolve, reject){
   var options = {
      hostname: 'wx.7dianw.com',
      port: 80,
      path: '/app/index.php?c=entry&do=vote&m=xiaof_toupiao&i=2380&sid=714&id=20741&type=click&wxref=mp.weixin.qq.com',
      method: 'GET',
      headers: {

        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 MicroMessenger/6.5.2.501 NetType/WIFI WindowsWechat QBCore/3.43.656.400 QQBrowser/9.0.2524.400',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://wx.7dianw.com/app/index.php?c=entry&do=show&m=xiaof_toupiao&i=2380&sid=714&id=20741&wxref=mp.weixin.qq.com',
        'accept_encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-us;q=0.6,en;q=0.5;q=0.4',
        'cookie': persistedCookieArray.join(';')
      }
    };

    console.log('2.投票页面2阶段的http响应头')
    console.log('  验证码地址: %s', 'http://'+options.hostname+options.path);

    var req = http.request(options, (res) => {
      console.log('  成功响应，响应码: %s', res.statusCode);
      //console.log('HEADERS: %s', JSON.stringify(res.headers));

      var chunks = [];
      var gettedLen = 0; 

      res.on('data', (chunk) => {
        chunks.push(chunk);
        gettedLen += chunk.length;
        console.log('  正在收取2阶段数据')
      });

      res.on('end', () => {
        var dataBuffer = new Buffer(gettedLen);
        for (var i = 0, pos = 0; i < chunks.length; i++) {
            var chunk = chunks[i];
            chunk.copy(dataBuffer, pos);
            pos += chunk.length;
        }

        console.log('  已完成收取2阶段数据')

        fs.writeFile('2d', dataBuffer, (err) => {
          console.log('  已保存收取的2阶段数据');

          resolve('2d');
        })
      });
    });

    req.on('error', (e) => {
      console.log('  获取2阶段数据: %s', e.message);
      reject(e);
    });
    req.end();   
  });
}

function searchData(){
  // return new Promise(function(resolve, reject){

   var options = {
      hostname: 'wx.7dianw.com',
      port: 80,
      path: '/app/index.php?c=entry&do=vote&m=xiaof_toupiao&i=2380&type=good&id=20741',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36 MicroMessenger/6.5.2.501 NetType/WIFI WindowsWechat QBCore/3.43.656.400 QQBrowser/9.0.2524.400',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'http://wx.7dianw.com/app/index.php?c=entry&do=show&m=xiaof_toupiao&i=2380&sid=714&id=20741&wxref=mp.weixin.qq.com',
        'accept_encoding': 'gzip, deflate',
        'Accept-Language': 'zh-CN,zh;q=0.8,en-us;q=0.6,en;q=0.5;q=0.4',
        'cookie': persistedCookieArray.join(';')
      }
    };

    console.log('5.投票')
    console.log('  投票地址: %s', 'http://'+options.hostname+options.path);

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
      console.log('  投票异常: %s', e.message);
      reject(e);
    });

    // req.write(postData);
    req.end();       
  // });
}

getShow()
  // .then(getDoVote)
  // .then(searchData)
  // .then(searchInValidationRdcode)
  // .catch(function(error){
  //   console.error(error.message);
  // });