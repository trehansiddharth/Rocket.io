$(document).ready(function ()
{
	var cuser = getCookie("username");
	if (cuser == "")
	{
		
	}
	else
	{
		$("#top-right").html("<span class=\"pointing\"><i class=\"glyphicon glyphicon-user\"></i> " + cuser.split("%20")[0] + "</span>");
	}
	var reader = new FileReader();
	$("#uploadlink").on('click', function (e)
	{
		document.getElementById('upload-dialog').click();
	});
	$("#upload-dialog").change(function (e) {
		handleFileUpload(reader, e.target.files);
	});
	$("#makeproject").click(function ()
	{
		if ($("#filename").val().indexOf(".") != -1)
		{
			socket.emit('make-project', $("#filename").val(), $("#cpfile").val());
		}
		else
		{
			alert("Your file name must be non-empty and specify an extension.");
		}
	});
	
	var url = $(location).attr('href');
	var parsed = $(location).attr('href').split('/');
	var projid = parsed[parsed.length - 1];
	var hostid = parsed[2];
	
	socket = io.connect("http://" + hostid);
	
	socket.on('project-ready', function (url) {
		window.location.href = "http://" + hostid + url;
	});
});
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
function handleFileUpload(reader, files) // TODO: validate file
{
	var thisfile = null;
	reader.onload = function(e) {
		socket.emit('make-project', thisfile.name, e.target.result);	
	}
	thisfile = files[0];
	reader.readAsText(files[0]);
}
