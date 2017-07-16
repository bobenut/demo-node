/*
* 云速打码 http 接口(上传)，node.js 示例代码 
* 注意：需要安装restler : npm install restler
*/

var rest 	 = require('restler'),
	fs   	 = require('fs'),
	filename = 'code-imgs/QQ003.jpg';

rest.post('http://api.ysdm.net/create.json', {
	multipart: true,
	data: {
		'username': 'hba',
		'password': 'a',
		'typeid':'5000',
		'softid': '1',
		'softkey': 'b40ffbee5c1cf4e38028c197eb2fc751',
		'image': rest.file(filename, null, fs.statSync(filename).size, null, 'image/jpg') // filename: 抓取回来的码证码文件
	},
	headers: { 
		'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
		'Content-Type' : 'application/x-www-form-urlencoded' 
	}
}).on('complete', function(data) {
	var captcha = JSON.parse(data);
	console.log('Captcha Encoded.');
	captcha.Result = captcha.Result.toUpperCase();
	console.log(captcha);
});