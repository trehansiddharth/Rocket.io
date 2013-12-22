$(document).ready(function () {
	url = $(location).attr('href');
	
	if (url.indexOf("/p/") !== -1)
	{
		editor = ace.edit("editor");
		var Range = ace.require('ace/range').Range;
		editor.setFontSize(15);
		var uploading = true;
		var reader = new FileReader();
		var parsed = url.split('/');
		projid = parsed[parsed.length - 1];
		hostid = parsed[2];
		var lastfile = null;
		var inserted = false;
		currentfile = null;
		previewfile = null;
		var myname = null;
		var nowtalking = null;
		var settingsfile = null;
		var onlyyou = true;
		sessions = [];
		
		dom_files = $("#files");
		dom_editor = $("#editor");
		dom_start = $("#start");
		dom_upload = $("#upload");
		dom_addfile = $(".add-file");
		
		socket = io.connect("http://" + hostid);
		
		socket.on('add-file', function (filename, contents) {
			if (!lastfile)
			{
				$("#empty").addClass("invisible-element");
				$("#notempty").removeClass("invisible-element");
				lastfile = filename;
			}
			dom_files.append(html_file(filename));
			var modename = require("ace/ext/modelist").getModeForPath(filename).mode;
			var modeobj = require(modename).Mode;
			var item = $("#item-" + filename.replace(".", "\\."));
			sessions.push({filename : filename, session: ace.createEditSession(contents, new modeobj()), item : item});
			item.find("#file").click(function () {
				var thisfile = this.parentNode.parentNode.parentNode.parentNode.id.substr(5);
				select_file(thisfile);
			});
			item.hover(function () {
				select_file(this.id.substr(5));
			}, function () {
				//unpreview_file();
			});
			item.find("#cog").click(function () {
				var thisfile = this.parentNode.parentNode.parentNode.parentNode.id.substr(5);
				console.log(thisfile);
				settingsfile = thisfile;
				$("#file-name").val(thisfile);
				if (syncing)
				{
					$("#sync-with").prop('disabled', false);
					
					syncsocket.emit('get-sync', thisfile);
				}
				else
				{
					$("#sync-with").prop('disabled', true);
					$("#sync-with").val("You need to have SnapSync installed for this to work");
				}
				$("#file-settings").modal();
			});
			socket.emit("socket-ok");
		});
		socket.on("remove-file", function (filename) {
			var session = fetch_session(filename);
			session["item"].parentNode.removeChild(session["item"]);
			remove_session(filename);
			if (currentfile === filename)
			{
				var thisfile = sessions[0]["filename"];
				select_file(thisfile);
			}
		});
		socket.on("rename-file", function (previous_filename, filename) {
			
		});
		socket.on('files-added', function () {
			if (lastfile)
			{
				select_file(lastfile);
			}
			else
			{
				dom_editor.addClass("invisible-element");
				dom_start.removeClass("invisible-element");
				dom_addfile.addClass("selected");
			}
			if (!myname)
			{	
				socket.emit('random-username');
			}
		});
		socket.on("connection-ok", function () {
			socket.emit("get-files");
		});
		
		socket.on('file-change', function (filename, change) {
			inserted = true;
			var sess = fetch_session(filename)["session"];
			sess.getDocument().applyDeltas([change]);
			var chrange = new Range(change.range.start.row, change.range.start.column, change.range.end.row, change.range.end.column);
			sess.addMarker(chrange, "mark", "fullLine", false);
			inserted = false;
		});
		editor.on('change', function (e) {
			var change = e.data;
			if (!inserted)
			{
				socket.emit('file-change', currentfile, change);
				changed = true;
			}
			//var chrange = new Range(change.range.start.row, change.range.start.column, change.range.end.row, change.range.end.column);
			//editor.getSession().addMarker(chrange, "mark-self", "fullLine", false);
		});
		
		socket.on('random-username', function (username) {
			socket.emit('update-username', username);
		});		
		socket.on('update-username', function (username) {
			$("#username").append(html_username(username));
			//$("#login-username").text(username);
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
				$("#substream").append(html_chat(talkerclass, username));
				nowtalking = username;
			}
			$(".chat-text").last().append(message.replace("<", "&lt;").replace(">", "&gt;") + "<br />");
			$("#substream").scrollTop($("#substream")[0].scrollHeight);
		});
		socket.on('user-online', function(username) {
			if (username != myname)
			{
				if (onlyyou)
				{
					$("#online").empty();
					onlyyou = false;
				}
				$("#online").append(html_user(username));
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
		$('#message').keyup(function(e) {
			var code = e.keyCode || e.which;
			if (code == 13)
			{
				socket.emit('send-chat', $('#message').val());
				$('#message').val('');
			}
		});
		
		socket.emit("reset", projid);
		
		$("#file-settings-save").on("click", function () {
			if (syncing)
			{
				syncsocket.emit("update-sync", settingsfile, $("#sync-with").val()); // TODO: curry in the settingsfile variable
			}
			$("#file-settings").modal('hide');
		});
		dom_upload.on('dragenter', function (e) 
		{
			if (uploading)
			{
				e.stopPropagation();
				e.preventDefault();
				$(this).css('border-color', 'black');
			}
		});
		dom_upload.on('dragover', function (e) 
		{
			if (uploading)
			{
				e.stopPropagation();
				e.preventDefault();
			}
		});
		dom_upload.on('drop', function (e) 
		{
			if (uploading)
			{
				$(this).css('border-color', 'gray');
				e.preventDefault();
				var files = e.originalEvent.dataTransfer.files;
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
		dom_addfile.hover(function () {
			if (currentfile)
			{
				$("#item-" + currentfile.replace(".", "\\.")).removeClass("selected");
			}
			$(this).addClass("selected");
			$("#editor").addClass("invisible-element");
			$("#start").removeClass("invisible-element");
			currentfile = null;
		}, function () { });
		$("#makeproject").click(function ()
		{
			if ($("#filename").val().indexOf(".") != -1)
			{
				socket.emit('make-file', $("#filename").val(), $("#cpfile").val());
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
		$(".super-select").mouseleave(function () {
			//unpreview_file();
		});
		
		// SnapSync integration
		
		syncing = false;
		syncsocket = io.connect("http://localhost:9000");
		
		syncsocket.on('connection-ok', function () { // TODO: the order here is messed up
			console.log('connection-ok');
			syncing = true;
			setupsync();
		});
	}
	else
	{
		// TODO: redirect to error page
	}
});

function setupsync()
{
	//syncsocket.emit("update-build-cmd", "date");
	
	syncsocket.emit("create", projid);
	
	syncsocket.on("error", function (value, err) {
		if (value == 1)
		{
			alert("ERROR: No build command was specified");
		}
		else if (value == 2)
		{
			alert("ERROR: A file write operation failed");
		}
		else if (value == 3)
		{
			alert("ERROR: Making the project directory failed");
		}
		else if (value == 4)
		{
			alert("ERROR: A variable was unspecified");
		}
	});
	
	syncsocket.on('get-sync', function (filename) {
		$("#sync-with").val(filename);
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
		socket.emit('make-file', thisfile.name.replace(" ", "_"), e.target.result);	
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
			var sess = sessions[i];
			syncsocket.emit("update-file", sessions[i]["filename"], sessions[i]["session"].getDocument().getValue());
		}
	}
	else
	{
		$("#installss").modal();
	}
	return syncing;
}
function openbuild()
{
	if (syncing)
	{
		//window.open($(location).attr('href').replace("/p/", "/s/"));
		alert("This feature will be implented soon!");
	}
	else
	{
		$("#installss").modal();
	}
	return syncing;
}
function opendeploy()
{
	if (syncing)
	{
		//window.open($(location).attr('href').replace("/p/", "/s/"));
		for (i = 0; i < sessions.length; i++)
		{
			alert("This feature will be implented soon!");
		}
	}
	else
	{
		$("#installss").modal();
	}
	return syncing;
}
function opensettings()
{
	if (syncing)
	{
		//window.open($(location).attr('href').replace("/p/", "/s/"));
		for (i = 0; i < sessions.length; i++)
		{
			alert("This feature will be implented soon!");
		}
	}
	else
	{
		$("#installss").modal();
	}
	return syncing;
}
function installsnapsync()
{
	window.open("http://" + hostid + "/public/snapsync-0.1-linux.zip");
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
function remove_session(filename)
{
	var i = sessions.length;
	while (i--)
	{
		if (sessions[i]["filename"] === filename)
		{
			sessions.splice(i, 1);
		}
	}
}

function html_file(filename)
{
	return "<div id=\"item-" + filename + "\" class=\"item fillx\"><table><td><i class=\"glyphicon glyphicon-file\"></i></td><td id=\"file\" class=\"item-main\">" + filename + "</td><td class=\"fillx\"></td><td id=\"cog\"><i class=\"glyphicon glyphicon-cog pointing\"></i></td></table></div>";

// <td><i class=\"glyphicon glyphicon-remove red pointing\"></i></td>
}
function html_username(username)
{
	return " <span class=\"tool-text\">" + username + "</span>";
}
function html_chat(talkerclass, username)
{
	return "<div class=\"well well-sm chatmsg\"><div class=\"talker " + talkerclass + "\">" + username + "</div><div class=\"" + talkerclass + " chat-text\"></div></div>";
}
function html_user(username)
{
	return "<p id=\"" + username.replace(" ", "_") + "\"class=\"green\"><i class=\"glyphicon glyphicon-user\"></i> " + username + "</p>";
}
select_file = function (filename) {
	var session = fetch_session(filename);
	if (currentfile)
	{
		$("#item-" + currentfile.replace(".", "\\.")).removeClass("selected");
	}
	else
	{
		dom_editor.removeClass("invisible-element");
		dom_start.addClass("invisible-element");
	}
	dom_addfile.removeClass("selected");
	session["item"].addClass("selected");
	currentfile = filename;
	editor.setSession(session["session"]);
	editor.focus();
};
/*preview_file = function (filename) {
	var session = fetch_session(filename);
	if (previewfile)
	{
		$("#item-" + previewfile.replace(".", "\\.")).removeClass("selected");
	}
	else if (currentfile)
	{
		$("#item-" + currentfile.replace(".", "\\.")).removeClass("selected");
	}
	else
	{
		dom_editor.removeClass("invisible-element");
		dom_start.addClass("invisible-element");
	}
	dom_addfile.removeClass("selected");
	session["item"].addClass("selected");
	previewfile = filename;
	editor.setSession(session["session"]);
	editor.setReadOnly(true);
};
unpreview_file = function () {
	var session = fetch_session(currentfile);
	if (previewfile)
	{
		$("#item-" + previewfile.replace(".", "\\.")).removeClass("selected");
	}
	else
	{
		dom_editor.removeClass("invisible-element");
		dom_start.addClass("invisible-element");
	}
	previewfile = null;
	dom_addfile.removeClass("selected");
	session["item"].addClass("selected");
	editor.setSession(session["session"]);
	editor.focus();
	editor.setReadOnly(false);
};*/
