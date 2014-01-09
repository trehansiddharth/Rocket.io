var http		= require("http"),
	https		= require("https"),
	url			= require("url"),
	fs			= require("fs"),
	express		= require("express"),
	connect    	= require("connect"),
	JSZip		= require("node-zip"),
	mongodb		= require("mongodb"),
	passport	= require("passport"),
	librequest	= require("request"),
	document	= require("./document/document");

var FacebookStrategy = require('passport-facebook').Strategy,
	GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

var config = fs.readFileSync('./config.ignore').toString().split("\n");
var mongodb_uri = config[0];
var clientID = config[1];
var clientSecret = config[2];
var sessionsecret = config[3];
var googleid = config[4];
var googlesecret = config[5];

passport.use(new FacebookStrategy({
        clientID: clientID,
        clientSecret: clientSecret,
        callbackURL: "/login/facebook"
    },
    function(accessToken, refreshToken, profile, done) {
        done(null, { accessToken : accessToken, refreshToken : refreshToken, profile : profile });
}));
passport.use(new GoogleStrategy({
        clientID: googleid,
        clientSecret: googlesecret,
        callbackURL: "/login/google"
    },
    function(accessToken, refreshToken, profile, done) {
        done(null, { accessToken : accessToken, refreshToken : refreshToken, profile : profile });
}));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

var projects = null;
var users = null;
var testing = true;

mongodb.MongoClient.connect(mongodb_uri, function (err, db) {
	if (err)
	{
		throw err;
	}
	else
	{
		projects = db.collection("projects");
		users = db.collection("users");
		console.log("Connected to database");
	}
});

var port = parseInt(process.env.PORT, 10) || 80;

var app = express();
var server = http.createServer(app);
var io = require('socket.io').listen(server);
io.set('log level', 1)

