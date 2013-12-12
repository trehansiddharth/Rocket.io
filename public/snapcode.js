sessions = [];

$(document).ready(function () {
	var editor = ace.edit("editor");
	editor.setValue("", -1);
	editor.setFontSize(15);
	var uploading = true;
	var reader = new FileReader();
	/*if ($.cookie('visited'))
	{
		$("#alpha").addClass("invisible-element");
	}
	else
	{
		$.cookie('visited', 'true', { expires: 4, path: '/' });
	}*/
	$("#upload").on('dragenter', function (e) 
	{
		if (uploading)
		{
			e.stopPropagation();
			e.preventDefault();
			$(this).css('border-color', 'black');
		}
	});
	$("#upload").on('dragover', function (e) 
	{
		if (uploading)
		{
			e.stopPropagation();
			e.preventDefault();
		}
	});
	$("#upload").on('drop', function (e) 
	{
		if (uploading)
		{
			$(this).css('border-color', 'gray');
			e.preventDefault();
			var files = e.originalEvent.dataTransfer.files;
		 
			//We need to send dropped files to Server
			handleFileUpload(reader, files);
		}
	});
	$(document).on('dragenter', function (e) 
	{
		if (uploading)
		{
			e.stopPropagation();
			e.preventDefault();
		}
	});
	$(document).on('dragover', function (e) 
	{
		if (uploading)
		{
			e.stopPropagation();
			e.preventDefault();
			$("#upload").css('border-color', 'gray');
		}
	});
	$(document).on('drop', function (e) 
	{
		if (uploading)
		{
			e.stopPropagation();
			e.preventDefault();
		}
	});
	
	$("#choosefile").on('click', function (e)
	{
		if (uploading)
		{
			document.getElementById('upload-dialog').click();
		}
	});
	$("#uploadlink").on('click', function (e)
	{
		if (uploading)
		{
			document.getElementById('upload-dialog').click();
		}
	});
	$("#upload-dialog").change(function (e) {
		handleFileUpload(reader, e.target.files);		
	});
	
	var url = $(location).attr('href');
	
	if (url.indexOf("/p/") !== -1)
	{
		var parsed = $(location).attr('href').split('/');
		var projid = parsed[parsed.length - 1];
		var hostid = parsed[2];
		
		socket = io.connect("http://" + hostid);
	
		$(".add-file").click(function ()
		{
			$(".item").removeClass("selected");
			$(this).addClass("selected");
			$("#editor").addClass("invisible-element");
			$("#start").removeClass("invisible-element");
		});
		
		var gotofile = true;
		var hasfiles = false;
		var inserted = false;
		var currentfile = null;
		var myname = null;
		var nowtalking = null;
		
		$("#makeproject").click(function ()
		{
			if ($("#filename").val().indexOf(".") != -1)
			{
				socket.emit('make-file', $("#filename").val(), $("#cpfile").val());
				//console.log($("#new-filename").val());
				gotofile = true;
				$("#filename").val("");
				$("#cpfile").val("");
			}
			else if (fetch_session($("#filename").val()))
			{
				alert("A file of this name already exists. You must specify a different name.");
			}
			else
			{
				alert("Your file name must be non-empty and specify an extension.");
			}
		});
		
		socket.on('update-files', function (files) {
			if (files.length > 0)
			{
				$("#editor").removeClass("invisible-element");
				$("#start").addClass("invisible-element");
				$("#empty").addClass("invisible-element");
				$("#notempty").removeClass("invisible-element");
			}
			else
			{
				$("#editor").addClass("invisible-element");
				$("#start").removeClass("invisible-element");
			}
			for (var i = 0; i < files.length; i++)
			{
				var filename = files[i].replace(" ", "_");
				$(".super-select").prepend("<div class=\"item fillx\" id=\"" + filename + "\"><span class=\"glyphicon glyphicon-file\"></span> " + files[i] + "</div>");
				socket.emit('get-session', filename);
				$(".item#" + filename.replace(".", "\\.")).click(function ()
				{
					var thisfile = $(this).attr("id");
					$(".item").removeClass("selected");
					$(this).addClass("selected");
					socket.emit('set-file', thisfile);
					currentfile = thisfile;
					var sess = fetch_session(thisfile);
					if (sess !== null)
					{
						editor.setSession(sess["session"]);
					}
					$("#editor").removeClass("invisible-element");
					$("#start").addClass("invisible-element");
				});
				if (i == files.length - 1 && gotofile)
				{
					$(".item#" + filename.replace(".", "\\.")).trigger("click");
					gotofile = false;
					console.log("sdf");
				}
			}
		});
		
		socket.on('push-session', function (filename, contents, syncfile) {
			var modename = require("ace/ext/modelist").getModeForPath(filename).mode;
			var modeobj = require(modename).Mode;
			sessions.push({filename : filename, session: ace.createEditSession(contents, new modeobj()), syncfile: syncfile });
			if (currentfile === filename)
			{
				editor.setSession(fetch_session(filename)["session"]);
			}
		});
		
		socket.on("delete-file", function (filename) {
			// code to delete html element goes here
		});
		
		socket.on('file-change', function (filename, change) {
			inserted = true;
			fetch_session(filename)["session"].getDocument().applyDeltas([change]);
			inserted = false;
		});
		
		socket.on('update-username', function (username) {
			$("#username").append(" <span class=\"tool-text\">" + username + "</span>");
			myname = username;
		});
		
		socket.on('chat', function(username, message) {
			var talkerclass;
			if (nowtalking != username)
			{
				if (username == myname)
				{
					talkerclass = "talker-me";
				}
				else
				{
					talkerclass = "talker-notme";
				}
				$("#substream").append("<div class=\"well well-sm chatmsg\"><div class=\"talker " + talkerclass + "\">" + username + "</div><div class=\"" + talkerclass + " chat-text\"></div></div>");
				nowtalking = username;
			}
			$(".chat-text").last().append(message.replace("<", "&lt;").replace(">", "&gt;") + "<br />");
			$("#substream").scrollTop($("#substream")[0].scrollHeight);
		});
		
		var onlyyou = true;
		
		socket.on('user-online', function(username) {
			if (username != myname)
			{
				if (onlyyou)
				{
					$("#online").empty();
					onlyyou = false;
				}
				$("#online").append("<p id=\"" + username.replace(" ", "_") + "\"class=\"green\"><i class=\"glyphicon glyphicon-user\"></i> " + username + "</p>");
			}
		});
		
		socket.on('user-offline', function(username) {
			$("p#" + username.replace(" ", "_")).remove();
			if ($('#online').is(':empty'))
			{
				$("#online").append("<i>No one else is online</i>");
				onlyyou = true;
			}
		});
		
		editor.on('change', function (e) {
			if (!inserted)
			{
				socket.emit('file-change', e.data);
				console.log(e.data);
				changed = true;
			}
		});
		
		socket.emit('create', projid);
		
		$('#message').keyup(function(e) {
			var code = e.keyCode || e.which;
			if (code == 13)
			{
				socket.emit('send-chat', $('#message').val());
				$('#message').val('');
			}
		});
		
		syncing = false;
		syncsocket = io.connect("http://localhost:9000");
		
		syncsocket.on('connection-ok', function () {
			console.log('connection-ok');
			syncing = true;
			setupsync();
		});
	}
});

