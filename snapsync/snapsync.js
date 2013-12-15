var fs		= require("fs"),
	cp		= require("child_process"),
	si		= require("socket.io");

var io = si.listen(9000);

io.sockets.on('connection', function (socket) {
	socket.emit('connection-ok');
	socket.on('create', function (projid) {
		socket.projid = projid;
		fs.exists("./projects/" + projid, function (exists) {
			if (!exists)
			{
				fs.mkdir("./projects/" + projid, function (err) {
					if (err)
					{
						socket.emit("error", 3, err);
					}
				});
			}
			else
			{
				/*get_cwd(socket, socket.projid, function (cwd) {
					socket.cwd = cwd;
				});
				get_build_ops(socket, projid, function (ops) {
					socket.build_ops = ops;
				});
				get_build_cmd(socket, projid, function (cmd) {
					socket.build_cmd = cmd;
				});*/
			}
		});
	});
	socket.on('update-build-cmd', function (new_build_cmd) {
		fs.writeFile("./projects/" + socket.projid + ".build_cmd", new_build_cmd, function (err) {
			if (err)
			{
				socket.emit('error', 2, err); // 2: write file failed
			}
		});
	});
	socket.on('update-build-ops', function (new_build_ops) {
		for (i = 0; i < new_build_ops.length; i++)
		{
			fs.writeFile("./projects/" + socket.projid + ".build_ops." + i, new_build_ops[i], function (err) {
				if (err)
				{
					socket.emit('error', 2, err); // 2: write file failed
				}
			});
		}
	});
	socket.on('update-cwd', function (new_cwd) {
		if (new_cwd.slice(-1) == "/")
		{
			new_cwd = new_cwd.slice(0, -1);
		}
		fs.writeFile("./projects/" + socket.projid + ".cwd", new_cwd, function (err) {
			if (err)
			{
				socket.emit('error', 2, err); // 2: write file failed
			}
		});
	});
	socket.on('update-sync', function (filename, syncfile) {
		fs.writeFile("./projects/" + socket.projid + "/" + filename, syncfile, function (err) {
			if (err)
			{
				console.log(err);
				socket.emit('error', 2, err); // 2: write file failed
			}
		});
	});
	socket.on('get-sync', function (filename, syncfile) {
		get_sync(socket, socket.projid, filename, function (path) {
			socket.emit('get-sync', path);
		});
	});
	socket.on('get-cwd', function () {
		get_cwd(socket, socket.projid, function (cwd) {
			socket.emit('get-cwd', cwd);
		});
	});
	socket.on('get-build-ops', function () {
		get_build_ops(socket, socket.projid, function (ops) {
			socket.emit('get-build-ops', ops);
		});
	});
	socket.on('get-build-cmd', function () {
		get_build_cmd(socket, socket.projid, function (cmd) {
			socket.emit('get-build-cmd', cmd);
		});
	});
	socket.on('update-file', function (filename, contents) {
		fs.readFile("./projects/" + socket.projid + "/" + filename, "utf8", function (err, data) {
			if (!err)
			{
				var path = data.split("\n")[0];
				if (path !== "")
				{
					if (path.slice(0, 1) == ".")
					{
						path = get_cwd(socket, socket.projid, function (cwd) {
							path = cwd + "/" + path;
							if (path.substring(0, 2) == "~/")
							{
								path = process.env.HOME + path.substr(1);
								fs.writeFile(path, contents, function (err) {
									if (err)
									{
										socket.emit('error', 2, err); // 2: write file failed
									}
								});
							}
						});
					}
					else if (path.slice(0, 1) == "~")
					{
						path = process.env.HOME + path.substr(1);
						fs.writeFile(path, contents, function (err) {
							if (err)
							{
								socket.emit('error', 2, err); // 2: write file failed
							}
						});
					}
					else
					{
						fs.writeFile(path, contents, function (err) {
							if (err)
							{
								socket.emit('error', 2, err); // 2: write file failed
							}
						});
					}
				}
			}
		});
	});
	socket.on('build', function () {
		if (socket.build_cmd !== null)
		{
			var builder = cp.spawn(socket.build_cmd, socket.build_ops, { cwd: socket.cwd });
			builder.stdout.on('data', function (data) {
				socket.emit('build-stdout', data.toString());
			});
			builder.stderr.on('data', function (data) {
				socket.emit('build-stderr', data.toString());
			});
			builder.on('close', function (code) {
				socket.emit('build-close', code);
			});
		}
		else
		{
			socket.emit('error', 4, "no build command specified"); // 1: no build command specified
		}
	});
	socket.on('console-start', function () {
		socket.proc = cp.spawn("bash", [], {cwd: socket.cwd});
		socket.proc.stdout.on('data', function (data) {
			socket.emit('console-stdout', data.toString());
		});
		socket.proc.stderr.on('data', function (data) {
			socket.emit('console-stderr', data.toString());
		});
	});
	socket.on('console-write', function (data) {
		socket.proc.stdin.write(data);
	});
	socket.on('console-kill', function () {
		socket.proc.kill();
	});
});

get_cwd = function (socket, projid, cb) {
	fs.readFile("./projects/" + projid + ".cwd", "utf8", function (err, data) {
		if (err)
		{
			socket.emit("error", 4, err); // 4: variable not set
		}
		else
		{
			cb(data.split("\n")[0]);
		}
	});
}
get_build_cmd = function (socket, projid, cb) {
	fs.readFile("./projects/" + projid + ".build_cmd", "utf8", function (err, data) {
		if (err)
		{
			socket.emit("error", 4, err);
		}
		else
		{
			cb(data.split("\n")[0]);
		}
	});
}
get_build_ops = function (socket, projid, cb) {
	read_ops_from_i(projid, 0, [], cb);
}
read_ops_from_i = function (projid, i, older, cb) {
	fs.exists("./projects/" + projid + ".build_ops." + i, function (exists) {
		if (exists)
		{
			fs.readFile("./projects/" + projid + ".build_ops." + i, "utf8", function (err, data) {
				if (err)
				{
					socket.emit("error", 4, err);
				}
				else
				{
					read_ops_from_i(projid, i, older.push(data.split("\n")[0]), cb);
				}
			});
		}
		else
		{
			cb(older);
		}
	});
}
get_sync = function (socket, projid, filename, cb) {
	fs.readFile("./projects/" + projid + "/" + filename, "utf8", function (err, data) {
		if (err)
		{
			cb("");
		}
		else
		{
			cb(data.split("\n")[0]);
		}
	});
}