var opendocuments = [];
var sockets = [];
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
						for (i = 0; i < io.sockets.clients(socket.projid).length; i++)
						{
							var client = io.sockets.clients(socket.projid)[i];
							if (client.document)
							{
								socket.emit('user-online', client.username, client.document.split("/")[1], client.position);
							}
							else
							{
								socket.emit('user-online', client.username, null, client.position);
							}
						}
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
			var i = sockets.length;
			while (i--)
			{
				if (sockets[i]["username"] == username)
				{
					sockets[i]["username"] = username;
				}
			}
		}
		else
		{
			sockets.push({ username : username, projid : socket.projid });
		}
		socket.username = username;
		socket.emit('update-username', username);
		if (socket.document)
		{
			socket.broadcast.in(socket.projid).emit('user-online', socket.username, socket.document.split("/")[1], socket.position);
		}
		else
		{
			socket.broadcast.in(socket.projid).emit('user-online', socket.username, null, socket.position);
		}
	});
	socket.on('file-change', function (filename, change) {
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
	socket.on('cursor-change', function (filename, position) {
		var oldfile = null;
		if (socket.document != socket.projid + "/" + filename)
		{
			if (socket.document)
			{
				oldfile = socket.document.split("/")[1];
				socket.leave(socket.document);
			}
			socket.document = socket.projid + "/" + filename;
			socket.join(socket.document);
		}
		else
		{
			oldfile = filename;
		}
		socket.position = position;
		socket.broadcast.in(socket.projid).emit('cursor-change', socket.username, oldfile, filename, position);
	});
	socket.on('disconnect', function () {
		if (socket.document != null)
		{
			socket.leave(socket.document);
		}
		socket.leave(socket.projid);
		if (socket.username)
		{
			if (socket.document)
			{
				io.sockets.in(socket.projid).emit('user-offline', socket.username, socket.document.split("/")[1]);
			}
			else
			{
				io.sockets.in(socket.projid).emit('user-offline', socket.username, null);
			}
			var i = sockets.length;
			while (i--)
			{
				if (sockets[i]["username"] == socket.username)
				{
					sockets.splice(i, 1);
				}
			}
		}
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
			var new_project = { projid : url.replace("/p/", ""), files : [ { name : filename, contents: contents } ], testing : testing };
			projects.insert(new_project, { w : 1 }, function (err, result) {
				socket.emit('project-ready', url);
			});
		});
	});
	socket.on('ping', function () {
		var i = sockets.length;
		while (i--)
		{
			if (sockets[i]["username"] == socket.username)
			{
				sockets[i]["pinged"] = true;
			}
		}
	});
});
setInterval(function () {
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

setInterval(function () {
	var i = sockets.length;
	while (i--)
	{
		if (sockets[i]["pinged"] == true)
		{
			sockets[i]["pinged"] = false;
		}
		else
		{
			io.sockets.in(sockets[i]["projid"]).emit("user-offline", sockets[i]["username"], null);
			sockets.splice(i, 1);
		}
	}
	io.sockets.emit("ping");
}, 5000);

app.configure(function () {
  app.use(connect.bodyParser());
  express.json();
  express.urlencoded();
  app.use(express.cookieParser());
  app.use(express.session({ secret: sessionsecret }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(app.router);
});

server.listen(port);

app.use('/public', express.static(__dirname + '/public'));

app.get('/', function(request, response) {
	if (request.user)
	{
		response.cookie('username', request.user.profile.displayName, { maxAge: 900000, httpOnly: false});
	}
	request.lastpage = "/";
	response.sendfile("./index.html");
});
app.get('/new', function(request, response) {
	new_random_url(function (url) {
		response.redirect(url);
	});
});
app.get('/auth', function (request, response) {
	response.sendfile("./login.html");
});

app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/login/facebook',
	passport.authenticate('facebook', { failureRedirect: '/errlogin' }),
	function (request, response) {
		console.log(request.user);
		response.redirect(request.session.lastpage);
	}
);

app.get('/auth/google', passport.authenticate('google', {
	scope : "https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/userinfo.profile",
	accessType: "offline",
	approval_prompt : "force"
}));
app.get('/login/google',
	passport.authenticate('google', { failureRedirect: '/errlogin' }),
	function (request, response) {
		//console.log(request.user);
		users.findOne({ profileId : "g" + request.user.profile.id }, function (err, user) {
			if (user)
			{
                request.user.refreshToken = user.refreshToken;
                console.log(request.user.refreshToken);
				if (request.session.lastpage)
				{
					response.redirect(request.session.lastpage);
				}
				else
				{
					response.redirect("/");
				}
			}
			else
			{
				users.insert({
					name : request.user.profile.displayName,
					profileId : "g" + request.user.profile.id,
					refreshToken : request.user.refreshToken,
					accessToken : request.user.accessToken,
					following : []
				}, function (err, newuser) {
					if (request.session.lastpage)
					{
						response.redirect(request.session.lastpage);
					}
					else
					{
						response.redirect("/");
					}
				});
			}
		});
	}
);

app.get('/logout', function(request, response) {
	request.logout();
	response.redirect(request.session.lastpage);
});

app.get('/setup', function (request, response) {
	if (request.user)
	{
        console.log(request.user.accessToken);
		librequest({
            method : "GET",
            uri : "https://www.googleapis.com/plus/v1/people/" + request.user.profile.id + "/people/visible", 
            qs : {
                access_token : request.user.accessToken
            }
		}, function (err, res, body) {
			var json_body = JSON.parse(body);
			console.log(json_body.error);
			if (json_body.error)
			{
                console.log("Trying refresh token: " + request.user.refreshToken);
				librequest({
                    method : "POST",
                    uri : "https://accounts.google.com/o/oauth2/token",
                    form : {
                        refresh_token : request.user.refreshToken,
                        client_id : googleid,
                        client_secret : googlesecret,
                        grant_type : "refresh_token"
                    }
				}, function (e, rs, bd) {
					var json_bd = JSON.parse(bd);
					if (err || json_bd.error)
					{
						response.end("/errlogin");
						console.log("error with login, " + bd);
					}
					else
					{
                        console.log("bd: " + bd);
						console.log("new access token acquired: " + json_bd.access_token);
						request.user.accessToken = json_bd.access_token;
						librequest({
                            method : "GET",
                            uri : "https://www.googleapis.com/plus/v1/people/" + request.user.profile.id + "/people/visible",
                            qs : {
                                access_token : request.user.accessToken
                            }
						}, function (newerr, newres, newbody) {
							var json_newbody = JSON.parse(newbody);
							if (!err && !json_newbody.error)
							{
								console.log(json_newbody);
								response.end("done better!");
							}
                            else
                            {
                                console.log(json_newbody);
                                response.end("fail!");
                            }
						});
					}
				});
			}
			else
			{
				console.log(json_body);
				response.end("done!");
			}
		});
	}
	else
	{
		response.redirect("/errlogin");
	}
});

app.use(function(req, res, next) {
	if (req.path.substring(0, 3) == '/p/')
	{
		url_exists(req.path, function (exists, url) {
			console.log(url);
			req.session.lastpage = url;
			if (req.user)
			{
				res.cookie('username', req.user.profile.displayName, { maxAge: 900000, httpOnly: false});
			}
			if (exists)
			{
				res.sendfile('./snapcode.html');
			}
			else
			{
				var new_project = { projid : url.replace("/p/", ""), files : [], testing: testing };
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
	else if (req.path.substring(0, 3) == '/x/')
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
		if (err)
		{
			throw err;
		}
		else
		{
			if (items)
			{
				cb(items.length > 0, url);
			}
			else
			{
				cb(false, url);
			}
		}
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
	return adjectives[random1] + "_" + nouns[random2];
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
};
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
};
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
};
map_filter = function (array, filter, f) {
	var i = array.length;
	while (i--)
	{
		if (filter(array[i]))
		{
			f(array[i]);
			return true;
		}
	}
	return false;
};
insert_document = function (docid, contents) {
	opendocuments.push({ id: docid, document: new document.Document(contents)});
};
oauth_call = function (accessToken, refreshToken, url, response, cb) {
	request.get(url, { access_token : accessToken }, function (err, res, body) {
		console.log(res);
		console.log(body);
	});
};
