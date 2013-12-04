$(document).ready(function ()
{
	var editor = ace.edit("editor");
	editor.setValue("", -1);
	editor.setFontSize(15)
	var uploading = true;
	var reader = new FileReader();
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
		
		/*socket.on('connect', function () {
			console.log(require("delivery"));
			delivery = new require("delivery/lib/client").Delivery(socket);
		});*/
		
		//console.log(hostid);
	
		$(".add-file").click(function ()
		{
			$(".item").removeClass("selected");
			$(this).addClass("selected");
			$("#editor").addClass("invisible-element");
			$("#start").removeClass("invisible-element");
		});
		
		var gotofile = true;
		var hasfiles = false;
		
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
				var newid = files[i].replace(" ", "_");
				$(".super-select").prepend("<div class=\"item\" id=\"" + newid + "\"><span class=\"glyphicon glyphicon-file\"></span> " + files[i] + "</div>");
				//console.log("#" + newid);
				$(".item#" + newid.replace(".", "\\.")).click(function ()
				{
					$(".item").removeClass("selected");
					$(this).addClass("selected");
					//uploading = false;
					socket.emit('get-file', $(this).attr('id'));
					$("#editor").removeClass("invisible-element");
					$("#start").addClass("invisible-element");
					var modename = require("ace/ext/modelist").getModeForPath($(this).attr('id')).mode;
					//console.log(modename);
					var modeobj = require(modename).Mode;
					editor.getSession().setMode(new modeobj());
				});
				if (i == files.length - 1 && gotofile)
				{
					$(".item#" + newid.replace(".", "\\.")).trigger("click");
					gotofile = false;
				}
			}
		});
		
		var inserted = false;
		
		socket.on('result-contents', function (contents) {
			inserted = true;
			editor.setValue(contents, -1);
			inserted = false;
		});
		
		socket.on('file-change', function (change) {
			inserted = true;
			editor.getSession().getDocument().applyDeltas([change]);
			inserted = false;
		});
		
		socket.on('get-whole-file', function () {
			socket.emit('file-save', editor.getSession().getValue());
		});
		
		var myname = null;
		
		socket.on('update-username', function (username) {
			$("#username").append(" <span class=\"tool-text\">" + username + "</span>");
			myname = username;
		});
		
		var nowtalking = null;
		
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
		
		socket.on('user-online', function(username) {
			
		});
		
		socket.on('user-offline', function(username) {
		
		});
		
		editor.on('change', function (e) {
			if (!inserted)
			{
				socket.emit('file-change', e.data);
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
	}
});

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
