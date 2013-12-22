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
		console.log("Connected to database");
	}
});

var port = parseInt(process.env.PORT, 10) || 8080;

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
//io.set('log level', 1)

var opendocuments = [];
io.sockets.on('connection', function (socket) {
	socket.on('reset', function (projid) {
		socket.projid = projid;
		socket.document = null;
		socket.join(projid);
		socket.emit("connection-ok");
	});
	socket.on('get-files', function () {
		var projid = socket.projid;
		list_files(projid, function (files) {
			for (i = 0; i < io.sockets.clients(projid).length; i++)
			{
				var client = io.sockets.clients(projid)[i];
				socket.emit('user-online', client.username);
			}
			if (files.length == 0)
			{
				socket.emit("files-added");
			}
			else
			{
				socket.filecount = 0;
				for (i = 0; i < files.length; i++)
				{
					console.log(files[i]);
					var document = projid + "/" + files[i];
					var doc = find_document(document);
					if (doc)
					{
						socket.emit("add-file", files[i], doc["document"].getValue());
					}
					else
					{
						read_file(projid, files[i], function (filename, contents) {
							socket.emit("add-file", filename, contents);
						});
					}
				}
				socket.on("socket-ok", function () {
					socket.filecount++;
					if (socket.filecount == files.length)
					{
						socket.emit("files-added");
					}
				});
			}
		});
	});
	socket.on('random-username', function () {
		socket.emit('random-username', random_username());
	});
	socket.on('update-username', function (username) {
		if (socket.username !== null)
		{
			socket.broadcast.in(socket.projid).emit('user-offline', socket.username);
		}
		socket.username = username;
		socket.emit('update-username', username);
		socket.broadcast.in(socket.projid).emit('user-online', socket.username);
	});
	socket.on('file-change', function(filename, change) {
		if (socket.document != socket.projid + "/" + filename)
		{
			if (socket.document)
			{
				socket.leave(socket.document);
			}
			socket.document = socket.projid + "/" + filename;
			socket.join(socket.document);
		}
		var doc = find_document(socket.document);
		if (doc)
		{
			doc["document"].applyDeltas([change]);
			socket.broadcast.in(socket.projid).emit('file-change', filename, change);
		}
		else
		{
			read_file(socket.projid, filename, function (filename, contents) {
				insert_document(socket.document, contents);
				doc = find_document(socket.document);
				doc["document"].applyDeltas([change]);
				socket.broadcast.in(socket.projid).emit('file-change', filename, change);
			});
		}
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
				io.sockets.in(socket.projid).emit('add-file', filename, contents);
				socket.emit("files-added");
			}
		});
	});
	socket.on('remove-file', function (filename) {
		remove_file(socket.projid, filename, function (err) {
			if (err)
			{
				throw err;
			}
			else
			{
				io.sockets.in(socket.projid).emit("remove-file", filename);
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
				var new_project = { projid : url.replace("/p/", ""), files : [], testing: false };
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
			cb(filename, items[0]["files"][0]["contents"]);
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
