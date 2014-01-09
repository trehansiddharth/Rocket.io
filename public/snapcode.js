$(document).ready(function () {
	if (window.location.hash && window.location.hash == '#_=_')
	{
		window.location.replace(window.location.split('#')[0]);
	}
	url = $(location).attr('href');
	var parsed = url.split('/');
	
	if (url.indexOf("/p/") !== -1)
	{
		editor = ace.edit("editor");
		var Range = ace.require('ace/range').Range;
		var Selection = ace.require('ace/selection').Selection;
		editor.setFontSize(15);
		var uploading = true;
		var reader = new FileReader();
		projid = parsed[parsed.length - 1];
		if (projid.indexOf("#") > -1)
		{
			projid = projid.slice(0, projid.indexOf("#"));
		}
		hostid = parsed[2];
		var lastfile = null;
		var inserted = false;
		currentfile = null;
		previewfile = null;
		var myname = null;
		var nowtalking = null;
		var settingsfile = null;
		var onlyyou = true;
		var changingsession = true;
		sessions = [];
		users = [];
		sections = [];
		modes = [];
		
		var cuser = getCookie("username");
		
		if (cuser != "")
		{
			$("#login-username").html("<i class=\"glyphicon glyphicon-user\"></i> " + unescape(cuser).split(" ")[0]);
		}
		
		dom_files = $("#files");
		dom_editor = $("#editor");
		dom_start = $("#start");
		dom_upload = $("#upload");
		dom_addfile = $(".add-file");
		
		//dom_editor.find(".ace_content").css("font-family", "monospace");
		//editor.container.style.fontFamily = "monospace";
		
		socket = io.connect("http://" + hostid);
		
		socket.on('add-file', function (filename, contents) {
			if (!lastfile)
			{
				$("#empty").addClass("invisible-element");
				$("#notempty").removeClass("invisible-element");
				lastfile = filename;
			}
			insert_file(filename);
			var moden = require("ace/ext/modelist").getModeForPath(filename).mode;
			console.log("MODE: " + moden);
			make_mode(moden, function (modename) {
				var item = $("#item-" + filename.replace(".", "\\."));
				var modeobj = require(modename).Mode;
				var session = ace.createEditSession(contents, new modeobj());
				sessions.push({filename : filename, session: session, item : item});
				item.hover(function () {
					select_file(this.id.substr(5));
					// open hover file settings
				}, function () { /* close hover file settings */ });
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
				if (cuser == "")
				{
					socket.emit('random-username');
				}
				else
				{
					socket.emit("update-username", unescape(cuser));
				}
			}
		});
		socket.on("connection-ok", function () {
			socket.emit("get-files");
		});
		
		socket.on('file-change', function (filename, change) {
			inserted = true;
			var sess = fetch_session(filename)["session"];
			sess.getDocument().applyDeltas([change]);
			inserted = false;
		});
		editor.on('change', function (e) {
			var change = e.data;
			if (!inserted)
			{
				socket.emit('file-change', currentfile, change);
				changed = true;
			}
		});
		socket.on('cursor-change', function (username, oldfile, newfile, position) {
			var i = users.length;
			while (i--)
			{
				if (users[i]["username"] === username)
				{
					if (users[i]["cursor"] && oldfile)
					{
						fetch_session(oldfile)["session"].removeMarker(users[i]["cursor"]);
					}
					if (position)
					{
						var crange = new Range(position.row, position.column, position.row, position.column + 1);
						users[i]["cursor"] = fetch_session(newfile)["session"].addMarker(crange, "mark", "fullLine", false);
					}
				}
			}
		});
		editor.on('changeSelection', function () {
			if (!changingsession && currentfile)
			{
				console.log(currentfile);
				console.log(editor.getCursorPosition());
				socket.emit("cursor-change", currentfile, editor.getCursorPosition());
			}
			else
			{
				changingsession = false;
			}
		});
		
		socket.on('random-username', function (username) {
			socket.emit('update-username', username);
		});		
		socket.on('update-username', function (username) {
			$("#username").html(html_username(username));
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
		socket.on('user-online', function(username, filename, position) {
			if (username != myname)
			{
				if (onlyyou)
				{
					$("#online").empty();
					onlyyou = false;
				}
				$("#online").append(html_user(username));
				var cursor = null;
				if (position && filename)
				{
					console.log(filename);
					var crange = new Range(position.row, position.column, position.row, position.column + 1);
					var cursor = fetch_session(filename)["session"].addMarker(crange, "mark", "fullLine", false);
					console.log("Cursor: " + cursor);
					console.log(position);
				}
				users.push({ username : username, cursor : cursor, filename : filename });
			}
		});
		socket.on('user-offline', function(username, filename) {
			console.log(username);
			$("p#" + username.replace(" ", "_")).remove();
			if (!filename)
			{
				var i = users.length;
				while (i--)
				{
					if (users[i]["username"] == username)
					{
						filename = users[i]["filename"];
					}
				}
			}
			fetch_session(filename)["session"].removeMarker(fetch_user(username)["cursor"]);
			remove_user(username);
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
		$("#username").click(function () {
			$("#username-edit").val(myname);
			$("#username").addClass("invisible-element");
			$("#username-edit").removeClass("invisible-element");
			$("#username-edit").focus();
			$("#username-edit").select();
		});
		$("#username-edit").blur(function () {
			var username = $("#username-edit").val();
			if (username != myname)
			{
				socket.emit('update-username', username);
			}
			$("#username-edit").addClass("invisible-element");
			$("#username").removeClass("invisible-element");
		});
		$('#username-edit').keyup(function(e) {
			var code = e.keyCode || e.which;
			if (code == 13)
			{
				var username = $("#username-edit").val();
				if (username != myname)
				{
					socket.emit('update-username', username);
				}
				$("#username-edit").addClass("invisible-element");
				$("#username").removeClass("invisible-element");
			}
		});
		
		socket.on("ping", function () {
			socket.emit("ping");
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
function fetch_user(username)
{
	var i = users.length;
	while (i--)
	{
		if (users[i]["username"] === username)
		{
			return users[i];
		}
	}
	return null;
}
function remove_user(username)
{
	var i = users.length;
	while (i--)
	{
		if (users[i]["username"] === username)
		{
			users.splice(i, 1);
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
	return " <span class=\"tool-text\">" + username.replace("_", " ") + "</span>";
}
function html_chat(talkerclass, username)
{
	return "<div class=\"well well-sm chatmsg\"><div class=\"talker " + talkerclass + "\">" + username + "</div><div class=\"" + talkerclass + " chat-text\"></div></div>";
}
function html_user(username)
{
	return "<p id=\"" + username.replace(" ", "_") + "\"class=\"green\"><i class=\"glyphicon glyphicon-user\"></i> " + username.replace("_", " ") + "</p>";
}
insert_file = function (filename) {
	var index = filename.indexOf(".");
	var extension = "other";
	if (index != -1)
	{
		extension = filename.slice(index + 1);
	}
	//console.log("adding: " + filename + ", " + extension);
	add_file_to(filename, extension);
};
add_file_to = function (filename, section) {
	if (!contains(sections, section.toLowerCase()))
	{
		add_section(section);
	}
	$("#section-" + section.toLowerCase()).after(html_file(filename));
}
add_section = function (title) {
	dom_files.append("<div id=\"section-" + title.toLowerCase() + "\" class=\"section fillx\"><p>" + title.toUpperCase() + "</p></div>");
	sections.push(title.toLowerCase());
}
select_file = function (filename) {
	changingsession = true;
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
make_mode = function (modename, cb) {
	if (!contains(modename, modes))
	{
		modefile = "/public/ace/src/mode-" + modename.slice(9) + ".js";
		$.ajax({
			url: modefile,
			dataType: 'script',
			cache: true,
			success: function() {
				modes.push(modename);
				cb(modename);
			}
		});
	}
	else
	{
		cb(modename);
	}
};
function getCookie(cname)
{
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) 
	{
		var c = ca[i].trim();
		if (c.indexOf(name) == 0)
		{
			return c.substring(name.length, c.length);
		}
	}
	return "";
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
