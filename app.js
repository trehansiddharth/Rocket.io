var http		= require("http"),
	url			= require("url"),
	fs			= require("fs"),
	express		= require("express"),
	connect 	= require("connect"),
	JSZip		= require("node-zip"),
	mongodb		= require("mongodb");
	document	= require("./document/document");

var projects = null;

config = fs.readFileSync('./config.ignore').toString().split("\n");
mongodb_uri = config[0];

mongodb.MongoClient.connect(mongodb_uri, function (err, db) {
	if (err)
	{
		throw err;
	}
	else
	{
		projects = db.collection("projects");
	}
});

var port = parseInt(process.env.PORT, 10) || 8080;

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
//io.set('log level', 1)

var opendocuments = [];
io.sockets.on('connection', function (socket) {
	socket.on('create', function (projid) {
		socket.username = random_username();
		socket.projid = projid;
		socket.document = null;
		socket.join(projid);
		list_files(projid, function (files) {
			socket.emit('update-files', files);
			socket.emit('update-username', socket.username);
			socket.broadcast.in(socket.projid).emit('user-online', socket.username);
			for (i = 0; i < io.sockets.clients(projid).length; i++)
			{
				var client = io.sockets.clients(projid)[i];
				socket.emit('user-online', client.username);
			}
		});
	});
	socket.on('set-file', function (filename) {
		socket.document = socket.projid + "/" + filename;
		socket.join(socket.document);
		if (!find_document(socket.document))
		{
			read_file(socket.projid, filename, function (contents) {
				insert_document(socket.document, contents);
				console.log("new file added: " + filename);
			});
		}
	});
	socket.on('get-session', function (filename) {
		var document = socket.projid + "/" + filename;
		var doc = find_document(document);
		if (doc)
		{
			socket.emit('push-session', filename, doc["document"].getValue());
		}
		else
		{
			read_file(socket.projid, filename, function (contents) {
				socket.emit('push-session', filename, contents);
			});
		}
	});
	socket.on('file-change', function(change) {
		console.log(socket.document);
		find_document(socket.document)["document"].applyDeltas([change]);
		socket.broadcast.in(socket.projid).emit('file-change', socket.document.split("/")[1], change);
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
		create_file(socket.projid, filename, contents, function (err, count) {
			if (err)
			{
				throw err;
			}
			else
			{
				io.sockets.in(socket.projid).emit('update-files', [filename]);
			}
		});
	});
	socket.on('send-chat', function (message) {
		io.sockets.in(socket.projid).emit('chat', socket.username, message);
	});
	socket.on('make-project', function (filename, contents) {
		new_random_url(function (url) {
			var new_project = { projid : url.replace("/p/", ""), files : [] };
			projects.insert(new_project, { w : 1 }, function (err, result) {
				socket.emit('project-ready', url);
			});
		});
	});
});
var tid = setInterval(function () {
	var i = opendocuments.length;
	while (i--)
	{
		var docid = opendocuments[i]["id"];
		var clients = io.sockets.clients(docid);
		if (clients.length == 0)
		{
			var projid = docid.split("/")[0];
			var filename = docid.split("/")[1];
			write_file(projid, filename, opendocuments[i]["document"].getValue(), function (err, count) {
				if (err)
				{
					throw err;
				}
				else
				{
					opendocuments.splice(i, 1);
				}
			});
		}
	}
}, 10000);

app.configure(function () {
  app.use(connect.bodyParser());
  app.use(app.router);
  express.json();
  express.urlencoded();
});

server.listen(port);

app.use('/public', express.static(__dirname + '/public'));

app.get('/', function(request, response) {
	new_random_url(function (url) {
		response.redirect(url);
	});
});
app.get('/alternate', function(request, response) {
	response.sendfile("./index.html");
});

app.use(function(req, res, next) {
	if (req.path.substring(0, 3) == '/p/')
	{
		url_exists(req.path, function (exists, url) {
			if (exists)
			{
				res.sendfile('./snapcode.html');
			}
			else
			{
				var new_project = { projid : url.replace("/p/", ""), files : [], testing: true };
				projects.insert(new_project, { w : 1 }, function (err, result) {
					res.sendfile('./snapcode.html');
				});
			}
		});
	}
	else if (req.path.substring(0, 3) == '/s/')
	{
		url_exists(req.path, function (exists, url) {
			if (exists)
			{
				res.sendfile('./sync.html');
			}
		});
	}
	else if (req.path.substring(0, 3) == '/g/')
	{
	
	}
	else if (req.path.substring(0, 3) == '/r/')
	{
	
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
url_exists = function(url, cb) {
	projects.find({ projid : url.replace("/p/", "") }).toArray(function (err, items) {
		cb(items.length > 0, url);
	});
}
new_random_url = function(cb) {
	url_exists(random_url(), function (exists, url) {
		if (exists)
		{
			new_random_url(cb);
		}
		else
		{
			cb(url);
		}
	});
}

var adjectives = fs.readFileSync('./accessory/adjectives.txt').toString().split("\n");
var nouns = fs.readFileSync('./accessory/nouns.txt').toString().split("\n");

random_username = function () {
	random1 = Math.floor(Math.random() * adjectives.length);
	random2 = Math.floor(Math.random() * nouns.length);
	return adjectives[random1] + " " + nouns[random2];
};
is_valid_filename = function (filename) {
	return true;
}

list_files = function (projid, cb) {
	projects.find({projid: projid}, {"files.name": 1}).toArray(function (err, items) {
		if (err)
		{
			throw err;
		}
		else
		{
			cb(items[0]["files"].map(function (elem) { return elem["name"]; }));
		}
	});
}
create_file = function (projid, filename, contents, cb) {
	projects.update({ projid: projid }, {$push: { files: { name: filename, contents: contents}}}, cb);
}
read_file = function (projid, filename, cb) {
	projects.find({projid: projid}, {files: {$elemMatch: {name: filename}}}).toArray(function (err, items) {
		if (err)
		{
			throw err;
		}
		else
		{
			cb(items[0]["files"][0]["contents"]);
		}
	});
}
write_file = function (projid, filename, contents, cb) {
	projects.update({ projid: projid, "files.name": filename }, {$set: { "files.$.contents": contents }}, cb);
}

contains = function (a, obj) {
    var i = a.length;
    while (i--)
    {
       if (a[i] === obj)
       {
           return true;
       }
    }
    return false;
}
is_open = function (document) {
	var i = opendocuments.length;
	while (i--)
	{
		if (opendocuments[i]["id"] === document)
		{
			return true;
		}
	}
	return false;
}
remove_document = function (document) {
	var i = opendocuments.length;
	while (i--)
	{
		if (opendocuments[i]["id"] === document)
		{
			opendocuments.splice(i, 1);
			return true;
		}
	}
	return false;
}
find_document = function (document) {
	var i = opendocuments.length;
	while (i--)
	{
		if (opendocuments[i]["id"] === document)
		{
			return opendocuments[i];
		}
	}
	return null;
}
insert_document = function (docid, contents) {
	opendocuments.push({ id: docid, document: new document.Document(contents)});
}
