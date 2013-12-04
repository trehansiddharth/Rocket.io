var http	= require("http"),
	url		= require("url"),
	fs		= require("fs"),
	express	= require("express"),
	connect = require("connect"),
	JSZip	= require("node-zip"),
	dl		= require("delivery");

var port = parseInt(process.env.PORT, 10) || 8080;

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var opendocuments = [];
io.sockets.on('connection', function (socket) {
	/*delivery = dl.listen(socket);
	delivery.on('receive.success', function(file) {
		fs.writeFile("./p/" + socket.projid + "/" + file.name, file.buffer, function (err) {});
	});*/
	socket.on('create', function (projid) {
		socket.username = random_username();
		console.log(socket.username);
		socket.projid = projid;
		socket.document = null;
		socket.join(projid);
		var files = fs.readdirSync("./p/" + projid + "/");
		files.splice(files.indexOf("build"), 1);
		socket.emit('update-files', files);
		socket.emit('update-username', socket.username);
		socket.broadcast.in(socket.projid).emit('user-online', socket.username);
		console.log(socket.username);
	});
	socket.on('get-file', function (filename) {
		var contents = fs.readFileSync("./p/" + socket.projid + "/" + filename, "utf8");
		socket.emit('result-contents', contents);
		if (socket.document != null)
		{
			socket.emit('get-whole-file');
			socket.leave(socket.document);
		}
		socket.document = socket.projid + "/" + filename;
		socket.join(socket.document);
		if (!contains(opendocuments, socket.document))
		{
			opendocuments.push(socket.document);
		}
	});
	socket.on('file-change', function(change) {
		socket.broadcast.in(socket.document).emit('file-change', change);
	});
	socket.on('file-save', function (contents) {
		path = "./p/" + socket.document;
		fs.writeFile(path, contents);
	});
	socket.on('disconnect', function () {
		if (socket.document != null)
		{
			socket.leave(socket.document);
		}
		socket.leave(socket.projid);
		io.sockets.in(socket.projid).emit('user-offline', socket.username);
	});
	socket.on('make-file', function (filename, contents) {
		var projid = socket.projid;
		var filename = filename;
		var path = "./p/" + projid + "/" + filename;
		console.log(path);
		fs.openSync(path, "w");
		fs.writeFileSync(path, contents);
		io.sockets.in(projid).emit('update-files', [filename]);
	});
	socket.on('send-chat', function (message) {
		io.sockets.in(socket.projid).emit('chat', socket.username, message);
	});
});
var tid = setInterval(function () {
	for (var i = 0; i < opendocuments.length; i++)
	{
		var document = opendocuments[i];
		var clients = io.sockets.clients(document);
		if (clients.length > 0)
		{
			clients[0].emit('get-whole-file');
		}
		else
		{
			opendocuments.splice(opendocuments.indexOf(document), 1);
		}
	}
}, 3000);

app.configure(function () {
  app.use(connect.bodyParser());
  app.use(app.router);
  express.json();
  express.urlencoded();
});

server.listen(port);

app.use('/public', express.static(__dirname + '/public'));

app.get('/', function(request, response) {
	var redirect_url = "";
	
	while (url_exists(redirect_url))
	{
		redirect_url = random_url();
	}
	response.redirect(redirect_url);
	//response.sendfile("./index.html");
});

app.use(function(req, res, next) {
	if (req.path.substring(0, 3) == '/p/')
	{
		var exists = fs.existsSync('.' + req.path);
		if (exists)
		{
			res.sendfile('./snapcode.html');
		}
		else
		{
			fs.mkdirSync('.' + req.path);
			fs.mkdirSync('.' + req.path + '/build');
			//fs.writeFileSync('.' + req.path + '/project.txt', '');
			res.sendfile('./snapcode.html');
		}
	}
	else if (req.path.substring(0, 3) == '/f/')
	{
	
	}
	else if (req.path.substring(0, 3) == '/g/')
	{
	
	}
	else if (req.path.substring(0, 3) == '/r/')
	{
	
	}
	else if (req.path.substring(0, 11) == '/d/download')
	{
		var parsed = req.headers.referer.split("/");
		var projid = parsed[parsed.length - 1];
		var path = "./p/" + projid;
		writeZip(path, projid);
		var file = fs.readFileSync('./downloads/' + projid + '.zip', 'binary');
		//res.set('Content-Disposition', 'attachment; filename=' + projid + '.zip');
		//res.set('Content-Type', 'application/zip');
		//res.set('Content-Length', file.length);
		res.attachment();
		//res.end(file, 'binary');
		res.pipe(file);
		//res.sendfile(file);
	}
	else
	{
		next();
	}
});

console.log("Listening on port " + port + " ...");

random_url = function () {
	var result = "/p/";
	var possible = "abcdefghijklmnopqrstuvwxyz0123456789"
	
	for (var i = 0; i < 8; i++)
	{
		result += possible.charAt(Math.floor(Math.random() * possible.length));
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
		return fs.existsSync('.' + url);
	}
}
writeZip = function(dir,name) {
	var zip = new JSZip(),
		code = zip.folder(dir),
		filename = name + '.zip';
		
	var options = {base64: false, compression:'DEFLATE'};
	var output = zip.generate(options);
	fs.writeFileSync('./downloads/' + filename, output, 'binary');
	console.log('creating ' + filename);
};

var adjectives = fs.readFileSync('./accessory/adjectives.txt').toString().split("\n");
var nouns = fs.readFileSync('./accessory/nouns.txt').toString().split("\n");

random_username = function () {
	random1 = Math.floor(Math.random() * adjectives.length);
	random2 = Math.floor(Math.random() * nouns.length);
	return adjectives[random1] + " " + nouns[random2];
};
function is_valid_filename(filename) {
	return true;
}

function contains(a, obj) {
    var i = a.length;
    while (i--) {
       if (a[i] === obj) {
           return true;
       }
    }
    return false;
}
