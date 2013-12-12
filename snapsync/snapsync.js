var fs	= require("fs"),
	cp	= require("child_process"),
	si	= require("socket.io");

var io = si.listen(9000);

io.sockets.on('connection', function (socket) {
	socket.emit('connection-ok');
	socket.on('create', function (projid) {
		fs.exists("./" + projid + "/", function (exists) {
			if (!exists)
			{
				fs.mkdir("./" + projid, function (err) {
					if (err)
					{
						socket.emit("error", 3, err);
					}
				});
			}
		});
		socket.projid = projid;
	});
	socket.on('update-build-cmd', function (new_build_cmd) {
		socket.build_cmd = new_build_cmd;
	});
	socket.on('update-build-ops', function (new_build_ops) {
		socket.build_ops = new_build_ops;
	});
	socket.on('update-cwd', function (new_cwd) {
		socket.cwd = new_cwd;
	});
	socket.on('update-sync', function (filename, syncfile) {
		fs.writeFile("./" + socket.projid + "/" + filename, syncfile, function (err) {
			if (err)
			{
				socket.emit('error', 2, err); // 2: write file failed
			}
		});
	});
	socket.on('update-file', function (filename, contents) {
		fs.readFile("./" + socket.projid + "/" + filename, function (err, path) {
			fs.writeFile(path, contents, function (err) {
				if (err)
				{
					socket.emit('error', 2, err); // 2: write file failed
				}
			});
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
			socket.emit('error', 1, "no build command specified"); // 1: no build command specified
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