function setupsync()
{
	//syncsocket.emit("update-build-cmd", "date");
	
	/*$("#build").on('click', function () {
		syncsocket.emit("build");
	});*/
	
	syncsocket.on("error", function (value, err) {
		alert("Error with SnapSync: error number " + value + ", " + err);
	});
	
	/*syncsocket.on("build-stderr", function (data) {
		console.log("stderr: " + data);
	});
	syncsocket.on("build-stdout", function (data) {
		console.log("stdout: " + data);
	});*/
}

function handleFileUpload(reader, files) // TODO: validate file
{
	var thisfile = null;
	reader.onload = function(e) {
		socket.emit('make-file', thisfile.name, e.target.result);	
	}
	for (var i = 0; i < files.length; i++)
	{
		thisfile = files[i];
		reader.readAsText(files[i]);
	}
}
function handleFileDownload(files)
{
	
}
function opensync()
{
	if (syncing)
	{
		//window.open($(location).attr('href').replace("/p/", "/s/"));
		for (i = 0; i < sessions.length; i++)
		{
			syncsocket.emit("update-file", "./" + sessions[i]["filename"], sessions[i]["session"].getDocument().getValue());
		}
	}
	else
	{
		$("#installss").modal();
	}
	return syncing;
}
function fetch_session(filename)
{
	var i = sessions.length;
	while (i--)
	{
		if (sessions[i]["filename"] === filename)
		{
			return sessions[i];
		}
	}
	return null;
}
