var http	= require("http"),
	url		= require("url"),
	fs		= require("fs");
	express	= require("express");

port = 8900;

http.createServer(function(request, response) {
	if (request.url == "/")
	{
		var redirect_url = "";
		
		while (url_exists(redirect_url))
		{
			redirect_url = random_url();
		}
		response.writeHead(301, {Location: 'http://localhost:' + port + redirect_url});
		response.end();
	}
	else if (request.url.substr(0, 3) == "/p/")
	{
		fs.readFile('index.html', function (err, html) {
			if (err) {
				throw err;
			}
			response.writeHead(200, {'Content-Type': 'text/css'});
			response.write(html);
			response.end();
		});
		/*var options = {
			filename: request.url
		};
		var html = jade.renderFile('index.jade', options);
		response.writeHead(200, {'Content-Type': 'text/html'});
		response.write(html);
		response.end();*/
	}
	else
	{
		fs.readFile(request.url, function (err, html) {
			if (err) {
				//throw err;
			}
			response.writeHead(200, {'Content-Type': 'text/html'});
			response.write(html);
			response.end();
		});
	}
}).listen(port);

console.log("Server running at localhost:" + port);

random_url = function () {
	var result = "/p/";
	var possible = "abcdefghijklmnopqrstuvwxyz0123456789"
	
	for (var i = 0; i < 8; i  )
	{
		result  = possible.charAt(Math.floor(Math.random() * possible.length));
	}
	
	return result;
};
url_exists = function(url) {
	if (url == "")
	{
		return true;
	}
	else
	{
		return false;
	}
}