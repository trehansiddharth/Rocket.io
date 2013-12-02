$(document).ready(function ()
{
	var editor = ace.edit("editor");
	editor.setValue("", -1);
	var uploading = true;
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
			handleFileUpload(files, $("#upload"));
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
			alert("Not yet supported!");
		}
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
		
		console.log(hostid);
	
		$(".add-file").click(function ()
		{
			$(".item").removeClass("selected");
			$(this).addClass("selected");
			//uploading = true;
			$("#editor").addClass("invisible-element");
			$("#editor").removeClass("visible-element");
			$("#start").removeClass("invisible-element");
			$("#start").addClass("visible-element");
		});
		
		var gotofile = true;
		
		$("#makeproject").click(function ()
		{
			socket.emit('make-file', $("#filename").val(), $("#cpfile").val());
			//console.log($("#new-filename").val());
			gotofile = true;
		});
		
		socket.on('update-files', function (files) {
			for (var i = 0; i < files.length; i++)
			{
				var newid = files[i].replace(" ", "_");
				$(".super-select").prepend("<div class=\"item\" id=\"" + newid + "\"><span class=\"glyphicon glyphicon-file\"></span> " + files[i] + "</div>");
				console.log("#" + newid);
				$(".item#" + newid.replace(".", "\\.")).click(function ()
				{
					$(".item").removeClass("selected");
					$(this).addClass("selected");
					//uploading = false;
					$("#editor").addClass("visible-element");
					$("#editor").removeClass("invisible-element");
					$("#start").removeClass("visible-element");
					$("#start").addClass("invisible-element");
					socket.emit('get-file', $(this).attr('id'));
					var modename = require("ace/ext/modelist").getModeForPath($(this).attr('id')).mode;
					console.log(modename);
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
		
		editor.on('change', function (e) {
			if (!inserted)
			{
				socket.emit('file-change', e.data);
			}
		});
		
		socket.emit('create', projid);
		
		//$(".add-file").trigger('click');
	}
	
	$("#download").click(function () {
		$.ajax({
			url: "/d/download"
		});
	});
});
function handleFileUpload(files,obj)
{
   for (var i = 0; i < files.length; i++) 
   {
        var fd = new FormData();
	    var uploadURL = "/d/upload";
		fd.append('file', files[i]);
	    $.ajax({
	        url: uploadURL,
	        type: "POST",
	        contentType: "application/x-www-form-urlencoded; charset=utf-8",
	        processData: false,
	        data: fd
	    });
   }
}

/*function handleFileUpload(files, obj)
{
   for (var i = 0; i < files.length; i++) 
   {
        delivery.send(files[i]);
   }
}*/